/**
 * 🧞 Aladinn CDS — Extractor Module
 * Chịu trách nhiệm trích xuất thông tin Tên Thuốc, Mã ICD, Sinh hiệu/Cận lâm sàng từ lưới VNPT HIS.
 */

export const CDSExtractor = {
    /**
     * Thu thập toàn bộ Context của Bệnh nhân hiện tại trên màn hình Kê Đơn.
     * @returns {Object} PatientContext
     */
    extractContext() {
        return {
            patient: {
                id: this.getPatientId(),
                weight: this.getWeight()
            },
            encounter: {
                id: this.getEncounterId(),
                diagnoses: this.getDiagnoses()
            },
            insurance: {
                care_setting: this.getCareSetting(),
                is_insured: true // Tạm thời mặc định BHYT
            },
            medications: this.getMedications(),
            labs: this.getLabs()
        };
    },

    getElementsAcrossIframes(selector) {
        let elements = Array.from(document.querySelectorAll(selector))
            .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
            
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                // Chỉ duyệt qua iframe đang hiển thị
                if (iframe.contentDocument && (iframe.offsetWidth > 0 || iframe.offsetHeight > 0)) {
                    const iframeElements = Array.from(iframe.contentDocument.querySelectorAll(selector))
                        .filter(el => el.offsetWidth > 0 || el.offsetHeight > 0 || el.getClientRects().length > 0);
                    elements = elements.concat(iframeElements);
                }
            } catch (_e) {
                // Bỏ qua lỗi CORS
            }
        });
        return elements;
    },

    getPatientId() {
        // ID Bệnh nhân thường nằm ở góc hoặc trong input ẩn
        const els = this.getElementsAcrossIframes('#txtMaBenhNhan, [name="MaBn"], #txtMaBA');
        for (const el of els) if (el.value) return el.value;
        return 'anonymous_patient';
    },

    getEncounterId() {
        const els = this.getElementsAcrossIframes('#txtMaKhamBenh, [name="MaKhamBenh"]');
        for (const el of els) if (el.value) return el.value;
        return `encounter_${Date.now()}`;
    },

    getWeight() {
        const els = this.getElementsAcrossIframes('#txtCanNang, [title*="Cân nặng"]');
        for (const el of els) {
            const val = parseFloat(el.value || el.innerText);
            if (!isNaN(val)) return val;
        }
        return undefined;
    },

    getDiagnoses() {
        const diagnoses = [];
        const seenCodes = new Set();
        const icdPattern = /\b[A-Z]\d{2,3}(?:\.\d{1,2})?\b/gi;

        // 1. Quét ưu tiên các ô nhập liệu (Input/Textarea) thường chứa mã bệnh
        const icdSelectors = [
            '#txtMaBenh', '#txtMaICD', '#txtMaBenhKemTheo', '#txtChuanDoan_Hide', '#txtBenhKemTheo',
            '[id*="MaBenh"]', '[id*="ICD"]', '[id*="icd"]', '[id*="ChuanDoan"]', '[id*="BenhKemTheo"]',
            '[name*="MaBenh"]', '[name*="ICD"]', '[name*="ChuanDoan"]', '[name*="BenhKemTheo"]',
            'textarea' // Bệnh kèm theo thường lọt vào textarea
        ].join(', ');
        
        const inputs = this.getElementsAcrossIframes(icdSelectors);
        inputs.forEach(el => {
            const rawVal = el.value || el.innerText || '';
            const matches = rawVal.match(icdPattern);
            if (matches) {
                matches.forEach(code => {
                    const c = code.toUpperCase();
                    if (!seenCodes.has(c)) {
                        diagnoses.push({ code: c, is_primary: diagnoses.length === 0 });
                        seenCodes.add(c);
                    }
                });
            }
        });

        // 2. Mắt xích thứ hai: Quét toàn bộ Text của popup/trang để tóm các bệnh đã được CHỌN & HIỂN THỊ
        // Trong VNPT HIS, bệnh đã chọn thường được render dưới dạng "S61-Vết thương..." hoặc "M15 - Thoái hóa..."
        const docTexts = this.getElementsAcrossIframes('body, .form-group, .panel-body, td, div');
        // Regex bắt chặt định dạng "Mã ICD đi kèm dấu gạch ngang hoặc kết hợp với chữ" để tránh rác (VD: Tầng 3A, M15 máy in...)
        // Bắt các mẫu như: "M15-Thoái hóa", "S56.5 - Tổn thương"
        const strictIcdPattern = /\b([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*(-|:)\s*[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝ/]/gi;
        
        docTexts.forEach(el => {
            // Chỉ quét các thẻ container nhỏ gọn, không quét thẻ TO quá tránh trùng lặp tốn CPU
            if (el.children.length > 5) return; 
            const text = el.innerText || '';
            if (text.length > 5) {
                let match;
                while ((match = strictIcdPattern.exec(text)) !== null) {
                    const c = match[1].toUpperCase();
                    if (!seenCodes.has(c)) {
                        diagnoses.push({ code: c, is_primary: diagnoses.length === 0 });
                        seenCodes.add(c);
                    }
                }
            }
        });

        return diagnoses;
    },

    getMedications() {
        const meds = [];
        
        // Từ khóa loại trừ (không phải thuốc)
        const NOISE_WORDS = ['page', 'trang', 'total', 'tổng', 'chọn', 'đóng', 'lưu', 'hủy', 'xóa', 'sửa', 'in ', 'print'];
        // Dung môi, vật tư y tế KHÔNG PHẢI THUỐC — loại trừ khỏi phân tích tương tác
        const NOT_DRUGS = [
            'nước cất', 'nuoc cat', 'water for injection',
            'nước muối', 'natri clorid 0,9', 'nacl 0.9', 'nacl 0,9', 'normal saline',
            'glucose 5%', 'dextrose 5%',
            'cồn 70', 'cồn 90', 'alcool 70', 'alcool 90', 'alcohol',
            'oxy y tế', 'oxy lỏng', 'oxygen',
            'kim tiêm', 'kim luồn', 'bơm tiêm', 'pen ndl', 'kim pen',
            'dây truyền', 'bộ dây', 'catheter',
            'băng keo', 'gạc', 'bông', 'găng tay',
            'dung dịch rửa', 'nước rửa tay', 'povidone', 'betadine',
        ];
        // Pattern nhận diện mã ICD (VD: S61.0, T42.4, J18.9)
        const ICD_PATTERN = /[A-Z]\d{2,3}(?:\.\d{1,2})?/;

        const rows = this.getElementsAcrossIframes('tr');
        
        let _candidateCount = 0;
        let debugLog = [];
        
        const DRUG_UNITS = ['viên', 'chai', 'lọ', 'ống', 'gói', 'cái', 'tuýp', 'hộp', 'túi', 'vỉ', 'tube', 'ml', 'amp', 'tab', 'cap', 'bơm'];

        for (const row of rows) {
            // Không xét phần header
            if (row.querySelector('th')) continue;

            const cols = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
            if (cols.length < 3) continue;

            // Kiểm tra dòng này có chứa đơn vị dược (ở bất kỳ cột ngắn nào) không
            const hasDrugUnit = DRUG_UNITS.some(u => {
                return cols.some(c => c.length < 20 && c.toLowerCase().includes(u));
            });
            
            if (!hasDrugUnit) continue;

            const rowText = cols.join(' ').toLowerCase();
            if (NOISE_WORDS.some(w => rowText.includes(w))) continue;
            
            _candidateCount++;

            // SMART COLUMN SCANNER:
            // B\u1ecf qua to\u00e0n b\u1ed9 c\u1ed9t s\u1ed1 \u1ea9n (m\u00e3 n\u1ed9i b\u1ed9 VNPT HIS nh\u01b0 667024, 666862...)
            // T\u00ecm C\u1ed8T V\u0102N B\u1ea2N \u0110\u1ea6U TI\u00caN c\u00f3 \u0111\u1ed9 d\u00e0i > 2, kh\u00f4ng ph\u1ea3i s\u1ed1, kh\u00f4ng ph\u1ea3i \u0111\u01a1n v\u1ecb d\u01b0\u1ee3c
            const textCols = [];
            for (let i = 0; i < cols.length; i++) {
                const val = cols[i];
                if (!val || val === '-' || val.length < 2) continue;
                if (/^\d[\d.,]*$/.test(val)) continue; // S\u1ed1 thu\u1ea7n / gi\u00e1 ti\u1ec1n
                if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) continue; // Ng\u00e0y th\u00e1ng
                const valLower = val.toLowerCase();
                if (DRUG_UNITS.some(u => valLower === u)) continue; // Đơn vị
                if (['uống', 'tiêm', 'bôi', 'nhỏ', 'đặt', 'ngậm', 'hít', 'xịt', 'truyền', 'thu phí', 'viện phí', 'bhyt', 'kho nội trú', 'kho ngoại trú', 'nam', 'nữ', 'không có'].some(k => valLower === k || valLower.startsWith(k))) continue; // Đường dùng / thanh toán / demographic
                if (ICD_PATTERN.test(val)) continue; // Bỏ qua ô chứa mã ICD (VD: S61.0 - Vết thương...)
                
                // Bỏ qua Mã Thuốc nội bộ (thường viết liền KHÔNG DẤU CÁCH, CHỮ IN HOA hoặc Số. VD: CEFOP, TH4577, THUOC2915)
                if (!val.includes(' ') && /^[A-Z0-9_-]+$/.test(val)) continue;

                textCols.push({ index: i, value: val });
            }

            let name = '';
            let generic = '';

            if (textCols.length >= 2) {
                name = textCols[0].value;
                generic = textCols[1].value;
            } else if (textCols.length === 1) {
                name = textCols[0].value;
            }

            // Loại bỏ nếu tên chứa mã ICD hoặc quá giống tên bệnh nhân (toàn uppercase có dấu cách, > 15 ký tự)
            if (name && ICD_PATTERN.test(name)) { name = ''; }
            if (name && /^[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]+$/.test(name) && name.length > 10) { name = ''; }

            // Loại trừ dung môi, vật tư y tế (nước cất, cồn, kim tiêm...)
            if (name) {
                const nameLower = name.toLowerCase();
                if (NOT_DRUGS.some(nd => nameLower.includes(nd))) { name = ''; }
            }

            // Clean up
            if (name) {
                if (name.includes('(') && name.includes(')')) {
                    const match = name.match(/\((.*?)\)/);
                    if (match && !generic) generic = match[1].trim();
                    name = name.split('(')[0].trim();
                }
                if (name.length > 1 && name !== '-') {
                    meds.push({
                        display_name: name,
                        generic_candidate: (generic && generic !== '-') ? generic : null
                    });
                    if (debugLog.length < 5) debugLog.push(`[${name}] → generic: [${generic || '?'}]`);
                }
            }
        } // Khép vòng lặp for (const row of rows)

        // Unique filter by name in case of duplicates
        const uniqueMeds = [];
        const seen = new Set();
        for (const m of meds) {
            const k = m.display_name.toLowerCase();
            if (!seen.has(k)) {
                seen.add(k);
                uniqueMeds.push(m);
            }
        }
        
        return uniqueMeds;
    },

    getLabs() {
        const labs = [];
        const seenKeys = new Set();

        // ===== SOURCE 1: Cached API data from Scanner (fastest) =====
        // When user runs "Quét Xét Nghiệm", results are stored in window._aladinn_cds_labs
        const cachedLabs = window._aladinn_cds_labs || [];
        for (const lab of cachedLabs) {
            const parsed = this._parseLab(lab.TENDICHVU, lab.GIATRI_KETQUA, lab.DONVI, lab.TRISOBINHTHUONG);
            if (parsed && !seenKeys.has(parsed.code)) {
                seenKeys.add(parsed.code);
                labs.push(parsed);
            }
        }

        // ===== SOURCE 2 (Fallback): DOM Scraping for visible lab grids =====
        if (labs.length === 0) {
            const clsRows = this.getElementsAcrossIframes('.grid-cls tr, #gridKetQuaCLS_Body tr, #grd_KQCLS tr, [id*="gridCLS"] tr');
            clsRows.forEach(row => {
                const _text = row.innerText || '';
                const cols = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
                if (cols.length < 2) return;
                
                // Try to extract lab name from first text column, value from numeric column
                const nameCol = cols.find(c => c.length > 3 && !/^\d/.test(c));
                const valueCol = cols.find(c => /^[\d.,]+$/.test(c));
                if (nameCol && valueCol) {
                    const parsed = this._parseLab(nameCol, valueCol, '', '');
                    if (parsed && !seenKeys.has(parsed.code)) {
                        seenKeys.add(parsed.code);
                        labs.push(parsed);
                    }
                }
            });
        }

        return labs;
    },

    /**
     * Normalize lab test name to standard code and extract numeric value
     * @param {string} name - Raw lab test name from VNPT HIS
     * @param {string} rawValue - Raw result value
     * @param {string} unit - Unit of measure
     * @param {string} refRange - Reference range string
     * @returns {Object|null} Normalized lab object {code, value, unit, refRange}
     */
    _parseLab(name, rawValue, unit, refRange) {
        if (!name || !rawValue) return null;
        const value = parseFloat(String(rawValue).replace(',', '.'));
        if (isNaN(value)) return null;

        const n = (name || '').toLowerCase().trim();
        let code = null;

        // === Kidney / Renal ===
        if (n.includes('egfr') || n.includes('mức lọc cầu thận') || n.includes('gfr')) code = 'eGFR';
        else if (n.includes('creatinin') || n.includes('créatinine')) code = 'creatinine';
        else if (n.includes('ure') && !n.includes('uric')) code = 'urea';
        else if (n.includes('acid uric') || n.includes('uric acid')) code = 'uric_acid';
        
        // === Liver ===
        else if (/\bast\b|sgot|aspartate/i.test(n)) code = 'AST';
        else if (/\balt\b|sgpt|alanine/i.test(n)) code = 'ALT';
        else if (n.includes('bilirubin') && n.includes('toàn phần') || n.includes('bilirubin') && n.includes('total')) code = 'bilirubin_total';
        else if (n.includes('bilirubin') && (n.includes('trực tiếp') || n.includes('direct'))) code = 'bilirubin_direct';
        else if (/\bggt\b|gamma/i.test(n)) code = 'GGT';

        // === Blood Sugar ===
        else if (n.includes('glucose') || n.includes('đường huyết') || n.includes('glycemi')) code = 'glucose';
        else if (n.includes('hba1c') || n.includes('hemoglobin a1c')) code = 'HbA1c';

        // === Electrolytes ===
        else if (/\bkali\b|\bk\+|\bpotassium/i.test(n)) code = 'potassium';
        else if (/\bnatri\b|\bna\+|\bsodium/i.test(n)) code = 'sodium';

        // === Coagulation ===
        else if (n.includes('pt inr') || n === 'inr') code = 'INR';
        else if (n.includes('pt %') || n.includes('tỷ lệ prothrombin') || (n.includes('pt') && n.includes('%'))) code = 'PT_percent';
        else if (n.includes('aptt') || n.includes('ptt')) code = 'aPTT';

        // === Hematology ===
        else if (/\bhemoglobin\b|\bhgb\b|\bhb\b/i.test(n) && !n.includes('a1c')) code = 'hemoglobin';
        else if (n.includes('tiểu cầu') || n.includes('platelet') || /\bplt\b/i.test(n)) code = 'platelet';
        else if (n.includes('bạch cầu') || n.includes('wbc') || n.includes('white blood')) code = 'WBC';

        // === Lipids ===
        else if (n.includes('cholesterol') && n.includes('toàn phần') || n === 'cholesterol') code = 'cholesterol';
        else if (n.includes('triglycerid')) code = 'triglyceride';
        else if (n.includes('ldl')) code = 'LDL';
        else if (n.includes('hdl')) code = 'HDL';

        // === Thyroid ===
        else if (/\btsh\b/i.test(n)) code = 'TSH';
        else if (/\bft4\b|\bfree t4/i.test(n)) code = 'FT4';

        // === Cardiac ===
        else if (n.includes('troponin')) code = 'troponin';
        else if (n.includes('ck-mb') || n.includes('ckmb')) code = 'CK_MB';
        else if (n.includes('bnp') || n.includes('nt-probnp')) code = 'BNP';

        if (!code) return null;

        return { code, value, unit: unit || '', refRange: refRange || '' };
    },


    getCareSetting() {
        // IPD (Inpatient) hoặc OPD (Outpatient)
        const url = window.location.href.toLowerCase();
        if (url.includes('noitru') || url.includes('todieutri')) return 'ipd';
        return 'opd'; // Khám ngoại trú
    }
};
