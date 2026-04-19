/**
 * HIS Voice Assistant - UI Module
 * Panel creation, visibility, toast notifications, and lock screen
 */
/* global DEMO_DATA, MEDICAL_FIELDS, VITAL_SIGNS */
// Panel Visibility
// ========================================
function showPanel() {
    const panel = document.getElementById('his-floating-panel');
    const miniBtn = document.getElementById('his-mini-btn');
    if (!panel || !miniBtn) return;

    // Only trigger animation if was hidden
    if (panel.classList.contains('aladinn-hidden')) {
        panel.classList.remove('aladinn-hidden');
        panel.classList.add('aladinn-panel-appear');
        setTimeout(() => panel.classList.remove('aladinn-panel-appear'), 400);
    }

    panel.classList.remove('faded');
    miniBtn.classList.add('aladinn-hidden');
    window.isPanelOpen = true;
    window.isPanelFaded = false;

    // Auto focus PIN if locked
    if (typeof window.isLocked !== 'undefined' && window.isLocked) {
        const overlay = document.getElementById('his-lock-overlay');
        if (overlay && !overlay.classList.contains('aladinn-hidden')) {
            const pinInput = document.getElementById('his-unlock-input');
            if (pinInput) setTimeout(() => pinInput.focus(), 100);
        }
    }
}

function hidePanel() {
    const panel = document.getElementById('his-floating-panel');
    const miniBtn = document.getElementById('his-mini-btn');
    if (!panel || !miniBtn) return;

    panel.classList.add('aladinn-hidden');
    panel.classList.remove('faded');
    if (miniBtn) miniBtn.classList.remove('aladinn-hidden');
    window.isPanelOpen = false;
    window.isPanelFaded = false;
}

function fadePanel() {
    const panel = document.getElementById('his-floating-panel');
    if (panel && window.isPanelOpen) {
        panel.classList.add('faded');
        window.isPanelFaded = true;
    }
}

function unfadePanel() {
    const panel = document.getElementById('his-floating-panel');
    if (panel) {
        panel.classList.remove('faded');
        window.isPanelFaded = false;
    }
}

function togglePanel() {
    const panel = document.getElementById('his-floating-panel');
    if (!panel) return;
    if (panel.classList.contains('aladinn-hidden')) {
        showPanel();
    } else {
        hidePanel();
    }
}

// ========================================
// Lock/Unlock Panel
// ========================================
function lockPanel(autoExpand = true) {
    window.isLocked = true;
    window.storageKey = null; // Clear key from memory

    const overlay = document.getElementById('his-lock-overlay');
    const panel = document.getElementById('his-floating-panel');
    const miniLockBtn = document.getElementById('his-mini-lock-btn');
    const miniBtn = document.getElementById('his-mini-btn');

    // Hide main panel
    if (panel) panel.classList.add('aladinn-hidden');
    if (miniBtn) miniBtn.classList.add('aladinn-hidden');

    if (autoExpand) {
        if (overlay) {
            if (window.positionLockOverlay) window.positionLockOverlay();
            overlay.classList.remove('aladinn-hidden');
            overlay.classList.add('aladinn-panel-appear');
            setTimeout(() => overlay.classList.remove('aladinn-panel-appear'), 400);

            const pinInput = document.getElementById('his-unlock-input');
            if (pinInput) {
                pinInput.value = '';
                setTimeout(() => pinInput.focus(), 300);
            }
        }
        if (miniLockBtn) miniLockBtn.classList.add('aladinn-hidden');
    } else {
        // Just show the icon
        if (overlay) overlay.classList.add('aladinn-hidden');
        if (miniLockBtn) miniLockBtn.classList.remove('aladinn-hidden');
    }
}

function collapseLockPanel() {
    const overlay = document.getElementById('his-lock-overlay');
    const miniLockBtn = document.getElementById('his-mini-lock-btn');

    if (overlay && miniLockBtn) {
        overlay.classList.add('aladinn-hidden');
        miniLockBtn.classList.remove('aladinn-hidden');
        
        // Sync position
        const mainMiniBtn = document.getElementById('his-mini-btn');
        if (mainMiniBtn) {
            miniLockBtn.style.left = mainMiniBtn.style.left;
            miniLockBtn.style.top = mainMiniBtn.style.top;
        }
    }
}

function expandLockPanel() {
    const miniLockBtn = document.getElementById('his-mini-lock-btn');
    const overlay = document.getElementById('his-lock-overlay');

    if (miniLockBtn && overlay) {
        miniLockBtn.classList.add('aladinn-hidden');
        
        if (window.positionLockOverlay) window.positionLockOverlay();
        overlay.classList.remove('aladinn-hidden');
        overlay.classList.add('aladinn-panel-appear');
        setTimeout(() => overlay.classList.remove('aladinn-panel-appear'), 400);
        
        const pinInput = document.getElementById('his-unlock-input');
        if (pinInput) {
            pinInput.value = '';
            setTimeout(() => pinInput.focus(), 300);
        }
    }
}

// Global module variables (declared once, initialized in voice-init.js or storage.js)
// Note: These are attached to window for cross-file access within the same module scope.
// window.isLocked = false;
// window.isPanelOpen = false;
// window.isPanelFaded = false;
// window.transcript = '';
// window.currentResults = null;

function unlockPanel() {
    const overlay = document.getElementById('his-lock-overlay');

    if (overlay) {
        window.isLocked = false;
        document.getElementById('his-unlock-input').value = '';
        overlay.classList.add('aladinn-hidden');
        showPanel();
        showToast('🔓 Panel đã mở khóa');
    }
}

// ========================================
// Toast Notifications
// ========================================
function showToast(message, isError = false) {
    const toast = document.getElementById('his-toast');
    if (!toast) return;
    toast.textContent = message;
    toast.className = 'his-toast show' + (isError ? ' error' : '');
    setTimeout(() => toast.classList.remove('show'), 2000);
}

// ========================================
// Process Button State
// ========================================
function updateProcessBtnState() {
    const hasContent = window.transcript.trim().length > 0;
    const btn = document.getElementById('his-process-btn');
    if (btn) btn.disabled = !hasContent;
}

// ========================================
// Demo Data Loading
// ========================================
function loadDemoData() {
    if (window.isLocked) {
        showToast('Vui lòng mở khóa trước!', true);
        return;
    }
    window.transcript = 'Bệnh nhân nam 45 tuổi, vào viện vì đau ngực trái 2 giờ, vã mồ hôi, khó thở. Tiền sử THA 5 năm, ĐTĐ type 2. Bố NMCT. Mạch 90, HA 150/95, SpO2 96%.';
    document.getElementById('his-transcript').value = window.transcript;

    window.currentResults = JSON.parse(JSON.stringify(DEMO_DATA));
    window.displayResults(window.currentResults, true);
    updateProcessBtnState();
    window.saveData();
    showToast('Đã load demo! (Dùng 3-Flash tốn ~22 VNĐ)');
}

// ========================================
// Reset for New Patient
// ========================================
function resetForNewPatient() {
    window.transcript = '';
    window.currentResults = null;
    document.getElementById('his-transcript').value = '';
    document.getElementById('his-results-container').innerHTML = '';
    document.getElementById('his-results-section').classList.add('aladinn-hidden');
    updateProcessBtnState();
    chrome.storage.local.remove(['transcript', 'results']);
    showToast('Đã xóa - Bắt đầu bệnh nhân mới!');
}

// ========================================
// Copy to Clipboard
// ========================================
async function copyToClipboard(text, btn = null) {
    if (!text) return;
    try {
        await navigator.clipboard.writeText(text);
        if (btn) {
            const originalContent = btn.innerHTML;
            btn.classList.add('copied');
            btn.innerHTML = '✓';

            // Add a temporary glow effect
            btn.style.boxShadow = '0 0 15px var(--his-success)';

            setTimeout(() => {
                btn.classList.remove('copied');
                btn.innerHTML = originalContent;
                btn.style.boxShadow = '';
            }, 1500);
        }
        showToast('📋 Đã sao chép vào bộ nhớ');
    } catch (_err) {
        showToast('❌ Lỗi copy!', true);
    }
}

function copyAllResults() {
    if (!window.currentResults) return;
    let text = '';
    MEDICAL_FIELDS.forEach(f => {
        if (window.currentResults[f.key]) text += `${f.label}:\n${window.currentResults[f.key]}\n\n`;
    });
    if (window.currentResults.sinhHieu) {
        text += 'Sinh hiệu:\n';
        VITAL_SIGNS.forEach(v => {
            if (window.currentResults.sinhHieu[v.key]) text += `- ${v.label}: ${window.currentResults.sinhHieu[v.key]} ${v.unit}\n`;
        });
    }
    copyToClipboard(text.trim());
}

// ========================================
// Make Draggable
// ========================================
function makeDraggable(element, handle) {
    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

    handle.onmousedown = dragMouseDown;

    function dragMouseDown(e) {
        e.preventDefault();
        pos3 = e.clientX;
        pos4 = e.clientY;
        document.onmouseup = closeDragElement;
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;

        let newTop = element.offsetTop - pos2;
        let newLeft = element.offsetLeft - pos1;

        // Bounding constraints to prevent panel from getting lost off-screen
        const rect = element.getBoundingClientRect();
        if (newTop < 0) newTop = 0;
        if (newLeft < 0) newLeft = 0;
        if (newLeft + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width;
        if (newTop + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height;

        element.style.top = newTop + 'px';
        element.style.left = newLeft + 'px';
        element.style.right = 'auto';
    }

    function closeDragElement() {
        document.onmouseup = null;
        document.onmousemove = null;
    }
}

// ========================================
// UI Positioning
// ========================================
function positionMiniBtn() {
    const btn = document.getElementById('his-mini-btn');
    if (!btn) return;

    // Standard Floating Action Button (FAB) position
    // Anchored at bottom right, safely above the HIS footer bar (which is ~30px)
    btn.style.position = 'fixed';
    btn.style.right = '30px';
    btn.style.bottom = '80px';
    btn.style.left = 'auto';
    btn.style.top = 'auto';
}

function positionLockOverlay() {
    const overlay = document.getElementById('his-lock-overlay');
    const miniBtn = document.getElementById('his-mini-btn');
    if (!overlay || !miniBtn) return;
    
    if (miniBtn.style.left && miniBtn.style.left !== 'auto') {
        overlay.style.left = miniBtn.style.left;
        overlay.style.top = miniBtn.style.top;
    } else {
        overlay.style.right = '20px';
        overlay.style.bottom = '20px';
        overlay.style.left = 'auto';
        overlay.style.top = 'auto';
    }
}

function syncPositions() {
    window.positionMiniBtn();
    positionLockOverlay();
    
    const miniBtn = document.getElementById('his-mini-btn');
    const miniLockBtn = document.getElementById('his-mini-lock-btn');
    
    if (miniBtn && miniLockBtn) {
        if (miniBtn.style.left) miniLockBtn.style.left = miniBtn.style.left;
        if (miniBtn.style.top) miniLockBtn.style.top = miniBtn.style.top;
        if (miniBtn.style.right) miniLockBtn.style.right = miniBtn.style.right;
        if (miniBtn.style.bottom) miniLockBtn.style.bottom = miniBtn.style.bottom;
    }
}

// ========================================
// Create Floating Panel
// ========================================
function createFloatingPanel() {
    // Mini button
    const miniBtn = document.createElement('button');
    miniBtn.id = 'his-mini-btn';
    const genieIconUrl = chrome.runtime?.getURL ? chrome.runtime.getURL('assets/icons/icon128.png') : '';
    miniBtn.innerHTML = `
        <img src="${genieIconUrl}" style="width: 100%; height: 100%; object-fit: contain; transform: scale(1.3); border-radius: 50%; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.2));" alt="Genie Voice">
    `;
    miniBtn.title = 'Aladinn Voice Assistant - Rê chuột để mở';
    document.body.appendChild(miniBtn);

    // Create Mini Lock Button (for collapsed locked state)
    const miniLockBtn = document.createElement('button');
    miniLockBtn.id = 'his-mini-lock-btn';
    miniLockBtn.className = 'his-mini-lock-btn aladinn-hidden';
    miniLockBtn.innerHTML = '🔒';
    miniLockBtn.title = 'Bấm để mở khóa Aladinn';
    document.body.appendChild(miniLockBtn);

    // Initial sync
    syncPositions();

    // MutationObserver with debounce
    let positionDebounceTimeout = null;
    window.miniBtnObserver = new MutationObserver(() => {
        clearTimeout(positionDebounceTimeout);
        positionDebounceTimeout = setTimeout(syncPositions, 100);
    });
    window.miniBtnObserver.observe(document.body, { childList: true, subtree: true });

    window.addEventListener('resize', syncPositions);
    miniBtn.addEventListener('mouseenter', () => {
        if (!window.isLocked) showPanel();
    });
    miniBtn.addEventListener('click', () => {
        if (!window.isLocked) showPanel();
    });
    
    miniLockBtn.addEventListener('click', () => {
        expandLockPanel();
        // Auto-focus PIN input
        setTimeout(() => {
            const pinInput = document.getElementById('his-unlock-input');
            if (pinInput) pinInput.focus();
        }, 200);
    });

    // Floating panel
    const panel = document.createElement('div');
    panel.id = 'his-floating-panel';
    panel.className = 'aladinn-hidden';
    
    // Fallback constants if not loaded yet
    const ICONS_SAFE = window.ICONS || {
        settings: '⚙️', reset: '🔄', minimize: '➖', autofill: '✨', 
        hoichan: '🤝', chuyenvien: '🚑', copy: '📋', demo: '🧪', 
        mic: '🎙️', ai: '🧠'
    };

    const logoIconUrl = chrome.runtime?.getURL ? chrome.runtime.getURL('assets/icons/icon128.png') : '';

    panel.innerHTML = `
        <div class="his-panel-header" id="his-panel-header">
            <div class="his-panel-title">
                <div class="his-logo" style="background: transparent; box-shadow: none;">
                    <img src="${logoIconUrl}" style="width: 38px; height: 38px; border-radius: 6px; display: block; object-fit: contain; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
                </div>
                <span style="font-size: 16px;">Aladinn Voice</span>
            </div>
            <div class="his-panel-controls">
                <button class="his-panel-btn" id="his-settings-btn" title="Cài đặt">${ICONS_SAFE.settings}</button>
                <button class="his-panel-btn danger" id="his-reset-btn" title="Xóa & Mới">${ICONS_SAFE.reset}</button>
                <button class="his-panel-btn" id="his-minimize-btn" title="Thu nhỏ">${ICONS_SAFE.minimize}</button>
            </div>
        </div>
        <div class="his-panel-body-wrapper">
            <div class="his-panel-body" id="his-panel-body">
                <div class="his-quick-actions" id="his-quick-actions">
                    <button class="his-quick-btn his-quick-primary" id="his-autofill" title="Auto Fill">${ICONS_SAFE.autofill} <span>Fill</span></button>
                    <button class="his-quick-btn his-quick-hoichan" id="his-hoichan-fill" title="Hội chẩn" style="display:none">${ICONS_SAFE.hoichan}</button>
                    <button class="his-quick-btn his-quick-chuyenvien" id="his-chuyenvien-fill" title="Chuyển viện" style="display:none">${ICONS_SAFE.chuyenvien}</button>
                    <button class="his-quick-btn" id="his-copy-all" title="Copy All">${ICONS_SAFE.copy}</button>
                    <button class="his-quick-btn" id="his-demo-btn" title="Demo">${ICONS_SAFE.demo}</button>
                </div>
                <div class="his-section aladinn-hidden" id="his-results-section">
                    <div class="his-results-compact" id="his-results-container"></div>
                </div>
            </div>
            <div class="his-scroll-buttons">
                <button class="his-scroll-btn" id="his-scroll-up" title="Cuộn lên">▲</button>
                <button class="his-scroll-btn" id="his-scroll-down" title="Cuộn xuống">▼</button>
            </div>
        </div>
        <div class="his-panel-footer">
            <div class="his-section" style="padding-top: 0; border-top: none;">
                <textarea class="his-textarea" id="his-transcript" placeholder="Phát biểu hoặc nhập nội dung..." rows="2"></textarea>
                <div class="his-btn-group" style="display: flex; gap: 8px;">
                    <button class="his-btn his-btn-primary" id="his-record-btn" title="Ghi âm" style="flex: 0 0 44px; height: 44px; border-radius: 12px; padding: 0;"><span id="his-record-icon">${ICONS_SAFE.mic}</span></button>
                    <button class="his-btn his-btn-ai" id="his-process-btn" style="flex: 1; height: 44px; border-radius: 12px;">${ICONS_SAFE.ai} <span style="margin-left: 8px;">Xử lý AI</span></button>
                </div>
            </div>
            <div class="his-loading aladinn-hidden" id="his-loading" style="padding-bottom: 10px;"><div class="his-spinner"></div><div style="color: var(--his-text-secondary); font-size: 12px;">Đang xử lý...</div></div>
        </div>
    `;
    document.body.appendChild(panel);

    // Lock Overlay Panel (Independent from main panel)
    const lockOverlayContainer = document.createElement('div');
    lockOverlayContainer.id = 'his-lock-overlay';
    lockOverlayContainer.className = 'his-lock-overlay aladinn-hidden';
    lockOverlayContainer.innerHTML = `
        <button class="his-lock-close-btn" id="his-lock-close-btn" title="Thu nhỏ">➖</button>
        <div class="his-lock-icon">🔒</div>
        <div class="his-lock-title" style="color: white; font-size: 16px; font-weight: 600; margin-bottom: 20px; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">Nhập PIN để mở khóa</div>
        <div class="his-pin-container" id="his-pin-visual">
            <input type="password" id="his-unlock-input" class="his-hidden-pin-input" maxlength="6" inputmode="numeric">
            <div class="his-pin-digit" data-index="0"></div>
            <div class="his-pin-digit" data-index="1"></div>
            <div class="his-pin-digit" data-index="2"></div>
            <div class="his-pin-digit" data-index="3"></div>
            <div class="his-pin-digit" data-index="4"></div>
            <div class="his-pin-digit" data-index="5"></div>
        </div>
        <div style="margin-top: 10px; font-size: 11px; color: rgba(255,255,255,0.4); text-align: center; line-height: 1.6;">Tự động mở khóa khi nhập đủ 6 số.</div>
    `;
    document.body.appendChild(lockOverlayContainer);

    // Toast
    const toast = document.createElement('div');
    toast.className = 'his-toast';
    toast.id = 'his-toast';
    document.body.appendChild(toast);

    // Setup events
    setupPanelEvents();
    makeDraggable(panel, document.getElementById('his-panel-header'));
}

function setupPanelEvents() {
    const panel = document.getElementById('his-floating-panel');
    document.getElementById('his-minimize-btn')?.addEventListener('click', hidePanel);
    document.getElementById('his-lock-close-btn')?.addEventListener('click', collapseLockPanel);
    document.getElementById('his-settings-btn')?.addEventListener('click', () => {
        chrome.runtime.sendMessage({ type: 'OPEN_OPTIONS' });
    });
    document.getElementById('his-reset-btn')?.addEventListener('click', window.resetForNewPatient || function(){});
    document.getElementById('his-record-btn')?.addEventListener('click', window.toggleRecording || function(){});
    document.getElementById('his-demo-btn')?.addEventListener('click', window.loadDemoData || function(){});
    document.getElementById('his-copy-all')?.addEventListener('click', window.copyAllResults || function(){});
    document.getElementById('his-autofill')?.addEventListener('click', window.autoFillForm || function(){});
    document.getElementById('his-hoichan-fill')?.addEventListener('click', window.autoFillHoiChan || function(){});
    document.getElementById('his-chuyenvien-fill')?.addEventListener('click', window.autoFillChuyenVien || function(){});
    document.getElementById('his-process-btn')?.addEventListener('click', window.processWithAI || function(){});

    // Scroll buttons
    const panelBody = document.getElementById('his-panel-body');
    const scrollUpBtn = document.getElementById('his-scroll-up');
    const scrollDownBtn = document.getElementById('his-scroll-down');
    if (panelBody && scrollUpBtn && scrollDownBtn) {
        let scrollInterval = null;
        const startScroll = (dir) => {
            panelBody.scrollBy({ top: dir * 120, behavior: 'smooth' });
            scrollInterval = setInterval(() => {
                panelBody.scrollBy({ top: dir * 80, behavior: 'smooth' });
            }, 200);
        };
        const stopScroll = () => { if (scrollInterval) { clearInterval(scrollInterval); scrollInterval = null; } };

        scrollUpBtn.addEventListener('mousedown', () => startScroll(-1));
        scrollUpBtn.addEventListener('mouseup', stopScroll);
        scrollUpBtn.addEventListener('mouseleave', stopScroll);
        scrollDownBtn.addEventListener('mousedown', () => startScroll(1));
        scrollDownBtn.addEventListener('mouseup', stopScroll);
        scrollDownBtn.addEventListener('mouseleave', stopScroll);
        scrollUpBtn.addEventListener('click', () => panelBody.scrollBy({ top: -120, behavior: 'smooth' }));
        scrollDownBtn.addEventListener('click', () => panelBody.scrollBy({ top: 120, behavior: 'smooth' }));
    }

    const transcriptEl = document.getElementById('his-transcript');
    if (transcriptEl) {
        transcriptEl.addEventListener('input', () => {
            window.transcript = transcriptEl.value;
            window.updateProcessBtnState && window.updateProcessBtnState();
            window.saveData && window.saveData();
        });
    }

    if (panel) {
        panel.addEventListener('mouseleave', fadePanel);
        panel.addEventListener('mouseenter', unfadePanel);
    }

    const pinInput = document.getElementById('his-unlock-input');
    const pinDigits = document.querySelectorAll('.his-pin-digit');
    const overlay = document.getElementById('his-lock-overlay');

    if (pinInput) {
        pinInput.addEventListener('input', (e) => {
            let val = e.target.value.replace(/\D/g, '').substring(0, 6);
            e.target.value = val;

            pinDigits.forEach((digit, i) => {
                if (i < val.length) {
                    digit.textContent = '●';
                    digit.classList.add('filled');
                } else {
                    digit.textContent = '';
                    digit.classList.remove('filled');
                }
            });

            if (val.length === 6) {
                // Secure PIN verification via hash (not plaintext)
                const verifyAndUnlock = async () => {
                    try {
                        const { pin_hash, pin_salt } = await new Promise(resolve =>
                            chrome.storage.local.get(['pin_hash', 'pin_salt'], resolve)
                        );
                        
                        if (!pin_hash || !pin_salt) {
                            // No PIN set — shouldn't reach here, but unlock anyway
                            unlockPanel();
                            return;
                        }
                        
                        // Use verifyPIN (pure crypto, no sendMessage side-effects)
                        const isValid = await HIS.Crypto.verifyPIN(val, pin_hash, pin_salt);
                        
                        if (isValid) {
                            window.storageKey = window.deriveKeyFromPIN ? await window.deriveKeyFromPIN(val) : val;
                            unlockPanel();
                            if (window.loadSavedData) window.loadSavedData();
                            pinInput.value = '';
                            pinDigits.forEach(d => { d.textContent = ''; d.classList.remove('filled'); });
                            
                            // Best-effort: cache PIN in session (non-blocking)
                            try {
                                chrome.runtime.sendMessage({ type: 'CACHE_SESSION_PIN', payload: { pin: val } });
                            } catch (_) { /* ignore */ }
                        } else {
                            if (overlay) overlay.classList.add('his-shake');
                            showToast('Mã PIN không đúng!', true);
                            setTimeout(() => {
                                if (overlay) overlay.classList.remove('his-shake');
                                pinInput.value = '';
                                pinDigits.forEach(d => { d.textContent = ''; d.classList.remove('filled'); });
                            }, 400);
                        }
                    } catch (e) {
                        console.error('[Aladinn] PIN verify error:', e);
                        showToast('Lỗi xác minh PIN!', true);
                        pinInput.value = '';
                        pinDigits.forEach(d => { d.textContent = ''; d.classList.remove('filled'); });
                    }
                };
                verifyAndUnlock();
            }
        });
    }
}

// ========================================
// Global Exports (must be at module top level for cross-file access)
// ========================================
window.createFloatingPanel = createFloatingPanel;
window.setupPanelEvents = setupPanelEvents;
window.showPanel = showPanel;
window.hidePanel = hidePanel;
window.fadePanel = fadePanel;
window.unfadePanel = unfadePanel;
window.togglePanel = togglePanel;
window.showToast = showToast;
window.lockPanel = lockPanel;
window.unlockPanel = unlockPanel;
window.loadDemoData = loadDemoData;
window.resetForNewPatient = resetForNewPatient;
window.copyAllResults = copyAllResults;
window.syncPositions = syncPositions;
window.positionMiniBtn = positionMiniBtn;
window.positionLockOverlay = positionLockOverlay;
window.updateProcessBtnState = updateProcessBtnState;
window.copyToClipboard = copyToClipboard;
