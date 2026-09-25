import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  findDates, parseDate, normalizeLanding, unwrapRedirect, normalizeCta, detectAudience, detectLanguage,
  normalizeForHash, normalizeCapture, fingerprint, matchCompetitor, mediaKey, toWire, missingFields
} from '../extension/src/shared/normalize.js';
import { parseMultiTimeline, parseRelatedQueries, parseTrendsUrl, buildTrendsPayload } from '../extension/src/shared/trends-csv.js';
import { hmacHex, sha256Hex } from '../extension/src/shared/crypto.js';
import { callApi } from '../extension/src/shared/api.js';

test('parse ngày song ngữ VI/EN', () => {
  const cases = {
    'Started running on 2 Sep 2026': '2026-09-02',
    'Started running on Sep 2, 2026': '2026-09-02',
    'Bắt đầu chạy vào 2 thg 9, 2026': '2026-09-02',
    'Bắt đầu chạy vào ngày 2 tháng 9, 2026': '2026-09-02',
    'ngày 12 tháng 10 năm 2026': '2026-10-12',
    'Last shown: September 20, 2026': '2026-09-20',
    'Hiển thị lần cuối: 20/09/2026': '2026-09-20',
    '2026-09-02': '2026-09-02',
    '02 Th09 2026': '2026-09-02'
  };
  for (const [s, v] of Object.entries(cases)) assert.equal(parseDate(s), v, s);
  assert.deepEqual(findDates('2 Sep 2026 - 20 Sep 2026'), ['2026-09-02', '2026-09-20']);
  assert.deepEqual(findDates('Ran from Aug 1, 2026 to Sep 3, 2026'), ['2026-08-01', '2026-09-03']);
  assert.deepEqual(findDates('1 thg 8, 2026 - 3 thg 9, 2026'), ['2026-08-01', '2026-09-03']);
  assert.equal(parseDate('31/02/2026'), '', 'ngày không tồn tại');
  assert.equal(parseDate('không có ngày'), '');
});

test('URL: bỏ tracking cá nhân, giữ UTM riêng, gỡ redirect', () => {
  const n = normalizeLanding('https://WWW.Navigossearch.com/vi/dich-vu/?utm_source=fb&fbclid=ABC&b=2&a=1#x');
  assert.equal(n.url, 'https://navigossearch.com/vi/dich-vu?a=1&b=2');
  assert.equal(n.domain, 'navigossearch.com');
  assert.deepEqual(n.utm, { utm_source: 'fb' });
  assert.equal(normalizeLanding('https://tuyendung.talentnet.com.vn/x').domain, 'talentnet.com.vn');
  assert.equal(unwrapRedirect('https://l.facebook.com/l.php?u=' + encodeURIComponent('https://a.vn/p?q=1') + '&h=AT0'), 'https://a.vn/p?q=1');
  assert.equal(unwrapRedirect('https://www.linkedin.com/redir/redirect?url=' + encodeURIComponent('https://b.com')), 'https://b.com');
  assert.equal(mediaKey('https://scontent.fsgn5-1.fna.fbcdn.net/v/t39/123_n.jpg?oe=1&_nc=2'), 'fbcdn/v/t39/123_n.jpg');
  assert.equal(mediaKey('https://www.youtube.com/watch?v=abc&t=3'), 'yt:abc');
});

test('CTA, phía khách hàng, ngôn ngữ', () => {
  assert.equal(normalizeCta('Tìm hiểu thêm'), 'LEARN_MORE');
  assert.equal(normalizeCta('Book a demo'), 'BOOK_DEMO');
  assert.equal(normalizeCta('Đăng ký tham gia'), 'REGISTER_EVENT');
  assert.equal(normalizeCta('Gửi tin nhắn'), 'SEND_MESSAGE');
  assert.equal(normalizeCta('Ứng tuyển ngay'), 'APPLY_NOW');
  assert.equal(normalizeCta(''), '');
  assert.equal(detectAudience('Dịch vụ headhunt giúp doanh nghiệp tìm nhân sự cấp cao'), 'EMPLOYER');
  assert.equal(detectAudience('Việc làm Giám đốc tài chính, mức lương 5000$, ứng tuyển ngay'), 'CANDIDATE');
  assert.equal(detectAudience('Xin chào', '/nha-tuyen-dung/dich-vu'), 'EMPLOYER');
  assert.equal(detectLanguage('Dịch vụ tuyển dụng nhân sự cấp cao cho doanh nghiệp'), 'vi');
  assert.equal(detectLanguage('Executive search for leading companies in Vietnam'), 'en');
});

test('fingerprint ổn định với khoảng trắng/emoji/hoa-thường/UTM; đổi khi đổi headline', async () => {
  const base = {
    client_id: 'c1', source: 'META_AD_LIBRARY', native_ad_id: '123456789', advertiser_name: 'Navigos Search',
    body_text: 'Tuyển  Giám đốc 🚀 NHANH trong 30 ngày', headline: 'Executive Search', cta_text: 'Liên hệ',
    media: [{ type: 'image', url: 'https://scontent.x.fbcdn.net/v/1_n.jpg?oe=1' }], ad_url: 'https://www.facebook.com/ads/library/?id=123456789',
    landing_url_raw: 'https://navigossearch.com/vi?utm_content=a'
  };
  const a = await fingerprint(normalizeCapture(base));
  const b = await fingerprint(normalizeCapture({ ...base, body_text: 'tuyển giám đốc nhanh trong 30 ngày', landing_url_raw: 'https://www.navigossearch.com/vi?utm_content=b&fbclid=1',
    media: [{ type: 'image', url: 'https://scontent.y.fbcdn.net/v/1_n.jpg?oe=2' }] }));
  const c = await fingerprint(normalizeCapture({ ...base, headline: 'Headhunt C-level' }));
  assert.equal(a.ad_uid, 'meta:123456789');
  assert.equal(a.content_fp, b.content_fp);
  assert.equal(a.creative_fp, b.creative_fp);
  assert.notEqual(a.content_fp, c.content_fp);
  assert.match(a.content_fp, /^[0-9a-f]{64}$/);
  const noId = await fingerprint(normalizeCapture({ ...base, native_ad_id: '' }));
  assert.equal(noId.ad_uid, 'fp:' + noId.content_fp.slice(0, 16));
  assert.equal(normalizeForHash('1.000+ doanh nghiệp!!'), '1000 doanh nghiệp');
});

test('normalizeCapture: khoảng ngày inactive, ngữ cảnh, map đối thủ, TOUCH wire', async () => {
  const config = { competitors: [{ competitor_id: 'CMP-002', competitor_name: 'First Alliances', domain: 'firstalliances.com', alt_domains: [], meta_page_id: '777' }] };
  const r = normalizeCapture({
    client_id: 'c2', source: 'META_AD_LIBRARY', native_ad_id: '1', advertiser_name: 'FA Page', advertiser_id: '777',
    status_raw: 'Inactive', start_date_raw: '1 Aug 2026 - 3 Sep 2026', end_date_raw: '1 Aug 2026 - 3 Sep 2026',
    body_text: 'x', ad_url: 'https://www.facebook.com/ads/library/?id=1'
  }, { audience_side: 'EMPLOYER', product: 'Headhunt', tags: ['headhunt'], rating: 5 }, config);
  assert.equal(r.start_date, '2026-08-01');
  assert.equal(r.end_date, '2026-09-03');
  assert.equal(r.is_active, 'INACTIVE');
  assert.equal(r.competitor_id, 'CMP-002');
  assert.equal(r.audience_side, 'EMPLOYER');
  assert.equal(r.product, 'Headhunt');
  assert.deepEqual(matchCompetitor(config, { advertiser_name: 'x', landing_url: 'https://www.firstalliances.com/vn' }), 'CMP-002');
  const touch = toWire({ ...r, ad_uid: 'meta:1' }, 'TOUCH');
  assert.deepEqual(Object.keys(touch).sort(), ['ad_uid', 'client_id', 'end_date', 'is_active', 'media_urls', 'mode', 'platforms', 'seen_at', 'tags', 'variant_count']);
  const full = toWire({ ...r, kind: 'ad', state: 'READY', known: 'NEW', missing: [], added_at: 'x', mode: 'FULL' });
  assert.equal(full.mode, 'FULL');
  assert.equal('kind' in full || 'known' in full || 'added_at' in full, false);
  assert.deepEqual(missingFields({ advertiser_name: '', ad_url: '', body_text: '' }), ['advertiser_name', 'ad_url', 'body_text']);
});

test('HMAC/SHA-256 khớp vector chuẩn', async () => {
  assert.equal(await sha256Hex('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  // RFC 4231 test case 2
  assert.equal(await hmacHex('Jefe', 'what do ya want for nothing?'), '5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
});

test('callApi: retry lỗi retryable với cùng request_id, dừng ở lỗi không retryable', async () => {
  const seen = [];
  let n = 0;
  const fetchImpl = async (_url, opts) => {
    const body = JSON.parse(opts.body);
    seen.push(body);
    n++;
    const res = n < 3 ? { ok: false, error: { code: 'LOCK_TIMEOUT', retryable: true } } : { ok: true, summary: {} };
    return { text: async () => JSON.stringify(res) };
  };
  const settings = { endpoint: 'https://script.google.com/macros/s/x/exec', userId: 'u', secret: 's' };
  const res = await callApi(settings, 'ads.upsert', { records: [] }, { fetchImpl, backoffMs: 1 });
  assert.equal(res.ok, true);
  assert.equal(seen.length, 3);
  assert.equal(new Set(seen.map((b) => b.request_id)).size, 1, 'cùng request_id');
  assert.equal(new Set(seen.map((b) => b.auth.nonce)).size, 3, 'nonce mới mỗi lần');
  let m = 0;
  const res2 = await callApi(settings, 'x', {}, { fetchImpl: async () => { m++; return { text: async () => '{"ok":false,"error":{"code":"AUTH_INVALID_SIGNATURE","retryable":false}}' }; }, backoffMs: 1 });
  assert.equal(res2.error.code, 'AUTH_INVALID_SIGNATURE');
  assert.equal(m, 1);
  const res3 = await callApi({}, 'x', {});
  assert.equal(res3.error.code, 'NOT_CONFIGURED');
  const res4 = await callApi(settings, 'x', {}, { fetchImpl: async () => ({ text: async () => '<html>login</html>' }), backoffMs: 1 });
  assert.equal(res4.error.code, 'BAD_RESPONSE');
});

test('Trends CSV: multiTimeline (kể cả <1, header tiếng Việt) và relatedQueries', () => {
  const csv = '﻿Category: All categories\n\nWeek,headhunter: (Vietnam),"dịch vụ headhunt: (Vietnam)"\n2026-09-07,64,<1\n2026-09-14,71,3\n';
  const t = parseMultiTimeline(csv);
  assert.deepEqual(t.series.map((s) => s.keyword), ['headhunter', 'dịch vụ headhunt']);
  assert.deepEqual(t.series[1].points, [['2026-09-07', 0.5], ['2026-09-14', 3]]);
  assert.equal(t.series[0].geo, 'Vietnam');
  const vi = parseMultiTimeline('Danh mục: Tất cả\n\nTuần,headhunter: (Việt Nam)\n7/9/2026,10\n14/9/2026,12\n');
  assert.deepEqual(vi.series[0].points, [['2026-09-07', 10], ['2026-09-14', 12]]);
  const rel = parseRelatedQueries('Category: All categories\n\nTOP\ncông ty headhunt,100\nheadhunter là gì,45\n\nRISING\nheadhunt it,+250%\nphí headhunt,Breakout\n');
  assert.deepEqual(rel.top, ['công ty headhunt (100)', 'headhunter là gì (45)']);
  assert.deepEqual(rel.rising, ['headhunt it (+250%)', 'phí headhunt (Breakout)']);
  assert.throws(() => parseMultiTimeline('abc\n1,2'));
  const u = parseTrendsUrl('https://trends.google.com/trends/explore?date=today%2012-m&geo=VN&q=headhunter,d%E1%BB%8Bch%20v%E1%BB%A5%20headhunt&hl=vi');
  assert.deepEqual(u, { geo: 'VN', timeframe: 'today 12-m', keywords: ['headhunter', 'dịch vụ headhunt'], hl: 'vi' });
  const p = buildTrendsPayload({ timeline: t, related: { headhunter: rel }, meta: { geo: 'VN', batch_id: 'B1' } });
  assert.equal(p.meta.geo, 'VN');
  assert.equal(p.series.length, 2);
  assert.equal(p.related[0].keyword, 'headhunter');
});

test('Rule ở Extension và Apps Script cho cùng kết quả (CTA, phía KH, domain, URL)', async () => {
  const { createGas } = await import('./gas-harness.mjs');
  const { g } = createGas();
  const texts = ['Tìm hiểu thêm', 'Book a demo', 'Đăng ký tham gia', 'Gửi yêu cầu tuyển dụng', 'Ứng tuyển ngay', 'Nhắn tin Zalo', 'Xyz', '',
    'Looking for a CFO? Our executive search team delivers a shortlist in 14 days.',
    'Việc làm Giám đốc tài chính, mức lương 5000$, ứng tuyển ngay', 'Dịch vụ headhunt cho doanh nghiệp của bạn', 'Xin chào'];
  for (const t of texts) {
    assert.equal(g.normalizeCta_(t), normalizeCta(t), 'CTA: ' + t);
    assert.equal(g.detectAudience_(t, ''), detectAudience(t, ''), 'Audience: ' + t);
  }
  assert.equal(detectAudience(texts[8]), 'EMPLOYER');
  for (const u of ['https://WWW.a.com.vn/x/?utm_source=f&fbclid=1&b=2&a=1', 'https://tuyendung.talentnet.com.vn/', 'https://robertwalters.com.vn/employers.html?gclid=9']) {
    const a = normalizeLanding(u);
    const b = g.normalizeLanding_(u);
    assert.equal(b.url, a.url, u);
    assert.equal(b.domain, a.domain, u);
    assert.equal(b.key, a.key, u);
  }
});
