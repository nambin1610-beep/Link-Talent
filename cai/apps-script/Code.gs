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
