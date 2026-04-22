/**
 * 🧞 Aladinn — Unified Popup Logic
 */

async function initPopup() {
    // Helper to show errors safely
    function showError(msg) {
        let container = document.querySelector('.main-content') || document.body;
        let err = document.getElementById('aladinn-popup-err');
        if (!err) {
            err = document.createElement('div');
            err.id = 'aladinn-popup-err';
            err.style.cssText = 'color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; font-size: 13px; text-align: center; margin: 8px 16px; font-weight: 500; animation: fadeSlideUp 0.3s;';
            container.insertBefore(err, container.firstChild);
        }
        err.textContent = msg;
        setTimeout(() => { if (err) err.remove(); }, 3500);
    }

    // --- Section Visibilities based on Toggles ---
    const scannerSections = [document.getElementById('header-scanner'), document.getElementById('grid-scanner')];
    const signSections = [document.getElementById('header-sign'), document.getElementById('grid-sign')];

    function updateSectionVisibility(id, isVisible) {
        let els = [];
        if (id === 'toggle-scanner') els = scannerSections;
        if (id === 'toggle-sign') els = signSections;
        
        els.forEach(el => {
            if (el) {
                el.style.display = isVisible ? '' : 'none';
            }
        });
    }

    // --- Feature Toggles ---
    const toggleVoice = document.getElementById('toggle-voice');
    const toggleScanner = document.getElementById('toggle-scanner');
    const toggleSign = document.getElementById('toggle-sign');
    const toggleCds = document.getElementById('toggle-cds');

    chrome.storage.local.get('aladinn_features', (result) => {
        const features = { voice: true, scanner: true, sign: true, cds: true, ...result.aladinn_features };
        if(toggleVoice) { toggleVoice.checked = features.voice; updateSectionVisibility('toggle-voice', features.voice); }
        if(toggleScanner) { toggleScanner.checked = features.scanner; updateSectionVisibility('toggle-scanner', features.scanner); }
        if(toggleSign) { toggleSign.checked = features.sign; updateSectionVisibility('toggle-sign', features.sign); }
        if(toggleCds) toggleCds.checked = features.cds;
    });

    function saveFeatures(e) {
        const id = e.target.id;
        const features = {
            voice: toggleVoice ? toggleVoice.checked : true,
            scanner: toggleScanner ? toggleScanner.checked : true,
            sign: toggleSign ? toggleSign.checked : true,
            cds: toggleCds ? toggleCds.checked : true
        };
        chrome.storage.local.set({ aladinn_features: features });
        updateSectionVisibility(id, e.target.checked);
        
        // Notify content scripts
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'FEATURE_TOGGLE', features }).catch(() => {});
            }
        });

        // Notify background service worker directly
        chrome.runtime.sendMessage({ type: 'FEATURE_TOGGLE', features }).catch(() => {});

        if (id === 'toggle-voice') {
            chrome.storage.local.set({ aladinn_voice_enabled: features.voice });
            chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE', enabled: features.voice }).catch(() => {});
        }
    }

    [toggleVoice, toggleScanner, toggleSign, toggleCds].forEach(el => {
        if(el) el.addEventListener('change', saveFeatures);
    });

    function executeContentFunction(funcName, arg = null, errMsg = '⚠️ Vui lòng F5 tải lại trang VNPT HIS (Do Extension vừa được cập nhật)') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                world: 'ISOLATED',
                func: (fName, fArg) => {
                    if (window.Aladinn && window.Aladinn.Scanner) {
                        if (typeof window.Aladinn.Scanner[fName] === 'function') {
                            window.Aladinn.Scanner[fName](fArg);
                            return true;
                        }
                    }
                    return false;
                },
                args: [funcName, arg]
            }).then((results) => {
                if (results && results[0] && results[0].result === false) {
                    showError(errMsg);
                }
            }).catch((_err) => {
                showError('⚠️ Lỗi: Không thể thực thi. Bạn hãy F5 lại trang HIS.');
            });
        });
    }

    const getScanParams = (mode) => {
        const checkbox = document.getElementById('scan-selected-only');
        return { mode: mode, singleRow: checkbox ? checkbox.checked : false };
    };

    const btnConfig = [
        { id: 'scan-room-btn', action: () => executeContentFunction('startScanning', getScanParams('room')) },
        { id: 'scan-vitals-btn', action: () => executeContentFunction('startScanning', getScanParams('vitals')) },
        { id: 'scan-drugs-btn', action: () => executeContentFunction('startScanning', getScanParams('drugs')) },
        { id: 'scan-pttt-btn', action: () => executeContentFunction('startScanning', getScanParams('pttt')) },
        { id: 'scan-bhyt-btn', action: () => executeContentFunction('startScanning', getScanParams('bhyt')) },
        { id: 'ai-lab-summary-btn', action: () => executeContentFunction('showAiLabSummary') },
        { id: 'clear-cache-btn', action: () => executeContentFunction('clearCache') }
    ];

    btnConfig.forEach(cfg => {
        const el = document.getElementById(cfg.id);
        if (el) {
            el.addEventListener('click', () => {
                const icon = el.querySelector('.action-icon') || el.querySelector('span');
                if(icon) {
                    icon.style.transition = 'transform 0.2s';
                    icon.style.transform = 'scale(1.2)';
                    setTimeout(() => icon.style.transform = '', 200);
                }
                cfg.action();
            });
        }
    });
    
    // Dashboard
    const showDashBtn = document.getElementById('show-dashboard-btn');
    if(showDashBtn) showDashBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    world: 'ISOLATED',
                    func: () => { 
                        if (window.VNPTDashboard) {
                            window.VNPTDashboard.show();
                            return true;
                        } else if (window.Aladinn && window.Aladinn.Scanner && window.Aladinn.Scanner.UI && window.Aladinn.Scanner.UI.Dashboard) {
                            window.Aladinn.Scanner.UI.Dashboard.show(); 
                            return true;
                        }
                        return false;
                    }
                }).then((results) => {
                    if (results && results[0] && results[0].result === false) {
                        showError('⚠️ Không tìm thấy Module Dashboard.');
                    }
                }).catch(() => {
                    showError('⚠️ Vui lòng mở trang VNPT HIS');
                });
            }
        });
    });

    // Options Link
    const optBtn = document.getElementById('open-options-btn');
    if(optBtn) optBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // --- Sign Tab Logic ---
    const selectAllBtn = document.getElementById('sign-select-all-btn');
    if(selectAllBtn) selectAllBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'selectAll' }, (res) => {
                    if (chrome.runtime.lastError) {
                        showError('⚠️ Vui lòng tải lại trang VNPT HIS');
                        return;
                    }
                    if (res && res.count) {
                        const elSel = document.getElementById('sign-stat-selected');
                        if (elSel) elSel.textContent = res.count;
                    }
                });
            }
        });
    });

    const startBtn = document.getElementById('sign-start-btn');
    if(startBtn) startBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startSigning' }).then(() => {
                    window.close();
                }).catch(() => {
                    showError('⚠️ Không tìm thấy module Ký số.');
                });
            }
        });
    });

    // Update Checker UI
    const updateBanner = document.getElementById('update-banner');
    const updateVersion = document.getElementById('update-version');
    const updateChangelog = document.getElementById('update-changelog');
    const updateDownloadBtn = document.getElementById('update-download-btn');
    const updateDismissBtn = document.getElementById('update-dismiss-btn');
    const versionBadge = document.querySelector('.version-badge');

    const manifest = chrome.runtime.getManifest();
    if (versionBadge) versionBadge.textContent = `v${manifest.version}`;

    async function checkAndShowUpdate() {
        try {
            const result = await chrome.storage.local.get(['aladinn_update', 'aladinn_update_dismissed']);
            const update = result.aladinn_update;
            const dismissed = result.aladinn_update_dismissed;

            if (update && update.newVersion && dismissed !== update.newVersion) {
                if(updateVersion) updateVersion.textContent = `v${update.newVersion}`;
                const changelog = update.changelog || '';
                const firstLine = changelog.split('\n').find(l => l.trim()) || 'Bản cập nhật mới!';
                if(updateChangelog) updateChangelog.textContent = firstLine.replace(/^#+\s*/, '').substring(0, 50);

                if(updateDownloadBtn) {
                    if (update.releaseUrl) updateDownloadBtn.href = update.releaseUrl;
                    else if (update.downloadUrl) updateDownloadBtn.href = update.downloadUrl;
                }
                if(updateBanner) updateBanner.style.display = 'block';
            } else {
                if(updateBanner) updateBanner.style.display = 'none';
            }
        } catch (_err) {}
    }

    if (updateDismissBtn) {
        updateDismissBtn.addEventListener('click', async () => {
            const result = await chrome.storage.local.get('aladinn_update');
            const version = result.aladinn_update?.newVersion;
            if (version) chrome.runtime.sendMessage({ action: 'dismissUpdate', version }).catch(() => {});
            if(updateBanner) updateBanner.style.display = 'none';
        });
    }

    checkAndShowUpdate();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopup);
} else {
    initPopup();
}
