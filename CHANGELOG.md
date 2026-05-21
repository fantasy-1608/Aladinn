# 📜 Changelog — Aladinn

Tất cả thay đổi quan trọng của dự án **Aladinn — Trợ lý Lâm sàng AI cho VNPT HIS** được ghi nhận tại đây.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
và tuân theo [Semantic Versioning](https://semver.org/lang/vi/).

---

## [1.5.0] — 2026-05-21

### ✨ Tính năng mới & Cải tiến Giao diện Nổi bật

- **Giao diện Kính mờ sang trọng mới**: Nâng cấp toàn diện nút nổi thành dạng kính mờ (Glassmorphism) cực kỳ đẹp mắt, sử dụng các biểu tượng sắc nét, có phản hồi rung động lực bấm êm ái khi nhấp chuột.
- **Tự động lọc nút thông minh**: Tự ẩn/hiện nút phù hợp nhất với bảng HIS đang mở (ví dụ: chỉ hiện duy nhất nút "Điền Xử trí" trên bảng Xử trí, ẩn hoàn toàn các nút khác để tránh rối mắt).
- **Hỗ trợ toàn diện cho Ngoại trú**: Khắc phục triệt để lỗi bảng xem trước bị trống thông tin ở phân hệ khám Ngoại trú. Tiện ích hiện đã lấy đầy đủ lý do khám, tiền sử, diễn biến bệnh và sinh hiệu... từ tab "Bệnh án".
- **Điền Xử trí nhanh 1-Click**: Tự động điền thẳng thông tin lâm sàng vào phiếu Xử trí của HIS mà không cần thông qua bảng xem trước trung gian, giúp tiết kiệm tối đa thao tác cho bác sĩ.
- **Giữ bảng xem trước cho Hội chẩn & Chuyển viện**: Cho phép bác sĩ xem, chỉnh sửa trực tiếp và kiểm tra dữ liệu cẩn thận trước khi điền chính thức.
- **Sửa lỗi điền bệnh kèm theo**: Cải tiến logic điền thông tin tự động mở khóa ô nhập bệnh kèm theo và đồng bộ mã bệnh chính xác với hệ thống HIS.

---

## [1.4.1] — 2026-05-19

### 🕵️‍♂️ Audit Logging & Ruleset Versioning (Pilot Readiness)

- **Audit Telemetry (Shadow Logging)**: Bổ sung hệ thống Audit Logger ẩn (lưu qua IndexedDB), ghi nhận các lỗi dữ liệu quan trọng, cảnh báo thuốc (Critical/Warning) và lỗi Schema AI mà **không** chứa dữ liệu định danh bệnh nhân (PHI-Free).
- **CDS Shadow Mode**: Thêm cấu hình chạy ngầm hệ thống cảnh báo lâm sàng (chẩn đoán, tương tác thuốc) nhưng không hiển thị giao diện để thu thập dữ liệu an toàn mà không làm phiền bác sĩ.
- **Ruleset Versioning**: Hiển thị phiên bản bộ luật (Ruleset version) lấy từ file metadata, giúp kiểm soát tốt hơn các phiên bản luật CDS đang được áp dụng tại từng máy trạm.
- **Fail-Closed Patient Context**: Đưa các sự kiện "Patient Mismatch" (khi dữ liệu bệnh nhân bị sai lệch) vào log an toàn để giám sát từ xa.
- **Default Feature Toggle**: Đảm bảo cài đặt mặc định khi cài tiện ích lần đầu là chỉ bật module Scanner, các module khác (Voice, Sign, CDS) tắt để an toàn.

---

## [1.4.0] — 2026-05-17

### 🔐 Bảo mật AI & Lâm sàng (Antigravity Phase 3 & 4)

- **PHI Redactor**: Tự động nhận diện và xóa thông tin định danh (Tên, CCCD, BHYT, SĐT, Địa chỉ) khỏi prompt trước khi gửi cho AI (Fail-Closed bảo vệ dữ liệu).
- **JSON Schema Validator**: Bắt buộc mọi phản hồi lâm sàng từ AI phải đúng cấu trúc (Schema Validated) trước khi Auto-fill để tránh lỗi dữ liệu.
- **Auto-Flush CDS Cache**: Cache cảnh báo lâm sàng tự động được dọn sạch ngay khi người dùng đăng xuất (Logout) khỏi VNPT HIS, tránh lộ thông tin bệnh án giữa các phiên làm việc.
- **Chuẩn bị Release Gate**: Bổ sung Checklist QA và Checklist Release chặt chẽ cho toàn bộ dự án.

---

## [1.3.1] — 2026-05-15

### 🔐 Bảo mật & Toàn vẹn Dữ liệu (Integrity Hardening)

- **Scanner Context Guard**: Loại bỏ triệt để các biến global dùng chung (`patientDemographics`). Tất cả dữ liệu hành chính và lịch sử khám hiện lưu theo khóa mã hóa `patientKey`, chống nhiễm chéo dữ liệu bệnh án khi bác sĩ chuyển bệnh nhân liên tục.
- **Iframe Form Security**: Truyền `contextToken` và `expectedPatientName` từ Scanner xuống tất cả các iframe helpers. Các iframe tự động kiểm chứng với tên trên form DOM và từ chối điền dữ liệu nếu phát hiện sai lệch.
- **Fail-secure Medical History**: Bỏ cache fallback dựa trên `pid` của lịch sử khám. API thất bại sẽ báo lỗi trực tiếp thay vì bốc nhầm hồ sơ cũ.
- Chuẩn bị đầy đủ cơ sở hạ tầng an toàn cho việc cấp quyền ký số tự động mở rộng.

---

## [1.2.7] — 2026-05-11

### 🚀 Nâng cấp Kiến trúc & Hiệu năng

- **API-First Architecture**: Refactor hệ thống fetch dữ liệu với `bridgeFetch`, gom gọn các hàm API trùng lặp giúp giảm dung lượng file và dễ bảo trì.
- **Auto-prefetch Demographics**: Tự động tải ngầm thông tin bệnh nhân qua `VNPTStore` ngay khi người dùng bấm chọn bệnh nhân, không cần chờ mở chức năng.
- **Global Logs Toggle**: Bổ sung nút bật/tắt Logs (Debug Mode) trực tiếp trên Popup extension giúp giao diện console mượt mà và không bị spam log.
- **Emergency Module**: Chuyển đổi module Cấp cứu sang ưu tiên cơ chế API-first, chỉ fallback về DOM khi cần thiết.
- **Data Enrichment**: Tự động tính toán tuổi (`age`) từ ngày sinh (`dob`) ngay trong tầng API Bridge.
- **Centralized Selectors**: Chuẩn hóa toàn bộ DOM selectors (Dashboard, History) về tập trung tại `VNPTConfig.selectors` giúp code ổn định hơn với các cập nhật UI của HIS.

---

## [1.2.6] — 2026-05-09

### 🐛 Sửa lỗi

- **Bảo mật & Trải nghiệm**: Sửa lỗi "Sai mã PIN" bằng cách đồng bộ thuật toán mã hóa PBKDF2 lên 310,000 iterations. Cải thiện logic lưu mô hình AI để tránh bị ảnh hưởng bởi dữ liệu cũ trong `localStorage` trên trang HIS.
- **AI Selection**: Xóa fallback cứng (`gemini-2.0-flash-lite...`), giờ đây hệ thống sẽ luôn lấy đúng mô hình mà người dùng đã chọn từ giao diện cài đặt (như `gemini-2.0-flash`).
- **Giao diện Options**: Làm rõ cơ chế tự động ẩn API Key để bảo mật, đồng thời làm mượt hiệu ứng nhịp thở cho tên hiển thị trên hệ thống.

---

## [1.2.5] — 2026-05-09

### 🚀 Pilot-Ready Release

- **Hoàn tất lộ trình 30 ngày ổn định**: Đáp ứng 100% Definition of Done (DoD) cho việc phát hành thử nghiệm.
- **Dọn dẹp Linter & Warning**: Làm sạch hoàn toàn code base, loại bỏ mọi warning trong quá trình scan và build.
- **Hoàn thiện UI Ambient**: Cập nhật hiệu ứng nhận diện phiên làm việc Aladinn (Genie icon & Desert Mystic aura) tích hợp liền mạch vào HIS Footer.

---

## [1.2.4] — 2026-05-08

### 🛡 Safe Mode (Kill Switch từ xa)

- **Remote Config**: Tích hợp module cấu hình từ xa qua GitHub, cho phép tắt nóng các tính năng nhạy cảm (Auto-Sign, CDS, AI) trên tất cả các máy trạm mà không cần người dùng cài lại tiện ích.
- **Fail-open & Graceful Shutdown**: Kiến trúc an toàn đảm bảo không chặn tiến trình tải UI và chỉ chạy khi có cấu hình hợp lệ.
- **30-Day Stabilization - Week 1-4**:
  - Đã rà soát bảo mật, đồng bộ tài liệu và code (PBKDF2 310,000 iterations).
  - Tích hợp Unit test với coverage thông qua Vitest.
  - Bổ sung Release Gating (preflight checks) vào \`scripts/release.js\`.
  - Thiết lập Pilot Safe Mode, tắt Auto-Sign mặc định khi cấu hình Pilot.
  - Cấu trúc hệ thống tài liệu (Docs) cho Architecture, Security, Release, QA và Pilot.
- Fix markdown linting và lỗi đồng bộ \`package-lock.json\` gây crash CI/CD pipeline.

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

<p><em>Built with ❤️ for Vietnamese clinicians</em></p>

<p><strong>Tác giả: Bác sĩ Huỳnh Trung Anh</strong> · Powered by Gemini AI</p>

</div>
