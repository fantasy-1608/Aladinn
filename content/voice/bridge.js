/**
 * HIS Voice Assistant - Bridge Module
 * Message bus between content script ⇄ background service worker
 * All AI/network calls MUST go through this bridge.
 */

// ========================================
// UUID Generator
// ========================================
function generateRequestId() {
    return 'req_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
}

// ========================================
// Send Message to Background
// ========================================
/**
 * Sends a typed message to the background service worker and awaits response.
 * @param {string} type - Message type (AI_REQUEST, AI_CANCEL, GET_SETTINGS, SET_SETTINGS)
 * @param {Object} payload - Message payload
 * @param {Object} [options] - Options
 * @param {number} [options.timeoutMs=30000] - Timeout in ms
 * @returns {Promise<Object>} - Response data
 */
function sendToBackground(type, payload = {}, { timeoutMs = 30000 } = {}) {
    return new Promise((resolve, reject) => {
        if (!chrome.runtime?.id) {
            reject(new Error('Extension context invalidated. Vui lòng refresh trang (F5).'));
            return;
        }

        const requestId = generateRequestId();
        const message = { type, requestId, payload };

        // Timeout guard
        const timer = setTimeout(() => {
            reject(new Error(`Request timeout (${timeoutMs / 1000}s). Kiểm tra kết nối mạng.`));
        }, timeoutMs);

        try {
            chrome.runtime.sendMessage(message, (response) => {
                clearTimeout(timer);

                if (chrome.runtime.lastError) {
                    reject(new Error(chrome.runtime.lastError.message));
                    return;
                }

                if (!response) {
                    reject(new Error('Không nhận được phản hồi từ background.'));
                    return;
                }

                if (response.ok) {
                    resolve(response.data);
                } else {
                    const err = response.error || {};
                    reject(new Error(err.message || 'Background error'));
                }
            });
        } catch (e) {
            clearTimeout(timer);
            reject(new Error('Không thể gửi message: ' + e.message));
        }
    });
}

// Track current AI request for cancellation
let _currentAIRequestId = null;

/**
 * Send AI request through background
 * @param {string} text - Cleaned text to process
 * @param {string} model - Model name
 * @returns {Promise<Object>} - Parsed AI result
 */
async function requestAIViaBridge(text, model) {
    const requestId = generateRequestId();
    _currentAIRequestId = requestId;

    try {
        const result = await sendToBackground('AI_REQUEST', {
            text,
            model,
            requestId
        }, { timeoutMs: 60000 }); // AI requests get longer timeout

        return result;
    } finally {
        if (_currentAIRequestId === requestId) {
            _currentAIRequestId = null;
        }
    }
}

/**
 * Cancel the current AI request
 */
function cancelAIRequest() {
    if (_currentAIRequestId) {
        sendToBackground('AI_CANCEL', { requestId: _currentAIRequestId }, { timeoutMs: 5000 })
            .catch(() => { /* best effort */ });
        _currentAIRequestId = null;
    }
}

// ========================================
// Global Exports
// ========================================
window.sendToBackground = sendToBackground;
window.requestAIViaBridge = requestAIViaBridge;
window.cancelAIRequest = cancelAIRequest;

