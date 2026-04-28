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
/* global deriveBgKeyFromPin, bgDecryptApiKey */ // defined in ai-client.js via globalThis
// Import self-update checker
import { checkForUpdate, scheduleUpdateCheck, dismissUpdate, getCurrentVersion } from './updater.js';

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
    // Lên lịch kiểm tra update
    scheduleUpdateCheck();
});

chrome.runtime.onStartup.addListener(() => {
    updateBadge(true);
    // Lên lịch kiểm tra update khi browser khởi động
    scheduleUpdateCheck();
});

// Alarm listener cho update checker
chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'aladinn-update-check') {
        checkForUpdate();
    }
});

// Initial badge + legacy cleanup
chrome.storage.local.get(['aladinn_voice_enabled', 'geminiBaseUrl'], (result) => {
    updateBadge(result.aladinn_voice_enabled !== false);
    if (result.geminiBaseUrl && result.geminiBaseUrl.includes('ngrok')) {
        chrome.storage.local.remove('geminiBaseUrl');
    }
});

// SECURITY: Auto-purge legacy plaintext API key if encrypted version exists
chrome.storage.local.get(['geminiApiKey', 'geminiApiKey_encrypted'], (result) => {
    if (result.geminiApiKey_encrypted && result.geminiApiKey) {
        chrome.storage.local.remove('geminiApiKey');
        console.log('[Aladinn Security] 🧹 Purged legacy plaintext API key (encrypted version exists)');
    }
});



// ========================================
// BADGE HELPER
// ========================================
function updateBadge(_isEnabled) {
    chrome.action.setBadgeText({ text: '' });
}

// ========================================
// SIGN MODULE: Auto-Sign State & PDF Switch-Back
// ========================================
let autoSignEnabled = false;
let lastActiveTabId = null; // Track the tab user was on before PDF opened

// Track active tab changes to remember the "previous" (non-PDF) tab
chrome.tabs.onActivated.addListener((activeInfo) => {
    chrome.tabs.get(activeInfo.tabId, (tab) => {
        if (chrome.runtime.lastError || !tab?.url) return;
        // Only remember non-PDF tabs as "previous"
        const isPdf = tab.url.includes('blob:') || tab.url.includes('.pdf') ||
            tab.url.includes('pdf-viewer') || tab.url.includes('PrintPreview');
        if (!isPdf) {
            lastActiveTabId = activeInfo.tabId;
        }
    });
});

function switchBackFromPdfTab(_pdfTabId) {
    // Switch focus back to the last non-PDF tab
    if (lastActiveTabId != null) {
        chrome.tabs.update(lastActiveTabId, { active: true }).catch(() => { });
    }
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

// NOTE: Auto-click polling đã được xóa khỏi background.
// auto-click-helper.js (content script) xử lý auto-click trực tiếp trong page.
// Background chỉ giữ autoClickInTab() cho on-demand use (action: autoClickInAllFrames).

// NOTE: autoSignEnabled starts as FALSE and is ONLY set to TRUE by
// the content script sending 'enableAutoSign' during an active signing session.
// Previously this was also set from feature flags on startup, causing unwanted
// tab-switching whenever ANY PDF opened — even without a signing session.

// ========================================
// SECURITY: Sender validation helper
// ========================================
function isValidSender(sender) {
    // Only accept messages from this extension
    if (sender.id !== chrome.runtime.id) return false;
    // If from a tab, must be on vncare.vn domain
    if (sender.tab?.url && !sender.tab.url.match(/^https?:\/\/[^/]*\.vncare\.vn\//)) return false;
    return true;
}

// SECURITY: Whitelist for GET_SETTINGS / SET_SETTINGS
const SETTINGS_READ_WHITELIST = [
    'aladinn_voice_settings', 'aladinn_voice_enabled',
    'selectedModel', 'geminiBaseUrl', 'aladinn_features'
];
const SETTINGS_WRITE_WHITELIST = [
    'aladinn_voice_settings', 'aladinn_voice_enabled',
    'selectedModel', 'geminiBaseUrl', 'aladinn_features',
    'aladinn_voice_appSettings'
];

// ========================================
// UNIFIED MESSAGE HANDLER (single listener — fixes race conditions)
// ========================================
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    // SECURITY: Validate sender for all messages
    if (!isValidSender(sender)) {
        sendResponse({ ok: false, error: 'UNAUTHORIZED_SENDER' });
        return false;
    }

    const { type, action, requestId, payload } = message;

    // ---- SESSION PIN CACHING (derive key immediately, purge PIN) ----
    if (type === 'CACHE_SESSION_PIN') {
        const pin = payload?.pin || '';
        if (pin) {
            // Derive CryptoKey in background memory, then purge PIN from session
            deriveBgKeyFromPin(pin).then(() => {
                // PIN is now only in the derived key (non-extractable)
                sendResponse({ ok: true });
            }).catch(() => {
                sendResponse({ ok: false, error: 'KEY_DERIVATION_FAILED' });
            });
            return true; // async
        }
        sendResponse({ ok: true });
        return false;
    }

    // ---- UPDATE CHECKER ----
    if (action === 'checkUpdate') {
        checkForUpdate().then(info => {
            sendResponse({ update: info, currentVersion: getCurrentVersion() });
        });
        return true; // async
    }
    if (action === 'dismissUpdate') {
        dismissUpdate(message.version).then(() => {
            sendResponse({ ok: true });
        });
        return true;
    }

    // ---- BACKGROUND DECRYPT API KEY (content scripts ask background to decrypt) ----
    if (type === 'GET_SESSION_PIN' || type === 'BG_DECRYPT_API_KEY') {
        // Instead of returning PIN, decrypt API key in background and return it
        bgDecryptApiKey().then(apiKey => {
            sendResponse({ ok: true, apiKey: apiKey || '' });
        }).catch(() => {
            sendResponse({ ok: false, apiKey: '' });
        });
        return true; // async response
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

    // ---- VOICE MODULE: Settings (SECURITY: whitelist keys) ----
    if (type === 'GET_SETTINGS') {
        const requestedKeys = payload?.keys || SETTINGS_READ_WHITELIST;
        // Filter to only whitelisted keys — never expose geminiApiKey etc via messages
        const safeKeys = requestedKeys.filter(k => SETTINGS_READ_WHITELIST.includes(k));
        chrome.storage.local.get(safeKeys, (result) => {
            sendResponse({ ok: true, requestId, data: result });
        });
        return true;
    }

    if (type === 'SET_SETTINGS') {
        const patch = payload?.settings || {};
        // Filter to only whitelisted keys
        const safePatch = {};
        for (const key of Object.keys(patch)) {
            if (SETTINGS_WRITE_WHITELIST.includes(key)) {
                safePatch[key] = patch[key];
            }
        }
        chrome.storage.local.set(safePatch, () => {
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
                chrome.tabs.sendMessage(t.id, { type: 'TOGGLE_EXTENSION', enabled: newState }).catch(() => { });
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

    // ---- FEATURE TOGGLE: Sync auto-sign state from popup ----
    // Only DISABLE auto-sign when sign module is turned off.
    // Never enable it here — only 'enableAutoSign' from signing.js should do that.
    if (type === 'FEATURE_TOGGLE') {
        const features = message.features || {};
        const signEnabled = features.sign !== false;
        if (!signEnabled && autoSignEnabled) {
            autoSignEnabled = false;
            console.log('[Aladinn BG] Sign module disabled → auto-sign OFF');
        }
        // Don't sendResponse here — let content.js handler respond
        return false;
    }

    // ---- SIGN MODULE: Auto-Sign Control ----
    if (action === 'enableAutoSign') {
        autoSignEnabled = true;
        sendResponse({ ok: true });
        return false;
    }

    if (action === 'disableAutoSign') {
        autoSignEnabled = false;
        sendResponse({ ok: true });
        return false;
    }

    if (action === 'closePdfTab') {
        // Instead of closing PDF tabs, switch back to previous tab
        chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
            const tab = tabs?.[0];
            if (tab) switchBackFromPdfTab(tab.id);
        });
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
            }).catch(() => { });
        }
        sendResponse({ ok: true });
        return false;
    }

    return false;
});

// Auto switch-back from PDF preview tabs when auto-sign is active
// (Instead of closing PDF tabs, just switch focus back to the HIS tab)
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (!autoSignEnabled) return;
    if (changeInfo.status === 'complete' && tab.url) {
        if (tab.url.includes('blob:') || tab.url.includes('.pdf') ||
            tab.url.includes('PrintPreview') || tab.url.includes('pdf-viewer')) {
            setTimeout(() => switchBackFromPdfTab(tabId), 500);
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
            // SECURITY: Wipe in-memory derived key and session PIN
            globalThis._bgCachedKey = null;
            globalThis._bgCachedSalt = null;
            if (chrome.storage.session) {
                chrome.storage.session.remove('_sessionPIN');
            }
            // Notify content scripts to clear in-memory API key caches
            chrome.tabs.sendMessage(tabId, { type: 'SESSION_LOGOUT' }).catch(() => { });
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
            }).catch(() => { });
        });
    } else if (command === 'start-signing') {
        chrome.tabs.sendMessage(tabId, { action: 'startSigning' }).catch(() => { });
    } else if (command === 'next-patient') {
        chrome.tabs.sendMessage(tabId, { action: 'nextPatient' }).catch(() => { });
    }
});
