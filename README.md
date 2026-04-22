# 🧞 Aladinn — VNPT HIS Assistant

> Trợ lý thông minh cho hệ thống VNPT HIS: Giọng nói AI · Quét dữ liệu · Ký số tự động · Cảnh báo BHYT & Lâm sàng

![Version](https://img.shields.io/badge/version-1.1.6-blue?style=flat-square)
![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-green?style=flat-square&logo=googlechrome&logoColor=white)
![Build](https://img.shields.io/badge/build-Vite-646CFF?style=flat-square&logo=vite&logoColor=white)

---

## Giới thiệu

**Aladinn** là Chrome Extension (Manifest V3) dành cho bác sĩ và nhân viên y tế sử dụng **VNPT HIS (vncare.vn)**. Extension hoạt động như một lớp hỗ trợ thông minh phủ lên giao diện HIS — không can thiệp vào dữ liệu gốc của hệ thống mà chỉ tương tác và tối ưu hóa quy trình làm việc.

Với phiên bản **1.1.6** (Giao diện Desert Mystic), hệ thống đã hoàn thiện toàn bộ các tính năng cốt lõi bao gồm Cảnh báo BHYT tự động, tích hợp bộ quét thông minh chọn lọc và hệ thống Dashboard chẩn đoán hình ảnh.

---

## Tính năng chính

### 🛡️ BHYT Guard & CDS Engine (Mới!)
- **Tự động quét rủi ro BHYT:** Đối chiếu toa thuốc với mã bệnh ICD-10 dựa trên tập quy tắc `insurance_rules.json`. Cảnh báo rủi ro xuất toán khi phát hiện thuốc thiếu chỉ định (Ví dụ: thuốc khớp nhưng thiếu mã M).
- **Bộ lọc thông minh:** Hoạt động ngay trên Scanner, đánh dấu (✅ an toàn / ⚠️ nguy hiểm) lên từng dòng bệnh nhân trực tiếp trên lưới HIS.
- **Tùy chọn quét đơn/nhóm:** Tích hợp tùy chọn **"Chỉ quét BN chọn"** giúp bác sĩ có thể quét rủi ro BHYT, PTTT, hoặc các dữ liệu khác cho từng người bệnh cụ thể (hiển thị logs trực tiếp trên Console).

### 🎤 Voice AI
- Nhận diện giọng nói tiếng Việt, xử lý ngữ nghĩa y khoa bằng **Gemini Flash**. Tự động phân tích và điền vào các mẫu form theo tiêu chuẩn HIS (Sinh hiệu, Khám bệnh, Ký số...).

### 📊 Smart Scanner & Tóm tắt CLS
- Lấy thông tin bệnh nhân (Buồng/Giường, Thuốc, Cận lâm sàng, Sinh hiệu) ngầm thông qua IFrame Helper & API Bridge mà không làm gián đoạn workflow.
- Nút **Tóm tắt CLS** vẽ biểu đồ tiến triển các chỉ số (Glucose, WBC, v.v...) một cách trực quan trên một cửa sổ Dashboard.

### ✍️ Auto-Sign (Ký Số Tự Động)
- Nhấn ký số hàng loạt thông qua API Bridge, loại bỏ các thao tác chuyển tab dư thừa. Tự động tìm danh sách phiếu PTTT, in hồ sơ và kích hoạt chữ ký số (SmartCA) với chỉ một cú click.

---

## Cài đặt

Yêu cầu: Chrome 88+ · Quyền truy cập nội trú VNPT HIS

### Từ Release
1. Tải bản mới nhất từ [Releases](https://github.com/fantasy-1608/Aladinn/releases)
2. Giải nén thư mục.
3. Mở `chrome://extensions/` → bật **Developer mode**.
4. Click **Load unpacked** → chọn thư mục `dist/`.

### Từ Source Code
```bash
git clone https://github.com/fantasy-1608/Aladinn.git
cd Aladinn
npm install
npm run build
# Sau đó Load thư mục dist/ vào Chrome
```
> ⚠️ Extension chạy từ thư mục `dist/`. Sau mỗi lần sửa code phải chạy `npm run build` để đóng gói bản cập nhật mới nhất.

---

## Cấu trúc dự án
```text
aladinn/
├── background/            # Service Worker (Điều phối chính, Auto-update)
├── content/               # Content Scripts chạy trong page HIS
│   ├── scanner/           # Luồng quét ngầm (scan-flow, scanner-init)
│   ├── voice/             # Logic thu âm, gửi API Gemini
│   ├── sign/              # Hook auto-click chữ ký số
│   └── cds/               # Bộ lọc BHYT & Logic Cảnh báo lâm sàng
├── injected/              # API Bridge (Lấy dữ liệu ngầm không qua UI)
├── public/                # Tài nguyên tĩnh (cds-data, css, icons)
├── popup/                 # Giao diện điều khiển (HTML/CSS/JS)
├── options/               # Màn hình cấu hình (API Keys, Token)
└── manifest.json          # Cấu hình V3 cho Chrome
```

---

## Bảo mật & Quyền riêng tư
- **Lưu trữ cục bộ:** Các thông tin nhạy cảm của người bệnh, logs kiểm tra BHYT hay văn bản giọng nói CHỈ LƯU TẠI CỤC BỘ (IndexedDB/Chrome Local Storage) và sẽ bị xóa theo phiên. Aladinn không bao giờ thu thập/upload dữ liệu lên bất kỳ máy chủ nào.
- **Mã hóa:** Cấu hình API Key (Gemini) được mã hóa AES-GCM an toàn.
- **Phạm vi hoạt động:** Giới hạn chỉ có quyền thực thi và truy cập trên domain `*.vncare.vn`.

---

Tác giả: Huỳnh Trung Anh
