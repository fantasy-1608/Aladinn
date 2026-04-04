/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Medical History (Extraction & Auto-fill)
 * 
 * Quét toàn bộ thông tin khám và tự động điền "Tạo Bệnh án".
 */

const VNPTHistory = (function () {
    /** @type {string | null} */
    let lastPatientId = null;
    /** @type {HTMLDivElement | null} */
    let fillButton = null;
    /** @type {HTMLIFrameElement | null} */
    let currentFormIframe = null;

    // Trạng thái ghi đè VIP/Base cho phiên làm việc hiện tại
    // (Không cần nữa — VIP/BASE dựa vào settings.aiEnabled)

    function getAllowedOrigin() {
        return window.VNPTConfig?.security?.allowedOrigin || window.location.origin;
    }

    /**
     * @param {HTMLIFrameElement} iframe
     * @returns {string}
     */
    function getIframeOrigin(iframe) {
        try {
            const frameOrigin = iframe.contentWindow?.location?.origin;
            if (frameOrigin && frameOrigin !== 'null') return frameOrigin;
        } catch (e) { /* ignore cross-origin error */ }
        try {
            if (iframe.src) return new URL(iframe.src, window.location.href).origin;
        } catch (e) { console.warn('[Aladinn/History] Error resolving iframe origin:', e); }
        return getAllowedOrigin();
    }

    function init() {
        /** @type {any} */
        let checkTimer = null;
        const debouncedCheck = () => {
            if (checkTimer) clearTimeout(checkTimer);
            checkTimer = setTimeout(checkForBMForm, 200);
        };

        const observer = new MutationObserver(debouncedCheck);
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        checkForBMForm();

        // Shortcut to log fields for mapping (Support Mac Meta key)
        window.addEventListener('keydown', (e) => {
            const isL = e.key === 'L' || e.key === 'l';
            if ((e.ctrlKey || e.metaKey) && e.shiftKey && isL) {
                console.log('[History] Phát hiện tổ hợp phím Log Mapping...');
                logActiveFormFields();
            }
        });

        if (window.VNPTStore) {
            window.VNPTStore.subscribe('selectedPatientId', (pid) => {
                if (pid) onPatientSelected(pid);
            });

            const currentPid = window.VNPTStore.get('selectedPatientId');
            if (currentPid) onPatientSelected(currentPid);
        }
        console.log('[History] Module initialized (Top Frame)');
    }

    /**
     * @param {string} pid 
     */
    async function onPatientSelected(pid) {
        if (!pid || pid === lastPatientId) return;

        console.log('[History] Phát hiện chọn bệnh nhân:', pid);
        lastPatientId = pid;

        try {
            const history = await fetchHistoryForPatient(pid);
            if (history) {
                console.log('[History] Dữ liệu khám trích xuất thành công:', pid, history);
                const store = (/** @type {any} */ (window)).VNPTStore;
                if (store && store.actions && typeof store.actions.updateMedicalHistory === 'function') {
                    store.actions.updateMedicalHistory(pid, history);
                }
            }
        } catch (e) {
            console.warn('[History] Lỗi trích xuất medical history:', e);
        }
    }

    /** @type {string} */
    let _lastLabel = '';

    /**
     * Kiểm tra có iframe nào chứa form Bệnh án không
     */
    function checkForBMForm() {
        const iframes = document.querySelectorAll('iframe');
        let found = false;

        for (const iframe of Array.from(iframes)) {
            if (!(iframe instanceof HTMLIFrameElement)) continue;
            try {
                const doc = iframe.contentDocument;
                if (!doc) continue;

                const elA = doc.getElementById('txtLYDOVAOVIEN') || doc.getElementById('txtQTBENHLY');
                const elB = doc.getElementById('txtBENHLYDBLS') || doc.getElementById('txtQTBENHLYDIENBIENLS');
                const elCommon = doc.getElementById('txtKHAMBENH_TOANTHAN') || doc.getElementById('txtKHAMBENH_BOPHAN') || doc.getElementById('txtKHAMBENH_BENHSU');

                const isTabAorGeneral = (elA && elA.offsetWidth > 0) || (elCommon && elCommon.offsetWidth > 0);
                const isTabB = elB && elB.offsetWidth > 0;

                const isTreatmentSheet = doc.getElementById('txtSOTODIEUTRI') ||
                    doc.getElementById('txtSOTO') ||
                    doc.getElementById('txtTG_CHIDINH') ||
                    doc.getElementById('txtTGCHIDINH');

                const hasAnyField = (isTabAorGeneral || isTabB) && !isTreatmentSheet;

                if (iframe.offsetWidth > 0 && hasAnyField) {
                    found = true;
                    currentFormIframe = iframe;

                    let label = 'Điền Bệnh án chung';

                    const activeTab = doc.querySelector([
                        '.ui-tabs-active a',
                        '.ui-state-active a',
                        '.active a',
                        '.selected a',
                        '[aria-selected="true"]',
                        'a.active',
                        'li.active span'
                    ].join(','));

                    if (activeTab) {
                        const tabText = (activeTab.textContent || '').trim();
                        if (tabText.includes('Tổng kết hồ sơ') || tabText.includes('B.Tổng kết')) {
                            label = 'Điền Tổng kết hồ sơ bệnh án';
                        } else if (tabText.includes('Bệnh án hỏi khám') || tabText.includes('A.Bệnh án')) {
                            label = 'Điền Bệnh án hỏi khám bệnh';
                        }
                    }

                    if (label === 'Điền Bệnh án chung') {
                        const tabContainers = doc.querySelectorAll('.nav-tabs, .ui-tabs-nav, .tabs-header');
                        for (const container of Array.from(tabContainers)) {
                            const active = container.querySelector('.active, .selected, .ui-tabs-active');
                            if (active) {
                                const text = (active.textContent || '').trim();
                                if (text.includes('Tổng kết')) label = 'Điền Tổng kết hồ sơ bệnh án';
                                else if (text.includes('Khám')) label = 'Điền Bệnh án hỏi khám bệnh';
                                if (label !== 'Điền Bệnh án chung') break;
                            }
                        }
                    }

                    // Chỉ re-render FAB khi label thay đổi hoặc chưa có
                    if (!fillButton || !document.body.contains(fillButton) || label !== _lastLabel) {
                        _lastLabel = label;
                        showFillButton(iframe, label);
                    }
                    break;
                }
            } catch (e) { console.warn('[Aladinn/History] Error reading document content:', e); }
        }

        if (!found) {
            hideFillButton();
            _lastLabel = '';
            currentFormIframe = null;
        }
    }

    /**
     * @param {HTMLIFrameElement} iframe
     * @param {string} label
     */
    function showFillButton(iframe, label = 'Điền Bệnh án chung') {
        hideFillButton();
        fillButton = document.createElement('div');
        fillButton.id = 'vnpt-history-fill-btn';

        const globalWin = /** @type {any} */ (window);
        const settings = globalWin.VNPTSettings ? globalWin.VNPTSettings.getSettings() : null;
        const isTabB = label.includes('Tổng kết') || label.includes('B.');
        const isVip = !!(settings?.aiEnabled && isTabB);

        const style = document.createElement('style');
        style.textContent = `
            @keyframes fab-pulse-base {
                0%, 100% { box-shadow: 0 2px 8px rgba(255,152,0,0.4); }
                50% { box-shadow: 0 4px 16px rgba(255,152,0,0.7); }
            }
            @keyframes fab-pulse-vip {
                0%, 100% { box-shadow: 0 2px 12px rgba(124,58,237,0.5), 0 0 6px rgba(167,139,250,0.3); }
                50% { box-shadow: 0 4px 24px rgba(124,58,237,0.8), 0 0 16px rgba(167,139,250,0.6); }
            }
            @keyframes fab-spin {
                from { transform: rotate(0deg); }
                to { transform: rotate(360deg); }
            }
            @keyframes fab-bounce {
                0%,100% { transform: scale(1); }
                50% { transform: scale(1.15); }
            }
            @keyframes fab-shake {
                0%,100% { transform: translateX(0); }
                25% { transform: translateX(-3px); }
                75% { transform: translateX(3px); }
            }
            #vnpt-history-fab {
                position: fixed !important;
                top: 130px !important;
                right: 15px !important;
                z-index: 2147483647 !important;
                width: 48px !important; height: 48px !important;
                border-radius: 50% !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                cursor: pointer !important;
                user-select: none !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                font-size: 22px !important;
                border: 2px solid rgba(255,255,255,0.3) !important;
            }
            #vnpt-history-fab.base {
                background: linear-gradient(135deg, #FF9800, #F57C00) !important;
                animation: fab-pulse-base 2.5s ease-in-out infinite !important;
            }
            #vnpt-history-fab.vip {
                background: linear-gradient(135deg, #4f46e5, #7c3aed) !important;
                border-color: rgba(255,255,255,0.5) !important;
                animation: fab-pulse-vip 2s ease-in-out infinite !important;
            }
            #vnpt-history-fab:hover {
                transform: scale(1.12) !important;
            }
            #vnpt-history-fab:active {
                transform: scale(0.95) !important;
            }
            #vnpt-history-fab.processing {
                animation: fab-spin 1s linear infinite !important;
                opacity: 0.85 !important;
                pointer-events: none !important;
            }
            #vnpt-history-fab.done {
                background: linear-gradient(135deg, #4CAF50, #2E7D32) !important;
                animation: fab-bounce 0.5s ease !important;
            }
            #vnpt-history-fab.error {
                background: linear-gradient(135deg, #ef4444, #dc2626) !important;
                animation: fab-shake 0.4s ease !important;
            }
            /* Tooltip */
            #vnpt-history-fab::after {
                content: attr(data-tooltip);
                position: absolute;
                right: 56px; top: 50%;
                transform: translateY(-50%);
                background: rgba(15,23,42,0.95);
                color: #f1f5f9;
                padding: 6px 12px;
                border-radius: 8px;
                font-size: 12px;
                font-weight: 500;
                white-space: nowrap;
                pointer-events: none;
                opacity: 0;
                transition: opacity 0.2s;
                font-family: 'Inter', system-ui, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            #vnpt-history-fab:hover::after {
                opacity: 1;
            }
        `;
        fillButton.appendChild(style);

        const fab = document.createElement('div');
        fab.id = 'vnpt-history-fab';
        fab.className = isVip ? 'vip' : 'base';
        fab.innerHTML = '🧞';
        fab.setAttribute('data-tooltip', isVip ? '✨ AI VIP — ' + label : '📋 ' + label);

        fab.onclick = async () => {
            const currentIsVip = fab.classList.contains('vip');
            fab.className = 'processing';
            fab.innerHTML = '⏳';

            try {
                await doFillForm(iframe);
                fab.className = 'done';
                fab.innerHTML = '✅';
                fab.setAttribute('data-tooltip', '✅ Đã điền xong!');

                setTimeout(() => {
                    if (fillButton) {
                        fab.className = currentIsVip ? 'vip' : 'base';
                        fab.innerHTML = '🧞';
                        fab.setAttribute('data-tooltip', currentIsVip ? '✨ AI VIP — ' + label : '📋 ' + label);
                    }
                }, 2500);
            } catch (e) {
                console.error('[History] Lỗi fill form:', e);
                fab.className = 'error';
                fab.innerHTML = '❌';
                fab.setAttribute('data-tooltip', '❌ Lỗi! Click thử lại');

                setTimeout(() => {
                    if (fillButton) {
                        fab.className = currentIsVip ? 'vip' : 'base';
                        fab.innerHTML = '🧞';
                        fab.setAttribute('data-tooltip', currentIsVip ? '✨ AI VIP — ' + label : '📋 ' + label);
                    }
                }, 2500);
            }
        };

        // Right click to log fields (debug)
        fab.oncontextmenu = (e) => {
            e.preventDefault();
            logActiveFormFields();
        };

        fillButton.appendChild(fab);
        document.body.appendChild(fillButton);
    }

    function hideFillButton() {
        const el = document.getElementById('vnpt-history-fill-btn');
        if (el) el.remove();
        fillButton = null;
    }

    /**
     * Điền form Bệnh án
     * @param {HTMLIFrameElement} [iframe]
     */
    async function doFillForm(iframe) {
        const target = iframe || currentFormIframe;
        if (!target) return;

        if (!target.contentWindow || !target.contentDocument) {
            window.VNPTRealtime?.showToast('⚠️ Form chưa sẵn sàng', 'warning');
            return;
        }

        try {
            const pid = window.VNPTStore?.get('selectedPatientId');
            if (!pid) {
                window.VNPTRealtime?.showToast('⚠️ Chưa chọn bệnh nhân!', 'warning');
                return;
            }

            let history = window.VNPTStore?.get('medicalHistoryMap')[pid];
            if (!history) {
                window.VNPTRealtime?.showToast('⏳ Đang lấy dữ liệu...', 'info');
                history = await fetchHistoryForPatient(pid);
            }

            if (!history) {
                window.VNPTRealtime?.showToast('❌ Không tìm thấy dữ liệu khám!', 'warning');
                return;
            }

            // Đồng bộ hoá Cân nặng, Chiều cao từ module Sinh hiệu (Vitals) sang Bệnh án
            try {
                const vitalsStorage = window.VNPTStore?.get('vitalsDataMap');
                const vitals = vitalsStorage ? vitalsStorage[pid] : null;
                if (vitals) {
                    history.KHAMBENH_CANNANG = history.KHAMBENH_CANNANG || vitals.weight || '';
                    history.KHAMBENH_CHIEUCAO = history.KHAMBENH_CHIEUCAO || (vitals.height && vitals.height > 0 ? vitals.height : '');
                    history.KHAMBENH_BMI = history.KHAMBENH_BMI || (vitals.bmi && vitals.bmi > 0 ? vitals.bmi : '');

                    // NEW: Mạch, Nhiệt độ, Huyết áp
                    history.KHAMBENH_MACH = history.KHAMBENH_MACH || vitals.pulse || '';
                    history.KHAMBENH_NHIETDO = history.KHAMBENH_NHIETDO || vitals.temperature || '';

                    if (vitals.bloodPressure && !history.KHAMBENH_HUYETAP) {
                        if (vitals.bloodPressure.includes('/')) {
                            const parts = vitals.bloodPressure.split('/');
                            history.KHAMBENH_HUYETAP = parts[0];
                            history.KHAMBENH_HUYETAP_DUOI = parts[1];
                        } else {
                            history.KHAMBENH_HUYETAP = vitals.bloodPressure;
                        }
                    }

                    console.log('[History] Đã đồng bộ Sinh hiệu đầy đủ vào Bệnh án:', vitals);
                }
            } catch (e) {
                console.warn('[History] Lỗi đồng bộ Sinh hiệu:', e);
            }

            window.VNPTRealtime?.showToast('⏳ Đang điền bệnh án...', 'info');

            // Inject helper
            await injectHelper(target);

            /**
             * Hàm Helper để resolve ID linh động theo màn hình Nội Khoa hoặc Ngoại Khoa
             * @param {string[]} ids
             */
            function findId(ids) {
                return ids.join('|');
            }

            // Mapping cho Bệnh án chung (Basic)
            const mappingBasic = {
                'LYDOVAOVIEN': 'txtLYDOVAOVIEN',
                'QUATRINHBENHLY': 'txtQUATRINHBENHLY',
                'TIENSUBENH_BANTHAN': 'txtTIENSUBENH_BANTHAN',
                'TIENSUBENH_GIADINH': 'txtTIENSUBENH_GIADINH',
                'KHAMBENH_TOANTHAN': 'txtKHAMBENH_TOANTHAN',
                'KHAMBENH_BOPHAN': 'txtKHAMBENH_BOPHAN',
                'KHAMBENH_BENHSU': 'txtKHAMBENH_BENHSU',
                'KHAMBENH_MACH': findId(['txtMACH', 'txtKHAMBENH_MACH']),
                'KHAMBENH_NHIETDO': findId(['txtNHIETDO', 'txtKHAMBENH_NHIETDO']),
                'KHAMBENH_HUYETAP': findId(['txtHUYETAP', 'txtHUYETAP_HIGH', 'txtKHAMBENH_HUYETAP_HIGH', 'txtHUYETAP1', 'txtHuyetApMax', 'txtHA_CAO']),
                'KHAMBENH_HUYETAP_HIGH': findId(['txtHUYETAP', 'txtHUYETAP_HIGH', 'txtKHAMBENH_HUYETAP_HIGH', 'txtHUYETAP1', 'txtHuyetApMax', 'txtHA_CAO']), // Fallback key
                'KHAMBENH_HUYETAP_DUOI': findId(['txtHUYETAP_LOW', 'txtKHAMBENH_HUYETAP_LOW', 'txtKHAMBENH_HUYETAP_L0W', 'txtHUYETAP2', 'txtHuyetApMin', 'txtHA_THAP']),
                'KHAMBENH_HUYETAP_LOW': findId(['txtHUYETAP_LOW', 'txtKHAMBENH_HUYETAP_LOW', 'txtKHAMBENH_HUYETAP_L0W', 'txtHUYETAP2', 'txtHuyetApMin', 'txtHA_THAP']), // Fallback key
                'KHAMBENH_NHIPTHO': findId(['txtNHIPTHO', 'txtKHAMBENH_NHIPTHO']),
                'KHAMBENH_CHIEUCAO': findId(['txtCHIEUCAO', 'txtKHAMBENH_CHIEUCAO', 'txtCHIECCO']),
                'KHAMBENH_CANNANG': findId(['txtCANNANG', 'txtKHAMBENH_CANNANG']),
                'KHAMBENH_TUANHOAN': 'txtTUANHOAN',
                'KHAMBENH_HOHAP': 'txtHOHAP',
                'KHAMBENH_TIEUHOA': 'txtTIEUHOA',
                'KHAMBENH_THAN_TIETLIEU': 'txtTHAN_TIETLIEU',
                'KHAMBENH_THANKINH': 'txtTHANKINH',
                'KHAMBENH_CO_XUONGKHOP': 'txtCO_XUONGKHOP',
                'KHAMBENH_TAI_MUI_HONG': 'txtTAI_MUI_HONG',
                'KHAMBENH_RANG_HAM_MAT': 'txtRANG_HAM_MAT',
                'KHAMBENH_MAT': 'txtMAT',
                'KHAMBENH_NOITIET_DD_BLK': 'txtNOITIET_DD_BLK',
                'KHAMBENH_TOMTATKQCANLAMSANG': 'txtTOMTATKQCANLAMSANG',
                'GENERATED_SUMMARY': 'txtTOMTAT_BENHAN'
            };

            // Mapping cho Bệnh án chi tiết (Detailed) - Tab A: Bệnh án hỏi khám bệnh
            const mappingDetailed = {
                'LYDOVAOVIEN': 'txtLYDOVAOVIEN',
                'QUATRINHBENHLY': 'txtQTBENHLY',
                'TIENSUBENH_BANTHAN': 'txtBANTHAN',
                'TIENSUBENH_GIADINH': 'txtGIADINH',
                'KHAMBENH_TOANTHAN': 'txtTOANTHAN',
                'KHAMBENH_MACH': 'txtMACH',
                'KHAMBENH_NHIETDO': 'txtNHIETDO',
                'KHAMBENH_HUYETAP': findId(['txtHUYETAP', 'txtHUYETAP_HIGH', 'txtKHAMBENH_HUYETAP_HIGH', 'txtHUYETAP1', 'txtHuyetApMax', 'txtHA_CAO']),
                'KHAMBENH_HUYETAP_HIGH': findId(['txtHUYETAP', 'txtHUYETAP_HIGH', 'txtKHAMBENH_HUYETAP_HIGH', 'txtHUYETAP1', 'txtHuyetApMax', 'txtHA_CAO']), // Fallback key
                'KHAMBENH_HUYETAP_DUOI': findId(['txtHUYETAP_LOW', 'txtKHAMBENH_HUYETAP_LOW', 'txtKHAMBENH_HUYETAP_L0W', 'txtHUYETAP2', 'txtHuyetApMin', 'txtHA_THAP']),
                'KHAMBENH_HUYETAP_LOW': findId(['txtHUYETAP_LOW', 'txtKHAMBENH_HUYETAP_LOW', 'txtKHAMBENH_HUYETAP_L0W', 'txtHUYETAP2', 'txtHuyetApMin', 'txtHA_THAP']), // Fallback key
                'KHAMBENH_NHIPTHO': 'txtNHIPTHO',
                'KHAMBENH_CHIEUCAO': findId(['txtCHIEUCAO', 'txtCHIECCO']), // HIS hay viết sai chính tả thành "CHIECCO"
                'KHAMBENH_CANNANG': 'txtCANNANG',
                'KHAMBENH_BMI': 'txtBMI',
                'KHAMBENH_TUANHOAN': 'txtTUANHOAN',
                'KHAMBENH_HOHAP': 'txtHOHAP',
                'KHAMBENH_TIEUHOA': 'txtTIEUHOA',
                'KHAMBENH_THAN_TIETLIEU': 'txtTHANTIETNIEUSINHDUC',
                'KHAMBENH_THANKINH': 'txtTHANKINH',
                'KHAMBENH_CO_XUONGKHOP': findId(['txtCOXUONGKHOP', 'txtCOSUONGKHOP']),
                'KHAMBENH_TAI_MUI_HONG': 'txtTAIMUIHONG',
                'KHAMBENH_RANG_HAM_MAT': 'txtRANGHAMMAT',
                'KHAMBENH_MAT': 'txtMAT',
                'KHAMBENH_NOITIET_DD_BLK': findId(['txtNOITIETKHAC', 'txtNTDDKHAC']),
                'KHAMBENH_DAVAMODUOI': findId(['txtBENHNGOAIKHOA', 'txtDAVAMODUOI']),
                'KHAMBENH_TOMTATKQCANLAMSANG': findId(['txtXETNGHIEMCANLAMSANG', 'txtXETNGHIEMCLS']),
                'GENERATED_SUMMARY': findId(['txtTOMTATBENHAN', 'txtTTBENHAN'])
            };

            // Mapping cho Tổng kết hồ sơ bệnh án (Section B)
            const mappingSummary = {
                'KHAMBENH_BENHSU': findId(['txtQTBENHLYDIENBIENLS', 'txtBENHLYDBLS']), // 1. Quá trình bệnh lý và diễn biến lâm sàng
                'KHAMBENH_TOMTATKQCANLAMSANG': findId(['txtKETQUAXNCLS', 'txtKQXNCLS']), // 2. Tóm tắt kết quả XN
                'KHAMBENH_DIEUTRI': findId(['txtPHUONGPHAPDIEUTRI', 'txtPPDIEUTRI']), // 3. Phương pháp điều trị
                'KHAMBENH_TINHTRANG_RAVIEN': findId(['txtTTNGUOIBENHRAVIEN', 'txtTTNBRAVIEN']), // 4. Tình trạng ra viện
                'KHAMBENH_LOIDAN_BS': findId(['txtHUONGDIEUTRICHEDO', 'txtHDTVACDT']) // 5. Hướng điều trị tiếp theo
            };

            // ==========================================
            // NHẬN DIỆN TAB ĐANG MỞ
            // Quan trọng: Cả Tab A lẫn Tab B đều nằm trong cùng 1 iframe,
            // nên KHÔNG THỂ dùng getElementById để phân biệt.
            // Phải dùng tab header đang active để xác định.
            // ==========================================
            const doc = target.contentDocument;

            /** @type {any} */
            let mapping = mappingBasic;
            let specializedFields = [
                'txtTUANHOAN', 'txtHOHAP', 'txtTIEUHOA', 'txtTHAN_TIETLIEU',
                'txtTHANKINH', 'txtCO_XUONGKHOP', 'txtTAI_MUI_HONG',
                'txtRANG_HAM_MAT', 'txtMAT', 'txtNOITIET_DD_BLK'
            ];

            let isSummaryTab = false;
            let isDetailed = false;

            // Tìm tab header đang active trong iframe
            // Các tab thường có class "active", "selected", hoặc style đặc biệt
            const allLinks = doc.querySelectorAll('a, li, span, div');
            let activeTabText = '';
            for (const el of Array.from(allLinks)) {
                const htmlEl = /** @type {HTMLElement} */ (el);
                const text = (htmlEl.textContent || '').trim();
                // Kiểm tra xem element có phải là tab header đang active
                const isActive = htmlEl.classList.contains('active') ||
                    htmlEl.classList.contains('selected') ||
                    htmlEl.classList.contains('ui-tabs-active') ||
                    htmlEl.getAttribute('aria-selected') === 'true' ||
                    (htmlEl.style && htmlEl.style.backgroundColor && htmlEl.style.backgroundColor !== '');

                if (isActive && (text.includes('Bệnh án hỏi khám') || text.includes('Tổng kết hồ sơ') || text.includes('Thông tin bệnh nhân') || text.includes('Hỏi bệnh') || text.includes('Khám bệnh'))) {
                    activeTabText = text;
                    break;
                }
            }

            // Fallback: tìm bằng tab container của jQuery UI Tabs
            if (!activeTabText) {
                const activeTab = doc.querySelector('.ui-tabs-active a, .ui-state-active a, .active a, [aria-selected="true"]');
                if (activeTab) {
                    activeTabText = (activeTab.textContent || '').trim();
                }
            }

            console.log('[History] Active tab text detected:', JSON.stringify(activeTabText));

            if (activeTabText.includes('A.Bệnh án') || activeTabText.includes('hỏi khám bệnh')) {
                console.log('[History] Nhận diện (Text-First): Tab A - Bệnh án hỏi khám bệnh (Chi tiết)');
                isDetailed = true;
                mapping = mappingDetailed;
                specializedFields = [
                    'txtTUANHOAN', 'txtHOHAP', 'txtTIEUHOA', 'txtTHANTIETNIEUSINHDUC',
                    'txtTHANKINH', findId(['txtCOXUONGKHOP', 'txtCOSUONGKHOP']), 'txtTAIMUIHONG',
                    'txtRANGHAMMAT', 'txtMAT', findId(['txtNOITIETKHAC', 'txtNTDDKHAC']),
                    findId(['txtBENHNGOAIKHOA', 'txtDAVAMODUOI'])
                ];
            } else if (activeTabText.includes('B.Tổng kết') || activeTabText.includes('Tổng kết hồ sơ')) {
                console.log('[History] Nhận diện (Text-First): Tab B - Tổng kết hồ sơ bệnh án');
                isSummaryTab = true;
                mapping = mappingSummary;
                specializedFields = [];
            } else if (doc.getElementById('txtQTBENHLYDIENBIENLS') || doc.getElementById('txtBENHLYDBLS')) {
                console.log('[History] Nhận diện (ID Back-up): Tab B - Tổng kết hồ sơ bệnh án');
                isSummaryTab = true;
                mapping = mappingSummary;
                specializedFields = [];
            } else if (doc.getElementById('txtQTBENHLY') || doc.getElementById('txtMACH')) {
                console.log('[History] Nhận diện (ID Back-up): Tab A - Bệnh án hỏi khám bệnh (Chi tiết)');
                isDetailed = true;
                mapping = mappingDetailed;
                specializedFields = [
                    'txtTUANHOAN', 'txtHOHAP', 'txtTIEUHOA', 'txtTHANTIETNIEUSINHDUC',
                    'txtTHANKINH', findId(['txtCOXUONGKHOP', 'txtCOSUONGKHOP']), 'txtTAIMUIHONG',
                    'txtRANGHAMMAT', 'txtMAT', findId(['txtNOITIETKHAC', 'txtNTDDKHAC']),
                    findId(['txtBENHNGOAIKHOA', 'txtDAVAMODUOI'])
                ];
            } else {
                console.log('[History] Nhận diện: Bệnh án Chung (Ngoại Khoa, Nội Khoa...)');
                // Nhóm này có mặt các trường của mappingBasic như txtKHAMBENH_MACH thay vì txtMACH
                isDetailed = false;
                mapping = mappingBasic;
                specializedFields = [
                    'txtTUANHOAN', 'txtHOHAP', 'txtTIEUHOA', 'txtTHAN_TIETLIEU',
                    'txtTHANKINH', 'txtCO_XUONGKHOP', 'txtTAI_MUI_HONG',
                    'txtRANG_HAM_MAT', 'txtMAT', 'txtNOITIET_DD_BLK'
                ];
            }

            // Tóm tắt Bệnh án theo mẫu yêu cầu
            const summary = generateSummary(history, pid);

            const globalWin = /** @type {any} */ (window);
            const settingsInfo = globalWin.VNPTSettings ? globalWin.VNPTSettings.getSettings() : null;

            // Kích hoạt AI nếu Cài đặt đang bật, API khả dụng VÀ đang ở Tab B (và không bị ghi đè sang Base)
            const isVipActive = !!(settingsInfo && settingsInfo.aiEnabled && globalWin.GeminiAPI && isSummaryTab);

            let formattedDienBien = '';
            let tinhTrangRaVien = '';
            let hasTreatments = false;

            // Lấy dữ liệu tờ điều trị cho Bất cứ Tab nào Nếu VIP được Bật (hoặc là Tab B mặc định)
            if (isSummaryTab || isVipActive) {
                console.log('[History] Đang lấy thêm dữ liệu tờ điều trị...');
                const treatments = await fetchTreatmentForPatient(pid);
                if (treatments && treatments.length > 0) {
                    hasTreatments = true;
                    // Hàm helper tính độ tương tự giữa 2 chuỗi (Jaccard Similarity đơn giản)
                    /**
                     * @param {string} str1
                     * @param {string} str2
                     */
                    const calculateSimilarity = (str1, str2) => {
                        if (!str1 || !str2) return 0;
                        const words1 = str1.toLowerCase().replace(/[,.:;+-\/]/g, ' ').split(/\s+/).filter((/** @type {string} */ w) => w.length > 0);
                        const words2 = str2.toLowerCase().replace(/[,.:;+-\/]/g, ' ').split(/\s+/).filter((/** @type {string} */ w) => w.length > 0);

                        const set1 = new Set(words1);
                        const set2 = new Set(words2);

                        let intersection = 0;
                        for (let word of set1) {
                            if (set2.has(word)) intersection++;
                        }

                        const union = new Set([...set1, ...set2]).size;
                        if (union === 0) return 0;

                        const isOpposite = (str1.toLowerCase().includes('tăng') && str2.toLowerCase().includes('giảm')) ||
                            (str1.toLowerCase().includes('giảm') && str2.toLowerCase().includes('tăng'));
                        if (isOpposite) return 0;

                        return intersection / union;
                    };

                    const validTreatments = [...treatments]
                        .filter((/** @type {any} */ t) => t.DIENBIEN || t.DienBien || t.NoiDung)
                        .reverse();

                    /** @type {Array<{dates: string[], content: string}>} */
                    const groupedDienBien = [];

                    for (const t of validTreatments) {
                        let ngay = (t.NGAYMAUBENHPHAM || '').split(' ')[0];
                        let nd = (t.DIENBIEN || t.DienBien || t.NoiDung || '').trim();
                        nd = nd.replace(/\n+/g, ', ').replace(/,\s*,/g, ',').trim();

                        if (!ngay || !nd) continue;
                        const lowerNd = nd.toLowerCase();
                        const isShortOrHoliday =
                            /^(t7|cn|thứ 7|thứ 7,|chủ nhật|chủ nhật,|lễ|nghỉ|nghỉ lễ|nghỉ bù|tết)$/.test(lowerNd) ||
                            lowerNd === 'bệnh tỉnh' ||
                            lowerNd === 'bệnh tỉnh, tiếp xúc tốt' ||
                            (nd.length < 15 && /thay băng|tiếp xúc|bệnh tỉnh|t7|cn|lễ|tết|bù/i.test(nd));

                        if (isShortOrHoliday) continue;

                        if (groupedDienBien.length === 0) {
                            groupedDienBien.push({ dates: [ngay], content: nd });
                            continue;
                        }

                        const lastNode = groupedDienBien[groupedDienBien.length - 1];
                        const similarity = calculateSimilarity(lastNode.content, nd);

                        if (similarity >= 0.6) {
                            if (!lastNode.dates.includes(ngay)) {
                                lastNode.dates.push(ngay);
                            }
                            if (nd.length > lastNode.content.length) {
                                lastNode.content = nd;
                            }
                        } else {
                            groupedDienBien.push({ dates: [ngay], content: nd });
                        }
                    }

                    // Helper parse dd/mm/yyyy thành Date để sort
                    const parseDateDMY = (/** @type {string} */ s) => {
                        const parts = s.trim().split('/');
                        if (parts.length === 3) {
                            return new Date(+parts[2], +parts[1] - 1, +parts[0]);
                        }
                        return new Date(0);
                    };

                    // Sắp xếp dates bên trong mỗi group theo ngày tăng dần
                    for (const group of groupedDienBien) {
                        group.dates.sort((a, b) => parseDateDMY(a).getTime() - parseDateDMY(b).getTime());
                    }

                    // Sắp xếp các group theo ngày nhỏ nhất tăng dần (từ trên xuống dưới)
                    groupedDienBien.sort((a, b) => {
                        const dateA = parseDateDMY(a.dates[0]);
                        const dateB = parseDateDMY(b.dates[0]);
                        return dateA.getTime() - dateB.getTime();
                    });

                    const dienBienItems = groupedDienBien.map(item => {
                        const dateStr = item.dates.join(', ');
                        return `+ [${dateStr}] ${item.content}`;
                    }).join('\n');

                    const qtbl = history.QUATRINHBENHLY || history.KHAMBENH_BENHSU || '';
                    const qtblText = qtbl ? `${qtbl}\nDiễn biến:\n` : 'Diễn biến:\n';
                    formattedDienBien = dienBienItems ? `${qtblText}${dienBienItems}`.trim() : (qtbl || '');

                    // Lấy diễn biến MỚI NHẤT (entry cuối cùng sau khi sort tăng dần)
                    if (groupedDienBien.length > 0) {
                        tinhTrangRaVien = groupedDienBien[groupedDienBien.length - 1].content;
                    } else {
                        const latestTreatment = treatments[treatments.length - 1];
                        tinhTrangRaVien = latestTreatment?.DIENBIEN || latestTreatment?.DienBien || latestTreatment?.NoiDung || '';
                    }
                } else if (!isSummaryTab) {
                    console.warn('[History] Không lấy được dữ liệu tờ điều trị cho AI.');
                }
            }

            // Gọi AI CHỈ CHO Tab Tổng Kết nếu VIP được kích hoạt
            if (isVipActive && isSummaryTab) {
                let vipSuccess = false;
                try {
                    // Bước 1: Thử lấy API Key (từ cache hoặc plaintext)
                    let resolvedApiKey = await HIS.getApiKey();

                    // Bước 2: Nếu không có → kiểm tra có key encrypted cần PIN không
                    if (!resolvedApiKey && HIS.ApiKeyService?.needsPin) {
                        const encrypted = await HIS.ApiKeyService.needsPin();
                        if (encrypted) {
                            // Hiển thị PIN prompt inline ngay tại màn hình bệnh án
                            globalWin.VNPTRealtime?.showToast('🔐 API Key đã mã hóa. Vui lòng nhập PIN...', 'info');
                            resolvedApiKey = await HIS.ApiKeyService.promptAndUnlock();
                        }
                    }

                    // Bước 3: Nếu vẫn không có key → fallback BASE
                    if (!resolvedApiKey) {
                        globalWin.VNPTRealtime?.showToast('⚡ Chuyển sang chế độ Bình thường (BASE)', 'info');
                        console.warn('[History] VIP → BASE: API Key không khả dụng');
                        // KHÔNG throw — tiếp tục điền BASE bình thường
                    } else {
                        // Bước 4: Gọi AI
                        globalWin.VNPTRealtime?.showToast('🪄 AI Đang phân tích Bệnh án...', 'info');
                        const resolvedModel = await HIS.getAiModel();

                        const aiSummary = await globalWin.GeminiAPI.summarizeHistory(
                            formattedDienBien || history.QUATRINHBENHLY || history.KHAMBENH_BENHSU || summary,
                            resolvedApiKey,
                            resolvedModel,
                            pid
                        );
                        if (aiSummary) {
                            formattedDienBien = aiSummary;
                            vipSuccess = true;
                        }
                    }
                } catch (aiErr) {
                    // Bước 5: Lỗi API → fallback BASE tự động
                    console.error('[History] Lỗi AI Summarize, fallback BASE:', aiErr);
                    const msg = (/** @type {any} */(aiErr)).message || 'Lỗi không xác định';
                    globalWin.VNPTRealtime?.showToast(
                        '⚠️ AI lỗi: ' + msg + '. Tự động chuyển sang BASE.',
                        'warning'
                    );
                    // KHÔNG throw — tiếp tục điền BASE bình thường
                }

                if (!vipSuccess) {
                    console.log('[History] VIP không thành công → tiếp tục điền BASE');
                }
            }

            // Cập nhật history object để chuẩn bị gửi sang Injected
            if (isSummaryTab) {
                if (hasTreatments) {
                    history = {
                        ...history,
                        KHAMBENH_BENHSU: formattedDienBien || (history.QUATRINHBENHLY || history.KHAMBENH_BENHSU),
                        KHAMBENH_TOMTATKQCANLAMSANG: '',
                        KHAMBENH_DIEUTRI: '',
                        KHAMBENH_TINHTRANG_RAVIEN: tinhTrangRaVien,
                        KHAMBENH_LOIDAN_BS: 'Xuất viện, uống thuốc theo toa.'
                    };
                } else {
                    history = {
                        ...history,
                        KHAMBENH_TOMTATKQCANLAMSANG: '',
                        KHAMBENH_DIEUTRI: '',
                        KHAMBENH_TINHTRANG_RAVIEN: '',
                        KHAMBENH_LOIDAN_BS: 'Xuất viện, uống thuốc theo toa.'
                    };
                }
            } else {
                // CHO TAB A (Bệnh án ngoại khoa)
                const parts = [];
                if (history.LYDOVAOVIEN) parts.push(`Vào viện vì: ${history.LYDOVAOVIEN}`);
                if (history.QUATRINHBENHLY) parts.push(`Bệnh sử: ${history.QUATRINHBENHLY}`);
                if (history.KHAMBENH_TOANTHAN) parts.push(`Khám toàn thân: ${history.KHAMBENH_TOANTHAN}`);

                let tomtatBA = parts.join('. \n');
                if (!tomtatBA) tomtatBA = 'Bệnh nhân tỉnh, tiếp xúc tốt.';

                history = {
                    ...history,
                    KHAMBENH_BENHSU: formattedDienBien || history.KHAMBENH_BENHSU,
                    GENERATED_SUMMARY: tomtatBA
                };
            }

            // Chuẩn bị mapping cuối cùng
            const finalMapping = { ...mapping };
            if (isDetailed) {
                finalMapping['GENERATED_SUMMARY'] = findId(['txtTOMTATBENHAN', 'txtTTBENHAN']); // Tab A ánh xạ cái này
            } else if (!isSummaryTab) {
                finalMapping['GENERATED_SUMMARY'] = findId(['txtTOMTATBENHAN', 'txtTOMTAT_BENHAN']);
            }
            // Tab B đã dùng KHAMBENH_TINHTRANG_RAVIEN thay vì Tóm tắt Bệnh án ngắn

            console.log('[History] Gửi lệnh fill với các field IDs:', Object.values(finalMapping));
            await sendCmd(target, 'HISTORY_FILL_FORM', {
                history: { ...history, GENERATED_SUMMARY: summary },
                mapping: finalMapping,
                specializedFields: specializedFields,
                defaultMsg: 'Chưa ghi nhận bất thường',
                useAiTyping: !!(settingsInfo && settingsInfo.aiEnabled)
            }, 'HISTORY_FILL_RESULT');

            window.VNPTRealtime?.showToast('✅ Đã điền xong Bệnh án!', 'success');
            console.log('[History] Đã gửi lệnh fill cho các trường:', Object.keys(mapping));

        } catch (e) {
            console.error('[History] Lỗi:', e);
            const msg = (/** @type {any} */(e)).message || 'Lỗi';
            window.VNPTRealtime?.showToast('❌ ' + msg, 'warning');
        }
    }

    async function fetchHistoryForPatient(rowId) {
        if (!window.VNPTMessaging) return null;
        try {
            const res = await window.VNPTMessaging.sendRequest('REQ_FETCH_HISTORY', { rowId }, 5000);
            return res.history || null;
        } catch (e) {
            return null;
        }
    }

    async function fetchTreatmentForPatient(rowId) {
        if (!window.VNPTMessaging) return [];
        try {
            const res = await window.VNPTMessaging.sendRequest('REQ_FETCH_TREATMENT', { rowId }, 8000);
            return res.treatmentList || [];
        } catch (e) {
            return [];
        }
    }

    // =============================================
    // INJECT & COMMUNICATE
    // =============================================

    /** @param {HTMLIFrameElement} iframe */
    async function injectHelper(iframe) {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('Không truy cập iframe');

        const old = doc.getElementById('vnpt-history-helper');
        if (old) old.remove();

        return new Promise((resolve, reject) => {
            const script = doc.createElement('script');
            script.id = 'vnpt-history-helper';
            const _chrome = (/** @type {any} */(window)).chrome;
            if (_chrome && _chrome.runtime) {
                script.src = _chrome.runtime.getURL('content/scanner/history-iframe-helper.js');
                script.onload = () => resolve(undefined);
                script.onerror = () => reject(new Error('Inject failed'));
                (doc.head || doc.documentElement).appendChild(script);
            } else {
                reject(new Error('Chrome unavailable'));
            }
        });
    }

    /** @param {HTMLIFrameElement} iframe @param {string} cmd @param {Object} data @param {string} responseType @param {number} [timeout] */
    async function sendCmd(iframe, cmd, data, responseType, timeout = 8000) {
        return new Promise((resolve, reject) => {
            const targetOrigin = getIframeOrigin(iframe);
            const targetWindow = iframe.contentWindow;

            const tid = setTimeout(() => {
                window.removeEventListener('message', handler);
                reject(new Error('Timeout: ' + cmd));
            }, timeout);

            /** @param {MessageEvent} ev */
            function handler(ev) {
                if (targetWindow && ev.source !== targetWindow) return;
                if (ev.origin !== targetOrigin && ev.origin !== window.location.origin) return;
                if (ev.data && ev.data.type === responseType) {
                    window.removeEventListener('message', handler);
                    clearTimeout(tid);
                    ev.data.success ? resolve(ev.data) : reject(new Error(ev.data.error || 'Lỗi'));
                }
            }
            window.addEventListener('message', handler);
            if (targetWindow) {
                targetWindow.postMessage({ type: cmd, ...data }, targetOrigin);
            } else {
                clearTimeout(tid);
                window.removeEventListener('message', handler);
                reject(new Error('Iframe unavailable'));
            }
        });
    }

    /**
     * Tạo tóm tắt bệnh án theo mẫu
     * @param {any} history 
     * @param {string} pid
     */
    function generateSummary(history, pid) {
        // 1. Lấy giới tính, tuổi từ store hoặc grid
        let gender = 'bệnh nhân';
        let age = '';

        // Thử lấy từ Grid (thường là nguồn tin cậy nhất hiện tại)
        const rows = document.querySelectorAll('#grdBenhNhan tr.ui-widget-content');
        for (const row of Array.from(rows)) {
            // @ts-ignore
            if (row.id === pid) {
                const ageCell = row.querySelector("td[aria-describedby$='_NGAYSINH']");
                const genderCell = row.querySelector("td[aria-describedby$='_GIOITINH']");
                if (genderCell) gender = genderCell.textContent?.trim().toLowerCase() === 'nam' ? 'nam' : 'nữ';
                if (ageCell) {
                    const dob = ageCell.textContent?.trim() || '';
                    if (dob.includes('/')) {
                        const birthYear = parseInt(dob.split('/').pop() || '0');
                        if (birthYear > 0) age = (new Date().getFullYear() - birthYear) + ' tuổi';
                    } else if (dob.length === 4) {
                        age = (new Date().getFullYear() - parseInt(dob)) + ' tuổi';
                    }
                }
                break;
            }
        }

        const person = `Bệnh nhân ${gender}${age ? ', ' + age : ''}`;
        const reason = history.LYDOVAOVIEN || 'chưa ghi nhận';
        const total = history.KHAMBENH_TOANTHAN || 'chưa ghi nhận';
        const parts = history.KHAMBENH_BOPHAN || 'chưa ghi nhận';

        return `${person}, vào viện vì ${reason}, qua thăm khám lâm sàng ghi nhận:\n- Toàn thân: ${total}\n- Khám bộ phận: ${parts}`;
    }

    /**
     * Log fields of the current BM iframe for mapping help
     */
    function logActiveFormFields() {
        // Try all iframes if current is lost
        const target = currentFormIframe || (document.querySelector('iframe'));
        if (!target || !target.contentWindow) {
            console.log('[History] Không tìm thấy form Bệnh án đang mở.');
            window.VNPTRealtime?.showToast('⚠️ Không tìm thấy form Bệnh án!', 'warning');
            return;
        }

        (async () => {
            try {
                await injectHelper(target);
                console.log('[History] Đang yêu cầu log fields...');
                if (target.contentWindow) {
                    target.contentWindow.postMessage({ type: 'LOG_FIELDS' }, getIframeOrigin(target));
                    window.VNPTRealtime?.showToast('🔍 Đã ghi danh sách ID vào Console (F12)', 'success');
                }
            } catch (e) {
                console.error('[History] Lỗi log fields:', e);
            }
        })();
    }

    return { init, fetchHistoryForPatient, doFillForm };
})();

// Export globally
// @ts-ignore
window.VNPTHistory = VNPTHistory;
