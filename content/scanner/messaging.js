/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Messaging (Message Bridge & Bus)
 * 
 * Centralizes communication between Content Script, Injected Script, and Background.
 */

const VNPTMessaging = (function () {
    const requestMap = new Map();
    const RESPONSE_TYPES = new Set([
        'SCAN_PATIENT_RESULT',
        'FETCH_ROOM_RESULT',
        'FETCH_VITALS_RESULT',
        'FETCH_HISTORY_RESULT',
        'FETCH_TREATMENT_RESULT',
        'FETCH_DRUGS_RESULT',
        'FETCH_PTTT_RESULT',
        'CALL_SP_RESULT'
    ]);

    function getAllowedOrigin() {
        return window.location.origin;
    }

    /**
     * @param {MessageEvent} event
     * @returns {boolean}
     */
    function isTrustedMessage(event) {
        if (event.source !== window) return false;
        if (event.origin !== getAllowedOrigin() && event.origin !== window.location.origin) return false;
        if (!event.data || typeof event.data !== 'object') return false;
        if (typeof event.data.type !== 'string') return false;
        return true;
    }

    /**
     * Listen for messages from Page (Injected Script)
     * @param {Function} onInitialization - Callback when page script is ready
     */
    function init(onInitialization) {
        window.addEventListener('message', function (event) {
            if (!isTrustedMessage(event)) return;

            const data = event.data;

            // Handle Page Script Initialization
            if (data.type === 'FROM_PAGE_SCRIPT') {
                if (window.VNPTStore && Array.isArray(data.rows)) {
                    window.VNPTStore.actions.updatePatientDataMap(data.rows);
                }
                if (onInitialization) onInitialization();
            }

            // Handle Asynchronous Request Results
            if (RESPONSE_TYPES.has(data.type)) {
                if (typeof data.requestId === 'string' && requestMap.has(data.requestId)) {
                    const resolve = requestMap.get(data.requestId);
                    requestMap.delete(data.requestId);
                    resolve(data);
                }
            }
        });
    }

    /**
     * Send a request to the Injected Script and wait for a response
     * @param {string} type - Request type (e.g., REQ_FETCH_ROOM)
     * @param {Object} payload - Additional data
     * @param {number} timeoutMs - Timeout in milliseconds
     * @returns {Promise<any>}
     */
    function sendRequest(type, payload = {}, timeoutMs = 5000) {
        const requestId = `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        return new Promise((resolve) => {
            requestMap.set(requestId, resolve);

            window.postMessage({
                type,
                ...payload,
                requestId,
                token: window.__ALADINN_BRIDGE_TOKEN__
            }, getAllowedOrigin());

            setTimeout(() => {
                if (requestMap.has(requestId)) {
                    requestMap.delete(requestId);
                    resolve({ success: false, timeout: true });
                }
            }, timeoutMs);
        });
    }

    return {
        init,
        sendRequest
    };
})();

window.VNPTMessaging = VNPTMessaging;
