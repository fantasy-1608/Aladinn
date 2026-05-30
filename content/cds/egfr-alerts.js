/**
 * 🧞 Aladinn CDS — eGFR & Renal Alerts Utility
 * Cung cấp công thức Cockcroft-Gault và CKD-EPI (2021) để tính toán eGFR từ Creatinine máu.
 * Đảm bảo tính bất biến (Immutability) và an toàn thông tin (PHI).
 */

/**
 * Chuyển đổi Creatinine từ μmol/L sang mg/dL nếu cần thiết.
 * Ngưỡng tự động phát hiện: creatinine > 15 chắc chắn là μmol/L.
 * @param {number} value - Giá trị Creatinine
 * @param {string} unit - Đơn vị đo
 * @returns {number} Giá trị tính theo mg/dL
 */
export function getCreatinineMgDl(value, unit = '') {
    if (!value || value <= 0) return 0;
    const u = String(unit).toLowerCase();
    if (u.includes('umol') || u.includes('μmol') || value > 15) {
        return value / 88.4;
    }
    return value;
}

/**
 * Công thức Cockcroft-Gault tính eGFR (mL/phút)
 * eGFR = ((140 - Age) * Weight) / (72 * Creatinine mg/dL) * (0.85 nếu là Nữ)
 */
export function calculateCockcroftGault(age, gender, weight, creatinineMgDl) {
    if (!age || !weight || !creatinineMgDl || creatinineMgDl <= 0) return null;
    const isFemale = String(gender).toLowerCase() === 'nữ' || String(gender).toLowerCase() === 'female' || String(gender).toLowerCase() === 'f';
    let egfr = ((140 - age) * weight) / (72 * creatinineMgDl);
    if (isFemale) {
        egfr *= 0.85;
    }
    return parseFloat(egfr.toFixed(2));
}

/**
 * Công thức CKD-EPI (2021) tính eGFR (mL/phút/1.73m2) - Race-free
 * eGFR = 142 * min(Scr/K, 1)^A * max(Scr/K, 1)^-1.200 * 0.9938^Age * (1.012 nếu là Nữ)
 */
export function calculateCkdEpi(age, gender, creatinineMgDl) {
    if (!age || !creatinineMgDl || creatinineMgDl <= 0) return null;
    const isFemale = String(gender).toLowerCase() === 'nữ' || String(gender).toLowerCase() === 'female' || String(gender).toLowerCase() === 'f';
    
    const kappa = isFemale ? 0.7 : 0.9;
    const alpha = isFemale ? -0.241 : -0.302;
    const genderCoeff = isFemale ? 1.012 : 1.0;
    
    const scrOverKappa = creatinineMgDl / kappa;
    const minTerm = Math.pow(Math.min(scrOverKappa, 1), alpha);
    const maxTerm = Math.pow(Math.max(scrOverKappa, 1), -1.200);
    const ageTerm = Math.pow(0.9938, age);
    
    const egfr = 142 * minTerm * maxTerm * ageTerm * genderCoeff;
    return parseFloat(egfr.toFixed(2));
}

/**
 * Tự động tính toán eGFR và chèn vào danh sách xét nghiệm của Context.
 * Đảm bảo nguyên tắc Immutability (Không thay đổi trực tiếp context cũ).
 * @param {Object} context - Bệnh cảnh lâm sàng hiện tại
 * @returns {Object} Context mới đã được bổ sung eGFR nếu đủ điều kiện
 */
export function injectCalculatedEgfr(context) {
    if (!context) return context;

    // Nếu đã có eGFR sẵn trong labs từ HIS, không tính đè
    const hasEgfr = (context.labs || []).some(l => l.code === 'eGFR');
    if (hasEgfr) return context;

    const creatinineLab = (context.labs || []).find(l => l.code === 'creatinine');
    if (!creatinineLab) return context;

    const age = context.patient?.age;
    const gender = context.patient?.gender;
    const weight = context.patient?.weight;

    if (!age || !gender) {
        console.log('[Aladinn eGFR] ⚠️ Missing age or gender. Cannot calculate eGFR.');
        return context;
    }

    const creatinineMgDl = getCreatinineMgDl(creatinineLab.value, creatinineLab.unit);
    if (creatinineMgDl <= 0) return context;

    // Ưu tiên CKD-EPI (2021) làm chuẩn eGFR chính, Cockcroft-Gault làm tham chiếu nếu có cân nặng
    const egfrCkdEpi = calculateCkdEpi(age, gender, creatinineMgDl);
    if (!egfrCkdEpi) return context;

    const newLabs = [...(context.labs || [])];

    // Chèn eGFR chính (CKD-EPI)
    newLabs.push({
        code: 'eGFR',
        value: egfrCkdEpi,
        unit: 'mL/min/1.73m2',
        refRange: '>= 90'
    });

    // Nếu có cân nặng, tính thêm Cockcroft-Gault
    if (weight && weight > 0) {
        const egfrCG = calculateCockcroftGault(age, gender, weight, creatinineMgDl);
        if (egfrCG) {
            newLabs.push({
                code: 'eGFR_CG',
                value: egfrCG,
                unit: 'mL/min',
                refRange: '>= 90'
            });
        }
    }

    // Return bản sao mới của context để tuân thủ tính Immutability
    return {
        ...context,
        patient: {
            ...(context.patient || {})
        },
        encounter: {
            ...(context.encounter || {})
        },
        insurance: {
            ...(context.insurance || {})
        },
        medications: [...(context.medications || [])],
        labs: newLabs
    };
}
