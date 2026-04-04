/**
 * 🧞 Aladinn — Auto-Click Helper (injected into ALL frames on vncare.vn)
 * Automatically clicks #btnConfirm and #alertify-ok when they appear.
 * Also searches inside Shadow DOMs for the buttons.
 */
(function () {
    'use strict';

    let lastConfirmClick = 0;
    let lastOkClick = 0;

    console.log('[Aladinn/AutoClick] 🔄 Helper loaded in frame:', window.location.href.substring(0, 80));

    function findInShadowRoots(selector) {
        // Search main document first
        const el = document.querySelector(selector);
        if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;

        // Search inside all shadow roots
        const allElements = document.querySelectorAll('*');
        for (const host of allElements) {
            if (host.shadowRoot) {
                const shadowEl = host.shadowRoot.querySelector(selector);
                if (shadowEl && shadowEl.offsetWidth > 0 && shadowEl.offsetHeight > 0) return shadowEl;
            }
        }
        return null;
    }

    setInterval(() => {
        const now = Date.now();

        // Auto-click #btnConfirm (e-Seal Smart CA "Xác nhận")
        if (now - lastConfirmClick > 800) {
            const confirmBtn = findInShadowRoots('#btnConfirm');
            if (confirmBtn) {
                console.log('[Aladinn/AutoClick] 🖊️ Clicking #btnConfirm');
                confirmBtn.click();
                lastConfirmClick = now;
                return;
            }
        }

        // Auto-click #alertify-ok (HIS "Đồng ý" success dialog)
        if (now - lastOkClick > 1000) {
            const okBtn = findInShadowRoots('#alertify-ok') ||
                          findInShadowRoots('.alertify-button-ok');
            if (okBtn) {
                console.log('[Aladinn/AutoClick] ✅ Clicking alertify-ok');
                okBtn.click();
                lastOkClick = now;
            }
        }
    }, 300);
})();
