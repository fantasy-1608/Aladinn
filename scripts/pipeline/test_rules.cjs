#!/usr/bin/env node
/**
 * 🧞 Aladinn CDS — Rule Test Runner
 * Chạy test cases với đơn thuốc mẫu để verify rules hoạt động đúng.
 * 
 * Usage: node scripts/pipeline/test_rules.cjs
 */

const fs = require('fs');
const path = require('path');

const CDS_DATA = path.join(__dirname, '../../public/cds-data');

function loadJson(filename) {
    return JSON.parse(fs.readFileSync(path.join(CDS_DATA, filename), 'utf8'));
}

// ============= TEST CASES =============

const TEST_CASES = [
    {
        case_id: "ORTHO_001",
        description: "Gãy xương đùi: Ketorolac + Enoxaparin = xuất huyết",
        medications: ["ketorolac", "enoxaparin", "cefazolin"],
        diagnoses_icd: ["S72.0"],
        expected_ddi: ["DDI-KETOROLAC-ENOXAPARIN-001"]
    },
    {
        case_id: "ORTHO_002",
        description: "Hậu phẫu CTCH: Diclofenac + Enoxaparin + PPI",
        medications: ["diclofenac", "enoxaparin", "pantoprazole"],
        diagnoses_icd: ["S82.1"],
        expected_ddi: ["DDI-DICLOFENAC-ENOXAPARIN-001"]
    },
    {
        case_id: "ORTHO_003",
        description: "Ketorolac + Warfarin = CHỐNG CHỈ ĐỊNH",
        medications: ["ketorolac", "warfarin"],
        diagnoses_icd: ["M17.1"],
        expected_ddi: ["DDI-KETOROLAC-WARFARIN-001"]
    },
    {
        case_id: "ORTHO_004",
        description: "Tramadol + Sertraline = serotonin syndrome",
        medications: ["tramadol", "sertraline"],
        diagnoses_icd: ["M54.5"],
        expected_ddi: ["DDI-TRAMADOL-SERTRALINE-001"]
    },
    {
        case_id: "ORTHO_005",
        description: "Ciprofloxacin + Tizanidine = CHỐNG CHỈ ĐỊNH",
        medications: ["ciprofloxacin", "tizanidine"],
        diagnoses_icd: ["T84.5"],
        expected_ddi: ["DDI-CIPROFLOXACIN-TIZANIDINE-001"]
    },
    {
        case_id: "ORTHO_006",
        description: "Morphine + Gabapentin = ức chế hô hấp",
        medications: ["morphine", "gabapentin"],
        diagnoses_icd: ["S72.0"],
        expected_ddi: ["DDI-MORPHINE-GABAPENTIN-001"]
    },
    {
        case_id: "ORTHO_007",
        description: "Ceftriaxone + Calcium gluconate IV = kết tủa",
        medications: ["ceftriaxone", "calcium gluconate"],
        diagnoses_icd: ["S72.0"],
        expected_ddi: ["DDI-CEFTRIAXONE-CALCIUM-001"]
    },
    {
        case_id: "ORTHO_008",
        description: "Colchicine + Clarithromycin = ngộ độc colchicine (BN gout)",
        medications: ["colchicine", "clarithromycin"],
        diagnoses_icd: ["M10.0"],
        expected_ddi: ["DDI-COLCHICINE-CLARITHROMYCIN-001"]
    },
    {
        case_id: "ORTHO_009",
        description: "Ketorolac + BN CKD = chống chỉ định",
        medications: ["ketorolac"],
        diagnoses_icd: ["N18.3"],
        expected_drug_disease: ["DX-NSAID-CKD-KETOROLAC-001"]
    },
    {
        case_id: "ORTHO_010",
        description: "Ketorolac + BN loét dạ dày = chống chỉ định",
        medications: ["ketorolac"],
        diagnoses_icd: ["K25.0"],
        expected_drug_disease: ["DX-NSAID-PUD-KETOROLAC-001"]
    },
    {
        case_id: "ORTHO_011",
        description: "Levofloxacin + BN viêm gân = cảnh báo",
        medications: ["levofloxacin"],
        diagnoses_icd: ["M76.5"],
        expected_drug_disease: ["DX-FQ-TENDON-LEVOFLOXACIN-001"]
    },
    {
        case_id: "ORTHO_012",
        description: "Ketorolac + Apixaban + Enoxaparin = multi-alert",
        medications: ["ketorolac", "apixaban", "enoxaparin"],
        diagnoses_icd: ["S72.0"],
        expected_ddi: ["DDI-KETOROLAC-APIXABAN-001", "DDI-KETOROLAC-ENOXAPARIN-001"]
    },
    {
        case_id: "NEGATIVE_001",
        description: "Paracetamol + Cefazolin = NO interaction (negative test)",
        medications: ["paracetamol", "cefazolin"],
        diagnoses_icd: ["S72.0"],
        expected_ddi: [],
        expected_drug_disease: []
    }
];

// ============= TEST RUNNER =============

function runTests() {
    console.log('🧪 Aladinn CDS Rule Test Runner\n');

    const ddiRules = loadJson('ddi_rules.json').filter(r => r.is_active);
    const drugDiseaseRules = loadJson('drug_disease_rules.json').filter(r => r.is_active);
    const conditionGroups = loadJson('condition_group_icd_map.json');

    // Build DDI lookup
    const ddiMap = new Map();
    for (const rule of ddiRules) {
        const key = [rule.generic_a.toLowerCase(), rule.generic_b.toLowerCase()].sort().join('|');
        if (!ddiMap.has(key)) ddiMap.set(key, []);
        ddiMap.get(key).push(rule);
    }

    // Map ICD to condition groups
    function mapConditions(icdCodes) {
        const groups = new Set();
        for (const icd of icdCodes) {
            const upper = icd.toUpperCase();
            for (const cg of conditionGroups) {
                // Support both schemas: icd_prefix (old) and icd_pattern (new)
                const prefixes = cg.icd_prefix ? [cg.icd_prefix] : (cg.icd_pattern || '').split('|');
                const groupCode = cg.condition_group_code || cg.condition_group;
                for (const prefix of prefixes) {
                    if (prefix && upper.startsWith(prefix.toUpperCase())) {
                        groups.add(groupCode);
                    }
                }
            }
        }
        return groups;
    }

    let passed = 0;
    let failed = 0;
    const failures = [];

    for (const tc of TEST_CASES) {
        const drugs = tc.medications;
        const condGroups = mapConditions(tc.diagnoses_icd);

        // Find DDI alerts
        const foundDdi = [];
        for (let i = 0; i < drugs.length; i++) {
            for (let j = i + 1; j < drugs.length; j++) {
                const key = [drugs[i], drugs[j]].sort().join('|');
                const matches = ddiMap.get(key) || [];
                for (const m of matches) foundDdi.push(m.rule_code);
            }
        }

        // Find Drug-Disease alerts
        const foundDd = [];
        for (const rule of drugDiseaseRules) {
            if (drugs.includes(rule.generic_name.toLowerCase()) && condGroups.has(rule.condition_group_code)) {
                foundDd.push(rule.rule_code);
            }
        }

        // Verify DDI
        const expectedDdi = tc.expected_ddi || [];
        const missingDdi = expectedDdi.filter(e => !foundDdi.includes(e));
        const unexpectedDdi = foundDdi.filter(f => !expectedDdi.includes(f));

        // Verify Drug-Disease
        const expectedDd = tc.expected_drug_disease || [];
        const missingDd = expectedDd.filter(e => !foundDd.includes(e));

        const ok = missingDdi.length === 0 && missingDd.length === 0;

        if (ok) {
            passed++;
            console.log(`  ✅ ${tc.case_id}: ${tc.description}`);
            if (foundDdi.length) console.log(`     DDI: ${foundDdi.join(', ')}`);
            if (foundDd.length) console.log(`     Drug-Disease: ${foundDd.join(', ')}`);
        } else {
            failed++;
            const reason = [];
            if (missingDdi.length) reason.push(`Missing DDI: ${missingDdi.join(', ')}`);
            if (missingDd.length) reason.push(`Missing DD: ${missingDd.join(', ')}`);
            console.log(`  ❌ ${tc.case_id}: ${tc.description}`);
            console.log(`     ${reason.join(' | ')}`);
            failures.push({ case_id: tc.case_id, missingDdi, missingDd });
        }
    }

    console.log(`\n📊 Results: ${passed}/${TEST_CASES.length} passed, ${failed} failed\n`);

    if (failures.length > 0) {
        console.log('⚠️  FAILURES:');
        for (const f of failures) {
            console.log(`  ${f.case_id}: DDI missing=${f.missingDdi.join(',') || 'none'}, DD missing=${f.missingDd.join(',') || 'none'}`);
        }
    }

    return { passed, failed, total: TEST_CASES.length, failures };
}

const result = runTests();
process.exit(result.failed > 0 ? 1 : 0);
