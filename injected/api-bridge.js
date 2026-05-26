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
    // [P1-SEC-006] SECURITY: Get nonce assigned by extension for mandatory message validation
    const ALADINN_NONCE = document.currentScript ? document.currentScript.dataset.aladinnNonce : (window.__ALADINN_NONCE__ || null);

    // Đề xuất 5: Diagnostic logging toggle — bật bằng window.__ALADINN_DEBUG__ = true
    function debugLog(...args) {
        if (window.__ALADINN_DEBUG__) console.log(...args);
    }

    // Cache to prevent duplicate simultaneous requests from multiple modules
    // LRU eviction: max 30 entries, tự động xoá cũ nhất khi đầy
    const VITALS_CACHE_MAX = 30;
    const VITALS_CACHE_TTL = 5 * 60 * 1000; // 5 phút
    const vitalsCache = {};
    
    function _evictVitalsCache() {
        const keys = Object.keys(vitalsCache);
        if (keys.length <= VITALS_CACHE_MAX) return;
        // Xoá các entry hết hạn trước
        const now = Date.now();
        for (const key of keys) {
            if (vitalsCache[key] && now - vitalsCache[key].timestamp > VITALS_CACHE_TTL) {
                delete vitalsCache[key];
            }
        }
        // Nếu vẫn quá max → xoá cũ nhất
        const remaining = Object.keys(vitalsCache);
        if (remaining.length > VITALS_CACHE_MAX) {
            remaining.sort((a, b) => (vitalsCache[a].timestamp || 0) - (vitalsCache[b].timestamp || 0));
            const toRemove = remaining.length - VITALS_CACHE_MAX;
            for (let i = 0; i < toRemove; i++) {
                delete vitalsCache[remaining[i]];
            }
        }
    }

    // SECURITY: Rate-limiting to prevent request flooding (Cross-tab sync via BroadcastChannel)
    const _rateLimit = { count: 0, resetTime: Date.now() + 10000 };
    const RATE_LIMIT_MAX = 150; // Quét phòng lớn
    const RATE_LIMIT_WINDOW = 10000;
    let _rateLimitChannel = null;

    try {
        _rateLimitChannel = new BroadcastChannel('aladinn_rate_limit');
        _rateLimitChannel.onmessage = (event) => {
            if (event.data && event.data.type === 'increment') {
                const now = Date.now();
                if (now > _rateLimit.resetTime) {
                    _rateLimit.count = 1;
                    _rateLimit.resetTime = now + RATE_LIMIT_WINDOW;
                } else {
                    _rateLimit.count++;
                }
            }
        };
    } catch (_e) {
        console.warn('[Aladinn] BroadcastChannel not supported, falling back to local rate limit.');
    }

    function checkRateLimit() {
        const now = Date.now();
        if (now > _rateLimit.resetTime) {
            _rateLimit.count = 0;
            _rateLimit.resetTime = now + RATE_LIMIT_WINDOW;
        }
        _rateLimit.count++;
        
        // Notify other tabs
        if (_rateLimitChannel) {
            _rateLimitChannel.postMessage({ type: 'increment' });
        }
        
        return _rateLimit.count <= RATE_LIMIT_MAX;
    }

    /**
     * 🔍 Resolve active patient grid — Hỗ trợ cả Nội trú và Ngoại trú
     * Tìm grid thực sự chứa rowId hoặc có selrow, ưu tiên grid có dữ liệu.
     * @param {string|null} rowId - Row ID từ content script
     * @param {{ strict?: boolean }} options - Tùy chọn, strict: true sẽ không fallback sang selrow nếu rowId fail
     * @returns {{ grid: any, rowData: Object, isOutpatient: boolean, effectiveRowId: string|null }}
     */
    function resolveActiveGrid(rowId, options = { strict: false }) {
        const EMPTY = { grid: null, rowData: {}, isOutpatient: false, effectiveRowId: null };

        let activeGrid = null;
        let active_$ = null;
        let isOutpatient = false;

        const frames = [window, ...Array.from(document.querySelectorAll('iframe')).map(f => f.contentWindow).filter(Boolean)];

        for (const win of frames) {
            try {
                if (win.$) {
                    const grid = win.$('#grdBenhNhan');
                    if (grid && grid.length > 0) {
                        activeGrid = grid;
                        active_$ = win.$;
                        isOutpatient = false;
                        break;
                    }
                }
            } catch (_e) {}
        }

        if (!activeGrid) {
            for (const win of frames) {
                try {
                    if (win.$) {
                        const grid = win.$('#grdDSBenhNhan');
                        if (grid && grid.length > 0) {
                            activeGrid = grid;
                            active_$ = win.$;
                            isOutpatient = true;
                            break;
                        }
                    }
                } catch (_e) {}
            }
        }

        if (!activeGrid || !active_$) return EMPTY;

        // Helper: thử lấy rowData từ grid
        function tryGrid(grid, rid) {
            if (!grid || grid.length === 0 || !rid) return null;
            try {
                const rd = grid.jqGrid('getRowData', rid);
                if (rd && Object.keys(rd).length > 0) return rd;
            } catch (_e) { /* grid không khớp */ }
            return null;
        }

        // Helper: lấy selrow từ grid
        function getSelRow(grid) {
            if (!grid || grid.length === 0) return null;
            try { return grid.jqGrid('getGridParam', 'selrow') || null; }
            catch (_e) { return null; }
        }

        // Standardize rowId to clean up stringified null/undefined
        const cleanRowId = (rowId !== null && rowId !== undefined && rowId !== 'null' && rowId !== 'undefined') ? String(rowId).trim() : null;

        // 1. Thử tìm chính xác theo rowId
        if (cleanRowId) {
            if (!isOutpatient) {
                const rdIn = tryGrid(activeGrid, cleanRowId);
                if (rdIn) return { grid: activeGrid, rowData: rdIn, isOutpatient: false, effectiveRowId: cleanRowId };
            } else {
                // Ngoại trú: cleanRowId có thể là KHAMBENHID, BENHNHANID, MABENHNHAN, MAHOSOBENHAN hoặc jqGrid row index.
                // Thử lấy selrow từ outGrid và check khớp
                const outSel = getSelRow(activeGrid);
                if (outSel) {
                    const rdOut = tryGrid(activeGrid, outSel);
                    if (rdOut && (
                        String(rdOut.KHAMBENHID || '').trim() === cleanRowId ||
                        String(rdOut.BENHNHANID || '').trim() === cleanRowId ||
                        String(rdOut.MABENHNHAN || '').trim() === cleanRowId ||
                        String(rdOut.MAHOSOBENHAN || '').trim() === cleanRowId ||
                        String(outSel).trim() === cleanRowId
                    )) {
                        return { grid: activeGrid, rowData: rdOut, isOutpatient: true, effectiveRowId: outSel };
                    }
                }

                // Nếu selrow không khớp, quét toàn bộ grid tìm dòng có ID khớp
                try {
                    const rowIds = activeGrid.jqGrid('getDataIDs') || [];
                    for (const rId of rowIds) {
                        const rd = tryGrid(activeGrid, rId);
                        if (rd && (
                            String(rd.KHAMBENHID || '').trim() === cleanRowId ||
                            String(rd.BENHNHANID || '').trim() === cleanRowId ||
                            String(rd.MABENHNHAN || '').trim() === cleanRowId ||
                            String(rd.MAHOSOBENHAN || '').trim() === cleanRowId ||
                            String(rId).trim() === cleanRowId
                        )) {
                            return { grid: activeGrid, rowData: rd, isOutpatient: true, effectiveRowId: rId };
                        }
                    }
                } catch (e) {
                    debugLog('[API-Bridge] Error scanning outpatient grid rows:', e);
                }

                // Fallback direct lookup bằng tryGrid(activeGrid, cleanRowId)
                const rdOutDirect = tryGrid(activeGrid, cleanRowId);
                if (rdOutDirect) return { grid: activeGrid, rowData: rdOutDirect, isOutpatient: true, effectiveRowId: cleanRowId };
            }
        }

        // 2. Fallback: Lấy selrow từ grid đang chọn (nếu không ở strict mode HOẶC nếu ở Ngoại trú)
        // Vì Ngoại trú chỉ hiển thị và trích xuất dữ liệu lâm sàng từ DOM của bệnh nhân đang chọn trên màn hình,
        // việc fallback về selrow ở Ngoại trú là tuyệt đối an toàn và chính xác để đồng bộ với DOM.
        if (!options.strict || isOutpatient) {
            const sel = getSelRow(activeGrid);
            if (sel) {
                const rd = tryGrid(activeGrid, sel);
                if (rd) return { grid: activeGrid, rowData: rd, isOutpatient, effectiveRowId: sel };
            }
        }

        return EMPTY;
    }

    function _findDomElement(id) {
        var el = document.getElementById(id);
        if (el) return el;
        var iframes = document.querySelectorAll('iframe');
        for (var i = 0; i < iframes.length; i++) {
            try {
                var doc = iframes[i].contentDocument || iframes[i].contentWindow.document;
                if (doc) {
                    var innerEl = doc.getElementById(id);
                    if (innerEl) return innerEl;
                }
            } catch (_e) {}
        }
        return null;
    }

    function _decodeHtmlEntities(str) {
        if (!str) return '';
        try {
            var txt = document.createElement('textarea');
            txt.innerHTML = str;
            return txt.value.normalize('NFC');
        } catch (_e) {
            return str.normalize('NFC');
        }
    }

    function _cleanHisText(value) {
        if (!value) return '';
        var decoded = _decodeHtmlEntities(String(value));
        return decoded
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function _cleanLydoVaoVien(val) {
        if (!val) return '';
        var trimmed = String(val).trim();
        if (/^[.\-\s_?]+$/.test(trimmed) || trimmed.match(/^\.+\s*$/)) {
            return '';
        }
        return trimmed;
    }

    function _firstValue(row, keys) {
        if (!row) return '';
        for (const key of keys) {
            const value = row[key];
            if (value !== undefined && value !== null && String(value).trim() !== '') return value;
        }
        return '';
    }

    function _parseHisRows(payload) {
        if (!payload) return [];
        let data = payload;
        if (typeof payload === 'string' && payload.trim() !== '') {
            try { data = JSON.parse(payload); } catch (_e) { return []; }
        }
        if (Array.isArray(data)) return data;
        if (Array.isArray(data.rows)) return data.rows;
        if (data.data && Array.isArray(data.data)) return data.data;
        return typeof data === 'object' ? [data] : [];
    }

    async function _fetchHisPagingRows(queryCode, options, rows = 500, sort = '') {
        return new Promise((resolve) => {
            try {
                const uuid = _jsonrpc?.AjaxJson?.uuid;
                if (!uuid) return resolve([]);
                const params = {
                    func: 'ajaxExecuteQueryPaging',
                    uuid,
                    params: [queryCode],
                    options
                };
                const sortPart = sort || 'sidx=&sord=desc';
                const xhr = new XMLHttpRequest();
                const url = `/vnpthis/RestService?_search=false&rows=${rows}&page=1&${sortPart}&postData=${encodeURIComponent(JSON.stringify(params))}`;
                xhr.open('GET', url, true); // Chuyển sang async
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            resolve(_parseHisRows(xhr.responseText));
                        } else {
                            resolve([]);
                        }
                    }
                };
                xhr.send();
            } catch (_e) {
                resolve([]);
            }
        });
    }

    async function _asyncCallSpO(sp, params, cache = 0) {
        return new Promise((resolve) => {
            try {
                // Try jabsorb async callback pattern (standard for jabsorb 1.3+)
                // If the first argument is a function, jabsorb makes an asynchronous XHR call.
                try {
                    _jsonrpc.AjaxJson.ajaxCALL_SP_O(function(result, exception) {
                        if (exception) {
                            console.warn('[API-Bridge] Async jabsorb exception:', exception);
                            resolve(null);
                        } else {
                            resolve(result);
                        }
                    }, sp, params, cache);
                    return; // Async call initiated successfully
                } catch (_e) {
                    // Fallback to manual fetch if callback pattern is not supported by this proxy version
                    if (!_asyncCallSpO._warnedSps) _asyncCallSpO._warnedSps = new Set();
                    if (!_asyncCallSpO._warnedSps.has(sp)) {
                        _asyncCallSpO._warnedSps.add(sp);
                        console.warn('[API-Bridge] jabsorb async failed for', sp, '- using sync fallback (further warnings suppressed)');
                    }
                }

                // Fallback: Thực hiện cuộc gọi đồng bộ (sync) nguyên bản để khôi phục dữ liệu
                try {
                    const result = _jsonrpc.AjaxJson.ajaxCALL_SP_O(sp, params, cache);
                    resolve(result);
                } catch (e2) {
                    console.error('[API-Bridge] Sync fallback failed for', sp, ':', e2);
                    resolve(null);
                }
            } catch (e) {
                console.error('[API-Bridge] Async jabsorb exception:', e);
                resolve(null);
            }
        });
    }

    function _readActiveGridCell(rowId, fieldName) {
        if (!_$ || !fieldName) return '';
        try {
            const { grid, effectiveRowId } = resolveActiveGrid(rowId);
            if (!grid || !effectiveRowId) return '';
            const value = grid.jqGrid('getCell', effectiveRowId, fieldName);
            return value !== undefined && value !== null ? String(value).trim() : '';
        } catch (_e) {
            return '';
        }
    }

    function _contextValue(rowData, rowId, keys) {
        const fromRow = _firstValue(rowData, keys);
        if (fromRow) return fromRow;
        for (const key of keys) {
            const fromCell = _readActiveGridCell(rowId, key);
            if (fromCell) return fromCell;
        }
        return '';
    }

    function _buildContextCandidates(rowData, rowId) {
        return [
            _contextValue(rowData, rowId, ['KHAMBENHID']),
            _contextValue(rowData, rowId, ['MADIEUTRI', 'KHAMBENHDTKHID']),
            _contextValue(rowData, rowId, ['HOSOBENHANID', 'HSBAID']),
            _contextValue(rowData, rowId, ['TIEPNHANID']),
            _contextValue(rowData, rowId, ['BENHNHANID']),
            rowId
        ].filter(v => v !== undefined && v !== null && String(v).trim() !== '');
    }

    async function fetchPatientContextRows(rowData, rowId) {
        const candidates = Array.from(new Set(_buildContextCandidates(rowData, rowId)));
        const benhnhanId = rowData.BENHNHANID || '';
        const optionSets = [];
        for (const candidate of candidates) {
            optionSets.push([
                { name: '[0]', value: String(candidate) },
                { name: '[1]', value: String(benhnhanId) },
                { name: '[2]', value: '' },
                { name: '[3]', value: String(rowData.HOSOBENHANID || rowData.HSBAID || candidate) }
            ]);
            optionSets.push([{ name: '[0]', value: String(candidate) }]);
        }

        for (const options of optionSets) {
            const rows = await _fetchHisPagingRows('NGT02K016.EV003', options, 50);
            if (rows.length > 0) return rows;
        }
        return [];
    }

    async function resolveTreatmentContext(rowData, rowId) {
        const rows = await fetchPatientContextRows(rowData, rowId);
        const first = rows[0] || {};
        return {
            sourceRows: rows.length,
            KHAMBENHID: _firstValue(first, ['KHAMBENHID', 'KHAM_BENH_ID', 'MADIEUTRI', 'MA_DIEU_TRI']) || _contextValue(rowData, rowId, ['KHAMBENHID', 'MADIEUTRI', 'KHAMBENHDTKHID']),
            HOSOBENHANID: _firstValue(first, ['HOSOBENHANID', 'HSBAID', 'HO_SO_BENH_AN_ID']) || _contextValue(rowData, rowId, ['HOSOBENHANID', 'HSBAID']),
            BENHNHANID: _firstValue(first, ['BENHNHANID', 'MA_BENH_NHAN_ID']) || _contextValue(rowData, rowId, ['BENHNHANID']),
            TIEPNHANID: _firstValue(first, ['TIEPNHANID', 'TIEP_NHAN_ID']) || _contextValue(rowData, rowId, ['TIEPNHANID'])
        };
    }

    async function fetchAdmissionTimes(rowData, rowId) {
        const ctx = await resolveTreatmentContext(rowData, rowId);
        const candidates = Array.from(new Set([
            ctx.KHAMBENHID,
            ctx.HOSOBENHANID,
            ctx.TIEPNHANID,
            rowData.KHAMBENHID,
            rowData.HOSOBENHANID,
            rowData.TIEPNHANID,
            rowId
        ].filter(v => v !== undefined && v !== null && String(v).trim() !== '')));
        const optionSets = [];
        for (const candidate of candidates) {
            optionSets.push([
                { name: '[0]', value: String(candidate) },
                { name: '[1]', value: String(ctx.BENHNHANID || rowData.BENHNHANID || '') },
                { name: '[2]', value: '' },
                { name: '[3]', value: String(ctx.HOSOBENHANID || candidate) }
            ]);
            optionSets.push([{ name: '[0]', value: String(candidate) }]);
        }

        for (const options of optionSets) {
            const rows = await _fetchHisPagingRows('NTU02D021.GET_TGVV', options, 50);
            if (rows.length > 0) {
                const first = rows[0] || {};
                return {
                    sourceRows: rows.length,
                    thoiGianVaoVien: _firstValue(first, ['THOIGIANVAOVIEN', 'TGVV', 'NGAYVAOVIEN', 'NGAY_VAO_VIEN', 'NGAYTIEPNHAN']),
                    thoiGianRaVien: _firstValue(first, ['THOIGIANRAVIEN', 'TGRV', 'NGAYRAVIEN', 'NGAY_RA_VIEN']),
                    ngayVaoKhoa: _firstValue(first, ['NGAYVAOKHOA', 'NGAY_VAO_KHOA']),
                    soNgayDieuTri: _firstValue(first, ['SONGAYDIEUTRI', 'SO_NGAY_DIEU_TRI', 'SNDT'])
                };
            }
        }
        return {
            sourceRows: 0,
            thoiGianVaoVien: _contextValue(rowData, rowId, ['THOIGIANVAOVIEN', 'NGAYTIEPNHAN']),
            thoiGianRaVien: _contextValue(rowData, rowId, ['THOIGIANRAVIEN', 'NGAYRAVIEN']),
            ngayVaoKhoa: _contextValue(rowData, rowId, ['NGAYVAOKHOA', 'NGAYVAOKHOA']),
            soNgayDieuTri: _contextValue(rowData, rowId, ['SONGAYDIEUTRI', 'SNDT'])
        };
    }

    async function fetchNonDrugOrders(rowData, rowId) {
        const ctx = await resolveTreatmentContext(rowData, rowId);
        const candidates = Array.from(new Set([
            ctx.KHAMBENHID,
            rowData.KHAMBENHID,
            rowData.MADIEUTRI,
            ctx.HOSOBENHANID,
            rowData.HOSOBENHANID,
            rowData.TIEPNHANID,
            rowId
        ].filter(v => v !== undefined && v !== null && String(v).trim() !== '')));
        const optionSets = [];
        for (const candidate of candidates) {
            optionSets.push([
                { name: '[0]', value: String(candidate) },
                { name: '[1]', value: String(ctx.BENHNHANID || rowData.BENHNHANID || '') },
                { name: '[2]', value: '' },
                { name: '[3]', value: String(ctx.HOSOBENHANID || rowData.HOSOBENHANID || candidate) }
            ]);
            optionSets.push([{ name: '[0]', value: String(candidate) }]);
        }

        let rows = [];
        for (const options of optionSets) {
            rows = await _fetchHisPagingRows('NGT02K015.YLENH', options, 500, 'sidx=NGAY_Y_LENH&sord=desc');
            if (rows.length > 0) break;
        }

        const orders = [];
        const seen = new Set();
        for (const row of rows) {
            const text = _cleanHisText(_firstValue(row, [
                'YLENH', 'TENYLENH', 'NOIDUNGYLENH', 'NOIDUNG', 'TEN', 'TENDICHVU',
                'CHE_DO_AN', 'CHEDOAN', 'CHEDO_AN', 'CHE_DO_CHAM_SOC', 'CHEDOCHAMSOC'
            ]));
            const group = _cleanHisText(_firstValue(row, [
                'LOAIYLENH', 'NHOMYLENH', 'TENNHOM', 'NHOM', 'LOAI', 'TENLOAI'
            ]));
            const note = _cleanHisText(_firstValue(row, ['GHICHU', 'GHI_CHU', 'CHITIET', 'MOTA']));
            const date = _firstValue(row, [
                'NGAY_Y_LENH', 'NGAYYLENH', 'NGAYMAUBENHPHAM', 'NGAYTAO', 'NGAY', 'THOIGIAN'
            ]);
            if (!text && !note) continue;
            const key = `${date}|${group}|${text}|${note}`;
            if (seen.has(key)) continue;
            seen.add(key);
            orders.push({
                NGAYMAUBENHPHAM: String(date || ''),
                YLENH: text || note,
                NHOMYLENH: group,
                GHICHU: note,
                NGUOITAO: _firstValue(row, ['NGUOITAO', 'BACSI', 'TENBACSI', 'NGUOI_TAO']) || '',
                SOURCE_API: 'NGT02K015.YLENH'
            });
        }
        return orders;
    }

    window.addEventListener('message', function (event) {
        // SECURITY: Allow local origin or any origin on the same domain if needed
        if (event.origin !== window.location.origin) return;
        if (!event.data || !event.data.type) return;

        if (event.data.type === 'ALADINN_SET_DEBUG') {
            window.__ALADINN_DEBUG__ = event.data.state;
            return;
        }

        // SECURITY: Rate-limit all incoming requests
        if (event.data.type.startsWith('REQ_') && !checkRateLimit()) {
            console.warn('[Aladinn API-Bridge] Rate limit exceeded — request dropped');
            return;
        }

        // SECURITY: Verify token and nonce for requests
        if (event.data.type.startsWith('REQ_') || event.data.type === 'TRIGGER_PTTT_PRINT') {
            if (!SECURE_TOKEN || event.data.token !== SECURE_TOKEN) {
                console.warn('[Aladinn API-Bridge] Unauthorized request blocked (Invalid token)');
                return;
            }
            if (!ALADINN_NONCE || event.data.nonce !== ALADINN_NONCE) {
                console.warn('[Aladinn API-Bridge] Unauthorized request blocked (Invalid nonce)');
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
            case 'REQ_PACS_URL':
                fetchPacsUrl(event.data.pacsConfig || event.data.sheetId, event.data.requestId);
                break;
            case 'REQ_FETCH_BHYT_TIMES':
                fetchBhytTimes(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_PREFETCH_DIAGNOSES':
                prefetchDiagnosesFromGrid(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_CLINICAL_SUMMARY':
                fetchClinicalSummary(event.data.rowId, event.data.requestId);
                break;
            case 'REQ_FETCH_PATIENT_DEMOGRAPHICS':
                fetchPatientDemographics(event.data.rowId, event.data.requestId);
                break;
            // SECURITY: REQ_CALL_SP has been removed to prevent arbitrary SP execution via XSS.
        }
    });

    async function fetchHistory(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_HISTORY_RESULT', rowId, { history: {}, _context: null }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId, { strict: true });
            const hsbaId = rowData.HOSOBENHANID || rowData.HSBAID;
            const kbIdHienTai = rowData.KHAMBENHID || rowData.MADIEUTRI || rowId;

            if (!hsbaId && !kbIdHienTai) {
                sendResult('FETCH_HISTORY_RESULT', rowId, { history: {}, _context: null }, requestId);
                return;
            }

            let historyData = {};

            const accumulate = (rec) => {
                if (!rec) return;
                
                if (!historyData.LYDOVAOVIEN) historyData.LYDOVAOVIEN = rec.LYDOVAOVIEN || rec.LY_DO_VAO_VIEN || '';
                if (!historyData.QUATRINHBENHLY) historyData.QUATRINHBENHLY = rec.QUATRINHBENHLY || rec.QUA_TRINH_BENH_LY || rec.BENHSU || rec.BENH_SU || '';
                if (!historyData.TIENSUBENH_BANTHAN) historyData.TIENSUBENH_BANTHAN = rec.TIENSUBENH_BANTHAN || rec.TIEN_SU_BAN_THAN || rec.TIENSU_BANTHAN || rec.TIENSU || rec.TIEN_SU || '';
                if (!historyData.TIENSUBENH_GIADINH) historyData.TIENSUBENH_GIADINH = rec.TIENSUBENH_GIADINH || rec.TIENSUGIADINH || rec.TIEN_SU_GIA_DINH || '';
                if (!historyData.KHAMBENH_TOANTHAN) historyData.KHAMBENH_TOANTHAN = rec.KHAMBENH_TOANTHAN || rec.KHAM_TOAN_THAN || rec.TOANTHAN || '';
                if (!historyData.KHAMBENH_BOPHAN) historyData.KHAMBENH_BOPHAN = rec.KHAMBENH_BOPHAN || rec.KHAM_BO_PHAN || rec.BOPHAN || '';
                if (!historyData.TOMTATKQCANLAMSANG) historyData.TOMTATKQCANLAMSANG = rec.TOMTATKQCANLAMSANG || rec.TOMTAT_CLS || rec.TOM_TAT_CLS || rec.TOM_TAT_KQ_CAN_LAM_SANG || '';

                // Universal scan: Extract CHANDOAN and MABENHCHINH
                if (!historyData.CHANDOAN) {
                    let tempChanDoan = '';
                    let tempMa = '';
                    let tempChanDoanPhu = '';
                    let tempMaPhu = '';

                    for (const k in rec) {
                        const uk = k.toUpperCase();
                        const val = rec[k] ? String(rec[k]).trim() : '';
                        if (!val || val.length < 2) continue;

                        if (uk.includes('CHANDOAN') || uk.includes('CHAN_DOAN') || uk.includes('CHUANDOAN') || uk.includes('CHUAN_DOAN')) {
                            if (uk.includes('KEMTHEO') || uk.includes('PHU') || uk.includes('_KT')) {
                                tempChanDoanPhu = val;
                            } else {
                                tempChanDoan = val;
                            }
                        }
                        if (uk === 'MABENHCHINH' || uk === 'MA_BENHCHINH' || uk === 'MACDC' || uk === 'MAICD') {
                            tempMa = val;
                        }
                        if (uk === 'MABENHKEMTHEO' || uk === 'MA_BENHKEMTHEO' || uk === 'MACDCKEMTHEO') {
                            tempMaPhu = val;
                        }
                    }

                    if (tempChanDoan) {
                        historyData.CHANDOAN = (tempMa && !tempChanDoan.includes(tempMa)) ? `${tempMa}-${tempChanDoan}` : tempChanDoan;
                        historyData.CHANDOAN = historyData.CHANDOAN.replace(/\s*\|\s*[A-Z]{2}\d{13}/i, '').replace(/\b[A-Z]{2}\d{13}\b/i, '').trim();
                    }
                    if (tempChanDoanPhu && !historyData.CHANDOAN_KEMTHEO) {
                        historyData.CHANDOAN_KEMTHEO = (tempMaPhu && !tempChanDoanPhu.includes(tempMaPhu)) ? `${tempMaPhu}-${tempChanDoanPhu}` : tempChanDoanPhu;
                        historyData.CHANDOAN_KEMTHEO = historyData.CHANDOAN_KEMTHEO.replace(/\s*\|\s*[A-Z]{2}\d{13}/i, '').replace(/\b[A-Z]{2}\d{13}\b/i, '').trim();
                    }
                }
            };

            const trySP = async (sp, p) => {
                try {
                    const params = (typeof p === 'object') ? JSON.stringify(p) : p;
                    const res = await _asyncCallSpO(sp, params, 0);
                    if (!res) return;
                    const data = (typeof res === 'string' && res.trim() !== '') ? JSON.parse(res) : res;
                    const recs = Array.isArray(data) ? data : [data];
                    for (let i = recs.length - 1; i >= 0; i--) accumulate(recs[i]);
                } catch (_e) { }
            };

            if (kbIdHienTai) await trySP('NT.006', { KHAMBENHID: kbIdHienTai });
            if (hsbaId) await trySP('NT.006.HSBA.HIS', { HOSOBENHANID: hsbaId });

            sendResult('FETCH_HISTORY_RESULT', rowId, { 
                history: historyData,
                _context: {
                    rowId,
                    KHAMBENHID: rowData.KHAMBENHID || rowData.MADIEUTRI || '',
                    HOSOBENHANID: rowData.HOSOBENHANID || rowData.HSBAID || '',
                    BENHNHANID: rowData.BENHNHANID || '',
                    patientName: rowData.TENBENHNHAN || rowData.HOTEN || ''
                }
            }, requestId);
        } catch (e) {
            console.error('[API-Bridge] fetchHistory error:', e);
            sendResult('FETCH_HISTORY_RESULT', rowId, { history: {}, _context: null }, requestId);
        }
    }

    // ══════════════════════════════════════════════════════════════
    // Phase 1: FETCH_PATIENT_DEMOGRAPHICS — Thay thế DOM reads cho
    // giới tính, tuổi, năm sinh, chẩn đoán, ngày nhập viện, phòng, BS
    // ══════════════════════════════════════════════════════════════
    async function fetchPatientDemographics(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_PATIENT_DEMOGRAPHICS_RESULT', rowId, { demographics: null, _context: null }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId, { strict: true });
            if (!rowData) {
                sendResult('FETCH_PATIENT_DEMOGRAPHICS_RESULT', rowId, { demographics: null, _context: null }, requestId);
                return;
            }

            // Universal scan: tìm tất cả field liên quan đến nhân khẩu học
            let gender = '', age = '', dob = '', diagnosis = '', maBenhChinh = '', chanDoanKemTheo = '', maBenhKemTheo = '', admissionDate = '', room = '', doctor = '', insuranceId = '', patientName = '';

            for (const k in rowData) {
                const uk = k.toUpperCase();
                const val = rowData[k];
                if (val === null || val === undefined || String(val).trim() === '' || val === '&nbsp;') continue;
                const sv = String(val).trim();

                // Giới tính
                if (!gender && (uk === 'GIOITINH' || uk === 'GT' || uk === 'PHAI' || uk === 'GIOI_TINH' || uk === 'SEX' || uk === 'GENDER')) {
                    gender = sv;
                }
                // Tuổi
                if (!age && (uk === 'TUOI' || uk === 'AGE')) {
                    age = sv;
                }
                // Ngày sinh / Năm sinh
                if (!dob && (uk === 'NGAYSINH' || uk === 'NAMSINH' || uk === 'NGAY_SINH' || uk === 'NAM_SINH' || uk === 'DOB' || uk === 'BIRTHDAY')) {
                    dob = sv;
                }
                // Chẩn đoán chính
                if (!diagnosis && (uk === 'CHANDOAN' || uk === 'CHAN_DOAN' || uk === 'CHANDOANCHINH' || uk === 'CHANDOAN_CHINH' || uk === 'TENBENHCHINH' || uk === 'TEN_BENHCHINH')) {
                    diagnosis = sv;
                }
                // Mã bệnh chính (ICD)
                if (!maBenhChinh && (uk === 'MABENHCHINH' || uk === 'MA_BENHCHINH' || uk === 'MACDC' || uk === 'MAICD' || uk === 'MACHANDOANVAOKHOA')) {
                    maBenhChinh = sv;
                }
                // Chẩn đoán kèm theo
                if (!chanDoanKemTheo && (uk === 'CHANDOANKEMTHEO' || uk === 'CHAN_DOAN_KEM_THEO' || uk === 'BENHKEMTHEO' || uk === 'TENBENHKEMTHEO')) {
                    chanDoanKemTheo = sv;
                }
                // Mã bệnh kèm theo
                if (!maBenhKemTheo && (uk === 'MABENHKEMTHEO' || uk === 'MA_BENHKEMTHEO' || uk === 'MACDCKEMTHEO' || uk === 'MACHANDOANVAOKHOA_KEMTHEO')) {
                    maBenhKemTheo = sv;
                }
                // Ngày nhập viện / vào khoa
                if (!admissionDate && (uk === 'THOIGIANVAOVIEN' || uk === 'NGAYVAOKHOA' || uk === 'NGAYTIEPNHAN' || uk === 'NGAYNHAPKHOA' || uk === 'NGAY_VAO_VIEN' || uk === 'THOIGIAN_VAOVIEN')) {
                    admissionDate = sv;
                }
                // Phòng / Giường
                if (!room && (uk === 'TENBUONG' || uk === 'GIUONG_NAME' || uk === 'BUONG' || uk === 'TENGIUONG' || uk === 'GIUONG' || uk === 'TENPHONG')) {
                    room = sv;
                }
                // Bác sĩ điều trị
                if (!doctor && (uk === 'BSDIEUTRI' || uk === 'BACSI' || uk === 'TENBACSI' || uk === 'TENBS' || uk === 'BS_DIEUTRI' || uk === 'TEN_BS')) {
                    doctor = sv;
                }
                // Số BHYT
                if (!insuranceId && (uk === 'SOBHYT' || uk === 'BHYT' || uk === 'SO_BHYT' || uk === 'MATHE_BHYT')) {
                    insuranceId = sv;
                }
                // Tên BN
                if (!patientName && (uk === 'TENBENHNHAN' || uk === 'HOTEN' || uk === 'TEN_BN' || uk === 'TEN_BENHNHAN')) {
                    patientName = sv;
                }
            }

            // Loại bỏ mã BHYT rác (ví dụ: | GD4828723165180) dính vào cuối chuỗi chẩn đoán
            if (diagnosis) {
                diagnosis = diagnosis.replace(/\s*\|\s*[A-Z]{2}\d{13}\s*$/i, '').trim();
                diagnosis = diagnosis.replace(/\s*\b[A-Z]{2}\d{13}\b\s*$/i, '').trim();
            }

            // Gộp mã bệnh chính và tên bệnh chính vào diagnosis nếu có mã nhưng chưa gộp
            if (maBenhChinh && diagnosis && !diagnosis.includes(maBenhChinh)) {
                diagnosis = maBenhChinh + '-' + diagnosis;
            }

            // Gộp mã bệnh kèm theo và tên bệnh kèm theo nếu có
            if (maBenhKemTheo && chanDoanKemTheo && !chanDoanKemTheo.includes(maBenhKemTheo)) {
                chanDoanKemTheo = maBenhKemTheo + '-' + chanDoanKemTheo;
            }

            const demographics = {
                gender, age, dob, diagnosis, maBenhChinh, chanDoanKemTheo, maBenhKemTheo, admissionDate,
                room, doctor, insuranceId, patientName
            };

            // Đề xuất 6: Auto-enrich age từ dob khi age rỗng
            if (!demographics.age && demographics.dob) {
                const dobStr = String(demographics.dob).trim();
                let birthYear = 0;
                // Format dd/mm/yyyy hoặc yyyy
                if (dobStr.length === 4 && /^\d{4}$/.test(dobStr)) {
                    birthYear = parseInt(dobStr, 10);
                } else {
                    const parts = dobStr.match(/(\d{4})/);
                    if (parts) birthYear = parseInt(parts[1], 10);
                }
                if (birthYear > 1900 && birthYear <= new Date().getFullYear()) {
                    demographics.age = String(new Date().getFullYear() - birthYear);
                }
            }

            debugLog('[API-Bridge] Patient demographics:', demographics);
            sendResult('FETCH_PATIENT_DEMOGRAPHICS_RESULT', rowId, { 
                demographics,
                _context: {
                    rowId,
                    KHAMBENHID: rowData.KHAMBENHID || rowData.MADIEUTRI || '',
                    HOSOBENHANID: rowData.HOSOBENHANID || rowData.HSBAID || '',
                    BENHNHANID: rowData.BENHNHANID || '',
                    patientName: rowData.TENBENHNHAN || rowData.HOTEN || ''
                }
            }, requestId);
        } catch (e) {
            console.error('[API-Bridge] fetchPatientDemographics error:', e);
            sendResult('FETCH_PATIENT_DEMOGRAPHICS_RESULT', rowId, { demographics: null, _context: null }, requestId);
        }
    }

    async function fetchRoom(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_ROOM_RESULT', rowId, { giuong: '' }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId);
            const khambenhId = rowData.KHAMBENHID || rowData.MADIEUTRI || rowId;

            const result = await _asyncCallSpO('NT.005', khambenhId, 0);
            let giuong = '';
            if (Array.isArray(result) && result.length > 0) giuong = result[0].GIUONG;
            else if (result && result.GIUONG) giuong = result.GIUONG;

            sendResult('FETCH_ROOM_RESULT', rowId, { giuong }, requestId);
        } catch (_e) {
            sendResult('FETCH_ROOM_RESULT', rowId, { giuong: '' }, requestId);
        }
    }

    async function fetchVitals(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_VITALS_RESULT', rowId, { vitals: null }, requestId);
                return;
            }

            const now = Date.now();
            if (vitalsCache[rowId] && (now - vitalsCache[rowId].timestamp < 10000)) {
                debugLog(`[API-Bridge] Serving vitals for ${rowId} from cache.`);
                sendResult('FETCH_VITALS_RESULT', rowId, { vitals: vitalsCache[rowId].data, _context: vitalsCache[rowId]._context }, requestId);
                return;
            }

            const { grid, rowData, effectiveRowId } = resolveActiveGrid(rowId, { strict: true });
            if (!grid || !effectiveRowId) {
                sendResult('FETCH_VITALS_RESULT', rowId, { vitals: null, _context: null }, requestId);
                return;
            }
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
                rowElem.find('td').each(function () {
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

                const trySP = async (sp, p) => {
                    try {
                        const params = (typeof p === 'object') ? JSON.stringify(p) : p;
                        const res = await _asyncCallSpO(sp, params, 0);
                        if (!res) return;
                        const data = (typeof res === 'string' && res.trim() !== '') ? JSON.parse(res) : res;
                        const recs = Array.isArray(data) ? data : [data];
                        recs.forEach(accumulate);
                    } catch (_e) { }
                };

                if (kbIdHienTai) await trySP('NT.006', { KHAMBENHID: kbIdHienTai });
                if ((!found.w || !found.h || !found.bp || !finalVitals.pulse || !finalVitals.temperature) && hosobenhanid) await trySP('NT.006.HSBA.HIS', { HOSOBENHANID: hosobenhanid });
                if ((!found.w || !found.h || !found.bp || !finalVitals.pulse || !finalVitals.temperature) && kbIdHienTai) await trySP('NT.005', kbIdHienTai);
            }

            // Clean up
            for (let key in finalVitals) {
                if (finalVitals[key] === '&nbsp;' || finalVitals[key] === 'undefined' || finalVitals[key] === 'null') {
                    finalVitals[key] = '';
                } else {
                    finalVitals[key] = String(finalVitals[key]).replace(/<[^>]+>/g, '').trim();
                }
            }

            // Phase 2: Thêm admissionDate vào vitals result (thay thế DOM read trong nutrition.js)
            finalVitals.admissionDate = rowData.THOIGIANVAOVIEN || rowData.NGAYVAOKHOA || rowData.NGAYTIEPNHAN || rowData.NGAYNHAPKHOA || '';

            const _context = {
                rowId,
                KHAMBENHID: rowData.KHAMBENHID || rowData.MADIEUTRI || '',
                HOSOBENHANID: rowData.HOSOBENHANID || rowData.HSBAID || '',
                BENHNHANID: rowData.BENHNHANID || '',
                patientName: rowData.TENBENHNHAN || rowData.HOTEN || ''
            };

            vitalsCache[rowId] = { data: finalVitals, _context: _context, timestamp: Date.now() };
            _evictVitalsCache();
            sendResult('FETCH_VITALS_RESULT', rowId, { vitals: finalVitals, _context }, requestId);
        } catch (e) {
            console.error('[API-Bridge] fetchVitals error:', e);
            sendResult('FETCH_VITALS_RESULT', rowId, { vitals: null, _context: null }, requestId);
        }
    }

    async function fetchTreatment(rowId, requestId) {
        let yLenhList = [];
        let contextInfo;
        try {
            if (!_$) {
                sendResult('FETCH_TREATMENT_RESULT', rowId, { treatmentList: [] }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId);
            const benhnhanId = rowData.BENHNHANID || '';
            contextInfo = await resolveTreatmentContext(rowData, rowId);
            yLenhList = await fetchNonDrugOrders(rowData, rowId);

            let candidates = [
                contextInfo.HOSOBENHANID,
                contextInfo.TIEPNHANID,
                contextInfo.KHAMBENHID,
                rowData.HOSOBENHANID,
                rowData.TIEPNHANID,
                rowData.KHAMBENHID,
                rowData.MADIEUTRI
            ].filter(v => v !== undefined && v !== null && String(v).trim() !== '');

            candidates = Array.from(new Set(candidates));

            let foundRows = false;
            for (let testId of candidates) {
                const options = [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '4' },
                    { name: '[3]', value: String(testId) }
                ];

                const rows = await _fetchHisPagingRows('NT.024.DSPHIEU', options, 500, 'sidx=NGAYMAUBENHPHAM&sord=desc');

                if (rows && rows.length > 0) {
                    foundRows = true;
                    const detailOrders = [];
                    const seenDetailOrders = new Set();
                    const treatments = rows.map(r => {
                        const t = {
                            DIENBIEN: r.DIENBIENBENH || r.NOIDUNG || '',
                            GHICHU: r.GHICHUPDT || r.GHICHU || r.CHITIETGHICHU || '',
                            NGUOITAO: r.NGUOITAO || '',
                            NGAYMAUBENHPHAM: r.NGAYMAUBENHPHAM || r.NGAY_Y_LENH || '',
                            MAUBENHPHAMID: r.MAUBENHPHAMID || r.PHIEUDIEUTRIID || r.MADIEUTRI || r.ID_PHIEU_DIEU_TRI || '',
                            CHANDOAN: '',
                            CHANDOANKEMTHEO: '',
                            YLENH: _cleanHisText(r.YLENH || ''),
                            XULY: _cleanHisText(r.XULY || r.HUONGXUTRI || r.HUONGXULY || r.HUONG_XU_TRI || r.XUTRI || r.XU_TRI || ''),
                            TOANTHAN: _cleanHisText(r.KHAMTOANTHAN || r.TOANTHAN || r.KHAMBENH_TOANTHAN || r.KHAMBENHTOANTHAN || r.KHAM_TOAN_THAN || ''),
                            KHAMBOPHAN: _cleanHisText(r.KHAMBOPHAN || r.BOPHAN || r.KHAMBENH_BOPHAN || ''),
                            MACH: r.MACH || r.KHAMBENH_MACH || '',
                            NHIETDO: r.NHIETDO || r.KHAMBENH_NHIETDO || '',
                            HUYETAP: (r.HUYETAP_HI && r.HUYETAP_LOW) ? (r.HUYETAP_HI + '/' + r.HUYETAP_LOW) : (r.HUYETAP || r.KHAMBENH_HUYETAP || ''),
                            NHIPTHO: r.NHIPTHO || r.KHAMBENH_NHIPTHO || '',
                            CANNANG: r.CANNANG || '',
                            CHIEUCAO: r.CHIEUCAO || '',
                            SPO2: r.SPO2 || ''
                        };
                        // Universal scan for diagnosis fields in sheet list
                        for (const k in r) {
                            const uk = k.toUpperCase();
                            const val = r[k];
                            if (!val || String(val).trim().length < 2) continue;

                            // Bỏ qua các cột hình ảnh, dịch vụ, yêu cầu (chống nhiễu "CĐQT phải")
                            if (uk.includes('HINHANH') || uk.includes('QUANGTUYEN') || uk.includes('YEUCAU') || uk.includes('CDHA') || uk.includes('DICHVU') || uk.includes('PHONGKHAM') || uk === 'TEN') continue;

                            if (uk.includes('CHANDOAN') || uk.includes('CHAN_DOAN') || uk.includes('CHUANDOAN') || uk.includes('CHUAN_DOAN') || uk.includes('BENHCHINH') || uk.includes('BENH_CHINH')) {
                                if (uk.includes('KEMTHEO') || uk.includes('PHU') || uk.includes('_KT')) {
                                    if (!t.CHANDOANKEMTHEO) t.CHANDOANKEMTHEO = String(val).trim();
                                } else {
                                    if (!t.CHANDOAN) t.CHANDOAN = String(val).trim();
                                }
                            }
                        }
                        // Fallback: universal scan cho bất kỳ field nào chứa ICD pattern hoặc text dài (case-insensitive)
                        if (!t.CHANDOAN) {
                            const icdPat = /\b[A-Z]\d{2}(?:\.\d{1,2})?\b/i;
                            for (const k in r) {
                                const uk = k.toUpperCase();
                                const val = r[k];
                                if (!val || typeof val !== 'string') continue;
                                const sv = val.trim();
                                if (sv.length < 3) continue;
                                // Skip known non-diagnosis fields
                                if (uk.includes('DIENBIEN') || uk.includes('GHICHU') || uk === 'NGUOITAO' || uk.includes('BARCODE') || uk.includes('NGAY') || uk.includes('SOPHIEU') || uk.includes('PHONG') || uk.includes('KHOA') || uk.includes('TRANGTHA') || uk.includes('BENHNHAN') || uk.includes('TIEPNHAN') || uk.includes('HOSOBE') || uk.includes('KHAMBE') || uk.includes('MAUBENH') || uk === 'RN' || uk.includes('DOITUONG') || uk.includes('TOTAL') || uk.includes('FLAG') || uk.includes('LOAI') || uk.includes('DICHVU') || uk.includes('TENNGH') || uk.includes('SLTHANG')) continue;
                                // Check if value contains ICD code pattern (K35.9, I64, R51 etc.)
                                if (icdPat.test(sv) && sv.length > 3) {
                                    if (!t.CHANDOAN) t.CHANDOAN = sv;
                                    else if (!t.CHANDOANKEMTHEO) t.CHANDOANKEMTHEO = sv;
                                }
                            }
                        }
                        // Trích xuất Y lệnh khác từ dòng tờ điều trị đại diện r
                        let sheetYLenh = '';
                        for (const k in r) {
                            const uk = k.toUpperCase();
                            if (uk.includes('YLENH') || uk.includes('Y_LENH')) {
                                const val = String(r[k] || '').trim();
                                if (val && val.length > 2 && val !== t.DIENBIEN && val !== t.GHICHU) {
                                    sheetYLenh = val;
                                    break;
                                }
                            }
                        }
                        if (sheetYLenh) {
                            const cleanText = _cleanHisText(sheetYLenh);
                            if (cleanText) {
                                const key = `${t.NGAYMAUBENHPHAM}|Phiếu điều trị|${cleanText}|`;
                                if (!seenDetailOrders.has(key)) {
                                    seenDetailOrders.add(key);
                                    detailOrders.push({
                                        NGAYMAUBENHPHAM: t.NGAYMAUBENHPHAM || '',
                                        YLENH: cleanText,
                                        NHOMYLENH: 'Y lệnh khác',
                                        GHICHU: '',
                                        NGUOITAO: t.NGUOITAO || '',
                                        SOURCE_API: 'NT.024.2.DETAIL'
                                    });
                                }
                            }
                        }

                        return t;
                    });
                    console.log('[ALADINN-DIAG] Pre-scrape:', treatments.length, 'sheets, CĐ found:', treatments.filter(t => t.CHANDOAN).length);

                    // Step 2: Fetch detail for diagnosis and y lệnh text from each sheet via background APIs.
                    const sheetsNeedDetail = treatments.filter(t => t.MAUBENHPHAMID);
                    // Fetch up to 20 sheets to balance detail coverage and network performance
                    const toFetch = sheetsNeedDetail.slice(0, 20);
                    await Promise.all(toFetch.map(async (sheet) => {
                        try {
                            // Gọi song song cả chỉ định con và chi tiết tờ điều trị gốc (chứa YLENH CKEditor, XULY, TOANTHAN, KHAMBOPHAN)
                            const [detailRes, laydlRes] = await Promise.all([
                                _asyncCallSpO('NT.024.2.DETAIL', String(sheet.MAUBENHPHAMID), 0),
                                _asyncCallSpO('NGT02K015.LAYDL', String(sheet.MAUBENHPHAMID), 0)
                            ]);

                            // Phân tích kết quả chi tiết tờ điều trị gốc (LAYDL)
                            let laydlObj = null;
                            try {
                                if (laydlRes) {
                                    let parsed = null;
                                    if (typeof laydlRes === 'string' && laydlRes.trim() !== '') {
                                        parsed = JSON.parse(laydlRes);
                                    } else {
                                        parsed = laydlRes;
                                    }

                                    if (parsed) {
                                        if (Array.isArray(parsed)) {
                                            laydlObj = parsed[0];
                                        } else if (parsed.rows && Array.isArray(parsed.rows)) {
                                            laydlObj = parsed.rows[0];
                                        } else {
                                            laydlObj = parsed;
                                        }
                                    }
                                }
                            } catch (_parseErr) {
                                console.warn('[API-Bridge] Failed to parse LAYDL result for sheet.');
                            }

                            if (laydlObj) {
                                sheet.YLENH = _cleanHisText(laydlObj.YLENH || laydlObj.Y_LENH || sheet.YLENH || '');
                                sheet.XULY = _cleanHisText(laydlObj.XULY || laydlObj.HUONGXUTRI || laydlObj.HUONGXULY || laydlObj.HUONG_XU_TRI || sheet.XULY || '');
                                sheet.TOANTHAN = _cleanHisText(laydlObj.KHAMTOANTHAN || laydlObj.TOANTHAN || laydlObj.KHAMBENH_TOANTHAN || laydlObj.KHAM_TOAN_THAN || sheet.TOANTHAN || '');
                                sheet.KHAMBOPHAN = _cleanHisText(laydlObj.KHAMBOPHAN || laydlObj.BOPHAN || laydlObj.KHAMBENH_BOPHAN || sheet.KHAMBOPHAN || '');
                                if (laydlObj.DIENBIENBENH || laydlObj.DIENBIEN) {
                                    sheet.DIENBIEN = _cleanHisText(laydlObj.DIENBIENBENH || laydlObj.DIENBIEN || sheet.DIENBIEN || '');
                                }
                                sheet.MACH = laydlObj.MACH || laydlObj.KHAMBENH_MACH || sheet.MACH || '';
                                sheet.NHIETDO = laydlObj.NHIETDO || laydlObj.KHAMBENH_NHIETDO || sheet.NHIETDO || '';
                                sheet.HUYETAP = (laydlObj.HUYETAP_HI && laydlObj.HUYETAP_LOW) ? (laydlObj.HUYETAP_HI + '/' + laydlObj.HUYETAP_LOW) : (laydlObj.HUYETAP || laydlObj.KHAMBENH_HUYETAP || sheet.HUYETAP || '');
                                sheet.NHIPTHO = laydlObj.NHIPTHO || laydlObj.KHAMBENH_NHIPTHO || sheet.NHIPTHO || '';
                                sheet.CANNANG = laydlObj.CANNANG || sheet.CANNANG || '';
                                sheet.CHIEUCAO = laydlObj.CHIEUCAO || sheet.CHIEUCAO || '';
                                sheet.SPO2 = laydlObj.SPO2 || sheet.SPO2 || '';

                                // Trích xuất y lệnh tự do từ CKEditor đưa vào cột Y lệnh của timeline
                                if (sheet.YLENH) {
                                    const key = `${sheet.NGAYMAUBENHPHAM}|Phiếu điều trị|${sheet.YLENH}|`;
                                    if (!seenDetailOrders.has(key)) {
                                        seenDetailOrders.add(key);
                                        detailOrders.push({
                                            NGAYMAUBENHPHAM: sheet.NGAYMAUBENHPHAM || '',
                                            YLENH: sheet.YLENH,
                                            NHOMYLENH: 'Y lệnh khác',
                                            GHICHU: '',
                                            NGUOITAO: sheet.NGUOITAO || '',
                                            SOURCE_API: 'NGT02K015.LAYDL'
                                        });
                                    }
                                }
                            }

                            let records = [];
                            if (typeof detailRes === 'string' && detailRes.trim() !== '') records = JSON.parse(detailRes);
                            else if (typeof detailRes === 'object' && detailRes !== null) records = detailRes;
                            if (records && records.rows && Array.isArray(records.rows)) records = records.rows;
                            else if (!Array.isArray(records)) records = [records];

                            let hasDirectChanDoan = false;
                            for (const rec of records) {
                                if (!rec) continue;
                                const detailOrderText = _cleanHisText(_firstValue(rec, [
                                    'YLENH', 'Y_LENH', 'NOIDUNGYLENH', 'NOI_DUNG_Y_LENH',
                                    'CHIDINH', 'CHI_DINH', 'CHEDOAN', 'CHE_DO_AN',
                                    'CHAMSOC', 'CHAM_SOC', 'CHEDOCHAMSOC', 'CHE_DO_CHAM_SOC'
                                ]));
                                const detailOrderGroup = _cleanHisText(_firstValue(rec, [
                                    'LOAIYLENH', 'LOAI_Y_LENH', 'NHOMYLENH', 'NHOM_Y_LENH',
                                    'TENNHOM', 'TEN_NHOM', 'LOAI', 'TENLOAI'
                                ]));
                                const detailOrderNote = _cleanHisText(_firstValue(rec, [
                                    'GHICHUYLENH', 'GHI_CHU_Y_LENH', 'GHICHU', 'GHI_CHU'
                                ]));
                                if (detailOrderText || detailOrderNote) {
                                    const key = `${sheet.NGAYMAUBENHPHAM}|${detailOrderGroup}|${detailOrderText}|${detailOrderNote}`;
                                    if (!seenDetailOrders.has(key)) {
                                        seenDetailOrders.add(key);
                                        detailOrders.push({
                                            NGAYMAUBENHPHAM: sheet.NGAYMAUBENHPHAM || '',
                                            YLENH: detailOrderText || detailOrderNote,
                                            NHOMYLENH: detailOrderGroup || 'Phiếu điều trị',
                                            GHICHU: detailOrderNote,
                                            NGUOITAO: sheet.NGUOITAO || '',
                                            SOURCE_API: 'NT.024.2.DETAIL'
                                        });
                                    }
                                }

                                // 1. Fast direct key scan
                                for (const k in rec) {
                                    const uk = k.toUpperCase();
                                    const val = rec[k];
                                    if (!val || String(val).trim().length < 2) continue;

                                    if (uk.includes('HINHANH') || uk.includes('QUANGTUYEN') || uk.includes('YEUCAU') || uk.includes('CDHA') || uk.includes('DICHVU') || uk.includes('PHONGKHAM') || uk === 'TEN') continue;

                                    if (uk.includes('CHANDOAN') || uk.includes('CHAN_DOAN') || uk.includes('CHUANDOAN') || uk.includes('CHUAN_DOAN') || uk.includes('BENHCHINH') || uk.includes('BENH_CHINH') || uk === 'TENCHANDOAN' || uk === 'TEN_CHANDOAN' || uk === 'TENCHUANDOAN' || uk === 'TEN_CHUANDOAN') {
                                        if (uk.includes('KEMTHEO') || uk.includes('PHU') || uk.includes('_KT')) {
                                            if (!sheet.CHANDOANKEMTHEO) sheet.CHANDOANKEMTHEO = String(val).trim();
                                        } else {
                                            if (!sheet.CHANDOAN) {
                                                sheet.CHANDOAN = String(val).trim();
                                                hasDirectChanDoan = true;
                                            }
                                        }
                                    }
                                }
                            }

                            // 2. Fallback: Detail Universal Scan if direct keys did not populate CHANDOAN
                            if (!hasDirectChanDoan || !sheet.CHANDOAN) {
                                let allDiagStrings = [];
                                var icdPatternExact = /^[A-Z]\d{2}(\.\d{1,2})?$/i;
                                var icdPatternContains = /(^|\s|\(|\[|-)[A-Z]\d{2}(\.\d{1,2})?($|\s|\)|\]|-)/i;

                                var potentialTexts = [];
                                for (var ri = 0; ri < records.length; ri++) {
                                    var rec = records[ri];
                                    if (!rec) continue;

                                    for (var rk in rec) {
                                        var ruk = rk.toUpperCase();
                                        var rv = String(rec[rk] || '').trim();
                                        if (rv.length < 2) continue;

                                        if (ruk.includes('HINHANH') || ruk.includes('QUANGTUYEN') || ruk.includes('YEUCAU') || ruk.includes('CDHA') || ruk.includes('DICHVU') || ruk.includes('PHONGKHAM') || ruk === 'TEN') continue;

                                        potentialTexts.push(rv);
                                    }
                                }

                                for (var i = 0; i < potentialTexts.length; i++) {
                                    var curText = potentialTexts[i];

                                    if (curText.length <= 6 && icdPatternExact.test(curText) && !curText.toUpperCase().startsWith('NK')) {
                                        var desc = '';
                                        for (var j = i - 1; j >= Math.max(0, i - 5); j--) {
                                            var t = potentialTexts[j];
                                            if (t.length > 5 && /[A-Za-zĐđÂâĂăÊêÔôƠơƯư]/i.test(t) && !icdPatternExact.test(t)) { desc = t; break; }
                                        }
                                        if (!desc) {
                                            for (j = i + 1; j <= Math.min(potentialTexts.length - 1, i + 5); j++) {
                                                t = potentialTexts[j];
                                                if (t.length > 5 && /[A-Za-zĐđÂâĂăÊêÔôƠơƯư]/i.test(t) && !icdPatternExact.test(t)) { desc = t; break; }
                                            }
                                        }

                                        if (desc) {
                                            allDiagStrings.push(curText + ' - ' + desc);
                                        } else {
                                            allDiagStrings.push(curText);
                                        }
                                    }
                                    else if (curText.length > 6 && icdPatternContains.test(curText)) {
                                        allDiagStrings.push(curText);
                                    }
                                }

                                allDiagStrings = [...new Set(allDiagStrings)];

                                var cleanDiag = function (str) {
                                    if (!str) return '';
                                    return str.replace(/^(chẩn đoán kèm theo|bệnh kèm theo|chẩn đoán|bệnh chính|kèm theo)[:\-\s]*/i, '').trim();
                                };

                                if (allDiagStrings.length > 0) {
                                    sheet.CHANDOAN = cleanDiag(allDiagStrings[0]);
                                    if (allDiagStrings.length > 1) {
                                        sheet.CHANDOANKEMTHEO = allDiagStrings.slice(1).map(cleanDiag).join('; ');
                                    }
                                }
                            }

                            // 3. Post-cleanup to ensure all diagnostics are stripped of standard prefixes
                            var finalClean = function (str) {
                                if (!str) return '';
                                return str.replace(/^(chẩn đoán kèm theo|bệnh kèm theo|chẩn đoán|bệnh chính|kèm theo)[:\-\s]*/i, '').trim();
                            };
                            if (sheet.CHANDOAN) sheet.CHANDOAN = finalClean(sheet.CHANDOAN);
                            if (sheet.CHANDOANKEMTHEO) sheet.CHANDOANKEMTHEO = finalClean(sheet.CHANDOANKEMTHEO);

                        } catch (_detailErr) {
                            console.warn('[API-Bridge] Detail fetch failed for sheet.');
                        }
                    }));

                    // Gộp và loại bỏ trùng lặp giữa yLenhList và detailOrders
                    const mergedYLenh = [...yLenhList];
                    const seenKeys = new Set(yLenhList.map(o => `${o.NGAYMAUBENHPHAM}|${o.NHOMYLENH}|${o.YLENH}|${o.GHICHU}`));
                    for (const detail of detailOrders) {
                        const key = `${detail.NGAYMAUBENHPHAM}|${detail.NHOMYLENH}|${detail.YLENH}|${detail.GHICHU}`;
                        if (!seenKeys.has(key)) {
                            seenKeys.add(key);
                            mergedYLenh.push(detail);
                        }
                    }
                    let allYLenh = mergedYLenh;

                    // Tích hợp dữ liệu thời gian thực từ DOM Tờ điều trị đang soạn thảo
                    try {
                        const domSheet = scrapeTreatmentSheetFromDOM();
                        if (domSheet) {
                            const now = new Date();
                            const timeStr = ('0' + now.getDate()).slice(-2) + '/' +
                                          ('0' + (now.getMonth() + 1)).slice(-2) + '/' +
                                          now.getFullYear() + ' ' +
                                          ('0' + now.getHours()).slice(-2) + ':' +
                                          ('0' + now.getMinutes()).slice(-2) + ':' +
                                          ('0' + now.getSeconds()).slice(-2);

                            const virtualSheet = {
                                DIENBIEN: domSheet.dienBienBenh || '',
                                GHICHU: domSheet.huongXuLy || '',
                                NGUOITAO: 'Bác sĩ đang soạn thảo',
                                NGAYMAUBENHPHAM: timeStr + ' (Đang soạn thảo)',
                                MAUBENHPHAMID: 'REALTIME_DOM_SHEET',
                                CHANDOAN: domSheet.chanDoanChinh || '',
                                CHANDOANKEMTHEO: domSheet.chanDoanKemTheo || '',
                                YLENH: domSheet.yLenh || '',
                                XULY: domSheet.huongXuLy || '',
                                TOANTHAN: domSheet.khamToanThanTDT || '',
                                KHAMBOPHAN: domSheet.khamBoPhan || '',
                                MACH: domSheet.sinhHieu?.pulse || '',
                                NHIETDO: domSheet.sinhHieu?.temperature || '',
                                HUYETAP: domSheet.sinhHieu?.bloodPressure || '',
                                NHIPTHO: domSheet.sinhHieu?.respiratoryRate || '',
                                CANNANG: domSheet.sinhHieu?.weight || '',
                                CHIEUCAO: domSheet.sinhHieu?.height || '',
                                SPO2: domSheet.sinhHieu?.spo2 || '',
                                IS_REALTIME: true
                            };

                            const virtualDetails = [];
                            if (domSheet.yLenh) {
                                virtualDetails.push({
                                    NGAYMAUBENHPHAM: timeStr + ' (Đang soạn thảo)',
                                    YLENH: domSheet.yLenh,
                                    NHOMYLENH: 'Y lệnh khác',
                                    GHICHU: '',
                                    NGUOITAO: 'Bác sĩ đang soạn thảo',
                                    SOURCE_API: 'REALTIME_DOM'
                                });
                            }
                            if (domSheet.diet) {
                                virtualDetails.push({
                                    NGAYMAUBENHPHAM: timeStr + ' (Đang soạn thảo)',
                                    YLENH: domSheet.diet,
                                    NHOMYLENH: 'Chế độ ăn',
                                    GHICHU: '',
                                    NGUOITAO: 'Bác sĩ đang soạn thảo',
                                    SOURCE_API: 'REALTIME_DOM'
                                });
                            }
                            if (domSheet.care) {
                                virtualDetails.push({
                                    NGAYMAUBENHPHAM: timeStr + ' (Đang soạn thảo)',
                                    YLENH: domSheet.care,
                                    NHOMYLENH: 'Chế độ chăm sóc',
                                    GHICHU: '',
                                    NGUOITAO: 'Bác sĩ đang soạn thảo',
                                    SOURCE_API: 'REALTIME_DOM'
                                });
                            }

                            // Đưa tờ điều trị và y lệnh ảo lên đầu
                            treatments.unshift(virtualSheet);
                            allYLenh = virtualDetails.concat(allYLenh);
                        }
                    } catch (domErr) {
                        console.warn('[API-Bridge] fetchTreatment realtime error:', domErr);
                    }

                    const combinedTreatments = treatments.concat(allYLenh);
                    sendResult('FETCH_TREATMENT_RESULT', rowId, {
                        treatmentList: combinedTreatments,
                        yLenhList: allYLenh,
                        treatmentContext: contextInfo
                    }, requestId);
                    
                    break; // stop on first success
                }
            }

            if (!foundRows) {
                let finalYLenhList = yLenhList;
                let finalTreatmentList = yLenhList;

                // Tích hợp dữ liệu thời gian thực nếu đang soạn thảo nhưng API chưa lưu dữ liệu
                try {
                    const domSheet = scrapeTreatmentSheetFromDOM();
                    if (domSheet) {
                        const now = new Date();
                        const timeStr = ('0' + now.getDate()).slice(-2) + '/' +
                                      ('0' + (now.getMonth() + 1)).slice(-2) + '/' +
                                      now.getFullYear() + ' ' +
                                      ('0' + now.getHours()).slice(-2) + ':' +
                                      ('0' + now.getMinutes()).slice(-2) + ':' +
                                      ('0' + now.getSeconds()).slice(-2);

                        const virtualSheet = {
                            DIENBIEN: domSheet.dienBienBenh || '',
                            GHICHU: domSheet.huongXuLy || '',
                            NGUOITAO: 'Bác sĩ đang soạn thảo',
                            NGAYMAUBENHPHAM: timeStr + ' (Đang soạn thảo)',
                            MAUBENHPHAMID: 'REALTIME_DOM_SHEET',
                            CHANDOAN: domSheet.chanDoanChinh || '',
                            CHANDOANKEMTHEO: domSheet.chanDoanKemTheo || '',
                            YLENH: domSheet.yLenh || '',
                            XULY: domSheet.huongXuLy || '',
                            TOANTHAN: domSheet.khamToanThanTDT || '',
                            KHAMBOPHAN: domSheet.khamBoPhan || '',
                            MACH: domSheet.sinhHieu?.pulse || '',
                            NHIETDO: domSheet.sinhHieu?.temperature || '',
                            HUYETAP: domSheet.sinhHieu?.bloodPressure || '',
                            NHIPTHO: domSheet.sinhHieu?.respiratoryRate || '',
                            CANNANG: domSheet.sinhHieu?.weight || '',
                            CHIEUCAO: domSheet.sinhHieu?.height || '',
                            SPO2: domSheet.sinhHieu?.spo2 || '',
                            IS_REALTIME: true
                        };

                        const virtualDetails = [];
                        if (domSheet.yLenh) {
                            virtualDetails.push({
                                NGAYMAUBENHPHAM: timeStr + ' (Đang soạn thảo)',
                                YLENH: domSheet.yLenh,
                                NHOMYLENH: 'Y lệnh khác',
                                GHICHU: '',
                                NGUOITAO: 'Bác sĩ đang soạn thảo',
                                SOURCE_API: 'REALTIME_DOM'
                            });
                        }
                        if (domSheet.diet) {
                            virtualDetails.push({
                                NGAYMAUBENHPHAM: timeStr + ' (Đang soạn thảo)',
                                YLENH: domSheet.diet,
                                NHOMYLENH: 'Chế độ ăn',
                                GHICHU: '',
                                NGUOITAO: 'Bác sĩ đang soạn thảo',
                                SOURCE_API: 'REALTIME_DOM'
                            });
                        }
                        if (domSheet.care) {
                            virtualDetails.push({
                                NGAYMAUBENHPHAM: timeStr + ' (Đang soạn thảo)',
                                YLENH: domSheet.care,
                                NHOMYLENH: 'Chế độ chăm sóc',
                                GHICHU: '',
                                NGUOITAO: 'Bác sĩ đang soạn thảo',
                                SOURCE_API: 'REALTIME_DOM'
                            });
                        }

                        finalYLenhList = virtualDetails.concat(yLenhList);
                        finalTreatmentList = [virtualSheet].concat(finalYLenhList);
                    }
                } catch (domErr) {
                    console.warn('[API-Bridge] fetchTreatment realtime (no rows) error:', domErr);
                }

                sendResult('FETCH_TREATMENT_RESULT', rowId, {
                    treatmentList: finalTreatmentList,
                    yLenhList: finalYLenhList,
                    treatmentContext: contextInfo
                }, requestId);
            }

        } catch (_e) {
            sendResult('FETCH_TREATMENT_RESULT', rowId, { treatmentList: yLenhList || [], yLenhList: yLenhList || [], treatmentContext: null }, requestId);
        }
    }

    // SECURITY: callSP() has been removed. All data access is now routed through
    // dedicated, validated handlers (fetchVitals, fetchHistory, fetchRoom, fetchTreatment, fetchDrugs).

    async function fetchDiagnosesForCDS(rowId, benhnhanId, khambenhId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_DIAGNOSES_RESULT', rowId || null, { diagnoses: [], _context: null }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId || null);
            benhnhanId = benhnhanId || rowData.BENHNHANID;
            khambenhId = khambenhId || rowData.KHAMBENHID || rowData.MADIEUTRI;

            const _context = {
                rowId: rowId || null,
                KHAMBENHID: khambenhId || '',
                HOSOBENHANID: rowData.HOSOBENHANID || rowData.HSBAID || '',
                BENHNHANID: benhnhanId || '',
                patientName: rowData.TENBENHNHAN || rowData.HOTEN || ''
            };

            if (!benhnhanId || !khambenhId) {
                sendResult('FETCH_DIAGNOSES_RESULT', rowId || null, { diagnoses: [], _context: null }, requestId);
                return;
            }

            const options = [
                { name: '[0]', value: '' },
                { name: '[1]', value: String(benhnhanId) },
                { name: '[2]', value: '4' },
                { name: '[3]', value: String(khambenhId) }
            ];

            const rows = await _fetchHisPagingRows('NT.024.DSPHIEU', options, 50, 'sidx=NGAYMAUBENHPHAM&sord=desc');
            if (rows && rows.length > 0) {
                let allDiagnoses = [];
                rows.forEach(item => {
                    const rawIcd = item.MAICD || item.ICD || item.MA_ICD || '';
                    const rawIcdSub = item.MAICD_KEMTHEO || item.MABENHKEMTHEO || item.ICD_KEMTHEO || item.MA_ICDKEMTHEO || '';
                    const rawName = item.CHANDOAN || item.TENBENH || '';
                    const rawNameSub = item.CHANDOAN_KEMTHEO || item.TENBENHKEMTHEO || '';

                    const extractMatches = (icdStr, nameStr, isPrimary) => {
                        const matches = icdStr.toUpperCase().match(/\b[A-Z]\d{2,3}(?:\.\d{1,2})?\b/g);
                        if (matches) {
                            const names = nameStr.split(/;-?/).map(s => s.trim()).filter(s => s);
                            matches.forEach((code, idx) => {
                                if (!allDiagnoses.some(d => d.code === code)) {
                                    allDiagnoses.push({
                                        code: code,
                                        name: names[idx] || names[0] || nameStr,
                                        is_primary: isPrimary && allDiagnoses.length === 0
                                    });
                                }
                            });
                        }
                    };

                    extractMatches(rawIcd, rawName, true);
                    extractMatches(rawIcdSub, rawNameSub, false);
                });

                sendResult('FETCH_DIAGNOSES_RESULT', rowId || null, { diagnoses: allDiagnoses, _context }, requestId);
            } else {
                sendResult('FETCH_DIAGNOSES_RESULT', rowId || null, { diagnoses: [], _context }, requestId);
            }
        } catch (_e) {
            sendResult('FETCH_DIAGNOSES_RESULT', rowId || null, { diagnoses: [], _context: null }, requestId);
        }
    }

    /**
     * Pre-fetch chẩn đoán từ tờ điều trị cho BN đang chọn trong grid.
     * Được gọi từ CDS module khi chọn BN hoặc khi mở tab.
     */
    async function prefetchDiagnosesFromGrid(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('PREFETCH_DIAGNOSES_RESULT', null, { diagnoses: [], patientId: '', khambenhId: '', _context: null }, requestId);
                return;
            }
            const { grid, rowData, effectiveRowId } = resolveActiveGrid(rowId);
            if (!grid || !effectiveRowId) {
                sendResult('PREFETCH_DIAGNOSES_RESULT', null, { diagnoses: [], patientId: '', khambenhId: '', _context: null }, requestId);
                return;
            }
            const benhnhanId = rowData.BENHNHANID || '';
            const patientName = rowData.TENBENHNHAN || rowData.HOTEN || '';

            const _context = {
                rowId,
                KHAMBENHID: rowData.KHAMBENHID || rowData.MADIEUTRI || '',
                HOSOBENHANID: rowData.HOSOBENHANID || rowData.HSBAID || '',
                BENHNHANID: benhnhanId,
                patientName: patientName
            };

            let candidates = [
                rowData.HOSOBENHANID,
                rowData.TIEPNHANID,
                rowData.KHAMBENHID,
                rowData.MADIEUTRI
            ].filter(v => v && v.trim() !== '');

            candidates = Array.from(new Set(candidates));

            if (!benhnhanId || candidates.length === 0) {
                sendResult('PREFETCH_DIAGNOSES_RESULT', null, { diagnoses: [], patientId: benhnhanId, khambenhId: '', _context }, requestId);
                return;
            }

            for (let testId of candidates) {
                const options = [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '4' },
                    { name: '[3]', value: String(testId) }
                ];

                const rows = await _fetchHisPagingRows('NT.024.DSPHIEU', options, 500, 'sidx=NGAYMAUBENHPHAM&sord=desc');

                if (rows && rows.length > 0) {
                    let allDiagnoses = [];
                    let detailIds = [];

                    rows.forEach(item => {
                        const rawIcd = item.MAICD || item.ICD || item.MA_ICD || '';
                        const rawIcdSub = item.MAICD_KEMTHEO || item.MABENHKEMTHEO || item.ICD_KEMTHEO || item.MA_ICDKEMTHEO || '';
                        const combinedIcd = (rawIcd + ',' + rawIcdSub).toUpperCase();

                        const diagnosisText = item.CHANDOAN || item.CHUANDOAN || item.BENHCHINH || '';
                        const subDiagnosisText = item.BENHKEMTHEO || item.CHANDOANKEMTHEO || item.PHU || '';
                        const combinedText = [diagnosisText, subDiagnosisText].filter(Boolean).join('; ');

                        const matches = combinedIcd.match(/\b[A-Z]\d{2,3}(?:\.\d{1,2})?\b/g);
                        if (matches) {
                            matches.forEach((code, idx) => {
                                const exists = allDiagnoses.some(d => d.code.startsWith(code));
                                if (!exists) {
                                    let displayCode = code;
                                    if (idx === 0 && diagnosisText) {
                                        displayCode = code + ' - ' + diagnosisText;
                                    } else if (idx > 0 && subDiagnosisText) {
                                        displayCode = code + ' - ' + subDiagnosisText;
                                    } else if (combinedText) {
                                        displayCode = code + ' - ' + combinedText;
                                    }
                                    allDiagnoses.push({ code: displayCode, is_primary: allDiagnoses.length === 0 });
                                }
                            });
                        } else if (combinedText) {
                            if (!allDiagnoses.some(d => d.code === combinedText)) {
                                allDiagnoses.push({ code: combinedText, is_primary: allDiagnoses.length === 0 });
                            }
                        }

                        // Thu thập ID tờ điều trị cho Mode 2
                        if (item.MADIEUTRI) detailIds.push(item.MADIEUTRI);
                        if (item.PHIEUDIEUTRIID) detailIds.push(item.PHIEUDIEUTRIID);
                        if (item.MAUBENHPHAMID) detailIds.push(item.MAUBENHPHAMID);
                        if (item.ID_PHIEU_DIEU_TRI) detailIds.push(item.ID_PHIEU_DIEU_TRI);
                    });

                    if (allDiagnoses.length > 0) {
                        debugLog('[API-Bridge] Mode 1: Prefetched', allDiagnoses.length, 'ICD codes:', allDiagnoses);
                        const leafContext = { ..._context };
                        sendResult('PREFETCH_DIAGNOSES_RESULT', null, {
                            diagnoses: allDiagnoses,
                            patientId: benhnhanId,
                            khambenhId: _context.KHAMBENHID,
                            patientName: patientName,
                            _context: leafContext
                        }, requestId);
                        return;
                    } else if (detailIds.length > 0) {
                        // Mode 2: Gọi NT.024.2.DETAIL cho các tờ điều trị vừa tìm được
                        detailIds = [...new Set(detailIds)].slice(0, 5); // Lấy tối đa 5 tờ gần nhất tránh đơ UI
                        debugLog('[API-Bridge] Mode 1 empty, switching to Mode 2 (NT.024.2.DETAIL) for sheet IDs:', detailIds);

                        for (let dId of detailIds) {
                            try {
                                const resObj = await _asyncCallSpO('NT.024.2.DETAIL', String(dId), 0);
                                debugLog('[API-Bridge] Raw Mode 2 response for ID', dId, ':', resObj);

                                let records = [];
                                if (typeof resObj === 'string' && resObj.trim() !== '') records = JSON.parse(resObj);
                                else if (typeof resObj === 'object' && resObj !== null) records = resObj;

                                // Handle nested rows array if exists
                                if (records && records.rows && Array.isArray(records.rows)) {
                                    records = records.rows;
                                } else if (!Array.isArray(records)) {
                                    records = [records];
                                }

                                var icdPatternExact = /^[A-Z]\d{2}(\.\d{1,2})?$/i;
                                var icdPatternContains = /(^|\s|\(|\[|-)[A-Z]\d{2}(\.\d{1,2})?($|\s|\)|\]|-)/i;
                                var potentialTexts = [];

                                for (var ri = 0; ri < records.length; ri++) {
                                    var rec = records[ri];
                                    if (!rec) continue;
                                    for (var rk in rec) {
                                        var ruk = rk.toUpperCase();
                                        var rv = String(rec[rk] || '').trim();
                                        if (rv.length < 2) continue;
                                        if (ruk.includes('HINHANH') || ruk.includes('QUANGTUYEN') || ruk.includes('YEUCAU') || ruk.includes('CDHA') || ruk.includes('DICHVU') || ruk.includes('PHONGKHAM') || ruk === 'TEN') continue;
                                        potentialTexts.push(rv);
                                    }
                                }

                                for (var i = 0; i < potentialTexts.length; i++) {
                                    var curText = potentialTexts[i];
                                    if (curText.length <= 6 && icdPatternExact.test(curText) && !curText.toUpperCase().startsWith('NK')) {
                                        var desc = '';
                                        for (var j = i - 1; j >= Math.max(0, i - 5); j--) {
                                            var t = potentialTexts[j];
                                            if (t.length > 5 && /[A-Za-zĐđÂâĂăÊêÔôƠơƯư]/i.test(t) && !icdPatternExact.test(t)) { desc = t; break; }
                                        }
                                        if (!desc) {
                                            for (j = i + 1; j <= Math.min(potentialTexts.length - 1, i + 5); j++) {
                                                t = potentialTexts[j];
                                                if (t.length > 5 && /[A-Za-zĐđÂâĂăÊêÔôƠơƯư]/i.test(t) && !icdPatternExact.test(t)) { desc = t; break; }
                                            }
                                        }

                                        // Strip prefixes to match user request "bỏ từ chẩn đoán kèm theo phía trước đi"
                                        if (desc) {
                                            desc = desc.replace(/^(chẩn đoán kèm theo|bệnh kèm theo|chẩn đoán|bệnh chính|kèm theo)[:\-\s]*/i, '').trim();
                                        }

                                        var codeStr = desc ? curText + ' - ' + desc : curText;
                                        if (!allDiagnoses.some(d => d.code === codeStr || d.code.startsWith(curText + ' -'))) {
                                            allDiagnoses.push({ code: codeStr, is_primary: allDiagnoses.length === 0 });
                                        }
                                    } else if (curText.length > 6 && icdPatternContains.test(curText)) {
                                        var cleanedRv = curText.replace(/^(chẩn đoán kèm theo|bệnh kèm theo|chẩn đoán|bệnh chính|kèm theo)[:\-\s]*/i, '').trim();
                                        if (!allDiagnoses.some(d => d.code === cleanedRv)) {
                                            allDiagnoses.push({ code: cleanedRv, is_primary: allDiagnoses.length === 0 });
                                        }
                                    }
                                }
                            } catch (err) {
                                console.warn('[API-Bridge] Mode 2 parsing error:', err.message || 'Unknown error');
                            }
                        }

                        if (allDiagnoses.length > 0) {
                            debugLog('[API-Bridge] Mode 2: Prefetched', allDiagnoses.length, 'ICD codes:', allDiagnoses);
                            const leafContext = { ..._context };
                            sendResult('PREFETCH_DIAGNOSES_RESULT', null, {
                                diagnoses: allDiagnoses,
                                patientId: benhnhanId,
                                khambenhId: _context.KHAMBENHID,
                                patientName: patientName,
                                _context: leafContext
                            }, requestId);
                            return;
                        }
                    }
                }
            }

            debugLog('[API-Bridge] All candidates & modes failed for prefetch diagnoses');
            sendResult('PREFETCH_DIAGNOSES_RESULT', null, { diagnoses: [], patientId: benhnhanId, khambenhId: '', _context }, requestId);

        } catch (_e) {
            sendResult('PREFETCH_DIAGNOSES_RESULT', null, { diagnoses: [], patientId: '', khambenhId: '', _context: null }, requestId);
        }
    }

    async function fetchDrugs(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_DRUGS_RESULT', rowId, { drugList: [], _context: null }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId);
            const _context = {
                rowId,
                KHAMBENHID: rowData.KHAMBENHID || rowData.MADIEUTRI || '',
                HOSOBENHANID: rowData.HOSOBENHANID || rowData.HSBAID || '',
                BENHNHANID: rowData.BENHNHANID || '',
                patientName: rowData.TENBENHNHAN || rowData.HOTEN || ''
            };

            let candidates = [
                rowData.KHAMBENHID,
                rowData.MADIEUTRI,
                rowData.HOSOBENHANID,
                rowData.TIEPNHANID
            ].filter(v => v && String(v).trim() !== '');

            candidates = Array.from(new Set(candidates));
            const benhnhanId = rowData.BENHNHANID || '';

            let foundRows = false;
            for (let testId of candidates) {
                const options = [
                    { name: '[0]', value: String(testId) }, // e.g. KHAMBENHID
                    { name: '[1]', value: String(benhnhanId) }, // BENHNHANID
                    { name: '[2]', value: '365;' }, // bao phủ toàn đợt nằm viện
                    { name: '[3]', value: String(rowData.HOSOBENHANID || rowData.TIEPNHANID || testId) }
                ];

                const rows = await _fetchHisPagingRows('NT.024.DSTHUOCVT', options, 100, 'sidx=&sord=desc');

                if (rows && rows.length > 0) {
                    foundRows = true;
                    const drugs = rows.map(r => ({
                        NGAYMAUBENHPHAM_SUDUNG: r.NGAYMAUBENHPHAM_SUDUNG || r.NGAYSD || r.NGAYSUDUNG || '',
                        TENTHUOC: r.TENDICHVU || r.TENTHUOC || '',
                        MAUBENHPHAMID: r.MAUBENHPHAMID || '',
                        LIEUDUNG: r.LIEUDUNG || r.LIEU || '',
                        DONVITINH: r.DONVITINH || r.DONVI || '',
                        DUONGDUNG: r.DUONGDUNG || r.TENDUONGDUNG || '',
                        CACHDUNG: r.CACHDUNG || r.SOLO_CACHDUNG || r.SUDUNG || '',
                        SOLUONG: r.SOLUONG || r.SOLUONG_SUDUNG || '',
                        HOATCHAT: r.HOATCHAT || r.TENHOATCHAT || r.HOAT_CHAT || r.TEN_HOATCHAT || r.TENHC || r.TEN_HC || r.TENKHOAHOC || '',
                        HAMLUONG: r.HAMLUONG || r.NONGDO || r.HAM_LUONG || r.NONG_DO || r.NDHL || ''
                    }));
                    sendResult('FETCH_DRUGS_RESULT', rowId, { drugList: drugs, _context }, requestId);
                    break;
                }
            }

            if (!foundRows) {
                sendResult('FETCH_DRUGS_RESULT', rowId, { drugList: [], _context }, requestId);
            }
        } catch (_e) {
            sendResult('FETCH_DRUGS_RESULT', rowId, { drugList: [], _context: null }, requestId);
        }
    }

    // Fetch thuốc toàn đợt điều trị (dùng HOSOBENHANID) — cho modal CLS + Thuốc
    // 2-step: 1) Lấy danh sách phiếu thuốc (NT.024.DSTHUOCVT)
    //         2) Lấy chi tiết từng phiếu (NT.024.2) — trả về tên thuốc, liều, đường dùng
    async function fetchDrugsForCLS(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: [], _context: null }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId);
            const _context = {
                rowId,
                KHAMBENHID: rowData.KHAMBENHID || rowData.MADIEUTRI || '',
                HOSOBENHANID: rowData.HOSOBENHANID || rowData.HSBAID || '',
                BENHNHANID: rowData.BENHNHANID || '',
                patientName: rowData.TENBENHNHAN || rowData.HOTEN || ''
            };
            const uuid = _jsonrpc?.AjaxJson?.uuid;
            if (!uuid) {
                sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: [], _context }, requestId);
                return;
            }

            const benhnhanId = rowData.BENHNHANID || '';
            const hsbaId = rowData.HOSOBENHANID || rowData.HSBAID || '';
            const baseUrl = '/vnpthis/RestService';

            // Dynamic dayFilter calculation to capture entire hospital stay
            let dayFilter = 99;
            try {
                const ngayVaoVien = rowData.THOIGIANVAOVIEN || rowData.NGAYVAOKHOA || rowData.NGAYTIEPNHAN || '';
                if (ngayVaoVien) {
                    const datePart = ngayVaoVien.split(' ')[0];
                    const parts = datePart.split('/');
                    if (parts.length === 3) {
                        const admissionDate = new Date(`${parts[2]}-${parts[1]}-${parts[0]}`);
                        const diffTime = Math.abs(new Date() - admissionDate);
                        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                        
                        // VNPT HIS server có bug ngầm ở nhánh SQL khi dayFilter='7;' (hoặc các mốc chuẩn 15, 30)
                        // Bệnh nhân có SNĐT=6 -> diffDays=5 -> dayFilter=7 -> BỊ LỖI TRẢ VỀ 0 RECORD!
                        // Fix: Cộng hẳn 99 ngày để lệch khỏi các mốc chuẩn, ép HIS dùng nhánh SQL dynamic fallback.
                        dayFilter = (diffDays > 0 && !isNaN(diffDays)) ? diffDays + 99 : 99;
                    }
                }
            } catch (e) { console.warn('[Aladinn Drug] Error calculating dayFilter:', e); }

            // --- Step 1: Pre-fetch to discover all KHAMBENHID/MADIEUTRI across transfers ---
            // We use NT.024.DSPHIEU type 4 (Treatment sheets) which spans the whole HSBA
            let crossDeptCandidates = [];
            if (hsbaId) {
                try {
                    const discoverParams = {
                        func: 'ajaxExecuteQueryPaging', uuid: uuid,
                        params: ['NT.024.DSPHIEU'],
                        options: [
                            { name: '[0]', value: '' },
                            { name: '[1]', value: String(benhnhanId) },
                            { name: '[2]', value: '' }, // Rỗng để lấy TẤT CẢ các loại phiếu, từ đó móc ra KHAMBENHID của tất cả các khoa
                            { name: '[3]', value: String(hsbaId) }
                        ]
                    };
                    const discoverUrl = `${baseUrl}?_search=false&rows=500&page=1&postData=${encodeURIComponent(JSON.stringify(discoverParams))}`;
                    const dRes = await fetch(discoverUrl, { credentials: 'include' });
                    if (dRes.ok) {
                        const dData = await dRes.json();
                        const dRows = dData.rows || [];
                        for (const r of dRows) {
                            if (r.KHAMBENHID) crossDeptCandidates.push(String(r.KHAMBENHID));
                            if (r.MADIEUTRI) crossDeptCandidates.push(String(r.MADIEUTRI));
                        }
                    }
                } catch (_e) { /* ignore */ }
            }

            // Ưu tiên KHAMBENHID trước vì API thường cần field này ở param [0]
            let candidates = [
                rowData.KHAMBENHID,
                rowData.MADIEUTRI,
                ...crossDeptCandidates,
                hsbaId,
                rowData.TIEPNHANID,
                '' // Thử case [0] rỗng để HIS tự resolve qua [3]=hsbaId
            ].filter(v => v !== undefined && v !== null);
            candidates = Array.from(new Set(candidates));
            debugLog(`[Aladinn Drug] Discovered ${candidates.length} candidate keys for fetching drug sheets:`, candidates);

            // --- Step 2: Fetch list of drug sheets — gộp TẤT CẢ candidates (nhiều khoa) ---
            let sheets = [];
            const seenSheetIds = new Set();
            for (const testId of candidates) {
                try {
                    const params = {
                        func: 'ajaxExecuteQueryPaging',
                        uuid: uuid,
                        params: ['NT.024.DSTHUOCVT'],
                        options: [
                            { name: '[0]', value: String(testId) },
                            { name: '[1]', value: String(benhnhanId) },
                            { name: '[2]', value: String(dayFilter) + ';' }, // dynamic day filter
                            { name: '[3]', value: String(hsbaId || testId) }
                        ]
                    };
                    const url = `${baseUrl}?_search=false&rows=1000&page=1&sidx=&sord=desc&postData=${encodeURIComponent(JSON.stringify(params))}`;
                    const res = await fetch(url, { credentials: 'include' });
                    if (res.ok) {
                        const data = await res.json();
                        const rows = data.rows || [];
                        if (rows.length > 0) {
                            debugLog(`[Aladinn Drug] Step 1: Found ${rows.length} drug sheets via candidate ${testId} (dayFilter: ${dayFilter})`);
                            for (const row of rows) {
                                const sid = String(row.MAUBENHPHAMID || row.IDPHIEU || '');
                                if (sid && !seenSheetIds.has(sid)) {
                                    seenSheetIds.add(sid);
                                    sheets.push(row);
                                }
                            }
                        }
                    }
                } catch (_e) { /* try next candidate */ }
            }
            // Strategy 2: NT.024.DSPHIEU with type=3 (drug sheets)
            if (hsbaId) {
                try {
                    const p2 = {
                        func: 'ajaxExecuteQueryPaging', uuid: uuid,
                        params: ['NT.024.DSPHIEU'],
                        options: [
                            { name: '[0]', value: '' },
                            { name: '[1]', value: String(benhnhanId) },
                            { name: '[2]', value: '' }, // Rỗng để lấy TẤT CẢ các loại phiếu thay vì chỉ phiếu loại 3
                            { name: '[3]', value: String(hsbaId) }
                        ]
                    };
                    const url2 = `${baseUrl}?_search=false&rows=1000&page=1&sidx=&sord=desc&postData=${encodeURIComponent(JSON.stringify(p2))}`;
                    const res2 = await fetch(url2, { credentials: 'include' });
                    if (res2.ok) {
                        const data2 = await res2.json();
                        const rows2 = data2.rows || [];
                        if (rows2.length > 0) {
                            debugLog(`[Aladinn Drug] Strategy 2 (NT.024.DSPHIEU type=''): Found ${rows2.length} sheets`);
                            for (const row of rows2) {
                                const sid = String(row.MAUBENHPHAMID || row.IDPHIEU || '');
                                if (sid && !seenSheetIds.has(sid)) {
                                    seenSheetIds.add(sid);
                                    sheets.push(row);
                                }
                            }
                        }
                    }
                } catch (_e) { /* silent */ }
            }

            debugLog(`[Aladinn Drug] Step 1 total: ${sheets.length} unique sheets from ${candidates.length} candidates`);
            if (sheets.length > 0) {
                const dates = sheets.map(s => s.NGAYMAUBENHPHAM_SUDUNG || s.NGAYSD || s.NGAYSUDUNG || s.NGAYMAUBENHPHAM || '').filter(Boolean);
                debugLog('[Aladinn Drug] Sheet dates:', dates);
            }

            if (sheets.length === 0) {
                sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: [], _context }, requestId);
                return;
            }

            // --- Step 2: Fetch drug details for each sheet ---
            // --- Step 2: Fetch drug details for each sheet ---
            // Với mỗi phiếu, quét API Vật tư và API Thuốc SONG SONG.
            // Tuy nhiên, với Thuốc, ta thử tuần tự các API phổ biến để tránh trùng lặp dữ liệu (nếu 2 API cùng trả về).
            // Các API NT.024.DSVTTHUOC, NT.024.3, NT.024.4 được thêm vào cuối để bắt các "Phiếu Nhận", "Tủ trực".
            const DRUG_QUERIES = [
                'NT.024.CTPHIEUTHUOC', 
                'NT.024.DSTHUOC', 
                'NT.024.CHITIETTHUOC', 
                'NT.024.DSVTTHUOC',
                'NT.024.3', 
                'NT.024.4'
            ];
            const MATERIAL_QUERY = 'NT.034.1';

            let allDrugs = [];
            const detailPromises = sheets.map(async (sheet) => {
                const sheetId = sheet.MAUBENHPHAMID || sheet.IDPHIEU;
                const sheetDate = sheet.NGAYMAUBENHPHAM_SUDUNG || sheet.NGAYSD || sheet.NGAYSUDUNG || sheet.NGAYMAUBENHPHAM || '';
                if (!sheetId) return;

                const fetchQuery = async (qCode) => {
                    try {
                        const detailUrl = `${baseUrl}?_search=false&rows=500&page=1&postData=${encodeURIComponent(JSON.stringify({
                            func: 'ajaxExecuteQueryPaging', uuid: uuid, params: [qCode], options: [{ name: '[0]', value: String(sheetId) }]
                        }))}`;
                        const res = await fetch(detailUrl, { credentials: 'include' });
                        if (res.ok) {
                            const data = await res.json();
                            return data.rows || [];
                        }
                    } catch (_e) {}
                    return [];
                };

                const fetchMaterials = fetchQuery(MATERIAL_QUERY);
                const fetchDrugs = async () => {
                    for (const q of DRUG_QUERIES) {
                        const rows = await fetchQuery(q);
                        if (rows.length > 0) return rows; // Stop at the first API that returns data!
                    }
                    return [];
                };

                try {
                    const [materialRows, drugRows] = await Promise.all([fetchMaterials, fetchDrugs()]);
                    const items = [...materialRows, ...drugRows];
                    
                    for (const item of items) {
                        // Dynamic name resolution — try all possible keys
                            const name = item.TEN || item.TENTHUOC || item.TENDICHVU ||
                                item.TENCHISO || item.TENCHIDINH || item.TENTONGHOP ||
                                item.TEN_THUOC || item.TENDICHVU_CHA ||
                                item.TENVATTU || item.TEN_DICHVU_KYTHUAT || '';
                            if (!name) continue;

                            // Lọc các dịch vụ/khám không phải là thuốc thực sự
                            const lowerName = name.toLowerCase();
                            const donvitinh = (item.DONVITINH || item.DONVI || item.DVT || '').toLowerCase();
                            const lieudung = item.LIEUDUNG || item.LIEU || '';
                            const duongdung = item.DUONGDUNG || item.TENDUONGDUNG || '';
                            
                            // Bỏ qua nếu là dịch vụ khám bệnh, giường bệnh, công khám
                            if (donvitinh.includes('lần') || lowerName.startsWith('khám') || lowerName.includes('giường') || lowerName.includes('công khám')) {
                                continue;
                            }

                            // Bỏ qua vật tư y tế (VTYT)
                            const isVTYT = ['kim tiêm', 'kim luồn', 'kim bướm', 'kim lấy máu', 'bơm tiêm', 'dây truyền', 'bộ dây', 'catheter', 'băng keo', 'băng dính', 'băng thun', 'băng cá nhân', 'gạc', 'bông', 'găng tay', 'chỉ khâu', 'chỉ phẫu thuật', 'chỉ vicryl', 'chỉ catgut', 'chỉ silk', 'chỉ prolen', 'lưỡi dao', 'ống silicon', 'canuyn', 'sonde', 'xong dạ dày', 'túi nước tiểu', 'điện cực', 'ống nghiệm', 'urgotul', 'urgo', 'tegaderm', 'opsite', 'bistouri', 'nẹp', 'băng thạch cao', 'gel siêu âm', 'bơm cho ăn', 'mặt nạ', 'mask thở', 'dây oxy', 'dây thở', 'ống nội khí quản', 'băng vết thương', 'miếng đắp', 'miếng dán vết thương', 'test nhanh', 'que thử', 'kim châm cứu', 'băng bột', 'oxy lỏng', 'khí oxy', 'oxy thở'].some(v => lowerName.includes(v));
                            if (isVTYT) continue;
                            
                            // TẠM THỜI TẮT BỘ LỌC NGHIÊM NGẶT NÀY ĐỂ KHÔNG BỎ SÓT THUỐC
                            // const isDrugUnit = ['viên', 'lọ', 'ống', 'chai', 'bơm', 'típ', 'tuýp', 'gói', 'ml', 'vỉ', 'vi', 'túi'].some(u => donvitinh.includes(u));
                            // if (!lieudung && !duongdung && !isDrugUnit) {
                            //     continue;
                            // }

                            // Universal scan: tìm field liên quan đến kháng sinh
                            let solanKS = '';
                            let laKhangSinh = '';
                            for (const k in item) {
                                const uk = k.toUpperCase();
                                const val = item[k];
                                if (val === null || val === undefined || String(val).trim() === '') continue;
                                if (uk.includes('SOLAN') && uk.includes('KHANGSINH') || uk === 'SOLAN_SD_KHANGSINH' || uk === 'SOLANSDKHANGSINH' || uk === 'SO_LAN_SD_KHANG_SINH' || uk === 'SONGAYSDKS') {
                                    solanKS = String(val).trim();
                                }
                                if (uk === 'LAKHANGSINH' || uk === 'LA_KHANG_SINH' || uk === 'ISKHANGSINH' || uk === 'IS_KHANG_SINH' || uk === 'KHANGSINH' || uk === 'LOAIKHANGSINH') {
                                    laKhangSinh = String(val).trim();
                                }
                            }

                            allDrugs.push({
                                NGAYMAUBENHPHAM_SUDUNG: sheetDate,
                                TENTHUOC: name,
                                MAUBENHPHAMID: String(sheetId),
                                LIEUDUNG: lieudung,
                                DONVITINH: item.DONVITINH || item.DONVI || item.DVT || '',
                                DUONGDUNG: duongdung,
                                CACHDUNG: item.CACHDUNG || item.SOLO_CACHDUNG || item.SUDUNG || '',
                                SOLUONG: item.SOLUONG || item.SOLUONG_SUDUNG || '',
                                HOATCHAT: item.HOATCHAT || item.TENHOATCHAT || item.HOAT_CHAT || item.TEN_HOATCHAT || item.TENHC || item.TEN_HC || item.TENKHOAHOC || '',
                                HAMLUONG: item.HAMLUONG || item.NONGDO || item.HAM_LUONG || item.NONG_DO || item.NDHL || '',
                                SOLAN_SD_KHANGSINH: solanKS,
                                LAKHANGSINH: laKhangSinh
                            });
                        }
                } catch (_e) { /* skip failed sheet */ }
            });

            await Promise.all(detailPromises);

            // Deduplicate drugs to prevent multiple queries from duplicating the same drug
            const uniqueDrugs = [];
            const seenDrugKeys = new Set();
            for (const d of allDrugs) {
                const key = `${d.TENTHUOC}_${d.NGAYMAUBENHPHAM_SUDUNG}_${d.SOLUONG}`;
                if (!seenDrugKeys.has(key)) {
                    seenDrugKeys.add(key);
                    uniqueDrugs.push(d);
                }
            }
            allDrugs = uniqueDrugs;

            debugLog(`[Aladinn Drug] Step 2: Processed ${sheets.length} sheets`);
            sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: allDrugs, _context }, requestId);

        } catch (_e) {
            console.error('[Aladinn Drug] Error:', _e);
            sendResult('FETCH_DRUGS_CLS_RESULT', rowId, { drugList: [], _context: null }, requestId);
        }
    }

    /**
     * Trích xuất dữ liệu lâm sàng thời gian thực từ DOM Tờ điều trị Nội trú đang mở (NTU02D021_BuongDieuTri)
     * Ưu tiên dữ liệu trực quan bác sĩ đang nhập chưa bấm Lưu.
     */
    function scrapeTreatmentSheetFromDOM() {
        var marker = _findDomElement('tcDieuTritxtDIENBIENBENH');
        if (!marker) return null;

        var _val = function(id) {
            var el = _findDomElement(id);
            return el ? (el.value || el.textContent || '').trim() : '';
        };

        // Lấy Y lệnh thô từ CKEditor một cách an toàn thông qua tìm kiếm đệ quy
        var yLenhRaw = '';
        try {
            function findCKEditor() {
                function searchWin(w) {
                    try {
                        if (w.CKEDITOR && w.CKEDITOR.instances && w.CKEDITOR.instances.tcDieuTritxtYLENH) {
                            return w.CKEDITOR.instances.tcDieuTritxtYLENH;
                        }
                        var frames = w.frames;
                        for (var i = 0; i < frames.length; i++) {
                            var found = searchWin(frames[i]);
                            if (found) return found;
                        }
                    } catch (_e) {}
                    return null;
                }
                return searchWin(window);
            }

            var ck = findCKEditor();
            if (ck) {
                yLenhRaw = ck.getData() || '';
            } else {
                var el = _findDomElement('tcDieuTritxtYLENH');
                yLenhRaw = el ? (el.value || el.textContent || el.innerHTML || '') : '';
            }
        } catch (e) {
            console.warn('[API-Bridge] Error reading CKEditor tcDieuTritxtYLENH:', e);
        }

        // Làm sạch mã HTML sang dạng văn bản thô để phân tích Regex
        var decodedYLenh = _decodeHtmlEntities(yLenhRaw);
        var textYLenh = decodedYLenh.replace(/<[^>]+>/g, '\n').replace(/&nbsp;/g, ' ').trim();
        var diet = '';
        var care = '';

        // Tách Chế độ ăn: "Chế độ ăn: BT02..." hoặc "Chế độ ăn : BT02"
        var dietMatch = textYLenh.match(/Chế độ ăn\s*[:\-–]\s*([^\n]+)/i);
        if (dietMatch) diet = dietMatch[1].trim();

        // Tách Chế độ chăm sóc: "Chế độ chăm sóc: cấp III"
        var careMatch = textYLenh.match(/Chế độ chăm sóc\s*[:\-–]\s*([^\n]+)/i);
        if (careMatch) care = careMatch[1].trim();

        // Lọc sạch Y lệnh khác thực sự, bỏ đi dòng Chế độ ăn và Chế độ chăm sóc
        var lines = textYLenh.split('\n');
        var filteredLines = [];
        for (var i = 0; i < lines.length; i++) {
            var line = lines[i].trim();
            if (!line) continue;
            if (line.match(/^(?:Chế độ ăn|Chế độ chăm sóc)\s*[:\-–]/i)) continue;
            if (line.match(/^\*?Y lệnh khác\s*[:\-–]?$/i)) continue;
            filteredLines.push(lines[i]);
        }
        var cleanYLenh = filteredLines.join('\n').trim();

        // Chẩn đoán chính và kèm theo từ DOM
        var chanDoanChinh = _val('tcDieuTritxtCHUANDOAN');
        var chanDoanKemTheo = _val('tcDieuTritxtBENHKEMTHEO');

        var chanDoanMoiNhat = chanDoanChinh;
        if (chanDoanKemTheo) {
            if (chanDoanMoiNhat) {
                chanDoanMoiNhat += '; ' + chanDoanKemTheo;
            } else {
                chanDoanMoiNhat = chanDoanKemTheo;
            }
        }

        // Lấy huyết áp từ 2 ô nhập liệu của HIS
        var ha1 = _val('tcDieuTritxtHUYETAP1');
        var ha2 = _val('tcDieuTritxtHUYETAP2');
        var huyetAp = '';
        if (ha1 || ha2) {
            huyetAp = (ha1 || '?') + '/' + (ha2 || '?');
        }

        return {
            dienBienBenh: _val('tcDieuTritxtDIENBIENBENH'),
            khamToanThanTDT: _val('tcDieuTritxtTOANTHAN'),
            khamBoPhan: _val('tcDieuTritxtKHAMBOPHAN'),
            ketQuaCLS: _val('tcDieuTritxtKETQUACLS'),
            huongXuLy: _val('tcDieuTritxtXULY'),
            chanDoanMoiNhat: chanDoanMoiNhat,
            chanDoanChinh: chanDoanChinh,
            chanDoanKemTheo: chanDoanKemTheo,
            yLenh: cleanYLenh || textYLenh,
            diet: diet,
            care: care,
            sinhHieu: {
                pulse: _val('tcDieuTritxtMACH'),
                temperature: _val('tcDieuTritxtNHIETDO'),
                bloodPressure: huyetAp,
                respiratoryRate: _val('tcDieuTritxtNHIPTHO'),
                weight: _val('tcDieuTritxtCANNANG'),
                height: _val('tcDieuTritxtCHIEUCAO'),
                spo2: _val('tcDieuTritxtSPO2')
            }
        };
    }

    /**
     * Fetch gộp bệnh sử (HSBA) + diễn tiến (tờ điều trị mới nhất) + sinh hiệu.
     * Dùng cho module ClinicalFill (Hội chẩn / Chuyển viện).
     * 
     * Hỗ trợ cả Nội trú (#grdBenhNhan) và Ngoại trú (#grdDSBenhNhan).
     * Ngoại trú không có tờ điều trị → đọc data từ DOM tab "Bệnh án".
     */
    async function fetchClinicalSummary(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_CLINICAL_SUMMARY_RESULT', rowId, { _context: null }, requestId);
                return;
            }

            // Resolve grid: tự động chọn Nội trú hoặc Ngoại trú với strict mode
            const { rowData, isOutpatient, effectiveRowId, _context } = resolveActiveGrid(rowId, { strict: true });

            if (!effectiveRowId) {
                console.warn('[API-Bridge] fetchClinicalSummary: Không tìm thấy bệnh nhân đang chọn');
                sendResult('FETCH_CLINICAL_SUMMARY_RESULT', null, { _context: null }, requestId);
                return;
            }

            const contextInfo = await resolveTreatmentContext(rowData, rowId);
            const admissionTimes = await fetchAdmissionTimes(rowData, rowId);
            const hsbaId = contextInfo.HOSOBENHANID || rowData.HOSOBENHANID || rowData.HSBAID || '';
            const benhnhanId = contextInfo.BENHNHANID || rowData.BENHNHANID || '';

            const result = {
                lyDoVaoVien: '',
                quaTrinhBenhLy: '',
                tienSuBanThan: '',
                tienSuGiaDinh: '',
                khamToanThan: '',
                khamBoPhan: '',
                chanDoanBanDau: '',
                chanDoanKemTheo: '',
                chanDoanMoiNhat: '',
                tomTatCLS: '',
                huongXuLy: '',
                dienBienBenh: '',
                khamToanThanTDT: '',  // Khám toàn thân từ tờ điều trị mới nhất
                ngayToDieuTriMoiNhat: '', // Ngày của tờ điều trị mới nhất
                sinhHieu: {},
                treatmentContext: contextInfo,
                admissionTimes,
                _context              // Bổ sung ContextGuard token
            };

            // === PHẦN 1: Bệnh sử từ HSBA API (Nội trú) ===
            if (hsbaId) {
                try {
                    const params = JSON.stringify({ HOSOBENHANID: hsbaId });
                    const hsbaRes = await _asyncCallSpO('NT.006.HSBA.HIS', params, 0);
                    const data = (typeof hsbaRes === 'string' && hsbaRes.trim() !== '') ? JSON.parse(hsbaRes) : hsbaRes;
                    const records = Array.isArray(data) ? data : [data];

                    for (let i = records.length - 1; i >= 0; i--) {
                        const rec = records[i];
                        if (!rec) continue;
                        if (rec.LYDOVAOVIEN && !result.lyDoVaoVien) {
                            result.lyDoVaoVien = _cleanLydoVaoVien(rec.LYDOVAOVIEN);
                        }
                        if (rec.QUATRINHBENHLY && !result.quaTrinhBenhLy) result.quaTrinhBenhLy = rec.QUATRINHBENHLY;
                        if (rec.TIENSUBENH_BANTHAN && !result.tienSuBanThan) result.tienSuBanThan = rec.TIENSUBENH_BANTHAN;
                        if (rec.KHAMBENH_TOANTHAN && !result.khamToanThan) result.khamToanThan = rec.KHAMBENH_TOANTHAN;
                        if (rec.KHAMBENH_BOPHAN && !result.khamBoPhan) result.khamBoPhan = rec.KHAMBENH_BOPHAN;
                        if (rec.TOMTATKQCANLAMSANG && !result.tomTatCLS) result.tomTatCLS = rec.TOMTATKQCANLAMSANG;
                        // Universal scan cho chẩn đoán
                        if (!result.chanDoanBanDau) {
                            for (const k in rec) {
                                const uk = k.toUpperCase();
                                if ((uk.includes('CHANDOAN') || uk.includes('CHAN_DOAN')) && rec[k] && String(rec[k]).trim().length > 1) {
                                    if (uk.includes('KEMTHEO') || uk.includes('PHU') || uk.includes('_KT')) {
                                        if (!result.chanDoanKemTheo) result.chanDoanKemTheo = String(rec[k]).trim();
                                    } else {
                                        result.chanDoanBanDau = String(rec[k]).trim();
                                    }
                                }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[API-Bridge] fetchClinicalSummary HSBA error:', e);
                }
            }

            // === PHẦN 1B: Fallback DOM — Đọc từ tab "Bệnh án" (Ngoại trú) ===
            // Nếu API trả rỗng hoặc đây là module ngoại trú, lấy từ các field trên trang
            var hasApiData = !!(result.lyDoVaoVien || result.quaTrinhBenhLy || result.khamToanThan);
            if (!hasApiData) {
                try {
                    var _domVal = function (id) {
                        var el = _findDomElement(id);
                        if (!el) return '';
                        return (el.value || el.textContent || '').trim();
                    };
                    // Đọc từ các field tabBenhAntxt* trong tab "Bệnh án"
                    if (!result.lyDoVaoVien) {
                        result.lyDoVaoVien = _cleanLydoVaoVien(_domVal('tabBenhAntxtLYDOVAOVIEN'));
                    }
                    if (!result.quaTrinhBenhLy) result.quaTrinhBenhLy = _domVal('tabBenhAntxtQUATRINHBENHLY');
                    if (!result.tienSuBanThan) result.tienSuBanThan = _domVal('tabBenhAntxtTIENSUBENH_BANTHAN');
                    if (!result.tienSuGiaDinh) result.tienSuGiaDinh = _domVal('tabBenhAntxtTIENSUBENH_GIADINH');
                    if (!result.khamToanThan) result.khamToanThan = _domVal('tabBenhAntxtKHAMBENH_TOANTHAN');
                    if (!result.khamBoPhan) result.khamBoPhan = _domVal('tabBenhAntxtKHAMBENH_BOPHAN');
                    if (!result.tomTatCLS) result.tomTatCLS = _domVal('tabBenhAntxtTOMTATKQCANLAMSANG');
                    if (!result.huongXuLy) result.huongXuLy = _domVal('tabBenhAntxtHUONGXULY');

                    // Chẩn đoán từ DOM
                    if (!result.chanDoanBanDau) {
                        result.chanDoanBanDau = _domVal('tabBenhAntxtCHANDOANBANDAU');
                    }
                    if (!result.chanDoanBanDau) {
                        // Fallback: bệnh chính
                        var maBenhChinh = _domVal('tabBenhAntxtMABENHCHINH');
                        var tenBenhChinh = _domVal('tabBenhAntxtBENHCHINH');
                        if (tenBenhChinh) {
                            result.chanDoanBanDau = maBenhChinh ? maBenhChinh + '-' + tenBenhChinh : tenBenhChinh;
                        }
                    }
                    if (!result.chanDoanKemTheo) {
                        var maKemTheo = _domVal('tabBenhAntxtMABENHKEMTHEO');
                        var tenKemTheo = _domVal('tabBenhAntxtBENHKEMTHEO');
                        if (tenKemTheo) {
                            result.chanDoanKemTheo = maKemTheo ? maKemTheo + '-' + tenKemTheo : tenKemTheo;
                        }
                    }

                    // Fallback chẩn đoán từ #divMsg area (lblMSG_BOSUNG chứa ICD code)
                    if (!result.chanDoanMoiNhat) {
                        var bosung = _domVal('lblMSG_BOSUNG');
                        if (bosung) {
                            // Format: "| 24/04/2026 08:34:57 | K65.0-Viêm phúc mạc cấp"
                            var icdMatch = bosung.match(/([A-Z]\d{2}(?:\.\d+)?)\s*[-–]\s*(.+)/i);
                            if (icdMatch) {
                                result.chanDoanMoiNhat = icdMatch[1] + '-' + icdMatch[2].trim();
                            }
                        }
                    }

                    // Ngoại trú: dùng hidden inputs nếu DOM textarea rỗng
                    if (!result.chanDoanBanDau) {
                        var hidCDC = _domVal('hidMACDC');
                        var cdcLabel = _domVal('txtCDC');
                        if (hidCDC) result.chanDoanBanDau = hidCDC + (cdcLabel ? '-' + cdcLabel : '');
                    }

                    debugLog('[API-Bridge] fetchClinicalSummary: DOM fallback used (outpatient mode)');
                } catch (e) {
                    console.warn('[API-Bridge] fetchClinicalSummary DOM fallback error:', e);
                }
            }

            // === PHẦN 2: Diễn tiến từ tờ điều trị mới nhất (NT.024.DSPHIEU) ===
            // CHỈ chạy cho Nội trú — Ngoại trú không có tờ điều trị
            if (!isOutpatient) {
                try {
                    let candidates = [
                        rowData.HOSOBENHANID, rowData.TIEPNHANID,
                        rowData.KHAMBENHID, rowData.MADIEUTRI,
                        contextInfo.HOSOBENHANID, contextInfo.TIEPNHANID,
                        contextInfo.KHAMBENHID
                    ].filter(v => v !== undefined && v !== null && String(v).trim() !== '');
                    candidates = Array.from(new Set(candidates));

                    let foundTreatment = false;
                    for (const testId of candidates) {
                        if (foundTreatment) break;
                        const options = [
                            { name: '[0]', value: '' },
                            { name: '[1]', value: String(benhnhanId) },
                            { name: '[2]', value: '4' },
                            { name: '[3]', value: String(testId) }
                        ];

                        const rows = await _fetchHisPagingRows('NT.024.DSPHIEU', options, 5, 'sidx=NGAYMAUBENHPHAM&sord=desc');

                        if (rows && rows.length > 0) {
                            // Sort client-side theo ngày giảm dần vì API đôi khi bỏ qua sidx=NGAYMAUBENHPHAM
                            // Format ngày HIS: "DD/MM/YYYY HH:MM:SS"
                            function _parseTDTDate(str) {
                                if (!str) return 0;
                                var p = str.split(/[/\s:]/);
                                if (p.length >= 5) {
                                    return new Date(p[2], parseInt(p[1]) - 1, p[0], p[3], p[4], p[5] || 0).getTime();
                                }
                                return 0;
                            }
                            rows.sort(function(a, b) {
                                return _parseTDTDate(b.NGAYMAUBENHPHAM || b.NGAY_Y_LENH || b.NGAY || '')
                                     - _parseTDTDate(a.NGAYMAUBENHPHAM || a.NGAY_Y_LENH || a.NGAY || '');
                            });
                            foundTreatment = true;
                            const latest = rows[0];
                            result.dienBienBenh = latest.DIENBIENBENH || latest.NOIDUNG || '';
                            result.ngayToDieuTriMoiNhat = latest.NGAYMAUBENHPHAM || latest.NGAY_Y_LENH || latest.NGAY || '';

                            // Trích xuất Khám toàn thân từ tờ điều trị
                            var kttKeys = ['KHAMTOANHAN', 'KHAMBENHTOANTHAN', 'KHAMBENH_TOANTHAN', 'KHAM_TOAN_THAN', 'TOANTHAN'];
                            for (var ki2 = 0; ki2 < kttKeys.length; ki2++) {
                                var kv = latest[kttKeys[ki2]];
                                if (kv && String(kv).trim().length > 1) {
                                    result.khamToanThanTDT = String(kv).trim();
                                    break;
                                }
                            }
                            // Fallback: universal scan nếu không tìm thấy theo key chuẩn
                            if (!result.khamToanThanTDT) {
                                for (var fkk in latest) {
                                    var fuk2 = fkk.toUpperCase();
                                    if (fuk2.includes('KHAMTOAN') || fuk2.includes('TOANTHAN') || fuk2 === 'KHAMBENH_TOANTHAN') {
                                        var fvv = latest[fkk];
                                        if (fvv && String(fvv).trim().length > 1) {
                                            result.khamToanThanTDT = String(fvv).trim();
                                            break;
                                        }
                                    }
                                }
                            }

                            // === Bước 2a: Gọi NT.024.2.DETAIL để lấy chẩn đoán đầy đủ (có ICD) ===
                            var detailSheetId = latest.MAUBENHPHAMID || latest.PHIEUID || latest.ID;
                            if (detailSheetId && typeof _jsonrpc !== 'undefined' && _jsonrpc.AjaxJson) {
                                try {
                                    var detailRes = await _asyncCallSpO('NT.024.2.DETAIL', String(detailSheetId), 0);
                                    var records = [];
                                    if (typeof detailRes === 'string' && detailRes.trim() !== '') records = JSON.parse(detailRes);
                                    else if (typeof detailRes === 'object' && detailRes !== null) records = detailRes;
                                    if (records && records.rows && Array.isArray(records.rows)) records = records.rows;
                                    else if (!Array.isArray(records)) records = [records];

                                        // === LẤY CHẨN ĐOÁN: Ưu tiên lấy từ tờ điều trị tổng hợp (latest) vì nó chứa chuỗi hoàn chỉnh giống trên giao diện ===
                                        var foundChanDoan = false;

                                        // 1. Ưu tiên lấy theo key chính xác
                                        var exactKeys = ['CHANDOAN', 'CHUANDOAN', 'TENCHANDOAN', 'TENCHUANDOAN', 'BENHCHINH'];
                                        for (var ei = 0; ei < exactKeys.length; ei++) {
                                            var ek = exactKeys[ei];
                                            if (latest[ek] && String(latest[ek]).trim().length >= 2) {
                                                result.chanDoanMoiNhat = String(latest[ek]).trim();
                                                foundChanDoan = true;
                                                break;
                                            }
                                        }

                                        var kemtheoKeys = ['BENHKEMTHEO', 'BENH_KEM_THEO', 'CHANDOANKEMTHEO', 'CHUANDOANKEMTHEO', 'CHANDOAN_KEMTHEO', 'CHUANDOAN_KEMTHEO', 'PHU'];
                                        for (var ki = 0; ki < kemtheoKeys.length; ki++) {
                                            var kk = kemtheoKeys[ki];
                                            if (latest[kk] && String(latest[kk]).trim().length >= 2) {
                                                result.chanDoanKemTheoTDT = String(latest[kk]).trim();
                                                break;
                                            }
                                        }

                                        // 2. Fallback quét toàn bộ nếu không tìm thấy key chính xác
                                        if (!foundChanDoan) {
                                            for (var fk in latest) {
                                                var fuk = fk.toUpperCase();
                                                var fv = latest[fk];
                                                if (!fv || String(fv).trim().length < 2) continue;

                                                if (fuk.includes('CHANDOAN') || fuk.includes('CHUANDOAN') || fuk.includes('BENHCHINH')) {
                                                    // Bỏ qua các key của cận lâm sàng/hình ảnh
                                                    if (fuk.includes('HINHANH') || fuk.includes('QUANGTUYEN') || fuk.includes('YEUCAU') || fuk.includes('CDHA')) continue;

                                                    if (fuk.includes('KEMTHEO') || fuk.includes('PHU') || fuk.includes('_KT')) {
                                                        if (!result.chanDoanKemTheoTDT) result.chanDoanKemTheoTDT = String(fv).trim();
                                                    } else {
                                                        if (!result.chanDoanMoiNhat) {
                                                            result.chanDoanMoiNhat = String(fv).trim();
                                                            foundChanDoan = true;
                                                        }
                                                    }
                                                }
                                            }
                                        }

                                        // Nếu tờ tổng hợp KHÔNG có chẩn đoán hoặc bị nhiễu (như "CĐQT phải"), dùng Detail Universal Scan
                                        if (!foundChanDoan || (result.chanDoanMoiNhat && result.chanDoanMoiNhat.length < 10 && !result.chanDoanMoiNhat.toUpperCase().includes('BỆNH'))) {
                                            var allDiagStrings = [];
                                            var icdPatternExact = /^[A-Z]\d{2}(\.\d{1,2})?$/i;
                                            var icdPatternContains = /(^|\s|\(|\[|-)[A-Z]\d{2}(\.\d{1,2})?($|\s|\)|\]|-)/i;

                                            // Thu thập tất cả các text có tiềm năng (bỏ qua số, bỏ qua garbage key)
                                            var potentialTexts = [];
                                            for (var ri = 0; ri < records.length; ri++) {
                                                var rec = records[ri];
                                                if (!rec) continue;

                                                for (var rk in rec) {
                                                    var ruk = rk.toUpperCase();
                                                    var rv = String(rec[rk] || '').trim();
                                                    if (rv.length < 2) continue;

                                                    // Bỏ qua nếu là key rác
                                                    if (ruk.includes('HINHANH') || ruk.includes('QUANGTUYEN') || ruk.includes('YEUCAU') || ruk.includes('CDHA') || ruk.includes('DICHVU') || ruk.includes('PHONGKHAM') || ruk === 'TEN') continue;

                                                    potentialTexts.push(rv);
                                                }
                                            }

                                            for (var i = 0; i < potentialTexts.length; i++) {
                                                var curText = potentialTexts[i];

                                                // Nếu là mã ICD độc lập (VD: "S50") - Loại trừ NK vì đó là mã điều dưỡng (NK01)
                                                if (curText.length <= 6 && icdPatternExact.test(curText) && !curText.toUpperCase().startsWith('NK')) {
                                                    var desc = '';
                                                    for (var j = i - 1; j >= Math.max(0, i - 5); j--) {
                                                        var t = potentialTexts[j];
                                                        if (t.length > 5 && /[A-Za-zĐđÂâĂăÊêÔôƠơƯư]/i.test(t) && !icdPatternExact.test(t)) { desc = t; break; }
                                                    }
                                                    if (!desc) {
                                                        for (j = i + 1; j <= Math.min(potentialTexts.length - 1, i + 5); j++) {
                                                            t = potentialTexts[j];
                                                            if (t.length > 5 && /[A-Za-zĐđÂâĂăÊêÔôƠơƯư]/i.test(t) && !icdPatternExact.test(t)) { desc = t; break; }
                                                        }
                                                    }

                                                    if (desc) {
                                                        allDiagStrings.push(curText + ' - ' + desc);
                                                    } else {
                                                        allDiagStrings.push(curText);
                                                    }
                                                }
                                                // Nếu là chuỗi dài chứa mã ICD (VD: "W29-Tiếp xúc...")
                                                else if (curText.length > 6 && icdPatternContains.test(curText)) {
                                                    allDiagStrings.push(curText);
                                                }
                                            }

                                            // Loại bỏ trùng lặp và phân loại chính/phụ
                                            allDiagStrings = [...new Set(allDiagStrings)];
                                            if (allDiagStrings.length > 0) {
                                                result.chanDoanMoiNhat = allDiagStrings[0];
                                                if (allDiagStrings.length > 1) {
                                                    result.chanDoanKemTheoTDT = allDiagStrings.slice(1).join('; ');
                                                }
                                            }
                                            debugLog('[API-Bridge] TĐT DETAIL universal scan:', allDiagStrings);
                                        }

                                        // Làm sạch và gộp chẩn đoán (theo yêu cầu user: "gộp chẩn đoán và chẩn đoán kèm theo thành 1 dòng, bỏ từ 'chẩn đoán kèm theo'")
                                        var cleanDiag = function (str) {
                                            if (!str) return '';
                                            return str.replace(/^(chẩn đoán kèm theo|bệnh kèm theo|chẩn đoán|bệnh chính|kèm theo)[:\-\s]*/i, '').trim();
                                        };

                                        var cChinh = cleanDiag(result.chanDoanMoiNhat);
                                        var cPhu = cleanDiag(result.chanDoanKemTheoTDT);

                                        var combined = cChinh;
                                        if (cPhu && !combined.includes(cPhu)) {
                                            combined += (combined ? '; ' : '') + cPhu;
                                        }

                                        result.chanDoanMoiNhat = combined;
                                        result.chanDoanKemTheoTDT = ''; // Đã gộp nên xoá kèm theo để tránh hiển thị trùng

                                        debugLog('[API-Bridge] TĐT Summary extract:', result.chanDoanMoiNhat);
                                    } catch (detErr) {
                                        console.warn('[API-Bridge] NT.024.2.DETAIL failed:', detErr);
                                    }
                            }
                        }
                    }
                } catch (e) {
                    console.warn('[API-Bridge] fetchClinicalSummary Treatment error:', e);
                }
            }

            // === PHẦN 3: Sinh hiệu ===
            try {
                let vitals = { pulse: '', temperature: '', bloodPressure: '', weight: '', height: '', respiratoryRate: '', spo2: '' };

                // Thử lấy từ grid data (Nội trú)
                if (rowData) {
                    vitals.pulse = rowData.MACH || '';
                    vitals.temperature = rowData.NHIETDO || '';
                    vitals.bloodPressure = rowData.HUYETAP || rowData.HUYET_AP || rowData.HA || '';
                    vitals.weight = rowData.CANNANG || '';
                    vitals.height = rowData.CHIEUCAO || '';
                    vitals.respiratoryRate = rowData.NHIPTHO || rowData.NHIP_THO || '';
                    vitals.spo2 = rowData.SPO2 || '';
                }

                // Fallback: Đọc từ DOM (Ngoại trú — tabBenhAn có các input riêng)
                var hasVitals = !!(vitals.pulse || vitals.temperature || vitals.weight);
                if (!hasVitals) {
                    var _vVal = function (id) {
                        var el = _findDomElement(id);
                        return el ? (el.value || '').trim() : '';
                    };
                    vitals.pulse = _vVal('tabBenhAntxtKHAMBENH_MACH');
                    vitals.temperature = _vVal('tabBenhAntxtKHAMBENH_NHIETDO');
                    vitals.respiratoryRate = _vVal('tabBenhAntxtKHAMBENH_NHIPTHO');
                    vitals.weight = _vVal('tabBenhAntxtKHAMBENH_CANNANG');
                    vitals.height = _vVal('tabBenhAntxtKHAMBENH_CHIEUCAO');
                    var haHigh = _vVal('tabBenhAntxtKHAMBENH_HUYETAP_HIGH');
                    var haLow = _vVal('tabBenhAntxtKHAMBENH_HUYETAP_LOW');
                    if (haHigh || haLow) vitals.bloodPressure = (haHigh || '?') + '/' + (haLow || '?');
                }

                // Clean up
                for (const key in vitals) {
                    if (vitals[key] === '&nbsp;' || vitals[key] === 'undefined' || vitals[key] === 'null') {
                        vitals[key] = '';
                    } else {
                        vitals[key] = String(vitals[key]).replace(/<[^>]+>/g, '').trim();
                    }
                }
                result.sinhHieu = vitals;
            } catch (e) {
                console.warn('[API-Bridge] fetchClinicalSummary Vitals error:', e);
            }

            // === PHẦN 4: Ưu tiên ghi đè bằng DOM thời gian thực từ tờ điều trị đang mở (nếu có) ===
            try {
                var domSheet = scrapeTreatmentSheetFromDOM();
                if (domSheet) {
                    debugLog('[API-Bridge] fetchClinicalSummary: Ghi đè bằng dữ liệu DOM thời gian thực từ tờ điều trị đang mở');
                    if (domSheet.dienBienBenh) result.dienBienBenh = domSheet.dienBienBenh;
                    if (domSheet.khamToanThanTDT) result.khamToanThanTDT = domSheet.khamToanThanTDT;
                    if (domSheet.khamBoPhan) result.khamBoPhan = domSheet.khamBoPhan;
                    if (domSheet.ketQuaCLS) result.tomTatCLS = domSheet.ketQuaCLS;
                    if (domSheet.huongXuLy) result.huongXuLy = domSheet.huongXuLy;
                    if (domSheet.chanDoanMoiNhat) result.chanDoanMoiNhat = domSheet.chanDoanMoiNhat;

                    // Ghi đè sinh hiệu từ DOM
                    if (domSheet.sinhHieu) {
                        for (var vk in domSheet.sinhHieu) {
                            if (domSheet.sinhHieu[vk]) {
                                result.sinhHieu[vk] = domSheet.sinhHieu[vk];
                            }
                        }
                    }
                    
                    // Ghi nhận thêm các thông tin bóc tách đặc biệt từ tờ điều trị
                    result.diet = domSheet.diet || '';
                    result.care = domSheet.care || '';
                    result.yLenhRealtime = domSheet.yLenh || '';

                    // Tạo mốc thời gian ảo "Đang soạn thảo"
                    var now = new Date();
                    var timeStr = ('0' + now.getDate()).slice(-2) + '/' +
                                  ('0' + (now.getMonth() + 1)).slice(-2) + '/' +
                                  now.getFullYear() + ' ' +
                                  ('0' + now.getHours()).slice(-2) + ':' +
                                  ('0' + now.getMinutes()).slice(-2) + ':' +
                                  ('0' + now.getSeconds()).slice(-2);
                    result.ngayToDieuTriMoiNhat = timeStr + ' (Đang soạn thảo)';
                }
            } catch (domErr) {
                console.warn('[API-Bridge] fetchClinicalSummary: Lỗi ghi đè DOM thời gian thực:', domErr);
            }

            sendResult('FETCH_CLINICAL_SUMMARY_RESULT', effectiveRowId, result, requestId);
        } catch (e) {
            console.error('[API-Bridge] fetchClinicalSummary error:', e);
            sendResult('FETCH_CLINICAL_SUMMARY_RESULT', rowId, { _context: null }, requestId);
        }
    }


    function sendResult(type, rowId, data, requestId) {
        const CLINICAL_RESULTS = [
            'FETCH_HISTORY_RESULT', 'FETCH_PATIENT_DEMOGRAPHICS_RESULT', 'FETCH_VITALS_RESULT',
            'FETCH_TREATMENT_RESULT', 'FETCH_DRUGS_RESULT', 'FETCH_DRUGS_CLS_RESULT',
            'FETCH_CLINICAL_SUMMARY_RESULT', 'FETCH_DIAGNOSES_RESULT', 'PREFETCH_DIAGNOSES_RESULT',
            'FETCH_LABS_RESULT'
        ];
        if (CLINICAL_RESULTS.includes(type) && data) {
            const dataCtx = data._context || data.treatmentContext || data;
            if (dataCtx) {
                const dataBnId = String(dataCtx.BENHNHANID || dataCtx.benhnhanId || '').replace(/&nbsp;|undefined|null/g, '').trim();
                const dataKbId = String(dataCtx.KHAMBENHID || dataCtx.khambenhId || '').replace(/&nbsp;|undefined|null/g, '').trim();
                const dataHsbaId = String(dataCtx.HOSOBENHANID || dataCtx.hosobenhanid || dataCtx.HSBAID || dataCtx.hsbaId || '').replace(/&nbsp;|undefined|null/g, '').trim();
                
                if (dataBnId || dataKbId || dataHsbaId) {
                    const { rowData } = resolveActiveGrid(null, { strict: false });
                    if (rowData && Object.keys(rowData).length > 0) {
                        const activeBnId = String(rowData.BENHNHANID || rowData.MA_BENH_NHAN_ID || '').replace(/&nbsp;|undefined|null/g, '').trim();
                        const activeKbId = String(rowData.KHAMBENHID || rowData.MADIEUTRI || rowData.KHAM_BENH_ID || '').replace(/&nbsp;|undefined|null/g, '').trim();
                        const activeHsbaId = String(rowData.HOSOBENHANID || rowData.HSBAID || rowData.HO_SO_BENH_AN_ID || '').replace(/&nbsp;|undefined|null/g, '').trim();

                        // 1. Patient ID conflict
                        if (dataBnId && activeBnId && dataBnId !== activeBnId) {
                            console.warn(`[Aladinn API-Bridge] Lock mismatch: Patient ID conflict (data: ${dataBnId}, active: ${activeBnId}). Suppressing: ${type}`);
                            return; // Fail-closed!
                        }
                        // 2. Encounter ID conflict
                        if (dataKbId && activeKbId && dataKbId !== activeKbId) {
                            console.warn(`[Aladinn API-Bridge] Lock mismatch: Encounter ID conflict (data: ${dataKbId}, active: ${activeKbId}). Suppressing: ${type}`);
                            return; // Fail-closed!
                        }
                        // 3. HSBA ID conflict
                        if (dataHsbaId && activeHsbaId && dataHsbaId !== activeHsbaId) {
                            console.warn(`[Aladinn API-Bridge] Lock mismatch: HSBA ID conflict (data: ${dataHsbaId}, active: ${activeHsbaId}). Suppressing: ${type}`);
                            return; // Fail-closed!
                        }

                        // 4. Must have at least one valid overlap
                        const hasBnMatch = dataBnId && activeBnId && dataBnId === activeBnId;
                        const hasKbMatch = dataKbId && activeKbId && dataKbId === activeKbId;
                        const hasHsbaMatch = dataHsbaId && activeHsbaId && dataHsbaId === activeHsbaId;

                        if (!hasBnMatch && !hasKbMatch && !hasHsbaMatch) {
                            console.warn(`[Aladinn API-Bridge] Lock mismatch: No matching non-empty identifiers. Suppressing: ${type}`);
                            return; // Fail-closed!
                        }
                    }
                }
            }
        }

        window.postMessage({
            type,
            rowId,
            ...data,
            requestId,
            // [P1-SEC-006] Include nonce so messaging.js mandatory nonce check passes
            nonce: ALADINN_NONCE
        }, window.location.origin);
    }

    // ─── PACS Token Fetcher ────────────────────────────────────────────────────
    // Dùng hàm getHashRIS() sẵn có của VNPT HIS để lấy URL ảnh DICOM.
    // Không cần session cookie — xác thực bằng Hashids daily key.
    async function fetchPacsUrl(config, requestId) {
        try {
            let sheetId, maubenhphamid, sophieu, madichvu, linkDicom;
            if (typeof config === 'object' && config !== null) {
                sheetId = config.sheetId;
                maubenhphamid = config.maubenhphamid;
                sophieu = config.sophieu;
                madichvu = config.madichvu;
                linkDicom = config.linkDicom;
            } else {
                sheetId = config;
                maubenhphamid = config;
                sophieu = config;
                madichvu = '';
                linkDicom = '';
            }

            // Priority 1: Direct linkDicom if present
            if (linkDicom && linkDicom.trim() !== '') {
                sendResult('PACS_URL_RESULT', null, { pacsUrl: linkDicom }, requestId);
                return;
            }

            // Priority 2: Trigger native HIS button if available
            let nativeTriggered = false;
            const frames = [window, ...Array.from(document.querySelectorAll('iframe')).map(f => f.contentWindow).filter(Boolean)];

            for (const win of frames) {
                if (win.$) {
                    const grid = win.$('#tcCDHAHisgrdCDHA');
                    if (grid.length > 0) {
                        const rowIds = grid.jqGrid('getDataIDs');
                        for (const id of rowIds) {
                            const rowData = grid.jqGrid('getRowData', id);
                            if (rowData.MAUBENHPHAMID == sheetId || rowData.SOPHIEU == sheetId || rowData.MAUBENHPHAMID == maubenhphamid || rowData.SOPHIEU == sophieu) {
                                grid.jqGrid('setSelection', id, false);
                                const btn = win.$('#tcCDHAHisbtnDicomViewer');
                                if (btn.length > 0) {
                                    btn.click();
                                    nativeTriggered = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                if (nativeTriggered) break;
            }

            if (nativeTriggered) {
                sendResult('PACS_URL_RESULT', null, { pacsUrl: 'NATIVE_TRIGGERED' }, requestId);
                return;
            }

            // Priority 3: Fallback to manual fetch
            let domain = window.RIS_SERVICE_DOMAIN_NAME || 'https://cdha-sadecdtp.vnpthis.vn/';
            let getDicom = window.RIS_GET_DICOM_VIEWER || 'api/public/dicomViewer';
            let secret = window.RIS_SECRET_KEY || 'vnptris';

            for (const win of frames) {
                if (win.RIS_SECRET_KEY && win.RIS_SECRET_KEY.trim() !== '') secret = win.RIS_SECRET_KEY;
                if (win.RIS_SERVICE_DOMAIN_NAME && win.RIS_SERVICE_DOMAIN_NAME.trim() !== '') domain = win.RIS_SERVICE_DOMAIN_NAME;
                if (win.RIS_GET_DICOM_VIEWER && win.RIS_GET_DICOM_VIEWER.trim() !== '') getDicom = win.RIS_GET_DICOM_VIEWER;
            }

            const requestsToTry = [];

            // PRIORITY 1 (NEW PACS API): Gọi API dicomViewer với studyInstanceUID = GHICHU2 (sheetId)
            // Hệ thống mới sẽ trả về JSON chứa link study/summary kèm token UUID hợp lệ
            if (sheetId && String(sheetId).trim() !== '') {
                requestsToTry.push({ url: domain + getDicom + '?studyInstanceUID=' + sheetId, identifyCode: sheetId });
            }

            // PRIORITY 2: MAUBENHPHAMID + MADICHVU (Fallback cho VNPT Đồng Tháp cũ)
            const targetId = maubenhphamid || sheetId;

            if (madichvu) {
                requestsToTry.push({ url: domain + getDicom + '?requestCode=' + targetId + '&conceptCode=' + madichvu, identifyCode: targetId });
                requestsToTry.push({ url: domain + 'ris/get_image.php?requestCode=' + targetId + '&conceptCode=' + madichvu, identifyCode: targetId });
            }

            // PRIORITY 2: MAUBENHPHAMID only
            requestsToTry.push({ url: domain + getDicom + '?studyInstanceUID=' + targetId, identifyCode: targetId });
            requestsToTry.push({ url: domain + 'ris/get_image.php?instanceUID=' + targetId, identifyCode: targetId });

            // PRIORITY 2: combination of SOPHIEU & MAUBENHPHAMID
            if (sophieu && maubenhphamid && sophieu !== maubenhphamid) {
                requestsToTry.push({ url: domain + getDicom + '?ris_exam_id=' + sophieu + '&service_id=' + maubenhphamid, identifyCode: sophieu });
                requestsToTry.push({ url: domain + getDicom + '?ris_exam_id=' + maubenhphamid + '&service_id=' + sophieu, identifyCode: maubenhphamid });
                requestsToTry.push({ url: domain + 'ris/get_image.php?ris_exam_id=' + sophieu + '&service_id=' + maubenhphamid, identifyCode: sophieu });
            }

            // PRIORITY 3: SOPHIEU (fallback)
            if (sophieu && sophieu !== targetId) {
                requestsToTry.push({ url: domain + getDicom + '?studyInstanceUID=' + sophieu, identifyCode: sophieu });
                requestsToTry.push({ url: domain + 'ris/get_image.php?instanceUID=' + sophieu, identifyCode: sophieu });

                if (madichvu) {
                    requestsToTry.push({ url: domain + getDicom + '?requestCode=' + sophieu + '&conceptCode=' + madichvu, identifyCode: sophieu });
                    requestsToTry.push({ url: domain + 'ris/get_image.php?requestCode=' + sophieu + '&conceptCode=' + madichvu, identifyCode: sophieu });
                }
            }

            let lastError = null;
            let corsBlockedUrl = null;

            for (const req of requestsToTry) {
                try {
                    let hash = '';
                    if (typeof window.getHashRIS === 'function') {
                        const originalSecret = window.RIS_SECRET_KEY;
                        window.RIS_SECRET_KEY = secret;
                        hash = window.getHashRIS(String(req.identifyCode));
                        window.RIS_SECRET_KEY = originalSecret;
                    }

                    const res = await fetch(req.url, {
                        method: 'GET',
                        headers: {
                            'Ris-Access-Hash': hash,
                            'Identify-Code': String(req.identifyCode)
                        }
                    });

                    if (res.ok) {
                        const contentType = res.headers.get('content-type') || '';

                        if (contentType.includes('application/json')) {
                            const json = await res.json();
                            if (json && json.status_code === 200 && json.data) {
                                sendResult('PACS_URL_RESULT', null, { pacsUrl: json.data }, requestId);
                                return;
                            } else {
                                lastError = `JSON status: ${json?.status_code || 'unknown'}`;
                            }
                        } else {
                            let finalUrl = req.url;
                            if (hash && !finalUrl.includes('Ris-Access-Hash') && !finalUrl.includes('token=')) {
                                if (finalUrl.includes('study/summary')) {
                                    finalUrl += '&token=' + encodeURIComponent(hash);
                                } else {
                                    finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'Ris-Access-Hash=' + encodeURIComponent(hash);
                                    finalUrl += '&Identify-Code=' + encodeURIComponent(String(req.identifyCode));
                                }
                            }
                            sendResult('PACS_URL_RESULT', null, { pacsUrl: finalUrl }, requestId);
                            return;
                        }
                    } else {
                        lastError = `HTTP ${res.status}`;
                    }
                } catch (e) {
                    lastError = e.message;
                    // If CORS blocks the request (common for HTML viewer endpoints like .php), fetch throws TypeError: Failed to fetch
                    if (e.message.includes('Failed to fetch') || e.message.includes('NetworkError')) {
                        if (!corsBlockedUrl) {
                            // Save the first CORS-blocked URL as our best-effort fallback
                            let finalUrl = req.url;
                            let hash = '';
                            if (typeof window.getHashRIS === 'function') {
                                const originalSecret = window.RIS_SECRET_KEY;
                                window.RIS_SECRET_KEY = secret;
                                hash = window.getHashRIS(String(req.identifyCode));
                                window.RIS_SECRET_KEY = originalSecret;
                            }
                            if (hash && !finalUrl.includes('Ris-Access-Hash') && !finalUrl.includes('token=')) {
                                if (finalUrl.includes('study/summary')) {
                                    finalUrl += '&token=' + encodeURIComponent(hash);
                                } else {
                                    finalUrl += (finalUrl.includes('?') ? '&' : '?') + 'Ris-Access-Hash=' + encodeURIComponent(hash);
                                    finalUrl += '&Identify-Code=' + encodeURIComponent(String(req.identifyCode));
                                }
                            }
                            corsBlockedUrl = finalUrl;
                        }
                    }
                }
            }

            // If we exhausted all URLs and got a CORS block on one of them, return it! 
            // It's likely the correct viewer URL, we just couldn't verify it via JS due to CORS.
            if (corsBlockedUrl) {
                sendResult('PACS_URL_RESULT', null, { pacsUrl: corsBlockedUrl }, requestId);
                return;
            }

            sendResult('PACS_URL_RESULT', null, { pacsUrl: null, pacsError: lastError || 'All fallback methods failed' }, requestId);
        } catch (e) {
            sendResult('PACS_URL_RESULT', null, { pacsUrl: null, pacsError: e.message }, requestId);
        }
    }

    async function fetchPttt(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_PTTT_RESULT', rowId, { ptttList: [] }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId);

            let candidates = [
                rowData.TIEPNHANID,
                rowData.HOSOBENHANID,
                rowData.KHAMBENHID,
                rowData.MADIEUTRI
            ].filter(v => v && v.trim() !== '');

            candidates = Array.from(new Set(candidates));

            let allPttt = [];
            const benhnhanId = rowData.BENHNHANID || '';

            for (let testId of candidates) {
                const options = [
                    { name: '[0]', value: String(testId) }, // KHAMBENHID or alternative
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '5' }, // 5 = PTTT (Chuyên Khoa)
                    { name: '[3]', value: String(rowData.HOSOBENHANID || rowData.TIEPNHANID || testId) }
                ];

                const rows = await _fetchHisPagingRows('NT.024.DSPHIEUCLS', options, 100, 'sidx=NGAYMAUBENHPHAM&sord=desc');
                if (rows && rows.length > 0) {
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
                    return;
                }
            }

            sendResult('FETCH_PTTT_RESULT', rowId, { ptttList: allPttt }, requestId);

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
            const { rowData } = resolveActiveGrid(rowId);

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
                    rowElem.find('td').each(function () {
                        const aria = _$(this).attr('aria-describedby') || '';
                        if (aria.toUpperCase().includes('HOTEN') || aria.toUpperCase().includes('TENBENHNHAN')) {
                            patientName = _$(this).text().trim() || patientName;
                        }
                    });
                }
            } catch (_e) { }

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

            const _context = {
                rowId,
                KHAMBENHID: khambenhId,
                HOSOBENHANID: hsbaId,
                BENHNHANID: benhnhanId,
                patientName: patientName
            };

            try {
                let newApiRows = [];
                if (khambenhId) {
                    newApiRows = await _fetchSheets('TraCuuKetQuaHDG', [{ name: '[0]', value: String(khambenhId) }]);
                }
                if ((!newApiRows || newApiRows.length === 0) && hsbaId) {
                    newApiRows = await _fetchSheets('TraCuuKetQuaHDG', [{ name: '[0]', value: String(hsbaId) }]);
                }

                if (!newApiRows || newApiRows.length === 0) {
                    throw new Error('No data from TraCuuKetQuaHDG, triggering fallback');
                }

                const newAllLabs = [];
                const newImagingData = [];

                for (const item of newApiRows) {
                    const getVal = (obj, keys) => {
                        if (!obj) return '';
                        for (const k of Object.keys(obj)) {
                            if (keys.includes(k.toUpperCase())) return obj[k];
                        }
                        return '';
                    };

                    const testName = getVal(item, ['TENXETNGHIEM', 'TENDICHVU_CHA', 'LOAIXETNGHIEM', 'TENDICHVU', 'TEN_DICHVU_KYTHUAT', 'TENLOAICHIDINH']);
                    const code = getVal(item, ['TEN', 'TENCHISO', 'TENCHIDINH', 'TENTONGHOP', 'MADICHVU', 'MA']);
                    const value = getVal(item, ['GIATRI_KETQUA', 'KETQUA', 'KETQUACLS']);
                    const unit = getVal(item, ['DONVITINH', 'DONVI']);
                    const refMin = item.GIATRINHONHAT || item.GIATRI_MIN || '';
                    const refMax = item.GIATRILONNHAT || item.GIATRI_MAX || '';
                    const refDisplay = item.TRISOBINHTHUONG || '';
                    const sheetId = item.MAUBENHPHAMID || item.SOPHIEUID || item.SOPHIEU || item.IDPHIEU || '';
                    const sheetDate = item.NGAYMAUBENHPHAM || item.NGAYCHIDINH || item.THOIGIAN || '';

                    let status = '';
                    const flagRaw = String(item.BATHUONG || item.BaThuong || item.FLAG_BATHUONG || '').toLowerCase();
                    if (flagRaw === '1' || flagRaw === 'high' || flagRaw === 'cao' || flagRaw.includes('tăng')) {
                        status = 'Cao';
                    } else if (flagRaw === '-1' || flagRaw === 'low' || flagRaw === 'thấp' || flagRaw.includes('giảm')) {
                        status = 'Thấp';
                    }
                    if (!status && value) {
                        const numVal = parseFloat(String(value).replace(',', '.'));
                        const numMin = parseFloat(String(refMin).replace(',', '.'));
                        const numMax = parseFloat(String(refMax).replace(',', '.'));
                        if (!isNaN(numVal)) {
                            if (!isNaN(numMax) && numVal > numMax) status = 'Cao';
                            else if (!isNaN(numMin) && numVal < numMin) status = 'Thấp';
                        }
                    }

                    const linkDicom = item.LINK_DICOM || '';
                    const conclusion = getVal(item, ['KETLUAN']);
                    
                    const isCDHA = linkDicom !== '' || conclusion !== '' || String(testName || '').toUpperCase().includes('CHỤP') || String(testName || '').toUpperCase().includes('SIÊU ÂM') || String(testName || '').toUpperCase().includes('X-QUANG');

                    if (isCDHA) {
                        newImagingData.push({
                            sheetId: sheetId,
                            maubenhphamid: sheetId,
                            sophieu: item.SOPHIEU || item.IDPHIEU || '',
                            madichvu: item.MADICHVU || item.MA || '',
                            linkDicom: linkDicom,
                            sheetDate: sheetDate,
                            name: testName || code || 'CĐHA',
                            code: item.MADICHVU || item.MA || '',
                            conclusion: conclusion || value || '',
                            status: item.TRANGTHAI || item.TRANGTHAIKETQUA || '',
                            department: item.KHOADIEUTRI || item.TENPHONG || ''
                        });
                    } else {
                        if (value || code) {
                            newAllLabs.push({
                                sheetId: sheetId,
                                sheetDate: sheetDate,
                                testName: testName || code,
                                code: code,
                                value: value,
                                unit: unit,
                                refMin: refMin,
                                refMax: refMax,
                                refDisplay: refDisplay,
                                status: status
                            });
                        }
                    }
                }

                if (newAllLabs.length === 0 && newImagingData.length === 0) {
                    throw new Error('Mapped empty labsData/imagingData from TraCuuKetQuaHDG');
                }

                sendResult('FETCH_LABS_RESULT', rowId, { labsData: newAllLabs, imagingData: newImagingData, patientName, _context }, requestId);
                return;
            } catch (newApiErr) {
                console.warn('[API-Bridge] TraCuuKetQuaHDG failed, falling back:', newApiErr.message || 'Unknown error');
            }

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

            debugLog(`[API-Bridge] Found ${uniqueSheets.length} XN sheets, ${uniqueCdha.length} CĐHA sheets`);

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
                    console.error('[API-Bridge] Error fetching details for sheet:', _e.message || 'Unknown error');
                }
            });

            await Promise.all(detailPromises);

            // Build CĐHA data — fetch detail for each sheet via NT.024.2
            const imagingData = [];
            const cdhaDetailPromises = uniqueCdha.map(async (sheet) => {
                const sheetId = sheet.MAUBENHPHAMID;
                const pacsId = sheet.SOPHIEU || sheet.IDPHIEU || sheet.MAUBENHPHAMID;
                if (!sheetId) return;
                try {
                    const rows = await _fetchSheets('NT.024.2', [{ name: '[0]', value: String(sheetId) }]);
                    if (rows.length > 0) {
                        for (const item of rows) {
                            const pacsItemId = item.GHICHU2 || item.MACACHUP || pacsId;
                            imagingData.push({
                                sheetId: pacsItemId,
                                maubenhphamid: sheetId,
                                sophieu: sheet.SOPHIEU || sheet.IDPHIEU || '',
                                madichvu: item.MADICHVU || item.MA || '',
                                linkDicom: item.LINK_DICOM || sheet.LINK_DICOM || '',
                                sheetDate: sheet.NGAYMAUBENHPHAM || sheet.NGAYCHIDINH || '',
                                name: item.TEN || item.TENDICHVU || item.TEN_DICHVU_KYTHUAT || item.TENCHIDINH || sheet.TEN_DICHVU_KYTHUAT || '',
                                code: item.MADICHVU || item.MA || '',
                                conclusion: item.KETLUAN || item.KETQUA || item.GIATRI_KETQUA || item.KETQUACLS || '',
                                status: item.TRANGTHAI || item.TRANGTHAIKETQUA || sheet.TRANGTHAI || '',
                                department: sheet.KHOADIEUTRI || sheet.TENPHONG || ''
                            });
                        }
                    } else {
                        imagingData.push({
                            sheetId: pacsId,
                            maubenhphamid: sheetId,
                            sophieu: sheet.SOPHIEU || sheet.IDPHIEU || '',
                            madichvu: '',
                            linkDicom: sheet.LINK_DICOM || '',
                            sheetDate: sheet.NGAYMAUBENHPHAM || '',
                            name: sheet.TEN_DICHVU_KYTHUAT || 'CĐHA',
                            code: '', conclusion: '', status: sheet.TRANGTHAI || '', department: sheet.KHOADIEUTRI || sheet.TENPHONG || ''
                        });
                    }
                } catch (_e) { /* silent */ }
            });
            await Promise.all(cdhaDetailPromises);



            sendResult('FETCH_LABS_RESULT', rowId, { labsData: allLabs, imagingData, patientName, _context }, requestId);

        } catch (err) {
            console.error('[API-Bridge] fetchLabs error:', err.message || 'Unknown error');
            sendResult('FETCH_LABS_RESULT', rowId, { labsData: [], imagingData: [], patientName: '', _context: null }, requestId);
        }
    }

    // ─── BHYT Time Error Scanner ─────────────────────────────────────────────
    // Fetches all CLS sheets for a patient and returns time fields
    // so the content script can detect BHYT violations (TH >= KQ, etc.)
    async function fetchBhytTimes(rowId, requestId) {
        try {
            if (!_$) {
                sendResult('FETCH_BHYT_TIMES_RESULT', rowId, { sheets: [], patientName: '' }, requestId);
                return;
            }
            const { rowData } = resolveActiveGrid(rowId);

            const benhnhanId = rowData.BENHNHANID || '';
            const hsbaId = rowData.HOSOBENHANID || rowData.HSBAID || '';
            const khambenhId = rowData.KHAMBENHID || rowData.MADIEUTRI || rowId;
            const uuid = _jsonrpc?.AjaxJson?.uuid;

            // Get patient name
            let patientName = '';
            for (const key in rowData) {
                if (['HOTEN', 'TENBENHNHAN', 'TEN_BENH_NHAN', 'TEN'].includes(key.toUpperCase())) {
                    const val = String(rowData[key]).replace(/<[^>]+>/g, '').trim();
                    if (val) { patientName = val; break; }
                }
            }
            if (!patientName) {
                _$('#' + rowId).find('td').each(function () {
                    const aria = _$(this).attr('aria-describedby') || '';
                    if (aria.toUpperCase().includes('HOTEN') || aria.toUpperCase().includes('TENBENHNHAN')) {
                        patientName = _$(this).text().trim() || patientName;
                    }
                });
            }

            if (!benhnhanId || !uuid) {
                sendResult('FETCH_BHYT_TIMES_RESULT', rowId, { sheets: [], patientName }, requestId);
                return;
            }

            const baseUrl = '/vnpthis/RestService';
            const _apiQuery = async (queryCode, opts) => {
                try {
                    const p = { func: 'ajaxExecuteQueryPaging', uuid, params: [queryCode], options: opts };
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

            // ── Step 1: Fetch XN sheets only (type=1) ──
            const candidates = [hsbaId, khambenhId].filter(v => v && v.trim() !== '');
            let sheetRows = [];

            for (const cid of candidates) {
                sheetRows = await _apiQuery('NT.024.DSPHIEU', [
                    { name: '[0]', value: '' },
                    { name: '[1]', value: String(benhnhanId) },
                    { name: '[2]', value: '1' }, // type=1 = XN only
                    { name: '[3]', value: String(cid) }
                ]);
                if (sheetRows.length > 0) break;
            }

            // ── Step 2: For each sheet, fetch details (NT.024.2) to get execution/result times ──
            const allResults = [];
            // Multiple date formats: DD/MM/YYYY HH:mm, YYYY-MM-DD, ISO
            const datePatterns = [
                /\d{2}\/\d{2}\/\d{4}\s+\d{2}:\d{2}/,       // DD/MM/YYYY HH:mm
                /\d{4}-\d{2}-\d{2}T?\d{2}:\d{2}/,           // ISO / YYYY-MM-DD HH:mm
                /\d{2}-\d{2}-\d{4}\s+\d{2}:\d{2}/            // DD-MM-YYYY HH:mm
            ];

            // Auto-detect helper
            const detectDates = (obj) => {
                const found = {};
                for (const k of Object.keys(obj)) {
                    const v = String(obj[k] || '');
                    if (datePatterns.some(p => p.test(v))) found[k] = v;
                }
                return found;
            };

            for (const sheet of sheetRows) {
                const sheetId = sheet.MAUBENHPHAMID || sheet.SOPHIEUID;
                if (!sheetId) continue;

                const details = await _apiQuery('NT.024.2', [{ name: '[0]', value: String(sheetId) }]);

                // Filter: STRICTLY ONLY "Đường máu mao mạch"
                // Do NOT include "Định lượng Glucose [Máu]" because it has different API field mapping (not swapped).
                const glucoseDetails = details.filter(d => {
                    const name = (d.TEN || d.TENCHISO || d.TENDICHVU || d.TENTONGHOP || d.TENXETNGHIEM || '').toUpperCase();
                    return name.includes('MAO MACH') || name.includes('MAO MẠCH');
                });

                if (glucoseDetails.length === 0) continue;

                // Extract time from SHEET level
                const sheetDateFields = allResults.length < 2 ? detectDates(sheet) : {};

                for (const d of glucoseDetails) {
                    // Auto-detect date fields from detail level
                    const detailDateFields = allResults.length < 2 ? detectDates(d) : {};

                    // Try to get times from detail level first, then sheet level
                    const tryGet = (obj, ...keys) => {
                        for (const k of keys) {
                            if (obj[k]) return String(obj[k]);
                        }
                        return '';
                    };

                    const tenDV = tryGet(d, 'TEN', 'TENCHISO', 'TENDICHVU', 'TENCHIDINH', 'TENTONGHOP', 'TENXETNGHIEM') || tryGet(sheet, 'TENLOAICHIDINH', 'TENDICHVU');
                    const ketqua = tryGet(d, 'GIATRI_KETQUA', 'KETQUA', 'KETQUACLS');

                    // ── HYBRID Time Source Strategy ──
                    // - tgThucHien: Detail-level THOIGIANTRAKETQUA (verified = HIS "Thực hiện" for mao mạch)
                    // - tgKetQua: Sheet-level NGAYMAUBENHPHAM_HOANTHANH (verified = HIS "TG trả KQ")
                    // - Detail TGTHUCHIEN is UNRELIABLE for KQ (05:06 vs HIS 05:10)
                    // - Sheet has NO "Thực hiện" field (always empty)
                    const tgTH = tryGet(d, 'THOIGIANTRAKETQUA', 'THOIGIANTRAKETQUA1');
                    const tgKQ = tryGet(sheet, 'NGAYMAUBENHPHAM_HOANTHANH', 'THOIGIANTRAKETQUA', 'NGAYTRAKETQUA');

                    allResults.push({
                        id: sheetId,
                        soPhieu: tryGet(sheet, 'SOPHIEU'),
                        tenDV: tenDV,
                        ketQua: ketqua,
                        tgChiDinh: tryGet(sheet, 'NGAYMAUBENHPHAM', 'NGAYCHIDINH', 'NGAY_CHIDINH', 'THOIGIANCHIDINH', 'NGAYDICHVU'),
                        tgThucHien: tgTH,
                        tgKetQua: tgKQ,
                        nguoiTH: tryGet(d, 'BACSITHUCHIEN', 'NGUOITHUCHIEN'),
                        trangThai: tryGet(d, 'TRANGTHAIKETQUA', 'TENTRANGTHAI'),
                        // Debug
                        _detail_TGTHUCHIEN: tryGet(d, 'TGTHUCHIEN'),
                        _detail_THOIGIANTRAKETQUA: tryGet(d, 'THOIGIANTRAKETQUA'),
                        _sheetDateFields: allResults.length < 2 ? sheetDateFields : undefined,
                        _detailDateFields: allResults.length < 2 ? detailDateFields : undefined,
                        _detailRawKeys: allResults.length === 0 ? Object.keys(d) : undefined,
                        _sheetRawKeys: allResults.length === 0 ? Object.keys(sheet) : undefined
                    });
                }
            }

            debugLog(`[API-Bridge] BHYT Times: ${sheetRows.length} sheets → ${allResults.length} glucose tests for ${patientName}`);
            sendResult('FETCH_BHYT_TIMES_RESULT', rowId, { sheets: allResults, patientName, sheetCount: sheetRows.length }, requestId);

        } catch (err) {
            console.error('[API-Bridge] fetchBhytTimes error:', err);
            sendResult('FETCH_BHYT_TIMES_RESULT', rowId, { sheets: [], patientName: '' }, requestId);
        }
    }

    function triggerPtttPrint(rowId) {
        try {
            if (!_$) return;
            const { grid, effectiveRowId } = resolveActiveGrid(rowId);
            if (!grid || !effectiveRowId) return;

            // 1. Select patient first
            grid.jqGrid('setSelection', effectiveRowId);

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
        } catch (e) {
            console.error('[Aladinn API-Bridge] Error in triggerPtttPrint:', e);
        }
    }

    // Explicit initialization signal — [P1-SEC-006] include nonce
    window.postMessage({ type: 'FROM_PAGE_SCRIPT', status: 'ready', nonce: ALADINN_NONCE }, window.location.origin);
})();
