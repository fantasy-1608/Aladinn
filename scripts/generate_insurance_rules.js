import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DRUG_GENERIC_PATH = path.join(__dirname, '../public/cds-data/drug_generic.json');
const INSURANCE_RULES_PATH = path.join(__dirname, '../public/cds-data/insurance_rules.json');

// Dictionary of explicit mappings
const KNOWLEDGE_BASE = {
    // NSAIDs & Painkillers
    'celecoxib': { icd: 'M', msg: 'Thuốc chống viêm NSAID cần chẩn đoán bệnh cơ xương khớp (M).' },
    'ibuprofen': { icd: 'M,R50,R51,R52', msg: 'NSAID cần chẩn đoán viêm/đau/sốt (M, R50-R52).' },
    'diclofenac': { icd: 'M,R52', msg: 'NSAID cần chẩn đoán viêm/đau (M, R52).' },
    'paracetamol': { icd: 'R50,R51,R52,M,J', msg: 'Paracetamol cần chẩn đoán sốt/đau (R50-R52, M, J).' },
    'acetaminophen': { icd: 'R50,R51,R52,M,J', msg: 'Acetaminophen cần chẩn đoán sốt/đau (R50-R52, M, J).' },
    
    // Antibiotics
    'amoxicillin': { icd: 'A,B,J,N,L,K,H,T', msg: 'Kháng sinh cần chẩn đoán bệnh lý nhiễm khuẩn (A, B, J, N...).' },
    'amoxicillin-clavulanate': { icd: 'A,B,J,N,L,K,H,T', msg: 'Kháng sinh cần chẩn đoán bệnh lý nhiễm khuẩn.' },
    'amoxicilin': { icd: 'A,B,J,N,L,K,H,T', msg: 'Kháng sinh cần chẩn đoán bệnh lý nhiễm khuẩn.' },
    'ampicilin': { icd: 'A,B,J,N,L,K,H,T', msg: 'Kháng sinh cần chẩn đoán bệnh lý nhiễm khuẩn.' },
    'cefuroxim': { icd: 'A,B,J,N,L,K,H,T', msg: 'Kháng sinh cần chẩn đoán bệnh lý nhiễm khuẩn.' },
    'ceftriaxon': { icd: 'A,B,J,N,L,K,H,T', msg: 'Kháng sinh cần chẩn đoán bệnh lý nhiễm khuẩn.' },
    'azithromycin': { icd: 'A,B,J,N,L,K,H', msg: 'Kháng sinh nhóm Macrolid cần chẩn đoán nhiễm khuẩn (A, B, J...).' },
    'clarithromycin': { icd: 'A,B,J,N,L,K,H', msg: 'Kháng sinh cần chẩn đoán bệnh lý nhiễm khuẩn.' },
    
    // Cardiovascular
    'amlodipin': { icd: 'I10,I11,I12,I13,I14,I15,I20,I25', msg: 'Thuốc chẹn kênh Canxi cần chẩn đoán Tăng huyết áp / Bệnh mạch vành (I10-I15, I20, I25).' },
    'atenolol': { icd: 'I10,I11,I15,I20,I25,I50', msg: 'Chẹn beta cần chẩn đoán THA / Bệnh mạch vành / Suy tim.' },
    'atorvastatin': { icd: 'E78,I10,I11,I20,I25,I63', msg: 'Statin cần chẩn đoán Rối loạn lipid máu (E78) hoặc Bệnh tim mạch (I).' },
    'simvastatin': { icd: 'E78,I10,I11,I20,I25,I63', msg: 'Statin cần chẩn đoán Rối loạn lipid máu (E78) hoặc Bệnh tim mạch (I).' },
    'losartan': { icd: 'I10,I11,I12,I13,I15,I50', msg: 'ARB cần chẩn đoán Tăng huyết áp / Suy tim (I10-I15, I50).' },
    'enalapril': { icd: 'I10,I11,I12,I13,I15,I50', msg: 'ACEI cần chẩn đoán Tăng huyết áp / Suy tim (I10-I15, I50).' },
    
    // GI
    'omeprazole': { icd: 'K20,K21,K25,K26,K27,K29,K30', msg: 'PPI cần chẩn đoán Bệnh lý dạ dày - tá tràng (K20-K30).' },
    'pantoprazole': { icd: 'K20,K21,K25,K26,K27,K29,K30', msg: 'PPI cần chẩn đoán Bệnh lý dạ dày - tá tràng (K20-K30).' },
    'esomeprazole': { icd: 'K20,K21,K25,K26,K27,K29,K30', msg: 'PPI cần chẩn đoán Bệnh lý dạ dày - tá tràng (K20-K30).' },
    
    // Respiratory
    'salbutamol': { icd: 'J44,J45,J46', msg: 'SABA cần chẩn đoán Hen phế quản / COPD (J44-J46).' },
    'ambroxol': { icd: 'J', msg: 'Thuốc long đờm cần chẩn đoán bệnh lý Hô hấp (J).' },
    'acetylcystein': { icd: 'J', msg: 'Thuốc tiêu nhầy cần chẩn đoán bệnh lý Hô hấp (J).' },
    
    // Diabetes
    'metformin': { icd: 'E10,E11,E12,E13,E14', msg: 'Thuốc hạ đường huyết cần chẩn đoán Đái tháo đường (E10-E14).' },
    'gliclazide': { icd: 'E10,E11,E12,E13,E14', msg: 'Thuốc hạ đường huyết cần chẩn đoán Đái tháo đường (E10-E14).' },
    'acarbose': { icd: 'E10,E11,E12,E13,E14', msg: 'Thuốc hạ đường huyết cần chẩn đoán Đái tháo đường (E10-E14).' },
    
    // Other
    'allopurinol': { icd: 'M10,E79', msg: 'Thuốc hạ acid uric cần chẩn đoán Gout (M10) hoặc Tăng acid uric máu (E79).' },
    'colchicin': { icd: 'M10', msg: 'Colchicin cần chẩn đoán Gout (M10).' },
    'warfarin': { icd: 'I48,I80,I81,I82,Z95', msg: 'Thuốc chống đông cần chẩn đoán Rung nhĩ / Huyết khối / Mang van tim nhân tạo.' },
    'acenocoumarol': { icd: 'I48,I80,I81,I82,Z95', msg: 'Thuốc chống đông cần chẩn đoán Rung nhĩ / Huyết khối / Mang van tim nhân tạo.' },
    'albendazol': { icd: 'B65,B66,B67,B68,B69,B70,B71,B72,B73,B74,B75,B76,B77,B78,B79,B80,B81,B82,B83', msg: 'Thuốc tẩy giun sán cần chẩn đoán bệnh Ký sinh trùng (B65-B83).' },
};

// Heuristics based on suffixes if not found in explicit map
function matchBySuffix(generic) {
    if (generic.match(/(cilin|cillin|mycin|micin|floxacin|cefa|cef|penem)$/)) {
        return { icd: 'A,B,J,N,L,K,H,T', msg: 'Kháng sinh cần chẩn đoán bệnh lý nhiễm khuẩn (A, B, J, N, L...).' };
    }
    if (generic.match(/(olol|dipin|pril|sartan)$/)) {
        return { icd: 'I10,I11,I15,I20,I25,I50', msg: 'Thuốc tim mạch / hạ áp cần chẩn đoán THA / Mạch vành / Suy tim (I10-I15, I20, I50).' };
    }
    if (generic.match(/(statin)$/)) {
        return { icd: 'E78,I10,I11,I20,I25,I63', msg: 'Thuốc hạ lipid máu cần chẩn đoán Rối loạn lipid máu (E78) hoặc Bệnh tim mạch (I).' };
    }
    if (generic.match(/(prazol|tidin)$/)) {
        return { icd: 'K20,K21,K25,K26,K27,K29,K30', msg: 'Thuốc dạ dày cần chẩn đoán Bệnh lý dạ dày - tá tràng (K20-K30).' };
    }
    if (generic.match(/(conazol)$/)) {
        return { icd: 'B35,B36,B37,B38,B39,B40,B41,B42,B43,B44,B45,B46,B47,B48,B49', msg: 'Thuốc chống nấm cần chẩn đoán Bệnh nấm (B35-B49).' };
    }
    if (generic.match(/(gli|gli|formin)$/)) {
        return { icd: 'E10,E11,E12,E13,E14', msg: 'Thuốc ĐTĐ cần chẩn đoán Đái tháo đường (E10-E14).' };
    }
    return null;
}

function run() {
    console.log('Generating insurance_rules.json...');
    const drugs = JSON.parse(fs.readFileSync(DRUG_GENERIC_PATH, 'utf8'));
    
    let generatedCount = 0;
    const rules = [];

    // Keep existing rules from current insurance_rules.json (to preserve manual entries like INS-OUTPATIENT-OPIOID-001)
    if (fs.existsSync(INSURANCE_RULES_PATH)) {
        const existing = JSON.parse(fs.readFileSync(INSURANCE_RULES_PATH, 'utf8'));
        // Filter out auto-generated ones from previous runs to avoid duplicates
        const manual = existing.filter(r => !r.rule_code.startsWith('INS-AUTO-'));
        rules.push(...manual);
    }

    for (const drug of drugs) {
        const generic = drug.generic_name.toLowerCase();
        
        let mapping = KNOWLEDGE_BASE[generic] || null;
        
        // If not explicit, try suffix heuristics
        if (!mapping) {
            mapping = matchBySuffix(generic);
        }

        if (mapping) {
            // Check if rule already exists for this generic in manual rules
            const exists = rules.some(r => r.generic_name.toLowerCase() === generic && r.condition_type === 'icd_prefix_required');
            if (!exists) {
                rules.push({
                    rule_code: `INS-AUTO-${generic.toUpperCase().replace(/[^A-Z0-9]/g, '')}`,
                    generic_name: generic,
                    condition_type: 'icd_prefix_required',
                    condition_value: mapping.icd,
                    severity: 'high',
                    message: mapping.msg,
                    recommendation: 'Bổ sung mã chẩn đoán ICD-10 tương ứng hoặc lựa chọn phương án điều trị khác.',
                    version: '1.2.0',
                    is_active: true
                });
                generatedCount++;
            }
        }
    }

    fs.writeFileSync(INSURANCE_RULES_PATH, JSON.stringify(rules, null, 2), 'utf8');
    console.log(`Generated ${generatedCount} new BHYT rules. Total rules: ${rules.length}.`);
}

run();
