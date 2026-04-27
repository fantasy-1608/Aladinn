/**
 * VNPT HIS Smart Scanner v4.0.1
 * Hoi Chan (Consultation) Iframe Helper
 * 
 * Được inject động vào iframe của form "Tạo biên bản hội chẩn" (NTU02D008_BienBanHoiChuan).
 * Pattern giống history-iframe-helper.js — nhận message + mapping → setVal().
 */

(function () {
    'use strict';
    var PARENT_ORIGIN = '*';
    var $ = window.jQuery || window.$;

    if (window._vnptHoiChanHandler) {
        window.removeEventListener('message', window._vnptHoiChanHandler);
    }

    window._vnptHoiChanHandler = function (event) {
        if (event.source !== window.parent && event.source !== window.top) return;
        if (!event.data || event.data.type !== 'HOICHAN_FILL_FORM') return;

        try {
            var d = event.data;
            var mapping = d.mapping || {};
            var data = d.clinicalData || {};
            var inputsFilled = 0;

            for (var key in mapping) {
                var fieldIdStr = mapping[key];
                var val = data[key];

                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    if (setVal(fieldIdStr, val)) {
                        inputsFilled++;
                    }
                }
            }

            console.log('[HoiChan Iframe] Đã điền ' + inputsFilled + ' trường.');

            if (inputsFilled > 0) {
                sendResponse(true, inputsFilled);
            } else {
                sendResponse(false, 0, 'Không tìm thấy trường nào để điền. Form có thể chưa load xong.');
            }
        } catch (e) {
            console.error('[HoiChan Iframe] Error:', e);
            sendResponse(false, 0, e.message);
        }
    };

    window.addEventListener('message', window._vnptHoiChanHandler);
    console.log('[Aladinn/HoiChan] Iframe helper injected and listening.');

    // DEBUG: Dump tất cả textarea + input IDs trong iframe để tìm đúng field
    var allFields = document.querySelectorAll('textarea, input[type="text"], input[type="hidden"], select');
    var fieldMap = {};
    for (var fi = 0; fi < allFields.length; fi++) {
        var fel = allFields[fi];
        var fid = fel.id || fel.name || ('(no-id-idx-' + fi + ')');
        var fval = (fel.value || '').substring(0, 80);
        fieldMap[fid] = { tag: fel.tagName, type: fel.type || '', val: fval };
    }
    console.log('[HoiChan Iframe] ALL FORM FIELDS:', JSON.stringify(fieldMap, null, 2));

    if (window.parent !== window) {
        window.parent.postMessage({ type: 'HOICHAN_HELPER_READY' }, PARENT_ORIGIN);
    }

    /**
     * Tìm element bằng danh sách ID (pipe-separated) + fallback label search.
     * @param {string} fieldIdStr - Pipe-separated list of possible IDs
     * @returns {{el: HTMLElement, targetId: string} | null}
     */
    function getFieldElement(fieldIdStr) {
        if (!fieldIdStr) return null;
        var ids = fieldIdStr.split('|');

        for (var i = 0; i < ids.length; i++) {
            var currId = ids[i];
            var el = document.getElementById(currId) || document.querySelector('[name="' + currId + '"]');
            if (el) return { el: el, targetId: currId };
        }
        return null;
    }

    /**
     * Set giá trị cho field và trigger change events.
     * @param {string} fieldIdStr
     * @param {string} val
     * @returns {boolean}
     */
    function setVal(fieldIdStr, val) {
        if (val === undefined || val === null) return false;
        var found = getFieldElement(fieldIdStr);

        if (!found) {
            console.warn('[HoiChan Iframe] Field NOT FOUND:', fieldIdStr, '| value:', String(val).substring(0, 50));
            return false;
        }

        var el = found.el;
        el.removeAttribute('disabled');
        el.removeAttribute('readonly');
        el.value = val;

        if ($) {
            $(el).trigger('change').trigger('input');
        } else {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }

        console.log('[HoiChan] Đã điền:', found.targetId, '->', String(val).substring(0, 60));
        return true;
    }

    function sendResponse(success, filledCount, error) {
        var target = window.parent || window.top;
        if (target) {
            target.postMessage({
                type: 'HOICHAN_FILL_RESULT',
                success: success,
                filledCount: filledCount || 0,
                error: error || ''
            }, PARENT_ORIGIN);
        }
    }
})();
