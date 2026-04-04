/**
 * 🧞 Aladinn — Sign Module: Filter
 * Search, Filter by Creator, Checkbox injection
 * Ported from SignHis v4.1.0
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.Filter = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    /**
     * Filter by creator name & ID
     */
    function filterByCreator(userName, userId) {
        const DOM = window.Aladinn?.Sign?.DOM;
        const UI = window.Aladinn?.Sign?.UI;
        const $ = window.hisJQuery || window.jQuery;
        if (!$ || !DOM) return;

        if (Logger) Logger.info('Sign', 'Filtering by:', userName, userId);

        // 1. Set text box
        const txtUser = $(DOM.INPUTS.USER_NAME);
        if (txtUser.length) txtUser.val(userName);

        // 2. Set User ID to dropdown
        const cboUserId = $(DOM.INPUTS.USER_ID_SELECT);
        if (cboUserId.length) {
            let optionExists = false;
            cboUserId.find('option').each(function () {
                if ($(this).val() === String(userId)) {
                    optionExists = true;
                    return false;
                }
            });

            if (!optionExists) {
                cboUserId.append($('<option></option>').attr('value', userId).text(userName));
            }
            cboUserId.val(String(userId));
        }

        // 3. Click search
        setTimeout(() => {
            const btn = $(DOM.BUTTONS.SEARCH).first();
            if (btn.length) {
                btn.trigger('click');
                if (UI) UI.showToast('Đang lọc hồ sơ của bạn...');

                setTimeout(highlightUnsignedRecords, 500);
            }
        }, 100);
    }

    /**
     * Highlight unsigned records in the result grid
     */
    function highlightUnsignedRecords() {
        const DOM = window.Aladinn?.Sign?.DOM;
        const UI = window.Aladinn?.Sign?.UI;
        const $ = window.hisJQuery || window.jQuery;
        if (!$ || !DOM) return;

        const rows = $(DOM.GRIDS.RESULT_TABLE + ' tbody tr').filter(':has(td)');
        let unsignedCount = 0;

        rows.each(function () {
            const $row = $(this);
            const cells = $row.find('td');

            cells.each(function () {
                const text = $(this).text().trim();
                if (/^0\/\d+$/.test(text) || text === '0/0') {
                    $row.css({ 'background-color': '#fff3cd !important', 'background': '#fff3cd' });
                    $row.addClass('his-unsigned-row');
                    unsignedCount++;
                    return false;
                }
            });
        });

        if (unsignedCount > 0 && UI) {
            UI.showToast(`Đã đánh dấu ${unsignedCount} hồ sơ chưa ký số 🔔`);
        }
    }

    // === CHECKBOX INJECTION LOGIC ===

    /**
     * Inject checkboxes into #grdBenhNhan
     */
    function injectCheckboxes(onCheckboxChange) {
        const DOM = window.Aladinn?.Sign?.DOM;
        if (!DOM) { console.warn('[Aladinn Sign] DOM constants not loaded'); return; }

        // Try multiple selectors to find the actual data table
        const selectors = ['#grdBenhNhan', '#tblGridKetQua', '#grdDanhSach', '.ui-jqgrid-btable'];
        let table = null;
        let usedSelector = '';

        for (const sel of selectors) {
            const candidate = document.querySelector(sel);
            if (candidate) {
                // Verify this table actually has data rows
                const testRows = candidate.querySelectorAll('tr.jqgrow, tr.ui-widget-content');
                if (testRows.length > 0) {
                    table = candidate;
                    usedSelector = sel;
                    break;
                }
            }
        }

        if (!table) {
            console.warn('[Aladinn Sign] No data table found. Available tables:', 
                selectors.map(s => `${s}: ${document.querySelector(s) ? 'exists' : 'missing'}`).join(', '));
            return;
        }

        console.log(`[Aladinn Sign] Found grid table via "${usedSelector}"`);

        const rows = table.querySelectorAll('tr.jqgrow, tr.ui-widget-content');
        let injectedCount = 0;

        rows.forEach(row => {
            if (row.cells.length === 0) return;
            const firstCell = row.cells[0];

            if (firstCell.querySelector('.his-checkbox')) return;

            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'his-checkbox';
            checkbox.dataset.rowId = row.id;

            checkbox.addEventListener('click', (e) => {
                e.stopPropagation();
                if (onCheckboxChange) onCheckboxChange();
            });

            firstCell.insertBefore(checkbox, firstCell.firstChild);
            injectedCount++;
        });

        console.log(`[Aladinn Sign] Injected ${injectedCount} checkboxes into ${rows.length} rows`);

        injectSelectAllCheckbox(onCheckboxChange);
    }

    function injectSelectAllCheckbox(onCheckboxChange) {
        const DOM = window.Aladinn?.Sign?.DOM;
        if (!DOM) return;

        const filterRow = document.querySelector('.ui-jqgrid-hdiv .ui-search-toolbar') ||
            document.querySelector('.ui-search-toolbar');

        if (!filterRow || !filterRow.cells[0]) return;
        if (document.getElementById('his-select-all')) return;

        const targetCell = filterRow.cells[0];
        const selectAllCb = document.createElement('input');
        selectAllCb.type = 'checkbox';
        selectAllCb.id = 'his-select-all';
        selectAllCb.className = 'his-checkbox';

        selectAllCb.addEventListener('click', (e) => e.stopPropagation());

        selectAllCb.addEventListener('change', function () {
            const isChecked = this.checked;
            document.querySelectorAll(DOM.GRIDS.PATIENT_LIST + ' .his-checkbox:not(#his-select-all)').forEach(cb => {
                cb.checked = isChecked;
            });
            if (onCheckboxChange) onCheckboxChange();
        });

        targetCell.innerHTML = '';
        targetCell.appendChild(selectAllCb);
    }

    return {
        filterByCreator,
        highlightUnsignedRecords,
        injectCheckboxes
    };
})();

console.log('[Aladinn] 🧞 Sign filter loaded');
