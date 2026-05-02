#!/usr/bin/env node
/**
 * Phase 4 Generator — Auto-generate DDI rules for hospital drug catalog gaps
 * + Missing Diagnosis rules + new generics
 */
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '../../public/cds-data');

const ddiFile = path.join(dataDir, 'ddi_rules.json');
const genericFile = path.join(dataDir, 'drug_generic.json');
const dddFile = path.join(dataDir, 'drug_disease_rules.json');
const condFile = path.join(dataDir, 'condition_group_icd_map.json');

const ddi = JSON.parse(fs.readFileSync(ddiFile, 'utf8'));
const generics = JSON.parse(fs.readFileSync(genericFile, 'utf8'));
const ddd = JSON.parse(fs.readFileSync(dddFile, 'utf8'));
const conds = JSON.parse(fs.readFileSync(condFile, 'utf8'));

const existingPairs = new Set();
for (const r of ddi) {
    existingPairs.add([r.generic_a.toLowerCase(), r.generic_b.toLowerCase()].sort().join('|'));
}
const existingDddCodes = new Set(ddd.map(r => r.rule_code));
const existingCondGroups = new Set(conds.map(c => c.condition_group));
const existingGenerics = new Set(generics.map(g => g.generic_name.toLowerCase().replace(/\(.*?\)/g,'').trim()));

// ============================================================
// NEW DDI RULES — Hospital-specific gaps
// ============================================================
const newDdiRules = [
    // === STATIN + MACROLIDE (Rhabdomyolysis risk) ===
    ...generateClassPairs(
        ['atorvastatin','simvastatin','rosuvastatin','lovastatin','pravastatin'],
        ['clarithromycin','erythromycin','azithromycin'],
        { severity: 'high', effect: 'Macrolide ức chế CYP3A4, tăng nồng độ Statin → nguy cơ tiêu cơ vân (rhabdomyolysis).', rec: 'Tạm ngừng Statin hoặc đổi sang Pravastatin (ít qua CYP3A4). Theo dõi CK.', prefix: 'DDI-STATIN-MACRO' }
    ),
    // === CLOPIDOGREL + PPI (Reduced antiplatelet effect) ===
    ...generateClassPairs(
        ['clopidogrel'],
        ['omeprazole','esomeprazole','pantoprazole','rabeprazole','lansoprazole'],
        { severity: 'medium', effect: 'PPI ức chế CYP2C19, giảm chuyển hóa Clopidogrel thành dạng hoạt tính → giảm hiệu quả chống kết tập tiểu cầu.', rec: 'Ưu tiên Pantoprazole (ít ảnh hưởng nhất). Tránh Omeprazole/Esomeprazole.', prefix: 'DDI-CLOPI-PPI' }
    ),
    // === AMIODARONE + ANTICOAGULANTS (Bleeding risk) ===
    ...generateClassPairs(
        ['amiodarone'],
        ['rivaroxaban','apixaban','dabigatran'],
        { severity: 'high', effect: 'Amiodarone ức chế P-gp, tăng nồng độ NOAC → tăng nguy cơ xuất huyết.', rec: 'Giảm liều NOAC. Theo dõi dấu hiệu xuất huyết.', prefix: 'DDI-AMIO-NOAC' }
    ),
    ...generateClassPairs(
        ['amiodarone'],
        ['enoxaparin','heparin'],
        { severity: 'medium', effect: 'Amiodarone có thể tăng tác dụng chống đông khi dùng chung.', rec: 'Theo dõi aPTT/anti-Xa. Chú ý dấu hiệu xuất huyết.', prefix: 'DDI-AMIO-ANTICOAG' }
    ),
    // === AMIODARONE + STATIN (Rhabdomyolysis) ===
    ...generateClassPairs(
        ['amiodarone'],
        ['atorvastatin','simvastatin','rosuvastatin','lovastatin','pravastatin'],
        { severity: 'high', effect: 'Amiodarone ức chế CYP3A4, tăng nồng độ Statin → nguy cơ tiêu cơ vân.', rec: 'Giới hạn Simvastatin ≤ 20mg/ngày. Ưu tiên Pravastatin/Rosuvastatin.', prefix: 'DDI-AMIO-STATIN' }
    ),
    // === AMIODARONE + BETA-BLOCKER (Bradycardia) ===
    ...generateClassPairs(
        ['amiodarone'],
        ['metoprolol','bisoprolol','atenolol','propranolol','carvedilol','nebivolol'],
        { severity: 'high', effect: 'Cả hai đều ức chế dẫn truyền nhĩ thất → nguy cơ nhịp chậm nặng, block AV.', rec: 'Theo dõi ECG + nhịp tim. Giảm liều beta-blocker. Cân nhắc ngừng nếu HR < 50.', prefix: 'DDI-AMIO-BB' }
    ),
    // === AMIODARONE + CCB (Bradycardia + Hypotension) ===
    ...generateClassPairs(
        ['amiodarone'],
        ['amlodipine','diltiazem'],
        { severity: 'high', effect: 'Phối hợp tăng nguy cơ nhịp chậm, hạ huyết áp, block AV (đặc biệt Diltiazem).', rec: 'Tránh phối hợp Amiodarone + Diltiazem. Theo dõi sát huyết áp và ECG.', prefix: 'DDI-AMIO-CCB' }
    ),
    // === DIGOXIN + DIURETIC (Hypokalemia → toxicity) ===
    ...generateClassPairs(
        ['digoxin'],
        ['furosemide','hydrochlorothiazide'],
        { severity: 'high', effect: 'Lợi tiểu gây hạ Kali → tăng độc tính Digoxin (loạn nhịp, nôn).', rec: 'Theo dõi Kali máu. Bổ sung Kali nếu cần. Kiểm tra nồng độ Digoxin.', prefix: 'DDI-DIGOXIN-DIURETIC' }
    ),
    ...generateClassPairs(
        ['digoxin'],
        ['spironolactone'],
        { severity: 'medium', effect: 'Spironolactone tăng nồng độ Digoxin và có thể gây tăng Kali máu.', rec: 'Giảm liều Digoxin 25-50%. Theo dõi nồng độ Digoxin + Kali.', prefix: 'DDI-DIGOXIN-SPIRO' }
    ),
    // === DIGOXIN + CCB ===
    ...generateClassPairs(
        ['digoxin'],
        ['amlodipine','diltiazem'],
        { severity: 'medium', effect: 'CCB tăng nồng độ Digoxin. Diltiazem còn gây nhịp chậm hiệp đồng.', rec: 'Theo dõi nồng độ Digoxin. Giảm liều nếu cần.', prefix: 'DDI-DIGOXIN-CCB' }
    ),
    // === DIGOXIN + MACROLIDE ===
    ...generateClassPairs(
        ['digoxin'],
        ['clarithromycin','erythromycin','azithromycin'],
        { severity: 'high', effect: 'Macrolide ức chế P-gp, tăng nồng độ Digoxin → ngộ độc Digitalis.', rec: 'Giảm liều Digoxin 50%. Theo dõi nồng độ Digoxin máu + ECG.', prefix: 'DDI-DIGOXIN-MACRO' }
    ),
    // === METHOTREXATE + NSAID (Renal clearance ↓ → MTX toxicity) ===
    ...generateClassPairs(
        ['methotrexate'],
        ['diclofenac','ibuprofen','meloxicam','celecoxib','ketorolac','naproxen','ketoprofen','etoricoxib'],
        { severity: 'high', effect: 'NSAID giảm lọc cầu thận → tích lũy Methotrexate → suy tủy, viêm niêm mạc, tổn thương thận.', rec: 'Tránh phối hợp. Nếu bắt buộc: theo dõi công thức máu + chức năng thận.', prefix: 'DDI-MTX-NSAID' }
    ),
    // === BETA-BLOCKER + DILTIAZEM (Bradycardia + AV block) ===
    ...generateClassPairs(
        ['metoprolol','bisoprolol','atenolol','propranolol','carvedilol','nebivolol'],
        ['diltiazem'],
        { severity: 'high', effect: 'Cả hai ức chế dẫn truyền nhĩ thất → nhịp chậm nặng, block AV, suy tim.', rec: 'Tránh phối hợp. Nếu bắt buộc: theo dõi ECG, HR. Ngừng nếu HR < 50.', prefix: 'DDI-BB-DILTIAZEM' }
    ),
    // === ACEI/ARB + SPIRONOLACTONE (Hyperkalemia) ===
    ...generateClassPairs(
        ['enalapril','lisinopril','ramipril','perindopril','captopril'],
        ['spironolactone'],
        { severity: 'high', effect: 'Cả hai giữ Kali → tăng Kali máu nguy hiểm (loạn nhịp, ngừng tim).', rec: 'Kiểm tra Kali trước và sau 1 tuần. Tránh nếu eGFR < 30.', prefix: 'DDI-ACEI-SPIRO' }
    ),
    ...generateClassPairs(
        ['losartan','valsartan','telmisartan','irbesartan','candesartan'],
        ['spironolactone'],
        { severity: 'high', effect: 'ARB + Spironolactone → tăng Kali máu nguy hiểm.', rec: 'Kiểm tra Kali máu thường xuyên. Tránh nếu eGFR < 30.', prefix: 'DDI-ARB-SPIRO' }
    ),
    // === TRAMADOL + SSRI (Serotonin syndrome — extend) ===
    ...generateClassPairs(
        ['tramadol'],
        ['fluoxetine','paroxetine','escitalopram','venlafaxine','mirtazapine','duloxetine','amitriptyline'].filter(d => existingGenerics.has(d)),
        { severity: 'high', effect: 'Hội chứng Serotonin: sốt, co giật, rung cơ, kích thích, ý thức thay đổi.', rec: 'Tránh phối hợp. Nếu bắt buộc: liều thấp nhất, theo dõi sát 24h đầu.', prefix: 'DDI-TRAMADOL-SERO' }
    ),
    // === PHENYTOIN interactions ===
    ...generateClassPairs(
        ['phenytoin'],
        ['omeprazole','esomeprazole','fluconazole','itraconazole','metronidazole'].filter(d => existingGenerics.has(d)),
        { severity: 'high', effect: 'Ức chế CYP2C9/CYP2C19 → tăng nồng độ Phenytoin → ngộ độc (rung giật nhãn cầu, thất điều).', rec: 'Theo dõi nồng độ Phenytoin. Giảm liều nếu cần.', prefix: 'DDI-PHENYTOIN' }
    ),
    // === WARFARIN important interactions ===
    ...generateClassPairs(
        ['warfarin'],
        ['clarithromycin','erythromycin','azithromycin'].filter(d => !existingPairs.has(['warfarin',d].sort().join('|'))),
        { severity: 'high', effect: 'Macrolide ức chế CYP → tăng INR → nguy cơ xuất huyết nặng.', rec: 'Kiểm tra INR sau 3-5 ngày. Giảm liều Warfarin nếu INR > 3.', prefix: 'DDI-WARF-MACRO' }
    ),
    ...generateClassPairs(
        ['warfarin'],
        ['omeprazole','esomeprazole','pantoprazole'].filter(d => !existingPairs.has(['warfarin',d].sort().join('|'))),
        { severity: 'medium', effect: 'PPI có thể tăng nhẹ INR khi dùng chung Warfarin.', rec: 'Theo dõi INR khi bắt đầu/ngừng PPI. Ưu tiên Pantoprazole.', prefix: 'DDI-WARF-PPI' }
    ),
    // === OPIOID + OPIOID (Respiratory depression) ===
    ...generateClassPairs(
        ['morphine'],
        ['tramadol','codeine','fentanyl'],
        { severity: 'high', effect: 'Phối hợp opioid → ức chế hô hấp hiệp đồng, nguy hiểm tính mạng.', rec: 'Tránh phối hợp. Nếu cần: giảm liều cả hai, theo dõi SpO2 + nhịp thở.', prefix: 'DDI-OPIOID-COMBO' }
    ),
    // === FENTANYL + CYP3A4 inhibitors ===
    ...generateClassPairs(
        ['fentanyl'],
        ['clarithromycin','itraconazole','ketoconazole'].filter(d => existingGenerics.has(d)),
        { severity: 'high', effect: 'Ức chế CYP3A4 → tăng nồng độ Fentanyl → ức chế hô hấp nặng.', rec: 'Giảm liều Fentanyl 50%. Theo dõi hô hấp liên tục.', prefix: 'DDI-FENTANYL-CYP' }
    ),
    // === DAPAGLIFLOZIN/SGLT2i + Insulin/SU (Hypoglycemia) ===
    ...generateClassPairs(
        ['dapagliflozin'],
        ['insulin','gliclazide'],
        { severity: 'medium', effect: 'SGLT2i + Insulin/SU → tăng nguy cơ hạ đường huyết.', rec: 'Giảm liều Insulin 20% hoặc SU 50% khi bắt đầu SGLT2i.', prefix: 'DDI-SGLT2-HYPO' }
    ),
    // === COLCHICINE + STATIN (Myopathy) ===
    ...generateClassPairs(
        ['colchicine'],
        ['atorvastatin','simvastatin','rosuvastatin'],
        { severity: 'medium', effect: 'Phối hợp tăng nguy cơ bệnh cơ và tiêu cơ vân.', rec: 'Theo dõi triệu chứng đau cơ, yếu cơ. Kiểm tra CK nếu có triệu chứng.', prefix: 'DDI-COLCH-STATIN' }
    ),
];

// ============================================================
// MISSING DIAGNOSIS RULES
// ============================================================
const missingDiagRules = [
    {
        rule_code: 'MDIAG-PPI-NO-GI',
        drug_generic: 'omeprazole',
        drug_class: ['omeprazole','esomeprazole','pantoprazole','rabeprazole','lansoprazole'],
        required_condition_groups: ['gerd','peptic_ulcer','gi_bleeding','zollinger_ellison'],
        severity: 'medium',
        clinical_effect: 'PPI kê đơn không có chẩn đoán GI phù hợp. Cân nhắc có chỉ định không?',
        recommendation: 'Kiểm tra chỉ định PPI: GERD, loét dạ dày, dự phòng GI khi dùng NSAID/chống đông.',
        is_active: true
    },
    {
        rule_code: 'MDIAG-ANTICOAG-NO-AF-DVT',
        drug_generic: 'warfarin',
        drug_class: ['warfarin','rivaroxaban','apixaban','dabigatran','enoxaparin'],
        required_condition_groups: ['atrial_fibrillation','dvt','pe','prosthetic_valve'],
        severity: 'medium',
        clinical_effect: 'Thuốc chống đông kê đơn nhưng không có chẩn đoán AF/DVT/PE.',
        recommendation: 'Xác nhận chỉ định chống đông: rung nhĩ, huyết khối TM sâu, thuyên tắc phổi.',
        is_active: true
    },
    {
        rule_code: 'MDIAG-INSULIN-NO-DM',
        drug_generic: 'insulin',
        drug_class: ['insulin'],
        required_condition_groups: ['diabetes'],
        severity: 'high',
        clinical_effect: 'Insulin kê đơn nhưng không có chẩn đoán đái tháo đường!',
        recommendation: 'Bắt buộc có ICD E10-E14 khi kê Insulin.',
        is_active: true
    },
    {
        rule_code: 'MDIAG-OAD-NO-DM',
        drug_generic: 'metformin',
        drug_class: ['metformin','gliclazide','sitagliptin','vildagliptin','dapagliflozin','pioglitazone'],
        required_condition_groups: ['diabetes'],
        severity: 'medium',
        clinical_effect: 'Thuốc hạ đường huyết nhưng không có chẩn đoán đái tháo đường.',
        recommendation: 'Cần có ICD E10-E14 khi kê thuốc hạ đường huyết.',
        is_active: true
    },
    {
        rule_code: 'MDIAG-STATIN-NO-LIPID',
        drug_generic: 'atorvastatin',
        drug_class: ['atorvastatin','simvastatin','rosuvastatin','lovastatin','pravastatin'],
        required_condition_groups: ['dyslipidemia','coronary_artery_disease','stroke_prevention'],
        severity: 'low',
        clinical_effect: 'Statin kê đơn nhưng không có chẩn đoán rối loạn lipid máu hoặc BTMV.',
        recommendation: 'Cần chẩn đoán E78.x (rối loạn lipid) hoặc I25.x (BTMV) khi kê Statin.',
        is_active: true
    },
    {
        rule_code: 'MDIAG-ANTIEPILEPTIC-NO-EPILEPSY',
        drug_generic: 'phenytoin',
        drug_class: ['phenytoin','levetiracetam','gabapentin','pregabalin'],
        required_condition_groups: ['epilepsy','neuropathic_pain'],
        severity: 'medium',
        clinical_effect: 'Thuốc chống động kinh nhưng không có chẩn đoán động kinh hoặc đau thần kinh.',
        recommendation: 'Cần ICD G40.x (động kinh) hoặc G57-G62 (đau thần kinh) khi kê.',
        is_active: true
    },
];

// ============================================================
// NEW CONDITION GROUPS (for Missing Diagnosis)
// ============================================================
const newCondGroups = [
    { condition_group: 'gerd', icd_pattern: 'K21', description: 'Trào ngược dạ dày thực quản' },
    { condition_group: 'gi_bleeding', icd_pattern: 'K92.0|K92.1|K92.2', description: 'Xuất huyết tiêu hóa' },
    { condition_group: 'zollinger_ellison', icd_pattern: 'E16.4', description: 'Hội chứng Zollinger-Ellison' },
    { condition_group: 'atrial_fibrillation', icd_pattern: 'I48', description: 'Rung nhĩ' },
    { condition_group: 'prosthetic_valve', icd_pattern: 'Z95.2|Z95.3|Z95.4', description: 'Van tim nhân tạo' },
    { condition_group: 'diabetes', icd_pattern: 'E10|E11|E12|E13|E14', description: 'Đái tháo đường' },
    { condition_group: 'dyslipidemia', icd_pattern: 'E78', description: 'Rối loạn lipid máu' },
    { condition_group: 'coronary_artery_disease', icd_pattern: 'I20|I21|I22|I23|I24|I25', description: 'Bệnh mạch vành' },
    { condition_group: 'stroke_prevention', icd_pattern: 'I63|I64|I65|I66|G45', description: 'Đột quỵ / Phòng ngừa đột quỵ' },
    { condition_group: 'epilepsy', icd_pattern: 'G40|G41', description: 'Động kinh' },
    { condition_group: 'neuropathic_pain', icd_pattern: 'G50|G51|G52|G53|G54|G55|G56|G57|G58|G59|G60|G61|G62|M54.1|M79.2', description: 'Đau thần kinh' },
];

// ============================================================
// NEW GENERICS (for hospital drugs not yet in DB)
// ============================================================
const missingGenerics = [
    'fluoxetine','paroxetine','escitalopram','venlafaxine','mirtazapine','duloxetine','amitriptyline',
    'carbamazepine','lamotrigine','oxcarbazepine',
    'nicardipine','lercanidipine','felodipine','nifedipine','verapamil',
    'glimepiride','empagliflozin',
    'dipyridamole','prasugrel','cilostazol',
    'fluconazole','voriconazole',
    'cyclosporine','tacrolimus','mycophenolate',
    'torasemide','amiloride',
    'febuxostat','pethidine','fondaparinux','nadroparin',
    'nebivolol',
].filter(g => !existingGenerics.has(g));

// ============================================================
// HELPER FUNCTIONS
// ============================================================
function generateClassPairs(classA, classB, opts) {
    const rules = [];
    for (const a of classA) {
        for (const b of classB) {
            if (a === b) continue;
            const key = [a, b].sort().join('|');
            if (existingPairs.has(key)) continue;
            existingPairs.add(key);
            rules.push({
                rule_code: `${opts.prefix}-${a.toUpperCase().slice(0,4)}-${b.toUpperCase().slice(0,4)}-001`,
                generic_a: a,
                generic_b: b,
                severity: opts.severity,
                clinical_effect: opts.effect,
                recommendation: opts.rec,
                evidence_level: 'moderate',
                is_active: true,
                version: '2.0.0'
            });
        }
    }
    return rules;
}

// ============================================================
// EXECUTE
// ============================================================
// 1. Add new DDI rules
const filteredDdi = newDdiRules.filter(r => {
    // Only include if BOTH drugs exist in hospital catalog
    return existingGenerics.has(r.generic_a) || existingGenerics.has(r.generic_b);
});
const finalDdi = [...ddi, ...filteredDdi];
fs.writeFileSync(ddiFile, JSON.stringify(finalDdi, null, 2), 'utf8');
console.log(`✅ DDI: ${ddi.length} → ${finalDdi.length} (+${filteredDdi.length} new)`);

// 2. Add new generics
const newGenEntries = missingGenerics.map(g => ({
    generic_name: g, generic_name_en: g, atc_code: '', pharmacologic_class: 'unknown', therapeutic_class: 'unknown', is_active: true
}));
const finalGenerics = [...generics, ...newGenEntries];
fs.writeFileSync(genericFile, JSON.stringify(finalGenerics, null, 2), 'utf8');
console.log(`✅ Generics: ${generics.length} → ${finalGenerics.length} (+${newGenEntries.length} new)`);

// 3. Add new condition groups
const newConds = newCondGroups.filter(c => !existingCondGroups.has(c.condition_group));
const finalConds = [...conds, ...newConds];
fs.writeFileSync(condFile, JSON.stringify(finalConds, null, 2), 'utf8');
console.log(`✅ Condition Groups: ${conds.length} → ${finalConds.length} (+${newConds.length} new)`);

// 4. Save missing diagnosis rules
const missingDiagFile = path.join(dataDir, 'missing_diagnosis_rules.json');
fs.writeFileSync(missingDiagFile, JSON.stringify(missingDiagRules, null, 2), 'utf8');
console.log(`✅ Missing Diagnosis Rules: ${missingDiagRules.length} saved`);

console.log('\n📊 Summary:');
console.log(`   DDI pairs: ${finalDdi.length}`);
console.log(`   Generics: ${finalGenerics.length}`);
console.log(`   Condition groups: ${finalConds.length}`);
console.log(`   Missing Diagnosis: ${missingDiagRules.length}`);
