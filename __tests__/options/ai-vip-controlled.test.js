/**
 * 🧞 Aladinn — Controlled AI VIP Easter Egg Tests
 * TDD: Written BEFORE implementation (RED → GREEN → IMPROVE)
 *
 * P0-04: Convert AI VIP easter egg from uncontrolled hidden feature
 * to "controlled easter egg" with policy gates, PIN requirement,
 * PHI pipeline, and audit logging.
 *
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ========================================
// Mock Setup
// ========================================
const storageData = {};
const sentMessages = [];

function setupChromeMocks() {
    sentMessages.length = 0;
    globalThis.chrome = {
        storage: {
            local: {
                get: vi.fn((keys, cb) => {
                    if (typeof cb === 'function') {
                        const result = {};
                        const keyList = Array.isArray(keys) ? keys : (typeof keys === 'string' ? [keys] : Object.keys(keys || {}));
                        keyList.forEach(k => {
                            if (storageData[k] !== undefined) result[k] = storageData[k];
                        });
                        cb(result);
                        return;
                    }
                    const result = {};
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    keyList.forEach(k => {
                        if (storageData[k] !== undefined) result[k] = storageData[k];
                    });
                    return Promise.resolve(result);
                }),
                set: vi.fn((obj, cb) => {
                    Object.assign(storageData, obj);
                    if (cb) cb();
                }),
                remove: vi.fn((keys, cb) => {
                    const keyList = Array.isArray(keys) ? keys : [keys];
                    keyList.forEach(k => delete storageData[k]);
                    if (cb) cb();
                })
            }
        },
        runtime: {
            getManifest: () => ({ version: '2.5.0' }),
            sendMessage: vi.fn((msg, cb) => {
                sentMessages.push(msg);
                if (cb) cb({ ok: true });
            })
        },
        tabs: {
            query: vi.fn((_, cb) => cb([]))
        }
    };
}

function clearStorage() {
    for (const key of Object.keys(storageData)) {
        delete storageData[key];
    }
}

// ========================================
// AI VIP Policy Helper Tests (unit tests)
// ========================================
describe('P0-04: AI VIP Policy Helpers', () => {
    describe('getAiVipPolicy', () => {
        it('should return default policy when no remote config exists', async () => {
            const { getAiVipPolicy } = await import('../../options/ai-vip-helpers.js');
            const policy = getAiVipPolicy(null);

            expect(policy.requirePinUnlocked).toBe(true);
            expect(policy.requirePhiPipeline).toBe(true);
            expect(policy.allowRawTreatmentText).toBe(false);
            expect(policy.maxInputChars).toBe(12000);
            expect(policy.auditReveal).toBe(true);
        });

        it('should merge remote config policy over defaults', async () => {
            const { getAiVipPolicy } = await import('../../options/ai-vip-helpers.js');
            const remoteConfig = {
                aiVipPolicy: {
                    maxInputChars: 8000,
                    requirePinUnlocked: false
                }
            };
            const policy = getAiVipPolicy(remoteConfig);

            expect(policy.maxInputChars).toBe(8000);
            expect(policy.requirePinUnlocked).toBe(false);
            expect(policy.requirePhiPipeline).toBe(true);
        });
    });

    describe('checkAiVipGates', () => {
        it('should return allowed=true when all gates pass', async () => {
            const { checkAiVipGates } = await import('../../options/ai-vip-helpers.js');
            const result = checkAiVipGates({
                features: { aiVipAllowed: true },
                hasPinHash: true,
                hasEncryptedKey: true,
                policy: { requirePinUnlocked: true }
            });

            expect(result.allowed).toBe(true);
            expect(result.reason).toBeNull();
        });

        it('should block when aiVipAllowed feature is false', async () => {
            const { checkAiVipGates } = await import('../../options/ai-vip-helpers.js');
            const result = checkAiVipGates({
                features: { aiVipAllowed: false },
                hasPinHash: true,
                hasEncryptedKey: true,
                policy: { requirePinUnlocked: true }
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('blocked_by_policy');
        });

        it('should block when aiVipAllowed is undefined', async () => {
            const { checkAiVipGates } = await import('../../options/ai-vip-helpers.js');
            const result = checkAiVipGates({
                features: {},
                hasPinHash: true,
                hasEncryptedKey: true,
                policy: { requirePinUnlocked: true }
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('blocked_by_policy');
        });

        it('should require PIN when policy.requirePinUnlocked is true and no PIN hash', async () => {
            const { checkAiVipGates } = await import('../../options/ai-vip-helpers.js');
            const result = checkAiVipGates({
                features: { aiVipAllowed: true },
                hasPinHash: false,
                hasEncryptedKey: false,
                policy: { requirePinUnlocked: true }
            });

            expect(result.allowed).toBe(false);
            expect(result.reason).toBe('pin_required');
        });

        it('should allow when PIN not required by policy', async () => {
            const { checkAiVipGates } = await import('../../options/ai-vip-helpers.js');
            const result = checkAiVipGates({
                features: { aiVipAllowed: true },
                hasPinHash: false,
                hasEncryptedKey: false,
                policy: { requirePinUnlocked: false }
            });

            expect(result.allowed).toBe(true);
        });
    });
});

// ========================================
// Remote Config DEFAULT_CONFIG tests
// ========================================
describe('P0-04: Remote Config AI VIP defaults', () => {
    beforeEach(() => {
        setupChromeMocks();
        vi.resetModules();
    });

    afterEach(() => {
        clearStorage();
        vi.restoreAllMocks();
    });

    it('should have aiVipAllowed=false in DEFAULT_CONFIG.features', async () => {
        const { DEFAULT_CONFIG } = await import('../../background/remote-config.js');
        expect(DEFAULT_CONFIG.features.aiVipAllowed).toBe(false);
    });

    it('should have aiVipPolicy defaults in DEFAULT_CONFIG', async () => {
        const { DEFAULT_CONFIG } = await import('../../background/remote-config.js');
        expect(DEFAULT_CONFIG.aiVipPolicy).toBeDefined();
        expect(DEFAULT_CONFIG.aiVipPolicy.requirePinUnlocked).toBe(true);
        expect(DEFAULT_CONFIG.aiVipPolicy.requirePhiPipeline).toBe(true);
        expect(DEFAULT_CONFIG.aiVipPolicy.maxInputChars).toBe(12000);
    });
});

// ========================================
// AI Client — AI VIP PHI Pipeline Integration
// ========================================
describe('P0-04: AI Client VIP PHI pipeline', () => {
    beforeEach(() => {
        setupChromeMocks();
        vi.resetModules();
    });

    afterEach(() => {
        clearStorage();
        vi.restoreAllMocks();
    });

    it('summarizeHistoryAI should exist as exported function', async () => {
        const { summarizeHistoryAI } = await import('../../background/ai-client.js');
        expect(typeof summarizeHistoryAI).toBe('function');
    });
});

// ========================================
// Options Page — AI VIP Easter Egg (DOM Tests)
// ========================================
describe('P0-04: Options Page AI VIP Easter Egg (DOM)', () => {
    let initAiVipEasterEgg;

    beforeEach(async () => {
        setupChromeMocks();
        vi.resetModules();

        // Create minimal DOM structure
        document.body.innerHTML = `
            <div id="aladinn-version-tag">Version 2.5.0</div>
            <div id="ai-features-container"></div>
            <div id="status-toast"></div>
        `;

        // Import the initializer
        const mod = await import('../../options/ai-vip-easter-egg.js');
        initAiVipEasterEgg = mod.initAiVipEasterEgg;
    });

    afterEach(() => {
        clearStorage();
        vi.restoreAllMocks();
        document.body.innerHTML = '';
    });

    function clickNTimes(el, n) {
        for (let i = 0; i < n; i++) {
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 100, clientY: 100 }));
        }
    }

    // ------------------------------------------
    // 1. Easter egg reveal still works (5 clicks)
    // ------------------------------------------
    describe('easter egg reveal mechanism', () => {
        it('should create container and reveal after 5 clicks', () => {
            // Config allows
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };
            storageData.pin_hash = 'hash';
            storageData.pin_salt = 'salt';
            storageData.geminiApiKey_encrypted = 'iv:cipher';

            initAiVipEasterEgg({
                hasPinHash: true,
                hasEncryptedKey: true
            });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            const container = document.getElementById('ai-vip-container');
            expect(container).not.toBeNull();
            expect(container.style.display).not.toBe('none');
        });

        it('should NOT reveal with fewer than 5 clicks', () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 4);

            const container = document.getElementById('ai-vip-container');
            // Container either doesn't exist or is hidden
            if (container) {
                expect(container.style.display).toBe('none');
            }
        });

        it('should save aladinn_ai_vip_revealed = true on reveal', () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };
            storageData.pin_hash = 'hash';
            storageData.pin_salt = 'salt';
            storageData.geminiApiKey_encrypted = 'iv:cipher';

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            expect(storageData.aladinn_ai_vip_revealed).toBe(true);
        });
    });

    // ------------------------------------------
    // 2. Remote config gating
    // ------------------------------------------
    describe('remote config policy gate', () => {
        it('should show "khóa bởi Safe Mode" when aiVip is false', () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: false }
            };

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            const container = document.getElementById('ai-vip-container');
            expect(container).not.toBeNull();
            expect(container.textContent).toContain('khóa bởi Safe Mode');
        });

        it('should log ai_vip_blocked_by_policy audit event when blocked', async () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: false }
            };

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            await new Promise(r => setTimeout(r, 0)); // wait for async logAuditEvent
            
            const blockedAudit = storageData.aladinn_audit_log?.find(
                m => m.event_name === 'ai_vip_blocked_by_policy'
            );
            expect(blockedAudit).toBeDefined();
        });


    });

    // ------------------------------------------
    // 3. PIN unlock requirement
    // ------------------------------------------
    describe('PIN unlock gate', () => {
        it('should show PIN unlock prompt when no PIN hash', () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };

            initAiVipEasterEgg({ hasPinHash: false, hasEncryptedKey: false });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            const container = document.getElementById('ai-vip-container');
            expect(container).not.toBeNull();
            const hasPinMessage = container.textContent.includes('PIN') ||
                container.textContent.includes('mã PIN');
            expect(hasPinMessage).toBe(true);
        });
    });

    // ------------------------------------------
    // 4. Audit event logging
    // ------------------------------------------
    describe('audit event logging', () => {
        it('should log ai_vip_revealed on reveal', async () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };
            storageData.pin_hash = 'hash';
            storageData.pin_salt = 'salt';
            storageData.geminiApiKey_encrypted = 'iv:cipher';

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            await new Promise(r => setTimeout(r, 0)); // wait for async logAuditEvent

            const revealAudit = storageData.aladinn_audit_log?.find(
                m => m.event_name === 'ai_vip_revealed'
            );
            expect(revealAudit).toBeDefined();
        });

        it('should log ai_vip_enabled when toggle turned ON', async () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            const toggle = document.getElementById('opt-scan-aivip');
            expect(toggle).not.toBeNull();
            toggle.checked = true;
            toggle.dispatchEvent(new Event('change'));

            await new Promise(r => setTimeout(r, 0)); // wait for async logAuditEvent

            const enableAudit = storageData.aladinn_audit_log?.find(
                m => m.event_name === 'ai_vip_enabled'
            );
            expect(enableAudit).toBeDefined();
        });

        it('should log ai_vip_disabled when toggle turned OFF', async () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            const toggle = document.getElementById('opt-scan-aivip');
            expect(toggle).not.toBeNull();
            toggle.checked = false;
            toggle.dispatchEvent(new Event('change'));

            await new Promise(r => setTimeout(r, 0)); // wait for async logAuditEvent

            const disableAudit = storageData.aladinn_audit_log?.find(
                m => m.event_name === 'ai_vip_disabled'
            );
            expect(disableAudit).toBeDefined();
        });
    });

    // ------------------------------------------
    // 5. Label text change
    // ------------------------------------------
    describe('label text', () => {
        it('should display "thử nghiệm nội bộ" instead of "Tính năng ẩn"', () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            const container = document.getElementById('ai-vip-container');
            expect(container.textContent).toContain('thử nghiệm nội bộ');
            expect(container.textContent).not.toContain('Tính năng ẩn');
        });
    });

    // ------------------------------------------
    // 6. "Ẩn lại AI VIP" button
    // ------------------------------------------
    describe('"Ẩn lại AI VIP" button', () => {
        it('should have a "Ẩn lại" button in the container', () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            const hideBtn = document.getElementById('btn-hide-ai-vip');
            expect(hideBtn).not.toBeNull();
        });

        it('should hide container and set revealed=false when "Ẩn lại" clicked', () => {
            storageData.aladinn_remote_config = {
                features: { aiVipAllowed: true }
            };

            initAiVipEasterEgg({ hasPinHash: true, hasEncryptedKey: true });

            const versionTag = document.getElementById('aladinn-version-tag');
            clickNTimes(versionTag, 5);

            const hideBtn = document.getElementById('btn-hide-ai-vip');
            expect(hideBtn).not.toBeNull();
            hideBtn.click();

            const container = document.getElementById('ai-vip-container');
            expect(container.style.display).toBe('none');
            expect(storageData.aladinn_ai_vip_revealed).toBe(false);
        });
    });
});
