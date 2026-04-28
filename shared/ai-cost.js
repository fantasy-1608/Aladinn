/**
 * 💰 Aladinn — AI Cost Estimator
 * Ước tính chi phí gọi Gemini API dựa trên token usage.
 * Chỉ hỗ trợ Gemini 2.x và 2.5.x (không dùng 1.x).
 *
 * Cách dùng:
 *   const est = HIS.AICost.estimate(model, inputTokens, outputTokens);
 *   HIS.AICost.record(model, inputTokens, outputTokens);
 *   const stats = HIS.AICost.getDailyStats();
 */

window.HIS = window.HIS || {};

HIS.AICost = (function () {
    'use strict';

    const STORAGE_KEY = 'aladinn_ai_usage';
    const RATE_KEY = 'aladinn_usd_rate';

    // Giá theo USD / 1 triệu token (Input / Output)
    // Nguồn: Google AI Studio Pricing (tháng 4/2026)
    const PRICING = {
        'gemini-2.5-pro':        { input: 1.25,  output: 10.00 },
        'gemini-2.5-flash':      { input: 0.15,  output: 0.60  },
        'gemini-2.5-flash-lite': { input: 0.10,  output: 0.40  },
        'gemini-2.0-flash':      { input: 0.10,  output: 0.40  },
        'gemini-2.0-flash-lite': { input: 0.075, output: 0.30  },
    };

    const DEFAULT_USD_RATE = 25500; // VNĐ / 1 USD

    /**
     * Lấy tỷ giá USD→VNĐ từ localStorage (người dùng có thể tuỳ chỉnh trong Options).
     */
    function getUsdRate() {
        try {
            const raw = localStorage.getItem(RATE_KEY);
            const rate = raw ? parseFloat(raw) : NaN;
            return (!isNaN(rate) && rate > 1000) ? rate : DEFAULT_USD_RATE;
        } catch (_) {
            return DEFAULT_USD_RATE;
        }
    }

    /**
     * Ước tính chi phí một lần gọi AI.
     * @param {string} model - Tên model (vd: 'gemini-2.5-flash')
     * @param {number} inputTokens
     * @param {number} outputTokens
     * @returns {{ totalTokens: number, usd: number, vnd: number, vndDisplay: string }}
     */
    function estimate(model, inputTokens = 0, outputTokens = 0) {
        const price = PRICING[model] || PRICING['gemini-2.0-flash'];
        const usdRate = getUsdRate();

        const inputCost  = (inputTokens  / 1_000_000) * price.input;
        const outputCost = (outputTokens / 1_000_000) * price.output;
        const totalUsd   = inputCost + outputCost;
        const totalVnd   = totalUsd * usdRate;
        const totalTokens = inputTokens + outputTokens;

        // Format VNĐ cho dễ đọc
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

    /**
     * Ghi nhận một lần gọi AI vào localStorage (cộng dồn theo ngày).
     */
    function record(model, inputTokens = 0, outputTokens = 0) {
        try {
            const today = new Date().toDateString();
            const raw = localStorage.getItem(STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};

            if (data.date !== today) {
                // Reset theo ngày
                data.date = today;
                data.totalTokens = 0;
                data.totalVnd = 0;
                data.callCount = 0;
                data.byModel = {};
            }

            const est = estimate(model, inputTokens, outputTokens);
            data.totalTokens = (data.totalTokens || 0) + est.totalTokens;
            data.totalVnd    = (data.totalVnd || 0)    + est.vnd;
            data.callCount   = (data.callCount || 0)   + 1;

            if (!data.byModel) data.byModel = {};
            if (!data.byModel[model]) data.byModel[model] = { tokens: 0, vnd: 0, calls: 0 };
            data.byModel[model].tokens += est.totalTokens;
            data.byModel[model].vnd    += est.vnd;
            data.byModel[model].calls  += 1;

            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
            return est;
        } catch (_) {
            return null;
        }
    }

    /**
     * Lấy thống kê sử dụng AI trong ngày hôm nay.
     * @returns {{ date, totalTokens, totalVnd, callCount, byModel }}
     */
    function getDailyStats() {
        try {
            const today = new Date().toDateString();
            const raw = localStorage.getItem(STORAGE_KEY);
            const data = raw ? JSON.parse(raw) : {};

            if (data.date !== today) {
                return { date: today, totalTokens: 0, totalVnd: 0, callCount: 0, byModel: {} };
            }
            return data;
        } catch (_) {
            return { date: '', totalTokens: 0, totalVnd: 0, callCount: 0, byModel: {} };
        }
    }

    /**
     * Render dòng chi phí nhỏ hiển thị dưới kết quả AI.
     * @param {string} model
     * @param {object} usageMetadata - Từ Gemini API response.usageMetadata
     * @returns {string} HTML string
     */
    function renderCostBadge(model, usageMetadata) {
        if (!usageMetadata) return '';
        const inputTokens  = usageMetadata.promptTokenCount      || 0;
        const outputTokens = usageMetadata.candidatesTokenCount   || 0;
        if (inputTokens + outputTokens === 0) return '';

        const est = record(model, inputTokens, outputTokens);
        if (!est) return '';

        const modelShort = model.replace('gemini-', '');
        return `<div style="margin-top:8px; font-size:10px; color:#5a5450; display:flex; align-items:center; gap:6px;">
            <span>💰</span>
            <span>~${est.totalTokens.toLocaleString()} token · ${est.vndDisplay}</span>
            <span style="opacity:0.5">· ${modelShort}</span>
        </div>`;
    }

    return { estimate, record, getDailyStats, renderCostBadge, getUsdRate };
})();
