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
    getRenalAdjustmentRules,
    getDrugLabRules,
    // logAuditEvent
} from './db.js';
import { injectCalculatedEgfr } from './egfr-alerts.js';
import { runtimeRuleIndex } from './runtime-rule-index.js';
import { normalizationCache } from './normalization-cache.js';
import { runDosageAlerts } from './dosage-alerts.js';

// Feature flags
let cds_runtime_rule_index = true;
let cds_normalization_cache = true;

if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    chrome.storage.local.get(['cds_runtime_rule_index', 'cds_normalization_cache'], (result) => {
        if (result.cds_runtime_rule_index !== undefined) {
            cds_runtime_rule_index = !!result.cds_runtime_rule_index;
        }
        if (result.cds_normalization_cache !== undefined) {
            cds_normalization_cache = !!result.cds_normalization_cache;
        }
    });
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area === 'local') {
            if (changes.cds_runtime_rule_index !== undefined) {
                cds_runtime_rule_index = !!changes.cds_runtime_rule_index.newValue;
            }
            if (changes.cds_normalization_cache !== undefined) {
                cds_normalization_cache = !!changes.cds_normalization_cache.newValue;
            }
        }
    });
}

export function setFeatureFlags(flags) {
    if (flags.cds_runtime_rule_index !== undefined) cds_runtime_rule_index = flags.cds_runtime_rule_index;
    if (flags.cds_normalization_cache !== undefined) cds_normalization_cache = flags.cds_normalization_cache;
}

export function getFeatureFlags() {
    return { cds_runtime_rule_index, cds_normalization_cache };
}

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
    prolufo: 'tamsulosin',

    // Pipeline v1.0 — CTCH core drugs
    colchicin: 'colchicine',
    tizanidin: 'tizanidine',
    sertralin: 'sertraline',
    'calcium gluconat': 'calcium gluconate',
    'calci gluconat': 'calcium gluconate',
    ketorolac: 'ketorolac',
    'ketorolac tromethamin': 'ketorolac',

    // Pipeline v2.0 — Full hospital coverage
    carbamazepin: 'carbamazepine',
    verapamil: 'verapamil',
    nifedipin: 'nifedipine',
    nicardipin: 'nicardipine',
    felodipin: 'felodipine',
    lercanidipin: 'lercanidipine',
    morphin: 'morphine',
    amitriptylin: 'amitriptyline',
    phenytoin: 'phenytoin',
    pioglitazon: 'pioglitazone',
    itraconazol: 'itraconazole',
    fluconazol: 'fluconazole',
    ketoconazol: 'ketoconazole',
    hydrochlorothiazid: 'hydrochlorothiazide',
    methotrexat: 'methotrexate',
    ciclosporin: 'cyclosporine',
    'dl-lysin acetylsalicylat': 'aspirin',
    'dl-lysin-acetylsalicylat': 'aspirin',
    tetracyclin: 'tetracycline',
    aciclovir: 'acyclovir',
    // Salt forms — strip suffix
    'amiodaron hydroclorid': 'amiodarone',
    'amitriptylin hydroclorid': 'amitriptyline',
    'tizanidin hydroclorid': 'tizanidine',
    'verapamil hydroclorid': 'verapamil',
    'propranolol hydroclorid': 'propranolol',
    'tramadol hydroclorid': 'tramadol',
    'morphin hydroclorid': 'morphine',
    'morphin sulfat': 'morphine',
    'sertralin hydroclorid': 'sertraline',
    'metformin hydroclorid': 'metformin',
    'phenytoin natri': 'phenytoin',
    'enalapril maleat': 'enalapril',
    'perindopril erbumin': 'perindopril',
    'losartan kali': 'losartan',
    'candesartan cilexetil': 'candesartan',
    'atorvastatin calcium': 'atorvastatin',
    'clopidogrel bisulfat': 'clopidogrel',
    'clopidogrel hydrosulfat': 'clopidogrel',
    'bisoprolol fumarat': 'bisoprolol',
    'metoprolol tartrat': 'metoprolol',
    'pioglitazon hydroclorid': 'pioglitazone',
    'pantoprazol natri': 'pantoprazole',
    'dapagliflozin propanediol': 'dapagliflozin',
    'tetracyclin hydroclorid': 'tetracycline',
};

function parseIcdCode(code) {
    const match = String(code || '').trim().toUpperCase().match(/^([A-Z])(\d{2})(?:\.(\d{1,2}))?$/);
    if (!match) return null;
    return {
        letter: match[1],
        major: Number(match[2]),
        decimal: match[3] == null ? null : Number(match[3])
    };
}

export function icdMatchesRequirement(icd, requirement) {
    const normalizedIcd = String(icd || '').trim().toUpperCase();
    const normalizedReq = String(requirement || '').trim().toUpperCase();
    if (!normalizedIcd || !normalizedReq) return false;

    if (!normalizedReq.includes('-')) {
        return normalizedIcd.startsWith(normalizedReq);
    }

    const [startRaw, endRaw] = normalizedReq.split('-').map(v => v.trim());
    const start = parseIcdCode(startRaw);
    const end = parseIcdCode(endRaw);
    const current = parseIcdCode(normalizedIcd);
    if (!start || !end || !current || start.letter !== end.letter || current.letter !== start.letter) {
        return normalizedIcd.startsWith(normalizedReq);
    }

    const currentValue = current.major + (current.decimal ?? 0) / 100;
    const startValue = start.major + (start.decimal ?? 0) / 100;
    const endValue = end.major + (end.decimal ?? 99) / 100;
    return currentValue >= startValue && currentValue <= endValue;
}

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
    // 1. Kiểm tra ưu tiên tên gốc chưa qua xử lý (raw string matching)
    // Rất quan trọng cho các thuốc có kèm hàm lượng trong từ điển (vd: bacqure 500mg)
    const rawNameLower = name.toLowerCase().trim();
    if (brandMap.has(rawNameLower)) return brandMap.get(rawNameLower).generic_name.toLowerCase();

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
            if (mapping && mapping.icd_prefix && normalizedCode.startsWith(mapping.icd_prefix.toUpperCase())) {
                groups.add(mapping.condition_group_code);
            }
        }
    }
    return Array.from(groups).sort();
}

export async function normalizeContext(context) {
    let genericMap, brandMap, mappings;
    
    if (cds_runtime_rule_index && runtimeRuleIndex.initialized) {
        genericMap = runtimeRuleIndex.genericMap;
        brandMap = runtimeRuleIndex.brandMap;
        mappings = runtimeRuleIndex.conditionGroupMappings;
    } else {
        const db = await openDatabase();
        genericMap = await getDrugGenericMap(db);
        brandMap = await getBrandMap(db);
        mappings = await getConditionGroupMappings(db);
    }

    const normalizedDrugs = new Set();
    const unmappedDrugsSet = new Set();
    
    for (const med of (context.medications || [])) {
        const cacheKey = `${med.display_name}||${med.generic_candidate || ''}`;
        if (cds_normalization_cache) {
            const cachedValue = normalizationCache.get(cacheKey);
            if (cachedValue !== undefined) {
                if (cachedValue === '__IGNORED__') {
                    // Do nothing, it's ignored
                } else if (cachedValue) {
                    normalizedDrugs.add(cachedValue);
                } else {
                    unmappedDrugsSet.add(med.display_name.replace(/[\s\u00a0\u200b]+/g, ' ').trim());
                }
                continue;
            }
        }

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

        let finalNormalized = null;
        let isIgnored = false;
        
        if (normalized) {
            // Strip parenthetical content from resolved generic name
            // E.g. "enoxaparin (natri)" → "enoxaparin" to match DDI rules
            const cleanGeneric = normalized.replace(/\(.*?\)/g, '').trim();
            finalNormalized = cleanGeneric || normalized;
            normalizedDrugs.add(finalNormalized);
        } else {
            const rawName = med.display_name.replace(/[\s\u00a0\u200b]+/g, ' ').trim();
            const normalizedRawName = rawName.normalize('NFC');
            
            // Danh sách các từ khóa thuốc/vật tư bỏ qua không cần hiển thị "Chưa có dữ liệu"
            const IGNORED_UNMAPPED_DRUGS = [
                /natri\s*clorid/i, /nacl/i, /ringer/i, /glucose/i, /nước\s*cất/i, 
                /huyết\s*thanh/i, /bơm\s*kim/i, /dây\s*truyền/i, /băng\s*dính/i, 
                /cồn/i, /oxy/i, /gạc/i, /kim\s*luồn/i, /nước\s*muối/i, /lidocain/i,
                /uốn\s*ván/i, /sat/i, /vaccin/i, /vắc\s*xin/i, /kháng\s*độc/i,
                /huyết thanh kháng độc tố uốn ván tinh chế/i
            ];
            
            isIgnored = IGNORED_UNMAPPED_DRUGS.some(regex => regex.test(normalizedRawName));
            if (!isIgnored) {
                unmappedDrugsSet.add(rawName);
            }
        }

        if (cds_normalization_cache) {
            normalizationCache.set(cacheKey, isIgnored ? '__IGNORED__' : finalNormalized);
        }
    }

    const icdCodes = (context.encounter?.diagnoses || []).map(d => d.code).filter(Boolean);
    
    return {
        normalized_drugs: Array.from(normalizedDrugs).sort(),
        condition_groups: mapConditionGroups(icdCodes, mappings),
        raw_drugs: (context.medications || []).map(m => m.display_name),
        icd_codes: icdCodes,
        unmapped_drugs: Array.from(unmappedDrugsSet)
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

function runDrugDiseaseRules(rules, normalized, context, drugLabRulesFromDb, renalRulesFromDb) {
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
    
    // ===== DRUG-LAB INTERACTION RULES (JSON-driven from IndexedDB) =====
    if (labs.length > 0 && drugLabRulesFromDb) {
        const drugLabAlerts = runDrugLabRulesFromDb(drugLabRulesFromDb, normalized.normalized_drugs, labMap);
        alerts.push(...drugLabAlerts);
    }

    // ===== RENAL ADJUSTMENT RULES =====
    if (renalRulesFromDb) {
        const renalAlerts = runRenalAdjustmentRules(renalRulesFromDb, normalized.normalized_drugs, labMap);
        alerts.push(...renalAlerts);
    }
    
    return alerts;
}

/**
 * Drug-Lab Interaction Rules Engine (JSON-driven)
 * Reads rules from IndexedDB instead of hardcoded values.
 */
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
        else if (rule.operator === 'range' && v >= rule.threshold && v <= (rule.threshold_max ?? Infinity)) triggered = true;

        if (!triggered) continue;

        const matchedDrug = rule.drugs.find(d => drugs.includes(d));
        alerts.push({
            rule_code: rule.rule_code,
            domain: 'drug_lab',
            severity: rule.severity,
            title: '⚠️ Xét nghiệm bất thường + Thuốc',
            effect: `${rule.clinical_effect} (${rule.lab_code} = ${labResult.value} ${labResult.unit})`,
            recommendation: rule.recommendation,
            matched_items: { drug: [matchedDrug], lab: [rule.lab_code], value: [String(labResult.value)] }
        });
    }

    return alerts;
}

/**
 * Renal Adjustment Rules Engine
 * Checks eGFR lab value against drug-specific thresholds from IndexedDB.
 */
function runRenalAdjustmentRules(rules, drugs, labMap) {
    const alerts = [];
    const egfrResult = labMap.get('eGFR');
    if (!egfrResult) return alerts;

    const egfr = egfrResult.value;

    for (const rule of rules) {
        if (!rule.is_active) continue;
        if (!drugs.includes(rule.generic_name.toLowerCase())) continue;

        let triggered = false;
        if (rule.operator === '<' && egfr < rule.egfr_threshold) triggered = true;
        else if (rule.operator === '<=' && egfr <= rule.egfr_threshold) triggered = true;

        if (!triggered) continue;

        alerts.push({
            rule_code: rule.rule_code,
            domain: 'renal',
            severity: rule.severity,
            title: '🩺 Chỉnh liều theo chức năng thận',
            effect: `${rule.rationale} (eGFR = ${egfr} mL/phút)`,
            recommendation: rule.recommendation,
            matched_items: { drug: [rule.generic_name], lab: ['eGFR'], value: [String(egfr)] }
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
            const hasMatch = allowed.length === 0 || normalized.icd_codes.some(icd => allowed.some(p => icdMatchesRequirement(icd, p)));
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

// ===== ORDER SETS (BỘ CHỈ ĐỊNH THÔNG MINH) =====
const ORDER_SETS = [
    {
        icd_prefixes: ['I50'], // Suy tim
        name: 'Suy tim (Heart Failure)',
        suggestions: ['Siêu âm tim Doppler', 'Điện tâm đồ (ECG)', 'Pro-BNP', 'Điện giải đồ (K+, Na+)'],
        rationale: 'Đánh giá chức năng tâm thu/tâm trương và nguy cơ rối loạn điện giải do lợi tiểu.'
    },
    {
        icd_prefixes: ['E10', 'E11', 'E12', 'E13', 'E14'], // Đái tháo đường
        name: 'Đái tháo đường (Diabetes)',
        suggestions: ['Glucose máu lúc đói', 'HbA1c', 'Creatinin máu', 'Tổng phân tích nước tiểu'],
        rationale: 'Kiểm soát đường huyết và tầm soát biến chứng thận.'
    },
    {
        icd_prefixes: ['I10', 'I11', 'I12', 'I13', 'I14', 'I15'], // Tăng huyết áp
        name: 'Tăng huyết áp (Hypertension)',
        suggestions: ['Điện tâm đồ (ECG)', 'Creatinin máu', 'Siêu âm Doppler tim', 'Soi đáy mắt'],
        rationale: 'Tầm soát biến chứng cơ quan đích (tim, thận, mắt).'
    }
];

function runOrderSetRules(normalized) {
    const alerts = [];
    const triggeredSets = new Set();
    
    for (const icd of normalized.icd_codes) {
        for (const set of ORDER_SETS) {
            if (set.icd_prefixes.some(p => icd.toUpperCase().startsWith(p))) {
                if (!triggeredSets.has(set.name)) {
                    triggeredSets.add(set.name);
                    alerts.push({
                        rule_code: 'ORDER-SET-' + set.icd_prefixes[0],
                        domain: 'order_set',
                        severity: 'info',
                        title: `💡 Bộ chỉ định: ${set.name}`,
                        effect: set.rationale,
                        recommendation: `Gợi ý chỉ định: ${set.suggestions.join(', ')}`,
                        matched_items: { icd: [icd] }
                    });
                }
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
    const enrichedContext = injectCalculatedEgfr(context);
    const normalized = await normalizeContext(enrichedContext);
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

function runCriticalLabAlerts(context) {
    const alerts = [];
    const labs = context.labs || [];
    const labMap = new Map();
    for (const lab of labs) {
        labMap.set(lab.code, lab);
    }

    // 1. Kiểm tra Glucose nguy kịch (Đường huyết tăng quá cao)
    const glucose = labMap.get('glucose');
    if (glucose) {
        if (glucose.value > 16.5) { // Tương đương > 300 mg/dL
            alerts.push({
                rule_code: 'CRIT-LAB-GLUCOSE-HIGH',
                domain: 'critical_lab',
                severity: 'high',
                title: '🚨 Báo động đỏ: Tăng Đường Huyết Nguy Kịch!',
                effect: `Đường huyết mao mạch/tĩnh mạch tăng rất cao (${glucose.value} mmol/L ~ ${(glucose.value * 18).toFixed(0)} mg/dL). Nguy cơ cao tiến triển thành Nhiễm toan ceton (DKA) hoặc Hội chứng tăng áp lực thẩm thấu (HHS).`,
                recommendation: 'Đề xuất: Kiểm tra khí máu động mạch, ceton niệu. Xử trí truyền dịch tĩnh mạch và tiêm Insulin khẩn cấp theo phác đồ.',
                matched_items: { lab: ['glucose'], value: [String(glucose.value)] }
            });
        }
    }

    // 2. Kiểm tra Kali nguy kịch (Nguy cơ loạn nhịp tim nguy hiểm)
    const potassium = labMap.get('potassium');
    if (potassium) {
        if (potassium.value < 3.0) {
            alerts.push({
                rule_code: 'CRIT-LAB-K-LOW-SEVERE',
                domain: 'critical_lab',
                severity: 'high',
                title: '🚨 Báo động đỏ: Hạ Kali Máu Nặng!',
                effect: `Nồng độ Kali máu giảm nặng đe dọa tính mạng (${potassium.value} mmol/L). Nguy cơ rất cao gây xoắn đỉnh, rung thất và ngừng tim.`,
                recommendation: 'Đề xuất: Khẩn cấp bù Kali đường tĩnh mạch dưới sự theo dõi sát của monitor tim.',
                matched_items: { lab: ['potassium'], value: [String(potassium.value)] }
            });
        } else if (potassium.value < 3.5) {
            alerts.push({
                rule_code: 'CRIT-LAB-K-LOW',
                domain: 'critical_lab',
                severity: 'medium',
                title: '⚠️ Cảnh báo: Hạ Kali Máu!',
                effect: `Nồng độ Kali máu thấp (${potassium.value} mmol/L, khoảng bình thường: 3.5 - 5.0). Có thể gây mệt mỏi cơ, yếu liệt chi hoặc loạn nhịp tim nhẹ.`,
                recommendation: 'Đề xuất: Khuyến nghị bổ sung Kali đường uống (Kaleorid/K-Lyte) và hướng dẫn chế độ ăn giàu Kali (chuối, nước cam).',
                matched_items: { lab: ['potassium'], value: [String(potassium.value)] }
            });
        } else if (potassium.value > 5.5) {
            alerts.push({
                rule_code: 'CRIT-LAB-K-HIGH',
                domain: 'critical_lab',
                severity: 'high',
                title: '🚨 Báo động đỏ: Tăng Kali Máu!',
                effect: `Nồng độ Kali máu tăng cao nguy hiểm (${potassium.value} mmol/L, khoảng bình thường: 3.5 - 5.0). Nguy cơ gây ngừng tim đột ngột.`,
                recommendation: 'Đề xuất: Calci Clorid/Calci Gluconat tiêm tĩnh mạch bảo vệ cơ tim, truyền Insulin + Glucose, khí dung Ventolin hoặc lọc máu cấp cứu.',
                matched_items: { lab: ['potassium'], value: [String(potassium.value)] }
            });
        }
    }

    // 3. Kiểm tra Natri nguy kịch (Rối loạn thẩm thấu não)
    const sodium = labMap.get('sodium');
    if (sodium) {
        if (sodium.value < 125) {
            alerts.push({
                rule_code: 'CRIT-LAB-NA-LOW-SEVERE',
                domain: 'critical_lab',
                severity: 'high',
                title: '🚨 Báo động đỏ: Hạ Natri Máu Nặng!',
                effect: `Natri máu giảm nghiêm trọng (${sodium.value} mmol/L). Có thể gây phù não, co giật, hôn mê.`,
                recommendation: 'Đề xuất: Xem xét bù Natri Clorid ưu trương (3%) chậm và thận trọng dưới sự kiểm soát chặt chẽ.',
                matched_items: { lab: ['sodium'], value: [String(sodium.value)] }
            });
        } else if (sodium.value > 150) {
            alerts.push({
                rule_code: 'CRIT-LAB-NA-HIGH-SEVERE',
                domain: 'critical_lab',
                severity: 'high',
                title: '🚨 Báo động đỏ: Tăng Natri Máu Nặng!',
                effect: `Natri máu tăng rất cao (${sodium.value} mmol/L). Gây mất nước tế bào não, co giật, xuất huyết.`,
                recommendation: 'Đề xuất: Bù nước tự do (uống nước hoặc truyền Glucose 5%) chậm để tránh thay đổi áp lực thẩm thấu não quá nhanh.',
                matched_items: { lab: ['sodium'], value: [String(sodium.value)] }
            });
        }
    }

    return alerts;
}

export async function analyzeLocally(context, filterLow = true) {
    const enrichedContext = injectCalculatedEgfr(context);
    const normalized = await normalizeContext(enrichedContext);

    let allAlerts;
    if (cds_runtime_rule_index && runtimeRuleIndex.initialized) {
        // Run rules completely synchronously using the in-memory indexes
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

        const ddiAlerts = [];
        const drugs = normalized.normalized_drugs;
        for (let i = 0; i < drugs.length; i++) {
            for (let j = i + 1; j < drugs.length; j++) {
                const a = drugs[i], b = drugs[j];
                const key = [a, b].sort().join('|');
                const matches = runtimeRuleIndex.ddiMap.get(key) || [];
                for (const match of matches) {
                    ddiAlerts.push({
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

        const drugDiseaseAlerts = [];
        const labs = enrichedContext.labs || [];
        const localLabMap = new Map();
        for (const lab of labs) {
            localLabMap.set(lab.code, lab);
        }
        const hasLowEgfr = localLabMap.has('eGFR') && localLabMap.get('eGFR').value < 45;

        for (const drug of drugs) {
            const rules = runtimeRuleIndex.drugDiseaseMap.get(drug) || [];
            for (const rule of rules) {
                const hasCondition = normalized.condition_groups.includes(rule.condition_group_code);
                if (!hasCondition) continue;
                if (rule.rule_code === 'DX-METFORMIN-LOWEGFR-001' && !hasLowEgfr) continue;

                drugDiseaseAlerts.push({
                    rule_code: rule.rule_code,
                    domain: 'drug_disease',
                    severity: rule.severity,
                    title: 'Chống chỉ định/Thận trọng',
                    effect: rule.rationale || 'Không phù hợp với bệnh lý.',
                    recommendation: rule.recommendation || 'Cân nhắc thay thế',
                    matched_items: { drug: [rule.generic_name], condition: [rule.condition_group_code] }
                });
            }
        }

        // Drug-Lab Rules from Index
        const candidateLabRules = new Set();
        for (const drug of drugs) {
            const rules = runtimeRuleIndex.labMap.get(drug) || [];
            for (const r of rules) {
                candidateLabRules.add(r);
            }
        }
        for (const rule of candidateLabRules) {
            const labResult = localLabMap.get(rule.lab_code);
            if (!labResult) continue;

            const v = labResult.value;
            let triggered = false;
            if (rule.operator === '<' && v < rule.threshold) triggered = true;
            else if (rule.operator === '>' && v > rule.threshold) triggered = true;
            else if (rule.operator === 'range' && v >= rule.threshold && v <= (rule.threshold_max ?? Infinity)) triggered = true;

            if (!triggered) continue;

            const matchedDrug = rule.drugs.find(d => drugs.includes(d));
            drugDiseaseAlerts.push({
                rule_code: rule.rule_code,
                domain: 'drug_lab',
                severity: rule.severity,
                title: '⚠️ Xét nghiệm bất thường + Thuốc',
                effect: `${rule.clinical_effect} (${rule.lab_code} = ${labResult.value} ${labResult.unit})`,
                recommendation: rule.recommendation,
                matched_items: { drug: [matchedDrug], lab: [rule.lab_code], value: [String(labResult.value)] }
            });
        }

        // Renal Adjustment Rules from Index
        const egfrResult = localLabMap.get('eGFR');
        if (egfrResult) {
            const egfr = egfrResult.value;
            for (const drug of drugs) {
                const rules = runtimeRuleIndex.renalMap.get(drug) || [];
                for (const rule of rules) {
                    let triggered = false;
                    if (rule.operator === '<' && egfr < rule.egfr_threshold) triggered = true;
                    else if (rule.operator === '<=' && egfr <= rule.egfr_threshold) triggered = true;

                    if (!triggered) continue;

                    drugDiseaseAlerts.push({
                        rule_code: rule.rule_code,
                        domain: 'renal',
                        severity: rule.severity,
                        title: '🩺 Chỉnh liều theo chức năng thận',
                        effect: `${rule.rationale} (eGFR = ${egfr} mL/phút)`,
                        recommendation: rule.recommendation,
                        matched_items: { drug: [rule.generic_name], lab: ['eGFR'], value: [String(egfr)] }
                    });
                }
            }
        }

        // Insurance Rules
        const insuranceAlerts = [];
        for (const drug of drugs) {
            const entry = runtimeRuleIndex.insuranceFormularyMap.get(drug);
            if (entry && !entry.is_covered) {
                insuranceAlerts.push({
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

        for (const drug of drugs) {
            const rules = runtimeRuleIndex.insuranceRuleMap.get(drug) || [];
            for (const rule of rules) {
                if (rule.condition_type === 'icd_prefix_required') {
                    const allowed = (rule.condition_value || '').split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
                    const hasMatch = allowed.length === 0 || normalized.icd_codes.some(icd => allowed.some(p => icdMatchesRequirement(icd, p)));
                    if (!hasMatch) {
                        if (['paracetamol', 'acetaminophen'].includes(rule.generic_name.toLowerCase())) {
                            continue;
                        }

                        insuranceAlerts.push({
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
        }

        // Duplicate therapy & Critical lab
        const duplicateTherapyAlerts = runDuplicateTherapyRules(normalized, runtimeRuleIndex.genericMap);
        const criticalLabAlerts = runCriticalLabAlerts(enrichedContext);
        const orderSetAlerts = runOrderSetRules(normalized);

        // Phase 3: Dosage Intelligence alerts
        const dosageAlerts = runDosageAlerts(enrichedContext);

        allAlerts = dedupeAlerts([
            ...noDiagnosisAlerts,
            ...duplicateTherapyAlerts,
            ...ddiAlerts,
            ...drugDiseaseAlerts,
            ...insuranceAlerts,
            ...criticalLabAlerts,
            ...orderSetAlerts,
            ...dosageAlerts
        ]);
    } else {
        const db = await openDatabase();
        const [genericMap, ddiRules, drugDiseaseRules, insuranceFormulary, insuranceRules, renalRules, drugLabRules] = await Promise.all([
            getDrugGenericMap(db),
            getDdiRules(db),
            getDrugDiseaseRules(db),
            getInsuranceFormulary(db),
            getInsuranceRules(db),
            getRenalAdjustmentRules(db),
            getDrugLabRules(db)
        ]);

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

        // Phase 3: Dosage Intelligence alerts
        const dosageAlerts = runDosageAlerts(enrichedContext);

        allAlerts = dedupeAlerts([
            ...noDiagnosisAlerts,
            ...runDuplicateTherapyRules(normalized, genericMap),
            ...runDdiRules(ddiRules, normalized),
            ...runDrugDiseaseRules(drugDiseaseRules, normalized, enrichedContext, drugLabRules, renalRules),
            ...runInsuranceRules(insuranceFormulary, insuranceRules, normalized, enrichedContext),
            ...runCriticalLabAlerts(enrichedContext),
            ...runOrderSetRules(normalized),
            ...dosageAlerts
        ]);
    }

    if (filterLow) {
        allAlerts = allAlerts.filter(a => a.severity === 'high' || a.severity === 'medium' || a.domain === 'order_set');
    }

    return {
        alerts: allAlerts,
        debug: {
            normalized_drugs: normalized.normalized_drugs,
            unmapped_drugs: normalized.unmapped_drugs,
            condition_groups: normalized.condition_groups,
            labs: (enrichedContext.labs || []).map(l => `${l.code}=${l.value}`)
        }
    };
}
