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

            // 4. Native Menu
            if (window.VNPTMenuManager && window.VNPTDashboard && window.VNPTScanFlow) {
                window.VNPTMenuManager.injectNativeMenu({
                    onScanRoom: () => startScanning('room'),
                    onScanVitals: () => startScanning('vitals'),
                    onScanDrugs: () => startScanning('drugs'),
                    onScanLabs: () => startScanning('labs'),
                    onStopScan: () => window.VNPTScanFlow.stop(),
                    onShowDashboard: () => window.VNPTDashboard.show(),
                    onShowSettings: () => {
                        if (window.VNPTSettings) window.VNPTSettings.show();
                    },
                    onHoverScanRoom: (anchor) => window.VNPTDashboard.showMini(anchor),
                    onLeaveScanRoom: () => window.VNPTDashboard.hideMini(),
                    onClearCache: () => {
                        if (window.VNPTStorage) window.VNPTStorage.clearResults();
                        if (window.VNPTRealtime) window.VNPTRealtime.showToast('🗑️ Đã xóa cache', 'success');
                    }
                });
            }

            // 5. Patient Selection — subscribe to shared Event Bus
            // (Replaces old VNPTRowObserver.init. Now uses shared HIS.PatientObserver)
            if (HIS?.EventBus && window.VNPTStore) {
                HIS.EventBus.on('patient:selected', (data) => {
                    window.VNPTStore.actions.selectPatient(data.rowId);
                });
            }

            // Export to Aladinn namespace
            window.Aladinn.Scanner.startScanning = startScanning;
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
    async function startScanning(mode) {
        if (!window.VNPTScanFlow) return;
        if (window.VNPTScanFlow.isScanning()) return;

        window.VNPTScanFlow.start(mode, {
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
            onVitalsFound: (tr, vitals) => {
                let text = `${vitals.weight}kg | ${vitals.height}cm`;
                if (vitals.bloodPressure) text += ` | ${vitals.bloodPressure}`;
                injectVitalsText(tr, text);
            },
            onDrugsFound: (tr, drugs) => {
                if (!drugs || drugs.length === 0) return;
                const tdVal = new Date();
                const todayStr = String(tdVal.getDate()).padStart(2, '0') + '/' + String(tdVal.getMonth() + 1).padStart(2, '0') + '/' + tdVal.getFullYear();
                
                const hasToday = drugs.some((/** @type {any} */ d) => d.NGAYMAUBENHPHAM_SUDUNG.includes(todayStr));
                if (hasToday) {
                    injectDrugsBadge(tr);
                }
            },
            onLabsFound: (tr, labs) => {
                if (!labs || labs.length === 0) return;
                console.log(`🔬 [CDS] Bệnh nhân ${tr.id}: ${labs.length} kết quả XN`, labs);
                injectLabsBadge(tr, labs.length);
                
                // Cache for CDS Engine to consume via Extractor
                window._aladinn_cds_labs = labs;
                // Trigger CDS rescan with new lab data
                window.dispatchEvent(new Event('ALADINN_MANUAL_SCAN'));
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

    function injectVitalsText(tr, text) {
        const iconTd = tr.querySelector("td[aria-describedby$='_ICON1']");
        if (!iconTd) return;

        let container = iconTd.querySelector('.aladinn-scan-vitals-info-display');
        if (!container) {
            container = iconTd.querySelector('.vitals-info-display');
            if (!container) {
                container = document.createElement('div');
                container.className = 'aladinn-scan-vitals-info-display';
                const centerTag = iconTd.querySelector('center');
                if (centerTag) centerTag.appendChild(container);
                else iconTd.appendChild(container);
            } else {
                container.className = 'aladinn-scan-vitals-info-display'; // Upgrade class
            }
        }
        container.textContent = text;
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

    function injectLabsBadge(tr, count) {
        let nameTd = tr.querySelector("td[aria-describedby$='_TENBENHNHAN']");
        if (!nameTd) nameTd = tr.querySelector("td[aria-describedby*='TENBENHNHAN']");
        if (!nameTd) return;

        let badge = nameTd.querySelector('.aladinn-scan-labs-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'aladinn-scan-labs-badge';
            badge.innerHTML = '🔬';
            badge.title = `Có ${count} kết quả xét nghiệm`;
            badge.style.cssText = 'font-size: 14px; display: inline-block; margin-left: 4px; vertical-align: text-top; filter: drop-shadow(0 0 2px rgba(255,255,255,0.8));';
            nameTd.appendChild(badge);
        } else {
            badge.title = `Có ${count} kết quả xét nghiệm`;
        }
    }

})();
