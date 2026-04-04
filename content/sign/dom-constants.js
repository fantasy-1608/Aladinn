/**
 * 🧞 Aladinn — Sign Module: DOM Constants
 * Centralized DOM Selectors for VNPT HIS
 * Ported from SignHis v4.1.0
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Sign = window.Aladinn.Sign || {};

window.Aladinn.Sign.DOM = (function () {
    'use strict';

    return {
        // Các nút bấm hành động chính
        BUTTONS: {
            SEARCH: '#btnTIMKIEM',
            SIGN: '#btnKy',
            CONFIRM_SIGN: '#btnConfirm',
            DIALOG_CLOSE: '.ui-dialog-titlebar-close',
            JBOX_CLOSE: '.jBox-closeButton',
        },

        // Các bảng dữ liệu (Grid)
        GRIDS: {
            PATIENT_LIST: '#grdBenhNhan, #tblGridKetQua, #grdDanhSach, .ui-jqgrid-btable',
            RESULT_TABLE: '#tblGridKetQua',
            DOCUMENT_LIST: '#gridPhieu',
            ROW_SELECTED: 'tr.ui-state-highlight',
            ROW_DATA: 'tr.jqgrow, tr.ui-widget-content',
            ROW_JQGROW: 'tr.jqgrow',
        },

        // Các ô nhập liệu (Input)
        INPUTS: {
            CREATOR: '#his-creator-filter',
            USER_NAME: '#txtUSER_TK',
            USER_ID_SELECT: '#cboUSER_ID',
            DATES: {
                FROM: '#tungay',
                TO: '#denngay'
            },
            HIS_CREATOR_FILTER: 'gs_NGUOITAO',
            STATUS_SELECT: '#cboTRANGTHAI',
        },

        // Các khung chứa nội dung (Container / Dialog)
        CONTAINERS: {
            MAIN_VIEW: '#divDlgBAifmView',
            PDF_VIEW: '#pdf-viewer',
            ACTIONS_PANEL: '#boxNhungHoSo',
        },

        // Các thành phần UI khác của HIS
        UI: {
            LOADING_OVERLAY: '.loading-overlay',
            STATUS_BAR: '.ui-jqgrid-status-bar',
            PAGINATION: '#pg_grdBenhNhan',
        },

        // Selectors cho Dialog/Alert
        DIALOGS: {
            ALERT_OK: '#alertify-ok',
            ALERT_CANCEL: '#alertify-cancel',
        }
    };
})();

console.log('[Aladinn] 🧞 Sign DOM constants loaded');
