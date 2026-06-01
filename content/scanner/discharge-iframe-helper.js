/**
 * VNPT HIS Smart Scanner v4.0.1
 * Discharge/Disposition (Xử trí) Iframe Helper
 * 
 * Được inject động vào iframe của form "Xử trí khoa" (dlgXuTriifmView).
 * Thực hiện:
 * 1. Xác thực trùng khớp ngữ cảnh bệnh nhân (Fail-Closed).
 * 2. Điền mã và tên Bệnh chính (ICD).
 * 3. Điền mã và tên Bệnh kèm theo (ICD).
 * 4. Điền thời gian "Ra khoa lúc" từ tờ điều trị mới nhất.
 */

(function () {
    'use strict';
    var PARENT_ORIGIN = window.location.origin;
    var $ = window.jQuery || window.$;

    if (window._vnptXuTriHandler) {
        window.removeEventListener('message', window._vnptXuTriHandler);
    }

    window._vnptXuTriHandler = async function (event) {
        if (event.source !== window.parent && event.source !== window.top) return;
        if (!event.data || event.data.type !== 'XUTRI_FILL_FORM') return;

        // Bỏ qua nếu chạy trong môi trường Content Script sandbox của Chrome để tránh xung đột với Injected Script
        var isContentScript = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
        if (isContentScript) return;

        try {
            // ==========================================
            // Patient Identity Security Guard (Fail-Closed)
            // ==========================================
            if (event.data.contextToken) {
                var expectedName = event.data.expectedPatientName || '';
                var patientNameEl = document.getElementById('txtTENBENHNHAN') || document.getElementById('txtHoTen') || document.querySelector('input[name="TENBENHNHAN"]') || document.querySelector('input[name="HOTEN"]');
                if (patientNameEl && expectedName) {
                    var nameOnForm = (patientNameEl.value || patientNameEl.textContent || '').trim().toUpperCase();
                    var nameExpected = expectedName.trim().toUpperCase();
                    if (nameOnForm && nameExpected && nameOnForm.indexOf(nameExpected) === -1 && nameExpected.indexOf(nameOnForm) === -1) {
                        console.error('[VNPT-Helper-XuTri] BLOCK FILL: Mismatch detected! Form name:', nameOnForm, 'Expected:', nameExpected);
                        sendResponse(false, 0, 'FORM_CONTEXT_MISMATCH');
                        return;
                    }
                }


                // Ghi chú: Record ID check đã bị loại bỏ vì contextToken.rowId 
                // là index hàng grid (VD: 1), không phải mã bệnh nhân (VD: 26037105).
                // Xác minh tên bệnh nhân ở trên (dòng 32-40) đã đủ để đảm bảo an toàn.
            }

            var d = event.data;
            var data = d.clinicalData || {};
            var inputsFilled = 0;

            console.log('[XuTri Iframe] Bắt đầu điền dữ liệu:', JSON.stringify(data));

            // ==========================================
            // 1. Điền Bệnh Chính (ICD + Tên)
            // ==========================================
            if (data.mainDiag) {
                var mainCode = data.mainDiag.code;
                var mainText = data.mainDiag.text;
                
                // Điền mã vào Combogrid
                if (window.VNPT_TypingEffect) {
                    window.VNPT_TypingEffect.setComboGrid('txtTKCHANDOANRAVIENID', mainCode);
                } else {
                    console.error('VNPT_TypingEffect is missing');
                }
                
                // Đảm bảo Option tương ứng có mặt trong Select dropdown của HIS
                var selectEl = document.getElementById('cboCHANDOANRAVIENID');
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
                    if (window.$) {
                        window.$(selectEl).trigger('change');
                    } else {
                        selectEl.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                }
                inputsFilled += 2;
            }

            // ==========================================
            // 2. Điền Bệnh Kèm Theo (ICD + Tên)
            // ==========================================
            if (data.subDiag) {
                // Điền toàn bộ chuỗi chẩn đoán kèm theo đầy đủ (gồm cả mã và tên) vào ô textarea
                var subDiagText = data.subDiag.text;
                if (data.subDiag.code && !subDiagText.includes(data.subDiag.code)) {
                    subDiagText = data.subDiag.code + '-' + subDiagText;
                }
                
                // Điền trực tiếp vào textarea Bệnh kèm theo
                if (window.VNPT_TypingEffect) {
                    await window.VNPT_TypingEffect.fillFormSequential([{ id: 'txtCHANDOANRAVIEN_KEMTHEO', val: subDiagText }], true);
                }
                inputsFilled += 2;
            }

            // ==========================================
            // 3. Điền Ra Khoa Lúc (Datepicker / Text)
            // ==========================================
            if (data.ngayRaKhoa) {
                var cleanDate = data.ngayRaKhoa.replace(/\s*\(Đang\s+soạn\s+thảo\)/gi, '').trim();
                var dpFilled = false;
                
                var dpEls = [];
                if (window.VNPT_TypingEffect) {
                    dpEls = window.VNPT_TypingEffect.getFieldElements('txtTHOIGIANKETTHUC|datepicker_NGAYRAKHOA|txtNGAYRAKHOA');
                }
                if (dpEls.length > 0) {
                    for (var i = 0; i < dpEls.length; i++) {
                        if (setDatepickerVal(dpEls[i], cleanDate)) {
                            dpFilled = true;
                        }
                    }
                }
                
                // Fallback: Quét nhãn "Ra khoa lúc"
                if (!dpFilled) {
                    var fallbackEl = findDatepickerByLabel();
                    if (fallbackEl) {
                        console.log('[XuTri Iframe] Tìm thấy datepicker qua nhãn "Ra khoa lúc"');
                        dpFilled = setDatepickerVal(fallbackEl, cleanDate);
                    }
                }

                if (dpFilled) {
                    inputsFilled++;
                } else {
                    console.warn('[XuTri Iframe] Không tìm thấy trường "Ra khoa lúc" để điền.');
                }
            }

            console.log('[XuTri Iframe] Hoàn thành điền ' + inputsFilled + ' trường.');

            if (inputsFilled > 0) {
                sendResponse(true, inputsFilled);
            } else {
                sendResponse(false, 0, 'Không điền được trường nào. Vui lòng kiểm tra lại cấu trúc form.');
            }

        } catch (e) {
            console.error('[XuTri Iframe] Lỗi khi điền form:', e);
            sendResponse(false, 0, e.message);
        }
    };

    window.addEventListener('message', window._vnptXuTriHandler);
    console.log('[Aladinn/XuTri] Iframe helper injected and listening.');

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
        console.log('[XuTri Iframe] ALL FORM FIELDS:', JSON.stringify(fieldMap, null, 2));
    } catch (_err) {}

    if (window.parent !== window) {
        window.parent.postMessage({ type: 'XUTRI_HELPER_READY' }, PARENT_ORIGIN);
    }

    // ==========================================
    // UTILITY FUNCTIONS
    // ==========================================

    // Removed unused getFieldElements, setVal, setComboGrid

    function setDatepickerVal(el, val) {
        if (!el || !val) return false;
        el.removeAttribute('disabled');
        el.removeAttribute('readonly');
        el.value = val;

        if ($) {
            try {
                $(el).datepicker('setDate', val);
            } catch (_e) {}
            $(el).trigger('change').trigger('input');
        } else {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }

        console.log('[XuTri Iframe] Set datepicker field:', el.id || 'unnamed', '->', val);
        return true;
    }

    function findDatepickerByLabel() {
        var labels = document.querySelectorAll('label, td, span, div');
        for (var i = 0; i < labels.length; i++) {
            var text = labels[i].innerText || labels[i].textContent || '';
            if (text.toLowerCase().indexOf('ra khoa lúc') !== -1) {
                var container = labels[i].closest('tr') || labels[i].closest('.form-group') || labels[i].parentElement;
                if (container) {
                    var inputs = container.querySelectorAll('input[type="text"]');
                    if (inputs.length > 0) {
                        return inputs[0];
                    }
                }
            }
        }
        return null;
    }

    function sendResponse(success, filledCount, error) {
        var target = window.parent || window.top;
        if (target) {
            target.postMessage({
                type: 'XUTRI_FILL_RESULT',
                success: success,
                filledCount: filledCount || 0,
                error: error || ''
            }, PARENT_ORIGIN);
        }
    }
})();
