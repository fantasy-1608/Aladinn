import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
    getCreatinineMgDl,
    calculateCockcroftGault,
    calculateCkdEpi,
    injectCalculatedEgfr
} from '../../content/cds/egfr-alerts.js';
import { analyzeLocally } from '../../content/cds/engine.js';
import * as dbUtils from '../../content/cds/db.js';

vi.mock('../../content/cds/db.js', () => ({
    openDatabase: vi.fn().mockResolvedValue({}),
    getDrugGenericMap: vi.fn(),
    getBrandMap: vi.fn(),
    getConditionGroupMappings: vi.fn(),
    getDdiRules: vi.fn(),
    getDrugDiseaseRules: vi.fn(),
    getInsuranceFormulary: vi.fn(),
    getInsuranceRules: vi.fn(),
    getRenalAdjustmentRules: vi.fn(),
    getDrugLabRules: vi.fn()
}));

describe('Proactive CDS & eGFR Alerts', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('eGFR Calculations', () => {
        describe('getCreatinineMgDl', () => {
            it('should auto-detect micromoles/L based on threshold (>15)', () => {
                // 88.4 umol/L = 1.0 mg/dL
                expect(getCreatinineMgDl(88.4)).toBeCloseTo(1.0, 2);
                expect(getCreatinineMgDl(176.8)).toBeCloseTo(2.0, 2);
            });

            it('should convert based on unit string matching case-insensitively', () => {
                expect(getCreatinineMgDl(88.4, 'μmol/L')).toBeCloseTo(1.0, 2);
                expect(getCreatinineMgDl(88.4, 'Umol/L')).toBeCloseTo(1.0, 2);
                expect(getCreatinineMgDl(88.4, 'micromol/l')).toBeCloseTo(1.0, 2);
            });

            it('should preserve mg/dL values', () => {
                expect(getCreatinineMgDl(1.2, 'mg/dL')).toBe(1.2);
                expect(getCreatinineMgDl(0.8, 'mg/dl')).toBe(0.8);
                // Under threshold and no unit
                expect(getCreatinineMgDl(1.2)).toBe(1.2);
            });

            it('should handle zero or negative input gracefully', () => {
                expect(getCreatinineMgDl(0)).toBe(0);
                expect(getCreatinineMgDl(-5)).toBe(0);
                expect(getCreatinineMgDl(null)).toBe(0);
            });
        });

        describe('calculateCockcroftGault', () => {
            it('should calculate correct eGFR for a Male', () => {
                // eGFR = ((140 - Age) * Weight) / (72 * Creatinine mg/dL)
                // Age 60, Weight 72, Creatinine 1.0 mg/dL
                // ((140 - 60) * 72) / (72 * 1.0) = (80 * 72) / 72 = 80.00
                const egfr = calculateCockcroftGault(60, 'Nam', 72, 1.0);
                expect(egfr).toBe(80.00);
            });

            it('should calculate correct eGFR for a Female (multiplied by 0.85)', () => {
                // Age 60, Weight 72, Creatinine 1.0 mg/dL, Female
                // 80.00 * 0.85 = 68.00
                const egfr = calculateCockcroftGault(60, 'Nữ', 72, 1.0);
                expect(egfr).toBe(68.00);
            });

            it('should handle alternative gender keywords case-insensitively', () => {
                expect(calculateCockcroftGault(60, 'female', 72, 1.0)).toBe(68.00);
                expect(calculateCockcroftGault(60, 'F', 72, 1.0)).toBe(68.00);
                expect(calculateCockcroftGault(60, 'nam', 72, 1.0)).toBe(80.00);
                expect(calculateCockcroftGault(60, 'M', 72, 1.0)).toBe(80.00);
            });

            it('should return null on missing or invalid inputs', () => {
                expect(calculateCockcroftGault(null, 'Nam', 72, 1.0)).toBeNull();
                expect(calculateCockcroftGault(60, 'Nam', null, 1.0)).toBeNull();
                expect(calculateCockcroftGault(60, 'Nam', 72, 0)).toBeNull();
                expect(calculateCockcroftGault(60, 'Nam', 72, -1)).toBeNull();
            });
        });

        describe('calculateCkdEpi (2021)', () => {
            it('should calculate correct eGFR for a Male', () => {
                // Male, age 60, Scr 2.0 mg/dL
                // kappa = 0.9, alpha = -0.302, genderCoeff = 1.0
                // scrOverKappa = 2.0 / 0.9 = 2.2222
                // minTerm = min(2.2222, 1)^-0.302 = 1.0000
                // maxTerm = max(2.2222, 1)^-1.2 = 2.2222^-1.2 = 0.3813
                // ageTerm = 0.9938^60 = 0.6888
                // egfr = 142 * 1 * 0.3813 * 0.6888 * 1.0 = 37.29 mL/min/1.73m2
                const egfr = calculateCkdEpi(60, 'Nam', 2.0);
                expect(egfr).toBeCloseTo(37.5, 1);
            });

            it('should calculate correct eGFR for a Female', () => {
                // Female, age 50, Scr 1.2 mg/dL
                // kappa = 0.7, alpha = -0.241, genderCoeff = 1.012
                // scrOverKappa = 1.2 / 0.7 = 1.7143
                // minTerm = 1.0
                // maxTerm = 1.7143^-1.2 = 0.5219
                // ageTerm = 0.9938^50 = 0.7330
                // egfr = 142 * 1 * 0.5219 * 0.7330 * 1.012 = 54.91 mL/min/1.73m2
                const egfr = calculateCkdEpi(50, 'Nữ', 1.2);
                expect(egfr).toBeCloseTo(55.15, 1);
            });

            it('should return null on missing or invalid inputs', () => {
                expect(calculateCkdEpi(null, 'Nam', 1.0)).toBeNull();
                expect(calculateCkdEpi(60, 'Nam', 0)).toBeNull();
                expect(calculateCkdEpi(60, 'Nam', -0.5)).toBeNull();
            });
        });
    });

    describe('Immutability of context payloads', () => {
        it('should perform immutable updates and not modify the original context object', () => {
            const context = {
                patient: {
                    id: 'BN123',
                    name: 'Nguyen Van A',
                    gender: 'Nam',
                    age: 60,
                    weight: 70
                },
                encounter: {
                    id: 'KB456',
                    diagnoses: [{ code: 'I10' }]
                },
                insurance: {
                    is_insured: true
                },
                medications: [{ display_name: 'Paracetamol' }],
                labs: [{ code: 'creatinine', value: 176.8, unit: 'μmol/L' }]
            };

            // Deep freeze is simulated by checking references after execution
            const enriched = injectCalculatedEgfr(context);

            expect(enriched).not.toBe(context);
            expect(enriched.labs).not.toBe(context.labs);
            expect(enriched.medications).not.toBe(context.medications);
            expect(enriched.patient).not.toBe(context.patient);
            expect(enriched.encounter).not.toBe(context.encounter);
            expect(enriched.insurance).not.toBe(context.insurance);

            // Verify original labs is unmodified
            expect(context.labs).toHaveLength(1);
            expect(context.labs[0].code).toBe('creatinine');

            // Verify enriched labs has eGFR and eGFR_CG
            expect(enriched.labs).toHaveLength(3);
            const egfrLab = enriched.labs.find(l => l.code === 'eGFR');
            const egfrCGLab = enriched.labs.find(l => l.code === 'eGFR_CG');
            expect(egfrLab).toBeDefined();
            expect(egfrCGLab).toBeDefined();

            // eGFR (CKD-EPI) for Male, 60, Scr 2.0 mg/dL (176.8 umol/L) is ~37.5
            expect(egfrLab.value).toBeCloseTo(37.5, 1);
            // eGFR_CG (Cockcroft-Gault) Male, 60, 70kg, 2.0 mg/dL is ((140-60)*70)/(72*2) = 38.89
            expect(egfrCGLab.value).toBeCloseTo(38.89, 1);
        });

        it('should bypass calculations if eGFR is already provided in the context labs', () => {
            const context = {
                patient: { id: 'BN123', gender: 'Nam', age: 60, weight: 70 },
                encounter: { id: 'KB456', diagnoses: [] },
                insurance: { is_insured: true },
                medications: [],
                labs: [
                    { code: 'creatinine', value: 2.0, unit: 'mg/dL' },
                    { code: 'eGFR', value: 42, unit: 'mL/min' }
                ]
            };

            const enriched = injectCalculatedEgfr(context);
            expect(enriched).toBe(context); // returned original context unchanged
        });
    });

    describe('Proactive Keystroke Alert Triggering', () => {
        it('should successfully trigger a renal adjustment alert when a risky drug is keyed in proactively', async () => {
            // Setup IndexedDB mocks
            dbUtils.getDrugGenericMap.mockResolvedValue(new Map([
                ['metformin', { generic_name: 'metformin', pharmacologic_class: 'Biguanide' }],
                ['paracetamol', { generic_name: 'paracetamol', pharmacologic_class: 'Analgesic' }]
            ]));
            dbUtils.getBrandMap.mockResolvedValue(new Map([
                ['glucomin', { generic_name: 'metformin' }]
            ]));
            dbUtils.getConditionGroupMappings.mockResolvedValue([]);
            dbUtils.getDdiRules.mockResolvedValue([]);
            dbUtils.getDrugDiseaseRules.mockResolvedValue([]);
            dbUtils.getInsuranceFormulary.mockResolvedValue([]);
            dbUtils.getInsuranceRules.mockResolvedValue([]);
            
            // Metformin contraindicated below eGFR 45
            dbUtils.getRenalAdjustmentRules.mockResolvedValue([
                {
                    is_active: 1,
                    generic_name: 'metformin',
                    egfr_threshold: 45,
                    operator: '<',
                    severity: 'high',
                    rationale: 'Chống chỉ định Metformin khi eGFR < 45 mL/phút',
                    recommendation: 'Chuyển sang điều trị Insulin hoặc thuốc khác',
                    rule_code: 'RENAL-METFORMIN-45'
                }
            ]);
            dbUtils.getDrugLabRules.mockResolvedValue([]);

            // Context representing a patient with renal impairment (creatinine 176.8 umol/L -> 2.0 mg/dL -> eGFR < 45)
            // Medications has a proactive drug representing the dynamic typing state
            const context = {
                patient: {
                    id: 'BN123',
                    name: 'Nguyen Van A',
                    gender: 'Nam',
                    age: 60,
                    weight: 70
                },
                encounter: {
                    id: 'KB456',
                    diagnoses: [{ code: 'I10' }] // Diagnosis of Hypertension
                },
                insurance: { is_insured: true },
                medications: [
                    {
                        display_name: 'Glucomin', // Metformin brand name being typed proactively
                        generic_candidate: null,
                        is_proactive: true
                    }
                ],
                labs: [{ code: 'creatinine', value: 176.8, unit: 'μmol/L' }]
            };

            const result = await analyzeLocally(context);
            expect(result.alerts).toHaveLength(1);
            
            const renalAlert = result.alerts[0];
            expect(renalAlert.domain).toBe('renal');
            expect(renalAlert.severity).toBe('high');
            expect(renalAlert.rule_code).toBe('RENAL-METFORMIN-45');
            expect(renalAlert.effect).toContain('eGFR = 37.5 mL/phút');
            expect(renalAlert.recommendation).toBe('Chuyển sang điều trị Insulin hoặc thuốc khác');
        });
    });
});
