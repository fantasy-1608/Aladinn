/**
 * 🧞 Aladinn — Remote Config (Safe Mode / Kill Switch)
 * Tải cấu hình từ xa từ GitHub raw URL.
 * Cho phép admin tắt nóng tính năng mà không cần bác sĩ cài lại extension.
 *
 * Nguyên tắc an toàn:
 * - FAIL-CLOSED: Nếu chữ ký số không hợp lệ → từ chối config, dùng cache/default.
 * - Non-blocking: Không chặn luồng UI hay khởi tạo extension.
 * - TTL: Cache 30 phút, tự động refresh.
 * - Ed25519 signature verification trước khi chấp nhận config mới.
 */

import { UPDATE_CONFIG } from './updater.js';
import { verifyConfigSignature } from '../shared/crypto-verify.js';
import { logAuditEvent } from '../shared/audit-telemetry.js';

// ========================================
// CONFIG
// ========================================
const REMOTE_CONFIG = {
    // URL raw trên GitHub (main branch)
    get url() {
        return `https://raw.githubusercontent.com/${UPDATE_CONFIG.githubRepo}/main/remote-config.json`;
    },
    // Signature URL = config URL + '.sig'
    get sigUrl() {
        return `${this.url}.sig`;
    },
    // Cache 30 phút (ms)
    cacheTTL: 30 * 60 * 1000,
    // Alarm name cho periodic refresh
    alarmName: 'aladinn-remote-config-refresh',
    // Storage key
    storageKey: 'aladinn_remote_config'
};

// Giá trị mặc định (fail-safe: tắt module rủi ro)
const DEFAULT_CONFIG = {
    version: 0,
    features: {
        autoSign: false,
        autoClick: false,
        signSearch: true,
        cdsEngine: false,
        aiVoice: false,
        scanner: true,
        enableSmartPath: false,
        aiVip: false,
        aiVipEasterEggReveal: false
    },
    aiVipPolicy: {
        requirePinUnlocked: true,
        requirePhiPipeline: true,
        allowRawTreatmentText: false,
        maxInputChars: 12000,
        auditReveal: true
    },
    mode: 'safe_mode',
    emergencyMessage: '',
    _fetchedAt: 0,
    _source: 'default'
};

// ========================================
// VALIDATION
// ========================================

/**
 * Deep-validate feature fields: every value must be boolean.
 * Rejects non-boolean feature values to prevent type-coercion attacks.
 * @param {Object} features - The features object from remote config
 * @returns {boolean} true if all feature values are booleans
 */
function validateFeatureTypes(features) {
    if (!features || typeof features !== 'object') {
        return false;
    }
    for (const value of Object.values(features)) {
        if (typeof value !== 'boolean') {
            return false;
        }
    }
    return true;
}

// ========================================
// FETCH & CACHE
// ========================================

/**
 * Fetch the config JSON and its Ed25519 signature in parallel.
 * Returns { configText, configData, signatureBase64 } or null.
 */
async function fetchConfigAndSignature() {
    const cacheBuster = `?t=${Date.now()}`;

    const [configResponse, sigResponse] = await Promise.all([
        fetch(`${REMOTE_CONFIG.url}${cacheBuster}`, {
            cache: 'no-cache',
            headers: { 'Accept': 'application/json' }
        }),
        fetch(`${REMOTE_CONFIG.sigUrl}${cacheBuster}`, {
            cache: 'no-cache'
        })
    ]);

    if (!configResponse.ok) {
        console.log(`[Aladinn SafeMode] ⚠️ Config fetch failed: HTTP ${configResponse.status}`);
        return null;
    }

    if (!sigResponse.ok) {
        console.log(`[Aladinn SafeMode] ⚠️ Signature fetch failed: HTTP ${sigResponse.status}`);
        return null;
    }

    const configText = await configResponse.text();
    const signatureBase64 = (await sigResponse.text()).trim();
    const configData = JSON.parse(configText);

    return { configText, configData, signatureBase64 };
}

/**
 * Tải remote config từ GitHub với Ed25519 signature verification.
 * Trả về config object đã được validate, hoặc null nếu lỗi.
 */
async function fetchRemoteConfig() {
    try {
        const fetched = await fetchConfigAndSignature();
        if (!fetched) return null;

        const { configText, configData, signatureBase64 } = fetched;

        // SECURITY: Verify Ed25519 signature before trusting config
        const isValid = await verifyConfigSignature(configText, signatureBase64);
        if (!isValid) {
            console.log('[Aladinn SafeMode] 🚫 Signature verification FAILED — rejecting config.');
            await logAuditEvent('remote_config_signature_failed', 'security', {
                success: false,
                errorCode: 'SIGNATURE_INVALID'
            });
            return null;
        }

        // Validate cấu trúc cơ bản
        if (!configData || typeof configData.features !== 'object') {
            console.log('[Aladinn SafeMode] ⚠️ Invalid config format, ignoring.');
            return null;
        }

        // SECURITY: Deep schema validation — all feature values must be boolean
        if (!validateFeatureTypes(configData.features)) {
            console.log('[Aladinn SafeMode] ⚠️ Feature type validation failed, ignoring.');
            await logAuditEvent('remote_config_schema_invalid', 'security', {
                success: false,
                errorCode: 'FEATURE_TYPE_INVALID'
            });
            return null;
        }

        // SECURITY: Version phải tăng dần — không chấp nhận version cũ hơn
        const cached = await getRemoteConfig();
        if (cached._source !== 'default' && typeof configData.version === 'number') {
            if (typeof cached.version === 'number' && configData.version < cached.version) {
                console.log('[Aladinn SafeMode] ⚠️ Remote config version rollback detected, ignoring.');
                return null;
            }
        }

        // Merge với default để đảm bảo không thiếu key (immutable)
        // Merge aiVipPolicy if present in remote config
        const mergedAiVipPolicy = {
            ...DEFAULT_CONFIG.aiVipPolicy,
            ...(configData.aiVipPolicy || {})
        };

        const merged = {
            version: configData.version || 0,
            features: {
                ...DEFAULT_CONFIG.features,
                ...configData.features
            },
            aiVipPolicy: mergedAiVipPolicy,
            mode: configData.mode || DEFAULT_CONFIG.mode,
            emergencyMessage: configData.emergencyMessage || '',
            _fetchedAt: Date.now(),
            _source: 'github'
        };

        console.log('[Aladinn SafeMode] ✅ Remote config loaded (signature verified):', merged.features);
        return merged;
    } catch (err) {
        console.log('[Aladinn SafeMode] ⚠️ Network error:', err.message || err);
        return null;
    }
}

/**
 * Tải config và lưu vào chrome.storage.local.
 * Nếu fetch thất bại → giữ nguyên config cũ trong storage (fail-safe).
 */
async function refreshRemoteConfig() {
    const config = await fetchRemoteConfig();
    if (config) {
        await chrome.storage.local.set({ [REMOTE_CONFIG.storageKey]: config });
        return config;
    }
    // Fetch thất bại → trả về config đang có trong storage (hoặc default)
    return getRemoteConfig();
}

/**
 * Lấy config từ cache (storage). Nếu chưa có → trả default (fail-closed).
 */
async function getRemoteConfig() {
    try {
        const result = await chrome.storage.local.get(REMOTE_CONFIG.storageKey);
        const cached = result[REMOTE_CONFIG.storageKey];
        if (cached && typeof cached.features === 'object') {
            return cached;
        }
    } catch (_err) {
        // storage error → trả default
    }
    return { ...DEFAULT_CONFIG };
}

/**
 * Kiểm tra một feature cụ thể có đang bật hay không.
 * @param {string} featureName - Tên feature (autoSign, cdsEngine, aiVoice, scanner)
 * @returns {Promise<boolean>} true nếu bật
 */
async function isFeatureEnabled(featureName) {
    const config = await getRemoteConfig();
    // SECURITY: Fail-closed cho tính năng cao rủi ro — chỉ bật khi giá trị rõ ràng là true
    const FAIL_CLOSED_FEATURES = ['autoSign', 'autoClick'];
    if (FAIL_CLOSED_FEATURES.includes(featureName)) {
        return config.features[featureName] === true;
    }
    // Fail-open: nếu key không tồn tại → coi như bật
    return config.features[featureName] !== false;
}

// ========================================
// SCHEDULING
// ========================================

/**
 * Lên lịch refresh config định kỳ (mỗi 30 phút).
 * Cũng fetch lần đầu sau 5 giây (non-blocking).
 */
function scheduleRemoteConfigRefresh() {
    // Fetch lần đầu sau 5s (không blocking startup)
    setTimeout(() => refreshRemoteConfig(), 5000);

    // Lên lịch alarm định kỳ
    chrome.alarms.create(REMOTE_CONFIG.alarmName, {
        periodInMinutes: REMOTE_CONFIG.cacheTTL / 60000
    });
}

/**
 * Handler cho alarm event — gọi từ service-worker.js
 */
function handleRemoteConfigAlarm(alarm) {
    if (alarm.name === REMOTE_CONFIG.alarmName) {
        refreshRemoteConfig();
        return true;
    }
    return false;
}

export {
    REMOTE_CONFIG,
    DEFAULT_CONFIG,
    refreshRemoteConfig,
    getRemoteConfig,
    isFeatureEnabled,
    scheduleRemoteConfigRefresh,
    handleRemoteConfigAlarm,
    validateFeatureTypes
};
