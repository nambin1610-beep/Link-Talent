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
