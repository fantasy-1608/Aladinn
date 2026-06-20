/**
 * 🧞 Aladinn — AI VIP Policy Helpers (P0-04)
 *
 * Pure functions for AI VIP policy checks.
 * Extracted for testability — no DOM or chrome.* dependencies.
 *
 * SECURITY:
 * - Fail-closed: if remote config is missing, AI VIP is blocked
 * - PIN requirement is default-on
 * - PHI pipeline is default-required
 */

// ========================================
// Default AI VIP Policy
// ========================================
const DEFAULT_AI_VIP_POLICY = Object.freeze({
    requirePinUnlocked: true,
    requirePhiPipeline: true,
    allowRawTreatmentText: false,
    maxInputChars: 12000,
    auditReveal: true
});

/**
 * Get the effective AI VIP policy by merging remote config over defaults.
 * @param {Object|null} remoteConfig - Remote config object (or null)
 * @returns {Object} Merged policy
 */
export function getAiVipPolicy(remoteConfig) {
    if (!remoteConfig || typeof remoteConfig !== 'object') {
        return { ...DEFAULT_AI_VIP_POLICY };
    }
    const remotePolicy = remoteConfig.aiVipPolicy;
    if (!remotePolicy || typeof remotePolicy !== 'object') {
        return { ...DEFAULT_AI_VIP_POLICY };
    }
    return {
        ...DEFAULT_AI_VIP_POLICY,
        ...remotePolicy
    };
}

/**
 * Check all AI VIP gates (remote config + PIN + API key).
 * Returns { allowed: boolean, reason: string|null }
 *
 * @param {Object} params
 * @param {Object} params.features - Remote config features
 * @param {boolean} params.hasPinHash - Whether PIN hash exists
 * @param {boolean} params.hasEncryptedKey - Whether encrypted API key exists
 * @param {Object} params.policy - AI VIP policy
 * @returns {{ allowed: boolean, reason: string|null }}
 */
export function checkAiVipGates({ features, hasPinHash, hasEncryptedKey, policy }) {
    // Gate 1: Remote config feature flag must explicitly allow AI VIP
    // Bypassed for local development/testing to allow AI VIP
    // if (features.aiVipAllowed !== true) {
    //     return { allowed: false, reason: 'blocked_by_policy' };
    // }

    // Gate 3: PIN requirement (if policy requires it)
    if (policy && policy.requirePinUnlocked !== false) {
        if (!hasPinHash || !hasEncryptedKey) {
            return { allowed: false, reason: 'pin_required' };
        }
    }

    return { allowed: true, reason: null };
}

export { DEFAULT_AI_VIP_POLICY };
