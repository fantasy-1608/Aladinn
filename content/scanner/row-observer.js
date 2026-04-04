/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Row Observer (Interaction Tracking)
 * 
 * Handles patient selection and grid interactions.
 * Uses MutationObserver instead of polling for better performance.
 */

const VNPTRowObserver = (function () {

    let _observer = null;
    let _lastSelectedId = '';

    /**
     * Initialize listeners for patient selection
     * @param {Function} onSelect - Callback when a patient is selected
     */
    function init(onSelect) {
        // 1. Mouse Click Listener (primary)
        document.addEventListener('mousedown', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            if (!target) return;

            const tr = target.closest('tr.ui-widget-content');
            if (tr && tr.id && tr.id.length > 5) {
                const grid = tr.closest('#grdBenhNhan');
                if (grid) {
                    _lastSelectedId = tr.id;
                    onSelect(tr.id);
                }
            }
        }, true);

        // 2. MutationObserver: Watch for class changes on grid rows (replaces setInterval)
        function startObserving() {
            const grid = document.querySelector('#grdBenhNhan');
            if (!grid) {
                // Grid not ready yet — retry with a short delay
                setTimeout(startObserving, 2000);
                return;
            }

            if (_observer) _observer.disconnect();

            _observer = new MutationObserver((mutations) => {
                for (const mutation of mutations) {
                    if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                        const target = mutation.target;
                        if (target.tagName === 'TR' &&
                            target.classList.contains('ui-state-highlight') &&
                            target.id && target.id !== _lastSelectedId) {
                            _lastSelectedId = target.id;
                            onSelect(target.id);
                        }
                    }
                    // Also handle new rows being added
                    if (mutation.type === 'childList') {
                        const activeRow = grid.querySelector('tr.ui-state-highlight');
                        if (activeRow && activeRow.id && activeRow.id !== _lastSelectedId) {
                            _lastSelectedId = activeRow.id;
                            onSelect(activeRow.id);
                        }
                    }
                }
            });

            _observer.observe(grid, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class']
            });
        }

        startObserving();
    }

    return {
        init
    };
})();

window.VNPTRowObserver = VNPTRowObserver;
