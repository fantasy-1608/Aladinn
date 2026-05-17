/**
 * VNPT HIS Smart Scanner v4.0.1
 * History Iframe Helper
 * 
 * Inject vào iframe chứa form "Tạo Bệnh án".
 */
(function () {
    'use strict';
    var PARENT_ORIGIN = '*';
    var _$ = window.jQuery || window.$;

    if (window._vnptHistoryHandler) {
        window.removeEventListener('message', window._vnptHistoryHandler);
    }

    // Shortcut inside iframe
    window.addEventListener('keydown', function (e) {
        var isL = e.key === 'L' || e.key === 'l';
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && isL) {
            window.VNPT_LogFormFields();
        }
    });

    window._vnptHistoryHandler = function (event) {
        if (event.source !== window.top) return;
        if (!event.data) return;

        if (event.data.type === 'LOG_FIELDS') {
            window.VNPT_LogFormFields();
            return;
        }

        if (event.data.type !== 'HISTORY_FILL_FORM') return;

        try {
            if (event.data.contextToken) {
                var expectedName = event.data.expectedPatientName || '';
                var patientNameEl = document.getElementById('txtTENBENHNHAN') || document.getElementById('txtHoTen') || document.querySelector('input[name="TENBENHNHAN"]') || document.querySelector('input[name="HOTEN"]');
                if (patientNameEl && expectedName) {
                    var nameOnForm = (patientNameEl.value || patientNameEl.textContent || '').trim().toUpperCase();
                    var nameExpected = expectedName.trim().toUpperCase();
                    if (nameOnForm && nameExpected && nameOnForm.indexOf(nameExpected) === -1 && nameExpected.indexOf(nameOnForm) === -1) {
                        console.error('[VNPT-Helper] BLOCK FILL: Mismatch detected! Form name:', nameOnForm, 'Expected:', nameExpected);
                        sendResponse(false, 'FORM_CONTEXT_MISMATCH');
                        return;
                    }
                }

                var expectedRecordId = event.data.contextToken ? event.data.contextToken.rowId : '';
                var recordIdEl = document.getElementById('txtMABENHNHAN') || document.getElementById('txtMAVAOVIEN');
                if (recordIdEl && expectedRecordId) {
                    var idOnForm = (recordIdEl.value || recordIdEl.textContent || '').trim();
                    // So sánh lỏng hơn một chút: if idOnForm exists and does not include expectedRecordId or vice versa
                    if (idOnForm && expectedRecordId && idOnForm !== expectedRecordId) {
                        // Do mã trên form và rowId có thể khác loại (MABENHNHAN vs MAVAOVIEN), chúng ta chỉ warn nếu thực sự có thông tin nhưng hoàn toàn không khớp. 
                        // Tạm thời log warning thay vì block cứng nếu không chắc chắn 100%, nhưng tên BN thì block cứng.
                        console.warn('[VNPT-Helper] Mismatch ID detected (Warn only): Form ID:', idOnForm, 'Expected:', expectedRecordId);
                    }
                }
            }

            var data = event.data.history || {};

            // Log ALL IDs for mapping help if needed
            console.log('[VNPT-Helper] Mapping data to form...', data);

            // Mapping strategy: 
            // 1. Try to find by known HIS IDs (if we had them)
            // 2. Try to find by common names or labels (harder in this UI)
            // 3. Use the mapping provided in the message

            var mapping = event.data.mapping || {};
            var defaultMsg = event.data.defaultMsg || 'Chưa ghi nhận bất thường';

            // Các trường chuyên khoa cần điền mặc định nếu trống (Lấy từ caller)
            var specializedFields = event.data.specializedFields || [];

            var _promises = [];
            for (var key in mapping) {
                var fieldId = mapping[key];
                var val = data[key];

                // Nếu là trường chuyên khoa và dữ liệu trống -> điền mặc định
                if (specializedFields.indexOf(fieldId) !== -1 && (!val || val.trim() === '')) {
                    val = defaultMsg;
                }

                if (val !== undefined) {
                    setVal(fieldId, val);
                }
            }

            // --- ĐIỀN CHẨN ĐOÁN VÀO KHOA BẰNG COMBOGRID ---
            if (data.mainDiag) {
                setComboGrid('txtMABENHCHINH', data.mainDiag.code);
                setVal('txtBENHCHINH', data.mainDiag.text);
            }
            if (data.subDiag) {
                setComboGrid('txtMABENHKEMTHEO', data.subDiag.code);
                setVal('txtBENHKEMTHEO', data.subDiag.text);
            }

            sendResponse(true);
        } catch (e) {
            sendResponse(false, e.message);
        }
    };

    window.addEventListener('message', window._vnptHistoryHandler);

    // Label keywords to search when field ID not found
    var LABEL_HINTS = {
        'txtTTNBRAVIEN': ['Tình trạng', 'ra viện'],
        'txtBENHLYDBLS': ['Quá trình bệnh lý', 'diễn biến lâm sàng'],
        'txtKQXNCLS': ['kết quả xét nghiệm', 'cận lâm sàng', 'giá trị chẩn đoán'],
        'txtPPDIEUTRI': ['Phương pháp điều trị'],
        'txtHDTVACDT': ['Hướng điều trị', 'chế độ tiếp theo']
    };

    function getFieldElements(fieldIdStr) {
        if (!fieldIdStr) return [];
        var ids = fieldIdStr.split('|');
        var els = [];

        for (var i = 0; i < ids.length; i++) {
            var currId = ids[i];
            var byId = document.getElementById(currId);
            if (byId && !els.includes(byId)) els.push(byId);
            
            var byName = document.querySelectorAll('[name="' + currId + '"]');
            for(var n = 0; n < byName.length; n++) {
                if (!els.includes(byName[n])) els.push(byName[n]);
            }
            if (els.length > 0) return els;
        }

        if (els.length === 0 && LABEL_HINTS[ids[0]]) {
            var hints = LABEL_HINTS[ids[0]];
            var allTextareas = document.querySelectorAll('textarea');
            for (var t = 0; t < allTextareas.length; t++) {
                var ta = allTextareas[t];
                var container = ta.closest('tr') || ta.closest('div') || ta.parentElement;
                if (!container) continue;
                var containerText = container.textContent || '';
                var prevSibling = container.previousElementSibling;
                var prevText = prevSibling ? (prevSibling.textContent || '') : '';
                var searchText = containerText + ' ' + prevText;

                var matched = hints.every(function (hint) { return searchText.includes(hint); });
                if (matched) {
                    els.push(ta);
                    return els;
                }
            }
        }
        return els;
    }

    function setComboGrid(id, code) {
        if (!code) return;
        try {
            var els = getFieldElements(id);
            for(var i = 0; i < els.length; i++) {
                var el = els[i];
                var jEl = window.$ ? window.$(el) : null;
                if (jEl && jEl.data('combogrid')) {
                    jEl.combogrid('setValue', code);
                    jEl.val(code);
                } else {
                    el.value = code;
                }
            }
        } catch(_e) {}
    }

    function setVal(fieldIdStr, val) {
        if (val === undefined || val === null) return;
        var els = getFieldElements(fieldIdStr);

        if (els.length === 0) {
            console.log('[VNPT-Helper] Field NOT FOUND:', fieldIdStr, '| value:', String(val).substring(0, 50));
            return;
        }

        for (var i = 0; i < els.length; i++) {
            var el = els[i];
            el.value = val;
            if (window.$) {
                window.$(el).trigger('change').trigger('input');
            } else {
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }
    }

    function sendResponse(success, error) {
        if (window.top) {
            window.top.postMessage({
                type: 'HISTORY_FILL_RESULT',
                success: success,
                error: error
            }, PARENT_ORIGIN);
        }
    }

    // Utility to log all form fields (for user to help mapping)
    window.VNPT_LogFormFields = function () {
        var inputs = document.querySelectorAll('input, textarea, select');
        var fields = Array.from(inputs).map(function (el) {
            return {
                id: el.id,
                name: el.name,
                placeholder: el.placeholder,
                value: el.value,
                label: el.closest('.x-form-item')?.querySelector('label')?.textContent || ''
            };
        });
        console.table(fields);
        return fields;
    };

})();
