/**
 * 🧞 Aladinn — Remote Config (Safe Mode / Kill Switch)
 * Tải cấu hình từ xa từ GitHub raw URL.
 * Cho phép admin tắt nóng tính năng mà không cần bác sĩ cài lại extension.
 *
 * Nguyên tắc an toàn:
 * - Fail-open: Nếu không tải được config → mọi tính năng vẫn BẬT.
 * - Non-blocking: Không chặn luồng UI hay khởi tạo extension.
 * - TTL: Cache 30 phút, tự động refresh.
 */

import { UPDATE_CONFIG } from './updater.js';

// ========================================
// CONFIG
// ========================================
const REMOTE_CONFIG = {
    // URL raw trên GitHub (main branch)
    get url() {
        return `https://raw.githubusercontent.com/${UPDATE_CONFIG.githubRepo}/main/remote-config.json`;
    },
    // Cache 30 phút (ms)
    cacheTTL: 30 * 60 * 1000,
    // Alarm name cho periodic refresh
    alarmName: 'aladinn-remote-config-refresh',
    // Storage key
    storageKey: 'aladinn_remote_config'
};

// Giá trị mặc định (fail-open: mọi thứ đều BẬT)
const DEFAULT_CONFIG = {
    version: 0,
    features: {
        autoSign: true,
        cdsEngine: true,
        aiVoice: true,
        scanner: true
    },
    mode: 'full_mode',
    emergencyMessage: '',
    _fetchedAt: 0,
    _source: 'default'
};

// ========================================
// FETCH & CACHE
// ========================================

/**
 * Tải remote config từ GitHub.
 * Trả về config object đã được validate, hoặc null nếu lỗi.
 */
async function fetchRemoteConfig() {
    try {
        const response = await fetch(REMOTE_CONFIG.url, {
            cache: 'no-cache',
            headers: { 'Accept': 'application/json' }
        });

        if (!response.ok) {
            console.log(`[Aladinn SafeMode] ⚠️ Fetch failed: HTTP ${response.status}`);
            return null;
        }

        const data = await response.json();

        // Validate cấu trúc cơ bản
        if (!data || typeof data.features !== 'object') {
            console.log('[Aladinn SafeMode] ⚠️ Invalid config format, ignoring.');
            return null;
        }

        // Merge với default để đảm bảo không thiếu key
        const merged = {
            version: data.version || 0,
            features: {
                ...DEFAULT_CONFIG.features,
                ...data.features
            },
            mode: data.mode || DEFAULT_CONFIG.mode,
            emergencyMessage: data.emergencyMessage || '',
            _fetchedAt: Date.now(),
            _source: 'github'
        };

        console.log('[Aladinn SafeMode] ✅ Remote config loaded:', merged.features);
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
 * Lấy config từ cache (storage). Nếu chưa có → trả default (fail-open).
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
 * @returns {Promise<boolean>} true nếu bật (hoặc nếu không tải được config)
 */
async function isFeatureEnabled(featureName) {
    const config = await getRemoteConfig();
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
    handleRemoteConfigAlarm
};
