/**
 * 🧞 Aladinn — Content Script Orchestrator
 * Entry point that initializes all 3 modules based on feature flags.
 * 
 * Load order (from manifest):
 * 1. lib/jquery.min.js
 * 2. content/shared/* (constants, utils, logger)
 * 3. content/scanner/* modules → scanner-init.js
 * 4. content/voice/* modules → voice-init.js
 * 5. content/content.js (THIS FILE - runs last)
 */

(function () {
    'use strict';

    // Only run in top frame for orchestration
    // Individual modules handle their own iframe logic
    if (window.__aladinnInitialized) return;
    window.__aladinnInitialized = true;

    // Khởi tạo HIS Shared Library cho Aladinn
    if (typeof HIS !== 'undefined' && HIS.init) {
        HIS.init({
            name: 'Aladinn',
            version: window.Aladinn?.VERSION || '1.1.6',
            prefix: 'aladinn',
            emoji: '🧞'
        });
    }

    const Logger = window.Aladinn?.Logger;

    // ========================================
    // FEATURE FLAG LOADING
    // ========================================
    async function loadFeatureFlags() {
        return new Promise((resolve) => {
            if (!chrome?.storage?.local) {
                resolve({ voice: true, scanner: true, sign: true, cds: true });
                return;
            }
            chrome.storage.local.get('aladinn_features', (result) => {
                const features = { voice: true, scanner: true, sign: true, cds: true, ...result.aladinn_features };
                window.Aladinn.features = features;
                resolve(features);
            });

        });
    }

    // ========================================
    // INJECT PAGE SCRIPTS (Scanner module)
    // ========================================
    function injectPageScripts() {
        const scripts = [
            'injected/token-capture.js',
            'injected/ajax-interceptor.js',
            'injected/grid-hook.js',
            'injected/api-bridge.js'
        ];

        let index = 0;
        function injectNext() {
            if (index >= scripts.length) return;
            const fileName = scripts[index++];
            const id = `aladinn-script-${fileName.replace(/\//g, '-')}`;
            if (document.getElementById(id)) {
                injectNext();
                return;
            }

            const script = document.createElement('script');
            script.id = id;

            // Add secure token for api-bridge
            if (fileName === 'injected/api-bridge.js') {
                const token = crypto.randomUUID();
                script.dataset.aladinnToken = token;
                window.__ALADINN_BRIDGE_TOKEN__ = token;
            }

            if (chrome?.runtime) {
                script.src = chrome.runtime.getURL(fileName);
            }
            script.onload = (e) => {
                e.target.remove();
                injectNext();
            };
            (document.head || document.documentElement).appendChild(script);
        }
        injectNext();
    }


    // ========================================
    // MODULE INITIALIZATION
    // ========================================
    async function initModules(features) {
        if (Logger) Logger.info('Main', `🧞 Aladinn v${window.Aladinn.VERSION} — Khởi tạo...`);

        // 🚏 Start unified Patient Observer (duy nhất 1 observer cho tất cả modules)
        if (window === window.top && HIS.PatientObserver) {
            HIS.PatientObserver.start();
            if (Logger) Logger.info('Main', '🔭 Patient Observer đã khởi động (shared)');
        }

        // Scanner Module
        if (features.scanner && window !== window.top) {
            // Scanner iframe helpers run in iframes, skip main init
        }

        if (features.scanner && window === window.top) {
            if (Logger) Logger.info('Main', '📊 Khởi tạo Scanner module...');
            injectPageScripts();
            try {
                if (window.Aladinn?.Scanner?.init) {
                    window.Aladinn.Scanner.init();
                    if (Logger) Logger.success('Main', '📊 Scanner module ✅');
                }
            } catch (err) {
                if (Logger) Logger.error('Main', '📊 Scanner module lỗi:', err);
            }
        }

        // Voice Module
        if (features.voice && window === window.top) {
            if (Logger) Logger.info('Main', '🎙️ Khởi tạo Voice module...');
            try {
                if (window.Aladinn?.Voice?.init) {
                    window.Aladinn.Voice.init();
                    if (Logger) Logger.success('Main', '🎙️ Voice module ✅');
                }
            } catch (err) {
                if (Logger) Logger.error('Main', '🎙️ Voice module lỗi:', err);
            }
        }

        // Sign Module
        if (features.sign && window === window.top) {
            if (Logger) Logger.info('Main', '✍️ Khởi tạo Sign module...');
            try {
                if (window.Aladinn?.Sign?.init) {
                    window.Aladinn.Sign.init();
                    if (Logger) Logger.success('Main', '✍️ Sign module ✅');
                }
            } catch (err) {
                if (Logger) Logger.error('Main', '✍️ Sign module lỗi:', err);
            }
        }

        // CDS Module
        if (features.cds && window === window.top) {
            if (Logger) Logger.info('Main', '🧠 Khởi tạo CDS module...');
            try {
                if (window.Aladinn?.CDS?.init) {
                    chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
                        const filterLow = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
                        window.Aladinn.CDS.init(true, filterLow);
                        if (Logger) Logger.success('Main', '🧠 CDS module ✅');
                    });
                } else {
                    // Retry after 1.5s in case of race condition with module registration
                    setTimeout(() => {
                        if (window.Aladinn?.CDS?.init) {
                            chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
                                const filterLow = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
                                window.Aladinn.CDS.init(true, filterLow);
                                if (Logger) Logger.success('Main', '🧠 CDS module (delayed) ✅');
                            });
                        } else {
                            if (Logger) Logger.warn('Main', '🧠 CDS module not found after retry.');
                        }
                    }, 1500);
                }
            } catch (err) {
                console.error('[Aladinn] 🧠 CDS module lỗi:', err);
                if (Logger) Logger.error('Main', '🧠 CDS module lỗi:', err);
            }
        }

        if (Logger) Logger.success('Main', '🧞 Aladinn đã sẵn sàng!');
    }

    // ========================================
    // MESSAGE LISTENER (Unified)
    // ========================================
    if (chrome?.runtime) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const { type, action } = message;

            // Voice module toggle
            if (type === 'TOGGLE_EXTENSION') {
                if (window.Aladinn?.Voice?.toggle) {
                    window.Aladinn.Voice.toggle(message.enabled);
                }
                sendResponse({ success: true });
            }

            // Scanner module actions
            if (action === 'TOGGLE_SCANNER_UI') {
                if (window.Aladinn?.Scanner?.Settings?.toggle) {
                    window.Aladinn.Scanner.Settings.toggle();
                }
                sendResponse({ success: true });
            }

            if (action === 'UPDATE_SETTINGS') {
                if (window.Aladinn?.Scanner?.Settings?.syncFromChrome) {
                    window.Aladinn.Scanner.Settings.syncFromChrome();
                } else if (window.Aladinn?.Scanner?.Settings?.init) {
                    window.Aladinn.Scanner.Settings.init();
                }
                sendResponse({ success: true });
            }

            // Feature toggle update
            if (type === 'FEATURE_TOGGLE') {
                window.Aladinn.features = message.features;

                // Voice toggle
                if (window.Aladinn?.Voice?.toggle) {
                    window.Aladinn.Voice.toggle(message.features.voice === true);
                }

                // Scanner toggle
                if (message.features.scanner === false) {
                    // Dừng scan đang chạy
                    if (window.VNPTScanFlow?.stop) window.VNPTScanFlow.stop();
                    // Ẩn native menu
                    const nativeMenu = document.querySelector('.vnpt-native-menu-item');
                    if (nativeMenu) nativeMenu.style.display = 'none';
                    // Ẩn settings panel
                    if (window.VNPTSettings?.hide) window.VNPTSettings.hide();
                    if (Logger) Logger.info('Main', '📊 Scanner module TẮT');
                } else {
                    // Hiện lại native menu nếu đã bị ẩn
                    const nativeMenu = document.querySelector('.vnpt-native-menu-item');
                    if (nativeMenu) nativeMenu.style.display = '';
                    if (Logger) Logger.info('Main', '📊 Scanner module BẬT');
                }

                // Sign toggle — forward to background để sync auto-sign state
                chrome.runtime.sendMessage({
                    type: 'FEATURE_TOGGLE',
                    features: message.features
                }).catch(() => {});

                // CDS toggle
                if (window.Aladinn?.CDS?.init) {
                    const cdsEnabled = message.features.cds === true;
                    chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
                        const filterLow = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
                        window.Aladinn.CDS.init(cdsEnabled, filterLow);
                    });
                }

                sendResponse({ success: true });
            }

            // Sign module actions (forwarded from popup/background)
            if (action === 'startSigning') {
                if (window.Aladinn?.Sign?.Signing?.startSession) {
                    window.Aladinn.Sign.Signing.startSession();
                }
                sendResponse({ success: true });
            }

            if (action === 'filterByCreator') {
                if (window.Aladinn?.Sign?.Filter?.filterByCreator) {
                    window.Aladinn.Sign.Filter.filterByCreator(message.userName, message.userId);
                }
                sendResponse({ success: true });
            }

            if (action === 'nextPatient' || action === 'next-patient') {
                if (window.Aladinn?.Sign?.Signing?.processNextPatient) {
                    window.Aladinn.Sign.Signing.processNextPatient(true);
                }
                sendResponse({ success: true });
            }

            return true;
        });
    }

    // ========================================
    // ENTRY POINT
    // ========================================
    loadFeatureFlags().then(features => {
        try {
            initModules(features);
        } catch (err) {
            console.error('[Aladinn] Critical error during initialization:', err);
        }
    });

})();
