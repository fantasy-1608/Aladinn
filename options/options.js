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
        scanRefresh: document.getElementById('opt-scan-refresh'),
        cdsUiType: document.getElementById('opt-cds-ui-type'),
        cdsFilterLow: document.getElementById('opt-cds-filter-low'),
        throttleSlider: document.getElementById('throttle-slider'),
        signSafeMode: document.getElementById('opt-sign-safemode'),
        signAdvanced: document.getElementById('opt-sign-advanced'),
        pin: document.getElementById('opt-pin'),
        aiTemperature: document.getElementById('opt-ai-temperature'),
        aiFontsize: document.getElementById('opt-ai-fontsize'),
        usdRate: document.getElementById('opt-usd-rate'),
        promptCls: document.getElementById('opt-prompt-cls'),
        promptVoice: document.getElementById('opt-prompt-voice'),
        // Feature Flags
        flagScanner: document.getElementById('flag-scanner'),
        flagSign: document.getElementById('flag-sign'),
        flagCds: document.getElementById('flag-cds'),
        flagVoice: document.getElementById('flag-voice'),
        flagDebug: document.getElementById('flag-debug')
    };

    if (elements.throttleSlider) {
        const tVal = document.getElementById('throttle-val');
        elements.throttleSlider.addEventListener('input', (e) => {
            if (tVal) tVal.textContent = e.target.value + ' giây';
        });
    }
    if (elements.aiTemperature) {
        const tVal = document.getElementById('temp-val');
        elements.aiTemperature.addEventListener('input', (e) => {
            if (tVal) tVal.textContent = e.target.value;
        });
    }

    // Track crypto state for save operations
    let _pinSalt = '';
    let _hasPinHash = false;
    let _currentPinForEncrypt = ''; 
    let _hasEncryptedKey = false;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

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
                chrome.storage.local.set(patch, () => {
                    chrome.storage.local.remove(['dashboard_password', 'geminiApiKey'], () => {
                        loadSettings(); // Reload UI with clean state
                    });
                });
                return; // Stop execution, wait for reload
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
                elements.apiKey.placeholder = '🔒 Đã mã hóa API Key. Bấm Xóa Mã PIN bên dưới để đổi.';
                elements.apiKey.readOnly = true;
                hasValidApi = true;
                _hasEncryptedKey = true;
            } else {
                elements.apiKey.readOnly = false;
                _hasEncryptedKey = false;
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

        // Load scanner and other settings
        chrome.storage.local.get(['vnpt_scanner_settings', 'his_settings', 'ai_temperature', 'ai_fontsize', 'usd_rate', 'prompt_cls', 'prompt_voice'], (res) => {
            const sSettings = res.his_settings || res.vnpt_scanner_settings || {};
            
            if (elements.scanRefresh && sSettings.scanRefresh !== undefined) elements.scanRefresh.value = sSettings.scanRefresh;
            if (elements.cdsUiType && sSettings.cdsUiType !== undefined) elements.cdsUiType.value = sSettings.cdsUiType;
            if (elements.throttleSlider && sSettings.signThrottle !== undefined) {
                elements.throttleSlider.value = sSettings.signThrottle;
                const tv = document.getElementById('throttle-val');
                if (tv) tv.textContent = sSettings.signThrottle + ' giây';
            }
            if (elements.signSafeMode && sSettings.signSafeMode !== undefined) elements.signSafeMode.checked = sSettings.signSafeMode;
            if (elements.signAdvanced && sSettings.signAdvanced !== undefined) elements.signAdvanced.checked = sSettings.signAdvanced;

            if (elements.aiTemperature && res.ai_temperature !== undefined) {
                elements.aiTemperature.value = res.ai_temperature;
                const tv = document.getElementById('temp-val');
                if (tv) tv.textContent = res.ai_temperature;
            }
            if (elements.aiFontsize && res.ai_fontsize !== undefined) elements.aiFontsize.value = res.ai_fontsize;
            if (elements.usdRate && res.usd_rate !== undefined) elements.usdRate.value = res.usd_rate;
            if (elements.promptCls && res.prompt_cls !== undefined) elements.promptCls.value = res.prompt_cls;
            if (elements.promptVoice && res.prompt_voice !== undefined) elements.promptVoice.value = res.prompt_voice;
        });

        chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
            if (elements.cdsFilterLow) {
                elements.cdsFilterLow.checked = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
            }
        });

        // Load Feature Flags
        chrome.storage.local.get(['aladinn_features', 'aladinn_debug_mode'], (res) => {
            const flags = { scanner: true, sign: true, cds: true, voice: true, ...res.aladinn_features };
            if (elements.flagScanner) elements.flagScanner.checked = flags.scanner !== false;
            if (elements.flagSign) elements.flagSign.checked = flags.sign !== false;
            if (elements.flagCds) elements.flagCds.checked = flags.cds !== false;
            if (elements.flagVoice) elements.flagVoice.checked = flags.voice !== false;
            if (elements.flagDebug) elements.flagDebug.checked = !!res.aladinn_debug_mode;
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
        if (!apiKey && !_hasEncryptedKey) {
            showToast('⚠️ Vui lòng nhập API Key trước khi dò tìm!', true);
            return;
        }

        const btn = document.getElementById('fetch-models-btn');
        const originalText = btn.innerHTML;
        btn.innerHTML = '⏳ Đang dò...';
        btn.disabled = true;

        try {
            const response = await chrome.runtime.sendMessage({
                type: 'AI_LIST_MODELS',
                payload: { apiKey: apiKey || '' }
            });
            if (!response?.ok) {
                throw new Error(response?.error?.message || 'Lỗi API - Kiểm tra lại API Key');
            }
            const validModels = response.data?.models || [];

            if (validModels.length === 0) {
                showToast('Không tìm thấy mô hình Gemini khả dụng.', true);
                return;
            }

            const currentSelected = elements.aiModel.value;
            elements.aiModel.innerHTML = '';
            
            validModels.sort((a, b) => b.name.localeCompare(a.name)).forEach(model => {
                const option = document.createElement('option');
                const modelValue = model.id || model.name.replace('models/', '');
                option.value = modelValue;
                option.textContent = model.name || modelValue;
                
                if (modelValue.includes('2.5-flash')) {
                    option.textContent = `${model.name || modelValue} (Khuyên dùng - Mới nhất)`;
                } else if (modelValue.includes('1.5-flash') && !validModels.some(m => (m.id || m.name).includes('2.5-flash'))) {
                    option.textContent = `${model.name || modelValue} (Khuyên dùng)`;
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
            document.getElementById('ai-features-container').classList.remove('locked');
            
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
        const currentHisSettings = res.his_settings || {};

        currentHisSettings.scanRefresh = elements.scanRefresh ? parseInt(elements.scanRefresh.value) : 5;
        currentHisSettings.cdsUiType = elements.cdsUiType ? elements.cdsUiType.value : 'modal';
        currentHisSettings.signThrottle = elements.throttleSlider ? parseFloat(elements.throttleSlider.value) : 1.5;
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
                autoForm: true // Always enabled
            },
            vnpt_cds_settings: {
                filterLow: elements.cdsFilterLow ? elements.cdsFilterLow.checked : true,
                shadowMode: elements.flagDebug ? elements.flagDebug.checked : false
            },
            ai_temperature: elements.aiTemperature ? parseFloat(elements.aiTemperature.value) : 0.2,
            ai_fontsize: elements.aiFontsize ? elements.aiFontsize.value : '15px',
            usd_rate: elements.usdRate ? parseInt(elements.usdRate.value) : 25500,
            prompt_cls: elements.promptCls ? elements.promptCls.value : '',
            prompt_voice: elements.promptVoice ? elements.promptVoice.value : ''
        };

        // Feature Flags
        const featureFlags = {
            scanner: elements.flagScanner ? elements.flagScanner.checked : true,
            sign: elements.flagSign ? elements.flagSign.checked : true,
            cds: elements.flagCds ? elements.flagCds.checked : true,
            voice: elements.flagVoice ? elements.flagVoice.checked : true
        };
        localPatch.aladinn_features = featureFlags;

        // Debug Mode
        if (elements.flagDebug) {
            localPatch.aladinn_debug_mode = elements.flagDebug.checked;
        }

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
                    _hasEncryptedKey = true;
                    elements.apiKey.value = '';
                    elements.apiKey.readOnly = true;
                    elements.apiKey.placeholder = '🔒 Đã mã hóa API Key. Bấm Xóa Mã PIN bên dưới để đổi.';
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
                    _hasEncryptedKey = true;
                    elements.apiKey.value = '';
                    elements.apiKey.readOnly = true;
                    elements.apiKey.placeholder = '🔒 Đã mã hóa API Key. Bấm Xóa Mã PIN bên dưới để đổi.';
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
            } else if (!apiKeyVal && !_hasEncryptedKey) {
                 toggleAIFeatures(false);
            }
        }

        chrome.storage.local.set(localPatch, () => {
            const finishSave = () => chrome.storage.sync.set({}, () => {
                showToast('✅ Đã lưu cấu hình thành công!');
                _currentPinForEncrypt = ''; 
                
                chrome.tabs.query({url: '*://*.vncare.vn/*'}, (tabs) => {
                    tabs.forEach(tab => {
                        chrome.tabs.sendMessage(tab.id, { action: 'UPDATE_SETTINGS' });
                    });
                });
            });
            if (isNewPin && apiKeyVal && pinVal) {
                chrome.runtime.sendMessage({
                    type: 'CACHE_SESSION_PIN',
                    payload: { pin: pinVal }
                }, () => finishSave());
            } else {
                finishSave();
            }
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
            btnChangePin.style.display = 'none';
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
            btnResetPin.style.background = 'rgba(255,180,171,0.15)';
            btnResetPin.style.color = '#FFB4AB';
            btnResetPin.style.borderColor = '#FFB4AB';
            
            setTimeout(() => {
                if (resetConfirmActive) {
                    resetConfirmActive = false;
                    btnResetPin.textContent = 'Xóa mã PIN & Khôi phục';
                    btnResetPin.style.background = '';
                    btnResetPin.style.borderColor = 'rgba(255,180,171,0.3)';
                }
            }, 5000);
            return;
        }
        
        resetConfirmActive = false;
        _hasExistingPin = false;
        _hasPinHash = false;
        _pinSalt = '';
        _currentPinForEncrypt = '';
        _hasEncryptedKey = false;
        pinHidden.value = '';
        elements.apiKey.value = '';
        elements.apiKey.readOnly = false;
        elements.apiKey.placeholder = 'Nhập Gemini API Key';
        initPinUI('');
        toggleAIFeatures(false);

        btnResetPin.textContent = 'Xóa mã PIN & Khôi phục';
        btnResetPin.style.background = '';
        btnResetPin.style.borderColor = 'rgba(255,180,171,0.3)';
        
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

    // --- Easter Egg (AI VIP) — P0-04 Controlled ---
    import('./ai-vip-easter-egg.js').then(({ initAiVipEasterEgg }) => {
        initAiVipEasterEgg({
            hasPinHash: _hasPinHash,
            hasEncryptedKey: _hasEncryptedKey,
            showToast
        });
    }).catch(err => console.error('[Aladinn] AI VIP module load error:', err));

    // Version tag display (kept outside module for general use)
    const versionTag = document.getElementById('aladinn-version-tag');
    if (versionTag) {
        try {
            const manifest = chrome.runtime.getManifest();
            if (manifest && manifest.version) {
                versionTag.textContent = `Version ${manifest.version}`;
            }
        } catch (_e) { /* ignore if not in extension context */ }
    }

    // ========================================
    // INLINE CRYPTO HELPERS 
    // ========================================
    const _ITERATIONS = 310000;
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
            
            chrome.runtime.sendMessage({ type: 'FORCE_CDS_SYNC' }, (response) => {
                if (chrome.runtime.lastError || !response?.ok) {
                    showToast('❌ Đồng bộ CDS thất bại' + (response?.error ? `: ${response.error}` : ''), true);
                } else {
                    showToast('✅ Đã nạp lại Cấu trúc Cảnh báo Lâm sàng!');
                }
                setTimeout(() => {
                    btnSyncCds.innerHTML = origText;
                    btnSyncCds.disabled = false;
                }, 1000);
            });
        });
    }

    // --- Template Management ---
    import('../shared/template-store.js').then(({ TemplateStore }) => {
        const listContainer = document.getElementById('template-list-container');
        const btnAdd = document.getElementById('btn-add-template');
        const inpShortcut = document.getElementById('tpl-shortcut');
        const inpTitle = document.getElementById('tpl-title');
        const inpContent = document.getElementById('tpl-content');

        // Track edit mode
        let editingId = null;

        function setEditMode(tpl) {
            editingId = tpl ? tpl.id : null;
            inpShortcut.value = tpl ? tpl.shortcut : '';
            inpTitle.value = tpl ? tpl.title : '';
            inpContent.value = tpl ? tpl.content : '';
            btnAdd.textContent = tpl ? '\u2705 C\u1eadp nh\u1eadt M\u1eabu' : '+ Th\u00eam M\u1eabu';
            btnAdd.style.background = tpl ? 'linear-gradient(135deg, #2a7a4b, #3aa863)' : '';
            if (tpl) {
                inpShortcut.focus();
                // Scroll form into view
                inpShortcut.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }

        async function renderTemplates() {
            const templates = await TemplateStore.getTemplates();
            listContainer.innerHTML = '';
            
            if (templates.length === 0) {
                listContainer.innerHTML = '<div style="color: var(--text-dim); text-align: center; padding: 20px;">Chưa có mẫu nào. Hãy thêm mẫu mới!</div>';
                return;
            }

            templates.forEach(tpl => {
                const item = document.createElement('div');
                item.style.cssText = 'background: var(--bg-card); border: 1px solid var(--border); border-radius: 10px; padding: 16px; display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;';
                item.innerHTML = `
                    <div style="flex: 1; min-width: 0;">
                        <div style="font-weight: 600; color: var(--primary); margin-bottom: 4px; display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
                            ${escapeHtml(tpl.title)}
                            <span style="background: rgba(158, 202, 255, 0.1); padding: 2px 8px; border-radius: 4px; font-size: 11px; color: var(--accent);">//${escapeHtml(tpl.shortcut)}</span>
                        </div>
                        <div style="font-size: 13px; color: var(--text-dim); white-space: pre-wrap; word-break: break-word;">${escapeHtml(tpl.content)}</div>
                    </div>
                    <div style="display: flex; flex-direction: column; gap: 6px; flex-shrink: 0;">
                        <button class="btn-edit-tpl" data-id="${escapeHtml(tpl.id)}" title="Ch\u1ec9nh s\u1eeda" style="background: transparent; border: none; color: var(--accent); cursor: pointer; padding: 4px; opacity: 0.75; transition: 0.2s;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        </button>
                        <button class="btn-delete-tpl" data-id="${escapeHtml(tpl.id)}" title="X\u00f3a" style="background: transparent; border: none; color: var(--error); cursor: pointer; padding: 4px; opacity: 0.7; transition: 0.2s;">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                        </button>
                    </div>
                `;
                listContainer.appendChild(item);
            });

            // Hover effect for buttons
            document.querySelectorAll('.btn-edit-tpl, .btn-delete-tpl').forEach(btn => {
                btn.addEventListener('mouseenter', () => { btn.style.opacity = '1'; btn.style.transform = 'scale(1.15)'; });
                btn.addEventListener('mouseleave', () => { btn.style.opacity = btn.classList.contains('btn-edit-tpl') ? '0.75' : '0.7'; btn.style.transform = 'scale(1)'; });
            });

            // Edit button handler
            document.querySelectorAll('.btn-edit-tpl').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    const templates = await TemplateStore.getTemplates();
                    const tpl = templates.find(t => t.id === id);
                    if (tpl) setEditMode(tpl);
                });
            });

            // Delete button handler
            document.querySelectorAll('.btn-delete-tpl').forEach(btn => {
                btn.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    if (confirm('B\u1ea1n c\u00f3 ch\u1eafc mu\u1ed1n x\u00f3a m\u1eabu n\u00e0y?')) {
                        await TemplateStore.removeTemplate(id);
                        if (editingId === id) setEditMode(null); // Reset form if editing this item
                        showToast('\u0110\u00e3 x\u00f3a m\u1eabu!');
                        renderTemplates();
                    }
                });
            });
        }

        btnAdd.addEventListener('click', async () => {
            const shortcut = inpShortcut.value.trim();
            const title = inpTitle.value.trim();
            const content = inpContent.value.trim();

            if (!shortcut || !title || !content) {
                showToast('Vui l\u00f2ng nh\u1eadp \u0111\u1ee7 Ph\u00edm t\u1eaft, Ti\u00eau \u0111\u1ec1 v\u00e0 N\u1ed9i dung!', true);
                return;
            }
            if (shortcut.includes(' ')) {
                showToast('Ph\u00edm t\u1eaft kh\u00f4ng \u0111\u01b0\u1ee3c ch\u1ee9a kho\u1ea3ng tr\u1eafng!', true);
                return;
            }

            if (editingId) {
                // Update mode: remove old + add new with same id logic
                await TemplateStore.removeTemplate(editingId);
                await TemplateStore.addTemplate(title, shortcut, content);
                showToast('\u0110\u00e3 c\u1eadp nh\u1eadt m\u1eabu th\u00e0nh c\u00f4ng!');
                setEditMode(null);
            } else {
                await TemplateStore.addTemplate(title, shortcut, content);
                showToast('\u0110\u00e3 th\u00eam m\u1eabu th\u00e0nh c\u00f4ng!');
            }

            inpShortcut.value = '';
            inpTitle.value = '';
            inpContent.value = '';

            renderTemplates();
        });

        // Initialize templates list
        renderTemplates();
    }).catch(err => console.error('Lỗi tải TemplateStore:', err));

    // Initialization
    loadSettings();

    // === AI Config Section ===

    // Default prompts (hiển thị trong textarea như gợi ý)
    const DEFAULT_PROMPTS = {
        cls_summary: `Bạn là bác sĩ đang hội chẩn (mã BN: {{patientRef}}, SN: {{birthYear}}).
Dữ liệu lâm sàng:
- Chẩn đoán (ICD): {{diagnosis}}
- Đơn thuốc: {{drugs}}
{{abnormal}}
{{keylabs}}
Trình bày ngắn gọn theo cấu trúc:
1. Tóm tắt bệnh (1–2 câu, nêu mức độ nặng và vấn đề chính)
2. Điểm lưu ý / nguy cơ lâm sàng (tối đa 2 ý)
3. Hướng xử trí đề xuất (tối đa 3 ý, mỗi ý 1 can thiệp cụ thể)
Dùng ngôn ngữ y khoa chuyên nghiệp. NGẮN GỌN. KHÔNG viết câu mở đầu hay lời chào hỏi. Bắt đầu ngay vào nội dung.`,

        voice_system: `Bạn là trợ lý y khoa chuyên nghiệp tại Bệnh viện Việt Nam. Nhiệm vụ: trích xuất thông tin từ văn bản y khoa (được nhập bằng giọng nói, có nhiều lỗi nhận dạng) và trả về **CHỈ JSON** — không kèm giải thích.

## QUY TẮC QUAN TRỌNG:
### 1. SỬA LỖI GIỌNG NÓI (Speech-to-text):
- "sin hiệu" / "xin hiệu" → "sinh hiệu"
- "trận đấu" / "chẩn đấu" → "chẩn đoán"
- "bên sở" / "bệnh xử" → "bệnh sử"
- Số đọc dạng "150 trên 80" → HA 150/80 mmHg
### 2. PHÂN LOẠI đúng các field: lyDoVaoVien, quaTrinhBenhLy, khamToanThan, khamBoPhan, chanDoanBanDau, tienSuBanThan, tienSuGiaDinh, sinhHieu, icd10Suggest
### 3. VĂN PHONG: Telegraphic style, chuyên nghiệp y khoa, lược bỏ từ thừa.
### 4. OUTPUT: Trả về ĐÚNG JSON, KHÔNG kèm text giải thích.`,

        medical_summary: '(Chức năng này sẽ được triển khai trong phiên bản tới. Để trống để dùng prompt mặc định của hệ thống.)'
    };

    function formatVnd(vnd) {
        if (vnd < 1) return '<1đ';
        if (vnd < 1000) return `≈${Math.round(vnd)}đ`;
        return `≈${(vnd / 1000).toFixed(1)}kđ`;
    }

    function loadAIConfig() {
        // Load daily stats từ chrome.storage.local (đồng bộ với content script)
        chrome.storage.local.get(['aladinn_ai_usage', 'aladinn_usd_rate'], (res) => {
            const today = new Date().toDateString();
            const data = res.aladinn_ai_usage || {};

            const tokenEl = document.getElementById('stat-tokens');
            const costEl  = document.getElementById('stat-cost');
            const callEl  = document.getElementById('stat-calls');

            if (data.date === today && (data.totalTokens || 0) > 0) {
                if (tokenEl) tokenEl.textContent = (data.totalTokens || 0).toLocaleString('vi-VN');
                if (costEl)  costEl.textContent  = formatVnd(data.totalVnd || 0);
                if (callEl)  callEl.textContent  = (data.callCount || 0);
            } else {
                if (tokenEl) tokenEl.textContent = '—';
                if (costEl)  costEl.textContent  = '—';
                if (callEl)  callEl.textContent  = '—';
            }

            // Load USD rate
            const rateEl = document.getElementById('opt-usd-rate');
            if (rateEl) rateEl.value = res.aladinn_usd_rate || '25500';
        });

        // Load custom prompts — nếu chưa có thì điền sẵn default làm placeholder
        chrome.storage.local.get(['aladinn_ai_prompts'], (res) => {
            const saved = res.aladinn_ai_prompts || {};
            const promptClsEl   = document.getElementById('opt-prompt-cls');
            const promptVoiceEl = document.getElementById('opt-prompt-voice');
            const promptSumEl   = document.getElementById('opt-prompt-medical');

            if (promptClsEl) {
                // Điền giá trị đã lưu hoặc để trống (placeholder hiển thị default)
                promptClsEl.value = saved.cls_summary || '';
                promptClsEl.placeholder = DEFAULT_PROMPTS.cls_summary;
            }
            if (promptVoiceEl) {
                promptVoiceEl.value = saved.voice_system || '';
                promptVoiceEl.placeholder = DEFAULT_PROMPTS.voice_system;
            }
            if (promptSumEl) {
                promptSumEl.value = saved.medical_summary || '';
                promptSumEl.placeholder = DEFAULT_PROMPTS.medical_summary;
            }
        });
    }

    // Save AI config khi bấm Lưu Cấu Hình
    const origSaveHandler = document.getElementById('save-all-btn');
    if (origSaveHandler) {
        origSaveHandler.addEventListener('click', () => {
            const rateEl = document.getElementById('opt-usd-rate');
            if (rateEl) {
                const rate = parseFloat(rateEl.value);
                if (!isNaN(rate) && rate > 1000) {
                    chrome.storage.local.set({ aladinn_usd_rate: rate.toString() });
                }
            }

            chrome.storage.local.get(['aladinn_ai_prompts'], (res) => {
                const current = res.aladinn_ai_prompts || {};
                const clsEl   = document.getElementById('opt-prompt-cls');
                const voiceEl = document.getElementById('opt-prompt-voice');
                const sumEl   = document.getElementById('opt-prompt-medical');
                if (clsEl)   current.cls_summary     = clsEl.value.trim();
                if (voiceEl) current.voice_system     = voiceEl.value.trim();
                if (sumEl)   current.medical_summary  = sumEl.value.trim();
                chrome.storage.local.set({ aladinn_ai_prompts: current });
            });
        });
    }

    // Reset buttons cho từng prompt
    function setupResetBtn(btnId, promptKey, promptElId) {
        const btn = document.getElementById(btnId);
        if (!btn) return;
        btn.addEventListener('click', () => {
            const el = document.getElementById(promptElId);
            if (el) el.value = '';
            chrome.storage.local.get(['aladinn_ai_prompts'], (res) => {
                const current = res.aladinn_ai_prompts || {};
                current[promptKey] = '';
                chrome.storage.local.set({ aladinn_ai_prompts: current }, () => {
                    showToast('✅ Đã reset về prompt mặc định!');
                });
            });
        });
    }

    setupResetBtn('btn-reset-prompt-cls',   'cls_summary',    'opt-prompt-cls');
    setupResetBtn('btn-reset-prompt-voice', 'voice_system',   'opt-prompt-voice');
    setupResetBtn('btn-reset-prompt-medical','medical_summary','opt-prompt-medical');

    const btnExportPerf = document.getElementById('btn-export-perf');
    if (btnExportPerf) {
        btnExportPerf.addEventListener('click', async () => {
            const data = await chrome.storage.local.get('aladinn_cds_perf_telemetry');
            const records = data.aladinn_cds_perf_telemetry || [];
            if (records.length === 0) {
                showToast('Không có dữ liệu hiệu năng nào!');
                return;
            }
            const headers = Object.keys(records[0]).join(',');
            const rows = records.map(r => Object.values(r).join(','));
            const csv = [headers, ...rows].join('\n');
            const blob = new Blob([csv], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `aladinn_perf_report_${Date.now()}.csv`;
            a.click();
            URL.revokeObjectURL(url);
            showToast(`Đã xuất ${records.length} dòng báo cáo!`);
        });
    }

    loadAIConfig();
});
