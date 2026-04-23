/**
 * 🧞 Aladinn — Sign Module: Initialization
 * Entry point that initializes the sign module
 * Ported from SignHis v4.1.0 content.js
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

(function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    // Ward page batch signing state
    const WARD_STATE = {
        queue: [],
        currentIndex: -1,
        isActive: false,
        pendingResolve: null,
        stats: { completed: 0, skipped: 0, failed: 0 }
    };

    let initAttempts = 0;
    const MAX_ATTEMPTS = 30;

    function waitForHIS() {
        initAttempts++;

        const isSignPage = window.location.href.includes('NTU01H100_BenhAnDienTu') || window.location.href.includes('ThongTinKySo') || window.location.href.includes('HSBA_DienTu');
        const isWardPage = window.location.href.includes('NTU02D021_BuongDieuTri');

        // On ward page (Buồng Điều Trị) → only init Advanced Sign
        if (isWardPage) {
            const hasGrid = document.querySelector('.ui-jqgrid-btable, #gview_list');
            if (hasGrid || initAttempts >= 5) {
                initAdvancedSignOnWardPage();
            } else if (initAttempts < MAX_ATTEMPTS) {
                setTimeout(waitForHIS, 500);
            }
            return;
        }

        // On signing page → full sign module
        if (!isSignPage) {
            if (Logger) Logger.debug('Sign', 'Not on allowed signing page, skipping sign module.');
            return;
        }

        // Use centralized selectors (fallback to HIS.Selectors.SIGN)
        const SEL = HIS?.Selectors?.SIGN;
        const hasPatientGrid = document.querySelector('#grdBenhNhan');
        const hasUserName = SEL ? document.querySelector(SEL.INPUTS.USER_NAME) : document.querySelector('#txtUSER_TK');
        const hasSearchBtn = SEL ? document.querySelector(SEL.BUTTONS.SEARCH) : document.querySelector('#btnTIMKIEM');

        if (hasPatientGrid || hasUserName || hasSearchBtn) {
            initSign();
        } else if (initAttempts < MAX_ATTEMPTS) {
            setTimeout(waitForHIS, 500);
        } else {
            if (Logger) Logger.debug('Sign', 'Not a HIS patient list grid, skipping sign module.');
        }
    }

    function initSign() {
        window.hisJQuery = window.jQuery || window.$;
        if (Logger) Logger.success('Sign', '✍️ Sign module initialized');

        const SmartDetection = window.Aladinn?.Sign?.SmartDetection;
        const Filter = window.Aladinn?.Sign?.Filter;
        const UI = window.Aladinn?.Sign?.UI;
        const Signing = window.Aladinn?.Sign?.Signing;

        if (UI) UI.showToast('Module Ký số đã kích hoạt trên trang này ✅', 3000);

        // 1. Start Smart Detection
        if (SmartDetection) SmartDetection.startMonitoring();

        // 2. Inject Workflow Controls
        if (UI) {
            UI.injectWorkflowControls({
                onStart: () => Signing && Signing.startSession(),
                onNext: () => Signing && Signing.processNextPatient(true),
                onSkip: () => Signing && Signing.processNextPatient(false),
                onStop: () => Signing && Signing.stopSession(),
                onRefresh: () => Filter && Filter.injectCheckboxes(onCheckboxChange)
            });
        }

        // 3. Setup grid monitoring
        setupGridMonitor();

        // 4. Smart Detection Event Listeners
        window.addEventListener('his-grid-empty-detected', () => {
            if (Filter) Filter.injectCheckboxes(onCheckboxChange);
        });

        // 5. Initialize Advanced Sign
        initAdvancedSign();
    }

    /**
     * Initialize Advanced Sign on the Ward page (Buồng Điều Trị)
     * This is a lightweight init — no full sign module, just the ⚡ button
     */
    function initAdvancedSignOnWardPage() {
        if (Logger) Logger.info('Sign', '⚡ Init Advanced Sign on Ward page');

        // Intercept JWT from page XHR
        interceptJWT();

        // Inject workflow panel for ward page
        injectWardPanel();

        // Inject checkboxes into ward patient grid (delay to let grid render)
        setTimeout(injectWardCheckboxes, 2000);

        // Re-inject on grid reloads
        if (HIS?.EventBus) {
            HIS.EventBus.on('grid:reloaded', () => setTimeout(injectWardCheckboxes, 500));
        }

        // MutationObserver fallback for grid changes
        setTimeout(() => {
            const gridContainer = document.querySelector('.ui-jqgrid-bdiv, .ui-jqgrid');
            if (gridContainer) {
                let debounce = null;
                const obs = new MutationObserver(() => {
                    clearTimeout(debounce);
                    debounce = setTimeout(injectWardCheckboxes, 300);
                });
                obs.observe(gridContainer, { childList: true, subtree: true });
            }
        }, 3000);
    }

    /**
     * Initialize the Advanced Sign feature on the Sign page
     */
    function initAdvancedSign() {
        const AdvSign = window.Aladinn?.Sign?.AdvancedSign;
        const AdvSignUI = window.Aladinn?.Sign?.AdvancedSignUI;

        if (!AdvSign || !AdvSignUI) {
            if (Logger) Logger.debug('Sign', 'Advanced Sign modules not available');
            return;
        }

        // On sign page, inject into workflow panel
        AdvSignUI.injectAdvancedButton(handleAdvancedSignClick);

        if (Logger) Logger.info('Sign', '⚡ Advanced Sign initialized on sign page');
        interceptJWT();
    }


    /**
     * Intercept JWT token from HIS page for API usage.
     * Scans script tags directly from content script (CSP-safe).
     */
    function interceptJWT() {
        const AdvSign = window.Aladinn?.Sign?.AdvancedSign;
        if (!AdvSign) return;
        if (AdvSign.getJwtToken()) return;

        function scanForJWT() {
            const scripts = document.querySelectorAll('script:not([src])');
            for (const s of scripts) {
                const text = s.textContent || '';
                if (!text.includes('eyJ')) continue;
                // Pattern: uuid: 'eyJ...' or uuid: "eyJ..." (no quotes around key)
                const m1 = text.match(/uuid\s*:\s*['"]?(eyJ[A-Za-z0-9_\-.]+)['"]?/);
                if (m1) return m1[1];
                // Pattern: _uuid = 'eyJ...'
                const m2 = text.match(/_uuid\s*=\s*['"]?(eyJ[A-Za-z0-9_\-.]+)['"]?/);
                if (m2) return m2[1];
                // Pattern: "uuid": "eyJ..."
                const m3 = text.match(/['"]uuid['"]\s*:\s*['"]?(eyJ[A-Za-z0-9_\-.]+)['"]?/);
                if (m3) return m3[1];
                // Broad fallback: any eyJ token ≥50 chars
                const m4 = text.match(/eyJ[A-Za-z0-9_\-.]{50,}/);
                if (m4) return m4[0];
            }
            return null;
        }

        const jwt = scanForJWT();
        if (jwt) {
            AdvSign.setJwtToken(jwt);
            if (Logger) Logger.info('Sign', 'JWT captured from DOM');
            return;
        }

        window.addEventListener('message', function onJWT(event) {
            if (event.data && event.data.type === 'ALADINN_HIS_UUID' && event.data.uuid) {
                AdvSign.setJwtToken(event.data.uuid);
                if (Logger) Logger.info('Sign', 'JWT from message');
                window.removeEventListener('message', onJWT);
            }
        });

        let retries = 0;
        const interval = setInterval(() => {
            retries++;
            if (AdvSign.getJwtToken() || retries > 30) { clearInterval(interval); return; }
            const token = scanForJWT();
            if (token) {
                AdvSign.setJwtToken(token);
                if (Logger) Logger.info('Sign', 'JWT captured (retry ' + retries + ')');
                clearInterval(interval);
            }
        }, 1000);
    }

    /**
     * Show a notice - uses Sign UI toast if available, else falls back to alert
     */
    function showNotice(msg) {
        const UI = window.Aladinn?.Sign?.UI;
        if (UI && UI.showToast) {
            UI.showToast(msg, 3000);
        } else {
            // Fallback: inject a temporary notification
            const el = document.createElement('div');
            el.style.cssText = 'position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:2147483647;background:rgba(15,23,42,0.95);color:#f1f5f9;padding:12px 24px;border-radius:12px;font-size:13px;font-weight:600;box-shadow:0 4px 20px rgba(0,0,0,0.3);backdrop-filter:blur(8px);border:1px solid rgba(99,102,241,0.3);font-family:Inter,-apple-system,sans-serif;';
            el.textContent = msg;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 3000);
        }
    }

    /**
     * Handler for ⚡ button click
     */
    async function handleAdvancedSignClick() {
        const AdvSign = window.Aladinn?.Sign?.AdvancedSign;
        const AdvSignUI = window.Aladinn?.Sign?.AdvancedSignUI;


        if (!AdvSign || !AdvSignUI) return;

        // Get the currently selected patient from the page
        // On the sign page (NTU01H100), get from the grid directly
        const isOnSignPage = window.location.href.includes('NTU01H100');

        if (isOnSignPage) {
            // We're on the signing page - use the selected row
            const selectedRow = document.querySelector('tr.ui-state-highlight');
            if (!selectedRow) {
                showNotice('⚠️ Chọn 1 bệnh nhân trước khi dùng Ký số nâng cao');
                return;
            }

            // Extract HOSOBENHANID and TIEPNHANID from jqGrid's userData
            try {
                const grid = window.hisJQuery?.('#grdBenhNhan') || window.jQuery?.('#grdBenhNhan');
                let rowData = null;
                if (grid && grid.jqGrid) {
                    const rowId = selectedRow.id;
                    rowData = grid.jqGrid('getRowData', rowId);
                }

                if (!rowData) {
                    showNotice('⚠️ Không thể trích xuất thông tin bệnh nhân. Thử double-click vào bệnh nhân.');
                    return;
                }

                await openAdvancedSignModal({
                    hosobenhanId: rowData.HOSOBENHANID,
                    tiepnhanId: rowData.TIEPNHANID,
                    mabenhan: rowData.MAHOSOBENHAN,
                    tenbenhnhan: rowData.TENBENHNHAN
                });
            } catch (err) {
                if (Logger) Logger.error('Sign', 'Error starting advanced sign', err);
                showNotice('❌ Lỗi: ' + (err.message || 'Không xác định'));
            }
        } else {
            // === WARD PAGE: QLBA-based workflow ===
            if (WARD_STATE.isActive) {
                showNotice('⚠️ Đang có phiên ký đang chạy. Vui lòng đợi.');
                return;
            }

            const checkedCbs = document.querySelectorAll('.aladinn-ward-cb:checked');
            let patientRows = [];

            if (checkedCbs.length > 0) {
                patientRows = Array.from(checkedCbs).map(cb => {
                    return document.getElementById(cb.dataset.rowId) || cb.closest('tr.jqgrow');
                }).filter(Boolean);
            } else {
                // Fallback: use currently highlighted row
                const highlightedRow = document.querySelector('tr.ui-state-highlight, tr.jqgrow.ui-state-highlight');
                if (highlightedRow) patientRows = [highlightedRow];
            }

            if (patientRows.length === 0) {
                showNotice('⚠️ Tick ☑ hoặc click chọn ít nhất 1 bệnh nhân');
                return;
            }

            // Show the panel and start
            const panel = document.getElementById('ward-workflow-panel');
            if (panel) panel.style.display = 'block';
            startWardBatchSigning(patientRows);
        }
    }

    /**
     * Open the Advanced Sign modal with document list
     */
    async function openAdvancedSignModal(patientInfo) {
        const AdvSign = window.Aladinn?.Sign?.AdvancedSign;
        const AdvSignUI = window.Aladinn?.Sign?.AdvancedSignUI;


        AdvSignUI.showLoading(patientInfo.tenbenhnhan);

        try {
            // Fetch all documents for this patient
            const allDocs = await AdvSign.fetchPatientDocuments(
                patientInfo.hosobenhanId,
                patientInfo.tiepnhanId
            );

            // Get current user name from page footer
            let currentUser = '';
            const userEl = document.querySelector('.his-user-name') ||
                           document.querySelector('#footer_username');
            if (userEl) currentUser = userEl.textContent.trim();

            // Fallback: check footer text
            if (!currentUser) {
                const footerText = document.body.innerText;
                const userMatch = footerText.match(/Người dùng:\s*([^\n-]+)/);
                if (userMatch) currentUser = userMatch[1].trim();
            }

            // Filter unsigned documents by current user
            const unsignedDocs = currentUser
                ? AdvSign.getUnsignedByCreator(allDocs, currentUser)
                : AdvSign.getAllUnsigned(allDocs);

            if (Logger) Logger.info('Sign',
                `Found ${allDocs.length} total docs, ${unsignedDocs.length} unsigned by "${currentUser}"`);

            // Show modal with results (sign page only — view-only)
            AdvSignUI.showModal(patientInfo, unsignedDocs, allDocs, (selectedDocs) => {
                if (!selectedDocs || selectedDocs.length === 0) return;
                AdvSignUI.hideModal();
                showNotice(`📋 Đã chọn ${selectedDocs.length} phiếu. Double-click bệnh nhân bên trái để ký.`);
            });
        } catch (err) {
            if (Logger) Logger.error('Sign', 'Error fetching documents', err);
            AdvSignUI.showError('Không thể tải danh sách phiếu: ' + (err.message || ''));
        }
    }

    function setupGridMonitor() {
        const Filter = window.Aladinn?.Sign?.Filter;

        function checkAndInjectCheckboxes() {
            const selectors = ['#grdBenhNhan', '#tblGridKetQua', '#grdDanhSach', '.ui-jqgrid-btable'];
            let table = null;
            for (const sel of selectors) {
                const candidate = document.querySelector(sel);
                if (candidate) {
                    const testRows = candidate.querySelectorAll('tr.jqgrow, tr.ui-widget-content');
                    if (testRows.length > 0) { table = candidate; break; }
                }
            }
            if (!table) return false;

            const rows = table.querySelectorAll('tr.jqgrow, tr.ui-widget-content');
            if (rows.length > 0) {
                const firstRowCb = rows[0].querySelector('.his-checkbox');
                if (!firstRowCb) {
                    if (Filter) Filter.injectCheckboxes(onCheckboxChange);
                    return true;
                }
                return true; // Already injected
            }
            return false;
        }

        // Subscribe to shared Event Bus
        if (HIS?.EventBus) {
            HIS.EventBus.on('grid:reloaded', () => setTimeout(checkAndInjectCheckboxes, 300));
            HIS.EventBus.on('grid:ready', () => checkAndInjectCheckboxes());
        }

        // Retry periodically until grid has data (max 10 attempts over 10 seconds)
        let retryCount = 0;
        const retryInterval = setInterval(() => {
            retryCount++;
            const success = checkAndInjectCheckboxes();
            if (success || retryCount >= 10) {
                clearInterval(retryInterval);
                if (!success) console.warn('[Aladinn Sign] Grid still empty after 10 retries');
            }
        }, 1000);

        // MutationObserver as final fallback
        const gridContainer = document.querySelector('.ui-jqgrid-bdiv') || document.querySelector('.ui-jqgrid');
        if (gridContainer) {
            const observer = new MutationObserver(() => {
                checkAndInjectCheckboxes();
            });
            observer.observe(gridContainer, { childList: true, subtree: true });
        }

        // Initial check
        checkAndInjectCheckboxes();
    }

    // ======================================================================
    // ===                   WARD PAGE SIGNING WORKFLOW                 ===
    // ======================================================================

    /**
     * Inject checkboxes into ward page patient grid rows + select-all in header
     */
    function injectWardCheckboxes() {
        const tables = document.querySelectorAll('.ui-jqgrid-btable');
        let grid = null;
        for (const t of tables) {
            if (t.querySelectorAll('tr.jqgrow').length > 0) { grid = t; break; }
        }
        if (!grid) return;

        // Inject select-all checkbox in header
        const gridContainer = grid.closest('.ui-jqgrid');
        if (gridContainer && !gridContainer.querySelector('.aladinn-ward-cb-all')) {
            const headerRow = gridContainer.querySelector('.ui-jqgrid-hdiv th:first-child, .ui-jqgrid-hdiv td:first-child');
            if (headerRow) {
                const allCb = document.createElement('input');
                allCb.type = 'checkbox';
                allCb.className = 'aladinn-ward-cb-all';
                allCb.title = 'Chọn/bỏ chọn tất cả bệnh nhân';
                allCb.style.cssText = 'cursor:pointer; width:15px; height:15px; accent-color:#d4a25a; margin-right:4px; vertical-align:middle;';
                allCb.addEventListener('click', (e) => e.stopPropagation());
                allCb.addEventListener('change', () => {
                    const isChecked = allCb.checked;
                    document.querySelectorAll('.aladinn-ward-cb').forEach(cb => { cb.checked = isChecked; });
                    updateWardBtnState();
                });
                headerRow.insertBefore(allCb, headerRow.firstChild);
            }
        }

        // Inject individual row checkboxes
        const rows = grid.querySelectorAll('tr.jqgrow');
        for (const row of rows) {
            if (row.querySelector('.aladinn-ward-cb')) continue;

            const firstTd = row.querySelector('td');
            if (!firstTd) continue;

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.className = 'aladinn-ward-cb';
            cb.style.cssText = 'margin-right:4px; cursor:pointer; vertical-align:middle; width:15px; height:15px; accent-color:#d4a25a;';
            cb.dataset.rowId = row.id;
            cb.addEventListener('click', (e) => e.stopPropagation());
            cb.addEventListener('change', updateWardBtnState);

            firstTd.insertBefore(cb, firstTd.firstChild);
        }
    }

    function updateWardBtnState() {
        const count = document.querySelectorAll('.aladinn-ward-cb:checked').length;
        const total = document.querySelectorAll('.aladinn-ward-cb').length;

        // Update select-all checkbox state
        const allCb = document.querySelector('.aladinn-ward-cb-all');
        if (allCb) {
            allCb.checked = count > 0 && count === total;
            allCb.indeterminate = count > 0 && count < total;
        }

        // Update ward panel start button
        const startBtn = document.getElementById('ward-btn-start');
        if (startBtn) {
            startBtn.disabled = count === 0;
            startBtn.style.opacity = count > 0 ? '1' : '0.5';
            const label = startBtn.querySelector('span');
            if (label) {
                label.textContent = count > 0 ? `Bắt đầu Ký số (${count})` : 'Bắt đầu Ký số';
            }
        }

        // Show/hide ward panel when checkboxes are selected
        const panel = document.getElementById('ward-workflow-panel');
        if (panel && !WARD_STATE.isActive) {
            panel.style.display = count > 0 ? 'block' : 'none';
        }
    }

    /**
     * Extract patient name from a ward page grid row
     */
    function extractWardPatientName(row) {
        if (!row) return 'Bệnh nhân';
        const cells = row.querySelectorAll('td');
        for (const cell of cells) {
            const text = (cell.textContent || '').trim();
            if (text.length > 3 && /^[A-ZÀ-Ỹ]/.test(text) && !text.match(/^\d/) && text.includes(' ')) {
                return text;
            }
        }
        // Fallback: longest text cell
        let longest = '';
        for (const cell of cells) {
            const text = (cell.textContent || '').trim();
            if (text.length > longest.length && !/^\d+$/.test(text) && text.length > 3) {
                longest = text;
            }
        }
        return longest || 'Bệnh nhân';
    }

    /**
     * Simple promise-based delay
     */
    function delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Start ward batch signing for selected patient rows
     */
    function startWardBatchSigning(patientRows) {
        WARD_STATE.queue = patientRows;
        WARD_STATE.currentIndex = -1;
        WARD_STATE.isActive = true;
        WARD_STATE.stats = { completed: 0, skipped: 0, failed: 0 };

        const count = patientRows.length;
        showNotice(`⚡ Bắt đầu ký cho ${count} bệnh nhân...`);
        if (Logger) Logger.info('Sign', `Ward batch signing started: ${count} patients`);

        // Switch panel to process view
        wardPanelToggleView('process');
        wardPanelUpdateStats();

        processNextWardPatient();
    }

    /**
     * Process next patient in ward batch signing queue — MANUAL FLOW
     * Opens QLBA modal, filters by creator name, waits for user to click panel buttons.
     */
    async function processNextWardPatient() {
        if (!WARD_STATE.isActive) return;

        WARD_STATE.currentIndex++;

        if (WARD_STATE.currentIndex >= WARD_STATE.queue.length) {
            finishWardBatchSigning();
            return;
        }

        const row = WARD_STATE.queue[WARD_STATE.currentIndex];
        const patientName = extractWardPatientName(row);
        const idx = WARD_STATE.currentIndex + 1;
        const total = WARD_STATE.queue.length;

        // Update panel
        wardPanelSetPatient(patientName);
        wardPanelUpdateStats();
        showNotice(`⏳ [${idx}/${total}] Đang mở QLBA: ${patientName}...`);
        if (Logger) Logger.info('Sign', `Processing patient ${idx}/${total}: ${patientName}`);

        try {
            // 1. Click row to select patient in HIS grid
            row.scrollIntoView({ behavior: 'smooth', block: 'center' });
            row.click();
            await delay(800);

            // Pre-check: ensure no stale jBox modal is still open
            const staleIframe = document.querySelector('#divDlgBAifmView, .jBox-container iframe');
            if (staleIframe) {
                if (Logger) Logger.info('Sign', 'Stale jBox found, closing first...');
                closeJBoxModal();
                await waitForJBoxClosed(3000);
            }

            // 2. Find and click the QLBA button to open the native modal
            const qlbaBtn = findQLBAButton();
            if (!qlbaBtn) {
                showNotice('❌ Không tìm thấy nút QLBA trên thanh công cụ HIS');
                WARD_STATE.stats.failed++;
                await delay(500);
                processNextWardPatient();
                return;
            }

            qlbaBtn.click();
            if (Logger) Logger.info('Sign', 'QLBA button clicked, waiting for jBox modal...');

            // 3. Wait for jBox modal to appear with iframe
            const iframe = await waitForJBoxIframe(15000);
            if (!iframe) {
                showNotice(`⚠️ [${idx}/${total}] Modal QLBA không mở được — bỏ qua`);
                WARD_STATE.stats.skipped++;
                wardPanelUpdateStats();
                await delay(500);
                processNextWardPatient();
                return;
            }

            // 4. Wait for iframe content to load
            await waitForIframeReady(iframe, 15000);

            // 5. Wait for grid element + initial data
            const creatorName = getWardCreatorName();
            await waitForGridInIframe(iframe, 5000);
            await waitForGridStable(iframe, 10000);
            if (Logger) Logger.info('Sign', `QLBA: Initial grid stable, rows=${countDomRows(iframe)}`);

            // 6. Apply filter, then wait for grid to settle
            if (creatorName) {
                filterInsideQlbaIframe(iframe, creatorName);
                // Wait for filter's AJAX + DOM to complete
                await waitForFilterComplete(iframe, 8000);
            }

            // 7. Check final row count (direct DOM count — no jqGrid API needed)
            const finalRows = countDomRows(iframe);
            if (Logger) Logger.info('Sign', `QLBA grid rows after filter: ${finalRows}`);
            const hasDocuments = finalRows > 0;

            if (!hasDocuments) {
                // No unsigned docs for this patient → auto-skip
                showNotice(`⏭️ [${idx}/${total}] ${patientName} — Không có phiếu cần ký, tự động chuyển`);
                if (Logger) Logger.info('Sign', `No docs for ${patientName}, auto-skipping`);
                WARD_STATE.stats.skipped++;
                wardPanelUpdateStats();
                closeJBoxModal();
                await waitForJBoxClosed(3000);
                processNextWardPatient();
                return;
            }

            // 7. Documents found — WAIT for user to sign then click panel buttons
            showNotice(`🖊️ [${idx}/${total}] ${patientName} — Ký phiếu rồi nhấn "Ký tiếp" trên panel`);

            // 8. Watch for modal being closed by HIS after signing 1 document.
            //    If QLBA closes while ward batch is still active for this patient,
            //    auto-reopen QLBA so the user can continue signing remaining docs.
            startQlbaAutoReopen(row, patientName, idx, total);

        } catch (err) {
            if (Logger) Logger.error('Sign', `Ward signing error for ${patientName}:`, err);
            WARD_STATE.stats.failed++;
            showNotice(`❌ Lỗi: ${err.message || 'Không xác định'}`);
            wardPanelUpdateStats();
            closeJBoxModal();
            await delay(1000);
            processNextWardPatient();
        }
    }

    /**
     * Monitor QLBA modal (jBox/divDlgBA). If HIS closes it while we're still
     * processing the same patient (WARD_STATE hasn't advanced), re-open QLBA
     * so the user can keep signing remaining documents.
     */
    function startQlbaAutoReopen(row, patientName, idx, total) {
        // Cancel any previous watcher
        stopQlbaAutoReopen();

        const expectedIndex = WARD_STATE.currentIndex;
        let reopenTimer = null;

        WARD_STATE._qlbaWatcher = setInterval(() => {
            // Stop watching if the session moved on or is no longer active
            if (!WARD_STATE.isActive || WARD_STATE.currentIndex !== expectedIndex) {
                stopQlbaAutoReopen();
                return;
            }

            // Check if modal is still open
            const iframe = document.querySelector('#divDlgBAifmView, .jBox-container iframe');
            if (iframe) return; // Modal is still open — nothing to do

            // Modal gone! HIS closed it after signing a document.
            // Wait a moment then re-open QLBA for the same patient.
            if (!reopenTimer) {
                reopenTimer = setTimeout(async () => {
                    // Double-check session is still on this patient
                    if (!WARD_STATE.isActive || WARD_STATE.currentIndex !== expectedIndex) {
                        stopQlbaAutoReopen();
                        return;
                    }

                    if (Logger) Logger.info('Sign', `QLBA closed by HIS — re-opening for ${patientName}`);
                    showNotice(`🔄 [${idx}/${total}] Mở lại QLBA cho ${patientName}...`);

                    try {
                        // Re-click the QLBA button
                        const qlbaBtn = findQLBAButton();
                        if (!qlbaBtn) {
                            showNotice('❌ Không tìm thấy nút QLBA để mở lại');
                            return;
                        }
                        qlbaBtn.click();

                        // Wait for new modal
                        const newIframe = await waitForJBoxIframe(10000);
                        if (!newIframe) {
                            showNotice('⚠️ Không mở lại được QLBA');
                            return;
                        }

                        await waitForIframeReady(newIframe, 10000);
                        const creatorName = getWardCreatorName();
                        await waitForGridInIframe(newIframe, 5000);
                        await waitForGridStable(newIframe, 8000);

                        if (creatorName) {
                            filterInsideQlbaIframe(newIframe, creatorName);
                            await waitForFilterComplete(newIframe, 8000);
                        }

                        const finalRows = countDomRows(newIframe);
                        if (finalRows === 0) {
                            showNotice(`✅ [${idx}/${total}] ${patientName} — Đã ký hết phiếu! Nhấn "Ký tiếp" để chuyển.`);
                        } else {
                            showNotice(`🖊️ [${idx}/${total}] ${patientName} — Còn ${finalRows} phiếu. Tiếp tục ký...`);
                        }

                        reopenTimer = null; // Allow future re-opens
                    } catch (err) {
                        if (Logger) Logger.error('Sign', 'Error re-opening QLBA:', err);
                        showNotice('❌ Lỗi mở lại QLBA: ' + (err.message || ''));
                        reopenTimer = null;
                    }
                }, 2000); // 2s delay to let HIS settle
            }
        }, 500);
    }

    function stopQlbaAutoReopen() {
        if (WARD_STATE._qlbaWatcher) {
            clearInterval(WARD_STATE._qlbaWatcher);
            WARD_STATE._qlbaWatcher = null;
        }
    }

    /**
     * Called when user clicks "Ký tiếp" on the panel
     */
    function onWardNext() {
        stopQlbaAutoReopen();
        WARD_STATE.stats.completed++;
        const row = WARD_STATE.queue[WARD_STATE.currentIndex];
        const name = extractWardPatientName(row);
        showNotice(`✅ ${name}: Đã ký xong`);
        if (Logger) Logger.info('Sign', `Ward: marked as signed: ${name}`);

        const cb = row?.querySelector('.aladinn-ward-cb');
        if (cb) cb.checked = false;
        wardPanelUpdateStats();

        closeAndProcessNext();
    }

    /**
     * Called when user clicks "Bỏ qua" on the panel
     */
    function onWardSkip() {
        stopQlbaAutoReopen();
        WARD_STATE.stats.skipped++;
        const row = WARD_STATE.queue[WARD_STATE.currentIndex];
        const name = extractWardPatientName(row);
        showNotice(`⏭️ ${name}: Bỏ qua`);
        if (Logger) Logger.info('Sign', `Ward: skipped: ${name}`);

        const cb = row?.querySelector('.aladinn-ward-cb');
        if (cb) cb.checked = false;
        wardPanelUpdateStats();

        closeAndProcessNext();
    }

    /**
     * Called when user clicks "Dừng" on the panel
     */
    function onWardStop() {
        stopQlbaAutoReopen();
        showNotice('🛑 Đã dừng quy trình ký');
        if (Logger) Logger.info('Sign', 'Ward: user stopped signing');
        closeJBoxModal();
        finishWardBatchSigning();
    }

    /**
     * Close modal, wait for it to be gone, then process next patient
     */
    async function closeAndProcessNext() {
        closeJBoxModal();
        await waitForJBoxClosed(5000);
        processNextWardPatient();
    }

    /**
     * Finish the ward batch signing session
     */
    function finishWardBatchSigning() {
        const s = WARD_STATE.stats;
        showNotice(`✅ Hoàn thành! Ký: ${s.completed}, Bỏ qua: ${s.skipped}, Lỗi: ${s.failed}`);
        WARD_STATE.isActive = false;

        // Uncheck all
        document.querySelectorAll('.aladinn-ward-cb:checked').forEach(cb => { cb.checked = false; });
        updateWardBtnState();

        // Reset panel
        wardPanelToggleView('start');
        wardPanelUpdateStats();
        wardPanelSetPatient('---');

        if (Logger) Logger.info('Sign', `Ward batch done: ${JSON.stringify(s)}`);
    }

    /**
     * Get the creator name from ward panel input, or detect from footer
     */
    function getWardCreatorName() {
        const input = document.getElementById('ward-creator-filter');
        if (input && input.value.trim()) return input.value.trim();

        // Auto-detect from HIS footer
        const footerText = document.body.innerText;
        const regex = /Người dùng:\s*([^-]+)\s*-/i;
        const match = footerText.match(regex);
        if (match && match[1]) {
            const name = match[1].trim();
            if (input) input.value = name;
            return name;
        }
        return '';
    }

    // ======================================================================
    // ===                   QLBA INTERACTION HELPERS                    ===
    // ======================================================================

    /**
     * Find the QLBA button on the HIS toolbar
     */
    function findQLBAButton() {
        // Strategy 1: Search clickable elements with exact text "QLBA"
        const allClickable = document.querySelectorAll('button, a, span, div, li, td');
        for (const el of allClickable) {
            const text = el.textContent.trim();
            if (text === 'QLBA') {
                if (el.offsetWidth > 0 && el.offsetHeight > 0) return el;
            }
        }

        // Strategy 2: Search by ID patterns
        const byId = document.querySelector('#btnQLBA, #btn_QLBA, [id*="btnQLBA"], [id*="QLBA"]');
        if (byId && byId.offsetWidth > 0) return byId;

        // Strategy 3: Search buttons containing "QLBA" text
        const btns = document.querySelectorAll('.ui-button, .btn, [class*="btn"], a[href*="javascript"]');
        for (const btn of btns) {
            if (btn.textContent.trim().includes('QLBA')) return btn;
        }

        // Strategy 4: Search "Bệnh án" menu with dropdown
        const dropdownItems = document.querySelectorAll('.dropdown-menu a, .jq-menu-item, ul.ui-menu a, li a');
        for (const item of dropdownItems) {
            const text = item.textContent.trim();
            if (text === 'QLBA' || text.includes('Quản lý bệnh án') || text.includes('Quản lý BA')) {
                return item;
            }
        }

        if (Logger) Logger.error('Sign', 'QLBA button not found on page');
        return null;
    }

    /**
     * Wait for jBox modal's iframe (#divDlgBAifmView) to appear in DOM
     */
    function waitForJBoxIframe(timeoutMs) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const timer = setInterval(() => {
                const iframe = document.querySelector('#divDlgBAifmView, .jBox-container iframe');
                if (iframe) {
                    clearInterval(timer);
                    resolve(iframe);
                    return;
                }
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, 300);
        });
    }

    /**
     * Wait for iframe document to be accessible and ready
     */
    function waitForIframeReady(iframe, timeoutMs) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const timer = setInterval(() => {
                try {
                    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iDoc && iDoc.readyState === 'complete') {
                        clearInterval(timer);
                        resolve(iDoc);
                        return;
                    }
                } catch (_e) { /* cross-origin or loading */ }

                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, 500);
        });
    }
    /**
     * Wait until the grid element appears inside the QLBA iframe.
     * Polls every 100ms — resolves as soon as grid is found (adaptive).
     */
    function waitForGridInIframe(iframe, timeoutMs) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const timer = setInterval(() => {
                try {
                    const iDoc = iframe.contentDocument || iframe.contentWindow.document;
                    if (iDoc) {
                        const grid = iDoc.querySelector('#gridPhieu, .ui-jqgrid-btable, [id*="gridPhieu"]');
                        if (grid) {
                            clearInterval(timer);
                            resolve(grid);
                            return;
                        }
                    }
                } catch (_e) { /* loading */ }

                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(timer);
                    resolve(null);
                }
            }, 100); // Fast poll — 100ms
        });
    }

    /**
     * Count visible DOM rows in jqGrid (tr.jqgrow).
     * Direct and reliable — doesn't depend on jqGrid API.
     */
    function countDomRows(iframe) {
        try {
            const iDoc = iframe.contentDocument;
            if (!iDoc) return -1;
            const rows = iDoc.querySelectorAll('tr.jqgrow');
            let count = 0;
            for (const row of rows) {
                if (row.style.display !== 'none') count++;
            }
            return count;
        } catch (_e) { return -1; }
    }

    /**
     * Wait for grid to have data loaded and stable (row count unchanged for 600ms).
     * Polls every 200ms.
     */
    function waitForGridStable(iframe, timeoutMs) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            let lastCount = -1;
            let stableChecks = 0;

            const timer = setInterval(() => {
                const count = countDomRows(iframe);

                if (count === lastCount && count >= 0) {
                    stableChecks++;
                } else {
                    stableChecks = 0;
                    lastCount = count;
                }

                // Stable for 600ms (3 × 200ms) 
                if (stableChecks >= 3) {
                    clearInterval(timer);
                    resolve(count);
                    return;
                }

                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(timer);
                    resolve(count);
                }
            }, 200);
        });
    }

    /**
     * Wait for filter AJAX to complete, then for DOM to settle.
     * Strategy:
     *   1. Wait 1s for filterInsideQlbaIframe's setTimeout(50ms) + AJAX request to start
     *   2. Monitor jQuery.active until AJAX finishes (0 active requests)
     *   3. Then poll DOM rows for stability (unchanged for 500ms)
     */
    function waitForFilterComplete(iframe, timeoutMs) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            // Step 1: Wait 1s for filter's internal setTimeout + AJAX to start
            setTimeout(() => {
                const $ = iframe.contentWindow?.jQuery;

                if ($ && $.active > 0) {
                    // Step 2: AJAX is running — wait for it to finish
                    if (Logger) Logger.info('Sign', `QLBA: Waiting for AJAX (${$.active} active)...`);
                    const ajaxTimer = setInterval(() => {
                        if ($.active === 0) {
                            clearInterval(ajaxTimer);
                            if (Logger) Logger.info('Sign', 'QLBA: AJAX complete');
                            // Step 3: Wait for DOM to settle after AJAX
                            waitForDomSettle(iframe, 500, () => resolve());
                            return;
                        }
                        if (Date.now() - startTime > timeoutMs) {
                            clearInterval(ajaxTimer);
                            resolve();
                        }
                    }, 100);
                } else {
                    // No AJAX detected — the filter might be client-side
                    // or already completed. Just wait for DOM stability.
                    if (Logger) Logger.info('Sign', 'QLBA: No active AJAX, waiting for DOM settle...');
                    waitForDomSettle(iframe, 800, () => resolve());
                }
            }, 1000);
        });
    }

    /**
     * Wait for DOM row count to be stable (unchanged for stabilityMs).
     */
    function waitForDomSettle(iframe, stabilityMs, callback) {
        let lastCount = countDomRows(iframe);
        let stableStart = Date.now();

        const timer = setInterval(() => {
            const count = countDomRows(iframe);
            if (count !== lastCount) {
                lastCount = count;
                stableStart = Date.now();
            }
            if (Date.now() - stableStart >= stabilityMs) {
                clearInterval(timer);
                callback();
            }
        }, 150);

        // Safety timeout
        setTimeout(() => {
            clearInterval(timer);
            callback();
        }, 5000);
    }


    /**
     * Auto-filter QLBA iframe: set status to "Phiếu chưa ký số" + type creator name
     */
    function filterInsideQlbaIframe(iframe, creatorName) {
        try {
            const iDoc = iframe.contentDocument || iframe.contentWindow.document;
            const iWin = iframe.contentWindow;
            if (!iDoc) return;

            // 1. Set status dropdown to "Phiếu chưa ký số"
            const statusSelect = iDoc.querySelector('#cboTRANGTHAI, select[id*="cboTRANGTHAI"]');
            if (statusSelect) {
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
                    if (Logger) Logger.info('Sign', 'QLBA: Set status to unsigned');
                }
            }

            // 2. Type creator name into "Người tạo" filter (gs_NGUOITAO)
            const creatorInput = iDoc.getElementById('gs_NGUOITAO');
            if (!creatorInput || !creatorName) return;

            const $ = iWin.jQuery || iWin.$;

            creatorInput.focus();
            creatorInput.value = '';

            if (creatorName.length > 1) {
                const firstPart = creatorName.slice(0, -1);
                const lastChar = creatorName.slice(-1);

                creatorInput.value = firstPart;
                if ($) { $(creatorInput).trigger('input'); }
                else { creatorInput.dispatchEvent(new Event('input', { bubbles: true })); }

                setTimeout(() => {
                    typeLastCharInIframe(creatorInput, lastChar, $);
                    triggerEnterInIframe(creatorInput, $);

                    try {
                        const $grid = $('[id*="gridPhieu"]', iDoc);
                        if ($grid.length && $grid[0].triggerToolbar) {
                            $grid[0].triggerToolbar();
                        }
                    } catch (_e) { /* toolbar trigger failed */ }

                    setTimeout(() => { creatorInput.blur(); }, 100);
                    if (Logger) Logger.info('Sign', `QLBA: Typed creator name: ${creatorName}`);
                }, 50);
            } else {
                typeLastCharInIframe(creatorInput, creatorName, $);
                triggerEnterInIframe(creatorInput, $);
                setTimeout(() => { creatorInput.blur(); }, 100);
            }

        } catch (err) {
            if (Logger) Logger.error('Sign', 'filterInsideQlbaIframe error:', err);
        }
    }

    function typeLastCharInIframe(input, char, $) {
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
    }

    function triggerEnterInIframe(input, $) {
        if ($) {
            const $input = $(input);
            $input.trigger($.Event('keydown', { keyCode: 13, which: 13, key: 'Enter' }));
            $input.trigger($.Event('keypress', { keyCode: 13, which: 13, key: 'Enter' }));
            $input.trigger($.Event('keyup', { keyCode: 13, which: 13, key: 'Enter' }));
        } else {
            const opts = { key: 'Enter', keyCode: 13, which: 13, bubbles: true };
            input.dispatchEvent(new KeyboardEvent('keydown', opts));
            input.dispatchEvent(new KeyboardEvent('keypress', opts));
            input.dispatchEvent(new KeyboardEvent('keyup', opts));
        }
    }

    /**
     * Close the jBox modal — aggressive multi-strategy approach
     */
    function closeJBoxModal() {
        // Strategy 1: Click the jBox close button
        const closeBtn = document.querySelector('.jBox-container .jBox-closeButton');
        if (closeBtn) {
            closeBtn.click();
        }

        // Strategy 2: Force-remove iframe first to prevent stale references
        const iframe = document.querySelector('#divDlgBAifmView');
        if (iframe) iframe.remove();

        // Strategy 3: Remove jBox containers after a short delay
        setTimeout(() => {
            document.querySelectorAll('.jBox-container').forEach(el => el.remove());
            document.querySelectorAll('.jBox-overlay').forEach(el => el.remove());
            // Also remove any jBox wrapper that might linger
            document.querySelectorAll('.jBox-wrapper').forEach(el => el.remove());
        }, 200);
    }

    /**
     * Wait until all jBox modal iframes are gone from the DOM
     */
    function waitForJBoxClosed(timeoutMs) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const timer = setInterval(() => {
                const iframe = document.querySelector('#divDlgBAifmView, .jBox-container iframe');
                if (!iframe) {
                    clearInterval(timer);
                    resolve(true);
                    return;
                }
                if (Date.now() - startTime > timeoutMs) {
                    clearInterval(timer);
                    // Force remove if still present
                    iframe.remove();
                    document.querySelectorAll('.jBox-container').forEach(el => el.remove());
                    document.querySelectorAll('.jBox-overlay').forEach(el => el.remove());
                    resolve(true);
                }
            }, 200);
        });
    }

    // ======================================================================
    // ===                    WARD WORKFLOW PANEL                        ===
    // ======================================================================

    /**
     * Inject the ward workflow control panel
     */
    function injectWardPanel() {
        if (document.getElementById('ward-workflow-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'ward-workflow-panel';
        panel.style.cssText = `
            display:none;
            position:fixed; bottom:20px; right:20px; z-index:999999;
            width:340px;
            background:linear-gradient(135deg, #1a1510 0%, #231c14 100%);
            border:1px solid rgba(212,162,90,0.3);
            border-radius:16px;
            box-shadow:0 20px 40px rgba(0,0,0,0.5), 0 0 20px rgba(212,162,90,0.1);
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            color:#e8dcc8;
            overflow:hidden;
            transition: opacity 0.3s, transform 0.3s;
        `;

        panel.innerHTML = `
            <div id="ward-panel-header" style="
                padding:12px 16px;
                background:linear-gradient(90deg, rgba(212,162,90,0.15), rgba(196,136,60,0.1));
                border-bottom:1px solid rgba(212,162,90,0.2);
                display:flex; align-items:center; justify-content:space-between;
                cursor:move; user-select:none;
            ">
                <div style="display:flex; align-items:center; gap:8px;">
                    <span style="font-size:16px">🧞</span>
                    <span style="font-weight:600; font-size:14px; letter-spacing:0.3px; color:#e8dcc8;">Ký số Buồng ĐT</span>
                </div>
                <span id="ward-queue-badge" style="
                    background:rgba(212,162,90,0.2); color:#d4a25a;
                    padding:2px 10px; border-radius:20px; font-size:12px; font-weight:600;
                ">0/0</span>
            </div>

            <div id="ward-start-view" style="padding:14px 16px;">
                <div style="margin-bottom:12px;">
                    <label style="font-size:11px; color:#a0937e; display:block; margin-bottom:4px;">Tự động điền Người tạo:</label>
                    <div style="position:relative;">
                        <input type="text" id="ward-creator-filter" placeholder="VD: trung anh" style="
                            width:100%; padding:8px 10px 8px 30px; box-sizing:border-box;
                            background:rgba(35,28,20,0.8); border:1px solid rgba(212,162,90,0.3);
                            border-radius:8px; color:#e8dcc8; font-size:13px;
                            outline:none; transition:border-color 0.2s;
                        ">
                        <svg style="position:absolute; left:8px; top:50%; transform:translateY(-50%); opacity:0.5; color:#d4a25a;" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    </div>
                </div>
                <p style="font-size:11px; color:#7a6e5e; margin:0 0 14px;">
                    Tick ☑ bệnh nhân → Panel tự hiện → nhấn <b>Bắt đầu</b>.
                </p>
                <button id="ward-btn-start" disabled style="
                    width:100%; padding:10px; border:none; border-radius:10px;
                    background:linear-gradient(135deg, #d4a25a, #c4883c);
                    color:#1a1510; font-size:14px; font-weight:600;
                    cursor:pointer; opacity:0.5; transition:all 0.2s;
                    display:flex; align-items:center; justify-content:center; gap:8px;
                ">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                    <span>Bắt đầu Ký số</span>
                </button>
            </div>

            <div id="ward-process-view" style="display:none; padding:14px 16px;">
                <div style="
                    background:rgba(212,162,90,0.08); border:1px solid rgba(212,162,90,0.2);
                    border-radius:10px; padding:10px 14px; margin-bottom:12px;
                    position:relative; overflow:hidden;
                ">
                    <div style="position:absolute; top:0; left:0; right:0; height:2px;
                         background:linear-gradient(90deg,transparent,#d4a25a,transparent);
                         animation:ward-glow 2s ease-in-out infinite;"></div>
                    <span style="font-size:10px; color:#a0937e; text-transform:uppercase; letter-spacing:1px;">Đang xử lý</span>
                    <div id="ward-current-patient" style="font-size:15px; font-weight:700; color:#e8dcc8; margin-top:2px;">---</div>
                </div>

                <div style="display:flex; justify-content:space-between; margin-bottom:6px;">
                    <span style="font-size:11px; color:#a0937e;">Tiến độ</span>
                    <span id="ward-progress-pct" style="font-size:11px; color:#d4a25a; font-weight:600;">0%</span>
                </div>
                <div style="height:6px; background:rgba(35,28,20,0.8); border-radius:4px; overflow:hidden; margin-bottom:14px;">
                    <div id="ward-progress-bar" style="height:100%; width:0%; background:linear-gradient(90deg,#c4883c,#d4a25a); border-radius:4px; transition:width 0.4s;"></div>
                </div>

                <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:8px; margin-bottom:14px;">
                    <div style="text-align:center; padding:8px 4px; background:rgba(34,197,94,0.08); border-radius:8px;">
                        <div style="font-size:10px; color:#6ee7a0;">Đã ký</div>
                        <div id="ward-stat-done" style="font-size:18px; font-weight:700; color:#22c55e;">0</div>
                    </div>
                    <div style="text-align:center; padding:8px 4px; background:rgba(212,162,90,0.08); border-radius:8px;">
                        <div style="font-size:10px; color:#d4a25a;">Bỏ qua</div>
                        <div id="ward-stat-skip" style="font-size:18px; font-weight:700; color:#c4883c;">0</div>
                    </div>
                    <div style="text-align:center; padding:8px 4px; background:rgba(161,135,100,0.1); border-radius:8px;">
                        <div style="font-size:10px; color:#a18764;">Còn lại</div>
                        <div id="ward-stat-remain" style="font-size:18px; font-weight:700; color:#d4a25a;">0</div>
                    </div>
                </div>

                <div style="display:flex; gap:8px; margin-bottom:8px;">
                    <button id="ward-btn-next" style="
                        flex:1; padding:10px; border:none; border-radius:10px;
                        background:linear-gradient(135deg, #22c55e, #16a34a);
                        color:white; font-size:13px; font-weight:600;
                        cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;
                        transition:all 0.2s;
                    ">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                        Ký tiếp
                    </button>
                    <button id="ward-btn-skip" style="
                        flex:1; padding:10px; border:none; border-radius:10px;
                        background:rgba(212,162,90,0.12); border:1px solid rgba(212,162,90,0.3);
                        color:#d4a25a; font-size:13px; font-weight:600;
                        cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;
                        transition:all 0.2s;
                    ">
                        Bỏ qua
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                    </button>
                </div>
                <button id="ward-btn-stop" style="
                    width:100%; padding:8px; border:1px solid rgba(239,68,68,0.3); border-radius:10px;
                    background:transparent; color:#f87171; font-size:12px; font-weight:500;
                    cursor:pointer; display:flex; align-items:center; justify-content:center; gap:6px;
                    transition:all 0.2s;
                ">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>
                    Dừng quy trình
                </button>
            </div>
        `;

        // Add glow animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes ward-glow {
                0%,100% { opacity:0.3; }
                50% { opacity:1; }
            }
            #ward-workflow-panel button:hover {
                filter: brightness(1.15);
                transform: translateY(-1px);
            }
            #ward-workflow-panel input:focus {
                border-color: #d4a25a !important;
            }
        `;
        document.head.appendChild(style);
        document.body.appendChild(panel);

        // Bind events
        document.getElementById('ward-btn-start').addEventListener('click', () => {
            const checkedCbs = document.querySelectorAll('.aladinn-ward-cb:checked');
            let patientRows = [];
            if (checkedCbs.length > 0) {
                patientRows = Array.from(checkedCbs).map(cb => {
                    return document.getElementById(cb.dataset.rowId) || cb.closest('tr.jqgrow');
                }).filter(Boolean);
            } else {
                const highlightedRow = document.querySelector('tr.ui-state-highlight, tr.jqgrow.ui-state-highlight');
                if (highlightedRow) patientRows = [highlightedRow];
            }
            if (patientRows.length === 0) {
                showNotice('⚠️ Tick ☑ hoặc click chọn ít nhất 1 bệnh nhân');
                return;
            }
            startWardBatchSigning(patientRows);
        });
        document.getElementById('ward-btn-next').addEventListener('click', onWardNext);
        document.getElementById('ward-btn-skip').addEventListener('click', onWardSkip);
        document.getElementById('ward-btn-stop').addEventListener('click', onWardStop);

        // Auto-detect creator name from HIS footer
        setTimeout(() => {
            const name = getWardCreatorName();
            const input = document.getElementById('ward-creator-filter');
            if (name && input && !input.value) input.value = name;
        }, 2000);

        // Make panel draggable
        makeWardPanelDraggable(panel);
    }

    function makeWardPanelDraggable(panel) {
        const header = document.getElementById('ward-panel-header');
        if (!header) return;

        let isDragging = false;
        let startX, startY, startRight, startBottom;

        header.addEventListener('mousedown', (e) => {
            isDragging = true;
            const rect = panel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startRight = window.innerWidth - rect.right;
            startBottom = window.innerHeight - rect.bottom;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            panel.style.right = Math.max(0, startRight - dx) + 'px';
            panel.style.bottom = Math.max(0, startBottom - dy) + 'px';
        });

        document.addEventListener('mouseup', () => { isDragging = false; });
    }

    function wardPanelToggleView(mode) {
        const startView = document.getElementById('ward-start-view');
        const processView = document.getElementById('ward-process-view');
        if (mode === 'process') {
            if (startView) startView.style.display = 'none';
            if (processView) processView.style.display = 'block';
        } else {
            if (startView) startView.style.display = 'block';
            if (processView) processView.style.display = 'none';
        }
    }

    function wardPanelSetPatient(name) {
        const el = document.getElementById('ward-current-patient');
        if (el) el.textContent = name;
    }

    function wardPanelUpdateStats() {
        const s = WARD_STATE.stats;
        const total = WARD_STATE.queue.length;
        const current = WARD_STATE.currentIndex + 1;
        const remaining = total - s.completed - s.skipped - s.failed;
        const pct = total > 0 ? Math.round((current / total) * 100) : 0;

        const setText = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val;
        };

        setText('ward-queue-badge', `${Math.min(current, total)}/${total}`);
        setText('ward-progress-pct', `${pct}%`);
        setText('ward-stat-done', s.completed);
        setText('ward-stat-skip', s.skipped);
        setText('ward-stat-remain', Math.max(0, remaining));

        const bar = document.getElementById('ward-progress-bar');
        if (bar) bar.style.width = `${pct}%`;
    }

    // ======================================================================
    // ===                    SIGN PAGE HELPERS                          ===
    // ======================================================================

    function onCheckboxChange() {
        const UI = window.Aladinn?.Sign?.UI;
        if (UI && UI.refreshCreatorInfo) UI.refreshCreatorInfo();

        const checked = document.querySelectorAll('.his-checkbox:checked:not(#his-select-all)');
        if (UI) UI.updateStartButtonState(checked.length, false);
    }

    // Expose init function for orchestrator
    window.Aladinn.Sign.init = function () {
        waitForHIS();
    };

    // Sign-specific message handler
    if (chrome?.runtime) {
        chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
            const Signing = window.Aladinn?.Sign?.Signing;
            const Filter = window.Aladinn?.Sign?.Filter;
            const UI = window.Aladinn?.Sign?.UI;

            if (msg.action === 'startSigning') {
                if (Signing) Signing.startSession();
                sendResponse({ success: true });
            } else if (msg.action === 'filterByCreator') {
                if (Filter) Filter.filterByCreator(msg.userName, msg.userId);
                sendResponse({ success: true });
            } else if (msg.action === 'enableAutoSign') {
                if (Signing) Signing.setAutoSign(true);
                sendResponse({ success: true });
            } else if (msg.action === 'disableAutoSign') {
                if (Signing) Signing.setAutoSign(false);
                sendResponse({ success: true });
            } else if (msg.action === 'nextPatient' || msg.action === 'next-patient') {
                if (Signing) Signing.processNextPatient(true);
                sendResponse({ success: true });
            } else if (msg.action === 'selectAll') {
                const checkboxes = document.querySelectorAll('.his-checkbox:not(#his-select-all)');
                let count = 0;
                checkboxes.forEach(cb => { cb.checked = true; count++; });
                const selectAll = document.getElementById('his-select-all');
                if (selectAll) selectAll.checked = true;
                if (UI) UI.updateStartButtonState(count, false);
                sendResponse({ success: true, count });
            } else if (msg.action === 'getSignStats') {
                const checked = document.querySelectorAll('.his-checkbox:checked:not(#his-select-all)').length;
                let signingStats = { completed: 0, skipped: 0 };
                if (Signing && Signing.getStats) signingStats = Signing.getStats();
                sendResponse({
                    selected: checked,
                    signed: signingStats.completed,
                    skipped: signingStats.skipped
                });
            }
            return true;
        });
    }

    console.log('[Aladinn] 🧞 Sign init loaded');
})();
