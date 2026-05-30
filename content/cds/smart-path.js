/**
 * 🗺️ Aladinn CDS — SmartPath Engine
 * Phác đồ lâm sàng chuẩn theo mã ICD-10 (Tắt mặc định)
 * Cung cấp cơ sở dữ liệu phác đồ chuẩn và mapper dựa trên chẩn đoán ICD-10 của bệnh nhân.
 */

export const SmartPathEngine = {
    // 1. Feature Toggle mặc định (Tắt để đảm bảo an toàn lâm sàng và không hiển thị giao diện khi chưa kích hoạt)
    enabled: false,

    // 2. Cơ sở dữ liệu phác đồ điều trị chuẩn ICD-10 (Dữ liệu chuẩn y khoa Việt Nam)
    GUIDELINES_DATABASE: {
        'J44': {
            name: 'Phác đồ Điều trị Bệnh phổi tắc nghẽn mạn tính (COPD)',
            icd10: 'J44',
            recommendations: {
                drugs: [
                    { name: 'Salbutamol / Ipratropium (SABA/SAMA)', note: 'Cắt cơn khi khó thở hoặc có đợt cấp' },
                    { name: 'Tiotropium (LAMA)', note: 'Duy trì hàng ngày lâu dài để cải thiện chức năng phổi và ngừa đợt cấp' },
                    { name: 'Budesonide / Formoterol (ICS/LABA)', note: 'Chỉ định khi có chỉ số eosinophil máu > 300 tế bào/uL hoặc đợt cấp thường xuyên' }
                ],
                labs: [
                    { name: 'Đo chức năng hô hấp (Hô hấp ký)', note: 'Đánh giá mức độ tắc nghẽn đường thở (FEV1) để phân độ GOLD' },
                    { name: 'Chụp X-quang ngực thẳng', note: 'Loại trừ các biến chứng hoặc bệnh phổi phối hợp (lao, giãn phế quản, suy tim)' },
                    { name: 'Công thức máu (Eosinophil)', note: 'Xác định tỷ lệ bạch cầu ái toan để định hướng điều trị ICS' }
                ],
                guidelines: [
                    'Khuyến cáo tiêm phòng cúm hàng năm và phế cầu mỗi 5 năm để giảm tỷ lệ đợt cấp.',
                    'Hướng dẫn kỹ thuật sử dụng dụng cụ hít (MDI, DPI) đúng cách và kiểm tra lại kỹ thuật ở mỗi lần tái khám.',
                    'Khuyên bệnh nhân cai thuốc lá tuyệt đối và tập phục hồi chức năng hô hấp sớm.'
                ]
            }
        },
        'I10': {
            name: 'Phác đồ Điều trị Tăng huyết áp vô căn (Essential Hypertension)',
            icd10: 'I10',
            recommendations: {
                drugs: [
                    { name: 'Amlodipine (CCB)', note: 'Liều khởi đầu thông thường 5mg/ngày, theo dõi phù cổ chân' },
                    { name: 'Lisinopril / Perindopril (ACEi)', note: 'Kháng thụ thể ACE, bảo vệ thận, ưu tiên cho bệnh nhân đái tháo đường' },
                    { name: 'Losartan / Telmisartan (ARB)', note: 'Lựa chọn thay thế tối ưu nếu bệnh nhân bị ho khan do thuốc ức chế men chuyển' }
                ],
                labs: [
                    { name: 'Điện tâm đồ (ECG)', note: 'Tầm soát biến chứng phì đại thất trái hoặc rối loạn nhịp tim' },
                    { name: 'Định lượng Creatinin máu & GFR', note: 'Đánh giá chức năng thận nền tảng trước khi bắt đầu dùng ACEi/ARB' },
                    { name: 'Xét nghiệm Tổng phân tích nước tiểu', note: 'Tầm soát protein niệu hoặc microalbumin niệu' }
                ],
                guidelines: [
                    'Mục tiêu huyết áp điều trị: < 130/80 mmHg đối với đa số bệnh nhân nếu dung nạp tốt.',
                    'Khuyến cáo chế độ ăn giảm muối (< 5g muối/ngày), tăng cường rau xanh, trái cây và giảm mỡ động vật (chế độ ăn DASH).',
                    'Duy trì hoạt động thể lực đều đặn (aerobic ít nhất 30 phút mỗi ngày, 5-7 ngày mỗi tuần) và giảm cân nếu thừa cân.'
                ]
            }
        },
        'E11': {
            name: 'Phác đồ Điều trị Đái tháo đường Type 2',
            icd10: 'E11',
            recommendations: {
                drugs: [
                    { name: 'Metformin', note: 'Lựa chọn đầu tay kinh điển nếu không có chống chỉ định (chống chỉ định khi eGFR < 30 ml/phút)' },
                    { name: 'Gliclazide (Sulfonylurea)', note: 'Kích thích tụy tiết insulin, cân nhắc khi Metformin không kiểm soát đủ đường huyết' },
                    { name: 'Empagliflozin / Dapagliflozin (SGLT2i)', note: 'Ưu tiên khi bệnh nhân có suy tim, bệnh thận mạn hoặc bệnh tim mạch xơ vữa' }
                ],
                labs: [
                    { name: 'Xét nghiệm HbA1c', note: 'Thực hiện mỗi 3-6 tháng để đánh giá hiệu quả kiểm soát đường huyết trung bình' },
                    { name: 'Định lượng Creatinin & tính eGFR', note: 'Đánh giá chức năng thận định kỳ ít nhất một lần mỗi năm' },
                    { name: 'Định lượng Lipid máu toàn bộ', note: 'Theo dõi Cholesterol, LDL-C, HDL-C và Triglycerid để quản lý nguy cơ tim mạch' }
                ],
                guidelines: [
                    'Mục tiêu HbA1c chung: < 7.0%. Cần cá thể hóa mục tiêu cao hơn ở người cao tuổi hoặc có nhiều biến chứng nặng.',
                    'Tầm soát biến chứng mắt bằng cách chụp ảnh đáy mắt hàng năm để phát hiện sớm bệnh võng mạc đái tháo đường.',
                    'Hướng dẫn kỹ lưỡng việc tự kiểm tra và chăm sóc bàn chân hàng ngày để ngăn ngừa loét nhiễm trùng.'
                ]
            }
        },
        'J18': {
            name: 'Phác đồ Điều trị Viêm phổi mắc phải tại cộng đồng (CAP)',
            icd10: 'J18',
            recommendations: {
                drugs: [
                    { name: 'Amoxicillin / Acid Clavulanic', note: 'Kháng sinh beta-lactam + ức chế beta-lactamase lựa chọn đầu tay cho thể nhẹ điều trị ngoại trú' },
                    { name: 'Azithromycin / Clarithromycin (Macrolide)', note: 'Phối hợp với beta-lactam bao phủ vi khuẩn không điển hình hoặc đơn trị liệu nếu dị ứng Penicillin' },
                    { name: 'Levofloxacin / Moxifloxacin (Respiratory Quinolone)', note: 'Quinolone hô hấp dùng cho thể nặng nhập viện hoặc bệnh nhân có nhiều bệnh lý nền phức tạp' }
                ],
                labs: [
                    { name: 'Chụp X-quang ngực thẳng', note: 'Phát hiện hình ảnh tổn thương thâm nhiễm mới nhu mô phổi' },
                    { name: 'Công thức máu (WBC & Neutrophil)', note: 'Đánh giá mức độ phản ứng viêm do nhiễm trùng vi khuẩn' },
                    { name: 'Xét nghiệm định lượng CRP hoặc Procalcitonin', note: 'Theo dõi động học để hướng dẫn ngưng hoặc chuyển đổi kháng sinh' }
                ],
                guidelines: [
                    'Áp dụng thang điểm CURB-65 ngay tại phòng khám để phân loại độ nặng và đưa ra quyết định nhập viện hoặc điều trị ngoại trú.',
                    'Đánh giá lại lâm sàng sau 48-72 giờ để xem xét chuyển đổi kháng sinh từ đường tiêm sang đường uống nếu bệnh nhân cải thiện tốt.',
                    'Khuyến khích bù dịch đầy đủ, nghỉ ngơi, tập thở sâu và hướng dẫn các dấu hiệu nguy hiểm cần tái khám ngay.'
                ]
            }
        },
        'I50': {
            name: 'Phác đồ Điều trị Suy tim mạn tính',
            icd10: 'I50',
            recommendations: {
                drugs: [
                    { name: 'Sacubitril / Valsartan (ARNI)', note: 'Ức chế thụ thể neprilysin và angiotensin, tối ưu hóa điều trị suy tim phân suất tống máu giảm' },
                    { name: 'Bisoprolol / Metoprolol Succinate', note: 'Thuốc chẹn beta giao cảm thế hệ mới, tăng dần liều chậm rãi khi suy tim ổn định' },
                    { name: 'Spironolactone (MRA)', note: 'Kháng aldosterone giúp ngăn ngừa xơ hóa cơ tim, cải thiện tỷ lệ sống sót' },
                    { name: 'Dapagliflozin / Empagliflozin (SGLT2i)', note: 'Thuốc ức chế SGLT2 giúp giảm đáng kể tỷ lệ nhập viện và tử vong do tim mạch' }
                ],
                labs: [
                    { name: 'Xét nghiệm NT-proBNP hoặc BNP', note: 'Chẩn đoán loại trừ, xác định độ nặng và theo dõi đáp ứng điều trị suy tim' },
                    { name: 'Siêu âm tim Doppler', note: 'Đánh giá phân suất tống máu thất trái (LFEV) và áp lực động mạch phổi' },
                    { name: 'Định lượng Kali máu & Creatinin', note: 'Theo dõi sát điện giải đồ và chức năng thận khi dùng thuốc ARNI, ACEi, MRA và lợi tiểu' }
                ],
                guidelines: [
                    'Áp dụng phác đồ điều trị chuẩn với "Tứ trụ" lâm sàng (ARNI/ACEi/ARB, Chẹn beta, MRA, SGLT2i) càng sớm càng tốt để tối ưu tiên lượng.',
                    'Yêu cầu bệnh nhân theo dõi sát cân nặng mỗi sáng. Báo ngay nhân viên y tế nếu tăng > 2kg trong vòng 3 ngày (dấu hiệu giữ dịch cấp).',
                    'Chế độ ăn nhạt (< 2g natri/ngày) và kiểm soát lượng nước uống vào tùy thuộc vào mức độ suy tim và tình trạng phù.'
                ]
            }
        }
    },

    // 3. Mapper phác đồ chuẩn theo mã ICD-10
    getGuidelinesForICD(icdCode) {
        if (!this.enabled) {
            return null; // Tắt hoàn toàn nếu Feature Toggle chưa kích hoạt
        }
        
        if (!icdCode) return null;
        
        const cleanIcd = String(icdCode).trim().toUpperCase();
        
        // Thử tìm khớp trực tiếp hoặc khớp theo đầu mã (Prefix)
        for (const [key, guideline] of Object.entries(this.GUIDELINES_DATABASE)) {
            if (cleanIcd.startsWith(key)) {
                return guideline;
            }
        }
        
        return null;
    },

    // 4. Đánh giá ngữ cảnh bệnh nhân để đưa ra gợi ý phác đồ thích hợp
    evaluatePatientContext(context) {
        if (!this.enabled) {
            return {
                enabled: false,
                matches: []
            };
        }

        const diagnoses = context?.encounter?.diagnoses || [];
        const matches = [];

        diagnoses.forEach(diag => {
            const code = String(diag.code || '').trim().toUpperCase();
            if (code) {
                const guideline = this.getGuidelinesForICD(code);
                if (guideline) {
                    matches.push({
                        diagnosis: diag,
                        guideline
                    });
                }
            }
        });

        return {
            enabled: true,
            matches
        };
    }
};
