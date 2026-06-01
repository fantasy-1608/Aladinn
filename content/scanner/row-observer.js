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
     * Đề xuất 1: Pre-fetch demographics khi chọn BN (ngầm, không mở UI)
     * Lưu vào VNPTStore để history.js, emergency.js và các module khác dùng ngay
     * Auto-hook: subscribe vào selectedPatientId → fetch ngầm demographics
     */
    let _lastDemoFetchId = '';
    function prefetchDemographics(pid) {
        if (!pid || pid === _lastDemoFetchId) return;
        _lastDemoFetchId = pid;

        if (!window.VNPTMessaging) return;

        let token = null;
        if (window.VNPTPatientContextGuard) {
            token = window.VNPTPatientContextGuard.captureGridOnly(pid);
        }

        window.VNPTMessaging.sendRequest('REQ_FETCH_PATIENT_DEMOGRAPHICS', { rowId: pid, contextToken: token }, 5000)
            .then((res) => {
                if (token && window.VNPTPatientContextGuard) {
                    if (!window.VNPTPatientContextGuard.validate(token, { allowGridOnly: true })) {
                        console.warn('[Aladinn] Drop stale demographics result', pid);
                        return;
                    }
                }

                if (res && res.demographics) {
                    // Update map
                    if (window.VNPTPatientContextGuard && window.VNPTStore?.actions?.updatePatientDemographics) {
                        const patientKey = window.VNPTPatientContextGuard.hashIdentity({
                            rowId: pid,
                            khambenhId: res?._context?.KHAMBENHID,
                            hosobenhanId: res?._context?.HOSOBENHANID,
                            benhnhanId: res?._context?.BENHNHANID
                        });
                        window.VNPTStore.actions.updatePatientDemographics(patientKey, res.demographics);
                    }
                }
            })
            .catch(() => { /* silent — DOM fallback vẫn hoạt động */ });
    }

    // Auto-hook: khi selectedPatientId thay đổi → prefetch ngầm
    function autoHookDemographics() {
        if (window.VNPTStore) {
            window.VNPTStore.subscribe('selectedPatientId', (pid) => {
                if (pid) prefetchDemographics(pid);
            });
        } else {
            // Retry sau 2s nếu Store chưa sẵn sàng
            setTimeout(autoHookDemographics, 2000);
        }
    }
    // Khởi chạy auto-hook ngay khi module load
    setTimeout(autoHookDemographics, 500);

    return {
        init,
        prefetchDemographics
    };
})();

window.VNPTRowObserver = VNPTRowObserver;
