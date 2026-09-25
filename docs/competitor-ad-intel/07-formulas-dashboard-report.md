# 07 — Công thức Google Sheets, Dashboard và Báo cáo tuần

## 11. Công thức Google Sheets

### 11.0 Quy ước: Named Ranges

`Setup.gs` tạo named range cho từng cột (từ hàng 2 đến hết sheet). Công thức **tham chiếu theo tên**, nên chèn hoặc đổi thứ tự cột không làm vỡ công thức.

| Nhóm | Named ranges |
|---|---|
| RAW_ADS | `ads_uid`, `ads_record`, `ads_source`, `ads_platforms`, `ads_cmp`, `ads_cmp_name`, `ads_first_seen`, `ads_last_seen`, `ads_seen_count`, `ads_start`, `ads_end`, `ads_active`, `ads_body`, `ads_headline`, `ads_desc`, `ads_cta`, `ads_cta_norm`, `ads_format`, `ads_landing`, `ads_audience`, `ads_tags`, `ads_url`, `ads_text`, `ads_week`, `ads_run_days`, `ads_long`, `ads_new` |
| AD_ANALYSIS | `an_record`, `an_cmp_name`, `an_first_seen`, `an_audience`, `an_angle`, `an_funnel`, `an_framework`, `an_offer_type`, `an_pain`, `an_priority` |
| COMPETITORS | `cmp_id`, `cmp_name`, `cmp_status`, `cmp_domain`, `cmp_meta_page_id`, `cmp_li_name`, `cmp_g_adv_id` |
| KEYWORDS | `kw_keyword`, `kw_batch`, `kw_active`, `kw_angles`, `kw_momentum` |
| GOOGLE_TRENDS | `tr_keyword`, `tr_date`, `tr_interest`, `tr_timeframe` |
| LISTS | `kw_tofu`, `kw_mofu`, `kw_bofu` (mỗi ô một regex term), `angle_code`, `angle_regex` (các term cách nhau bởi `|`) |
| CONFIG | `cfg_market`, `cfg_long_days`, `cfg_min_sightings`, `cfg_new_days`, `cfg_weights`, `cfg_usp_angles` |
| DASHBOARD | `dash_cmp`, `dash_platform`, `dash_days` (ô điều khiển bộ lọc) |

> **Quy tắc quan trọng:** cột công thức trong RAW_ADS/AD_ANALYSIS dùng **một** công thức mảng ở hàng 1 (có header). Apps Script `SheetRepo` đánh dấu các cột này là `FORMULA_COLS` và **không bao giờ ghi vào**. Ghi vào sẽ làm mảng báo `#REF!`.

### 11.1 SEARCH_URLS — sinh URL tìm kiếm

Tạo tổ hợp đối thủ × nền tảng (A2):
```
=ARRAYFORMULA(SPLIT(FLATTEN(FILTER(cmp_id, cmp_status="TRACKING") & "|" & {"META","LINKEDIN","GOOGLE_ATC"}), "|"))
```

URL theo từng dòng (C2 = platform, B2 = competitor_id):
```
=LET(i, XMATCH(B2, cmp_id), mk, cfg_market,
  SWITCH(C2,
   "META", IF(INDEX(cmp_meta_page_id, i)<>"",
      "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country="&mk&"&view_all_page_id="&INDEX(cmp_meta_page_id, i)&"&search_type=page&media_type=all",
      "https://www.facebook.com/ads/library/?active_status=all&ad_type=all&country="&mk&"&q="&ENCODEURL(INDEX(cmp_name, i))&"&search_type=keyword_unordered&media_type=all"),
   "LINKEDIN",   "https://www.linkedin.com/ad-library/search?accountOwner="&ENCODEURL(INDEX(cmp_li_name, i))&"&countries="&mk,
   "GOOGLE_ATC", IF(INDEX(cmp_g_adv_id, i)<>"",
      "https://adstransparency.google.com/advertiser/"&INDEX(cmp_g_adv_id, i)&"?region="&mk,
      "https://adstransparency.google.com/?region="&mk&"&domain="&INDEX(cmp_domain, i)),
   ""))
```
(Tham số LinkedIn cần xác minh lại, xem file 04 §6.2.)

Tìm theo từ khóa trên Meta (mỗi từ khóa đang active):
```
=ARRAYFORMULA(IF(FILTER(kw_keyword, kw_active)="",,
  "https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country="&cfg_market&"&q="&ENCODEURL(FILTER(kw_keyword, kw_active))&"&search_type=keyword_unordered&media_type=all"))
```

Google Trends theo batch (≤ 5 từ khóa, B2 = batch_id):
```
="https://trends.google.com/trends/explore?date=today%2012-m&geo="&cfg_market&"&hl=vi&q="&
  TEXTJOIN(",", TRUE, ARRAYFORMULA(ENCODEURL(FILTER(kw_keyword, kw_batch=B2, kw_active=TRUE))))
```

Link bấm được: `=HYPERLINK(D2, "Mở ↗")`.

### 11.2 RAW_ADS — cột công thức (đặt ở hàng 1)

Tên đối thủ:
```
={"competitor_name"; ARRAYFORMULA(IF(ads_uid="",, XLOOKUP(ads_cmp, cmp_id, cmp_name, "⚠ chưa map")))}
```

Văn bản gộp để phân loại (`ads_text`):
```
={"text_for_rules"; ARRAYFORMULA(IF(ads_uid="",, LOWER(ads_body&" "&ads_headline&" "&ads_desc&" "&ads_cta&" "&ads_landing)))}
```

Tuần phát hiện (thứ Hai đầu tuần):
```
={"week_start"; ARRAYFORMULA(IF(ads_uid="",, TO_DATE(INT(ads_first_seen) - WEEKDAY(ads_first_seen, 3))))}
```

Số ngày chạy:
```
={"run_days"; ARRAYFORMULA(IF(ads_uid="",,
   IF(ads_start<>"",
      IF(ads_active="INACTIVE", IF(ads_end<>"", ads_end, INT(ads_last_seen)), TODAY()) - ads_start,
      INT(ads_last_seen) - INT(ads_first_seen))))}
```

Long-running:
```
={"is_long_running"; ARRAYFORMULA(IF(ads_uid="",,
   (ads_run_days >= cfg_long_days) * (((ads_start<>"") + (ads_seen_count >= cfg_min_sightings)) > 0) = 1))}
```

Mới trong tuần:
```
={"is_new_this_week"; ARRAYFORMULA(IF(ads_uid="",, ads_first_seen >= TODAY() - cfg_new_days))}
```

Kiểm tra toàn vẹn (luôn phải FALSE, bật conditional format đỏ):
```
={"dup_check"; ARRAYFORMULA(IF(ads_uid="",, COUNTIF(ads_uid, ads_uid) > 1))}
```

### 11.3 AD_ANALYSIS — rule phân loại bằng công thức

> Mặc định `Rules.gs` gán nhãn khi insert (nhanh, ổn định với dữ liệu lớn). Các công thức dưới đây là **phương án no-code tương đương**, dễ đọc và chỉnh cho Marketing. Chọn **một** trong hai cho mỗi cột `*_auto`, không dùng cả hai cùng lúc.

Tra ngữ cảnh từ RAW_ADS (hàng 1):
```
={"competitor_name","first_seen_at","audience_side","text","cta_norm","body";
  ARRAYFORMULA(IF(an_record="",,
    XLOOKUP(an_record, ads_record, HSTACK(ads_cmp_name, ads_first_seen, ads_audience, ads_text, ads_cta_norm, ads_body))))}
```
(Named range `an_text`, `an_cta_norm`, `an_body` trỏ vào 3 cột cuối.)

Funnel stage (có trọng số, BOFU thắng khi hòa):
```
={"funnel_auto"; MAP(an_text, an_cta_norm, LAMBDA(t, c, IF(t="", ,
  LET(
    tf, SUMPRODUCT(--REGEXMATCH(t, FILTER(kw_tofu, kw_tofu<>""))) + 2*(c="LEARN_MORE"),
    mf, SUMPRODUCT(--REGEXMATCH(t, FILTER(kw_mofu, kw_mofu<>""))) + 2*OR(c="DOWNLOAD", c="REGISTER_EVENT"),
    bf, SUMPRODUCT(--REGEXMATCH(t, FILTER(kw_bofu, kw_bofu<>""))) + 3*OR(c="BOOK_DEMO", c="FREE_TRIAL", c="GET_QUOTE", c="CONTACT", c="SIGN_UP"),
    mx, MAX(tf, mf, bf),
    IF(mx=0, "UNCLASSIFIED", IF(bf=mx, "BOFU", IF(mf=mx, "MOFU", "TOFU")))))))}
```

Creative angle chính:
```
={"angle_auto"; MAP(an_text, LAMBDA(t, IF(t="", ,
  LET(sc, MAP(angle_regex, LAMBDA(r, IF(r="", 0, SUMPRODUCT(--REGEXMATCH(t, SPLIT(r, "|")))))),
      IF(MAX(sc)=0, "UNCLASSIFIED", XLOOKUP(MAX(sc), sc, angle_code))))))}
```

Framework:
```
={"framework_auto"; MAP(an_body, LAMBDA(b, IF(b="", , LET(
  t, LOWER(b),
  head, LEFT(t, MAX(80, ROUND(LEN(t)/3))),
  tail, RIGHT(t, 150),
  p,   REGEXMATCH(head, "\?|bạn (đang|có|còn|vẫn)|mệt mỏi|mất (hàng|cả|quá)|tốn|khó khăn|đau đầu|struggl|tired of"),
  a,   REGEXMATCH(t, "tuyển sai|rủi ro|thiệt hại|gấp \d|mất thêm|nghỉ việc|chậm trễ|cost of|losing"),
  s,   REGEXMATCH(t, "giúp bạn|giải pháp|chỉ với|chỉ cần|với [a-z]+|helps you|with our"),
  bab, REGEXMATCH(t, "(trước đây|trước khi|từng).{0,160}(giờ đây|sau khi|bây giờ|nay đã)|hãy tưởng tượng|imagine|không còn phải"),
  sp,  REGEXMATCH(t, "\d[\d.,]*\+?\s*(doanh nghiệp|khách hàng|nhà tuyển dụng|hr|companies|customers)|tin dùng|trusted by|★|top \d"),
  aida, REGEXMATCH(head, "^\d|\?|!") * REGEXMATCH(t, "tính năng|feature|tự động|ai ") * REGEXMATCH(t, "giúp|tiết kiệm|nhanh|hiệu quả|save") * REGEXMATCH(tail, "đăng ký|liên hệ|dùng thử|tìm hiểu|nhận ngay|book|sign up|try"),
  IF(p*a*s, "PAS", IF(bab, "BAB", IF(aida, "AIDA", IF(sp, "SOCIAL_PROOF", IF(LEN(t) < 60, "NONE", "OTHER")))))))))}
```

Offer type:
```
={"offer_type_auto"; MAP(an_text, LAMBDA(t, IF(t="", , IFS(
  REGEXMATCH(t, "dùng thử|free trial|trial"), "FREE_TRIAL",
  REGEXMATCH(t, "giảm|\d+\s?%|discount|khuyến mãi|voucher|ưu đãi"), "DISCOUNT",
  REGEXMATCH(t, "ebook|checklist|template|mẫu jd|tải miễn phí|báo cáo miễn phí"), "FREE_RESOURCE",
  REGEXMATCH(t, "webinar|hội thảo|sự kiện|workshop"), "EVENT",
  REGEXMATCH(t, "demo"), "DEMO",
  REGEXMATCH(t, "cam kết|hoàn tiền|bảo hành|guarantee"), "GUARANTEE",
  TRUE, "NONE"))))}
```

Hook (câu đầu):
```
={"hook_auto"; ARRAYFORMULA(IF(an_body="",, IFERROR(REGEXEXTRACT(an_body, "^[^.!?\n]{1,160}[.!?]?"), LEFT(an_body, 160))))}
```

Giá trị hiệu lực (manual ưu tiên), ví dụ cho funnel:
```
={"funnel_stage"; ARRAYFORMULA(IF(an_record="",, IF(funnel_manual<>"", funnel_manual, funnel_auto)))}
```

Priority signal (0–100, file 05 §7.4). Cần thêm `an_run_days`, `an_variants`, `an_platform_count`, `an_active`, `an_recent_update` qua XLOOKUP:
```
={"priority_signal"; MAP(an_record, an_run_days, an_variants, an_platform_count, an_active, an_recent_update, an_lp_invested,
  LAMBDA(r, d, v, pc, act, upd, lp, IF(r="", , MIN(100,
    30*(d>=30) + 10*(d>=60) + 20*(v>=3) + 15*(pc>=2) + 10*(act="ACTIVE") + 10*(upd=TRUE) + 5*(lp=TRUE)))))}
```
(Dùng `MAP` thay vì `ARRAYFORMULA` vì `MIN` trong ARRAYFORMULA gộp cả cột thay vì tính từng dòng.)

### 11.4 COMPETITORS — số liệu tổng hợp

```
ads_total:         =IF(A2="",, COUNTIF(ads_cmp, A2))
ads_active:        =IF(A2="",, COUNTIFS(ads_cmp, A2, ads_active, "ACTIVE"))
last_collected_at: =IF(A2="",, MAXIFS(ads_last_seen, ads_cmp, A2))
domain từ website: =IFERROR(REGEXEXTRACT(LOWER(C2), "^(?:https?://)?(?:www\.)?([^/:?#]+)"), "")
```

### 11.5 LANDING_PAGES — phát hiện thay đổi (bổ trợ cho Apps Script)

Snapshot trước cùng `url_key` (C = url_key, M = checked_at, Q = content_hash):
```
=LET(prev, SORTN(FILTER({M:M, Q:Q}, C:C=C2, M:M<M2), 1, 0, 1, FALSE), IF(ISERROR(prev), "FIRST", IF(INDEX(prev,1,2)=Q2, "SAME", "CHANGED")))
```

### 11.6 GOOGLE_TRENDS — xu hướng, momentum, mùa vụ

Bảng tổng hợp theo keyword (tab con `TRENDS_SUMMARY`, A2 = danh sách keyword):
```
A2: =UNIQUE(FILTER(tr_keyword, tr_keyword<>"", tr_timeframe="today 12-m"))

B2 (điểm mới nhất):
=MAP(A2:A, LAMBDA(k, IF(k="",, LET(d, MAXIFS(tr_date, tr_keyword, k), SUMIFS(tr_interest, tr_keyword, k, tr_date, d)))))

C2 (momentum = TB 4 tuần gần / TB 12 tuần trước đó − 1):
=MAP(A2:A, LAMBDA(k, IF(k="",, LET(last, MAXIFS(tr_date, tr_keyword, k),
   r4,  AVERAGEIFS(tr_interest, tr_keyword, k, tr_date, ">"&last-28),
   p12, AVERAGEIFS(tr_interest, tr_keyword, k, tr_date, "<="&last-28, tr_date, ">"&last-112),
   IFERROR(r4/p12 - 1, ))))))

D2 (hướng):  =MAP(C2:C, LAMBDA(m, IF(m="",, IF(m>=0.15, "UP", IF(m<=-0.15, "DOWN", "FLAT")))))

E2 (độ dốc 12 điểm gần nhất):
=MAP(A2:A, LAMBDA(k, IF(k="",, LET(v, SORTN(FILTER({tr_date, tr_interest}, tr_keyword=k), 12, 0, 1, FALSE),
   SLOPE(INDEX(SORT(v, 1, TRUE), 0, 2), SEQUENCE(ROWS(v)))))))

F2 (sparkline):
=MAP(A2:A, LAMBDA(k, IF(k="",, SPARKLINE(FILTER(tr_interest, tr_keyword=k, tr_date>=TODAY()-365), {"charttype","line";"linewidth",2}))))

G2 (mùa vụ YoY, cần dữ liệu timeframe "today 5-y"):
=IFERROR(AVERAGEIFS(tr_interest, tr_keyword, A2, tr_date, ">"&TODAY()-28) /
         AVERAGEIFS(tr_interest, tr_keyword, A2, tr_date, ">"&TODAY()-365-28, tr_date, "<="&TODAY()-365) - 1, )
```
`kw_momentum` trong KEYWORDS: `=XLOOKUP(kw_keyword, TRENDS_SUMMARY!A:A, TRENDS_SUMMARY!C:C, )`.

### 11.7 OPPORTUNITIES — điểm cơ hội 1–10

Giả sử cột: B `angle`, C `competitors_using`, D `ads_count`, E `share_of_ads`, F `long_running_count`, G `P`, H `D`, I `T`, K `brand_fit_1_5`, L `B`, M `score`.

```
A/B (danh sách angle):  =UNIQUE(FILTER(an_angle, an_angle<>"", an_angle<>"UNCLASSIFIED", an_audience<>"CANDIDATE"))
C competitors_using:    =COUNTUNIQUE(FILTER(an_cmp_name, an_angle=B2, an_first_seen>=TODAY()-90))
D ads_count:            =COUNTIFS(an_angle, B2, an_first_seen, ">="&TODAY()-90)
E share_of_ads:         =D2 / COUNTIFS(an_angle, "<>", an_first_seen, ">="&TODAY()-90)
F long_running_count:   =COUNTIFS(an_angle, B2, an_run_days, ">="&cfg_long_days)
G Popularity:           =0.5*C2/COUNTIF(cmp_status, "TRACKING") + 0.5*MIN(1, F2/3)
H Differentiation:      =MIN(1, 1 - E2/MAX(E$2:E) + IF(REGEXMATCH(cfg_usp_angles, "\b"&B2&"\b"), 0.2, 0))
I Trend:                =IFERROR(MIN(1, MAX(0, AVERAGE(FILTER(kw_momentum, REGEXMATCH(kw_angles, "\b"&B2&"\b"))) + 0.5)), 0.5)
L Brand fit:            =IF(K2="", 0.5, (K2-1)/4)
M Score 1–10:           =ROUND(1 + 9*SUMPRODUCT(SPLIT(cfg_weights, ","), {G2, H2, I2, L2}), 1)
N Bằng chứng:           =TEXTJOIN(", ", TRUE, ARRAY_CONSTRAIN(SORTN(FILTER({an_record, an_priority}, an_angle=B2), 5, 0, 2, FALSE), 5, 1))
```
(`cfg_usp_angles` ví dụ: `QUALITY_FIT,DATA_REPORTING,AI_TECH` tương ứng 3C, Dashboard ROI, AI Matching.)

### 11.8 Data validation và conditional formatting

| Vùng | Quy tắc |
|---|---|
| RAW_ADS `competitor_id` | Dropdown từ `cmp_id` |
| RAW_ADS `audience_side`, `format`, `is_active` | Dropdown từ LISTS |
| RAW_ADS `rating` | Số 1–5 |
| AD_ANALYSIS `*_manual` | Dropdown từ LISTS (angle, funnel, framework) |
| Hàng RAW_ADS long-running | Custom formula `=$<long_col>2=TRUE` → nền cam nhạt |
| Hàng mới trong tuần | `=$<new_col>2=TRUE` → nền xanh lá nhạt |
| `dup_check` = TRUE | Nền đỏ |
| LANDING_PAGES `changed_sections` ≠ "" | Chữ đậm, nền vàng |
| Ma trận Competitor × Angle | Color scale 3 điểm (trắng → xanh đậm) |

---

## 12. Thiết kế Dashboard

### 12.1 Bố cục (tab `DASHBOARD`, khung rộng khoảng 1400 px, 12 cột lưới)

```
┌──────────────────────────────────────────────────────────────────────────────────────┐
│ COMPETITOR AD INTEL — Link Talent            Cập nhật: 25/09/2026 09:42              │
│ Bộ lọc: Đối thủ [Tất cả ▾]  Nền tảng [Tất cả ▾]  Khoảng [90 ngày ▾]  Phía KH [Employer ▾] │
├────────────┬────────────┬────────────┬────────────┬────────────┬────────────────────┤
│ QC mới     │ QC đang    │ Long-      │ Đối thủ    │ LP thay    │ Keyword tăng       │
│ tuần này   │ active     │ running    │ hoạt động  │ đổi (7N)   │ (momentum ≥15%)    │
│   23 ▲8    │   61       │   14       │ TopCV      │   3        │   5                │
├────────────┴────────────┴────────────┼────────────┴────────────┴────────────────────┤
│ [1] QC mới theo tuần × đối thủ       │ [2] QC theo nền tảng                        │
│     (stacked column, 12 tuần)        │     (bar ngang)                             │
├──────────────────────────────────────┼────────────────────────────────────────────┤
│ [3] Heatmap Đối thủ × Creative angle │ [4] Top CTA        │ [5] Top Offer type     │
│     (% trong 90 ngày)                │     (bar)          │     (bar)              │
├──────────────────────────────────────┴────────────────────┴────────────────────────┤
│ [6] Top 10 quảng cáo chạy lâu nhất (đang active): Đối thủ · Headline · Ngày · Link │
├──────────────────────────────────────┬────────────────────────────────────────────┤
│ [7] Từ khóa Trends: keyword · điểm · │ [8] Funnel mix theo đối thủ                 │
│     momentum · hướng · sparkline     │     (100% stacked bar TOFU/MOFU/BOFU)       │
├──────────────────────────────────────┴────────────────────────────────────────────┤
│ [9] Xu hướng theo thời gian: QC active theo tuần (line/đối thủ) + chỉ số Trends     │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ [10] Top cơ hội (OPPORTUNITIES score ≥ 7): angle · score · P/D/T/B · bằng chứng      │
├──────────────────────────────────────────────────────────────────────────────────────┤
│ ⓘ Số lượng quảng cáo là số mẫu công khai quan sát được, KHÔNG phản ánh ngân sách,    │
│   hiệu quả hay ROAS. Chỉ số Trends là tương đối (0–100), không phải lượng tìm kiếm.  │
└──────────────────────────────────────────────────────────────────────────────────────┘
```

### 12.2 Công thức từng khối

Bộ lọc dùng chung (ẩn ở cột phụ, `flt` = mảng TRUE/FALSE theo từng dòng RAW_ADS):
```
flt: =ARRAYFORMULA((ads_uid<>"")
       * ((dash_cmp="Tất cả") + (ads_cmp_name=dash_cmp) > 0)
       * ((dash_platform="Tất cả") + ISNUMBER(SEARCH(dash_platform, ads_platforms)) > 0)
       * (ads_first_seen >= TODAY() - dash_days)
       * (ads_audience <> "CANDIDATE")
       * NOT(ISNUMBER(SEARCH("own-brand", ads_tags))))
```
Đặt `flt` thành named range `dash_flt` (cột phụ trong RAW_ADS hoặc tính trực tiếp).

| Khối | Công thức nguồn | Biểu đồ |
|---|---|---|
| KPI QC mới tuần này | `=COUNTIFS(ads_week, TODAY()-WEEKDAY(TODAY(),3), ads_audience, "<>CANDIDATE")`, delta = trừ tuần trước | Scorecard (ô chữ lớn) |
| KPI active | `=SUMPRODUCT(dash_flt, ads_active="ACTIVE")` | |
| KPI long-running | `=SUMPRODUCT(dash_flt, ads_long=TRUE)` | |
| KPI đối thủ hoạt động mạnh nhất | `=INDEX(SORTN(QUERY({ads_cmp_name, ads_uid}, "select Col1, count(Col2) where Col2 is not null and Col1 is not null group by Col1", 0), 1, 0, 2, FALSE), 1, 1)` | |
| [1] QC mới/tuần × đối thủ | `=QUERY({ads_week, ads_cmp_name, ads_uid, dash_flt}, "select Col1, count(Col3) where Col4 = 1 and Col1 >= date '"&TEXT(TODAY()-84,"yyyy-mm-dd")&"' group by Col1 pivot Col2 label Col1 'Tuần'", 0)` | Stacked column |
| [2] Theo nền tảng | `=QUERY(FLATTEN(ARRAYFORMULA(IFERROR(TRIM(SPLIT(FILTER(ads_platforms, dash_flt=1), ","))))), "select Col1, count(Col1) where Col1 <> '' group by Col1 order by count(Col1) desc label count(Col1) 'Số QC'", 0)` | Bar ngang |
| [3] Heatmap | `=QUERY({an_cmp_name, an_angle, an_record, an_first_seen}, "select Col1, count(Col3) where Col2 <> 'UNCLASSIFIED' and Col4 >= date '"&TEXT(TODAY()-90,"yyyy-mm-dd")&"' group by Col1 pivot Col2", 0)` → bảng % bên cạnh: `=IFERROR(B3/SUM($B3:$Z3),)` | Bảng + color scale |
| [4] Top CTA | `=QUERY({ads_cta_norm, dash_flt}, "select Col1, count(Col1) where Col2 = 1 and Col1 <> '' group by Col1 order by count(Col1) desc limit 8 label count(Col1) 'Số QC'", 0)` | Bar |
| [5] Top Offer | Tương tự trên `an_offer_type`, loại `NONE` | Bar |
| [6] Chạy lâu nhất | `=SORTN(FILTER({ads_cmp_name, ads_headline, ads_start, ads_run_days, HYPERLINK(ads_url, "Xem")}, ads_active="ACTIVE", dash_flt=1), 10, 0, 4, FALSE)` | Bảng |
| [7] Trends | `=SORT(FILTER(TRENDS_SUMMARY!A2:F, TRENDS_SUMMARY!A2:A<>""), 3, FALSE)` | Bảng + sparkline |
| [8] Funnel mix | `=QUERY({an_cmp_name, an_funnel, an_record}, "select Col1, count(Col3) where Col2 <> 'UNCLASSIFIED' group by Col1 pivot Col2", 0)` | 100% stacked bar |
| [9] Xu hướng | Bảng tuần × đối thủ: `=COUNTIFS(ads_cmp_name, $A5, ads_start, "<="&B$4+6, ads_last_seen, ">="&B$4)` (QC active trong tuần) | Line |
| [10] Cơ hội | `=SORT(FILTER(OPPORTUNITIES!B2:N, OPPORTUNITIES!M2:M>=7), 12, FALSE)` | Bảng |

### 12.3 Looker Studio (Phase 2)

Kết nối Google Sheets connector tới `RAW_ADS`, `AD_ANALYSIS`, `GOOGLE_TRENDS`, `LANDING_PAGES`. Blend theo `record_id`. Filter control: đối thủ, nền tảng, funnel, angle, khoảng ngày. Khi dữ liệu lớn hơn 50k dòng, nên đồng bộ sang BigQuery (Connected Sheets hoặc Apps Script đẩy hằng đêm).

---

## 12.4 Mẫu báo cáo tuần (WEEKLY_REPORT → Google Doc + email)

> Cấu trúc cố định. MVP: `Report.gs` điền số liệu và bảng, marketer viết phần nhận định (30 phút). Phase 2: Claude viết nháp từ dữ liệu tổng hợp, người duyệt trước khi gửi. **Mọi nhận định phải kèm `record_id`.** Không đủ dữ liệu thì ghi "Chưa đủ dữ liệu".

```
BÁO CÁO CẠNH TRANH QUẢNG CÁO — Tuần {W}/{YYYY} ({dd/mm}–{dd/mm})
Phạm vi: {markets} · Đối thủ: {n} · Nguồn: Meta, LinkedIn, Google ATC, Trends, {k} landing page
Dữ liệu: {x} quảng cáo được quan sát ({y} mới). Tất cả là dữ liệu công khai, thu thập thủ công/bán tự động.

0. TÓM TẮT (3–5 gạch đầu dòng)

1. QUẢNG CÁO MỚI PHÁT HIỆN
   Bảng: Đối thủ · Nền tảng · Headline/Hook · Angle · Funnel · Offer · Ngày bắt đầu · record_id · Link
   (Tách "Mới trên thị trường" vs "Mới với hệ thống".)

2. QUẢNG CÁO ĐỐI THỦ CÓ KHẢ NĂNG ĐANG ƯU TIÊN
   Top theo priority_signal: lý do (chạy {n} ngày · {v} biến thể · {p} nền tảng).
   ⚠ Tín hiệu ưu tiên ≠ hiệu quả. Không có dữ liệu ngân sách/ROAS.

3. HOOK · OFFER · CREATIVE ANGLE XUẤT HIỆN NHIỀU
   Top 5 angle (% và thay đổi so với 4 tuần trước) · Top 5 offer type · 5 hook tiêu biểu (trích nguyên văn ngắn, có record_id).

4. TỪ KHÓA GOOGLE TRENDS ĐANG TĂNG
   Keyword · momentum · hướng · rising queries đáng chú ý · ghi chú mùa vụ.
   (Chỉ số tương đối, không phải lượng tìm kiếm.)

5. THAY ĐỔI LANDING PAGE ĐỐI THỦ
   URL · section đổi · cũ → mới · ngày phát hiện.

6. KHOẢNG TRỐNG THÔNG ĐIỆP
   Angle/pain có trend tăng hoặc nhu cầu rõ nhưng ≤1 đối thủ khai thác, và hợp định vị Link Talent.

7. GIẢ THUYẾT QUẢNG CÁO NÊN THỬ (5–10)
   | # | Giả thuyết (Nếu… thì… vì…) | Insight/bằng chứng | Kênh | Funnel | Chỉ số đo | Score |

8. ĐỀ XUẤT CONCEPT · HEADLINE · CTA (nguyên bản, không sao chép)
   Mỗi concept: Angle · Big idea · 2–3 headline · CTA · Định dạng · Kiểm tra copy_risk = LOW.

Phụ lục: phương pháp, giới hạn dữ liệu, danh sách record_id.
```

**Ví dụ minh họa mục 7–8** (chỉ để minh họa cấu trúc. Số liệu và nhận định thật phải lấy từ dữ liệu thu thập):

| # | Giả thuyết | Căn cứ cần có | Kênh | Funnel | Đo bằng |
|---|---|---|---|---|---|
| H1 | Nếu nhấn "đánh giá năng lực 3C thay vì chỉ lọc CV" cho HR Manager thì CTR cao hơn angle "tuyển nhanh", vì angle SPEED đang bão hòa | Heatmap: SPEED chiếm tỷ trọng cao ở đa số đối thủ, QUALITY_FIT thấp | Meta, LinkedIn | TOFU | CTR, CPC so với control |
| H2 | Nếu dùng hook "Báo cáo ROI tuyển dụng gửi CEO trong 1 click" thì tỷ lệ đăng ký demo cao hơn, vì chưa đối thủ nào nói về báo cáo cho CEO | DATA_REPORTING ≤ 1 đối thủ; pain "thiếu data báo cáo CEO" trong ICP | LinkedIn | MOFU | CVR form demo |
| H3 | Nếu quảng cáo kết nối ứng viên đa kênh (Zalo + Email + SMS) nhắm pain "ứng viên không phản hồi" thì tương tác tốt hơn, vì đối thủ chủ yếu nói về kho ứng viên | VOLUME_REACH phổ biến, pain "không phản hồi" ít được nói | Meta | MOFU | CTR, lead |

Concept ví dụ (H1): **"Tuyển đúng người, không chỉ đúng CV"**
- Headline: "CV đẹp chưa chắc đã hợp. 3C Framework cho bạn thấy năng lực thật" · "Chấm Matching Score cho từng ứng viên theo JD, 24/7"
- CTA: "Đặt lịch demo 20 phút" (BOFU) / "Xem cách AI Matching chấm điểm" (MOFU)
- Kiểm tra: không dùng từ ngữ, số liệu, visual của đối thủ. Claim số liệu của Link Talent phải có nguồn nội bộ.
