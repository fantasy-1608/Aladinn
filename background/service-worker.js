/**
 * 🧞 Aladinn — Unified Background Service Worker
 * Combines logic from: HisPro, VNPT_HIS_Scanner, SignHis
 * 
 * Handles:
 * - AI requests (Voice module)
 * - Auto-sign & PDF close (Sign module)
 * - Keyboard shortcuts (Sign module)
 * - Badge management
 * - Feature toggle
 */

// Import AI client
import { requestAI, cancelRequest } from './ai-client.js';

// ========================================
// INSTALLATION & STARTUP
// ========================================
chrome.runtime.onInstalled.addListener((details) => {
    if (details.reason === 'install') {
        chrome.storage.local.set({
            aladinn_features: { voice: true, scanner: true, sign: true },
            aladinn_voice_enabled: true,
            aladinn_voice_settings: { language: 'vi-VN', autoProcess: false, theme: 'dark' }
        });
    }
    updateBadge(true);
});

chrome.runtime.onStartup.addListener(() => {
    chrome.storage.local.get('aladinn_voice_enabled', (result) => {
        updateBadge(result.aladinn_voice_enabled !== false);
    });
});

// Initial badge + legacy cleanup
chrome.storage.local.get(['aladinn_voice_enabled', 'geminiBaseUrl'], (result) => {
    updateBadge(result.aladinn_voice_enabled !== false);
    if (result.geminiBaseUrl && result.geminiBaseUrl.includes('ngrok')) {
        chrome.storage.local.remove('geminiBaseUrl');
    }
});



// ========================================
// BADGE HELPER
// ========================================
function updateBadge(isEnabled) {
    chrome.action.setBadgeText({ text: '' });
}

// ========================================
// SIGN MODULE: Auto-Sign State & PDF Close
// ========================================
let autoSignEnabled = false;

function closePdfPreviewTabs() {
    chrome.tabs.query({}, (tabs) => {
        for (const tab of tabs) {
            if (tab.url && (
                tab.url.includes('blob:') ||
                tab.url.includes('.pdf') ||
                tab.url.includes('pdf-viewer') ||
                tab.url.includes('PrintPreview')
            )) {
                chrome.tabs.remove(tab.id).catch(() => {});
            }
        }
    });
}

/**
 * Inject auto-click code into ALL frames of the given tab.
 * Uses chrome.scripting.executeScript which can reach frames that
 * content scripts cannot (depending on host_permissions).
 */
function autoClickInTab(tabId) {
    chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        func: () => {
            // Click #btnConfirm if visible
            const confirmBtn = document.getElementById('btnConfirm');
            if (confirmBtn && confirmBtn.offsetWidth > 0 && confirmBtn.offsetHeight > 0) {
                confirmBtn.click();
                return 'clicked-confirm';
            }
            // Click #alertify-ok if visible
            const okBtn = document.getElementById('alertify-ok');
            if (okBtn && okBtn.offsetWidth > 0 && okBtn.offsetHeight > 0) {
                okBtn.click();
                return 'clicked-ok';
            }
            // Also check by class
            const alertifyBtn = document.querySelector('.alertify-button-ok');
            if (alertifyBtn && alertifyBtn.offsetWidth > 0 && alertifyBtn.offsetHeight > 0) {
                alertifyBtn.click();
                return 'clicked-alertify';
            }
            return null;
        }
    }).then(results => {
        const clicked = results?.find(r => r.result);
        if (clicked) {
            console.log('[Aladinn BG] Auto-click result:', clicked.result);
        }
    }).catch(() => { /* tab may have been closed */ });
}

// Periodically auto-click when auto-sign is enabled
let autoClickInterval = null;
function startAutoClickLoop() {
    if (autoClickInterval) return;
    autoClickInterval = setInterval(() => {
        if (!autoSignEnabled) {
            clearInterval(autoClickInterval);
            autoClickInterval = null;
            return;
        }
        // Find the active vncare.vn tab and inject
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs?.[0];
            if (tab?.url?.includes('vncare.vn')) {
                autoClickInTab(tab.id);
            }
        });
    }, 500);
}

// Always enable auto-click on startup (for manual signing support)
autoSignEnabled = true;
setTimeout(() => startAutoClickLoop(), 2000);

// ========================================
// UNIFIED MESSAGE HANDLER (single listener — fixes race conditions)
// ========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const { type, action, requestId, payload } = message;

    // ---- SESSION PIN CACHING (for background API key decryption) ----
    if (type === 'CACHE_SESSION_PIN') {
        if (chrome.storage.session) {
            chrome.storage.session.set({ _sessionPIN: payload?.pin || '' });
        }
        sendResponse({ ok: true });
        return false;
    }

    // ---- SESSION PIN RETRIEVAL (for content scripts that cannot access chrome.storage.session) ----
    if (type === 'GET_SESSION_PIN') {
        if (chrome.storage.session) {
            chrome.storage.session.get('_sessionPIN', (result) => {
                sendResponse({ ok: true, pin: result?._sessionPIN || '' });
            });
            return true; // async response
        }
        sendResponse({ ok: false, pin: '' });
        return false;
    }

    // ---- VOICE MODULE: AI Request ----
    if (type === 'AI_REQUEST') {
        const aiPayload = payload || {};
        requestAI({
            text: aiPayload.text,
            model: aiPayload.model,
            requestId: aiPayload.requestId
        })
            .then(data => sendResponse({ ok: true, requestId, data }))
            .catch(err => sendResponse({ ok: false, requestId, error: { code: 'AI_ERROR', message: err.message } }));
        return true;
    }

    if (type === 'AI_CANCEL') {
        const cancelled = cancelRequest(payload?.requestId);
        sendResponse({ ok: true, requestId, data: { cancelled } });
        return false;
    }

    // ---- VOICE MODULE: Settings ----
    if (type === 'GET_SETTINGS') {
        const keys = payload?.keys || ['aladinn_voice_settings', 'aladinn_voice_enabled', 'geminiApiKey', 'selectedModel', 'geminiBaseUrl', 'aladinn_features'];
        chrome.storage.local.get(keys, (result) => {
            sendResponse({ ok: true, requestId, data: result });
        });
        return true;
    }

    if (type === 'SET_SETTINGS') {
        const patch = payload?.settings || {};
        chrome.storage.local.set(patch, () => {
            sendResponse({ ok: true, requestId, data: { saved: true } });
        });
        return true;
    }

    // ---- VOICE MODULE: Legacy ----
    if (type === 'GET_TAB_INFO') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            sendResponse({ tab: tabs[0] });
        });
        return true;
    }

    if (type === 'FILL_FIELD') {
        chrome.tabs.sendMessage(message.tabId, {
            type: 'FILL_FIELD',
            fieldKey: message.fieldKey,
            value: message.value
        }, (response) => sendResponse(response));
        return true;
    }

    if (type === 'PAGE_READY') {
        chrome.storage.local.get('aladinn_voice_enabled', (result) => {
            updateBadge(result.aladinn_voice_enabled !== false);
        });
        return false;
    }

    if (type === 'OPEN_OPTIONS') {
        chrome.runtime.openOptionsPage();
        return false;
    }

    // ---- VOICE MODULE: Toggle Extension ----
    if (type === 'TOGGLE_VOICE') {
        const newState = message.enabled;
        chrome.storage.local.set({ aladinn_voice_enabled: newState }, async () => {
            updateBadge(newState);
            const tabs = await chrome.tabs.query({ url: '*://*.vncare.vn/*' });
            for (const t of tabs) {
                chrome.tabs.sendMessage(t.id, { type: 'TOGGLE_EXTENSION', enabled: newState }).catch(() => {});
            }
            sendResponse({ ok: true, enabled: newState });
        });
        return true;
    }

    // ---- SCANNER MODULE: UI Toggle ----
    if (action === 'TOGGLE_SCANNER_UI' || action === 'UPDATE_SETTINGS') {
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            if (tabs[0]) {
                chrome.tabs.sendMessage(tabs[0].id, message, (response) => {
                    sendResponse(response);
                });
            }
        });
        return true;
    }

    // ---- SIGN MODULE: Auto-Sign Control ----
    if (action === 'enableAutoSign') {
        autoSignEnabled = true;
        startAutoClickLoop();
        sendResponse({ ok: true });
        return false;
    }

    if (action === 'disableAutoSign') {
        autoSignEnabled = false;
        sendResponse({ ok: true });
        return false;
    }

    if (action === 'closePdfTab') {
        closePdfPreviewTabs();
        sendResponse({ ok: true });
        return false;
    }

    // Auto-click: inject click script into ALL frames of the sender tab
    if (action === 'autoClickInAllFrames') {
        const tabId = sender?.tab?.id;
        if (tabId) {
            autoClickInTab(tabId);
        }
        sendResponse({ ok: true });
        return false;
    }

    if (action === 'setSelarrrow') {
        const tabId = sender?.tab?.id;
        if (tabId && message.rowIds) {
            chrome.scripting.executeScript({
                target: { tabId },
                world: 'MAIN',
                func: (ids) => {
                    const grid = document.querySelector('#grdBenhNhan');
                    if (grid && grid.p) {
                        grid.p.selarrrow = ids;
                    }
                },
                args: [message.rowIds]
            }).catch(() => {});
        }
        sendResponse({ ok: true });
        return false;
    }

    return false;
});

// Auto-close PDF preview tabs when auto-sign is active
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!autoSignEnabled) return;
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('blob:') || tab.url.includes('.pdf') ||
            tab.url.includes('PrintPreview') || tab.url.includes('pdf-viewer')) {
            setTimeout(() => chrome.tabs.remove(tabId).catch(() => {}), 500);
        }
    }
});

// ========================================
// SECURITY: Session Logout Detection & Cache Purge
// Prevents cross-user data leakage on shared hospital terminals.
// ========================================
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status !== 'complete' || !tab.url) return;
    // Detect HIS logout patterns
    const url = tab.url.toLowerCase();
    if (url.includes('login.jsp') || url.includes('logout') || url.includes('dangxuat') || url.includes('dang-xuat')) {
        // Only act if the tab was on the HIS domain
        if (url.includes('vncare.vn')) {
            console.log('[Aladinn Security] 🔒 HIS logout detected — purging all cached patient data.');
            // Remove sensitive patient/AI data from local storage
            chrome.storage.local.remove([
                'transcript', 'results', 'ai_audit_logs',
                'vnpt_scan_results', 'vnpt_error_logs'
            ]);
            // Clear session PIN so AI Key cannot be decrypted without re-auth
            if (chrome.storage.session) {
                chrome.storage.session.remove('_sessionPIN');
            }
            // Notify content scripts to clear in-memory API key caches
            chrome.tabs.sendMessage(tabId, { type: 'SESSION_LOGOUT' }).catch(() => {});
        }
    }
});

// ========================================
// KEYBOARD SHORTCUTS (Sign + Filter)
// ========================================
chrome.commands.onCommand.addListener(async (command) => {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tabs[0] || !tabs[0].url?.includes('vncare.vn')) return;
    const tabId = tabs[0].id;

    if (command === 'quick-filter') {
        chrome.storage.sync.get(['userName', 'userId'], (result) => {
            chrome.tabs.sendMessage(tabId, {
                action: 'filterByCreator',
                userName: result.userName || '',
                userId: result.userId || ''
            }).catch(() => {});
        });
    } else if (command === 'start-signing') {
        chrome.tabs.sendMessage(tabId, { action: 'startSigning' }).catch(() => {});
    } else if (command === 'next-patient') {
        chrome.tabs.sendMessage(tabId, { action: 'nextPatient' }).catch(() => {});
    }
});
