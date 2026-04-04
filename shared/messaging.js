/**
 * 🧞 Aladinn — Unified Chrome Messaging Wrapper
 * Standardizes chrome.runtime.sendMessage payload: { action: string, payload: object, timestamp: number }
 * Provides auto-listener cleanup functionality.
 */

window.HIS = window.HIS || {};

HIS.Messaging = (function () {
    const _listeners = new Set();

    /**
     * Gửi tin nhắn đến Background Script hoặc Content Script (nếu có tabId)
     * @param {string} action - Tên action (vd: 'GET_SETTINGS')
     * @param {Object} payload - Dữ liệu kèm theo
     * @param {number} [tabId] - Tuỳ chọn: ID của tab nếu muốn gửi cho Content Script
     * @returns {Promise<any>}
     */
    function send(action, payload = {}, tabId = null) {
        return new Promise((resolve) => {
            const message = {
                action,
                payload,
                timestamp: Date.now()
            };

            const callback = (response) => {
                if (chrome.runtime.lastError) {
                    if (HIS.Logger) HIS.Logger.warn('Messaging', `Error sending ${action}:`, chrome.runtime.lastError);
                    resolve({ ok: false, error: chrome.runtime.lastError.message });
                    return;
                }
                resolve(response);
            };

            if (tabId) {
                chrome.tabs.sendMessage(tabId, message, callback);
            } else {
                chrome.runtime.sendMessage(message, callback);
            }
        });
    }

    /**
     * Đăng ký lắng nghe tin nhắn với khả năng cleanup tự động
     * @param {string} action - Tên action cần lắng nghe
     * @param {Function} handler - Callback xử lý (có thể return Promise)
     * @param {HTMLElement} [boundElement] - Tuỳ chọn: Element gắn kèm. Nếu element bị xoá khỏi DOM, listener sẽ tự huỷ.
     * @returns {Function} Hàm huỷ listener
     */
    function on(action, handler, boundElement = null) {
        const listener = (message, sender, sendResponse) => {
            if (message && message.action === action) {
                // Check if bound element was removed
                if (boundElement && !document.body.contains(boundElement)) {
                    off(listener);
                    return false;
                }

                try {
                    const result = handler(message.payload, sender);
                    if (result instanceof Promise) {
                        result.then(sendResponse).catch(err => sendResponse({ ok: false, error: err.message }));
                        return true; // Keep message channel open for async
                    } else if (result !== undefined) {
                        sendResponse(result);
                    }
                } catch (e) {
                    if (HIS.Logger) HIS.Logger.error('Messaging', `Error in handler for ${action}:`, e);
                    sendResponse({ ok: false, error: e.message });
                }
            }
            return false;
        };

        chrome.runtime.onMessage.addListener(listener);
        _listeners.add(listener);

        return () => off(listener);
    }

    /**
     * Huỷ một listener cụ thể
     */
    function off(listener) {
        chrome.runtime.onMessage.removeListener(listener);
        _listeners.delete(listener);
    }

    /**
     * Huỷ tất cả các listener được tạo qua HIS.Messaging
     */
    function clearAll() {
        for (const listener of _listeners) {
            chrome.runtime.onMessage.removeListener(listener);
        }
        _listeners.clear();
    }

    // Auto cleanup when window unloads
    window.addEventListener('unload', () => {
        clearAll();
    });

    return {
        send,
        on,
        off,
        clearAll
    };
})();
