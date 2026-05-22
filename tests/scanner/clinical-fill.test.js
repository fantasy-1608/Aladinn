/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('VNPTClinicalFill Multi-Modal', () => {
    let mockStore;
    let mockRealtime;

    beforeEach(async () => {
        // Clear DOM
        document.body.innerHTML = '';

        // Mock VNPTStore
        mockStore = {
            getState: vi.fn(() => ({ selectedPatientId: 'PID_123', selectedPatientName: 'Nguyen Van A' })),
            get: vi.fn((key) => {
                if (key === 'selectedPatientId') return 'PID_123';
                if (key === 'selectedPatientName') return 'Nguyen Van A';
                return null;
            }),
            subscribe: vi.fn()
        };
        window.VNPTStore = mockStore;

        // Mock VNPTRealtime
        mockRealtime = {
            showToast: vi.fn()
        };
        window.VNPTRealtime = mockRealtime;

        // Mock chrome
        window.chrome = {
            runtime: {
                getURL: vi.fn((path) => `chrome-extension://dummy/${path}`)
            }
        };

        // Reset or import VNPTClinicalFill
        await import('../../content/scanner/clinical-fill.js');
    });

    afterEach(() => {
        delete window.VNPTStore;
        delete window.VNPTRealtime;
        delete window.chrome;
        const btn = document.getElementById('vnpt-clinical-fill-btn');
        if (btn) btn.remove();
        const style = document.getElementById('vnpt-clinical-fill-style');
        if (style) style.remove();
    });

    function createIframeModal(title, url, zIndex) {
        const jBoxWrapper = document.createElement('div');
        jBoxWrapper.className = 'jBox-wrapper';
        if (zIndex !== undefined) {
            jBoxWrapper.style.zIndex = zIndex;
        }

        const titleEl = document.createElement('div');
        titleEl.className = 'jBox-title';
        titleEl.textContent = title;
        jBoxWrapper.appendChild(titleEl);

        const iframe = document.createElement('iframe');
        iframe.src = url;
        // Mock offsetWidth & offsetHeight to make them non-zero in JSDOM
        Object.defineProperty(iframe, 'offsetWidth', { value: 100, configurable: true });
        Object.defineProperty(iframe, 'offsetHeight', { value: 100, configurable: true });

        // Mock contentDocument & contentWindow for JSDOM cross-origin fallback testing
        const doc = document.implementation.createHTMLDocument();
        Object.defineProperty(iframe, 'contentDocument', { value: doc, configurable: true });
        Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: vi.fn() }, configurable: true });

        jBoxWrapper.appendChild(iframe);
        document.body.appendChild(jBoxWrapper);
        return { wrapper: jBoxWrapper, iframe };
    }

    it('detects a single modal "Xử trí" correctly', () => {
        createIframeModal('HIS - Xử trí bệnh nhân', 'http://his.vn/xutri', 10);

        // Run detection
        window.VNPTClinicalFill.init();

        const btn = document.getElementById('vnpt-clinical-fill-btn');
        expect(btn).not.toBeNull();
        expect(btn.dataset.formType).toBe('xutri');
    });

    it('prioritizes "Chuyển viện" modal with higher z-index over background "Xử trí" modal', () => {
        // Modal A: Xử trí (zIndex: 100)
        createIframeModal('Xử trí bệnh nhân', 'http://his.vn/xutri', 100);

        // Modal B: Chuyển viện (zIndex: 101)
        createIframeModal('Chuyển viện tuyến', 'http://his.vn/chuyenvien', 101);

        // Run detection
        window.VNPTClinicalFill.init();

        const btn = document.getElementById('vnpt-clinical-fill-btn');
        expect(btn).not.toBeNull();
        expect(btn.dataset.formType).toBe('chuyenvien');
    });

    it('prioritizes based on DOM order when z-index is equal (tie-breaker)', () => {
        // Modal A: Xử trí (zIndex: 100)
        createIframeModal('Xử trí bệnh nhân', 'http://his.vn/xutri', 100);

        // Modal B: Chuyển viện (zIndex: 100) - opened later and appended to DOM later
        createIframeModal('Chuyển viện tuyến', 'http://his.vn/chuyenvien', 100);

        // Run detection
        window.VNPTClinicalFill.init();

        const btn = document.getElementById('vnpt-clinical-fill-btn');
        expect(btn).not.toBeNull();
        expect(btn.dataset.formType).toBe('chuyenvien');
    });

    it('hides the fill button when all modals are closed', () => {
        const { wrapper } = createIframeModal('HIS - Xử trí bệnh nhân', 'http://his.vn/xutri', 10);

        window.VNPTClinicalFill.init();
        expect(document.getElementById('vnpt-clinical-fill-btn')).not.toBeNull();

        // Close modal
        wrapper.remove();

        // Re-run init to trigger check
        window.VNPTClinicalFill.init();

        expect(document.getElementById('vnpt-clinical-fill-btn')).toBeNull();
    });

    it('detects "Cập nhật bệnh nhân" modal as nhapbenhnhan (not xutri)', () => {
        // Tạo iframe với ID divDlgNhapBenhNhanifmView — phải được nhận diện là 'nhapbenhnhan'
        const { iframe } = createIframeModal('', 'http://his.vn/ntu01h002_nhapbenhnhan', 10);
        iframe.id = 'divDlgNhapBenhNhanifmView';

        window.VNPTClinicalFill.init();

        const btn = document.getElementById('vnpt-clinical-fill-btn');
        expect(btn).not.toBeNull();
        expect(btn.dataset.formType).toBe('nhapbenhnhan');
    });

    it('prioritizes "Chuyển viện" modal over "Nhập bệnh nhân" when z-index is higher', () => {
        // Modal A: Nhập bệnh nhân (zIndex: 100)
        const { iframe: iframeNBN } = createIframeModal('', 'http://his.vn/nhapbenhnhan', 100);
        iframeNBN.id = 'divDlgNhapBenhNhanifmView';

        // Modal B: Chuyển viện (zIndex: 101)
        createIframeModal('Chuyển viện tuyến', 'http://his.vn/chuyenvien', 101);

        window.VNPTClinicalFill.init();

        const btn = document.getElementById('vnpt-clinical-fill-btn');
        expect(btn).not.toBeNull();
        expect(btn.dataset.formType).toBe('chuyenvien');
    });

    it('detects nhapbenhnhan by modal title "Cập nhật bệnh nhân"', () => {
        createIframeModal('Cập nhật bệnh nhân', 'http://his.vn/someform', 10);

        window.VNPTClinicalFill.init();

        const btn = document.getElementById('vnpt-clinical-fill-btn');
        expect(btn).not.toBeNull();
        expect(btn.dataset.formType).toBe('nhapbenhnhan');
    });
});
