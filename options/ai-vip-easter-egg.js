/**
 * 🧞 Aladinn — AI VIP Easter Egg Module (P0-04)
 *
 * Controlled easter egg with policy gates, PIN requirement, and audit logging.
 * Extracted from options.js for testability and maintainability.
 *
 * SECURITY:
 * - Fail-closed: remote config must explicitly allow
 * - PIN + API key required before toggle is shown
 * - Audit events logged for every state change
 * - No PHI in any log or storage operation
 */

import { checkAiVipGates, getAiVipPolicy } from './ai-vip-helpers.js';

// ========================================
// Audit helper (thin wrapper over existing pattern)
// ========================================
function logAiVipAudit(auditType, details = {}) {
    try {
        chrome.runtime.sendMessage({
            type: 'LOG_AUDIT',
            auditType,
            details
        });
    } catch (_e) { /* fail-open for audit — do not block UX */ }
}

// ========================================
// Main Initializer
// ========================================

/**
 * Initialize the controlled AI VIP easter egg.
 *
 * @param {Object} params
 * @param {boolean} params.hasPinHash - Whether PIN hash exists
 * @param {boolean} params.hasEncryptedKey - Whether encrypted API key exists
 * @param {Function} [params.showToast] - Toast notification function
 */
export function initAiVipEasterEgg({ hasPinHash, hasEncryptedKey, showToast }) {
    const versionTag = document.getElementById('aladinn-version-tag');
    const advancedSection = document.getElementById('ai-features-container');
    if (!versionTag || !advancedSection) return;

    let clickCount = 0;
    let clickTimer = null;
    let aiVipContainer = document.getElementById('ai-vip-container');

    // Create container (hidden by default)
    if (!aiVipContainer) {
        aiVipContainer = createAiVipContainer();
        advancedSection.appendChild(aiVipContainer);
    }

    // Check if previously revealed and restore
    chrome.storage.local.get(
        ['his_settings', 'aladinn_ai_vip_revealed', 'aladinn_remote_config'],
        (res) => {
            const revealed = res.aladinn_ai_vip_revealed === true;
            const settings = res.his_settings || {};

            if (revealed || settings.aiEnabled) {
                showControlledReveal(aiVipContainer, versionTag, {
                    hasPinHash,
                    hasEncryptedKey,
                    showToast,
                    isRestore: true,
                    currentEnabled: !!settings.aiEnabled
                });
            }
        }
    );

    // 5-click easter egg trigger
    versionTag.addEventListener('click', (e) => {
        clickCount++;
        if (clickTimer) clearTimeout(clickTimer);
        clickTimer = setTimeout(() => { clickCount = 0; }, 2000);

        if (clickCount >= 5) {
            handleEasterEggTrigger(aiVipContainer, versionTag, e, {
                hasPinHash,
                hasEncryptedKey,
                showToast
            });
            clickCount = 0;
        }
    });
}

// ========================================
// Container Factory
// ========================================
function createAiVipContainer() {
    const container = document.createElement('div');
    container.id = 'ai-vip-container';
    container.style.display = 'none';
    container.className = 'toggle-row';
    return container;
}

// ========================================
// Easter Egg Trigger Handler
// ========================================
function handleEasterEggTrigger(container, versionTag, event, opts) {
    const isHidden = container.style.display === 'none';

    if (isHidden) {
        showControlledReveal(container, versionTag, {
            ...opts,
            isRestore: false,
            currentEnabled: false,
            clickEvent: event
        });
    } else {
        hideAiVip(container, versionTag);
    }
}

// ========================================
// Controlled Reveal (with all gates)
// ========================================
function showControlledReveal(container, versionTag, opts) {
    const {
        hasPinHash, hasEncryptedKey, showToast,
        isRestore, currentEnabled, clickEvent
    } = opts;

    // Read remote config synchronously from storage cache
    chrome.storage.local.get(['aladinn_remote_config'], (res) => {
        const rc = res.aladinn_remote_config || {};
        const features = rc.features || {};
        const policy = getAiVipPolicy(rc);

        const gate = checkAiVipGates({
            features,
            hasPinHash,
            hasEncryptedKey,
            policy
        });

        // Gate: Easter egg reveal disabled
        if (gate.reason === 'reveal_disabled') {
            // Silently block — don't even show the container
            return;
        }

        // Gate: Blocked by remote config policy
        if (gate.reason === 'blocked_by_policy') {
            renderBlockedByPolicy(container);
            revealContainer(container, versionTag, isRestore, clickEvent);
            logAiVipAudit('ai_vip_blocked_by_policy', {
                source: isRestore ? 'restore' : 'easter_egg'
            });
            return;
        }

        // Gate: PIN required
        if (gate.reason === 'pin_required') {
            renderPinRequired(container);
            revealContainer(container, versionTag, isRestore, clickEvent);
            if (!isRestore) {
                logAiVipAudit('ai_vip_easter_egg_revealed', {
                    gated: 'pin_required'
                });
            }
            return;
        }

        // All gates passed — show full toggle
        renderFullToggle(container, currentEnabled);
        revealContainer(container, versionTag, isRestore, clickEvent);

        // Persist revealed state
        chrome.storage.local.set({ aladinn_ai_vip_revealed: true });

        if (!isRestore) {
            logAiVipAudit('ai_vip_easter_egg_revealed', {
                gated: null
            });
            if (showToast) {
                showToast('🧞✨ Bùm! Thần đèn đã ban cho bạn tính năng AI VIP!');
            }
        }
    });
}

// ========================================
// Render States
// ========================================

function renderBlockedByPolicy(container) {
    container.innerHTML = `
        <div class="toggle-info">
            <strong style="color: var(--error);">🚫 AI VIP đang bị khóa bởi Safe Mode</strong>
            <span>Tính năng đã bị vô hiệu hóa bởi quản trị viên qua remote config.</span>
        </div>
    `;
}

function renderPinRequired(container) {
    container.innerHTML = `
        <div class="toggle-info">
            <strong style="color: var(--warning);">🔒 AI VIP — cần thiết lập mã PIN và API Key</strong>
            <span>Vui lòng thiết lập mã PIN 6 số và nhập Gemini API Key ở phần trên trước khi sử dụng AI VIP.</span>
        </div>
    `;
}

function renderFullToggle(container, currentEnabled) {
    container.innerHTML = `
        <div class="toggle-info">
            <strong style="color: var(--success);">✨ AI VIP — thử nghiệm nội bộ</strong>
            <span>Dùng Gemini tóm tắt hồ sơ khi xem màn hình Tổng kết.</span>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
            <label class="switch">
                <input type="checkbox" id="opt-scan-aivip" ${currentEnabled ? 'checked' : ''}>
                <span class="slider"></span>
            </label>
            <button id="btn-hide-ai-vip"
                style="background: transparent; border: 1px solid var(--border); color: var(--text-dim); padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;"
                title="Ẩn lại AI VIP">
                Ẩn lại
            </button>
        </div>
    `;

    // Wire toggle change audit events
    const toggle = container.querySelector('#opt-scan-aivip');
    if (toggle) {
        toggle.addEventListener('change', () => {
            if (toggle.checked) {
                logAiVipAudit('ai_vip_enabled');
            } else {
                logAiVipAudit('ai_vip_disabled');
            }
        });
    }

    // Wire "Ẩn lại" button
    const hideBtn = container.querySelector('#btn-hide-ai-vip');
    if (hideBtn) {
        hideBtn.addEventListener('click', () => {
            const versionTag = document.getElementById('aladinn-version-tag');
            hideAiVip(container, versionTag);
        });
    }
}

// ========================================
// Show / Hide helpers
// ========================================

function revealContainer(container, versionTag, isRestore, clickEvent) {
    container.style.display = 'flex';

    if (!isRestore) {
        container.classList.remove('magic-reveal');
        void container.offsetWidth; // Force reflow for animation
        container.classList.add('magic-reveal');
        versionTag.style.color = 'var(--success)';

        if (clickEvent) {
            createSparkles(clickEvent.clientX, clickEvent.clientY);
        }
    } else {
        versionTag.style.color = 'var(--success)';
    }
}

function hideAiVip(container, versionTag) {
    container.style.display = 'none';
    container.classList.remove('magic-reveal');
    if (versionTag) versionTag.style.color = '';
    chrome.storage.local.set({ aladinn_ai_vip_revealed: false });
}

// ========================================
// Sparkle Animation (preserved from original)
// ========================================
function createSparkles(x, y) {
    const sparkleContainer = document.createElement('div');
    sparkleContainer.className = 'sparkle-container';
    document.body.appendChild(sparkleContainer);

    for (let i = 0; i < 30; i++) {
        const sparkle = document.createElement('div');
        sparkle.className = 'sparkle';
        sparkle.style.left = x + 'px';
        sparkle.style.top = y + 'px';

        const angle = Math.random() * Math.PI * 2;
        const velocity = 50 + Math.random() * 150;
        const tx = Math.cos(angle) * velocity;
        const ty = Math.sin(angle) * velocity;

        sparkle.style.setProperty('--tx', tx + 'px');
        sparkle.style.setProperty('--ty', ty + 'px');
        sparkle.style.animationDuration = (0.6 + Math.random() * 0.8) + 's';

        sparkleContainer.appendChild(sparkle);
    }

    setTimeout(() => { sparkleContainer.remove(); }, 2000);
}
