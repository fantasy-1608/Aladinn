# Store Assets — Hướng Dẫn Chuẩn Bị Screenshots

## Screenshots cần chụp (tối thiểu 1, khuyến nghị 3-4)

### Screenshot 1: Side Panel + VNPT HIS (BẮT BUỘC)
- **Kích thước**: 1280×800 pixels
- **Nội dung**: Side Panel Aladinn mở bên phải, trang VNPT HIS hiển thị danh sách bệnh nhân bên trái
- **Lưu ý**: 
  - Blur/đen tên bệnh nhân, số BHYT, mã bệnh nhân
  - Giữ nguyên giao diện UI để reviewer thấy extension thực sự hoạt động
  - Chụp ở resolution 1280×800 hoặc scale lại cho đúng

### Screenshot 2: Scanner Dashboard
- **Kích thước**: 1280×800 pixels
- **Nội dung**: Scanner overlay đang hiển thị dữ liệu lâm sàng tổng hợp
- **Lưu ý**: Blur PHI, giữ nguyên cấu trúc dữ liệu

### Screenshot 3: Voice Input
- **Kích thước**: 1280×800 pixels
- **Nội dung**: Giao diện nhập giọng nói + kết quả AI đã parse
- **Lưu ý**: Có thể dùng dữ liệu mẫu (không phải bệnh nhân thật)

### Screenshot 4: CDS Alerts
- **Kích thước**: 1280×800 pixels
- **Nội dung**: Cảnh báo tương tác thuốc hiển thị trên trang HIS
- **Lưu ý**: Có thể dùng dữ liệu mẫu

## Cách chụp
1. Mở Chrome DevTools → Ctrl+Shift+M (Device Toolbar)
2. Set viewport: 1280 × 800
3. Chụp bằng DevTools: `...` → Capture screenshot
4. Hoặc dùng extension "GoFullPage" hoặc "Awesome Screenshot"
5. Save vào thư mục `store-assets/`

## Promo Tile (440×280)
- Logo Aladinn + tagline ngắn
- Nền gradient phù hợp với branding
- File: `store-assets/promo-tile.png`
