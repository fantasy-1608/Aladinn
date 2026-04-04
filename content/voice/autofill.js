/**
 * HIS Voice Assistant - AutoFill Module
 * Form auto-fill functionality for main form, Hội chẩn, and Chuyển viện
 */

// ========================================
// Main Form Auto Fill
// ========================================
function autoFillForm() {
    if (window.isLocked) {
        window.showToast('Vui lòng mở khóa Panel trước!', true);
        return;
    }
    if (!window.currentResults) {
        window.showToast('Chưa có dữ liệu để điền!', true);
        return;
    }

    let filledCount = 0;
    let errorCount = 0;
    const fieldCache = new Map();

    const textFields = [
        'lyDoVaoVien', 'quaTrinhBenhLy', 'tienSuBanThan', 'tienSuGiaDinh',
        'khamToanThan', 'khamBoPhan', 'chanDoanBanDau', 'huongXuLy'
    ];

    textFields.forEach(key => {
        if (window.currentResults[key] && FIELD_SELECTORS[key]) {
            if (fillFormField(FIELD_SELECTORS[key], window.currentResults[key], fieldCache)) {
                filledCount++;
            } else {
                errorCount++;
            }
        }
    });

    if (window.currentResults.sinhHieu) {
        const vitalFields = [
            'mach', 'nhietDo', 'huyetApTamThu', 'huyetApTamTruong',
            'spO2', 'nhipTho', 'canNang', 'chieuCao'
        ];

        vitalFields.forEach(key => {
            if (window.currentResults.sinhHieu[key] && FIELD_SELECTORS[key]) {
                if (fillFormField(FIELD_SELECTORS[key], window.currentResults.sinhHieu[key], fieldCache)) {
                    filledCount++;
                } else {
                    errorCount++;
                }
            }
        });
    }

    if (filledCount > 0) {
        window.showToast(`✅ Đã điền ${filledCount} trường!`);
    } else if (errorCount > 0) {
        window.showToast('⚠️ Không tìm thấy form! Hãy mở bảng khám bệnh.', true);
    } else {
        window.showToast('Không có dữ liệu để điền', true);
    }
}

// ========================================
// Hội Chẩn Auto Fill
// ========================================
function autoFillHoiChan() {
    if (window.isLocked) {
        window.showToast('Vui lòng mở khóa Panel trước!', true);
        return;
    }
    if (!window.currentResults) {
        window.showToast('Chưa có dữ liệu! Hãy xử lý AI trước.', true);
        return;
    }

    let filledCount = 0;

    const HOICHAN_FIELDS = {
        'txtTOMTAT_TIEUSUBENH': smartJoin([
            window.currentResults.quaTrinhBenhLy,
            window.currentResults.tienSuBanThan ? `Tiền sử: ${window.currentResults.tienSuBanThan}` : ''
        ]),
        'txtTOMTAT_TT_VAOVIEN': smartJoin([
            window.currentResults.khamToanThan,
            window.currentResults.khamBoPhan
        ]),
        'txtTOMTAT_TT_HIENTAI': smartJoin([
            window.currentResults.khamToanThan,
            window.currentResults.khamBoPhan
        ]),
        'txtQUATRINH_DIEUTRI_CS': smartJoin([
            window.currentResults.lyDoVaoVien ? `Vào viện vì: ${window.currentResults.lyDoVaoVien}` : '',
            window.currentResults.chanDoanBanDau ? `Chẩn đoán: ${window.currentResults.chanDoanBanDau}` : ''
        ]),
        'txtKETLUAN_CHANDOAN': window.currentResults.chanDoanBanDau
            ? `${window.currentResults.chanDoanBanDau}\nTiên lượng:`
            : '',
        'txtPHUONGPHAPDIEUTRI': '',
        'txtKET_LUAN': window.currentResults.chanDoanBanDau
            ? `${window.currentResults.chanDoanBanDau}\nTiên lượng:`
            : '',
        'txtHUONG_DIEUTRI': 'Chuyển tuyến trên.'
    };

    for (const [fieldId, value] of Object.entries(HOICHAN_FIELDS)) {
        if (value && fillFormField(fieldId, value)) {
            filledCount++;
        }
    }

    if (filledCount > 0) {
        window.showToast(`📋 Đã điền ${filledCount} trường Hội chẩn!`);
    } else {
        window.showToast('⚠️ Không tìm thấy form Hội chẩn! Hãy mở form trước.', true);
    }
}

// ========================================
// Chuyển Viện Auto Fill
// ========================================
function autoFillChuyenVien() {
    if (window.isLocked) {
        window.showToast('Vui lòng mở khóa Panel trước!', true);
        return;
    }
    if (!window.currentResults) {
        window.showToast('Chưa có dữ liệu! Hãy xử lý AI trước.', true);
        return;
    }

    let filledCount = 0;
    const fieldCache = new Map();

    const CHUYENVIEN_FIELDS = [
        {
            ids: ['txtDAUHIEULAMSANG', 'txtDAU_HIEU_LAM_SANG'],
            value: smartJoin([window.currentResults.khamToanThan, window.currentResults.khamBoPhan])
        },
        {
            ids: ['txtQUATRINHBENHLY', 'txtQUATRINH_BENHLY', 'txtQUATRINH_DIENBIEN', 'txtBENHSU'],
            value: window.currentResults.quaTrinhBenhLy || ''
        },
        {
            ids: ['txtKETQUACANLAMSANG', 'txtKETQUA_CLS', 'txtCANLAMSANG'],
            value: window.currentResults.huongXuLy && window.currentResults.huongXuLy.includes('KQ:') ? window.currentResults.huongXuLy : ''
        },
        {
            ids: ['txtCHANDOAN', 'txtCHAN_DOAN_BENH'],
            value: ''
        },
        {
            ids: ['txtTENDICHVUKT', 'txtPHUONGPHAP_DIEUTRI'],
            value: ''
        },
        {
            ids: ['txtTHUOC', 'txtTHUOC_DIEUTRI'],
            value: 'Toa thuốc Bệnh viện'
        },
        {
            ids: ['txtTINHTRANGNGUOIBENH', 'txtTINHTRANG_CHUYENTUYEN'],
            value: smartJoin([window.currentResults.khamToanThan, window.currentResults.khamBoPhan])
        },
        {
            ids: ['txtHUONGDIEUTRI', 'txtHUONG_DIEU_TRI'],
            value: 'chuyển tuyến trên'
        }
    ];

    CHUYENVIEN_FIELDS.forEach(field => {
        if (!field.value) return;

        for (const id of field.ids) {
            if (fillFormField(id, field.value, fieldCache, 'rgba(239, 68, 68, 0.2)')) {
                filledCount++;
                break;
            }
        }
    });

    if (filledCount > 0) {
        window.showToast(`🚑 Đã điền ${filledCount} trường Chuyển viện!`);
    } else {
        window.showToast('⚠️ Không tìm thấy form Chuyển viện! Hãy mở form trước.', true);
    }
}

// ========================================
// Visibility Toggle for Hội chẩn & Chuyển viện buttons
// ========================================
function updateHoiChanButtonVisibility() {
    const hoichanBtn = document.getElementById('his-hoichan-fill');
    const chuyenvienBtn = document.getElementById('his-chuyenvien-fill');
    const displayValue = window.isChuyenVienEnabled ? 'flex' : 'none';

    if (hoichanBtn) hoichanBtn.style.display = displayValue;
    if (chuyenvienBtn) chuyenvienBtn.style.display = displayValue;
}

// ========================================
// Exports
// ========================================
window.autoFillForm = autoFillForm;
window.autoFillHoiChan = autoFillHoiChan;
window.autoFillChuyenVien = autoFillChuyenVien;
window.updateHoiChanButtonVisibility = updateHoiChanButtonVisibility;
