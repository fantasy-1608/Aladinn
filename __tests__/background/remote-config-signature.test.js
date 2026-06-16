/**
 * 🧞 Aladinn — Remote Config Signature Verification Tests
 * TDD: Written BEFORE implementation
 *
 * Tests Ed25519 signature verification for remote-config.json
 * Ensures fail-closed behavior for autoSign/autoClick when config is unverified
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========================================
// Test Keypair (Ed25519) — generated for dev/testing only
// NEVER use these keys in production
// ========================================
const TEST_PUBLIC_KEY_SPKI_BASE64 = 'MCowBQYDK2VwAyEAxxVmMCt1LyOIiHU+2KyEEcm1SGtlNvNVzZ7d/oIOwDc=';
const TEST_PRIVATE_KEY_PKCS8_BASE64 = 'MC4CAQAwBQYDK2VwBCIEIK5Go7rQ0sbT9KSsnu4we/b51Nxf2eFUG9OEhWOH+b6I';

// ========================================
// Helpers: sign with Node crypto for tests
// ========================================
async function signWithNodeCrypto(text) {
    const crypto = await import('crypto');
    const privateKeyDer = Buffer.from(TEST_PRIVATE_KEY_PKCS8_BASE64, 'base64');
    const privateKey = crypto.createPrivateKey({
        key: privateKeyDer, format: 'der', type: 'pkcs8'
    });
    const signature = crypto.sign(null, Buffer.from(text), privateKey);
    return signature.toString('base64');
}

// ========================================
// Mock chrome APIs
// ========================================
const storageData = {};

function setupChromeMocks() {
    globalThis.chrome = {
        storage: {
            local: {
                get: vi.fn(async (key) => {
                    const k = typeof key === 'string' ? key : key[0] || Object.keys(key)[0];
                    return { [k]: storageData[k] || undefined };
                }),
                set: vi.fn(async (obj) => {
                    Object.assign(storageData, obj);
                }),
                remove: vi.fn(async () => {})
            }
        },
        alarms: {
            create: vi.fn()
        },
        runtime: {
            getManifest: () => ({ version: '2.2.0' })
        }
    };
}

function clearStorage() {
    for (const key of Object.keys(storageData)) {
        delete storageData[key];
    }
}

// ========================================
// TESTS
// ========================================

describe('crypto-verify module', () => {
    beforeEach(() => {
        setupChromeMocks();
    });

    afterEach(() => {
        clearStorage();
        vi.restoreAllMocks();
    });

    it('should export verifyConfigSignature function', async () => {
        const { verifyConfigSignature } = await import('../../shared/crypto-verify.js');
        expect(typeof verifyConfigSignature).toBe('function');
    });

    it('should accept a valid Ed25519 signature', async () => {
        const { verifyConfigSignature } = await import('../../shared/crypto-verify.js');
        const configText = '{"version":3,"features":{"autoSign":true}}';
        const signature = await signWithNodeCrypto(configText);

        const result = await verifyConfigSignature(configText, signature);
        expect(result).toBe(true);
    });

    it('should reject an invalid signature', async () => {
        const { verifyConfigSignature } = await import('../../shared/crypto-verify.js');
        const configText = '{"version":3,"features":{"autoSign":true}}';
        // Tampered signature (random base64)
        const fakeSignature = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

        const result = await verifyConfigSignature(configText, fakeSignature);
        expect(result).toBe(false);
    });

    it('should reject when config text is tampered', async () => {
        const { verifyConfigSignature } = await import('../../shared/crypto-verify.js');
        const originalText = '{"version":3,"features":{"autoSign":true}}';
        const signature = await signWithNodeCrypto(originalText);
        // Tamper the config
        const tamperedText = '{"version":3,"features":{"autoSign":false}}';

        const result = await verifyConfigSignature(tamperedText, signature);
        expect(result).toBe(false);
    });

    it('should return false for empty inputs', async () => {
        const { verifyConfigSignature } = await import('../../shared/crypto-verify.js');
        expect(await verifyConfigSignature('', 'abc')).toBe(false);
        expect(await verifyConfigSignature('text', '')).toBe(false);
        expect(await verifyConfigSignature(null, 'abc')).toBe(false);
        expect(await verifyConfigSignature('text', null)).toBe(false);
    });

    it('should return false for malformed base64 signature', async () => {
        const { verifyConfigSignature } = await import('../../shared/crypto-verify.js');
        const result = await verifyConfigSignature('{"version":1}', '!!!not-base64!!!');
        expect(result).toBe(false);
    });
});

describe('remote-config with signature verification', () => {
    let remoteConfig;

    beforeEach(async () => {
        setupChromeMocks();
        vi.resetModules();
    });

    afterEach(() => {
        clearStorage();
        vi.restoreAllMocks();
    });

    async function loadModule() {
        // Dynamic import to get fresh module per test
        remoteConfig = await import('../../background/remote-config.js');
        return remoteConfig;
    }

    // ------------------------------------------
    // Valid signature → config accepted
    // ------------------------------------------
    describe('valid signature', () => {
        it('should accept config when signature is valid', async () => {
            const validConfig = JSON.stringify({
                version: 5,
                features: {
                    autoSign: true,
                    autoClick: true,
                    signSearch: true,
                    cdsEngine: true,
                    aiVoice: true,
                    scanner: true,
                    enableSmartPath: true
                },
                mode: 'hospital_safe_mode',
                emergencyMessage: ''
            });
            const validSig = await signWithNodeCrypto(validConfig);

            globalThis.fetch = vi.fn((url) => {
                if (url.includes('.sig')) {
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve(validSig)
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(JSON.parse(validConfig)),
                    text: () => Promise.resolve(validConfig)
                });
            });

            const { refreshRemoteConfig } = await loadModule();
            const result = await refreshRemoteConfig();

            expect(result.features.autoSign).toBe(true);
            expect(result.features.autoClick).toBe(true);
            expect(result._source).toBe('github');
        });
    });

    // ------------------------------------------
    // Invalid signature → config rejected, cache used
    // ------------------------------------------
    describe('invalid signature', () => {
        it('should reject config and use cache when signature is invalid', async () => {
            // Pre-populate cache with a safe config
            const cachedConfig = {
                version: 4,
                features: {
                    autoSign: false, autoClick: false, signSearch: true,
                    cdsEngine: true, aiVoice: true, scanner: true, enableSmartPath: true
                },
                mode: 'safe_mode',
                _fetchedAt: Date.now() - 1000,
                _source: 'github'
            };
            storageData['aladinn_remote_config'] = cachedConfig;

            globalThis.fetch = vi.fn((url) => {
                if (url.includes('.sig')) {
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve('INVALID_SIGNATURE_BASE64==')
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        version: 5,
                        features: { autoSign: true, autoClick: true },
                        mode: 'normal'
                    }),
                    text: () => Promise.resolve('{"version":5}')
                });
            });

            const { refreshRemoteConfig } = await loadModule();
            const result = await refreshRemoteConfig();

            // Should fall back to cached config, NOT the fetched one
            expect(result.features.autoSign).toBe(false);
            expect(result._source).toBe('github'); // from cache
            expect(result.version).toBe(4); // cached version
        });

        it('should use DEFAULT_CONFIG when signature fails and no cache exists', async () => {
            globalThis.fetch = vi.fn((url) => {
                if (url.includes('.sig')) {
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve('INVALID_SIG==')
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        version: 5,
                        features: { autoSign: true, autoClick: true },
                        mode: 'normal'
                    }),
                    text: () => Promise.resolve('{"version":5}')
                });
            });

            const { refreshRemoteConfig, DEFAULT_CONFIG } = await loadModule();
            const result = await refreshRemoteConfig();

            // Fail-closed: autoSign and autoClick must be false
            expect(result.features.autoSign).toBe(false);
            expect(result.features.autoClick).toBe(false);
            expect(result._source).toBe('default');
        });
    });

    // ------------------------------------------
    // Version downgrade → rejected
    // ------------------------------------------
    describe('version rollback protection', () => {
        it('should reject config with lower version than cached', async () => {
            const oldConfig = JSON.stringify({
                version: 2,
                features: { autoSign: true, signSearch: true },
                mode: 'normal',
                emergencyMessage: ''
            });
            const validSig = await signWithNodeCrypto(oldConfig);

            storageData['aladinn_remote_config'] = {
                version: 5,
                features: {
                    autoSign: false, autoClick: false, signSearch: true,
                    cdsEngine: true, aiVoice: true, scanner: true, enableSmartPath: true
                },
                mode: 'safe_mode',
                _fetchedAt: Date.now(),
                _source: 'github'
            };

            globalThis.fetch = vi.fn((url) => {
                if (url.includes('.sig')) {
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve(validSig)
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(JSON.parse(oldConfig)),
                    text: () => Promise.resolve(oldConfig)
                });
            });

            const { refreshRemoteConfig } = await loadModule();
            const result = await refreshRemoteConfig();

            expect(result.version).toBe(5); // Kept cached version
        });
    });

    // ------------------------------------------
    // Fetch failure → no crash, use default
    // ------------------------------------------
    describe('fetch failure resilience', () => {
        it('should not crash when config fetch fails', async () => {
            globalThis.fetch = vi.fn(() => Promise.reject(new Error('Network error')));

            const { refreshRemoteConfig } = await loadModule();
            const result = await refreshRemoteConfig();

            expect(result).toBeDefined();
            expect(result.features).toBeDefined();
            expect(result._source).toBe('default');
        });

        it('should not crash when sig fetch fails but config succeeds', async () => {
            globalThis.fetch = vi.fn((url) => {
                if (url.includes('.sig')) {
                    return Promise.reject(new Error('Sig network error'));
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({
                        version: 5,
                        features: { autoSign: true },
                        mode: 'normal'
                    }),
                    text: () => Promise.resolve('{"version":5}')
                });
            });

            const { refreshRemoteConfig } = await loadModule();
            const result = await refreshRemoteConfig();

            // Should fail-closed: no valid sig = reject config
            expect(result.features.autoSign).toBe(false);
        });

        it('should not crash when HTTP status is not OK', async () => {
            globalThis.fetch = vi.fn(() => Promise.resolve({
                ok: false,
                status: 500
            }));

            const { refreshRemoteConfig } = await loadModule();
            const result = await refreshRemoteConfig();

            expect(result).toBeDefined();
            expect(result._source).toBe('default');
        });
    });

    // ------------------------------------------
    // autoSign/autoClick fail-closed when unverified
    // ------------------------------------------
    describe('fail-closed for high-risk features', () => {
        it('should have autoSign=false in DEFAULT_CONFIG', async () => {
            const { DEFAULT_CONFIG } = await loadModule();
            expect(DEFAULT_CONFIG.features.autoSign).toBe(false);
        });

        it('should have autoClick=false in DEFAULT_CONFIG', async () => {
            const { DEFAULT_CONFIG } = await loadModule();
            expect(DEFAULT_CONFIG.features.autoClick).toBe(false);
        });

        it('isFeatureEnabled returns false for autoSign when config unverified', async () => {
            // No cached config → DEFAULT_CONFIG used
            const { isFeatureEnabled } = await loadModule();
            const result = await isFeatureEnabled('autoSign');
            expect(result).toBe(false);
        });

        it('isFeatureEnabled returns false for autoClick when config unverified', async () => {
            const { isFeatureEnabled } = await loadModule();
            const result = await isFeatureEnabled('autoClick');
            expect(result).toBe(false);
        });
    });

    // ------------------------------------------
    // Deep schema validation
    // ------------------------------------------
    describe('deep schema validation', () => {
        it('should reject config where features contains non-boolean values', async () => {
            const badConfig = JSON.stringify({
                version: 5,
                features: {
                    autoSign: 'yes',  // should be boolean
                    autoClick: 1,     // should be boolean
                    signSearch: true,
                    cdsEngine: true,
                    aiVoice: true,
                    scanner: true,
                    enableSmartPath: true
                },
                mode: 'normal',
                emergencyMessage: ''
            });
            const validSig = await signWithNodeCrypto(badConfig);

            globalThis.fetch = vi.fn((url) => {
                if (url.includes('.sig')) {
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve(validSig)
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(JSON.parse(badConfig)),
                    text: () => Promise.resolve(badConfig)
                });
            });

            const { refreshRemoteConfig } = await loadModule();
            const result = await refreshRemoteConfig();

            // Non-boolean feature values should be rejected → fail-closed
            expect(result.features.autoSign).toBe(false);
            expect(result.features.autoClick).toBe(false);
        });

        it('should reject config with missing features object', async () => {
            const badConfig = JSON.stringify({
                version: 5,
                mode: 'normal'
                // no features!
            });
            const validSig = await signWithNodeCrypto(badConfig);

            globalThis.fetch = vi.fn((url) => {
                if (url.includes('.sig')) {
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve(validSig)
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(JSON.parse(badConfig)),
                    text: () => Promise.resolve(badConfig)
                });
            });

            const { refreshRemoteConfig } = await loadModule();
            const result = await refreshRemoteConfig();

            expect(result._source).not.toBe('github');
        });
    });

    // ------------------------------------------
    // Parallel fetch of config + signature
    // ------------------------------------------
    describe('parallel fetch behavior', () => {
        it('should fetch config and signature in parallel', async () => {
            const fetchCalls = [];
            const configData = {
                version: 5,
                features: { autoSign: true, signSearch: true },
                mode: 'normal',
                emergencyMessage: ''
            };
            const configText = JSON.stringify(configData);
            const validSig = await signWithNodeCrypto(configText);

            globalThis.fetch = vi.fn((url) => {
                fetchCalls.push(url);
                if (url.includes('.sig')) {
                    return Promise.resolve({
                        ok: true,
                        text: () => Promise.resolve(validSig)
                    });
                }
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve(configData),
                    text: () => Promise.resolve(configText)
                });
            });

            const { refreshRemoteConfig } = await loadModule();
            await refreshRemoteConfig();

            // Both URLs should have been fetched
            expect(fetchCalls.length).toBeGreaterThanOrEqual(2);
            const hasSig = fetchCalls.some(u => u.includes('.sig'));
            const hasConfig = fetchCalls.some(u => u.includes('remote-config.json'));
            expect(hasSig).toBe(true);
            expect(hasConfig).toBe(true);
        });
    });
});
