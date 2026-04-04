/**
 * VNPT HIS Extension v4.0.1
 * Module: Realtime (MutationObserver Notifications)
 * 
 * Tự động phát hiện thay đổi trên bảng bệnh nhân.
 */

const VNPTRealtime = (function () {
    /**
     * Hiển thị toast notification
     * @param {string} message
     * @param {'info'|'warning'|'success'} type
     */
    function showToast(message, type = 'info') {
        // Tạo container nếu chưa có
        let container = document.getElementById('vnpt-toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'vnpt-toast-container';
            container.className = 'vnpt-toast-container';
            document.body.appendChild(container);
        }

        // Tạo toast
        const toast = document.createElement('div');
        toast.className = `vnpt-toast vnpt-toast-${type}`;
        toast.textContent = message;
        toast.onclick = () => toast.remove();

        container.appendChild(toast);

        // Auto remove after 5s
        setTimeout(() => {
            toast.style.animation = 'vnpt-toast-out 0.3s ease';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    // Public API
    return {
        showToast
    };
})();

window.VNPTRealtime = VNPTRealtime;
