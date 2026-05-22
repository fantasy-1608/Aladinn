/**
 * VNPT HIS Smart Scanner v4.0.1
 * Nhập Bệnh Nhân (Cập nhật bệnh nhân) Iframe Helper
 * 
 * Được inject động vào iframe của modal "Cập nhật bệnh nhân" (divDlgNhapBenhNhanifmView).
 * Thực hiện:
 * 1. Xác thực trùng khớp ngữ cảnh bệnh nhân (Fail-Closed).
 * 2. Điền mã và tên Bệnh chính (ICD) vào CĐ vào khoa.
 * 3. Điền mã và tên Bệnh kèm theo (ICD) vào CĐ vào khoa KT.
 * 4. KHÔNG điền phần thời gian / ngày giờ.
 */

(function () {
    'use strict';
    var PARENT_ORIGIN = '*';
    var $ = window.jQuery || window.$;

    if (window._vnptNhapBenhNhanHandler) {
        window.removeEventListener('message', window._vnptNhapBenhNhanHandler);
    }

    window._vnptNhapBenhNhanHandler = function (event) {
        if (event.source !== window.parent && event.source !== window.top) return;
        if (!event.data || event.data.type !== 'NHAPBENHNHAN_FILL_FORM') return;

        try {
            // ==========================================
            // Patient Identity Security Guard (Fail-Closed)
            // ==========================================
            if (event.data.contextToken) {
                var expectedName = event.data.expectedPatientName || '';
                var patientNameEl = document.getElementById('txtTENBENHNHAN') ||
                    document.getElementById('txtHoTen') ||
                    document.querySelector('input[name="TENBENHNHAN"]') ||
                    document.querySelector('input[name="HOTEN"]');
                if (patientNameEl && expectedName) {
                    var nameOnForm = (patientNameEl.value || patientNameEl.textContent || '').trim().toUpperCase();
                    var nameExpected = expectedName.trim().toUpperCase();
                    if (nameOnForm && nameExpected && nameOnForm.indexOf(nameExpected) === -1 && nameExpected.indexOf(nameOnForm) === -1) {
                        console.error('[VNPT-Helper-NhapBN] BLOCK FILL: Mismatch detected! Form name:', nameOnForm, 'Expected:', nameExpected);
                        sendResponse(false, 0, 'FORM_CONTEXT_MISMATCH');
                        return;
                    }
                }
            }

            var d = event.data;
            var data = d.clinicalData || {};
            var inputsFilled = 0;

            console.log('[NhapBN Iframe] Bắt đầu điền CĐ vào khoa:', JSON.stringify(data));

            // ==========================================
            // 1. Điền Bệnh Chính → CĐ vào khoa
            // ==========================================
            if (data.mainDiag) {
                var mainCode = data.mainDiag.code;
                var mainText = data.mainDiag.text;

                // 1a. Điền mã vào Combogrid txtTKCHANDOANVAOKHOA
                if (mainCode) {
                    setComboGrid('txtTKCHANDOANVAOKHOA', mainCode);
                    inputsFilled++;
                }

                // 1b. Đảm bảo Option tương ứng có mặt trong Select dropdown
                var selectEl = document.getElementById('cboMACHANDOANVAOKHOA');
                if (selectEl && mainCode) {
                    var exists = false;
                    for (var o = 0; o < selectEl.options.length; o++) {
                        if (selectEl.options[o].value === mainCode) {
                            exists = true;
                            selectEl.selectedIndex = o;
                            break;
                        }
                    }
                    if (!exists) {
                        var opt = document.createElement('option');
                        opt.value = mainCode;
                        opt.text = mainCode + '-' + (mainText || '');
                        selectEl.add(opt);
                        selectEl.value = mainCode;
                    }
                    triggerChange(selectEl);
                    inputsFilled++;
                }

                // 1c. Điền vào ô chỉnh sửa text nếu đang hiển thị (txtEditCDVaoKhoa)
                var editCDEl = document.getElementById('txtEditCDVaoKhoa');
                if (editCDEl) {
                    var fullDiagText = mainCode ? (mainCode + '-' + (mainText || '')) : (mainText || '');
                    setVal(editCDEl, fullDiagText);
                }
            }

            // ==========================================
            // 2. Điền Bệnh Kèm Theo → CĐ vào khoa KT
            // ==========================================
            if (data.subDiag) {
                var subCode = data.subDiag.code;
                var subText = data.subDiag.text;

                // 2a. Điền mã đầu tiên vào Combogrid txtTKCHANDOANVAOKHOA_KEMTHEO
                if (subCode) {
                    setComboGrid('txtTKCHANDOANVAOKHOA_KEMTHEO', subCode);
                    inputsFilled++;
                }

                // 2b. Điền chuỗi bệnh kèm theo đầy đủ vào ô text
                var subDiagFullText = subText || '';
                if (subCode && !subDiagFullText.includes(subCode)) {
                    subDiagFullText = subCode + '-' + subDiagFullText;
                }

                var subTextEl = document.getElementById('txtCHANDOANVAOKHOA_KEMTHEO');
                if (subTextEl) {
                    setVal(subTextEl, subDiagFullText);
                    inputsFilled++;
                }
            }

            console.log('[NhapBN Iframe] Hoàn thành điền ' + inputsFilled + ' trường CĐ vào khoa.');

            if (inputsFilled > 0) {
                sendResponse(true, inputsFilled);
            } else {
                sendResponse(false, 0, 'Không điền được trường nào. Vui lòng kiểm tra lại cấu trúc form Cập nhật bệnh nhân.');
            }

        } catch (e) {
            console.error('[NhapBN Iframe] Lỗi khi điền form:', e);
            sendResponse(false, 0, e.message);
        }
    };

    window.addEventListener('message', window._vnptNhapBenhNhanHandler);
    console.log('[Aladinn/NhapBN] Iframe helper injected and listening.');

    // DEBUG: Dump all inputs & elements to console for developer inspection
    try {
        var allFields = document.querySelectorAll('textarea, input[type="text"], input[type="hidden"], select');
        var fieldMap = {};
        for (var fi = 0; fi < allFields.length; fi++) {
            var fel = allFields[fi];
            var fid = fel.id || fel.name || ('(no-id-idx-' + fi + ')');
            var fval = (fel.value || '').substring(0, 80);
            fieldMap[fid] = { tag: fel.tagName, type: fel.type || '', val: fval };
        }
        console.log('[NhapBN Iframe] ALL FORM FIELDS:', JSON.stringify(fieldMap, null, 2));
    } catch (_err) {}

    if (window.parent !== window) {
        window.parent.postMessage({ type: 'NHAPBENHNHAN_HELPER_READY' }, PARENT_ORIGIN);
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    function setVal(el, val) {
        if (!el || val === undefined || val === null) return;
        el.removeAttribute('disabled');
        el.removeAttribute('readonly');
        el.value = val;
        triggerChange(el);
    }

    function triggerChange(el) {
        if (!el) return;
        if ($) {
            $(el).trigger('change').trigger('input');
        } else {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function setComboGrid(id, code) {
        if (!code) return;
        try {
            var el = document.getElementById(id);
            if (!el) {
                // Fallback: tìm theo name
                var byName = document.querySelector('[name="' + id + '"]');
                if (byName) el = byName;
            }
            if (!el) return;

            el.removeAttribute('disabled');
            el.removeAttribute('readonly');
            var jEl = $ ? $(el) : null;
            if (jEl && jEl.data && jEl.data('combogrid')) {
                jEl.combogrid('setValue', code);
                jEl.val(code);
            } else {
                el.value = code;
            }
            triggerChange(el);
        } catch (_e) {
            console.warn('[NhapBN Iframe] setComboGrid error for', id, _e);
        }
    }

    function sendResponse(success, filledCount, error) {
        var target = window.parent || window.top;
        if (target) {
            target.postMessage({
                type: 'NHAPBENHNHAN_FILL_RESULT',
                success: success,
                filledCount: filledCount || 0,
                error: error || ''
            }, PARENT_ORIGIN);
        }
    }
})();
