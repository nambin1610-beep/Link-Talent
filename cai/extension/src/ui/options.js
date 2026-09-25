import { Settings, IndexCache, SyncState } from '../shared/storage.js';

const $ = (id) => document.getElementById(id);
const show = (msg, isErr = false) => {
  const r = $('result');
  r.hidden = false;
  r.textContent = msg;
  r.className = 'hint' + (isErr ? ' err' : '');
};

async function load() {
  const s = await Settings.get();
  $('endpoint').value = s.endpoint || '';
  $('userId').value = s.userId || '';
  $('collector').value = s.collector || '';
  $('secret').value = s.secret || '';
  $('market').value = s.market || 'VN';
  $('visibleLimit').value = s.visibleLimit || 100;
}

async function save() {
  const endpoint = $('endpoint').value.trim();
  if (endpoint && !/^https:\/\/script\.google(usercontent)?\.com\/.+\/exec$/.test(endpoint)) {
    show('URL phải có dạng https://script.google.com/macros/s/…/exec', true);
    return false;
  }
  await Settings.set({
    endpoint,
    userId: $('userId').value.trim().toLowerCase(),
    collector: $('collector').value.trim(),
    secret: $('secret').value.trim(),
    market: $('market').value.trim() || 'VN',
    visibleLimit: Math.max(1, Math.min(200, Number($('visibleLimit').value) || 100))
  });
  show('Đã lưu.');
  return true;
}

$('btnSave').onclick = save;
$('btnTest').onclick = async () => {
  if (!(await save())) return;
  show('Đang kiểm tra…');
  const res = await chrome.runtime.sendMessage({ type: 'HEALTH' });
  if (res?.ok) show(`✅ Kết nối thành công với user ${res.user}. Đã tải ${res.competitors} đối thủ.`);
  else show('❌ ' + (res?.error?.message || res?.error?.code || 'Không kết nối được'), true);
};
$('btnSync').onclick = async () => {
  show('Đang đồng bộ…');
  const res = await chrome.runtime.sendMessage({ type: 'REFRESH_META' });
  show(res?.ok ? `✅ ${res.competitors} đối thủ, ${res.indexed} quảng cáo trong chỉ mục.` : '❌ Không đồng bộ được — kiểm tra kết nối', !res?.ok);
};
$('btnClear').onclick = async () => {
  if (!confirm('Xóa chỉ mục và danh mục đã cache? (Hàng đợi được giữ nguyên)')) return;
  await IndexCache.replace({});
  await chrome.storage.local.remove('cai_config');
  await SyncState.set({ status: 'UNCONFIGURED', message: '' });
  show('Đã xóa cache.');
};
load();
