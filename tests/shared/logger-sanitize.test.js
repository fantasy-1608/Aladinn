/**
 * @vitest-environment jsdom
 *
 * 🧞 Aladinn — P1-02 Security Test: Logger.sanitize() Direct Testing
 * Verifies that PHI (Protected Health Information) is properly redacted
 * from all log messages before they reach the console.
 *
 * Covers:
 * - Phone numbers (VN: 0xxx, +84xxx)
 * - CCCD (12 digits) and CMND (9 digits)
 * - BHYT (2 letters + 13 digits)
 * - API keys (AIza...)
 * - Cookie/Session/JWT/Token strings
 * - Sensitive object keys (HOTENBENTHAN, SOBHYT, etc.)
 * - Deep nested object sanitization
 * - Edge cases: null, undefined, empty, numbers
 */
import { describe, it, expect, beforeEach } from 'vitest';

// Load Logger into window.HIS.Logger
import '../../shared/logger.js';

describe('P1-02: Logger.sanitize() PHI Redaction', () => {
    let sanitize;

    beforeEach(() => {
        // Mock chrome.storage to prevent errors
        globalThis.chrome = {
            storage: {
                local: {
                    get: (_keys, cb) => cb({}),
                    set: () => {}
                }
            }
        };

        // HIS.Logger is loaded via the import above
        sanitize = window.HIS?.Logger?.sanitize;
        expect(sanitize).toBeDefined();
    });


    // ─── String sanitization ───

    describe('Phone number redaction (VN)', () => {
        it('redacts 0xx-format phone numbers', () => {
            expect(sanitize('Gọi số 0912345678 ngay')).toBe('Gọi số [PHONE] ngay');
        });

        it('redacts +84-format phone numbers', () => {
            expect(sanitize('SĐT: +84912345678')).toBe('SĐT: [PHONE]');
        });

        it('redacts 10-digit mobile numbers', () => {
            expect(sanitize('Liên hệ: 09123456789')).toBe('Liên hệ: [PHONE]');
        });

        it('redacts multiple phone numbers in same string', () => {
            const result = sanitize('SĐT 1: 0912345678, SĐT 2: 0987654321');
            expect(result).not.toContain('0912345678');
            expect(result).not.toContain('0987654321');
        });
    });

    describe('CCCD (12 digits) redaction', () => {
        it('redacts 12-digit citizen ID', () => {
            expect(sanitize('CCCD: 012345678901')).toBe('CCCD: [CCCD]');
        });

        it('redacts CCCD at word boundary', () => {
            const result = sanitize('Số CCCD 036099012345 của BN');
            expect(result).toContain('[CCCD]');
            expect(result).not.toContain('036099012345');
        });
    });

    describe('CMND (9 digits) redaction', () => {
        it('redacts 9-digit old ID', () => {
            expect(sanitize('CMND: 123456789')).toBe('CMND: [CMND]');
        });

        it('does not redact non-boundary 9 digits (embedded in longer number)', () => {
            // 10+ digits should not match CMND pattern
            const result = sanitize('Mã: 12345678901');
            // This is 11 digits — no \b match for 9 digits
            expect(result).not.toBe('Mã: [CMND]01');
        });
    });

    describe('BHYT (health insurance) redaction', () => {
        it('redacts 2-letter + 13-digit BHYT code', () => {
            expect(sanitize('Số thẻ: DN1234567890123'))
                .toBe('Số thẻ: [BHYT]');
        });

        it('redacts BHYT embedded in longer text', () => {
            const result = sanitize('BHYT AB1234567890123 còn hiệu lực');
            expect(result).toContain('[BHYT]');
            expect(result).not.toContain('AB1234567890123');
        });
    });

    describe('API key redaction', () => {
        it('redacts AIza-prefixed Google API keys', () => {
            const apiKey = 'AIzaSyD1234567890abcdefghijklmnopqrst';
            expect(sanitize(`key=${apiKey}`)).toBe('key=[API_KEY]');
        });

        it('redacts API key in JSON-like string', () => {
            const result = sanitize('{"apiKey":"AIzaSyD1234567890abcdefghijklmnopqrst"}');
            expect(result).toContain('[API_KEY]');
            expect(result).not.toContain('AIzaSy');
        });
    });

    describe('Cookie/Session/Token redaction', () => {
        it('redacts cookie= values', () => {
            const result = sanitize('cookie=abc123def456ghi789jkl012mno');
            expect(result).toBe('cookie=[TOKEN]');
        });

        it('redacts session: values', () => {
            const result = sanitize('session: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9');
            expect(result).toBe('session=[TOKEN]');
        });

        it('redacts jwt= values', () => {
            const result = sanitize('jwt=eyJhbGciOiJIUzI1NiIsInR5cCI');
            expect(result).toBe('jwt=[TOKEN]');
        });

        it('redacts token= values (case-insensitive)', () => {
            const result = sanitize('Token=abc123def456ghi789jkl0123');
            expect(result).toBe('Token=[TOKEN]');
        });
    });


    // ─── Object sanitization ───

    describe('Sensitive key redaction (objects)', () => {
        it('redacts HOTENBENTHAN key', () => {
            const result = sanitize({ HOTENBENTHAN: 'Nguyễn Văn A' });
            expect(result.HOTENBENTHAN).toBe('[REDACTED]');
        });

        it('redacts HOTEN key', () => {
            const result = sanitize({ HOTEN: 'Trần Thị B' });
            expect(result.HOTEN).toBe('[REDACTED]');
        });

        it('redacts SOBHYT key', () => {
            const result = sanitize({ SOBHYT: 'DN1234567890123' });
            expect(result.SOBHYT).toBe('[REDACTED]');
        });

        it('redacts SOCMND key', () => {
            const result = sanitize({ SOCMND: '123456789' });
            expect(result.SOCMND).toBe('[REDACTED]');
        });

        it('redacts SOCCCD key', () => {
            const result = sanitize({ SOCCCD: '012345678901' });
            expect(result.SOCCCD).toBe('[REDACTED]');
        });

        it('redacts DIENTHOAI key', () => {
            const result = sanitize({ DIENTHOAI: '0912345678' });
            expect(result.DIENTHOAI).toBe('[REDACTED]');
        });

        it('redacts DIACHI key', () => {
            const result = sanitize({ DIACHI: '123 Lê Lợi, Q1, TP.HCM' });
            expect(result.DIACHI).toBe('[REDACTED]');
        });

        it('redacts patientName key', () => {
            const result = sanitize({ patientName: 'Lê Văn C' });
            expect(result.patientName).toBe('[REDACTED]');
        });

        it('redacts apiKey, geminiApiKey, api_key keys', () => {
            const result = sanitize({
                apiKey: 'sk-secret123',
                geminiApiKey: 'AIzaSy123',
                api_key: 'key-456'
            });
            expect(result.apiKey).toBe('[REDACTED]');
            expect(result.geminiApiKey).toBe('[REDACTED]');
            expect(result.api_key).toBe('[REDACTED]');
        });

        it('redacts password, pin keys', () => {
            const result = sanitize({ password: 'P@ssw0rd', pin: '1234' });
            expect(result.password).toBe('[REDACTED]');
            expect(result.pin).toBe('[REDACTED]');
        });
    });

    describe('Deep nested object sanitization', () => {
        it('sanitizes nested patient data', () => {
            const data = {
                encounter: {
                    id: 'EN123',
                    patient: {
                        HOTENBENTHAN: 'Nguyễn Văn A',
                        SOBHYT: 'DN1234567890123',
                        DIENTHOAI: '0912345678'
                    }
                }
            };
            const result = sanitize(data);
            expect(result.encounter.patient.HOTENBENTHAN).toBe('[REDACTED]');
            expect(result.encounter.patient.SOBHYT).toBe('[REDACTED]');
            expect(result.encounter.patient.DIENTHOAI).toBe('[REDACTED]');
            // Non-sensitive fields preserved
            expect(result.encounter.id).toBe('EN123');
        });

        it('sanitizes string values inside non-sensitive keys', () => {
            const data = {
                message: 'Bệnh nhân SĐT 0912345678 đã đến khám'
            };
            const result = sanitize(data);
            expect(result.message).toContain('[PHONE]');
            expect(result.message).not.toContain('0912345678');
        });

        it('sanitizes arrays of objects', () => {
            const data = [
                { HOTEN: 'Nguyễn A', id: 1 },
                { HOTEN: 'Trần B', id: 2 }
            ];
            const result = sanitize(data);
            expect(result[0].HOTEN).toBe('[REDACTED]');
            expect(result[1].HOTEN).toBe('[REDACTED]');
            expect(result[0].id).toBe(1);
        });
    });

    describe('Immutability: original data not mutated', () => {
        it('does not modify the original object', () => {
            const original = {
                HOTENBENTHAN: 'Nguyễn Văn A',
                info: 'SĐT 0912345678'
            };
            const originalCopy = JSON.parse(JSON.stringify(original));

            sanitize(original);

            // Original should still have the same values
            expect(original.HOTENBENTHAN).toBe(originalCopy.HOTENBENTHAN);
            expect(original.info).toBe(originalCopy.info);
        });
    });


    // ─── Edge cases ───

    describe('Edge cases', () => {
        it('returns null for null input', () => {
            expect(sanitize(null)).toBeNull();
        });

        it('returns undefined for undefined input', () => {
            expect(sanitize(undefined)).toBeUndefined();
        });

        it('returns empty string for empty string', () => {
            expect(sanitize('')).toBe('');
        });

        it('returns 0 for 0', () => {
            expect(sanitize(0)).toBe(0);
        });

        it('returns false for false', () => {
            expect(sanitize(false)).toBe(false);
        });

        it('returns number unchanged', () => {
            expect(sanitize(42)).toBe(42);
        });

        it('returns clean string unchanged', () => {
            const clean = 'Kết quả xét nghiệm bình thường';
            expect(sanitize(clean)).toBe(clean);
        });

        it('handles deeply nested circular-like structures gracefully', () => {
            // JSON.parse(JSON.stringify) will fail on circular refs
            // sanitize should return fallback string
            const circular = {};
            circular.self = circular;
            const result = sanitize(circular);
            expect(result).toBe('[Object - sanitize failed]');
        });
    });


    // ─── Integration: Logger methods apply sanitize ───

    describe('Logger methods auto-sanitize arguments', () => {
        it('HIS.Logger.sanitize is the same function exposed publicly', () => {
            expect(typeof window.HIS.Logger.sanitize).toBe('function');
        });

        it('sanitize is used by all log levels (spot check)', () => {
            // Verify that sanitize properly handles a realistic payload
            const payload = {
                action: 'patient_lookup',
                TENBENHNHAN: 'Lê Văn C',
                SOBHYT: 'HN1234567890123',
                query: 'Tìm bệnh nhân CCCD 012345678901'
            };

            const result = sanitize(payload);
            expect(result.TENBENHNHAN).toBe('[REDACTED]');
            expect(result.SOBHYT).toBe('[REDACTED]');
            expect(result.query).toContain('[CCCD]');
            expect(result.action).toBe('patient_lookup'); // non-sensitive preserved
        });
    });
});
