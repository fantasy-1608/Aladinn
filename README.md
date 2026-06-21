# 🏺 Aladinn — Trợ lý Lâm sàng AI cho VNPT HIS

<div align="center">

**v2.2.1** · Chrome Extension · Manifest V3 · Dành riêng cho VNPT HIS

[![Build](https://img.shields.io/badge/build-passing-brightgreen?style=flat-square)](https://github.com/fantasy-1608/Aladinn)
[![Version](https://img.shields.io/badge/version-2.2.1-blue?style=flat-square)](https://github.com/fantasy-1608/Aladinn/releases)
[![License](https://img.shields.io/badge/license-Private-lightgrey?style=flat-square)](https://github.com/fantasy-1608/Aladinn)

> Tích hợp AI · Bảo mật y tế · Giao diện chuẩn VNPT HIS

</div>

---

## 📑 Mục lục
- [Giới thiệu](#giới-thiệu)
- [✨ Tính năng](#-tính-năng)
- [🛡️ Bảo mật & Quyền riêng tư](#️-bảo-mật--quyền-riêng-tư)
- [🚀 Cài đặt & Cấu hình](#-cài-đặt--cấu-hình)
- [🏗️ Kiến trúc & Luồng dữ liệu](#️-kiến-trúc--luồng-dữ-liệu)
- [🔧 Phát triển](#-phát-triển)
- [📦 Changelog](#-changelog)
- [📄 Giấy phép & Tác giả](#-giấy-phép--tác-giả)

---

## Giới thiệu

**Aladinn** là tiện ích Chrome được xây dựng đặc thù cho hệ thống **VNPT HIS**, hỗ trợ bác sĩ và điều dưỡng khai thác nhanh dữ liệu lâm sàng, phân tích AI chuyên sâu, và tối ưu hoá quy trình ghi chép y khoa — tất cả chạy trực tiếp trong trình duyệt mà không cần server trung gian.

---

## ✨ Tính năng

### 🏥 Bảng CLS + Thuốc (5 Tab)
Giao diện modal 5 tab hiển thị toàn bộ thông tin lâm sàng của bệnh nhân đang chọn:
- 🏥 **Khám vào viện**: Lý do nhập viện, bệnh sử, tiền sử bản thân & gia đình, khám lâm sàng, chẩn đoán ban đầu.
- 📋 **Lâm sàng & Thuốc**: Diễn tiến hàng ngày + danh sách thuốc (tên, liều, đường dùng).
- 🧪 **Xét nghiệm**: Bảng XN toàn bộ, highlight giá trị bất thường, timeline theo ngày.
- 🩻 **CĐHA**: Chẩn đoán hình ảnh, kết quả X-quang / ECG / siêu âm / CT.
- 🤖 **Phân tích AI**: Tóm tắt lâm sàng tự động bằng Gemini AI với context 360°.

### 🤖 Voice AI Assistant
Nhập liệu bằng giọng nói, AI trích xuất và điền tự động vào phiếu HIS:
- **Speech-to-text**: Tự động sửa lỗi nhận dạng y khoa (sinh hiệu, chẩn đoán, bộ phận cơ thể).
- **De-identification**: Tự động ẩn họ tên, CCCD, số điện thoại, ngày sinh trước khi gửi AI.
- **Auto-fill**: Điền kết quả AI vào `lyDoVaoVien`, `quaTrinhBenhLy`, `khamToanThan`, `khamBoPhan`, `chanDoanBanDau`, sinh hiệu…
- **ICD-10 gợi ý**: AI đề xuất mã ICD phù hợp với chẩn đoán.
- **Token cost**: Hiển thị số tokens và chi phí VNĐ ước tính sau mỗi lần gọi.

### 📝 Slash Command Templates & Phím Tắt
- Gõ `/` (hoặc `//`) trong bất kỳ textarea nào của HIS để kích hoạt menu gợi ý.
- Tìm kiếm, chọn, chỉnh sửa mẫu câu lâm sàng được định nghĩa sẵn.
- Bàn phím hỗ trợ: `Ctrl+Shift+F` (Lọc hồ sơ), `Ctrl+Shift+S` (Bắt đầu ký số), `Ctrl+Shift+N` (Bệnh nhân tiếp theo).

### 📋 Phiếu Hội Chẩn (Preview & Edit)
- Preview toàn bộ phiếu hội chẩn trong modal riêng trước khi import.
- **Chỉnh sửa trực tiếp** trên bảng preview — các trường liên quan tự đồng bộ nhau.
- Định dạng chẩn đoán tự động: loại bỏ mã ICD-10, chuẩn hoá dấu phân cách thành dấu phẩy.

### 🧠 Clinical Decision Support (CDS)
- **Tương tác thuốc (DDI)**: 426 rules nội bộ, VN alias mapping.
- **Chống chỉ định thuốc – bệnh lý**: (ví dụ: Trimetazidine + Parkinson).
- **Trùng nhóm điều trị**: (Duplicate therapy).
- **BHYT xuất toán**: Mã ICD không khớp, thuốc ngoài danh mục.
- **Bất thường xét nghiệm + thuốc**: (ví dụ: INR > 3 + Warfarin, eGFR < 30 + Metformin).

### 🩻 Tích hợp PACS
- Lấy URL ảnh DICOM qua `Ris-Access-Hash` của VNPT HIS.
- Xem trực tiếp hình ảnh PACS trong modal AI mà không cần mở tab mới.

### ✍️ Auto-Sign & SmartCA Guard
- Tự động ký duyệt phiếu thuốc / y lệnh với xác nhận bắt buộc.
- Nút dừng khẩn cấp, tự tắt khi rời khỏi phiên ký.
- **SmartCA Guard**: Polling thông minh cho auto-logout, re-login ngay trong modal e-Seal.

---

## 🛡️ Bảo mật & Quyền riêng tư

Aladinn được kiểm toán bảo mật toàn diện cho dữ liệu y tế (Clinical Safety):

| Lớp bảo mật | Triển khai |
|---|---|
| **Mã hoá API Key** | AES-256-GCM + PBKDF2 (310,000 iterations). CryptoKey chỉ lưu trên RAM background service worker. |
| **Crypto service** | Content script gửi plaintext → background mã hoá/giải mã → trả kết quả. Không giữ raw key. |
| **De-identification AI** | PHI (họ tên, CCCD, ĐT, ngày sinh, mã BN) bị ẩn trước khi gọi Gemini AI. |
| **Nonce bắt buộc** | Tất cả `postMessage` đều yêu cầu nonce hợp lệ. |
| **Prompt injection** | Văn bản escape bằng `JSON.stringify()` trước khi nhúng vào system prompt. |
| **Endpoint allowlist** | Giới hạn gọi API nội bộ, GitHub và Google AI. |
| **Audit & Log** | Error log chỉ lưu short ID (`P-****`), TTL 24h tự xoá. Export CSV/JSON yêu cầu xác nhận rõ ràng. |
| **Patient Context Guard** | Chặn thao tác nhầm bệnh nhân giữa các tab (track theo `windowId`). |
| **JSON Schema Validator** | Dữ liệu trả về từ AI được validate chặt chẽ trước khi điền tự động. |

Chi tiết xem tại tài liệu An Toàn Lâm Sàng nội bộ (`docs/CLINICAL_SAFETY.md`).

---

## 🚀 Cài đặt & Cấu hình

### Cài đặt qua File `.zip` (Khuyến nghị)
1. Tải bản mới nhất từ [GitHub Releases](https://github.com/fantasy-1608/Aladinn/releases).
2. Giải nén thư mục.
3. Mở Chrome, vào `chrome://extensions`.
4. Bật **Developer mode** → chọn **Load unpacked** → chọn thư mục vừa giải nén.

### Cấu hình lần đầu
1. Click icon Aladinn trên thanh công cụ Chrome.
2. Vào **Cài đặt** → nhập **Gemini API Key** và thiết lập **PIN 6 số** bảo vệ.
3. Mở VNPT HIS và tận hưởng các tính năng Hỗ trợ (CLS, Tóm tắt AI, Ký số...).

---

## 🏗️ Kiến trúc & Luồng dữ liệu

### Cấu trúc dự án
- `background/`: Service worker quản lý bảo mật, mã hóa AES-GCM, kết nối AI.
- `content/`: Scripts tiêm vào trang HIS (UI, form autofill, message broker).
- `injected/`: API bridges, XHR interceptor, jqGrid hooks.
- `options/` & `popup/`: Giao diện cấu hình và điều khiển nhanh.

### Luồng xác thực & Mã hóa
```text
User nhập PIN
      │
      ▼
Content Script ──► CACHE_SESSION_PIN ──► Background Service Worker
                                              │
                                         PBKDF2 derive CryptoKey
                                         (non-extractable, memory only)
                                              │
Content Script ◄── { unlocked: true } ◄───────┘

Lưu trữ an toàn
Content Script ──► ENCRYPT_DATA(plaintext) ──► Background: AES-256-GCM encrypt
               ◄── { ciphertext } ◄────────────────────────────────────────────
                        │
                chrome.storage.local (encrypted blob only)
```

---

## 🔧 Phát triển

### Lệnh chạy (Scripts)
Dự án sử dụng `pnpm` làm package manager.

```bash
pnpm install      # Cài đặt dependencies
pnpm run dev      # Khởi động Vite (watch mode)
pnpm run build    # Đóng gói sản phẩm vào thư mục dist/
pnpm run lint     # Chạy ESLint kiểm tra mã nguồn
pnpm run test     # Chạy unit tests (Vitest)
pnpm run release  # Tự động build, nén .zip và chuẩn bị Release
```

### Tech Stack
| Công nghệ | Vai trò |
|-----------|---------|
| **Manifest V3** | Nền tảng extension bảo mật cao |
| **Vite** | Build tool siêu tốc độ |
| **Vitest** | Testing framework |
| **Gemini 1.5 Flash/Pro** | AI Engine lõi |
| **Web Crypto API** | Xử lý mã hóa chuẩn y tế |

### Quy tắc thiết kế (BẮT BUỘC)
- **Tuyệt đối không commit API key** hay dữ liệu bệnh nhân thật.
- Bắt buộc chạy `pnpm run build` trước khi test thực tế hoặc tạo PR.
- **Màu sắc & UI**: Phải dùng bảng màu VNPT HIS (`#2D509A`, `#5C86BF`, `#EDEDED`, `#333333`).
- **Nghiêm cấm** sử dụng giao diện cũ *Desert Mystic*. Tham khảo `design_tokens.md` trước khi code.

---

## 📦 Changelog

Dưới đây là tóm tắt các bản cập nhật gần nhất. Chi tiết xem tại file `CHANGELOG.md`.

| Phiên bản | Điểm nhấn |
|-----------|-----------|
| **v2.2.1** | Nâng cấp toàn diện cho VNPT HIS hiện hành. Tăng tốc render. |
| **v1.5.0** | Giao diện Glassmorphism, tự động lọc nút theo ngữ cảnh, hỗ trợ ngoại trú toàn diện, sửa lỗi Auto-fill. |
| **v1.4.1** | Safety Lock, tắt AI/CDS mặc định, Audit logging. |
| **v1.3.0** | Tối ưu độ ổn định, fix updater, fix Auto-Sign multi-window, bảo vệ Token/Nonce. |
| **v1.2.1** | SmartCA Guard, mở rộng 426 rules CDS. |
| **v1.2.0** | AES-256-GCM, prompt injection prevention, export PHI consent. |

---

## 📄 Giấy phép & Tác giả

**Tác giả:** Bác sĩ Huỳnh Trung Anh  
**Giấy phép:** Private — Dành riêng cho sử dụng nội bộ hệ thống y tế. Không phân phối công khai.

<div align="center">

> Built with ❤️ for Vietnamese clinicians

Powered by Gemini AI · Giao diện đồng bộ VNPT HIS

</div>
