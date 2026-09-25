/** Truy cập sheet theo tên cột (không phụ thuộc thứ tự cột). */

function ss_() {
  return SpreadsheetApp.getActiveSpreadsheet();
}

function SheetRepo(name) {
  this.name = name;
  this.sheet = ss_().getSheetByName(name);
  if (!this.sheet) throw apiErr_('SHEET_MISSING', false, 'Thiếu sheet ' + name + '. Hãy chạy menu CAI → Khởi tạo.');
  var lastCol = this.sheet.getLastColumn();
  this.headers = lastCol ? this.sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  this.col = {};
  for (var i = 0; i < this.headers.length; i++) if (this.headers[i]) this.col[this.headers[i]] = i;
}

SheetRepo.prototype.lastRow = function () {
  return this.sheet.getLastRow();
};

/** Đọc toàn bộ dữ liệu thành object; mỗi object có _row (chỉ số hàng thật trong sheet). */
SheetRepo.prototype.readAll = function () {
  var n = this.lastRow() - 1;
  if (n <= 0 || !this.headers.length) return [];
  var values = this.sheet.getRange(2, 1, n, this.headers.length).getValues();
  var out = [];
  for (var r = 0; r < values.length; r++) {
    var o = { _row: r + 2 };
    var empty = true;
    for (var c = 0; c < this.headers.length; c++) {
      o[this.headers[c]] = values[r][c];
      if (values[r][c] !== '' && values[r][c] !== null) empty = false;
    }
    if (!empty) out.push(o);
  }
  return out;
};

SheetRepo.prototype.toRow_ = function (obj, base) {
  var row = base ? base.slice() : this.headers.map(function () { return ''; });
  for (var k in obj) {
    if (!Object.prototype.hasOwnProperty.call(obj, k) || k === '_row') continue;
    var i = this.col[k];
    if (i === undefined) continue;
    var v = obj[k];
    if (v === null || v === undefined) v = '';
    else if (Array.isArray(v)) v = v.join(',');
    else if (typeof v === 'object' && !(v instanceof Date)) v = JSON.stringify(v);
    row[i] = safeCell_(v);
  }
  return row;
};

SheetRepo.prototype.append = function (objs) {
  if (!objs.length) return;
  var self = this;
  var rows = objs.map(function (o) { return self.toRow_(o); });
  this.sheet.getRange(this.lastRow() + 1, 1, rows.length, this.headers.length).setValues(rows);
};

/** Ghi đè các trường trong patch cho một hàng đã đọc trước đó (existing có đủ cột). */
SheetRepo.prototype.update = function (existing, patch) {
  // Giá trị đọc từ sheet đã mất dấu ' bảo vệ → phải bọc lại trước khi ghi cả hàng.
  var base = this.headers.map(function (h) { return existing[h] === undefined ? '' : safeCell_(existing[h]); });
  var row = this.toRow_(patch, base);
  this.sheet.getRange(existing._row, 1, 1, this.headers.length).setValues([row]);
  for (var k in patch) if (Object.prototype.hasOwnProperty.call(patch, k)) existing[k] = patch[k];
};

/** Ghi lại toàn bộ vùng dữ liệu (dùng cho job tính lại hằng đêm). */
SheetRepo.prototype.rewriteAll = function (objs) {
  var n = this.lastRow() - 1;
  if (n > 0) this.sheet.getRange(2, 1, n, this.headers.length).clearContent();
  var self = this;
  if (!objs.length) return;
  var rows = objs.map(function (o) { return self.toRow_(o); });
  this.sheet.getRange(2, 1, rows.length, this.headers.length).setValues(rows);
};

/** Ghi lại một số cột cho các hàng đã đọc (theo _row), giữ nguyên các hàng khác. */
SheetRepo.prototype.writeColumns = function (rows, names) {
  var n = this.lastRow() - 1;
  if (n <= 0) return;
  var self = this;
  names.forEach(function (name) {
    var c = self.col[name];
    if (c === undefined) return;
    var range = self.sheet.getRange(2, c + 1, n, 1);
    var values = range.getValues();
    rows.forEach(function (r) {
      if (r._row >= 2 && r._row - 2 < n) {
        var v = r[name];
        values[r._row - 2][0] = v === null || v === undefined ? '' : safeCell_(v);
      }
    });
    range.setValues(values);
  });
};

function indexBy_(rows, key) {
  var m = {};
  rows.forEach(function (r) {
    var k = str_(r[key]);
    if (k && !m[k]) m[k] = r;
  });
  return m;
}

function nextSeq_(name) {
  var props = PropertiesService.getScriptProperties();
  var n = Number(props.getProperty('SEQ_' + name) || '0') + 1;
  props.setProperty('SEQ_' + name, String(n));
  return n;
}

function pad_(n, w) {
  var s = String(n);
  while (s.length < w) s = '0' + s;
  return s;
}

/** Đọc CONFIG thành map key → value (string). */
function readConfig_() {
  var sh = ss_().getSheetByName('CONFIG');
  var out = {};
  if (!sh || sh.getLastRow() < 2) return out;
  sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues().forEach(function (r) {
    if (r[0]) out[String(r[0]).trim()] = str_(r[1]).trim();
  });
  return out;
}

function setConfigValue_(key, value) {
  var sh = ss_().getSheetByName('CONFIG');
  var n = sh.getLastRow();
  if (n >= 2) {
    var keys = sh.getRange(2, 1, n - 1, 1).getValues();
    for (var i = 0; i < keys.length; i++) {
      if (String(keys[i][0]) === key) { sh.getRange(i + 2, 2).setValue(value); return; }
    }
  }
  sh.appendRow([key, value, '']);
}

function cfgNum_(cfg, key, dflt) {
  var n = Number(cfg[key]);
  return isNaN(n) || cfg[key] === '' || cfg[key] === undefined ? dflt : n;
}
