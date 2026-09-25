/** Lưu trữ trong chrome.storage.local (không dùng sync để secret không lan sang máy khác). */

const K = { settings: 'cai_settings', queue: 'cai_queue', index: 'cai_index', config: 'cai_config', sync: 'cai_sync', ctx: 'cai_context', history: 'cai_history' };

async function get(key, dflt) {
  const r = await chrome.storage.local.get(key);
  return r[key] ?? dflt;
}

async function set(key, value) {
  await chrome.storage.local.set({ [key]: value });
}

export const Settings = {
  get: () => get(K.settings, { endpoint: '', userId: '', secret: '', collector: '', market: 'VN', visibleLimit: 100 }),
  set: (v) => set(K.settings, v)
};

export const Context = {
  get: () => get(K.ctx, { competitor_id: '', market: 'VN', product: '', campaign_label: '', audience_side: 'AUTO', tags: [], notes: '', rating: '' }),
  set: (v) => set(K.ctx, v)
};

export const ConfigCache = {
  get: () => get(K.config, null),
  set: (v) => set(K.config, { ...v, fetched_at: new Date().toISOString() })
};

export const IndexCache = {
  async all() { return get(K.index, {}); },
  async lookup(uid) { return (await get(K.index, {}))[uid] || null; },
  async replace(map) { await set(K.index, map); },
  async merge(entries) {
    const idx = await get(K.index, {});
    for (const [uid, v] of Object.entries(entries)) idx[uid] = { ...(idx[uid] || {}), ...v };
    await set(K.index, idx);
  }
};

/** Hàng đợi: map client_id → item. Thao tác tuần tự để tránh ghi đè lẫn nhau. */
let chain = Promise.resolve();
function serial(fn) {
  const p = chain.then(fn, fn);
  chain = p.catch(() => {});
  return p;
}

export const Queue = {
  list: async () => Object.values(await get(K.queue, {})).sort((a, b) => (a.added_at < b.added_at ? 1 : -1)),
  addMany: (items) => serial(async () => {
    const q = await get(K.queue, {});
    for (const it of items) {
      const dup = Object.values(q).find((x) => x.kind === it.kind && x.ad_uid && x.ad_uid === it.ad_uid);
      if (dup) delete q[dup.client_id];
      q[it.client_id] = it;
    }
    await set(K.queue, q);
  }),
  patch: (id, patch) => serial(async () => {
    const q = await get(K.queue, {});
    if (q[id]) q[id] = { ...q[id], ...patch };
    await set(K.queue, q);
    return q[id];
  }),
  remove: (ids) => serial(async () => {
    const q = await get(K.queue, {});
    for (const id of ids) delete q[id];
    await set(K.queue, q);
  }),
  getMany: async (ids) => {
    const q = await get(K.queue, {});
    return ids.map((id) => q[id]).filter(Boolean);
  }
};

export const SyncState = {
  get: () => get(K.sync, { status: 'UNCONFIGURED', message: '', at: '' }),
  set: (v) => set(K.sync, { ...v, at: new Date().toISOString() })
};

export const History = {
  list: () => get(K.history, []),
  add: async (entry) => {
    const h = await get(K.history, []);
    h.unshift({ ...entry, at: new Date().toISOString() });
    await set(K.history, h.slice(0, 30));
  }
};

export const STORAGE_KEYS = K;
