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

            // Standalone Ai Lab Summary function for Popup to call
            async function showAiLabSummary() {
                try {
                    const pid = window.VNPTStore?.get('selectedPatientId') || 'UNKNOWN';
                    if (pid === 'UNKNOWN') {
                        window.VNPTRealtime?.showToast('⚠️ Vui lòng chọn một bệnh nhân trên lưới trước.', 'warning');
                        return;
                    }
                    
                    window.VNPTRealtime?.showToast('🪄 Đang tải CLS + Thuốc từ VNPT HIS...', 'info');
                    
                    const fetchLabsFromBridge = (rowId) => {
                        return new Promise((resolve) => {
                            const requestId = Date.now().toString() + Math.random().toString().slice(2);
                            const token = window.__ALADINN_BRIDGE_TOKEN__ || '';
                            
                            const listener = (event) => {
                                if (event.data && event.data.type === 'FETCH_LABS_RESULT' && event.data.requestId === requestId) {
                                    window.removeEventListener('message', listener);
                                    resolve({ labs: event.data.labsData || [], imaging: event.data.imagingData || [], patientName: event.data.patientName || '' });
                                }
                            };
                            window.addEventListener('message', listener);
                            
                            window.postMessage({
                                type: 'REQ_FETCH_LABS',
                                rowId: rowId,
                                requestId: requestId,
                                token: token
                            }, window.location.origin);
                            
                            setTimeout(() => {
                                window.removeEventListener('message', listener);
                                resolve(null);
                            }, 20000);
                        });
                    };

                    const fetchDrugsFromBridge = (rowId) => {
                        return new Promise((resolve) => {
                            const requestId = 'drugs_' + Date.now().toString() + Math.random().toString().slice(2);
                            const token = window.__ALADINN_BRIDGE_TOKEN__ || '';
                            
                            const listener = (event) => {
                                if (event.data && event.data.type === 'FETCH_DRUGS_CLS_RESULT' && event.data.requestId === requestId) {
                                    window.removeEventListener('message', listener);
                                    resolve({ drugList: event.data.drugList || [] });
                                }
                            };
                            window.addEventListener('message', listener);
                            
                            window.postMessage({
                                type: 'REQ_FETCH_DRUGS_CLS',
                                rowId: rowId,
                                requestId: requestId,
                                token: token
                            }, window.location.origin);
                            
                            setTimeout(() => {
                                window.removeEventListener('message', listener);
                                resolve({ drugList: [] });
                            }, 15000);
                        });
                    };

                    const fetchHistoryFromBridge = (rowId) => {
                        return new Promise((resolve) => {
                            const requestId = 'hist_' + Date.now().toString() + Math.random().toString().slice(2);
                            const token = window.__ALADINN_BRIDGE_TOKEN__ || '';
                            
                            const listener = (event) => {
                                if (event.data && event.data.type === 'FETCH_HISTORY_RESULT' && event.data.requestId === requestId) {
                                    window.removeEventListener('message', listener);
                                    resolve(event.data.history || {});
                                }
                            };
                            window.addEventListener('message', listener);
                            
                            window.postMessage({
                                type: 'REQ_FETCH_HISTORY',
                                rowId: rowId,
                                requestId: requestId,
                                token: token
                            }, window.location.origin);
                            
                            setTimeout(() => {
                                window.removeEventListener('message', listener);
                                resolve({});
                            }, 10000);
                        });
                    };

                    const fetchTreatmentFromBridge = (rowId) => {
                        return new Promise((resolve) => {
                            const requestId = 'treat_' + Date.now().toString() + Math.random().toString().slice(2);
                            const token = window.__ALADINN_BRIDGE_TOKEN__ || '';
                            
                            const listener = (event) => {
                                if (event.data && event.data.type === 'FETCH_TREATMENT_RESULT' && event.data.requestId === requestId) {
                                    window.removeEventListener('message', listener);
                                    resolve(event.data.treatmentList || []);
                                }
                            };
                            window.addEventListener('message', listener);
                            
                            window.postMessage({
                                type: 'REQ_FETCH_TREATMENT',
                                rowId: rowId,
                                requestId: requestId,
                                token: token
                            }, window.location.origin);
                            
                            setTimeout(() => {
                                window.removeEventListener('message', listener);
                                resolve([]);
                            }, 10000);
                        });
                    };

                    const [result, drugsResult, historyData, treatmentList] = await Promise.all([
                        fetchLabsFromBridge(pid),
                        fetchDrugsFromBridge(pid),
                        fetchHistoryFromBridge(pid),
                        fetchTreatmentFromBridge(pid)
                    ]);
                    const labs = result?.labs || [];
                    const imaging = result?.imaging || [];
                    const drugs = drugsResult?.drugList || [];
                    
                    const storeName = window.VNPTStore?.get('selectedPatientName');
                    const patientName = storeName || result?.patientName || 'Bệnh Nhân';
                    
                    let age = '';
                    let diagnosis = '';
                    try {
                        const tr = document.getElementById(pid);
                        if (tr) {
                            const ageTd = tr.querySelector("td[aria-describedby$='_TUOI']") || tr.querySelector("td[aria-describedby$='_NAMSINH']");
                            if (ageTd) age = ageTd.textContent.trim();
                            const diagTd = tr.querySelector("td[aria-describedby$='_CHANDOAN']");
                            if (diagTd) diagnosis = diagTd.textContent.trim();
                        }
                    } catch (_e) {}

                    const patientInfo = { 
                        age, 
                        diagnosis,
                        clinicalData: {
                            history: historyData || {},
                            treatments: treatmentList || []
                        }
                    };

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

        window.VNPTScanFlow.start(mode, {
            singleRow: singleRow,
            onStart: (m) => {
                if (window.VNPTMenuManager) window.VNPTMenuManager.toggleStopButton(true);
                if (window.VNPTRealtime) window.VNPTRealtime.showToast(`🚀 Bắt đầu quét ${m}...`, 'info');
            },
            onProgress: (count, total) => {
                const percent = Math.round((count / total) * 100);
                if (window.VNPTMenuManager) window.VNPTMenuManager.updateProgress(percent);
                if (window.VNPTUI) window.VNPTUI.updateProgress(count, total);
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
            onBhytFound: async (tr, diagnoses, drugs) => {
                console.log(`[Aladinn Scanner] BHYT Scan - Row ${tr.id}`);
                console.log(' - Chẩn đoán:', diagnoses);
                console.log(' - Thuốc:', drugs);

                if (window.Aladinn && window.Aladinn.CDS && typeof window.Aladinn.CDS.analyzeLocally === 'function') {
                    try {
                        const context = {
                            diagnoses: diagnoses || [],
                            drugs: drugs || [],
                            patientInfo: { age: 30, gender: 'unknown' } // Baseline info to satisfy engine validation
                        };
                        const result = await window.Aladinn.CDS.analyzeLocally(context, true); // true = filterLow
                        const bhytAlerts = result.alerts.filter(a => a.domain === 'insurance' || a.domain === 'clinical');
                        injectBhytBadge(tr, bhytAlerts.length, bhytAlerts);
                    } catch (err) {
                        console.error('[Scanner] Error running BHYT analysis:', err);
                    }
                }
            },
            onComplete: (m, stats) => {
                if (window.VNPTMenuManager) {
                    window.VNPTMenuManager.toggleStopButton(false);
                    window.VNPTMenuManager.updateProgress(100, true);
                }
                if (window.VNPTRealtime) window.VNPTRealtime.showToast(`✅ Quét ${m} hoàn tất!`, 'success');
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

    function injectBhytBadge(tr, count, alerts = []) {
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
            badge.innerHTML = '⚠️';
            badge.style.cssText = 'font-size: 14px; display: inline-block; margin-left: 6px; vertical-align: text-top; filter: drop-shadow(0 0 2px rgba(255,0,0,0.8)); cursor: help;';
            const alertText = alerts.map(a => `- ${a.title}`).join('\\n');
            badge.title = `Phát hiện ${count} rủi ro BHYT:\\n${alertText}`;
            tr.style.backgroundColor = 'rgba(232, 168, 56, 0.15)'; // Highlight row with warning color
        } else {
            badge.innerHTML = '✅';
            badge.style.cssText = 'font-size: 14px; display: inline-block; margin-left: 6px; vertical-align: text-top; filter: grayscale(100%); opacity: 0.5;';
            badge.title = 'BHYT Hợp lệ';
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
        'Huyết học (Tế bào máu)': ['WBC','NEU','NEU%','RBC','HGB','HCT','PLT','MCV','MCH','MCHC','RDW','RDW-CV','RDW-SD','MPV','PDW','PDW-SD','PCT','LYM','LYM%','MONO','MONO%','EOS','EOS%','BASO','BASO%','P-LCR','NLR'],
        'Huyết học (Đông máu)': ['PT','PT%','PT INR','PT s','PT Mean','PT Rate','APTT','APTT s','APTT Mean','APTT Rate','APTT ratio','Fibrinogen','INR','TT','D-Dimer'],
        'Huyết học (Nhóm máu)': ['ABO','Rh'],
        'Sinh hóa': ['Glucose','Ure','Creatinin','eGFR','AST','ALT','GPT','GOT','GGT','Bilirubin','Protein','Albumin','CRP','LDH','CK','Amylase','Lipase','Acid Uric','Cholesterol','Triglycerid','HDL','LDL','HbA1c','Cortisol','Procalcitonin','Troponin','BNP','NT-proBNP','Na','K','Cl','Ca','Mg','Phospho'],
        'Nước tiểu': ['pH','Protein niệu','Glucose niệu','Hồng cầu niệu','Bạch cầu niệu','Nitrit','Ketone','Bilirubin niệu','Urobilinogen','Tỷ trọng','GLU','BIL','KET','SG','BLD','PRO','UBG','NIT','LEU']
    };

    function _classifyLab(code, testName) {
        const combined = (code + ' ' + testName).toUpperCase();
        for (const [cat, keywords] of Object.entries(LAB_CATEGORIES)) {
            for (const kw of keywords) {
                const kwUpper = kw.toUpperCase();
                if (/^[A-Z0-9]+$/.test(kwUpper)) {
                    const regex = new RegExp(`\\b${kwUpper}\\b`);
                    if (regex.test(combined)) return cat;
                } else {
                    if (combined.includes(kwUpper)) return cat;
                }
            }
        }
        // Fallback heuristics
        if (combined.includes('NƯỚC TIỂU') || combined.includes('NIỆU') || combined.match(/\b(GLU|BIL|KET|SG|BLD|PRO|UBG|NIT|LEU)\b/)) return 'Nước tiểu';
        if (combined.includes('ĐÔNG MÁU') || combined.includes('PROTHROMBIN') || combined.includes('THROMBOPLASTIN')) return 'Huyết học (Đông máu)';
        if (combined.includes('NHÓM MÁU')) return 'Huyết học (Nhóm máu)';
        if (combined.includes('HUYẾT ĐỒ') || combined.includes('TẾ BÀO MÁU') || combined.includes('CÔNG THỨC MÁU') || combined.includes('HUYẾT HỌC')) return 'Huyết học (Tế bào máu)';
        if (combined.includes('SINH HÓA') || combined.includes('HÓA SINH') || combined.includes('HOẠT ĐỘ') || combined.includes('ĐỊNH LƯỢNG') || combined.includes('ĐỘ LỌC') || combined.includes('ĐIỆN GIẢI')) return 'Sinh hóa';
        return 'Sinh hóa';
    }

    function showLabTimelineModal(labs, imaging, drugs, patientName = 'Bệnh Nhân', patientInfo = {}) {
        const existing = document.getElementById('vnpt-lab-timeline-modal');
        if (existing) existing.remove();
        const imgList = imaging || [];

        // ─── Helper: Lấy PACS URL qua bridge (getHashRIS trong HIS tab) ───
        function fetchPacsUrlFromBridge(pacsConfig) {
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
            const cat = _classifyLab(l.code || '', l.testName || '');
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
        const masterGrouped = {};
        for (const cat of Object.keys(grouped)) {
             let mCat = cat;
             if (cat.startsWith('Huyết học')) mCat = 'Huyết học';
             if (!masterGrouped[mCat]) masterGrouped[mCat] = {};
             masterGrouped[mCat][cat] = grouped[cat];
        }

        const mCatOrder = ['Huyết học', 'Sinh hóa', 'Nước tiểu'];
        const sortedMCats = Object.keys(masterGrouped).sort((a,b) => mCatOrder.indexOf(a) - mCatOrder.indexOf(b));
        
        const catIcons = { 'Huyết học':'🩸', 'Sinh hóa':'🧪', 'Nước tiểu':'💧' };

        // --- Summary Cards ---
        const summaryCards = `<div style="display:grid; grid-template-columns: repeat(3, 1fr); gap:10px; margin-bottom:16px;">
          <div style="background:rgba(212,162,90,0.1); border:1px solid rgba(212,162,90,0.25); border-radius:10px; padding:12px;">
            <div style="font-size:10px; color:#a18764; text-transform:uppercase; letter-spacing:1px; font-weight:700;">🧪 Tổng chỉ số</div>
            <div style="font-size:22px; font-weight:800; color:#d4a25a; margin-top:4px;">${totalIndicators}</div>
            <div style="font-size:10px; color:#7a6e5e; margin-top:2px;">${sortedMCats.length} nhóm XN</div>
          </div>
          <div style="background:${abnormals.length > 0 ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)'}; border:1px solid ${abnormals.length > 0 ? 'rgba(239,68,68,0.25)' : 'rgba(34,197,94,0.25)'}; border-radius:10px; padding:12px;">
            <div style="font-size:10px; color:${abnormals.length > 0 ? '#f87171' : '#6ee7a0'}; text-transform:uppercase; letter-spacing:1px; font-weight:700;">⚠️ Bất thường</div>
            <div style="font-size:22px; font-weight:800; color:${abnormals.length > 0 ? '#f87171' : '#22c55e'}; margin-top:4px;">${abnormals.length}</div>
            <div style="font-size:10px; color:#7a6e5e; margin-top:2px;">${abnormals.length > 0 ? 'Cần lưu ý' : 'Tất cả bình thường'}</div>
          </div>
          <div style="background:rgba(212,162,90,0.1); border:1px solid rgba(212,162,90,0.25); border-radius:10px; padding:12px;">
            <div style="font-size:10px; color:#a18764; text-transform:uppercase; letter-spacing:1px; font-weight:700;">📅 Ngày XN</div>
            <div style="font-size:22px; font-weight:800; color:#d4a25a; margin-top:4px;">${sortedDates.length}</div>
            <div style="font-size:10px; color:#7a6e5e; margin-top:2px;">${firstDate} → ${latestDate}</div>
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
              <div style="font-size:11px; font-weight:700; color:#f87171; margin-bottom:8px; text-transform:uppercase; letter-spacing:0.5px;">🔴 Chỉ số bất thường mới nhất</div>
              <div style="display:flex; flex-wrap:wrap; gap:6px;">
                ${abnItems.map(a => {
                    const sc = _statusColor(a.status);
                    return `<span style="display:inline-flex; align-items:center; gap:4px; padding:4px 10px; border-radius:6px; font-size:12px; font-weight:600; background:${sc ? sc.bg : 'rgba(239,68,68,0.15)'}; color:${sc ? sc.text : '#f87171'}; border:1px solid ${sc ? sc.text + '33' : 'rgba(239,68,68,0.3)'};">${a.code || a.testName}: ${a.value} ${a.unit || ''} ${sc ? sc.icon : ''}</span>`;
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
                     mRowsHtml += `<tr><td colspan="${sortedDates.length + 2}" style="padding:5px 10px; background:rgba(212,162,90,0.1); color:#d4a25a; font-weight:700; font-size:10px; text-transform:uppercase; letter-spacing:1px; border-top:1px solid rgba(212,162,90,0.15); border-bottom:1px solid rgba(212,162,90,0.15); position:sticky; left:0; z-index:2;">▪ ${subName}</td></tr>`;
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
                    mRowsHtml += `<td style="padding:6px 8px; color:#7a6e5e; font-size:10px; white-space:nowrap; background:${stickyBg};">${refText}</td>`;

                    for (const d of sortedDates) {
                        const cell = data.values[d];
                        if (cell) {
                            const sc = _statusColor(cell.status);
                            let arrow = '';
                            if (sc && sc.icon) arrow = ` <span style="color:${sc.text};font-size:10px;font-weight:700;">${sc.icon}</span>`;
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
                  <span style="font-size:14px;">${icon}</span>
                  <span style="font-size:13px; font-weight:700; color:#d4a25a;">${mCat}</span>
                  <span style="font-size:10px; color:#a18764; background:rgba(212,162,90,0.15); padding:2px 8px; border-radius:10px;">${mIndicatorsCount} chỉ số</span>
                  ${mHasAbn ? '<span style="font-size:10px; color:#f87171; background:rgba(239,68,68,0.15); padding:2px 8px; border-radius:10px;">⚠ Bất thường</span>' : ''}
                </div>`;
                
                tablesHtml += '<div style="overflow-x:auto;"><table style="width:100%; border-collapse:collapse; font-size:12px;">';
                tablesHtml += `<thead><tr>
                  <th style="padding:7px 10px; text-align:left; background:rgba(0,0,0,0.2); color:#a0937e; font-size:10px; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; position:sticky; left:0; z-index:2;">Chỉ số</th>
                  <th style="padding:7px 10px; text-align:left; background:rgba(0,0,0,0.2); color:#7a6e5e; font-size:10px; font-weight:600; position:sticky; left:0; z-index:2;">Ref</th>`;
                for (const d of sortedDates) {
                    tablesHtml += `<th style="padding:7px 8px; text-align:right; background:rgba(0,0,0,0.2); color:#a0937e; font-size:10px; font-weight:600; white-space:nowrap;">${_shortDate(d)}</th>`;
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
                <span style="font-size:14px;">🩻</span>
                <span style="font-size:13px; font-weight:700; color:#60a5fa;">Chẩn đoán hình ảnh</span>
                <span style="font-size:10px; color:#6b8ab5; background:rgba(96,165,250,0.15); padding:2px 8px; border-radius:10px;">${imgList.length} phiếu</span>
              </div>
              <div style="padding:8px 14px;">
                ${imgList.map(img => {
                    const statusColor = (img.status || '').includes('Đang') ? '#fbbf24' : '#22c55e';
                    const conclusionHtml = img.conclusion ? `<div style="color:#c8b89a; font-size:11px; margin-top:6px; padding:6px 10px; background:rgba(212,162,90,0.06); border-left:2px solid rgba(96,165,250,0.4); border-radius:0 6px 6px 0; line-height:1.5;">${img.conclusion}</div>` : '';
                    return `<div style="padding:10px 0; border-bottom:1px solid rgba(96,165,250,0.08);">
                      <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1;">
                          <div style="color:#e8dcc8; font-size:13px; font-weight:600;">${img.name || 'CĐHA'} ${img.code ? '<span style="color:#6b8ab5; font-size:10px; font-weight:400;">(' + img.code + ')</span>' : ''}</div>
                          <div style="color:#7a6e5e; font-size:10px; margin-top:2px;">${img.department || ''}</div>
                        </div>
                        <div style="display:flex; flex-direction:column; align-items:flex-end; gap:4px; flex-shrink:0; margin-left:12px;">
                          <div style="color:#60a5fa; font-size:11px; font-weight:600;">${_shortDate(img.sheetDate)}</div>
                          <div style="font-size:10px; color:${statusColor};">${img.status || ''}</div>
                          ${img.sheetId ? `<button class="aladinn-pacs-btn" data-sheet-id="${img.sheetId}" data-maubenhphamid="${img.maubenhphamid || ''}" data-sophieu="${img.sophieu || ''}" data-madichvu="${img.madichvu || ''}" data-linkdicom="${img.linkDicom || ''}" style="margin-top:2px; background:linear-gradient(135deg,rgba(96,165,250,0.15),rgba(96,165,250,0.08)); border:1px solid rgba(96,165,250,0.4); color:#60a5fa; padding:4px 10px; border-radius:6px; font-size:11px; font-weight:600; cursor:pointer; transition:all 0.2s; white-space:nowrap;" title="Xem ảnh DICOM trực tiếp">🩻 Xem ảnh</button>` : ''}
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
        const totalUniqueDrugs = uniqueDrugNames.size;
        let _totalAdded = 0, _totalStopped = 0;

        // --- Combined Timeline (Diễn tiến & Thuốc) ---
        const treatments = patientInfo?.clinicalData?.treatments || [];
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
            
            // Add summary cards for drugs
            if (drugDates.length > 0) {
                combinedTimelineHtml += `<div style="display:grid; grid-template-columns: repeat(2, 1fr); gap:10px; margin-bottom:16px;">
                  <div style="background:rgba(16,185,129,0.1); border:1px solid rgba(16,185,129,0.25); border-radius:10px; padding:12px;">
                    <div style="font-size:10px; color:#34d399; text-transform:uppercase; letter-spacing:1px; font-weight:700;">💊 Tổng thuốc</div>
                    <div style="font-size:22px; font-weight:800; color:#34d399; margin-top:4px;">${totalUniqueDrugs}</div>
                    <div style="font-size:10px; color:#7a6e5e; margin-top:2px;">loại thuốc khác nhau</div>
                  </div>
                  <div style="background:rgba(212,162,90,0.1); border:1px solid rgba(212,162,90,0.25); border-radius:10px; padding:12px;">
                    <div style="font-size:10px; color:#d4a25a; text-transform:uppercase; letter-spacing:1px; font-weight:700;">📅 Số ngày dùng thuốc</div>
                    <div style="font-size:22px; font-weight:800; color:#d4a25a; margin-top:4px;">${drugDates.length}</div>
                    <div style="font-size:10px; color:#7a6e5e; margin-top:2px;">${drugDates[drugDates.length-1]} → ${drugDates[0]}</div>
                  </div>
                </div>`;
            }

            for (let di = 0; di < allDates.length; di++) {
                const dt = allDates[di];
                const isToday = dt === todayStr;
                
                const dayDrugs = drugsByDate[dt] || [];
                const dayTreatments = treatmentsByDate[dt] || [];

                let prevDrugs = [];
                for (let pi = di + 1; pi < allDates.length; pi++) {
                    if (drugsByDate[allDates[pi]]) {
                        prevDrugs = drugsByDate[allDates[pi]];
                        break;
                    }
                }
                const prevNames = new Set((prevDrugs || []).map(d => d.TENTHUOC));
                const currNames = new Set(dayDrugs.map(d => d.TENTHUOC));

                combinedTimelineHtml += `<div style="margin-bottom:16px;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px; padding-bottom:6px; border-bottom:1px solid rgba(212,162,90,0.15);">
                    <div style="width:36px; height:36px; border-radius:10px; display:flex; flex-direction:column; align-items:center; justify-content:center; font-weight:800; ${isToday ? 'background:linear-gradient(135deg,#10b981,#059669); color:#fff;' : 'background:rgba(100,100,100,0.2); color:#7a6e5e;'}">
                      <span style="font-size:13px; line-height:1;">${dt.substring(0,2)}</span>
                      <span style="font-size:8px; opacity:0.7;">${dt.substring(3,5)}</span>
                    </div>
                    <div>
                      <span style="font-size:12px; font-weight:700; color:${isToday ? '#34d399' : '#a18764'};">${isToday ? 'Hôm nay' : dt}</span>
                      <span style="font-size:10px; color:#7a6e5e; margin-left:6px;">${dayTreatments.length ? 'Có diễn tiến' : 'Chưa ghi nhận diễn tiến'} • ${dayDrugs.length} thuốc</span>
                    </div>
                  </div>`;

                if (dayTreatments.length > 0) {
                    combinedTimelineHtml += '<div style="margin-bottom:10px; display:flex; flex-direction:column; gap:6px;">';
                    for (const tr of dayTreatments) {
                        if (tr.DIENBIEN) {
                            combinedTimelineHtml += `<div style="padding:10px; border-radius:8px; background:rgba(59,130,246,0.05); border-left:3px solid #3b82f6;">
                                <div style="font-size:11px; color:#94a3b8; margin-bottom:4px; font-weight:600;">${tr.NGAYMAUBENHPHAM || ''}</div>
                                <div style="font-size:13px; color:#e2e8f0; line-height:1.4; white-space:pre-wrap;">${tr.DIENBIEN}</div>
                            </div>`;
                        }
                    }
                    combinedTimelineHtml += '</div>';
                }

                if (dayDrugs.length > 0) {
                    for (const drug of dayDrugs) {
                        const name = drug.TENTHUOC || '—';
                        const isNew = prevDrugs.length > 0 && !prevNames.has(name);
                        if (isNew) _totalAdded++;
                        
                        let fullDrugName = drug.TENTHUOC || '—';
                        if (drug.HOATCHAT && drug.HOATCHAT.trim().toLowerCase() !== fullDrugName.trim().toLowerCase()) {
                            fullDrugName += ` (${drug.HOATCHAT.trim()})`;
                        }
                        if (drug.HAMLUONG && drug.HAMLUONG.trim()) {
                            // Only add parentheses if it's not already wrapped in parentheses
                            const hl = drug.HAMLUONG.trim();
                            if (hl.startsWith('(') && hl.endsWith(')')) {
                                fullDrugName += ` ${hl}`;
                            } else {
                                fullDrugName += ` (${hl})`;
                            }
                        }
                        
                        let totalDose;
                        const doseMatch = (drug.LIEUDUNG || '').match(/\[(.*?)\]/);
                        if (doseMatch && doseMatch[1]) {
                            totalDose = doseMatch[1];
                        } else if (drug.SOLUONG) {
                            totalDose = `${drug.SOLUONG} ${drug.DONVITINH || ''}/ngày`.trim();
                        } else {
                            totalDose = drug.LIEUDUNG || '';
                        }
                        
                        const dotColor = isNew ? '#34d399' : '#a78bfa';
                        const badge = isNew ? '<span style="font-size:9px; padding:1px 5px; border-radius:4px; background:rgba(16,185,129,0.15); color:#34d399; font-weight:700; border:1px solid rgba(16,185,129,0.3); margin-left:6px;">MỚI</span>' : '';
                        combinedTimelineHtml += `<div style="display:flex; align-items:center; gap:8px; padding:6px 8px; margin-bottom:4px; border-radius:8px; background:rgba(30,30,30,0.3); border:1px solid rgba(100,100,100,0.15); transition:background 0.2s;" onmouseover="this.style.background='rgba(50,50,50,0.4)'" onmouseout="this.style.background='rgba(30,30,30,0.3)'">
                          <span style="width:6px; height:6px; border-radius:50%; background:${dotColor}; flex-shrink:0; box-shadow:0 0 6px ${dotColor}40;"></span>
                          <span style="flex:1; font-size:12px; font-weight:600; color:#e8dcc8; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;" title="${fullDrugName}">${fullDrugName}${badge}</span>
                          ${totalDose ? `<span style="font-size:10px; color:#a78bfa; font-weight:600; background:rgba(167,139,250,0.1); padding:2px 6px; border-radius:4px; border:1px solid rgba(167,139,250,0.2); flex-shrink:0;">${totalDose}</span>` : ''}
                        </div>`;
                    }
                }

                if (prevDrugs.length > 0) {
                    const prevNamesSet = new Set((prevDrugs || []).map(d => d.TENTHUOC));
                    for (const name of prevNamesSet) {
                        if (!currNames.has(name)) {
                            _totalStopped++;
                            combinedTimelineHtml += `<div style="display:flex; align-items:center; gap:8px; padding:6px 8px; margin-bottom:4px; border-radius:8px; background:rgba(239,68,68,0.05); border:1px solid rgba(239,68,68,0.15);">
                              <span style="width:6px; height:6px; border-radius:50%; background:#f87171; flex-shrink:0;"></span>
                              <span style="flex:1; font-size:12px; color:#f87171; text-decoration:line-through; opacity:0.7;">${name}</span>
                              <span style="font-size:9px; padding:1px 5px; border-radius:4px; background:rgba(239,68,68,0.15); color:#f87171; font-weight:700; border:1px solid rgba(239,68,68,0.3);">NGƯNG</span>
                            </div>`;
                        }
                    }
                }

                combinedTimelineHtml += '</div>';
            }
        } else {
            combinedTimelineHtml = '<div style="text-align:center; padding:20px; color:#7a6e5e; font-style:italic;">Không có dữ liệu Diễn tiến / Thuốc.</div>';
        }

        // --- Khám bệnh án ---
        let lamsangHtml = '';
        const historyData = patientInfo?.clinicalData?.history || {};
        let hasLamsangData = allDates.length > 0 || Object.keys(historyData).length > 0;

        if (Object.keys(historyData).length > 0) {
            lamsangHtml += `<div style="background:rgba(212,162,90,0.05); border:1px solid rgba(212,162,90,0.2); border-radius:10px; padding:16px; margin-bottom:16px;">
                <h4 style="color:#d4a25a; margin:0 0 12px 0; font-size:14px; display:flex; align-items:center; gap:6px;">📋 Khám bệnh án</h4>`;
            
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
                    lamsangHtml += `<div style="margin-bottom:10px;">
                        <span style="color:#a18764; font-weight:600; font-size:12px; display:block; margin-bottom:2px;">${f.label}:</span>
                        <div style="color:#e8dcc8; font-size:13px; line-height:1.5; white-space:pre-wrap;">${historyData[f.key]}</div>
                    </div>`;
                }
            }
            lamsangHtml += '</div>';
        }
        
        // Append Combined Timeline to lamsangHtml
        lamsangHtml += combinedTimelineHtml;

        // --- Modal ---
        const modal = document.createElement('div');
        modal.id = 'vnpt-lab-timeline-modal';
        modal.className = 'vnpt-glass-overlay';
        modal.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:rgba(15,23,42,0.6);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);z-index:2147483647;';

        const defaultActiveTab = hasLamsangData ? 0 : 1;

        const patientAgeHtml = patientInfo.age ? `<span style="font-weight: 500; opacity:0.8;"> - Tuổi: ${patientInfo.age}</span>` : '';
        const patientDiagHtml = patientInfo.diagnosis ? `<div style="font-size:12px; color:#a18764; margin-top:6px; background:rgba(212,162,90,0.1); padding:4px 8px; border-radius:4px; display:inline-block;">Chẩn đoán: ${patientInfo.diagnosis}</div>` : '';
        const headerSubtitleHtml = patientAgeHtml || patientDiagHtml ? `<div style="margin-top:2px;">${patientAgeHtml}${patientDiagHtml}</div>` : '';

        const tabsHeaderHtml = `
            <div style="display:flex; border-bottom:1px solid rgba(212,162,90,0.2); margin-bottom:14px; gap:6px;">
                <button id="aladinn-tab-lamsang" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:transparent; border:1px solid transparent; border-bottom:2px solid transparent; color:#7a6e5e; padding:10px; font-weight:600; border-radius:8px 8px 0 0; cursor:pointer; font-size:13px; transition:0.2s; line-height:normal;">📋 Lâm sàng & Thuốc</button>
                <button id="aladinn-tab-xn" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:transparent; border:1px solid transparent; border-bottom:2px solid transparent; color:#7a6e5e; padding:10px; font-weight:600; border-radius:8px 8px 0 0; cursor:pointer; font-size:13px; transition:0.2s; line-height:normal;">🧪 Xét nghiệm (${totalIndicators})</button>
                <button id="aladinn-tab-cdha" style="flex:1; display:flex; align-items:center; justify-content:center; gap:6px; background:transparent; border:1px solid transparent; border-bottom:2px solid transparent; color:#7a6e5e; padding:10px; font-weight:600; border-radius:8px 8px 0 0; cursor:pointer; font-size:13px; transition:0.2s; line-height:normal;">🩻 CĐHA (${imgList.length})</button>
            </div>
        `;

        modal.innerHTML = `
            <div style="max-width:960px; width:92%; max-height:92vh; display:flex; flex-direction:column; padding:24px; background:linear-gradient(135deg,#1a1510,#231c14); box-shadow:0 20px 60px rgba(0,0,0,0.6),0 0 30px rgba(212,162,90,0.12); border:1px solid rgba(212,162,90,0.3); border-radius:16px; font-family:'Segoe UI',system-ui,-apple-system,sans-serif;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; padding-bottom:14px; flex-shrink:0;">
                    <div style="flex:1;">
                        <h3 style="color:#d4a25a; margin:0; font-size:16px; display:flex; align-items:center; gap:10px;">
                            <img src="${chrome.runtime.getURL('assets/icons/icon128.png')}" style="width:22px;height:22px;"> 
                            CLS + Thuốc <span style="color:#a18764; margin: 0 4px;">—</span> <span style="color:#fff; font-weight:700; background:rgba(212,162,90,0.15); padding:2px 8px; border-radius:4px;">${patientName}</span>
                        </h3>
                        ${headerSubtitleHtml}
                    </div>
                    <button id="lab-timeline-close" style="background:none;border:none;color:#7a6e5e;font-size:22px;cursor:pointer;line-height:1;display:flex;align-items:center;justify-content:center;width:24px;height:24px;" title="Đóng">&times;</button>
                </div>
                ${tabsHeaderHtml}
                <div style="flex:1; overflow-y:auto; padding-right:6px; color:#e8dcc8;">
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
                </div>
                <div style="margin-top:14px; flex-shrink:0; display:flex; justify-content:flex-end; border-top:1px solid rgba(212,162,90,0.2); padding-top:12px;">
                    <button style="background:rgba(212,162,90,0.1); border:1px solid rgba(212,162,90,0.3); color:#d4a25a; padding:6px 16px; border-radius:6px; font-size:13px; font-weight:600; cursor:pointer; transition:0.2s;" onmouseover="this.style.background='rgba(212,162,90,0.2)'" onmouseout="this.style.background='rgba(212,162,90,0.1)'" onclick="document.getElementById('vnpt-lab-timeline-modal').remove()">Đóng</button>
                </div>
            </div>`;

        document.documentElement.appendChild(modal);
        modal.querySelector('#lab-timeline-close')?.addEventListener('click', () => modal.remove());

        // Block clicks from bubbling to HIS background (e.g., jqGrid row selection)
        modal.addEventListener('mousedown', e => e.stopPropagation());
        modal.addEventListener('mouseup', e => e.stopPropagation());
        modal.addEventListener('dblclick', e => e.stopPropagation());

        // ─── PACS Button handler (event delegation) ───
        modal.addEventListener('click', async (e) => {
            const btn = e.target.closest('.aladinn-pacs-btn');
            if (!btn) return;
            const sheetId = btn.dataset.sheetId;
            if (!sheetId) return;

            const pacsConfig = {
                sheetId: sheetId,
                maubenhphamid: btn.dataset.maubenhphamid,
                sophieu: btn.dataset.sophieu,
                linkDicom: btn.dataset.linkdicom,
                madichvu: btn.dataset.madichvu
            };

            const origText = btn.textContent;
            btn.textContent = '⏳ Đang lấy...';
            btn.disabled = true;
            btn.style.opacity = '0.7';

            const url = await fetchPacsUrlFromBridge(pacsConfig);

            if (url === 'NATIVE_TRIGGERED') {
                window.VNPTRealtime?.showToast('✅ Đã mở trình xem DICOM!', 'success');
            } else if (url) {
                window.open(url, '_blank');
                window.VNPTRealtime?.showToast('✅ Đã mở trình xem DICOM!', 'success');
            } else {
                window.VNPTRealtime?.showToast('❌ Không tìm thấy ảnh DICOM. Kiểm tra mô-đun RIS.', 'warning');
            }

            btn.textContent = origText;
            btn.disabled = false;
            btn.style.opacity = '1';
        });


        // Tab logic
        const tabLamsang = modal.querySelector('#aladinn-tab-lamsang');
        const tabXn = modal.querySelector('#aladinn-tab-xn');
        const tabCdha = modal.querySelector('#aladinn-tab-cdha');
        
        const contentLamsang = modal.querySelector('#aladinn-content-lamsang');
        const contentXn = modal.querySelector('#aladinn-content-xn');
        const contentCdha = modal.querySelector('#aladinn-content-cdha');

        const allTabs = [tabLamsang, tabXn, tabCdha];
        const allContents = [contentLamsang, contentXn, contentCdha];
        const tabColors = ['#d4a25a', '#d4a25a', '#60a5fa'];

        function activateTab(idx) {
            allTabs.forEach((t, i) => {
                if (!t) return;
                if (i === idx) {
                    t.style.background = `rgba(${i === 0 || i === 1 ? '212,162,90' : '96,165,250'},0.1)`;
                    t.style.borderColor = `rgba(${i === 0 || i === 1 ? '212,162,90' : '96,165,250'},0.3)`;
                    t.style.borderBottomColor = tabColors[i];
                    t.style.color = tabColors[i];
                    t.style.fontWeight = '700';
                } else {
                    t.style.background = 'transparent';
                    t.style.borderColor = 'transparent';
                    t.style.borderBottomColor = 'transparent';
                    t.style.color = '#7a6e5e';
                    t.style.fontWeight = '600';
                }
            });
            allContents.forEach((c, i) => { if (c) c.style.display = i === idx ? 'block' : 'none'; });
        }

        tabLamsang?.addEventListener('click', () => activateTab(0));
        tabXn?.addEventListener('click', () => activateTab(1));
        tabCdha?.addEventListener('click', () => activateTab(2));

        activateTab(defaultActiveTab);
    }

})();

