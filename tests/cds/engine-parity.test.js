import { describe, it, expect, vi, beforeEach } from 'vitest';
import { analyzeLocally, normalizeContext, setFeatureFlags } from '../../content/cds/engine.js';
import * as dbUtils from '../../content/cds/db.js';
import { runtimeRuleIndex } from '../../content/cds/runtime-rule-index.js';
import { normalizationCache } from '../../content/cds/normalization-cache.js';

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

describe('CDS Engine Dual-Engine Golden Parity Tests', () => {
    beforeEach(async () => {
        vi.clearAllMocks();
        normalizationCache.clear();

        // Mock static data
        dbUtils.getDrugGenericMap.mockResolvedValue(new Map([
            ['amoxicillin', { generic_name: 'amoxicillin', pharmacologic_class: 'Penicillin' }],
            ['clavulanate', { generic_name: 'clavulanate', pharmacologic_class: 'Beta-lactamase inhibitor' }],
            ['amoxicillin-clavulanate', { generic_name: 'amoxicillin-clavulanate', pharmacologic_class: 'Penicillin' }],
            ['paracetamol', { generic_name: 'paracetamol', pharmacologic_class: 'Analgesic' }],
            ['ibuprofen', { generic_name: 'ibuprofen', pharmacologic_class: 'NSAID' }],
            ['diclofenac', { generic_name: 'diclofenac', pharmacologic_class: 'NSAID' }],
            ['trimetazidine', { generic_name: 'trimetazidine', pharmacologic_class: 'Anti-anginal' }],
            ['metformin', { generic_name: 'metformin', pharmacologic_class: 'Biguanide' }],
            ['contrast', { generic_name: 'contrast', pharmacologic_class: 'Radiocontrast' }]
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
            { is_active: 1, generic_a: 'ibuprofen', generic_b: 'diclofenac', severity: 'high', clinical_effect: 'Tăng nguy cơ chảy máu dạ dày', rule_code: 'DDI-NSAID-DUP', recommendation: 'Cân nhắc ngưng một thuốc' }
        ]);

        dbUtils.getDrugDiseaseRules.mockResolvedValue([
            { is_active: 1, generic_name: 'ibuprofen', condition_group_code: 'PEPTIC_ULCER', severity: 'high', rule_code: 'DX-NSAID-ULCER', rationale: 'Gây xuất huyết tiêu hóa', recommendation: 'Tránh dùng' },
            { is_active: 1, generic_name: 'metformin', condition_group_code: 'DIABETES', severity: 'medium', rule_code: 'DX-METFORMIN-LOWEGFR-001', rationale: 'Nguy cơ toan acid lactic', recommendation: 'Chỉnh liều hoặc ngưng' }
        ]);

        dbUtils.getInsuranceFormulary.mockResolvedValue([
            { generic_name: 'diclofenac', is_covered: false, note: 'Không thanh toán ngoại trú' }
        ]);

        dbUtils.getInsuranceRules.mockResolvedValue([
            { is_active: 1, generic_name: 'amoxicillin-clavulanate', condition_type: 'icd_prefix_required', condition_value: 'J01', severity: 'medium', rule_code: 'INS-AUGMENTIN-J01', message: 'Yêu cầu chẩn đoán nhiễm khuẩn hô hấp' },
            { is_active: 1, generic_name: 'paracetamol', condition_type: 'icd_prefix_required', condition_value: 'R50', severity: 'low', rule_code: 'INS-PARA-R50', message: 'Yêu cầu chẩn đoán sốt' }
        ]);

        dbUtils.getRenalAdjustmentRules.mockResolvedValue([
            { is_active: 1, generic_name: 'metformin', operator: '<', egfr_threshold: 30, severity: 'high', rule_code: 'RENAL-METFORMIN-30', rationale: 'Chống chỉ định khi eGFR < 30', recommendation: 'Ngừng metformin' },
            { is_active: 1, generic_name: 'metformin', operator: '<=', egfr_threshold: 45, severity: 'medium', rule_code: 'RENAL-METFORMIN-45', rationale: 'Thận trọng khi eGFR 30-45', recommendation: 'Giảm liều metformin xuống tối đa 1000mg/ngày' }
        ]);

        dbUtils.getDrugLabRules.mockResolvedValue([
            { is_active: 1, drugs: ['metformin', 'contrast'], lab_code: 'creatinine', operator: '>', threshold: 130, severity: 'high', rule_code: 'LAB-METFORMIN-CREATININE', clinical_effect: 'Nguy cơ toan acid lactic', recommendation: 'Tạm ngưng metformin trước khi chụp cản quang' },
            { is_active: 1, drugs: ['metformin'], lab_code: 'glucose', operator: 'range', threshold: 4.0, threshold_max: 6.0, severity: 'low', rule_code: 'LAB-METFORMIN-GLUCOSE-NORMAL', clinical_effect: 'Đường huyết bình thường', recommendation: 'Duy trì liều' }
        ]);

        // Initialize RuntimeRuleIndex using the mocked DB functions
        await runtimeRuleIndex.init();
    });

    const runParityTest = async (context) => {
        // 1. Run old engine
        setFeatureFlags({ cds_runtime_rule_index: false, cds_normalization_cache: false });
        const oldResult = await analyzeLocally(context, false);

        // 2. Run new engine (with cache cold)
        normalizationCache.clear();
        setFeatureFlags({ cds_runtime_rule_index: true, cds_normalization_cache: true });
        const newColdResult = await analyzeLocally(context, false);

        // 3. Run new engine (with cache warm)
        const newWarmResult = await analyzeLocally(context, false);

        // Sort alerts by rule_code to prevent any ordering mismatches in comparison
        const sortAlerts = (res) => {
            return {
                ...res,
                alerts: [...res.alerts].sort((a, b) => a.rule_code.localeCompare(b.rule_code))
            };
        };

        const oldSorted = sortAlerts(oldResult);
        const newColdSorted = sortAlerts(newColdResult);
        const newWarmSorted = sortAlerts(newWarmResult);

        // Assert 100% parity
        expect(newColdSorted.alerts.length).toBe(oldSorted.alerts.length);
        expect(newWarmSorted.alerts.length).toBe(oldSorted.alerts.length);
        
        expect(newColdSorted).toEqual(oldSorted);
        expect(newWarmSorted).toEqual(oldSorted);
    };

    it('Fixture 1: Empty Patient Context', async () => {
        const context = {
            medications: [],
            encounter: { diagnoses: [] },
            labs: []
        };
        await runParityTest(context);
    });

    it('Fixture 2: Medications but no ICD codes (Missing Diagnosis Warning)', async () => {
        const context = {
            medications: [{ display_name: 'Efferalgan 500mg' }],
            encounter: { diagnoses: [] },
            labs: []
        };
        await runParityTest(context);
    });

    it('Fixture 3: Drug-Drug Interaction (Ibuprofen + Diclofenac)', async () => {
        const context = {
            medications: [
                { display_name: 'Ibuprofen 400mg' },
                { display_name: 'Diclofenac 50mg' }
            ],
            encounter: { diagnoses: [{ code: 'M13.9' }] }, // arthritis
            labs: []
        };
        await runParityTest(context);
    });

    it('Fixture 4: Drug-Disease Contraindication (Ibuprofen + Gastric Ulcer)', async () => {
        const context = {
            medications: [{ display_name: 'Ibuprofen 400mg' }],
            encounter: { diagnoses: [{ code: 'K25.9' }] }, // Gastric ulcer
            labs: []
        };
        await runParityTest(context);
    });

    it('Fixture 5: Renal Adjustment Rule (Metformin + low eGFR)', async () => {
        const context = {
            medications: [{ display_name: 'Metformin 850mg' }],
            encounter: { diagnoses: [{ code: 'E11.9' }] }, // Diabetes
            labs: [
                { code: 'eGFR', value: 28, unit: 'mL/min/1.73m2' }
            ]
        };
        await runParityTest(context);
    });

    it('Fixture 6: Renal Adjustment Rule (Metformin + moderate eGFR)', async () => {
        const context = {
            medications: [{ display_name: 'Metformin 850mg' }],
            encounter: { diagnoses: [{ code: 'E11.9' }] }, // Diabetes
            labs: [
                { code: 'eGFR', value: 40, unit: 'mL/min/1.73m2' }
            ]
        };
        await runParityTest(context);
    });

    it('Fixture 7: Drug-Lab Rule (Metformin + high Creatinine)', async () => {
        const context = {
            medications: [{ display_name: 'Metformin 850mg' }],
            encounter: { diagnoses: [{ code: 'E11.9' }] }, // Diabetes
            labs: [
                { code: 'creatinine', value: 145, unit: 'umol/L' }
            ]
        };
        await runParityTest(context);
    });

    it('Fixture 8: Duplicate Therapy (Ibuprofen + Diclofenac)', async () => {
        const context = {
            medications: [
                { display_name: 'Ibuprofen 400mg' },
                { display_name: 'Diclofenac 50mg' }
            ],
            encounter: { diagnoses: [{ code: 'M13.9' }] },
            labs: []
        };
        await runParityTest(context);
    });

    it('Fixture 9: Insurance Rules (Not Covered & Missing Indication)', async () => {
        const context = {
            medications: [
                { display_name: 'Diclofenac 50mg' }, // Not covered
                { display_name: 'Augmentin 1g' } // Missing J01
            ],
            encounter: { diagnoses: [{ code: 'E11.9' }] },
            labs: []
        };
        await runParityTest(context);
    });

    it('Fixture 10: Critical Labs (Glucose, Potassium, Sodium)', async () => {
        const context = {
            medications: [],
            encounter: { diagnoses: [{ code: 'E11.9' }] },
            labs: [
                { code: 'glucose', value: 18.5, unit: 'mmol/L' },
                { code: 'potassium', value: 2.8, unit: 'mmol/L' },
                { code: 'sodium', value: 120, unit: 'mmol/L' }
            ]
        };
        await runParityTest(context);
    });

    it('Fixture 11: Complex Combined Case', async () => {
        const context = {
            medications: [
                { display_name: 'Augmentin 1g' }, // amoxicillin-clavulanate
                { display_name: 'Efferalgan 500mg' }, // paracetamol
                { display_name: 'Ibuprofen 400mg' },
                { display_name: 'Diclofenac 50mg' }
            ],
            encounter: { diagnoses: [{ code: 'K25.9' }, { code: 'J01.9' }] },
            labs: [
                { code: 'eGFR', value: 35, unit: 'mL/min/1.73m2' },
                { code: 'potassium', value: 5.8, unit: 'mmol/L' }
            ]
        };
        await runParityTest(context);
    });

    it('Fixture 12: Drug-Lab Rule with range operator', async () => {
        const context = {
            medications: [{ display_name: 'Metformin 850mg' }],
            encounter: { diagnoses: [{ code: 'E11.9' }] },
            labs: [
                { code: 'glucose', value: 5.5, unit: 'mmol/L' }
            ]
        };
        await runParityTest(context);
    });

    it('Fixture 13: Insurance Rule skipping for paracetamol', async () => {
        const context = {
            medications: [{ display_name: 'Efferalgan 500mg' }], // paracetamol
            encounter: { diagnoses: [{ code: 'E11.9' }] }, // Not R50
            labs: []
        };
        await runParityTest(context);
    });

    it('Fixture 14: filterLow = true removes low severity alerts', async () => {
        const context = {
            medications: [
                { display_name: 'Metformin 850mg' }, // Triggers LAB-METFORMIN-GLUCOSE-NORMAL (low severity)
                { display_name: 'Ibuprofen 400mg' }, // Just something else
                { display_name: 'Diclofenac 50mg' }  // Triggers DDI (high severity)
            ],
            encounter: { diagnoses: [{ code: 'M13.9' }] },
            labs: [
                { code: 'glucose', value: 5.5, unit: 'mmol/L' }
            ]
        };
        
        const runParityTestFilterLow = async (ctx) => {
            const { analyzeLocally, setFeatureFlags } = await import('../../content/cds/engine.js');
            const { normalizationCache } = await import('../../content/cds/normalization-cache.js');
            
            setFeatureFlags({ cds_runtime_rule_index: false, cds_normalization_cache: false });
            const oldResult = await analyzeLocally(ctx, true); // true = filterLow
            
            normalizationCache.clear();
            setFeatureFlags({ cds_runtime_rule_index: true, cds_normalization_cache: true });
            const newColdResult = await analyzeLocally(ctx, true);
            const newWarmResult = await analyzeLocally(ctx, true);
            
            const sortAlerts = (res) => ({ ...res, alerts: [...res.alerts].sort((a, b) => a.rule_code.localeCompare(b.rule_code)) });
            const oldSorted = sortAlerts(oldResult);
            const newColdSorted = sortAlerts(newColdResult);
            const newWarmSorted = sortAlerts(newWarmResult);
            
            expect(newColdSorted.alerts.length).toBe(oldSorted.alerts.length);
            expect(newWarmSorted.alerts.length).toBe(oldSorted.alerts.length);
            expect(newColdSorted).toEqual(oldSorted);
            expect(newWarmSorted).toEqual(oldSorted);
        };
        
        await runParityTestFilterLow(context);
    });
});
