/** Gộp mọi file .gs thành một file để dán vào Apps Script (Extensions → Apps Script → Code.gs). */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const SRC = path.join(ROOT, 'apps-script');
const ORDER = ['Config.gs', 'Utils.gs', 'Rules.gs', 'Auth.gs', 'Repo.gs', 'Schema.gs', 'Log.gs', 'Upsert.gs', 'Jobs.gs', 'Report.gs', 'Setup.gs', 'Code.gs'];

export function bundle() {
  const files = fs.readdirSync(SRC).filter((f) => f.endsWith('.gs'));
  const missing = files.filter((f) => !ORDER.includes(f));
  if (missing.length) throw new Error('Thêm vào ORDER: ' + missing.join(', '));
  const header = '/**\n * CAI – Competitor Ad Intelligence · Apps Script (bản gộp một file)\n' +
    ' * TỰ SINH từ cai/apps-script/*.gs bằng `npm run bundle` — không sửa tay file này.\n */\n';
  return header + ORDER.map((f) => `\n/* ===================== ${f} ===================== */\n\n` + fs.readFileSync(path.join(SRC, f), 'utf8')).join('');
}

if (process.argv[1] === new URL(import.meta.url).pathname) {
  const out = path.join(ROOT, 'apps-script-bundle', 'CAI.gs');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  fs.writeFileSync(out, bundle());
  console.log('Đã ghi', path.relative(ROOT, out));
}
