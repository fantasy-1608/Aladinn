/**
 * VNPT HIS Smart Scanner v4.0.1
 * Chuyen Vien (Transfer) Iframe Helper
 * 
 * Được inject động vào iframe của form "Chuyển viện" (NGT02K009_Chuyenvien).
 * Pattern giống history-iframe-helper.js — nhận message + mapping → setVal().
 */

(function () {
    'use strict';
    var PARENT_ORIGIN = window.location.origin;
    var $ = window.jQuery || window.$;

    if (window._vnptChuyenVienHandler) {
        window.removeEventListener('message', window._vnptChuyenVienHandler);
    }

    window._vnptChuyenVienHandler = async function (event) {
        if (event.source !== window.parent && event.source !== window.top) return;
        if (!event.data || event.data.type !== 'CHUYENVIEN_FILL_FORM') return;

        // Bỏ qua nếu chạy trong môi trường Content Script sandbox của Chrome để tránh xung đột với Injected Script
        var isContentScript = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
        if (isContentScript) return;

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
            console.log('[ChuyenVien Iframe] Error:', e);
            sendResponse(false, 0, e.message);
        }
    };

    window.addEventListener('message', window._vnptChuyenVienHandler);
    console.log('[Aladinn/ChuyenVien] Iframe helper injected and listening.');

    if (window.parent !== window) {
        window.parent.postMessage({ type: 'CHUYENVIEN_HELPER_READY' }, PARENT_ORIGIN);
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
    
    var broadcastContext = function() {
        const el1 = document.getElementById('txtLydochuyentuyen') || document.getElementById('txtDAUHIEULAMSANG') || document.getElementById('txtTINHTRANGNGUOIBENH');
        const el2 = document.getElementById('txtTENTUYENDUOI');
        const el3 = document.getElementById('cboTuyenDuoi');
        const isVisible = (el) => el && el.offsetWidth > 0 && el.offsetHeight > 0;
        
        if (!isVisible(el1) && !isVisible(el2) && !isVisible(el3)) return;
        
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ type: 'CONTEXT_CHANGED', context: 'TRANSFER' }).catch(function(){});
        }
    };
    
    window.addEventListener('focus', broadcastContext);
    document.addEventListener('click', broadcastContext);
    
    // Self-healing context broadcast every 1.5s
    setInterval(function() { if (!document.hidden) broadcastContext(); }, 1500);
})();
