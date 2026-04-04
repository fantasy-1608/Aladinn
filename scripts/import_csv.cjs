const fs = require('fs');
const path = require('path');

const ALIAS_MAP = {
    acetaminophen: 'paracetamol',
    augmentin: 'amoxicillin-clavulanate',
    brufen: 'ibuprofen',
    voltaren: 'diclofenac',
    hemapo: 'erythropoietin',
    epoetin: 'erythropoietin',
    'acid acetylsalicylic': 'aspirin',
    'acetylsalicylic acid': 'aspirin',
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
    ceftriaxon: 'ceftriaxone',
    cefuroxim: 'cefuroxime',
    cefotaxim: 'cefotaxime',
    ceftazidim: 'ceftazidime',
    cefoperazon: 'cefoperazone',
    cefixim: 'cefixime',
    cefpodoxim: 'cefpodoxime',
    cefdinir: 'cefdinir',
    cefepim: 'cefepime',
    amoxicilin: 'amoxicillin',
    ampicilin: 'ampicillin',
    piperacilin: 'piperacillin',
    oxacilin: 'oxacillin',
    cloxacilin: 'cloxacillin',
    dicloxacilin: 'dicloxacillin',
    azithromycin: 'azithromycin',
    clarithromycin: 'clarithromycin',
    erythromycin: 'erythromycin',
    ciprofloxacin: 'ciprofloxacin',
    levofloxacin: 'levofloxacin',
    moxifloxacin: 'moxifloxacin',
    ofloxacin: 'ofloxacin',
    gentamicin: 'gentamicin',
    amikacin: 'amikacin',
    tobramycin: 'tobramycin',
    metronidazol: 'metronidazole',
    cotrimoxazol: 'cotrimoxazole',
    sulfamethoxazol: 'sulfamethoxazole',
    trimethoprim: 'trimethoprim',
    vancomycin: 'vancomycin',
    clindamycin: 'clindamycin',
    doxycyclin: 'doxycycline',
    minocyclin: 'minocycline',
    tetracyclin: 'tetracycline',
    ketoconazol: 'ketoconazole',
    fluconazol: 'fluconazole',
    itraconazol: 'itraconazole',
    aciclovir: 'acyclovir',
    valaciclovir: 'valacyclovir',
    ganciclovir: 'ganciclovir',
    oseltamivir: 'oseltamivir',
    artesunat: 'artesunate',
    'paracetamol (acetaminophen)': 'paracetamol',
    'thuốc ho astemix': '', 
    'hoastex': ''
};

function normalizeGeneric(name) {
    if (!name || name === '-') return null;
    let n = name.toLowerCase().trim();
    // remove weird chars or parentheses info
    n = n.replace(/\(\*\)/g, '').replace(/\*/g, '').replace(/\(.*?\)/g, (match) => {
        if (match.includes('acetaminophen')) return '';
        return match;
    }).trim();
    
    // Split by "+"
    let parts = n.split(/\+/).map(p => p.trim());
    parts = parts.map(p => ALIAS_MAP[p] || p).filter(p => p && p.length > 0);
    
    if (parts.length === 0) return null;
    if (parts.length === 1) return parts[0];
    
    // Sort combined explicitly? For augmentin it's "amoxicillin-clavulanate" usually
    if (parts.includes('amoxicillin') && parts.includes('acid clavulanic')) return 'amoxicillin-clavulanate';
    
    return parts.join(' + ');
}

async function run() {
    const csvPath = process.argv[2] || '/Users/trunganh/Downloads/danh_muc_414_thuoc.csv';
    const genericJsonPath = path.join(__dirname, '../public/cds-data/drug_generic.json');
    const brandJsonPath = path.join(__dirname, '../public/cds-data/brand_generic_map.json');

    const csvData = fs.readFileSync(csvPath, 'utf8').split('\n');
    let genericData = JSON.parse(fs.readFileSync(genericJsonPath, 'utf8'));
    let brandData = JSON.parse(fs.readFileSync(brandJsonPath, 'utf8'));

    // Create sets for fast lookup
    const existingGenerics = new Set(genericData.map(g => g.generic_name));
    const existingBrands = new Set(brandData.map(b => b.brand_name.toLowerCase()));

    let newBrands = 0;
    let newGenerics = 0;

    for (let i = 1; i < csvData.length; i++) {
        const line = csvData[i].trim();
        if (!line) continue;
        
        const matches = line.match(/(?:\"([^\"]*)\"|([^,]+))/g);
        if (matches && matches.length >= 2) {
            let rsBrand = matches[0].replace(/^"|"$/g, '').trim();
            let rsGeneric = matches[1].replace(/^"|"$/g, '').trim();
            
            if (rsGeneric === '-') continue; // Supplies

            const normalGen = normalizeGeneric(rsGeneric);
            if (!normalGen) continue;

            const splitGens = normalGen.split(' + ');

            splitGens.forEach(g => {
                if (!existingGenerics.has(g)) {
                    genericData.push({
                        generic_name: g,
                        generic_name_en: g,
                        atc_code: '',
                        pharmacologic_class: 'unknown',
                        therapeutic_class: 'unknown',
                        is_active: true
                    });
                    existingGenerics.add(g);
                    newGenerics++;
                }
            });

            const lowerBrand = rsBrand.toLowerCase();
            if (!existingBrands.has(lowerBrand)) {
                brandData.push({
                    brand_name: lowerBrand,
                    generic_name: normalGen,
                    strength_text: '',
                    dosage_form: '',
                    route: '',
                    is_primary: true
                });
                existingBrands.add(lowerBrand);
                newBrands++;
            }
        }
    }

    fs.writeFileSync(genericJsonPath, JSON.stringify(genericData, null, 2));
    fs.writeFileSync(brandJsonPath, JSON.stringify(brandData, null, 2));

    console.log(`✅ Cập nhật thành công! Đã thêm ${newGenerics} hoạt chất mới và ${newBrands} biệt dược từ CSV vào file cấu hình.`);
}

run();
