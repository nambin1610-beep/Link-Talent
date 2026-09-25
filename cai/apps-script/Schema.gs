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
