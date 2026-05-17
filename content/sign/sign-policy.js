window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.Policy = (function () {
    'use strict';

    const DEFAULT_SIGN_POLICY = {
        autoSignEnabled: false,
        requireRemoteConfig: true,
        failClosedOnConfigError: true,

        maxSessionMs: 10 * 60 * 1000,
        maxIdleMs: 2 * 60 * 1000,

        allowBackgroundTabClick: false,
        requireVisibleTab: true,

        allowConfirmAutoClick: true,
        allowOkAutoClick: true,
        allowAutoClosePdfTab: true,
        allowAutoNext: true,

        maxRiskForAutoClick: 'MEDIUM',

        requireSingleConfirmCandidate: true,
        requireNoUnselectedSignerSelect: true,
        requireNoMultipleSignerSelect: true,
        requireNoErrorText: true,

        auditEnabled: true,
        auditRetentionEvents: 1000
    };

    let currentPolicy = { ...DEFAULT_SIGN_POLICY };
    let remoteConfigLoaded = false;
    let remoteAutoSignEnabled = false;

    if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
        chrome.storage.local.get(['aladinn_remote_config', 'his_settings'], (result) => {
            _updateFromRemoteConfig(result.aladinn_remote_config);
            const settings = result.his_settings || {};
            if (settings.signSafeMode !== undefined) {
                currentPolicy.maxRiskForAutoClick = settings.signSafeMode ? 'LOW' : 'MEDIUM';
            }
        });

        chrome.storage.onChanged.addListener((changes, namespace) => {
            if (namespace === 'local' && changes.aladinn_remote_config) {
                _updateFromRemoteConfig(changes.aladinn_remote_config.newValue);
            }
            if (namespace === 'local' && changes.his_settings) {
                const settings = changes.his_settings.newValue || {};
                if (settings.signSafeMode !== undefined) {
                    currentPolicy.maxRiskForAutoClick = settings.signSafeMode ? 'LOW' : 'MEDIUM';
                }
            }
        });
    }

    function _updateFromRemoteConfig(rc) {
        if (!rc || typeof rc.features !== 'object') {
            remoteConfigLoaded = false;
            remoteAutoSignEnabled = false;
            return;
        }
        remoteConfigLoaded = true;
        remoteAutoSignEnabled = rc.features.autoSign !== false;
        if (rc.signPolicy) {
            currentPolicy = { ...DEFAULT_SIGN_POLICY, ...rc.signPolicy };
        }
    }

    function isAutoSignAllowed() {
        if (currentPolicy.requireRemoteConfig && !remoteConfigLoaded) return false;
        if (!remoteAutoSignEnabled) return false;
        return currentPolicy.autoSignEnabled || window.__aladinnSigningActive || false;
    }

    function get() {
        return { ...currentPolicy };
    }

    return {
        get,
        isAutoSignAllowed
    };
})();
console.log('[Aladinn] 🧞 Sign Policy loaded');
