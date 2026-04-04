/**
 * VNPT HIS Extension v2.0
 * Module: UI (UX Improvements)
 * 
 * Quản lý giao diện và Dark Mode.
 */

const VNPTUI = (function () {
    const DARK_MODE_KEY = 'vnpt_dark_mode';

    /**
     * Khởi tạo UI module
     */
    function init() {
        injectStyles();
        restoreDarkMode();
        console.log('[UI] Module khởi tạo thành công');
    }

    /**
     * Inject CSS vào trang
     */
    function injectStyles() {
        if (document.getElementById('vnpt-v2-css')) return;

        try {
            if (typeof chrome === 'undefined' || !chrome.runtime) {
                console.warn('[UI] Chrome Runtime not available. Skipping style injection.');
                return;
            }

            const link = document.createElement('link');
            link.id = 'vnpt-v2-css';
            link.rel = 'stylesheet';
            link.href = chrome.runtime.getURL('styles/aladinn-scanner.css');
            document.head.appendChild(link);
        } catch (e) {
            console.error('[UI] Failed to inject styles:', e);
        }
    }

    /**
     * Bật/Tắt Dark Mode
     */
    function toggleDarkMode() {
        const body = document.body;
        const isDark = body.classList.toggle('vnpt-dark-mode');

        console.log('[UI] Dark Mode:', isDark ? 'BẬT' : 'TẮT');
        return isDark;
    }

    /**
     * Khôi phục trạng thái Dark Mode
     */
    function restoreDarkMode() {
        const _chrome = (/** @type {any} */(window)).chrome;
        if (_chrome?.storage?.local) {
            _chrome.storage.local.get(['his_settings'], (result) => {
                if (result.his_settings?.darkMode) {
                    document.body.classList.add('vnpt-dark-mode');
                }
            });
        }




    }

    /**
     * Kiểm tra đang Dark Mode không
     */
    function isDarkMode() {
        return document.body.classList.contains('vnpt-dark-mode');
    }

    /**
     * Hiển thị progress bar
     * Optimized for 60fps using transform instead of width
     * @param {number} current 
     * @param {number} total 
     */
    function updateProgress(current, total) {
        /** @type {(HTMLElement & { timeoutRemove?: ReturnType<typeof setTimeout> }) | null} */
        let bar = /** @type {(HTMLElement & { timeoutRemove?: ReturnType<typeof setTimeout> }) | null} */ (document.getElementById('vnpt-progress-bar'));

        if (!bar) {
            bar = /** @type {(HTMLElement & { timeoutRemove?: ReturnType<typeof setTimeout> })} */ (document.createElement('div'));
            bar.id = 'vnpt-progress-bar';
            // Start with scaleX(0)
            bar.style.transform = 'scaleX(0)';
            document.body.appendChild(bar);
        }

        // Remove pending removal if existing
        if (bar.timeoutRemove) {
            clearTimeout(bar.timeoutRemove);
            bar.style.opacity = '1';
        }

        const percent = Math.min(Math.max(current / total, 0), 1);
        bar.style.transform = `scaleX(${percent})`;

        if (percent >= 1) {
            bar.timeoutRemove = setTimeout(() => {
                bar.style.opacity = '0';
                setTimeout(() => {
                    if (bar && bar.parentNode) bar.remove();
                }, 300);
            }, 500);
        }
    }

    /**
     * Hiện thông báo toast (wrapper cho realtime module)
     * @param {string} message
     * @param {ToastType} [type]
     */
    function showNotification(message, type = 'success') {
        if (window.VNPTRealtime && window.VNPTRealtime.showToast) {
            window.VNPTRealtime.showToast(message, type);
        }
    }

    // Public API
    return {
        init,
        toggleDarkMode,
        isDarkMode,
        updateProgress,
        showNotification
    };
})();

window.VNPTUI = VNPTUI;
