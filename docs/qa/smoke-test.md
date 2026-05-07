# Smoke Test Checklist

Chạy danh sách kiểm tra sau trước mỗi đợt Release Pilot hoặc Deploy chính thức.

## Cài đặt & Khởi động
- [ ] Cài Extension bản build `dist/` vào Chrome (Load unpacked).
- [ ] Mở trang VNPT HIS, đăng nhập thành công.
- [ ] Mở popup từ nút Extensions của Chrome — hiển thị bình thường.
- [ ] Bấm Settings/Options mở ra màn hình tùy chỉnh extension.

## Các chức năng cốt lõi (Core Functions)
- [ ] Gọi phím tắt khởi động Scanner (Ctrl+Shift+F) — Màn hình lọc bệnh nhân mở lên thành công.
- [ ] Gọi tính năng yêu cầu AI bằng giọng nói — Dịch vụ gọi API chạy và trả lại kết quả (hoặc báo nhập PIN nếu thiếu).
- [ ] Ghi nhận Logout HIS: Khi thoát tài khoản trên HIS, extension báo "Xóa Session & CryptoKey". Phải đăng nhập/nhập PIN lại nếu muốn sử dụng tiếp AI.
- [ ] Thử tính năng Ký số Tự động (Auto-Sign): Phải hiển thị và click được nút dừng khẩn cấp (Emergency Stop).

## Tránh Xung đột & An toàn Dữ liệu
- [ ] Kiểm tra Slash Commands: Gõ `//` trong một textarea hoặc ô nhập liệu của HIS có xuất hiện Auto-complete. Không bị kích hoạt sai lệch bởi nhập ngày tháng bình thường (như `12/04/2026`).
- [ ] Data Export: Khi click xuất dữ liệu phải hiển thị hộp thoại Consent hỏi sự đồng ý.
