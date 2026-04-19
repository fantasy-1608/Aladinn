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
            patientId: null,
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
    }

    setupListener() {
        window.addEventListener('message', (event) => {
            if (event.source !== window || !event.data || event.data.type !== 'ALADINN_CDS_SNOOP') return;
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

        // Reset nếu khác bệnh nhân
        if (payload.patientId && this.cache.patientId && payload.patientId !== this.cache.patientId) {
            this.reset();
            this.cache.patientId = payload.patientId;
            hasChanges = true;
        } else if (payload.patientId && !this.cache.patientId) {
            this.cache.patientId = payload.patientId;
            hasChanges = true;
        }

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
        
        // Nếu mã bệnh nhân trên hệ thống của Cache khác với DOM, xóa sạch Cache
        if (this.cache.patientId && this.cache.patientId !== currentDomPatientId) {
            console.log('[Aladinn CDS] 🔄 Patient changed in DOM, flushing cache!');
            this.reset();
            this.cache.patientId = currentDomPatientId;
            return true;
        }
        
        // Gán lần đầu nếu cache chưa có
        if (!this.cache.patientId) {
            this.cache.patientId = currentDomPatientId;
        }
        
        return false;
    }

    get() {
        return this.cache;
    }
}

export const CDSCache = new CDSCacheManager();
