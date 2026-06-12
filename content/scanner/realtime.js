/**
 * VNPT HIS Extension v4.0.2
 * Module: Realtime — Bottom-Right Fly-Up Notification
 * 
 * - Bottom-right corner, max 3 visible
 * - Toast flies up + fades away on dismiss
 * - Dynamic speed: more active toasts → faster auto-dismiss (max 1.5s)
 * - Auto-group duplicate messages
 * - Nút X đóng nhanh, pause on hover
 */

const VNPTRealtime = (function () {
    const MAX_TOASTS = 3;
    const DURATION = {
        info: 2500,
        success: 3000,
        warning: 5000,
        error: 10000,
        loading: 15000 // Loading stays longer
    };
    let _container = null;
    /** @type {Map<string, {el: HTMLElement, count: number, timer: number}>} */
    const _activeToasts = new Map();

    function _ensureContainer() {
        if (_container && document.body.contains(_container)) return _container;
        _container = document.createElement('div');
        _container.id = 'vnpt-toast-container';
        _container.className = 'vnpt-toast-container';
        document.body.appendChild(_container);
        return _container;
    }

    /**
     * Detect toast type from message emoji
     */
    function _detectType(message, explicitType) {
        if (explicitType && explicitType !== 'info') return explicitType;
        if (message.includes('⏳') || message.includes('🪄')) return 'loading';
        if (message.includes('✅') || message.includes('✓') || message.includes('🎉')) return 'success';
        if (message.includes('⚠️') || message.includes('❌') || message.includes('🛑')) return 'warning';
        if (message.includes('❗') || message.includes('🚨')) return 'error';
        return explicitType || 'info';
    }

    /**
     * Dynamic duration: càng nhiều toast → càng nhanh biến mất
     * 1 toast: normal duration
     * 2 toasts: duration × 0.6
     * 3+ toasts: capped at 1500ms
     */
    function _getDynamicDuration(baseDuration, type) {
        if (type === 'loading') return baseDuration; // Don't accelerate loading
        const count = _activeToasts.size;
        if (count >= 2) return Math.min(baseDuration * 0.4, 1500);
        if (count >= 1) return Math.min(baseDuration * 0.6, 2000);
        return baseDuration;
    }

    /**
     * Get icon for toast type
     */
    function _getIcon(type) {
        switch (type) {
            case 'success': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
            case 'warning': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
            case 'error': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>';
            case 'loading': return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a9 9 0 1 1-6.219-8.56"><animateTransform attributeName="transform" type="rotate" from="0 12 12" to="360 12 12" dur="1s" repeatCount="indefinite" /></path></svg>';
            default: return '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>';
        }
    }

    /**
     * Remove toast with fly-up + fade animation
     */
    function _removeToast(key) {
        const entry = _activeToasts.get(key);
        if (!entry) return;
        clearTimeout(entry.timer);
        entry.el.classList.add('vnpt-toast-exit');
        setTimeout(() => {
            entry.el.remove();
            _activeToasts.delete(key);
        }, 400);
    }

    /**
     * Enforce max toast limit + accelerate existing toasts
     */
    function _enforceLimit() {
        const keys = Array.from(_activeToasts.keys());
        while (keys.length >= MAX_TOASTS) {
            const oldest = keys.shift();
            _removeToast(oldest);
        }
        // Accelerate remaining toasts when new one arrives
        for (const [k, entry] of _activeToasts) {
            clearTimeout(entry.timer);
            entry.timer = setTimeout(() => _removeToast(k), 1500);
        }
    }

    /**
     * Hiển thị toast notification — Bottom-Right, fly-up, max 3
     * @param {string} message
     * @param {'info'|'warning'|'success'|'error'|'loading'} [type='info']
     * @param {string} [id] - Optional ID to allow updating an existing toast instead of stacking
     */
    function showToast(message, type = 'info', id = null) {
        const container = _ensureContainer();
        type = _detectType(message, type);
        const baseDuration = DURATION[type] || DURATION.info;
        const duration = _getDynamicDuration(baseDuration, type);

        // Clean message (remove leading emoji if duplicated by icon)
        const cleanMsg = message.replace(/^[\p{Emoji}]+\s*/u, '').trim() || message;

        // Auto-group: nếu cùng message đang hiện → tăng counter
        const msgKey = id || message.trim();
        if (_activeToasts.has(msgKey)) {
            const existing = _activeToasts.get(msgKey);
            existing.count++;
            
            // If we provided an ID, we might be updating the message text
            if (id) {
                const msgEl = existing.el.querySelector('.vnpt-toast-message');
                if (msgEl) msgEl.innerHTML = cleanMsg;
                // If type changes to something else, we might want to update icon
                if (type === 'success' || type === 'error' || type === 'warning') {
                    const iconEl = existing.el.querySelector('.vnpt-toast-icon');
                    if (iconEl) iconEl.innerHTML = _getIcon(type);
                    existing.el.className = `vnpt-toast vnpt-toast-${type} vnpt-toast-enter`;
                }
            } else {
                const badge = existing.el.querySelector('.vnpt-toast-badge');
                if (badge) {
                    badge.textContent = `×${existing.count}`;
                    badge.style.display = 'inline-flex';
                }
            }
            
            // Reset timer
            clearTimeout(existing.timer);
            existing.timer = setTimeout(() => _removeToast(msgKey), duration);
            // Re-trigger animation
            existing.el.classList.remove('vnpt-toast-enter');
            void existing.el.offsetWidth;
            existing.el.classList.add('vnpt-toast-enter');
            return;
        }

        // Enforce max
        _enforceLimit();

        // Create toast element
        const toast = document.createElement('div');
        toast.className = `vnpt-toast vnpt-toast-${type} vnpt-toast-enter`;

        // Icon
        const iconEl = document.createElement('div');
        iconEl.className = 'vnpt-toast-icon';
        iconEl.innerHTML = _getIcon(type);

        // Content
        const contentEl = document.createElement('div');
        contentEl.className = 'vnpt-toast-content';

        const msgEl = document.createElement('span');
        msgEl.className = 'vnpt-toast-message';
        msgEl.innerHTML = cleanMsg;

        const badgeEl = document.createElement('span');
        badgeEl.className = 'vnpt-toast-badge';
        badgeEl.textContent = '×1';
        badgeEl.style.display = 'none';

        contentEl.appendChild(msgEl);
        contentEl.appendChild(badgeEl);

        // Close button
        const closeBtn = document.createElement('button');
        closeBtn.className = 'vnpt-toast-close';
        closeBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
        closeBtn.onclick = (e) => {
            e.stopPropagation();
            _removeToast(msgKey);
        };

        // Assemble
        toast.appendChild(iconEl);
        toast.appendChild(contentEl);
        toast.appendChild(closeBtn);

        // Pause timer on hover
        toast.addEventListener('mouseenter', () => {
            const entry = _activeToasts.get(msgKey);
            if (entry) {
                clearTimeout(entry.timer);
            }
        });
        toast.addEventListener('mouseleave', () => {
            const entry = _activeToasts.get(msgKey);
            if (entry) {
                entry.timer = setTimeout(() => _removeToast(msgKey), duration);
            }
        });

        container.appendChild(toast);

        // Track
        const timer = setTimeout(() => _removeToast(msgKey), duration);
        _activeToasts.set(msgKey, { el: toast, count: 1, timer });
    }

    // Public API
    return {
        showToast
    };
})();

window.VNPTRealtime = VNPTRealtime;
