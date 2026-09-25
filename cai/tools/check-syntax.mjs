/** Kiểm tra cú pháp .gs/.js và manifest (mọi file được tham chiếu phải tồn tại). */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
let errors = 0;
const walk = (d) => fs.readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]));

for (const f of walk(path.join(ROOT, 'apps-script')).filter((f) => f.endsWith('.gs'))) {
  try { new vm.Script(fs.readFileSync(f, 'utf8'), { filename: f }); } catch (e) { errors++; console.error('✗', f, e.message); }
}
for (const f of walk(path.join(ROOT, 'extension')).filter((f) => f.endsWith('.js'))) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); } catch (e) { errors++; console.error('✗', f, String(e.stderr)); }
}
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'extension/manifest.json'), 'utf8'));
const refs = [manifest.background.service_worker, manifest.side_panel.default_path, manifest.options_page, manifest.action.default_popup,
  ...Object.values(manifest.icons), ...manifest.content_scripts.flatMap((c) => c.js)];
for (const r of refs) if (!fs.existsSync(path.join(ROOT, 'extension', r))) { errors++; console.error('✗ manifest tham chiếu file không tồn tại:', r); }
JSON.parse(fs.readFileSync(path.join(ROOT, 'apps-script/appsscript.json'), 'utf8'));
console.log(errors ? `${errors} lỗi` : 'OK: cú pháp .gs/.js và manifest hợp lệ');
process.exit(errors ? 1 : 0);
