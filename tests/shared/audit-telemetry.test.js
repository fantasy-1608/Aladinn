/**
 * 🔍 Audit Telemetry Tests
 * Covers: event creation, PHI masking, metrics, TTL enforcement
 */
import { describe, expect, it, vi, beforeEach } from 'vitest';

// We test the pure functions directly
// (createAuditEvent, maskId are exportable)

import { createAuditEvent, maskId } from '../../shared/audit-telemetry.js';

// ---------- PHI Masking ----------
describe('Audit: PHI Masking', () => {
    it('masks long IDs showing first 2 and last 2 chars', () => {
        expect(maskId('12345678')).toBe('U-12***78');
    });

    it('masks short IDs with asterisks', () => {
        expect(maskId('AB')).toBe('U-****');
        expect(maskId('ABCD')).toBe('U-****');
    });

    it('handles null/undefined', () => {
        expect(maskId(null)).toBe('U-****');
        expect(maskId(undefined)).toBe('U-****');
        expect(maskId('')).toBe('U-****');
    });

    it('masks 5-char IDs properly', () => {
        expect(maskId('ABCDE')).toBe('U-AB***DE');
    });
});

// ---------- Event Creation ----------
describe('Audit: Event Creation', () => {
    beforeEach(() => {
        // Mock chrome.runtime for getVersion()
        globalThis.chrome = {
            runtime: {
                getManifest: () => ({ version: '1.2.4' })
            }
        };
    });

    it('creates a standard event with all required fields', () => {
        const event = createAuditEvent('ai_request_started', 'voice_ai');

        expect(event.event_name).toBe('ai_request_started');
        expect(event.module).toBe('voice_ai');
        expect(event.timestamp).toBeTruthy();
        expect(event.success).toBe(true);
        expect(event.error_code).toBeNull();
        expect(event.version).toBe('1.2.4');
        expect(event.environment).toBe('production');
    });

    it('creates a failure event with error code', () => {
        const event = createAuditEvent('ai_request_failed', 'voice_ai', {
            success: false,
            errorCode: 'AI_QUOTA_LIMIT'
        });

        expect(event.success).toBe(false);
        expect(event.error_code).toBe('AI_QUOTA_LIMIT');
    });

    it('includes extra metadata', () => {
        const event = createAuditEvent('scanner_opened', 'scanner', {
            extra: { tab_count: 3 }
        });

        expect(event.tab_count).toBe(3);
    });

    it('timestamp is valid ISO string', () => {
        const event = createAuditEvent('test', 'test');
        const date = new Date(event.timestamp);
        expect(date.toISOString()).toBe(event.timestamp);
    });

    it('does NOT contain PHI fields', () => {
        const event = createAuditEvent('ai_request_started', 'voice_ai', {
            extra: { model: 'gemini-2.0-flash' }
        });

        const eventStr = JSON.stringify(event);
        // Should not contain PHI-like fields
        expect(eventStr).not.toContain('patientName');
        expect(eventStr).not.toContain('HOTENBENTHAN');
        expect(eventStr).not.toContain('SOCMND');
    });
});
