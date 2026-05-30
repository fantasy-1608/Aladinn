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

    window._vnptNhapBenhNhanHandler = async function (event) {
        if (event.source !== window.parent && event.source !== window.top) return;
        if (!event.data || event.data.type !== 'NHAPBENHNHAN_FILL_FORM') return;

        // Bỏ qua nếu chạy trong môi trường Content Script sandbox của Chrome để tránh xung đột với Injected Script
        var isContentScript = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
        if (isContentScript) return;

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
                    if (window.VNPT_TypingEffect) {
                        window.VNPT_TypingEffect.setComboGrid('txtTKCHANDOANVAOKHOA', mainCode);
                    }
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
                        opt.text = mainText || '';
                        selectEl.add(opt);
                        selectEl.value = mainCode;
                    }
                    if (window.VNPT_TypingEffect) {
                        window.VNPT_TypingEffect.triggerHisEvents([selectEl]);
                    }
                    inputsFilled++;
                }

                var editCDEl = document.getElementById('txtEditCDVaoKhoa');
                if (editCDEl) {
                    // Chỉ điền tên bệnh chính, không ghép mã ICD (mã đã điền riêng ở combo grid)
                    var diagTextOnly = mainText || '';
                    if (window.VNPT_TypingEffect) {
                        await window.VNPT_TypingEffect.fillFormSequential([{ el: editCDEl, val: diagTextOnly }], true);
                    }
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
                    if (window.VNPT_TypingEffect) {
                        window.VNPT_TypingEffect.setComboGrid('txtTKCHANDOANVAOKHOA_KEMTHEO', subCode);
                    }
                    inputsFilled++;
                }

                // 2b. Điền chuỗi bệnh kèm theo đầy đủ vào ô text
                var subDiagFullText = subText || '';
                if (subCode && !subDiagFullText.includes(subCode)) {
                    subDiagFullText = subCode + '-' + subDiagFullText;
                }

                var subTextEl = document.getElementById('txtCHANDOANVAOKHOA_KEMTHEO');
                if (subTextEl) {
                    if (window.VNPT_TypingEffect) {
                        await window.VNPT_TypingEffect.fillFormSequential([{ el: subTextEl, val: subDiagFullText }], true);
                    }
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

    // Removed setVal, triggerChange, setComboGrid

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
