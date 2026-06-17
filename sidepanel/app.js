// sidepanel/app.js

document.addEventListener('DOMContentLoaded', () => {
    // 1. Tab Switching Logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabPanes = document.querySelectorAll('.tab-pane');

    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove active class from all
            tabBtns.forEach(b => b.classList.remove('active'));
            tabPanes.forEach(p => p.classList.remove('active'));
            
            // Add active class to clicked
            btn.classList.add('active');
            const targetId = btn.getAttribute('data-target');
            document.getElementById(targetId).classList.add('active');
        });
    });

    // 2. Legacy Popup Logic (System Tab)
    const toggleScanner = document.getElementById('toggle-scanner');
    const toggleVoice = document.getElementById('toggle-voice');
    const toggleSign = document.getElementById('toggle-sign');
    const toggleCds = document.getElementById('toggle-cds');

    // Load initial states from storage
    chrome.storage.local.get(['aladinn_features'], (res) => {
        const features = res.aladinn_features || { voice: false, scanner: true, sign: false, cds: false };
        if (toggleScanner) toggleScanner.checked = !!features.scanner;
        if (toggleVoice) toggleVoice.checked = !!features.voice;
        if (toggleSign) toggleSign.checked = !!features.sign;
        if (toggleCds) toggleCds.checked = !!features.cds;
    });

    // Save states on change
    // Save states on change
    const updateFeatures = (e) => {
        const id = e ? e.target.id : null;
        const features = {
            scanner: toggleScanner ? toggleScanner.checked : true,
            voice: toggleVoice ? toggleVoice.checked : true,
            sign: toggleSign ? toggleSign.checked : true,
            cds: toggleCds ? toggleCds.checked : true
        };
        chrome.storage.local.set({ aladinn_features: features }, () => {
            // Notify content scripts in the active tab
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                if (tabs[0]) {
                    chrome.tabs.sendMessage(tabs[0].id, { type: 'FEATURE_TOGGLE', features }).catch(() => {});
                }
            });
            // Notify background service worker
            chrome.runtime.sendMessage({ type: 'FEATURE_TOGGLE', features }).catch(() => {});

            if (id === 'toggle-voice') {
                chrome.storage.local.set({ aladinn_voice_enabled: features.voice }, () => {
                    chrome.runtime.sendMessage({ type: 'TOGGLE_VOICE', enabled: features.voice }).catch(() => {});
                });
            }
        });
    };

    [toggleScanner, toggleVoice, toggleSign, toggleCds].forEach(el => {
        if (el) el.addEventListener('change', updateFeatures);
    });

    document.getElementById('open-options-btn')?.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
    });

    document.getElementById('clear-cache-btn')?.addEventListener('click', () => {
        if (confirm('Bạn có chắc chắn muốn xóa cache bộ nhớ? Phải đăng nhập lại.')) {
            chrome.storage.local.clear(() => {
                alert('Đã xóa cache. Vui lòng tải lại trang.');
            });
        }
    });

    // 3. Context Broker Listener
    const currentContextEl = document.getElementById('current-context');
    const actionZone = document.getElementById('dynamic-action-zone');

    // Mặc định
    const renderDefaultState = () => {
        currentContextEl.textContent = 'Đang tải ngữ cảnh...';
        actionZone.innerHTML = '<p class="helper-text">Các công cụ hỗ trợ sẽ tự động xuất hiện tại đây tuỳ theo màn hình bạn đang mở trên HIS.</p>';
    };

    function executeContentFunction(funcName, arg = null, errMsg = '⚠️ Lỗi thực thi') {
        chrome.runtime.sendMessage({
            type: 'POPUP_COMMAND',
            funcName: funcName,
            funcArg: arg
        }).then((response) => {
            if (response && response.success === false) alert(errMsg);
        }).catch(() => alert('⚠️ Vui lòng mở trang VNPT HIS và tải lại'));
    }

    const getScanParams = (mode) => ({ mode: mode });

    // Render nút tương ứng với context
    const renderContextActions = (context) => {
        actionZone.innerHTML = ''; // Clear

        if (context === 'PATIENT_LIST') {
            currentContextEl.textContent = 'Danh sách bệnh nhân';
            actionZone.innerHTML = `
                <div class="action-grid">
                    <button class="sys-btn glass-btn btn-success-glass" id="sp-btn-ai-summary" style="grid-column: 1 / -1;">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/><path d="M5 3v4"/><path d="M19 17v4"/><path d="M3 5h4"/><path d="M17 19h4"/></svg>
                        Tóm tắt CLS + Thuốc
                    </button>
                    <button class="sys-btn glass-btn" id="sp-btn-scan-bhyt" style="grid-column: 1 / -1;">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                        Quét BHYT
                    </button>
                    <button class="sys-btn glass-btn" id="sp-btn-scan-pttt" style="grid-column: 1 / -1;">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                        Quét PTTT
                    </button>
                </div>
            `;
            document.getElementById('sp-btn-scan-bhyt')?.addEventListener('click', () => executeContentFunction('startScanning', getScanParams('bhyt')));
            document.getElementById('sp-btn-scan-pttt')?.addEventListener('click', () => executeContentFunction('startScanning', getScanParams('pttt')));
            document.getElementById('sp-btn-ai-summary')?.addEventListener('click', () => executeContentFunction('showAiLabSummary'));
        } else if (['CONCILIUM', 'DISCHARGE', 'TRANSFER', 'ADMISSION', 'NUTRITION', 'MEDICAL_RECORD'].includes(context)) {
            const contextLabels = {
                'CONCILIUM': 'Phiếu Hội Chẩn',
                'DISCHARGE': 'Phiếu Xử Trí',
                'TRANSFER': 'Phiếu Chuyển Viện',
                'ADMISSION': 'Khám Vào Khoa',
                'NUTRITION': 'Phiếu Dinh Dưỡng',
                'MEDICAL_RECORD': 'Bệnh Án'
            };
            currentContextEl.textContent = contextLabels[context] || 'Biểu Mẫu';
            actionZone.innerHTML = `
                <div class="action-grid">
                    <button class="sys-btn glass-btn btn-success-glass" id="sp-btn-fill-form">
                        <svg class="btn-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22h6a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v3"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M5 17l-1.5 1.5c-1 1-3 .5-3-1v-4c0-1.5 2-2 3-1L5 14Z"/><path d="m5 14 3 3"/></svg>
                        Điền phiếu tự động
                    </button>
                </div>
            `;
            document.getElementById('sp-btn-fill-form')?.addEventListener('click', () => {
                chrome.runtime.sendMessage({
                    type: 'SIDE_PANEL_COMMAND',
                    action: 'TRIGGER_FILL',
                    context: context
                });
            });
        } else {
            currentContextEl.textContent = 'Không xác định (' + context + ')';
        }
    };

    // Lắng nghe Message từ Background hoặc Content Script
    chrome.runtime.onMessage.addListener((request, _sender, _sendResponse) => {
        if (request.type === 'CONTEXT_CHANGED') {
            renderContextActions(request.context);
        } else if (request.type === 'PATIENT_SELECTED') {
            const pCard = document.getElementById('patient-card');
            if (pCard) {
                pCard.classList.remove('empty');
                const diagHtml = request.diagnosis
                    ? `<div class="patient-diag">📋 ${request.diagnosis.slice(0, 60)}${request.diagnosis.length > 60 ? '...' : ''}</div>`
                    : '';
                pCard.innerHTML = `
                    <div class="patient-main">
                        <div class="patient-avatar active">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
                        </div>
                        <div class="patient-info">
                            <strong class="patient-name">${request.patientName || 'Bệnh nhân'}</strong>
                            <span class="patient-id">Mã BA: ${request.patientId}</span>
                            ${diagHtml}
                        </div>
                    </div>
                `;
            }

        } else if (request.type === 'VOICE_TRANSCRIPT_UPDATE') {
            const voiceZone = document.getElementById('voice-transcript-zone');
            const voiceContent = document.getElementById('voice-content');
            
            if (request.text && request.text.trim().length > 0) {
                voiceZone.classList.remove('hidden');
                voiceContent.textContent = request.text;
            } else {
                voiceZone.classList.add('hidden');
            }
        }
    });

    // Request initial context when side panel opens
    chrome.runtime.sendMessage({ type: 'REQUEST_CURRENT_CONTEXT' }, (response) => {
        if (response && response.context) {
            renderContextActions(response.context);
            if (response.patientId) {
                const pCard = document.getElementById('patient-card');
                pCard.classList.remove('empty');
                const diagHtml = response.diagnosis
                    ? `<div class="patient-diag">📋 ${response.diagnosis.slice(0, 60)}${response.diagnosis.length > 60 ? '...' : ''}</div>`
                    : '';
                pCard.innerHTML = `
                    <div class="patient-main">
                        <div class="patient-avatar active">
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
                        </div>
                        <div class="patient-info">
                            <strong class="patient-name">${response.patientName || 'Bệnh nhân'}</strong>
                            <span class="patient-id">Mã BA: ${response.patientId}</span>
                            ${diagHtml}
                        </div>
                    </div>
                `;

            }
        } else {
            renderDefaultState();
        }
    });


});
