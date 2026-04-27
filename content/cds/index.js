/**
 * 🧞 Aladinn CDS — Entry Point
 * Chỉ kích hoạt khi mở form Kê đơn (iframe phiếu thuốc).
 * Tự dừng khi đóng modal.
 */

import { initializeKnowledgeBase, importCrawledDrugs, getCrawlMetadata } from './db.js';
import { CDSExtractor, CDSCacheManager } from './extractor.js';
import { analyzeLocally, runBhytAuditRules } from './engine.js';
import { CDSUI } from './ui.js';

console.log('[Aladinn CDS] 📦 Module loaded.');

let isCDSEnabled = true;
let filterLow = true;
let isKBLoaded = false;
let scanTimer = null;
let modalObserver = null;
let lastScanHash = '';
let lastScanResultString = '';
let isModalOpen = false;

// Dữ liệu được gửi từ iframe helper
let iframeDrugs = [];
let iframeDiagnoses = [];

// Tích lũy chẩn đoán PER PATIENT (an toàn: chỉ nhận từ input fields, strict textarea, API cache)
// Giải quyết: HIS unload tab Điều trị khỏi DOM khi chuyển tab → mất ICD
let patientDiagAccumulator = new Map(); // code → { code, is_primary }
let accumulatorPatientId = '';

// ===== CORE SCAN =====
async function runScan() {
    if (!isCDSEnabled || !isKBLoaded) return;

    try {
        const context = await CDSExtractor.extractContext();
        
        // Nếu có dữ liệu từ iframe helper → merge
        if (iframeDrugs.length > 0) {
            const iframeNames = new Set(iframeDrugs.map(d => d.display_name.toLowerCase()));
            const merged = [...iframeDrugs];
            for (const m of context.medications) {
                if (!iframeNames.has(m.display_name.toLowerCase())) {
                    merged.push(m);
                }
            }
            context.medications = merged;
        }

        // Nếu có ICD từ iframe helper → merge
        if (iframeDiagnoses.length > 0) {
            const iframeCodes = new Set(iframeDiagnoses.map(d => d.code));
            const merged = [...iframeDiagnoses];
            for (const d of context.encounter.diagnoses) {
                if (!iframeCodes.has(d.code)) {
                    merged.push(d);
                }
            }
            context.encounter.diagnoses = merged;
        }

        // TÍCH LŨY CHẨN ĐOÁN PER PATIENT
        // Reset khi đổi bệnh nhân
        const currentPid = context.patient?.id || context.patient?.name || '';
        if (currentPid && currentPid !== accumulatorPatientId) {
            patientDiagAccumulator = new Map();
            accumulatorPatientId = currentPid;
        }
        // Gộp chẩn đoán mới vào tích lũy
        for (const d of context.encounter.diagnoses) {
            if (!patientDiagAccumulator.has(d.code)) {
                patientDiagAccumulator.set(d.code, d);
            }
        }
        // Dùng tích lũy → tất cả ICD đã thấy bất kỳ tab nào đều được giữ
        context.encounter.diagnoses = Array.from(patientDiagAccumulator.values());

        // Hash cache — bỏ qua nếu dữ liệu không đổi
        const currentHash = (context.patient?.id || '') + '$$'
            + context.medications.map(m => m.display_name).sort().join('|') 
            + '||' + context.encounter.diagnoses.map(d => d.code).sort().join('|')
            + '||labs:' + context.labs.map(l => l.code + '=' + l.value).sort().join('|');
        
        if (currentHash === lastScanHash) return;
        lastScanHash = currentHash;

        const result = await analyzeLocally(context, filterLow);
        
        // CHỐNG NHẢY LUNG TUNG: Chỉ update nếu alert thực sự thay đổi
        const resultString = JSON.stringify(result.alerts) + '||' + context.medications.length;
        if (resultString === lastScanResultString) return;
        lastScanResultString = resultString;

        console.log('[Aladinn CDS] ✅', result.alerts.length, 'alerts,', context.medications.length, 'drugs.');
        
        const critical_count = result.alerts.filter(a => a.severity === 'high').length;
        const warning_count = result.alerts.filter(a => a.severity === 'medium').length;
        const info_count = result.alerts.filter(a => a.severity === 'low' || a.severity === 'info').length;

        CDSUI.update({
            summary: { critical_count, warning_count, info_count, total_scanned: context.medications.length },
            alerts: result.alerts,
            debug: result.debug,
            context
        });

    } catch (error) {
        console.error('[Aladinn CDS] 💥 Scan error:', error);
    }
}

// ===== MODAL LIFECYCLE =====
function startScanning(mode = 'oneshot') {
    // Nếu đang quét rồi → dừng trước khi bắt đầu lại
    if (isModalOpen) {
        stopScanning();
    }
    
    console.log('[Aladinn CDS] ▶️ Context detected — mode:', mode);
    isModalOpen = true;
    
    // RESET thuốc cũ nhưng GIỮ LẠI chẩn đoán (từ tờ điều trị/API snooping)
    lastScanHash = '';
    lastScanResultString = '';
    iframeDrugs = [];
    iframeDiagnoses = [];
    CDSCacheManager.resetMedications(); // Chỉ xóa thuốc, giữ ICD
    
    // Trì hoãn lần quét đầu 1.5s để chờ iframe helper gửi dữ liệu lên
    setTimeout(() => {
        if (!isModalOpen) return;
        runScan();
        
        if (mode === 'realtime') {
            console.log('[Aladinn CDS] 🔄 Fast Polling Mode (3s)');
            scanTimer = setInterval(runScan, 3000);
        } else {
            console.log('[Aladinn CDS] 🛡️ Oneshot Mode (no polling)');
        }
    }, 1500);
}

function stopScanning() {
    if (!isModalOpen) return;
    console.log('[Aladinn CDS] ⏹️ Context lost — stop scanning.');
    isModalOpen = false;
    iframeDrugs = [];
    iframeDiagnoses = [];
    
    if (scanTimer) {
        clearInterval(scanTimer);
        scanTimer = null;
    }
    lastScanHash = '';
    lastScanResultString = '';
    CDSUI.hide();
}

// Kiểm tra ngữ cảnh cần quét và trả về mode
function detectScanContext() {
    // 1. Tìm iframe "Tạo phiếu thuốc từ kho" (form nhập thuốc) → realtime
    let hasInputForm = false;
    const checkForInputForm = (doc) => {
        const iframes = doc.querySelectorAll('iframe');
        for (const iframe of iframes) {
            const id = (iframe.id || '').toLowerCase();
            const src = (iframe.getAttribute('src') || '').toLowerCase();
            if (id.includes('phieuthuoc') || id.includes('capthuoc') || 
                src.includes('capthuoc') || src.includes('02d010')) {
                hasInputForm = true;
                return;
            }
            try {
                if (iframe.contentDocument) checkForInputForm(iframe.contentDocument);
            } catch (_e) { /* CORS */ }
        }
    };
    checkForInputForm(document);
    if (hasInputForm) return { enabled: true, mode: 'realtime' };

    // 2. Tab Thuốc (grid phiếu thuốc đang hiển thị) → oneshot
    const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left > -5000;
    };

    const drugGrids = document.querySelectorAll('#grdPhieuThuoc, #gridChiTietPhieu, #grdChiTietPhieuThuoc, [id*="PhieuThuoc"]');
    for (const grid of drugGrids) {
        if (isVisible(grid)) return { enabled: true, mode: 'oneshot' };
    }

    const activeTabs = document.querySelectorAll('.ui-tabs-active .ui-tabs-anchor, li.active a');
    for (const tab of activeTabs) {
        const text = (tab.innerText || '').toLowerCase();
        if (text.includes('thuốc') || text.includes('điều trị')) return { enabled: true, mode: 'oneshot' };
    }

    return { enabled: false, mode: '' };
}

// ===== INIT =====
export async function initCDS(enabled = true, filter = true) {
    isCDSEnabled = enabled;
    filterLow = filter;

    if (!isCDSEnabled) {
        stopScanning();
        if (modalObserver) { modalObserver.disconnect(); modalObserver = null; }
        const drawer = document.getElementById('aladinn-cds-drawer');
        if (drawer) drawer.style.display = 'none';
        console.log('[Aladinn CDS] 🔴 CDS disabled — UI hidden.');
        return;
    }

    const drawer = document.getElementById('aladinn-cds-drawer');
    if (drawer) drawer.style.display = '';

    // Load Knowledge Base (1 lần duy nhất)
    if (!isKBLoaded) {
        try {
            console.log('[Aladinn CDS] 📦 Loading Knowledge Base...');
            await initializeKnowledgeBase();
            isKBLoaded = true;
            console.log('[Aladinn CDS] ✅ KB loaded.');
        } catch (err) {
            console.error('[Aladinn CDS] 💥 KB init failed:', err);
            return;
        }
        
        try {
            CDSUI.init();
            const meta = await getCrawlMetadata();
            CDSUI.showCrawlDate(meta);
        } catch (err) {
            console.error('[Aladinn CDS] 💥 UI init failed:', err);
            return;
        }
    }

    // MutationObserver: bắt nhanh khi jBox mở ở top frame
    if (modalObserver) modalObserver.disconnect();
    
    modalObserver = new MutationObserver(() => {
        const ctx = detectScanContext();
        if (ctx.enabled && !isModalOpen) {
            startScanning(ctx.mode);
        } else if (!ctx.enabled && isModalOpen) {
            stopScanning();
        }
    });
    
    modalObserver.observe(document.body, { childList: true, subtree: true });

    // setInterval fallback: bắt khi jBox mở bên trong iframe lồng (ifmView, v.v.)
    // modalObserver không thể detect DOM changes trong inner frame
    if (!window._cdsScanContextInterval) {
        window._cdsScanContextInterval = setInterval(() => {
            const ctx = detectScanContext();
            if (ctx.enabled && !isModalOpen) {
                startScanning(ctx.mode);
            } else if (!ctx.enabled && isModalOpen) {
                stopScanning();
            }
        }, 1500);
    }

    // Kiểm tra ngay
    const ctx = detectScanContext();
    if (ctx.enabled) {
        startScanning(ctx.mode);
    } else {
        console.log('[Aladinn CDS] 💤 Waiting for prescribing context...');
    }
}

// ===== EVENT LISTENERS =====

// Nhận dữ liệu từ iframe helper (CDS_IFRAME_DATA: thuốc + ICD)
window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'CDS_IFRAME_DATA') {
        iframeDrugs = event.data.medications || [];
        iframeDiagnoses = event.data.diagnoses || [];
        console.log('[Aladinn CDS] 📩 Iframe:', iframeDrugs.length, 'drugs,', iframeDiagnoses.length, 'ICD codes.');
        
        // Force rescan with new data
        lastScanHash = '';
        lastScanResultString = '';
        if (isModalOpen) {
            runScan();
        }
    }
    
    // Tải lại database
    if (event.data && event.data.type === 'FORCE_CDS_SYNC') {
        await initializeKnowledgeBase(true);
        if (isModalOpen) {
            lastScanHash = '';
            lastScanResultString = '';
            runScan();
        }
    }
    
    // Nhận dữ liệu prefetch chẩn đoán
    if (event.data && event.data.type === 'PREFETCH_DIAGNOSES_RESULT') {
        const { diagnoses, patientId, khambenhId, patientName } = event.data;
        if (diagnoses && diagnoses.length > 0) {
            console.log(`[Aladinn CDS] 🚀 Prefetch success for ${patientName}:`, diagnoses.map(d => d.code).join(', '));
            CDSCacheManager.handleData({
                patientId: patientId, // Hoặc ID khác, hàm handleData tự xử lý alias
                khambenhId: khambenhId,
                diagnoses: diagnoses
            });
            // Mark as fetched so extractor doesn't fetch again
            if (patientId && khambenhId) {
                CDSExtractor._fetchedPatients.add(patientId + '_' + khambenhId);
            }
        }
    }
});

// Click khiên (quét thủ công)
window.addEventListener('ALADINN_MANUAL_SCAN', () => {
    console.log('[Aladinn CDS] 🛡️ Manual scan triggered!');
    if (isModalOpen) {
        lastScanHash = '';
        lastScanResultString = '';
        // Yêu cầu iframe helper gửi lại dữ liệu mới nhất
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(iframe => {
            try {
                iframe.contentWindow?.postMessage({ type: 'CDS_REQUEST_DRUGS' }, window.location.origin);
            } catch (_e) { /* CORS */ }
        });
        setTimeout(runScan, 200);
    }
});

// Cache Snooping
window.addEventListener('ALADINN_CACHE_UPDATED', () => {
    if (isModalOpen && isCDSEnabled) {
        console.log('[Aladinn CDS] ⚡ Fast rescan from Data Snooping!');
        lastScanHash = '';
        runScan();
    }
});

// Force Reset Cache
window.addEventListener('ALADINN_FORCE_RESET_CACHE', () => {
    iframeDrugs = [];
    lastScanHash = '';
    lastScanResultString = '';
});

// Lắng nghe chọn bệnh nhân trên grid để prefetch
document.addEventListener('click', (e) => {
    if (!isCDSEnabled) return; // Nếu CDS tắt thì không prefetch
    const tr = e.target.closest('#grdBenhNhan tr.ui-widget-content');
    if (tr && tr.id) {
        const reqId = Date.now() + Math.random();
        window.postMessage({
            type: 'REQ_PREFETCH_DIAGNOSES',
            requestId: reqId,
            rowId: tr.id,
            token: document.currentScript ? document.currentScript.getAttribute('data-aladinn-token') : (window.__ALADINN_BRIDGE_TOKEN__ || '')
        }, window.location.origin);
    }
});

// ===== TỰ ĐỘNG IMPORT DATA TỪ BOOKMARKLET CÀO THUỐC =====
window.addEventListener('ALADINN_CRAWL_RESULT', async (event) => {
    const drugs = event.detail?.drugs;
    if (!drugs || !Array.isArray(drugs) || drugs.length === 0) {
        console.warn('[Aladinn CDS] ⚠️ Nhận event CRAWL_RESULT nhưng không có dữ liệu.');
        return;
    }
    
    console.log(`[Aladinn CDS] 📥 Nhận ${drugs.length} thuốc từ bookmarklet — đang import...`);
    
    try {
        const result = await importCrawledDrugs(drugs);
        CDSUI.updateCrawlInfo(result);
        
        lastScanHash = '';
        lastScanResultString = '';
        if (isModalOpen) runScan();
        
        window.dispatchEvent(new CustomEvent('ALADINN_IMPORT_COMPLETE', { detail: result }));
        console.log('[Aladinn CDS] ✅ Import thành công:', result);
    } catch (err) {
        console.error('[Aladinn CDS] 💥 Import thất bại:', err);
        window.dispatchEvent(new CustomEvent('ALADINN_IMPORT_COMPLETE', {
            detail: { error: err.message }
        }));
    }
});

// Bắt sự kiện BHYT Audit (Phase 2 — on-demand)
window.addEventListener('ALADINN_BHYT_AUDIT', async () => {
    console.log('[Aladinn CDS] 🛡️ BHYT Pre-claim Audit triggered!');
    if (!isCDSEnabled || !isKBLoaded) {
        console.warn('[Aladinn CDS] ⚠️ CDS chưa sẵn sàng.');
        return;
    }
    try {
        const context = await CDSExtractor.extractContext();
        // Merge iframe drugs
        if (iframeDrugs.length > 0) {
            const iframeNames = new Set(iframeDrugs.map(d => d.display_name.toLowerCase()));
            const merged = [...iframeDrugs];
            for (const m of context.medications) {
                if (!iframeNames.has(m.display_name.toLowerCase())) {
                    merged.push(m);
                }
            }
            context.medications = merged;
        }
        const result = await runBhytAuditRules(context);
        console.log('[Aladinn CDS] 🛡️ BHYT Audit:', result.alerts.length, 'issues found');
        CDSUI.showBhytAuditResults(result);
    } catch (error) {
        console.error('[Aladinn CDS] 💥 BHYT Audit error:', error);
    }
});

window.Aladinn = window.Aladinn || {};
window.Aladinn.CDS = {
    init: initCDS,
    analyzeLocally: analyzeLocally,
    runBhytAudit: runBhytAuditRules
};
