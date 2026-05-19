import { describe, it, expect } from 'vitest';
import { PatientContextGuard } from '../../content/shared/patient-context-guard.js';

describe('PatientContextGuard', () => {
    it('should create a composite safety key', () => {
        const key = PatientContextGuard.createKey('BN123', 'EN456', '2026-05-18', 'ClinicalForm');
        expect(key).toBe('BN123_EN456_2026-05-18_ClinicalForm');
    });

    it('should fall back to defaults for missing optional fields', () => {
        const key = PatientContextGuard.createKey('BN123', 'EN456', null, undefined);
        expect(key).toBe('BN123_EN456_unknown_date_unknown_form');
    });

    it('should throw an error if patientId or encounterId is missing', () => {
        expect(() => {
            PatientContextGuard.createKey(null, 'EN456');
        }).toThrow();
        
        expect(() => {
            PatientContextGuard.createKey('BN123', null);
        }).toThrow();
    });

    it('should validate correctly matching keys', () => {
        const lockedKey = PatientContextGuard.createKey('BN123', 'EN456', '2026-05-18', 'ClinicalForm');
        const isValid = PatientContextGuard.validate(lockedKey, 'BN123', 'EN456', '2026-05-18', 'ClinicalForm');
        expect(isValid).toBe(true);
    });

    it('should reject mismatched patientId', () => {
        const lockedKey = PatientContextGuard.createKey('BN123', 'EN456', '2026-05-18', 'ClinicalForm');
        const isValid = PatientContextGuard.validate(lockedKey, 'BN999', 'EN456', '2026-05-18', 'ClinicalForm');
        expect(isValid).toBe(false);
    });

    it('should reject mismatched encounterId', () => {
        const lockedKey = PatientContextGuard.createKey('BN123', 'EN456', '2026-05-18', 'ClinicalForm');
        const isValid = PatientContextGuard.validate(lockedKey, 'BN123', 'EN999', '2026-05-18', 'ClinicalForm');
        expect(isValid).toBe(false);
    });

    it('should reject mismatched formType', () => {
        const lockedKey = PatientContextGuard.createKey('BN123', 'EN456', '2026-05-18', 'ClinicalForm');
        const isValid = PatientContextGuard.validate(lockedKey, 'BN123', 'EN456', '2026-05-18', 'SurgeryForm');
        expect(isValid).toBe(false);
    });
});
