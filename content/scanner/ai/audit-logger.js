const AIAuditLogger = {
    /**
     * @param {string} patientId 
     * @param {string} inputData 
     * @param {string} outputData 
     * @param {string} model 
     * @param {number} [tokens] - Total tokens used
     * @returns {Promise<void>}
     */
    async log(patientId, inputData, outputData, model, tokens = 0) {
        const now = new Date();
        // SECURITY: Redact PHI — never store patient data or AI input/output in logs
        const logEntry = {
            timestamp: now.toISOString(),
            patientId: patientId ? '***' : 'UNKNOWN',  // Always mask
            model: model,
            inputLength: (inputData || '').length,    // Only store length, not content
            outputLength: (outputData || '').length,   // Only store length, not content
            tokens: tokens
        };

        return new Promise((resolve) => {
            chrome.storage.local.get(['ai_audit_logs', 'ai_daily_usage'], (/** @type {any} */ result) => {
                // --- Audit Logs ---
                let logs = result.ai_audit_logs || [];
                logs.unshift(logEntry);
                // SECURITY: Reduced retention (200 entries max, 7-day auto-purge)
                const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
                logs = logs.filter(l => l.timestamp > sevenDaysAgo);
                if (logs.length > 200) logs.length = 200;

                // --- Daily Usage Tracker ---
                const todayKey = now.toISOString().split('T')[0]; // "2026-03-28"
                const usage = result.ai_daily_usage || {};

                // Reset nếu ngày cũ
                if (usage.date !== todayKey) {
                    usage.date = todayKey;
                    usage.requests = 0;
                    usage.tokens = 0;
                    usage.cost = 0;
                }

                usage.requests += 1;
                usage.tokens += tokens;

                chrome.storage.local.set({
                    ai_audit_logs: logs,
                    ai_daily_usage: usage
                }, () => resolve());
            });
        });
    },

    /**
     * Cập nhật chi phí ước tính cho lần gọi gần nhất
     * @param {number} cost - Chi phí VNĐ
     * @returns {Promise<void>}
     */
    async addCost(cost) {
        return new Promise((resolve) => {
            chrome.storage.local.get(['ai_daily_usage'], (/** @type {any} */ result) => {
                const usage = result.ai_daily_usage || { date: new Date().toISOString().split('T')[0], requests: 0, tokens: 0, cost: 0 };
                usage.cost = (usage.cost || 0) + cost;
                chrome.storage.local.set({ ai_daily_usage: usage }, () => resolve());
            });
        });
    },

    /**
     * Lấy thống kê sử dụng hôm nay
     * @returns {Promise<{date: string, requests: number, tokens: number, cost: number}>}
     */
    async getTodayUsage() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['ai_daily_usage'], (/** @type {any} */ result) => {
                const usage = result.ai_daily_usage || { date: '', requests: 0, tokens: 0, cost: 0 };
                const today = new Date().toISOString().split('T')[0];
                if (usage.date !== today) {
                    resolve({ date: today, requests: 0, tokens: 0, cost: 0 });
                } else {
                    resolve(usage);
                }
            });
        });
    },

    /**
     * @returns {Promise<any[]>}
     */
    async getLogs() {
        return new Promise((resolve) => {
            chrome.storage.local.get(['ai_audit_logs'], (/** @type {any} */ result) => {
                resolve(result.ai_audit_logs || []);
            });
        });
    },

    /**
     * @returns {Promise<void>}
     */
    async clearLogs() {
        return new Promise((resolve) => {
            chrome.storage.local.remove(['ai_audit_logs', 'ai_daily_usage'], () => resolve());
        });
    }
};

/** @type {any} */
(window).AIAuditLogger = AIAuditLogger;
