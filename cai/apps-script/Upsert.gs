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
