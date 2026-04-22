/**
 * 🧞 Aladinn CDS — Entry Point
 * Chỉ kích hoạt khi mở form Kê đơn (iframe phiếu thuốc).
 * Tự dừng khi đóng modal.
 */

import { initializeKnowledgeBase, importCrawledDrugs, getCrawlMetadata } from './db.js';
import { CDSExtractor } from './extractor.js';
import { analyzeLocally } from './engine.js';
import { CDSUI } from './ui.js';

console.log('[Aladinn CDS] 📦 Module loaded.');

let isCDSEnabled = true;
let filterLow = true;
let isKBLoaded = false;
let scanTimer = null;
let modalObserver = null;
let lastScanHash = '';
let isModalOpen = false;

// ===== CORE SCAN =====
async function runScan() {
    if (!isCDSEnabled || !isKBLoaded) return;

    try {
        const context = await CDSExtractor.extractContext();
        
        // Hash cache — bỏ qua nếu dữ liệu không đổi (GỘP CẢ PATIENT ID + LABS để đồng bộ khi đổi BN)
        const currentHash = (context.patient?.id || '') + '$$'
            + context.medications.map(m => m.display_name).sort().join('|') 
            + '||' + context.encounter.diagnoses.map(d => d.code).sort().join('|')
            + '||labs:' + context.labs.map(l => l.code + '=' + l.value).sort().join('|');
        
        if (currentHash === lastScanHash) return;
        lastScanHash = currentHash;

        console.log('[Aladinn CDS] 🔍 Scan:', JSON.stringify({
            meds: context.medications.length,
            diag: context.encounter.diagnoses.length,
            labs: context.labs.length,
            medNames: context.medications.map(m => m.display_name + ' (' + (m.generic_candidate || '?') + ')'),
            icdCodes: context.encounter.diagnoses.map(d => d.code),
            labCodes: context.labs.map(l => l.code + '=' + l.value)
        }));
        
        if (context.medications.length === 0) {
            CDSUI.update({ summary: { critical_count: 0, warning_count: 0, info_count: 0, total_scanned: 0 }, alerts: [], debug: { normalized_drugs: [] }, context });
            return;
        }

        const result = await analyzeLocally(context, filterLow);
        console.log('[Aladinn CDS] ✅', result.alerts.length, 'alerts, drugs:', result.debug.normalized_drugs);
        
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
function startScanning() {
    if (scanTimer) return; // Đã đang quét
    console.log('[Aladinn CDS] ▶️ Context detected — start scanning.');
    isModalOpen = true;
    lastScanHash = '';
    
    // Luôn quét 1 lần khi form/grid xuất hiện
    runScan();
    
    // NHẬN DIỆN NGỮ CẢNH: CHỈ CHẠY NGẦM LIÊN TỤC 3s NẾU ĐANG LÀ FORM KÊ ĐƠN (ĐỂ HỨNG SỰ KIỆN GÕ PHÍM)
    // CÒN NẾU LÀ TRANG "DANH SÁCH CHI TIẾT PHIẾU THUỐC" (PASSIVE), KHÔNG CHẠY NGẦM THỪA THÃI!
    let isActiveTypingForm = false;
    document.querySelectorAll('iframe').forEach(iframe => {
        if ((iframe.id || '').includes('PhieuThuoc') && iframe.getBoundingClientRect().width > 0) isActiveTypingForm = true;
    });

    if (isActiveTypingForm) {
        console.log('[Aladinn CDS] 🔄 Fast Polling Mode Enabled (3s interval)');
        scanTimer = setInterval(runScan, 3000);
    } else {
        console.log('[Aladinn CDS] 🛡️ Eco Manual Mode Enabled (Background interval disabled). Click shield to scan.');
    }
}

function stopScanning() {
    if (!isModalOpen) return;
    console.log('[Aladinn CDS] ⏹️ Context lost — stop scanning.');
    isModalOpen = false;
    
    if (scanTimer) {
        clearInterval(scanTimer);
        scanTimer = null;
    }
    lastScanHash = '';
    CDSUI.hide();
}

// Kiểm tra xem có đang ở ngữ cảnh cần quét (đang kê đơn hoặc đang xem danh sách thuốc)
function shouldEnableScanning() {
    const isVisible = (el) => {
        const rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left > -5000 && rect.top > -5000;
    };

    // 1. Tìm iframe có id chứa "TaoPhieuThuoc" (Form kê đơn)
    const iframes = document.querySelectorAll('iframe');
    for (const iframe of iframes) {
        const id = iframe.id || '';
        if ((id.includes('TaoPhieuThuoc') || id.includes('PhieuThuoc')) && isVisible(iframe)) return true;
    }
    
    // 2. Chứa bảng danh sách chi tiết phiếu thuốc
    const drugGrids = document.querySelectorAll('#grdPhieuThuoc, #gridChiTietPhieu, #grdChiTietPhieuThuoc, [id*="PhieuThuoc"]');
    for (const grid of drugGrids) {
        if (isVisible(grid)) return true;
    }
    
    // 3. Nếu có active tab Thuốc(3) (như trong icon ảnh của HIS)
    const activeTabs = document.querySelectorAll('.ui-tabs-active .ui-tabs-anchor, li.active a');
    for (const tab of activeTabs) {
        if (tab.innerText && tab.innerText.toLowerCase().includes('thuốc')) return true;
    }

    return false;
}

// ===== INIT =====
export async function initCDS(enabled = true, filter = true) {
    isCDSEnabled = enabled;
    filterLow = filter;

    if (!isCDSEnabled) {
        stopScanning();
        if (modalObserver) { modalObserver.disconnect(); modalObserver = null; }
        // Ẩn toàn bộ drawer (khiên + panel) khi tắt CDS
        const drawer = document.getElementById('aladinn-cds-drawer');
        if (drawer) drawer.style.display = 'none';
        console.log('[Aladinn CDS] 🔴 CDS disabled — UI hidden.');
        return;
    }

    // Hiện lại drawer khi bật CDS
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
            // Hiển thị ngày cập nhật data
            const meta = await getCrawlMetadata();
            CDSUI.showCrawlDate(meta);
        } catch (err) {
            console.error('[Aladinn CDS] 💥 UI init failed:', err);
            return;
        }
    }

    // MutationObserver: theo dõi khi iframe phiếu thuốc xuất hiện/biến mất
    if (modalObserver) modalObserver.disconnect();
    
    modalObserver = new MutationObserver(() => {
        const modalNow = shouldEnableScanning();
        if (modalNow && !isModalOpen) {
            startScanning();
        } else if (!modalNow && isModalOpen) {
            stopScanning();
        }
    });
    
    modalObserver.observe(document.body, { childList: true, subtree: true });

    // Kiểm tra ngay — phòng trường hợp form đã mở sẵn khi init
    if (shouldEnableScanning()) {
        startScanning();
    } else {
        console.log('[Aladinn CDS] 💤 Waiting for prescribing context...');
    }
}

// Bắt sự kiện tải lại database
window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'FORCE_CDS_SYNC') {
        await initializeKnowledgeBase(true);
        if (isModalOpen) {
            lastScanHash = ''; // Ép quét lại dù hash không đổi
            runScan();
        }
    }
});

// Bắt sự kiện user click vào cái khiên (chủ động gọi quét tay)
window.addEventListener('ALADINN_MANUAL_SCAN', () => {
    console.log('[Aladinn CDS] 🛡️ Manual scan triggered by user click!');
    if (isModalOpen) {
        lastScanHash = ''; // Reset hash để chắc chắn hàm báo cáo UI cập nhật lại
        runScan();
    }
});

// Bắt sự kiện Cache Snooping (Chỉ có khi Bypass DOM thành công báo về dữ liệu mới)
window.addEventListener('ALADINN_CACHE_UPDATED', () => {
    if (isModalOpen && isCDSEnabled) {
        console.log('[Aladinn CDS] ⚡ Fast rescan triggered by Data Snooping Cache!');
        runScan();
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
        
        // Cập nhật footer hiển thị ngày import
        CDSUI.updateCrawlInfo(result);
        
        // Force rescan với data mới
        lastScanHash = '';
        if (isModalOpen) runScan();
        
        // Thông báo thành công qua event ngược lại cho bookmarklet
        window.dispatchEvent(new CustomEvent('ALADINN_IMPORT_COMPLETE', {
            detail: result
        }));
        
        console.log('[Aladinn CDS] ✅ Import thành công:', result);
    } catch (err) {
        console.error('[Aladinn CDS] 💥 Import thất bại:', err);
        window.dispatchEvent(new CustomEvent('ALADINN_IMPORT_COMPLETE', {
            detail: { error: err.message }
        }));
    }
});

window.Aladinn = window.Aladinn || {};
window.Aladinn.CDS = {
    init: initCDS,
    analyzeLocally: analyzeLocally
};
