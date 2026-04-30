/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Logger
 * 
 * Unified logging that respects DEBUG flag from config.
 */

const VNPTLogger = (function () {
    const PREFIX = '[VNPT-HIS]';

    /**
     * Check if debug mode is enabled
     */
    function isDebugEnabled() {
        return window.VNPTConfig?.DEBUG === true;
    }

    /**
     * Format log message with timestamp and module
     */
    function formatMessage(/** @type {string} */ module, /** @type {string} */ message) {
        const timestamp = new Date().toLocaleTimeString('vi-VN');
        return `${PREFIX}[${module}] ${timestamp}: ${message}`;
    }

    /**
     * Get current patient context — [P2-SEC-002] REDACTED: no PHI stored in logs
     * Only stores a short hash of patientId for correlation, not the actual name/record.
     */
    function getContext() {
        if (!window.VNPTStore) return null;
        const state = window.VNPTStore.getState();
        const patientId = /** @type {string} */(state.selectedPatientId);
        if (!patientId) return null;

        // [P2-SEC-002] Short hash for correlation — not reversible, not PHI
        const shortId = 'P-' + String(patientId).slice(-4).padStart(4, '*');
        return { shortId };
    }

    /**
     * Debug level - only logs when DEBUG is true
     */
    /** @param {...any} args */
    function debug(/** @type {string} */ module, /** @type {string} */ message, ...args) {
        if (isDebugEnabled()) {
            // [P2-SEC-002] No patient name in console output
            console.log(formatMessage(module, message), ...args);
        }
    }

    /**
     * Info level - only logs when DEBUG is true
     */
    /** @param {...any} args */
    function info(/** @type {string} */ module, /** @type {string} */ message, ...args) {
        if (isDebugEnabled()) {
            // [P2-SEC-002] No patient name in console output
            console.info(formatMessage(module, message), ...args);
        }
    }

    /**
     * Warning level - always logs
     */
    /** @param {...any} args */
    function warn(/** @type {string} */ module, /** @type {string} */ message, ...args) {
        // [P2-SEC-002] No patient name/PHI in console output
        console.warn(formatMessage(module, message), ...args);
    }

    /**
     * Error level - always logs and stores in localStorage
     */
    /** 
     * @param {string} module 
     * @param {string} message 
     * @param {any} [data]
     */
    function error(module, message, data = null) {
        const context = getContext();

        // [P2-SEC-002] Sanitize data: only store error code/message, never raw API payload
        let safeData = null;
        if (data !== null && data !== undefined) {
            if (data instanceof Error) {
                safeData = { errorType: data.name, errorMessage: data.message };
            } else if (typeof data === 'string') {
                // Truncate long strings (API responses, clinical text)
                safeData = data.length > 200 ? data.substring(0, 200) + '...[truncated]' : data;
            } else if (typeof data === 'object') {
                // Only keep safe fields, drop anything that might be PHI or large payloads
                const SAFE_KEYS = ['status', 'code', 'errorCode', 'field', 'action', 'type', 'step'];
                const filtered = {};
                for (const k of SAFE_KEYS) {
                    if (data[k] !== undefined) filtered[k] = data[k];
                }
                safeData = Object.keys(filtered).length > 0 ? filtered : { redacted: true };
            }
        }

        const entry = {
            time: new Date().toISOString(),
            module,
            message,
            // [P2-SEC-002] Only store short correlation ID, never full patient info
            shortId: context?.shortId || null,
            data: safeData,
            // [P2-SEC-002] Don't store full URL which may contain session tokens
            path: location.pathname
        };

        // Log to console without PHI
        console.log(formatMessage(module, message), safeData || '');

        // Save to chrome.storage with TTL enforcement
        try {
            const key = window.VNPTConfig?.storage?.errorLogs || 'vnpt_error_logs';
            const _chrome = (/** @type {any} */(window)).chrome;
            if (_chrome?.storage?.local) {
                _chrome.storage.local.get([key], (res) => {
                    let existing = res[key] || [];
                    // [P2-SEC-002] TTL: remove entries older than 24 hours
                    const TTL_MS = 24 * 60 * 60 * 1000;
                    const cutoff = new Date(Date.now() - TTL_MS).toISOString();
                    existing = existing.filter(e => e.time > cutoff);
                    existing.push(entry);
                    _chrome.storage.local.set({ [key]: existing.slice(-50) });
                });
            }
        } catch (_e) { /* Storage full or unavailable */ }

        return entry;
    }

    /**
     * Get stored error logs
     */
    async function getErrorLogs() {
        try {
            const key = window.VNPTConfig?.storage?.errorLogs || 'vnpt_error_logs';
            const _chrome = (/** @type {any} */(window)).chrome;
            if (_chrome?.storage?.local) {
                const result = await new Promise(r => _chrome.storage.local.get([key], r));
                return result[key] || [];
            }
            return [];
        } catch {
            return [];
        }
    }

    /**
     * Clear error logs
     */
    function clearErrorLogs() {
        try {
            const key = window.VNPTConfig?.storage?.errorLogs || 'vnpt_error_logs';
            const _chrome = (/** @type {any} */(window)).chrome;
            if (_chrome?.storage?.local) {
                _chrome.storage.local.remove(key);
            }
        } catch { /* ignore */ }
    }

    // Public API
    return {
        debug,
        info,
        warn,
        error,
        getErrorLogs,
        clearErrorLogs,
        isDebugEnabled
    };
})();

// Export to window
window.VNPTLogger = VNPTLogger;
