/**
 * 🧞 Aladinn — Content Script Orchestrator
 * Entry point that initializes all 3 modules based on feature flags.
 * 
 * Load order (from manifest):
 * 1. lib/jquery.min.js
 * 2. content/shared/* (constants, utils, logger)
 * 3. content/scanner/* modules → scanner-init.js
 * 4. content/voice/* modules → voice-init.js
 * 5. content/content.js (THIS FILE - runs last)
 */

(function () {
    'use strict';

    // Only run in top frame for orchestration
    // Individual modules handle their own iframe logic
    if (window.__aladinnInitialized) return;
    window.__aladinnInitialized = true;

    // Khởi tạo HIS Shared Library cho Aladinn
    if (typeof HIS !== 'undefined' && HIS.init) {
        HIS.init({
            name: 'Aladinn',
            version: window.Aladinn?.VERSION || chrome.runtime.getManifest().version,
            prefix: 'aladinn',
            emoji: '🧞'
        });
    }

    const Logger = window.Aladinn?.Logger;

    // ========================================
    // FEATURE FLAG LOADING
    // ========================================
    async function loadFeatureFlags() {
        return new Promise((resolve) => {
            if (!chrome?.storage?.local) {
                resolve({ voice: true, scanner: true, sign: true, cds: true });
                return;
            }
            chrome.storage.local.get('aladinn_features', (result) => {
                const features = { voice: true, scanner: true, sign: true, cds: true, ...result.aladinn_features };
                window.Aladinn.features = features;
                resolve(features);
            });

        });
    }

    // ========================================
    // REMOTE CONFIG (SAFE MODE / KILL SWITCH)
    // Non-blocking, fail-open: nếu không tải được → mọi thứ vẫn BẬT
    // ========================================
    async function applyRemoteConfig(features) {
        try {
            const result = await new Promise((resolve) => {
                if (!chrome?.storage?.local) { resolve({}); return; }
                chrome.storage.local.get('aladinn_remote_config', (r) => resolve(r));
            });

            const rc = result.aladinn_remote_config;
            if (!rc || typeof rc.features !== 'object') return features;

            // Mapping: remote config key → local feature key
            const mapping = {
                autoSign: 'sign',
                cdsEngine: 'cds',
                aiVoice: 'voice',
                scanner: 'scanner'
            };

            let hasKill = false;
            for (const [remoteKey, localKey] of Object.entries(mapping)) {
                // Tôn trọng tuyệt đối công tắc An toàn L.S (CDS) của bác sĩ trên panel
                if (localKey === 'cds') continue;

                if (rc.features[remoteKey] === false) {
                    features[localKey] = false;
                    hasKill = true;
                    if (Logger) Logger.warn('SafeMode', `🚫 Tính năng "${localKey}" đã bị TẮT từ xa (Remote Kill Switch)`);
                }
            }

            // Hiển thị thông báo khẩn cấp nếu có
            if (rc.emergencyMessage && typeof rc.emergencyMessage === 'string' && rc.emergencyMessage.trim()) {
                showEmergencyToast(rc.emergencyMessage.trim(), hasKill);
            }

            window.Aladinn.features = features;
            return features;
        } catch (_err) {
            // Fail-open: bỏ qua lỗi, giữ nguyên features
            return features;
        }
    }

    /**
     * Hiển thị toast thông báo khẩn cấp (nếu admin đặt emergencyMessage)
     */
    /**
     * SECURITY: Escape HTML để chống XSS injection từ remote config
     */
    function _escapeHtml(str) {
        if (typeof str !== 'string') return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    function showEmergencyToast(message, isKill) {
        // Tránh hiển thị trùng
        if (document.getElementById('aladinn-emergency-toast')) return;

        // SECURITY: Escape message từ remote config để chống XSS
        const safeMessage = _escapeHtml(message);

        const toast = document.createElement('div');
        toast.id = 'aladinn-emergency-toast';
        toast.style.cssText = `
            position: fixed; bottom: 20px; right: 20px; z-index: 2147483647;
            max-width: 380px; padding: 14px 18px;
            background: ${isKill ? 'linear-gradient(135deg, #7f1d1d, #991b1b)' : 'linear-gradient(135deg, #1a1510, #2d2418)'};
            border: 1px solid ${isKill ? 'rgba(239,68,68,0.6)' : 'rgba(212,162,90,0.5)'};
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.6);
            color: #e8dcc8; font-family: system-ui, sans-serif; font-size: 13px;
            line-height: 1.5;
            animation: aladinn-toast-in 0.4s ease-out;
        `;
        toast.innerHTML = `
            <div style="display:flex; align-items:center; gap:8px; margin-bottom:6px;">
                <span style="font-size:18px;">${isKill ? '🚨' : '📢'}</span>
                <strong style="color:${isKill ? '#fca5a5' : '#d4a25a'};">Thông báo từ Aladinn</strong>
            </div>
            <div>${safeMessage}</div>
            <button id="aladinn-toast-close" style="
                position:absolute; top:8px; right:8px;
                background:transparent; border:none; color:#e8dcc8;
                cursor:pointer; font-size:14px; opacity:0.7;
            ">✕</button>
        `;

        // Inject animation keyframe
        if (!document.getElementById('aladinn-toast-style')) {
            const style = document.createElement('style');
            style.id = 'aladinn-toast-style';
            style.textContent = `
                @keyframes aladinn-toast-in {
                    from { opacity: 0; transform: translateY(20px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }

        document.body.appendChild(toast);
        document.getElementById('aladinn-toast-close').onclick = () => toast.remove();
        // Tự tắt sau 15 giây
        setTimeout(() => { if (toast.parentNode) toast.remove(); }, 15000);
    }

    // ========================================
    // SECURITY: Shared nonce + random JWT channel (per-session)
    // ========================================
    const __ALADINN_NONCE__ = crypto.randomUUID();
    const __ALADINN_JWT_CHANNEL__ = `__aladinn_tk_${crypto.randomUUID().slice(0, 8)}`;
    window.__ALADINN_NONCE__ = __ALADINN_NONCE__;
    window.__ALADINN_JWT_CHANNEL__ = __ALADINN_JWT_CHANNEL__;

    // ========================================
    // INJECT PAGE SCRIPTS (Scanner module)
    // ========================================
    function injectPageScripts() {
        const scripts = [
            'injected/token-capture.js',
            'injected/ajax-interceptor.js',
            'injected/grid-hook.js',
            'injected/api-bridge.js'
        ];

        let index = 0;
        function injectNext() {
            if (index >= scripts.length) return;
            const fileName = scripts[index++];
            const id = `aladinn-script-${fileName.replace(/\//g, '-')}`;
            if (document.getElementById(id)) {
                injectNext();
                return;
            }

            const script = document.createElement('script');
            script.id = id;

            // SECURITY: Pass shared nonce to ALL injected scripts
            script.dataset.aladinnNonce = __ALADINN_NONCE__;

            // SECURITY: Pass random JWT channel name to token-capture
            if (fileName === 'injected/token-capture.js') {
                script.dataset.aladinnChannel = __ALADINN_JWT_CHANNEL__;
            }

            // Add secure token for api-bridge
            if (fileName === 'injected/api-bridge.js') {
                const token = crypto.randomUUID();
                script.dataset.aladinnToken = token;
                window.__ALADINN_BRIDGE_TOKEN__ = token;
            }

            if (chrome?.runtime) {
                script.src = chrome.runtime.getURL(fileName);
            }
            script.onload = (e) => {
                e.target.remove();
                injectNext();
            };
            (document.head || document.documentElement).appendChild(script);
        }
        injectNext();
    }


    // ========================================
    // MODULE INITIALIZATION
    // ========================================
    async function initModules(features) {
        if (Logger) Logger.info('Main', `🧞 Aladinn v${window.Aladinn.VERSION} — Khởi tạo...`);

        // 🚏 Start unified Patient Observer (duy nhất 1 observer cho tất cả modules)
        if (window === window.top && HIS.PatientObserver) {
            HIS.PatientObserver.start();
            if (Logger) Logger.info('Main', '🔭 Patient Observer đã khởi động (shared)');
        }

        // Scanner Module
        if (features.scanner && window !== window.top) {
            // Scanner iframe helpers run in iframes, skip main init
        }

        if (features.scanner && window === window.top) {
            if (Logger) Logger.info('Main', '📊 Khởi tạo Scanner module...');
            injectPageScripts();
            try {
                if (window.Aladinn?.Scanner?.init) {
                    window.Aladinn.Scanner.init();
                    if (Logger) Logger.success('Main', '📊 Scanner module ✅');
                }
            } catch (err) {
                if (Logger) Logger.error('Main', '📊 Scanner module lỗi:', err);
            }
        }

        // Voice Module
        if (features.voice && window === window.top) {
            if (Logger) Logger.info('Main', '🎙️ Khởi tạo Voice module...');
            try {
                if (window.Aladinn?.Voice?.init) {
                    window.Aladinn.Voice.init();
                    if (Logger) Logger.success('Main', '🎙️ Voice module ✅');
                }
            } catch (err) {
                if (Logger) Logger.error('Main', '🎙️ Voice module lỗi:', err);
            }
        }

        // Sign Module
        if (features.sign && window === window.top) {
            if (Logger) Logger.info('Main', '✍️ Khởi tạo Sign module...');
            try {
                if (window.Aladinn?.Sign?.init) {
                    window.Aladinn.Sign.init();
                    if (Logger) Logger.success('Main', '✍️ Sign module ✅');
                }
            } catch (err) {
                if (Logger) Logger.error('Main', '✍️ Sign module lỗi:', err);
            }
        }

        // CDS Module
        if (features.cds && window === window.top) {
            if (Logger) Logger.info('Main', '🧠 Khởi tạo CDS module...');
            try {
                if (window.Aladinn?.CDS?.init) {
                    chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
                        const filterLow = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
                        const shadowMode = res.vnpt_cds_settings ? res.vnpt_cds_settings.shadowMode === true : false;
                        window.Aladinn.CDS.init(true, filterLow, shadowMode);
                        if (Logger) Logger.success('Main', '🧠 CDS module ✅');
                    });
                } else {
                    // Retry after 1.5s in case of race condition with module registration
                    setTimeout(() => {
                        if (window.Aladinn?.CDS?.init) {
                            chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
                                const filterLow = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
                                const shadowMode = res.vnpt_cds_settings ? res.vnpt_cds_settings.shadowMode === true : false;
                                window.Aladinn.CDS.init(true, filterLow, shadowMode);
                                if (Logger) Logger.success('Main', '🧠 CDS module (delayed) ✅');
                            });
                        } else {
                            if (Logger) Logger.warn('Main', '🧠 CDS module not found after retry.');
                        }
                    }, 1500);
                }
            } catch (err) {
                console.error('[Aladinn] 🧠 CDS module lỗi:', err);
                if (Logger) Logger.error('Main', '🧠 CDS module lỗi:', err);
            }
        }

        // ========================================
        // COMMAND BUS REGISTRATION
        // ========================================
        if (Aladinn.CommandBus) {
            // Scanner commands
            if (features.scanner && window.Aladinn?.Scanner) {
                Aladinn.CommandBus.register('SCAN_PATIENT', (payload) => {
                    if (window.VNPTScanFlow?.startScan) return window.VNPTScanFlow.startScan(payload);
                });
                Aladinn.CommandBus.register('SCAN_VITALS', () => {
                    if (window.VNPTScanFlow?.startVitalsScan) return window.VNPTScanFlow.startVitalsScan();
                });
                Aladinn.CommandBus.register('SCAN_DRUGS', () => {
                    if (window.VNPTScanFlow?.startDrugsScan) return window.VNPTScanFlow.startDrugsScan();
                });
                Aladinn.CommandBus.register('SHOW_DASHBOARD', () => {
                    if (window.VNPTDashboard?.show) return window.VNPTDashboard.show();
                });
                Aladinn.CommandBus.register('SHOW_LAB_SUMMARY', () => {
                    if (window.Aladinn?.Scanner?.showLabTimeline) return window.Aladinn.Scanner.showLabTimeline();
                });
                Aladinn.CommandBus.register('CLEAR_CACHE', () => {
                    if (window.VNPTStore?.clearAll) return window.VNPTStore.clearAll();
                });
            }

            // Sign commands
            if (features.sign && window.Aladinn?.Sign) {
                Aladinn.CommandBus.register('START_SIGNING', () => {
                    if (window.Aladinn?.Sign?.Signing?.startSession) return window.Aladinn.Sign.Signing.startSession();
                });
                Aladinn.CommandBus.register('FILTER_BY_CREATOR', (payload) => {
                    if (window.Aladinn?.Sign?.Filter?.filterByCreator) return window.Aladinn.Sign.Filter.filterByCreator(payload.userName, payload.userId);
                });
                Aladinn.CommandBus.register('NEXT_PATIENT', () => {
                    if (window.Aladinn?.Sign?.Signing?.processNextPatient) return window.Aladinn.Sign.Signing.processNextPatient(true);
                });
            }

            // CDS commands
            if (features.cds && window.Aladinn?.CDS) {
                Aladinn.CommandBus.register('RUN_CDS_CHECK', () => {
                    if (window.Aladinn?.CDS?.Engine?.runCheck) return window.Aladinn.CDS.Engine.runCheck();
                });
            }

            // Voice commands
            if (features.voice && window.Aladinn?.Voice) {
                Aladinn.CommandBus.register('TOGGLE_VOICE', (payload) => {
                    if (window.Aladinn?.Voice?.toggle) return window.Aladinn.Voice.toggle(payload.enabled);
                });
            }

            if (Logger) Logger.info('Main', `📡 CommandBus: ${Aladinn.CommandBus.list().length} commands registered`);
        }

        // ========================================
        // AMBIENT UI EFFECTS (Aesthetics)
        // ========================================
        if (window === window.top) {
            let uiRetries = 0;
            const applyAesthetics = setInterval(() => {
                uiRetries++;
                let found = false;
                
                // Tìm element "Người dùng:" ở footer/status bar của HIS
                // Dùng selector cụ thể thay vì querySelectorAll('*') — giảm từ ~5000 xuống ~200 elements
                const elements = document.querySelectorAll('span, div, td, label, a, li, p, strong, em, b');
                for (const el of elements) {
                    
                    if (el.childNodes.length === 1 && el.childNodes[0].nodeType === Node.TEXT_NODE) {
                        const text = el.textContent.trim();
                        
                        // Trường hợp 1: "Người dùng:" và tên nằm ở 2 element khác nhau (thường gặp do khác màu)
                        if (text === 'Người dùng:' || text === 'Người dùng') {
                            let nameNode = el.nextSibling;
                            
                            // Bỏ qua khoảng trắng
                            while (nameNode && nameNode.nodeType === Node.TEXT_NODE && nameNode.textContent.trim() === '') {
                                nameNode = nameNode.nextSibling;
                            }
                            
                            if (nameNode) {
                                let targetEl;
                                if (nameNode.nodeType === Node.TEXT_NODE) {
                                    if (nameNode.textContent.trim().length > 0) {
                                        targetEl = document.createElement('span');
                                        targetEl.textContent = nameNode.textContent;
                                        nameNode.parentNode.replaceChild(targetEl, nameNode);
                                    }
                                } else if (nameNode.nodeType === Node.ELEMENT_NODE) {
                                    targetEl = nameNode;
                                }
                                
                                if (targetEl && !targetEl.classList.contains('his-mystic-username-aura')) {
                                    targetEl.classList.add('his-mystic-username-aura');
                                    injectAuraStyles(targetEl);
                                    found = true;
                                    break;
                                }
                            }
                        } 
                        // Trường hợp 2: "Người dùng:" và tên nằm trong cùng 1 element
                        else if (text.startsWith('Người dùng:') && text.includes('-')) {
                            if (!el.classList.contains('his-mystic-username-aura-applied')) {
                                const match = text.match(/(Người dùng:\s*)(.*?(?=\s+Khoa:|$))/);
                                if (match) {
                                    const username = match[2];
                                    el.classList.add('his-mystic-username-aura-applied');
                                    el.innerHTML = el.innerHTML.replace(
                                        username, 
                                        `<span class="his-mystic-username-aura">${username}</span>`
                                    );
                                    
                                    const newTarget = el.querySelector('.his-mystic-username-aura');
                                    if (newTarget) injectAuraStyles(newTarget);
                                    
                                    found = true;
                                    break;
                                }
                            }
                        }
                    }
                }
                
                function injectAuraStyles(targetEl) {
                    targetEl.style.display = 'inline-flex';
                    targetEl.style.alignItems = 'center';
                    targetEl.style.gap = '6px';
                    targetEl.style.padding = '0';
                    targetEl.style.borderRadius = '0px';
                    targetEl.style.background = 'transparent';
                    targetEl.style.border = 'none';
                    targetEl.style.color = '#ffffff';
                    targetEl.style.fontWeight = '600';
                    targetEl.style.position = 'relative';
                    targetEl.style.zIndex = '1';
                    targetEl.style.boxShadow = 'none';
                    targetEl.style.fontSize = '12px';
                    
                    // Dọn dẹp badge VIP PRO cũ và icon cũ nếu có
                    const oldBadge = targetEl.querySelector('.aladinn-pro-badge');
                    if (oldBadge) oldBadge.remove();
                    const oldIcon = targetEl.querySelector('.aladinn-genie-icon');
                    if (oldIcon) oldIcon.remove();
                    
                    if (!targetEl.querySelector('.aladinn-active-dot')) {
                        const dot = document.createElement('span');
                        dot.className = 'aladinn-active-dot';
                        dot.style.width = '7px';
                        dot.style.height = '7px';
                        dot.style.background = '#00e676';
                        dot.style.borderRadius = '50%';
                        dot.style.display = 'inline-block';
                        dot.style.boxShadow = '0 0 6px #00e676';
                        dot.style.marginRight = '2px';
                        dot.style.flexShrink = '0';
                        
                        // Hiệu ứng nhịp thở nhấp nháy êm dịu (chu kỳ 3s)
                        if (!document.getElementById('aladinn-active-dot-animation')) {
                            const style = document.createElement('style');
                            style.id = 'aladinn-active-dot-animation';
                            style.textContent = `
                                @keyframes aladinn-active-dot-breath {
                                    0% { opacity: 0.35; transform: scale(0.85); box-shadow: 0 0 3px rgba(0, 230, 118, 0.4); }
                                    50% { opacity: 1; transform: scale(1.15); box-shadow: 0 0 10px rgba(0, 230, 118, 0.8); }
                                    100% { opacity: 0.35; transform: scale(0.85); box-shadow: 0 0 3px rgba(0, 230, 118, 0.4); }
                                }
                            `;
                            document.head.appendChild(style);
                        }
                        dot.style.animation = 'aladinn-active-dot-breath 3s infinite ease-in-out';
                        
                        // Chèn chấm xanh vào PHÍA TRƯỚC tên người dùng
                        targetEl.insertBefore(dot, targetEl.firstChild);
                    }
                }

                if (found || uiRetries > 30) {
                    clearInterval(applyAesthetics);
                }
            }, 1000);
        }

        if (Logger) Logger.success('Main', '🧞 Aladinn đã sẵn sàng!');
    }

    /**
     * Smart DOM Scanner — Trích xuất ngữ cảnh bệnh nhân từ các dialog/hộp thoại đang hoạt động
     */
    function scanActiveDialogPatientContext() {
        const frames = [window];
        try {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(f => {
                try {
                    if (f.contentDocument && f.contentWindow) frames.push(f.contentWindow);
                } catch (_e) {}
            });
        } catch (_e) {}

        for (const win of frames) {
            try {
                // HIS UI dùng .ui-dialog-title, .panel-title hoặc .title cho tiêu đề
                const titleEls = win.document.querySelectorAll('.ui-dialog-title, .panel-title, .title, [class*="title"]');
                for (const el of titleEls) {
                    const text = (el.textContent || '').trim();
                    // Khớp định dạng: CLS + Thuốc (HUỲNH THỊ NGỌC MINH/ 2022/ Nữ)
                    const m = text.match(/\(([^/]+)\/\s*(\d{4})\/\s*([^)]+)\)/);
                    if (m) {
                        const name = m[1].trim();
                        const birthYear = m[2].trim();
                        const gender = m[3].trim();

                        // Tìm container bao quanh của el
                        const dialogContainer = el.closest('.ui-dialog, .panel, .modal, body');
                        let pid = '';
                        let diagnosis = '';
                        
                        if (dialogContainer) {
                            const allText = dialogContainer.textContent || '';
                            // Tìm mã bệnh án, vd: "| TE1878724338549" hoặc "TE1878724338549" (Ưu tiên TE lên trước, và lọc bỏ mã BHYT)
                            let finalCode = '';
                            const teMatch = allText.match(/\b(TE\d{10,15})\b/i);
                            if (teMatch) {
                                finalCode = teMatch[1].trim();
                            } else {
                                const allMatches = allText.matchAll(/\|\s*([A-Z0-9-]{10,25})\b/gi);
                                for (const match of allMatches) {
                                    const code = match[1].trim();
                                    if (!/^[A-Z]{2}\d{13}$/i.test(code)) {
                                        finalCode = code;
                                        break;
                                    }
                                }
                            }
                            if (finalCode) {
                                pid = finalCode;
                            }

                            // Tìm chẩn đoán
                            const diagMatch = allText.match(/(?:CĐ|Chẩn đoán|Chan doan)\s*:\s*([^||\n]+)/i);
                            if (diagMatch) {
                                diagnosis = diagMatch[1].trim().replace(/\s*\|\s*[A-Z]{2}\d{13}\s*$/i, '').replace(/\s*\b[A-Z]{2}\d{13}\b\s*$/i, '').trim();
                            }

                            if (!pid) {
                                pid = 'TEMP_' + name.replace(/\s+/g, '') + '_' + birthYear;
                            }
                        }

                        return {
                            name,
                            pid,
                            birthYear,
                            gender,
                            diagnosis
                        };
                    }
                }
            } catch (_e) {}
        }
        return null;
    }

    // ========================================
    // MESSAGE LISTENER (Unified)
    // ========================================
    if (chrome?.runtime) {
        chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
            const { type, action } = message;

            // Voice module toggle
            if (type === 'TOGGLE_EXTENSION') {
                if (window.Aladinn?.Voice?.toggle) {
                    window.Aladinn.Voice.toggle(message.enabled);
                }
                sendResponse({ success: true });
            }

            // Scanner module actions
            if (action === 'TOGGLE_SCANNER_UI') {
                if (window.Aladinn?.Scanner?.Settings?.toggle) {
                    window.Aladinn.Scanner.Settings.toggle();
                }
                sendResponse({ success: true });
            }

            if (action === 'UPDATE_SETTINGS') {
                if (window.Aladinn?.Scanner?.Settings?.syncFromChrome) {
                    window.Aladinn.Scanner.Settings.syncFromChrome();
                } else if (window.Aladinn?.Scanner?.Settings?.init) {
                    window.Aladinn.Scanner.Settings.init();
                }
                
                // Update CDS settings
                if (window.Aladinn?.CDS?.init) {
                    const cdsEnabled = window.Aladinn.features?.cds === true;
                    chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
                        const filterLow = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
                        const shadowMode = res.vnpt_cds_settings ? res.vnpt_cds_settings.shadowMode === true : false;
                        window.Aladinn.CDS.init(cdsEnabled, filterLow, shadowMode);
                    });
                }
                
                sendResponse({ success: true });
            }

            // Feature toggle update
            if (type === 'FEATURE_TOGGLE') {
                window.Aladinn.features = message.features;

                // Voice toggle
                if (window.Aladinn?.Voice?.toggle) {
                    window.Aladinn.Voice.toggle(message.features.voice === true);
                }

                // Scanner toggle
                if (message.features.scanner === false) {
                    // Dừng scan đang chạy
                    if (window.VNPTScanFlow?.stop) window.VNPTScanFlow.stop();
                    // Ẩn native menu
                    const nativeMenu = document.querySelector('.vnpt-native-menu-item');
                    if (nativeMenu) nativeMenu.style.display = 'none';
                    // Ẩn settings panel
                    if (window.VNPTSettings?.hide) window.VNPTSettings.hide();
                    if (Logger) Logger.info('Main', '📊 Scanner module TẮT');
                } else {
                    // Hiện lại native menu nếu đã bị ẩn
                    const nativeMenu = document.querySelector('.vnpt-native-menu-item');
                    if (nativeMenu) nativeMenu.style.display = '';
                    if (Logger) Logger.info('Main', '📊 Scanner module BẬT');
                }

                // Sign toggle — forward to background để sync auto-sign state
                chrome.runtime.sendMessage({
                    type: 'FEATURE_TOGGLE',
                    features: message.features
                }).catch(() => {});

                // CDS toggle
                if (window.Aladinn?.CDS?.init) {
                    const cdsEnabled = message.features.cds === true;
                    chrome.storage.local.get(['vnpt_cds_settings'], (res) => {
                        const filterLow = res.vnpt_cds_settings ? res.vnpt_cds_settings.filterLow !== false : true;
                        const shadowMode = res.vnpt_cds_settings ? res.vnpt_cds_settings.shadowMode === true : false;
                        window.Aladinn.CDS.init(cdsEnabled, filterLow, shadowMode);
                    });
                }

                sendResponse({ success: true });
            }

            // Sign module actions (forwarded from popup/background)
            if (action === 'startSigning') {
                if (window.Aladinn?.Sign?.Signing?.startSession) {
                    window.Aladinn.Sign.Signing.startSession();
                }
                sendResponse({ success: true });
            }

            if (action === 'filterByCreator') {
                if (window.Aladinn?.Sign?.Filter?.filterByCreator) {
                    window.Aladinn.Sign.Filter.filterByCreator(message.userName, message.userId);
                }
                sendResponse({ success: true });
            }

            if (action === 'nextPatient' || action === 'next-patient') {
                if (window.Aladinn?.Sign?.Signing?.processNextPatient) {
                    window.Aladinn.Sign.Signing.processNextPatient(true);
                }
                sendResponse({ success: true });
            }

            // Popup scanner commands (routed via background SW, no more ISOLATED world executeScript)
            if (type === 'POPUP_COMMAND') {
                const funcName = message.funcName;
                const funcArg = message.funcArg || null;
                let result = false;
                if (window.Aladinn?.Scanner) {
                    if (typeof window.Aladinn.Scanner[funcName] === 'function') {
                        window.Aladinn.Scanner[funcName](funcArg);
                        result = true;
                    }
                }
                sendResponse({ success: result });
            }

            // Popup dashboard command
            if (type === 'POPUP_SHOW_DASHBOARD') {
                let result = false;
                if (window.VNPTDashboard) {
                    window.VNPTDashboard.show();
                    result = true;
                } else if (window.Aladinn?.Scanner?.UI?.Dashboard) {
                    window.Aladinn.Scanner.UI.Dashboard.show();
                    result = true;
                }
                sendResponse({ success: result });
            }

            // Popup debug toggle
            if (type === 'POPUP_SET_DEBUG') {
                if (window.VNPTConfig) window.VNPTConfig.DEBUG = message.state;
                window.postMessage({ type: 'ALADINN_SET_DEBUG', state: message.state }, window.location.origin);
                sendResponse({ success: true });
            }

            // Patient context for popup card
            if (type === 'GET_PATIENT_CONTEXT') {
                try {
                    const store = window.VNPTStore?.getState() || {};
                    let name = store.selectedPatientName || '';
                    let pid = store.selectedPatientId;
                    let birthYear = '';
                    let bed = '';
                    let dayCount = '';
                    let diagnosis = '';

                    if (!name && !pid) {
                        // Fallback: Quét tìm hộp thoại chi tiết bệnh nhân đang hoạt động trên màn hình
                        const activeCtx = scanActiveDialogPatientContext();
                        if (activeCtx) {
                            name = activeCtx.name;
                            pid = activeCtx.pid;
                            birthYear = activeCtx.birthYear || '';
                            diagnosis = activeCtx.diagnosis || '';

                            // Đồng bộ ngược dữ liệu bệnh nhân đã trích xuất vào Store
                            if (window.VNPTStore) {
                                if (pid) window.VNPTStore.actions.selectPatient(pid);
                                if (name) window.VNPTStore.set('selectedPatientName', name);
                            }
                        }
                    }

                    if (!name && !pid) {
                        sendResponse(null);
                    } else {
                        // Try to get more info from the grid
                        // Attempt to read from the highlighted row in the patient grid
                        const selectedRow = document.querySelector('.datagrid-row-selected, tr.datagrid-row-selected, tr[class*="selected"]');
                        if (selectedRow) {
                            const cells = selectedRow.querySelectorAll('td');
                            // HIS grid columns: index, icons, MA_BA, MA_BN, Giờ vào, Vào khoa, Họ tên, Năm sinh, SNĐT, ...
                            if (cells.length >= 8) {
                                if (!birthYear) birthYear = (cells[7]?.textContent || '').trim();
                                dayCount = (cells[8]?.textContent || '').trim();
                            }
                            // Chẩn đoán thường ở cột cuối
                            if (!diagnosis) {
                                for (let i = cells.length - 1; i >= 9; i--) {
                                    const txt = (cells[i]?.textContent || '').trim();
                                    if (txt && txt.length > 5 && /[A-Z]\d/.test(txt)) {
                                        diagnosis = txt;
                                        break;
                                    }
                                }
                            }
                        }

                        sendResponse({
                            name: name,
                            pid: pid,
                            birthYear: birthYear,
                            bed: bed,
                            dayCount: dayCount,
                            diagnosis: diagnosis
                        });
                    }
                } catch (_e) {
                    sendResponse(null);
                }
            }

            return true;
        });
    }

    // ========================================
    // ENTRY POINT
    // ========================================
    loadFeatureFlags()
        .then(features => applyRemoteConfig(features))
        .then(features => {
            try {
                initModules(features);
            } catch (err) {
                console.error('[Aladinn] Critical error during initialization:', err);
            }
        });

})();
