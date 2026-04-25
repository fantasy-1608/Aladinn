/**
 * 🏥 HIS Shared — Logger (v2.0)
 * Unified logging với module prefix, styled console output
 * 
 * v2.0 Enhancements:
 * - sanitizePayload() — tự động lọc dữ liệu nhạy cảm trước khi log
 * - Debug mode toggle — bật/tắt từ Options (chrome.storage)
 * - Performance timing helper
 * 
 * Cách dùng:
 *   HIS.Logger.info('Scanner', 'Đã quét xong');
 *   HIS.Logger.error('Filler', 'Lỗi điền form', error);
 *   HIS.Logger.debug('CDS', 'Chi tiết:', data);  // Chỉ hiện khi debug mode ON
 */

window.HIS = window.HIS || {};

HIS.Logger = (() => {
    'use strict';

    // Debug mode: mặc định OFF, bật từ Options hoặc console
    let _debugMode = false;

    // Tải debug mode từ storage (non-blocking)
    if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
        chrome.storage.local.get(['aladinn_debug_mode'], (res) => {
            _debugMode = !!res.aladinn_debug_mode;
        });
    }

    function _getPrefix() {
        const emoji = HIS.APP_EMOJI || '🏥';
        const name = HIS.APP_NAME || 'HIS';
        return `${emoji} [${name}]`;
    }

    function _style(color) {
        return `color: ${color}; font-weight: bold;`;
    }

    /**
     * Sanitize data — lọc bỏ dữ liệu nhạy cảm của bệnh nhân.
     * Dùng khi cần log payload có thể chứa thông tin y tế.
     * @param {any} data - Dữ liệu cần sanitize
     * @returns {any} Dữ liệu đã được lọc
     */
    function sanitize(data) {
        if (!data) return data;

        // String: regex replace
        if (typeof data === 'string') {
            return _sanitizeString(data);
        }

        // Object: deep clone + sanitize values
        if (typeof data === 'object') {
            try {
                const clone = JSON.parse(JSON.stringify(data));
                return _sanitizeObject(clone);
            } catch (_e) {
                return '[Object - sanitize failed]';
            }
        }

        return data;
    }

    function _sanitizeString(text) {
        // API Keys
        text = text.replace(/AIza[A-Za-z0-9_-]{30,}/g, '[API_KEY]');
        // BHYT (2 chữ cái + 13 số)
        text = text.replace(/[A-Z]{2}\d{13}/g, '[BHYT]');
        // CMND (9 số) / CCCD (12 số)  
        text = text.replace(/\b\d{12}\b/g, '[CCCD]');
        text = text.replace(/\b\d{9}\b/g, '[CMND]');
        // SĐT VN
        text = text.replace(/(?:0|\+84)\d{9,10}/g, '[PHONE]');
        // Cookie/Token
        text = text.replace(/(cookie|session|jwt|token)[=:]\s*[A-Za-z0-9._-]{20,}/gi, '$1=[TOKEN]');
        return text;
    }

    const SENSITIVE_KEYS = new Set([
        'HOTENBENTHAN', 'HOTEN', 'TEN_BENHNHAN', 'patientName', 'TENBENHNHAN',
        'SOBHYT', 'SOTHE', 'SOCMND', 'SOCCCD', 'DIENTHOAI', 'DIACHI',
        'apiKey', 'geminiApiKey', 'api_key', 'pin', 'password',
        'cookie', 'session', 'jwt', 'token'
    ]);

    function _sanitizeObject(obj) {
        if (Array.isArray(obj)) {
            return obj.map(item => _sanitizeObject(item));
        }
        if (obj && typeof obj === 'object') {
            for (const key of Object.keys(obj)) {
                if (SENSITIVE_KEYS.has(key)) {
                    obj[key] = '[REDACTED]';
                } else if (typeof obj[key] === 'string') {
                    obj[key] = _sanitizeString(obj[key]);
                } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                    obj[key] = _sanitizeObject(obj[key]);
                }
            }
        }
        return obj;
    }

    // ========================================
    // PUBLIC API
    // ========================================

    function info(module, ...args) {
        console.log(`%c${_getPrefix()}[${module}]`, _style('#3b82f6'), ...args);
    }

    function success(module, ...args) {
        console.log(`%c${_getPrefix()}[${module}]`, _style('#10b981'), ...args);
    }

    function warn(module, ...args) {
        console.warn(`%c${_getPrefix()}[${module}]`, _style('#f59e0b'), ...args);
    }

    function error(module, ...args) {
        console.error(`%c${_getPrefix()}[${module}]`, _style('#ef4444'), ...args);
    }

    /**
     * Debug log — CHỈ hiện khi debug mode = ON.
     * Dùng cho chi tiết kỹ thuật không cần thiết trong production.
     */
    function debug(module, ...args) {
        if (!_debugMode) return;
        console.debug(`%c${_getPrefix()}[${module}]`, _style('#8b5cf6'), ...args);
    }

    function group(module, label) {
        console.groupCollapsed(`${_getPrefix()}[${module}] ${label}`);
    }

    function groupEnd() {
        console.groupEnd();
    }

    function time(label) {
        console.time(`${_getPrefix()} ${label}`);
    }

    function timeEnd(label) {
        console.timeEnd(`${_getPrefix()} ${label}`);
    }

    /**
     * Bật/tắt debug mode.
     * @param {boolean} enabled
     */
    function setDebugMode(enabled) {
        _debugMode = !!enabled;
        if (typeof chrome !== 'undefined' && chrome?.storage?.local) {
            chrome.storage.local.set({ aladinn_debug_mode: _debugMode });
        }
        info('Logger', `Debug mode: ${_debugMode ? 'ON 🔓' : 'OFF 🔒'}`);
    }

    /**
     * @returns {boolean} Debug mode hiện tại
     */
    function isDebugMode() {
        return _debugMode;
    }

    return {
        info,
        success,
        warn,
        error,
        debug,
        group,
        groupEnd,
        time,
        timeEnd,
        sanitize,
        setDebugMode,
        isDebugMode
    };
})();
