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

    window._vnptHoiChanHandler = async function (event) {
        if (event.source !== window.parent && event.source !== window.top) return;
        if (!event.data || event.data.type !== 'HOICHAN_FILL_FORM') return;

        try {
            if (event.data.contextToken) {
                var expectedName = event.data.expectedPatientName || '';
                var patientNameEl = document.getElementById('txtTENBENHNHAN') || document.getElementById('txtHoTen') || document.querySelector('input[name="TENBENHNHAN"]') || document.querySelector('input[name="HOTEN"]');
                if (patientNameEl && expectedName) {
                    var nameOnForm = (patientNameEl.value || patientNameEl.textContent || '').trim().toUpperCase();
                    var nameExpected = expectedName.trim().toUpperCase();
                    if (nameOnForm && nameExpected && nameOnForm.indexOf(nameExpected) === -1 && nameExpected.indexOf(nameOnForm) === -1) {
                        console.error('[VNPT-Helper] BLOCK FILL: Mismatch detected! Form name:', nameOnForm, 'Expected:', nameExpected);
                        sendResponse(false, 0, 'FORM_CONTEXT_MISMATCH');
                        return;
                    }
                }


                // Record ID check removed: contextToken.rowId ≠ mã bệnh nhân trên form
            }

            var d = event.data;
            var mapping = d.mapping || {};
            var data = d.clinicalData || {};
            
            var fillQueue = [];
            for (var key in mapping) {
                var fieldIdStr = mapping[key];
                var val = data[key];

                if (val !== undefined && val !== null && String(val).trim() !== '') {
                    fillQueue.push({ id: fieldIdStr, val: val });
                }
            }

            if (window.VNPT_TypingEffect) {
                await window.VNPT_TypingEffect.fillFormSequential(fillQueue, true);
                sendResponse(true, fillQueue.length);
            } else {
                sendResponse(false, 0, 'Thư viện VNPT_TypingEffect chưa được tải.');
            }
        } catch (e) {
            console.log('[HoiChan Iframe] Error:', e);
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
