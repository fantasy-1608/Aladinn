# 🧞 Aladinn — VNPT HIS Assistant

> Trợ lý thông minh cho hệ thống VNPT HIS: Giọng nói AI · Quét dữ liệu · Ký số tự động · Hỗ trợ lâm sàng

![Version](https://img.shields.io/badge/version-1.0.0-blue?style=flat-square)
![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-green?style=flat-square&logo=googlechrome&logoColor=white)
![Build](https://img.shields.io/badge/build-Vite-646CFF?style=flat-square&logo=vite&logoColor=white)

---

## Giới thiệu

**Aladinn** là Chrome Extension (Manifest V3) dành cho bác sĩ và nhân viên y tế sử dụng **VNPT HIS (vncare.vn)**. Extension hoạt động như một lớp hỗ trợ thông minh phủ lên giao diện HIS — không can thiệp vào dữ liệu gốc của hệ thống.

---

## Tính năng chính

### 🎤 Voice AI
Nhận diện giọng nói tiếng Việt, xử lý ngữ nghĩa y khoa bằng **Gemini Flash**, tự động điền vào form HIS.

### 📊 Smart Scanner
Quét đồng loạt dữ liệu bệnh nhân (sinh hiệu, tiền sử, dinh dưỡng) qua hidden IFrame — không làm gián đoạn workflow.

### ✍️ Auto-Sign
Ký số hàng loạt thông qua API Bridge. Tự động phát hiện form cần ký, lọc hồ sơ thông minh.

### 🧠 CDS Engine *(đang phát triển)*
Cảnh báo tương tác thuốc, phát hiện thiếu mã ICD. Rule Engine local với latency < 300ms.

---

## Cài đặt

**Yêu cầu:** Chrome 88+ · Quyền truy cập vncare.vn

### Từ Release

1. Tải `Aladinn-v1.0.0.zip` từ [Releases](https://github.com/fantasy-1608/Aladinn/releases)
2. Giải nén
3. Mở `chrome://extensions/` → bật **Developer mode**
4. Click **Load unpacked** → chọn thư mục `dist/`

### Từ Source

```bash
git clone https://github.com/fantasy-1608/Aladinn.git
cd Aladinn
npm install
npm run build
# Load thư mục dist/ vào Chrome
```

> ⚠️ Extension chạy từ thư mục `dist/`. Sau mỗi lần sửa code phải chạy `npm run build`.

---

## Phím tắt

| Phím tắt | Chức năng |
|----------|-----------|
| `Ctrl+Shift+F` / `⌘⇧F` | Lọc hồ sơ của tôi |
| `Ctrl+Shift+S` / `⌘⇧S` | Bắt đầu ký số |
| `Ctrl+Shift+N` / `⌘⇧N` | Bệnh nhân tiếp theo |

---

## Kiến trúc

```
aladinn/
├── background/            # Service Worker
│   ├── service-worker.js  # Điều phối chính
│   ├── ai-client.js       # Gemini AI API
│   └── updater.js         # Auto-update từ GitHub
├── content/               # Content Scripts
│   ├── scanner/           # Module quét dữ liệu
│   ├── voice/             # Module giọng nói AI
│   ├── sign/              # Module ký số
│   └── cds/               # Module hỗ trợ lâm sàng
├── injected/              # API Bridge (page context)
├── popup/                 # Popup UI
├── options/               # Trang cài đặt
├── styles/                # CSS (tách riêng khỏi HIS)
└── manifest.json          # Manifest V3
```

---

## Bảo mật

- Không lưu dữ liệu bệnh nhân (PID) trên local
- Mã hóa AES-GCM cho API Key
- Host permissions giới hạn chỉ `vncare.vn`
- Tuân thủ Content Security Policy (Manifest V3)

---

## Roadmap

| Version | Nội dung | Trạng thái |
|---------|---------|------------|
| v1.0 | Scanner, Voice AI, Auto-Sign | ✅ Done |
| v1.1 | Clinical Dashboard, CDS Rule Engine | ⏳ In progress |
| v1.2 | Cảnh báo tương tác thuốc, sai liều | 📋 Planned |
| v2.0 | AI-Assisted Documentation | 📋 Planned |

---

## Tech Stack

| | |
|---|---|
| **Runtime** | Vanilla JS (no framework) |
| **Build** | Vite |
| **AI** | Google Gemini Flash |
| **Storage** | IndexedDB, Chrome Storage |
| **Security** | AES-GCM encryption |

---

**Tác giả:** Huỳnh Trung Anh
