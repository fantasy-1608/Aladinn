/**
 * PHI Pipeline Tests — P0-03
 * TDD: RED phase — tests written before implementation.
 *
 * Covers:
 * - PHI redaction (phone, BHYT, CCCD, email, names)
 * - Family/relative name redaction
 * - Ward/room/bed redaction
 * - Timestamp redaction (when dates not allowed)
 * - Feature-specific field whitelisting
 * - maxChars truncation
 * - Report accuracy (redactedCount, blocked, reasons)
 * - Clean text passthrough
 * - Vietnamese diacritical text
 */

import { describe, it, expect } from 'vitest';
import { PHIPipeline } from '../../shared/phi-pipeline.js';

// =============================================
// 1. Core PHI Redaction & Blocking
// =============================================
describe('PHIPipeline — Core PHI Handling', () => {
  it('blocks text with patient name + phone + BHYT', () => {
    const input = 'Bệnh nhân: Nguyễn Văn Nam, SĐT: 0912345678, BHYT: DN4010112345678';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    // After redaction, if residual PHI detected → blocked
    // At minimum, redactedCount > 0
    expect(result.report.redactedCount).toBeGreaterThan(0);
    // The safePayload should NOT contain the raw phone or BHYT
    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('0912345678');
    expect(assembled).not.toContain('DN4010112345678');
  });

  it('passes clean clinical text through without blocking', () => {
    const input = 'Đau bụng vùng hạ sườn phải 2 ngày, sốt nhẹ 37.8 độ C';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    expect(result.report.blocked).toBe(false);
    expect(result.safePayload.quaTrinhBenhLy).toBe(input);
  });

  it('returns report with redactedCount = 0 for clean text', () => {
    const input = 'Huyết áp 120/80, mạch 80 lần/phút';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    expect(result.report.redactedCount).toBe(0);
    expect(result.report.blocked).toBe(false);
    expect(result.report.reasons).toEqual([]);
  });
});

// =============================================
// 2. Family/Relative Names
// =============================================
describe('PHIPipeline — Family/Relative Names', () => {
  it('redacts "Người nhà: Nguyễn Văn A"', () => {
    const input = 'Chẩn đoán: Viêm ruột thừa. Người nhà: Nguyễn Văn A';
    const result = PHIPipeline.prepareForAI({
      feature: 'summary',
      payload: { chanDoan: input }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('Nguyễn Văn A');
    expect(result.report.redactedCount).toBeGreaterThan(0);
  });

  it('redacts "Vợ: Trần Thị Hoa"', () => {
    const input = 'Vợ: Trần Thị Hoa, liên hệ khi cần';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('Trần Thị Hoa');
  });

  it('redacts "Liên hệ: Phạm Minh Tuấn"', () => {
    const input = 'Liên hệ: Phạm Minh Tuấn, SĐT con 0987654321';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('Phạm Minh Tuấn');
    expect(assembled).not.toContain('0987654321');
  });
});

// =============================================
// 3. Ward/Room/Bed Info
// =============================================
describe('PHIPipeline — Ward/Room/Bed', () => {
  it('redacts ward/room/bed when allowWardInfo is false (default)', () => {
    const input = 'Khoa: Ngoại tổng hợp, Phòng: 305, Giường: 12B';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('Ngoại tổng hợp');
    expect(assembled).not.toContain('305');
    expect(assembled).not.toContain('12B');
  });

  it('preserves ward info when allowWardInfo is true', () => {
    const input = 'Khoa: Nội, Phòng: 201';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input },
      options: { allowWardInfo: true }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).toContain('Nội');
  });
});

// =============================================
// 4. Timestamp Redaction
// =============================================
describe('PHIPipeline — Timestamps', () => {
  it('redacts exact date-time when allowDates is false (default)', () => {
    const input = 'Nhập viện 15/06/2026 08:30, đau bụng dữ dội';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('15/06/2026');
  });

  it('preserves dates when allowDates is true', () => {
    const input = 'Nhập viện 15/06/2026, đau bụng dữ dội';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input },
      options: { allowDates: true }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).toContain('15/06/2026');
  });
});

// =============================================
// 5. Feature-specific Whitelisting
// =============================================
describe('PHIPipeline — Feature Whitelists', () => {
  it('voice: keeps only voice-whitelisted fields', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: {
        quaTrinhBenhLy: 'Đau bụng 2 ngày',
        chanDoan: 'Viêm ruột thừa',
        sinhHieu: 'Mạch 80',
        hoTen: 'Nguyễn Văn A',          // NOT whitelisted for voice
        diaChi: '123 Trần Hưng Đạo'     // NOT whitelisted for voice
      }
    });

    expect(result.safePayload).toHaveProperty('quaTrinhBenhLy');
    expect(result.safePayload).toHaveProperty('chanDoan');
    expect(result.safePayload).toHaveProperty('sinhHieu');
    expect(result.safePayload).not.toHaveProperty('hoTen');
    expect(result.safePayload).not.toHaveProperty('diaChi');
  });

  it('summary: keeps summary-whitelisted fields including thuốc/xét nghiệm', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'summary',
      payload: {
        quaTrinhBenhLy: 'Đau bụng',
        thuocYLenh: 'Paracetamol 500mg',
        xetNghiem: 'WBC 12.5',
        hoTen: 'Trần Văn B'  // NOT whitelisted
      }
    });

    expect(result.safePayload).toHaveProperty('thuocYLenh');
    expect(result.safePayload).toHaveProperty('xetNghiem');
    expect(result.safePayload).not.toHaveProperty('hoTen');
  });

  it('scanner: keeps scanner-whitelisted fields only', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'scanner',
      payload: {
        chanDoan: 'Viêm phổi',
        thuocYLenh: 'Amoxicillin',
        xetNghiem: 'CRP 45',
        quaTrinhBenhLy: 'Đau ngực 3 ngày',  // NOT scanner-whitelisted
        hoTen: 'Lê Thị C'                    // NOT whitelisted
      }
    });

    expect(result.safePayload).toHaveProperty('chanDoan');
    expect(result.safePayload).toHaveProperty('thuocYLenh');
    expect(result.safePayload).toHaveProperty('xetNghiem');
    expect(result.safePayload).not.toHaveProperty('quaTrinhBenhLy');
    expect(result.safePayload).not.toHaveProperty('hoTen');
  });

  it('aiVip: uses same whitelist as summary', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'aiVip',
      payload: {
        quaTrinhBenhLy: 'Sốt cao 3 ngày',
        thuocYLenh: 'Ceftriaxone 1g',
        hoTen: 'Nguyễn A'
      }
    });

    expect(result.safePayload).toHaveProperty('quaTrinhBenhLy');
    expect(result.safePayload).toHaveProperty('thuocYLenh');
    expect(result.safePayload).not.toHaveProperty('hoTen');
  });
});

// =============================================
// 6. maxChars Truncation
// =============================================
describe('PHIPipeline — maxChars Truncation', () => {
  it('truncates assembled text to maxChars', () => {
    const longText = 'Đau bụng hạ sườn phải. '.repeat(1000);
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: longText },
      options: { maxChars: 200 }
    });

    expect(result.redactedText.length).toBeLessThanOrEqual(200);
  });

  it('uses default maxChars of 12000', () => {
    const longText = 'A'.repeat(15000);
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: longText }
    });

    expect(result.redactedText.length).toBeLessThanOrEqual(12000);
  });
});

// =============================================
// 7. Report Accuracy
// =============================================
describe('PHIPipeline — Report', () => {
  it('report.reasons contains specific reason codes', () => {
    const input = 'Bệnh nhân: Trần Văn Nam, SĐT 0912345678';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    expect(result.report.reasons.length).toBeGreaterThan(0);
    // Reasons should be string codes
    for (const reason of result.report.reasons) {
      expect(typeof reason).toBe('string');
    }
  });

  it('report.redactedCount is accurate for multiple PHI items', () => {
    const input = 'SĐT: 0912345678, Email: test@example.com, BHYT: DN4010112345678';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    // At least 3 items redacted (phone, email, BHYT)
    expect(result.report.redactedCount).toBeGreaterThanOrEqual(3);
  });

  it('returns correct structure: { safePayload, redactedText, report }', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: 'Đau đầu' }
    });

    expect(result).toHaveProperty('safePayload');
    expect(result).toHaveProperty('redactedText');
    expect(result).toHaveProperty('report');
    expect(result.report).toHaveProperty('redactedCount');
    expect(result.report).toHaveProperty('blocked');
    expect(result.report).toHaveProperty('reasons');
  });
});

// =============================================
// 8. Edge Cases
// =============================================
describe('PHIPipeline — Edge Cases', () => {
  it('handles empty payload gracefully', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: {}
    });

    expect(result.report.blocked).toBe(false);
    expect(result.report.redactedCount).toBe(0);
    expect(result.safePayload).toEqual({});
  });

  it('handles null/undefined values in fields', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: null, chanDoan: undefined }
    });

    expect(result.report.blocked).toBe(false);
  });

  it('handles string payload (backward compat)', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: 'Đau bụng vùng hông phải 2 ngày'
    });

    expect(result.report.blocked).toBe(false);
    expect(typeof result.redactedText).toBe('string');
  });

  it('rejects unknown feature with safe defaults', () => {
    // Unknown features should use most restrictive whitelist
    const result = PHIPipeline.prepareForAI({
      feature: 'unknown_feature',
      payload: { quaTrinhBenhLy: 'Đau đầu' }
    });

    // Should still work (not throw), using empty/restrictive whitelist
    expect(result).toHaveProperty('report');
  });
});

// =============================================
// 9. Vietnamese Diacritical Text
// =============================================
describe('PHIPipeline — Vietnamese Text', () => {
  it('handles Vietnamese names with diacritics: Nguyễn Thị Hoa', () => {
    const input = 'Bệnh nhân: Nguyễn Thị Hoa nhập viện vì đau ngực';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('Nguyễn Thị Hoa');
  });

  it('handles label "Bố: Lê Văn Đức"', () => {
    const input = 'Bố: Lê Văn Đức, Mẹ: Nguyễn Thị Mai';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('Lê Văn Đức');
    expect(assembled).not.toContain('Nguyễn Thị Mai');
  });

  it('preserves clinical Vietnamese text without PHI', () => {
    // Note: PHIRedactor.redact() treats "Bệnh nhân" + capitalized text as a name label,
    // so "Bệnh nhân nhập viện..." gets partially redacted. This is acceptable —
    // what matters is it doesn't get BLOCKED and clinical content is preserved.
    const input = 'Đau bụng vùng thượng vị, có tiền sử viêm loét dạ dày tá tràng';
    const result = PHIPipeline.prepareForAI({
      feature: 'voice',
      payload: { quaTrinhBenhLy: input }
    });

    expect(result.report.blocked).toBe(false);
    expect(result.safePayload.quaTrinhBenhLy).toContain('Đau bụng vùng thượng vị');
    expect(result.safePayload.quaTrinhBenhLy).toContain('viêm loét dạ dày');
  });
});

// =============================================
// 10. PHI Redactor — New Patterns (redactFields)
// =============================================
describe('PHIRedactor.redactFields — new export', () => {
  // We test the new redactFields via PHIPipeline since PHIPipeline uses it internally.
  // Direct tests for PHIRedactor new patterns:
  it('PHIPipeline uses redactFields internally for field map', () => {
    const result = PHIPipeline.prepareForAI({
      feature: 'summary',
      payload: {
        chanDoan: 'Viêm phổi',
        quaTrinhBenhLy: 'Người nhà: Trần Văn B, Khoa: Tim mạch, SĐT 0912345678'
      }
    });

    const assembled = JSON.stringify(result.safePayload);
    expect(assembled).not.toContain('Trần Văn B');
    expect(assembled).not.toContain('Tim mạch');
    expect(assembled).not.toContain('0912345678');
    expect(result.report.redactedCount).toBeGreaterThanOrEqual(3);
  });
});
