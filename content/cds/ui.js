/**
 * 🧞 Aladinn CDS — UI Drawer Panel
 * Vẽ giao diện Cảnh Báo Lâm Sàng (Ngăn Kéo Nổi 320px) bên mép phải màn hình HIS.
 */

export const CDSUI = {
    panel: null,
    iconToggle: null,
    isOpen: false,
    hasUserDismissed: false,  // User đã tự đóng panel
    lastAlertLevel: 'safe',   // Lưu level cuối cùng để chỉ auto-show khi severity thay đổi


    init() {
        if (document.getElementById('aladinn-cds-drawer')) return;

        // Container chung
        const container = document.createElement('div');
        container.id = 'aladinn-cds-drawer';
        
        // Khối Panel nội dung (Drawer)
        const panel = document.createElement('div');
        panel.id = 'aladinn-cds-panel';
        panel.innerHTML = `
            <div class="cds-header">
                <h3>
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:6px"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>
                    An Toàn Kê Đơn
                </h3>
                <div style="display:flex; gap: 8px;">
                    <span id="cds-bhyt-audit-btn" class="header-action-btn" title="Kiểm tra BHYT (Pre-claim Audit)" style="font-size: 13px; letter-spacing: 0.5px;">
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
            <div class="cds-body">
                <div id="cds-alerts-container">
                    <div class="cds-empty-state" id="cds-empty-state">
                        <div style="opacity:0.6; margin-bottom:8px">
                            <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>
                        </div>
                        Chưa có dữ liệu thuốc
                        <button id="cds-manual-rescan" style="margin-top:12px; padding:6px 16px; border:1px solid rgba(255,255,255,0.15); border-radius:8px; background:rgba(255,255,255,0.05); color:inherit; cursor:pointer; font-size:12px; display:flex; align-items:center; gap:6px; transition:all .2s">
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                            Quét lại
                        </button>
                    </div>
                </div>
            </div>
            <div class="cds-footer">
                <div id="cds-status-text">Đã phân tích: 0 thuốc</div>
            </div>
        `;

        const icon = document.createElement('div');
        icon.id = 'aladinn-cds-shield';
        icon.title = 'Hệ thống Cảnh báo Lâm sàng (An toàn)';
        icon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';

        // Đảo ngược thứ tự append để dùng với flex-direction: row-reverse
        container.appendChild(panel);
        container.appendChild(icon);
        document.body.appendChild(container);

        this.panel = panel;
        this.iconToggle = icon;

        this.injectCSS();
        this.bindEvents();
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
                width: 48px !important;
                height: 48px !important;
                background: rgba(20, 27, 45, 0.92) !important;
                backdrop-filter: blur(10px) !important;
                -webkit-backdrop-filter: blur(10px) !important;
                border: 1px solid rgba(255,255,255,0.1) !important;
                border-radius: 50% !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 22px !important;
                cursor: pointer !important;
                box-shadow: 0 4px 20px rgba(0,0,0,0.3) !important;
                transition: transform 0.2s ease, box-shadow 0.2s !important;
            }
            #aladinn-cds-shield:hover { transform: scale(1.05) !important; box-shadow: 0 6px 24px rgba(0,0,0,0.4) !important; }
            #aladinn-cds-shield.warning { border-color: #E8A838 !important; animation: pulse-warning 2s infinite !important; }
            #aladinn-cds-shield.critical { border-color: #E85454 !important; animation: pulse-critical 1.5s infinite !important; }

            #aladinn-cds-panel {
                pointer-events: auto !important;
                width: 340px !important;
                background: rgba(12, 18, 34, 0.94) !important;
                backdrop-filter: blur(24px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(24px) saturate(180%) !important;
                border-radius: 20px !important;
                box-shadow: 0 10px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.06) inset !important;
                border: 1px solid rgba(255,255,255,0.08) !important;
                display: flex !important;
                flex-direction: column !important;
                max-height: 70vh !important;
                overflow: hidden !important;
                
                opacity: 0 !important;
                transform: translateY(20px) scale(0.95) !important;
                visibility: hidden !important;
                transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1) !important;
                transform-origin: bottom right !important;
            }
            #aladinn-cds-drawer.aladinn-drawer-active #aladinn-cds-panel {
                opacity: 1 !important;
                transform: translateY(0) scale(1) !important;
                visibility: visible !important;
            }

            .cds-header {
                padding: 16px 20px !important;
                border-bottom: 1px solid rgba(255,255,255,0.06) !important;
                display: flex !important;
                justify-content: space-between !important;
                align-items: center !important;
                background: transparent !important;
                min-height: 50px !important;
            }
            .cds-header h3 { margin: 0 !important; font-size: 15px !important; color: #E8E0D4 !important; font-weight: 600 !important; letter-spacing: -0.01em !important; display: flex !important; align-items: center !important;}
            .cds-header h3 svg { stroke: #60a5fa !important; }
            .header-action-btn { 
                cursor: pointer; color: #64748b;
                width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                background: rgba(255,255,255,0.05); transition: background 0.2s, color 0.2s;
            }
            .header-action-btn:hover { background: rgba(255,255,255,0.1); color: #E8E0D4; }
            
            .cds-body {
                flex: 1 !important;
                padding: 16px 20px !important;
                overflow-y: auto !important;
                background: transparent !important;
                color: #e2e8f0 !important;
            }
            /* Scrollbar dark */
            .cds-body::-webkit-scrollbar { width: 4px; }
            .cds-body::-webkit-scrollbar-track { background: transparent; }
            .cds-body::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 4px; }

            .cds-footer {
                padding: 12px 20px !important;
                border-top: 1px solid rgba(255,255,255,0.06) !important;
                text-align: center !important;
                background: rgba(0,0,0,0.2) !important;
            }
            #cds-status-text { color: #64748b !important; font-size: 12px !important; }
            #cds-crawl-info { color: #8B8579 !important; font-size: 11px !important; padding: 6px 16px !important; border-bottom: 1px solid rgba(255,255,255,0.06) !important; background: rgba(20,27,45,0.5) !important; }
            #cds-crawl-info.success { color: #34d399 !important; }
            .cds-empty-state { text-align: center; color: #8B8579 !important; font-size: 13px !important; margin-top: 40px !important; }

            .cds-patient-info {
                padding: 10px 20px !important;
                border-bottom: 1px solid rgba(255,255,255,0.06) !important;
                background: rgba(255,255,255,0.02) !important;
            }
            .cds-patient-name {
                font-weight: 700 !important;
                color: #E8E0D4 !important;
                font-size: 13px !important;
                margin-bottom: 4px !important;
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
            }
            .cds-patient-diag {
                font-size: 11px !important;
                color: #8B8579 !important;
                line-height: 1.4 !important;
                display: flex !important;
                flex-direction: column !important;
                gap: 6px !important;
            }
            .cds-diag-label {
                font-size: 10px !important;
                color: #8B8579 !important;
                font-weight: 600 !important;
                text-transform: uppercase !important;
                letter-spacing: 0.5px !important;
            }
            .cds-diag-pills {
                display: flex !important;
                flex-wrap: wrap !important;
                gap: 4px !important;
            }
            .cds-diag-pill {
                display: inline-block !important;
                padding: 2px 7px !important;
                border-radius: 5px !important;
                font-size: 11px !important;
                font-weight: 600 !important;
                font-family: 'SF Mono', 'Menlo', 'Consolas', monospace !important;
                color: #c8b89a !important;
                background: rgba(255,255,255,0.06) !important;
                border: 1px solid rgba(255,255,255,0.08) !important;
                letter-spacing: 0.3px !important;
                line-height: 1.4 !important;
                transition: all 0.2s ease !important;
                cursor: pointer !important;
            }
            .cds-diag-pill:hover {
                background: rgba(255,255,255,0.1) !important;
                border-color: rgba(255,255,255,0.15) !important;
                transform: translateY(-2px) !important;
                box-shadow: 0 4px 12px rgba(212, 162, 90, 0.15) !important;
            }
            .cds-diag-pill.primary {
                color: #f0d78c !important;
                background: rgba(212,162,90,0.15) !important;
                border-color: rgba(212,162,90,0.3) !important;
            }
            .cds-diag-pill.primary:hover {
                background: rgba(212,162,90,0.22) !important;
            }
            
            /* Alert Cards — Dark */
            .cds-alert-card {
                background: rgba(255,255,255,0.04) !important;
                border-radius: 12px !important;
                padding: 16px !important;
                margin-bottom: 12px !important;
                box-shadow: none !important;
                border: 1px solid rgba(255,255,255,0.06) !important;
                border-left: 4px solid #475569 !important;
                text-align: left !important;
            }
            .cds-alert-card.high { border-left-color: #E85454 !important; background: rgba(232, 84, 84, 0.06) !important; animation: aladinn-glowPulseRed 2s ease-in-out infinite; }
            .cds-alert-card.medium { border-left-color: #E8A838 !important; background: rgba(232, 168, 56, 0.06) !important; animation: aladinn-glowPulseGold 2s ease-in-out infinite; }
            .cds-alert-card.low, .cds-alert-card.info { border-left-color: #3b82f6 !important; }
            
            .cds-alert-title { font-weight: 600 !important; font-size: 14px !important; color: #E8E0D4 !important; margin-bottom: 6px !important; display: flex !important; align-items: center !important; gap: 6px !important;}
            .cds-alert-effect { font-size: 13px !important; color: #8B8579 !important; margin-bottom: 10px !important; line-height: 1.4 !important; }
            .cds-alert-rec { font-size: 12px !important; color: #34d399 !important; font-weight: 600 !important; background: rgba(52, 211, 153, 0.1) !important; padding: 6px 10px !important; border-radius: 6px !important; display: inline-block !important; }
            
            .alert-match-list { margin-top: 12px; font-size: 11px; }
            .alert-match-list span { background: rgba(255,255,255,0.06); padding: 4px 8px; border-radius: 6px; font-family: -apple-system, monospace; color: #E8E0D4; margin-right: 6px; display: inline-block; margin-bottom: 4px;}
            
            @keyframes pulse-warning {
                0% { box-shadow: 0 0 0 0 rgba(232, 168, 56, 0.4); }
                70% { box-shadow: 0 0 0 12px rgba(232, 168, 56, 0); }
                100% { box-shadow: 0 0 0 0 rgba(232, 168, 56, 0); }
            }
            @keyframes pulse-critical {
                0% { box-shadow: 0 0 0 0 rgba(232, 84, 84, 0.4); }
                70% { box-shadow: 0 0 0 12px rgba(232, 84, 84, 0); }
                100% { box-shadow: 0 0 0 0 rgba(232, 84, 84, 0); }
            }
            
            /* Drug Coverage Summary — Dark */
            .cds-coverage-summary { margin-top: 12px !important; }
            .cds-coverage-group { 
                padding: 12px !important; border-radius: 10px !important; margin-bottom: 10px !important;
            }
            .cds-checked { background: rgba(16, 185, 129, 0.08) !important; border: 1px solid rgba(16, 185, 129, 0.2) !important; }
            .cds-unchecked { background: rgba(232, 168, 56, 0.08) !important; border: 1px solid rgba(232, 168, 56, 0.2) !important; }
            .cds-coverage-label { 
                font-size: 12px !important; font-weight: 600 !important; color: #e2e8f0 !important; 
                margin-bottom: 8px !important; display: flex !important; align-items: center !important; gap: 4px !important;
            }
            .cds-coverage-count { font-weight: 400 !important; color: #64748b !important; }
            .cds-coverage-pills { display: flex !important; flex-wrap: wrap !important; gap: 5px !important; }
            .cds-pill {
                display: inline-flex !important; align-items: center !important;
                padding: 3px 8px !important; border-radius: 6px !important; font-size: 11px !important;
                font-family: -apple-system, monospace !important; line-height: 1.3 !important;
            }
            .cds-pill.checked { 
                background: rgba(16, 185, 129, 0.15) !important; color: #6ee7b7 !important; 
                border: 1px solid rgba(16, 185, 129, 0.25) !important;
            }
            .cds-pill.unchecked { 
                background: rgba(232, 168, 56, 0.12) !important; color: #fcd34d !important;
                border: 1px solid rgba(232, 168, 56, 0.25) !important;
                text-decoration: none !important; cursor: pointer !important;
                transition: background 0.15s, border-color 0.15s !important;
            }
            .cds-pill.unchecked:hover { 
                background: rgba(232, 168, 56, 0.22) !important; 
                border-color: rgba(232, 168, 56, 0.4) !important; 
            }
            .cds-coverage-hint {
                margin-top: 6px !important; font-size: 10px !important; color: #64748b !important;
                font-style: italic !important;
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
        document.getElementById('aladinn-cds-drawer').classList.add('aladinn-drawer-active');
        this.isOpen = true;
    },

    hide() {
        document.getElementById('aladinn-cds-drawer').classList.remove('aladinn-drawer-active');
        this.isOpen = false;
        this.hasUserDismissed = true;  // Ghi nhận user tự đóng
    },

    update({ summary, alerts, debug, context }) {
        if (!this.panel) this.init();

        const container = document.getElementById('cds-alerts-container');
        const statusText = document.getElementById('cds-status-text');
        const patientInfo = document.getElementById('cds-patient-info');

        // Render Patient Info
        if (context && context.patient && context.patient.id) {
            const diagnoses = context.encounter.diagnoses || [];
            const icdRegex = /\b([A-Z]\d{2}(?:\.\d{1,2})?)\b/g;
            
            // Parse clean ICD codes from d.code (which may contain full text like "N18.5 - Suy thận mạn...")
            const parsedCodes = [];
            const seenCodes = new Set();
            const descParts = [];
            for (const d of diagnoses) {
                if (!d.code) continue;
                const matches = d.code.match(icdRegex);
                if (matches) {
                    for (const m of matches) {
                        if (!seenCodes.has(m)) {
                            seenCodes.add(m);
                            parsedCodes.push({ code: m, isPrimary: d.is_primary && parsedCodes.length === 0 });
                        }
                    }
                    // Collect description text (strip ICD codes)
                    const desc = d.code.replace(icdRegex, '').replace(/^[\s,;=-]+/, '').replace(/[\s,;=-]+$/, '').trim();
                    if (desc && desc.length > 2) descParts.push(desc);
                } else {
                    // d.code is already a clean code
                    if (!seenCodes.has(d.code)) {
                        seenCodes.add(d.code);
                        parsedCodes.push({ code: d.code, isPrimary: d.is_primary && parsedCodes.length === 0 });
                    }
                }
            }
            
            let diagHtml;
            if (parsedCodes.length > 0) {
                const pills = parsedCodes.map(p => {
                    const cls = p.isPrimary ? 'cds-diag-pill primary' : 'cds-diag-pill';
                    return `<span class="${cls}" title="${p.isPrimary ? 'Chẩn đoán chính' : 'Kèm theo'}">${p.code}</span>`;
                }).join('');
                
                let descHtml = '';
                if (descParts.length > 0) {
                    const escapeHtml = (str) => String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
                    const descList = descParts.map(desc => `<li style="margin-bottom:3px; padding-bottom:3px; border-bottom:1px solid rgba(255,255,255,0.05);">${escapeHtml(desc)}</li>`).join('');
                    descHtml = `
                        <details style="margin-top:4px;">
                            <summary style="font-size:10px; color:#8B8579; cursor:pointer; outline:none; user-select:none; opacity:0.8;">
                                Xem chi tiết mô tả ▾
                            </summary>
                            <div style="margin-top:6px; padding:6px 8px; background:rgba(0,0,0,0.15); border-radius:4px; font-size:11px; color:#c8b89a; max-height:80px; overflow-y:auto;">
                                <ul style="margin:0; padding-left:12px; line-height:1.4; list-style-type:'›  ';">${descList}</ul>
                            </div>
                        </details>
                    `;
                }

                diagHtml = `<div class="cds-patient-diag">
                                <span class="cds-diag-label">Chẩn đoán:</span>
                                <div class="cds-diag-pills">${pills}</div>
                                ${descHtml}
                            </div>`;
            } else {
                diagHtml = '<div class="cds-patient-diag"><span class="cds-diag-label" style="opacity:0.5">Chưa có chẩn đoán ICD</span></div>';
            }
            
            patientInfo.innerHTML = `
                <div class="cds-patient-name">
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    ${context.patient.name || context.patient.id}
                </div>
                ${diagHtml}
            `;
            patientInfo.style.display = 'block';
        } else {
            patientInfo.style.display = 'none';
        }

        
        // Cập nhật Shield Icon (KHÔNG tự bung panel — user click khi cần)
        this.iconToggle.className = '';
        
        const shieldAlertSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="M12 8v4"/><path d="M12 16h.01"/></svg>';
        const shieldCheckSVG = '<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#10b981" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>';

        const unmapped = debug.unmapped_drugs || [];
        const hasUnmapped = unmapped.length > 0;

        if (summary.critical_count > 0) {
            this.iconToggle.classList.add('critical');
            this.iconToggle.innerHTML = shieldAlertSVG;
            this.iconToggle.style.color = '#E85454';
        } else if (summary.warning_count > 0 || hasUnmapped) {
            this.iconToggle.classList.add('warning');
            this.iconToggle.innerHTML = shieldAlertSVG;
            this.iconToggle.style.color = '#E8A838';
        } else {
            this.iconToggle.innerHTML = shieldCheckSVG;
        }

        statusText.textContent = `Đã phân tích: ${debug.normalized_drugs.length}/${summary.total_scanned || debug.normalized_drugs.length} thuốc`;

        // === BUILD BODY ===
        container.innerHTML = '';

        // 1. Render Alerts (nếu có)
        if (alerts.length > 0) {
            alerts.forEach((alert, idx) => {
                const card = document.createElement('div');
                card.className = `cds-alert-card ${alert.severity}`;
                card.style.opacity = '0';
                card.style.transform = 'translateY(12px)';
                card.style.animation = 'aladinn-staggerIn .4s ease forwards';
                card.style.animationDelay = `${idx * 0.08}s`;
                
                let matchedHtml = '';
                let linkHtml = '';

                if (alert.matched_items) {
                    const items = [];
                    if (alert.matched_items.drug) items.push(...alert.matched_items.drug);
                    
                    if (items.length > 0) {
                        matchedHtml = `<div class="alert-match-list">${items.map(i => `<span>${i}</span>`).join('')}</div>`;
                    }

                    if (alert.domain === 'interaction' && alert.matched_items.drug && alert.matched_items.drug.length >= 2) {
                        const VN_QUERY = `tương tác thuốc giữa ${alert.matched_items.drug.join(' và ')}`;
                        linkHtml = `<a href="https://www.google.com/search?q=${encodeURIComponent(VN_QUERY)}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; margin-top:10px; font-size:12px; color:#2563eb; font-weight:600; text-decoration:none;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg> Tra cứu Web</a>`;
                    } else if (alert.domain === 'insurance' && alert.missing_icd) {
                        const VN_QUERY = `mã icd ${alert.missing_icd.replace(/,/g, ' ')}`;
                        linkHtml = `<a href="https://www.google.com/search?q=${encodeURIComponent(VN_QUERY)}" target="_blank" style="display:inline-flex; align-items:center; gap:4px; margin-top:10px; font-size:12px; color:#2563eb; font-weight:600; text-decoration:none;"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg> Tra cứu mã ICD phác đồ</a>`;
                    }
                }

                card.innerHTML = `
                    <div class="cds-alert-title">${this.getSeverityEmoji(alert.severity)} ${alert.title}</div>
                    <div class="cds-alert-effect">${alert.effect}</div>
                    <div class="cds-alert-rec">${alert.recommendation}</div>
                    ${matchedHtml}
                    ${linkHtml}
                `;
                container.appendChild(card);
            });
        }

        // 2. Drug Coverage Summary — LUÔN HIỂN THỊ
        const coverageDiv = document.createElement('div');
        coverageDiv.className = 'cds-coverage-summary';

        // 2a. Thuốc ĐÃ KIỂM TRA (normalized)
        const checked = debug.normalized_drugs || [];
        
        // Lọc ra những thuốc AN TOÀN (không nằm trong cảnh báo nào)
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
                    <div class="cds-coverage-pills">${safeDrugs.map(d => `<span class="cds-pill checked">${d}</span>`).join('')}</div>
                </div>`;
        }

        // 2b. Thuốc CHƯA CÓ DỮ LIỆU (unmapped) — kèm link Google
        let uncheckedHtml = '';
        if (hasUnmapped) {
            const pills = unmapped.map(d => {
                const q = encodeURIComponent(`tương tác thuốc ${d}`);
                return `<a href="https://www.google.com/search?q=${q}" target="_blank" class="cds-pill unchecked" title="Tra cứu ${d} trên Google">${d} <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:3px;vertical-align:middle"><path d="M21 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h6"/><path d="m21 3-9 9"/><path d="M15 3h6v6"/></svg></a>`;
            }).join('');
            uncheckedHtml = `
                <div class="cds-coverage-group cds-unchecked">
                    <div class="cds-coverage-label">❓ Chưa có dữ liệu <span class="cds-coverage-count">(${unmapped.length})</span></div>
                    <div class="cds-coverage-pills">${pills}</div>
                    <div class="cds-coverage-hint">Bấm vào tên thuốc để tra cứu Google</div>
                </div>`;
        }

        // No alerts + all checked = safe
        if (alerts.length === 0 && !hasUnmapped) {
            coverageDiv.innerHTML = '<p class="cds-empty-state">✅ Đơn thuốc an toàn!</p>' + checkedHtml;
        } else {
            coverageDiv.innerHTML = checkedHtml + uncheckedHtml;
        }

        container.appendChild(coverageDiv);
    },

    getSeverityEmoji(severity) {
        // Trả về dấu chấm tròn màu sắc chỉ báo mức độ chuyên nghiệp hơn emoji
        const bullet = (color) => `<svg width="12" height="12" style="margin-right:6px"><circle cx="6" cy="6" r="5" fill="${color}"/></svg>`;
        if (severity === 'high') return bullet('#E85454');
        if (severity === 'medium') return bullet('#E8A838');
        if (severity === 'low') return bullet('#3b82f6');
        return bullet('#E8E0D4');
    },

    /**
     * Hiến thị thông tin crawl (sau khi import xong)
     */
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
        
        // Từ động ẩn sau 30s
        setTimeout(() => {
            infoEl.innerHTML = `📅 Data: ${dateStr} • ${result.totalCrawled} thuốc`;
            infoEl.className = '';
        }, 30000);
    },

    /**
     * Hiển thị ngày cập nhật từ metadata
     */
    showCrawlDate(meta) {
        const infoEl = document.getElementById('cds-crawl-info');
        if (!infoEl) return;
        
        if (meta?.lastCrawlDate) {
            // Hiện ngày cào gần nhất
            const d = new Date(meta.lastCrawlDate);
            const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            infoEl.innerHTML = `📅 Cập nhật: ${dateStr} • ${meta.lastCrawlCount || '?'} thuốc`;
        } else if (meta?.seededAt) {
            // Fallback: hiện ngày seed ban đầu
            const d = new Date(meta.seededAt);
            const dateStr = d.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
            infoEl.innerHTML = `📅 Data gốc: ${dateStr}`;
        } else {
            infoEl.innerHTML = `📅 Data: ${meta?.seedVersion || 'chưa rõ'}`;
        }
        infoEl.style.display = '';
    },

    /**
     * BHYT Guard: Hiển thị Toast cảnh báo Warn-only khi Ra viện
     */
    showBhytToast(alerts) {
        if (!alerts || alerts.length === 0) return;
        
        let toast = document.getElementById('aladinn-bhyt-toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'aladinn-bhyt-toast';
            toast.style.cssText = `
                position: fixed;
                top: 20px;
                left: 50%;
                transform: translateX(-50%);
                background: rgba(232, 168, 56, 0.95);
                color: #fff;
                padding: 16px 24px;
                border-radius: 12px;
                box-shadow: 0 10px 30px rgba(0,0,0,0.5);
                z-index: 2147483647;
                font-family: system-ui, sans-serif;
                font-size: 15px;
                max-width: 400px;
                backdrop-filter: blur(10px);
                border: 1px solid rgba(255,255,255,0.2);
                transition: opacity 0.3s, transform 0.3s;
                pointer-events: none;
            `;
            document.body.appendChild(toast);
        }

        const count = alerts.length;
        toast.innerHTML = `
            <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 8px;">
                <span style="font-size: 24px;">🛡️</span>
                <strong style="font-size: 16px;">BHYT Guard: Cảnh báo Rủi ro</strong>
            </div>
            <div>Phát hiện <b>${count}</b> vấn đề BHYT/Lâm sàng có thể gây xuất toán hoặc sai sót hồ sơ.</div>
            <div style="margin-top: 8px; font-size: 13px; opacity: 0.9;"><i>Hệ thống vẫn đang Lưu hồ sơ bình thường. Vui lòng kiểm tra lại Panel Aladinn ở góc phải.</i></div>
        `;
        
        toast.style.opacity = '1';
        toast.style.transform = 'translate(-50%, 0)';
        
        // Hiện panel Aladinn lên để bác sĩ xem chi tiết
        this.show();

        // Ẩn sau 8 giây
        setTimeout(() => {
            if (toast) {
                toast.style.opacity = '0';
                toast.style.transform = 'translate(-50%, -20px)';
            }
        }, 8000);
    },

    /**
     * BHYT Audit: Hiển thị kết quả kiểm tra BHYT on-demand (Phase 2)
     */
    showBhytAuditResults(result) {
        if (!result) return;
        
        const container = document.getElementById('cds-alerts-container');
        if (!container) return;

        const { alerts, drugCount, icdCount, timestamp } = result;
        const time = new Date(timestamp).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        
        if (alerts.length === 0) {
            // Thêm banner pass vào đầu panel
            const passHtml = `
                <div class="cds-alert" style="border-left: 4px solid #10b981; margin-bottom: 8px;">
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <span style="font-size: 20px;">✅</span>
                        <div>
                            <div style="color: #10b981; font-weight: 700; font-size: 13px;">Kiểm tra BHYT: Đạt</div>
                            <div style="color: #A0998E; font-size: 12px;">${drugCount} thuốc, ${icdCount} ICD • ${time}</div>
                        </div>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML('afterbegin', passHtml);
            return;
        }

        // Render audit alerts (không replace, chỉ thêm vào đầu)
        let html = `
            <div style="background: rgba(232, 168, 56, 0.1); border-radius: 10px; padding: 8px 12px; margin-bottom: 8px; border: 1px solid rgba(232, 168, 56, 0.3);">
                <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 4px;">
                    <span style="font-size: 16px;">🛡️</span>
                    <strong style="color: #E8A838; font-size: 13px;">BHYT Pre-claim Audit</strong>
                    <span style="color: #A0998E; font-size: 11px; margin-left: auto;">${time}</span>
                </div>
                <div style="color: #A0998E; font-size: 11px; margin-bottom: 6px;">${drugCount} thuốc, ${icdCount} ICD • ${alerts.length} vấn đề</div>
            </div>
        `;

        for (const alert of alerts) {
            const borderColor = alert.severity === 'high' ? '#E85454' : '#E8A838';
            const icon = alert.severity === 'high' ? '⛔' : '⚠️';
            html += `
                <div class="cds-alert" style="border-left: 4px solid ${borderColor}; margin-bottom: 6px;">
                    <div style="display: flex; align-items: flex-start; gap: 6px;">
                        <span style="font-size: 14px; margin-top: 1px;">${icon}</span>
                        <div style="flex: 1; min-width: 0;">
                            <div style="color: ${borderColor}; font-weight: 700; font-size: 12px; margin-bottom: 2px;">${alert.title}</div>
                            <div style="color: #D4CFC5; font-size: 12px; line-height: 1.4;">${alert.effect}</div>
                            <div style="color: #10b981; font-size: 11px; margin-top: 4px; padding: 4px 6px; background: rgba(16,185,129,0.08); border-radius: 6px;">💡 ${alert.recommendation}</div>
                        </div>
                    </div>
                </div>
            `;
        }

        container.insertAdjacentHTML('afterbegin', html);
        
        // Mở panel để hiển thị kết quả
        this.show();
    }
};
