/**
 * 🧞 Aladinn CDS — Cache Manager
 * Lắng nghe và quản lý dữ liệu JSON thu thập được từ AJAX Snooping.
 * Tự động lọc, merge và giới hạn kích thước để đảm bảo hiệu năng.
 */

class CDSCacheManager {
    constructor() {
        this.reset();
        this.setupListener();
    }

    reset() {
        this.cache = {
            patientIds: new Set(),
            benhnhanId: null,
            khambenhId: null,
            maBa: null,
            encounterId: null,
            weight: null,
            diagnoses: [], // { code: 'M15.0', is_primary: true }
            medications: [], // { display_name: 'Paracetamol', generic_candidate: 'Acetaminophen' }
            labs: [] // { code: 'eGFR', value: 90, unit: '', refRange: '' }
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
            if (event.data.nonce && event.data.nonce !== window.__ALADINN_NONCE__) return;
            this.handleData(event.data.payload);
        });

        window.addEventListener('ALADINN_FORCE_RESET_CACHE', () => {
            console.log('[Aladinn CDS] 🔄 Manual Force Reset Cache triggered by user!');
            this.reset();
        });
    }

    handleData(payload) {
        if (!payload) return;
        let hasChanges = false;

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
                const key = med.display_name.toLowerCase();
                if (!this.medsSet.has(key)) {
                    this.medsSet.add(key);
                    this.cache.medications.push(med);
                    hasChanges = true;
                }
            }
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
        return this.cache;
    }
}

export const CDSCache = new CDSCacheManager();
