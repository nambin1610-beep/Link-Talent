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
