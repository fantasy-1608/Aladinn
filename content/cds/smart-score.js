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
            icdPrefixes: ['S06', 'I60', 'I61', 'I62', 'I63', 'I64', 'I65', 'I66', 'I67', 'I68', 'I69', 'R40'],
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
                if (total <= 8) {
                    risk = 'Chấn thương sọ não NẶNG (Hôn mê)';
                    rec = 'Chỉ định thiết lập đường thở nhân tạo (đặt nội khí quản), hồi sức tích cực.';
                } else if (total <= 12) {
                    risk = 'Chấn thương sọ não TRUNG BÌNH';
                    rec = 'Hội chẩn chuyên khoa phẫu thuật thần kinh, chụp CT-scanner sọ não khẩn cấp.';
                } else if (total <= 14) {
                    risk = 'Chấn thương sọ não NHẸ';
                    rec = 'Chụp CT sọ não nếu có chỉ định, theo dõi tri giác mỗi 1-2 giờ.';
                }
                return { total, risk, rec };
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
                if (total >= 2) {
                    risk = 'Nguy cơ cao tử vong hoặc nằm viện kéo dài';
                    rec = 'Đề xuất: Tầm soát kỹ tiêu điểm nhiễm trùng, hội chẩn khoa Hồi sức tích cực (ICU), cấy máu, kháng sinh phổ rộng liều đầu khẩn cấp.';
                }
                return { total, risk, rec };
            }
        },

        CURB65: {
            id: 'CURB65',
            name: 'Thang điểm CURB-65 (Độ nặng Viêm phổi)',
            description: 'Phân loại độ nặng và định hướng nơi điều trị cho viêm phổi mắc phải tại cộng đồng (CAP).',
            icdPrefixes: ['J12', 'J13', 'J14', 'J15', 'J16', 'J17', 'J18'],
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
                if (total === 2) {
                    risk = 'Nhóm 2 (Trung bình, tử vong ~ 9%)';
                    rec = 'Đề xuất: Nhập viện điều trị nội trú ngắn ngày hoặc theo dõi sát tại khoa Cấp cứu.';
                } else if (total >= 3) {
                    risk = 'Nhóm 3 (Nặng, tử vong 15 - 22%)';
                    rec = 'Đề xuất: Nhập viện điều trị nội trú khẩn cấp. Nếu từ 4-5 điểm, xem xét chuyển khoa Hồi sức tích cực (ICU).';
                }
                return { total, risk, rec };
            }
        },

        WellsPE: {
            id: 'WellsPE',
            name: 'Thang điểm Wells cho Thuyên tắc phổi (PE)',
            description: 'Đánh giá xác suất lâm sàng bị thuyên tắc động mạch phổi cấp.',
            icdPrefixes: ['I26', 'I80', 'I81', 'I82'],
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
                if (total > 6.0) {
                    risk = 'Xác suất CAO (Lâm sàng rất nghi ngờ PE)';
                    rec = 'Đề xuất: Chụp CT-Scanner đa dãy động mạch phổi có cản quang (CTPA) khẩn cấp. Cân nhắc dùng kháng đông ngay lập tức nếu không có chống chỉ định.';
                } else if (total >= 2.0) {
                    risk = 'Xác suất TRUNG BÌNH';
                    rec = 'Đề xuất: Xét nghiệm D-Dimer nhạy cao. Nếu D-Dimer dương tính (+), chụp CTPA khẩn cấp.';
                }
                return { total, risk, rec };
            }
        },

        Alvarado: {
            id: 'Alvarado',
            name: 'Thang điểm Alvarado (Viêm ruột thừa cấp)',
            description: 'Đánh giá khả năng bị viêm ruột thừa cấp ở bệnh nhân đau bụng cấp.',
            icdPrefixes: ['K35', 'K36', 'K37', 'K38', 'R10.3'],
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
                if (total >= 7) {
                    risk = 'Rất nghi ngờ Viêm ruột thừa cấp (7 - 10 điểm)';
                    rec = 'Đề xuất: Hội chẩn Ngoại khoa cấp cứu ngay lập tức, siêu âm ổ bụng khẩn cấp hoặc chụp CT-Scanner ổ bụng.';
                } else if (total >= 5) {
                    risk = 'Có khả năng Viêm ruột thừa cấp (5 - 6 điểm)';
                    rec = 'Đề xuất: Theo dõi sát lâm sàng đau bụng mỗi 2-4 giờ, làm lại công thức máu, siêu âm ổ bụng.';
                }
                return { total, risk, rec };
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

            // b. Tự động điền dữ liệu dựa trên cận lâm sàng và tuổi
            if (id === 'CURB65') {
                // Tuổi
                if (patientAge >= 65) {
                    ev.prefilled.age65 = true;
                }
                // Ure máu
                const ureaLab = labMap['urea'];
                if (ureaLab) {
                    // Nếu là mmol/L, ngưỡng là > 7.0
                    // Nếu là mg/dL, ngưỡng là > 42.8
                    const val = ureaLab.value;
                    const unit = String(ureaLab.unit || '').toLowerCase();
                    if (unit.includes('mg') || unit.includes('dl')) {
                        if (val > 42.8) ev.prefilled.urea = true;
                    } else {
                        // Mặc định mmol/L
                        if (val > 7.0) ev.prefilled.urea = true;
                    }
                }
            } else if (id === 'Alvarado') {
                // Tăng bạch cầu WBC >= 10.0 G/L
                const wbcLab = labMap['WBC'];
                if (wbcLab) {
                    if (wbcLab.value >= 10.0) {
                        ev.prefilled.leukocytosis = true;
                    }
                }
                // Bạch cầu đa nhân trung tính chuyển trái Neutrophil > 75%
                const neutLab = labMap['neutrophil'];
                if (neutLab) {
                    if (neutLab.value > 75.0) {
                        ev.prefilled.neutrophil_shift = true;
                    }
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
