/**
 * AJAX Interceptor
 * Intercepts jQuery.ajax calls to capture tokens and implement retry logic.
 * SECURITY: Includes per-session nonce in postMessage for verification.
 */
(function () {
    // SECURITY: Read nonce from data attribute (set by content.js)
    const _NONCE = document.currentScript?.dataset?.aladinnNonce || '';
    const _$ = window['$'] || window['jQuery'];
    if (!_$ || !_$.ajax) return;

    const originalAjax = _$.ajax;
    const RETRY_CONFIG = {
        maxRetries: 3,
        baseDelayMs: 500
    };

    _$.ajax = function (options) {
        const success = options.success;
        const error = options.error;
        const currentAttempt = options._vnptRetryAttempt || 0;

        // 1. Token Capture
        if (options.data) {
            try {
                const dataStr = typeof options.data === 'string' ? options.data : JSON.stringify(options.data);
                if (dataStr.includes('"uuid"')) {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.uuid && parsed.uuid.startsWith('ey') && window.JWTStore) {
                        window.JWTStore.set(parsed.uuid);
                    }
                }
            } catch (_e) { }
        }

        // 2. Wrap Callbacks
        options.success = function (data, _textStatus, _jqXHR) {
            // --- Heuristic Snooping for CDS ---
            try {
                let payload = { patientId: null, benhnhanId: null, khambenhId: null, maBa: null, weight: null, diagnoses: [], medications: [], labs: [] };
                let hasData = false;
                


                let items = [];
                if (data && data.rows) items = data.rows;
                else if (Array.isArray(data)) items = data;
                else if (typeof data === 'string' && data.includes('"rows":')) {
                    try { items = JSON.parse(data).rows || []; } catch(_e){}
                }
                else if (data && typeof data === 'object' && !Array.isArray(data)) items = [data];

                if (items.length > 0) {
                    items.forEach(item => {
                        if (!item) return;
                        
                        // Extract specific IDs for background fetching
                        if (!payload.benhnhanId && item.BENHNHANID) payload.benhnhanId = String(item.BENHNHANID);
                        if (!payload.khambenhId && item.KHAMBENHID) payload.khambenhId = String(item.KHAMBENHID);
                        if (!payload.khambenhId && item.MADIEUTRI) payload.khambenhId = String(item.MADIEUTRI);
                        if (!payload.maBa && item.MABA) payload.maBa = String(item.MABA);

                        // Patient ID global search - Ưu tiên Mã Bệnh Án (MABA) vì nó hiển thị trên UI
                        if (!payload.patientId && item.MABA) payload.patientId = String(item.MABA);
                        if (!payload.patientId && item.SOBENHAN) payload.patientId = String(item.SOBENHAN);
                        if (!payload.patientId && item.MABENHAN) payload.patientId = String(item.MABENHAN);
                        if (!payload.patientId && item.BENHNHANID) payload.patientId = String(item.BENHNHANID);
                        if (!payload.patientId && item.KHAMBENHID) payload.patientId = String(item.KHAMBENHID);
                        if (!payload.patientId && item.HOSOBENHANID) payload.patientId = String(item.HOSOBENHANID);
                    });
                    
                    // NẾU KHÔNG TÌM THẤY PATIENT ID TRONG DỮ LIỆU TRẢ VỀ, RẤT CÓ THỂ ĐÂY LÀ KẾT QUẢ TỪ AUTOCOMPLETE / TỪ ĐIỂN TÌM KIẾM
                    // BỎ QUA GHI NHẬN THUỐC VÀ CHẨN ĐOÁN (tránh lỗi ghost item khi chưa thêm thuốc).
                    const isPatientSpecific = payload.patientId !== null;

                    items.forEach(item => {
                        if (!item) return;

                        // 1. Labs (Cận Lâm Sàng) - Labs luôn đi kèm bệnh nhân, quét nếu có

                        // Heuristic: có TENXETNGHIEM hoặc TENDICHVU và có GIATRI_KETQUA, DONVI
                        if ((item.TENXETNGHIEM || item.TENDICHVU || item.TENCHIDINH) && (item.GIATRI_KETQUA || item.KETQUACLS)) {
                            const name = (item.TENXETNGHIEM || item.TENDICHVU || item.TENCHIDINH).toLowerCase().trim();
                            const valStr = String(item.GIATRI_KETQUA || item.KETQUACLS).replace(',', '.');
                            const val = parseFloat(valStr);
                            let code = null;
                            
                            if (!isNaN(val)) {
                                if (name.includes('egfr') || name.includes('mức lọc cầu thận') || name.includes('gfr')) code = 'eGFR';
                                else if (name.includes('creatinin') || name.includes('créatinine')) code = 'creatinine';
                                else if (name.includes('ure') && !name.includes('uric')) code = 'urea';
                                else if (name.includes('acid uric') || name.includes('uric acid')) code = 'uric_acid';
                                else if (/\bast\b|sgot|aspartate/i.test(name)) code = 'AST';
                                else if (/\balt\b|sgpt|alanine/i.test(name)) code = 'ALT';
                                else if (name.includes('bilirubin') && (name.includes('toàn phần') || name.includes('total'))) code = 'bilirubin_total';
                                else if (name.includes('bilirubin') && (name.includes('trực tiếp') || name.includes('direct'))) code = 'bilirubin_direct';
                                else if (/\bggt\b|gamma/i.test(name)) code = 'GGT';
                                else if (name.includes('glucose') || name.includes('đường huyết') || name.includes('glycemi')) code = 'glucose';
                                else if (name.includes('hba1c') || name.includes('hemoglobin a1c')) code = 'HbA1c';
                                else if (/\bkali\b|\bk\+|\bpotassium/i.test(name)) code = 'potassium';
                                else if (/\bnatri\b|\bna\+|\bsodium/i.test(name)) code = 'sodium';
                                else if (name.includes('pt inr') || name === 'inr') code = 'INR';
                                else if (name.includes('pt %') || name.includes('tỷ lệ prothrombin') || (name.includes('pt') && name.includes('%'))) code = 'PT_percent';
                                else if (name.includes('aptt') || name.includes('ptt')) code = 'aPTT';
                                else if (/\bhemoglobin\b|\bhgb\b|\bhb\b/i.test(name) && !name.includes('a1c')) code = 'hemoglobin';
                                else if (name.includes('tiểu cầu') || name.includes('platelet') || /\bplt\b/i.test(name)) code = 'platelet';
                                else if (name.includes('bạch cầu') || name.includes('wbc') || name.includes('white blood')) code = 'WBC';
                                else if (name.includes('cholesterol') && name.includes('toàn phần') || name === 'cholesterol') code = 'cholesterol';
                                else if (name.includes('triglycerid')) code = 'triglyceride';
                                else if (name.includes('ldl')) code = 'LDL';
                                else if (name.includes('hdl')) code = 'HDL';
                                else if (/\btsh\b/i.test(name)) code = 'TSH';
                                else if (/\bft4\b|\bfree t4/i.test(name)) code = 'FT4';
                                else if (name.includes('troponin')) code = 'troponin';
                                else if (name.includes('ck-mb') || name.includes('ckmb')) code = 'CK_MB';
                                else if (name.includes('bnp') || name.includes('nt-probnp')) code = 'BNP';
                            }
                            
                            if (code) {
                                payload.labs.push({ code: code, value: val, unit: item.DONVI || '', refRange: item.TRISOBINHTHUONG || '' });
                                hasData = true;
                            }
                        }

                        // 2. Thuốc (Medications)
                        // Heuristic: Có TENDICHVU / TENTHUOC nhưng không phải Xét nghiệm và phải là dữ liệu của Bệnh nhân (không phải từ điển)
                        if (isPatientSpecific && (item.TENDICHVU || item.TENTHUOC) && (item.DUONGDUNG || item.TENDUONGDUNG || item.SUDUNG || item.LIEUDUNG) && !item.GIATRI_KETQUA) {
                            let nameAttr = item.TENDICHVU || item.TENTHUOC;
                            let generic = '';
                            if (nameAttr.includes('(') && nameAttr.includes(')')) {
                                const match = nameAttr.match(/\((.*?)\)/);
                                if (match) generic = match[1].trim();
                                nameAttr = nameAttr.split('(')[0].trim();
                            }
                            // Filter nhiễu
                            const lowerName = nameAttr.toLowerCase();
                            const isNoise = ['nước cất', 'nước muối', 'nacl 0.9', 'kim tiêm', 'bơm tiêm', 'glucose 5%', 'oxy y tế', 'dây truyền', 'găng tay'].some(nd => lowerName.includes(nd));
                            if (!isNoise && nameAttr.length > 2) {
                                payload.medications.push({
                                    display_name: nameAttr,
                                    generic_candidate: generic || null
                                });
                                hasData = true;
                            }
                        }

                        // 3. Chẩn đoán (Diagnoses & ICD)
                        // Bắt cả mã chính và các mã phụ (thường bị ngăn cách bởi dấu phẩy)
                        let combinedIcd = '';
                        Object.values(item).forEach(val => {
                            if (typeof val === 'string' && val.length >= 3) {
                                combinedIcd += ',' + val;
                            }
                        });
                        combinedIcd = combinedIcd.toUpperCase();
                        
                        if (isPatientSpecific && combinedIcd) {
                            const matches = combinedIcd.match(/\b[A-Z]\d{2,3}(?:\.\d{1,2})?\b/g);
                            if (matches) {
                                matches.forEach(code => {
                                    payload.diagnoses.push({
                                        code: code,
                                        is_primary: payload.diagnoses.length === 0
                                    });
                                });
                                hasData = true;
                            }
                        }

                        // 4. Sinh hiệu (Vitals / Weight)
                        if (item.CANNANG && item.CANNANG !== '0') {
                            payload.weight = parseFloat(item.CANNANG);
                            hasData = true;
                        }
                    });
                }

                if (hasData) {
                    window.postMessage({ type: 'ALADINN_CDS_SNOOP', nonce: _NONCE, payload: payload }, window.location.origin);
                }
            } catch (_snoopErr) {
                // Silent fail for snooping
            }

            if (success) success.apply(this, arguments);
        };

        options.error = function (jqXHR, textStatus, _errorThrown) {
            const shouldRetry = (textStatus === 'timeout' || textStatus === 'error' || jqXHR.status >= 500);
            if (shouldRetry && currentAttempt < RETRY_CONFIG.maxRetries) {
                const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, currentAttempt);
                setTimeout(() => {
                    const retryOptions = _$.extend(true, {}, options);
                    retryOptions._vnptRetryAttempt = currentAttempt + 1;
                    originalAjax.call(_$, retryOptions);
                }, delay);
            } else {
                if (error) error.apply(this, arguments);
            }
        };

        try {
            return originalAjax.apply(this, arguments);
        } catch (_e) {
            if (error) error.call(this, { status: 0 }, 'error', _e.message);
            return null;
        }
    };
})();
