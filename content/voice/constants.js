/**
 * HIS Voice Assistant - Constants Module
 * Icons, field mappings, and demo data
 */

// ========================================
// Icons (SVG)
// ========================================
const ICONS = {
    settings: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
    reset: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg>',
    minimize: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>',
    autofill: '<svg width="18" height="18" viewBox="0 0 24 24"><defs><linearGradient id="boltGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fbbf24"/><stop offset="100%" stop-color="#f59e0b"/></linearGradient></defs><path d="M13 2L4.09 12.11c-.42.5-.05 1.28.6 1.28H11l-1 7.61c-.05.36.42.53.63.22L19.91 11.89c.42-.5.05-1.28-.6-1.28H13l1-7.61c.05-.36-.42-.53-.63-.22L13 2z" fill="url(#boltGrad)"/></svg>',
    hoichan: '<svg width="18" height="18" viewBox="0 0 24 24"><defs><linearGradient id="clipGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#a78bfa"/><stop offset="100%" stop-color="#7c3aed"/></linearGradient></defs><rect x="6" y="4" width="12" height="18" rx="2" fill="url(#clipGrad)"/><rect x="8" y="2" width="8" height="4" rx="1" fill="#c4b5fd"/><line x1="9" y1="10" x2="15" y2="10" stroke="white" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="14" x2="15" y2="14" stroke="white" stroke-width="1.5" stroke-linecap="round"/><line x1="9" y1="18" x2="13" y2="18" stroke="white" stroke-width="1.5" stroke-linecap="round"/></svg>',
    chuyenvien: '<svg width="18" height="18" viewBox="0 0 24 24"><defs><linearGradient id="ambGrad" x1="0%" y1="100%" x2="100%" y2="0%"><stop offset="0%" stop-color="#ef4444"/><stop offset="100%" stop-color="#f97316"/></linearGradient></defs><rect x="2" y="6" width="13" height="10" rx="2" fill="url(#ambGrad)"/><path d="M15 10h4l3 3v3h-7v-6z" fill="url(#ambGrad)"/><circle cx="7" cy="17" r="2" fill="#fbbf24" stroke="#1e293b" stroke-width="1"/><circle cx="18" cy="17" r="2" fill="#fbbf24" stroke="#1e293b" stroke-width="1"/><path d="M6 9h3v3H6z" fill="white"/><path d="M7.5 9v3M6 10.5h3" stroke="#ef4444" stroke-width="1" stroke-linecap="round"/></svg>',
    copy: '<svg width="18" height="18" viewBox="0 0 24 24"><defs><linearGradient id="copyGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#38bdf8"/><stop offset="100%" stop-color="#0ea5e9"/></linearGradient></defs><rect x="9" y="9" width="12" height="12" rx="2" fill="url(#copyGrad)"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" stroke="#94a3b8" stroke-width="2" fill="none"/></svg>',
    demo: '<svg width="18" height="18" viewBox="0 0 24 24"><defs><linearGradient id="sparkGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#fde047"/><stop offset="50%" stop-color="#fb923c"/><stop offset="100%" stop-color="#f472b6"/></linearGradient></defs><path d="M12 2l2.4 7.2 7.6.8-5.8 5 1.8 7.5L12 18.5l-6 4 1.8-7.5-5.8-5 7.6-.8L12 2z" fill="url(#sparkGrad)"/></svg>',
    mic: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v1a7 7 0 0 1-14 0v-1"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>',
    stop: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="4" width="16" height="16" rx="3" ry="3"/></svg>',
    ai: '<svg width="20" height="20" viewBox="0 0 24 24"><defs><linearGradient id="aiGrad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#818cf8"/><stop offset="100%" stop-color="#6366f1"/></linearGradient></defs><circle cx="12" cy="12" r="10" fill="url(#aiGrad)"/><path d="M12 7v10M7 12h10" stroke="white" stroke-width="2" stroke-linecap="round"/></svg>',
    hospital: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>',
    clipboard: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/></svg>',
    user: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>',
    users: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    search: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>',
    stethoscope: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2a.3.3 0 0 0-.2.3Z"/><path d="M3.3 7a4.6 4.6 0 1 0 8.8 0"/><path d="M7.7 15l2 5h5l2-5"/><path d="M12 12v3"/><path d="M16 2v2"/><path d="M8 2v2"/></svg>',
    'check-square': '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>',
    pills: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>'
};

// ========================================
// Medical Field Definitions
// ========================================
const MEDICAL_FIELDS = [
    { key: 'lyDoVaoVien', label: 'Lý do vào viện', icon: 'hospital' },
    { key: 'quaTrinhBenhLy', label: 'Bệnh sử', icon: 'clipboard' },
    { key: 'tienSuBanThan', label: 'Tiền sử bản thân', icon: 'user' },
    { key: 'tienSuGiaDinh', label: 'Tiền sử gia đình', icon: 'users' },
    { key: 'khamToanThan', label: 'Khám toàn thân', icon: 'search' },
    { key: 'khamBoPhan', label: 'Khám bộ phận', icon: 'stethoscope' },
    { key: 'chanDoanBanDau', label: 'Chẩn đoán', icon: 'check-square' },
    { key: 'huongXuLy', label: 'Hướng xử lý', icon: 'pills' },
];

const VITAL_SIGNS = [
    { key: 'mach', label: 'Mạch', unit: 'lần/phút' },
    { key: 'nhietDo', label: 'Nhiệt độ', unit: '°C' },
    { key: 'huyetApTamThu', label: 'HA tâm thu', unit: 'mmHg' },
    { key: 'huyetApTamTruong', label: 'HA tâm trương', unit: 'mmHg' },
    { key: 'nhipTho', label: 'Nhịp thở', unit: 'lần/phút' },
    { key: 'spO2', label: 'SpO2', unit: '%' },
    { key: 'canNang', label: 'Cân nặng', unit: 'kg' },
    { key: 'chieuCao', label: 'Chiều cao', unit: 'cm' },
];

// ========================================
// Form Field Selectors (HIS IDs)
// ========================================
const FIELD_SELECTORS = {
    // Tab Hỏi bệnh
    lyDoVaoVien: 'txtLYDOVAOVIEN',
    quaTrinhBenhLy: 'txtQUATRINHBENHLY',
    tienSuBanThan: 'txtTIENSUBENH_BANTHAN',
    tienSuGiaDinh: 'txtTIENSUBENH_GIADINH',
    // Tab Phòng khám cấp cứu
    khamToanThan: 'txtKHAMBENH_TOANTHAN',
    khamBoPhan: 'txtKHAMBENH_BOPHAN',
    chanDoanBanDau: 'txtCHANDOANBANDAU',
    huongXuLy: 'txtDAXULY',
    // Sinh hiệu
    mach: 'txtKHAMBENH_MACH',
    nhietDo: 'txtKHAMBENH_NHIETDO',
    huyetApTamThu: 'txtKHAMBENH_HUYETAP_HIGH',
    huyetApTamTruong: 'txtKHAMBENH_HUYETAP_LOW',
    spO2: 'txtKHAMBENH_SPO2',
    nhipTho: 'txtKHAMBENH_NHIPTHO',
    canNang: 'txtKHAMBENH_CANNANG',
    chieuCao: 'txtKHAMBENH_CHIEUCAO'
};

// ========================================
// Demo Data
// ========================================
const DEMO_DATA = {
    lyDoVaoVien: 'Đau ngực trái, khó thở',
    quaTrinhBenhLy: 'Bệnh nhân nam 45 tuổi, đau ngực trái xuất hiện cách nhập viện 2 giờ. Đau tức nặng vùng sau xương ức, lan ra vai trái và cánh tay trái. Kèm theo vã mồ hôi, khó thở. Đau không giảm khi nghỉ ngơi.',
    tienSuBanThan: 'Tăng huyết áp 5 năm, đang điều trị Amlodipine 5mg/ngày. Đái tháo đường type 2 phát hiện 3 năm, uống Metformin 850mg x 2 lần/ngày.',
    tienSuGiaDinh: 'Bố bị nhồi máu cơ tim năm 60 tuổi. Mẹ bị tăng huyết áp.',
    khamToanThan: 'Tỉnh, tiếp xúc tốt. Thể trạng trung bình. Da niêm mạc hồng. Không phù.',
    khamBoPhan: 'Tim: Nhịp đều, T1 T2 rõ, không tiếng thổi. Phổi: Rì rào phế nang đều 2 bên, không ran.',
    chanDoanBanDau: 'Hội chứng vành cấp. Tăng huyết áp độ II. Đái tháo đường type 2.',
    huongXuLy: 'Nhập ICU theo dõi. Thở oxy. ECG 12 chuyển đạo. Xét nghiệm Troponin I, CK-MB. Aspirin 325mg.',
    sinhHieu: {
        mach: '90',
        nhietDo: '37.2',
        huyetApTamThu: '150',
        huyetApTamTruong: '95',
        nhipTho: '22',
        spO2: '96',
        canNang: '72',
        chieuCao: '168'
    },
    icd10Suggest: [
        { code: 'I21.9', name: 'Nhồi máu cơ tim cấp, không đặc hiệu' },
        { code: 'I10', name: 'Tăng huyết áp vô căn (nguyên phát)' },
        { code: 'E11.9', name: 'Đái tháo đường type 2 không biến chứng' }
    ]
};

// ========================================
// Global Exports (Voice Module)
// Keeping window.* for backward compat, also registering under HIS.Voice.*
// ========================================
window.ICONS = ICONS;
window.MEDICAL_FIELDS = MEDICAL_FIELDS;
window.VITAL_SIGNS = VITAL_SIGNS;
window.FIELD_SELECTORS = FIELD_SELECTORS;
window.DEMO_DATA = DEMO_DATA;

// Register under HIS namespace for new code
window.HIS = window.HIS || {};
HIS.Voice = HIS.Voice || {};
HIS.Voice.ICONS = ICONS;
HIS.Voice.MEDICAL_FIELDS = MEDICAL_FIELDS;
HIS.Voice.VITAL_SIGNS = VITAL_SIGNS;
HIS.Voice.DEMO_DATA = DEMO_DATA;

