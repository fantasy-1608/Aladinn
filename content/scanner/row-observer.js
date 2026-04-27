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
     * Lấy patient ID từ row của grid ngoại trú (#grdDSBenhNhan)
     * Row ID ngoại trú là số thứ tự, cần lấy KHAMBENHID từ cell
     * @param {HTMLElement} tr
     * @returns {string|null}
     */
    function getOutpatientRowId(tr) {
        const cell = tr.querySelector(
            "td[aria-describedby$='_KHAMBENHID'], td[aria-describedby*='KHAMBENHID']"
        );
        const id = cell ? cell.textContent.trim() : '';
        return id.length > 2 ? id : null;
    }

    /**
     * Initialize listeners for patient selection
     * @param {Function} onSelect - Callback when a patient is selected
     */
    function init(onSelect) {
        // 1. Mouse Click Listener (primary) — hỗ trợ cả nội trú và ngoại trú
        document.addEventListener('mousedown', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            if (!target) return;

            const tr = target.closest('tr.ui-widget-content');
            if (!tr) return;

            // Grid nội trú
            if (tr.closest('#grdBenhNhan') && tr.id && tr.id.length > 5) {
                _lastSelectedId = tr.id;
                onSelect(tr.id);
                return;
            }

            // Grid ngoại trú
            if (tr.closest('#grdDSBenhNhan')) {
                const pid = getOutpatientRowId(tr);
                if (pid && pid !== _lastSelectedId) {
                    _lastSelectedId = pid;
                    onSelect(pid);
                }
            }
        }, true);

        // 2. MutationObserver: Watch for class changes on grid rows
        function startObserving() {
            // Grid nội trú
            const inpatientGrid = document.querySelector('#grdBenhNhan');
            if (inpatientGrid && !inpatientGrid._aladinnObserved) {
                inpatientGrid._aladinnObserved = true;
                const obs = new MutationObserver((mutations) => {
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
                        if (mutation.type === 'childList') {
                            const activeRow = inpatientGrid.querySelector('tr.ui-state-highlight');
                            if (activeRow && activeRow.id && activeRow.id !== _lastSelectedId) {
                                _lastSelectedId = activeRow.id;
                                onSelect(activeRow.id);
                            }
                        }
                    }
                });
                obs.observe(inpatientGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
                if (_observer) _observer.disconnect();
                _observer = obs;
            }

            // Grid ngoại trú
            const outpatientGrid = document.querySelector('#grdDSBenhNhan');
            if (outpatientGrid && !outpatientGrid._aladinnObserved) {
                outpatientGrid._aladinnObserved = true;
                const obs = new MutationObserver((mutations) => {
                    for (const mutation of mutations) {
                        if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                            const target = mutation.target;
                            if (target.tagName === 'TR' && target.classList.contains('ui-state-highlight')) {
                                const pid = getOutpatientRowId(target);
                                if (pid && pid !== _lastSelectedId) {
                                    _lastSelectedId = pid;
                                    onSelect(pid);
                                }
                            }
                        }
                        if (mutation.type === 'childList') {
                            const activeRow = outpatientGrid.querySelector('tr.ui-state-highlight');
                            if (activeRow) {
                                const pid = getOutpatientRowId(activeRow);
                                if (pid && pid !== _lastSelectedId) {
                                    _lastSelectedId = pid;
                                    onSelect(pid);
                                }
                            }
                        }
                    }
                });
                obs.observe(outpatientGrid, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
            }

            // Nếu chưa tìm thấy grid nào, retry
            if (!inpatientGrid && !outpatientGrid) {
                setTimeout(startObserving, 2000);
            }
        }

        startObserving();
    }

    return {
        init
    };
})();

window.VNPTRowObserver = VNPTRowObserver;
