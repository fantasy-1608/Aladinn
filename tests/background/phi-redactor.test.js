import { describe, it, expect } from 'vitest';
import { PHIRedactor } from '../../background/phi-redactor.js';

describe('PHIRedactor', () => {
    it('should redact phone numbers', () => {
        const text = 'SĐT của tôi là 0912345678 và +84987654321.';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[PHONE]');
        expect(redacted).not.toContain('0912345678');
        expect(redacted).not.toContain('+84987654321');
    });

    it('should redact CCCD/CMND', () => {
        const text = 'Số CCCD là 079090123456 và CMND 123456789.';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[ID_CARD]');
        expect(redacted).not.toContain('079090123456');
        expect(redacted).not.toContain('123456789');
    });

    it('should redact BHYT cards', () => {
        const text = 'Bệnh nhân có BHYT mã HC4010112345678.';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[BHYT]');
        expect(redacted).not.toContain('HC4010112345678');
    });

    it('should redact VNPT HIS Patient IDs', () => {
        const text = 'Mã bệnh nhân: 2400123456, Số hồ sơ: BN2400123456.';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[PATIENT_ID]');
        expect(redacted).not.toContain('2400123456');
    });

    it('should redact emails', () => {
        const text = 'Liên hệ qa email: test.phi@hospital.vn hoặc a@b.com';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[EMAIL]');
        expect(redacted).not.toContain('test.phi@hospital.vn');
        expect(redacted).not.toContain('a@b.com');
    });

    it('should redact standard explicit names', () => {
        const text = 'Họ và tên: Nguyễn Văn A. Sinh năm 1990.';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[NAME]');
        expect(redacted).not.toContain('Nguyễn Văn A');
    });

    it('should redact addresses with phuong/xa', () => {
        const text = 'Bệnh nhân ngụ tại Địa chỉ: Phường 1, Quận 2, TPHCM; Có tiền sử bệnh.';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[ADDRESS]');
        expect(redacted).not.toContain('Phường 1');
        expect(redacted).not.toContain('Quận 2');
        expect(redacted).not.toContain('TPHCM');
    });

    it('should redact date of birth', () => {
        const text = 'Ngày sinh: 15/05/1990 và Sinh năm: 1985.';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[DOB]');
        expect(redacted).not.toContain('15/05/1990');
        expect(redacted).not.toContain('1985');
    });

    it('should redact inline occurrences and all caps names', () => {
        const text = 'Hôm nay Bệnh nhân NGUYỄN VĂN B đến khám, có số điện thoại 0912345678 liền mạch.';
        const redacted = PHIRedactor.redact(text);
        expect(redacted).toContain('[NAME]');
        expect(redacted).toContain('[PHONE]');
        expect(redacted).not.toContain('NGUYỄN VĂN B');
        expect(redacted).not.toContain('0912345678');
    });

    it('should detect remaining PHI', () => {
        expect(PHIRedactor.containsPHI('0912345678')).toBe(true);
        expect(PHIRedactor.containsPHI('test@hospital.vn')).toBe(true);
        expect(PHIRedactor.containsPHI('HC4010112345678')).toBe(true);
        expect(PHIRedactor.containsPHI('079090123456')).toBe(true);
        
        expect(PHIRedactor.containsPHI('Bệnh nhân nhập viện vì đau bụng')).toBe(false);
    });
});
