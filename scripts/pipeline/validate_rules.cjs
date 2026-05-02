#!/usr/bin/env node
/**
 * Phase 5 — Clinical Rules Validator
 * Checks schema integrity, duplicates, severity distribution, and cross-references.
 */
const fs = require('fs');
const path = require('path');
const dataDir = path.join(__dirname, '../../public/cds-data');

let errors = 0, warnings = 0;
function error(msg) { console.error(`  ❌ ${msg}`); errors++; }
function warn(msg) { console.warn(`  ⚠️  ${msg}`); warnings++; }
function ok(msg) { console.log(`  ✅ ${msg}`); }

function loadJson(file) {
    try { return JSON.parse(fs.readFileSync(path.join(dataDir, file), 'utf8')); }
    catch { return null; }
}

console.log('🔍 Aladinn CDS — Clinical Rules Validator\n');

// === 1. DDI Rules ===
console.log('📋 DDI Rules:');
const ddi = loadJson('ddi_rules.json');
if (!ddi) { error('ddi_rules.json not found'); } else {
    ok(`${ddi.length} rules loaded`);
    const pairs = new Map();
    const codes = new Set();
    for (const r of ddi) {
        if (!r.rule_code) error(`Missing rule_code: ${JSON.stringify(r).slice(0,80)}`);
        if (!r.generic_a || !r.generic_b) error(`Missing generic: ${r.rule_code}`);
        if (!r.severity) error(`Missing severity: ${r.rule_code}`);
        if (!r.clinical_effect) warn(`Missing clinical_effect: ${r.rule_code}`);
        if (codes.has(r.rule_code)) warn(`Duplicate rule_code: ${r.rule_code}`);
        codes.add(r.rule_code);
        const key = [r.generic_a, r.generic_b].sort().join('|');
        if (pairs.has(key)) {
            const existing = pairs.get(key);
            if (existing.severity === r.severity) warn(`Duplicate pair same severity: ${key} (${r.rule_code} vs ${existing.rule_code})`);
        }
        pairs.set(key, r);
    }
    // Severity distribution
    const sev = {};
    for (const r of ddi) { sev[r.severity] = (sev[r.severity] || 0) + 1; }
    ok(`Severity: ${Object.entries(sev).map(([k,v]) => `${k}=${v}`).join(', ')}`);
    ok(`Unique pairs: ${pairs.size}`);
}

// === 2. Drug-Disease Rules ===
console.log('\n📋 Drug-Disease Rules:');
const ddd = loadJson('drug_disease_rules.json');
if (!ddd) { error('drug_disease_rules.json not found'); } else {
    ok(`${ddd.length} rules loaded`);
    for (const r of ddd) {
        if (!r.rule_code) error(`Missing rule_code`);
        if (!r.generic_name) warn(`Missing generic_name: ${r.rule_code}`);
        if (!r.condition_group_code) error(`Missing condition_group_code: ${r.rule_code}`);
    }
}

// === 3. Renal Rules ===
console.log('\n📋 Renal Adjustment Rules:');
const renal = loadJson('renal_adjustment_rules.json');
if (!renal) { warn('renal_adjustment_rules.json not found'); } else {
    ok(`${renal.length} rules loaded`);
    for (const r of renal) {
        if (!r.rule_code) error(`Missing rule_code`);
        if (typeof r.egfr_threshold !== 'number') error(`Invalid egfr_threshold: ${r.rule_code}`);
        if (!['<', '<=', '>', '>='].includes(r.operator)) error(`Invalid operator: ${r.rule_code}`);
    }
}

// === 4. Drug-Lab Rules ===
console.log('\n📋 Drug-Lab Rules:');
const drugLab = loadJson('drug_lab_rules.json');
if (!drugLab) { warn('drug_lab_rules.json not found'); } else {
    ok(`${drugLab.length} rules loaded`);
    for (const r of drugLab) {
        if (!r.rule_code) error(`Missing rule_code`);
        if (!r.drugs?.length) error(`Empty drugs: ${r.rule_code}`);
        if (!r.lab_code) error(`Missing lab_code: ${r.rule_code}`);
        if (!['<', '>', '>=', '<=', 'range'].includes(r.operator)) error(`Invalid operator: ${r.rule_code}`);
    }
}

// === 5. Missing Diagnosis Rules ===
console.log('\n📋 Missing Diagnosis Rules:');
const mdiag = loadJson('missing_diagnosis_rules.json');
if (!mdiag) { warn('missing_diagnosis_rules.json not found'); } else {
    ok(`${mdiag.length} rules loaded`);
    for (const r of mdiag) {
        if (!r.rule_code) error(`Missing rule_code`);
        if (!r.drug_class?.length) error(`Empty drug_class: ${r.rule_code}`);
        if (!r.required_condition_groups?.length) error(`Empty required_condition_groups: ${r.rule_code}`);
    }
}

// === 6. Generics ===
console.log('\n📋 Drug Generics:');
const generics = loadJson('drug_generic.json');
if (!generics) { error('drug_generic.json not found'); } else {
    ok(`${generics.length} generics loaded`);
    const names = new Set();
    let dupes = 0;
    for (const g of generics) {
        const clean = g.generic_name.toLowerCase().replace(/\(.*?\)/g,'').trim();
        if (names.has(clean)) { dupes++; }
        names.add(clean);
    }
    if (dupes > 0) warn(`${dupes} potential duplicate generics (after paren cleanup)`);
    // Check DDI generics exist in generic DB
    if (ddi) {
        const missing = new Set();
        for (const r of ddi) {
            if (!names.has(r.generic_a.toLowerCase())) missing.add(r.generic_a);
            if (!names.has(r.generic_b.toLowerCase())) missing.add(r.generic_b);
        }
        if (missing.size > 0) warn(`DDI references ${missing.size} generics not in DB: ${[...missing].slice(0,10).join(', ')}`);
        else ok('All DDI generics found in DB');
    }
}

// === 7. Condition Groups ===
console.log('\n📋 Condition Groups:');
const conds = loadJson('condition_group_icd_map.json');
if (!conds) { error('condition_group_icd_map.json not found'); } else {
    ok(`${conds.length} condition groups loaded`);
    const groups = new Set(conds.map(c => c.condition_group));
    // Cross-check drug-disease
    if (ddd) {
        for (const r of ddd) {
            if (!groups.has(r.condition_group)) warn(`DDD references unknown group: ${r.condition_group}`);
        }
    }
}

// === Summary ===
console.log('\n' + '='.repeat(50));
console.log(`📊 Validation Complete: ${errors} errors, ${warnings} warnings`);
if (errors === 0) console.log('🎉 All rules pass schema validation!');
else console.log('🔴 Fix errors before deployment.');
process.exit(errors > 0 ? 1 : 0);
