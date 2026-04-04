/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Notifications (VNPTNotification)
 * 
 * Quản lý thông báo Desktop Browser
 */

const VNPTNotification = (function () {
    let permission = 'default';

    /**
     * Khởi tạo module
     */
    function init() {
        if (!('Notification' in window)) {
            console.warn('⚠️ Trình duyệt này không hỗ trợ Desktop Notification');
            return;
        }

        permission = Notification.permission;

        // Auto request on init if config says so, 
        // OR wait for user action (better UX). 
        // For now, we wait for requestPermission() call.
    }

    /**
     * Yêu cầu quyền thông báo
     * @returns {Promise<boolean>}
     */
    async function requestPermission() {
        if (!('Notification' in window)) return false;

        const result = await Notification.requestPermission();
        permission = result;
        return result === 'granted';
    }

    /**
     * Gửi thông báo Desktop
     * @param {string} title - Tiêu đề
     * @param {string} body - Nội dung
     * @param {string} [icon] - URL icon (tùy chọn)
     */
    function send(title, body, icon) {
        // 1. Kiểm tra hỗ trợ
        if (!('Notification' in window)) return;

        // 2. Kiểm tra setting từ VNPTSettings
        // (Nếu user tắt "Hiện thông báo" trong setting, thì không hiện)
        if (window.VNPTSettings) {
            const settings = window.VNPTSettings.getSettings();
            if (settings && settings.showNotifications === false) return;
        }

        // 3. Kiểm tra permission & gửi
        if (permission === 'granted') {
            const notif = new Notification(title, {
                body: body,
                icon: icon || 'https://cdn-icons-png.flaticon.com/512/3774/3774299.png', // Generic pill icon
                requireInteraction: true // Giữ thông báo đến khi user click
            });

            notif.onclick = function () {
                window.focus();
                notif.close();
            };
        }
    }

    return {
        init,
        requestPermission,
        send
    };
})();

// Export globally
/** @type {any} */
(window).VNPTNotification = VNPTNotification;
