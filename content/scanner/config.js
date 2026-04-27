/**
 * VNPT HIS Extension v4.0.1
 * Module: Config
 * 
 * Centralized Configuration for core selectors and constants.
 * 
 * ⚠️ IMPORTANT: When VNPT HIS updates their UI, update selectors HERE and in selectors.js.
 * NOTE: config.js has core selectors used by scan-flow, menu, etc.
 *       selectors.js has detailed selectors for specific features (nutrition, drug grid, etc.)
 *       injected.js has its own config because it runs in page context (no access to content script globals).
 */

const VNPTConfig = {
    // ===========================================
    // VERSION & DEBUG
    // ===========================================
    VERSION: '4.0.0',
    DEBUG: false, // Set to true to enable console logging

    // ===========================================
    // RETRY CONFIGURATION
    // ===========================================
    retry: {
        maxRetries: 3,
        baseDelayMs: 500,
        maxDelayMs: 5000
    },

    // ===========================================
    // DOM SELECTORS
    // ===========================================
    selectors: {
        // Main Patient Grid — Nội trú
        patientGrid: '#grdBenhNhan',
        patientGridBody: '#grdBenhNhan tbody',
        // Ngoại trú
        patientGridOutpatient: '#grdDSBenhNhan',
        patientGridOutpatientBody: '#grdDSBenhNhan tbody',
        // Combined rows (scan-flow sẽ quét cả 2 grid)
        patientRows: '#grdBenhNhan tbody tr.ui-widget-content, #grdDSBenhNhan tbody tr.ui-widget-content',

        // Drug Tab Grid
        drugTab: "a[href='#tcThuoc']",
        drugGrid: '#tcThuocgrdThuoc',
        drugRows: '#tcThuocgrdThuoc tbody tr.ui-widget-content',
        drugLoading: '#load_tcThuocgrdThuoc',

        // Grid Columns (Partial IDs - used with aria-describedby$=)
        col: {
            icon: '_ICON',
            room: '_TENBUONG',
            bedName: '_GIUONG_NAME',
            bed: '_BUONG',
            doctor: '_BSDIEUTRI',
            doctorAlt: '_BACSI',
            name: '_HOTEN'
        },

        // Room/Bed Cell Selector (combined)
        roomCell: "td[aria-describedby$='_TENBUONG'], td[aria-describedby$='_GIUONG_NAME'], td[aria-describedby$='_BUONG']",
        doctorCell: "td[aria-describedby$='_BSDIEUTRI'], td[aria-describedby$='_BACSI']",
        nameCell: "td[aria-describedby$='_HOTEN']",
        iconCell: "td[aria-describedby$='_ICON']",

        // Dropdowns
        roomDropdown: '#cboPhong option, #cbbBuong option, select[id*="Buong"] option, select[id*="BUONG"] option',
        doctorDropdown: '#cboBacSi option, select[id*="BacSi"] option',

        // Extension UI Elements
        ui: {
            mainPanel: '#vnpt-scanner-ui',
            toastContainer: '#vnpt-toast-container',
            scanStatus: '#scan-status',
            stopBtn: '#btn-stop-scan',
            clearBtn: '#btn-clear-cache',
            scanRoomsBtn: '#btn-scan-rooms',
            minimizeBtn: '.btn-minimize',
            darkToggleBtn: '.btn-dark-toggle'
        },

        // Native Menu
        nativeMenu: {
            container: 'ul, div.navbar-nav, div.nav',
            mainMenu: '#main-menu ul',
            menuItem: '.vnpt-native-menu-item',
            scanRoom: '#native-scan-room',
            toggleUI: '#native-toggle-ui'
        }
    },

    // ===========================================
    // CSS CLASSES
    // ===========================================
    classes: {
        activeRow: 'scanning-active-row',
        minimized: 'minimized',
        darkMode: 'vnpt-dark-mode',
        hasRealName: 'has-real-name',
        nativeActive: 'vnpt-native-active'
    },

    // ===========================================
    // TIMEOUTS & DELAYS
    // ===========================================
    timeouts: {
        scanDelay: 600,          // ms - delay between row scans
        loadTimeout: 10000,      // ms - max wait for data load
        pollingInterval: 100,    // ms - polling check interval
        menuEventDelay: 100,     // ms - delay for menu event binding
        maxWaitTime: 5000        // ms - max wait for any async operation
    },

    // ===========================================
    // STORAGE KEYS
    // ===========================================
    storage: {
        scanResults: 'vnpt_scan_results',
        darkMode: 'vnpt_dark_mode',
        errorLogs: 'vnpt_error_logs'
    },

    // ===========================================
    // ALLOWED ORIGINS (Security)
    // ===========================================
    security: {
        allowedOrigin: 'https://bvdongthap.vncare.vn'
    }
};

// Export to window (single namespace)
window.VNPTConfig = VNPTConfig;

