/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Row Observer (Interaction Tracking)
 * 
 * Handles patient selection and grid interactions.
 * Uses MutationObserver instead of polling for better performance.
 */

const VNPTRowObserver = (function () {

    let _observer = null;
    let _lastSelectedId = '';



    /**
     * Initialize listeners for patient selection
     * @param {Function} onSelect - Callback when a patient is selected
     */
    function init(onSelect) {
        if (window.HIS && window.HIS.EventBus) {
            window.HIS.EventBus.on('patient:selected', (data) => {
                const pid = data.rowId;
                if (pid && pid !== _lastSelectedId) {
                    _lastSelectedId = pid;
                    onSelect(pid);
                }
            });

            // Initial selected row if already picked
            if (window.HIS.PatientObserver && typeof window.HIS.PatientObserver.getCurrentRowId === 'function') {
                const initId = window.HIS.PatientObserver.getCurrentRowId();
                if (initId) {
                    _lastSelectedId = initId;
                    onSelect(initId);
                }
            }
        } else {
            console.warn('[VNPTRowObserver] HIS.EventBus not found, patient selection tracking will fail.');
        }
    }

    /**
     * Giữ patient selection nhẹ: không prefetch demographics khi chỉ chọn dòng.
     * Dữ liệu lâm sàng chỉ tải khi người dùng mở chức năng cần dữ liệu.
     */
    function prefetchDemographics(pid) {
        void pid;
    }

    return {
        init,
        prefetchDemographics
    };
})();

window.VNPTRowObserver = VNPTRowObserver;
