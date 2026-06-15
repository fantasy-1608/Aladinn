/**
 * ALADINN - Performance Store (Ring Buffer)
 * Mảng bộ đệm xoay vòng để lưu trữ telemetry cục bộ.
 * Không chứa PHI, lưu giới hạn 500 records.
 */

const PERF_STORAGE_KEY = 'aladinn_cds_perf_telemetry';
const MAX_RECORDS = 500;

export const PerformanceStore = {
    async addRecord(record) {
        // Validation: Cấm PHI
        const safeRecord = {
            ts: record.ts || new Date().toISOString(),
            build: chrome.runtime.getManifest().version,
            cds_enabled: record.cds_enabled !== false,
            cds_active: !!record.cds_active,
            scan_reason: record.scan_reason || 'unknown',
            scan_total_ms: Number(record.scan_total_ms) || 0,
            extract_context_ms: Number(record.extract_context_ms) || 0,
            analyze_ms: Number(record.analyze_ms) || 0,
            render_ms: Number(record.render_ms) || 0,
            iframe_count: Number(record.iframe_count) || 0,
            medication_count: Number(record.medication_count) || 0,
            diagnosis_count: Number(record.diagnosis_count) || 0,
            lab_count: Number(record.lab_count) || 0,
            alert_count: Number(record.alert_count) || 0,
            skipped_by_hash: !!record.skipped_by_hash
        };

        try {
            const data = await chrome.storage.local.get(PERF_STORAGE_KEY);
            let records = data[PERF_STORAGE_KEY] || [];
            
            records.push(safeRecord);
            
            // Ring buffer: Giữ tối đa MAX_RECORDS
            if (records.length > MAX_RECORDS) {
                records = records.slice(records.length - MAX_RECORDS);
            }
            
            await chrome.storage.local.set({ [PERF_STORAGE_KEY]: records });
        } catch (e) {
            console.error('[Aladinn PerfStore] Error saving record', e);
        }
    },

    async getRecords() {
        try {
            const data = await chrome.storage.local.get(PERF_STORAGE_KEY);
            return data[PERF_STORAGE_KEY] || [];
        } catch (e) {
            return [];
        }
    },

    async clearRecords() {
        try {
            await chrome.storage.local.remove(PERF_STORAGE_KEY);
        } catch (e) {}
    },

    async exportCSV() {
        const records = await this.getRecords();
        if (records.length === 0) return null;

        const headers = Object.keys(records[0]).join(',');
        const rows = records.map(r => Object.values(r).join(','));
        return [headers, ...rows].join('\n');
    }
};

window.AladinnPerformanceStore = PerformanceStore;
