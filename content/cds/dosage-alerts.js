/**
 * 🧞 Aladinn CDS — Dosage Intelligence Engine (Phase 3)
 * Kiểm tra liều dùng tối đa, thuốc không phù hợp cho người cao tuổi (Beers Criteria),
 * và nhắc nhở Therapeutic Drug Monitoring (TDM).
 *
 * Nguyên tắc:
 * - Immutability: Không mutate bất kỳ dữ liệu đầu vào nào.
 * - PHI-free: Không lưu trữ hay log thông tin định danh bệnh nhân.
 * - Alert format khớp engine.js: { rule_code, domain, severity, title, effect, recommendation, matched_items }
 */

/**
 * Dosage limit database for common drugs.
 * Each entry: { maxDaily: mg/day, geriatricMax?: mg/day, unit: string, notes?: string }
 * @type {Object<string, Object>}
 */
export const DOSAGE_LIMITS = Object.freeze({
    paracetamol: Object.freeze({
        maxDaily: 4000,
        geriatricMax: 2000,
        unit: 'mg/day',
        notes: 'Giảm liều người cao tuổi. Thận trọng suy gan.',
    }),
    metformin: Object.freeze({
        maxDaily: 2550,
        unit: 'mg/day',
        notes: 'Chống chỉ định eGFR < 30. Giảm liều eGFR 30-45.',
    }),
    amlodipine: Object.freeze({
        maxDaily: 10,
        unit: 'mg/day',
    }),
    losartan: Object.freeze({
        maxDaily: 100,
        unit: 'mg/day',
    }),
    atorvastatin: Object.freeze({
        maxDaily: 80,
        unit: 'mg/day',
    }),
    omeprazole: Object.freeze({
        maxDaily: 40,
        unit: 'mg/day',
        notes: 'Không dùng quá 8 tuần liên tục nếu không có chỉ định rõ.',
    }),
    metoprolol: Object.freeze({
        maxDaily: 400,
        unit: 'mg/day',
    }),
    furosemide: Object.freeze({
        maxDaily: 600,
        unit: 'mg/day',
        notes: 'Theo dõi điện giải khi dùng liều cao.',
    }),
    aspirin: Object.freeze({
        maxDaily: 4000,
        cardiovascularMax: 325,
        unit: 'mg/day',
        notes: 'Liều chống viêm tối đa 4000 mg. Liều tim mạch ≤ 325 mg.',
    }),
    prednisolone: Object.freeze({
        maxDaily: 60,
        unit: 'mg/day',
        notes: 'Liều cấp tính. Giảm liều dần khi ngưng.',
    }),
    ciprofloxacin: Object.freeze({
        maxDaily: 1500,
        unit: 'mg/day',
    }),
    amoxicillin: Object.freeze({
        maxDaily: 3000,
        unit: 'mg/day',
    }),
    ibuprofen: Object.freeze({
        maxDaily: 3200,
        unit: 'mg/day',
        notes: 'Người cao tuổi: tránh nếu có thể (Beers).',
    }),
    diclofenac: Object.freeze({
        maxDaily: 150,
        unit: 'mg/day',
    }),
    gabapentin: Object.freeze({
        maxDaily: 3600,
        unit: 'mg/day',
    }),
    pregabalin: Object.freeze({
        maxDaily: 600,
        unit: 'mg/day',
    }),
    tramadol: Object.freeze({
        maxDaily: 400,
        geriatricMax: 300,
        unit: 'mg/day',
    }),
    morphine: Object.freeze({
        maxDaily: 200,
        unit: 'mg/day',
        notes: 'Không có giới hạn tuyệt đối, nhưng cảnh báo nếu > 200 mg/ngày đường uống.',
    }),
    warfarin: Object.freeze({
        maxDaily: 10,
        unit: 'mg/day',
        notes: 'Cảnh báo nếu liều > 10 mg/ngày. Yêu cầu INR monitoring.',
    }),
    digoxin: Object.freeze({
        maxDaily: 0.5,
        geriatricMax: 0.125,
        unit: 'mg/day',
        notes: 'Người cao tuổi: tối đa 0.125 mg/ngày. TDM bắt buộc.',
    }),
});

/**
 * Simplified Beers Criteria — drugs flagged for patients ≥ 65.
 * Each entry: { genericName, category, reason }
 * @type {ReadonlyArray<Object>}
 */
export const BEERS_LIST = Object.freeze([
    // Benzodiazepines
    Object.freeze({ genericName: 'diazepam', category: 'benzodiazepine', reason: 'Tăng nguy cơ suy giảm nhận thức, té ngã, gãy xương ở NCT.' }),
    Object.freeze({ genericName: 'lorazepam', category: 'benzodiazepine', reason: 'Tăng nguy cơ suy giảm nhận thức, té ngã, gãy xương ở NCT.' }),
    Object.freeze({ genericName: 'alprazolam', category: 'benzodiazepine', reason: 'Tăng nguy cơ suy giảm nhận thức, té ngã, gãy xương ở NCT.' }),
    Object.freeze({ genericName: 'midazolam', category: 'benzodiazepine', reason: 'Tăng nguy cơ suy giảm nhận thức, té ngã ở NCT.' }),

    // First-gen antihistamines
    Object.freeze({ genericName: 'chlorpheniramine', category: 'first-gen-antihistamine', reason: 'Tác dụng kháng cholinergic mạnh. Gây lú lẫn, khô miệng, bí tiểu ở NCT.' }),
    Object.freeze({ genericName: 'diphenhydramine', category: 'first-gen-antihistamine', reason: 'Tác dụng kháng cholinergic mạnh. Gây lú lẫn, buồn ngủ quá mức ở NCT.' }),
    Object.freeze({ genericName: 'promethazine', category: 'first-gen-antihistamine', reason: 'Tác dụng kháng cholinergic mạnh. Nguy cơ cao ở NCT.' }),

    // Long-acting sulfonylureas
    Object.freeze({ genericName: 'glibenclamide', category: 'long-acting-sulfonylurea', reason: 'Nguy cơ hạ đường huyết kéo dài ở NCT. Ưu tiên gliclazide hoặc glimepiride.' }),
    Object.freeze({ genericName: 'glyburide', category: 'long-acting-sulfonylurea', reason: 'Nguy cơ hạ đường huyết kéo dài ở NCT. Ưu tiên gliclazide hoặc glimepiride.' }),

    // NSAIDs
    Object.freeze({ genericName: 'ibuprofen', category: 'nsaid', reason: 'Tăng nguy cơ xuất huyết tiêu hóa, suy thận, tăng huyết áp ở NCT.' }),
    Object.freeze({ genericName: 'diclofenac', category: 'nsaid', reason: 'Tăng nguy cơ xuất huyết tiêu hóa, suy thận, tăng huyết áp ở NCT.' }),
    Object.freeze({ genericName: 'piroxicam', category: 'nsaid', reason: 'NSAID tác dụng kéo dài, nguy cơ cao ở NCT.' }),
    Object.freeze({ genericName: 'meloxicam', category: 'nsaid', reason: 'Tăng nguy cơ xuất huyết tiêu hóa ở NCT.' }),
    Object.freeze({ genericName: 'naproxen', category: 'nsaid', reason: 'Tăng nguy cơ xuất huyết tiêu hóa ở NCT.' }),

    // Muscle relaxants
    Object.freeze({ genericName: 'methocarbamol', category: 'muscle-relaxant', reason: 'Tác dụng kháng cholinergic. Dung nạp kém, buồn ngủ ở NCT.' }),
    Object.freeze({ genericName: 'cyclobenzaprine', category: 'muscle-relaxant', reason: 'Tác dụng kháng cholinergic. Dung nạp kém, buồn ngủ ở NCT.' }),

    // Tricyclic antidepressants
    Object.freeze({ genericName: 'amitriptyline', category: 'tricyclic-antidepressant', reason: 'Kháng cholinergic mạnh, an thần, hạ huyết áp tư thế đứng ở NCT.' }),
    Object.freeze({ genericName: 'nortriptyline', category: 'tricyclic-antidepressant', reason: 'Kháng cholinergic, nguy cơ rối loạn nhịp tim ở NCT.' }),

    // Antipsychotics (dementia)
    Object.freeze({ genericName: 'haloperidol', category: 'antipsychotic-dementia', reason: 'Tăng nguy cơ tử vong ở BN sa sút trí tuệ. Chỉ dùng khi tuyệt đối cần thiết.' }),
    Object.freeze({ genericName: 'risperidone', category: 'antipsychotic-dementia', reason: 'Tăng nguy cơ đột quỵ, tử vong ở BN sa sút trí tuệ.' }),
    Object.freeze({ genericName: 'quetiapine', category: 'antipsychotic-dementia', reason: 'Tăng nguy cơ tử vong ở BN sa sút trí tuệ.' }),
    Object.freeze({ genericName: 'olanzapine', category: 'antipsychotic-dementia', reason: 'Tăng nguy cơ tử vong, tăng cân, rối loạn chuyển hóa ở BN sa sút trí tuệ.' }),
]);

/**
 * Drugs requiring Therapeutic Drug Monitoring (TDM).
 * Each entry: { genericName, labCode, therapeuticRange, reason }
 * @type {ReadonlyArray<Object>}
 */
export const TDM_DRUGS = Object.freeze([
    // Antibiotics
    Object.freeze({ genericName: 'vancomycin', labCode: 'vancomycin_trough', therapeuticRange: '10-20 mcg/mL', reason: 'Nguy cơ độc thận nếu nồng độ đáy > 20 mcg/mL.' }),
    Object.freeze({ genericName: 'gentamicin', labCode: 'gentamicin_trough', therapeuticRange: '<2 mcg/mL', reason: 'Nguy cơ độc thận và ototoxicity.' }),
    Object.freeze({ genericName: 'amikacin', labCode: 'amikacin_trough', therapeuticRange: '<5 mcg/mL', reason: 'Nguy cơ độc thận và ototoxicity.' }),

    // Anticonvulsants
    Object.freeze({ genericName: 'phenytoin', labCode: 'phenytoin_level', therapeuticRange: '10-20 mcg/mL', reason: 'Dược động học bão hòa, nguy cơ độc tính thần kinh.' }),
    Object.freeze({ genericName: 'carbamazepine', labCode: 'carbamazepine_level', therapeuticRange: '4-12 mcg/mL', reason: 'Tự cảm ứng enzyme CYP3A4.' }),
    Object.freeze({ genericName: 'valproic acid', labCode: 'valproate_level', therapeuticRange: '50-100 mcg/mL', reason: 'Nguy cơ độc gan, giảm tiểu cầu ở nồng độ cao.' }),

    // Cardiac
    Object.freeze({ genericName: 'digoxin', labCode: 'digoxin_level', therapeuticRange: '0.8-2.0 ng/mL', reason: 'Cửa sổ trị liệu hẹp. Nguy cơ loạn nhịp nếu quá liều.' }),

    // Psychiatric
    Object.freeze({ genericName: 'lithium', labCode: 'lithium_level', therapeuticRange: '0.6-1.2 mEq/L', reason: 'Cửa sổ trị liệu hẹp. Nguy cơ độc thận, giáp.' }),

    // Respiratory
    Object.freeze({ genericName: 'theophylline', labCode: 'theophylline_level', therapeuticRange: '10-20 mcg/mL', reason: 'Nguy cơ loạn nhịp, co giật ở nồng độ cao.' }),

    // Immunosuppressants
    Object.freeze({ genericName: 'cyclosporine', labCode: 'cyclosporine_trough', therapeuticRange: '100-400 ng/mL', reason: 'Nguy cơ độc thận, thải ghép nếu nồng độ không phù hợp.' }),
    Object.freeze({ genericName: 'tacrolimus', labCode: 'tacrolimus_trough', therapeuticRange: '5-20 ng/mL', reason: 'Nguy cơ độc thận, thải ghép nếu nồng độ không phù hợp.' }),
]);

// =====================================================
// Internal helpers (pure, stateless)
// =====================================================

const GERIATRIC_AGE_THRESHOLD = 65;

/**
 * Calculate effective daily dose from a medication object.
 * Prefers explicit dailyDose, else computes dose * frequency.
 * @param {Object} med - Medication with dose, frequency, dailyDose
 * @returns {number} Daily dose in mg (0 if incalculable)
 */
function getEffectiveDailyDose(med) {
    if (med.dailyDose != null && med.dailyDose > 0) {
        return med.dailyDose;
    }
    const dose = Number(med.dose) || 0;
    const freq = Number(med.frequency) || 0;
    return dose * freq;
}

/**
 * Normalize a generic drug name for matching.
 * @param {string} name
 * @returns {string}
 */
function normalizeGenericName(name) {
    if (!name) return '';
    return String(name).toLowerCase().trim();
}

// =====================================================
// Public API
// =====================================================

/**
 * Check max daily dose violations.
 * @param {Array<Object>} medications - List of medication objects
 * @param {Object} limits - Dosage limits database (DOSAGE_LIMITS format)
 * @param {number} [patientAge] - Patient age for geriatric threshold
 * @returns {Array<Object>} Array of alert objects
 */
export function checkMaxDose(medications, limits, patientAge) {
    if (!Array.isArray(medications) || !limits) return [];

    const alerts = [];
    const isGeriatric = typeof patientAge === 'number' && patientAge >= GERIATRIC_AGE_THRESHOLD;

    for (const med of medications) {
        const generic = normalizeGenericName(med.genericName);
        if (!generic) continue;

        const limit = limits[generic];
        if (!limit) continue;

        const dailyDose = getEffectiveDailyDose(med);
        if (dailyDose <= 0) continue;

        // Check geriatric max first (more restrictive)
        if (isGeriatric && limit.geriatricMax != null && dailyDose > limit.geriatricMax) {
            alerts.push({
                rule_code: `DOSE-GERIATRIC-MAX-${generic.toUpperCase()}`,
                domain: 'geriatric',
                severity: 'high',
                title: `Quá liều tối đa cho NCT: ${generic}`,
                effect: `Liều ${dailyDose} ${limit.unit} vượt mức tối đa cho NCT (${limit.geriatricMax} ${limit.unit}).`,
                recommendation: `Giảm liều ${generic} ≤ ${limit.geriatricMax} ${limit.unit} cho bệnh nhân ≥ ${GERIATRIC_AGE_THRESHOLD} tuổi.${limit.notes ? ' ' + limit.notes : ''}`,
                matched_items: { drug: [generic], dailyDose, geriatricMax: limit.geriatricMax },
            });
            continue; // Don't double-alert for both geriatric + general max
        }

        // Check general max
        if (dailyDose > limit.maxDaily) {
            alerts.push({
                rule_code: `DOSE-MAX-EXCEEDED-${generic.toUpperCase()}`,
                domain: 'dosage',
                severity: 'high',
                title: `Quá liều tối đa: ${generic}`,
                effect: `Liều ${dailyDose} ${limit.unit} vượt mức tối đa cho phép (${limit.maxDaily} ${limit.unit}).`,
                recommendation: `Giảm liều ${generic} ≤ ${limit.maxDaily} ${limit.unit}.${limit.notes ? ' ' + limit.notes : ''}`,
                matched_items: { drug: [generic], dailyDose, maxDaily: limit.maxDaily },
            });
        }
    }

    return alerts;
}

/**
 * Check geriatric inappropriate medications (simplified Beers Criteria).
 * Only fires for patients ≥ 65 years old.
 * @param {Array<Object>} medications - List of medication objects
 * @param {number} patientAge - Patient age in years
 * @returns {Array<Object>} Array of alert objects
 */
export function checkGeriatricAlerts(medications, patientAge) {
    if (!Array.isArray(medications) || typeof patientAge !== 'number') return [];
    if (patientAge < GERIATRIC_AGE_THRESHOLD) return [];

    const alerts = [];
    const beersMap = new Map();
    for (const entry of BEERS_LIST) {
        beersMap.set(entry.genericName, entry);
    }

    for (const med of medications) {
        const generic = normalizeGenericName(med.genericName);
        if (!generic) continue;

        const beersEntry = beersMap.get(generic);
        if (!beersEntry) continue;

        alerts.push({
            rule_code: `BEERS-${generic.toUpperCase()}`,
            domain: 'geriatric',
            severity: beersEntry.category === 'antipsychotic-dementia' ? 'critical' : 'high',
            title: `Beers Criteria: ${generic} không phù hợp cho NCT`,
            effect: beersEntry.reason,
            recommendation: `Cân nhắc thay thế ${generic} (${beersEntry.category}) cho bệnh nhân ${patientAge} tuổi. Tham khảo Beers Criteria 2023.`,
            matched_items: { drug: [generic], category: beersEntry.category },
        });
    }

    return alerts;
}

/**
 * Check if TDM drugs need monitoring (no recent TDM lab result available).
 * @param {Array<Object>} medications - List of medication objects
 * @param {Array<Object>} labs - Lab results array [{ code, value, unit }]
 * @returns {Array<Object>} Array of alert objects
 */
export function checkTdmReminders(medications, labs) {
    if (!Array.isArray(medications)) return [];

    const labCodes = new Set();
    if (Array.isArray(labs)) {
        for (const lab of labs) {
            if (lab.code) labCodes.add(lab.code.toLowerCase());
        }
    }

    const tdmMap = new Map();
    for (const entry of TDM_DRUGS) {
        tdmMap.set(entry.genericName, entry);
    }

    const alerts = [];

    for (const med of medications) {
        const generic = normalizeGenericName(med.genericName);
        if (!generic) continue;

        const tdmEntry = tdmMap.get(generic);
        if (!tdmEntry) continue;

        // Check if the corresponding TDM lab exists
        if (labCodes.has(tdmEntry.labCode.toLowerCase())) continue;

        alerts.push({
            rule_code: `TDM-REMINDER-${generic.toUpperCase()}`,
            domain: 'tdm',
            severity: 'medium',
            title: `Nhắc TDM: ${generic}`,
            effect: `${generic} yêu cầu TDM (${tdmEntry.therapeuticRange}). Chưa tìm thấy kết quả XN ${tdmEntry.labCode}.`,
            recommendation: `Kiểm tra nồng độ ${generic} trong máu. ${tdmEntry.reason} Khoảng trị liệu: ${tdmEntry.therapeuticRange}.`,
            matched_items: { drug: [generic], labCode: tdmEntry.labCode, therapeuticRange: tdmEntry.therapeuticRange },
        });
    }

    return alerts;
}

/**
 * Run all dosage intelligence checks against a patient context.
 * Returns a new array of alert objects — never mutates the input.
 *
 * @param {Object} context - Patient context
 * @param {Array<Object>}  context.medications - Medication list
 * @param {Object}         context.patient     - Patient demographics { age, gender, ... }
 * @param {Array<Object>}  [context.labs]      - Lab results
 * @returns {Array<Object>} Combined array of dosage, geriatric, and TDM alerts
 */
export function runDosageAlerts(context) {
    if (!context) return [];

    const medications = context.medications || [];
    const patientAge = context.patient?.age;
    const labs = context.labs || [];

    if (medications.length === 0) return [];

    const maxDoseAlerts = checkMaxDose(medications, DOSAGE_LIMITS, patientAge);
    const geriatricAlerts = checkGeriatricAlerts(medications, patientAge);
    const tdmAlerts = checkTdmReminders(medications, labs);

    return [...maxDoseAlerts, ...geriatricAlerts, ...tdmAlerts];
}

/**
 * Convenience export bundling the engine and its data.
 * Consumers can import { DosageAlertEngine } or individual functions.
 */
export const DosageAlertEngine = Object.freeze({
    DOSAGE_LIMITS,
    BEERS_LIST,
    TDM_DRUGS,
    runDosageAlerts,
    checkMaxDose,
    checkGeriatricAlerts,
    checkTdmReminders,
});
