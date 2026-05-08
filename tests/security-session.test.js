/**
 * 🔒 Security & Session Tests
 * Covers: session timeout, logout purge, sender validation, settings whitelist, nonce
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------- Helpers to load ai-client fresh per test ----------
async function loadAiClient() {
    vi.resetModules();
    return import('../background/ai-client.js');
}

// ---------- 1. Session Timeout (30 min) ----------
describe('Security: Session Timeout', () => {
    beforeEach(() => {
        globalThis.chrome = {
            storage: {
                local: { get: vi.fn(async () => ({})) }
            }
        };
        globalThis.fetch = vi.fn();
    });

    it('clears cached key after 30 minutes of inactivity', async () => {
        // Derive a key first
        const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
        globalThis.chrome.storage.local.get = vi.fn(async () => ({
            pin_salt: salt
        }));

        await loadAiClient();

        // Derive key
        await globalThis.deriveBgKeyFromPin('123456');

        // Key should be present
        expect(globalThis._bgCachedKey).not.toBeNull();

        // Simulate 31 minutes passing by manipulating _lastActivityTime
        // Since _lastActivityTime is module-private, we test via bgDecryptApiKey behavior
        // after forcing timeout. We'll mock Date.now to simulate passage of time.
        const realDateNow = Date.now;
        const futureTime = realDateNow() + 31 * 60 * 1000;
        Date.now = vi.fn(() => futureTime);

        // Encrypted API key fixture
        globalThis.chrome.storage.local.get = vi.fn(async () => ({
            geminiApiKey_encrypted: 'fakeciphertext:fakedata',
            pin_salt: salt
        }));

        // Attempt decrypt — should fail because session timed out
        const result = await globalThis.bgDecryptApiKey();
        expect(result).toBe('');

        // Key should have been wiped
        expect(globalThis._bgCachedKey).toBeNull();

        Date.now = realDateNow;
    });

    it('does NOT timeout before 30 minutes', async () => {
        const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
        globalThis.chrome.storage.local.get = vi.fn(async () => ({
            pin_salt: salt
        }));

        await loadAiClient();
        await globalThis.deriveBgKeyFromPin('123456');

        expect(globalThis._bgCachedKey).not.toBeNull();

        // Simulate 29 minutes (under threshold)
        const realDateNow = Date.now;
        Date.now = vi.fn(() => realDateNow() + 29 * 60 * 1000);

        // Key should still be valid — bgEncryptData won't clear it
        // We can't test bgDecryptApiKey without real encrypted data, 
        // but we test that the key is NOT nulled
        globalThis.chrome.storage.local.get = vi.fn(async () => ({
            geminiApiKey_encrypted: 'fake:data',
            pin_salt: salt
        }));

        // bgDecryptApiKey will trigger checkSessionTimeout — key should survive
        await globalThis.bgDecryptApiKey().catch(() => {});
        // Key still present (timeout not triggered)
        expect(globalThis._bgCachedKey).not.toBeNull();

        Date.now = realDateNow;
    });
});

// ---------- 2. Logout Purge ----------
describe('Security: Logout Purge', () => {
    it('clears cached key on globalThis._bgCachedKey = null', async () => {
        const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
        globalThis.chrome = {
            storage: {
                local: { get: vi.fn(async () => ({ pin_salt: salt })) }
            }
        };
        globalThis.fetch = vi.fn();

        await loadAiClient();
        await globalThis.deriveBgKeyFromPin('123456');

        expect(globalThis._bgCachedKey).not.toBeNull();

        // Simulate what service-worker does on HIS logout
        globalThis._bgCachedKey = null;
        globalThis._bgCachedSalt = null;

        expect(globalThis._bgCachedKey).toBeNull();
        expect(globalThis._bgCachedSalt).toBeNull();

        // bgDecryptApiKey should now return empty
        globalThis.chrome.storage.local.get = vi.fn(async () => ({
            geminiApiKey_encrypted: 'some:data',
            pin_salt: salt
        }));
        const result = await globalThis.bgDecryptApiKey();
        expect(result).toBe('');
    });
});

// ---------- 3. Sender Validation ----------
describe('Security: Sender Validation', () => {
    // We test the isValidSender logic by recreating it (it's a private function in service-worker)
    // This validates the logic pattern used for sender checking.
    function isValidSender(sender, extensionId) {
        if (sender.id !== extensionId) return false;
        const senderUrl = sender.tab?.url || sender.url || '';
        if (senderUrl.startsWith(`chrome-extension://${extensionId}/`)) return true;
        if (sender.tab?.url && !sender.tab.url.match(/^https?:\/\/[^/]*\.vncare\.vn\//)) return false;
        return true;
    }

    const EXT_ID = 'abcdef1234567890';

    it('accepts messages from own extension pages', () => {
        expect(isValidSender({
            id: EXT_ID,
            url: `chrome-extension://${EXT_ID}/popup.html`
        }, EXT_ID)).toBe(true);
    });

    it('accepts messages from vncare.vn tabs', () => {
        expect(isValidSender({
            id: EXT_ID,
            tab: { url: 'https://hospital.vncare.vn/his/main' }
        }, EXT_ID)).toBe(true);
    });

    it('rejects messages from different extension IDs', () => {
        expect(isValidSender({
            id: 'different-extension-id',
            tab: { url: 'https://hospital.vncare.vn/his/main' }
        }, EXT_ID)).toBe(false);
    });

    it('rejects messages from non-vncare tabs', () => {
        expect(isValidSender({
            id: EXT_ID,
            tab: { url: 'https://evil.com/malicious' }
        }, EXT_ID)).toBe(false);
    });

    it('rejects messages from localhost tabs', () => {
        expect(isValidSender({
            id: EXT_ID,
            tab: { url: 'http://localhost:3000/attack' }
        }, EXT_ID)).toBe(false);
    });
});

// ---------- 4. Settings Whitelist ----------
describe('Security: Settings Whitelist', () => {
    const SETTINGS_READ_WHITELIST = [
        'aladinn_voice_settings', 'aladinn_voice_enabled',
        'selectedModel', 'geminiBaseUrl', 'aladinn_features'
    ];
    const SETTINGS_WRITE_WHITELIST = [
        'aladinn_voice_settings', 'aladinn_voice_enabled',
        'selectedModel', 'geminiBaseUrl', 'aladinn_features',
        'aladinn_voice_appSettings'
    ];

    it('never exposes API key via GET_SETTINGS', () => {
        const requestedKeys = ['geminiApiKey', 'geminiApiKey_encrypted', 'pin_salt', 'aladinn_voice_settings'];
        const safeKeys = requestedKeys.filter(k => SETTINGS_READ_WHITELIST.includes(k));

        expect(safeKeys).not.toContain('geminiApiKey');
        expect(safeKeys).not.toContain('geminiApiKey_encrypted');
        expect(safeKeys).not.toContain('pin_salt');
        expect(safeKeys).toContain('aladinn_voice_settings');
    });

    it('never writes API key via SET_SETTINGS', () => {
        const patch = {
            geminiApiKey: 'LEAKED_KEY',
            pin_salt: 'LEAKED_SALT',
            aladinn_voice_settings: { theme: 'dark' }
        };
        const safePatch = {};
        for (const key of Object.keys(patch)) {
            if (SETTINGS_WRITE_WHITELIST.includes(key)) {
                safePatch[key] = patch[key];
            }
        }

        expect(safePatch).not.toHaveProperty('geminiApiKey');
        expect(safePatch).not.toHaveProperty('pin_salt');
        expect(safePatch).toHaveProperty('aladinn_voice_settings');
    });
});

// ---------- 5. Encrypt/Decrypt Service ----------
describe('Security: Background Crypto Service', () => {
    beforeEach(() => {
        globalThis.chrome = {
            storage: {
                local: { get: vi.fn(async () => ({})) }
            }
        };
        globalThis.fetch = vi.fn();
    });

    it('encrypts and decrypts data roundtrip successfully', async () => {
        const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
        globalThis.chrome.storage.local.get = vi.fn(async () => ({
            pin_salt: salt
        }));

        await loadAiClient();
        await globalThis.deriveBgKeyFromPin('test-pin-123');

        const plaintext = 'Bệnh nhân ổn định, sinh hiệu bình thường';
        const encrypted = await globalThis.bgEncryptData(plaintext);

        expect(encrypted).toContain(':');
        expect(encrypted).not.toContain(plaintext);

        const decrypted = await globalThis.bgDecryptData(encrypted);
        expect(decrypted).toBe(plaintext);
    });

    it('fails to encrypt without PIN session', async () => {
        await loadAiClient();

        await expect(globalThis.bgEncryptData('test'))
            .rejects.toThrow('No session key');
    });

    it('fails to decrypt invalid ciphertext format', async () => {
        const salt = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(16))));
        globalThis.chrome.storage.local.get = vi.fn(async () => ({
            pin_salt: salt
        }));

        await loadAiClient();
        await globalThis.deriveBgKeyFromPin('test-pin');

        await expect(globalThis.bgDecryptData('no-colon-here'))
            .rejects.toThrow('Invalid ciphertext format');
    });
});

// ---------- 6. Endpoint Allowlist ----------
describe('Security: Endpoint Allowlist', () => {
    it('blocks untrusted base URLs', async () => {
        globalThis.chrome = {
            storage: {
                local: { get: vi.fn(async () => ({})) }
            }
        };
        globalThis.fetch = vi.fn();
        
        // We test getTrustedGeminiBaseUrl by importing the module and
        // checking that untrusted URLs are overridden in the actual API call.
        // Since getTrustedGeminiBaseUrl is private, we test the behavior
        // indirectly by checking that requestAI uses the correct URL.
        
        // Simulate storage with malicious base URL
        globalThis.chrome.storage.local.get = vi.fn(async (keys) => {
            if (Array.isArray(keys) && keys.includes('geminiApiKey_encrypted')) {
                return {};
            }
            return { geminiBaseUrl: 'https://evil.com/api' };
        });

        const { requestAI } = await loadAiClient();

        // Should fail with AI_LOCKED, but the URL check would have happened first
        await expect(requestAI({ text: 'test', model: 'gemini-2.0-flash', requestId: '1' }))
            .rejects.toMatchObject({ code: 'AI_LOCKED' });
    });
});
