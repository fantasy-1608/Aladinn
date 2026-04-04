/**
 * 🧞 Aladinn — Sign Module: Smart Detection
 * Network monitoring, session timeout, grid health checks
 * Ported from SignHis v4.1.0
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.SmartDetection = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    const STATE = {
        isOnline: navigator.onLine,
        lastInteraction: Date.now(),
        sessionTimeout: 25 * 60 * 1000, // 25 minutes
        checkInterval: null,
    };

    function onOnline() { handleNetworkChange(true); }
    function onOffline() { handleNetworkChange(false); }

    function startMonitoring() {
        if (Logger) Logger.info('Sign', '🔍 SmartDetection started');

        window.addEventListener('online', onOnline);
        window.addEventListener('offline', onOffline);

        document.addEventListener('mousedown', updateInteraction);
        document.addEventListener('keydown', updateInteraction);

        // Use visibilitychange for session timeout instead of constant polling
        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible') {
                updateInteraction();
                performChecks();
            }
        });

        // Reduced interval: grid health check doesn't need to be frequent
        STATE.checkInterval = setInterval(performChecks, 15000);

        const UI = window.Aladinn?.Sign?.UI;
        if (UI) UI.showNetworkStatus(STATE.isOnline);
    }

    function handleNetworkChange(isOnline) {
        STATE.isOnline = isOnline;
        if (Logger) Logger.info('Sign', `Network: ${isOnline ? 'ONLINE' : 'OFFLINE'}`);

        const UI = window.Aladinn?.Sign?.UI;
        if (UI) UI.showNetworkStatus(isOnline);

        const Signing = window.Aladinn?.Sign?.Signing;
        if (!isOnline && Signing && Signing.isActive()) {
            if (Logger) Logger.warn('Sign', 'Network lost during signing');
        }
    }

    function updateInteraction() {
        STATE.lastInteraction = Date.now();
    }

    function performChecks() {
        const UI = window.Aladinn?.Sign?.UI;

        // Check session timeout
        const idleTime = Date.now() - STATE.lastInteraction;
        if (idleTime > STATE.sessionTimeout) {
            if (Logger) Logger.warn('Sign', 'Session may have expired');
            if (UI) UI.showToast('⚠️ Phiên làm việc có thể đã hết hạn. Vui lòng reload trang.');
            STATE.lastInteraction = Date.now() + (10 * 60 * 1000);
        }

        // Check grid health
        const DOM = window.Aladinn?.Sign?.DOM;
        if (DOM) {
            const grid = document.querySelector(DOM.GRIDS.PATIENT_LIST);
            if (grid && grid.offsetWidth > 0) {
                const checkboxes = document.querySelectorAll('.his-checkbox');
                if (checkboxes.length === 0 && !document.querySelector('.his-helper-loading')) {
                    if (Logger) Logger.debug('Sign', 'Grid found but no checkboxes - re-injecting...');
                    window.dispatchEvent(new CustomEvent('his-grid-empty-detected'));
                }
            }
        }
    }

    function stopMonitoring() {
        if (STATE.checkInterval) clearInterval(STATE.checkInterval);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
        document.removeEventListener('mousedown', updateInteraction);
        document.removeEventListener('keydown', updateInteraction);
    }

    return {
        startMonitoring,
        stopMonitoring,
        isOnline: () => STATE.isOnline
    };
})();

console.log('[Aladinn] 🧞 Sign smart-detection loaded');
