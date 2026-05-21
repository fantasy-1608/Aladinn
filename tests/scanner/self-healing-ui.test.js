// @vitest-environment jsdom
import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

describe('Self-Healing UI & Live Persistence Observer', () => {
    let mockStore;
    let mockLogger;

    beforeEach(async () => {
        // Reset DOM
        document.body.innerHTML = '';

        // Reset global namespaces without destroying the cached Scanner module
        window.Aladinn = window.Aladinn || {};
        window.Aladinn.Scanner = window.Aladinn.Scanner || {};

        window.VNPTStore = {
            getState: () => ({
                selectedPatientId: 'BN123',
                selectedPatientName: 'NGUYỄN VĂN A'
            }),
            get: (key) => {
                if (key === 'selectedPatientId') return 'BN123';
                if (key === 'selectedPatientName') return 'NGUYỄN VĂN A';
                return null;
            },
            init: vi.fn(),
            subscribe: vi.fn(),
            actions: {
                selectPatient: vi.fn()
            },
            set: vi.fn()
        };

        window.VNPTRealtime = {
            showToast: vi.fn()
        };

        window.HIS = {
            EventBus: {
                on: vi.fn(),
                off: vi.fn(),
                emit: vi.fn()
            }
        };

        window.VNPTUI = { init: vi.fn() };
        window.VNPTHistory = { init: vi.fn() };
        window.VNPTNutrition = { init: vi.fn() };
        window.VNPTEmergency = { init: vi.fn() };
        window.VNPTClinicalFill = { init: vi.fn() };

        mockLogger = {
            info: vi.fn(),
            debug: vi.fn(),
            success: vi.fn(),
            error: vi.fn()
        };

        // Setup DOM elements corresponding to VNPT HIS Grid
        const gridHeader = document.createElement('div');
        gridHeader.id = 'grdBenhNhan_ICON1';
        gridHeader.innerHTML = '<div id="jqgh_grdBenhNhan_ICON1">Thao tác</div>';
        document.body.appendChild(gridHeader);

        const gridBody = document.createElement('table');
        gridBody.id = 'grdBenhNhan';
        const row = document.createElement('tr');
        row.className = 'ui-state-highlight';
        row.id = 'row_BN123';
        const nameCell = document.createElement('td');
        nameCell.textContent = 'NGUYỄN VĂN A';
        row.appendChild(nameCell);
        gridBody.appendChild(row);
        document.body.appendChild(gridBody);

        // Ensure scanner-init is loaded
        await import('../../content/scanner/scanner-init.js');
    });

    afterEach(() => {
        if (window.Aladinn?.Scanner?._uiObserver) {
            window.Aladinn.Scanner._uiObserver.disconnect();
        }
        vi.restoreAllMocks();
    });

    it('should initialize and automatically inject the Aladinn button on the grid header', async () => {
        window.Aladinn.Scanner.init();

        // Simulate grid:ready event which triggers initial injection
        const gridReadyHandler = window.HIS.EventBus.on.mock.calls.find(c => c[0] === 'grid:ready')[1];
        gridReadyHandler();

        // Wait for setTimeout to execute injection
        await new Promise(resolve => setTimeout(resolve, 150));

        // Check if the button was successfully injected
        const aladinnBtn = document.getElementById('aladinn-quick-actions-btn');
        expect(aladinnBtn).not.toBeNull();
    });

    it('should automatically heal and re-inject the Aladinn button if it gets deleted by HIS DOM re-render', async () => {
        window.Aladinn.Scanner.init();

        // Inject initial button
        const gridReadyHandler = window.HIS.EventBus.on.mock.calls.find(c => c[0] === 'grid:ready')[1];
        gridReadyHandler();
        await new Promise(resolve => setTimeout(resolve, 150));

        // Verify button is there
        let aladinnBtn = document.getElementById('aladinn-quick-actions-btn');
        expect(aladinnBtn).not.toBeNull();

        // Simulate HIS re-render removing the button container
        aladinnBtn.parentElement.remove();
        
        // Verify button is removed
        expect(document.getElementById('aladinn-quick-actions-btn')).toBeNull();

        // Wait for MutationObserver to batch changes and trigger self-healing
        await new Promise(resolve => setTimeout(resolve, 150));

        // Verify Self-Healing automatically restored the button
        aladinnBtn = document.getElementById('aladinn-quick-actions-btn');
        expect(aladinnBtn).not.toBeNull();
    });

    it('should automatically restore active row summary button if row is re-rendered without the button', async () => {
        window.Aladinn.Scanner.init();

        // Inject summary button on patient selection
        const patientSelectedHandler = window.HIS.EventBus.on.mock.calls.find(c => c[0] === 'patient:selected')[1];
        const activeRow = document.querySelector('tr.ui-state-highlight');
        
        patientSelectedHandler({
            rowId: 'BN123',
            patientName: 'NGUYỄN VĂN A',
            rowElement: activeRow
        });

        await new Promise(resolve => setTimeout(resolve, 100));

        // Check if inline summary button was injected
        let inlineBtn = activeRow.querySelector('.his-inline-summary-btn');
        expect(inlineBtn).not.toBeNull();

        // Simulate HIS redrawing the row, removing our inline button
        inlineBtn.remove();
        expect(activeRow.querySelector('.his-inline-summary-btn')).toBeNull();

        // Wait for MutationObserver self-healing callback
        await new Promise(resolve => setTimeout(resolve, 150));

        // Verify button is restored autonomously
        inlineBtn = activeRow.querySelector('.his-inline-summary-btn');
        expect(inlineBtn).not.toBeNull();
    });
});
