import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createGas, post } from './gas-harness.mjs';
import { signRequest } from '../extension/src/shared/api.js';
import { normalizeCapture, fingerprint, toWire } from '../extension/src/shared/normalize.js';

process.env.TZ = 'Asia/Ho_Chi_Minh';

function boot() {
  const env = createGas();
  env.g.setup();
  const secret = env.g.createUserSecret_('u_test');
  const creds = { userId: 'u_test', secret };
  const call = async (action, payload, opts = {}) => {
    const body = await signRequest(creds, action, payload, opts.requestId, opts.ts);
    if (opts.mutate) opts.mutate(body);
    return post(env.g, body);
  };
  return { ...env, creds, call, sheet: (n) => env.ss.getSheetByName(n) };
}

async function makeAd(overrides = {}, context = {}) {
  const cap = {
    client_id: 'c_' + Math.random().toString(36).slice(2, 8),
    source: 'META_AD_LIBRARY',
    page_url: 'https://www.facebook.com/ads/library/?country=VN&view_all_page_id=111',
    captured_at: '2026-09-25T09:41:03+07:00',
    native_ad_id: '1234567890123456',
    advertiser_name: 'Navigos Search',
    advertiser_id: '',
    status_raw: 'Active',
    start_date_raw: 'Started running on 2 Sep 2026',
    platforms_raw: ['Facebook', 'Instagram'],
    body_text: 'Bạn đang mất hàng tháng để tuyển Giám đốc tài chính? Tuyển sai người khiến doanh nghiệp thiệt hại lớn. Dịch vụ headhunt giúp bạn tiếp cận ứng viên thụ động cấp cao. Liên hệ tư vấn ngay.',
    headline: 'Tuyển nhân sự cấp cao trong 30 ngày',
    description: 'navigossearch.com',
    cta_text: 'Liên hệ chúng tôi',
    format_raw: 'IMAGE',
    media: [{ type: 'image', url: 'https://scontent.xx.fbcdn.net/v/t39/123_abc_n.jpg?oe=AAA&_nc=1' }],
    variant_count: 3,
    ad_url: 'https://www.facebook.com/ads/library/?id=1234567890123456',
    landing_url_raw: 'https://l.facebook.com/l.php?u=' + encodeURIComponent('https://www.navigossearch.com/vi/dich-vu?utm_source=facebook&utm_campaign=exec&fbclid=XYZ'),
    country_filter: 'VN',
    extractor_version: 'meta@test',
    ...overrides
  };
  const config = { competitors: [{ competitor_id: 'CMP-001', competitor_name: 'Navigos Search', domain: 'navigossearch.com', alt_domains: [] }] };
  return fingerprint(normalizeCapture(cap, context, config));
}

test('nạp .gs theo mọi thứ tự không lỗi (không phụ thuộc thứ tự file)', () => {
  const a = createGas({ order: 'alpha' });
  const b = createGas({ order: 'reverse' });
  assert.equal(typeof a.g.doPost, 'function');
  assert.equal(typeof b.g.doPost, 'function');
});

test('setup tạo đủ sheet, seed đối thủ headhunt, từ khóa, URL tìm kiếm; chạy lại không nhân đôi', () => {
  const { g, ss } = createGas();
  g.setup();
  for (const n of ['CONFIG', 'LISTS', 'COMPETITORS', 'KEYWORDS', 'SEARCH_URLS', 'RAW_ADS', 'AD_HISTORY', 'AD_ANALYSIS',
    'GOOGLE_TRENDS', 'LANDING_PAGES', 'OPPORTUNITIES', 'RUN_LOG', 'DASHBOARD', 'WEEKLY_REPORT']) {
    assert.ok(ss.getSheetByName(n), 'thiếu sheet ' + n);
  }
  const comps = ss.getSheetByName('COMPETITORS').objects();
  assert.equal(comps.length, 10);
  assert.equal(comps[0].competitor_name, 'Navigos Search');
  assert.equal(comps[0].domain, 'navigossearch.com');
  const urls = ss.getSheetByName('SEARCH_URLS').objects();
  assert.ok(urls.some((u) => u.platform === 'GOOGLE_ATC' && u.url === 'https://adstransparency.google.com/?region=VN&domain=navigossearch.com'));
  assert.ok(urls.some((u) => u.platform === 'GOOGLE_TRENDS' && u.url.includes('q=headhunter,')));
  assert.ok(urls.some((u) => u.platform === 'META' && u.query_value === 'dịch vụ headhunt'));
  g.setup();
  assert.equal(ss.getSheetByName('COMPETITORS').objects().length, 10);
  assert.equal(ss.getSheetByName('SEARCH_URLS').objects().length, urls.length);
  assert.equal(ss.getSheetByName('CONFIG').objects().filter((r) => r.key === 'brand_domain').length, 1);
});

test('health qua doGet; body sai JSON; action lạ', () => {
  const { g } = createGas();
  assert.equal(JSON.parse(g.doGet({ parameter: {} }).content).ok, true);
  assert.equal(post(g, '{not json').error.code, 'BAD_JSON');
  assert.equal(post(g, { v: 1, action: 'x.y' }).error.code, 'UNKNOWN_ACTION');
});

test('xác thực: sai chữ ký, hết hạn, replay, user lạ', async () => {
  const t = boot();
  const bad = await t.call('config.get', {}, { mutate: (b) => { b.auth.sig = '0'.repeat(64); } });
  assert.equal(bad.error.code, 'AUTH_INVALID_SIGNATURE');
  const old = await t.call('config.get', {}, { ts: Math.floor(Date.now() / 1000) - 3600 });
  assert.equal(old.error.code, 'AUTH_EXPIRED_TS');
  assert.equal(old.error.retryable, true);
  const body = await signRequest(t.creds, 'config.get', {});
  assert.equal(post(t.g, body).ok, true);
  assert.equal(post(t.g, body).error.code, 'AUTH_REPLAY', 'gửi lại y nguyên (cùng nonce) bị chặn');
  const other = await signRequest({ userId: 'u_nobody', secret: 'x' }, 'config.get', {});
  assert.equal(post(t.g, other).error.code, 'AUTH_UNKNOWN_USER');
  assert.equal(t.sheet('RAW_ADS').objects().length, 0);
});

test('config.get trả đối thủ, URL, danh mục cho Extension', async () => {
  const t = boot();
  const res = await t.call('config.get', {});
  assert.equal(res.ok, true);
  assert.equal(res.competitors.length, 10);
  assert.ok(res.search_urls.length > 10);
  assert.ok(res.lists.angle.includes('GUARANTEE'));
  assert.equal(res.focus_product, 'Headhunt / Executive Search');
});

test('upsert: INSERT → TOUCH → UPDATE (lịch sử) → giữ trường nhập tay', async () => {
  const t = boot();
  const ad = await makeAd({}, { tags: ['headhunt'], rating: 4, notes: 'hook câu hỏi' });
  assert.equal(ad.ad_uid, 'meta:1234567890123456');
  assert.equal(ad.landing_url, 'https://navigossearch.com/vi/dich-vu');
  assert.equal(ad.competitor_id, 'CMP-001');

  const r1 = await t.call('ads.upsert', { client: { found_on_page: 14, extension_version: 't' }, records: [toWire(ad)] });
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.equal(r1.summary.inserted, 1);
  let rows = t.sheet('RAW_ADS').objects();
  assert.equal(rows.length, 1);
  const row = rows[0];
  assert.equal(row.record_id, 'RAD-000001');
  assert.equal(row.native_ad_id, '1234567890123456', 'ID dài giữ dạng chuỗi');
  assert.equal(row.competitor_name, 'Navigos Search');
  assert.equal(row.final_domain, 'navigossearch.com');
  assert.equal(row.utm_campaign, 'exec');
  assert.equal(row.audience_side, 'EMPLOYER');
  assert.equal(row.cta_normalized, 'CONTACT');
  assert.equal(row.platforms, 'FACEBOOK,INSTAGRAM');
  assert.equal(row.change_flag, 'NEW');
  assert.equal(row.rating, 4);
  const an = t.sheet('AD_ANALYSIS').objects()[0];
  assert.equal(an.record_id, 'RAD-000001');
  assert.equal(an.funnel_stage_auto, 'BOFU');
  assert.equal(an.framework_auto, 'PAS');
  assert.ok(['SLOW_HIRING', 'BAD_HIRE'].includes(an.pain_point_auto), an.pain_point_auto);
  assert.ok(['SENIOR_TALENT', 'PASSIVE_NETWORK'].includes(an.creative_angle_auto), an.creative_angle_auto);
  const log = t.sheet('RUN_LOG').objects();
  assert.equal(log.length, 1);
  assert.equal(log[0].inserted, 1);
  assert.equal(log[0].found, 14);
  assert.equal(log[0].sync_status, 'SUCCESS');

  // Gửi lại cùng nội dung, cùng ngày → TOUCHED, seen_count giữ 1
  const r2 = await t.call('ads.upsert', { records: [toWire(ad)] });
  assert.equal(r2.results[0].status, 'TOUCHED');
  assert.equal(t.sheet('RAW_ADS').objects()[0].seen_count, 1);
  // Ngày hôm sau → seen_count 2
  const r3 = await t.call('ads.upsert', { records: [toWire({ ...ad, seen_at: '2026-09-26T10:00:00+07:00' }, 'TOUCH')] });
  assert.equal(r3.results[0].status, 'TOUCHED');
  assert.equal(t.sheet('RAW_ADS').objects()[0].seen_count, 2);

  // Người dùng sửa tay trên Sheet
  const sh = t.sheet('RAW_ADS');
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  sh.getRange(2, h.indexOf('notes') + 1).setValue('ghi chú tay');

  // Đối thủ đổi headline → UPDATED + AD_HISTORY
  const changed = await makeAd({ headline: 'Headhunt C-level: shortlist trong 14 ngày' }, { tags: ['c-level'], notes: 'không được ghi đè' });
  const r4 = await t.call('ads.upsert', { records: [toWire(changed)] });
  assert.equal(r4.results[0].status, 'UPDATED');
  assert.deepEqual(r4.results[0].changed_fields, ['headline']);
  rows = t.sheet('RAW_ADS').objects();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].version, 2);
  assert.equal(rows[0].headline, 'Headhunt C-level: shortlist trong 14 ngày');
  assert.equal(rows[0].notes, 'ghi chú tay');
  assert.equal(rows[0].tags, 'headhunt,c-level');
  assert.equal(rows[0].change_flag, 'UPDATED');
  const hist = t.sheet('AD_HISTORY').objects();
  assert.equal(hist.length, 1);
  assert.equal(hist[0].changed_fields, 'headline');
  assert.match(hist[0].old_values_json, /30 ngày/);
  assert.equal(t.sheet('AD_ANALYSIS').objects().length, 1, 'không nhân đôi dòng phân tích');
});

test('creative lặp lại: cùng nội dung khác ad_uid → cùng cluster, cờ REPEATED_CREATIVE', async () => {
  const t = boot();
  const a = await makeAd();
  const b = await makeAd({ native_ad_id: '999000111222333' });
  const res = await t.call('ads.upsert', { records: [toWire(a), toWire(b)] });
  assert.equal(res.summary.inserted, 2);
  assert.deepEqual(res.results[1].flags, ['REPEATED_CREATIVE']);
  assert.equal(res.results[0].cluster_id, res.results[1].cluster_id);
  const c = await makeAd({ native_ad_id: '555', body_text: 'Nội dung hoàn toàn khác về dịch vụ tuyển dụng quản lý cấp trung.' });
  const res2 = await t.call('ads.upsert', { records: [toWire(c)] });
  assert.deepEqual(res2.results[0].flags, ['CREATIVE_REUSED_NEW_COPY'], 'cùng ảnh, khác copy');
});

test('batch có bản ghi lỗi → PARTIAL; TOUCH cho QC chưa có → REJECTED; trùng trong batch được gộp', async () => {
  const t = boot();
  const good = await makeAd();
  const bad = { ...toWire(await makeAd({ native_ad_id: '42' })), ad_url: 'javascript:alert(1)' };
  const ghost = toWire({ ...(await makeAd({ native_ad_id: '77' })) }, 'TOUCH');
  const res = await t.call('ads.upsert', { records: [toWire(good), bad, ghost, toWire(good)] });
  assert.equal(res.ok, true);
  assert.deepEqual(res.results.map((r) => r.status), ['INSERTED', 'REJECTED', 'REJECTED', 'TOUCHED']);
  assert.equal(res.results[1].errors[0].field, 'ad_url');
  assert.equal(t.sheet('RAW_ADS').objects().length, 1);
  assert.equal(t.sheet('RUN_LOG').objects()[0].sync_status, 'PARTIAL');
});

test('idempotency: retry cùng request_id (nonce mới) không ghi lần 2', async () => {
  const t = boot();
  const ad = await makeAd();
  const r1 = await t.call('ads.upsert', { records: [toWire(ad)] }, { requestId: 'req-1' });
  const r2 = await t.call('ads.upsert', { records: [toWire(ad)] }, { requestId: 'req-1' });
  assert.deepEqual(r2.results, r1.results);
  assert.equal(t.sheet('RAW_ADS').objects().length, 1);
  assert.equal(t.sheet('RUN_LOG').objects().length, 1);
});

test('chống formula injection, kể cả khi cập nhật hàng sau đó', async () => {
  const t = boot();
  const ad = await makeAd({ body_text: '=IMPORTXML("http://evil","//a") tuyển dụng', headline: '+SUM(1)' });
  await t.call('ads.upsert', { records: [toWire(ad)] });
  const sh = t.sheet('RAW_ADS');
  const h = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  const bodyCol = h.indexOf('body_text') + 1;
  assert.equal(sh.raw(2, bodyCol).startsWith("'="), true);
  assert.equal(sh.raw(2, h.indexOf('headline') + 1), "'+SUM(1)");
  await t.call('ads.upsert', { records: [toWire({ ...ad, seen_at: '2026-09-27T10:00:00+07:00' }, 'TOUCH')] });
  assert.equal(sh.raw(2, bodyCol).startsWith("'="), true, 'TOUCH ghi lại cả hàng vẫn giữ bảo vệ');
});

test('index.get trả map ad_uid → fp', async () => {
  const t = boot();
  const ad = await makeAd();
  await t.call('ads.upsert', { records: [toWire(ad)] });
  const res = await t.call('index.get', { source: 'META_AD_LIBRARY', since: '2020-01-01' });
  assert.equal(res.index['meta:1234567890123456'].fp, ad.content_fp);
});

test('landing.upsert: snapshot đầu → không đổi → đổi offer', async () => {
  const t = boot();
  const base = {
    client_id: 'lp1', url: 'https://www.navigossearch.com/vi/dich-vu?utm_source=google&gclid=abc', page_title: 'Dịch vụ Executive Search',
    h1: 'Tìm lãnh đạo phù hợp', offer: 'Tư vấn miễn phí', primary_cta: 'Liên hệ tư vấn', secondary_ctas: ['Xem dịch vụ'],
    form_present: true, form_fields: ['Họ tên', 'Email', 'Công ty'], content_hash: 'a'.repeat(64),
    section_hashes: { hero: 'h1', offer: 'o1', cta: 'c1' }
  };
  const r1 = await t.call('landing.upsert', { records: [base] });
  assert.equal(r1.results[0].status, 'INSERTED_SNAPSHOT');
  assert.equal(r1.results[0].change_summary, 'FIRST_SNAPSHOT');
  const lp = t.sheet('LANDING_PAGES').objects()[0];
  assert.equal(lp.competitor_id, 'CMP-001');
  assert.equal(lp.url, 'https://navigossearch.com/vi/dich-vu');
  assert.equal(lp.utm, 'utm_source=google');
  assert.equal(lp.funnel_stage, 'BOFU');
  const r2 = await t.call('landing.upsert', { records: [base] });
  assert.equal(r2.results[0].status, 'UNCHANGED');
  const r3 = await t.call('landing.upsert', { records: [{ ...base, offer: 'Bảo hành thay thế 90 ngày', content_hash: 'b'.repeat(64), section_hashes: { hero: 'h1', offer: 'o2', cta: 'c1' } }] });
  assert.equal(r3.results[0].status, 'INSERTED_SNAPSHOT');
  assert.deepEqual(r3.results[0].changed_sections, ['offer']);
  assert.match(r3.results[0].change_summary, /offer: 'Tư vấn miễn phí' → 'Bảo hành thay thế 90 ngày'/);
  assert.equal(t.sheet('LANDING_PAGES').objects().length, 2);
});

test('trends.upsert + tính lại: momentum vào KEYWORDS; gửi lại không nhân đôi', async () => {
  const t = boot();
  const pts = (base, bump) => Array.from({ length: 20 }, (_, i) => {
    const d = new Date(Date.UTC(2026, 4, 3 + 7 * i));
    return [d.toISOString().slice(0, 10), i >= 16 ? base + bump : base];
  });
  const payload = {
    meta: { geo: 'VN', timeframe: 'today 12-m', batch_id: 'B1', anchor_keyword: 'headhunter', source_url: 'https://trends.google.com/x' },
    series: [{ keyword: 'headhunter', points: pts(50, 0) }, { keyword: 'dịch vụ headhunt', points: pts(20, 10) }],
    related: [{ keyword: 'dịch vụ headhunt', top: ['công ty headhunt (100)'], rising: ['headhunt it (+250%)'] }]
  };
  const r1 = await t.call('trends.upsert', payload);
  assert.equal(r1.ok, true, JSON.stringify(r1));
  assert.equal(r1.summary.points_inserted, 40);
  const r2 = await t.call('trends.upsert', payload);
  assert.equal(r2.summary.points_inserted, 0);
  assert.equal(r2.summary.points_updated, 40);
  assert.equal(t.sheet('GOOGLE_TRENDS').objects().length, 40);
  t.g.nightlyRecompute();
  const kw = t.sheet('KEYWORDS').objects().find((k) => k.keyword === 'dịch vụ headhunt');
  assert.equal(kw.trend_direction, 'UP');
  assert.equal(kw.momentum, 0.5);
  const bad = await t.call('trends.upsert', { meta: { geo: 'VN' }, series: [] });
  assert.equal(bad.ok, false);
});

test('tính lại + Dashboard + báo cáo tuần chạy được, có OPPORTUNITIES và email', async () => {
  const t = boot();
  const cfg = t.sheet('CONFIG');
  const keys = cfg.getRange(2, 1, cfg.getLastRow() - 1, 1).getValues().map((r) => r[0]);
  cfg.getRange(keys.indexOf('report_recipients') + 2, 2).setValue('mkt@example.com');
  const ads = [];
  for (let i = 0; i < 6; i++) {
    ads.push(toWire(await makeAd({
      native_ad_id: '10' + i,
      start_date_raw: 'Started running on 1 Jun 2026',
      captured_at: new Date().toISOString(),
      body_text: i % 2 ? 'Dịch vụ headhunt bảo hành thay thế miễn phí 60 ngày cho vị trí quản lý. Liên hệ ngay.' : 'Báo cáo lương 2026 cho nhà tuyển dụng: tải miễn phí.',
      headline: 'Mẫu ' + i
    })));
  }
  const res = await t.call('ads.upsert', { records: ads });
  assert.equal(res.summary.inserted, 6);
  t.g.nightlyRecompute();
  const raw = t.sheet('RAW_ADS').objects();
  assert.ok(raw.every((r) => r.is_long_running === true), 'chạy từ 1/6 → long-running');
  const an = t.sheet('AD_ANALYSIS').objects();
  assert.ok(an.every((r) => Number(r.priority_signal) >= 60), 'long-running + active + nhiều biến thể');
  const opps = t.sheet('OPPORTUNITIES').objects();
  assert.ok(opps.length >= 10);
  assert.ok(opps.every((o) => o.opportunity_score >= 1 && o.opportunity_score <= 10));
  const comps = t.sheet('COMPETITORS').objects();
  assert.equal(comps[0].ads_total, 6);
  const dash = t.sheet('DASHBOARD');
  assert.ok(dash.getLastRow() > 30);
  assert.ok(dash.getCharts().length >= 2);
  t.g.weeklyReport();
  assert.equal(t.mails.length, 1);
  assert.match(t.mails[0].subject, /Báo cáo đối thủ tuần/);
  assert.ok(t.sheet('WEEKLY_REPORT').getLastRow() > 20);
});

test('rule phân loại cho quảng cáo headhunt mẫu', () => {
  const { g } = createGas();
  const a = g.analyzeAd_({
    body_text: 'Top 1 công ty headhunter với 5.000+ vị trí quản lý đã tuyển thành công. Mạng lưới ứng viên thụ động cấp cao.',
    headline: 'Executive Search cho doanh nghiệp FDI', cta_text: 'Tìm hiểu thêm', landing_url: 'https://x.com/blog/xu-huong'
  });
  assert.equal(a.framework_auto, 'SOCIAL_PROOF');
  assert.equal(a.funnel_stage_auto, 'TOFU');
  assert.equal(g.detectAudience_('Tuyển Giám đốc Tài chính, mức lương hấp dẫn, ứng tuyển ngay', ''), 'CANDIDATE');
  assert.equal(g.offerType_('Cam kết bảo hành thay thế miễn phí 90 ngày'), 'GUARANTEE');
  assert.equal(g.normalizeCta_('Gửi yêu cầu tuyển dụng'), 'CONTACT');
  assert.equal(g.prioritySignal_({ run_days: 70, variants: 3, families: 2, active: true, recent_update: true, lp_invested: true }), 100);
});

test('bản gộp apps-script-bundle/CAI.gs khớp mã nguồn và chạy được độc lập', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const vm = await import('node:vm');
  const { bundle } = await import('../tools/bundle-gs.mjs');
  const file = path.resolve(path.dirname(new URL(import.meta.url).pathname), '../apps-script-bundle/CAI.gs');
  assert.equal(fs.readFileSync(file, 'utf8'), bundle(), 'Chạy `npm run bundle` để cập nhật bản gộp');
  new vm.Script(bundle());
});
