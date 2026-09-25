# Competitor Ad Intelligence (CAI) — Tài liệu thiết kế

> Hệ thống thu thập **bán tự động**, lưu trữ và phân tích quảng cáo công khai của đối thủ trên Meta Ad Library, LinkedIn Ad Library, Google Ads Transparency Center, Google Trends và landing page. Gồm: Chrome Extension (MV3), Google Apps Script Web App, Google Sheets (Looker Studio ở giai đoạn sau).

Phiên bản: v1.0 · Ngày: 2026-09-25 · Chủ sở hữu: Marketing Link Talent · Trạng thái: Draft để review

> **Triển khai MVP:** mã nguồn và hướng dẫn cài đặt nằm ở [`cai/`](../../cai/README.md) (Extension + Apps Script + test). Dữ liệu khởi tạo phục vụ chiến dịch Headhunt.

---

## 0. Giả định (điền lại khi có thông tin chính thức)

Brief gốc còn để trống các trường đầu vào. Tài liệu dùng **Link Talent** làm dữ liệu mẫu để ví dụ cụ thể. Mọi giá trị dưới đây nằm trong tab `CONFIG` / `COMPETITORS` / `KEYWORDS`, nên đổi sang doanh nghiệp khác chỉ cần sửa dữ liệu, không phải sửa code.

| Trường | Giá trị giả định | Ghi chú |
|---|---|---|
| Doanh nghiệp | Link Talent (linktalent.vn) | Nền tảng AI tuyển dụng, All-in-One Talent Intelligence |
| Ngành hàng | HR Tech / SaaS tuyển dụng B2B | |
| Thị trường | Việt Nam (`VN`) | Mở rộng thêm SG/TH/ID bằng cách thêm dòng trong `CONFIG.markets` |
| Sản phẩm nghiên cứu | AI Matching, ATS, đánh giá năng lực 3C, kết nối đa kênh (Zalo/Email/SMS), Dashboard ROI tuyển dụng | |
| Đối thủ | TopCV, VietnamWorks, CareerViet, AITALENT (+ tùy chọn: Base.vn/Base E-Hiring, 1Office, Workable, Manatal) | Nhóm sau là ATS/HRM, nên xác nhận lại có nằm trong phạm vi không |
| Từ khóa ban đầu | phần mềm tuyển dụng, phần mềm quản lý tuyển dụng, ATS, AI tuyển dụng, đăng tin tuyển dụng, tìm ứng viên, sàng lọc CV, headhunt, tuyển dụng nhanh, recruitment software | Chia nhóm trong tab `KEYWORDS` |
| Tần suất | **Hàng tuần** (thứ Hai) cho báo cáo. Người dùng thu thập bất kỳ lúc nào | Meta/Google có thể quét tay 2–3 lần/tuần trong mùa cao điểm tuyển dụng (sau Tết, tháng 8–9) |
| Ngôn ngữ dữ liệu | Cả hai (VI + EN) | Rule phân loại có từ điển song ngữ |
| Người dùng | Marketing team in-house 3–5 người (Performance, Content, Brand), Founder/CEO đọc báo cáo | Chưa có Dev chuyên trách: cần 1 dev part-time cho MVP |

**Đặc thù ngành cần lưu ý:** TopCV, VietnamWorks, CareerViet chạy quảng cáo cho **hai phía**: nhà tuyển dụng (B2B, cạnh tranh trực tiếp) và ứng viên tìm việc (B2C, không cạnh tranh trực tiếp). Vì vậy schema có thêm trường `audience_side` (`EMPLOYER` / `CANDIDATE` / `UNKNOWN`) và dashboard mặc định lọc `EMPLOYER`.

**Giả định kỹ thuật**
- Người dùng có Google Workspace hoặc Gmail, có quyền tạo Apps Script gắn với Spreadsheet.
- Extension được phân phối nội bộ (unpacked hoặc Chrome Web Store dạng *Private/Unlisted*), không public.
- Không có ngân sách mua công cụ spy ads bên thứ ba ở MVP.
- Khối lượng: khoảng 4–8 đối thủ, dưới 500 quảng cáo mới mỗi tháng. Google Sheets đủ tải trong 12–18 tháng (xem giới hạn ở [08-roadmap-risks-testing.md](08-roadmap-risks-testing.md)).

---

## Mục lục

| # | Đầu ra yêu cầu | File | Phân loại |
|---|---|---|---|
| 1 | Sơ đồ kiến trúc tổng thể | [01-architecture-flow.md](01-architecture-flow.md#1-sơ-đồ-kiến-trúc-tổng-thể) | MVP |
| 2 | Flowchart từ tìm kiếm đến báo cáo | [01-architecture-flow.md](01-architecture-flow.md#2-flowchart-từ-tìm-kiếm-đến-báo-cáo) | MVP |
| 3 | User journey chi tiết (11 bước) | [01-architecture-flow.md](01-architecture-flow.md#3-user-journey-chi-tiết) | MVP |
| 4 | Thiết kế giao diện Chrome Extension | [02-extension-ui.md](02-extension-ui.md) | MVP |
| 5 | Data schema Google Sheets | [03-sheets-schema.md](03-sheets-schema.md) | MVP |
| 6 | Quy tắc trích xuất theo nền tảng | [04-extraction-rules.md](04-extraction-rules.md) | MVP |
| 7 | Chống trùng lặp và cập nhật + logic phân tích | [05-dedup-analysis-logic.md](05-dedup-analysis-logic.md) | MVP + Phase 2 |
| 8 | Cấu trúc Google Apps Script API | [06-api-apps-script.md](06-api-apps-script.md#8-cấu-trúc-google-apps-script) | MVP |
| 9 | Endpoint và JSON request/response mẫu | [06-api-apps-script.md](06-api-apps-script.md#9-danh-sách-endpoint--json-mẫu) | MVP |
| 10 | Pseudocode Extension và Apps Script | [06-api-apps-script.md](06-api-apps-script.md#10-pseudocode) | MVP |
| 11 | Công thức Google Sheets | [07-formulas-dashboard-report.md](07-formulas-dashboard-report.md#11-công-thức-google-sheets) | MVP |
| 12 | Thiết kế dashboard + mẫu báo cáo tuần | [07-formulas-dashboard-report.md](07-formulas-dashboard-report.md#12-thiết-kế-dashboard) | MVP (tay) / Phase 2 (AI) |
| 13 | Kế hoạch MVP 2–4 tuần | [08-roadmap-risks-testing.md](08-roadmap-risks-testing.md#13-kế-hoạch-mvp-4-tuần) | MVP |
| 14 | Phase 2: AI phân loại và báo cáo | [08-roadmap-risks-testing.md](08-roadmap-risks-testing.md#14-phase-2--ai-phân-loại--báo-cáo) | Phase 2 |
| 15 | Rủi ro, giới hạn, biện pháp | [08-roadmap-risks-testing.md](08-roadmap-risks-testing.md#15-rủi-ro-giới-hạn-và-biện-pháp) | MVP |
| 16 | Checklist kiểm thử và nghiệm thu | [08-roadmap-risks-testing.md](08-roadmap-risks-testing.md#16-checklist-kiểm-thử--tiêu-chí-nghiệm-thu) | MVP |

---

## Tóm tắt quyết định kiến trúc

| Quyết định | Lựa chọn | Lý do |
|---|---|---|
| Cách thu thập | **Người dùng chủ động** mở trang, cuộn và chọn quảng cáo. Extension chỉ đọc DOM đã hiển thị | Tuân thủ ToS: không crawl nền, không tự cuộn/phân trang, không vượt đăng nhập/CAPTCHA |
| UI review dữ liệu | Popup (thao tác nhanh) + **Side Panel** (xem trước, sửa, gửi hàng loạt) | Popup tự đóng khi mất focus, không hợp để sửa nhiều bản ghi |
| Quyền host | Chỉ 4 domain thư viện quảng cáo + endpoint Apps Script. Landing page dùng `activeTab` | Tối thiểu quyền. Chrome Web Store duyệt dễ hơn |
| Khóa định danh | `ad_uid` = platform + ID gốc của nền tảng. `content_fp` = SHA-256 nội dung chuẩn hóa. `creative_fp` = hash media | Tách được "cùng quảng cáo", "nội dung đổi" và "creative tái sử dụng" |
| Backend | Apps Script Web App (MVP) → API trung gian Cloud Run/Workers (Phase 2, khi hơn 10 người dùng hoặc cần OAuth) | Không tốn hạ tầng ở MVP |
| Bí mật | Token/HMAC secret lưu ở **Script Properties** và `chrome.storage.local`, **không** lưu plaintext trong tab `CONFIG` | Mọi editor của Sheet đều đọc được ô tính |
| Phân tích | MVP: rule/regex song ngữ + đánh giá tay. Phase 2: Claude API (structured JSON) + embedding clustering | Chạy được ngay, AI bổ sung sau khi có dữ liệu gắn nhãn để đánh giá |
| Diễn giải | "Tín hiệu ưu tiên" (chạy lâu, nhiều biến thể, đa nền tảng), **không** suy ra hiệu quả/ngân sách/ROAS | Đúng yêu cầu tuân thủ, tránh kết luận sai |
