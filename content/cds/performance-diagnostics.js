import { PerformanceStore } from '../../shared/performance-store.js';

/**
 * ALADINN - CDS Performance Diagnostics
 * Đo lường hiệu năng của module CDS (extract_context_ms, analyze_ms, render_ms).
 */

export const CDSPerformance = {
    enabled: false, // Default is false, controlled by Feature Flag
    currentScanSession: null,

    // Cấu hình flag: cds_perf_diagnostics
    init(flagValue) {
        this.enabled = !!flagValue;
    },

    startScan(reason) {
        if (!this.enabled) return;
        this.currentScanSession = {
            id: `scan_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            reason: reason || 'unknown',
            startTime: performance.now(),
            metrics: {},
            activeMarks: new Set()
        };
        this.mark('scan_start');
    },

    mark(name) {
        if (!this.enabled || !this.currentScanSession) return;
        const markName = `${this.currentScanSession.id}_${name}`;
        performance.mark(markName);
        this.currentScanSession.activeMarks.add(name);
    },

    measure(metricName, startMark, endMark) {
        if (!this.enabled || !this.currentScanSession) return;
        const sMark = `${this.currentScanSession.id}_${startMark}`;
        const eMark = `${this.currentScanSession.id}_${endMark}`;
        
        try {
            const measureName = `${this.currentScanSession.id}_${metricName}`;
            performance.measure(measureName, sMark, eMark);
            const entries = performance.getEntriesByName(measureName);
            if (entries.length > 0) {
                this.currentScanSession.metrics[metricName] = entries[0].duration;
            }
        } catch (e) {
            console.warn('[Aladinn Perf] Measure failed:', metricName, e);
        }
    },

    async endScan(contextData = {}) {
        if (!this.enabled || !this.currentScanSession) return;
        
        this.mark('scan_end');
        this.measure('scan_total_ms', 'scan_start', 'scan_end');
        
        const metrics = this.currentScanSession.metrics;
        
        // Ghi record vào PerformanceStore
        const record = {
            scan_reason: this.currentScanSession.reason,
            scan_total_ms: metrics.scan_total_ms || 0,
            extract_context_ms: metrics.extract_context_ms || 0,
            analyze_ms: metrics.analyze_ms || 0,
            render_ms: metrics.render_ms || 0,
            
            iframe_count: contextData.iframeCount || 0,
            medication_count: contextData.medCount || 0,
            diagnosis_count: contextData.diagCount || 0,
            lab_count: contextData.labCount || 0,
            alert_count: contextData.alertCount || 0,
            skipped_by_hash: !!contextData.skippedByHash,
            
            cds_active: true
        };

        await PerformanceStore.addRecord(record);

        // Cleanup marks/measures from Performance API buffer
        try {
            for (const name of this.currentScanSession.activeMarks) {
                performance.clearMarks(`${this.currentScanSession.id}_${name}`);
            }
            performance.clearMeasures(`${this.currentScanSession.id}_scan_total_ms`);
            performance.clearMeasures(`${this.currentScanSession.id}_extract_context_ms`);
            performance.clearMeasures(`${this.currentScanSession.id}_analyze_ms`);
            performance.clearMeasures(`${this.currentScanSession.id}_render_ms`);
        } catch(e) {}

        this.currentScanSession = null;
    }
};

window.AladinnCDSPerformance = CDSPerformance;
