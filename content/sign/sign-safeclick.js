window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.SafeClick = (function () {
    'use strict';

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

    function click(targetName, context, sessionId) {
        lastFailureReason = null;
        const btn = _findButton(targetName);
        if (!btn) {
            lastFailureReason = 'BUTTON_NOT_FOUND';
            return false;
        }

        // Validate text if needed
        const btnText = btn.textContent.trim();
        const registry = SIGN_SELECTOR_REGISTRY[targetName];
        
        if (registry.forbiddenTexts.some(w => btnText.includes(w))) {
            lastFailureReason = 'FORBIDDEN_TEXT';
            return false;
        }

        btn.dataset.aladinnClicked = '1';
        btn.click();
        
        // Log audit
        if (window.Aladinn.Sign.Audit) {
            window.Aladinn.Sign.Audit.logEvent({
                eventType: 'auto_click',
                sessionId: sessionId,
                action: 'click_' + targetName,
                result: 'success',
                reasonCode: 'OK',
                riskLevel: 'LOW'
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
        explainLastFailure
    };
})();
console.log('[Aladinn] 🧞 Sign SafeClick loaded');
