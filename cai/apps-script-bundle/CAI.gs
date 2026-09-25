/**
 * CAI – Competitor Ad Intelligence · Apps Script (bản gộp một file)
 * TỰ SINH từ cai/apps-script/*.gs bằng `npm run bundle` — không sửa tay file này.
 */

/* ===================== Config.gs ===================== */

/**
 * CAI – Competitor Ad Intelligence
 * Định nghĩa sheet, danh mục, dữ liệu khởi tạo (seed) cho chiến dịch Headhunt của Link Talent.
 * Chỉ chứa hằng số dạng literal (không tham chiếu file khác khi nạp).
 */

var SCHEMA_VERSION = 1;
var MAX_BATCH = 50;
var MAX_TEXT = 5000;

var SHEET_HEADERS = {
  CONFIG: ['key', 'value', 'note'],
  LISTS: ['platform', 'source', 'format', 'funnel', 'framework', 'angle', 'audience_side', 'status',
    'tracking_status', 'cta_normalized', 'offer_type', 'pain_point', 'segment', 'copy_risk'],
  COMPETITORS: ['competitor_id', 'competitor_name', 'website', 'domain', 'alt_domains', 'meta_page_url', 'meta_page_id',
    'instagram_handle', 'linkedin_page_url', 'linkedin_company_name', 'google_advertiser_name', 'google_advertiser_id',
    'products', 'markets', 'segment', 'tracking_status', 'priority', 'verified', 'notes',
    'ads_total', 'ads_active', 'last_collected_at'],
  KEYWORDS: ['keyword_id', 'keyword', 'keyword_group', 'language', 'market', 'intent', 'mapped_angles',
    'trends_batch', 'is_anchor', 'active', 'latest_interest', 'momentum', 'trend_direction'],
  SEARCH_URLS: ['url_id', 'competitor_id', 'competitor_name', 'platform', 'market', 'query_type', 'query_value',
    'url', 'last_opened_at', 'open_count'],
  RAW_ADS: ['record_id', 'ad_uid', 'native_ad_id', 'source', 'platforms', 'competitor_id', 'competitor_name',
    'advertiser_name', 'advertiser_id', 'paid_for_by', 'first_seen_at', 'last_seen_at', 'seen_count',
    'start_date', 'end_date', 'is_active', 'body_text', 'body_truncated', 'headline', 'description', 'cta_text',
    'cta_normalized', 'format', 'media_urls', 'variant_count', 'ad_url', 'landing_url', 'landing_url_raw',
    'final_domain', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'country', 'language',
    'audience_side', 'product', 'campaign_label', 'collector', 'content_fp', 'creative_fp', 'cluster_id',
    'version', 'change_flag', 'run_days', 'is_long_running', 'is_new_this_week', 'week_start', 'tags', 'rating',
    'notes', 'extract_confidence', 'extractor_version', 'created_at', 'updated_at'],
  AD_HISTORY: ['history_id', 'record_id', 'ad_uid', 'changed_at', 'version_from', 'version_to', 'changed_fields',
    'old_values_json', 'new_values_json', 'collector'],
  AD_ANALYSIS: ['record_id', 'competitor_name', 'first_seen_at', 'audience_side', 'hook_auto', 'hook_manual',
    'pain_point_auto', 'pain_point_manual', 'desire', 'value_proposition', 'offer_auto', 'offer_type_auto',
    'offer_type_manual', 'proof_auto', 'objection', 'creative_angle_auto', 'secondary_angles_auto',
    'creative_angle_manual', 'funnel_stage_auto', 'funnel_stage_manual', 'framework_auto', 'framework_manual',
    'target_audience', 'differentiation_level', 'learnings', 'copy_risk', 'priority_signal', 'analysis_source',
    'ai_confidence', 'reviewed_by', 'reviewed_at'],
  GOOGLE_TRENDS: ['trend_row_id', 'keyword', 'market', 'timeframe', 'batch_id', 'anchor_keyword', 'point_date',
    'interest', 'related_queries_top', 'related_queries_rising', 'collected_at', 'source_url',
    'collection_method', 'collector'],
  LANDING_PAGES: ['lp_snapshot_id', 'competitor_id', 'url', 'url_key', 'final_url', 'page_title',
    'meta_description', 'h1', 'offer', 'primary_cta', 'secondary_ctas', 'social_proof', 'form_present',
    'form_fields', 'pricing_visible', 'price_points', 'funnel_stage', 'utm', 'checked_at', 'url_status',
    'content_hash', 'section_hashes_json', 'changed_sections', 'change_summary', 'linked_ad_uids', 'collector'],
  OPPORTUNITIES: ['angle', 'ads_count_90d', 'competitors_using', 'share_of_ads', 'long_running_count',
    'popularity', 'differentiation', 'trend', 'brand_fit_1_5', 'brand_fit', 'opportunity_score',
    'evidence_record_ids', 'hypothesis', 'status', 'owner', 'updated_at'],
  RUN_LOG: ['run_id', 'timestamp', 'request_id', 'action', 'source', 'collector', 'found', 'received', 'inserted',
    'updated', 'duplicates', 'rejected', 'errors', 'sync_status', 'duration_ms', 'extension_version',
    'schema_version']
};

/** Cột lưu dạng văn bản thuần (tránh Sheets đổi ID dài thành số và mất chính xác). */
var TEXT_COLUMNS = {
  RAW_ADS: ['ad_uid', 'native_ad_id', 'advertiser_id', 'content_fp', 'creative_fp', 'record_id', 'cluster_id'],
  COMPETITORS: ['meta_page_id', 'google_advertiser_id'],
  LANDING_PAGES: ['content_hash']
};

/** Cột người dùng nhập tay: không bao giờ bị ghi đè khi upsert. */
var MANUAL_AD_FIELDS = ['tags', 'rating', 'notes', 'campaign_label', 'product'];

/** Trường theo dõi thay đổi nội dung (ghi AD_HISTORY). URL media ký tạm thời nên dùng creative_fp thay thế. */
var TRACKED_AD_FIELDS = ['body_text', 'headline', 'description', 'cta_text', 'format', 'landing_url', 'creative_fp'];

var LIST_VALUES = {
  platform: ['FACEBOOK', 'INSTAGRAM', 'MESSENGER', 'AUDIENCE_NETWORK', 'THREADS', 'META', 'LINKEDIN',
    'GOOGLE_SEARCH', 'GOOGLE_DISPLAY', 'YOUTUBE', 'GOOGLE_SHOPPING', 'GOOGLE_MAPS', 'GOOGLE_PLAY', 'GOOGLE'],
  source: ['META_AD_LIBRARY', 'LINKEDIN_AD_LIBRARY', 'GOOGLE_ATC', 'GOOGLE_TRENDS', 'LANDING_PAGE', 'MANUAL'],
  format: ['IMAGE', 'VIDEO', 'CAROUSEL', 'TEXT', 'DOCUMENT', 'EVENT', 'MESSAGE', 'SPOTLIGHT', 'DYNAMIC', 'UNKNOWN'],
  funnel: ['TOFU', 'MOFU', 'BOFU', 'UNCLASSIFIED'],
  framework: ['PAS', 'BAB', 'AIDA', 'SOCIAL_PROOF', 'FAB', 'OTHER', 'NONE'],
  angle: ['SPEED', 'QUALITY_FIT', 'SENIOR_TALENT', 'NICHE_EXPERTISE', 'PASSIVE_NETWORK', 'GUARANTEE', 'PRICING',
    'CONFIDENTIAL', 'AI_TECH', 'SOCIAL_PROOF', 'PAIN_FEAR', 'OFFER_PROMO', 'EDUCATION', 'EVENT', 'EMPLOYER_BRAND',
    'DATA_REPORTING', 'CANDIDATE_JOB', 'UNCLASSIFIED'],
  audience_side: ['EMPLOYER', 'CANDIDATE', 'UNKNOWN'],
  status: ['ACTIVE', 'INACTIVE', 'UNKNOWN'],
  tracking_status: ['TRACKING', 'PAUSED', 'ARCHIVED'],
  cta_normalized: ['LEARN_MORE', 'SIGN_UP', 'BOOK_DEMO', 'FREE_TRIAL', 'CONTACT', 'DOWNLOAD', 'REGISTER_EVENT',
    'APPLY_NOW', 'SHOP_NOW', 'GET_QUOTE', 'SEND_MESSAGE', 'CALL', 'OTHER'],
  offer_type: ['FREE_TRIAL', 'DISCOUNT', 'FREE_RESOURCE', 'EVENT', 'DEMO', 'GUARANTEE', 'FREE_CONSULTATION', 'NONE'],
  pain_point: ['SLOW_HIRING', 'BAD_HIRE', 'SENIOR_SCARCITY', 'LOW_QUALITY_CV', 'HR_OVERLOAD', 'HIGH_COST',
    'CONFIDENTIALITY', 'RETENTION', 'NONE'],
  segment: ['DIRECT', 'INDIRECT', 'ASPIRATIONAL'],
  copy_risk: ['LOW', 'MED', 'HIGH']
};

var DEFAULT_CONFIG = [
  ['business_name', 'Link Talent', ''],
  ['brand_domain', 'linktalent.vn', 'Quảng cáo trỏ về domain này được gắn tag own-brand'],
  ['industry', 'HR Tech / Dịch vụ tuyển dụng', ''],
  ['focus_product', 'Headhunt / Executive Search', 'Sản phẩm đang nghiên cứu'],
  ['markets', 'VN', 'Phân tách bằng dấu phẩy'],
  ['languages', 'vi,en', ''],
  ['update_frequency', 'WEEKLY', 'DAILY | WEEKLY'],
  ['report_recipients', '', 'Email nhận báo cáo tuần, phân tách dấu phẩy'],
  ['users', '', 'Tự cập nhật khi chạy menu CAI → Tạo người dùng'],
  ['long_running_days', '30', 'Ngưỡng long-running (ngày)'],
  ['long_running_min_sightings', '3', 'Số lần quan sát tối thiểu khi không có ngày bắt đầu'],
  ['new_ad_window_days', '7', ''],
  ['google_active_days', '2', 'Google: last shown trong N ngày → ACTIVE'],
  ['score_weights', '0.25,0.25,0.20,0.30', 'popularity, differentiation, trend, brand_fit'],
  ['usp_angles', 'QUALITY_FIT,AI_TECH,DATA_REPORTING', 'Angle Link Talent có USP riêng (+0.2 differentiation)'],
  ['tags', 'headhunt,executive-search,c-level,it-hiring,guarantee,fee,confidential,webinar,salary-report,own-brand', ''],
  ['schema_version', String(SCHEMA_VERSION), 'Không sửa tay']
];

/**
 * Đối thủ khởi tạo cho mảng Headhunt tại VN.
 * website/domain là giá trị tham khảo, CẦN XÁC MINH (cột verified = FALSE) trước khi dùng URL Google ATC.
 * Page ID Meta / Advertiser ID Google để trống: lấy từ URL khi mở thư viện quảng cáo.
 */
var SEED_COMPETITORS = [
  { competitor_name: 'Navigos Search', website: 'https://www.navigossearch.com', segment: 'DIRECT', priority: 1, products: 'Executive search, Headhunt' },
  { competitor_name: 'First Alliances', website: 'https://www.firstalliances.com', segment: 'DIRECT', priority: 1, products: 'Executive search, Headhunt' },
  { competitor_name: 'Talentnet', website: 'https://www.talentnet.vn', segment: 'DIRECT', priority: 2, products: 'Headhunt, RPO, HR outsourcing' },
  { competitor_name: 'HRchannels', website: 'https://www.hrchannels.com', segment: 'DIRECT', priority: 2, products: 'Headhunt' },
  { competitor_name: 'Robert Walters Vietnam', website: 'https://www.robertwalters.com.vn', segment: 'DIRECT', priority: 2, products: 'Recruitment, Executive search' },
  { competitor_name: 'JAC Recruitment Vietnam', website: 'https://www.jac-recruitment.vn', segment: 'DIRECT', priority: 2, products: 'Headhunt' },
  { competitor_name: 'ManpowerGroup Vietnam', website: 'https://www.manpower.com.vn', segment: 'INDIRECT', priority: 3, products: 'Recruitment, Staffing' },
  { competitor_name: 'TopCV', website: 'https://www.topcv.vn', segment: 'INDIRECT', priority: 3, products: 'Job board, Tuyển dụng' },
  { competitor_name: 'VietnamWorks', website: 'https://www.vietnamworks.com', segment: 'INDIRECT', priority: 3, products: 'Job board, Tuyển dụng' },
  { competitor_name: 'CareerViet', website: 'https://careerviet.vn', segment: 'INDIRECT', priority: 3, products: 'Job board, Tuyển dụng' }
];

/** Từ khóa khởi tạo cho Headhunt. Mỗi batch Trends ≤ 5 từ, luôn có anchor "headhunter". */
var SEED_KEYWORDS = [
  ['headhunter', 'Category', 'vi', 'Commercial', 'PASSIVE_NETWORK', 'B1', true],
  ['dịch vụ headhunt', 'Category', 'vi', 'Commercial', 'PASSIVE_NETWORK', 'B1', false],
  ['công ty headhunter', 'Category', 'vi', 'Commercial', 'SOCIAL_PROOF', 'B1', false],
  ['săn đầu người', 'Category', 'vi', 'Commercial', 'PASSIVE_NETWORK', 'B1', false],
  ['executive search', 'Category', 'en', 'Commercial', 'SENIOR_TALENT', 'B1', false],
  ['headhunter', 'Category', 'vi', 'Commercial', 'PASSIVE_NETWORK', 'B2', true],
  ['tuyển dụng nhân sự cấp cao', 'Pain', 'vi', 'Commercial', 'SENIOR_TALENT', 'B2', false],
  ['tuyển giám đốc', 'Pain', 'vi', 'Commercial', 'SENIOR_TALENT', 'B2', false],
  ['tuyển dụng quản lý', 'Pain', 'vi', 'Commercial', 'SENIOR_TALENT', 'B2', false],
  ['phí headhunt', 'Pricing', 'vi', 'Commercial', 'PRICING', 'B2', false],
  ['headhunter', 'Category', 'vi', 'Commercial', 'PASSIVE_NETWORK', 'B3', true],
  ['headhunt IT', 'Niche', 'vi', 'Commercial', 'NICHE_EXPERTISE', 'B3', false],
  ['dịch vụ tuyển dụng', 'Category', 'vi', 'Commercial', 'SPEED', 'B3', false],
  ['tuyển dụng nhanh', 'Pain', 'vi', 'Commercial', 'SPEED', 'B3', false],
  ['RPO', 'Category', 'en', 'Commercial', 'DATA_REPORTING', 'B3', false]
];

/* ===================== Utils.gs ===================== */

/** Tiện ích thuần (không phụ thuộc Sheets) — được test bằng Node. */

var TRACKING_PARAMS_ = /^(fbclid|gclid|gbraid|wbraid|msclkid|dclid|yclid|igshid|mc_eid|mc_cid|_hsenc|_hsmi|__hstc|__hssc|__hsfp|ref_src|trk|trackingid|li_fat_id)$/i;

function toHex_(bytes) {
  var out = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] < 0 ? bytes[i] + 256 : bytes[i];
    out += (b < 16 ? '0' : '') + b.toString(16);
  }
  return out;
}

function sha256Hex_(text) {
  return toHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(text), Utilities.Charset.UTF_8));
}

function constantTimeEq_(a, b) {
  a = String(a || '');
  b = String(b || '');
  if (a.length !== b.length) return false;
  var diff = 0;
  for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

function isBlank_(v) {
  return v === null || v === undefined || (typeof v === 'string' && v.trim() === '');
}

function str_(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return v.join(',');
  return String(v);
}

function truncate_(s, n) {
  s = str_(s);
  return s.length > n ? s.slice(0, n) : s;
}

/** Chặn formula injection: chuỗi bắt đầu bằng = + - @ được tiền tố '. */
function safeCell_(v) {
  if (typeof v !== 'string') return v;
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

/** 'yyyy-MM-dd' → Date (giờ địa phương 00:00). Date giữ nguyên. Khác → null. */
function toDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (isBlank_(v)) return null;
  var s = String(v).trim();
  var m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  var d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function startOfDay_(d) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function daysBetween_(a, b) {
  return Math.round((startOfDay_(b).getTime() - startOfDay_(a).getTime()) / 86400000);
}

function sameDay_(a, b) {
  return a && b && startOfDay_(a).getTime() === startOfDay_(b).getTime();
}

/** Thứ Hai của tuần chứa d. */
function weekStart_(d) {
  var s = startOfDay_(d);
  var dow = (s.getDay() + 6) % 7; // Mon=0
  return new Date(s.getFullYear(), s.getMonth(), s.getDate() - dow);
}

function isoDate_(d) {
  if (!d) return '';
  var p = function (n) { return (n < 10 ? '0' : '') + n; };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}

function splitList_(v) {
  if (Array.isArray(v)) return v.map(function (x) { return String(x).trim(); }).filter(String);
  return str_(v).split(',').map(function (x) { return x.trim(); }).filter(String);
}

function unionList_(a, b) {
  var seen = {};
  var out = [];
  splitList_(a).concat(splitList_(b)).forEach(function (x) {
    var k = x.toLowerCase();
    if (!seen[k]) { seen[k] = true; out.push(x); }
  });
  return out.join(',');
}

function removeDiacritics_(s) {
  return str_(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D');
}

function slug_(s) {
  return removeDiacritics_(s).toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/** Tách URL an toàn (không dùng class URL vì Apps Script không có). */
function parseUrl_(u) {
  var m = str_(u).trim().match(/^(https?):\/\/([^\/?#]+)([^?#]*)(\?[^#]*)?(#.*)?$/i);
  if (!m) return null;
  var params = [];
  (m[4] || '').replace(/^\?/, '').split('&').forEach(function (kv) {
    if (!kv) return;
    var i = kv.indexOf('=');
    var k = i < 0 ? kv : kv.slice(0, i);
    var v = i < 0 ? '' : kv.slice(i + 1);
    try { k = decodeURIComponent(k.replace(/\+/g, ' ')); } catch (e) { /* giữ nguyên */ }
    try { v = decodeURIComponent(v.replace(/\+/g, ' ')); } catch (e) { /* giữ nguyên */ }
    params.push([k, v]);
  });
  return { scheme: m[1].toLowerCase(), host: m[2].toLowerCase(), path: m[3] || '/', params: params };
}

function registrableDomain_(host) {
  host = str_(host).toLowerCase().replace(/^www\./, '').replace(/:\d+$/, '');
  var parts = host.split('.');
  if (parts.length <= 2) return host;
  var sld2 = parts.slice(-2).join('.');
  if (/^(com|net|org|edu|gov|ac|co|biz|info|int|pro|name|health)\.(vn|sg|th|id|my|ph|uk|au|jp|kr)$/.test(sld2)) {
    return parts.slice(-3).join('.');
  }
  return sld2;
}

/** Bỏ tham số tracking cá nhân, tách UTM riêng. */
function normalizeLanding_(raw) {
  var p = parseUrl_(raw);
  if (!p) return { url: str_(raw), domain: '', utm: {}, utmString: '', key: '' };
  var utm = {};
  var keep = [];
  p.params.forEach(function (kv) {
    if (/^utm_/i.test(kv[0])) utm[kv[0].toLowerCase()] = kv[1];
    else if (!TRACKING_PARAMS_.test(kv[0])) keep.push(kv);
  });
  keep.sort(function (a, b) { return a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0; });
  var host = p.host.replace(/^www\./, '');
  var path = p.path.length > 1 ? p.path.replace(/\/+$/, '') : '';
  var q = keep.map(function (kv) { return encodeURIComponent(kv[0]) + '=' + encodeURIComponent(kv[1]); }).join('&');
  var utmString = Object.keys(utm).sort().map(function (k) { return k + '=' + utm[k]; }).join('&');
  return {
    url: p.scheme + '://' + host + path + (q ? '?' + q : ''),
    domain: registrableDomain_(host),
    utm: utm,
    utmString: utmString,
    key: host + (path || '/')
  };
}

/* ===================== Rules.gs ===================== */

/**
 * Rule phân loại song ngữ (VI/EN) — MVP, không dùng AI.
 * Mỗi rule là danh sách regex term; điểm = số term khớp. Marketer chỉnh từ điển tại đây.
 */

var ANGLE_RULES = {
  SPEED: ['nhanh', 'trong \\d+ ?(ngày|tuần|giờ)', '\\d+ ?(ngày|tuần)', 'shortlist', 'gấp', 'khẩn', 'ngay lập tức', 'fast', 'quick', 'within \\d+'],
  QUALITY_FIT: ['đúng người', 'phù hợp', 'chất lượng', 'năng lực', 'văn hóa', 'đánh giá', 'sàng lọc', 'right (person|people|talent)', 'culture fit', 'quality'],
  SENIOR_TALENT: ['cấp cao', 'c-level', 'ceo', 'cfo', 'cto', 'coo', 'chro', 'giám đốc', 'quản lý', 'trưởng phòng', 'lãnh đạo', 'executive', 'senior', 'leader', 'manager', 'director', 'head of'],
  NICHE_EXPERTISE: ['chuyên ngành', 'chuyên sâu', 'ngành (it|công nghệ|tài chính|ngân hàng|sản xuất|fmcg|bán lẻ|dược|bất động sản|logistics)', '\\bit\\b', 'tech', 'fintech', 'kỹ sư', 'engineer', 'specialist', 'industry'],
  PASSIVE_NETWORK: ['ứng viên thụ động', 'mạng lưới', 'kho ứng viên', 'cơ sở dữ liệu', 'database', 'network', 'passive candidate', 'không đăng tin', 'tiếp cận', 'talent pool', 'headhunt', 'săn đầu người', 'săn nhân tài'],
  GUARANTEE: ['bảo hành', 'thay thế miễn phí', 'cam kết', 'đảm bảo', 'hoàn phí', 'hoàn tiền', 'guarantee', 'replacement'],
  PRICING: ['phí', '% ?lương', 'chi phí', 'giá', 'chỉ trả (phí|tiền) khi', 'không thành công không', 'no cure no pay', 'fee', 'pricing', 'success fee', 'retainer'],
  CONFIDENTIAL: ['bảo mật', 'tuyển kín', 'kín đáo', 'thay thế nhân sự', 'confidential', 'discreet'],
  AI_TECH: ['\\bai\\b', 'trí tuệ nhân tạo', 'tự động', 'công nghệ', 'matching', 'thuật toán', 'machine learning', 'automation'],
  SOCIAL_PROOF: ['\\d[\\d.,]*\\+? ?(doanh nghiệp|khách hàng|đối tác|ứng viên|vị trí|năm kinh nghiệm)', 'tin dùng', 'tin tưởng', 'top \\d', 'hàng đầu', 'uy tín', 'giải thưởng', 'trusted', 'leading', 'award'],
  PAIN_FEAR: ['tuyển sai', 'nghỉ việc', 'bỏ trống', 'trống vị trí', 'mất ứng viên', 'khó tuyển', 'không tìm được', 'thiếu nhân sự', 'bad hire', 'turnover', 'vacancy'],
  OFFER_PROMO: ['miễn phí', 'giảm', 'ưu đãi', 'khuyến mãi', 'tặng', 'voucher', 'free', 'discount', 'offer'],
  EDUCATION: ['báo cáo', 'khảo sát', 'cẩm nang', 'hướng dẫn', 'xu hướng', 'bí quyết', 'salary (guide|report|survey)', 'mức lương thị trường', 'insight', 'guide', 'report'],
  EVENT: ['sự kiện', 'hội thảo', 'webinar', 'workshop', 'talkshow', 'meetup', 'event'],
  EMPLOYER_BRAND: ['thương hiệu tuyển dụng', 'employer brand', '\\bevp\\b', 'nơi làm việc tốt'],
  DATA_REPORTING: ['dashboard', 'số liệu', 'đo lường', 'báo cáo tiến độ', 'minh bạch', 'real-?time', 'data'],
  CANDIDATE_JOB: ['ứng tuyển', 'việc làm', 'cơ hội (nghề nghiệp|việc làm)', 'mức lương', 'thu nhập', 'gửi cv', 'nộp cv', 'we are hiring', 'apply', 'job opening', 'tuyển (gấp )?\\d+ ']
};

var PAIN_RULES = {
  SLOW_HIRING: ['tuyển (mãi|lâu|chậm)', 'mất (hàng tháng|nhiều tháng|nhiều tuần)', 'time[- ]to[- ]hire', 'chậm trễ', 'bỏ trống'],
  BAD_HIRE: ['tuyển sai', 'sai người', 'không phù hợp', 'bad hire', 'nghỉ việc sớm'],
  SENIOR_SCARCITY: ['khó tìm', 'khan hiếm', 'không tìm được', 'hiếm', 'cạnh tranh nhân tài', 'talent shortage'],
  LOW_QUALITY_CV: ['cv (rác|không chất lượng|ảo)', 'lọc cv', 'hàng trăm cv', 'ứng viên không đạt'],
  HR_OVERLOAD: ['quá tải', 'không đủ người', 'hr (bận|ít người)', 'thiếu thời gian'],
  HIGH_COST: ['tốn kém', 'chi phí cao', 'lãng phí', 'đắt', 'expensive'],
  CONFIDENTIALITY: ['bảo mật', 'tuyển kín', 'thay thế nhân sự', 'confidential'],
  RETENTION: ['giữ chân', 'nghỉ việc', 'turnover', 'retention', 'gắn bó']
};

var FUNNEL_RULES = {
  TOFU: ['xu hướng', 'bí quyết', 'mẹo', 'hướng dẫn', 'bạn có biết', 'báo cáo thị trường', 'infographic', 'blog', 'podcast', 'tips', 'guide', 'trend', 'what is', 'là gì'],
  MOFU: ['ebook', 'whitepaper', 'checklist', 'template', 'mẫu jd', 'webinar', 'workshop', 'hội thảo', 'case study', 'câu chuyện khách hàng', 'so sánh', '\\bvs\\b', 'báo cáo lương', 'salary guide', 'tìm hiểu dịch vụ'],
  BOFU: ['dùng thử', 'free trial', 'báo giá', 'bảng giá', 'pricing', 'đặt lịch', 'book a (demo|call|meeting)', 'tư vấn (miễn phí|1:1|ngay)', 'liên hệ ngay', 'gửi yêu cầu tuyển dụng', 'giảm \\d+ ?%', 'ưu đãi', 'chỉ còn', 'hôm nay', 'đăng ký ngay', 'get a quote']
};

var CTA_MAP = [
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

function countTerms_(text, terms) {
  var n = 0;
  for (var i = 0; i < terms.length; i++) {
    if (new RegExp(terms[i], 'i').test(text)) n++;
  }
  return n;
}

function normalizeCta_(ctaText) {
  var t = str_(ctaText).trim();
  if (!t) return '';
  for (var i = 0; i < CTA_MAP.length; i++) if (CTA_MAP[i][1].test(t)) return CTA_MAP[i][0];
  return 'OTHER';
}

function detectAudience_(text, landingPath) {
  var t = str_(text).toLowerCase();
  var employer = countTerms_(t, ['nhà tuyển dụng', 'doanh nghiệp', '\\bhr\\b', 'nhân sự', 'tuyển dụng nhân sự', 'đăng tin', 'ứng viên phù hợp', '\\bats\\b', 'employer', 'hiring manager', 'headhunt', 'săn đầu người', 'dịch vụ tuyển dụng', 'tìm (người|nhân sự|ứng viên)', 'executive search', 'recruitment (service|agency|partner|solution)', 'talent acquisition', '(looking for|hiring) an? (ceo|cfo|cto|coo|chro|head|director|manager|leader)', 'shortlist', 'your (team|company|business)', 'doanh nghiệp của bạn', 'cho doanh nghiệp']);
  var candidate = countTerms_(t, ['việc làm', 'tìm việc', 'cv của bạn', 'ứng tuyển', 'mức lương', 'thu nhập', 'job seeker', 'apply', 'nộp cv', 'gửi cv', 'cơ hội nghề nghiệp', 'we are hiring']);
  if (/\/(employer|nha-tuyen-dung|recruiter|for-employers|clients?|doanh-nghiep)/i.test(str_(landingPath))) employer += 2;
  if (/\/(jobs?|viec-lam|job-seekers?|candidates?|ung-vien)/i.test(str_(landingPath))) candidate += 2;
  if (employer - candidate >= 1) return 'EMPLOYER';
  if (candidate - employer >= 1) return 'CANDIDATE';
  return 'UNKNOWN';
}

function classifyAngles_(text) {
  var t = str_(text).toLowerCase();
  var scored = Object.keys(ANGLE_RULES).map(function (k) { return [k, countTerms_(t, ANGLE_RULES[k])]; })
    .filter(function (x) { return x[1] > 0; })
    .sort(function (a, b) { return b[1] - a[1]; });
  if (!scored.length) return { primary: 'UNCLASSIFIED', secondary: [] };
  var top = scored[0][1];
  var secondary = scored.slice(1).filter(function (x) { return x[1] >= top / 2; }).slice(0, 2).map(function (x) { return x[0]; });
  return { primary: scored[0][0], secondary: secondary };
}

function classifyPain_(text) {
  var t = str_(text).toLowerCase();
  var best = 'NONE';
  var bestScore = 0;
  Object.keys(PAIN_RULES).forEach(function (k) {
    var s = countTerms_(t, PAIN_RULES[k]);
    if (s > bestScore) { best = k; bestScore = s; }
  });
  return best;
}

function classifyFunnel_(text, ctaNorm, landingPath) {
  var t = str_(text).toLowerCase();
  var p = str_(landingPath).toLowerCase();
  var tf = countTerms_(t, FUNNEL_RULES.TOFU) + (ctaNorm === 'LEARN_MORE' ? 2 : 0) + (/\/(blog|tin-tuc|cam-nang|news|insights?)/.test(p) ? 2 : 0);
  var mf = countTerms_(t, FUNNEL_RULES.MOFU) + (ctaNorm === 'DOWNLOAD' || ctaNorm === 'REGISTER_EVENT' ? 2 : 0) + (/\/(webinar|ebook|case-stud|salary|bao-cao|dich-vu|services?)/.test(p) ? 2 : 0);
  var bf = countTerms_(t, FUNNEL_RULES.BOFU) + (['BOOK_DEMO', 'FREE_TRIAL', 'GET_QUOTE', 'CONTACT', 'SIGN_UP'].indexOf(ctaNorm) >= 0 ? 3 : 0) + (/\/(pricing|bang-gia|lien-he|contact|dang-ky|demo|request)/.test(p) ? 2 : 0);
  var mx = Math.max(tf, mf, bf);
  if (mx === 0) return 'UNCLASSIFIED';
  if (bf === mx) return 'BOFU';
  if (mf === mx) return 'MOFU';
  return 'TOFU';
}

function detectFramework_(body) {
  var t = str_(body).toLowerCase();
  if (t.length < 60) return 'NONE';
  var head = t.slice(0, Math.max(80, Math.round(t.length / 3)));
  var tail = t.slice(-150);
  var p = /\?|bạn (đang|có|còn|vẫn)|mệt mỏi|mất (hàng|cả|quá|nhiều)|tốn|khó khăn|đau đầu|struggl|tired of|khó tuyển/.test(head);
  var a = /tuyển sai|rủi ro|thiệt hại|gấp \d|mất thêm|nghỉ việc|chậm trễ|bỏ trống|cost of|losing|lỡ mất/.test(t);
  var s = /giúp bạn|giải pháp|chỉ với|chỉ cần|hãy để|với dịch vụ|helps? you|with our|let us/.test(t);
  var bab = /(trước đây|trước khi|từng).{0,160}(giờ đây|sau khi|bây giờ|nay đã)|hãy tưởng tượng|imagine|không còn phải/.test(t);
  var sp = /\d[\d.,]*\+?\s*(doanh nghiệp|khách hàng|nhà tuyển dụng|ứng viên|vị trí|companies|clients|placements)|tin dùng|trusted by|★|top \d/.test(t);
  var aida = /^\d|\?|!/.test(head) && /dịch vụ|quy trình|tính năng|feature|mạng lưới|network/.test(t) &&
    /giúp|tiết kiệm|nhanh|hiệu quả|đúng người|save/.test(t) && /đăng ký|liên hệ|tư vấn|tìm hiểu|nhận ngay|book|sign up|contact/.test(tail);
  if (p && a && s) return 'PAS';
  if (bab) return 'BAB';
  if (aida) return 'AIDA';
  if (sp) return 'SOCIAL_PROOF';
  return 'OTHER';
}

function offerType_(text) {
  var t = str_(text).toLowerCase();
  if (/dùng thử|free trial/.test(t)) return 'FREE_TRIAL';
  if (/bảo hành|thay thế miễn phí|hoàn phí|hoàn tiền|guarantee|replacement/.test(t)) return 'GUARANTEE';
  if (/giảm|\d+\s?%\s?(off|giảm)|discount|khuyến mãi|voucher|ưu đãi/.test(t)) return 'DISCOUNT';
  if (/ebook|checklist|template|mẫu jd|tải miễn phí|báo cáo lương|salary (guide|report)|báo cáo miễn phí/.test(t)) return 'FREE_RESOURCE';
  if (/webinar|hội thảo|sự kiện|workshop|talkshow/.test(t)) return 'EVENT';
  if (/tư vấn miễn phí|free consultation|tư vấn 1:1/.test(t)) return 'FREE_CONSULTATION';
  if (/\bdemo\b/.test(t)) return 'DEMO';
  return 'NONE';
}

function extractOffer_(text) {
  var m = str_(text).match(/[^.!?\n]*(miễn phí|giảm|ưu đãi|bảo hành|hoàn phí|tặng|free|discount|guarantee)[^.!?\n]*/i);
  return m ? m[0].trim().slice(0, 200) : '';
}

function extractProof_(text) {
  var out = [];
  var re = /\d[\d.,]*\+?\s*(doanh nghiệp|khách hàng|đối tác|ứng viên|vị trí|năm kinh nghiệm|companies|clients|placements|years)/gi;
  var m;
  while ((m = re.exec(str_(text))) && out.length < 3) out.push(m[0].trim());
  if (/tin dùng|trusted by|giải thưởng|award|top \d/i.test(str_(text))) out.push('uy tín/giải thưởng');
  return out.join('; ');
}

function extractHook_(body) {
  var t = str_(body).trim();
  if (!t) return '';
  var m = t.match(/^[^.!?\n]{1,160}[.!?]?/);
  return (m ? m[0] : t.slice(0, 160)).trim();
}

/** Phân tích đầy đủ một bản ghi quảng cáo → cột *_auto của AD_ANALYSIS. */
function analyzeAd_(ad) {
  var body = str_(ad.body_text);
  var text = [body, ad.headline, ad.description, ad.cta_text].map(str_).join(' \n ');
  var landingPath = '';
  var lp = parseUrl_(ad.landing_url_raw || ad.landing_url);
  if (lp) landingPath = lp.path;
  var cta = ad.cta_normalized || normalizeCta_(ad.cta_text);
  var angles = classifyAngles_(text);
  return {
    hook_auto: extractHook_(body || ad.headline),
    pain_point_auto: classifyPain_(text),
    offer_auto: extractOffer_(text),
    offer_type_auto: offerType_(text),
    proof_auto: extractProof_(text),
    creative_angle_auto: angles.primary,
    secondary_angles_auto: angles.secondary.join(','),
    funnel_stage_auto: classifyFunnel_(text, cta, landingPath),
    framework_auto: detectFramework_(body),
    analysis_source: 'RULE'
  };
}

/** Giá trị hiệu lực: manual ưu tiên hơn auto. */
function effective_(row, field) {
  var manual = row[field + '_manual'];
  return isBlank_(manual) ? str_(row[field + '_auto']) : str_(manual);
}

/* ===================== Auth.gs ===================== */

/** Xác thực HMAC-SHA256: sig = hex(HMAC(secret_user, ts + "\n" + nonce + "\n" + payload)). */

var AUTH_WINDOW_SEC = 300;
var NONCE_TTL_SEC = 600;

function ApiError_(code, retryable, message) {
  this.code = code;
  this.retryable = !!retryable;
  this.message = message || code;
}

function apiErr_(code, retryable, message) {
  return new ApiError_(code, retryable, message);
}

function verifyAuth_(body) {
  var a = body.auth || {};
  if (!a.user_id || !a.sig || !a.nonce || !a.ts || typeof body.payload !== 'string') {
    throw apiErr_('AUTH_MISSING', false, 'Thiếu thông tin xác thực');
  }
  if (!/^[a-z0-9_\-]{2,40}$/i.test(a.user_id)) throw apiErr_('AUTH_UNKNOWN_USER', false);
  var secret = PropertiesService.getScriptProperties().getProperty('SECRET_' + a.user_id);
  if (!secret) throw apiErr_('AUTH_UNKNOWN_USER', false, 'Người dùng chưa được cấp quyền');
  var now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(a.ts)) > AUTH_WINDOW_SEC) throw apiErr_('AUTH_EXPIRED_TS', true, 'Đồng hồ máy lệch quá 5 phút');
  var expected = toHex_(Utilities.computeHmacSha256Signature(
    a.ts + '\n' + a.nonce + '\n' + body.payload, secret, Utilities.Charset.UTF_8));
  if (!constantTimeEq_(expected, String(a.sig).toLowerCase())) throw apiErr_('AUTH_INVALID_SIGNATURE', false, 'Chữ ký không hợp lệ');
  var cache = CacheService.getScriptCache();
  if (cache.get('nonce:' + a.nonce)) throw apiErr_('AUTH_REPLAY', false, 'Request bị gửi lặp');
  cache.put('nonce:' + a.nonce, '1', NONCE_TTL_SEC);
  return { user_id: a.user_id };
}

/** Tạo secret ngẫu nhiên 64 hex cho user (chạy từ menu). */
function generateSecret_() {
  return (Utilities.getUuid() + Utilities.getUuid()).replace(/-/g, '');
}

/* ===================== Repo.gs ===================== */

/** Truy cập sheet theo tên cột (không phụ thuộc thứ tự cột). */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function SheetRepo(name) {
  this.name = name;
  this.sheet = ss_().getSheetByName(name);
  if (!this.sheet) throw apiErr_('SHEET_MISSING', false, 'Thiếu sheet ' + name + '. Hãy chạy menu CAI → Khởi tạo.');
  var lastCol = this.sheet.getLastColumn();
  this.headers = lastCol ? this.sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  this.col = {};
  for (var i = 0; i < this.headers.length; i++) if (this.headers[i]) this.col[this.headers[i]] = i;
}

SheetRepo.prototype.lastRow = function () {
  return this.sheet.getLastRow();
};

/** Đọc toàn bộ dữ liệu thành object; mỗi object có _row (chỉ số hàng thật trong sheet). */
SheetRepo.prototype.readAll = function () {
  var n = this.lastRow() - 1;
  if (n <= 0 || !this.headers.length) return [];
  var values = this.sheet.getRange(2, 1, n, this.headers.length).getValues();
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var o = { _row: r + 2 };
    var empty = true;
    for (var c = 0; c < this.headers.length; c++) {
      o[this.headers[c]] = values[r][c];
      if (values[r][c] !== '' && values[r][c] !== null) empty = false;
    }
    if (!empty) out.push(o);
  }
  return out;
};

SheetRepo.prototype.toRow_ = function (obj, base) {
  var row = base ? base.slice() : this.headers.map(function () { return ''; });
  for (var k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k) || k === '_row') continue;
    var i = this.col[k];
    if (i === undefined) continue;
    var v = obj[k];
    if (v === null || v === undefined) v = '';
    else if (Array.isArray(v)) v = v.join(',');
    else if (typeof v === 'object' && !(v instanceof Date)) v = JSON.stringify(v);
    row[i] = safeCell_(v);
  }
  return row;
};

SheetRepo.prototype.append = function (objs) {
  if (!objs.length) return;
  var self = this;
  var rows = objs.map(function (o) { return self.toRow_(o); });
  this.sheet.getRange(this.lastRow() + 1, 1, rows.length, this.headers.length).setValues(rows);
};

/** Ghi đè các trường trong patch cho một hàng đã đọc trước đó (existing có đủ cột). */
SheetRepo.prototype.update = function (existing, patch) {
  // Giá trị đọc từ sheet đã mất dấu ' bảo vệ → phải bọc lại trước khi ghi cả hàng.
  var base = this.headers.map(function (h) { return existing[h] === undefined ? '' : safeCell_(existing[h]); });
  var row = this.toRow_(patch, base);
  this.sheet.getRange(existing._row, 1, 1, this.headers.length).setValues([row]);
  for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) existing[k] = patch[k];
};

/** Ghi lại toàn bộ vùng dữ liệu (dùng cho job tính lại hằng đêm). */
SheetRepo.prototype.rewriteAll = function (objs) {
  var n = this.lastRow() - 1;
  if (n > 0) this.sheet.getRange(2, 1, n, this.headers.length).clearContent();
  var self = this;
  if (!objs.length) return;
  var rows = objs.map(function (o) { return self.toRow_(o); });
  this.sheet.getRange(2, 1, rows.length, this.headers.length).setValues(rows);
};

/** Ghi lại một số cột cho các hàng đã đọc (theo _row), giữ nguyên các hàng khác. */
SheetRepo.prototype.writeColumns = function (rows, names) {
  var n = this.lastRow() - 1;
  if (n <= 0) return;
  var self = this;
  names.forEach(function (name) {
    var c = self.col[name];
    if (c === undefined) return;
    var range = self.sheet.getRange(2, c + 1, n, 1);
    var values = range.getValues();
    rows.forEach(function (r) {
      if (r._row >= 2 && r._row - 2 < n) {
        var v = r[name];
        values[r._row - 2][0] = v === null || v === undefined ? '' : safeCell_(v);
      }
    });
    range.setValues(values);
  });
};

function indexBy_(rows, key) {
  var m = {};
  rows.forEach(function (r) {
    var k = str_(r[key]);
    if (k && !m[k]) m[k] = r;
  });
  return m;
}

function nextSeq_(name) {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('SEQ_' + name) || '0') + 1;
  props.setProperty('SEQ_' + name, String(n));
  return n;
}

function pad_(n, w) {
  var s = String(n);
  while (s.length < w) s = '0' + s;
  return s;
}

/** Đọc CONFIG thành map key → value (string). */
function readConfig_() {
  var sh = ss_().getSheetByName('CONFIG');
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) out[String(r[0]).trim()] = str_(r[1]).trim();
  });
  return out;
}

function setConfigValue_(key, value) {
  var sh = ss_().getSheetByName('CONFIG');
  var n = sh.getLastRow();
  if (n >= 2) {
    var keys = sh.getRange(2, 1, n - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) { sh.getRange(i + 2, 2).setValue(value); return; }
    }
  }
  sh.appendRow([key, value, '']);
}

function cfgNum_(cfg, key, dflt) {
  var n = Number(cfg[key]);
  return isNaN(n) || cfg[key] === '' || cfg[key] === undefined ? dflt : n;
}

/* ===================== Schema.gs ===================== */

/** Validate payload từ Extension. Trả về mảng lỗi [{code, field, message}]. */

var AD_ENUMS = {
  source: ['META_AD_LIBRARY', 'LINKEDIN_AD_LIBRARY', 'GOOGLE_ATC', 'MANUAL'],
  is_active: ['ACTIVE', 'INACTIVE', 'UNKNOWN', ''],
  format: ['IMAGE', 'VIDEO', 'CAROUSEL', 'TEXT', 'DOCUMENT', 'EVENT', 'MESSAGE', 'SPOTLIGHT', 'DYNAMIC', 'UNKNOWN', ''],
  audience_side: ['EMPLOYER', 'CANDIDATE', 'UNKNOWN', '']
};

function schemaErr_(code, field, message) {
  return { code: code, field: field, message: message };
}

function checkEnum_(errors, r, field, allowed) {
  if (r[field] === undefined || r[field] === null) return;
  if (allowed.indexOf(String(r[field])) < 0) errors.push(schemaErr_('SCHEMA_BAD_ENUM', field, field + ' không hợp lệ: ' + r[field]));
}

function checkDate_(errors, r, field) {
  if (isBlank_(r[field])) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(r[field]))) errors.push(schemaErr_('SCHEMA_BAD_DATE', field, field + ' phải có dạng yyyy-MM-dd'));
}

function validateAd_(r) {
  var errors = [];
  if (!r || typeof r !== 'object') return [schemaErr_('SCHEMA_BAD_RECORD', '', 'Bản ghi không hợp lệ')];
  if (!r.ad_uid || !/^[a-z]+:[^\s]{1,200}$/.test(String(r.ad_uid))) errors.push(schemaErr_('SCHEMA_MISSING_FIELD', 'ad_uid', 'ad_uid thiếu hoặc sai định dạng'));
  var mode = r.mode || 'FULL';
  if (['FULL', 'TOUCH'].indexOf(mode) < 0) errors.push(schemaErr_('SCHEMA_BAD_ENUM', 'mode', 'mode phải là FULL hoặc TOUCH'));
  if (mode === 'FULL') {
    ['source', 'advertiser_name', 'ad_url', 'content_fp'].forEach(function (f) {
      if (isBlank_(r[f])) errors.push(schemaErr_('SCHEMA_MISSING_FIELD', f, f + ' là bắt buộc với mode FULL'));
    });
    if (r.content_fp && !/^[0-9a-f]{64}$/.test(String(r.content_fp))) errors.push(schemaErr_('SCHEMA_BAD_FORMAT', 'content_fp', 'content_fp phải là SHA-256 hex'));
    if (r.creative_fp && !/^[0-9a-f]{64}$/.test(String(r.creative_fp))) errors.push(schemaErr_('SCHEMA_BAD_FORMAT', 'creative_fp', 'creative_fp phải là SHA-256 hex'));
    if (isBlank_(r.body_text) && isBlank_(r.headline) && (!r.media_urls || !r.media_urls.length)) {
      errors.push(schemaErr_('SCHEMA_EMPTY_CONTENT', 'body_text', 'Cần ít nhất body, headline hoặc media'));
    }
    checkEnum_(errors, r, 'source', AD_ENUMS.source);
    checkEnum_(errors, r, 'format', AD_ENUMS.format);
    checkEnum_(errors, r, 'audience_side', AD_ENUMS.audience_side);
    if (r.rating !== undefined && r.rating !== null && r.rating !== '' && !(Number(r.rating) >= 1 && Number(r.rating) <= 5)) {
      errors.push(schemaErr_('SCHEMA_BAD_RANGE', 'rating', 'rating từ 1 đến 5'));
    }
  }
  checkEnum_(errors, r, 'is_active', AD_ENUMS.is_active);
  checkDate_(errors, r, 'start_date');
  checkDate_(errors, r, 'end_date');
  if (!isBlank_(r.seen_at) && isNaN(new Date(r.seen_at).getTime())) errors.push(schemaErr_('SCHEMA_BAD_DATE', 'seen_at', 'seen_at không hợp lệ'));
  ['ad_url', 'landing_url', 'landing_url_raw'].forEach(function (f) {
    if (!isBlank_(r[f]) && !/^https?:\/\//i.test(String(r[f]))) errors.push(schemaErr_('SCHEMA_BAD_FORMAT', f, f + ' phải là URL http(s)'));
  });
  return errors;
}

function validateLanding_(r) {
  var errors = [];
  if (!r || typeof r !== 'object') return [schemaErr_('SCHEMA_BAD_RECORD', '', 'Bản ghi không hợp lệ')];
  if (isBlank_(r.url) || !/^https?:\/\//i.test(String(r.url))) errors.push(schemaErr_('SCHEMA_MISSING_FIELD', 'url', 'url là bắt buộc'));
  if (r.content_hash && !/^[0-9a-f]{64}$/.test(String(r.content_hash))) errors.push(schemaErr_('SCHEMA_BAD_FORMAT', 'content_hash', 'content_hash phải là SHA-256 hex'));
  return errors;
}

function validateTrends_(p) {
  var errors = [];
  if (!p || !p.meta) return [schemaErr_('SCHEMA_MISSING_FIELD', 'meta', 'Thiếu meta')];
  if (isBlank_(p.meta.geo)) errors.push(schemaErr_('SCHEMA_MISSING_FIELD', 'meta.geo', 'Thiếu geo'));
  if (isBlank_(p.meta.timeframe)) errors.push(schemaErr_('SCHEMA_MISSING_FIELD', 'meta.timeframe', 'Thiếu timeframe'));
  if (!Array.isArray(p.series)) errors.push(schemaErr_('SCHEMA_MISSING_FIELD', 'series', 'Thiếu series'));
  (p.series || []).forEach(function (s, i) {
    if (isBlank_(s.keyword)) errors.push(schemaErr_('SCHEMA_MISSING_FIELD', 'series[' + i + '].keyword', 'Thiếu keyword'));
    (s.points || []).forEach(function (pt) {
      if (!Array.isArray(pt) || !/^\d{4}-\d{2}-\d{2}$/.test(String(pt[0])) || isNaN(Number(pt[1]))) {
        errors.push(schemaErr_('SCHEMA_BAD_FORMAT', 'series[' + i + '].points', 'Điểm phải có dạng [yyyy-MM-dd, số]'));
      }
    });
  });
  return errors.slice(0, 20);
}

/* ===================== Log.gs ===================== */

/** RUN_LOG: mỗi request ghi đúng một dòng. */

function writeRunLog_(ctx, source, found, summary, results, client) {
  var errors = (results || []).filter(function (r) { return r.status === 'REJECTED'; }).slice(0, 20).map(function (r) {
    return { client_id: r.client_id || r.record_id || null, errors: r.errors };
  });
  var status = summary.rejected === 0 ? 'SUCCESS' : (summary.rejected < summary.received ? 'PARTIAL' : 'FAILED');
  var now = new Date();
  new SheetRepo('RUN_LOG').append([{
    run_id: 'RUN-' + Utilities.formatDate(now, Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + (ctx.user ? ctx.user.user_id : 'system'),
    timestamp: now,
    request_id: ctx.request_id || '',
    action: ctx.action || '',
    source: source || '',
    collector: ctx.user ? ctx.user.user_id : '',
    found: found === undefined || found === null ? '' : Number(found),
    received: summary.received || 0,
    inserted: summary.inserted || 0,
    updated: summary.updated || 0,
    duplicates: (summary.touched || 0) + (summary.unchanged || 0),
    rejected: summary.rejected || 0,
    errors: errors.length ? truncate_(JSON.stringify(errors), 4000) : '',
    sync_status: status,
    duration_ms: Date.now() - (ctx.t0 || Date.now()),
    extension_version: client && client.extension_version ? client.extension_version : '',
    schema_version: SCHEMA_VERSION
  }]);
}

function logError_(body, code, message, t0) {
  var user = body && body.auth ? body.auth.user_id : '';
  writeRunLog_({ user: user ? { user_id: user } : null, request_id: body && body.request_id, action: body && body.action, t0: t0 },
    '', null, { received: 0, rejected: 1 }, [{ status: 'REJECTED', errors: [{ code: code, message: message }] }], {});
}

function logClient_(p, ctx) {
  var items = (p && p.errors) || [];
  writeRunLog_(ctx, (p && p.source) || 'EXTENSION', null, { received: items.length, rejected: items.length },
    items.slice(0, 20).map(function (e) { return { status: 'REJECTED', client_id: null, errors: [e] }; }), p && p.client);
  return { ok: true };
}

/* ===================== Upsert.gs ===================== */

/** Nghiệp vụ ghi dữ liệu. Mọi thao tác ghi RAW_ADS chạy trong ScriptLock. */

function withLock_(fn) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw apiErr_('LOCK_TIMEOUT', true, 'Hệ thống đang bận, thử lại sau');
  try {
    return fn();
  } finally {
    lock.releaseLock();
  }
}

function summarize_(results) {
  var s = { received: results.length, inserted: 0, updated: 0, touched: 0, rejected: 0, unchanged: 0 };
  results.forEach(function (r) {
    if (r.status === 'INSERTED' || r.status === 'INSERTED_SNAPSHOT') s.inserted++;
    else if (r.status === 'UPDATED') s.updated++;
    else if (r.status === 'TOUCHED') s.touched++;
    else if (r.status === 'UNCHANGED') s.unchanged++;
    else if (r.status === 'REJECTED') s.rejected++;
  });
  return s;
}

/* ---------------- Đối thủ ---------------- */

function resolveCompetitor_(comps, r, finalDomain, fallbackId) {
  var byId = indexBy_(comps, 'competitor_id');
  if (r.competitor_id && byId[r.competitor_id]) return byId[r.competitor_id];
  var advId = str_(r.advertiser_id).trim();
  if (advId) {
    for (var i = 0; i < comps.length; i++) {
      if (str_(comps[i].meta_page_id) === advId || str_(comps[i].google_advertiser_id) === advId) return comps[i];
    }
  }
  var name = slug_(r.advertiser_name);
  if (name) {
    for (var j = 0; j < comps.length; j++) {
      var c = comps[j];
      var names = [c.competitor_name, c.linkedin_company_name, c.google_advertiser_name].map(slug_).filter(String);
      for (var k = 0; k < names.length; k++) {
        if (names[k] === name || (names[k].length >= 5 && name.indexOf(names[k]) >= 0)) return c;
      }
    }
  }
  if (finalDomain) {
    for (var m = 0; m < comps.length; m++) {
      var doms = [comps[m].domain].concat(splitList_(comps[m].alt_domains)).map(function (d) { return registrableDomain_(d); });
      if (doms.indexOf(finalDomain) >= 0) return comps[m];
    }
  }
  if (fallbackId && byId[fallbackId]) return byId[fallbackId];
  return null;
}

/* ---------------- Quảng cáo ---------------- */

function buildAdFields_(r, context, comps, cfg) {
  var landing = normalizeLanding_(r.landing_url_raw || r.landing_url || '');
  var body = truncate_(r.body_text, MAX_TEXT);
  var comp = resolveCompetitor_(comps, r, landing.domain, context.competitor_id);
  var text = [body, r.headline, r.description, r.cta_text].map(str_).join(' ');
  var f = {
    native_ad_id: str_(r.native_ad_id),
    source: r.source,
    platforms: splitList_(r.platforms).join(','),
    competitor_id: comp ? comp.competitor_id : '',
    competitor_name: comp ? comp.competitor_name : '',
    advertiser_name: truncate_(r.advertiser_name, 200),
    advertiser_id: str_(r.advertiser_id),
    paid_for_by: truncate_(r.paid_for_by, 200),
    start_date: toDate_(r.start_date) || '',
    end_date: toDate_(r.end_date) || '',
    is_active: r.is_active || 'UNKNOWN',
    body_text: body,
    body_truncated: r.body_truncated ? true : false,
    headline: truncate_(r.headline, 500),
    description: truncate_(r.description, 1000),
    cta_text: truncate_(r.cta_text, 100),
    cta_normalized: r.cta_normalized || normalizeCta_(r.cta_text),
    format: r.format || 'UNKNOWN',
    media_urls: splitList_(r.media_urls).slice(0, 10).join(','),
    variant_count: Number(r.variant_count) || 1,
    ad_url: str_(r.ad_url),
    landing_url: r.landing_url_raw || r.landing_url ? landing.url : '',
    landing_url_raw: truncate_(r.landing_url_raw || r.landing_url, 2000),
    final_domain: landing.domain,
    utm_source: landing.utm.utm_source || '',
    utm_medium: landing.utm.utm_medium || '',
    utm_campaign: landing.utm.utm_campaign || '',
    utm_content: landing.utm.utm_content || '',
    country: str_(r.country || context.market || ''),
    language: str_(r.language),
    audience_side: r.audience_side || detectAudience_(text, parseUrl_(landing.url) ? parseUrl_(landing.url).path : ''),
    content_fp: str_(r.content_fp),
    creative_fp: str_(r.creative_fp),
    extract_confidence: r.extract_confidence === undefined ? '' : Number(r.extract_confidence),
    extractor_version: str_(r.extractor_version)
  };
  return f;
}

function derivedAdFields_(row, now, cfg) {
  var first = toDate_(row.first_seen_at) || now;
  var last = toDate_(row.last_seen_at) || first;
  var start = toDate_(row.start_date);
  var days;
  if (start) {
    var end = row.is_active === 'INACTIVE' ? (toDate_(row.end_date) || last) : now;
    days = Math.max(0, daysBetween_(start, end));
  } else {
    days = Math.max(0, daysBetween_(first, last));
  }
  var longDays = cfgNum_(cfg, 'long_running_days', 30);
  var minSight = cfgNum_(cfg, 'long_running_min_sightings', 3);
  var newDays = cfgNum_(cfg, 'new_ad_window_days', 7);
  return {
    run_days: days,
    is_long_running: days >= longDays && (!!start || Number(row.seen_count || 1) >= minSight),
    is_new_this_week: daysBetween_(first, now) < newDays,
    week_start: weekStart_(first)
  };
}

function touchPatch_(ex, r, seenAt) {
  var prevLast = toDate_(ex.last_seen_at);
  var patch = {
    last_seen_at: prevLast && prevLast > seenAt ? prevLast : seenAt,
    seen_count: Number(ex.seen_count || 1) + (prevLast && sameDay_(prevLast, seenAt) ? 0 : 1),
    tags: unionList_(ex.tags, r.tags)
  };
  if (r.is_active) patch.is_active = r.is_active;
  if (!isBlank_(r.end_date)) patch.end_date = toDate_(r.end_date);
  if (!isBlank_(r.start_date) && isBlank_(ex.start_date)) patch.start_date = toDate_(r.start_date);
  if (r.variant_count) patch.variant_count = Number(r.variant_count);
  if (r.media_urls && splitList_(r.media_urls).length) patch.media_urls = splitList_(r.media_urls).slice(0, 10).join(',');
  if (r.platforms && splitList_(r.platforms).length) patch.platforms = unionList_(ex.platforms, r.platforms);
  return patch;
}

function diffFields_(ex, fields) {
  var out = { fields: [], old: {}, 'new': {} };
  TRACKED_AD_FIELDS.forEach(function (f) {
    var a = str_(ex[f]).trim();
    var b = str_(fields[f]).trim();
    if (a !== b) {
      out.fields.push(f);
      out.old[f] = truncate_(a, 500);
      out['new'][f] = truncate_(b, 500);
    }
  });
  return out;
}

function manualPatch_(ex, r) {
  var patch = {};
  ['rating', 'notes', 'campaign_label', 'product'].forEach(function (f) {
    if (isBlank_(ex[f]) && !isBlank_(r[f])) patch[f] = f === 'rating' ? Number(r[f]) : truncate_(r[f], 1000);
  });
  return patch;
}

function analysisRow_(ad) {
  var a = analyzeAd_(ad);
  a.record_id = ad.record_id;
  a.competitor_name = ad.competitor_name;
  a.first_seen_at = ad.first_seen_at;
  a.audience_side = ad.audience_side;
  return a;
}

function upsertAds_(p, ctx) {
  var records = p && p.records;
  if (!Array.isArray(records) || !records.length) throw apiErr_('SCHEMA_MISSING_FIELD', false, 'records rỗng');
  if (records.length > MAX_BATCH) throw apiErr_('PAYLOAD_TOO_LARGE', true, 'Tối đa ' + MAX_BATCH + ' bản ghi mỗi lần');
  var context = p.context || {};
  var client = p.client || {};

  var out = withLock_(function () {
    var cfg = readConfig_();
    var now = new Date();
    var ads = new SheetRepo('RAW_ADS');
    var all = ads.readAll();
    var byUid = indexBy_(all, 'ad_uid');
    var byFp = indexBy_(all, 'content_fp');
    var byCreative = indexBy_(all, 'creative_fp');
    var comps = new SheetRepo('COMPETITORS').readAll();
    var analysis = new SheetRepo('AD_ANALYSIS');
    var anByRec = indexBy_(analysis.readAll(), 'record_id');
    var brand = registrableDomain_(cfg.brand_domain || '');
    var inserts = [];
    var anInserts = [];
    var history = [];
    var results = [];

    var applyPatch = function (target, patch) {
      if (target._row) ads.update(target, patch);
      else for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) target[k] = patch[k];
    };

    records.forEach(function (r) {
      var cid = r && r.client_id ? r.client_id : null;
      var errors = validateAd_(r);
      if (errors.length) {
        results.push({ client_id: cid, status: 'REJECTED', ad_uid: r && r.ad_uid, errors: errors });
        return;
      }
      var seenAt = r.seen_at ? new Date(r.seen_at) : now;
      var mode = r.mode || 'FULL';
      var ex = byUid[r.ad_uid];

      if (!ex && mode === 'TOUCH') {
        results.push({ client_id: cid, status: 'REJECTED', ad_uid: r.ad_uid,
          errors: [schemaErr_('NOT_FOUND', 'ad_uid', 'Chưa có quảng cáo này trên Sheet, cần gửi FULL')] });
        return;
      }

      if (ex && (mode === 'TOUCH' || str_(ex.content_fp) === r.content_fp)) {
        var tp = touchPatch_(ex, r, seenAt);
        tp.updated_at = now;
        var merged = Object.assign({}, ex, tp);
        Object.assign(tp, derivedAdFields_(merged, now, cfg));
        applyPatch(ex, tp);
        results.push({ client_id: cid, status: 'TOUCHED', record_id: ex.record_id, ad_uid: r.ad_uid,
          seen_count: ex.seen_count, is_long_running: ex.is_long_running });
        return;
      }

      var fields = buildAdFields_(r, context, comps, cfg);
      var tags = unionList_(r.tags, fields.final_domain && fields.final_domain === brand ? 'own-brand' : '');

      if (ex) {
        var diff = diffFields_(ex, fields);
        var vFrom = Number(ex.version || 1);
        var patch = Object.assign({}, fields, touchPatch_(ex, r, seenAt), manualPatch_(ex, r), {
          tags: unionList_(ex.tags, tags), version: vFrom + 1, change_flag: 'UPDATED', updated_at: now
        });
        Object.assign(patch, derivedAdFields_(Object.assign({}, ex, patch), now, cfg));
        history.push({
          history_id: 'HIS-' + pad_(nextSeq_('HISTORY'), 6), record_id: ex.record_id, ad_uid: ex.ad_uid,
          changed_at: now, version_from: vFrom, version_to: vFrom + 1, changed_fields: diff.fields.join(','),
          old_values_json: JSON.stringify(diff.old), new_values_json: JSON.stringify(diff['new']),
          collector: ctx.user.user_id
        });
        applyPatch(ex, patch);
        var anRow = analysisRow_(ex);
        if (anByRec[ex.record_id]) analysis.update(anByRec[ex.record_id], anRow);
        else { anInserts.push(anRow); anByRec[ex.record_id] = anRow; }
        results.push({ client_id: cid, status: 'UPDATED', record_id: ex.record_id, ad_uid: r.ad_uid, changed_fields: diff.fields });
        return;
      }

      var twinFp = byFp[fields.content_fp];
      var twin = twinFp || (fields.creative_fp ? byCreative[fields.creative_fp] : null);
      var flags = twinFp ? ['REPEATED_CREATIVE'] : (twin ? ['CREATIVE_REUSED_NEW_COPY'] : []);
      var row = Object.assign({}, fields, {
        record_id: 'RAD-' + pad_(nextSeq_('RECORD'), 6),
        ad_uid: r.ad_uid,
        first_seen_at: seenAt,
        last_seen_at: seenAt,
        seen_count: 1,
        product: truncate_(r.product || context.product || '', 200),
        campaign_label: truncate_(r.campaign_label || context.campaign_label || '', 200),
        collector: ctx.user.user_id,
        cluster_id: twin && twin.cluster_id ? twin.cluster_id : 'CL-' + pad_(nextSeq_('CLUSTER'), 5),
        version: 1,
        change_flag: 'NEW',
        tags: tags,
        rating: isBlank_(r.rating) ? '' : Number(r.rating),
        notes: truncate_(r.notes, 1000),
        created_at: now,
        updated_at: now
      });
      Object.assign(row, derivedAdFields_(row, now, cfg));
      inserts.push(row);
      byUid[row.ad_uid] = row;
      if (!byFp[row.content_fp]) byFp[row.content_fp] = row;
      if (row.creative_fp && !byCreative[row.creative_fp]) byCreative[row.creative_fp] = row;
      var an = analysisRow_(row);
      anInserts.push(an);
      anByRec[row.record_id] = an;
      results.push({ client_id: cid, status: 'INSERTED', record_id: row.record_id, ad_uid: row.ad_uid,
        cluster_id: row.cluster_id, competitor_id: row.competitor_id, flags: flags });
    });

    ads.append(inserts);
    analysis.append(anInserts);
    if (history.length) new SheetRepo('AD_HISTORY').append(history);
    SpreadsheetApp.flush();
    return results;
  });

  var summary = summarize_(out);
  var source = '';
  for (var i = 0; i < records.length; i++) if (records[i] && records[i].source) { source = records[i].source; break; }
  writeRunLog_(ctx, source, client.found_on_page, summary, out, client);
  return { ok: true, summary: summary, results: out };
}

/* ---------------- Index & Config cho Extension ---------------- */

function getIndex_(p, ctx) {
  p = p || {};
  var since = toDate_(p.since) || new Date(Date.now() - 180 * 86400000);
  var rows = new SheetRepo('RAW_ADS').readAll();
  var index = {};
  var count = 0;
  rows.forEach(function (r) {
    if (p.source && r.source !== p.source) return;
    var last = toDate_(r.last_seen_at);
    if (last && last < since) return;
    index[str_(r.ad_uid)] = { fp: str_(r.content_fp), last_seen_at: isoDate_(last), record_id: str_(r.record_id) };
    count++;
  });
  return { ok: true, count: count, index: index };
}

function getConfigForClient_(p, ctx) {
  var cfg = readConfig_();
  var comps = new SheetRepo('COMPETITORS').readAll()
    .filter(function (c) { return str_(c.tracking_status || 'TRACKING') === 'TRACKING'; })
    .map(function (c) {
      return {
        competitor_id: str_(c.competitor_id), competitor_name: str_(c.competitor_name), domain: str_(c.domain),
        alt_domains: splitList_(c.alt_domains), meta_page_id: str_(c.meta_page_id),
        google_advertiser_id: str_(c.google_advertiser_id), google_advertiser_name: str_(c.google_advertiser_name),
        linkedin_company_name: str_(c.linkedin_company_name), products: str_(c.products)
      };
    });
  var urls = new SheetRepo('SEARCH_URLS').readAll().map(function (u) {
    return {
      url_id: str_(u.url_id), competitor_id: str_(u.competitor_id), competitor_name: str_(u.competitor_name),
      platform: str_(u.platform), query_type: str_(u.query_type), query_value: str_(u.query_value),
      url: str_(u.url), last_opened_at: isoDate_(toDate_(u.last_opened_at))
    };
  });
  return {
    ok: true,
    user_id: ctx.user.user_id,
    business_name: cfg.business_name || '',
    brand_domain: cfg.brand_domain || '',
    focus_product: cfg.focus_product || '',
    markets: splitList_(cfg.markets || 'VN'),
    tags: splitList_(cfg.tags),
    competitors: comps,
    search_urls: urls,
    lists: LIST_VALUES,
    google_active_days: cfgNum_(cfg, 'google_active_days', 2),
    schema_version: SCHEMA_VERSION
  };
}

function markUrlOpened_(p, ctx) {
  var repo = new SheetRepo('SEARCH_URLS');
  var rows = repo.readAll();
  var ids = splitList_(p && p.url_ids);
  var n = 0;
  rows.forEach(function (r) {
    if (ids.indexOf(str_(r.url_id)) >= 0) {
      repo.update(r, { last_opened_at: new Date(), open_count: Number(r.open_count || 0) + 1 });
      n++;
    }
  });
  return { ok: true, updated: n };
}

/* ---------------- Landing page ---------------- */

var LP_TRACKED = ['page_title', 'h1', 'offer', 'primary_cta', 'price_points', 'form_fields', 'social_proof'];

function upsertLanding_(p, ctx) {
  var records = p && p.records;
  if (!Array.isArray(records) || !records.length) throw apiErr_('SCHEMA_MISSING_FIELD', false, 'records rỗng');
  if (records.length > MAX_BATCH) throw apiErr_('PAYLOAD_TOO_LARGE', true);
  var results = withLock_(function () {
    var repo = new SheetRepo('LANDING_PAGES');
    var all = repo.readAll();
    var comps = new SheetRepo('COMPETITORS').readAll();
    var now = new Date();
    var out = [];
    records.forEach(function (r) {
      var errors = validateLanding_(r);
      if (errors.length) { out.push({ client_id: r && r.client_id, status: 'REJECTED', errors: errors }); return; }
      var norm = normalizeLanding_(r.final_url || r.url);
      var prev = null;
      all.forEach(function (x) {
        if (str_(x.url_key) !== norm.key) return;
        if (!prev || toDate_(x.checked_at) > toDate_(prev.checked_at)) prev = x;
      });
      var comp = resolveCompetitor_(comps, { competitor_id: r.competitor_id }, norm.domain, null);
      var sections = r.section_hashes || {};
      var fields = {
        competitor_id: comp ? comp.competitor_id : str_(r.competitor_id),
        url: normalizeLanding_(r.url).url, url_key: norm.key, final_url: norm.url,
        page_title: truncate_(r.page_title, 300), meta_description: truncate_(r.meta_description, 500),
        h1: truncate_(r.h1, 300), offer: truncate_(r.offer, 300), primary_cta: truncate_(r.primary_cta, 100),
        secondary_ctas: splitList_(r.secondary_ctas).slice(0, 8).join(', '),
        social_proof: truncate_(r.social_proof, 500), form_present: !!r.form_present,
        form_fields: splitList_(r.form_fields).slice(0, 20).join(', '), pricing_visible: !!r.pricing_visible,
        price_points: splitList_(r.price_points).slice(0, 10).join(', '),
        funnel_stage: classifyFunnel_([r.page_title, r.h1, r.offer, r.primary_cta].concat(splitList_(r.secondary_ctas)).map(str_).join(' '),
          normalizeCta_(r.primary_cta), parseUrl_(norm.url) ? parseUrl_(norm.url).path : ''),
        utm: norm.utmString || normalizeLanding_(r.url).utmString, checked_at: r.checked_at ? new Date(r.checked_at) : now,
        url_status: r.url_status || 'OK', content_hash: str_(r.content_hash),
        section_hashes_json: JSON.stringify(sections), linked_ad_uids: splitList_(r.linked_ad_uids).join(','),
        collector: ctx.user.user_id
      };
      if (prev && str_(prev.content_hash) === fields.content_hash && fields.content_hash) {
        var lpPatch = { checked_at: fields.checked_at, url_status: fields.url_status,
          linked_ad_uids: unionList_(prev.linked_ad_uids, fields.linked_ad_uids) };
        if (prev._row > 0) repo.update(prev, lpPatch); else Object.assign(prev, lpPatch);
        out.push({ client_id: r.client_id, status: 'UNCHANGED', lp_snapshot_id: prev.lp_snapshot_id });
        return;
      }
      var changed = [];
      var summary = [];
      if (prev) {
        var prevSections = {};
        try { prevSections = JSON.parse(prev.section_hashes_json || '{}'); } catch (e) { prevSections = {}; }
        Object.keys(sections).forEach(function (k) { if (prevSections[k] !== sections[k]) changed.push(k); });
        LP_TRACKED.forEach(function (f) {
          var a = str_(prev[f]).trim();
          var b = str_(fields[f]).trim();
          if (a !== b) summary.push(f + ": '" + truncate_(a, 80) + "' → '" + truncate_(b, 80) + "'");
        });
      }
      fields.lp_snapshot_id = 'LPS-' + pad_(nextSeq_('LP'), 6);
      fields.changed_sections = changed.join(',');
      fields.change_summary = prev ? (summary.join(' | ') || 'Nội dung khác (không thuộc trường theo dõi)') : 'FIRST_SNAPSHOT';
      repo.append([fields]);
      fields._row = 0; // chưa có số hàng: chỉ cập nhật trong bộ nhớ
      all.push(fields);
      out.push({ client_id: r.client_id, status: 'INSERTED_SNAPSHOT', lp_snapshot_id: fields.lp_snapshot_id,
        changed_sections: changed, change_summary: fields.change_summary });
    });
    return out;
  });
  var summary = summarize_(results);
  writeRunLog_(ctx, 'LANDING_PAGE', records.length, summary, results, p.client || {});
  return { ok: true, summary: summary, results: results };
}

/* ---------------- Google Trends ---------------- */

function upsertTrends_(p, ctx) {
  var errors = validateTrends_(p);
  if (errors.length) return { ok: false, error: { code: 'SCHEMA_INVALID', message: errors[0].message, retryable: false, details: errors } };
  var meta = p.meta;
  var res = withLock_(function () {
    var repo = new SheetRepo('GOOGLE_TRENDS');
    var byId = indexBy_(repo.readAll(), 'trend_row_id');
    var now = new Date();
    var related = {};
    (p.related || []).forEach(function (r) { related[str_(r.keyword).toLowerCase()] = r; });
    var inserts = [];
    var ins = 0;
    var upd = 0;
    p.series.forEach(function (s) {
      var pts = (s.points || []).slice().sort(function (a, b) { return a[0] < b[0] ? -1 : 1; });
      var lastDate = pts.length ? pts[pts.length - 1][0] : '';
      var rel = related[str_(s.keyword).toLowerCase()];
      pts.forEach(function (pt) {
        var id = 'TRD-' + sha256Hex_([s.keyword, meta.geo, meta.timeframe, meta.batch_id || '', pt[0]].join('|').toLowerCase()).slice(0, 16);
        var fields = {
          trend_row_id: id, keyword: s.keyword, market: meta.geo, timeframe: meta.timeframe, batch_id: meta.batch_id || '',
          anchor_keyword: meta.anchor_keyword || '', point_date: toDate_(pt[0]), interest: Number(pt[1]),
          collected_at: now, source_url: meta.source_url || '', collection_method: meta.method || 'CSV_IMPORT',
          collector: ctx.user.user_id
        };
        if (rel && pt[0] === lastDate) {
          fields.related_queries_top = (rel.top || []).slice(0, 25).join('; ');
          fields.related_queries_rising = (rel.rising || []).slice(0, 25).join('; ');
        }
        if (byId[id]) {
          if (byId[id]._row) repo.update(byId[id], fields); else Object.assign(byId[id], fields);
          upd++;
        } else {
          inserts.push(fields);
          byId[id] = fields;
          ins++;
        }
      });
    });
    repo.append(inserts);
    return { points_inserted: ins, points_updated: upd };
  });
  writeRunLog_(ctx, 'GOOGLE_TRENDS', p.series.length, { received: p.series.length, inserted: res.points_inserted, updated: res.points_updated, touched: 0, rejected: 0 }, [], p.client || {});
  return { ok: true, summary: res };
}

/* ---------------- Phân tích thủ công ---------------- */

var ANALYSIS_WRITABLE = ['hook_manual', 'pain_point_manual', 'desire', 'value_proposition', 'offer_type_manual',
  'objection', 'creative_angle_manual', 'funnel_stage_manual', 'framework_manual', 'target_audience',
  'differentiation_level', 'learnings', 'copy_risk', 'reviewed_by', 'reviewed_at'];

function upsertAnalysis_(p, ctx) {
  var records = (p && p.records) || [];
  var results = withLock_(function () {
    var repo = new SheetRepo('AD_ANALYSIS');
    var byRec = indexBy_(repo.readAll(), 'record_id');
    return records.map(function (r) {
      var ex = byRec[str_(r.record_id)];
      if (!ex) return { record_id: r.record_id, status: 'REJECTED', errors: [schemaErr_('NOT_FOUND', 'record_id', 'Không tìm thấy record')] };
      var patch = {};
      Object.keys(r.fields || {}).forEach(function (k) {
        if (ANALYSIS_WRITABLE.indexOf(k) >= 0) patch[k] = truncate_(r.fields[k], 1000);
      });
      patch.reviewed_by = patch.reviewed_by || ctx.user.user_id;
      patch.reviewed_at = new Date();
      repo.update(ex, patch);
      return { record_id: r.record_id, status: 'UPDATED', fields: Object.keys(patch) };
    });
  });
  return { ok: true, summary: summarize_(results), results: results };
}

/* ===================== Jobs.gs ===================== */

/** Job tính lại hằng đêm: cột dẫn xuất, priority signal, Trends summary, OPPORTUNITIES, Dashboard. */

function nightlyRecompute() {
  withLock_(function () { recomputeAll_(new Date()); });
  refreshDashboard();
}

function recomputeAll_(now) {
  var cfg = readConfig_();
  var adsRepo = new SheetRepo('RAW_ADS');
  var ads = adsRepo.readAll();
  var googleDays = cfgNum_(cfg, 'google_active_days', 2);

  ads.forEach(function (a) {
    if (a.source === 'GOOGLE_ATC' && toDate_(a.end_date)) {
      a.is_active = daysBetween_(toDate_(a.end_date), now) <= googleDays ? 'ACTIVE' : 'INACTIVE';
    }
    Object.assign(a, derivedAdFields_(a, now, cfg));
  });
  adsRepo.writeColumns(ads, ['is_active', 'run_days', 'is_long_running', 'is_new_this_week', 'week_start']);

  // Thống kê đối thủ
  var compRepo = new SheetRepo('COMPETITORS');
  var comps = compRepo.readAll();
  comps.forEach(function (c) {
    var mine = ads.filter(function (a) { return str_(a.competitor_id) === str_(c.competitor_id); });
    c.ads_total = mine.length;
    c.ads_active = mine.filter(function (a) { return a.is_active === 'ACTIVE'; }).length;
    var last = null;
    mine.forEach(function (a) { var d = toDate_(a.last_seen_at); if (d && (!last || d > last)) last = d; });
    c.last_collected_at = last || '';
    if (isBlank_(c.domain) && c.website) c.domain = normalizeLanding_(c.website).domain;
  });
  compRepo.writeColumns(comps, ['ads_total', 'ads_active', 'last_collected_at', 'domain']);

  // Priority signal + đồng bộ ngữ cảnh sang AD_ANALYSIS
  var history = new SheetRepo('AD_HISTORY').readAll();
  var recentUpdate = {};
  history.forEach(function (h) {
    var d = toDate_(h.changed_at);
    if (d && daysBetween_(d, now) <= 14) recentUpdate[str_(h.record_id)] = true;
  });
  var lps = new SheetRepo('LANDING_PAGES').readAll();
  var invested = {};
  lps.forEach(function (l) {
    var yes = (l.form_present === true || l.form_present === 'TRUE') && !isBlank_(l.offer);
    if (yes) invested[str_(l.url_key)] = true;
  });
  var clusters = {};
  ads.forEach(function (a) {
    var k = str_(a.cluster_id);
    if (!clusters[k]) clusters[k] = { n: 0, families: {} };
    clusters[k].n++;
    clusters[k].families[sourceFamily_(a.source)] = true;
  });
  var anRepo = new SheetRepo('AD_ANALYSIS');
  var analysis = anRepo.readAll();
  var adByRec = indexBy_(ads, 'record_id');
  analysis.forEach(function (an) {
    var a = adByRec[str_(an.record_id)];
    if (!a) return;
    var cl = clusters[str_(a.cluster_id)] || { n: 1, families: {} };
    var lpKey = a.landing_url ? normalizeLanding_(a.landing_url).key : '';
    an.priority_signal = prioritySignal_({
      run_days: Number(a.run_days) || 0,
      variants: Math.max(Number(a.variant_count) || 1, cl.n),
      families: Object.keys(cl.families).length,
      active: a.is_active === 'ACTIVE',
      recent_update: !!recentUpdate[str_(a.record_id)],
      lp_invested: !!invested[lpKey]
    });
    an.competitor_name = a.competitor_name;
    an.first_seen_at = a.first_seen_at;
    an.audience_side = a.audience_side;
  });
  anRepo.writeColumns(analysis, ['priority_signal', 'competitor_name', 'first_seen_at', 'audience_side']);

  // Trends → KEYWORDS
  var trendSummary = trendsSummary_(new SheetRepo('GOOGLE_TRENDS').readAll());
  var kwRepo = new SheetRepo('KEYWORDS');
  var kws = kwRepo.readAll();
  kws.forEach(function (k) {
    var s = trendSummary[str_(k.keyword).toLowerCase()];
    k.latest_interest = s ? s.latest : '';
    k.momentum = s && s.momentum !== null ? Math.round(s.momentum * 1000) / 1000 : '';
    k.trend_direction = s ? s.direction : '';
  });
  kwRepo.writeColumns(kws, ['latest_interest', 'momentum', 'trend_direction']);

  rebuildOpportunities_(ads, analysis, comps, kws, cfg, now);
}

function sourceFamily_(source) {
  if (source === 'META_AD_LIBRARY') return 'META';
  if (source === 'LINKEDIN_AD_LIBRARY') return 'LINKEDIN';
  if (source === 'GOOGLE_ATC') return 'GOOGLE';
  return 'OTHER';
}

/** 0–100: tín hiệu đối thủ có vẻ ưu tiên (KHÔNG phải hiệu quả hay ngân sách). */
function prioritySignal_(x) {
  var s = 0;
  if (x.run_days >= 30) s += 30;
  if (x.run_days >= 60) s += 10;
  if (x.variants >= 3) s += 20;
  if (x.families >= 2) s += 15;
  if (x.active) s += 10;
  if (x.recent_update) s += 10;
  if (x.lp_invested) s += 5;
  return Math.min(100, s);
}

/** Tóm tắt Trends theo keyword: lấy nhóm (batch+timeframe) thu thập gần nhất, ưu tiên 12 tháng. */
function trendsSummary_(rows) {
  var groups = {};
  rows.forEach(function (r) {
    var kw = str_(r.keyword).toLowerCase();
    if (!kw) return;
    var g = kw + '|' + str_(r.batch_id) + '|' + str_(r.timeframe);
    if (!groups[g]) groups[g] = { kw: kw, timeframe: str_(r.timeframe), collected: null, points: [] };
    var c = toDate_(r.collected_at);
    if (c && (!groups[g].collected || c > groups[g].collected)) groups[g].collected = c;
    var d = toDate_(r.point_date);
    if (d) groups[g].points.push([d.getTime(), Number(r.interest) || 0]);
  });
  var best = {};
  Object.keys(groups).forEach(function (k) {
    var g = groups[k];
    var cur = best[g.kw];
    var score = function (x) { return (x.timeframe === 'today 12-m' ? 1e15 : 0) + (x.collected ? x.collected.getTime() : 0); };
    if (!cur || score(g) > score(cur)) best[g.kw] = g;
  });
  var out = {};
  Object.keys(best).forEach(function (kw) {
    var pts = best[kw].points.sort(function (a, b) { return a[0] - b[0]; }).map(function (p) { return p[1]; });
    var latest = pts.length ? pts[pts.length - 1] : '';
    var momentum = null;
    if (pts.length >= 8) {
      var recent = pts.slice(-4);
      var prev = pts.slice(Math.max(0, pts.length - 16), pts.length - 4);
      var avg = function (a) { return a.reduce(function (s, v) { return s + v; }, 0) / a.length; };
      if (prev.length && avg(prev) > 0) momentum = avg(recent) / avg(prev) - 1;
    }
    out[kw] = {
      latest: latest,
      momentum: momentum,
      direction: momentum === null ? '' : momentum >= 0.15 ? 'UP' : momentum <= -0.15 ? 'DOWN' : 'FLAT',
      series: pts.slice(-26)
    };
  });
  return out;
}

function rebuildOpportunities_(ads, analysis, comps, kws, cfg, now) {
  var repo = new SheetRepo('OPPORTUNITIES');
  var existing = indexBy_(repo.readAll(), 'angle');
  var adByRec = indexBy_(ads, 'record_id');
  var tracking = comps.filter(function (c) { return str_(c.tracking_status || 'TRACKING') === 'TRACKING'; }).length || 1;
  var weights = splitList_(cfg.score_weights || '0.25,0.25,0.20,0.30').map(Number);
  var usp = splitList_(cfg.usp_angles);
  var stats = {};
  var total = 0;
  analysis.forEach(function (an) {
    var a = adByRec[str_(an.record_id)];
    if (!a || a.audience_side === 'CANDIDATE' || /own-brand/.test(str_(a.tags))) return;
    var first = toDate_(a.first_seen_at);
    if (!first || daysBetween_(first, now) > 90) return;
    var angle = effective_(an, 'creative_angle');
    if (!angle || angle === 'UNCLASSIFIED') return;
    if (!stats[angle]) stats[angle] = { n: 0, comps: {}, longRun: 0, evidence: [] };
    var s = stats[angle];
    s.n++;
    total++;
    if (a.competitor_name) s.comps[a.competitor_name] = true;
    if (a.is_long_running === true || a.is_long_running === 'TRUE') s.longRun++;
    s.evidence.push([str_(a.record_id), Number(an.priority_signal) || 0]);
  });
  var angles = LIST_VALUES.angle.filter(function (x) { return x !== 'UNCLASSIFIED' && x !== 'CANDIDATE_JOB'; });
  var maxShare = 0;
  angles.forEach(function (ang) { if (stats[ang] && total) maxShare = Math.max(maxShare, stats[ang].n / total); });
  var kwMomentum = {};
  kws.forEach(function (k) {
    if (k.momentum === '' || k.momentum === null || isNaN(Number(k.momentum))) return;
    splitList_(k.mapped_angles).forEach(function (ang) {
      (kwMomentum[ang] = kwMomentum[ang] || []).push(Number(k.momentum));
    });
  });
  var rows = angles.map(function (ang) {
    var s = stats[ang] || { n: 0, comps: {}, longRun: 0, evidence: [] };
    var ex = existing[ang] || {};
    var share = total ? s.n / total : 0;
    var popularity = 0.5 * Object.keys(s.comps).length / tracking + 0.5 * Math.min(1, s.longRun / 3);
    var differentiation = Math.min(1, (maxShare ? 1 - share / maxShare : 1) + (usp.indexOf(ang) >= 0 ? 0.2 : 0));
    var mom = kwMomentum[ang];
    var trend = mom && mom.length ? Math.max(0, Math.min(1, mom.reduce(function (x, y) { return x + y; }, 0) / mom.length + 0.5)) : 0.5;
    var bf15 = Number(ex.brand_fit_1_5);
    var brandFit = bf15 >= 1 && bf15 <= 5 ? (bf15 - 1) / 4 : 0.5;
    var raw = weights[0] * popularity + weights[1] * differentiation + weights[2] * trend + weights[3] * brandFit;
    return {
      angle: ang,
      ads_count_90d: s.n,
      competitors_using: Object.keys(s.comps).length,
      share_of_ads: Math.round(share * 1000) / 1000,
      long_running_count: s.longRun,
      popularity: Math.round(popularity * 100) / 100,
      differentiation: Math.round(differentiation * 100) / 100,
      trend: Math.round(trend * 100) / 100,
      brand_fit_1_5: ex.brand_fit_1_5 === undefined ? '' : ex.brand_fit_1_5,
      brand_fit: Math.round(brandFit * 100) / 100,
      opportunity_score: Math.round((1 + 9 * raw) * 10) / 10,
      evidence_record_ids: s.evidence.sort(function (x, y) { return y[1] - x[1]; }).slice(0, 5).map(function (x) { return x[0]; }).join(', '),
      hypothesis: ex.hypothesis || '',
      status: ex.status || 'IDEA',
      owner: ex.owner || '',
      updated_at: now
    };
  }).sort(function (a, b) { return b.opportunity_score - a.opportunity_score; });
  repo.rewriteAll(rows);
}

/* ===================== Report.gs ===================== */

/** Dashboard + Báo cáo tuần: số liệu tính bằng JS rồi ghi giá trị (không phụ thuộc công thức phức tạp). */

var DISCLAIMER = 'Số lượng quảng cáo là mẫu công khai quan sát được, KHÔNG phản ánh ngân sách, hiệu quả hay ROAS. ' +
  'Chỉ số Google Trends là tương đối (0–100), không phải lượng tìm kiếm.';

function countBy_(items, keyFn) {
  var m = {};
  items.forEach(function (x) {
    var keys = keyFn(x);
    (Array.isArray(keys) ? keys : [keys]).forEach(function (k) {
      if (k === '' || k === null || k === undefined) return;
      m[k] = (m[k] || 0) + 1;
    });
  });
  return Object.keys(m).map(function (k) { return [k, m[k]]; }).sort(function (a, b) { return b[1] - a[1]; });
}

function isTrue_(v) {
  return v === true || v === 'TRUE' || v === 'true';
}

/** Tập số liệu dùng chung cho Dashboard và Báo cáo tuần. */
function buildStats_(now, opts) {
  opts = opts || {};
  var days = opts.days || 90;
  var ads = new SheetRepo('RAW_ADS').readAll();
  var analysis = new SheetRepo('AD_ANALYSIS').readAll();
  var anByRec = indexBy_(analysis, 'record_id');
  var lps = new SheetRepo('LANDING_PAGES').readAll();
  var trends = trendsSummary_(new SheetRepo('GOOGLE_TRENDS').readAll());
  var opps = new SheetRepo('OPPORTUNITIES').readAll();
  var comps = new SheetRepo('COMPETITORS').readAll();

  var scoped = ads.filter(function (a) {
    return a.audience_side !== 'CANDIDATE' && !/own-brand/.test(str_(a.tags));
  });
  var recent = scoped.filter(function (a) {
    var d = toDate_(a.first_seen_at);
    return d && daysBetween_(d, now) <= days;
  });
  var thisWeek = weekStart_(now);
  var lastWeek = new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() - 7);
  var inWeek = function (a, ws) {
    var d = toDate_(a.first_seen_at);
    return d && weekStart_(d).getTime() === ws.getTime();
  };
  var reportWeek = opts.reportWeekStart || thisWeek;
  var withAn = function (a) { return anByRec[str_(a.record_id)] || {}; };
  var angleOf = function (a) { return effective_(withAn(a), 'creative_angle'); };

  // QC mới theo tuần × đối thủ (12 tuần)
  var weeks = [];
  for (var i = 11; i >= 0; i--) weeks.push(new Date(thisWeek.getFullYear(), thisWeek.getMonth(), thisWeek.getDate() - 7 * i));
  var compCounts = countBy_(scoped, function (a) { return a.competitor_name || 'Chưa map'; });
  var topComps = compCounts.slice(0, 8).map(function (x) { return x[0]; });
  var weekly = weeks.map(function (w) {
    var row = [isoDate_(w)];
    var inW = scoped.filter(function (a) { return inWeek(a, w); });
    topComps.forEach(function (c) { row.push(inW.filter(function (a) { return (a.competitor_name || 'Chưa map') === c; }).length); });
    row.push(inW.filter(function (a) { return topComps.indexOf(a.competitor_name || 'Chưa map') < 0; }).length);
    return row;
  });

  var active = scoped.filter(function (a) { return a.is_active === 'ACTIVE'; });
  var longest = active.slice().sort(function (a, b) { return (Number(b.run_days) || 0) - (Number(a.run_days) || 0); }).slice(0, 10);
  var anglesCount = countBy_(recent, angleOf).filter(function (x) { return x[0] !== 'UNCLASSIFIED'; });
  var funnelByComp = {};
  recent.forEach(function (a) {
    var c = a.competitor_name || 'Chưa map';
    var f = effective_(withAn(a), 'funnel_stage') || 'UNCLASSIFIED';
    funnelByComp[c] = funnelByComp[c] || { TOFU: 0, MOFU: 0, BOFU: 0, UNCLASSIFIED: 0 };
    funnelByComp[c][f] = (funnelByComp[c][f] || 0) + 1;
  });
  var heatAngles = anglesCount.slice(0, 10).map(function (x) { return x[0]; });
  var heat = {};
  recent.forEach(function (a) {
    var c = a.competitor_name || 'Chưa map';
    heat[c] = heat[c] || { _total: 0 };
    heat[c]._total++;
    var ang = angleOf(a);
    heat[c][ang] = (heat[c][ang] || 0) + 1;
  });
  var lpChanges = lps.filter(function (l) {
    var d = toDate_(l.checked_at);
    return d && daysBetween_(d, now) <= (opts.lpDays || 14) && !isBlank_(l.change_summary) && l.change_summary !== 'FIRST_SNAPSHOT';
  });
  var trendRows = Object.keys(trends).map(function (k) {
    return [k, trends[k].latest, trends[k].momentum === null ? '' : Math.round(trends[k].momentum * 100) + '%', trends[k].direction];
  }).sort(function (a, b) { return (parseFloat(b[2]) || -999) - (parseFloat(a[2]) || -999); });
  var weekAds = scoped.filter(function (a) { return inWeek(a, reportWeek); });
  var priority = scoped.map(function (a) { return [a, Number(withAn(a).priority_signal) || 0]; })
    .filter(function (x) { return x[1] >= 40; })
    .sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10);
  var coverage = comps.filter(function (c) { return str_(c.tracking_status || 'TRACKING') === 'TRACKING'; }).map(function (c) {
    var d = toDate_(c.last_collected_at);
    return [str_(c.competitor_name), d ? isoDate_(d) : 'chưa thu thập', d ? daysBetween_(d, now) : ''];
  });

  return {
    now: now,
    kpi: {
      newThisWeek: scoped.filter(function (a) { return inWeek(a, thisWeek); }).length,
      newLastWeek: scoped.filter(function (a) { return inWeek(a, lastWeek); }).length,
      active: active.length,
      longRunning: active.filter(function (a) { return isTrue_(a.is_long_running); }).length,
      topCompetitor30d: (countBy_(scoped.filter(function (a) {
        var d = toDate_(a.first_seen_at); return d && daysBetween_(d, now) <= 30;
      }), function (a) { return a.competitor_name; })[0] || ['—', 0]),
      lpChanges7d: lps.filter(function (l) {
        var d = toDate_(l.checked_at);
        return d && daysBetween_(d, now) <= 7 && !isBlank_(l.change_summary) && l.change_summary !== 'FIRST_SNAPSHOT';
      }).length,
      keywordsUp: trendRows.filter(function (r) { return r[3] === 'UP'; }).length
    },
    weeklyHeader: ['Tuần'].concat(topComps).concat(['Khác']),
    weekly: weekly,
    platforms: countBy_(recent, function (a) { return splitList_(a.platforms).length ? splitList_(a.platforms) : [sourceFamily_(a.source)]; }),
    angles: anglesCount.map(function (x) { return [x[0], x[1], recent.length ? Math.round(100 * x[1] / recent.length) + '%' : '']; }),
    ctas: countBy_(recent, function (a) { return a.cta_normalized; }),
    offers: countBy_(recent, function (a) { return effective_(withAn(a), 'offer_type'); }).filter(function (x) { return x[0] !== 'NONE'; }),
    hooks: recent.filter(function (a) { return withAn(a).hook_auto || withAn(a).hook_manual; }).slice(-8).map(function (a) {
      return [a.competitor_name || '', effective_(withAn(a), 'hook'), a.record_id];
    }),
    longest: longest.map(function (a) {
      return [a.competitor_name || '', truncate_(a.headline || a.body_text, 90), isoDate_(toDate_(a.start_date) || toDate_(a.first_seen_at)), Number(a.run_days) || 0, a.ad_url, a.record_id];
    }),
    trends: trendRows,
    funnel: Object.keys(funnelByComp).map(function (c) {
      var f = funnelByComp[c]; return [c, f.TOFU, f.MOFU, f.BOFU, f.UNCLASSIFIED];
    }),
    heatHeader: ['Đối thủ'].concat(heatAngles),
    heat: Object.keys(heat).map(function (c) {
      return [c].concat(heatAngles.map(function (ang) { return heat[c]._total ? Math.round(100 * (heat[c][ang] || 0) / heat[c]._total) / 100 : 0; }));
    }),
    opportunities: opps.slice().sort(function (a, b) { return Number(b.opportunity_score) - Number(a.opportunity_score); }).slice(0, 8).map(function (o) {
      return [o.angle, Number(o.opportunity_score), Number(o.competitors_using), Number(o.popularity), Number(o.differentiation), Number(o.trend), Number(o.brand_fit), str_(o.evidence_record_ids)];
    }),
    gaps: opps.filter(function (o) { return Number(o.competitors_using) <= 1; })
      .sort(function (a, b) { return Number(b.opportunity_score) - Number(a.opportunity_score); }).slice(0, 5)
      .map(function (o) { return [o.angle, Number(o.opportunity_score), Number(o.competitors_using), Number(o.trend)]; }),
    lpChanges: lpChanges.map(function (l) {
      return [str_(l.competitor_id), str_(l.url), str_(l.changed_sections), truncate_(l.change_summary, 200), isoDate_(toDate_(l.checked_at))];
    }),
    newAds: weekAds.map(function (a) {
      var an = withAn(a);
      return [a.competitor_name || '', sourceFamily_(a.source), truncate_(a.headline || effective_(an, 'hook'), 80),
        effective_(an, 'creative_angle'), effective_(an, 'funnel_stage'), effective_(an, 'offer_type'),
        isoDate_(toDate_(a.start_date)), a.record_id, a.ad_url];
    }),
    priority: priority.map(function (x) {
      var a = x[0];
      return [a.competitor_name || '', truncate_(a.headline || a.body_text, 80), x[1],
        (Number(a.run_days) || 0) + ' ngày · ' + (Number(a.variant_count) || 1) + ' biến thể', a.record_id];
    }),
    coverage: coverage,
    totals: { ads: scoped.length, recent: recent.length, weekAds: weekAds.length }
  };
}

/* ---------------- Ghi bảng ---------------- */

function BlockWriter_(sheet) {
  this.sheet = sheet;
  this.row = 1;
  this.anchors = {};
}

BlockWriter_.prototype.title = function (text, note) {
  this.sheet.getRange(this.row, 1).setValue(text).setFontWeight('bold').setFontSize(12);
  if (note) this.sheet.getRange(this.row, 2).setValue(note).setFontColor('#666666');
  this.row++;
};

BlockWriter_.prototype.table = function (key, header, rows, emptyText) {
  var start = this.row;
  var width = header.length;
  this.sheet.getRange(this.row, 1, 1, width).setValues([header]).setFontWeight('bold').setBackground('#eef2f7');
  this.row++;
  if (!rows.length) {
    this.sheet.getRange(this.row, 1).setValue(emptyText || 'Chưa đủ dữ liệu').setFontColor('#999999');
    this.row++;
  } else {
    var norm = rows.map(function (r) {
      var out = r.slice(0, width);
      while (out.length < width) out.push('');
      return out.map(function (v) { return v === null || v === undefined ? '' : safeCell_(v); });
    });
    this.sheet.getRange(this.row, 1, norm.length, width).setValues(norm);
    this.row += norm.length;
  }
  this.anchors[key] = { row: start, rows: this.row - start, cols: width };
  this.row++;
};

function refreshDashboard() {
  var ss = ss_();
  var sh = ss.getSheetByName('DASHBOARD') || ss.insertSheet('DASHBOARD');
  var st = buildStats_(new Date());
  sh.clear();
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.setConditionalFormatRules([]);
  var w = new BlockWriter_(sh);
  var tz = Session.getScriptTimeZone();
  sh.getRange(1, 1).setValue('COMPETITOR AD INTEL — ' + (readConfig_().business_name || '') + ' · ' + (readConfig_().focus_product || ''))
    .setFontWeight('bold').setFontSize(14);
  sh.getRange(2, 1).setValue('Cập nhật: ' + Utilities.formatDate(st.now, tz, 'dd/MM/yyyy HH:mm') + ' · Phạm vi: 90 ngày, phía nhà tuyển dụng');
  sh.getRange(3, 1).setValue('ⓘ ' + DISCLAIMER).setFontColor('#a15c00');
  w.row = 5;
  w.table('kpi', ['QC mới tuần này', 'Tuần trước', 'QC đang active', 'Long-running (active)', 'Đối thủ nhiều QC mới nhất (30N)', 'LP thay đổi (7N)', 'Keyword tăng'],
    [[st.kpi.newThisWeek, st.kpi.newLastWeek, st.kpi.active, st.kpi.longRunning,
      st.kpi.topCompetitor30d[0] + ' (' + st.kpi.topCompetitor30d[1] + ')', st.kpi.lpChanges7d, st.kpi.keywordsUp]]);
  w.title('1. Quảng cáo mới theo tuần × đối thủ', '12 tuần gần nhất');
  w.table('weekly', st.weeklyHeader, st.weekly);
  w.title('2. Quảng cáo theo nền tảng (90 ngày)');
  w.table('platforms', ['Nền tảng', 'Số QC'], st.platforms);
  w.title('3. Creative angle phổ biến (90 ngày)');
  w.table('angles', ['Angle', 'Số QC', '% QC'], st.angles);
  w.title('4. CTA phổ biến');
  w.table('ctas', ['CTA', 'Số QC'], st.ctas);
  w.title('5. Offer phổ biến');
  w.table('offers', ['Offer type', 'Số QC'], st.offers);
  w.title('6. Quảng cáo chạy lâu nhất (đang active)');
  w.table('longest', ['Đối thủ', 'Headline/Nội dung', 'Bắt đầu', 'Số ngày', 'Link', 'record_id'], st.longest);
  w.title('7. Từ khóa Google Trends', 'momentum = TB 4 điểm gần / TB 12 điểm trước − 1');
  w.table('trends', ['Keyword', 'Điểm mới nhất', 'Momentum', 'Hướng'], st.trends, 'Chưa có dữ liệu Trends: import CSV từ Side Panel');
  w.title('8. Funnel mix theo đối thủ');
  w.table('funnel', ['Đối thủ', 'TOFU', 'MOFU', 'BOFU', 'Chưa phân loại'], st.funnel);
  w.title('9. Heatmap Đối thủ × Angle (% QC của đối thủ)');
  w.table('heat', st.heatHeader.length > 1 ? st.heatHeader : ['Đối thủ', '—'], st.heat);
  w.title('10. Cơ hội (OPPORTUNITIES)', 'Điểm 1–10 = popularity · differentiation · trend · brand fit');
  w.table('opps', ['Angle', 'Điểm', 'Số đối thủ dùng', 'P', 'D', 'T', 'B', 'Bằng chứng'], st.opportunities);
  w.title('11. Landing page thay đổi (14 ngày)');
  w.table('lp', ['Đối thủ', 'URL', 'Section đổi', 'Tóm tắt', 'Ngày'], st.lpChanges, 'Không có thay đổi được ghi nhận');
  w.title('12. Độ phủ thu thập', 'Đối thủ > 10 ngày chưa thu thập cần mở lại thư viện quảng cáo');
  w.table('coverage', ['Đối thủ', 'Thu thập gần nhất', 'Số ngày'], st.coverage);

  var a = w.anchors;
  var heat = a.heat;
  if (heat && heat.rows > 1 && heat.cols > 1) {
    var rule = SpreadsheetApp.newConditionalFormatRule()
      .setGradientMinpoint('#ffffff').setGradientMaxpoint('#2f6fb3')
      .setRanges([sh.getRange(heat.row + 1, 2, heat.rows - 1, heat.cols - 1)]).build();
    sh.setConditionalFormatRules([rule]);
    sh.getRange(heat.row + 1, 2, heat.rows - 1, heat.cols - 1).setNumberFormat('0%');
  }
  addChart_(sh, Charts.ChartType.COLUMN, a.weekly, 'QC mới theo tuần', 9, true);
  addChart_(sh, Charts.ChartType.BAR, a.platforms, 'QC theo nền tảng', 9, false);
  addChart_(sh, Charts.ChartType.BAR, a.angles, 'Creative angle', 9, false, 2);
  sh.setFrozenRows(3);
  sh.autoResizeColumns(1, 8);
}

function addChart_(sh, type, anchor, title, col, stacked, maxCols) {
  if (!anchor || anchor.rows < 2) return;
  var chart = sh.newChart().setChartType(type)
    .addRange(sh.getRange(anchor.row, 1, anchor.rows, maxCols || anchor.cols))
    .setNumHeaders(1)
    .setPosition(anchor.row, col, 0, 0)
    .setOption('title', title)
    .setOption('legend', { position: stacked ? 'right' : 'none' })
    .setOption('width', 620).setOption('height', 300);
  if (stacked) chart.setOption('isStacked', true);
  sh.insertChart(chart.build());
}

/* ---------------- Báo cáo tuần ---------------- */

function weeklyReport() {
  var now = new Date();
  var tws = weekStart_(now);
  var reportWeek = new Date(tws.getFullYear(), tws.getMonth(), tws.getDate() - 7); // báo cáo tuần vừa kết thúc
  withLock_(function () { recomputeAll_(now); });
  var st = buildStats_(now, { reportWeekStart: reportWeek, lpDays: 7 });
  var ss = ss_();
  var sh = ss.getSheetByName('WEEKLY_REPORT') || ss.insertSheet('WEEKLY_REPORT');
  sh.clear();
  var w = new BlockWriter_(sh);
  var tz = Session.getScriptTimeZone();
  var cfg = readConfig_();
  var endWeek = new Date(reportWeek.getFullYear(), reportWeek.getMonth(), reportWeek.getDate() + 6);
  var label = Utilities.formatDate(reportWeek, tz, 'dd/MM') + '–' + Utilities.formatDate(endWeek, tz, 'dd/MM/yyyy');
  w.title('BÁO CÁO CẠNH TRANH QUẢNG CÁO — ' + (cfg.focus_product || '') + ' — Tuần ' + label);
  w.title('Dữ liệu: ' + st.totals.ads + ' QC quan sát (phía nhà tuyển dụng), ' + st.totals.weekAds + ' QC mới trong tuần. ' + DISCLAIMER);
  w.row++;
  w.title('1. Quảng cáo mới phát hiện');
  w.table('new', ['Đối thủ', 'Nền tảng', 'Headline/Hook', 'Angle', 'Funnel', 'Offer', 'Ngày bắt đầu', 'record_id', 'Link'], st.newAds);
  w.title('2. Quảng cáo có khả năng đang được ưu tiên', 'Tín hiệu ưu tiên ≥ 40/100 — KHÔNG phải hiệu quả');
  w.table('priority', ['Đối thủ', 'Headline', 'Tín hiệu', 'Căn cứ', 'record_id'], st.priority);
  w.title('3. Hook · Offer · Creative angle xuất hiện nhiều (90 ngày)');
  w.table('angles', ['Angle', 'Số QC', '%'], st.angles.slice(0, 5));
  w.table('offers', ['Offer type', 'Số QC'], st.offers.slice(0, 5));
  w.table('hooks', ['Đối thủ', 'Hook', 'record_id'], st.hooks);
  w.title('4. Từ khóa Google Trends');
  w.table('trends', ['Keyword', 'Điểm mới nhất', 'Momentum', 'Hướng'], st.trends.slice(0, 10), 'Chưa có dữ liệu Trends');
  w.title('5. Thay đổi landing page (7 ngày)');
  w.table('lp', ['Đối thủ', 'URL', 'Section đổi', 'Tóm tắt', 'Ngày'], st.lpChanges, 'Không ghi nhận thay đổi');
  w.title('6. Khoảng trống thông điệp (≤ 1 đối thủ khai thác, xếp theo điểm cơ hội)');
  w.table('gaps', ['Angle', 'Điểm cơ hội', 'Số đối thủ dùng', 'Trend (0–1)'], st.gaps);
  w.title('7. Giả thuyết quảng cáo nên thử (Marketing điền — 5 đến 10 dòng)');
  w.table('hyp', ['#', 'Giả thuyết (Nếu… thì… vì…)', 'Insight/bằng chứng (record_id)', 'Kênh', 'Funnel', 'Chỉ số đo', 'Điểm'],
    st.opportunities.slice(0, 5).map(function (o, i) {
      return [i + 1, '', 'Angle ' + o[0] + ' · điểm ' + o[1] + ' · bằng chứng: ' + (o[7] || 'chưa có'), '', '', '', o[1]];
    }));
  w.title('8. Concept · Headline · CTA đề xuất (nguyên bản, không sao chép)');
  w.table('concepts', ['Angle', 'Big idea', 'Headline 1', 'Headline 2', 'CTA', 'Định dạng', 'Copy risk'], [['', '', '', '', '', '', 'LOW']]);
  sh.autoResizeColumns(1, 9);

  var to = splitList_(cfg.report_recipients).join(',');
  if (to) {
    var html = '<p><b>Báo cáo cạnh tranh quảng cáo — ' + label + '</b></p>' +
      '<ul><li>QC mới trong tuần: ' + st.totals.weekAds + '</li>' +
      '<li>QC đang active: ' + st.kpi.active + ' (long-running: ' + st.kpi.longRunning + ')</li>' +
      '<li>Keyword Trends tăng: ' + st.kpi.keywordsUp + '</li>' +
      '<li>Landing page thay đổi (7 ngày): ' + st.lpChanges.length + '</li></ul>' +
      '<p>Chi tiết và phần giả thuyết: <a href="' + ss.getUrl() + '#gid=' + sh.getSheetId() + '">mở WEEKLY_REPORT</a></p>' +
      '<p style="color:#888">' + DISCLAIMER + '</p>';
    MailApp.sendEmail({ to: to, subject: '[CAI] Báo cáo đối thủ tuần ' + label, htmlBody: html });
  }
  refreshDashboard();
}

/* ===================== Setup.gs ===================== */

/** Menu, khởi tạo Spreadsheet, dữ liệu mẫu, người dùng, URL tìm kiếm, trigger. */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('CAI')
    .addItem('1. Khởi tạo / sửa cấu trúc sheet', 'setup')
    .addItem('2. Tạo người dùng (cấp secret cho Extension)', 'createUser')
    .addItem('3. Tạo lại URL tìm kiếm', 'rebuildSearchUrls')
    .addSeparator()
    .addItem('Tính lại số liệu + Dashboard', 'nightlyRecompute')
    .addItem('Tạo báo cáo tuần ngay', 'weeklyReport')
    .addSeparator()
    .addItem('Cài lịch chạy tự động', 'installTriggers')
    .addItem('Thu hồi quyền người dùng', 'revokeUser')
    .addToUi();
}

/** Tạo/sửa tất cả sheet. Chạy lại an toàn: không xóa dữ liệu, chỉ thêm cột còn thiếu. */
function setup() {
  var ss = ss_();
  ss.setSpreadsheetTimeZone('Asia/Ho_Chi_Minh');
  Object.keys(SHEET_HEADERS).forEach(function (name) { ensureSheet_(ss, name, SHEET_HEADERS[name]); });
  ['DASHBOARD', 'WEEKLY_REPORT'].forEach(function (name) { if (!ss.getSheetByName(name)) ss.insertSheet(name); });

  Object.keys(TEXT_COLUMNS).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    TEXT_COLUMNS[name].forEach(function (col) {
      var i = headers.indexOf(col);
      if (i >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setNumberFormat('@');
    });
  });

  seedConfig_(ss);
  seedLists_(ss);
  seedCompetitors_(ss);
  seedKeywords_(ss);
  applyValidations_(ss);
  rebuildSearchUrls();

  var order = ['DASHBOARD', 'WEEKLY_REPORT', 'COMPETITORS', 'KEYWORDS', 'SEARCH_URLS', 'RAW_ADS', 'AD_ANALYSIS',
    'OPPORTUNITIES', 'LANDING_PAGES', 'GOOGLE_TRENDS', 'AD_HISTORY', 'RUN_LOG', 'CONFIG', 'LISTS'];
  order.forEach(function (name, i) {
    var sh = ss.getSheetByName(name);
    if (sh) { ss.setActiveSheet(sh); ss.moveActiveSheet(i + 1); }
  });
  var s1 = ss.getSheetByName('Sheet1') || ss.getSheetByName('Trang tính1');
  if (s1 && s1.getLastRow() === 0 && ss.getSheets().length > 1) ss.deleteSheet(s1);
  refreshDashboard();
  toast_('Đã khởi tạo xong. Bước tiếp: CAI → Tạo người dùng, rồi Deploy Web App.');
}

function ensureSheet_(ss, name, headers) {
  var sh = ss.getSheetByName(name) || ss.insertSheet(name);
  var lastCol = sh.getLastColumn();
  var current = lastCol ? sh.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var missing = headers.filter(function (h) { return current.indexOf(h) < 0; });
  if (missing.length) {
    sh.getRange(1, current.filter(String).length + 1, 1, missing.length).setValues([missing]);
  }
  var width = sh.getLastColumn();
  sh.getRange(1, 1, 1, width).setFontWeight('bold').setBackground('#1f3b57').setFontColor('#ffffff');
  sh.setFrozenRows(1);
  return sh;
}

function seedConfig_(ss) {
  var sh = ss.getSheetByName('CONFIG');
  var existing = {};
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues().forEach(function (r) { existing[r[0]] = true; });
  var rows = DEFAULT_CONFIG.filter(function (r) { return !existing[r[0]]; });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 3).setValues(rows);
}

function seedLists_(ss) {
  var sh = ss.getSheetByName('LISTS');
  var headers = SHEET_HEADERS.LISTS;
  var maxLen = 0;
  headers.forEach(function (h) { maxLen = Math.max(maxLen, (LIST_VALUES[h] || []).length); });
  var rows = [];
  for (var i = 0; i < maxLen; i++) rows.push(headers.map(function (h) { return (LIST_VALUES[h] || [])[i] || ''; }));
  if (sh.getLastRow() > 1) sh.getRange(2, 1, sh.getLastRow() - 1, headers.length).clearContent();
  if (rows.length) sh.getRange(2, 1, rows.length, headers.length).setValues(rows);
}

function seedCompetitors_(ss) {
  var repo = new SheetRepo('COMPETITORS');
  if (repo.readAll().length) return;
  repo.append(SEED_COMPETITORS.map(function (c, i) {
    return {
      competitor_id: 'CMP-' + pad_(i + 1, 3), competitor_name: c.competitor_name, website: c.website,
      domain: normalizeLanding_(c.website).domain, products: c.products, markets: 'VN', segment: c.segment,
      tracking_status: 'TRACKING', priority: c.priority, verified: false,
      linkedin_company_name: c.competitor_name,
      notes: 'Seed tự động: xác minh website, điền Meta Page ID / Google Advertiser ID'
    };
  }));
}

function seedKeywords_(ss) {
  var repo = new SheetRepo('KEYWORDS');
  if (repo.readAll().length) return;
  repo.append(SEED_KEYWORDS.map(function (k, i) {
    return {
      keyword_id: 'KW-' + pad_(i + 1, 3), keyword: k[0], keyword_group: k[1], language: k[2], market: 'VN',
      intent: k[3], mapped_angles: k[4], trends_batch: k[5], is_anchor: k[6], active: true
    };
  }));
}

function applyValidations_(ss) {
  var lists = ss.getSheetByName('LISTS');
  var listCol = function (name) {
    var i = SHEET_HEADERS.LISTS.indexOf(name) + 1;
    return lists.getRange(2, i, Math.max(1, (LIST_VALUES[name] || []).length), 1);
  };
  var rule = function (name) {
    return SpreadsheetApp.newDataValidation().requireValueInRange(listCol(name), true).setAllowInvalid(true).build();
  };
  var apply = function (sheetName, col, listName) {
    var sh = ss.getSheetByName(sheetName);
    var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
    var i = headers.indexOf(col);
    if (i >= 0) sh.getRange(2, i + 1, sh.getMaxRows() - 1, 1).setDataValidation(rule(listName));
  };
  apply('COMPETITORS', 'tracking_status', 'tracking_status');
  apply('COMPETITORS', 'segment', 'segment');
  apply('RAW_ADS', 'audience_side', 'audience_side');
  apply('RAW_ADS', 'format', 'format');
  apply('RAW_ADS', 'is_active', 'status');
  apply('AD_ANALYSIS', 'creative_angle_manual', 'angle');
  apply('AD_ANALYSIS', 'funnel_stage_manual', 'funnel');
  apply('AD_ANALYSIS', 'framework_manual', 'framework');
  apply('AD_ANALYSIS', 'offer_type_manual', 'offer_type');
  apply('AD_ANALYSIS', 'pain_point_manual', 'pain_point');
  apply('AD_ANALYSIS', 'copy_risk', 'copy_risk');
}

/* ---------------- URL tìm kiếm ---------------- */

function buildSearchUrls_(comps, kws, market) {
  var enc = encodeURIComponent;
  var urls = [];
  var add = function (c, platform, type, value, url) {
    urls.push({
      url_id: 'URL-' + sha256Hex_([platform, type, value, c ? c.competitor_id : ''].join('|')).slice(0, 10),
      competitor_id: c ? c.competitor_id : '', competitor_name: c ? c.competitor_name : '',
      platform: platform, market: market, query_type: type, query_value: value, url: url
    });
  };
  comps.filter(function (c) { return str_(c.tracking_status || 'TRACKING') === 'TRACKING'; }).forEach(function (c) {
    var pageId = str_(c.meta_page_id).trim();
    if (pageId) {
      add(c, 'META', 'PAGE', pageId, 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=' + market +
        '&view_all_page_id=' + enc(pageId) + '&search_type=page&media_type=all');
    } else {
      add(c, 'META', 'KEYWORD', c.competitor_name, 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=' + market +
        '&q=' + enc(c.competitor_name) + '&search_type=keyword_unordered&media_type=all');
    }
    var li = str_(c.linkedin_company_name || c.competitor_name).trim();
    add(c, 'LINKEDIN', 'ADVERTISER', li, 'https://www.linkedin.com/ad-library/search?accountOwner=' + enc(li));
    var adv = str_(c.google_advertiser_id).trim();
    var domain = str_(c.domain).trim() || normalizeLanding_(c.website).domain;
    if (adv) add(c, 'GOOGLE_ATC', 'ADVERTISER', adv, 'https://adstransparency.google.com/advertiser/' + enc(adv) + '?region=' + market);
    else if (domain) add(c, 'GOOGLE_ATC', 'DOMAIN', domain, 'https://adstransparency.google.com/?region=' + market + '&domain=' + enc(domain));
  });
  var active = kws.filter(function (k) { return isTrue_(k.active); });
  var seen = {};
  active.forEach(function (k) {
    var kw = str_(k.keyword).trim();
    if (!kw || seen[kw.toLowerCase()]) return;
    seen[kw.toLowerCase()] = true;
    add(null, 'META', 'KEYWORD', kw, 'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=' + market +
      '&q=' + enc(kw) + '&search_type=keyword_unordered&media_type=all');
  });
  var batches = {};
  active.forEach(function (k) {
    var b = str_(k.trends_batch).trim();
    if (b) (batches[b] = batches[b] || []).push(str_(k.keyword).trim());
  });
  Object.keys(batches).sort().forEach(function (b) {
    var list = batches[b].slice(0, 5);
    add(null, 'GOOGLE_TRENDS', 'TRENDS_BATCH', b + ': ' + list.join(', '),
      'https://trends.google.com/trends/explore?date=' + enc('today 12-m') + '&geo=' + market + '&hl=vi&q=' + list.map(enc).join(','));
  });
  return urls;
}

function rebuildSearchUrls() {
  var cfg = readConfig_();
  var market = splitList_(cfg.markets || 'VN')[0] || 'VN';
  var repo = new SheetRepo('SEARCH_URLS');
  var old = indexBy_(repo.readAll(), 'url_id');
  var urls = buildSearchUrls_(new SheetRepo('COMPETITORS').readAll(), new SheetRepo('KEYWORDS').readAll(), market);
  urls.forEach(function (u) {
    var o = old[u.url_id];
    u.last_opened_at = o ? o.last_opened_at : '';
    u.open_count = o ? o.open_count : 0;
  });
  repo.rewriteAll(urls);
}

/* ---------------- Người dùng ---------------- */

function createUser() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Tạo người dùng', 'Nhập user ID (chữ thường, số, _ ; ví dụ: u_linh)', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var userId = res.getResponseText().trim().toLowerCase();
  if (!/^[a-z0-9_\-]{2,40}$/.test(userId)) { ui.alert('User ID không hợp lệ'); return; }
  var secret = createUserSecret_(userId);
  ui.alert('Secret cho ' + userId,
    'Dán vào Options của Extension. Secret chỉ hiển thị MỘT lần:\n\n' + secret +
    '\n\nWeb App URL: Deploy → Manage deployments → copy URL /exec.', ui.ButtonSet.OK);
}

function createUserSecret_(userId) {
  var secret = generateSecret_();
  PropertiesService.getScriptProperties().setProperty('SECRET_' + userId, secret);
  var cfg = readConfig_();
  setConfigValue_('users', unionList_(cfg.users, userId));
  return secret;
}

function revokeUser() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Thu hồi quyền', 'Nhập user ID cần thu hồi', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var userId = res.getResponseText().trim().toLowerCase();
  PropertiesService.getScriptProperties().deleteProperty('SECRET_' + userId);
  var cfg = readConfig_();
  setConfigValue_('users', splitList_(cfg.users).filter(function (u) { return u !== userId; }).join(','));
  ui.alert('Đã thu hồi ' + userId);
}

/* ---------------- Trigger ---------------- */

function installTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (['nightlyRecompute', 'weeklyReport'].indexOf(t.getHandlerFunction()) >= 0) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('nightlyRecompute').timeBased().everyDays(1).atHour(2).create();
  ScriptApp.newTrigger('weeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(8).create();
  toast_('Đã cài: tính lại 02:00 hằng ngày, báo cáo 08:00–09:00 thứ Hai.');
}

function toast_(msg) {
  try { ss_().toast(msg, 'CAI', 8); } catch (e) { /* chạy ngoài UI */ }
}

/* ===================== Code.gs ===================== */

/**
 * Web App entry point. Apps Script không đọc được HTTP header và luôn trả HTTP 200,
 * nên xác thực nằm trong body và lỗi được báo qua { ok:false, error:{...} }.
 */

var ROUTES = {
  'health': { auth: false, fn: function () { return { ok: true, schema_version: SCHEMA_VERSION, time: new Date().toISOString() }; } },
  'config.get': { auth: true, fn: function (p, ctx) { return getConfigForClient_(p, ctx); } },
  'index.get': { auth: true, fn: function (p, ctx) { return getIndex_(p, ctx); } },
  'ads.upsert': { auth: true, fn: function (p, ctx) { return upsertAds_(p, ctx); } },
  'landing.upsert': { auth: true, fn: function (p, ctx) { return upsertLanding_(p, ctx); } },
  'trends.upsert': { auth: true, fn: function (p, ctx) { return upsertTrends_(p, ctx); } },
  'analysis.upsert': { auth: true, fn: function (p, ctx) { return upsertAnalysis_(p, ctx); } },
  'searchurl.opened': { auth: true, fn: function (p, ctx) { return markUrlOpened_(p, ctx); } },
  'log.client': { auth: true, fn: function (p, ctx) { return logClient_(p, ctx); } }
};

function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || 'health';
  if (action !== 'health') return json_(errBody_(null, 'USE_POST', false, 'Dùng POST cho action này'));
  return json_(ROUTES.health.fn());
}

function doPost(e) {
  var raw = e && e.postData ? e.postData.contents : '';
  if (raw.length > 1024 * 1024) return json_(errBody_(null, 'PAYLOAD_TOO_LARGE', true, 'Payload > 1MB'));
  var body;
  try {
    body = JSON.parse(raw);
  } catch (err) {
    return json_(errBody_(null, 'BAD_JSON', false, 'Body không phải JSON'));
  }
  return json_(route_(body));
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function errBody_(requestId, code, retryable, message) {
  return { ok: false, request_id: requestId || null, error: { code: code, message: message || code, retryable: !!retryable } };
}

function route_(body) {
  var route = ROUTES[body.action];
  if (!route) return errBody_(body.request_id, 'UNKNOWN_ACTION', false, 'Action không tồn tại: ' + body.action);
  if (Number(body.v || 1) !== SCHEMA_VERSION) return errBody_(body.request_id, 'SCHEMA_VERSION_UNSUPPORTED', false, 'Hãy cập nhật Extension');
  var t0 = Date.now();
  var cache = CacheService.getScriptCache();
  try {
    var ctx = { user: null, request_id: body.request_id || null, t0: t0, action: body.action };
    var payload = null;
    if (route.auth) {
      ctx.user = verifyAuth_(body);
      if (ctx.request_id) {
        var cached = cache.get('req:' + ctx.request_id);
        if (cached) return JSON.parse(cached);
      }
      try {
        payload = JSON.parse(body.payload);
      } catch (err) {
        throw apiErr_('BAD_JSON', false, 'payload không phải JSON');
      }
    }
    var res = route.fn(payload, ctx);
    res.request_id = ctx.request_id;
    res.action = body.action;
    res.server_time = new Date().toISOString();
    if (route.auth && ctx.request_id) {
      var s = JSON.stringify(res);
      if (s.length < 90000) cache.put('req:' + ctx.request_id, s, 21600);
    }
    return res;
  } catch (err) {
    var code = err && err.code ? err.code : 'INTERNAL';
    var retryable = err && err.code ? err.retryable : true;
    if (!/^AUTH_/.test(code)) {
      try { logError_(body, code, err && err.message ? err.message : String(err), t0); } catch (e2) { /* bỏ qua lỗi ghi log */ }
    }
    return errBody_(body.request_id, code, retryable, err && err.message ? err.message : String(err));
  }
}
