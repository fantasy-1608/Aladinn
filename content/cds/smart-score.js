/**
 * 🧮 Aladinn CDS — SmartScore Engine
 * Bộ tính thang điểm lâm sàng cấp cứu ưu tiên: GCS, qSOFA, CURB-65, Wells, Alvarado.
 * Tự động quét ICD-10 và cận lâm sàng (Ure, WBC, Neutrophil) để gợi ý và tự điền.
 */

export const SmartScoreEngine = {
    // 1. Định nghĩa bộ thang điểm
    SCORING_SYSTEMS: {
        GCS: {
            id: 'GCS',
            name: 'Thang điểm Hôn mê Glasgow (GCS)',
            description: 'Đánh giá mức độ tri giác ở bệnh nhân chấn thương sọ não hoặc hôn mê.',
            icdPrefixes: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'I60', 'I61', 'I62', 'I63', 'I64', 'I65', 'I66', 'I67', 'I68', 'I69', 'R40'],
            criteria: {
                eye: {
                    label: 'Đáp ứng mở mắt (E)',
                    type: 'select',
                    options: [
                        { val: 4, text: '4 - Tự nhiên' },
                        { val: 3, text: '3 - Khi gọi/nghe tiếng động' },
                        { val: 2, text: '2 - Khi kích thích đau' },
                        { val: 1, text: '1 - Không đáp ứng' }
                    ],
                    default: 4
                },
                verbal: {
                    label: 'Đáp ứng lời nói (V)',
                    type: 'select',
                    options: [
                        { val: 5, text: '5 - Trả lời đúng, nhanh, định hướng tốt' },
                        { val: 4, text: '4 - Trả lời lẫn lộn, ú ớ' },
                        { val: 3, text: '3 - Trả lời không phù hợp, từ vô nghĩa' },
                        { val: 2, text: '2 - Phát âm không định hình, rên rỉ' },
                        { val: 1, text: '1 - Không đáp ứng' }
                    ],
                    default: 5
                },
                motor: {
                    label: 'Đáp ứng vận động (M)',
                    type: 'select',
                    options: [
                        { val: 6, text: '6 - Làm theo lệnh đúng' },
                        { val: 5, text: '5 - Đáp ứng chính xác với kích thích đau (gạt tay)' },
                        { val: 4, text: '4 - Co tay lại khi kích thích đau' },
                        { val: 3, text: '3 - Gấp cứng chi (mất vỏ)' },
                        { val: 2, text: '2 - Duỗi cứng chi (mất não)' },
                        { val: 1, text: '1 - Không đáp ứng' }
                    ],
                    default: 6
                }
            },
            calculate: (vals) => {
                const total = Number(vals.eye || 4) + Number(vals.verbal || 5) + Number(vals.motor || 6);
                let risk = 'Bình thường';
                let rec = 'Theo dõi sát tri giác.';
                let color = 'green';
                if (total <= 8) {
                    risk = 'Chấn thương sọ não NẶNG (Hôn mê)';
                    rec = 'Chỉ định thiết lập đường thở nhân tạo (đặt nội khí quản), hồi sức tích cực.';
                    color = 'red';
                } else if (total <= 12) {
                    risk = 'Chấn thương sọ não TRUNG BÌNH';
                    rec = 'Hội chẩn chuyên khoa phẫu thuật thần kinh, chụp CT-scanner sọ não khẩn cấp.';
                    color = 'yellow';
                } else if (total <= 14) {
                    risk = 'Chấn thương sọ não NHẸ';
                    rec = 'Chụp CT sọ não nếu có chỉ định, theo dõi tri giác mỗi 1-2 giờ.';
                    color = 'yellow';
                }
                return { total, risk, rec, color };
            }
        },

        qSOFA: {
            id: 'qSOFA',
            name: 'Thang điểm qSOFA (Nhiễm khuẩn huyết)',
            description: 'Đánh giá nhanh nguy cơ tử vong do nhiễm khuẩn huyết ngoài ICU.',
            icdPrefixes: ['A40', 'A41', 'A00', 'A30', 'B95', 'B96', 'B97', 'J00', 'J10', 'J20', 'K72', 'N39', 'L03'],
            criteria: {
                resprate: { label: 'Nhịp thở ≥ 22 lần/phút', val: 1, type: 'checkbox', default: false },
                altered_mental: { label: 'Thay đổi ý thức (GCS < 15)', val: 1, type: 'checkbox', default: false },
                systolic_bp: { label: 'Huyết áp tâm thu ≤ 100 mmHg', val: 1, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = 0;
                if (vals.resprate) total += 1;
                if (vals.altered_mental) total += 1;
                if (vals.systolic_bp) total += 1;

                let risk = 'Nguy cơ thấp';
                let rec = 'Tiếp tục theo dõi lâm sàng và điều trị nhiễm trùng theo phác đồ.';
                let color = 'green';
                if (total >= 2) {
                    risk = 'Nguy cơ cao tử vong hoặc nằm viện kéo dài';
                    rec = 'Đề xuất: Tầm soát kỹ tiêu điểm nhiễm trùng, hội chẩn khoa Hồi sức tích cực (ICU), cấy máu, kháng sinh phổ rộng liều đầu khẩn cấp.';
                    color = 'red';
                }
                return { total, risk, rec, color };
            }
        },

        CURB65: {
            id: 'CURB65',
            name: 'Thang điểm CURB-65 (Độ nặng Viêm phổi)',
            description: 'Phân loại độ nặng và định hướng nơi điều trị cho viêm phổi mắc phải tại cộng đồng (CAP).',
            icdPrefixes: ['J09', 'J10', 'J11', 'J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18'],
            criteria: {
                confusion: { label: 'Confusion (Lú lẫn mới xuất hiện)', val: 1, type: 'checkbox', default: false },
                urea: { label: 'Urea máu > 7 mmol/L (hoặc BUN > 19 mg/dL)', val: 1, type: 'checkbox', default: false },
                resprate: { label: 'Respiratory rate ≥ 30 lần/phút', val: 1, type: 'checkbox', default: false },
                bloodpressure: { label: 'Huyết áp thấp (Tâm thu < 90 hoặc Tâm trương ≤ 60 mmHg)', val: 1, type: 'checkbox', default: false },
                age65: { label: 'Tuổi ≥ 65', val: 1, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = 0;
                if (vals.confusion) total += 1;
                if (vals.urea) total += 1;
                if (vals.resprate) total += 1;
                if (vals.bloodpressure) total += 1;
                if (vals.age65) total += 1;

                let risk = 'Nhóm 1 (Nhẹ, tử vong < 3%)';
                let rec = 'Đề xuất: Điều trị ngoại trú an toàn.';
                let color = 'green';
                if (total === 2) {
                    risk = 'Nhóm 2 (Trung bình, tử vong ~ 9%)';
                    rec = 'Đề xuất: Nhập viện điều trị nội trú ngắn ngày hoặc theo dõi sát tại khoa Cấp cứu.';
                    color = 'yellow';
                } else if (total >= 3) {
                    risk = 'Nhóm 3 (Nặng, tử vong 15 - 22%)';
                    rec = 'Đề xuất: Nhập viện điều trị nội trú khẩn cấp. Nếu từ 4-5 điểm, xem xét chuyển khoa Hồi sức tích cực (ICU).';
                    color = 'red';
                }
                return { total, risk, rec, color };
            }
        },

        WellsPE: {
            id: 'WellsPE',
            name: 'Thang điểm Wells cho Thuyên tắc phổi (PE)',
            description: 'Đánh giá xác suất lâm sàng bị thuyên tắc động mạch phổi cấp.',
            icdPrefixes: ['I26', 'I80', 'I81', 'I82', 'R06', 'R07'],
            criteria: {
                dvt_symptoms: { label: 'Triệu chứng lâm sàng của DVT (sưng chân, đau dọc tĩnh mạch)', val: 3.0, type: 'checkbox', default: false },
                pe_likely: { label: 'PE là chẩn đoán khả thi nhất hoặc tương đương', val: 3.0, type: 'checkbox', default: false },
                tachycardia: { label: 'Nhịp tim > 100 chu kỳ/phút', val: 1.5, type: 'checkbox', default: false },
                immobilization: { label: 'Bất động ≥ 3 ngày liên tục hoặc phẫu thuật lớn < 4 tuần trước', val: 1.5, type: 'checkbox', default: false },
                prior_pe_dvt: { label: 'Tiền sử bị DVT hoặc PE', val: 1.5, type: 'checkbox', default: false },
                hemoptysis: { label: 'Ho ra máu', val: 1.0, type: 'checkbox', default: false },
                malignancy: { label: 'Ung thư đang điều trị, điều trị giảm nhẹ hoặc phát hiện < 6 tháng trước', val: 1.0, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = 0;
                if (vals.dvt_symptoms) total += 3.0;
                if (vals.pe_likely) total += 3.0;
                if (vals.tachycardia) total += 1.5;
                if (vals.immobilization) total += 1.5;
                if (vals.prior_pe_dvt) total += 1.5;
                if (vals.hemoptysis) total += 1.0;
                if (vals.malignancy) total += 1.0;

                let risk = 'Xác suất THẤP (Lâm sàng ít khả năng PE)';
                let rec = 'Chỉ định xét nghiệm D-Dimer siêu nhạy để loại trừ thuyên tắc phổi.';
                let color = 'green';
                if (total > 6.0) {
                    risk = 'Xác suất CAO (Lâm sàng rất nghi ngờ PE)';
                    rec = 'Đề xuất: Chụp CT-Scanner đa dãy động mạch phổi có cản quang (CTPA) khẩn cấp. Cân nhắc dùng kháng đông ngay lập tức nếu không có chống chỉ định.';
                    color = 'red';
                } else if (total >= 2.0) {
                    risk = 'Xác suất TRUNG BÌNH';
                    rec = 'Đề xuất: Xét nghiệm D-Dimer nhạy cao. Nếu D-Dimer dương tính (+), chụp CTPA khẩn cấp.';
                    color = 'yellow';
                }
                return { total, risk, rec, color };
            }
        },

        Alvarado: {
            id: 'Alvarado',
            name: 'Thang điểm Alvarado (Viêm ruột thừa cấp)',
            description: 'Đánh giá khả năng bị viêm ruột thừa cấp ở bệnh nhân đau bụng cấp.',
            icdPrefixes: ['K35', 'K36', 'K37', 'K38', 'R10'],
            criteria: {
                migration: { label: 'Đau di chuyển hố chậu phải (RLQ)', val: 1, type: 'checkbox', default: false },
                anorexia: { label: 'Chán ăn hoặc có xeton niệu', val: 1, type: 'checkbox', default: false },
                nausea: { label: 'Buồn nôn hoặc Nôn', val: 1, type: 'checkbox', default: false },
                tenderness: { label: 'Phản ứng thành bụng hố chậu phải (RLQ)', val: 2, type: 'checkbox', default: false },
                rebound: { label: 'Phản ứng dội hố chậu phải (Dấu hiệu Blumberg (+))', val: 1, type: 'checkbox', default: false },
                fever: { label: 'Sốt nhẹ hoặc vừa (Nhiệt độ ≥ 37.3°C)', val: 1, type: 'checkbox', default: false },
                leukocytosis: { label: 'Tăng bạch cầu (WBC ≥ 10.0 G/L)', val: 2, type: 'checkbox', default: false },
                neutrophil_shift: { label: 'Bạch cầu đa nhân trung tính chuyển trái (Neutrophil > 75%)', val: 1, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = 0;
                if (vals.migration) total += 1;
                if (vals.anorexia) total += 1;
                if (vals.nausea) total += 1;
                if (vals.tenderness) total += 2;
                if (vals.rebound) total += 1;
                if (vals.fever) total += 1;
                if (vals.leukocytosis) total += 2;
                if (vals.neutrophil_shift) total += 1;

                let risk = 'Chưa nghi ngờ (1 - 4 điểm)';
                let rec = 'Xác suất viêm ruột thừa thấp. Đề xuất theo dõi sát lâm sàng hoặc tìm nguyên nhân đau bụng khác.';
                let color = 'green';
                if (total >= 7) {
                    risk = 'Rất nghi ngờ Viêm ruột thừa cấp (7 - 10 điểm)';
                    rec = 'Đề xuất: Hội chẩn Ngoại khoa cấp cứu ngay lập tức, siêu âm ổ bụng khẩn cấp hoặc chụp CT-Scanner ổ bụng.';
                    color = 'red';
                } else if (total >= 5) {
                    risk = 'Có khả năng Viêm ruột thừa cấp (5 - 6 điểm)';
                    rec = 'Đề xuất: Theo dõi sát lâm sàng đau bụng mỗi 2-4 giờ, làm lại công thức máu, siêu âm ổ bụng.';
                    color = 'yellow';
                }
                return { total, risk, rec, color };
            }
        },

        ChildPugh: {
            id: 'ChildPugh',
            name: 'Thang điểm Child-Pugh (Xơ gan)',
            description: 'Đánh giá tiên lượng và mức độ suy gan ở bệnh nhân xơ gan.',
            icdPrefixes: ['K70', 'K71', 'K72', 'K73', 'K74', 'K75', 'K76', 'B18'],
            criteria: {
                encephalopathy: {
                    label: 'Bệnh não gan (Hepatic Encephalopathy)',
                    type: 'select',
                    options: [
                        { val: 1, text: 'Không có' },
                        { val: 2, text: 'Độ 1 - 2 (Lú lẫn nhẹ)' },
                        { val: 3, text: 'Độ 3 - 4 (Hôn mê/Tiền hôn mê)' }
                    ],
                    default: 1
                },
                ascites: {
                    label: 'Báng bụng (Ascites)',
                    type: 'select',
                    options: [
                        { val: 1, text: 'Không có' },
                        { val: 2, text: 'Mức độ nhẹ/vừa (Đáp ứng với thuốc lợi tiểu)' },
                        { val: 3, text: 'Mức độ nhiều (Khó trị)' }
                    ],
                    default: 1
                },
                bilirubin: {
                    label: 'Bilirubin toàn phần',
                    type: 'select',
                    options: [
                        { val: 1, text: '< 2 mg/dL (< 34 µmol/L)' },
                        { val: 2, text: '2 - 3 mg/dL (34 - 50 µmol/L)' },
                        { val: 3, text: '> 3 mg/dL (> 50 µmol/L)' }
                    ],
                    default: 1
                },
                albumin: {
                    label: 'Albumin huyết thanh',
                    type: 'select',
                    options: [
                        { val: 1, text: '> 3.5 g/dL (> 35 g/L)' },
                        { val: 2, text: '2.8 - 3.5 g/dL (28 - 35 g/L)' },
                        { val: 3, text: '< 2.8 g/dL (< 28 g/L)' }
                    ],
                    default: 1
                },
                inr: {
                    label: 'PT kéo dài hoặc INR',
                    type: 'select',
                    options: [
                        { val: 1, text: 'INR < 1.7 (PT kéo dài < 4s)' },
                        { val: 2, text: 'INR 1.7 - 2.2 (PT kéo dài 4 - 6s)' },
                        { val: 3, text: 'INR > 2.2 (PT kéo dài > 6s)' }
                    ],
                    default: 1
                }
            },
            calculate: (vals) => {
                let total = Number(vals.encephalopathy || 1) + Number(vals.ascites || 1) + Number(vals.bilirubin || 1) + Number(vals.albumin || 1) + Number(vals.inr || 1);
                let risk = 'Child-Pugh A (5 - 6 điểm)';
                let rec = 'Tiên lượng bệnh gan bù trừ tốt. Thời gian sống 1-2 năm là 100% - 85%. Tỷ lệ tử vong chu phẫu < 5%.';
                let color = 'green';
                
                if (total >= 10) {
                    risk = 'Child-Pugh C (10 - 15 điểm)';
                    rec = 'Suy gan nặng (Mất bù). Thời gian sống 1-2 năm là 45% - 35%. Tỷ lệ tử vong chu phẫu rất cao (~50%). Đề xuất xem xét ghép gan.';
                    color = 'red';
                } else if (total >= 7) {
                    risk = 'Child-Pugh B (7 - 9 điểm)';
                    rec = 'Suy gan chức năng trung bình. Thời gian sống 1-2 năm là 80% - 60%. Tỷ lệ tử vong chu phẫu ~10%.';
                    color = 'yellow';
                }
                return { total, risk, rec, color };
            }
        },

        SIRS: {
            id: 'SIRS',
            name: 'Tiêu chuẩn SIRS (Hội chứng đáp ứng viêm hệ thống)',
            description: 'Đánh giá nguy cơ nhiễm trùng và nhiễm khuẩn huyết.',
            icdPrefixes: ['A40', 'A41', 'A00', 'A30', 'B95', 'B96', 'B97', 'J00', 'J10', 'J20', 'K72', 'N39', 'L03', 'R65'],
            criteria: {
                temp: { label: 'Nhiệt độ > 38°C hoặc < 36°C', val: 1, type: 'checkbox', default: false },
                hr: { label: 'Nhịp tim > 90 lần/phút', val: 1, type: 'checkbox', default: false },
                rr: { label: 'Nhịp thở > 20 lần/phút hoặc PaCO2 < 32 mmHg', val: 1, type: 'checkbox', default: false },
                wbc: { label: 'Bạch cầu > 12 G/L hoặc < 4 G/L hoặc > 10% non', val: 1, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = (vals.temp ? 1 : 0) + (vals.hr ? 1 : 0) + (vals.rr ? 1 : 0) + (vals.wbc ? 1 : 0);
                let risk = 'Bình thường (0 - 1 điểm)';
                let rec = 'Không đủ tiêu chuẩn SIRS.';
                let color = 'green';
                if (total >= 2) {
                    risk = 'Thỏa tiêu chuẩn SIRS (≥ 2 điểm)';
                    rec = 'Cảnh báo hội chứng đáp ứng viêm hệ thống. Hãy tìm kiếm tiêu điểm nhiễm trùng, đánh giá nguy cơ Sepsis.';
                    color = 'red';
                }
                return { total, risk, rec, color };
            }
        },

        HEART: {
            id: 'HEART',
            name: 'Thang điểm HEART (Đau ngực cấp)',
            description: 'Phân tầng nguy cơ biến cố tim mạch chính (MACE) trong 6 tuần ở bệnh nhân đau ngực cấp.',
            icdPrefixes: ['I20', 'I21', 'I22', 'I24', 'I25', 'R07'],
            criteria: {
                history: {
                    label: 'Tiền sử lâm sàng (History)',
                    type: 'select',
                    options: [
                        { val: 0, text: 'Ít nghi ngờ' },
                        { val: 1, text: 'Nghi ngờ trung bình' },
                        { val: 2, text: 'Rất nghi ngờ' }
                    ],
                    default: 0
                },
                ecg: {
                    label: 'Điện tâm đồ (ECG)',
                    type: 'select',
                    options: [
                        { val: 0, text: 'Bình thường' },
                        { val: 1, text: 'Rối loạn tái cực không đặc hiệu' },
                        { val: 2, text: 'ST chênh xuống rõ rệt' }
                    ],
                    default: 0
                },
                age: {
                    label: 'Độ tuổi (Age)',
                    type: 'select',
                    options: [
                        { val: 0, text: '< 45 tuổi' },
                        { val: 1, text: '45 - 64 tuổi' },
                        { val: 2, text: '≥ 65 tuổi' }
                    ],
                    default: 0
                },
                risk: {
                    label: 'Yếu tố nguy cơ (Risk factors)',
                    type: 'select',
                    options: [
                        { val: 0, text: 'Không có' },
                        { val: 1, text: '1 - 2 yếu tố' },
                        { val: 2, text: '≥ 3 yếu tố hoặc có tiền sử tim mạch' }
                    ],
                    default: 0
                },
                trop: {
                    label: 'Troponin',
                    type: 'select',
                    options: [
                        { val: 0, text: 'Trong giới hạn bình thường' },
                        { val: 1, text: '1 - 3 lần giới hạn trên' },
                        { val: 2, text: '> 3 lần giới hạn trên' }
                    ],
                    default: 0
                }
            },
            calculate: (vals) => {
                let total = Number(vals.history || 0) + Number(vals.ecg || 0) + Number(vals.age || 0) + Number(vals.risk || 0) + Number(vals.trop || 0);
                let risk = 'Nguy cơ THẤP (0 - 3 điểm)';
                let rec = 'Xác suất MACE < 2%. Có thể an tâm cho xuất viện hoặc theo dõi ngoại trú.';
                let color = 'green';
                if (total >= 7) {
                    risk = 'Nguy cơ CAO (7 - 10 điểm)';
                    rec = 'Xác suất MACE 50 - 65%. Cần nhập viện can thiệp tim mạch khẩn cấp / theo dõi sát.';
                    color = 'red';
                } else if (total >= 4) {
                    risk = 'Nguy cơ TRUNG BÌNH (4 - 6 điểm)';
                    rec = 'Xác suất MACE 12 - 16%. Cần nhập viện để theo dõi và khảo sát thêm.';
                    color = 'yellow';
                }
                return { total, risk, rec, color };
            }
        },

        NIHSS: {
            id: 'NIHSS',
            name: 'Thang điểm NIHSS (Đột quỵ cấp)',
            description: 'Đánh giá độ nặng của đột quỵ thiếu máu não cấp.',
            icdPrefixes: ['I60', 'I61', 'I62', 'I63', 'I64', 'G45', 'G46'],
            criteria: {
                loc: { label: 'Mức độ nhận thức (1a,b,c)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}, {val:3, text:'3'}], default: 0 },
                gaze: { label: 'Vận động nhãn cầu (2)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}], default: 0 },
                visual: { label: 'Thị trường (3)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}, {val:3, text:'3'}], default: 0 },
                facial: { label: 'Liệt mặt (4)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}, {val:3, text:'3'}], default: 0 },
                motorArmL: { label: 'Vận động tay trái (5a)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}, {val:3, text:'3'}, {val:4, text:'4'}], default: 0 },
                motorArmR: { label: 'Vận động tay phải (5b)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}, {val:3, text:'3'}, {val:4, text:'4'}], default: 0 },
                motorLegL: { label: 'Vận động chân trái (6a)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}, {val:3, text:'3'}, {val:4, text:'4'}], default: 0 },
                motorLegR: { label: 'Vận động chân phải (6b)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}, {val:3, text:'3'}, {val:4, text:'4'}], default: 0 },
                ataxia: { label: 'Mất điều hòa chi (7)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}], default: 0 },
                sensory: { label: 'Cảm giác (8)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}], default: 0 },
                language: { label: 'Ngôn ngữ (9)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}, {val:3, text:'3'}], default: 0 },
                dysarthria: { label: 'Cấu âm (10)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}], default: 0 },
                extinction: { label: 'Bỏ rơi/Không chú ý (11)', type: 'select', options: [{val:0, text:'0'}, {val:1, text:'1'}, {val:2, text:'2'}], default: 0 }
            },
            calculate: (vals) => {
                let total = 0;
                Object.values(vals).forEach(v => total += Number(v || 0));
                let risk = 'Đột quỵ Nhẹ (1 - 4 điểm)';
                let color = 'green';
                let rec = 'Cân nhắc tiêu sởi huyết (rtPA) tùy tình trạng lâm sàng.';
                if (total === 0) { risk = 'Không có triệu chứng đột quỵ (0 điểm)'; }
                else if (total > 20) { risk = 'Đột quỵ Rất Nặng (> 20 điểm)'; color = 'red'; rec = 'Đột quỵ rất nặng. Xem xét chống chỉ định rtPA nếu nhồi máu diện rộng.'; }
                else if (total > 15) { risk = 'Đột quỵ Nặng (16 - 20 điểm)'; color = 'red'; rec = 'Cân nhắc tiêu sởi huyết / lấy huyết khối bằng dụng cụ cơ học.'; }
                else if (total > 4) { risk = 'Đột quỵ Trung Bình (5 - 15 điểm)'; color = 'yellow'; rec = 'Chỉ định tốt cho thuốc tiêu sởi huyết đường tĩnh mạch (nếu trong cửa sổ).'; }
                return { total, risk, rec, color };
            }
        },

        ABCD2: {
            id: 'ABCD2',
            name: 'Thang điểm ABCD2 (TIA)',
            description: 'Đánh giá nguy cơ đột quỵ sau Cơn thiếu máu não cục bộ thoáng qua.',
            icdPrefixes: ['G45', 'G46'],
            criteria: {
                age: { label: 'Tuổi ≥ 60', val: 1, type: 'checkbox', default: false },
                bp: { label: 'Huyết áp ≥ 140/90 mmHg', val: 1, type: 'checkbox', default: false },
                clinical: { label: 'Triệu chứng lâm sàng', type: 'select', options: [ {val:0, text:'Không có liệt hay rối loạn ngôn ngữ'}, {val:1, text:'Rối loạn ngôn ngữ, không yếu liệt'}, {val:2, text:'Yếu liệt nửa người'} ], default: 0 },
                duration: { label: 'Thời gian kéo dài', type: 'select', options: [ {val:0, text:'< 10 phút'}, {val:1, text:'10 - 59 phút'}, {val:2, text:'≥ 60 phút'} ], default: 0 },
                diabetes: { label: 'Đái tháo đường (Tiền sử)', val: 1, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = (vals.age ? 1 : 0) + (vals.bp ? 1 : 0) + (vals.diabetes ? 1 : 0) + Number(vals.clinical || 0) + Number(vals.duration || 0);
                let risk = 'Nguy cơ THẤP (0 - 3 điểm)'; let color = 'green'; let rec = 'Nguy cơ đột quỵ trong 2 ngày là 1%. Đánh giá và điều trị ngoại trú.';
                if (total >= 6) { risk = 'Nguy cơ CAO (6 - 7 điểm)'; color = 'red'; rec = 'Nguy cơ đột quỵ trong 2 ngày là 8%. Nhập viện và đánh giá khẩn cấp.'; }
                else if (total >= 4) { risk = 'Nguy cơ TRUNG BÌNH (4 - 5 điểm)'; color = 'yellow'; rec = 'Nguy cơ đột quỵ trong 2 ngày là 4%. Nhập viện để theo dõi.'; }
                return { total, risk, rec, color };
            }
        },

        BISAP: {
            id: 'BISAP',
            name: 'Thang điểm BISAP (Viêm tụy cấp)',
            description: 'Đánh giá nguy cơ tử vong ở bệnh nhân viêm tụy cấp.',
            icdPrefixes: ['K85', 'R10'],
            criteria: {
                bun: { label: 'BUN > 25 mg/dL (> 8.9 mmol/L)', val: 1, type: 'checkbox', default: false },
                impairedStatus: { label: 'Rối loạn tri giác', val: 1, type: 'checkbox', default: false },
                sirs: { label: 'Thỏa ≥ 2 tiêu chuẩn SIRS', val: 1, type: 'checkbox', default: false },
                age: { label: 'Tuổi > 60', val: 1, type: 'checkbox', default: false },
                pleuralEffusion: { label: 'Tràn dịch màng phổi', val: 1, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = (vals.bun ? 1 : 0) + (vals.impairedStatus ? 1 : 0) + (vals.sirs ? 1 : 0) + (vals.age ? 1 : 0) + (vals.pleuralEffusion ? 1 : 0);
                let risk = 'Tỷ lệ tử vong < 1% (0 - 2 điểm)'; let color = 'green'; let rec = 'Viêm tụy cấp mức độ nhẹ/trung bình.';
                if (total >= 3) { risk = 'Tỷ lệ tử vong 5% - 22% (≥ 3 điểm)'; color = 'red'; rec = 'Viêm tụy cấp NẶNG. Cần theo dõi sát tại khu vực Hồi sức tích cực (ICU).'; }
                return { total, risk, rec, color };
            }
        },

        GBS: {
            id: 'GBS',
            name: 'Thang điểm Glasgow-Blatchford (XHTH)',
            description: 'Phân tầng nguy cơ Xuất huyết tiêu hóa trên trước khi nội soi.',
            icdPrefixes: ['K92.2', 'K25', 'K26', 'K27', 'K28', 'I85'],
            criteria: {
                bun: { label: 'BUN (mmol/L)', type: 'select', options: [{val:0, text:'< 6.5'}, {val:2, text:'6.5 - 7.9'}, {val:3, text:'8.0 - 9.9'}, {val:4, text:'10.0 - 24.9'}, {val:6, text:'≥ 25.0'}], default: 0 },
                hgbM: { label: 'Hemoglobin Nam (g/L)', type: 'select', options: [{val:0, text:'≥ 130'}, {val:1, text:'120 - 129'}, {val:3, text:'100 - 119'}, {val:6, text:'< 100'}], default: 0 },
                hgbF: { label: 'Hemoglobin Nữ (g/L)', type: 'select', options: [{val:0, text:'≥ 120'}, {val:1, text:'100 - 119'}, {val:6, text:'< 100'}], default: 0 },
                sbp: { label: 'Huyết áp tâm thu (mmHg)', type: 'select', options: [{val:0, text:'≥ 110'}, {val:1, text:'100 - 109'}, {val:2, text:'90 - 99'}, {val:3, text:'< 90'}], default: 0 },
                pulse: { label: 'Nhịp tim ≥ 100 lần/phút', val: 1, type: 'checkbox', default: false },
                melena: { label: 'Tiêu phân đen', val: 1, type: 'checkbox', default: false },
                syncope: { label: 'Ngất', val: 2, type: 'checkbox', default: false },
                hepatic: { label: 'Bệnh gan', val: 2, type: 'checkbox', default: false },
                cardiac: { label: 'Suy tim', val: 2, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = Number(vals.bun||0) + Math.max(Number(vals.hgbM||0), Number(vals.hgbF||0)) + Number(vals.sbp||0) + (vals.pulse?1:0) + (vals.melena?1:0) + (vals.syncope?2:0) + (vals.hepatic?2:0) + (vals.cardiac?2:0);
                let risk = 'Nguy cơ RẤT THẤP (0 điểm)'; let color = 'green'; let rec = 'Cân nhắc điều trị ngoại trú, nội soi chương trình.';
                if (total > 0) { risk = 'CÓ Nguy cơ (≥ 1 điểm)'; color = 'red'; rec = 'Cần nhập viện, hồi sức nội khoa, truyền máu (nếu cần) và nội soi tiêu hóa can thiệp.'; }
                return { total, risk, rec, color };
            }
        },

        Ottawa: {
            id: 'Ottawa',
            name: 'Tiêu chuẩn Ottawa (Cổ chân/Bàn chân)',
            description: 'Chỉ định chụp X-Quang cổ chân và bàn chân do chấn thương.',
            icdPrefixes: ['S80', 'S81', 'S82', 'S83', 'S90', 'S91', 'S92', 'S93'],
            criteria: {
                malleolus: { label: 'Đau xương vùng 6cm bờ sau mắt cá trong/ngoài', val: 1, type: 'checkbox', default: false },
                midfoot: { label: 'Đau xương vùng sên thuyền hoặc đáy xương bàn V', val: 1, type: 'checkbox', default: false },
                weight: { label: 'Không thể đi bước chịu lực (ngay sau chấn thương và lúc khám)', val: 1, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let risk = 'KHÔNG cần X-Quang'; let color = 'green'; let rec = 'Chỉ định X-Quang không mang lại nhiều giá trị, chủ yếu tổn thương phần mềm.';
                if (vals.malleolus || vals.midfoot || vals.weight) { risk = 'CÓ CHỈ ĐỊNH X-Quang'; color = 'red'; rec = 'Có nguy cơ gãy xương. Đề nghị chụp X-Quang cổ chân/bàn chân thẳng nghiêng.'; }
                return { total: (vals.malleolus?1:0)+(vals.midfoot?1:0)+(vals.weight?1:0), risk, rec, color };
            }
        },

        NEXUS: {
            id: 'NEXUS',
            name: 'Tiêu chuẩn NEXUS (Cột sống cổ)',
            description: 'Đánh giá lâm sàng loại trừ chấn thương cột sống cổ, tránh X-Quang không cần thiết.',
            icdPrefixes: ['S01', 'S02', 'S03', 'S04', 'S05', 'S06', 'S07', 'S08', 'S09', 'S10', 'S11', 'S12', 'S13', 'S14', 'T08', 'T09'],
            criteria: {
                tenderness: { label: 'Đau chói đường giữa cột sống cổ', val: 1, type: 'checkbox', default: false },
                neuro: { label: 'Khiếm khuyết thần kinh khu trú', val: 1, type: 'checkbox', default: false },
                loc: { label: 'Rối loạn tri giác (GCS < 15, say xỉn...)', val: 1, type: 'checkbox', default: false },
                intoxication: { label: 'Dấu hiệu nhiễm độc (Rượu, ma túy)', val: 1, type: 'checkbox', default: false },
                distracting: { label: 'Chấn thương đau đớn khác làm phân tâm', val: 1, type: 'checkbox', default: false }
            },
            calculate: (vals) => {
                let total = (vals.tenderness?1:0) + (vals.neuro?1:0) + (vals.loc?1:0) + (vals.intoxication?1:0) + (vals.distracting?1:0);
                let risk = 'ĐỦ TIÊU CHUẨN LOẠI TRỪ (0 điểm)'; let color = 'green'; let rec = 'Nguy cơ chấn thương cột sống cổ rất thấp. Có thể tháo nẹp cổ, KHÔNG cần X-Quang.';
                if (total > 0) { risk = 'KHÔNG THỂ LOẠI TRỪ (≥ 1 điểm)'; color = 'red'; rec = 'Yêu cầu bất động cột sống cổ và chụp phim (X-Quang hoặc CT) để khảo sát tổn thương.'; }
                return { total, risk, rec, color };
            }
        }
    },

    // 2. Phân tích ngữ cảnh bệnh nhân (ICD-10, cận lâm sàng, tuổi)
    evaluatePatientContext(context) {
        const evaluations = {};
        const diagnoses = context?.encounter?.diagnoses || [];
        const labs = context?.labs || [];

        // Trích xuất tuổi từ bệnh nhân
        let patientAge = 0;
        if (context?.patient) {
            // Thử lấy năm sinh hoặc tuổi từ string
            const ageStr = context.patient.age || '';
            const ageMatch = String(ageStr).match(/(\d+)\s*(tuổi|t|y)/i) || String(ageStr).match(/^(\d+)$/);
            if (ageMatch) {
                patientAge = parseInt(ageMatch[1]);
            }
        }

        // Lấy các mã ICD của bệnh nhân
        const icdCodes = diagnoses.map(d => String(d.code || '').trim().toUpperCase()).filter(Boolean);

        // Lấy cận lâm sàng
        const labMap = {};
        labs.forEach(lab => {
            if (lab.code) {
                labMap[lab.code] = lab;
            }
        });

        // Đánh giá từng thang điểm
        Object.entries(this.SCORING_SYSTEMS).forEach(([id, sys]) => {
            const ev = {
                id,
                suggested: false,
                prefilled: {}
            };

            // a. Kiểm tra gợi ý dựa trên ICD-10
            const hasMatchingIcd = icdCodes.some(code => 
                sys.icdPrefixes.some(pref => code.startsWith(pref))
            );
            if (hasMatchingIcd) {
                ev.suggested = true;
            }

            // b. Tự động điền dữ liệu khách quan (Cận lâm sàng, Tuổi)
            ev.missingLabs = {};
            
            if (id === 'CURB65') {
                if (patientAge > 0) {
                    ev.prefilled.age65 = patientAge >= 65;
                }
                const ureaLab = labMap['urea'];
                if (ureaLab) {
                    const val = ureaLab.value;
                    const unit = String(ureaLab.unit || '').toLowerCase();
                    let threshold = 7.0;
                    if (unit.includes('mg') || unit.includes('dl')) threshold = 42.8;
                    ev.prefilled.urea = val > threshold;
                } else {
                    ev.missingLabs.urea = true;
                }
            } else if (id === 'Alvarado') {
                const wbcLab = labMap['WBC'] || labMap['wbc'];
                if (wbcLab) {
                    ev.prefilled.leukocytosis = wbcLab.value >= 10.0;
                } else {
                    ev.missingLabs.leukocytosis = true;
                }
                const neutLab = labMap['neutrophil'] || labMap['NEUT'];
                if (neutLab) {
                    ev.prefilled.neutrophil_shift = neutLab.value > 75.0;
                } else {
                    ev.missingLabs.neutrophil_shift = true;
                }
            } else if (id === 'ChildPugh') {
                const biliLab = labMap['bilirubin'] || labMap['BiliT'] || labMap['Bilirubin toàn phần'];
                if (biliLab) {
                    const val = biliLab.value;
                    const unit = String(biliLab.unit || '').toLowerCase();
                    let v1 = 34, v2 = 50; // umol/L mặc định
                    if (unit.includes('mg') || unit.includes('dl')) { v1 = 2; v2 = 3; }
                    if (val < v1) ev.prefilled.bilirubin = 1;
                    else if (val <= v2) ev.prefilled.bilirubin = 2;
                    else ev.prefilled.bilirubin = 3;
                } else {
                    ev.missingLabs.bilirubin = true;
                }

                const albLab = labMap['albumin'] || labMap['Albumin'];
                if (albLab) {
                    const val = albLab.value;
                    const unit = String(albLab.unit || '').toLowerCase();
                    let v1 = 35, v2 = 28; // g/L mặc định
                    if (unit.includes('dl')) { v1 = 3.5; v2 = 2.8; }
                    if (val > v1) ev.prefilled.albumin = 1;
                    else if (val >= v2) ev.prefilled.albumin = 2;
                    else ev.prefilled.albumin = 3;
                } else {
                    ev.missingLabs.albumin = true;
                }

                const inrLab = labMap['inr'] || labMap['INR'] || labMap['PT'];
                if (inrLab) {
                    const val = inrLab.value;
                    if (val < 1.7) ev.prefilled.inr = 1;
                    else if (val <= 2.2) ev.prefilled.inr = 2;
                    else ev.prefilled.inr = 3;
                } else {
                    ev.missingLabs.inr = true;
                }
            } else if (id === 'SIRS') {
                const wbcLab = labMap['WBC'] || labMap['wbc'];
                if (wbcLab) {
                    ev.prefilled.wbc = (wbcLab.value > 12.0 || wbcLab.value < 4.0);
                } else {
                    ev.missingLabs.wbc = true;
                }
            } else if (id === 'HEART') {
                if (patientAge > 0) {
                    if (patientAge >= 65) ev.prefilled.age = 2;
                    else if (patientAge >= 45) ev.prefilled.age = 1;
                    else ev.prefilled.age = 0;
                }
            } else if (id === 'ABCD2') {
                if (patientAge > 0) {
                    ev.prefilled.age = patientAge >= 60;
                }
            } else if (id === 'BISAP') {
                if (patientAge > 0) {
                    ev.prefilled.age = patientAge > 60;
                }
                const bunLab = labMap['BUN'] || labMap['bun'] || labMap['urea'];
                if (bunLab) {
                    const val = bunLab.value;
                    const unit = String(bunLab.unit || '').toLowerCase();
                    let threshold = 8.9; // mmol/L
                    if (unit.includes('mg') || unit.includes('dl')) threshold = 25;
                    ev.prefilled.bun = val > threshold;
                } else {
                    ev.missingLabs.bun = true;
                }
            } else if (id === 'GBS') {
                const bunLab = labMap['BUN'] || labMap['bun'] || labMap['urea'];
                if (bunLab) {
                    let val = bunLab.value; // convert to mmol/L for logic
                    const unit = String(bunLab.unit || '').toLowerCase();
                    if (unit.includes('mg') || unit.includes('dl')) val = val / 2.8; 
                    if (val >= 25.0) ev.prefilled.bun = 6;
                    else if (val >= 10.0) ev.prefilled.bun = 4;
                    else if (val >= 8.0) ev.prefilled.bun = 3;
                    else if (val >= 6.5) ev.prefilled.bun = 2;
                    else ev.prefilled.bun = 0;
                } else {
                    ev.missingLabs.bun = true;
                }

                const hgbLab = labMap['HGB'] || labMap['hgb'] || labMap['Hemoglobin'];
                if (hgbLab) {
                    const val = hgbLab.value; // expected in g/L
                    // GBS doesn't strictly know gender from context here, we can set both M and F fields,
                    // but the calculate logic uses Math.max, so we can just set both based on the value to be safe.
                    if (val < 100) { ev.prefilled.hgbM = 6; ev.prefilled.hgbF = 6; }
                    else if (val < 120) { ev.prefilled.hgbM = 3; ev.prefilled.hgbF = 1; }
                    else if (val < 130) { ev.prefilled.hgbM = 1; ev.prefilled.hgbF = 0; }
                    else { ev.prefilled.hgbM = 0; ev.prefilled.hgbF = 0; }
                } else {
                    ev.missingLabs.hgbM = true;
                    ev.missingLabs.hgbF = true;
                }
            }

            evaluations[id] = ev;
        });

        return evaluations;
    },

    // 3. Xuất chuỗi văn bản mô tả kết quả thang điểm lâm sàng (Chuẩn y học)
    generateDescription(scoreId, values, totalScore, riskLevel, recommendation) {
        const sys = this.SCORING_SYSTEMS[scoreId];
        if (!sys) return '';

        let details = [];
        if (scoreId === 'GCS') {
            const eyeVal = values.eye || 4;
            const verbalVal = values.verbal || 5;
            const motorVal = values.motor || 6;
            
            const eyeOpt = sys.criteria.eye.options.find(o => o.val === Number(eyeVal))?.text || '';
            const verbalOpt = sys.criteria.verbal.options.find(o => o.val === Number(verbalVal))?.text || '';
            const motorOpt = sys.criteria.motor.options.find(o => o.val === Number(motorVal))?.text || '';

            details.push(`Mở mắt (E): ${eyeOpt}`);
            details.push(`Lời nói (V): ${verbalOpt}`);
            details.push(`Vận động (M): ${motorOpt}`);
        } else {
            Object.entries(sys.criteria).forEach(([k, crit]) => {
                const isSelected = !!values[k];
                details.push(`${crit.label}: ${isSelected ? 'Có (+)' : 'Không (-)'}`);
            });
        }

        return `[ALADINN SMART-SCORE] ${sys.name}
- Chi tiết: ${details.join('; ')}
- Tổng điểm: ${totalScore} điểm
- Đánh giá nguy cơ: ${riskLevel}
- Khuyến cáo: ${recommendation}
- Ngày thực hiện: ${new Date().toLocaleDateString('vi-VN')} ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`;
    }
};
