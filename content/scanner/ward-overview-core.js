const ATTENTION_RULES = [
    'nhiễm khuẩn huyết', 'sepsis', 'sốc', 'suy hô hấp', 'ngừng tuần hoàn',
    'hôn mê', 'xuất huyết', 'suy đa cơ quan', 'thuyên tắc phổi',
    'nhồi máu', 'viêm phúc mạc', 'thủng tạng', 'hoại tử'
];

const MONITOR_RULES = [
    'hậu phẫu', 'sau mổ', 'theo dõi', 'chấn thương', 'viêm tụy',
    'viêm đường mật', 'áp xe', 'ung thư', 'tắc ruột', 'nhiễm trùng'
];

export const WARD_OVERVIEW_LIMITS = Object.freeze({
    delayMs: 2000,
    maxPatients: 50,
    maxConsecutiveFailures: 3,
    requestTimeoutMs: 12000
});

function normalizeForMatch(value) {
    return String(value || '').trim().toLocaleLowerCase('vi-VN');
}

export function classifyLatestDiagnosis(diagnosis) {
    const normalized = normalizeForMatch(diagnosis);
    if (!normalized) {
        return {
            level: 'missing',
            matches: [],
            reason: 'Chưa có chẩn đoán trong tờ điều trị mới nhất'
        };
    }

    const attentionMatches = ATTENTION_RULES.filter(rule => normalized.includes(rule));
    if (attentionMatches.length > 0) {
        return {
            level: 'attention',
            matches: attentionMatches,
            reason: `Có từ khóa cần chú ý: ${attentionMatches.join(', ')}`
        };
    }

    const monitorMatches = MONITOR_RULES.filter(rule => normalized.includes(rule));
    if (monitorMatches.length > 0) {
        return {
            level: 'monitor',
            matches: monitorMatches,
            reason: `Có từ khóa cần theo dõi: ${monitorMatches.join(', ')}`
        };
    }

    return { level: 'routine', matches: [], reason: 'Không khớp danh mục cảnh báo hiện tại' };
}

const defaultSleep = (delayMs) => new Promise(resolve => setTimeout(resolve, delayMs));

function createScanResult(row, response) {
    const latestDiagnosis = String(response.latestDiagnosis || '').trim();
    return {
        ...row,
        success: response.success !== false,
        latestTreatmentDate: response.latestTreatmentDate || '',
        latestDiagnosis,
        classification: classifyLatestDiagnosis(latestDiagnosis),
        error: response.error || ''
    };
}

export async function scanPatientsSequentially(rows, fetchPatient, options = {}) {
    const delayMs = options.delayMs ?? WARD_OVERVIEW_LIMITS.delayMs;
    const sleep = options.sleep || defaultSleep;
    const signal = options.signal;
    const selectedRows = rows.slice(0, WARD_OVERVIEW_LIMITS.maxPatients);
    const results = [];
    let consecutiveFailures = 0;

    for (let index = 0; index < selectedRows.length; index += 1) {
        if (signal?.aborted) { results.cancelled = true; break; }
        const row = selectedRows[index];
        try {
            const response = await fetchPatient(row);
            results.push(createScanResult(row, response || { success: false }));
            consecutiveFailures = response?.success === false ? consecutiveFailures + 1 : 0;
        } catch (error) {
            results.push(createScanResult(row, { success: false, error: String(error?.message || error) }));
            consecutiveFailures += 1;
        }

        options.onProgress?.({ completed: index + 1, total: selectedRows.length, row, result: results.at(-1) });
        if (consecutiveFailures >= WARD_OVERVIEW_LIMITS.maxConsecutiveFailures) {
            results.stoppedForSafety = true;
            break;
        }
        if (index < selectedRows.length - 1 && delayMs > 0) await sleep(delayMs);
    }

    results.truncated = rows.length > selectedRows.length;
    return results;
}

