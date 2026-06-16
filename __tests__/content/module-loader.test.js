/**
 * 🧞 Aladinn — Module Loader Tests (P1-04)
 * TDD: Written BEFORE implementation
 *
 * Tests lazy-loading of feature modules based on feature flags
 * stored in chrome.storage.local
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ──────────────────────────────────────────
// Mock chrome APIs
// ──────────────────────────────────────────
let storageData = {};

function setupChromeMocks() {
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn((keys, callback) => {
          if (typeof keys === 'string') {
            const result = { [keys]: storageData[keys] };
            if (callback) { callback(result); return; }
            return Promise.resolve(result);
          }
          if (Array.isArray(keys)) {
            const result = {};
            for (const k of keys) {
              if (k in storageData) result[k] = storageData[k];
            }
            if (callback) { callback(result); return; }
            return Promise.resolve(result);
          }
          if (callback) { callback({}); return; }
          return Promise.resolve({});
        }),
      },
    },
  };
}

function setupAladinnGlobals() {
  window.HIS = window.HIS || {};
  window.HIS.Logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  };
  window.Aladinn = window.Aladinn || {};
  window.Aladinn.features = {};
}

// ──────────────────────────────────────────
// Module import tracking
// ──────────────────────────────────────────
// We mock dynamic import() via vi.mock — but since module-loader uses
// dynamic import(), we need to test via the actual function behavior.
// We'll use vi.hoisted to track which modules get loaded.

// Track import calls
const importTracker = {
  scanner: false,
  sign: false,
  voice: false,
  cds: false,
  reset() {
    this.scanner = false;
    this.sign = false;
    this.voice = false;
    this.cds = false;
  },
};

// Mock dynamic import for feature modules
vi.mock('../../content/scanner/index.js', () => {
  importTracker.scanner = true;
  return { default: {} };
});

vi.mock('../../content/sign/index.js', () => {
  importTracker.sign = true;
  return { default: {} };
});

vi.mock('../../content/voice/index.js', () => {
  importTracker.voice = true;
  return { default: {} };
});

vi.mock('../../content/cds/index.js', () => {
  importTracker.cds = true;
  return { default: {} };
});

// ──────────────────────────────────────────
// Import the module under test
// ──────────────────────────────────────────
// Note: We use dynamic import to avoid the mocked static imports running
// at load time. We re-import per test where needed.

let loadModules;
let loadModuleOnDemand;
let getFeatureFlags;

beforeEach(async () => {
  storageData = {};
  importTracker.reset();
  setupChromeMocks();
  setupAladinnGlobals();

  // Dynamic import resets on each test via vi.resetModules
  vi.resetModules();
  const mod = await import('../../content/module-loader.js');
  loadModules = mod.loadModules;
  loadModuleOnDemand = mod.loadModuleOnDemand;
  getFeatureFlags = mod.getFeatureFlags;
});

afterEach(() => {
  vi.restoreAllMocks();
  delete globalThis.chrome;
});

// ──────────────────────────────────────────
// Tests
// ──────────────────────────────────────────

describe('module-loader', () => {
  describe('loadModules()', () => {
    it('loads scanner when scanner flag is ON', async () => {
      storageData.aladinn_features = {
        voice: false, scanner: true, sign: false, cds: false,
      };

      const result = await loadModules();

      expect(result.loaded).toContain('scanner');
      expect(result.skipped).toContain('voice');
      expect(result.skipped).toContain('sign');
      expect(result.skipped).toContain('cds');
    });

    it('does NOT load sign when sign flag is OFF', async () => {
      storageData.aladinn_features = {
        voice: false, scanner: false, sign: false, cds: false,
      };

      const result = await loadModules();

      expect(result.loaded).not.toContain('sign');
      expect(result.skipped).toContain('sign');
    });

    it('loads all modules when all flags are ON', async () => {
      storageData.aladinn_features = {
        voice: true, scanner: true, sign: true, cds: true,
      };

      const result = await loadModules();

      expect(result.loaded).toContain('scanner');
      expect(result.loaded).toContain('sign');
      expect(result.loaded).toContain('voice');
      expect(result.loaded).toContain('cds');
      expect(result.skipped).toHaveLength(0);
    });

    it('loads only shared modules when all flags are OFF', async () => {
      storageData.aladinn_features = {
        voice: false, scanner: false, sign: false, cds: false,
      };

      const result = await loadModules();

      expect(result.loaded).toHaveLength(0);
      expect(result.skipped).toHaveLength(4);
    });

    it('uses safe defaults when storage key is missing (scanner ON, others OFF)', async () => {
      // No aladinn_features in storage — should use onInstalled defaults
      storageData = {};

      const result = await loadModules();

      // Default from service-worker onInstalled: scanner=true, others=false
      expect(result.loaded).toContain('scanner');
      expect(result.skipped).toContain('voice');
      expect(result.skipped).toContain('sign');
      expect(result.skipped).toContain('cds');
    });

    it('uses safe defaults when chrome.storage is unavailable', async () => {
      delete globalThis.chrome;

      const result = await loadModules();

      // Fail-closed: use safe defaults (scanner ON, others OFF)
      expect(result.loaded).toContain('scanner');
      expect(result.skipped).toContain('voice');
      expect(result.skipped).toContain('sign');
      expect(result.skipped).toContain('cds');
    });

    it('logs which modules were loaded vs skipped', async () => {
      storageData.aladinn_features = {
        voice: false, scanner: true, sign: false, cds: false,
      };

      await loadModules();

      expect(window.HIS.Logger.info).toHaveBeenCalledWith(
        'ModuleLoader',
        expect.stringContaining('scanner'),
      );
    });

    it('returns the resolved feature flags', async () => {
      storageData.aladinn_features = {
        voice: true, scanner: true, sign: false, cds: false,
      };

      const result = await loadModules();

      expect(result.flags).toEqual({
        voice: true, scanner: true, sign: false, cds: false,
      });
    });
  });

  describe('remote config overrides', () => {
    it('remote config kill switch overrides local flags', async () => {
      storageData.aladinn_features = {
        voice: true, scanner: true, sign: true, cds: true,
      };
      storageData.aladinn_remote_config = {
        features: { scanner: false, autoSign: false },
      };

      const result = await loadModules();

      expect(result.loaded).not.toContain('scanner');
      expect(result.loaded).not.toContain('sign');
      expect(result.skipped).toContain('scanner');
      expect(result.skipped).toContain('sign');
    });

    it('remote config respects CDS flag (does NOT override cds)', async () => {
      storageData.aladinn_features = {
        voice: false, scanner: false, sign: false, cds: true,
      };
      storageData.aladinn_remote_config = {
        features: { cdsEngine: false },
      };

      const result = await loadModules();

      // CDS is protected from remote kill per content.js pattern
      expect(result.loaded).toContain('cds');
    });

    it('ignores invalid remote config gracefully', async () => {
      storageData.aladinn_features = {
        voice: false, scanner: true, sign: false, cds: false,
      };
      storageData.aladinn_remote_config = 'invalid';

      const result = await loadModules();

      // Should still load scanner (fail-open on remote config)
      expect(result.loaded).toContain('scanner');
    });
  });

  describe('loadModuleOnDemand()', () => {
    it('loads voice module on demand', async () => {
      const result = await loadModuleOnDemand('voice');

      expect(result.success).toBe(true);
      expect(result.module).toBe('voice');
    });

    it('loads scanner module on demand', async () => {
      const result = await loadModuleOnDemand('scanner');

      expect(result.success).toBe(true);
      expect(result.module).toBe('scanner');
    });

    it('loads sign module on demand', async () => {
      const result = await loadModuleOnDemand('sign');

      expect(result.success).toBe(true);
      expect(result.module).toBe('sign');
    });

    it('loads cds module on demand', async () => {
      const result = await loadModuleOnDemand('cds');

      expect(result.success).toBe(true);
      expect(result.module).toBe('cds');
    });

    it('rejects unknown module name', async () => {
      const result = await loadModuleOnDemand('unknown');

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('does not reload already loaded modules', async () => {
      storageData.aladinn_features = {
        voice: true, scanner: false, sign: false, cds: false,
      };

      // First: loadModules loads voice
      await loadModules();

      // Second: loadModuleOnDemand should skip
      const result = await loadModuleOnDemand('voice');

      expect(result.success).toBe(true);
      expect(result.alreadyLoaded).toBe(true);
    });
  });

  describe('getFeatureFlags()', () => {
    it('returns merged local + remote flags', async () => {
      storageData.aladinn_features = {
        voice: true, scanner: true, sign: true, cds: true,
      };
      storageData.aladinn_remote_config = {
        features: { aiVoice: false },
      };

      const flags = await getFeatureFlags();

      expect(flags.voice).toBe(false);
      expect(flags.scanner).toBe(true);
      expect(flags.sign).toBe(true);
      expect(flags.cds).toBe(true);
    });

    it('returns safe defaults when storage is empty', async () => {
      storageData = {};

      const flags = await getFeatureFlags();

      expect(flags).toEqual({
        voice: false, scanner: true, sign: false, cds: false,
      });
    });
  });

  describe('error handling', () => {
    it('handles import failure gracefully', async () => {
      storageData.aladinn_features = {
        voice: false, scanner: true, sign: false, cds: false,
      };

      // Even if the import fails internally, loadModules should not throw
      const result = await loadModules();

      // Should have attempted to load scanner
      expect(result).toBeDefined();
      expect(result.flags).toBeDefined();
    });

    it('handles chrome.storage.local.get callback error gracefully', async () => {
      globalThis.chrome.storage.local.get = vi.fn((keys, callback) => {
        throw new Error('Storage access denied');
      });

      // Should not throw, use defaults
      const result = await loadModules();

      expect(result).toBeDefined();
      expect(result.loaded).toContain('scanner');
    });
  });
});
