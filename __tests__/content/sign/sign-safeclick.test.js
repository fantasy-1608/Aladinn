/**
 * 🧞 Aladinn — Sign SafeClick finalGuard() Tests
 * P0-02: Final Safety Gate for Auto-Click Sign Module
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// ──────────────────────────────────────────
// Load IIFE source and eval it in test context
// ──────────────────────────────────────────

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const SAFECLICK_SRC = readFileSync(
  resolve(__dirname, '../../../content/sign/sign-safeclick.js'),
  'utf-8',
);

function loadSafeClick() {
  eval(SAFECLICK_SRC);
  return window.Aladinn.Sign.SafeClick;
}

// ──────────────────────────────────────────
// Helpers: build mock globals on window.Aladinn.Sign.*
// ──────────────────────────────────────────

function buildMockGlobals(overrides = {}) {
  const defaults = {
    sessionValid: true,
    policyOverrides: {},
    riskResult: { level: 'LOW', score: 0, reasonCode: 'OK' },
    contextOverrides: {},
    buttonElement: null,
    candidateCount: 1,
  };
  const cfg = { ...defaults, ...overrides };

  const policy = {
    autoSignEnabled: true,
    requireRemoteConfig: false,
    requireVisibleTab: true,
    requireNoErrorText: true,
    requireSingleConfirmCandidate: true,
    allowConfirmAutoClick: true,
    allowOkAutoClick: true,
    maxRiskForAutoClick: 'MEDIUM',
    auditEnabled: true,
    auditRetentionEvents: 1000,
    ...cfg.policyOverrides,
  };

  const context = {
    pageType: 'SMARTCA_CONFIRM',
    hasErrorText: false,
    candidateButtonsCount: cfg.candidateCount,
    hasAmbiguousSignerSelect: false,
    hasUnselectedSignerSelect: false,
    ...cfg.contextOverrides,
  };

  const auditLogs = [];

  window.Aladinn = {
    Sign: {
      SessionGuard: {
        isSessionValid: vi.fn(() => cfg.sessionValid),
        getSessionId: vi.fn(() => 'test-session-123'),
        assertCanAutoClick: vi.fn(() => true),
      },
      Policy: {
        get: vi.fn(() => ({ ...policy })),
        isAutoSignAllowed: vi.fn(() => true),
      },
      RiskEngine: {
        evaluate: vi.fn(() => ({ ...cfg.riskResult })),
        LEVELS: { LOW: 0, MEDIUM: 1, HIGH: 2, CRITICAL: 3 },
      },
      Context: {
        collect: vi.fn(() => ({ ...context })),
        findInShadowRoots: vi.fn(() => cfg.buttonElement),
      },
      Audit: {
        logEvent: vi.fn((entry) => auditLogs.push(entry)),
      },
    },
  };

  return { policy, context, auditLogs };
}

function createButton(text, opts = {}) {
  const btn = document.createElement('button');
  btn.id = opts.id || 'btnConfirm';
  btn.textContent = text;
  if (opts.clicked) btn.dataset.aladinnClicked = '1';
  document.body.appendChild(btn);
  return btn;
}

// ──────────────────────────────────────────
// Tests
// ──────────────────────────────────────────

describe('SafeClick.finalGuard()', () => {
  let SafeClick;

  beforeEach(() => {
    document.body.innerHTML = '';
    // Reset visibilityState to visible
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  // ── 1. Multiple confirm buttons → BLOCKED ──
  it('blocks when multiple confirm buttons exist (MULTIPLE_CONFIRM_BUTTONS)', () => {
    buildMockGlobals({ candidateCount: 2 });
    SafeClick = loadSafeClick();

    const btn = createButton('Xác nhận');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 2,
      hasErrorText: false,
    }, 'sess-1');

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('MULTIPLE_CONFIRM_BUTTONS');
  });

  // ── 2. Tab in background → BLOCKED ──
  it('blocks when tab is not visible (TAB_NOT_VISIBLE)', () => {
    buildMockGlobals();
    SafeClick = loadSafeClick();

    Object.defineProperty(document, 'visibilityState', {
      value: 'hidden',
      writable: true,
      configurable: true,
    });

    const btn = createButton('Xác nhận');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: false,
    }, 'sess-1');

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('TAB_NOT_VISIBLE');
  });

  // ── 3. Error dialog detected → BLOCKED ──
  it('blocks when error dialog is detected (ERROR_DIALOG_DETECTED)', () => {
    buildMockGlobals();
    SafeClick = loadSafeClick();

    const btn = createButton('Xác nhận');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: true,
    }, 'sess-1');

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('ERROR_DIALOG_DETECTED');
  });

  // ── 4. Session expired → BLOCKED ──
  it('blocks when session is invalid (SESSION_INVALID)', () => {
    buildMockGlobals({ sessionValid: false });
    SafeClick = loadSafeClick();

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: false,
    }, 'sess-1');

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('SESSION_INVALID');
  });

  // ── 5. Button text 'Hủy' → BLOCKED ──
  it('blocks when button text is forbidden (FORBIDDEN_TEXT)', () => {
    buildMockGlobals();
    SafeClick = loadSafeClick();

    const btn = createButton('Hủy');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: false,
    }, 'sess-1');

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('FORBIDDEN_TEXT');
  });

  // ── 6. Button text not in allowlist → BLOCKED ──
  it('blocks when button text is not in allowlist (TEXT_NOT_IN_ALLOWLIST)', () => {
    buildMockGlobals();
    SafeClick = loadSafeClick();

    const btn = createButton('Lưu tạm');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: false,
    }, 'sess-1');

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('TEXT_NOT_IN_ALLOWLIST');
  });

  // ── 7. Risk level HIGH with policy maxRisk MEDIUM → BLOCKED ──
  it('blocks when risk exceeds policy max (RISK_TOO_HIGH)', () => {
    buildMockGlobals({
      riskResult: { level: 'HIGH', score: 2, reasonCode: 'MULTIPLE_SIGNER_SELECTS' },
      policyOverrides: { maxRiskForAutoClick: 'MEDIUM' },
    });
    SafeClick = loadSafeClick();

    const btn = createButton('Xác nhận');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: false,
    }, 'sess-1');

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('RISK_TOO_HIGH');
  });

  // ── 8. All checks pass → click succeeds ──
  it('allows click when all checks pass', () => {
    buildMockGlobals({
      riskResult: { level: 'LOW', score: 0, reasonCode: 'OK' },
    });
    SafeClick = loadSafeClick();

    const btn = createButton('Xác nhận');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: false,
    }, 'sess-1');

    expect(result.allowed).toBe(true);
    expect(result.riskLevel).toBe('LOW');
  });

  // ── 9. Audit log has correct reasonCode and riskLevel ──
  it('logs blocked event to audit with correct reasonCode and riskLevel', () => {
    const { auditLogs } = buildMockGlobals({ sessionValid: false });
    SafeClick = loadSafeClick();

    SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: false,
    }, 'sess-blocked');

    expect(auditLogs.length).toBeGreaterThanOrEqual(1);
    const blocked = auditLogs.find(
      (e) => e.eventType === 'sign_autoclick_blocked',
    );
    expect(blocked).toBeDefined();
    expect(blocked.reasonCode).toBe('SESSION_INVALID');
    expect(blocked.riskLevel).toBeTruthy();
    expect(blocked.sessionId).toBe('sess-blocked');
  });
});

describe('SafeClick.click() integration with finalGuard', () => {
  let SafeClick;

  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  it('click() returns false when finalGuard blocks', () => {
    buildMockGlobals({ sessionValid: false });
    SafeClick = loadSafeClick();

    const btn = createButton('Xác nhận');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.click(
      'smartCAConfirm',
      { pageType: 'SMARTCA_CONFIRM', candidateButtonsCount: 1, hasErrorText: false },
      'sess-1',
    );

    expect(result).toBe(false);
  });

  it('click() passes actual riskLevel to audit on success', () => {
    const { auditLogs } = buildMockGlobals({
      riskResult: { level: 'MEDIUM', score: 1, reasonCode: 'OK' },
    });
    SafeClick = loadSafeClick();

    const btn = createButton('Xác nhận');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    SafeClick.click(
      'smartCAConfirm',
      { pageType: 'SMARTCA_CONFIRM', candidateButtonsCount: 1, hasErrorText: false },
      'sess-1',
    );

    const successLog = auditLogs.find((e) => e.result === 'success');
    expect(successLog).toBeDefined();
    expect(successLog.riskLevel).toBe('MEDIUM');
    // Must NOT be hardcoded 'LOW'
    expect(successLog.riskLevel).not.toBe('LOW');
  });
});

describe('SafeClick.finalGuard() — policy config gate', () => {
  let SafeClick;

  beforeEach(() => {
    document.body.innerHTML = '';
    Object.defineProperty(document, 'visibilityState', {
      value: 'visible',
      writable: true,
      configurable: true,
    });
  });

  it('blocks when remote config disallows auto-sign (POLICY_DISABLED)', () => {
    buildMockGlobals();
    SafeClick = loadSafeClick();

    window.Aladinn.Sign.Policy.isAutoSignAllowed = vi.fn(() => false);

    const btn = createButton('Xác nhận');
    window.Aladinn.Sign.Context.findInShadowRoots = vi.fn(() => btn);

    const result = SafeClick.finalGuard('smartCAConfirm', {
      pageType: 'SMARTCA_CONFIRM',
      candidateButtonsCount: 1,
      hasErrorText: false,
    }, 'sess-1');

    expect(result.allowed).toBe(false);
    expect(result.reasonCode).toBe('POLICY_DISABLED');
  });
});
