/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { MedRecEngine } from '../../content/cds/med-rec.js';

// ─── HELPERS ──────────────────────────────────────────────────────────────────

function med(name, dose = '500mg', frequency = '2 lần/ngày', route = 'uống') {
    return { name, dose, frequency, route };
}

// ─── MedRecEngine.normalizeMedName ────────────────────────────────────────────

describe('MedRec — normalizeMedName', () => {
    it('lowercases and trims whitespace', () => {
        expect(MedRecEngine.normalizeMedName('  Paracetamol  ')).toBe('paracetamol');
    });

    it('strips Vietnamese diacritics', () => {
        expect(MedRecEngine.normalizeMedName('Đối chiếu')).toBe('doi chieu');
    });

    it('handles composed and decomposed Unicode equally', () => {
        const composed = 'Thuốc';    // NFC
        const decomposed = 'Thuốc';  // NFD (if pre-decomposed, same logical string)
        expect(MedRecEngine.normalizeMedName(composed))
            .toBe(MedRecEngine.normalizeMedName(decomposed));
    });

    it('normalizes Vietnamese drug names (common)', () => {
        expect(MedRecEngine.normalizeMedName('Amoxicillin')).toBe('amoxicillin');
        expect(MedRecEngine.normalizeMedName('Đau Đầu Viên')).toBe('dau dau vien');
    });

    it('returns empty string for non-string input', () => {
        expect(MedRecEngine.normalizeMedName(null)).toBe('');
        expect(MedRecEngine.normalizeMedName(undefined)).toBe('');
        expect(MedRecEngine.normalizeMedName(42)).toBe('');
    });

    it('collapses multiple spaces', () => {
        expect(MedRecEngine.normalizeMedName('A   B   C')).toBe('a b c');
    });

    it('strips special characters except hyphens', () => {
        expect(MedRecEngine.normalizeMedName('amoxicillin-clavulanate')).toBe('amoxicillin-clavulanate');
        expect(MedRecEngine.normalizeMedName('test@#$%')).toBe('test');
    });
});

// ─── MedRecEngine.reconcile — basic scenarios ─────────────────────────────────

describe('MedRec — reconcile()', () => {
    it('returns empty result for empty lists', () => {
        const result = MedRecEngine.reconcile([], [], 'admission');
        expect(result.added).toEqual([]);
        expect(result.removed).toEqual([]);
        expect(result.changed).toEqual([]);
        expect(result.unchanged).toEqual([]);
        expect(result.alerts).toEqual([]);
    });

    it('returns empty result for invalid inputs (fail-closed)', () => {
        expect(MedRecEngine.reconcile(null, [])).toEqual(expect.objectContaining({
            added: [], removed: [], changed: [], unchanged: [],
        }));
        expect(MedRecEngine.reconcile('bad', 123)).toEqual(expect.objectContaining({
            added: [], removed: [], changed: [], unchanged: [],
        }));
    });

    it('detects all drugs unchanged', () => {
        const prev = [med('Paracetamol'), med('Amoxicillin')];
        const curr = [med('Paracetamol'), med('Amoxicillin')];
        const result = MedRecEngine.reconcile(prev, curr);

        expect(result.unchanged).toHaveLength(2);
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
        expect(result.changed).toHaveLength(0);
    });

    it('detects drug added', () => {
        const prev = [med('Paracetamol')];
        const curr = [med('Paracetamol'), med('Ibuprofen')];
        const result = MedRecEngine.reconcile(prev, curr);

        expect(result.added).toHaveLength(1);
        expect(result.added[0].name).toBe('Ibuprofen');
        expect(result.unchanged).toHaveLength(1);
    });

    it('detects drug removed', () => {
        const prev = [med('Paracetamol'), med('Ibuprofen')];
        const curr = [med('Paracetamol')];
        const result = MedRecEngine.reconcile(prev, curr);

        expect(result.removed).toHaveLength(1);
        expect(result.removed[0].name).toBe('Ibuprofen');
    });

    it('detects dose changed', () => {
        const prev = [med('Paracetamol', '500mg')];
        const curr = [med('Paracetamol', '1000mg')];
        const result = MedRecEngine.reconcile(prev, curr);

        expect(result.changed).toHaveLength(1);
        expect(result.changed[0].changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'dose', from: '500mg', to: '1000mg' }),
            ]),
        );
    });

    it('detects frequency changed', () => {
        const prev = [med('Amoxicillin', '500mg', '2 lần/ngày')];
        const curr = [med('Amoxicillin', '500mg', '3 lần/ngày')];
        const result = MedRecEngine.reconcile(prev, curr);

        expect(result.changed).toHaveLength(1);
        expect(result.changed[0].changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'frequency' }),
            ]),
        );
    });

    it('detects route changed', () => {
        const prev = [med('Ceftriaxone', '1g', '1 lần/ngày', 'tiêm bắp')];
        const curr = [med('Ceftriaxone', '1g', '1 lần/ngày', 'tiêm tĩnh mạch')];
        const result = MedRecEngine.reconcile(prev, curr);

        expect(result.changed).toHaveLength(1);
        expect(result.changed[0].changes).toEqual(
            expect.arrayContaining([
                expect.objectContaining({ field: 'route', from: 'tiêm bắp', to: 'tiêm tĩnh mạch' }),
            ]),
        );
    });

    it('handles Vietnamese drug names with accents (case-insensitive)', () => {
        const prev = [med('Thuốc Đặc Biệt')];
        const curr = [med('thuoc dac biet')];
        const result = MedRecEngine.reconcile(prev, curr);

        // Should match as the same drug after normalization
        expect(result.unchanged).toHaveLength(1);
        expect(result.added).toHaveLength(0);
        expect(result.removed).toHaveLength(0);
    });

    it('does not mutate input arrays', () => {
        const prev = Object.freeze([Object.freeze(med('Paracetamol'))]);
        const curr = Object.freeze([Object.freeze(med('Ibuprofen'))]);

        // Should not throw
        expect(() => MedRecEngine.reconcile(prev, curr)).not.toThrow();
    });

    it('defaults to admission scenario for invalid scenario', () => {
        const result = MedRecEngine.reconcile(
            [med('Warfarin')], [], 'invalid_scenario',
        );
        // Should still produce alerts (omission) — scenario defaults to admission
        expect(result.removed).toHaveLength(1);
        expect(result.alerts.length).toBeGreaterThan(0);
    });

    it('handles empty previous list with current meds (all added)', () => {
        const result = MedRecEngine.reconcile([], [med('Aspirin'), med('Omeprazole')]);
        expect(result.added).toHaveLength(2);
        expect(result.removed).toHaveLength(0);
    });

    it('handles empty current list with previous meds (all removed)', () => {
        const result = MedRecEngine.reconcile([med('Aspirin'), med('Omeprazole')], []);
        expect(result.removed).toHaveLength(2);
        expect(result.added).toHaveLength(0);
    });
});

// ─── MedRecEngine.reconcile — high-risk drug scenarios ────────────────────────

describe('MedRec — high-risk drug stopped', () => {
    it('flags warfarin (anticoagulant) stopped', () => {
        const result = MedRecEngine.reconcile(
            [med('Warfarin', '5mg')],
            [],
            'admission',
        );
        const hrAlert = result.alerts.find(a => a.rule_code === 'MED-REC-HIGH-RISK-STOP');
        expect(hrAlert).toBeDefined();
        expect(hrAlert.severity).toBe('high');
        expect(hrAlert.domain).toBe('med_reconciliation');
        expect(hrAlert.matched_items.category).toEqual(['anticoagulants']);
    });

    it('flags insulin stopped', () => {
        const result = MedRecEngine.reconcile(
            [med('Insulin', '10IU')],
            [],
            'discharge',
        );
        const hrAlert = result.alerts.find(a => a.rule_code === 'MED-REC-HIGH-RISK-STOP');
        expect(hrAlert).toBeDefined();
        expect(hrAlert.matched_items.category).toEqual(['insulins']);
    });

    it('flags phenytoin (antiepileptic) stopped', () => {
        const result = MedRecEngine.reconcile(
            [med('Phenytoin', '100mg')],
            [],
            'transfer',
        );
        const hrAlert = result.alerts.find(a => a.rule_code === 'MED-REC-HIGH-RISK-STOP');
        expect(hrAlert).toBeDefined();
        expect(hrAlert.matched_items.category).toEqual(['antiepileptics']);
    });

    it('flags tacrolimus (immunosuppressant) stopped', () => {
        const result = MedRecEngine.reconcile(
            [med('Tacrolimus', '2mg')],
            [],
            'transfer',
        );
        const hrAlert = result.alerts.find(a => a.rule_code === 'MED-REC-HIGH-RISK-STOP');
        expect(hrAlert).toBeDefined();
        expect(hrAlert.matched_items.category).toEqual(['immunosuppressants']);
    });

    it('does NOT flag non-high-risk drug stopped', () => {
        const result = MedRecEngine.reconcile(
            [med('Paracetamol', '500mg')],
            [],
            'admission',
        );
        const hrAlert = result.alerts.find(a => a.rule_code === 'MED-REC-HIGH-RISK-STOP');
        expect(hrAlert).toBeUndefined();
    });
});

// ─── MedRecEngine.generateAlerts — format & structure ─────────────────────────

describe('MedRec — generateAlerts()', () => {
    it('returns empty array for null reconciliation', () => {
        expect(MedRecEngine.generateAlerts(null, 'admission')).toEqual([]);
    });

    it('produces alerts with correct format (rule_code, domain, severity, title, effect, recommendation, matched_items)', () => {
        const reconciliation = {
            removed: [{ name: 'Aspirin', _normalizedName: 'aspirin' }],
            added: [{ name: 'Omeprazole', _normalizedName: 'omeprazole' }],
            changed: [],
        };
        const alerts = MedRecEngine.generateAlerts(reconciliation, 'admission');

        for (const alert of alerts) {
            expect(alert).toHaveProperty('rule_code');
            expect(alert).toHaveProperty('domain', 'med_reconciliation');
            expect(alert).toHaveProperty('severity');
            expect(alert).toHaveProperty('title');
            expect(alert).toHaveProperty('effect');
            expect(alert).toHaveProperty('recommendation');
            expect(alert).toHaveProperty('matched_items');
            expect(typeof alert.matched_items).toBe('object');
        }
    });

    it('generates MED-REC-OMISSION alert for removed drug', () => {
        const reconciliation = {
            removed: [{ name: 'Aspirin', _normalizedName: 'aspirin' }],
            added: [],
            changed: [],
        };
        const alerts = MedRecEngine.generateAlerts(reconciliation, 'discharge');
        const omission = alerts.find(a => a.rule_code === 'MED-REC-OMISSION');

        expect(omission).toBeDefined();
        expect(omission.severity).toBe('high');
        expect(omission.matched_items.drug).toEqual(['aspirin']);
    });

    it('generates MED-REC-NEW-UNINTENTIONAL for added drug', () => {
        const reconciliation = {
            removed: [],
            added: [{ name: 'Metformin', _normalizedName: 'metformin' }],
            changed: [],
        };
        const alerts = MedRecEngine.generateAlerts(reconciliation, 'admission');
        const newDrug = alerts.find(a => a.rule_code === 'MED-REC-NEW-UNINTENTIONAL');

        expect(newDrug).toBeDefined();
        expect(newDrug.severity).toBe('medium');
        expect(newDrug.matched_items.drug).toEqual(['metformin']);
    });

    it('generates MED-REC-DOSE-CHANGE for significant dose increase', () => {
        const reconciliation = {
            removed: [],
            added: [],
            changed: [{
                previous: { name: 'Atorvastatin', dose: '10mg' },
                current: { name: 'Atorvastatin', dose: '40mg' },
                _normalizedName: 'atorvastatin',
                changes: [{ field: 'dose', from: '10mg', to: '40mg' }],
            }],
        };
        const alerts = MedRecEngine.generateAlerts(reconciliation, 'transfer');
        const doseAlert = alerts.find(a => a.rule_code === 'MED-REC-DOSE-CHANGE');

        expect(doseAlert).toBeDefined();
        expect(doseAlert.severity).toBe('medium');
        expect(doseAlert.matched_items.dose_from).toEqual(['10mg']);
        expect(doseAlert.matched_items.dose_to).toEqual(['40mg']);
    });

    it('does NOT generate MED-REC-DOSE-CHANGE for insignificant dose change (<25%)', () => {
        const reconciliation = {
            removed: [],
            added: [],
            changed: [{
                previous: { name: 'Metformin', dose: '500mg' },
                current: { name: 'Metformin', dose: '550mg' },
                _normalizedName: 'metformin',
                changes: [{ field: 'dose', from: '500mg', to: '550mg' }],
            }],
        };
        const alerts = MedRecEngine.generateAlerts(reconciliation, 'admission');
        const doseAlert = alerts.find(a => a.rule_code === 'MED-REC-DOSE-CHANGE');

        expect(doseAlert).toBeUndefined();
    });

    it('does NOT generate MED-REC-DOSE-CHANGE when dose is not parseable', () => {
        const reconciliation = {
            removed: [],
            added: [],
            changed: [{
                previous: { name: 'DrugX', dose: 'as needed' },
                current: { name: 'DrugX', dose: 'twice daily' },
                _normalizedName: 'drugx',
                changes: [{ field: 'dose', from: 'as needed', to: 'twice daily' }],
            }],
        };
        const alerts = MedRecEngine.generateAlerts(reconciliation, 'admission');
        const doseAlert = alerts.find(a => a.rule_code === 'MED-REC-DOSE-CHANGE');

        expect(doseAlert).toBeUndefined();
    });
});

// ─── Integration: full reconcile → alert pipeline ─────────────────────────────

describe('MedRec — integration scenarios', () => {
    it('admission scenario: complex medication changes', () => {
        const previous = [
            med('Warfarin', '5mg', '1 lần/ngày', 'uống'),
            med('Metformin', '500mg', '2 lần/ngày', 'uống'),
            med('Amlodipine', '5mg', '1 lần/ngày', 'uống'),
        ];
        const current = [
            med('Metformin', '1000mg', '2 lần/ngày', 'uống'),  // dose ↑
            med('Amlodipine', '5mg', '1 lần/ngày', 'uống'),    // unchanged
            med('Omeprazole', '20mg', '1 lần/ngày', 'uống'),   // new
        ];

        const result = MedRecEngine.reconcile(previous, current, 'admission');

        expect(result.removed).toHaveLength(1);   // warfarin
        expect(result.added).toHaveLength(1);      // omeprazole
        expect(result.changed).toHaveLength(1);    // metformin dose
        expect(result.unchanged).toHaveLength(1);  // amlodipine

        // Alert types
        const codes = result.alerts.map(a => a.rule_code);
        expect(codes).toContain('MED-REC-OMISSION');           // warfarin removed
        expect(codes).toContain('MED-REC-HIGH-RISK-STOP');     // warfarin is anticoagulant
        expect(codes).toContain('MED-REC-NEW-UNINTENTIONAL');  // omeprazole added
        expect(codes).toContain('MED-REC-DOSE-CHANGE');        // metformin 500→1000
    });

    it('discharge scenario: all drugs continued', () => {
        const meds = [
            med('Aspirin', '81mg'),
            med('Lisinopril', '10mg'),
        ];
        const result = MedRecEngine.reconcile(meds, meds, 'discharge');

        expect(result.unchanged).toHaveLength(2);
        expect(result.alerts).toHaveLength(0);
    });

    it('transfer scenario: multiple high-risk drugs stopped', () => {
        const previous = [
            med('Warfarin', '5mg'),
            med('Phenytoin', '100mg'),
            med('Insulin', '10IU'),
        ];
        const result = MedRecEngine.reconcile(previous, [], 'transfer');

        const hrAlerts = result.alerts.filter(a => a.rule_code === 'MED-REC-HIGH-RISK-STOP');
        expect(hrAlerts).toHaveLength(3);

        const categories = hrAlerts.flatMap(a => a.matched_items.category);
        expect(categories).toContain('anticoagulants');
        expect(categories).toContain('antiepileptics');
        expect(categories).toContain('insulins');
    });

    it('all alert objects have valid domain and matched_items', () => {
        const result = MedRecEngine.reconcile(
            [med('Warfarin'), med('Aspirin')],
            [med('Omeprazole', '40mg')],
            'admission',
        );

        for (const alert of result.alerts) {
            expect(alert.domain).toBe('med_reconciliation');
            expect(alert.matched_items).toBeDefined();
            expect(Array.isArray(alert.matched_items.drug)).toBe(true);
        }
    });
});
