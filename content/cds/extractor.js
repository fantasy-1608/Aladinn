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
    _fetchedPatients: new Set(), // Track patient IDs đã fetch API diagnoses
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

        // --- FETCH TỪ API: Luôn gọi 1 lần per patient để lấy ĐẦY ĐỦ chẩn đoán từ tờ điều trị ---
        const fetchKey = (cache.benhnhanId || '') + '_' + (cache.khambenhId || '');
        if (cache.benhnhanId && cache.khambenhId && !CDSExtractor._fetchedPatients.has(fetchKey)) {
            CDSExtractor._fetchedPatients.add(fetchKey);
            try {
                const fetchedDiagnoses = await this.fetchDiagnosesFromBridge(cache.benhnhanId, cache.khambenhId);
                if (fetchedDiagnoses && fetchedDiagnoses.length > 0) {
                    console.log('[Aladinn CDS] 📡 API diagnoses:', fetchedDiagnoses.map(d => d.code).join(', '));
                    // Merge vào diagnoses hiện tại
                    const seenCodes = new Set(diagnoses.map(d => d.code));
                    for (const d of fetchedDiagnoses) {
                        if (!seenCodes.has(d.code)) {
                            diagnoses.push(d);
                            seenCodes.add(d.code);
                        }
                    }
                    // Cập nhật Cache
                    for (const d of fetchedDiagnoses) {
                        if (!cache.diagnoses.some(x => x.code === d.code)) {
                            cache.diagnoses.push(d);
                        }
                    }
                }
            } catch (e) {
                console.warn('[Aladinn CDS] Background fetch diagnoses failed:', e);
                // Cho phép retry lần sau
                CDSExtractor._fetchedPatients.delete(fetchKey);
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
                if (iframe.contentDocument && (allowHidden || isVisible(iframe))) {
                    const iframeElements = Array.from(iframe.contentDocument.querySelectorAll(selector)).filter(isVisible);
                    elements = elements.concat(iframeElements);
                }
            } catch (_e) {
                // Bỏ qua lỗi CORS — dữ liệu thuốc từ iframe sẽ đến qua cds-iframe-helper
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
        // Bao gồm: form kê thuốc (iframe), tờ điều trị, bệnh án (main frame)
        const icdSelectors = [
            '#txtMaBenh', '#txtMaICD', '#txtMaBenhKemTheo', '#txtChuanDoan_Hide', '#txtBenhKemTheo',
            '#lblCHANDOANVAOKHOA_KEMTHEO', '#lblCHANDOANVAOKHOA',
            // Tờ điều trị
            '[id*="CHANDOAN"]', '[id*="chandoan"]', '[id*="ChuanDoan"]', '[id*="CHUANDOAN"]',
            '[id*="MaBenh"]', '[id*="MABENH"]', '[id*="ICD"]', '[id*="icd"]', 
            '[id*="BenhKemTheo"]', '[id*="BENHKEMTHEO"]',
            '[name*="MaBenh"]', '[name*="MABENH"]', '[name*="ICD"]', '[name*="ChuanDoan"]', '[name*="CHUANDOAN"]', '[name*="BenhKemTheo"]', '[name*="BENHKEMTHEO"]',
            // Label/Span chứa mã ICD đi kèm chẩn đoán
            'label[for*="Benh"]', 'label[for*="ICD"]', 'label[for*="ChuanDoan"]', 'label[for*="CHUANDOAN"]'
        ].join(', ');
        
        // Cực kỳ quan trọng: Cho phép lấy element ẩn (allowHidden = true)
        // Vì ở tab "Thuốc(4)", các thẻ <label> hoặc ô nhập liệu chẩn đoán của bệnh nhân thường bị jQuery UI ẩn đi (display: none)
        const inputs = this.getElementsAcrossIframes(icdSelectors, true);
        inputs.forEach(el => {
            const rawVal = el.value || el.innerText || el.textContent || '';
            // Bỏ qua text quá dài (grid data, nội dung bệnh án) — chỉ giữ ô chứa mã ICD
            if (rawVal.length > 500) return;
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
        
        // 2. Quét riêng textarea có chứa mã ICD dạng "S20-Tổn thương..." (tờ điều trị)
        const textareas = this.getElementsAcrossIframes('textarea', true);
        const strictIcdInTextarea = /\b([A-Z]\d{2,3}(?:\.\d{1,2})?)\s*[-:]\s*[A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝ]/gi;
        textareas.forEach(el => {
            const text = el.value || el.innerText || '';
            if (text.length < 3 || text.length > 1000) return;
            let match;
            while ((match = strictIcdInTextarea.exec(text)) !== null) {
                const c = match[1].toUpperCase();
                if (!seenCodes.has(c)) {
                    diagnoses.push({ code: c, is_primary: false });
                    seenCodes.add(c);
                }
            }
        });

        return diagnoses;
    },

    getMedications() {
        const meds = [];
        const debugPipeline = []; // Track extraction pipeline for console
        
        // ===== SOURCE 1: CDSCache (API Snooping — fastest, most reliable) =====
        const cache = CDSCache.get();
        const cacheFresh = cache._medsTimestamp && (Date.now() - cache._medsTimestamp < 300000); // 5 min TTL
        if (cache.medications && cache.medications.length > 0 && cacheFresh) {
            meds.push(...cache.medications);
            debugPipeline.push(`[Cache] ${cache.medications.length} drugs (fresh)`);
        } else if (cache.medications && cache.medications.length > 0) {
            meds.push(...cache.medications);
            debugPipeline.push(`[Cache] ${cache.medications.length} drugs (stale → will merge DOM)`);
        }

        // ===== SOURCE 2: Targeted Grid Scanner (column-header aware) =====
        const gridMeds = this._scanDrugGrids();
        if (gridMeds.length > 0) {
            debugPipeline.push(`[Grid] ${gridMeds.length} drugs`);
            for (const m of gridMeds) {
                meds.push(m);
            }
        }

        // ===== SOURCE 3: Generic DOM Scanner (fallback — quét mọi <tr>) =====
        if (meds.length === 0) {
            const domMeds = this._scanGenericRows();
            if (domMeds.length > 0) {
                debugPipeline.push(`[DOM] ${domMeds.length} drugs`);
                for (const m of domMeds) {
                    meds.push(m);
                }
            }
        }

        // Unique filter by name
        const uniqueMeds = [];
        const seen = new Set();
        for (const m of meds) {
            const k = m.display_name.toLowerCase();
            if (!seen.has(k)) {
                seen.add(k);
                uniqueMeds.push(m);
            }
        }
        
        console.log(`[Aladinn CDS] 💊 Pipeline: ${debugPipeline.join(' → ')} | Final: ${uniqueMeds.length} unique drugs`);
        if (uniqueMeds.length > 0) {
            console.log('[Aladinn CDS] 💊 Drugs:', uniqueMeds.map(m => m.display_name).join(', '));
        }
        
        return uniqueMeds;
    },

    /**
     * Phase 2: Targeted Grid Scanner — quét bảng thuốc cụ thể theo header columns.
     * Tự động phát hiện cột "Tên thuốc", "Nồng độ", "ĐVT" từ <th> row.
     */
    _scanDrugGrids() {
        const meds = [];
        
        // Tìm tất cả table có header chứa "Tên thuốc" hoặc "Tên dịch vụ"
        const allTables = this.getElementsAcrossIframes('table');
        
        for (const table of allTables) {
            const headers = table.querySelectorAll('th');
            if (headers.length < 3) continue;
            
            // Detect column indices
            let nameCol = -1, dosageCol = -1;
            const headerTexts = [];
            headers.forEach((th, i) => {
                const text = (th.innerText || th.textContent || '').trim().toLowerCase();
                headerTexts.push(text);
                if (text.includes('tên thuốc') || text.includes('tên dịch vụ')) nameCol = i;
                if (text.includes('nồng độ') || text.includes('hàm lượng') || text.includes('hoạt chất')) dosageCol = i;
            });
            
            if (nameCol === -1) continue; // Không phải bảng thuốc
            
            // Quét data rows
            const rows = table.querySelectorAll('tr');
            for (const row of rows) {
                if (row.querySelector('th')) continue;
                const cells = row.querySelectorAll('td');
                if (cells.length <= nameCol) continue;
                
                let name = (cells[nameCol]?.innerText || '').trim();
                let generic = dosageCol >= 0 && cells[dosageCol] ? (cells[dosageCol]?.innerText || '').trim() : '';
                
                if (!name || name.length < 2 || name === '-') continue;
                
                // Filter dung môi / vật tư
                name = this._filterDrugName(name, generic);
                if (!name) continue;
                
                // Clean up ngoặc
                if (name.includes('(') && name.includes(')')) {
                    const match = name.match(/\((.*?)\)/);
                    if (match && !generic) generic = match[1].trim();
                    name = name.split('(')[0].trim();
                }
                
                if (name.length > 1) {
                    meds.push({
                        display_name: name,
                        generic_candidate: (generic && generic !== '-') ? generic : null
                    });
                }
            }
        }
        
        return meds;
    },

    /**
     * Generic DOM Scanner (fallback) — logic cũ, cải tiến.
     */
    _scanGenericRows() {
        const meds = [];
        const NOISE_WORDS = ['page', 'trang', 'total', 'tổng', 'chọn', 'đóng', 'lưu', 'hủy', 'xóa', 'sửa', 'in ', 'print'];
        const ICD_PATTERN = /[A-Z]\d{2,3}(?:\.\d{1,2})?/;
        const DRUG_UNITS = ['viên', 'viên.', 'viên ', 'vên', 'chai', 'lọ', 'ống', 'gói', 'cái', 'tuýp', 'hộp', 'túi', 'vỉ', 'tube', 'ml', 'amp', 'tab', 'cap', 'bơm', 'đơn vị', 'đv'];
        const DRUG_ROUTES = ['uống', 'tiêm', 'bôi', 'nhỏ', 'đặt', 'ngậm', 'hít', 'xịt', 'truyền', 'ngoài da', 'tiêm bắp', 'tiêm tĩnh mạch', 'pha', 'súc miệng'];

        const rows = this.getElementsAcrossIframes('tr');

        for (const row of rows) {
            if (row.querySelector('th')) continue;
            
            // Bỏ qua lưới Danh sách bệnh nhân
            if (row.closest) {
                const parentGrid = row.closest('[id*="grdBenhNhan"], [id*="gridBenhNhan"], [id*="gbox_grdBenhNhan"], [id*="grdDanhSachBN"]');
                if (parentGrid) continue;
            }

            let cells = Array.from(row.querySelectorAll('td'));
            if (cells.length === 0) cells = Array.from(row.querySelectorAll(':scope > div'));
            
            const cols = cells.map(td => (td.innerText || td.textContent || '').trim());
            if (cols.length < 3) continue;

            const hasDrugUnit = DRUG_UNITS.some(u => cols.some(c => c.length > 0 && c.length < 15 && c.toLowerCase().includes(u)));
            const hasDrugRoute = DRUG_ROUTES.some(r => cols.some(c => c.length > 0 && c.length < 20 && c.toLowerCase().includes(r)));
            if (!hasDrugUnit && !hasDrugRoute) continue;

            const rowText = cols.join(' ').toLowerCase();
            if (NOISE_WORDS.some(w => rowText.includes(w))) continue;

            // SMART COLUMN SCANNER
            const textCols = [];
            for (let i = 0; i < cols.length; i++) {
                const val = cols[i];
                if (!val || val === '-' || val.length < 2) continue;
                if (/^\d[\d.,]*$/.test(val)) continue;
                if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) continue;
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) continue;
                const valLower = val.toLowerCase();
                if (DRUG_UNITS.some(u => valLower === u)) continue;
                if (['uống', 'tiêm', 'bôi', 'nhỏ', 'đặt', 'ngậm', 'hít', 'xịt', 'truyền', 'thu phí', 'viện phí', 'bhyt', 'kho nội trú', 'kho ngoại trú', 'nam', 'nữ', 'không có'].some(k => valLower === k || valLower.startsWith(k))) continue;
                if (ICD_PATTERN.test(val)) continue;
                if (!val.includes(' ') && /^[A-Z0-9_-]+$/.test(val)) continue;
                textCols.push({ index: i, value: val });
            }

            let name = textCols.length >= 1 ? textCols[0].value : '';
            let generic = textCols.length >= 2 ? textCols[1].value : '';

            if (name && ICD_PATTERN.test(name)) name = '';
            
            name = this._filterDrugName(name, generic);
            if (!name) continue;

            // Clean up
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
            }
        }
        return meds;
    },

    /**
     * Filter: loại tên người, dung môi, vật tư y tế.
     * Trả về name đã clean hoặc '' nếu bị loại.
     */
    _filterDrugName(name, _generic) {
        if (!name) return '';
        
        // Loại dung môi / vật tư
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
        const nameLower = name.toLowerCase();
        if (NOT_DRUGS.some(nd => nameLower.includes(nd))) return '';
        
        // Detect patient names: Title Case / ALL UPPER nhưng có dấu VN → tên người
        if (name.length > 6 && !/\d/.test(name)) {
            const words = name.trim().split(/\s+/);
            if (words.length >= 2 && words.length <= 6) {
                const isAllUpper = name === name.toUpperCase();
                const isTitleCase = words.every(w => w.length > 0 && w[0] === w[0].toUpperCase() && w.slice(1) === w.slice(1).toLowerCase());
                if (isAllUpper || isTitleCase) {
                    const hasVnDiacritics = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(name);
                    const hasMedKeyword = /injection|solution|cream|tablet|capsule|sodium|chloride|acid|hydro|amine|oxacin|mycin|azole|prazole|statin|sartan|dipine|olol|cillin|mab|nib|parin|phylline|cortis|predniso|metro|pharm/i.test(name);
                    if (hasMedKeyword) {
                        // Giữ — đây là thuốc
                    } else if (hasVnDiacritics) {
                        return ''; // Tên người VN
                    }
                }
            }
        }
        
        return name;
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
