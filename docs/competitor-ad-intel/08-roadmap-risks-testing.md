# 08 — Lộ trình MVP, Phase 2, Rủi ro, Kiểm thử và Nghiệm thu

## 13. Kế hoạch MVP (4 tuần, có thể nén còn 2 tuần)

**Nhân sự:** 1 Dev JS/Apps Script (full-time 4 tuần hoặc 2 dev × 2 tuần) · 1 PM/Marketer (product owner, 30% thời gian) · 1 UI/UX (tuần 1, 50%) · 2 marketer làm UAT (tuần 4).

**Phạm vi bắt buộc MVP**

| Hạng mục | Bắt buộc MVP | Để Phase 2 |
|---|---|---|
| Nguồn | Meta Ad Library, Google ATC, LinkedIn Ad Library, Trends (CSV import), Landing page (activeTab) | Trends API chính thức, Meta Ad Library API (quảng cáo EU), BigQuery ATC |
| Extension | Detector, 5 adapter, overlay chọn card, Popup, Side Panel Review Queue, Options, queue + retry, fingerprint, dedup cục bộ | Launchpad mở nhóm tab, lưu thumbnail Drive, dHash ảnh, đa ngôn ngữ UI đầy đủ |
| Apps Script | Router, HMAC auth, schema validate, `ads.upsert` / `landing.upsert` / `trends.upsert` / `analysis.upsert` / `index.get` / `config.get`, AD_HISTORY, RUN_LOG, Setup.gs | API trung gian OAuth, near-dup clustering nâng cao |
| Sheets | 14 tab, named ranges, validation, công thức rule, Dashboard 10 khối | Looker Studio |
| Phân tích | Rule funnel/framework/angle/offer/audience + chỉnh tay, long-running, priority_signal, opportunity score | Claude phân loại, embedding clustering, similarity check tự động |
| Báo cáo | WEEKLY_REPORT sheet + Doc từ template + email, phần nhận định viết tay | AI viết nháp nhận định + giả thuyết + concept |

**Kế hoạch theo tuần**

| Tuần | Mục tiêu | Deliverable | Mốc kiểm tra |
|---|---|---|---|
| **W1 — Nền móng** | Chốt schema và hợp đồng API. Setup Sheet + Apps Script. Khung Extension | `Setup.gs` tạo đủ tab/named range/validation · `health`, `config.get`, `ads.upsert` (TOKEN auth) chạy được · Extension skeleton MV3 + Options + gọi `health` · Wireframe Popup/Side Panel duyệt xong · Pháp chế review phạm vi thu thập (§15) | Gửi 1 bản ghi giả từ Extension vào RAW_ADS thành công |
| **W2 — Thu thập** | Adapter Meta + Google ATC + overlay + queue | Adapter Meta, Google ATC với fixture test (HTML đã lưu) · Overlay Shadow DOM · normalize + fingerprint · Review Queue sửa/tag/gửi · HMAC auth · dedup 2 tầng + AD_HISTORY | Thu thập 30 QC Meta + 20 QC Google thật, 0 trùng, UPDATE đúng khi sửa nội dung |
| **W3 — Mở rộng + phân tích** | LinkedIn, Trends CSV, Landing page, rules | Adapter LinkedIn, Trends CSV parser, Landing adapter + section hash + change detection · Rules.gs + công thức AD_ANALYSIS · long-running, priority_signal · OPPORTUNITIES | Rule funnel/angle đúng ≥ 70% trên 50 QC gắn nhãn tay |
| **W4 — Dashboard, báo cáo, UAT** | Dashboard, weekly report, kiểm thử, tài liệu | DASHBOARD 10 khối · `weeklyReport` trigger + template Doc + email · RUN_LOG đầy đủ · Hướng dẫn sử dụng 2 trang + video 5 phút · UAT 2 marketer trong 1 tuần thật · Sửa lỗi | Đạt tiêu chí nghiệm thu §16 |

**Phương án nén 2 tuần:** W1 = W1 + adapter Meta. W2 = Google ATC + Trends CSV + Dashboard tối giản (khối 1, 2, 3, 6) + báo cáo tay. LinkedIn và Landing page chuyển sang tuần 3–4 dưới dạng "nhập thủ công có form" trong Side Panel.

---

## 14. Phase 2 — AI phân loại & báo cáo

**Điều kiện bắt đầu:** MVP chạy ổn ≥ 4 tuần, có ≥ 200 quảng cáo, trong đó ≥ 100 đã gắn nhãn tay (làm tập đánh giá).

| Hạng mục | Thiết kế | Tiêu chí thành công |
|---|---|---|
| **P2.1 AI phân loại quảng cáo** | `Ai.gs` gọi Claude API (model mặc định `claude-opus-5`, `output_config.format` JSON Schema, effort `low`) → điền `*_auto`, `ai_confidence`, `evidence_quotes`. Hằng đêm dùng Message Batches API. System prompt (taxonomy + định nghĩa + 10 ví dụ gắn nhãn tay) giữ ổn định để prompt caching | Đồng thuận với nhãn tay ≥ 85% (funnel), ≥ 75% (angle), ≥ 80% (framework) trên tập đánh giá. `confidence < 0.6` → hàng đợi review |
| **P2.2 Clustering creative angle** | Embedding body+headline → HDBSCAN/k-means (chạy ở API trung gian, Python) → Claude đặt tên cluster, map về taxonomy, đề xuất angle mới | Marketer chấp nhận ≥ 70% tên cluster |
| **P2.3 Similarity & copy-risk** | Embedding cosine giữa ý tưởng đề xuất và toàn bộ RAW_ADS. ≥ 0.85 → HIGH | 0 ý tưởng HIGH lọt vào báo cáo |
| **P2.4 AI viết nháp báo cáo tuần** | Input = **dữ liệu tổng hợp** (bảng Top, heatmap, trends, LP changes, opportunities + record_id). Prompt ràng buộc: mọi nhận định phải trích record_id, cấm suy diễn ngân sách/hiệu quả/ROAS, phân biệt "quan sát" với "giả thuyết", tuân brand voice Link Talent. Output: Doc nháp + trạng thái `DRAFT` → người duyệt → `APPROVED` → gửi | ≥ 80% nội dung giữ lại sau review. 0 claim không có bằng chứng |
| **P2.5 Sinh giả thuyết + concept** | Từ OPPORTUNITIES top + gaps → 5–10 giả thuyết (Nếu–Thì–Vì) + concept/headline/CTA nguyên bản → chạy P2.3 | Mỗi tuần ≥ 2 giả thuyết được đưa vào backlog test |
| **P2.6 API trung gian** | Cloud Run hoặc Cloudflare Workers: OAuth Google (chrome.identity), rate limit, ghi Sheets API bằng service account, host tác vụ AI dài (SDK + streaming) | Thu hồi quyền theo user tức thì, p95 < 2 giây |
| **P2.7 Nguồn chính thức** | Meta Ad Library API (khi quảng cáo có phân phối EU/UK) · BigQuery Google Ads Transparency public dataset · Google Trends API alpha (nếu được cấp) · Keyword Planner (tài khoản Google Ads của mình) | Giảm ≥ 30% thao tác tay cho các nguồn này |
| **P2.8 Giám sát LP định kỳ** | Trigger tuần: `UrlFetchApp` kiểm HTTP status + hash cho LP đã biết (≤ 1 request/URL/tuần, tôn trọng robots.txt, user-agent rõ ràng) | Phát hiện LP chết/đổi trong ≤ 7 ngày |
| **P2.9 Looker Studio + BigQuery** | Khi RAW_ADS > 50k dòng hoặc cần chia sẻ rộng | Dashboard tải < 5 giây |
| **P2.10 Cảnh báo** | Email/Slack khi: đối thủ ưu tiên ra > N QC mới/ngày, LP đổi offer, keyword Breakout | Báo động giả < 20% |

**Kiểm soát chất lượng AI:** lưu `analysis_source = AI:{model}@{date}` và phiên bản prompt. Mỗi tháng lấy mẫu 30 bản ghi để đối chiếu với nhãn tay. Đổi prompt/model thì chạy lại tập đánh giá trước khi áp dụng.

---

## 15. Rủi ro, giới hạn và biện pháp

### 15.1 Tuân thủ & pháp lý

| Rủi ro | Mức | Biện pháp |
|---|---|---|
| Vi phạm ToS nền tảng (Meta Automated Data Collection Terms, LinkedIn User Agreement cấm scraping, Google ToS) | Cao | Chỉ thao tác do người dùng kích hoạt trên trang họ đang xem. Không crawl nền, không tự cuộn/phân trang, không gọi API ẩn, không chạy headless. Giới hạn 100 card/lần, 5 tab/lần. **Pháp chế review trước go-live**, ghi lại kết luận. Ưu tiên API/export chính thức khi có |
| Vượt đăng nhập/CAPTCHA/rate limit | Cao | Adapter phát hiện và **dừng**. Không retry tự động. Không đọc cookie/token. Không dùng proxy xoay IP |
| Dữ liệu cá nhân (PDPL Việt Nam — Nghị định 13/2023/NĐ-CP, Luật Bảo vệ dữ liệu cá nhân) | Trung bình | Không thu thập bình luận, người tương tác, avatar cá nhân. Form LP chỉ lấy nhãn trường. Log không chứa PII. Chính sách lưu trữ 24 tháng |
| Bản quyền creative đối thủ | Trung bình | Chỉ lưu tham chiếu/thumbnail để phân tích nội bộ, không tái sử dụng công khai. Rule "không sao chép" + copy_risk check |
| Kết luận sai về hiệu quả/ngân sách | Trung bình | Thuật ngữ "tín hiệu ưu tiên", chú thích bắt buộc trên Dashboard/báo cáo, prompt AI cấm suy diễn, mọi nhận định có record_id |
| Quảng cáo so sánh | Thấp | Đề xuất concept không nêu tên đối thủ. Claim phải có bằng chứng (Luật Quảng cáo) |

### 15.2 Kỹ thuật

| Rủi ro/giới hạn | Biện pháp |
|---|---|
| DOM nền tảng thay đổi, adapter hỏng | Neo theo text/ARIA, selector tách file JSON có version, fixture test hằng tuần (người dùng lưu lại 1 trang HTML mẫu), `extract_confidence` + client log `log.client` báo lỗi hàng loạt, cho phép nhập tay |
| URL media fbcdn hết hạn | Lưu `media_drive_url` (Phase 2), dashboard dùng link thư viện `ad_url` làm nguồn chính |
| Google ATC text trong iframe khác origin | Cho dán text thủ công. Không vượt same-origin |
| Thiếu `start_date` (Google) | Dùng first/last seen của hệ thống, gắn `run_days_source = OBSERVED` |
| Trends chỉ là chỉ số tương đối, ≤ 5 từ/lần | Anchor keyword chung giữa các batch, lưu `batch_id`, không so batch khác nhau khi không chuẩn hóa |
| Apps Script: không đọc header, luôn 200, giới hạn thời gian/đồng thời, quota | Auth trong body, envelope `ok/error`, batch ≤ 50, LockService, idempotency `request_id`, chuyển sang API trung gian khi > 10 user |
| Race condition khi nhiều người gửi | ScriptLock + đọc lại cột khóa trong lock |
| Ghi đè công thức mảng | `FORMULA_COLS` trong Repo + Protected ranges |
| Formula injection (`=IMPORTXML(...)` trong nội dung quảng cáo) | Tiền tố `'` cho chuỗi bắt đầu bằng `= + - @` |
| Secret lộ (extension có thể bị giải nén) | Secret theo user, không hardcode. Thu hồi bằng xóa Script Property. HMAC + ts + nonce. Phase 2 OAuth |
| Sheets chậm khi dữ liệu lớn | Hạn chế `MAP/LAMBDA` trên toàn cột (giới hạn vùng bằng `dash_days`), rule chạy trong Apps Script, lưu trữ theo năm, BigQuery ở Phase 2 |
| MV3 Service Worker bị tắt giữa chừng | State trong IndexedDB/storage, `chrome.alarms` retry |
| Chi phí AI tăng | Batch API, prompt caching, chỉ phân loại bản ghi FULL mới/đổi, effort thấp cho phân loại, theo dõi usage |

### 15.3 Vận hành & chất lượng dữ liệu

| Rủi ro | Biện pháp |
|---|---|
| Người dùng quên thu thập, dữ liệu thưa | Nhịp 60–90 phút/tuần cố định trên lịch. RUN_LOG theo dõi độ phủ nguồn/đối thủ. Dashboard hiển thị "Ngày thu thập gần nhất" từng đối thủ, cảnh báo nếu > 10 ngày |
| Thiên lệch mẫu (chỉ thấy những gì đã cuộn tới) | Ghi `found_on_page` vs `received`, khuyến nghị lọc `active` + cuộn hết trang cho đối thủ ưu tiên. Báo cáo nêu rõ giới hạn |
| Quảng cáo B2C ứng viên làm nhiễu | `audience_side` + filter mặc định EMPLOYER |
| Nhãn rule sai | Cột `*_manual` ưu tiên, đo độ chính xác rule hằng tháng, bổ sung từ điển trong LISTS (không cần dev) |

---

## 16. Checklist kiểm thử & tiêu chí nghiệm thu

### 16.1 Unit test (Extension — Jest/Vitest với fixture HTML)

- [ ] `detector` nhận đúng 5 nguồn và từ chối trang khác (≥ 10 URL mẫu mỗi nguồn).
- [ ] Adapter Meta: fixture active/inactive, image/video/carousel, VI/EN UI → đúng `native_ad_id`, ngày, status, variant_count.
- [ ] Adapter Google ATC: lưới + trang chi tiết, iframe không đọc được → body trống + confidence thấp.
- [ ] Adapter LinkedIn: kết quả + chi tiết "Ran from … to …".
- [ ] Trends CSV parser: `<1`, `Breakout`, nhiều keyword, header có tên quốc gia tiếng Việt.
- [ ] Landing: bỏ `fbclid/gclid`, giữ UTM, không đọc `value` input, section hash ổn định khi reload.
- [ ] `normalizeForHash`: cùng nội dung khác khoảng trắng/emoji/hoa-thường → cùng `content_fp`. Đổi UTM → **không** đổi fp. Đổi headline → đổi fp.
- [ ] Parser ngày: ≥ 12 định dạng VI/EN.
- [ ] HMAC client khớp với Apps Script (test vector chung).

### 16.2 Unit/integration test (Apps Script — chạy trên bản sao Sheet test)

- [ ] Auth: sai chữ ký / hết hạn ts / replay nonce / user lạ → đúng error code, không ghi dữ liệu.
- [ ] Schema: thiếu trường bắt buộc, enum sai, chuỗi > giới hạn → REJECTED từng bản ghi, bản ghi khác vẫn ghi.
- [ ] Upsert: INSERT → gửi lại y hệt → TOUCHED (seen_count tăng 1 nếu khác ngày) → sửa headline → UPDATED + 1 dòng AD_HISTORY + version 2.
- [ ] Cùng `content_fp` khác `ad_uid` → INSERT + REPEATED_CREATIVE + chung cluster_id.
- [ ] Trường manual (`tags`, `rating`, `notes`, `*_manual`) không bị ghi đè khi UPDATE. Tags được hợp nhất.
- [ ] Idempotency: gửi 2 lần cùng `request_id` → chỉ ghi 1 lần.
- [ ] Đồng thời: 5 request song song, mỗi request 50 bản ghi → không trùng dòng, không mất dòng.
- [ ] Formula injection: body bắt đầu bằng `=` → lưu dạng text.
- [ ] Không ghi vào cột công thức (`FORMULA_COLS`).
- [ ] RUN_LOG: mọi request có đúng 1 dòng, số liệu khớp response.

### 16.3 E2E / UAT (người dùng thật, Chrome stable)

- [ ] Luồng 11 bước hoàn thành trên cả 5 nguồn cho ít nhất 2 đối thủ.
- [ ] "Lưu tất cả đang hiển thị" với 100 card: không treo trang, < 10 giây đến khi vào queue.
- [ ] Mất mạng khi gửi → queue giữ lại → có mạng → tự gửi, không trùng.
- [ ] Trang yêu cầu đăng nhập/CAPTCHA → extension dừng, thông báo đúng, không có request tự động nào (kiểm tra DevTools Network).
- [ ] Extension không phát sinh request tới domain nền tảng ngoài các request trang tự tạo (kiểm tra Network).
- [ ] Dashboard cập nhật đúng sau sync (so với đếm tay 20 bản ghi).
- [ ] Báo cáo tuần tự sinh thứ Hai, đủ 8 mục, mọi nhận định có record_id.
- [ ] Hiệu năng: overlay không làm chậm cuộn rõ rệt (DevTools Performance, long task < 100 ms).
- [ ] Bảo mật: secret không xuất hiện trong Sheet, log, hay `chrome.storage.sync`.

### 16.4 Tiêu chí nghiệm thu MVP (Definition of Done)

| # | Tiêu chí | Ngưỡng |
|---|---|---|
| A1 | Nguồn hỗ trợ | 5/5 nguồn thu thập được (Trends qua CSV, Google text có thể nhập tay) |
| A2 | Độ chính xác trích xuất trường cốt lõi (ID, advertiser, ngày, body, CTA, format) trên 100 QC mẫu | ≥ 95% ID/advertiser, ≥ 90% các trường còn lại |
| A3 | Trùng lặp | 0 dòng trùng `ad_uid` trong RAW_ADS sau 2 tuần UAT |
| A4 | Phát hiện cập nhật | 100% trường hợp sửa nội dung trong bộ test tạo đúng AD_HISTORY |
| A5 | Tỷ lệ sync thành công | ≥ 99% request (không tính lỗi mạng do người dùng) |
| A6 | Tốc độ | Gửi batch 50 bản ghi < 8 giây p95 |
| A7 | Phân loại rule | Funnel ≥ 70%, angle ≥ 65% khớp nhãn tay trên 50 QC. 100% có thể sửa tay |
| A8 | Dashboard | 10 khối hiển thị đúng, có chú thích giới hạn dữ liệu |
| A9 | Báo cáo tuần | Tự sinh đúng lịch 2 tuần liên tiếp, đủ 8 mục, có 5–10 giả thuyết (viết tay ở MVP) |
| A10 | Tuân thủ | Pháp chế ký duyệt phạm vi. Checklist 16.3 mục Network/đăng nhập đạt 100% |
| A11 | Khả dụng | 2 marketer tự thực hiện nhịp tuần ≤ 90 phút sau 1 buổi hướng dẫn. SUS ≥ 70 |
| A12 | Tài liệu | Hướng dẫn sử dụng, hướng dẫn cập nhật selector, runbook thu hồi secret |

### 16.5 Tiêu chí nghiệm thu Phase 2 (tóm tắt)

AI phân loại đạt ngưỡng P2.1. Báo cáo AI: 0 claim không có bằng chứng trong 4 tuần liên tiếp. Copy-risk HIGH = 0 trong đề xuất. Chi phí AI/tháng nằm trong ngân sách đã duyệt. Có dashboard Looker Studio chia sẻ cho Founder.
