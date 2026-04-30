/**
 * SECURITY PATCH NOTES (applied 2026-04-30):
 * 
 * [P1-SEC-001] storageKey design fix:
 *   - BG_DECRYPT_API_KEY now returns { unlocked: true } ONLY — no apiKey string.
 *   - Transcript encryption/decryption is now delegated to background via
 *     ENCRYPT_DATA / DECRYPT_DATA messages. storageKey is never a raw string.
 *   - Impact: window.storageKey is now a sentinel boolean/flag, not used directly
 *     by encryptData(). encryptData/decryptData in voice module route via background.
 * 
 * [P2-SEC-002] Legacy plaintext migration:
 *   - If legacy plaintext transcript/results found without a storageKey,
 *     they are shown with a warning banner. On next PIN unlock, re-encrypted.
 *   - If no unlock in 24h, plaintext is auto-purged on next load.
 * 
 * [P2-SEC-003] Legacy key cleanup:
 *   - After migration, `transcript`, `results`, `dashboard_password`, 
 *     `geminiApiKey`, `vnpt_error_logs` old plaintext keys are candidates
 *     for removal. Service worker handles cleanup on logout.
 */

/* (crypto delegated to background via encryptViaBackground/decryptViaBackground) */
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
        disableLogging: true,
        aiConsentGiven: false  // [P1-SEC-004] AI consent flag
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
        console.log('[HIS Storage] getSettings error:', e);
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
        console.log('[HIS Storage] setSettings error:', e);
    }
}

// ========================================
// Migration (step-by-step)
// ========================================
function migrateSettings(settings, fromVersion) {
    let s = { ...settings };

    // v1 → v2: add privacy defaults
    if (fromVersion < 2) {
        if (!s.privacy) s.privacy = { disableLogging: true, aiConsentGiven: false };
        if (!s.ai) s.ai = DEFAULT_SETTINGS.ai;
        if (!s.ui) s.ui = DEFAULT_SETTINGS.ui;
    }

    // Future: v2 → v3, etc.

    s._schemaVersion = STORAGE_SCHEMA_VERSION;
    return s;
}

// ========================================
// [P1-SEC-001] Background Crypto Service
// Encrypt/decrypt via background to avoid raw CryptoKey in content script.
// ========================================

/**
 * Encrypt plaintext via background service worker.
 * Background holds the non-extractable CryptoKey derived from PIN.
 * @param {string} plaintext
 * @returns {Promise<string|null>} ciphertext string, or null on failure
 */
async function encryptViaBackground(plaintext) {
    try {
        if (!chrome.runtime?.id) return null;
        const resp = await new Promise(resolve =>
            chrome.runtime.sendMessage({ type: 'ENCRYPT_DATA', payload: { plaintext } }, resolve)
        );
        if (resp?.ok && resp.ciphertext) return resp.ciphertext;
        return null;
    } catch (_) {
        return null;
    }
}

/**
 * Decrypt ciphertext via background service worker.
 * @param {string} ciphertext
 * @returns {Promise<string|null>} plaintext, or null on failure
 */
async function decryptViaBackground(ciphertext) {
    try {
        if (!chrome.runtime?.id) return null;
        const resp = await new Promise(resolve =>
            chrome.runtime.sendMessage({ type: 'DECRYPT_DATA', payload: { ciphertext } }, resolve)
        );
        if (resp?.ok && resp.plaintext !== undefined) return resp.plaintext;
        return null;
    } catch (_) {
        return null;
    }
}

// ========================================
// Save Data (Debounced) — window.transcript & results
// ========================================
let saveTimeout = null;

function saveData() {
    if (saveTimeout) clearTimeout(saveTimeout);
    saveTimeout = setTimeout(async () => {
        try {
            if (!chrome.runtime?.id) return;

            // [P1-SEC-001] SECURITY: Only save when background has CryptoKey (isAiUnlocked)
            // Never store plaintext transcript/results.
            if (!window.isAiUnlocked) {
                return; // Skip saving — data stays in memory only until PIN unlock
            }

            const encryptedTranscript = await encryptViaBackground(window.transcript || '');
            const encryptedResults = window.currentResults
                ? await encryptViaBackground(JSON.stringify(window.currentResults))
                : null;

            // Only persist if encryption succeeded
            if (encryptedTranscript !== null) {
                const toSave = { transcript: encryptedTranscript };
                if (encryptedResults !== null) toSave.results = encryptedResults;
                chrome.storage.local.set(toSave);
            }
        } catch (_e) {
            console.log('Extension context invalidated - please refresh page');
        }
    }, 300);
}

// ========================================
// [P2-SEC-002] Legacy plaintext detection helper
// ========================================
function isLikelyEncrypted(str) {
    // Encrypted format: "base64iv:base64ciphertext" — no spaces, contains ':'
    return typeof str === 'string' && str.includes(':') && !str.includes(' ');
}

function isPlaintextLegacy(str) {
    return typeof str === 'string' && !isLikelyEncrypted(str);
}

async function shouldPurgeLegacyData() {
    // If plaintext data was stored more than 24h ago, purge it
    try {
        const { _legacy_plaintext_timestamp } = await chrome.storage.local.get('_legacy_plaintext_timestamp');
        if (!_legacy_plaintext_timestamp) return false;
        const age = Date.now() - _legacy_plaintext_timestamp;
        return age > 24 * 60 * 60 * 1000; // 24 hours
    } catch (_) {
        return false;
    }
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
            'conversationMode',
            '_legacy_plaintext_timestamp'
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

        // --- Handle transcript loading ---
        if (result.transcript) {
            let t = result.transcript;

            if (window.isAiUnlocked && isLikelyEncrypted(t)) {
                // [P1-SEC-001] Decrypt via background service
                const decrypted = await decryptViaBackground(t);
                t = decrypted !== null ? decrypted : '';
            } else if (isPlaintextLegacy(t)) {
                // [P2-SEC-002] Legacy plaintext detected
                const shouldPurge = await shouldPurgeLegacyData();
                if (shouldPurge) {
                    // Auto-purge after 24h
                    chrome.storage.local.remove(['transcript', 'results', '_legacy_plaintext_timestamp']);
                    t = '';
                    console.log('[HIS Storage] 🧹 Auto-purged legacy plaintext transcript (>24h old).');
                } else {
                    // Record timestamp for TTL if not set
                    if (!result._legacy_plaintext_timestamp) {
                        chrome.storage.local.set({ _legacy_plaintext_timestamp: Date.now() });
                    }
                    // Show warning — data usable but user should unlock PIN to re-encrypt
                    window._hasLegacyPlaintext = true;
                }
            } else {
                // Encrypted but no unlock yet — don't load
                t = '';
            }

            window.transcript = t;
            const textarea = document.getElementById('his-transcript');
            if (textarea) textarea.value = window.transcript;
            window.updateProcessBtnState?.();
        }

        // --- Handle results loading ---
        if (result.results) {
            let r = result.results;

            if (window.isAiUnlocked && isLikelyEncrypted(r)) {
                // [P1-SEC-001] Decrypt via background service
                const decryptedStr = await decryptViaBackground(r);
                r = decryptedStr ? JSON.parse(decryptedStr) : null;
            } else if (typeof r === 'object' && r !== null) {
                // Legacy object format
                window._hasLegacyPlaintext = true;
            } else if (typeof r === 'string' && !isLikelyEncrypted(r)) {
                // Legacy JSON string
                try { r = JSON.parse(r); } catch (_e) { r = null; }
                window._hasLegacyPlaintext = true;
            } else {
                // Encrypted but no unlock yet — don't load
                r = null;
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

        // --- API Key availability check ---
        if (result.pin_hash && result.pin_salt && result.geminiApiKey_encrypted) {
            window.hasApiKey = true;
            // Check if background already has a cached derived key
            try {
                const resp = await new Promise(resolve =>
                    chrome.runtime.sendMessage({ type: 'BG_DECRYPT_API_KEY' }, resolve)
                );
                // [P1-SEC-001] FIX: Background only returns { unlocked: true/false }
                // Never returns the actual apiKey to content script.
                if (resp?.unlocked === true) {
                    window.isAiUnlocked = true;
                    // storageKey sentinel — actual crypto happens in background
                    window.storageKey = true;
                } else {
                    window.isAiUnlocked = false;
                    window.storageKey = null;
                }
            } catch (_) {
                window.isAiUnlocked = false;
                window.storageKey = null;
            }
        } else {
            window.hasApiKey = false;
            window.isAiUnlocked = false;
            window.storageKey = null;
        }

        // Update AI button visibility
        if (window.updateAIButtonVisibility) window.updateAIButtonVisibility();

        // If no API key → hide panel entirely
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

        // [P2-SEC-002] Show legacy plaintext warning banner
        if (window._hasLegacyPlaintext) {
            showLegacyPlaintextWarning();
        }

        window.isChuyenVienEnabled = result.aladinn_voice_appSettings?.autoChuyenVien === true;
        window.updateHoiChanButtonVisibility && window.updateHoiChanButtonVisibility();

    } catch (e) {
        console.log('HIS Storage Load Error:', e);
    }
}

// ========================================
// [P2-SEC-002] Legacy Plaintext Warning UI
// ========================================
function showLegacyPlaintextWarning() {
    const existingBanner = document.getElementById('his-legacy-warning');
    if (existingBanner) return;

    const banner = document.createElement('div');
    banner.id = 'his-legacy-warning';
    banner.style.cssText = `
        position: fixed; bottom: 80px; right: 16px; z-index: 2147483640;
        background: rgba(180, 100, 0, 0.9); color: #fff;
        padding: 10px 14px; border-radius: 10px; font-size: 12px;
        max-width: 260px; line-height: 1.4; border: 1px solid rgba(255,160,0,0.5);
        box-shadow: 0 4px 16px rgba(0,0,0,0.4);
    `;
    banner.textContent = '⚠️ Dữ liệu cũ chưa mã hóa. Nhập PIN để mã hóa và bảo vệ dữ liệu. Sẽ tự xóa sau 24h.';
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 8000);
}

// ========================================
// Global Exports (Voice Module)
// ========================================
window.getSettings = getSettings;
window.setSettings = setSettings;
window.saveData = saveData;
window.loadSavedData = loadSavedData;
window.encryptViaBackground = encryptViaBackground;
window.decryptViaBackground = decryptViaBackground;
