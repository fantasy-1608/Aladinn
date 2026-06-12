/**
 * Aladinn Role Check - Injected to bypass CSP restrictions on inline scripts.
 * Reads window.userInfo.USER_GROUP_ID to accurately identify Nurses ('5').
 */
(function() {
    var attempts = 0;
    var waitInfo = setInterval(function() {
        attempts++;
        if (window.userInfo && window.userInfo.USER_GROUP_ID) {
            clearInterval(waitInfo);
            window.postMessage({ type: 'ALADINN_ROLE_CHECK_RESULT', userGroupId: window.userInfo.USER_GROUP_ID }, window.location.origin);
        } else if (attempts >= 30) {
            clearInterval(waitInfo);
            window.postMessage({ type: 'ALADINN_ROLE_CHECK_RESULT', userGroupId: 'UNKNOWN' }, window.location.origin);
        }
    }, 100);

})();
