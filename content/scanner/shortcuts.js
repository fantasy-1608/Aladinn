/**
 * VNPT HIS Extension v2.0
 * Module: Shortcuts (Keyboard Shortcuts)
 * 
 * Phím tắt để tăng tốc thao tác.
 */

const VNPTShortcuts = (function () {
    /** @type {Record<string, { action: ShortcutAction; description: string }>} */
    const shortcuts = {
        'ctrl+shift+r': { action: 'scanRooms', description: 'Quét Tên Buồng' },
        'ctrl+shift+d': { action: 'toggleDark', description: 'Bật/Tắt Dark Mode' },
        'escape': { action: 'minimize', description: 'Thu gọn Panel' },
        'ctrl+shift+c': { action: 'clearCache', description: 'Xóa Cache' }
    };

    /** @type {Partial<Record<ShortcutAction, () => void>>} */
    let handlers = {};

    /**
     * Đăng ký handler cho action
     * @param {ShortcutAction} action 
     * @param {() => void} handler 
     */
    function register(action, handler) {
        handlers[action] = handler;
    }

    /**
     * Khởi tạo lắng nghe phím tắt
     */
    function init() {
        document.addEventListener('keydown', (/** @type {KeyboardEvent} */ e) => {
            const key = getKeyCombo(e);
            const shortcut = shortcuts[key];

            if (shortcut) {
                const handler = handlers[shortcut.action];
                if (!handler) return;
                e.preventDefault();
                console.log('[Shortcuts] Kích hoạt:', shortcut.description);
                handler();
            }
        });

        console.log('[Shortcuts] Đã khởi tạo phím tắt');
    }

    /**
     * Chuyển event thành chuỗi key combo
     * @param {KeyboardEvent} e
     */
    function getKeyCombo(e) {
        const parts = [];
        if (e.ctrlKey) parts.push('ctrl');
        if (e.shiftKey) parts.push('shift');
        if (e.altKey) parts.push('alt');

        if (!e.key) return parts.join('+');

        const key = e.key.toLowerCase();
        if (!['control', 'shift', 'alt', 'meta'].includes(key)) {
            parts.push(key);
        }

        return parts.join('+');
    }

    /**
     * Lấy danh sách phím tắt để hiển thị
     */
    function getShortcutList() {
        return Object.entries(shortcuts).map(([key, data]) => ({
            key: key.toUpperCase().replace(/\+/g, ' + '),
            description: data.description
        }));
    }

    // Public API
    return {
        init,
        register,
        getShortcutList
    };
})();

window.VNPTShortcuts = VNPTShortcuts;
