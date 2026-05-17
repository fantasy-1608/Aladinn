/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import '../../content/scanner/patient-context-guard.js';

describe('VNPTPatientContextGuard', () => {
    beforeEach(() => {
        window.VNPTStore = {
            getState: () => ({ selectedPatientId: 'PID_123' }),
            get: (key) => key === 'selectedPatientId' ? 'PID_123' : null
        };
        window.VNPTRealtime = {
            showToast: vi.fn()
        };
    });

    it('captures grid only token correctly', () => {
        const token = window.VNPTPatientContextGuard.captureGridOnly('PID_123');
        expect(token).toBeDefined();
        expect(token.rowId).toBe('PID_123');
        expect(token.state).toBe('active');
    });

    it('validates correctly when patient ID matches', () => {
        const token = window.VNPTPatientContextGuard.captureGridOnly('PID_123');
        const isValid = window.VNPTPatientContextGuard.validate(token, { allowGridOnly: true });
        expect(isValid).toBe(true);
    });

    it('fails validation when patient ID mismatches', () => {
        const token = window.VNPTPatientContextGuard.captureGridOnly('PID_999');
        const isValid = window.VNPTPatientContextGuard.validate(token, { allowGridOnly: true });
        expect(isValid).toBe(false);
    });

    it('hashes identity correctly', () => {
        const hash = window.VNPTPatientContextGuard.hashIdentity({ rowId: 'PID_123' });
        expect(hash).toBe('PID_123___');
    });
});
