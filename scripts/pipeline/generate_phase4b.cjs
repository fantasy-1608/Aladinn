#!/usr/bin/env node
/**
 * Phase 4b — Fill remaining hospital DDI gaps
 * Covers: Corticoids, CCB, Antiepileptics, Antifungals, Immunosuppressants, etc.
 */
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '../../public/cds-data');
const ddiFile = path.join(dataDir, 'ddi_rules.json');
const genericFile = path.join(dataDir, 'drug_generic.json');

const ddi = JSON.parse(fs.readFileSync(ddiFile, 'utf8'));
const generics = JSON.parse(fs.readFileSync(genericFile, 'utf8'));
const existingPairs = new Set();
for (const r of ddi) existingPairs.add([r.generic_a.toLowerCase(), r.generic_b.toLowerCase()].sort().join('|'));
const existingGenerics = new Set(generics.map(g => g.generic_name.toLowerCase().replace(/\(.*?\)/g,'').trim()));

function addPair(a, b, sev, effect, rec, prefix) {
    if (a === b) return null;
    const key = [a, b].sort().join('|');
    if (existingPairs.has(key)) return null;
    existingPairs.add(key);
    return {
        rule_code: `${prefix}-${a.toUpperCase().slice(0,5)}-${b.toUpperCase().slice(0,5)}-001`,
        generic_a: a, generic_b: b, severity: sev,
        clinical_effect: effect, recommendation: rec,
        evidence_level: 'moderate', is_active: true, version: '2.0.0'
    };
}

const newRules = [];
function add(a,b,s,e,r,p) { const rule = addPair(a,b,s,e,r,p); if(rule) newRules.push(rule); }

// === CORTICOID + NSAID (GI bleeding) ===
const corticoids = ['dexamethasone','prednisolone','methylprednisolone'];
const nsaids = ['diclofenac','ibuprofen','meloxicam','celecoxib','ketorolac','naproxen','ketoprofen','etoricoxib','tenoxicam'];
for (const c of corticoids) for (const n of nsaids) {
    add(c, n, 'high', 'Corticoid + NSAID → tăng gấp 4-12 lần nguy cơ xuất huyết tiêu hóa.', 'Tránh phối hợp. Nếu cần: thêm PPI bảo vệ dạ dày.', 'DDI-CORTI-NSAID');
}

// === CORTICOID + Antidiabetic (Hyperglycemia) ===
const antidiab = ['metformin','gliclazide','glimepiride','insulin','sitagliptin','vildagliptin','dapagliflozin','empagliflozin','pioglitazone'];
for (const c of corticoids) for (const d of antidiab.filter(x => existingGenerics.has(x))) {
    add(c, d, 'medium', 'Corticoid tăng đường huyết → giảm hiệu quả thuốc hạ đường huyết.', 'Tăng tần suất theo dõi đường huyết. Có thể cần tăng liều thuốc ĐTĐ.', 'DDI-CORTI-DM');
}

// === CORTICOID + Anticoagulant (Bleeding) ===
const anticoag = ['warfarin','enoxaparin','rivaroxaban','apixaban','dabigatran'];
for (const c of corticoids) for (const a of anticoag) {
    add(c, a, 'medium', 'Corticoid + chống đông → tăng nguy cơ xuất huyết (đặc biệt GI).', 'Theo dõi INR/dấu hiệu xuất huyết. Thêm PPI nếu dùng kéo dài.', 'DDI-CORTI-ANTICOAG');
}

// === CCB (Amlodipine/Nifedipine/Verapamil) + Beta-blocker ===
// Amlodipine+BB is generally safe (dihydropyridine), chỉ warn
const betablockers = ['metoprolol','bisoprolol','atenolol','propranolol','carvedilol','nebivolol'];
for (const b of betablockers) {
    add('amlodipine', b, 'low', 'Amlodipine + Beta-blocker: phối hợp thường an toàn nhưng theo dõi HA + nhịp tim.', 'Theo dõi huyết áp và nhịp tim. Thường an toàn khi dùng đúng liều.', 'DDI-AMLO-BB');
    add('nifedipine', b, 'low', 'Nifedipine + Beta-blocker: có thể gây hạ HA quá mức.', 'Theo dõi huyết áp. Tránh dùng Nifedipine tác dụng ngắn.', 'DDI-NIFE-BB');
}
// Verapamil+BB is DANGEROUS (non-dihydropyridine)
for (const b of betablockers) {
    add('verapamil', b, 'high', 'Verapamil + Beta-blocker → nhịp chậm nặng, block AV, suy tim. TRÁNH PHỐI HỢP!', 'Chống chỉ định phối hợp IV. PO: chỉ dùng khi theo dõi ECG chặt.', 'DDI-VERAP-BB');
}

// === Fluconazole interactions ===
const statins = ['atorvastatin','simvastatin','rosuvastatin','lovastatin','pravastatin'];
for (const s of statins) add('fluconazole', s, 'high', 'Fluconazole ức chế CYP3A4/2C9 → tăng nồng độ Statin → tiêu cơ vân.', 'Tạm ngừng Statin trong thời gian dùng Fluconazole.', 'DDI-FLUCO-STATIN');
add('fluconazole', 'warfarin', 'high', 'Fluconazole ức chế CYP2C9 → tăng INR → xuất huyết.', 'Giảm liều Warfarin 50%. Theo dõi INR mỗi 2-3 ngày.', 'DDI-FLUCO-WARF');
add('fluconazole', 'phenytoin', 'high', 'Fluconazole ức chế CYP2C9 → tăng nồng độ Phenytoin → ngộ độc.', 'Giảm liều Phenytoin. Theo dõi nồng độ.', 'DDI-FLUCO-PHENY');
add('fluconazole', 'carbamazepine', 'high', 'Fluconazole tăng nồng độ Carbamazepine → ngộ độc.', 'Theo dõi nồng độ Carbamazepine. Giảm liều nếu cần.', 'DDI-FLUCO-CBZ');
add('fluconazole', 'midazolam', 'high', 'Fluconazole ức chế CYP3A4 → tăng nồng độ Midazolam → an thần quá mức.', 'Giảm liều Midazolam 50%. Theo dõi hô hấp.', 'DDI-FLUCO-MIDA');
add('fluconazole', 'cyclosporine', 'high', 'Fluconazole tăng nồng độ Cyclosporine → độc thận.', 'Giảm liều Cyclosporine 50%. Theo dõi nồng độ + creatinine.', 'DDI-FLUCO-CYCLO');
add('fluconazole', 'tacrolimus', 'high', 'Fluconazole tăng nồng độ Tacrolimus → độc thận, run tay.', 'Giảm liều Tacrolimus. Theo dõi nồng độ + chức năng thận.', 'DDI-FLUCO-TACRO');

// === Carbamazepine interactions ===
add('carbamazepine', 'warfarin', 'high', 'Carbamazepine cảm ứng CYP → giảm nồng độ Warfarin → mất hiệu quả chống đông.', 'Tăng liều Warfarin. Theo dõi INR chặt khi bắt đầu/ngừng CBZ.', 'DDI-CBZ-WARF');
add('carbamazepine', 'phenytoin', 'high', 'Tương tác phức tạp: cả hai cảm ứng CYP lẫn nhau.', 'Theo dõi nồng độ cả hai thuốc. Hiệu chỉnh liều.', 'DDI-CBZ-PHENY');
for (const s of statins) add('carbamazepine', s, 'medium', 'Carbamazepine cảm ứng CYP3A4 → giảm nồng độ Statin → mất hiệu quả.', 'Tăng liều Statin hoặc đổi sang Pravastatin/Rosuvastatin.', 'DDI-CBZ-STATIN');
add('carbamazepine', 'clarithromycin', 'high', 'Clarithromycin ức chế CYP3A4 → tăng nồng độ CBZ → ngộ độc (chóng mặt, nhìn đôi, thất điều).', 'Tránh phối hợp. Dùng Azithromycin thay thế.', 'DDI-CBZ-CLARI');
add('carbamazepine', 'erythromycin', 'high', 'Erythromycin ức chế CYP3A4 → tăng nồng độ CBZ → ngộ độc.', 'Tránh phối hợp. Dùng Azithromycin.', 'DDI-CBZ-ERYTH');

// === Cyclosporine/Tacrolimus ===
for (const n of nsaids) {
    add('cyclosporine', n, 'high', 'NSAID + Cyclosporine → tăng độc thận hiệp đồng.', 'Tránh NSAID. Dùng Paracetamol thay thế.', 'DDI-CYCLO-NSAID');
    add('tacrolimus', n, 'high', 'NSAID + Tacrolimus → tăng độc thận.', 'Tránh NSAID. Dùng Paracetamol thay thế.', 'DDI-TACRO-NSAID');
}
add('cyclosporine', 'methotrexate', 'high', 'Cả hai gây ức chế miễn dịch + độc thận.', 'Theo dõi chức năng thận + công thức máu chặt.', 'DDI-CYCLO-MTX');

// === Midazolam + CYP3A4 inhibitors ===
add('midazolam', 'clarithromycin', 'high', 'Clarithromycin tăng nồng độ Midazolam → an thần kéo dài.', 'Giảm liều Midazolam 50-75%.', 'DDI-MIDA-CLARI');
add('midazolam', 'itraconazole', 'high', 'Itraconazole tăng nồng độ Midazolam.', 'Tránh phối hợp PO Midazolam. IV giảm liều.', 'DDI-MIDA-ITRA');
add('midazolam', 'ketoconazole', 'high', 'Ketoconazole tăng nồng độ Midazolam.', 'Tránh phối hợp.', 'DDI-MIDA-KETO');

// === Pioglitazone ===
add('pioglitazone', 'insulin', 'medium', 'TZD + Insulin → tăng nguy cơ hạ đường huyết + phù + suy tim.', 'Giảm liều Insulin 10-25%. Theo dõi cân nặng + phù.', 'DDI-PIOG-INSU');
add('pioglitazone', 'furosemide', 'medium', 'Pioglitazone giữ nước + Furosemide thải nước: theo dõi cân bằng dịch.', 'Theo dõi cân nặng, phù, chức năng tim.', 'DDI-PIOG-FURO');

// === DAPAGLIFLOZIN + Diuretic (Dehydration) ===
add('dapagliflozin', 'furosemide', 'medium', 'SGLT2i + Lợi tiểu → mất nước + hạ HA tư thế. Nguy cơ suy thận cấp.', 'Giảm liều lợi tiểu. Theo dõi HA tư thế + creatinine.', 'DDI-DAPA-FURO');
add('empagliflozin', 'furosemide', 'medium', 'SGLT2i + Lợi tiểu → mất nước.', 'Giảm liều lợi tiểu. Theo dõi HA + creatinine.', 'DDI-EMPA-FURO');

// === Tramadol + Codeine ===
add('tramadol', 'codeine', 'high', 'Phối hợp opioid → ức chế hô hấp hiệp đồng.', 'Tránh phối hợp. Chọn một opioid duy nhất.', 'DDI-TRAM-CODE');

// === Amitriptyline ===
add('amitriptyline', 'tramadol', 'high', 'TCA + Tramadol → hội chứng Serotonin + hạ ngưỡng co giật.', 'Tránh phối hợp. Nếu cần: liều thấp nhất.', 'DDI-AMIT-TRAM');
add('amitriptyline', 'morphine', 'high', 'TCA + Opioid → ức chế CNS hiệp đồng (hô hấp, ý thức).', 'Giảm liều cả hai. Theo dõi SpO2.', 'DDI-AMIT-MORPH');
add('amitriptyline', 'amiodarone', 'high', 'Cả hai kéo dài QT → loạn nhịp thất (Torsades de Pointes).', 'Tránh phối hợp. Kiểm tra ECG (QTc).', 'DDI-AMIT-AMIO');
add('amitriptyline', 'fluconazole', 'medium', 'Fluconazole tăng nồng độ Amitriptyline → tác dụng phụ TCA.', 'Theo dõi tác dụng phụ: khô miệng, táo bón, bí tiểu.', 'DDI-AMIT-FLUCO');

// === Moxifloxacin (QT prolongation) ===
add('moxifloxacin', 'amiodarone', 'high', 'Cả hai kéo dài QT → Torsades de Pointes.', 'TRÁNH phối hợp. Kiểm tra QTc.', 'DDI-MOXI-AMIO');
add('moxifloxacin', 'domperidone', 'high', 'Cả hai kéo dài QT → loạn nhịp.', 'Tránh phối hợp.', 'DDI-MOXI-DOMP');
add('moxifloxacin', 'amitriptyline', 'high', 'Kéo dài QT hiệp đồng.', 'Tránh phối hợp. Kiểm tra QTc.', 'DDI-MOXI-AMIT');

// Add missing generics
const missingGen = ['carbamazepine','midazolam','verapamil','nifedipine','cyclosporine','tacrolimus',
    'phenobarbital','amitriptyline','fluconazole','moxifloxacin','pioglitazone','empagliflozin',
    'glimepiride','prednisolone','methylprednisolone','dexamethasone','nicardipine','lercanidipine',
    'felodipine','vildagliptin','sitagliptin','levetiracetam','pregabalin'
].filter(g => !existingGenerics.has(g));

const newGenEntries = missingGen.map(g => ({
    generic_name: g, generic_name_en: g, atc_code: '', pharmacologic_class: 'unknown', therapeutic_class: 'unknown', is_active: true
}));

// Save
const finalDdi = [...ddi, ...newRules];
fs.writeFileSync(ddiFile, JSON.stringify(finalDdi, null, 2), 'utf8');

if (newGenEntries.length > 0) {
    const finalGen = [...generics, ...newGenEntries];
    fs.writeFileSync(path.join(dataDir, 'drug_generic.json'), JSON.stringify(finalGen, null, 2), 'utf8');
    console.log(`✅ Generics: +${newGenEntries.length} → ${finalGen.length}`);
}

console.log(`✅ DDI: ${ddi.length} → ${finalDdi.length} (+${newRules.length} new)`);
console.log(`\nNew rules by category:`);
const cats = {};
for (const r of newRules) { const c = r.rule_code.split('-').slice(0,3).join('-'); cats[c] = (cats[c]||0)+1; }
for (const [c,n] of Object.entries(cats).sort((a,b)=>b[1]-a[1])) console.log(`  ${c}: ${n}`);
