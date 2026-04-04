(async () => {
    try {
        let kbId = '1455751';
        let params = JSON.stringify({ 'KHAMBENHID': kbId });
        let fn = jsonrpc.AjaxJson.ajaxCALL_SP_0 ? 'ajaxCALL_SP_0' : 'ajaxCALL_SP_O';
        let r1 = jsonrpc.AjaxJson[fn]('NT.006', params, 0);
        let d1 = JSON.parse(r1 || '[]');
        console.log('NT.006 data:', d1);
        let r2 = jsonrpc.AjaxJson[fn]('NT.005', kbId, 0);
        console.log('NT.005 data:', JSON.parse(r2 || '[]'));
    } catch (_e) {
        console.error('API Error:', e);
    }
})();
