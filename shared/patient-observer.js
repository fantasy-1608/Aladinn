/**
 * 🧞 Aladinn — Patient Observer (Trạm Quan Sát Bệnh Nhân)
 * MutationObserver DUY NHẤT cho grid bệnh nhân #grdBenhNhan.
 * Phát sự kiện qua HIS.EventBus khi bệnh nhân được chọn/thay đổi.
 *
 * Thay thế các observer trùng lặp trong:
 *   - scanner/row-observer.js
 *   - sign/sign-init.js
 *   - sign/signing.js
 *   - voice/ui.js
 *
 * Events phát ra:
 *   'patient:selected'   — { rowId, rowElement, patientName }
 *   'grid:reloaded'      — { rowCount }
 *   'grid:ready'         — { gridElement }
 */

window.HIS = window.HIS || {};

HIS.PatientObserver = (function () {
    'use strict';

    let _observer = null;
    let _lastSelectedId = '';
    let _isRunning = false;
    let _retryTimer = null;

    const SELECTED_ROW = 'tr.ui-state-highlight';

    /**
     * Lấy ID bệnh nhân (KHAMBENHID hoặc tr.id) tương ứng với loại grid
     */
    function _getRowId(tr) {
        if (!tr) return null;
        return tr.id && tr.id.length > 0 ? tr.id : null;
    }

    function _extractMaBA(tr) {
        if (!tr) return '';
        // 1. Thử lấy từ td chứa HOSOBENHANID hoặc MABENHAN
        const maBA = tr.querySelector("td[aria-describedby$='_MABENHAN'], td[aria-describedby$='_HOSOBENHANID']");
        if (maBA && maBA.textContent.trim()) {
            return maBA.textContent.trim();
        }
        // 2. Fallback: Lấy cột số chứa 8-12 chữ số
        const cells = tr.querySelectorAll('td');
        if (cells && cells.length > 2) {
            for (let i = 1; i < Math.min(5, cells.length); i++) {
                const txt = cells[i].textContent.trim();
                if (txt.length >= 8 && /^\d+$/.test(txt)) {
                    return txt;
                }
            }
        }
        return '';
    }

    /**
     * Lấy tên bệnh nhân từ row
     */
    function _extractPatientName(row) {
        if (!row) return '';
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
            const t = (cell.textContent || '').trim();
            if (t.length > 3 && /^[A-ZÀ-Ỹ]/.test(t) && !t.match(/^\d/) && t.includes(' ')) {
                return t;
            }
        }
        return '';
    }

    /**
     * Phát sự kiện khi phát hiện row mới được chọn
     */
    function _handleSelection(rowElement) {
        if (!rowElement) return;
        const rowId = _getRowId(rowElement);
        const maBA = _extractMaBA(rowElement) || rowId;
        if (!rowId || rowId === _lastSelectedId) return;

        _lastSelectedId = rowId;
        const patientName = _extractPatientName(rowElement);

        HIS.EventBus.emit('patient:selected', {
            rowId: rowId,
            maBA: maBA,
            rowElement: rowElement,
            patientName: patientName
        });

        // Broadcast to Side Panel
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
            chrome.runtime.sendMessage({ 
                type: 'CONTEXT_CHANGED', 
                context: 'PATIENT_LIST' 
            }).catch(() => {});
            
            chrome.runtime.sendMessage({ 
                type: 'PATIENT_SELECTED', 
                patientId: maBA,
                patientName: patientName
            }).catch(() => {});
        }

        if (HIS.Logger) {
            HIS.Logger.info('Observer', `👤 Đã chọn: ${patientName || rowId}`);
        }
    }

    /**
     * MutationObserver callback — xử lý thay đổi grid
     */
    function _onMutation(mutations) {
        const grid = document.querySelector('#grdBenhNhan') || document.querySelector('#grdDSBenhNhan');
        if (!grid) return;

        for (const mutation of mutations) {
            // Attribute change (class thay đổi = chọn row mới)
            if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
                const target = mutation.target;
                if (target.tagName === 'TR' && target.classList.contains('ui-state-highlight')) {
                    _handleSelection(target);
                    return; // Chỉ cần xử lý 1 lần
                }
            }

            // ChildList change (grid reload, thêm row mới)
            if (mutation.type === 'childList') {
                const activeRow = grid.querySelector(SELECTED_ROW);
                if (activeRow) {
                    _handleSelection(activeRow);
                }

                // Phát grid:reloaded nếu tbody thay đổi
                const rows = grid.querySelectorAll('tr.jqgrow, tr.ui-widget-content');
                if (rows.length > 0) {
                    HIS.EventBus.emit('grid:reloaded', { rowCount: rows.length });
                }
                return;
            }
        }
    }

    /**
     * Bắt đầu quan sát grid
     */
    function start() {
        if (_isRunning) return;

        function _tryAttach() {
            const grid = document.querySelector('#grdBenhNhan') || document.querySelector('#grdDSBenhNhan');
            if (!grid) {
                _retryTimer = setTimeout(_tryAttach, 2000);
                return;
            }

            if (_observer) _observer.disconnect();

            _observer = new MutationObserver(_onMutation);
            _observer.observe(grid, {
                childList: true,
                subtree: true,
                attributes: true,
                attributeFilter: ['class', 'aria-selected']
            });

            _isRunning = true;

            HIS.EventBus.emit('grid:ready', { gridElement: grid });

            if (HIS.Logger) {
                HIS.Logger.info('Observer', `🔭 Patient Observer đã khởi động (${grid.id})`);
            }

            // Kiểm tra xem đã có row nào được chọn sẵn chưa
            const activeRow = grid.querySelector(SELECTED_ROW);
            if (activeRow) {
                _handleSelection(activeRow);
            }
        }

        // Mouse click listener (primary — tức thì hơn MutationObserver)
        document.addEventListener('mousedown', (e) => {
            const target = /** @type {HTMLElement} */ (e.target);
            if (!target) return;

            const tr = target.closest('tr.ui-widget-content');
            if (tr) {
                const grid = tr.closest('#grdBenhNhan') || tr.closest('#grdDSBenhNhan');
                if (grid) {
                    _handleSelection(tr);
                }
            }
        }, true);

        _tryAttach();
    }

    /**
     * Dừng quan sát
     */
    function stop() {
        if (_observer) {
            _observer.disconnect();
            _observer = null;
        }
        if (_retryTimer) {
            clearTimeout(_retryTimer);
            _retryTimer = null;
        }
        _isRunning = false;
    }

    /**
     * Lấy row ID đang chọn hiện tại
     */
    function getCurrentSelection() {
        return _lastSelectedId;
    }

    /**
     * Re-emit patient:selected cho row đang chọn (bỏ qua _lastSelectedId check).
     * Dùng khi Scanner.init() register listener SAU PatientObserver.start() đã fire event.
     */
    function forceReselect() {
        const grid = document.querySelector('#grdBenhNhan') || document.querySelector('#grdDSBenhNhan');
        if (!grid) return;
        const activeRow = grid.querySelector(SELECTED_ROW);
        if (!activeRow) return;
        const rowId = _getRowId(activeRow);
        if (!rowId) return;

        // Force re-emit bất kể _lastSelectedId
        _lastSelectedId = rowId;
        const patientName = _extractPatientName(activeRow);

        HIS.EventBus.emit('patient:selected', {
            rowId: rowId,
            rowElement: activeRow,
            patientName: patientName
        });

        if (HIS.Logger) {
            HIS.Logger.debug('Observer', `🔄 Force re-select: ${patientName || rowId}`);
        }
    }

    return { start, stop, getCurrentSelection, forceReselect };
})();
