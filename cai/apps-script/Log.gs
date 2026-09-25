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
