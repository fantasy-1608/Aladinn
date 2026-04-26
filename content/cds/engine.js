/**
 * 🧞 Aladinn CDS — Rule Engine & Context Normalization
 * Thực hiện nhận chuẩn hóa dữ liệu từ HIS và chạy các quy tắc (Rule Engine).
 */
import {
    openDatabase,
    getDrugGenericMap,
    getBrandMap,
    getConditionGroupMappings,
    getDdiRules,
    getDrugDiseaseRules,
    // getDrugAllergyRules,
    getInsuranceFormulary,
    getInsuranceRules,
    // logAuditEvent
} from './db.js';

const ALIAS_MAP = {
    // Tên thay thế phổ biến
    acetaminophen: 'paracetamol',
    augmentin: 'amoxicillin-clavulanate',
    brufen: 'ibuprofen',
    voltaren: 'diclofenac',
    hemapo: 'erythropoietin',
    epoetin: 'erythropoietin',
    'acid acetylsalicylic': 'aspirin',
    'acetylsalicylic acid': 'aspirin',
    
    // Viết tắt, hậu tố VN
    domperidon: 'domperidone',
    hydroclorothiazid: 'hydrochlorothiazide',
    gliclazid: 'gliclazide',
    cinnarizin: 'cinnarizine',
    sulpirid: 'sulpiride',
    thiamazol: 'thiamazole',
    acetylcystein: 'acetylcysteine',
    'n-acetylcystein': 'acetylcysteine',
    'nacetylcystein': 'acetylcysteine',
    esomeprazol: 'esomeprazole',
    omeprazol: 'omeprazole',
    pantoprazol: 'pantoprazole',
    rabeprazol: 'rabeprazole',
    lansoprazol: 'lansoprazole',
    amlodipin: 'amlodipine',
    furosemid: 'furosemide',
    spironolacton: 'spironolactone',
    amiodaron: 'amiodarone',
    codein: 'codeine',
    dexamethason: 'dexamethasone',
    prednisolon: 'prednisolone',
    methylprednisolon: 'methylprednisolone',

    // BHYT Guard v1.3 — Thuốc bị xuất toán Q1/2026
    itoprid: 'itopride',
    trimetazidin: 'trimetazidine',
    'trimetazidine dihydrochloride': 'trimetazidine',
    vastarel: 'trimetazidine',
    simethicon: 'simethicone',
    simelox: 'simethicone',
    bostogel: 'simethicone',
    gelactive: 'simethicone',
    trihexyphenidyl: 'trihexyphenidyl',
    alusi: 'trihexyphenidyl',
    mezatrihexyl: 'trihexyphenidyl',
    fenofibrat: 'fenofibrate',
    dutasterid: 'dutasteride',
    dutabit: 'dutasteride',
    dutaon: 'dutasteride',
    tamsulosin: 'tamsulosin',
    alanboss: 'tamsulosin',
    prolufo: 'tamsulosin'
};

function applySuffixNormalization(token) {
    if (token.endsWith('prazol')) return token.replace(/prazol$/, 'prazole');
    if (token.endsWith('cilin')) return token.replace(/cilin$/, 'cillin');
    if (token.endsWith('on') && token.length > 5) return token.replace(/on$/, 'one');
    if (token.endsWith('in') && token.length > 5) return token.replace(/in$/, 'ine');
    if (token.endsWith('id') && token.length > 4) return token.replace(/id$/, 'ide');
    return token;
}

// ----- THUẬT TOÁN LEVENSHTEIN DISTANCE (TÌM KIẾM MỜ) -----
function levenshteinDistance(a, b) {
    if (a.length === 0) return b.length;
    if (b.length === 0) return a.length;
    const matrix = Array(a.length + 1).fill().map(() => Array(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
    for (let j = 0; j <= b.length; j++) matrix[0][j] = j;

    for (let i = 1; i <= a.length; i++) {
        for (let j = 1; j <= b.length; j++) {
            const cost = a[i - 1] === b[j - 1] ? 0 : 1;
            matrix[i][j] = Math.min(
                matrix[i - 1][j] + 1,      // Deletion
                matrix[i][j - 1] + 1,      // Insertion
                matrix[i - 1][j - 1] + cost// Substitution
            );
        }
    }
    return matrix[a.length][b.length];
}

function findClosestGeneric(token, genericMap) {
    // Chỉ fuzzy match nếu từ dài >= 5 ký tự để tránh bắt nhầm
    if (token.length < 5) return null;
    let bestMatch = null;
    let minDistance = 3; // Ngưỡng chênh lệch tối đa cho phép (sai khác tối đa 2 ký tự)

    for (const generic of genericMap.keys()) {
        const dist = levenshteinDistance(token, generic);
        // Nếu chênh lệch quá nhỏ (1-2 ký tự) so với độ dài từ
        if (dist < minDistance && dist <= Math.floor(generic.length / 4) + 1) {
            minDistance = dist;
            bestMatch = generic;
        }
    }
    return bestMatch;
}
// ---------------------------------------------------------


function normalizeToken(input) {
    if (!input) return '';
    return input.toLowerCase()
        .replace(/\(.*?\)/g, ' ')
        .replace(/\b\d+([.,]\d+)?\s*(mg|mcg|g|ml|ui|iu|%)\b/gi, ' ')
        .replace(/\b(tab|tabs|tablet|vien|viên|capsule|cap|ong|ống)\b/gi, ' ')
        .replace(/[^a-z0-9\u00C0-\u024F\u1E00-\u1EFF\s-]/gi, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function lookupGeneric(name, genericMap, brandMap) {
    const cleaned = normalizeToken(name);
    if (!cleaned) return null;

    const alias = ALIAS_MAP[cleaned] ?? cleaned;
    if (genericMap.has(alias)) return alias;
    
    let brand = brandMap.get(alias);
    if (brand) return brand.generic_name.toLowerCase();

    const suffixNormalized = applySuffixNormalization(alias);
    if (suffixNormalized !== alias) {
        const aliasedSuffix = ALIAS_MAP[suffixNormalized] ?? suffixNormalized;
        if (genericMap.has(aliasedSuffix)) return aliasedSuffix;
        const brandSuffix = brandMap.get(aliasedSuffix);
        if (brandSuffix) return brandSuffix.generic_name.toLowerCase();
    }

    const candidates = alias.split(' ').filter(Boolean);
    for (const candidate of candidates) {
        for (const token of [candidate, applySuffixNormalization(candidate)]) {
            const aliasedCandidate = ALIAS_MAP[token] ?? token;
            if (genericMap.has(aliasedCandidate)) return aliasedCandidate;
            const brandCandidate = brandMap.get(aliasedCandidate);
            if (brandCandidate) return brandCandidate.generic_name.toLowerCase();
        }
    }
    return null;
}

function mapConditionGroups(icdCodes, mappings) {
    const groups = new Set();
    for (const icdCode of icdCodes) {
        const normalizedCode = (icdCode || '').trim().toUpperCase();
        if (!normalizedCode) continue;
        for (const mapping of mappings) {
            if (normalizedCode.startsWith(mapping.icd_prefix.toUpperCase())) {
                groups.add(mapping.condition_group_code);
            }
        }
    }
    return Array.from(groups).sort();
}

export async function normalizeContext(context) {
    const db = await openDatabase();
    const genericMap = await getDrugGenericMap(db);
    const brandMap = await getBrandMap(db);
    const mappings = await getConditionGroupMappings(db);

    const normalizedDrugs = new Set();
    const unmappedDrugs = [];
    
    for (const med of (context.medications || [])) {
        const genericCandidate = med.generic_candidate ? normalizeToken(med.generic_candidate) : null;
        let normalized = null;
        
        // Ưu tiên hoạt chất (generic_candidate) nhưng PHẢI qua ALIAS_MAP + suffix normalization
        if (genericCandidate) {
            // Thử ALIAS_MAP trước (VD: "omeprazol" → "omeprazole")
            const aliased = ALIAS_MAP[genericCandidate] ?? genericCandidate;
            if (genericMap.has(aliased)) {
                normalized = aliased;
            } else {
                // Thử suffix normalization (VD: "esomeprazol" → "esomeprazole")
                const suffixed = applySuffixNormalization(aliased);
                const aliasedSuffixed = ALIAS_MAP[suffixed] ?? suffixed;
                if (genericMap.has(aliasedSuffixed)) {
                    normalized = aliasedSuffixed;
                }
            }
        }
        
        // Fallback 1: lookup từ tên thương mại
        if (!normalized) {
            normalized = lookupGeneric(med.display_name, genericMap, brandMap);
        }

        // Fallback 2: FUZZY MATCH (Tìm kiếm mờ) nếu vẫn chưa ra
        if (!normalized) {
            const fuzzyTarget = genericCandidate || normalizeToken(med.display_name);
            if (fuzzyTarget) {
                normalized = findClosestGeneric(fuzzyTarget, genericMap);
            }
        }

        if (normalized) {
            normalizedDrugs.add(normalized);
        } else {
            unmappedDrugs.push(med.display_name.trim());
        }
    }

    const icdCodes = (context.encounter?.diagnoses || []).map(d => d.code).filter(Boolean);
    
    return {
        normalized_drugs: Array.from(normalizedDrugs).sort(),
        condition_groups: mapConditionGroups(icdCodes, mappings),
        raw_drugs: (context.medications || []).map(m => m.display_name),
        icd_codes: icdCodes,
        unmapped_drugs: unmappedDrugs
    };
}

// ----------------- RULE ENGINE RUNNERS -----------------

const SEVERITY_ORDER = { high: 4, medium: 3, low: 2, info: 1 };

function dedupeAlerts(alerts) {
    const grouped = new Map();
    for (const alert of alerts) {
        const matchedStr = Object.entries(alert.matched_items ?? {})
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([k, v]) => `${k}:${[...v].sort().join('|')}`)
            .join(';');
        const key = `${alert.domain}|${matchedStr}|${alert.effect}`;
        
        const existing = grouped.get(key);
        if (!existing || SEVERITY_ORDER[alert.severity] > SEVERITY_ORDER[existing.severity]) {
            grouped.set(key, alert);
        }
    }
    return Array.from(grouped.values());
}

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
                    title: 'Tương tác thuốc',
                    effect: match.clinical_effect || 'Tương tác cần chú ý',
                    recommendation: match.recommendation || 'Theo dõi hoặc thay thế',
                    matched_items: { drug: [a, b] }
                });
            }
        }
    }
    return alerts;
}

function runDrugDiseaseRules(rules, normalized, context) {
    const alerts = [];
    const labs = context.labs || [];
    
    // Build lab lookup map: { code: { value, unit, refRange } }
    const labMap = new Map();
    for (const lab of labs) {
        labMap.set(lab.code, lab);
    }
    
    const hasLowEgfr = labMap.has('eGFR') && labMap.get('eGFR').value < 45;

    for (const rule of rules) {
        if (!rule.is_active) continue;
        const hasDrug = normalized.normalized_drugs.includes(rule.generic_name.toLowerCase());
        const hasCondition = normalized.condition_groups.includes(rule.condition_group_code);
        
        if (!hasDrug || !hasCondition) continue;
        if (rule.rule_code === 'DX-METFORMIN-LOWEGFR-001' && !hasLowEgfr) continue;

        alerts.push({
            rule_code: rule.rule_code,
            domain: 'drug_disease',
            severity: rule.severity,
            title: 'Chống chỉ định/Thận trọng',
            effect: rule.rationale || 'Không phù hợp với bệnh lý.',
            recommendation: rule.recommendation || 'Cân nhắc thay thế',
            matched_items: { drug: [rule.generic_name], condition: [rule.condition_group_code] }
        });
    }
    
    // ===== DRUG-LAB INTERACTION RULES =====
    // These are hardcoded clinical rules that check actual lab values
    if (labs.length > 0) {
        const drugLabAlerts = runDrugLabRules(normalized.normalized_drugs, labMap);
        alerts.push(...drugLabAlerts);
    }
    
    return alerts;
}

/**
 * Drug-Lab Interaction Rules Engine
 * Checks actual lab values against drug safety thresholds
 */
function runDrugLabRules(drugs, labMap) {
    const alerts = [];
    
    const DRUG_LAB_RULES = [
        // === ANTICOAGULANTS + Coagulation ===
        {
            drugs: ['warfarin'],
            lab: 'INR',
            check: (v) => v > 3.0,
            severity: 'high',
            effect: 'INR > 3.0 — Nguy cơ xuất huyết rất cao khi đang dùng Warfarin!',
            recommendation: 'Xem xét giảm liều hoặc tạm ngừng Warfarin. Theo dõi sát INR mỗi 1-2 ngày.'
        },
        {
            drugs: ['warfarin'],
            lab: 'INR',
            check: (v) => v > 2.0 && v <= 3.0,
            severity: 'medium',
            effect: 'INR trong khoảng 2.0-3.0. Liều Warfarin cần theo dõi sát.',
            recommendation: 'Duy trì theo dõi INR định kỳ. Chú ý tương tác thuốc mới thêm.'
        },
        {
            drugs: ['enoxaparin', 'heparin', 'rivaroxaban', 'apixaban', 'dabigatran'],
            lab: 'platelet',
            check: (v) => v < 100,
            severity: 'high',
            effect: 'Tiểu cầu < 100 G/L — Nguy cơ xuất huyết khi dùng thuốc chống đông!',
            recommendation: 'Đánh giá lại chỉ định chống đông. Xem xét giảm liều hoặc ngừng thuốc.'
        },

        // === KIDNEY-CLEARED DRUGS + Creatinine/eGFR ===
        {
            drugs: ['metformin'],
            lab: 'eGFR',
            check: (v) => v < 30,
            severity: 'high',
            effect: 'eGFR < 30 mL/phút — Chống chỉ định Metformin! Nguy cơ nhiễm toan lactic.',
            recommendation: 'Ngừng Metformin ngay. Chuyển sang insulin hoặc thuốc hạ đường huyết khác.'
        },
        {
            drugs: ['metformin'],
            lab: 'eGFR',
            check: (v) => v >= 30 && v < 45,
            severity: 'medium',
            effect: 'eGFR 30-45 mL/phút — Cần giảm liều Metformin.',
            recommendation: 'Giảm liều Metformin tối đa 1000mg/ngày. Theo dõi eGFR mỗi 3 tháng.'
        },
        {
            drugs: ['digoxin'],
            lab: 'creatinine',
            check: (v) => v > 1.5,
            severity: 'high',
            effect: 'Creatinine tăng cao — Nguy cơ tích lũy Digoxin gây ngộ độc!',
            recommendation: 'Giảm liều Digoxin. Theo dõi nồng độ Digoxin máu (mục tiêu 0.5-0.9 ng/mL).'
        },
        {
            drugs: ['gabapentin', 'pregabalin'],
            lab: 'eGFR',
            check: (v) => v < 60,
            severity: 'medium',
            effect: 'eGFR < 60 — Cần hiệu chỉnh liều thuốc bài tiết qua thận.',
            recommendation: 'Giảm liều theo bảng hiệu chỉnh eGFR. Theo dõi tác dụng phụ (buồn ngủ, chóng mặt).'
        },
        {
            drugs: ['colchicin', 'colchicine'],
            lab: 'eGFR',
            check: (v) => v < 30,
            severity: 'high',
            effect: 'eGFR < 30 — Nguy cơ ngộ độc Colchicin rất cao!',
            recommendation: 'Giảm liều tối đa (0.5mg/ngày) hoặc kéo dài khoảng cách liều. Chống chỉ định nếu suy thận nặng kèm dùng clarithromycin.'
        },
        {
            drugs: ['allopurinol'],
            lab: 'eGFR',
            check: (v) => v < 60,
            severity: 'medium',
            effect: 'eGFR < 60 — Cần giảm liều Allopurinol khởi đầu.',
            recommendation: 'Bắt đầu với liều thấp 50-100mg/ngày để tránh hội chứng quá mẫn Allopurinol (AHS).'
        },
        {
            drugs: ['rivaroxaban', 'apixaban', 'dabigatran'],
            lab: 'eGFR',
            check: (v) => v < 15,
            severity: 'high',
            effect: 'eGFR < 15 — Chống chỉ định NOAC (chống đông đường uống mới)!',
            recommendation: 'Ngừng NOAC. Xem xét chuyển sang Warfarin nếu bệnh nhân suy thận giai đoạn cuối.'
        },
        {
            drugs: ['rivaroxaban', 'apixaban', 'dabigatran'],
            lab: 'eGFR',
            check: (v) => v >= 15 && v <= 50,
            severity: 'medium',
            effect: 'eGFR 15-50 — Cần giảm liều NOAC.',
            recommendation: 'Hiệu chỉnh liều chống đông theo chức năng thận để tránh xuất huyết.'
        },

        // === POTASSIUM-AFFECTING DRUGS ===
        {
            drugs: ['spironolactone', 'amiloride', 'triamterene'],
            lab: 'potassium',
            check: (v) => v > 5.0,
            severity: 'high',
            effect: 'Kali máu > 5.0 mEq/L — Nguy cơ tăng kali máu nguy hiểm khi dùng lợi tiểu giữ kali!',
            recommendation: 'Ngừng thuốc lợi tiểu giữ kali. Kiểm tra ECG. Xem xét điều trị hạ kali cấp.'
        },
        {
            drugs: ['enalapril', 'lisinopril', 'ramipril', 'perindopril', 'captopril'],
            lab: 'potassium',
            check: (v) => v > 5.5,
            severity: 'high',
            effect: 'Kali máu > 5.5 mEq/L khi dùng ACEI — Nguy cơ loạn nhịp tim!',
            recommendation: 'Xem xét ngừng ACEI. Kiểm tra ECG. Theo dõi Kali máu sát.'
        },
        {
            drugs: ['furosemide', 'hydrochlorothiazide', 'indapamide'],
            lab: 'potassium',
            check: (v) => v < 3.5,
            severity: 'medium',
            effect: 'Kali máu < 3.5 mEq/L — Hạ kali do lợi tiểu thải kali.',
            recommendation: 'Bổ sung Kali (uống hoặc truyền). Theo dõi điện giải định kỳ.'
        },

        // === LIVER DRUGS + Liver Enzymes ===
        {
            drugs: ['paracetamol', 'acetaminophen'],
            lab: 'ALT',
            check: (v) => v > 120, // 3x ULN
            severity: 'high',
            effect: 'ALT tăng > 3 lần bình thường — Nguy cơ tổn thương gan khi dùng Paracetamol!',
            recommendation: 'Giảm liều hoặc ngừng Paracetamol. Tối đa 2g/ngày nếu bắt buộc dùng.'
        },
        {
            drugs: ['atorvastatin', 'simvastatin', 'rosuvastatin', 'lovastatin'],
            lab: 'ALT',
            check: (v) => v > 120, // 3x ULN
            severity: 'high',
            effect: 'ALT tăng > 3 lần bình thường — Cần đánh giá lại Statin!',
            recommendation: 'Ngừng Statin nếu ALT > 3x ULN kéo dài. Kiểm tra lại sau 2-4 tuần.'
        },

        // === BLOOD SUGAR DRUGS + Glucose ===
        {
            drugs: ['insulin', 'glimepiride', 'gliclazide', 'glipizide'],
            lab: 'glucose',
            check: (v) => v < 3.9,
            severity: 'high',
            effect: 'Đường huyết < 3.9 mmol/L — Hạ đường huyết khi dùng thuốc hạ đường huyết!',
            recommendation: 'Xử trí hạ đường huyết cấp. Xem xét giảm liều insulin/sulfonylurea.'
        },

        // === SODIUM ===
        {
            drugs: ['carbamazepine', 'oxcarbazepine'],
            lab: 'sodium',
            check: (v) => v < 130,
            severity: 'medium',
            effect: 'Natri máu < 130 mEq/L — Hạ Natri máu do thuốc chống động kinh.',
            recommendation: 'Theo dõi Natri máu. Xem xét giảm liều hoặc đổi thuốc.'
        },
    ];

    for (const rule of DRUG_LAB_RULES) {
        const labResult = labMap.get(rule.lab);
        if (!labResult) continue;

        const hasDrug = rule.drugs.some(d => drugs.includes(d));
        if (!hasDrug) continue;

        if (!rule.check(labResult.value)) continue;

        const matchedDrug = rule.drugs.find(d => drugs.includes(d));
        alerts.push({
            rule_code: `DL-${matchedDrug.toUpperCase()}-${rule.lab}-AUTO`,
            domain: 'drug_lab',
            severity: rule.severity,
            title: '⚠️ Xét nghiệm bất thường + Thuốc',
            effect: `${rule.effect} (${rule.lab} = ${labResult.value} ${labResult.unit})`,
            recommendation: rule.recommendation,
            matched_items: { drug: [matchedDrug], lab: [rule.lab], value: [String(labResult.value)] }
        });
    }

    return alerts;
}

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
            severity: 'medium', // Warning
            title: 'Trùng nhóm trị liệu',
            effect: `Bệnh nhân dùng nhiều thuốc cùng nhóm ${bucket}.`,
            recommendation: 'Cảm quan liều lượng hoặc đổi phác đồ.',
            matched_items: { drug: uniqueDrugs }
        });
    }
    return alerts;
}

function runInsuranceRules(formulary, rules, normalized, _context) {
    const alerts = [];
    const formularyMap = new Map(formulary.map(e => [e.generic_name.toLowerCase(), e]));
    
    for (const drug of normalized.normalized_drugs) {
        const entry = formularyMap.get(drug);
        if (entry && !entry.is_covered) {
            alerts.push({
                rule_code: `INS-NOT-COVERED-${drug.toUpperCase()}`,
                domain: 'insurance',
                severity: 'medium', // Warning
                title: 'BHYT Không thanh toán',
                effect: `Thuốc ${drug} không nằm trong danh mục BHYT.`,
                recommendation: entry.note || 'Thông báo bệnh nhân hoặc chọn thuốc khác.',
                matched_items: { drug: [drug] }
            });
        }
    }

    for (const rule of rules) {
        if (!rule.is_active || !normalized.normalized_drugs.includes(rule.generic_name.toLowerCase())) continue;
        
        if (rule.condition_type === 'icd_prefix_required') {
            const allowed = (rule.condition_value || '').split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
            const hasMatch = allowed.length === 0 || normalized.icd_codes.some(icd => allowed.some(p => icd.toUpperCase().startsWith(p)));
            if (!hasMatch) {
                // Bỏ qua cảnh báo BHYT cho Paracetamol/Acetaminophen để tránh Alert Fatigue
                // vì đây là thuốc quá phổ biến, thường dùng cho nhiều mục đích ngoài chẩn đoán chính.
                if (['paracetamol', 'acetaminophen'].includes(rule.generic_name.toLowerCase())) {
                    continue;
                }

                alerts.push({
                    rule_code: rule.rule_code,
                    domain: 'insurance',
                    severity: rule.severity,
                    title: 'Rủi ro xuất toán BHYT',
                    effect: rule.message || 'Thiếu chẩn đoán ICD phù hợp.',
                    recommendation: rule.recommendation || 'Kiểm tra lại chẩn đoán.',
                    matched_items: { drug: [rule.generic_name], icd: normalized.icd_codes },
                    missing_icd: allowed.join(', ')
                });
            }
        }
    }
    return alerts;
}

// ===== PHASE 2: BHYT PRE-CLAIM AUDIT (On-demand) =====

/**
 * Chạy kiểm tra BHYT nâng cao — CHỈ KHI USER BẤM NÚT.
 * Không chạy tự động để tránh ảnh hưởng hiệu năng.
 */
export async function runBhytAuditRules(context) {
    const normalized = await normalizeContext(context);
    const alerts = [];

    // 1. Kiểm tra mã bệnh Z (Khám sức khỏe) cho BN BHYT
    const zCheckCodes = ['Z00', 'Z01', 'Z02'];
    const hasZCode = normalized.icd_codes.some(icd => 
        zCheckCodes.some(z => icd.toUpperCase().startsWith(z))
    );
    if (hasZCode && normalized.normalized_drugs.length > 0) {
        alerts.push({
            rule_code: 'BHYT-AUDIT-Z-CODE',
            domain: 'bhyt_audit',
            severity: 'high',
            title: 'Mã ICD Khám sức khỏe + Kê thuốc BHYT',
            effect: 'ICD chính là Z00-Z02 (Khám sức khỏe), BHYT có thể từ chối thanh toán thuốc ngoài danh mục khám sức khỏe.',
            recommendation: 'Kiểm tra lại: Nếu BN có bệnh lý thực sự, đổi ICD chính sang mã bệnh phù hợp.',
            matched_items: { icd: normalized.icd_codes.filter(c => zCheckCodes.some(z => c.toUpperCase().startsWith(z))) }
        });
    }

    // 2. Insulin không kèm ĐTĐ — gợi ý R73.9 nếu stress hyperglycemia
    const hasInsulin = normalized.normalized_drugs.includes('insulin');
    const hasDiabetesICD = normalized.icd_codes.some(icd => {
        const upper = icd.toUpperCase();
        return upper.startsWith('E10') || upper.startsWith('E11') || upper.startsWith('E12') || upper.startsWith('E13') || upper.startsWith('E14');
    });
    const hasR73 = normalized.icd_codes.some(icd => icd.toUpperCase().startsWith('R73'));
    
    if (hasInsulin && !hasDiabetesICD && !hasR73) {
        // Kiểm tra glucose trong labs
        const labs = context.labs || [];
        const glucoseLab = labs.find(l => l.code === 'glucose' || l.code === 'Glucose');
        const highGlucose = glucoseLab && glucoseLab.value > 11.1;
        
        alerts.push({
            rule_code: 'BHYT-AUDIT-INSULIN-NO-DM',
            domain: 'bhyt_audit',
            severity: 'high',
            title: 'Insulin không kèm chẩn đoán ĐTĐ (DT22)',
            effect: `Insulin đang được kê nhưng KHÔNG có mã ICD E10-E14 (ĐTĐ) hoặc R73 (Tăng glucose máu).${highGlucose ? ' Glucose = ' + glucoseLab.value + ' mmol/L → Có thể do stress hyperglycemia.' : ''}`,
            recommendation: highGlucose
                ? 'Gợi ý: Bổ sung mã R73.9 (Tăng glucose máu không xác định) để hợp thức hóa.'
                : 'Bổ sung mã ICD E10-E14 (ĐTĐ) hoặc R73.9 nếu tăng glucose máu phản ứng.',
            matched_items: { drug: ['insulin'], icd: normalized.icd_codes }
        });
    }

    // 3. Trimetazidine + Parkinson — CHỐNG CHỈ ĐỊNH (chuyên đề giám định)
    const hasTrimetazidine = normalized.normalized_drugs.includes('trimetazidine');
    const hasParkinsonICD = normalized.icd_codes.some(icd => {
        const upper = icd.toUpperCase();
        return upper.startsWith('G20') || upper.startsWith('G21');
    });
    if (hasTrimetazidine && hasParkinsonICD) {
        alerts.push({
            rule_code: 'BHYT-AUDIT-TRIMETAZIDINE-PARKINSON',
            domain: 'bhyt_audit',
            severity: 'high',
            title: '⛔ Trimetazidine + Parkinson — Chống chỉ định!',
            effect: 'Trimetazidine CHỐNG CHỈ ĐỊNH tuyệt đối ở BN Parkinson. Đây là chuyên đề giám định BHYT — 100% bị xuất toán.',
            recommendation: 'Ngừng Trimetazidine NGAY. Chuyển sang Nicorandil/Ivabradine.',
            matched_items: { drug: ['trimetazidine'], icd: normalized.icd_codes.filter(c => c.toUpperCase().startsWith('G20') || c.toUpperCase().startsWith('G21')) }
        });
    }

    // 4. Bơm tiêm Insulin (VTYT DT61) không có thuốc tiêm tương ứng
    // (Placeholder — cần dữ liệu VTYT từ extractor, sẽ mở rộng khi có)

    return {
        alerts,
        auditType: 'bhyt_preclaim',
        timestamp: new Date().toISOString(),
        drugCount: normalized.normalized_drugs.length,
        icdCount: normalized.icd_codes.length
    };
}

export async function analyzeLocally(context, filterLow = true) {
    const db = await openDatabase();
    const normalized = await normalizeContext(context);

    const [genericMap, ddiRules, drugDiseaseRules, insuranceFormulary, insuranceRules] = await Promise.all([
        getDrugGenericMap(db),
        getDdiRules(db),
        getDrugDiseaseRules(db),
        getInsuranceFormulary(db),
        getInsuranceRules(db)
    ]);

    // Check CTCH missing diagnosis rule
    const _isSurgicalProphylaxis = normalized.normalized_drugs.some(d => ['cefuroxime', 'cefazolin', 'ceftriaxone'].includes(d));
    const noDiagnosisAlerts = [];
    
    if (normalized.icd_codes.length === 0 && normalized.normalized_drugs.length > 0) {
        noDiagnosisAlerts.push({
            rule_code: 'WARN-NO-DIAGNOSIS',
            domain: 'clinical',
            severity: 'high', // Made critical to prevent un-billed meds
            title: 'Chưa có chẩn đoán BHYT',
            effect: 'Không thể kiểm tra an toàn hoặc giải quyết BHYT.',
            recommendation: 'Bắt buộc nhập ICD10 trước khi kê đơn.',
            matched_items: {}
        });
    }

    let allAlerts = dedupeAlerts([
        ...noDiagnosisAlerts,
        ...runDuplicateTherapyRules(normalized, genericMap),
        ...runDdiRules(ddiRules, normalized),
        ...runDrugDiseaseRules(drugDiseaseRules, normalized, context),
        ...runInsuranceRules(insuranceFormulary, insuranceRules, normalized, context)
    ]);

    // Lọc Alert Fatigue theo Setting
    if (filterLow) {
        allAlerts = allAlerts.filter(a => a.severity === 'high' || a.severity === 'medium');
    }

    return {
        alerts: allAlerts,
        debug: {
            normalized_drugs: normalized.normalized_drugs,
            unmapped_drugs: normalized.unmapped_drugs,
            condition_groups: normalized.condition_groups,
            labs: (context.labs || []).map(l => `${l.code}=${l.value}`)
        }
    };
}
