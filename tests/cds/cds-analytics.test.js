// @vitest-environment jsdom
/**
 * 🧪 CDS Analytics — Unit Tests
 *
 * Tests the CDS Analytics feedback loop:
 * - PHI safety: no patient data in logged entries
 * - logInteraction stores correct format
 * - getDismissStats correctly calculates rates
 * - getFlaggedRules returns only rules above threshold with enough samples
 * - getEffectivenessSummary returns correct structure
 * - purgeOldData removes old entries
 *
 * Strategy: Test pure helper functions directly; test CDSAnalytics methods
 * with a mocked openDatabase via vi.mock.
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

import {
    buildAuditEntry,
    calculateDismissStats,
    filterFlaggedRules,
    CDSAnalytics,
} from '../../content/cds/cds-analytics.js';

// ---------------------------------------------------------------------------
// In-memory IndexedDB mock
// ---------------------------------------------------------------------------

/**
 * Minimal in-memory mock of an IndexedDB object store.
 * Supports: add, getAll, delete, with auto-increment id.
 */
function createMockStore() {
    let autoId = 0;
    let records = [];

    return {
        add(record) {
            autoId += 1;
            records.push({ ...record, id: autoId });
            return { onsuccess: null, onerror: null };
        },
        getAll() {
            const req = { result: [...records], onsuccess: null, onerror: null };
            // Fire onsuccess asynchronously
            Promise.resolve().then(() => req.onsuccess?.());
            return req;
        },
        delete(key) {
            records = records.filter(r => r.id !== key);
            return { onsuccess: null, onerror: null };
        },
        // Test helper — direct access
        _getRecords() { return [...records]; },
        _clear() { records = []; autoId = 0; },
    };
}

function createMockDB() {
    const stores = {};

    return {
        transaction(storeName, _mode) {
            if (!stores[storeName]) {
                stores[storeName] = createMockStore();
            }
            const store = stores[storeName];
            const tx = {
                objectStore() { return store; },
                oncomplete: null,
                onerror: null,
                onabort: null,
            };
            // Auto-complete transaction on next microtask
            Promise.resolve().then(() => tx.oncomplete?.());
            return tx;
        },
        _getStore(name) {
            if (!stores[name]) stores[name] = createMockStore();
            return stores[name];
        },
        _reset() {
            for (const name of Object.keys(stores)) {
                stores[name]._clear();
            }
        },
    };
}

// Shared mock DB instance
const mockDB = createMockDB();

// Mock openDatabase to return our in-memory DB
vi.mock('../../content/cds/db.js', () => ({
    openDatabase: vi.fn(() => Promise.resolve(mockDB)),
}));

// ---------------------------------------------------------------------------
// Test suite: Pure helper — buildAuditEntry
// ---------------------------------------------------------------------------
describe('CDS Analytics: buildAuditEntry (pure)', () => {
    it('should build a valid entry with all fields', () => {
        const entry = buildAuditEntry('DDI-001', 'accepted', null, { domain: 'interaction', severity: 'critical' }, 'sess-123');

        expect(entry.rule_code).toBe('DDI-001');
        expect(entry.action).toBe('accepted');
        expect(entry.reason).toBeNull();
        expect(entry.domain).toBe('interaction');
        expect(entry.severity).toBe('critical');
        expect(entry.session_id).toBe('sess-123');
        expect(entry.timestamp).toBeTruthy();
        // ISO 8601
        expect(() => new Date(entry.timestamp)).not.toThrow();
    });

    it('should include dismiss reason when provided', () => {
        const entry = buildAuditEntry('DDI-002', 'dismissed', 'Not clinically relevant', { domain: 'interaction', severity: 'warning' }, 'sess-x');

        expect(entry.reason).toBe('Not clinically relevant');
        expect(entry.action).toBe('dismissed');
    });

    it('should support "modified" action', () => {
        const entry = buildAuditEntry('DDD-010', 'modified', 'Adjusted dose', { domain: 'drug-disease', severity: 'info' }, 'sess-y');
        expect(entry.action).toBe('modified');
        expect(entry.reason).toBe('Adjusted dose');
    });

    it('should reject invalid actions', () => {
        expect(() => buildAuditEntry('DDI-001', 'ignored', null, {}, 's')).toThrow(/Invalid action/);
        expect(() => buildAuditEntry('DDI-001', '', null, {}, 's')).toThrow(/Invalid action/);
    });

    it('should reject missing ruleCode', () => {
        expect(() => buildAuditEntry('', 'accepted', null, {}, 's')).toThrow(/ruleCode is required/);
        expect(() => buildAuditEntry(null, 'accepted', null, {}, 's')).toThrow(/ruleCode is required/);
        expect(() => buildAuditEntry(undefined, 'accepted', null, {}, 's')).toThrow(/ruleCode is required/);
    });

    it('should default domain and severity to "unknown" when not provided', () => {
        const entry = buildAuditEntry('REN-001', 'accepted', null, {}, 'sess-z');
        expect(entry.domain).toBe('unknown');
        expect(entry.severity).toBe('unknown');
    });

    it('should freeze the returned entry (immutability)', () => {
        const entry = buildAuditEntry('DDI-001', 'accepted', null, { domain: 'interaction', severity: 'critical' }, 's');
        expect(Object.isFrozen(entry)).toBe(true);
    });

    // -----------------------------------------------------------------------
    // PHI SAFETY TESTS — CRITICAL
    // -----------------------------------------------------------------------
    it('PHI SAFETY: should NOT include any patient-identifiable fields', () => {
        const dangerousMeta = {
            domain: 'interaction',
            severity: 'critical',
            // These should be stripped / not passed through:
            patientId: 'BN-123456',
            patientName: 'Nguyen Van A',
            encounterId: 'ENC-999',
            medication: 'Amoxicillin 500mg',
        };

        const entry = buildAuditEntry('DDI-001', 'accepted', null, dangerousMeta, 's');

        // Only expected fields
        const keys = Object.keys(entry);
        expect(keys).toEqual(['rule_code', 'action', 'reason', 'domain', 'severity', 'timestamp', 'session_id']);

        // Double-check no PHI leaked
        const json = JSON.stringify(entry);
        expect(json).not.toContain('BN-123456');
        expect(json).not.toContain('Nguyen Van A');
        expect(json).not.toContain('ENC-999');
        expect(json).not.toContain('Amoxicillin');
    });

    it('PHI SAFETY: alertMeta with non-string domain/severity falls back to "unknown"', () => {
        const entry = buildAuditEntry('DDI-001', 'dismissed', null, { domain: 12345, severity: { nested: true } }, 's');
        expect(entry.domain).toBe('unknown');
        expect(entry.severity).toBe('unknown');
    });
});

// ---------------------------------------------------------------------------
// Test suite: Pure helper — calculateDismissStats
// ---------------------------------------------------------------------------
describe('CDS Analytics: calculateDismissStats (pure)', () => {
    const now = Date.now();
    const recent = new Date(now - 1000).toISOString();         // 1s ago
    const old = new Date(now - 60 * 24 * 60 * 60 * 1000).toISOString(); // 60 days ago

    it('should calculate correct rates for a single rule', () => {
        const entries = [
            { rule_code: 'DDI-001', action: 'accepted', timestamp: recent },
            { rule_code: 'DDI-001', action: 'accepted', timestamp: recent },
            { rule_code: 'DDI-001', action: 'dismissed', timestamp: recent },
        ];

        const cutoff = now - 30 * 24 * 60 * 60 * 1000;
        const stats = calculateDismissStats(entries, cutoff);

        expect(stats).toHaveLength(1);
        expect(stats[0].rule_code).toBe('DDI-001');
        expect(stats[0].total).toBe(3);
        expect(stats[0].accepted).toBe(2);
        expect(stats[0].dismissed).toBe(1);
        expect(stats[0].dismiss_rate).toBeCloseTo(1 / 3, 4);
    });

    it('should group by rule_code correctly', () => {
        const entries = [
            { rule_code: 'DDI-001', action: 'accepted', timestamp: recent },
            { rule_code: 'DDI-002', action: 'dismissed', timestamp: recent },
            { rule_code: 'DDI-001', action: 'dismissed', timestamp: recent },
            { rule_code: 'DDI-002', action: 'dismissed', timestamp: recent },
        ];

        const cutoff = now - 30 * 24 * 60 * 60 * 1000;
        const stats = calculateDismissStats(entries, cutoff);

        expect(stats).toHaveLength(2);
        const ddi002 = stats.find(s => s.rule_code === 'DDI-002');
        expect(ddi002.dismiss_rate).toBe(1.0);
    });

    it('should exclude entries older than cutoff', () => {
        const entries = [
            { rule_code: 'DDI-001', action: 'dismissed', timestamp: old },
            { rule_code: 'DDI-001', action: 'accepted', timestamp: recent },
        ];

        const cutoff = now - 30 * 24 * 60 * 60 * 1000;
        const stats = calculateDismissStats(entries, cutoff);

        expect(stats).toHaveLength(1);
        expect(stats[0].total).toBe(1);
        expect(stats[0].accepted).toBe(1);
        expect(stats[0].dismissed).toBe(0);
    });

    it('should return empty array for empty input', () => {
        const stats = calculateDismissStats([], 0);
        expect(stats).toEqual([]);
    });

    it('should sort by dismiss_rate descending', () => {
        const entries = [
            // Rule A: 0% dismiss
            { rule_code: 'A', action: 'accepted', timestamp: recent },
            // Rule B: 100% dismiss
            { rule_code: 'B', action: 'dismissed', timestamp: recent },
            // Rule C: 50% dismiss
            { rule_code: 'C', action: 'accepted', timestamp: recent },
            { rule_code: 'C', action: 'dismissed', timestamp: recent },
        ];

        const stats = calculateDismissStats(entries, 0);
        expect(stats[0].rule_code).toBe('B');
        expect(stats[1].rule_code).toBe('C');
        expect(stats[2].rule_code).toBe('A');
    });

    it('should count "modified" action separately', () => {
        const entries = [
            { rule_code: 'DDI-001', action: 'modified', timestamp: recent },
        ];
        const stats = calculateDismissStats(entries, 0);
        expect(stats[0].modified).toBe(1);
        expect(stats[0].dismiss_rate).toBe(0);
    });
});

// ---------------------------------------------------------------------------
// Test suite: Pure helper — filterFlaggedRules
// ---------------------------------------------------------------------------
describe('CDS Analytics: filterFlaggedRules (pure)', () => {
    it('should flag rules above threshold with enough samples', () => {
        const stats = [
            { rule_code: 'A', total: 20, dismissed: 18, dismiss_rate: 0.9 },
            { rule_code: 'B', total: 5, dismissed: 5, dismiss_rate: 1.0 },   // Too few samples
            { rule_code: 'C', total: 15, dismissed: 6, dismiss_rate: 0.4 },  // Below threshold
        ];

        const flagged = filterFlaggedRules(stats, 0.8, 10);
        expect(flagged).toHaveLength(1);
        expect(flagged[0].rule_code).toBe('A');
    });

    it('should return empty when no rules match', () => {
        const stats = [
            { rule_code: 'X', total: 100, dismissed: 10, dismiss_rate: 0.1 },
        ];

        expect(filterFlaggedRules(stats, 0.8)).toEqual([]);
    });

    it('should use default minSamples of 10', () => {
        const stats = [
            { rule_code: 'Y', total: 9, dismissed: 9, dismiss_rate: 1.0 },
        ];

        // 9 < 10 (default), so not flagged
        expect(filterFlaggedRules(stats, 0.5)).toEqual([]);
    });
});

// ---------------------------------------------------------------------------
// Test suite: CDSAnalytics integration (with mock DB)
// ---------------------------------------------------------------------------
describe('CDS Analytics: CDSAnalytics integration', () => {
    beforeEach(() => {
        mockDB._reset();
    });

    it('logInteraction should store a valid entry in audit_log', async () => {
        await CDSAnalytics.logInteraction('DDI-001', 'accepted', null, {
            domain: 'interaction',
            severity: 'critical',
        });

        const records = mockDB._getStore('audit_log')._getRecords();
        expect(records).toHaveLength(1);

        const r = records[0];
        expect(r.rule_code).toBe('DDI-001');
        expect(r.action).toBe('accepted');
        expect(r.reason).toBeNull();
        expect(r.domain).toBe('interaction');
        expect(r.severity).toBe('critical');
        expect(r.id).toBe(1); // auto-incremented
        expect(r.timestamp).toBeTruthy();
        expect(r.session_id).toBeTruthy();
    });

    it('logInteraction should store dismiss reason', async () => {
        await CDSAnalytics.logInteraction('DDI-002', 'dismissed', 'Not relevant for this patient age group', {
            domain: 'interaction',
            severity: 'warning',
        });

        const records = mockDB._getStore('audit_log')._getRecords();
        expect(records[0].reason).toBe('Not relevant for this patient age group');
    });

    it('logInteraction PHI SAFETY: should never contain patient data', async () => {
        await CDSAnalytics.logInteraction('DDI-003', 'accepted', null, {
            domain: 'interaction',
            severity: 'info',
            patientId: 'SHOULD-NOT-APPEAR',
            patientName: 'Tran Van B',
            encounterId: 'ENC-00001',
        });

        const records = mockDB._getStore('audit_log')._getRecords();
        const json = JSON.stringify(records[0]);
        expect(json).not.toContain('SHOULD-NOT-APPEAR');
        expect(json).not.toContain('Tran Van B');
        expect(json).not.toContain('ENC-00001');
    });

    it('getDismissStats should return aggregated statistics', async () => {
        // Seed 3 entries
        await CDSAnalytics.logInteraction('DDI-001', 'accepted', null, { domain: 'interaction', severity: 'critical' });
        await CDSAnalytics.logInteraction('DDI-001', 'dismissed', 'test', { domain: 'interaction', severity: 'critical' });
        await CDSAnalytics.logInteraction('DDI-002', 'dismissed', null, { domain: 'interaction', severity: 'warning' });

        const stats = await CDSAnalytics.getDismissStats(30);

        expect(stats.length).toBeGreaterThanOrEqual(2);
        const ddi001 = stats.find(s => s.rule_code === 'DDI-001');
        expect(ddi001.total).toBe(2);
        expect(ddi001.accepted).toBe(1);
        expect(ddi001.dismissed).toBe(1);
        expect(ddi001.dismiss_rate).toBeCloseTo(0.5, 4);
    });

    it('getFlaggedRules should only return high-dismiss rules with enough samples', async () => {
        // Seed 12 entries for DDI-SPAM (all dismissed)
        for (let i = 0; i < 12; i++) {
            await CDSAnalytics.logInteraction('DDI-SPAM', 'dismissed', null, { domain: 'interaction', severity: 'info' });
        }
        // Seed 2 for DDI-GOOD (all accepted, too few samples)
        await CDSAnalytics.logInteraction('DDI-GOOD', 'accepted', null, { domain: 'interaction', severity: 'critical' });
        await CDSAnalytics.logInteraction('DDI-GOOD', 'accepted', null, { domain: 'interaction', severity: 'critical' });

        const flagged = await CDSAnalytics.getFlaggedRules(0.8);

        expect(flagged).toHaveLength(1);
        expect(flagged[0].rule_code).toBe('DDI-SPAM');
        expect(flagged[0].dismiss_rate).toBe(1.0);
    });

    it('getEffectivenessSummary should return correct structure', async () => {
        await CDSAnalytics.logInteraction('DDI-001', 'accepted', null, { domain: 'interaction', severity: 'critical' });
        await CDSAnalytics.logInteraction('DDI-002', 'dismissed', null, { domain: 'interaction', severity: 'warning' });

        const summary = await CDSAnalytics.getEffectivenessSummary(30);

        expect(summary).toHaveProperty('totalAlerts');
        expect(summary).toHaveProperty('acceptRate');
        expect(summary).toHaveProperty('dismissRate');
        expect(summary).toHaveProperty('topDismissed');
        expect(summary).toHaveProperty('period');
        expect(summary.totalAlerts).toBe(2);
        expect(summary.acceptRate).toBeCloseTo(0.5, 4);
        expect(summary.dismissRate).toBeCloseTo(0.5, 4);
        expect(summary.period).toBe('30 days');
        expect(Array.isArray(summary.topDismissed)).toBe(true);
    });

    it('getEffectivenessSummary should return zeros for empty DB', async () => {
        const summary = await CDSAnalytics.getEffectivenessSummary(30);
        expect(summary.totalAlerts).toBe(0);
        expect(summary.acceptRate).toBe(0);
        expect(summary.dismissRate).toBe(0);
        expect(summary.topDismissed).toEqual([]);
    });

    it('purgeOldData should remove entries older than retention period', async () => {
        // Insert an "old" entry by directly manipulating the store
        const store = mockDB._getStore('audit_log');
        const oldDate = new Date(Date.now() - 120 * 24 * 60 * 60 * 1000).toISOString(); // 120 days ago
        store.add({
            rule_code: 'OLD-001',
            action: 'dismissed',
            reason: null,
            domain: 'interaction',
            severity: 'info',
            timestamp: oldDate,
            session_id: 'old-session',
        });

        // Insert a recent entry
        await CDSAnalytics.logInteraction('NEW-001', 'accepted', null, { domain: 'interaction', severity: 'critical' });

        const purged = await CDSAnalytics.purgeOldData(90);

        expect(purged).toBe(1);
        const remaining = store._getRecords();
        expect(remaining.length).toBe(1);
        expect(remaining[0].rule_code).toBe('NEW-001');
    });

    it('purgeOldData should return 0 when nothing to purge', async () => {
        await CDSAnalytics.logInteraction('RECENT-001', 'accepted', null, { domain: 'interaction', severity: 'info' });

        const purged = await CDSAnalytics.purgeOldData(90);
        expect(purged).toBe(0);
    });
});
