/**
 * 🧞 Aladinn — SmartCA Guard Module
 * Monitors SmartCA login state and verifies signer identity.
 *
 * Features:
 * - Enhances the HIS #smartcaicon with always-on-top status badge
 * - When e-Seal dialog appears, scrapes signer name and compares with HIS user
 * - If mismatch → blocks auto-click + shows prominent warning
 * - Provides quick "Đổi tài khoản" action (clicks SmartCA logout)
 *
 * Placement: Scanner module (independent of Sign module)
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Scanner = window.Aladinn.Scanner || {};

window.Aladinn.Scanner.SmartCAGuard = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    // State
    let _hisUserName = '';        // Doctor logged into HIS (from footer)
    let _smartcaUserName = '';    // User currently in SmartCA session
    let _isMonitoring = false;
    let _observer = null;
    let _badgeEl = null;

    let _checkInterval = null;

    // =============================================
    // HIS User Detection (from page footer)
    // =============================================
    function detectHISUser() {
        // Method 1: Direct element
        const userEl = document.querySelector('.his-user-name') ||
                       document.querySelector('#footer_username');
        if (userEl) {
            _hisUserName = userEl.textContent.trim();
            return _hisUserName;
        }

        // Method 2: Footer text regex — "Người dùng: Huỳnh Trung Anh - SADEC.HTANH"
        const footerText = document.body?.innerText || '';
        const regex = /Người dùng:\s*([^-\n]+)\s*-/i;
        const match = footerText.match(regex);
        if (match && match[1]) {
            _hisUserName = match[1].trim();
            return _hisUserName;
        }

        return '';
    }

    // =============================================
    // SmartCA e-Seal Dialog Scraping
    // =============================================

    /**
     * Scrape signer info from the e-Seal dialog.
     * Dialog structure (from screenshot):
     *   UserID:  087092000211
     *   Email:   trunganh1608@gmail.com
     *   Tên người ký: Huỳnh Trung Anh
     *
     * Also handles the SmartCA Login dialog (hình 1).
     */
    function isValidName(str) {
        if (!str || str.length < 2 || str.length > 80) return false;
        if (/[{}#;=<>()[\]\\]/.test(str)) return false; // Reject CSS/JS code like "#smart_ca_info {"
        if (/^\.|^\/|^http|function|var |let |const /.test(str)) return false;
        if (str.includes('@') || /^PIDDTP/i.test(str) || /^\d{6,}$/.test(str)) return false;
        if (/đăng\s*xuất|logout|hủy|cancel|xác\s*nhận/i.test(str)) return false;
        if (/VNPT|SmartCA/i.test(str)) return false;
        return true;
    }

    function scrapeSmartCAInfo() {
        const info = { userId: '', email: '', name: '' };

        const docs = [document];
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) docs.push(doc);
            } catch (_e) { /* cross-origin */ }
        }

        for (const doc of docs) {
            const allText = doc.body?.innerText || '';

            // Strategy 1: After "Tên người dùng:", skip label-like lines
            const labelRx = /Tên\s*người\s*(?:ký|dùng)\s*[:：]/i;
            const labelIdx = allText.search(labelRx);
            if (labelIdx >= 0) {
                const afterLabel = allText.substring(labelIdx).replace(labelRx, '');
                const lines = afterLabel.split('\n').map(l => l.trim()).filter(Boolean);
                for (const line of lines) {
                    if (line.endsWith(':') || line.endsWith('：')) continue;
                    if (!isValidName(line)) continue;
                    info.name = line;
                    break;
                }
            }

            // Strategy 2: DOM — find label, match value by flex sibling index
            if (!info.name) {
                const allEls = doc.querySelectorAll('td, th, label, span, b, font, p');
                for (const el of allEls) {
                    const text = (el.textContent || '').trim();
                    if (text.length > 50 || text.length < 5 || el.children.length > 2) continue;
                    if (!/^Tên\s*người/i.test(text)) continue;

                    const row = el.closest('tr');
                    if (row) {
                        const cells = row.querySelectorAll('td');
                        if (cells.length >= 2) {
                            const v = cells[cells.length - 1].textContent.trim();
                            if (v && isValidName(v) && !v.endsWith(':')) { info.name = v; break; }
                        }
                    }
                    const parent = el.parentElement;
                    if (parent) {
                        const myIdx = Array.from(parent.children).indexOf(el);
                        const parentNext = parent.nextElementSibling;
                        if (parentNext && parentNext.children.length > myIdx) {
                            const v = parentNext.children[myIdx].textContent.trim();
                            if (v && isValidName(v) && !v.endsWith(':')) { info.name = v; break; }
                        }
                        if (el.nextElementSibling) {
                            const v = el.nextElementSibling.textContent.trim();
                            if (v && isValidName(v) && !v.endsWith(':')) {
                                info.name = v; break;
                            }
                        }
                    }
                }
            }

            const em = allText.match(/Email\s*[:：]\s*\n?\s*([^\s\n]+@[^\s\n]+)/i);
            if (em) info.email = em[1].trim();
            const uid = allText.match(/User\s*ID\s*[:：]\s*\n?\s*(\d{6,})/i);
            if (uid) info.userId = uid[1].trim();

            if (info.name) break;
        }

        return info;
    }

    /**
     * Check if e-Seal / SmartCA dialog is currently visible
     */
    function isEsealDialogVisible() {
        const docs = [document];
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) docs.push(doc);
            } catch (_e) { /* cross-origin */ }
        }

        for (const doc of docs) {
            // Check for btnConfirm (e-Seal "Xác nhận" button)
            const confirmBtn = doc.querySelector('#btnConfirm');
            if (confirmBtn && confirmBtn.offsetWidth > 0 && confirmBtn.offsetHeight > 0) {
                return true;
            }

            // Check for SmartCA Login dialog
            const text = doc.body?.innerText || '';
            if (text.includes('Smart Ca Login') || text.includes('e-Seal')) {
                return true;
            }
        }

        return false;
    }

    // =============================================
    // Name Comparison Logic
    // =============================================
    function normalizeVietnamese(str) {
        return (str || '')
            .trim()
            .toLowerCase()
            .replace(/\s+/g, ' ');
    }

    function namesMatch(hisName, smartcaName) {
        if (!hisName || !smartcaName) return null; // Can't determine
        const a = normalizeVietnamese(hisName);
        const b = normalizeVietnamese(smartcaName);
        if (a === b) return true;
        // Fuzzy: one contains the other
        if (a.includes(b) || b.includes(a)) return true;
        return false;
    }

    function enhanceSmartCAIcon() {
        const icon = document.getElementById('smartcaicon');
        if (!icon || icon.dataset.aladinnGuard) return;

        icon.dataset.aladinnGuard = '1';

        // NON-DESTRUCTIVE: Only add cursor + relative for badge overlay
        const computedPos = window.getComputedStyle(icon).position;
        if (computedPos === 'static') {
            icon.style.position = 'relative';
        }
        icon.style.cursor = 'pointer';
        icon.style.transition = 'filter 0.3s ease';

        // Badge overlay
        _badgeEl = document.createElement('div');
        _badgeEl.id = 'aladinn-smartca-badge';
        _badgeEl.style.cssText = `
            position: absolute; top: -3px; right: -3px;
            width: 14px; height: 14px; border-radius: 50%;
            background: #7a6e5e; border: 2px solid #1a1510;
            transition: all 0.3s ease;
            box-shadow: 0 0 4px rgba(0,0,0,0.3);
            pointer-events: none;
        `;
        icon.appendChild(_badgeEl);

        // Styles
        if (!document.getElementById('aladinn-smartca-styles')) {
            const style = document.createElement('style');
            style.id = 'aladinn-smartca-styles';
            style.textContent = `
                @keyframes aladinnScaPulse {
                    0%, 100% { box-shadow: 0 0 0 0 rgba(248,113,113,0.5); }
                    50% { box-shadow: 0 0 0 6px rgba(248,113,113,0); }
                }
                @keyframes aladinnScaGlow {
                    0%, 100% { box-shadow: 0 0 6px rgba(34,197,94,0.3); }
                    50% { box-shadow: 0 0 12px rgba(34,197,94,0.6); }
                }
                #aladinn-smartca-badge.mismatch {
                    background: #f87171 !important;
                    animation: aladinnScaPulse 1.5s ease infinite;
                }
                #aladinn-smartca-badge.matched {
                    background: #22c55e !important;
                    animation: aladinnScaGlow 2s ease infinite;
                }
                #aladinn-smartca-badge.unknown {
                    background: #7a6e5e !important;
                    animation: none;
                }
                #smartcaicon:hover {
                    filter: drop-shadow(0 2px 12px rgba(212,162,90,0.5)) brightness(1.1) !important;
                    transform: scale(1.05);
                }
            `;
            document.head.appendChild(style);
        }

        if (Logger) Logger.info('SmartCA-Guard', '🛡️ SmartCA icon enhanced');
    }

    function updateBadgeState() {
        if (!_badgeEl) return;
        const match = namesMatch(_hisUserName, _smartcaUserName);
        _badgeEl.classList.remove('mismatch', 'matched', 'unknown');
        if (match === null) {
            _badgeEl.classList.add('unknown');
        } else if (match) {
            _badgeEl.classList.add('matched');
        } else {
            _badgeEl.classList.add('mismatch');
        }
    }

    // =============================================
    // SmartCA Logout Handler
    // =============================================
    function handleSmartCALogout(onSuccess) {
        if (Logger) Logger.info('SmartCA-Guard', 'Automated SmartCA logout requested');

        function simulateClick(el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            el.click();
        }

        let attempts = 0;
        const pollInterval = setInterval(() => {
            attempts++;
            const docs = [document];
            const iframes = document.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    if (doc) docs.push(doc);
                } catch (_e) { /* cross-origin */ }
            }

            let bestTarget = null;
            let maxScore = -9999;

            for (const doc of docs) {
                const allTargets = doc.querySelectorAll('button, a, input[type="button"], .btn, [role="button"], span, div');
                
                for (const el of allTargets) {
                    const text = (el.textContent || el.value || '').trim().toLowerCase();
                    if (!(text.includes('đăng xuất') || text.includes('logout') || text.includes('sign out'))) continue;
                    if (el.offsetWidth === 0 && el.offsetHeight === 0) continue;
                    if (el.id === 'aladinn-smartca-logout-btn' || el.id === 'aladinn-smartca-tooltip') continue;
                    
                    if (el.tagName === 'DIV' || el.tagName === 'SPAN') {
                        if (el.children.length > 2) continue; // Skip massive containers
                    }

                    const rect = el.getBoundingClientRect();
                    let score = 0;

                    // 1. Penalize HIS header buttons
                    if (rect.top < 100) score -= 1000;

                    // 2. Reward primary clickable elements
                    if (['BUTTON', 'A', 'INPUT'].includes(el.tagName) || el.classList.contains('btn')) {
                        score += 50;
                    }

                    // 3. Reward if inside a dialog/modal container
                    const dialog = el.closest('.ui-dialog, .modal, [role="dialog"], #smart_ca_info');
                    if (dialog) score += 200;

                    // 4. Reward vertically lower buttons
                    score += rect.top / 10;

                    if (score > maxScore) {
                        maxScore = score;
                        bestTarget = el;
                    }
                }
            }

            if (bestTarget) {
                clearInterval(pollInterval);
                if (Logger) Logger.info('SmartCA-Guard', 'Found correct SmartCA logout button, simulating click');
                // Small delay to ensure event listeners are attached
                setTimeout(() => {
                    simulateClick(bestTarget);
                    _smartcaUserName = ''; // Reset cached name
                    updateBadgeState();
                    showGuardToast('🔄 Đã tự động click Đăng xuất SmartCA!', 'info');
                    if (typeof onSuccess === 'function') onSuccess();
                }, 300);
            } else if (attempts >= 15) { // 7.5 seconds
                clearInterval(pollInterval);
                showGuardToast('⚠️ Không tìm thấy nút đăng xuất. Hãy đóng thông báo này và tự tìm nút "Đăng xuất" trên màn hình SmartCA.', 'warning', 6000);
            }
        }, 500);
    }

    // =============================================
    // E-Seal Mismatch Warning Injection
    // =============================================

    /**
     * Inject a warning banner into the e-Seal dialog when names don't match.
     * This is the critical safety guard — visually blocks the user from signing carelessly.
     */
    function injectMismatchWarning() {
        // Find the dialog
        const docs = [document];
        const iframes = document.querySelectorAll('iframe');
        for (const iframe of iframes) {
            try {
                const doc = iframe.contentDocument || iframe.contentWindow.document;
                if (doc) docs.push(doc);
            } catch (_e) { /* */ }
        }

        for (const doc of docs) {
            const confirmBtn = doc.querySelector('#btnConfirm');
            if (!confirmBtn || confirmBtn.offsetWidth === 0) continue;

            // Don't inject twice
            if (doc.getElementById('aladinn-smartca-mismatch-warning')) continue;

            const dialog = confirmBtn.closest('.modal, .modal-content, .popup, div, form');
            if (!dialog) continue;

            const warning = doc.createElement('div');
            warning.id = 'aladinn-smartca-mismatch-warning';
            warning.style.cssText = `
                background: #fff3f3;
                border-left: 4px solid #ef4444;
                padding: 10px;
                margin: 10px 0;
                font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
                animation: aladinnScaFadeIn 0.3s ease;
                border-radius: 4px;
            `;
            warning.innerHTML = `
                <div style="color: #b91c1c; font-weight: bold; font-size: 13px; margin-bottom: 6px;">
                    ⚠️ CHỮ KÝ SỐ KHÔNG KHỚP TÀI KHOẢN HIS
                </div>
                <div style="font-size: 12px; color: #444; line-height: 1.5;">
                    <b>HIS:</b> <span style="color:#1a6cc2">${_escHtml(_hisUserName)}</span><br/>
                    <b>SmartCA:</b> <span style="color:#dc2626">${_escHtml(_smartcaUserName)}</span>
                </div>
            `;

            // Create Auto-Logout Button
            const autoLogoutBtn = doc.createElement('button');
            autoLogoutBtn.innerHTML = '🔄 Đăng xuất SmartCA ngay';
            autoLogoutBtn.style.cssText = `
                margin-top: 8px; background: #ef4444; color: white; border: none; 
                padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; 
                font-weight: bold; display: flex; align-items: center; gap: 4px; width: 100%; justify-content: center;
                transition: background 0.2s;
            `;
            autoLogoutBtn.onmouseover = () => autoLogoutBtn.style.background = '#dc2626';
            autoLogoutBtn.onmouseout = () => autoLogoutBtn.style.background = '#ef4444';
            
            autoLogoutBtn.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                autoLogoutBtn.innerHTML = '⏳ Đang đăng xuất...';
                autoLogoutBtn.style.opacity = '0.7';
                autoLogoutBtn.style.pointerEvents = 'none';

                // 1. Open SmartCA Login Modal
                const icon = document.getElementById('smartcaicon');
                if (icon) icon.click();

                // 2. Trigger robust SmartCA Logout polling
                handleSmartCALogout(() => {
                    // 3. On success, update the warning UI to explicitly guide the user
                    warning.style.background = '#f0fdf4'; // Light green
                    warning.style.borderLeftColor = '#22c55e';
                    warning.innerHTML = `
                        <div style="color: #166534; font-weight: bold; font-size: 13px; margin-bottom: 6px;">
                            ✅ ĐÃ ĐĂNG XUẤT TÀI KHOẢN CŨ
                        </div>
                        <div style="font-size: 12px; color: #15803d; line-height: 1.5; font-weight: 600;">
                            Hệ thống đã sẵn sàng. Vui lòng bấm nút bên dưới để đăng nhập lại đúng tài khoản Bác sĩ điều trị.
                        </div>
                    `;

                    // Add Login Button
                    const loginBtn = doc.createElement('button');
                    loginBtn.innerHTML = '🔑 ĐĂNG NHẬP SMARTCA LẠI';
                    loginBtn.style.cssText = `
                        margin-top: 8px; background: #22c55e; color: white; border: none; 
                        padding: 8px 12px; border-radius: 4px; cursor: pointer; font-size: 12px; 
                        font-weight: bold; display: flex; align-items: center; gap: 4px; width: 100%; justify-content: center;
                        transition: background 0.2s; box-shadow: 0 2px 4px rgba(34,197,94,0.3);
                    `;
                    loginBtn.onmouseover = () => loginBtn.style.background = '#16a34a';
                    loginBtn.onmouseout = () => loginBtn.style.background = '#22c55e';
                    
                    loginBtn.onclick = (e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        // Click the HIS SmartCA icon to open the Login dialog
                        const icon = document.getElementById('smartcaicon');
                        if (icon) icon.click();
                    };

                    warning.appendChild(loginBtn);
                });
            };

            warning.appendChild(autoLogoutBtn);

            // Inject warning BEFORE the confirm/cancel buttons
            const btnContainer = confirmBtn.parentElement;
            if (btnContainer) {
                btnContainer.parentElement.insertBefore(warning, btnContainer);
            } else {
                dialog.insertBefore(warning, dialog.firstChild);
            }

            // Also add animation keyframes to the doc if not present
            if (!doc.getElementById('aladinn-smartca-warning-style')) {
                const style = doc.createElement('style');
                style.id = 'aladinn-smartca-warning-style';
                style.textContent = `
                    @keyframes aladinnScaFadeIn {
                        from { opacity: 0; transform: translateY(8px); }
                        to   { opacity: 1; transform: translateY(0); }
                    }
                `;
                doc.head.appendChild(style);
            }

            if (Logger) Logger.warn('SmartCA-Guard', `🚨 Mismatch warning injected! HIS="${_hisUserName}" vs SmartCA="${_smartcaUserName}"`);
        }
    }

    // =============================================
    // Monitoring Loop
    // =============================================
    function startMonitoring() {
        if (_isMonitoring) return;
        _isMonitoring = true;

        // Detect HIS user immediately
        detectHISUser();

        // Enhance SmartCA icon if available
        enhanceSmartCAIcon();

        // Periodic check for e-Seal dialog
        _checkInterval = setInterval(() => {
            // Re-detect HIS user if not found yet
            if (!_hisUserName) detectHISUser();

            // Re-enhance icon if it appeared (HIS may load it late)
            if (!document.getElementById('smartcaicon')?.dataset?.aladinnGuard) {
                enhanceSmartCAIcon();
            }

            // Check if e-Seal dialog is visible
            if (isEsealDialogVisible()) {
                const info = scrapeSmartCAInfo();
                
                // Cập nhật tên SmartCA nếu phát hiện mới
                if (info.name && info.name !== _smartcaUserName) {
                    _smartcaUserName = info.name;
                    updateBadgeState();
                    if (Logger) Logger.info('SmartCA-Guard', `SmartCA user detected: "${_smartcaUserName}"`);
                }

                // Luôn kiểm tra match/mismatch khi dialog đang mở
                // (không chỉ khi tên thay đổi — vì warning bị mất khi dialog đóng/mở lại)
                if (_smartcaUserName && _hisUserName) {
                    const match = namesMatch(_hisUserName, _smartcaUserName);
                    if (match === false) {
                        // MISMATCH! Inject warning nếu chưa có
                        injectMismatchWarning();
                        
                        // Chỉ toast 1 lần (tránh spam mỗi 1.5s)
                        if (!window.__aladinnSmartCAMismatch) {
                            showGuardToast(`🚨 SmartCA (${_smartcaUserName}) KHÔNG khớp với BS HIS (${_hisUserName})!`, 'error', 8000);
                        }

                        // Block auto-click by setting a global flag
                        window.__aladinnSmartCAMismatch = true;
                    } else if (match === true) {
                        window.__aladinnSmartCAMismatch = false;
                        
                        // REMOVE warning box if it exists (meaning they successfully logged in as the correct user)
                        const docs = [document];
                        const iframes = document.querySelectorAll('iframe');
                        for (const iframe of iframes) {
                            try {
                                const doc = iframe.contentDocument || iframe.contentWindow.document;
                                if (doc) docs.push(doc);
                            } catch (_e) { /* cross-origin */ }
                        }
                        for (const doc of docs) {
                            const warning = doc.getElementById('aladinn-smartca-mismatch-warning');
                            if (warning) warning.remove();
                        }
                    }
                }
            }
        }, 1500);

        if (Logger) Logger.success('SmartCA-Guard', '🛡️ Monitoring started');
    }

    function stopMonitoring() {
        _isMonitoring = false;
        if (_checkInterval) {
            clearInterval(_checkInterval);
            _checkInterval = null;
        }
        if (_observer) {
            _observer.disconnect();
            _observer = null;
        }
    }

    // =============================================
    // Toast Helper
    // =============================================
    function showGuardToast(message, type = 'info', duration = 4000) {
        // Use existing toast system if available
        if (window.VNPTRealtime?.showToast) {
            window.VNPTRealtime.showToast(message, type);
            return;
        }

        // Fallback: inject own toast
        const existing = document.getElementById('aladinn-smartca-toast');
        if (existing) existing.remove();

        const colors = {
            info: { bg: 'rgba(212,162,90,0.95)', text: '#1a1510' },
            success: { bg: 'rgba(34,197,94,0.95)', text: '#fff' },
            error: { bg: 'rgba(239,68,68,0.95)', text: '#fff' },
            warning: { bg: 'rgba(245,158,11,0.95)', text: '#1a1510' }
        };
        const c = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.id = 'aladinn-smartca-toast';
        toast.style.cssText = `
            position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
            z-index: 2147483647;
            background: ${c.bg}; color: ${c.text};
            padding: 12px 24px; border-radius: 12px;
            font-size: 13px; font-weight: 600;
            box-shadow: 0 8px 32px rgba(0,0,0,0.3);
            backdrop-filter: blur(8px);
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            animation: aladinnScaFadeIn 0.2s ease;
            max-width: 500px; text-align: center;
        `;
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(() => toast.remove(), duration);
    }

    // =============================================
    // Helpers
    // =============================================
    function _escHtml(str) {
        const d = document.createElement('div');
        d.textContent = str || '';
        return d.innerHTML;
    }

    // =============================================
    // Public API
    // =============================================
    return {
        init: startMonitoring,
        stop: stopMonitoring,
        getHISUser: () => _hisUserName,
        getSmartCAUser: () => _smartcaUserName,
        isMismatch: () => namesMatch(_hisUserName, _smartcaUserName) === false
    };
})();

console.log('[Aladinn] 🛡️ SmartCA Guard loaded');
