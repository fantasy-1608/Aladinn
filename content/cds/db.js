/**
 * 🧞 Aladinn CDS — Knowledge Base Database Engine
 * Được chuyển đổi từ dự án Checkmap sang Vanilla JS để tương thích với Aladinn.
 */

import { runtimeRuleIndex } from './runtime-rule-index.js';

export const KB_SCHEMA_VERSION = 5; // Bumped for Pipeline v1.0 — forces full re-seed
export const KB_SEED_VERSION = '2026-06-27-nhic-seed-832-rules'; // 426 DDI, 27 DDD, 14 Renal, 18 DrugLab, 598 generics

const DB_NAME = 'AladinnCDS';
const META_STORE = 'meta';
const DRUG_GENERIC_STORE = 'drug_generic';
const DRUG_BRAND_MAP_STORE = 'drug_brand_map';
const CONDITION_GROUP_ICD_MAP_STORE = 'condition_group_icd_map';
const DDI_RULE_STORE = 'ddi_rule';
const DRUG_DISEASE_RULE_STORE = 'drug_disease_rule';
const DRUG_ALLERGY_RULE_STORE = 'drug_allergy_rule';
const INSURANCE_FORMULARY_STORE = 'insurance_formulary';
const INSURANCE_RULE_STORE = 'insurance_rule';
const RENAL_ADJUSTMENT_STORE = 'renal_adjustment';
const DRUG_LAB_RULE_STORE = 'drug_lab_rule';
const AUDIT_LOG_STORE = 'audit_log';

const STORE_DEFINITIONS = [
    { name: META_STORE, keyPath: 'key' },
    { name: DRUG_GENERIC_STORE, keyPath: 'generic_name' },
    { name: DRUG_BRAND_MAP_STORE, keyPath: 'brand_name' },
    { name: CONDITION_GROUP_ICD_MAP_STORE, keyPath: 'id', autoIncrement: true },
    { name: DDI_RULE_STORE, keyPath: 'rule_code' },
    { name: DRUG_DISEASE_RULE_STORE, keyPath: 'rule_code' },
    { name: DRUG_ALLERGY_RULE_STORE, keyPath: 'rule_code' },
    { name: INSURANCE_FORMULARY_STORE, keyPath: 'generic_name' },
    { name: INSURANCE_RULE_STORE, keyPath: 'rule_code' },
    { name: RENAL_ADJUSTMENT_STORE, keyPath: 'rule_code' },
    { name: DRUG_LAB_RULE_STORE, keyPath: 'rule_code' },
    { name: AUDIT_LOG_STORE, keyPath: 'id', autoIncrement: true }
];

export function openDatabase() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, KB_SCHEMA_VERSION);

        request.onupgradeneeded = () => {
            const db = request.result;
            for (const definition of STORE_DEFINITIONS) {
                if (db.objectStoreNames.contains(definition.name)) {
                    db.deleteObjectStore(definition.name);
                }
                db.createObjectStore(definition.name, {
                    keyPath: definition.keyPath,
                    autoIncrement: definition.autoIncrement
                });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function transactionComplete(tx) {
    return new Promise((resolve, reject) => {
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error);
    });
}

function requestToPromise(request) {
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

const REMOTE_BASE_URL = 'https://raw.githubusercontent.com/fantasy-1608/Aladinn/main/public/cds-data';

async function fetchJson(filename, useRemote = false) {
    const url = useRemote ? `${REMOTE_BASE_URL}/${filename}` : chrome.runtime.getURL(`cds-data/${filename}`);
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), 5000); // 5s timeout
    try {
        const response = await fetch(url, useRemote ? { 
            signal: controller.signal,
            cache: 'no-cache' 
        } : undefined);
        clearTimeout(id);
        if (!response.ok) {
            throw new Error(`Failed to load ${filename}: ${response.status}`);
        }
        return await response.json();
    } catch (err) {
        clearTimeout(id);
        throw err;
    }
}

async function getMetaValue(db, key) {
    const tx = db.transaction(META_STORE, 'readonly');
    const store = tx.objectStore(META_STORE);
    const record = await requestToPromise(store.get(key));
    await transactionComplete(tx);
    return record?.value ?? null;
}

async function setMetaValue(db, key, value) {
    const tx = db.transaction(META_STORE, 'readwrite');
    tx.objectStore(META_STORE).put({ key, value });
    await transactionComplete(tx);
}

async function clearStore(db, storeName) {
    const tx = db.transaction(storeName, 'readwrite');
    tx.objectStore(storeName).clear();
    await transactionComplete(tx);
}

async function replaceStore(db, storeName, rows) {
    await clearStore(db, storeName);
    const tx = db.transaction(storeName, 'readwrite');
    const store = tx.objectStore(storeName);
    for (const row of rows) {
        store.put(row);
    }
    await transactionComplete(tx);
}

async function seedKnowledgeBase(db, useRemote = false) {
    console.log(`[Aladinn CDS] Seeding database using ${useRemote ? 'REMOTE' : 'LOCAL'} files...`);
    const [
        drugGeneric,
        brandGenericMap,
        conditionGroupIcdMap,
        ddiRules,
        drugDiseaseRules,
        allergyRules,
        insuranceFormulary,
        insuranceRules
    ] = await Promise.all([
        fetchJson('drug_generic.json', useRemote),
        fetchJson('brand_generic_map.json', useRemote),
        fetchJson('condition_group_icd_map.json', useRemote),
        fetchJson('ddi_rules.json', useRemote),
        fetchJson('drug_disease_rules.json', useRemote),
        fetchJson('allergy_rules.json', useRemote),
        fetchJson('insurance_formulary.json', useRemote),
        fetchJson('insurance_rules.json', useRemote)
    ]);

    // Pipeline v1.0 files — fetch with fallback to empty array
    let renalRules = [], drugLabRules = [];
    try { renalRules = await fetchJson('renal_adjustment_rules.json', useRemote); } catch (_e) { console.log('[CDS] renal_adjustment_rules.json not found, skipping'); }
    try { drugLabRules = await fetchJson('drug_lab_rules.json', useRemote); } catch (_e) { console.log('[CDS] drug_lab_rules.json not found, skipping'); }

    console.log(`[Aladinn CDS] Loaded: ${ddiRules.length} DDI, ${drugDiseaseRules.length} Drug-Disease, ${renalRules.length} Renal, ${drugLabRules.length} Drug-Lab`);

    await Promise.all([
        replaceStore(db, DRUG_GENERIC_STORE, drugGeneric),
        replaceStore(db, DRUG_BRAND_MAP_STORE, brandGenericMap),
        replaceStore(db, CONDITION_GROUP_ICD_MAP_STORE, conditionGroupIcdMap),
        replaceStore(db, DDI_RULE_STORE, ddiRules),
        replaceStore(db, DRUG_DISEASE_RULE_STORE, drugDiseaseRules),
        replaceStore(db, DRUG_ALLERGY_RULE_STORE, allergyRules),
        replaceStore(db, INSURANCE_FORMULARY_STORE, insuranceFormulary),
        replaceStore(db, INSURANCE_RULE_STORE, insuranceRules),
        replaceStore(db, RENAL_ADJUSTMENT_STORE, renalRules),
        replaceStore(db, DRUG_LAB_RULE_STORE, drugLabRules)
    ]);

    let version = KB_SEED_VERSION;
    try {
        const meta = await fetchJson('metadata.json', useRemote);
        if (meta && meta.ruleset_version) {
            version = meta.ruleset_version;
        }
    } catch (metaErr) {
        console.log('[Aladinn CDS] Could not load metadata.json, using fallback version:', version);
    }

    await setMetaValue(db, 'seedVersion', version);
    await setMetaValue(db, 'seededAt', new Date().toISOString());
    console.log(`[Aladinn CDS] 🧞 Database seeded (version: ${version})`);
    return version;
}

export async function initializeKnowledgeBase(forceSync = false) {
    try {
        const db = await openDatabase();
        const currentSeedVersion = await getMetaValue(db, 'seedVersion');
        console.log(`[Aladinn CDS] DB check: stored="${currentSeedVersion}" force=${forceSync}`);

        let remoteVersion = null;
        let remoteMeta = null;

        // Try checking remote metadata
        try {
            remoteMeta = await fetchJson('metadata.json', true);
            remoteVersion = remoteMeta ? remoteMeta.ruleset_version : null;
            console.log(`[Aladinn CDS] Remote ruleset version: "${remoteVersion}"`);
        } catch (err) {
            console.log('[Aladinn CDS] Remote version check failed (offline or blocked). Using local fallback check.');
        }

        if (remoteVersion) {
            if (forceSync || currentSeedVersion !== remoteVersion) {
                console.log(`[Aladinn CDS] 🔄 Remote version mismatch/forceSync, seeding database from REMOTE...`);
                await seedKnowledgeBase(db, true);
                console.log('[Aladinn CDS] ✅ Remote seed complete.');
            } else {
                console.log('[Aladinn CDS] DB is up-to-date with remote version. Skipping seed.');
            }
        } else {
            // Fallback: Check if we need to seed from local
            let localVersion = KB_SEED_VERSION;
            try {
                const localMeta = await fetchJson('metadata.json', false);
                if (localMeta && localMeta.ruleset_version) {
                    localVersion = localMeta.ruleset_version;
                }
            } catch (e) {}

            if (forceSync || !currentSeedVersion) {
                console.log(`[Aladinn CDS] 🔄 Database cold-start, seeding database from LOCAL...`);
                await seedKnowledgeBase(db, false);
                console.log('[Aladinn CDS] ✅ Local seed complete.');
            } else {
                console.log(`[Aladinn CDS] DB has existing data ("${currentSeedVersion}"). Skipping local seed fallback.`);
            }
        }
        await runtimeRuleIndex.init(db);
    } catch (err) {
        console.error('[Aladinn CDS] ❌ initializeKnowledgeBase FAILED:', err);
    }
}

/**
 * Phase 6: Auto-update diagnostics — returns CDS database status
 */
export async function getCdsStatus() {
    try {
        const db = await openDatabase();
        const seedVersion = await getMetaValue(db, 'seedVersion');
        const seededAt = await getMetaValue(db, 'seededAt');
        const [ddiCount, dddCount, renalCount, dlCount, genericCount] = await Promise.all([
            getAllFromStore(db, DDI_RULE_STORE).then(r => r.length),
            getAllFromStore(db, DRUG_DISEASE_RULE_STORE).then(r => r.length),
            getAllFromStore(db, RENAL_ADJUSTMENT_STORE).then(r => r.length),
            getAllFromStore(db, DRUG_LAB_RULE_STORE).then(r => r.length),
            getAllFromStore(db, DRUG_GENERIC_STORE).then(r => r.length),
        ]);
        return {
            seedVersion,
            requiredVersion: KB_SEED_VERSION,
            isUpToDate: seedVersion === KB_SEED_VERSION,
            seededAt,
            rules: { ddi: ddiCount, drugDisease: dddCount, renal: renalCount, drugLab: dlCount, generics: genericCount }
        };
    } catch (err) {
        return { error: err.message, isUpToDate: false };
    }
}

export async function getAllFromStore(db, storeName) {
    const tx = db.transaction(storeName, 'readonly');
    const rows = await requestToPromise(tx.objectStore(storeName).getAll());
    await transactionComplete(tx);
    return rows;
}

export async function getDrugGenericMap(db) {
    const rows = await getAllFromStore(db, DRUG_GENERIC_STORE);
    return new Map(rows.map((row) => [row.generic_name.toLowerCase(), row]));
}

export async function getBrandMap(db) {
    const rows = await getAllFromStore(db, DRUG_BRAND_MAP_STORE);
    return new Map(rows.map((row) => [row.brand_name.toLowerCase(), row]));
}

export async function getConditionGroupMappings(db) {
    return getAllFromStore(db, CONDITION_GROUP_ICD_MAP_STORE);
}

export async function getDdiRules(db) {
    return getAllFromStore(db, DDI_RULE_STORE);
}

export async function getDrugDiseaseRules(db) {
    return getAllFromStore(db, DRUG_DISEASE_RULE_STORE);
}

export async function getDrugAllergyRules(db) {
    return getAllFromStore(db, DRUG_ALLERGY_RULE_STORE);
}

export async function getInsuranceFormulary(db) {
    return getAllFromStore(db, INSURANCE_FORMULARY_STORE);
}

export async function getInsuranceRules(db) {
    return getAllFromStore(db, INSURANCE_RULE_STORE);
}

export async function getRenalAdjustmentRules(db) {
    return getAllFromStore(db, RENAL_ADJUSTMENT_STORE);
}

export async function getDrugLabRules(db) {
    return getAllFromStore(db, DRUG_LAB_RULE_STORE);
}

export async function logAuditEvent(record) {
    const db = await openDatabase();
    const tx = db.transaction(AUDIT_LOG_STORE, 'readwrite');
    tx.objectStore(AUDIT_LOG_STORE).add(record);
    await transactionComplete(tx);
}

// ===== AUTO-IMPORT TỪ BOOKMARKLET =====

// Bảng alias chuẩn hóa hoạt chất VN → INN (đồng bộ với engine.js + import_csv.cjs)
const IMPORT_ALIAS = {
    acetaminophen: 'paracetamol', 'paracetamol (acetaminophen)': 'paracetamol',
    augmentin: 'amoxicillin-clavulanate', brufen: 'ibuprofen', voltaren: 'diclofenac',
    hemapo: 'erythropoietin', epoetin: 'erythropoietin',
    'acid acetylsalicylic': 'aspirin', 'acetylsalicylic acid': 'aspirin',
    domperidon: 'domperidone', hydroclorothiazid: 'hydrochlorothiazide',
    gliclazid: 'gliclazide', cinnarizin: 'cinnarizine', sulpirid: 'sulpiride',
    thiamazol: 'thiamazole', acetylcystein: 'acetylcysteine',
    'n-acetylcystein': 'acetylcysteine', esomeprazol: 'esomeprazole',
    omeprazol: 'omeprazole', pantoprazol: 'pantoprazole',
    rabeprazol: 'rabeprazole', lansoprazol: 'lansoprazole',
    amlodipin: 'amlodipine', furosemid: 'furosemide',
    spironolacton: 'spironolactone', amiodaron: 'amiodarone',
    codein: 'codeine', dexamethason: 'dexamethasone',
    prednisolon: 'prednisolone', methylprednisolon: 'methylprednisolone',
    ceftriaxon: 'ceftriaxone', cefuroxim: 'cefuroxime',
    cefotaxim: 'cefotaxime', ceftazidim: 'ceftazidime',
    cefoperazon: 'cefoperazone', cefixim: 'cefixime',
    cefpodoxim: 'cefpodoxime', cefepim: 'cefepime',
    amoxicilin: 'amoxicillin', ampicilin: 'ampicillin',
    piperacilin: 'piperacillin', oxacilin: 'oxacillin',
    cloxacilin: 'cloxacillin', metronidazol: 'metronidazole',
    cotrimoxazol: 'cotrimoxazole', sulfamethoxazol: 'sulfamethoxazole',
    doxycyclin: 'doxycycline', minocyclin: 'minocycline',
    tetracyclin: 'tetracycline', ketoconazol: 'ketoconazole',
    fluconazol: 'fluconazole', itraconazol: 'itraconazole',
    aciclovir: 'acyclovir', valaciclovir: 'valacyclovir',
    artesunat: 'artesunate',
    // Pipeline v1.0
    colchicin: 'colchicine', tizanidin: 'tizanidine', sertralin: 'sertraline',
    'calcium gluconat': 'calcium gluconate', 'calci gluconat': 'calcium gluconate',
    'ketorolac tromethamin': 'ketorolac'
};

function normalizeGenericForImport(name) {
    if (!name || name === '-') return null;
    let n = name.toLowerCase().trim()
        .replace(/\(\*\)/g, '').replace(/\*/g, '')
        .replace(/\(.*?\)/g, (match) => match.includes('acetaminophen') ? '' : match)
        .replace(/\(.*?\)/g, '').trim();
    let parts = n.split(/\+/).map(p => p.trim());
    parts = parts.map(p => IMPORT_ALIAS[p] || p).filter(p => p && p.length > 0);
    if (parts.length === 0) return null;
    if (parts.includes('amoxicillin') && parts.some(p => p.includes('clavulanic'))) return 'amoxicillin-clavulanate';
    return parts.length === 1 ? parts[0] : parts.join(' + ');
}

/**
 * Import dữ liệu cào từ bookmarklet vào IndexedDB.
 * @param {Array<{ten: string, hc: string}>} drugs - Mảng thuốc { ten: tên thương mại, hc: hoạt chất }
 * @returns {Object} { newBrands, newGenerics, totalProcessed }
 */
export async function importCrawledDrugs(drugs) {
    const db = await openDatabase();
    
    // Lấy dữ liệu hiện có
    const existingBrands = await getAllFromStore(db, DRUG_BRAND_MAP_STORE);
    const existingGenerics = await getAllFromStore(db, DRUG_GENERIC_STORE);
    const brandSet = new Set(existingBrands.map(b => b.brand_name));
    const genericSet = new Set(existingGenerics.map(g => g.generic_name));
    
    const newBrandEntries = [];
    const newGenericEntries = [];
    let processed = 0;
    
    for (const drug of drugs) {
        if (!drug.hc || drug.hc === '-') continue;
        
        const normalGen = normalizeGenericForImport(drug.hc);
        if (!normalGen) continue;
        processed++;
        
        // Thêm generic mới
        const splitGens = normalGen.split(' + ');
        for (const g of splitGens) {
            if (!genericSet.has(g)) {
                newGenericEntries.push({
                    generic_name: g,
                    generic_name_en: g,
                    atc_code: '',
                    pharmacologic_class: 'unknown',
                    therapeutic_class: 'unknown',
                    is_active: true
                });
                genericSet.add(g);
            }
        }
        
        // Thêm brand map mới
        const lowerBrand = drug.ten.toLowerCase().trim();
        if (lowerBrand && !brandSet.has(lowerBrand)) {
            newBrandEntries.push({
                brand_name: lowerBrand,
                generic_name: normalGen,
                strength_text: '',
                dosage_form: '',
                route: '',
                is_primary: true
            });
            brandSet.add(lowerBrand);
        }
    }
    
    // Ghi vào DB (append, không xóa cũ)
    if (newGenericEntries.length > 0) {
        const tx = db.transaction(DRUG_GENERIC_STORE, 'readwrite');
        const store = tx.objectStore(DRUG_GENERIC_STORE);
        for (const entry of newGenericEntries) store.put(entry);
        await transactionComplete(tx);
    }
    
    if (newBrandEntries.length > 0) {
        const tx = db.transaction(DRUG_BRAND_MAP_STORE, 'readwrite');
        const store = tx.objectStore(DRUG_BRAND_MAP_STORE);
        for (const entry of newBrandEntries) store.put(entry);
        await transactionComplete(tx);
    }
    
    // Lưu metadata
    const now = new Date().toISOString();
    await setMetaValue(db, 'lastCrawlDate', now);
    await setMetaValue(db, 'lastCrawlCount', drugs.length);
    await setMetaValue(db, 'lastCrawlNewBrands', newBrandEntries.length);
    await setMetaValue(db, 'lastCrawlNewGenerics', newGenericEntries.length);
    
    console.log(`[Aladinn CDS] 📥 Import hoàn tất: ${newBrandEntries.length} biệt dược mới, ${newGenericEntries.length} hoạt chất mới (từ ${drugs.length} thuốc cào)`);
    
    await runtimeRuleIndex.init(db);
    
    return {
        newBrands: newBrandEntries.length,
        newGenerics: newGenericEntries.length,
        totalProcessed: processed,
        totalCrawled: drugs.length
    };
}

export async function getCrawlMetadata() {
    const db = await openDatabase();
    
    let remoteMeta = {};
    try {
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL) {
            const url = chrome.runtime.getURL('cds-data/metadata.json');
            const res = await fetch(url);
            if (res.ok) remoteMeta = await res.json();
        }
    } catch (e) {
        console.warn('[Aladinn CDS] Could not fetch cds-data/metadata.json', e);
    }

    return {
        lastCrawlDate: await getMetaValue(db, 'lastCrawlDate'),
        lastCrawlCount: await getMetaValue(db, 'lastCrawlCount'),
        seededAt: await getMetaValue(db, 'seededAt'),
        seedVersion: await getMetaValue(db, 'seedVersion'),
        ruleset_version: remoteMeta.ruleset_version || null,
        ruleset_source: remoteMeta.ruleset_source || null,
        last_updated: remoteMeta.last_updated || null
    };
}
