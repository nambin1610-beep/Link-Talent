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
