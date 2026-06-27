/**
 * 🧪 Dosage Intelligence Engine Tests
 * Covers: Max dose, geriatric dose, Beers criteria, TDM reminders, integration, edge cases
 *
 * @vitest-environment jsdom
 */
import { describe, expect, it } from 'vitest';
import {
    DosageAlertEngine,
    DOSAGE_LIMITS,
    BEERS_LIST,
    TDM_DRUGS,
    checkMaxDose,
    checkGeriatricAlerts,
    checkTdmReminders,
    runDosageAlerts,
} from '../../content/cds/dosage-alerts.js';

// =====================================================
// Helper: create a medication object
// =====================================================
function makeMed(overrides) {
    return {
        name: 'test drug',
        genericName: 'test',
        dose: 500,
        frequency: 2,
        route: 'oral',
        dailyDose: null,
        ...overrides,
    };
}

// =====================================================
// checkMaxDose
// =====================================================
describe('Dosage Intelligence — checkMaxDose', () => {
    it('should flag Paracetamol > 4000 mg/day', () => {
        const meds = [
            makeMed({ genericName: 'paracetamol', dose: 1000, frequency: 5, dailyDose: 5000 }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DOSE-MAX-EXCEEDED-PARACETAMOL');
        expect(alerts[0].domain).toBe('dosage');
        expect(alerts[0].severity).toBe('high');
        expect(alerts[0].matched_items.dailyDose).toBe(5000);
    });

    it('should flag Paracetamol calculated dose (dose * frequency) when dailyDose is absent', () => {
        const meds = [
            makeMed({ genericName: 'paracetamol', dose: 1000, frequency: 5, dailyDose: null }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DOSE-MAX-EXCEEDED-PARACETAMOL');
        expect(alerts[0].matched_items.dailyDose).toBe(5000);
    });

    it('should NOT flag normal Paracetamol dose', () => {
        const meds = [
            makeMed({ genericName: 'paracetamol', dose: 500, frequency: 4, dailyDose: 2000 }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS);
        expect(alerts).toHaveLength(0);
    });

    it('should NOT flag dose exactly at max', () => {
        const meds = [
            makeMed({ genericName: 'paracetamol', dose: 1000, frequency: 4, dailyDose: 4000 }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS);
        expect(alerts).toHaveLength(0);
    });

    it('should flag geriatric max for Paracetamol in elderly', () => {
        const meds = [
            makeMed({ genericName: 'paracetamol', dose: 500, frequency: 6, dailyDose: 3000 }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS, 72);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DOSE-GERIATRIC-MAX-PARACETAMOL');
        expect(alerts[0].domain).toBe('geriatric');
        expect(alerts[0].matched_items.geriatricMax).toBe(2000);
    });

    it('should flag geriatric max for Digoxin in elderly', () => {
        const meds = [
            makeMed({ genericName: 'digoxin', dose: 0.25, frequency: 1, dailyDose: 0.25 }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS, 68);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DOSE-GERIATRIC-MAX-DIGOXIN');
        expect(alerts[0].matched_items.geriatricMax).toBe(0.125);
    });

    it('should flag Warfarin > 10 mg/day', () => {
        const meds = [
            makeMed({ genericName: 'warfarin', dose: 12, frequency: 1, dailyDose: 12 }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DOSE-MAX-EXCEEDED-WARFARIN');
    });

    it('should flag Morphine > 200 mg/day', () => {
        const meds = [
            makeMed({ genericName: 'morphine', dose: 60, frequency: 4, dailyDose: 240 }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DOSE-MAX-EXCEEDED-MORPHINE');
    });

    it('should handle unknown drugs gracefully', () => {
        const meds = [
            makeMed({ genericName: 'unknowndrug', dose: 99999, frequency: 10 }),
        ];
        const alerts = checkMaxDose(meds, DOSAGE_LIMITS);
        expect(alerts).toHaveLength(0);
    });

    it('should return empty array for empty medications', () => {
        expect(checkMaxDose([], DOSAGE_LIMITS)).toEqual([]);
    });

    it('should return empty array for null/undefined input', () => {
        expect(checkMaxDose(null, DOSAGE_LIMITS)).toEqual([]);
        expect(checkMaxDose(undefined, DOSAGE_LIMITS)).toEqual([]);
    });
});

// =====================================================
// checkGeriatricAlerts (Beers Criteria)
// =====================================================
describe('Dosage Intelligence — checkGeriatricAlerts (Beers)', () => {
    it('should flag diazepam for 70yo patient', () => {
        const meds = [
            makeMed({ genericName: 'diazepam', dose: 5, frequency: 2 }),
        ];
        const alerts = checkGeriatricAlerts(meds, 70);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('BEERS-DIAZEPAM');
        expect(alerts[0].domain).toBe('geriatric');
        expect(alerts[0].severity).toBe('high');
        expect(alerts[0].matched_items.category).toBe('benzodiazepine');
    });

    it('should flag multiple Beers drugs for elderly', () => {
        const meds = [
            makeMed({ genericName: 'diazepam', dose: 5, frequency: 2 }),
            makeMed({ genericName: 'diphenhydramine', dose: 25, frequency: 3 }),
            makeMed({ genericName: 'amitriptyline', dose: 25, frequency: 1 }),
        ];
        const alerts = checkGeriatricAlerts(meds, 80);
        expect(alerts).toHaveLength(3);
        expect(alerts.map(a => a.rule_code)).toEqual(
            expect.arrayContaining(['BEERS-DIAZEPAM', 'BEERS-DIPHENHYDRAMINE', 'BEERS-AMITRIPTYLINE']),
        );
    });

    it('should flag antipsychotic as critical severity', () => {
        const meds = [
            makeMed({ genericName: 'haloperidol', dose: 2, frequency: 1 }),
        ];
        const alerts = checkGeriatricAlerts(meds, 75);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].severity).toBe('critical');
    });

    it('should NOT flag diazepam for 40yo patient', () => {
        const meds = [
            makeMed({ genericName: 'diazepam', dose: 5, frequency: 2 }),
        ];
        const alerts = checkGeriatricAlerts(meds, 40);
        expect(alerts).toHaveLength(0);
    });

    it('should NOT flag for patient exactly at threshold (64yo)', () => {
        const meds = [
            makeMed({ genericName: 'diazepam', dose: 5, frequency: 2 }),
        ];
        const alerts = checkGeriatricAlerts(meds, 64);
        expect(alerts).toHaveLength(0);
    });

    it('should flag for patient exactly at threshold (65yo)', () => {
        const meds = [
            makeMed({ genericName: 'ibuprofen', dose: 400, frequency: 3 }),
        ];
        const alerts = checkGeriatricAlerts(meds, 65);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('BEERS-IBUPROFEN');
    });

    it('should NOT flag non-Beers drugs for elderly', () => {
        const meds = [
            makeMed({ genericName: 'paracetamol', dose: 500, frequency: 3 }),
            makeMed({ genericName: 'metformin', dose: 500, frequency: 2 }),
        ];
        const alerts = checkGeriatricAlerts(meds, 75);
        expect(alerts).toHaveLength(0);
    });

    it('should return empty array for null inputs', () => {
        expect(checkGeriatricAlerts(null, 70)).toEqual([]);
        expect(checkGeriatricAlerts([], null)).toEqual([]);
    });
});

// =====================================================
// checkTdmReminders
// =====================================================
describe('Dosage Intelligence — checkTdmReminders (TDM)', () => {
    it('should fire reminder for Vancomycin without TDM lab', () => {
        const meds = [
            makeMed({ genericName: 'vancomycin', dose: 1000, frequency: 2 }),
        ];
        const labs = [
            { code: 'creatinine', value: 1.2, unit: 'mg/dL' },
        ];
        const alerts = checkTdmReminders(meds, labs);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('TDM-REMINDER-VANCOMYCIN');
        expect(alerts[0].domain).toBe('tdm');
        expect(alerts[0].severity).toBe('medium');
        expect(alerts[0].matched_items.labCode).toBe('vancomycin_trough');
    });

    it('should NOT fire reminder when TDM lab exists', () => {
        const meds = [
            makeMed({ genericName: 'vancomycin', dose: 1000, frequency: 2 }),
        ];
        const labs = [
            { code: 'vancomycin_trough', value: 15, unit: 'mcg/mL' },
        ];
        const alerts = checkTdmReminders(meds, labs);
        expect(alerts).toHaveLength(0);
    });

    it('should fire reminder for Digoxin without digoxin_level lab', () => {
        const meds = [
            makeMed({ genericName: 'digoxin', dose: 0.125, frequency: 1 }),
        ];
        const alerts = checkTdmReminders(meds, []);
        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('TDM-REMINDER-DIGOXIN');
    });

    it('should NOT fire for non-TDM drugs', () => {
        const meds = [
            makeMed({ genericName: 'metformin', dose: 500, frequency: 2 }),
        ];
        const alerts = checkTdmReminders(meds, []);
        expect(alerts).toHaveLength(0);
    });

    it('should fire multiple TDM reminders for multiple TDM drugs', () => {
        const meds = [
            makeMed({ genericName: 'vancomycin', dose: 1000, frequency: 2 }),
            makeMed({ genericName: 'phenytoin', dose: 100, frequency: 3 }),
            makeMed({ genericName: 'lithium', dose: 300, frequency: 3 }),
        ];
        const alerts = checkTdmReminders(meds, []);
        expect(alerts).toHaveLength(3);
        expect(alerts.map(a => a.rule_code)).toEqual(
            expect.arrayContaining([
                'TDM-REMINDER-VANCOMYCIN',
                'TDM-REMINDER-PHENYTOIN',
                'TDM-REMINDER-LITHIUM',
            ]),
        );
    });

    it('should handle null labs gracefully', () => {
        const meds = [
            makeMed({ genericName: 'vancomycin', dose: 1000, frequency: 2 }),
        ];
        const alerts = checkTdmReminders(meds, null);
        expect(alerts).toHaveLength(1);
    });

    it('should return empty array for empty medications', () => {
        expect(checkTdmReminders([], [])).toEqual([]);
    });

    it('should return empty array for null medications', () => {
        expect(checkTdmReminders(null, [])).toEqual([]);
    });
});

// =====================================================
// runDosageAlerts (integration)
// =====================================================
describe('Dosage Intelligence — runDosageAlerts (integration)', () => {
    it('should combine dosage, geriatric, and TDM alerts for elderly patient', () => {
        const context = {
            patient: { age: 72 },
            medications: [
                makeMed({ genericName: 'paracetamol', dose: 1000, frequency: 5, dailyDose: 5000 }),
                makeMed({ genericName: 'diazepam', dose: 5, frequency: 3 }),
                makeMed({ genericName: 'vancomycin', dose: 1000, frequency: 2 }),
            ],
            labs: [],
        };
        const alerts = runDosageAlerts(context);

        // Paracetamol: geriatric max exceeded (5000 > 2000)
        const paracetamolAlert = alerts.find(a => a.rule_code === 'DOSE-GERIATRIC-MAX-PARACETAMOL');
        expect(paracetamolAlert).toBeDefined();
        expect(paracetamolAlert.domain).toBe('geriatric');

        // Diazepam: Beers criteria
        const beersAlert = alerts.find(a => a.rule_code === 'BEERS-DIAZEPAM');
        expect(beersAlert).toBeDefined();

        // Vancomycin: TDM reminder
        const tdmAlert = alerts.find(a => a.rule_code === 'TDM-REMINDER-VANCOMYCIN');
        expect(tdmAlert).toBeDefined();

        expect(alerts.length).toBeGreaterThanOrEqual(3);
    });

    it('should return no alerts for safe context', () => {
        const context = {
            patient: { age: 35 },
            medications: [
                makeMed({ genericName: 'paracetamol', dose: 500, frequency: 3, dailyDose: 1500 }),
                makeMed({ genericName: 'metformin', dose: 500, frequency: 2, dailyDose: 1000 }),
            ],
            labs: [],
        };
        const alerts = runDosageAlerts(context);
        expect(alerts).toHaveLength(0);
    });

    it('should return empty array for null context', () => {
        expect(runDosageAlerts(null)).toEqual([]);
    });

    it('should return empty array for context with no medications', () => {
        expect(runDosageAlerts({ patient: { age: 50 }, medications: [] })).toEqual([]);
    });

    it('should return empty array for context with missing medications key', () => {
        expect(runDosageAlerts({ patient: { age: 50 } })).toEqual([]);
    });
});

// =====================================================
// Data integrity checks
// =====================================================
describe('Dosage Intelligence — data integrity', () => {
    it('DOSAGE_LIMITS should have at least 20 entries', () => {
        expect(Object.keys(DOSAGE_LIMITS).length).toBeGreaterThanOrEqual(20);
    });

    it('BEERS_LIST should have entries with required fields', () => {
        for (const entry of BEERS_LIST) {
            expect(entry).toHaveProperty('genericName');
            expect(entry).toHaveProperty('category');
            expect(entry).toHaveProperty('reason');
        }
    });

    it('TDM_DRUGS should have entries with required fields', () => {
        for (const entry of TDM_DRUGS) {
            expect(entry).toHaveProperty('genericName');
            expect(entry).toHaveProperty('labCode');
            expect(entry).toHaveProperty('therapeuticRange');
            expect(entry).toHaveProperty('reason');
        }
    });

    it('DosageAlertEngine should expose all public API', () => {
        expect(DosageAlertEngine.DOSAGE_LIMITS).toBe(DOSAGE_LIMITS);
        expect(DosageAlertEngine.BEERS_LIST).toBe(BEERS_LIST);
        expect(DosageAlertEngine.TDM_DRUGS).toBe(TDM_DRUGS);
        expect(typeof DosageAlertEngine.runDosageAlerts).toBe('function');
        expect(typeof DosageAlertEngine.checkMaxDose).toBe('function');
        expect(typeof DosageAlertEngine.checkGeriatricAlerts).toBe('function');
        expect(typeof DosageAlertEngine.checkTdmReminders).toBe('function');
    });

    it('DOSAGE_LIMITS should be frozen (immutable)', () => {
        expect(Object.isFrozen(DOSAGE_LIMITS)).toBe(true);
    });

    it('BEERS_LIST should be frozen (immutable)', () => {
        expect(Object.isFrozen(BEERS_LIST)).toBe(true);
    });

    it('TDM_DRUGS should be frozen (immutable)', () => {
        expect(Object.isFrozen(TDM_DRUGS)).toBe(true);
    });
});

// =====================================================
// Alert format compliance
// =====================================================
describe('Dosage Intelligence — alert format compliance', () => {
    it('all alerts should match engine.js format', () => {
        const context = {
            patient: { age: 72 },
            medications: [
                makeMed({ genericName: 'paracetamol', dose: 1000, frequency: 5, dailyDose: 5000 }),
                makeMed({ genericName: 'diazepam', dose: 5, frequency: 3 }),
                makeMed({ genericName: 'vancomycin', dose: 1000, frequency: 2 }),
            ],
            labs: [],
        };
        const alerts = runDosageAlerts(context);
        for (const alert of alerts) {
            expect(alert).toHaveProperty('rule_code');
            expect(alert).toHaveProperty('domain');
            expect(alert).toHaveProperty('severity');
            expect(alert).toHaveProperty('title');
            expect(alert).toHaveProperty('effect');
            expect(alert).toHaveProperty('recommendation');
            expect(alert).toHaveProperty('matched_items');
            expect(typeof alert.rule_code).toBe('string');
            expect(typeof alert.domain).toBe('string');
            expect(['low', 'medium', 'high', 'critical']).toContain(alert.severity);
        }
    });
});
