# Project: Triển khai tính năng Biểu đồ Sinh hiệu (Vital Signs Sparkline) tự động và Đánh giá An toàn/Hiệu năng Aladinn v2

## Architecture
Dự án bao gồm hai luồng phát triển và đánh giá chính:
1. **Tính năng Biểu đồ Sinh hiệu (Vital Signs Sparkline):**
   - **Bộ trích xuất (`vital-extractor.js`):** Sử dụng Regular Expressions tối ưu để bóc tách Mạch (HR), Nhiệt độ (Temp), Huyết áp (BP), Nhịp thở (RR) và SpO2 từ văn bản ghi chú lâm sàng tiếng Việt phong phú của VNPT HIS.
   - **Bộ hiển thị Sparkline (`sparkline.js`):** Vẽ biểu đồ xu hướng mini-chart phẳng (`border-radius: 0px`) sử dụng Canvas, bám sát phong cách VNPT HIS (Seed color: `#004f9e` (xanh dương VNPT HIS), viền `#a6c9e2`).
   - **Tích hợp giao diện (`scanner-init.js`):** Chèn biểu đồ Sparkline ngay bên cạnh tiêu đề ngày tháng trên Tab Lâm sàng & Thuốc thông qua hàm `renderClinicalTimeline`.
2. **Đánh giá An toàn & Hiệu năng (Security & Performance Audit):**
   - Đánh giá các tệp tin có rủi ro cao: `api-bridge.js`, `clinical-fill.js`, `service-worker.js`.
   - Phát hiện các điểm chạm PHI (Personal Health Information) và rò rỉ thông tin nhạy cảm.
   - Kiểm tra rò rỉ bộ nhớ (Memory Leak) và tối ưu hóa DOM/API.
   - Lập báo cáo khắc phục chi tiết bằng tiếng Việt cho non-coder.

## Code Layout
- `content/scanner/vital-extractor.js` — Bộ trích xuất sinh hiệu từ văn bản.
- `content/scanner/sparkline.js` — Vẽ biểu đồ Sparkline phẳng.
- `content/scanner/scanner-init.js` — Điểm chèn biểu đồ Sparkline vào giao diện lâm sàng của VNPT HIS.
- `__tests__/vital-extractor.test.js` — Unit test cho bộ trích xuất sinh hiệu.
- `tests/` — Các file kiểm thử của Challenger/Adversarial cho Sparkline.
- `.agents/` — Coordination metadata của các tác nhân AI.

## Milestones
| # | Tên Milestone | Phạm vi | Phụ thuộc | Trạng thái |
|---|---------------|---------|-----------|------------|
| 1 | **M1: Tối ưu hóa Vital Signs Extractor** | Tối ưu hóa Regex trích xuất, đảm bảo vượt qua toàn bộ 100% tests (bao gồm các ca đặc biệt/lỗi tràn số/adversarial tests) | Không | DONE |
| 2 | **M2: Tích hợp Sparkline UI & HIS-ify** | Chèn biểu đồ phẳng VNPT HIS vào `scanner-init.js`, xử lý các lỗi vẽ Canvas với dữ liệu dị biệt (Infinity, mảng cực lớn), vượt qua toàn bộ tests | M1 | DONE |
| 3 | **M3: Đánh giá An toàn & Hiệu năng** | Đánh giá bảo mật (XSS, PHI, API, Token) và hiệu năng (Memory leak, DOM) của Aladinn v2, lập báo cáo chi tiết | Không | DONE |
| 4 | **M4: Khắc phục An toàn & Hiệu năng** | Sửa đổi và khắc phục 7 lỗ hổng an toàn và hiệu năng được phát hiện bởi Explorer M3 | M2, M3 | DONE |

## Interface Contracts
### `vital-extractor.js`
```javascript
export function extractVitals(text) {
  // Trả về object chứa các trường sinh hiệu được bóc tách:
  // { hr: number|null, temp: number|null, bp: string|null, rr: number|null, spo2: number|null }
}
```

### `sparkline.js`
```javascript
export function renderSparkline(canvas, dataPoints, options) {
  // Vẽ dữ liệu sinh hiệu lên canvas với các tùy chọn màu sắc và kích thước
}
export function createSparklineElement(dataPoints, options) {
  // Tạo và trả về phần tử HTML canvas chứa biểu đồ
}
export function generateSparklineImage(dataPoints, options) {
  // Trả về chuỗi base64 PNG của biểu đồ
}
```
