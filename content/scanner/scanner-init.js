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
            if (window.VNPTClinicalFill) window.VNPTClinicalFill.init();
            if (window.Aladinn?.Scanner?.QuickTimeEdit) window.Aladinn.Scanner.QuickTimeEdit.init();

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

                    const fetchClinicalSummaryFromBridge = (rowId) => {
                        return new Promise((resolve) => {
                            const requestId = 'clin_' + Date.now().toString() + Math.random().toString().slice(2);
                            const token = window.__ALADINN_BRIDGE_TOKEN__ || '';
                            
                            const listener = (event) => {
                                if (event.data && event.data.type === 'FETCH_CLINICAL_SUMMARY_RESULT' && event.data.requestId === requestId) {
                                    window.removeEventListener('message', listener);
                                    // sendResult spreads data fields directly — chanDoanMoiNhat is at event.data level
                                    resolve(event.data);
                                }
                            };
                            window.addEventListener('message', listener);
                            
                            window.postMessage({
                                type: 'REQ_FETCH_CLINICAL_SUMMARY',
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

                    const [result, drugsResult, historyData, treatmentList, clinicalSummary] = await Promise.all([
                        fetchLabsFromBridge(pid),
                        fetchDrugsFromBridge(pid),
                        fetchHistoryFromBridge(pid),
                        fetchTreatmentFromBridge(pid),
                        fetchClinicalSummaryFromBridge(pid)
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

        const patientAgeHtml = patientInfo.age ? `<span style="font-weight: 500; color:#e8dcc8; opacity:0.9; margin-top:4px; display:inline-block;">- Năm sinh: ${patientInfo.age}</span>` : '';
        let patientDiagHtml = '';
        if (patientInfo.diagnosis) {
            const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
            
            // Parse ICD codes from the diagnosis string (e.g. "A09, I10, K35, A09 - Viêm dạ dày...")
            const icdRegex = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
            const rawDiag = patientInfo.diagnosis;
            const icdMatches = [...new Set((rawDiag.match(icdRegex) || []))]; // unique codes
            
            // Build pills for ICD codes
            const pillsHtml = icdMatches.length > 0
                ? icdMatches.map((code, i) => {
                    const isPrimary = i === 0;
                    const bg = isPrimary ? 'rgba(212,162,90,0.2)' : 'rgba(255,255,255,0.06)';
                    const border = isPrimary ? 'rgba(212,162,90,0.4)' : 'rgba(255,255,255,0.1)';
                    const color = isPrimary ? '#f0d78c' : '#c8b89a';
                    return `<span style="display:inline-block; padding:2px 8px; border-radius:5px; font-size:12px; font-weight:700; font-family:'SF Mono','Menlo','Consolas',monospace; color:${color}; background:${bg}; border:1px solid ${border}; letter-spacing:0.3px; line-height:1.4;" title="${isPrimary ? 'Chẩn đoán chính' : 'Kèm theo'}">${code}</span>`;
                }).join(' ')
                : '';
            
            // Strip ICD codes and leading separators from the description text
            let descText = rawDiag.replace(icdRegex, '').replace(/^[\s,;-]+/, '').replace(/[\s,;-]+$/, '').trim();
            // Clean up internal separators from removed codes
            descText = descText.replace(/\s*[,;]\s*[,;]\s*/g, ', ').replace(/^\s*[,;-]\s*/, '').trim();
            
            if (patientInfo.diagHistory && patientInfo.diagHistory.length > 1) {
                const historyList = patientInfo.diagHistory.map(d => `<li style="margin-bottom:3px; padding:3px 0; border-bottom:1px solid rgba(255,255,255,0.04);">${escapeHtml(d)}</li>`).join('');
                patientDiagHtml = `
                    <div style="margin-top:6px;">
                        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px; margin-bottom:4px;">
                            <span style="font-size:10px; color:#a18764; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-right:2px;">Chẩn đoán</span>
                            ${pillsHtml}
                        </div>
                        ${descText ? `<details style="margin-top:2px;">
                            <summary style="font-size:12px; color:#8B8579; cursor:pointer; outline:none; user-select:none; transition:0.2s;">
                                ${escapeHtml(descText.length > 60 ? descText.substring(0, 60) + '...' : descText)} <span style="font-size:10px; opacity:0.6;">▾ chi tiết (${patientInfo.diagHistory.length})</span>
                            </summary>
                            <div style="margin-top:6px; padding:8px 12px; background:rgba(0,0,0,0.2); border:1px solid rgba(212,162,90,0.15); border-radius:6px; font-size:12px; color:#e8dcc8; max-height:120px; overflow-y:auto;">
                                <div style="color:#a18764; margin-bottom:6px; font-weight:600; font-size:11px;">Lịch sử chẩn đoán:</div>
                                <ul style="margin:0; padding-left:16px; line-height:1.6; list-style-type:'›  '; color:#c8b89a;">${historyList}</ul>
                            </div>
                        </details>` : ''}
                    </div>
                `;
            } else {
                patientDiagHtml = `
                    <div style="margin-top:6px;">
                        <div style="display:flex; flex-wrap:wrap; align-items:center; gap:4px;">
                            <span style="font-size:10px; color:#a18764; font-weight:600; text-transform:uppercase; letter-spacing:0.5px; margin-right:2px;">Chẩn đoán</span>
                            ${pillsHtml}
                        </div>
                        ${descText ? `<div style="font-size:12px; color:#8B8579; margin-top:4px; line-height:1.4; max-height:36px; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(descText)}">${escapeHtml(descText)}</div>` : ''}
                    </div>
                `;
            }
        }
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
                        <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
                            <h3 style="color:#d4a25a; margin:0; font-size:16px; display:flex; align-items:center; gap:10px;">
                                <img src="${chrome.runtime.getURL('assets/icons/icon128.png')}" style="width:22px;height:22px;"> 
                                CLS + Thuốc <span style="color:#a18764; margin: 0 4px;">—</span> <span style="color:#fff; font-weight:700; background:rgba(212,162,90,0.15); padding:2px 8px; border-radius:4px;">${patientName}</span>
                            </h3>
                            <button id="btn-ai-summary-modal" title="Nhờ AI tóm tắt bệnh án" style="background: linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.02)); border: 1px solid rgba(212,168,83,0.25); color: #D4A853; border-radius: 6px; padding: 4px 10px; font-size: 11px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 4px; transition: all 0.2s;" onmouseover="this.style.background='rgba(212,168,83,0.2)'" onmouseout="this.style.background='linear-gradient(135deg, rgba(212,168,83,0.15), rgba(212,168,83,0.02))'">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg> Tóm tắt AI
                            </button>
                        </div>
                        ${headerSubtitleHtml}
                        <!-- AI Result: collapsible panel -->
                        <div id="ai-summary-wrapper-modal" style="display:none; margin-top:12px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                                <span style="font-size:11px; font-weight:700; color:#a18764; text-transform:uppercase; letter-spacing:0.5px; display:flex; align-items:center; gap:5px;">
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D4A853" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                                        <path d="M12 2L2 7l10 5 10-5-10-5z"/>
                                        <path d="M2 17l10 5 10-5"/>
                                        <path d="M2 12l10 5 10-5"/>
                                    </svg>
                                    Phân tích lâm sàng (AI)
                                </span>
                                <button id="btn-ai-collapse" title="Thu gọn" style="background:none; border:none; color:#5a5450; font-size:16px; cursor:pointer; line-height:1; padding:2px 6px; border-radius:4px; transition:0.2s;" onmouseover="this.style.color='#d4a25a'" onmouseout="this.style.color='#5a5450'">▲</button>
                            </div>
                            <div id="ai-summary-result-modal" style="padding: 14px 16px; background: rgba(0,0,0,0.25); border-radius: 10px; border: 1px solid rgba(212,168,83,0.15); font-size: 13px; color: #cbd5e1; line-height: 1.6; max-width: 100%;"></div>
                        </div>
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

        // --- AI Summary Button (modal CLS + Thuốc) ---
        const btnAIModal = modal.querySelector('#btn-ai-summary-modal');
        const resAIModal = modal.querySelector('#ai-summary-result-modal');
        const wrapperAIModal = modal.querySelector('#ai-summary-wrapper-modal');
        const btnCollapse = modal.querySelector('#btn-ai-collapse');

        // Nút thu gọn / mở rộng kết quả AI
        if (btnCollapse && resAIModal && wrapperAIModal) {
            let _collapsed = false;
            btnCollapse.addEventListener('click', () => {
                _collapsed = !_collapsed;
                resAIModal.style.display = _collapsed ? 'none' : 'block';
                btnCollapse.textContent = _collapsed ? '▼' : '▲';
                btnCollapse.title = _collapsed ? 'Mở rộng' : 'Thu gọn';
            });
        }

        if (btnAIModal && resAIModal && wrapperAIModal) {
            btnAIModal.addEventListener('click', async () => {
                let apiKey = await window.HIS.ApiKeyService.getKey();
                if (!apiKey) {
                    const needsPin = await window.HIS.ApiKeyService.needsPin();
                    if (needsPin) {
                        apiKey = await window.HIS.ApiKeyService.promptAndUnlock();
                    }
                }

                if (!apiKey) {
                    wrapperAIModal.style.display = 'block';
                    resAIModal.innerHTML = '<span style="color:#E85454">⚠️ Chưa cấu hình API Key hoặc sai PIN. Vui lòng vào Cài đặt Aladinn để thiết lập.</span>';
                    return;
                }

                btnAIModal.disabled = true;
                btnAIModal.innerHTML = '<span style="animation: pulse-warning 1s infinite;">✨ Đang xử lý...</span>';
                wrapperAIModal.style.display = 'block';
                resAIModal.style.display = 'block';
                // Đặt lại nút thu gọn về trạng thái mở rộng
                if (btnCollapse) { btnCollapse.textContent = '▲'; btnCollapse.title = 'Thu gọn'; }
                resAIModal.innerHTML = '<div style="display:flex; gap:8px; align-items:center; color: #D4A853;"><div class="cds-spinner" style="width:14px;height:14px;border:2px solid rgba(212,168,83,0.3);border-top-color:#D4A853;border-radius:50%;animation:spin 1s linear infinite;"></div> Đang phân tích hồ sơ...</div>';

                try {
                    // --- Ẩn danh thông tin cá nhân bệnh nhân (bảo mật y khoa) ---
                    // Chỉ dùng mã bệnh án + năm sinh, không gửi tên thật lên API
                    const patientRef = patientInfo.id
                        ? `BN-${String(patientInfo.id).slice(-4).padStart(4,'0')}`
                        : 'BN-XXXX';
                    const birthYear = patientInfo.age
                        ? (String(patientInfo.age).match(/\d{4}/) || [''])[0] || patientInfo.age
                        : 'không rõ';

                    // --- Context lâm sàng ---
                    const contextDiag = patientInfo.diagnosis || 'Chưa rõ chẩn đoán';

                    // Thuốc: chỉ lấy tên thuốc + liều, không gửi mã vạch hay số lô
                    const uniqueDrugs = [...new Map(
                        drugs.map(d => [d.TENTHUOC, d])
                    ).values()];
                    const contextDrugs = uniqueDrugs
                        .map(d => `${d.TENTHUOC || ''}${d.SOLUONG ? ' (' + d.SOLUONG + (d.DONVITINH ? ' ' + d.DONVITINH : '') + '/ngày)' : ''}`)
                        .filter(Boolean)
                        .join('; ');

                    // XN bất thường mới nhất (từ grouped data nếu có)
                    const abnItems = window._aladinn_last_abnormals || [];
                    const contextAbn = abnItems.length > 0
                        ? abnItems.slice(0, 5).map(a => `${a.code || a.testName}: ${a.value} ${a.unit || ''}`).join('; ')
                        : '';

                    // Lấy custom prompt từ Options (nếu có), fallback về mặc định
                    let promptTemplate = '';
                    try {
                        const stored = await new Promise(r =>
                            chrome.storage.local.get(['aladinn_ai_prompts'], r)
                        );
                        promptTemplate = stored?.aladinn_ai_prompts?.cls_summary || '';
                    } catch (_) { /* fallback */ }

                    if (!promptTemplate.trim()) {
                        promptTemplate = `Bạn là bác sĩ đang hội chẩn (mã BN: {{patientRef}}, SN: {{birthYear}}).
Dữ liệu lâm sàng:
- Chẩn đoán (ICD): {{diagnosis}}
- Đơn thuốc: {{drugs}}
{{abnormal}}
Trình bày ngắn gọn theo cấu trúc:
1. Tóm tắt bệnh (1–2 câu, nêu mức độ nặng và vấn đề chính)
2. Điểm lưu ý / nguy cơ lâm sàng (tối đa 2 ý)
3. Hướng xử trí đề xuất (nếu đủ dữ kiến)
Dùng ngôn ngữ y khoa chuyên nghiệp. NGẮN GỌN. KHÔNG viết câu mở đầu hay lời chào hỏi. Bắt đầu ngay vào nội dung.`;
                    }

                    // Điền biến vào template
                    const abnLine = contextAbn ? `- XN bất thường: ${contextAbn}` : '';
                    const prompt = promptTemplate
                        .replace('{{patientRef}}', patientRef)
                        .replace('{{birthYear}}', birthYear)
                        .replace('{{diagnosis}}', contextDiag)
                        .replace('{{drugs}}', contextDrugs || 'Không rõ')
                        .replace('{{abnormal}}', abnLine);

                    const model = await window.HIS.getAiModel();
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
                        }
                    );

                    const data = await response.json();
                    if (data.candidates && data.candidates[0]?.content?.parts[0]?.text) {
                        let text = data.candidates[0].content.parts[0].text;
                        text = text
                            .replace(/\*\*(.*?)\*\*/g, '<strong style="color:#D4A853">$1</strong>')
                            .replace(/\*(.*?)\*/g, '<em>$1</em>')
                            .replace(/^- (.*)$/gm, '<li style="margin-bottom:6px;">$1</li>')
                            .replace(/^\* (.*)$/gm, '<li style="margin-bottom:6px;">$1</li>');

                        // Render kết quả
                        resAIModal.innerHTML = '<ul style="margin:0; padding-left:16px;">' + text + '</ul>';

                        // Cost badge: hiển thị toast thay vì nằm trong panel
                        if (window.HIS?.AICost && data.usageMetadata) {
                            const est = window.HIS.AICost.record(
                                model,
                                data.usageMetadata.promptTokenCount || 0,
                                data.usageMetadata.candidatesTokenCount || 0
                            );
                            if (est) {
                                const modelShort = model.replace('gemini-', '');
                                window.VNPTRealtime?.showToast(
                                    `💰 ~${est.totalTokens.toLocaleString()} token · ${est.vndDisplay} · ${modelShort}`,
                                    'info',
                                    3000
                                );
                            }
                        }

                        // Link tra cứu phác đồ / hướng dẫn BYT
                        const icdCodes = contextDiag
                            .split(/[,;]+/)
                            .map(s => s.trim().split(' ')[0])
                            .filter(s => /^[A-Z]\d/.test(s))
                            .slice(0, 3);
                        const searchQuery = icdCodes.length > 0
                            ? icdCodes.join(' ') + ' phác đồ điều trị BYT Việt Nam'
                            : contextDiag.split('\n')[0].trim().slice(0, 60) + ' phác đồ BYT';
                        const googleUrl = 'https://www.google.com/search?q=' + encodeURIComponent(searchQuery);
                        const vncardUrl = icdCodes.length > 0
                            ? 'https://www.google.com/search?q=site:moh.gov.vn+' + encodeURIComponent(icdCodes.join('+'))
                            : '';

                        resAIModal.innerHTML += `<div style="margin-top:10px; padding-top:8px; border-top:1px solid rgba(212,168,83,0.1); display:flex; gap:8px; flex-wrap:wrap;">
                            <span style="font-size:10px; color:#5a5450; align-self:center;">Tra cứu:</span>
                            <a href="${googleUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#60a5fa; font-weight:600; text-decoration:none; background:rgba(96,165,250,0.08); border:1px solid rgba(96,165,250,0.2); border-radius:5px; padding:3px 8px;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg>
                                Phác đồ điều trị
                            </a>
                            <a href="https://www.google.com/search?q=${encodeURIComponent(searchQuery.replace('phác đồ điều trị BYT Việt Nam', 'hướng dẫn chẩn đoán điều trị Bộ Y tế'))}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#60a5fa; font-weight:600; text-decoration:none; background:rgba(96,165,250,0.08); border:1px solid rgba(96,165,250,0.2); border-radius:5px; padding:3px 8px;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg>
                                Hướng dẫn BYT
                            </a>
                            ${vncardUrl ? `<a href="${vncardUrl}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; font-size:11px; color:#60a5fa; font-weight:600; text-decoration:none; background:rgba(96,165,250,0.08); border:1px solid rgba(96,165,250,0.2); border-radius:5px; padding:3px 8px;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg>
                                MOH.GOV.VN
                            </a>` : ''}
                        </div>`;

                    } else {
                        throw new Error(data.error?.message || 'Lỗi từ máy chủ AI');
                    }
                } catch (e) {
                    resAIModal.innerHTML = '<span style="color:#E85454">Lỗi AI: ' + e.message + '</span>';
                } finally {
                    btnAIModal.disabled = false;
                    btnAIModal.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m9 12 2 2 4-4"/><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/></svg> Tóm tắt AI';
                }
            });
        }

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

