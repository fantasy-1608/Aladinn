/**
 * @vitest-environment jsdom
 *
 * 🧞 Aladinn — P1-01 Security Test: Auto-Sign Tab/Window Change
 * Verifies that auto-sign sessions correctly pause/stop when the tab
 * becomes hidden (user switches tabs or minimizes window).
 *
 * Covers:
 * - SessionGuard.pauseSession / resumeSession state transitions
 * - document.hidden guard pattern blocking polling callbacks
 * - visibilitychange event triggering pause/resume
 * - Session state accurately reflects tab visibility
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ═══════════════════════════════════════════════════════════════════
// MOCK: Minimal SessionGuard (mirrors sign-session-guard.js logic)
// ═══════════════════════════════════════════════════════════════════
function createSessionGuard() {
    let currentSession = null;
    let lastActivity = 0;
    const auditLog = [];

    function _log(action, meta = {}) {
        auditLog.push({ action, meta, ts: Date.now() });
    }

    return {
        startSession(count, type) {
            currentSession = {
                id: Date.now().toString(36),
                startedAt: Date.now(),
                patientCount: count,
                workflowType: type,
                state: 'ACTIVE',
                pauseReason: null
            };
            lastActivity = Date.now();
            _log('SESSION_STARTED', { count, type });
            return currentSession.id;
        },

        pauseSession(reason) {
            if (!currentSession || currentSession.state !== 'ACTIVE') return;
            currentSession.state = 'PAUSED';
            currentSession.pauseReason = reason;
            _log('SESSION_PAUSED', { reason });
        },

        resumeSession() {
            if (!currentSession || currentSession.state !== 'PAUSED') return;
            currentSession.state = 'ACTIVE';
            currentSession.pauseReason = null;
            lastActivity = Date.now();
            _log('SESSION_RESUMED', {});
        },

        stopSession(reason = 'MANUAL') {
            if (!currentSession) return;
            _log('SESSION_STOPPED', { reason });
            currentSession.state = 'STOPPED';
            currentSession = null;
        },

        getState() {
            return currentSession?.state || 'STOPPED';
        },

        getSession() {
            return currentSession ? { ...currentSession } : null;
        },

        isSessionValid() {
            return currentSession?.state === 'ACTIVE';
        },

        getAuditLog() { return [...auditLog]; }
    };
}

// ═══════════════════════════════════════════════════════════════════
// MOCK: document.hidden guard (mirrors sign-init.js polling pattern)
//   Every polling interval in sign-init.js starts with:
//     if (document.hidden) return;
// ═══════════════════════════════════════════════════════════════════
function createPollingTask(onTick) {
    let tickCount = 0;
    return {
        tick() {
            // Exact pattern from sign-init.js: bail early when hidden
            if (document.hidden) return;
            tickCount++;
            onTick(tickCount);
        },
        getTickCount() { return tickCount; }
    };
}


// ═══════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════

describe('P1-01: Auto-Sign Tab Visibility Safety', () => {
    let guard;
    let originalHidden;

    beforeEach(() => {
        guard = createSessionGuard();
        // Save original and make document.hidden writable
        originalHidden = Object.getOwnPropertyDescriptor(Document.prototype, 'hidden');
    });

    afterEach(() => {
        // Restore original document.hidden
        if (originalHidden) {
            Object.defineProperty(Document.prototype, 'hidden', originalHidden);
        } else {
            Object.defineProperty(Document.prototype, 'hidden', {
                configurable: true,
                get() { return false; }
            });
        }
    });

    /**
     * Helper: simulate tab becoming hidden
     */
    function simulateTabHidden() {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get() { return true; }
        });
        document.dispatchEvent(new Event('visibilitychange'));
    }

    /**
     * Helper: simulate tab becoming visible
     */
    function simulateTabVisible() {
        Object.defineProperty(document, 'hidden', {
            configurable: true,
            get() { return false; }
        });
        document.dispatchEvent(new Event('visibilitychange'));
    }


    // ─── SessionGuard State Transitions ───

    describe('SessionGuard: pause on tab hidden', () => {
        it('pauses ACTIVE session when tab becomes hidden', () => {
            guard.startSession(5, 'WARD');
            expect(guard.getState()).toBe('ACTIVE');

            guard.pauseSession('TAB_HIDDEN');
            expect(guard.getState()).toBe('PAUSED');

            const session = guard.getSession();
            expect(session.pauseReason).toBe('TAB_HIDDEN');
        });

        it('does NOT pause an already PAUSED session', () => {
            guard.startSession(3, 'SIGN_PAGE');
            guard.pauseSession('TAB_HIDDEN');
            expect(guard.getState()).toBe('PAUSED');

            // Second pause call should be a no-op
            guard.pauseSession('TAB_HIDDEN_AGAIN');
            expect(guard.getState()).toBe('PAUSED');
            expect(guard.getSession().pauseReason).toBe('TAB_HIDDEN');
        });

        it('does NOT pause when there is no active session', () => {
            expect(guard.getState()).toBe('STOPPED');
            guard.pauseSession('TAB_HIDDEN');
            expect(guard.getState()).toBe('STOPPED');
        });
    });

    describe('SessionGuard: resume on tab visible', () => {
        it('resumes PAUSED session when tab becomes visible again', () => {
            guard.startSession(5, 'WARD');
            guard.pauseSession('TAB_HIDDEN');
            expect(guard.getState()).toBe('PAUSED');

            guard.resumeSession();
            expect(guard.getState()).toBe('ACTIVE');
            expect(guard.getSession().pauseReason).toBeNull();
        });

        it('does NOT resume an ACTIVE session (no-op)', () => {
            guard.startSession(2, 'SIGN_PAGE');
            expect(guard.getState()).toBe('ACTIVE');

            guard.resumeSession();
            expect(guard.getState()).toBe('ACTIVE');
        });

        it('does NOT resume a STOPPED session', () => {
            guard.startSession(2, 'WARD');
            guard.stopSession('TEST');
            expect(guard.getState()).toBe('STOPPED');

            guard.resumeSession();
            expect(guard.getState()).toBe('STOPPED');
        });
    });

    describe('SessionGuard: full hide/show cycle', () => {
        it('transitions ACTIVE → PAUSED → ACTIVE correctly', () => {
            guard.startSession(10, 'WARD');

            // Tab hidden
            guard.pauseSession('TAB_HIDDEN');
            expect(guard.getState()).toBe('PAUSED');
            expect(guard.isSessionValid()).toBe(false);

            // Tab visible
            guard.resumeSession();
            expect(guard.getState()).toBe('ACTIVE');
            expect(guard.isSessionValid()).toBe(true);
        });

        it('handles multiple hide/show cycles without corruption', () => {
            guard.startSession(5, 'WARD');

            for (let i = 0; i < 10; i++) {
                guard.pauseSession('TAB_HIDDEN');
                expect(guard.getState()).toBe('PAUSED');

                guard.resumeSession();
                expect(guard.getState()).toBe('ACTIVE');
            }

            expect(guard.isSessionValid()).toBe(true);
        });

        it('logs all state transitions in audit trail', () => {
            guard.startSession(3, 'WARD');
            guard.pauseSession('TAB_HIDDEN');
            guard.resumeSession();
            guard.stopSession('COMPLETE');

            const log = guard.getAuditLog();
            const actions = log.map(e => e.action);
            expect(actions).toEqual([
                'SESSION_STARTED',
                'SESSION_PAUSED',
                'SESSION_RESUMED',
                'SESSION_STOPPED'
            ]);
        });
    });


    // ─── document.hidden Guard Pattern ───

    describe('document.hidden guard blocks polling', () => {
        it('polling callback does NOT execute when document.hidden is true', () => {
            const work = vi.fn();
            const task = createPollingTask(work);

            // Tab visible: ticks should work
            simulateTabVisible();
            task.tick();
            task.tick();
            expect(work).toHaveBeenCalledTimes(2);

            // Tab hidden: ticks should be blocked
            simulateTabHidden();
            task.tick();
            task.tick();
            task.tick();
            expect(work).toHaveBeenCalledTimes(2); // still 2
        });

        it('polling resumes after tab becomes visible again', () => {
            const work = vi.fn();
            const task = createPollingTask(work);

            simulateTabVisible();
            task.tick(); // 1

            simulateTabHidden();
            task.tick(); // blocked
            task.tick(); // blocked

            simulateTabVisible();
            task.tick(); // 2
            task.tick(); // 3

            expect(work).toHaveBeenCalledTimes(3);
        });

        it('no state leaks between hidden/visible transitions', () => {
            let accumulator = 0;
            const task = createPollingTask((count) => {
                accumulator += count;
            });

            simulateTabVisible();
            task.tick(); // count=1, acc=1
            task.tick(); // count=2, acc=3

            simulateTabHidden();
            task.tick(); // blocked, count stays 2
            task.tick(); // blocked

            simulateTabVisible();
            task.tick(); // count=3, acc=6

            expect(accumulator).toBe(6);
            expect(task.getTickCount()).toBe(3);
        });
    });


    // ─── Integration: visibilitychange event ───

    describe('visibilitychange event integration', () => {
        it('pauses session via visibilitychange listener', () => {
            guard.startSession(5, 'WARD');

            // Simulate what SmartDetection + SessionGuard would do on visibilitychange
            document.addEventListener('visibilitychange', function handler() {
                if (document.hidden) {
                    guard.pauseSession('TAB_HIDDEN');
                } else {
                    guard.resumeSession();
                }
                document.removeEventListener('visibilitychange', handler);
            });

            simulateTabHidden();
            expect(guard.getState()).toBe('PAUSED');
        });

        it('resumes session via visibilitychange listener', () => {
            guard.startSession(5, 'WARD');
            guard.pauseSession('TAB_HIDDEN');

            document.addEventListener('visibilitychange', function handler() {
                if (!document.hidden) {
                    guard.resumeSession();
                }
                document.removeEventListener('visibilitychange', handler);
            });

            simulateTabVisible();
            expect(guard.getState()).toBe('ACTIVE');
        });

        it('full cycle: start → hide → show → stop via events', () => {
            guard.startSession(5, 'WARD');
            const states = ['ACTIVE'];

            function visHandler() {
                if (document.hidden) {
                    guard.pauseSession('TAB_HIDDEN');
                } else if (guard.getState() === 'PAUSED') {
                    guard.resumeSession();
                }
                states.push(guard.getState());
            }

            document.addEventListener('visibilitychange', visHandler);

            simulateTabHidden();     // → PAUSED
            simulateTabVisible();    // → ACTIVE
            simulateTabHidden();     // → PAUSED
            simulateTabVisible();    // → ACTIVE

            document.removeEventListener('visibilitychange', visHandler);
            guard.stopSession('DONE');
            states.push(guard.getState());

            expect(states).toEqual([
                'ACTIVE',
                'PAUSED',
                'ACTIVE',
                'PAUSED',
                'ACTIVE',
                'STOPPED'
            ]);
        });
    });


    // ─── Edge Cases ───

    describe('Edge cases', () => {
        it('stopSession while paused does not leave dangling state', () => {
            guard.startSession(3, 'WARD');
            guard.pauseSession('TAB_HIDDEN');

            guard.stopSession('USER_CANCELLED');
            expect(guard.getState()).toBe('STOPPED');
            expect(guard.getSession()).toBeNull();
        });

        it('startSession while paused overrides old session', () => {
            guard.startSession(3, 'WARD');
            guard.pauseSession('TAB_HIDDEN');

            const newId = guard.startSession(5, 'SIGN_PAGE');
            expect(guard.getState()).toBe('ACTIVE');
            expect(guard.getSession().patientCount).toBe(5);
            expect(newId).toBeTruthy();
        });

        it('rapid visibility toggles do not corrupt session', () => {
            guard.startSession(5, 'WARD');

            // Rapid toggle 21 times (ends on pause at i=20, even)
            for (let i = 0; i < 21; i++) {
                if (i % 2 === 0) {
                    guard.pauseSession('TAB_HIDDEN');
                } else {
                    guard.resumeSession();
                }
            }

            // Ended on even iteration (i=20) → PAUSED
            expect(guard.getState()).toBe('PAUSED');
            guard.resumeSession();
            expect(guard.getState()).toBe('ACTIVE');
        });

        it('isSessionValid returns false when paused', () => {
            guard.startSession(3, 'WARD');
            expect(guard.isSessionValid()).toBe(true);

            guard.pauseSession('TAB_HIDDEN');
            expect(guard.isSessionValid()).toBe(false);
        });
    });
});
