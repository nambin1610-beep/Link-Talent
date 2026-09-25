/** LinkedIn Ad Library. Không đọc cookie/token; nếu trang yêu cầu đăng nhập, người dùng tự đăng nhập. */
(() => {
  const CAI = window.__CAI;
  const DETAIL_RE = /\/ad-library\/detail\/(\d+)/;
  const RAN_RE = /(Ran from|Đã chạy từ|Chạy từ)/i;
  const PAID_RE = /(Paid for by|Được trả tiền bởi|Được thanh toán bởi)/i;
  const TYPE_RE = /^(Ad type|Ad format|Loại quảng cáo|Định dạng quảng cáo)\b/i;
  const NOISE_RE = /^(Promoted|Được quảng bá|Quảng cáo|View details|Xem chi tiết|Ad details|Chi tiết quảng cáo|Advertiser|Nhà quảng cáo|Follow|Theo dõi|\d+ followers?|\d+ người theo dõi)$/i;
  const countLinks = (el) => el.querySelectorAll('a[href*="/ad-library/detail/"]').length;

  function mapFormat(s, card) {
    const t = (s || '').toLowerCase();
    if (/video/.test(t) || card.querySelector('video')) return 'VIDEO';
    if (/carousel|băng chuyền/.test(t)) return 'CAROUSEL';
    if (/document|tài liệu/.test(t)) return 'DOCUMENT';
    if (/event|sự kiện/.test(t)) return 'EVENT';
    if (/message|tin nhắn|conversation/.test(t)) return 'MESSAGE';
    if (/spotlight|follower/.test(t)) return 'SPOTLIGHT';
    if (/text|văn bản/.test(t)) return 'TEXT';
    if (/image|hình/.test(t)) return 'IMAGE';
    return '';
  }

  CAI.register({
    source: 'LINKEDIN_AD_LIBRARY',
    label: 'LinkedIn Ad Library',
    matches: (loc) => /(^|\.)linkedin\.com$/.test(loc.hostname) && loc.pathname.startsWith('/ad-library'),

    findCards(doc) {
      if (DETAIL_RE.test(location.pathname)) return [doc.querySelector('main') || doc.body];
      const anchors = [...doc.querySelectorAll('a[href*="/ad-library/detail/"]')];
      return [...new Set(anchors.map((a) => CAI.containerFor(a, countLinks)))];
    },

    extract(card, ctx) {
      const detail = location.pathname.match(DETAIL_RE);
      const link = card.querySelector('a[href*="/ad-library/detail/"]');
      const id = (detail || (link && link.getAttribute('href').match(DETAIL_RE)) || [])[1] || '';
      const lines = CAI.lines(card);
      const content = lines.filter((l) => !NOISE_RE.test(l) && !RAN_RE.test(l) && !PAID_RE.test(l) && !TYPE_RE.test(l));
      const advertiser = content[0] || '';
      const cta = content.find((l) => CAI.looksLikeCta(l)) || '';
      const rest = content.slice(1).filter((l) => l !== cta);
      const body = rest.filter((l) => l.length >= 40).sort((a, b) => b.length - a.length)[0] || '';
      const headline = rest.find((l) => l !== body && l.length > 3 && l.length < 150 && !CAI.DOMAIN_RE.test(l)) || '';
      const ran = CAI.labelValue(lines, RAN_RE);
      const paid = CAI.labelValue(lines, PAID_RE).replace(PAID_RE, '').replace(/^[\s:：]+/, '');
      const typeLine = CAI.labelValue(lines, TYPE_RE);
      const media = CAI.mediaOf(card, 150).filter((m) => !/company-logo|profile-displayphoto/i.test(m.url));
      const format = mapFormat(typeLine, card) || (media.length > 1 ? 'CAROUSEL' : media.length ? 'IMAGE' : body ? 'TEXT' : 'UNKNOWN');
      const out = [...card.querySelectorAll('a[href]')].map((a) => a.href)
        .find((h) => /linkedin\.com\/redir/.test(h) || (/^https?:/.test(h) && !/linkedin\.com|licdn\.com/.test(new URL(h).hostname)));
      const advLink = card.querySelector('a[href*="/company/"]');
      const advId = advLink ? (advLink.getAttribute('href').match(/\/company\/([^/?#]+)/) || [])[1] || '' : '';
      return {
        source: this.source,
        page_url: ctx.pageUrl,
        captured_at: new Date().toISOString(),
        native_ad_id: id,
        advertiser_name: advertiser,
        advertiser_id: advId,
        paid_for_by: paid,
        platforms_raw: ['LinkedIn'],
        status_raw: '',
        start_date_raw: ran,
        end_date_raw: ran,
        body_text: body,
        headline,
        description: '',
        cta_text: cta,
        format_raw: format,
        media,
        variant_count: 1,
        ad_url: id ? `https://www.linkedin.com/ad-library/detail/${id}` : '',
        landing_url_raw: out || '',
        country_filter: new URLSearchParams(location.search).get('countries') || '',
        confidence_score: CAI.confidence({ id, advertiser, body: body || headline, date: ran, media: media.length }),
        extractor_version: 'linkedin@0.1.0'
      };
    }
  });
})();
