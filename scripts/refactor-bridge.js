const fs = require('fs');
const path = '/Users/trunganh/CNTT/Aladinn/injected/api-bridge.js';
let code = fs.readFileSync(path, 'utf8');

// 1. Convert _fetchHisPagingRows to async
code = code.replace(
    /function _fetchHisPagingRows\(queryCode, options, rows = 500, sort = ''\) \{[\s\S]*?return _parseHisRows\(xhr.responseText\);\n        \} catch \(_e\) \{\n            return \[\];\n        \}\n    \}/,
    `async function _fetchHisPagingRows(queryCode, options, rows = 500, sort = '') {
        return new Promise((resolve) => {
            try {
                const uuid = _jsonrpc?.AjaxJson?.uuid;
                if (!uuid) return resolve([]);
                const params = {
                    func: 'ajaxExecuteQueryPaging',
                    uuid,
                    params: [queryCode],
                    options
                };
                const sortPart = sort || 'sidx=&sord=desc';
                const xhr = new XMLHttpRequest();
                const url = \`/vnpthis/RestService?_search=false&rows=\${rows}&page=1&\${sortPart}&postData=\${encodeURIComponent(JSON.stringify(params))}\`;
                xhr.open('GET', url, true); // Asynchronous!
                xhr.onreadystatechange = function () {
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            resolve(_parseHisRows(xhr.responseText));
                        } else {
                            resolve([]);
                        }
                    }
                };
                xhr.send();
            } catch (_e) {
                resolve([]);
            }
        });
    }`
);

// 2. Add async wrapper for SP calls
const spAsyncWrapper = `
    async function _asyncCallSpO(sp, params, cache = 0) {
        return new Promise((resolve) => {
            try {
                // Thử dùng callback pattern của jabsorb (nếu hỗ trợ)
                _jsonrpc.AjaxJson.ajaxCALL_SP_O(function(result, err) {
                    if (err) return resolve(null);
                    resolve(result);
                }, sp, params, cache);
            } catch (e) {
                // Fallback to sync
                try {
                    const result = _jsonrpc.AjaxJson.ajaxCALL_SP_O(sp, params, cache);
                    resolve(result);
                } catch(e2) {
                    resolve(null);
                }
            }
        });
    }
`;
if (!code.includes('_asyncCallSpO')) {
    code = code.replace('function _readActiveGridCell', spAsyncWrapper + '\n    function _readActiveGridCell');
}

// 3. Make fetchPatientContextRows async
code = code.replace(
    /function fetchPatientContextRows\(rowData, rowId\) \{/,
    'async function fetchPatientContextRows(rowData, rowId) {'
);
code = code.replace(
    /const rows = _fetchHisPagingRows\('NGT02K016\.EV003', options, 50\);/g,
    'const rows = await _fetchHisPagingRows(\'NGT02K016.EV003\', options, 50);'
);

// 4. Make resolveTreatmentContext async
code = code.replace(
    /function resolveTreatmentContext\(rowData, rowId\) \{/,
    'async function resolveTreatmentContext(rowData, rowId) {'
);
code = code.replace(
    /const rows = fetchPatientContextRows\(rowData, rowId\);/,
    'const rows = await fetchPatientContextRows(rowData, rowId);'
);

// 5. Make fetchAdmissionTimes async
code = code.replace(
    /function fetchAdmissionTimes\(rowData, rowId\) \{/,
    'async function fetchAdmissionTimes(rowData, rowId) {'
);
code = code.replace(
    /const ctx = resolveTreatmentContext\(rowData, rowId\);/,
    'const ctx = await resolveTreatmentContext(rowData, rowId);'
);
code = code.replace(
    /const rows = _fetchHisPagingRows\('NTU02D021\.GET_TGVV', options, 50\);/g,
    'const rows = await _fetchHisPagingRows(\'NTU02D021.GET_TGVV\', options, 50);'
);

// 6. Make fetchNonDrugOrders async
code = code.replace(
    /function fetchNonDrugOrders\(rowData, rowId\) \{/,
    'async function fetchNonDrugOrders(rowData, rowId) {'
);
code = code.replace(
    /const ctx = resolveTreatmentContext\(rowData, rowId\);/g,
    'const ctx = await resolveTreatmentContext(rowData, rowId);'
);
code = code.replace(
    /rows = _fetchHisPagingRows\('NGT02K015\.YLENH'/g,
    'rows = await _fetchHisPagingRows(\'NGT02K015.YLENH\''
);

// 7. Make API handlers async
code = code.replace(/function fetchHistory\(rowId, requestId\) \{/, 'async function fetchHistory(rowId, requestId) {');
code = code.replace(/const result = _jsonrpc.AjaxJson.ajaxCALL_SP_O\('NT\.006\.HSBA\.HIS', params, 0\);/, 'const result = await _asyncCallSpO(\'NT.006.HSBA.HIS\', params, 0);');

code = code.replace(/function fetchRoom\(rowId, requestId\) \{/, 'async function fetchRoom(rowId, requestId) {');
code = code.replace(/const result = _jsonrpc.AjaxJson.ajaxCALL_SP_O\('NT\.005', khambenhId, 0\);/, 'const result = await _asyncCallSpO(\'NT.005\', khambenhId, 0);');

code = code.replace(/function fetchVitals\(rowId, requestId\) \{/, 'async function fetchVitals(rowId, requestId) {');
code = code.replace(
    /const trySP = \(sp, p\) => \{[\s\S]*?recs\.forEach\(accumulate\);\n                    \} catch \(_e\) \{ \}\n                \};/g,
    `const trySP = async (sp, p) => {
                    try {
                        const params = (typeof p === 'object') ? JSON.stringify(p) : p;
                        const res = await _asyncCallSpO(sp, params, 0);
                        if (!res) return;
                        const data = (typeof res === 'string' && res.trim() !== '') ? JSON.parse(res) : res;
                        const recs = Array.isArray(data) ? data : [data];
                        recs.forEach(accumulate);
                    } catch (_e) { }
                };`
);
code = code.replace(/if \(kbIdHienTai\) trySP\('NT\.006'/g, 'if (kbIdHienTai) await trySP(\'NT.006\'');
code = code.replace(/if \(\(!found\.w/g, 'if ((!found.w'); // Reset any potential mismatches
code = code.replace(/&& hosobenhanid\) trySP\('NT\.006\.HSBA\.HIS'/g, '&& hosobenhanid) await trySP(\'NT.006.HSBA.HIS\'');
code = code.replace(/&& kbIdHienTai\) trySP\('NT\.005'/g, '&& kbIdHienTai) await trySP(\'NT.005\'');

code = code.replace(/function fetchTreatment\(rowId, requestId\) \{/, 'async function fetchTreatment(rowId, requestId) {');
code = code.replace(/contextInfo = resolveTreatmentContext\(rowData, rowId\);/, 'contextInfo = await resolveTreatmentContext(rowData, rowId);');
code = code.replace(/yLenhList = fetchNonDrugOrders\(rowData, rowId\);/, 'yLenhList = await fetchNonDrugOrders(rowData, rowId);');

code = code.replace(/function fetchClinicalSummary\(rowId, requestId\) \{/, 'async function fetchClinicalSummary(rowId, requestId) {');
code = code.replace(/contextInfo = resolveTreatmentContext\(rowData, rowId\);/, 'contextInfo = await resolveTreatmentContext(rowData, rowId);');
code = code.replace(/const admissionTimes = fetchAdmissionTimes\(rowData, rowId\);/, 'const admissionTimes = await fetchAdmissionTimes(rowData, rowId);');

code = code.replace(/function fetchPatientDemographics\(rowId, requestId\) \{/, 'async function fetchPatientDemographics(rowId, requestId) {');

// Fix cases
code = code.replace(/case 'REQ_FETCH_HISTORY':\n\s*fetchHistory/g, "case 'REQ_FETCH_HISTORY':\n                fetchHistory");

fs.writeFileSync(path, code);
