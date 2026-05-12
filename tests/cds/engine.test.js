import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeContext, icdMatchesRequirement, analyzeLocally, runBhytAuditRules } from '../../content/cds/engine.js';
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

describe('CDS Engine', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        dbUtils.getDrugGenericMap.mockResolvedValue(new Map([
            ['amoxicillin', { generic_name: 'amoxicillin', pharmacologic_class: 'Penicillin' }],
            ['clavulanate', { generic_name: 'clavulanate', pharmacologic_class: 'Beta-lactamase inhibitor' }],
            ['amoxicillin-clavulanate', { generic_name: 'amoxicillin-clavulanate', pharmacologic_class: 'Penicillin' }],
            ['paracetamol', { generic_name: 'paracetamol', pharmacologic_class: 'Analgesic' }],
            ['ibuprofen', { generic_name: 'ibuprofen', pharmacologic_class: 'NSAID' }],
            ['diclofenac', { generic_name: 'diclofenac', pharmacologic_class: 'NSAID' }],
            ['trimetazidine', { generic_name: 'trimetazidine', pharmacologic_class: 'Anti-anginal' }],
            ['insulin', { generic_name: 'insulin', pharmacologic_class: 'Antidiabetic' }]
        ]));
        dbUtils.getBrandMap.mockResolvedValue(new Map([
            ['augmentin', { generic_name: 'amoxicillin-clavulanate' }],
            ['efferalgan', { generic_name: 'paracetamol' }],
            ['vastarel', { generic_name: 'trimetazidine' }]
        ]));
        dbUtils.getConditionGroupMappings.mockResolvedValue([
            { icd_prefix: 'J01', condition_group_code: 'RESP_INFECTION' },
            { icd_prefix: 'K25', condition_group_code: 'PEPTIC_ULCER' },
            { icd_prefix: 'G20', condition_group_code: 'PARKINSON' },
            { icd_prefix: 'E11', condition_group_code: 'DIABETES' }
        ]);
        dbUtils.getDdiRules.mockResolvedValue([
            { is_active: 1, generic_a: 'ibuprofen', generic_b: 'diclofenac', severity: 'high', clinical_effect: 'Tăng nguy cơ chảy máu dạ dày', rule_code: 'DDI-NSAID-DUP' }
        ]);
        dbUtils.getDrugDiseaseRules.mockResolvedValue([
            { is_active: 1, generic_name: 'ibuprofen', condition_group_code: 'PEPTIC_ULCER', severity: 'high', rule_code: 'DX-NSAID-ULCER', rationale: 'Gây xuất huyết tiêu hóa' }
        ]);
        dbUtils.getInsuranceFormulary.mockResolvedValue([]);
        dbUtils.getInsuranceRules.mockResolvedValue([]);
        dbUtils.getRenalAdjustmentRules.mockResolvedValue([]);
        dbUtils.getDrugLabRules.mockResolvedValue([]);
    });

    describe('icdMatchesRequirement', () => {
        it('should correctly match prefix', () => {
            expect(icdMatchesRequirement('E11.9', 'E11')).toBe(true);
            expect(icdMatchesRequirement('E11', 'E11')).toBe(true);
            expect(icdMatchesRequirement('E10.1', 'E11')).toBe(false);
        });

        it('should correctly match range', () => {
            expect(icdMatchesRequirement('E11.9', 'E10-E14')).toBe(true);
            expect(icdMatchesRequirement('E14', 'E10-E14')).toBe(true);
            expect(icdMatchesRequirement('E09', 'E10-E14')).toBe(false);
        });
    });

    describe('normalizeContext', () => {
        it('should normalize drugs using aliases and brand map', async () => {
            const context = {
                medications: [
                    { display_name: 'Augmentin 1g' },
                    { display_name: 'Efferalgan 500mg' },
                    { display_name: 'Acetaminophen viên' }, // mapped via ALIAS_MAP
                    { display_name: 'UnknownDrug' }
                ],
                encounter: { diagnoses: [] }
            };

            const result = await normalizeContext(context);
            expect(result.normalized_drugs).toContain('amoxicillin-clavulanate');
            expect(result.normalized_drugs).toContain('paracetamol');
            expect(result.unmapped_drugs).toContain('UnknownDrug');
        });

        it('should extract condition groups from ICD codes', async () => {
            const context = {
                medications: [],
                encounter: { diagnoses: [{ code: 'J01.9' }, { code: 'K25.1' }] }
            };

            const result = await normalizeContext(context);
            expect(result.condition_groups).toContain('RESP_INFECTION');
            expect(result.condition_groups).toContain('PEPTIC_ULCER');
        });
    });

    describe('analyzeLocally', () => {
        it('should generate alert for DDI (Ibuprofen + Diclofenac)', async () => {
            const context = {
                medications: [
                    { display_name: 'Ibuprofen' },
                    { display_name: 'Diclofenac' }
                ],
                encounter: { diagnoses: [{ code: 'M10' }] }
            };

            const result = await analyzeLocally(context);
            const ddiAlert = result.alerts.find(a => a.domain === 'interaction');
            expect(ddiAlert).toBeDefined();
            expect(ddiAlert.rule_code).toBe('DDI-NSAID-DUP');
        });

        it('should generate alert for Drug-Disease interaction', async () => {
            const context = {
                medications: [{ display_name: 'Ibuprofen' }],
                encounter: { diagnoses: [{ code: 'K25.9' }] } // Maps to PEPTIC_ULCER
            };

            const result = await analyzeLocally(context);
            const dxAlert = result.alerts.find(a => a.domain === 'drug_disease');
            expect(dxAlert).toBeDefined();
            expect(dxAlert.rule_code).toBe('DX-NSAID-ULCER');
        });

        it('should warn if medications exist but no diagnosis is provided', async () => {
            const context = {
                medications: [{ display_name: 'Paracetamol' }],
                encounter: { diagnoses: [] }
            };

            const result = await analyzeLocally(context);
            const warnAlert = result.alerts.find(a => a.rule_code === 'WARN-NO-DIAGNOSIS');
            expect(warnAlert).toBeDefined();
            expect(warnAlert.severity).toBe('high');
        });

        it('should detect duplicate therapy', async () => {
            const context = {
                medications: [
                    { display_name: 'Ibuprofen' },
                    { display_name: 'Diclofenac' }
                ],
                encounter: { diagnoses: [{ code: 'M10' }] }
            };

            const result = await analyzeLocally(context);
            const dupAlert = result.alerts.find(a => a.domain === 'duplicate_therapy');
            expect(dupAlert).toBeDefined();
            expect(dupAlert.rule_code).toBe('DUP-THERAPY-NSAID-001');
        });
    });

    describe('runBhytAuditRules', () => {
        it('should detect Trimetazidine + Parkinson contraindicated', async () => {
            const context = {
                medications: [{ display_name: 'Vastarel' }], // trimetazidine
                encounter: { diagnoses: [{ code: 'G20' }] } // Parkinson
            };

            const result = await runBhytAuditRules(context);
            const alert = result.alerts.find(a => a.rule_code === 'BHYT-AUDIT-TRIMETAZIDINE-PARKINSON');
            expect(alert).toBeDefined();
            expect(alert.severity).toBe('high');
        });

        it('should detect Z code with medications', async () => {
            const context = {
                medications: [{ display_name: 'Paracetamol' }],
                encounter: { diagnoses: [{ code: 'Z00.0' }] } 
            };

            const result = await runBhytAuditRules(context);
            const alert = result.alerts.find(a => a.rule_code === 'BHYT-AUDIT-Z-CODE');
            expect(alert).toBeDefined();
        });

        it('should detect Insulin without Diabetes ICD', async () => {
            const context = {
                medications: [{ display_name: 'Insulin' }],
                encounter: { diagnoses: [{ code: 'I10' }] } 
            };

            const result = await runBhytAuditRules(context);
            const alert = result.alerts.find(a => a.rule_code === 'BHYT-AUDIT-INSULIN-NO-DM');
            expect(alert).toBeDefined();
        });
    });
});
