/**
 * HIS Voice Assistant - Utils Module
 * Shared utility functions
 */

// ========================================
// Text Utilities
// ========================================

/**
 * Smartly joins text segments, avoiding double punctuation
 * @param {Array<string>} segments - List of text segments to join
 * @param {string} separator - Default separator (default: '. ')
 * @returns {string} - Joined string
 */
function smartJoin(segments, separator = '. ') {
    return segments
        .filter(s => s && s.trim())
        .map(s => s.trim().replace(/[.。,，;；\s]+$/, ''))
        .join(separator);
}

// ========================================
// Security Utilities
// ========================================

/**
 * Hash password using SHA-256 with salt (legacy — prefer HIS.Crypto.hashPIN)
 * @param {string} password - Plain text password
 * @returns {Promise<string>} - Hashed password
 */
async function hashPassword(password) {
    // Use pin_salt from storage instead of hardcoded constant
    const result = await new Promise(resolve =>
        chrome.storage.local.get(['pin_salt'], resolve)
    );
    const salt = result.pin_salt || 'aladinn_default_salt';
    const data = new TextEncoder().encode(password + salt);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Derives a CryptoKey from a PIN for AES-GCM encryption/decryption.
 * Uses per-user pin_salt from chrome.storage (same as HIS.Crypto.deriveKey).
 * @param {string} pin 
 * @returns {Promise<CryptoKey>}
 */
async function deriveKeyFromPIN(pin) {
    // Fetch per-user salt from storage (matches HIS.Crypto approach)
    const result = await new Promise(resolve =>
        chrome.storage.local.get(['pin_salt'], resolve)
    );
    const salt = result.pin_salt;
    if (!salt) {
        throw new Error('pin_salt not found in storage — cannot derive key');
    }

    const encoder = new TextEncoder();
    const pinData = encoder.encode(pin);
    const saltData = Uint8Array.from(atob(salt), c => c.charCodeAt(0));

    const baseKey = await crypto.subtle.importKey(
        'raw', pinData, 'PBKDF2', false, ['deriveKey']
    );

    return await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: saltData,
            iterations: 100000,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['encrypt', 'decrypt']
    );
}

/**
 * Encrypts data using AES-GCM
 * @param {string} text 
 * @param {CryptoKey} key 
 * @returns {Promise<string>} - format: base64(iv):base64(ciphertext)
 */
async function encryptData(text, key) {
    if (!text || !key) return text;
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(text);
    const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv: iv },
        key,
        encoded
    );

    const ivBase64 = btoa(String.fromCharCode(...iv));
    const cipherBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    return `${ivBase64}:${cipherBase64}`;
}

/**
 * Decrypts data using AES-GCM
 * @param {string} encryptedText 
 * @param {CryptoKey} key 
 * @returns {Promise<string>}
 */
async function decryptData(encryptedText, key) {
    if (!encryptedText || !key || !encryptedText.includes(':')) return encryptedText;
    try {
        const [ivBase64, cipherBase64] = encryptedText.split(':');
        const iv = new Uint8Array(atob(ivBase64).split('').map(c => c.charCodeAt(0)));
        const ciphertext = new Uint8Array(atob(cipherBase64).split('').map(c => c.charCodeAt(0)));

        const decrypted = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv: iv },
            key,
            ciphertext
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        console.error('Decryption failed:', e);
        return null;
    }
}

// ========================================
// DOM Utilities
// ========================================

function findElementInAllFrames(id, cache = null) {
    if (cache && cache.has(id)) return cache.get(id);

    const allFound = new Set();

    function searchRecursive(root) {
        if (!root) return;

        try {
            // Find by ID
            const elById = root.getElementById(id);
            if (elById) allFound.add(elById);

            // Find by Name
            const listByName = root.getElementsByName(id);
            if (listByName.length > 0) {
                for (const el of listByName) {
                    allFound.add(el);
                }
            }

            // Recursively search all iframes
            const iframes = root.querySelectorAll('iframe');
            for (const iframe of iframes) {
                try {
                    const doc = iframe.contentDocument || iframe.contentWindow.document;
                    if (doc) searchRecursive(doc);
                } catch (_e) { /* Cross-origin frame */ }
            }
        } catch (_e) { /* Restricted access */ }
    }

    // Start recursive search
    searchRecursive(document);

    const candidates = Array.from(allFound);

    // Pick the most "visible" element
    const visibleEl = candidates.find(el => {
        try {
            // High-confidence check for visibility
            const rect = el.getBoundingClientRect();
            const style = window.getComputedStyle(el);

            return (
                el.offsetParent !== null &&
                rect.width > 0 &&
                rect.height > 0 &&
                style.display !== 'none' &&
                style.visibility !== 'hidden' &&
                style.opacity !== '0'
            );
        } catch (_e) {
            return false;
        }
    });

    // Fallback to the first one found if none are clearly visible
    const result = visibleEl || candidates[0] || null;

    if (cache && result) cache.set(id, result);
    return result;
}

/**
 * Fill a form field with proper event triggering
 * @param {string} selectorId - Field ID/name
 * @param {string} value - Value to fill
 * @param {Map} [cache] - Optional cache map
 * @param {string} [highlightColor] - Highlight color (default: green)
 * @returns {boolean} - Success status
 */
function fillFormField(selectorId, value, cache = null, highlightColor = 'rgba(16, 185, 129, 0.2)') {
    if (!value) return false;
    const el = findElementInAllFrames(selectorId, cache);
    if (!el) return false;

    try {
        el.click();
        el.focus();
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));

        // Try execCommand first for better compatibility
        const doc = el.ownerDocument;
        if (doc.queryCommandSupported && doc.queryCommandSupported('insertText')) {
            doc.execCommand('insertText', false, value);
        }

        // Fallback if execCommand didn't work
        if (!el.value || el.value === '') {
            el.value = value;
        }

        // Highlight effect
        el.style.transition = 'background-color 0.3s';
        el.style.backgroundColor = highlightColor;
        setTimeout(() => {
            el.style.backgroundColor = '';
            el.classList.remove('his-field-highlight');
        }, 1500);
        el.classList.add('his-field-highlight');

        // Trigger full event cycle
        ['input', 'change', 'blur'].forEach(evtName => {
            el.dispatchEvent(new Event(evtName, { bubbles: true }));
        });

        return true;
    } catch (_e) {
        el.value = value;
        return true;
    }
}

// ========================================
// Debounce Utility
// ========================================

/**
 * Creates a debounced function
 * @param {Function} func - Function to debounce
 * @param {number} wait - Wait time in ms
 * @returns {Function} - Debounced function
 */
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// ========================================
// Global Exports (Voice Module)
// ========================================
window.smartJoin = smartJoin;
window.hashPassword = hashPassword;
window.deriveKeyFromPIN = deriveKeyFromPIN;
window.encryptData = encryptData;
window.decryptData = decryptData;
window.findElementInAllFrames = findElementInAllFrames;
window.fillFormField = fillFormField;
window.debounce = debounce;
