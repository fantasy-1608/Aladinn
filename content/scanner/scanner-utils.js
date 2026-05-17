/**
 * 🧞 Aladinn — Scanner Pure Utility Functions
 * 
 * Extracted COPIES of pure functions from scanner-init.js for unit testing.
 * These functions have ZERO side effects, ZERO DOM access, ZERO state.
 * 
 * ⚠️  scanner-init.js still has its OWN copies of these functions.
 *     This file exists solely for testability. When test coverage is
 *     high enough (>80%), scanner-init.js can be refactored to import
 *     from here instead of defining locally.
 * 
 * @module scanner-utils
 */

// ── HTML Sanitization ────────────────────────────────────────────────

export function escapeHtml(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ── AI Error Mapping ─────────────────────────────────────────────────

export function getAiErrorMessage(error) {
    const code = error?.code || 'AI_ERROR';
    if (code === 'AI_LOCKED') return 'Phiên AI đã khóa hoặc chưa cấu hình API Key. Vui lòng nhập PIN trong Aladinn.';
    if (code === 'AI_INVALID_API_KEY') return 'API Key không hợp lệ hoặc không có quyền gọi Gemini. Vui lòng kiểm tra lại trong Cài đặt.';
    if (code === 'AI_QUOTA_LIMIT') return 'Gemini đang giới hạn quota/rate limit. Vui lòng thử lại sau.';
    if (code === 'AI_NETWORK_ERROR') return 'Không kết nối được Gemini. Vui lòng kiểm tra mạng.';
    if (code === 'AI_EMPTY_RESPONSE') return 'Gemini không trả về nội dung hợp lệ. Vui lòng phân tích lại.';
    return error?.message || 'Lỗi AI không xác định.';
}

// ── BHYT Date Parsing & Time Error Detection ─────────────────────────

export function parseBhytDate(str) {
    if (!str) return null;
    const parts = str.split(/[/\s:]/);
    if (parts.length >= 5) {
        return new Date(parts[2], parseInt(parts[1]) - 1, parts[0], parts[3], parts[4], parts[5] || 0);
    }
    return null;
}

export function analyzeBhytTimeErrors(sheets) {
    const errors = [];
    for (const s of sheets) {
        const tCD = parseBhytDate(s.tgChiDinh);
        const tTH = parseBhytDate(s.tgThucHien);
        const tKQ = parseBhytDate(s.tgKetQua);

        // Rule 1: Execution after result → error
        if (tTH && tKQ && tTH > tKQ) {
            errors.push({
                id: s.id, tenDV: s.tenDV || 'Đường máu MM',
                loi: `Thực hiện(${s.tgThucHien}) > Trả KQ(${s.tgKetQua})`,
                loaiLoi: 'TH_GT_KQ', ketQua: s.ketQua
            });
        }
        // Rule 2: TG Chỉ định > TG Kết quả
        if (tCD && tKQ && tCD > tKQ) {
            errors.push({
                id: s.id, tenDV: s.tenDV || 'Đường máu MM',
                loi: `CĐ(${s.tgChiDinh}) > TGTRAKETQUA(${s.tgKetQua})`,
                loaiLoi: 'CD_GT_KQ', ketQua: s.ketQua
            });
        }
        // Rule 3: TG Chỉ định > TG Thực hiện
        if (tCD && tTH && tCD > tTH) {
            errors.push({
                id: s.id, tenDV: s.tenDV || 'Đường máu MM',
                loi: `CĐ(${s.tgChiDinh}) > TGTHUCHIEN(${s.tgThucHien})`,
                loaiLoi: 'CD_GT_TH', ketQua: s.ketQua
            });
        }
    }
    return errors;
}

// ── Lab Data Helpers ─────────────────────────────────────────────────

export function parseLabDate(dStr) {
    if (!dStr) return 0;
    const parts = dStr.split(/[/\s:]/);
    if (parts.length >= 3) return new Date(parts[2], parts[1]-1, parts[0], parts[3]||0, parts[4]||0, parts[5]||0).getTime();
    return 0;
}

export function shortDate(d) {
    return d && d.includes(' ') ? d.split(' ')[0] : d;
}

export function isAbnormal(status) {
    if (!status) return false;
    const s = status.toLowerCase();
    return s.includes('cao') || s.includes('thấp') || s.includes('high') || s.includes('low') || s.includes('tăng') || s.includes('giảm');
}

export function statusColor(status) {
    if (!status) return null;
    const s = status.toLowerCase();
    if (s.includes('cao') || s.includes('high') || s.includes('tăng')) return { bg: 'rgba(239,68,68,0.15)', text: '#f87171', icon: '▲' };
    if (s.includes('thấp') || s.includes('low') || s.includes('giảm')) return { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', icon: '▼' };
    return null;
}

// ── Lab Classification ───────────────────────────────────────────────

export const LAB_CATEGORIES = {
    'Huyết học': [
        'WBC','NEU','NEU%','RBC','HGB','HCT','PLT','MCV','MCH','MCHC',
        'RDW','RDW-CV','RDW-SD','MPV','PDW','PDW-SD','PCT',
        'LYM','LYM%','MONO','MONO%','EOS','EOS%','BASO','BASO%',
        'P-LCR','NLR',
        'PT','PT%','PT INR','APTT','APTT ratio','Fibrinogen','INR','TT','D-Dimer',
        'ABO','Rh'
    ],
    'Nước tiểu': [
        'SG','pH','LEU','BLD','NIT','PRO','UBG',
        'GLU niệu','BIL niệu','KET niệu',
        'Protein niệu','Glucose niệu','Hồng cầu niệu','Bạch cầu niệu',
        'Nitrit','Ketone','Bilirubin niệu','Urobilinogen','Tỷ trọng'
    ],
    'Khí máu': [
        'pH','pCO2','pO2','HCO3act','HCO3std','BE(ecf)','BE(B)','ctCO2','O2SAT','pO2/FIO2','pO2(A-a)(T)','pO2(a/A)(T)','Temp','ctHb','FIO2','RI'
    ],
    'Sinh hóa': [
        'Glucose','Ure','Creatinin','eGFR','AST','ALT','GPT','GOT','GGT',
        'Bilirubin','Protein','Albumin','CRP','LDH','CK','Amylase','Lipase',
        'Acid Uric','Cholesterol','Triglycerid','HDL','LDL','HbA1c',
        'Cortisol','Procalcitonin','Troponin','BNP','NT-proBNP',
        'Na','K','Cl','Ca','Mg','Phospho'
    ]
};

export const URINE_CODES = new Set(['SG','LEU','BLD','NIT','UBG']);
export const AMBIGUOUS_URINE = new Set(['GLU','BIL','KET','PRO']);

export function classifyLab(code, testName, value) {
    const cUp = (code || '').toUpperCase().trim();
    const tUp = (testName || '').toUpperCase();
    const vUp = (value || '').toUpperCase().trim();
    const combined = cUp + ' ' + tUp;

    // 1. Explicit urine short codes
    if (URINE_CODES.has(cUp)) return 'Nước tiểu';

    // 2. Ambiguous codes — decide by test name context OR result value pattern
    if (AMBIGUOUS_URINE.has(cUp)) {
        if (tUp.includes('NƯỚC TIỂU') || tUp.includes('NIỆU') || tUp.includes('URIN')
            || tUp.includes('TỔNG PHÂN TÍCH') || tUp.includes('10 THÔNG SỐ')
            || tUp.includes('DIPSTICK')) return 'Nước tiểu';
        if (vUp && /^(ÂM TÍNH|DƯƠNG TÍNH|TRACE|SMALL|LARGE|MODERATE|NEGATIVE|POSITIVE|NEG|POS|NORMAL|\d*\+{1,4})$/i.test(vUp)) return 'Nước tiểu';
        if (!tUp.includes('MÁU') && !tUp.includes('HUYẾT') && !tUp.includes('PLASMA') && !tUp.includes('SERUM')) {
            if (tUp.trim() === cUp || tUp.trim().length <= 5) return 'Nước tiểu';
        }
        return 'Sinh hóa';
    }

    // 3. Vietnamese keyword matching
    if (combined.includes('NƯỚC TIỂU') || combined.includes('NIỆU') || combined.includes('URIN')) return 'Nước tiểu';
    if (combined.includes('HUYẾT ĐỒ') || combined.includes('TẾ BÀO MÁU') || combined.includes('CÔNG THỨC MÁU') ||
        combined.includes('ĐÔNG MÁU') || combined.includes('NHÓM MÁU') || combined.includes('HUYẾT HỌC')) return 'Huyết học';
    if (combined.includes('KHÍ MÁU') || combined.includes('KHI MAU')) return 'Khí máu';
    if (combined.includes('SINH HÓA') || combined.includes('HÓA SINH') || combined.includes('HOẠT ĐỘ') ||
        combined.includes('ĐỊNH LƯỢNG') || combined.includes('ĐỘ LỌC') || combined.includes('ĐIỆN GIẢI')) return 'Sinh hóa';


    // 4. Keyword list matching
    for (const [cat, keywords] of Object.entries(LAB_CATEGORIES)) {
        for (const kw of keywords) {
            const kwU = kw.toUpperCase();
            if (/^[A-Z0-9%-]+$/.test(kwU)) {
                if (new RegExp(`\\b${kwU.replace('%','\\%')}\\b`).test(combined)) return cat;
            } else {
                if (combined.includes(kwU)) return cat;
            }
        }
    }
    return 'Sinh hóa';
}
