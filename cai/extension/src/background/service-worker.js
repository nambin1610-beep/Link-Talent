/**
 * Background Service Worker (MV3, module). Mọi state nằm trong chrome.storage (SW có thể bị tắt bất kỳ lúc nào).
 */
import { EXT_VERSION, MAX_BATCH, SOURCES } from '../shared/constants.js';
import { normalizeCapture, fingerprint, missingFields, toWire, normalizeLanding, normalizeText, matchCompetitor } from '../shared/normalize.js';
import { sha256Hex } from '../shared/crypto.js';
import { callApi, health } from '../shared/api.js';
import { landingExtract } from '../shared/landing-extract.js';
import { Settings, Context, ConfigCache, IndexCache, Queue, SyncState, History } from '../shared/storage.js';

const tabStats = new Map();

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({ id: 'cai-save-landing', title: 'CAI: Lưu trang này làm Landing Page', contexts: ['page'] });
  chrome.alarms.create('retry-queue', { periodInMinutes: 5 });
  chrome.alarms.create('refresh-meta', { periodInMinutes: 360 });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === 'cai-save-landing' && tab?.id) captureLanding(tab.id).catch(() => {});
});

chrome.alarms.onAlarm.addListener(async (a) => {
  if (a.name === 'retry-queue') await sendQueued({ onlyStates: ['RETRY'] });
  if (a.name === 'refresh-meta') await refreshMeta();
});

chrome.commands.onCommand.addListener(async (cmd, tab) => {
  if (cmd === 'open-panel' && tab?.windowId) chrome.sidePanel.open({ windowId: tab.windowId });
  if (cmd === 'toggle-select' && tab?.id) chrome.tabs.sendMessage(tab.id, { type: 'TOGGLE_HOVERED' }).catch(() => {});
});

chrome.tabs.onRemoved.addListener((tabId) => tabStats.delete(tabId));

chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  const h = handlers[msg?.type];
  if (!h) return false;
  Promise.resolve(h(msg, sender)).then(reply, (e) => reply({ ok: false, error: String(e?.message || e) }));
  return true;
});

/* ---------------- Chuẩn hóa ---------------- */

async function prepare(cap, context, config) {
  const r = await fingerprint(normalizeCapture(cap, context, config));
  const known = await IndexCache.lookup(r.ad_uid);
  r.known = !known ? 'NEW' : known.fp === r.content_fp ? 'KNOWN' : 'CHANGED';
  r.mode = r.known === 'KNOWN' ? 'TOUCH' : 'FULL';
  const miss = r.mode === 'FULL' ? missingFields(r) : [];
  r.state = miss.length ? 'INCOMPLETE' : 'READY';
  r.missing = miss;
  r.needs_manual_text = !!cap.needs_manual_text;
  r.added_at = new Date().toISOString();
  return r;
}

async function recompute(item) {
  const { known, mode, state, missing, ...base } = item;
  base.headline = normalizeText(base.headline);
  base.body_text = normalizeText(base.body_text);
  base.description = normalizeText(base.description);
  base.cta_text = normalizeText(base.cta_text);
  if (base.landing_url_raw) base.landing_url = normalizeLanding(base.landing_url_raw).url;
  const r = await fingerprint(base);
  const idx = await IndexCache.lookup(r.ad_uid);
  r.known = !idx ? 'NEW' : idx.fp === r.content_fp ? 'KNOWN' : 'CHANGED';
  r.mode = r.known === 'KNOWN' ? 'TOUCH' : 'FULL';
  const miss = r.mode === 'FULL' ? missingFields(r) : [];
  r.missing = miss;
  r.state = miss.length ? 'INCOMPLETE' : 'READY';
  return r;
}

/* ---------------- Handlers ---------------- */

const handlers = {
  async PAGE_STATS(msg, sender) {
    const tabId = sender.tab?.id;
    if (tabId === undefined) return { ok: true };
    tabStats.set(tabId, { source: msg.source, found: msg.found, blocked: msg.blocked });
    await chrome.action.setBadgeBackgroundColor({ tabId, color: msg.blocked ? '#cf222e' : '#1f6feb' });
    await chrome.action.setBadgeText({ tabId, text: msg.blocked ? '!' : msg.found ? String(Math.min(msg.found, 999)) : '' });
    return { ok: true };
  },

  async LOOKUP(msg) {
    const config = await ConfigCache.get();
    const statuses = {};
    for (const cap of msg.captures || []) {
      const r = await fingerprint(normalizeCapture(cap, {}, config));
      const idx = await IndexCache.lookup(r.ad_uid);
      statuses[cap.client_id] = !idx ? 'NEW' : idx.fp === r.content_fp ? 'KNOWN' : 'CHANGED';
    }
    return { ok: true, statuses };
  },

  async ENQUEUE(msg) {
    const context = msg.context || (await Context.get());
    const config = await ConfigCache.get();
    const items = [];
    for (const cap of msg.captures || []) items.push(await prepare(cap, context, config));
    await Queue.addMany(items);
    await updateSyncBadge();
    return { ok: true, queued: items.length, incomplete: items.filter((i) => i.state === 'INCOMPLETE').length };
  },

  async QUEUE_LIST() {
    return { ok: true, items: await Queue.list() };
  },

  async QUEUE_UPDATE(msg) {
    const [item] = await Queue.getMany([msg.client_id]);
    if (!item) return { ok: false, error: 'Không tìm thấy' };
    const merged = { ...item, ...msg.patch };
    if (item.kind !== 'ad') {
      await Queue.patch(msg.client_id, msg.patch);
      return { ok: true };
    }
    const contentChanged = ['headline', 'body_text', 'description', 'cta_text', 'landing_url_raw', 'advertiser_name', 'media_urls']
      .some((k) => k in msg.patch);
    const next = contentChanged || 'ad_url' in msg.patch ? await recompute(merged) : merged;
    if (!contentChanged && next.mode === 'FULL') {
      next.missing = missingFields(next);
      next.state = next.missing.length ? 'INCOMPLETE' : 'READY';
    }
    await Queue.remove([msg.client_id]);
    await Queue.addMany([next]);
    return { ok: true, item: next };
  },

  async QUEUE_REMOVE(msg) {
    await Queue.remove(msg.ids || []);
    await updateSyncBadge();
    return { ok: true };
  },

  async SEND(msg) {
    // Người dùng chủ động bấm Gửi: cho phép gửi lại cả mục đang lỗi
    return sendQueued({ ids: msg.ids, onlyStates: ['READY', 'RETRY', 'ERROR'] });
  },

  async SAVE_LANDING(msg) {
    return captureLanding(msg.tabId, msg.linked_ad_uids);
  },

  async TRENDS_UPLOAD(msg) {
    const settings = await Settings.get();
    const res = await callApi(settings, 'trends.upsert', { ...msg.payload, client: clientInfo() });
    await History.add({ action: 'trends.upsert', ok: !!res.ok, summary: res.summary || null, error: res.error?.message || '' });
    await SyncState.set(res.ok ? { status: 'OK', message: 'Đã gửi dữ liệu Trends' } : { status: 'ERROR', message: res.error?.message || 'Lỗi' });
    return res;
  },

  async HEALTH() {
    const s = await Settings.get();
    if (!s.endpoint) return { ok: false, error: { message: 'Chưa nhập endpoint' } };
    const h = await health(s.endpoint);
    if (!h.ok) return h;
    const cfg = await callApi(s, 'config.get', {});
    if (cfg.ok) {
      await ConfigCache.set(cfg);
      await SyncState.set({ status: 'OK', message: 'Kết nối thành công' });
    } else {
      await SyncState.set({ status: 'ERROR', message: cfg.error?.message || 'Lỗi xác thực' });
    }
    return cfg.ok ? { ok: true, competitors: cfg.competitors.length, user: cfg.user_id } : cfg;
  },

  async REFRESH_META() {
    return refreshMeta();
  },

  async OPEN_URLS(msg) {
    const urls = (msg.urls || []).slice(0, 5); // tối đa 5 tab mỗi lần, cách nhau 3 giây
    for (let i = 0; i < urls.length; i++) {
      await chrome.tabs.create({ url: urls[i].url, active: i === 0 });
      if (i < urls.length - 1) await new Promise((r) => setTimeout(r, 3000));
    }
    const settings = await Settings.get();
    callApi(settings, 'searchurl.opened', { url_ids: urls.map((u) => u.url_id) }).catch(() => {});
    return { ok: true, opened: urls.length };
  },

  async TAB_STATS(msg) {
    return { ok: true, stats: tabStats.get(msg.tabId) || null };
  },

  async CLIENT_ERROR(msg) {
    const settings = await Settings.get();
    callApi(settings, 'log.client', { source: msg.source, errors: [{ code: 'EXTRACT_ERROR', message: String(msg.message).slice(0, 500) }], client: clientInfo() }, { maxRetries: 0 }).catch(() => {});
    return { ok: true };
  }
};

function clientInfo(extra = {}) {
  return { extension_version: EXT_VERSION, schema_version: 1, ...extra };
}

/* ---------------- Landing page ---------------- */

async function captureLanding(tabId, linkedAdUids = []) {
  const [{ result } = {}] = await chrome.scripting.executeScript({ target: { tabId }, func: landingExtract });
  if (!result) return { ok: false, error: 'Không đọc được trang (trang hệ thống hoặc bị chặn)' };
  const config = await ConfigCache.get();
  const norm = normalizeLanding(result.final_url || result.url);
  const sectionHashes = {};
  for (const [k, v] of Object.entries(result.sections || {})) sectionHashes[k] = (await sha256Hex(normalizeText(v).toLowerCase())).slice(0, 16);
  const item = {
    kind: 'landing',
    client_id: 'lp_' + Date.now().toString(36),
    competitor_id: matchCompetitor(config, { landing_url: norm.url }) || (await Context.get()).competitor_id || '',
    url: result.url,
    final_url: result.final_url,
    page_title: result.page_title,
    meta_description: result.meta_description,
    h1: result.h1,
    offer: result.offer,
    primary_cta: result.primary_cta,
    secondary_ctas: result.secondary_ctas,
    social_proof: result.social_proof,
    form_present: result.form_present,
    form_fields: result.form_fields,
    pricing_visible: result.pricing_visible,
    price_points: result.price_points,
    url_status: result.is_error_page ? 'ERROR_PAGE' : 'OK',
    content_hash: await sha256Hex(normalizeText(result.main_text).toLowerCase()),
    section_hashes: sectionHashes,
    linked_ad_uids: linkedAdUids,
    checked_at: result.captured_at,
    domain: norm.domain,
    state: 'READY',
    added_at: new Date().toISOString()
  };
  await Queue.addMany([item]);
  await updateSyncBadge();
  return { ok: true, item };
}

/* ---------------- Gửi hàng đợi ---------------- */

let sending = false;

async function sendQueued({ ids = null, onlyStates = ['READY', 'RETRY'] } = {}) {
  if (sending) return { ok: false, error: 'Đang gửi, vui lòng đợi' };
  sending = true;
  try {
    const settings = await Settings.get();
    const all = ids ? await Queue.getMany(ids) : await Queue.list();
    const items = all.filter((i) => onlyStates.includes(i.state));
    if (!items.length) return { ok: true, summary: { received: 0 }, message: 'Không có mục sẵn sàng để gửi' };
    const context = await Context.get();
    const total = { received: 0, inserted: 0, updated: 0, touched: 0, unchanged: 0, rejected: 0 };
    const errors = [];
    const groups = [
      { action: 'ads.upsert', items: items.filter((i) => i.kind === 'ad'), wire: (i) => toWire(i, i.mode) },
      { action: 'landing.upsert', items: items.filter((i) => i.kind === 'landing'), wire: landingWire }
    ];
    for (const g of groups) {
      for (let k = 0; k < g.items.length; k += MAX_BATCH) {
        const batch = g.items.slice(k, k + MAX_BATCH);
        for (const it of batch) await Queue.patch(it.client_id, { state: 'SENDING' });
        const payload = {
          client: clientInfo({ found_on_page: batch.length }),
          context: { market: context.market, product: context.product, campaign_label: context.campaign_label, competitor_id: context.competitor_id },
          records: batch.map(g.wire)
        };
        const res = await callApi(settings, g.action, payload);
        if (!res.ok) {
          const retry = !!res.error?.retryable;
          for (const it of batch) await Queue.patch(it.client_id, { state: retry ? 'RETRY' : 'ERROR', errors: [res.error] });
          errors.push(res.error?.message || res.error?.code);
          await SyncState.set({ status: 'ERROR', message: res.error?.message || 'Lỗi đồng bộ' });
          continue;
        }
        for (const key of Object.keys(total)) total[key] += res.summary?.[key] || 0;
        const byClient = Object.fromEntries((res.results || []).map((r) => [r.client_id, r]));
        const done = [];
        const idx = {};
        for (const it of batch) {
          const r = byClient[it.client_id];
          if (r && r.status !== 'REJECTED') {
            done.push(it.client_id);
            if (it.kind === 'ad') idx[it.ad_uid] = { fp: it.content_fp, record_id: r.record_id, last_seen_at: new Date().toISOString().slice(0, 10) };
          } else {
            await Queue.patch(it.client_id, { state: 'ERROR', errors: r?.errors || [{ message: 'Không có kết quả' }] });
            if (r?.errors) errors.push(...r.errors.map((e) => e.message));
          }
        }
        await Queue.remove(done);
        if (Object.keys(idx).length) await IndexCache.merge(idx);
      }
    }
    const ok = errors.length === 0;
    const message = `${total.inserted} mới · ${total.updated} cập nhật · ${total.touched + total.unchanged} trùng · ${total.rejected} lỗi`;
    await SyncState.set({ status: ok ? 'OK' : 'PARTIAL', message });
    await History.add({ action: 'send', ok, summary: total, error: errors.slice(0, 3).join('; ') });
    await updateSyncBadge();
    return { ok, summary: total, message, errors };
  } finally {
    sending = false;
  }
}

function landingWire(i) {
  const { kind, state, added_at, errors, domain, ...rest } = i;
  return rest;
}

async function refreshMeta() {
  const settings = await Settings.get();
  if (!settings.endpoint) return { ok: false };
  const cfg = await callApi(settings, 'config.get', {}, { maxRetries: 1 });
  if (cfg.ok) await ConfigCache.set(cfg);
  const idx = await callApi(settings, 'index.get', {}, { maxRetries: 1 });
  if (idx.ok) await IndexCache.replace(idx.index);
  return { ok: cfg.ok && idx.ok, competitors: cfg.competitors?.length || 0, indexed: idx.count || 0 };
}

async function updateSyncBadge() {
  const q = await Queue.list();
  const pending = q.filter((i) => ['READY', 'RETRY', 'INCOMPLETE', 'ERROR'].includes(i.state)).length;
  await chrome.action.setTitle({ title: pending ? `CAI – ${pending} mục trong hàng đợi` : 'CAI – Competitor Ad Intel' });
}

export const __test = { prepare, recompute, sendQueued, SOURCES };
