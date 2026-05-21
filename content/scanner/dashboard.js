/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Dashboard (Analytics & Statistics)
 * 
 * Hiển thị thống kê trực quan phân bổ bệnh nhân theo buồng.
 * Hỗ trợ hiển thị Mini-Dashboard với thiết kế cao cấp và vị trí thông minh.
 */

const VNPTDashboard = (function () {
    /**
     * Escape HTML entities for safe innerHTML interpolation.
     * @param {string} value
     * @returns {string}
     */
    function escapeHtml(value) {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    /**
     * Hiển thị Dashboard Modal
     */
    function showDashboard() {
        closeDashboard();

        const overview = window.VNPTIntegration ? window.VNPTIntegration.getOverview() : { total: 0 };

        const modal = document.createElement('div');
        modal.id = 'vnpt-dashboard-modal';
        modal.className = 'vnpt-glass-overlay';
        modal.innerHTML = `
            <div class="vnpt-dashboard-content">
                <div class="vnpt-dashboard-header">
                    <h3><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:8px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> Thống kê Hoạt động</h3>
                    <button id="vnpt-dashboard-close">&times;</button>
                </div>
                
                <div class="vnpt-dashboard-body">
                    <div class="vnpt-stats-row">
                        <div class="vnpt-stat-card">
                            <span class="stat-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#004f9e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
                            </span>
                            <div class="stat-info">
                                <span class="stat-value" id="dash-total-patients">${overview.total}</span>
                                <span class="stat-label">Tổng Bệnh Nhân</span>
                            </div>
                        </div>
                        <div class="vnpt-stat-card">
                            <span class="stat-icon">
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#004f9e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 4v16"></path><path d="M2 8h18a2 2 0 0 1 2 2v10"></path><path d="M2 17h20"></path><path d="M6 8v9"></path></svg>
                            </span>
                            <div class="stat-info">
                                <span class="stat-value" id="dash-total-rooms">0</span>
                                <span class="stat-label">Phòng Đã Quét</span>
                            </div>
                        </div>
                    </div>

                    <div class="vnpt-chart-card">
                        <h4>Phân bổ theo Buồng</h4>
                        <div id="vnpt-room-chart-container" class="vnpt-room-stats-list"></div>
                    </div>
                </div>

                <div class="vnpt-dashboard-footer">
                    <button id="vnpt-export-csv" class="aladinn-btn aladinn-btn-primary">Xuất Báo cáo CSV</button>
                    <button class="aladinn-btn aladinn-btn-secondary" onclick="document.getElementById('vnpt-dashboard-modal').remove()">Đóng</button>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        injectDashboardStyles();
        renderRoomStats();

        modal.querySelector('#vnpt-dashboard-close')?.addEventListener('click', closeDashboard);
        modal.querySelector('#vnpt-dashboard-ok')?.addEventListener('click', closeDashboard);
        modal.querySelector('#vnpt-export-csv')?.addEventListener('click', () => {
            if (window.VNPTExport) window.VNPTExport.toCSV();
        });

        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeDashboard();
        });
    }

    let hideMiniTimer = null;

    /**
     * Hiển thị Mini Dashboard khi hover
     * @param {HTMLElement} anchor 
     */
    function showMini(anchor) {
        clearTimeout(hideMiniTimer);
        if (document.getElementById('vnpt-mini-dashboard')) return;

        const rect = anchor.getBoundingClientRect();
        const miniWidth = 240;
        const spacing = 15;

        let leftPos = rect.right + spacing;
        // Smart Positioning: If no space on right, show on left
        if (leftPos + miniWidth > window.innerWidth) {
            leftPos = rect.left - miniWidth - spacing;
        }

        const mini = document.createElement('div');
        mini.id = 'vnpt-mini-dashboard';
        mini.className = 'vnpt-mini-card';
        mini.style.top = `${rect.top}px`;
        mini.style.left = `${leftPos}px`;
        mini.style.width = `${miniWidth}px`;

        mini.innerHTML = `
            <div class="mini-header">
                <span style="color: #004f9e; font-weight: bold; display: flex; align-items: center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#004f9e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:6px;"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg> Mật độ Buồng</span>
                <span class="mini-tag">Live</span>
            </div>
            <div id="vnpt-mini-chart-container" class="vnpt-room-stats-list mini"></div>
        `;

        document.body.appendChild(mini);
        injectDashboardStyles();
        renderRoomStats('vnpt-mini-chart-container');
        
        // Prevent hiding if user moves mouse into the dashboard itself
        mini.addEventListener('mouseenter', () => clearTimeout(hideMiniTimer));
        mini.addEventListener('mouseleave', () => hideMini());
    }

    function hideMini(immediate = false) {
        if (immediate === true) {
            const mini = document.getElementById('vnpt-mini-dashboard');
            if (mini) mini.remove();
            return;
        }

        clearTimeout(hideMiniTimer);
        hideMiniTimer = setTimeout(() => {
            const mini = document.getElementById('vnpt-mini-dashboard');
            if (mini) mini.remove();
        }, 350); // Give user 350ms to move mouse to dashboard
    }

    let currentFilterRoom = null;

    /**
     * Render room statistics
     */
    function renderRoomStats(containerId = 'vnpt-room-chart-container') {
        const container = document.getElementById(containerId);
        if (!container || !window.VNPTStore) return;

        const isMini = containerId.includes('mini');
        const stats = window.VNPTStore.get('roomStatistics') || {};
        const entries = Object.entries(stats).sort((a, b) => b[1] - a[1]);
        const highestCount = entries.length > 0 ? entries[0][1] : 0;

        const totalRoomsEl = document.getElementById('dash-total-rooms');
        if (totalRoomsEl) totalRoomsEl.textContent = entries.length.toString();

        if (entries.length === 0) {
            container.innerHTML = `<div class="empty-stats">${isMini ? 'Chưa có dữ liệu' : 'Chưa có dữ liệu buồng. Hãy chạy "Quét Buồng" trước.'}</div>`;
            return;
        }

        container.innerHTML = entries.map(([name, count]) => {
            const percent = highestCount > 0 ? Math.round((count / highestCount) * 100) : 0;
            const isHighest = count === highestCount && count > 0;
            const safeName = escapeHtml(name);
            const encodedName = encodeURIComponent(name);

            return `
                <div class="vnpt-room-stat-row ${isMini ? 'mini' : ''} ${isHighest ? 'is-lead' : ''}" data-room="${encodedName}" style="cursor: pointer; opacity: ${currentFilterRoom && currentFilterRoom !== name ? '0.4' : '1'};">
                    <div class="room-name" title="${safeName}">
                        ${isHighest ? '<span class="lead-icon"><svg width="12" height="12" viewBox="0 0 24 24" fill="#f0ad4e" stroke="#d58512" stroke-width="1.5" style="vertical-align:middle;"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></span>' : ''}
                        ${safeName}
                    </div>
                    <div class="room-bar-wrapper">
                        <div class="room-bar ${isHighest ? 'highest' : ''}" style="width: ${Math.max(percent, 4)}%">
                            ${isMini && percent > 35 ? `<span class="room-count-inside">${count}</span>` : ''}
                        </div>
                    </div>
                    ${!isMini || percent <= 35 ? `<div class="room-count">${count}</div>` : ''}
                </div>
            `;
        }).join('');

        // Attach click listener for filtering
        container.onclick = (e) => {
            const row = e.target.closest('.vnpt-room-stat-row');
            if (!row) return;
            const roomName = row.dataset.room ? decodeURIComponent(row.dataset.room) : '';
            if (roomName) toggleRoomFilter(roomName);
        };
    }

    function toggleRoomFilter(roomName) {
        const gridSel = (window.VNPTConfig?.selectors?.patientGrid || '#grdBenhNhan') + ' tr.jqgrow';
        const gridRows = document.querySelectorAll(gridSel);

        // Toggle logic
        if (currentFilterRoom === roomName) {
            currentFilterRoom = null;
            // Reset UI
            document.querySelectorAll('.vnpt-room-stat-row').forEach(r => r.style.opacity = '1');
            document.querySelectorAll('.app-quick-filter-chip').forEach(c => {
                c.classList.toggle('active', c.dataset.room === 'ALL');
            });
            gridRows.forEach(tr => tr.classList.remove('aladinn-hidden-row'));
            if (window.VNPTRealtime) window.VNPTRealtime.showToast('Tắt lọc buồng', 'info');
            return;
        }

        currentFilterRoom = roomName;

        // Update Dashboard visual state
        document.querySelectorAll('.vnpt-room-stat-row').forEach(r => {
            const rowRoom = r.dataset.room ? decodeURIComponent(r.dataset.room) : '';
            r.style.opacity = rowRoom === roomName ? '1' : '0.4';
        });

        // Update Grid
        let matchCount = 0;
        gridRows.forEach(tr => {
            if (roomName === 'ALL') {
                tr.classList.remove('aladinn-hidden-row');
                matchCount++;
                return;
            }

            const roomEl = tr.querySelector('.aladinn-scan-room-info-display');
            const rowRoom = roomEl ? roomEl.textContent.trim() : '';

            if (rowRoom === roomName) {
                tr.classList.remove('aladinn-hidden-row');
                matchCount++;
            } else {
                tr.classList.add('aladinn-hidden-row');
            }
        });

        // Sync Quick Filter Chips
        document.querySelectorAll('.app-quick-filter-chip').forEach(c => {
            const chipRoom = c.dataset.room === 'ALL' ? 'ALL' : decodeURIComponent(c.dataset.room || '');
            c.classList.toggle('active', chipRoom === roomName || (roomName === null && c.dataset.room === 'ALL'));
        });

        if (window.VNPTRealtime && roomName !== 'ALL') window.VNPTRealtime.showToast(`🔍 Hiển thị ${matchCount} bệnh nhân Buồng ${roomName}`, 'info');
    }

    /**
     * Injects a quick filter bar above the grid for easy access
     * @param {Object} stats 
     */
    function showQuickFilterBar(stats) {
        if (!stats) stats = window.VNPTStore ? window.VNPTStore.get('roomStatistics') : {};
        const entries = Object.entries(stats || {}).sort((a, b) => b[1] - a[1]);
        
        let bar = document.getElementById('aladinn-quick-filter-bar');
        if (entries.length === 0) {
            if (bar) bar.remove();
            return;
        }

        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'aladinn-quick-filter-bar';
            
            // Wait max 2 seconds for grid wrapper to exist
            const injectInterval = setInterval(() => {
                const gridBox = document.getElementById('gbox_grdBenhNhan');
                if (gridBox && gridBox.parentNode) {
                    clearInterval(injectInterval);
                    gridBox.parentNode.insertBefore(bar, gridBox);
                    renderChips();
                }
            }, 500);
            setTimeout(() => clearInterval(injectInterval), 2000);
        } else {
            renderChips();
        }

        function renderChips() {
            let html = '<div class="filter-title"><span><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#004f9e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle;margin-right:4px;"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg></span> Lọc Buồng: </div>';
            html += '<div class="filter-chips">';
            html += `<button class="app-quick-filter-chip ${currentFilterRoom === null ? 'active' : ''}" data-room="ALL">Tất cả</button>`;
            
            entries.forEach(([name, count]) => {
                html += `<button class="app-quick-filter-chip ${currentFilterRoom === name ? 'active' : ''}" data-room="${encodeURIComponent(name)}">${escapeHtml(name)} <span class="chip-count">${count}</span></button>`;
            });
            html += '</div>';
            
            bar.innerHTML = html;

            bar.querySelectorAll('.app-quick-filter-chip').forEach(btn => {
                btn.onclick = (e) => {
                    const room = e.currentTarget.dataset.room;
                    toggleRoomFilter(room === 'ALL' ? null : decodeURIComponent(room || ''));
                };
            });
        }
    }

    function closeDashboard() {
        hideMini(true);
        const modal = document.getElementById('vnpt-dashboard-modal');
        if (modal) modal.remove();
    }

    function injectDashboardStyles() {
        if (document.getElementById('vnpt-dashboard-css')) return;
        const style = document.createElement('style');
        style.id = 'vnpt-dashboard-css';
        style.textContent = `
            :root {
                --vnpt-primary: #004f9e;
                --vnpt-border: #a6c9e2;
                --vnpt-radius: 0px;
                --mini-bg: #ffffff;
                --mini-border: #a6c9e2;
                --mini-shadow: 1px 2px 8px rgba(0, 0, 0, 0.15);
            }

            .vnpt-glass-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(0, 0, 0, 0.5);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                animation: vnpt-fade-in 0.15s forwards;
            }
            .vnpt-dashboard-content {
                background: #ffffff; 
                border: 1px solid var(--vnpt-primary); 
                border-radius: 0px !important; 
                width: 440px; 
                max-width: 90%; 
                padding: 0px; 
                box-shadow: 0 5px 15px rgba(0,0,0,0.5);
                font-family: "Segoe UI", Arial, sans-serif;
            }
            .vnpt-dashboard-header { 
                display: flex; 
                justify-content: space-between; 
                align-items: center; 
                background: var(--vnpt-primary); 
                color: #ffffff; 
                padding: 10px 15px; 
                border-radius: 0px !important;
            }
            .vnpt-dashboard-header h3 { 
                margin: 0; 
                font-size: 15px; 
                color: #ffffff; 
                font-weight: bold; 
                display: flex; 
                align-items: center;
            }
            #vnpt-dashboard-close { 
                background: none; 
                border: none; 
                font-size: 20px; 
                cursor: pointer; 
                color: #ffffff; 
                opacity: 0.8; 
                transition: opacity 0.1s; 
                padding: 0; 
                line-height: 1; 
            }
            #vnpt-dashboard-close:hover { 
                opacity: 1; 
            }

            .vnpt-dashboard-body {
                padding: 15px;
                display: flex;
                flex-direction: column;
                gap: 15px;
            }

            .vnpt-stats-row { 
                display: grid; 
                grid-template-columns: 1fr 1fr; 
                gap: 15px; 
            }
            .vnpt-chart-card { 
                background: #ffffff; 
                border: 1px solid #dddddd; 
                border-radius: 0px !important; 
                padding: 15px; 
                min-height: 180px; 
            }
            .vnpt-chart-card h4 { 
                margin: 0 0 12px 0; 
                font-size: 13px; 
                font-weight: bold; 
                color: #333333; 
                border-bottom: 1px solid #eeeeee; 
                padding-bottom: 8px; 
            }

            .vnpt-room-stats-list { 
                width: 100%; 
                max-height: 200px; 
                overflow-y: auto; 
                padding-right: 6px; 
            }
            .vnpt-room-stats-list::-webkit-scrollbar { 
                width: 6px; 
            }
            .vnpt-room-stats-list::-webkit-scrollbar-thumb { 
                background: var(--vnpt-border); 
                border-radius: 0px !important; 
            }

            .vnpt-room-stat-row { 
                display: flex; 
                align-items: center; 
                gap: 12px; 
                margin-bottom: 10px; 
                transition: background 0.1s; 
            }
            .vnpt-room-stat-row:hover { 
                background: rgba(0, 79, 158, 0.04); 
            }
            .vnpt-room-stat-row .room-name { 
                width: 80px; 
                font-weight: bold; 
                font-size: 13px; 
                color: #333333; 
                display: flex; 
                align-items: center; 
                gap: 4px; 
                position: relative; 
            }
            .vnpt-room-stat-row .room-bar-wrapper { 
                flex: 1; 
                height: 16px; 
                background: #eeeeee; 
                border-radius: 0px !important; 
                overflow: hidden; 
                border: 1px solid #dddddd;
            }
            .vnpt-room-stat-row .room-bar { 
                height: 100%; 
                background: #337ab7; 
                border-radius: 0px !important; 
                transition: width 0.4s ease; 
            }
            .vnpt-room-stat-row .room-bar.highest { 
                background: #f0ad4e; 
            }
            .vnpt-room-stat-row .room-count { 
                width: 36px; 
                font-weight: bold; 
                text-align: right; 
                color: var(--vnpt-primary); 
                font-size: 13px; 
            }

            .vnpt-stats-column { display: flex; flex-direction: column; gap: 12px; }
            .vnpt-stat-card { 
                background: #f8f9fa; 
                border: 1px solid #dddddd; 
                border-radius: 0px !important; 
                padding: 12px; 
                display: flex; 
                align-items: center; 
                gap: 12px; 
                transition: all 0.1s; 
            }
            .vnpt-stat-card:hover { 
                border-color: var(--vnpt-border); 
                background: #f1f3f5; 
            }
            .stat-icon { 
                width: 36px; 
                height: 36px; 
                background: rgba(0, 79, 158, 0.08); 
                border-radius: 0px !important; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                color: var(--vnpt-primary); 
            }
            .stat-info { display: flex; flex-direction: column; }
            .stat-value { font-size: 20px; font-weight: 800; color: var(--vnpt-primary); line-height: 1.2; }
            .stat-label { font-size: 12px; color: #555555; font-weight: 600; }

            .vnpt-dashboard-footer { 
                background: #f5f5f5; 
                border-top: 1px solid #e5e5e5; 
                padding: 12px 15px; 
                display: flex; 
                gap: 10px; 
                justify-content: flex-end; 
                border-radius: 0px !important;
            }
            .aladinn-btn { 
                padding: 6px 14px; 
                border-radius: 0px !important; 
                font-size: 12px; 
                font-weight: 600; 
                cursor: pointer; 
                border: 1px solid transparent; 
                transition: background 0.1s; 
            }
            .aladinn-btn-primary { background: var(--vnpt-primary); color: #ffffff; border: 1px solid var(--vnpt-primary); }
            .aladinn-btn-primary:hover { background: #003d7a; border-color: #003d7a; }
            .aladinn-btn-secondary { background: #ffffff; border: 1px solid #ccc; color: #333333; }
            .aladinn-btn-secondary:hover { background: #e6e6e6; border-color: #adadad; }

            /* Mini Card Styles (Flat Light HIS) */
            .vnpt-mini-card {
                position: fixed;
                background: #ffffff;
                border: 1px solid var(--vnpt-border);
                border-radius: 0px !important;
                box-shadow: var(--mini-shadow);
                padding: 16px;
                z-index: 100001;
                pointer-events: none;
                animation: vnpt-pop-in 0.2s ease-out;
                font-family: "Segoe UI", Arial, sans-serif;
            }
            .mini-header {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 15px; font-size: 14px; font-weight: 800; color: var(--vnpt-primary);
            }
            .mini-tag {
                background: #fdedec; border: 1px solid #dc3545; color: #dc3545; padding: 2px 6px; border-radius: 0px !important; font-size: 10px;
                text-transform: uppercase; font-weight: bold;
            }
            .vnpt-room-stat-row.mini { margin-bottom: 8px; }
            .vnpt-room-stat-row.mini .room-name { width: 54px; font-size: 12px; color: #333333;}
            .vnpt-room-stat-row.mini .room-bar-wrapper { height: 16px; background: #eeeeee; border: 1px solid #dddddd; }
            .vnpt-room-stat-row.mini .room-bar { display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; }
            .room-count-inside { color: #ffffff; font-weight: 900; font-size: 11px; }
            .lead-icon { 
                position: absolute; 
                left: -16px; 
                top: 50%; 
                transform: translateY(-50%); 
                display: flex; 
                align-items: center; 
            }
            .empty-stats { color: #777777; font-size: 12px; text-align: center; padding: 20px 0; font-style: italic; }
            .aladinn-hidden-row { display: none !important; }

            /* Quick Filter Bar Styles (Light Flat HIS) */
            #aladinn-quick-filter-bar {
                display: flex; align-items: center; gap: 16px; padding: 12px 16px;
                background: #f8f9fa; border: 1px solid var(--vnpt-border);
                border-radius: 0px !important; margin-bottom: 12px;
                box-shadow: 1px 1px 3px rgba(0,0,0,0.05);
                animation: vnpt-fade-in 0.3s ease;
                font-family: "Segoe UI", Arial, sans-serif;
            }
            #aladinn-quick-filter-bar .filter-title {
                font-weight: 800; color: var(--vnpt-primary); font-size: 14px;
                display: flex; align-items: center; white-space: nowrap;
            }
            #aladinn-quick-filter-bar .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; }
            .app-quick-filter-chip {
                background: #eeeeee; border: 1px solid #dddddd; color: #333333;
                padding: 5px 12px; border-radius: 0px !important; font-size: 12px; font-weight: 600; cursor: pointer;
                transition: all 0.1s; display: flex; align-items: center; gap: 6px;
            }
            .app-quick-filter-chip:hover {
                background: #dddddd; border-color: var(--vnpt-border); transform: none;
            }
            .app-quick-filter-chip.active {
                background: var(--vnpt-primary); border-color: var(--vnpt-primary); color: #ffffff; box-shadow: none;
            }
            .app-quick-filter-chip .chip-count {
                background: rgba(0,0,0,0.08); padding: 1px 5px; border-radius: 0px !important; font-size: 11px; color: #555555; font-weight: 800;
            }
            .app-quick-filter-chip.active .chip-count {
                background: rgba(255,255,255,0.2); color: #ffffff;
            }

            @keyframes vnpt-pop-in { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes vnpt-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; box-shadow: 0 0 8px rgba(255, 180, 171, 0.5); } }
            @keyframes vnpt-fade-in { from { opacity: 0; } to { opacity: 1; } }
        `;
        document.head.appendChild(style);
    }

    return {
        show: showDashboard,
        showMini,
        hideMini,
        renderRoomStats,
        showQuickFilterBar,
        forceSyncFilterState: toggleRoomFilter
    };
})();

window.VNPTDashboard = VNPTDashboard;
