import { describe, it, expect } from 'vitest';
import { SchemaValidator } from '../../background/schema-validator.js';

describe('SchemaValidator', () => {
    it('should validate a valid AI payload', () => {
        const payload = {
            lyDoVaoVien: "Đau bụng",
            quaTrinhBenhLy: "Bệnh nhân đau bụng vùng hố chậu phải.",
            sinhHieu: {
                mach: "80",
                nhietDo: "37"
            },
            icd10Suggest: [
                { code: "K35.8", name: "Viêm ruột thừa" }
            ]
        };
        const result = SchemaValidator.validateVoiceClinical(payload);
        expect(result.isValid).toBe(true);
        expect(result.data).toBe(payload);
    });

    it('should reject non-object payloads', () => {
        const result = SchemaValidator.validateVoiceClinical("just string");
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('không phải là JSON object');
    });

    it('should reject invalid string fields', () => {
        const payload = { lyDoVaoVien: 123 }; // Should be string
        const result = SchemaValidator.validateVoiceClinical(payload);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('phải là chuỗi (string)');
    });

    it('should reject invalid sinhHieu object', () => {
        const payload = { sinhHieu: "120/80" }; // Should be object
        const result = SchemaValidator.validateVoiceClinical(payload);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('phải là object');
    });

    it('should reject invalid icd10Suggest array', () => {
        const payload = { icd10Suggest: { code: "K35" } }; // Should be array
        const result = SchemaValidator.validateVoiceClinical(payload);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('phải là một mảng');
    });

    it('should reject invalid icd10Suggest items', () => {
        const payload = { icd10Suggest: [{ name: "Missing code" }] }; // Missing 'code'
        const result = SchemaValidator.validateVoiceClinical(payload);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('phải có code và name');
    });

    it('should reject payload with fields outside whitelist', () => {
        const payload = { lyDoVaoVien: "Đau", hackField: "malicious" };
        const result = SchemaValidator.validateVoiceClinical(payload);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('không nằm trong whitelist');
    });

    it('should reject payload containing prompt injection scripts', () => {
        const payload = { lyDoVaoVien: "Đau <script>alert(1)</script>" };
        const result = SchemaValidator.validateVoiceClinical(payload);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('Prompt injection');
    });

    it('should reject markdown instead of JSON', () => {
        // usually parse will fail, but if somehow passed as string
        const result = SchemaValidator.validateVoiceClinical("```json\n{}\n```");
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('không phải là JSON object');
    });
});
