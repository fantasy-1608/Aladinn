/**
 * 🧞 Aladinn — Advanced Sign Module: Core Logic
 * Calls VNPT HIS API to fetch all unsigned documents for a patient,
 * filters by creator, then opens each in an iframe for sequential signing.
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.AdvancedSign = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    // State
    const STATE = {
        queue: [],
        currentIndex: -1,
        isActive: false,
        stats: { completed: 0, skipped: 0, failed: 0 },
        currentPatient: null
    };

    // API Constants
    const API = {
        BASE_URL: '/vnpthis/RestService',
        // Query to list documents for a patient (phiếu chờ ký)
        DOCUMENT_LIST_QUERY: 'NTU01H101.02',
        // Query to list patients on sign page
        PATIENT_LIST_QUERY: 'NTU01H100.EV001'
    };

    /**
     * Extract JWT uuid from any existing XHR on page.
     * HIS stores this in a global JS variable.
     */
    function getJwtToken() {
        // Method 1: Try window._uuid (common HIS global)
        try {
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const win = iframe.contentWindow;
                    if (win && win._uuid) return win._uuid;
                    if (win && win.uuid) return win.uuid;
                } catch (_e) { /* cross-origin */ }
            }
            if (window._uuid) return window._uuid;
            if (window.uuid) return window.uuid;
        } catch (_e) { /* */ }

        // Method 2: Try to find in page scripts via known pattern
        try {
            const scripts = document.querySelectorAll('script:not([src])');
            for (const script of scripts) {
                const text = script.textContent || '';
                const match = text.match(/["']uuid["']\s*:\s*["'](eyJ[^"']+)["']/);
                if (match) return match[1];
                const match2 = text.match(/_uuid\s*=\s*["'](eyJ[^"']+)["']/);
                if (match2) return match2[1];
            }
        } catch (_e) { /* */ }

        // Method 3: Intercept from stored token
        try {
            if (window.__ALADINN_HIS_UUID__) return window.__ALADINN_HIS_UUID__;
        } catch (_e) { /* */ }

        return null;
    }

    /**
     * Store JWT token when intercepted by other modules
     */
    function setJwtToken(token) {
        window.__ALADINN_HIS_UUID__ = token;
    }

    /**
     * Fetch list of documents for a patient
     * @param {string} hosobenhanId - HOSOBENHANID
     * @param {string} tiepnhanId - TIEPNHANID
     * @returns {Promise<Array>} list of documents
     */
    async function fetchPatientDocuments(hosobenhanId, tiepnhanId) {
        const uuid = getJwtToken();
        if (!uuid) {
            if (Logger) Logger.error('AdvSign', 'Không tìm thấy JWT token. Vui lòng thao tác 1 lần trên HIS trước.');
            throw new Error('JWT token not found');
        }

        const postData = {
            func: 'ajaxExecuteQueryPaging',
            uuid: uuid,
            params: [API.DOCUMENT_LIST_QUERY],
            options: [{
                name: '[0]',
                value: JSON.stringify({
                    HOSOBENHANID: String(hosobenhanId),
                    TIEPNHANID: String(tiepnhanId),
                    TRANGTHAI: '-1' // All statuses
                })
            }]
        };

        const url = new URL(API.BASE_URL, window.location.origin);
        url.searchParams.set('postData', JSON.stringify(postData));
        url.searchParams.set('_search', 'false');
        url.searchParams.set('nd', String(Date.now()));
        url.searchParams.set('rows', '1000');
        url.searchParams.set('page', '1');
        url.searchParams.set('sidx', 'TENPHIEU asc, ');
        url.searchParams.set('sord', 'asc');

        if (Logger) Logger.info('AdvSign', `Fetching documents for HSBA=${hosobenhanId}...`);

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include' // Send cookies (JSESSIONID)
        });

        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }

        const data = await response.json();
        if (Logger) Logger.info('AdvSign', `Received ${data.records || 0} documents`);
        return data.rows || [];
    }

    /**
     * Filter documents: unsigned + created by current user
     */
    function getUnsignedByCreator(documents, creatorName) {
        if (!creatorName) {
            // If no creator specified, return all unsigned
            return documents.filter(doc => doc.FLAG_CA === '0');
        }

        const normalizedCreator = creatorName.trim().toLowerCase();
        return documents.filter(doc => {
            const isUnsigned = doc.FLAG_CA === '0';
            const creator = (doc.NGUOITAO || '').trim().toLowerCase();
            const creatorMatch = creator.includes(normalizedCreator) || normalizedCreator.includes(creator);
            return isUnsigned && creatorMatch;
        });
    }

    /**
     * Get ALL unsigned documents (regardless of creator)
     */
    function getAllUnsigned(documents) {
        return documents.filter(doc => doc.FLAG_CA === '0');
    }

    /**
     * Get summary of documents grouped by type
     */
    function getDocumentSummary(documents) {
        const summary = {
            total: documents.length,
            signed: 0,
            unsigned: 0,
            byCreator: {},
            byType: {}
        };

        for (const doc of documents) {
            if (doc.FLAG_CA === '1') summary.signed++;
            else summary.unsigned++;

            const creator = doc.NGUOITAO || 'Không rõ';
            if (!summary.byCreator[creator]) summary.byCreator[creator] = { signed: 0, unsigned: 0 };
            if (doc.FLAG_CA === '1') summary.byCreator[creator].signed++;
            else summary.byCreator[creator].unsigned++;

            const type = doc.TENPHIEU || 'Không rõ';
            if (!summary.byType[type]) summary.byType[type] = 0;
            summary.byType[type]++;
        }

        return summary;
    }

    /**
     * Extract patient info from the currently selected row on the main page
     */
    function getSelectedPatientInfo() {
        // Try to get from the highlighted row in the main patient grid
        const selectedRow = document.querySelector('tr.ui-state-highlight, tr.jqgrow.ui-state-highlight');
        if (!selectedRow) return null;

        const cells = selectedRow.querySelectorAll('td');
        if (cells.length < 5) return null;

        // Extract MABENHAN from cells - look for aria-describedby
        let mabenhan = '';
        let tenbenhnhan = '';
        let mabenhnhan = '';

        for (const cell of cells) {
            const ariaDesc = (cell.getAttribute('aria-describedby') || '').toUpperCase();
            const text = cell.textContent.trim();
            if (ariaDesc.includes('MAHOSOBENHAN') || ariaDesc.includes('MABENHAN') || ariaDesc.includes('MBA')) {
                if (/^\d{10}$/.test(text)) mabenhan = text;
            }
            if (ariaDesc.includes('TENBENHNHAN') || ariaDesc.includes('TEN_BN') || ariaDesc.includes('HOTEN')) {
                tenbenhnhan = text;
            }
            if (ariaDesc.includes('MABENHNHAN') || ariaDesc.includes('MBN')) {
                mabenhnhan = text;
            }
        }

        // Fallback: scan cells by position
        if (!mabenhan) {
            for (const cell of cells) {
                const text = cell.textContent.trim();
                if (/^\d{10}$/.test(text)) { mabenhan = text; break; }
            }
        }
        if (!tenbenhnhan) {
            // Patient name is usually the longest text cell
            let maxLen = 0;
            for (let i = 2; i < Math.min(cells.length, 7); i++) {
                const t = cells[i].textContent.trim();
                if (t.length > maxLen && !/^\d+$/.test(t) && t.length > 3) {
                    maxLen = t.length;
                    tenbenhnhan = t;
                }
            }
        }

        return { mabenhan, tenbenhnhan, mabenhnhan };
    }

    /**
     * Search for a patient on the signing page API by MABENHAN
     */
    async function findPatientOnSignPage(mabenhan) {
        const uuid = getJwtToken();
        if (!uuid) throw new Error('JWT token not found');

        // Get khoaid from the current page context
        let khoaid = '-1';
        try {
            // Try to extract from page footer or existing requests
            const footerText = document.body.innerText;
            const khoaMatch = footerText.match(/khoaid[=:]\s*["']?(\d+)["']?/i);
            if (khoaMatch) khoaid = khoaMatch[1];
        } catch (_e) { /* */ }

        const postData = {
            func: 'ajaxExecuteQueryPaging',
            uuid: uuid,
            params: [API.PATIENT_LIST_QUERY],
            options: [{
                name: '[0]',
                value: JSON.stringify({
                    ngaybatdau: getDateNDaysAgo(30),
                    ngayketthuc: getTodayDate(),
                    mabenhan: String(mabenhan),
                    khoaid: khoaid,
                    trangthaiid: '-1'
                })
            }]
        };

        const url = new URL(API.BASE_URL, window.location.origin);
        url.searchParams.set('postData', JSON.stringify(postData));
        url.searchParams.set('_search', 'false');
        url.searchParams.set('nd', String(Date.now()));
        url.searchParams.set('rows', '20');
        url.searchParams.set('page', '1');
        url.searchParams.set('sidx', '');
        url.searchParams.set('sord', 'asc');

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Accept': 'application/json, text/javascript, */*; q=0.01',
                'X-Requested-With': 'XMLHttpRequest'
            },
            credentials: 'include'
        });

        if (!response.ok) throw new Error(`API error: ${response.status}`);
        const data = await response.json();
        return data.rows || [];
    }

    // Date helpers
    function getTodayDate() {
        const d = new Date();
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    function getDateNDaysAgo(n) {
        const d = new Date();
        d.setDate(d.getDate() - n);
        return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
    }

    /**
     * Build the URL to open a specific document for signing.
     * This opens the NTU01H101 dialog page with the document pre-selected.
     */
    function buildSignPageURL(hosobenhanId, tiepnhanId) {
        return `${window.location.origin}/vnpthis/main/manager.jsp?func=../noitru/NTU01H101_DayLaiBenhAn&showMode=dlg&hosobenhanid=${hosobenhanId}&tiepnhanid=${tiepnhanId}`;
    }

    /**
     * Start the advanced signing workflow
     */
    function startAdvancedSession(documents, patientInfo) {
        STATE.queue = [...documents];
        STATE.currentIndex = -1;
        STATE.isActive = true;
        STATE.stats = { completed: 0, skipped: 0, failed: 0 };
        STATE.currentPatient = patientInfo;

        if (Logger) Logger.info('AdvSign', `Starting advanced sign: ${documents.length} documents for ${patientInfo?.tenbenhnhan || 'Unknown'}`);
    }

    function stopAdvancedSession() {
        STATE.isActive = false;
        STATE.queue = [];
        STATE.currentIndex = -1;
        STATE.currentPatient = null;
    }

    function getState() {
        return { ...STATE };
    }

    // Listen for JWT token from intercepted requests
    window.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'ALADINN_HIS_UUID') {
            setJwtToken(event.data.uuid);
        }
    });

    return {
        fetchPatientDocuments,
        findPatientOnSignPage,
        getUnsignedByCreator,
        getAllUnsigned,
        getDocumentSummary,
        getSelectedPatientInfo,
        getJwtToken,
        setJwtToken,
        startAdvancedSession,
        stopAdvancedSession,
        getState,
        buildSignPageURL,
        API
    };
})();

console.log('[Aladinn] 🧞 Advanced Sign core loaded');
