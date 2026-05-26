# Tiêu chí Nghiệm thu Bản vá An toàn Aladinn V2 (Hospital Safe Mode - v2.0.5)

Tài liệu này dùng để Phòng CNTT và các Y, Bác sĩ kiểm tra, đánh giá tính an toàn của tiện ích Aladinn V2 sau khi đã áp dụng bản vá bảo mật, trước khi triển khai rộng rãi toàn bệnh viện.

## 1. Mục tiêu Bản vá

- Ngăn chặn hoàn toàn mọi nguy cơ Aladinn có thể tự động ghi, xóa hoặc thay đổi dữ liệu trên hệ thống HIS ngoài ý muốn của Bác sĩ.
- Bảo vệ dữ liệu bệnh nhân (PHI) khỏi việc bị rò rỉ ra ngoài.
- Trả lại quyền kiểm soát thao tác hoàn toàn cho Bác sĩ.
- Giữ nguyên tính năng đọc, tổng hợp hồ sơ, cảnh báo tương tác thuốc (CDS) của Scanner.

## 2. Tiêu chí Kiểm tra dành cho Bác sĩ (Lâm sàng)

### 2.1. Tính năng Ký số Bệnh án (Ký tay, an toàn)
- **Hành động:** Mở tab cần ký số, sử dụng tính năng lọc danh sách bệnh nhân.
- **Kỳ vọng:**
  - [ ] Aladinn **KHÔNG** tự động bấm nút "Xác nhận" hay "Đồng ý" trên các thông báo của hệ thống.
  - [ ] Việc chọn bệnh nhân và điền thông tin vẫn hỗ trợ, nhưng thao tác ký cuối cùng phải do chính tay Bác sĩ thực hiện.
  - [ ] Khi chuyển sang tab bệnh nhân khác hoặc đóng hồ sơ, tiến trình ký tự động bị ngắt hoàn toàn.

### 2.2. Tính năng Hỗ trợ Điền Form Bệnh án
- **Hành động:** Sử dụng chức năng AI điền tự động nội dung khám bệnh, diễn biến.
- **Kỳ vọng:**
  - [ ] Bác sĩ phải ấn trực tiếp vào nút "Điền vào form", hệ thống mới thực hiện đổ dữ liệu. Không tự động đổ khi Bác sĩ chưa cho phép.
  - [ ] Dữ liệu chỉ được đổ vào các ô hợp lệ (như diễn biến, tình trạng). Các trường dữ liệu bị khóa (như mã bệnh nhân, họ tên) tuyệt đối không bị can thiệp.
  - [ ] Nếu thông tin bệnh nhân đang xem khác với thông tin bệnh nhân đang được chọn trên lưới (do mở nhiều tab, hoặc hệ thống bị lag), hệ thống **CHẶN** việc điền dữ liệu và báo lỗi để Bác sĩ kiểm tra lại.

### 2.3. Tính năng Đọc & Tổng hợp Bệnh án (Scanner)
- **Hành động:** Xem hồ sơ, tiền sử, toa thuốc, và nhận cảnh báo (CDS).
- **Kỳ vọng:**
  - [ ] Các thông tin tổng hợp, lịch sử khám, toa thuốc hiển thị bình thường.
  - [ ] Tốc độ tải của hệ thống HIS không bị chậm đi đột ngột. Nếu Scanner yêu cầu dữ liệu quá nhanh làm ảnh hưởng HIS, nó sẽ tự động tạm dừng và báo "Scanner tạm dừng để tránh tăng tải HIS".

## 3. Tiêu chí Kiểm tra dành cho Phòng CNTT (Kỹ thuật)

### 3.1. An toàn Dữ liệu Mạng (Network & API)
- **Hành động:** Sử dụng Chrome DevTools (Network tab) để theo dõi.
- **Kỳ vọng:**
  - [ ] Khi API gốc của VNPT HIS bị lỗi (Timeout, 500), Aladinn **KHÔNG** tự động gửi lại (retry) các API ghi/thay đổi trạng thái. Chỉ cho phép retry các API đọc không quan trọng (nếu có cấu hình).
  - [ ] Bộ API Bridge của Aladinn chỉ cho phép đọc dữ liệu (History, Room, Drugs, Labs...). Mọi ý định gọi API để ghi (như gọi Stored Procedure, in phiếu PTTT) từ luồng bên ngoài đều bị chặn bởi `READ_ONLY_INTENTS`.

### 3.2. An toàn Dữ liệu Cá nhân (PHI Logging)
- **Hành động:** Mở console hoặc xem file log xuất ra từ Aladinn.
- **Kỳ vọng:**
  - [ ] Trong tất cả các file log (console, audit-logger), tuyệt đối **KHÔNG** xuất hiện thông tin nhạy cảm: Họ tên thật, số điện thoại, số CCCD, mã thẻ BHYT, mã bệnh nhân thật. 
  - [ ] Thông tin nhạy cảm đã được chuyển thành chuỗi `[REDACTED]` hoặc bị mã hóa/loại bỏ.

### 3.3. Cơ chế Dự phòng (Remote Config Fail-safe)
- **Hành động:** Chặn mạng Internet ra bên ngoài (chỉ cho phép mạng LAN truy cập HIS) và tải lại trang.
- **Kỳ vọng:**
  - [ ] Aladinn nhận biết mất kết nối cấu hình từ xa và tự động chuyển về chế độ an toàn nhất (`autoSign=false`, `autoClick=false`, chỉ bật đọc `scanner=true`).
  - [ ] Scanner vẫn khởi động và hỗ trợ đọc bệnh án dù không có Internet.
