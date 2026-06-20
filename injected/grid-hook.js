/**
 * jqGrid Hook
 * Detects patient selection and broadcasts row data to the extension.
 * SECURITY: Includes per-session nonce in postMessage for verification.
 */
(function () {
    // SECURITY: Read nonce from data attribute (set by content.js)
    const _NONCE = document.currentScript?.dataset?.aladinnNonce || '';

    const examDataCache = new Map();

    function setupJqGridHook() {
        const checkGrid = setInterval(() => {
            const _$ = window['$'] || window['jQuery'];
            if (_$ && typeof _$.fn.jqGrid === 'function') {
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
            }
        }, 800);
        setTimeout(() => clearInterval(checkGrid), 30000);
    }

    // Listen to context menu actions dispatched from the content script (native context menus)
    window.addEventListener('message', function (event) {
        if (event.origin !== window.location.origin) return;
        if (event.data && event.data.type === 'ALADINN_PAGE_CONTEXT_MENU_CLICK') {
            const { action, rowId } = event.data;
            if (window.location.href.toLowerCase().includes('ntu02d021_buongdieutri')) {
                executeInpatientAction(action, rowId);
            }
        }
    });

    function executeInpatientAction(action, rowId) {
        const DlgUtil = window.DlgUtil;
        const jsonrpc = window.jsonrpc;
        if (!DlgUtil) {
            console.error('[Aladinn] DlgUtil not found');
            return;
        }

        const _$ = window['$'] || window['jQuery'];
        if (!_$ || typeof _$.fn.jqGrid !== 'function') {
            console.error('[Aladinn] jQuery or jqGrid not found');
            return;
        }

        const rowData = _$('#grdBenhNhan').jqGrid('getRowData', rowId);
        if (!rowData) return;

        // Common variables mapped to Inpatient
        const deptId = window.dept_id || _$('#txtGLBDEPTID').val() || '';
        const hospitalId = window.hospital_id || (window.userInfo && window.userInfo.HOSPITAL_ID) || '';
        const hoTen = rowData.HOTEN || rowData.HoTen || '';
        const maBA = rowData.MABENHAN || rowData.MaBenhAn || '';
        const thongtinbn = maBA ? (maBA + '/ ' + hoTen) : hoTen;
        const khambenhid = rowData.KHAMBENHID || rowData.Khambenhid || rowData.MADIEUTRI || rowData.MaDieuTri || '';
        const hosobenhanid = rowData.HOSOBENHANID || rowData.Hosobenhanid || rowData.HSBAID || '';
        const benhnhanid = rowData.BENHNHANID || rowData.Benhnhanid || '';
        const tiepnhanid = rowData.TIEPNHANID || rowData.Tiepnhanid || '';
        const trangthaikhambenh = rowData.TRANGTHAIKHAMBENH || '';

        try {
            if (action === 'editHC') {
                if (trangthaikhambenh === '9') {
                    DlgUtil.showMsg('Bệnh án đã đóng');
                    return;
                }
                const paramInput = {
                    mode: '1',
                    khambenhid: khambenhid,
                    hosobenhanid: hosobenhanid,
                    benhnhanid: benhnhanid,
                    tiepnhanid: tiepnhanid,
                    type: 3, // Inpatient
                    submode: '2',
                    deptid: deptId,
                    trangthaikhambenh: trangthaikhambenh
                };
                DlgUtil.buildPopupUrl('divDlgNhapBenhNhan', 'divDlg', 'manager.jsp?func=../noitru/NTU01H002_NhapBenhNhan', paramInput, 'HIS-Cập nhật bệnh nhân (' + thongtinbn + ')',
                    window.innerWidth * 0.95, window.innerHeight * 0.95);
                DlgUtil.open('divDlgNhapBenhNhan');

            } else if (action === 'updateTT') {
                if (trangthaikhambenh === '9') {
                    DlgUtil.showMsg('Bệnh án đã đóng');
                    return;
                }
                const paramInput = {
                    tiepnhanid: tiepnhanid,
                    khambenhid: khambenhid
                };
                DlgUtil.buildPopupUrl('divDlgSuaBenhNhan', 'divDlg', 'manager.jsp?func=../noitru/NTU01H020_ThongTinBenhNhan', paramInput, 'HIS - Cập nhật bệnh nhân (' + thongtinbn + ')', 1100, 580);
                DlgUtil.open('divDlgSuaBenhNhan');

            } else if (action === 'viewBN') {
                const paramInput = {
                    mode: '1',
                    khambenhid: khambenhid,
                    hosobenhanid: hosobenhanid,
                    benhnhanid: benhnhanid,
                    tiepnhanid: tiepnhanid,
                    type: 3,
                    trangthaikhambenh: trangthaikhambenh
                };
                DlgUtil.buildPopupUrl('divDlgNhapBenhNhan', 'divDlg', 'manager.jsp?func=../noitru/NTU01H002_NhapBenhNhan', paramInput, 'HIS-Cập nhật bệnh nhân (' + thongtinbn + ')',
                    window.innerWidth * 0.95, window.innerHeight * 0.95);
                DlgUtil.open('divDlgNhapBenhNhan');

            } else if (action === 'openBA') {
                if (trangthaikhambenh === '9') {
                    DlgUtil.showMsg('Đã kết thúc bệnh nhân. Không thể mở lại bệnh án');
                    return;
                }
                if (trangthaikhambenh === '1' && hospitalId == 10284) {
                    DlgUtil.showMsg('Bệnh nhân chờ nhập khoa. Không thể mở lại bệnh án');
                    return;
                }
                if (jsonrpc) {
                    const PHC_USER_GROUP_MOLAIBA = jsonrpc.AjaxJson.ajaxCALL_SP_S('COM.CAUHINH', 'PHC_USER_GROUP_MOLAIBA') || '0';
                    if (PHC_USER_GROUP_MOLAIBA !== '0') {
                        const group_id = jsonrpc.AjaxJson.getOneValue('GET_USER_GROUP_ID', []);
                        if (!PHC_USER_GROUP_MOLAIBA.includes(group_id + ',')) {
                            DlgUtil.showMsg('Bạn không có quyền mở lại bệnh án cho khoa!');
                            return;
                        }
                    }
                }
                const paramInput = {
                    mode: '1',
                    khambenhid: khambenhid,
                    hosobenhanid: hosobenhanid,
                    benhnhanid: benhnhanid,
                    tiepnhanid: tiepnhanid,
                    type: 3
                };
                DlgUtil.buildPopupUrl('divDlgMoBenhAn', 'divDlg', 'manager.jsp?func=../noitru/NTU01H023_MoBenhAnKhoa', paramInput, 'HIS-Mở bệnh án (' + thongtinbn + ')', 650, 200);
                DlgUtil.open('divDlgMoBenhAn');

            } else if (action === 'lsTheoCongBHYT') {
                const paramInput = {
                    MABHYT: rowData.MA_BHYT || rowData.MABHYT || '',
                    TENBENHNHAN: rowData.TENBENHNHAN || rowData.HOTEN || rowData.HoTen || '',
                    NGAYSINH: _$('#hidNGAYSINH').val() || rowData.NGAYSINH || rowData.NgaySinh || '',
                    QRCODE: '',
                    GIOITINH: _$('#hidGIOITINH').val() || '',
                    MAKCBBD: rowData.MA_KCBBD || rowData.MAKCBBD || 'null'
                };
                DlgUtil.buildPopupUrl('divDlgDDT', 'divDlg', 'manager.jsp?func=../ngoaitru/NGT02K047_LichSuKCB', paramInput, 'Thông tin lịch sử điều trị bệnh nhân (' + thongtinbn + ')',
                    window.innerWidth * 0.95, window.innerHeight * 0.93);
                DlgUtil.open('divDlgDDT');

            } else if (action === 'callbackBN') {
                if (jsonrpc) {
                    const result_dt = jsonrpc.AjaxJson.ajaxCALL_SP_I('NTU01H001.EV010', khambenhid);
                    if (result_dt == 1) {
                        DlgUtil.showMsg('Gọi lại bệnh nhân thành công');
                        if (typeof window.loadGridData === 'function') window.loadGridData();
                    } else if (result_dt == 2) {
                        DlgUtil.showMsg('Không thể gọi lại bệnh nhân ở trạng thái này');
                    } else if (result_dt == 3) {
                        DlgUtil.showMsg('Bệnh nhân đã tiếp nhận. Không thể gọi lại');
                    } else {
                        DlgUtil.showMsg('Gọi lại bệnh nhân không thành công');
                    }
                }

            } else if (action === 'closeBA') {
                if (trangthaikhambenh === '9') {
                    DlgUtil.showMsg('Đã kết thúc bệnh nhân. Không thể đóng lại bệnh án');
                    return;
                }
                if (jsonrpc) {
                    const _par = [ khambenhid, deptId ];
                    const result = jsonrpc.AjaxJson.ajaxCALL_SP_I('NTU01H001.EV013', _par.join('$'));
                    if (result == '1') {
                        DlgUtil.showMsg('Đóng bệnh án khoa thành công');
                        if (typeof window.loadGridData === 'function') window.loadGridData();
                    } else if (result == '2') {
                        DlgUtil.showMsg('Bệnh nhân không phải ở trạng thái đang điều trị, không thể đóng bệnh án');
                    } else if (result == '3') {
                        DlgUtil.showMsg('Bệnh nhân không xử trí chuyển khoa, không thể đóng');
                    } else if (result == '4') {
                        DlgUtil.showMsg('Không thể đóng bệnh án yêu cầu mở cho bệnh nhân này');
                    } else {
                        DlgUtil.showMsg('Đóng bệnh án không thành công');
                    }
                }
            }
        } catch (e) {
            console.error('[Aladinn] Inpatient Action Error:', e);
            DlgUtil.showMsg('Có lỗi xảy ra: ' + e.message);
        }
    }

    function autoFetchExamData(rowId) {
        if (examDataCache.has(rowId)) {
            broadcast(rowId, examDataCache.get(rowId));
            return;
        }

        try {
            const _$ = window['$'] || window['jQuery'];
            if (!_$ || typeof _$.fn.jqGrid !== 'function') return;
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
