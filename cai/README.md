# CAI – Competitor Ad Intel (MVP)

Công cụ nội bộ để thu thập **bán tự động** quảng cáo công khai của đối thủ vào Google Sheets và phân tích. Dữ liệu khởi tạo phục vụ chiến dịch **Headhunt / Executive Search của Link Talent**.

- **Chrome Extension** (`extension/`): nhận diện quảng cáo trên Meta Ad Library, LinkedIn Ad Library, Google Ads Transparency Center. Bạn chọn quảng cáo, kiểm tra và bấm gửi. Extension cũng lưu landing page và import CSV từ Google Trends.
- **Google Apps Script** (`apps-script/`, bản gộp `apps-script-bundle/CAI.gs`): API ghi dữ liệu, chống trùng lặp, lưu lịch sử thay đổi, phân loại theo rule, tạo dashboard và báo cáo tuần.
- **Google Sheets**: nơi lưu và xem dữ liệu. Mọi tab được tạo tự động.

Thiết kế đầy đủ: [`docs/competitor-ad-intel/`](../docs/competitor-ad-intel/README.md).

> Extension **không** tự cuộn trang, không tự mở trang, không vượt đăng nhập hay CAPTCHA, không đọc cookie. Nó chỉ đọc những gì bạn đang xem và chỉ gửi đi khi bạn bấm **Gửi**.

---

## Cài đặt (khoảng 20 phút, không cần lập trình)

### Bước 1 — Tạo Google Sheet và Apps Script

1. Tạo Google Sheet mới, đặt tên, ví dụ `Link Talent – Competitor Ads`.
2. Vào **Tiện ích mở rộng → Apps Script**.
3. Xóa nội dung `Code.gs`, dán **toàn bộ** nội dung file [`apps-script-bundle/CAI.gs`](apps-script-bundle/CAI.gs), rồi bấm 💾 Lưu.
4. Vào ⚙ **Project Settings**, bật *Show "appsscript.json" manifest file in editor*. Mở `appsscript.json` và dán nội dung [`apps-script-bundle/appsscript.json`](apps-script-bundle/appsscript.json). Mục đích là đặt múi giờ `Asia/Ho_Chi_Minh` và runtime V8.
5. Quay lại Sheet và tải lại trang (F5). Menu **CAI** sẽ xuất hiện.
6. Chọn **CAI → 1. Khởi tạo / sửa cấu trúc sheet**. Google sẽ hỏi cấp quyền, chọn tài khoản của bạn → *Advanced* → *Go to project* → *Allow*.
   Hệ thống tạo 14 tab, nạp sẵn 10 đối thủ headhunt, 15 từ khóa và các URL tìm kiếm.

### Bước 2 — Tạo người dùng và triển khai Web App

1. Chọn **CAI → 2. Tạo người dùng**, nhập ID, ví dụ `u_linh`. **Copy secret** hiện ra, vì secret chỉ hiển thị một lần.
2. Trong Apps Script, bấm **Deploy → New deployment → ⚙ Web app**:
   - *Execute as*: **Me**
   - *Who has access*: **Anyone** (bắt buộc, vì Extension không gửi kèm cookie Google. Mọi request đều phải có chữ ký HMAC bằng secret của từng người dùng.)
3. Bấm **Deploy**, rồi copy **Web app URL** (kết thúc bằng `/exec`).
4. Chọn **CAI → Cài lịch chạy tự động**: hệ thống tính lại số liệu lúc 02:00 hằng đêm và tạo báo cáo sáng thứ Hai.
5. Trong tab `CONFIG`, điền `report_recipients` (email nhận báo cáo tuần).

> Mỗi lần sửa code Apps Script: **Deploy → Manage deployments → ✏ → Version: New version → Deploy**. URL giữ nguyên.

### Bước 3 — Cài Chrome Extension

1. Tải thư mục `cai/extension` về máy: trên GitHub bấm **Code → Download ZIP** rồi giải nén.
2. Mở `chrome://extensions`, bật **Developer mode**, bấm **Load unpacked**, chọn thư mục `cai/extension`.
3. Ghim icon 🔍 CAI lên thanh công cụ. Bấm vào ⚙ → điền **Web App URL**, **User ID**, **Secret** → **Kiểm tra kết nối**. Nếu thấy "Kết nối thành công… 10 đối thủ" là xong.

### Bước 4 — Xác minh dữ liệu đối thủ (15 phút, làm một lần)

Mở tab `COMPETITORS`:
- Kiểm tra `website` và `domain` của từng đối thủ. Đây là giá trị tham khảo, cột `verified` = FALSE. Sửa nếu sai, xóa hoặc đặt `PAUSED` cho đối thủ không liên quan, thêm đối thủ còn thiếu.
- Điền **Meta Page ID**: mở Meta Ad Library, tìm tên đối thủ, bấm vào trang của họ, rồi copy số trong tham số `view_all_page_id=` trên URL.
- Điền **Google Advertiser ID** (`AR…`): mở Google Ads Transparency, tìm theo domain, rồi copy mã `AR…` trên URL.
- Chọn **CAI → 3. Tạo lại URL tìm kiếm** sau khi sửa.

---

## Quy trình hằng tuần (60–90 phút)

| Việc | Cách làm |
|---|---|
| 1. Mở nguồn | Side Panel → **Launchpad**: bấm "Mở" từng URL (Meta, LinkedIn, Google, Trends). Hoặc mở từ tab `SEARCH_URLS` |
| 2. Chọn quảng cáo | Cuộn trang như bình thường. Mỗi quảng cáo có nút màu: 🟢 **Mới**, 🔵 **Đã có**, 🟠 **Đã đổi**, 🟣 **Cần kiểm tra**. Bấm để chọn (hoặc `Alt+S` khi trỏ chuột), rồi bấm **Thêm vào hàng đợi** trên thanh nổi. Muốn lấy hết thì dùng Popup → **Lưu tất cả đang hiển thị** |
| 3. Kiểm tra | Mở **Review Queue** (`Alt+Shift+C`): sửa headline/CTA nếu trích sai, chọn đối thủ, phía khách hàng (nhà tuyển dụng/ứng viên), tag, ghi chú, đánh giá. Quảng cáo Google dạng văn bản có thể phải dán nội dung tay |
| 4. Gửi | Bấm **Gửi ▶**. Kết quả hiện dạng "3 mới · 1 cập nhật · 1 trùng" |
| 5. Landing page | Mở landing page của quảng cáo nổi bật → Popup → **Lưu trang này làm Landing Page** → Gửi. Lần sau lưu lại, hệ thống tự so sánh và ghi nhận thay đổi offer/CTA |
| 6. Google Trends | Trên Trends, bấm ⬇ ở biểu đồ *Mức độ quan tâm theo thời gian* và *Truy vấn liên quan* → Side Panel → **Trends** → kéo thả 2 file CSV → nhập batch (B1/B2/B3) → Gửi |
| 7. Phân tích | Sheet: tab `AD_ANALYSIS`. Sửa nhãn trong các cột `*_manual` nếu rule gán sai, và chấm `brand_fit_1_5` trong `OPPORTUNITIES` |
| 8. Báo cáo | Thứ Hai nhận email → tab `WEEKLY_REPORT` → điền mục 7 (giả thuyết) và mục 8 (concept) |

---

## Bắt đầu nghiên cứu cho chiến dịch Headhunt

**Đối thủ đã nạp sẵn** (cần xác minh): Navigos Search, First Alliances, Talentnet, HRchannels, Robert Walters Vietnam, JAC Recruitment Vietnam (trực tiếp); ManpowerGroup Vietnam, TopCV, VietnamWorks, CareerViet (gián tiếp).

**Từ khóa và batch Trends** (anchor chung `headhunter`):
- B1: headhunter · dịch vụ headhunt · công ty headhunter · săn đầu người · executive search
- B2: headhunter · tuyển dụng nhân sự cấp cao · tuyển giám đốc · tuyển dụng quản lý · phí headhunt
- B3: headhunter · headhunt IT · dịch vụ tuyển dụng · tuyển dụng nhanh · RPO

**Creative angle cho headhunt** (dùng để phân loại tự động): `SPEED` (shortlist nhanh), `QUALITY_FIT` (đúng người), `SENIOR_TALENT` (C-level, quản lý), `NICHE_EXPERTISE` (IT, tài chính, FMCG…), `PASSIVE_NETWORK` (ứng viên thụ động, mạng lưới), `GUARANTEE` (bảo hành thay thế), `PRICING` (phí % lương, chỉ trả khi thành công), `CONFIDENTIAL` (tuyển kín), `AI_TECH`, `SOCIAL_PROOF`, `PAIN_FEAR`, `EDUCATION` (báo cáo lương), `EVENT`, `DATA_REPORTING`, `CANDIDATE_JOB` (quảng cáo tuyển dụng nhắm ứng viên).

**Điều nên chú ý trong tuần đầu:**
1. Nhiều công ty headhunt chạy quảng cáo **tuyển ứng viên** ("Tuyển CFO, lương…"). Hãy gắn `audience_side = CANDIDATE` cho những quảng cáo này, dashboard sẽ tách riêng. Quảng cáo nhắm **doanh nghiệp** mới là đối tượng so sánh trực tiếp.
2. Ghi lại **offer** của đối thủ: bảo hành thay thế bao nhiêu ngày, mức phí, tư vấn miễn phí, báo cáo lương.
3. Mục tiêu tuần 1: thu thập ít nhất 30–50 quảng cáo phía nhà tuyển dụng. Sau đó tab `OPPORTUNITIES` mới đủ dữ liệu để chấm điểm cơ hội.

---

## Cấu trúc mã nguồn

```
cai/
├── apps-script/            # mã nguồn Apps Script (mỗi file một chức năng)
│   ├── Config.gs           # schema sheet, danh mục, seed đối thủ/từ khóa headhunt
│   ├── Code.gs             # doGet/doPost + router
│   ├── Auth.gs             # HMAC-SHA256, chống replay
│   ├── Schema.gs           # validate payload
│   ├── Upsert.gs           # ads / landing / trends / analysis / index / config
│   ├── Rules.gs            # rule phân loại funnel, angle, framework, offer, pain, audience
│   ├── Jobs.gs             # tính lại hằng đêm, priority signal, Trends summary, OPPORTUNITIES
│   ├── Report.gs           # Dashboard + báo cáo tuần + email
│   ├── Setup.gs            # menu, khởi tạo, người dùng, URL tìm kiếm, trigger
│   ├── Repo.gs, Log.gs, Utils.gs
├── apps-script-bundle/     # bản gộp một file để dán (sinh bằng `npm run bundle`)
├── extension/              # Chrome Extension MV3
│   ├── manifest.json
│   └── src/{background,content,shared,ui}
├── tests/                  # test Node (giả lập Apps Script + jsdom) và E2E Chromium
└── tools/                  # kiểm tra cú pháp, gộp .gs
```

## Dành cho developer

```bash
cd cai
npm install          # jsdom cho test adapter
npm test             # 29 test: Apps Script (giả lập Sheets), chuẩn hóa, Trends CSV, adapter, parity rule
npm run test:e2e     # nạp Extension thật vào Chromium: trang Meta mẫu → overlay → hàng đợi → gửi → RAW_ADS
npm run check        # cú pháp .gs/.js + file manifest tham chiếu
npm run bundle       # cập nhật apps-script-bundle/CAI.gs sau khi sửa apps-script/*.gs
```

Khác biệt so với tài liệu thiết kế (có chủ đích, để MVP chạy ổn định):
- Dashboard, cột dẫn xuất (`run_days`, `is_long_running`…) và phân loại được **tính bằng Apps Script** rồi ghi giá trị, không dùng công thức mảng. Nhờ vậy không lo xung đột khi ghi và không phụ thuộc giới hạn của công thức Sheets. Cột `*_manual` vẫn ưu tiên hơn `*_auto`.
- Server nhận `content_fp` từ Extension (đã kiểm định dạng) thay vì tự tính lại. Test parity đảm bảo rule ở hai phía cho cùng kết quả.
- Google Trends dùng **CSV export** do người dùng tải. Không đọc DOM biểu đồ vì dễ vỡ.

**Giới hạn đã biết:**
- Selector được viết theo cấu trúc giao diện công khai và kiểm thử trên HTML mẫu. Giao diện thật của Meta, LinkedIn và Google thay đổi thường xuyên. Nếu một trường trích sai, hãy sửa trong Review Queue và báo dev cập nhật `extension/src/content/adapters/*.js`.
- Trong Google Ads Transparency, text quảng cáo nằm trong iframe khác nguồn nên không đọc được. Cần dán tay.
- Tham số URL tìm kiếm của LinkedIn Ad Library cần xác minh trên giao diện hiện tại.
- Pháp chế nên review điều khoản sử dụng của từng nền tảng trước khi dùng rộng (xem `docs/competitor-ad-intel/08-roadmap-risks-testing.md` §15).
