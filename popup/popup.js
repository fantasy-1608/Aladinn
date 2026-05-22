/**
 * 🧞 Aladinn — Popup Logic v2 (Redesigned)
 */

async function initPopup() {
    // ── Error display ──
    function showError(msg) {
        let container = document.querySelector('.main-content') || document.body;
        let err = document.getElementById('aladinn-popup-err');
        if (!err) {
            err = document.createElement('div');
            err.id = 'aladinn-popup-err';
            err.className = 'popup-error';
            container.insertBefore(err, container.firstChild);
        }
        err.textContent = msg;
        setTimeout(() => { if (err) err.remove(); }, 3500);
    }

    // ── Section visibility ──
    const sectionScanner = document.getElementById('section-scanner');
    const sectionSign = document.getElementById('section-sign');

    function updateSectionVisibility(id, isVisible) {
        if (id === 'toggle-scanner' && sectionScanner) sectionScanner.style.display = isVisible ? '' : 'none';
        if (id === 'toggle-sign' && sectionSign) sectionSign.style.display = isVisible ? '' : 'none';
    }

    // ── Feature Toggles (Chips) ──
    const toggleScanner = document.getElementById('toggle-scanner');
    const toggleVoice = document.getElementById('toggle-voice');
    const toggleSign = document.getElementById('toggle-sign');
    const toggleCds = document.getElementById('toggle-cds');

    const chipMap = {
        'toggle-scanner': document.getElementById('chip-scanner'),
        'toggle-voice': document.getElementById('chip-voice'),
        'toggle-sign': document.getElementById('chip-sign'),
        'toggle-cds': document.getElementById('chip-cds')
    };

    function syncChipState(id, checked) {
        const chip = chipMap[id];
        if (chip) chip.classList.toggle('active', checked);
    }

    chrome.storage.local.get('aladinn_features', (result) => {
        const features = { voice: true, scanner: true, sign: true, cds: true, ...result.aladinn_features };
        if (toggleVoice) { toggleVoice.checked = features.voice; syncChipState('toggle-voice', features.voice); }
        if (toggleScanner) { toggleScanner.checked = features.scanner; syncChipState('toggle-scanner', features.scanner); updateSectionVisibility('toggle-scanner', features.scanner); }
        if (toggleSign) { toggleSign.checked = features.sign; syncChipState('toggle-sign', features.sign); updateSectionVisibility('toggle-sign', features.sign); }
        if (toggleCds) { toggleCds.checked = features.cds; syncChipState('toggle-cds', features.cds); }
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
        syncChipState(id, e.target.checked);
        updateSectionVisibility(id, e.target.checked);

        // Notify content scripts
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) chrome.tabs.sendMessage(tabs[0].id, { type: 'FEATURE_TOGGLE', features }).catch(() => {});
        });
        chrome.runtime.sendMessage({ type: 'FEATURE_TOGGLE', features }).catch(() => {});

        if (id === 'toggle-voice') {
            chrome.storage.local.set({ aladinn_voice_enabled: features.voice });
            chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE', enabled: features.voice }).catch(() => {});
        }
    }

    [toggleVoice, toggleScanner, toggleSign, toggleCds].forEach(el => {
        if (el) el.addEventListener('change', saveFeatures);
    });

    // ── Execute Content Function ──
    function executeContentFunction(funcName, arg = null, errMsg = '⚠️ Vui lòng F5 tải lại trang VNPT HIS') {
        chrome.runtime.sendMessage({
            type: 'POPUP_COMMAND',
            funcName: funcName,
            funcArg: arg
        }).then((response) => {
            if (response && response.success === false) {
                showError(errMsg);
            }
        }).catch(() => {
            showError('⚠️ Lỗi: Không thể thực thi. Bạn hãy F5 lại trang HIS.');
        });
    }

    // ── Scan Params ──
    const getScanParams = (mode) => {
        return { mode: mode };
    };

    // ── Patient Context Card ──
    const patientCard = document.getElementById('patient-card');

    function fetchPatientContext() {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (!tabs[0]) return;
            chrome.tabs.sendMessage(tabs[0].id, { type: 'GET_PATIENT_CONTEXT' }, (response) => {
                if (chrome.runtime.lastError || !response) {
                    renderPatientCard(null);
                    return;
                }
                renderPatientCard(response);
            });
        });
    }

    function renderPatientCard(ctx) {
        if (!patientCard) return;

        if (!ctx || !ctx.name) {
            patientCard.className = 'patient-card empty';
            patientCard.innerHTML = `
                <span class="patient-empty-text">
                    <svg class="al-icon al-icon-sm" viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2" stroke-linecap="round">
                        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
                        <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
                    </svg>
                    Chọn bệnh nhân trên danh sách
                </span>`;
            return;
        }

        patientCard.className = 'patient-card';
        const initial = (ctx.name || '?')[0];
        const metaParts = [];
        if (ctx.birthYear) metaParts.push(`SN: ${ctx.birthYear}`);
        if (ctx.bed) metaParts.push(`Giường ${ctx.bed}`);
        if (ctx.dayCount) metaParts.push(`Ngày ${ctx.dayCount}`);

        patientCard.innerHTML = `
            <div class="patient-info">
                <div class="patient-avatar">${initial}</div>
                <div class="patient-details">
                    <div class="patient-name">${escapeHtml(ctx.name)}</div>
                    <div class="patient-meta">${metaParts.join(' · ') || ''}</div>
                </div>
            </div>
            ${ctx.diagnosis ? `<div class="patient-diag" title="${escapeHtml(ctx.diagnosis)}">${escapeHtml(ctx.diagnosis)}</div>` : ''}`;
    }

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    // Fetch patient context on load
    fetchPatientContext();

    // ── Connection Status Dot ──
    const connectionDot = document.getElementById('connection-dot');
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (!tabs[0]) return;
        const url = tabs[0].url || '';
        const isHIS = url.includes('vncare.vn') || url.includes('vnpthis');
        if (connectionDot) {
            connectionDot.classList.toggle('connected', isHIS);
            connectionDot.title = isHIS ? 'Đã kết nối VNPT HIS' : 'Chưa kết nối HIS';
        }
    });

    // ── Action Buttons ──
    const btnConfig = [
        { id: 'scan-room-btn', action: () => executeContentFunction('startScanning', getScanParams('room')) },
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
                // Micro-animation: press effect
                const icon = el.querySelector('.action-icon') || el.querySelector('.btn-emoji') || el.querySelector('span');
                if (icon) {
                    icon.style.transition = 'transform 0.15s';
                    icon.style.transform = 'scale(1.2)';
                    setTimeout(() => icon.style.transform = '', 150);
                }
                cfg.action();
            });
        }
    });

    // Dashboard
    const showDashBtn = document.getElementById('show-dashboard-btn');
    if (showDashBtn) showDashBtn.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'POPUP_SHOW_DASHBOARD' }).then((response) => {
            if (response && response.success === false) showError('⚠️ Không tìm thấy Module Dashboard.');
        }).catch(() => showError('⚠️ Vui lòng mở trang VNPT HIS'));
    });

    // Options
    const optBtn = document.getElementById('open-options-btn');
    if (optBtn) optBtn.addEventListener('click', () => chrome.runtime.openOptionsPage());

    // ── Sign Section — Compact ──
    const selectAllBtn = document.getElementById('sign-select-all-btn');
    if (selectAllBtn) selectAllBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'selectAll' }, (res) => {
                    if (chrome.runtime.lastError) {
                        showError('⚠️ Vui lòng tải lại trang VNPT HIS');
                        return;
                    }
                    if (res && res.count) {
                        const statusText = document.getElementById('sign-status-text');
                        if (statusText) statusText.textContent = `Đã chọn ${res.count} hồ sơ`;
                    }
                });
            }
        });
    });

    const startBtn = document.getElementById('sign-start-btn');
    if (startBtn) startBtn.addEventListener('click', () => {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, { action: 'startSigning' }).then(() => {
                    window.close();
                }).catch(() => showError('⚠️ Không tìm thấy module Ký số.'));
            }
        });
    });

    // ── Version Badge ──
    const versionBadge = document.querySelector('.version-badge');
    const manifest = chrome.runtime.getManifest();
    if (versionBadge) versionBadge.textContent = `v${manifest.version}`;

    // ── Update Checker ──
    const updateBanner = document.getElementById('update-banner');
    const updateVersion = document.getElementById('update-version');
    const updateChangelog = document.getElementById('update-changelog');
    const updateDownloadBtn = document.getElementById('update-download-btn');
    const updateDismissBtn = document.getElementById('update-dismiss-btn');

    async function checkAndShowUpdate() {
        try {
            const result = await chrome.storage.local.get(['aladinn_update', 'aladinn_update_dismissed']);
            const update = result.aladinn_update;
            const dismissed = result.aladinn_update_dismissed;

            if (update && update.newVersion && dismissed !== update.newVersion) {
                if (updateVersion) updateVersion.textContent = `v${update.newVersion}`;
                const changelog = update.changelog || '';
                const firstLine = changelog.split('\n').find(l => l.trim()) || 'Bản cập nhật mới!';
                if (updateChangelog) updateChangelog.textContent = firstLine.replace(/^#+\s*/, '').substring(0, 50);

                if (updateDownloadBtn) {
                    if (update.releaseUrl) updateDownloadBtn.href = update.releaseUrl;
                    else if (update.downloadUrl) updateDownloadBtn.href = update.downloadUrl;
                }
                if (updateBanner) updateBanner.style.display = 'block';
            } else {
                if (updateBanner) updateBanner.style.display = 'none';
            }
        } catch (_err) {}
    }

    if (updateDismissBtn) {
        updateDismissBtn.addEventListener('click', async () => {
            const result = await chrome.storage.local.get('aladinn_update');
            const version = result.aladinn_update?.newVersion;
            if (version) chrome.runtime.sendMessage({ action: 'dismissUpdate', version }).catch(() => {});
            if (updateBanner) updateBanner.style.display = 'none';
        });
    }

    checkAndShowUpdate();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPopup);
} else {
    initPopup();
}
