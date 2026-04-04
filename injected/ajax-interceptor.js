/**
 * AJAX Interceptor
 * Intercepts jQuery.ajax calls to capture tokens and implement retry logic.
 */
(function () {
    const _$ = window['$'] || window['jQuery'];
    if (!_$ || !_$.ajax) return;

    const originalAjax = _$.ajax;
    const RETRY_CONFIG = {
        maxRetries: 3,
        baseDelayMs: 500
    };

    _$.ajax = function (options) {
        const success = options.success;
        const error = options.error;
        const currentAttempt = options._vnptRetryAttempt || 0;

        // 1. Token Capture
        if (options.data) {
            try {
                const dataStr = typeof options.data === 'string' ? options.data : JSON.stringify(options.data);
                if (dataStr.includes('"uuid"')) {
                    const parsed = JSON.parse(dataStr);
                    if (parsed.uuid && parsed.uuid.startsWith('ey') && window.JWTStore) {
                        window.JWTStore.set(parsed.uuid);
                    }
                }
            } catch (e) { }
        }

        // 2. Wrap Callbacks
        options.success = function (data, textStatus, jqXHR) {
            if (success) success.apply(this, arguments);
        };

        options.error = function (jqXHR, textStatus, errorThrown) {
            const shouldRetry = (textStatus === 'timeout' || textStatus === 'error' || jqXHR.status >= 500);
            if (shouldRetry && currentAttempt < RETRY_CONFIG.maxRetries) {
                const delay = RETRY_CONFIG.baseDelayMs * Math.pow(2, currentAttempt);
                setTimeout(() => {
                    const retryOptions = _$.extend(true, {}, options);
                    retryOptions._vnptRetryAttempt = currentAttempt + 1;
                    originalAjax.call(_$, retryOptions);
                }, delay);
            } else {
                if (error) error.apply(this, arguments);
            }
        };

        try {
            return originalAjax.apply(this, arguments);
        } catch (e) {
            if (error) error.call(this, { status: 0 }, 'error', e.message);
            return null;
        }
    };
})();
