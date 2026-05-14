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
    let remoteAutoSignEnabled = false; // Remote Kill Switch — default OFF (fail-closed)

    console.log('[Aladinn/AutoClick] 🔄 Helper loaded in frame:', window.location.href.substring(0, 80));

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        // Load initial state
        chrome.storage.local.get(['aladinn_features', 'aladinn_remote_config'], (result) => {
            const features = result.aladinn_features || {};
            isSignModuleEnabled = features.sign !== false;

            // Remote Kill Switch check
            const rc = result.aladinn_remote_config;
            if (rc && typeof rc.features === 'object') {
                remoteAutoSignEnabled = rc.features.autoSign !== false;
            }
        });

        // Listen for changes from popup AND remote config refresh
        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.aladinn_features) {
                const features = changes.aladinn_features.newValue || {};
                isSignModuleEnabled = features.sign !== false;
            }
            // Remote config changed (background fetched new config)
            if (namespace === 'local' && changes.aladinn_remote_config) {
                const rc = changes.aladinn_remote_config.newValue;
                if (rc && typeof rc.features === 'object') {
                    remoteAutoSignEnabled = rc.features.autoSign !== false;
                    if (!remoteAutoSignEnabled) {
                        console.log('[Aladinn/AutoClick] 🚫 Auto-Sign bị TẮT từ xa (Remote Kill Switch)');
                    }
                }
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


    function handleAutoClicks() {
        if (!isSignModuleEnabled) return;
        if (!remoteAutoSignEnabled) return; // Remote Kill Switch
        // Khi signing session đang chạy, signing.js quản lý auto-click riêng
        if (window.__aladinnSigningActive) return;

        const now = Date.now();

        // Auto-click #btnConfirm (e-Seal Smart CA "Xác nhận")
        // 🛡️ SmartCA Guard: Block auto-click if signer name mismatch detected
        if (window.__aladinnSmartCAMismatch) return;
        if (now - lastConfirmClick > 2000) {
            const confirmBtn = findInShadowRoots('#btnConfirm');
            if (confirmBtn && !confirmBtn.dataset.aladinnClicked) {
                // Container Scoping: Ensure it's inside a valid container
                const container = confirmBtn.closest('.modal-content, .modal-dialog, body');
                if (!container) return;

                // Kiểm tra điều kiện: Nếu có nhiều hộp chọn (nhiều mức ký) hoặc chưa chọn -> Dừng lại chờ user
                const selects = container.querySelectorAll('select');
                let visibleCount = 0;
                let hasUnselected = false;
                for (const el of selects) {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled) {
                        visibleCount++;
                        const text = el.options[el.selectedIndex]?.text || '';
                        if (!el.value || el.value === '0' || text.toLowerCase().includes('lựa chọn') || text.includes('--')) {
                            hasUnselected = true;
                        }
                    }
                }
                
                if (visibleCount > 1 || hasUnselected) {
                    return; // Bỏ qua tự động click, chờ user tự click
                }

                confirmBtn.dataset.aladinnClicked = '1';
                confirmBtn.click();
                lastConfirmClick = now;
                return;
            }
        }

        // Auto-click #alertify-ok (HIS "Đồng ý" success dialog)
        if (now - lastOkClick > 3000) {
            // Container Scoping: Only look inside .alertify
            const alertifyModal = document.querySelector('.alertify');
            if (alertifyModal) {
                const okBtn = alertifyModal.querySelector('#alertify-ok') ||
                              alertifyModal.querySelector('.alertify-button-ok');
                if (okBtn && !okBtn.dataset.aladinnClicked) {
                    okBtn.dataset.aladinnClicked = '1';
                    okBtn.click();
                    lastOkClick = now;
                    
                    // Không tự động đóng Modal chính của HIS ở đây!
                    // HIS sẽ tiếp tục chạy vòng lặp nội bộ (nếu có nhiều phiếu),
                    // hoặc user sẽ tự kiểm tra và đóng/chuyển bệnh nhân.
                }
            }
        }
    }

    if (document.body) {
        const observer = new MutationObserver(handleAutoClicks);
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            const observer = new MutationObserver(handleAutoClicks);
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
})();
