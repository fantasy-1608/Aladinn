window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.Audit = (function () {
    'use strict';

    let auditBuffer = [];
    let MAX_AUDIT_LOGS = 1000;
    let flushTimer = null;

    function _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    async function _hash(text) {
        if (!text) return null;
        if (!crypto || !crypto.subtle) return btoa(text).substring(0, 16);
        try {
            const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
            return Array.from(new Uint8Array(buffer)).map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 16);
        } catch(_e) {
            return btoa(text).substring(0, 16);
        }
    }

    async function logEvent(options) {
        const policy = window.Aladinn.Sign.Policy?.get() || { auditEnabled: true, auditRetentionEvents: 1000 };
        if (!policy.auditEnabled) return;
        MAX_AUDIT_LOGS = policy.auditRetentionEvents;

        const entry = {
            eventId: _generateId(),
            timestamp: new Date().toISOString(),
            module: 'auto-sign',
            eventType: options.eventType || 'unknown',
            sessionId: options.sessionId || null,
            action: options.action || '',
            result: options.result || '',
            reasonCode: options.reasonCode || '',
            riskLevel: options.riskLevel || '',
            pageUrlPath: window.location.pathname
        };

        if (options.patientName) entry.patientHash = await _hash(options.patientName);
        if (options.docId) entry.docIdHash = await _hash(options.docId);

        auditBuffer.push(entry);
        if (auditBuffer.length > MAX_AUDIT_LOGS) {
            auditBuffer.shift();
        }

        _scheduleFlush();
    }

    function _scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
                chrome.storage.local.get(['sign_audit_logs'], (res) => {
                    let logs = res.sign_audit_logs || [];
                    logs = logs.concat(auditBuffer);
                    if (logs.length > MAX_AUDIT_LOGS) {
                        logs = logs.slice(logs.length - MAX_AUDIT_LOGS);
                    }
                    chrome.storage.local.set({ sign_audit_logs: logs });
                    auditBuffer = [];
                });
            }
        }, 5000); // 5 sec debounce
    }

    return {
        logEvent
    };
})();
console.log('[Aladinn] 🧞 Sign Audit loaded');
