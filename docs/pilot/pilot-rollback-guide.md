# Hướng dẫn Rollback Khẩn cấp (Emergency Rollback)

Nếu phiên bản Pilot gây lỗi nghiêm trọng (block công việc chuyên môn), người dùng hoặc IT cần thực hiện các bước sau để quay về phiên bản ổn định gần nhất.

## 1. Rollback Extension
1. Truy cập `chrome://extensions/`.
2. Gạt công tắc tắt (Disable) hoặc Xóa (Remove) extension "Aladinn" phiên bản Pilot (ví dụ `v1.2.4`).
3. Tải và giải nén phiên bản ổn định cũ (vd: `v1.2.0`). IT Department luôn cung cấp song song file ZIP bản Stable.
4. Chọn **Load unpacked** và trỏ vào thư mục phiên bản cũ.
5. F5 tải lại trang VNPT HIS.

## 2. Remote Kill Switch (Cho phía IT)
Nếu phát hiện lỗi hệ thống trên diện rộng do Auto-Sign, CDS hoặc AI:
1. IT Admin sửa đổi file `remote-config.json` trên nhánh main của GitHub:
   - Chuyển `autoSign.enabled: false`
   - Hoặc `cds.enabled: false`
   - Hoặc đổi `minimumVersion: "9.9.9"` để buộc toàn bộ extension client ngưng hoạt động cho đến khi cập nhật.
2. Hệ thống sẽ tự động tắt các module nguy hiểm trong vòng tối đa 15-30 phút mà không cần người dùng tự gỡ cài đặt.

## 3. Xóa bộ nhớ đệm (Cache)
Nếu lỗi liên quan đến lưu trữ sai lệch:
1. Đăng xuất khỏi HIS (Extension sẽ tự động gọi purge data).
2. Hoặc mở `chrome://settings/clearBrowserData`, chọn mục **Cookies and other site data** và **Cached images and files**.
