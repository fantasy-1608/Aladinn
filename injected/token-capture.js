/**
 * SECURE JWT STORAGE (Closure-based)
 * Captured from HIS API calls for background authentication.
 * SECURITY: Only communicates via chrome.runtime.sendMessage (not postMessage)
 */
window.JWTStore = (function () {
    let _token = null;
    return {
        set: (token) => {
            _token = token;
            // SECURITY: Use a custom event that only the extension's content script listens to
            // instead of window.postMessage which any page script can intercept
            window.dispatchEvent(new CustomEvent('__aladinn_token', { detail: { token } }));
        },
        get: () => _token,
        clear: () => { _token = null; }
    };
})();
