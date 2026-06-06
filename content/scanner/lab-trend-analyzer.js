/**
 * 🧞 Aladinn — Lab Trend Analyzer
 * Processes raw lab data from the bridge into time-series for trend visualization.
 * No DOM access. No side effects. Pure data transforms only.
 *
 * @module LabTrendAnalyzer
 */

'use strict';

(function () {

    // ─── Metric Definitions ─────────────────────────────────────────────────
    /**
     * Master list of clinical metrics we support trending.
     * `search` array is used for case-insensitive substring matching against
     * `lab.code` (TENCHISO) and `lab.testName` (TENXETNGHIEM).
     *
     * @type {Array<{
     *   key:      string,   // unique key used internally
     *   label:    string,   // display name (Vietnamese)
     *   unit:     string,   // typical unit
     *   refMin?:  number,   // reference range min (adult, typical)
     *   refMax?:  number,   // reference range max
     *   search:   string[], // search tokens
     *   group:    string,   // group label for grouping in UI
     *   priority: number,   // lower = shown first
     * }>}
     */
    const TREND_METRICS = [
        // CBC — Công thức máu
        { key: 'hb',      label: 'Hemoglobin (Hb)',  unit: 'g/dL', refMin: 12.0, refMax: 17.5, search: ['hemoglobin', 'haemoglobin', 'hb', 'hgb', 'huyết sắc tố'], group: 'Công thức máu', priority: 1 },
        { key: 'hct',     label: 'Hematocrit (HCT)', unit: '%',    refMin: 36,   refMax: 52,   search: ['hematocrit', 'hct', 'ht'], group: 'Công thức máu', priority: 2 },
        { key: 'wbc',     label: 'Bạch cầu (WBC)',   unit: 'G/L',  refMin: 4.0,  refMax: 10.0, search: ['bạch cầu', 'wbc', 'wbc count', 'bach cau', 'leukocyte', 'leucocyte'], group: 'Công thức máu', priority: 3 },
        { key: 'plt',     label: 'Tiểu cầu (PLT)',   unit: 'G/L',  refMin: 150,  refMax: 400,  search: ['tiểu cầu', 'plt', 'platelet', 'tieu cau'], group: 'Công thức máu', priority: 4 },
        { key: 'neu',     label: 'Neutrophil (%)',    unit: '%',    refMin: 50,   refMax: 70,   search: ['neutrophil', 'neut%', 'neu%', 'trung tính%'], group: 'Công thức máu', priority: 5 },

        // Sinh hóa — Chemistry
        { key: 'glucose', label: 'Glucose máu',       unit: 'mmol/L', refMin: 3.9, refMax: 6.1, search: ['glucose', 'đường huyết', 'duong huyet', 'blood sugar', 'định lượng glucose'], group: 'Sinh hóa', priority: 10 },
        { key: 'creatinine', label: 'Creatinine',     unit: 'µmol/L', refMin: 62, refMax: 120, search: ['creatinine', 'creatinin', 'créatinine'], group: 'Sinh hóa', priority: 11 },
        { key: 'egfr',    label: 'eGFR',               unit: 'mL/phút', search: ['egfr', 'ước lượng độ lọc'], group: 'Sinh hóa', priority: 12 },
        { key: 'urea',    label: 'Ure máu',            unit: 'mmol/L', refMin: 2.5, refMax: 7.5, search: ['urea', 'ure máu', 'ure mau', 'blood urea', 'bun'], group: 'Sinh hóa', priority: 13 },
        { key: 'uric',    label: 'Uric acid',          unit: 'µmol/L', search: ['uric', 'axit uric'], group: 'Sinh hóa', priority: 14 },
        { key: 'alt',     label: 'ALT (SGPT)',          unit: 'U/L', refMax: 40, search: ['alt', 'sgpt', 'alanine aminotransferase', 'alanin'], group: 'Sinh hóa', priority: 15 },
        { key: 'ast',     label: 'AST (SGOT)',          unit: 'U/L', refMax: 37, search: ['ast', 'sgot', 'aspartate aminotransferase', 'aspartat'], group: 'Sinh hóa', priority: 16 },
        { key: 'bili_total', label: 'Bilirubin toàn phần', unit: 'µmol/L', refMax: 21, search: ['bilirubin toàn phần', 'bilirubin toan phan', 'total bilirubin', 'tbili'], group: 'Sinh hóa', priority: 17 },
        { key: 'bili_direct', label: 'Bilirubin trực tiếp', unit: 'µmol/L', refMax: 5, search: ['bilirubin trực tiếp', 'bilirubin truc tiep', 'direct bilirubin', 'dbili'], group: 'Sinh hóa', priority: 18 },
        { key: 'albumin', label: 'Albumin',             unit: 'g/L',  refMin: 35, refMax: 52, search: ['albumin'], group: 'Sinh hóa', priority: 19 },
        { key: 'protein', label: 'Protein toàn phần',  unit: 'g/L',  refMin: 60, refMax: 80, search: ['protein toàn phần', 'protein toan phan', 'total protein'], group: 'Sinh hóa', priority: 20 },
        { key: 'na',      label: 'Natri (Na+)',         unit: 'mmol/L', refMin: 136, refMax: 145, search: ['natri', 'na+', 'sodium', 'natr'], group: 'Sinh hóa', priority: 21 },
        { key: 'k',       label: 'Kali (K+)',           unit: 'mmol/L', refMin: 3.5, refMax: 5.0, search: ['kali', 'k+', 'potassium', 'kalium'], group: 'Sinh hóa', priority: 22 },
        { key: 'cl',      label: 'Clo (Cl-)',           unit: 'mmol/L', refMin: 98,  refMax: 107, search: ['clo', 'cl-', 'chloride'], group: 'Sinh hóa', priority: 23 },
        { key: 'ca',      label: 'Canxi (Ca2+)',        unit: 'mmol/L', refMin: 2.1, refMax: 2.7, search: ['canxi', 'ca2+', 'calcium', 'calci'], group: 'Sinh hóa', priority: 24 },

        // Tim mạch / Viêm
        { key: 'crp',     label: 'CRP',                unit: 'mg/L', refMax: 5, search: ['crp', 'c-reactive', 'protein phản ứng c', 'c reactive', 'c-reaktives'], group: 'Viêm & Tim mạch', priority: 30 },
        { key: 'pct',     label: 'Procalcitonin (PCT)', unit: 'ng/mL', refMax: 0.5, search: ['procalcitonin', 'pct', 'calcitonin precursor'], group: 'Viêm & Tim mạch', priority: 31 },
        { key: 'troponin_i', label: 'Troponin I',       unit: 'ng/mL', search: ['troponin i', 'ctni', 'cardiac troponin i'], group: 'Viêm & Tim mạch', priority: 32 },
        { key: 'troponin_t', label: 'Troponin T',       unit: 'ng/mL', search: ['troponin t', 'ctnt', 'cardiac troponin t'], group: 'Viêm & Tim mạch', priority: 33 },
        { key: 'bnp',     label: 'BNP / NT-proBNP',    unit: 'pg/mL', search: ['bnp', 'nt-probnp', 'brain natriuretic', 'natriuretic'], group: 'Viêm & Tim mạch', priority: 34 },
        { key: 'ddimer',  label: 'D-Dimer',             unit: 'µg/mL FEU', search: ['d-dimer', 'ddimer', 'd dimer'], group: 'Viêm & Tim mạch', priority: 35 },
        { key: 'ldh',     label: 'LDH',                 unit: 'U/L', search: ['ldh', 'lactate dehydrogenase', 'lactic dehydrogenase'], group: 'Viêm & Tim mạch', priority: 36 },
        { key: 'ferritin', label: 'Ferritin',           unit: 'ng/mL', search: ['ferritin', 'ferritine'], group: 'Viêm & Tim mạch', priority: 37 },

        // Đông máu
        { key: 'pt',      label: 'PT (Prothrombin)',   unit: 'giây', refMin: 11, refMax: 14, search: ['pt', 'prothrombin time', 'tỷ lệ prothrombin', 'ty le prothrombin', 'pt%', 'quick'], group: 'Đông máu', priority: 40 },
        { key: 'aptt',    label: 'APTT',                unit: 'giây', refMin: 25, refMax: 38, search: ['aptt', 'activated partial thromboplastin', 'pttpa', 'cephalin'], group: 'Đông máu', priority: 41 },
        { key: 'inr',     label: 'INR',                 unit: '',    refMin: 0.8, refMax: 1.2, search: ['inr', 'international normalized ratio'], group: 'Đông máu', priority: 42 },
        { key: 'fibrinogen', label: 'Fibrinogen',       unit: 'g/L', search: ['fibrinogen'], group: 'Đông máu', priority: 43 },

        // Khí máu
        { key: 'ph',      label: 'pH',                  unit: '', refMin: 7.35, refMax: 7.45, search: ['ph máu', 'blood ph', ' ph '], group: 'Khí máu', priority: 50 },
        { key: 'pco2',    label: 'pCO2',                 unit: 'mmHg', refMin: 35, refMax: 45, search: ['pco2', 'pco₂', 'partial pressure co2', 'áp lực co2'], group: 'Khí máu', priority: 51 },
        { key: 'po2',     label: 'pO2',                  unit: 'mmHg', refMin: 80, refMax: 100, search: ['po2', 'po₂', 'partial pressure o2', 'áp lực o2'], group: 'Khí máu', priority: 52 },
        { key: 'hco3',    label: 'HCO3-',                unit: 'mmol/L', refMin: 22, refMax: 26, search: ['hco3', 'hco₃', 'bicarbonate'], group: 'Khí máu', priority: 53 },
        { key: 'spo2',    label: 'SpO2',                 unit: '%', refMin: 95, refMax: 100, search: ['spo2', 'spO2', 'oxygen saturation', 'bão hòa oxy'], group: 'Khí máu', priority: 54 },

        // Huyết học — Thyroids & Hormones
        { key: 'tsh',     label: 'TSH',                  unit: 'µIU/mL', refMin: 0.27, refMax: 4.2, search: ['tsh', 'thyroid stimulating', 'thyrotropin'], group: 'Nội tiết', priority: 60 },
        { key: 'ft4',     label: 'FT4',                  unit: 'pmol/L', search: ['ft4', 'free thyroxine', 't4 tự do', 'free t4'], group: 'Nội tiết', priority: 61 },
        { key: 'ft3',     label: 'FT3',                  unit: 'pmol/L', search: ['ft3', 'free triiodothyronine', 't3 tự do', 'free t3'], group: 'Nội tiết', priority: 62 },
        { key: 'hba1c',   label: 'HbA1c',                unit: '%', search: ['hba1c', 'hemoglobin a1c', 'glycosylated', 'glycated haemoglobin'], group: 'Nội tiết', priority: 63 },
        { key: 'insulin', label: 'Insulin',               unit: 'µIU/mL', search: ['insulin'], group: 'Nội tiết', priority: 64 },

        // Mỡ máu
        { key: 'chol',    label: 'Cholesterol',           unit: 'mmol/L', refMax: 5.2, search: ['cholesterol', 'total cholesterol', 'cholestérol'], group: 'Mỡ máu', priority: 70 },
        { key: 'ldl',     label: 'LDL-C',                 unit: 'mmol/L', refMax: 3.4, search: ['ldl', 'ldl-c', 'ldl cholesterol', 'low-density'], group: 'Mỡ máu', priority: 71 },
        { key: 'hdl',     label: 'HDL-C',                 unit: 'mmol/L', refMin: 1.0, search: ['hdl', 'hdl-c', 'hdl cholesterol', 'high-density'], group: 'Mỡ máu', priority: 72 },
        { key: 'trig',    label: 'Triglyceride',           unit: 'mmol/L', refMax: 1.7, search: ['triglyceride', 'tg', 'tri-glyceride', 'triglycerid'], group: 'Mỡ máu', priority: 73 },
    ];

    // Precompute lowercase tokens for fast search
    TREND_METRICS.forEach(m => {
        m._searchLower = m.search.map(s => s.toLowerCase());
    });

    // ─── Metric detection ────────────────────────────────────────────────────
    /**
     * Detect which metric a lab item corresponds to.
     * @param {{ code: string, testName: string }} lab
     * @returns {string|null} metric key or null
     */
    function detectMetricKey(lab) {
        const haystack = `${String(lab.code || '')} ${String(lab.testName || '')}`.toLowerCase().trim();
        if (!haystack) return null;

        let bestMatch = null;
        let bestScore = 0;

        for (const m of TREND_METRICS) {
            for (const token of m._searchLower) {
                if (haystack.includes(token)) {
                    // Longer token = more specific = higher score
                    if (token.length > bestScore) {
                        bestScore = token.length;
                        bestMatch = m.key;
                    }
                }
            }
        }
        return bestMatch;
    }

    /**
     * Get metric definition by key.
     * @param {string} key
     * @returns {Object|null}
     */
    function getMetricDef(key) {
        return TREND_METRICS.find(m => m.key === key) || null;
    }

    // ─── Time-series extraction ──────────────────────────────────────────────
    /**
     * Parse a numeric value from a lab string value.
     * Handles: "5.3", "5,3", "< 0.01", "> 100"
     * @param {string|number} raw
     * @returns {number|null}
     */
    function parseLabValue(raw) {
        if (typeof raw === 'number' && isFinite(raw)) return raw;
        const s = String(raw || '').replace(',', '.').replace(/[<>≤≥~\s]/g, '');
        const n = parseFloat(s);
        return isNaN(n) ? null : n;
    }

    /**
     * Extract a time-series for a specific metric from the flat labs array.
     *
     * @param {Array<{sheetId, sheetDate, testName, code, value, unit, refMin, refMax, status}>} labsData
     * @param {string} metricKey
     * @returns {{ points: TrendPoint[], refMin: number|null, refMax: number|null, unit: string }}
     */
    function extractTrendData(labsData, metricKey) {
        if (!labsData || !Array.isArray(labsData) || !metricKey) {
            return { points: [], refMin: null, refMax: null, unit: '' };
        }

        const def = getMetricDef(metricKey);
        let refMin = def ? (def.refMin ?? null) : null;
        let refMax = def ? (def.refMax ?? null) : null;
        let unit   = def ? def.unit : '';

        const filtered = labsData.filter(lab => detectMetricKey(lab) === metricKey);

        // Collect points per sheetDate (group by sheet to avoid duplicates)
        const seenDates = new Map(); // sheetDate → best point
        filtered.forEach(lab => {
            const v = parseLabValue(lab.value);
            if (v === null) return;

            const date = lab.sheetDate || '';
            // If unit is empty, derive from lab data
            if (!unit && lab.unit) unit = lab.unit;
            // Use lab's own refMin/refMax if def doesn't have one
            if (refMin === null && lab.refMin) {
                const rn = parseLabValue(lab.refMin);
                if (rn !== null) refMin = rn;
            }
            if (refMax === null && lab.refMax) {
                const rx = parseLabValue(lab.refMax);
                if (rx !== null) refMax = rx;
            }

            // De-duplicate: keep the entry with the most specific code per date
            const existing = seenDates.get(date);
            if (!existing || (lab.code && lab.code.length > existing._codeLen)) {
                seenDates.set(date, {
                    date,
                    value: v,
                    status: lab.status || '',
                    _codeLen: (lab.code || '').length,
                });
            }
        });

        const points = Array.from(seenDates.values()).map(({ date, value, status }) => ({
            date,
            value,
            status,
        }));

        return { points, refMin, refMax, unit };
    }

    /**
     * Detect available metrics in a labsData set.
     * Returns sorted list of metric keys that have ≥1 numeric data point.
     *
     * @param {any[]} labsData
     * @returns {Array<{ key: string, label: string, unit: string, count: number, group: string, priority: number }>}
     */
    function detectAvailableMetrics(labsData) {
        if (!labsData || !Array.isArray(labsData)) return [];

        const found = new Map(); // key → count
        labsData.forEach(lab => {
            const v = parseLabValue(lab.value);
            if (v === null) return;
            const key = detectMetricKey(lab);
            if (!key) return;
            found.set(key, (found.get(key) || 0) + 1);
        });

        return TREND_METRICS
            .filter(m => found.has(m.key))
            .map(m => ({ key: m.key, label: m.label, unit: m.unit, count: found.get(m.key), group: m.group, priority: m.priority }))
            .sort((a, b) => a.priority - b.priority);
    }

    // ─── Trend analysis ─────────────────────────────────────────────────────
    /**
     * Compute the percentage delta between current and previous value.
     * @param {number} current
     * @param {number} previous
     * @returns {{ delta: number, direction: 'up'|'down'|'flat', pct: string }}
     */
    function computeDelta(current, previous) {
        if (!previous || previous === 0) return { delta: 0, direction: 'flat', pct: 'N/A' };
        const delta = current - previous;
        const pct = Math.abs((delta / previous) * 100);
        const direction = Math.abs(delta) < 0.001 ? 'flat' : delta > 0 ? 'up' : 'down';
        return { delta, direction, pct: pct.toFixed(1) + '%' };
    }

    /**
     * Detect if the last N consecutive points are trending toward abnormal.
     * @param {TrendPoint[]} sortedPoints — sorted ascending by date
     * @param {{ refMin?: number, refMax?: number }} opts
     * @param {number} consecutiveThreshold — number of consecutive abnormal readings (default 3)
     * @returns {{ alert: boolean, type: 'trending_high'|'trending_low'|'consistently_high'|'consistently_low'|null, count: number }}
     */
    function detectAnomalyTrend(sortedPoints, opts, consecutiveThreshold) {
        consecutiveThreshold = consecutiveThreshold || 3;
        if (!sortedPoints || sortedPoints.length < consecutiveThreshold) {
            return { alert: false, type: null, count: 0 };
        }

        const refMin = opts && opts.refMin != null ? +opts.refMin : null;
        const refMax = opts && opts.refMax != null ? +opts.refMax : null;

        const last = sortedPoints.slice(-consecutiveThreshold);

        // Check if all last N are high
        if (refMax !== null) {
            const allHigh = last.every(p => p.value > refMax);
            if (allHigh) {
                // Check if also trending upward
                const trending = last[last.length - 1].value > last[0].value;
                return { alert: true, type: trending ? 'trending_high' : 'consistently_high', count: last.length };
            }
        }

        // Check if all last N are low
        if (refMin !== null) {
            const allLow = last.every(p => p.value < refMin);
            if (allLow) {
                const trending = last[last.length - 1].value < last[0].value;
                return { alert: true, type: trending ? 'trending_low' : 'consistently_low', count: last.length };
            }
        }

        return { alert: false, type: null, count: 0 };
    }

    /**
     * Generate a concise trend summary string for a metric.
     * @param {TrendPoint[]} points
     * @param {{ refMin?: number, refMax?: number, unit?: string }} opts
     * @returns {string} HTML snippet
     */
    function buildTrendSummary(points, opts) {
        if (!points || points.length === 0) return '<em>Không có dữ liệu</em>';

        const sorted = [...points].sort((a, b) => {
            const parseTimestamp = window.Aladinn?.TrendChart?.parseTimestamp || ((_s) => 0);
            return parseTimestamp(a.date) - parseTimestamp(b.date);
        });

        const latest = sorted[sorted.length - 1];
        const prev   = sorted.length >= 2 ? sorted[sorted.length - 2] : null;
        const { direction, pct } = prev ? computeDelta(latest.value, prev.value) : { direction: 'flat', pct: 'N/A' };
        const anomaly = detectAnomalyTrend(sorted, opts);
        const unit    = opts && opts.unit ? opts.unit : '';

        const arrow   = direction === 'up' ? '▲' : direction === 'down' ? '▼' : '─';
        const arrowColor = direction === 'up' ? '#c62828' : direction === 'down' ? '#e65100' : '#555';
        const status  = latest.status;
        const dotColor = status === 'Cao' ? '#c62828' : status === 'Thấp' ? '#e65100' : '#2e7d32';
        const statusLabel = status || 'Bình thường';

        let alertHtml = '';
        if (anomaly.alert) {
            const alertMsg = anomaly.type === 'trending_high' ? `⚠️ Tăng dần ${anomaly.count} lần liên tiếp`
                           : anomaly.type === 'trending_low'  ? `⚠️ Giảm dần ${anomaly.count} lần liên tiếp`
                           : anomaly.type === 'consistently_high' ? `⚠️ Cao ${anomaly.count} lần liên tiếp`
                           : `⚠️ Thấp ${anomaly.count} lần liên tiếp`;
            alertHtml = `<span style="color:#c62828;font-size:11px;font-weight:700;">${alertMsg}</span>`;
        }

        return `
            <span style="font-size:14px;font-weight:700;color:${dotColor}">${latest.value} ${unit}</span>
            <span style="color:${arrowColor};font-weight:700;margin-left:4px;">${arrow}</span>
            ${prev ? `<span style="font-size:11px;color:#888;margin-left:2px;">${pct}</span>` : ''}
            <span style="font-size:11px;background:${status === 'Cao' ? '#ffebee' : status === 'Thấp' ? '#fff3e0' : '#e8f5e9'};color:${dotColor};padding:1px 5px;margin-left:6px;">${statusLabel}</span>
            ${alertHtml ? `<br><small>${alertHtml}</small>` : ''}
        `;
    }

    // ─── Public API ──────────────────────────────────────────────────────────
    window.Aladinn = window.Aladinn || {};
    window.Aladinn.LabTrend = {
        TREND_METRICS,
        detectMetricKey,
        getMetricDef,
        extractTrendData,
        detectAvailableMetrics,
        parseLabValue,
        computeDelta,
        detectAnomalyTrend,
        buildTrendSummary,
    };

})();
