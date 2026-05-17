window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.RiskEngine = (function () {
    'use strict';

    const LEVELS = {
        LOW: 0,
        MEDIUM: 1,
        HIGH: 2,
        CRITICAL: 3
    };

    const REASON_CODES = {
        MULTIPLE_CONFIRM_BUTTONS: 'MULTIPLE_CONFIRM_BUTTONS',
        MULTIPLE_OK_BUTTONS: 'MULTIPLE_OK_BUTTONS',
        UNSELECTED_SIGNER_SELECT: 'UNSELECTED_SIGNER_SELECT',
        MULTIPLE_SIGNER_SELECTS: 'MULTIPLE_SIGNER_SELECTS',
        ERROR_DIALOG_DETECTED: 'ERROR_DIALOG_DETECTED',
        DOM_PATTERN_UNKNOWN: 'DOM_PATTERN_UNKNOWN',
        TAB_NOT_VISIBLE: 'TAB_NOT_VISIBLE',
        OK: 'OK'
    };

    function evaluate(context, policy) {
        if (!context || context.pageType === 'UNKNOWN') {
            return { level: 'CRITICAL', score: LEVELS.CRITICAL, reasonCode: REASON_CODES.DOM_PATTERN_UNKNOWN };
        }

        if (policy.requireVisibleTab && document.visibilityState !== 'visible') {
            return { level: 'HIGH', score: LEVELS.HIGH, reasonCode: REASON_CODES.TAB_NOT_VISIBLE };
        }

        if (context.hasErrorText && policy.requireNoErrorText) {
            return { level: 'CRITICAL', score: LEVELS.CRITICAL, reasonCode: REASON_CODES.ERROR_DIALOG_DETECTED };
        }

        if (context.pageType === 'SMARTCA_CONFIRM') {
            if (context.hasAmbiguousSignerSelect && policy.requireNoMultipleSignerSelect) {
                return { level: 'HIGH', score: LEVELS.HIGH, reasonCode: REASON_CODES.MULTIPLE_SIGNER_SELECTS };
            }
            if (context.hasUnselectedSignerSelect && policy.requireNoUnselectedSignerSelect) {
                return { level: 'HIGH', score: LEVELS.HIGH, reasonCode: REASON_CODES.UNSELECTED_SIGNER_SELECT };
            }
            if (context.candidateButtonsCount > 1 && policy.requireSingleConfirmCandidate) {
                return { level: 'HIGH', score: LEVELS.HIGH, reasonCode: REASON_CODES.MULTIPLE_CONFIRM_BUTTONS };
            }
        }

        if (context.pageType === 'HIS_SUCCESS_DIALOG') {
            if (context.candidateButtonsCount > 1) {
                return { level: 'HIGH', score: LEVELS.HIGH, reasonCode: REASON_CODES.MULTIPLE_OK_BUTTONS };
            }
        }

        // If all checks passed, it's LOW risk
        return { level: 'LOW', score: LEVELS.LOW, reasonCode: REASON_CODES.OK };
    }

    return {
        evaluate,
        LEVELS,
        REASON_CODES
    };
})();
console.log('[Aladinn] 🧞 Sign Risk Engine loaded');
