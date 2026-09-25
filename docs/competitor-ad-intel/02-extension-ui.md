# 02 — Thiết kế giao diện Chrome Extension

## 4.1 Cấu trúc project và manifest (MV3)

```
cai-extension/
├── manifest.json
├── src/
│   ├── background/
│   │   ├── service-worker.js      # router message, alarms
│   │   ├── normalize.js           # chuẩn hóa text/url/date
│   │   ├── fingerprint.js         # SHA-256 qua crypto.subtle
│   │   ├── queue.js               # hàng đợi + retry (IndexedDB)
│   │   ├── api.js                 # client Apps Script (HMAC)
│   │   └── index-cache.js         # map ad_uid → content_fp đồng bộ từ Sheet
│   ├── content/
│   │   ├── detector.js            # nhận diện nguồn theo URL + DOM
│   │   ├── overlay.js             # checkbox/badge trong Shadow DOM
│   │   └── adapters/
│   │       ├── meta.js
│   │       ├── linkedin.js
│   │       ├── google-atc.js
│   │       ├── trends.js
│   │       └── landing.js         # inject theo yêu cầu (activeTab)
│   ├── popup/  (popup.html, popup.js)
│   ├── sidepanel/ (sidepanel.html, sidepanel.js)
│   ├── options/ (options.html)    # endpoint, user_id, secret, mặc định
│   └── shared/ (schema.js, constants.js, i18n/vi.json, en.json)
└── tests/ (fixtures HTML đã lưu cho từng nguồn + unit test adapter)
```

```json
{
  "manifest_version": 3,
  "name": "CAI – Competitor Ad Intel (Internal)",
  "version": "0.1.0",
  "action": { "default_popup": "src/popup/popup.html" },
  "side_panel": { "default_path": "src/sidepanel/sidepanel.html" },
  "options_page": "src/options/options.html",
  "background": { "service_worker": "src/background/service-worker.js", "type": "module" },
  "permissions": ["storage", "activeTab", "scripting", "sidePanel", "alarms", "contextMenus"],
  "host_permissions": [
    "https://www.facebook.com/ads/library/*",
    "https://www.linkedin.com/ad-library/*",
    "https://adstransparency.google.com/*",
    "https://trends.google.com/*",
    "https://script.google.com/*",
    "https://script.googleusercontent.com/*"
  ],
  "content_scripts": [{
    "matches": [
      "https://www.facebook.com/ads/library/*",
      "https://www.linkedin.com/ad-library/*",
      "https://adstransparency.google.com/*",
      "https://trends.google.com/trends/*"
    ],
    "js": ["src/content/bundle.js"],
    "run_at": "document_idle",
    "all_frames": false
  }],
  "commands": {
    "toggle-select": { "suggested_key": { "default": "Alt+S" }, "description": "Chọn/bỏ chọn card đang hover" },
    "open-panel":    { "suggested_key": { "default": "Alt+Shift+C" }, "description": "Mở Review Queue" }
  }
}
```

Lưu ý:
- **Không** xin `<all_urls>`. Landing page dùng `activeTab` + `chrome.scripting.executeScript` khi người dùng bấm nút, nên chỉ có quyền trên tab hiện tại, tại thời điểm đó.
- Google Ads Transparency render một số creative trong iframe (có thể khác origin). MVP chỉ lấy metadata ở trang chính + ảnh preview. Text trong iframe khác origin **không** đọc được thì cho người dùng nhập tay hoặc dán. Không cố vượt same-origin policy.
- Không dùng `webRequest`/`declarativeNetRequest` để chặn/đọc request của nền tảng.

---

## 4.2 Popup (360 × 560 px)

Trạng thái A — đang ở trang được hỗ trợ:

```
┌────────────────────────────────────────┐
│ CAI  ● Đã kết nối Sheets    ⚙  ⤢ Panel │
├────────────────────────────────────────┤
│ Nguồn: Meta Ad Library  (VN · Active)  │
│ Phát hiện: 14 quảng cáo đang hiển thị  │
│   🟢 9 mới  🔵 4 đã có  🟠 1 đã đổi      │
├────────────────────────────────────────┤
│ Ngữ cảnh lưu                           │
│ Đối thủ   [ TopCV (CMP-001)       ▾ ]  │  ← tự đoán từ Page ID/tên
│ Thị trường[ VN                    ▾ ]  │
│ Sản phẩm  [ ATS / Đăng tin        ▾ ]  │
│ Chiến dịch[ Q4-2026 Hiring Season ▾ ]  │
│ Phía KH   ( ) Employer ( ) Candidate (•) Tự nhận diện │
├────────────────────────────────────────┤
│ Tag   [ #webinar ✕ ][ #free-trial ✕ ][+]│
│ Ghi chú [____________________________] │
│ Đánh giá  ☆☆☆☆☆                        │
├────────────────────────────────────────┤
│ [ 💾 Lưu quảng cáo đã chọn (3) ]        │
│ [ 📥 Lưu tất cả đang hiển thị (14) ]    │
│ [ 🔎 Mở Review Queue ]                  │
├────────────────────────────────────────┤
│ Hàng đợi: 5 chờ gửi · 0 lỗi            │
│ Sync gần nhất: 09:42 — 3 mới, 1 cập nhật│
└────────────────────────────────────────┘
```

Trạng thái B — trang không hỗ trợ: hiển thị "Trang này không phải thư viện quảng cáo" + nút **"Lưu trang này làm Landing Page"** (inject `landing.js`) + nút **Launchpad**.

Trạng thái C — chưa cấu hình: CTA "Kết nối Google Sheets", mở Options.

Trạng thái sync (chấm màu góc trên):

| Màu | Ý nghĩa |
|---|---|
| 🟢 | `health` OK < 5 phút, queue trống |
| 🟡 | Có bản ghi đang chờ/đang retry |
| 🔴 | Lỗi auth/endpoint, hoặc lỗi ≥ 3 lần liên tiếp. Click để xem chi tiết |
| ⚪ | Chưa cấu hình |

---

## 4.3 Side Panel — Review Queue (chiều rộng 400–600 px)

```
┌──────────────────────────────────────────────────────────┐
│ Review Queue (8)     [Lọc: Tất cả ▾]  [Chọn tất cả ☐]     │
├──────────────────────────────────────────────────────────┤
│ ☑ 🟢 META · TopCV · Bắt đầu 02/09/2026 · Active · 23 ngày │
│   ┌──────┐ Headline: [Tuyển đúng người trong 7 ngày    ]  │
│   │ img  │ Body:     [Bạn đang mất hàng giờ lọc CV?...  ]  │
│   └──────┘ CTA: [Tìm hiểu thêm ▾]  Định dạng: [Image ▾]   │
│   LP: topcv.vn/nha-tuyen-dung?utm_… → domain: topcv.vn    │
│   Phía KH: [Employer ▾]  Funnel*: [TOFU ▾]  Angle*: [Speed]│
│   Tag: [#time-to-hire] [+]   ★★★☆☆   Ghi chú [_______]    │
│   ⓘ ad_uid meta:1234567890 · fp 9f2c…  · confidence 0.92 │
├──────────────────────────────────────────────────────────┤
│ ☐ 🟠 GOOGLE · VietnamWorks · Last shown 20/09 · Text     │
│   ⚠ Thiếu headline (iframe) — nhập tay hoặc bỏ qua        │
│   ...                                                    │
├──────────────────────────────────────────────────────────┤
│ [Xóa khỏi queue]  [Áp tag cho mục đã chọn]  [ Gửi (6) ▶ ] │
└──────────────────────────────────────────────────────────┘
 * Funnel/Angle ở đây là gợi ý rule-based, có thể sửa.
```

Tab khác trong Side Panel:
- **Launchpad**: danh sách URL từ `SEARCH_URLS`, nhóm theo đối thủ. Nút "Mở" từng dòng, "Mở nhóm" (≤5 tab, cách nhau 3 giây).
- **Trends Import**: vùng kéo thả CSV export từ Google Trends + chọn từ khóa/thị trường/khoảng thời gian.
- **Lịch sử sync**: 20 lần gửi gần nhất (lấy từ storage + `RUN_LOG`).

## 4.4 Overlay trên trang

- Mỗi card được phát hiện: một nút tròn 28 px góc phải trên, màu theo trạng thái (🟢 mới / 🔵 đã có / 🟠 đã đổi / ⚠ độ tin cậy thấp). Click để tick. Hover hiện tooltip `ad_uid` + ngày bắt đầu.
- Thanh nổi dưới cùng giữa: `3 đã chọn · [Thêm vào hàng đợi] · [Bỏ chọn] · [Ẩn overlay]`.
- Render trong **Shadow DOM** (`attachShadow({mode:'closed'})`) để CSS trang không ảnh hưởng và ngược lại.
- `MutationObserver` (debounce 500 ms) để phát hiện card mới khi **người dùng** cuộn. Extension không tự cuộn.

## 4.5 Options

| Trường | Ghi chú |
|---|---|
| Apps Script endpoint | URL `/exec` của deployment |
| User ID | ví dụ `u_linh` (do admin cấp trong `CONFIG.users`) |
| Secret | Hiển thị dạng `••••`, lưu `chrome.storage.local` (không dùng `sync` để không lan sang máy khác) |
| Người thu thập | Tên hiển thị, ghi vào `collector` |
| Mặc định | Thị trường, ngôn ngữ, "Phía KH" |
| Giới hạn | Số card tối đa mỗi lần lưu tất cả (mặc định 100), số tab Launchpad (5) |
| Nút | "Kiểm tra kết nối" (`GET action=health`), "Đồng bộ danh mục" (`GET action=config`), "Xóa cache cục bộ" |

## 4.6 Nguyên tắc UI/UX

- Ngôn ngữ giao diện: Tiếng Việt mặc định, có EN (`chrome.i18n`).
- Không có thao tác nào gửi dữ liệu đi mà không có click xác nhận của người dùng.
- Mọi trường trích xuất tự động đều **sửa được** trước khi gửi, và có chỉ báo `confidence`.
- Màu trạng thái luôn kèm icon/chữ (không chỉ dựa vào màu, hỗ trợ người mù màu).
- Khả năng truy cập: điều hướng bàn phím toàn bộ Side Panel, `aria-label` cho nút overlay.
