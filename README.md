# 🏺 Aladinn — Trợ lý Lâm sàng AI cho VNPT HIS

<div align="center">

**v1.5.0** · Chrome Extension · Manifest V3 · Dành riêng cho VNPT HIS

[![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com/fantasy-1608/Aladinn)
[![Version](https://img.shields.io/badge/version-1.5.0-gold?style=flat-square)](https://github.com/fantasy-1608/Aladinn/releases)
[![License](https://img.shields.io/badge/license-Private-lightgrey?style=flat-square)](https://github.com/fantasy-1608/Aladinn)

> Tích hợp AI · Bảo mật y tế · Desert Mystic Design

</div>

---

## Giới thiệu

**Aladinn** là tiện ích Chrome được xây dựng đặc thù cho hệ thống **VNPT HIS**, hỗ trợ bác sĩ và điều dưỡng khai thác nhanh dữ liệu lâm sàng, phân tích AI chuyên sâu, và tối ưu hoá quy trình ghi chép y khoa — tất cả chạy trực tiếp trong trình duyệt mà không cần server trung gian.

---

## ✨ Tính năng

### 🏥 Bảng CLS + Thuốc (5 Tab)

Giao diện modal 5 tab hiển thị toàn bộ thông tin lâm sàng của bệnh nhân đang chọn:

| Tab | Nội dung |
|-----|----------|
| 🏥 **Khám vào viện** | Lý do nhập viện, bệnh sử, tiền sử bản thân & gia đình, khám lâm sàng, chẩn đoán ban đầu |
| 📋 **Lâm sàng & Thuốc** | Diễn tiến hàng ngày + danh sách thuốc (tên, liều, đường dùng) |
| 🧪 **Xét nghiệm** | Bảng XN toàn bộ, highlight giá trị bất thường, timeline theo ngày |
| 🩻 **CĐHA** | Chẩn đoán hình ảnh, kết quả X-quang / ECG / siêu âm / CT |
| 🤖 **Phân tích AI** | Tóm tắt lâm sàng tự động bằng Gemini AI với context 360° |

### 🤖 Voice AI Assistant

Nhập liệu bằng giọng nói, AI trích xuất và điền tự động vào phiếu HIS:

- **Speech-to-text** với tự động sửa lỗi nhận dạng y khoa (sinh hiệu, chẩn đoán, bộ phận cơ thể)
- **De-identification**: tự động ẩn họ tên, CCCD, số điện thoại, ngày sinh trước khi gửi AI
- **Auto-fill**: điền kết quả AI vào `lyDoVaoVien`, `quaTrinhBenhLy`, `khamToanThan`, `khamBoPhan`, `chanDoanBanDau`, sinh hiệu…
- **ICD-10 gợi ý**: AI đề xuất mã ICD phù hợp với chẩn đoán
- **Token cost**: hiển thị số tokens và chi phí VNĐ ước tính sau mỗi lần gọi

### 📝 Slash Command Templates

- Gõ `/` trong bất kỳ textarea nào của HIS để kích hoạt menu gợi ý
- Tìm kiếm và chọn mẫu câu lâm sàng được định nghĩa sẵn
- Tuỳ chỉnh đầy đủ trong tab **Mẫu Bệnh Án** (thêm / chỉnh sửa / xoá)

### 📋 Phiếu Hội Chẩn (Preview & Edit)

- Preview toàn bộ phiếu hội chẩn trong modal riêng trước khi import
- **Chỉnh sửa trực tiếp** trên bảng preview — các trường liên quan tự đồng bộ nhau
- Định dạng chẩn đoán: tự động loại bỏ mã ICD-10, chuẩn hoá dấu phân cách thành dấu phẩy
- "Trích biên bản hội chẩn" hiển thị đầu tiên đúng theo form hội chẩn

### 🧠 Clinical Decision Support (CDS)

- Phát hiện **tương tác thuốc** (DDI) dựa trên database nội bộ
- Cảnh báo **chống chỉ định thuốc – bệnh lý** (ví dụ: Trimetazidine + Parkinson)
- Kiểm tra **trùng nhóm điều trị** (Duplicate therapy)
- Cảnh báo **BHYT xuất toán** (mã ICD không khớp, thuốc ngoài danh mục)
- Đánh giá **bất thường xét nghiệm + thuốc** (ví dụ: INR > 3 + Warfarin, eGFR < 30 + Metformin)

### 🩻 Tích hợp PACS

- Lấy URL ảnh DICOM qua `Ris-Access-Hash` của VNPT HIS
- Xem trực tiếp hình ảnh PACS trong modal AI mà không cần mở tab mới

### ✍️ Auto-Sign

- Tự động ký duyệt phiếu thuốc / y lệnh với xác nhận bắt buộc
- Nút dừng khẩn cấp — tự tắt khi rời khỏi phiên ký
- Auto switch-back từ tab PDF preview về HIS

---

## 🛡️ Bảo mật & Quyền riêng tư (v1.2.1)

Aladinn được kiểm toán bảo mật toàn diện với 8 điểm được xử lý:

| Lớp bảo mật | Triển khai |
|---|---|
| **Mã hoá API Key** | AES-256-GCM + PBKDF2 (310,000 iterations). CryptoKey không bao giờ rời background service worker |
| **Crypto service** | Content script gửi plaintext → background mã hoá/giải mã → trả kết quả. Không có raw key nào trong content script |
| **De-identification AI** | Họ tên, CCCD, số ĐT, ngày sinh, mã BN bị ẩn trước khi gửi Gemini |
| **Nonce bắt buộc** | Tất cả postMessage đều yêu cầu nonce hợp lệ — không có message nào được chấp nhận nếu thiếu |
| **Prompt injection** | Văn bản nhập được escape bằng `JSON.stringify()` trước khi nhúng vào system prompt |
| **Endpoint allowlist** | `geminiBaseUrl` chỉ được phép trỏ đến `*.googleapis.com`, `*.vncare.vn`, `*.githubusercontent.com` (chỉ dùng cho remote config) hoặc `localhost` |
| **PHI trong log** | Error log chỉ lưu short ID (`P-****`), không lưu họ tên/địa chỉ. TTL 24h tự xoá |
| **Export PHI** | Cần xác nhận từ người dùng trước khi xuất CSV/JSON + ghi audit log |
| **Legacy plaintext** | Tự động phát hiện dữ liệu cũ chưa mã hoá, cảnh báo người dùng nhập PIN. Tự xoá sau 24h |
| **Session timeout** | Key tự xoá khỏi memory sau 30 phút không hoạt động |
| **Logout detection** | Phát hiện logout VNPT HIS → xoá toàn bộ cache bệnh nhân khỏi storage |

---

## 🚀 Cài đặt

### Yêu cầu

- Chrome / Chromium ≥ 120
- Tài khoản VNPT HIS
- Google AI Studio API Key (Gemini Flash / Pro)

### Từ GitHub Release (khuyến nghị)

1. Tải file `.zip` từ [Releases](https://github.com/fantasy-1608/Aladinn/releases/latest)
2. Giải nén → mở Chrome → `chrome://extensions`
3. Bật **Developer mode** → **Load unpacked** → chọn thư mục vừa giải nén

### Từ source code

```bash
git clone https://github.com/fantasy-1608/Aladinn.git
cd Aladinn
pnpm install
pnpm run build
```

Sau đó load thư mục `dist/` trong `chrome://extensions`.

### Cấu hình lần đầu

1. Click icon Aladinn trên thanh công cụ Chrome
2. Vào **Cài đặt** → nhập **Gemini API Key** và đặt **PIN 6 số** bảo vệ
3. Vào trang bệnh nhân VNPT HIS → dùng các nút **CLS + Thuốc**, **Tóm tắt AI**, **Hội chẩn**

---

## 🏗️ Kiến trúc

```text
Aladinn/
├── background/
│   ├── service-worker.js       # Message routing, sender validation, session management
│   ├── ai-client.js            # Gemini API, background crypto service (AES-GCM)
│   └── updater.js              # Auto-update checker
│
├── content/
│   ├── scanner/
│   │   ├── scanner-init.js     # Modal 5-tab, UI orchestration
│   │   ├── clinical-fill.js    # Phiếu hội chẩn preview & auto-fill
│   │   ├── export.js           # CSV/JSON export + PHI consent
│   │   ├── messaging.js        # postMessage bridge (nonce-mandatory)
│   │   └── logger.js           # PHI-redacted error logger + TTL
│   ├── voice/
│   │   ├── storage.js          # Encrypted storage via background crypto service
│   │   ├── ai.js               # Voice AI + display results + PIN unlock
│   │   ├── speech.js           # Web Speech API wrapper
│   │   └── autofill.js         # Form field auto-fill
│   └── cds/
│       ├── cds-cache.js        # Patient data cache (composite key)
│       └── cds-engine.js       # DDI / Drug-Disease / Insurance rules
│
├── injected/
│   ├── api-bridge.js           # HIS API interceptor (VNPT HIS jsonrpc)
│   ├── ajax-interceptor.js     # XHR/Fetch snooping cho CDS data
│   └── grid-hook.js            # jqGrid event hooks
│
├── popup/
│   └── popup.html/js           # Popup: bật/tắt module, badge
│
├── options/
│   └── options.html/js         # Cài đặt: API Key, PIN, Templates, CDS, AI Config
│
└── manifest.json               # Chrome Extension Manifest V3
```

### Luồng dữ liệu bảo mật

```
[User types PIN]
      ↓
[Content script] → CACHE_SESSION_PIN → [Background]
                                            ↓
                                     PBKDF2 derive CryptoKey
                                     (non-extractable, memory only)
                                            ↓
[Content script] ←── {unlocked: true} ←───┘

[Transcript saved]
[Content script] → ENCRYPT_DATA(plaintext) → [Background: AES-GCM encrypt]
                 ← {ciphertext} ←────────────────────────────────────────
                       ↓
               chrome.storage.local (encrypted blob only)
```

---

## 📦 Changelog

### v1.5.0 (21/05/2026) — Giao diện Glassmorphism mới & Hỗ trợ Ngoại trú toàn diện

**Giao diện & Tiện ích:**
- **Nút nổi Kính mờ (Glassmorphism)**: Giao diện premium hiện đại bằng kính mờ sang trọng, bộ icon SVG sắc nét, đi kèm hiệu ứng nhấn đàn hồi vật lý và phát sáng êm ái.
- **Tự động lọc nút thông minh**: Tự ẩn/hiện nút phù hợp nhất với bảng HIS đang mở (ví dụ: chỉ hiện duy nhất nút "Điền Xử trí" trên bảng Xử trí, ẩn các nút khác để tránh rối mắt).
- **Hỗ trợ toàn diện cho Ngoại trú**: Sửa lỗi bảng xem trước rỗng thông tin ở phân hệ khám Ngoại trú. Tiện ích hiện đã lấy đầy đủ lý do khám, tiền sử, sinh hiệu... từ tab "Bệnh án".
- **Điền Xử trí nhanh 1-Click**: Tự động điền thẳng thông tin lâm sàng vào phiếu Xử trí của HIS mà không cần thông qua bảng xem trước trung gian để tiết kiệm thao tác.
- **Giữ bảng xem trước cho Hội chẩn & Chuyển viện**: Cho phép bác sĩ xem, chỉnh sửa trực tiếp và kiểm tra dữ liệu cẩn thận trước khi điền chính thức.
- **Sửa lỗi điền bệnh kèm theo**: Cải tiến logic điền thông tin tự động mở khóa ô nhập bệnh kèm theo và đồng bộ mã bệnh chính xác.

### v1.4.1 (18/05/2026) — Safety Lock & Testing Release

**Bảo mật & An toàn lâm sàng (Clinical Safety):**
- Tắt mặc định Auto-Sign, Voice, CDS để đảm bảo an toàn tối đa khi cài mới (chỉ bật Scanner).
- Bổ sung tài liệu An Toàn Lâm Sàng (Clinical Safety).
- Chuẩn bị nền tảng cho PHI Redactor, JSON Schema Validator và Patient Context Guard.

### v1.3.0 (12/05/2026) — Stabilization & Hardening

**Tính năng & Ổn định:**

- Sửa lỗi updater, hỗ trợ dual-endpoint cho GitHub API và fallback JSON.
- Tối ưu `FORCE_CDS_SYNC` để trả kết quả chuẩn xác.
- Sửa state migration, load đúng cấu hình mã hoá PIN.
- Dẹp bỏ `geminiBaseUrl` giả, bắt buộc dùng Google API để tránh block.
- Khắc phục lỗi nhầm tab ở Multi-window khi ký số bằng cách track theo `windowId`.
- Tăng cường bảo mật bridge message bằng cách xác thực qua cả `token` lẫn `nonce`.
- Bổ sung fallback AI model trong requestAI (`gemini-2.0-flash`).

### v1.2.1 (03/05/2026) — SmartCA Guard & CDS Expansion

**Tính năng mới:**

- SmartCA Guard: polling thông minh cho auto-logout, re-login ngay trong modal e-Seal
- CDS mở rộng Phase 4–6: 426 DDI rules, VN alias mapping, missing diagnosis detection
- Slash command nâng cấp: trigger `//`, hoạt động mọi ô kể cả iframe modal HIS

**Sửa lỗi:**

- clinical-fill: lấy đúng tờ điều trị mới nhất + gộp Khám toàn thân
- template: slash command hoạt động đúng trong mọi ô nhập liệu HIS

### v1.2.0 (30/04/2026) — Security Hardening & Feature Polish

**Bảo mật:**

- Background Crypto Service (AES-256-GCM + PBKDF2), nonce bắt buộc, prompt injection prevention
- PHI redaction + TTL 24h, endpoint allowlist, export consent + audit log

**Tính năng:**

- Phiếu hội chẩn: chỉnh sửa trực tiếp trên bảng preview, đồng bộ các trường liên quan
- Slash command templates: thêm nút **Chỉnh sửa** bên cạnh nút Xoá (inline edit form)
- Định dạng chẩn đoán: tự động strip mã ICD-10, chuẩn hoá dấu phân cách

### v1.1.9 (27/04/2026) — Stability Upgrade

- `resolveActiveGrid()` hỗ trợ cả nội trú và ngoại trú
- Composite patient key (`benhnhanId_khambenhId`) ngăn data leak
- Linting cleanup toàn bộ codebase — 0 errors, 0 warnings

### v1.1.7 (25/04/2026) — BHYT Glucose Scanner

- Fix API field mapping cho glucose mao mạch (hybrid timestamp strategy)
- HTML sanitization input bệnh nhân

---

## 🔧 Development

```bash
pnpm run dev      # Vite watch mode (reload extension thủ công)
pnpm run build    # Production build → dist/
pnpm run lint     # ESLint check
pnpm run release  # Build + đóng gói zip + tạo GitHub Release
```

**Quy tắc bắt buộc:**

- Không commit API key hay dữ liệu bệnh nhân thật
- Chạy `pnpm run build` sau mỗi thay đổi source trước khi test
- Animation chỉ dùng `transform` / `opacity` (GPU-accelerated)
- Palette: Desert Mystic — `#d4a25a` gold · `#1a1410` dark · `#e8dcc8` text
- Mọi component mới phải tham chiếu `design_tokens.md` và `animation_tokens.md`

---

## 📄 License

**Private** — Dành riêng cho sử dụng nội bộ bệnh viện. Không phân phối công khai.

---

<div align="center">

> Built with ❤️ for Vietnamese clinicians

**Tác giả: Bác sĩ Huỳnh Trung Anh** · Powered by Gemini AI · Desert Mystic Design

</div>
