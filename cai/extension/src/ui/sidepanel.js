import { Queue, SyncState, ConfigCache, History, STORAGE_KEYS } from '../shared/storage.js';
import { SOURCE_LABEL, FORMATS, AUDIENCES, STATUSES } from '../shared/constants.js';
import { parseMultiTimeline, parseRelatedQueries, parseTrendsUrl, buildTrendsPayload } from '../shared/trends-csv.js';

const $ = (id) => document.getElementById(id);
const sendBg = (msg) => chrome.runtime.sendMessage(msg);
const selected = new Set();
let items = [];
let config = null;

/** Tạo phần tử DOM an toàn (không dùng innerHTML với dữ liệu). */
function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  return el;
}

function select(options, value, onchange, label) {
  return h('select', { 'aria-label': label, onchange }, options.map(([v, t]) => h('option', { value: v, selected: v === value ? 'selected' : null }, t)));
}

/* ---------------- Tabs ---------------- */

document.querySelectorAll('nav [role=tab]').forEach((btn) => btn.addEventListener('click', () => {
  document.querySelectorAll('nav [role=tab]').forEach((b) => b.setAttribute('aria-selected', String(b === btn)));
  ['queue', 'trends', 'launch', 'history'].forEach((t) => { $('tab-' + t).hidden = t !== btn.dataset.tab; });
  $('footer').hidden = btn.dataset.tab !== 'queue';
  if (btn.dataset.tab === 'launch') renderLaunch();
  if (btn.dataset.tab === 'history') renderHistory();
  if (btn.dataset.tab === 'trends') prefillTrends();
}));

/* ---------------- Queue ---------------- */

async function update(id, patch) {
  const res = await sendBg({ type: 'QUEUE_UPDATE', client_id: id, patch });
  if (!res?.ok) alert('Không cập nhật được: ' + (res?.error || ''));
}

function field(label, value, onchange, { multiline = false, rows = 3 } = {}) {
  const input = multiline ? h('textarea', { rows, value: value || '' }) : h('input', { value: value || '' });
  input.addEventListener('change', () => onchange(input.value));
  return h('div', {}, h('label', {}, label), input);
}

function adCard(it) {
  const compOptions = [['', '— chưa map —']].concat((config?.competitors || []).map((c) => [c.competitor_id, c.competitor_name]));
  const thumb = (it.media_urls || [])[0];
  const pillState = it.state === 'READY' ? it.known : it.state;
  return h('div', { class: 'card item', 'data-id': it.client_id },
    h('header', {},
      h('input', { type: 'checkbox', style: 'width:auto', checked: selected.has(it.client_id), 'aria-label': 'Chọn',
        onchange: (e) => { e.target.checked ? selected.add(it.client_id) : selected.delete(it.client_id); renderFooter(); } }),
      h('span', { class: 'pill ' + pillState }, { NEW: 'Mới', KNOWN: 'Đã có', CHANGED: 'Đã đổi', INCOMPLETE: 'Thiếu dữ liệu', ERROR: 'Lỗi', RETRY: 'Chờ thử lại', SENDING: 'Đang gửi' }[pillState] || pillState),
      h('b', {}, SOURCE_LABEL[it.source] || it.source),
      h('span', {}, '· ' + (it.advertiser_name || '?')),
      it.start_date ? h('span', { class: 'muted' }, '· từ ' + it.start_date) : null,
      h('span', { class: 'muted' }, '· ' + (it.is_active || '')),
      it.mode === 'TOUCH' ? h('span', { class: 'muted' }, '· chỉ cập nhật "lần thấy"') : null),
    it.errors?.length ? h('div', { class: 'err' }, it.errors.map((e) => (e.field ? e.field + ': ' : '') + (e.message || e.code)).join(' · ')) : null,
    it.missing?.length ? h('div', { class: 'err' }, 'Thiếu: ' + it.missing.join(', ')) : null,
    it.needs_manual_text ? h('div', { class: 'hint' }, 'Nội dung quảng cáo Google nằm trong khung khác nguồn — hãy dán headline/nội dung bên dưới.') : null,
    h('div', { class: 'grid' },
      thumb ? h('img', { class: 'thumb', src: thumb, alt: '', referrerpolicy: 'no-referrer', onerror: (e) => { e.target.replaceWith(h('div', { class: 'thumb muted', title: 'Ảnh hết hạn hoặc bị chặn' })); } }) : h('div', { class: 'thumb' }),
      h('div', {},
        field('Headline', it.headline, (v) => update(it.client_id, { headline: v })),
        field('Nội dung', it.body_text, (v) => update(it.client_id, { body_text: v }), { multiline: true }),
        h('div', { class: 'two' },
          field('CTA', it.cta_text, (v) => update(it.client_id, { cta_text: v })),
          h('div', {}, h('label', {}, 'Định dạng'), select(FORMATS.map((f) => [f, f]), it.format, (e) => update(it.client_id, { format: e.target.value }), 'Định dạng'))))),
    h('div', { class: 'two' },
      h('div', {}, h('label', {}, 'Đối thủ'), select(compOptions, it.competitor_id, (e) => update(it.client_id, { competitor_id: e.target.value }), 'Đối thủ')),
      h('div', {}, h('label', {}, 'Phía khách hàng'), select(AUDIENCES.map((a) => [a, a]), it.audience_side, (e) => update(it.client_id, { audience_side: e.target.value }), 'Phía khách hàng')),
      h('div', {}, h('label', {}, 'Trạng thái chạy'), select(STATUSES.map((a) => [a, a]), it.is_active, (e) => update(it.client_id, { is_active: e.target.value }), 'Trạng thái')),
      field('Ngày bắt đầu (yyyy-MM-dd)', it.start_date, (v) => update(it.client_id, { start_date: v.trim() })),
      field('Sản phẩm', it.product, (v) => update(it.client_id, { product: v })),
      field('Chiến dịch', it.campaign_label, (v) => update(it.client_id, { campaign_label: v }))),
    field('Landing URL', it.landing_url_raw, (v) => update(it.client_id, { landing_url_raw: v.trim() })),
    h('div', { class: 'two' },
      field('Tag', (it.tags || []).join(', '), (v) => update(it.client_id, { tags: v.split(',').map((s) => s.trim()).filter(Boolean) })),
      field('Đánh giá 1–5', it.rating, (v) => update(it.client_id, { rating: v ? Math.max(1, Math.min(5, Number(v) || 0)) || '' : '' }))),
    field('Ghi chú', it.notes, (v) => update(it.client_id, { notes: v }), { multiline: true, rows: 2 }),
    h('div', { class: 'meta' }, `${it.ad_uid} · fp ${String(it.content_fp || '').slice(0, 10)}… · độ tin cậy ${it.extract_confidence || '?'} · `,
      it.ad_url ? h('a', { href: it.ad_url, target: '_blank', rel: 'noopener' }, 'Mở quảng cáo gốc') : ''));
}

function landingCard(it) {
  const compOptions = [['', '— chưa map —']].concat((config?.competitors || []).map((c) => [c.competitor_id, c.competitor_name]));
  return h('div', { class: 'card item', 'data-id': it.client_id },
    h('header', {},
      h('input', { type: 'checkbox', style: 'width:auto', checked: selected.has(it.client_id), 'aria-label': 'Chọn',
        onchange: (e) => { e.target.checked ? selected.add(it.client_id) : selected.delete(it.client_id); renderFooter(); } }),
      h('span', { class: 'pill ' + it.state }, it.state === 'READY' ? 'Landing page' : it.state),
      h('b', {}, it.page_title || it.url)),
    it.errors?.length ? h('div', { class: 'err' }, it.errors.map((e) => e.message || e.code).join(' · ')) : null,
    h('div', { class: 'meta' }, it.url),
    h('div', { class: 'two' },
      h('div', {}, h('label', {}, 'Đối thủ'), select(compOptions, it.competitor_id, (e) => update(it.client_id, { competitor_id: e.target.value }), 'Đối thủ')),
      field('CTA chính', it.primary_cta, (v) => update(it.client_id, { primary_cta: v }))),
    field('H1', it.h1, (v) => update(it.client_id, { h1: v })),
    field('Offer', it.offer, (v) => update(it.client_id, { offer: v })),
    field('Social proof', it.social_proof, (v) => update(it.client_id, { social_proof: v })),
    h('div', { class: 'meta' }, `Form: ${it.form_present ? (it.form_fields || []).join(', ') || 'có' : 'không'} · Giá: ${(it.price_points || []).join(', ') || '—'}`));
}

async function renderQueue() {
  items = await Queue.list();
  config = await ConfigCache.get();
  const f = $('filter').value;
  const shown = items.filter((i) => !f || (f === 'landing' ? i.kind === 'landing' : i.state === f || (f === 'ERROR' && i.state === 'RETRY')));
  const list = $('list');
  const focusedId = document.activeElement?.closest?.('.item')?.dataset.id;
  if (focusedId && document.activeElement.matches('input,textarea,select')) return; // không vẽ lại khi đang gõ
  list.replaceChildren(...shown.map((it) => (it.kind === 'landing' ? landingCard(it) : adCard(it))));
  $('empty').hidden = shown.length > 0;
  $('qCount').textContent = items.length ? `(${items.length})` : '';
  for (const id of [...selected]) if (!items.some((i) => i.client_id === id)) selected.delete(id);
  renderFooter();
}

function renderFooter() {
  const sel = items.filter((i) => selected.has(i.client_id));
  const sendable = (sel.length ? sel : items).filter((i) => ['READY', 'RETRY', 'ERROR'].includes(i.state));
  $('btnSend').textContent = `Gửi (${sendable.length}) ▶`;
  $('btnSend').disabled = !sendable.length;
  $('btnRemove').disabled = !sel.length;
  const incomplete = items.filter((i) => i.state === 'INCOMPLETE').length;
  $('footText').textContent = sel.length ? `${sel.length} đã chọn` : incomplete ? `${incomplete} mục thiếu dữ liệu chưa gửi được` : '';
}

async function renderSync() {
  const s = await SyncState.get();
  $('syncDot').className = 'dot ' + (s.status || 'UNCONFIGURED');
  $('syncText').textContent = s.message ? `${s.message}${s.at ? ' · ' + new Date(s.at).toLocaleTimeString('vi-VN') : ''}` : '';
}

$('filter').addEventListener('change', renderQueue);
$('selAll').addEventListener('change', (e) => {
  const f = $('filter').value;
  items.filter((i) => !f || i.state === f || (f === 'landing' && i.kind === 'landing')).forEach((i) => (e.target.checked ? selected.add(i.client_id) : selected.delete(i.client_id)));
  renderQueue();
});
$('btnBulkTag').addEventListener('click', async () => {
  const tags = $('bulkTag').value.split(',').map((s) => s.trim()).filter(Boolean);
  if (!tags.length || !selected.size) return;
  for (const it of items.filter((i) => selected.has(i.client_id) && i.kind === 'ad')) {
    await update(it.client_id, { tags: [...new Set([...(it.tags || []), ...tags])] });
  }
  $('bulkTag').value = '';
});
$('btnRemove').addEventListener('click', async () => {
  if (!selected.size || !confirm(`Xóa ${selected.size} mục khỏi hàng đợi?`)) return;
  await sendBg({ type: 'QUEUE_REMOVE', ids: [...selected] });
  selected.clear();
});
$('btnSend').addEventListener('click', async () => {
  const sel = items.filter((i) => selected.has(i.client_id));
  const target = (sel.length ? sel : items).filter((i) => ['READY', 'RETRY', 'ERROR'].includes(i.state));
  const ids = target.map((i) => i.client_id);
  $('btnSend').disabled = true;
  $('footText').textContent = 'Đang gửi…';
  const res = await sendBg({ type: 'SEND', ids });
  $('footText').textContent = res?.message || res?.error || (res?.ok ? 'Đã gửi' : 'Lỗi');
  selected.clear();
});

chrome.storage.onChanged.addListener((changes, area) => {
  if (area !== 'local') return;
  if (changes[STORAGE_KEYS.queue] || changes[STORAGE_KEYS.config]) renderQueue();
  if (changes[STORAGE_KEYS.sync]) renderSync();
});

/* ---------------- Trends import ---------------- */

let trendsParsed = { timeline: null, related: null };

async function prefillTrends() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  const meta = t?.url ? parseTrendsUrl(t.url) : null;
  if (meta) {
    $('tGeo').value = meta.geo || $('tGeo').value;
    $('tTime').value = meta.timeframe || $('tTime').value;
    $('tUrl').value = t.url;
    if (meta.keywords.length && !$('tRelKw').value) $('tRelKw').value = meta.keywords[meta.keywords.length - 1];
  }
}

async function readFiles(files) {
  $('tMsg').textContent = '';
  for (const f of files) {
    const text = await f.text();
    try {
      if (/TOP|RISING|HÀNG ĐẦU|ĐANG TĂNG/i.test(text.split(/\r?\n/).slice(0, 6).join(' ')) && !/^(Week|Day|Month|Tuần|Ngày|Tháng|Time)/im.test(text)) {
        trendsParsed.related = parseRelatedQueries(text);
      } else {
        trendsParsed.timeline = parseMultiTimeline(text);
      }
    } catch (e) {
      $('tMsg').textContent = `${f.name}: ${e.message}`;
    }
  }
  renderTrendsPreview();
}

function renderTrendsPreview() {
  const box = $('tPreview');
  const rows = [];
  if (trendsParsed.timeline) {
    for (const s of trendsParsed.timeline.series) {
      const last = s.points[s.points.length - 1];
      rows.push(h('tr', {}, h('td', {}, s.keyword), h('td', {}, `${s.points.length} điểm`), h('td', {}, last ? `${last[0]}: ${last[1]}` : '')));
    }
  }
  const rel = trendsParsed.related;
  box.replaceChildren(
    rows.length ? h('table', {}, h('thead', {}, h('tr', {}, h('th', {}, 'Keyword'), h('th', {}, 'Dữ liệu'), h('th', {}, 'Mới nhất'))), h('tbody', {}, rows)) : '',
    rel ? h('p', { class: 'muted' }, `Related: ${rel.top.length} top · ${rel.rising.length} rising`) : '');
  $('btnTrendsSend').disabled = !trendsParsed.timeline;
}

const drop = $('drop');
['dragenter', 'dragover'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.add('over'); }));
['dragleave', 'drop'].forEach((ev) => drop.addEventListener(ev, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
drop.addEventListener('drop', (e) => readFiles([...e.dataTransfer.files]));
$('tFile').addEventListener('change', (e) => readFiles([...e.target.files]));
$('btnTrendsSend').addEventListener('click', async () => {
  const relKw = $('tRelKw').value.trim();
  const payload = buildTrendsPayload({
    timeline: trendsParsed.timeline,
    related: trendsParsed.related && relKw ? { [relKw]: trendsParsed.related } : {},
    meta: { geo: $('tGeo').value.trim(), timeframe: $('tTime').value.trim(), batch_id: $('tBatch').value.trim(),
      anchor_keyword: $('tAnchor').value.trim(), source_url: $('tUrl').value.trim() }
  });
  $('btnTrendsSend').disabled = true;
  const res = await sendBg({ type: 'TRENDS_UPLOAD', payload });
  $('tMsg').textContent = res?.ok ? `Đã gửi: ${res.summary.points_inserted} điểm mới, ${res.summary.points_updated} cập nhật.` : 'Lỗi: ' + (res?.error?.message || res?.error || '');
  if (res?.ok) { trendsParsed = { timeline: null, related: null }; renderTrendsPreview(); }
  else $('btnTrendsSend').disabled = false;
});

/* ---------------- Launchpad ---------------- */

async function renderLaunch() {
  config = await ConfigCache.get();
  const f = $('lFilter').value;
  const urls = (config?.search_urls || []).filter((u) => !f || u.platform === f);
  $('lBody').replaceChildren(...(urls.length ? urls.map((u) => h('tr', {},
    h('td', {}, u.competitor_name || u.query_value),
    h('td', {}, u.platform),
    h('td', { class: 'muted' }, u.last_opened_at || '—'),
    h('td', {}, h('button', { onclick: () => sendBg({ type: 'OPEN_URLS', urls: [u] }) }, 'Mở')))) :
    [h('tr', {}, h('td', { colspan: 4, class: 'muted' }, 'Chưa có URL. Kiểm tra kết nối trong Cài đặt, rồi bấm "Đồng bộ danh mục".'))]));
}
$('lFilter').addEventListener('change', renderLaunch);
$('btnRefreshMeta').addEventListener('click', async () => {
  $('btnRefreshMeta').disabled = true;
  const res = await sendBg({ type: 'REFRESH_META' });
  $('btnRefreshMeta').disabled = false;
  $('btnRefreshMeta').textContent = res?.ok ? `↻ Đã đồng bộ (${res.competitors} đối thủ, ${res.indexed} QC)` : '↻ Lỗi đồng bộ';
  renderLaunch();
});

/* ---------------- History ---------------- */

async function renderHistory() {
  const hist = await History.list();
  $('hBody').replaceChildren(...hist.map((e) => h('tr', {},
    h('td', {}, new Date(e.at).toLocaleString('vi-VN')),
    h('td', {}, e.action),
    h('td', { class: e.ok ? '' : 'err' }, e.summary ? Object.entries(e.summary).map(([k, v]) => `${k}: ${v}`).join(' · ') : '', e.error ? ' — ' + e.error : ''))));
}

renderQueue();
renderSync();
