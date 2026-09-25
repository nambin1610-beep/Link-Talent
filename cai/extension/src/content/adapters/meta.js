/** Meta Ad Library (Facebook, Instagram, Messenger, Audience Network). */
(() => {
  const CAI = window.__CAI;
  const ID_RE = /(?:Library ID|ID thư viện|Mã thư viện)\s*[:：]?\s*(\d{6,})/i;
  const LABEL_RE = /(Library ID|ID thư viện|Mã thư viện)/i;
  const DATE_LINE_RE = /(Started running on|Bắt đầu chạy|Ran from|Đã chạy từ)/i;
  const META_LINE_RE = /^(Active|Inactive|Đang hoạt động|Không hoạt động|Library ID|ID thư viện|Platforms|Nền tảng|See ad details|See summary details|Xem chi tiết.*|Sponsored|Được tài trợ|This ad has multiple versions|Quảng cáo này có nhiều phiên bản|Open Dropdown|EU transparency|Minh bạch EU)/i;
  const count = CAI.countRegex(ID_RE);

  CAI.register({
    source: 'META_AD_LIBRARY',
    label: 'Meta Ad Library',
    matches: (loc) => /(^|\.)facebook\.com$/.test(loc.hostname) && loc.pathname.startsWith('/ads/library'),

    findCards(doc) {
      const anchors = CAI.findTextElements(doc.body, LABEL_RE).filter((el) => ID_RE.test(el.textContent));
      const cards = anchors.map((a) => CAI.containerFor(a, count));
      return [...new Set(cards)].filter((c) => count(c) === 1);
    },

    extract(card, ctx) {
      const lines = CAI.lines(card);
      const txt = lines.join('\n');
      const id = (txt.match(ID_RE) || [])[1] || '';
      const status = /(Inactive|Không hoạt động)/i.test(txt) ? 'Inactive' : /(Active|Đang hoạt động)/i.test(txt) ? 'Active' : '';
      const dateLine = lines.find((l) => DATE_LINE_RE.test(l)) || lines.find((l) => /\d{4}\s*[-–]\s*\S+/.test(l) && /\d{4}/.test(l)) || '';
      const isRange = /[-–]/.test(dateLine.replace(DATE_LINE_RE, '')) && (dateLine.match(/\d{4}/g) || []).length >= 2;
      const pageParams = new URL(ctx.pageUrl).searchParams;

      // Nền tảng: icon có aria-label/title/alt quanh nhãn "Platforms/Nền tảng"
      const platforms = [];
      card.querySelectorAll('[aria-label], [title], img[alt]').forEach((el) => {
        const v = el.getAttribute('aria-label') || el.getAttribute('title') || el.getAttribute('alt') || '';
        if (/^(facebook|instagram|messenger|audience network|threads)$/i.test(v.trim())) platforms.push(v.trim());
      });

      // Link đích + vùng link preview
      const links = [...card.querySelectorAll('a[href]')];
      const outLinks = links.filter((a) => /l\.facebook\.com\/l\.php/.test(a.href) ||
        (/^https?:/.test(a.href) && !/facebook\.com|fb\.com|instagram\.com|messenger\.com/.test(new URL(a.href).hostname)));
      const preview = outLinks.sort((a, b) => CAI.textOf(b).length - CAI.textOf(a).length)[0] || null;
      let headline = '';
      let description = '';
      let cta = '';
      if (preview) {
        const pl = CAI.lines(preview);
        const rest = [];
        for (const l of pl) {
          if (!cta && CAI.looksLikeCta(l)) cta = l;
          else if (!description && CAI.DOMAIN_RE.test(l) && l.length < 60) description = l;
          else rest.push(l);
        }
        headline = rest[0] || '';
        if (!description && rest[1]) description = rest[1];
      }
      if (!cta) {
        const btn = [...card.querySelectorAll('[role=button], button')].map((b) => CAI.textOf(b).trim())
          .find((t) => CAI.looksLikeCta(t) && !/xem chi tiết|see (ad|summary) details/i.test(t));
        cta = btn || '';
      }

      // Nội dung chính: ưu tiên khối white-space: pre-wrap (cách Meta hiển thị ad copy)
      const pre = [...card.querySelectorAll('[style*="pre-wrap"], [style*="pre-line"]')]
        .map((el) => CAI.textOf(el).trim()).filter((t) => t.length > 0);
      let body = pre.sort((a, b) => b.length - a.length)[0] || '';
      if (!body) {
        const skip = new Set([headline, description, cta, dateLine]);
        body = lines.filter((l) => !META_LINE_RE.test(l) && !skip.has(l) && !ID_RE.test(l) && l.length >= 30)
          .sort((a, b) => b.length - a.length)[0] || '';
      }
      const bodyTruncated = /(…|\.\.\.)\s*(See more|Xem thêm)?\s*$/i.test(body) || /\b(See more|Xem thêm)\b/.test(body);
      body = body.replace(/\s*(…|\.\.\.)?\s*(See more|Xem thêm)\s*$/i, '');

      // Nhà quảng cáo: link tới trang Facebook đầu tiên có chữ
      const advLink = links.find((a) => {
        try {
          const u = new URL(a.href);
          return /facebook\.com$/.test(u.hostname) && !/^\/(ads|l\.php)/.test(u.pathname) && CAI.textOf(a).trim().length > 1;
        } catch { return false; }
      });
      let advertiser = advLink ? CAI.textOf(advLink).trim() : '';
      if (!advertiser) {
        const i = lines.findIndex((l) => /^(Sponsored|Được tài trợ)$/i.test(l));
        if (i > 0) advertiser = lines[i - 1];
      }

      const media = CAI.mediaOf(card);
      const format = card.querySelector('video') ? 'VIDEO'
        : media.filter((m) => m.type === 'image').length >= 2 ? 'CAROUSEL'
          : /(multiple versions|nhiều phiên bản)/i.test(txt) ? 'DYNAMIC'
            : media.length ? 'IMAGE' : 'UNKNOWN';
      const variant = (txt.match(/(\d+)\s+(?:ads? use|quảng cáo (?:sử dụng|dùng))/i) || [])[1];

      return {
        source: this.source,
        page_url: ctx.pageUrl,
        captured_at: new Date().toISOString(),
        native_ad_id: id,
        advertiser_name: advertiser,
        advertiser_id: pageParams.get('view_all_page_id') || '',
        platforms_raw: [...new Set(platforms)],
        status_raw: status,
        start_date_raw: dateLine,
        end_date_raw: isRange ? dateLine : '',
        body_text: body,
        body_truncated: bodyTruncated,
        headline,
        description,
        cta_text: cta,
        format_raw: format,
        media,
        variant_count: variant ? Number(variant) : 1,
        ad_url: id ? `https://www.facebook.com/ads/library/?id=${id}` : '',
        landing_url_raw: preview ? preview.href : '',
        country_filter: pageParams.get('country') || '',
        confidence_score: CAI.confidence({ id, advertiser, body: body || headline, date: dateLine, media: media.length }),
        extractor_version: 'meta@0.1.0'
      };
    }
  });
})();
