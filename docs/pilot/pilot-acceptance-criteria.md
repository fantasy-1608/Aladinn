# Tiêu chí Đánh giá Pilot (Acceptance Criteria)

Để phiên bản Pilot được đánh giá là thành công và có thể triển khai diện rộng (General Availability - GA), các tiêu chí sau phải được thỏa mãn trong 2–4 tuần dùng thử:

## 1. Mức độ Ổn định (Stability)

- Tỷ lệ crash / lỗi không phản hồi: < 2% số lượng thao tác.
- Chức năng cốt lõi của HIS không bị cản trở hoặc làm chậm đi đáng kể (thời gian render giao diện < +500ms).
- Chức năng Auto-sign luôn hoạt động nhất quán, không xảy ra ký sót hoặc ký nhầm bệnh nhân.

## 2. Trải nghiệm người dùng (UX / Adoption)

- Điểm đánh giá (CSAT) của người dùng dùng thử >= 4.0/5.0.
- Số ca dùng AI giảm thiểu ít nhất 20% thời gian nhập liệu tay (so sánh với base-line).
- Số lượng cảnh báo CDS bị người dùng báo sai (false-positive rate) ở mức chấp nhận được (< 10%).

## 3. An toàn Dữ liệu (Data Security)

- Không có bất kỳ ticket báo rò rỉ dữ liệu (PHI data leak).
- Cơ chế Auto-Purge khi Logout/Timeout hoạt động chính xác 100%.

## 4. Kiểm soát Pilot

- Audit logs định kì thu thập đủ thông tin hành vi nhưng không dính PHI.
- Kill-switch đã được thử nghiệm và vô hiệu hóa extension thành công khi giả lập sự cố.
