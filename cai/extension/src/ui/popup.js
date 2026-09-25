import { Settings, Context, ConfigCache, Queue, SyncState } from '../shared/storage.js';
import { SOURCE_LABEL, DEFAULT_VISIBLE_LIMIT } from '../shared/constants.js';

const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const sendBg = (msg) => chrome.runtime.sendMessage(msg);
let tab = null;
let pageState = null;
let rating = 0;

async function activeTab() {
  const [t] = await chrome.tabs.query({ active: true, currentWindow: true });
  return t;
}

function toTab(msg) {
  return new Promise((resolve) => {
    if (!tab?.id) return resolve(null);
    chrome.tabs.sendMessage(tab.id, msg, (res) => resolve(chrome.runtime.lastError ? null : res));
  });
}

function renderStars() {
  const box = $('stars');
  box.innerHTML = '';
  for (let i = 1; i <= 5; i++) {
    const b = document.createElement('button');
    b.textContent = i <= rating ? '★' : '☆';
    b.setAttribute('role', 'radio');
    b.setAttribute('aria-checked', String(i === rating));
    b.setAttribute('aria-label', i + ' sao');
    b.onclick = () => { rating = rating === i ? 0 : i; renderStars(); saveContext(); };
    box.appendChild(b);
  }
}

async function saveContext() {
  await Context.set({
    competitor_id: $('competitor').value,
    market: $('market').value.trim() || 'VN',
    product: $('product').value.trim(),
    campaign_label: $('campaign').value.trim(),
    audience_side: $('audience').value,
    tags: $('tags').value.split(',').map((s) => s.trim()).filter(Boolean),
    notes: $('notes').value.trim(),
    rating: rating || ''
  });
}

async function renderSync() {
  const s = await SyncState.get();
  const settings = await Settings.get();
  const status = !settings.endpoint || !settings.secret ? 'UNCONFIGURED' : s.status;
  document.querySelector('#syncLine .dot').className = 'dot ' + status;
  $('syncText').textContent = status === 'UNCONFIGURED' ? 'Chưa kết nối Google Sheets — mở ⚙ Cài đặt'
    : `${s.message || status}${s.at ? ' · ' + new Date(s.at).toLocaleTimeString('vi-VN') : ''}`;
  const q = await Queue.list();
  const by = q.reduce((m, i) => ((m[i.state] = (m[i.state] || 0) + 1), m), {});
  $('queueLine').textContent = q.length
    ? `Hàng đợi: ${q.length} mục · ${by.READY || 0} sẵn sàng · ${by.INCOMPLETE || 0} thiếu dữ liệu · ${(by.ERROR || 0) + (by.RETRY || 0)} lỗi`
    : 'Hàng đợi trống';
}

async function renderPage() {
  pageState = await toTab({ type: 'GET_STATE' });
  const supported = !!pageState;
  $('btnSaveSelected').disabled = !supported || !!pageState?.blocked || !pageState?.selected;
  $('btnSaveAll').disabled = !supported || !!pageState?.blocked || !pageState?.found;
  $('trendsHint').hidden = pageState?.source !== 'GOOGLE_TRENDS';
  if (!supported) {
    $('srcLabel').textContent = 'Trang này không phải thư viện quảng cáo';
    $('counts').textContent = 'Có thể lưu trang dưới dạng Landing Page.';
    return;
  }
  $('srcLabel').textContent = SOURCE_LABEL[pageState.source] || pageState.label;
  const st = pageState.states || {};
  $('counts').innerHTML = pageState.source === 'GOOGLE_TRENDS' ? '' :
    `Phát hiện <b>${pageState.found}</b> quảng cáo · 🟢 ${st.NEW || 0} mới · 🔵 ${st.KNOWN || 0} đã có · 🟠 ${st.CHANGED || 0} đã đổi` +
    (st.LOW ? ` · 🟣 ${st.LOW} cần kiểm tra` : '') + `<br>Đã chọn: <b>${pageState.selected}</b>`;
  if (pageState.blocked) {
    $('blocked').hidden = false;
    $('blocked').textContent = 'Trang đang yêu cầu đăng nhập / CAPTCHA / bị giới hạn. Extension tạm dừng — hãy tự xử lý trên trang.';
  }
  $('btnSaveSelected').textContent = `💾 Lưu quảng cáo đã chọn (${pageState.selected || 0})`;
  const limit = (await Settings.get()).visibleLimit || DEFAULT_VISIBLE_LIMIT;
  $('btnSaveAll').textContent = `📥 Lưu tất cả đang hiển thị (${Math.min(pageState.found || 0, limit)})`;
}

async function renderContext() {
  const [ctx, cfg] = await Promise.all([Context.get(), ConfigCache.get()]);
  const sel = $('competitor');
  sel.innerHTML = '<option value="">— Tự nhận diện —</option>' +
    (cfg?.competitors || []).map((c) => `<option value="${esc(c.competitor_id)}">${esc(c.competitor_name)} (${esc(c.competitor_id)})</option>`).join('');
  sel.value = ctx.competitor_id || '';
  $('market').value = ctx.market || 'VN';
  $('product').value = ctx.product || cfg?.focus_product || '';
  $('campaign').value = ctx.campaign_label || '';
  $('audience').value = ctx.audience_side || 'AUTO';
  $('tags').value = (ctx.tags || []).join(', ');
  $('notes').value = ctx.notes || '';
  $('tagList').innerHTML = (cfg?.tags || []).map((t) => `<option value="${esc(t)}">`).join('');
  rating = Number(ctx.rating) || 0;
  renderStars();
}

async function enqueue(captures) {
  if (!captures?.length) return;
  await saveContext();
  const res = await sendBg({ type: 'ENQUEUE', captures, context: await Context.get() });
  if (res?.ok) {
    await toTab({ type: 'CLEAR_SELECTION' });
    $('queueLine').textContent = `Đã thêm ${res.queued} mục (${res.incomplete} cần bổ sung). Mở Review Queue để gửi.`;
  } else {
    $('queueLine').textContent = 'Lỗi: ' + (res?.error || 'không rõ');
  }
  await renderPage();
}

document.addEventListener('DOMContentLoaded', async () => {
  tab = await activeTab();
  await Promise.all([renderContext(), renderPage(), renderSync()]);
  ['competitor', 'market', 'product', 'campaign', 'audience', 'tags', 'notes'].forEach((id) => $(id).addEventListener('change', saveContext));

  $('btnOptions').onclick = () => chrome.runtime.openOptionsPage();
  const openPanel = async () => { await chrome.sidePanel.open({ windowId: tab.windowId }); window.close(); };
  $('btnPanel').onclick = openPanel;
  $('btnOpenQueue').onclick = openPanel;

  $('btnSaveSelected').onclick = async () => {
    const res = await toTab({ type: 'GET_SELECTED' });
    await enqueue(res?.captures);
  };
  $('btnSaveAll').onclick = async () => {
    const limit = (await Settings.get()).visibleLimit || DEFAULT_VISIBLE_LIMIT;
    const found = pageState?.found || 0;
    if (found > limit && !confirm(`Trang có ${found} quảng cáo. Chỉ lưu ${limit} quảng cáo đầu tiên?`)) return;
    const res = await toTab({ type: 'GET_ALL_VISIBLE', limit });
    await enqueue(res?.captures);
  };
  $('btnLanding').onclick = async () => {
    $('btnLanding').disabled = true;
    const res = await sendBg({ type: 'SAVE_LANDING', tabId: tab.id });
    $('queueLine').textContent = res?.ok ? `Đã thêm landing page "${res.item.page_title || res.item.url}" vào hàng đợi.` : 'Lỗi: ' + (res?.error || 'không đọc được trang');
    $('btnLanding').disabled = false;
  };
});
