import { normalizationCache } from './normalization-cache.js';

class CDSCacheManager {
    constructor() {
        this.reset();
        this.setupListener();
    }

    reset() {
        if (typeof normalizationCache !== 'undefined' && normalizationCache) {
            normalizationCache.clear();
        }
        this.cache = {
            patientIds: new Set(),
            benhnhanId: null,
            khambenhId: null,
            maBa: null,
            encounterId: null,
            weight: null,
            diagnoses: [], // { code: 'M15.0', is_primary: true }
            medications: [], // { display_name: 'Paracetamol', generic_candidate: 'Acetaminophen' }
            labs: [], // { code: 'eGFR', value: 90, unit: '', refRange: '' }
            vitals: [], // { p, t, bp, b, spo2, h, time }
            _medsTimestamp: 0 // TTL tracking: when medications were last updated
        };
        // Sử dụng Map để gộp labs nhanh chóng
        this.labsMap = new Map();
        
        // Cache để check tránh thêm trùng
        this.medsSet = new Set();
        this.diagSet = new Set();
        
        // Patient key chuẩn: benhnhanId_khambenhId
        this._patientKey = null;
    }

    /**
     * Chỉ xóa thuốc, giữ lại chẩn đoán + labs.
     * Dùng khi đổi form kê thuốc nhưng vẫn cùng bệnh nhân.
     */
    resetMedications() {
        this.cache.medications = [];
        this.medsSet = new Set();
        console.log('[Aladinn CDS Cache] 💊 Medications reset. Diagnoses preserved:', this.cache.diagnoses.length, 'codes');
    }

    setupListener() {
        window.addEventListener('message', (event) => {
            if (event.source !== window || !event.data || event.data.type !== 'ALADINN_CDS_SNOOP') return;
            // SECURITY: Verify nonce — reject forged messages from other page scripts
            if (!event.data.nonce || event.data.nonce !== window.__ALADINN_NONCE__) return;
            this.handleData(event.data.payload);
        });

        window.addEventListener('ALADINN_FORCE_RESET_CACHE', () => {
            console.log('[Aladinn CDS] 🔄 Manual Force Reset Cache triggered by user!');
            this.reset();
        });

        // Listen for HIS logout event to purge patient data
        if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) {
            chrome.runtime.onMessage.addListener((message) => {
                if (message && message.type === 'SESSION_LOGOUT') {
                    console.log('[Aladinn CDS] 🔒 Received SESSION_LOGOUT. Purging CDS Cache.');
                    this.reset();
                }
            });
        }
    }

    handleData(payload) {
        if (!payload) return;
        let hasChanges = false;
        
        console.log('[Aladinn CDS Cache] 📥 Nhận dữ liệu snoop:', {
            benhnhanId: payload.benhnhanId,
            khambenhId: payload.khambenhId,
            diagCount: payload.diagnoses?.length || 0,
            medsCount: payload.medications?.length || 0,
            labsCount: payload.labs?.length || 0
        });

        // === Patient Key chuẩn: benhnhanId + khambenhId ===
        // Ưu tiên composite key thay vì heuristic độ dài ID
        if (payload.benhnhanId && payload.khambenhId) {
            const newKey = `${payload.benhnhanId}_${payload.khambenhId}`;
            if (this._patientKey && this._patientKey !== newKey) {
                console.log(`[Aladinn CDS Cache] 🔄 Patient changed: ${this._patientKey} → ${newKey}. Full reset.`);
                this.reset();
                hasChanges = true;
            }
            this._patientKey = newKey;
        }

        // Legacy fallback: patientId đơn lẻ (khi chưa có benhnhanId/khambenhId)
        if (payload.patientId) {
            const pId = String(payload.patientId);
            if (this.cache.patientIds.size > 0 && !this.cache.patientIds.has(pId)) {
                // Khi đã có composite key → tin tưởng composite key, chỉ thêm alias
                if (this._patientKey) {
                    this.cache.patientIds.add(pId);
                } else {
                    // Chưa có composite key → reset an toàn (tránh giữ nhầm BN cũ)
                    console.log(`[Aladinn CDS Cache] ⚠️ Unknown patient ID ${pId} without composite key. Resetting.`);
                    this.reset();
                    this.cache.patientIds.add(pId);
                    hasChanges = true;
                }
            } else if (this.cache.patientIds.size === 0) {
                this.cache.patientIds.add(pId);
                hasChanges = true;
            }
        }
        
        if (payload.benhnhanId) this.cache.benhnhanId = payload.benhnhanId;
        if (payload.khambenhId) this.cache.khambenhId = payload.khambenhId;
        if (payload.maBa) this.cache.maBa = payload.maBa;

        if (payload.weight && this.cache.weight !== payload.weight) {
            this.cache.weight = payload.weight;
            hasChanges = true;
        }

        if (payload.encounterId && this.cache.encounterId !== payload.encounterId) {
            this.cache.encounterId = payload.encounterId;
            hasChanges = true;
        }

        if (payload.diagnoses && Array.isArray(payload.diagnoses)) {
            for (const diag of payload.diagnoses) {
                if (!this.diagSet.has(diag.code)) {
                    this.diagSet.add(diag.code);
                    this.cache.diagnoses.push(diag);
                    hasChanges = true;
                }
            }
        }

        if (payload.medications && Array.isArray(payload.medications)) {
            for (const med of payload.medications) {
                // Normalize spaces, non-breaking spaces (\u00a0), and zero-width spaces (\u200b)
                const cleanName = med.display_name.replace(/[\s\u00a0\u200b]+/g, ' ').trim();
                const key = cleanName.toLowerCase();
                if (!this.medsSet.has(key)) {
                    med.display_name = cleanName;
                    this.medsSet.add(key);
                    this.cache.medications.push(med);
                    hasChanges = true;
                }
            }
            // Update timestamp khi có thuốc mới
            if (hasChanges) this.cache._medsTimestamp = Date.now();
            // Giới hạn số lượng thuốc 
            if (this.cache.medications.length > 200) {
                this.cache.medications = [];
                this.medsSet.clear();
            }
        }

        if (payload.labs && Array.isArray(payload.labs)) {
            for (const lab of payload.labs) {
                // Ghi đè lab trùng loại (giữ giá trị mới nhất)
                this.labsMap.set(lab.code, lab);
                hasChanges = true;
            }
            this.cache.labs = Array.from(this.labsMap.values());
            
            if (this.cache.labs.length > 200) {
                this.labsMap.clear();
                this.cache.labs = [];
            }
        }

        if (payload.vitals && Array.isArray(payload.vitals)) {
            for (const vit of payload.vitals) {
                this.cache.vitals.push(vit);
                hasChanges = true;
            }
            // Giới hạn số lượng
            if (this.cache.vitals.length > 200) {
                this.cache.vitals = this.cache.vitals.slice(-100);
            }
        }

        if (hasChanges) {
            // Trigger scan update nếu đang mở popup CDS
            window.dispatchEvent(new CustomEvent('ALADINN_CACHE_UPDATED'));
        }
    }

    checkPatientContext(currentDomPatientId) {
        if (!currentDomPatientId) return false;
        const pId = String(currentDomPatientId);
        
        if (this.cache.patientIds.size > 0 && !this.cache.patientIds.has(pId)) {
            const existingIds = Array.from(this.cache.patientIds);
            const hasSameLength = existingIds.some(id => Math.abs(id.length - pId.length) < 2);
            
            if (hasSameLength) {
                console.log(`[Aladinn CDS] 🔄 Patient changed in DOM (${Array.from(this.cache.patientIds).join(', ')} -> ${pId}), flushing cache!`);
                this.reset();
                this.cache.patientIds.add(pId);
                return true;
            } else {
                // Khác độ dài -> Coi như bí danh
                this.cache.patientIds.add(pId);
                return false;
            }
        }
        
        // Gán lần đầu nếu cache chưa có
        if (this.cache.patientIds.size === 0) {
            this.cache.patientIds.add(pId);
        }
        
        return false;
    }

    get() {
        // Enforce 5-minute TTL for medications
        const TTL_MS = 5 * 60 * 1000;
        if (this.cache._medsTimestamp && (Date.now() - this.cache._medsTimestamp > TTL_MS)) {
            console.log('[Aladinn CDS Cache] ⏱️ TTL hết hạn (quá 5 phút). Đang flush medications để tránh dữ liệu cũ.');
            this.resetMedications();
            this.cache._medsTimestamp = 0; // Reset timestamp sau khi xóa
        }
        return this.cache;
    }

    showDebugPanel() {
        const existing = document.getElementById('aladinn-cds-debug-panel');
        if (existing) {
            existing.remove();
            return;
        }

        const panel = document.createElement('div');
        panel.id = 'aladinn-cds-debug-panel';
        panel.className = 'aladinn-cds-debug-panel';
        
        const closeBtn = document.createElement('button');
        closeBtn.innerHTML = '❌';
        closeBtn.className = 'aladinn-cds-debug-close-btn';
        closeBtn.onclick = () => panel.remove();
        
        const ttlRemaining = this.cache._medsTimestamp ? Math.max(0, 300000 - (Date.now() - this.cache._medsTimestamp)) : 0;

        // SECURITY: Escape HTML để chống XSS trong debug panel
        const _escHtml = (str) => String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        
        panel.innerHTML = `
            <h3 class="aladinn-cds-debug-h3">🧞 AI Cache Debug Panel</h3>
            <div><strong>Patient Key:</strong> ${_escHtml(this._patientKey || 'N/A')}</div>
            <div><strong>BenhNhan ID:</strong> ${_escHtml(this.cache.benhnhanId || 'N/A')}</div>
            <div><strong>KhamBenh ID:</strong> ${_escHtml(this.cache.khambenhId || 'N/A')}</div>
            <div><strong>Patient IDs:</strong> ${_escHtml(Array.from(this.cache.patientIds).join(', ') || 'None')}</div>
            <div><strong>Medications TTL:</strong> ${ttlRemaining > 0 ? Math.round(ttlRemaining/1000) + 's' : 'Expired/None'}</div>
            
            <h4 class="aladinn-cds-debug-h4">Diagnoses (${this.cache.diagnoses.length})</h4>
            <div class="aladinn-cds-debug-list-container">
                ${this.cache.diagnoses.map(d => `[${_escHtml(d.code)}] ${_escHtml(d.name || '')}`).join('<br>') || 'None'}
            </div>
            
            <h4 class="aladinn-cds-debug-h4">Medications (${this.cache.medications.length})</h4>
            <div class="aladinn-cds-debug-meds-container">
                ${this.cache.medications.map(m => _escHtml(m.display_name)).join('<br>') || 'None'}
            </div>
            
            <h4 class="aladinn-cds-debug-h4">Labs (${this.cache.labs.length})</h4>
            <div class="aladinn-cds-debug-list-container">
                ${this.cache.labs.map(l => `[${_escHtml(l.code)}] ${_escHtml(l.value)}`).join('<br>') || 'None'}
            </div>
            
            <div class="aladinn-cds-debug-actions">
                <button id="btn-force-reset" class="aladinn-cds-debug-btn-reset">Force Reset All</button>
                <button id="btn-refresh-ui" class="aladinn-cds-debug-btn-refresh">Refresh Panel</button>
            </div>
        `;
        
        panel.appendChild(closeBtn);
        document.body.appendChild(panel);
        
        document.getElementById('btn-force-reset').onclick = () => {
            this.reset();
            this.showDebugPanel(); // Rerender
            console.log('[Aladinn CDS Debug] Forced reset from Debug Panel');
        };
        document.getElementById('btn-refresh-ui').onclick = () => {
            this.showDebugPanel();
        };
    }
}

export const CDSCache = new CDSCacheManager();

// Khởi tạo shortcut cho Debug Panel (Ctrl+Shift+Alt+D)
window.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.shiftKey && e.altKey && e.key.toLowerCase() === 'd') {
        CDSCache.showDebugPanel();
    }
});
