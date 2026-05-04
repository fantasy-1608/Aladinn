/* global AIAuditLogger */
void (() => {
    /**
     * @param {string} rawTreatments
     * @param {string} [_apiKey] Deprecated. API key is resolved only in background.
     * @param {string} [model="gemini-2.0-flash-lite-preview-02-05"]
     * @param {string} [patientId="UNKNOWN"]
     * @param {string} [targetField="QUATRINHBENHLY"]
     */
    async function summarizeHistory(rawTreatments, _apiKey, model = 'gemini-2.0-flash-lite-preview-02-05', patientId = 'UNKNOWN', targetField = 'QUATRINHBENHLY') {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'SCANNER_SUMMARIZE_HISTORY',
                payload: { rawTreatments, model, patientId, targetField }
            });
            if (!response?.ok) {
                throw new Error(response?.error?.message || 'Lỗi giao tiếp với máy chủ AI (Gemini)');
            }

            let output = response.data?.text || '';
            const usage = response.data?.usageMetadata || {};

            let totalTokens = 0;
            let totalCost = 0;
            if (usage) {
                const promptTokens = usage.promptTokenCount || 0;
                const responseTokens = usage.candidatesTokenCount || 0;
                totalTokens = promptTokens + responseTokens;

                let pricePromptVND = 1.875;
                let priceRespVND = 7.5;
                const modelLower = model.toLowerCase();

                if (modelLower.includes('exp') || modelLower.includes('preview')) {
                    pricePromptVND = 0; priceRespVND = 0;
                } else if (modelLower.includes('3.5') || modelLower.includes('3-flash')) {
                    pricePromptVND = 3.825; priceRespVND = 15.3;
                } else if (modelLower.includes('lite')) {
                    pricePromptVND = 1.875; priceRespVND = 7.5;
                } else if (modelLower.includes('2.5-flash') || modelLower.includes('2.0-flash')) {
                    pricePromptVND = 2.5; priceRespVND = 10;
                } else if (modelLower.includes('1.5-flash')) {
                    pricePromptVND = 1.875; priceRespVND = 7.5;
                } else if (modelLower.includes('pro')) {
                    pricePromptVND = 31.25; priceRespVND = 125;
                }

                totalCost = (promptTokens * pricePromptVND + responseTokens * priceRespVND) / 1000;
            }

            await AIAuditLogger.log(patientId, rawTreatments, output, model, totalTokens);
            if (totalCost > 0) await AIAuditLogger.addCost(totalCost);

            if (totalTokens > 0 && window.VNPTRealtime) {
                const formattedCost = totalCost === 0
                    ? '0đ (Miễn phí)'
                    : (totalCost < 1 ? '< 1đ' : Math.round(totalCost).toLocaleString('vi-VN') + 'đ');
                const modelShort = model.replace('models/', '').split('-').slice(0, 3).join('-');
                const todayUsage = await AIAuditLogger.getTodayUsage();
                const dailyInfo = `📊 Hôm nay: ${todayUsage.requests}/1.500 requests | ${todayUsage.tokens.toLocaleString('vi-VN')} tokens`;
                const dailyCost = todayUsage.cost > 0
                    ? ` | ~${Math.round(todayUsage.cost).toLocaleString('vi-VN')}đ`
                    : ' | Miễn phí';

                window.VNPTRealtime.showToast(
                    `✅ AI VIP xong! 💰 ~${formattedCost} | ${totalTokens} tokens (${modelShort})\n${dailyInfo}${dailyCost}`,
                    'success'
                );
            }

            output = output
                .replace(/sinh tồn/gi, 'sinh hiệu')
                .replace(/dấu hiệu sinh tồn/gi, 'dấu hiệu sinh hiệu');

            return output.trim();
        } catch (error) {
            console.error('[GeminiAPI] Error:', error);
            throw error;
        }
    }

    /**
     * Lấy danh sách mô hình khả dụng qua background AI gateway.
     * @param {string} [_apiKey] Deprecated. API key is resolved only in background.
     */
    async function fetchModels(_apiKey) {
        try {
            const response = await chrome.runtime.sendMessage({
                type: 'AI_LIST_MODELS',
                payload: {}
            });
            if (!response?.ok) {
                throw new Error(response?.error?.message || 'Không thể lấy danh sách mô hình');
            }
            const models = response.data?.models || [];
            console.log(`[GeminiAPI] Tìm thấy ${models.length} mô hình khả dụng.`);
            return models;
        } catch (error) {
            console.error('[GeminiAPI] Lỗi khi fetch models:', error);
            throw error;
        }
    }

    const api = { summarizeHistory, fetchModels };
    /** @type {any} */
    (window).GeminiAPI = api;

    return api;
})();
