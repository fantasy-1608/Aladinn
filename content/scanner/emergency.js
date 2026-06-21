/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Emergency (NDPLNBCC-381000 Auto-Fill)
 * 
 * Passive approach:
 * - User tự mở form 39/BV2 - Phiếu nhận định phân loại người bệnh tại khoa cấp cứu
 * - Poll tìm form field trong iframe → hiện icon "Điền phiếu"
 * - Click icon → tự điền tất cả
 * - Icon ẩn khi form đóng hoặc sau khi điền
 * 
 * CHỈ chạy ở TOP FRAME.
 */

const VNPTEmergency = (function () {
    // CHỈ chạy ở top frame — không chạy trong iframe
    if (window !== window.top) {
        return { init: function () { }, doFillForm: function () { } };
    }

    const _chrome = typeof window['chrome'] !== 'undefined' ? window['chrome'] : null;

    let fillButton = null;

    let currentFormIframe = null;

    let cachedVitals = null;
    let lastPatientId = null;

    function getAllowedOrigin() {
        return window.VNPTConfig?.security?.allowedOrigin || window.location.origin;
    }

    function init() {
        const observer = new MutationObserver(() => {
            if (!window.VNPTStore) return;
            checkForEmergencyForm();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        checkForEmergencyForm();

        if (window.VNPTStore) {
            window.VNPTStore.subscribe('selectedPatientId', (pid) => {
                if (pid) onPatientSelected(pid);
            });
            const currentPid = window.VNPTStore.get('selectedPatientId');
            if (currentPid) onPatientSelected(currentPid);
        } else {
            // Fallback to polling if store not yet ready — auto-cleanup khi store sẵn sàng
            const fallbackTimer = setInterval(async () => {
                if (document.hidden) return;
                if (!window.VNPTStore) return;
                // Store đã sẵn sàng → subscribe + clear timer
                window.VNPTStore.subscribe('selectedPatientId', (pid) => {
                    if (pid) onPatientSelected(pid);
                });
                const pid = window.VNPTStore.get('selectedPatientId');
                if (pid) onPatientSelected(pid);
                clearInterval(fallbackTimer);
            }, 2000);
        }

        console.log('[Emergency] Observer initialized (top frame)');
    }

    async function onPatientSelected(pid) {
        if (!pid || pid === lastPatientId) return;

        console.log('[Emergency] Phát hiện chọn bệnh nhân:', pid);
        lastPatientId = pid;
        cachedVitals = null;

        // Đã hoàn thành bắt API, không cần hiện nút Tìm API nữa
        // showAPICreateButton(pid);
    }

    function checkForEmergencyForm() {
        const iframes = document.querySelectorAll('iframe');
        let found = false;

        for (const iframe of Array.from(iframes)) {
            if (!(iframe instanceof HTMLIFrameElement)) continue;
            if (iframe.offsetWidth === 0 && iframe.offsetHeight === 0) continue;
            try {
                const doc = iframe.contentDocument;
                if (!doc) continue;

                // ── EXCLUSION: Bỏ qua form Dinh dưỡng DD-03 ──
                // DD-03 cũng dùng input[id^="textfield_"] nên dễ bị nhận nhầm
                const iframeSrc = (iframe.src || '').toLowerCase();
                const isNutritionByUrl = iframeSrc.includes('pslvdgddnbnt') || iframeSrc.includes('dinhduong') || iframeSrc.includes('dd03') || iframeSrc.includes('dd-03');
                const isNutritionByFields = doc.getElementById('textfield_1535') && doc.getElementById('textfield_1536');
                if (isNutritionByUrl || isNutritionByFields) continue;

                // ── EXCLUSION: Bỏ qua trang Danh sách phiếu (NTU02D021) ──
                // Trang này chứa dropdown + grid liệt kê nhiều loại phiếu, không phải form thực tế
                if (iframeSrc.includes('ntu02d021')) continue;

                // Form Nhận định cấp cứu
                const cboDanhSach = doc.getElementById('cboDANHSACH');
                const hasEmergencyCbo = cboDanhSach && cboDanhSach.options[cboDanhSach.selectedIndex]?.text?.includes('39/BV2');
                
                const gridRow = doc.querySelector('td[aria-describedby*="grdDanhSach_TEN_FORM"].markedRow, tr.ui-state-highlight td[aria-describedby*="grdDanhSach_TEN_FORM"], td[aria-describedby*="grdDanhSach_TEN_FORM"].ui-state-highlight');
                const hasEmergencyGrid = gridRow && gridRow.textContent.includes('39/BV2');

                let hasEmergencyText = false;
                if (!hasEmergencyCbo && !hasEmergencyGrid && doc.querySelector('input[id^="textfield_"]')) {
                    const textContent = doc.body.textContent || '';
                    // Chỉ match khi có cả hai: text đặc trưng + KHÔNG phải form DD-03
                    if (
                        (textContent.includes('Phiếu nhận định phân loại') || 
                         textContent.includes('NDPLNBCC-')) &&
                        !textContent.includes('dinh dưỡng') &&
                        !textContent.includes('DD-03')
                    ) {
                        hasEmergencyText = true;
                    }
                }

                if (hasEmergencyCbo || hasEmergencyGrid || hasEmergencyText) {
                    found = true;
                    currentFormIframe = iframe;

                    if (!fillButton || !document.body.contains(fillButton)) {
                        showFillButton(iframe);
                    }
                    break;
                }
            } catch (_e) {}
        }

        if (!found) {
            hideFillButton();
            currentFormIframe = null;
        }
    }

    function showFillButton(iframe) {
        if (fillButton) hideFillButton();

        const container = document.createElement('div');
        container.style.position = 'fixed';
        container.style.zIndex = '999999';
        
        const rect = iframe.getBoundingClientRect();
        // Đẩy nút lùi vào trong để không bị che lấp bởi Nút Đóng (X) của Form
        container.style.top = (rect.top + 35) + 'px';
        container.style.right = (window.innerWidth - rect.right + 45) + 'px';

        fillButton = container;
        fillButton.id = 'vnpt-emergency-fill-btn';

        if (!document.getElementById('vnpt-emergency-style')) {
            const style = document.createElement('style');
            style.id = 'vnpt-emergency-style';
            style.textContent = `
            @keyframes fab-pulse-emergency {
                0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.5); }
                70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
            #vnpt-emergency-fab {
                width: 44px; height: 44px; border-radius: 50%;
                background: linear-gradient(135deg, #ef4444, #b91c1c);
                color: white; font-size: 20px; font-weight: bold;
                display: flex; align-items: center; justify-content: center;
                cursor: pointer; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                animation: fab-pulse-emergency 2.5s ease-in-out infinite !important;
            }
            #vnpt-emergency-fab:hover { transform: scale(1.12) !important; }
            #vnpt-emergency-fab:active { transform: scale(0.95) !important; }
            #vnpt-emergency-fab.processing { animation: fab-spin 1s linear infinite !important; opacity: 0.85 !important; pointer-events: none !important; }
            #vnpt-emergency-fab.done { background: linear-gradient(135deg, #4CAF50, #2E7D32) !important; animation: fab-bounce 0.5s ease !important; }
            #vnpt-emergency-fab.error { background: linear-gradient(135deg, #ef4444, #dc2626) !important; animation: fab-shake 0.4s ease !important; }
            #vnpt-emergency-fab::after {
                content: attr(data-tooltip); position: absolute;
                bottom: -30px; left: 50%; transform: translateX(-50%);
                background: rgba(0,0,0,0.8); color: #fff;
                padding: 4px 8px; border-radius: 4px; font-size: 12px;
                white-space: nowrap; opacity: 0; pointer-events: none;
                transition: opacity 0.2s; font-family: 'Inter', sans-serif;
            }
            #vnpt-emergency-fab:hover::after { opacity: 1; }
            `;
            document.head.appendChild(style);
        }

        const fab = document.createElement('div');
        fab.id = 'vnpt-emergency-fab';
        fab.innerHTML = '🚑';
        fab.setAttribute('data-tooltip', '🚑 Điền phiếu cấp cứu');

        fab.addEventListener('click', async () => {
            const originalIcon = fab.innerHTML;
            fab.className = 'processing';
            fab.innerHTML = '⏳';

            try {
                let token = null;
                if (window.VNPTPatientContextGuard) {
                    token = await window.VNPTPatientContextGuard.capture(iframe, 'emergency');
                }

                await doFillForm(iframe, token);
                fab.className = 'done';
                fab.innerHTML = '✅';
                fab.setAttribute('data-tooltip', '✅ Đã điền xong!');
                
                setTimeout(() => {
                    if (fillButton) {
                        fab.className = '';
                        fab.innerHTML = originalIcon;
                        fab.setAttribute('data-tooltip', '🚑 Điền phiếu cấp cứu');
                    }
                }, 2500);
            } catch (_e) {
                fab.className = 'error';
                fab.innerHTML = '❌';
                setTimeout(() => {
                    if (fillButton) {
                        fab.className = '';
                        fab.innerHTML = originalIcon;
                        fab.setAttribute('data-tooltip', '🚑 Điền phiếu cấp cứu');
                    }
                }, 2500);
            }
        });

        container.appendChild(fab);
        document.body.appendChild(container);
    }

    function hideFillButton() {
        const el = document.getElementById('vnpt-emergency-fill-btn');
        if (el) el.remove();
        fillButton = null;
    }



    async function doFillForm(targetIframe, contextToken = null) {
        const target = targetIframe || currentFormIframe;
        if (!target) {
            window.VNPTRealtime?.showToast('⚠️ Không tìm thấy form Cấp cứu!', 'warning');
            return;
        }

        try {
            if (!window.VNPTStore) {
                window.VNPTRealtime?.showToast('⚠️ Store chưa sẵn sàng!', 'warning');
                return;
            }

            const pid = window.VNPTStore.get('selectedPatientId');
            if (!pid) {
                window.VNPTRealtime?.showToast('⚠️ Chưa chọn bệnh nhân!', 'warning');
                return;
            }

            if (window.VNPTPatientContextGuard && contextToken) {
                await window.VNPTPatientContextGuard.assertValidOrThrow(contextToken, { stage: 'emergency_start' });
            }

            let vitals = cachedVitals;
            
            // Try fallback to VNPTStore
            if (!vitals || !vitals.pulse || !vitals.temperature || !vitals.bloodPressure) {
                const storeVitals = window.VNPTStore.get('vitalsDataMap')[pid];
                if (storeVitals) vitals = storeVitals;
            }

            // Fetch if still missing
            if (!vitals || !vitals.pulse || !vitals.temperature || !vitals.bloodPressure) {
                window.VNPTRealtime?.TaskHub?.add('sync_vitals', 'Đồng bộ Dữ liệu', 'Đang lấy sinh hiệu...');
                const fresh = await fetchVitalsForPatient(pid, contextToken);
                if (fresh) {
                    vitals = fresh;
                    cachedVitals = vitals;
                }
            }
            window.VNPTRealtime?.TaskHub?.remove('sync_vitals');

            if (window.VNPTPatientContextGuard && contextToken) {
                await window.VNPTPatientContextGuard.assertValidOrThrow(contextToken, { stage: 'emergency_after_vitals' });
            }

            const patientData = window.VNPTStore.get('patientDataMap')?.[pid] || {};
            let ngayDenKham = patientData.THOIGIANVAOVIEN || patientData.THOIGIANVAOKHOA || '';

            // Cố gắng đọc từ lblMSG_BOSUNG trên top window nếu đang ở module có hiển thị header (ví dụ Nội Trú)
            if (!ngayDenKham) {
                const lblBosung = document.getElementById('lblMSG_BOSUNG');
                if (lblBosung) {
                    const txt = lblBosung.innerText || '';
                    const parts = txt.split('|');
                    if (parts.length > 1) {
                        const datePart = parts[1].trim();
                        if (datePart.match(/^\d{2}\/\d{2}\/\d{4}/)) {
                            ngayDenKham = datePart;
                        }
                    }
                }
            }

            // Đề xuất 2: API-first (demographics từ Store) → DOM fallback → jqGrid fallback
            if (!ngayDenKham) {
                let storedDemo = null;
                if (window.VNPTPatientContextGuard) {
                    const patientKey = window.VNPTPatientContextGuard.hashIdentity({ rowId: pid });
                    const map = window.VNPTStore?.get('patientDemographicsMap');
                    if (map && map[patientKey]) {
                        storedDemo = map[patientKey].data;
                    }
                }
                if (storedDemo && storedDemo.admissionDate) {
                    ngayDenKham = storedDemo.admissionDate;
                }
            }
            if (!ngayDenKham && window.$) {
                try {
                    const rowData = window.$('#grdBenhNhan').jqGrid('getRowData', pid);
                    if (rowData && rowData.THOIGIANVAOVIEN) ngayDenKham = rowData.THOIGIANVAOVIEN;
                    else if (rowData && rowData.THOIGIANVAOKHOA) ngayDenKham = rowData.THOIGIANVAOKHOA;
                } catch(_e) {}
            }

            // Fallback cuối cùng là giờ hiện tại
            if (!ngayDenKham) {
                const now = new Date();
                ngayDenKham = String(now.getDate()).padStart(2, '0') + '/' + 
                              String(now.getMonth() + 1).padStart(2, '0') + '/' + 
                              now.getFullYear() + ' ' + 
                              String(now.getHours()).padStart(2, '0') + ':' + 
                              String(now.getMinutes()).padStart(2, '0') + ':00';
            }

            // Lấy Lý do vào viện - cùng nguồn với Bệnh án (medicalHistoryMap từ API NT.006.HSBA.HIS)
            let lyDoVaoVien = '';
            const historyMap = window.VNPTStore.get('medicalHistoryMap') || {};
            let historyData = null;
            if (window.VNPTPatientContextGuard) {
                const patientKey = window.VNPTPatientContextGuard.hashIdentity({ rowId: pid });
                historyData = historyMap[patientKey];
            } else {
                historyData = historyMap[pid];
            }
            
            if (historyData && historyData.LYDOVAOVIEN) {
                lyDoVaoVien = historyData.LYDOVAOVIEN;
            }
            // Fallback: DOM trên tab Bệnh án đang mở
            if (!lyDoVaoVien) {
                const txtLyDo = document.getElementById('tcBenhAntxtLYDOVAOVIEN');
                if (txtLyDo && txtLyDo.value) {
                    lyDoVaoVien = txtLyDo.value.trim();
                }
            }
            // Fallback cuối: tìm trong tất cả iframe đang mở
            if (!lyDoVaoVien) {
                const allIframes = document.querySelectorAll('iframe');
                for (const iframe of allIframes) {
                    try {
                        const iDoc = iframe.contentDocument;
                        if (!iDoc) continue;
                        const el = iDoc.getElementById('txtLYDOVAOVIEN');
                        if (el && el.value && el.value.trim()) {
                            lyDoVaoVien = el.value.trim();
                            break;
                        }
                    } catch(_) {}
                }
            }

            window.VNPTRealtime?.TaskHub?.add('api_cc', 'Khởi tạo Phiếu', 'Đang tạo phiếu qua API...');

            if (window.VNPTPatientContextGuard && contextToken) {
                const confirmed = await window.VNPTPatientContextGuard.showContextConfirmDialog(contextToken);
                if (!confirmed) {
                    window.VNPTRealtime?.showToast('ℹ️ Đã hủy.', 'info');
                    return;
                }
            }

            await injectHelperIntoIframe(target);

            if (window.VNPTPatientContextGuard && contextToken) {
                await window.VNPTPatientContextGuard.assertValidOrThrow(contextToken, { stage: 'emergency_before_fill' });
            }

            await sendCmd(target, 'EMERGENCY_FILL_FORM_API', {
                pulse: vitals?.pulse || '',
                temperature: vitals?.temperature || '',
                bloodPressure: vitals?.bloodPressure || '',
                respiratoryRate: vitals?.respiratoryRate || vitals?.respiration || '',
                spo2: vitals?.spo2 || '',
                bmi: vitals?.bmi || '',
                ngayDenKham: ngayDenKham,
                lyDoVaoVien: lyDoVaoVien,
                contextToken: contextToken,
                expectedPatientName: window.VNPTStore?.get('selectedPatientName')
            }, 'EMERGENCY_FILL_RESULT');

            const ptName = window.VNPTStore?.get('selectedPatientName') || '';
            window.VNPTRealtime?.TaskHub?.remove('sync_vitals');
            window.VNPTRealtime?.TaskHub?.remove('api_cc');
            window.VNPTRealtime?.showToast(`✅ Đã điền xong phiếu cấp cứu cho bệnh nhân: ${ptName}`, 'success');
            console.log('[Emergency] Fill success'); // Ẩn button sau khi điền
        } catch (e) {
            console.error('[Emergency] Lỗi:', e);
            let msg = e instanceof Error ? e.message : 'Lỗi';
            if (msg === 'FORM_CONTEXT_MISMATCH') {
                msg = 'Thông tin điền vào KHÔNG KHỚP với bệnh nhân hiện tại! Đã chặn.';
            }
            window.VNPTRealtime?.TaskHub?.remove('sync_vitals');
            window.VNPTRealtime?.TaskHub?.remove('api_cc');
            window.VNPTRealtime?.showToast(`❌ ${msg}`, 'error');
        }
    }

    async function fetchVitalsForPatient(pid, contextToken = null) {
        if (!window.VNPTMessaging) return null;
        try {
            const res = await window.VNPTMessaging.sendRequest('REQ_FETCH_VITALS', { rowId: pid, contextToken }, 5000);
            return res.vitals || null;
        } catch (_e) {
            return null;
        }
    }

    async function injectHelperIntoIframe(iframe) {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('Không truy cập được iframe');

        const old = doc.getElementById('vnpt-emergency-helper');
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
                .then(() => loadScript('content/scanner/emergency-iframe-helper.js', 'vnpt-emergency-helper'))
                .then(resolve)
                .catch(() => reject(new Error('Inject failed')));
        });
    }

    async function sendCmd(iframe, cmd, payload, expectedResponse, timeout = 8000) {
        return new Promise((resolve, reject) => {
            const targetOrigin = getAllowedOrigin();
            const targetWin = iframe.contentWindow;

            const timer = setTimeout(() => {
                window.removeEventListener('message', handleResponse);
                reject(new Error(`Timeout: ${cmd}`));
            }, timeout);

            function handleResponse(e) {
                if (!targetWin || e.source !== targetWin) return;
                if (e.origin !== targetOrigin && e.origin !== window.location.origin && !e.origin.endsWith('vncare.vn')) return;

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
                targetWin.postMessage({ type: cmd, ...payload }, window.location.origin);
            } else {
                clearTimeout(timer);
                window.removeEventListener('message', handleResponse);
                reject(new Error('Iframe unavailable'));
            }
        });
    }

    // Listen to Side Panel commands
    window.addEventListener('message', (e) => {
        if (e.data && e.data.type === 'ALADINN_SIDE_PANEL_COMMAND') {
            const payload = e.data.payload;
            if (payload && payload.action === 'TRIGGER_FILL' && payload.context === 'EMERGENCY') {
                const btn = document.getElementById('vnpt-emergency-fab');
                if (btn) btn.click();
            }
        }
    });

    return {
        init,
        doFillForm
    };
})();

window.VNPTEmergency = VNPTEmergency;
