/**
 * 🧞 Aladinn — SmartCA Guard Module (V2 Enhanced)
 * Monitors SmartCA login state and verifies signer identity.
 *
 * Features:
 * - PA1: Tooltip chi tiết khi hover icon SmartCA
 * - PA2: Thanh trạng thái luôn hiển thị bên cạnh icon (tên người đăng nhập SmartCA)
 * - PA3: Auto-toast cảnh báo chủ động khi mismatch (không cần mở dialog)
 * - PA4: Block auto-sign khi mismatch (giữ nguyên)
 * - Injects mismatch warning into e-Seal dialog khi mở
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
    let _smartcaEmail = '';       // Email from SmartCA session
    let _smartcaUserId = '';      // UserID from SmartCA session
    
    // Silent Probe variables
    let _hasProbed = false;
    let _probingInProgress = false;
    let _isMonitoring = false;
    let _observer = null;
    let _badgeEl = null;
    let _statusEl = null;         // PA2: Inline status text element
    let _tooltipEl = null;        // PA1: Tooltip element
    let _persistentToastEl = null; // PA3: Persistent mismatch toast

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

        // CHUẨN NHẤT & NHANH NHẤT: Đọc trực tiếp từ sessionStorage của HIS!
        try {
            const rawData = sessionStorage.getItem('hisl2_smartca');
            if (rawData) {
                const parsed = JSON.parse(rawData);
                if (parsed && parsed.user) {
                    if (parsed.user.fullName) info.name = parsed.user.fullName.trim();
                    if (parsed.user.email) info.email = parsed.user.email.trim();
                    if (parsed.user.uid) info.userId = parsed.user.uid.trim();
                }
            }
        } catch (e) {
            // parse error, ignore
        }

        return info;
    }

    /**
     * Silent Probe - Programmatically trigger SmartCA check while hiding the UI
     */
    function silentProbeSmartCA() {
        if (_hasProbed || _probingInProgress) return;
        const icon = document.getElementById('smartcaicon');
        if (!icon) return;

        if (Logger) Logger.info('SmartCA-Guard', 'Starting silent probe...');
        _probingInProgress = true;
        
        // 1. Inject CSS to hide all dialogs temporarily
        let style = document.getElementById('aladinn-silent-probe-style');
        if (!style) {
            style = document.createElement('style');
            style.id = 'aladinn-silent-probe-style';
            // Hide standard HIS dialogs, jQuery UI dialogs, jBox wrappers
            style.textContent = `
                body.aladinn-probing .ui-dialog,
                body.aladinn-probing .ui-widget-overlay,
                body.aladinn-probing .jBox-wrapper,
                body.aladinn-probing .jBox-overlay,
                body.aladinn-probing .modal,
                body.aladinn-probing .modal-backdrop {
                    opacity: 0 !important;
                    pointer-events: none !important;
                    position: absolute !important;
                    left: -9999px !important;
                    top: -9999px !important;
                    z-index: -2147483648 !important;
                }
            `;
            document.head.appendChild(style);
        }

        // Save active element to restore focus later
        const activeElement = document.activeElement;
        
        document.body.classList.add('aladinn-probing');
        
        // 2. Trigger the check (simulate click natively to avoid CSP errors)
        icon.click();

        // 3. Poll for results
        let checks = 0;
        const pollIntv = setInterval(function() {
            checks++;
            const info = scrapeSmartCAInfo();
            
            // If we found a name, OR we timed out (8 seconds = 80 checks)
            if (info.name || checks > 80) {
                clearInterval(pollIntv);
                
                if (info.name) {
                    if (Logger) Logger.info('SmartCA-Guard', 'Silent probe SUCCESS! Detected: ' + info.name);
                    _smartcaUserName = info.name;
                    _smartcaEmail = info.email || '';
                    _smartcaUserId = info.userId || '';
                    updateBadgeState();
                } else {
                    if (Logger) Logger.info('SmartCA-Guard', 'Silent probe timeout/empty (User not logged in).');
                }

                // 4. Close the probed dialog
                closeProbedDialog();

                // 5. Restore normal state after a brief delay (allow close animation)
                setTimeout(() => {
                    document.body.classList.remove('aladinn-probing');
                    if (activeElement && typeof activeElement.focus === 'function') {
                        activeElement.focus();
                    }
                    _hasProbed = true;
                    _probingInProgress = false;
                }, 300);
            }
        }, 100);
    }

    function closeProbedDialog() {
        // 1. Fallback Try jQuery UI close button natively
        const closeBtns = document.querySelectorAll('.ui-dialog-titlebar-close, .jBox-closeButton, [data-dismiss="modal"]');
        for (const btn of closeBtns) {
            btn.click();
            return;
        }

        // 2. Try generic "X" or "Đóng" button in the dialog header
        const allBtns = document.querySelectorAll('button, a');
        for (const btn of allBtns) {
            const txt = (btn.textContent || btn.title || '').trim().toLowerCase();
            if (txt === 'đóng' || txt === 'close' || txt === 'x') {
                const zIndex = parseInt(window.getComputedStyle(btn).zIndex || '0');
                // Only click if it's likely a dialog button (inside a dialog container)
                if (btn.closest('.ui-dialog') || btn.closest('.jBox-wrapper') || btn.closest('.modal')) {
                    btn.click();
                    return;
                }
            }
        }
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

    // =============================================
    // PA1: Tooltip khi hover icon SmartCA
    // =============================================
    function createTooltip() {
        if (_tooltipEl) return;

        _tooltipEl = document.createElement('div');
        _tooltipEl.id = 'aladinn-smartca-tooltip';
        _tooltipEl.className = 'aladinn-smartca-tooltip';
        
        document.body.appendChild(_tooltipEl);
    }

    function updateTooltipContent() {
        if (!_tooltipEl) return;

        const match = namesMatch(_hisUserName, _smartcaUserName);
        let statusIcon, statusText, statusColor;

        if (!_smartcaUserName) {
            statusIcon = '⚪';
            statusText = 'Chưa xác định';
            statusColor = '#888';
        } else if (match === true) {
            statusIcon = '✅';
            statusText = 'Khớp tài khoản HIS';
            statusColor = '#166534';
        } else {
            statusIcon = '🚨';
            statusText = 'KHÔNG KHỚP TÀI KHOẢN HIS';
            statusColor = '#dc2626';
        }

        const rows = [];
        rows.push('<div class="aladinn-smartca-tooltip-header">VNPT SmartCA</div>');
        
        if (_smartcaUserName) {
            rows.push('<div class="aladinn-smartca-tooltip-row"><b>Người ký:</b> ' + _escHtml(_smartcaUserName) + '</div>');
        }
        if (_smartcaEmail) {
            rows.push('<div class="aladinn-smartca-tooltip-row-muted"><b>Email:</b> ' + _escHtml(_smartcaEmail) + '</div>');
        }
        if (_smartcaUserId) {
            rows.push('<div class="aladinn-smartca-tooltip-row-muted"><b>UserID:</b> ' + _escHtml(_smartcaUserId) + '</div>');
        }
        if (_hisUserName) {
            rows.push('<div class="aladinn-smartca-tooltip-row"><b>BS HIS:</b> ' + _escHtml(_hisUserName) + '</div>');
        }

        rows.push('<div class="aladinn-smartca-tooltip-status" style="color:' + statusColor + ';">' + statusIcon + ' ' + statusText + '</div>');

        _tooltipEl.innerHTML = rows.join('');
    }

    function showTooltip() {
        if (!_tooltipEl) return;
        // Chưa có thông tin SmartCA → không hiện tooltip (tránh hiện khung trống)
        if (!_smartcaUserName) return;
        updateTooltipContent();

        const icon = document.getElementById('smartcaicon');
        if (!icon) return;

        _tooltipEl.style.position = 'fixed';
        _tooltipEl.style.left = '';
        _tooltipEl.style.top = '';
        _tooltipEl.style.bottom = '';
        _tooltipEl.style.transform = 'none';
        _tooltipEl.style.display = 'block';

        // Đo lại sau khi render → clamp trong viewport
        requestAnimationFrame(function() {
            if (!_tooltipEl) return;
            var iconRect = icon.getBoundingClientRect();
            var tipW = _tooltipEl.offsetWidth;
            var tipH = _tooltipEl.offsetHeight;
            var vw = window.innerWidth;
            var vh = window.innerHeight;

            // Dọc: nếu icon ở nửa dưới → hiện tooltip LÊN TRÊN
            var top;
            if (iconRect.top > vh / 2) {
                top = iconRect.top - tipH - 6;
            } else {
                top = iconRect.bottom + 6;
            }
            // Clamp dọc
            if (top + tipH > vh - 8) top = vh - tipH - 8;
            if (top < 8) top = 8;

            // Ngang: căn giữa icon, clamp trái/phải
            var left = iconRect.left + iconRect.width / 2 - tipW / 2;
            if (left + tipW > vw - 8) left = vw - tipW - 8;
            if (left < 8) left = 8;

            _tooltipEl.style.top = top + 'px';
            _tooltipEl.style.left = left + 'px';
        });
    }

    function hideTooltip() {
        if (_tooltipEl) _tooltipEl.style.display = 'none';
    }

    // PA2: Đã loại bỏ thanh trạng thái — chỉ giữ badge dot + tooltip khi hover
    function createStatusLabel() { /* no-op */ }
    function updateStatusLabel() { /* no-op */ }

    // =============================================
    // PA3: Persistent Toast cảnh báo chủ động
    // =============================================
    function showPersistentMismatchToast() {
        // Đã hiện rồi thì không hiện nữa
        if (_persistentToastEl && document.body.contains(_persistentToastEl)) return;

        _persistentToastEl = document.createElement('div');
        _persistentToastEl.id = 'aladinn-smartca-persistent-toast';
        _persistentToastEl.className = 'aladinn-smartca-persistent-toast';

        _persistentToastEl.innerHTML = [
            '<div class="aladinn-smartca-toast-body">',
            '  <div class="aladinn-smartca-toast-header">',
            '    <span class="aladinn-smartca-toast-icon">🚨</span>',
            '    <span class="aladinn-smartca-toast-title">Chữ ký số không khớp tài khoản HIS</span>',
            '  </div>',
            '  <div class="aladinn-smartca-toast-details">',
            '    <div class="aladinn-smartca-toast-detail-row">',
            '      <span class="aladinn-smartca-toast-label-his">BS HIS:</span>',
            '      <span class="aladinn-smartca-toast-value-his">' + _escHtml(_hisUserName) + '</span>',
            '    </div>',
            '    <div class="aladinn-smartca-toast-detail-row">',
            '      <span class="aladinn-smartca-toast-label-smartca">SmartCA:</span>',
            '      <span class="aladinn-smartca-toast-value-smartca">' + _escHtml(_smartcaUserName) + '</span>',
            '    </div>',
            '  </div>',
            '  <div class="aladinn-smartca-toast-warning-box">',
            '    ⚠️ Nếu tiếp tục ký, chữ ký sẽ mang tên <b>' + _escHtml(_smartcaUserName) + '</b> — không phải bác sĩ đang điều trị.',
            '  </div>',
            '  <div class="aladinn-smartca-toast-buttons">',
            '    <button id="aladinn-smartca-toast-logout" class="aladinn-smartca-toast-btn-logout">🔄 Đăng xuất SmartCA ngay</button>',
            '    <button id="aladinn-smartca-toast-dismiss" class="aladinn-smartca-toast-btn-dismiss">Bỏ qua</button>',
            '  </div>',
            '</div>'
        ].join('');

        // Inject animation keyframes
        if (!document.getElementById('aladinn-smartca-shake-style')) {
            const style = document.createElement('style');
            style.id = 'aladinn-smartca-shake-style';
            style.textContent = [
                '@keyframes aladinnSmartcaShake {',
                '  0%, 100% { transform: translateX(-50%) translateY(0); }',
                '  10%, 30%, 50%, 70%, 90% { transform: translateX(-50%) translateY(-2px); }',
                '  20%, 40%, 60%, 80% { transform: translateX(-50%) translateY(2px); }',
                '}'
            ].join('\n');
            document.head.appendChild(style);
        }

        document.body.appendChild(_persistentToastEl);

        // Bind events
        const logoutBtn = document.getElementById('aladinn-smartca-toast-logout');
        const dismissBtn = document.getElementById('aladinn-smartca-toast-dismiss');

        if (logoutBtn) {
            logoutBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();
                logoutBtn.innerHTML = '⏳ Đang đăng xuất...';
                logoutBtn.style.opacity = '0.7';
                logoutBtn.style.pointerEvents = 'none';

                // Open SmartCA dialog
                const icon = document.getElementById('smartcaicon');
                if (icon) icon.click();

                // Auto logout
                handleSmartCALogout(function() {
                    removePersistentMismatchToast();
                    showGuardToast('✅ Đã đăng xuất SmartCA! Hãy đăng nhập lại đúng tài khoản.', 'success', 5000);
                });
            };
        }

        if (dismissBtn) {
            dismissBtn.onclick = function(e) {
                e.preventDefault();
                removePersistentMismatchToast();
            };
        }

        if (Logger) Logger.warn('SmartCA-Guard', '🚨 Persistent mismatch toast shown');
    }

    function removePersistentMismatchToast() {
        if (_persistentToastEl && document.body.contains(_persistentToastEl)) {
            _persistentToastEl.remove();
        }
        _persistentToastEl = null;
    }

    // =============================================
    // Icon Enhancement (Badge + Tooltip + Status)
    // =============================================
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
        icon.style.transition = 'filter 0.2s ease';

        // Badge overlay
        _badgeEl = document.createElement('div');
        _badgeEl.id = 'aladinn-smartca-badge';
        _badgeEl.style.cssText = [
            'position: absolute',
            'top: -3px',
            'right: -3px',
            'width: 14px',
            'height: 14px',
            'border-radius: 50%',
            'background: #888',
            'border: 2px solid #fff',
            'transition: all 0.2s ease',
            'box-shadow: 0 0 4px rgba(0,0,0,0.2)',
            'pointer-events: none'
        ].join(';');
        icon.appendChild(_badgeEl);

        // PA1: Tooltip on hover
        createTooltip();
        icon.addEventListener('mouseenter', showTooltip);
        icon.addEventListener('mouseleave', hideTooltip);

        // PA2: Status label
        createStatusLabel();
        updateStatusLabel();

        // Styles
        if (!document.getElementById('aladinn-smartca-styles')) {
            const style = document.createElement('style');
            style.id = 'aladinn-smartca-styles';
            style.textContent = [
                '@keyframes aladinnScaPulse {',
                '    0%, 100% { box-shadow: 0 0 0 0 rgba(220,38,38,0.5); }',
                '    50% { box-shadow: 0 0 0 6px rgba(220,38,38,0); }',
                '}',
                '@keyframes aladinnScaGlow {',
                '    0%, 100% { box-shadow: 0 0 4px rgba(34,197,94,0.2); }',
                '    50% { box-shadow: 0 0 8px rgba(34,197,94,0.5); }',
                '}',
                '#aladinn-smartca-badge.mismatch {',
                '    background: #dc2626 !important;',
                '    animation: aladinnScaPulse 1.5s ease infinite;',
                '}',
                '#aladinn-smartca-badge.matched {',
                '    background: #22c55e !important;',
                '    animation: aladinnScaGlow 2s ease infinite;',
                '}',
                '#aladinn-smartca-badge.unknown {',
                '    background: #888 !important;',
                '    animation: none;',
                '}',
                '#smartcaicon:hover {',
                '    filter: brightness(1.08) !important;',
                '    transform: scale(1.03);',
                '}'
            ].join('\n');
            document.head.appendChild(style);
        }

        if (Logger) Logger.info('SmartCA-Guard', '🛡️ SmartCA icon enhanced (V2: tooltip + status + badge)');
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

        // PA2: Cập nhật status label
        updateStatusLabel();
    }

    // =============================================
    // SmartCA Logout Handler
    // =============================================
    function handleSmartCALogout(onSuccess, onFailure) {
        if (Logger) Logger.info('SmartCA-Guard', 'Automated SmartCA logout requested');

        function simulateClick(el) {
            el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('mouseup', { bubbles: true, cancelable: true }));
            el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
            el.click();
        }

        let attempts = 0;
        const pollInterval = setInterval(function() {
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
                    if (el.id === 'aladinn-smartca-toast-logout' || el.id === 'aladinn-smartca-persistent-toast') continue;
                    
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
                setTimeout(function() {
                    simulateClick(bestTarget);
                    _smartcaUserName = ''; // Reset cached name
                    _smartcaEmail = '';
                    _smartcaUserId = '';
                    updateBadgeState();
                    if (typeof onSuccess === 'function') onSuccess();
                }, 300);
            } else if (attempts >= 15) { // 7.5 seconds
                clearInterval(pollInterval);
                showGuardToast('⚠️ Không tìm thấy nút đăng xuất tự động. Hãy tự mở hộp thoại SmartCA (góc dưới trái) và nhấn nút "Đăng xuất" bằng tay.', 'warning', 8000);
                if (typeof onFailure === 'function') onFailure();
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
            warning.style.cssText = [
                'background: #fef2f2',
                'border-left: 4px solid #dc2626',
                'padding: 10px',
                'margin: 10px 0',
                'font-family: "Segoe UI", system-ui, -apple-system, sans-serif',
                'animation: aladinnScaFadeIn 0.3s ease',
                'border-radius: 0px'
            ].join(';');
            warning.innerHTML = [
                '<div style="color: #b91c1c; font-weight: bold; font-size: 13px; margin-bottom: 6px;">',
                '    ⚠️ CHỮ KÝ SỐ KHÔNG KHỚP TÀI KHOẢN HIS',
                '</div>',
                '<div style="font-size: 12px; color: #444; line-height: 1.5;">',
                '    <b>HIS:</b> <span style="color:#004f9e">' + _escHtml(_hisUserName) + '</span><br/>',
                '    <b>SmartCA:</b> <span style="color:#dc2626">' + _escHtml(_smartcaUserName) + '</span>',
                '</div>'
            ].join('');

            // Create Auto-Logout Button
            const autoLogoutBtn = doc.createElement('button');
            autoLogoutBtn.innerHTML = '🔄 Đăng xuất SmartCA ngay';
            autoLogoutBtn.style.cssText = [
                'margin-top: 8px',
                'background: #dc2626',
                'color: white',
                'border: none',
                'padding: 6px 12px',
                'border-radius: 0px',
                'cursor: pointer',
                'font-size: 12px',
                'font-weight: bold',
                'display: flex',
                'align-items: center',
                'gap: 4px',
                'width: 100%',
                'justify-content: center',
                'transition: background 0.2s'
            ].join(';');
            autoLogoutBtn.onmouseover = function() { this.style.background = '#b91c1c'; };
            autoLogoutBtn.onmouseout = function() { this.style.background = '#dc2626'; };
            
            autoLogoutBtn.onclick = function(e) {
                e.preventDefault();
                e.stopPropagation();

                autoLogoutBtn.innerHTML = '⏳ Đang đăng xuất...';
                autoLogoutBtn.style.opacity = '0.7';
                autoLogoutBtn.style.pointerEvents = 'none';

                // 1. Open SmartCA Login Modal
                const icon = document.getElementById('smartcaicon');
                if (icon) icon.click();

                // 2. Trigger robust SmartCA Logout polling
                handleSmartCALogout(
                    function() {
                        // On success, update the warning UI (if it's not already removed by the monitor loop)
                        warning.style.background = '#f0fdf4';
                        warning.style.borderLeftColor = '#22c55e';
                        warning.innerHTML = [
                            '<div style="color: #166534; font-weight: bold; font-size: 13px; margin-bottom: 6px;">',
                            '    ✅ ĐÃ ĐĂNG XUẤT TÀI KHOẢN CŨ',
                            '</div>',
                            '<div style="font-size: 12px; color: #15803d; line-height: 1.5; font-weight: 600;">',
                            '    Hệ thống đã sẵn sàng. Vui lòng đăng nhập lại đúng tài khoản Bác sĩ điều trị.',
                            '</div>'
                        ].join('');
                    },
                    function() {
                        // On failure
                        autoLogoutBtn.innerHTML = '⚠️ Thử lại hoặc tự bấm Đăng xuất';
                        autoLogoutBtn.style.opacity = '1';
                        autoLogoutBtn.style.pointerEvents = 'auto';
                        autoLogoutBtn.style.background = '#d97706'; // amber
                    }
                );
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
                style.textContent = [
                    '@keyframes aladinnScaFadeIn {',
                    '    from { opacity: 0; transform: translateY(8px); }',
                    '    to   { opacity: 1; transform: translateY(0); }',
                    '}'
                ].join('\n');
                doc.head.appendChild(style);
            }

            if (Logger) Logger.warn('SmartCA-Guard', '🚨 Mismatch warning injected! HIS="' + _hisUserName + '" vs SmartCA="' + _smartcaUserName + '"');
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
        _checkInterval = setInterval(function() {
            if (document.hidden) return; // PAUSE in background to save CPU
            
            // Re-detect HIS user if not found yet
            if (!_hisUserName) detectHISUser();

            // Re-enhance icon if it appeared (HIS may load it late)
            if (!document.getElementById('smartcaicon')?.dataset?.aladinnGuard) {
                enhanceSmartCAIcon();
            }

            // Luôn quét SmartCA (lấy cả phần tử ẩn) thay vì đợi người dùng click mở dialog!
            const info = scrapeSmartCAInfo();
            
            // Cập nhật tên SmartCA nếu phát hiện mới
            if (info.name && info.name !== _smartcaUserName) {
                _smartcaUserName = info.name;
                _smartcaEmail = info.email || _smartcaEmail;
                _smartcaUserId = info.userId || _smartcaUserId;
                updateBadgeState();
                if (Logger) Logger.info('SmartCA-Guard', 'SmartCA user detected proactively: "' + _smartcaUserName + '"');
            }
            // Cập nhật email/userId nếu thiếu
            if (info.email && !_smartcaEmail) _smartcaEmail = info.email;
            if (info.userId && !_smartcaUserId) _smartcaUserId = info.userId;

            // Kích hoạt Silent Probe nếu chưa có thông tin
            if (!_smartcaUserName && !_hasProbed && !_probingInProgress) {
                // Wait 2 seconds after load before probing to avoid blocking page load
                setTimeout(silentProbeSmartCA, 2000);
                _probingInProgress = true; // Mark early to prevent multiple timeouts
            }

            // PA3: Kiểm tra match/mismatch MỌI LÚC (không chỉ khi dialog mở)
            // Đây là cải tiến cốt lõi — cảnh báo chủ động không đợi dialog
            if (!_smartcaUserName) {
                // Đã đăng xuất (hoặc chưa đăng nhập), dọn dẹp các cảnh báo
                window.__aladinnSmartCAMismatch = false;
                removePersistentMismatchToast();
                
                // Gỡ bỏ warning box nếu có
                const docs = [document];
                const iframes = document.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        if (doc) docs.push(doc);
                    } catch (_e) { /* cross-origin */ }
                }
                for (const doc of docs) {
                    const w = doc.getElementById('aladinn-smartca-mismatch-warning');
                    if (w) w.remove();
                }
            } else if (_smartcaUserName && _hisUserName) {
                const match = namesMatch(_hisUserName, _smartcaUserName);
                if (match === false) {
                    // MISMATCH! 
                    showPersistentMismatchToast();
                    if (isEsealDialogVisible()) {
                        injectMismatchWarning();
                    }
                    window.__aladinnSmartCAMismatch = true;
                } else if (match === true) {
                    window.__aladinnSmartCAMismatch = false;
                    removePersistentMismatchToast();
                    
                    // REMOVE warning box if it exists
                    const docs = [document];
                    const iframes = document.querySelectorAll('iframe');
                    for (const iframe of iframes) {
                        try {
                            const doc = iframe.contentDocument || iframe.contentWindow.document;
                            if (doc) docs.push(doc);
                        } catch (_e) { /* cross-origin */ }
                    }
                    for (const doc of docs) {
                        const w = doc.getElementById('aladinn-smartca-mismatch-warning');
                        if (w) w.remove();
                    }
                }
            }
        }, 1500);

        if (Logger) Logger.success('SmartCA-Guard', '🛡️ Monitoring started (V2: proactive alerts)');
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
        removePersistentMismatchToast();
    }

    // =============================================
    // Toast Helper
    // =============================================
    function showGuardToast(message, type, duration) {
        duration = duration || 4000;
        // Use existing toast system if available
        if (window.VNPTRealtime?.showToast) {
            window.VNPTRealtime.showToast(message, type);
            return;
        }

        // Fallback: inject own toast
        const existing = document.getElementById('aladinn-smartca-toast');
        if (existing) existing.remove();

        const colors = {
            info: { bg: '#004f9e', text: '#fff' },
            success: { bg: '#166534', text: '#fff' },
            error: { bg: '#dc2626', text: '#fff' },
            warning: { bg: '#d97706', text: '#fff' }
        };
        const c = colors[type] || colors.info;

        const toast = document.createElement('div');
        toast.id = 'aladinn-smartca-toast';
        toast.style.cssText = [
            'position: fixed',
            'top: 20px',
            'left: 50%',
            'transform: translateX(-50%)',
            'z-index: 2147483647',
            'background: ' + c.bg,
            'color: ' + c.text,
            'padding: 10px 20px',
            'border-radius: 0px',
            'font-size: 13px',
            'font-weight: 600',
            'box-shadow: 0 4px 16px rgba(0,0,0,0.2)',
            'font-family: "Segoe UI", system-ui, -apple-system, sans-serif',
            'animation: aladinnScaFadeIn 0.2s ease',
            'max-width: 500px',
            'text-align: center'
        ].join(';');
        toast.textContent = message;
        document.body.appendChild(toast);
        setTimeout(function() { toast.remove(); }, duration);
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
        getHISUser: function() { return _hisUserName; },
        getSmartCAUser: function() { return _smartcaUserName; },
        isMismatch: function() { return namesMatch(_hisUserName, _smartcaUserName) === false; }
    };
})();

console.log('[Aladinn] 🛡️ SmartCA Guard V2 loaded (proactive alerts)');
