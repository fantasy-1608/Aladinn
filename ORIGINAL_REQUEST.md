# Original User Request

## Initial Request — 2026-05-22T13:41:14Z

# Teamwork Project Prompt — Draft

> Status: Launched
> Goal: Triển khai tính năng Biểu đồ Sinh hiệu (Vital Signs Sparkline) tự động cho Aladinn v2.

Phát triển tính năng tự động trích xuất thông tin sinh hiệu (Mạch, Nhiệt độ, Huyết áp, Nhịp thở) từ các văn bản diễn biến lâm sàng của bệnh nhân và vẽ thành một biểu đồ thu nhỏ (Sparkline/Mini-chart) trực quan. Biểu đồ này sẽ được chèn ngay cạnh thanh tiêu đề ngày tháng của từng tờ điều trị trong giao diện Aladinn (Tab Lâm sàng & Thuốc).

Working directory: /Users/trunganh/CNTT/Aladinn-v2
Integrity mode: development

## Requirements

### R1. Bộ trích xuất (Vital Signs Extractor)
Viết một module mới (ví dụ `content/scanner/vital-extractor.js`) sử dụng Regular Expression để bóc tách chính xác các thông số sinh hiệu (Mạch, Nhiệt độ, Huyết áp Tâm thu/Tâm trương, Nhịp thở, SpO2 nếu có) từ chuỗi văn bản tự do do bác sĩ gõ (ví dụ: "Mạch: 80 lần/p, t: 37, HA: 120/80"). Hàm cần xử lý mượt mà các biến thể viết tắt thông dụng trong bệnh án điện tử tiếng Việt.

### R2. Giao diện Biểu đồ (Sparkline UI)
Vẽ biểu đồ mini-chart hiển thị xu hướng sinh hiệu trong một tờ điều trị (hoặc toàn đợt) và đưa vào khoảng trống kế bên tiêu đề ngày tháng. Ưu tiên sử dụng Vanilla JS Canvas để extension giữ được độ siêu nhẹ, hoặc cài đặt các thư viện cực nhỏ nếu bắt buộc (không dùng CDN ngoài). Giao diện phải phẳng (`border-radius: 0`), đúng phong cách VNPT HIS (`HIS-ify`). Vị trí chèn tham chiếu từ hàm `renderClinicalTimeline` trong `content/scanner/scanner-init.js` (khoảng dòng 2374 trở đi).

### R3. Tích hợp An toàn
Chạy `gitnexus_impact` trước khi sửa file cốt lõi như `scanner-init.js`. Tuyệt đối không làm vỡ bố cục giao diện gốc của HIS.

## Acceptance Criteria

### Tính chính xác trích xuất
- [ ] Phải có Unit Test (Vitest) cho module bóc tách sinh hiệu với ít nhất 10 ca kiểm thử các mẫu văn bản khác nhau, đảm bảo độ bao phủ (coverage) hoàn toàn cho việc bóc tách.

### Tích hợp Giao diện
- [ ] Tích hợp trơn tru vào giao diện HTML sinh ra từ `scanner-init.js` mà không gây lỗi console. 
- [ ] Biểu đồ chỉ xuất hiện nếu có dữ liệu sinh hiệu hợp lệ.

### Quản lý phiên bản & Chất lượng
- [ ] Lệnh `pnpm run lint` và `pnpm run test` chạy thành công 100%.
- [ ] Lệnh `pnpm run build` đóng gói ra thư mục `dist/` không có lỗi. 
- [ ] Sử dụng `gitnexus_detect_changes()` để kiểm tra trước khi kết thúc tác vụ.

## Follow-up — 2026-05-23T01:44:24Z

Dự án này sẽ thực hiện đánh giá toàn diện về tính bảo mật và hiệu năng hoạt động của Aladinn V2 - một Chrome Extension hỗ trợ lâm sàng tích hợp với VNPT HIS.

Working directory: /Users/trunganh/CNTT/Aladinn-v2
Integrity mode: development

## Requirements

### R1. Đánh giá bảo mật (Security Audit)
- Rà soát toàn bộ các module có độ rủi ro cao được nêu trong `AGENTS.md` (như `api-bridge.js`, `clinical-fill.js`, `service-worker.js`...).
- Kiểm tra tính tuân thủ với các quy tắc an toàn của VNPT HIS (không rò rỉ PHI, không lưu trữ token/API key trái phép, đảm bảo ranh giới bảo mật không bị vượt qua).
- Phát hiện các lỗ hổng tiềm ẩn như XSS, Injection, bypass kiểm tra quyền.

### R2. Đánh giá hiệu năng (Performance Audit)
- Kiểm tra khả năng tiêu thụ tài nguyên (CPU, RAM) và rà soát rò rỉ bộ nhớ (Memory Leak) khi Extension chạy lâu dài trên tab VNPT HIS.
- Đánh giá tốc độ phản hồi của các tính năng cốt lõi như tự động điền (autofill), giọng nói, CDS alerts.
- Tối ưu hóa các truy vấn API và tương tác với DOM của HIS.

### R3. Báo cáo & Đề xuất (Audit Report & Mitigation)
- Cung cấp một báo cáo đánh giá chi tiết bằng tiếng Việt, chỉ ra các điểm yếu và đề xuất giải pháp khắc phục cụ thể cho từng vấn đề.

## Acceptance Criteria

### Security Criteria
- Báo cáo chỉ ra ít nhất toàn bộ các điểm chạm dữ liệu PHI và đánh giá xem chúng đã được mã hóa/ẩn danh hóa đúng chuẩn chưa.
- Xác minh không có thông tin nhạy cảm (token, mật khẩu, dữ liệu bệnh nhân) bị ghi vào log thô.

### Performance Criteria
- Đánh giá chi tiết hiệu năng tải trang và mức độ ảnh hưởng của content scripts lên trang HIS.
- Chỉ ra các hàm/tính năng có nguy cơ rò rỉ bộ nhớ hoặc chặn luồng chính (main thread).

## Follow-up — 2026-05-23T09:16:42Z

Triển khai tính năng Biểu đồ Sinh hiệu (Vital Signs Sparkline) tự động và Đánh giá An toàn/Hiệu năng Aladinn v2.

Hoàn thiện tính năng tự động trích xuất thông tin sinh hiệu (Mạch, Nhiệt độ, Huyết áp, Nhịp thở) từ các văn bản diễn biến lâm sàng của bệnh nhân và vẽ thành một biểu đồ thu nhỏ (Sparkline/Mini-chart) trực quan, đồng thời thực hiện đánh giá toàn diện về tính bảo mật và hiệu năng hoạt động của Aladinn V2 tích hợp với VNPT HIS.

Working directory: /Users/trunganh/CNTT/Aladinn-v2
Integrity mode: development

## Requirements

### R1. Bộ trích xuất Sinh hiệu (Vital Signs Extractor)
Hoàn thiện hoặc tối ưu hóa module `content/scanner/vital-extractor.js` sử dụng Regular Expression để bóc tách chính xác các thông số sinh hiệu (Mạch, Nhiệt độ, Huyết áp Tâm thu/Tâm trương, Nhịp thở, SpO2) từ văn bản tiếng Việt viết tắt thông dụng trong bệnh án điện tử.

### R2. Giao diện Biểu đồ Sparkline (Sparkline UI)
Vẽ biểu đồ mini-chart (sử dụng Canvas hoặc SVG) hiển thị xu hướng sinh hiệu trong đợt điều trị, chèn ngay cạnh tiêu đề ngày tháng trên giao diện Aladinn (Tab Lâm sàng & Thuốc) trong `content/scanner/scanner-init.js`. Đảm bảo thiết kế phẳng và chuẩn hóa giao diện kiểu VNPT HIS (`HIS-ify`).

### R3. Đánh giá Bảo mật & Hiệu năng (Security & Performance Audit)
Đánh giá kỹ các module rủi ro cao trong `AGENTS.md` (`api-bridge.js`, `clinical-fill.js`, `service-worker.js`...). Xác minh bảo mật PHI, kiểm tra rò rỉ bộ nhớ (Memory Leak) và tối ưu hóa các truy vấn DOM.

## Acceptance Criteria

### Tính chính xác trích xuất
- [ ] Module bóc tách sinh hiệu phải chạy chính xác trên tất cả các ca kiểm thử trong `tests/sparkline-challenger.test.js` và các file test bất lợi (adversarial tests).
- [ ] Đạt độ bao phủ kiểm thử cao cho `vital-extractor.js` và `sparkline.js`.

### Tích hợp Giao diện & HIS-ify
- [ ] Hiển thị biểu đồ Sparkline phẳng đúng kiểu VNPT HIS, không gây lỗi giao diện gốc hay lỗi console của HIS.
- [ ] Chỉ hiển thị biểu đồ hoặc thông tin sinh hiệu khi có dữ liệu hợp lệ.

### An toàn & Hiệu năng
- [ ] Bảo mật PHI tuyệt đối: không rò rỉ thông tin bệnh nhân ra ngoài hoặc ghi vào log thô.
- [ ] Không rò rỉ bộ nhớ (Memory Leak) hay làm chậm giao diện chính của HIS.

### Quản lý phiên bản & Chất lượng
- [ ] Lệnh `pnpm run lint` và `pnpm run test` chạy thành công 100% không cảnh báo.
- [ ] Lệnh `pnpm run build` đóng gói ra thư mục `dist/` không có lỗi.
- [ ] Sử dụng `gitnexus_detect_changes()` để kiểm tra trước khi kết thúc tác vụ.

