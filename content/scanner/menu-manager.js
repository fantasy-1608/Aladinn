/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Menu Manager (UI Orchestrator)
 * 
 * Handles native menu injection and floating UI logic.
 */

const VNPTMenuManager = (function () {

    /**
     * Inject native menu into VNPT HIS top navigation
     */
    function injectNativeMenu(/** @type {any} */ _callbacks) {
        // Deprecated: UI moved to Extension Popup.
        // Doing nothing here.
        return false;
    }

    /**
     * Update progress badge in native menu
     */
    function updateProgress(/** @type {number} */ percent, isComplete = false) {
        const badge = document.getElementById('vnpt-progress-badge');
        if (!badge) return;

        if (isComplete) {
            badge.textContent = '✓';
            setTimeout(() => { badge.style.display = 'none'; }, 2000);
        } else {
            badge.style.display = 'inline';
            badge.textContent = `${percent}%`;
        }
    }

    /**
     * Show/Hide stop button
     */
    function toggleStopButton(/** @type {boolean} */ show) {
        const stopBtn = document.getElementById('native-stop-scan');
        if (stopBtn) stopBtn.style.display = show ? 'block' : 'none';
    }

    return {
        injectNativeMenu,
        updateProgress,
        toggleStopButton
    };
})();

window.VNPTMenuManager = VNPTMenuManager;
