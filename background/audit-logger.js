/**
 * Aladinn Audit Logger (v1.4.1)
 * Ghi nhận log ẩn danh, không chứa PHI. Lưu trữ IndexedDB.
 */

const DB_NAME = 'AladinnAuditDB';
const DB_VERSION = 1;
const STORE_NAME = 'audit_logs';

function openAuditDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = (e) => {
            const db = e.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
                store.createIndex('type', 'type', { unique: false });
                store.createIndex('timestamp', 'timestamp', { unique: false });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

const SENSITIVE_KEYS = new Set([
    'HOTENBENTHAN', 'HOTEN', 'TEN_BENHNHAN', 'patientName', 'TENBENHNHAN',
    'SOBHYT', 'SOTHE', 'SOCMND', 'SOCCCD', 'DIENTHOAI', 'DIACHI',
    'apiKey', 'geminiApiKey', 'api_key', 'pin', 'password',
    'cookie', 'session', 'jwt', 'token', 'patientId', 'phi'
]);

function _sanitizeString(text) {
    if (typeof text !== 'string') return text;
    text = text.replace(/AIza[A-Za-z0-9_-]{30,}/g, '[API_KEY]');
    text = text.replace(/[A-Z]{2}\d{13}/g, '[BHYT]');
    text = text.replace(/\b\d{12}\b/g, '[CCCD]');
    text = text.replace(/\b\d{9}\b/g, '[CMND]');
    text = text.replace(/(?:0|\+84)\d{9,10}/g, '[PHONE]');
    text = text.replace(/(cookie|session|jwt|token)[=:]\s*[A-Za-z0-9._-]{20,}/gi, '$1=[TOKEN]');
    return text;
}

function _sanitizeObject(obj) {
    if (Array.isArray(obj)) {
        return obj.map(item => _sanitizeObject(item));
    }
    if (obj && typeof obj === 'object') {
        const clone = {};
        for (const key of Object.keys(obj)) {
            if (SENSITIVE_KEYS.has(key)) {
                clone[key] = '[REDACTED]';
            } else if (typeof obj[key] === 'string') {
                clone[key] = _sanitizeString(obj[key]);
            } else if (typeof obj[key] === 'object' && obj[key] !== null) {
                clone[key] = _sanitizeObject(obj[key]);
            } else {
                clone[key] = obj[key];
            }
        }
        return clone;
    }
    return obj;
}

export async function logAudit(type, details = {}) {
    try {
        const safeDetails = _sanitizeObject(details);
        
        const record = {
            timestamp: new Date().toISOString(),
            type: type, // 'cds_alert', 'patient_mismatch', 'auto_fill_blocked', 'ai_schema_error', 'phi_redaction', 'api_error'
            details: safeDetails
        };
        
        const db = await openAuditDB();
        const tx = db.transaction(STORE_NAME, 'readwrite');
        tx.objectStore(STORE_NAME).add(record);
        
        return new Promise((resolve, reject) => {
            tx.oncomplete = () => resolve(true);
            tx.onerror = () => reject(tx.error);
        });
    } catch (e) {
        console.error('[AuditLogger] Failed to log:', e);
        return false;
    }
}

export async function exportAuditCsv() {
    try {
        const db = await openAuditDB();
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        
        return new Promise((resolve, reject) => {
            const request = store.getAll();
            request.onsuccess = () => {
                const logs = request.result;
                if (!logs || logs.length === 0) {
                    resolve('');
                    return;
                }
                
                let csv = 'ID,Timestamp,Type,Details\n';
                logs.forEach(log => {
                    const detailsStr = JSON.stringify(log.details || {}).replace(/"/g, '""');
                    csv += `${log.id},${log.timestamp},${log.type},"${detailsStr}"\n`;
                });
                
                resolve(csv);
            };
            request.onerror = () => reject(request.error);
        });
    } catch (e) {
        console.error('[AuditLogger] Export failed:', e);
        return '';
    }
}

// [P0-SEC-003] SECURITY: Validate sender — chỉ chấp nhận message từ chính extension này
// và từ các trang hợp lệ (extension pages hoặc vncare.vn)
function _isValidAuditSender(sender) {
    if (sender.id !== chrome.runtime.id) return false;
    const senderUrl = sender.tab?.url || sender.url || '';
    if (senderUrl.startsWith(`chrome-extension://${chrome.runtime.id}/`)) return true;
    if (sender.tab?.url && !sender.tab.url.match(/^https?:\/\/[^/]*\.vncare\.vn\//)) return false;
    return true;
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    // SECURITY: Reject unauthorized senders
    if (!_isValidAuditSender(sender)) {
        sendResponse({ success: false, error: 'UNAUTHORIZED_SENDER' });
        return false;
    }

    if (request.type === 'LOG_AUDIT') {
        logAudit(request.auditType, request.details).then(success => {
            sendResponse({ success });
        });
        return true;
    } else if (request.type === 'EXPORT_AUDIT_CSV') {
        exportAuditCsv().then(csv => {
            sendResponse({ csv });
        });
        return true;
    }
});

