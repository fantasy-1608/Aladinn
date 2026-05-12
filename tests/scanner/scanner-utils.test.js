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
    it('has 3 categories', () => {
        expect(Object.keys(LAB_CATEGORIES)).toHaveLength(3);
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
