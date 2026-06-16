/**
 * P1-01: API Key Isolation Tests
 * TDD: RED phase — tests written before implementation.
 *
 * Verifies:
 * - unlockWithPin() does NOT call HIS.Crypto.decryptAPIKey()
 * - unlockWithPin() sends CACHE_SESSION_PIN to background
 * - On background { ok: true } → sets _cachedKey = '__UNLOCKED__'
 * - On background { ok: false } → returns empty string
 * - No plaintext API key ever reaches content script memory
 * - getKey() only returns '__UNLOCKED__' sentinel, never real key
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================
// Mock chrome APIs
// =============================================
function createChromeStub() {
    const storageData = {};
    return {
        storage: {
            local: {
                get(keys, cb) {
                    const result = {};
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    for (const k of keyList) {
                        if (k in storageData) result[k] = storageData[k];
                    }
                    cb(result);
                },
                set(data, cb) {
                    Object.assign(storageData, data);
                    if (cb) cb();
                },
            },
        },
        runtime: {
            id: 'test-extension-id',
            sendMessage: vi.fn(),
            onMessage: { addListener: vi.fn() },
        },
        _storageData: storageData,
    };
}

function setupGlobals(chromeStub) {
    globalThis.chrome = chromeStub;
    globalThis.window = globalThis;
    globalThis.document = {
        getElementById: () => null,
        createElement: () => ({
            id: '',
            innerHTML: '',
            remove: vi.fn(),
            querySelectorAll: () => [],
            querySelector: () => ({ disabled: false }),
            style: {},
        }),
        documentElement: { appendChild: vi.fn() },
    };
    globalThis.HIS = {};
    globalThis.console = {
        log: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    };
}

// =============================================
// 1. unlockWithPin — No content-side decryption
// =============================================
describe('P1-01: unlockWithPin — API Key Isolation', () => {
    let chromeStub;

    beforeEach(() => {
        chromeStub = createChromeStub();
        setupGlobals(chromeStub);

        // Seed encrypted key in storage
        chromeStub._storageData.geminiApiKey_encrypted = 'encrypted-blob';
        chromeStub._storageData.pin_salt = 'test-salt-base64';
    });

    afterEach(() => {
        delete globalThis.chrome;
        delete globalThis.HIS;
        vi.restoreAllMocks();
    });

    async function loadModule() {
        // Clear module cache to get fresh IIFE execution
        vi.resetModules();
        await import('../../shared/api-key-service.js');
        return globalThis.HIS.ApiKeyService;
    }

    it('does NOT call HIS.Crypto.decryptAPIKey', async () => {
        const decryptSpy = vi.fn().mockResolvedValue('real-api-key');
        globalThis.HIS.Crypto = { decryptAPIKey: decryptSpy };

        // Background responds ok
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true });
        });

        const svc = await loadModule();
        await svc.unlockWithPin('123456');

        expect(decryptSpy).not.toHaveBeenCalled();
    });

    it('sends CACHE_SESSION_PIN with PIN to background', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true });
        });

        const svc = await loadModule();
        await svc.unlockWithPin('654321');

        expect(chromeStub.runtime.sendMessage).toHaveBeenCalledWith(
            expect.objectContaining({
                type: 'CACHE_SESSION_PIN',
                payload: { pin: '654321' },
            }),
            expect.any(Function)
        );
    });

    it('returns __UNLOCKED__ when background responds { ok: true }', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true });
        });

        const svc = await loadModule();
        const result = await svc.unlockWithPin('123456');

        expect(result).toBe('__UNLOCKED__');
    });

    it('returns empty string when background responds { ok: false }', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: false, error: 'KEY_DERIVATION_FAILED' });
        });

        const svc = await loadModule();
        const result = await svc.unlockWithPin('999999');

        expect(result).toBe('');
    });

    it('returns empty string when background throws error', async () => {
        chromeStub.runtime.sendMessage.mockImplementation(() => {
            throw new Error('Extension context invalidated');
        });

        const svc = await loadModule();
        const result = await svc.unlockWithPin('123456');

        expect(result).toBe('');
    });

    it('returns empty string for empty/null PIN', async () => {
        const svc = await loadModule();

        expect(await svc.unlockWithPin('')).toBe('');
        expect(await svc.unlockWithPin(null)).toBe('');
        expect(await svc.unlockWithPin(undefined)).toBe('');
    });

    it('returns empty string when no encrypted key in storage', async () => {
        delete chromeStub._storageData.geminiApiKey_encrypted;
        delete chromeStub._storageData.pin_salt;

        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true });
        });

        const svc = await loadModule();
        const result = await svc.unlockWithPin('123456');

        expect(result).toBe('');
        // Should NOT have sent message to background
        expect(chromeStub.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('getKey() returns __UNLOCKED__ sentinel, never a real key', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((msg, cb) => {
            if (msg.type === 'CACHE_SESSION_PIN') {
                cb({ ok: true });
            } else if (msg.type === 'BG_DECRYPT_API_KEY') {
                cb({ ok: true, unlocked: true });
            }
        });

        const svc = await loadModule();
        await svc.unlockWithPin('123456');

        const key = await svc.getKey();
        expect(key).toBe('__UNLOCKED__');
        // Must never be a real API key
        expect(key).not.toMatch(/^AIza/);
        expect(key).not.toMatch(/^sk-/);
    });
});

// =============================================
// 2. No plaintext key exposure anywhere
// =============================================
describe('P1-01: No plaintext key exposure', () => {
    let chromeStub;

    beforeEach(() => {
        chromeStub = createChromeStub();
        setupGlobals(chromeStub);
        chromeStub._storageData.geminiApiKey_encrypted = 'encrypted-blob';
        chromeStub._storageData.pin_salt = 'test-salt-base64';
    });

    afterEach(() => {
        delete globalThis.chrome;
        delete globalThis.HIS;
        vi.restoreAllMocks();
    });

    async function loadModule() {
        vi.resetModules();
        await import('../../shared/api-key-service.js');
        return globalThis.HIS.ApiKeyService;
    }

    it('isUnlocked() returns boolean, not a key', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true, unlocked: true });
        });

        const svc = await loadModule();
        const result = await svc.isUnlocked();

        expect(typeof result).toBe('boolean');
    });

    it('ensureUnlocked() returns boolean, not a key', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true, unlocked: true });
        });

        const svc = await loadModule();
        const result = await svc.ensureUnlocked();

        expect(typeof result).toBe('boolean');
    });
});
