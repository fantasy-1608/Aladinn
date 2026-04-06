/**
 * 🧞 Aladinn — Auto-Click Helper (injected into ALL frames on vncare.vn)
 * Automatically clicks #btnConfirm and #alertify-ok when they appear.
 * Also searches inside Shadow DOMs for the buttons.
 */
(function () {
    'use strict';

    let lastConfirmClick = 0;
    let lastOkClick = 0;
    let isSignModuleEnabled = true; // Default to true, updated via storage

    console.log('[Aladinn/AutoClick] 🔄 Helper loaded in frame:', window.location.href.substring(0, 80));

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Load initial state
        chrome.storage.local.get('aladinn_features', (result) => {
            const features = result.aladinn_features || {};
            isSignModuleEnabled = features.sign !== false;
        });

        // Listen for changes from popup
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.aladinn_features) {
                const features = changes.aladinn_features.newValue || {};
                isSignModuleEnabled = features.sign !== false;
            }
        });
    }

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
        if (!isSignModuleEnabled) return;
        // Khi signing session đang chạy, signing.js quản lý auto-click riêng
        if (window.__aladinnSigningActive) return;

        const now = Date.now();

        // Auto-click #btnConfirm (e-Seal Smart CA "Xác nhận")
        if (now - lastConfirmClick > 2000) {
            const confirmBtn = findInShadowRoots('#btnConfirm');
            if (confirmBtn && !confirmBtn.dataset.aladinnClicked) {
                confirmBtn.dataset.aladinnClicked = '1';
                confirmBtn.click();
                lastConfirmClick = now;
                return;
            }
        }

        // Auto-click #alertify-ok (HIS "Đồng ý" success dialog)
        if (now - lastOkClick > 3000) {
            const okBtn = findInShadowRoots('#alertify-ok') ||
                          findInShadowRoots('.alertify-button-ok');
            if (okBtn && !okBtn.dataset.aladinnClicked) {
                okBtn.dataset.aladinnClicked = '1';
                okBtn.click();
                lastOkClick = now;
            }
        }
    }, 1000);
})();
