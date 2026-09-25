/**
 * Hàm được inject vào tab landing page qua chrome.scripting.executeScript({ func }).
 * PHẢI tự chứa (không dùng biến ngoài) vì Chrome tuần tự hóa mã nguồn hàm.
 * Chỉ đọc DOM: không đọc giá trị input, không submit form, không click.
 */
export function landingExtract() {
  const text = (el) => (el ? (el.innerText || el.textContent || '').replace(/\s+/g, ' ').trim() : '');
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none';
  };
  const meta = (sel) => document.querySelector(sel)?.getAttribute('content') || '';
  const h1El = [...document.querySelectorAll('h1')].find(visible) || document.querySelector('h1');
  const bodyText = text(document.body).slice(0, 20000);

  const buttons = [...document.querySelectorAll('a, button, [role=button], input[type=submit]')]
    .filter(visible)
    .map((el) => ({ el, t: (el.value || text(el)).slice(0, 60), top: el.getBoundingClientRect().top + scrollY }))
    .filter((b) => b.t && b.t.split(' ').length <= 6);
  const ctaRe = /(đăng ký|liên hệ|tư vấn|nhận|gửi|đặt lịch|báo giá|dùng thử|tải|bắt đầu|tìm hiểu|contact|sign up|get|book|request|start|download|try|apply|submit)/i;
  const ctas = buttons.filter((b) => ctaRe.test(b.t));
  const counts = {};
  ctas.forEach((b) => { counts[b.t] = (counts[b.t] || 0) + 1; });
  const hero = ctas.filter((b) => b.top < innerHeight * 1.2).sort((a, b) => a.top - b.top);
  const primary = (hero[0] || ctas.sort((a, b) => counts[b.t] - counts[a.t])[0] || {}).t || '';
  const secondary = [...new Set(ctas.map((b) => b.t))].filter((t) => t !== primary).slice(0, 8);

  const offerRe = /[^.!?\n]{0,80}(miễn phí|free|dùng thử|trial|giảm|ưu đãi|tặng|voucher|khuyến mãi|bảo hành|hoàn phí|guarantee|\d+\s*(ngày|days))[^.!?\n]{0,80}/i;
  const headingText = [...document.querySelectorAll('h1,h2,h3,[class*=banner],[class*=hero]')].filter(visible).map(text).join(' . ');
  const offer = ((headingText.match(offerRe) || bodyText.match(offerRe) || [''])[0] || '').trim().slice(0, 200);

  const proof = [];
  const proofRe = /\d[\d.,]*\+?\s*(doanh nghiệp|khách hàng|nhà tuyển dụng|ứng viên|vị trí|đối tác|năm kinh nghiệm|companies|clients|customers|placements|candidates|years)/gi;
  let m;
  while ((m = proofRe.exec(bodyText)) && proof.length < 5) proof.push(m[0]);
  const testimonials = document.querySelectorAll('[class*=testimonial],[class*=review],[class*=feedback],blockquote').length;
  if (testimonials) proof.push(testimonials + ' testimonial/review');
  const imgs = [...document.querySelectorAll('img')].filter(visible);
  const rows = {};
  imgs.forEach((i) => {
    const r = i.getBoundingClientRect();
    if (r.height >= 20 && r.height <= 120) {
      const k = Math.round((r.top + scrollY) / 10);
      rows[k] = (rows[k] || 0) + 1;
    }
  });
  const logoRow = Math.max(0, ...Object.values(rows));
  if (logoRow >= 4) proof.push('dãy ' + logoRow + ' logo');

  const forms = [...document.querySelectorAll('form')].filter(visible);
  const labelOf = (inp) => {
    if (inp.id) {
      const l = document.querySelector(`label[for="${CSS.escape(inp.id)}"]`);
      if (l) return text(l);
    }
    return inp.getAttribute('placeholder') || inp.getAttribute('aria-label') || inp.getAttribute('name') || '';
  };
  const formFields = forms.flatMap((f) => [...f.querySelectorAll('input:not([type=hidden]):not([type=submit]), select, textarea')]
    .filter(visible).map(labelOf).filter(Boolean)).slice(0, 20);

  const priceRe = /\d[\d.,]*\s*(₫|vnđ|vnd|đ\/|triệu|usd|\$)|\$\s?\d[\d.,]*|\d+\s?%\s?(lương|salary)/gi;
  const prices = [...new Set((bodyText.match(priceRe) || []).map((s) => s.trim()))].slice(0, 10);
  const pricingVisible = prices.length > 0 && /(gói|plan|bảng giá|pricing|phí|fee)/i.test(bodyText);

  const section = (sel) => [...document.querySelectorAll(sel)].filter(visible).map(text).join(' | ').slice(0, 4000);
  const sections = {
    hero: [text(h1El), hero.map((b) => b.t).join(' ')].join(' | '),
    offer,
    cta: [primary].concat(secondary).join(' | '),
    proof: proof.join(' | '),
    form: formFields.join(' | '),
    pricing: prices.join(' | '),
    headings: section('h1,h2,h3')
  };

  return {
    url: location.href,
    final_url: location.href,
    page_title: document.title,
    meta_description: meta('meta[name="description"]'),
    og_title: meta('meta[property="og:title"]'),
    canonical: document.querySelector('link[rel=canonical]')?.href || '',
    h1: text(h1El).slice(0, 300),
    offer,
    primary_cta: primary,
    secondary_ctas: secondary,
    social_proof: proof.join('; '),
    form_present: forms.length > 0,
    form_fields: formFields,
    pricing_visible: pricingVisible,
    price_points: prices,
    sections,
    main_text: bodyText.slice(0, 8000),
    is_error_page: /404|not found|không tìm thấy trang/i.test(document.title),
    captured_at: new Date().toISOString()
  };
}
