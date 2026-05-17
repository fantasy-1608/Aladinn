# Aladinn Manual QA Checklist

## 1. Kiểm tra mở extension

- [ ] Load extension không lỗi.
- [ ] Popup mở được.
- [ ] Options mở được.
- [ ] Không hiện lỗi console nghiêm trọng.

## 2. Kiểm tra bệnh nhân

- [ ] Mở bệnh nhân A, Aladinn đọc đúng thông tin.
- [ ] Chuyển sang bệnh nhân B, Aladinn cập nhật đúng.
- [ ] Không còn dữ liệu bệnh nhân A trên màn hình bệnh nhân B.
- [ ] Khi đổi bệnh nhân trong lúc chuẩn bị auto-fill, extension chặn ghi.

## 3. Kiểm tra AI

- [ ] Gửi AI không có họ tên/số hồ sơ trong payload.
- [ ] AI trả kết quả hiển thị được.
- [ ] AI response lỗi không làm extension crash.
- [ ] Chi phí token hiển thị hợp lý.

## 4. Kiểm tra auto-fill

- [ ] Có preview trước khi fill dữ liệu quan trọng.
- [ ] Fill đúng ô.
- [ ] Không fill nếu đổi bệnh nhân.
- [ ] Không fill nếu response thiếu field.

## 5. Kiểm tra CDS

- [ ] Tương tác thuốc hiển thị đúng.
- [ ] Chống chỉ định thuốc-bệnh hiển thị đúng.
- [ ] Trùng nhóm điều trị hiển thị đúng.
- [ ] Cảnh báo không che mất thao tác chính.
- [ ] Có nguồn/rule/version nếu có.

## 6. Kiểm tra auto-sign

- [ ] Chỉ chạy khi người dùng chủ động bật.
- [ ] Có nút dừng.
- [ ] Chuyển tab thì dừng.
- [ ] Chuyển bệnh nhân thì dừng.
- [ ] Logout thì dừng.

## 7. Kiểm tra bảo mật

- [ ] Không thấy họ tên/số hồ sơ trong logs.
- [ ] Không thấy API key trong console.
- [ ] Khóa/PIN hết hạn sau timeout.
- [ ] Export dữ liệu yêu cầu xác nhận.
