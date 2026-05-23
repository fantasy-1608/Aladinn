/**
 * VNPT HIS Smart Scanner
 * Module: Patient Context Guard
 * 
 * Bảo vệ tính toàn vẹn của dữ liệu khi điền form (chống race condition, context contamination).
 */

window.VNPTPatientContextGuard = (function () {
    let activeFillTokens = new Map();
    let globalAbortController = null;

    async function capture(formIframe, formType) {
        if (globalAbortController) {
            globalAbortController.abort('NEW_FILL_STARTED');
        }
        globalAbortController = new AbortController();

        const store = window.VNPTStore?.getState() || {};
        const pid = store.selectedPatientId;
        
        let iframeFingerprint = '';
        if (formIframe) {
            iframeFingerprint = formIframe.src + '|' + formIframe.id;
        }

        const token = {
            tokenId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
            createdAt: Date.now(),
            expiresAt: Date.now() + 120000, // 2 minutes
            rowId: pid,
            formType: formType,
            iframeFingerprint: iframeFingerprint,
            initialSelectedPatientId: pid,
            state: 'active'
        };

        activeFillTokens.set(token.tokenId, token);
        return token;
    }

    function captureGridOnly(pid) {
        const token = {
            tokenId: crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2),
            createdAt: Date.now(),
            expiresAt: Date.now() + 30000, // 30s
            rowId: pid,
            initialSelectedPatientId: pid,
            state: 'active'
        };
        activeFillTokens.set(token.tokenId, token);
        return token;
    }

    function validate(token, _options = {}) {
        if (!token) return false;
        
        const currentToken = activeFillTokens.get(token.tokenId);
        if (!currentToken || currentToken.state !== 'active') {
            return false;
        }

        if (Date.now() > currentToken.expiresAt) {
            currentToken.state = 'expired';
            return false;
        }

        const currentPid = window.VNPTStore?.get('selectedPatientId');
        if (currentPid !== token.initialSelectedPatientId) {
             return false;
        }

        return true;
    }

    async function hashPatientId(pid) {
        if (!pid) return null;
        try {
            const encoder = new TextEncoder();
            const data = encoder.encode(pid + 'ALADINN_SALT_123');
            const hashBuffer = await crypto.subtle.digest('SHA-256', data);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('').substring(0, 12);
        } catch (_e) {
            return 'err_hash';
        }
    }

    async function assertValidOrThrow(token, options = {}) {
        const isValid = validate(token, options);
        if (!isValid) {
            console.warn('[ContextGuard] Context mismatch blocked fill:', options.stage, token);
            if (window.VNPTLogger) {
                window.VNPTLogger.warn('ContextGuard', `Fill blocked at ${options.stage} due to context mismatch`, {
                    stage: options.stage,
                    tokenId: token?.tokenId
                });
            }
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({
                        type: 'LOG_AUDIT',
                        auditType: 'patient_mismatch',
                        details: {
                            stage: options.stage,
                            tokenFormType: token?.formType,
                            expectedPidHash: await hashPatientId(token?.initialSelectedPatientId)
                        }
                    });
                }
            } catch (_e) {}
            throw new Error(`PATIENT_CONTEXT_MISMATCH_${options.stage || 'UNKNOWN'}`);
        }
    }

    function invalidateAll(reason) {
        for (const [_id, token] of activeFillTokens.entries()) {
            token.state = 'invalidated';
            token.invalidateReason = reason;
        }
        activeFillTokens.clear();
        if (globalAbortController) {
            globalAbortController.abort(reason);
            globalAbortController = null;
        }
    }

    function getActiveSignal() {
        return globalAbortController ? globalAbortController.signal : null;
    }

    function getCurrentContext() {
        return Array.from(activeFillTokens.values()).find(t => t.state === 'active');
    }

    function hashIdentity(identity) {
        if (!identity) return 'unknown';
        return `${identity.rowId || ''}_${identity.khambenhId || ''}_${identity.hosobenhanId || ''}_${identity.benhnhanId || ''}`;
    }

    function showContextConfirmDialog(token) {
        return new Promise((resolve) => {
            const store = window.VNPTStore?.getState() || {};
            const patientName = store.selectedPatientName || 'Không rõ';
            const currentPid = window.VNPTStore?.get('selectedPatientId');
            
            // Xác minh lại lần cuối
            if (currentPid === token.initialSelectedPatientId) {
                if (window.VNPTRealtime && typeof window.VNPTRealtime.showToast === 'function') {
                    window.VNPTRealtime.showToast(`✅ Đã xác minh: Thông tin điền khớp 100% với bệnh nhân hiện tại (${patientName}).`, 'success');
                } else {
                    console.log(`[ContextGuard] Đã xác minh khớp 100% bệnh nhân: ${patientName}`);
                }
                resolve(true);
            } else {
                if (window.VNPTRealtime && typeof window.VNPTRealtime.showToast === 'function') {
                    window.VNPTRealtime.showToast('❌ CẢNH BÁO: Thông tin điền KHÔNG KHỚP với bệnh nhân hiện tại. Đã chặn!', 'error');
                }
                resolve(false);
            }
        });
    }

    // Auto-invalidate when patient changes
    if (window.VNPTStore) {
        window.VNPTStore.subscribe('selectedPatientId', (_pid) => {
            invalidateAll('PATIENT_CHANGED');
        });
    }

    return {
        capture,
        captureGridOnly,
        validate,
        assertValidOrThrow,
        invalidateAll,
        getActiveSignal,
        getCurrentContext,
        hashIdentity,
        showContextConfirmDialog
    };
})();
