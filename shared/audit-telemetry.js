/**
 * 🏺 Aladinn — Audit Telemetry Module
 * Local-only telemetry for tracking extension usage and errors.
 * 
 * SECURITY: No PHI (Protected Health Information) is ever stored.
 * All patient identifiers are masked before logging.
 * Data is stored locally in chrome.storage.local with TTL enforcement.
 * 
 * Schema follows docs/security/audit-schema.md
 */

const AUDIT_STORAGE_KEY = 'aladinn_audit_log';
const METRICS_STORAGE_KEY = 'aladinn_pilot_metrics';
const MAX_AUDIT_ENTRIES = 500;
const AUDIT_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Get the current extension version from manifest
 * @returns {string}
 */
function getVersion() {
    try {
        return chrome.runtime.getManifest?.()?.version || 'unknown';
    } catch {
        return 'unknown';
    }
}

/**
 * Mask a user/patient ID for audit logging (no PHI)
 * @param {string} id - Raw ID
 * @returns {string} Masked ID (e.g., "U-12***89")
 */
function maskId(id) {
    if (!id || typeof id !== 'string') return 'U-****';
    if (id.length <= 4) return 'U-****';
    return `U-${id.slice(0, 2)}***${id.slice(-2)}`;
}

/**
 * Create a standard audit event object
 * @param {string} eventName - Event name (e.g., 'ai_request_started')
 * @param {string} module - Module name (e.g., 'voice_ai', 'cds', 'scanner')
 * @param {Object} [options] - Additional options
 * @param {boolean} [options.success=true] - Whether the operation succeeded
 * @param {string} [options.errorCode=null] - Error code if failed
 * @param {Object} [options.extra={}] - Extra non-PHI metadata
 * @returns {Object} Audit event object
 */
function createAuditEvent(eventName, module, options = {}) {
    const { success = true, errorCode = null, extra = {} } = options;
    return {
        event_name: eventName,
        module,
        timestamp: new Date().toISOString(),
        success,
        error_code: errorCode,
        version: getVersion(),
        environment: 'production',
        ...extra
    };
}

/**
 * Log an audit event to local storage
 * @param {string} eventName
 * @param {string} module
 * @param {Object} [options]
 */
async function logAuditEvent(eventName, module, options = {}) {
    try {
        const event = createAuditEvent(eventName, module, options);
        const result = await chrome.storage.local.get([AUDIT_STORAGE_KEY]);
        const logs = result[AUDIT_STORAGE_KEY] || [];

        logs.push(event);

        // Enforce max entries
        while (logs.length > MAX_AUDIT_ENTRIES) {
            logs.shift();
        }

        // TTL cleanup
        const cutoff = Date.now() - AUDIT_TTL_MS;
        const filtered = logs.filter(e => new Date(e.timestamp).getTime() > cutoff);

        await chrome.storage.local.set({ [AUDIT_STORAGE_KEY]: filtered });
    } catch (e) {
        console.log('[Aladinn Audit] Failed to log event:', e.message);
    }
}

/**
 * Get all audit logs (for diagnostics/export)
 * @returns {Promise<Array>}
 */
async function getAuditLogs() {
    try {
        const result = await chrome.storage.local.get([AUDIT_STORAGE_KEY]);
        return result[AUDIT_STORAGE_KEY] || [];
    } catch {
        return [];
    }
}

/**
 * Clear all audit logs
 */
async function clearAuditLogs() {
    await chrome.storage.local.remove(AUDIT_STORAGE_KEY);
}

// ========================================
// Pilot Metrics (Usage Counters)
// ========================================

/**
 * Increment a usage counter for pilot metrics
 * @param {string} metricName - e.g., 'scanner_opened', 'ai_request', 'cds_alert'
 * @param {number} [count=1] - Amount to increment
 */
async function incrementMetric(metricName, count = 1) {
    try {
        const result = await chrome.storage.local.get([METRICS_STORAGE_KEY]);
        const metrics = result[METRICS_STORAGE_KEY] || {};
        const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

        if (!metrics[today]) {
            metrics[today] = {};
        }
        metrics[today][metricName] = (metrics[today][metricName] || 0) + count;

        // Keep only last 30 days
        const keys = Object.keys(metrics).sort();
        while (keys.length > 30) {
            delete metrics[keys.shift()];
        }

        await chrome.storage.local.set({ [METRICS_STORAGE_KEY]: metrics });
    } catch (e) {
        console.log('[Aladinn Metrics] Failed to increment:', e.message);
    }
}

/**
 * Get all pilot metrics
 * @returns {Promise<Object>} Daily metrics { "2026-05-08": { scanner_opened: 5, ... } }
 */
async function getMetrics() {
    try {
        const result = await chrome.storage.local.get([METRICS_STORAGE_KEY]);
        return result[METRICS_STORAGE_KEY] || {};
    } catch {
        return {};
    }
}

/**
 * Get summary metrics for the last N days
 * @param {number} [days=7]
 * @returns {Promise<Object>}
 */
async function getMetricsSummary(days = 7) {
    const all = await getMetrics();
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - days);
    const cutoffStr = cutoff.toISOString().slice(0, 10);

    const summary = {};
    for (const [date, counters] of Object.entries(all)) {
        if (date >= cutoffStr) {
            for (const [key, val] of Object.entries(counters)) {
                summary[key] = (summary[key] || 0) + val;
            }
        }
    }
    return { days, summary, from: cutoffStr, to: new Date().toISOString().slice(0, 10) };
}

/**
 * Record a timing metric (e.g., AI response time)
 * @param {string} metricName
 * @param {number} durationMs
 */
async function recordTiming(metricName, durationMs) {
    try {
        const result = await chrome.storage.local.get([METRICS_STORAGE_KEY]);
        const metrics = result[METRICS_STORAGE_KEY] || {};
        const today = new Date().toISOString().slice(0, 10);

        if (!metrics[today]) metrics[today] = {};
        
        // Store as running average + count
        const timingKey = `${metricName}_avg_ms`;
        const countKey = `${metricName}_count`;
        const currentAvg = metrics[today][timingKey] || 0;
        const currentCount = metrics[today][countKey] || 0;
        
        // Incremental mean
        metrics[today][countKey] = currentCount + 1;
        metrics[today][timingKey] = currentAvg + (durationMs - currentAvg) / (currentCount + 1);

        await chrome.storage.local.set({ [METRICS_STORAGE_KEY]: metrics });
    } catch (e) {
        console.log('[Aladinn Metrics] Failed to record timing:', e.message);
    }
}

// ========================================
// Pre-defined Event Helpers
// ========================================

const AuditEvents = {
    /** AI request started */
    aiRequestStarted: (model) =>
        logAuditEvent('ai_request_started', 'voice_ai', { extra: { model } }),

    /** AI request completed */
    aiRequestCompleted: (model, durationMs) => {
        logAuditEvent('ai_request_completed', 'voice_ai', { extra: { model, duration_ms: durationMs } });
        incrementMetric('ai_request');
        recordTiming('ai_response', durationMs);
    },

    /** AI request failed */
    aiRequestFailed: (errorCode, model) =>
        logAuditEvent('ai_request_failed', 'voice_ai', { success: false, errorCode, extra: { model } }),

    /** Scanner opened */
    scannerOpened: () => {
        logAuditEvent('scanner_opened', 'scanner');
        incrementMetric('scanner_opened');
    },

    /** Export confirmed (CSV/JSON) */
    exportConfirmed: (format) => {
        logAuditEvent('export_confirmed', 'scanner', { extra: { format } });
        incrementMetric('export_confirmed');
    },

    /** HIS logout detected — purge */
    hisLogoutPurge: () =>
        logAuditEvent('his_logout_purge', 'security'),

    /** Auto-sign session started */
    autosignStarted: () => {
        logAuditEvent('autosign_session_started', 'sign');
        incrementMetric('autosign_session');
    },

    /** Auto-sign session stopped */
    autosignStopped: (reason) =>
        logAuditEvent('autosign_session_stopped', 'sign', { extra: { reason } }),

    /** CDS warning generated */
    cdsWarningGenerated: (alertCount, severityBreakdown) => {
        logAuditEvent('cds_warning_generated', 'cds', { extra: { alert_count: alertCount, severity: severityBreakdown } });
        incrementMetric('cds_alert', alertCount);
    },

    /** CDS alert dismissed by user */
    cdsAlertDismissed: () =>
        incrementMetric('cds_alert_dismissed'),

    /** PIN unlock */
    pinUnlockSuccess: () =>
        logAuditEvent('pin_unlock', 'security'),

    /** PIN unlock failed */
    pinUnlockFailed: () =>
        logAuditEvent('pin_unlock_failed', 'security', { success: false, errorCode: 'INVALID_PIN' }),

    /** Voice recording started */
    voiceRecordingStarted: () => {
        logAuditEvent('voice_recording_started', 'voice_ai');
        incrementMetric('voice_recording');
    },

    /** [P0-03] PHI pipeline blocked an AI request */
    phiPipelineBlocked: (context, reasons) =>
        logAuditEvent('phi_pipeline_blocked', 'security', {
            success: false,
            errorCode: 'PHI_BLOCKED',
            extra: { context, reasons }
        }),

    /** [P0-03] PHI pipeline redacted fields before AI request */
    phiPipelineRedacted: (context, redactedCount) =>
        logAuditEvent('phi_pipeline_redacted', 'security', {
            extra: { context, redacted_count: redactedCount }
        }),
};

// Export for use across the extension
export {
    logAuditEvent,
    getAuditLogs,
    clearAuditLogs,
    incrementMetric,
    getMetrics,
    getMetricsSummary,
    recordTiming,
    maskId,
    createAuditEvent,
    AuditEvents
};
