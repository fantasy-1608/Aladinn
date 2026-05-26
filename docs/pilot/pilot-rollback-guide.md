# Hướng dẫn Khôi phục (Rollback Guide) Aladinn V2 - Dành cho Phòng CNTT

Tài liệu này hướng dẫn cách vô hiệu hóa tạm thời hoặc gỡ bỏ hoàn toàn bản cập nhật Aladinn V2 nếu phát hiện sự cố ảnh hưởng đến phần mềm VNPT HIS.

## 1. Phương án Vô hiệu hóa khẩn cấp bằng Cấu hình từ xa (Remote Switch)
Nếu Bệnh viện đang sử dụng hệ thống quản lý tập trung qua file JSON cấu hình:
1. Mở file quản lý cấu hình từ xa (`remote-config.json`).
2. Thay đổi toàn bộ các tham số thành `false`:
   ```json
   {
     "scanner": false,
     "autoSign": false,
     "autoClick": false,
     "aiVoice": false,
     "cdsEngine": false
   }
   ```
3. Thông báo Bác sĩ **F5 (Tải lại trang)** HIS. Aladinn sẽ tự động nhận cấu hình mới và "ngủ đông" hoàn toàn, không can thiệp bất kỳ script nào vào trang web.

## 2. Phương án Khóa qua Google Admin (Đối với mạng diện rộng)
Trường hợp bệnh viện quản lý Chrome bằng Google Workspace / Chrome Enterprise:
1. Đăng nhập vào Admin Console.
2. Điều hướng đến **Devices > Chrome > Apps & extensions > Users & browsers**.
3. Chọn ứng dụng Aladinn từ danh sách cài đặt bắt buộc (Force-installed).
4. Chuyển trạng thái sang **Block (Chặn)** hoặc xóa khỏi danh sách.
5. Cập nhật chính sách (Force policy update) trên máy trạm của Bác sĩ.

## 3. Phương án Gỡ cài đặt thủ công tại máy trạm
Nếu gặp sự cố trực tiếp trên 1 máy tính cụ thể:
1. Mở Chrome, gõ vào thanh địa chỉ: `chrome://extensions/`.
2. Tìm đến tiện ích **Aladinn V2**.
3. Gạt nút màu xanh sang trái để **TẮT (Disable)** tiện ích.
4. (Hoặc) Nhấn nút **Xóa (Remove)** để gỡ bỏ hoàn toàn.
5. Khởi động lại trình duyệt Chrome và đăng nhập lại vào VNPT HIS.

## 4. Báo cáo sự cố về Đội phát triển
Nếu phải sử dụng phương án Rollback, vui lòng thu thập:
1. **Lỗi hiển thị trên màn hình:** Chụp ảnh màn hình bị kẹt hoặc báo lỗi đỏ trên HIS.
2. **Log Console:** Bấm `F12`, chuyển sang tab `Console`, click chuột phải chọn "Save as..." để lưu lại thông báo lỗi. Log này hoàn toàn an toàn và đã được loại bỏ thông tin bệnh nhân.
3. Gửi thông tin về cho đội ngũ hỗ trợ kỹ thuật Aladinn để phân tích và khắc phục trong bản vá kế tiếp.
