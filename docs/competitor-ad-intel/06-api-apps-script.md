# 06 — Google Apps Script API, Endpoint, JSON mẫu, Pseudocode

## 8. Cấu trúc Google Apps Script

Project Apps Script **gắn với Spreadsheet** (container-bound), quản lý bằng `clasp` + Git.

```
apps-script/
├── appsscript.json          # timeZone: Asia/Ho_Chi_Minh, webapp: executeAs USER_DEPLOYING, access ANYONE_ANONYMOUS
├── Code.gs                  # doGet / doPost → router
├── Router.gs                # map action → handler
├── Auth.gs                  # verify token/HMAC, timestamp, nonce, user
├── Schema.gs                # định nghĩa schema + validate()
├── Repo.gs                  # SheetRepo: headerMap, readColumns, appendRows, updateCells (batch)
├── Upsert.gs                # upsertAds, upsertLanding, upsertTrends, upsertAnalysis
├── Rules.gs                 # funnel/framework/angle/audience/CTA rule (dùng chung với công thức)
├── History.gs               # diff trường → AD_HISTORY
├── Log.gs                   # RUN_LOG, error log
├── Jobs.gs                  # trigger: nightlyRecompute, weeklyReport, landingStatusCheck (P2)
├── Report.gs                # sinh WEEKLY_REPORT sheet + Google Doc + email
├── Ai.gs                    # Phase 2: Claude API (UrlFetchApp)
├── Setup.gs                 # tạo tab, header, validation, protected ranges, named ranges
└── Utils.gs                 # hash, uuid, date, url normalize (port từ extension)
```

**Triển khai Web App**
- Deploy → *Web app* → Execute as: **Me** (tài khoản chủ Sheet) · Who has access: **Anyone**. Cần mức này vì Extension gọi không kèm cookie Google. Bảo vệ bằng HMAC/token ở tầng ứng dụng (bên dưới).
- Mỗi lần sửa code: *Manage deployments → Edit → New version*. URL `/exec` giữ nguyên.
- Phase 2 (khi cần định danh Google thật): chuyển sang "Anyone with Google account" + Extension dùng `chrome.identity.getAuthToken` gửi `Authorization: Bearer`, **hoặc** đặt API trung gian (Cloud Run) xác thực OAuth rồi ghi Sheets qua Sheets API bằng service account.

**Hạn chế kỹ thuật của Apps Script (thiết kế phải tính tới)**

| Hạn chế | Hệ quả thiết kế |
|---|---|
| `doPost(e)` **không đọc được HTTP header** của request | Token/HMAC nằm **trong body JSON**, không dùng header `Authorization` |
| Web App luôn trả **HTTP 200** (hoặc 302 redirect sang `script.googleusercontent.com`) | Lỗi trả trong JSON `ok:false, error.code`. Extension `fetch` với `redirect:'follow'` |
| Giới hạn thời gian chạy mỗi lần gọi (~6 phút) và số lần chạy đồng thời | Batch ≤ 50 bản ghi. Ghi bằng `setValues` một lần. Không đọc toàn sheet, chỉ đọc cột khóa |
| Ghi đồng thời gây race | `LockService.getScriptLock().waitLock(20000)` quanh đoạn upsert |
| Quota UrlFetch/ngày, email/ngày | Phase 2 AI dùng Batch API, báo cáo 1 email/tuần |
| CORS | Extension có `host_permissions` cho `script.google.com` + `script.googleusercontent.com` nên SW gọi được. Dùng `Content-Type: text/plain` để tránh preflight |

**Bảo mật request**

```
body = {
  "v": 1,
  "action": "ads.upsert",
  "auth": { "user_id": "u_linh", "ts": 1790322123, "nonce": "b3f1…", "sig": "hex(HMAC_SHA256(secret_u_linh, ts + '\n' + nonce + '\n' + payload))" },
  "payload": "<chuỗi JSON của dữ liệu>"      // ký trên đúng chuỗi này
}
```

- Secret từng user lưu Script Properties `SECRET_u_linh`. Thu hồi = xóa property.
- Từ chối nếu `|now − ts| > 300s`. `nonce` đã thấy trong `CacheService` (TTL 600s) → từ chối (chống replay).
- MVP tối giản có thể dùng `api_auth_mode=TOKEN` (so sánh token hằng thời gian). **Chỉ dùng nội bộ, trong thời gian ngắn.**
- Giới hạn payload 1 MB. Validate kiểu và độ dài từng trường. Escape chuỗi bắt đầu bằng `=`, `+`, `-`, `@` (chống **formula injection** trong Sheets) bằng cách thêm tiền tố `'`.

---

## 9. Danh sách endpoint & JSON mẫu

Base: `https://script.google.com/macros/s/{DEPLOYMENT_ID}/exec`. Routing bằng trường `action` (Apps Script không có path routing).

| Method | action | Mô tả | MVP |
|---|---|---|---|
| GET | `health` | Kiểm tra sống + version schema (không cần auth) | ● |
| GET/POST | `config.get` | COMPETITORS, KEYWORDS, SEARCH_URLS, tags, lists, ngưỡng (cần auth; GET dùng query `auth=` base64) | ● |
| POST | `index.get` | Map `ad_uid → content_fp, last_seen_at` theo `source`, `since` | ● |
| POST | `ads.upsert` | Upsert ≤ 50 quảng cáo (FULL hoặc TOUCH) | ● |
| POST | `landing.upsert` | Ghi snapshot LP + tính thay đổi | ● |
| POST | `trends.upsert` | Ghi điểm Trends (từ CSV/DOM) | ● |
| POST | `analysis.upsert` | Ghi nhãn phân tích thủ công/AI cho record | ● |
| POST | `searchurl.opened` | Báo URL đã mở (cập nhật `last_opened_at`) | ● |
| POST | `log.client` | Extension gửi lỗi client (adapter fail, parse fail) | ● |
| POST | `report.generate` | Chạy báo cáo tuần ngay (admin) | ◐ |
| POST | `ai.classify` | Đẩy record vào hàng đợi AI | ◐ |

### 9.1 `ads.upsert` — request

```json
{
  "v": 1,
  "action": "ads.upsert",
  "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "auth": { "user_id": "u_linh", "ts": 1790322123, "nonce": "b3f1c2…", "sig": "5d41402a…" },
  "payload": {
    "client": { "extension_version": "0.1.0", "schema_version": 1, "page_url": "https://www.facebook.com/ads/library/?active_status=active&country=VN&view_all_page_id=123456789", "found_on_page": 14 },
    "context": { "competitor_id": "CMP-001", "market": "VN", "product": "ATS / Đăng tin", "campaign_label": "Q4-2026 Hiring Season" },
    "records": [
      {
        "client_id": "c_01J9Z6",
        "mode": "FULL",
        "ad_uid": "meta:1234567890123456",
        "native_ad_id": "1234567890123456",
        "source": "META_AD_LIBRARY",
        "platforms": ["FACEBOOK", "INSTAGRAM"],
        "competitor_id": "CMP-001",
        "advertiser_name": "TopCV",
        "advertiser_id": "123456789",
        "seen_at": "2026-09-25T09:41:03+07:00",
        "start_date": "2026-09-02",
        "end_date": null,
        "is_active": "ACTIVE",
        "body_text": "Bạn đang mất hàng giờ lọc CV? …",
        "body_truncated": false,
        "headline": "Tuyển đúng người trong 7 ngày",
        "description": "topcv.vn",
        "cta_text": "Tìm hiểu thêm",
        "cta_normalized": "LEARN_MORE",
        "format": "IMAGE",
        "media_urls": ["https://scontent.xx.fbcdn.net/v/t39…/123_n.jpg"],
        "variant_count": 3,
        "ad_url": "https://www.facebook.com/ads/library/?id=1234567890123456",
        "landing_url": "https://topcv.vn/nha-tuyen-dung",
        "landing_url_raw": "https://www.topcv.vn/nha-tuyen-dung?utm_source=facebook&utm_campaign=q3_employer",
        "country": "VN",
        "language": "vi",
        "audience_side": "EMPLOYER",
        "content_fp": "9f2c6a…(64 hex)",
        "creative_fp": "a1b2c3…(64 hex)",
        "tags": ["time-to-hire"],
        "rating": 3,
        "notes": "Hook câu hỏi, visual dashboard",
        "extract_confidence": 0.92,
        "extractor_version": "meta@0.1.0"
      },
      {
        "client_id": "c_01J9Z7",
        "mode": "TOUCH",
        "ad_uid": "meta:9876543210987654",
        "seen_at": "2026-09-25T09:41:03+07:00",
        "is_active": "ACTIVE",
        "end_date": null
      }
    ]
  }
}
```

(Trong request thật, `payload` là **chuỗi** JSON để ký HMAC. Ở đây trình bày dạng object cho dễ đọc.)

### 9.2 `ads.upsert` — response

```json
{
  "ok": true,
  "request_id": "7c9e6679-7425-40de-944b-e07fc1f90ae7",
  "action": "ads.upsert",
  "run_id": "RUN-20260925-094210-u_linh",
  "server_time": "2026-09-25T09:42:11+07:00",
  "summary": { "received": 2, "inserted": 1, "updated": 0, "touched": 1, "rejected": 0 },
  "results": [
    { "client_id": "c_01J9Z6", "status": "INSERTED", "record_id": "RAD-9F2C6A1B2C-0001", "ad_uid": "meta:1234567890123456", "cluster_id": "CL-0042", "flags": ["REPEATED_CREATIVE"] },
    { "client_id": "c_01J9Z7", "status": "TOUCHED",  "record_id": "RAD-77AB01CDE2-0003", "ad_uid": "meta:9876543210987654", "seen_count": 4, "is_long_running": true }
  ]
}
```

Response lỗi một phần:

```json
{
  "ok": true,
  "summary": { "received": 3, "inserted": 2, "updated": 0, "touched": 0, "rejected": 1 },
  "results": [
    { "client_id": "c_03", "status": "REJECTED", "errors": [ { "code": "SCHEMA_MISSING_FIELD", "field": "ad_url", "message": "ad_url là bắt buộc với mode FULL" } ] }
  ]
}
```

Lỗi toàn request:

```json
{ "ok": false, "request_id": "…", "error": { "code": "AUTH_INVALID_SIGNATURE", "message": "Chữ ký không hợp lệ", "retryable": false } }
```

| error.code | retryable | Extension xử lý |
|---|---|---|
| `AUTH_MISSING` / `AUTH_INVALID_SIGNATURE` / `AUTH_UNKNOWN_USER` | ✗ | Chấm đỏ, mở Options |
| `AUTH_EXPIRED_TS` | ✓ | Đồng bộ giờ, ký lại, gửi lại 1 lần |
| `AUTH_REPLAY` | ✗ | Tạo nonce mới |
| `SCHEMA_VERSION_UNSUPPORTED` | ✗ | Báo cập nhật Extension |
| `PAYLOAD_TOO_LARGE` | ✓ | Chia đôi batch |
| `LOCK_TIMEOUT` / `INTERNAL` | ✓ | Backoff 2s, 4s, 8s, 16s (tối đa 4 lần) |
| `DUPLICATE_REQUEST` | — | Trả kết quả cũ (coi như thành công) |

### 9.3 `index.get`

```json
// request payload
{ "source": "META_AD_LIBRARY", "competitor_id": "CMP-001", "since": "2026-06-01" }
// response
{ "ok": true, "count": 2, "index": {
    "meta:1234567890123456": { "fp": "9f2c6a…", "last_seen_at": "2026-09-25", "record_id": "RAD-9F2C6A1B2C-0001" },
    "meta:9876543210987654": { "fp": "4e5d6c…", "last_seen_at": "2026-09-25", "record_id": "RAD-77AB01CDE2-0003" } } }
```

### 9.4 `landing.upsert`

```json
// request payload
{ "records": [ {
  "client_id": "lp_01",
  "competitor_id": "CMP-002",
  "url": "https://www.vietnamworks.com/employer/pricing",
  "final_url": "https://www.vietnamworks.com/employer/pricing",
  "utm": "utm_source=google&utm_medium=cpc",
  "page_title": "Bảng giá dịch vụ tuyển dụng",
  "h1": "Giải pháp tuyển dụng cho mọi doanh nghiệp",
  "offer": "Tặng 1 tin đăng miễn phí",
  "primary_cta": "Liên hệ tư vấn",
  "secondary_ctas": ["Xem bảng giá"],
  "social_proof": "10.000+ doanh nghiệp; 6 logo; 3 testimonial",
  "form_present": true,
  "form_fields": ["Họ tên", "Email", "Số điện thoại", "Công ty", "Quy mô"],
  "pricing_visible": true,
  "price_points": ["2.500.000đ/tin"],
  "content_hash": "…",
  "section_hashes": { "hero": "…", "offer": "…", "cta": "…", "proof": "…", "form": "…", "pricing": "…" },
  "linked_ad_uids": ["gatc:AR01…/CR09…"],
  "checked_at": "2026-09-25T10:05:00+07:00"
} ] }
// response
{ "ok": true, "results": [ { "client_id": "lp_01", "status": "INSERTED_SNAPSHOT", "lp_snapshot_id": "LPS-000321",
    "changed_sections": ["offer"], "change_summary": "Offer: 'Giảm 20% gói tin' → 'Tặng 1 tin đăng miễn phí'" } ] }
```

### 9.5 `trends.upsert`

```json
// request payload
{ "meta": { "geo": "VN", "timeframe": "today 12-m", "batch_id": "B1", "anchor_keyword": "tuyển dụng",
            "source_url": "https://trends.google.com/trends/explore?date=today%2012-m&geo=VN&q=…", "method": "CSV_IMPORT" },
  "series": [
    { "keyword": "phần mềm tuyển dụng", "points": [ ["2026-09-07", 64], ["2026-09-14", 71] ] },
    { "keyword": "tuyển dụng", "points": [ ["2026-09-07", 88], ["2026-09-14", 90] ] } ],
  "related": [
    { "keyword": "phần mềm tuyển dụng", "top": ["phần mềm tuyển dụng miễn phí", "ats là gì"], "rising": ["ai tuyển dụng (+250%)", "phần mềm chấm cv (Breakout)"] } ] }
// response
{ "ok": true, "summary": { "points_inserted": 4, "points_updated": 0, "related_saved": 1 } }
```

### 9.6 `analysis.upsert`

```json
{ "records": [ { "record_id": "RAD-9F2C6A1B2C-0001",
    "fields": { "pain_point_manual": "Mất thời gian lọc CV", "creative_angle_manual": "SPEED", "funnel_stage_manual": "TOFU",
                "learnings": "Hook câu hỏi + số ngày cụ thể", "copy_risk": "LOW", "reviewed_by": "u_linh" } } ] }
```

---

## 10. Pseudocode

### 10.1 Content script (bundle)

```js
// detector.js
const ADAPTERS = [MetaAdapter, LinkedInAdapter, GoogleAtcAdapter, TrendsAdapter];
const adapter = ADAPTERS.find(a => a.matches(location));
if (adapter) boot(adapter);

function boot(adapter) {
  const seen = new Map();                         // element → capture
  const overlay = new Overlay();                  // Shadow DOM
  const scan = debounce(async () => {
    if (adapter.isBlocked(document)) {            // login wall / captcha / rate-limit text
      chrome.runtime.sendMessage({ type: 'PAGE_BLOCKED', source: adapter.source });
      return;                                     // KHÔNG retry, KHÔNG thao tác trang
    }
    for (const card of adapter.findCards(document)) {
      if (seen.has(card)) continue;
      const cap = adapter.extract(card, { pageUrl: location.href });  // chỉ đọc DOM
      cap.client_id = ulid();
      seen.set(card, cap);
      const state = await chrome.runtime.sendMessage({ type: 'LOOKUP', ad_uid: previewUid(cap), fp: await previewFp(cap) });
      overlay.attach(card, cap, state);           // NEW / KNOWN / CHANGED / LOW_CONFIDENCE
    }
    chrome.runtime.sendMessage({ type: 'PAGE_STATS', source: adapter.source, found: seen.size });
  }, 500);

  new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
  scan();

  chrome.runtime.onMessage.addListener((msg, _s, reply) => {
    if (msg.type === 'GET_SELECTED')  reply(overlay.selected().map(el => seen.get(el)));
    if (msg.type === 'GET_ALL_VISIBLE') reply([...seen.values()].slice(0, msg.limit ?? 100));
  });
}

// adapters/meta.js (rút gọn)
const MetaAdapter = {
  source: 'META_AD_LIBRARY',
  matches: l => l.host === 'www.facebook.com' && l.pathname.startsWith('/ads/library'),
  isBlocked: d => /log in to continue|đăng nhập để tiếp tục|captcha/i.test(d.body.innerText.slice(0, 5000)),
  findCards(doc) {
    return textNodesMatching(doc, SEL.meta.libraryIdRegex)          // "Library ID|ID thư viện"
      .map(n => closestContainer(n, el => hasMediaOrDetailsButton(el)))
      .filter(uniqueElements);
  },
  extract(card, ctx) {
    const txt = card.innerText;
    const id = match(txt, SEL.meta.libraryIdRegex, 2);
    const dates = parseMetaDates(txt);                               // started / range
    const link = card.querySelector('a[href*="l.facebook.com/l.php"], a[target=_blank][href^="http"]');
    return {
      source: this.source, page_url: ctx.pageUrl, captured_at: nowIso(),
      native_ad_id: id,
      advertiser_name: textOf(findAdvertiserLink(card)),
      advertiser_id: new URL(ctx.pageUrl).searchParams.get('view_all_page_id'),
      status_raw: matchAny(txt, SEL.meta.statusLabels),
      start_date_raw: dates.start, end_date_raw: dates.end,
      platforms_raw: platformLabels(card),
      body_text: largestTextBlock(card), body_truncated: /see more|xem thêm/i.test(txt),
      headline: linkPreview(card).headline, description: linkPreview(card).caption, cta_text: linkPreview(card).cta,
      media: mediaOf(card, { minWidth: 200 }),
      format_raw: detectFormat(card),
      variant_count: Number(match(txt, SEL.meta.variantRegex, 1) ?? 1),
      ad_url: id ? `https://www.facebook.com/ads/library/?id=${id}` : null,
      landing_url_raw: link ? unwrapFbRedirect(link.href) : null,
      country_filter: new URL(ctx.pageUrl).searchParams.get('country'),
      confidence: scoreConfidence({ id, body: true, date: dates.start, media: true }),
      extractor_version: 'meta@0.1.0'
    };
  }
};
```

### 10.2 Background Service Worker

```js
// service-worker.js — mọi state trong storage, không trong biến global
chrome.runtime.onMessage.addListener((msg, sender, reply) => {
  handlers[msg.type]?.(msg, sender).then(reply);
  return true;                                                      // async reply
});

const handlers = {
  async LOOKUP({ ad_uid, fp }) {
    const idx = await IndexCache.get(ad_uid);
    if (!idx) return 'NEW';
    return idx.fp === fp ? 'KNOWN' : 'CHANGED';
  },

  async ENQUEUE({ captures, context }) {                            // từ popup "Lưu"
    const out = [];
    for (const cap of dedupeByUid(captures)) {
      const rec = normalize(cap, context);                          // file 04 §6.6
      rec.ad_uid     = rec.native_ad_id ? `${SRC_PREFIX[rec.source]}:${rec.native_ad_id}` : null;
      rec.content_fp = await sha256(contentKey(rec));               // file 05 §7.1
      rec.creative_fp = await sha256(creativeKey(rec.media_urls));
      rec.ad_uid ??= `fp:${rec.content_fp.slice(0, 16)}`;
      const known = await IndexCache.get(rec.ad_uid);
      rec.mode  = known && known.fp === rec.content_fp ? 'TOUCH' : 'FULL';
      rec.state = validateClient(rec).length ? 'INCOMPLETE' : 'READY';
      out.push(rec);
    }
    await Queue.addMany(out);                                       // IndexedDB
    await updateBadge();
    return { queued: out.length };
  },

  async SEND({ client_ids }) {                                      // từ Side Panel "Gửi"
    const recs = (await Queue.getMany(client_ids)).filter(r => r.state === 'READY');
    for (const batch of chunk(recs, 50)) {
      const request_id = crypto.randomUUID();
      await Queue.mark(batch, 'SENDING', { request_id });
      const res = await Api.call('ads.upsert', { client: clientInfo(), records: batch.map(toWire) }, request_id);
      await applyResults(batch, res);                               // xóa INSERTED/UPDATED/TOUCHED, giữ REJECTED + lỗi
      await IndexCache.merge(res.results);
    }
    await setSyncStatus();
  }
};

// api.js
const Api = {
  async call(action, payloadObj, request_id = crypto.randomUUID(), attempt = 0) {
    const { endpoint, user_id, secret } = await Settings.get();
    const payload = JSON.stringify(payloadObj);
    const ts = Math.floor(Date.now() / 1000), nonce = randomHex(16);
    const sig = await hmacHex(secret, `${ts}\n${nonce}\n${payload}`);
    let res;
    try {
      const r = await fetch(endpoint, { method: 'POST', redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ v: 1, action, request_id, auth: { user_id, ts, nonce, sig }, payload }) });
      res = await r.json();
    } catch (e) { res = { ok: false, error: { code: 'NETWORK', retryable: true } }; }
    if (!res.ok && res.error?.retryable && attempt < 4) {
      await sleep(2000 * 2 ** attempt);                             // 2s, 4s, 8s, 16s
      return this.call(action, payloadObj, request_id, attempt + 1); // cùng request_id → idempotent
    }
    return res;
  }
};

// Retry nền cho queue còn lỗi retryable khi SW bị tắt giữa chừng
chrome.alarms.create('retry-queue', { periodInMinutes: 5 });
chrome.alarms.create('refresh-index', { periodInMinutes: 360 });
chrome.alarms.onAlarm.addListener(a => a.name === 'retry-queue' ? retryPending() : IndexCache.refresh());
```

### 10.3 Apps Script

```js
// Code.gs
function doGet(e)  { return json_(route_(e.parameter.action, e, 'GET')); }
function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (_) { return json_(err_('BAD_JSON', false)); }
  return json_(route_(body.action, body, 'POST'));
}
function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

// Router.gs
const ROUTES = {
  'health':          { auth: false, fn: () => ({ ok: true, schema_version: 1, time: new Date().toISOString() }) },
  'config.get':      { auth: true,  fn: getConfig_ },
  'index.get':       { auth: true,  fn: getIndex_ },
  'ads.upsert':      { auth: true,  fn: upsertAds_ },
  'landing.upsert':  { auth: true,  fn: upsertLanding_ },
  'trends.upsert':   { auth: true,  fn: upsertTrends_ },
  'analysis.upsert': { auth: true,  fn: upsertAnalysis_ },
  'searchurl.opened':{ auth: true,  fn: markUrlOpened_ },
  'log.client':      { auth: true,  fn: logClient_ }
};
function route_(action, body, method) {
  const r = ROUTES[action];
  if (!r) return err_('UNKNOWN_ACTION', false);
  const t0 = Date.now();
  try {
    let user = null, payload = null;
    if (r.auth) {
      user = verifyAuth_(body);                       // throws ApiError
      payload = JSON.parse(body.payload);
      const cached = CacheService.getScriptCache().get('req:' + body.request_id);
      if (cached) return JSON.parse(cached);          // idempotent
    }
    const res = r.fn(payload, { user, request_id: body.request_id, t0 });
    if (body.request_id) CacheService.getScriptCache().put('req:' + body.request_id, JSON.stringify(res), 21600);
    return res;
  } catch (e) {
    logError_(action, e, body);
    return err_(e.code || 'INTERNAL', e.retryable ?? true, e.message);
  }
}

// Auth.gs
function verifyAuth_(body) {
  const a = body.auth || {};
  const secret = PropertiesService.getScriptProperties().getProperty('SECRET_' + a.user_id);
  if (!secret) throw apiErr_('AUTH_UNKNOWN_USER', false);
  if (Math.abs(Date.now() / 1000 - a.ts) > 300) throw apiErr_('AUTH_EXPIRED_TS', true);
  const cache = CacheService.getScriptCache();
  if (cache.get('nonce:' + a.nonce)) throw apiErr_('AUTH_REPLAY', false);
  const expected = toHex_(Utilities.computeHmacSha256Signature(`${a.ts}\n${a.nonce}\n${body.payload}`, secret));
  if (!constantTimeEq_(expected, a.sig)) throw apiErr_('AUTH_INVALID_SIGNATURE', false);
  cache.put('nonce:' + a.nonce, '1', 600);
  return { user_id: a.user_id };
}

// Upsert.gs
function upsertAds_(p, ctx) {
  if (p.records.length > 50) throw apiErr_('PAYLOAD_TOO_LARGE', true);
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) throw apiErr_('LOCK_TIMEOUT', true);
  try {
    const repo = new SheetRepo('RAW_ADS');                          // headerMap theo tên cột
    const keys = repo.readColumns(['ad_uid', 'content_fp', 'creative_fp', 'cluster_id', 'version', 'seen_count', 'last_seen_at']);
    const byUid = indexBy(keys, 'ad_uid'), byFp = indexBy(keys, 'content_fp'), byCreative = indexBy(keys, 'creative_fp');
    const inserts = [], updates = [], history = [], results = [];
    const now = new Date();

    for (const r of p.records) {
      const errors = validateAd_(r);                                // Schema.gs: bắt buộc, kiểu, độ dài, enum
      if (errors.length) { results.push({ client_id: r.client_id, status: 'REJECTED', errors }); continue; }
      sanitizeFormulaInjection_(r);
      r.content_fp = r.mode === 'FULL' ? recomputeFp_(r) : r.content_fp;   // server kiểm lại fp
      const ex = byUid[r.ad_uid];

      if (ex && (r.mode === 'TOUCH' || ex.content_fp === r.content_fp)) {
        updates.push({ row: ex._row, set: touchFields_(ex, r, now) });   // last_seen_at, seen_count, is_active, end_date
        results.push({ client_id: r.client_id, status: 'TOUCHED', record_id: ex.record_id });
      } else if (ex) {
        const full = repo.readRow(ex._row);
        const diff = diffFields_(full, r, TRACKED_FIELDS);             // body_text, headline, cta_text, landing_url, media_urls, format…
        history.push(historyRow_(full, r, diff, ctx.user, now));
        updates.push({ row: ex._row, set: { ...mutableFields_(r), version: ex.version + 1, change_flag: 'UPDATED', updated_at: now } });
        results.push({ client_id: r.client_id, status: 'UPDATED', record_id: ex.record_id, changed_fields: diff.fields });
      } else {
        const twin = byFp[r.content_fp] || byCreative[r.creative_fp];
        const flags = byFp[r.content_fp] ? ['REPEATED_CREATIVE'] : byCreative[r.creative_fp] ? ['CREATIVE_REUSED_NEW_COPY'] : [];
        const row = newAdRow_(r, ctx.user, now, twin ? twin.cluster_id : nextClusterId_());
        inserts.push(row);
        byUid[r.ad_uid] = row; byFp[r.content_fp] = row;               // dedup trong cùng batch
        results.push({ client_id: r.client_id, status: 'INSERTED', record_id: row.record_id, cluster_id: row.cluster_id, flags });
      }
    }
    repo.appendRows(inserts);                                       // 1 lần setValues
    repo.updateCells(updates);                                      // gom theo cột → RangeList
    new SheetRepo('AD_HISTORY').appendRows(history);
    new SheetRepo('AD_ANALYSIS').appendRows(inserts.map(x => ruleAnalysis_(x)));   // Rules.gs
    SpreadsheetApp.flush();
    const summary = summarize_(results);
    writeRunLog_({ ctx, action: 'ads.upsert', source: p.records[0]?.source, found: p.client?.found_on_page, summary, results });
    return { ok: true, request_id: ctx.request_id, summary, results };
  } finally { lock.releaseLock(); }
}

// Jobs.gs — cài bằng Setup: ScriptApp.newTrigger(...).timeBased()
function nightlyRecompute() {        // 02:00 hằng ngày
  // 1) is_active cho Google: last_shown > 2 ngày → INACTIVE
  // 2) run_days, is_long_running, priority_signal (nếu không dùng công thức)
  // 3) near-duplicate clustering trong cùng advertiser (Jaccard trigram)
  // 4) rebuild OPPORTUNITIES (angle aggregates)
  // 5) Phase 2: đẩy record chưa có AI vào Claude Batch
}
function weeklyReport() {            // Thứ Hai 08:45
  const data = buildReportData_(lastWeekRange_());                  // chỉ dữ liệu tổng hợp + record_id
  writeWeeklyReportSheet_(data);
  const doc = renderDocFromTemplate_(data);                         // DocumentApp, template có placeholder
  MailApp.sendEmail({ to: getConfig_('report_recipients'), subject: `[CAI] Báo cáo đối thủ tuần ${data.weekLabel}`, htmlBody: summaryHtml_(data, doc.getUrl()) });
}
```

### 10.4 Phase 2 — gọi Claude từ Apps Script (Ai.gs)

Apps Script không có SDK chính thức nên dùng REST qua `UrlFetchApp`. API key lưu `ANTHROPIC_API_KEY` trong Script Properties.

```js
const CLAUDE_MODEL = 'claude-opus-5';        // mặc định. Đội có thể đo và chọn model rẻ hơn cho phân loại hàng loạt

const AD_SCHEMA = { type: 'object', additionalProperties: false,
  required: ['hook','pain_point','desire','value_proposition','offer','offer_type','proof','objection',
             'creative_angle','secondary_angles','funnel_stage','framework','target_audience_assumption',
             'differentiation_level','learnings','copy_risk','confidence','evidence_quotes'],
  properties: {
    hook: {type:'string'}, pain_point: {type:'string'}, desire: {type:'string'}, value_proposition: {type:'string'},
    offer: {type:'string'}, offer_type: {enum:['FREE_TRIAL','DISCOUNT','FREE_RESOURCE','EVENT','DEMO','GUARANTEE','NONE']},
    proof: {type:'string'}, objection: {type:'string'},
    creative_angle: {enum: ANGLES}, secondary_angles: {type:'array', items:{enum: ANGLES}},
    funnel_stage: {enum:['TOFU','MOFU','BOFU','UNCLASSIFIED']},
    framework: {enum:['PAS','BAB','AIDA','SOCIAL_PROOF','FAB','OTHER','NONE']},
    target_audience_assumption: {type:'string'},
    differentiation_level: {type:'integer'}, learnings: {type:'string'},
    copy_risk: {enum:['LOW','MED','HIGH']}, confidence: {type:'number'},
    evidence_quotes: {type:'array', items:{type:'string'}}   // trích nguyên văn từ quảng cáo làm căn cứ
  } };

function classifyAd_(ad) {
  const body = {
    model: CLAUDE_MODEL,
    max_tokens: 2000,
    output_config: { effort: 'low', format: { type: 'json_schema', schema: AD_SCHEMA } },
    system: [{ type: 'text', text: SYSTEM_PROMPT_CLASSIFY, cache_control: { type: 'ephemeral' } }], // taxonomy + định nghĩa: tiền tố ổn định, cache được
    messages: [{ role: 'user', content: JSON.stringify(pick(ad, ['platforms','advertiser_name','body_text','headline','description','cta_text','format','landing_url','audience_side'])) }],
    fallbacks: 'default'
  };
  const res = UrlFetchApp.fetch('https://api.anthropic.com/v1/messages', {
    method: 'post', contentType: 'application/json', muteHttpExceptions: true,
    headers: { 'x-api-key': prop_('ANTHROPIC_API_KEY'), 'anthropic-version': '2023-06-01',
               'anthropic-beta': 'server-side-fallback-2026-07-01' },
    payload: JSON.stringify(body)
  });
  const msg = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200) throw apiErr_('AI_HTTP_' + res.getResponseCode(), res.getResponseCode() >= 429);
  if (msg.stop_reason === 'refusal' || msg.stop_reason === 'max_tokens') return null;   // để người review
  const text = msg.content.find(b => b.type === 'text').text;
  return { ...JSON.parse(text), analysis_source: `AI:${msg.model}@${today_()}` };
}
```

Ghi chú vận hành AI:
- **Nightly batch:** với hơn 20 record/đêm, dùng **Message Batches API** (`POST /v1/messages/batches`, rẻ hơn khoảng 50%, trả kết quả không đồng bộ). Trigger sau kiểm tra `processing_status == "ended"` rồi ghi kết quả theo `custom_id = record_id` (kết quả không theo thứ tự).
- **Prompt caching:** system prompt (taxonomy angle, định nghĩa framework, ví dụ gắn nhãn tay) giữ **nguyên văn** giữa các request để cache. Không chèn ngày giờ vào system.
- AI chỉ điền cột `*_auto`/`ai_*`. **Không ghi đè** cột `*_manual`.
- Báo cáo tuần (Phase 2) có output dài. `UrlFetchApp` có giới hạn thời gian chờ, nên đặt `max_tokens` vừa phải (~8000) và effort `medium`. Nếu hay timeout thì chuyển tác vụ sang API trung gian (Cloud Run) dùng SDK + streaming.
- Dữ liệu gửi AI: chỉ nội dung quảng cáo công khai + số liệu tổng hợp. Không gửi thông tin cá nhân hay secret.
