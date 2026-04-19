/**
 * 🧞 Aladinn — Centralized API Key Service
 * Provides `HIS.getApiKey()` for ALL modules (Scanner, Voice, future modules).
 *
 * Resolution chain:
 *   1. In-memory cache (fastest)
 *   2. chrome.storage.local plaintext
 *   3. his_settings nested key
 *   4. Encrypted key → PIN prompt inline
 *
 * PIN Prompt: When encrypted key exists but PIN unavailable,
 * call `HIS.ApiKeyService.promptAndUnlock()` to show inline PIN dialog.
 */

window.HIS = window.HIS || {};

HIS.ApiKeyService = (function () {
    'use strict';

    /** @type {string} */
    let _cachedKey = '';
    /** @type {number} */
    let _cacheTimestamp = 0;
    const CACHE_TTL_MS = 30 * 60 * 1000; // Cache key for 30 minutes (matches auto-lock)

    /**
     * Get the Gemini API Key silently (no UI prompts).
     * @returns {Promise<string>} Decrypted API key or empty string
     */
    async function getKey() {
        // 1. Memory cache
        if (_cachedKey && (Date.now() - _cacheTimestamp < CACHE_TTL_MS)) {
            return _cachedKey;
        }

        try {
            const stored = await new Promise(resolve =>
                chrome.storage.local.get(
                    ['geminiApiKey', 'geminiApiKey_encrypted', 'pin_salt', 'his_settings'],
                    resolve
                )
            );

            // 2. Encrypted key → try background PIN cache
            if (stored.geminiApiKey_encrypted && stored.pin_salt) {
                const pin = await getPinFromBackground();
                if (pin && HIS.Crypto?.decryptAPIKey) {
                    const decrypted = await HIS.Crypto.decryptAPIKey(
                        stored.geminiApiKey_encrypted, pin, stored.pin_salt
                    );
                    if (decrypted) {
                        _cachedKey = sanitize(decrypted);
                        _cacheTimestamp = Date.now();
                        return _cachedKey;
                    }
                }
            }

            // 3. Plaintext fallback (legacy or no PIN configured)
            if (stored.geminiApiKey) {
                return sanitize(stored.geminiApiKey);
            }
            if (stored.his_settings?.geminiApiKey) {
                return sanitize(stored.his_settings.geminiApiKey);
            }

        } catch (err) {
            console.warn('[ApiKeyService] Error resolving API key:', err);
        }

        return '';
    }

    /**
     * Check if there IS an encrypted key that needs PIN to unlock.
     * @returns {Promise<boolean>}
     */
    async function needsPin() {
        try {
            const stored = await new Promise(resolve =>
                chrome.storage.local.get(['geminiApiKey_encrypted', 'pin_salt'], resolve)
            );
            return !!(stored.geminiApiKey_encrypted && stored.pin_salt);
        } catch (_) {
            return false;
        }
    }

    /**
     * Unlock encrypted key with a specific PIN.
     * @param {string} pin - The 6-digit PIN
     * @returns {Promise<string>} Decrypted key or empty string
     */
    async function unlockWithPin(pin) {
        if (!pin || !HIS.Crypto?.decryptAPIKey) return '';
        try {
            const stored = await new Promise(resolve =>
                chrome.storage.local.get(['geminiApiKey_encrypted', 'pin_salt'], resolve)
            );
            if (!stored.geminiApiKey_encrypted || !stored.pin_salt) return '';

            const decrypted = await HIS.Crypto.decryptAPIKey(
                stored.geminiApiKey_encrypted, pin, stored.pin_salt
            );
            if (decrypted) {
                _cachedKey = sanitize(decrypted);
                _cacheTimestamp = Date.now();
                // Cache PIN in background session for subsequent calls
                try {
                    chrome.runtime.sendMessage({
                        type: 'CACHE_SESSION_PIN',
                        payload: { pin }
                    });
                } catch (_) { /* ignore */ }
                return _cachedKey;
            }
        } catch (err) {
            console.warn('[ApiKeyService] PIN unlock failed:', err);
        }
        return '';
    }

    /**
     * Show an inline PIN prompt dialog and attempt unlock.
     * Returns the decrypted API key, or empty string if cancelled/failed.
     * @returns {Promise<string>}
     */
    function promptAndUnlock() {
        return new Promise((resolve) => {
            // Remove any existing prompt
            const existing = document.getElementById('his-pin-overlay');
            if (existing) existing.remove();

            const overlay = document.createElement('div');
            overlay.id = 'his-pin-overlay';
            overlay.innerHTML = `
                <style>
                    #his-pin-overlay {
                        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
                        background: rgba(11, 17, 33, 0.7); backdrop-filter: blur(4px);
                        display: flex; align-items: center; justify-content: center;
                        z-index: 999999; animation: hisPinFadeIn 0.25s ease;
                    }
                    @keyframes hisPinFadeIn { from { opacity: 0; } to { opacity: 1; } }
                    .his-pin-dialog {
                        background: rgba(20, 27, 45, 0.95); border-radius: 16px; padding: 32px;
                        border: 1px solid rgba(212, 168, 83, 0.2); box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                        text-align: center; min-width: 340px;
                        animation: hisPinSlideUp 0.3s cubic-bezier(0.34, 1.2, 0.64, 1);
                    }
                    @keyframes hisPinSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                    .his-pin-dialog h3 {
                        margin: 0 0 8px 0; color: #d4a853; font-size: 18px; font-weight: 700; font-family: Outfit, sans-serif;
                    }
                    .his-pin-dialog p {
                        margin: 0 0 20px 0; color: #8B8579; font-size: 13px; line-height: 1.5;
                    }
                    .his-pin-boxes {
                        display: flex; gap: 8px; justify-content: center; margin-bottom: 20px;
                    }
                    .his-pin-input {
                        width: 42px; height: 50px; background: rgba(212, 168, 83, 0.03); border: 1px solid rgba(212, 168, 83, 0.12);
                        border-radius: 10px; font-size: 22px; text-align: center; color: #E8E0D4;
                        outline: none; transition: all 0.2s;
                        -webkit-text-security: disc;
                    }
                    .his-pin-input:focus {
                        border-color: #d4a853; box-shadow: 0 0 0 3px rgba(212, 168, 83, 0.15); background: rgba(212, 168, 83, 0.08);
                    }
                    .his-pin-input.error {
                        border-color: #E85454; animation: hisPinShake 0.4s; box-shadow: 0 0 0 3px rgba(232, 84, 84, 0.15);
                    }
                    @keyframes hisPinShake {
                        0%,100% { transform: translateX(0); }
                        25% { transform: translateX(-5px); }
                        75% { transform: translateX(5px); }
                    }
                    .his-pin-actions { display: flex; gap: 10px; justify-content: center; }
                    .his-pin-btn {
                        padding: 10px 24px; border-radius: 8px; border: none;
                        font-size: 14px; font-weight: 600; cursor: pointer; transition: 0.2s;
                    }
                    .his-pin-submit {
                        background: #d4a853; color: #0b1121;
                    }
                    .his-pin-submit:hover { filter: brightness(1.1); }
                    .his-pin-submit:disabled { opacity: 0.5; cursor: not-allowed; }
                    .his-pin-cancel {
                        background: rgba(212, 168, 83, 0.05); color: #8B8579; border: 1px solid rgba(212, 168, 83, 0.2);
                    }
                    .his-pin-cancel:hover { background: rgba(212, 168, 83, 0.1); color: #E8E0D4; }
                    .his-pin-error-msg {
                        color: #E85454; font-size: 12px; margin-top: 12px;
                        min-height: 18px; font-weight: 500;
                    }
                </style>
                <div class="his-pin-dialog">
                    <h3>🔐 Nhập mã PIN để mở khóa AI VIP</h3>
                    <p>API Key đã được mã hóa. Nhập PIN 6 số để giải mã.<br>Sai PIN sẽ tự động chuyển về chế độ Bình thường.</p>
                    <div class="his-pin-boxes">
                        <input type="tel" maxlength="1" class="his-pin-input" data-idx="0" autocomplete="off">
                        <input type="tel" maxlength="1" class="his-pin-input" data-idx="1" autocomplete="off">
                        <input type="tel" maxlength="1" class="his-pin-input" data-idx="2" autocomplete="off">
                        <input type="tel" maxlength="1" class="his-pin-input" data-idx="3" autocomplete="off">
                        <input type="tel" maxlength="1" class="his-pin-input" data-idx="4" autocomplete="off">
                        <input type="tel" maxlength="1" class="his-pin-input" data-idx="5" autocomplete="off">
                    </div>
                    <div class="his-pin-actions">
                        <button class="his-pin-btn his-pin-submit" disabled>🔓 Xác nhận</button>
                        <button class="his-pin-btn his-pin-cancel">Hủy (Dùng BASE)</button>
                    </div>
                    <div class="his-pin-error-msg"></div>
                </div>
            `;
            document.body.appendChild(overlay);

            const inputs = overlay.querySelectorAll('.his-pin-input');
            const submitBtn = overlay.querySelector('.his-pin-submit');
            const cancelBtn = overlay.querySelector('.his-pin-cancel');
            const errorMsg = overlay.querySelector('.his-pin-error-msg');

            function cleanup() {
                overlay.style.opacity = '0';
                setTimeout(() => overlay.remove(), 200);
            }

            function getPin() {
                return Array.from(inputs).map(i => i.value).join('');
            }

            // Auto-focus and navigate between boxes
            inputs.forEach((input, idx) => {
                input.addEventListener('input', () => {
                    input.value = input.value.replace(/\D/g, ''); // Only digits
                    if (input.value && idx < 5) inputs[idx + 1].focus();
                    const pin = getPin();
                    submitBtn.disabled = pin.length < 6;
                    // Auto-submit khi đủ 6 số — không cần bấm Enter
                    if (pin.length === 6) {
                        submitBtn.click();
                    }
                });
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Backspace' && !input.value && idx > 0) {
                        inputs[idx - 1].focus();
                    }
                    if (e.key === 'Enter' && getPin().length === 6) {
                        submitBtn.click();
                    }
                    if (e.key === 'Escape') {
                        cancelBtn.click();
                    }
                });
            });
            inputs[0].focus();

            // Cancel → resolve empty (caller will fallback to BASE)
            cancelBtn.addEventListener('click', () => {
                cleanup();
                resolve('');
            });

            // Click overlay background to cancel
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    cleanup();
                    resolve('');
                }
            });

            // Submit PIN
            submitBtn.addEventListener('click', async () => {
                const pin = getPin();
                if (pin.length !== 6) return;

                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Đang xác minh...';
                errorMsg.textContent = '';

                const key = await unlockWithPin(pin);
                if (key) {
                    cleanup();
                    resolve(key);
                } else {
                    // Wrong PIN → shake + show error
                    inputs.forEach(i => {
                        i.classList.add('error');
                        i.value = '';
                    });
                    setTimeout(() => inputs.forEach(i => i.classList.remove('error')), 400);
                    inputs[0].focus();
                    errorMsg.textContent = '❌ Sai mã PIN. Thử lại hoặc Hủy để dùng chế độ Bình thường.';
                    submitBtn.textContent = '🔓 Xác nhận';
                    submitBtn.disabled = true;
                }
            });
        });
    }

    // --- Helper functions ---

    async function getPinFromBackground() {
        try {
            const response = await new Promise(resolve =>
                chrome.runtime.sendMessage({ type: 'GET_SESSION_PIN' }, resolve)
            );
            return response?.pin || '';
        } catch (_) {
            return '';
        }
    }

    function sanitize(key) {
        if (!key) return '';
        // eslint-disable-next-line no-control-regex
        return key.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '').trim();
    }

    function clearCache() {
        _cachedKey = '';
        _cacheTimestamp = 0;
    }

    async function getModel() {
        try {
            const localSettings = localStorage.getItem('vnpt_settings');
            if (localSettings) {
                const parsed = JSON.parse(localSettings);
                if (parsed.geminiModel) return parsed.geminiModel;
            }
            const stored = await new Promise(resolve =>
                chrome.storage.local.get(['selectedModel'], resolve)
            );
            return stored.selectedModel || 'gemini-2.0-flash';
        } catch (_) {
            return 'gemini-2.0-flash';
        }
    }

    async function hasKey() {
        try {
            const stored = await new Promise(resolve =>
                chrome.storage.local.get(['geminiApiKey', 'geminiApiKey_encrypted', 'his_settings'], resolve)
            );
            return !!(stored.geminiApiKey || stored.geminiApiKey_encrypted || stored.his_settings?.geminiApiKey);
        } catch (_) {
            return false;
        }
    }

    // Listen for logout events
    if (HIS.EventBus) {
        HIS.EventBus.on('session:logout', clearCache);
    }

    return { getKey, getModel, hasKey, clearCache, needsPin, unlockWithPin, promptAndUnlock };
})();

// Convenience shortcuts
HIS.getApiKey = HIS.ApiKeyService.getKey;
HIS.getAiModel = HIS.ApiKeyService.getModel;

// Listen for SESSION_LOGOUT from background
if (chrome.runtime?.onMessage) {
    chrome.runtime.onMessage.addListener((message) => {
        if (message?.type === 'SESSION_LOGOUT') {
            HIS.ApiKeyService.clearCache();
            console.log('[ApiKeyService] 🔒 Cache cleared on logout');
        }
    });
}

console.log('[Aladinn] 🔑 API Key Service loaded');
