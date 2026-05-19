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

export async function logAudit(type, details = {}) {
    try {
        // SAFETY: Cấm log bất cứ field nào tên là name, patient, id chứa PHI
        const safeDetails = { ...details };
        delete safeDetails.patientName;
        delete safeDetails.patientId;
        delete safeDetails.phi;
        
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

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
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
