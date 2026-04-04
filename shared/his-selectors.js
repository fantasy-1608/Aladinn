/**
 * 🏥 HIS Shared — Selectors Registry
 * CSS Selectors cho các thành phần VNPT HIS
 * Tập trung 1 chỗ để dễ maintain khi HIS thay đổi giao diện
 * 
 * Cách dùng:
 *   const sel = HIS.Selectors.PATIENT_GRID;
 *   document.querySelector(sel);
 */

window.HIS = window.HIS || {};

HIS.Selectors = {

    // ==========================================
    // GRID & TABLE
    // ==========================================
    PATIENT_GRID: '#grdBenhNhan, #tblGridKetQua, #grdDanhSach, .ui-jqgrid-btable',
    PATIENT_GRID_SELECTED: '#grdBenhNhan tr.ui-state-highlight, #grdBenhNhan tr[aria-selected="true"], #grdBenhNhan tr.markedRow',

    DRUG_TABLE: 'table.jqTable, table[id*="grd"]',

    // ==========================================
    // DIALOG / MODAL
    // ==========================================
    DIALOG: '.ui-dialog',
    DIALOG_TITLE: '.ui-dialog-title',
    DIALOG_TITLEBAR: '.ui-dialog-titlebar',
    DIALOG_CLOSE: '.ui-dialog-titlebar-close',
    DIALOG_CONTENT: '.ui-dialog-content',

    // ==========================================
    // FORM FIELDS (common across modules)
    // ==========================================
    PATIENT_ID: 'input[name*="BENHNHAN"], input[id*="maBenhNhan"]',
    PATIENT_NAME: 'input[name*="HOTEN"], input[id*="hoTen"]',

    // Doctor & Nurse selects
    DOCTOR_SELECT: 'select[id*="bacSi"], select[name*="BACSI"]',
    NURSE_SELECT: 'select[id*="yTa"], select[name*="YTA"]',

    // ==========================================
    // BUTTONS (common)
    // ==========================================
    SAVE_BTN: 'button:contains("Lưu"), input[value*="Lưu"]',
    ADD_NEW_BTN: 'button:contains("Thêm"), input[value*="Thêm"]',
    CLOSE_BTN: 'button:contains("Đóng"), input[value*="Đóng"]',

    // ==========================================
    // INFUSION-SPECIFIC (Truyền dịch)
    // ==========================================
    INFUSION: {
        DIALOG: '.ui-dialog',
        NAME: 'input[id*="tenDich"], input[name*="TENDICH"], select[id*="tenDich"]',
        BATCH: 'input[id*="loSo"], input[name*="LOSO"]',
        QUANTITY: 'input[id*="soLuong"], input[name*="SOLUONG"]',
        SPEED: 'input[id*="tocDo"], input[name*="TOCDO"]',
        SPEED_UNIT: 'input[type="checkbox"][id*="mlh"], input[type="checkbox"]',
        START_TIME: 'input[id*="batDau"], input[name*="TGBATDAU"]',
        END_TIME: 'input[id*="ketThuc"], input[name*="TGKETTHUC"]',
        MIXED_DRUGS: 'input[id*="thuocPha"], textarea[id*="thuocPha"]',
    },

    // ==========================================
    // CARESHEET-SPECIFIC (Phiếu chăm sóc)
    // ==========================================
    CARESHEET: {
        // Sẽ bổ sung thêm khi dùng
    },

    // ==========================================
    // PRESCRIPTION-SPECIFIC (Đơn thuốc)
    // ==========================================
    PRESCRIPTION: {
        // Sẽ bổ sung thêm khi dùng
    },

    // ==========================================
    // SIGN MODULE (Ký số) — merged from sign/dom-constants.js
    // ==========================================
    SIGN: {
        BUTTONS: {
            SEARCH: '#btnTIMKIEM',
            SIGN: '#btnKy',
            CONFIRM_SIGN: '#btnConfirm',
        },
        GRIDS: {
            RESULT_TABLE: '#tblGridKetQua',
            DOCUMENT_LIST: '#gridPhieu',
            ROW_SELECTED: 'tr.ui-state-highlight',
            ROW_DATA: 'tr.ui-widget-content',
            ROW_JQGROW: 'tr.jqgrow',
        },
        INPUTS: {
            CREATOR: '#his-creator-filter',
            USER_NAME: '#txtUSER_TK',
            USER_ID_SELECT: '#cboUSER_ID',
            DATE_FROM: '#tungay',
            DATE_TO: '#denngay',
            HIS_CREATOR_FILTER: 'gs_NGUOITAO',
            STATUS_SELECT: '#cboTRANGTHAI',
        },
        CONTAINERS: {
            MAIN_VIEW: '#divDlgBAifmView',
            PDF_VIEW: '#pdf-viewer',
            ACTIONS_PANEL: '#boxNhungHoSo',
        },
        UI: {
            LOADING_OVERLAY: '.loading-overlay',
            STATUS_BAR: '.ui-jqgrid-status-bar',
            PAGINATION: '#pg_grdBenhNhan',
        },
        DIALOGS: {
            ALERT_OK: '#alertify-ok',
            ALERT_CANCEL: '#alertify-cancel',
        }
    },

    // ==========================================
    // VOICE MODULE (Nhập liệu) — merged from voice/constants.js
    // ==========================================
    VOICE: {
        // Tab Hỏi bệnh
        LYDO_VAO_VIEN: 'txtLYDOVAOVIEN',
        QUA_TRINH_BENH_LY: 'txtQUATRINHBENHLY',
        TIEN_SU_BAN_THAN: 'txtTIENSUBENH_BANTHAN',
        TIEN_SU_GIA_DINH: 'txtTIENSUBENH_GIADINH',
        // Tab Phòng khám cấp cứu
        KHAM_TOAN_THAN: 'txtKHAMBENH_TOANTHAN',
        KHAM_BO_PHAN: 'txtKHAMBENH_BOPHAN',
        CHAN_DOAN_BAN_DAU: 'txtCHANDOANBANDAU',
        HUONG_XU_LY: 'txtDAXULY',
        // Sinh hiệu
        MACH: 'txtKHAMBENH_MACH',
        NHIET_DO: 'txtKHAMBENH_NHIETDO',
        HUYET_AP_HIGH: 'txtKHAMBENH_HUYETAP_HIGH',
        HUYET_AP_LOW: 'txtKHAMBENH_HUYETAP_LOW',
        SPO2: 'txtKHAMBENH_SPO2',
        NHIP_THO: 'txtKHAMBENH_NHIPTHO',
        CAN_NANG: 'txtKHAMBENH_CANNANG',
        CHIEU_CAO: 'txtKHAMBENH_CHIEUCAO',
    },

    /**
     * Helper: Tìm element từ nhiều selector (fallback chain)
     * @param {string[]} selectors - Mảng selector, thử lần lượt
     * @returns {Element|null}
     */
    findFirst(selectors) {
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) return el;
        }
        return null;
    },

    /**
     * Helper: Tìm element bằng text content
     * @param {string} tagName - VD: 'button', 'a', 'span'
     * @param {string} text - Text cần tìm
     * @returns {Element|null}
     */
    findByText(tagName, text) {
        const elements = document.querySelectorAll(tagName);
        for (const el of elements) {
            if ((el.textContent || '').trim().includes(text)) {
                return el;
            }
        }
        return null;
    }
};


