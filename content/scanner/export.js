/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Export (Report Export Functionality)
 * 
 * Xuất báo cáo quét thuốc ra CSV/JSON
 */

const VNPTExport = (function () {
    /**
     * @typedef {Object} ExportOptions
     * @property {string} [filename]
     */

    /**
     * Export scan results to CSV format
     * @param {ExportOptions} options - Export options
     */
    function exportToCSV(options = {}) {
        const results = getScanData();
        if (!results || results.length === 0) {
            showNotification('Không có dữ liệu để xuất', 'warning');
            return;
        }

        // [P2-SEC-001] Show PHI warning + log audit before download
        if (!confirmPhiExport('CSV')) return;
        logExportAudit('CSV', results.length);

        const filename = options.filename || `vnpt_scan_${formatDate(new Date())}.csv`;
        const headers = ['STT', 'Mã BN', 'Họ tên', 'Buồng', 'Trạng thái thuốc', 'Thời gian quét'];

        let csvContent = '\uFEFF'; // BOM for UTF-8
        csvContent += headers.join(',') + '\n';

        results.forEach((row, index) => {
            csvContent += [
                index + 1,
                escapeCSV(row.patientId || ''),
                escapeCSV(row.patientName || ''),
                escapeCSV(row.room || ''),
                row.status === 'UNSENT' ? 'CHƯA GỬI' : 'ĐÃ GỬI',
                row.scanTime || ''
            ].join(',') + '\n';
        });

        downloadFile(csvContent, filename, 'text/csv;charset=utf-8');
        showNotification(`Đã xuất ${results.length} dòng ra CSV`, 'success');
    }

    /**
     * Export scan results to JSON format
     * @param {ExportOptions} options - Export options
     */
    function exportToJSON(options = {}) {
        const results = getScanData();
        if (!results || results.length === 0) {
            showNotification('Không có dữ liệu để xuất', 'warning');
            return;
        }

        // [P2-SEC-001] Show PHI warning + log audit before download
        if (!confirmPhiExport('JSON')) return;
        logExportAudit('JSON', results.length);

        const filename = options.filename || `vnpt_scan_${formatDate(new Date())}.json`;
        const exportData = {
            exportTime: new Date().toISOString(),
            version: window.VNPTConfig?.VERSION || '2.2',
            totalRecords: results.length,
            summary: {
                unsent: results.filter(r => r.status === 'UNSENT').length,
                sent: results.filter(r => r.status !== 'UNSENT').length
            },
            data: results
        };

        const jsonContent = JSON.stringify(exportData, null, 2);
        downloadFile(jsonContent, filename, 'application/json');
        showNotification(`Đã xuất ${results.length} dòng ra JSON`, 'success');
    }

    /**
     * Get current scan data from store/storage
     */
    function getScanData() {
        if (!window.VNPTSelectors) return [];

        /** @type {Array<any>} */
        const data = [];

        // Get from VNPTStore if available
        const scanResults = window.VNPTStore?.get('scanResults') ||
            window.VNPTStorage?.getResults() || {};

        // Get patient info from grid
        const rows = document.querySelectorAll(VNPTSelectors.patientGrid.rows);
        rows.forEach(row => {
            const rowId = row.id;
            if (!rowId) return;

            const patientName = VNPTSelectors.utils.getText(/** @type {HTMLElement} */(row), VNPTSelectors.patientGrid.cells.name);
            const room = VNPTSelectors.utils.getText(/** @type {HTMLElement} */(row), VNPTSelectors.patientGrid.cells.room);

            data.push({
                patientId: rowId,
                patientName: patientName,
                room: room,
                status: scanResults[rowId] || 'UNKNOWN',
                scanTime: new Date().toLocaleString('vi-VN')
            });
        });

        return data;
    }

    /**
     * Download file to user's device
     * @param {string} content
     * @param {string} filename
     * @param {string} mimeType
     */
    function downloadFile(content, filename, mimeType) {
        const blob = new Blob([content], { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = filename;
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    }

    /**
     * Escape CSV special characters
     * @param {string|number} str
     */
    function escapeCSV(str) {
        if (!str) return '';
        str = String(str);
        if (str.includes(',') || str.includes('"') || str.includes('\n')) {
            return `"${str.replace(/"/g, '""')}"`;
        }
        return str;
    }

    /**
     * Format date for filename
     * @param {Date} date
     */
    function formatDate(date) {
        return date.toISOString().slice(0, 10).replace(/-/g, '');
    }

    /**
     * Show notification
     * @param {string} message
     * @param {'info'|'warning'|'success'} type
     */
    function showNotification(message, type) {
        if (window.VNPTRealtime) {
            window.VNPTRealtime.showToast(message, type);
        } else {
            alert(message);
        }
    }

    // ========================================
    // [P2-SEC-001] PHI Export Consent & Audit
    // ========================================

    /**
     * Show a native confirm dialog warning user about PHI in the export file.
     * Returns true if user confirms, false if cancelled.
     * @param {'CSV'|'JSON'} format
     * @returns {boolean}
     */
    function confirmPhiExport(format) {
        return window.confirm(
            '\u26a0\ufe0f C\u1ea2NH B\u00c1O B\u1ea2O M\u1eacT\n\n' +
            'File ' + format + ' n\u00e0y ch\u1ee9a th\u00f4ng tin b\u1ec7nh nh\u00e2n (M\u00e3 BN, H\u1ecd t\u00ean, Bu\u1ed3ng).\n\n' +
            '\u2705 Ch\u1ec9 l\u01b0u tr\u1eef tr\u00ean h\u1ec7 th\u1ed1ng n\u1ed9i b\u1ed9 b\u1ec7nh vi\u1ec7n.\n' +
            '\u274c Kh\u00f4ng g\u1eedi qua email, tin nh\u1eafn, ho\u1eb7c cloud c\u00e1 nh\u00e2n.\n\n' +
            'B\u1ea1n c\u00f3 ch\u1eafc ch\u1eafn mu\u1ed1n ti\u1ebfp t\u1ee5c?'
        );
    }

    /**
     * Log export event to ai_audit_logs for traceability.
     * @param {'CSV'|'JSON'} format
     * @param {number} count
     */
    function logExportAudit(format, count) {
        try {
            const _chrome = (/** @type {any} */(window)).chrome;
            if (!_chrome?.storage?.local) return;
            const entry = {
                timestamp: new Date().toISOString(),
                action: 'EXPORT_PHI',
                format,
                recordCount: count,
                url: location.pathname // No full URL to avoid token leakage
            };
            _chrome.storage.local.get(['ai_audit_logs'], (res) => {
                const logs = res.ai_audit_logs || [];
                logs.unshift(entry);
                _chrome.storage.local.set({ ai_audit_logs: logs.slice(0, 200) });
            });
        } catch (_) { /* ignore */ }
    }

    // Public API
    return {
        toCSV: exportToCSV,
        toJSON: exportToJSON,
        getData: getScanData
    };
})();

// Export globally
window.VNPTExport = VNPTExport;
