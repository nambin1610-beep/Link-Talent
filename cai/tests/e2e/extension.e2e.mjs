/**
 * E2E: nạp Extension thật vào Chromium, phục vụ fixture tại URL Meta Ad Library (route nội bộ,
 * không truy cập mạng thật), backend = Apps Script giả lập (tests/gas-harness.mjs) qua HTTP localhost.
 * Chạy: npm run test:e2e   (cần Playwright + Chromium; đặt CHROMIUM_PATH nếu không ở vị trí mặc định)
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createGas, post } from '../gas-harness.mjs';
import { landingExtract } from '../../extension/src/shared/landing-extract.js';

process.env.TZ = 'Asia/Ho_Chi_Minh';
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../..');
const EXT = path.join(ROOT, 'extension');
const OUT = process.env.E2E_OUT || path.join(ROOT, 'dist', 'e2e');

async function loadPlaywright() {
  try { return await import('playwright'); } catch {
    const req = createRequire(path.join(path.dirname(process.execPath), '../lib/node_modules/'));
    return req('playwright');
  }
}

function startBackend() {
  const gas = createGas();
  gas.g.setup();
  const secret = gas.g.createUserSecret_('u_e2e');
  const server = http.createServer((req, res) => {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' };
    if (req.method === 'GET') {
      res.writeHead(200, headers);
      res.end(gas.g.doGet({ parameter: Object.fromEntries(new URL(req.url, 'http://x').searchParams) }).content);
      return;
    }
    let body = '';
    req.on('data', (c) => { body += c; });
    req.on('end', () => {
      res.writeHead(200, headers);
      res.end(JSON.stringify(post(gas.g, body)));
    });
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve({ gas, secret, server, port: server.address().port })));
}

test('E2E: trang Meta → overlay → hàng đợi → gửi → RAW_ADS', { timeout: 120000 }, async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const { chromium } = await loadPlaywright();
  const backend = await startBackend();
  const userDir = fs.mkdtempSync(path.join(os.tmpdir(), 'cai-e2e-'));
  const ctx = await chromium.launchPersistentContext(userDir, {
    headless: true,
    executablePath: process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium',
    args: [`--disable-extensions-except=${EXT}`, `--load-extension=${EXT}`, '--no-sandbox'],
    viewport: { width: 1280, height: 900 }
  });
  try {
    const fixture = (f) => fs.readFileSync(path.join(ROOT, 'tests/fixtures', f), 'utf8');
    await ctx.route(/^https:\/\/www\.facebook\.com\/ads\/library\/.*/, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture('meta-library.html') }));
    await ctx.route(/^https:\/\/(www\.)?navigossearch\.com\/.*/, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fixture('landing.html') }));
    await ctx.route(/^https:\/\/scontent|^https:\/\/video\./, (r) => r.fulfill({ status: 404, body: '' }));

    let [sw] = ctx.serviceWorkers();
    if (!sw) sw = await ctx.waitForEvent('serviceworker');
    const extId = sw.url().split('/')[2];

    const ext = await ctx.newPage();
    await ext.goto(`chrome-extension://${extId}/src/ui/options.html`);
    await ext.evaluate(async ({ port, secret }) => {
      await chrome.storage.local.set({ cai_settings: { endpoint: `http://127.0.0.1:${port}/exec`, userId: 'u_e2e', secret, collector: 'E2E', market: 'VN', visibleLimit: 100 } });
    }, { port: backend.port, secret: backend.secret });

    const health = await ext.evaluate(() => chrome.runtime.sendMessage({ type: 'HEALTH' }));
    assert.equal(health.ok, true, JSON.stringify(health));
    assert.equal(health.competitors, 10);

    const page = await ctx.newPage();
    const url = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&view_all_page_id=112233&search_type=page';
    await page.goto(url);
    await page.waitForTimeout(1500);

    const state = await ext.evaluate(async () => {
      const [t] = await chrome.tabs.query({ url: 'https://www.facebook.com/*' });
      return { tabId: t.id, state: await chrome.tabs.sendMessage(t.id, { type: 'GET_STATE' }) };
    });
    assert.equal(state.state.source, 'META_AD_LIBRARY');
    assert.equal(state.state.found, 2);
    assert.equal(state.state.states.NEW, 2, JSON.stringify(state.state));
    await page.screenshot({ path: path.join(OUT, '1-meta-overlay.png') });

    const caps = await ext.evaluate((tabId) => chrome.tabs.sendMessage(tabId, { type: 'GET_ALL_VISIBLE', limit: 100 }), state.tabId);
    assert.equal(caps.captures.length, 2);
    const a = caps.captures.find((c) => c.native_ad_id === '1234567890123456');
    assert.equal(a.advertiser_name, 'Navigos Search');
    assert.equal(a.headline, 'Tuyển nhân sự cấp cao trong 30 ngày');
    assert.equal(a.cta_text, 'Liên hệ chúng tôi');
    assert.match(a.body_text, /Giám đốc tài chính\?/);

    const enq = await ext.evaluate((captures) => chrome.runtime.sendMessage({
      type: 'ENQUEUE', captures,
      context: { competitor_id: '', market: 'VN', product: 'Headhunt', campaign_label: 'Q4-2026 Headhunt', audience_side: 'AUTO', tags: ['headhunt'], notes: '', rating: '' }
    }), caps.captures);
    assert.equal(enq.ok, true);
    assert.equal(enq.queued, 2);
    assert.equal(enq.incomplete, 0);

    const panel = await ctx.newPage();
    await panel.setViewportSize({ width: 460, height: 1100 });
    await panel.goto(`chrome-extension://${extId}/src/ui/sidepanel.html`);
    await panel.waitForSelector('.item');
    assert.equal(await panel.locator('.item').count(), 2);
    await panel.screenshot({ path: path.join(OUT, '2-review-queue.png'), fullPage: false });

    const sent = await ext.evaluate(() => chrome.runtime.sendMessage({ type: 'SEND' }));
    assert.equal(sent.ok, true, JSON.stringify(sent));
    assert.equal(sent.summary.inserted, 2);
    const rows = backend.gas.ss.getSheetByName('RAW_ADS').objects();
    assert.equal(rows.length, 2);
    const nav = rows.find((r) => r.native_ad_id === '1234567890123456');
    assert.equal(nav.competitor_id, 'CMP-001');
    assert.equal(nav.landing_url, 'https://navigossearch.com/vi/executive-search');
    assert.equal(nav.start_date instanceof Date || typeof nav.start_date === 'object', true);
    assert.equal(nav.product, 'Headhunt');
    const queueLeft = await ext.evaluate(async () => Object.keys((await chrome.storage.local.get('cai_queue')).cai_queue || {}).length);
    assert.equal(queueLeft, 0);

    // Tải lại trang: overlay phải đánh dấu "Đã có"
    await page.reload();
    await page.waitForTimeout(1500);
    const again = await ext.evaluate((tabId) => chrome.tabs.sendMessage(tabId, { type: 'GET_STATE' }), state.tabId);
    assert.equal(again.states.KNOWN, 2, JSON.stringify(again));

    // Landing page: chạy hàm trích xuất thật trong Chromium (đúng hàm được executeScript)
    const lp = await ctx.newPage();
    await lp.goto('https://www.navigossearch.com/vi/executive-search?utm_source=facebook');
    const lpData = await lp.evaluate(`(${landingExtract.toString()})()`);
    assert.equal(lpData.h1, 'Tìm lãnh đạo phù hợp cho doanh nghiệp của bạn');
    assert.equal(lpData.primary_cta, 'Liên hệ tư vấn');
    assert.equal(lpData.form_present, true);
    assert.ok(lpData.form_fields.includes('Họ tên'));
    assert.ok(!JSON.stringify(lpData).includes('KHÔNG ĐƯỢC ĐỌC'), 'không đọc giá trị input');
    assert.match(lpData.offer, /miễn phí|Bảo hành/i);
    assert.match(lpData.social_proof, /5\.000\+ vị trí/);

    backend.gas.g.nightlyRecompute();
    fs.writeFileSync(path.join(OUT, 'raw_ads.json'), JSON.stringify(rows, null, 2));
  } finally {
    await ctx.close();
    backend.server.close();
  }
});
