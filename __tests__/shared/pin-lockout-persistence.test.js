/**
 * P1-02: PIN Lockout Persistence Tests
 * TDD: RED phase — tests written before implementation.
 *
 * Verifies:
 * - Failed PIN attempts are persisted to chrome.storage.local
 * - Lockout state survives module reload (simulating page reload)
 * - Lockout tier escalation: 5min → 15min → 30min
 * - Correct PIN resets all lockout state (memory + storage)
 * - HIS logout does NOT reset lockout when currently locked
 * - Module initialization restores lockout state from storage
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// =============================================
// Mock chrome APIs with persistent storage
// =============================================
function createChromeStub(sharedStorage) {
    const storageData = sharedStorage || {};
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

async function loadModule() {
    vi.resetModules();
    await import('../../shared/api-key-service.js');
    return globalThis.HIS.ApiKeyService;
}

// =============================================
// 1. Lockout state persistence
// =============================================
describe('P1-02: PIN Lockout Persistence — Storage', () => {
    let sharedStorage;
    let chromeStub;

    beforeEach(() => {
        sharedStorage = {
            geminiApiKey_encrypted: 'encrypted-blob',
            pin_salt: 'test-salt-base64',
        };
        chromeStub = createChromeStub(sharedStorage);
        setupGlobals(chromeStub);
    });

    afterEach(() => {
        delete globalThis.chrome;
        delete globalThis.HIS;
        vi.restoreAllMocks();
    });

    it('saves pin_failed_attempts to storage on wrong PIN', async () => {
        // Background rejects PIN (key derivation works but decrypt fails)
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: false, error: 'KEY_DERIVATION_FAILED' });
        });

        const svc = await loadModule();
        await svc.unlockWithPin('000000');

        expect(sharedStorage.pin_failed_attempts).toBe(1);
    });

    it('increments pin_failed_attempts on each wrong PIN', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: false });
        });

        const svc = await loadModule();
        await svc.unlockWithPin('111111');
        await svc.unlockWithPin('222222');
        await svc.unlockWithPin('333333');

        expect(sharedStorage.pin_failed_attempts).toBe(3);
    });

    it('sets lockout timestamp after 5 wrong attempts', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: false });
        });

        const svc = await loadModule();
        for (let i = 0; i < 5; i++) {
            await svc.unlockWithPin('000000');
        }

        expect(sharedStorage.pin_lockout_until).toBeGreaterThan(Date.now());
        // Tier is incremented to next tier after lockout
        expect(sharedStorage.pin_lockout_tier).toBe(1);
    });

    it('returns empty string when locked out (even before 5th attempt is reached)', async () => {
        // Pre-set lockout in storage
        sharedStorage.pin_lockout_until = Date.now() + 300000; // 5 min
        sharedStorage.pin_failed_attempts = 0;
        sharedStorage.pin_lockout_tier = 0;

        const svc = await loadModule();
        const result = await svc.unlockWithPin('123456');

        expect(result).toBe('');
        // Should NOT have sent message to background
        expect(chromeStub.runtime.sendMessage).not.toHaveBeenCalled();
    });
});

// =============================================
// 2. Lockout survives module reload
// =============================================
describe('P1-02: PIN Lockout Persistence — Survives Reload', () => {
    let sharedStorage;

    beforeEach(() => {
        sharedStorage = {
            geminiApiKey_encrypted: 'encrypted-blob',
            pin_salt: 'test-salt-base64',
        };
    });

    afterEach(() => {
        delete globalThis.chrome;
        delete globalThis.HIS;
        vi.restoreAllMocks();
    });

    it('restores lockout state after simulated page reload', async () => {
        // Session 1: Accumulate 5 failed attempts → lockout
        const chrome1 = createChromeStub(sharedStorage);
        setupGlobals(chrome1);
        chrome1.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: false });
        });

        const svc1 = await loadModule();
        for (let i = 0; i < 5; i++) {
            await svc1.unlockWithPin('000000');
        }

        const lockoutTime = sharedStorage.pin_lockout_until;
        expect(lockoutTime).toBeGreaterThan(Date.now());

        // Session 2: Simulate page reload — new module load, same storage
        const chrome2 = createChromeStub(sharedStorage);
        setupGlobals(chrome2);
        chrome2.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true });
        });

        const svc2 = await loadModule();
        // Should still be locked out despite fresh module
        const result = await svc2.unlockWithPin('correct-pin');

        expect(result).toBe('');
        // Background should not have been called
        expect(chrome2.runtime.sendMessage).not.toHaveBeenCalled();
    });

    it('allows unlock after lockout period expires', async () => {
        // Set lockout in the past
        sharedStorage.pin_lockout_until = Date.now() - 1000;
        sharedStorage.pin_failed_attempts = 0;
        sharedStorage.pin_lockout_tier = 0;

        const chrome = createChromeStub(sharedStorage);
        setupGlobals(chrome);
        chrome.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true });
        });

        const svc = await loadModule();
        const result = await svc.unlockWithPin('123456');

        expect(result).toBe('__UNLOCKED__');
    });
});

// =============================================
// 3. Lockout tier escalation
// =============================================
describe('P1-02: PIN Lockout Tier Escalation', () => {
    let sharedStorage;
    let chromeStub;

    beforeEach(() => {
        sharedStorage = {
            geminiApiKey_encrypted: 'encrypted-blob',
            pin_salt: 'test-salt-base64',
        };
        chromeStub = createChromeStub(sharedStorage);
        setupGlobals(chromeStub);
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: false });
        });
    });

    afterEach(() => {
        delete globalThis.chrome;
        delete globalThis.HIS;
        vi.restoreAllMocks();
    });

    it('tier 0: first 5 failures → lock 5 minutes', async () => {
        const svc = await loadModule();
        for (let i = 0; i < 5; i++) {
            await svc.unlockWithPin('000000');
        }

        const lockDuration = sharedStorage.pin_lockout_until - Date.now();
        // Should be approximately 5 minutes (allow 1s tolerance)
        expect(lockDuration).toBeGreaterThan(4 * 60 * 1000);
        expect(lockDuration).toBeLessThanOrEqual(5 * 60 * 1000 + 1000);
        // Tier incremented to 1 (next tier) after using tier 0
        expect(sharedStorage.pin_lockout_tier).toBe(1);
    });

    it('tier 1: next 5 failures after tier 0 unlock → lock 15 minutes', async () => {
        // Pre-set: tier 0 lockout has expired
        sharedStorage.pin_lockout_tier = 1;
        sharedStorage.pin_lockout_until = 0;
        sharedStorage.pin_failed_attempts = 0;

        const svc = await loadModule();
        for (let i = 0; i < 5; i++) {
            await svc.unlockWithPin('000000');
        }

        const lockDuration = sharedStorage.pin_lockout_until - Date.now();
        // Should be approximately 15 minutes
        expect(lockDuration).toBeGreaterThan(14 * 60 * 1000);
        expect(lockDuration).toBeLessThanOrEqual(15 * 60 * 1000 + 1000);
        // Tier incremented to 2 (next tier) after using tier 1
        expect(sharedStorage.pin_lockout_tier).toBe(2);
    });

    it('tier 2: next 5 failures after tier 1 unlock → lock 30 minutes', async () => {
        sharedStorage.pin_lockout_tier = 2;
        sharedStorage.pin_lockout_until = 0;
        sharedStorage.pin_failed_attempts = 0;

        const svc = await loadModule();
        for (let i = 0; i < 5; i++) {
            await svc.unlockWithPin('000000');
        }

        const lockDuration = sharedStorage.pin_lockout_until - Date.now();
        // Should be approximately 30 minutes
        expect(lockDuration).toBeGreaterThan(29 * 60 * 1000);
        expect(lockDuration).toBeLessThanOrEqual(30 * 60 * 1000 + 1000);
        // Tier stays at 2 (max)
        expect(sharedStorage.pin_lockout_tier).toBe(2);
    });
});

// =============================================
// 4. Correct PIN resets lockout state
// =============================================
describe('P1-02: Correct PIN Resets Lockout', () => {
    let sharedStorage;
    let chromeStub;

    beforeEach(() => {
        sharedStorage = {
            geminiApiKey_encrypted: 'encrypted-blob',
            pin_salt: 'test-salt-base64',
            pin_failed_attempts: 3,
            pin_lockout_tier: 1,
            pin_lockout_until: 0, // not locked, just has history
        };
        chromeStub = createChromeStub(sharedStorage);
        setupGlobals(chromeStub);
    });

    afterEach(() => {
        delete globalThis.chrome;
        delete globalThis.HIS;
        vi.restoreAllMocks();
    });

    it('resets all lockout state on correct PIN', async () => {
        chromeStub.runtime.sendMessage.mockImplementation((_msg, cb) => {
            cb({ ok: true });
        });

        const svc = await loadModule();
        const result = await svc.unlockWithPin('123456');

        expect(result).toBe('__UNLOCKED__');
        expect(sharedStorage.pin_failed_attempts).toBe(0);
        expect(sharedStorage.pin_lockout_until).toBe(0);
        expect(sharedStorage.pin_lockout_tier).toBe(0);
    });
});

// =============================================
// 5. HIS logout does NOT reset lockout
// =============================================
describe('P1-02: HIS Logout vs Lockout', () => {
    let sharedStorage;
    let chromeStub;

    beforeEach(() => {
        sharedStorage = {
            geminiApiKey_encrypted: 'encrypted-blob',
            pin_salt: 'test-salt-base64',
            pin_failed_attempts: 4,
            pin_lockout_until: Date.now() + 300000,
            pin_lockout_tier: 1,
        };
        chromeStub = createChromeStub(sharedStorage);
        setupGlobals(chromeStub);
    });

    afterEach(() => {
        delete globalThis.chrome;
        delete globalThis.HIS;
        vi.restoreAllMocks();
    });

    it('clearCache does NOT reset lockout state', async () => {
        const svc = await loadModule();

        svc.clearCache();

        // Lockout state must survive logout
        expect(sharedStorage.pin_failed_attempts).toBe(4);
        expect(sharedStorage.pin_lockout_until).toBeGreaterThan(Date.now());
        expect(sharedStorage.pin_lockout_tier).toBe(1);
    });
});
