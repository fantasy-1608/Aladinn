/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Menu Manager (UI Orchestrator)
 * 
 * Handles native menu injection and floating UI logic.
 */

const VNPTMenuManager = (function () {

    /**
     * Inject native menu into VNPT HIS top navigation
     */
    function injectNativeMenu(/** @type {any} */ callbacks) {
        if (window.self !== window.top) return false;

        const candidates = document.querySelectorAll('ul, div.navbar-nav, div.nav');
        let targetContainer = null;

        for (const c of candidates) {
            if (c.textContent.includes('Nội trú') || c.textContent.includes('Ngoại trú')) {
                targetContainer = c;
                break;
            }
        }

        if (!targetContainer) {
            targetContainer = document.querySelector('#main-menu ul');
        }

        if (!targetContainer) return false;
        if (targetContainer.querySelector('.vnpt-native-menu-item')) return true;

        const li = document.createElement('li');
        li.className = 'vnpt-native-menu-item';
        li.innerHTML = `
            <span>⚡ Tiện ích</span>
            <span id="vnpt-progress-badge" style="
                display: none;
                margin-left: 6px;
                background: linear-gradient(135deg, #f39c12, #e74c3c);
                color: white;
                padding: 2px 8px;
                border-radius: 10px;
                font-size: 11px;
                font-weight: bold;
                animation: vnpt-pulse 1s infinite;
            ">0%</span>
            <i class="vnpt-native-arrow">▼</i>
            
            <div class="vnpt-native-dropdown">
                <a class="vnpt-native-action" id="native-scan-room">
                    <span style="font-size:16px;margin-right:6px;vertical-align:middle">🏥</span> Quét Buồng
                </a>
                <a class="vnpt-native-action" id="native-scan-vitals">
                    <span style="font-size:16px;margin-right:6px;vertical-align:middle">❤️</span> Quét Vitals
                </a>
                <a class="vnpt-native-action" id="native-scan-drugs">
                    <span style="font-size:16px;margin-right:6px;vertical-align:middle">💊</span> Quét Thuốc
                </a>
                <a class="vnpt-native-action" id="native-scan-labs">
                    <span style="font-size:16px;margin-right:6px;vertical-align:middle">🔬</span> Quét Xét Nghiệm
                </a>
                <a class="vnpt-native-action" id="native-stop-scan" style="display:none;">
                    <span style="font-size:16px;margin-right:6px;vertical-align:middle">🛑</span> Dừng Quét
                </a>

                <div class="vnpt-dropdown-divider"></div>
                <a class="vnpt-native-action" id="native-show-settings">
                    <span style="font-size:16px;margin-right:6px;vertical-align:middle">⚙️</span> Cài đặt
                </a>
                <a class="vnpt-native-action" id="native-show-dashboard">
                    <span style="font-size:16px;margin-right:6px;vertical-align:middle">📊</span> Thống kê
                </a>

                <div class="vnpt-dropdown-divider"></div>
                <a class="vnpt-native-action" id="native-clear-cache">
                    <span style="font-size:16px;margin-right:6px;vertical-align:middle">🗑️</span> Xóa Cache
                </a>
            </div>
        `;

        targetContainer.appendChild(li);

        // Bind Events
        setTimeout(() => {
            const scanRoom = document.getElementById('native-scan-room');
            const scanVitals = document.getElementById('native-scan-vitals');
            const scanDrugs = document.getElementById('native-scan-drugs');
            const scanLabs = document.getElementById('native-scan-labs');
            const stopScan = document.getElementById('native-stop-scan');
            const showDashboard = document.getElementById('native-show-dashboard');
            const showSettings = document.getElementById('native-show-settings');
            const clearCache = document.getElementById('native-clear-cache');

            if (scanRoom && callbacks.onScanRoom) {
                scanRoom.onclick = (e) => { e.stopPropagation(); callbacks.onScanRoom(); };

                // Add Hover events for Mini-Dashboard
                scanRoom.onmouseenter = () => {
                    if (callbacks.onHoverScanRoom) callbacks.onHoverScanRoom(scanRoom);
                };
                scanRoom.onmouseleave = () => {
                    if (callbacks.onLeaveScanRoom) callbacks.onLeaveScanRoom();
                };
            }
            if (scanVitals && callbacks.onScanVitals) scanVitals.onclick = (e) => { e.stopPropagation(); callbacks.onScanVitals(); };
            if (scanDrugs && callbacks.onScanDrugs) scanDrugs.onclick = (e) => { e.stopPropagation(); callbacks.onScanDrugs(); };
            if (scanLabs && callbacks.onScanLabs) scanLabs.onclick = (e) => { e.stopPropagation(); callbacks.onScanLabs(); };
            
            if (stopScan && callbacks.onStopScan) stopScan.onclick = (e) => { e.stopPropagation(); callbacks.onStopScan(); };
            if (showDashboard && callbacks.onShowDashboard) showDashboard.onclick = (e) => { e.stopPropagation(); callbacks.onShowDashboard(); };
            if (showSettings && callbacks.onShowSettings) showSettings.onclick = (e) => { e.stopPropagation(); callbacks.onShowSettings(); };
            if (clearCache && callbacks.onClearCache) clearCache.onclick = (e) => { e.stopPropagation(); callbacks.onClearCache(); };
        }, 100);

        return true;
    }

    /**
     * Update progress badge in native menu
     */
    function updateProgress(/** @type {number} */ percent, isComplete = false) {
        const badge = document.getElementById('vnpt-progress-badge');
        if (!badge) return;

        if (isComplete) {
            badge.textContent = '✓';
            setTimeout(() => { badge.style.display = 'none'; }, 2000);
        } else {
            badge.style.display = 'inline';
            badge.textContent = `${percent}%`;
        }
    }

    /**
     * Show/Hide stop button
     */
    function toggleStopButton(/** @type {boolean} */ show) {
        const stopBtn = document.getElementById('native-stop-scan');
        if (stopBtn) stopBtn.style.display = show ? 'block' : 'none';
    }

    return {
        injectNativeMenu,
        updateProgress,
        toggleStopButton
    };
})();

window.VNPTMenuManager = VNPTMenuManager;
