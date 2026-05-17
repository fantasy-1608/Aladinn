/**
 * 🧞 Aladinn — Auto-Click Helper (injected into ALL frames on vncare.vn)
 * Relies on the new modular Secure Signing Architecture (Policy, RiskEngine, Context, SafeClick).
 */
(function () {
    'use strict';

    let lastConfirmClick = 0;
    let lastOkClick = 0;

    console.log('[Aladinn/AutoClick] 🔄 Secure Helper loaded in frame:', window.location.href.substring(0, 80));

    function handleAutoClicks() {
        if (typeof window.Aladinn === 'undefined' || !window.Aladinn.Sign || !window.Aladinn.Sign.Policy) return;
        
        if (!window.Aladinn.Sign.Policy.isAutoSignAllowed()) return;
        if (!window.Aladinn.Sign.SessionGuard.isSessionValid()) return;

        // Prevent double click storm
        const now = Date.now();

        // 1. SMARTCA CONFIRM
        if (now - lastConfirmClick > 2000) {
            let context = window.Aladinn.Sign.Context.collect('smartCAConfirm');
            if (context.pageType !== 'UNKNOWN') {
                let decision = window.Aladinn.Sign.RiskEngine.evaluate(context, window.Aladinn.Sign.Policy.get());
                
                if (decision.level === 'LOW' || decision.level === 'MEDIUM') {
                    if (window.Aladinn.Sign.SessionGuard.assertCanAutoClick({ action: 'click_smartCAConfirm' })) {
                        const clicked = window.Aladinn.Sign.SafeClick.click('smartCAConfirm', context, window.Aladinn.Sign.SessionGuard.getSessionId());
                        if (clicked) lastConfirmClick = now;
                    }
                } else if (decision.level === 'HIGH') {
                    window.Aladinn.Sign.SessionGuard.pauseSession(decision.reasonCode);
                } else if (decision.level === 'CRITICAL') {
                    window.Aladinn.Sign.SessionGuard.stopSession(decision.reasonCode);
                }
            }
        }

        // 2. HIS SUCCESS OK
        if (now - lastOkClick > 3000) {
            let contextOk = window.Aladinn.Sign.Context.collect('hisSuccessOk');
            if (contextOk.pageType !== 'UNKNOWN') {
                let decisionOk = window.Aladinn.Sign.RiskEngine.evaluate(contextOk, window.Aladinn.Sign.Policy.get());
                
                if (decisionOk.level === 'LOW' || decisionOk.level === 'MEDIUM') {
                    if (window.Aladinn.Sign.SessionGuard.assertCanAutoClick({ action: 'click_hisSuccessOk' })) {
                        const clicked = window.Aladinn.Sign.SafeClick.click('hisSuccessOk', contextOk, window.Aladinn.Sign.SessionGuard.getSessionId());
                        if (clicked) {
                            lastOkClick = now;
                            window.Aladinn.Sign.SessionGuard.markStepCompleted('OK_CLICKED');
                        }
                    }
                } else if (decisionOk.level === 'HIGH') {
                    window.Aladinn.Sign.SessionGuard.pauseSession(decisionOk.reasonCode);
                } else if (decisionOk.level === 'CRITICAL') {
                    window.Aladinn.Sign.SessionGuard.stopSession(decisionOk.reasonCode);
                }
            }
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
