# BÁO CÁO KIỂM TOÁN BẢO MẬT BỔ SUNG: DỰ ÁN ALADINN - VNPT HIS ASSISTANT

**Ngày lập báo cáo:** 28/03/2026  
**Đơn vị/Dự án:** `Aladinn - VNPT HIS Assistant v1.0.0`
**Mục tiêu:** Phân tích, nhận diện rủi ro kiến trúc mở rộng và đề xuất giải pháp bảo mật liên quan đến Dữ liệu Y tế (PHI - Protected Health Information) cũng như luồng xử lý tự động của công cụ AI.

---

## 1. TỔNG QUAN KIẾN TRÚC & PHẠM VI XỬ LÝ DỮ LIỆU
Tiện ích (Extension) Aladinn hoạt động nhúng trực tiếp vào hệ thống VNPT HIS (`*.vncare.vn/*!`). Kiến trúc này cho phép Aladinn truy cập toàn quyền (Read/Write) vào:
- **Dữ liệu DOM:** Đọc trực tiếp màn hình giao diện UI chứa các chỉ số lâm sàng.
- **Biến toàn cục (Global Context):** Xâm nhập thành công vào Store nội bộ (`window.VNPTStore`), Jabsort/JSON-RPC (`jsonrpc.AjaxJson`) và đối tượng lưới jQuery Grid (`grdBenhNhan`).
- **Giao tiếp API ngoại lai:** Liên tục truyền dẫn dữ liệu từ môi trường bệnh viện ra máy chủ hạ tầng ngoài (Google Gemini API - `generativelanguage.googleapis.com`).

---

## 2. PHÂN TÍCH NHẬN DIỆN MỐI ĐE DỌA (THREAT MODELING)

### 2.1 Rủi ro: Lộ Lọt Dữ Liệu Y Tế (PHI) Sang Bên Thứ Ba (AI API)
> [!CAUTION]
> **Rủi ro Mức Mật Nhất:** Vi phạm quy tắc bảo mật dữ liệu nhạy cảm. Liên đới trực tiếp tới **Nghị định 13/2023/NĐ-CP** về Bảo vệ dữ liệu cá nhân tại Việt Nam và tiêu chuẩn lâm sàng toàn cầu (như HIPAA/GDPR).

- **Mô tả:** Module AI Voice (`ai-client.js` và `ai.js`) đảm nhận vai trò chuyển đổi giọng nói thành văn bản, trích xuất cấu trúc dữ liệu y tế. Module này gửi các luồng Prompt lên dịch vụ Cloud của Google. Nếu nội dung truyền tải gửi thẳng tên bệnh nhân, chẩn đoán chi tiết và mã hồ sơ bệnh án (Mã BA), một lượng lớn thông tin theo định dạng "Nhận diện cá nhân" (PII) sẽ phơi bày trên Public Cloud.
- **Hệ quả:** Dữ liệu có thể vô tình được log lại hoặc huấn luyện mô hình của bên thứ ba, vi phạm điều khoản quy tắc số hóa hệ thống y tế nhà nước.
- **Đề xuất khắc phục:** 
  - **Khử định danh tuyệt đối (Data Sanitization & De-identification):** Đảm bảo thuật toán trước khi gọi qua cổng `generateContent` của Gemini phải ẩn danh toàn bộ các thẻ ID, Tên, và giới tính. AI chỉ cần được cấp các triệu chứng thô: *"Khám thấy đau bụng, huyết áp 140/90, sinh hiệu..."*.
  - Chuyển ngữ cảnh yêu cầu của Prompt System thành các lệnh vô hình trung, tập trung chỉ Parsing JSON mà không cần định diện đối tượng (Bệnh nhân A, Bạc sĩ B).

### 2.2 Kiến trúc Cầu nối API (API Bridge) via `postMessage`
> [!WARNING]
> **Rủi ro Cao: Payload Tampering (Sửa đổi dữ liệu) và XSS (Tấn công tập lệnh liên trang)**

- **Mô tả:** Chức năng chọc ngầm (`jsonrpc.AjaxJson.ajaxCALL_SP_0`) được gói bọc trong `injected/api-bridge.js`. Hệ thống nhận lệnh từ Extension (`Content Script`) qua cửa sổ `window.postMessage`. Code có bảo vệ vòng ngoài bằng `event.origin !== window.location.origin`.
- **Hệ quả rủi ro:** Lớp bảo vệ chống Domain lạ này khá hoàn hảo đối với người dùng ngoài (Cross-Origin). Nhưng nếu trên bảng tin hệ thống VNPT HIS tồn tại một lỗ hổng **Stored XSS** (Ví dụ ai đó cố tình điền chẩn đoán là một thẻ `<script>`), đoạn script nội bộ này mượn thẻ Same-Origin hoàn toàn có thể bắn tin nhắn `postMessage({type: "REQ_CALL_SP", spName: "NT.006"})`. Khi đó, script có thể lợi dụng Bridge bòn rút hàng loạt dữ liệu lịch sử khám bệnh và gửi nó ra khỏi HIS.
- **Đề xuất khắc phục:** 
  - Gỡ bỏ hoàn toàn Action tự do nhận lệnh `REQ_CALL_SP`.
  - Thay vào đó hardcode giới hạn trong Bridge chỉ cung cấp đúng 3 nghiệp vụ: `FETCH_VITALS`, `FETCH_HISTORY`, `FETCH_ROOM`.
  - Validate (Regex) mạnh tay định dạng của `rowId` và các mã `hsbaId` trước khi truyền vào hàm `AjaxJson` SQL Query.

### 2.3 Bảo Thuật Khóa API Module (Key Crypto Decryption)
> [!TIP]
> **Tích cực:** Quá trình lưu trữ API Key Gemini trên thiết bị bằng AES-GCM và PBKDF2 là một thiết kế an ninh tuyệt hảo và đáng khen ngợi.

- **Mô tả:** Mã API Key của bác sĩ (để gọi Google) không chịu lộ thông tin văn bản gốc. Phương pháp dùng `crypto.subtle` được bọc bên trong Service Worker Background là chuẩn mực của Browser Security (hơn hẳn việc đặt plaintext).
- **Rủi ro tồn đọng:** Mã PIN dùng để giải nén (decrypt context) dựa trên giá trị lưu Session. Do dùng trong nội bộ bệnh viện, nguy cơ thiết bị (End-point) bị nhòm ngó màn hình là có. 
- **Đề xuất khắc phục:** Bổ sung tính năng tự động Lock mã PIN (Xóa `sessionPIN`) sau thời gian rảnh rỗi quá 30 phút. Tránh trường hợp bác sĩ rời đi và người khác tiếp cận máy sẽ lạm dụng được gói Voice AI.

### 2.4 Quét rác / Leak Storage Lịch Sử Bệnh Án
> [!IMPORTANT]
> **Rủi ro Dữ liệu Tạm (DOM & Local Caching Exfiltration)**

- **Mô tả:** 
  - Tool Aladinn đang bắt lấy các dữ liệu cực nhạy cảm như Tên Bệnh Nhân, Cơn Đau, Chẩn Đoán để fill vào các Iframe (`NUTRITION_FILL_FORM` hoặc History).
  - Vitals được cache một lớp tại biến `cachedVitals` hoặc trên cờ dữ liệu (Zustand/DOM/Store). 
- **Rủi ro:** Nếu phiên làm việc của Bác sĩ A kết thúc (Log out khỏi VNPT HIS), Bác sĩ B đăng nhập trên cùng một máy ngay sau đó nhưng Tool chưa kịp xóa bộ nhớ đệm. Bác sĩ B bấm điền phiếu nhưng tool lại nhả ra tên bệnh nhân và triệu chứng của phiên khám cũ (thuộc tài khoản A). Điều này gây sai lệch hồ sơ pháp lý bệnh án, một hậu quả lâm sàng nghiêm trọng.
- **Đề xuất khắc phục:** 
  - Khởi tạo System Monitor (Observer) lắng nghe URL. Nếu trang redirect sang đường dẫn Đăng Nhập (`login.jsp`), Extension Background phải ngay lập tức tung lệnh phá hủy toàn bộ biến Cache và Storage (`chrome.storage.local.clear()`).

---

## TỔNG KẾT
Aladinn - VNPT HIS Assistant sở hữu kiến trúc vượt rào bảo mật (API Interception) cực kỳ thông minh và mạnh mẽ. Tuy nhiên, quyền năng càng lớn thì độ nhạy cảm dữ liệu càng cao. Xin khuyến nghị bác sĩ chủ dự án ưu tiên làm trước 2 tác vụ:
1. **Rào cứng lại Bridge**: Xóa quyền `CALL_SP` tự do trên cầu chuyển tải, bịt hẳn mọi đường tấn công XSS từ bên trong VNPT.
2. **AI Anonymization**: Rà soát một lần nữa các gói Json gửi tới Google Gemini, đảm bảo "Gửi bệnh - Không gửi người".

*Trân trọng thực hiện bởi AI.*
