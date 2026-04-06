/**
 * 🧞 Aladinn — Unified Options Logic
 */
import HISDiagnostic from '../shared/diagnostic.js';

document.addEventListener('DOMContentLoaded', () => {

    // --- Tab Navigation ---
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.section');

    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(sec => sec.classList.remove('active'));

            item.classList.add('active');
            document.getElementById(item.dataset.target).classList.add('active');
        });
    });

    // --- Load Data ---
    const elements = {
        apiKey: document.getElementById('opt-api-key'),
        aiModel: document.getElementById('opt-ai-model'),
        chuyenVien: document.getElementById('opt-voice-chuyenvien'),
        scanTooltip: document.getElementById('opt-scan-tooltip'),
        scanNutrition: document.getElementById('opt-scan-nutrition'),
        cdsFilterLow: document.getElementById('opt-cds-filter-low'),
        pin: document.getElementById('opt-pin')
    };

    // Track crypto state for save operations
    let _pinSalt = '';
    let _hasPinHash = false;
    let _currentPinForEncrypt = ''; // Only held in memory temporarily during save

    function loadSettings() {
        chrome.storage.local.get([
            'geminiApiKey',
            'geminiApiKey_encrypted',
            'selectedModel', 
            'aladinn_voice_appSettings',
            'dashboard_password', // Legacy plaintext PIN (will be migrated)
            'pin_hash',
            'pin_salt'
        ], async (localRes) => {
            // --- Auto-migrate legacy plaintext if needed ---
            if (localRes.dashboard_password && !localRes.pin_hash) {
                const salt = _generateSalt();
                const hash = await _hashPIN(localRes.dashboard_password, salt);
                let encKey = '';
                if (localRes.geminiApiKey && !localRes.geminiApiKey.includes(':')) {
                    encKey = await _encryptAPIKey(localRes.geminiApiKey, localRes.dashboard_password, salt);
                }
                const patch = { pin_hash: hash, pin_salt: salt };
                if (encKey) patch.geminiApiKey_encrypted = encKey;
                chrome.storage.local.set(patch);
                chrome.storage.local.remove('dashboard_password');
                localRes.pin_hash = hash;
                localRes.pin_salt = salt;
                if (encKey) localRes.geminiApiKey_encrypted = encKey;
                console.log('[Aladinn Options] Auto-migrated plaintext PIN → hash');
            }

            // --- Load API Key (try decrypted first, fallback to plaintext) ---
            if (localRes.geminiApiKey && !localRes.geminiApiKey.includes(':')) {
                // Plaintext API key (legacy or no PIN set)
                elements.apiKey.value = localRes.geminiApiKey;
            } else if (localRes.geminiApiKey_encrypted) {
                // Encrypted — will show placeholder, user needs PIN to see
                elements.apiKey.value = '';
                elements.apiKey.placeholder = '🔒 API Key đã được mã hóa. Nhập PIN để xem.';
            }

            if (localRes.selectedModel) {
                const exists = Array.from(elements.aiModel.options).some(opt => opt.value === localRes.selectedModel);
                if (!exists) {
                    const opt = document.createElement('option');
                    opt.value = localRes.selectedModel;
                    opt.textContent = localRes.selectedModel + ' (Đã lưu)';
                    elements.aiModel.appendChild(opt);
                }
                elements.aiModel.value = localRes.selectedModel;
            }
            
            const vSettings = localRes.aladinn_voice_appSettings || {};
            elements.chuyenVien.checked = vSettings.autoChuyenVien !== false;
            
            // --- PIN UI ---
            _pinSalt = localRes.pin_salt || '';
            _hasPinHash = !!(localRes.pin_hash && localRes.pin_salt);

            if (_hasPinHash) {
                elements.pin.value = '••••••'; // Masked
                initPinUI('••••••');
            } else {
                initPinUI('');
            }
        });

        // Load scanner settings from localStore (bridging legacy and current his_settings)
        chrome.storage.local.get(['vnpt_scanner_settings', 'his_settings'], (res) => {
            const sSettings = res.his_settings || res.vnpt_scanner_settings || { vitalsDisplay: true, templateAutofill: true };
            elements.scanTooltip.checked = sSettings.vitalsDisplay !== undefined ? sSettings.vitalsDisplay : (sSettings.showTooltip || false);
            elements.scanNutrition.checked = sSettings.templateAutofill !== undefined ? sSettings.templateAutofill : (sSettings.autoForm || false);
        });



        // Load CDS settings
        chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
            if (elements.cdsFilterLow) {
                elements.cdsFilterLow.checked = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
            }
        });

        // Setup fetch models button
        document.getElementById('fetch-models-btn').addEventListener('click', fetchModels);
    }

    async function fetchModels() {
        const apiKey = elements.apiKey.value.trim();
        if (!apiKey) {
            showToast('⚠️ Vui lòng nhập API Key trước khi dò tìm!', true);
            return;
        }

        const btn = document.getElementById('fetch-models-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Đang dò...';
        btn.disabled = true;

        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                headers: { 'x-goog-api-key': apiKey }
            });
            if (!response.ok) {
                throw new Error(`Lỗi API (${response.status}) - Kiểm tra lại API Key`);
            }
            const data = await response.json();
            
            // Filter models that support generation and are gemini models
            const validModels = (data.models || []).filter(m => 
                m.name.includes('gemini') && 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes('generateContent')
            );

            if (validModels.length === 0) {
                showToast('Không tìm thấy mô hình Gemini khả dụng.', true);
                return;
            }

            // Save current selection to restore if possible
            const currentSelected = elements.aiModel.value;
            
            // Clear existing options
            elements.aiModel.innerHTML = '';
            
            // Add new options, sorted by name
            validModels.sort((a, b) => b.name.localeCompare(a.name)).forEach(model => {
                const option = document.createElement('option');
                // Strip "models/" prefix
                const modelValue = model.name.replace('models/', '');
                option.value = modelValue;
                option.textContent = `${model.displayName} (${model.version})`;
                
                // Add recommendation hints
                if (modelValue.includes('2.5-flash')) {
                    option.textContent = `${model.displayName} (Khuyên dùng - Mới nhất)`;
                } else if (modelValue.includes('1.5-flash') && !validModels.some(m => m.name.includes('2.5-flash'))) {
                    option.textContent = `${model.displayName} (Khuyên dùng)`;
                }
                
                elements.aiModel.appendChild(option);
            });

            // Restore selection if exists, else select the best default (usually 2.5 flash or latest)
            let match = Array.from(elements.aiModel.options).find(opt => opt.value === currentSelected);
            if (match) {
                elements.aiModel.value = currentSelected;
            } else {
                elements.aiModel.selectedIndex = 0; // Usually the newest based on sort
            }

            showToast('✅ Đã cập nhật danh sách mô hình!');
            
        } catch (err) {
            showToast(`Lỗi: ${err.message}`, true);
        } finally {
            btn.innerHTML = originalText;
            btn.disabled = false;
        }
    }

    // --- Save Data ---
    document.getElementById('save-all-btn').addEventListener('click', async () => {
        const apiKeyVal = elements.apiKey.value.trim();
        updateHiddenPinStr(); // Ensure we have the latest entered PIN
        const pinVal = elements.pin.value.trim();

        if (pinVal.length > 0 && pinVal.length < 6 && !pinVal.includes('•')) {
            showToast('Mã PIN phải đủ 6 số!', true);
            return;
        }

        const isNewPin = pinVal.length === 6 && !pinVal.includes('•');

        // FORCE PIN FOR API KEY
        if (apiKeyVal && !_hasPinHash && !isNewPin) {
            showToast('Bắt buộc phải thiết lập mã PIN (6 số) để bảo mật API Key!', true);
            return;
        }

        // We MUST preserve existing his_settings if they exist
        const res = await new Promise(r => chrome.storage.local.get(['his_settings'], r));
        const currentHisSettings = res.his_settings || {
            scanTimeout: 5000, apiTimeout: 8000, autoScan: true, 
            vitalsDisplay: true, historySummary: true, templateAutofill: true, 
            darkMode: false, aiEnabled: false, geminiApiKey: '', geminiModel: 'gemini-1.5-flash'
        };

        // Update with options page values
        currentHisSettings.vitalsDisplay = elements.scanTooltip.checked;
        currentHisSettings.templateAutofill = elements.scanNutrition.checked;
        currentHisSettings.geminiModel = elements.aiModel.value;

        const aiVipToggle = document.getElementById('opt-scan-aivip');
        if (aiVipToggle) {
            currentHisSettings.aiEnabled = aiVipToggle.checked;
        }

        const localPatch = {
            selectedModel: elements.aiModel.value,
            aladinn_voice_appSettings: { autoChuyenVien: elements.chuyenVien.checked },
            his_settings: currentHisSettings,
            vnpt_scanner_settings: {
                showTooltip: elements.scanTooltip.checked,
                autoForm: elements.scanNutrition.checked
            },
            vnpt_cds_settings: {
                filterLow: elements.cdsFilterLow.checked
            }
        };

        // --- Crypto: Hash PIN + Encrypt API Key ---
        if (isNewPin) {
            // Check crypto availability first
            if (!crypto?.subtle) {
                showToast('❌ Trình duyệt không hỗ trợ mã hóa (crypto.subtle). Vui lòng cập nhật Chrome.', true);
                return;
            }
            try {
                const salt = _generateSalt();
                const hash = await _hashPIN(pinVal, salt);
                localPatch.pin_hash = hash;
                localPatch.pin_salt = salt;
                _pinSalt = salt;
                _hasPinHash = true;
                _currentPinForEncrypt = pinVal;

                // Encrypt API key with new PIN
                if (apiKeyVal) {
                    const encryptedKey = await _encryptAPIKey(apiKeyVal, pinVal, salt);
                    localPatch.geminiApiKey_encrypted = encryptedKey;
                }

                // Remove legacy plaintext PIN and plaintext API key
                chrome.storage.local.remove(['dashboard_password', 'geminiApiKey']);

                initPinUI('••••••');
            } catch (cryptoErr) {
                console.error('[Aladinn Options] Lỗi mã hóa PIN:', cryptoErr);
                showToast(`❌ Lỗi mã hóa PIN: ${cryptoErr.message || 'Unknown error'}. Kiểm tra Console.`, true);
                return;
            }
        } else {
            // PIN unchanged
            if (_hasPinHash && apiKeyVal && _currentPinForEncrypt) {
                // PIN exists → encrypt API key, do NOT save plaintext
                try {
                    const encryptedKey = await _encryptAPIKey(apiKeyVal, _currentPinForEncrypt, _pinSalt);
                    localPatch.geminiApiKey_encrypted = encryptedKey;
                    // Remove any leftover plaintext
                    chrome.storage.local.remove('geminiApiKey');
                } catch (_e) {
                    showToast('Lỗi mã hóa API Key.', true);
                    return;
                }
            } else if (apiKeyVal && !_hasPinHash) {
                 // Should be blocked by the early return, but just in case
                 showToast('Không lưu được: Yêu cầu mã PIN!', true);
                 return;
            }
        }

        chrome.storage.local.set(localPatch, () => {
            chrome.storage.sync.set({}, () => {
                showToast('✅ Đã lưu cấu hình thành công!');
                _currentPinForEncrypt = ''; // Clear from memory
                
                // Notify content scripts to refresh settings
                chrome.tabs.query({url: '*://*.vncare.vn/*'}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_SETTINGS' });
                    });
                });
            });
        });
    });

    // --- PIN Management ---
    const pinBoxes = document.querySelectorAll('.pin-box');
    const pinHidden = document.getElementById('opt-pin');
    const pinTitle = document.getElementById('pin-title');
    const pinHelp = document.getElementById('pin-help-text');
    const pinActions = document.getElementById('pin-actions');
    const btnChangePin = document.getElementById('btn-change-pin');
    const btnResetPin = document.getElementById('btn-reset-pin');
    
    let _hasExistingPin = false;

    function initPinUI(existingPin) {
        if (existingPin && existingPin.length >= 6) {
            _hasExistingPin = true;
            pinHidden.value = existingPin;
            pinTitle.textContent = 'Mã PIN hiện tại';
            pinHelp.textContent = '🔒 Trạng thái: Đã thiết lập mã PIN bảo vệ (mã hóa PBKDF2).';
            pinBoxes.forEach(b => {
                b.value = '•';
                b.disabled = true;
            });
            pinActions.style.display = 'flex';
        } else {
            _hasExistingPin = false;
            pinHidden.value = '';
            pinTitle.textContent = 'Thiết lập mã PIN mới (6 số)';
            pinHelp.textContent = 'Bảo vệ cấu hình và quyền sử dụng Voice AI. PIN sẽ được mã hóa.';
            pinBoxes.forEach(b => {
                b.value = '';
                b.disabled = false;
            });
            pinActions.style.display = 'none';
        }
    }

    pinBoxes.forEach((box, idx) => {
        box.addEventListener('input', (e) => {
            if (box.value.length > 0) {
                if (idx < 5) pinBoxes[idx + 1].focus();
            }
            updateHiddenPinStr();
        });
        
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && box.value === '') {
                if (idx > 0) pinBoxes[idx - 1].focus();
            }
        });
    });

    function updateHiddenPinStr() {
        let str = '';
        pinBoxes.forEach(b => str += b.value);
        if (str.length === 6 && !str.includes('•')) {
            pinHidden.value = str;
        }
    }

    btnChangePin.addEventListener('click', () => {
        _hasExistingPin = false;
        pinTitle.textContent = 'Nhập mã PIN mới (6 số)';
        pinBoxes.forEach(b => {
            b.value = '';
            b.disabled = false;
        });
        pinBoxes[0].focus();
    });

    let resetConfirmActive = false;
    
    btnResetPin.addEventListener('click', () => {
        if (!resetConfirmActive) {
            // First click: show warning
            resetConfirmActive = true;
            btnResetPin.textContent = '⚠️ Xác nhận XÓA PIN & API Key?';
            btnResetPin.style.background = 'rgba(239,68,68,0.15)';
            btnResetPin.style.color = '#ef4444';
            btnResetPin.style.borderColor = '#ef4444';
            
            // Auto-cancel after 5 seconds
            setTimeout(() => {
                if (resetConfirmActive) {
                    resetConfirmActive = false;
                    btnResetPin.textContent = 'Xóa mã PIN & Khôi phục';
                    btnResetPin.style.background = '';
                    btnResetPin.style.borderColor = 'rgba(239,68,68,0.3)';
                }
            }, 5000);
            return;
        }
        
        // Second click: actually reset
        resetConfirmActive = false;
        _hasExistingPin = false;
        _hasPinHash = false;
        _pinSalt = '';
        _currentPinForEncrypt = '';
        pinHidden.value = '';
        elements.apiKey.value = '';
        elements.apiKey.placeholder = 'Nhập Gemini API Key';
        initPinUI('');
        btnResetPin.textContent = 'Xóa mã PIN & Khôi phục';
        btnResetPin.style.background = '';
        btnResetPin.style.borderColor = 'rgba(239,68,68,0.3)';
        
        // Remove all credential data
        chrome.storage.local.remove([
            'dashboard_password',
            'pin_hash',
            'pin_salt',
            'geminiApiKey',
            'geminiApiKey_encrypted'
        ], () => {
            showToast('🔓 Đã xóa mã PIN và API Key thành công!');
        });
    });

    // --- Toast Notification ---
    function showToast(message, isError = false) {
        const toast = document.getElementById('status-toast');
        toast.textContent = message;
        if (isError) {
            toast.classList.add('error');
        } else {
            toast.classList.remove('error');
        }
        
        toast.classList.add('show');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // --- Easter Egg (AI VIP) ---
    const versionTag = document.getElementById('aladinn-version-tag');
    const scannerSection = document.getElementById('sec-scanner');
    let clickCount = 0;
    let clickTimer = null;

    if (versionTag && scannerSection) {
        let aiVipContainer = document.getElementById('ai-vip-container');
        if (!aiVipContainer) {
            aiVipContainer = document.createElement('div');
            aiVipContainer.id = 'ai-vip-container';
            aiVipContainer.style.display = 'none';
            aiVipContainer.className = 'toggle-row';
            aiVipContainer.innerHTML = `
                <div class="toggle-info">
                    <strong style="color: var(--success);">✨ Tính năng ẩn: AI VIP (Tóm tắt Bệnh án)</strong>
                    <span>Dùng Gemini tóm tắt hồ sơ khi xem màn hình Tổng kết.</span>
                </div>
                <label class="switch">
                    <input type="checkbox" id="opt-scan-aivip">
                    <span class="slider"></span>
                </label>
            `;
            // Add after the second toggle
            scannerSection.appendChild(aiVipContainer);
            
            // Load state
            chrome.storage.local.get(['his_settings'], (res) => {
                const sSettings = res.his_settings || {};
                document.getElementById('opt-scan-aivip').checked = !!sSettings.aiEnabled;
                if (sSettings.aiEnabled) {
                    aiVipContainer.style.display = 'flex'; // reveal if already enabled
                    versionTag.style.color = 'var(--success)';
                }
            });
        }

        versionTag.addEventListener('click', (e) => {
            clickCount++;
            if (clickTimer) clearTimeout(clickTimer);
            clickTimer = setTimeout(() => { clickCount = 0; }, 2000);

            if (clickCount >= 5) {
                const isHidden = aiVipContainer.style.display === 'none';
                
                if (isHidden) {
                    aiVipContainer.style.display = 'flex';
                    // Reset animation if it was already there
                    aiVipContainer.classList.remove('magic-reveal');
                    void aiVipContainer.offsetWidth; // trigger reflow
                    aiVipContainer.classList.add('magic-reveal');
                    
                    versionTag.style.color = 'var(--success)';
                    showToast('🧞✨ Bùm! Thần đèn đã ban cho bạn tính năng AI VIP!');
                    
                    // Create sparkles
                    createSparkles(e.clientX, e.clientY);
                } else {
                    aiVipContainer.style.display = 'none';
                    aiVipContainer.classList.remove('magic-reveal');
                    versionTag.style.color = '';
                }
                clickCount = 0;
            }
        });

        function createSparkles(x, y) {
            const container = document.createElement('div');
            container.className = 'sparkle-container';
            document.body.appendChild(container);
            
            for (let i = 0; i < 30; i++) {
                const sparkle = document.createElement('div');
                sparkle.className = 'sparkle';
                sparkle.style.left = x + 'px';
                sparkle.style.top = y + 'px';
                
                // Random trajectory
                const angle = Math.random() * Math.PI * 2;
                const velocity = 50 + Math.random() * 150;
                const tx = Math.cos(angle) * velocity;
                const ty = Math.sin(angle) * velocity;
                
                sparkle.style.setProperty('--tx', tx + 'px');
                sparkle.style.setProperty('--ty', ty + 'px');
                sparkle.style.animationDuration = (0.6 + Math.random() * 0.8) + 's';
                
                container.appendChild(sparkle);
            }
            
            setTimeout(() => {
                container.remove();
            }, 2000);
        }
    }

    // ========================================
    // INLINE CRYPTO HELPERS (Options page doesn't have Aladinn.Crypto)
    // ========================================
    const _ITERATIONS = 100000;
    const _KEY_LENGTH = 256;

    function _generateSalt() {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        return btoa(String.fromCharCode(...salt));
    }

    async function _hashPIN(pin, salt) {
        const encoder = new TextEncoder();
        const pinData = encoder.encode(pin);
        const saltData = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
        const baseKey = await crypto.subtle.importKey('raw', pinData, 'PBKDF2', false, ['deriveBits']);
        const hashBits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: saltData, iterations: _ITERATIONS, hash: 'SHA-256' },
            baseKey, _KEY_LENGTH
        );
        return btoa(String.fromCharCode(...new Uint8Array(hashBits)));
    }

    async function _deriveKey(pin, salt) {
        const encoder = new TextEncoder();
        const pinData = encoder.encode(pin);
        const saltData = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
        const baseKey = await crypto.subtle.importKey('raw', pinData, 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: saltData, iterations: _ITERATIONS, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: _KEY_LENGTH },
            false, ['encrypt', 'decrypt']
        );
    }

    async function _encryptAPIKey(apiKey, pin, salt) {
        const key = await _deriveKey(pin, salt);
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(apiKey);
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        return btoa(String.fromCharCode(...iv)) + ':' + btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    }

    // --- Sync CDS Button ---
    const btnSyncCds = document.getElementById('btn-sync-cds-data');
    if (btnSyncCds) {
        btnSyncCds.addEventListener('click', () => {
            const origText = btnSyncCds.innerHTML;
            btnSyncCds.innerHTML = '⏳ Đang yêu cầu đồng bộ...';
            btnSyncCds.disabled = true;
            
            // Send message to background or content to trigger re-seed
            chrome.runtime.sendMessage({ type: 'FORCE_CDS_SYNC' }, (response) => {
                showToast('✅ Đã nạp lại Cấu trúc Cảnh báo Lâm sàng!');
                setTimeout(() => {
                    btnSyncCds.innerHTML = origText;
                    btnSyncCds.disabled = false;
                }, 1000);
            });
        });
    }

    // --- Diagnostic Logs ---
    const btnLoadDiag = document.getElementById('btn-load-diagnostic');
    const btnDownloadDiag = document.getElementById('btn-download-diagnostic');
    const btnClearDiag = document.getElementById('btn-clear-diagnostic');
    const diagCount = document.getElementById('diagnostic-count');
    const diagContainer = document.getElementById('diagnostic-log-container');

    async function loadDiagnosticLogs() {
        const logs = await HISDiagnostic.getLogs();
        diagCount.textContent = `${logs.length} mục`;
        
        if (logs.length === 0) {
            diagContainer.innerHTML = '<em style="color: var(--text-dim)">Hệ thống hiện tại không ghi nhận lỗi nào.</em>';
            return;
        }

        let html = '';
        logs.forEach(log => {
            const time = new Date(log.timestamp).toLocaleString();
            let color = '#9ca3af';
            let badge = '';
            
            if (log.source === 'VNPT_UI_CHANGE') {
                color = '#f59e0b';
                badge = '<span style="background: rgba(245,158,11,0.2); color: #fbbf24; padding: 2px 6px; border-radius: 4px; font-size: 11px;">⚠️ VNPT UI CHANGE</span>';
            } else if (log.source === 'ALADINN_BUG') {
                color = '#ef4444';
                badge = '<span style="background: rgba(239,68,68,0.2); color: #f87171; padding: 2px 6px; border-radius: 4px; font-size: 11px;">🐛 INTERNAL BUG</span>';
            }

            html += `
                <div style="border-bottom: 1px solid var(--border); padding-bottom: 12px; margin-bottom: 12px; line-height: 1.5;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <strong style="color: #60a5fa">${log.action}</strong>
                        <span style="color: #6b7280; font-size: 12px;">${time}</span>
                    </div>
                    <div>${badge} <span style="color: #fff; font-weight: 600;">${log.errorName}</span></div>
                    <div style="color: ${color}; margin-top: 4px; word-break: break-all;">${log.errorMessage}</div>
                </div>
            `;
        });
        
        diagContainer.innerHTML = html;
    }

    if (btnLoadDiag) {
        btnLoadDiag.addEventListener('click', () => {
            loadDiagnosticLogs();
            showToast('✅ Đã tải lại nhật ký báo lỗi');
        });
    }

    if (btnDownloadDiag) {
        btnDownloadDiag.addEventListener('click', async () => {
            const logs = await HISDiagnostic.getLogs();
            if (logs.length === 0) {
                showToast('Không có dữ liệu Log để tải về', true);
                return;
            }
            
            const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(logs, null, 2));
            const anchor = document.createElement('a');
            anchor.setAttribute('href', dataStr);
            anchor.setAttribute('download', `aladinn_diagnostic_${new Date().toISOString().slice(0,10)}.json`);
            document.body.appendChild(anchor);
            anchor.click();
            anchor.remove();
        });
    }

    if (btnClearDiag) {
        btnClearDiag.addEventListener('click', async () => {
            if (confirm('Bạn có chắc muốn xóa toàn bộ Error Logs không?')) {
                await HISDiagnostic.clearLogs();
                await loadDiagnosticLogs();
                showToast('🗑 Đã xóa toàn bộ nhật ký báo lỗi');
            }
        });
    }

    // Load logs on initial render
    if (document.getElementById('sec-diagnostic')) {
        loadDiagnosticLogs();
    }

    // Initialization
    loadSettings();
});
