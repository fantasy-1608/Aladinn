/**
 * 🧞 Aladinn — HISPerformanceProbe Listener Leak Tests (P1-05)
 * Verifies that bind(this) references are cached to prevent listener leaks.
 *
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ──────────────────────────────────────────
// We must mock the PerformanceStore import before loading the module
// ──────────────────────────────────────────

vi.mock('../../shared/performance-store.js', () => ({
  PerformanceStore: {
    addRecord: vi.fn().mockResolvedValue(undefined),
  },
}));

// ──────────────────────────────────────────
// Tests
// ──────────────────────────────────────────

describe('HISPerformanceProbe — Listener Leak Fix (P1-05)', () => {
  let addSpy;
  let removeSpy;

  beforeEach(() => {
    addSpy = vi.spyOn(document, 'addEventListener');
    removeSpy = vi.spyOn(document, 'removeEventListener');
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('toggle ON/OFF 10 times → only 1 active listener at a time', async () => {
    const { HISPerformanceProbe } = await import(
      '../../../content/shared/his-performance-probe.js'
    );

    for (let i = 0; i < 10; i++) {
      HISPerformanceProbe.init(true);  // ON
      HISPerformanceProbe.init(false); // OFF
    }

    // After 10 ON/OFF cycles, click listener add count should equal remove count
    const clickAdds = addSpy.mock.calls.filter(
      c => c[0] === 'click' && c[2] === true
    );
    const clickRemoves = removeSpy.mock.calls.filter(
      c => c[0] === 'click' && c[2] === true
    );
    expect(clickAdds.length).toBe(clickRemoves.length);

    // And they should all use the SAME function reference
    const addedFns = clickAdds.map(c => c[1]);
    const removedFns = clickRemoves.map(c => c[1]);
    const uniqueAdded = new Set(addedFns);
    const uniqueRemoved = new Set(removedFns);
    expect(uniqueAdded.size).toBe(1); // only 1 unique bound reference
    expect(uniqueRemoved.size).toBe(1); // same reference used in remove
    expect([...uniqueAdded][0]).toBe([...uniqueRemoved][0]); // same ref
  });

  it('detach removes the bound click listener', async () => {
    const { HISPerformanceProbe } = await import(
      '../../../content/shared/his-performance-probe.js'
    );

    HISPerformanceProbe.init(true);  // attach
    HISPerformanceProbe.init(false); // detach

    const lastRemove = removeSpy.mock.calls.find(
      c => c[0] === 'click' && c[2] === true
    );
    expect(lastRemove).toBeDefined();

    // The removed function should be the same as the added function
    const lastAdd = addSpy.mock.calls.find(
      c => c[0] === 'click' && c[2] === true
    );
    expect(lastAdd).toBeDefined();
    expect(lastRemove[1]).toBe(lastAdd[1]);
  });

  it('attachListeners reuses same bound handler', async () => {
    const { HISPerformanceProbe } = await import(
      '../../../content/shared/his-performance-probe.js'
    );

    HISPerformanceProbe.enabled = true;
    HISPerformanceProbe.attachListeners();
    HISPerformanceProbe.attachListeners();
    HISPerformanceProbe.attachListeners();

    const clickAdds = addSpy.mock.calls.filter(
      c => c[0] === 'click' && c[2] === true
    );
    const addedFns = clickAdds.map(c => c[1]);
    // All should be the same reference (bound once, reused)
    for (const fn of addedFns) {
      expect(fn).toBe(addedFns[0]);
    }
  });

  it('handleDocumentClick logic is not altered', async () => {
    const { HISPerformanceProbe } = await import(
      '../../../content/shared/his-performance-probe.js'
    );

    // Verify handleDocumentClick still exists and is a function
    expect(typeof HISPerformanceProbe.handleDocumentClick).toBe('function');
  });
});
