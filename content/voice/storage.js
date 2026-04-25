/* global encryptData, decryptData */
/**
 * HIS Voice Assistant - Storage Module
 * Chrome storage operations with versioned schema and migration
 */

// ========================================
// Schema & Defaults
// ========================================
const STORAGE_SCHEMA_VERSION = 2;

const DEFAULT_SETTINGS = {
    _schemaVersion: STORAGE_SCHEMA_VERSION,
    ai: {
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
        endpoint: '',
        apiKey: ''
    },
    ui: {
        theme: 'dark',
        panelPinned: false
    },
    privacy: {
        disableLogging: true
    }
};

// ========================================
// Deep Merge Utility
// ========================================
function deepMerge(target, source) {
    const result = { ...target };
    for (const key of Object.keys(source)) {
        if (
            source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
            target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
        ) {
            result[key] = deepMerge(target[key], source[key]);
        } else {
            result[key] = source[key];
        }
    }
    return result;
}

// ========================================
// Settings: Get with Migration
// ========================================
async function getSettings() {
    try {
        if (!chrome.runtime?.id) return { ...DEFAULT_SETTINGS };

        const result = await chrome.storage.local.get('appSettings');
        let settings = result.appSettings;

        // No settings yet — initialize with defaults
        if (!settings) {
            // Migrate from legacy flat keys
            const legacy = await chrome.storage.local.get([
                'geminiApiKey', 'selectedModel', 'geminiBaseUrl',
                'settings'
            ]);
            const migrated = { ...DEFAULT_SETTINGS };

            if (legacy.geminiApiKey) migrated.ai.apiKey = legacy.geminiApiKey;
            if (legacy.selectedModel) migrated.ai.model = legacy.selectedModel;
            if (legacy.geminiBaseUrl) migrated.ai.endpoint = legacy.geminiBaseUrl;
            if (legacy.settings?.theme) migrated.ui.theme = legacy.settings.theme;

            migrated._schemaVersion = STORAGE_SCHEMA_VERSION;
            await chrome.storage.local.set({ appSettings: migrated });
            console.log('[HIS Storage] Migrated legacy settings to schema v' + STORAGE_SCHEMA_VERSION);
            return migrated;
        }

        // Schema version check & migration
        const currentVersion = settings._schemaVersion || 1;
        if (currentVersion < STORAGE_SCHEMA_VERSION) {
            settings = migrateSettings(settings, currentVersion);
            await chrome.storage.local.set({ appSettings: settings });
            console.log(`[HIS Storage] Migrated settings v${currentVersion} → v${STORAGE_SCHEMA_VERSION}`);
        }

        // Ensure all default keys exist (forward-compat)
        return deepMerge(DEFAULT_SETTINGS, settings);
    } catch (e) {
        console.error('[HIS Storage] getSettings error:', e);
        return { ...DEFAULT_SETTINGS };
    }
}

// ========================================
// Settings: Set (deep merge patch)
// ========================================
async function setSettings(patch) {
    try {
        if (!chrome.runtime?.id) return;

        const current = await getSettings();
        const updated = deepMerge(current, patch);
        updated._schemaVersion = STORAGE_SCHEMA_VERSION;
        await chrome.storage.local.set({ appSettings: updated });
        return updated;
    } catch (e) {
        console.error('[HIS Storage] setSettings error:', e);
    }
}

// ========================================
// Migration (step-by-step)
// ========================================
function migrateSettings(settings, fromVersion) {
    let s = { ...settings };

    // v1 → v2: add privacy defaults
    if (fromVersion < 2) {
        if (!s.privacy) s.privacy = { disableLogging: true };
        if (!s.ai) s.ai = DEFAULT_SETTINGS.ai;
        if (!s.ui) s.ui = DEFAULT_SETTINGS.ui;
    }

    // Future: v2 → v3, etc.

    s._schemaVersion = STORAGE_SCHEMA_VERSION;
    return s;
}

// ========================================
// Save Data (Debounced) — window.transcript & results
// ========================================
let saveTimeout = null;

function saveData() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            if (chrome.runtime?.id) {
                // SECURITY: Only save data when encryption key is available
                // Never store plaintext transcript/results
                if (!window.storageKey) {
                    return; // Skip saving — data stays in memory only
                }
                const encryptedTranscript = await encryptData(window.transcript, window.storageKey);
                const encryptedResults = window.currentResults ? await encryptData(JSON.stringify(window.currentResults), window.storageKey) : null;

                chrome.storage.local.set({
                    transcript: encryptedTranscript,
                    results: encryptedResults
                });
            }
        } catch (_e) {
            console.log('Extension context invalidated - please refresh page');
        }
    }, 300);
}

// ========================================
// Load Saved Data
// ========================================
async function loadSavedData() {
    try {
        if (!chrome.runtime?.id) return;

        const result = await chrome.storage.local.get([
            'transcript',
            'results',
            'geminiApiKey',
            'geminiApiKey_encrypted',
            'selectedModel',
            'geminiBaseUrl',
            'pin_hash',
            'pin_salt',
            'dashboard_password', // Legacy — will be migrated
            'aladinn_voice_appSettings',
            'conversationMode'
        ]);

        // --- Auto-migrate legacy plaintext PIN ---
        if (result.dashboard_password && !result.pin_hash) {
            if (HIS?.Crypto?.migrateIfNeeded) {
                await HIS.Crypto.migrateIfNeeded();
                // Reload after migration
                const updated = await chrome.storage.local.get(['pin_hash', 'pin_salt']);
                result.pin_hash = updated.pin_hash;
                result.pin_salt = updated.pin_salt;
            }
        }

        if (result.transcript) {
            let t = result.transcript;

            // Migration: Detect if data is encrypted (contains ':') or plain text
            const isEncrypted = typeof t === 'string' && t.includes(':') && !t.includes(' ');

            if (window.storageKey && isEncrypted) {
                // Decrypt encrypted data
                const decrypted = await decryptData(t, window.storageKey);
                t = decrypted !== null ? decrypted : '';
            } else if (!isEncrypted) {
                // Legacy plain text - use as is, will be encrypted on next save
            }

            window.transcript = t;
            const textarea = document.getElementById('his-transcript');
            if (textarea) textarea.value = window.transcript;
            window.updateProcessBtnState();
        }

        if (result.results) {
            let r = result.results;

            // Migration: Detect if data is encrypted string or legacy object
            const isEncryptedResults = typeof r === 'string' && r.includes(':') && !r.includes(' ');

            if (window.storageKey && isEncryptedResults) {
                // Decrypt encrypted data
                const decryptedStr = await decryptData(r, window.storageKey);
                r = decryptedStr ? JSON.parse(decryptedStr) : null;
            } else if (typeof r === 'object' && r !== null) {
                // Legacy object format - use as is, will be encrypted on next save
            } else if (typeof r === 'string' && !isEncryptedResults) {
                // Legacy JSON string (rare case)
                try { r = JSON.parse(r); } catch (_e) { r = null; }
            }

            window.currentResults = r;
            if (window.currentResults) window.displayResults(window.currentResults, false);
        }

        if (result.selectedModel) {
            window.currentModel = result.selectedModel;
        }

        if (result.geminiBaseUrl) {
            window.geminiBaseUrl = result.geminiBaseUrl;
        }

        // --- API Key availability check (don't lock panel — it's always accessible) ---
        // PIN + encrypted key → AI features available after unlock
        // No PIN → AI features hidden
        if (result.pin_hash && result.pin_salt && result.geminiApiKey_encrypted) {
            window.hasApiKey = true;
            // Check if background already has a cached derived key
            try {
                const resp = await new Promise(resolve =>
                    chrome.runtime.sendMessage({ type: 'BG_DECRYPT_API_KEY' }, resolve)
                );
                if (resp?.apiKey) {
                    // Background already has key decrypted — mark as unlocked
                    window.isAiUnlocked = true;
                    window.storageKey = resp.apiKey; // For transcript encryption
                } else {
                    window.isAiUnlocked = false;
                }
            } catch (_) {
                window.isAiUnlocked = false;
            }
        } else {
            window.hasApiKey = false;
            window.isAiUnlocked = false;
        }
        // Update AI button visibility
        if (window.updateAIButtonVisibility) window.updateAIButtonVisibility();

        // If no API key → hide panel entirely, only show mini button with lock indicator
        if (!window.hasApiKey) {
            window.hidePanel && window.hidePanel();
            const miniBtn = document.getElementById('his-mini-btn');
            if (miniBtn) {
                miniBtn.style.opacity = '0.5';
                miniBtn.title = '⚙️ Chưa cấu hình API Key — Nhấn để mở Cài đặt';
            }
        } else {
            const miniBtn = document.getElementById('his-mini-btn');
            if (miniBtn) {
                miniBtn.style.opacity = '1';
                miniBtn.title = 'Aladinn Voice Assistant';
            }
        }

        window.isChuyenVienEnabled = result.aladinn_voice_appSettings?.autoChuyenVien === true;
        window.updateHoiChanButtonVisibility && window.updateHoiChanButtonVisibility();

    } catch (e) {
        console.error('HIS Storage Load Error:', e);
    }
}

// ========================================
// Global Exports (Voice Module)
// ========================================
window.getSettings = getSettings;
window.setSettings = setSettings;
window.saveData = saveData;
window.loadSavedData = loadSavedData;
