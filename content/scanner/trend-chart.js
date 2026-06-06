/**
 * 🧞 Aladinn — Trend Chart Engine (Canvas-based)
 * Zero dependency. GPU-accelerated via transform/opacity only.
 * Designed for clinical lab trend visualization in Chrome Extension context.
 *
 * @module TrendChart
 */

'use strict';

(function () {
    // ─── Constants ────────────────────────────────────────────────────────────
    const PADDING = { top: 24, right: 16, bottom: 48, left: 52 };
    const COLORS = {
        line:           '#1e5494',
        lineNormal:     '#2e7d32',
        lineHigh:       '#c62828',
        lineLow:        '#e65100',
        dot:            '#1e5494',
        dotHigh:        '#c62828',
        dotLow:         '#e65100',
        dotNormal:      '#2e7d32',
        refBand:        'rgba(46, 125, 50, 0.07)',
        refLine:        'rgba(46, 125, 50, 0.35)',
        gridLine:       'rgba(0, 0, 0, 0.07)',
        axisText:       '#555555',
        dateText:       '#666666',
        background:     '#ffffff',
        tooltipBg:      'rgba(30, 84, 148, 0.92)',
        tooltipText:    '#ffffff',
        crosshair:      'rgba(30, 84, 148, 0.3)',
    };
    const FONT_FAMILY = "'Segoe UI', system-ui, sans-serif";
    const DOT_RADIUS  = 5;

    /**
     * @typedef {Object} TrendPoint
     * @property {string|number} date   — ISO date or display string
     * @property {number}        value  — numeric value
     * @property {string}        [status] — 'Cao' | 'Thấp' | ''
     * @property {string}        [label] — override display date
     */

    /**
     * @typedef {Object} TrendChartOptions
     * @property {number}  [refMin]      — reference range minimum
     * @property {number}  [refMax]      — reference range maximum
     * @property {string}  [unit]        — unit string, shown in tooltip
     * @property {string}  [metricLabel] — metric name, shown in tooltip
     * @property {boolean} [animate]     — enable draw animation (default true)
     */

    // ─── Helpers ──────────────────────────────────────────────────────────────
    function clamp(val, lo, hi) { return Math.max(lo, Math.min(hi, val)); }

    /**
     * Format a date string for axis display: "DD/MM" or "N/A"
     * @param {string|number} raw
     * @returns {string}
     */
    function fmtAxisDate(raw) {
        if (!raw) return '';
        const s = String(raw);
        // DD/MM/YYYY HH:mm
        const m1 = s.match(/^(\d{2})\/(\d{2})\/\d{4}/);
        if (m1) return `${m1[1]}/${m1[2]}`;
        // YYYY-MM-DD
        const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m2) return `${m2[3]}/${m2[2]}`;
        return s.slice(0, 5);
    }

    /**
     * Format a date string for tooltip: "DD/MM/YYYY"
     */
    function fmtTooltipDate(raw) {
        if (!raw) return '';
        const s = String(raw);
        const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})/);
        if (m1) return `${m1[1]}/${m1[2]}/${m1[3]}`;
        const m2 = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m2) return `${m2[3]}/${m2[2]}/${m2[1]}`;
        return s.slice(0, 10);
    }

    /**
     * Parse sortable timestamp for ordering data points.
     * @param {string|number} raw
     * @returns {number} ms timestamp
     */
    function parseTimestamp(raw) {
        if (!raw) return 0;
        const s = String(raw);
        // DD/MM/YYYY HH:mm
        const m1 = s.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2}))?/);
        if (m1) {
            return new Date(
                +m1[3], +m1[2] - 1, +m1[1],
                m1[4] ? +m1[4] : 0, m1[5] ? +m1[5] : 0
            ).getTime();
        }
        // ISO / YYYY-MM-DD
        const d = new Date(s);
        return isNaN(d.getTime()) ? 0 : d.getTime();
    }

    // ─── Core renderer ────────────────────────────────────────────────────────
    /**
     * Render a clinical trend line chart onto a <canvas> element.
     *
     * @param {HTMLCanvasElement}  canvas
     * @param {TrendPoint[]}       points   — must have ≥1 entry
     * @param {TrendChartOptions}  [opts]
     */
    function renderTrendChart(canvas, points, opts) {
        if (!canvas || typeof canvas.getContext !== 'function') return;
        if (!points || points.length === 0) return;

        opts = opts || {};
        const refMin = (opts.refMin !== undefined && opts.refMin !== null && !isNaN(+opts.refMin)) ? +opts.refMin : null;
        const refMax = (opts.refMax !== undefined && opts.refMax !== null && !isNaN(+opts.refMax)) ? +opts.refMax : null;
        const unit   = opts.unit || '';
        const metricLabel = opts.metricLabel || '';

        // Sort by date
        const sorted = [...points].sort((a, b) => parseTimestamp(a.date) - parseTimestamp(b.date));

        const ctx    = canvas.getContext('2d');
        const W      = canvas.width;
        const H      = canvas.height;
        const padL   = PADDING.left;
        const padR   = PADDING.right;
        const padT   = PADDING.top;
        const padB   = PADDING.bottom;
        const chartW = W - padL - padR;
        const chartH = H - padT - padB;

        // ── Compute Y range ──
        const values = sorted.map(p => p.value).filter(v => typeof v === 'number' && isFinite(v));
        if (values.length === 0) return;

        let yMin = Math.min(...values, refMin !== null ? refMin : Infinity);
        let yMax = Math.max(...values, refMax !== null ? refMax : -Infinity);
        if (yMin === yMax) { yMin -= 1; yMax += 1; }
        const padding = (yMax - yMin) * 0.15;
        yMin -= padding;
        yMax += padding;
        const yRange = yMax - yMin;

        // ── Coordinate transforms ──
        const n = sorted.length;
        const xOf = (i) => padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW);
        const yOf = (v) => padT + chartH - ((v - yMin) / yRange) * chartH;

        // ── Clear ──
        ctx.clearRect(0, 0, W, H);
        ctx.fillStyle = COLORS.background;
        ctx.fillRect(0, 0, W, H);

        // ── Grid lines (horizontal) ──
        const yGridCount = 4;
        ctx.strokeStyle = COLORS.gridLine;
        ctx.lineWidth = 1;
        for (let g = 0; g <= yGridCount; g++) {
            const gVal = yMin + (yRange * g / yGridCount);
            const gy = yOf(gVal);
            ctx.beginPath();
            ctx.moveTo(padL, gy);
            ctx.lineTo(padL + chartW, gy);
            ctx.stroke();

            // Y-axis labels
            ctx.fillStyle = COLORS.axisText;
            ctx.font = `11px ${FONT_FAMILY}`;
            ctx.textAlign = 'right';
            ctx.textBaseline = 'middle';
            const label = Math.abs(gVal) < 10 ? gVal.toFixed(1) : Math.round(gVal).toString();
            ctx.fillText(label, padL - 6, gy);
        }

        // ── Reference range band ──
        if (refMin !== null && refMax !== null) {
            const bandTop    = yOf(refMax);
            const bandBottom = yOf(refMin);
            ctx.fillStyle = COLORS.refBand;
            ctx.fillRect(padL, bandTop, chartW, bandBottom - bandTop);

            // Reference lines
            ctx.strokeStyle = COLORS.refLine;
            ctx.lineWidth = 1;
            ctx.setLineDash([4, 3]);
            [refMin, refMax].forEach(rv => {
                const ry = yOf(rv);
                ctx.beginPath();
                ctx.moveTo(padL, ry);
                ctx.lineTo(padL + chartW, ry);
                ctx.stroke();
            });
            ctx.setLineDash([]);
        }

        // ── Date labels (X axis) ──
        // Show at most 6 labels, evenly spaced
        const maxLabels = 6;
        const step = Math.max(1, Math.ceil(n / maxLabels));
        ctx.fillStyle = COLORS.dateText;
        ctx.font = `10px ${FONT_FAMILY}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        for (let i = 0; i < n; i += step) {
            const lbl = sorted[i].label || fmtAxisDate(sorted[i].date);
            if (!lbl) continue;
            const lx = xOf(i);
            ctx.fillText(lbl, lx, padT + chartH + 6);
        }
        // Always show last
        if ((n - 1) % step !== 0) {
            const lbl = sorted[n - 1].label || fmtAxisDate(sorted[n - 1].date);
            ctx.fillText(lbl, xOf(n - 1), padT + chartH + 6);
        }

        // ── Line ──
        ctx.strokeStyle = COLORS.line;
        ctx.lineWidth = 2.5;
        ctx.lineJoin = 'round';
        ctx.lineCap  = 'round';
        ctx.beginPath();
        sorted.forEach((p, i) => {
            const x = xOf(i);
            const y = yOf(p.value);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // ── Data points ──
        sorted.forEach((p, i) => {
            const x = xOf(i);
            const y = yOf(p.value);
            const st = p.status;
            const dotColor = st === 'Cao' ? COLORS.dotHigh
                           : st === 'Thấp' ? COLORS.dotLow
                           : (refMin !== null && refMax !== null && p.value >= refMin && p.value <= refMax)
                             ? COLORS.dotNormal
                           : COLORS.dot;

            // Outer ring
            ctx.beginPath();
            ctx.arc(x, y, DOT_RADIUS + 2, 0, 2 * Math.PI);
            ctx.fillStyle = 'rgba(255,255,255,0.9)';
            ctx.fill();

            // Inner dot
            ctx.beginPath();
            ctx.arc(x, y, DOT_RADIUS, 0, 2 * Math.PI);
            ctx.fillStyle = dotColor;
            ctx.fill();
        });

        // ── Unit label (top-left corner) ──
        if (unit || metricLabel) {
            ctx.fillStyle = '#888888';
            ctx.font = `10px ${FONT_FAMILY}`;
            ctx.textAlign = 'left';
            ctx.textBaseline = 'top';
            ctx.fillText(unit || metricLabel, padL + 4, padT + 2);
        }

        // Store metadata on canvas for hover interaction
        canvas._trendData = { sorted, xOf, yOf, refMin, refMax, unit, metricLabel, padL, padR, padT, padB, chartW, chartH };
    }

    /**
     * Attach hover tooltip interaction to a chart canvas.
     * @param {HTMLCanvasElement} canvas
     * @param {HTMLElement} tooltipEl — pre-created tooltip element
     */
    function attachTrendTooltip(canvas, tooltipEl) {
        if (!canvas || !tooltipEl) return;

        canvas.addEventListener('mousemove', (e) => {
            const td = canvas._trendData;
            if (!td || !td.sorted || td.sorted.length === 0) return;

            const rect = canvas.getBoundingClientRect();
            const scaleX = canvas.width / rect.width;
            const mouseX = (e.clientX - rect.left) * scaleX;

            // Find nearest point
            let bestI = 0;
            let bestDist = Infinity;
            td.sorted.forEach((p, i) => {
                const dist = Math.abs(td.xOf(i) - mouseX);
                if (dist < bestDist) { bestDist = dist; bestI = i; }
            });

            const p = td.sorted[bestI];
            const px = td.xOf(bestI);
            const py = td.yOf(p.value);
            const scaleY = canvas.height / rect.height;

            // Build tooltip HTML
            const statusEmoji = p.status === 'Cao' ? '▲' : p.status === 'Thấp' ? '▼' : '●';
            const statusColor = p.status === 'Cao' ? '#FFB4AB' : p.status === 'Thấp' ? '#FFCC80' : '#A5D6A7';
            tooltipEl.innerHTML = `
                <div style="font-size:11px;opacity:0.8;margin-bottom:2px;">${fmtTooltipDate(p.date)}</div>
                <div style="font-size:14px;font-weight:700;">
                    <span style="color:${statusColor}">${statusEmoji}</span>
                    ${p.value} ${td.unit}
                </div>
                ${p.status ? `<div style="font-size:11px;color:${statusColor}">${p.status}</div>` : ''}
                ${td.refMin !== null ? `<div style="font-size:10px;opacity:0.75;">BT: ${td.refMin}–${td.refMax} ${td.unit}</div>` : ''}
            `;
            tooltipEl.style.display = 'block';

            // Position tooltip
            const canvasLeft = rect.left + window.scrollX;
            const canvasTop  = rect.top + window.scrollY;
            const tipW = tooltipEl.offsetWidth || 120;
            const tipH = tooltipEl.offsetHeight || 60;
            let tipX = canvasLeft + (px / scaleX) + 12;
            let tipY = canvasTop + (py / scaleY) - tipH / 2;
            if (tipX + tipW > window.innerWidth - 10) tipX -= tipW + 24;
            tipY = clamp(tipY, 4, window.innerHeight - tipH - 4);
            tooltipEl.style.left = `${tipX}px`;
            tooltipEl.style.top  = `${tipY}px`;
        });

        canvas.addEventListener('mouseleave', () => {
            if (tooltipEl) tooltipEl.style.display = 'none';
        });
    }

    // ─── Public API ──────────────────────────────────────────────────────────
    window.Aladinn = window.Aladinn || {};
    window.Aladinn.TrendChart = {
        render: renderTrendChart,
        attachTooltip: attachTrendTooltip,
        fmtAxisDate,
        fmtTooltipDate,
        parseTimestamp,
    };

})();
