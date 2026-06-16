window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.SafeClick = (function () {
    'use strict';

    const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

    let lastFailureReason = null;

    const SIGN_SELECTOR_REGISTRY = {
        smartCAConfirm: {
            primary: ['#btnConfirm'],
            containers: [
                '.smartca-modal',
                '.esign-dialog',
                '.modal-content',
                '.modal-dialog',
                'body'
            ],
            allowedTexts: ['Xác nhận', 'Chấp nhận'],
            forbiddenTexts: ['Hủy', 'Đóng', 'Thoát', 'Xóa', 'Không'],
            maxCandidates: 1
        },

        hisSuccessOk: {
            primary: ['#alertify-ok', '.alertify-button-ok'],
            containers: [
                '.alertify',
                '.alertify-dialog',
                '.alertify-logs'
            ],
            allowedTexts: ['Đồng ý', 'OK', 'Hoàn tất'],
            forbiddenTexts: ['Hủy', 'Không', 'Xóa'],
            maxCandidates: 1
        }
    };

    function _findButton(targetName) {
        const registry = SIGN_SELECTOR_REGISTRY[targetName];
        if (!registry) return null;

        for (const selector of registry.primary) {
            const btn = window.Aladinn.Sign.Context.findInShadowRoots(selector);
            if (btn && !btn.dataset.aladinnClicked) {
                return btn;
            }
        }
        return null;
    }

    function _logBlocked(targetName, reasonCode, riskLevel, sessionId) {
        if (!window.Aladinn.Sign.Audit) return;
        window.Aladinn.Sign.Audit.logEvent({
            eventType: 'sign_autoclick_blocked',
            sessionId: sessionId || null,
            action: 'click_' + targetName,
            result: 'blocked',
            reasonCode: reasonCode,
            riskLevel: riskLevel || 'UNKNOWN',
            targetName: targetName,
            pageUrlPath: window.location.pathname
        });
    }

    function _blocked(reasonCode, riskLevel) {
        return { allowed: false, reasonCode: reasonCode, riskLevel: riskLevel || 'UNKNOWN' };
    }

    /**
     * Consolidated safety gate — checks ALL preconditions before auto-click.
     * Returns { allowed, reasonCode, riskLevel }.
     */
    function finalGuard(targetName, context, sessionId) {
        const registry = SIGN_SELECTOR_REGISTRY[targetName];
        if (!registry) {
            return _blocked('UNKNOWN_TARGET', 'CRITICAL');
        }

        // 1. Session validity
        if (!window.Aladinn.Sign.SessionGuard.isSessionValid()) {
            const r = _blocked('SESSION_INVALID', 'CRITICAL');
            _logBlocked(targetName, r.reasonCode, r.riskLevel, sessionId);
            return r;
        }

        // 2. Tab must be visible
        if (document.visibilityState !== 'visible') {
            const r = _blocked('TAB_NOT_VISIBLE', 'HIGH');
            _logBlocked(targetName, r.reasonCode, r.riskLevel, sessionId);
            return r;
        }

        // 3. Policy must allow auto-sign
        if (!window.Aladinn.Sign.Policy.isAutoSignAllowed()) {
            const r = _blocked('POLICY_DISABLED', 'HIGH');
            _logBlocked(targetName, r.reasonCode, r.riskLevel, sessionId);
            return r;
        }

        // 4. Error dialog detection
        if (context && context.hasErrorText) {
            const r = _blocked('ERROR_DIALOG_DETECTED', 'CRITICAL');
            _logBlocked(targetName, r.reasonCode, r.riskLevel, sessionId);
            return r;
        }

        // 5. Max candidates check
        const candidateCount = (context && context.candidateButtonsCount) || 0;
        if (candidateCount > registry.maxCandidates) {
            const r = _blocked('MULTIPLE_CONFIRM_BUTTONS', 'HIGH');
            _logBlocked(targetName, r.reasonCode, r.riskLevel, sessionId);
            return r;
        }

        // 6–7. Button text checks (forbidden + allowlist)
        const textResult = _checkButtonText(targetName, registry);
        if (textResult) {
            _logBlocked(targetName, textResult.reasonCode, textResult.riskLevel, sessionId);
            return textResult;
        }

        // 8. Risk engine evaluation
        const riskResult = _checkRisk(context, sessionId, targetName);
        if (riskResult) return riskResult;

        // All checks passed
        const policy = window.Aladinn.Sign.Policy.get();
        const decision = window.Aladinn.Sign.RiskEngine.evaluate(context, policy);
        return { allowed: true, riskLevel: decision.level };
    }

    function _checkButtonText(targetName, registry) {
        const btn = _findButton(targetName);
        if (!btn) return _blocked('BUTTON_NOT_FOUND', 'HIGH');

        const btnText = btn.textContent.trim();

        if (registry.forbiddenTexts.some(w => btnText.includes(w))) {
            return _blocked('FORBIDDEN_TEXT', 'HIGH');
        }

        const inAllowlist = registry.allowedTexts.some(w => btnText.includes(w));
        if (!inAllowlist) {
            return _blocked('TEXT_NOT_IN_ALLOWLIST', 'HIGH');
        }

        return null; // passed
    }

    function _checkRisk(context, sessionId, targetName) {
        const policy = window.Aladinn.Sign.Policy.get();
        const decision = window.Aladinn.Sign.RiskEngine.evaluate(context, policy);
        const maxAllowed = RISK_ORDER[policy.maxRiskForAutoClick] ?? 1;
        const actual = RISK_ORDER[decision.level] ?? 3;

        if (actual > maxAllowed) {
            const r = _blocked('RISK_TOO_HIGH', decision.level);
            _logBlocked(targetName, r.reasonCode, r.riskLevel, sessionId);
            return r;
        }
        return null; // passed
    }

    function click(targetName, context, sessionId) {
        lastFailureReason = null;

        // Run final guard
        const guard = finalGuard(targetName, context, sessionId);
        if (!guard.allowed) {
            lastFailureReason = guard.reasonCode;
            return false;
        }

        const btn = _findButton(targetName);
        if (!btn) {
            lastFailureReason = 'BUTTON_NOT_FOUND';
            return false;
        }

        // Double-click prevention
        if (btn.dataset.aladinnClicked) {
            lastFailureReason = 'ALREADY_CLICKED';
            return false;
        }

        btn.dataset.aladinnClicked = '1';
        btn.click();

        // Log audit with actual risk level (not hardcoded)
        if (window.Aladinn.Sign.Audit) {
            window.Aladinn.Sign.Audit.logEvent({
                eventType: 'auto_click',
                sessionId: sessionId,
                action: 'click_' + targetName,
                result: 'success',
                reasonCode: 'OK',
                riskLevel: guard.riskLevel
            });
        }

        return true;
    }

    function explainLastFailure() {
        return lastFailureReason;
    }

    return {
        findButton: _findButton,
        click,
        finalGuard,
        explainLastFailure
    };
})();
console.log('[Aladinn] 🧞 Sign SafeClick loaded');
