# 📜 Changelog — Aladinn

Tất cả thay đổi quan trọng của dự án **Aladinn — Trợ lý Lâm sàng AI cho VNPT HIS** được ghi nhận tại đây.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
và tuân theo [Semantic Versioning](https://semver.org/lang/vi/).

---

## [1.2.3] — 2026-05-08

### 🛡 Safe Mode (Kill Switch từ xa)

- **Remote Config**: Tích hợp module cấu hình từ xa qua GitHub, cho phép tắt nóng các tính năng nhạy cảm (Auto-Sign, CDS, AI) trên tất cả các máy trạm mà không cần người dùng cài lại tiện ích.
- **Fail-open & Graceful Shutdown**: Kiến trúc an toàn đảm bảo không chặn tiến trình tải UI và chỉ chạy khi có cấu hình hợp lệ.
- Fix markdown linting.

---

## [1.2.2] — 2026-05-07

### 🛠 Kỹ thuật & Hạ tầng (30-day Stabilization Phase)

- **CI/CD Automation**: Tự động hóa quá trình đóng gói và phát hành (release) qua GitHub Actions, loại bỏ rủi ro stale zip.
- **Testing Coverage**: Bổ sung Unit Tests (jsdom, vitest) cho `CDSCacheManager` và quy trình trích xuất chẩn đoán.
- **Linter Enforced**: Loại bỏ triệt để mọi cảnh báo (Zero-Linter-Warning).

---

## [1.2.1] — 2026-05-03

### ✨ Tính năng mới

- **SmartCA Guard — Tự động xử lý đăng xuất & đăng nhập lại**
  - Polling thông minh thay thế timeout cố định, tương thích mọi tốc độ mạng
  - Tự nhận diện khi SmartCA đăng nhập sai tài khoản → hiển thị cảnh báo mismatch
  - UX re-login mượt mà: đăng nhập lại ngay trong modal e-Seal mà không cần đóng/mở lại
  - Tự động cleanup warning khi re-login thành công

- **Clinical Decision Support (CDS) — Mở rộng Phase 4–6**
  - Tăng DDI rules lên **426 quy tắc** tương tác thuốc (từ ~200 lên 426)
  - Thêm **VN-to-INN Alias Mapping** — nhận diện tên thuốc tiếng Việt / biệt dược viện
  - Logic phát hiện **thiếu chẩn đoán** khi kê đơn (Missing Diagnosis Rules)
  - Bao phủ thêm: Corticoids, Thuốc chống động kinh, CCB, Ức chế miễn dịch

- **Slash Command Templates nâng cấp**
  - Trigger bằng `//` thay vì `/` — tránh xung đột với HIS date fields
  - Hoạt động trong **mọi ô nhập liệu** bao gồm cả iframe modal HIS
  - Event delegation cải tiến cho cross-origin iframes

### 🐛 Sửa lỗi

- **clinical-fill**: Lấy đúng tờ điều trị **mới nhất** (client-side sort) thay vì phụ thuộc server
- **clinical-fill**: Gộp dữ liệu "Khám toàn thân" vào trường "Tóm tắt TT hiện tại" 
- **template**: Slash command không hoạt động trong một số ô nhập liệu HIS đặc biệt

### 📊 Thống kê phiên bản

| Chỉ số | Giá trị |
|--------|---------|
| Files changed | 73 |
| Insertions | +11,150 |
| Deletions | -1,209 |
| DDI Rules | 426 |
| Commits since v1.2.0 | 5 |

---

## [1.2.0] — 2026-04-30

### 🔐 Bảo mật — Security Hardening

- **Background Crypto Service**: `storageKey` không còn là raw API key — background service worker là crypto authority duy nhất
- **AES-256-GCM + PBKDF2**: 310,000 iterations, `CryptoKey` non-extractable, chỉ tồn tại trong memory
- **Nonce bắt buộc**: Tất cả `postMessage` đều yêu cầu nonce hợp lệ (mandatory, không optional)
- **Prompt injection**: `JSON.stringify()` escape cho mọi user input trước khi nhúng system prompt
- **Endpoint allowlist**: `geminiBaseUrl` chỉ chấp nhận `*.googleapis.com`, `*.vncare.vn`, `localhost`
- **PHI redaction**: Error log chỉ lưu short ID (`P-****`), TTL 24h tự xoá
- **Export consent**: CSV/JSON export yêu cầu xác nhận + ghi audit log
- **Legacy detection**: Tự phát hiện dữ liệu plaintext cũ → cảnh báo → auto-purge 24h
- **Session timeout**: Key tự xoá sau 30 phút idle
- **Logout detection**: Phát hiện HIS logout → wipe cache bệnh nhân

### ✨ Tính năng mới

- **Phiếu Hội chẩn**: Chỉnh sửa trực tiếp trên bảng preview, các trường liên quan tự đồng bộ
- **Slash Command**: Nút **Chỉnh sửa** inline cho templates (bên cạnh nút Xoá)
- **Định dạng chẩn đoán**: Tự động strip mã ICD-10, chuẩn hoá dấu phân cách thành dấu phẩy
- **Version sync**: Đồng bộ version tự động từ `manifest.json`

### 🐛 Sửa lỗi

- XN: PRO/BIL/GLU không còn bị phân loại sai vào nhóm "Sinh hóa"
- Linting cleanup toàn bộ codebase — 0 errors, 0 warnings
- Console error spam từ iframe-helper → chuyển `console.warn/error` thành `console.log`

---

## [1.1.9] — 2026-04-27

### 🔧 Stability Upgrade

- `resolveActiveGrid()` hỗ trợ cả **nội trú** và **ngoại trú**
- Composite patient key (`benhnhanId_khambenhId`) ngăn data leak giữa bệnh nhân
- Linting cleanup toàn bộ codebase — 0 errors, 0 warnings

---

## [1.1.7] — 2026-04-25

### 🩺 BHYT Glucose Scanner

- Fix API field mapping cho **glucose mao mạch** (hybrid timestamp strategy)
- HTML sanitization cho input bệnh nhân

---

## [1.0.0] — 2026-04-15

### 🎉 Initial Release

- **Scanner Module**: Quét buồng bệnh, thuốc, PTTT, BHYT
- **Voice AI**: Nhập liệu bằng giọng nói + AI trích xuất tự động
- **Dashboard**: Bảng thống kê lâm sàng 5 tab (Khám vào viện, Lâm sàng & Thuốc, XN, CĐHA, AI)
- **Auto-Sign**: Ký số tự động với SmartCA + nút dừng khẩn cấp
- **Desert Mystic Design**: Giao diện premium gold-amber theme

---

<div align="center">

*Built with ❤️ for Vietnamese clinicians*

**Tác giả: Bác sĩ Huỳnh Trung Anh** · Powered by Gemini AI

</div>
