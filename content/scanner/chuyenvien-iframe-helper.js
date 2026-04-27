/**
 * VNPT HIS Smart Scanner v4.0.1
 * Chuyen Vien (Transfer) Iframe Helper
 * 
 * Được inject động vào iframe của form "Chuyển viện" (NGT02K009_Chuyenvien).
 * Pattern giống history-iframe-helper.js — nhận message + mapping → setVal().
 */

(function () {
    'use strict';
    var PARENT_ORIGIN = '*';
    var $ = window.jQuery || window.$;

    if (window._vnptChuyenVienHandler) {
        window.removeEventListener('message', window._vnptChuyenVienHandler);
    }

    window._vnptChuyenVienHandler = function (event) {
        if (event.source !== window.parent && event.source !== window.top) return;
        if (!event.data || event.data.type !== 'CHUYENVIEN_FILL_FORM') return;

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

            console.log('[ChuyenVien Iframe] Đã điền ' + inputsFilled + ' trường.');

            if (inputsFilled > 0) {
                sendResponse(true, inputsFilled);
            } else {
                sendResponse(false, 0, 'Không tìm thấy trường nào để điền. Form có thể chưa load xong.');
            }
        } catch (e) {
            console.error('[ChuyenVien Iframe] Error:', e);
            sendResponse(false, 0, e.message);
        }
    };

    window.addEventListener('message', window._vnptChuyenVienHandler);
    console.log('[Aladinn/ChuyenVien] Iframe helper injected and listening.');

    if (window.parent !== window) {
        window.parent.postMessage({ type: 'CHUYENVIEN_HELPER_READY' }, PARENT_ORIGIN);
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
            console.warn('[ChuyenVien Iframe] Field NOT FOUND:', fieldIdStr, '| value:', String(val).substring(0, 50));
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

        console.log('[ChuyenVien] Đã điền:', found.targetId, '->', String(val).substring(0, 60));
        return true;
    }

    function sendResponse(success, filledCount, error) {
        var target = window.parent || window.top;
        if (target) {
            target.postMessage({
                type: 'CHUYENVIEN_FILL_RESULT',
                success: success,
                filledCount: filledCount || 0,
                error: error || ''
            }, PARENT_ORIGIN);
        }
    }
})();
