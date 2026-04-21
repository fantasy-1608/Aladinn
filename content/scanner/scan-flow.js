/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Scan Flow (Core Logic)
 * 
 * Manages the transition between different scan modes and results processing.
 */

const VNPTLogger = window.Aladinn?.Logger || { warn: console.warn, error: console.error, debug: console.log, info: console.info };

const VNPTScanFlow = (function () {
    let isScanning = false;
    let stopScan = false;

    /**
     * Start the scan process
     * @param {'room' | 'vitals'} mode
     * @param {Object} options - Configuration and callbacks
     */
    async function start(mode, options = {}) {
        if (isScanning) return;
        isScanning = true;
        stopScan = false;

        if (/** @type {any} */(options).onStart) (/** @type {any} */(options)).onStart(mode);

        // 1. Get Rows
        const rows = document.querySelectorAll((/** @type {any} */(VNPTConfig.selectors.patientGrid)).rows || VNPTConfig.selectors.patientRows);
        let filteredRows = Array.from(rows);

        // 2. Integration Filtering
        if (window.VNPTIntegration) {
            filteredRows = window.VNPTIntegration.filterRows(rows);
        }

        const total = filteredRows.length;
        let count = 0;
        const roomStats = {};

        for (const tr of filteredRows) {
            if (stopScan) break;

            // Skip if already has room name (Optimization)
            if (mode === 'room' && tr.querySelector('.has-real-name')) continue;

            // Highlight
            document.querySelectorAll('.scanning-active-row').forEach(r => r.classList.remove('scanning-active-row'));
            tr.classList.add('scanning-active-row');
            tr.scrollIntoView({ behavior: 'smooth', block: 'center' });

            count++;
            if (/** @type {any} */(options).onProgress) (/** @type {any} */(options)).onProgress(count, total);

            // Execute Mode Logic
            try {
                if (mode === 'room') {
                    const res = await VNPTMessaging.sendRequest('REQ_FETCH_ROOM', { rowId: tr.id }, 8000);
                    if (res.giuong && (/** @type {any} */(options)).onRoomFound) {
                        const roomName = extractRoomName(res.giuong);
                        (/** @type {any} */(options)).onRoomFound(tr, roomName);
                        (/** @type {any} */(roomStats))[roomName] = ((/** @type {any} */(roomStats))[roomName] || 0) + 1;
                    } else if (res.timeout) {
                        VNPTLogger.warn('ScanFlow', `Timeout fetching room for row ${tr.id}`);
                    }
                }
                else if (mode === 'drugs') {
                    const res = await VNPTMessaging.sendRequest('REQ_FETCH_DRUGS', { rowId: tr.id }, 8000);
                    if (res.drugList && (/** @type {any} */(options)).onDrugsFound) {
                        (/** @type {any} */(options)).onDrugsFound(tr, res.drugList);
                    } else if (res.timeout) {
                        VNPTLogger.warn('ScanFlow', `Timeout fetching drugs for row ${tr.id}`);
                    }
                }
                else if (mode === 'pttt') {
                    const res = await VNPTMessaging.sendRequest('REQ_FETCH_PTTT', { rowId: tr.id }, 8000);
                    if (res.ptttList && (/** @type {any} */(options)).onPtttFound) {
                        (/** @type {any} */(options)).onPtttFound(tr, res.ptttList);
                    } else if (res.timeout) {
                        VNPTLogger.warn('ScanFlow', `Timeout fetching PTTT for row ${tr.id}`);
                    }
                }
            } catch (err) {
                VNPTLogger.error('ScanFlow', `Error during ${mode} scan for row ${tr.id}`, String(err));
            }
        }

        // Cleanup
        document.querySelectorAll('.scanning-active-row').forEach(r => r.classList.remove('scanning-active-row'));
        isScanning = false;

        if ((/** @type {any} */(options)).onComplete) (/** @type {any} */(options)).onComplete(mode, roomStats);
    }

    function stop() {
        stopScan = true;
    }

    function extractRoomName(/** @type {string} */ text) {
        if (!text) return '';
        // Match specific identifier after Buồng/Phòng/P.
        // Format example: "... CH/Buồng BN)" -> BN
        // Special case: DV1, DV2 -> 1, 2
        const m = text.match(/(?:Buồng|Phòng|P\.)\s*([^)\s,]+)/i);
        if (m) {
            let name = m[1].trim();
            // If starts with DV followed by numbers, just return numbers
            const dvMatch = name.match(/^DV(\d+)$/i);
            if (dvMatch) return dvMatch[1];
            return name;
        }

        // Fallback: take the last part if no match
        const parts = text.split(/[-/]/);
        const lastPart = parts[parts.length - 1].replace(/[()]/g, '').trim();
        return lastPart.length < 10 ? lastPart : lastPart.substring(0, 5);
    }

    return {
        start,
        stop,
        isScanning: () => isScanning
    };
})();

/** @type {any} */(window).VNPTScanFlow = VNPTScanFlow;
