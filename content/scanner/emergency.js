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
            setInterval(async () => {
                if (!window.VNPTStore) return;
                const pid = window.VNPTStore.get('selectedPatientId');
                if (pid) onPatientSelected(pid);
            }, 2000);
        }

        console.log('[Emergency] Observer initialized (top frame)');
    }

    async function onPatientSelected(pid) {
        if (!pid || pid === lastPatientId) return;

        console.log('[Emergency] Phát hiện chọn bệnh nhân:', pid);
        lastPatientId = pid;
        cachedVitals = null;

        try {
            const vitals = await fetchVitalsForPatient(pid);
            if (vitals) {
                cachedVitals = vitals;
                console.log('[Emergency] Vitals trích xuất thành công:', pid, vitals);
                if (window.VNPTStore) {
                    window.VNPTStore.actions.updateVitals(pid, {
                        weight: vitals.weight,
                        height: vitals.height,
                        bmi: vitals.bmi || '',
                        bloodPressure: vitals.bloodPressure || '',
                        pulse: vitals.pulse || '',
                        temperature: vitals.temperature || ''
                    });
                }
            }
        } catch (e) {
            console.warn('[Emergency] Lỗi trích xuất vitals:', e);
        }
    }

    function checkForEmergencyForm() {
        const iframes = document.querySelectorAll('iframe');
        let found = false;

        for (const iframe of Array.from(iframes)) {
            if (!(iframe instanceof HTMLIFrameElement)) continue;
            try {
                const doc = iframe.contentDocument;
                if (!doc) continue;

                // Form Nhận định cấp cứu
                const cboDanhSach = doc.getElementById('cboDANHSACH');
                const hasEmergency = cboDanhSach && cboDanhSach.options[cboDanhSach.selectedIndex]?.text?.includes('39/BV2');
                
                // Form NDPLNBCC-381000 có textfield_671 (Mạch), textfield_673 (Nhiệt độ)
                if (iframe.offsetWidth > 0 && (hasEmergency || (doc.getElementById('textfield_671') && doc.getElementById('textfield_673')))) {
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
        container.style.top = (rect.top + 10) + 'px';
        container.style.right = (window.innerWidth - rect.right + 10) + 'px';

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
                await doFillForm(iframe);
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
            } catch (e) {
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

    async function doFillForm(targetIframe) {
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

            let vitals = cachedVitals;
            
            // Try fallback to VNPTStore
            if (!vitals || !vitals.pulse || !vitals.temperature || !vitals.bloodPressure) {
                const storeVitals = window.VNPTStore.get('vitalsDataMap')[pid];
                if (storeVitals) vitals = storeVitals;
            }

            // Fetch if still missing
            if (!vitals || !vitals.pulse || !vitals.temperature || !vitals.bloodPressure) {
                window.VNPTRealtime?.showToast('⏳ Đang lấy sinh hiệu...', 'info');
                const fresh = await fetchVitalsForPatient(pid);
                if (fresh) {
                    vitals = fresh;
                    cachedVitals = vitals;
                }
            }

            window.VNPTRealtime?.showToast('⏳ Đang điền phiếu...', 'info');

            await injectHelperIntoIframe(target);

            await sendCmd(target, 'EMERGENCY_FILL_FORM', {
                pulse: vitals?.pulse || '',
                temperature: vitals?.temperature || '',
                bloodPressure: vitals?.bloodPressure || '',
                bmi: vitals?.bmi || ''
            }, 'EMERGENCY_FILL_RESULT');

            window.VNPTRealtime?.showToast('✅ Đã điền xong phiếu cấp cứu!', 'success');
            hideFillButton(); // Ẩn button sau khi điền
        } catch (e) {
            console.error('[Emergency] Lỗi:', e);
            const msg = e instanceof Error ? e.message : 'Lỗi';
            window.VNPTRealtime?.showToast('❌ ' + msg, 'warning');
        }
    }

    async function fetchVitalsForPatient(pid) {
        if (!window.VNPTMessaging) return null;
        try {
            const res = await window.VNPTMessaging.sendRequest('REQ_FETCH_VITALS', { rowId: pid }, 5000);
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
            const script = doc.createElement('script');
            script.id = 'vnpt-emergency-helper';
            
            if (_chrome && _chrome.runtime) {
                script.src = _chrome.runtime.getURL('content/scanner/emergency-iframe-helper.js');
            } else {
                reject(new Error('Chrome runtime unavailable'));
                return;
            }

            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Inject failed'));
            (doc.head || doc.documentElement).appendChild(script);
        });
    }

    async function sendCmd(iframe, cmd, payload, expectedResponse, timeout = 8000) {
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

    return {
        init,
        doFillForm
    };
})();

window.VNPTEmergency = VNPTEmergency;
