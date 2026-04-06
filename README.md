<![CDATA[<div align="center">

# 🧞 Aladinn — VNPT HIS Assistant

**Trợ lý thông minh cho hệ thống VNPT HIS**

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=for-the-badge)
![Chrome](https://img.shields.io/badge/Chrome-Manifest%20V3-green?style=for-the-badge&logo=googlechrome&logoColor=white)
![License](https://img.shields.io/badge/license-Private-red?style=for-the-badge)
![Build](https://img.shields.io/badge/build-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white)

<br/>

*Giọng nói AI · Quét dữ liệu thông minh · Ký số tự động · Hỗ trợ quyết định lâm sàng*

<br/>

</div>

---

## 📋 Mục lục

- [Giới thiệu](#-giới-thiệu)
- [Tính năng](#-tính-năng)
- [Kiến trúc hệ thống](#-kiến-trúc-hệ-thống)
- [Cài đặt](#-cài-đặt)
- [Hướng dẫn sử dụng](#-hướng-dẫn-sử-dụng)
- [Phím tắt](#-phím-tắt)
- [Phát triển](#-phát-triển)
- [Cập nhật](#-cập-nhật)
- [Bảo mật](#-bảo-mật)
- [Tác giả](#-tác-giả)

---

## 🧞 Giới thiệu

**Aladinn** là extension Chrome (Manifest V3) được thiết kế dành riêng cho bác sĩ và nhân viên y tế sử dụng hệ thống **VNPT HIS (vncare.vn)**. Extension hoạt động như một lớp hỗ trợ thông minh phủ lên trên giao diện HIS, giúp tối ưu hóa quy trình nhập liệu, quét dữ liệu và ký số — **không can thiệp vào dữ liệu gốc của hệ thống**.

### Vấn đề giải quyết

| Vấn đề | Giải pháp của Aladinn |
|--------|----------------------|
| Nhập liệu bệnh án thủ công, mất thời gian | 🎤 Nhận diện giọng nói AI, tự động điền vào form |
| Quét dữ liệu bệnh nhân rời rạc, phải click từng hồ sơ | 📊 Smart Scanner quét đồng loạt từ lưới dữ liệu |
| Ký số hàng loạt lặp đi lặp lại | ✍️ Auto-Sign ký số tự động hàng loạt |
| Thiếu cảnh báo tương tác thuốc | 🧠 CDS Engine cảnh báo lâm sàng real-time |

---

## ✨ Tính năng

### 🎤 Voice AI — Nhập liệu bằng giọng nói
- Nhận diện giọng nói tiếng Việt (Speech-to-Text)
- Tích hợp **Google Gemini Flash** xử lý ngữ nghĩa y khoa
- Tự động điền (auto-fill) vào các text area trên HIS
- Hỗ trợ chuyên biệt cho thuật ngữ y khoa

### 📊 Smart Scanner — Quét dữ liệu thông minh
- Quét đồng loạt dữ liệu từ lưới bệnh nhân
- Thu thập: Sinh hiệu, Tiền sử, Dinh dưỡng, Phòng/Giường
- Sync dữ liệu thông qua hidden IFrame (không làm gián đoạn workflow)
- Dashboard trực quan hiển thị tổng quan dữ liệu
- Xuất dữ liệu (export)

### ✍️ Auto-Sign — Ký số tự động
- Ký số hàng loạt thông qua API Bridge
- Lọc hồ sơ cần ký thông minh
- Phát hiện tự động các form cần ký
- Bypass click tự động qua content script

### 🧠 CDS Engine — Hỗ trợ quyết định lâm sàng *(đang phát triển)*
- Cảnh báo tương tác thuốc (Drug-Drug Interaction)
- Phát hiện thiếu mã ICD khi kê thuốc đặc trị
- Rule Engine local (< 300ms latency)
- Real-time DOM Observer theo dõi thay đổi trên form kê đơn

---

## 🏗 Kiến trúc hệ thống

```
aladinn/
├── background/              # Service Worker (Manifest V3)
│   ├── service-worker.js    # Điều phối chính, xử lý message
│   ├── ai-client.js         # Kết nối Gemini AI API
│   └── updater.js           # Tự kiểm tra & cập nhật từ GitHub
├── content/                 # Content Scripts (inject vào HIS)
│   ├── main.js              # Entry point, khởi tạo các module
│   ├── content.js           # Core logic, menu, UI chính
│   ├── scanner/             # 📊 Module Smart Scanner
│   │   ├── scanner-init.js  # Khởi tạo scanner
│   │   ├── scan-flow.js     # Flow quét dữ liệu
│   │   ├── dashboard.js     # Dashboard hiển thị kết quả
│   │   ├── history.js       # Trích xuất tiền sử bệnh
│   │   ├── nutrition.js     # Trích xuất dinh dưỡng
│   │   └── ...              # Config, UI, Storage, Export
│   ├── voice/               # 🎤 Module Voice AI
│   │   ├── voice-init.js    # Khởi tạo voice
│   │   ├── speech.js        # Speech-to-Text engine
│   │   ├── ai.js            # Xử lý AI (Gemini)
│   │   ├── autofill.js      # Auto-fill vào HIS
│   │   └── ...              # UI, State, Storage
│   ├── sign/                # ✍️ Module Auto-Sign
│   │   ├── sign-init.js     # Khởi tạo ký số
│   │   ├── signing.js       # Logic ký số chính
│   │   ├── filter.js        # Lọc hồ sơ cần ký
│   │   └── ...              # UI, Utils, Detection
│   └── cds/                 # 🧠 Module CDS (Clinical Decision Support)
│       ├── engine.js        # Rule Engine
│       ├── extractor.js     # Trích xuất dữ liệu từ DOM
│       ├── db.js            # IndexedDB cho rules
│       └── ui.js            # Giao diện cảnh báo
├── injected/                # Scripts inject trực tiếp vào page context
│   └── api-bridge.js        # Bridge bypass để gọi API nội bộ HIS
├── popup/                   # Popup UI (click icon extension)
├── options/                 # Trang cài đặt
├── shared/                  # Code dùng chung
├── styles/                  # CSS riêng (không đụng CSS HIS)
├── assets/icons/            # Icon extension
├── lib/                     # Thư viện bên thứ 3 (jQuery)
├── manifest.json            # Chrome Extension Manifest V3
├── vite.config.mjs          # Vite build config
└── package.json
```

### Data Flow

```
┌─────────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────┐
│  VNPT HIS   │───▶│  Extractor   │───▶│ Rule Engine  │───▶│  UI      │
│  (DOM)      │    │  (Content)   │    │  (Local)     │    │ (Panel)  │
└─────────────┘    └──────────────┘    └─────────────┘    └──────────┘
                          │                    │
                          ▼                    ▼
                   ┌──────────────┐    ┌─────────────┐
                   │  Background  │    │  Gemini AI   │
                   │  (SW)        │    │  (Optional)  │
                   └──────────────┘    └─────────────┘
```

---

## 📦 Cài đặt

### Yêu cầu
- Google Chrome phiên bản **88+** (hỗ trợ Manifest V3)
- Quyền truy cập vào hệ thống VNPT HIS (vncare.vn)

### Cách 1: Cài từ file release (Khuyến nghị)

1. Tải file `Aladinn-v1.0.0.zip` từ [Releases](https://github.com/fantasy-1608/Aladinn/releases)
2. Giải nén ra thư mục
3. Mở Chrome → `chrome://extensions/`
4. Bật **Developer mode** (góc trên bên phải)
5. Click **"Load unpacked"** → chọn thư mục `dist/` vừa giải nén

### Cách 2: Build từ source code

```bash
# Clone repository
git clone https://github.com/fantasy-1608/Aladinn.git
cd Aladinn

# Cài đặt dependencies
npm install

# Build extension
npm run build

# Load thư mục dist/ vào Chrome
```

> ⚠️ **Quan trọng:** Extension chạy từ thư mục `dist/`. Sau mỗi lần sửa code, phải chạy `npm run build` trước khi test.

---

## 📖 Hướng dẫn sử dụng

### Bước 1: Kích hoạt Extension
- Mở trang VNPT HIS (vncare.vn)
- Click icon 🧞 Aladinn trên thanh toolbar Chrome
- Bật/tắt các module theo nhu cầu từ popup menu

### Bước 2: Sử dụng các module

#### 🎤 Voice AI
1. Bật module Voice từ popup
2. Click vào ô text area cần nhập trên HIS
3. Nhấn nút micro và bắt đầu nói
4. AI sẽ tự động xử lý giọng nói → text → điền vào form

#### 📊 Smart Scanner
1. Bật module Scanner từ popup
2. Mở danh sách bệnh nhân trên HIS
3. Click nút "Quét" để bắt đầu quét dữ liệu đồng loạt
4. Xem kết quả trong Dashboard

#### ✍️ Auto-Sign
1. Bật module Sign từ popup
2. Mở danh sách hồ sơ cần ký
3. Extension sẽ tự động phát hiện và ký số hàng loạt

---

## ⌨️ Phím tắt

| Phím tắt | Chức năng |
|----------|-----------|
| `Ctrl+Shift+F` (Win) / `⌘+Shift+F` (Mac) | Lọc hồ sơ của tôi |
| `Ctrl+Shift+S` (Win) / `⌘+Shift+S` (Mac) | Bắt đầu ký số |
| `Ctrl+Shift+N` (Win) / `⌘+Shift+N` (Mac) | Bệnh nhân tiếp theo |

---

## 🔧 Phát triển

### Cài đặt môi trường

```bash
# Clone repo
git clone https://github.com/fantasy-1608/Aladinn.git
cd Aladinn

# Cài dependencies
npm install
```

### Build & Test

```bash
# Build production
npm run build

# Dev mode (watch changes)
npm run dev
```

### Công nghệ sử dụng

| Công nghệ | Mục đích |
|-----------|----------|
| **Vanilla JS** | Core logic (nhẹ, nhanh, không framework nặng) |
| **Vite** | Build tool, bundling |
| **Chrome Manifest V3** | Extension platform |
| **Google Gemini Flash** | AI xử lý ngữ nghĩa y khoa |
| **IndexedDB** | Lưu trữ rules CDS local |
| **jQuery** | DOM manipulation trên HIS (legacy support) |
| **AES-GCM** | Mã hóa bảo mật API Key |

---

## 🔄 Cập nhật

Aladinn hỗ trợ **tự kiểm tra cập nhật từ GitHub** mà không cần Chrome Web Store:

- Extension tự động check phiên bản mới từ repository
- Khi có bản mới, hiển thị thông báo để người dùng cập nhật
- File cập nhật được tải về và giải nén tự động

---

## 🔒 Bảo mật

- ✅ **Không lưu trữ dữ liệu bệnh nhân** (PID) trên local storage
- ✅ **Mã hóa AES-GCM** cho API Key (Gemini)
- ✅ **Trích xuất token JWT/Session** an toàn
- ✅ **Không gửi dữ liệu ra ngoài** (trừ raw text gửi Gemini có kiểm soát)
- ✅ **Content Security Policy** tuân thủ Manifest V3
- ✅ **Host permissions** giới hạn chỉ cho `vncare.vn`

> Xem chi tiết tại [BAO_CAO_BAO_MAT.md](./BAO_CAO_BAO_MAT.md)

---

## 🗺️ Roadmap

| Phase | Nội dung | Trạng thái |
|-------|---------|-----------|
| **v1.0** | Core Extension, Scanner, Voice AI, Auto-Sign | ✅ Hoàn thành |
| **v1.1** | Clinical Dashboard (Side Panel), CDS Rule Engine | ⏳ Đang phát triển |
| **v1.2** | Cảnh báo tương tác thuốc (DDI), Sai liều theo chức năng thận | 📋 Kế hoạch |
| **v1.3** | Hard-stop/Soft-stop Safety Alert, Order Sets | 📋 Kế hoạch |
| **v2.0** | AI-Assisted Documentation (SOAP Note generation) | 📋 Kế hoạch |

> Xem chi tiết tại [ALADINN_ROADMAP.md](./ALADINN_ROADMAP.md)

---

## 👨‍💻 Tác giả

**Huỳnh Trung Anh**

---

<div align="center">

*Được phát triển với ❤️ dành cho cộng đồng y tế Việt Nam*

</div>
]]>
