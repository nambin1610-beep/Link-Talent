/**
 * Tiện ích dùng chung cho content script (classic script, chia sẻ qua window.__CAI trong isolated world).
 * Nguyên tắc: CHỈ đọc DOM đang hiển thị. Không cuộn, không click, không gọi API ẩn của nền tảng.
 */
(() => {
  if (window.__CAI) return;
  const CAI = (window.__CAI = { adapters: [], version: '0.1.0' });

  const BLOCK = /^(ADDRESS|ARTICLE|ASIDE|BLOCKQUOTE|DIV|DL|DT|DD|FIELDSET|FIGCAPTION|FIGURE|FOOTER|FORM|H[1-6]|HEADER|HR|LI|MAIN|NAV|OL|P|PRE|SECTION|TABLE|TR|UL|BR)$/;

  /** innerText nếu trình duyệt hỗ trợ; nếu không (jsdom), tự chèn xuống dòng theo phần tử block. */
  CAI.textOf = (el) => {
    if (!el) return '';
    if (typeof el.innerText === 'string') return el.innerText;
    let out = '';
    const walk = (n) => {
      if (n.nodeType === 3) { out += n.nodeValue; return; }
      if (n.nodeType !== 1 || /^(SCRIPT|STYLE|NOSCRIPT)$/.test(n.tagName)) return;
      const block = BLOCK.test(n.tagName);
      if (block) out += '\n';
      n.childNodes.forEach(walk);
      if (block) out += '\n';
    };
    walk(el);
    return out;
  };

  CAI.lines = (el) => CAI.textOf(el).split('\n').map((s) => s.replace(/\s+/g, ' ').trim()).filter(Boolean);

  CAI.uid = () => 'c_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

  /** Leo lên tổ tiên lớn nhất vẫn chỉ chứa đúng MỘT anchor (= container của một card). */
  CAI.containerFor = (anchor, countIn) => {
    let el = anchor;
    while (el.parentElement && el.parentElement !== document.body && countIn(el.parentElement) === 1) el = el.parentElement;
    return el;
  };

  CAI.countRegex = (re) => (el) => {
    const g = new RegExp(re.source, re.flags.includes('g') ? re.flags : re.flags + 'g');
    return (el.textContent.match(g) || []).length;
  };

  /** Các text node khớp regex → phần tử cha gần nhất. */
  CAI.findTextElements = (root, re) => {
    const out = [];
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
    let n;
    while ((n = walker.nextNode())) {
      if (re.test(n.nodeValue)) out.push(n.parentElement);
      else if (n.parentElement && re.test(n.parentElement.textContent) && n.parentElement.children.length <= 3 &&
        n.parentElement.textContent.length < 120) out.push(n.parentElement);
    }
    return [...new Set(out)];
  };

  /** Giá trị sau một nhãn: trên cùng dòng (nếu có số) hoặc dòng kế tiếp. */
  CAI.labelValue = (lines, re) => {
    for (let i = 0; i < lines.length; i++) {
      if (re.test(lines[i])) {
        const rest = lines[i].replace(re, '').replace(/^[\s:：]+/, '');
        if (rest && /\d|\w{3,}/.test(rest)) return lines[i];
        return (lines[i] + ' ' + (lines[i + 1] || '')).trim();
      }
    }
    return '';
  };

  CAI.CTA_RE = /^(đặt lịch|book|request|dùng thử|try|báo giá|get quote|đăng ký|sign ?up|register|subscribe|tải|download|liên hệ|contact|tư vấn|gửi|ứng tuyển|apply|nộp|nhắn tin|gửi tin nhắn|send message|message|gọi|call|mua|shop|tìm hiểu|xem thêm|learn more|khám phá|visit|truy cập|see more)/i;
  CAI.looksLikeCta = (s) => !!s && s.length <= 30 && CAI.CTA_RE.test(s.trim());
  CAI.DOMAIN_RE = /^(?:https?:\/\/)?(?:www\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)*\.[a-z]{2,}(?:\/\S*)?$/i;

  CAI.imgSize = (img) => Math.max(img.naturalWidth || 0, Number(img.getAttribute('width')) || 0, img.getBoundingClientRect ? img.getBoundingClientRect().width : 0);

  /** Ảnh/video của creative (loại avatar, icon, emoji). */
  CAI.mediaOf = (card, minWidth = 200) => {
    const media = [];
    card.querySelectorAll('video').forEach((v) => {
      const src = v.currentSrc || v.getAttribute('src') || '';
      media.push({ type: 'video', url: /^https?:/.test(src) ? src : '', poster: v.getAttribute('poster') || '' });
    });
    card.querySelectorAll('img').forEach((img) => {
      const src = img.currentSrc || img.getAttribute('src') || '';
      if (!/^https?:/.test(src)) return;
      if (/(s\d{2}x\d{2}|p\d{2}x\d{2}|\/emoji|static\.xx\.fbcdn|rsrc\.php|profile|avatar|logo_small)/i.test(src)) return;
      const size = CAI.imgSize(img);
      if (size && size < minWidth) return;
      media.push({ type: 'image', url: src });
    });
    const seen = new Set();
    return media.filter((m) => {
      const k = m.url || m.poster;
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    }).slice(0, 10);
  };

  CAI.confidence = (parts) => {
    const w = { id: 0.3, advertiser: 0.2, body: 0.2, date: 0.15, media: 0.15 };
    let s = 0;
    for (const k of Object.keys(w)) if (parts[k]) s += w[k];
    return Math.round(s * 100) / 100;
  };

  /** Trang bị chặn / yêu cầu đăng nhập / CAPTCHA → dừng, không thao tác. */
  CAI.isBlocked = () => {
    const url = location.href;
    if (/\/(login|checkpoint|authwall|uas\/login|sorry\/index)/i.test(url)) return 'LOGIN_OR_CHECKPOINT';
    if (document.querySelector('iframe[src*="recaptcha"], iframe[src*="captcha"], #captcha, [id*="captcha" i]')) return 'CAPTCHA';
    const head = (document.body ? document.body.textContent : '').slice(0, 3000);
    if (/(temporarily blocked|tạm thời bị chặn|unusual traffic|lưu lượng truy cập bất thường|too many requests|quá nhiều yêu cầu)/i.test(head)) return 'RATE_LIMITED';
    return '';
  };

  CAI.register = (adapter) => CAI.adapters.push(adapter);
})();
