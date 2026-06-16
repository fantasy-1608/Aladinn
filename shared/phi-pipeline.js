/**
 * PHI Minimization Pipeline — P0-03
 *
 * Centralized pipeline for sanitizing data before sending to AI.
 * Replaces scattered inline PHI handling in ai-client.js call sites.
 *
 * Pipeline stages:
 *   1. Field extraction → keep only whitelisted fields per feature
 *   2. PHI redaction via PHIRedactor.redactFields() on each field value
 *   3. PHI guard via PHIRedactor.containsPHI() on assembled result
 *   4. maxChars truncation
 *   5. Return PHIReport
 *
 * SECURITY:
 * - This module MUST NOT log raw prompts or patient data
 * - Blocked behavior: if report.blocked === true, caller MUST NOT send to AI
 * - Double-gate pattern (redact → containsPHI → block) is preserved
 *
 * @module shared/phi-pipeline
 */

import { PHIRedactor } from '../background/phi-redactor.js';

// =============================================
// Feature-specific field whitelists
// =============================================
const _SUMMARY_WHITELIST = Object.freeze([
    'lyDoVaoVien',
    'quaTrinhBenhLy',
    'tienSuBanThan',
    'tienSuGiaDinh',
    'khamLamSang',
    'khamToanThan',
    'khamBoPhan',
    'sinhHieu',
    'chanDoan',
    'chanDoanBanDau',
    'huongXuLy',
    'thuocYLenh',
    'xetNghiem',
    'canLamSang',
    'dienBienLamSang'
]);

const FEATURE_WHITELISTS = Object.freeze({
    voice: Object.freeze([
        'lyDoVaoVien',
        'quaTrinhBenhLy',
        'tienSuBanThan',
        'tienSuGiaDinh',
        'khamLamSang',
        'khamToanThan',
        'khamBoPhan',
        'sinhHieu',
        'chanDoan',
        'chanDoanBanDau',
        'huongXuLy'
    ]),
    summary: _SUMMARY_WHITELIST,
    aiVip: _SUMMARY_WHITELIST,
    scanner: Object.freeze([
        'chanDoan',
        'chanDoanBanDau',
        'thuocYLenh',
        'xetNghiem',
        'canLamSang'
    ])
});


const DEFAULT_MAX_CHARS = 12000;

// =============================================
// PHIPipeline
// =============================================
export class PHIPipeline {
    /**
     * Prepare a payload for AI consumption.
     *
     * @param {Object} params
     * @param {string} params.feature - Feature identifier: 'voice' | 'summary' | 'aiVip' | 'scanner'
     * @param {Object|string} params.payload - Field map or raw string
     * @param {Object} [params.options] - Pipeline options
     * @param {boolean} [params.options.allowDates=false]
     * @param {boolean} [params.options.allowWardInfo=false]
     * @param {number}  [params.options.maxChars=12000]
     * @returns {{ safePayload: Object, redactedText: string, report: PHIReport }}
     */
    static prepareForAI({ feature, payload, options = {} }) {
        const {
            allowDates = false,
            allowWardInfo = false,
            maxChars = DEFAULT_MAX_CHARS
        } = options;

        // Stage 0: Normalize payload to field map
        const fieldMap = _normalizePayload(payload);

        // Stage 1: Field extraction — keep only whitelisted fields
        const filtered = _filterFields(fieldMap, feature);

        // Stage 2: PHI redaction via PHIRedactor.redactFields()
        const { redactedMap, redactedCount, reasons } = PHIRedactor.redactFields(
            filtered,
            { allowDates, allowWardInfo }
        );

        // Stage 3: Assemble text and run PHI guard
        let assembledText = _assembleText(redactedMap);
        const blocked = PHIRedactor.containsPHI(assembledText);

        if (blocked && !reasons.includes('residual_phi')) {
            reasons.push('residual_phi');
        }

        // Stage 4: maxChars truncation
        if (assembledText.length > maxChars) {
            assembledText = assembledText.slice(0, maxChars);
            _truncateMapToFit(redactedMap, maxChars);
        }

        return Object.freeze({
            safePayload: Object.freeze({ ...redactedMap }),
            redactedText: assembledText,
            report: Object.freeze({
                redactedCount,
                blocked,
                reasons: Object.freeze([...new Set(reasons)])
            })
        });
    }
}

// =============================================
// Internal helpers (not exported)
// =============================================

/**
 * Normalize payload: if string, wrap in { text: value }.
 * @param {Object|string|null|undefined} payload
 * @returns {Object<string, string>}
 */
function _normalizePayload(payload) {
    if (!payload) return {};
    if (typeof payload === 'string') return { text: payload };
    if (typeof payload !== 'object') return {};
    // Shallow copy — immutability: never mutate input
    return { ...payload };
}

/**
 * Filter fields by feature whitelist.
 * Unknown features use empty whitelist (most restrictive).
 * @param {Object} fieldMap
 * @param {string} feature
 * @returns {Object}
 */
function _filterFields(fieldMap, feature) {
    const whitelist = FEATURE_WHITELISTS[feature];
    // If no whitelist (unknown feature) or payload was a raw string, pass through
    if (!whitelist || fieldMap.text !== undefined) {
        return { ...fieldMap };
    }
    const filtered = {};
    for (const key of whitelist) {
        if (key in fieldMap) {
            filtered[key] = fieldMap[key];
        }
    }
    return filtered;
}

/**
 * Assemble a field map into a single text string for guard check.
 * @param {Object} fieldMap
 * @returns {string}
 */
function _assembleText(fieldMap) {
    return Object.values(fieldMap)
        .filter(v => typeof v === 'string')
        .join('\n');
}

/**
 * Truncate field map values so total length fits within maxChars.
 * Mutates the map in-place (safe because we own this copy).
 * @param {Object} map
 * @param {number} maxChars
 */
function _truncateMapToFit(map, maxChars) {
    let remaining = maxChars;
    for (const key of Object.keys(map)) {
        const val = map[key];
        if (typeof val !== 'string') continue;
        if (val.length <= remaining) {
            remaining -= val.length;
        } else {
            map[key] = val.slice(0, Math.max(0, remaining));
            remaining = 0;
        }
    }
}
