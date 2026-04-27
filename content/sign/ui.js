/**
 * 🧞 Aladinn — Sign Module: UI Management
 * Workflow panel, toasts, HUD, progress display
 * Ported from SignHis v4.1.0
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.UI = (function () {
    'use strict';

    const _Logger = window.Aladinn?.Logger;
    let hudElement = null;
    let toastContainer = null;

    /**
     * Hiển thị hiệu ứng click ripple
     */
    function createClickRipple(element) {
        try {
            if (!element) return;
            const rect = element.getBoundingClientRect();
            let x = rect.left + rect.width / 2;
            let y = rect.top + rect.height / 2;

            const elDoc = element.ownerDocument;
            if (elDoc !== document) {
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        if (iframe.contentDocument === elDoc || iframe.contentWindow.document === elDoc) {
                            const iframeRect = iframe.getBoundingClientRect();
                            x += iframeRect.left;
                            y += iframeRect.top;
                            break;
                        }
                    } catch (err) { console.warn('[Aladinn/Sign] Storage error in UI:', err); }
                }
            }

            const ripple = document.createElement('div');
            ripple.className = 'his-click-ripple';
            ripple.style.left = x + 'px';
            ripple.style.top = y + 'px';
            document.body.appendChild(ripple);
            ripple.addEventListener('animationend', () => ripple.remove());
        } catch (e) {
            console.warn('[Aladinn Sign UI] Click ripple failed:', e);
        }
    }

    /**
     * Hiển thị HUD khi đang dò tìm kho báu
     */
    function showSigningHUD() {
        try {
            if (hudElement) return;
            hudElement = document.createElement('div');
            hudElement.className = 'his-signing-hud';
            hudElement.innerHTML = `
                <div class="his-hud-scanner"></div>
                <div class="his-hud-label">
                    <div class="his-hud-lamp">🪔</div>
                    <div class="his-hud-dot"></div>
                    <span>Aladinn đang dò tìm kho báu...</span>
                    <div class="his-hud-sparkles">
                        <div class="his-sparkle"></div>
                        <div class="his-sparkle"></div>
                        <div class="his-sparkle"></div>
                    </div>
                    <div class="his-hud-scanline"></div>
                </div>
            `;
            document.body.appendChild(hudElement);
            void hudElement.offsetWidth;
            hudElement.classList.add('visible');
        } catch (e) {
            console.warn('[Aladinn Sign UI] Show HUD failed:', e);
        }
    }

    function hideSigningHUD() {
        if (!hudElement) return;
        hudElement.classList.remove('visible');
        setTimeout(() => {
            if (hudElement) { hudElement.remove(); hudElement = null; }
        }, 500);
    }

    /**
     * Show a modern toast notification - appears above panel like smoke
     */
    function showToast(message, duration = 3000) {
        // Attach toast container inside the panel so it positions above it
        if (!toastContainer) {
            toastContainer = document.createElement('div');
            toastContainer.id = 'his-toast-container';
            toastContainer.className = 'his-toast-container';

            const panel = document.getElementById('his-workflow-panel');
            if (panel) {
                panel.appendChild(toastContainer);
            } else {
                // Fallback: attach to body if panel not available yet
                document.body.appendChild(toastContainer);
            }
        }

        let type = 'info';
        let icon = 'ℹ️';

        if (message.includes('✅') || message.includes('✓') || message.includes('🎉')) {
            type = 'success'; icon = '✓';
        } else if (message.includes('⚠️') || message.includes('⏭️') || message.includes('⏩')) {
            type = 'warning'; icon = '!';
        } else if (message.includes('❌') || message.includes('🛑')) {
            type = 'error'; icon = '✕';
        } else if (message.includes('🖊️') || message.includes('📝') || message.includes('🔔')) {
            type = 'info'; icon = '→';
        }

        const cleanMessage = message.replace(/^[^\p{L}\p{N}\s]+ /u, '').trim();

        const toast = document.createElement('div');
        toast.className = 'his-toast';
        toast.style.setProperty('--toast-duration', `${duration}ms`);

        const iconDiv = document.createElement('div');
        iconDiv.className = `his-toast-icon ${type}`;
        iconDiv.textContent = icon;

        const contentDiv = document.createElement('div');
        contentDiv.className = 'his-toast-content';
        const msgSpan = document.createElement('span');
        msgSpan.className = 'his-toast-message';
        msgSpan.textContent = cleanMessage;
        contentDiv.appendChild(msgSpan);

        const progressDiv = document.createElement('div');
        progressDiv.className = 'his-toast-progress';
        const barDiv = document.createElement('div');
        barDiv.className = 'his-toast-progress-bar';
        progressDiv.appendChild(barDiv);

        toast.appendChild(iconDiv);
        toast.appendChild(contentDiv);
        toast.appendChild(progressDiv);

        toastContainer.insertBefore(toast, toastContainer.firstChild);

        // Keep max 2 toasts visible to avoid clutter above panel
        const allToasts = toastContainer.querySelectorAll('.his-toast:not(.toast-exit)');
        if (allToasts.length > 2) {
            const oldest = allToasts[allToasts.length - 1];
            oldest.classList.add('toast-exit');
            setTimeout(() => oldest.remove(), 800);
        }

        setTimeout(() => {
            toast.classList.add('toast-exit');
            setTimeout(() => toast.remove(), 800);
        }, duration);
    }

    /**
     * Create/Inject the Workflow Controls Panel
     */
    function injectWorkflowControls(callbacks) {
        const { onStart, onNext, onSkip, onStop, onRefresh } = callbacks;

        if (document.getElementById('his-workflow-panel')) return;

        const panel = document.createElement('div');
        panel.id = 'his-workflow-panel';
        panel.className = 'his-workflow-panel';
        panel.style.display = 'none';

        panel.innerHTML = `
            <div class="his-panel-header">
                <div class="his-header-left">
                    <svg class="his-icon-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83"/></svg>
                    <span class="his-panel-title">Quy trình Ký số</span>
                </div>
                <div class="his-queue-badge">
                    <span id="his-queue-status">0/0</span>
                </div>
            </div>
            <div class="his-panel-body">
                <div id="his-start-view">
                    <div class="his-input-group">
                        <label class="his-label">Tự động điền Người tạo:</label>
                        <div class="his-input-wrapper">
                            <svg class="his-input-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                            <input type="text" id="his-creator-filter" class="his-input" placeholder="Nhập tên (VD: trung anh)...">
                        </div>
                    </div>
                    <p class="his-hint-text">Chọn các bệnh nhân cần ký trong danh sách, sau đó nhấn nút phía dưới để bắt đầu.</p>
                    <button id="his-btn-start" class="his-btn his-btn-primary" disabled>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
                        <span>Bắt đầu Ký số</span>
                    </button>
                    <div class="his-footer-actions">
                        <div id="his-refresh-ui" class="his-refresh-link">
                            <svg class="his-icon-refresh" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M23 4v6h-6M1 20v-6h6M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
                            Làm mới danh sách
                        </div>
                    </div>
                </div>

                <div id="his-process-view" style="display: none;">
                    <div class="his-patient-card">
                        <div class="his-card-glow"></div>
                        <div class="his-card-content">
                            <span class="his-card-label">Đang xử lý:</span>
                            <div id="his-current-patient" class="his-card-value">---</div>
                        </div>
                    </div>
                    <div class="his-progress-section">
                        <div class="his-progress-header">
                            <span class="his-label">Tiến độ hoàn thành</span>
                            <span id="his-progress-percent" class="his-percent-badge">0%</span>
                        </div>
                        <div class="his-progress-container">
                            <div id="his-progress-bar" class="his-progress-bar"></div>
                        </div>
                    </div>
                    <div class="his-stats-grid">
                        <div class="his-stat-item">
                            <div class="his-stat-icon success">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            </div>
                            <div class="his-stat-info">
                                <span class="his-stat-label">Đã ký</span>
                                <strong id="his-stat-done" class="his-stat-count">0</strong>
                            </div>
                        </div>
                        <div class="his-stat-item">
                            <div class="his-stat-icon skip">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </div>
                            <div class="his-stat-info">
                                <span class="his-stat-label">Bỏ qua</span>
                                <strong id="his-stat-skip" class="his-stat-count">0</strong>
                            </div>
                        </div>
                        <div class="his-stat-item">
                            <div class="his-stat-icon remain">
                                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                            </div>
                            <div class="his-stat-info">
                                <span class="his-stat-label">Còn lại</span>
                                <strong id="his-stat-remain" class="his-stat-count">0</strong>
                            </div>
                        </div>
                    </div>
                    <div class="his-action-group">
                        <button id="his-btn-next" class="his-btn his-btn-success">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                            <span>Đã ký xong</span>
                        </button>
                        <button id="his-btn-skip" class="his-btn his-btn-secondary">
                            <span>Tiếp theo</span>
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                        </button>
                    </div>
                    <button id="his-btn-stop" class="his-btn his-btn-danger-outline">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/></svg>
                        <span>Dừng quy trình</span>
                    </button>
                </div>
            </div>
        `;

        document.body.appendChild(panel);

        // Bind Events
        document.getElementById('his-btn-start').addEventListener('click', onStart);
        document.getElementById('his-btn-next').addEventListener('click', onNext);
        document.getElementById('his-btn-skip').addEventListener('click', onSkip);
        document.getElementById('his-btn-stop').addEventListener('click', onStop);
        document.getElementById('his-refresh-ui').addEventListener('click', onRefresh);

        // Load saved creator or auto-detect from HIS footer
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
            chrome.storage.sync.get(['lastCreatorName'], (result) => {
                const input = document.getElementById('his-creator-filter');
                const detectedName = detectUserNameFromFooter();

                if (detectedName) {
                    input.value = detectedName;
                    if (result.lastCreatorName !== detectedName) {
                        chrome.storage.sync.set({ lastCreatorName: detectedName });
                    }
                } else if (result && result.lastCreatorName) {
                    input.value = result.lastCreatorName;
                }
            });
        }

        makePanelDraggable(panel);

        // Ghost mode
        document.addEventListener('mousedown', (e) => {
            if (!panel.contains(e.target)) {
                panel.classList.add('his-panel-ghost');
            }
        }, true);

        panel.addEventListener('mouseenter', () => {
            panel.classList.remove('his-panel-ghost');
        });
    }

    function makePanelDraggable(panel) {
        const header = panel.querySelector('.his-panel-header');
        if (!header) return;

        let isDragging = false;
        let startX, startY, startLeft, startBottom;

        header.addEventListener('mousedown', (e) => {
            if (e.target !== header && !e.target.classList.contains('his-panel-title')) return;
            isDragging = true;
            panel.classList.add('dragging');
            const rect = panel.getBoundingClientRect();
            startX = e.clientX;
            startY = e.clientY;
            startLeft = rect.left;
            startBottom = window.innerHeight - rect.bottom;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            const dx = e.clientX - startX;
            const dy = e.clientY - startY;
            let newLeft = startLeft + dx;
            let newBottom = startBottom - dy;
            const panelWidth = panel.offsetWidth;
            const panelHeight = panel.offsetHeight;
            newLeft = Math.max(0, Math.min(newLeft, window.innerWidth - panelWidth));
            newBottom = Math.max(0, Math.min(newBottom, window.innerHeight - panelHeight));
            panel.style.left = newLeft + 'px';
            panel.style.bottom = newBottom + 'px';
            panel.style.right = 'auto';
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) { isDragging = false; panel.classList.remove('dragging'); }
        });
    }

    function showNetworkStatus(isOnline) {
        const existing = document.querySelector('.his-network-status');
        if (existing) existing.remove();

        const indicator = document.createElement('div');
        indicator.className = `his-network-status ${isOnline ? 'online' : 'offline'}`;
        indicator.innerHTML = isOnline ? '🌐 Đã kết nối' : '⚠️ Mất kết nối';
        document.body.appendChild(indicator);

        if (isOnline) {
            setTimeout(() => {
                indicator.style.opacity = '0';
                indicator.style.transform = 'translateY(-20px)';
                setTimeout(() => indicator.remove(), 300);
            }, 3000);
        }
    }

    function setSigningActive(isActive) {
        const panel = document.getElementById('his-workflow-panel');
        if (panel) {
            if (isActive) { panel.classList.add('signing-active'); }
            else { panel.classList.remove('signing-active'); }
        }
    }

    function refreshCreatorInfo() {
        const input = document.getElementById('his-creator-filter');
        if (!input) return;
        if (document.activeElement === input) return;

        const detectedName = detectUserNameFromFooter();
        if (detectedName && detectedName !== input.value) {
            input.value = detectedName;
            if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.sync) {
                chrome.storage.sync.set({ lastCreatorName: detectedName });
            }
        }
    }

    function detectUserNameFromFooter() {
        const footerTexts = document.body.innerText;
        const regex = /Người dùng:\s*([^-]+)\s*-/i;
        const match = footerTexts.match(regex);
        if (match && match[1]) return match[1].trim();

        const statusElements = document.querySelectorAll('.ui-jqgrid-status-bar, [class*="footer"], [id*="footer"]');
        for (const el of statusElements) {
            const m = el.innerText.match(regex);
            if (m && m[1]) return m[1].trim();
        }
        return null;
    }

    function updateStartButtonState(selectedCount, isSigning) {
        const btn = document.getElementById('his-btn-start');
        const panel = document.getElementById('his-workflow-panel');

        if (!panel) return; // Panel not yet injected

        if (selectedCount > 0) {
            panel.style.display = 'block';
            if (btn) { btn.disabled = false; btn.innerText = `Bắt đầu (${selectedCount} hồ sơ)`; }
        } else {
            if (!isSigning) { panel.style.display = 'none'; }
            if (btn) { btn.disabled = true; btn.innerText = 'Bắt đầu'; }
        }
    }

    function toggleView(mode) {
        const startView = document.getElementById('his-start-view');
        const processView = document.getElementById('his-process-view');
        const panel = document.getElementById('his-workflow-panel');

        if (mode === 'process') {
            startView.style.display = 'none';
            processView.style.display = 'block';
        } else {
            startView.style.display = 'block';
            processView.style.display = 'none';
        }

        if (panel) panel.classList.remove('his-panel-ghost');
    }

    function updateStats(current, total, completed, skipped) {
        const remaining = total - completed - skipped;
        const percent = total > 0 ? Math.round((current / total) * 100) : 0;

        const setText = (id, text) => {
            const el = document.getElementById(id);
            if (el) {
                if (el.innerText !== String(text)) {
                    el.innerText = text;
                    el.classList.remove('updated');
                    void el.offsetWidth;
                    el.classList.add('updated');
                    setTimeout(() => el.classList.remove('updated'), 500);
                }
            }
        };

        setText('his-queue-status', `${current}/${total}`);
        setText('his-progress-percent', `${percent}%`);
        setText('his-stat-done', completed);
        setText('his-stat-skip', skipped);
        setText('his-stat-remain', remaining);

        const bar = document.getElementById('his-progress-bar');
        if (bar) bar.style.width = `${percent}%`;
    }

    function setCurrentPatientName(name) {
        const el = document.getElementById('his-current-patient');
        if (el) el.innerText = name;
    }

    function addPatientToHistory(name, status = 'signed') {
        const list = document.getElementById('his-patient-history');
        if (!list) return;

        const emptyItem = list.querySelector('.his-history-empty');
        if (emptyItem) emptyItem.remove();

        const li = document.createElement('li');
        li.className = `his-history-item his-history-${status}`;

        const time = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
        const icon = status === 'signed' ? '✓' : '→';
        const statusText = status === 'signed' ? 'Đã ký' : 'Bỏ qua';

        const iconSpan = document.createElement('span');
        iconSpan.className = 'his-history-icon';
        iconSpan.textContent = icon;

        const nameSpan = document.createElement('span');
        nameSpan.className = 'his-history-name';
        nameSpan.textContent = name;

        const metaSpan = document.createElement('span');
        metaSpan.className = 'his-history-meta';

        const statusSpan = document.createElement('span');
        statusSpan.className = 'his-history-status';
        statusSpan.textContent = statusText;

        const timeSpan = document.createElement('span');
        timeSpan.className = 'his-history-time';
        timeSpan.textContent = time;

        metaSpan.appendChild(statusSpan);
        metaSpan.appendChild(timeSpan);

        li.appendChild(iconSpan);
        li.appendChild(nameSpan);
        li.appendChild(metaSpan);

        list.insertBefore(li, list.firstChild);
        while (list.children.length > 20) {
            list.removeChild(list.lastChild);
        }
        list.scrollTop = 0;
    }

    function clearPatientHistory() {
        const list = document.getElementById('his-patient-history');
        if (!list) return;
        list.innerHTML = '<li class="his-history-empty">Chưa có bệnh nhân nào được xử lý</li>';
    }

    function showCreatorWarning(mismatchDetails, _iframe) {
        hideCreatorWarning();

        const warning = document.createElement('div');
        warning.id = 'his-creator-warning';
        warning.className = 'his-creator-warning';

        const names = mismatchDetails.map(d => d.creator).filter((v, i, a) => a.indexOf(v) === i);
        const nameList = names.slice(0, 3).join(', ') + (names.length > 3 ? ` (+${names.length - 3})` : '');

        const iconDiv = document.createElement('div');
        iconDiv.className = 'his-warning-icon';
        iconDiv.textContent = '!';

        const contentDiv = document.createElement('div');
        contentDiv.className = 'his-warning-content';

        const titleSpan = document.createElement('div');
        titleSpan.className = 'his-warning-title';
        titleSpan.textContent = 'NGƯỜI TẠO KHÔNG KHỚP';

        const detailSpan = document.createElement('div');
        detailSpan.className = 'his-warning-detail';
        detailSpan.textContent = `Phát hiện ${mismatchDetails.length} phiếu do "${nameList}" tạo`;

        const expectedSpan = document.createElement('div');
        expectedSpan.className = 'his-warning-expected';
        expectedSpan.textContent = `Yêu cầu: "${mismatchDetails[0].expected}"`;

        const hintSpan = document.createElement('div');
        hintSpan.className = 'his-warning-hint';
        hintSpan.textContent = 'Nhấn "Ký số" để tiếp tục hoặc bỏ qua phiếu này.';

        contentDiv.appendChild(titleSpan);
        contentDiv.appendChild(detailSpan);
        contentDiv.appendChild(expectedSpan);
        contentDiv.appendChild(hintSpan);

        warning.appendChild(iconDiv);
        warning.appendChild(contentDiv);
        document.body.appendChild(warning);
        requestAnimationFrame(() => warning.classList.add('visible'));
        setTimeout(() => hideCreatorWarning(), 15000);
    }

    function hideCreatorWarning() {
        const warning = document.getElementById('his-creator-warning');
        if (warning) {
            warning.classList.remove('visible');
            setTimeout(() => warning.remove(), 300);
        }
    }

    function hidePanel() {
        const panel = document.getElementById('his-workflow-panel');
        if (panel) panel.style.display = 'none';
    }

    return {
        showToast,
        injectWorkflowControls,
        updateStartButtonState,
        toggleView,
        updateStats,
        setCurrentPatientName,
        addPatientToHistory,
        clearPatientHistory,
        hidePanel,
        showNetworkStatus,
        setSigningActive,
        refreshCreatorInfo,
        createClickRipple,
        showSigningHUD,
        hideSigningHUD,
        showCreatorWarning,
        hideCreatorWarning
    };
})();

console.log('[Aladinn] 🧞 Sign UI loaded');
