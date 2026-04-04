const VNPTSettings = (function () {
    /** @type {HTMLElement|null} */
    let settingsPanel = null;
    let isVisible = false;
    /** @type {any} */
    let cachedSettings = null;

    // Default settings (V5 Standard)
    const defaultSettings = {
        scanTimeout: 5000,
        apiTimeout: 8000,
        autoScan: true,
        vitalsDisplay: true,
        historySummary: true,
        templateAutofill: true,
        darkMode: false,
        aiEnabled: false,
        geminiApiKey: '',
        geminiModel: 'gemini-1.5-flash'
    };

    /**
     * Get current settings
     */
    function getSettings() {
        if (!cachedSettings) {
            cachedSettings = { ...defaultSettings };
            syncFromChrome(); // Trigger async load if not already loaded
        }
        return cachedSettings;
    }

    function saveSettings(settings) {
        try {
            cachedSettings = { ...cachedSettings, ...settings };

            const _chrome = (/** @type {any} */(window)).chrome;
            if (_chrome?.storage?.local) {
                _chrome.storage.local.set({ 'his_settings': cachedSettings });
            }

            applySettings(cachedSettings);
        } catch (e) {
            console.error('[VNPTSettings] Error saving settings:', e);
        }
    }

    function syncFromChrome() {
        const _chrome = (/** @type {any} */(window)).chrome;
        if (_chrome?.storage?.local) {
            _chrome.storage.local.get(['his_settings'], (/** @type {any} */ result) => {
                if (result.his_settings) {
                    cachedSettings = { ...defaultSettings, ...result.his_settings };
                    applySettings(cachedSettings);
                } else {
                    cachedSettings = { ...defaultSettings };
                    applySettings(cachedSettings);
                }
            });
        }
    }

    /**
     * Apply settings
     * @param {any} settings
     */
    function applySettings(settings) {
        document.body.classList.toggle('vnpt-dark-mode', !!settings.darkMode);
        if (window.VNPTStore) window.VNPTStore.set('isDarkMode', settings.darkMode);

        if (window.VNPTConfig) {
            window.VNPTConfig.VERSION = '1.0.0';
        }
    }

    /**
     * Create settings panel UI
     */
    function createPanel() {
        if (settingsPanel) return settingsPanel;

        const settings = getSettings();

        settingsPanel = document.createElement('div');
        settingsPanel.id = 'vnpt-settings-panel';
        settingsPanel.className = 'vnpt-settings-panel';

        settingsPanel.innerHTML = `
            <div class="vnpt-settings-container">
                <div class="vnpt-settings-header">
                    <div class="header-title">
                        <span class="header-icon" style="font-size:22px;">⚙️</span>
                        <h3>Cài đặt Hệ thống v1.0.0</h3>
                    </div>
                    <button class="vnpt-settings-close">&times;</button>
                </div>
                
                <div class="vnpt-settings-content">
                    <div class="vnpt-settings-section">
                        <h4>🎨 Giao diện</h4>
                        <div class="vnpt-grid">
                            <label class="vnpt-settings-item">
                                <input type="checkbox" id="setting-darkMode" ${settings.darkMode ? 'checked' : ''}>
                                <span>Chế độ tối (Dark Mode)</span>
                            </label>
                            <label class="vnpt-settings-item">
                                <input type="checkbox" id="setting-autoScan" ${settings.autoScan ? 'checked' : ''}>
                                <span>Tự động quét</span>
                            </label>
                        </div>
                    </div>

                    <div class="vnpt-settings-section">
                        <h4>📋 Tính năng Cơ bản</h4>
                        <div class="vnpt-grid">
                            <label class="vnpt-settings-item">
                                <input type="checkbox" id="setting-vitalsDisplay" ${settings.vitalsDisplay ? 'checked' : ''}>
                                <span>Hiện Sinh hiệu</span>
                            </label>
                            <label class="vnpt-settings-item">
                                <input type="checkbox" id="setting-historySummary" ${settings.historySummary ? 'checked' : ''}>
                                <span>Tóm tắt Bệnh án</span>
                            </label>
                            <label class="vnpt-settings-item">
                                <input type="checkbox" id="setting-templateAutofill" ${settings.templateAutofill ? 'checked' : ''}>
                                <span>Tự động điền mẫu</span>
                            </label>
                        </div>
                    </div>

                    <div id="setting-ai-section" class="vnpt-settings-section" style="display: ${settings.aiEnabled ? 'block' : 'none'}; border: 1px dashed var(--vnpt-accent);">
                        <h4>🤖 Trí tuệ nhân tạo (AI - VIP)</h4>
                        <div class="vnpt-grid">
                            <label class="vnpt-settings-item">
                                <input type="checkbox" id="setting-aiEnabled" ${settings.aiEnabled ? 'checked' : ''}>
                                <span>Kích hoạt tự động tóm tắt AI</span>
                            </label>
                            <div class="vnpt-field-group" style="opacity: 0.7; font-size: 11px; color: var(--vnpt-accent);">
                                🔑 API Key được quản lý tại trang <strong>Cài đặt Aladinn</strong> (Options page)
                            </div>
                            <div class="vnpt-field-group">
                                <div style="display: flex; justify-content: space-between; align-items: center;">
                                    <span>AI Model:</span>
                                    <button id="vnpt-fetch-models" class="vnpt-link-btn" style="font-size: 10px;">Dò tìm mô hình...</button>
                                </div>
                                <select id="setting-geminiModel" style="padding: 8px; border-radius: 6px; border: 1px solid var(--vnpt-border); background: var(--vnpt-bg); color: var(--vnpt-text); font-size: 12px;">
                                    <option value="${settings.geminiModel || 'gemini-1.5-flash'}">${settings.geminiModel || 'gemini-1.5-flash'}</option>
                                    <option value="gemini-1.5-flash">gemini-1.5-flash</option>
                                    <option value="gemini-1.5-pro">gemini-1.5-pro</option>
                                    <option value="gemini-2.0-flash-exp">gemini-2.0-flash-exp</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div class="vnpt-settings-actions">
                    <button id="vnpt-settings-save" class="vnpt-btn vnpt-btn-save">💾 Lưu & Áp dụng</button>
                    <button id="vnpt-settings-reset" class="vnpt-link-btn">Đặt lại mặc định</button>
                </div>

                <div class="vnpt-settings-footer">
                    <div class="version-info">
                        VNPT HIS Smart Scanner <span class="version-tag" style="cursor: pointer;">v1.0.0</span>
                    </div>
                </div>
            </div>
        `;

        addStyles();
        setupListeners();
        document.body.appendChild(settingsPanel);
        return settingsPanel;
    }

    function setupListeners() {
        if (!settingsPanel) return;

        const closeBtn = settingsPanel.querySelector('.vnpt-settings-close');
        const saveBtn = settingsPanel.querySelector('#vnpt-settings-save');
        const resetBtn = settingsPanel.querySelector('#vnpt-settings-reset');

        if (closeBtn) closeBtn.addEventListener('click', hide);
        if (saveBtn) saveBtn.addEventListener('click', handleSave);
        if (resetBtn) resetBtn.addEventListener('click', () => {
            if (confirm('Bạn có chắc chắn muốn đặt lại toàn bộ cài đặt về mặc định?')) {
                saveSettings(defaultSettings);
                hide();
                showNotification('Đã đặt lại cài đặt mặc định', 'info');
            }
        });

        // Secret AI Toggle (5 clicks)
        const versionTag = /** @type {HTMLElement | null} */ (settingsPanel.querySelector('.version-tag'));
        const aiSection = /** @type {HTMLElement | null} */ (settingsPanel.querySelector('#setting-ai-section'));
        let clickCount = 0;
        /** @type {any} */
        let clickTimer = null;

        if (versionTag && aiSection) {
            versionTag.addEventListener('click', () => {
                clickCount++;
                if (clickTimer) clearTimeout(clickTimer);
                clickTimer = setTimeout(() => { clickCount = 0; }, 2000);

                if (clickCount >= 5) {
                    const isHidden = aiSection.style.display === 'none';
                    aiSection.style.display = isHidden ? 'block' : 'none';
                    versionTag.style.backgroundColor = isHidden ? '#22c55e' : '';
                    if (isHidden) showNotification('✨ Đã mở khóa tính năng AI VIP', 'success');
                    clickCount = 0;
                }
            });
        }

        // Fetch AI Models listener
        const fetchModelsBtn = /** @type {HTMLButtonElement | null} */ (settingsPanel.querySelector('#vnpt-fetch-models'));
        const modelSelect = /** @type {HTMLSelectElement | null} */ (settingsPanel.querySelector('#setting-geminiModel'));

        if (fetchModelsBtn && modelSelect) {
            fetchModelsBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                let apiKey = null;
                if (window.HIS && window.HIS.getApiKey) {
                    apiKey = await window.HIS.getApiKey();
                }
                if (!apiKey) {
                    showNotification('⚠️ Vui lòng cấu hình API Key trong trang Cài đặt (Options) trước!', 'warning');
                    return;
                }

                try {
                    fetchModelsBtn.innerText = '⏳ Đang quét...';
                    fetchModelsBtn.disabled = true;

                    const models = await (/** @type {any} */(window)).GeminiAPI.fetchModels(apiKey);
                    if (models && models.length > 0) {
                        modelSelect.innerHTML = '';
                        models.forEach((/** @type {any} */ m) => {
                            const opt = document.createElement('option');
                            opt.value = m.id;
                            opt.text = m.id; // Show ID for technical accuracy
                            modelSelect.appendChild(opt);
                        });
                        showNotification(`✅ Đã tìm thấy ${models.length} mô hình!`, 'success');
                    }
                } catch (err) {
                    showNotification('❌ Không thể lấy danh sách mô hình', 'warning');
                    console.error(err);
                } finally {
                    fetchModelsBtn.innerText = 'Dò tìm mô hình...';
                    fetchModelsBtn.disabled = false;
                }
            });
        }
    }

    function handleSave() {
        const darkMode = (/** @type {HTMLInputElement} */(document.getElementById('setting-darkMode')))?.checked;
        const autoScan = (/** @type {HTMLInputElement} */(document.getElementById('setting-autoScan')))?.checked;
        const vitalsDisplay = (/** @type {HTMLInputElement} */(document.getElementById('setting-vitalsDisplay')))?.checked;
        const historySummary = (/** @type {HTMLInputElement} */(document.getElementById('setting-historySummary')))?.checked;
        const templateAutofill = (/** @type {HTMLInputElement} */(document.getElementById('setting-templateAutofill')))?.checked;

        const aiEnabled = (/** @type {HTMLInputElement} */(document.getElementById('setting-aiEnabled')))?.checked;
        const geminiModel = (/** @type {HTMLSelectElement} */(document.getElementById('setting-geminiModel')))?.value;

        // NOTE: We do not overwrite geminiApiKey here anymore as it's managed via the Options page
        saveSettings({
            darkMode, autoScan, vitalsDisplay, historySummary, templateAutofill, aiEnabled, geminiModel
        });

        hide();
        showNotification('Đã lưu cài đặt và áp dụng', 'success');
    }

    function addStyles() {
        if (document.getElementById('vnpt-settings-v5-styles')) return;

        const style = document.createElement('style');
        style.id = 'vnpt-settings-v5-styles';
        style.textContent = `
            :root {
                --vnpt-bg: #ffffff;
                --vnpt-text: #1e293b;
                --vnpt-header: linear-gradient(135deg, #6366f1 0%, #a855f7 100%);
                --vnpt-border: #e2e8f0;
                --vnpt-accent: #6366f1;
                --vnpt-section: #f8fafc;
            }

            .vnpt-dark-mode {
                --vnpt-bg: #1e293b;
                --vnpt-text: #f1f5f9;
                --vnpt-header: linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%);
                --vnpt-border: #334155;
                --vnpt-accent: #818cf8;
                --vnpt-section: #0f172a;
            }

            .vnpt-settings-panel {
                position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.4); display: flex; align-items: center; justify-content: center;
                z-index: 999999; opacity: 0; visibility: hidden; transition: all 0.3s ease;
            }
            .vnpt-settings-panel.visible { opacity: 1; visibility: visible; }

            .vnpt-settings-container {
                background: var(--vnpt-bg); color: var(--vnpt-text); width: 95%; max-width: 420px;
                border-radius: 20px; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
                overflow: hidden; border: 1px solid var(--vnpt-border); transform: translateY(10px);
                transition: transform 0.3s ease;
            }
            .vnpt-settings-panel.visible .vnpt-settings-container { transform: translateY(0); }

            .vnpt-settings-header {
                padding: 20px; background: var(--vnpt-header); color: white;
                display: flex; justify-content: space-between; align-items: center;
            }
            .header-title { display: flex; align-items: center; gap: 10px; }
            .header-title h3 { margin: 0; font-size: 16px; font-weight: 600; }
            .vnpt-settings-close { background: none; border: none; color: white; font-size: 24px; cursor: pointer; }

            .vnpt-settings-content { padding: 20px; max-height: 60vh; overflow-y: auto; }
            .vnpt-settings-section { margin-bottom: 20px; padding: 15px; background: var(--vnpt-section); border-radius: 12px; }
            .vnpt-settings-section h4 { margin: 0 0 12px 0; font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--vnpt-accent); }

            .vnpt-grid { display: grid; grid-template-columns: 1fr; gap: 10px; }
            .vnpt-settings-item { display: flex; align-items: center; gap: 10px; font-size: 13px; cursor: pointer; }
            .vnpt-settings-item input[type="checkbox"] { width: 16px; height: 16px; accent-color: var(--vnpt-accent); }
            
            .vnpt-field-group { display: flex; flex-direction: column; gap: 5px; margin-top: 5px; }
            .vnpt-field-group span { font-size: 11px; font-weight: 600; color: #64748b; }
            .vnpt-field-group input { 
                padding: 8px; border-radius: 6px; border: 1px solid var(--vnpt-border); 
                background: var(--vnpt-bg); color: var(--vnpt-text); font-size: 12px;
            }

            .vnpt-settings-actions { padding: 15px 20px; display: flex; justify-content: space-between; align-items: center; background: rgba(0,0,0,0.02); }
            .vnpt-btn { padding: 8px 16px; border-radius: 8px; border: none; cursor: pointer; font-weight: 600; transition: 0.2s; }
            .vnpt-btn-save { background: var(--vnpt-accent); color: white; }
            .vnpt-btn-save:hover { opacity: 0.9; }

            .vnpt-link-btn { background: none; border: none; color: #64748b; cursor: pointer; text-decoration: underline; font-size: 12px; }

            .vnpt-settings-footer { padding: 12px; text-align: center; font-size: 11px; opacity: 0.5; }
            .version-tag { background: var(--vnpt-border); padding: 2px 6px; border-radius: 10px; }
        `;
        document.head.appendChild(style);
    }

    function show() {
        createPanel();
        setTimeout(() => {
            if (settingsPanel) {
                settingsPanel.classList.add('visible');
                isVisible = true;
            }
        }, 10);
    }

    function hide() {
        if (settingsPanel) {
            settingsPanel.classList.remove('visible');
            isVisible = false;
        }
    }

    /**
     * @param {string} message 
     * @param {'info' | 'warning' | 'success'} [type] 
     */
    function showNotification(message, type) {
        if (window.VNPTRealtime) {
            window.VNPTRealtime.showToast(message, type);
        }
    }

    function init() {
        const settings = getSettings();
        applySettings(settings);
        syncFromChrome();
        if (window.VNPTLogger) VNPTLogger.info('Settings', '✅ Settings v5.0 initialized');
    }

    return { show, hide, toggle: () => (isVisible ? hide() : show()), getSettings, init, syncFromChrome };
})();

/** @type {any} */
(window).VNPTSettings = VNPTSettings;
