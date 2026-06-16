/**
 * 🧞 Aladinn CDS — UI Drawer Panel (Phiên bản V2 - HIS-ify Hoàn Toàn)
 * Vẽ giao diện Cảnh Báo Lâm Sàng phẳng, vuông vức, tiệp 100% phong cách VNPT HIS.
 * Tích hợp Tab An Toàn Kê Đơn và Tab SmartScore (Thang điểm Cấp Cứu).
 */

import { SmartScoreEngine } from './smart-score.js';
import { CDSExtractor } from './extractor.js';

export const CDSUI = {
    panel: null,
    iconToggle: null,
    isOpen: false,
    hasUserDismissed: false,  // User đã tự đóng panel
    lastAlertLevel: 'safe',   // Lưu level cuối cùng để chỉ auto-show khi severity thay đổi
    activeTab: 'prescription',
    currentContext: null,
    scoreStates: {},
    _lastPatientKey: '',

    escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    },

    parseIcdCode(code) {
        const match = String(code || '').trim().toUpperCase().match(/^([A-Z])(\d{2})(?:\.(\d{1,2}))?$/);
        if (!match) return null;
        return {
            letter: match[1],
            major: Number(match[2]),
            decimal: match[3] == null ? null : Number(match[3])
        };
    },

    icdMatchesRequirement(icd, requirement) {
        const normalizedIcd = String(icd || '').trim().toUpperCase();
        const normalizedReq = String(requirement || '').trim().toUpperCase();
        if (!normalizedIcd || !normalizedReq) return false;
        if (!normalizedReq.includes('-')) return normalizedIcd.startsWith(normalizedReq);

        const [startRaw, endRaw] = normalizedReq.split('-').map(v => v.trim());
        const start = this.parseIcdCode(startRaw);
        const end = this.parseIcdCode(endRaw);
        const current = this.parseIcdCode(normalizedIcd);
        if (!start || !end || !current || start.letter !== end.letter || current.letter !== start.letter) {
            return normalizedIcd.startsWith(normalizedReq);
        }

        const currentValue = current.major + (current.decimal ?? 0) / 100;
        const startValue = start.major + (start.decimal ?? 0) / 100;
        const endValue = end.major + (end.decimal ?? 99) / 100;
        return currentValue >= startValue && currentValue <= endValue;
    },

    alertSatisfiedByIcd(alert, icdCodes) {
        if (alert?.domain !== 'insurance' || !alert.missing_icd) return false;
        const requirements = String(alert.missing_icd).split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
        return icdCodes.some(icd => requirements.some(req => this.icdMatchesRequirement(icd, req)));
    },

    init() {
        if (document.getElementById('aladinn-cds-drawer')) {
            this.panel = document.getElementById('aladinn-cds-panel');
            this.iconToggle = document.getElementById('aladinn-cds-shield');
            return;
        }

        // Container chung
        const container = document.createElement('div');
        container.id = 'aladinn-cds-drawer';
        
        // Khối Panel nội dung (Drawer)
        const panel = document.createElement('div');
        panel.id = 'aladinn-cds-panel';
        panel.innerHTML = `
            <div class="cds-header">
                <h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
                    Aladinn OS Lâm Sàng
                </h3>
                <div style="display:flex; gap: 8px;">
                    <span id="cds-bhyt-audit-btn" class="header-action-btn" title="Kiểm tra BHYT (Pre-claim Audit)">
                        🛡️
                    </span>
                    <span id="cds-refresh-btn" class="header-action-btn" title="Làm mới & Xóa Bộ nhớ (Reset Cache)">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                    </span>
                    <span id="cds-close-btn" class="header-action-btn" title="Đóng">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
                    </span>
                </div>
            </div>
            <div id="cds-crawl-info" style="display:none"></div>
            <div id="cds-patient-info" style="display:none" class="cds-patient-info"></div>
            
            <!-- HIS-ify Tab Header -->
            <div class="cds-tab-header">
                <div id="cds-tab-prescription" class="cds-tab active">
                    🛡️ An Toàn Kê Đơn
                </div>
                <div id="cds-tab-smartscore" class="cds-tab">
                    🧮 Thang Điểm <span id="cds-score-badge">!</span>
                </div>
            </div>

            <div class="cds-body">
                <!-- Tab Kê đơn an toàn -->
                <div id="cds-alerts-container">
                    <div class="cds-empty-state" id="cds-empty-state">
                        <div style="opacity:0.6; margin-bottom:8px">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                        </div>
                        Chưa có dữ liệu thuốc
                        <button id="cds-manual-rescan">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            Quét lại
                        </button>
                    </div>
                </div>

                <!-- Tab Thang điểm lâm sàng -->
                <div id="cds-smartscore-container" style="display:none;">
                    <div class="cds-empty-state">Đang tải dữ liệu bệnh nhân...</div>
                </div>
            </div>

            <div class="cds-footer">
                <div id="cds-status-text">Đã phân tích: 0 thuốc</div>
            </div>
        `;

        const icon = document.createElement('div');
        icon.id = 'aladinn-cds-shield';
        icon.title = 'Hệ thống Cảnh báo Lâm sàng Aladinn';
        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#004f9e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';

        // Đảo ngược thứ tự append để dùng với flex-direction: row-reverse
        container.appendChild(panel);
        container.appendChild(icon);
        document.body.appendChild(container);

        this.panel = panel;
        this.iconToggle = icon;

        this.injectCSS();
        this.bindEvents();

        // Gắn biến CDSUI toàn cục để các listener inline trong HTML hoạt động
        window.CDSUI = this;
    },

    bindEvents() {
        const drawer = document.getElementById('aladinn-cds-drawer');
        this._hideTimeout = null;

        // HOVER: Rê chuột vào khiên → mở panel + quét lại
        this.iconToggle.addEventListener('mouseenter', () => {
            if (this.isDragging) return;
            clearTimeout(this._hideTimeout);
            if (!this.isOpen) {
                this.show();
                // Mỗi lần mở → quét lại dữ liệu mới nhất
                window.dispatchEvent(new CustomEvent('ALADINN_MANUAL_SCAN'));
            }
        });

        // HOVER: Rê chuột vào panel → giữ mở
        this.panel.addEventListener('mouseenter', () => {
            clearTimeout(this._hideTimeout);
        });

        // LEAVE: Chuột rời khỏi toàn bộ drawer (cả khiên + panel) → đóng với delay nhỏ tránh flicker
        drawer.addEventListener('mouseleave', () => {
            this._hideTimeout = setTimeout(() => {
                this.hide();
            }, 300); // 300ms grace period
        });

        // Nút X và Làm mới
        document.getElementById('cds-refresh-btn').addEventListener('click', () => {
            window.dispatchEvent(new CustomEvent('ALADINN_FORCE_RESET_CACHE'));
            window.dispatchEvent(new CustomEvent('ALADINN_MANUAL_SCAN'));
            
            // Xoay icon mượt mà
            const icon = document.querySelector('#cds-refresh-btn svg');
            icon.style.transition = 'transform 0.5s';
            icon.style.transform = `rotate(${(icon._rot || 0) + 360}deg)`;
            icon._rot = (icon._rot || 0) + 360;
        });
        document.getElementById('cds-close-btn').addEventListener('click', () => this.hide());

        // Nút Kiểm tra BHYT
        document.getElementById('cds-bhyt-audit-btn').addEventListener('click', () => {
            const btn = document.getElementById('cds-bhyt-audit-btn');
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            window.dispatchEvent(new CustomEvent('ALADINN_BHYT_AUDIT'));
            // Trả về trạng thái sau 2s
            setTimeout(() => {
                btn.style.opacity = '1';
                btn.style.pointerEvents = 'auto';
            }, 2000);
        });

        // Nút Quét lại (trong empty state)
        const rescanBtn = document.getElementById('cds-manual-rescan');
        if (rescanBtn) {
            rescanBtn.addEventListener('click', () => {
                window.dispatchEvent(new CustomEvent('ALADINN_FORCE_RESET_CACHE'));
                window.dispatchEvent(new CustomEvent('ALADINN_MANUAL_SCAN'));
                rescanBtn.textContent = 'Đang quét...';
                rescanBtn.style.opacity = '0.5';
                setTimeout(() => {
                    rescanBtn.textContent = 'Quét lại';
                    rescanBtn.style.opacity = '1';
                }, 2000);
            });
        }

        // Tab click listeners
        const tabPrescription = document.getElementById('cds-tab-prescription');
        const tabSmartScore = document.getElementById('cds-tab-smartscore');
        
        if (tabPrescription && tabSmartScore) {
            tabPrescription.addEventListener('click', () => {
                this.switchTab('prescription');
            });
            tabSmartScore.addEventListener('click', () => {
                this.switchTab('smartscore');
            });
        }

        // Kéo thả dọc (Vertical drag)
        let isDown = false;
        let startY;
        let startTop;

        this.iconToggle.addEventListener('mousedown', (e) => {
            isDown = true;
            this.isDragging = false;
            startY = e.clientY;
            const rect = drawer.getBoundingClientRect();
            // Lấy tâm Y hiện tại dựa theo bounding rect để dịch
            startTop = rect.top + rect.height / 2;
            drawer.style.transition = 'none'; // Tắt animation mượt khi đang kéo
        });

        window.addEventListener('mousemove', (e) => {
            if (!isDown) return;
            const dy = e.clientY - startY;
            if (Math.abs(dy) > 3) this.isDragging = true;
            
            if (this.isDragging) {
                // Giới hạn không cho chui khỏi màn hình
                let newTop = startTop + dy;
                if (newTop < 50) newTop = 50;
                if (newTop > window.innerHeight - 50) newTop = window.innerHeight - 50;
                drawer.style.top = newTop + 'px';
            }
        });

        window.addEventListener('mouseup', () => {
            if (isDown) {
                drawer.style.transition = ''; // Bật lại transition
            }
            isDown = false;
            setTimeout(() => this.isDragging = false, 50);
        });

        // Event Delegation cho SmartScore
        const smartScoreContainer = document.getElementById('cds-smartscore-container');
        if (smartScoreContainer) {
            smartScoreContainer.addEventListener('click', (e) => {
                const target = e.target.closest('[data-action]');
                if (!target) return;
                
                const action = target.getAttribute('data-action');
                const scoreId = target.getAttribute('data-score-id');
                
                if (action === 'score-change') {
                    if (target.tagName === 'INPUT' && target.type === 'checkbox') return; // Nhường cho sự kiện 'change' xử lý
                    const criteriaKey = target.getAttribute('data-criteria-key');
                    let val = target.getAttribute('data-val');
                    if (!isNaN(val) && val !== '') val = Number(val);
                    this.onScoreCriteriaChange(scoreId, criteriaKey, val);
                }
            });
            
            smartScoreContainer.addEventListener('change', (e) => {
                const target = e.target;
                if (target.tagName === 'INPUT' && target.type === 'checkbox' && target.getAttribute('data-action') === 'score-change') {
                    const scoreId = target.getAttribute('data-score-id');
                    const criteriaKey = target.getAttribute('data-criteria-key');
                    this.onScoreCriteriaChange(scoreId, criteriaKey, target.checked);
                }
            });
        }
    },

    switchTab(tab) {
        this.activeTab = tab;
        const tabPrescription = document.getElementById('cds-tab-prescription');
        const tabSmartScore = document.getElementById('cds-tab-smartscore');
        const alertsContainer = document.getElementById('cds-alerts-container');
        const smartScoreContainer = document.getElementById('cds-smartscore-container');

        if (tab === 'prescription') {
            tabPrescription.classList.add('active');
            tabSmartScore.classList.remove('active');

            alertsContainer.style.display = '';
            smartScoreContainer.style.display = 'none';
        } else {
            tabSmartScore.classList.add('active');
            tabPrescription.classList.remove('active');

            alertsContainer.style.display = 'none';
            smartScoreContainer.style.display = '';
            
            this.renderSmartScore();
        }
    },

    injectCSS() {
        if (document.getElementById('aladinn-cds-style')) return;
        const style = document.createElement('style');
        style.id = 'aladinn-cds-style';
        style.textContent = `
            #aladinn-cds-drawer {
                position: fixed !important;
                bottom: 24px !important;
                right: 24px !important;
                z-index: 2147483647 !important;
                font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
                display: flex !important;
                flex-direction: column-reverse !important;
                align-items: flex-end !important;
                gap: 12px !important;
                pointer-events: none !important;
            }
            
            #aladinn-cds-shield {
                pointer-events: auto !important;
                width: 46px !important;
                height: 46px !important;
                background: #ffffff !important;
                border: 2px solid #004f9e !important;
                border-radius: 50% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 20px !important;
                cursor: pointer !important;
                box-shadow: 0 3px 12px rgba(0, 79, 158, 0.25) !important;
                transition: transform 0.15s ease, box-shadow 0.15s !important;
            }
            #aladinn-cds-shield:hover { transform: scale(1.05) !important; box-shadow: 0 5px 16px rgba(0, 79, 158, 0.35) !important; }
            #aladinn-cds-shield.warning { border-color: #f59e0b !important; animation: pulse-warning 2s infinite !important; }
            #aladinn-cds-shield.critical { border-color: #ef4444 !important; animation: pulse-critical 1.5s infinite !important; }
            #aladinn-cds-shield svg { stroke: #004f9e !important; }
            #aladinn-cds-shield.warning svg { stroke: #f59e0b !important; }
            #aladinn-cds-shield.critical svg { stroke: #ef4444 !important; }

            #aladinn-cds-panel {
                pointer-events: auto !important;
                width: 330px !important;
                background: #ffffff !important;
                border-radius: 0px !important; /* PHẲNG LỲ */
                box-shadow: 0 6px 20px rgba(0,0,0,0.15) !important;
                border: 1px solid #a6c9e2 !important; /* Viền xanh nhạt HIS */
                display: flex !important;
                flex-direction: column !important;
                max-height: 75vh !important;
                overflow: hidden !important;
                
                opacity: 0 !important;
                transform: translateY(15px) scale(0.97) !important;
                visibility: hidden !important;
                transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
                transform-origin: bottom right !important;
            }
            #aladinn-cds-drawer.aladinn-drawer-active #aladinn-cds-panel {
                opacity: 1 !important;
                transform: translateY(0) scale(1) !important;
                visibility: visible !important;
            }

            .cds-header {
                padding: 10px 16px !important;
                border-bottom: 1px solid #a6c9e2 !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                background: #004f9e !important; /* Xanh dương VNPT HIS */
                min-height: 40px !important;
            }
            .cds-header h3 { margin: 0 !important; font-size: 13px !important; color: #ffffff !important; font-weight: bold !important; display: flex !important; align-items: center !important;}
            .cds-header h3 svg { stroke: #ffffff !important; }
            .header-action-btn { 
                cursor: pointer; color: #ffffff;
                width: 24px; height: 24px; border-radius: 0px; display: flex; align-items: center; justify-content: center;
                background: rgba(255,255,255,0.15); transition: background 0.15s; font-size: 12px;
            }
            .header-action-btn:hover { background: rgba(255,255,255,0.3); }
            
            /* HIS-ify Tabs */
            .cds-tab-header {
                display: flex !important;
                background: #e6f0fa !important;
                border-bottom: 1px solid #a6c9e2 !important;
                padding: 0 !important;
            }
            .cds-tab {
                flex: 1 !important;
                text-align: center !important;
                padding: 8px 0 !important;
                font-size: 12px !important;
                font-weight: bold !important;
                color: #555555 !important;
                cursor: pointer !important;
                border-bottom: 3px solid transparent !important;
                background: #e6f0fa !important;
                transition: all 0.15s !important;
                border-radius: 0px !important;
            }
            .cds-tab.active {
                color: #004f9e !important;
                border-bottom: 3px solid #004f9e !important;
                background: #ffffff !important;
            }
            .cds-tab:hover:not(.active) {
                background: #dbeafe !important;
            }
            #cds-score-badge {
                display: none;
                background: #ef4444;
                color: white;
                border-radius: 50%;
                padding: 1px 5px;
                font-size: 9px;
                vertical-align: middle;
                margin-left: 2px;
            }

            .cds-body {
                flex: 1 !important;
                padding: 12px 14px !important;
                overflow-y: auto !important;
                background: #f9f9f9 !important;
                color: #333333 !important;
            }
            .cds-body::-webkit-scrollbar { width: 4px; }
            .cds-body::-webkit-scrollbar-track { background: transparent; }
            .cds-body::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 0px; }

            .cds-footer {
                padding: 8px 16px !important;
                border-top: 1px solid #e2e8f0 !important;
                text-align: center !important;
                background: #f1f5f9 !important;
            }
            #cds-status-text { color: #64748b !important; font-size: 11px !important; }
            #cds-crawl-info { color: #333333 !important; font-size: 11px !important; padding: 6px 14px !important; border-bottom: 1px solid #a6c9e2 !important; background: #e0f2fe !important; font-weight: 500; }
            #cds-crawl-info.success { color: #15803d !important; }
            .cds-empty-state { text-align: center; color: #64748b !important; font-size: 12px !important; margin-top: 30px !important; }
            .cds-empty-state button {
                margin-top:10px; padding:6px 12px; border:1px solid #004f9e; border-radius:0px; background:#004f9e; color:#ffffff; cursor:pointer; font-size:11px; display:inline-flex; align-items:center; gap:4px; font-weight:bold; transition:background 0.15s;
            }
            .cds-empty-state button:hover { background:#1e5494; }

            .cds-patient-info {
                padding: 8px 14px !important;
                border-bottom: 1px solid #e2e8f0 !important;
                background: #ffffff !important;
            }
            .cds-patient-name {
                font-weight: bold !important;
                color: #004f9e !important;
                font-size: 13px !important;
                margin-bottom: 4px !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
            }
            .cds-patient-diag {
                font-size: 11px !important;
                color: #475569 !important;
                line-height: 1.4 !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 4px !important;
            }
            .cds-diag-label {
                font-size: 10px !important;
                color: #64748b !important;
                font-weight: bold !important;
                text-transform: uppercase !important;
                letter-spacing: 0.3px !important;
            }
            .cds-diag-pills {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 4px !important;
            }
            .cds-diag-pill {
                display: inline-block !important;
                padding: 1px 6px !important;
                border-radius: 0px !important; /* PHẲNG LỲ */
                font-size: 11px !important;
                font-weight: bold !important;
                font-family: monospace !important;
                color: #475569 !important;
                background: #f1f5f9 !important;
                border: 1px solid #cbd5e1 !important;
                cursor: pointer !important;
                transition: all 0.15s ease !important;
            }
            .cds-diag-pill:hover {
                background: #e2e8f0 !important;
                border-color: #94a3b8 !important;
            }
            .cds-diag-pill.primary {
                color: #0369a1 !important;
                background: #e0f2fe !important;
                border-color: #93c5fd !important;
            }
            .cds-diag-pill.primary:hover {
                background: #bae6fd !important;
            }
            
            /* Alert Cards — HIS-ify Sáng sủa phẳng lỳ */
            .cds-alert-card {
                background: #ffffff !important;
                border-radius: 0px !important; /* PHẲNG LỲ */
                padding: 12px 14px !important;
                margin-bottom: 10px !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
                border: 1px solid #e2e8f0 !important;
                border-left: 4px solid #64748b !important;
                text-align: left !important;
            }
            .cds-alert-card.high { border-left-color: #ef4444 !important; background: #fef2f2 !important; }
            .cds-alert-card.medium { border-left-color: #f59e0b !important; background: #fffbeb !important; }
            .cds-alert-card.low, .cds-alert-card.info { border-left-color: #0284c7 !important; background: #f0f9ff !important; }
            
            .cds-alert-title { font-weight: bold !important; font-size: 13px !important; color: #004f9e !important; margin-bottom: 4px !important; display: flex !important; align-items: center !important; gap: 6px !important;}
            .cds-alert-effect { font-size: 12px !important; color: #334155 !important; margin-bottom: 8px !important; line-height: 1.4 !important; }
            .cds-alert-rec { font-size: 11px !important; color: #15803d !important; font-weight: bold !important; background: #dcfce7 !important; padding: 4px 8px !important; border-radius: 0px !important; display: inline-block !important; }
            
            .alert-match-list { margin-top: 8px; font-size: 10px; }
            .alert-match-list span { background: #f1f5f9; border: 1px solid #cbd5e1; padding: 2px 6px; border-radius: 0px; font-family: monospace; color: #334155; margin-right: 4px; display: inline-block; margin-bottom: 4px;}
            
            @keyframes pulse-warning {
                0% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(245, 158, 11, 0); }
                100% { box-shadow: 0 0 0 0 rgba(245, 158, 11, 0); }
            }
            @keyframes pulse-critical {
                0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
            
            /* Smart Score Segment Buttons */
            .score-segment-group { display: flex !important; width: 100% !important; border: 1px solid #a6c9e2 !important; border-radius: 0px !important; overflow: hidden !important; background: #ffffff !important; }
            .score-segment-btn { flex: 1 !important; text-align: center !important; padding: 6px 2px !important; font-size: 11px !important; font-weight: bold !important; color: #475569 !important; border-right: 1px solid #e2e8f0 !important; cursor: pointer !important; transition: all 0.15s !important; display: flex !important; justify-content: center !important; align-items: center !important; user-select: none !important; }
            .score-segment-btn:last-child { border-right: none !important; }
            .score-segment-btn:hover { background: #f1f5f9 !important; }
            .score-segment-btn.active { background: #004f9e !important; color: #ffffff !important; }
            
            /* Drug Coverage Summary */
            .cds-coverage-summary { margin-top: 10px !important; }
            .cds-coverage-group { 
                padding: 10px !important; border-radius: 0px !important; margin-bottom: 8px !important;
            }
            .cds-checked { background: #f0fdf4 !important; border: 1px solid #bbf7d0 !important; }
            .cds-unchecked { background: #fffbeb !important; border: 1px solid #fef3c7 !important; }
            .cds-coverage-label { 
                font-size: 11px !important; font-weight: bold !important; color: #1e293b !important; 
                margin-bottom: 6px !important; display: flex !important; align-items: center !important; gap: 4px !important;
            }
            .cds-coverage-count { font-weight: normal !important; color: #64748b !important; }
            .cds-coverage-pills { display: flex !important; flex-wrap: wrap !important; gap: 4px !important; }
            .cds-pill {
                display: inline-flex !important; align-items: center !important;
                padding: 2px 6px !important; border-radius: 0px !important; font-size: 11px !important;
                font-family: monospace !important; line-height: 1.3 !important;
            }
            .cds-pill.checked { 
                background: #dcfce7 !important; color: #166534 !important; 
                border: 1px solid #bbf7d0 !important;
            }
            .cds-pill.unchecked { 
                background: #fef3c7 !important; color: #9a3412 !important;
                border: 1px solid #fde047 !important;
                text-decoration: none !important; cursor: pointer !important;
                transition: background 0.15s, border-color 0.15s !important;
            }
            .cds-pill.unchecked:hover { 
                background: #fef08a !important; 
                border-color: #facc15 !important; 
            }
            .cds-coverage-hint {
                margin-top: 6px !important; font-size: 10px !important; color: #64748b !important;
                font-style: italic !important;
            }
            
            /* Thang điểm CSS phẳng */
            .score-card {
                margin-bottom: 10px !important;
                border-radius: 0px !important;
                box-shadow: 0 1px 3px rgba(0,0,0,0.05) !important;
            }
            .score-fill-btn:hover {
                background: #1e5494 !important;
            }
            .score-criteria-inputs label:hover {
                background: #f1f5f9;
            }
        `;
        document.head.appendChild(style);
    },

    toggle() {
        if (this.isOpen) this.hide();
        else this.show();
    },

    show() {
        // Thêm class cho phần tử CHA (drawer) để trượt nguyên cụm ra ngoài
        const drawer = document.getElementById('aladinn-cds-drawer');
        if (drawer) {
            drawer.classList.add('aladinn-drawer-active');
        }
        this.isOpen = true;
    },

    hide() {
        const drawer = document.getElementById('aladinn-cds-drawer');
        if (drawer) {
            drawer.classList.remove('aladinn-drawer-active');
        }
        this.isOpen = false;
        this.hasUserDismissed = true;  // Ghi nhận user tự đóng
    },

    update({ summary, alerts, debug, context }) {
        // Lưu trữ ngữ cảnh hiện tại phục vụ SmartScore
        this.currentContext = context;

        if (!this.panel) this.init();

        const container = document.getElementById('cds-alerts-container');
        const statusText = document.getElementById('cds-status-text');
        const patientInfo = document.getElementById('cds-patient-info');

        const visibleIcdCodes = [];

        // Render Patient Info
        if (context && context.patient && context.patient.id) {
            const diagnoses = context.encounter.diagnoses || [];
            const icdRegex = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
            
            // Parse clean ICD codes
            const parsedCodes = [];
            const seenCodes = new Set();
            for (const d of diagnoses) {
                if (!d.code) continue;
                const matches = d.code.match(icdRegex);
                let rawDesc = d.name || d.code.replace(icdRegex, '').trim();
                
                // Clean up leading separators
                rawDesc = rawDesc.replace(/^[\s,;=\-|]+/, '').replace(/[\s,;=\-|]+$/, '').trim();

                if (matches) {
                    const descParts = rawDesc ? rawDesc.split(/;\s*-?\s*/).map(s => s.trim()).filter(s => s) : [];
                    const offset = Math.max(0, matches.length - descParts.length);
                    
                    matches.forEach((m, idx) => {
                        if (!seenCodes.has(m)) {
                            seenCodes.add(m);
                            
                            let individualDesc = '';
                            if (descParts.length > 0) {
                                if (matches.length > descParts.length && idx >= offset) {
                                    individualDesc = descParts[idx - offset];
                                } else if (matches.length <= descParts.length) {
                                    individualDesc = descParts[idx];
                                }
                            }
                            
                            if (individualDesc) {
                                individualDesc = individualDesc.replace(/^(chẩn đoán kèm theo|bệnh kèm theo|chẩn đoán|bệnh chính|kèm theo)[:\-\s]*/i, '').trim();
                                individualDesc = individualDesc.replace(/^-\s*/, '').trim();
                            }
                            
                            if (!individualDesc) {
                                individualDesc = (d.is_primary && parsedCodes.length === 0 && idx === 0) ? 'Chẩn đoán chính' : 'Bệnh kèm theo';
                            }
                            
                            parsedCodes.push({ code: m, isPrimary: d.is_primary && parsedCodes.length === 0, desc: individualDesc });
                            visibleIcdCodes.push(m);
                        }
                    });
                } else {
                    if (!seenCodes.has(d.code)) {
                        seenCodes.add(d.code);
                        let individualDesc = rawDesc || (d.is_primary && parsedCodes.length === 0 ? 'Chẩn đoán chính' : 'Bệnh kèm theo');
                        parsedCodes.push({ code: d.code, isPrimary: d.is_primary && parsedCodes.length === 0, desc: individualDesc });
                        visibleIcdCodes.push(d.code);
                    }
                }
            }
            
            let diagHtml;
            if (parsedCodes.length > 0) {
                const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                const pills = parsedCodes.map(p => {
                    const cls = p.isPrimary ? 'cds-diag-pill primary' : 'cds-diag-pill';
                    return `<span class="${cls}" title="${escapeHtml(p.desc)}">${escapeHtml(p.code)}</span>`;
                }).join('');

                diagHtml = `<div class="cds-patient-diag">
                                <span class="cds-diag-label">Chẩn đoán:</span>
                                <div class="cds-diag-pills">${pills}</div>
                            </div>`;
            } else {
                diagHtml = '<div class="cds-patient-diag"><span class="cds-diag-label" style="opacity:0.5">Chưa có chẩn đoán ICD</span></div>';
            }
            
            patientInfo.innerHTML = `
                <div class="cds-patient-name" style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink: 0;"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${this.escapeHtml(context.patient.name || context.patient.id)}
                </div>
                ${diagHtml}
            `;
            patientInfo.style.display = 'block';
        } else {
            patientInfo.style.display = 'none';
        }

        alerts = (alerts || []).filter(alert => !this.alertSatisfiedByIcd(alert, visibleIcdCodes));
        summary = {
            ...summary,
            critical_count: alerts.filter(a => a.severity === 'high').length,
            warning_count: alerts.filter(a => a.severity === 'medium').length,
            info_count: alerts.filter(a => a.severity === 'low' || a.severity === 'info').length
        };

        // Cập nhật Shield Icon
        this.iconToggle.className = '';
        const shieldAlertSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
        const shieldCheckSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#004f9e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';

        const unmappedRaw = debug.unmapped_drugs || [];
        const seenUnmapped = new Set();
        const unmapped = [];
        for (const d of unmappedRaw) {
            const cleanKey = d.toLowerCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
            if (!seenUnmapped.has(cleanKey)) {
                seenUnmapped.add(cleanKey);
                unmapped.push(d);
            }
        }
        const hasUnmapped = unmapped.length > 0;

        if (summary.critical_count > 0) {
            this.iconToggle.classList.add('critical');
            this.iconToggle.innerHTML = shieldAlertSVG;
            this.iconToggle.style.color = '#ef4444';
        } else if (summary.warning_count > 0 || hasUnmapped) {
            this.iconToggle.classList.add('warning');
            this.iconToggle.innerHTML = shieldAlertSVG;
            this.iconToggle.style.color = '#f59e0b';
        } else {
            this.iconToggle.innerHTML = shieldCheckSVG;
        }

        const checkedRaw = debug.normalized_drugs || [];
        const seenChecked = new Set();
        const checked = [];
        for (const d of checkedRaw) {
            const cleanKey = d.toLowerCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
            if (!seenChecked.has(cleanKey)) {
                seenChecked.add(cleanKey);
                checked.push(d);
            }
        }

        statusText.textContent = `Đã phân tích: ${checked.length}/${summary.total_scanned || checked.length} thuốc`;

        // === BUILD BODY tab kê đơn ===
        container.innerHTML = '';

        if (alerts.length > 0) {
            alerts.forEach((alert, idx) => {
                const card = document.createElement('div');
                const severity = ['high', 'medium', 'low', 'info'].includes(alert.severity) ? alert.severity : 'info';
                card.className = `cds-alert-card ${severity}`;
                
                let matchedHtml = '';
                let linkHtml = '';

                if (alert.matched_items) {
                    const items = [];
                    if (alert.matched_items.drug) items.push(...alert.matched_items.drug);
                    if (items.length > 0) {
                        matchedHtml = `<div class="alert-match-list">${items.map(i => `<span>${this.escapeHtml(i)}</span>`).join('')}</div>`;
                    }

                    if (alert.domain === 'interaction' && alert.matched_items.drug && alert.matched_items.drug.length >= 2) {
                        const VN_QUERY = `tương tác thuốc giữa ${alert.matched_items.drug.join(' và ')}`;
                        linkHtml = `<a href="https://www.google.com/search?q=${encodeURIComponent(VN_QUERY)}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; margin-top:8px; font-size:11px; color:#004f9e; font-weight:bold; text-decoration:none;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg> Tra cứu Web</a>`;
                    } else if (alert.domain === 'insurance' && alert.missing_icd) {
                        const VN_QUERY = `mã icd ${alert.missing_icd.replace(/,/g, ' ')}`;
                        linkHtml = `<a href="https://www.google.com/search?q=${encodeURIComponent(VN_QUERY)}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; margin-top:8px; font-size:11px; color:#004f9e; font-weight:bold; text-decoration:none;"><svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg> Tra cứu mã ICD phác đồ</a>`;
                    }
                }

                card.innerHTML = `
                    <div class="cds-alert-title">${this.getSeverityEmoji(severity)} ${this.escapeHtml(alert.title)}</div>
                    <div class="cds-alert-effect">${this.escapeHtml(alert.effect)}</div>
                    <div class="cds-alert-rec">${this.escapeHtml(alert.recommendation)}</div>
                    ${matchedHtml}
                    ${linkHtml}
                `;
                container.appendChild(card);
            });
        }

        const coverageDiv = document.createElement('div');
        coverageDiv.className = 'cds-coverage-summary';

        const alertDrugs = new Set();
        alerts.forEach(a => {
            if (a.matched_items && a.matched_items.drug) {
                a.matched_items.drug.forEach(d => alertDrugs.add(d.toLowerCase()));
            }
        });
        
        const safeDrugs = checked.filter(d => !alertDrugs.has(d.toLowerCase()));
        
        let checkedHtml = '';
        if (safeDrugs.length > 0) {
            checkedHtml = `
                <div class="cds-coverage-group cds-checked">
                    <div class="cds-coverage-label">✅ Đã kiểm tra an toàn <span class="cds-coverage-count">(${safeDrugs.length})</span></div>
                    <div class="cds-coverage-pills">${safeDrugs.map(d => `<span class="cds-pill checked">${this.escapeHtml(d)}</span>`).join('')}</div>
                </div>`;
        }

        let uncheckedHtml = '';
        if (hasUnmapped) {
            const pills = unmapped.map(d => {
                const q = encodeURIComponent(`tương tác thuốc ${d}`);
                return `<a href="https://www.google.com/search?q=${q}" target="_blank" class="cds-pill unchecked" title="Tra cứu ${this.escapeHtml(d)} trên Google">${this.escapeHtml(d)} <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:3px;vertical-align:middle"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg></a>`;
            }).join('');
            uncheckedHtml = `
                <div class="cds-coverage-group cds-unchecked">
                    <div class="cds-coverage-label">❓ Chưa có dữ liệu <span class="cds-coverage-count">(${unmapped.length})</span></div>
                    <div class="cds-coverage-pills">${pills}</div>
                    <div class="cds-coverage-hint">Bấm vào tên thuốc để tra cứu Google</div>
                </div>`;
        }

        if (alerts.length === 0 && !hasUnmapped) {
            coverageDiv.innerHTML = '<p class="cds-empty-state">✅ Đơn thuốc an toàn!</p>' + checkedHtml;
        } else {
            coverageDiv.innerHTML = checkedHtml + uncheckedHtml;
        }

        container.appendChild(coverageDiv);

        // === CẬP NHẬT BADGE TAB SMARTSCORE & RENDER ===
        const evals = SmartScoreEngine.evaluatePatientContext(context);
        const suggestedCount = Object.values(evals).filter(e => e.suggested).length;
        const badge = document.getElementById('cds-score-badge');
        if (badge) {
            if (suggestedCount > 0) {
                badge.style.display = 'inline-block';
                badge.textContent = suggestedCount;
            } else {
                badge.style.display = 'none';
            }
        }

        if (this.activeTab === 'smartscore') {
            this.renderSmartScore();
        }
    },

    getSeverityEmoji(severity) {
        const bullet = (color) => `<svg width="12" height="12" style="margin-right:6px"><circle cx="6" cy="6" r="5" fill="${color}"/></svg>`;
        if (severity === 'high') return bullet('#ef4444');
        if (severity === 'medium') return bullet('#f59e0b');
        if (severity === 'low') return bullet('#0284c7');
        return bullet('#64748b');
    },

    updateCrawlInfo(result) {
        const infoEl = document.getElementById('cds-crawl-info');
        if (!infoEl) return;
        
        if (result.error) {
            infoEl.textContent = `❌ Import lỗi: ${result.error}`;
            infoEl.className = '';
            infoEl.style.display = '';
            return;
        }
        
        const now = new Date();
        const dateStr = now.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
        const timeStr = now.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        infoEl.innerHTML = `✅ Cập nhật ${dateStr} ${timeStr} — +${result.newBrands} thuốc mới`;
        infoEl.className = 'success';
        infoEl.style.display = '';
        
        setTimeout(() => {
            infoEl.innerHTML = `📅 Data: ${dateStr} • ${result.totalCrawled} thuốc`;
            infoEl.className = '';
        }, 30000);
    },

    showCrawlDate(meta) {
        const infoEl = document.getElementById('cds-crawl-info');
        if (!infoEl) return;
        
        if (meta?.ruleset_version) {
            infoEl.innerHTML = `📚 Tập luật BHYT: <b style="color: #004f9e">${meta.ruleset_version}</b>`;
            infoEl.title = `Nguồn: ${meta.ruleset_source || 'Unknown'} | Cập nhật: ${meta.last_updated ? new Date(meta.last_updated).toLocaleDateString('vi-VN') : 'Unknown'}`;
        } else if (meta?.lastCrawlDate) {
            const d = new Date(meta.lastCrawlDate);
            const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            infoEl.innerHTML = `📅 Cập nhật: ${dateStr} • ${meta.lastCrawlCount || '?'} thuốc`;
        } else if (meta?.seededAt) {
            const d = new Date(meta.seededAt);
            const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            infoEl.innerHTML = `📅 Data gốc: ${dateStr}`;
        } else {
            infoEl.innerHTML = `📅 Data: ${meta?.seedVersion || 'chưa rõ'}`;
        }
        infoEl.style.display = '';
    },

    showBhytToast(alerts) {
        if (!alerts || alerts.length === 0) return;
        
        let toast = document.getElementById('aladinn-bhyt-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'aladinn-bhyt-toast';
            toast.className = 'aladinn-bhyt-toast';
            document.body.appendChild(toast);
        }

        const count = alerts.length;
        toast.innerHTML = `
            <div class="aladinn-bhyt-toast-header">
                <span class="aladinn-bhyt-toast-icon">🛡️</span>
                <strong class="aladinn-bhyt-toast-title">BHYT Guard: Cảnh báo Xuất toán</strong>
            </div>
            <div>Phát hiện <b>${count}</b> quy tắc BHYT có thể bị xuất toán hoặc sai lệch thông tin hành chính.</div>
            <div class="aladinn-bhyt-toast-footer"><i>Mời bác sĩ nhấp mở Panel Aladinn ở góc phải màn hình HIS để kiểm tra chi tiết.</i></div>
        `;
        
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
        
        this.show();

        setTimeout(() => {
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, -20px)';
            }
        }, 8000);
    },

    showBhytAuditResults(result) {
        if (!result) return;
        
        const container = document.getElementById('cds-alerts-container');
        if (!container) return;

        const { alerts, drugCount, icdCount, timestamp } = result;
        const time = new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        if (alerts.length === 0) {
            const passHtml = `
                <div class="cds-alert-card" style="border-left: 4px solid #10b981; margin-bottom: 8px; background: #f0fdf4 !important;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 18px;">✅</span>
                        <div>
                            <div style="color: #166534; font-weight: bold; font-size: 12px;">Kiểm tra BHYT: Đạt yêu cầu</div>
                            <div style="color: #64748b; font-size: 11px;">${drugCount} thuốc, ${icdCount} ICD • Lúc ${time}</div>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('afterbegin', passHtml);
            return;
        }

        let html = `
            <div style="background: #fffbeb; border-radius: 0px; padding: 10px; margin-bottom: 8px; border: 1px solid #fde047;">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span style="font-size: 16px;">🛡️</span>
                    <strong style="color: #b45309; font-size: 12px;">BHYT Pre-claim Audit</strong>
                    <span style="color: #64748b; font-size: 11px; margin-left: auto;">${time}</span>
                </div>
                <div style="color: #64748b; font-size: 11px; margin-bottom: 4px;">${drugCount} thuốc, ${icdCount} ICD • ${alerts.length} vấn đề cần lưu ý</div>
            </div>
        `;

        for (const alert of alerts) {
            const borderColor = alert.severity === 'high' ? '#ef4444' : '#f59e0b';
            const bgClass = alert.severity === 'high' ? '#fef2f2' : '#fffbeb';
            const icon = alert.severity === 'high' ? '⛔' : '⚠️';
            html += `
                <div class="cds-alert-card" style="border-left: 4px solid ${borderColor}; margin-bottom: 6px; background: ${bgClass} !important; padding: 10px !important;">
                    <div style="display: flex; align-items: flex-start; gap: 6px;">
                        <span style="font-size: 14px; margin-top: 1px;">${icon}</span>
                        <div style="flex: 1; min-width: 0;">
                            <div style="color: #004f9e; font-weight: bold; font-size: 12px; margin-bottom: 2px;">${this.escapeHtml(alert.title)}</div>
                            <div style="color: #334155; font-size: 11px; line-height: 1.4;">${this.escapeHtml(alert.effect)}</div>
                            <div style="color: #15803d; font-size: 11px; margin-top: 4px; padding: 4px 6px; background: #dcfce7; font-weight: bold;">💡 ${this.escapeHtml(alert.recommendation)}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.insertAdjacentHTML('afterbegin', html);
        this.show();
    },

    // ==========================================
    // 🧮 SMARTSCORE COMPONENT LOGIC & UI V2
    // ==========================================

    renderSmartScore() {
        const container = document.getElementById('cds-smartscore-container');
        if (!container) return;

        // Lưu lại trạng thái mở/đóng hiện tại của các accordion trước khi re-render
        const openStates = {};
        container.querySelectorAll('.score-card-body').forEach(el => {
            const id = el.id.replace('score-card-body-', '');
            openStates[id] = el.style.display === 'block';
        });

        if (!this.currentContext) {
            container.innerHTML = '<div class="cds-empty-state">Chưa có dữ liệu bệnh nhân để tính điểm. Hãy chọn bệnh nhân trên HIS.</div>';
            return;
        }

        const evaluations = SmartScoreEngine.evaluatePatientContext(this.currentContext);

        // Khởi tạo scoreStates nếu chưa có hoặc đổi bệnh nhân
        const patientKey = this.currentContext.patient?.id || this.currentContext.patient?.name || '';
        if (this._lastPatientKey !== patientKey) {
            this._lastPatientKey = patientKey;
            this.scoreStates = {};
        }

        let html = '<div style="display:flex; flex-direction:column; gap:8px; padding: 2px 0;">';

        // Sắp xếp đưa các thang điểm gợi ý lên đầu tiên
        const sortedSystems = Object.entries(SmartScoreEngine.SCORING_SYSTEMS).sort(([idA], [idB]) => {
            const aSuggested = evaluations[idA]?.suggested ? 1 : 0;
            const bSuggested = evaluations[idB]?.suggested ? 1 : 0;
            return bSuggested - aSuggested;
        });

        sortedSystems.forEach(([id, sys]) => {
            const evalInfo = evaluations[id] || { suggested: false, prefilled: {}, missingLabs: {} };
            
            // Khởi tạo giá trị mặc định cho thang điểm
            if (!this.scoreStates[id]) {
                this.scoreStates[id] = {};
                Object.entries(sys.criteria).forEach(([k, crit]) => {
                    if (evalInfo.prefilled && evalInfo.prefilled[k] !== undefined) {
                        this.scoreStates[id][k] = evalInfo.prefilled[k];
                    } else {
                        this.scoreStates[id][k] = crit.default;
                    }
                });
            }

            const vals = this.scoreStates[id];
            const { total, risk, rec, color } = sys.calculate(vals);

            const isSuggested = evalInfo.suggested;
            const borderStyle = isSuggested ? 'border: 1px solid #004f9e; border-left: 4px solid #004f9e;' : 'border: 1px solid #a6c9e2; border-left: 4px solid #a6c9e2;';
            const bgHeader = isSuggested ? '#eaf2ff' : '#f5f9fd';
            const isOpen = openStates[id] !== undefined ? openStates[id] : isSuggested;

            html += `
                <div class="score-card" id="score-card-${id}" style="${borderStyle} background:#ffffff; font-size:12px; margin-bottom: 8px;">
                    <div class="score-card-header" style="background:${bgHeader}; padding:8px 12px; font-weight:bold; color:#004f9e; cursor:pointer; display:flex; justify-content:space-between; align-items:center;" onclick="const el = document.getElementById('score-card-body-${id}'); el.style.display = el.style.display === 'none' ? 'block' : 'none';">
                        <span style="display: flex; align-items: center; gap: 4px;">
                            ${sys.name}
                            ${isSuggested ? '<span style="background:#004f9e; color:#ffffff; font-size:9px; padding:1px 4px; font-weight:bold; border-radius:0px;">Gợi ý</span>' : ''}
                        </span>
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </div>
                    <div class="score-card-body" id="score-card-body-${id}" style="padding:10px; display:${isOpen ? 'block' : 'none'}; border-top: 1px solid #cbd5e1;">
                        <p style="margin: 0 0 8px 0; color:#64748b; font-size:11px; font-style:italic; line-height:1.3;">${sys.description}</p>
                        
                        <div class="score-criteria-inputs" style="display:flex; flex-direction:column; gap:6px;">
            `;

            Object.entries(sys.criteria).forEach(([k, crit]) => {
                const curVal = vals[k];

                if (crit.type === 'checkbox') {
                    const isChecked = !!curVal;
                    html += `
                        <label style="display:flex; align-items:flex-start; gap:6px; cursor:pointer; font-weight:normal; color:#333; padding: 4px; transition: background 0.15s;">
                            <input type="checkbox" id="crit-${id}-${k}" ${isChecked ? 'checked' : ''} style="margin-top:2px; border-radius:0px; border:1px solid #a6c9e2; width:13px; height:13px;" data-action="score-change" data-score-id="${id}" data-criteria-key="${k}">
                            <span>${crit.label}</span>
                        </label>
                    `;
                } else if (crit.type === 'select') {
                    let segmentsHtml = '<div class="score-segment-group">';
                    crit.options.forEach(opt => {
                        const isActive = Number(curVal) === opt.val;
                        segmentsHtml += `<div class="score-segment-btn ${isActive ? 'active' : ''}" data-action="score-change" data-score-id="${id}" data-criteria-key="${k}" data-val="${opt.val}" title="${opt.text}">${opt.text}</div>`;
                    });
                    segmentsHtml += '</div>';

                    html += `
                        <div style="display:flex; flex-direction:column; gap:3px; padding: 4px;">
                            <span style="font-weight:bold; color:#475569;">${crit.label}</span>
                            ${segmentsHtml}
                        </div>
                    `;
                }
            });

            // Hiển thị kết quả điểm và khuyến cáo
            html += `
                        </div>
                        
                        <div class="score-card-result ${color || 'green'}" style="margin-top:10px; padding:8px 10px; background:#f0f7ff; border:1px dashed #a6c9e2; display:flex; flex-direction:column; gap:3px;">
                            <div style="font-weight:bold; color:#004f9e; font-size:12px;">Kết quả: <span style="color:#ef4444; font-size:14px;">${total}</span> điểm</div>
                            <div style="font-weight:bold; color:#1e293b;">Đánh giá: <span style="${color === 'red' ? 'color:#dc2626;' : (color === 'orange' ? 'color:#d97706;' : 'color:#16a34a;')}">${risk}</span></div>
                            <div style="color:#475569; font-size:11px; line-height:1.35; font-style:italic;">💡 Khuyến cáo: ${rec}</div>
                        </div>
                    </div>
                </div>
            `;
        });

        html += '</div>';
        container.innerHTML = html;
    },

    onScoreCriteriaChange(scoreId, criteriaKey, value) {
        if (!this.scoreStates[scoreId]) return;
        this.scoreStates[scoreId][criteriaKey] = value;
        this.renderSmartScore();
    },

    onScoreFillClick(scoreId) {
        const sys = SmartScoreEngine.SCORING_SYSTEMS[scoreId];
        if (!sys || !this.scoreStates[scoreId]) return;

        const vals = this.scoreStates[scoreId];
        const { total, risk, rec } = sys.calculate(vals);

        const text = SmartScoreEngine.generateDescription(scoreId, vals, total, risk, rec);
        this.autoFillToHis(text);
    },

    autoFillToHis(text) {
        // Kiểm tra Patient Context Guard trước khi điền để tránh nhiễm chéo bệnh nhân
        if (this.currentContext) {
            const domPatientId = String(this.currentContext.patient?.id || '').trim();
            const currentDomPatientId = String(CDSExtractor.getPatientId() || '').trim();
            if (domPatientId && currentDomPatientId && domPatientId !== currentDomPatientId && domPatientId !== 'anonymous_patient' && currentDomPatientId !== 'anonymous_patient') {
                alert(`⚠️ [CẢNH BÁO AN TOÀN] Không khớp danh tính bệnh nhân!\nBệnh nhân trên thang điểm: ${this.currentContext.patient?.name || domPatientId}\nBệnh nhân đang mở trên HIS: ${CDSExtractor.getPatientName()} (${currentDomPatientId})\n\nĐể đảm bảo an toàn lâm sàng, Aladinn đã ngăn chặn điền tự động.`);
                return false;
            }
        }

        // Tìm ô nhập liệu phù hợp
        let target = document.activeElement;
        
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                if (iframe.contentDocument && iframe.contentDocument.activeElement) {
                    const activeEl = iframe.contentDocument.activeElement;
                    const tag = activeEl.tagName.toLowerCase();
                    if (tag === 'textarea' || (tag === 'input' && activeEl.type === 'text')) {
                        target = activeEl;
                        break;
                    }
                }
            } catch (_e) {}
        }

        const selectors = [
            'textarea[id*="DienBien"]', 'textarea[name*="DienBien"]', 'textarea[id*="dienbien"]',
            'textarea[id*="YLenh"]', 'textarea[name*="YLenh"]', 'textarea[id*="ylenh"]',
            'textarea[id*="ChuanDoan"]', 'textarea[name*="ChuanDoan"]', 'textarea[id*="chuandoan"]',
            'textarea[id*="MoTaBenh"]', 'textarea[name*="MoTaBenh"]',
            'textarea', 'input[type="text"]'
        ];

        if (!target || (target.tagName.toLowerCase() !== 'textarea' && !(target.tagName.toLowerCase() === 'input' && target.type === 'text'))) {
            for (const sel of selectors) {
                const els = CDSExtractor.getElementsAcrossIframes(sel);
                if (els.length > 0) {
                    target = els[0];
                    break;
                }
            }
        }

        if (!target) {
            alert('⚠️ Vui lòng nhấp con trỏ chuột vào ô nhập liệu cần điền trên HIS (Diễn biến bệnh, Y lệnh, Chẩn đoán...) rồi bấm lại nút này.');
            return false;
        }

        const origVal = target.value || '';
        const separator = origVal ? '\n\n' : '';
        target.value = origVal + separator + text;

        const events = ['input', 'change'];
        events.forEach(name => {
            const ev = new Event(name, { bubbles: true });
            target.dispatchEvent(ev);
        });

        const origBg = target.style.backgroundColor;
        target.style.transition = 'background-color 0.2s';
        target.style.backgroundColor = '#e0f2fe';
        setTimeout(() => {
            target.style.backgroundColor = origBg;
        }, 800);

        return true;
    }
};
