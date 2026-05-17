/**
 * 🧞 Aladinn — Sign Session Guard
 * Manages secure signing sessions (TTL, Pause State, Audit Logging)
 */
window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.SessionGuard = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;
    const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
    const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    let currentSession = null;
    let lastActivity = 0;
    let checkInterval = null;

    // Audit logs ring buffer (in-memory, dumped to storage.local periodically)
    let auditBuffer = [];
    const MAX_AUDIT_LOGS = 500;

    function _generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    function startSession(patientCount, workflowType) {
        if (currentSession) {
            stopSession('NEW_SESSION_OVERRIDE');
        }

        currentSession = {
            id: _generateId(),
            startedAt: Date.now(),
            patientCount,
            workflowType, // 'WARD' or 'SIGN_PAGE'
            state: 'ACTIVE', // ACTIVE, PAUSED, STOPPED
            pauseReason: null
        };
        lastActivity = Date.now();

        _auditLog('SESSION_STARTED', { patientCount, workflowType });
        _startMonitoring();

        // Update global var for legacy integration
        window.__aladinnSessionId = currentSession.id;
        
        return currentSession.id;
    }

    function stopSession(reason = 'MANUAL_STOP') {
        if (!currentSession) return;
        
        _auditLog('SESSION_STOPPED', { reason });
        currentSession.state = 'STOPPED';
        currentSession = null;
        window.__aladinnSessionId = null;
        _stopMonitoring();
    }

    function pauseSession(reason) {
        if (!currentSession || currentSession.state !== 'ACTIVE') return;
        
        currentSession.state = 'PAUSED';
        currentSession.pauseReason = reason;
        _auditLog('SESSION_PAUSED', { reason });
    }

    function resumeSession() {
        if (!currentSession || currentSession.state !== 'PAUSED') return;
        
        currentSession.state = 'ACTIVE';
        currentSession.pauseReason = null;
        ping(); // reset idle timer
        _auditLog('SESSION_RESUMED', {});
    }

    function ping() {
        if (currentSession && currentSession.state === 'ACTIVE') {
            lastActivity = Date.now();
        }
    }

    function _startMonitoring() {
        if (checkInterval) clearInterval(checkInterval);
        checkInterval = setInterval(() => {
            if (!currentSession || currentSession.state === 'STOPPED') return;
            const now = Date.now();

            if (now - currentSession.startedAt > SESSION_TTL_MS) {
                if (Logger) Logger.warn('SessionGuard', 'Session expired (TTL).');
                stopSession('TTL_EXPIRED');
                window.dispatchEvent(new CustomEvent('aladinn-session-expired'));
            } else if (currentSession.state === 'ACTIVE' && now - lastActivity > IDLE_TIMEOUT_MS) {
                if (Logger) Logger.warn('SessionGuard', 'Session paused due to inactivity.');
                pauseSession('IDLE_TIMEOUT');
                window.dispatchEvent(new CustomEvent('aladinn-session-paused', { detail: { reason: 'IDLE_TIMEOUT' } }));
            }
        }, 10000);
    }

    function _stopMonitoring() {
        if (checkInterval) {
            clearInterval(checkInterval);
            checkInterval = null;
        }
    }

    function _auditLog(action, metadata = {}) {
        const entry = {
            timestamp: new Date().toISOString(),
            sessionId: currentSession?.id || null,
            action,
            metadata
        };
        auditBuffer.push(entry);
        if (auditBuffer.length > MAX_AUDIT_LOGS) {
            auditBuffer.shift();
        }
        
        // Background flush
        _scheduleFlush();
    }

    let flushTimer = null;
    function _scheduleFlush() {
        if (flushTimer) return;
        flushTimer = setTimeout(() => {
            flushTimer = null;
            try {
                if (chrome && chrome.storage && chrome.storage.local) {
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
            } catch (_e) {
                // Extension context invalidated
            }
        }, 5000); // 5 sec debounce
    }

    function getSessionId() {
        return currentSession?.id || null;
    }

    function getSession() {
        return currentSession ? { ...currentSession } : null;
    }

    function isSessionValid() {
        if (!currentSession) return false;
        if (currentSession.state !== 'ACTIVE') return false;
        if (Date.now() - currentSession.startedAt > SESSION_TTL_MS) return false;
        return true;
    }

    function getState() {
        return currentSession?.state || 'STOPPED';
    }

    function rotateStepNonce() {
        if (!currentSession) return null;
        currentSession.stepNonce = _generateId();
        return currentSession.stepNonce;
    }

    function markStepCompleted(step) {
        if (!currentSession) return;
        currentSession.lastStepCompleted = step;
    }

    function assertCanAutoClick(actionContext) {
        if (!isSessionValid()) return false;
        
        const policy = window.Aladinn.Sign.Policy?.get();
        if (policy) {
            if (actionContext.action === 'closePdfTab' && !policy.allowAutoClosePdfTab) return false;
            if (actionContext.action === 'click_smartCAConfirm' && !policy.allowConfirmAutoClick) return false;
            if (actionContext.action === 'click_hisSuccessOk' && !policy.allowOkAutoClick) return false;
        }
        return true;
    }

    return {
        startSession,
        stopSession,
        pauseSession,
        resumeSession,
        ping,
        getSessionId,
        getSession,
        isSessionValid,
        getState,
        rotateStepNonce,
        markStepCompleted,
        assertCanAutoClick,
        logEvent: _auditLog
    };
})();
console.log('[Aladinn] 🧞 Sign Session Guard loaded');
