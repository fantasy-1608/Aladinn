/**
 * 🧞 Aladinn — Unified Popup Logic
 */

document.addEventListener('DOMContentLoaded', async () => {
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
        toggleVoice.checked = features.voice;
        toggleScanner.checked = features.scanner;
        toggleSign.checked = features.sign;
        toggleCds.checked = features.cds;
        updateVoiceStatusUI(features.voice);
    });

    function saveFeatures() {
        const features = {
            voice: toggleVoice.checked,
            scanner: toggleScanner.checked,
            sign: toggleSign.checked,
            cds: toggleCds.checked
        };
        chrome.storage.local.set({ aladinn_features: features });
        
        // Notify content scripts
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { type: 'FEATURE_TOGGLE', features }).catch(() => {});
            }
        });

        // Notify background service worker directly (for auto-sign state sync)
        chrome.runtime.sendMessage({ type: 'FEATURE_TOGGLE', features }).catch(() => {});

        // Special handling for legacy voice badge/toggle
        chrome.storage.local.set({ aladinn_voice_enabled: features.voice });
        chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE', enabled: features.voice }).catch(() => {});
        updateVoiceStatusUI(features.voice);
    }

    toggleVoice.addEventListener('change', saveFeatures);
    toggleScanner.addEventListener('change', saveFeatures);
    toggleSign.addEventListener('change', saveFeatures);
    toggleCds.addEventListener('change', saveFeatures);

    function updateVoiceStatusUI(enabled) {
        const indicator = document.getElementById('voice-indicator');
        const title = document.getElementById('voice-status-title');
        const desc = document.getElementById('voice-status-desc');
        
        if (enabled) {
            indicator.classList.add('active');
            title.textContent = 'Voice AI Đang Bật';
            desc.textContent = 'Hoạt động trên trang khám bệnh, hội chẩn';
        } else {
            indicator.classList.remove('active');
            title.textContent = 'Voice AI Đã Tắt';
            desc.textContent = 'Bật lại phía trên để sử dụng AI';
        }
    }

    // 3. Scanner Actions
    function sendScannerAction(action) {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes('vncare.vn')) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    world: 'MAIN',
                    func: (cmd) => {
                        window.Aladinn && window.Aladinn.Scanner && window.Aladinn.Scanner.startScanning && window.Aladinn.Scanner.startScanning(cmd);
                    },
                    args: [action === 'scanRoom' ? 'room' : 'vitals']
                });
            } else {
                alert('Vui lòng mở trang VNPT HIS nội trú');
            }
        });
    }

    document.getElementById('scan-room-btn').addEventListener('click', () => sendScannerAction('scanRoom'));
    document.getElementById('scan-vitals-btn').addEventListener('click', () => sendScannerAction('scanVitals'));
    
    document.getElementById('show-dashboard-btn').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.scripting.executeScript({
                    target: { tabId: tabs[0].id },
                    world: 'MAIN',
                    func: () => { window.Aladinn && window.Aladinn.Scanner && window.Aladinn.Scanner.UI && window.Aladinn.Scanner.UI.Dashboard && window.Aladinn.Scanner.UI.Dashboard.show(); }
                });
            }
        });
    });

    document.getElementById('toggle-ui-btn').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { action: 'TOGGLE_SCANNER_UI' }).catch(() => {});
        });
    });

    // 4. Options Link
    document.getElementById('open-options-btn').addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    // 5. Sign Tab Logic
    const signAutoToggle = document.getElementById('sign-auto-toggle');
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

    document.getElementById('sign-select-all-btn').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes('vncare.vn')) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'selectAll' }, (res) => {
                    if (res && res.count) {
                        document.getElementById('sign-stat-selected').textContent = res.count;
                    }
                });
            } else {
                alert('Vui lòng mở trang VNPT HIS');
            }
        });
    });

    document.getElementById('sign-start-btn').addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url.includes('vncare.vn')) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startSigning' }).catch(() => {});
                window.close();
            } else {
                alert('Vui lòng mở trang VNPT HIS');
            }
        });
    });

    // Poll sign stats when sign tab is active
    function updateSignStats() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0] && tabs[0].url && tabs[0].url.includes('vncare.vn')) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'getSignStats' }, (res) => {
                    if (chrome.runtime.lastError || !res) return;
                    document.getElementById('sign-stat-selected').textContent = res.selected || 0;
                    document.getElementById('sign-stat-signed').textContent = res.signed || 0;
                    document.getElementById('sign-stat-skipped').textContent = res.skipped || 0;
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

    // Hiện version hiện tại
    const manifest = chrome.runtime.getManifest();
    if (versionBadge) versionBadge.textContent = `v${manifest.version}`;

    async function checkAndShowUpdate() {
        try {
            const result = await chrome.storage.local.get(['aladinn_update', 'aladinn_update_dismissed']);
            const update = result.aladinn_update;
            const dismissed = result.aladinn_update_dismissed;

            if (update && update.newVersion && dismissed !== update.newVersion) {
                // Có bản update mới chưa bị dismiss
                updateVersion.textContent = `v${update.newVersion}`;
                
                // Rút gọn changelog (lấy dòng đầu)
                const changelog = update.changelog || '';
                const firstLine = changelog.split('\n').find(l => l.trim()) || 'Bản cập nhật mới!';
                updateChangelog.textContent = firstLine.replace(/^#+\s*/, '').substring(0, 50);

                // Set download link
                if (update.releaseUrl) {
                    updateDownloadBtn.href = update.releaseUrl;
                } else if (update.downloadUrl) {
                    updateDownloadBtn.href = update.downloadUrl;
                }

                updateBanner.style.display = 'block';
            }
        } catch (_err) {
            // Ignore
        }
    }

    // Dismiss button
    if (updateDismissBtn) {
        updateDismissBtn.addEventListener('click', async () => {
            const result = await chrome.storage.local.get('aladinn_update');
            const version = result.aladinn_update?.newVersion;
            if (version) {
                chrome.runtime.sendMessage({ action: 'dismissUpdate', version }).catch(() => {});
            }
            updateBanner.style.display = 'none';
        });
    }

    // Check on popup open
    checkAndShowUpdate();

    // Initialization done.
});
