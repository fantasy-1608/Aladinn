import { PerformanceStore } from '../../shared/performance-store.js';

/**
 * ALADINN - HIS Performance Probe
 * Đo lường thời gian phản hồi của HIS đối với thao tác của bác sĩ
 * (VD: click -> modal hiển thị). Chỉ ghi nhận thời gian, KHÔNG ghi nội dung PHI.
 */

export const HISPerformanceProbe = {
    enabled: false,
    observer: null,
    pendingAction: null, // { type, startTime }
    _boundClickHandler: null,
    
    init(flagValue) {
        this.enabled = !!flagValue;
        if (this.enabled) {
            this.attachListeners();
        } else {
            this.detachListeners();
        }
    },

    attachListeners() {
        if (!this.enabled) return;
        
        // Cache bound handler so removeEventListener can match (P1-05 fix)
        this._boundClickHandler = this._boundClickHandler || this.handleDocumentClick.bind(this);
        document.addEventListener('click', this._boundClickHandler, true);
    },

    detachListeners() {
        if (this._boundClickHandler) {
            document.removeEventListener('click', this._boundClickHandler, true);
        }
        if (this.observer) {
            this.observer.disconnect();
            this.observer = null;
        }
    },

    handleDocumentClick(e) {
        if (!this.enabled) return;
        
        const target = e.target;
        if (!target) return;

        // Detect open prescription modal or specific known actions based on selector
        // HIS VNPT specific generic match (simplified for safety rule)
        const isTabSwitch = target.closest('.dx-tab, .nav-tabs .nav-link, .ui-tabs-anchor');
        const isModalOpen = target.closest('[data-toggle="modal"], .btn-ke-don, .dx-datagrid-action');
        
        let actionType = null;
        if (isTabSwitch) actionType = 'tab_switch';
        else if (isModalOpen) actionType = 'modal_open';

        if (actionType) {
            this.startTrackingAction(actionType);
        }
    },

    startTrackingAction(type) {
        // Cancel pending
        if (this.observer) {
            this.observer.disconnect();
        }

        this.pendingAction = {
            type,
            startTime: performance.now()
        };

        // Start observer to wait for DOM stabilization
        this.observer = new MutationObserver(this.handleMutations.bind(this));
        this.observer.observe(document.body, { childList: true, subtree: true });
        
        // Safety timeout
        setTimeout(() => {
            if (this.observer && this.pendingAction) {
                this.observer.disconnect();
                this.observer = null;
                this.pendingAction = null;
            }
        }, 5000);
    },

    handleMutations(mutations) {
        if (!this.pendingAction) return;

        // Debounce logic: waiting for DOM to settle
        if (this.timeoutId) {
            clearTimeout(this.timeoutId);
        }

        this.timeoutId = setTimeout(async () => {
            // DOM has settled for 150ms
            if (this.pendingAction) {
                const duration = performance.now() - this.pendingAction.startTime - 150; // subtract debounce delay
                const record = {
                    scan_reason: `his_action_${this.pendingAction.type}`,
                    scan_total_ms: Math.max(0, duration),
                    cds_active: false // this is HIS baseline measuring
                };
                
                await PerformanceStore.addRecord(record);
                
                this.observer.disconnect();
                this.observer = null;
                this.pendingAction = null;
            }
        }, 150);
    }
};

window.AladinnHISPerformanceProbe = HISPerformanceProbe;
