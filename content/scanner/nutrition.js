/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Nutrition (DD-03 Auto-Fill)
 * 
 * Passive approach:
 * - User tự mở form DD-03
 * - Poll tìm form field trong iframe → hiện icon "Điền phiếu"
 * - Click icon → tự điền tất cả
 * - Icon ẩn khi form đóng hoặc sau khi điền
 * 
 * CHỈ chạy ở TOP FRAME.
 * Poll rất nhẹ: chỉ check vài getElementById trong iframe (<1ms).
 */

const VNPTNutrition = (function () {
    // CHỈ chạy ở top frame — không chạy trong iframe
    if (window !== window.top) {
        return { init: function () { }, doFillForm: function () { } };
    }

    /** @type {any} */
    const _chrome = /** @type {any} */ (typeof (/** @type {any} */ (window))['chrome'] !== 'undefined' ? (/** @type {any} */ (window))['chrome'] : null);

    /** @type {HTMLDivElement | null} */
    let fillButton = null;
    /** @type {HTMLIFrameElement | null} */
    let currentFormIframe = null;

    /** @type {{weight: string, height: string, bmi?: string, bloodPressure?: string, pulse?: string, temperature?: string} | null} */
    let cachedVitals = null;
    /** @type {string | null} */
    let lastPatientId = null;

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
        } catch (_e) { /* cross-origin error */ }
        try {
            if (iframe.src) return new URL(iframe.src, window.location.href).origin;
        } catch (e) { console.warn('[Aladinn/Nutrition] Error reading context:', e); }
        return getAllowedOrigin();
    }

    function init() {
        // Use MutationObserver instead of polling
        const observer = new MutationObserver(() => {
            if (!window.VNPTStore) return;
            checkForDD03Form();
        });
        observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'class'] });
        checkForDD03Form();

        // Use reactive subscription instead of 2s polling
        if (window.VNPTStore) {
            window.VNPTStore.subscribe('selectedPatientId', (pid) => {
                if (pid) onPatientSelected(pid);
            });

            // Initial check
            const currentPid = window.VNPTStore.get('selectedPatientId');
            if (currentPid) onPatientSelected(currentPid);
        } else {
            // Fallback to polling if store not yet ready
            setInterval(async () => {
                if (!window.VNPTStore) return;
                const pid = window.VNPTStore.get('selectedPatientId');
                if (pid) onPatientSelected(pid);
            }, 2000);
        }

        console.log('[Nutrition] Observer initialized (top frame)');
    }

    /**
     * @param {string} pid 
     */
    async function onPatientSelected(pid) {
        if (!pid || pid === lastPatientId) return;

        console.log('[Nutrition] Phát hiện chọn bệnh nhân:', pid);
        lastPatientId = pid;
        cachedVitals = null;
    }

    /**
     * Kiểm tra có iframe nào chứa form DD-03 không
     */
    function checkForDD03Form() {
        const iframes = document.querySelectorAll('iframe');
        let found = false;

        for (const iframe of Array.from(iframes)) {
            if (!(iframe instanceof HTMLIFrameElement)) continue;
            try {
                const doc = iframe.contentDocument;
                if (!doc) continue;

                // Form DD-03 có 2 field đặc trưng
                // QUAN TRỌNG: kiểm tra iframe đang HIỂN THỊ (khi panel đóng, iframe vẫn trong DOM nhưng ẩn)
                if (iframe.offsetWidth > 0 && doc.getElementById('textfield_1535') && doc.getElementById('textfield_1536')) {
                    found = true;
                    currentFormIframe = iframe;

                    // Chỉ tạo button nếu chưa có
                    if (!fillButton || !document.body.contains(fillButton)) {
                        showFillButton(iframe);
                    }
                    break;
                }
            } catch (_e) {
                // Cross-origin iframe, skip
            }
        }

        // Form không còn → ẩn button
        if (!found) {
            hideFillButton();
            currentFormIframe = null;
        }
    }

    /**
     * Hiện floating button "Điền phiếu DD-03"
     * z-index cực cao + position fixed → luôn hiện trên cùng
     * @param {HTMLIFrameElement} iframe
     */
    function showFillButton(iframe) {
        hideFillButton();

        fillButton = document.createElement('div');
        fillButton.id = 'vnpt-nutrition-fill-btn';

        const style = document.createElement('style');
        style.textContent = `
            @keyframes fab-pulse-nutrition {
                0%, 100% { box-shadow: 0 2px 8px rgba(33,150,243,0.4); }
                50% { box-shadow: 0 4px 16px rgba(33,150,243,0.7); }
            }
            @keyframes fab-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes fab-bounce { 0%,100% { transform: scale(1); } 50% { transform: scale(1.15); } }
            @keyframes fab-shake { 0%,100% { transform: translateX(0); } 25% { transform: translateX(-3px); } 75% { transform: translateX(3px); } }
            #vnpt-nutrition-fab {
                position: fixed !important;
                top: 80px !important;
                right: 15px !important;
                z-index: 2147483647 !important;
                width: 48px !important; height: 48px !important;
                border-radius: 50% !important;
                display: flex !important; align-items: center !important; justify-content: center !important;
                cursor: pointer !important;
                user-select: none !important;
                background: linear-gradient(135deg, #2196F3, #1565C0) !important;
                border: 2px solid rgba(255,255,255,0.3) !important;
                font-size: 22px !important;
                transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
                animation: fab-pulse-nutrition 2.5s ease-in-out infinite !important;
            }
            #vnpt-nutrition-fab:hover { transform: scale(1.12) !important; }
            #vnpt-nutrition-fab:active { transform: scale(0.95) !important; }
            #vnpt-nutrition-fab.processing { animation: fab-spin 1s linear infinite !important; opacity: 0.85 !important; pointer-events: none !important; }
            #vnpt-nutrition-fab.done { background: linear-gradient(135deg, #4CAF50, #2E7D32) !important; animation: fab-bounce 0.5s ease !important; }
            #vnpt-nutrition-fab.error { background: linear-gradient(135deg, #ef4444, #dc2626) !important; animation: fab-shake 0.4s ease !important; }
            #vnpt-nutrition-fab::after {
                content: attr(data-tooltip);
                position: absolute; right: 56px; top: 50%; transform: translateY(-50%);
                background: rgba(15,23,42,0.95); color: #f1f5f9;
                padding: 6px 12px; border-radius: 8px;
                font-size: 12px; font-weight: 500; white-space: nowrap;
                pointer-events: none; opacity: 0; transition: opacity 0.2s;
                font-family: 'Inter', system-ui, sans-serif;
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            }
            #vnpt-nutrition-fab:hover::after { opacity: 1; }
        `;
        fillButton.appendChild(style);

        const fab = document.createElement('div');
        fab.id = 'vnpt-nutrition-fab';
        fab.innerHTML = '🍽️';
        fab.setAttribute('data-tooltip', '🍽️ Điền phiếu DD-03');

        fab.addEventListener('click', async () => {
            const origIcon = fab.innerHTML;
            fab.className = 'processing';
            fab.innerHTML = '⏳';

            try {
                await doFillForm(iframe);
                fab.className = 'done';
                fab.innerHTML = '✅';
                fab.setAttribute('data-tooltip', '✅ Đã điền DD-03 xong!');
                setTimeout(() => {
                    if (fillButton) {
                        fab.className = '';
                        fab.innerHTML = origIcon;
                        fab.setAttribute('data-tooltip', '🍽️ Điền phiếu DD-03');
                    }
                }, 2500);
            } catch (_e) {
                fab.className = 'error';
                fab.innerHTML = '❌';
                setTimeout(() => {
                    if (fillButton) {
                        fab.className = '';
                        fab.innerHTML = origIcon;
                        fab.setAttribute('data-tooltip', '🍽️ Điền phiếu DD-03');
                    }
                }, 2500);
            }
        });

        fillButton.appendChild(fab);
        document.body.appendChild(fillButton);
    }

    /**
     * Ẩn button
     */
    function hideFillButton() {
        const el = document.getElementById('vnpt-nutrition-fill-btn');
        if (el) el.remove();
        fillButton = null;
    }

    /**
     * Điền form DD-03
     * Tự động quét vitals nếu chưa có dữ liệu
     * @param {HTMLIFrameElement} [iframe]
     */
    async function doFillForm(iframe) {
        const target = iframe || currentFormIframe;
        if (!target) {
            window.VNPTRealtime?.showToast('⚠️ Không tìm thấy form DD-03!', 'warning');
            return;
        }

        try {
            if (!window.VNPTStore) {
                window.VNPTRealtime?.showToast('⚠️ Store chưa sẵn sàng!', 'warning');
                return;
            }

            const patientId = window.VNPTStore.get('selectedPatientId');
            if (!patientId) {
                window.VNPTRealtime?.showToast('⚠️ Chưa chọn bệnh nhân!', 'warning');
                return;
            }

            // Ưu tiên: cachedVitals (tự quét khi chọn BN) → store → API → đọc form
            let vitals = cachedVitals;

            if (!vitals || !vitals.weight || !vitals.height || vitals.height === '0') {
                vitals = window.VNPTStore.get('vitalsDataMap')[patientId] || null;
            }

            if (!vitals || !vitals.weight || !vitals.height || vitals.height === '0') {
                window.VNPTRealtime?.showToast('⏳ Đang quét chỉ số chiều cao/cân nặng...', 'info');
                vitals = await fetchVitalsForPatient(patientId);
                if (vitals && vitals.weight) cachedVitals = vitals;
            }

            // Fallback: đọc trực tiếp từ form (HIS tự điền sẵn)
            if (!vitals || !vitals.weight || !vitals.height || vitals.height === '0') {
                const formDoc = target.contentDocument;
                if (formDoc) {
                    const fw = /** @type {HTMLInputElement | null} */ (formDoc.getElementById('textfield_1535'));
                    const fh = /** @type {HTMLInputElement | null} */ (formDoc.getElementById('textfield_1536'));
                    vitals = { weight: fw?.value || '', height: fh?.value || '', bmi: '' };
                }
            }

            window.VNPTRealtime?.showToast('⏳ Đang điền phiếu...', 'info');

            // Inject helper vào iframe
            await injectHelper(target);

            // Tính chiều cao (m) — chuyển cm sang m nếu cần
            const h = vitals?.height || '';
            const hMeter = parseFloat(h) > 10 ? (parseFloat(h) / 100).toFixed(2) : h;

            // ✅ Extract Admission Date (Ngày nhập khoa) từ header thông tin bệnh nhân (Từ khung Top)
            let admissionDate = '';
            try {
                // Cách 1 cực nhanh và chuẩn: Dựa theo DOM ID của VNPT HIS trên top frame
                const lblMsg = document.getElementById('lblMSG_BOSUNG');
                if (lblMsg) {
                    const match = lblMsg.innerText.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/);
                    if (match) {
                        admissionDate = match[1];
                        console.log('[Nutrition] TOP: Tìm thấy Ngày nhập khoa qua ID:', admissionDate);
                    }
                }
                
                // Cách 2: Thử tìm theo cấu trúc Node text của VNPT nếu ID bị mất
                if (!admissionDate) {
                    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
                    let textNode;
                    while ((textNode = walker.nextNode())) {
                        const text = textNode.nodeValue || '';
                        if (text.includes('|') && (text.includes('Tuổi') || text.includes('Mã BA:'))) {
                            const match = text.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/);
                            if (match) {
                                admissionDate = match[1];
                                console.log('[Nutrition] TOP: Tìm thấy Ngày nhập khoa qua TreeWalker:', admissionDate);
                                break;
                            }
                        }
                    }
                }
                
                // Cách 3: Lôi từ đáy biển (API NT.006) thông qua dữ liệu Vitals đã quét chìm
                if (!admissionDate && vitals && vitals.admissionDate) {
                    admissionDate = vitals.admissionDate;
                    console.log('[Nutrition] TOP: Đã kéo được Ngày nhập khoa TỪ API (Dành cho BN Ra Viện):', admissionDate);
                }

                // Ghi chú: Có thể lblMSG_BOSUNG nằm bên TRONG iframe, ta sẽ để Helper tự quét thêm nếu TOP frame không tìm thấy.
                if (!admissionDate) console.log('[Nutrition] TOP: Không tìm thấy Ngày nhập khoa ở Top frame lẫn API. Sẽ chuyển giao cho Iframe Helper.');
            } catch (_e) { console.warn('[Nutrition] Lỗi nội bộ khi dò parse Ngày nhập viện', _e); }

            // Gửi lệnh điền — gửi cả weight/bloodPressure + admissionDate
            await sendCmd(target, 'NUTRITION_FILL_FORM', {
                weight: vitals?.weight || '',
                height: hMeter,
                bloodPressure: vitals?.bloodPressure || '',
                admissionDate: admissionDate
            }, 'NUTRITION_FILL_RESULT');

            window.VNPTRealtime?.showToast('✅ Đã điền xong phiếu DD-03!', 'success');

            // Ẩn button sau khi điền xong
            hideFillButton();
        } catch (e) {
            console.error('[Nutrition] Lỗi:', e);
            const msg = (e instanceof Error) ? e.message : 'Lỗi';
            window.VNPTRealtime?.showToast('❌ ' + msg, 'warning');
        }
    }

    /**
     * Fetch vitals cho bệnh nhân qua injected.js (jsonrpc API)
     * @param {string} rowId
     * @returns {Promise<{weight: string, height: string, bmi?: string, bloodPressure?: string, pulse?: string, temperature?: string} | null>}
     */
    async function fetchVitalsForPatient(rowId) {
        if (!window.VNPTMessaging) return null;
        try {
            const res = await window.VNPTMessaging.sendRequest('REQ_FETCH_VITALS', { rowId }, 5000);
            return res.vitals || null;
        } catch (_e) {
            return null;
        }
    }

    // =============================================
    // INJECT & COMMUNICATE
    // =============================================

    /** @param {HTMLIFrameElement} iframe */
    async function injectHelper(iframe) {
        const doc = iframe.contentDocument;
        if (!doc) throw new Error('Không truy cập iframe');

        const old = doc.getElementById('vnpt-nutrition-helper');
        if (old) old.remove();

        return new Promise((resolve, reject) => {
            const script = doc.createElement('script');
            script.id = 'vnpt-nutrition-helper';
            if (_chrome && _chrome.runtime) {
                script.src = _chrome.runtime.getURL('content/scanner/nutrition-iframe-helper.js');
            } else {
                reject(new Error('Chrome runtime unavailable'));
                return;
            }
            script.onload = () => resolve(undefined);
            script.onerror = () => reject(new Error('Inject failed'));
            (doc.head || doc.documentElement).appendChild(script);
        });
    }

    /**
     * @param {HTMLIFrameElement} iframe
     * @param {string} cmd
     * @param {Object} data
     * @param {string} responseType
     * @param {number} [timeout=8000]
     * @returns {Promise<any>}
     */
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

    return { init, doFillForm };
})();

// @ts-ignore
window.VNPTNutrition = VNPTNutrition;
