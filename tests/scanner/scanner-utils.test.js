import { describe, it, expect } from 'vitest';
import {
    escapeHtml,
    getAiErrorMessage,
    parseBhytDate,
    analyzeBhytTimeErrors,
    parseLabDate,
    shortDate,
    isAbnormal,
    statusColor,
    classifyLab,
    normalizeAdmissionExamFields,
    LAB_CATEGORIES,
} from '../../content/scanner/scanner-utils.js';

// ═══════════════════════════════════════════════════════════════
// SECTION 1: escapeHtml
// ═══════════════════════════════════════════════════════════════
describe('escapeHtml', () => {
    it('escapes all dangerous HTML characters', () => {
        expect(escapeHtml('<script>alert("XSS")</script>')).toBe(
            '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
        );
    });

    it('escapes ampersands and single quotes', () => {
        expect(escapeHtml("Tom & Jerry's")).toBe('Tom &amp; Jerry&#39;s');
    });

    it('handles null/undefined gracefully', () => {
        expect(escapeHtml(null)).toBe('');
        expect(escapeHtml(undefined)).toBe('');
    });

    it('converts numbers to strings', () => {
        expect(escapeHtml(42)).toBe('42');
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 2: getAiErrorMessage
// ═══════════════════════════════════════════════════════════════
describe('getAiErrorMessage', () => {
    it('returns Vietnamese message for AI_LOCKED', () => {
        expect(getAiErrorMessage({ code: 'AI_LOCKED' })).toContain('PIN');
    });

    it('returns Vietnamese message for AI_QUOTA_LIMIT', () => {
        expect(getAiErrorMessage({ code: 'AI_QUOTA_LIMIT' })).toContain('quota');
    });

    it('returns Vietnamese message for AI_NETWORK_ERROR', () => {
        expect(getAiErrorMessage({ code: 'AI_NETWORK_ERROR' })).toContain('mạng');
    });

    it('falls back to error.message for unknown codes', () => {
        expect(getAiErrorMessage({ code: 'UNKNOWN', message: 'Custom error' })).toBe('Custom error');
    });

    it('returns default message for null/undefined error', () => {
        expect(getAiErrorMessage(null)).toBe('Lỗi AI không xác định.');
        expect(getAiErrorMessage(undefined)).toBe('Lỗi AI không xác định.');
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 3: parseBhytDate & analyzeBhytTimeErrors
// ═══════════════════════════════════════════════════════════════
describe('parseBhytDate', () => {
    it('parses VN-formatted date correctly', () => {
        const d = parseBhytDate('15/05/2026 08:30:00');
        expect(d).toBeInstanceOf(Date);
        expect(d.getDate()).toBe(15);
        expect(d.getMonth()).toBe(4); // May = 4
        expect(d.getFullYear()).toBe(2026);
        expect(d.getHours()).toBe(8);
        expect(d.getMinutes()).toBe(30);
    });

    it('returns null for empty/null input', () => {
        expect(parseBhytDate(null)).toBeNull();
        expect(parseBhytDate('')).toBeNull();
    });

    it('returns null for malformed date with too few parts', () => {
        expect(parseBhytDate('15/05')).toBeNull();
    });
});

describe('analyzeBhytTimeErrors', () => {
    it('detects execution-after-result error (TH > KQ)', () => {
        const sheets = [{
            id: 1, tenDV: 'Glucose',
            tgChiDinh: '15/05/2026 07:00:00',
            tgThucHien: '15/05/2026 10:00:00', // TH later
            tgKetQua: '15/05/2026 08:00:00',   // KQ earlier
        }];
        const errors = analyzeBhytTimeErrors(sheets);
        expect(errors.length).toBeGreaterThanOrEqual(1);
        expect(errors.some(e => e.loaiLoi === 'TH_GT_KQ')).toBe(true);
    });

    it('detects order-after-result error (CD > KQ)', () => {
        const sheets = [{
            id: 2, tenDV: 'HbA1c',
            tgChiDinh: '15/05/2026 12:00:00', // CD later
            tgThucHien: '15/05/2026 08:00:00',
            tgKetQua: '15/05/2026 09:00:00',   // KQ earlier than CD
        }];
        const errors = analyzeBhytTimeErrors(sheets);
        expect(errors.some(e => e.loaiLoi === 'CD_GT_KQ')).toBe(true);
    });

    it('returns no errors for valid time sequence', () => {
        const sheets = [{
            id: 3, tenDV: 'WBC',
            tgChiDinh: '15/05/2026 07:00:00',
            tgThucHien: '15/05/2026 08:00:00',
            tgKetQua: '15/05/2026 09:00:00',
        }];
        const errors = analyzeBhytTimeErrors(sheets);
        expect(errors).toEqual([]);
    });

    it('handles sheets with missing time fields gracefully', () => {
        const sheets = [{ id: 4, tenDV: 'CRP', tgChiDinh: null, tgThucHien: null, tgKetQua: null }];
        const errors = analyzeBhytTimeErrors(sheets);
        expect(errors).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 4: Lab Helpers
// ═══════════════════════════════════════════════════════════════
describe('parseLabDate', () => {
    it('parses VN date string to timestamp', () => {
        const ts = parseLabDate('15/05/2026 08:30:00');
        expect(ts).toBeGreaterThan(0);
    });

    it('returns 0 for empty/null', () => {
        expect(parseLabDate(null)).toBe(0);
        expect(parseLabDate('')).toBe(0);
    });
});

describe('shortDate', () => {
    it('extracts date-only part from datetime', () => {
        expect(shortDate('15/05/2026 08:30:00')).toBe('15/05/2026');
    });

    it('returns original string if no space', () => {
        expect(shortDate('15/05/2026')).toBe('15/05/2026');
    });
});

describe('isAbnormal', () => {
    it('detects high values in Vietnamese', () => {
        expect(isAbnormal('Cao')).toBe(true);
        expect(isAbnormal('tăng')).toBe(true);
    });

    it('detects low values in Vietnamese', () => {
        expect(isAbnormal('Thấp')).toBe(true);
        expect(isAbnormal('giảm')).toBe(true);
    });

    it('detects English abnormal markers', () => {
        expect(isAbnormal('High')).toBe(true);
        expect(isAbnormal('Low')).toBe(true);
    });

    it('returns false for normal/empty status', () => {
        expect(isAbnormal('Bình thường')).toBe(false);
        expect(isAbnormal(null)).toBe(false);
        expect(isAbnormal('')).toBe(false);
    });
});

describe('statusColor', () => {
    it('returns red for high values', () => {
        const c = statusColor('Cao');
        expect(c).not.toBeNull();
        expect(c.icon).toBe('▲');
        expect(c.text).toBe('#f87171');
    });

    it('returns blue for low values', () => {
        const c = statusColor('Thấp');
        expect(c).not.toBeNull();
        expect(c.icon).toBe('▼');
        expect(c.text).toBe('#60a5fa');
    });

    it('returns null for normal status', () => {
        expect(statusColor('Normal')).toBeNull();
        expect(statusColor(null)).toBeNull();
    });
});

describe('normalizeAdmissionExamFields', () => {
    it('uses clinical summary when legacy history object is empty', () => {
        const rows = normalizeAdmissionExamFields({}, {
            lyDoVaoVien: 'Đau bụng vùng thượng vị',
            quaTrinhBenhLy: 'Đau tăng sau ăn',
            tienSuBanThan: 'Tăng huyết áp',
            khamToanThan: 'Tỉnh, tiếp xúc tốt',
            khamBoPhan: 'Bụng mềm',
            chanDoanBanDau: 'K29 - Viêm dạ dày',
            tomTatCLS: 'Bạch cầu tăng nhẹ'
        });

        expect(rows.map(row => row.label)).toEqual([
            'Lý do vào viện',
            'Bệnh sử',
            'Tiền sử bản thân',
            'Khám toàn thân',
            'Khám bộ phận',
            'Chẩn đoán ban đầu',
            'Tóm tắt CLS'
        ]);
        expect(rows.find(row => row.key === 'KHAMBENH_TOANTHAN')?.value).toBe('Tỉnh, tiếp xúc tốt');
    });

    it('keeps legacy history values before clinical summary fallback values', () => {
        const rows = normalizeAdmissionExamFields(
            { LYDOVAOVIEN: 'Sốt cao', KHAMBENH_TOANTHAN: 'Mệt nhiều' },
            { lyDoVaoVien: 'Đau đầu', khamToanThan: 'Tỉnh' }
        );

        expect(rows.find(row => row.key === 'LYDOVAOVIEN')?.value).toBe('Sốt cao');
        expect(rows.find(row => row.key === 'KHAMBENH_TOANTHAN')?.value).toBe('Mệt nhiều');
    });

    it('omits empty fields so the tab can show an empty state only when truly empty', () => {
        expect(normalizeAdmissionExamFields({}, {})).toEqual([]);
        expect(normalizeAdmissionExamFields({ LYDOVAOVIEN: '   ' }, { khamBoPhan: '' })).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 5: classifyLab — Clinical Category Classification
// ═══════════════════════════════════════════════════════════════
describe('classifyLab', () => {
    it('classifies WBC as Huyết học', () => {
        expect(classifyLab('WBC', 'White Blood Cell', '8.5')).toBe('Huyết học');
    });

    it('classifies PLT as Huyết học', () => {
        expect(classifyLab('PLT', 'Tiểu cầu', '250')).toBe('Huyết học');
    });

    it('classifies Glucose (blood) as Sinh hóa', () => {
        expect(classifyLab('Glucose', 'Glucose máu', '5.6')).toBe('Sinh hóa');
    });

    it('classifies Creatinin as Sinh hóa', () => {
        expect(classifyLab('Creatinin', 'Creatinin huyết thanh', '80')).toBe('Sinh hóa');
    });

    it('classifies SG (explicit urine code) as Nước tiểu', () => {
        expect(classifyLab('SG', 'Tỷ trọng', '1.020')).toBe('Nước tiểu');
    });

    it('classifies LEU as Nước tiểu', () => {
        expect(classifyLab('LEU', 'Bạch cầu niệu', 'Negative')).toBe('Nước tiểu');
    });

    // Ambiguous code disambiguation
    it('classifies GLU with "nước tiểu" context as Nước tiểu', () => {
        expect(classifyLab('GLU', 'Glucose nước tiểu', 'Âm tính')).toBe('Nước tiểu');
    });

    it('classifies GLU with "máu" context as Sinh hóa', () => {
        expect(classifyLab('GLU', 'Glucose máu', '5.8')).toBe('Sinh hóa');
    });

    it('classifies PRO with qualitative value as Nước tiểu', () => {
        expect(classifyLab('PRO', 'PRO', 'TRACE')).toBe('Nước tiểu');
    });

    it('classifies PRO with numeric value and huyết context as Sinh hóa', () => {
        expect(classifyLab('PRO', 'Protein huyết thanh', '68')).toBe('Sinh hóa');
    });

    it('classifies unknown test as Sinh hóa (fallback)', () => {
        expect(classifyLab('XYZ_UNKNOWN', 'Test không rõ', '123')).toBe('Sinh hóa');
    });

    it('classifies by Vietnamese keyword: huyết đồ', () => {
        expect(classifyLab('CBC', 'Huyết đồ', '')).toBe('Huyết học');
    });

    it('classifies by Vietnamese keyword: điện giải', () => {
        expect(classifyLab('Na', 'Điện giải đồ Na', '140')).toBe('Sinh hóa');
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION 6: LAB_CATEGORIES constant integrity
// ═══════════════════════════════════════════════════════════════
describe('LAB_CATEGORIES', () => {
    it('has 4 categories', () => {
        expect(Object.keys(LAB_CATEGORIES)).toHaveLength(4);
    });

    it('Huyết học has WBC, PLT, and coagulation markers', () => {
        const hh = LAB_CATEGORIES['Huyết học'];
        expect(hh).toContain('WBC');
        expect(hh).toContain('PLT');
        expect(hh).toContain('PT');
        expect(hh).toContain('D-Dimer');
    });

    it('Sinh hóa has common biochemistry markers', () => {
        const sh = LAB_CATEGORIES['Sinh hóa'];
        expect(sh).toContain('Glucose');
        expect(sh).toContain('Creatinin');
        expect(sh).toContain('AST');
        expect(sh).toContain('CRP');
    });

    it('Nước tiểu has urinalysis markers', () => {
        const nt = LAB_CATEGORIES['Nước tiểu'];
        expect(nt).toContain('SG');
        expect(nt).toContain('pH');
        expect(nt).toContain('Nitrit');
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION: classifyLab — Khí máu classification
// ═══════════════════════════════════════════════════════════════
describe('classifyLab — Khí máu', () => {
    // ── Core ABG parameters ──
    it('pCO2 → Khí máu', () => {
        expect(classifyLab('pCO2', 'pCO2', '42')).toBe('Khí máu');
    });

    it('pO2 → Khí máu', () => {
        expect(classifyLab('pO2', 'pO2', '95')).toBe('Khí máu');
    });

    it('HCO3act → Khí máu', () => {
        expect(classifyLab('HCO3act', 'HCO3 actual', '24')).toBe('Khí máu');
    });

    it('HCO3std → Khí máu', () => {
        expect(classifyLab('HCO3std', 'HCO3 standard', '23')).toBe('Khí máu');
    });

    it('BE(ecf) → Khí máu', () => {
        expect(classifyLab('BE(ecf)', 'BE(ecf)', '-1.5')).toBe('Khí máu');
    });

    it('FIO2 → Khí máu', () => {
        expect(classifyLab('FIO2', 'FIO2', '21')).toBe('Khí máu');
    });

    it('O2SAT → Khí máu', () => {
        expect(classifyLab('O2SAT', 'O2SAT', '98')).toBe('Khí máu');
    });

    // ── Lactate (newly added) ──
    it('Lac → Khí máu', () => {
        expect(classifyLab('Lac', 'Lactate', '1.5')).toBe('Khí máu');
    });

    it('Lactate → Khí máu', () => {
        expect(classifyLab('Lactate', 'Lactate máu', '3.2')).toBe('Khí máu');
    });

    it('Lactic Acid → Khí máu', () => {
        expect(classifyLab('Lactic Acid', 'Lactic Acid', '2.1')).toBe('Khí máu');
    });

    // ── P/F ratio aliases ──
    it('pO2/FIO2 → Khí máu', () => {
        expect(classifyLab('pO2/FIO2', 'pO2/FIO2', '350')).toBe('Khí máu');
    });

    it('P/F → Khí máu', () => {
        expect(classifyLab('P/F', 'P/F ratio', '420')).toBe('Khí máu');
    });

    // ── pH disambiguation ──
    it('pH với testName chứa "khí máu" → Khí máu', () => {
        expect(classifyLab('pH', 'pH khí máu', '7.42')).toBe('Khí máu');
    });

    it('pH với testName chứa "nước tiểu" → Nước tiểu', () => {
        expect(classifyLab('pH', 'pH nước tiểu', '6.5')).toBe('Nước tiểu');
    });

    it('pH với testName chứa "niệu" → Nước tiểu', () => {
        expect(classifyLab('pH', 'pH niệu', '7.0')).toBe('Nước tiểu');
    });

    it('pH giá trị 7.42 (≥2 decimal) → Khí máu (heuristic)', () => {
        expect(classifyLab('pH', 'pH', '7.42')).toBe('Khí máu');
    });

    it('pH giá trị 7.539 (3 decimal) → Khí máu (heuristic)', () => {
        expect(classifyLab('pH', 'pH', '7.539')).toBe('Khí máu');
    });

    it('pH giá trị 6.0 (1 decimal) → Nước tiểu (default)', () => {
        expect(classifyLab('pH', 'pH', '6.0')).toBe('Nước tiểu');
    });

    it('pH giá trị 7.5 (1 decimal) → Nước tiểu (default)', () => {
        expect(classifyLab('pH', 'pH', '7.5')).toBe('Nước tiểu');
    });

    it('pH với testName chứa "BLOOD" → Khí máu', () => {
        expect(classifyLab('pH', 'Blood Gas pH', '7.35')).toBe('Khí máu');
    });

    it('pH không có context rõ ràng, no decimal → Nước tiểu (default)', () => {
        expect(classifyLab('pH', 'pH', '')).toBe('Nước tiểu');
    });

    // ── Vietnamese keyword matching ──
    it('testName chứa "Khí máu" → Khí máu', () => {
        expect(classifyLab('XYZ', 'Xét nghiệm Khí máu', '7.4')).toBe('Khí máu');
    });

    it('testName chứa "KHI MAU" (no diacritics) → Khí máu', () => {
        expect(classifyLab('XYZ', 'Xet nghiem KHI MAU', '42')).toBe('Khí máu');
    });
});

// ═══════════════════════════════════════════════════════════════
// SECTION: classifyLab — Edge cases & regressions
// ═══════════════════════════════════════════════════════════════
describe('classifyLab — Edge cases', () => {
    it('Empty code and testName → Sinh hóa (default)', () => {
        expect(classifyLab('', '', '')).toBe('Sinh hóa');
    });

    it('null/undefined inputs → Sinh hóa (default)', () => {
        expect(classifyLab(null, undefined, null)).toBe('Sinh hóa');
    });

    it('Na → Sinh hóa (not Khí máu)', () => {
        expect(classifyLab('Na', 'Natri máu', '140')).toBe('Sinh hóa');
    });

    it('Cl → Sinh hóa (not Khí máu)', () => {
        expect(classifyLab('Cl', 'Chloride', '100')).toBe('Sinh hóa');
    });

    it('WBC → Huyết học', () => {
        expect(classifyLab('WBC', 'WBC', '10.5')).toBe('Huyết học');
    });

    it('SG → Nước tiểu', () => {
        expect(classifyLab('SG', 'SG', '1.025')).toBe('Nước tiểu');
    });

    it('GLU with urinary context → Nước tiểu', () => {
        expect(classifyLab('GLU', 'Glucose nước tiểu', 'ÂM TÍNH')).toBe('Nước tiểu');
    });

    it('GLU with blood context → Sinh hóa', () => {
        expect(classifyLab('GLU', 'Glucose máu', '5.6')).toBe('Sinh hóa');
    });
});
