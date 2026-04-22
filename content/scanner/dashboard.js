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
                    <h3><img src="${chrome.runtime.getURL('assets/icons/icon128.png')}" style="width:20px;height:20px;vertical-align:middle;margin-right:8px; filter: drop-shadow(0 0 2px rgba(255,215,0,0.8));"> Thống kê Hoạt động</h3>
                    <button id="vnpt-dashboard-close">&times;</button>
                </div>
                
                <div class="vnpt-stats-row">
                    <div class="vnpt-stat-card">
                        <span class="stat-icon" style="font-size:18px;">👥</span>
                        <div class="stat-info">
                            <span class="stat-value" id="dash-total-patients">${overview.total}</span>
                            <span class="stat-label">Tổng Bệnh Nhân</span>
                        </div>
                    </div>
                    <div class="vnpt-stat-card">
                        <span class="stat-icon" style="font-size:18px;">🛏️</span>
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
                <span style="color: #ffd700; text-shadow: 0 0 8px rgba(255,215,0,0.4);"><img src="${chrome.runtime.getURL('assets/icons/icon128.png')}" style="width:16px;height:16px;vertical-align:middle;margin-right:6px; filter: drop-shadow(0 0 2px rgba(255,215,0,0.8));"> Mật độ Buồng</span>
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

            return `
                <div class="vnpt-room-stat-row ${isMini ? 'mini' : ''} ${isHighest ? 'is-lead' : ''}" data-room="${safeName}" style="cursor: pointer; opacity: ${currentFilterRoom && currentFilterRoom !== safeName ? '0.4' : '1'};">
                    <div class="room-name" title="${safeName}">
                        ${isHighest ? '<span class="lead-icon">👑</span>' : ''}
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
            const roomName = row.dataset.room;
            if (roomName) toggleRoomFilter(roomName);
        };
    }

    function toggleRoomFilter(roomName) {
        const gridRows = document.querySelectorAll('#grdBenhNhan tr.jqgrow');
        if (!gridRows || gridRows.length === 0) return;

        // Toggle logic
        if (currentFilterRoom === roomName) {
            currentFilterRoom = null;
            // Reset UI
            document.querySelectorAll('.vnpt-room-stat-row').forEach(r => r.style.opacity = '1');
            gridRows.forEach(tr => tr.classList.remove('aladinn-hidden-row'));
            if (window.VNPTRealtime) window.VNPTRealtime.showToast('Tắt lọc buồng', 'info');
            return;
        }

        currentFilterRoom = roomName;

        // Update Dashboard visual state
        document.querySelectorAll('.vnpt-room-stat-row').forEach(r => {
            r.style.opacity = r.dataset.room === roomName ? '1' : '0.4';
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
            c.classList.toggle('active', c.dataset.room === roomName || (roomName === null && c.dataset.room === 'ALL'));
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
            let html = `<div class="filter-title"><span><img src="${chrome.runtime.getURL('assets/icons/icon128.png')}" style="width:16px;height:16px;vertical-align:middle;margin-right:4px;"></span> Lọc Buồng: </div>`;
            html += '<div class="filter-chips">';
            html += `<button class="app-quick-filter-chip ${currentFilterRoom === null ? 'active' : ''}" data-room="ALL">✨ Tất cả</button>`;
            
            entries.forEach(([name, count]) => {
                html += `<button class="app-quick-filter-chip ${currentFilterRoom === name ? 'active' : ''}" data-room="${name}">${name} <span class="chip-count">${count}</span></button>`;
            });
            html += '</div>';
            
            bar.innerHTML = html;

            bar.querySelectorAll('.app-quick-filter-chip').forEach(btn => {
                btn.onclick = (e) => {
                    const room = e.currentTarget.dataset.room;
                    toggleRoomFilter(room === 'ALL' ? currentFilterRoom : room);
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
                --mini-bg: rgba(26, 11, 46, 0.85);
                --mini-border: rgba(255, 215, 0, 0.3);
                --mini-shadow: 0 8px 32px 0 rgba(0, 0, 0, 0.6), inset 0 0 15px rgba(0, 240, 255, 0.1);
            }

            .vnpt-glass-overlay {
                position: fixed;
                top: 0; left: 0; right: 0; bottom: 0;
                background: rgba(15, 23, 42, 0.4);
                backdrop-filter: blur(4px);
                z-index: 100000;
                display: flex;
                align-items: center;
                justify-content: center;
                opacity: 0;
                animation: vnpt-fade-in 0.2s forwards;
            }
            .vnpt-dashboard-content {
                background: linear-gradient(145deg, #1a0b2e, #0f172a); border: 1px solid var(--mini-border); border-radius: 20px; width: 440px; max-width: 90%; padding: 24px; box-shadow: var(--mini-shadow);
            }
            .vnpt-dashboard-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
            .vnpt-dashboard-header h3 { margin: 0; font-size: 18px; color: #ffd700; font-weight: 800; text-shadow: 0 0 10px rgba(255,215,0,0.3); display: flex; align-items: center;}
            #vnpt-dashboard-close { background: none; border: none; font-size: 24px; cursor: pointer; color: #94a3b8; transition: color 0.2s; padding: 0; line-height: 1; }
            #vnpt-dashboard-close:hover { color: #00f0ff; text-shadow: 0 0 8px #00f0ff; }

            .vnpt-stats-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
            .vnpt-chart-card { background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 16px; padding: 16px; min-height: 180px; }
            .vnpt-chart-card h4 { margin: 0 0 12px 0; font-size: 13px; font-weight: 700; color: #d0e0ff; }

            .vnpt-room-stats-list { width: 100%; max-height: 200px; overflow-y: auto; padding-right: 6px; }
            .vnpt-room-stats-list::-webkit-scrollbar { width: 4px; }
            .vnpt-room-stats-list::-webkit-scrollbar-thumb { background: rgba(0, 240, 255, 0.3); border-radius: 4px; }

            .vnpt-room-stat-row { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; transition: transform 0.2s; }
            .vnpt-room-stat-row:hover { transform: translateX(4px); }
            .vnpt-room-stat-row .room-name { width: 60px; font-weight: 700; font-size: 12px; color: #d0e0ff; display: flex; align-items: center; gap: 4px; }
            .vnpt-room-stat-row .room-bar-wrapper { flex: 1; height: 12px; background: rgba(255, 255, 255, 0.05); border-radius: 6px; overflow: hidden; border: 1px solid rgba(255,255,255,0.02);}
            .vnpt-room-stat-row .room-bar { height: 100%; background: linear-gradient(90deg, #00f0ff, #0284c7); border-radius: 6px; transition: width 0.6s cubic-bezier(0.34, 1.56, 0.64, 1); box-shadow: 0 0 10px rgba(0, 240, 255, 0.5); }
            .vnpt-room-stat-row .room-bar.highest { background: linear-gradient(90deg, #ffd700, #f59e0b); box-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
            .vnpt-room-stat-row .room-count { width: 30px; font-weight: 800; text-align: right; color: #00f0ff; font-size: 12px; text-shadow: 0 0 5px rgba(0, 240, 255, 0.3); }

            .vnpt-stats-column { display: flex; flex-direction: column; gap: 12px; }
            .vnpt-stat-card { background: rgba(0, 0, 0, 0.3); border: 1px solid rgba(255,255,255,0.05); border-radius: 12px; padding: 12px; display: flex; align-items: center; gap: 12px; transition: all 0.2s; }
            .vnpt-stat-card:hover { border-color: rgba(0, 240, 255, 0.3); box-shadow: 0 4px 12px rgba(0, 240, 255, 0.1); transform: translateY(-2px); }
            .stat-icon { width: 36px; height: 36px; background: rgba(0, 240, 255, 0.1); border-radius: 10px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 0 5px rgba(0, 240, 255, 0.3));}
            .stat-info { display: flex; flex-direction: column; }
            .stat-value { font-size: 18px; font-weight: 800; color: #00f0ff; line-height: 1.2; text-shadow: 0 0 10px rgba(0,240,255,0.3); }
            .stat-label { font-size: 11px; color: #d0e0ff; font-weight: 600; opacity: 0.8;}

            .vnpt-dashboard-footer { margin-top: 16px; display: flex; gap: 10px; justify-content: flex-end; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 16px; }
            .aladinn-btn { padding: 8px 16px; border-radius: 8px; font-size: 13px; font-weight: 700; cursor: pointer; border: none; transition: all 0.2s; }
            .aladinn-btn-primary { background: linear-gradient(90deg, #00f0ff, #0284c7); color: #1a0b2e; box-shadow: 0 0 10px rgba(0, 240, 255, 0.3); }
            .aladinn-btn-primary:hover { box-shadow: 0 0 15px rgba(0, 240, 255, 0.6); transform: scale(1.02); }
            .aladinn-btn-secondary { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.2); color: #d0e0ff; }
            .aladinn-btn-secondary:hover { background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.4); }

            /* Mini Card Styles (Glassmorphism) */
            .vnpt-mini-card {
                position: fixed;
                background: var(--mini-bg);
                backdrop-filter: blur(16px);
                -webkit-backdrop-filter: blur(16px);
                border: 1px solid var(--mini-border);
                border-radius: 16px;
                box-shadow: var(--mini-shadow);
                padding: 16px;
                z-index: 100001;
                pointer-events: none;
                animation: vnpt-pop-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
            }
            .mini-header {
                display: flex; justify-content: space-between; align-items: center;
                margin-bottom: 15px; font-size: 13px; font-weight: 800; color: #ffd700;
            }
            .mini-tag {
                background: rgba(239, 68, 68, 0.2); border: 1px solid #ef4444; color: #ff6b6b; padding: 2px 6px; border-radius: 4px; font-size: 9px;
                text-transform: uppercase; animation: vnpt-blink 1.5s infinite; text-shadow: 0 0 5px rgba(239, 68, 68, 0.5);
            }
            .vnpt-room-stat-row.mini { margin-bottom: 8px; }
            .vnpt-room-stat-row.mini .room-name { width: 45px; font-size: 10px; color: #d0e0ff;}
            .vnpt-room-stat-row.mini .room-bar-wrapper { height: 16px; background: rgba(255,255,255,0.05); }
            .vnpt-room-stat-row.mini .room-bar { display: flex; align-items: center; justify-content: flex-end; padding-right: 6px; }
            .room-count-inside { color: #1a0b2e; font-weight: 900; font-size: 10px; text-shadow: none; }
            .lead-icon { font-size: 12px; position: absolute; left: -14px; filter: drop-shadow(0 0 2px rgba(255,215,0,0.8)); }
            .empty-stats { color: #d0e0ff; font-size: 11px; text-align: center; padding: 20px 0; font-style: italic; opacity: 0.7; }
            .aladinn-hidden-row { display: none !important; }

            /* Quick Filter Bar Styles */
            #aladinn-quick-filter-bar {
                display: flex; align-items: center; gap: 16px; padding: 12px 16px;
                background: linear-gradient(90deg, #1a0b2e, #0f172a); border: 1px solid rgba(0, 240, 255, 0.3);
                border-radius: 8px; margin-bottom: 12px;
                box-shadow: 0 4px 15px rgba(0,0,0,0.2), inset 0 0 10px rgba(0, 240, 255, 0.05);
                animation: vnpt-fade-in 0.4s ease;
            }
            #aladinn-quick-filter-bar .filter-title {
                font-weight: 800; color: #ffd700; font-size: 13px; text-shadow: 0 0 5px rgba(255, 215, 0, 0.4);
                display: flex; align-items: center; white-space: nowrap;
            }
            #aladinn-quick-filter-bar .filter-chips { display: flex; gap: 8px; flex-wrap: wrap; }
            .app-quick-filter-chip {
                background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); color: #d0e0ff;
                padding: 6px 14px; border-radius: 12px; font-size: 12px; font-weight: 700; cursor: pointer;
                transition: all 0.2s; display: flex; align-items: center; gap: 6px;
            }
            .app-quick-filter-chip:hover {
                background: rgba(255, 255, 255, 0.1); border-color: rgba(0, 240, 255, 0.3); transform: translateY(-1px);
            }
            .app-quick-filter-chip.active {
                background: rgba(0, 240, 255, 0.2); border-color: #00f0ff; color: #00f0ff; box-shadow: 0 0 10px rgba(0, 240, 255, 0.3);
            }
            .app-quick-filter-chip .chip-count {
                background: rgba(0,0,0,0.4); padding: 1px 6px; border-radius: 8px; font-size: 11px; color: #ffd700; font-weight: 800;
            }

            @keyframes vnpt-pop-in { from { opacity: 0; transform: scale(0.9) translateY(10px); } to { opacity: 1; transform: scale(1) translateY(0); } }
            @keyframes vnpt-blink { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; box-shadow: 0 0 8px rgba(239, 68, 68, 0.5); } }
            @keyframes vnpt-fade-in { from { opacity: 0; } to { opacity: 1; } }

            .vnpt-dark-mode .vnpt-dashboard-content { background: #0f172a; border: 1px solid #1e293b; }
            .vnpt-dark-mode .vnpt-chart-card { background: #1e293b; }
            .vnpt-dark-mode .vnpt-stat-card { background: #1e293b; border-color: #334155; }
            .vnpt-dark-mode .stat-value { color: #f8fafc; }
            .vnpt-dark-mode .stat-icon { background: #0f172a; }
            .vnpt-dark-mode .room-name { color: #e2e8f0; }
            .vnpt-dark-mode .vnpt-mini-card { 
                --mini-bg: rgba(15, 23, 42, 0.85); 
                --mini-border: rgba(255, 255, 255, 0.1); 
                color: #f8fafc; 
            }
            .vnpt-dark-mode .mini-header { color: #f8fafc; }
            .vnpt-dark-mode .vnpt-room-stat-row.mini .room-bar-wrapper { background: rgba(255,255,255,0.05); }
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
