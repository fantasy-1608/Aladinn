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
            case 'REQ_FETCH_VITALS':
                fetchVitals(event.data.rowId, event.data.requestId);
                break;
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
            case 'REQ_FETCH_LABS':
                fetchLabs(event.data.rowId, event.data.requestId);
                break;
            // SECURITY: REQ_CALL_SP has been removed to prevent arbitrary SP execution via XSS.
        }
    });

    function fetchVitals(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_VITALS_RESULT', rowId, { vitals: {} }, requestId);
                return;
            }

            const grid = _$('#grdBenhNhan');
            const rowData = grid.jqGrid('getRowData', rowId);
            const hosobenhanid = rowData.HOSOBENHANID || rowData.HSBAID || '';
            const kbIdHienTai = rowData.KHAMBENHID || rowData.MADIEUTRI || '';

            if (!hosobenhanid && !kbIdHienTai) {
                sendResult('FETCH_VITALS_RESULT', rowId, { vitals: {} }, requestId);
                return;
            }

            let finalVitals = {};
            let found = { w: false, h: false, bp: false };

            // Check if vitals are already visible in grid
            const gridW = rowData.CANNANG || rowData.KHAMBENH_CANNANG || '';
            const gridH = rowData.CHIEUCAO || rowData.KHAMBENH_CHIEUCAO || '';
            const gridBP = rowData.HUYETAP || rowData.KHAMBENH_HUYETAP || '';

            if (gridW && gridW != '0') { finalVitals.weight = String(gridW); found.w = true; }
            if (gridH && gridH != '0') { finalVitals.height = String(gridH); found.h = true; }
            if (gridBP && gridBP != '0') { finalVitals.bloodPressure = String(gridBP); found.bp = true; }

            /** @param {any} rec */
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

                    // Admission Date handling
                    if (!finalVitals.admissionDate && (uk === 'KHAMBENH_NGAYGIODE' || uk === 'NGAYGIODE' || uk === 'NGAYNHAPVIEN' || uk === 'NGAYVAOVIEN' || uk === 'NGAYKHAM')) {
                        // Validate if it's a date-like string format DD/MM/YYYY
                        if (String(val).match(/\d{2}\/\d{2}\/\d{4}/)) {
                            finalVitals.admissionDate = String(val);
                        }
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

            // Sequential fallback
            if (kbIdHienTai) trySP('NT.006', { KHAMBENHID: kbIdHienTai });
            if ((!found.w || !found.h || !found.bp) && hosobenhanid) trySP('NT.006.HSBA.HIS', { HOSOBENHANID: hosobenhanid });
            if ((!found.w || !found.h || !found.bp) && kbIdHienTai) trySP('NT.005', kbIdHienTai);

            sendResult('FETCH_VITALS_RESULT', rowId, { vitals: finalVitals }, requestId);
        } catch (_e) {
            console.error('[API-Bridge] fetchVitals error:', e);
            sendResult('FETCH_VITALS_RESULT', rowId, { vitals: {} }, requestId);
        }
    }

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
        } catch (_e) {
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
                                        MAUBENHPHAMID: r.MAUBENHPHAMID || ''
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

    function sendResult(type, rowId, data, requestId) {
        window.postMessage({
            type,
            rowId,
            ...data,
            requestId
        }, window.location.origin);
    }

    function fetchLabs(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_LABS_RESULT', rowId, { labList: [] }, requestId);
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
            let allLabs = [];
            let seenResultIds = new Set();
            let seenOrderIds = new Set();

            const tryNext = () => {
                if (currentIndex >= candidates.length) {
                    sendResult('FETCH_LABS_RESULT', rowId, { labList: allLabs }, requestId);
                    return;
                }

                const testId = candidates[currentIndex++];
                
                // Query NT.024.DSPHIEUCLS (type=1 cho Xét Nghiệm)
                const queryParams = {
                    func: 'ajaxExecuteQueryPaging',
                    uuid: _jsonrpc.AjaxJson.uuid,
                    params: ['NT.024.DSPHIEUCLS'],
                    options: [
                        { name: '[0]', value: String(testId) },
                        { name: '[1]', value: String(benhnhanId) },
                        { name: '[2]', value: '1' }, // Cận Lâm Sàng
                        { name: '[3]', value: '-1' }
                    ]
                };

                const xhrCLs = new XMLHttpRequest();
                const urlCLs = `/vnpthis/RestService?_search=false&rows=500&page=1&sidx=&sord=desc&postData=${encodeURIComponent(JSON.stringify(queryParams))}`;

                xhrCLs.open('GET', urlCLs, true);
                xhrCLs.onreadystatechange = function () {
                    if (xhrCLs.readyState === 4) {
                        if (xhrCLs.status === 200) {
                            try {
                                const dataCLS = JSON.parse(xhrCLs.responseText);
                                const rowsCLS = dataCLS.rows || [];
                                
                                let maubenhphamIds = rowsCLS.map(r => r.MAUBENHPHAMID || r.SOPHIEUID).filter(v => v);
                                maubenhphamIds = Array.from(new Set(maubenhphamIds)).filter(id => !seenOrderIds.has(id));
                                
                                maubenhphamIds.forEach(id => seenOrderIds.add(id));

                                if (maubenhphamIds.length === 0) {
                                    tryNext(); // Try next candidate
                                    return;
                                }

                                const fetchResultsForId = (idx) => {
                                    if (idx >= maubenhphamIds.length) {
                                        // Hoàn thành fetch cho candidate này, gọi tiếp candidate sau (hoặc thoát)
                                        tryNext();
                                        return;
                                    }

                                    const orderId = maubenhphamIds[idx];
                                    const detailParams = {
                                        func: 'ajaxExecuteQueryPaging',
                                        uuid: _jsonrpc.AjaxJson.uuid,
                                        params: ['NT.024.2'],
                                        options: [
                                            { name: '[0]', value: String(orderId) }
                                        ]
                                    };

                                    const xDetail = new XMLHttpRequest();
                                    const urlDetail = `/vnpthis/RestService?_search=false&rows=500&page=1&sidx=&sord=desc&postData=${encodeURIComponent(JSON.stringify(detailParams))}`;
                                    xDetail.open('GET', urlDetail, true);
                                    xDetail.onreadystatechange = function () {
                                        if (xDetail.readyState === 4) {
                                            if (xDetail.status === 200) {
                                                try {
                                                    const dDetail = JSON.parse(xDetail.responseText);
                                                    const dRows = dDetail.rows || [];
                                                    dRows.forEach(r => {
                                                        const tenXN = r.TENDICHVU || r.TENCHIDINH || r.TENXETNGHIEM || '';
                                                        const ketQua = r.GIATRI_KETQUA || r.KETQUACLS || '';
                                                        const uid = `${orderId}::${tenXN}`;
                                                        
                                                        if (tenXN && !seenResultIds.has(uid)) {
                                                            seenResultIds.add(uid);
                                                            allLabs.push({
                                                                TENDICHVU: tenXN,
                                                                GIATRI_KETQUA: ketQua,
                                                                DONVI: r.DONVI || '',
                                                                TRISOBINHTHUONG: r.TRISOBINHTHUONG || '',
                                                                THOIGIANTRAKETQUA: r.THOIGIANTRAKETQUA || r.THOIGIANTRAKETQUA1 || r.TGTHUCHIEN || ''
                                                            });
                                                        }
                                                    });
                                                } catch (_e) { }
                                            }
                                            fetchResultsForId(idx + 1);
                                        }
                                    };
                                    xDetail.send();
                                };

                                fetchResultsForId(0);

                            } catch (_e) {
                                tryNext();
                            }
                        } else {
                            tryNext();
                        }
                    }
                };
                xhrCLs.send();
            };

            tryNext();

        } catch (_e) {
            sendResult('FETCH_LABS_RESULT', rowId, { labList: [] }, requestId);
        }
    }

    // Explicit initialization signal
    window.postMessage({ type: 'FROM_PAGE_SCRIPT', status: 'ready' }, window.location.origin);
})();
