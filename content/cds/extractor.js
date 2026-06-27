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
                console.log('[Aladinn CDS] Background fetch diagnoses failed:', e);
                // Cho phép retry lần sau
                CDSExtractor._fetchedPatients.delete(fetchKey);
            }
        }

        const meds = await this.getMedications();
        const labs = await this.getLabs();
        const extractedWeight = await this.getWeight();
        const demographics = await this.getDemographics();

        console.log(`[Aladinn CDS Extractor] 🔍 Context extracted for patient: ${currentDomPatientId}. Cache hits: Meds=${meds.length}, Diags=${diagnoses.length}, Labs=${labs.length}`);

        return {
            patient: {
                id: currentDomPatientId,
                name: currentDomPatientName,
                weight: extractedWeight,
                gender: demographics?.gender,
                age: demographics?.age ? parseInt(demographics.age, 10) : undefined,
                dob: demographics?.dob
            },
            encounter: {
                id: this.getEncounterId(),
                diagnoses: diagnoses
            },
            insurance: {
                care_setting: this.getCareSetting(),
                is_insured: true // Tạm thời mặc định BHYT
            },
            medications: meds,
            labs: labs
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
                token: token,
                nonce: window.__ALADINN_NONCE__
            }, window.location.origin);
        });
    },

    async getDemographics() {
        const cache = CDSCache.get();
        if (cache.demographics) return cache.demographics;

        try {
            const activeRowId = this.getActiveRowId();
            const res = await this.fetchFromBridge('REQ_FETCH_PATIENT_DEMOGRAPHICS', 'FETCH_PATIENT_DEMOGRAPHICS_RESULT', activeRowId);
            if (res && res.demographics) {
                if (res._context && !this.verifyContextLock(res._context)) {
                    throw new Error('Context lock mismatch');
                }
                console.log('[Aladinn CDS] 📡 Demographics from API:', res.demographics);
                cache.demographics = res.demographics;
                return res.demographics;
            }
        } catch (e) {
            console.log('[Aladinn CDS] API fetch demographics failed, falling back to DOM:', e);
        }

        // Fallback: Parse gender and age from DOM
        let gender = undefined;
        let age = undefined;
        let dob = undefined;

        // Try parsing gender from common elements
        const genderEls = this.getElementsAcrossIframes('#txtGioiTinh, [name="GioiTinh"], [id*="GioiTinh"]');
        for (const el of genderEls) {
            const val = (el.value || el.innerText || '').trim().toLowerCase();
            if (val.includes('nam') || val === 'm' || val === '1') {
                gender = 'Nam';
                break;
            } else if (val.includes('nữ') || val.includes('nu') || val === 'f' || val === '0') {
                gender = 'Nữ';
                break;
            }
        }

        // Try parsing age or birth year from common elements
        const ageEls = this.getElementsAcrossIframes('#txtTuoi, [name="Tuoi"], [id*="Tuoi"], #txtNamSinh, [name="NamSinh"], [id*="NamSinh"]');
        for (const el of ageEls) {
            const valStr = (el.value || el.innerText || '').trim();
            const val = parseInt(valStr, 10);
            if (!isNaN(val) && val > 0) {
                if (val > 1900 && val <= new Date().getFullYear()) {
                    // It's a birth year
                    age = String(new Date().getFullYear() - val);
                    dob = valStr;
                } else if (val < 120) {
                    age = String(val);
                }
                break;
            }
        }

        // Try parsing from info bars text if gender/age still missing
        if (!gender || !age) {
            const infoBars = this.getElementsAcrossIframes('div, span, td');
            for (const el of infoBars) {
                const text = el.innerText || '';
                if (!gender) {
                    const genderMatch = text.match(/(?:Giới tính|Phái):\s*(Nam|Nữ)/i);
                    if (genderMatch) gender = genderMatch[1];
                }
                if (!age) {
                    const ageMatch = text.match(/(?:Tuổi):\s*(\d+)/i);
                    if (ageMatch) age = ageMatch[1];
                }
                if (gender && age) break;
            }
        }

        const result = { gender, age, dob };
        cache.demographics = result;
        return result;
    },

    fetchFromBridge(requestType, resultType, rowId, params = {}) {
        return new Promise((resolve) => {
            const reqId = Date.now() + Math.random();
            const listener = (event) => {
                if (event.data && event.data.type === resultType && event.data.requestId === reqId) {
                    window.removeEventListener('message', listener);
                    resolve(event.data);
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
                type: requestType,
                rowId: rowId,
                requestId: reqId,
                token: token,
                nonce: window.__ALADINN_NONCE__,
                ...params
            }, window.location.origin);
        });
    },

    getActiveRowId() {
        const els = this.getElementsAcrossIframes('#grdBenhNhan tr.ui-state-highlight, #grdDSBenhNhan tr.ui-state-highlight', true);
        for (const el of els) {
            if (el.id) return el.id;
        }
        return null;
    },

    verifyContextLock(ctx) {
        if (!ctx) return false;
        
        const domPatientId = this.getPatientId();
        const cache = CDSCache.get();
        
        // Normalize IDs to trimmed strings to avoid number vs string strict equality mismatches
        const normCtxBenhNhanId = ctx.BENHNHANID ? String(ctx.BENHNHANID).trim() : '';
        const normCtxRowId = ctx.rowId ? String(ctx.rowId).trim() : '';
        const normCtxKhamBenhId = ctx.KHAMBENHID ? String(ctx.KHAMBENHID).trim() : '';
        
        const normDomPatientId = domPatientId ? String(domPatientId).trim() : '';
        let normCacheBenhNhanId = cache.benhnhanId ? String(cache.benhnhanId).trim() : '';
        let normCacheKhamBenhId = cache.khambenhId ? String(cache.khambenhId).trim() : '';
        const normDomEncounterId = this.getEncounterId() ? String(this.getEncounterId()).trim() : '';

        // 1. Validate BENHNHANID if present in context
        let patientIdMatch = true;
        if (normCtxBenhNhanId) {
            patientIdMatch = (
                normCtxBenhNhanId === normDomPatientId || 
                normCtxBenhNhanId === normCacheBenhNhanId ||
                (cache.patientIds && cache.patientIds.has(normCtxBenhNhanId))
            );
        }

        // 2. Validate rowId if present in context
        let rowIdMatch = true;
        if (normCtxRowId) {
            rowIdMatch = (
                normCtxRowId === normDomPatientId || 
                normCtxRowId === normCacheKhamBenhId ||
                (cache.patientIds && cache.patientIds.has(normCtxRowId))
            );
        }

        // If neither is present, we cannot verify the identity, so we fail closed
        if (!normCtxBenhNhanId && !normCtxRowId) {
            return false;
        }

        // Both must be valid (not mismatched)
        let identityMatch = patientIdMatch && rowIdMatch;

        // Name-based fallback when cache is cold or initial check fails
        if (!identityMatch) {
            const domName = this.getPatientName();
            const ctxName = ctx.patientName || ctx.TENTEN || '';
            
            const cleanDomName = this._cleanName(domName);
            const cleanCtxName = this._cleanName(ctxName);
            
            if (cleanDomName && cleanCtxName && cleanDomName.length >= 3 && cleanDomName === cleanCtxName) {
                console.log(`[Aladinn CDS Context Lock] 🛡️ Name match fallback passed: "${domName}" === "${ctxName}". Warming cache.`);
                
                // Warm the cache with the API IDs to enable subsequent context validation locks to pass
                if (normCtxBenhNhanId) {
                    cache.benhnhanId = normCtxBenhNhanId;
                    normCacheBenhNhanId = normCtxBenhNhanId;
                    if (cache.patientIds) cache.patientIds.add(normCtxBenhNhanId);
                }
                if (normCtxRowId) {
                    if (cache.patientIds) cache.patientIds.add(normCtxRowId);
                }
                if (normCtxKhamBenhId) {
                    cache.khambenhId = normCtxKhamBenhId;
                    normCacheKhamBenhId = normCtxKhamBenhId;
                }
                // Set the patient key if both IDs are available
                if (normCtxBenhNhanId && normCtxKhamBenhId) {
                    CDSCache._patientKey = `${normCtxBenhNhanId}_${normCtxKhamBenhId}`;
                }
                
                identityMatch = true;
            }
        }

        // 3. Check encounter/admission key: KHAMBENHID matching Cache or DOM
        const encounterIdMatch = (
            !normCtxKhamBenhId ||
            normCtxKhamBenhId === normCacheKhamBenhId ||
            normCtxKhamBenhId === normDomEncounterId
        );

        if (!identityMatch || !encounterIdMatch) {
            console.error(
                '[Aladinn CDS Context Lock] ❌ Patient identity or encounter mismatch detected! Purging context. ' +
                `DOM Patient: ${normDomPatientId}, Cache: ${normCacheBenhNhanId}_${normCacheKhamBenhId}, ` +
                'API context:', ctx
            );
            return false;
        }

        return true;
    },

    _cleanName(name) {
        if (!name) return '';
        return String(name)
            .replace(/<[^>]*>/g, '') // Strip HTML tags
            .replace(/đ/g, 'd')
            .replace(/Đ/g, 'd')
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '') // Strip diacritics
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // Strip special chars/emojis
            .trim();
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
            
            // Match dạng "123456789 | NGUYỄN VĂN A" (cho phép khoảng trắng phía trước)
            const match2 = text.match(/^\s*(\d{8,12})\s*\|/);
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
            
            // Match dạng "123456789 | NGUYỄN HỮU ĐẢM |" (cho phép khoảng trắng phía trước)
            const match2 = text.match(/^\s*\d{8,12}\s*\|\s*([A-ZÀÁẢÃẠĂẮẰẲẴẶÂẤẦẨẪẬĐÈÉẺẼẸÊẾỀỂỄỆÌÍỈĨỊÒÓỎÕỌÔỐỒỔỖỘƠỚỜỞỠỢÙÚỦŨỤƯỨỪỬỮỰỲÝỶỸỴ\s]+)\s*\|/i);
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

    async getWeight() {
        const cache = CDSCache.get();
        if (cache.weight && cache.weight > 0) return cache.weight;

        // Try API fetch via bridge first
        try {
            const activeRowId = this.getActiveRowId();
            const res = await this.fetchFromBridge('REQ_FETCH_VITALS', 'FETCH_VITALS_RESULT', activeRowId);
            if (res && res.vitals && res.vitals.weight) {
                // Verify Context Lock
                if (res._context && !this.verifyContextLock(res._context)) {
                    throw new Error('Context lock mismatch');
                }
                const w = parseFloat(res.vitals.weight);
                if (!isNaN(w) && w > 0) {
                    console.log('[Aladinn CDS] 📡 Weight from API:', w);
                    return w;
                }
            }
        } catch (e) {
            console.log('[Aladinn CDS] API fetch weight failed, falling back to DOM:', e);
        }

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
                if (diag && diag.code) {
                    diagnoses.push(diag);
                    seenCodes.add(diag.code.toUpperCase());
                }
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

    async getMedications() {
        const meds = [];
        const debugPipeline = []; // Track extraction pipeline for console
        
        // ===== SOURCE 1: CDSCache (API Snooping — fastest, most reliable) =====
        const cache = CDSCache.get();
        const cacheFresh = cache._medsTimestamp && (Date.now() - cache._medsTimestamp < 300000); // 5 min TTL
        if (cache.medications && cache.medications.length > 0 && cacheFresh) {
            meds.push(...cache.medications);
            debugPipeline.push(`[Cache] ${cache.medications.length} drugs (fresh)`);
            
            // Deduplicate even for cache hits
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
            return uniqueMeds;
        }

        // ===== SOURCE 2: API Bridge (Selective API Integration) =====
        let apiMeds = [];
        try {
            const activeRowId = this.getActiveRowId();
            const careSetting = this.getCareSetting();
            const reqType = careSetting === 'ipd' ? 'REQ_FETCH_DRUGS_CLS' : 'REQ_FETCH_DRUGS';
            const resType = careSetting === 'ipd' ? 'FETCH_DRUGS_CLS_RESULT' : 'FETCH_DRUGS_RESULT';
            
            const res = await this.fetchFromBridge(reqType, resType, activeRowId);
            if (res && res.drugList && res.drugList.length > 0) {
                // Verify Context Lock
                if (res._context && this.verifyContextLock(res._context)) {
                    // Map and filter medications
                    for (const r of res.drugList) {
                        let name = (r.TENTHUOC || '').replace(/[\s\u00a0\u200b]+/g, ' ').trim();
                        let generic = (r.HOATCHAT || r.HAMLUONG || '').replace(/[\s\u00a0\u200b]+/g, ' ').trim();
                        
                        name = this._filterDrugName(name, generic);
                        if (!name) continue;
                        
                        // Clean up ngoặc
                        if (name.includes('(') && name.includes(')')) {
                            const match = name.match(/\((.*?)\)/);
                            if (match && !generic) generic = match[1].trim();
                            name = name.split('(')[0].trim();
                        }
                        
                        if (name.length > 1) {
                            apiMeds.push({
                                display_name: name,
                                generic_candidate: (generic && generic !== '-') ? generic : null
                            });
                        }
                    }
                    if (apiMeds.length > 0) {
                        debugPipeline.push(`[API] ${apiMeds.length} drugs`);
                        // Deduplicate API drugs before caching
                        const uniqueApiMeds = [];
                        const seenApi = new Set();
                        for (const m of apiMeds) {
                            const k = m.display_name.toLowerCase();
                            if (!seenApi.has(k)) {
                                seenApi.add(k);
                                uniqueApiMeds.push(m);
                            }
                        }
                        // Cập nhật Cache để lần sau đỡ gọi lại
                        cache.medications = uniqueApiMeds;
                        cache._medsTimestamp = Date.now();
                        meds.push(...uniqueApiMeds);
                    }
                } else if (res._context) {
                    console.warn('[Aladinn CDS] ⚠️ Drug API Context Mismatch. Skipping API payload.');
                }
            }
        } catch (e) {
            console.log('[Aladinn CDS] API fetch medications failed, falling back to DOM grids:', e);
        }

        // ===== SOURCE 3: Targeted Grid Scanner (column-header aware fallback) =====
        if (meds.length === 0) {
            const gridMeds = this._scanDrugGrids();
            if (gridMeds.length > 0) {
                debugPipeline.push(`[Grid] ${gridMeds.length} drugs`);
                for (const m of gridMeds) {
                    meds.push(m);
                }
            }
        }

        // ===== SOURCE 4: Generic DOM Scanner (fallback — quét mọi <tr>) =====
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
        
        // Cải tiến: Hỗ trợ cả bảng HTML thường và jqGrid (tách header/data riêng)
        const grids = this.getElementsAcrossIframes('.ui-jqgrid, table');
        const processedGrids = new Set();
        
        for (const grid of grids) {
            // Tránh xử lý trùng table con nằm trong jqGrid
            if (grid.tagName.toLowerCase() === 'table' && grid.closest && grid.closest('.ui-jqgrid')) continue;
            if (processedGrids.has(grid)) continue;
            processedGrids.add(grid);

            // Lấy dòng header chính xác nhất
            let headerRow = grid.querySelector('tr.ui-jqgrid-labels');
            if (!headerRow) headerRow = grid.querySelector('thead tr');
            if (!headerRow) continue;
            
            const headers = headerRow.querySelectorAll('th');
            if (headers.length < 3) continue;
            
            // Detect column indices based ONLY on the actual header row
            let nameCol = -1, dosageCol = -1;
            headers.forEach((th, i) => {
                const text = (th.innerText || th.textContent || '').trim().toLowerCase();
                if (text.includes('tên thuốc') || text.includes('tên dịch vụ')) nameCol = i;
                if (text.includes('nồng độ') || text.includes('hàm lượng') || text.includes('hoạt chất')) dosageCol = i;
            });
            
            if (nameCol === -1) continue; // Không phải bảng thuốc
            
            // Quét data rows (với jqGrid, rows nằm trong .ui-jqgrid-bdiv)
            let dataContainer = grid;
            if (grid.classList && grid.classList.contains('ui-jqgrid')) {
                const bdiv = grid.querySelector('.ui-jqgrid-bdiv');
                if (bdiv) dataContainer = bdiv;
            }
            
            const rows = dataContainer.querySelectorAll('tr');
            for (const row of rows) {
                if (row.querySelector('th')) continue;
                
                // jqGrid thường có 1 dòng giả jqgfirstrow để định dạng chiều rộng
                if (row.classList && row.classList.contains('jqgfirstrow')) continue;
                
                const cells = row.querySelectorAll('td');
                if (cells.length <= nameCol) continue;
                
                let name = (cells[nameCol]?.innerText || '').replace(/[\s\u00a0\u200b]+/g, ' ').trim();
                let generic = dosageCol >= 0 && cells[dosageCol] ? (cells[dosageCol]?.innerText || '').replace(/[\s\u00a0\u200b]+/g, ' ').trim() : '';
                
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
        const DRUG_ROUTES = ['uống', 'tiêm', 'bôi', 'nhỏ', 'đặt', 'ngậm', 'hít', 'xịt', 'truyền', 'ngoài da', 'tiêm bắp', 'tiêm tĩnh mạch', 'pha tiêm', 'súc miệng'];

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

            let name = textCols.length >= 1 ? textCols[0].value.replace(/[\s\u00a0\u200b]+/g, ' ').trim() : '';
            let generic = textCols.length >= 2 ? textCols[1].value.replace(/[\s\u00a0\u200b]+/g, ' ').trim() : '';

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
            'nước muối', 'natri clorid', 'nacl', 'normal saline', 'sodium chloride', 'natriclorid',
            'glucose 5%', 'dextrose 5%',
            'cồn 70', 'cồn 90', 'alcool 70', 'alcool 90', 'alcohol',
            'oxy y tế', 'oxy lỏng', 'oxygen',
            'kim tiêm', 'kim luồn', 'bơm tiêm', 'pen ndl', 'kim pen',
            'dây truyền', 'bộ dây', 'catheter',
            'băng keo', 'gạc', 'bông', 'găng tay',
            'dung dịch rửa', 'nước rửa tay', 'povidone', 'betadine',
            // Dịch vụ kỹ thuật, thủ thuật, phẫu thuật, khám bệnh
            'thay băng', 'cắt chỉ', 'vết mổ', 'khâu vết thương',
            'khám bệnh', 'giường bệnh', 'tiền giường', 'phẫu thuật', 'thủ thuật',
            'siêu âm', 'x-quang', 'xquang', 'nội soi', 'xét nghiệm', 'điện tim', 'chụp ct', 'chụp cắt lớp', 'mri'
        ];
        const nameLower = name.toLowerCase();
        if (NOT_DRUGS.some(nd => nameLower.includes(nd))) return '';
        
        // Detect patient/doctor names: Title Case / ALL UPPER
        if (name.length > 6 && !/\d/.test(name)) {
            const words = name.trim().split(/\s+/);
            if (words.length >= 2 && words.length <= 6) {
                const isAllUpper = name === name.toUpperCase();
                const isTitleCase = words.every(w => w.length > 0 && w[0] === w[0].toUpperCase() && w.slice(1) === w.slice(1).toLowerCase());
                if (isAllUpper || isTitleCase) {
                    const hasVnDiacritics = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(name);
                    const hasMedKeyword = /injection|solution|cream|tablet|capsule|sodium|chloride|acid|hydro|amine|oxacin|mycin|azole|prazole|statin|sartan|dipine|olol|cillin|mab|nib|parin|phylline|cortis|predniso|metro|pharm/i.test(name);
                    
                    const firstWord = words[0].toLowerCase();
                    const commonVnSurnames = ['nguyen', 'nguyễn', 'tran', 'trần', 'le', 'lê', 'pham', 'phạm', 'hoang', 'hoàng', 'huynh', 'huỳnh', 'phan', 'vu', 'vũ', 'vo', 'võ', 'dang', 'đặng', 'bui', 'bùi', 'do', 'đỗ', 'ho', 'hồ', 'ngo', 'ngô', 'duong', 'dương', 'ly', 'lý'];
                    const hasVnSurname = commonVnSurnames.includes(firstWord);

                    if (hasMedKeyword) {
                        // Giữ — đây là thuốc
                    } else if (hasVnDiacritics || hasVnSurname) {
                        return ''; // Tên người VN
                    }
                }
            }
        }
        
        return name;
    },

    async getLabs() {
        const labs = [];
        const seenKeys = new Set();
        const debugPipeline = [];

        const cache = CDSCache.get();
        const cacheFresh = cache._labsTimestamp && (Date.now() - cache._labsTimestamp < 300000); // 5 min TTL
        if (cache.labs && cache.labs.length > 0 && cacheFresh) {
            debugPipeline.push(`[Cache] ${cache.labs.length} labs (fresh)`);
            for (const lab of cache.labs) {
                if (!seenKeys.has(lab.code)) {
                    seenKeys.add(lab.code);
                    labs.push(lab);
                }
            }
            console.log(`[Aladinn CDS] 🧪 Pipeline: ${debugPipeline.join(' → ')} | Final: ${labs.length} unique labs`);
            return labs;
        }

        // ===== SOURCE 1: Selective API Integration (REQ_FETCH_LABS) =====
        let apiLabs = [];
        try {
            const activeRowId = this.getActiveRowId();
            const res = await this.fetchFromBridge('REQ_FETCH_LABS', 'FETCH_LABS_RESULT', activeRowId);
            if (res && res.labsData && res.labsData.length > 0) {
                // Verify Context Lock
                if (res._context && this.verifyContextLock(res._context)) {
                    for (const lab of res.labsData) {
                        const parsed = this._parseLab(lab.code || lab.testName, lab.value, lab.unit, lab.refDisplay);
                        if (parsed && !seenKeys.has(parsed.code)) {
                            seenKeys.add(parsed.code);
                            apiLabs.push(parsed);
                        }
                    }
                    if (apiLabs.length > 0) {
                        debugPipeline.push(`[API] ${apiLabs.length} labs`);
                        cache.labs = apiLabs;
                        cache._labsTimestamp = Date.now();
                        labs.push(...apiLabs);
                    }
                } else if (res._context) {
                    console.warn('[Aladinn CDS] ⚠️ Labs API Context Mismatch. Skipping API payload.');
                }
            }
        } catch (e) {
            console.log('[Aladinn CDS] API fetch labs failed, falling back to cached or DOM:', e);
        }

        // ===== SOURCE 2: Cached API data from Scanner (fallback 1) =====
        // When user runs "Quét Xét Nghiệm", results are stored in window._aladinn_cds_labs
        if (labs.length === 0) {
            const cachedLabs = window._aladinn_cds_labs || [];
            if (cachedLabs.length > 0) {
                debugPipeline.push(`[Scanner Cache] ${cachedLabs.length} raw`);
                for (const lab of cachedLabs) {
                    const parsed = this._parseLab(lab.TENDICHVU, lab.GIATRI_KETQUA, lab.DONVI, lab.TRISOBINHTHUONG);
                    if (parsed && !seenKeys.has(parsed.code)) {
                        seenKeys.add(parsed.code);
                        labs.push(parsed);
                    }
                }
            }
        }

        // ===== SOURCE 3: DOM Scraping for visible lab grids (fallback 2) =====
        if (labs.length === 0) {
            const clsRows = this.getElementsAcrossIframes('.grid-cls tr, #gridKetQuaCLS_Body tr, #grd_KQCLS tr, [id*="gridCLS"] tr');
            if (clsRows.length > 0) {
                let domCount = 0;
                clsRows.forEach(row => {
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
                            domCount++;
                        }
                    }
                });
                if (domCount > 0) {
                    debugPipeline.push(`[DOM] ${domCount} labs`);
                }
            }
        }

        console.log(`[Aladinn CDS] 🧪 Pipeline: ${debugPipeline.length > 0 ? debugPipeline.join(' → ') : '[None]'} | Final: ${labs.length} unique labs`);
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

        // Chuẩn hóa tên xét nghiệm sang không dấu, chữ thường để so khớp chính xác 100% tiếng Việt
        const n = this._cleanName(name);
        let code = null;

        // === Kidney / Renal ===
        if (n.includes('egfr') || n.includes('muc loc cau than') || n.includes('gfr')) code = 'eGFR';
        else if (n.includes('creatinin')) code = 'creatinine';
        else if (n.includes('ure') && !n.includes('uric')) code = 'urea';
        else if (n.includes('acid uric') || n.includes('uric acid') || n.includes('uric')) code = 'uric_acid';
        
        // === Liver ===
        else if (/\bast\b|sgot|aspartate/i.test(n)) code = 'AST';
        else if (/\balt\b|sgpt|alanine/i.test(n)) code = 'ALT';
        else if (n.includes('bilirubin toan phan') || (n.includes('bilirubin') && n.includes('total'))) code = 'bilirubin_total';
        else if (n.includes('bilirubin truc tiep') || (n.includes('bilirubin') && n.includes('direct'))) code = 'bilirubin_direct';
        else if (/\bggt\b|gamma/i.test(n)) code = 'GGT';

        // === Blood Sugar ===
        else if (n.includes('glucose') || n.includes('duong huyet') || n.includes('duong mau') || n.includes('glycemi') || n.includes('mao mach')) code = 'glucose';
        else if (n.includes('hba1c') || n.includes('hemoglobin a1c')) code = 'HbA1c';

        // === Electrolytes (Nhận diện thêm chữ K, Na, Cl đơn lẻ cực kỳ chính xác) ===
        else if (/\bkali\b|^k$|\bk\+|\bpotassium/i.test(n)) code = 'potassium';
        else if (/\bnatri\b|^na$|\bna\+|\bsodium/i.test(n)) code = 'sodium';
        else if (/\bcl\b|^cl$|\bchloride/i.test(n)) code = 'chloride';

        // === Coagulation ===
        else if (n.includes('pt inr') || n === 'inr') code = 'INR';
        else if (n.includes('pt %') || n.includes('ty le prothrombin') || (n.includes('pt') && n.includes('%'))) code = 'PT_percent';
        else if (n.includes('aptt') || n.includes('ptt')) code = 'aPTT';

        // === Hematology ===
        else if (/\bhemoglobin\b|\bhgb\b|\bhb\b/i.test(n) && !n.includes('a1c')) code = 'hemoglobin';
        else if (n.includes('tieu cau') || n.includes('platelet') || /\bplt\b/i.test(n)) code = 'platelet';
        else if (n.includes('bach cau') || n.includes('wbc') || n.includes('white blood')) code = 'WBC';
        else if (n.includes('neut') || n.includes('trung tinh') || n.includes('neutrophil')) code = 'neutrophil';

        // === Lipids ===
        else if (n.includes('cholesterol toan phan') || n === 'cholesterol') code = 'cholesterol';
        else if (n.includes('triglycerid')) code = 'triglyceride';
        else if (n.includes('ldl')) code = 'LDL';
        else if (n.includes('hdl')) code = 'HDL';

        // === Thyroid ===
        else if (/\btsh\b/i.test(n)) code = 'TSH';
        else if (/\bft4\b|\bfree t4/i.test(n)) code = 'FT4';

        // === Cardiac ===
        else if (n.includes('troponin')) code = 'troponin';
        else if (n.includes('ck mb') || n.includes('ckmb')) code = 'CK_MB';
        else if (n.includes('bnp') || n.includes('nt probnp')) code = 'BNP';

        if (!code) return null;

        let parsedValue = value;
        // Quy đổi glucose từ mg/dL hoặc mg% sang mmol/L y khoa thống nhất cho CDS
        if (code === 'glucose') {
            const isMgDl = (unit && String(unit).toLowerCase().includes('mg')) || 
                           (refRange && String(refRange).toLowerCase().includes('mg')) ||
                           value > 25; // Chỉ số glucose mmol/L hiếm khi vượt quá 25, nếu >25 chắc chắn là mg/dL (mg%)
            if (isMgDl) {
                parsedValue = parseFloat((value / 18).toFixed(2));
            }
        }

        return { code, value: parsedValue, unit: unit || '', refRange: refRange || '' };
    },


    getCareSetting() {
        // IPD (Inpatient) hoặc OPD (Outpatient)
        const url = window.location.href.toLowerCase();
        if (url.includes('noitru') || url.includes('todieutri')) return 'ipd';
        return 'opd'; // Khám ngoại trú
    }
};
