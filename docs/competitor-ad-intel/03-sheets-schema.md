# 03 — Data schema Google Sheets

Quy ước chung
- Hàng 1 là **header kỹ thuật** (snake_case, Apps Script map theo tên, **không** theo vị trí cột, nên thêm cột không làm hỏng code). Nhãn tiếng Việt đặt ở *note* của ô header hoặc hàng 2 bị ẩn (tùy chọn).
- Ngày giờ lưu dạng ISO `yyyy-MM-dd` / `yyyy-MM-dd HH:mm:ss`, timezone của Spreadsheet = `Asia/Ho_Chi_Minh`.
- Danh sách nhiều giá trị (tags, platforms) phân tách bằng dấu phẩy `,`.
- Cột **(A)** = Apps Script ghi, **(U)** = người dùng nhập, **(F)** = công thức, **(AI)** = Phase 2 AI điền. Không cho người dùng sửa cột (A)/(F) bằng *Protected range* (chỉ cảnh báo).
- Bắt buộc = ✱. MVP = ●, Phase 2 = ◐.

Danh sách tab: `CONFIG`, `LISTS`, `COMPETITORS`, `KEYWORDS`, `SEARCH_URLS`, `RAW_ADS`, `AD_HISTORY`, `AD_ANALYSIS`, `GOOGLE_TRENDS`, `LANDING_PAGES`, `OPPORTUNITIES`, `RUN_LOG`, `DASHBOARD`, `WEEKLY_REPORT`. Ngoài 8 tab tối thiểu có thêm `LISTS`, `KEYWORDS`, `SEARCH_URLS`, `AD_HISTORY`, `OPPORTUNITIES`, `WEEKLY_REPORT`, cần cho dedup/phân tích/báo cáo.

---

## 5.1 CONFIG (key–value)

| key | value (ví dụ) | Ghi chú |
|---|---|---|
| `business_name` | Link Talent | |
| `brand_domain` | linktalent.vn | Để loại quảng cáo của chính mình |
| `industry` | HR Tech / SaaS tuyển dụng | |
| `markets` | VN | Danh sách, phân tách dấu phẩy |
| `languages` | vi,en | |
| `update_frequency` | WEEKLY | `DAILY` / `WEEKLY` |
| `report_day` | MON | |
| `report_recipients` | marketing@… | |
| `timezone` | Asia/Ho_Chi_Minh | |
| `apps_script_endpoint` | https://script.google.com/macros/s/…/exec | Chỉ để tham chiếu. Không phải bí mật |
| `api_auth_mode` | HMAC | `TOKEN` / `HMAC` |
| `api_secret_ref` | `SCRIPT_PROPERTY:SECRET_u_linh` | **Chỉ tham chiếu.** Secret thật nằm trong Script Properties |
| `users` | u_linh,u_minh,u_founder | Người được phép gửi |
| `long_running_days_meta` | 30 | Ngưỡng long-running |
| `long_running_days_google` | 30 | |
| `long_running_days_linkedin` | 30 | |
| `long_running_min_sightings` | 3 | Số lần quan sát tối thiểu nếu không có ngày bắt đầu |
| `new_ad_window_days` | 7 | "Mới" = first_seen trong N ngày |
| `score_weights` | 0.25,0.25,0.20,0.30 | popularity, differentiation, trend, brand_fit |
| `tags` | webinar,free-trial,discount,case-study,ai,time-to-hire,cost,employer-branding,event | Nguồn dropdown tag |
| `max_batch_size` | 50 | |
| `schema_version` | 1 | |

## 5.2 LISTS (nguồn cho Data validation)

Mỗi cột một danh sách: `platform` (META, INSTAGRAM, FACEBOOK_AUDIENCE_NETWORK, MESSENGER, LINKEDIN, GOOGLE_SEARCH, GOOGLE_DISPLAY, YOUTUBE, GOOGLE_SHOPPING, GOOGLE_MAPS, GOOGLE_PLAY), `source` (META_AD_LIBRARY, LINKEDIN_AD_LIBRARY, GOOGLE_ATC, GOOGLE_TRENDS, LANDING_PAGE, MANUAL), `format` (IMAGE, VIDEO, CAROUSEL, TEXT, DOCUMENT, EVENT, MESSAGE, SPOTLIGHT, DYNAMIC, UNKNOWN), `funnel` (TOFU, MOFU, BOFU, UNCLASSIFIED), `framework` (PAS, BAB, AIDA, SOCIAL_PROOF, FAB, 4U, OTHER, NONE), `angle` (xem file 05 §7.7), `audience_side` (EMPLOYER, CANDIDATE, UNKNOWN), `status` (ACTIVE, INACTIVE, UNKNOWN), `tracking_status` (TRACKING, PAUSED, ARCHIVED), `cta_normalized` (LEARN_MORE, SIGN_UP, BOOK_DEMO, FREE_TRIAL, CONTACT, DOWNLOAD, REGISTER_EVENT, APPLY_NOW, SHOP_NOW, GET_QUOTE, SEND_MESSAGE, CALL, OTHER).

## 5.3 COMPETITORS

| Cột | Kiểu | Ví dụ | Nguồn | |
|---|---|---|---|---|
| `competitor_id` ✱ | text | CMP-001 | (F) `="CMP-"&TEXT(ROW()-1,"000")` hoặc nhập | ● |
| `competitor_name` ✱ | text | TopCV | (U) | ● |
| `website` | url | https://www.topcv.vn | (U) | ● |
| `domain` ✱ | text | topcv.vn | (F) từ website hoặc (U) | ● |
| `alt_domains` | list | tuyendung.topcv.vn | (U) | ● |
| `meta_page_url` | url | https://www.facebook.com/topcvvietnam | (U) | ● |
| `meta_page_id` | text | 1234567890 | (U) lấy từ Ad Library URL `view_all_page_id` | ● |
| `instagram_handle` | text | @topcv | (U) | ● |
| `linkedin_page_url` | url | https://www.linkedin.com/company/topcv | (U) | ● |
| `linkedin_company_name` | text | TopCV Vietnam | (U) tên hiển thị trong Ad Library | ● |
| `google_advertiser_name` | text | TOPCV VIET NAM JOINT STOCK COMPANY | (U) tên pháp nhân đã xác minh | ● |
| `google_advertiser_id` | text | AR0123… | (U) từ URL ATC | ● |
| `products` | list | Job posting, ATS, Headhunt | (U) | ● |
| `markets` | list | VN | (U) | ● |
| `segment` | enum | DIRECT / INDIRECT / ASPIRATIONAL | (U) | ● |
| `tracking_status` ✱ | enum | TRACKING | (U) | ● |
| `priority` | 1–3 | 1 | (U) | ● |
| `notes` | text | | (U) | ● |
| `ads_total` | number | 42 | (F) COUNTIF RAW_ADS | ● |
| `ads_active` | number | 17 | (F) | ● |
| `last_collected_at` | datetime | | (F) MAXIFS | ● |

## 5.4 KEYWORDS

| Cột | Ví dụ | |
|---|---|---|
| `keyword_id` ✱ | KW-001 | ● |
| `keyword` ✱ | phần mềm tuyển dụng | ● |
| `keyword_group` | Category / Pain / Brand-competitor / Feature | ● |
| `language` | vi | ● |
| `market` | VN | ● |
| `intent` | Commercial / Informational / Navigational | ● |
| `mapped_angles` | SPEED,AI_TECH | ● (dùng cho opportunity score) |
| `trends_batch` | B1 | ● gom ≤5 từ/đợt so sánh Trends, **luôn có 1 anchor keyword chung** |
| `is_anchor` | TRUE/FALSE | ● |
| `active` | TRUE | ● |

## 5.5 SEARCH_URLS (100% công thức, xem file 07 §11.1)

`url_id`, `competitor_id`, `platform`, `market`, `query_type` (PAGE / KEYWORD / DOMAIN / ADVERTISER / TRENDS_BATCH), `query_value`, `url` (F), `last_opened_at` (A, Extension báo về), `open_count` (A).

## 5.6 RAW_ADS (bảng sự thật, 1 dòng = 1 quảng cáo duy nhất theo `ad_uid`)

| # | Cột | Kiểu | Mô tả / Quy tắc | Nguồn | |
|---|---|---|---|---|---|
| 1 | `record_id` ✱ | text | `RAD-` + 10 ký tự đầu của `ad_uid` hash + seq, bất biến | (A) | ● |
| 2 | `ad_uid` ✱ | text | Khóa chính: `{source}:{native_id}`, ví dụ `meta:1234567890123`, `gatc:AR…/CR…`, `li:987654`. Không có ID gốc → `fp:{content_fp[0:16]}` | (A) | ● |
| 3 | `native_ad_id` | text | Library ID / Creative ID / LinkedIn ad ID | Extension | ● |
| 4 | `source` ✱ | enum | META_AD_LIBRARY … | Extension | ● |
| 5 | `platforms` ✱ | list | META: FACEBOOK,INSTAGRAM,… / GOOGLE_SEARCH… / LINKEDIN | Extension | ● |
| 6 | `competitor_id` ✱ | text | CMP-001 | Extension (mapping) / (U) | ● |
| 7 | `competitor_name` | text | (F) XLOOKUP từ COMPETITORS | (F) | ● |
| 8 | `advertiser_name` ✱ | text | Tên page/nhà quảng cáo hiển thị | Extension | ● |
| 9 | `advertiser_id` | text | Page ID / AR… / company ID | Extension | ● |
| 10 | `paid_for_by` | text | "Paid for by"/"Được tài trợ bởi" nếu có | Extension | ● |
| 11 | `first_seen_at` ✱ | datetime | Lần đầu hệ thống thấy (ngày phát hiện) | (A) | ● |
| 12 | `last_seen_at` ✱ | datetime | Lần gần nhất thấy | (A) | ● |
| 13 | `seen_count` | int | Số lần quan sát (mỗi ngày tính 1) | (A) | ● |
| 14 | `start_date` | date | Ngày bắt đầu chạy do nền tảng công bố (Meta "Started running on", LinkedIn "Ran from", Google "First shown" nếu có) | Extension | ● |
| 15 | `end_date` | date | Ngày kết thúc/Last shown nếu có | Extension | ● |
| 16 | `is_active` | enum | ACTIVE/INACTIVE/UNKNOWN | Extension | ● |
| 17 | `body_text` | text | Nội dung chính (≤ 5.000 ký tự) | Extension | ● |
| 18 | `headline` | text | | Extension | ● |
| 19 | `description` | text | Link description / text phụ | Extension | ● |
| 20 | `cta_text` | text | Nguyên văn CTA | Extension | ● |
| 21 | `cta_normalized` | enum | Map về LISTS.cta_normalized | (A) | ● |
| 22 | `format` ✱ | enum | IMAGE/VIDEO/CAROUSEL/TEXT… | Extension | ● |
| 23 | `media_urls` | list | URL ảnh/video/thumbnail tại thời điểm thu thập (**có thể hết hạn**) | Extension | ● |
| 24 | `media_drive_url` | url | Bản thumbnail lưu Drive nội bộ (tùy chọn) | (A) | ◐ |
| 25 | `variant_count` | int | Meta: "N quảng cáo dùng nội dung này" | Extension | ● |
| 26 | `ad_url` ✱ | url | Link quảng cáo gốc trong thư viện | Extension | ● |
| 27 | `landing_url` | url | URL đích đã bỏ tham số tracking cá nhân | Extension | ● |
| 28 | `landing_url_raw` | url | URL gốc (giữ UTM để phân tích) | Extension | ● |
| 29 | `final_domain` | text | Registrable domain của landing | (A) | ● |
| 30 | `utm_source` / `utm_medium` / `utm_campaign` / `utm_content` | text | Tách từ landing_url_raw | (A) | ● |
| 31 | `country` ✱ | text | VN (bộ lọc khi thu thập) | Extension | ● |
| 32 | `language` | enum | vi/en/mixed (detect) | (A) | ● |
| 33 | `audience_side` | enum | EMPLOYER/CANDIDATE/UNKNOWN | Extension rule + (U) | ● |
| 34 | `product` | text | Sản phẩm của đối thủ được quảng cáo | (U) | ● |
| 35 | `campaign_label` | text | Nhãn nội bộ (ví dụ "Q4-2026 Hiring Season") | (U) | ● |
| 36 | `collector` ✱ | text | u_linh | (A) từ auth | ● |
| 37 | `content_fp` ✱ | hex(64) | SHA-256 nội dung chuẩn hóa | Extension, Apps Script kiểm lại | ● |
| 38 | `creative_fp` | hex(64) | SHA-256 media key | Extension | ● |
| 39 | `cluster_id` | text | Nhóm creative lặp lại (cùng `content_fp` hoặc `creative_fp` khác `ad_uid`) | (A) | ● |
| 40 | `version` | int | Tăng mỗi lần `content_fp` đổi | (A) | ● |
| 41 | `change_flag` | enum | NEW / UPDATED / UNCHANGED | (A) | ● |
| 42 | `run_days` | int | (F) `(end_date or today) − start_date`, nếu thiếu start dùng first_seen | (F) | ● |
| 43 | `is_long_running` | bool | (F) theo ngưỡng CONFIG | (F) | ● |
| 44 | `is_new_this_week` | bool | (F) | (F) | ● |
| 45 | `tags` | list | | (U) | ● |
| 46 | `rating` | 1–5 | Đánh giá thủ công "đáng học hỏi" | (U) | ● |
| 47 | `notes` | text | | (U) | ● |
| 48 | `extract_confidence` | 0–1 | Độ tin cậy adapter | Extension | ● |
| 49 | `extractor_version` | text | `meta@0.1.3` | Extension | ● |
| 50 | `created_at` / `updated_at` | datetime | | (A) | ● |

> **Không lưu:** tên/ảnh đại diện người bình luận, số like/bình luận của cá nhân, thông tin người dùng đã đăng nhập, cookie. Nếu body quảng cáo chứa SĐT/email hotline doanh nghiệp thì giữ nguyên (thông tin doanh nghiệp công khai). Không thu thập thông tin cá nhân khác.

## 5.7 AD_HISTORY (append-only, ghi khi có thay đổi)

`history_id`, `record_id`, `ad_uid`, `changed_at`, `version_from`, `version_to`, `changed_fields` (ví dụ `headline,cta_text,landing_url`), `old_values_json`, `new_values_json`, `collector`.

## 5.8 AD_ANALYSIS (1:1 với RAW_ADS theo `record_id`)

Mỗi trường phân tích có 3 cột: `*_auto` (rule/AI), `*_manual` (người sửa), và giá trị hiệu lực `*` (F) = `IF(manual<>"", manual, auto)`. Bảng dưới liệt kê giá trị hiệu lực. Chi tiết cột auto/manual xem cột "Cách điền".

| Cột | Định nghĩa | Cách điền MVP | Phase 2 |
|---|---|---|---|
| `record_id` ✱ | FK | (A) tạo dòng khi insert RAW_ADS | |
| `hook` | 1 câu mở đầu / 3 giây đầu video | (F) câu đầu của body (`REGEXEXTRACT`) | AI viết lại ngắn |
| `pain_point` | Vấn đề khách hàng được nêu | (F) từ điển pain → nhãn | AI |
| `desire` | Kết quả mong muốn | (U) | AI |
| `value_proposition` | Lời hứa giá trị chính | (U) | AI |
| `offer` | Ưu đãi cụ thể (free trial, giảm %, tặng, webinar miễn phí) | (F) regex offer | AI |
| `offer_type` | FREE_TRIAL / DISCOUNT / FREE_RESOURCE / EVENT / DEMO / GUARANTEE / NONE | (F) | AI |
| `proof` | Bằng chứng: số liệu, logo KH, testimonial, giải thưởng | (F) regex số liệu + từ khóa | AI |
| `objection` | Rào cản được xử lý (giá, khó dùng, bảo mật…) | (U) | AI |
| `cta` | = RAW_ADS.cta_normalized | (F) | |
| `creative_angle` | 1 angle chính + tối đa 2 angle phụ | (F) rule | AI + clustering |
| `funnel_stage` | TOFU/MOFU/BOFU | (F) rule score | AI |
| `target_audience` | Giả định: "HR Manager SME 50–200 NS" | (U) | AI (ghi rõ "giả định") |
| `framework` | PAS/BAB/AIDA/SOCIAL_PROOF/… | (F) rule | AI |
| `differentiation_level` | 1–5: mức khác biệt so với trung bình thị trường | (U) | AI + similarity |
| `learnings` | Điểm đáng học hỏi | (U) | AI nháp, người duyệt |
| `copy_risk` | LOW/MED/HIGH: rủi ro nếu mô phỏng quá sát (thương hiệu, claim, ngôn từ đặc trưng) | (U) | AI + similarity |
| `priority_signal` | 0–100: tín hiệu đối thủ đang ưu tiên (không phải hiệu quả) | (F) xem file 05 §7.4 | |
| `analysis_source` | RULE / MANUAL / AI:model@date | (A) | |
| `ai_confidence` | 0–1 | | ◐ |
| `reviewed_by` / `reviewed_at` | | (U) | |

## 5.9 GOOGLE_TRENDS (dạng long: 1 dòng = 1 keyword × 1 mốc thời gian)

| Cột | Ví dụ | Ghi chú |
|---|---|---|
| `trend_row_id` | TRD-… | (A) hash(keyword+geo+timeframe+point_date+batch) |
| `keyword` ✱ | phần mềm tuyển dụng | |
| `market` ✱ | VN | `geo` |
| `timeframe` ✱ | today 12-m | Khoảng thời gian |
| `batch_id` | B1 | Nhóm so sánh (giá trị Trends chỉ so được **trong cùng batch**) |
| `anchor_keyword` | tuyển dụng | Dùng chuẩn hóa liên batch |
| `point_date` ✱ | 2026-09-14 | Tuần/ngày của điểm dữ liệu |
| `interest` ✱ | 0–100 | **Chỉ số tương đối, không phải lượng tìm kiếm** |
| `interest_norm` | | (F) interest / anchor_interest cùng point_date |
| `trend_direction` | UP / DOWN / FLAT | (F) xem file 07 §11.6 |
| `momentum_pct` | +18% | (F) TB 4 tuần gần / TB 12 tuần trước − 1 |
| `related_queries_top` | "phần mềm tuyển dụng miễn phí; ats là gì" | Chỉ lưu ở dòng snapshot (point_date = ngày thu thập) |
| `related_queries_rising` | "ai tuyển dụng (+250%)" | |
| `seasonality_note` | "Đỉnh tuần 2–3 sau Tết; đáy tháng Chạp" | (U) hoặc (F) so với cùng kỳ |
| `collected_at` ✱ | | (A) |
| `source_url` ✱ | https://trends.google.com/trends/explore?... | |
| `collection_method` | DOM / CSV_IMPORT / API | |

## 5.10 LANDING_PAGES (1 dòng = 1 snapshot, 1 URL có nhiều snapshot)

| Cột | Ví dụ |
|---|---|
| `lp_snapshot_id` ✱ | LPS-… |
| `competitor_id` ✱ | CMP-002 |
| `url` ✱ | https://www.vietnamworks.com/employer/… (đã bỏ tracking) |
| `url_key` | domain + path chuẩn hóa (khóa nhóm snapshot) |
| `page_title` | |
| `meta_description` | |
| `h1` | |
| `offer` | "Dùng thử 14 ngày miễn phí" |
| `primary_cta` / `secondary_ctas` | "Đăng ký tư vấn" / "Xem bảng giá" |
| `social_proof` | "10.000+ doanh nghiệp; logo: …; testimonial: 3" |
| `form_present` | TRUE |
| `form_fields` | "Họ tên, SĐT, Email, Công ty, Quy mô" (chỉ **nhãn** trường, không nhập/không lưu giá trị) |
| `pricing_visible` | TRUE/FALSE + `price_points` |
| `funnel_stage` | BOFU |
| `utm` | utm_source=facebook&utm_campaign=… |
| `checked_at` ✱ | |
| `http_status` / `url_status` | 200 / OK · REDIRECT · 404 · BLOCKED |
| `final_url` | Sau redirect |
| `content_hash` | SHA-256 toàn bộ text chính |
| `section_hashes_json` | `{"hero":"…","offer":"…","cta":"…","proof":"…","form":"…","pricing":"…"}` |
| `changed_sections` | "offer,cta" (so với snapshot trước cùng url_key) |
| `change_summary` | "Offer: 7 ngày → 14 ngày dùng thử" |
| `linked_record_ids` | RAD-… (quảng cáo trỏ đến) |
| `collector` | |

## 5.11 OPPORTUNITIES (1 dòng = 1 creative angle hoặc 1 cặp angle × pain point)

`opp_id`, `angle`, `pain_point`, `ads_count`, `competitors_using`, `share_of_ads`, `long_running_count`, `popularity_0_1` (F), `differentiation_0_1` (F/U), `trend_0_1` (F), `brand_fit_1_5` (U), `brand_fit_0_1` (F), `opportunity_score_1_10` (F), `evidence_record_ids`, `hypothesis`, `status` (IDEA / BACKLOG / TESTING / DONE), `owner`.

## 5.12 RUN_LOG

| Cột | Ví dụ |
|---|---|
| `run_id` | RUN-20260925-094210-u_linh |
| `timestamp` ✱ | 2026-09-25 09:42:10 |
| `request_id` | uuid từ Extension (idempotency) |
| `action` | ads.upsert |
| `source` ✱ | META_AD_LIBRARY |
| `collector` | u_linh |
| `found` ✱ | 14 (số card phát hiện trên trang) |
| `received` | 6 (số bản ghi gửi lên) |
| `inserted` ✱ | 3 |
| `updated` ✱ | 1 |
| `duplicates` ✱ | 1 (TOUCH) |
| `rejected` | 1 |
| `errors` ✱ | `[{"client_id":"c5","code":"SCHEMA_MISSING_FIELD","field":"ad_url"}]` |
| `sync_status` ✱ | SUCCESS / PARTIAL / FAILED |
| `duration_ms` | 1840 |
| `extension_version` / `schema_version` | 0.1.0 / 1 |

## 5.13 DASHBOARD và WEEKLY_REPORT

Xem file [07-formulas-dashboard-report.md](07-formulas-dashboard-report.md).

## 5.14 Giới hạn dung lượng

Google Sheets tối đa **10 triệu ô/spreadsheet**. RAW_ADS khoảng 60 cột, nên khoảng 100k dòng ≈ 6M ô, còn chỗ cho các tab khác. Với 500 quảng cáo/tháng thì đủ nhiều năm. Kế hoạch: hằng năm chuyển `AD_HISTORY` và `GOOGLE_TRENDS` cũ sang file lưu trữ, hoặc chuyển sang BigQuery ở Phase 2.
