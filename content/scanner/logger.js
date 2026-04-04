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
     * Get current patient context from Store
     */
    function getContext() {
        if (!window.VNPTStore) return null;
        const state = window.VNPTStore.getState();
        const patientId = /** @type {string} */(state.selectedPatientId);
        const patientData = (/** @type {any} */(state.patientDataMap))?.[patientId];

        return patientId ? {
            patientId,
            hoTen: patientData?.HOTEN || 'Unknown',
            maBA: patientData?.MABENHAN || 'Unknown'
        } : null;
    }

    /**
     * Debug level - only logs when DEBUG is true
     */
    /** @param {...any} args */
    function debug(/** @type {string} */ module, /** @type {string} */ message, ...args) {
        if (isDebugEnabled()) {
            const context = getContext();
            const prefix = context ? `[Patient: ${context.hoTen}] ` : '';
            console.log(formatMessage(module, prefix + message), ...args);
        }
    }

    /**
     * Info level - only logs when DEBUG is true
     */
    /** @param {...any} args */
    function info(/** @type {string} */ module, /** @type {string} */ message, ...args) {
        if (isDebugEnabled()) {
            const context = getContext();
            const prefix = context ? `[Patient: ${context.hoTen}] ` : '';
            console.info(formatMessage(module, prefix + message), ...args);
        }
    }

    /**
     * Warning level - always logs
     */
    /** @param {...any} args */
    function warn(/** @type {string} */ module, /** @type {string} */ message, ...args) {
        const context = getContext();
        const prefix = context ? `[Patient: ${context.hoTen}] ` : '';
        console.warn(formatMessage(module, prefix + message), ...args);
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
        const entry = {
            time: new Date().toISOString(),
            module,
            message,
            context,
            data,
            url: location.href
        };

        const prefix = context ? `[Patient: ${context.hoTen}] ` : '';
        console.error(formatMessage(module, prefix + message), data || '');

        // Save to chrome.storage
        try {
            const key = window.VNPTConfig?.storage?.errorLogs || 'vnpt_error_logs';
            const _chrome = (/** @type {any} */(window)).chrome;
            if (_chrome?.storage?.local) {
                _chrome.storage.local.get([key], (res) => {
                    const existing = res[key] || [];
                    existing.push(entry);
                    _chrome.storage.local.set({ [key]: existing.slice(-50) });
                });
            }
        } catch (e) { /* Storage full or unavailable */ }

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
