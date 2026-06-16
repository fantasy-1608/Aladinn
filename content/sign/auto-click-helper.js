/**
 * 🧞 Aladinn — Auto-Click Helper (injected into ALL frames on vncare.vn)
 * Relies on the new modular Secure Signing Architecture (Policy, RiskEngine, Context, SafeClick).
 */
(function () {
    'use strict';

    const RISK_ORDER = { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 };

    let lastConfirmClick = 0;
    let lastOkClick = 0;

    console.log('[Aladinn/AutoClick] 🔄 Secure Helper loaded in frame:', window.location.href.substring(0, 80));

    function _isRiskAcceptable(decisionLevel, policy) {
        const maxAllowed = RISK_ORDER[policy.maxRiskForAutoClick] ?? 1;
        const actual = RISK_ORDER[decisionLevel] ?? 3;
        return actual <= maxAllowed;
    }

    function _tryAutoClick(targetName, minIntervalMs, lastClickTime) {
        const now = Date.now();
        if (now - lastClickTime <= minIntervalMs) return { clicked: false, lastClick: lastClickTime };

        const context = window.Aladinn.Sign.Context.collect(targetName);
        if (context.pageType === 'UNKNOWN') return { clicked: false, lastClick: lastClickTime };

        const policy = window.Aladinn.Sign.Policy.get();
        const decision = window.Aladinn.Sign.RiskEngine.evaluate(context, policy);

        if (_isRiskAcceptable(decision.level, policy)) {
            const action = 'click_' + targetName;
            if (window.Aladinn.Sign.SessionGuard.assertCanAutoClick({ action })) {
                const sessionId = window.Aladinn.Sign.SessionGuard.getSessionId();
                const clicked = window.Aladinn.Sign.SafeClick.click(targetName, context, sessionId);
                if (clicked) return { clicked: true, lastClick: now };
            }
        } else if (decision.level === 'HIGH') {
            window.Aladinn.Sign.SessionGuard.pauseSession(decision.reasonCode);
        } else if (decision.level === 'CRITICAL') {
            window.Aladinn.Sign.SessionGuard.stopSession(decision.reasonCode);
        }

        return { clicked: false, lastClick: lastClickTime };
    }

    function handleAutoClicks() {
        if (typeof window.Aladinn === 'undefined' || !window.Aladinn.Sign || !window.Aladinn.Sign.Policy) return;
        
        if (!window.Aladinn.Sign.Policy.isAutoSignAllowed()) return;
        if (!window.Aladinn.Sign.SessionGuard.isSessionValid()) return;

        // 1. SMARTCA CONFIRM
        const confirmResult = _tryAutoClick('smartCAConfirm', 2000, lastConfirmClick);
        if (confirmResult.clicked) lastConfirmClick = confirmResult.lastClick;

        // 2. HIS SUCCESS OK
        const okResult = _tryAutoClick('hisSuccessOk', 3000, lastOkClick);
        if (okResult.clicked) {
            lastOkClick = okResult.lastClick;
            window.Aladinn.Sign.SessionGuard.markStepCompleted('OK_CLICKED');
        }
    }

    if (document.body) {
        const observer = new MutationObserver(handleAutoClicks);
        observer.observe(document.body, { childList: true, subtree: true });
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            const observer = new MutationObserver(handleAutoClicks);
            observer.observe(document.body, { childList: true, subtree: true });
        });
    }
})();
