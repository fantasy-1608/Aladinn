/**
 * 🧞 Aladinn CDS — Entry Point
 * Chỉ kích hoạt khi mở form Kê đơn (iframe phiếu thuốc).
 * Tự dừng khi đóng modal.
 */

import { initializeKnowledgeBase, importCrawledDrugs, getCrawlMetadata } from './db.js';
import { CDSExtractor, CDSCacheManager } from './extractor.js';
import { analyzeLocally, runBhytAuditRules, icdMatchesRequirement } from './engine.js';
import { CDSUI } from './ui.js';

console.log('[Aladinn CDS] 📦 Module loaded.');

let isCDSEnabled = true;
let filterLow = true;
let isShadowMode = false;
let isKBLoaded = false;
let scanTimer = null;
let modalObserver = null;
let lastScanHash = '';
let lastScanResultString = '';
let isModalOpen = false;
let currentScanMode = ''; // 'realtime' | 'oneshot' | ''
let drugTableObserver = null; // Phase 3: MutationObserver on active drug table
let startScanTimer = null; // Phase 4: delayed startup scan timer to prevent race conditions
let activeIframeStatuses = new Map(); // event.source (WindowProxy) -> { enabled, mode }

// Dữ liệu được gửi từ iframe helper
let iframeDrugs = [];
let iframeDiagnoses = [];
let activeKeystrokeDrug = '';

// Tích lũy chẩn đoán PER PATIENT (an toàn: chỉ nhận từ input fields, strict textarea, API cache)
// Giải quyết: HIS unload tab Điều trị khỏi DOM khi chuyển tab → mất ICD
let patientDiagAccumulator = new Map(); // code → { code, is_primary }
let accumulatorPatientId = '';

function splitIcdRequirements(value) {
    return String(value || '').split(',').map(v => v.trim().toUpperCase()).filter(Boolean);
}

function isInsuranceAlertSatisfiedByContext(alert, diagnoses) {
    if (alert?.domain !== 'insurance' || !alert.missing_icd) return false;
    const requirements = splitIcdRequirements(alert.missing_icd);
    if (requirements.length === 0) return false;
    const icdCodes = (diagnoses || []).map(d => d.code || d).filter(Boolean);
    return icdCodes.some(icd => requirements.some(req => icdMatchesRequirement(icd, req)));
}

function filterSatisfiedInsuranceAlerts(alerts, diagnoses) {
    return (alerts || []).filter(alert => !isInsuranceAlertSatisfiedByContext(alert, diagnoses));
}

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

        // Nếu có proactive keystroke drug → merge
        if (activeKeystrokeDrug) {
            const lowerKeystroke = activeKeystrokeDrug.toLowerCase();
            const exists = context.medications.some(m => m.display_name.toLowerCase() === lowerKeystroke);
            if (!exists) {
                context.medications.push({
                    display_name: activeKeystrokeDrug,
                    generic_candidate: null,
                    is_proactive: true
                });
            }
        }

        // Strict final deduplication of medications list by lowercase trimmed display_name with space normalization
        const uniqueFinalMeds = [];
        const seenFinalMeds = new Set();
        for (const m of context.medications) {
            const k = m.display_name.toLowerCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
            if (!seenFinalMeds.has(k)) {
                seenFinalMeds.add(k);
                uniqueFinalMeds.push(m);
            }
        }
        context.medications = uniqueFinalMeds;

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
        result.alerts = filterSatisfiedInsuranceAlerts(result.alerts, context.encounter.diagnoses);
        
        // CHỐNG NHẢY LUNG TUNG: Chỉ update nếu alert thực sự thay đổi
        const resultString = JSON.stringify(result.alerts) + '||' + context.medications.length;
        if (resultString === lastScanResultString) return;
        lastScanResultString = resultString;

        console.log('[Aladinn CDS] ✅', result.alerts.length, 'alerts,', context.medications.length, 'drugs.');
        
        const critical_count = result.alerts.filter(a => a.severity === 'high').length;
        const warning_count = result.alerts.filter(a => a.severity === 'medium').length;
        const info_count = result.alerts.filter(a => a.severity === 'low' || a.severity === 'info').length;

        if (critical_count > 0 || warning_count > 0) {
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({
                        type: 'LOG_AUDIT',
                        auditType: 'cds_alert',
                        details: {
                            critical: critical_count,
                            warning: warning_count,
                            rules: result.alerts.map(a => a.rule_code)
                        }
                    });
                }
            } catch (_e) {}
        }

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
    if (!isCDSEnabled || !isKBLoaded) return;

    // Nếu đang quét rồi → dừng trước khi bắt đầu lại
    if (isModalOpen) {
        stopScanning();
    }
    
    console.log('[Aladinn CDS] ▶️ Context detected — mode:', mode);
    isModalOpen = true;
    currentScanMode = mode;

    // Hiển thị khiên xanh của CDS
    const drawer = document.getElementById('aladinn-cds-drawer');
    if (drawer) {
        drawer.style.display = isShadowMode ? 'none' : '';
    }
    
    // RESET thuốc cũ nhưng GIỮ LẠI chẩn đoán (từ tờ điều trị/API snooping)
    lastScanHash = '';
    lastScanResultString = '';
    iframeDrugs = [];
    iframeDiagnoses = [];
    activeKeystrokeDrug = '';
    CDSCacheManager.resetMedications(); // Chỉ xóa thuốc, giữ ICD
    
    // Chủ động pull dữ liệu và trạng thái ngữ cảnh từ các iframe visible ngay lập tức
    sendRequestToVisibleIframes(document, 'CDS_REQUEST_DRUGS');
    
    // Trì hoãn lần quét đầu 1.5s để chờ iframe helper gửi dữ liệu lên
    clearTimeout(startScanTimer);
    startScanTimer = setTimeout(() => {
        startScanTimer = null;
        if (!isModalOpen) return;
        runScan();
        
        if (mode === 'realtime') {
            console.log('[Aladinn CDS] 🔄 Fast Polling Mode (3s)');
            scanTimer = setInterval(runScan, 3000);
        } else {
            console.log('[Aladinn CDS] 🛡️ Oneshot Mode (no polling)');
        }
        
        // Phase 3: Observe drug table DOM changes for real-time detection
        _observeDrugTables();
    }, 1500);
}

function stopScanning() {
    if (!isModalOpen) return;
    console.log('[Aladinn CDS] ⏹️ Context lost — stop scanning.');
    isModalOpen = false;
    currentScanMode = '';
    iframeDrugs = [];
    iframeDiagnoses = [];
    activeKeystrokeDrug = '';

    // Không ẩn khiên xanh khi ra ngoài ngữ cảnh kê đơn theo yêu cầu của bác sĩ
    // Khiên luôn hiển thị để đảm bảo hoạt động liên tục và tránh mất khi F5
    const drawer = document.getElementById('aladinn-cds-drawer');
    if (drawer) {
        drawer.style.display = isShadowMode ? 'none' : '';
    }
    
    if (startScanTimer) {
        clearTimeout(startScanTimer);
        startScanTimer = null;
    }
    if (scanTimer) {
        clearInterval(scanTimer);
        scanTimer = null;
    }
    if (drugTableObserver) {
        drugTableObserver.disconnect();
        drugTableObserver = null;
    }
    lastScanHash = '';
    lastScanResultString = '';
    CDSUI.hide();
}

/**
 * Phase 3: Observe DOM mutations on drug tables.
 * When rows are added/removed in the active prescription grid,
 * trigger an immediate rescan for real-time feedback.
 */
function _observeDrugTables() {
    if (drugTableObserver) drugTableObserver.disconnect();
    
    // Find drug tables in main frame and iframes
    const targets = [];
    
    // Main frame: look for drug grids
    const mainGrids = document.querySelectorAll(
        'table[id*="Thuoc"], table[id*="thuoc"], [id*="grdChiTiet"], [id*="grd_DSThuoc"]'
    );
    mainGrids.forEach(g => targets.push(g));
    
    // Also check any visible table that has "Tên thuốc" header
    document.querySelectorAll('table').forEach(table => {
        const ths = table.querySelectorAll('th');
        for (const th of ths) {
            const text = (th.innerText || '').toLowerCase();
            if (text.includes('tên thuốc') || text.includes('tên dịch vụ')) {
                targets.push(table);
                break;
            }
        }
    });
    
    if (targets.length === 0) return;
    
    let debounceTimer = null;
    drugTableObserver = new MutationObserver(() => {
        // Debounce: chờ 500ms sau mutation cuối cùng để quét
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (!isModalOpen) return;
            console.log('[Aladinn CDS] ⚡ Drug table mutation detected — rescanning...');
            lastScanHash = '';
            runScan();
        }, 500);
    });
    
    for (const target of targets) {
        drugTableObserver.observe(target, { childList: true, subtree: true });
    }
    console.log(`[Aladinn CDS] 👁️ Observing ${targets.length} drug table(s) for real-time changes`);
}

// Helper: gửi message đệ quy đến mọi iframe visible (bao gồm iframe lồng)
function sendRequestToVisibleIframes(doc, messageType) {
    const iframes = doc.querySelectorAll('iframe');
    iframes.forEach(iframe => {
        const rect = iframe.getBoundingClientRect();
        const isVisible = rect.width > 0 && rect.height > 0 && rect.left > -5000 && rect.top > -5000;
        if (!isVisible) return;
        try {
            iframe.contentWindow?.postMessage({ type: messageType }, '*');
            if (iframe.contentDocument) {
                sendRequestToVisibleIframes(iframe.contentDocument, messageType);
            }
        } catch (_e) { /* CORS */ }
    });
}

// Phác thảo kiểm tra ngữ cảnh cục bộ trên một document cụ thể (không quét đệ quy tránh CORS)
function detectLocalScanContext(doc = document, href = window.location.href) {
    const lowerUrl = href.toLowerCase();
    
    // 1. Phân hệ nhập liệu / phiếu thuốc -> realtime
    if (lowerUrl.includes('capthuoc') || lowerUrl.includes('phieuthuoc') || lowerUrl.includes('02d010')) {
        return { enabled: true, mode: 'realtime' };
    }
    
    // 2. Phân hệ phòng khám / buồng điều trị -> cần kiểm tra tab thuốc/điều trị đang hoạt động
    if (lowerUrl.includes('buongdieutri') || lowerUrl.includes('02d021')) {
        const isElementVisible = (el) => {
            const rect = el.getBoundingClientRect();
            return rect.width > 0 && rect.height > 0 && rect.left > -5000;
        };

        const drugGrids = doc.querySelectorAll('table[id*="Thuoc"], table[id*="thuoc"], [id*="grdChiTiet"], [id*="grd_DSThuoc"], #grdPhieuThuoc, #gridChiTietPhieu, #grdChiTietPhieuThuoc, [id*="PhieuThuoc"], #tcThuocgrdThuoc');
        for (const grid of drugGrids) {
            if (isElementVisible(grid)) {
                return { enabled: true, mode: 'oneshot' };
            }
        }
        
        const activeTabs = doc.querySelectorAll('.ui-tabs-active .ui-tabs-anchor, .ui-tabs-active a, li.active a, .ui-state-active a, [aria-selected="true"]');
        for (const tab of activeTabs) {
            const text = (tab.innerText || '').toLowerCase();
            if (text.includes('thuốc') || text.includes('điều trị')) {
                return { enabled: true, mode: 'oneshot' };
            }
        }

        // Smart Fallback: Kiểm tra xem có bảng thuốc nào đang hiển thị hay không (dựa trên cột tiêu đề)
        const tables = doc.querySelectorAll('table');
        for (const table of tables) {
            if (isElementVisible(table)) {
                const headers = table.querySelectorAll('th, td.ui-th-column, .ui-jqgrid-labels th');
                for (const header of headers) {
                    const text = (header.innerText || header.textContent || '').toLowerCase();
                    if (text.includes('tên thuốc') || text.includes('tên biệt dược') || text.includes('hoạt chất') || text.includes('mã thuốc') || text.includes('chi tiết phiếu thuốc') || text.includes('danh sách phiếu thuốc')) {
                        return { enabled: true, mode: 'oneshot' };
                    }
                }
            }
        }
    }
    
    return { enabled: false, mode: '' };
}

// Helper: get all contentWindows of all iframes currently in the document DOM
function getAllIframeWindows(doc) {
    const windows = new Set();
    function collect(currentDoc) {
        if (!currentDoc) return;
        try {
            const iframes = currentDoc.querySelectorAll('iframe');
            for (let i = 0; i < iframes.length; i++) {
                const iframe = iframes[i];
                if (iframe && iframe.contentWindow) {
                    windows.add(iframe.contentWindow);
                    try {
                        if (iframe.contentDocument) {
                            collect(iframe.contentDocument);
                        }
                    } catch (_e) {
                        // CORS barrier, can't read contentDocument of cross-origin iframe
                    }
                }
            }
        } catch (_e) {
            // In case querying the document itself throws
        }
    }
    collect(doc);
    return windows;
}

// Loại bỏ những window proxy của các iframe đã bị xóa khỏi DOM nhằm tránh rò rỉ bộ nhớ
function cleanUpStaleIframes() {
    const activeWindows = getAllIframeWindows(document);
    for (const win of activeIframeStatuses.keys()) {
        if (!activeWindows.has(win)) {
            activeIframeStatuses.delete(win);
        }
    }
}

// Kiểm tra ngữ cảnh cần quét tích hợp đa iframe và tránh CORS
function detectScanContext() {
    // 1. Dọn dẹp các iframe đã bị gỡ khỏi DOM
    cleanUpStaleIframes(document);
    
    // 2. Tổng hợp trạng thái ngữ cảnh từ tất cả iframe đã báo cáo
    let anyEnabled = false;
    let bestMode = 'oneshot';
    for (const status of activeIframeStatuses.values()) {
        if (status.enabled) {
            anyEnabled = true;
            if (status.mode === 'realtime') {
                bestMode = 'realtime';
            }
        }
    }
    
    // 3. Nếu không có iframe nào hoạt động, quét chính trang top-level hiện tại
    if (!anyEnabled) {
        const topCtx = detectLocalScanContext(document, window.location.href);
        if (topCtx.enabled) {
            anyEnabled = true;
            bestMode = topCtx.mode;
        }
    }
    
    return { enabled: anyEnabled, mode: bestMode };
}

// ===== INIT =====
export async function initCDS(enabled = true, filter = true, shadow = false) {
    isCDSEnabled = enabled;
    filterLow = filter;
    isShadowMode = shadow;

    if (!isCDSEnabled) {
        stopScanning();
        try {
            CDSUI.hide();
        } catch (_e) {}
        if (modalObserver) { modalObserver.disconnect(); modalObserver = null; }
        if (window._cdsScanContextInterval) {
            clearInterval(window._cdsScanContextInterval);
            window._cdsScanContextInterval = null;
        }
        activeIframeStatuses.clear(); // Clear all registered iframe statuses cleanly
        const drawer = document.getElementById('aladinn-cds-drawer');
        if (drawer) drawer.style.display = 'none';
        console.log('[Aladinn CDS] 🔴 CDS disabled — UI hidden.');
        return;
    }

    // Đảm bảo giao diện đã được khởi tạo
    try {
        CDSUI.init();
        CDSUI.hasUserDismissed = false; // Reset user dismiss state when enabling CDS
        const drawer = document.getElementById('aladinn-cds-drawer');
        if (drawer) {
            drawer.style.display = isShadowMode ? 'none' : '';
        }
    } catch (err) {
        console.error('[Aladinn CDS] 💥 Khởi tạo giao diện thất bại:', err);
    }

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
            const meta = await getCrawlMetadata();
            CDSUI.showCrawlDate(meta);
        } catch (err) {
            console.error('[Aladinn CDS] 💥 UI meta show failed:', err);
        }
    }

    // Tiêu thụ các ngữ cảnh active đã nhận được trong lúc tải KB
    if (isKBLoaded && isCDSEnabled) {
        const activeCtx = detectScanContext();
        if (activeCtx.enabled && !isModalOpen) {
            console.log('[Aladinn CDS] 🚀 Consuming active context after KB loaded:', activeCtx);
            startScanning(activeCtx.mode);
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
    // Tăng interval lên 3s + thêm guard tạm dừng khi tab ẩn
    if (!window._cdsScanContextInterval) {
        window._cdsScanContextInterval = setInterval(() => {
            if (document.hidden || !isCDSEnabled) return;
            
            // Chủ động ping các iframe visible để cập nhật trạng thái ngữ cảnh mới nhất
            sendRequestToVisibleIframes(document, 'CDS_PING');
            
            const ctx = detectScanContext();
            if (!ctx.enabled && isModalOpen) {
                // Form đã đóng, không còn context nào → dừng hẳn
                stopScanning();
            } else if (ctx.enabled) {
                if (!isModalOpen) {
                    // Chưa quét → bắt đầu
                    startScanning(ctx.mode);
                } else if (ctx.mode !== currentScanMode) {
                    // Mode thay đổi (VD: realtime → oneshot khi đóng modal)
                    // → Dừng session cũ, bắt đầu session mới với đúng mode
                    startScanning(ctx.mode);
                }
            }
        }, 3000);
    }

    // Kiểm tra ngay
    const ctx = detectScanContext();
    if (ctx.enabled) {
        startScanning(ctx.mode);
    } else {
        console.log('[Aladinn CDS] 💤 Waiting for prescribing context...');
    }

    // Chủ động pull dữ liệu và trạng thái ngữ cảnh từ các iframe visible để tránh race condition lúc F5
    sendRequestToVisibleIframes(document, 'CDS_REQUEST_DRUGS');
}

// ===== EVENT LISTENERS =====

// Nhận dữ liệu từ iframe helper (CDS_IFRAME_DATA: thuốc + ICD)
window.addEventListener('message', async (event) => {
    // SECURITY: Kiểm tra origin — chặn message từ nguồn khác origin
    if (event.origin !== window.location.origin) return;
    // SECURITY: Message cùng window phải có nonce hợp lệ (chống giả mạo từ page script)
    if (event.source === window && (!event.data?.nonce || event.data.nonce !== window.__ALADINN_NONCE__)) return;

    // Nhận trạng thái ngữ cảnh từ iframe helper (khắc phục lỗi F5 và MutationObserver iframe chéo nguồn)
    if (event.data && event.data.type === 'CDS_IFRAME_CONTEXT_STATUS') {
        const { enabled, mode } = event.data;
        console.log(`[Aladinn CDS] 📩 Received iframe context status: enabled=${enabled}, mode=${mode}`);
        
        // Lưu lại trạng thái của iframe gửi message dựa trên event.source proxy duy nhất
        if (event.source) {
            activeIframeStatuses.set(event.source, { enabled, mode });
        }

        if (!isKBLoaded) {
            // Đợi KB load xong sẽ quét toàn bộ activeIframeStatuses sau
            return;
        }
        if (enabled && isCDSEnabled) {
            if (!isModalOpen) {
                startScanning(mode);
            } else if (mode !== currentScanMode) {
                startScanning(mode);
            }
        } else if (!enabled && isModalOpen) {
            // Chống đóng nhầm: Kiểm tra chéo lại xem thực sự còn frame nào khác có ngữ cảnh active không
            const ctx = detectScanContext();
            if (!ctx.enabled) {
                stopScanning();
            }
        }
    }

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

    // Nhận dữ liệu gõ phím trực tiếp từ key-hook
    if (event.data && event.data.type === 'CDS_KEYSTROKE_INPUT') {
        activeKeystrokeDrug = event.data.typedText || '';
        console.log('[Aladinn CDS] ⌨️ Received proactive keystroke drug:', activeKeystrokeDrug);
        
        // Force rescan with the proactive drug
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
        // Yêu cầu iframe helper (bao gồm lồng) gửi lại dữ liệu mới nhất
        sendRequestToVisibleIframes(document, 'CDS_REQUEST_DRUGS');
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
            token: document.currentScript ? document.currentScript.getAttribute('data-aladinn-token') : (window.__ALADINN_BRIDGE_TOKEN__ || ''),
            nonce: window.__ALADINN_NONCE__
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
        // Merge iframe drugs with space normalization
        if (iframeDrugs.length > 0) {
            const iframeNames = new Set(iframeDrugs.map(d => d.display_name.toLowerCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim()));
            const merged = [...iframeDrugs];
            for (const m of context.medications) {
                const k = m.display_name.toLowerCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
                if (!iframeNames.has(k)) {
                    merged.push(m);
                }
            }
            context.medications = merged;
        }
        
        // Strict final deduplication of medications list by lowercase trimmed display_name with normalized spaces
        const uniqueFinalMeds = [];
        const seenFinalMeds = new Set();
        for (const m of context.medications) {
            const k = m.display_name.toLowerCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
            if (!seenFinalMeds.has(k)) {
                seenFinalMeds.add(k);
                uniqueFinalMeds.push(m);
            }
        }
        context.medications = uniqueFinalMeds;
        const result = await runBhytAuditRules(context);
        result.alerts = filterSatisfiedInsuranceAlerts(result.alerts, context.encounter.diagnoses);
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
