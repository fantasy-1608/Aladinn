import { CDSCache } from './cds-cache.js';

/**
 * 🧞 Aladinn CDS — Extractor Module
 * Chịu trách nhiệm trích xuất thông tin Tên Thuốc, Mã ICD, Sinh hiệu/Cận lâm sàng từ lưới VNPT HIS.
 * Hỗ trợ Data Snooping thông qua CDSCache để lấy dữ liệu 100% chính xác từ API.
 */

export const CDSCacheManager = CDSCache; // Re-export for init

export const CDSCacheExtractor = {
    // Để giữ tương thích với hàm cũ bên engine.js
};

export const CDSExtractor = {
    /**
     * Thu thập toàn bộ Context của Bệnh nhân hiện tại trên màn hình Kê Đơn.
     * @returns {Object} PatientContext
     */
    async extractContext() {
        const currentDomPatientId = this.getPatientId();
        const currentDomPatientName = this.getPatientName();
        CDSCache.checkPatientContext(currentDomPatientId); // Đảm bảo Cache đúng BN đang thao tác

        let diagnoses = this.getDiagnoses();
        const cache = CDSCache.get();

        // --- FETCH TỪ BACKGROUND NẾU THIẾU CHẨN ĐOÁN PHỤ ---
        // Nếu chỉ có 0 hoặc 1 mã ICD (từ UI), có khả năng bị sót chẩn đoán kèm theo.
        if (diagnoses.length <= 1 && cache.benhnhanId && cache.khambenhId) {
            try {
                const fetchedDiagnoses = await this.fetchDiagnosesFromBridge(cache.benhnhanId, cache.khambenhId);
                if (fetchedDiagnoses && fetchedDiagnoses.length > diagnoses.length) {
                    diagnoses = fetchedDiagnoses;
                    // Cập nhật lại Cache để không phải fetch lại nhiều lần
                    for (const d of fetchedDiagnoses) {
                        if (!cache.diagnoses.some(x => x.code === d.code)) {
                            cache.diagnoses.push(d);
                        }
                    }
                }
            } catch (e) {
                console.warn('[Aladinn CDS] Background fetch diagnoses failed:', e);
            }
        }

        return {
            patient: {
                id: currentDomPatientId,
                name: currentDomPatientName,
                weight: this.getWeight()
            },
            encounter: {
                id: this.getEncounterId(),
                diagnoses: diagnoses
            },
            insurance: {
                care_setting: this.getCareSetting(),
                is_insured: true // Tạm thời mặc định BHYT
            },
            medications: this.getMedications(),
            labs: this.getLabs()
        };
    },

    fetchDiagnosesFromBridge(benhnhanId, khambenhId) {
        return new Promise((resolve) => {
            const reqId = Date.now() + Math.random();
            const listener = (event) => {
                if (event.data && event.data.type === 'FETCH_DIAGNOSES_RESULT' && event.data.requestId === reqId) {
                    window.removeEventListener('message', listener);
                    resolve(event.data.data ? event.data.data.diagnoses : null);
                }
            };
            window.addEventListener('message', listener);
            
            // Timeout 3s
            setTimeout(() => {
                window.removeEventListener('message', listener);
                resolve(null);
            }, 3000);

            const token = document.currentScript ? document.currentScript.getAttribute('data-aladinn-token') : (window.__ALADINN_BRIDGE_TOKEN__ || '');
            window.postMessage({
                type: 'REQ_FETCH_DIAGNOSES',
                benhnhanId: benhnhanId,
                khambenhId: khambenhId,
                requestId: reqId,
                token: token
            }, window.location.origin);
        });
    },

    getElementsAcrossIframes(selector, allowHidden = false) {
        const isVisible = (el) => {
            if (allowHidden) return true;
            const rect = el.getBoundingClientRect();
            // Loại bỏ các element bị jQuery UI ẩn đi bằng cách left: -10000px
            return rect.width > 0 && rect.height > 0 && rect.left > -5000 && rect.top > -5000;
        };

        let elements = Array.from(document.querySelectorAll(selector)).filter(isVisible);
            
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                // Chỉ duyệt qua iframe nếu nó hiển thị hoặc allowHidden = true
                if (iframe.contentDocument && (allowHidden || isVisible(iframe))) {
                    const iframeElements = Array.from(iframe.contentDocument.querySelectorAll(selector)).filter(isVisible);
                    elements = elements.concat(iframeElements);
                }
            } catch (_e) {
                // Bỏ qua lỗi CORS
            }
        });
        return elements;
    },

    getPatientId() {
        const els = this.getElementsAcrossIframes('#txtMaBenhNhan, [name="MaBn"], #txtMaBA');
        for (const el of els) if (el.value) return el.value;
        
        // Cố gắng tìm trong các thanh bar thông tin (VD: "2604221155 | NGUYỄN HỮU ĐẢM...")
        const infoBars = this.getElementsAcrossIframes('div, span, td');
        for (const el of infoBars) {
            const text = el.innerText || '';
            // Match dạng "Mã BA: 123456"
            const match1 = text.match(/Mã BA:\s*(\d+)/i);
            if (match1) return match1[1];
            
            // Match dạng "123456789 | NGUYỄN VĂN A"
            const match2 = text.match(/^(\d{8,12})\s*\|/);
            if (match2) return match2[1];
        }
        
        return 'anonymous_patient';
    },

    getPatientName() {
        // Tìm qua input
        const els = this.getElementsAcrossIframes('#txtTenBenhNhan, [name="TenBn"], [id*="TenBenhNhan"], .patient-name');
        for (const el of els) {
            const val = el.value || el.innerText;
            if (val && val.trim().length > 3) return val.trim();
        }
        
        // Tìm qua text
        const infoBars = this.getElementsAcrossIframes('div, span, td');
        for (const el of infoBars) {
            const text = el.innerText || '';
            
            // Match dạng "Tên bệnh nhân: NGUYỄN THỊ MỸ VÂN"
            const match1 = text.match(/Tên bệnh nhân:\s*([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]+)/i);
            if (match1 && match1[1].trim().length > 3) return match1[1].trim();
            
            // Match dạng "123456789 | NGUYỄN HỮU ĐẢM |"
            const match2 = text.match(/^\d{8,12}\s*\|\s*([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]+)\s*\|/i);
            if (match2 && match2[1].trim().length > 3) return match2[1].trim();
        }
        
        return 'Bệnh nhân';
    },

    getEncounterId() {
        const cache = CDSCache.get();
        if (cache.encounterId) return cache.encounterId;

        const els = this.getElementsAcrossIframes('#txtMaKhamBenh, [name="MaKhamBenh"]');
        for (const el of els) if (el.value) return el.value;
        return `encounter_${Date.now()}`;
    },

    getWeight() {
        const cache = CDSCache.get();
        if (cache.weight && cache.weight > 0) return cache.weight;

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
        
        // Nâng cấp: Đọc từ Data Snooping Cache trước, sau đó GỘP (Merge) với DOM
        const cache = CDSCache.get();
        if (cache.diagnoses && cache.diagnoses.length > 0) {
            cache.diagnoses.forEach(diag => {
                diagnoses.push(diag);
                seenCodes.add(diag.code.toUpperCase());
            });
        }

        const icdPattern = /\b[A-Z]\d{2,3}(?:\.\d{1,2})?\b/gi;

        // 1. Quét ưu tiên các ô nhập liệu (Input/Textarea) thường chứa mã bệnh
        const icdSelectors = [
            '#txtMaBenh', '#txtMaICD', '#txtMaBenhKemTheo', '#txtChuanDoan_Hide', '#txtBenhKemTheo',
            '#lblCHANDOANVAOKHOA_KEMTHEO', '#lblCHANDOANVAOKHOA',
            '[id*="MaBenh"]', '[id*="ICD"]', '[id*="icd"]', '[id*="ChuanDoan"]', '[id*="BenhKemTheo"]',
            '[name*="MaBenh"]', '[name*="ICD"]', '[name*="ChuanDoan"]', '[name*="BenhKemTheo"]',
            'textarea' // Bệnh kèm theo thường lọt vào textarea
        ].join(', ');
        
        // Cực kỳ quan trọng: Cho phép lấy element ẩn (allowHidden = true)
        // Vì ở tab "Thuốc(4)", các thẻ <label> hoặc ô nhập liệu chẩn đoán của bệnh nhân thường bị jQuery UI ẩn đi (display: none)
        const inputs = this.getElementsAcrossIframes(icdSelectors, true);
        inputs.forEach(el => {
            const rawVal = el.value || el.innerText || el.textContent || '';
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
        const docTexts = this.getElementsAcrossIframes('body, .form-group, .panel-body, td, div', false);
        // Regex bắt chặt định dạng "Mã ICD đi kèm dấu gạch ngang hoặc kết hợp với chữ" để tránh rác (VD: Tầng 3A, M15 máy in...)
        // Bắt các mẫu như: "M15-Thoái hóa", "S56.5 - Tổn thương"
        const strictIcdPattern = /\b([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*(-|:)\s*[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝ/]/gi;
        
        docTexts.forEach(el => {
            // Chỉ quét các thẻ container nhỏ gọn, không quét thẻ TO quá tránh trùng lặp tốn CPU
            if (el.children.length > 5) return; 

            // Loại trừ container chứa bảng lưới dữ liệu bên trong để tránh thu thập chuỗi văn bản khổng lồ
            if (el.querySelector && el.querySelector('table')) return;

            // Loại trừ các text nằm trong dòng (TR) của một bảng dữ liệu lớn (như Danh sách bệnh nhân, thường > 5 cột)
            // Form nhập liệu nếu dùng bảng thường chỉ có 2-4 cột.
            const parentTr = el.closest ? el.closest('tr') : null;
            if (parentTr && parentTr.children.length > 5) return;

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
        
        // Nâng cấp: Đọc từ Data Snooping Cache trước, sau đó GỘP với dữ liệu trên DOM
        const cache = CDSCache.get();
        if (cache.medications && cache.medications.length > 0) {
            meds.push(...cache.medications);
        }

        
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
            // Bỏ qua toàn bộ cột số ẩn (mã nội bộ VNPT HIS như 667024, 666862...)
            // Tìm CỘT VĂN BẢN ĐẦU TIÊN có độ dài > 2, không phải số, không phải đơn vị dược
            const textCols = [];
            for (let i = 0; i < cols.length; i++) {
                const val = cols[i];
                if (!val || val === '-' || val.length < 2) continue;
                if (/^\d[\d.,]*$/.test(val)) continue; // Số thuần / giá tiền
                if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) continue; // Ngày tháng
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) continue; // Giờ giấc (VD: 13:00, 08:30:15)
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

        // 1. Snoop Data (API Cache Mới Nhất)
        const cache = CDSCache.get();
        if (cache.labs && cache.labs.length > 0) {
            for (const lab of cache.labs) {
                if (!seenKeys.has(lab.code)) {
                    seenKeys.add(lab.code);
                    labs.push(lab);
                }
            }
            return labs; // Return immediately
        }

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
