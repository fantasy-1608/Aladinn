/**
 * 🏥 HIS Shared — Logger
 * Unified logging với module prefix, styled console output
 * Không log clinical data (patient info) để bảo mật
 * 
 * Cách dùng:
 *   HIS.Logger.info('Scanner', 'Đã quét xong');
 *   HIS.Logger.error('Filler', 'Lỗi điền form', error);
 */

window.HIS = window.HIS || {};

HIS.Logger = {
    _getPrefix() {
        const emoji = HIS.APP_EMOJI || '🏥';
        const name = HIS.APP_NAME || 'HIS';
        return `${emoji} [${name}]`;
    },

    _style(color) {
        return `color: ${color}; font-weight: bold;`;
    },

    info(module, ...args) {
        console.log(`%c${this._getPrefix()}[${module}]`, this._style('#3b82f6'), ...args);
    },

    success(module, ...args) {
        console.log(`%c${this._getPrefix()}[${module}]`, this._style('#10b981'), ...args);
    },

    warn(module, ...args) {
        console.warn(`%c${this._getPrefix()}[${module}]`, this._style('#f59e0b'), ...args);
    },

    error(module, ...args) {
        console.error(`%c${this._getPrefix()}[${module}]`, this._style('#ef4444'), ...args);
    },

    debug(module, ...args) {
        console.debug(`%c${this._getPrefix()}[${module}]`, this._style('#8b5cf6'), ...args);
    },

    group(module, label) {
        console.groupCollapsed(`${this._getPrefix()}[${module}] ${label}`);
    },

    groupEnd() {
        console.groupEnd();
    },

    time(label) {
        console.time(`${this._getPrefix()} ${label}`);
    },

    timeEnd(label) {
        console.timeEnd(`${this._getPrefix()} ${label}`);
    }
};


