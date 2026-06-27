/**
 * 🧞 Aladinn CDS — Analytics & Feedback Loop
 *
 * Phase 4: Tracks clinician interactions with CDS alerts to enable
 * continuous quality improvement of the rule set.
 *
 * ⚠️ PHI SAFETY (Luật BVDLCN 2025, §1.2):
 *   NEVER log patient names, IDs, encounter IDs, medication names,
 *   or any clinical data. Only rule_code + action + timestamp.
 *
 * Data stays 100% local in IndexedDB — no external API calls.
 */

import { openDatabase } from './db.js';

// ---------------------------------------------------------------------------
// Session ID — generated once per page load, NOT tied to any patient
// ---------------------------------------------------------------------------
const SESSION_ID = (() => {
    try {
        return crypto.randomUUID();
    } catch {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }
})();

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
const AUDIT_LOG_STORE = 'audit_log';
const VALID_ACTIONS = Object.freeze(['accepted', 'dismissed', 'modified']);
const MIN_SAMPLE_SIZE = 10;

// ---------------------------------------------------------------------------
// Pure helpers (exported for testability)
// ---------------------------------------------------------------------------

/**
 * Build a sanitised audit entry. Pure function — no side effects.
 * CRITICAL: Only allow rule_code, action, reason, domain, severity.
 *
 * @param {string} ruleCode
 * @param {string} action
 * @param {string|null} reason
 * @param {Object} alertMeta - { domain, severity } — NO PHI
 * @param {string} sessionId
 * @returns {Object} sanitised entry (without `id` — auto-incremented by IDB)
 */
export function buildAuditEntry(ruleCode, action, reason, alertMeta, sessionId) {
    if (!ruleCode || typeof ruleCode !== 'string') {
        throw new Error('[CDS Analytics] ruleCode is required and must be a string');
    }
    if (!VALID_ACTIONS.includes(action)) {
        throw new Error(`[CDS Analytics] Invalid action "${action}". Must be one of: ${VALID_ACTIONS.join(', ')}`);
    }

    // Defensive: strip anything that is not domain/severity from alertMeta
    const safeMeta = Object.freeze({
        domain: typeof alertMeta?.domain === 'string' ? alertMeta.domain : 'unknown',
        severity: typeof alertMeta?.severity === 'string' ? alertMeta.severity : 'unknown',
    });

    return Object.freeze({
        rule_code: String(ruleCode),
        action: String(action),
        reason: reason != null ? String(reason) : null,
        domain: safeMeta.domain,
        severity: safeMeta.severity,
        timestamp: new Date().toISOString(),
        session_id: String(sessionId),
    });
}

/**
 * Calculate per-rule dismiss statistics from a list of audit entries.
 * Pure function — no DB access.
 *
 * @param {Array<Object>} entries - Array of audit_log entries
 * @param {number} cutoffMs - Entries older than this epoch ms are excluded
 * @returns {Array<Object>} sorted by dismiss_rate descending
 */
export function calculateDismissStats(entries, cutoffMs) {
    const grouped = new Map();

    for (const entry of entries) {
        const entryTime = new Date(entry.timestamp).getTime();
        if (Number.isNaN(entryTime) || entryTime < cutoffMs) continue;

        const code = entry.rule_code;
        if (!grouped.has(code)) {
            grouped.set(code, { rule_code: code, total: 0, accepted: 0, dismissed: 0, modified: 0 });
        }
        const stats = grouped.get(code);
        const updated = {
            ...stats,
            total: stats.total + 1,
        };

        if (entry.action === 'accepted') {
            updated.accepted = stats.accepted + 1;
        } else if (entry.action === 'dismissed') {
            updated.dismissed = stats.dismissed + 1;
        } else if (entry.action === 'modified') {
            updated.modified = stats.modified + 1;
        }

        grouped.set(code, updated);
    }

    return [...grouped.values()]
        .map(s => Object.freeze({
            rule_code: s.rule_code,
            total: s.total,
            accepted: s.accepted,
            dismissed: s.dismissed,
            modified: s.modified,
            dismiss_rate: s.total > 0 ? +(s.dismissed / s.total).toFixed(4) : 0,
        }))
        .sort((a, b) => b.dismiss_rate - a.dismiss_rate);
}

/**
 * Filter stats to rules that exceed a dismiss-rate threshold
 * AND have enough samples.
 * Pure function.
 *
 * @param {Array<Object>} stats - Output of calculateDismissStats
 * @param {number} threshold - 0–1 dismiss rate threshold
 * @param {number} [minSamples=10]
 * @returns {Array<Object>}
 */
export function filterFlaggedRules(stats, threshold, minSamples = MIN_SAMPLE_SIZE) {
    return stats.filter(
        s => s.dismiss_rate > threshold && s.total >= minSamples,
    );
}

// ---------------------------------------------------------------------------
// CDSAnalytics — public API
// ---------------------------------------------------------------------------

export const CDSAnalytics = Object.freeze({
    /**
     * Log an alert interaction event to IndexedDB audit_log store.
     * CRITICAL: Must NOT log any PHI (patient name, ID, encounter ID).
     * Only logs: rule_code, action, timestamp, domain, severity.
     *
     * @param {string} ruleCode - The alert rule code (e.g. 'DDI-001')
     * @param {string} action - 'accepted' | 'dismissed' | 'modified'
     * @param {string} [reason] - Optional dismiss reason
     * @param {Object} [alertMeta] - { domain, severity } — no PHI!
     */
    async logInteraction(ruleCode, action, reason = null, alertMeta = {}) {
        const entry = buildAuditEntry(ruleCode, action, reason, alertMeta, SESSION_ID);
        try {
            const db = await openDatabase();
            const tx = db.transaction(AUDIT_LOG_STORE, 'readwrite');
            tx.objectStore(AUDIT_LOG_STORE).add({ ...entry });
            await new Promise((resolve, reject) => {
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
                tx.onabort = () => reject(tx.error);
            });
        } catch (error) {
            console.error('[CDS Analytics] Failed to log interaction', {
                errorMessage: error?.message,
                ruleCode,
                action,
            });
            throw error;
        }
    },

    /**
     * Get aggregated dismiss statistics for all rules.
     * @param {number} [days=30] - Number of days to look back
     * @returns {Promise<Array<Object>>} [{ rule_code, total, accepted, dismissed, dismiss_rate }]
     */
    async getDismissStats(days = 30) {
        const db = await openDatabase();
        const tx = db.transaction(AUDIT_LOG_STORE, 'readonly');
        const entries = await new Promise((resolve, reject) => {
            const req = tx.objectStore(AUDIT_LOG_STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;
        return calculateDismissStats(entries, cutoffMs);
    },

    /**
     * Get rules that should be flagged for review (dismiss rate > threshold).
     * @param {number} [threshold=0.8] - Dismiss rate threshold (0-1)
     * @returns {Promise<Array<Object>>} Rules with high dismiss rates
     */
    async getFlaggedRules(threshold = 0.8) {
        const stats = await this.getDismissStats();
        return filterFlaggedRules(stats, threshold);
    },

    /**
     * Generate a compact summary of CDS effectiveness.
     * @param {number} [days=30]
     * @returns {Promise<Object>} { totalAlerts, acceptRate, dismissRate, topDismissed, period }
     */
    async getEffectivenessSummary(days = 30) {
        const stats = await this.getDismissStats(days);

        const totalAlerts = stats.reduce((sum, s) => sum + s.total, 0);
        const totalAccepted = stats.reduce((sum, s) => sum + s.accepted, 0);
        const totalDismissed = stats.reduce((sum, s) => sum + s.dismissed, 0);

        const topDismissed = stats
            .filter(s => s.total >= 5)
            .sort((a, b) => b.dismiss_rate - a.dismiss_rate)
            .slice(0, 5)
            .map(s => Object.freeze({
                rule_code: s.rule_code,
                dismiss_rate: s.dismiss_rate,
                total: s.total,
            }));

        return Object.freeze({
            totalAlerts,
            acceptRate: totalAlerts > 0 ? +(totalAccepted / totalAlerts).toFixed(4) : 0,
            dismissRate: totalAlerts > 0 ? +(totalDismissed / totalAlerts).toFixed(4) : 0,
            topDismissed,
            period: `${days} days`,
        });
    },

    /**
     * Purge old analytics data beyond retention period.
     * @param {number} [retentionDays=90] - Days to keep
     * @returns {Promise<number>} Number of entries purged
     */
    async purgeOldData(retentionDays = 90) {
        const cutoffMs = Date.now() - retentionDays * 24 * 60 * 60 * 1000;
        const db = await openDatabase();

        // Read all entries and identify old ones
        const txRead = db.transaction(AUDIT_LOG_STORE, 'readonly');
        const allEntries = await new Promise((resolve, reject) => {
            const req = txRead.objectStore(AUDIT_LOG_STORE).getAll();
            req.onsuccess = () => resolve(req.result);
            req.onerror = () => reject(req.error);
        });

        const keysToDelete = allEntries
            .filter(entry => {
                const entryTime = new Date(entry.timestamp).getTime();
                return !Number.isNaN(entryTime) && entryTime < cutoffMs;
            })
            .map(entry => entry.id);

        if (keysToDelete.length === 0) return 0;

        // Delete in a single transaction
        const txWrite = db.transaction(AUDIT_LOG_STORE, 'readwrite');
        const store = txWrite.objectStore(AUDIT_LOG_STORE);
        for (const key of keysToDelete) {
            store.delete(key);
        }
        await new Promise((resolve, reject) => {
            txWrite.oncomplete = () => resolve();
            txWrite.onerror = () => reject(txWrite.error);
            txWrite.onabort = () => reject(txWrite.error);
        });

        console.log(`[CDS Analytics] Purged ${keysToDelete.length} entries older than ${retentionDays} days`);
        return keysToDelete.length;
    },
});
