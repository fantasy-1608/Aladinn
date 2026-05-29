const _originalLog = console.log;
console.log = function(...args) {
    if (window.__ALADINN_DEBUG__) {
        _originalLog.apply(console, args);
    }
};

// Khởi tạo trạng thái từ storage
if (typeof chrome !== 'undefined' && chrome.storage) {
    chrome.storage.local.get('aladinn_debug_mode', (res) => {
        window.__ALADINN_DEBUG__ = !!res.aladinn_debug_mode;
        if (window.VNPTConfig) window.VNPTConfig.DEBUG = !!res.aladinn_debug_mode;
        window.postMessage({ type: 'ALADINN_SET_DEBUG', state: !!res.aladinn_debug_mode }, window.location.origin);
    });

    // Lắng nghe thay đổi từ storage
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local' && changes.aladinn_debug_mode) {
            window.__ALADINN_DEBUG__ = changes.aladinn_debug_mode.newValue;
            if (window.VNPTConfig) window.VNPTConfig.DEBUG = changes.aladinn_debug_mode.newValue;
        }
    });
}
