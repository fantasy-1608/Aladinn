/**
 * 🧞 Aladinn — Unified Options Logic
 */

// Real Chrome Extension environment expected.

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
        scanTooltip: document.getElementById('opt-scan-tooltip'),
        cdsFilterLow: document.getElementById('opt-cds-filter-low'),
        signSafeMode: document.getElementById('opt-sign-safemode'),
        signAdvanced: document.getElementById('opt-sign-advanced'),
        pin: document.getElementById('opt-pin')
    };

    // Track crypto state for save operations
    let _pinSalt = '';
    let _hasPinHash = false;
    let _currentPinForEncrypt = ''; 

    function loadSettings() {
        chrome.storage.local.get([
            'geminiApiKey',
            'geminiApiKey_encrypted',
            'selectedModel', 
            'aladinn_voice_appSettings',
            'dashboard_password', // Legacy
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
            }

            let hasValidApi = false;

            // --- Load API Key ---
            if (localRes.geminiApiKey && !localRes.geminiApiKey.includes(':')) {
                // SECURITY: Plaintext key found — warn user, do NOT display the key
                elements.apiKey.value = '';
                elements.apiKey.placeholder = '⚠️ API Key cũ (plaintext) đã bị vô hiệu hóa. Nhập lại + tạo PIN mới.';
                showToast('⚠️ Phát hiện API Key plaintext! Vui lòng nhập lại và đặt PIN để mã hóa.', true);
                // Remove the plaintext key
                chrome.storage.local.remove('geminiApiKey');
                hasValidApi = false;
            } else if (localRes.geminiApiKey_encrypted) {
                elements.apiKey.value = '';
                elements.apiKey.placeholder = '🔒 API Key đã được mã hóa. Nhập PIN để xem.';
                hasValidApi = true;
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
            
            const _vSettings = localRes.aladinn_voice_appSettings || {};
            
            // --- PIN UI ---
            _pinSalt = localRes.pin_salt || '';
            _hasPinHash = !!(localRes.pin_hash && localRes.pin_salt);

            if (_hasPinHash) {
                elements.pin.value = '••••••';
                initPinUI('••••••');
            } else {
                initPinUI('');
            }

            toggleAIFeatures(hasValidApi);
        });

        // Load scanner settings
        chrome.storage.local.get(['vnpt_scanner_settings', 'his_settings'], (res) => {
            const sSettings = res.his_settings || res.vnpt_scanner_settings || { vitalsDisplay: true, templateAutofill: true };
            elements.scanTooltip.checked = sSettings.vitalsDisplay !== undefined ? sSettings.vitalsDisplay : (sSettings.showTooltip || false);
            // scanNutrition toggle removed — always enabled
            if (elements.signSafeMode && sSettings.signSafeMode !== undefined) {
                elements.signSafeMode.checked = sSettings.signSafeMode;
            }
            if (elements.signAdvanced && sSettings.signAdvanced !== undefined) {
                elements.signAdvanced.checked = sSettings.signAdvanced;
            }
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

    function toggleAIFeatures(isUnlocked) {
        const container = document.getElementById('ai-features-container');
        // SECURITY: Both API Key AND PIN required to unlock AI settings
        if (isUnlocked && _hasPinHash) {
            container.classList.remove('locked');
        } else {
            container.classList.add('locked');
        }
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
            
            const validModels = (data.models || []).filter(m => 
                m.name.includes('gemini') && 
                m.supportedGenerationMethods && 
                m.supportedGenerationMethods.includes('generateContent')
            );

            if (validModels.length === 0) {
                showToast('Không tìm thấy mô hình Gemini khả dụng.', true);
                return;
            }

            const currentSelected = elements.aiModel.value;
            elements.aiModel.innerHTML = '';
            
            validModels.sort((a, b) => b.name.localeCompare(a.name)).forEach(model => {
                const option = document.createElement('option');
                const modelValue = model.name.replace('models/', '');
                option.value = modelValue;
                option.textContent = `${model.displayName} (${model.version})`;
                
                if (modelValue.includes('2.5-flash')) {
                    option.textContent = `${model.displayName} (Khuyên dùng - Mới nhất)`;
                } else if (modelValue.includes('1.5-flash') && !validModels.some(m => m.name.includes('2.5-flash'))) {
                    option.textContent = `${model.displayName} (Khuyên dùng)`;
                }
                
                elements.aiModel.appendChild(option);
            });

            let match = Array.from(elements.aiModel.options).find(opt => opt.value === currentSelected);
            if (match) {
                elements.aiModel.value = currentSelected;
            } else {
                elements.aiModel.selectedIndex = 0; 
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
        updateHiddenPinStr(); 
        const pinVal = elements.pin.value.trim();

        if (pinVal.length > 0 && pinVal.length < 6 && !pinVal.includes('•')) {
            showToast('Mã PIN phải đủ 6 số!', true);
            return;
        }

        const isNewPin = pinVal.length === 6 && !pinVal.includes('•');

        if (apiKeyVal && !_hasPinHash && !isNewPin) {
            showToast('Bắt buộc phải thiết lập mã PIN (6 số) để bảo mật API Key!', true);
            return;
        }

        const res = await new Promise(r => chrome.storage.local.get(['his_settings'], r));
        const currentHisSettings = res.his_settings || {
            scanTimeout: 5000, apiTimeout: 8000, autoScan: true, 
            vitalsDisplay: true, historySummary: true, templateAutofill: true, 
            darkMode: false, aiEnabled: false, geminiApiKey: '', geminiModel: 'gemini-1.5-flash'
        };

        currentHisSettings.vitalsDisplay = elements.scanTooltip.checked;
        currentHisSettings.templateAutofill = true; // Always enabled
        currentHisSettings.geminiModel = elements.aiModel.value;
        if (elements.signSafeMode) currentHisSettings.signSafeMode = elements.signSafeMode.checked;
        if (elements.signAdvanced) currentHisSettings.signAdvanced = elements.signAdvanced.checked;

        const aiVipToggle = document.getElementById('opt-scan-aivip');
        if (aiVipToggle) {
            currentHisSettings.aiEnabled = aiVipToggle.checked;
        }

        currentHisSettings.geminiApiKey = '';

        const localPatch = {
            selectedModel: elements.aiModel.value,
            aladinn_voice_appSettings: { autoChuyenVien: true },
            his_settings: currentHisSettings,
            vnpt_scanner_settings: {
                showTooltip: elements.scanTooltip.checked,
                autoForm: true // Always enabled
            },
            vnpt_cds_settings: {
                filterLow: elements.cdsFilterLow.checked
            }
        };

        if (isNewPin) {
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

                if (apiKeyVal) {
                    const encryptedKey = await _encryptAPIKey(apiKeyVal, pinVal, salt);
                    localPatch.geminiApiKey_encrypted = encryptedKey;
                    toggleAIFeatures(true);
                }

                chrome.storage.local.remove(['dashboard_password', 'geminiApiKey']);
                initPinUI('••••••');
            } catch (cryptoErr) {
                showToast(`❌ Lỗi mã hóa PIN: ${cryptoErr.message || 'Unknown error'}. Kiểm tra Console.`, true);
                return;
            }
        } else {
            if (_hasPinHash && apiKeyVal && _currentPinForEncrypt) {
                try {
                    const encryptedKey = await _encryptAPIKey(apiKeyVal, _currentPinForEncrypt, _pinSalt);
                    localPatch.geminiApiKey_encrypted = encryptedKey;
                    chrome.storage.local.remove('geminiApiKey');
                    toggleAIFeatures(true);
                } catch (_e) {
                    showToast('Lỗi mã hóa API Key.', true);
                    return;
                }
            } else if (_hasPinHash && apiKeyVal && !_currentPinForEncrypt) {
                showToast('❌ Để cập nhật API Key mới, vui lòng nhấn "Xóa mã PIN" bên dưới và thiết lập lại từ đầu.', true);
                return;
            } else if (apiKeyVal && !_hasPinHash) {
                 showToast('Không lưu được: Yêu cầu mã PIN!', true);
                 return;
            } else if (!apiKeyVal) {
                 toggleAIFeatures(false);
            }
        }

        chrome.storage.local.set(localPatch, () => {
            chrome.storage.sync.set({}, () => {
                showToast('✅ Đã lưu cấu hình thành công!');
                _currentPinForEncrypt = ''; 
                
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
        box.addEventListener('input', (_e) => {
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
            resetConfirmActive = true;
            btnResetPin.textContent = '⚠️ Xác nhận XÓA PIN & API Key?';
            btnResetPin.style.background = 'rgba(239,68,68,0.15)';
            btnResetPin.style.color = '#ef4444';
            btnResetPin.style.borderColor = '#ef4444';
            
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
        
        resetConfirmActive = false;
        _hasExistingPin = false;
        _hasPinHash = false;
        _pinSalt = '';
        _currentPinForEncrypt = '';
        pinHidden.value = '';
        elements.apiKey.value = '';
        elements.apiKey.placeholder = 'Nhập Gemini API Key';
        initPinUI('');
        toggleAIFeatures(false);

        btnResetPin.textContent = 'Xóa mã PIN & Khôi phục';
        btnResetPin.style.background = '';
        btnResetPin.style.borderColor = 'rgba(239,68,68,0.3)';
        
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
    const advancedSection = document.getElementById('ai-features-container');
    let clickCount = 0;
    let clickTimer = null;

    if (versionTag && advancedSection) {
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
            advancedSection.appendChild(aiVipContainer);
            
            chrome.storage.local.get(['his_settings'], (res) => {
                const sSettings = res.his_settings || {};
                document.getElementById('opt-scan-aivip').checked = !!sSettings.aiEnabled;
                if (sSettings.aiEnabled) {
                    aiVipContainer.style.display = 'flex'; 
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
                    aiVipContainer.classList.remove('magic-reveal');
                    void aiVipContainer.offsetWidth; 
                    aiVipContainer.classList.add('magic-reveal');
                    
                    versionTag.style.color = 'var(--success)';
                    showToast('🧞✨ Bùm! Thần đèn đã ban cho bạn tính năng AI VIP!');
                    
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
    // INLINE CRYPTO HELPERS 
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
            
            chrome.runtime.sendMessage({ type: 'FORCE_CDS_SYNC' }, (_response) => {
                showToast('✅ Đã nạp lại Cấu trúc Cảnh báo Lâm sàng!');
                setTimeout(() => {
                    btnSyncCds.innerHTML = origText;
                    btnSyncCds.disabled = false;
                }, 1000);
            });
        });
    }

    // Initialization
    loadSettings();
});
