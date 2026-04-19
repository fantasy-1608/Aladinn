/**
 * 🧞 Aladinn — Sign Module: Signing Workflow
 * Core signing logic: session management, auto-sign, patient processing
 * Ported from SignHis v4.1.0
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.Signing = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    // State
    const WORKFLOW = {
        queue: [],
        currentIndex: -1,
        isActive: false,
        stats: { completed: 0, skipped: 0 }
    };

    // Auto-sign State (manual sign flow + auto-confirm & auto-OK)
    const AUTO_SIGN = {
        isEnabled: true,
        hasClickedConfirm: false,
        hasClickedOk: false,
        lastConfirmTime: 0,
        lastOkTime: 0,
        observer: null,
        signCompleted: false
    };

    function _dom() { return window.Aladinn?.Sign?.DOM; }
    function _utils() { return window.Aladinn?.Sign?.Utils; }
    function _ui() { return window.Aladinn?.Sign?.UI; }

    /**
     * Start the signing session
     */
    function startSession() {
        const UI = _ui();
        WORKFLOW.queue = [];

        // Save creator name
        const creatorInput = document.getElementById('his-creator-filter');
        if (creatorInput) {
            const val = creatorInput.value.trim();
            chrome.storage.sync.set({ 'lastCreatorName': val });
        }

        // Collect selected rows
        document.querySelectorAll('.his-checkbox:checked:not(#his-select-all)').forEach(cb => {
            WORKFLOW.queue.push(cb.dataset.rowId);
        });

        if (WORKFLOW.queue.length === 0) return;

        WORKFLOW.isActive = true;
        window.__aladinnSigningActive = true;
        WORKFLOW.currentIndex = -1;
        WORKFLOW.stats.completed = 0;
        WORKFLOW.stats.skipped = 0;

        AUTO_SIGN.hasClickedConfirm = false;
        AUTO_SIGN.hasClickedOk = false;
        AUTO_SIGN.signCompleted = false;

        if (UI) {
            UI.toggleView('process');
            UI.setSigningActive(true);
            UI.clearPatientHistory();
            UI.updateStats(0, WORKFLOW.queue.length, 0, 0);
            UI.showSigningHUD();
        }

        enableAutoOkDetection();
        processNextPatient(false);
    }

    /**
     * Stop the session
     */
    function stopSession() {
        const UI = _ui();
        WORKFLOW.isActive = false;
        window.__aladinnSigningActive = false;
        WORKFLOW.queue = [];

        // Close any open modal/dialog before stopping
        tryCloseModal();

        disableAutoOkDetection();

        if (UI) {
            UI.toggleView('start');
        }

        document.querySelectorAll('.his-checkbox').forEach(cb => cb.checked = false);
        const selectAll = document.getElementById('his-select-all');
        if (selectAll) selectAll.checked = false;

        if (UI) {
            UI.hidePanel();
            UI.setSigningActive(false);
            UI.hideSigningHUD();
            UI.showToast('⏹ Phiên làm việc đã kết thúc.');
        }
    }

    /**
     * Extract patient name from a table row
     */
    function getPatientNameFromRow(row) {
        if (!row) return null;
        let patientName = '';
        const cells = row.querySelectorAll('td');

        for (const cell of cells) {
            const ariaDesc = cell.getAttribute('aria-describedby') || '';
            if (ariaDesc.includes('TENBENHNHAN') || ariaDesc.includes('TenBenhNhan') ||
                ariaDesc.includes('_TEN_') || ariaDesc.endsWith('_TEN')) {
                patientName = cell.innerText.trim();
                break;
            }
        }

        if (!patientName && cells.length > 3) {
            let maxLen = 0;
            for (let i = 2; i < Math.min(cells.length, 6); i++) {
                const text = cells[i].innerText.trim();
                if (text.length > maxLen && !/^\d+$/.test(text) && text.length > 3) {
                    maxLen = text.length;
                    patientName = text;
                }
            }
        }
        return patientName || null;
    }

    /**
     * Save patient to session history
     */
    async function saveToSessionHistory(patientName) {
        try {
            const result = await chrome.storage.sync.get(['sessionHistory']);
            const history = result.sessionHistory || [];
            history.unshift({
                name: patientName,
                time: new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })
            });
            if (history.length > 20) history.length = 20;
            await chrome.storage.sync.set({ sessionHistory: history });
        } catch (e) {
            if (Logger) Logger.error('Sign', 'Error saving history:', e);
        }
    }

    /**
     * Process next patient
     */
    async function processNextPatient(shouldClosePrevious, isAutoSkip = false) {
        if (!WORKFLOW.isActive) return;
        const Utils = _utils();
        const UI = _ui();

        // 0. Always close current modal before navigating to next patient
        if (WORKFLOW.currentIndex >= 0) {
            tryCloseModal();
            if (Utils) {
                await Utils.waitForCondition(() => {
                    const modal = document.querySelector('.jBox-container, .ui-dialog, .modal.show');
                    return !modal || modal.offsetWidth === 0;
                }, { timeout: 2000, interval: 30 });
            }
        }

        // 1. Handle previous patient
        if (WORKFLOW.currentIndex >= 0) {
            const prevRowId = WORKFLOW.queue[WORKFLOW.currentIndex];
            const prevRow = document.getElementById(prevRowId);
            const prevPatientName = getPatientNameFromRow(prevRow) || `Bệnh nhân #${WORKFLOW.currentIndex + 1}`;

            if (shouldClosePrevious) {
                if (prevRow) {
                    prevRow.classList.add('his-processed-row');
                    const cb = prevRow.querySelector('.his-checkbox');
                    if (cb) cb.checked = false;
                }
                WORKFLOW.stats.completed++;
                if (UI) UI.addPatientToHistory(prevPatientName, 'signed');
                saveToSessionHistory(prevPatientName);
            } else if (isAutoSkip) {
                if (prevRow) {
                    prevRow.classList.add('his-skipped-row');
                    const cb = prevRow.querySelector('.his-checkbox');
                    if (cb) cb.checked = false;
                }
                WORKFLOW.stats.skipped++;
            }
        }

        // 2. Move next
        WORKFLOW.currentIndex++;

        if (WORKFLOW.currentIndex >= WORKFLOW.queue.length) {
            if (UI) UI.showToast(`✅ Hoàn thành! Ký: ${WORKFLOW.stats.completed}, Bỏ: ${WORKFLOW.stats.skipped}`);
            stopSession();
            return;
        }

        // 3. Process current
        if (UI) UI.updateStats(WORKFLOW.currentIndex + 1, WORKFLOW.queue.length, WORKFLOW.stats.completed, WORKFLOW.stats.skipped);

        const rowId = WORKFLOW.queue[WORKFLOW.currentIndex];
        const row = document.getElementById(rowId);

        if (row) {
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            document.querySelectorAll('.his-processing-row').forEach(el => el.classList.remove('his-processing-row'));
            row.classList.add('his-processing-row');

            const patientName = getPatientNameFromRow(row);
            if (patientName && UI) UI.setCurrentPatientName(patientName);

            setTimeout(() => {
                const creatorInput = document.getElementById('his-creator-filter');
                const creatorName = creatorInput ? creatorInput.value.trim() : '';

                row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, view: window }));

                if (creatorName && Utils) {
                    setTimeout(() => simulateTypingInModal(creatorName), Utils.CONSTANTS.DELAY_TYPE_IN_MODAL);
                }
            }, Utils ? Utils.CONSTANTS.DELAY_DBLCLICK : 100);
        } else {
            if (Logger) Logger.error('Sign', 'Row not found:', rowId);
            processNextPatient(false, true);
        }

        AUTO_SIGN.hasClickedOk = false;
        AUTO_SIGN.signCompleted = false;
    }

    /**
     * Simulate Typing logic
     */
    function simulateTypingInModal(creatorName) {
        const DOM = _dom();
        if (!DOM) return;

        const allIframes = Array.from(document.querySelectorAll(DOM.CONTAINERS.MAIN_VIEW));
        const visibleIframes = allIframes.filter(f => f.offsetWidth > 0 && f.offsetHeight > 0);
        const iframe = visibleIframes[visibleIframes.length - 1];

        if (!iframe) return;

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const iframeWin = iframe.contentWindow;
        const creatorInput = iframeDoc.getElementById(DOM.INPUTS.HIS_CREATOR_FILTER);

        if (!creatorInput) {
            setTimeout(() => simulateTypingInModal(creatorName), 500);
            return;
        }

        const $ = iframeWin.jQuery || iframeWin.$;

        creatorInput.focus();
        creatorInput.value = '';

        if (creatorName.length > 1) {
            const firstPart = creatorName.slice(0, -1);
            const lastChar = creatorName.slice(-1);

            creatorInput.value = firstPart;
            if ($) { $(creatorInput).trigger('input'); }
            else { creatorInput.dispatchEvent(new Event('input', { bubbles: true })); }

            setTimeout(() => {
                typeLastChar(creatorInput, lastChar, $, () => {
                    afterTypingComplete(creatorInput, $, iframeDoc, iframe);
                });
            }, 30);
        } else {
            typeLastChar(creatorInput, creatorName, $, () => {
                afterTypingComplete(creatorInput, $, iframeDoc, iframe);
            });
        }
    }

    function typeLastChar(input, char, $, callback) {
        const keyCode = char.charCodeAt(0);
        input.value += char;

        if ($) {
            const $input = $(input);
            $input.trigger($.Event('keydown', { keyCode, which: keyCode, key: char }));
            $input.trigger($.Event('keypress', { keyCode, which: keyCode, key: char, charCode: keyCode }));
            $input.trigger('input');
            $input.trigger($.Event('keyup', { keyCode, which: keyCode, key: char }));
        } else {
            input.dispatchEvent(new KeyboardEvent('keydown', { key: char, keyCode, bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keypress', { key: char, keyCode, charCode: keyCode, bubbles: true }));
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new KeyboardEvent('keyup', { key: char, keyCode, bubbles: true }));
        }

        if (callback) setTimeout(callback, 30);
    }

    function afterTypingComplete(creatorInput, $, iframeDoc, iframe) {
        const Utils = _utils();

        triggerEnterKey(creatorInput, $);

        try {
            const $grid = $('[id*="gridPhieu"]', iframeDoc);
            if ($grid.length && $grid[0].triggerToolbar) {
                $grid[0].triggerToolbar();
            }
        } catch (_e) { /* Error triggering toolbar */ }

        setTimeout(() => { creatorInput.blur(); }, 100);

        selectUnsignedStatus(iframeDoc);

        setTimeout(() => checkAndAutoCloseIfEmpty(iframe), Utils ? Utils.CONSTANTS.DELAY_CHECK_GRID : 600);
    }

    function triggerEnterKey(input, $) {
        if ($) {
            const $input = $(input);
            $input.trigger($.Event('keydown', { keyCode: 13, which: 13, key: 'Enter' }));
            $input.trigger($.Event('keypress', { keyCode: 13, which: 13, key: 'Enter' }));
            $input.trigger($.Event('keyup', { keyCode: 13, which: 13, key: 'Enter' }));
        } else {
            const enterOptions = { key: 'Enter', keyCode: 13, which: 13, bubbles: true };
            input.dispatchEvent(new KeyboardEvent('keydown', enterOptions));
            input.dispatchEvent(new KeyboardEvent('keypress', enterOptions));
            input.dispatchEvent(new KeyboardEvent('keyup', enterOptions));
        }
    }

    function selectUnsignedStatus(doc) {
        const DOM = _dom();
        if (!DOM) return;

        const statusSelect = doc.querySelector(DOM.INPUTS.STATUS_SELECT);
        if (!statusSelect) return;

        const options = statusSelect.querySelectorAll('option');
        let targetValue = null;

        options.forEach(opt => {
            const text = opt.textContent.toLowerCase();
            if (text.includes('chưa ký') || text.includes('chua ky') || text === '0') {
                targetValue = opt.value;
            }
        });

        if (targetValue !== null) {
            statusSelect.value = targetValue;
            statusSelect.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    async function checkAndAutoCloseIfEmpty(iframe) {
        const Utils = _utils();
        const UI = _ui();
        const DOM = _dom();

        if (!Utils || !DOM) return;

        const gridReady = await Utils.waitForGridReady(iframe, 8000);

        if (!gridReady) {
            if (UI) UI.showToast('⚠️ Timeout - tự động chuyển tiếp');
            closeModalAndMoveNext();
            return;
        }

        const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
        const rows = iframeDoc.querySelectorAll(DOM.GRIDS.DOCUMENT_LIST + ' tr.jqgrow');

        if (rows.length === 0) {
            if (UI) UI.showToast('⏭️ Không có phiếu - Tự động chuyển tiếp');
            closeModalAndMoveNext();
        } else {
            const visibleRows = Array.from(rows).filter(row => {
                const style = window.getComputedStyle(row);
                return style.display !== 'none' && style.visibility !== 'hidden';
            });

            if (visibleRows.length === 0) {
                if (UI) UI.showToast('⏭️ Không có phiếu phù hợp - Tự động chuyển tiếp');
                closeModalAndMoveNext();
            } else {
                try {
                    const result = verifyCreator(visibleRows);
                    if (result.noCreatorName || (result.mismatched === 0 && result.matched > 0)) {
                        if (!result.noCreatorName && UI) {
                            UI.showToast(`✅ ${result.matched} phiếu khớp người tạo — Chọn phiếu rồi nhấn Ký số.`);
                        } else if (UI) {
                            UI.showToast(`✓ Có ${visibleRows.length} phiếu cần ký — Chọn phiếu rồi nhấn Ký số.`);
                        }
                    } else if (result.mismatched > 0) {
                        // Auto-skip: Người tạo không khớp → tự động bỏ qua
                        if (Logger) Logger.warn('Sign', `Creator mismatch: ${result.mismatched} phiếu không khớp. Auto-skipping...`);
                        if (UI) {
                            UI.showToast(`⏩ Người tạo không khớp (${result.mismatched} phiếu) — Tự động bỏ qua`);
                        }
                        closeModalAndMoveNext();
                        return;
                    }
                } catch (_verifyError) {
                    if (UI) UI.showToast(`✓ Có ${visibleRows.length} phiếu cần ký — Chọn phiếu rồi nhấn Ký số.`);
                }
            }
        }
    }

    function getCreatorFromRow(row) {
        const cells = row.querySelectorAll('td');

        for (const cell of cells) {
            const ariaDesc = cell.getAttribute('aria-describedby') || '';
            if (ariaDesc.toUpperCase().includes('NGUOITAO') ||
                ariaDesc.toUpperCase().includes('NGUOI_TAO')) {
                const text = cell.textContent.trim();
                if (text) return text;
            }
        }

        if (cells.length >= 3) {
            const lastCell = cells[cells.length - 1];
            const lastText = lastCell.textContent.trim();
            if (lastText && lastText.length > 3 && !/^\d+$/.test(lastText) && !/^\d{2}\//.test(lastText)) {
                return lastText;
            }
        }

        return null;
    }

    function verifyCreator(visibleRows) {
        const creatorInput = document.getElementById('his-creator-filter');
        const expectedName = creatorInput ? creatorInput.value.trim() : '';

        const result = { matched: 0, mismatched: 0, mismatchDetails: [], matchedRows: [], noCreatorName: false };

        if (!expectedName) {
            result.noCreatorName = true;
            return result;
        }

        for (const row of visibleRows) {
            const creator = getCreatorFromRow(row);

            if (!creator) {
                result.matched++;
                result.matchedRows.push(row);
                continue;
            }

            if (creator === expectedName) {
                result.matched++;
                result.matchedRows.push(row);
            } else {
                result.mismatched++;
                result.mismatchDetails.push({ row, creator, expected: expectedName });
            }
        }

        return result;
    }

    // Row click listener removed — user now manually clicks sign button in HIS

    // autoClickSignButton removed — user now manually clicks sign button in HIS

    async function closeModalAndMoveNext() {
        const Utils = _utils();
        tryCloseModal();

        if (Utils) {
            await Utils.waitForCondition(() => {
                const modal = document.querySelector('.jBox-container, .ui-dialog, .modal.show');
                return !modal || modal.offsetWidth === 0;
            }, { timeout: 2000, interval: 30 });
        }

        processNextPatient(false, true);
    }

    /**
     * Try to close the currently active modal.
     * SAFE: Only searches within identified modal containers, never the full page.
     */
    function tryCloseModal() {
        const Logger = window.Aladinn?.Logger;

        // Step 1: Find the active modal container
        const modalSelectors = [
            '.jBox-container', '.jBox-Confirm',
            '.ui-dialog', '.modal.show',
            '[role="dialog"]:not([aria-hidden="true"])',
            '.popup-overlay:not(.hidden)', '.popup-content'
        ];

        const closeSelectors = [
            '.jBox-closeButton',
            '.ui-dialog-titlebar-close', 'button.ui-dialog-titlebar-close',
            '.ui-icon-closethick', '.ui-button[title="Close"]',
            '#btnDONG', '#btnClose', '.btnClose',
            'button[onclick*="close"]', 'a[onclick*="close"]',
            '[aria-label="close"]', '[aria-label="Close"]',
            '.modal .close', '.btn-close',
            'button[title="Đóng"]', 'button[title="Close"]',
            '.close-btn', '.closeBtn',
            '.modal-header .close', '.dialog-header .close',
            'button:has(.fa-times)', 'button:has(.fa-close)',
            'span.ui-icon-close'
        ];

        let closed = false;

        // Step 2: Search for close buttons ONLY within active modal containers
        for (const modalSel of modalSelectors) {
            try {
                const modals = document.querySelectorAll(modalSel);
                for (const modal of modals) {
                    if (!isVisible(modal)) continue;

                    for (const closeSel of closeSelectors) {
                        try {
                            const btn = modal.querySelector(closeSel);
                            if (btn && isVisible(btn)) {
                                if (Logger) Logger.debug('Sign', `[SafeClick] Closing modal via ${closeSel} in ${modalSel}`);
                                btn.click();
                                closed = true;
                                break;
                            }
                        } catch (_e) { /* ignore safeclick error */ }
                    }

                    // If no close button found via selector, try text-based search WITHIN this modal only
                    if (!closed) {
                        const modalClickables = modal.querySelectorAll('button, a, [role="button"], .ui-button');
                        for (const el of modalClickables) {
                            const text = (el.textContent || '').trim();
                            const title = (el.getAttribute('title') || '').toLowerCase();
                            if ((text === 'x' || text === '×' || text === 'Đóng' || text === 'đóng' || text === 'Close' ||
                                title.includes('đóng') || title.includes('close')) && isVisible(el)) {
                                if (Logger) Logger.debug('Sign', `[SafeClick] Closing modal via text match "${text}" in ${modalSel}`);
                                el.click();
                                closed = true;
                                break;
                            }
                        }
                    }

                    if (closed) break;
                }
            } catch (_e) { /* ignore modal search error */ }
            if (closed) break;
        }

        // Step 3: Check iframes for modals (restricted to modal containers inside iframes)
        if (!closed) {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const iframeDoc = iframe.contentDocument || iframe.contentWindow.document;
                    for (const modalSel of modalSelectors) {
                        const modal = iframeDoc.querySelector(modalSel);
                        if (!modal || !isVisible(modal)) continue;

                        for (const closeSel of closeSelectors) {
                            try {
                                const btn = modal.querySelector(closeSel);
                                if (btn && isVisible(btn)) {
                                    if (Logger) Logger.debug('Sign', `[SafeClick] Closing iframe modal via ${closeSel}`);
                                    btn.click();
                                    closed = true;
                                    break;
                                }
                            } catch (_e) { /* ignore safeclick error inside iframe */ }
                        }
                        if (closed) break;
                    }
                } catch (_e) { /* ignore iframe search error */ }
                if (closed) break;
            }
        }

        // Step 4: Final fallback — only Escape key (never scan entire page)
        if (!closed) {
            if (Logger) Logger.warn('Sign', '[SafeClick] No close button found in modal — sending Escape key');
            document.body.dispatchEvent(new KeyboardEvent('keydown', {
                key: 'Escape', keyCode: 27, code: 'Escape', bubbles: true, cancelable: true
            }));
            const $ = window.jQuery || window.$;
            if ($) {
                $(document).trigger($.Event('keydown', { keyCode: 27, which: 27 }));
            }
        }
    }

    function isVisible(el) {
        if (!el) return false;
        const style = window.getComputedStyle(el);
        return style.display !== 'none' && style.visibility !== 'hidden' &&
            style.opacity !== '0' && el.offsetWidth > 0 && el.offsetHeight > 0;
    }

    // === AUTO BUTTON DETECTION ===
    // After user manually clicks "Ký số", the system auto-detects:
    //   1. "Xác nhận" button (e-Seal/Smart CA confirm) → auto-click
    //   2. "OK/Đồng ý" button (sign success dialog) → auto-click + mark complete

    function enableAutoOkDetection() {
        if (AUTO_SIGN.observer) return;

        // Also notify background to enable PDF tab auto-close
        chrome.runtime.sendMessage({ action: 'enableAutoSign' });

        let _debounceTimer = null;
        function debouncedCheck() {
            if (_debounceTimer) clearTimeout(_debounceTimer);
            _debounceTimer = setTimeout(() => checkForButtons(), 150);
        }

        AUTO_SIGN.observer = new MutationObserver(debouncedCheck);
        AUTO_SIGN.observer.observe(document.body, { childList: true, subtree: true });
    }

    function disableAutoOkDetection() {
        if (AUTO_SIGN.observer) {
            AUTO_SIGN.observer.disconnect();
            AUTO_SIGN.observer = null;
        }
        try { chrome.runtime.sendMessage({ action: 'disableAutoSign' }); } catch (_e) { /* */ }
    }

    // === STANDALONE AUTO-CLICKER ===
    // Searches main document + all accessible iframes for target buttons.
    // HIS opens modals as new iframes, so recursive iframe search is essential.
    function _findBtnById(selector) {
        try {
            const el = document.querySelector(selector);
            if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
        } catch (_e) { /* */ }
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                const el = doc.querySelector(selector);
                if (el && el.offsetWidth > 0 && el.offsetHeight > 0) return el;
                // Go one level deeper
                const innerIframes = doc.querySelectorAll('iframe');
                for (const inner of innerIframes) {
                    try {
                        const innerDoc = inner.contentDocument || inner.contentWindow.document;
                        const innerEl = innerDoc.querySelector(selector);
                        if (innerEl && innerEl.offsetWidth > 0 && innerEl.offsetHeight > 0) return innerEl;
                    } catch (_e) { /* cross-origin */ }
                }
            } catch (_e) { /* cross-origin */ }
        }
        return null;
    }

    function _findBtnByText(texts) {
        const docs = [document];
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try { docs.push(iframe.contentDocument || iframe.contentWindow.document); } catch (_e) { /* */ }
        }
        for (const doc of docs) {
            try {
                const btns = doc.querySelectorAll('button, a.btn, input[type="button"], [role="button"]');
                for (const btn of btns) {
                    if (btn.offsetWidth === 0 || btn.offsetHeight === 0) continue;
                    const t = (btn.textContent || btn.value || '').trim();
                    if (texts.some(s => t.includes(s))) return btn;
                }
            } catch (_e) { /* */ }
        }
        return null;
    }

    // Polling loop — runs every 400ms, completely independent
    setInterval(() => {
        if (!AUTO_SIGN.isEnabled) return;
        // Chỉ auto-click khi đang trong phiên ký số
        if (!WORKFLOW.isActive) return;
        const now = Date.now();
        const UI = _ui();

        // STEP 1: Auto-click "Xác nhận" (#btnConfirm)
        if (!AUTO_SIGN.hasClickedConfirm && (now - AUTO_SIGN.lastConfirmTime > 800)) {
            const btn = _findBtnById('#btnConfirm') || _findBtnByText(['Xác nhận', 'Chấp nhận']);
            if (btn) {
                // --- Kiểm tra bảng có nhiều lựa chọn (Nhiều mức ký) ---
                const doc = btn.ownerDocument || document;
                const selects = doc.querySelectorAll('select');
                let visibleCount = 0;
                let hasUnselected = false;
                for (const el of selects) {
                    if (el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled) {
                        visibleCount++;
                        const text = el.options[el.selectedIndex]?.text || '';
                        if (!el.value || el.value === '0' || text.toLowerCase().includes('lựa chọn') || text.includes('--')) {
                            hasUnselected = true;
                        }
                    }
                }
                if (visibleCount > 1 || hasUnselected) {
                    if (UI && (now - AUTO_SIGN.lastConfirmTime > 5000)) {
                        UI.showToast('⚠️ Vui lòng CẤU HÌNH người ký và tự bấm Xác nhận', 'warning');
                        AUTO_SIGN.lastConfirmTime = now; // Giãn tần suất hiện Toast
                    }
                    return; // Dừng auto-click
                }
                // --------------------------------------------------------

                console.log('[Aladinn] 🖊️ Auto-click: Xác nhận');
                if (UI) UI.createClickRipple(btn);
                btn.click();
                AUTO_SIGN.hasClickedConfirm = true;
                AUTO_SIGN.lastConfirmTime = now;
                if (UI) UI.showToast('🖊️ Đang ký...');
                setTimeout(() => { try { chrome.runtime.sendMessage({ action: 'closePdfTab' }); } catch (_e) { /* */ } }, 800);
                return;
            }
        }

        // STEP 2: Auto-click "Đồng ý" (#alertify-ok)
        if (AUTO_SIGN.hasClickedOk && (now - AUTO_SIGN.lastOkTime > 3000)) {
            AUTO_SIGN.hasClickedOk = false;
            AUTO_SIGN.hasClickedConfirm = false;
        }
        if (AUTO_SIGN.hasClickedOk) return;

        if (now - AUTO_SIGN.lastOkTime > 1000) {
            const btn = _findBtnById('#alertify-ok') || _findBtnByText(['Đồng ý', 'Hoàn tất']);
            if (btn) {
                console.log('[Aladinn] ✅ Auto-click: Đồng ý');
                if (UI) UI.createClickRipple(btn);
                btn.click();
                AUTO_SIGN.hasClickedOk = true;
                AUTO_SIGN.lastOkTime = now;
                AUTO_SIGN.signCompleted = true;
                if (UI) UI.showToast('✅ Ký thành công!');
                setTimeout(() => { try { chrome.runtime.sendMessage({ action: 'closePdfTab' }); } catch (_e) { /* */ } }, 800);
            }
        }
    }, 400);

    function checkForButtons() { /* handled by setInterval */ }

    function setAutoSign(enabled) {
        AUTO_SIGN.isEnabled = enabled;
        if (Logger) Logger.info('Sign', `Auto-Sign: ${enabled}`);
    }

    // Initialize from storage
    if (chrome?.storage?.sync) {
        chrome.storage.sync.get(['autoSignEnabled'], (res) => {
            if (typeof res.autoSignEnabled !== 'undefined') {
                AUTO_SIGN.isEnabled = res.autoSignEnabled;
            }
        });
    }

    // Enable observation globally on load
    setTimeout(() => {
        if (AUTO_SIGN.isEnabled) enableAutoOkDetection();
    }, 1000);

    return {
        startSession,
        stopSession,
        processNextPatient,
        setAutoSign,
        getStats: () => WORKFLOW.stats,
        isActive: () => WORKFLOW.isActive
    };
})();

console.log('[Aladinn] 🧞 Sign signing loaded');
