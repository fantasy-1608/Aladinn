/**
 * 🧞 Aladinn — Sign Module: Utilities
 * Sign-specific helper functions (waitFor, findSafeButton, etc.)
 * Ported from SignHis v4.1.0 Utils
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.Utils = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    // === TIMING CONSTANTS ===
    const CONSTANTS = {
        DELAY_MIN: 100,
        DELAY_MAX_WAIT: 30000,
        POLLING_FAST: 100,
        POLLING_SLOW: 500,
        DELAY_AUTO_FILTER: 500,
        DELAY_SEARCH_CLICK: 100,
        DELAY_HIGHLIGHT: 500,
        DELAY_POPUP_CLOSE: 150,
        DELAY_DBLCLICK: 100,
        DELAY_TYPE_IN_MODAL: 150,
        DELAY_CHECK_GRID: 600,
    };

    /**
     * Smart delay - only wait minimum time needed
     */
    function smartDelay(minMs) {
        return new Promise(resolve => setTimeout(resolve, minMs));
    }

    /**
     * Wait for an element to appear in the DOM with adaptive polling
     */
    function waitFor(selector, options = {}) {
        const { timeout = CONSTANTS.DELAY_MAX_WAIT, parent = document, visible = true } = options;

        return new Promise((resolve, reject) => {
            const startTime = Date.now();
            let interval = CONSTANTS.POLLING_FAST;

            const check = () => {
                let element;
                if (selector.startsWith('#')) {
                    element = parent.getElementById ?
                        parent.getElementById(selector.slice(1)) :
                        parent.querySelector(selector);
                } else {
                    element = parent.querySelector(selector);
                }

                if (element && (!visible || (element.offsetWidth > 0 && element.offsetHeight > 0))) {
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    reject(new Error(`waitFor: "${selector}" not found within ${timeout}ms`));
                    return;
                }

                const elapsed = Date.now() - startTime;
                interval = elapsed < 1000 ? CONSTANTS.POLLING_FAST :
                    elapsed < 5000 ? 200 : CONSTANTS.POLLING_SLOW;

                setTimeout(check, interval);
            };

            check();
        });
    }

    /**
     * Wait for element in all frames (recursive)
     */
    function waitForElementInFrames(elementId, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const startTime = Date.now();

            const check = () => {
                const element = findElementInAllFrames(window, elementId);
                if (element) {
                    resolve(element);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    reject(new Error(`Element ${elementId} not found within ${timeout}ms`));
                    return;
                }

                const elapsed = Date.now() - startTime;
                const interval = Math.min(100 + Math.floor(elapsed / 500) * 50, 300);
                setTimeout(check, interval);
            };

            check();
        });
    }

    /**
     * Helper to find element in all frames
     */
    function findElementInAllFrames(win, elementId) {
        try {
            const el = elementId.startsWith('#') || elementId.startsWith('.') ?
                win.document.querySelector(elementId) :
                win.document.getElementById(elementId);

            if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
                return el;
            }
        } catch (e) {
            // Cross-origin
        }

        for (let i = 0; i < win.frames.length; i++) {
            try {
                const found = findElementInAllFrames(win.frames[i], elementId);
                if (found) return found;
            } catch (e) { console.warn('[Aladinn/Sign] Error retrieving tabId:', e); }
        }
        return null;
    }

    /**
     * Safe search for confirmation buttons within a context
     */
    function findSafeButton(root, searchTexts, excludeTexts = ['Hủy', 'Đóng', 'Thoát', 'Xóa', 'In', 'Excel', 'Tải', 'No', 'Không']) {
        try {
            let container = root;
            let doc = root;

            if (root.document) {
                container = root.document.body;
                doc = root.document;
            } else if (root.ownerDocument) {
                doc = root.ownerDocument;
            }

            if (!container) return null;

            const btns = container.querySelectorAll('button, a, input[type="button"], span[class*="btn"], div[class*="button"]');

            for (const btn of btns) {
                if (btn.offsetWidth === 0 || btn.offsetHeight === 0) continue;

                const btnText = (btn.textContent || btn.value || '').trim();
                const btnLower = btnText.toLowerCase();

                if (excludeTexts.some(ex => btnText === ex || btnText.includes(ex) || btnLower.includes(ex.toLowerCase()))) continue;

                if (searchTexts.some(st => btnText.includes(st) || btnLower.includes(st.toLowerCase()))) {
                    const style = window.getComputedStyle(btn);
                    if (style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0') {
                        return btn;
                    }
                }
            }
        } catch (e) {
            if (e.name !== 'SecurityError') {
                console.warn('[Aladinn Sign] findSafeButton error:', e);
            }
        }

        if (root.frames) {
            for (let i = 0; i < root.frames.length; i++) {
                try {
                    const found = findSafeButton(root.frames[i], searchTexts, excludeTexts);
                    if (found) return found;
                } catch (e) { console.warn('[Aladinn/Sign] Error posting message:', e); }
            }
        }

        return null;
    }

    /**
     * Wait for a custom condition to be true (adaptive polling)
     */
    function waitForCondition(conditionFn, options = {}) {
        const { timeout = 10000, interval = 50, minWait = 0 } = options;
        const startTime = Date.now();

        return new Promise((resolve) => {
            const check = () => {
                try {
                    if (conditionFn()) {
                        const elapsed = Date.now() - startTime;
                        if (elapsed < minWait) {
                            setTimeout(() => resolve(true), minWait - elapsed);
                        } else {
                            resolve(true);
                        }
                        return;
                    }
                } catch (e) { console.warn('[Aladinn/Sign] Error handling dialog:', e); }

                if (Date.now() - startTime > timeout) {
                    resolve(false);
                    return;
                }

                const elapsed = Date.now() - startTime;
                const adaptiveInterval = elapsed < 500 ? interval :
                    elapsed < 2000 ? interval * 2 : interval * 4;

                setTimeout(check, Math.min(adaptiveInterval, 300));
            };

            check();
        });
    }

    /**
     * Wait for all modals/dialogs to close
     */
    function waitForModalClose(timeout = 5000) {
        const modalSelectors = [
            '.jBox-container',
            '.ui-dialog:visible',
            '.modal.show',
            '[role="dialog"]:not([aria-hidden="true"])',
            '.popup-overlay:not(.hidden)'
        ];

        return waitForCondition(() => {
            for (const selector of modalSelectors) {
                const modal = document.querySelector(selector);
                if (modal && modal.offsetWidth > 0 && modal.offsetHeight > 0) {
                    return false;
                }
            }
            return true;
        }, { timeout, interval: 30 });
    }

    /**
     * Wait for jqGrid to finish loading in an iframe
     */
    function waitForGridReady(iframe, timeout = 8000) {
        return waitForCondition(() => {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;

                const loadingIndicator = doc.querySelector('[id^="load_grid"]');
                if (loadingIndicator && loadingIndicator.style.display !== 'none') {
                    return false;
                }

                const gridBody = doc.querySelector('.ui-jqgrid-bdiv');
                if (!gridBody) return false;

                const $ = iframe.contentWindow.jQuery;
                if ($ && $.active > 0) {
                    return false;
                }

                return true;
            } catch (e) {
                return false;
            }
        }, { timeout, interval: 30 });
    }

    /**
     * Wait for element to disappear from DOM
     */
    function waitForElementGone(selector, options = {}) {
        const { timeout = 5000, parent = document } = options;

        return waitForCondition(() => {
            const el = parent.querySelector(selector);
            return !el || el.offsetWidth === 0 || el.offsetHeight === 0;
        }, { timeout, interval: 50 });
    }

    // === PERFORMANCE LOGGER ===
    const PerfLogger = {
        timers: {},
        start(label) {
            this.timers[label] = Date.now();
        },
        end(label) {
            if (!this.timers[label]) return 0;
            const duration = Date.now() - this.timers[label];
            const emoji = duration < 200 ? '🟢' : duration < 500 ? '🟡' : '🔴';
            if (Logger) Logger.debug('Sign', `[Perf] ${emoji} ${label} - ${duration}ms`);
            delete this.timers[label];
            return duration;
        }
    };

    // === SESSION STATISTICS ===
    const SessionStats = {
        data: {
            sessionStart: Date.now(),
            totalSigned: 0,
            totalSkipped: 0,
            totalErrors: 0,
            signTimes: [],
        },
        recordSign(duration = 0) {
            this.data.totalSigned++;
            if (duration > 0) this.data.signTimes.push(duration);
            this.save();
        },
        recordSkip() {
            this.data.totalSkipped++;
            this.save();
        },
        recordError() {
            this.data.totalErrors++;
            this.save();
        },
        getStats() {
            return this.data;
        },
        save() {
            try { sessionStorage.setItem('aladinn_sign_stats', JSON.stringify(this.data)); } catch (e) { console.warn('[Aladinn/Sign] SessionStorage error:', e); }
        },
        load() {
            try {
                const saved = sessionStorage.getItem('aladinn_sign_stats');
                if (saved) this.data = { ...this.data, ...JSON.parse(saved) };
            } catch (e) { console.warn('[Aladinn/Sign] SessionStorage read error:', e); }
        },
        reset() {
            this.data = {
                sessionStart: Date.now(),
                totalSigned: 0,
                totalSkipped: 0,
                totalErrors: 0,
                signTimes: []
            };
            this.save();
        }
    };

    // Public API
    return {
        CONSTANTS,
        waitFor,
        waitForElementInFrames,
        findElementInAllFrames,
        findSafeButton,
        smartDelay,
        waitForCondition,
        waitForModalClose,
        waitForGridReady,
        waitForElementGone,
        PerfLogger,
        SessionStats
    };
})();

// Init stats
window.Aladinn.Sign.Utils.SessionStats.load();

console.log('[Aladinn] 🧞 Sign utils loaded');
