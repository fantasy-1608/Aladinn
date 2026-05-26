/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Clinical Fill (Hội Chẩn & Chuyển Viện Auto-Fill)
 * 
 * Passive approach (giống Emergency/Nutrition):
 * - MutationObserver detect iframe chứa form Hội chẩn hoặc Chuyển viện
 * - Hiện FAB icon cạnh modal
 * - Click → fetch clinical data → preview → fill
 * 
 * CHỈ chạy ở TOP FRAME.
 */

const VNPTClinicalFill = (function () {
    if (window !== window.top) {
        return { init: function () { } };
    }

    const _chrome = typeof window['chrome'] !== 'undefined' ? window['chrome'] : null;

    /** @type {HTMLDivElement | null} */
    let fillButton = null;
    /** @type {HTMLIFrameElement | null} */
    let currentFormIframe = null;
    /** @type {string} */
    let _currentFormType = ''; // 'hoichan' | 'chuyenvien' | 'xutri' | 'nhapbenhnhan'
    /** @type {string | null} */
    let lastPatientId = null;

    // ==========================================
    // FIELD MAPPINGS (từ autofill.js)
    // ==========================================
    const HOICHAN_MAPPING = {
        // === TRÍCH YẾU / THÔNG TIN CHÍNH ===
        'trichBienBan':      'txtTRICH_BB_HOICHUAN',          // Trích biên bản hội chẩn
        'lyDoHoiChan':       'txtLYDO_HOICHAN',               // Lý do hội chẩn
        'yeuCauHoiChan':     'txtYEUCAUHOICHAN',              // Yêu cầu hội chẩn
        // === TÓM TẮT BỆNH ===
        'tomTatTieuSuBenh':  'txtTOMTAT_TIEUSUBENH',         // Tóm tắt tiểu sử bệnh
        'tomTatTTVaoVien':   'txtTOMTAT_TT_VAOVIEN',         // Tóm tắt TT lúc vào viện
        'tomTatTTHienTai':   'txtTOMTAT_TT_HIENTAI',         // Tóm tắt TT hiện tại
        'benhSu':            'txtBENHSU',                     // Bệnh sử
        // === QUÁ TRÌNH / KẾT QUẢ ===
        'quaTrinhDieuTriCS': 'txtQUATRINH_DIEUTRI_CS',       // QT diễn biến + CS
        'ketLuanChanDoan':   'txtKETLUAN_CHANDOAN',          // CĐ, nguyên nhân, tiên lượng
        'yKienThanhVien':    'txtYKIEN_THANHVIEN',           // Ý kiến thành viên
        // === KẾT LUẬN / HƯỚNG XỬ LÝ ===
        'phuongPhapDieuTri': 'txtPHUONGPHAPDIEUTRI',        // Phương pháp điều trị
        'chamSoc':           'txtCHAMSOC',                   // Chăm sóc
        'ketLuan':           'txtKET_LUAN',                  // Kết luận
        'huongDieuTri':      'txtHUONG_DIEUTRI',             // Hướng điều trị tiếp theo
        'deNghi':            'txtDE_NGHI',                   // Đề nghị
    };

    const CHUYENVIEN_MAPPING = {
        'dauHieuLamSang': 'txtDAUHIEULAMSANG|txtDAU_HIEU_LAM_SANG',
        'quaTrinhBenhLy': 'txtQUATRINHBENHLY|txtQUATRINH_BENHLY|txtQUATRINH_DIENBIEN|txtBENHSU',
        'ketQuaCLS': 'txtKETQUACANLAMSANG|txtKETQUA_CLS|txtCANLAMSANG',
        'tinhTrangNguoiBenh': 'txtTINHTRANGNGUOIBENH|txtTINHTRANG_CHUYENTUYEN',
        'thuoc': 'txtTHUOC|txtTHUOC_DIEUTRI',
        'huongDieuTri': 'txtHUONGDIEUTRI|txtHUONG_DIEU_TRI'
    };

    function getAllowedOrigin() {
        return window.VNPTConfig?.security?.allowedOrigin || window.location.origin;
    }

    // ==========================================
    // INIT
    // ==========================================
    function init() {
        let scanTimeout = null;
        const throttledCheck = () => {
            if (scanTimeout) return;
            scanTimeout = setTimeout(() => {
                checkForClinicalForm();
                scanTimeout = null;
            }, 500);
        };

        const observer = new MutationObserver(() => {
            if (typeof window === 'undefined' || !window.VNPTStore) return;
            throttledCheck();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        // Bổ sung polling nhẹ để bypass giới hạn MutationObserver xuyên iframe
        // Thêm guard: tạm dừng khi tab ẩn (tiết kiệm CPU)
        setInterval(() => {
            if (typeof window === 'undefined' || document.hidden) return;
            throttledCheck();
        }, 2000);
        checkForClinicalForm();

        if (window.VNPTStore) {
            window.VNPTStore.subscribe('selectedPatientId', (pid) => {
                if (pid) onPatientSelected(pid);
            });
            const currentPid = window.VNPTStore.get('selectedPatientId');
            if (currentPid) onPatientSelected(currentPid);
        }

        console.log('[ClinicalFill] Module initialized (top frame)');
    }

    function onPatientSelected(pid) {
        if (!pid || pid === lastPatientId) return;
        lastPatientId = pid;
    }

    // ==========================================
    // DETECT MODAL
    // ==========================================
    function checkForClinicalForm() {
        let matches = [];
        let counter = 0;

        function getModalTitle(iframe) {
            try {
                const jBoxWrapper = iframe.closest('.jBox-wrapper');
                if (jBoxWrapper) {
                    const titleEl = jBoxWrapper.querySelector('.jBox-title');
                    if (titleEl && titleEl.textContent) {
                        return titleEl.textContent.trim();
                    }
                }
            } catch (_e) {
                // Safe fallback
            }
            return null;
        }

        function getIframeZIndex(iframe) {
            try {
                const wrapper = iframe.closest('.jBox-wrapper, .ui-dialog, .jBox-container');
                if (wrapper) {
                    const z = window.getComputedStyle(wrapper).zIndex;
                    if (z && !isNaN(z) && z !== 'auto') {
                        return parseInt(z, 10);
                    }
                }
                let el = iframe;
                while (el && el !== document.body) {
                    const style = window.getComputedStyle(el);
                    if (style.position === 'absolute' || style.position === 'relative' || style.position === 'fixed') {
                        const z = style.zIndex;
                        if (z && !isNaN(z) && z !== 'auto') {
                            return parseInt(z, 10);
                        }
                    }
                    el = el.parentElement;
                }
            } catch (_e) {
                // Safe ignore
            }
            return 0;
        }

        // Hàm scan đệ quy để tìm iframe lồng nhau (VD: jBox modal bên trong iframe chính)
        function scanIframes(doc) {
            if (!doc) return;
            const iframes = doc.querySelectorAll('iframe');
            for (const iframe of Array.from(iframes)) {
                if (!iframe || iframe.tagName !== 'IFRAME') continue;
                if (iframe.offsetWidth === 0 && iframe.offsetHeight === 0) continue;

                // Đọc src + contentDocument sớm để dùng cho cả exclusion lẫn detection
                const iframeSrc = (iframe.src || '').toLowerCase();
                let innerDoc = null;
                try { innerDoc = iframe.contentDocument; } catch (_e) { /* cross-origin */ }

                // ── EXCLUSION: Bỏ qua form Dinh dưỡng DD-03 ──
                // HIS dùng chung iframe ID `dlgXuTriifmView` cho nhiều loại phiếu,
                // nên phải loại trừ DD-03 trước khi chạy detection Hội chẩn/Chuyển viện.
                const isNutritionByUrl = iframeSrc.includes('pslvdgddnbnt') || iframeSrc.includes('dinhduong') || iframeSrc.includes('dd03') || iframeSrc.includes('dd-03');
                const isNutritionByFields = innerDoc && innerDoc.getElementById('textfield_1535') && innerDoc.getElementById('textfield_1536');
                if (isNutritionByUrl || isNutritionByFields) {
                    // Vẫn scan đệ quy vào iframe con (có thể chứa form khác)
                    if (innerDoc) scanIframes(innerDoc);
                    continue; // Bỏ qua iframe này — không detect Hội chẩn/Chuyển viện
                }

                let isHoiChan = false;
                let isChuyenVien = false;
                let isXuTri = false;
                let isNhapBenhNhan = false;

                const modalTitle = getModalTitle(iframe);
                if (modalTitle) {
                    // Phân biệt nghiêm ngặt theo tiêu đề modal
                    if (/cập nhật bệnh nhân|nhập bệnh nhân/i.test(modalTitle)) {
                        isNhapBenhNhan = true;
                    } else if (/xử trí/i.test(modalTitle)) {
                        isXuTri = true;
                    } else if (/hội chẩn|hội chuẩn/i.test(modalTitle)) {
                        isHoiChan = true;
                    } else if (/chuyển viện/i.test(modalTitle)) {
                        isChuyenVien = true;
                    }
                    // Nếu là modal có tiêu đề khác (ví dụ: "Bệnh án nội khoa"),
                    // tất cả flag vẫn là false -> Tắt hẳn.
                } else {
                    // Phương pháp 1: Detect qua iframe src URL pattern
                    // ── Ưu tiên detect Nhập bệnh nhân TRƯỚC Xử trí ──
                    if (iframe.id === 'divDlgNhapBenhNhanifmView' ||
                        iframeSrc.includes('ntu01h002_nhapbenhnhan') ||
                        iframeSrc.includes('nhapbenhnhan')
                    ) {
                        isNhapBenhNhan = true;
                    } else if (iframeSrc.includes('bienbanhoi') || iframeSrc.includes('hoichuan') || iframeSrc.includes('hoichan') || iframeSrc.includes('ntu02d008')) {
                        isHoiChan = true;
                    } else if (iframeSrc.includes('chuyenvien') || iframeSrc.includes('ngt02k009')) {
                        isChuyenVien = true;
                    } else if (
                        iframeSrc.includes('xutri')
                    ) {
                        isXuTri = true;
                    }

                    // Phương pháp 2: Detect qua field IDs trong iframe (nếu accessible)
                    // Chỉ dùng khi chưa xác định được từ URL
                    if (innerDoc && !isHoiChan && !isChuyenVien && !isXuTri && !isNhapBenhNhan) {
                        try {
                            // Detect Nhập bệnh nhân qua field đặc trưng
                            isNhapBenhNhan = !!(
                                innerDoc.getElementById('txtTKCHANDOANVAOKHOA') &&
                                innerDoc.getElementById('cboMACHANDOANVAOKHOA')
                            );

                            isHoiChan = !isNhapBenhNhan && !!(
                                innerDoc.getElementById('txtTOMTAT_TIEUSUBENH') ||
                                innerDoc.getElementById('txtKETLUAN_CHANDOAN') ||
                                innerDoc.getElementById('txtTOMTAT_TT_VAOVIEN')
                            );

                            // Chỉ dùng field đặc trưng riêng của form chuyển viện
                            // KHÔNG dùng txtQUATRINHBENHLY vì nó cũng có trong form Hỏi bệnh
                            isChuyenVien = !isNhapBenhNhan && !isHoiChan && !!(
                                innerDoc.getElementById('txtDAUHIEULAMSANG') ||
                                innerDoc.getElementById('txtDAU_HIEU_LAM_SANG') ||
                                innerDoc.getElementById('txtTINHTRANGNGUOIBENH') ||
                                innerDoc.getElementById('txtTINHTRANG_CHUYENTUYEN')
                            );

                            isXuTri = !isNhapBenhNhan && !isHoiChan && !isChuyenVien && !!(
                                innerDoc.getElementById('txtMABENHCHINH') &&
                                (innerDoc.getElementById('txtNGAYRAKHOA') || innerDoc.getElementById('datepicker_NGAYRAKHOA') || innerDoc.getElementById('txtBENHKEMTHEO'))
                            );
                        } catch (_e2) { /* cross-origin field access */ }
                    }
                }

                if (isHoiChan || isChuyenVien || isXuTri || isNhapBenhNhan) {
                    let type = 'hoichan';
                    if (isNhapBenhNhan) type = 'nhapbenhnhan';
                    else if (isChuyenVien) type = 'chuyenvien';
                    else if (isXuTri) type = 'xutri';

                    matches.push({
                        iframe: iframe,
                        type: type,
                        index: counter++,
                        zIndex: getIframeZIndex(iframe)
                    });
                }

                // Scan đệ quy vào iframe con nếu có quyền truy cập
                if (innerDoc) {
                    scanIframes(innerDoc);
                }
            }
        }

        scanIframes(document);

        if (matches.length > 0) {
            // Sắp xếp tìm ra iframe trên cùng:
            // 1. Phần tử có zIndex cao nhất đứng trước
            // 2. Tie-breaker bằng DOM order (phần tử chèn sau có index cao hơn đứng trước)
            matches.sort((a, b) => {
                if (a.zIndex !== b.zIndex) {
                    return b.zIndex - a.zIndex;
                }
                return b.index - a.index;
            });

            const topMatch = matches[0];
            currentFormIframe = topMatch.iframe;
            _currentFormType = topMatch.type;

            if (!fillButton || !document.body.contains(fillButton) || fillButton.dataset.formType !== topMatch.type) {
                showFillButton(topMatch.iframe, topMatch.type);
            }
        } else {
            hideFillButton();
            currentFormIframe = null;
            _currentFormType = '';
        }
    }

    // ==========================================
    // FAB BUTTON (Premium Glassmorphic Theme)
    // ==========================================
    function showFillButton(iframe, type) {
        hideFillButton();

        const container = document.createElement('div');
        container.id = 'vnpt-clinical-fill-btn';
        container.dataset.formType = type;

        const isCV = type === 'chuyenvien';
        const isXT = type === 'xutri';
        const isNBN = type === 'nhapbenhnhan';

        const SVGS = {
            hoichan: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; color: #818cf8; filter: drop-shadow(0 0 2px rgba(99, 102, 241, 0.45));"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>',
            chuyenvien: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; color: #fb7185; filter: drop-shadow(0 0 2px rgba(244, 63, 94, 0.45));"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>',
            xutri: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; color: #38bdf8; filter: drop-shadow(0 0 2px rgba(14, 165, 233, 0.45));"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>',
            nhapbenhnhan: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="width: 22px; height: 22px; color: #34d399; filter: drop-shadow(0 0 2px rgba(52, 211, 153, 0.45));"><path d="M22 12h-4l-3 9L9 3l-3 9H2"></path></svg>',
            processing: '<svg class="fab-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="width: 22px; height: 22px; color: var(--cf-color); animation: fab-spin 1s linear infinite;"><circle cx="12" cy="12" r="10" stroke="currentColor" stroke-opacity="0.25"></circle><path d="M12 2a10 10 0 0 1 10 10" stroke="currentColor" stroke-linecap="round"></path></svg>',
            done: '<svg viewBox="0 0 24 24" fill="none" stroke="#22c55e" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px; filter: drop-shadow(0 0 2px rgba(34, 197, 94, 0.45));"><polyline points="20 6 9 17 4 12"></polyline></svg>',
            error: '<svg viewBox="0 0 24 24" fill="none" stroke="#ef4444" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="width: 24px; height: 24px; filter: drop-shadow(0 0 2px rgba(239, 68, 68, 0.45));"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>'
        };

        let iconHtml = SVGS.hoichan;
        let label = 'Điền Hội chẩn';
        let themeVars = {
            '--cf-color': '#818cf8',
            '--cf-border': 'rgba(99, 102, 241, 0.4)',
            '--cf-border-hover': 'rgba(99, 102, 241, 0.8)',
            '--cf-shadow': 'rgba(99, 102, 241, 0.2)',
            '--cf-shadow-hover': 'rgba(99, 102, 241, 0.45)',
            '--cf-shadow-bright': 'rgba(99, 102, 241, 0.35)',
            '--cf-inner-glow': 'rgba(99, 102, 241, 0.15)',
            '--cf-inner-glow-bright': 'rgba(99, 102, 241, 0.3)'
        };

        if (isNBN) {
            iconHtml = SVGS.nhapbenhnhan;
            label = 'Điền CĐ Vào khoa';
            themeVars = {
                '--cf-color': '#34d399',
                '--cf-border': 'rgba(52, 211, 153, 0.4)',
                '--cf-border-hover': 'rgba(52, 211, 153, 0.8)',
                '--cf-shadow': 'rgba(52, 211, 153, 0.2)',
                '--cf-shadow-hover': 'rgba(52, 211, 153, 0.45)',
                '--cf-shadow-bright': 'rgba(52, 211, 153, 0.35)',
                '--cf-inner-glow': 'rgba(52, 211, 153, 0.15)',
                '--cf-inner-glow-bright': 'rgba(52, 211, 153, 0.3)'
            };
        } else if (isCV) {
            iconHtml = SVGS.chuyenvien;
            label = 'Điền Chuyển viện';
            themeVars = {
                '--cf-color': '#fb7185',
                '--cf-border': 'rgba(244, 63, 94, 0.4)',
                '--cf-border-hover': 'rgba(244, 63, 94, 0.8)',
                '--cf-shadow': 'rgba(244, 63, 94, 0.2)',
                '--cf-shadow-hover': 'rgba(244, 63, 94, 0.45)',
                '--cf-shadow-bright': 'rgba(244, 63, 94, 0.35)',
                '--cf-inner-glow': 'rgba(244, 63, 94, 0.15)',
                '--cf-inner-glow-bright': 'rgba(244, 63, 94, 0.3)'
            };
        } else if (isXT) {
            iconHtml = SVGS.xutri;
            label = 'Điền Xử trí';
            themeVars = {
                '--cf-color': '#38bdf8',
                '--cf-border': 'rgba(14, 165, 233, 0.4)',
                '--cf-border-hover': 'rgba(14, 165, 233, 0.8)',
                '--cf-shadow': 'rgba(14, 165, 233, 0.2)',
                '--cf-shadow-hover': 'rgba(14, 165, 233, 0.45)',
                '--cf-shadow-bright': 'rgba(14, 165, 233, 0.35)',
                '--cf-inner-glow': 'rgba(14, 165, 233, 0.15)',
                '--cf-inner-glow-bright': 'rgba(14, 165, 233, 0.3)'
            };
        }

        if (!document.getElementById('vnpt-clinical-fill-style')) {
            const style = document.createElement('style');
            style.id = 'vnpt-clinical-fill-style';
            style.textContent = `
                @keyframes fab-pulse-clinical {
                    0%, 100% { 
                        box-shadow: 0 4px 16px var(--cf-shadow, rgba(99,102,241,0.2)), 
                                    inset 0 0 6px var(--cf-inner-glow, rgba(99,102,241,0.15)) !important; 
                    }
                    50% { 
                        box-shadow: 0 6px 24px var(--cf-shadow-bright, rgba(99,102,241,0.35)), 
                                    inset 0 0 10px var(--cf-inner-glow-bright, rgba(99,102,241,0.3)) !important; 
                    }
                }
                @keyframes fab-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fab-bounce { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
                @keyframes fab-shake { 0%,100% { transform: translateX(0); } 20%,60% { transform: translateX(-4px); } 40%,80% { transform: translateX(4px); } }
                @keyframes fab-entry { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }
                
                #vnpt-clinical-fab {
                    position: fixed !important; top: 180px !important; right: 15px !important;
                    z-index: 2147483647 !important;
                    width: 48px !important; height: 48px !important; border-radius: 50% !important;
                    display: flex !important; align-items: center !important; justify-content: center !important;
                    cursor: pointer !important; user-select: none !important;
                    background: rgba(15, 23, 42, 0.85) !important;
                    backdrop-filter: blur(8px) !important;
                    -webkit-backdrop-filter: blur(8px) !important;
                    border: 2px solid var(--cf-border) !important;
                    transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1), border-color 0.2s, box-shadow 0.2s !important;
                    animation: fab-entry 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), fab-pulse-clinical 3s infinite ease-in-out 0.4s !important;
                }
                #vnpt-clinical-fab:hover { 
                    transform: scale(1.1) !important; 
                    border-color: var(--cf-border-hover) !important; 
                    box-shadow: 0 6px 24px var(--cf-shadow-hover), inset 0 0 10px var(--cf-inner-glow-bright) !important; 
                }
                #vnpt-clinical-fab:active { 
                    transform: scale(0.92) !important; 
                    transition: transform 0.08s ease !important;
                }
                #vnpt-clinical-fab.processing { 
                    border-color: var(--cf-border-hover) !important;
                    box-shadow: 0 4px 16px var(--cf-shadow) !important;
                    pointer-events: none !important; 
                }
                #vnpt-clinical-fab.done { 
                    border-color: rgba(34, 197, 94, 0.8) !important;
                    box-shadow: 0 6px 24px rgba(34, 197, 94, 0.4), inset 0 0 10px rgba(34, 197, 94, 0.3) !important;
                    animation: fab-bounce 0.5s ease !important; 
                }
                #vnpt-clinical-fab.error { 
                    border-color: rgba(239, 68, 68, 0.8) !important;
                    box-shadow: 0 6px 24px rgba(239, 68, 68, 0.4), inset 0 0 10px rgba(239, 68, 68, 0.3) !important;
                    animation: fab-shake 0.4s ease !important; 
                }
                #vnpt-clinical-fab::after {
                    content: attr(data-tooltip); position: absolute;
                    right: 56px; top: 50%; transform: translateY(-50%);
                    background: rgba(15,23,42,0.95); color: #f1f5f9;
                    border: 1px solid var(--cf-border);
                    padding: 6px 12px; border-radius: 8px;
                    font-size: 12px; font-weight: 500; white-space: nowrap;
                    pointer-events: none; opacity: 0; transition: opacity 0.2s;
                    font-family: 'Inter', system-ui, sans-serif;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                #vnpt-clinical-fab:hover::after { opacity: 1; }
                /* Preview dialog */
                @keyframes clinical-dialog-glow {
                    0%, 100% {
                        box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 15px rgba(31, 105, 194, 0.12);
                        border-color: rgba(31, 105, 194, 0.2);
                    }
                    50% {
                        box-shadow: 0 25px 70px rgba(0,0,0,0.7), 0 0 25px rgba(31, 105, 194, 0.3);
                        border-color: rgba(31, 105, 194, 0.4);
                    }
                }
                .clinical-preview-overlay {
                    position: fixed; inset: 0; z-index: 2147483646;
                    background: rgba(0,0,0,0.5); display: flex;
                    align-items: center; justify-content: center;
                }
                .clinical-preview-dialog {
                    background: #ffffff; color: #333333; border-radius: 0px;
                    padding: 24px; max-width: 700px; width: 90%;
                    max-height: 80vh; overflow-y: auto;
                    animation: clinical-dialog-glow 8s ease-in-out infinite;
                }
                .clinical-preview-dialog h3 {
                    margin: 0 0 16px; color: #004f9e; font-size: 18px;
                    font-weight: bold; border-bottom: 1px solid #a6c9e2;
                    padding-bottom: 8px; text-transform: uppercase;
                }
                .clinical-preview-dialog .field-row {
                    margin-bottom: 12px; padding: 0;
                    background: transparent; border-radius: 0;
                    border-left: none;
                }
                .clinical-preview-dialog .field-label {
                    font-size: 12px; color: #004f9e; font-weight: bold;
                    margin-bottom: 4px; display: block;
                }
                .field-value-input {
                    background: #ffffff !important;
                    border: 1px solid #a6c9e2 !important;
                    color: #333333 !important;
                    border-radius: 0px !important;
                    padding: 6px 8px !important;
                    font-family: Arial, Tahoma, sans-serif !important;
                    font-size: 13px !important;
                    width: 100% !important;
                    box-sizing: border-box !important;
                    display: block !important;
                    transition: border-color 0.15s ease-in-out !important;
                }
                .field-value-input:focus {
                    outline: none !important;
                    border-color: #004f9e !important;
                }
                .clinical-preview-actions {
                    display: flex; gap: 8px; margin-top: 20px; justify-content: flex-end;
                    border-top: 1px solid #a6c9e2; padding-top: 16px;
                }
                .clinical-preview-actions button {
                    padding: 6px 16px; border: 1px solid transparent; border-radius: 0px;
                    cursor: pointer; font-size: 13px; font-weight: bold;
                    transition: background 0.15s ease-in-out; font-family: Arial, Tahoma, sans-serif;
                }
                .clinical-btn-cancel {
                    background: #f9f9f9; color: #333; border: 1px solid #ccc;
                }
                .clinical-btn-cancel:hover { background: #e0e0e0; }
                .clinical-btn-fill {
                    background: #004f9e;
                    color: #ffffff;
                }
                .clinical-btn-fill:hover { 
                    background: #003d7a;
                }
            `;
            document.head.appendChild(style);
        }

        const fab = document.createElement('div');
        fab.id = 'vnpt-clinical-fab';
        fab.innerHTML = iconHtml;
        fab.setAttribute('data-tooltip', label);
        for (const [key, val] of Object.entries(themeVars)) {
            fab.style.setProperty(key, val);
        }

        fab.addEventListener('click', async () => {
            const origIcon = fab.innerHTML;
            const origTooltip = fab.getAttribute('data-tooltip');
            fab.className = 'processing';
            fab.innerHTML = SVGS.processing;

            try {
                let token = null;
                if (window.VNPTPatientContextGuard) {
                    token = await window.VNPTPatientContextGuard.capture(iframe, type);
                }

                await doFill(iframe, type, token);
                fab.className = 'done';
                fab.innerHTML = SVGS.done;
                fab.setAttribute('data-tooltip', 'Đã điền xong!');
                setTimeout(() => resetFab(fab, origIcon, origTooltip), 3000);
            } catch (e) {
                let msg = (e instanceof Error) ? e.message : 'Lỗi';
                if (msg === 'FORM_CONTEXT_MISMATCH') {
                    msg = 'Cảnh báo: Thông tin điền vào KHÔNG KHỚP với tên bệnh nhân trên màn hình! Đã chặn thao tác để đảm bảo an toàn.';
                }
                window.VNPTRealtime?.showToast('❌ ' + msg, 'error');
                fab.className = 'error';
                fab.innerHTML = SVGS.error;
                fab.setAttribute('data-tooltip', 'Lỗi! Click thử lại');
                setTimeout(() => resetFab(fab, origIcon, origTooltip), 3000);
            }
        });

        container.appendChild(fab);
        document.body.appendChild(container);
        fillButton = container;
    }

    function resetFab(fab, icon, tooltip) {
        if (fillButton && fab) {
            fab.className = '';
            fab.innerHTML = icon;
            fab.setAttribute('data-tooltip', tooltip);
        }
    }

    function hideFillButton() {
        const el = document.getElementById('vnpt-clinical-fill-btn');
        if (el) el.remove();
        fillButton = null;
    }

    // ==========================================
    // FETCH CLINICAL DATA
    // ==========================================
    async function fetchClinicalData(pid, contextToken = null) {
        if (!window.VNPTMessaging) throw new Error('Messaging bridge chưa sẵn sàng');
        const res = await window.VNPTMessaging.sendRequest('REQ_FETCH_CLINICAL_SUMMARY', { rowId: pid, contextToken }, 12000);
        return res;
    }

    // ==========================================
    // BUILD FORM DATA FROM RAW CLINICAL DATA
    // ==========================================
    function buildHoiChanData(raw) {
        const join = (...parts) => parts.filter(p => p && String(p).trim()).join('. ');

        // Tóm tắt TT vào viện: chỉ khám toàn thân + khám bộ phận
        const ttVaoVien = join(raw.khamToanThan, raw.khamBoPhan);

        // Tóm tắt TT hiện tại: ưu tiên diễn biến tờ điều trị mới nhất,
        // gộp thêm Khám toàn thân của tờ điều trị nếu có,
        // fallback khám toàn thân + bộ phận từ HSBA
        const ttHienTai = raw.dienBienBenh || raw.khamToanThanTDT
            ? join(raw.dienBienBenh, raw.khamToanThanTDT)
            : join(raw.khamToanThan, raw.khamBoPhan);

        // Kết luận chẩn đoán: ưu tiên nguyên chẩn đoán từ tờ điều trị mới nhất (chính + kèm theo)
        // Fallback: chẩn đoán chính + kèm theo từ HSBA
        let chanDoanFull;
        if (raw.chanDoanMoiNhat) {
            // Có tờ điều trị → lấy nguyên chẩn đoán
            chanDoanFull = raw.chanDoanMoiNhat;
            if (raw.chanDoanKemTheoTDT) {
                chanDoanFull += '; ' + raw.chanDoanKemTheoTDT;
            }
        } else {
            // Không có tờ điều trị → lấy từ chẩn đoán chính + kèm theo
            chanDoanFull = raw.chanDoanBanDau || '';
            if (raw.chanDoanKemTheo) {
                chanDoanFull += (chanDoanFull ? '; ' : '') + raw.chanDoanKemTheo;
            }
        }

        // Định dạng lại chẩn đoán: loại bỏ mã ICD, thay dấu '-' và ';' bằng dấu phẩy
        if (chanDoanFull) {
            const parts = chanDoanFull.split(';');
            const cleanedParts = parts.map(p => {
                let s = p.trim();
                // 1. Loại bỏ mã ICD ở đầu đoạn (VD: "S06 - ", "S01.0-", "V99-")
                s = s.replace(/^[A-Z]\d{2}(?:\.\d+)?\s*[-–]\s*/i, '');
                // 2. Thay các dấu trừ còn lại bằng phẩy và khoảng trắng
                s = s.replace(/\s*[-–]\s*/g, ', ');
                return s;
            }).filter(Boolean);
            
            // 3. Nối lại bằng dấu phẩy
            chanDoanFull = cleanedParts.join(', ');
        }

        return {
            'tomTatTieuSuBenh': join(
                raw.quaTrinhBenhLy,
                raw.tienSuBanThan ? 'Tiền sử bản thân: ' + raw.tienSuBanThan : '',
                raw.tienSuGiaDinh ? 'Tiền sử gia đình: ' + raw.tienSuGiaDinh : ''
            ),
            'tomTatTTVaoVien': ttVaoVien,
            'tomTatTTHienTai': ttHienTai,
            'quaTrinhDieuTriCS': [
                join(raw.quaTrinhBenhLy, raw.tienSuBanThan ? 'Tiền sử bản thân: ' + raw.tienSuBanThan : '', raw.tienSuGiaDinh ? 'Tiền sử gia đình: ' + raw.tienSuGiaDinh : ''),
                ttHienTai
            ].filter(Boolean).join('\n'),
            'ketLuanChanDoan': chanDoanFull
                ? 'Chẩn đoán: ' + chanDoanFull + '\nTiên lượng:'
                : '',
            'huongDieuTri': '',
            'trichBienBan': 'Khoa',
            'ketLuan': chanDoanFull
                ? 'Chẩn đoán: ' + chanDoanFull + '\nTiên lượng:'
                : ''
        };
    }

    function buildChuyenVienData(raw) {
        const join = (...parts) => parts.filter(p => p && String(p).trim()).join('. ');
        const v = raw.sinhHieu || {};
        const vitalStr = [
            v.pulse ? 'Mạch: ' + v.pulse + ' l/p' : '',
            v.temperature ? 'Nhiệt độ: ' + v.temperature + '°C' : '',
            v.bloodPressure ? 'HA: ' + v.bloodPressure + ' mmHg' : ''
        ].filter(Boolean).join(', ');

        // Dấu hiệu lâm sàng: ưu tiên khám toàn thân từ tờ điều trị nếu có, fallback HSBA
        const kttSource = raw.khamToanThanTDT || raw.khamToanThan;
        const dauHieu = join(kttSource, raw.khamBoPhan, vitalStr ? 'Sinh hiệu: ' + vitalStr : '');

        // Tình trạng người bệnh: gộp diễn biến + khám toàn thân tờ điều trị
        const tinhTrang = join(raw.dienBienBenh, raw.khamToanThanTDT)
            || join(raw.khamToanThan, raw.khamBoPhan);

        return {
            'dauHieuLamSang': dauHieu,
            'quaTrinhBenhLy': raw.quaTrinhBenhLy || '',
            'ketQuaCLS': raw.tomTatCLS || '',
            'tinhTrangNguoiBenh': tinhTrang,
            'thuoc': 'Toa thuốc Bệnh viện',
            'huongDieuTri': raw.huongXuLy || 'Chuyển tuyến trên'
        };
    }

    function buildXuTriData(raw) {
        const parsed = parseICD(raw.chanDoanMoiNhat) || {};
        return {
            mainDiag: parsed.mainDiag || { code: '', text: '' },
            subDiag: parsed.subDiag || { code: '', text: '' },
            ngayRaKhoa: raw.ngayToDieuTriMoiNhat || ''
        };
    }

    // ==========================================
    // PARSE ICD TỪ CHUỖI CỦA HIS
    // ==========================================
    function parseICD(diagString) {
        if (!diagString) return null;
        const parts = diagString.split(';');
        
        // Tách bệnh chính (Mã đầu tiên)
        const mainMatch = parts[0].match(/^([A-Z]\d{2}(?:\.\d+)?)[^a-zA-Z0-9]*(.*)$/i);
        const mainDiag = mainMatch 
            ? { code: mainMatch[1].trim(), text: mainMatch[2].trim() }
            : { code: '', text: parts[0].trim() };
            
        // Tách bệnh kèm theo (Ghép các mã còn lại)
        let subDiag = null;
        if (parts.length > 1) {
            const subRaw = parts.slice(1).map(p => p.trim()).join('; ');
            const subMatch = subRaw.match(/^([A-Z]\d{2}(?:\.\d+)?)[^a-zA-Z0-9]*(.*)$/i);
            subDiag = subMatch
                ? { code: subMatch[1].trim(), text: subMatch[2].trim() }
                : { code: '', text: subRaw };
        }

        return { mainDiag, subDiag };
    }

    // ==========================================
    // BUILD DATA CHO BỆNH ÁN
    // ==========================================
    function _buildBenhAnData(raw) {
        // Chỉ lấy chẩn đoán khi vào khoa (Chẩn đoán ban đầu lúc tiếp nhận)
        const diagSource = (raw.chanDoanBanDau || '') + (raw.chanDoanKemTheo ? '; ' + raw.chanDoanKemTheo : '');

        const parsed = parseICD(diagSource) || {};

        return {
            mainDiag: parsed.mainDiag,
            subDiag: parsed.subDiag,
            phanBietDiag: null,
            truocPTDiag: parsed.mainDiag,
            sauPTDiag: parsed.mainDiag,
            ghiChu: raw.tienSuBanThan ? 'Tiền sử: ' + raw.tienSuBanThan : ''
        };
    }

    // ==========================================
    // PREVIEW DIALOG
    // ==========================================
    function _showPreviewDialog(formData, type, _contextToken) {
        return new Promise((resolve) => {
            const isHC = type === 'hoichan';
            const isCV = type === 'chuyenvien';
            const isXT = type === 'xutri';

            let labels = {};
            if (isHC) {
                labels = {
                    'trichBienBan': 'Trích biên bản hội chẩn',
                    'tomTatTieuSuBenh': 'Tóm tắt tiểu sử bệnh',
                    'tomTatTTVaoVien': 'Tóm tắt TT vào viện',
                    'tomTatTTHienTai': 'Tóm tắt TT hiện tại',
                    'quaTrinhDieuTriCS': 'Quá trình điều trị',
                    'ketLuanChanDoan': 'Chẩn đoán, nguyên nhân, tiên lượng',
                    'huongDieuTri': 'Hướng điều trị',
                    'ketLuan': 'Kết luận'
                };
            } else if (isCV) {
                labels = {
                    'dauHieuLamSang': 'Dấu hiệu lâm sàng',
                    'quaTrinhBenhLy': 'Quá trình bệnh lý',
                    'ketQuaCLS': 'Kết quả CLS',
                    'tinhTrangNguoiBenh': 'Tình trạng người bệnh',
                    'thuoc': 'Thuốc',
                    'huongDieuTri': 'Hướng điều trị'
                };
            } else if (isXT) {
                labels = {
                    'mainDiagCode': 'Mã Bệnh chính (ICD)',
                    'mainDiagText': 'Tên Bệnh chính',
                    'subDiagCode': 'Mã Bệnh kèm theo (ICD)',
                    'subDiagText': 'Tên Bệnh kèm theo',
                    'ngayRaKhoa': 'Ra khoa lúc'
                };
            }

            const overlay = document.createElement('div');
            overlay.className = 'clinical-preview-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'clinical-preview-dialog';

            let title = '📋 Xem trước — Hội chẩn';
            if (isCV) title = '🚑 Xem trước — Chuyển viện';
            else if (isXT) title = '🚪 Xem trước — Điền Xử trí';
            
            const store = window.VNPTStore?.getState() || {};
            const patientName = store.selectedPatientName || 'Không rõ';

            let html = `
                <button id="cfill-close-x" style="position:absolute; top:15px; right:15px; background:none; border:none; color:#333; font-size:24px; cursor:pointer; line-height:1; transition:color 0.15s ease;">&times;</button>
                <h3>${title}</h3>
                <div style="background:#f9f9f9; border:1px solid #a6c9e2; padding:10px; margin-bottom:16px; border-radius:0px; font-size:12px;">
                    <div style="color:#004f9e; font-weight:bold;">✓ ĐÃ XÁC MINH NGỮ CẢNH</div>
                    <div style="margin-top:4px; color:#333;">Dữ liệu form được trích xuất chính xác từ bệnh nhân: <b style="color:#004f9e">${patientName}</b></div>
                </div>`;
 
            for (const [key, label] of Object.entries(labels)) {
                let val = '';
                if (isXT) {
                    if (key === 'mainDiagCode') val = formData.mainDiag?.code || '';
                    else if (key === 'mainDiagText') val = formData.mainDiag?.text || '';
                    else if (key === 'subDiagCode') val = formData.subDiag?.code || '';
                    else if (key === 'subDiagText') val = formData.subDiag?.text || '';
                    else if (key === 'ngayRaKhoa') val = formData.ngayRaKhoa || '';
                } else {
                    val = formData[key] || '';
                }
                html += `<div class="field-row">
                    <div class="field-label">${label}</div>
                    <textarea id="cf-input-${key}" class="field-value-input" data-key="${key}">${val.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</textarea>
                </div>`;
            }

            html += `<div class="clinical-preview-actions">
                <button class="clinical-btn-cancel" id="cfill-cancel">Hủy</button>
                <button class="clinical-btn-fill" id="cfill-confirm">✨ Điền vào form</button>
            </div>`;

            dialog.innerHTML = html;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            // Auto-resize textareas based on content
            const textareas = overlay.querySelectorAll('.field-value-input');
            textareas.forEach(ta => {
                // Initial resize
                ta.style.height = (ta.scrollHeight > 40 ? ta.scrollHeight + 2 : 40) + 'px';
                
                ta.addEventListener('input', function() {
                    this.style.height = 'auto';
                    this.style.height = (this.scrollHeight) + 'px';
                    
                    // Sync logic
                    const key = this.getAttribute('data-key');
                    const val = this.value;
                    
                    if (isHC) {
                        if (key === 'ketLuanChanDoan') {
                            const target = overlay.querySelector('#cf-input-ketLuan');
                            if (target) { target.value = val; target.style.height = 'auto'; target.style.height = target.scrollHeight + 'px'; }
                        } else if (key === 'ketLuan') {
                            const target = overlay.querySelector('#cf-input-ketLuanChanDoan');
                            if (target) { target.value = val; target.style.height = 'auto'; target.style.height = target.scrollHeight + 'px'; }
                        } else if (key === 'tomTatTTVaoVien') {
                            const targetHT = overlay.querySelector('#cf-input-tomTatTTHienTai');
                            if (targetHT) { 
                                targetHT.value = val; 
                                targetHT.style.height = 'auto'; targetHT.style.height = targetHT.scrollHeight + 'px'; 
                            }
                            const ts = overlay.querySelector('#cf-input-tomTatTieuSuBenh')?.value || '';
                            const targetQT = overlay.querySelector('#cf-input-quaTrinhDieuTriCS');
                            if (targetQT) {
                                targetQT.value = [ts, val].filter(Boolean).join('\n');
                                targetQT.style.height = 'auto'; targetQT.style.height = targetQT.scrollHeight + 'px';
                            }
                        } else if (key === 'tomTatTieuSuBenh' || key === 'tomTatTTHienTai') {
                            const ts = overlay.querySelector('#cf-input-tomTatTieuSuBenh')?.value || '';
                            const ht = overlay.querySelector('#cf-input-tomTatTTHienTai')?.value || '';
                            const target = overlay.querySelector('#cf-input-quaTrinhDieuTriCS');
                            if (target) {
                                target.value = [ts, ht].filter(Boolean).join('\n');
                                target.style.height = 'auto'; target.style.height = target.scrollHeight + 'px';
                            }
                        }
                    }
                });
            });

            // Ensure dialog has position relative for the absolute close button
            dialog.style.position = 'relative';

            overlay.querySelector('#cfill-cancel').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[ClinicalFill] Cancel clicked, dismissing overlay');
                overlay.remove();
                resolve(false);
            });
            overlay.querySelector('#cfill-close-x').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[ClinicalFill] Close X clicked, dismissing overlay');
                overlay.remove();
                resolve(false);
            });
            overlay.querySelector('#cfill-close-x').addEventListener('mouseover', function() { this.style.color = 'var(--al-error)'; });
            overlay.querySelector('#cfill-close-x').addEventListener('mouseout', function() { this.style.color = 'var(--al-outline)'; });
            
            overlay.querySelector('#cfill-confirm').addEventListener('click', (e) => {
                e.stopPropagation();
                e.preventDefault();
                console.log('[ClinicalFill] Confirm button clicked');
                try {
                    if (!formData) {
                        console.warn('[ClinicalFill] formData was undefined, initializing empty object');
                        formData = {};
                    }
                    // UPDATE formData with modified values
                    textareas.forEach(ta => {
                        const key = ta.getAttribute('data-key');
                        if (isXT) {
                            if (key === 'mainDiagCode') {
                                formData.mainDiag = formData.mainDiag || {};
                                formData.mainDiag.code = (ta.value || '').trim();
                            } else if (key === 'mainDiagText') {
                                formData.mainDiag = formData.mainDiag || {};
                                formData.mainDiag.text = (ta.value || '').trim();
                            } else if (key === 'subDiagCode') {
                                formData.subDiag = formData.subDiag || {};
                                formData.subDiag.code = (ta.value || '').trim();
                            } else if (key === 'subDiagText') {
                                formData.subDiag = formData.subDiag || {};
                                formData.subDiag.text = (ta.value || '').trim();
                            } else if (key === 'ngayRaKhoa') {
                                formData.ngayRaKhoa = (ta.value || '').trim();
                            }
                        } else {
                            formData[key] = ta.value;
                        }
                    });
                    console.log('[ClinicalFill] Form preview confirmed. Selected data:', JSON.stringify(formData));
                    overlay.remove();
                    resolve(true);
                } catch (err) {
                    console.error('[ClinicalFill] Error confirming preview:', err);
                    overlay.remove();
                    resolve(false);
                }
            });
            // Double-click outside to close (prevent accidental dismiss)
            let _overlayClickCount = 0;
            let _overlayClickTimer = null;
            overlay.addEventListener('click', (e) => {
                if (e.target !== overlay) return;
                _overlayClickCount++;
                if (_overlayClickCount >= 2) {
                    clearTimeout(_overlayClickTimer);
                    _overlayClickCount = 0;
                    console.log('[ClinicalFill] Double click outside dialog, dismissing overlay');
                    overlay.remove();
                    resolve(false);
                } else {
                    clearTimeout(_overlayClickTimer);
                    _overlayClickTimer = setTimeout(() => { _overlayClickCount = 0; }, 500);
                }
            });
        });
    }

    // ==========================================
    // MAIN FILL FLOW
    // ==========================================
    async function doFill(iframe, type, contextToken = null) {
        const target = iframe || currentFormIframe;
        if (!target) throw new Error('Không tìm thấy form!');

        // Lấy patient ID: ưu tiên VNPTStore
        // Nếu null → gửi null cho api-bridge, api-bridge sẽ tự đọc selrow từ grid
        const pid = window.VNPTStore?.get('selectedPatientId') || null;

        if (window.VNPTPatientContextGuard && contextToken) {
            await window.VNPTPatientContextGuard.assertValidOrThrow(contextToken, { stage: 'clinical_start' });
        }

        window.VNPTRealtime?.showToast('⏳ Đang trích xuất dữ liệu lâm sàng...', 'info');

        const raw = await fetchClinicalData(pid, contextToken);

        if (window.VNPTPatientContextGuard && contextToken) {
            await window.VNPTPatientContextGuard.assertValidOrThrow(contextToken, { stage: 'clinical_after_fetch' });
        }

        // Guard: bridge timeout hoặc lỗi kết nối
        if (raw.timeout || raw.success === false) {
            window.VNPTRealtime?.showToast('❌ Không thể trích xuất dữ liệu lâm sàng. Vui lòng thử lại.', 'error');
            return;
        }

        const isHC = type === 'hoichan';
        const isCV = type === 'chuyenvien';
        const isXT = type === 'xutri';
        const isNBN = type === 'nhapbenhnhan';

        let formData;
        if (isHC) {
            formData = buildHoiChanData(raw);
        } else if (isCV) {
            formData = buildChuyenVienData(raw);
        } else if (isXT || isNBN) {
            // Nhập bệnh nhân dùng chung buildXuTriData để lấy mainDiag + subDiag
            formData = buildXuTriData(raw);
        }

        // Hiện bảng xem trước cho Hội chẩn và Chuyển viện
        // Điền trực tiếp cho Xử trí và Nhập bệnh nhân
        if (isHC || isCV) {
            const confirmed = await _showPreviewDialog(formData, type, contextToken);
            if (!confirmed) {
                window.VNPTRealtime?.showToast('❌ Đã hủy điền form', 'info');
                return;
            }
        }

        window.VNPTRealtime?.showToast('⏳ Đang điền form...', 'info');

        // Inject helper
        let helperFile = 'content/scanner/chuyenvien-iframe-helper.js';
        let scriptId = 'vnpt-chuyenvien-helper';
        let messageType = 'CHUYENVIEN_FILL_FORM';
        let responseType = 'CHUYENVIEN_FILL_RESULT';
        let mapping = CHUYENVIEN_MAPPING;

        if (isHC) {
            helperFile = 'content/scanner/hoichan-iframe-helper.js';
            scriptId = 'vnpt-hoichan-helper';
            messageType = 'HOICHAN_FILL_FORM';
            responseType = 'HOICHAN_FILL_RESULT';
            mapping = HOICHAN_MAPPING;
        } else if (isXT) {
            helperFile = 'content/scanner/discharge-iframe-helper.js';
            scriptId = 'vnpt-xutri-helper';
            messageType = 'XUTRI_FILL_FORM';
            responseType = 'XUTRI_FILL_RESULT';
            mapping = {};
        } else if (isNBN) {
            helperFile = 'content/scanner/nhapbenhnhan-iframe-helper.js';
            scriptId = 'vnpt-nhapbenhnhan-helper';
            messageType = 'NHAPBENHNHAN_FILL_FORM';
            responseType = 'NHAPBENHNHAN_FILL_RESULT';
            mapping = {};
        }

        await injectHelper(target, 'content/shared/self-healing.js', 'vnpt-self-healing-helper');
        await injectHelper(target, helperFile, scriptId);

        if (window.VNPTPatientContextGuard && contextToken) {
            await window.VNPTPatientContextGuard.assertValidOrThrow(contextToken, { stage: 'clinical_before_fill' });
        }

        await sendCmd(target, messageType, { 
            mapping, 
            clinicalData: formData,
            contextToken: contextToken,
            expectedPatientName: window.VNPTStore?.get('selectedPatientName')
        }, responseType);

        const fillLabel = isHC ? 'Hội chẩn' : (isCV ? 'Chuyển viện' : (isNBN ? 'CĐ Vào khoa' : 'Xử trí'));
        const ptName = window.VNPTStore?.get('selectedPatientName') || '';
        window.VNPTRealtime?.showToast(`✅ Đã điền xong phiếu ${fillLabel} cho bệnh nhân: ${ptName}`, 'success');
    }

    // ==========================================
    // INJECT & COMMUNICATE (pattern từ emergency.js)
    // ==========================================
    async function injectHelper(iframe, filePath, scriptId) {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('Không truy cập được iframe');

        const old = doc.getElementById(scriptId);
        if (old) old.remove();

        return new Promise((resolve, reject) => {
            const _chrome = (typeof window !== 'undefined' && window.chrome) ? window.chrome : null;
            if (!_chrome || !_chrome.runtime) return reject(new Error('Chrome unavailable'));

            const loadScript = (src, id) => new Promise((res, rej) => {
                const existing = doc.getElementById(id);
                if (existing) existing.remove();
                
                const script = doc.createElement('script');
                script.id = id;
                script.src = _chrome.runtime.getURL(src);
                script.onload = res;
                script.onerror = rej;
                (doc.head || doc.documentElement).appendChild(script);
            });

            loadScript('content/shared/typing-effect.js', 'vnpt-typing-effect-lib')
                .then(() => loadScript(filePath, scriptId))
                .then(resolve)
                .catch(() => reject(new Error('Inject failed')));
        });
    }

    async function sendCmd(iframe, cmd, payload, expectedResponse, timeout = 10000) {
        return new Promise((resolve, reject) => {
            const targetOrigin = getAllowedOrigin();
            const targetWin = iframe.contentWindow;

            const timer = setTimeout(() => {
                window.removeEventListener('message', handleResponse);
                reject(new Error('Timeout: ' + cmd));
            }, timeout);

            function handleResponse(e) {
                if (!targetWin || e.source !== targetWin) return;
                if (e.origin !== targetOrigin && e.origin !== window.location.origin) return;
                if (e.data && e.data.type === expectedResponse) {
                    window.removeEventListener('message', handleResponse);
                    clearTimeout(timer);
                    if (e.data.success) {
                        resolve(e.data);
                    } else {
                        reject(new Error(e.data.error || 'Lỗi'));
                    }
                }
            }

            window.addEventListener('message', handleResponse);

            if (targetWin) {
                targetWin.postMessage({ type: cmd, ...payload }, targetOrigin);
            } else {
                clearTimeout(timer);
                window.removeEventListener('message', handleResponse);
                reject(new Error('Iframe unavailable'));
            }
        });
    }

    return { init };
})();

window.VNPTClinicalFill = VNPTClinicalFill;
