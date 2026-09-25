/** Điều phối content script: phát hiện nguồn → quét card → overlay → trao đổi với Service Worker. */
(() => {
  const CAI = window.__CAI;
  if (!CAI || CAI.booted) return;
  const adapter = CAI.adapters.find((a) => a.matches(location));
  if (!adapter) return;
  CAI.booted = true;

  const captures = new Map(); // client_id → capture
  const cardOf = new Map(); // client_id → element
  const idOf = new WeakMap(); // element → client_id
  let blocked = '';
  let overlay = null;

  const send = (msg) => new Promise((resolve) => {
    try {
      chrome.runtime.sendMessage(msg, (res) => resolve(chrome.runtime.lastError ? null : res));
    } catch {
      resolve(null); // extension vừa reload: bỏ qua
    }
  });

  async function addToQueue(ids) {
    const caps = ids.map((id) => captures.get(id)).filter(Boolean);
    if (!caps.length) return;
    const res = await send({ type: 'ENQUEUE', captures: caps });
    if (res && res.ok) {
      overlay.toast(`Đã thêm ${res.queued} quảng cáo vào hàng đợi (${res.incomplete} cần bổ sung). Mở Side Panel để kiểm tra & gửi.`);
      overlay.clearSelection();
    } else {
      overlay.toast('Không thêm được: ' + ((res && res.error) || 'Extension chưa sẵn sàng'));
    }
  }

  function report() {
    send({ type: 'PAGE_STATS', source: adapter.source, found: captures.size, blocked });
  }

  async function scan() {
    blocked = CAI.isBlocked();
    if (blocked) { report(); return; } // KHÔNG retry, KHÔNG thao tác trang
    if (adapter.noCards) { report(); return; }
    if (!overlay) overlay = new CAI.Overlay({ onAddToQueue: addToQueue });
    const fresh = [];
    for (const card of adapter.findCards(document)) {
      let id = idOf.get(card);
      let cap;
      try {
        cap = adapter.extract(card, { pageUrl: location.href });
      } catch (e) {
        send({ type: 'CLIENT_ERROR', source: adapter.source, message: String(e && e.message || e) });
        continue;
      }
      if (!id) {
        id = CAI.uid();
        idOf.set(card, id);
        fresh.push(id);
      } else if (JSON.stringify({ ...captures.get(id), captured_at: '' }) !== JSON.stringify({ ...cap, captured_at: '' })) {
        fresh.push(id); // nội dung card thay đổi (ví dụ ảnh vừa tải xong)
      }
      cap.client_id = id;
      captures.set(id, cap);
      cardOf.set(id, card);
      overlay.attach(card, id, (cap.confidence_score ?? 1) < 0.6 ? 'LOW' : 'PENDING');
    }
    for (const [id, card] of cardOf) if (!card.isConnected) { cardOf.delete(id); captures.delete(id); }
    if (fresh.length) {
      const res = await send({ type: 'LOOKUP', captures: fresh.map((id) => captures.get(id)) });
      if (res && res.statuses) {
        for (const [id, st] of Object.entries(res.statuses)) {
          const card = cardOf.get(id);
          const cap = captures.get(id);
          if (card) overlay.setState(card, (cap?.confidence_score ?? 1) < 0.6 ? 'LOW' : st);
        }
      }
    }
    report();
  }

  let timer = 0;
  const schedule = () => { clearTimeout(timer); timer = setTimeout(scan, 600); };
  new MutationObserver((muts) => {
    if (muts.every((m) => m.target === overlay?.host)) return;
    schedule();
  }).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
  schedule();

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    switch (msg.type) {
      case 'GET_STATE':
        reply({
          source: adapter.source, label: adapter.label, found: captures.size, blocked,
          selected: overlay ? overlay.selected.size : 0,
          states: overlay ? [...overlay.items.values()].reduce((m, it) => ((m[it.state] = (m[it.state] || 0) + 1), m), {}) : {},
          pageMeta: adapter.pageMeta ? adapter.pageMeta() : null
        });
        break;
      case 'GET_SELECTED':
        reply({ captures: overlay ? [...overlay.selected].map((id) => captures.get(id)).filter(Boolean) : [] });
        break;
      case 'GET_ALL_VISIBLE':
        reply({ captures: [...captures.values()].slice(0, msg.limit || 100), total: captures.size });
        break;
      case 'CLEAR_SELECTION':
        overlay?.clearSelection();
        reply({ ok: true });
        break;
      case 'TOGGLE_HOVERED': {
        const card = overlay?.hovered();
        if (card) overlay.toggle(card);
        reply({ ok: !!card });
        break;
      }
      case 'SHOW_OVERLAY':
        overlay?.setHidden(false);
        reply({ ok: true });
        break;
      case 'RESCAN':
        scan().then(() => reply({ ok: true, found: captures.size }));
        return true;
      case 'MARK':
        for (const [id, st] of Object.entries(msg.statuses || {})) {
          const card = cardOf.get(id);
          if (card) overlay?.setState(card, st);
        }
        reply({ ok: true });
        break;
      default:
        return false;
    }
    return false;
  });
})();
