/**
 * 🧞 Aladinn — Command Bus
 * Trung tâm điều phối lệnh: tách biệt UI khỏi business logic.
 * 
 * Cách dùng:
 *   // Đăng ký:
 *   Aladinn.CommandBus.register('SCAN_PATIENT', async (payload) => { ... });
 *   
 *   // Gửi lệnh:
 *   const result = await Aladinn.CommandBus.send('SCAN_PATIENT', { rowId: '123' });
 *   // result = { ok: true, data: {...} } hoặc { ok: false, error: 'Lỗi...' }
 *   
 *   // Lịch sử:
 *   Aladinn.CommandBus.getHistory(); // 50 lệnh gần nhất
 */

window.Aladinn = window.Aladinn || {};

Aladinn.CommandBus = (function () {
    'use strict';

    const _handlers = {};
    const _history = [];
    const MAX_HISTORY = 50;
    const Logger = window.Aladinn?.Logger || window.HIS?.Logger;

    /**
     * Đăng ký handler cho 1 command.
     * Mỗi command chỉ có đúng 1 handler (ghi đè nếu trùng).
     * @param {string} command - Tên lệnh (VD: 'SCAN_PATIENT', 'START_SIGNING')
     * @param {Function} handler - Hàm xử lý, nhận payload, trả về kết quả hoặc Promise
     */
    function register(command, handler) {
        if (typeof command !== 'string' || !command) {
            throw new Error('[CommandBus] Command name must be a non-empty string');
        }
        if (typeof handler !== 'function') {
            throw new Error(`[CommandBus] Handler for "${command}" must be a function`);
        }
        _handlers[command] = handler;
        if (Logger) Logger.debug('CommandBus', `Registered: ${command}`);
    }

    /**
     * Hủy đăng ký handler.
     * @param {string} command
     */
    function unregister(command) {
        delete _handlers[command];
    }

    /**
     * Gửi lệnh đến handler tương ứng.
     * Trả về { ok, data, error, duration }.
     * Không bao giờ throw — mọi lỗi đều được bắt và trả về an toàn.
     * @param {string} command
     * @param {Object} [payload={}]
     * @returns {Promise<{ok: boolean, data?: any, error?: string, duration?: number}>}
     */
    async function send(command, payload = {}) {
        const startTime = performance.now();
        const entry = {
            command,
            timestamp: new Date().toISOString(),
            ok: false,
            duration: 0
        };

        try {
            const handler = _handlers[command];
            if (!handler) {
                const msg = `Không tìm thấy handler cho lệnh "${command}"`;
                if (Logger) Logger.warn('CommandBus', msg);
                entry.error = msg;
                _pushHistory(entry);
                return { ok: false, error: msg };
            }

            if (Logger) Logger.info('CommandBus', `▶ ${command}`, payload);

            const data = await handler(payload);
            const duration = Math.round(performance.now() - startTime);

            entry.ok = true;
            entry.duration = duration;
            _pushHistory(entry);

            if (Logger) Logger.success('CommandBus', `✅ ${command} (${duration}ms)`);
            return { ok: true, data, duration };

        } catch (err) {
            const duration = Math.round(performance.now() - startTime);
            const errorMsg = err instanceof Error ? err.message : String(err);

            entry.error = errorMsg;
            entry.duration = duration;
            _pushHistory(entry);

            if (Logger) Logger.error('CommandBus', `❌ ${command} (${duration}ms):`, errorMsg);

            // Hiển thị thông báo lỗi thân thiện cho user nếu có ErrorHandler
            if (Aladinn.ErrorHandler) {
                Aladinn.ErrorHandler.handle(err, {
                    module: 'CommandBus',
                    command: command,
                    userMessage: `Lỗi khi thực hiện: ${command}`
                });
            }

            return { ok: false, error: errorMsg, duration };
        }
    }

    /**
     * Kiểm tra command đã được đăng ký chưa.
     * @param {string} command
     * @returns {boolean}
     */
    function has(command) {
        return command in _handlers;
    }

    /**
     * Liệt kê tất cả commands đã đăng ký.
     * @returns {string[]}
     */
    function list() {
        return Object.keys(_handlers);
    }

    /**
     * Lấy lịch sử lệnh đã gửi (tối đa 50 gần nhất).
     * @returns {Array}
     */
    function getHistory() {
        return [..._history];
    }

    /**
     * Xóa lịch sử.
     */
    function clearHistory() {
        _history.length = 0;
    }

    function _pushHistory(entry) {
        _history.push(entry);
        if (_history.length > MAX_HISTORY) {
            _history.shift();
        }
    }

    return {
        register,
        unregister,
        send,
        has,
        list,
        getHistory,
        clearHistory
    };
})();
