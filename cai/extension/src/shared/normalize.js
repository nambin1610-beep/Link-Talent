/**
 * Chuẩn hóa dữ liệu thô từ content script thành bản ghi gửi Apps Script.
 * Hàm thuần — test bằng Node (tests/normalize.test.mjs).
 */
import { SRC_PREFIX } from './constants.js';
import { sha256Hex } from './crypto.js';

const TRACKING_PARAMS = /^(fbclid|gclid|gbraid|wbraid|msclkid|dclid|yclid|igshid|mc_eid|mc_cid|_hsenc|_hsmi|__hstc|__hssc|__hsfp|ref_src|trk|trackingid|li_fat_id)$/i;

const MONTHS = { jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12 };

export function normalizeText(s) {
  return String(s ?? '')
    .normalize('NFC')
    .replace(/[​-‍﻿]/g, '')
    .replace(/[ \t ]+/g, ' ')
    .replace(/\s*\n\s*/g, '\n')
    .trim();
}

/** Bản dùng để hash: bỏ emoji/ký tự trang trí, URL, gộp số, lowercase. */
export function normalizeForHash(s) {
  return normalizeText(s)
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, ' ')
    .replace(/[\p{Extended_Pictographic}☀-➿️]/gu, ' ')
    .replace(/(\d)[.,](?=\d{3}\b)/g, '$1')
    .replace(/[^\p{L}\p{N}%$₫]+/gu, ' ')
    .trim();
}

function removeDiacritics(s) {
  return String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

export function slug(s) {
  return removeDiacritics(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

export function registrableDomain(host) {
  host = String(host ?? '').toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
  const parts = host.split('.');
  if (parts.length <= 2) return host;
  const sld2 = parts.slice(-2).join('.');
  if (/^(com|net|org|edu|gov|ac|co|biz|info|int|pro|name|health)\.(vn|sg|th|id|my|ph|uk|au|jp|kr)$/.test(sld2)) {
    return parts.slice(-3).join('.');
  }
  return sld2;
}

/** Gỡ lớp chuyển hướng của Facebook/LinkedIn/Google để lấy URL đích. */
export function unwrapRedirect(href) {
  if (!href) return '';
  try {
    const u = new URL(href);
    const host = u.hostname.replace(/^www\./, '');
    if ((host === 'l.facebook.com' || host === 'lm.facebook.com') && u.searchParams.get('u')) return u.searchParams.get('u');
    if (host.endsWith('linkedin.com') && u.pathname.startsWith('/redir') && u.searchParams.get('url')) return u.searchParams.get('url');
    if (host.endsWith('google.com') && u.pathname === '/url' && (u.searchParams.get('q') || u.searchParams.get('url'))) {
      return u.searchParams.get('q') || u.searchParams.get('url');
    }
    return href;
  } catch {
    return href;
  }
}

/** URL sạch (bỏ tracking cá nhân), domain, UTM, key = host+path. */
export function normalizeLanding(raw) {
  let u;
  try {
    u = new URL(String(raw ?? '').trim());
  } catch {
    return { url: String(raw ?? ''), domain: '', utm: {}, key: '' };
  }
  const utm = {};
  const keep = [];
  for (const [k, v] of u.searchParams) {
    if (/^utm_/i.test(k)) utm[k.toLowerCase()] = v;
    else if (!TRACKING_PARAMS.test(k)) keep.push([k, v]);
  }
  keep.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
  const host = u.hostname.toLowerCase().replace(/^www\./, '');
  const path = u.pathname.length > 1 ? u.pathname.replace(/\/+$/, '') : '';
  const q = keep.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  return {
    url: `${u.protocol}//${host}${path}${q ? '?' + q : ''}`,
    domain: registrableDomain(host),
    utm,
    key: host + (path || '/')
  };
}

function iso(y, m, d) {
  if (!(y > 1990 && y < 2100 && m >= 1 && m <= 12 && d >= 1 && d <= 31)) return '';
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCDate() !== d) return '';
  return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

const DATE_PATTERNS = [
  // 2026-09-02
  { re: /\b(\d{4})-(\d{1,2})-(\d{1,2})\b/g, f: (m) => iso(+m[1], +m[2], +m[3]) },
  // Sep 2, 2026 | September 2 2026
  { re: /\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})\b/gi, f: (m) => iso(+m[3], MONTHS[m[1].toLowerCase()], +m[2]) },
  // 2 Sep 2026 | 2 September, 2026
  { re: /\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\.?,?\s+(\d{4})\b/gi, f: (m) => iso(+m[3], MONTHS[m[2].toLowerCase()], +m[1]) },
  // 2 thg 9, 2026 | 2 tháng 9 năm 2026 | ngày 2 tháng 9, 2026 | 02 Th09 2026
  { re: /(\d{1,2})\s*(?:thg|tháng|th)\.?\s*(\d{1,2}),?\s*(?:năm\s*)?(\d{4})/gi, f: (m) => iso(+m[3], +m[2], +m[1]) },
  // 02/09/2026 (dd/MM/yyyy — chuẩn VN)
  { re: /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/g, f: (m) => iso(+m[3], +m[2], +m[1]) }
];

/** Tìm mọi ngày trong chuỗi, theo thứ tự xuất hiện → ['yyyy-MM-dd', ...]. */
export function findDates(text) {
  const s = String(text ?? '');
  const hits = [];
  for (const p of DATE_PATTERNS) {
    p.re.lastIndex = 0;
    let m;
    while ((m = p.re.exec(s))) {
      const v = p.f(m);
      if (v && !hits.some((h) => m.index < h.end && m.index + m[0].length > h.index)) {
        hits.push({ index: m.index, end: m.index + m[0].length, v });
      }
    }
  }
  return hits.sort((a, b) => a.index - b.index).map((h) => h.v);
}

export function parseDate(text) {
  return findDates(text)[0] || '';
}

const CTA_MAP = [
  ['BOOK_DEMO', /(đặt lịch|book (a )?(demo|call|meeting)|request (a )?demo|schedule)/i],
  ['FREE_TRIAL', /(dùng thử|try (it )?free|free trial|start (free|trial))/i],
  ['GET_QUOTE', /(báo giá|get (a )?quote|nhận giá)/i],
  ['REGISTER_EVENT', /(đăng ký tham (gia|dự)|register|giữ chỗ)/i],
  ['SIGN_UP', /(đăng ký|sign ?up|subscribe)/i],
  ['DOWNLOAD', /(tải|download)/i],
  ['CONTACT', /(liên hệ|contact|tư vấn|gửi yêu cầu)/i],
  ['APPLY_NOW', /(ứng tuyển|apply|nộp (hồ sơ|cv))/i],
  ['SEND_MESSAGE', /(gửi tin nhắn|nhắn tin|send message|message|whatsapp|zalo)/i],
  ['CALL', /(gọi ngay|call now|call)/i],
  ['SHOP_NOW', /(mua ngay|shop now|buy)/i],
  ['LEARN_MORE', /(tìm hiểu|xem thêm|learn more|see more|khám phá|visit|truy cập)/i]
];

export function normalizeCta(text) {
  const t = String(text ?? '').trim();
  if (!t) return '';
  for (const [k, re] of CTA_MAP) if (re.test(t)) return k;
  return 'OTHER';
}

export function looksLikeCta(text) {
  const t = String(text ?? '').trim();
  return t.length > 0 && t.length <= 30 && normalizeCta(t) !== 'OTHER';
}

export function detectLanguage(text) {
  const s = String(text ?? '');
  const letters = s.match(/\p{L}/gu) || [];
  if (letters.length < 10) return '';
  const vi = s.match(/[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/giu) || [];
  const ratio = vi.length / letters.length;
  if (ratio > 0.03) return /\b(the|and|with|your|for)\b/i.test(s) && ratio < 0.08 ? 'mixed' : 'vi';
  return 'en';
}

function countTerms(text, terms) {
  return terms.reduce((n, t) => n + (new RegExp(t, 'i').test(text) ? 1 : 0), 0);
}

export function detectAudience(text, landingPath = '') {
  const t = String(text ?? '').toLowerCase();
  let employer = countTerms(t, ['nhà tuyển dụng', 'doanh nghiệp', '\\bhr\\b', 'nhân sự', 'tuyển dụng nhân sự', 'đăng tin', 'ứng viên phù hợp', '\\bats\\b', 'employer', 'hiring manager', 'headhunt', 'săn đầu người', 'dịch vụ tuyển dụng', 'tìm (người|nhân sự|ứng viên)', 'executive search', 'recruitment (service|agency|partner|solution)', 'talent acquisition', '(looking for|hiring) an? (ceo|cfo|cto|coo|chro|head|director|manager|leader)', 'shortlist', 'your (team|company|business)', 'doanh nghiệp của bạn', 'cho doanh nghiệp']);
  let candidate = countTerms(t, ['việc làm', 'tìm việc', 'cv của bạn', 'ứng tuyển', 'mức lương', 'thu nhập', 'job seeker', 'apply', 'nộp cv', 'gửi cv', 'cơ hội nghề nghiệp', 'we are hiring']);
  if (/\/(employer|nha-tuyen-dung|recruiter|for-employers|clients?|doanh-nghiep)/i.test(landingPath)) employer += 2;
  if (/\/(jobs?|viec-lam|job-seekers?|candidates?|ung-vien)/i.test(landingPath)) candidate += 2;
  if (employer - candidate >= 1) return 'EMPLOYER';
  if (candidate - employer >= 1) return 'CANDIDATE';
  return 'UNKNOWN';
}

const PLATFORM_MAP = [
  [/facebook/i, 'FACEBOOK'], [/instagram/i, 'INSTAGRAM'], [/messenger/i, 'MESSENGER'],
  [/audience network/i, 'AUDIENCE_NETWORK'], [/threads/i, 'THREADS'], [/linkedin/i, 'LINKEDIN'],
  [/youtube/i, 'YOUTUBE'], [/search|tìm kiếm/i, 'GOOGLE_SEARCH'], [/display|hiển thị/i, 'GOOGLE_DISPLAY'],
  [/shopping|mua sắm/i, 'GOOGLE_SHOPPING'], [/maps|bản đồ/i, 'GOOGLE_MAPS'], [/play/i, 'GOOGLE_PLAY']
];

export function mapPlatforms(raw, source) {
  const out = new Set();
  for (const r of raw || []) for (const [re, v] of PLATFORM_MAP) if (re.test(r)) out.add(v);
  if (!out.size) {
    if (source === 'META_AD_LIBRARY') out.add('META');
    else if (source === 'LINKEDIN_AD_LIBRARY') out.add('LINKEDIN');
    else if (source === 'GOOGLE_ATC') out.add('GOOGLE');
  }
  return [...out];
}

export function mapStatus(raw) {
  const s = String(raw ?? '').toLowerCase();
  if (/inactive|không hoạt động|ngừng/.test(s)) return 'INACTIVE';
  if (/active|đang hoạt động/.test(s)) return 'ACTIVE';
  return 'UNKNOWN';
}

/** Khóa ổn định cho media: bỏ query (chữ ký tạm thời), giữ path (ID tài sản). */
export function mediaKey(url) {
  try {
    const u = new URL(url);
    if (/youtube\.com$/.test(u.hostname) && u.searchParams.get('v')) return 'yt:' + u.searchParams.get('v');
    if (u.hostname === 'youtu.be') return 'yt:' + u.pathname.slice(1);
    // CDN Facebook đổi host theo vùng (scontent.fsgn5-1.fna / scontent-sin6-1.xx …): chỉ path là ổn định
    if (/(^|\.)fbcdn\.net$/.test(u.hostname)) return ('fbcdn' + u.pathname).toLowerCase();
    return (u.hostname + u.pathname).toLowerCase();
  } catch {
    return String(url ?? '');
  }
}

export function contentKey(r) {
  const family = { META_AD_LIBRARY: 'META', LINKEDIN_AD_LIBRARY: 'LINKEDIN', GOOGLE_ATC: 'GOOGLE' }[r.source] || 'OTHER';
  const advertiser = r.advertiser_id || slug(r.advertiser_name);
  const landing = r.landing_url ? normalizeLanding(r.landing_url).key : '';
  return [family, advertiser, normalizeForHash(r.body_text), normalizeForHash(r.headline), normalizeForHash(r.description),
    r.cta_normalized || '', landing, creativeKey(r.media_urls)].join('|');
}

export function creativeKey(mediaUrls) {
  return (mediaUrls || []).map(mediaKey).filter(Boolean).sort().join(',');
}

/** Ánh xạ bản ghi → đối thủ trong config (theo ID, tên, domain). Trả về competitor_id hoặc ''. */
export function matchCompetitor(config, r) {
  const comps = config?.competitors || [];
  const advId = String(r.advertiser_id || '').trim();
  if (advId) {
    const hit = comps.find((c) => c.meta_page_id === advId || c.google_advertiser_id === advId);
    if (hit) return hit.competitor_id;
  }
  const name = slug(r.advertiser_name);
  if (name) {
    for (const c of comps) {
      const names = [c.competitor_name, c.linkedin_company_name, c.google_advertiser_name].map(slug).filter(Boolean);
      if (names.some((n) => n === name || (n.length >= 5 && name.includes(n)))) return c.competitor_id;
    }
  }
  const domain = r.landing_url ? normalizeLanding(r.landing_url).domain : '';
  if (domain) {
    const hit = comps.find((c) => [c.domain, ...(c.alt_domains || [])].map(registrableDomain).includes(domain));
    if (hit) return hit.competitor_id;
  }
  return '';
}

/**
 * Capture thô (content script) + ngữ cảnh (popup) → bản ghi chuẩn hóa (chưa có fingerprint).
 */
export function normalizeCapture(cap, context = {}, config = null) {
  const landingRaw = unwrapRedirect(cap.landing_url_raw || '');
  const landing = landingRaw ? normalizeLanding(landingRaw) : null;
  const body = normalizeText(cap.body_text).slice(0, 5000);
  const headline = normalizeText(cap.headline).slice(0, 500);
  const description = normalizeText(cap.description).slice(0, 1000);
  const ctaText = normalizeText(cap.cta_text).slice(0, 100);
  const allText = [body, headline, description, ctaText].join(' ');
  // Dòng khoảng ngày ("2 Sep 2026 - 20 Sep 2026", "Ran from … to …") được gửi ở cả start_date_raw và end_date_raw.
  const startDates = findDates(cap.start_date_raw);
  const startDate = cap.start_date || startDates[0] || '';
  const endDate = cap.end_date || (cap.end_date_raw
    ? (cap.end_date_raw === cap.start_date_raw ? startDates[1] || '' : parseDate(cap.end_date_raw))
    : '');
  let isActive = cap.is_active || mapStatus(cap.status_raw);
  if (cap.source === 'GOOGLE_ATC' && endDate && isActive === 'UNKNOWN') {
    const days = (Date.now() - new Date(endDate + 'T00:00:00').getTime()) / 86400000;
    isActive = days <= (config?.google_active_days ?? 2) + 1 ? 'ACTIVE' : 'INACTIVE';
  }
  const r = {
    client_id: cap.client_id,
    kind: 'ad',
    source: cap.source,
    native_ad_id: String(cap.native_ad_id || ''),
    platforms: mapPlatforms(cap.platforms_raw, cap.source),
    advertiser_name: normalizeText(cap.advertiser_name).slice(0, 200),
    advertiser_id: String(cap.advertiser_id || ''),
    paid_for_by: normalizeText(cap.paid_for_by).slice(0, 200),
    seen_at: cap.captured_at || new Date().toISOString(),
    start_date: startDate,
    end_date: endDate,
    is_active: isActive,
    body_text: body,
    body_truncated: !!cap.body_truncated,
    headline,
    description,
    cta_text: ctaText,
    cta_normalized: normalizeCta(ctaText),
    format: cap.format_raw || 'UNKNOWN',
    media_urls: (cap.media || []).map((m) => m.url || m.poster).filter((u) => /^https?:\/\//.test(u || '')).slice(0, 10),
    variant_count: Number(cap.variant_count) || 1,
    ad_url: cap.ad_url || '',
    landing_url: landing ? landing.url : '',
    landing_url_raw: landingRaw || '',
    country: cap.country_filter || context.market || '',
    language: detectLanguage(allText),
    audience_side: context.audience_side && context.audience_side !== 'AUTO'
      ? context.audience_side
      : detectAudience(allText, landing ? new URL(landing.url).pathname : ''),
    competitor_id: '',
    product: context.product || '',
    campaign_label: context.campaign_label || '',
    tags: [...(context.tags || [])],
    rating: context.rating || '',
    notes: context.notes || '',
    extract_confidence: cap.confidence_score ?? '',
    extractor_version: cap.extractor_version || '',
    page_url: cap.page_url || ''
  };
  r.competitor_id = matchCompetitor(config, r) || context.competitor_id || '';
  return r;
}

/** Tạo ad_uid, content_fp, creative_fp. */
export async function fingerprint(r) {
  r.content_fp = await sha256Hex(contentKey(r));
  const ck = creativeKey(r.media_urls);
  r.creative_fp = ck ? await sha256Hex(ck) : '';
  const prefix = SRC_PREFIX[r.source] || 'man';
  r.ad_uid = r.native_ad_id ? `${prefix}:${r.native_ad_id}` : `fp:${r.content_fp.slice(0, 16)}`;
  return r;
}

/** Trường thiếu → không cho gửi. */
export function missingFields(r) {
  const miss = [];
  if (!r.advertiser_name) miss.push('advertiser_name');
  if (!r.ad_url) miss.push('ad_url');
  if (!r.body_text && !r.headline && !(r.media_urls || []).length) miss.push('body_text');
  return miss;
}

/** Bản ghi gửi lên API (bỏ trường nội bộ của Extension). */
export function toWire(r, mode) {
  if (mode === 'TOUCH') {
    return { client_id: r.client_id, mode, ad_uid: r.ad_uid, seen_at: r.seen_at, is_active: r.is_active, end_date: r.end_date || null,
      variant_count: r.variant_count, media_urls: r.media_urls, platforms: r.platforms, tags: r.tags };
  }
  const { kind, state, page_url, errors, sync, known, missing, needs_manual_text, added_at, mode: _m, ...rest } = r;
  return { ...rest, mode: 'FULL' };
}
