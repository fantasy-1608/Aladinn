/**
 * VNPT HIS Extension v4.0.1
 * Module: Storage (Persistence)
 * 
 * Lưu trữ kết quả quét. Uses HIS.Storage (chrome.storage) instead of localStorage.
 */

const VNPTStorage = (function () {
    const STORAGE_KEY = 'vnpt_scan_results';

    /**
     * Lưu kết quả quét
     */
    async function saveResults(results) {
        const data = {
            timestamp: Date.now(),
            results: results
        };
        if (HIS?.Storage?.set) {
            await HIS.Storage.set({ [STORAGE_KEY]: data });
        } else {
            // Deprecated fallback
        }
    }

    /**
     * Lấy kết quả đã lưu (nếu còn hạn)
     */
    async function getResults() {
        let data = null;
        if (HIS?.Storage?.get) {
            const result = await HIS.Storage.get(STORAGE_KEY);
            data = result[STORAGE_KEY];
        }
        if (!data) return null;

        const ageHours = (Date.now() - data.timestamp) / (1000 * 60 * 60);
        const configTTL = window.VNPTConfig?.cacheExpiry || 24;
        if (ageHours > configTTL) {
            clearResults();
            return null;
        }
        return data.results;
    }

    /**
     * Xóa cache
     */
    async function clearResults() {
        if (HIS?.Storage?.remove) {
            await HIS.Storage.remove(STORAGE_KEY);
        }
    }

    /**
     * Thêm/cập nhật 1 kết quả
     */
    async function addResult(rowId, status) {
        const results = await getResults() || {};
        results[rowId] = status;
        await saveResults(results);
    }

    /**
     * Khôi phục giao diện từ cache
     */
    async function restoreUI(applyStatusFn) {
        const results = await getResults();
        if (!results) return;

        let count = 0;
        Object.keys(results).forEach(rowId => {
            const tr = document.getElementById(rowId);
            if (tr && results[rowId] === 'UNSENT') {
                applyStatusFn(tr);
                count++;
            }
        });
    }

    /**
     * Lấy thời gian lưu cache
     */
    async function getCacheTime() {
        let data = null;
        if (HIS?.Storage?.get) {
            const res = await HIS.Storage.get(STORAGE_KEY);
            data = res[STORAGE_KEY];
        }
        if (!data) return null;
        return new Date(data.timestamp).toLocaleString('vi-VN');
    }

    return {
        saveResults,
        getResults,
        clearResults,
        addResult,
        restoreUI,
        getCacheTime
    };
})();

window.VNPTStorage = VNPTStorage;
