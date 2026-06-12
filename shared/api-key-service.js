/**
 * 🧞 Aladinn — Centralized API Key Service
 * Provides AI unlock state helpers for ALL modules (Scanner, Voice, future modules).
 *
 * Resolution chain:
 *   1. Background in-memory CryptoKey unlock status
 *   2. Encrypted key → PIN prompt inline
 *
 * PIN Prompt: When encrypted key exists but PIN unavailable,
 * call `HIS.ApiKeyService.promptAndUnlock()` to show inline PIN dialog.
 */

window.HIS = window.HIS || {};

HIS.ApiKeyService = (function () {
    'use strict';

    // SECURITY: Hằng số chống brute-force PIN
    const MAX_PIN_ATTEMPTS = 5;
    const PIN_LOCKOUT_MS = 5 * 60 * 1000; // 5 phút khóa

    // SECURITY: Biến trạng thái rate-limit PIN (trong bộ nhớ, reset khi reload trang)
    let _pinAttemptCount = 0;
    let _pinLockoutUntil = 0;

    /** @type {string} */
    let _cachedKey = '';
    /** @type {number} */
    let _cacheTimestamp = 0;
    /**
     * Check whether the background session can decrypt the Gemini API key.
     * SECURITY: Content scripts never receive the API key.
     * @returns {Promise<boolean>}
     */
    async function isUnlocked() {
        try {
            const stored = await new Promise(resolve =>
                chrome.storage.local.get(
                    ['geminiApiKey', 'geminiApiKey_encrypted', 'pin_salt', 'his_settings'],
                    resolve
                )
            );

            // 2. Encrypted key → ask background whether it can decrypt
            if (stored.geminiApiKey_encrypted && stored.pin_salt) {
                const unlocked = await getUnlockStatusFromBackground();
                if (unlocked) {
                    _cachedKey = '__UNLOCKED__';
                    _cacheTimestamp = Date.now();
                    return true;
                }
            }

            // 3. SECURITY: Plaintext fallback REMOVED — trigger migration warning
            if (stored.geminiApiKey || stored.his_settings?.geminiApiKey) {
                console.warn('[ApiKeyService] ⚠️ Plaintext API key detected! Migration required. Ignoring plaintext key.');
                // Don't return plaintext key — user must re-encrypt via Options
            }

        } catch (err) {
            console.warn('[ApiKeyService] Error resolving API key:', err);
        }

        return false;
    }

    /**
     * Backward-compatible alias. Do not use for new code.
     * @returns {Promise<string>} sentinel when unlocked, otherwise empty string
     */
    async function getKey() {
        return (await isUnlocked()) ? '__UNLOCKED__' : '';
    }

    async function ensureUnlocked() {
        if (await isUnlocked()) return true;
        if (await needsPin()) {
            return !!(await promptAndUnlock());
        }
        return false;
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
                // Cache PIN in background session for subsequent calls
                try {
                    const resp = await new Promise(resolve => {
                        chrome.runtime.sendMessage({
                            type: 'CACHE_SESSION_PIN',
                            payload: { pin }
                        }, resolve);
                    });
                    if (!resp?.ok) return '';
                } catch (_) {
                    return '';
                }
                _cachedKey = '__UNLOCKED__';
                _cacheTimestamp = Date.now();
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
                        background: rgba(5, 8, 18, 0.82);
                        backdrop-filter: blur(8px) saturate(1.5);
                        display: flex; align-items: center; justify-content: center;
                        z-index: 2147483647;
                        animation: hisPinFadeIn 0.3s ease;
                    }
                    @keyframes hisPinFadeIn { from { opacity: 0; } to { opacity: 1; } }

                    .his-pin-dialog {
                        position: relative; overflow: hidden;
                        background: linear-gradient(145deg, rgba(20,27,50,0.98) 0%, rgba(14,19,38,0.98) 100%);
                        border-radius: 20px; padding: 36px 32px 28px;
                        border: 1px solid rgba(212,168,83,0.25);
                        box-shadow: 0 0 0 1px rgba(212,168,83,0.06),
                                    0 24px 80px rgba(0,0,0,0.7),
                                    0 0 60px rgba(212,168,83,0.06) inset;
                        text-align: center; min-width: 360px;
                        animation: hisPinSlideUp 0.35s cubic-bezier(0.34,1.2,0.64,1);
                    }

                    /* Ambient glow corners */
                    .his-pin-dialog::before {
                        content: ''; position: absolute; top: -60px; right: -60px;
                        width: 180px; height: 180px;
                        background: radial-gradient(circle, rgba(212,168,83,0.12) 0%, transparent 70%);
                        pointer-events: none;
                    }
                    .his-pin-dialog::after {
                        content: ''; position: absolute; bottom: -40px; left: -40px;
                        width: 140px; height: 140px;
                        background: radial-gradient(circle, rgba(212,168,83,0.07) 0%, transparent 70%);
                        pointer-events: none;
                    }

                    @keyframes hisPinSlideUp {
                        from { transform: translateY(24px) scale(0.96); opacity: 0; }
                        to   { transform: translateY(0)   scale(1);    opacity: 1; }
                    }

                    /* Gold crown icon */
                    .his-pin-crown {
                        font-size: 32px; margin-bottom: 10px; display: block;
                        animation: hisCrownBounce 0.6s cubic-bezier(0.34,1.4,0.64,1) 0.2s both;
                        filter: drop-shadow(0 0 8px rgba(212,168,83,0.6));
                    }
                    @keyframes hisCrownBounce {
                        from { transform: translateY(-12px) scale(0.8); opacity: 0; }
                        to   { transform: translateY(0)      scale(1);   opacity: 1; }
                    }

                    .his-pin-dialog h3 {
                        margin: 0 0 6px 0;
                        background: linear-gradient(135deg, #f5d78e 0%, #d4a853 50%, #b8860b 100%);
                        -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                        background-clip: text;
                        font-size: 17px; font-weight: 800; font-family: Outfit, sans-serif;
                        letter-spacing: 0.3px;
                    }
                    .his-pin-dialog p {
                        margin: 0 0 22px 0; color: #6b7280; font-size: 12.5px; line-height: 1.6;
                    }

                    /* PIN boxes */
                    .his-pin-boxes {
                        display: flex; gap: 9px; justify-content: center; margin-bottom: 22px;
                    }
                    .his-pin-input {
                        width: 44px; height: 52px;
                        background: rgba(212,168,83,0.04);
                        border: 1.5px solid rgba(212,168,83,0.15);
                        border-radius: 12px; font-size: 24px; text-align: center; color: #f5d78e;
                        outline: none; transition: all 0.2s;
                        -webkit-text-security: disc;
                        font-family: monospace;
                    }
                    .his-pin-input:focus {
                        border-color: #d4a853;
                        box-shadow: 0 0 0 3px rgba(212,168,83,0.18), 0 0 12px rgba(212,168,83,0.15);
                        background: rgba(212,168,83,0.09);
                        transform: scale(1.05);
                    }
                    .his-pin-input.filled {
                        border-color: rgba(212,168,83,0.5);
                        background: rgba(212,168,83,0.07);
                    }
                    .his-pin-input.error {
                        border-color: #ef4444;
                        animation: hisPinShake 0.4s;
                        box-shadow: 0 0 0 3px rgba(239,68,68,0.15);
                        background: rgba(239,68,68,0.06);
                    }
                    @keyframes hisPinShake {
                        0%,100% { transform: translateX(0); }
                        20%     { transform: translateX(-6px); }
                        60%     { transform: translateX(6px); }
                        80%     { transform: translateX(-3px); }
                    }

                    /* Buttons row */
                    .his-pin-actions {
                        display: flex; gap: 10px; justify-content: center; align-items: stretch;
                    }
                    .his-pin-btn {
                        flex: 1;
                        padding: 11px 16px; border-radius: 10px; border: none;
                        font-size: 13.5px; font-weight: 700; cursor: pointer;
                        transition: all 0.2s; font-family: Outfit, sans-serif;
                        line-height: 1.2; display: flex; align-items: center; justify-content: center;
                    }
                    .his-pin-submit {
                        background: linear-gradient(135deg, #d4a853, #b8860b);
                        color: #0b0f1e;
                        box-shadow: 0 4px 16px rgba(212,168,83,0.3);
                        position: relative; overflow: hidden;
                    }
                    .his-pin-submit::after {
                        content: '';
                        position: absolute; top: -50%; left: -60%;
                        width: 40%; height: 200%;
                        background: rgba(255,255,255,0.25);
                        transform: skewX(-20deg);
                        animation: hisShimmer 2.5s infinite;
                    }
                    @keyframes hisShimmer {
                        0%   { left: -60%; }
                        100% { left: 130%; }
                    }
                    .his-pin-submit:hover:not(:disabled) {
                        filter: brightness(1.12);
                        box-shadow: 0 6px 24px rgba(212,168,83,0.45);
                        transform: translateY(-1px);
                    }
                    .his-pin-submit:disabled {
                        opacity: 0.45; cursor: not-allowed; transform: none;
                        box-shadow: none;
                    }
                    .his-pin-cancel {
                        background: rgba(255,255,255,0.04);
                        color: #6b7280; border: 1.5px solid rgba(255,255,255,0.08);
                    }
                    .his-pin-cancel:hover {
                        background: rgba(255,255,255,0.08); color: #9ca3af;
                        border-color: rgba(255,255,255,0.15);
                    }
                    .his-pin-error-msg {
                        color: #f87171; font-size: 12px; margin-top: 12px;
                        min-height: 18px; font-weight: 500; letter-spacing: 0.2px;
                    }
                    /* Divider line */
                    .his-pin-divider {
                        height: 1px;
                        background: linear-gradient(90deg, transparent, rgba(212,168,83,0.15), transparent);
                        margin-bottom: 18px;
                    }
                </style>
                <div class="his-pin-dialog">
                    <span class="his-pin-crown">👑</span>
                    <h3>Nhập mã PIN để mở khóa AI VIP</h3>
                    <p>API Key đã được mã hóa bảo mật.<br>Nhập PIN 6 số để tiếp tục.</p>
                    <div class="his-pin-divider"></div>
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
                        <button class="his-pin-btn his-pin-cancel">Hủy</button>
                    </div>
                    <div class="his-pin-error-msg"></div>
                </div>
            `;

            document.documentElement.appendChild(overlay);

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
                    input.classList.toggle('filled', input.value.length > 0);
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

                // SECURITY: Rate limiting — chống brute-force PIN
                const now = Date.now();
                if (_pinLockoutUntil > now) {
                    const remainSec = Math.ceil((_pinLockoutUntil - now) / 1000);
                    errorMsg.textContent = `🔒 Đã khóa do nhập sai quá nhiều lần. Thử lại sau ${remainSec} giây.`;
                    errorMsg.style.color = '#dc2626';
                    return;
                }

                submitBtn.disabled = true;
                submitBtn.textContent = '⏳ Đang xác minh...';
                errorMsg.textContent = '';

                const key = await unlockWithPin(pin);
                if (key) {
                    // SECURITY: Reset bộ đếm khi nhập PIN đúng
                    _pinAttemptCount = 0;
                    _pinLockoutUntil = 0;
                    cleanup();
                    resolve(key);
                } else {
                    // SECURITY: Tăng bộ đếm khi nhập PIN sai
                    _pinAttemptCount++;
                    if (_pinAttemptCount >= MAX_PIN_ATTEMPTS) {
                        _pinLockoutUntil = Date.now() + PIN_LOCKOUT_MS;
                        _pinAttemptCount = 0;
                        errorMsg.textContent = `🔒 Khóa 5 phút do nhập sai ${MAX_PIN_ATTEMPTS} lần.`;
                        errorMsg.style.color = '#dc2626';
                        submitBtn.textContent = '🔓 Xác nhận';
                        submitBtn.disabled = true;
                        inputs.forEach(i => { i.value = ''; i.classList.remove('filled'); });
                        return;
                    }
                    // Wrong PIN → shake + show error
                    inputs.forEach(i => {
                        i.classList.add('error');
                        i.value = '';
                    });
                    setTimeout(() => inputs.forEach(i => i.classList.remove('error')), 400);
                    inputs[0].focus();
                    const remain = MAX_PIN_ATTEMPTS - _pinAttemptCount;
                    errorMsg.textContent = `❌ Sai mã PIN. Còn ${remain} lần thử. Hủy để dùng chế độ Bình thường.`;
                    submitBtn.textContent = '🔓 Xác nhận';
                    submitBtn.disabled = true;
                }
            });
        });
    }

    // --- Helper functions ---

    /**
     * Ask background to decrypt the API key using its cached CryptoKey.
     * Content scripts NEVER receive the PIN.
     */
    async function getUnlockStatusFromBackground() {
        try {
            const response = await new Promise(resolve =>
                chrome.runtime.sendMessage({ type: 'BG_DECRYPT_API_KEY' }, resolve)
            );
            return response?.unlocked === true;
        } catch (_) {
            return false;
        }
    }

    function clearCache() {
        _cachedKey = '';
        _cacheTimestamp = 0;
    }

    async function getModel() {
        try {
            const stored = await new Promise(resolve =>
                chrome.storage.local.get(['selectedModel', 'his_settings'], resolve)
            );
            return stored.his_settings?.geminiModel || stored.selectedModel || 'gemini-1.5-flash';
        } catch (_) {
            return 'gemini-1.5-flash';
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

    return { getKey, getModel, hasKey, clearCache, needsPin, unlockWithPin, promptAndUnlock, isUnlocked, ensureUnlocked };
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
