# 📊 Bảng Đăng Ký Rủi Ro Lâm Sàng & Chốt Chặn Bảo Vệ (Aladinn v2)

Tài liệu này tổng hợp các rủi ro lớn nhất về mặt lâm sàng, bảo mật thông tin và vận hành kỹ thuật khi sử dụng **Aladinn v2** làm trợ lý lâm sàng trên nền tảng VNPT HIS, đồng thời mô tả chi tiết các chốt chặn công nghệ đã được thiết kế và kiểm thử nghiêm ngặt để triệt tiêu các rủi ro này.

---

## 1. Bản Đồ Rủi Ro Lâm Sàng (Clinical Risk Matrix)

Mức độ rủi ro được đánh giá dựa trên sự kết hợp giữa **Khả năng xảy ra** và **Mức độ nghiêm trọng đối với bệnh nhân**:

| Mã Rủi Ro | Mô Tả Rủi Ro Lâm Sàng | Khả Năng Xảy Ra | Mức Độ Nghiêm Trọng | Mức Độ Rủi Ro | Chốt Chặn Công Nghệ Trọng Yếu |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **CL-01** | **Ghi nhầm bệnh nhân (Patient Cross-Contamination)**: Điền thông tin tóm tắt hoặc đơn thuốc của Bệnh nhân A vào hồ sơ của Bệnh nhân B khi bác sĩ chuyển tab nhanh. | Thấp | Cực kỳ nghiêm trọng | **CAUTION (Cao)** | `PatientContextGuard` (Khóa kép Composite Patient Key) |
| **CL-02** | **Lộ lọt thông tin nhạy cảm (PHI Leakage)**: Gửi tên, tuổi, địa chỉ hoặc mã số định danh y tế của bệnh nhân lên các mô hình AI Cloud bên ngoài. | Trung bình | Nghiêm trọng | **CAUTION (Cao)** | `PHIRedactor` (Bộ khử định danh PHI tự động cục bộ) |
| **CL-03** | **Tính toán sai liều eGFR**: Nhầm lẫn đơn vị đo Creatinine hoặc tính toán sai mức lọc cầu thận dẫn đến kê đơn quá liều thuốc độc tính thận. | Thấp | Cực kỳ nghiêm trọng | **CAUTION (Cao)** | `eGFR Renal Alert Engine` (CKD-EPI 2021 race-free & Cockcroft-Gault song song) |
| **CL-04** | **Tràn thông tin gây nhiễu (Alert Fatigue)**: Cảnh báo quá nhiều tương tác thuốc không cần thiết làm bác sĩ phớt lờ các cảnh báo cực kỳ nguy hiểm. | Cao | Trung bình | **WARNING (Vừa)** | Phân tầng cảnh báo (Critical, High, Moderate) & Lưu trạng thái tắt ẩn (Dismiss cache) |
| **CL-05** | **Giao diện HIS thay đổi gây lỗi (DOM Drifting)**: VNPT HIS cập nhật giao diện khiến tiện ích điền sai trường dữ liệu hoặc không hoạt động. | Cao | Thấp | **WARNING (Vừa)** | `Self-Healing DOM Engine` (Tìm kiếm ngữ nghĩa tiếng Việt thích ứng) |
| **CL-06** | **Tự động Ký số sai luật (Auto-Sign Bypass)**: Ký số hồ sơ bệnh án tự động khi thông tin chưa được điền đủ hoặc bác sĩ chưa kiểm duyệt trực quan. | Thấp | Nghiêm trọng | **CAUTION (Cao)** | Chặn auto-sign khi tab thay đổi & Yêu cầu xác thực PIN từng phiên |

---

## 2. Chi Tiết Các Chốt Chặn Kỹ Thuật (Mitigation Shields)

### 2.1. Chốt Chặn Khóa Kép Bệnh Nhân (`PatientContextGuard`)
- **Vị trí file:** [patient-context-guard.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/scanner/patient-context-guard.js)
- **Cơ chế hoạt động:** 
  - Tạo một **Khóa kết hợp (Composite Key)** gồm: `benhnhanId_khambenhId` được snoop trực tiếp từ DOM và dữ liệu API HIS.
  - Mỗi khi thực hiện lệnh tự động điền (Auto-fill) hoặc tóm tắt bệnh án, hệ thống sẽ thực hiện kiểm tra chéo 3 bên: **[Dữ liệu DOM hiện tại] == [Dữ liệu Cache hoạt động] == [Thông tin Bệnh nhân đang hiển thị trên màn hình]**.
  - Nếu phát hiện bất kỳ sự lệch pha nào (ví dụ bác sĩ click chọn bệnh nhân khác ở danh sách bên trái), hệ thống lập tức chặn đứng (Fail Closed) và xóa toàn bộ bộ nhớ đệm lâm sàng tạm thời.

### 2.2. Bộ Khử Định Danh Y Tế (`PHIRedactor`)
- **Vị trí file:** [phi-redactor.js](file:///Users/trunganh/CNTT/Aladinn-v2/background/phi-redactor.js)
- **Cơ chế hoạt động:**
  - Áp dụng các biểu thức chính quy (Regex) và từ điển thực thể y tế để tự động nhận diện và xóa bỏ/thế chỗ các thông tin định danh (PHI) bao gồm: Tên bệnh nhân, Số điện thoại, Số CMT/CCCD, Địa chỉ nhà, Ngày tháng năm sinh chi tiết trước khi chuỗi văn bản được gửi ra Internet.
  - Chỉ giữ lại thông tin lâm sàng thô (triệu chứng, chỉ số xét nghiệm, chẩn đoán ICD) phục vụ suy luận AI.

### 2.3. Bộ Tính Toán eGFR Thích Ứng Cao (`eGFR Renal Alerts`)
- **Vị trí file:** [egfr-alerts.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/cds/egfr-alerts.js)
- **Cơ chế hoạt động:**
  - Sử dụng phương trình **CKD-EPI (2021) không phụ thuộc chủng tộc** làm tiêu chuẩn vàng để tính toán eGFR tự động từ Creatinine huyết thanh, tuổi và giới tính của bệnh nhân.
  - Tích hợp kiểm tra đơn vị thông minh: Tự động phát hiện nếu Creatinine được nhập bằng $\mu\text{mol/L}$ (ví dụ giá trị > 15) và quy đổi sang $\text{mg/dL}$ trước khi tính toán để tránh sai lệch kết quả lên tới 88 lần.
  - Đưa ra cảnh báo đỏ tức thì ngay khi phát hiện bác sĩ kê đơn thuốc thải trừ qua thận (như Metformin, Aminoglycoside) cho bệnh nhân có eGFR < 30 ml/phút/1.73m².

### 2.4. Công Nghệ Tự Phục Hồi Giao Diện (`Self-Healing DOM Engine`)
- **Vị trí file:** [self-healing.js](file:///Users/trunganh/CNTT/Aladinn-v2/content/shared/self-healing.js)
- **Cơ chế hoạt động:**
  - Khi VNPT HIS thay đổi cấu trúc mã nguồn (HTML ID hoặc Class thay đổi), các extension thông thường sẽ bị liệt hoàn toàn. 
  - `Self-Healing DOM` hoạt động theo nguyên tắc hai tầng bảo vệ: Nếu tìm kiếm theo ID truyền thống thất bại, nó sẽ chuyển sang chế độ **Quét Ngữ Nghĩa (Semantic Healing)**: tìm kiếm các nhãn chữ tiếng Việt xung quanh ô nhập liệu (như "Tóm tắt bệnh sử", "Chẩn đoán kèm theo") để định vị chính xác ô cần nhập.
  - Đảm bảo tiện ích luôn chạy bền bỉ bất kể HIS cập nhật định kỳ.

---

## 3. Quy Trình Vận Hành An Toàn Khi Xảy Ra Sự Cố (Emergency Protocol)

Trong trường hợp phát hiện bất kỳ dấu hiệu không nhất quán dữ liệu nào:
1. **Lập tức dừng hoạt động (Fail-Safe):** Aladinn sẽ tự động chuyển sang chế độ ngủ đông, ẩn toàn bộ nút bấm tự điền trên giao diện HIS.
2. **Xóa sạch bộ nhớ tạm:** Toàn bộ API Key đã giải mã trong RAM và dữ liệu lâm sàng của bệnh nhân trước đó sẽ bị giải phóng ngay lập tức.
3. **Hiển thị thông báo trực quan:** Đưa ra thông báo màu hổ phách cảnh báo bác sĩ F5 tải lại trang để thiết lập lại môi trường an toàn.
