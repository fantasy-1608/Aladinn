# Bảng Kiểm Thử Cục Bộ (Smoke Test) — Aladinn Extension

> Yêu cầu thực hiện checklist này thủ công trước mỗi lần xuất bản phiên bản mới để đảm bảo tính sẵn sàng của sản phẩm.

## 1. Cài đặt & Khởi chạy
- [ ] Cài đặt extension bản build mới nhất qua tính năng "Load unpacked" ở thư mục `dist/`.
- [ ] Extension cài đặt thành công, không văng lỗi ở Service Worker.
- [ ] Mở trang VNPT HIS hợp lệ (login.jsp hoặc trang chính), extension kích hoạt (icon sáng).
- [ ] Popup options load thành công, không gặp lỗi giao diện.

## 2. Quản lý Trạng thái & Bảo mật
- [ ] Trang Options tải dữ liệu mượt mà, setting cũ được giữ nguyên.
- [ ] Nhập mã PIN mở khóa AI thành công. API Key lưu ở dạng mã hóa.
- [ ] Logout hệ thống HIS (vncare.vn/logout) -> Extension tự động xóa toàn bộ cache lưu trữ bệnh nhân tạm thời.
- [ ] Mở tab mới, vào một trang không phải HIS -> Biểu tượng extension bị mờ đi (inactive), không chạy logic thừa.

## 3. Tính năng Cốt lõi
- [ ] Nút "Scanner" mở được UI thu thập dữ liệu trong giao diện khám bệnh.
- [ ] Thử thực hiện lệnh gửi AI (ví dụ tóm tắt bệnh sử hoặc AI prompt) -> AI request trả kết quả đúng, hiển thị ra giao diện.
- [ ] Nút "Đồng bộ CDS" ở trang Options hoạt động, đồng bộ dữ liệu tĩnh và trả về `✅` hoặc `❌` đúng sự thật.
- [ ] Tự động ký (Auto-sign) không tự động kích hoạt ngoài các trang chứng từ PDF được chỉ định.

## 4. Tương tác đa cửa sổ (Multi-tab)
- [ ] Di chuyển qua lại giữa các cửa sổ Chrome (Multi-window) -> Extension vẫn map đúng Window ID và không bị mất context.
- [ ] Tính năng Auto-sign khi hoàn tất sẽ switch về đúng cửa sổ gọi lệnh, không nhầm sang Window khác.

## 5. UI/UX & Ngoại lệ
- [ ] Slash command (`/`) trên input fields không xung đột với các fields hệ thống như ngày giờ, số lượng.
- [ ] Fallback AI model hoạt động khi gửi request rỗng model.
- [ ] Nút Export Dữ liệu yêu cầu Consent xác nhận bảo mật.
- [ ] Notification về Update Version mới hiện thông báo rõ ràng (khi test mock update).
- [ ] Bấm Bỏ qua Update không bị lặp lại hộp thoại.
