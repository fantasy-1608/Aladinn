/**
 * 🏥 HIS Shared — Diagnostic & Telemetry
 * Module Health Check và bọc lỗi, tuân thủ nghiêm ngặt bảo vệ dữ liệu nội bộ (PHI)
 */

window.HIS = window.HIS || {};

class HISDiagnostic {
    static STORAGE_KEY = 'aladinn_diagnostic_logs';
    static MAX_LOGS = 50;

    /**
     * Ghi nhận và lọc thông tin nhạy cảm. Không bao giờ lưu data y tế.
     */
    static async logError(error, actionName = 'UNKNOWN_ACTION', source = 'ALADINN_BUG') {
        const timestamp = new Date().toISOString();
        
        // Chỉ lưu thông tin kỹ thuật, TUYỆT ĐỐI không lưu phiển bản raw data
        const safeLog = {
            id: `err-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            timestamp,
            action: actionName,
            source, // 'VNPT_UI_CHANGE', 'ALADINN_BUG', 'NETWORK_CHANGE'
            errorName: error?.name || 'UnknownError',
            errorMessage: error?.message || String(error),
            stack: error?.stack ? error.stack.split('\n').slice(0, 3).join('\n') : ''
        };

        return new Promise((resolve) => {
            chrome.storage.local.get([this.STORAGE_KEY], (res) => {
                let logs = res[this.STORAGE_KEY] || [];
                logs.unshift(safeLog);
                if (logs.length > this.MAX_LOGS) {
                    logs.length = this.MAX_LOGS; // Cắt bỏ các log cũ
                }
                chrome.storage.local.set({ [this.STORAGE_KEY]: logs }, () => resolve(safeLog));
            });
        });
    }

    /**
     * Bọc (wrap) một hàm đồng bộ hoặc bất đồng bộ.
     * Tự động bắt lỗi và phân loại:
     * - TypeError liên quan tới reading properties of null -> khả năng cao VNPT_UI_CHANGE
     */
    static async runSafe(actionName, fn) {
        try {
            return await fn();
        } catch (error) {
            let source = 'ALADINN_BUG';
            const msg = error?.message || '';

            // Phác họa các lỗi đặc trưng khi VNPT thay đổi giao diện (Hụt DOM)
            if (msg.includes('Cannot read properties of null') || 
                msg.includes('querySelector') || 
                msg.includes('undefined is not an object')) {
                source = 'VNPT_UI_CHANGE';
            }

            console.error(`[HISDiagnostic] Lỗi tại ${actionName}:`, error);
            await this.logError(error, actionName, source);
            
            // Re-throw để logic bên ngoài (nếu có catch) tự xử lý UI, 
            // nhưng không throw thẳng ra console làm crash luồng chính.
            throw error; 
        }
    }

    /**
     * Đồng bộ hóa (Synchronous) phiên bản của runSafe
     */
    static runSafeSync(actionName, fn) {
        try {
            return fn();
        } catch (error) {
            let source = 'ALADINN_BUG';
            const msg = error?.message || '';

            if (msg.includes('Cannot read properties of null') || 
                msg.includes('querySelector') || 
                msg.includes('undefined is not an object')) {
                source = 'VNPT_UI_CHANGE';
            }

            console.error(`[HISDiagnostic] Lỗi tại ${actionName}:`, error);
            // Fire and forget logging
            this.logError(error, actionName, source);
            
            throw error; 
        }
    }

    static async getLogs() {
        return new Promise((resolve) => {
            chrome.storage.local.get([this.STORAGE_KEY], (res) => {
                resolve(res[this.STORAGE_KEY] || []);
            });
        });
    }

    static async clearLogs() {
        return new Promise((resolve) => {
            chrome.storage.local.remove([this.STORAGE_KEY], () => resolve());
        });
    }

    /**
     * Health Check cơ bản để xem giao diện hệ thống còn giống như khai báo VNPTSelectors không.
     */
    static async checkHealth() {
        if (typeof window.VNPTSelectors === 'undefined') return { status: 'SKIP' };
        
        const selectors = window.VNPTSelectors;
        let healthIssues = [];

        // Kiểm tra nhanh bảng bệnh nhân (Nếu đang ở trang Danh sách bệnh nhân)
        if (document.querySelector('body') && window.location.href.includes('TiepNhans')) {
            const grid = document.querySelector(selectors.patientGrid?.table || '#grdBenhNhan');
            if (!grid) {
                healthIssues.push('Mất bảng bệnh nhân #grdBenhNhan');
            }
        }

        if (healthIssues.length > 0) {
            await this.logError(new Error(`Failed Health Check: ${healthIssues.join(', ')}`), 'SYSTEM_STARTUP', 'VNPT_UI_CHANGE');
            return { status: 'UNHEALTHY', issues: healthIssues };
        }

        return { status: 'HEALTHY' };
    }
}

window.HIS.Diagnostic = HISDiagnostic;
export default HISDiagnostic;
