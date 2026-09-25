/** Google Ads Transparency Center (Search, YouTube, Display, Play, Maps, Shopping). */
(() => {
  const CAI = window.__CAI;
  const LINK_RE = /\/advertiser\/(AR\d+)\/creative\/(CR\d+)/;
  const LAST_RE = /(Last shown|Hiển thị lần cuối|Lần hiển thị cuối|Lần cuối hiển thị|Hiển thị gần đây nhất)/i;
  const FIRST_RE = /(First shown|Hiển thị lần đầu|Lần hiển thị đầu|Lần đầu hiển thị)/i;
  const FORMAT_RE = /^(Format|Định dạng)\b/i;
  const PAID_RE = /(Paid for by|Được thanh toán bởi|Người thanh toán|Bên thanh toán)/i;
  const NOISE_RE = /^(Verified|Đã xác minh|Ad|Quảng cáo|Ads|See all ads|Xem tất cả|Show more|Hiển thị thêm|Report this ad|Báo cáo quảng cáo này|More info|Thông tin khác)$/i;
  const countLinks = (el) => el.querySelectorAll('a[href*="/creative/CR"]').length;

  function mapFormat(s) {
    if (/video/i.test(s)) return 'VIDEO';
    if (/image|hình ảnh|hình/i.test(s)) return 'IMAGE';
    if (/text|văn bản/i.test(s)) return 'TEXT';
    return '';
  }

  function iframeText(card) {
    const out = [];
    card.querySelectorAll('iframe').forEach((f) => {
      try {
        const d = f.contentDocument; // chỉ đọc được nếu cùng origin — KHÔNG vượt same-origin
        if (d && d.body) out.push(CAI.textOf(d.body).trim());
      } catch { /* khác origin: để người dùng dán tay */ }
    });
    return out.filter(Boolean).join('\n');
  }

  CAI.register({
    source: 'GOOGLE_ATC',
    label: 'Google Ads Transparency',
    matches: (loc) => loc.hostname === 'adstransparency.google.com',

    findCards(doc) {
      const m = location.pathname.match(LINK_RE);
      if (m) return [doc.querySelector('main') || doc.body];
      const anchors = [...doc.querySelectorAll('a[href*="/creative/CR"]')];
      const cards = anchors.map((a) => CAI.containerFor(a, countLinks));
      return [...new Set(cards)];
    },

    extract(card, ctx) {
      const detail = location.pathname.match(LINK_RE);
      const link = detail ? null : card.querySelector('a[href*="/creative/CR"]');
      const m = detail || (link && link.getAttribute('href').match(LINK_RE)) || [];
      const ar = m[1] || '';
      const cr = m[2] || '';
      const lines = CAI.lines(card);
      const header = document.querySelector('h1, [role=heading][aria-level="1"]');
      const headerName = header ? CAI.textOf(header).trim() : '';
      const advertiser = lines.find((l) => !NOISE_RE.test(l) && !LAST_RE.test(l) && !FIRST_RE.test(l) && !CAI.DOMAIN_RE.test(l) && l.length > 1 && l.length < 120) || headerName;
      const lastLine = CAI.labelValue(lines, LAST_RE);
      const firstLine = CAI.labelValue(lines, FIRST_RE);
      const formatLine = CAI.labelValue(lines, FORMAT_RE);
      const paid = CAI.labelValue(lines, PAID_RE).replace(PAID_RE, '').replace(/^[\s:：]+/, '');
      const domainLine = lines.find((l) => CAI.DOMAIN_RE.test(l) && l.length < 80) || '';
      const frameText = iframeText(card);
      const media = CAI.mediaOf(card, 120);
      const yt = [...card.querySelectorAll('a[href*="youtube.com/watch"], a[href*="youtu.be/"]')].map((a) => ({ type: 'video', url: a.href }));
      const format = mapFormat(formatLine) || (yt.length || card.querySelector('video') ? 'VIDEO' : frameText ? 'TEXT' : media.length ? 'IMAGE' : 'UNKNOWN');
      const fl = frameText.split('\n').map((s) => s.trim()).filter(Boolean);
      const params = new URLSearchParams(location.search);
      return {
        source: this.source,
        page_url: ctx.pageUrl,
        captured_at: new Date().toISOString(),
        native_ad_id: ar && cr ? `${ar}/${cr}` : '',
        advertiser_name: advertiser,
        advertiser_id: ar,
        paid_for_by: paid,
        platforms_raw: params.get('platform') ? [params.get('platform')] : [],
        status_raw: '',
        start_date_raw: firstLine,
        end_date_raw: lastLine,
        body_text: fl.slice(1).join(' ').slice(0, 5000),
        headline: fl[0] || '',
        description: domainLine,
        cta_text: '',
        format_raw: format,
        media: yt.concat(media),
        variant_count: 1,
        ad_url: ar && cr ? `https://adstransparency.google.com/advertiser/${ar}/creative/${cr}?region=${params.get('region') || ''}` : '',
        landing_url_raw: domainLine ? (/^https?:/.test(domainLine) ? domainLine : 'https://' + domainLine) : '',
        landing_is_display_url: !!domainLine,
        country_filter: params.get('region') || '',
        needs_manual_text: !frameText,
        confidence_score: CAI.confidence({ id: cr, advertiser, body: frameText, date: lastLine, media: media.length || yt.length }),
        extractor_version: 'gatc@0.1.0'
      };
    }
  });
})();
