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
