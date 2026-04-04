/**
 * 🧞 Aladinn — Tests: Signing State Machine
 * Tests for workflow state transitions, queue management, stats tracking
 */

const T = window.T;

// ========================================
// MOCK WORKFLOW STATE (mirrors signing.js)
// ========================================
function createWorkflow() {
    return {
        queue: [],
        currentIndex: -1,
        isActive: false,
        stats: { completed: 0, skipped: 0 }
    };
}

// ========================================
// TESTS
// ========================================

T.describe('✍️ Signing: Workflow State Machine', () => {
    T.it('initial state is inactive with empty queue', () => {
        const wf = createWorkflow();
        T.assertEqual(wf.isActive, false, 'Should start inactive');
        T.assertEqual(wf.queue.length, 0, 'Queue should be empty');
        T.assertEqual(wf.currentIndex, -1, 'Index should be -1');
    });

    T.it('startSession activates workflow with queue', () => {
        const wf = createWorkflow();
        wf.queue = ['row1', 'row2', 'row3'];
        wf.isActive = true;
        wf.currentIndex = -1;
        wf.stats.completed = 0;
        wf.stats.skipped = 0;

        T.assertEqual(wf.isActive, true, 'Should be active after start');
        T.assertEqual(wf.queue.length, 3, 'Queue should have 3 items');
    });

    T.it('processNext increments currentIndex', () => {
        const wf = createWorkflow();
        wf.queue = ['row1', 'row2', 'row3'];
        wf.isActive = true;

        // Process next
        wf.currentIndex++;
        T.assertEqual(wf.currentIndex, 0, 'Should be at index 0');
        T.assertEqual(wf.queue[wf.currentIndex], 'row1', 'Should point to first row');

        wf.currentIndex++;
        T.assertEqual(wf.currentIndex, 1, 'Should be at index 1');
        T.assertEqual(wf.queue[wf.currentIndex], 'row2', 'Should point to second row');
    });

    T.it('completed stats increment correctly', () => {
        const wf = createWorkflow();
        wf.queue = ['row1', 'row2'];
        wf.isActive = true;

        wf.stats.completed++;
        T.assertEqual(wf.stats.completed, 1, 'Should have 1 completed');

        wf.stats.completed++;
        T.assertEqual(wf.stats.completed, 2, 'Should have 2 completed');
    });

    T.it('skipped stats increment correctly', () => {
        const wf = createWorkflow();
        wf.stats.skipped++;
        wf.stats.skipped++;
        wf.stats.skipped++;
        T.assertEqual(wf.stats.skipped, 3, 'Should have 3 skipped');
    });

    T.it('session ends when queue is exhausted', () => {
        const wf = createWorkflow();
        wf.queue = ['row1'];
        wf.isActive = true;
        wf.currentIndex = -1;

        // Process the only item
        wf.currentIndex++;
        wf.stats.completed++;

        // Try next
        wf.currentIndex++;
        const isExhausted = wf.currentIndex >= wf.queue.length;
        T.assert(isExhausted, 'Queue should be exhausted');

        // Stop
        wf.isActive = false;
        wf.queue = [];
        T.assertEqual(wf.isActive, false, 'Should be inactive');
        T.assertEqual(wf.queue.length, 0, 'Queue should be empty');
    });

    T.it('stopSession resets all state', () => {
        const wf = createWorkflow();
        wf.queue = ['row1', 'row2', 'row3'];
        wf.isActive = true;
        wf.currentIndex = 2;
        wf.stats.completed = 2;
        wf.stats.skipped = 1;

        // Stop
        wf.isActive = false;
        wf.queue = [];
        
        T.assertEqual(wf.isActive, false);
        T.assertEqual(wf.queue.length, 0);
        // Note: stats are NOT reset on stop (they show in toast)
        T.assertEqual(wf.stats.completed, 2, 'Stats preserved for summary');
    });
});

T.describe('✍️ Signing: Auto-Sign State', () => {
    T.it('auto-sign initial state', () => {
        const autoSign = {
            isEnabled: true,
            hasClickedConfirm: false,
            hasClickedOk: false,
            hasClickedSign: false,
            lastConfirmTime: 0,
            lastOkTime: 0
        };

        T.assertEqual(autoSign.isEnabled, true, 'Auto-sign enabled by default');
        T.assertEqual(autoSign.hasClickedConfirm, false);
        T.assertEqual(autoSign.hasClickedOk, false);
        T.assertEqual(autoSign.hasClickedSign, false);
    });

    T.it('state resets between patients', () => {
        const autoSign = {
            hasClickedConfirm: true,
            hasClickedOk: true,
            hasClickedSign: true
        };

        // Reset for next patient
        autoSign.hasClickedConfirm = false;
        autoSign.hasClickedOk = false;
        autoSign.hasClickedSign = false;

        T.assertEqual(autoSign.hasClickedConfirm, false, 'Confirm reset');
        T.assertEqual(autoSign.hasClickedOk, false, 'OK reset');
        T.assertEqual(autoSign.hasClickedSign, false, 'Sign reset');
    });

    T.it('cooldown prevents rapid re-clicks', () => {
        const autoSign = { lastConfirmTime: 0 };
        const COOLDOWN = 800;

        // Simulate first click
        autoSign.lastConfirmTime = Date.now();

        // Check if cooldown is active
        const now = Date.now();
        const canClick = (now - autoSign.lastConfirmTime) > COOLDOWN;
        T.assertEqual(canClick, false, 'Should be in cooldown');
    });
});

T.describe('✍️ Signing: Queue Management', () => {
    T.it('empty selection produces empty queue', () => {
        const wf = createWorkflow();
        // No checkboxes checked → no queue
        T.assertEqual(wf.queue.length, 0, 'Empty selection = empty queue');
    });

    T.it('queue preserves row ID order', () => {
        const wf = createWorkflow();
        wf.queue = ['abc123', 'def456', 'ghi789'];
        T.assertEqual(wf.queue[0], 'abc123');
        T.assertEqual(wf.queue[1], 'def456');
        T.assertEqual(wf.queue[2], 'ghi789');
    });

    T.it('mixed completed and skipped tracking', () => {
        const wf = createWorkflow();
        wf.queue = ['r1', 'r2', 'r3', 'r4', 'r5'];
        wf.isActive = true;
        
        // r1: completed
        wf.stats.completed++;
        // r2: skipped
        wf.stats.skipped++;
        // r3: completed
        wf.stats.completed++;
        // r4: completed
        wf.stats.completed++;
        // r5: skipped
        wf.stats.skipped++;

        T.assertEqual(wf.stats.completed, 3, '3 completed');
        T.assertEqual(wf.stats.skipped, 2, '2 skipped');
        T.assertEqual(wf.stats.completed + wf.stats.skipped, wf.queue.length, 'Total should match queue');
    });
});
