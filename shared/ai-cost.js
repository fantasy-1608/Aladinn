/**
 * 💰 Aladinn — AI Cost Estimator
 * Ước tính chi phí gọi Gemini API dựa trên token usage.
 * Chỉ hỗ trợ Gemini 2.x và 2.5.x (không dùng 1.x).
 *
 * Cách dùng:
 *   const est = HIS.AICost.estimate(model, inputTokens, outputTokens);
 *   await HIS.AICost.record(model, inputTokens, outputTokens);
 *   const stats = await HIS.AICost.getDailyStats();
 */

window.HIS = window.HIS || {};

HIS.AICost = (function () {
    'use strict';

    const STORAGE_KEY = 'aladinn_ai_usage';
    const RATE_KEY    = 'aladinn_usd_rate';

    // Giá theo USD / 1 triệu token (Input / Output)
    // Nguồn: Google AI Studio Pricing (tháng 4/2026)
    const PRICING = {
        'gemini-2.5-pro':        { input: 1.25,  output: 10.00 },
        'gemini-2.5-flash':      { input: 0.15,  output: 0.60  },
        'gemini-2.5-flash-lite': { input: 0.10,  output: 0.40  },
        'gemini-2.0-flash':      { input: 0.10,  output: 0.40  },
        'gemini-2.0-flash-lite': { input: 0.075, output: 0.30  },
    };

    const DEFAULT_USD_RATE = 25500;

    /**
     * Lấy tỷ giá từ chrome.storage.local (đồng bộ giữa content và options page).
     */
    async function getUsdRate() {
        try {
            const res = await chrome.storage.local.get([RATE_KEY]);
            const rate = res[RATE_KEY] ? parseFloat(res[RATE_KEY]) : NaN;
            return (!isNaN(rate) && rate > 1000) ? rate : DEFAULT_USD_RATE;
        } catch (_) {
            return DEFAULT_USD_RATE;
        }
    }

    /**
     * Ước tính chi phí một lần gọi AI.
     */
    function estimateSync(model, inputTokens = 0, outputTokens = 0, usdRate = DEFAULT_USD_RATE) {
        const price = PRICING[model] || PRICING['gemini-2.0-flash'];
        const inputCost  = (inputTokens  / 1_000_000) * price.input;
        const outputCost = (outputTokens / 1_000_000) * price.output;
        const totalUsd   = inputCost + outputCost;
        const totalVnd   = totalUsd * usdRate;
        const totalTokens = inputTokens + outputTokens;

        let vndDisplay;
        if (totalVnd < 1) {
            vndDisplay = '<1đ';
        } else if (totalVnd < 1000) {
            vndDisplay = `≈${Math.round(totalVnd)}đ`;
        } else {
            vndDisplay = `≈${(totalVnd / 1000).toFixed(1)}kđ`;
        }

        return { totalTokens, usd: totalUsd, vnd: totalVnd, vndDisplay };
    }

    async function estimate(model, inputTokens = 0, outputTokens = 0) {
        const usdRate = await getUsdRate();
        return estimateSync(model, inputTokens, outputTokens, usdRate);
    }

    /**
     * Ghi nhận một lần gọi AI vào chrome.storage.local (cộng dồn theo ngày).
     * Dùng async vì chrome.storage.local là async API.
     */
    async function record(model, inputTokens = 0, outputTokens = 0) {
        try {
            const today = new Date().toDateString();
            const usdRate = await getUsdRate();
            const est = estimateSync(model, inputTokens, outputTokens, usdRate);

            const stored = await chrome.storage.local.get([STORAGE_KEY]);
            let data = stored[STORAGE_KEY] || {};

            if (data.date !== today) {
                data = { date: today, totalTokens: 0, totalVnd: 0, callCount: 0, byModel: {} };
            }

            data.totalTokens = (data.totalTokens || 0) + est.totalTokens;
            data.totalVnd    = (data.totalVnd || 0)    + est.vnd;
            data.callCount   = (data.callCount || 0)   + 1;

            if (!data.byModel) data.byModel = {};
            if (!data.byModel[model]) data.byModel[model] = { tokens: 0, vnd: 0, calls: 0 };
            data.byModel[model].tokens += est.totalTokens;
            data.byModel[model].vnd    += est.vnd;
            data.byModel[model].calls  += 1;

            await chrome.storage.local.set({ [STORAGE_KEY]: data });
            return est;
        } catch (_) {
            return null;
        }
    }

    /**
     * Lấy thống kê sử dụng AI hôm nay từ chrome.storage.local.
     */
    async function getDailyStats() {
        try {
            const today = new Date().toDateString();
            const stored = await chrome.storage.local.get([STORAGE_KEY]);
            const data = stored[STORAGE_KEY] || {};
            if (data.date !== today) {
                return { date: today, totalTokens: 0, totalVnd: 0, callCount: 0, byModel: {} };
            }
            return data;
        } catch (_) {
            return { date: '', totalTokens: 0, totalVnd: 0, callCount: 0, byModel: {} };
        }
    }

    /**
     * Render badge chi phí (vẫn giữ để tương thích backward, nhưng không dùng inline nữa).
     */
    function renderCostBadge(_model, _usageMetadata) {
        return '';
    }

    return { estimate, estimateSync, record, getDailyStats, renderCostBadge, getUsdRate };
})();
