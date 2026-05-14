/**
 * VNPT HIS Smart Scanner
 * Module: Patient Context Guard
 * 
 * Bảo vệ tính toàn vẹn của dữ liệu khi điền form (chống race condition, context contamination).
 */

window.VNPTPatientContextGuard = (function () {
    let activeFillTokens = new Map();

    async function capture(formIframe, formType) {
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
            throw new Error(`PATIENT_CONTEXT_MISMATCH_${options.stage || 'UNKNOWN'}`);
        }
    }

    function invalidateAll(reason) {
        for (const [_id, token] of activeFillTokens.entries()) {
            token.state = 'invalidated';
            token.invalidateReason = reason;
        }
        activeFillTokens.clear();
    }

    function getCurrentContext() {
        return Array.from(activeFillTokens.values()).find(t => t.state === 'active');
    }

    function hashIdentity(identity) {
        if (!identity) return 'unknown';
        return `${identity.rowId || ''}_${identity.khambenhId || ''}_${identity.hosobenhanId || ''}_${identity.benhnhanId || ''}`;
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
        getCurrentContext,
        hashIdentity
    };
})();
