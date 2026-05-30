/**
 * 🧞 Aladinn v2 — Dữ liệu Phác đồ Mẫu (Mock Protocols)
 * 
 * Bộ dữ liệu phác đồ điều trị mẫu dùng để thử nghiệm RAG pipeline.
 * Trong thực tế, dữ liệu này sẽ được thay bằng phác đồ chính thức
 * của bệnh viện (file PDF/Word được chuyển đổi sang text).
 */

export const SAMPLE_PROTOCOLS = [
  {
    title: 'Viêm phổi cộng đồng ở người lớn',
    icd_codes: 'J15, J18',
    department: 'Nội tổng hợp',
    source: 'phac-do-viem-phoi-2024.pdf',
    content: `# Phác đồ Điều trị Viêm phổi Cộng đồng ở Người lớn

## Định nghĩa
Viêm phổi cộng đồng (Community-Acquired Pneumonia - CAP) là nhiễm trùng nhu mô phổi mắc phải ngoài bệnh viện hoặc trong 48 giờ đầu nhập viện.

## Chẩn đoán
### Lâm sàng
- Sốt (≥38°C), ho có đàm, khó thở, đau ngực kiểu màng phổi
- Khám: ran nổ, ran ẩm, hội chứng đông đặc
- Chỉ số CURB-65 để phân tầng mức độ nặng

### Cận lâm sàng
- X-quang ngực: tổn thương thâm nhiễm mới
- Công thức máu: Bạch cầu tăng >10.000/µL, Neutrophil ưu thế
- CRP tăng, Procalcitonin tăng (>0.25 ng/mL gợi ý nhiễm khuẩn)
- Cấy đàm, cấy máu trước khi dùng kháng sinh

## Điều trị
### Nhẹ (CURB-65: 0-1) — Điều trị ngoại trú
- Amoxicillin 500mg x 3 lần/ngày x 5 ngày
- HOẶC Azithromycin 500mg ngày 1, sau đó 250mg x 4 ngày
- HOẶC Doxycycline 100mg x 2 lần/ngày x 5 ngày

### Trung bình (CURB-65: 2) — Nhập viện
- Amoxicillin-Clavulanate 1.2g TM x 3 lần/ngày 
- KẾT HỢP Azithromycin 500mg TM hoặc uống x 1 lần/ngày
- Thời gian: 7-10 ngày, đánh giá lại sau 48-72 giờ

### Nặng (CURB-65: 3-5) — ICU
- Ceftriaxone 2g TM x 1 lần/ngày HOẶC Cefotaxime 1-2g TM x 3 lần/ngày
- KẾT HỢP Azithromycin 500mg TM x 1 lần/ngày
- Nếu nghi Pseudomonas: Piperacillin-Tazobactam 4.5g TM x 4 lần/ngày
- Thời gian: 10-14 ngày

## Theo dõi
- Đánh giá lâm sàng sau 48-72 giờ
- Nếu không cải thiện: cấy lại, CT ngực, xem xét kháng sinh phổ rộng hơn
- Chuyển kháng sinh đường uống khi: hết sốt >24h, ăn uống được, bạch cầu giảm`
  },

  {
    title: 'Đái tháo đường type 2',
    icd_codes: 'E11',
    department: 'Nội tiết',
    source: 'phac-do-dtd-type2-2024.pdf',
    content: `# Phác đồ Điều trị Đái tháo đường Type 2

## Mục tiêu điều trị
- HbA1c <7% (cá nhân hóa: <6.5% cho BN trẻ, <8% cho BN lớn tuổi/nhiều bệnh phối hợp)
- Glucose đói: 4.4 - 7.2 mmol/L
- Glucose sau ăn 2h: <10 mmol/L
- Huyết áp <130/80 mmHg, LDL-C <2.6 mmol/L (<1.8 nếu có bệnh tim mạch)

## Bậc 1: Thay đổi lối sống + Metformin
- Chế độ ăn, tập thể dục 150 phút/tuần
- Metformin 500mg x 2 lần/ngày, tăng dần tối đa 2000mg/ngày
- **LƯU Ý**: Chống chỉ định khi eGFR <30 mL/phút. Giảm liều khi eGFR 30-45.

## Bậc 2: Thêm thuốc thứ 2
Nếu HbA1c không đạt mục tiêu sau 3 tháng:
- Ưu tiên SGLT2i (Dapagliflozin, Empagliflozin) nếu có bệnh tim mạch/thận
- HOẶC GLP-1RA (Liraglutide, Semaglutide) nếu cần giảm cân
- HOẶC DPP-4i (Sitagliptin, Vildagliptin) — ít gây hạ đường huyết
- HOẶC Sulfonylurea (Gliclazide MR) — rẻ, hiệu quả nhưng nguy cơ hạ đường huyết

## Bậc 3: Phối hợp 3 thuốc hoặc Insulin
- Metformin + SGLT2i + DPP-4i (hoặc SU)
- HOẶC thêm Insulin nền (Glargine/Detemir) buổi tối: khởi đầu 10 đơn vị

## Theo dõi
- HbA1c mỗi 3 tháng, Creatinine + eGFR mỗi 6 tháng
- Khám mắt, bàn chân mỗi 12 tháng
- Microalbumin niệu mỗi 12 tháng`
  },

  {
    title: 'Tăng huyết áp ở người lớn',
    icd_codes: 'I10, I11',
    department: 'Tim mạch',
    source: 'phac-do-tang-huyet-ap-2024.pdf',
    content: `# Phác đồ Điều trị Tăng Huyết áp ở Người lớn

## Phân độ
- Bình thường: <120/80 mmHg
- Bình thường cao: 120-129/<80 mmHg
- THA độ 1: 130-139/80-89 mmHg
- THA độ 2: ≥140/90 mmHg
- Cơn THA: ≥180/120 mmHg (cấp cứu nếu có tổn thương cơ quan đích)

## Mục tiêu
- <130/80 mmHg cho hầu hết BN
- <140/90 mmHg cho BN ≥65 tuổi

## Điều trị không dùng thuốc
- Giảm muối <5g/ngày, chế độ ăn DASH
- Giảm cân nếu BMI >25, tập thể dục aerobic 150 phút/tuần
- Hạn chế rượu bia, ngừng hút thuốc

## Điều trị thuốc
### Đơn trị liệu (THA độ 1)
- ACEi: Enalapril 5-20mg/ngày, Perindopril 5-10mg/ngày
- ARB: Losartan 50-100mg/ngày, Valsartan 80-320mg/ngày
- CCB: Amlodipine 5-10mg/ngày
- Thiazide: Hydrochlorothiazide 12.5-25mg/ngày

### Phối hợp (THA độ 2 hoặc không đạt mục tiêu)
- ACEi/ARB + CCB (Ưu tiên)
- ACEi/ARB + Thiazide
- **KHÔNG BAO GIỜ** phối hợp ACEi + ARB (tăng nguy cơ suy thận cấp)

### THA kháng trị (≥3 thuốc không kiểm soát)
- Thêm Spironolactone 25-50mg/ngày
- Xem xét nguyên nhân thứ phát (hẹp động mạch thận, Cushing, u tủy thượng thận)

## Lưu ý đặc biệt
- BN đái tháo đường: Ưu tiên ACEi/ARB (bảo vệ thận)
- BN suy tim: ACEi/ARB + Beta-blocker + lợi tiểu
- BN thai kỳ: Methyldopa, Labetalol, Nifedipine (KHÔNG dùng ACEi/ARB)
- BN hen phế quản: KHÔNG dùng Beta-blocker không chọn lọc`
  },

  {
    title: 'Sốt xuất huyết Dengue',
    icd_codes: 'A90, A91',
    department: 'Nhiễm',
    source: 'phac-do-sxh-dengue-2024.pdf',
    content: `# Phác đồ Điều trị Sốt Xuất Huyết Dengue

## Chẩn đoán
### Lâm sàng
- Sốt cao đột ngột 39-40°C, liên tục 2-7 ngày
- Đau đầu, đau hốc mắt, đau cơ khớp
- Nghiệm pháp dây thắt dương tính
- Ban xuất huyết, chấm xuất huyết dưới da

### Cận lâm sàng
- NS1 Ag dương tính (ngày 1-5)
- IgM dương tính (từ ngày 5)
- Tiểu cầu giảm <100.000/µL
- Hematocrit tăng ≥20% so với bình thường

## Phân độ
- Độ I: Sốt + Dây thắt dương tính
- Độ II: Xuất huyết tự nhiên (da, niêm mạc)
- Độ III: Sốc (mạch nhanh, huyết áp kẹp)
- Độ IV: Sốc nặng (không đo được mạch, HA)

## Điều trị
### Độ I, II — Theo dõi tại viện
- Hạ sốt: Paracetamol 10-15mg/kg/lần, cách 4-6 giờ. **TUYỆT ĐỐI KHÔNG DÙNG ASPIRIN/NSAID**
- Bù dịch đường uống: ORS, nước trái cây
- Truyền dịch khi không uống được: NaCl 0.9% hoặc Ringer Lactate
- Theo dõi: Sinh hiệu mỗi 4-6 giờ, Hct + Tiểu cầu mỗi 12 giờ

### Độ III, IV — Cấp cứu sốc
- Ringer Lactate hoặc NaCl 0.9%: 20mL/kg/giờ đầu
- Nếu không cải thiện: Dextran 40 hoặc HES 10mL/kg/giờ
- Theo dõi CVP, nước tiểu mỗi giờ
- Truyền tiểu cầu khi <10.000/µL hoặc xuất huyết nặng

## Dấu hiệu cảnh báo nguy hiểm (Warning Signs)
- Đau bụng nhiều, nôn liên tục
- Chảy máu niêm mạc (chảy máu chân răng, nôn ra máu)
- Tiểu cầu giảm nhanh (<50.000)
- Hct tăng nhanh kèm tiểu cầu giảm
- Lừ đừ, bứt rứt, vật vã`
  },

  {
    title: 'Suy thận mạn (CKD) — Chỉnh liều thuốc',
    icd_codes: 'N18',
    department: 'Thận - Tiết niệu',
    source: 'phac-do-suy-than-chinh-lieu-2024.pdf',
    content: `# Hướng dẫn Chỉnh liều Thuốc theo Chức năng Thận (eGFR)

## Phân giai đoạn CKD theo eGFR (CKD-EPI 2021)
- G1: eGFR ≥90 — Bình thường hoặc cao
- G2: eGFR 60-89 — Giảm nhẹ
- G3a: eGFR 45-59 — Giảm nhẹ đến trung bình
- G3b: eGFR 30-44 — Giảm trung bình đến nặng
- G4: eGFR 15-29 — Giảm nặng
- G5: eGFR <15 — Suy thận giai đoạn cuối

## Thuốc cần chỉnh liều
### Metformin
- eGFR ≥45: Liều bình thường (tối đa 2000mg/ngày)
- eGFR 30-44: Giảm liều tối đa 1000mg/ngày, theo dõi sát
- eGFR <30: **CHỐNG CHỈ ĐỊNH** (nguy cơ nhiễm toan lactic)

### Kháng sinh Aminoglycoside (Gentamicin, Amikacin)
- eGFR ≥60: Liều bình thường
- eGFR 40-59: Giãn khoảng cách liều (mỗi 12h → mỗi 24h)
- eGFR 20-39: Giãn khoảng cách liều (mỗi 24-36h), theo dõi nồng độ thuốc
- eGFR <20: Chỉ dùng khi thật cần thiết, theo dõi nồng độ đáy bắt buộc

### NSAIDs (Ibuprofen, Diclofenac, Ketorolac)
- eGFR ≥60: Dùng ngắn ngày (<5 ngày), theo dõi Creatinine
- eGFR 30-59: Tránh dùng nếu có thể, thay bằng Paracetamol
- eGFR <30: **CHỐNG CHỈ ĐỊNH** (nguy cơ suy thận cấp, tăng kali máu)

### Enoxaparin (Clexane)
- eGFR ≥30: Liều bình thường
- eGFR <30: Giảm liều 50% hoặc dùng Heparin không phân đoạn

### Gabapentin
- eGFR ≥60: 300-600mg x 3 lần/ngày
- eGFR 30-59: 200-300mg x 2 lần/ngày
- eGFR 15-29: 200-300mg x 1 lần/ngày
- eGFR <15: 100-300mg sau mỗi lần lọc máu

## Lưu ý quan trọng
- Luôn tính eGFR trước khi kê đơn thuốc thải qua thận
- Ưu tiên công thức CKD-EPI 2021 (race-free) cho người Việt Nam
- Theo dõi Creatinine + eGFR trước và 3-5 ngày sau khởi trị thuốc mới
- Tránh phối hợp NSAIDs + ACEi/ARB + Lợi tiểu ("Triple Whammy" gây suy thận cấp)`
  }
];
