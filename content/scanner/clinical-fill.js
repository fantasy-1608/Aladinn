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
    let _currentFormType = ''; // 'hoichan' | 'chuyenvien'
    /** @type {string | null} */
    let lastPatientId = null;

    // ==========================================
    // FIELD MAPPINGS (từ autofill.js)
    // ==========================================
    const HOICHAN_MAPPING = {
        'tomTatTieuSuBenh': 'txtTOMTAT_TIEUSUBENH',
        'tomTatTTVaoVien': 'txtTOMTAT_TT_VAOVIEN',
        'tomTatTTHienTai': 'txtTOMTAT_TT_HIENTAI',
        'quaTrinhDieuTriCS': 'txtQUATRINH_DIEUTRI_CS',
        'ketLuanChanDoan': 'txtKETLUAN_CHANDOAN',
        'huongDieuTri': 'txtHUONG_DIEUTRI',
        'trichBienBan': 'txtTRICH_BIENBAN|txtTRICHBIENBAN|txtTRICH_BB',
        'ketLuan': 'txtKETLUAN|txtKET_LUAN'
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
        const observer = new MutationObserver(() => {
            if (!window.VNPTStore) return;
            checkForClinicalForm();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });

        // Bổ sung polling nhẹ để bypass giới hạn MutationObserver xuyên iframe
        setInterval(checkForClinicalForm, 1500);
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
        let found = false;

        // Hàm scan đệ quy để tìm iframe lồng nhau (VD: jBox modal bên trong iframe chính)
        function scanIframes(doc) {
            if (!doc) return;
            const iframes = doc.querySelectorAll('iframe');
            for (const iframe of Array.from(iframes)) {
                if (!(iframe instanceof HTMLIFrameElement)) continue;
                if (iframe.offsetWidth === 0 && iframe.offsetHeight === 0) continue;

                let isHoiChan = false;
                let isChuyenVien = false;

                // Phương pháp 0: Detect qua iframe ID cụ thể (chính xác nhất)
                if (iframe.id === 'dlgXuTriifmView') {
                    isChuyenVien = true;
                }

                // Phương pháp 1: Detect qua iframe src URL pattern
                if (!isChuyenVien) {
                    const iframeSrc = (iframe.src || '').toLowerCase();
                    if (iframeSrc.includes('bienbanhoi') || iframeSrc.includes('hoichuan') || iframeSrc.includes('hoichan') || iframeSrc.includes('ntu02d008')) {
                        isHoiChan = true;
                    } else if (iframeSrc.includes('chuyenvien') || iframeSrc.includes('ngt02k009')) {
                        isChuyenVien = true;
                    }
                }

                // Phương pháp 2: Detect qua field IDs trong iframe (nếu accessible)
                // Chỉ dùng khi chưa xác định được từ URL hay ID
                let innerDoc = null;
                try {
                    innerDoc = iframe.contentDocument;
                    if (innerDoc && !isHoiChan && !isChuyenVien) {
                        isHoiChan = !!(
                            innerDoc.getElementById('txtTOMTAT_TIEUSUBENH') ||
                            innerDoc.getElementById('txtKETLUAN_CHANDOAN') ||
                            innerDoc.getElementById('txtTOMTAT_TT_VAOVIEN')
                        );

                        // Chỉ dùng field đặc trưng riêng của form chuyển viện
                        // KHOONG dùng txtQUATRINHBENHLY vì nó cũng có trong form Hỏi bệnh
                        isChuyenVien = !isHoiChan && !!(
                            innerDoc.getElementById('txtDAUHIEULAMSANG') ||
                            innerDoc.getElementById('txtDAU_HIEU_LAM_SANG') ||
                            innerDoc.getElementById('txtTINHTRANGNGUOIBENH') ||
                            innerDoc.getElementById('txtTINHTRANG_CHUYENTUYEN')
                        );
                    }
                } catch (_e) { /* cross-origin, skip */ }

                if (isHoiChan || isChuyenVien) {
                    found = true;
                    const type = isHoiChan ? 'hoichan' : 'chuyenvien';
                    currentFormIframe = iframe;
                    _currentFormType = type;

                    if (!fillButton || !document.body.contains(fillButton) || fillButton.dataset.formType !== type) {
                        _currentFormType = type;
                        showFillButton(iframe, type);
                    }
                    return true; // Found
                }

                // Scan đệ quy vào iframe con nếu có quyền truy cập
                if (innerDoc) {
                    if (scanIframes(innerDoc)) return true;
                }
            }
            return false;
        }

        scanIframes(document);

        if (!found) {
            hideFillButton();
            currentFormIframe = null;
            _currentFormType = '';
        }
    }

    // ==========================================
    // FAB BUTTON (Desert Mystic gold theme)
    // ==========================================
    function showFillButton(iframe, type) {
        hideFillButton();

        const container = document.createElement('div');
        container.id = 'vnpt-clinical-fill-btn';
        container.dataset.formType = type;

        const isHC = type === 'hoichan';
        const icon = isHC ? '📋' : '🚑';
        const label = isHC ? 'Điền Hội chẩn' : 'Điền Chuyển viện';
        const gradientFrom = isHC ? '#d4a853' : '#ef4444';
        const gradientTo = isHC ? '#f59e0b' : '#b91c1c';
        const pulseColor = isHC ? 'rgba(212,168,83,0.5)' : 'rgba(239,68,68,0.5)';

        if (!document.getElementById('vnpt-clinical-fill-style')) {
            const style = document.createElement('style');
            style.id = 'vnpt-clinical-fill-style';
            style.textContent = `
                @keyframes fab-pulse-clinical {
                    0%,100% { box-shadow: 0 2px 12px var(--cf-pulse, rgba(212,168,83,0.5)); }
                    50% { box-shadow: 0 4px 24px var(--cf-pulse, rgba(212,168,83,0.8)); }
                }
                @keyframes fab-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes fab-bounce { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
                @keyframes fab-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
                #vnpt-clinical-fab {
                    position: fixed !important; top: 180px !important; right: 15px !important;
                    z-index: 2147483647 !important;
                    width: 48px !important; height: 48px !important; border-radius: 50% !important;
                    display: flex !important; align-items: center !important; justify-content: center !important;
                    cursor: pointer !important; user-select: none !important;
                    font-size: 22px !important;
                    border: 2px solid rgba(255,255,255,0.4) !important;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                    animation: fab-pulse-clinical 2.5s ease-in-out infinite !important;
                }
                #vnpt-clinical-fab:hover { transform: scale(1.12) !important; }
                #vnpt-clinical-fab:active { transform: scale(0.95) !important; }
                #vnpt-clinical-fab.processing { animation: fab-spin 1s linear infinite !important; opacity: 0.85 !important; pointer-events: none !important; }
                #vnpt-clinical-fab.done { background: linear-gradient(135deg, #4CAF50, #2E7D32) !important; animation: fab-bounce 0.5s ease !important; }
                #vnpt-clinical-fab.error { background: linear-gradient(135deg, #ef4444, #dc2626) !important; animation: fab-shake 0.4s ease !important; }
                #vnpt-clinical-fab::after {
                    content: attr(data-tooltip); position: absolute;
                    right: 56px; top: 50%; transform: translateY(-50%);
                    background: rgba(15,23,42,0.95); color: #f1f5f9;
                    padding: 6px 12px; border-radius: 8px;
                    font-size: 12px; font-weight: 500; white-space: nowrap;
                    pointer-events: none; opacity: 0; transition: opacity 0.2s;
                    font-family: 'Inter', system-ui, sans-serif;
                    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                }
                #vnpt-clinical-fab:hover::after { opacity: 1; }
                /* Preview dialog */
                .clinical-preview-overlay {
                    position: fixed; inset: 0; z-index: 2147483646;
                    background: rgba(0,0,0,0.5); display: flex;
                    align-items: center; justify-content: center;
                }
                .clinical-preview-dialog {
                    background: #1a1a2e; color: #e0d5c1; border-radius: 16px;
                    padding: 24px; max-width: 700px; width: 90%;
                    max-height: 80vh; overflow-y: auto;
                    border: 1px solid rgba(212,168,83,0.3);
                    box-shadow: 0 20px 60px rgba(0,0,0,0.5);
                    font-family: 'Inter', system-ui, sans-serif;
                }
                .clinical-preview-dialog h3 {
                    margin: 0 0 16px; color: #d4a853; font-size: 18px;
                }
                .clinical-preview-dialog .field-row {
                    margin-bottom: 12px; padding: 8px 12px;
                    background: rgba(255,255,255,0.05); border-radius: 8px;
                    border-left: 3px solid #d4a853;
                }
                .clinical-preview-dialog .field-label {
                    font-size: 11px; color: #a08c6a; text-transform: uppercase;
                    letter-spacing: 0.5px; margin-bottom: 4px;
                }
                .clinical-preview-dialog .field-value {
                    font-size: 13px; color: #e0d5c1; white-space: pre-wrap;
                    max-height: 80px; overflow-y: auto;
                }
                .clinical-preview-actions {
                    display: flex; gap: 12px; margin-top: 20px; justify-content: flex-end;
                }
                .clinical-preview-actions button {
                    padding: 10px 20px; border: none; border-radius: 10px;
                    cursor: pointer; font-size: 14px; font-weight: 600;
                    transition: all 0.2s; font-family: 'Inter', system-ui, sans-serif;
                }
                .clinical-btn-cancel {
                    background: rgba(255,255,255,0.1); color: #a08c6a;
                }
                .clinical-btn-cancel:hover { background: rgba(255,255,255,0.15); }
                .clinical-btn-fill {
                    background: linear-gradient(135deg, #d4a853, #f59e0b);
                    color: #1a1a2e;
                }
                .clinical-btn-fill:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(212,168,83,0.4); }
            `;
            document.head.appendChild(style);
        }

        const fab = document.createElement('div');
        fab.id = 'vnpt-clinical-fab';
        fab.innerHTML = icon;
        fab.setAttribute('data-tooltip', `${icon} ${label}`);
        fab.style.background = `linear-gradient(135deg, ${gradientFrom}, ${gradientTo})`;
        fab.style.setProperty('--cf-pulse', pulseColor);

        fab.addEventListener('click', async () => {
            const origIcon = fab.innerHTML;
            const origTooltip = fab.getAttribute('data-tooltip');
            fab.className = 'processing';
            fab.innerHTML = '⏳';

            try {
                await doFill(iframe, type);
                fab.className = 'done';
                fab.innerHTML = '✅';
                fab.setAttribute('data-tooltip', '✅ Đã điền xong!');
                setTimeout(() => resetFab(fab, origIcon, origTooltip), 3000);
            } catch (_e) {
                fab.className = 'error';
                fab.innerHTML = '❌';
                fab.setAttribute('data-tooltip', '❌ Lỗi! Click thử lại');
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
    async function fetchClinicalData(pid) {
        if (!window.VNPTMessaging) throw new Error('Messaging bridge chưa sẵn sàng');
        const res = await window.VNPTMessaging.sendRequest('REQ_FETCH_CLINICAL_SUMMARY', { rowId: pid }, 12000);
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
        // fallback khám toàn thân + bộ phận
        const ttHienTai = raw.dienBienBenh
            ? raw.dienBienBenh
            : join(raw.khamToanThan, raw.khamBoPhan);

        // Kết luận chẩn đoán: ưu tiên nguyên chẩn đoán từ tờ điều trị mới nhất (chính + kèm theo)
        // Fallback: chẩn đoán chính + kèm theo từ HSBA
        let chanDoanFull = '';
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

        return {
            'dauHieuLamSang': join(raw.khamToanThan, raw.khamBoPhan, vitalStr ? 'Sinh hiệu: ' + vitalStr : ''),
            'quaTrinhBenhLy': raw.quaTrinhBenhLy || '',
            'ketQuaCLS': raw.tomTatCLS || '',
            'tinhTrangNguoiBenh': raw.dienBienBenh || join(raw.khamToanThan, raw.khamBoPhan),
            'thuoc': 'Toa thuốc Bệnh viện',
            'huongDieuTri': raw.huongXuLy || 'Chuyển tuyến trên'
        };
    }

    // ==========================================
    // PREVIEW DIALOG
    // ==========================================
    function showPreviewDialog(formData, type) {
        return new Promise((resolve) => {
            const isHC = type === 'hoichan';
            const labels = isHC ? {
                'tomTatTieuSuBenh': 'Tóm tắt tiểu sử bệnh',
                'tomTatTTVaoVien': 'Tóm tắt TT vào viện',
                'tomTatTTHienTai': 'Tóm tắt TT hiện tại',
                'quaTrinhDieuTriCS': 'Quá trình điều trị',
                'ketLuanChanDoan': 'Chẩn đoán, nguyên nhân, tiên lượng',
                'huongDieuTri': 'Hướng điều trị',
                'trichBienBan': 'Trích biên bản hội chẩn',
                'ketLuan': 'Kết luận'
            } : {
                'dauHieuLamSang': 'Dấu hiệu lâm sàng',
                'quaTrinhBenhLy': 'Quá trình bệnh lý',
                'ketQuaCLS': 'Kết quả CLS',
                'tinhTrangNguoiBenh': 'Tình trạng người bệnh',
                'thuoc': 'Thuốc',
                'huongDieuTri': 'Hướng điều trị'
            };

            const overlay = document.createElement('div');
            overlay.className = 'clinical-preview-overlay';

            const dialog = document.createElement('div');
            dialog.className = 'clinical-preview-dialog';

            const title = isHC ? '📋 Xem trước — Hội chẩn' : '🚑 Xem trước — Chuyển viện';
            let html = `<h3>${title}</h3>`;

            for (const [key, label] of Object.entries(labels)) {
                const val = formData[key] || '<em style="color:#666">Trống</em>';
                html += `<div class="field-row">
                    <div class="field-label">${label}</div>
                    <div class="field-value">${val.replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</div>
                </div>`;
            }

            html += `<div class="clinical-preview-actions">
                <button class="clinical-btn-cancel" id="cfill-cancel">Hủy</button>
                <button class="clinical-btn-fill" id="cfill-confirm">✨ Điền vào form</button>
            </div>`;

            dialog.innerHTML = html;
            overlay.appendChild(dialog);
            document.body.appendChild(overlay);

            overlay.querySelector('#cfill-cancel').addEventListener('click', () => {
                overlay.remove();
                resolve(false);
            });
            overlay.querySelector('#cfill-confirm').addEventListener('click', () => {
                overlay.remove();
                resolve(true);
            });
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) { overlay.remove(); resolve(false); }
            });
        });
    }

    // ==========================================
    // MAIN FILL FLOW
    // ==========================================
    async function doFill(iframe, type) {
        const target = iframe || currentFormIframe;
        if (!target) throw new Error('Không tìm thấy form!');

        // Lấy patient ID: ưu tiên VNPTStore
        // Nếu null → gửi null cho api-bridge, api-bridge sẽ tự đọc selrow từ grid
        const pid = window.VNPTStore?.get('selectedPatientId') || null;

        window.VNPTRealtime?.showToast('⏳ Đang trích xuất dữ liệu lâm sàng...', 'info');

        const raw = await fetchClinicalData(pid);
        const isHC = type === 'hoichan';
        const formData = isHC ? buildHoiChanData(raw) : buildChuyenVienData(raw);

        // Preview
        const confirmed = await showPreviewDialog(formData, type);
        if (!confirmed) {
            window.VNPTRealtime?.showToast('ℹ️ Đã hủy.', 'info');
            return;
        }

        window.VNPTRealtime?.showToast('⏳ Đang điền form...', 'info');

        // Inject helper
        const helperFile = isHC ? 'hoichan-iframe-helper.js' : 'chuyenvien-iframe-helper.js';
        const messageType = isHC ? 'HOICHAN_FILL_FORM' : 'CHUYENVIEN_FILL_FORM';
        const responseType = isHC ? 'HOICHAN_FILL_RESULT' : 'CHUYENVIEN_FILL_RESULT';
        const mapping = isHC ? HOICHAN_MAPPING : CHUYENVIEN_MAPPING;

        await injectHelper(target, helperFile, isHC ? 'vnpt-hoichan-helper' : 'vnpt-chuyenvien-helper');
        await sendCmd(target, messageType, { mapping, clinicalData: formData }, responseType);

        const label = isHC ? 'Hội chẩn' : 'Chuyển viện';
        window.VNPTRealtime?.showToast(`✅ Đã điền xong phiếu ${label}!`, 'success');
    }

    // ==========================================
    // INJECT & COMMUNICATE (pattern từ emergency.js)
    // ==========================================
    async function injectHelper(iframe, fileName, scriptId) {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('Không truy cập được iframe');

        const old = doc.getElementById(scriptId);
        if (old) old.remove();

        return new Promise((resolve, reject) => {
            const script = doc.createElement('script');
            script.id = scriptId;
            if (_chrome && _chrome.runtime) {
                script.src = _chrome.runtime.getURL('content/scanner/' + fileName);
            } else {
                reject(new Error('Chrome runtime unavailable'));
                return;
            }
            script.onload = () => resolve(undefined);
            script.onerror = () => reject(new Error('Inject helper failed'));
            (doc.head || doc.documentElement).appendChild(script);
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
