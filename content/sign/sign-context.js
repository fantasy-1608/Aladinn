window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.Context = (function () {
    'use strict';

    function _findInShadowRoots(selector) {
        const el = document.querySelector(selector);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;

        const allElements = document.querySelectorAll('*');
        for (const host of allElements) {
            if (host.shadowRoot) {
                const shadowEl = host.shadowRoot.querySelector(selector);
                if (shadowEl && shadowEl.offsetWidth > 0 && shadowEl.offsetHeight > 0) return shadowEl;
            }
        }
        return null;
    }

    function _findAllInShadowRoots(selector) {
        let results = [];
        const els = document.querySelectorAll(selector);
        for (const el of els) {
            if (el.offsetWidth > 0 && el.offsetHeight > 0) results.push(el);
        }
        
        const allElements = document.querySelectorAll('*');
        for (const host of allElements) {
            if (host.shadowRoot) {
                const shadowEls = host.shadowRoot.querySelectorAll(selector);
                for (const el of shadowEls) {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0) results.push(el);
                }
            }
        }
        return results;
    }

    function collect(targetType) {
        const context = {
            pageType: 'UNKNOWN',
            hasAmbiguousSignerSelect: false,
            hasUnselectedSignerSelect: false,
            hasErrorText: false,
            candidateButtonsCount: 0,
            visiblePatientName: null,
            visibleSignerName: null,
            docId: null
        };

        if (targetType === 'smartCAConfirm') {
            const confirmBtn = _findInShadowRoots('#btnConfirm');
            if (confirmBtn) {
                const container = confirmBtn.closest('.modal-content, .modal-dialog, body');
                if (container) {
                    context.pageType = 'SMARTCA_CONFIRM';
                    
                    const selects = container.querySelectorAll('select');
                    let visibleCount = 0;
                    for (const el of selects) {
                        if (el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled) {
                            visibleCount++;
                            const text = el.options[el.selectedIndex]?.text || '';
                            if (!el.value || el.value === '0' || text.toLowerCase().includes('lựa chọn') || text.includes('--')) {
                                context.hasUnselectedSignerSelect = true;
                            }
                        }
                    }
                    if (visibleCount > 1) {
                        context.hasAmbiguousSignerSelect = true;
                    }

                    const errorWords = ['lỗi', 'thất bại', 'không hợp lệ', 'hết hạn', 'sai mã pin'];
                    const containerText = container.textContent.toLowerCase();
                    if (errorWords.some(w => containerText.includes(w))) {
                        context.hasErrorText = true;
                    }

                    context.candidateButtonsCount = _findAllInShadowRoots('#btnConfirm').length;
                }
            }
        } else if (targetType === 'hisSuccessOk') {
            const alertifyModal = document.querySelector('.alertify');
            if (alertifyModal) {
                const okBtn = alertifyModal.querySelector('#alertify-ok') || alertifyModal.querySelector('.alertify-button-ok');
                if (okBtn) {
                    context.pageType = 'HIS_SUCCESS_DIALOG';
                    
                    const errorWords = ['thất bại', 'lỗi', 'không thành công', 'error'];
                    const modalText = alertifyModal.textContent.toLowerCase();
                    if (errorWords.some(w => modalText.includes(w))) {
                        context.hasErrorText = true;
                    }

                    const buttons = alertifyModal.querySelectorAll('#alertify-ok, .alertify-button-ok');
                    context.candidateButtonsCount = Array.from(buttons).filter(b => b.offsetWidth > 0 && b.offsetHeight > 0).length;
                }
            }
        }

        return context;
    }

    return {
        collect,
        findInShadowRoots: _findInShadowRoots
    };
})();
console.log('[Aladinn] 🧞 Sign Context loaded');
