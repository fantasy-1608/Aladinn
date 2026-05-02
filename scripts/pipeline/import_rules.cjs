#!/usr/bin/env node
/**
 * 🧞 Aladinn CDS — Drug Rules Pipeline v1.0
 * 
 * Converts pipeline-format rules → Aladinn-native format
 * Adds new generics + condition groups if needed
 * Validates schema + deduplicates
 * Generates test report
 * 
 * Usage: node scripts/pipeline/import_rules.cjs
 */

const fs = require('fs');
const path = require('path');

const CDS_DATA = path.join(__dirname, '../../public/cds-data');
const REPORT_PATH = path.join(__dirname, 'pipeline_report.json');

// ============= LOAD EXISTING DATA =============
function loadJson(filename) {
    return JSON.parse(fs.readFileSync(path.join(CDS_DATA, filename), 'utf8'));
}

function saveJson(filename, data) {
    fs.writeFileSync(path.join(CDS_DATA, filename), JSON.stringify(data, null, 2) + '\n', 'utf8');
}

// ============= NEW RULES (Adapted from Pipeline v1.0 → Aladinn Format) =============

const NEW_DDI_RULES = [
    {
        rule_code: "DDI-KETOROLAC-ENOXAPARIN-001",
        generic_a: "ketorolac",
        generic_b: "enoxaparin",
        severity: "high",
        evidence_level: "moderate",
        clinical_effect: "Hiệp đồng tăng nguy cơ chảy máu. Xuất huyết sau mổ.",
        recommendation: "Tránh dùng NSAID mạnh sau mổ khi đang dùng LMWH. Cân nhắc paracetamol.",
        action_code: "avoid",
        is_active: true,
        version: "2.0.0",
        _source: "SmPC + clinical consensus",
        _pipeline_id: "DDI_KETOROLAC_ENOXAPARIN"
    },
    {
        rule_code: "DDI-TRAMADOL-SERTRALINE-001",
        generic_a: "tramadol",
        generic_b: "sertraline",
        severity: "high",
        evidence_level: "moderate",
        clinical_effect: "Tăng serotonin. Nguy cơ hội chứng serotonin (sốt, co giật, rối loạn ý thức).",
        recommendation: "Tránh phối hợp hoặc theo dõi chặt triệu chứng serotonin.",
        action_code: "avoid_or_monitor",
        is_active: true,
        version: "2.0.0",
        _source: "DuocThuQuocGia2022 + SmPC",
        _pipeline_id: "DDI_TRAMADOL_SSRI"
    },
    {
        rule_code: "DDI-CIPROFLOXACIN-TIZANIDINE-001",
        generic_a: "ciprofloxacin",
        generic_b: "tizanidine",
        severity: "high",
        evidence_level: "high",
        clinical_effect: "Ức chế CYP1A2 → Tăng nồng độ tizanidine gấp ~10 lần. Hạ huyết áp nặng, an thần sâu.",
        recommendation: "CHỐNG CHỈ ĐỊNH phối hợp. Tuyệt đối không dùng đồng thời.",
        action_code: "contraindicated",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Label + DuocThuQuocGia2022",
        _pipeline_id: "DDI_CIPROFLOXACIN_TIZANIDINE"
    },
    {
        rule_code: "DDI-DICLOFENAC-ENOXAPARIN-001",
        generic_a: "diclofenac",
        generic_b: "enoxaparin",
        severity: "high",
        evidence_level: "moderate",
        clinical_effect: "NSAID + LMWH tăng nguy cơ xuất huyết, đặc biệt sau phẫu thuật.",
        recommendation: "Tránh phối hợp; dùng paracetamol thay thế giảm đau.",
        action_code: "avoid_or_monitor",
        is_active: true,
        version: "2.0.0",
        _source: "SmPC + clinical consensus",
        _pipeline_id: "DDI_DICLOFENAC_ENOXAPARIN"
    },
    {
        rule_code: "DDI-CELECOXIB-ENOXAPARIN-001",
        generic_a: "celecoxib",
        generic_b: "enoxaparin",
        severity: "medium",
        evidence_level: "moderate",
        clinical_effect: "COX-2 inhibitor + LMWH tăng nhẹ nguy cơ xuất huyết.",
        recommendation: "Theo dõi dấu hiệu chảy máu. An toàn hơn NSAID không chọn lọc.",
        action_code: "monitor",
        is_active: true,
        version: "2.0.0",
        _source: "SmPC",
        _pipeline_id: "DDI_CELECOXIB_ENOXAPARIN"
    },
    {
        rule_code: "DDI-MELOXICAM-ENOXAPARIN-001",
        generic_a: "meloxicam",
        generic_b: "enoxaparin",
        severity: "high",
        evidence_level: "moderate",
        clinical_effect: "NSAID + LMWH tăng nguy cơ xuất huyết sau phẫu thuật chỉnh hình.",
        recommendation: "Tránh phối hợp; cân nhắc paracetamol hoặc giảm đau non-NSAID.",
        action_code: "avoid_or_monitor",
        is_active: true,
        version: "2.0.0",
        _source: "SmPC + clinical consensus",
        _pipeline_id: "DDI_MELOXICAM_ENOXAPARIN"
    },
    {
        rule_code: "DDI-KETOROLAC-WARFARIN-001",
        generic_a: "ketorolac",
        generic_b: "warfarin",
        severity: "high",
        evidence_level: "high",
        clinical_effect: "Ketorolac + Warfarin: nguy cơ xuất huyết nặng (GI, nội sọ). Ketorolac ức chế mạnh COX-1.",
        recommendation: "CHỐNG CHỈ ĐỊNH phối hợp. Không dùng ketorolac khi đang dùng kháng đông.",
        action_code: "contraindicated",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Label",
        _pipeline_id: "DDI_KETOROLAC_WARFARIN"
    },
    {
        rule_code: "DDI-KETOROLAC-RIVAROXABAN-001",
        generic_a: "ketorolac",
        generic_b: "rivaroxaban",
        severity: "high",
        evidence_level: "moderate",
        clinical_effect: "NSAID mạnh + NOAC: nguy cơ xuất huyết rất cao.",
        recommendation: "Tránh phối hợp. Cân nhắc paracetamol.",
        action_code: "avoid",
        is_active: true,
        version: "2.0.0",
        _source: "SmPC",
        _pipeline_id: "DDI_KETOROLAC_RIVAROXABAN"
    },
    {
        rule_code: "DDI-KETOROLAC-APIXABAN-001",
        generic_a: "ketorolac",
        generic_b: "apixaban",
        severity: "high",
        evidence_level: "moderate",
        clinical_effect: "NSAID mạnh + NOAC: nguy cơ xuất huyết rất cao.",
        recommendation: "Tránh phối hợp. Cân nhắc paracetamol.",
        action_code: "avoid",
        is_active: true,
        version: "2.0.0",
        _source: "SmPC",
        _pipeline_id: "DDI_KETOROLAC_APIXABAN"
    },
    {
        rule_code: "DDI-MORPHINE-GABAPENTIN-001",
        generic_a: "morphine",
        generic_b: "gabapentin",
        severity: "medium",
        evidence_level: "moderate",
        clinical_effect: "Opioid + Gabapentinoid: tăng nguy cơ ức chế hô hấp, an thần quá mức.",
        recommendation: "Giảm liều opioid khi phối hợp. Theo dõi SpO2 và mức độ an thần.",
        action_code: "monitor",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Safety Communication 2019",
        _pipeline_id: "DDI_MORPHINE_GABAPENTIN"
    },
    {
        rule_code: "DDI-TRAMADOL-GABAPENTIN-001",
        generic_a: "tramadol",
        generic_b: "gabapentin",
        severity: "medium",
        evidence_level: "moderate",
        clinical_effect: "Opioid + Gabapentinoid: tăng nguy cơ ức chế hô hấp, an thần quá mức.",
        recommendation: "Giảm liều khi phối hợp. Theo dõi SpO2.",
        action_code: "monitor",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Safety Communication 2019",
        _pipeline_id: "DDI_TRAMADOL_GABAPENTIN"
    },
    {
        rule_code: "DDI-CEFTRIAXONE-CALCIUM-001",
        generic_a: "ceftriaxone",
        generic_b: "calcium gluconate",
        severity: "high",
        evidence_level: "high",
        clinical_effect: "Ceftriaxone + calcium IV: kết tủa ceftriaxone-calcium trong phổi, thận. Đã có tử vong ở trẻ sơ sinh.",
        recommendation: "KHÔNG trộn/truyền đồng thời. Nếu cần, cách nhau ≥48 giờ (trẻ em) hoặc flush line kỹ (người lớn).",
        action_code: "avoid",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Warning + DuocThuQuocGia2022",
        _pipeline_id: "DDI_CEFTRIAXONE_CALCIUM"
    },
    {
        rule_code: "DDI-COLCHICINE-CLARITHROMYCIN-001",
        generic_a: "colchicine",
        generic_b: "clarithromycin",
        severity: "high",
        evidence_level: "high",
        clinical_effect: "Clarithromycin ức chế CYP3A4/P-gp → tăng nồng độ colchicine gấp nhiều lần. Ngộ độc colchicine (tiêu chảy, suy đa cơ quan).",
        recommendation: "CHỐNG CHỈ ĐỊNH ở BN suy thận/gan. Nếu bắt buộc: giảm liều colchicine 50%, thời gian ngắn.",
        action_code: "contraindicated",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Label + DuocThuQuocGia2022",
        _pipeline_id: "DDI_COLCHICINE_CLARITHROMYCIN"
    }
];

const NEW_DRUG_DISEASE_RULES = [
    {
        rule_code: "DX-NSAID-PUD-KETOROLAC-001",
        generic_name: "ketorolac",
        condition_group_code: "peptic_ulcer",
        rule_type: "contraindication",
        severity: "high",
        rationale: "Ketorolac ức chế mạnh COX-1, gây tổn thương niêm mạc dạ dày. CHỐNG CHỈ ĐỊNH ở BN loét tiêu hóa.",
        recommendation: "Không sử dụng. Dùng paracetamol hoặc opioid thay thế.",
        evidence_level: "high",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Label",
        _pipeline_id: "DDD_NSAID_PUD"
    },
    {
        rule_code: "DX-NSAID-CKD-KETOROLAC-001",
        generic_name: "ketorolac",
        condition_group_code: "ckd",
        rule_type: "contraindication",
        severity: "high",
        rationale: "Ketorolac giảm tưới máu thận qua ức chế prostaglandin. Nguy cơ suy thận cấp.",
        recommendation: "CHỐNG CHỈ ĐỊNH ở BN suy thận. Dùng paracetamol thay thế.",
        evidence_level: "high",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Label + DuocThuQuocGia2022",
        _pipeline_id: "DDD_NSAID_CKD_KETOROLAC"
    },
    {
        rule_code: "DX-FQ-TENDON-LEVOFLOXACIN-001",
        generic_name: "levofloxacin",
        condition_group_code: "tendon_disorder",
        rule_type: "caution",
        severity: "high",
        rationale: "Fluoroquinolone có độc tính trên gân, tăng nguy cơ đứt gân Achilles. Nguy cơ cao hơn ở BN > 60 tuổi, dùng corticoid, hoặc ghép tạng.",
        recommendation: "Tránh dùng ở BN có tiền sử bệnh gân. Nếu bắt buộc: theo dõi sát triệu chứng gân.",
        evidence_level: "moderate",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Boxed Warning + SmPC",
        _pipeline_id: "DDD_FLUOROQUINOLONE_TENDON"
    },
    {
        rule_code: "DX-FQ-TENDON-CIPROFLOXACIN-001",
        generic_name: "ciprofloxacin",
        condition_group_code: "tendon_disorder",
        rule_type: "caution",
        severity: "high",
        rationale: "Fluoroquinolone gây viêm gân, đứt gân. Nguy cơ cao khi dùng kèm corticoid.",
        recommendation: "Tránh dùng ở BN nguy cơ đứt gân. Chọn kháng sinh khác nếu có thể.",
        evidence_level: "moderate",
        is_active: true,
        version: "2.0.0",
        _source: "FDA Boxed Warning",
        _pipeline_id: "DDD_FLUOROQUINOLONE_TENDON_CIPRO"
    },
    {
        rule_code: "DX-NSAID-CKD-CELECOXIB-001",
        generic_name: "celecoxib",
        condition_group_code: "ckd",
        rule_type: "caution",
        severity: "medium",
        rationale: "COX-2 inhibitor vẫn ảnh hưởng chức năng thận qua ức chế prostaglandin thận.",
        recommendation: "Dùng liều thấp nhất, thời gian ngắn nhất. Theo dõi creatinine.",
        evidence_level: "moderate",
        is_active: true,
        version: "2.0.0",
        _source: "SmPC + clinical consensus",
        _pipeline_id: "DDD_CELECOXIB_CKD"
    },
    {
        rule_code: "DX-NSAID-CKD-MELOXICAM-001",
        generic_name: "meloxicam",
        condition_group_code: "ckd",
        rule_type: "caution",
        severity: "high",
        rationale: "NSAID giảm tưới máu thận, đặc biệt nguy hiểm ở BN CKD.",
        recommendation: "Tránh dùng. Cân nhắc paracetamol.",
        evidence_level: "moderate",
        is_active: true,
        version: "2.0.0",
        _source: "DuocThuQuocGia2022",
        _pipeline_id: "DDD_MELOXICAM_CKD"
    }
];

// New condition groups needed
const NEW_CONDITION_GROUPS = [
    { condition_group_code: "tendon_disorder", icd_prefix: "M76" },
    { condition_group_code: "tendon_disorder", icd_prefix: "M77" },
    { condition_group_code: "tendon_disorder", icd_prefix: "M65" },
    { condition_group_code: "tendon_disorder", icd_prefix: "M66" },
    { condition_group_code: "tendon_disorder", icd_prefix: "M67" },
    { condition_group_code: "dvt", icd_prefix: "I80" },
    { condition_group_code: "dvt", icd_prefix: "I82" },
    { condition_group_code: "pe", icd_prefix: "I26" }
];

// New generics needed
const NEW_GENERICS = [
    {
        generic_name: "apixaban",
        generic_name_en: "apixaban",
        atc_code: "B01AF02",
        pharmacologic_class: "anticoagulant",
        therapeutic_class: "antithrombotic",
        is_active: true
    },
    {
        generic_name: "colchicine",
        generic_name_en: "colchicine",
        atc_code: "M04AC01",
        pharmacologic_class: "antigout",
        therapeutic_class: "musculoskeletal",
        is_active: true
    },
    {
        generic_name: "sertraline",
        generic_name_en: "sertraline",
        atc_code: "N06AB06",
        pharmacologic_class: "ssri",
        therapeutic_class: "antidepressant",
        is_active: true
    },
    {
        generic_name: "tizanidine",
        generic_name_en: "tizanidine",
        atc_code: "M03BX02",
        pharmacologic_class: "muscle_relaxant",
        therapeutic_class: "musculoskeletal",
        is_active: true
    },
    {
        generic_name: "calcium gluconate",
        generic_name_en: "calcium gluconate",
        atc_code: "A12AA03",
        pharmacologic_class: "mineral_supplement",
        therapeutic_class: "supplement",
        is_active: true
    }
];

// ============= MAIN PIPELINE =============

function main() {
    console.log('🧞 Aladinn Drug Rules Pipeline v1.0\n');
    
    const report = {
        timestamp: new Date().toISOString(),
        version: "2.0.0",
        actions: [],
        errors: [],
        summary: {}
    };

    // 1. Load existing data
    const ddiRules = loadJson('ddi_rules.json');
    const drugDiseaseRules = loadJson('drug_disease_rules.json');
    const drugGeneric = loadJson('drug_generic.json');
    const conditionGroups = loadJson('condition_group_icd_map.json');

    const existingDdiCodes = new Set(ddiRules.map(r => r.rule_code));
    const existingDdCodes = new Set(drugDiseaseRules.map(r => r.rule_code));
    const existingGenerics = new Set(drugGeneric.map(g => g.generic_name));
    const existingCgPairs = new Set(conditionGroups.map(c => `${c.condition_group_code}|${c.icd_prefix}`));

    console.log(`📊 Existing: ${ddiRules.length} DDI, ${drugDiseaseRules.length} Drug-Disease, ${drugGeneric.length} Generics, ${conditionGroups.length} Condition Groups\n`);

    // 2. Add new generics
    let newGenCount = 0;
    for (const gen of NEW_GENERICS) {
        if (!existingGenerics.has(gen.generic_name)) {
            drugGeneric.push(gen);
            existingGenerics.add(gen.generic_name);
            newGenCount++;
            report.actions.push({ type: 'add_generic', name: gen.generic_name, atc: gen.atc_code });
            console.log(`  ✅ Generic: ${gen.generic_name} (${gen.atc_code})`);
        } else {
            console.log(`  ⏭️  Generic exists: ${gen.generic_name}`);
        }
    }

    // 3. Add new condition groups
    let newCgCount = 0;
    for (const cg of NEW_CONDITION_GROUPS) {
        const key = `${cg.condition_group_code}|${cg.icd_prefix}`;
        if (!existingCgPairs.has(key)) {
            conditionGroups.push(cg);
            existingCgPairs.add(key);
            newCgCount++;
            report.actions.push({ type: 'add_condition_group', group: cg.condition_group_code, prefix: cg.icd_prefix });
        }
    }
    if (newCgCount > 0) console.log(`  ✅ Condition Groups: +${newCgCount} entries (tendon_disorder, dvt, pe)`);

    // 4. Add new DDI rules (skip duplicates)
    let newDdiCount = 0;
    let skipDdiCount = 0;
    for (const rule of NEW_DDI_RULES) {
        if (existingDdiCodes.has(rule.rule_code)) {
            skipDdiCount++;
            console.log(`  ⏭️  DDI exists: ${rule.rule_code}`);
            continue;
        }
        // Validate: both generics must exist
        if (!existingGenerics.has(rule.generic_a)) {
            report.errors.push({ type: 'missing_generic', rule: rule.rule_code, drug: rule.generic_a });
            console.error(`  ❌ Missing generic for DDI: ${rule.generic_a}`);
            continue;
        }
        if (!existingGenerics.has(rule.generic_b)) {
            report.errors.push({ type: 'missing_generic', rule: rule.rule_code, drug: rule.generic_b });
            console.error(`  ❌ Missing generic for DDI: ${rule.generic_b}`);
            continue;
        }
        ddiRules.push(rule);
        existingDdiCodes.add(rule.rule_code);
        newDdiCount++;
        report.actions.push({ type: 'add_ddi', code: rule.rule_code, pair: `${rule.generic_a} ↔ ${rule.generic_b}` });
        console.log(`  ✅ DDI: ${rule.rule_code} (${rule.generic_a} ↔ ${rule.generic_b})`);
    }

    // 5. Add new Drug-Disease rules
    let newDdCount = 0;
    for (const rule of NEW_DRUG_DISEASE_RULES) {
        if (existingDdCodes.has(rule.rule_code)) {
            console.log(`  ⏭️  Drug-Disease exists: ${rule.rule_code}`);
            continue;
        }
        if (!existingGenerics.has(rule.generic_name)) {
            report.errors.push({ type: 'missing_generic', rule: rule.rule_code, drug: rule.generic_name });
            console.error(`  ❌ Missing generic for Drug-Disease: ${rule.generic_name}`);
            continue;
        }
        drugDiseaseRules.push(rule);
        existingDdCodes.add(rule.rule_code);
        newDdCount++;
        report.actions.push({ type: 'add_drug_disease', code: rule.rule_code, drug: rule.generic_name, condition: rule.condition_group_code });
        console.log(`  ✅ Drug-Disease: ${rule.rule_code} (${rule.generic_name} × ${rule.condition_group_code})`);
    }

    // 6. Save all files
    console.log('\n💾 Saving...');
    saveJson('ddi_rules.json', ddiRules);
    saveJson('drug_disease_rules.json', drugDiseaseRules);
    saveJson('drug_generic.json', drugGeneric);
    saveJson('condition_group_icd_map.json', conditionGroups);

    // 7. Summary
    report.summary = {
        new_generics: newGenCount,
        new_condition_groups: newCgCount,
        new_ddi_rules: newDdiCount,
        new_drug_disease_rules: newDdCount,
        skipped_ddi: skipDdiCount,
        total_ddi: ddiRules.length,
        total_drug_disease: drugDiseaseRules.length,
        total_generics: drugGeneric.length,
        total_condition_groups: conditionGroups.length,
        errors: report.errors.length
    };

    fs.writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2) + '\n', 'utf8');

    console.log('\n📊 SUMMARY:');
    console.log(`  Generics:        ${drugGeneric.length} total (+${newGenCount} new)`);
    console.log(`  DDI Rules:       ${ddiRules.length} total (+${newDdiCount} new)`);
    console.log(`  Drug-Disease:    ${drugDiseaseRules.length} total (+${newDdCount} new)`);
    console.log(`  Condition Groups: ${conditionGroups.length} total (+${newCgCount} new)`);
    console.log(`  Errors:          ${report.errors.length}`);
    console.log(`\n✅ Pipeline complete! Report: ${REPORT_PATH}`);
}

main();
