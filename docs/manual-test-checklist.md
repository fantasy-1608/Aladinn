# 🧪 Aladinn — Checklist Kiểm tra Thủ công

> Sử dụng checklist này trước mỗi lần phát hành phiên bản mới.
> Đánh dấu ☑ khi test thành công, ☒ khi có lỗi.

---

## 1. Cài đặt & Khởi động

- [ ] Extension load được trong Chrome/Edge (không lỗi manifest)
- [ ] Popup mở được khi click icon trên toolbar
- [ ] Options page mở được (Cài đặt → Cơ Bản / Nâng Cao / Quản lý Tính năng)
- [ ] Badge version hiển thị đúng trên popup
- [ ] Không có lỗi đỏ trong Console (F12) khi khởi động

---

## 2. Trên VNPT HIS — Cơ bản

- [ ] Đăng nhập HIS → content script chạy (kiểm tra Console có log `🧞 Aladinn đã sẵn sàng!`)
- [ ] Mở danh sách BN → không bị chậm rõ rệt so với khi tắt extension
- [ ] UI Aladinn không che nút quan trọng của HIS (lưu, in, ký...)
- [ ] Đổi BN trên grid → hệ thống phát hiện đúng BN mới

---

## 3. Scanner Module

- [ ] Chọn BN → bấm quét (hoặc Ctrl+Shift+F) → quét được dữ liệu
- [ ] Badge sinh hiệu (💊) xuất hiện trên dòng BN sau khi quét
- [ ] Nút ✨ cạnh tên BN hoạt động → hiện modal CLS + Thuốc
- [ ] Modal CLS: Tab Lâm sàng hiển thị đúng diễn tiến + thuốc
- [ ] Modal CLS: Tab Xét nghiệm hiển thị đúng bảng chỉ số
- [ ] Modal CLS: Tab CĐHA hiển thị đúng danh sách phiếu
- [ ] Nút "Xem ảnh" PACS hoạt động (nếu có dữ liệu DICOM)
- [ ] Dashboard thống kê hiện lên khi bấm nút Dashboard
- [ ] Quick Actions dropdown hiển thị menu khi click header

---

## 4. CDS Module (Cảnh báo thuốc)

- [ ] Mở form kê đơn → shield CDS xuất hiện (hoặc drawer cảnh báo)
- [ ] Cảnh báo hiển thị đúng (có lý do + mức độ: Critical/Warning/Info)
- [ ] Bật "Lược bỏ mức thấp" → chỉ hiện Critical + Warning
- [ ] Tắt CDS trong Feature Flags → không có cảnh báo xuất hiện
- [ ] Bật lại CDS → cảnh báo hoạt động bình thường

---

## 5. Sign Module (Ký số)

### 5.1. An toàn cơ bản
- [ ] Không tự chạy ký khi mở trang ký số
- [ ] Có xác nhận (dialog/popup) trước khi bắt đầu ký hàng loạt
- [ ] Có nút DỪNG KHẨN CẤP hiển thị rõ ràng trong khi ký

### 5.2. Chức năng
- [ ] Bấm "Lọc hồ sơ" → chỉ hiện hồ sơ của người dùng
- [ ] Checkboxes xuất hiện trên grid → chọn/bỏ chọn được
- [ ] Bắt đầu ký → ký tuần tự từng BN, tự động nhấn SmartCA
- [ ] Bấm "Tiếp" → chuyển đúng BN kế tiếp
- [ ] Bấm "Bỏ qua" → skip BN hiện tại
- [ ] Bấm "Dừng" → dừng ngay lập tức

### 5.3. Ký nâng cao (Advanced Sign)
- [ ] Bật "Ký số Nâng cao" trong Options → chế độ nâng cao hoạt động
- [ ] Modal phiếu chưa ký hiển thị đúng danh sách
- [ ] Safe Mode: tạm dừng khi CDS phát hiện tương tác thuốc nghiêm trọng

---

## 6. Voice AI Module

- [ ] Bật/tắt Voice được từ Popup
- [ ] Micro icon xuất hiện khi Voice BẬT
- [ ] Bấm micro → ghi âm giọng nói → text hiển thị trên panel
- [ ] Bấm "Phân tích AI" → gửi đến Gemini → nhận JSON kết quả
- [ ] Kết quả AI hiển thị đúng trong panel (sinh hiệu, bệnh sử, ICD-10)
- [ ] Bấm "Điền form" → tự động điền vào form HIS
- [ ] Lỗi API key → báo rõ ràng tiếng Việt (không hiện lỗi kỹ thuật)

---

## 7. Emergency Module (Phiếu cấp cứu)

> ⚠️ Chỉ test trên khoa Cấp cứu

- [ ] Mở form 39/BV2 → nút 🚑 xuất hiện
- [ ] Bấm 🚑 → tự điền phiếu (sinh hiệu, lý do vào viện, thời gian)
- [ ] Nút biến thành ✅ sau khi điền xong
- [ ] Nút ẩn đi khi đóng form

---

## 8. Feature Flags (Quản lý tính năng)

- [ ] Options → "Quản lý Tính năng" hiển thị đủ 4 toggle + Debug Mode
- [ ] Tắt Scanner → lưu → trang HIS không hiện badge/menu scanner
- [ ] Bật lại Scanner → hoạt động bình thường
- [ ] Tắt Voice → micro icon không xuất hiện
- [ ] Debug Mode ON → Console hiện log chi tiết (debug level)
- [ ] Debug Mode OFF → chỉ hiện log info/warn/error

---

## 9. Options & Security

- [ ] Nhập API Key + PIN → lưu → API Key được mã hóa (hiện `🔒`)
- [ ] Đổi PIN → hoạt động, PIN mới được hash lại
- [ ] Xóa PIN → xóa cả API Key, AI features bị lock lại
- [ ] Dò tìm mô hình → hiện danh sách Gemini models từ API

---

## 10. Performance & Bảo mật

- [ ] Trang HIS không chậm hơn đáng kể khi bật extension
- [ ] Kiểm tra Console: không có log chứa tên BN, số BHYT, API key
- [ ] `manifest.json` không thêm quyền mới so với phiên bản trước
- [ ] Build production: `npm run build` pass không lỗi
- [ ] Lint: `npm run lint` pass hoặc chỉ có warning không ảnh hưởng

---

## Ghi chú kiểm tra

| Phiên bản | Ngày test | Người test | Kết quả | Ghi chú |
|---|---|---|---|---|
| v1.1.7 | ___/___/___ | ___________ | ⬜ Pass / ⬜ Fail | |
| | | | | |
