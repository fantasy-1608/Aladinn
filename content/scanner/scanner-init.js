/**
 * 🧞 Aladinn — Scanner Module Orchestrator (v5.1.0)
 * Replaces the old content.js from VNPT_HIS_Scanner_v3.
 * Fits into the Aladinn namespace.
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Scanner = window.Aladinn.Scanner || {};

(function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    function escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    function renderSafeAiMarkdown(rawText, { basePx, smPx, badgeSz, indPx }) {
        let text = escapeHtml(rawText);
        text = text.replace(/([^\n])\s*(\d+\.\s)/g, '$1\n$2');
        text = text.replace(/([^\n])\s*(\*\*[A-ZÀ-ỸĐ][^*]+:\*\*)/g, '$1\n$2');
        text = text.replace(/^(\d+\.\s+)(.+)$/gm, (_, num, rawTitle) => {
            const colonIdx = rawTitle.indexOf(':');
            const labelRaw = colonIdx !== -1 ? rawTitle.slice(0, colonIdx + 1) : rawTitle;
            const contentRaw = colonIdx !== -1 ? rawTitle.slice(colonIdx + 1).trim() : '';
            const contentHtml = contentRaw
                .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#D4A853">$1</strong>')
                .replace(/\*(.*?)\*/g, '<em style="color:#e8dcc8">$1</em>');
            return '<div style="display:flex;align-items:flex-start;gap:8px;margin:14px 0 6px;">' +
                `<span style="min-width:${badgeSz}px;height:${badgeSz}px;border-radius:50%;background:rgba(212,168,83,0.18);border:1px solid rgba(212,168,83,0.4);display:inline-flex;align-items:center;justify-content:center;font-size:${smPx}px;font-weight:800;color:#D4A853;flex-shrink:0;margin-top:1px;">${num.trim().replace('.', '')}</span>` +
                `<span style="font-size:${basePx}px;line-height:1.6;"><strong style="color:#D4A853;font-weight:700;">${labelRaw}</strong>${contentHtml ? ' <span style="color:#cbd5e1;font-weight:400;">' + contentHtml + '</span>' : ''}</span>` +
                '</div>';
        });
        text = text
            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#D4A853">$1</strong>')
            .replace(/\*(.*?)\*/g, '<em style="color:#e8dcc8">$1</em>');
        text = text.replace(/^[-*]\s+(.+)$/gm, `<li style="margin-bottom:7px;color:#cbd5e1;line-height:1.65;font-size:${basePx}px;">$1</li>`);
        text = text.replace(/^(<strong[^>]*>(?:[^<]+:)<\/strong>)\s*(.*)$/gm, (_, heading, rest) => {
            return `<div style="margin:10px 0 4px ${indPx}px;font-size:${basePx}px;"><span style="font-weight:700;">${heading}</span> <span style="color:#cbd5e1;">${rest}</span></div>`;
        });
        return text.replace(/\n/g, '<br>');
    }

    async function requestScannerAI(prompt, model) {
        const response = await chrome.runtime.sendMessage({
            type: 'SCANNER_AI_REQUEST',
            payload: {
                prompt,
                model,
                generationConfig: { temperature: 0.1 }
            }
        });
        if (!response?.ok) {
            const err = new Error(getAiErrorMessage(response?.error));
            err.code = response?.error?.code || 'AI_ERROR';
            throw err;
        }
        return response.data;
    }

    function getAiErrorMessage(error) {
        const code = error?.code || 'AI_ERROR';
        if (code === 'AI_LOCKED') return 'Phiên AI đã khóa hoặc chưa cấu hình API Key. Vui lòng nhập PIN trong Aladinn.';
        if (code === 'AI_INVALID_API_KEY') return 'API Key không hợp lệ hoặc không có quyền gọi Gemini. Vui lòng kiểm tra lại trong Cài đặt.';
        if (code === 'AI_QUOTA_LIMIT') return 'Gemini đang giới hạn quota/rate limit. Vui lòng thử lại sau.';
        if (code === 'AI_NETWORK_ERROR') return 'Không kết nối được Gemini. Vui lòng kiểm tra mạng.';
        if (code === 'AI_EMPTY_RESPONSE') return 'Gemini không trả về nội dung hợp lệ. Vui lòng phân tích lại.';
        return error?.message || 'Lỗi AI không xác định.';
    }

    async function sha256Short(text) {
        const data = new TextEncoder().encode(text);
        const digest = await crypto.subtle.digest('SHA-256', data);
        return Array.from(new Uint8Array(digest)).slice(0, 12).map(b => b.toString(16).padStart(2, '0')).join('');
    }

    function storageLocalGet(keys) {
        return new Promise(resolve => chrome.storage.local.get(keys, resolve));
    }

    function storageLocalSet(value) {
        return new Promise(resolve => chrome.storage.local.set(value, resolve));
    }

    async function getAiCache(cacheKey) {
        try {
            const stored = await storageLocalGet(['aladinn_ai_result_cache']);
            return stored.aladinn_ai_result_cache?.[cacheKey] || null;
        } catch (_) {
            return null;
        }
    }

    async function setAiCache(cacheKey, value) {
        try {
            const stored = await storageLocalGet(['aladinn_ai_result_cache']);
            const cache = stored.aladinn_ai_result_cache || {};
            cache[cacheKey] = { ...value, savedAt: Date.now() };
            const entries = Object.entries(cache).sort((a, b) => (b[1].savedAt || 0) - (a[1].savedAt || 0)).slice(0, 30);
            await storageLocalSet({ aladinn_ai_result_cache: Object.fromEntries(entries) });
        } catch (_) { /* cache is best-effort */ }
    }

    async function removeAiCache(cacheKey) {
        try {
            const stored = await storageLocalGet(['aladinn_ai_result_cache']);
            const cache = stored.aladinn_ai_result_cache || {};
            if (!Object.prototype.hasOwnProperty.call(cache, cacheKey)) return;
            delete cache[cacheKey];
            await storageLocalSet({ aladinn_ai_result_cache: cache });
        } catch (_) { /* cache is best-effort */ }
    }

    window.Aladinn.Scanner.init = function () {
        if (Logger) Logger.info('Scanner.Init', 'Bắt đầu khởi tạo các module Scanner lõi...');

        try {
            // 1. Messaging Bridge Initialization
            if (window.VNPTMessaging) {
                window.VNPTMessaging.init(() => {
                    if (Logger) Logger.debug('Scanner.Init', 'Messaging Bridge Ready');
                });
            }

            // 2. Sub-module Initializations
            if (window.VNPTNotification) window.VNPTNotification.init();
            if (window.VNPTUI) window.VNPTUI.init();
            if (window.VNPTStore) window.VNPTStore.init();
            if (window.VNPTHistory) window.VNPTHistory.init();
            if (window.VNPTNutrition) window.VNPTNutrition.init();
            if (window.VNPTEmergency) window.VNPTEmergency.init();
            if (window.VNPTClinicalFill) window.VNPTClinicalFill.init();
            if (window.Aladinn?.Scanner?.QuickTimeEdit) window.Aladinn.Scanner.QuickTimeEdit.init();
            if (window.Aladinn?.Scanner?.SmartCAGuard) window.Aladinn.Scanner.SmartCAGuard.init();

            // 3. Shortcuts
            if (window.VNPTShortcuts) {
                window.VNPTShortcuts.register('scanRooms', () => startScanning('room'));
                window.VNPTShortcuts.register('scanVitals', () => startScanning('vitals'));
                window.VNPTShortcuts.register('scanDrugs', () => startScanning('drugs'));
                window.VNPTShortcuts.register('toggleDark', () => {
                    if (window.VNPTUI) window.VNPTUI.toggleDarkMode();
                });
                window.VNPTShortcuts.init();
            }

            // 4. Native Menu (Deprecated - Replaced by Popup UI)
            if (window.VNPTMenuManager && window.VNPTDashboard && window.VNPTScanFlow) {
                // We keep a dummy inject for now to satisfy old logic if any, but it won't do anything visible 
                // if we remove the actual DOM injection inside menu-manager.js
            }

            // Consistency Audit: Listen for global cache reset signal
            window.addEventListener('ALADINN_FORCE_RESET_CACHE', async () => {
                if (Logger) Logger.info('Scanner.Init', '🔄 Received ALADINN_FORCE_RESET_CACHE, clearing scanner caches...');
                try {
                    await storageLocalSet({ aladinn_ai_result_cache: {} });
                    if (window.Aladinn?.Scanner?.clearCache) {
                        window.Aladinn.Scanner.clearCache();
                    }
                } catch (e) {
                    if (Logger) Logger.error('Scanner.Init', 'Failed to clear cache on force reset:', e);
                }
            });

            // Standalone Ai Lab Summary function for Popup to call
            async function showAiLabSummary() {
                try {
                    const pid = window.VNPTStore?.get('selectedPatientId') || 'UNKNOWN';
                    if (pid === 'UNKNOWN') {
                        window.VNPTRealtime?.showToast('⚠️ Vui lòng chọn một bệnh nhân trên lưới trước.', 'warning');
                        return;
                    }
                    
                    window.VNPTRealtime?.showToast('🪄 Đang tải CLS + Thuốc từ VNPT HIS...', 'info');
                    
                    // Đề xuất 3: Generic bridge fetch helper — thay thế 6 hàm lặp
                    const bridgeFetch = (reqType, resType, rowId, extractFn, timeout = 10000, prefix = 'req') => {
                        return new Promise((resolve) => {
                            const requestId = prefix + '_' + Date.now().toString() + Math.random().toString().slice(2);
                            const token = window.__ALADINN_BRIDGE_TOKEN__ || '';
                            
                            const listener = (event) => {
                                if (event.data && event.data.type === resType && event.data.requestId === requestId) {
                                    window.removeEventListener('message', listener);
                                    resolve(extractFn(event.data));
                                }
                            };
                            window.addEventListener('message', listener);
                            
                            window.postMessage({
                                type: reqType,
                                rowId: rowId,
                                requestId: requestId,
                                token: token
                            }, window.location.origin);
                            
                            setTimeout(() => {
                                window.removeEventListener('message', listener);
                                resolve(extractFn({}));
                            }, timeout);
                        });
                    };

                    // Thin wrappers — mỗi hàm chỉ cần chỉ định types + cách extract data
                    const fetchLabsFromBridge = (rowId) => bridgeFetch(
                        'REQ_FETCH_LABS', 'FETCH_LABS_RESULT', rowId,
                        (d) => ({ labs: d.labsData || [], imaging: d.imagingData || [], patientName: d.patientName || '' }),
                        20000
                    );
                    const fetchDrugsFromBridge = (rowId) => bridgeFetch(
                        'REQ_FETCH_DRUGS_CLS', 'FETCH_DRUGS_CLS_RESULT', rowId,
                        (d) => ({ drugList: d.drugList || [] }),
                        15000, 'drugs'
                    );
                    const fetchHistoryFromBridge = (rowId) => bridgeFetch(
                        'REQ_FETCH_HISTORY', 'FETCH_HISTORY_RESULT', rowId,
                        (d) => d.history || {},
                        10000, 'hist'
                    );
                    const fetchTreatmentFromBridge = (rowId) => bridgeFetch(
                        'REQ_FETCH_TREATMENT', 'FETCH_TREATMENT_RESULT', rowId,
                        (d) => d || {},
                        10000, 'treat'
                    );
                    const fetchClinicalSummaryFromBridge = (rowId) => bridgeFetch(
                        'REQ_FETCH_CLINICAL_SUMMARY', 'FETCH_CLINICAL_SUMMARY_RESULT', rowId,
                        (d) => d,
                        10000, 'clin'
                    );
                    const fetchDemographicsFromBridge = (rowId) => bridgeFetch(
                        'REQ_FETCH_PATIENT_DEMOGRAPHICS', 'FETCH_PATIENT_DEMOGRAPHICS_RESULT', rowId,
                        (d) => d.demographics || null,
                        5000, 'demo'
                    );

                    const [result, drugsResult, historyData, treatmentResult, clinicalSummary, demographics] = await Promise.all([
                        fetchLabsFromBridge(pid),
                        fetchDrugsFromBridge(pid),
                        fetchHistoryFromBridge(pid),
                        fetchTreatmentFromBridge(pid),
                        fetchClinicalSummaryFromBridge(pid),
                        fetchDemographicsFromBridge(pid)
                    ]);
                    const labs = result?.labs || [];
                    const imaging = result?.imaging || [];
                    const drugs = drugsResult?.drugList || [];
                    const treatmentList = treatmentResult?.treatmentList || [];
                    const yLenhList = treatmentResult?.yLenhList || [];
                    
                    const storeName = window.VNPTStore?.get('selectedPatientName');
                    const patientName = storeName || result?.patientName || 'Bệnh Nhân';
                    
                    // Phase 1: API-first for age & diagnosis, DOM fallback
                    let age = demographics?.age || demographics?.dob || '';
                    let diagnosis = demographics?.diagnosis || '';
                    try {
                        if (!age || !diagnosis) {
                            const tr = document.getElementById(pid);
                            if (tr) {
                                if (!age) {
                                    const ageTd = tr.querySelector("td[aria-describedby$='_TUOI']") || tr.querySelector("td[aria-describedby$='_NAMSINH']");
                                    if (ageTd) age = ageTd.textContent.trim();
                                }
                                if (!diagnosis) {
                                    const diagTd = tr.querySelector("td[aria-describedby$='_CHANDOAN']");
                                    if (diagTd) diagnosis = diagTd.textContent.trim();
                                }
                            }
                        }
                    } catch (_e) {}

                    let diagHistory = [];
                    if (treatmentList && treatmentList.length > 0) {
                        // Extract all unique non-empty diagnoses from treatment list
                        treatmentList.forEach(t => {
                            let cd = t.CHANDOAN || '';
                            if (t.CHANDOANKEMTHEO) cd += ' (' + t.CHANDOANKEMTHEO + ')';
                            cd = cd.trim();
                            if (cd && cd !== '-' && cd !== '()' && !diagHistory.includes(cd)) {
                                diagHistory.push(cd);
                            }
                        });
                        
                        // Override current diagnosis with the latest sheet's diagnosis
                        if (diagHistory.length > 0) {
                            diagnosis = diagHistory[0];
                        }
                    }

                    // Fallback: Use HSBA diagnosis if treatment sheets had no diagnosis data
                    if (!diagnosis && historyData) {
                        if (historyData.CHANDOAN) {
                            diagnosis = historyData.CHANDOAN;
                            if (historyData.CHANDOAN_KEMTHEO) {
                                diagnosis += ' (' + historyData.CHANDOAN_KEMTHEO + ')';
                            }
                            // Put HSBA diagnosis as first entry in history
                            if (!diagHistory.includes(diagnosis)) {
                                diagHistory.unshift(diagnosis);
                            }
                        }
                    }

                    // Tối cao: Override bằng Clinical Summary chuẩn (loại bỏ CĐQT phải)
                    if (clinicalSummary && clinicalSummary.chanDoanMoiNhat) {
                        diagnosis = clinicalSummary.chanDoanMoiNhat;
                        if (!diagHistory.includes(diagnosis)) {
                            diagHistory.unshift(diagnosis);
                        }
                    }

                    const patientInfo = { 
                        age, 
                        diagnosis,
                        diagHistory,
                        // Phase 1: demographics từ API bridge (thay thế DOM reads cho gender, dob, etc.)
                        demographicsGender: demographics?.gender || '',
                        demographics: demographics || null,
                        clinicalData: {
                            history: historyData || {},
                            treatments: treatmentList || [],
                            yLenhList,
                            admissionTimes: clinicalSummary?.admissionTimes || {},
                            treatmentContext: treatmentResult?.treatmentContext || clinicalSummary?.treatmentContext || {}
                        }
                    };

                    // Phase 1: Cache demographics vào Store cho history.js và các module khác sử dụng
                    if (demographics) {
                        window.VNPTStore?.set('patientDemographics', demographics);
                    }

                    if (labs.length === 0 && imaging.length === 0 && drugs.length === 0 && (!historyData || Object.keys(historyData).length === 0)) {
                        window.VNPTRealtime?.showToast('⚠️ Không tìm thấy dữ liệu CLS / Thuốc / Bệnh án của bệnh nhân này.', 'warning');
                        return;
                    }

                    window.VNPTRealtime?.showToast('🪄 Đang vẽ biểu đồ...', 'info');
                    
                    if (typeof showLabTimelineModal === 'function') {
                        showLabTimelineModal(labs, imaging, drugs, patientName, patientInfo);
                    }
                    window.VNPTRealtime?.showToast('✅ Đã tải dữ liệu thành công!', 'success');
                } catch (err) {
                    console.error('[AI Lab] Lỗi:', err);
                    window.VNPTRealtime?.showToast('❌ Lỗi tạo tóm tắt: ' + (err.message || 'Lỗi không xác định'), 'warning');
                }
            }

            // 5. Patient Selection — subscribe to shared Event Bus
            if (HIS?.EventBus && window.VNPTStore) {
                HIS.EventBus.on('patient:selected', (data) => {
                    window.VNPTStore.actions.selectPatient(data.rowId);
                    if (data.patientName) {
                        window.VNPTStore.set('selectedPatientName', data.patientName);
                        _injectInlineSummaryBtn(data.rowElement, data.patientName);
                    }
                });

                HIS.EventBus.on('grid:ready', () => _injectQuickActionsDropdown());
                HIS.EventBus.on('grid:reloaded', () => _injectQuickActionsDropdown());
            }

            // Function to inject Quick Actions Dropdown in the grid column header
            function _injectQuickActionsDropdown() {
                setTimeout(() => {
                    // Target the exact column header ID provided for the icon column
                    const targetTh = document.getElementById('grdBenhNhan_ICON1');

                    if (!targetTh || document.getElementById('aladinn-quick-actions-btn')) return;

                    // Ensure targetTh is relatively positioned so our absolute container aligns correctly
                    if (window.getComputedStyle(targetTh).position === 'static') {
                        targetTh.style.position = 'relative';
                    }

                    const innerDiv = document.getElementById('jqgh_grdBenhNhan_ICON1') || targetTh.querySelector('div') || targetTh;

                    const container = document.createElement('div');
                    container.style.cssText = 'position:relative; display:inline-block; vertical-align:middle; z-index:99; text-align:center; width:100%;';

                    const btn = document.createElement('button');
                    btn.id = 'aladinn-quick-actions-btn';
                    btn.type = 'button';
                    btn.title = 'Tiện ích Aladinn';
                    btn.innerHTML = '<span style="font-size:14px; line-height:1;">🧞</span>';
                    btn.style.cssText = 'background:linear-gradient(135deg, rgba(212,162,90,0.15), rgba(212,162,90,0.05)); border:1px solid rgba(212,162,90,0.4); border-radius:6px; cursor:pointer; display:inline-flex; align-items:center; justify-content:center; padding:2px 6px; transition:all 0.2s; box-shadow:0 2px 4px rgba(0,0,0,0.1); outline:none; height:22px; width:28px; margin:0 auto;';
                    
                    btn.onmouseover = () => btn.style.background = 'rgba(212,162,90,0.25)';
                    btn.onmouseout = () => btn.style.background = 'linear-gradient(135deg, rgba(212,162,90,0.15), rgba(212,162,90,0.05))';

                    const dropdown = document.createElement('div');
                    dropdown.id = 'aladinn-quick-actions-menu';
                    dropdown.style.cssText = 'position:absolute; background:linear-gradient(135deg,#1a1510,#231c14); border:1px solid rgba(212,162,90,0.3); border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.5); display:none; flex-direction:column; min-width:180px; padding:6px 0; animation:vnpt-fade-in 0.15s ease-out; z-index: 999999;';

                    const items = [
                        { icon: '🖨️', text: 'Quét Buồng', action: () => window.Aladinn.Scanner.startScanning({mode: 'room'}) },
                        { icon: '📊', text: 'Bảng Điều Khiển & Thống kê', action: () => {
                            if (window.VNPTDashboard) window.VNPTDashboard.show();
                            else if (window.Aladinn?.Scanner?.UI?.Dashboard) window.Aladinn.Scanner.UI.Dashboard.show();
                        } }
                    ];

                    items.forEach(item => {
                        const opt = document.createElement('div');
                        opt.innerHTML = `<span style="margin-right:8px; font-size:14px;">${item.icon}</span> <span style="font-size:13px; font-weight:500;">${item.text}</span>`;
                        opt.style.cssText = 'padding:10px 16px; color:#d4a25a; cursor:pointer; display:flex; align-items:center; transition:background 0.2s; white-space:nowrap; text-align:left;';
                        opt.onmouseover = () => opt.style.background = 'rgba(212,162,90,0.1)';
                        opt.onmouseout = () => opt.style.background = 'transparent';
                        opt.onclick = (e) => {
                            e.stopPropagation();
                            dropdown.style.display = 'none';
                            item.action();
                        };
                        dropdown.appendChild(opt);
                    });

                    // Remove existing menu if present before appending
                    const existingMenu = document.getElementById('aladinn-quick-actions-menu');
                    if (existingMenu) existingMenu.remove();
                    document.body.appendChild(dropdown);

                    btn.onclick = (e) => {
                        e.stopPropagation();
                        e.preventDefault();
                        if (dropdown.style.display === 'none') {
                            const rect = btn.getBoundingClientRect();
                            dropdown.style.top = `${rect.bottom + 4 + window.scrollY}px`;
                            // Center the dropdown relative to the button (180px is the min-width)
                            let leftPos = rect.left + (rect.width / 2) - 90 + window.scrollX;
                            // Prevent going off-screen to the left
                            if (leftPos < 10) leftPos = 10;
                            dropdown.style.left = `${leftPos}px`;
                            dropdown.style.display = 'flex';
                        } else {
                            dropdown.style.display = 'none';
                        }
                    };

                    document.addEventListener('click', () => {
                        if (dropdown.style.display !== 'none') dropdown.style.display = 'none';
                    });
                    
                    // Stop column sorting/resizing when interacting with the elements
                    ['mousedown', 'mouseup', 'dblclick'].forEach(evt => {
                        btn.addEventListener(evt, e => e.stopPropagation());
                        dropdown.addEventListener(evt, e => e.stopPropagation());
                    });

                    container.appendChild(btn);

                    // Safely inject without destroying jqGrid sorting/resizing markup
                    innerDiv.appendChild(container);
                    targetTh.style.overflow = 'visible'; // Keep visible just in case
                    innerDiv.style.overflow = 'visible';
                }, 100);
            }

            // Function to inject a small summary button next to the patient's name
            function _injectInlineSummaryBtn(row, patientName) {
                if (!row || !patientName) return;

                // Wait slightly for jqGrid to finish its selection redraw
                setTimeout(() => {
                    // Remove old button if exists anywhere
                    document.querySelectorAll('.his-inline-summary-btn').forEach(btn => btn.remove());

                    // Find the cell containing the patient name
                    const cells = row.querySelectorAll('td');
                    let nameCell = null;
                    for (const cell of cells) {
                        const text = (cell.textContent || '').trim();
                        if (text === patientName || text.includes(patientName)) {
                            nameCell = cell;
                            break;
                        }
                    }

                    if (!nameCell) return;

                    // Ensure the cell can properly position float items if needed
                    // without changing its display type
                    nameCell.style.position = 'relative';

                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'his-inline-summary-btn';
                    btn.innerHTML = '<span class="his-inline-icon">✨</span>';
                    btn.title = 'Xem tóm tắt Cận lâm sàng & Thuốc (Aladinn)';

                    btn.addEventListener('click', async (e) => {
                        e.preventDefault(); // Prevent form submission
                        e.stopPropagation(); // Prevent row click event
                        btn.classList.add('loading');
                        btn.innerHTML = '<span class="his-spinner-inline"></span>';
                        
                        await showAiLabSummary();
                        
                        btn.classList.remove('loading');
                        btn.innerHTML = '<span class="his-inline-icon">✨</span>';
                    });

                    // Stop jqGrid from interpreting clicks on the button as row interactions
                    ['mousedown', 'mouseup', 'dblclick'].forEach(evt => {
                        btn.addEventListener(evt, e => e.stopPropagation());
                    });

                    nameCell.appendChild(btn);
                }, 50);
            }

            // Export to Aladinn namespace
            window.Aladinn.Scanner.startScanning = startScanning;
            window.Aladinn.Scanner.showAiLabSummary = showAiLabSummary;
            window.Aladinn.Scanner.clearCache = () => {
                if (window.VNPTStorage) window.VNPTStorage.clearResults();
                if (window.VNPTRealtime) window.VNPTRealtime.showToast('🗑️ Đã xóa cache', 'success');
            };
            window.Aladinn.Scanner.UI = window.VNPTUI || {};
            window.Aladinn.Scanner.Settings = window.VNPTSettings || {};

            if (Logger) Logger.success('Scanner.Init', 'Các module Scanner đã sẵn sàng!');

        } catch (err) {
            if (Logger) Logger.error('Scanner.Init', 'Critical error during Scanner module initialization:', err);
        }
    };

    // ========================================
    // BHYT TIME ERROR SCANNER (Live Report)
    // ========================================
    let _bhytScanResults = [];
    let _bhytRawKeys = null;

    function _parseBhytDate(str) {
        if (!str) return null;
        const parts = str.split(/[/\s:]/);
        if (parts.length >= 5) {
            return new Date(parts[2], parseInt(parts[1]) - 1, parts[0], parts[3], parts[4], parts[5] || 0);
        }
        return null;
    }

    function analyzeBhytTimeErrors(sheets) {
        const errors = [];
        for (const s of sheets) {
            const tCD = _parseBhytDate(s.tgChiDinh);
            const tTH = _parseBhytDate(s.tgThucHien);
            const tKQ = _parseBhytDate(s.tgKetQua);

            // Rule 1: Execution after result → error
            if (tTH && tKQ && tTH > tKQ) {
                errors.push({
                    id: s.id, tenDV: s.tenDV || 'Đường máu MM',
                    loi: `Thực hiện(${s.tgThucHien}) > Trả KQ(${s.tgKetQua})`,
                    loaiLoi: 'TH_GT_KQ', ketQua: s.ketQua
                });
            }
            // Rule 2: TG Chỉ định > TG Kết quả
            if (tCD && tKQ && tCD > tKQ) {
                errors.push({
                    id: s.id, tenDV: s.tenDV || 'Đường máu MM',
                    loi: `CĐ(${s.tgChiDinh}) > TGTRAKETQUA(${s.tgKetQua})`,
                    loaiLoi: 'CD_GT_KQ', ketQua: s.ketQua
                });
            }
            // Rule 3: TG Chỉ định > TG Thực hiện
            if (tCD && tTH && tCD > tTH) {
                errors.push({
                    id: s.id, tenDV: s.tenDV || 'Đường máu MM',
                    loi: `CĐ(${s.tgChiDinh}) > TGTHUCHIEN(${s.tgThucHien})`,
                    loaiLoi: 'CD_GT_TH', ketQua: s.ketQua
                });
            }
        }
        return errors;
    }

    // Open the live BHYT report modal immediately
    function openBhytLiveReport() {
        const existing = document.getElementById('aladinn-bhyt-report');
        if (existing) existing.remove();

        const overlay = document.createElement('div');
        overlay.id = 'aladinn-bhyt-report';
        overlay.innerHTML = `
            <style>
                #aladinn-bhyt-report {
                    position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                    background: rgba(0,0,0,0.6); z-index: 2147483646;
                    display: flex; align-items: center; justify-content: center;
                    animation: bhytFadeIn .25s ease;
                    font-family: 'Inter', 'Segoe UI', sans-serif;
                }
                @keyframes bhytFadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes bhytSlideUp { from { transform: translateY(20px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
                @keyframes bhytPulse { 0%,100% { opacity: 1; } 50% { opacity: .4; } }
                .bhyt-modal {
                    background: linear-gradient(145deg, #1a1510, #0f0d0a);
                    border: 1px solid rgba(212,162,90,0.3);
                    border-radius: 14px;
                    width: 720px; max-height: 82vh;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.6), 0 0 40px rgba(212,162,90,0.08);
                    animation: bhytSlideUp .3s ease;
                    display: flex; flex-direction: column;
                }
                .bhyt-header {
                    padding: 16px 22px;
                    border-bottom: 1px solid rgba(212,162,90,0.15);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .bhyt-title { font-size: 15px; font-weight: 700; color: #e8dcc8; display: flex; align-items: center; gap: 8px; }
                .bhyt-subtitle { font-size: 10px; color: #7a6e5e; margin-top: 2px; }
                .bhyt-scanning-dot { width: 8px; height: 8px; border-radius: 50%; background: #d4a25a; animation: bhytPulse 1s infinite; }
                .bhyt-scanning-dot.done { animation: none; background: #22c55e; }
                .bhyt-stats { display: flex; gap: 10px; }
                .bhyt-stat {
                    text-align: center; padding: 5px 10px;
                    background: rgba(212,162,90,0.08); border-radius: 8px; min-width: 50px;
                }
                .bhyt-stat-num { font-size: 20px; font-weight: 700; color: #d4a25a; line-height: 1; }
                .bhyt-stat-label { font-size: 8px; color: #7a6e5e; text-transform: uppercase; letter-spacing: 0.5px; }
                .bhyt-stat.error .bhyt-stat-num { color: #f87171; }
                .bhyt-body { padding: 0; overflow-y: auto; flex: 1; min-height: 100px; }
                .bhyt-row {
                    display: flex; align-items: flex-start; padding: 8px 22px; gap: 10px;
                    border-bottom: 1px solid rgba(212,162,90,0.06);
                    animation: bhytFadeIn .2s ease;
                }
                .bhyt-row:hover { background: rgba(212,162,90,0.04); }
                .bhyt-row-icon { flex-shrink: 0; font-size: 13px; margin-top: 1px; }
                .bhyt-row-name {
                    font-size: 12px; font-weight: 600; color: #e8dcc8; min-width: 140px;
                    cursor: pointer; flex-shrink: 0;
                }
                .bhyt-row-name:hover { color: #d4a25a; }
                .bhyt-row-detail { font-size: 11px; color: #7a6e5e; flex: 1; }
                .bhyt-row-sheets { font-size: 10px; color: #5a5040; }
                .bhyt-row-errors { margin-top: 3px; }
                .bhyt-err-line {
                    font-size: 10px; color: #f87171; display: flex; gap: 6px; padding: 1px 0;
                }
                .bhyt-err-dv { color: #d4a25a; min-width: 100px; }
                .bhyt-err-msg { color: #e8dcc8; font-family: 'Courier New', monospace; font-size: 10px; }
                .bhyt-raw-keys {
                    font-size: 10px; color: #5a5040; padding: 10px 22px;
                    border-top: 1px solid rgba(212,162,90,0.1);
                    max-height: 80px; overflow-y: auto;
                    word-break: break-all; line-height: 1.5;
                }
                .bhyt-raw-keys strong { color: #7a6e5e; }
                .bhyt-time-details { margin-top: 4px; }
                .bhyt-time-row {
                    display: flex; align-items: center; gap: 4px; padding: 2px 0;
                    font-size: 10px; flex-wrap: wrap;
                }
                .bhyt-time-dv {
                    color: #7a6e5e; min-width: 100px; font-size: 9px;
                    overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex-shrink: 0;
                }
                .bhyt-time-tag {
                    padding: 1px 5px; border-radius: 4px; font-family: 'Courier New', monospace;
                    font-size: 9px; white-space: nowrap;
                }
                .bhyt-time-tag.cd { background: rgba(96,165,250,0.15); color: #60a5fa; }
                .bhyt-time-tag.tn { background: rgba(168,152,128,0.15); color: #a89880; }
                .bhyt-time-tag.th { background: rgba(212,162,90,0.15); color: #d4a25a; }
                .bhyt-time-tag.kq { background: rgba(34,197,94,0.15); color: #22c55e; }
                .bhyt-time-arrow { color: #3a3530; font-size: 8px; }
                .bhyt-time-date { color: #4a4035; font-size: 8px; margin-left: 4px; }
                .bhyt-footer {
                    padding: 10px 22px;
                    border-top: 1px solid rgba(212,162,90,0.15);
                    display: flex; justify-content: space-between; align-items: center;
                }
                .bhyt-footer-info { font-size: 10px; color: #7a6e5e; }
                .bhyt-close {
                    background: none; border: 1px solid rgba(212,162,90,0.3);
                    color: #d4a25a; padding: 5px 14px; border-radius: 8px;
                    cursor: pointer; font-size: 11px; font-weight: 600; transition: all .15s;
                }
                .bhyt-close:hover { background: rgba(212,162,90,0.15); }
                .bhyt-empty-msg { padding: 30px; text-align: center; color: #5a5040; font-size: 12px; }
            </style>
            <div class="bhyt-modal">
                <div class="bhyt-header">
                    <div>
                        <div class="bhyt-title">
                            <div class="aladinn-wave-loader" id="bhyt-scan-dot" style="height:16px;gap:2px"><span style="width:3px"></span><span style="width:3px"></span><span style="width:3px"></span><span style="width:3px"></span><span style="width:3px"></span></div>
                            🛡️ Quét Lỗi Thời Gian BHYT
                        </div>
                        <div class="bhyt-subtitle" id="bhyt-status-text">Đang quét...</div>
                    </div>
                    <div style="display:flex;align-items:center;gap:10px">
                        <button class="bhyt-close" id="bhyt-toggle-compact" title="Thu gọn/Mở rộng chi tiết thời gian">👁️ Chi tiết</button>
                    <div class="bhyt-stats">
                        <div class="bhyt-stat">
                            <div class="bhyt-stat-num" id="bhyt-stat-total">0</div>
                            <div class="bhyt-stat-label">Đã quét</div>
                        </div>
                        <div class="bhyt-stat">
                            <div class="bhyt-stat-num" id="bhyt-stat-sheets">0</div>
                            <div class="bhyt-stat-label">Phiếu</div>
                        </div>
                        <div class="bhyt-stat error">
                            <div class="bhyt-stat-num" id="bhyt-stat-errors">0</div>
                            <div class="bhyt-stat-label">Lỗi</div>
                        </div>
                    </div>
                    </div>
                </div>
                <div class="bhyt-body" id="bhyt-body">
                    <div class="bhyt-empty-msg" id="bhyt-empty">⏳ Đang chuẩn bị quét...</div>
                </div>
                <div class="bhyt-raw-keys" id="bhyt-raw-keys" style="display:none">
                    <strong>📋 API Fields (Debug):</strong> <span id="bhyt-raw-keys-list"></span>
                </div>
                <div class="bhyt-footer">
                    <div class="bhyt-footer-info" id="bhyt-footer-info">Click tên BN để nhảy đến dòng tương ứng</div>
                    <button class="bhyt-close" id="bhyt-close-btn">Đóng</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);
        overlay.querySelector('#bhyt-close-btn').onclick = () => overlay.remove();
        overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

        // Toggle compact mode (show/hide time details)
        const toggleBtn = overlay.querySelector('#bhyt-toggle-compact');
        if (toggleBtn) {
            let isCompact = false;
            toggleBtn.onclick = () => {
                isCompact = !isCompact;
                toggleBtn.textContent = isCompact ? '👁️ Thu gọn' : '👁️ Chi tiết';
                const details = overlay.querySelectorAll('.bhyt-time-details');
                details.forEach(d => { d.style.display = isCompact ? 'none' : ''; });
            };
        }
    }

    // Add one patient result to the live modal
    function appendBhytResult(patientName, rowId, sheets, errors) {
        const body = document.getElementById('bhyt-body');
        if (!body) return;

        // Remove empty placeholder
        const empty = document.getElementById('bhyt-empty');
        if (empty) empty.remove();

        // Capture debug info from first result (2-level: sheet + detail)
        if (!_bhytRawKeys && sheets.length > 0) {
            const s = sheets[0];
            const debugParts = [];
            if (s._sheetRawKeys) debugParts.push('📋 Sheet fields: ' + s._sheetRawKeys.join(', '));
            if (s._detailRawKeys) debugParts.push('📋 Detail fields: ' + s._detailRawKeys.join(', '));
            if (s._sheetDateFields && Object.keys(s._sheetDateFields).length > 0) {
                debugParts.push('📅 Sheet dates: ' + Object.entries(s._sheetDateFields).map(([k,v]) => `${k}=${v}`).join(' | '));
            }
            if (s._detailDateFields && Object.keys(s._detailDateFields).length > 0) {
                debugParts.push('📅 Detail dates: ' + Object.entries(s._detailDateFields).map(([k,v]) => `${k}=${v}`).join(' | '));
            }

            // Dump ALL fields from first detail raw object
            if (s._detailRaw) {
                const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const allFields = Object.entries(s._detailRaw)
                    .filter(([, v]) => v !== null && v !== undefined && String(v).trim() !== '')
                    .map(([k, v]) => `<b>${escapeHtml(k)}</b>=${escapeHtml(String(v).substring(0, 40))}`)
                    .join(' | ');
                debugParts.push('🔍 Detail RAW (all non-empty): ' + allFields);
            }

            if (debugParts.length > 0) {
                _bhytRawKeys = debugParts;
                const keysEl = document.getElementById('bhyt-raw-keys');
                const listEl = document.getElementById('bhyt-raw-keys-list');
                if (keysEl && listEl) {
                    listEl.innerHTML = debugParts.join('<br><br>');
                    keysEl.style.display = '';
                }
            }

            // Log full raw objects
            if (s._detailRaw) console.log('[Aladinn BHYT] Detail raw sample:', s._detailRaw);
        }

        // Update stats
        const totalEl = document.getElementById('bhyt-stat-total');
        const sheetsEl = document.getElementById('bhyt-stat-sheets');
        const errorsEl = document.getElementById('bhyt-stat-errors');
        if (totalEl) totalEl.textContent = String(_bhytScanResults.length);
        if (sheetsEl) sheetsEl.textContent = String(parseInt(sheetsEl.textContent || '0') + sheets.length);
        if (errorsEl) errorsEl.textContent = String(parseInt(errorsEl.textContent || '0') + errors.length);

        // Helper: extract only time part HH:mm from date string "DD/MM/YYYY HH:mm:ss"
        const shortTime = (s) => {
            if (!s) return '—';
            const m = s.match(/(\d{2}:\d{2})/);
            return m ? m[1] : s.substring(0, 16);
        };
        const shortDate = (s) => {
            if (!s) return '';
            return s.substring(0, 10); // DD/MM/YYYY
        };

        // Build compact sheet timeline (show first 5 results + summary)
        const maxShow = 5;
        const sheetsToShow = sheets.slice(0, maxShow);
        const hasMore = sheets.length > maxShow;
        const timelineHtml = sheetsToShow.map(s => {
            const hasTime = s.tgChiDinh || s.tgThucHien || s.tgKetQua;
            if (!hasTime) return `<div class="bhyt-time-row"><span class="bhyt-time-dv">${(s.tenDV || '?').substring(0, 22)}</span><span style="color:#5a5040">— không có dữ liệu giờ —</span></div>`;
            return `<div class="bhyt-time-row">
                <span class="bhyt-time-dv">${(s.tenDV || '?').substring(0, 22)}</span>
                ${s.ketQua ? `<span style="color:#a89880;font-size:9px;margin-right:4px">[${s.ketQua}]</span>` : ''}
                <span class="bhyt-time-tag cd">CĐ ${shortTime(s.tgChiDinh)}</span>
                <span class="bhyt-time-arrow">→</span>
                <span class="bhyt-time-tag th">TH ${shortTime(s.tgThucHien)}</span>
                <span class="bhyt-time-arrow">→</span>
                <span class="bhyt-time-tag kq">KQ ${shortTime(s.tgKetQua)}</span>
                <span class="bhyt-time-date">${shortDate(s.tgChiDinh)}</span>
            </div>`;
        }).join('');

        // Build row HTML
        const icon = errors.length > 0 ? '❌' : '✅';
        const rowNum = _bhytScanResults.length;
        const row = document.createElement('div');
        row.className = 'bhyt-row';
        row.innerHTML = `
            <span class="bhyt-row-icon">${icon}</span>
            <div style="flex:1;min-width:0">
                <div style="display:flex;align-items:center;gap:8px">
                    <span class="bhyt-row-name" onclick="(function(){var tr=document.getElementById('${rowId}');if(tr){tr.scrollIntoView({behavior:'smooth',block:'center'});tr.click();}})()">${rowNum}. ${patientName || rowId}</span>
                    <span class="bhyt-row-sheets">${sheets.length} phiếu</span>
                    ${errors.length > 0 ? `<span style="background:rgba(239,68,68,0.2);color:#f87171;font-size:9px;font-weight:700;padding:1px 6px;border-radius:8px">${errors.length} lỗi</span>` : ''}
                </div>
                ${errors.length > 0 ? `
                    <div class="bhyt-row-errors">
                        ${errors.map(e => `
                            <div class="bhyt-err-line">
                                <span class="bhyt-err-dv">${(e.tenDV || '').substring(0, 25)}</span>
                                <span class="bhyt-err-msg">${e.loi}</span>
                            </div>
                        `).join('')}
                    </div>
                ` : ''}
                <div class="bhyt-time-details">
                    ${timelineHtml}
                    ${hasMore ? `<div style="font-size:9px;color:#5a5040;padding:2px 0">... và ${sheets.length - maxShow} phiếu khác</div>` : ''}
                </div>
            </div>
        `;
        body.appendChild(row);

        // Auto-scroll to latest result
        body.scrollTop = body.scrollHeight;
    }

    // Finalize the report modal
    function finalizeBhytReport() {
        const dot = document.getElementById('bhyt-scan-dot');
        if (dot) { dot.innerHTML = '✅'; dot.className = ''; dot.style.cssText = 'font-size:14px;'; }

        const totalErrors = _bhytScanResults.reduce((s, r) => s + r.errors.length, 0);
        const statusEl = document.getElementById('bhyt-status-text');
        if (statusEl) {
            statusEl.textContent = totalErrors > 0
                ? `Hoàn tất — ${totalErrors} lỗi ở ${_bhytScanResults.filter(r => r.errors.length > 0).length} BN`
                : `Hoàn tất — Tất cả ${_bhytScanResults.length} BN đều hợp lệ ✓`;
            statusEl.style.color = totalErrors > 0 ? '#f87171' : '#22c55e';
        }

        const footerInfo = document.getElementById('bhyt-footer-info');
        if (footerInfo) footerInfo.textContent = `Quét xong ${_bhytScanResults.length} BN • ${new Date().toLocaleTimeString('vi-VN')}`;
    }

    // ========================================
    // SCANNING ORCHESTRATION
    // ========================================
    async function startScanning(params) {
        let mode = params;
        let singleRow = false;
        if (typeof params === 'object') {
            mode = params.mode;
            singleRow = params.singleRow || false;
        }

        if (!window.VNPTScanFlow) return;
        if (window.VNPTScanFlow.isScanning()) return;

        if (mode === 'bhyt') {
            _bhytScanResults = [];
            _bhytRawKeys = null;
            openBhytLiveReport();
        }

        window.VNPTScanFlow.start(mode, {
            singleRow: singleRow,
            onStart: (m) => {
                if (window.VNPTMenuManager) window.VNPTMenuManager.toggleStopButton(true);
                if (m !== 'bhyt' && window.VNPTRealtime) window.VNPTRealtime.showToast(`🚀 Bắt đầu quét ${m}...`, 'info');
            },
            onProgress: (count, total) => {
                const percent = Math.round((count / total) * 100);
                if (window.VNPTMenuManager) window.VNPTMenuManager.updateProgress(percent);
                if (window.VNPTUI) window.VNPTUI.updateProgress(count, total);
                // Update BHYT live modal status
                if (mode === 'bhyt') {
                    const statusEl = document.getElementById('bhyt-status-text');
                    if (statusEl) statusEl.textContent = `Đang quét BN ${count}/${total}...`;
                }
            },
            onRoomFound: (tr, text) => injectRoomText(tr, text, true),
            onDrugsFound: (tr, drugs) => {
                if (!drugs || drugs.length === 0) return;
                console.log(`[Aladinn Scanner] Row ${tr.id} - Thấy ${drugs.length} loại thuốc:`, drugs);
                const tdVal = new Date();
                const todayStr = String(tdVal.getDate()).padStart(2, '0') + '/' + String(tdVal.getMonth() + 1).padStart(2, '0') + '/' + tdVal.getFullYear();
                
                const hasToday = drugs.some((/** @type {any} */ d) => d.NGAYMAUBENHPHAM_SUDUNG.includes(todayStr));
                if (hasToday) {
                    injectDrugsBadge(tr);
                }
            },
            onPtttFound: (tr, ptttList) => {
                if (!ptttList || ptttList.length === 0) return;
                injectPtttBadge(tr, ptttList.length);
            },
            onBhytFound: (tr, sheets, patientName) => {
                const errors = analyzeBhytTimeErrors(sheets);
                _bhytScanResults.push({ tr, patientName, sheets, errors });
                injectBhytBadge(tr, errors.length, errors);
                appendBhytResult(patientName, tr.id, sheets, errors);
            },
            onComplete: (m, stats) => {
                if (window.VNPTMenuManager) {
                    window.VNPTMenuManager.toggleStopButton(false);
                    window.VNPTMenuManager.updateProgress(100, true);
                }
                if (m === 'bhyt') {
                    finalizeBhytReport();
                } else {
                    if (window.VNPTRealtime) window.VNPTRealtime.showToast(`✅ Quét ${m} hoàn tất!`, 'success');
                }
                if (m === 'room' && window.VNPTStore) window.VNPTStore.actions.endScan({}, stats);
            }
        });
    }

    // ========================================
    // UI HELPERS
    // ========================================
    function injectRoomText(tr, text, isReal) {
        const bedTd = tr.querySelector("td[aria-describedby$='_ICON1']");
        if (!bedTd) return;

        let container = bedTd.querySelector('.aladinn-scan-room-info-display');
        if (!container) {
            // Also check old class for backward compatibility during transition
            container = bedTd.querySelector('.room-info-display');
            if (!container) {
                container = document.createElement('div');
                container.className = 'aladinn-scan-room-info-display';
                const centerTag = bedTd.querySelector('center');
                if (centerTag) centerTag.appendChild(container);
                else bedTd.appendChild(container);
            } else {
                container.className = 'aladinn-scan-room-info-display'; // Upgrade class
            }
        }
        container.textContent = text;
        if (isReal) bedTd.classList.add('aladinn-scan-has-real-name');
    }

    function injectDrugsBadge(tr) {
        let nameTd = tr.querySelector("td[aria-describedby$='_TENBENHNHAN']");
        if (!nameTd) nameTd = tr.querySelector("td[aria-describedby*='TENBENHNHAN']");
        if (!nameTd) return;

        let badge = nameTd.querySelector('.aladinn-scan-drugs-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'aladinn-scan-drugs-badge';
            badge.innerHTML = '💊';
            badge.title = 'Đã có thuốc ngày hôm nay';
            badge.style.cssText = 'font-size: 14px; display: inline-block; margin-left: 6px; vertical-align: text-top; filter: drop-shadow(0 0 2px rgba(255,255,255,0.8));';
            nameTd.appendChild(badge);
        }
    }

    function injectPtttBadge(tr, count) {
        let nameTd = tr.querySelector("td[aria-describedby$='_TENBENHNHAN']");
        if (!nameTd) nameTd = tr.querySelector("td[aria-describedby*='TENBENHNHAN']");
        if (!nameTd) return;

        let badge = nameTd.querySelector('.aladinn-scan-pttt-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'aladinn-scan-pttt-badge';
            badge.innerHTML = '🪡';
            badge.title = `Có ${count} phiếu PTTT (Click để in chứng nhận)`;
            badge.style.cssText = 'font-size: 14px; display: inline-block; margin-left: 4px; vertical-align: text-top; filter: drop-shadow(0 0 2px rgba(255,255,255,0.8)); cursor: pointer; transform-origin: bottom center; transition: transform 0.2s;';
            
            // Add click listener
            badge.addEventListener('click', (_e) => {
                // Let the click propagate to select the row
                // Then trigger the PTTT print action via messaging
                window.postMessage({
                    type: 'TRIGGER_PTTT_PRINT',
                    rowId: tr.id,
                    token: window.__ALADINN_BRIDGE_TOKEN__
                }, window.location.origin);
                
                // Add a small animation 
                badge.style.transform = 'scale(1.2) rotate(15deg)';
                setTimeout(() => badge.style.transform = '', 200);
            });
            
            nameTd.appendChild(badge);
        } else {
            badge.title = `Có ${count} phiếu PTTT (Click để in chứng nhận)`;
        }
    }

    function injectBhytBadge(tr, count, errors = []) {
        let nameTd = tr.querySelector("td[aria-describedby$='_TENBENHNHAN']");
        if (!nameTd) nameTd = tr.querySelector("td[aria-describedby*='TENBENHNHAN']");
        if (!nameTd) return;

        let badge = nameTd.querySelector('.aladinn-scan-bhyt-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'aladinn-scan-bhyt-badge';
            nameTd.appendChild(badge);
        }

        if (count > 0) {
            badge.innerHTML = `🛡️<sup style="font-size:9px;color:#f87171;font-weight:700">${count}</sup>`;
            badge.style.cssText = 'font-size:14px;display:inline-block;margin-left:6px;vertical-align:text-top;cursor:help;';
            const errorText = errors.map(e => `• ${e.tenDV}: ${e.loi}`).join('\n');
            badge.title = `Phát hiện ${count} lỗi thời gian BHYT:\n${errorText}`;
            tr.style.backgroundColor = 'rgba(239, 68, 68, 0.1)';
        } else {
            badge.innerHTML = '✅';
            badge.style.cssText = 'font-size:14px;display:inline-block;margin-left:6px;vertical-align:text-top;filter:grayscale(100%);opacity:0.5;';
            badge.title = 'Thời gian BHYT hợp lệ';
            tr.style.backgroundColor = '';
        }
    }

    function _parseLabDate(dStr) {
        if (!dStr) return 0;
        const parts = dStr.split(/[/\s:]/);
        if (parts.length >= 3) return new Date(parts[2], parts[1]-1, parts[0], parts[3]||0, parts[4]||0, parts[5]||0).getTime();
        return 0;
    }

    function _shortDate(d) { return d && d.includes(' ') ? d.split(' ')[0] : d; }

    function _isAbnormal(status) {
        if (!status) return false;
        const s = status.toLowerCase();
        return s.includes('cao') || s.includes('thấp') || s.includes('high') || s.includes('low') || s.includes('tăng') || s.includes('giảm');
    }

    function _statusColor(status) {
        if (!status) return null;
        const s = status.toLowerCase();
        if (s.includes('cao') || s.includes('high') || s.includes('tăng')) return { bg: 'rgba(239,68,68,0.15)', text: '#f87171', icon: '▲' };
        if (s.includes('thấp') || s.includes('low') || s.includes('giảm')) return { bg: 'rgba(59,130,246,0.15)', text: '#60a5fa', icon: '▼' };
        return null;
    }

    // Clinical category mapping
    const LAB_CATEGORIES = {
        'Huyết học': [
            'WBC','NEU','NEU%','RBC','HGB','HCT','PLT','MCV','MCH','MCHC',
            'RDW','RDW-CV','RDW-SD','MPV','PDW','PDW-SD','PCT',
            'LYM','LYM%','MONO','MONO%','EOS','EOS%','BASO','BASO%',
            'P-LCR','NLR',
            'PT','PT%','PT INR','APTT','APTT ratio','Fibrinogen','INR','TT','D-Dimer',
            'ABO','Rh'
        ],
        'Nước tiểu': [
            'SG','pH','LEU','BLD','NIT','PRO','UBG',
            'GLU niệu','BIL niệu','KET niệu',
            'Protein niệu','Glucose niệu','Hồng cầu niệu','Bạch cầu niệu',
            'Nitrit','Ketone','Bilirubin niệu','Urobilinogen','Tỷ trọng'
        ],
        'Sinh hóa': [
            'Glucose','Ure','Creatinin','eGFR','AST','ALT','GPT','GOT','GGT',
            'Bilirubin','Protein','Albumin','CRP','LDH','CK','Amylase','Lipase',
            'Acid Uric','Cholesterol','Triglycerid','HDL','LDL','HbA1c',
            'Cortisol','Procalcitonin','Troponin','BNP','NT-proBNP',
            'Na','K','Cl','Ca','Mg','Phospho'
        ]
    };

    // Urine-specific short codes — distinguish from biochem (GLU, BIL, KET, PRO)
    const URINE_CODES = new Set(['SG','LEU','BLD','NIT','UBG']);
    // These short codes overlap — must check testName for "nước tiểu" context
    const AMBIGUOUS_URINE = new Set(['GLU','BIL','KET','PRO']);

    function _classifyLab(code, testName, value) {
        const cUp = (code || '').toUpperCase().trim();
        const tUp = (testName || '').toUpperCase();
        const vUp = (value || '').toUpperCase().trim();
        const combined = cUp + ' ' + tUp;

        // 1. Explicit urine short codes
        if (URINE_CODES.has(cUp)) return 'Nước tiểu';

        // 2. Ambiguous codes — decide by test name context OR result value pattern
        if (AMBIGUOUS_URINE.has(cUp)) {
            // 2a. testName chứa keyword nước tiểu
            if (tUp.includes('NƯỚC TIỂU') || tUp.includes('NIỆU') || tUp.includes('URIN')
                || tUp.includes('TỔNG PHÂN TÍCH') || tUp.includes('10 THÔNG SỐ')
                || tUp.includes('DIPSTICK')) return 'Nước tiểu';
            // 2b. Giá trị định tính (chỉ nước tiểu mới có)
            //     Mở rộng: SMALL, LARGE, MODERATE, TRACE, 1+ 2+ 3+ 4+, ÂM TÍNH, DƯƠNG TÍNH
            if (vUp && /^(ÂM TÍNH|DƯƠNG TÍNH|TRACE|SMALL|LARGE|MODERATE|NEGATIVE|POSITIVE|NEG|POS|NORMAL|\d*\+{1,4})$/i.test(vUp)) return 'Nước tiểu';
            // 2c. testName không chứa suffix máu/huyết/serum → hầu hết là dipstick nước tiểu
            //     Ví dụ HIS trả code="PRO" testName="PRO" (≤5 ký tự, không có từ máu)
            if (!tUp.includes('MÁU') && !tUp.includes('HUYẾT') && !tUp.includes('PLASMA') && !tUp.includes('SERUM')) {
                if (tUp.trim() === cUp || tUp.trim().length <= 5) return 'Nước tiểu';
            }
            return 'Sinh hóa';
        }

        // 3. Vietnamese keyword matching
        if (combined.includes('NƯỚC TIỂU') || combined.includes('NIỆU') || combined.includes('URIN')) return 'Nước tiểu';
        if (combined.includes('HUYẾT ĐỒ') || combined.includes('TẾ BÀO MÁU') || combined.includes('CÔNG THỨC MÁU') ||
            combined.includes('ĐÔNG MÁU') || combined.includes('NHÓM MÁU') || combined.includes('HUYẾT HỌC')) return 'Huyết học';
        if (combined.includes('SINH HÓA') || combined.includes('HÓA SINH') || combined.includes('HOẠT ĐỘ') ||
            combined.includes('ĐỊNH LƯỢNG') || combined.includes('ĐỘ LỌC') || combined.includes('ĐIỆN GIẢI')) return 'Sinh hóa';

        // 4. Keyword list matching
        for (const [cat, keywords] of Object.entries(LAB_CATEGORIES)) {
            for (const kw of keywords) {
                const kwU = kw.toUpperCase();
                if (/^[A-Z0-9%-]+$/.test(kwU)) {
                    if (new RegExp(`\\b${kwU.replace('%','\\%')}\\b`).test(combined)) return cat;
                } else {
                    if (combined.includes(kwU)) return cat;
                }
            }
        }
        return 'Sinh hóa';
    }

    function showLabTimelineModal(labs, imaging, drugs, patientName = 'Bệnh Nhân', patientInfo = {}) {
        const existing = document.getElementById('vnpt-lab-timeline-modal');
        if (existing) existing.remove();
        const imgList = imaging || [];

        // ─── Helper: Lấy PACS URL qua bridge (getHashRIS trong HIS tab) ───
        function _fetchPacsUrlFromBridge(pacsConfig) {
            return new Promise((resolve) => {
                const requestId = 'pacs_' + Date.now() + Math.random().toString(36).slice(2);
                const listener = (event) => {
                    if (event.data && event.data.type === 'PACS_URL_RESULT' && event.data.requestId === requestId) {
                        window.removeEventListener('message', listener);
                        resolve(event.data.pacsUrl || null);
                    }
                };
                window.addEventListener('message', listener);
                window.postMessage({
                    type: 'REQ_PACS_URL',
                    sheetId: String(pacsConfig.sheetId || pacsConfig),
                    pacsConfig: typeof pacsConfig === 'object' ? pacsConfig : null,
                    requestId,
                    token: window.__ALADINN_BRIDGE_TOKEN__
                }, window.location.origin);
                setTimeout(() => { window.removeEventListener('message', listener); resolve(null); }, 12000);
            });
        }

        // --- Data Processing with Clinical Grouping ---
        const datesSet = new Set();
        const grouped = {};
        const abnormals = [];

        for (const l of labs) {
            if (!l.sheetDate) continue;
            datesSet.add(l.sheetDate);
            const cat = _classifyLab(l.code || '', l.testName || '', l.value || '');
            const cName = l.code || '—';
            if (!grouped[cat]) grouped[cat] = {};
            if (!grouped[cat][cName]) grouped[cat][cName] = { unit: l.unit, refMin: l.refMin, refMax: l.refMax, refDisplay: l.refDisplay, values: {} };
            grouped[cat][cName].values[l.sheetDate] = { value: l.value, status: l.status };
            if (_isAbnormal(l.status)) abnormals.push(l);
        }

        const sortedDates = Array.from(datesSet).sort((a, b) => _parseLabDate(a) - _parseLabDate(b));
        const totalIndicators = Object.values(grouped).reduce((s, g) => s + Object.keys(g).length, 0);
        const latestDate = sortedDates.length > 0 ? _shortDate(sortedDates[sortedDates.length - 1]) : '—';
        const firstDate = sortedDates.length > 0 ? _shortDate(sortedDates[0]) : '—';

        // Category display order & Grouping into Master Categories
        const catOrder = ['Huyết học (Tế bào máu)', 'Huyết học (Đông máu)', 'Huyết học (Nhóm máu)', 'Sinh hóa', 'Nước tiểu'];
        // Category display order — merge all Huyết học sub-groups into 'Huyết học'
        const masterGrouped = {};
        for (const cat of Object.keys(grouped)) {
            const mCat = cat.startsWith('Huyết học') ? 'Huyết học' : cat;
            if (!masterGrouped[mCat]) masterGrouped[mCat] = {};
            masterGrouped[mCat][cat] = grouped[cat];
        }

        const mCatOrder = ['Huyết học', 'Sinh hóa', 'Nước tiểu'];
        const sortedMCats = Object.keys(masterGrouped).sort((a,b) => mCatOrder.indexOf(a) === -1 ? 1 : mCatOrder.indexOf(b) === -1 ? -1 : mCatOrder.indexOf(a) - mCatOrder.indexOf(b));
        const catIcons = { 'Huyết học':'🩸', 'Sinh hóa':'🧪', 'Nước tiểu':'💧' };

        // --- Summary Cards ---
        const summaryCards = `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:16px;">
          <div style="background:rgba(212,162,90,0.1); border:1px solid rgba(212,162,90,0.25); border-radius:10px; padding:12px;">
            <div style="font-size:12px; color:#a18764; text-transform:uppercase; letter-spacing:1px; font-weight:700;">🧪 Tổng chỉ số</div>
            <div style="font-size:26.4px; font-weight:800; color:#d4a25a; margin-top:4px;">${totalIndicators}</div>
            <div style="font-size:12px; color:#7a6e5e; margin-top:2px;">${sortedMCats.length} nhóm XN</div>
          </div>
          <div style="background:${abnormals.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}; border:1px solid ${abnormals.length > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}; border-radius:10px; padding:12px;">
            <div style="font-size:12px; color:${abnormals.length > 0 ? '#f87171' : '#6ee7a0'}; text-transform:uppercase; letter-spacing:1px; font-weight:700;">⚠️ Bất thường</div>
            <div style="font-size:26.4px; font-weight:800; color:${abnormals.length > 0 ? '#f87171' : '#22c55e'}; margin-top:4px;">${abnormals.length}</div>
            <div style="font-size:12px; color:#7a6e5e; margin-top:2px;">${abnormals.length > 0 ? 'Cần lưu ý' : 'Tất cả bình thường'}</div>
          </div>
          <div style="background:rgba(212,162,90,0.1); border:1px solid rgba(212,162,90,0.25); border-radius:10px; padding:12px;">
            <div style="font-size:12px; color:#a18764; text-transform:uppercase; letter-spacing:1px; font-weight:700;">📅 Ngày XN</div>
            <div style="font-size:26.4px; font-weight:800; color:#d4a25a; margin-top:4px;">${sortedDates.length}</div>
            <div style="font-size:12px; color:#7a6e5e; margin-top:2px;">${firstDate} → ${latestDate}</div>
          </div>
        </div>`;

        // --- Abnormal Alerts ---
        let alertsHtml = '';
        if (abnormals.length > 0) {
            const uniqueAbn = {};
            for (const a of abnormals) {
                const key = a.code || a.testName;
                if (!uniqueAbn[key] || _parseLabDate(a.sheetDate) > _parseLabDate(uniqueAbn[key].sheetDate)) uniqueAbn[key] = a;
            }
            const abnItems = Object.values(uniqueAbn);
            alertsHtml = `<div style="background:rgba(239,68,68,0.08); border:1px solid rgba(239,68,68,0.2); border-radius:10px; padding:12px 14px; margin-bottom:16px;">
              <div style="font-size:13.2px; font-weight:700; color:#f87171; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">🔴 Chỉ số bất thường mới nhất</div>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${abnItems.map(a => {
                    const sc = _statusColor(a.status);
                    return `<span style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:6px; font-size:14.4px; font-weight:600; background:${sc ? sc.bg : 'rgba(239,68,68,0.15)'}; color:${sc ? sc.text : '#f87171'}; border:1px solid ${sc ? sc.text + '33' : 'rgba(239,68,68,0.3)'};">${a.code || a.testName}: ${a.value} ${a.unit || ''} ${sc ? sc.icon : ''}</span>`;
                }).join('')}
              </div>
            </div>`;
        }

        // --- Grouped Tables by Clinical Category ---
        let tablesHtml = '';
        for (const mCat of sortedMCats) {
            const subCats = masterGrouped[mCat];
            const subCatKeys = Object.keys(subCats).sort((a,b) => catOrder.indexOf(a) - catOrder.indexOf(b));
            if (subCatKeys.length === 0) continue;

            let mIndicatorsCount = 0;
            let mHasAbn = false;
            let mRowsHtml = '';

            for (const subCat of subCatKeys) {
                const indicators = subCats[subCat];
                const indicatorCount = Object.keys(indicators).length;
                if (indicatorCount === 0) continue;

                mIndicatorsCount += indicatorCount;
                if (Object.values(indicators).some(d => Object.values(d.values).some(v => _isAbnormal(v.status)))) {
                    mHasAbn = true;
                }

                // Sub-category header for "Huyết học" to distinguish Tế bào máu, Đông máu, Nhóm máu
                if (mCat === 'Huyết học' && subCat !== 'Huyết học') {
                     const subName = subCat.replace('Huyết học (', '').replace(')', '');
                     mRowsHtml += `<tr><td colspan="${sortedDates.length + 2}" style="padding:5px 10px; background:rgba(212,162,90,0.1); color:#d4a25a; font-weight:700; font-size:12px; text-transform:uppercase; letter-spacing:1px; border-top:1px solid rgba(212,162,90,0.15); border-bottom:1px solid rgba(212,162,90,0.15); position:sticky; left:0; z-index:2;">▪ ${subName}</td></tr>`;
                }

                const sortedIndicators = Object.entries(indicators).sort((a, b) => {
                    const arr = LAB_CATEGORIES[subCat] || [];
                    const getIndex = (name) => {
                        const up = name.toUpperCase();
                        const idx = arr.findIndex(kw => {
                            const kwUpper = kw.toUpperCase();
                            if (/^[A-Z0-9]+$/.test(kwUpper)) return new RegExp(`\\b${kwUpper}\\b`).test(up);
                            return up.includes(kwUpper);
                        });
                        return idx === -1 ? 999 : idx;
                    };
                    return getIndex(a[0]) - getIndex(b[0]);
                });

                let rowIdx = 0;
                for (const [cName, data] of sortedIndicators) {
                    const rowBg = rowIdx % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)';
                    const rowHasAbn = Object.values(data.values).some(v => _isAbnormal(v.status));
                    const leftBorder = rowHasAbn ? 'border-left:3px solid #f87171;' : 'border-left:3px solid transparent;';
                    
                    let refText = data.refDisplay || '';
                    if (!refText && (data.refMin || data.refMax)) {
                        refText = `${data.refMin || ''}–${data.refMax || ''}`;
                    }
                    if (data.unit && !refText.includes(data.unit)) {
                        refText = refText ? `${refText} ${data.unit}` : data.unit;
                    }

                    // HIS data for Urine 10 parameters is often corrupted (e.g., '84 - 00' instead of '0.84'). Normalizing here.
                    if (mCat.toLowerCase().includes('nước tiểu')) {
                        const uCode = cName.toUpperCase();
                        if (uCode === 'GLU') refText = '0 - 0.84 mmol/L';
                        if (uCode === 'BIL') refText = '0 - 3.4 µmol/L';
                        if (uCode === 'KET') refText = '0 - 5 mmol/L';
                        if (uCode === 'SG') refText = '1.015 - 1.025';
                        if (uCode === 'BLD') refText = '0 - 5 RBC/µL';
                        if (uCode === 'PH') refText = '4.8 - 7.4';
                        if (uCode === 'PRO') refText = '0 - 0.1 g/L';
                        if (uCode === 'UBG') refText = '0 - 16.9 µmol/L';
                        if (uCode === 'NIT') refText = 'Âm tính';
                        if (uCode === 'LEU') refText = '0 - 10 WBC/µL';
                    }
                    
                    const stickyBg = rowBg === 'transparent' ? '#1a1510' : '#1e1913';

                    mRowsHtml += `<tr style="background:${rowBg}; ${leftBorder}">`;
                    mRowsHtml += `<td style="padding:6px 10px; color:#e8dcc8; font-weight:${rowHasAbn ? '600' : '400'}; white-space:nowrap; position:sticky; left:0; background:${stickyBg}; z-index:1;">${cName}</td>`;
                    mRowsHtml += `<td style="padding:6px 8px; color:#7a6e5e; font-size:12px; white-space:nowrap; background:${stickyBg};">${refText}</td>`;

                    for (const d of sortedDates) {
                        const cell = data.values[d];
                        if (cell) {
                            const sc = _statusColor(cell.status);
                            let arrow = '';
                            if (sc && sc.icon) arrow = ` <span style="color:${sc.text};font-size:12px;font-weight:700;">${sc.icon}</span>`;
                            const cellBg = sc ? sc.bg : '#1a1510';
                            const cellColor = sc ? sc.text : '#e8dcc8';
                            const fw = sc ? '700' : '400';
                            mRowsHtml += `<td style="padding:6px 8px; text-align:right; white-space:nowrap; background:${cellBg} !important; color:${cellColor} !important; font-weight:${fw}; border-radius:4px;">${cell.value}${arrow}</td>`;
                        } else {
                            mRowsHtml += '<td style="padding:6px 8px; text-align:right; color:#3d3529; background:#1a1510 !important;">·</td>';
                        }
                    }
                    mRowsHtml += '</tr>';
                    rowIdx++;
                }
            }

            if (mIndicatorsCount > 0) {
                const icon = catIcons[mCat] || '📋';
                tablesHtml += '<div style="margin-bottom:14px; border:1px solid rgba(212,162,90,0.2); border-radius:10px; overflow:hidden;">';
                tablesHtml += `<div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:rgba(212,162,90,0.08); border-bottom:1px solid rgba(212,162,90,0.15);">
                  <span style="font-size:16.8px;">${icon}</span>
                  <span style="font-size:15.6px; font-weight:700; color:#d4a25a;">${mCat}</span>
                  <span style="font-size:12px; color:#a18764; background:rgba(212,162,90,0.15); padding:2px 8px; border-radius:10px;">${mIndicatorsCount} chỉ số</span>
                  ${mHasAbn ? '<span style="font-size:12px; color:#f87171; background:rgba(239,68,68,0.15); padding:2px 8px; border-radius:10px;">⚠ Bất thường</span>' : ''}
                </div>`;
                
                tablesHtml += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:14.4px;">';
                tablesHtml += `<thead><tr>
                  <th style="padding:7px 10px; text-align:left; background:rgba(0,0,0,0.2); color:#a0937e; font-size:12px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; position:sticky; left:0; z-index:2;">Chỉ số</th>
                  <th style="padding:7px 10px; text-align:left; background:rgba(0,0,0,0.2); color:#7a6e5e; font-size:12px; font-weight:600; position:sticky; left:0; z-index:2;">Ref</th>`;
                for (const d of sortedDates) {
                    tablesHtml += `<th style="padding:7px 8px; text-align:right; background:rgba(0,0,0,0.2); color:#a0937e; font-size:12px; font-weight:600; white-space:nowrap;">${_shortDate(d)}</th>`;
                }
                tablesHtml += '</tr></thead><tbody>';
                tablesHtml += mRowsHtml;
                tablesHtml += '</tbody></table></div></div>';
            }
        }

        // --- CĐHA Section ---
        let cdhaHtml = '';
        if (imgList.length > 0) {
            cdhaHtml = `<div style="margin-bottom:14px; border:1px solid rgba(96,165,250,0.25); border-radius:10px; overflow:hidden;">
              <div style="display:flex; align-items:center; gap:8px; padding:10px 14px; background:rgba(96,165,250,0.08); border-bottom:1px solid rgba(96,165,250,0.15);">
                <span style="font-size:16.8px;">🩻</span>
                <span style="font-size:15.6px; font-weight:700; color:#60a5fa;">Chẩn đoán hình ảnh</span>
                <span style="font-size:12px; color:#6b8ab5; background:rgba(96,165,250,0.15); padding:2px 8px; border-radius:10px;">${imgList.length} phiếu</span>
              </div>
              <div style="padding:8px 14px;">
                ${imgList.map(img => {
                    const statusColor = (img.status || '').includes('Đang') ? '#fbbf24' : '#22c55e';
                    const conclusionHtml = img.conclusion ? `<div style="color:#c8b89a; font-size:13.2px; margin-top:6px; padding:6px 10px; background:rgba(212,162,90,0.06); border-left:2px solid rgba(96,165,250,0.4); border-radius:0 6px 6px 0; line-height:1.5;">${img.conclusion}</div>` : '';
                    return `<div style="padding:10px 0; border-bottom:1px solid rgba(96,165,250,0.08);">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1;">
                          <div style="color:#e8dcc8; font-size:15.6px; font-weight:600;">${img.name || 'CĐHA'} ${img.code ? '<span style="color:#6b8ab5; font-size:12px; font-weight:400;">(' + img.code + ')</span>' : ''}</div>
                          <div style="color:#7a6e5e; font-size:12px; margin-top:2px;">${img.department || ''}</div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; margin-left:12px;">
                          <div style="color:#60a5fa; font-size:13.2px; font-weight:600;">${_shortDate(img.sheetDate)}</div>
                          <div style="font-size:12px; color:${statusColor};">${img.status || ''}</div>
                          ${img.sheetId ? `<button class="aladinn-pacs-btn" data-sheet-id="${img.sheetId}" data-maubenhphamid="${img.maubenhphamid || ''}" data-sophieu="${img.sophieu || ''}" data-madichvu="${img.madichvu || ''}" data-linkdicom="${img.linkDicom || ''}" style="margin-top:2px; background:linear-gradient(135deg,rgba(96,165,250,0.15),rgba(96,165,250,0.08)); border:1px solid rgba(96,165,250,0.4); color:#60a5fa; padding:4px 10px; border-radius:6px; font-size:13.2px; font-weight:600; cursor:pointer; transition:all 0.2s; white-space:nowrap;" title="Xem ảnh DICOM trực tiếp">🩻 Xem ảnh</button>` : ''}
                        </div>
                      </div>
                      ${conclusionHtml}
                    </div>`;
                }).join('')}
              </div>
            </div>`;
        }

        // --- Drug Timeline Processing ---
        const drugList = drugs || [];
        const drugsByDate = {};
        for (const d of drugList) {
            const rawDate = d.NGAYMAUBENHPHAM_SUDUNG || '';
            const dateOnly = rawDate.split(' ')[0] || rawDate;
            if (!dateOnly) continue;
            if (!drugsByDate[dateOnly]) drugsByDate[dateOnly] = [];
            drugsByDate[dateOnly].push(d);
        }
        const drugDates = Object.keys(drugsByDate).sort((a, b) => {
            const pa = a.split('/').reverse().join(''); const pb = b.split('/').reverse().join('');
            return pb.localeCompare(pa);
        });
        const uniqueDrugNames = new Set(drugList.map(d => d.TENTHUOC).filter(Boolean));
        const _totalUniqueDrugs = uniqueDrugNames.size;
        let _totalAdded = 0, _totalStopped = 0;

        // --- Combined Timeline (Diễn tiến & Thuốc) ---
        const treatments = patientInfo?.clinicalData?.treatments || [];
        const yLenhList = patientInfo?.clinicalData?.yLenhList || treatments.filter(t => t.SOURCE_API === 'NGT02K015.YLENH' || t.SOURCE_API === 'NT.024.2.DETAIL');
        const admissionTimes = patientInfo?.clinicalData?.admissionTimes || {};
        const isOtherOrder = (item) => item?.SOURCE_API === 'NGT02K015.YLENH' || item?.SOURCE_API === 'NT.024.2.DETAIL';
        const treatmentsByDate = {};
        for (const tr of treatments) {
            const rawDate = tr.NGAYMAUBENHPHAM || '';
            const dateOnly = rawDate.split(' ')[0] || rawDate;
            if (!dateOnly) continue;
            if (!treatmentsByDate[dateOnly]) treatmentsByDate[dateOnly] = [];
            treatmentsByDate[dateOnly].push(tr);
        }

        const allDatesSet = new Set([...drugDates, ...Object.keys(treatmentsByDate)]);
        const allDates = Array.from(allDatesSet).sort((a, b) => {
            const pa = a.split('/').reverse().join(''); 
            const pb = b.split('/').reverse().join('');
            return pb.localeCompare(pa);
        });

        let combinedTimelineHtml = '';
        if (allDates.length > 0) {
            const todayStr = (() => { const n = new Date(); return String(n.getDate()).padStart(2,'0') + '/' + String(n.getMonth()+1).padStart(2,'0') + '/' + n.getFullYear(); })();
            const dowMap = ['Chủ Nhật','Thứ Hai','Thứ Ba','Thứ Tư','Thứ Năm','Thứ Sáu','Thứ Bảy'];
            const getDiags = (trs) => {
                const s = new Set();
                for (const tr of trs) {
                    if (tr.CHANDOAN?.trim()) tr.CHANDOAN.split(';').forEach(d => { const v=d.trim(); if(v) s.add(v); });
                    if (tr.CHANDOANKEMTHEO?.trim()) tr.CHANDOANKEMTHEO.split(';').forEach(d => { const v=d.trim(); if(v) s.add(v); });
                }
                return s;
            };
            // Pre-build running diagnosis state oldest→newest
            const diagByDate = {};
            let _runDiags = new Set();
            for (const dt of [...allDates].reverse()) {
                const d = getDiags(treatmentsByDate[dt] || []);
                if (d.size > 0) _runDiags = d;
                diagByDate[dt] = new Set(_runDiags);
            }
            // Fallback: nếu không trích được CHANDOAN từ phiếu điều trị,
            // dùng chẩn đoán CDS (patientInfo.diagnosis / diagHistory) cho tất cả ngày
            const allDiagsEmpty = Object.values(diagByDate).every(s => s.size === 0);
            if (allDiagsEmpty) {
                const fbSet = new Set();
                if (patientInfo?.diagHistory?.length > 0) {
                    for (const d of patientInfo.diagHistory) { if (d?.trim()) fbSet.add(d.trim()); }
                } else if (patientInfo?.diagnosis?.trim()) {
                    patientInfo.diagnosis.split(';').forEach(d => { const v=d.trim(); if(v) fbSet.add(v); });
                }
                if (fbSet.size > 0) {
                    for (const dt of allDates) diagByDate[dt] = new Set(fbSet);
                }
            }

            for (let di = 0; di < allDates.length; di++) {
                const dt = allDates[di];
                const isToday = dt === todayStr;
                const isFirst = di === allDates.length - 1;
                const dayDrugs = drugsByDate[dt] || [];
                const dayTreatments = treatmentsByDate[dt] || [];
                const dayOrders = dayTreatments.filter(t => isOtherOrder(t) && (t.YLENH || t.GHICHU));
                const dayProgressTreatments = dayTreatments.filter(t => !isOtherOrder(t));

                // Drug comparison
                let prevDrugs = [];
                for (let pi = di + 1; pi < allDates.length; pi++) {
                    if (drugsByDate[allDates[pi]]) { prevDrugs = drugsByDate[allDates[pi]]; break; }
                }
                const prevDrugNames = new Set(prevDrugs.map(d => d.TENTHUOC));
                const currDrugNames = new Set(dayDrugs.map(d => d.TENTHUOC));

                // Diagnosis comparison
                const currDiags = diagByDate[dt] || new Set();
                let prevDiags = new Set();
                for (let pi = di + 1; pi < allDates.length; pi++) {
                    if (diagByDate[allDates[pi]]?.size > 0) { prevDiags = diagByDate[allDates[pi]]; break; }
                }
                const diagChanged = isFirst || [...currDiags].some(d => !prevDiags.has(d)) || [...prevDiags].some(d => !currDiags.has(d));

                // Date strip meta
                const parts = dt.split('/');
                const dateObj = parts.length === 3 ? new Date(+parts[2], +parts[1]-1, +parts[0]) : null;
                const dowStr = dateObj ? dowMap[dateObj.getDay()] : '';
                const doctorName = dayProgressTreatments[0]?.NGUOITAO || dayOrders[0]?.NGUOITAO || '';
                const numColor = isFirst ? '#f59e0b' : isToday ? '#34d399' : '#d4a25a';
                const stripBg = isFirst ? 'rgba(245,158,11,0.06)' : isToday ? 'rgba(16,185,129,0.07)' : 'rgba(212,162,90,0.05)';

                // Tag pills
                const hasProgress = dayTreatments.some(t => t.DIENBIEN?.trim());
                let pills = '';
                if (hasProgress) pills += '<span style="font-size:12px;font-weight:600;padding:2px 7px;border-radius:12px;background:rgba(96,165,250,0.12);color:#7ab8f5;border:1px solid rgba(96,165,250,0.2);">● Diễn tiến</span>';
                if (dayOrders.length > 0) pills += `<span style="font-size:12px;font-weight:600;padding:2px 7px;border-radius:12px;background:rgba(16,185,129,0.1);color:#34d399;border:1px solid rgba(16,185,129,0.2);">▣ ${dayOrders.length} y lệnh</span>`;
                if (diagChanged && !isFirst) pills += '<span style="font-size:12px;font-weight:600;padding:2px 7px;border-radius:12px;background:rgba(167,139,250,0.1);color:#b79bfa;border:1px solid rgba(167,139,250,0.2);">↕ CĐ thay đổi</span>';
                if (currDiags.size > 0 && isFirst) pills += `<span style="font-size:12px;font-weight:600;padding:2px 7px;border-radius:12px;background:rgba(245,158,11,0.1);color:#f59e0b;border:1px solid rgba(245,158,11,0.2);">📋 ${currDiags.size} CĐ</span>`;
                if (dayDrugs.length > 0) pills += `<span style="font-size:12px;font-weight:600;padding:2px 7px;border-radius:12px;background:rgba(212,162,90,0.1);color:#c49a52;border:1px solid rgba(212,162,90,0.2);">💊 ${dayDrugs.length} thuốc</span>`;

                // ── Day card ──
                combinedTimelineHtml += `<div style="border:1px solid rgba(212,162,90,0.1);border-radius:10px;overflow:hidden;background:rgba(255,255,255,0.012);margin-bottom:8px;">
                  <div style="display:flex;align-items:center;gap:10px;padding:7px 12px;background:${stripBg};border-bottom:1px solid rgba(212,162,90,0.1);">
                    <div style="text-align:center;min-width:28px;">
                      <div style="font-size:21.6px;font-weight:800;color:${numColor};line-height:1;">${dt.substring(0,2)}</div>
                      <div style="font-size:10.8px;color:#a18764;font-weight:600;">${dt.substring(3,5)}</div>
                    </div>
                    <div style="width:1px;height:28px;background:rgba(212,162,90,0.15);flex-shrink:0;"></div>
                    <div style="flex:1;">
                      <div style="color:${numColor};font-weight:600;font-size:15px;">${isToday?'Hôm nay, ':''}${dowStr?dowStr+', ':''}${dt}${isFirst?' — Ngày nhập viện':''}</div>
                      <div style="color:#6a5e4e;font-size:12.6px;margin-top:1px;">Ngày điều trị ${allDates.length - di}${doctorName?' · '+doctorName:''}</div>
                    </div>
                    <div style="display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;">${pills}</div>
                  </div>
                  <div style="display:grid;grid-template-columns:1fr 1fr;">`;

                // ── LEFT: Progress + Ghi chú + Diagnosis ──
                combinedTimelineHtml += '<div style="padding:10px 12px;border-right:1px solid rgba(255,255,255,0.04);">';
                const progNotes = dayProgressTreatments.filter(t => t.DIENBIEN?.trim());
                if (progNotes.length > 0) {
                    for (const tr of progNotes) {
                        const timePart = (tr.NGAYMAUBENHPHAM || '').split(' ')[1]?.substring(0,5) || '';
                        const timeTag = timePart ? `<span style="font-size:12px;font-weight:700;color:#a18764;background:rgba(212,162,90,0.1);border:1px solid rgba(212,162,90,0.2);padding:1px 6px;border-radius:4px;margin-bottom:5px;display:inline-block;">🕐 ${timePart}</span>` : '';
                        combinedTimelineHtml += `<div style="padding:7px 10px;border-left:2px solid rgba(96,165,250,0.3);background:rgba(96,165,250,0.03);border-radius:0 5px 5px 0;margin-bottom:6px;">${timeTag}${timePart?'<br>':''}<span style="font-size:14.4px;color:#c8d4e0;line-height:1.65;white-space:pre-wrap;">${tr.DIENBIEN}</span></div>`;
                    }
                } else {
                    combinedTimelineHtml += '<div style="font-size:13.2px;color:#4a4540;font-style:italic;padding:4px 2px;">Không có ghi chú diễn tiến.</div>';
                }
                if (dayOrders.length > 0) {
                    combinedTimelineHtml += `<div style="margin-top:8px;padding:7px 10px;border-left:2px solid rgba(16,185,129,0.35);background:rgba(16,185,129,0.035);border-radius:0 5px 5px 0;">
                      <div style="font-size:11.4px;color:#34d399;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">▣ Y lệnh khác / chăm sóc / chế độ ăn</div>`;
                    for (const order of dayOrders.slice(0, 8)) {
                        const orderTime = (order.NGAYMAUBENHPHAM || '').split(' ')[1]?.substring(0,5) || '';
                        const group = order.NHOMYLENH ? `<span style="font-size:11.4px;color:#6ee7b7;background:rgba(16,185,129,0.08);border:1px solid rgba(16,185,129,0.16);padding:1px 5px;border-radius:4px;margin-right:5px;">${escapeHtml(order.NHOMYLENH)}</span>` : '';
                        const note = order.GHICHU && order.GHICHU !== order.YLENH ? `<span style="color:#8fbfae;"> — ${escapeHtml(order.GHICHU)}</span>` : '';
                        combinedTimelineHtml += `<div style="font-size:13.8px;color:#d8f3e7;line-height:1.55;margin-bottom:4px;">${orderTime ? `<span style="color:#34d399;font-weight:700;margin-right:5px;">${orderTime}</span>` : ''}${group}${escapeHtml(order.YLENH)}${note}</div>`;
                    }
                    if (dayOrders.length > 8) {
                        combinedTimelineHtml += `<div style="font-size:12px;color:#6ee7b7;margin-top:3px;">+${dayOrders.length - 8} y lệnh khác</div>`;
                    }
                    combinedTimelineHtml += '</div>';
                }
                const ghichus = dayProgressTreatments.filter(t => t.GHICHU?.trim());
                if (ghichus.length > 0) {
                    combinedTimelineHtml += `<div style="margin-top:6px;padding:6px 10px;border-left:2px solid rgba(212,162,90,0.3);background:rgba(212,162,90,0.03);border-radius:0 5px 5px 0;">
                      <div style="font-size:11.4px;color:#a18764;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:3px;">📝 Ghi chú</div>
                      <div style="font-size:13.8px;color:#b89a70;line-height:1.5;font-style:italic;">${ghichus[0].GHICHU}</div>
                    </div>`;
                }
                // Diagnosis
                combinedTimelineHtml += `<div style="margin-top:8px;padding-top:8px;border-top:1px solid rgba(255,255,255,0.04);">
                  <div style="font-size:11.4px;color:#8b7cf8;font-weight:700;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px;">▸ Chẩn đoán${currDiags.size > 0 && !isFirst && !diagChanged?' — không đổi':''}</div>`;
                if (currDiags.size > 0) {
                    for (const d of currDiags) {
                        const isNewD = !isFirst && !prevDiags.has(d);
                        combinedTimelineHtml += `<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 6px 3px 8px;border-radius:4px;margin-bottom:3px;font-size:13.8px;line-height:1.45;background:${isNewD?'rgba(52,211,153,.06)':'rgba(107,114,128,.04)'};border-left:2px solid ${isNewD?'#34d399':'#4b5563'};color:${isNewD?'#6ee7b7':'#9ca3af'};">
                          <span style="flex:1;">${d}</span>${isNewD?'<span style="font-size:10.2px;font-weight:700;padding:1px 4px;border-radius:3px;background:rgba(52,211,153,.15);color:#34d399;flex-shrink:0;">MỚI</span>':''}
                        </div>`;
                    }
                    if (!isFirst) {
                        for (const d of prevDiags) {
                            if (!currDiags.has(d)) {
                                combinedTimelineHtml += `<div style="display:flex;align-items:flex-start;gap:6px;padding:3px 6px 3px 8px;border-radius:4px;margin-bottom:3px;font-size:13.8px;line-height:1.45;background:rgba(239,68,68,.04);border-left:2px solid #f87171;color:#fca5a5;text-decoration:line-through;opacity:.75;">
                                  <span style="flex:1;">${d}</span>
                                  <span style="font-size:10.2px;font-weight:700;padding:1px 4px;border-radius:3px;background:rgba(239,68,68,.15);color:#f87171;flex-shrink:0;">NGƯNG</span>
                                </div>`;
                            }
                        }
                    }
                } else {
                    combinedTimelineHtml += '<div style="font-size:13.2px;color:#4a4540;font-style:italic;padding:2px 4px;">Chưa có dữ liệu chẩn đoán.</div>';
                }
                combinedTimelineHtml += '</div></div>';

                // ── RIGHT: Drugs ──
                combinedTimelineHtml += '<div style="padding:10px 12px;">';
                if (dayDrugs.length > 0 || prevDrugs.length > 0) {
                    combinedTimelineHtml += `<div style="display:flex;gap:8px;margin-bottom:6px;font-size:12px;">
                      <span style="display:flex;align-items:center;gap:3px;color:#6a5e4e;"><span style="width:6px;height:6px;border-radius:50%;background:#34d399;display:inline-block;"></span>Mới</span>
                      <span style="display:flex;align-items:center;gap:3px;color:#6a5e4e;"><span style="width:6px;height:6px;border-radius:50%;background:#6b7280;display:inline-block;"></span>Tiếp tục</span>
                      <span style="display:flex;align-items:center;gap:3px;color:#6a5e4e;"><span style="width:6px;height:6px;border-radius:50%;background:#f87171;display:inline-block;"></span>Ngưng</span>
                    </div>`;
                }
                // Stopped drugs
                if (!isFirst) {
                    for (const pd of prevDrugs) {
                        if (!currDrugNames.has(pd.TENTHUOC)) {
                            _totalStopped++;
                            combinedTimelineHtml += `<div style="display:flex;align-items:baseline;gap:7px;padding:5px 8px;border-radius:6px;margin-bottom:4px;background:rgba(239,68,68,.04);border:1px solid rgba(239,68,68,.1);opacity:.75;">
                              <span style="width:6px;height:6px;border-radius:50%;background:#f87171;flex-shrink:0;margin-top:5px;"></span>
                              <span style="flex:1;font-size:14.4px;color:#fca5a5;text-decoration:line-through;">${pd.TENTHUOC}</span>
                              <span style="font-size:10.2px;font-weight:700;padding:1px 4px;border-radius:3px;background:rgba(239,68,68,.15);color:#f87171;flex-shrink:0;">NGƯNG</span>
                            </div>`;
                        }
                    }
                }
                // Current drugs
                for (const drug of dayDrugs) {
                    const name = drug.TENTHUOC || '—';
                    const isNew = !isFirst && prevDrugs.length > 0 && !prevDrugNames.has(name);
                    if (isNew) _totalAdded++;
                    let fullName = name;
                    if (drug.HOATCHAT && drug.HOATCHAT.trim().toLowerCase() !== fullName.trim().toLowerCase()) fullName += ` (${drug.HOATCHAT.trim()})`;
                    if (drug.HAMLUONG?.trim()) { const hl = drug.HAMLUONG.trim(); fullName += hl.startsWith('(')&&hl.endsWith(')')?` ${hl}`:`  (${hl})`; }
                    let totalDose;
                    const dm = (drug.LIEUDUNG||'').match(/\[(.*?)\]/);
                    if (dm?.[1]) totalDose = dm[1];
                    else if (drug.SOLUONG) totalDose = `${drug.SOLUONG} ${drug.DONVITINH||''}/ngày`.trim();
                    else totalDose = drug.LIEUDUNG || '';
                    const dotC = (isNew||isFirst)?'#34d399':'#6b7280';
                    const nameC = (isNew||isFirst)?'#d0f0e4':'#9ca3af';
                    const doseStyle = (isNew||isFirst)?'background:rgba(52,211,153,.12);color:#34d399;':'background:rgba(107,114,128,.1);color:#9ca3af;';
                    const itemBg = (isNew||isFirst)?'background:rgba(52,211,153,.05);border:1px solid rgba(52,211,153,.12);':'background:rgba(255,255,255,.015);border:1px solid rgba(255,255,255,.04);opacity:.7;';
                    const newBadge = (isNew&&!isFirst)?'<span style="font-size:10.2px;font-weight:700;padding:1px 4px;border-radius:3px;background:rgba(52,211,153,.15);color:#34d399;margin-left:4px;vertical-align:middle;">MỚI</span>':'';
                    const ksDays = drug.SOLAN_SD_KHANGSINH ? parseInt(drug.SOLAN_SD_KHANGSINH, 10) : 0;
                    const ksBadge = ksDays > 0 ? `<span style="font-size:10.2px;font-weight:700;padding:1px 5px;border-radius:3px;background:rgba(212,162,90,.18);color:#d4a25a;border:1px solid rgba(212,162,90,.3);margin-left:4px;vertical-align:middle;" title="Số ngày sử dụng kháng sinh: ${ksDays} ngày">💊KS ${ksDays}d</span>` : '';
                    combinedTimelineHtml += `<div style="display:flex;align-items:baseline;gap:7px;padding:5px 8px;border-radius:6px;margin-bottom:4px;${itemBg}">
                      <span style="width:6px;height:6px;border-radius:50%;background:${dotC};flex-shrink:0;margin-top:5px;"></span>
                      <span style="flex:1;font-size:14.4px;color:${nameC};line-height:1.4;" title="${fullName}">${ksDays > 0 ? `<span style="font-weight:700;color:#d4a25a;">(${ksDays})</span> ` : ''}${fullName}${newBadge}</span>
                      ${totalDose?`<span style="font-size:12px;font-weight:600;padding:2px 6px;border-radius:4px;white-space:nowrap;flex-shrink:0;${doseStyle}">${totalDose}</span>`:''}
                    </div>`;
                }
                if (dayDrugs.length === 0) combinedTimelineHtml += '<div style="font-size:13.2px;color:#4a4540;font-style:italic;padding:4px 2px;">Không có y lệnh thuốc.</div>';
                combinedTimelineHtml += '</div></div></div>';
            }
        } else {
            combinedTimelineHtml = '<div style="text-align:center;padding:20px;color:#7a6e5e;font-style:italic;">Không có dữ liệu Diễn tiến / Thuốc.</div>';
        }

        const sourcePills = [
            { label: `${treatments.length} diễn tiến/y lệnh`, color: '#7ab8f5' },
            { label: `${yLenhList.length} y lệnh khác`, color: '#34d399' },
            { label: `${drugList.length} thuốc`, color: '#d4a25a' },
            { label: `${labs.length} XN`, color: '#f472b6' },
            { label: `${imgList.length} CĐHA`, color: '#60a5fa' }
        ].map(item => `<span style="font-size:12.6px;font-weight:700;color:${item.color};background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:999px;padding:3px 8px;">${item.label}</span>`).join('');
        const clinicalGuideHtml = `<div style="margin-bottom:10px;display:flex;gap:5px;flex-wrap:wrap;justify-content:flex-end;">${sourcePills}</div>`;

        // --- Khám vào viện (admission exam only) ---
        let khamVaoVienHtml = '';
        const historyData = patientInfo?.clinicalData?.history || {};
        const _hasLamsangData = allDates.length > 0 || Object.keys(historyData).length > 0; void _hasLamsangData;

        if (Object.keys(historyData).length > 0) {
            khamVaoVienHtml += `<div style="background:rgba(212,162,90,0.05); border:1px solid rgba(212,162,90,0.2); border-radius:10px; padding:16px; margin-bottom:16px;">
                <h4 style="color:#d4a25a; margin:0 0 12px 0; font-size:16.8px; display:flex; align-items:center; gap:6px;">🏥 Khám bệnh án</h4>`;
            const fields = [
                { key: 'LYDOVAOVIEN', label: 'Lý do vào viện' },
                { key: 'QUATRINHBENHLY', label: 'Bệnh sử' },
                { key: 'TIENSUBENH_BANTHAN', label: 'Tiền sử bản thân' },
                { key: 'KHAMBENH_TOANTHAN', label: 'Khám toàn thân' },
                { key: 'KHAMBENH_BOPHAN', label: 'Khám bộ phận' },
                { key: 'TOMTATKQCANLAMSANG', label: 'Tóm tắt CLS' }
            ];
            for (const f of fields) {
                if (historyData[f.key]) {
                    khamVaoVienHtml += `<div style="margin-bottom:10px;">
                        <span style="color:#a18764; font-weight:600; font-size:14.4px; display:block; margin-bottom:2px;">${f.label}:</span>
                        <div style="color:#e8dcc8; font-size:15.6px; line-height:1.5; white-space:pre-wrap;">${historyData[f.key]}</div>
                    </div>`;
                }
            }
            khamVaoVienHtml += '</div>';
        } else {
            khamVaoVienHtml = '<div style="text-align:center; padding:30px; color:#5a5450; font-style:italic;">Chưa có dữ liệu khám vào viện.</div>';
        }

        // --- Lâm sàng & Thuốc: diễn tiến + thuốc (combined timeline) ---
        const lamsangHtml = clinicalGuideHtml + (combinedTimelineHtml || '<div style="text-align:center; padding:30px; color:#5a5450; font-style:italic;">Chưa có dữ liệu diễn tiến.</div>');

        // --- Modal ---
        const modal = document.createElement('div');
        modal.id = 'vnpt-lab-timeline-modal';
        modal.className = 'vnpt-glass-overlay';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:2147480000;';

        const defaultActiveTab = 1;

        // Giới tính: API-first (demographics) → patientInfo → DOM fallback
        let headerGender = '';
        try {
            // Nguồn 1: Demographics API (Phase 1 — ổn định nhất)
            const gi = patientInfo.demographicsGender || patientInfo.gender || patientInfo.GIOITINH || patientInfo.GT || patientInfo.PHAI || '';
            if (gi) {
                const g = String(gi).trim().toLowerCase();
                if (g === '1' || g === 'nam' || g === 'male') headerGender = 'Nam';
                else if (g === '2' || g === 'nữ' || g === 'nu' || g === 'female') headerGender = 'Nữ';
                else if (gi.trim()) headerGender = gi.trim();
            }
            // Nguồn 2 (DOM fallback): chỉ chạy khi API không trả giới tính
            if (!headerGender) {
                const pid = patientInfo.id ? String(patientInfo.id) : null;
                const gTd = pid
                    ? (document.querySelector(`tr#${pid} td[aria-describedby$='_GIOITINH']`) ||
                       document.querySelector(`tr#${pid} td[aria-describedby$='_GT']`) ||
                       document.querySelector(`tr#${pid} td[aria-describedby$='_PHAI']`))
                    : null;
                if (gTd) {
                    const gt = gTd.textContent.trim().toLowerCase();
                    if (gt === '1' || gt === 'nam' || gt === 'male') headerGender = 'Nam';
                    else if (gt === '2' || gt === 'nữ' || gt === 'nu' || gt === 'female') headerGender = 'Nữ';
                    else if (gTd.textContent.trim()) headerGender = gTd.textContent.trim();
                }
            }
            // Nguồn 3 (DOM fallback): selected row trong grid
            if (!headerGender) {
                const selRow = document.querySelector('tr.jqgrow.ui-state-highlight, tr.ui-state-highlight');
                const gTd2 = selRow
                    ? (selRow.querySelector('td[aria-describedby$="_GIOITINH"]') ||
                       selRow.querySelector('td[aria-describedby$="_GT"]') ||
                       selRow.querySelector('td[aria-describedby$="_PHAI"]'))
                    : null;
                if (gTd2) {
                    const gt2 = gTd2.textContent.trim().toLowerCase();
                    if (gt2 === '1' || gt2 === 'nam' || gt2 === 'male') headerGender = 'Nam';
                    else if (gt2 === '2' || gt2 === 'nữ' || gt2 === 'nu' || gt2 === 'female') headerGender = 'Nữ';
                    else if (gTd2.textContent.trim()) headerGender = gTd2.textContent.trim();
                }
            }
        } catch (_) { /* ignore */ }
        const patientAgeHtml = ''; // age now inline in h3
        let patientDiagHtml = '';
        if (patientInfo.diagnosis) {
            const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            
            // Parse ICD codes from the diagnosis string (e.g. "A09, I10, K35, A09 - Viêm dạ dày...")
            const icdRegex = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
            const rawDiag = patientInfo.diagnosis;
            const icdMatches = [...new Set((rawDiag.match(icdRegex) || []))]; // unique codes
            
            // Build pills for ICD codes
            const _pillsHtml = icdMatches.length > 0
                ? icdMatches.map((code, i) => {
                    const isPrimary = i === 0;
                    const bg = isPrimary ? 'rgba(212,162,90,0.2)' : 'rgba(255,255,255,0.06)';
                    const border = isPrimary ? 'rgba(212,162,90,0.4)' : 'rgba(255,255,255,0.1)';
                    const color = isPrimary ? '#f0d78c' : '#c8b89a';
                    return `<span style="display:inline-block; padding:2px 8px; border-radius:5px; font-size:14.4px; font-weight:700; font-family:'SF Mono','Menlo','Consolas',monospace; color:${color}; background:${bg}; border:1px solid ${border}; letter-spacing:0.3px; line-height:1.4;" title="${isPrimary ? 'Chẩn đoán chính' : 'Kèm theo'}">${code}</span>`;
                }).join(' ')
                : '';
            
            // Strip ICD codes and leading separators from the description text
            let descText = rawDiag.replace(icdRegex, '').replace(/^[\s,;-]+/, '').replace(/[\s,;-]+$/, '').trim();
            // Clean up internal separators from removed codes
            descText = descText.replace(/\s*[,;]\s*[,;]\s*/g, ', ').replace(/^\s*[,;-]\s*/, '').trim();
            
            // Hiển thị chẩn đoán: pills tên bệnh (kiểu cũ), ICD vào chi tiết
            if (patientInfo.diagHistory && patientInfo.diagHistory.length > 0) {
                // Build pills đơn giản — chỉ text, không background vàng
                const _namePillsHtml = patientInfo.diagHistory.map((d, i) => {
                    const isPrimary = i === 0;
                    const cleanName = d.replace(icdRegex, '').replace(/^[\s,;-]+/, '').trim() || d;
                    const color = isPrimary ? '#e8dcc8' : '#9a8e7e';
                    const weight = isPrimary ? '600' : '400';
                    const title = isPrimary ? 'Chẩn đoán chính' : 'Chẩn đoán kèm';
                    return `<span style="display:inline-block; padding:2px 8px; border-radius:4px; font-size:14.4px; font-weight:${weight}; color:${color}; background:rgba(255,255,255,0.05); border:1px solid rgba(255,255,255,0.08); line-height:1.5; margin-bottom:2px;" title="${title}">${escapeHtml(cleanName)}</span>`;
                }).join(' ');

                // Tạo danh sách ICD cho phần chi tiết
                const icdDetailList = patientInfo.diagHistory.map(d => {
                    const codes = (d.match(icdRegex) || []);
                    const cleanName = d.replace(icdRegex, '').replace(/^[\s,;-]+/, '').trim() || d;
                    const codeStr = codes.length > 0 ? codes.map(c => `<code style="font-size:12px;background:rgba(212,162,90,0.12);padding:1px 4px;border-radius:3px;color:#a18764;">${c}</code>`).join(' ') : '';
                    return `<li style="margin-bottom:4px; color:#c8b89a; font-size:14.4px; line-height:1.5;">${escapeHtml(cleanName)}${codeStr ? ' ' + codeStr : ''}</li>`;
                }).join('');

                patientDiagHtml = `
                    <div style="margin-top:5px;">
                        <div style="display:flex; align-items:baseline; gap:6px; flex-wrap:nowrap;">
                            <span style="font-size:12px; color:#a18764; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; flex-shrink:0;">CĐ:</span>
                            <div style="font-size:14.4px; color:#e8dcc8; line-height:1.4; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0;">${escapeHtml(patientInfo.diagHistory.map(d => d.replace(icdRegex,'').replace(/^[\s,;-]+/,'').trim()).filter(Boolean).join(' · '))}</div>
                        </div>
                        <details style="margin-top:3px;">
                            <summary style="font-size:13.2px; color:#5a5450; cursor:pointer; outline:none; user-select:none; list-style:none; display:inline-flex; align-items:center; gap:3px;">
                                <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="6 9 12 15 18 9"></polyline></svg>
                                Chi tiết (${patientInfo.diagHistory.length} chẩn đoán, kèm mã ICD)
                            </summary>
                            <div style="margin-top:4px; padding:6px 10px; background:rgba(0,0,0,0.18); border:1px solid rgba(212,162,90,0.1); border-radius:5px; max-height:110px; overflow-y:auto;">
                                <ul style="margin:0; padding-left:12px; line-height:1.5;">${icdDetailList}</ul>
                            </div>
                        </details>
                    </div>
                `;
            } else {
                patientDiagHtml = `
                    <div style="margin-top:5px; display:flex; align-items:baseline; gap:6px;">
                        <span style="font-size:12px; color:#a18764; font-weight:700; text-transform:uppercase; letter-spacing:0.5px; flex-shrink:0;">CĐ:</span>
                        <div style="font-size:14.4px; color:#e8dcc8; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; flex:1; min-width:0;">${escapeHtml(descText || rawDiag)}</div>
                    </div>
                `;
            }

        }
        const headerSubtitleHtml = patientAgeHtml || patientDiagHtml
            ? `<div style="margin-top:3px; font-size:14.4px; color:#9a8e7e;">${patientAgeHtml}${patientDiagHtml}</div>`
            : '';

        const tabsHeaderHtml = `
            <style>
                @keyframes aisTab-shimmer { 0%{left:-80%} 100%{left:120%} }
                @keyframes aisTab-pulse { 0%,100%{box-shadow:0 0 0 0 rgba(212,168,83,0.3)} 60%{box-shadow:0 0 0 5px rgba(212,168,83,0)} }
                @keyframes aisSkel { 0%,100%{opacity:0.35} 50%{opacity:0.85} }
                @keyframes aisSpinRing { to{transform:rotate(360deg)} }
                @keyframes aisDot { 0%,80%,100%{transform:scale(0.55);opacity:0.35} 40%{transform:scale(1);opacity:1} }
                @keyframes aisTabFadeIn { from{opacity:0;transform:translateY(5px)} to{opacity:1;transform:translateY(0)} }
                #aladinn-tab-ai {
                    position:relative; overflow:hidden;
                    background:linear-gradient(135deg,rgba(200,146,42,0.15),rgba(212,168,83,0.07));
                    border:1px solid rgba(212,168,83,0.3) !important;
                    border-bottom:2px solid rgba(212,168,83,0.15) !important;
                    color:#c8a455 !important; font-weight:700 !important;
                    animation:aisTab-pulse 3s ease-in-out infinite;
                }
                #aladinn-tab-ai::after {
                    content:''; position:absolute; top:0; left:-80%; width:40%; height:100%;
                    background:linear-gradient(90deg,transparent,rgba(255,255,255,0.1),transparent);
                    transform:skewX(-18deg); animation:aisTab-shimmer 3.5s ease-in-out infinite;
                }
                #aladinn-tab-ai.ai-tab-active {
                    background:linear-gradient(135deg,rgba(212,168,83,0.2),rgba(200,146,42,0.1)) !important;
                    border-bottom-color:#D4A853 !important; color:#D4A853 !important;
                    animation:none;
                }
                #aladinn-tab-ai.ai-tab-active::after { display:none; }
                .ais-dot-wrap{display:inline-flex;gap:3px;align-items:center;vertical-align:middle;}
                .ais-dot-wrap span{width:5px;height:5px;border-radius:50%;background:#D4A853;display:inline-block;animation:aisDot 1.2s infinite ease-in-out;}
                .ais-dot-wrap span:nth-child(2){animation-delay:0.15s}
                .ais-dot-wrap span:nth-child(3){animation-delay:0.3s}
                #aladinn-content-ai { animation: aisTabFadeIn 0.25s ease; }
            </style>
            <div style="display:flex; border-bottom:1px solid rgba(212,162,90,0.2); margin-bottom:14px; gap:3px;">
                <button id="aladinn-tab-khamvaovien" style="flex:1.2; display:flex; align-items:center; justify-content:center; gap:5px; background:transparent; border:1px solid transparent; border-bottom:2px solid transparent; color:#7a6e5e; padding:9px 4px; font-weight:600; border-radius:8px 8px 0 0; cursor:pointer; font-size:14.4px; transition:all 0.2s; line-height:normal;">🏥 Khám vào viện</button>
                <button id="aladinn-tab-lamsang" style="flex:1.2; display:flex; align-items:center; justify-content:center; gap:5px; background:transparent; border:1px solid transparent; border-bottom:2px solid transparent; color:#7a6e5e; padding:9px 4px; font-weight:600; border-radius:8px 8px 0 0; cursor:pointer; font-size:14.4px; transition:all 0.2s; line-height:normal;">📋 Lâm sàng &amp; Thuốc</button>
                <button id="aladinn-tab-xn" style="flex:1; display:flex; align-items:center; justify-content:center; gap:5px; background:transparent; border:1px solid transparent; border-bottom:2px solid transparent; color:#7a6e5e; padding:9px 4px; font-weight:600; border-radius:8px 8px 0 0; cursor:pointer; font-size:14.4px; transition:all 0.2s; line-height:normal;">🧪 XN (${totalIndicators})</button>
                <button id="aladinn-tab-cdha" style="flex:1; display:flex; align-items:center; justify-content:center; gap:5px; background:transparent; border:1px solid transparent; border-bottom:2px solid transparent; color:#7a6e5e; padding:9px 4px; font-weight:600; border-radius:8px 8px 0 0; cursor:pointer; font-size:14.4px; transition:all 0.2s; line-height:normal;">🩻 CĐHA (${imgList.length})</button>
                <button id="aladinn-tab-ai" style="flex:1; display:flex; align-items:center; justify-content:center; gap:5px; padding:9px 4px; border-radius:8px 8px 0 0; cursor:pointer; font-size:14.4px; transition:all 0.2s; line-height:normal;">
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                    AI
                </button>
            </div>
        `;

        modal.innerHTML = `
            <div style="width:96vw; max-width:1400px; height:94vh; max-height:94vh; display:flex; flex-direction:column; padding:24px; background:linear-gradient(135deg,#1a1510,#231c14); box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 30px rgba(212,162,90,0.12); border:1px solid rgba(212,162,90,0.3); border-radius:16px; font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:10px; flex-shrink:0;">
                    <div style="flex:1; min-width:0;">
                        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                            <h3 style="color:#d4a25a; margin:0; font-size:19.2px; display:flex; align-items:center; gap:10px;">
                                <img src="${chrome.runtime.getURL('assets/icons/icon128.png')}" style="width:22px;height:22px;"> 
                                CLS + Thuốc <span style="color:#a18764; margin: 0 4px;">—</span> <span style="color:#fff; font-weight:700; background:rgba(212,162,90,0.15); padding:2px 8px; border-radius:4px;">${patientName}</span>${headerGender || patientInfo.age ? `<span style="color:#9a8e7e; font-size:15.6px; font-weight:400;">${[headerGender, patientInfo.age].filter(Boolean).join(', ')}</span>` : ''}
                            </h3>
                        </div>
                        ${headerSubtitleHtml}
                    </div>
                    <button id="lab-timeline-close" style="background:none;border:none;color:#7a6e5e;font-size:26.4px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;width:24px;height:24px;flex-shrink:0;" title="Đóng">&times;</button>
                </div>
                ${tabsHeaderHtml}
                <div style="flex:1; min-height:0; overflow-y:auto; padding-right:6px; color:#e8dcc8;">
                    <div id="aladinn-content-khamvaovien" style="display:none;">
                        ${khamVaoVienHtml}
                    </div>
                    <div id="aladinn-content-lamsang" style="display:none;">
                        ${lamsangHtml}
                    </div>
                    <div id="aladinn-content-xn" style="display:none;">
                        ${summaryCards}
                        ${alertsHtml}
                        ${tablesHtml}
                    </div>
                    <div id="aladinn-content-cdha" style="display:none;">
                        ${cdhaHtml || '<div style="text-align:center; padding:20px; color:#7a6e5e; font-style:italic;">Không có dữ liệu Chẩn đoán hình ảnh.</div>'}
                    </div>
                    <div id="aladinn-content-ai" style="display:none; padding:4px 2px;">
                        <div id="ai-tab-placeholder" style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:40px 20px; gap:14px; text-align:center;">
                            <div style="width:52px;height:52px;border-radius:50%;background:rgba(212,168,83,0.1);border:1px solid rgba(212,168,83,0.25);display:flex;align-items:center;justify-content:center;">
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#D4A853" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                            </div>
                            <div>
                                <div style="color:#D4A853;font-weight:700;font-size:16.8px;margin-bottom:4px;">Phân tích lâm sàng AI</div>
                                <div style="color:#6b7280;font-size:14.4px;line-height:1.5;">Chưa cấu hình API. Copy prompt để dán sang ChatGPT/Gemini khác</div>
                            </div>
                            <div style="display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;">
                                <button id="btn-ai-copy-prompt" style="display:flex;align-items:center;gap:7px;background:linear-gradient(135deg,#c8922a,#d4a853,#e8c27a);border:none;color:#0b0f1e;border-radius:9px;padding:9px 22px;font-size:15.6px;font-weight:800;cursor:pointer;font-family:Outfit,sans-serif;letter-spacing:0.3px;box-shadow:0 3px 14px rgba(212,168,83,0.4);transition:all 0.2s;position:relative;overflow:hidden;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="8" width="11" height="11" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/></svg>
                                    Copy prompt
                                </button>
                                <button id="btn-ai-start" style="display:none;align-items:center;gap:7px;background:rgba(212,168,83,0.08);border:1px solid rgba(212,168,83,0.25);color:#c8a455;border-radius:9px;padding:9px 18px;font-size:15.6px;font-weight:700;cursor:pointer;font-family:Outfit,sans-serif;letter-spacing:0.3px;transition:all 0.2s;position:relative;overflow:hidden;">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
                                    Phân tích ngay
                                </button>
                            </div>
                        </div>
                        <div id="ai-tab-loading" style="display:none; padding:20px 10px;">
                            <div style="display:flex;gap:10px;align-items:center;margin-bottom:16px;">
                                <div style="position:relative;width:22px;height:22px;flex-shrink:0;">
                                    <div style="position:absolute;inset:0;border-radius:50%;border:2px solid rgba(212,168,83,0.15);"></div>
                                    <div style="position:absolute;inset:0;border-radius:50%;border:2px solid transparent;border-top-color:#D4A853;animation:aisSpinRing 0.9s linear infinite;"></div>
                                </div>
                                <span style="color:#D4A853;font-weight:600;font-size:15.6px;">Đang phân tích hồ sơ lâm sàng...</span>
                            </div>
                            <div style="display:flex;flex-direction:column;gap:8px;padding-left:32px;">
                                <div style="height:9px;background:rgba(212,168,83,0.12);border-radius:5px;width:88%;animation:aisSkel 1.6s ease-in-out infinite;"></div>
                                <div style="height:9px;background:rgba(212,168,83,0.08);border-radius:5px;width:70%;animation:aisSkel 1.6s ease-in-out 0.2s infinite;"></div>
                                <div style="height:9px;background:rgba(212,168,83,0.05);border-radius:5px;width:78%;animation:aisSkel 1.6s ease-in-out 0.4s infinite;"></div>
                                <div style="height:9px;background:rgba(212,168,83,0.04);border-radius:5px;width:55%;animation:aisSkel 1.6s ease-in-out 0.6s infinite;"></div>
                            </div>
                        </div>
                        <div id="ai-tab-result" style="display:none;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid rgba(212,168,83,0.12);">
                                <span style="font-size:13.2px;color:#a18764;font-weight:700;text-transform:uppercase;letter-spacing:0.5px;">Kết quả phân tích</span>
                                <button id="btn-ai-rerun" style="display:flex;align-items:center;gap:5px;background:rgba(212,168,83,0.08);border:1px solid rgba(212,168,83,0.2);color:#c8a455;border-radius:6px;padding:3px 10px;font-size:13.2px;font-weight:600;cursor:pointer;transition:0.2s;" title="Phân tích lại">
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>
                                    Phân tích lại
                                </button>
                            </div>
                            <div id="ai-summary-result-modal" style="font-size:15.6px;color:#cbd5e1;line-height:1.7;"></div>
                            <div id="ai-search-links" style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(212,168,83,0.1);display:none;">
                                <div style="font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px;">📚 Tra cứu chuyên sâu theo mã ICD</div>
                                <div id="ai-links-wrap" style="display:flex;flex-direction:column;gap:8px;"></div>
                            </div>
                            <div id="ai-disclaimer" style="display:none;margin-top:16px;padding:12px 14px;background:rgba(245,158,11,0.06);border:1px solid rgba(245,158,11,0.18);border-radius:8px;">
                                <div style="display:flex;align-items:flex-start;gap:8px;">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:1px;"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                    <div>
                                        <div style="font-size:13.2px;font-weight:700;color:#f59e0b;margin-bottom:3px;">Lưu ý lâm sàng</div>
                                        <div style="font-size:13.2px;color:#9a8e7e;line-height:1.6;">Nội dung trên được tạo bởi AI dựa trên dữ liệu có sẵn, mang tính <strong style='color:#c8b89a;'>tham khảo</strong> và có thể không chính xác hoặc thiếu sót. Bác sĩ điều trị chịu trách nhiệm <strong style='color:#c8b89a;'>đánh giá, xác minh</strong> và đưa ra quyết định lâm sàng cuối cùng.</div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div id="ai-tab-error" style="display:none;padding:16px;background:rgba(232,84,84,0.06);border:1px solid rgba(232,84,84,0.2);border-radius:8px;color:#E85454;font-size:15.6px;"></div>
                    </div>
                </div>
                <div style="margin-top:14px; flex-shrink:0; display:flex; justify-content:flex-end; border-top:1px solid rgba(212,162,90,0.2); padding-top:12px;">
                    <button style="background:rgba(212,162,90,0.1); border:1px solid rgba(212,162,90,0.3); color:#d4a25a; padding:6px 16px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(212,162,90,0.2)'" onmouseout="this.style.background='rgba(212,162,90,0.1)'" onclick="document.getElementById('vnpt-lab-timeline-modal').remove()">Đóng</button>
                </div>
            </div>`;

        document.documentElement.appendChild(modal);
        modal.querySelector('#lab-timeline-close')?.addEventListener('click', () => modal.remove());

        // ── Tab logic (4 tabs: Lâm sàng, XN, CĐHA, AI) ─────────────────────
        const tabKhamVaoVien = modal.querySelector('#aladinn-tab-khamvaovien');
        const tabLamsang     = modal.querySelector('#aladinn-tab-lamsang');
        const tabXn          = modal.querySelector('#aladinn-tab-xn');
        const tabCdha        = modal.querySelector('#aladinn-tab-cdha');
        const tabAI          = modal.querySelector('#aladinn-tab-ai');

        const contentKhamVaoVien = modal.querySelector('#aladinn-content-khamvaovien');
        const contentLamsang     = modal.querySelector('#aladinn-content-lamsang');
        const contentXn          = modal.querySelector('#aladinn-content-xn');
        const contentCdha        = modal.querySelector('#aladinn-content-cdha');
        const contentAI          = modal.querySelector('#aladinn-content-ai');

        const allTabs     = [tabKhamVaoVien, tabLamsang, tabXn, tabCdha, tabAI];
        const allContents = [contentKhamVaoVien, contentLamsang, contentXn, contentCdha, contentAI];

        function activateTab(idx) {
            allTabs.forEach((t, i) => {
                if (!t) return;
                const isAI = (i === 4);
                // CDHA tab = index 3 (blue), others gold
                const col = i === 3 ? '96,165,250' : '212,162,90';
                const activeColor = i === 3 ? '#60a5fa' : '#d4a25a';
                if (i === idx) {
                    if (isAI) {
                        t.classList.add('ai-tab-active');
                    } else {
                        t.style.background = `rgba(${col},0.1)`;
                        t.style.borderColor = `rgba(${col},0.3)`;
                        t.style.borderBottomColor = activeColor;
                        t.style.color = activeColor;
                        t.style.fontWeight = '700';
                    }
                } else {
                    if (isAI) {
                        t.classList.remove('ai-tab-active');
                    } else {
                        t.style.background = 'transparent';
                        t.style.borderColor = 'transparent';
                        t.style.borderBottomColor = 'transparent';
                        t.style.color = '#7a6e5e';
                        t.style.fontWeight = '600';
                    }
                }
            });
            allContents.forEach((c, i) => {
                if (!c) return;
                c.style.display = i === idx ? 'block' : 'none';
            });
        }

        tabKhamVaoVien?.addEventListener('click', () => activateTab(0));
        tabLamsang?.addEventListener('click', () => activateTab(1));
        tabXn?.addEventListener('click', () => activateTab(2));
        tabCdha?.addEventListener('click', () => activateTab(3));
        tabAI?.addEventListener('click', () => { activateTab(4); handleAITabOpen(); });

        activateTab(defaultActiveTab);

        // ── PACS Button click handler (delegated) ────────────────────────────
        modal.addEventListener('click', async (e) => {
            const btn = e.target.closest('.aladinn-pacs-btn');
            if (!btn) return;
            e.stopPropagation();

            const sheetId      = btn.dataset.sheetId || '';
            const maubenhphamid = btn.dataset.maubenhphamid || '';
            const sophieu      = btn.dataset.sophieu || '';
            const madichvu     = btn.dataset.madichvu || '';
            const linkDicom    = btn.dataset.linkdicom || '';

            if (!sheetId && !maubenhphamid) {
                window.VNPTRealtime?.showToast('⚠️ Không có mã ca chụp PACS.', 'warning');
                return;
            }

            const origText = btn.innerHTML;
            btn.innerHTML = '⏳ Đang lấy link...';
            btn.disabled = true;

            try {
                const pacsConfig = { sheetId, maubenhphamid, sophieu, madichvu, linkDicom };
                const url = await _fetchPacsUrlFromBridge(pacsConfig);
                if (url) {
                    window.open(url, '_blank');
                } else {
                    window.VNPTRealtime?.showToast('⚠️ Không lấy được link ảnh PACS. Kiểm tra tab HIS đang mở.', 'warning');
                }
            } catch (_err) {
                window.VNPTRealtime?.showToast('❌ Lỗi khi lấy link PACS.', 'warning');
            } finally {
                btn.innerHTML = origText;
                btn.disabled = false;
            }
        });

        // ── AI Tab Logic ───────────────────────────────────────────────────
        const aiPlaceholder = modal.querySelector('#ai-tab-placeholder');
        const aiLoading     = modal.querySelector('#ai-tab-loading');
        const aiResult      = modal.querySelector('#ai-tab-result');
        const aiError       = modal.querySelector('#ai-tab-error');
        const aiResultBody  = modal.querySelector('#ai-summary-result-modal');
        const aiSearchWrap  = modal.querySelector('#ai-search-links');
        const aiLinksWrap   = modal.querySelector('#ai-links-wrap');
        const btnStart      = modal.querySelector('#btn-ai-start');
        const btnRerun      = modal.querySelector('#btn-ai-rerun');
        const btnCopyPrompt = modal.querySelector('#btn-ai-copy-prompt');
        let aiResultLoaded = false;

        function showAIState(state) {
            // state: 'placeholder' | 'loading' | 'result' | 'error'
            if (aiPlaceholder) aiPlaceholder.style.display = state === 'placeholder' ? 'flex' : 'none';
            if (aiLoading)     aiLoading.style.display     = state === 'loading'     ? 'block' : 'none';
            if (aiResult)      aiResult.style.display      = state === 'result'      ? 'block' : 'none';
            if (aiError)       aiError.style.display       = state === 'error'       ? 'block' : 'none';
        }

        function setCopyPromptMode(enabled) {
            if (btnCopyPrompt) btnCopyPrompt.style.display = enabled ? 'flex' : 'none';
            if (btnStart) btnStart.style.display = enabled ? 'none' : 'flex';
        }

        async function handleAITabOpen() {
            if (aiResultLoaded) return;
            let hasConfiguredApi = false;
            try {
                hasConfiguredApi = await window.HIS.ApiKeyService.hasKey();
            } catch (_) { /* fallback to copy prompt */ }
            if (hasConfiguredApi) {
                setCopyPromptMode(false);
                await runAIAnalysis(false);
                return;
            }
            setCopyPromptMode(true);
            showAIState('placeholder');
        }

        async function copyPromptToClipboard(prompt) {
            try {
                if (navigator.clipboard?.writeText) {
                    await navigator.clipboard.writeText(prompt);
                } else {
                    const textarea = document.createElement('textarea');
                    textarea.value = prompt;
                    textarea.style.cssText = 'position:fixed;left:-9999px;top:-9999px;';
                    document.body.appendChild(textarea);
                    textarea.focus();
                    textarea.select();
                    document.execCommand('copy');
                    textarea.remove();
                }
                window.VNPTRealtime?.showToast?.('✅ Đã copy prompt. Dán sang ChatGPT/Gemini để hỏi tiếp.', 'success');
            } catch (_e) {
                window.VNPTRealtime?.showToast?.('❌ Không copy được prompt. Vui lòng thử lại.', 'warning');
                throw new Error('Không copy được prompt.', { cause: _e });
            }
        }

        async function runAIAnalysis(forceRefresh = false, copyOnly = false) {
            if (copyOnly) {
                if (btnCopyPrompt) btnCopyPrompt.disabled = true;
            } else {
                showAIState('loading');
                if (btnStart) btnStart.disabled = true;
                if (btnRerun) btnRerun.disabled = true;
            }

            try {
                // ── Ẩn danh hoá ─────────────────────────────────────────
                const patientRef = patientInfo.id
                    ? `BN-${String(patientInfo.id).slice(-4).padStart(4,'0')}`
                    : 'BN-XXXX';
                const birthYear = patientInfo.age
                    ? (String(patientInfo.age).match(/\d{4}/) || [''])[0] || patientInfo.age
                    : 'không rõ';

                // Giới tính: API-first (demographics) → DOM fallback
                let patientGender = 'không rõ';
                try {
                    // Nguồn 1: Demographics API (Phase 1)
                    const demoGender = patientInfo.demographicsGender || '';
                    if (demoGender) {
                        const g = String(demoGender).trim().toLowerCase();
                        if (g === '1' || g === 'nam' || g === 'male') patientGender = 'Nam';
                        else if (g === '2' || g === 'nữ' || g === 'nu' || g === 'female') patientGender = 'Nữ';
                        else patientGender = demoGender.trim() || 'không rõ';
                    }
                    // Nguồn 2: DOM fallback
                    if (patientGender === 'không rõ') {
                        const pid = patientInfo.id ? String(patientInfo.id) : null;
                        const genderTd = pid
                            ? (document.querySelector(`tr#${pid} td[aria-describedby$='_GIOITINH']`) ||
                               document.querySelector(`tr#${pid} td[aria-describedby$='_GT']`) ||
                               document.querySelector(`tr#${pid} td[aria-describedby$='_PHAI']`))
                            : null;
                        if (genderTd) {
                            const gt = genderTd.textContent.trim().toLowerCase();
                            if (gt === '1' || gt === 'nam' || gt === 'male') patientGender = 'Nam';
                            else if (gt === '2' || gt === 'nữ' || gt === 'nu' || gt === 'female') patientGender = 'Nữ';
                            else patientGender = genderTd.textContent.trim() || 'không rõ';
                        }
                    }
                } catch (_) { /* ignore */ }

                // ── Context lâm sàng (Rich prompt v1.2.0) ──────────────────
                // [BẢO MẬT] Mã BN ẩn danh, không gửi tên/địa chỉ thật

                // 1. Chẩn đoán (tên đầy đủ, ưu tiên diagHistory)
                let contextDiag = '';
                if (patientInfo.diagHistory && patientInfo.diagHistory.length > 0) {
                    contextDiag = patientInfo.diagHistory.join('; ');
                } else if (patientInfo.diagnosis) {
                    contextDiag = patientInfo.diagnosis;
                }
                if (!contextDiag) contextDiag = 'Chưa rõ chẩn đoán';

                // 2. Thuốc (đầy đủ, loại trùng theo tên, kèm đường dùng)
                const uniqueDrugs = [...new Map(drugs.map(d => [d.TENTHUOC, d])).values()];
                const contextDrugs = uniqueDrugs
                    .map(d => {
                        let entry = d.TENTHUOC || '';
                        if (!entry) return '';
                        if (d.HAMLUONG?.trim()) entry += ` ${d.HAMLUONG.trim()}`;
                        const parts = [];
                        if (d.SOLUONG) parts.push(`${d.SOLUONG} ${d.DONVITINH || ''}/ngày`.trim());
                        if (d.DUONGDUNG?.trim()) parts.push(d.DUONGDUNG.trim());
                        if (d.CACHDUNG?.trim() && d.CACHDUNG.trim() !== d.DUONGDUNG?.trim()) parts.push(d.CACHDUNG.trim());
                        if (parts.length > 0) entry += ` (${parts.join(', ')})`;
                        return entry;
                    })
                    .filter(Boolean).join('; ');

                // 3. XN bất thường
                const contextAbn = abnormals.length > 0
                    ? abnormals.slice(0, 12).map(a => {
                        const ref = a.refDisplay ? ` [BT: ${a.refDisplay}]` : '';
                        return `${a.testName || a.code}: ${a.value}${a.unit ? ' ' + a.unit : ''}${ref} (!)`;
                    }).join('; ')
                    : '';

                // 4. Toàn bộ panel XN ngày gần nhất (ưu tiên bất thường trước)
                const latestLabDate = sortedDates.length > 0 ? sortedDates[sortedDates.length - 1] : null;
                const fullLabLines = [];
                if (latestLabDate) {
                    // Bất thường trước
                    for (const [_c1, tests] of Object.entries(grouped)) {
                        for (const [code, info] of Object.entries(tests)) {
                            const entry = info.values[latestLabDate];
                            if (!entry || !_isAbnormal(entry.status)) continue;
                            const ref = info.refDisplay ? ` [BT: ${info.refDisplay}]` : '';
                            fullLabLines.push(`${code}: ${entry.value}${info.unit ? ' ' + info.unit : ''}${ref} (!)`);
                        }
                    }
                    // Bình thường sau
                    for (const [_c2, tests] of Object.entries(grouped)) {
                        for (const [code, info] of Object.entries(tests)) {
                            const entry = info.values[latestLabDate];
                            if (!entry || _isAbnormal(entry.status)) continue;
                            const ref = info.refDisplay ? ` [BT: ${info.refDisplay}]` : '';
                            fullLabLines.push(`${code}: ${entry.value}${info.unit ? ' ' + info.unit : ''}${ref}`);
                        }
                    }
                }
                const contextFullLabs = fullLabLines.length > 0
                    ? `Ngày ${latestLabDate} — ${fullLabLines.slice(0, 60).join('; ')}`
                    : '';

                // 5. Khám vào viện (admissionExam) — ẩn danh: không gửi tên/CMND
                const historyDataForAI = patientInfo?.clinicalData?.history || {};
                const admFields = [
                    { key: 'LYDOVAOVIEN', label: 'Lý do vào viện' },
                    { key: 'QUATRINHBENHLY', label: 'Bệnh sử' },
                    { key: 'TIENSUBENH_BANTHAN', label: 'Tiền sử bản thân' },
                    { key: 'TIENSUBENH_GIADINH', label: 'Tiền sử gia đình' },
                    { key: 'KHAMBENH_TOANTHAN', label: 'Khám toàn thân' },
                    { key: 'KHAMBENH_BOPHAN', label: 'Khám bộ phận' },
                ];
                const admLines = admFields
                    .filter(f => historyDataForAI[f.key])
                    .map(f => `${f.label}: ${String(historyDataForAI[f.key]).slice(0, 300)}`);

                // Tóm tắt CLS (có 2 key khác nhau tùy loại bệnh án)
                const clsSummary = historyDataForAI.TOMTATKQCANLAMSANG || historyDataForAI.KHAMBENH_TOMTATKQCANLAMSANG || '';
                if (clsSummary) admLines.push(`Tóm tắt CLS: ${String(clsSummary).slice(0, 300)}`);

                const contextAdmission = admLines.join('\n');

                // 5b. Sinh hiệu lúc nhập viện
                const vitalParts = [];
                if (historyDataForAI.KHAMBENH_MACH) vitalParts.push(`Mạch: ${historyDataForAI.KHAMBENH_MACH} l/p`);
                if (historyDataForAI.KHAMBENH_NHIETDO) vitalParts.push(`T°: ${historyDataForAI.KHAMBENH_NHIETDO}°C`);
                const haHigh = historyDataForAI.KHAMBENH_HUYETAP || historyDataForAI.KHAMBENH_HUYETAP_HIGH || '';
                const haLow = historyDataForAI.KHAMBENH_HUYETAP_DUOI || historyDataForAI.KHAMBENH_HUYETAP_LOW || '';
                if (haHigh || haLow) vitalParts.push(`HA: ${haHigh || '?'}/${haLow || '?'} mmHg`);
                if (historyDataForAI.KHAMBENH_NHIPTHO) vitalParts.push(`NT: ${historyDataForAI.KHAMBENH_NHIPTHO} l/p`);
                if (historyDataForAI.KHAMBENH_CANNANG) vitalParts.push(`CN: ${historyDataForAI.KHAMBENH_CANNANG} kg`);
                if (historyDataForAI.KHAMBENH_CHIEUCAO) vitalParts.push(`CC: ${historyDataForAI.KHAMBENH_CHIEUCAO} cm`);
                const contextVitals = vitalParts.length > 0 ? `SINH HIỆU: ${vitalParts.join(', ')}` : '';

                // 6. Diễn tiến 3 ngày gần nhất
                const recentDates = sortedDates.slice(-3).reverse(); // mới nhất trước
                const progressLines = [];
                for (const d of recentDates) {
                    const dayTreatments = treatmentsByDate?.[d] || [];
                    if (dayTreatments.length === 0) continue;
                    const dayText = dayTreatments
                        .slice(0, 5)
                        .map(t => {
                            const txt = t.DIENBIEN || t.NOIDUNG || t.CHANDOAN || t.GHI_CHU || '';
                            return txt.slice(0, 200);
                        })
                        .filter(Boolean)
                        .join(' | ');
                    if (dayText) progressLines.push(`[${d}] ${dayText}`);
                }
                const contextProgress = progressLines.join('\n');

                const yLenhLines = (yLenhList || []).slice(0, 12).map(order => {
                    const date = order.NGAYMAUBENHPHAM || '';
                    const group = order.NHOMYLENH ? `[${order.NHOMYLENH}] ` : '';
                    const text = order.YLENH || order.GHICHU || '';
                    if (!text) return null;
                    return `- ${date ? date + ': ' : ''}${group}${String(text).slice(0, 180)}`;
                }).filter(Boolean);
                const contextOtherOrders = yLenhLines.join('\n');

                const admissionTimelineParts = [];
                if (admissionTimes.thoiGianVaoVien) admissionTimelineParts.push(`Vào viện: ${admissionTimes.thoiGianVaoVien}`);
                if (admissionTimes.ngayVaoKhoa) admissionTimelineParts.push(`Vào khoa: ${admissionTimes.ngayVaoKhoa}`);
                if (admissionTimes.thoiGianRaVien) admissionTimelineParts.push(`Ra viện: ${admissionTimes.thoiGianRaVien}`);
                if (admissionTimes.soNgayDieuTri) admissionTimelineParts.push(`Số ngày điều trị: ${admissionTimes.soNgayDieuTri}`);
                const contextAdmissionTimeline = admissionTimelineParts.join('; ');

                // 7. CĐHA (mô tả kết quả)
                const imagingLines = (imgList || []).slice(0, 5).map(img => {
                    const name = img.name || img.TENLOAI || img.TENKQ || img.TENXN || 'CĐHA';
                    const desc = img.conclusion || img.KETQUA || img.MOTA || img.NOIDUNG || '';
                    const date = img.sheetDate || img.NGAYKQ || img.NGAYTRA || '';
                    if (!desc) return null;
                    return `- ${name}${date ? ' (' + date + ')' : ''}: ${String(desc).slice(0, 200)}`;
                }).filter(Boolean);
                const contextImaging = imagingLines.join('\n');

                // ── Prompt template ────────────────────────────────────────
                let promptTemplate = '';
                try {
                    const stored = await new Promise(r => chrome.storage.local.get(['aladinn_ai_prompts'], r));
                    promptTemplate = stored?.aladinn_ai_prompts?.cls_summary || '';
                } catch (_) { /* fallback */ }

                if (!promptTemplate.trim()) {
                    promptTemplate = `Bạn là bác sĩ đang hội chẩn nội bộ (mã BN: {{patientRef}}, SN: {{birthYear}}, giới tính: {{gender}}).
Dữ liệu lâm sàng (đã ẩn danh):

CHẨN ĐOÁN: {{diagnosis}}

{{admissionExam}}

{{vitalSigns}}

{{recentProgress}}

{{otherOrders}}

XÉT NGHIỆM ({{labDate}}):
{{fullLabs}}

{{imaging}}

THUỐC: {{drugs}}

Ngày điều trị: {{treatmentDay}}

Trình bày ngắn gọn theo cấu trúc:
1. Tóm tắt bệnh (1–2 câu, nêu mức độ nặng và vấn đề chính)
2. Điểm lưu ý / nguy cơ lâm sàng (tối đa 3 ý, bao gồm tương tác thuốc hoặc chống chỉ định nếu phát hiện)
3. Đánh giá đáp ứng điều trị (dựa trên diễn tiến lâm sàng và xét nghiệm)
4. Hướng xử trí đề xuất (tối đa 3 ý, mỗi ý 1 can thiệp cụ thể)
Dùng ngôn ngữ y khoa chuyên nghiệp. NGẮN GỌN. KHÔNG viết câu mở đầu hay lời chào hỏi. Bắt đầu ngay vào nội dung.`;
                }

                const admSection      = contextAdmission ? `KHÁM VÀO VIỆN:\n${contextAdmission}` : '';
                const progressSection = contextProgress  ? `DIỄN TIẾN GẦN ĐÂY:\n${contextProgress}` : '';
                const ordersSection   = contextOtherOrders ? `Y LỆNH KHÁC / CHẾ ĐỘ ĂN / CHĂM SÓC:\n${contextOtherOrders}` : '';
                const imagingSection  = contextImaging   ? `CĐHA:\n${contextImaging}` : '';
                const abnSection      = contextAbn       ? `XN BẤT THƯỜNG: ${contextAbn}` : '';
                const treatmentDayStr = contextAdmissionTimeline || (allDates.length > 0 ? `${allDates.length} ngày (từ ${allDates[allDates.length - 1]} đến ${allDates[0]})` : 'Chưa rõ');

                const prompt = promptTemplate
                    .replace('{{patientRef}}',    patientRef)
                    .replace('{{birthYear}}',     birthYear)
                    .replace('{{gender}}',        patientGender)
                    .replace('{{diagnosis}}',     contextDiag)
                    .replace('{{admissionExam}}', admSection)
                    .replace('{{vitalSigns}}',    contextVitals)
                    .replace('{{recentProgress}}',progressSection)
                    .replace('{{otherOrders}}',   ordersSection)
                    .replace('{{labDate}}',       latestLabDate || 'không rõ')
                    .replace('{{fullLabs}}',      contextFullLabs || abnSection || 'Không có dữ liệu XN')
                    .replace('{{imaging}}',       imagingSection)
                    .replace('{{drugs}}',         contextDrugs || 'Không rõ')
                    .replace('{{treatmentDay}}',  treatmentDayStr)
                    // backward compat với template cũ
                    .replace('{{abnormal}}',      abnSection)
                    .replace('{{keylabs}}',       '');

                if (copyOnly) {
                    await copyPromptToClipboard(prompt);
                    return;
                }

                const unlocked = await window.HIS.ApiKeyService.ensureUnlocked();
                if (!unlocked) {
                    setCopyPromptMode(true);
                    showAIState('placeholder');
                    window.VNPTRealtime?.showToast?.('⚠️ Chưa mở khóa AI. Có thể copy prompt để dùng AI ngoài.', 'warning');
                    return;
                }

                const model = await window.HIS.getAiModel();
                const promptHash = await sha256Short(prompt);
                const cacheKey = `cls:${patientInfo.id || patientRef}:${model}:${promptHash}`;
                if (forceRefresh) {
                    await removeAiCache(cacheKey);
                }
                const cached = forceRefresh ? null : await getAiCache(cacheKey);
                const data = cached?.data || await requestScannerAI(prompt, model);
                if (!cached?.data) {
                    await setAiCache(cacheKey, { data });
                } else if (window.VNPTRealtime?.showToast) {
                    window.VNPTRealtime.showToast('⚡ Đã dùng kết quả AI đã lưu. Bấm "Phân tích lại" để cập nhật.', 'info');
                }

                if (data.text) {
                    const text = data.text;

                    // ── Responsive font scaling (tự động theo độ phân giải màn hình) ──
                    // clamp: min 13px (laptop nhỏ 1366px) → max 19px (màn 27"+)
                    const _vw = window.innerWidth;
                    const basePx  = Math.max(15, Math.min(20, Math.round(_vw * 0.009))); // body text
                    const smPx    = Math.max(11, Math.round(basePx * 0.82));               // badge number
                    const badgeSz = Math.max(22, basePx + 10);                             // badge circle px
                    const indPx   = Math.max(28, basePx + 16);                             // sub-heading indent

                    const safeHtml = renderSafeAiMarkdown(text, { basePx, smPx, badgeSz, indPx });
                    if (aiResultBody) aiResultBody.innerHTML = `<div style="font-size:${basePx}px;line-height:1.75;">${safeHtml}</div>`;

                    // ── Token cost toast (in-modal, same z-index as overlay) ─────────
                    const _showCostToast = (msg) => {
                        const existingToast = document.getElementById('ald-cost-toast');
                        if (existingToast) existingToast.remove();
                        const toast = document.createElement('div');
                        toast.id = 'ald-cost-toast';
                        toast.style.cssText = [
                            'position:fixed', 'bottom:24px', 'right:28px',
                            'z-index:2147483647',
                            'background:rgba(18,14,10,0.92)',
                            'border:1px solid rgba(212,168,83,0.35)',
                            'border-radius:10px',
                            'padding:8px 14px',
                            'display:flex', 'align-items:center', 'gap:8px',
                            'font-family:Outfit,system-ui,sans-serif',
                            'font-size:12px', 'color:#c8a455',
                            'box-shadow:0 4px 20px rgba(0,0,0,0.5),0 0 12px rgba(212,168,83,0.1)',
                            'backdrop-filter:blur(8px)',
                            'animation:ald-toast-in 0.25s cubic-bezier(0.34,1.56,0.64,1)',
                            'pointer-events:none',
                        ].join(';');
                        toast.innerHTML = `
                            <style>
                                @keyframes ald-toast-in{from{opacity:0;transform:translateY(10px) scale(0.95)}to{opacity:1;transform:translateY(0) scale(1)}}
                                @keyframes ald-toast-out{from{opacity:1;transform:translateY(0)}to{opacity:0;transform:translateY(6px)}}
                            </style>
                            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#D4A853" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4l3 3"/></svg>
                            <span>${escapeHtml(msg)}</span>`;
                        document.body.appendChild(toast);
                        setTimeout(() => {
                            toast.style.animation = 'ald-toast-out 0.3s ease forwards';
                            setTimeout(() => toast.remove(), 320);
                        }, 5000);
                    };

                    if (data.usageMetadata) {
                        const prompt    = data.usageMetadata.promptTokenCount || 0;
                        const candidate = data.usageMetadata.candidatesTokenCount || 0;
                        const total     = prompt + candidate;
                        if (window.HIS?.AICost) {
                            window.HIS.AICost.record(model, prompt, candidate).then(est => {
                                const costStr = est?.vndDisplay || '';
                                _showCostToast(`💰 ${total.toLocaleString()} tokens${costStr ? ' · ' + costStr : ''} · ${model.replace('gemini-','')}`);
                            });
                        } else {
                            // Ước tính thủ công nếu AICost chưa sẵn sàng
                            // gemini-2.0-flash: ~$0.075/1M input, $0.30/1M output → ~0.075*prompt+0.30*cand tokens /1e6 USD * 25000 VNĐ
                            const usd = (prompt * 0.075 + candidate * 0.30) / 1_000_000;
                            const vnd = usd * 25_000;
                            const costStr = vnd > 0 ? `~${vnd.toFixed(2).replace('.', ',')} VNĐ` : '';
                            _showCostToast(`💰 ${total.toLocaleString()} tokens${costStr ? ' · ' + costStr : ''} · ${model.replace('gemini-','')}`);
                        }
                    }

                    // ── Search links (per ICD — grouped) ──────────────────────────
                    const allIcdCodes = [];
                    if (patientInfo.diagHistory && patientInfo.diagHistory.length > 0) {
                        for (const d of patientInfo.diagHistory) {
                            for (const c of (d.match(/\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g) || [])) {
                                if (!allIcdCodes.includes(c)) allIcdCodes.push(c);
                            }
                        }
                    }
                    if (allIcdCodes.length === 0) {
                        const fb = contextDiag.match(/\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g) || [];
                        allIcdCodes.push(...[...new Set(fb)].slice(0, 5));
                    }

                    // Xây dựng map ICD → tên bệnh từ diagHistory
                    // diagHistory có thể là mảng chuỗi như: ["S22.30 gãy xương sườn II, III, IV; I10 Tăng huyết áp"]
                    // → tách từng đoạn bằng regex để lấy tên đúng cho từng mã
                    const icdNameMap = {};
                    const combinedDiag = (patientInfo.diagHistory || []).join(' ; ');
                    // Tìm tất cả mã ICD và phần mô tả theo sau (đến mã kế tiếp hoặc hết chuỗi)
                    const icdSegmentRe = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b\s*([^A-Z\d;]*(?:[a-z\d][^;[A-Z]*)?)/g;
                    let seg;
                    while ((seg = icdSegmentRe.exec(combinedDiag)) !== null) {
                        const icd = seg[1];
                        const desc = seg[2].replace(/^[\s,;-]+|[\s,;-]+$/g, '').replace(/\s+/g, ' ').slice(0, 50);
                        if (!icdNameMap[icd] && desc) icdNameMap[icd] = desc;
                    }

                    const icdGroups = allIcdCodes.slice(0, 4).map(code => {
                        const displayName = icdNameMap[code] || '';
                        return {
                            code, displayName,
                            links: [
                                { label:'Phác đồ BYT', url:`https://www.google.com/search?q=${encodeURIComponent(code + ' phác đồ điều trị')}`, color:'#D4A853', icon:'🏥' },
                                { label:'KCB.vn', url:`https://kcb.vn/?s=${encodeURIComponent(code)}`, color:'#60a5fa', icon:'📋' },
                                { label:'UpToDate', url:`https://www.google.com/search?q=${encodeURIComponent('site:uptodate.com ' + code)}`, color:'#22c55e', icon:'🌐' },
                                { label:'ICD Tra cứu', url:`https://www.google.com/search?q=${encodeURIComponent(code + ' ICD-10 là gì')}`, color:'#a78bfa', icon:'🔍' },
                            ]
                        };
                    });

                    if (icdGroups.length > 0 && aiLinksWrap && aiSearchWrap) {
                        aiLinksWrap.innerHTML = icdGroups.map(g => `
                            <div style="padding:8px 10px;background:rgba(255,255,255,0.02);border:1px solid rgba(255,255,255,0.06);border-radius:8px;">
                                <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
                                    <code style="font-size:11px;font-weight:800;color:#D4A853;background:rgba(212,168,83,0.15);padding:2px 7px;border-radius:4px;letter-spacing:0.3px;">${escapeHtml(g.code)}</code>
                                    <span style="font-size:11px;color:#9a8e7e;">${escapeHtml(g.displayName)}</span>
                                </div>
                                <div style="display:flex;gap:5px;flex-wrap:wrap;">
                                    ${g.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener" title="${escapeHtml(l.label)}: ${escapeHtml(g.code)}"
                                        style="display:inline-flex;align-items:center;gap:3px;font-size:10px;color:${l.color};font-weight:600;text-decoration:none;background:rgba(255,255,255,0.03);border:1px solid ${l.color}22;border-radius:5px;padding:3px 8px;white-space:nowrap;transition:all 0.15s;"
                                        onmouseover="this.style.background='${l.color}15';this.style.borderColor='${l.color}44'"
                                        onmouseout="this.style.background='rgba(255,255,255,0.03)';this.style.borderColor='${l.color}22'">${l.icon} ${l.label}</a>`).join('')}
                                </div>
                            </div>
                        `).join('');
                        aiSearchWrap.style.display = 'block';
                    }

                    // Show disclaimer
                    const disclaimerEl = modal.querySelector('#ai-disclaimer');
                    if (disclaimerEl) disclaimerEl.style.display = 'block';

                    showAIState('result');
                    aiResultLoaded = true;
                } else {
                    throw new Error('Lỗi từ máy chủ AI');
                }
            } catch (e) {
                showAIState('error');
                if (aiError) aiError.textContent = '❌ Lỗi AI: ' + e.message;
            } finally {
                if (btnStart)  btnStart.disabled  = false;
                if (btnRerun)  btnRerun.disabled  = false;
                if (btnCopyPrompt) btnCopyPrompt.disabled = false;
            }
        }

        btnStart?.addEventListener('click', () => runAIAnalysis(false));
        btnRerun?.addEventListener('click', () => { aiResultLoaded = false; runAIAnalysis(true); });
        btnCopyPrompt?.addEventListener('click', () => runAIAnalysis(false, true));
    }

})();
