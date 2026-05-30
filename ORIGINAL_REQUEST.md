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

## Follow-up — 2026-05-23T11:58:25Z

Dự án này nhằm hoàn thiện hệ thống hiển thị lâm sàng trên Dòng thời gian (Timeline) của tiện ích Aladinn V2 tích hợp trong hệ thống VNPT HIS. Dự án tập chuyên giải quyết 2 yêu cầu cốt lõi:
1. **Sửa lỗi sinh hiệu ổn định**: Nhận diện trạng thái "Sinh hiệu ổn định" khi bác sĩ ghi nhận bằng chữ (như "sinh hiệu ổn", "sh ổn", "shổn", "sinh hiệu ổn định") thay vì bỏ trống hoặc hiện màu xám "(Chưa nhập sinh hiệu)".
2. **Tích hợp bảng Tổng quan Lâm sàng Khẩn cấp (Clinical Overview)**: Bổ sung bảng tóm tắt 3 cột (Khám toàn thân, Khám bộ phận, Hướng xử lý) được bóc tách trực tiếp từ API/DOM vào đầu mỗi ngày điều trị trên Dòng thời gian để hỗ trợ bác sĩ xem nhanh khi cấp cứu.

Working directory: /Users/trunganh/CNTT/Aladinn-v2
Integrity mode: development

## Requirements

### R1. Tự động nhận diện và hiển thị trạng thái Sinh hiệu ổn định
- **Xử lý trích xuất**: Cập nhật module `content/scanner/vital-extractor.js` để quét diễn tiến lâm sàng (`DIENBIEN`). Nhận diện các cụm từ tiếng Việt không dấu/có dấu viết tắt phổ biến: `"sinh hiệu ổn"`, `"sh ổn"`, `"shổn"`, `"sinh hiệu ổn định"`, `"sh ổn định"`. Trả về thuộc tính `stable: true` nếu khớp.
- **Xử lý kiểm thử (Unit Tests)**: Viết bổ sung các ca kiểm thử trong `__tests__/vital-extractor.test.js` để đảm bảo độ chính xác của Regex, không nhận diện sai các từ không liên quan.
- **Giao diện Dòng thời gian**: Cập nhật hàm render timeline trong `content/scanner/scanner-init.js`.
  - Nếu ngày điều trị có các số đo cụ thể (Mạch, Nhiệt độ...), vẽ biểu đồ Sparkline bình thường.
  - Nếu ngày điều trị không có số đo cụ thể NHƯNG diễn tiến lâm sàng có ghi nhận ổn định (`stable: true`), thay thế dòng chữ xám `(Chưa nhập sinh hiệu)` bằng một nhãn phẳng, vuông vức, chuẩn HIS-ify:
    - Nền: màu xanh lá nhạt (`#e8f5e9`)
    - Viền: xanh lá cây nhạt (`#c8e6c9`)
    - Chữ: xanh lá đậm (`#2e7d32`), in đậm, cỡ chữ `11px`, kèm icon lá cờ hoặc chấm tròn xanh: `🟢 Sinh hiệu ổn định`.
    - Thiết kế vuông vức không bo góc (`border-radius: 0px !important`).
  - Nếu hoàn toàn không có số đo lẫn ghi nhận ổn định, giữ nguyên dòng chữ xám `(Chưa nhập sinh hiệu)`.

### R2. Tích hợp bảng thông tin Khám & Xử lý nhanh (Clinical Overview) phục vụ Cấp cứu
- **API/DOM Bridge**: Cập nhật hàm fetch danh sách phiếu điều trị trong `injected/api-bridge.js`. Khi ánh xạ danh sách dòng dữ liệu từ API `NT.024.DSPHIEU` (hoặc DOM khi đang soạn thảo), bổ sung bóc tách các trường:
  - Khám toàn thân (`TOANTHAN`): Scan các trường chứa `TOANTHAN`, `KHAMTOAN`, `KHAMBENH_TOANTHAN` v.v.
  - Khám bộ phận (`KHAMBOPHAN`): Scan các trường chứa `BOPHAN`, `KHAMBENH_BOPHAN` v.v.
  - Hướng xử lý (`XULY`): Scan các trường chứa `XULY`, `HUONGXULY`, `HUONG_XU_LY` v.v.
- **Giao diện Clinical Overview**: Thiết kế một bảng tổng quan phẳng, vuông vức đặt ngay đầu mỗi thẻ ngày điều trị trên Dòng thời gian (dưới tiêu đề ngày và trên diễn tiến chi tiết giờ giấc).
  - Cấu trúc: Chia thành 3 phần bằng nhau theo hàng ngang (hoặc lưới 3 cột) hiển thị:
    - **[TOÀN THÂN]**: Tóm tắt trạng thái khám toàn thân.
    - **[BỘ PHẬN]**: Tóm tắt tình trạng các cơ quan bộ phận.
    - **[XỬ LÝ]**: Hướng xử lý, y lệnh lâm sàng khẩn cấp.
  - Thẩm mỹ:
    - Seed Color: Màu xanh dương VNPT HIS (`#004f9e`).
    - Nền panel: Màu xám siêu nhạt (`#f9f9f9`), viền màu xanh nhạt đặc trưng của HIS (`#a6c9e2`), độ dày `1px`.
    - Phẳng và vuông vức hoàn toàn (`border-radius: 0px !important`).
    - Có nhãn tiêu đề nhỏ gọn, trực quan, chuyên nghiệp cho từng cột.
    - Nếu một trong các trường bị rỗng, hiển thị chữ xám nhẹ `(Chưa ghi nhận)` để bác sĩ biết thông tin còn thiếu.
    - Chỉ hiển thị bảng này khi có ít nhất một trong ba trường có dữ liệu, tránh chiếm diện tích vô ích nếu ngày đó hoàn toàn trống thông tin.

## Acceptance Criteria

### Tiêu chí Sinh hiệu
- [ ] Hàm `extractVitals` nhận diện chính xác ít nhất 5 biến thể của cụm từ ổn định (ví dụ: "sh ổn", "sinh hiệu ổn định", "shổn") và trả về thuộc tính `stable: true`.
- [ ] Chạy lệnh `pnpm run test` vượt qua 100% unit tests của `vital-extractor.js`.
- [ ] Khi xem Dòng thời gian, ngày chỉ ghi diễn tiến "sinh hiệu ổn" hiển thị nhãn phẳng `🟢 Sinh hiệu ổn định` với nền `#e8f5e9`, viền `#c8e6c9`, chữ `#2e7d32`, góc vuông `border-radius: 0px`.

### Tiêu chí Clinical Overview
- [ ] Dòng thời gian hiển thị bảng Tổng quan 3 cột phẳng vuông vức khi có dữ liệu `TOANTHAN`, `KHAMBOPHAN` hoặc `XULY`.
- [ ] Tích hợp mượt mà dữ liệu thời gian thực từ DOM Tờ điều trị đang soạn thảo lên bảng Clinical Overview khi bác sĩ đang gõ.
- [ ] Phong cách thiết kế bám sát 100% giao diện VNPT HIS (Seed color `#004f9e`, viền `#a6c9e2`, phẳng hoàn toàn `border-radius: 0px`).
- [ ] Dự án build thành công bằng lệnh `pnpm run build` không có bất kỳ lỗi cú pháp hay linting nào.



## Follow-up — 2026-05-25T16:14:09Z

# Teamwork Project Prompt

Tích hợp API Tra cứu kết quả Cận lâm sàng (từ trang TraCuuKetQuaHDG) vào hệ thống Aladinn v2 để lấy toàn bộ kết quả xét nghiệm trong 1 lần gọi, đồng thời giữ lại cơ chế cũ làm phương án dự phòng (fallback).

Working directory: /Users/trunganh/CNTT/Aladinn-v2
Integrity mode: development

## Requirements

### R1. Tích hợp API mới vào `fetchLabs`
Cập nhật hàm `fetchLabs` trong `injected/api-bridge.js`. Nghiên cứu và gọi trực tiếp API (Store Procedure hoặc RestService) tương đương với chức năng của trang `TraCuuKetQuaHDG` để lấy toàn bộ dữ liệu CLS của đợt điều trị (sử dụng KHAMBENHID hoặc HOSOBENHANID). 

### R2. Xây dựng phương án dự phòng (Fallback)
Nếu API mới thất bại (lỗi mạng, timeout, không có quyền, hoặc trả về cấu trúc lỗi), hệ thống phải tự động fallback về cơ chế cũ (gọi `NT.024.DSPHIEU` để lấy danh sách phiếu, sau đó lấy chi tiết từng phiếu). Đảm bảo không làm gián đoạn luồng công việc của bác sĩ.

### R3. Tuân thủ Quy tắc An toàn Lâm sàng (PHI)
Mọi xử lý dữ liệu phải tuân thủ tuyệt đối quy tắc trong `AGENTS.md`. Dữ liệu trả về phải được làm sạch, map đúng định dạng cũ để các module tiêu thụ dữ liệu (như CDS, Autofill) hoạt động bình thường mà không cần sửa đổi lớn. Không ghi log dữ liệu PHI thô ra console.

## Acceptance Criteria

### Xác minh kỹ thuật & An toàn
- [ ] Hàm `fetchLabs` phải chứa logic `try/catch` bọc quanh lời gọi API mới, với nhánh `catch` chuyển hướng mượt mà sang logic cũ.
- [ ] Chạy `gitnexus_impact` trước khi sửa code để đánh giá rủi ro lên các flow thực thi.
- [ ] Chạy `pnpm run test` (nếu có test liên quan) và đảm bảo không phá vỡ các test hiện tại.
- [ ] Không có thông tin nhạy cảm (PHI) nào bị in ra console.warn hoặc console.error ngoài các thông báo lỗi chung chung (để phục vụ debug).
