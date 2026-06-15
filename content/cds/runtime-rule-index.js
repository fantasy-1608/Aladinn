/**
 * 🧞 Aladinn CDS — In-Memory Runtime Rule Index
 */
import {
    getDrugGenericMap,
    getBrandMap,
    getConditionGroupMappings,
    getDdiRules,
    getDrugDiseaseRules,
    getInsuranceFormulary,
    getInsuranceRules,
    getRenalAdjustmentRules,
    getDrugLabRules
} from './db.js';

export class RuntimeRuleIndex {
    constructor() {
        this.initialized = false;
        this.ddiMap = new Map();
        this.drugDiseaseMap = new Map();
        this.renalMap = new Map();
        this.labMap = new Map();
        this.insuranceRuleMap = new Map();
        this.insuranceFormularyMap = new Map();
        this.genericMap = new Map();
        this.brandMap = new Map();
        this.conditionGroupMappings = [];
    }

    async init(db) {
        let dbConn = db;
        if (!dbConn) {
            const { openDatabase } = await import('./db.js');
            dbConn = await openDatabase();
        }

        const [
            genericMap,
            brandMap,
            conditionGroupMappings,
            ddiRules,
            drugDiseaseRules,
            insuranceFormulary,
            insuranceRules,
            renalRules,
            drugLabRules
        ] = await Promise.all([
            getDrugGenericMap(dbConn),
            getBrandMap(dbConn),
            getConditionGroupMappings(dbConn),
            getDdiRules(dbConn),
            getDrugDiseaseRules(dbConn),
            getInsuranceFormulary(dbConn),
            getInsuranceRules(dbConn),
            getRenalAdjustmentRules(dbConn),
            getDrugLabRules(dbConn)
        ]);

        this.genericMap = genericMap;
        this.brandMap = brandMap;
        this.conditionGroupMappings = conditionGroupMappings;

        // Build DDI: Map pairKey (sorted drug names) -> rules
        this.ddiMap.clear();
        for (const rule of ddiRules) {
            if (!rule.is_active) continue;
            const key = [rule.generic_a.toLowerCase(), rule.generic_b.toLowerCase()].sort().join('|');
            if (!this.ddiMap.has(key)) {
                this.ddiMap.set(key, []);
            }
            this.ddiMap.get(key).push(rule);
        }

        // Build Drug-Disease: Map generic_name -> rules
        this.drugDiseaseMap.clear();
        for (const rule of drugDiseaseRules) {
            if (!rule.is_active) continue;
            const key = rule.generic_name.toLowerCase();
            if (!this.drugDiseaseMap.has(key)) {
                this.drugDiseaseMap.set(key, []);
            }
            this.drugDiseaseMap.get(key).push(rule);
        }

        // Build Renal: Map generic_name -> rules
        this.renalMap.clear();
        for (const rule of renalRules) {
            if (!rule.is_active) continue;
            const key = rule.generic_name.toLowerCase();
            if (!this.renalMap.has(key)) {
                this.renalMap.set(key, []);
            }
            this.renalMap.get(key).push(rule);
        }

        // Build Lab: Map generic_name -> rules (for each drug in the rule.drugs list)
        this.labMap.clear();
        for (const rule of drugLabRules) {
            if (!rule.is_active) continue;
            for (const drug of rule.drugs) {
                const key = drug.toLowerCase();
                if (!this.labMap.has(key)) {
                    this.labMap.set(key, []);
                }
                this.labMap.get(key).push(rule);
            }
        }

        // Build Insurance: Map generic_name -> rules (for insurance rules)
        this.insuranceRuleMap.clear();
        for (const rule of insuranceRules) {
            if (!rule.is_active) continue;
            const key = rule.generic_name.toLowerCase();
            if (!this.insuranceRuleMap.has(key)) {
                this.insuranceRuleMap.set(key, []);
            }
            this.insuranceRuleMap.get(key).push(rule);
        }

        // Build Insurance: Map generic_name -> entry (for formulary)
        this.insuranceFormularyMap.clear();
        for (const entry of insuranceFormulary) {
            const key = entry.generic_name.toLowerCase();
            this.insuranceFormularyMap.set(key, entry);
        }

        this.initialized = true;
    }
}

export const runtimeRuleIndex = new RuntimeRuleIndex();
