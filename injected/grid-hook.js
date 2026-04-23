/**
 * jqGrid Hook
 * Detects patient selection and broadcasts row data to the extension.
 * SECURITY: Includes per-session nonce in postMessage for verification.
 */
(function () {
    // SECURITY: Read nonce from data attribute (set by content.js)
    const _NONCE = document.currentScript?.dataset?.aladinnNonce || '';
    const _$ = window['$'] || window['jQuery'];
    if (!_$ || typeof _$.fn.jqGrid !== 'function') return;

    const examDataCache = new Map();

    function setupJqGridHook() {
        const checkGrid = setInterval(() => {
            const grid = _$('#grdBenhNhan');
            if (grid.length && grid.jqGrid) {
                clearInterval(checkGrid);

                grid.on('jqGridSelectRow', function (e, rowId, status) {
                    if (status && rowId) autoFetchExamData(rowId);
                });

                grid.on('click', 'tr[id]', function () {
                    const rowId = _$(this).attr('id');
                    if (rowId && rowId !== 'grdBenhNhan_h') autoFetchExamData(rowId);
                });
            }
        }, 800);
        setTimeout(() => clearInterval(checkGrid), 30000);
    }

    function autoFetchExamData(rowId) {
        if (examDataCache.has(rowId)) {
            broadcast(rowId, examDataCache.get(rowId));
            return;
        }

        try {
            const rowData = _$('#grdBenhNhan').jqGrid('getRowData', rowId);
            const examData = {
                patientId: rowId,
                hoTen: rowData.HOTEN || rowData.HoTen || '',
                ngaySinh: rowData.NGAYSINH || rowData.NgaySinh || '',
                maBA: rowData.MABENHAN || rowData.MaBenhAn || '',
                maDT: rowData.MADIEUTRI || rowData.MaDieuTri || '',
                hoSoBenhAnId: rowData.HOSOBENHANID || rowData.HSBAID || ''
            };
            examDataCache.set(rowId, examData);
            broadcast(rowId, examData);
        } catch (e) {
            console.error('[VNPT] Hook Error:', e);
        }
    }

    function broadcast(rowId, data) {
        window.postMessage({
            type: 'VNPT_EXAM_DATA_READY',
            nonce: _NONCE,
            patientId: rowId,
            data: data
        }, window.location.origin);
    }

    setupJqGridHook();
})();
