/**
 * VNPT HIS Smart Scanner v4.0.1
 * History Iframe Helper
 * 
 * Inject vào iframe chứa form "Tạo Bệnh án".
 */
(function () {
    'use strict';
    var PARENT_ORIGIN = '*';
    var $ = window.jQuery || window.$;

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

    function getFieldElement(fieldIdStr) {
        if (!fieldIdStr) return null;
        var ids = fieldIdStr.split('|');
        var el = null;
        var targetId = ids[0];

        for (var i = 0; i < ids.length; i++) {
            var currId = ids[i];
            el = document.getElementById(currId) || document.querySelector('[name="' + currId + '"]');
            if (el) return { el: el, targetId: currId };
        }

        if (!el && LABEL_HINTS[ids[0]]) {
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
                    console.log('[VNPT-Helper] Found "' + targetId + '" via label search:', ta.id || ta.name || '(no id)');
                    return { el: ta, targetId: targetId };
                }
            }
        }
        return null;
    }



    function setVal(fieldIdStr, val) {
        if (val === undefined || val === null) return;
        var found = getFieldElement(fieldIdStr);

        if (!found) {
            console.warn('[VNPT-Helper] Field NOT FOUND:', fieldIdStr, '| value:', String(val).substring(0, 50));
            var tas = document.querySelectorAll('textarea');
            var idx = [];
            for (var j = 0; j < tas.length; j++) {
                if (tas[j].id) idx.push(tas[j].id);
            }
            if (idx.length > 0) console.log('[VNPT-Helper] Available textarea IDs:', idx);
            return;
        }

        var el = found.el;
        el.value = val;
        if ($) {
            $(el).trigger('change').trigger('input');
        } else {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
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
