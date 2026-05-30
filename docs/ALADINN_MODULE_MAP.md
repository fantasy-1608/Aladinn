# 🗺️ Bản Đồ Mã Nguồn & Tra Cứu Chức Năng Lâm Sàng (Aladinn v2)

Tài liệu này cung cấp sơ đồ tra cứu nhanh toàn bộ các tập tin mã nguồn của **Aladinn v2** tương ứng với các chức năng lâm sàng thực tế mà bác sĩ sử dụng hàng ngày. Đây là công cụ đắc lực giúp đội ngũ phát triển và kiểm duyệt hiểu nhanh kiến trúc hệ thống mà không cần đọc sâu vào từng dòng code.

---

## 1. Bản Đồ Phân Phối Tệp Theo Chức Năng Lâm Sàng

```
Aladinn v2 (Clinical OS)
├── 🛡️ An Toàn & Bảo Mật (Security & Safety)
│   ├── patient-context-guard.js (Khóa kép Bệnh nhân)
│   ├── ai-client.js (Mã hóa API Key bằng AES-GCM)
│   └── phi-redactor.js (Khử định danh PHI tự động)
├── ⚡ Trợ Lý Kê Đơn Tức Thời (Real-time CDS)
│   ├── key-hook.js (Bắt phím gõ tên thuốc)
│   ├── egfr-alerts.js (Tính toán eGFR & Cảnh báo thận)
│   └── engine.js (426+ quy tắc tương tác thuốc offline)
├── 🦾 Tự Hồi Phục Giao Diện (Self-Healing Engine)
│   └── self-healing.js (Quét ngữ nghĩa DOM thông minh)
├── 🩺 Quét Cận Lâm Sàng & Auto-fill
│   ├── clinical-fill.js (Điền bệnh lịch tự động)
│   └── dashboard.js (Dashboard cận lâm sàng kính mờ)
└── 🛜 Lắng Nghe Hệ Thống HIS
    ├── api-bridge.js (Lắng nghe sự kiện chuyển trang)
    └── ajax-interceptor.js (Đồng bộ kết quả xét nghiệm)
```

---

## 2. Danh Mục Tra Cứu Chi Tiết Từng Tập Tin (Source File Directory)

### 2.1. Phân Hệ An Toàn, Bảo Mật & Xác Thực (Safety & Security Guard)

| Tên Tập Tin | Đường Dẫn Thực Tế | Vai Trò Lâm Sàng & Vận Hành |
| :--- | :--- | :--- |
| **patient-context-guard.js** | [patient-context-guard.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/scanner/patient-context-guard.js) | Chốt chặn an toàn quan trọng nhất. Ngăn không cho điền nhầm thông tin của bệnh nhân này vào hồ sơ của bệnh nhân khác khi bác sĩ đổi tab hoặc đổi bệnh nhân trên HIS. |
| **ai-client.js** | [ai-client.js](file:///Users/trunganh/CNTT/Aladinn-v2/background/ai-client.js) | Thực hiện mã hóa AES-GCM 256-bit bằng mã PIN cá nhân của bác sĩ. Giải phóng hoàn toàn API Key khỏi RAM khi bác sĩ đăng xuất hoặc sau 30 phút rời máy (Session Timeout). |
| **phi-redactor.js** | [phi-redactor.js](file:///Users/trunganh/CNTT/Aladinn-v2/background/phi-redactor.js) | Tự động quét và xóa sạch Tên, Số điện thoại, Địa chỉ của bệnh nhân trước khi gửi dữ liệu lên đám mây để AI phân tích. |

### 2.2. Phân Hệ Hỗ Trợ Ra Quyết Định Lâm Sàng Cục Bộ (Local Decision Support - CDS)

| Tên Tập Tin | Đường Dẫn Thực Tế | Vai Trò Lâm Sàng & Vận Hành |
| :--- | :--- | :--- |
| **key-hook.js** | [key-hook.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/cds/key-hook.js) | Lắng nghe trực tiếp từng phím gõ khi bác sĩ đang kê đơn thuốc trên HIS. Phát hiện từ khóa thuốc và kích hoạt kiểm tra tương tác thuốc tức thì (<5ms) mà không làm lag máy. |
| **egfr-alerts.js** | [egfr-alerts.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/cds/egfr-alerts.js) | Bộ máy tính toán mức lọc cầu thận eGFR theo công thức CKD-EPI 2021 (race-free) dành riêng cho người Việt Nam. Đưa ra cảnh báo đỏ ngay nếu liều lượng thuốc kê vượt quá giới hạn an toàn chức năng thận. |
| **engine.js** | [engine.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/cds/engine.js) | Chứa hơn 426 quy tắc tương tác thuốc nghiêm trọng và khoảng liều an toàn. Chạy ngoại tuyến hoàn toàn, đảm bảo hệ thống cảnh báo luôn hoạt động kể cả khi mất internet bệnh viện. |

### 2.3. Phân Hệ Tự Động Phục Hồi DOM & Thích Ứng Giao Diện

| Tên Tập Tin | Đường Dẫn Thực Tế | Vai Trò Lâm Sàng & Vận Hành |
| :--- | :--- | :--- |
| **self-healing.js** | [self-healing.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/shared/self-healing.js) | Tìm kiếm ô nhập liệu thông qua phân tích ngữ nghĩa các nhãn chữ tiếng Việt xung quanh (Semantic Matching). Đảm bảo các chức năng tự điền của Aladinn không bị hỏng khi VNPT HIS thay đổi mã nguồn HTML định kỳ. |

### 2.4. Phân Hệ Quét Cận Lâm Sàng & Auto-fill Giao Diện (Clinical Scan & Adapt UI)

| Tên Tập Tin | Đường Dẫn Thực Tế | Vai Trò Lâm Sàng & Vận Hành |
| :--- | :--- | :--- |
| **clinical-fill.js** | [clinical-fill.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/scanner/clinical-fill.js) | Điều phối luồng dữ liệu tự điền: bệnh sử, khám lâm sàng, tóm tắt bệnh án từ kết quả phân tích cận lâm sàng của AI vào đúng các ô nhập tương ứng trên giao diện HIS. |
| **dashboard.js** | [dashboard.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/scanner/dashboard.js) | Hiển thị bảng điều khiển cận lâm sàng kính mờ sang trọng, vuông vức 100%, dóng hàng kẻ ô chuẩn HIS giúp bác sĩ so sánh chỉ số cũ và mới trực quan nhất. |
| **nutrition.js** | [nutrition.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/scanner/nutrition.js) | Tích hợp các bộ tính toán dinh dưỡng lâm sàng nâng cấp dành riêng cho bác sĩ nội khoa và hồi sức tích cực. |
