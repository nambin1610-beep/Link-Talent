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
