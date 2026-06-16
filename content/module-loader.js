/**
 * 🧞 Aladinn — Feature Module Loader (P1-04)
 * Lazy-loads feature modules based on feature flags from chrome.storage.local
 *
 * Feature flags in `aladinn_features`:
 *   { voice: bool, scanner: bool, sign: bool, cds: bool }
 *
 * Remote config can override (kill switch) via `aladinn_remote_config.features`
 *
 * SAFETY: Fail-closed defaults match onInstalled values:
 *   scanner=true, voice=false, sign=false, cds=false
 */

const MODULE_TAG = 'ModuleLoader';

/** Safe defaults matching service-worker onInstalled values */
const DEFAULT_FLAGS = Object.freeze({
  voice: false,
  scanner: true,
  sign: false,
  cds: false,
});

/** Remote config key → local feature flag key */
const REMOTE_KEY_MAP = Object.freeze({
  autoSign: 'sign',
  cdsEngine: 'cds',
  aiVoice: 'voice',
  scanner: 'scanner',
});

/** Module path map for dynamic import */
const MODULE_PATHS = Object.freeze({
  scanner: './scanner/index.js',
  sign: './sign/index.js',
  voice: './voice/index.js',
  cds: './cds/index.js',
});

/** Track which modules have been loaded to avoid double-loading */
const _loadedModules = new Set();

/**
 * Read feature flags from chrome.storage.local with safe defaults.
 * @returns {Promise<Object>} Feature flags
 */
function _readLocalFlags() {
  return new Promise((resolve) => {
    try {
      if (!globalThis.chrome?.storage?.local) {
        resolve({ ...DEFAULT_FLAGS });
        return;
      }
      chrome.storage.local.get('aladinn_features', (result) => {
        const flags = { ...DEFAULT_FLAGS, ...result?.aladinn_features };
        resolve(flags);
      });
    } catch (_err) {
      resolve({ ...DEFAULT_FLAGS });
    }
  });
}

/**
 * Apply remote config kill switches (fail-open on errors).
 * CDS is protected — remote config cannot kill CDS.
 * @param {Object} flags - Local feature flags
 * @returns {Promise<Object>} Merged flags
 */
function _applyRemoteOverrides(flags) {
  return new Promise((resolve) => {
    try {
      if (!globalThis.chrome?.storage?.local) {
        resolve({ ...flags });
        return;
      }
      chrome.storage.local.get('aladinn_remote_config', (result) => {
        const rc = result?.aladinn_remote_config;
        if (!rc || typeof rc.features !== 'object') {
          resolve({ ...flags });
          return;
        }
        const merged = { ...flags };
        for (const [remoteKey, localKey] of Object.entries(REMOTE_KEY_MAP)) {
          // CDS protected from remote kill switch (clinician controls CDS)
          if (localKey === 'cds') continue;
          if (rc.features[remoteKey] === false) {
            merged[localKey] = false;
          }
        }
        resolve(merged);
      });
    } catch (_err) {
      // Fail-open: keep local flags on remote config error
      resolve({ ...flags });
    }
  });
}

/**
 * Read and merge local + remote feature flags.
 * @returns {Promise<Object>} Resolved feature flags
 */
export async function getFeatureFlags() {
  const localFlags = await _readLocalFlags();
  return _applyRemoteOverrides(localFlags);
}

/**
 * Dynamically import a single feature module by name.
 * @param {string} name - Module name (scanner|sign|voice|cds)
 * @returns {Promise<Object>} Module reference
 */
async function _importModule(name) {
  const path = MODULE_PATHS[name];
  if (!path) throw new Error(`Unknown module: ${name}`);
  return import(/* @vite-ignore */ path);
}

/**
 * Load all enabled feature modules based on feature flags.
 * @returns {Promise<{loaded: string[], skipped: string[], flags: Object}>}
 */
export async function loadModules() {
  const Logger = globalThis.HIS?.Logger;
  const flags = await getFeatureFlags();
  const loaded = [];
  const skipped = [];
  const errors = [];

  for (const [name] of Object.entries(MODULE_PATHS)) {
    if (!flags[name]) {
      skipped.push(name);
      continue;
    }
    try {
      await _importModule(name);
      _loadedModules.add(name);
      loaded.push(name);
    } catch (err) {
      errors.push({ module: name, error: err.message });
      skipped.push(name);
      if (Logger) {
        Logger.error(MODULE_TAG, `❌ Failed to load ${name}`, err.message);
      }
    }
  }

  if (Logger) {
    if (loaded.length > 0) {
      Logger.info(MODULE_TAG, `✅ Loaded: [${loaded.join(', ')}]`);
    }
    if (skipped.length > 0) {
      Logger.info(MODULE_TAG, `⏭️ Skipped: [${skipped.join(', ')}]`);
    }
  }

  return Object.freeze({ loaded, skipped, errors, flags });
}

/**
 * Load a single module on demand (e.g., voice when panel opens).
 * @param {string} moduleName - Module name
 * @returns {Promise<{success: boolean, module: string, alreadyLoaded?: boolean, error?: string}>}
 */
export async function loadModuleOnDemand(moduleName) {
  const Logger = globalThis.HIS?.Logger;

  if (!MODULE_PATHS[moduleName]) {
    return { success: false, module: moduleName, error: `Unknown module: ${moduleName}` };
  }

  if (_loadedModules.has(moduleName)) {
    return { success: true, module: moduleName, alreadyLoaded: true };
  }

  try {
    await _importModule(moduleName);
    _loadedModules.add(moduleName);
    if (Logger) {
      Logger.info(MODULE_TAG, `📦 On-demand loaded: ${moduleName}`);
    }
    return { success: true, module: moduleName };
  } catch (err) {
    if (Logger) {
      Logger.error(MODULE_TAG, `❌ On-demand load failed: ${moduleName}`, err.message);
    }
    return { success: false, module: moduleName, error: err.message };
  }
}
