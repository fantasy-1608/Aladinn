/**
 * SECURE JWT STORAGE (Closure-based)
 * Captured from HIS API calls for background authentication.
 * SECURITY: Uses randomized event channel name (set by content.js per-session)
 * to prevent other scripts from eavesdropping on the JWT token.
 */
window.JWTStore = (function () {
    let _token = null;
    // SECURITY: Read random channel name from data attribute (set by content.js)
    const _channel = document.currentScript?.dataset?.aladinnChannel || '__aladinn_token';
    let _dispatched = false;
    return {
        set: (token) => {
            _token = token;
            // SECURITY: Dispatch on random channel — only content script knows the name
            // Only dispatch once (first capture) to minimize exposure window
            if (!_dispatched) {
                window.dispatchEvent(new CustomEvent(_channel, { detail: { token } }));
                _dispatched = true;
            }
        },
        get: () => _token,
        clear: () => { _token = null; _dispatched = false; }
    };
})();
