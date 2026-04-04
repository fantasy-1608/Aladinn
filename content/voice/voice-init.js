/**
 * 🧞 Aladinn — Voice Module Orchestrator (v2.6.0)
 * Replaces the old content.js from HisPro Voice Assistant.
 * Fits into the Aladinn namespace.
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Voice = window.Aladinn.Voice || {};

(function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;
    
    // Globals maintained for backward compatibility inside the module
    window.isExtensionEnabled = false;
    window.transcript = '';
    window.isLocked = false;
    window.isPanelOpen = false;

    window.Aladinn.Voice.init = async function () {
        if (Logger) Logger.info('Voice.Init', 'Bắt đầu khởi tạo Voice module...');

        try {
            // Get enabled state from unified storage
            const result = await new Promise(resolve => {
                chrome.storage.local.get('aladinn_voice_enabled', resolve);
            });
            window.isExtensionEnabled = result.aladinn_voice_enabled !== false;

            if (window.isExtensionEnabled) {
                setupVoiceExtension();
            } else {
                if (Logger) Logger.debug('Voice.Init', 'Voice module is currently disabled');
            }

            // Export toggle function to Aladinn namespace
            window.Aladinn.Voice.toggle = function(enabled) {
                window.isExtensionEnabled = enabled;
                const panel = document.getElementById('his-floating-panel');
                const miniBtn = document.getElementById('his-mini-btn');

                if (enabled) {
                    if (panel && miniBtn) {
                        panel.classList.remove('aladinn-hidden');
                        miniBtn.classList.remove('aladinn-hidden');
                    } else {
                        setupVoiceExtension();
                    }
                } else {
                    if (panel) panel.classList.add('aladinn-hidden');
                    if (miniBtn) miniBtn.classList.add('aladinn-hidden');
                    
                    // Cleanup observer for performance
                    if (typeof window.miniBtnObserver !== 'undefined' && window.miniBtnObserver) {
                        window.miniBtnObserver.disconnect();
                    }
                }
            };
            
        } catch (err) {
            if (Logger) Logger.error('Voice.Init', 'Lỗi khởi tạo:', err);
        }
    };

    function setupVoiceExtension() {
        if (document.getElementById('his-mini-btn')) return;

        if (Logger) Logger.debug('Voice.Init', 'Setting up UI & Speech Recognition');
        
        // Functions from ui.js, speech.js, storage.js
        if (window.createFloatingPanel) window.createFloatingPanel();
        if (window.initSpeechRecognition) window.initSpeechRecognition();
        if (window.loadSavedData) window.loadSavedData();
    }

})();
