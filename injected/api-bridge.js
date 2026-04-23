/**
 * API Bridge v5.1.0 — Security Hardened
 * Handles communication between the extension and HIS APIs via jsonrpc.
 * SECURITY: Only whitelisted intents are accepted (no arbitrary SP calls).
 */
(function () {
    const _jsonrpc = window['jsonrpc'];
    if (!_jsonrpc) return;

    const _$ = window['$'] || window['jQuery'];

    // SECURITY: Get token assigned by extension
    const SECURE_TOKEN = document.currentScript ? document.currentScript.getAttribute('data-aladinn-token') : null;

    // Cache to prevent duplicate simultaneous requests from multiple modules
    const vitalsCache = {};

    window.addEventListener('message', function (event) {
        // SECURITY: Allow local origin or any origin on the same domain if needed
        if (event.origin !== window.location.origin) return;
        if (!event.data || !event.data.type) return;

        // SECURITY: Verify token for requests
        if (event.data.type.startsWith('REQ_')) {
            if (!SECURE_TOKEN || event.data.token !== SECURE_TOKEN) {
                console.warn('[Aladinn API-Bridge] Unauthorized request blocked (Invalid token)');
                return;
            }
        }

        switch (event.data.type) {
            case 'REQ_FETCH_HISTORY':
                fetchHistory(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_ROOM':
                fetchRoom(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_TREATMENT':
                fetchTreatment(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_DRUGS':
                fetchDrugs(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_PTTT':
                fetchPttt(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_LABS':
                fetchLabs(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_DIAGNOSES':
                fetchDiagnosesForCDS(event.data.rowId, event.data.benhnhanId, event.data.khambenhId, event.data.requestId);
                break;
            case 'TRIGGER_PTTT_PRINT':
                triggerPtttPrint(event.data.rowId);
                break;
            case 'REQ_FETCH_VITALS':
                fetchVitals(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_DRUGS_CLS':
                fetchDrugsForCLS(event.data.rowId, event.data.requestId);
                break;
            // SECURITY: REQ_CALL_SP has been removed to prevent arbitrary SP execution via XSS.
        }
    });

    function fetchHistory(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_HISTORY_RESULT', rowId, { history: {} }, requestId);
                return;
            }
            const grid = _$('#grdBenhNhan');
            const rowData = grid.jqGrid('getRowData', rowId);
            const hsbaId = rowData.HOSOBENHANID || rowData.HSBAID;

            if (!hsbaId) {
                sendResult('FETCH_HISTORY_RESULT', rowId, { history: {} }, requestId);
                return;
            }

            const params = JSON.stringify({ HOSOBENHANID: hsbaId });
            const result = _jsonrpc.AjaxJson.ajaxCALL_SP_O('NT.006.HSBA.HIS', params, 0);
            const data = (typeof result === 'string' && result.trim() !== '') ? JSON.parse(result) : result;
            const records = Array.isArray(data) ? data : [data];

            let historyData = {};
            for (let i = records.length - 1; i >= 0; i--) {
                const rec = records[i];
                if (!rec) continue;
                if (rec.LYDOVAOVIEN && !historyData.LYDOVAOVIEN) historyData.LYDOVAOVIEN = rec.LYDOVAOVIEN;
                if (rec.QUATRINHBENHLY && !historyData.QUATRINHBENHLY) historyData.QUATRINHBENHLY = rec.QUATRINHBENHLY;
                if (rec.TIENSUBENH_BANTHAN && !historyData.TIENSUBENH_BANTHAN) historyData.TIENSUBENH_BANTHAN = rec.TIENSUBENH_BANTHAN;
                if (rec.KHAMBENH_TOANTHAN && !historyData.KHAMBENH_TOANTHAN) historyData.KHAMBENH_TOANTHAN = rec.KHAMBENH_TOANTHAN;
                if (rec.KHAMBENH_BOPHAN && !historyData.KHAMBENH_BOPHAN) historyData.KHAMBENH_BOPHAN = rec.KHAMBENH_BOPHAN;
                if (rec.TOMTATKQCANLAMSANG && !historyData.TOMTATKQCANLAMSANG) historyData.TOMTATKQCANLAMSANG = rec.TOMTATKQCANLAMSANG;
            }

            sendResult('FETCH_HISTORY_RESULT', rowId, { history: historyData }, requestId);
        } catch (e) {
            console.error('[API-Bridge] fetchHistory error:', e);
            sendResult('FETCH_HISTORY_RESULT', rowId, { history: {} }, requestId);
        }
    }

    function fetchRoom(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_ROOM_RESULT', rowId, { giuong: '' }, requestId);
                return;
            }
            const grid = _$('#grdBenhNhan');
            const rowData = grid.jqGrid('getRowData', rowId);
            const khambenhId = rowData.KHAMBENHID || rowData.MADIEUTRI || rowId;

            const result = _jsonrpc.AjaxJson.ajaxCALL_SP_O('NT.005', khambenhId, 0);
            let giuong = '';
            if (Array.isArray(result) && result.length > 0) giuong = result[0].GIUONG;
            else if (result && result.GIUONG) giuong = result.GIUONG;

            sendResult('FETCH_ROOM_RESULT', rowId, { giuong }, requestId);
        } catch (_e) {
            sendResult('FETCH_ROOM_RESULT', rowId, { giuong: '' }, requestId);
        }
    }

    function fetchVitals(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_VITALS_RESULT', rowId, { vitals: null }, requestId);
                return;
            }

            const now = Date.now();
            if (vitalsCache[rowId] && (now - vitalsCache[rowId].timestamp < 10000)) {
                console.log(`[API-Bridge] Serving vitals for ${rowId} from cache.`);
                sendResult('FETCH_VITALS_RESULT', rowId, { vitals: vitalsCache[rowId].data }, requestId);
                return;
            }

            const grid = _$('#grdBenhNhan');
            if (grid.length === 0) {
                sendResult('FETCH_VITALS_RESULT', rowId, { vitals: null }, requestId);
                return;
            }
            
            const rowData = grid.jqGrid('getRowData', rowId);
            let finalVitals = { pulse: '', temperature: '', bloodPressure: '', weight: '', height: '', bmi: '', respiratoryRate: '', spo2: '' };
            let found = { w: false, h: false, bp: false };
            
            if (rowData) {
                finalVitals.pulse = rowData.MACH || '';
                finalVitals.temperature = rowData.NHIETDO || '';
                finalVitals.bloodPressure = rowData.HUYETAP || rowData.HUYET_AP || rowData.HA || '';
                finalVitals.weight = rowData.CANNANG || '';
                finalVitals.height = rowData.CHIEUCAO || '';
                finalVitals.bmi = rowData.BMI || '';
                finalVitals.respiratoryRate = rowData.NHIPTHO || rowData.NHIP_THO || '';
                finalVitals.spo2 = rowData.SPO2 || '';
            }
            
            if (finalVitals.weight && finalVitals.weight != '0' && finalVitals.weight != '&nbsp;') found.w = true;
            if (finalVitals.height && finalVitals.height != '0' && finalVitals.height != '&nbsp;') found.h = true;
            if (finalVitals.bloodPressure && finalVitals.bloodPressure != '0' && finalVitals.bloodPressure != '&nbsp;') found.bp = true;

            // Fallback reading from DOM TD attributes if rowData is incomplete
            if (!finalVitals.pulse || !finalVitals.temperature || !found.bp || !found.w || !found.h) {
                const rowElem = _$('#' + rowId);
                rowElem.find('td').each(function() {
                    const aria = _$(this).attr('aria-describedby') || '';
                    const text = _$(this).text().trim();
                    if (text && text !== '&nbsp;') {
                        const ariaUpper = aria.toUpperCase();
                        if (ariaUpper.includes('MACH') && !finalVitals.pulse) finalVitals.pulse = text;
                        else if (ariaUpper.includes('NHIETDO') && !finalVitals.temperature) finalVitals.temperature = text;
                        else if (ariaUpper.includes('NHIPTHO') && !finalVitals.respiratoryRate) finalVitals.respiratoryRate = text;
                        else if (ariaUpper.includes('SPO2') && !finalVitals.spo2) finalVitals.spo2 = text;
                        else if ((ariaUpper.includes('HUYETAP') || ariaUpper.includes('_HA')) && !finalVitals.bloodPressure) { finalVitals.bloodPressure = text; found.bp = true; }
                        else if (ariaUpper.includes('CANNANG') && !finalVitals.weight) { finalVitals.weight = text; found.w = true; }
                        else if (ariaUpper.includes('CHIEUCAO') && !finalVitals.height) { finalVitals.height = text; found.h = true; }
                    }
                });
            }

            // Fallback API if DOM still misses vitals
            if (!found.w || !found.h || !found.bp || !finalVitals.pulse || !finalVitals.temperature) {
                const hosobenhanid = rowData.HOSOBENHANID || rowData.HSBAID || '';
                const kbIdHienTai = rowData.KHAMBENHID || rowData.MADIEUTRI || rowId;

                function accumulate(rec) {
                    if (!rec) return;
                    for (let k in rec) {
                        let val = rec[k];
                        if (val === null || val === undefined || String(val).trim() === '' || val == '0') continue;
                        const uk = k.toUpperCase().trim();

                        if (!finalVitals.weight && (uk === 'KHAMBENH_CANNANG' || uk === 'CANNANG' || uk === 'CAN_NANG' || uk === 'WEIGHT')) {
                            finalVitals.weight = String(val); found.w = true;
                        }
                        if (!finalVitals.height && (uk === 'KHAMBENH_CHIEUCAO' || uk === 'CHIEUCAO' || uk === 'CHIEU_CAO' || uk === 'HEIGHT')) {
                            finalVitals.height = String(val); found.h = true;
                        }
                        if (!finalVitals.pulse && (uk === 'KHAMBENH_MACH' || uk === 'MACH' || uk === 'NHIP_TIM' || uk === 'NHIP_MACH')) {
                            finalVitals.pulse = String(val);
                        }
                        if (!finalVitals.temperature && (uk === 'KHAMBENH_NHIETDO' || uk === 'NHIETDO' || uk === 'NHIET_DO' || uk === 'TEMP')) {
                            finalVitals.temperature = String(val);
                        }
                        if (!finalVitals.respiratoryRate && (uk === 'KHAMBENH_NHIPTHO' || uk === 'NHIPTHO' || uk === 'NHIP_THO' || uk === 'RESP')) {
                            finalVitals.respiratoryRate = String(val);
                        }
                        if (!finalVitals.spo2 && (uk === 'KHAMBENH_SPO2' || uk === 'SPO2')) {
                            finalVitals.spo2 = String(val);
                        }

                        // Blood Pressure handling (Systolic / Tâm thu)
                        if (uk === 'KHAMBENH_HUYETAP' || uk === 'KHAMBENH_HUYETAP_HIGH' || uk === 'HUYETAP' || uk === 'HUYETAP_CAO' || uk === 'HUYET_AP_CAO' || uk === 'HUYETAP_T' || uk === 'HUYETAP_HIGH' || uk === 'HUYETAP1' || uk === 'HUYETAPMAX') {
                            if (!finalVitals.bloodPressure) finalVitals.bloodPressure = String(val);
                            else if (!finalVitals.bloodPressure.includes('/')) finalVitals.bloodPressure = val + '/' + finalVitals.bloodPressure;
                            found.bp = true;
                        }
                        // Blood Pressure handling (Diastolic / Tâm trương)
                        if (uk === 'KHAMBENH_HUYETAP_DUOI' || uk === 'KHAMBENH_HUYETAP_LOW' || uk === 'HUYETAP_THAP' || uk === 'HUYET_AP_THAP' || uk === 'HUYETAP_D' || uk === 'HUYETAP_LOW' || uk === 'HUYETAP2' || uk === 'HUYETAPMIN') {
                            if (!finalVitals.bloodPressure) finalVitals.bloodPressure = String(val);
                            else if (!finalVitals.bloodPressure.includes('/')) finalVitals.bloodPressure = finalVitals.bloodPressure + '/' + val;
                            found.bp = true;
                        }
                    }
                }

                const trySP = (sp, p) => {
                    try {
                        const params = (typeof p === 'object') ? JSON.stringify(p) : p;
                        const res = _jsonrpc.AjaxJson.ajaxCALL_SP_O(sp, params, 0);
                        if (!res) return;
                        const data = (typeof res === 'string' && res.trim() !== '') ? JSON.parse(res) : res;
                        const recs = Array.isArray(data) ? data : [data];
                        recs.forEach(accumulate);
                    } catch (_e) { }
                };

                if (kbIdHienTai) trySP('NT.006', { KHAMBENHID: kbIdHienTai });
                if ((!found.w || !found.h || !found.bp || !finalVitals.pulse || !finalVitals.temperature) && hosobenhanid) trySP('NT.006.HSBA.HIS', { HOSOBENHANID: hosobenhanid });
                if ((!found.w || !found.h || !found.bp || !finalVitals.pulse || !finalVitals.temperature) && kbIdHienTai) trySP('NT.005', kbIdHienTai);
            }

            // Clean up
            for (let key in finalVitals) {
                if (finalVitals[key] === '&nbsp;' || finalVitals[key] === 'undefined' || finalVitals[key] === 'null') {
                    finalVitals[key] = '';
                } else {
                    finalVitals[key] = String(finalVitals[key]).replace(/<[^>]+>/g, '').trim();
                }
            }

            vitalsCache[rowId] = { data: finalVitals, timestamp: Date.now() };
            sendResult('FETCH_VITALS_RESULT', rowId, { vitals: finalVitals }, requestId);
        } catch (e) {
            console.error('[API-Bridge] fetchVitals error:', e);
            sendResult('FETCH_VITALS_RESULT', rowId, { vitals: null }, requestId);
        }
    }

    function fetchTreatment(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_TREATMENT_RESULT', rowId, { treatmentList: [] }, requestId);
                return;
            }
            const grid = _$('#grdBenhNhan');
            const rowData = grid.jqGrid('getRowData', rowId);
            const benhnhanId = rowData.BENHNHANID || '';

            let candidates = [
                rowData.HOSOBENHANID,
                rowData.TIEPNHANID,
                rowData.KHAMBENHID,
                rowData.MADIEUTRI
            ].filter(v => v && v.trim() !== '');

            candidates = Array.from(new Set(candidates));

            let currentIndex = 0;
            const tryNext = () => {
                if (currentIndex >= candidates.length) {
                    sendResult('FETCH_TREATMENT_RESULT', rowId, { treatmentList: [] }, requestId);
                    return;
                }

                const testId = candidates[currentIndex++];
                const params = {
                    func: 'ajaxExecuteQueryPaging',
                    uuid: _jsonrpc.AjaxJson.uuid,
                    params: ['NT.024.DSPHIEU'],
                    options: [
                        { name: '[0]', value: '' },
                        { name: '[1]', value: String(benhnhanId) },
                        { name: '[2]', value: '4' },
                        { name: '[3]', value: String(testId) }
                    ]
                };

                const xhr = new XMLHttpRequest();
                const url = `/vnpthis/RestService?_search=false&rows=500&page=1&sidx=NGAYMAUBENHPHAM&sord=desc&postData=${encodeURIComponent(JSON.stringify(params))}`;

                xhr.open('GET', url, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                const data = JSON.parse(xhr.responseText);
                                const rows = data.rows || [];
                                if (rows.length > 0) {
                                    const treatments = rows.map(r => ({
                                        DIENBIEN: r.DIENBIENBENH || r.NOIDUNG || '',
                                        NGAYMAUBENHPHAM: r.NGAYMAUBENHPHAM || r.NGAY_Y_LENH || '',
                                        MAUBENHPHAMID: r.MAUBENHPHAMID || ''
                                    }));
                                    sendResult('FETCH_TREATMENT_RESULT', rowId, { treatmentList: treatments }, requestId);
                                } else {
                                    tryNext();
                                }
                            } catch (_e) { tryNext(); }
                        } else {
                            tryNext();
                        }
                    }
                };
                xhr.send();
            };

            tryNext();

        } catch (_e) {
            sendResult('FETCH_TREATMENT_RESULT', rowId, { treatmentList: [] }, requestId);
        }
    }

    // SECURITY: callSP() has been removed. All data access is now routed through
    // dedicated, validated handlers (fetchVitals, fetchHistory, fetchRoom, fetchTreatment, fetchDrugs).

    function fetchDiagnosesForCDS(rowId, benhnhanId, khambenhId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_DIAGNOSES_RESULT', rowId || null, { diagnoses: [] }, requestId);
                return;
            }
            if (rowId && (!benhnhanId || !khambenhId)) {
                const rowData = _$('#grdBenhNhan').jqGrid('getRowData', rowId);
                benhnhanId = benhnhanId || rowData.BENHNHANID;
                khambenhId = khambenhId || rowData.KHAMBENHID || rowData.MADIEUTRI;
            }
            if (!benhnhanId || !khambenhId) {
                sendResult('FETCH_DIAGNOSES_RESULT', rowId || null, { diagnoses: [] }, requestId);
                return;
            }

            const params = {
                func: 'ajaxExecuteQueryPaging',
                uuid: _jsonrpc.AjaxJson.uuid,
                params: ['NT.024.DSPHIEU'],
                options: [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '4' },
                    { name: '[3]', value: String(khambenhId) }
                ]
            };

            const xhr = new XMLHttpRequest();
            const url = `/vnpthis/RestService?_search=false&rows=50&page=1&sidx=NGAYMAUBENHPHAM&sord=desc&postData=${encodeURIComponent(JSON.stringify(params))}`;

            xhr.open('GET', url, true);
            xhr.onreadystatechange = function () {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        try {
                            const response = JSON.parse(xhr.responseText);
                            const rows = response.rows || [];
                            let allDiagnoses = [];
                            
                            rows.forEach(item => {
                                const rawIcd = item.MAICD || item.ICD || item.MA_ICD || '';
                                const rawIcdSub = item.MAICD_KEMTHEO || item.MABENHKEMTHEO || item.ICD_KEMTHEO || item.MA_ICDKEMTHEO || '';
                                const combinedIcd = (rawIcd + ',' + rawIcdSub).toUpperCase();
                                
                                const matches = combinedIcd.match(/\b[A-Z]\d{2,3}(?:\.\d{1,2})?\b/g);
                                if (matches) {
                                    matches.forEach(code => {
                                        if (!allDiagnoses.some(d => d.code === code)) {
                                            allDiagnoses.push({
                                                code: code,
                                                is_primary: allDiagnoses.length === 0
                                            });
                                        }
                                    });
                                }
                            });

                            sendResult('FETCH_DIAGNOSES_RESULT', null, { diagnoses: allDiagnoses }, requestId);
                        } catch (_e) {
                            sendResult('FETCH_DIAGNOSES_RESULT', null, { diagnoses: [] }, requestId);
                        }
                    } else {
                        sendResult('FETCH_DIAGNOSES_RESULT', null, { diagnoses: [] }, requestId);
                    }
                }
            };
            xhr.send(null);

        } catch (_e) {
            sendResult('FETCH_DIAGNOSES_RESULT', null, { diagnoses: [] }, requestId);
        }
    }

    function fetchDrugs(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_DRUGS_RESULT', rowId, { drugList: [] }, requestId);
                return;
            }
            const grid = _$('#grdBenhNhan');
            const rowData = grid.jqGrid('getRowData', rowId);

            let candidates = [
                rowData.KHAMBENHID,
                rowData.MADIEUTRI,
                rowData.HOSOBENHANID,
                rowData.TIEPNHANID
            ].filter(v => v && v.trim() !== '');

            candidates = Array.from(new Set(candidates));

            let currentIndex = 0;
            const benhnhanId = rowData.BENHNHANID || '';

            const tryNext = () => {
                if (currentIndex >= candidates.length) {
                    sendResult('FETCH_DRUGS_RESULT', rowId, { drugList: [] }, requestId);
                    return;
                }

                const testId = candidates[currentIndex++];
                const params = {
                    func: 'ajaxExecuteQueryPaging',
                    uuid: _jsonrpc.AjaxJson.uuid,
                    params: ['NT.024.DSTHUOCVT'],
                    options: [
                        { name: '[0]', value: String(testId) }, // e.g. KHAMBENHID
                        { name: '[1]', value: String(benhnhanId) }, // BENHNHANID
                        { name: '[2]', value: '7;' },
                        { name: '[3]', value: String(rowData.HOSOBENHANID || rowData.TIEPNHANID || testId) }
                    ]
                };

                const xhr = new XMLHttpRequest();
                const url = `/vnpthis/RestService?_search=false&rows=100&page=1&sidx=&sord=desc&postData=${encodeURIComponent(JSON.stringify(params))}`;

                xhr.open('GET', url, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                const data = JSON.parse(xhr.responseText);
                                const rows = data.rows || [];
                                if (rows.length > 0) {
                                    const drugs = rows.map(r => ({
                                        NGAYMAUBENHPHAM_SUDUNG: r.NGAYMAUBENHPHAM_SUDUNG || r.NGAYSD || r.NGAYSUDUNG || '',
                                        TENTHUOC: r.TENDICHVU || r.TENTHUOC || '',
                                        MAUBENHPHAMID: r.MAUBENHPHAMID || '',
                                        LIEUDUNG: r.LIEUDUNG || r.LIEU || '',
                                        DONVITINH: r.DONVITINH || r.DONVI || '',
                                        DUONGDUNG: r.DUONGDUNG || r.TENDUONGDUNG || '',
                                        CACHDUNG: r.CACHDUNG || r.SOLO_CACHDUNG || r.SUDUNG || '',
                                        SOLUONG: r.SOLUONG || r.SOLUONG_SUDUNG || ''
                                    }));
                                    sendResult('FETCH_DRUGS_RESULT', rowId, { drugList: drugs }, requestId);
                                } else {
                                    tryNext();
                                }
                            } catch (_e) { tryNext(); }
                        } else {
                            tryNext();
                        }
                    }
                };
                xhr.send();
            };

            tryNext();

        } catch (_e) {
            sendResult('FETCH_DRUGS_RESULT', rowId, { drugList: [] }, requestId);
        }
    }

    // Fetch thuốc toàn đợt điều trị (dùng HOSOBENHANID) — cho modal CLS + Thuốc
    // 2-step: 1) Lấy danh sách phiếu thuốc (NT.024.DSTHUOCVT)
    //         2) Lấy chi tiết từng phiếu (NT.024.2) — trả về tên thuốc, liều, đường dùng
    async function fetchDrugsForCLS(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: [] }, requestId);
                return;
            }
            const grid = _$('#grdBenhNhan');
            const rowData = grid.jqGrid('getRowData', rowId);
            const uuid = _jsonrpc?.AjaxJson?.uuid;
            if (!uuid) {
                sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: [] }, requestId);
                return;
            }

            const benhnhanId = rowData.BENHNHANID || '';
            const hsbaId = rowData.HOSOBENHANID || rowData.HSBAID || '';
            const baseUrl = '/vnpthis/RestService';

            // Candidate IDs to try for the sheet list
            let candidates = [
                rowData.KHAMBENHID,
                rowData.MADIEUTRI,
                hsbaId,
                rowData.TIEPNHANID
            ].filter(v => v && v.trim() !== '');
            candidates = Array.from(new Set(candidates));

            // --- Step 1: Fetch list of drug sheets ---
            let sheets = [];
            for (const testId of candidates) {
                try {
                    const params = {
                        func: 'ajaxExecuteQueryPaging',
                        uuid: uuid,
                        params: ['NT.024.DSTHUOCVT'],
                        options: [
                            { name: '[0]', value: String(testId) },
                            { name: '[1]', value: String(benhnhanId) },
                            { name: '[2]', value: '7;' },
                            { name: '[3]', value: String(hsbaId || testId) }
                        ]
                    };
                    const url = `${baseUrl}?_search=false&rows=500&page=1&sidx=&sord=desc&postData=${encodeURIComponent(JSON.stringify(params))}`;
                    const res = await fetch(url, { credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        if ((data.rows || []).length > 0) {
                            sheets = data.rows;
                            console.log(`[Aladinn Drug] Step 1: Found ${sheets.length} drug sheets via candidate ${testId}`);
                            break;
                        }
                    }
                } catch (_e) { /* try next candidate */ }
            }

            if (sheets.length === 0) {
                sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: [] }, requestId);
                return;
            }

            // --- Step 2: Fetch drug details for each sheet ---
            // NT.024.2 is for labs — drugs use different query codes.
            // Try multiple common VNPT HIS drug detail endpoints.
            const DRUG_DETAIL_QUERIES = [
                'NT.034.1',
                'NT.024.CTPHIEUTHUOC',
                'NT.024.DSTHUOC',
                'NT.024.DSVTTHUOC',
                'NT.024.3',
                'NT.024.4',
                'NT.024.CHITIETTHUOC',
                'NT.024.2'  // fallback
            ];

            // Discover the correct query using the first sheet
            const firstSheet = sheets[0];
            const firstSheetId = firstSheet.MAUBENHPHAMID || firstSheet.IDPHIEU;
            let workingQuery = null;

            for (const queryCode of DRUG_DETAIL_QUERIES) {
                try {
                    const testParams = {
                        func: 'ajaxExecuteQueryPaging',
                        uuid: uuid,
                        params: [queryCode],
                        options: [{ name: '[0]', value: String(firstSheetId) }]
                    };
                    const testUrl = `${baseUrl}?_search=false&rows=500&page=1&postData=${encodeURIComponent(JSON.stringify(testParams))}`;
                    const testRes = await fetch(testUrl, { credentials: 'include' });
                    if (testRes.ok) {
                        const testData = await testRes.json();
                        const testRows = testData.rows || [];
                        console.log(`[Aladinn Drug] Trying ${queryCode} for sheet ${firstSheetId}: ${testRows.length} rows`);
                        if (testRows.length > 0) {
                            console.log(`[Aladinn Drug] ✅ ${queryCode} WORKS! Sample:`, JSON.stringify(testRows[0], null, 2));
                            console.log(`[Aladinn Drug] Keys:`, Object.keys(testRows[0]));
                            workingQuery = queryCode;
                            break;
                        }
                    }
                } catch (_e) {
                    console.log(`[Aladinn Drug] ${queryCode} failed:`, _e.message);
                }
            }

            if (!workingQuery) {
                console.warn('[Aladinn Drug] No drug detail query found. Falling back to sheet-level data.');
                // Fallback: return sheet-level data (no drug names, but at least dates)
                const fallbackDrugs = sheets.map(s => ({
                    NGAYMAUBENHPHAM_SUDUNG: s.NGAYMAUBENHPHAM_SUDUNG || s.NGAYMAUBENHPHAM || '',
                    TENTHUOC: s.TEAKHO || s.LOAIPHIEU || `Phiếu ${s.SOPHIEU || ''}`,
                    MAUBENHPHAMID: s.MAUBENHPHAMID || '',
                    LIEUDUNG: '', DONVITINH: '', DUONGDUNG: '', CACHDUNG: '',
                    SOLUONG: ''
                }));
                sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: fallbackDrugs }, requestId);
                return;
            }

            // Now fetch all sheets with the working query
            const allDrugs = [];
            const detailPromises = sheets.map(async (sheet) => {
                const sheetId = sheet.MAUBENHPHAMID || sheet.IDPHIEU;
                const sheetDate = sheet.NGAYMAUBENHPHAM_SUDUNG || sheet.NGAYMAUBENHPHAM || '';
                if (!sheetId) return;

                try {
                    const detailParams = {
                        func: 'ajaxExecuteQueryPaging',
                        uuid: uuid,
                        params: [workingQuery],
                        options: [{ name: '[0]', value: String(sheetId) }]
                    };
                    const detailUrl = `${baseUrl}?_search=false&rows=500&page=1&postData=${encodeURIComponent(JSON.stringify(detailParams))}`;
                    const detailRes = await fetch(detailUrl, { credentials: 'include' });
                    if (detailRes.ok) {
                        const detailData = await detailRes.json();
                        const items = detailData.rows || [];
                        for (const item of items) {
                            // Dynamic name resolution — try all possible keys
                            const name = item.TEN || item.TENTHUOC || item.TENDICHVU ||
                                         item.TENCHISO || item.TENCHIDINH || item.TENTONGHOP ||
                                         item.TEN_THUOC || item.TENDICHVU_CHA ||
                                         item.TENVATTU || item.TEN_DICHVU_KYTHUAT || '';
                            if (!name) continue;

                            allDrugs.push({
                                NGAYMAUBENHPHAM_SUDUNG: sheetDate,
                                TENTHUOC: name,
                                MAUBENHPHAMID: String(sheetId),
                                LIEUDUNG: item.LIEUDUNG || item.LIEU || item.HAMLUONG || item.NONGDO || '',
                                DONVITINH: item.DONVITINH || item.DONVI || item.DVT || '',
                                DUONGDUNG: item.DUONGDUNG || item.TENDUONGDUNG || '',
                                CACHDUNG: item.CACHDUNG || item.SOLO_CACHDUNG || item.SUDUNG || '',
                                SOLUONG: item.SOLUONG || item.SOLUONG_SUDUNG || ''
                            });
                        }
                    }
                } catch (_e) { /* skip failed sheet */ }
            });

            await Promise.all(detailPromises);
            console.log(`[Aladinn Drug] Step 2: Found ${allDrugs.length} drug items total from ${sheets.length} sheets (query: ${workingQuery})`);
            sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: allDrugs }, requestId);

        } catch (_e) {
            console.error('[Aladinn Drug] Error:', _e);
            sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: [] }, requestId);
        }
    }

    function sendResult(type, rowId, data, requestId) {
        window.postMessage({
            type,
            rowId,
            ...data,
            requestId
        }, window.location.origin);
    }

    function fetchPttt(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_PTTT_RESULT', rowId, { ptttList: [] }, requestId);
                return;
            }
            const grid = _$('#grdBenhNhan');
            const rowData = grid.jqGrid('getRowData', rowId);

            let candidates = [
                rowData.TIEPNHANID,
                rowData.HOSOBENHANID,
                rowData.KHAMBENHID,
                rowData.MADIEUTRI
            ].filter(v => v && v.trim() !== '');

            candidates = Array.from(new Set(candidates));

            let currentIndex = 0;
            let allPttt = [];
            const benhnhanId = rowData.BENHNHANID || '';

            const tryNext = () => {
                if (currentIndex >= candidates.length) {
                    sendResult('FETCH_PTTT_RESULT', rowId, { ptttList: allPttt }, requestId);
                    return;
                }

                const testId = candidates[currentIndex++];

                const params = {
                    func: 'ajaxExecuteQueryPaging',
                    uuid: _jsonrpc.AjaxJson.uuid,
                    params: ['NT.024.DSPHIEUCLS'],
                    options: [
                        { name: '[0]', value: String(testId) }, // KHAMBENHID or alternative
                        { name: '[1]', value: String(benhnhanId) },
                        { name: '[2]', value: '5' }, // 5 = PTTT (Chuyên Khoa)
                        { name: '[3]', value: String(rowData.HOSOBENHANID || rowData.TIEPNHANID || testId) }
                    ]
                };

                const xhr = new XMLHttpRequest();
                const url = `/vnpthis/RestService?_search=false&rows=100&page=1&sidx=NGAYMAUBENHPHAM&sord=desc&postData=${encodeURIComponent(JSON.stringify(params))}`;

                xhr.open('GET', url, true);
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                const data = JSON.parse(xhr.responseText);
                                const rows = data.rows || [];
                                if (rows.length > 0) {
                                    const pttts = rows.map(r => ({
                                        SOPHIEU: r.SOPHIEU || '',
                                        NGAYMAUBENHPHAM: r.NGAYMAUBENHPHAM || '',
                                        MAUBENHPHAMID: r.MAUBENHPHAMID || '',
                                        KHOACHIDINH: r.KHOACHIDINH || '',
                                        PHONGCHIDINH: r.PHONGCHIDINH || ''
                                    }));
                                    allPttt = allPttt.concat(pttts);
                                    // Found PTTT, send result
                                    sendResult('FETCH_PTTT_RESULT', rowId, { ptttList: allPttt }, requestId);
                                } else {
                                    tryNext();
                                }
                            } catch (_e) { tryNext(); }
                        } else {
                            tryNext();
                        }
                    }
                };
                xhr.send();
            };

            tryNext();

        } catch (_e) {
            sendResult('FETCH_PTTT_RESULT', rowId, { ptttList: [] }, requestId);
        }
    }

    async function fetchLabs(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_LABS_RESULT', rowId, { labsData: [] }, requestId);
                return;
            }
            const grid = _$('#grdBenhNhan');
            const rowData = grid.jqGrid('getRowData', rowId);
            
            const khambenhId = rowData.KHAMBENHID || rowData.MADIEUTRI || rowId;
            const benhnhanId = rowData.BENHNHANID || '';
            const hsbaId = rowData.HOSOBENHANID || rowData.HSBAID || '';
            
            let patientName = 'Bệnh Nhân';
            try {
                // Try from rowData keys first
                for (const key in rowData) {
                    if (key.toUpperCase() === 'HOTEN' || key.toUpperCase() === 'TENBENHNHAN' || key.toUpperCase() === 'TEN_BENH_NHAN' || key.toUpperCase() === 'TEN') {
                        const val = String(rowData[key]).replace(/<[^>]+>/g, '').trim();
                        if (val) { patientName = val; break; }
                    }
                }
                // Try from DOM if still not found
                if (patientName === 'Bệnh Nhân' || !patientName) {
                    const rowElem = _$('#' + rowId);
                    rowElem.find('td').each(function() {
                        const aria = _$(this).attr('aria-describedby') || '';
                        if (aria.toUpperCase().includes('HOTEN') || aria.toUpperCase().includes('TENBENHNHAN')) {
                            patientName = _$(this).text().trim() || patientName;
                        }
                    });
                }
            } catch(_e) {}

            if (!benhnhanId) {
                sendResult('FETCH_LABS_RESULT', rowId, { labsData: [], patientName: '' }, requestId);
                return;
            }

            const uuid = _jsonrpc.AjaxJson.uuid;
            const baseUrl = '/vnpthis/RestService';

            // ══════════════════════════════════════════════════════
            // PROVEN STRATEGY: NT.024.DSPHIEU with HOSOBENHANID
            // returns ALL lab sheets across ALL departments in the
            // current admission. Verified via live API testing.
            // ══════════════════════════════════════════════════════
            const _fetchSheets = async (apiId, opts) => {
                try {
                    const p = { func: 'ajaxExecuteQueryPaging', uuid, params: [apiId], options: opts };
                    const u = new URL(baseUrl, window.location.origin);
                    u.searchParams.set('_search', 'false');
                    u.searchParams.set('rows', '500');
                    u.searchParams.set('page', '1');
                    u.searchParams.set('postData', JSON.stringify(p));
                    const r = await fetch(u.toString(), { credentials: 'include' });
                    if (r.ok) { const d = await r.json(); return d.rows || []; }
                } catch (_e) { /* silent */ }
                return [];
            };

            const strategies = [];

            // --- XÉT NGHIỆM (type=1) ---
            if (hsbaId) {
                strategies.push(_fetchSheets('NT.024.DSPHIEU', [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '1' },
                    { name: '[3]', value: String(hsbaId) }
                ]));
            }
            if (khambenhId) {
                strategies.push(_fetchSheets('NT.024.DSPHIEU', [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '1' },
                    { name: '[3]', value: String(khambenhId) }
                ]));
            }

            // --- CĐHA (type=2) ---
            const cdhaStrategies = [];
            if (hsbaId) {
                cdhaStrategies.push(_fetchSheets('NT.024.DSPHIEU', [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '2' },
                    { name: '[3]', value: String(hsbaId) }
                ]));
            }
            if (khambenhId) {
                cdhaStrategies.push(_fetchSheets('NT.024.DSPHIEU', [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '2' },
                    { name: '[3]', value: String(khambenhId) }
                ]));
            }

            const [xnResults, cdhaResults] = await Promise.all([
                Promise.all(strategies).then(r => r.flat()),
                Promise.all(cdhaStrategies).then(r => r.flat())
            ]);

            // Deduplicate XN sheets
            const uniqueSheets = [];
            const seenSheetIds = new Set();
            for (const s of xnResults) {
                const sid = s.MAUBENHPHAMID || s.SOPHIEUID;
                if (sid && !seenSheetIds.has(String(sid))) {
                    seenSheetIds.add(String(sid));
                    uniqueSheets.push(s);
                }
            }

            // Deduplicate CĐHA sheets
            const uniqueCdha = [];
            for (const s of cdhaResults) {
                const sid = s.MAUBENHPHAMID || s.SOPHIEUID;
                if (sid && !seenSheetIds.has(String(sid))) {
                    seenSheetIds.add(String(sid));
                    uniqueCdha.push(s);
                }
            }

            console.log(`[API-Bridge] Found ${uniqueSheets.length} XN sheets, ${uniqueCdha.length} CĐHA sheets`);

            if (uniqueSheets.length === 0 && uniqueCdha.length === 0) {
                sendResult('FETCH_LABS_RESULT', rowId, { labsData: [], imagingData: [] }, requestId);
                return;
            }

            // Step 3: Fetch XN details for each sheet (NT.024.2)
            const allLabs = [];
            const detailPromises = uniqueSheets.map(async (sheet) => {
                const sheetId = sheet.MAUBENHPHAMID;
                if (!sheetId) return;

                const detailParams = {
                    func: 'ajaxExecuteQueryPaging',
                    uuid: uuid,
                    params: ['NT.024.2'],
                    options: [{ name: '[0]', value: String(sheetId) }]
                };
                const detailUrl = new URL(baseUrl, window.location.origin);
                detailUrl.searchParams.set('_search', 'false');
                detailUrl.searchParams.set('rows', '500');
                detailUrl.searchParams.set('page', '1');
                detailUrl.searchParams.set('postData', JSON.stringify(detailParams));

                try {
                    const detailRes = await fetch(detailUrl.toString(), { credentials: 'include' });
                    if (detailRes.ok) {
                        const detailData = await detailRes.json();
                        (detailData.rows || []).forEach(item => {
                            const getVal = (obj, keys) => {
                                if (!obj) return '';
                                for (const k of Object.keys(obj)) {
                                    if (keys.includes(k.toUpperCase())) return obj[k];
                                }
                                return '';
                            };

                            const parsedTestName = getVal(item, ['TENXETNGHIEM', 'TENDICHVU_CHA', 'LOAIXETNGHIEM']) || getVal(sheet, ['TENXETNGHIEM', 'TENDICHVU', 'TEN_DICHVU_KYTHUAT', 'TENLOAICHIDINH']) || '';
                            const parsedCode = getVal(item, ['TEN', 'TENCHISO', 'TENDICHVU', 'TENCHIDINH', 'TENTONGHOP']) || '';
                            const parsedValue = getVal(item, ['GIATRI_KETQUA', 'KETQUA', 'KETQUACLS']) || '';
                            const parsedUnit = getVal(item, ['DONVITINH', 'DONVI']) || '';
                            const refMin = item.GIATRINHONHAT || item.GIATRI_MIN || '';
                            const refMax = item.GIATRILONNHAT || item.GIATRI_MAX || '';
                            const refDisplay = item.TRISOBINHTHUONG || '';

                            let status = '';
                            const flagRaw = String(item.BATHUONG || item.BaThuong || item.FLAG_BATHUONG || '').toLowerCase();
                            if (flagRaw === '1' || flagRaw === 'high' || flagRaw === 'cao' || flagRaw.includes('tăng')) {
                                status = 'Cao';
                            } else if (flagRaw === '-1' || flagRaw === 'low' || flagRaw === 'thấp' || flagRaw.includes('giảm')) {
                                status = 'Thấp';
                            }
                            if (!status && parsedValue) {
                                const numVal = parseFloat(String(parsedValue).replace(',', '.'));
                                const numMin = parseFloat(String(refMin).replace(',', '.'));
                                const numMax = parseFloat(String(refMax).replace(',', '.'));
                                if (!isNaN(numVal)) {
                                    if (!isNaN(numMax) && numVal > numMax) status = 'Cao';
                                    else if (!isNaN(numMin) && numVal < numMin) status = 'Thấp';
                                }
                            }

                            if (parsedValue) {
                                allLabs.push({
                                    sheetId: sheetId,
                                    sheetDate: sheet.NGAYMAUBENHPHAM || sheet.NGAYCHIDINH || '',
                                    testName: parsedTestName,
                                    code: parsedCode,
                                    value: parsedValue,
                                    unit: parsedUnit,
                                    refMin: refMin,
                                    refMax: refMax,
                                    refDisplay: refDisplay,
                                    status: status
                                });
                            }
                        });
                    }
                } catch (_e) {
                    console.error('[API-Bridge] Error fetching details for sheet', sheetId, _e);
                }
            });

            await Promise.all(detailPromises);

            // Build CĐHA data — fetch detail for each sheet via NT.024.2
            const imagingData = [];
            const cdhaDetailPromises = uniqueCdha.map(async (sheet) => {
                const sheetId = sheet.MAUBENHPHAMID;
                if (!sheetId) return;
                try {
                    const rows = await _fetchSheets('NT.024.2', [{ name: '[0]', value: String(sheetId) }]);
                    if (rows.length > 0) {
                        for (const item of rows) {
                            imagingData.push({
                                sheetId,
                                sheetDate: sheet.NGAYMAUBENHPHAM || sheet.NGAYCHIDINH || '',
                                name: item.TEN || item.TENDICHVU || item.TEN_DICHVU_KYTHUAT || item.TENCHIDINH || sheet.TEN_DICHVU_KYTHUAT || '',
                                code: item.MADICHVU || item.MA || '',
                                conclusion: item.KETLUAN || item.KETQUA || item.GIATRI_KETQUA || item.KETQUACLS || '',
                                status: item.TRANGTHAI || sheet.TRANGTHAI || '',
                                department: sheet.KHOADIEUTRI || sheet.TENPHONG || ''
                            });
                        }
                    } else {
                        imagingData.push({
                            sheetId, sheetDate: sheet.NGAYMAUBENHPHAM || '', name: sheet.TEN_DICHVU_KYTHUAT || 'CĐHA',
                            code: '', conclusion: '', status: sheet.TRANGTHAI || '', department: sheet.KHOADIEUTRI || sheet.TENPHONG || ''
                        });
                    }
                } catch (_e) { /* silent */ }
            });
            await Promise.all(cdhaDetailPromises);

            sendResult('FETCH_LABS_RESULT', rowId, { labsData: allLabs, imagingData, patientName }, requestId);

        } catch (err) {
            console.error('[API-Bridge] fetchLabs error:', err);
            sendResult('FETCH_LABS_RESULT', rowId, { labsData: [], imagingData: [], patientName: '' }, requestId);
        }
    }

    function triggerPtttPrint(rowId) {
        try {
            if (!_$) return;
            const grid = _$('#grdBenhNhan');
            if (grid.length === 0) return;
            
            // 1. Select patient first
            grid.jqGrid('setSelection', rowId);

            // 2. Click the PTTT tab repeatedly or wait until it's available
            let attempts = 0;
            const tryClickPttt = setInterval(() => {
                attempts++;
                const ptttTab = _$('a[href="#tcChuyenKhoa"]');
                if (ptttTab.length > 0) {
                    clearInterval(tryClickPttt);
                    ptttTab.click();
                    
                    let phase = 0;
                    let gridAttempts = 0;
                    // 3. Wait for PTTT elements to populate
                    const tryClickRowAndPrint = setInterval(() => {
                        gridAttempts++;
                        
                        // Phase 0: Ensure "Load phiếu theo đợt điều trị" is checked, but ONLY after grid is initialized
                        if (phase === 0) {
                            const mainGrid = _$('#tcChuyenKhoagrdCK');
                            if (!mainGrid.hasClass('ui-jqgrid-btable')) return; // Wait for jqGrid initialization
                            
                            const loadSpinner = _$('#load_tcChuyenKhoagrdCK');
                            if (loadSpinner.length > 0 && loadSpinner.is(':visible')) return; // Wait for initial HIS AJAX

                            const chkAll = _$('#tcChuyenKhoachkAllKhoa');
                            if (chkAll.length > 0) {
                                if (!chkAll.is(':checked')) {
                                    chkAll.click();
                                    chkAll.trigger('change'); // Ensure HIS catches the change event
                                    // Delay phase 1 slightly so HIS has time to show the loading spinner again
                                    phase = 0.5;
                                    setTimeout(() => { phase = 1; }, 500); 
                                    return;
                                }
                                phase = 1;
                            }
                            return;
                        }
                        if (phase === 0.5) return; // Waiting for timeout to transition to phase 1
                        
                        // Phase 1 & 2: Wait for both grids to render and select rows
                        if (phase >= 1) {
                            const loadSpinner = _$('#load_tcChuyenKhoagrdCK');
                            if (loadSpinner.length > 0 && loadSpinner.is(':visible')) return; // wait for data loading

                            // Find all jqGrid tables inside PTTT tab
                            const grids = _$('#tcChuyenKhoa .ui-jqgrid-btable');
                            
                            // 3a. Select top grid (Phiếu)
                            if (grids.length >= 1) {
                                const topGrid = _$(grids[0]);
                                const topRowIds = topGrid.jqGrid('getDataIDs');
                                if (topRowIds && topRowIds.length > 0) {
                                    const selectedTop = topGrid.jqGrid('getGridParam', 'selrow');
                                    if (!selectedTop || selectedTop !== topRowIds[0]) {
                                        topGrid.jqGrid('setSelection', topRowIds[0]);
                                    } else {
                                        phase = 2; // top grid selected successfully
                                    }
                                }
                            }
                            
                            // 3b. Select bottom grid (Chi tiết dịch vụ) and print
                            if (phase === 2 && grids.length >= 2) {
                                const bottomGrid = _$(grids[1]);
                                const bottomRowIds = bottomGrid.jqGrid('getDataIDs');
                                
                                if (bottomRowIds && bottomRowIds.length > 0) {
                                    clearInterval(tryClickRowAndPrint);
                                    bottomGrid.jqGrid('setSelection', bottomRowIds[0]);
                                    
                                    // wait a bit for HIS to fully register selection before clicking print
                                    setTimeout(() => {
                                        const printBtn = _$('#tcChuyenKhoatoolbarIdprintca_5');
                                        if (printBtn.length > 0) {
                                            const aBtn = printBtn.find('a');
                                            // FIX: Only click the <a> tag to prevent opening 2 dialogs
                                            if (aBtn.length > 0) {
                                                aBtn[0].click();
                                            } else {
                                                printBtn.click();
                                            }
                                        }
                                    }, 200); // reduced from 400ms for speed
                                }
                            }
                        }
                        
                        // Timeout safety to prevent infinite loop (15 seconds)
                        if (gridAttempts > 60) clearInterval(tryClickRowAndPrint); 
                    }, 250); // reduced interval from 500ms to 250ms for speed
                }
                if (attempts > 40) clearInterval(tryClickPttt); // timeout after 10s
            }, 250); // reduced from 500ms
        } catch(e) {
            console.error('[Aladinn API-Bridge] Error in triggerPtttPrint:', e);
        }
    }

    // Explicit initialization signal
    window.postMessage({ type: 'FROM_PAGE_SCRIPT', status: 'ready' }, window.location.origin);
})();
