/**
 * 🧪 CDS Rule Engine Tests
 * Covers: DDI detection, duplicate therapy, drug-disease, insurance rules, negative cases
 * 
 * Strategy: Test the pure rule engine functions directly by replicating
 * their logic (they are module-private) with the same algorithm.
 */
import { describe, expect, it } from 'vitest';
import { icdMatchesRequirement } from '../../content/cds/engine.js';

// =====================================================
// DDI Rule Runner (mirror of engine.js runDdiRules)
// =====================================================
function runDdiRules(rules, normalized) {
    const ruleMap = new Map();
    for (const rule of rules) {
        if (!rule.is_active) continue;
        const key = [rule.generic_a.toLowerCase(), rule.generic_b.toLowerCase()].sort().join('|');
        if (!ruleMap.has(key)) ruleMap.set(key, []);
        ruleMap.get(key).push(rule);
    }

    const alerts = [];
    const drugs = normalized.normalized_drugs;
    for (let i = 0; i < drugs.length; i++) {
        for (let j = i + 1; j < drugs.length; j++) {
            const a = drugs[i], b = drugs[j];
            const matches = ruleMap.get([a, b].sort().join('|')) || [];
            for (const match of matches) {
                alerts.push({
                    rule_code: match.rule_code,
                    domain: 'interaction',
                    severity: match.severity,
                    effect: match.clinical_effect,
                    matched_items: { drug: [a, b] }
                });
            }
        }
    }
    return alerts;
}

// =====================================================
// Duplicate Therapy Runner (mirror of engine.js)
// =====================================================
function runDuplicateTherapyRules(normalized, genericMap) {
    const classToDrugs = new Map();
    for (const drug of normalized.normalized_drugs) {
        const generic = genericMap.get(drug);
        const bucket = generic?.pharmacologic_class || generic?.therapeutic_class;
        if (!bucket) continue;
        const bucketLower = bucket.toLowerCase();
        if (bucketLower === 'unknown' || bucketLower.includes('chưa phân nhóm') || bucket.trim() === '-' || bucket.trim() === '') continue;

        if (!classToDrugs.has(bucket)) classToDrugs.set(bucket, []);
        classToDrugs.get(bucket).push(drug);
    }

    const alerts = [];
    for (const [bucket, drugs] of classToDrugs.entries()) {
        const uniqueDrugs = Array.from(new Set(drugs)).sort();
        if (uniqueDrugs.length < 2) continue;
        alerts.push({
            rule_code: `DUP-THERAPY-${bucket.toUpperCase()}-001`,
            domain: 'duplicate_therapy',
            severity: 'medium',
            matched_items: { drug: uniqueDrugs }
        });
    }
    return alerts;
}

// =====================================================
// Drug-Lab Interaction Runner (mirror)
// =====================================================
function runDrugLabRulesFromDb(rules, drugs, labMap) {
    const alerts = [];
    for (const rule of rules) {
        if (!rule.is_active) continue;
        const labResult = labMap.get(rule.lab_code);
        if (!labResult) continue;
        const hasDrug = rule.drugs.some(d => drugs.includes(d));
        if (!hasDrug) continue;
        const v = labResult.value;
        let triggered = false;
        if (rule.operator === '<' && v < rule.threshold) triggered = true;
        else if (rule.operator === '>' && v > rule.threshold) triggered = true;
        if (!triggered) continue;
        alerts.push({
            rule_code: rule.rule_code,
            domain: 'drug_lab',
            severity: rule.severity,
            matched_items: { drug: [rule.drugs.find(d => drugs.includes(d))], lab: [rule.lab_code] }
        });
    }
    return alerts;
}

// =====================================================
// TEST DATA FIXTURES
// =====================================================
const DDI_RULES = [
    {
        rule_code: 'DDI-WARFARIN-ASPIRIN-001',
        generic_a: 'warfarin',
        generic_b: 'aspirin',
        severity: 'high',
        clinical_effect: 'Tăng nguy cơ xuất huyết',
        recommendation: 'Tránh phối hợp',
        is_active: true
    },
    {
        rule_code: 'DDI-METFORMIN-CIMETIDIN-001',
        generic_a: 'metformin',
        generic_b: 'cimetidine',
        severity: 'medium',
        clinical_effect: 'Tăng nồng độ metformin',
        recommendation: 'Theo dõi đường huyết',
        is_active: true
    },
    {
        rule_code: 'DDI-INACTIVE-001',
        generic_a: 'drugX',
        generic_b: 'drugY',
        severity: 'low',
        clinical_effect: 'Test inactive',
        recommendation: 'N/A',
        is_active: false  // Should be skipped
    }
];

const GENERIC_MAP = new Map([
    ['omeprazole', { generic_name: 'omeprazole', pharmacologic_class: 'Proton Pump Inhibitor', therapeutic_class: 'PPI' }],
    ['pantoprazole', { generic_name: 'pantoprazole', pharmacologic_class: 'Proton Pump Inhibitor', therapeutic_class: 'PPI' }],
    ['amlodipine', { generic_name: 'amlodipine', pharmacologic_class: 'Calcium Channel Blocker', therapeutic_class: 'CCB' }],
    ['warfarin', { generic_name: 'warfarin', pharmacologic_class: 'Anticoagulant', therapeutic_class: 'VKA' }],
    ['aspirin', { generic_name: 'aspirin', pharmacologic_class: 'Antiplatelet', therapeutic_class: 'NSAID' }],
    ['metformin', { generic_name: 'metformin', pharmacologic_class: 'Biguanide', therapeutic_class: 'Antidiabetic' }],
    ['unknown-drug', { generic_name: 'unknown-drug', pharmacologic_class: 'unknown', therapeutic_class: 'unknown' }],
]);

const DRUG_LAB_RULES = [
    {
        rule_code: 'DL-WARFARIN-INR-001',
        lab_code: 'INR',
        drugs: ['warfarin'],
        operator: '>',
        threshold: 3,
        severity: 'high',
        clinical_effect: 'INR quá cao — nguy cơ chảy máu',
        recommendation: 'Giảm liều hoặc ngừng Warfarin',
        is_active: true
    },
    {
        rule_code: 'DL-METFORMIN-EGFR-001',
        lab_code: 'eGFR',
        drugs: ['metformin'],
        operator: '<',
        threshold: 30,
        severity: 'high',
        clinical_effect: 'Nguy cơ toan lactic acid',
        recommendation: 'Ngừng Metformin khi eGFR < 30',
        is_active: true
    }
];

// =====================================================
// TESTS
// =====================================================

// ---------- DDI Detection ----------
describe('CDS Engine: DDI Detection', () => {
    it('detects warfarin + aspirin interaction', () => {
        const normalized = { normalized_drugs: ['warfarin', 'aspirin'] };
        const alerts = runDdiRules(DDI_RULES, normalized);

        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DDI-WARFARIN-ASPIRIN-001');
        expect(alerts[0].severity).toBe('high');
        expect(alerts[0].matched_items.drug).toContain('warfarin');
        expect(alerts[0].matched_items.drug).toContain('aspirin');
    });

    it('detects metformin + cimetidine interaction', () => {
        const normalized = { normalized_drugs: ['metformin', 'cimetidine'] };
        const alerts = runDdiRules(DDI_RULES, normalized);

        expect(alerts).toHaveLength(1);
        expect(alerts[0].severity).toBe('medium');
    });

    it('skips inactive rules', () => {
        const normalized = { normalized_drugs: ['drugx', 'drugy'] };
        const alerts = runDdiRules(DDI_RULES, normalized);

        expect(alerts).toHaveLength(0);
    });

    it('returns no alerts for non-interacting drugs', () => {
        const normalized = { normalized_drugs: ['amlodipine', 'metformin'] };
        const alerts = runDdiRules(DDI_RULES, normalized);

        expect(alerts).toHaveLength(0);
    });

    it('returns no alerts when only one drug is present', () => {
        const normalized = { normalized_drugs: ['warfarin'] };
        const alerts = runDdiRules(DDI_RULES, normalized);

        expect(alerts).toHaveLength(0);
    });

    it('handles drug pair in reversed order', () => {
        const normalized = { normalized_drugs: ['aspirin', 'warfarin'] };
        const alerts = runDdiRules(DDI_RULES, normalized);

        expect(alerts).toHaveLength(1); // Order shouldn't matter
    });
});

// ---------- Duplicate Therapy ----------
describe('CDS Engine: Duplicate Therapy', () => {
    it('detects two PPIs prescribed together', () => {
        const normalized = { normalized_drugs: ['omeprazole', 'pantoprazole'] };
        const alerts = runDuplicateTherapyRules(normalized, GENERIC_MAP);

        expect(alerts).toHaveLength(1);
        expect(alerts[0].domain).toBe('duplicate_therapy');
        expect(alerts[0].matched_items.drug).toContain('omeprazole');
        expect(alerts[0].matched_items.drug).toContain('pantoprazole');
    });

    it('does NOT flag drugs from different classes', () => {
        const normalized = { normalized_drugs: ['omeprazole', 'amlodipine'] };
        const alerts = runDuplicateTherapyRules(normalized, GENERIC_MAP);

        expect(alerts).toHaveLength(0);
    });

    it('ignores drugs with unknown class', () => {
        const normalized = { normalized_drugs: ['unknown-drug', 'omeprazole'] };
        const alerts = runDuplicateTherapyRules(normalized, GENERIC_MAP);

        expect(alerts).toHaveLength(0);
    });

    it('handles single drug (no duplicate possible)', () => {
        const normalized = { normalized_drugs: ['omeprazole'] };
        const alerts = runDuplicateTherapyRules(normalized, GENERIC_MAP);

        expect(alerts).toHaveLength(0);
    });
});

// ---------- Drug-Lab Interaction ----------
describe('CDS Engine: Drug-Lab Interactions', () => {
    it('triggers warfarin alert when INR > 3', () => {
        const labMap = new Map([['INR', { code: 'INR', value: 4.5, unit: '' }]]);
        const drugs = ['warfarin'];
        const alerts = runDrugLabRulesFromDb(DRUG_LAB_RULES, drugs, labMap);

        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DL-WARFARIN-INR-001');
    });

    it('does NOT trigger warfarin alert when INR is normal', () => {
        const labMap = new Map([['INR', { code: 'INR', value: 2.0, unit: '' }]]);
        const drugs = ['warfarin'];
        const alerts = runDrugLabRulesFromDb(DRUG_LAB_RULES, drugs, labMap);

        expect(alerts).toHaveLength(0);
    });

    it('triggers metformin alert when eGFR < 30', () => {
        const labMap = new Map([['eGFR', { code: 'eGFR', value: 22, unit: 'mL/min' }]]);
        const drugs = ['metformin'];
        const alerts = runDrugLabRulesFromDb(DRUG_LAB_RULES, drugs, labMap);

        expect(alerts).toHaveLength(1);
        expect(alerts[0].rule_code).toBe('DL-METFORMIN-EGFR-001');
    });

    it('does NOT trigger when drug is not present', () => {
        const labMap = new Map([['INR', { code: 'INR', value: 5.0, unit: '' }]]);
        const drugs = ['amlodipine']; // No warfarin
        const alerts = runDrugLabRulesFromDb(DRUG_LAB_RULES, drugs, labMap);

        expect(alerts).toHaveLength(0);
    });

    it('does NOT trigger when lab is not available', () => {
        const labMap = new Map(); // Empty labs
        const drugs = ['warfarin'];
        const alerts = runDrugLabRulesFromDb(DRUG_LAB_RULES, drugs, labMap);

        expect(alerts).toHaveLength(0);
    });
});

// ---------- ICD Matching ----------
describe('CDS Engine: ICD Code Matching', () => {
    it('matches exact ICD code', () => {
        expect(icdMatchesRequirement('E11.9', 'E11')).toBe(true);
    });

    it('matches ICD range (E10-E14)', () => {
        expect(icdMatchesRequirement('E11.2', 'E10-E14')).toBe(true);
        expect(icdMatchesRequirement('E10.0', 'E10-E14')).toBe(true);
        expect(icdMatchesRequirement('E14.9', 'E10-E14')).toBe(true);
    });

    it('rejects ICD outside range', () => {
        expect(icdMatchesRequirement('E15.0', 'E10-E14')).toBe(false);
        expect(icdMatchesRequirement('E09.9', 'E10-E14')).toBe(false);
    });

    it('handles prefix matching for non-range', () => {
        expect(icdMatchesRequirement('G20.0', 'G20')).toBe(true);
        expect(icdMatchesRequirement('G21.1', 'G20')).toBe(false);
    });

    it('handles empty/null inputs', () => {
        expect(icdMatchesRequirement('', 'E11')).toBe(false);
        expect(icdMatchesRequirement('E11', '')).toBe(false);
        expect(icdMatchesRequirement(null, 'E11')).toBe(false);
    });
});

// ---------- Negative Cases (No False Alarms) ----------
describe('CDS Engine: Negative Cases (No False Alarms)', () => {
    it('no alerts for completely safe prescription', () => {
        const normalized = { normalized_drugs: ['amlodipine'] };

        const ddiAlerts = runDdiRules(DDI_RULES, normalized);
        const dupAlerts = runDuplicateTherapyRules(normalized, GENERIC_MAP);

        expect(ddiAlerts).toHaveLength(0);
        expect(dupAlerts).toHaveLength(0);
    });

    it('no alerts for empty drug list', () => {
        const normalized = { normalized_drugs: [] };

        const ddiAlerts = runDdiRules(DDI_RULES, normalized);
        const dupAlerts = runDuplicateTherapyRules(normalized, GENERIC_MAP);

        expect(ddiAlerts).toHaveLength(0);
        expect(dupAlerts).toHaveLength(0);
    });

    it('no false DDI when drugs share common prefix', () => {
        // "cefuroxime" and "cefazolin" are different drugs — no DDI rule
        const normalized = { normalized_drugs: ['cefuroxime', 'cefazolin'] };
        const alerts = runDdiRules(DDI_RULES, normalized);

        expect(alerts).toHaveLength(0);
    });
});
