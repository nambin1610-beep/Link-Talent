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
