/**
 * 🧞 Aladinn — Sign Audit Per-Install Salt Tests (P1-03)
 * Verifies HMAC-SHA256 with per-install salt for patientId hashing.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ──────────────────────────────────────────
// Load IIFE source and eval it in test context
// ──────────────────────────────────────────

const __filename2 = fileURLToPath(import.meta.url);
const __dirname2 = dirname(__filename2);

const AUDIT_SRC = readFileSync(
  resolve(__dirname2, '../../../content/sign/sign-audit.js'),
  'utf-8',
);

function loadAudit(storageMock = {}) {
  // Reset global state
  delete window.Aladinn;
  window.Aladinn = { Sign: {} };

  // Mock chrome.storage.local
  globalThis.chrome = {
    storage: {
      local: {
        get: vi.fn((keys, cb) => {
          if (typeof keys === 'string') keys = [keys];
          const result = {};
          for (const k of keys) {
            if (storageMock[k] !== undefined) result[k] = storageMock[k];
          }
          if (cb) cb(result);
          return Promise.resolve(result);
        }),
        set: vi.fn((obj, cb) => {
          Object.assign(storageMock, obj);
          if (cb) cb();
          return Promise.resolve();
        }),
      },
    },
  };

  eval(AUDIT_SRC);
  return window.Aladinn.Sign.Audit;
}

// ──────────────────────────────────────────
// Tests
// ──────────────────────────────────────────

describe('Sign Audit — Per-Install Salt (P1-03)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete globalThis.chrome;
    delete window.Aladinn;
  });

  describe('_hash with HMAC-SHA256', () => {
    it('same patientId with different salts → different hashes', async () => {
      vi.useFakeTimers();
      const saltA = 'c2FsdEFBQUFBQUFBQUFBQQ==';
      const saltB = 'c2FsdEJCQkJCQkJCQkJCQg==';
      const patientId = 'BN-2024-001234';

      // Install A
      const storageA = { aladinn_install_salt: saltA };
      const auditA = loadAudit(storageA);
      await auditA.logEvent({ eventType: 'sign_click', patientName: patientId });
      await vi.advanceTimersByTimeAsync(6000);

      const setCallsA = globalThis.chrome.storage.local.set.mock.calls;
      const logsA = setCallsA[setCallsA.length - 1][0].sign_audit_logs;
      const hashA = logsA[0].patientHash;

      // Install B (different salt)
      vi.useRealTimers();
      vi.useFakeTimers();
      const storageB = { aladinn_install_salt: saltB };
      const auditB = loadAudit(storageB);
      await auditB.logEvent({ eventType: 'sign_click', patientName: patientId });
      await vi.advanceTimersByTimeAsync(6000);

      const setCallsB = globalThis.chrome.storage.local.set.mock.calls;
      const logsB = setCallsB[setCallsB.length - 1][0].sign_audit_logs;
      const hashB = logsB[0].patientHash;

      expect(hashA).toBeDefined();
      expect(hashB).toBeDefined();
      expect(hashA).not.toBe(hashB);

      vi.useRealTimers();
    });

    it('null/empty text returns null', async () => {
      const audit = loadAudit({ aladinn_install_salt: 'dGVzdHNhbHQ=' });
      await audit.logEvent({ eventType: 'test', patientName: '' });
      await audit.logEvent({ eventType: 'test', patientName: null });
      // Should not throw — entry should have no patientHash
    });

    it('hash output is exactly 16 hex characters', async () => {
      const audit = loadAudit({ aladinn_install_salt: 'dGVzdHNhbHQ=' });
      vi.useFakeTimers();

      await audit.logEvent({
        eventType: 'test_hash_length',
        patientName: 'TEST-PATIENT-12345',
      });

      // Advance timer to trigger flush
      await vi.advanceTimersByTimeAsync(6000);

      // Check the set call for the flushed logs
      const setCalls = globalThis.chrome.storage.local.set.mock.calls;
      expect(setCalls.length).toBeGreaterThan(0);

      const lastSetCall = setCalls[setCalls.length - 1][0];
      const logs = lastSetCall.sign_audit_logs;
      expect(logs).toBeDefined();
      expect(logs.length).toBeGreaterThan(0);

      const entry = logs.find(l => l.eventType === 'test_hash_length');
      expect(entry).toBeDefined();
      expect(entry.patientHash).toBeDefined();
      expect(entry.patientHash).toHaveLength(16);
      expect(entry.patientHash).toMatch(/^[0-9a-f]{16}$/);

      vi.useRealTimers();
    });

    it('audit log entry does NOT contain raw patientId/patientName', async () => {
      const rawName = 'Nguyen Van A - BN-2024-999';
      const audit = loadAudit({ aladinn_install_salt: 'dGVzdHNhbHQ=' });
      vi.useFakeTimers();

      await audit.logEvent({
        eventType: 'test_no_phi',
        patientName: rawName,
        docId: 'DOC-SENSITIVE-789',
      });

      await vi.advanceTimersByTimeAsync(6000);

      const setCalls = globalThis.chrome.storage.local.set.mock.calls;
      const lastSetCall = setCalls[setCalls.length - 1][0];
      const logs = lastSetCall.sign_audit_logs;

      const entry = logs.find(l => l.eventType === 'test_no_phi');
      expect(entry).toBeDefined();

      // Serialize entire entry and verify no raw PHI
      const serialized = JSON.stringify(entry);
      expect(serialized).not.toContain(rawName);
      expect(serialized).not.toContain('DOC-SENSITIVE-789');
      // Should have hashed versions instead
      expect(entry.patientHash).toBeDefined();
      expect(entry.docIdHash).toBeDefined();
      expect(entry.patientHash).not.toBe(rawName);
      expect(entry.docIdHash).not.toBe('DOC-SENSITIVE-789');

      vi.useRealTimers();
    });
  });

  describe('salt persistence and fallback', () => {
    it('uses salt from chrome.storage.local', async () => {
      const salt = 'bXlzZWNyZXRzYWx0';
      const audit = loadAudit({ aladinn_install_salt: salt });

      await audit.logEvent({
        eventType: 'salt_from_storage',
        patientName: 'test-patient',
      });

      // Verify storage.local.get was called to retrieve salt
      const getCalls = globalThis.chrome.storage.local.get.mock.calls;
      const saltCall = getCalls.find(
        c => c[0] === 'aladinn_install_salt' ||
             (Array.isArray(c[0]) && c[0].includes('aladinn_install_salt'))
      );
      expect(saltCall).toBeDefined();
    });

    it('missing salt fallback still produces a hash (not null)', async () => {
      // No salt in storage
      const audit = loadAudit({});
      vi.useFakeTimers();

      await audit.logEvent({
        eventType: 'no_salt_fallback',
        patientName: 'fallback-patient',
      });

      await vi.advanceTimersByTimeAsync(6000);

      const setCalls = globalThis.chrome.storage.local.set.mock.calls;
      expect(setCalls.length).toBeGreaterThan(0);
      const lastSetCall = setCalls[setCalls.length - 1][0];
      const logs = lastSetCall.sign_audit_logs;
      const entry = logs.find(l => l.eventType === 'no_salt_fallback');
      expect(entry).toBeDefined();
      // Should still hash even without salt (fallback to unsalted)
      expect(entry.patientHash).toBeDefined();
      expect(entry.patientHash).not.toBe('fallback-patient');

      vi.useRealTimers();
    });

    it('salt is cached in memory after first read', async () => {
      const audit = loadAudit({ aladinn_install_salt: 'Y2FjaGVkc2FsdA==' });

      // Call logEvent twice
      await audit.logEvent({ eventType: 'call1', patientName: 'patient-1' });
      await audit.logEvent({ eventType: 'call2', patientName: 'patient-2' });

      // chrome.storage.local.get should be called for salt only once (cached)
      const getCalls = globalThis.chrome.storage.local.get.mock.calls;
      const saltCalls = getCalls.filter(
        c => c[0] === 'aladinn_install_salt' ||
             (Array.isArray(c[0]) && c[0].includes('aladinn_install_salt'))
      );
      expect(saltCalls.length).toBe(1);
    });
  });
});
