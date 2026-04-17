/**
 * 🧞 Aladinn — Unified Popup Logic
 */

async function initPopup() {
    // Helper to show errors inside Popup safely (No alert!)
    function showError(msg) {
        let container = document.querySelector('.action-grid') || document.body;
        let err = document.getElementById('aladinn-popup-err');
        if (!err) {
            err = document.createElement('div');
            err.id = 'aladinn-popup-err';
            err.style.cssText = 'grid-column: 1 / -1; color: #ef4444; background: rgba(239, 68, 68, 0.1); border: 1px solid rgba(239, 68, 68, 0.3); border-radius: 8px; padding: 10px; font-size: 13px; text-align: center; margin-top: 8px; font-weight: 500; animation: fadeSlideUp 0.3s;';
            container.parentNode.insertBefore(err, container.nextSibling);
        }
        err.textContent = msg;
        setTimeout(() => { if (err) err.remove(); }, 3500);
    }

    // 1. Tab Navigation
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            btn.classList.add('active');
            document.getElementById(btn.dataset.target).classList.add('active');
        });
    });

    // 2. Feature Toggles
    const toggleVoice = document.getElementById('toggle-voice');
    const toggleScanner = document.getElementById('toggle-scanner');
    const toggleSign = document.getElementById('toggle-sign');
    const toggleCds = document.getElementById('toggle-cds');
    chrome.storage.local.get('aladinn_features', (result) => {
        const features = { voice: true, scanner: true, sign: true, cds: true, ...result.aladinn_features };
        if(toggleVoice) toggleVoice.checked = features.voice;
        if(toggleScanner) toggleScanner.checked = features.scanner;
        if(toggleSign) toggleSign.checked = features.sign;
        if(toggleCds) toggleCds.checked = features.cds;
        updateVoiceStatusUI(features.voice);
    });

    function saveFeatures() {
        const features = {
            voice: toggleVoice ? toggleVoice.checked : true,
            scanner: toggleScanner ? toggleScanner.checked : true,
            sign: toggleSign ? toggleSign.checked : true,
            cds: toggleCds ? toggleCds.checked : true
        };
        chrome.storage.local.set({ aladinn_features: features });
        
        // Notify content scripts
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'FEATURE_TOGGLE', features }).catch(() => {});
            }
        });

        // Notify background service worker directly
        chrome.runtime.sendMessage({ type: 'FEATURE_TOGGLE', features }).catch(() => {});

        // Special handling
        chrome.storage.local.set({ aladinn_voice_enabled: features.voice });
        chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE', enabled: features.voice }).catch(() => {});
        updateVoiceStatusUI(features.voice);
    }

    if(toggleVoice) toggleVoice.addEventListener('change', saveFeatures);
    if(toggleScanner) toggleScanner.addEventListener('change', saveFeatures);
    if(toggleSign) toggleSign.addEventListener('change', saveFeatures);
    if(toggleCds) toggleCds.addEventListener('change', saveFeatures);

    function updateVoiceStatusUI(enabled) {
        const indicator = document.getElementById('voice-indicator');
        const title = document.getElementById('voice-status-title');
        const desc = document.getElementById('voice-status-desc');
        
        if(!indicator || !title || !desc) return;

        if (enabled) {
            indicator.classList.add('active');
            title.textContent = 'Trợ lý AI Đang Sẵn sàng';
            desc.textContent = 'Bấm vào biểu tượng Micro trên trang bệnh án để bắt đầu ra lệnh bằng giọng nói.';
        } else {
            indicator.classList.remove('active');
            title.textContent = 'Trợ lý AI Đã Tắt';
            desc.textContent = 'Bật lại phía trên phần điều khiển để dùng AI.';
        }
    }

    // 3. Scanner Actions
    function sendScannerAction(action) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            chrome.scripting.executeScript({
                target: { tabId: tabs[0].id },
                world: 'MAIN',
                func: (cmd) => {
                    if (window.Aladinn && window.Aladinn.Scanner && window.Aladinn.Scanner.startScanning) {
                        window.Aladinn.Scanner.startScanning(cmd);
                        return true;
                    }
                    return false;
                },
                args: [action === 'scanRoom' ? 'room' : 'vitals']
            }).then((results) => {
                if (results && results[0] && results[0].result === false) {
                    showError('⚠️ Module chưa khởi tạo. Vui lòng thử lại trên trang Nội trú.');
                }
            }).catch((err) => {
                showError('⚠️ Vui lòng mở trang VNPT HIS nội trú (hoặc tải lại trang)');
            });
        });
    }

    const scanRoomBtn = document.getElementById('scan-room-btn');
    const scanVitalsBtn = document.getElementById('scan-vitals-btn');
    if(scanRoomBtn) scanRoomBtn.addEventListener('click', () => sendScannerAction('scanRoom'));
    if(scanVitalsBtn) scanVitalsBtn.addEventListener('click', () => sendScannerAction('scanVitals'));
    
    const showDashBtn = document.getElementById('show-dashboard-btn');
    if(showDashBtn) showDashBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    world: 'MAIN',
                    func: () => { 
                        if (window.Aladinn && window.Aladinn.Scanner && window.Aladinn.Scanner.UI && window.Aladinn.Scanner.UI.Dashboard) {
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

    const toggleUiBtn = document.getElementById('toggle-ui-btn');
    if(toggleUiBtn) toggleUiBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_SCANNER_UI' }).catch(() => {
                    showError('⚠️ Không thể kết nối Giao diện Scanner.');
                });
            }
        });
    });

    // 4. Options Link
    const optBtn = document.getElementById('open-options-btn');
    if(optBtn) optBtn.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // 5. Sign Tab Logic
    const signAutoToggle = document.getElementById('sign-auto-toggle');
    if (signAutoToggle) {
        chrome.storage.sync.get(['autoSignEnabled'], (result) => {
            signAutoToggle.checked = result.autoSignEnabled !== false;
        });

        signAutoToggle.addEventListener('change', () => {
            const enabled = signAutoToggle.checked;
            chrome.storage.sync.set({ autoSignEnabled: enabled });
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, {
                        action: enabled ? 'enableAutoSign' : 'disableAutoSign'
                    }).catch(() => {});
                }
            });
        });
    }

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
                        document.getElementById('sign-stat-selected').textContent = res.count;
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

    // Poll sign stats when sign tab is active
    function updateSignStats() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getSignStats' }, (res) => {
                    if (chrome.runtime.lastError || !res) return;
                    const elSel = document.getElementById('sign-stat-selected');
                    const elSig = document.getElementById('sign-stat-signed');
                    const elSkip = document.getElementById('sign-stat-skipped');
                    if(elSel) elSel.textContent = res.selected || 0;
                    if(elSig) elSig.textContent = res.signed || 0;
                    if(elSkip) elSkip.textContent = res.skipped || 0;
                });
            }
        });
    }

    // Load sign session history
    function loadSignHistory() {
        chrome.storage.sync.get(['sessionHistory'], (result) => {
            const history = result.sessionHistory || [];
            const list = document.getElementById('sign-history-list');
            if (!list) return;

            if (history.length === 0) {
                list.innerHTML = '<li class="sign-history-empty">Chưa có phiên ký số</li>';
                return;
            }

            list.innerHTML = '';
            history.slice(0, 10).forEach(item => {
                const li = document.createElement('li');
                li.className = 'sign-history-item';
                li.innerHTML = `<span class="sign-history-name">${item.name || 'N/A'}</span><span class="sign-history-time">${item.time || ''}</span>`;
                list.appendChild(li);
            });
        });
    }

    updateSignStats();
    loadSignHistory();
    setInterval(updateSignStats, 2000);

    // ========================================
    // UPDATE CHECKER UI
    // ========================================
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
                    if (update.releaseUrl) {
                        updateDownloadBtn.href = update.releaseUrl;
                    } else if (update.downloadUrl) {
                        updateDownloadBtn.href = update.downloadUrl;
                    }
                }
                if(updateBanner) updateBanner.style.display = 'block';
            }
        } catch (_err) {
            // Ignore
        }
    }

    if (updateDismissBtn) {
        updateDismissBtn.addEventListener('click', async () => {
            const result = await chrome.storage.local.get('aladinn_update');
            const version = result.aladinn_update?.newVersion;
            if (version) {
                chrome.runtime.sendMessage({ action: 'dismissUpdate', version }).catch(() => {});
            }
            if(updateBanner) updateBanner.style.display = 'none';
        });
    }

    checkAndShowUpdate();
}

// Ensure execution happens correctly even if deferred module
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopup);
} else {
    initPopup();
}
