/**
 * 🧞 Aladinn — Error Handler
 * Xử lý lỗi chuẩn hóa: hiển thị thông báo tiếng Việt cho user,
 * ghi log kỹ thuật cho developer, tự động lọc bỏ dữ liệu nhạy cảm.
 *
 * Cách dùng:
 *   Aladinn.ErrorHandler.handle(error, {
 *     module: 'Scanner',
 *     userMessage: 'Lỗi quét dữ liệu bệnh nhân'
 *   });
 *
 *   // Wrap async function:
 *   const result = await Aladinn.ErrorHandler.wrap(asyncFn, {
 *     module: 'Sign',
 *     userMessage: 'Lỗi ký số'
 *   })();
 */

window.Aladinn = window.Aladinn || {};

Aladinn.ErrorHandler = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger || window.HIS?.Logger;

    // ========================================
    // ERROR CODES — Mã lỗi nội bộ
    // ========================================
    const ERROR_CODES = {
        NETWORK:      { code: 'E001', vi: 'Lỗi kết nối mạng. Kiểm tra Internet.' },
        API_KEY:      { code: 'E002', vi: 'API Key không hợp lệ hoặc chưa cấu hình.' },
        API_QUOTA:    { code: 'E003', vi: 'Đã vượt giới hạn API. Thử lại sau ít phút.' },
        TIMEOUT:      { code: 'E004', vi: 'Hệ thống phản hồi quá chậm. Thử lại.' },
        DOM_NOT_FOUND:{ code: 'E005', vi: 'Không tìm thấy giao diện HIS cần thiết.' },
        PERMISSION:   { code: 'E006', vi: 'Không đủ quyền truy cập.' },
        STORAGE:      { code: 'E007', vi: 'Lỗi lưu trữ dữ liệu cục bộ.' },
        CRYPTO:       { code: 'E008', vi: 'Lỗi mã hóa/giải mã. Kiểm tra mã PIN.' },
        PATIENT_DATA: { code: 'E009', vi: 'Không thể đọc dữ liệu bệnh nhân.' },
        SIGN_FLOW:    { code: 'E010', vi: 'Lỗi trong luồng ký số. Kiểm tra SmartCA.' },
        UNKNOWN:      { code: 'E999', vi: 'Đã xảy ra lỗi không xác định.' }
    };

    /**
     * Tự động phân loại lỗi dựa trên message.
     * @param {Error|string} err
     * @returns {Object} Error code entry
     */
    function classify(err) {
        const msg = (err instanceof Error ? err.message : String(err)).toLowerCase();

        if (msg.includes('fetch') || msg.includes('network') || msg.includes('net::')) {
            return ERROR_CODES.NETWORK;
        }
        if (msg.includes('api key') || msg.includes('api_key') || msg.includes('chưa cấu hình')) {
            return ERROR_CODES.API_KEY;
        }
        if (msg.includes('quota') || msg.includes('429') || msg.includes('rate limit')) {
            return ERROR_CODES.API_QUOTA;
        }
        if (msg.includes('timeout') || msg.includes('timed out')) {
            return ERROR_CODES.TIMEOUT;
        }
        if (msg.includes('queryselector') || msg.includes('element') || msg.includes('null')) {
            return ERROR_CODES.DOM_NOT_FOUND;
        }
        if (msg.includes('permission') || msg.includes('quyền')) {
            return ERROR_CODES.PERMISSION;
        }
        if (msg.includes('storage') || msg.includes('quota exceeded')) {
            return ERROR_CODES.STORAGE;
        }
        if (msg.includes('decrypt') || msg.includes('encrypt') || msg.includes('pin') || msg.includes('crypto')) {
            return ERROR_CODES.CRYPTO;
        }
        if (msg.includes('ký') || msg.includes('sign') || msg.includes('smartca')) {
            return ERROR_CODES.SIGN_FLOW;
        }
        return ERROR_CODES.UNKNOWN;
    }

    /**
     * Xử lý lỗi thống nhất.
     * @param {Error|string} err - Lỗi cần xử lý
     * @param {Object} [context={}] - Ngữ cảnh
     * @param {string} context.module - Module gây lỗi (VD: 'Scanner', 'Sign')
     * @param {string} context.userMessage - Thông báo tiếng Việt cho user (nếu muốn custom)
     * @param {string} context.command - Lệnh gây lỗi (từ CommandBus)
     * @param {boolean} context.silent - Nếu true, không hiện toast
     */
    function handle(err, context = {}) {
        const { module = 'System', userMessage, command: _command, silent = false } = context;
        const errObj = err instanceof Error ? err : new Error(String(err));
        const classified = classify(errObj);

        // Log kỹ thuật cho developer (có sanitize)
        const sanitizedMsg = sanitize(errObj.message);
        if (Logger) {
            Logger.error(module, `[${classified.code}] ${sanitizedMsg}`);
            if (errObj.stack) {
                Logger.debug(module, 'Stack:', errObj.stack.split('\n').slice(0, 5).join('\n'));
            }
        }

        // Hiện toast thân thiện cho user
        if (!silent) {
            const displayMsg = userMessage || classified.vi;
            _showToast(`❌ ${displayMsg}`, 'warning');
        }

        return {
            code: classified.code,
            message: classified.vi,
            technical: sanitizedMsg
        };
    }

    /**
     * Wrap một async function để tự động catch và xử lý lỗi.
     * @param {Function} fn - Hàm async cần wrap
     * @param {Object} context - Context cho ErrorHandler
     * @returns {Function} Wrapped function
     */
    function wrap(fn, context = {}) {
        return async function (...args) {
            try {
                return await fn.apply(this, args);
            } catch (err) {
                handle(err, context);
                return null;
            }
        };
    }

    /**
     * Sanitize payload — lọc bỏ dữ liệu nhạy cảm trước khi log.
     * Xóa: tên bệnh nhân, mã BHYT, CMND, số điện thoại, API key.
     * @param {string|Object} data
     * @returns {string}
     */
    function sanitize(data) {
        if (!data) return '';
        let text = typeof data === 'string' ? data : JSON.stringify(data);

        // API Key patterns (AIza... hoặc dạng base64 dài)
        text = text.replace(/AIza[A-Za-z0-9_-]{30,}/g, '[API_KEY_REDACTED]');
        text = text.replace(/(api[_-]?key|apikey|x-goog-api-key)['":\s]*[A-Za-z0-9_-]{20,}/gi, '$1: [REDACTED]');

        // Số BHYT (dạng HS4..., DN4..., GD4..., v.v — 15 ký tự)
        text = text.replace(/[A-Z]{2}\d{13}/g, '[BHYT_REDACTED]');

        // CMND/CCCD (9 hoặc 12 chữ số liền)
        text = text.replace(/\b\d{9}\b/g, '[CMND_REDACTED]');
        text = text.replace(/\b\d{12}\b/g, '[CCCD_REDACTED]');

        // Số điện thoại VN
        text = text.replace(/(?:0|\+84)\d{9,10}/g, '[PHONE_REDACTED]');

        // Tên bệnh nhân (khó regex chính xác, chỉ lọc khi nằm trong field name)
        text = text.replace(/(HOTENBENTHAN|patientName|HOTEN|TEN_BENHNHAN)['":\s]*[^,}"]+/gi, '$1: [NAME_REDACTED]');

        // Cookie/Session tokens
        text = text.replace(/(cookie|session[_-]?id|jwt|token)['":\s]*[A-Za-z0-9._-]{20,}/gi, '$1: [TOKEN_REDACTED]');

        return text;
    }

    /**
     * Hiển thị toast notification cho user.
     * Tương thích với VNPTRealtime.showToast() nếu có.
     */
    function _showToast(message, type = 'info') {
        if (window.VNPTRealtime?.showToast) {
            window.VNPTRealtime.showToast(message, type);
        } else if (window.HIS?.UI?.toast) {
            window.HIS.UI.toast(message, type);
        } else {
            console.warn('[Aladinn]', message);
        }
    }

    return {
        handle,
        wrap,
        sanitize,
        classify,
        ERROR_CODES
    };
})();
