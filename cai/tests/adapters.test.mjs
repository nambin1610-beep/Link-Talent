import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { JSDOM } from 'jsdom';
import { normalizeCapture, fingerprint } from '../extension/src/shared/normalize.js';

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');
const CONTENT = ['core.js', 'adapters/meta.js', 'adapters/google-atc.js', 'adapters/linkedin.js', 'adapters/trends.js']
  .map((f) => read('extension/src/content/' + f));

function load(fixture, url) {
  const dom = new JSDOM(read('tests/fixtures/' + fixture), { url, runScripts: 'outside-only' });
  for (const src of CONTENT) dom.window.eval(src);
  const CAI = dom.window.__CAI;
  const adapter = CAI.adapters.find((a) => a.matches(dom.window.location));
  return { dom, CAI, adapter };
}

test('Meta: tìm đúng 2 card, trích ID/ngày/nội dung/CTA/landing/media (VI + EN)', async () => {
  const url = 'https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&view_all_page_id=112233&search_type=page';
  const { dom, adapter } = load('meta-library.html', url);
  assert.equal(adapter.source, 'META_AD_LIBRARY');
  const cards = adapter.findCards(dom.window.document);
  assert.equal(cards.length, 2);
  const [a, b] = cards.map((c) => adapter.extract(c, { pageUrl: url }));

  assert.equal(a.native_ad_id, '1234567890123456');
  assert.equal(a.advertiser_name, 'Navigos Search');
  assert.equal(a.advertiser_id, '112233');
  assert.equal(a.status_raw, 'Active');
  assert.match(a.start_date_raw, /2 thg 9, 2026/);
  assert.equal(a.end_date_raw, '');
  assert.deepEqual([...a.platforms_raw], ['Facebook', 'Instagram']);
  assert.match(a.body_text, /^Bạn đang mất hàng tháng để tuyển Giám đốc tài chính\?/);
  assert.equal(a.headline, 'Tuyển nhân sự cấp cao trong 30 ngày');
  assert.equal(a.description, 'NAVIGOSSEARCH.COM');
  assert.equal(a.cta_text, 'Liên hệ chúng tôi');
  assert.equal(a.variant_count, 3);
  assert.equal(a.format_raw, 'IMAGE');
  assert.equal(a.media.length, 1, 'loại avatar 60x60');
  assert.equal(a.country_filter, 'VN');
  assert.ok(a.confidence_score >= 0.9);

  assert.equal(b.native_ad_id, '998877665544332');
  assert.equal(b.status_raw, 'Inactive');
  assert.equal(b.start_date_raw, b.end_date_raw, 'dòng khoảng ngày');
  assert.equal(b.format_raw, 'VIDEO');
  assert.equal(b.cta_text, 'Learn more');

  const ra = await fingerprint(normalizeCapture({ ...a, client_id: 'a' }));
  assert.equal(ra.ad_uid, 'meta:1234567890123456');
  assert.equal(ra.start_date, '2026-09-02');
  assert.equal(ra.is_active, 'ACTIVE');
  assert.equal(ra.landing_url, 'https://navigossearch.com/vi/executive-search');
  assert.equal(ra.cta_normalized, 'CONTACT');
  assert.deepEqual(ra.platforms, ['FACEBOOK', 'INSTAGRAM']);
  assert.equal(ra.audience_side, 'EMPLOYER');
  const rb = normalizeCapture({ ...b, client_id: 'b' });
  assert.equal(rb.start_date, '2026-08-01');
  assert.equal(rb.end_date, '2026-09-03');
  assert.equal(rb.is_active, 'INACTIVE');
  assert.equal(rb.language, 'en');
});

test('Google Ads Transparency: ID AR/CR, advertiser, last shown, domain hiển thị', () => {
  const url = 'https://adstransparency.google.com/advertiser/AR01234567890123456789?region=VN';
  const { dom, adapter } = load('google-atc.html', url);
  assert.equal(adapter.source, 'GOOGLE_ATC');
  const cards = adapter.findCards(dom.window.document);
  assert.equal(cards.length, 2);
  const [a, b] = cards.map((c) => adapter.extract(c, { pageUrl: url }));
  assert.equal(a.native_ad_id, 'AR01234567890123456789/CR11112222333344445555');
  assert.equal(a.advertiser_id, 'AR01234567890123456789');
  assert.equal(a.advertiser_name, 'NAVIGOS GROUP VIETNAM JOINT STOCK COMPANY');
  assert.match(a.end_date_raw, /20 thg 9, 2026/);
  assert.equal(a.landing_url_raw, 'https://navigossearch.com');
  assert.equal(a.format_raw, 'IMAGE');
  assert.equal(a.ad_url, 'https://adstransparency.google.com/advertiser/AR01234567890123456789/creative/CR11112222333344445555?region=VN');
  assert.match(b.end_date_raw, /Sep 1, 2026/);
  const r = normalizeCapture({ ...a, client_id: 'g' }, {}, { google_active_days: 2 });
  assert.equal(r.end_date, '2026-09-20');
  assert.equal(r.start_date, '');
  assert.ok(['ACTIVE', 'INACTIVE'].includes(r.is_active));
});

test('LinkedIn: ID chi tiết, advertiser, body, CTA, landing qua redir', () => {
  const url = 'https://www.linkedin.com/ad-library/search?accountOwner=Robert%20Walters&countries=VN';
  const { dom, adapter } = load('linkedin-library.html', url);
  assert.equal(adapter.source, 'LINKEDIN_AD_LIBRARY');
  const cards = adapter.findCards(dom.window.document);
  assert.equal(cards.length, 2);
  const [a, b] = cards.map((c) => adapter.extract(c, { pageUrl: url }));
  assert.equal(a.native_ad_id, '555666777');
  assert.equal(a.advertiser_name, 'Robert Walters');
  assert.equal(a.advertiser_id, 'robert-walters');
  assert.match(a.body_text, /^Hiring a Head of Finance\?/);
  assert.equal(a.headline, 'Executive recruitment in Vietnam');
  assert.equal(a.cta_text, 'Learn more');
  assert.equal(a.format_raw, 'IMAGE');
  const r = normalizeCapture({ ...a, client_id: 'l' });
  assert.equal(r.landing_url, 'https://robertwalters.com.vn/employers.html');
  assert.equal(r.ad_url, 'https://www.linkedin.com/ad-library/detail/555666777');
  assert.equal(b.native_ad_id, '555666888');
  assert.equal(b.format_raw, 'TEXT');
});

test('Trang chặn/đăng nhập được phát hiện; trang lạ không có adapter', () => {
  const blocked = new JSDOM('<body><iframe src="https://www.google.com/recaptcha/api2/anchor"></iframe></body>',
    { url: 'https://adstransparency.google.com/?region=VN', runScripts: 'outside-only' });
  for (const src of CONTENT) blocked.window.eval(src);
  assert.equal(blocked.window.__CAI.isBlocked(), 'CAPTCHA');
  const other = new JSDOM('<body></body>', { url: 'https://example.com/', runScripts: 'outside-only' });
  for (const src of CONTENT) other.window.eval(src);
  assert.equal(other.window.__CAI.adapters.find((a) => a.matches(other.window.location)), undefined);
});
