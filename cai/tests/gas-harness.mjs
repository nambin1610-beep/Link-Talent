/**
 * Giả lập tối thiểu môi trường Google Apps Script (SpreadsheetApp, Utilities, PropertiesService…)
 * để chạy các file .gs bằng Node. Chỉ mô phỏng hành vi mà code CAI dùng.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const GAS_DIR = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../apps-script');

/** Đối tượng "cái gì cũng gọi được": trả lại chính nó (cho API định dạng/chart/validation). */
function chain(extra = {}) {
  const target = { ...extra };
  const p = new Proxy(target, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'then') return undefined;
      return () => p;
    }
  });
  return p;
}

function toSigned(buf) {
  return Array.from(buf).map((b) => (b > 127 ? b - 256 : b));
}

class MockRange {
  constructor(sheet, r, c, nr, nc) { Object.assign(this, { sheet, r, c, nr, nc }); }
  getValues() {
    const out = [];
    for (let i = 0; i < this.nr; i++) {
      const row = [];
      for (let j = 0; j < this.nc; j++) row.push(this.sheet.read(this.r + i, this.c + j));
      out.push(row);
    }
    return out;
  }
  getValue() { return this.sheet.read(this.r, this.c); }
  setValues(v) {
    if (v.length !== this.nr || v.some((row) => row.length !== this.nc)) {
      throw new Error(`setValues: kích thước ${v.length}x${v[0]?.length} ≠ range ${this.nr}x${this.nc}`);
    }
    v.forEach((row, i) => row.forEach((val, j) => this.sheet.write(this.r + i, this.c + j, val)));
    return this;
  }
  setValue(val) { this.sheet.write(this.r, this.c, val); return this; }
  clearContent() {
    for (let i = 0; i < this.nr; i++) for (let j = 0; j < this.nc; j++) this.sheet.write(this.r + i, this.c + j, '');
    return this;
  }
}
for (const m of ['setNumberFormat', 'setFontWeight', 'setFontSize', 'setFontColor', 'setBackground', 'setDataValidation']) {
  MockRange.prototype[m] = function () { return this; };
}

class MockSheet {
  constructor(name, id) { this.name = name; this.id = id; this.cells = []; this.charts = []; }
  read(r, c) {
    const v = this.cells[r - 1]?.[c - 1];
    if (v === undefined || v === null) return '';
    // Sheets ẩn dấu ' bảo vệ khi đọc lại
    if (typeof v === 'string' && v.startsWith("'")) return v.slice(1);
    return v;
  }
  raw(r, c) { return this.cells[r - 1]?.[c - 1]; }
  write(r, c, v) {
    if (!this.cells[r - 1]) this.cells[r - 1] = [];
    this.cells[r - 1][c - 1] = v;
  }
  getName() { return this.name; }
  getSheetId() { return this.id; }
  getLastRow() {
    for (let i = this.cells.length - 1; i >= 0; i--) if ((this.cells[i] || []).some((v) => v !== '' && v !== undefined && v !== null)) return i + 1;
    return 0;
  }
  getLastColumn() {
    let m = 0;
    this.cells.forEach((row) => (row || []).forEach((v, j) => { if (v !== '' && v !== undefined && v !== null) m = Math.max(m, j + 1); }));
    return m;
  }
  getMaxRows() { return Math.max(1000, this.cells.length); }
  getRange(r, c, nr = 1, nc = 1) {
    if (typeof r === 'string') return new MockRange(this, 1, 1, 1, 1);
    if (r < 1 || c < 1 || nr < 1 || nc < 1) throw new Error(`getRange không hợp lệ (${r},${c},${nr},${nc})`);
    return new MockRange(this, r, c, nr, nc);
  }
  appendRow(arr) { const r = this.getLastRow() + 1; arr.forEach((v, j) => this.write(r, j + 1, v)); }
  clear() { this.cells = []; }
  getCharts() { return this.charts.slice(); }
  removeChart(c) { this.charts = this.charts.filter((x) => x !== c); }
  newChart() { return chain({ build: () => ({ chart: true }) }); }
  insertChart(c) { this.charts.push(c); }
  setFrozenRows() {}
  autoResizeColumns() {}
  setConditionalFormatRules() {}
  /** Tiện cho test: đọc sheet thành object theo header. */
  objects() {
    const n = this.getLastRow();
    const w = this.getLastColumn();
    if (n < 2) return [];
    const h = this.getRange(1, 1, 1, w).getValues()[0];
    return this.getRange(2, 1, n - 1, w).getValues().map((row) => Object.fromEntries(h.map((k, i) => [k, row[i]])));
  }
}

class MockSpreadsheet {
  constructor() { this.sheets = []; this.seq = 1; this.toasts = []; }
  getSheetByName(n) { return this.sheets.find((s) => s.name === n) || null; }
  insertSheet(n) { const s = new MockSheet(n, this.seq++); this.sheets.push(s); return s; }
  getSheets() { return this.sheets.slice(); }
  deleteSheet(s) { this.sheets = this.sheets.filter((x) => x !== s); }
  setActiveSheet(s) { this.active = s; return s; }
  moveActiveSheet() {}
  setSpreadsheetTimeZone() {}
  toast(m) { this.toasts.push(m); }
  getUrl() { return 'https://docs.google.com/spreadsheets/d/TEST'; }
}

function fmtDate(d, _tz, f) {
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return f.replace('yyyy', d.getFullYear()).replace('MM', p(d.getMonth() + 1)).replace('dd', p(d.getDate()))
    .replace('HH', p(d.getHours())).replace('mm', p(d.getMinutes())).replace('ss', p(d.getSeconds()));
}

export function createGas({ order = 'alpha' } = {}) {
  const ss = new MockSpreadsheet();
  ss.insertSheet('Sheet1');
  const props = new Map();
  const cache = new Map();
  const mails = [];
  const uiLog = [];
  const sandbox = {
    console,
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ss,
      flush: () => {},
      newDataValidation: () => chain(),
      newConditionalFormatRule: () => chain(),
      getUi: () => ({
        prompt: () => ({ getSelectedButton: () => 'OK', getResponseText: () => sandbox.__promptAnswer || 'u_test' }),
        alert: (...a) => uiLog.push(a),
        Button: { OK: 'OK' },
        ButtonSet: { OK_CANCEL: 1, OK: 0 },
        createMenu: () => chain()
      })
    },
    Utilities: {
      DigestAlgorithm: { SHA_256: 'sha256' },
      Charset: { UTF_8: 'utf8' },
      computeDigest: (alg, s) => toSigned(crypto.createHash('sha256').update(String(s), 'utf8').digest()),
      computeHmacSha256Signature: (v, k) => toSigned(crypto.createHmac('sha256', Buffer.from(k, 'utf8')).update(String(v), 'utf8').digest()),
      getUuid: () => crypto.randomUUID(),
      formatDate: fmtDate
    },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k) => (props.has(k) ? props.get(k) : null),
        setProperty: (k, v) => { props.set(k, String(v)); },
        deleteProperty: (k) => { props.delete(k); }
      })
    },
    CacheService: {
      getScriptCache: () => ({ get: (k) => (cache.has(k) ? cache.get(k) : null), put: (k, v) => { cache.set(k, v); } })
    },
    LockService: { getScriptLock: () => ({ tryLock: () => true, waitLock: () => {}, releaseLock: () => {} }) },
    ContentService: {
      MimeType: { JSON: 'json' },
      createTextOutput: (s) => ({ content: s, setMimeType() { return this; } })
    },
    Session: { getScriptTimeZone: () => 'Asia/Ho_Chi_Minh' },
    MailApp: { sendEmail: (o) => mails.push(o) },
    ScriptApp: { getProjectTriggers: () => [], deleteTrigger: () => {}, newTrigger: () => chain(), WeekDay: { MONDAY: 'MONDAY' } },
    Charts: { ChartType: { COLUMN: 'COLUMN', BAR: 'BAR', LINE: 'LINE' } }
  };
  const ctx = vm.createContext(sandbox);
  let files = fs.readdirSync(GAS_DIR).filter((f) => f.endsWith('.gs')).sort();
  if (order === 'reverse') files = files.reverse();
  for (const f of files) vm.runInContext(fs.readFileSync(path.join(GAS_DIR, f), 'utf8'), ctx, { filename: f });
  return { g: ctx, ss, props, cache, mails, uiLog };
}

/** Gọi doPost như Web App thật, trả về object JSON. */
export function post(g, body) {
  const out = g.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } });
  return JSON.parse(out.content);
}
