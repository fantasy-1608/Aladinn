# Aladinn

<div align="center">

<img src="assets/icons/aladinn-logo.png" alt="Aladinn Logo" width="120" />

**Trợ lý Lâm sàng AI cho VNPT HIS**

`v1.4.1` · Chrome Extension · Manifest V3

[![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com/fantasy-1608/Aladinn)
[![Version](https://img.shields.io/badge/version-1.4.1-gold?style=flat-square)](https://github.com/fantasy-1608/Aladinn/releases)
[![License](https://img.shields.io/badge/license-Private-lightgrey?style=flat-square)](https://github.com/fantasy-1608/Aladinn)

</div>

---

Aladinn là tiện ích Chrome hỗ trợ bác sĩ và điều dưỡng trên hệ thống **VNPT HIS**:
quét dữ liệu lâm sàng, phân tích AI, nhập liệu giọng nói, hỗ trợ quyết định lâm sàng (CDS), xem ảnh PACS và ký số tự động — tất cả chạy trực tiếp trong trình duyệt.

## Mục lục

- [Tính năng](#tính-năng)
- [Cài đặt](#cài-đặt)
- [Cấu hình](#cấu-hình)
- [Kiến trúc](#kiến-trúc)
- [Bảo mật](#bảo-mật)
- [Phát triển](#phát-triển)
- [Changelog](#changelog)
- [Tác giả & Giấy phép](#tác-giả--giấy-phép)

---

## Tính năng

### Bảng CLS + Thuốc (5 Tab)

Modal hiển thị toàn bộ thông tin lâm sàng của bệnh nhân đang chọn:

| Tab | Nội dung |
|-----|----------|
| **Khám vào viện** | Lý do nhập viện, bệnh sử, tiền sử, khám lâm sàng, chẩn đoán ban đầu |
| **Lâm sàng & Thuốc** | Diễn tiến hàng ngày, danh sách thuốc (tên, liều, đường dùng) |
| **Xét nghiệm** | Bảng XN toàn bộ, highlight bất thường, timeline theo ngày |
| **CĐHA** | Kết quả X-quang, ECG, siêu âm, CT |
| **Phân tích AI** | Tóm tắt lâm sàng tự động bằng Gemini AI với context 360° |

### Voice AI Assistant

Nhập liệu bằng giọng nói, AI trích xuất và điền tự động vào phiếu HIS:

- **Speech-to-text** với tự động sửa lỗi nhận dạng y khoa
- **De-identification** — ẩn họ tên, CCCD, SĐT, ngày sinh trước khi gửi AI
- **Auto-fill** — điền kết quả vào lý do vào viện, quá trình bệnh lý, khám toàn thân, khám bộ phận, chẩn đoán, sinh hiệu
- **ICD-10 gợi ý** — AI đề xuất mã ICD phù hợp
- **Token cost** — hiển thị số tokens và chi phí VNĐ ước tính

### Slash Command Templates

- Gõ `//` trong bất kỳ textarea nào của HIS để kích hoạt menu gợi ý
- Tìm kiếm và chọn mẫu câu lâm sàng được định nghĩa sẵn
- Tuỳ chỉnh trong tab **Mẫu Bệnh Án** (thêm / sửa / xoá)

### Phiếu Hội Chẩn

- Preview toàn bộ phiếu hội chẩn trước khi import
- Chỉnh sửa trực tiếp trên bảng preview — các trường liên quan tự đồng bộ
- Tự động loại bỏ mã ICD-10, chuẩn hoá dấu phân cách

### Clinical Decision Support (CDS)

- **Tương tác thuốc (DDI)** — 426 quy tắc, hỗ trợ tên thuốc tiếng Việt
- **Chống chỉ định thuốc–bệnh lý** (vd: Trimetazidine + Parkinson)
- **Trùng nhóm điều trị** (Duplicate therapy)
- **Cảnh báo BHYT xuất toán** — mã ICD không khớp, thuốc ngoài danh mục
- **Bất thường XN + thuốc** (vd: INR > 3 + Warfarin, eGFR < 30 + Metformin)
- **Thiếu chẩn đoán** khi kê đơn
- **Audit logging** và **Ruleset versioning**

### Tích hợp PACS

- Lấy URL ảnh DICOM qua `Ris-Access-Hash` của VNPT HIS
- Xem trực tiếp hình ảnh trong modal AI

### Auto-Sign

- Tự động ký duyệt phiếu thuốc / y lệnh với xác nhận bắt buộc
- Nút dừng khẩn cấp, tự tắt khi rời phiên ký
- SmartCA Guard: polling thông minh, tự động xử lý đăng xuất & đăng nhập lại
- Keyboard shortcut: `Ctrl+Shift+S`

### Tiện ích khác

- **Quick Filter** (`Ctrl+Shift+F`) — lọc hồ sơ của tôi
- **Next Patient** (`Ctrl+Shift+N`) — chuyển bệnh nhân nhanh
- **Remote Config** — tắt nóng tính năng nhạy cảm từ xa qua GitHub
- **Auto-update checker** — kiểm tra phiên bản mới tự động

---

## Cài đặt

### Yêu cầu

- Chrome / Chromium ≥ 120
- Tài khoản VNPT HIS
- Google AI Studio API Key (Gemini Flash / Pro)

### Từ GitHub Release (khuyến nghị)

1. Tải file `.zip` từ [Releases](https://github.com/fantasy-1608/Aladinn/releases/latest)
2. Giải nén
3. Mở Chrome → `chrome://extensions` → bật **Developer mode**
4. **Load unpacked** → chọn thư mục vừa giải nén

### Từ source code

```bash
git clone https://github.com/fantasy-1608/Aladinn.git
cd Aladinn
pnpm install
pnpm run build
```

Load thư mục `dist/` trong `chrome://extensions`.

---

## Cấu hình

1. Click icon Aladinn trên thanh công cụ Chrome
2. Vào **Cài đặt** → nhập **Gemini API Key** và đặt **PIN 6 số** bảo vệ
3. Vào trang bệnh nhân VNPT HIS → sử dụng các nút **CLS + Thuốc**, **Tóm tắt AI**, **Hội chẩn**

> Khi cài mới, chỉ module **Scanner** được bật mặc định. Các module Voice, Sign, CDS cần bật thủ công trong Popup.

---

## Kiến trúc

```
Aladinn/
├── background/
│   ├── service-worker.js        # Message routing, session management
│   ├── ai-client.js             # Gemini API, crypto service (AES-GCM)
│   └── updater.js               # Auto-update checker
│
├── content/
│   ├── scanner/                 # Modal 5-tab, phiếu hội chẩn, export
│   ├── voice/                   # Speech-to-text, AI, auto-fill
│   ├── cds/                     # DDI, Drug-Disease, Insurance rules
│   ├── sign/                    # Auto-sign workflow
│   └── template/                # Slash command templates
│
├── injected/
│   ├── api-bridge.js            # HIS API interceptor (jsonrpc)
│   ├── ajax-interceptor.js      # XHR/Fetch snooping cho CDS
│   └── grid-hook.js             # jqGrid event hooks
│
├── popup/                       # Bật/tắt module, badge
├── options/                     # API Key, PIN, Templates, CDS config
├── shared/                      # Utilities dùng chung
├── lib/                         # Thư viện bên thứ ba
├── styles/                      # CSS (Desert Mystic theme)
├── assets/                      # Icons, fonts
└── manifest.json                # Chrome Extension Manifest V3
```

### Luồng bảo mật API Key

```
User nhập PIN
      │
      ▼
Content Script ──► CACHE_SESSION_PIN ──► Background Service Worker
                                              │
                                         PBKDF2 derive CryptoKey
                                         (non-extractable, memory only)
                                              │
Content Script ◄── { unlocked: true } ◄───────┘

Lưu dữ liệu
Content Script ──► ENCRYPT_DATA(plaintext) ──► Background: AES-256-GCM encrypt
               ◄── { ciphertext } ◄────────────────────────────────────────────
                        │
                chrome.storage.local (encrypted blob only)
```

---

## Bảo mật

| Lớp | Chi tiết |
|-----|----------|
| **Mã hoá API Key** | AES-256-GCM + PBKDF2 (310,000 iterations). CryptoKey không rời background service worker |
| **Crypto Service** | Content script gửi plaintext → background mã hoá/giải mã. Không có raw key trong content script |
| **De-identification** | Họ tên, CCCD, SĐT, ngày sinh, mã BN bị ẩn trước khi gửi Gemini |
| **Nonce bắt buộc** | Mọi postMessage yêu cầu nonce hợp lệ |
| **Prompt injection** | `JSON.stringify()` escape trước khi nhúng vào system prompt |
| **Endpoint allowlist** | Chỉ cho phép `*.googleapis.com`, `*.vncare.vn`, `*.githubusercontent.com`, `localhost` |
| **PHI trong log** | Chỉ lưu short ID (`P-****`), TTL 24h tự xoá |
| **Export PHI** | Yêu cầu xác nhận + audit log |
| **Session timeout** | Key tự xoá sau 30 phút không hoạt động |
| **Logout detection** | Phát hiện logout HIS → xoá cache bệnh nhân |
| **JSON Schema Validator** | Phản hồi AI phải đúng cấu trúc trước khi auto-fill |
| **Patient Context Guard** | Xác minh patient context trước mỗi thao tác ghi |

Chi tiết tại [`docs/security/`](docs/security/) và [`docs/CLINICAL_SAFETY.md`](docs/CLINICAL_SAFETY.md).

---

## Phát triển

### Lệnh thường dùng

```bash
pnpm run dev          # Vite watch mode
pnpm run build        # Production build → dist/
pnpm run lint         # ESLint
pnpm run test         # Vitest
pnpm run test:coverage # Coverage report
pnpm run release      # Build + zip + GitHub Release
```

### Quy tắc

- Không commit API key hay dữ liệu bệnh nhân thật
- Chạy `pnpm run build` sau mỗi thay đổi trước khi test
- Animation chỉ dùng `transform` / `opacity` (GPU-accelerated)
- Design tokens: Desert Mystic — `#d4a25a` gold · `#1a1410` dark · `#e8dcc8` text
- Tham khảo `design_tokens.md` và `animation_tokens.md` cho component mới

### Tech Stack

| Công nghệ | Mục đích |
|-----------|----------|
| Chrome Extension Manifest V3 | Nền tảng |
| Vite | Build tool |
| Vitest + jsdom | Testing |
| ESLint | Linting |
| Gemini API | AI (tóm tắt, voice, ICD-10) |
| Web Speech API | Nhận dạng giọng nói |
| Web Crypto API | AES-256-GCM, PBKDF2 |

---

## Changelog

Xem chi tiết tại [`CHANGELOG.md`](CHANGELOG.md).

### Các phiên bản gần đây

| Phiên bản | Ngày | Điểm chính |
|-----------|------|------------|
| **1.4.1** | 19/05/2026 | Audit logging, CDS shadow mode, ruleset versioning |
| **1.4.0** | 17/05/2026 | PHI Redactor, JSON Schema Validator, auto-flush CDS cache |
| **1.3.1** | 15/05/2026 | Scanner Context Guard, iframe form security |
| **1.3.0** | 12/05/2026 | Stabilization & hardening, dual-endpoint updater |
| **1.2.1** | 03/05/2026 | SmartCA Guard, CDS 426 DDI rules, slash command `//` |
| **1.2.0** | 30/04/2026 | Security hardening (AES-256-GCM, nonce, PHI redaction) |
| **1.0.0** | 15/04/2026 | Initial release |

---

## Tác giả & Giấy phép

**Tác giả:** Bác sĩ Huỳnh Trung Anh

**Giấy phép:** Private — Dành riêng cho sử dụng nội bộ bệnh viện. Không phân phối công khai.

<div align="center">

Powered by Gemini AI · Desert Mystic Design

</div>
