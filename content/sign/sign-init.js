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

    let initAttempts = 0;
    const MAX_ATTEMPTS = 30;

    function waitForHIS() {
        initAttempts++;

        // Use centralized selectors (fallback to HIS.Selectors.SIGN)
        const SEL = HIS?.Selectors?.SIGN;

        const hasPatientGrid = document.querySelector('#grdBenhNhan');
        const hasUserName = SEL ? document.querySelector(SEL.INPUTS.USER_NAME) : document.querySelector('#txtUSER_TK');
        const hasSearchBtn = SEL ? document.querySelector(SEL.BUTTONS.SEARCH) : document.querySelector('#btnTIMKIEM');

        const isTargetPage = window.location.href.includes('NTU01H100_BenhAnDienTu') || window.location.href.includes('ThongTinKySo') || window.location.href.includes('HSBA_DienTu');

        if (!isTargetPage) {
            if (Logger) Logger.debug('Sign', 'Not on allowed signing page, skipping sign module.');
            return;
        }

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
