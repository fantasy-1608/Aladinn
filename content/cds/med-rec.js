/**
 * 🧞 Aladinn CDS — Medication Reconciliation Engine
 * So sánh danh sách thuốc trước/sau theo kịch bản lâm sàng (nhập viện, chuyển khoa, xuất viện).
 * Phát hiện thay đổi và sinh cảnh báo CDS tương thích với engine.js pipeline.
 *
 * IMMUTABILITY: Không bao giờ mutate input arrays.
 * PHI-FREE: Không ghi log bất kỳ dữ liệu nhận dạng bệnh nhân nào.
 */

// ─── HIGH-RISK DRUG CATEGORIES ────────────────────────────────────────────────
// Thuốc nguy cơ cao — dừng đột ngột có thể gây nguy hiểm lâm sàng nghiêm trọng
const HIGH_RISK_CATEGORIES = Object.freeze({
    anticoagulants: Object.freeze([
        'warfarin', 'heparin', 'enoxaparin', 'rivaroxaban', 'apixaban',
        'dabigatran', 'edoxaban', 'fondaparinux', 'acenocoumarol',
    ]),
    antiepileptics: Object.freeze([
        'phenytoin', 'carbamazepine', 'valproate', 'valproic acid',
        'levetiracetam', 'lamotrigine', 'topiramate', 'oxcarbazepine',
        'phenobarbital', 'gabapentin', 'pregabalin',
    ]),
    insulins: Object.freeze([
        'insulin', 'insulin glargine', 'insulin aspart', 'insulin lispro',
        'insulin detemir', 'insulin degludec', 'insulin nph',
    ]),
    immunosuppressants: Object.freeze([
        'tacrolimus', 'cyclosporine', 'mycophenolate', 'azathioprine',
        'sirolimus', 'everolimus', 'methotrexate',
    ]),
});

/** Flat Set of all high-risk generic names for O(1) lookup */
const HIGH_RISK_DRUGS = Object.freeze(
    new Set(Object.values(HIGH_RISK_CATEGORIES).flat()),
);

// ─── VALID SCENARIOS ──────────────────────────────────────────────────────────
const VALID_SCENARIOS = Object.freeze(['admission', 'transfer', 'discharge']);

// ─── HELPERS ──────────────────────────────────────────────────────────────────

/**
 * Remove Vietnamese diacritical marks and normalize for comparison.
 * Uses NFD decomposition → strip combining marks → lowercase → trim.
 * @param {string} name
 * @returns {string}
 */
function normalizeMedName(name) {
    if (typeof name !== 'string') return '';
    return name
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')   // strip combining diacritical marks
        .replace(/đ/g, 'd')                // Vietnamese lowercase đ
        .replace(/Đ/g, 'D')                // Vietnamese uppercase Đ
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')     // keep only alphanumeric, space, hyphen
        .replace(/\s+/g, ' ')
        .trim();
}

/**
 * Build a lookup key for a medication (normalized name only).
 * @param {Object} med
 * @returns {string}
 */
function medKey(med) {
    return normalizeMedName(med?.name ?? '');
}

/**
 * Parse a dose string into a numeric value for comparison.
 * Returns NaN if unparseable.
 * @param {string} dose
 * @returns {number}
 */
function parseDose(dose) {
    if (dose == null) return NaN;
    const str = String(dose).replace(/,/g, '.').replace(/[^\d.]/g, '');
    return parseFloat(str);
}

/**
 * Check whether a dose change is "significant" (≥ 25 % delta).
 * Returns false if either dose is unparseable.
 * @param {string} oldDose
 * @param {string} newDose
 * @returns {boolean}
 */
function isSignificantDoseChange(oldDose, newDose) {
    const oldVal = parseDose(oldDose);
    const newVal = parseDose(newDose);
    if (Number.isNaN(oldVal) || Number.isNaN(newVal) || oldVal === 0) return false;
    return Math.abs(newVal - oldVal) / oldVal >= 0.25;
}

/**
 * Safely normalise a free-text field for equality comparison.
 * @param {*} val
 * @returns {string}
 */
function norm(val) {
    return (val == null ? '' : String(val)).toLowerCase().trim();
}

/**
 * Return an empty, well-typed reconciliation result.
 * @returns {Object}
 */
function emptyResult() {
    return Object.freeze({
        added: [],
        removed: [],
        changed: [],
        unchanged: [],
        alerts: [],
    });
}

/**
 * Determine the category of a high-risk drug (for alert messaging).
 * @param {string} normalizedName
 * @returns {string|null}
 */
function highRiskCategory(normalizedName) {
    for (const [cat, drugs] of Object.entries(HIGH_RISK_CATEGORIES)) {
        if (drugs.includes(normalizedName)) return cat;
    }
    return null;
}

const CATEGORY_LABELS = Object.freeze({
    anticoagulants: 'thuốc chống đông',
    antiepileptics: 'thuốc chống động kinh',
    insulins: 'insulin',
    immunosuppressants: 'thuốc ức chế miễn dịch',
});

// ─── CORE API ─────────────────────────────────────────────────────────────────

export const MedRecEngine = Object.freeze({
    /**
     * Compare two medication lists and generate a reconciliation diff.
     *
     * @param {Array} previousMeds - [{name, dose, frequency, route}]
     * @param {Array} currentMeds  - [{name, dose, frequency, route}]
     * @param {string} scenario    - 'admission' | 'transfer' | 'discharge'
     * @returns {Object} { added:[], removed:[], changed:[], unchanged:[], alerts:[] }
     */
    reconcile(previousMeds, currentMeds, scenario = 'admission') {
        // ── Boundary validation (fail-closed) ──────────────────────────
        if (!Array.isArray(previousMeds) || !Array.isArray(currentMeds)) {
            return emptyResult();
        }
        const safeScenario = VALID_SCENARIOS.includes(scenario) ? scenario : 'admission';

        // ── Build maps — IMMUTABLE: never mutate inputs ────────────────
        /** @type {Map<string, Object>} normalizedName → original med object */
        const prevMap = new Map();
        for (const med of previousMeds) {
            const key = medKey(med);
            if (key) prevMap.set(key, med);
        }

        const currMap = new Map();
        for (const med of currentMeds) {
            const key = medKey(med);
            if (key) currMap.set(key, med);
        }

        // ── Diff calculation ───────────────────────────────────────────
        const added = [];
        const removed = [];
        const changed = [];
        const unchanged = [];

        // Check each previous med against current
        for (const [key, prevMed] of prevMap) {
            if (!currMap.has(key)) {
                removed.push({ ...prevMed, _normalizedName: key });
            } else {
                const currMed = currMap.get(key);
                const changes = [];

                if (norm(prevMed.dose) !== norm(currMed.dose)) {
                    changes.push({
                        field: 'dose',
                        from: prevMed.dose ?? '',
                        to: currMed.dose ?? '',
                    });
                }
                if (norm(prevMed.frequency) !== norm(currMed.frequency)) {
                    changes.push({
                        field: 'frequency',
                        from: prevMed.frequency ?? '',
                        to: currMed.frequency ?? '',
                    });
                }
                if (norm(prevMed.route) !== norm(currMed.route)) {
                    changes.push({
                        field: 'route',
                        from: prevMed.route ?? '',
                        to: currMed.route ?? '',
                    });
                }

                if (changes.length > 0) {
                    changed.push({
                        previous: { ...prevMed },
                        current: { ...currMed },
                        _normalizedName: key,
                        changes,
                    });
                } else {
                    unchanged.push({ ...currMed, _normalizedName: key });
                }
            }
        }

        // New drugs not in previous list
        for (const [key, currMed] of currMap) {
            if (!prevMap.has(key)) {
                added.push({ ...currMed, _normalizedName: key });
            }
        }

        const reconciliation = { added, removed, changed, unchanged, alerts: [] };

        // ── Generate alerts ────────────────────────────────────────────
        reconciliation.alerts = MedRecEngine.generateAlerts(reconciliation, safeScenario);

        return reconciliation;
    },

    /**
     * Generate CDS alerts from a reconciliation result.
     *
     * @param {Object} reconciliation - Output from reconcile()
     * @param {string} scenario
     * @returns {Array} Alert objects compatible with engine.js format
     */
    generateAlerts(reconciliation, scenario) {
        if (!reconciliation || typeof reconciliation !== 'object') return [];

        const alerts = [];
        const safeScenario = VALID_SCENARIOS.includes(scenario) ? scenario : 'admission';

        // ── MED-REC-OMISSION: Drug was on previous list but missing ───
        for (const med of (reconciliation.removed || [])) {
            const normalizedName = med._normalizedName || normalizeMedName(med.name);
            alerts.push({
                rule_code: 'MED-REC-OMISSION',
                domain: 'med_reconciliation',
                severity: 'high',
                title: 'Thuốc bị bỏ sót trong đối chiếu',
                effect: `Thuốc "${med.name || normalizedName}" có trong đơn trước nhưng không có trong đơn hiện tại (${safeScenario}).`,
                recommendation: 'Xác nhận với bác sĩ: ngừng có chủ đích hay bỏ sót?',
                matched_items: { drug: [normalizedName] },
            });
        }

        // ── MED-REC-HIGH-RISK-STOP: High-risk drug suddenly stopped ───
        for (const med of (reconciliation.removed || [])) {
            const normalizedName = med._normalizedName || normalizeMedName(med.name);
            if (HIGH_RISK_DRUGS.has(normalizedName)) {
                const cat = highRiskCategory(normalizedName);
                const catLabel = cat ? CATEGORY_LABELS[cat] : 'thuốc nguy cơ cao';
                alerts.push({
                    rule_code: 'MED-REC-HIGH-RISK-STOP',
                    domain: 'med_reconciliation',
                    severity: 'high',
                    title: 'Ngừng thuốc nguy cơ cao đột ngột',
                    effect: `${catLabel.charAt(0).toUpperCase() + catLabel.slice(1)} "${med.name || normalizedName}" bị ngừng đột ngột — có nguy cơ lâm sàng nghiêm trọng.`,
                    recommendation: `Xác nhận chỉ định ngừng ${catLabel}. Cần giám sát tình trạng lâm sàng.`,
                    matched_items: { drug: [normalizedName], category: [cat || 'high_risk'] },
                });
            }
        }

        // ── MED-REC-NEW-UNINTENTIONAL: New drug without clear indication ─
        for (const med of (reconciliation.added || [])) {
            const normalizedName = med._normalizedName || normalizeMedName(med.name);
            alerts.push({
                rule_code: 'MED-REC-NEW-UNINTENTIONAL',
                domain: 'med_reconciliation',
                severity: 'medium',
                title: 'Thuốc mới chưa đối chiếu',
                effect: `Thuốc "${med.name || normalizedName}" mới được thêm vào đơn (${safeScenario}) — chưa có trong đơn trước.`,
                recommendation: 'Xác nhận chỉ định thuốc mới và kiểm tra tương tác.',
                matched_items: { drug: [normalizedName] },
            });
        }

        // ── MED-REC-DOSE-CHANGE: Significant dose change ─────────────
        for (const entry of (reconciliation.changed || [])) {
            const doseChange = (entry.changes || []).find(c => c.field === 'dose');
            if (doseChange && isSignificantDoseChange(doseChange.from, doseChange.to)) {
                const normalizedName = entry._normalizedName || normalizeMedName(entry.previous?.name);
                const drugName = entry.previous?.name || normalizedName;
                alerts.push({
                    rule_code: 'MED-REC-DOSE-CHANGE',
                    domain: 'med_reconciliation',
                    severity: 'medium',
                    title: 'Thay đổi liều đáng kể',
                    effect: `Liều "${drugName}" thay đổi từ ${doseChange.from} → ${doseChange.to}.`,
                    recommendation: 'Xác nhận thay đổi liều là có chủ đích.',
                    matched_items: {
                        drug: [normalizedName],
                        dose_from: [String(doseChange.from)],
                        dose_to: [String(doseChange.to)],
                    },
                });
            }
        }

        return alerts;
    },

    /**
     * Normalize a medication name for comparison.
     * Lowercase, trim, strip Vietnamese diacritics, keep alphanumeric + hyphen.
     *
     * @param {string} name
     * @returns {string}
     */
    normalizeMedName,
});
