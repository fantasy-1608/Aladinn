/**
 * 🧞 Aladinn — Event Bus (Tổng đài Sự kiện Nội bộ)
 * Cho phép các module (Scanner, Voice, Sign) giao tiếp mà không cần biết nhau.
 *
 * Cách dùng:
 *   HIS.EventBus.on('patient:selected', (data) => { ... });
 *   HIS.EventBus.emit('patient:selected', { rowId, name });
 *   HIS.EventBus.off('patient:selected', handler);
 */

window.HIS = window.HIS || {};

HIS.EventBus = (function () {
    'use strict';

    /** @type {Map<string, Set<Function>>} */
    const _listeners = new Map();

    /**
     * Đăng ký lắng nghe sự kiện
     * @param {string} event - Tên sự kiện (e.g. 'patient:selected')
     * @param {Function} handler - Callback
     */
    function on(event, handler) {
        if (!_listeners.has(event)) {
            _listeners.set(event, new Set());
        }
        _listeners.get(event).add(handler);
    }

    /**
     * Hủy đăng ký
     * @param {string} event
     * @param {Function} handler
     */
    function off(event, handler) {
        const handlers = _listeners.get(event);
        if (handlers) handlers.delete(handler);
    }

    /**
     * Đăng ký lắng nghe 1 lần duy nhất
     * @param {string} event
     * @param {Function} handler
     */
    function once(event, handler) {
        const wrapper = (...args) => {
            off(event, wrapper);
            handler(...args);
        };
        on(event, wrapper);
    }

    /**
     * Phát sự kiện đến tất cả listeners
     * @param {string} event
     * @param {*} data - Dữ liệu kèm theo
     */
    function emit(event, data) {
        const handlers = _listeners.get(event);
        if (!handlers || handlers.size === 0) return;

        for (const handler of handlers) {
            try {
                handler(data);
            } catch (e) {
                if (HIS.Logger) {
                    HIS.Logger.error('EventBus', `Error in handler for "${event}":`, e);
                }
            }
        }
    }

    /**
     * Xóa tất cả listeners (dùng khi teardown)
     * @param {string} [event] - Nếu có thì chỉ xóa event đó
     */
    function clear(event) {
        if (event) {
            _listeners.delete(event);
        } else {
            _listeners.clear();
        }
    }

    return { on, off, once, emit, clear };
})();
