# 04 — Quy tắc trích xuất dữ liệu theo nền tảng

## 6.0 Nguyên tắc chung cho mọi adapter

1. **Chỉ đọc DOM đã render trên tab người dùng đang mở.** Không `fetch()` endpoint nội bộ (GraphQL/batchexecute) của nền tảng, không tự cuộn, không tự bấm phân trang, không mở hàng loạt modal "Xem chi tiết".
2. **Neo theo văn bản/ARIA, không neo theo class.** Meta/LinkedIn/Google dùng class sinh tự động, đổi thường xuyên. Adapter tìm **nhãn cố định** ("Library ID"/"ID thư viện", "Started running on"/"Bắt đầu chạy vào", "Last shown"/"Hiển thị lần cuối"…) rồi đi ngược lên container card. Mọi selector đặt trong file `selectors.{source}.json` có version, sửa không cần sửa logic.
3. **Song ngữ:** mỗi nhãn có từ điển VI + EN (nền tảng hiển thị theo ngôn ngữ tài khoản/trình duyệt).
4. **Mỗi trường trả về kèm `confidence`.** `extract_confidence` = trung bình có trọng số: ID (0.3), advertiser (0.2), body (0.2), date (0.15), media (0.15). Dưới 0.6 → gắn `Cần kiểm tra`.
5. **Không tìm thấy thì để trống**, không suy đoán. Người dùng nhập tay ở Side Panel.
6. **Khi gặp đăng nhập, CAPTCHA, "Bạn đang đi quá nhanh", checkpoint:** adapter dừng, trả `status: BLOCKED_BY_PLATFORM`, UI báo người dùng. Không retry tự động.
7. Output chung của adapter (`RawAdCapture`):

```json
{
  "client_id": "c_01J9…",           // ulid do content script tạo
  "source": "META_AD_LIBRARY",
  "page_url": "https://www.facebook.com/ads/library/?…",
  "captured_at": "2026-09-25T09:41:03+07:00",
  "native_ad_id": "1234567890123456",
  "advertiser_name": "TopCV",
  "advertiser_id": "123456789",
  "paid_for_by": null,
  "platforms_raw": ["Facebook", "Instagram", "Messenger"],
  "status_raw": "Active",
  "start_date_raw": "Started running on 2 Sep 2026",
  "end_date_raw": null,
  "body_text": "Bạn đang mất hàng giờ lọc CV? …",
  "headline": "Tuyển đúng người trong 7 ngày",
  "description": "topcv.vn",
  "cta_text": "Tìm hiểu thêm",
  "format_raw": "IMAGE",
  "media": [{"type": "image", "url": "https://scontent…fbcdn.net/…jpg?…", "poster": null}],
  "variant_count": 3,
  "ad_url": "https://www.facebook.com/ads/library/?id=1234567890123456",
  "landing_url_raw": "https://l.facebook.com/l.php?u=https%3A%2F%2Fwww.topcv.vn%2F…",
  "country_filter": "VN",
  "confidence": {"native_ad_id": 1, "body_text": 0.9, "start_date": 1, "media": 0.8},
  "extractor_version": "meta@0.1.0"
}
```

---

## 6.1 Meta Ad Library (Facebook, Instagram, Messenger, Audience Network)

**Nhận diện:** `location.host === 'www.facebook.com' && location.pathname.startsWith('/ads/library')`.

**URL tìm kiếm (sinh ở SEARCH_URLS):**
- Theo Page: `https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country=VN&view_all_page_id={PAGE_ID}&search_type=page&media_type=all`
- Theo từ khóa: `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=VN&q={ENCODED_KW}&search_type=keyword_unordered&media_type=all`
- Chi tiết 1 quảng cáo: `https://www.facebook.com/ads/library/?id={LIBRARY_ID}`

**Nhận diện card:** tìm text node khớp `/(Library ID|ID thư viện)\s*[:：]\s*(\d{6,})/`, đi lên tổ tiên gần nhất chứa cả nút "See ad details / Xem chi tiết quảng cáo" **hoặc** chứa ảnh/video. Đó là container card.

| Trường | Quy tắc | Fallback |
|---|---|---|
| `native_ad_id` | Regex trên → nhóm 2 | Tham số `id=` trong link chi tiết |
| `status_raw` | Text "Active"/"Đang hoạt động" hoặc "Inactive"/"Không hoạt động" trong card | UNKNOWN |
| `start_date_raw` | `/(Started running on|Bắt đầu chạy vào( ngày)?)\s+(.+)/`. Với inactive: dạng khoảng `2 Sep 2026 - 20 Sep 2026` → tách start/end | trống |
| `platforms_raw` | Mục "Platforms/Nền tảng": icon có `aria-label`/`alt` hoặc tooltip | trống |
| `advertiser_name` | Link tới page (href `facebook.com/{slug}` hoặc `/profile.php?id=`) trong header card, text của link | Tên trong dòng "Sponsored/Được tài trợ" |
| `advertiser_id` | Tham số `view_all_page_id` của URL hiện tại (search theo page), hoặc id trong href | Map từ COMPETITORS theo tên |
| `body_text` | Khối text lớn nhất dưới header, trước media. Nếu bị cắt "… See more", **chỉ lấy phần đang hiển thị**, đặt cờ `body_truncated=true`. Người dùng có thể tự mở rộng rồi chụp lại | — |
| `media` | `img` trong vùng creative có `naturalWidth ≥ 200` (loại avatar/icon). `video` → `poster` + `src` nếu là URL http(s) (bỏ `blob:`) | trống |
| `format_raw` | Có `video` → VIDEO. Nhiều media ngang có nút điều hướng → CAROUSEL. Text "multiple versions/nhiều phiên bản" → DYNAMIC. Còn lại IMAGE | UNKNOWN |
| `headline`, `description`, `cta_text` | Vùng link preview dưới media: dòng domain in hoa (description/caption), dòng đậm (headline), nút (cta) | trống |
| `landing_url_raw` | `href` của link preview. Nếu là `l.facebook.com/l.php?u=…` → decode tham số `u` | trống |
| `variant_count` | `/(\d+)\s+(ads use this creative and text|quảng cáo sử dụng)/` | 1 |
| `ad_url` | `https://www.facebook.com/ads/library/?id={native_ad_id}` | |

**Giới hạn & điều khoản cần kiểm tra**
- **Meta Ad Library API** (`ads_archive`) chỉ trả **quảng cáo chính trị/xã hội** trên toàn cầu và quảng cáo thương mại **phân phối tới EU/UK**. Quảng cáo thương mại chạy riêng tại VN **không** có qua API → phương án bán tự động qua UI là chính. Khi đối thủ chạy thêm thị trường EU có thể dùng API (Phase 2). Cần xác minh danh tính + tạo app Meta.
- Điều khoản Meta cấm thu thập tự động khi chưa có phép ("Automated Data Collection Terms"). Thiết kế này chỉ lưu những gì người dùng đang xem và chọn. **Pháp chế cần xác nhận** trước khi dùng rộng.
- URL ảnh/video trên `fbcdn.net` là **URL ký có hạn** (tham số `oe=`), thường hết hạn sau vài ngày. Muốn giữ ảnh thì phải lưu thumbnail vào Drive nội bộ (Phase 2, chỉ dùng tham khảo nội bộ, không tái sử dụng công khai).
- Không có dữ liệu chi tiêu/hiển thị cho quảng cáo thương mại tại VN, nên **không** suy ra ngân sách.

---

## 6.2 LinkedIn Ad Library

**Nhận diện:** `location.host === 'www.linkedin.com' && location.pathname.startsWith('/ad-library')`.

**URL (cần xác minh tham số trên bản UI hiện tại trước khi code):**
- Tìm theo công ty: `https://www.linkedin.com/ad-library/search?accountOwner={ENCODED_COMPANY}&countries=VN&dateOption=last-30-days`
- Tìm theo từ khóa: `https://www.linkedin.com/ad-library/search?keyword={ENCODED_KW}&countries=VN`
- Chi tiết: `https://www.linkedin.com/ad-library/detail/{AD_ID}`

**Card:** mỗi kết quả là một khối có link `/ad-library/detail/{id}` ("View details"/"Xem chi tiết"). Container = tổ tiên gần nhất chứa link đó và chứa text "Promoted"/"Được quảng bá".

| Trường | Trang kết quả | Trang chi tiết (người dùng mở) |
|---|---|---|
| `native_ad_id` | Regex `/ad-library\/detail\/(\d+)/` trên href | từ URL |
| `advertiser_name` | Tên công ty ở header card | Header |
| `advertiser_id` | href `/company/{slug-or-id}` nếu có | |
| `body_text` | Commentary (text chính) | Đầy đủ hơn |
| `headline` / `cta_text` | Dưới media | |
| `format_raw` | Suy từ cấu trúc (video, carousel, document, event, message, text, spotlight) | Nhãn "Ad format"/"Định dạng quảng cáo" |
| `paid_for_by` | — | "Paid for by"/"Được trả tiền bởi" |
| `start_date_raw` / `end_date_raw` | — | "Ran from {date} to {date}" |
| Targeting / impressions | — | Chỉ hiện với một số khu vực (ví dụ EU). Nếu có thì lưu nguyên văn vào `notes`, **không** diễn giải thành hiệu quả |
| `landing_url_raw` | href nút CTA (có thể qua redirect `linkedin.com/redir`) → decode `url=` | |

**Giới hạn**
- Thư viện chỉ có dữ liệu trong khoảng thời gian LinkedIn công bố (khoảng 1 năm gần nhất) và có thể không có đủ trường với quảng cáo ngoài EU.
- User Agreement của LinkedIn cấm scraping/bot. Chỉ dùng thao tác người dùng. Nếu trang yêu cầu đăng nhập thì người dùng tự đăng nhập bằng tài khoản của mình. Extension **không** đọc cookie `li_at` hoặc token.
- Sponsored post trên trang công ty (feed) cũng là nguồn tham khảo, nhưng **không** nằm trong host_permissions MVP. Người dùng dùng chế độ "Lưu thủ công" (dán text).

---

## 6.3 Google Ads Transparency Center (Search, YouTube, Display, Play, Maps, Shopping)

**Nhận diện:** `location.host === 'adstransparency.google.com'`.

**URL:**
- Theo domain: `https://adstransparency.google.com/?region=VN&domain={DOMAIN}`
- Theo advertiser: `https://adstransparency.google.com/advertiser/{AR_ID}?region=VN`
- Creative: `https://adstransparency.google.com/advertiser/{AR_ID}/creative/{CR_ID}?region=VN`
- Bộ lọc trên UI: platform, format, khoảng thời gian (người dùng tự chọn; nếu có tham số URL tương ứng thì SEARCH_URLS thêm vào sau khi xác minh).

**Card:** mỗi creative trong lưới là link tới `/advertiser/AR…/creative/CR…`. Container = phần tử chứa link đó.

| Trường | Quy tắc |
|---|---|
| `native_ad_id` | `{AR_ID}/{CR_ID}` từ href. `ad_uid = gatc:{AR}/{CR}` |
| `advertiser_name` | Tên hiển thị trên card/trang advertiser. Kèm trạng thái "Verified" nếu có |
| `paid_for_by` | Trang chi tiết: "Paid for by" |
| `format_raw` | Trang chi tiết: "Format: Text/Image/Video" |
| `end_date_raw` | "Last shown"/"Hiển thị lần cuối". `is_active` = ACTIVE nếu last shown ≤ 2 ngày trước ngày thu thập, ngược lại INACTIVE (ghi rõ đây là suy luận) |
| `start_date_raw` | "First shown" **chỉ khi trang hiển thị** (một số khu vực/loại quảng cáo). Không có thì dùng `first_seen_at` của hệ thống |
| `platforms_raw` | Theo bộ lọc platform đang chọn hoặc nhãn trong chi tiết |
| `media` | Ảnh preview (`img`) trong card/chi tiết. Video YouTube: link `youtube.com/watch?v=` nếu có |
| `body_text` / `headline` / `description` | Text ad thường render trong **iframe**. Nếu iframe cùng origin/đọc được thì lấy. Nếu khác origin thì **để trống + yêu cầu người dùng dán** (Side Panel có ô "Dán text quảng cáo"). Không vượt same-origin |
| `landing_url_raw` | Thường **không** công bố. Dùng display URL (domain hiển thị) → `final_domain`. Landing đầy đủ lấy khi người dùng tự click quảng cáo thật (không khuyến khích vì tốn tiền đối thủ và làm sai lệch số liệu của họ) hoặc từ trang đối thủ |

**Giới hạn**
- Không có dữ liệu chi tiêu. Số lần hiển thị (dạng khoảng) chỉ có với một số khu vực/quảng cáo chính trị.
- **BigQuery public dataset "Google Ads Transparency Center"** là nguồn chính thức, có thể truy vấn theo advertiser/region (Phase 2). Cần kiểm tra phạm vi dữ liệu cho VN và chi phí truy vấn.
- Điều khoản Google cấm truy cập tự động quy mô lớn. Chỉ thao tác người dùng.

---

## 6.4 Google Trends

**Nhận diện:** `location.host === 'trends.google.com' && pathname.includes('/explore')`.

**URL:** `https://trends.google.com/trends/explore?date=today%2012-m&geo=VN&q={kw1},{kw2},…&hl=vi` (tối đa **5** từ khóa/lần so sánh). Timeframe: `now 7-d`, `today 1-m`, `today 3-m`, `today 12-m`, `today 5-y`.

**Phương án ưu tiên (MVP): CSV Export do người dùng bấm.**
- Mỗi widget có nút ⬇ (Export CSV). Người dùng tải `multiTimeline.csv`, `relatedQueries.csv`, rồi kéo thả vào Side Panel → tab **Trends Import**.
- Parser:
  - `multiTimeline.csv`: bỏ dòng đầu ("Category: …") và dòng trống. Header `Week,{kw}: (Vietnam),…` → tách keyword bằng regex `/^(.*): \((.*)\)$/`. Giá trị `<1` → `0.5`. Ghi dạng long.
  - `relatedQueries.csv`: 2 section `TOP` và `RISING`. Rising có giá trị `Breakout` hoặc `+250%`.
- Siêu dữ liệu tự lấy từ URL tab đang mở: `geo`, `date`, `q`, `hl`.

**Phương án phụ: đọc DOM** của widget "Interest over time" (SVG line + tooltip) và danh sách "Related queries". Độ ổn định thấp nên chỉ dùng khi không export được.

**Quy tắc phân tích dữ liệu Trends**
- Giá trị 0–100 là **chỉ số tương đối trong cùng một lần truy vấn**. Không so hai batch với nhau nếu không có **anchor keyword** chung → `interest_norm = interest / anchor_interest`.
- Không diễn giải là "lượng tìm kiếm". Muốn có volume thì dùng Keyword Planner của tài khoản Google Ads của chính mình (Phase 2, API chính thức).
- **Google Trends API (alpha)** do Google công bố cho một số đối tác. Cần đăng ký và kiểm tra khả dụng. Nếu được cấp thì thay CSV import ở Phase 2.
- Nhiều truy vấn liên tục có thể gặp "429 Too Many Requests"/CAPTCHA. Extension không retry, chỉ báo người dùng chờ.

---

## 6.5 Landing page đối thủ

**Kích hoạt:** người dùng bấm "Lưu trang này làm Landing Page" (Popup) hoặc từ bản ghi quảng cáo "Mở & kiểm tra LP" → `chrome.scripting.executeScript({target:{tabId}, files:['adapters/landing.js']})` (quyền `activeTab`).

| Trường | Quy tắc |
|---|---|
| `url`, `final_url` | `location.href`. Bỏ tham số cá nhân (`fbclid`, `gclid`, `gbraid`, `wbraid`, `msclkid`, `_hs*`, `mc_eid`), **giữ** `utm_*` sang cột `utm` |
| `page_title`, `meta_description`, `og:*`, `canonical` | `document.title`, `meta[name=description]`, `meta[property^=og:]`, `link[rel=canonical]` |
| `h1` | `h1` đầu tiên hiển thị |
| Hero | Khối chứa `h1` + đoạn văn kế cận + nút đầu tiên |
| `primary_cta` / `secondary_ctas` | `a, button` hiển thị trong viewport đầu có class/role button, text ngắn ≤ 5 từ. Đếm tần suất, chọn cái xuất hiện ở hero làm primary |
| `offer` | Regex song ngữ: `miễn phí|free|dùng thử|trial|giảm|%|ưu đãi|tặng|voucher|khuyến mãi|\d+\s*(ngày|days)` trong heading/banner |
| `social_proof` | Regex số liệu `\d[\d.,]*\+?\s*(doanh nghiệp|khách hàng|nhà tuyển dụng|ứng viên|companies|customers)`, khối có `testimonial|review|đánh giá|khách hàng nói`, dãy logo (≥ 4 `img` cùng kích thước trong một hàng), sao đánh giá |
| `form_present`, `form_fields` | `form` hiển thị: lấy **label/placeholder** của các input. **Không đọc `value`**, không bao giờ submit |
| `pricing_visible` | Có `₫|VNĐ|VND|đ/tháng|/month|\$` gần từ "gói|plan|bảng giá|pricing" |
| `funnel_stage` | Rule ở file 05 §7.5 áp cho LP |
| `section_hashes_json` | SHA-256 của text chuẩn hóa từng section: hero, offer, cta, proof, form, pricing |
| `url_status` | Thành công → OK. Trang lỗi/404 → giá trị theo `document.title`/nội dung. Phase 2: Apps Script `UrlFetchApp` kiểm HTTP status hằng tuần cho danh sách LP đã biết (≤ 1 request/URL/tuần, tôn trọng `robots.txt`) |

---

## 6.6 Chuẩn hóa dùng chung (Service Worker)

| Việc | Quy tắc |
|---|---|
| Ngày | Parser đa locale: `2 Sep 2026`, `Sep 2, 2026`, `2 thg 9, 2026`, `02/09/2026` (VN = dd/MM), `2 tháng 9 năm 2026` → ISO `2026-09-02`. Không parse được → giữ `*_raw`, trường ngày để trống |
| Text | NFC Unicode, trim, gộp khoảng trắng, bỏ zero-width, giữ emoji trong `body_text` gốc. Bản **để hash** thì lowercase, bỏ emoji/ký tự trang trí, bỏ URL, gộp số `1.000`→`1000` |
| URL | lowercase host, bỏ `www.`, bỏ fragment, bỏ tham số tracking (danh sách ở 6.5), sắp xếp query còn lại, bỏ `/` cuối |
| Domain | Registrable domain (dùng Public Suffix List rút gọn cho `.vn`, `.com.vn`, `.edu.vn`…) |
| CTA | Từ điển map: `Tìm hiểu thêm/Learn more → LEARN_MORE`; `Đăng ký/Sign up → SIGN_UP`; `Đặt lịch demo/Book a demo/Request demo → BOOK_DEMO`; `Dùng thử/Try free/Start free trial → FREE_TRIAL`; `Liên hệ/Contact us → CONTACT`; `Tải xuống/Download → DOWNLOAD`; `Đăng ký tham gia/Register → REGISTER_EVENT`; `Ứng tuyển/Apply now → APPLY_NOW`; `Nhận báo giá/Get quote → GET_QUOTE`; `Gửi tin nhắn/Send message → SEND_MESSAGE` |
| Platform | Map nhãn → enum LISTS.platform |
| Ngôn ngữ | Heuristic: tỷ lệ ký tự có dấu tiếng Việt > 3% → `vi`. Có cả hai → `mixed` |
| `audience_side` | Từ điển: EMPLOYER nếu có `nhà tuyển dụng|doanh nghiệp|HR|tuyển dụng nhân sự|đăng tin|ứng viên phù hợp|ATS|employer|hiring`; CANDIDATE nếu `việc làm|tìm việc|CV của bạn|ứng tuyển|lương|job seeker|apply`. Điểm cao hơn thắng, chênh < 1 → UNKNOWN. Landing path chứa `/employer|/nha-tuyen-dung|/recruiter` → +2 EMPLOYER |
| Đối thủ | Tra `advertiser_id` → `COMPETITORS.meta_page_id/google_advertiser_id`. Không có thì tra tên (fuzzy, không phân biệt dấu). Không khớp → dùng lựa chọn ở Popup |
| Quảng cáo của chính mình | `final_domain == CONFIG.brand_domain` → gắn tag `own-brand`, loại khỏi dashboard đối thủ |
