/**
 * Overlay trong Shadow DOM: nút chọn trên từng card + thanh nổi. Chỉ thêm MỘT phần tử gốc vào trang,
 * không sửa DOM của nền tảng. Vị trí nút cập nhật theo scroll/resize.
 */
(() => {
  const CAI = window.__CAI;
  const COLORS = { NEW: '#1a7f37', KNOWN: '#0969da', CHANGED: '#bc4c00', LOW: '#8250df', PENDING: '#6e7781' };
  const LABELS = { NEW: 'Mới', KNOWN: 'Đã có', CHANGED: 'Đã đổi', LOW: 'Cần kiểm tra', PENDING: '…' };

  class Overlay {
    constructor({ onAddToQueue }) {
      this.items = new Map(); // card element → { btn, state, id }
      this.selected = new Set();
      this.hidden = false;
      this.onAddToQueue = onAddToQueue;
      this.host = document.createElement('div');
      this.host.setAttribute('data-cai-overlay', '');
      this.host.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:2147483646;';
      this.root = this.host.attachShadow({ mode: 'closed' });
      this.root.innerHTML = `
        <style>
          .b{position:fixed;pointer-events:auto;min-width:28px;height:28px;padding:0 8px;border-radius:14px;border:2px solid #fff;
             color:#fff;font:600 12px/24px system-ui,sans-serif;cursor:pointer;box-shadow:0 1px 4px rgba(0,0,0,.35);display:flex;gap:4px;align-items:center}
          .b[aria-pressed=true]{outline:3px solid #ffd33d}
          .b .box{width:12px;height:12px;border:2px solid #fff;border-radius:3px;display:inline-block}
          .b[aria-pressed=true] .box{background:#fff}
          .bar{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);pointer-events:auto;background:#1f2328;color:#fff;
             border-radius:10px;padding:8px 12px;font:14px system-ui,sans-serif;display:none;gap:8px;align-items:center;box-shadow:0 4px 16px rgba(0,0,0,.3)}
          .bar button{font:inherit;border:0;border-radius:6px;padding:6px 10px;cursor:pointer}
          .bar .p{background:#2da44e;color:#fff}.bar .s{background:#424a53;color:#fff}
          .toast{position:fixed;right:16px;bottom:16px;background:#1f2328;color:#fff;padding:10px 14px;border-radius:8px;font:13px system-ui;pointer-events:none;display:none;max-width:360px}
        </style>
        <div class="bar" role="toolbar" aria-label="CAI">
          <span class="count">0 đã chọn</span>
          <button class="p add">Thêm vào hàng đợi</button>
          <button class="s clear">Bỏ chọn</button>
          <button class="s hide">Ẩn overlay</button>
        </div>
        <div class="toast" role="status"></div>`;
      this.bar = this.root.querySelector('.bar');
      this.root.querySelector('.add').addEventListener('click', () => this.onAddToQueue([...this.selected]));
      this.root.querySelector('.clear').addEventListener('click', () => this.clearSelection());
      this.root.querySelector('.hide').addEventListener('click', () => this.setHidden(true));
      (document.body || document.documentElement).appendChild(this.host);
      const reflow = () => { if (!this.raf) this.raf = requestAnimationFrame(() => { this.raf = 0; this.layout(); }); };
      addEventListener('scroll', reflow, { passive: true, capture: true });
      addEventListener('resize', reflow, { passive: true });
      this.reflow = reflow;
    }

    attach(card, id, state) {
      let it = this.items.get(card);
      if (!it) {
        const btn = document.createElement('button');
        btn.className = 'b';
        btn.setAttribute('aria-pressed', 'false');
        btn.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); this.toggle(card); });
        this.root.appendChild(btn);
        it = { btn, id, state };
        this.items.set(card, it);
      }
      it.id = id;
      this.setState(card, state);
      this.reflow();
    }

    setState(card, state) {
      const it = this.items.get(card);
      if (!it) return;
      it.state = state;
      it.btn.style.background = COLORS[state] || COLORS.PENDING;
      it.btn.innerHTML = `<span class="box"></span>${LABELS[state] || ''}`;
      it.btn.title = `CAI · ${LABELS[state] || ''} · bấm để chọn`;
      it.btn.setAttribute('aria-label', `Chọn quảng cáo (${LABELS[state] || ''})`);
    }

    toggle(card) {
      const it = this.items.get(card);
      if (!it) return;
      if (this.selected.has(it.id)) this.selected.delete(it.id); else this.selected.add(it.id);
      it.btn.setAttribute('aria-pressed', String(this.selected.has(it.id)));
      this.updateBar();
    }

    clearSelection() {
      this.selected.clear();
      this.items.forEach((it) => it.btn.setAttribute('aria-pressed', 'false'));
      this.updateBar();
    }

    updateBar() {
      this.root.querySelector('.count').textContent = `${this.selected.size} đã chọn`;
      this.bar.style.display = this.selected.size && !this.hidden ? 'flex' : 'none';
    }

    setHidden(h) {
      this.hidden = h;
      this.host.style.display = h ? 'none' : '';
      this.updateBar();
    }

    layout() {
      for (const [card, it] of this.items) {
        if (!card.isConnected) { it.btn.remove(); this.items.delete(card); this.selected.delete(it.id); continue; }
        const r = card.getBoundingClientRect();
        const visible = r.bottom > 0 && r.top < innerHeight && r.width > 0;
        it.btn.style.display = visible ? 'flex' : 'none';
        if (visible) {
          it.btn.style.top = Math.max(4, r.top + 6) + 'px';
          it.btn.style.left = Math.min(innerWidth - 110, r.right - 100) + 'px';
        }
      }
      this.updateBar();
    }

    toast(msg, ms = 3500) {
      const t = this.root.querySelector('.toast');
      t.textContent = msg;
      t.style.display = 'block';
      clearTimeout(this.tt);
      this.tt = setTimeout(() => { t.style.display = 'none'; }, ms);
    }

    hovered() {
      for (const [card, it] of this.items) if (card.matches(':hover')) return card;
      return null;
    }
  }

  CAI.Overlay = Overlay;
})();
