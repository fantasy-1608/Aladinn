/**
 * VNPT HIS Extension v4.0.1
 * Module: Selectors
 * 
 * Centralized CSS selectors for the extension.
 */

const VNPTSelectors = {
    // Patient List selectors
    patientGrid: {
        table: '#grdBenhNhan',
        rows: '#grdBenhNhan tbody tr.ui-widget-content',
        cells: {
            name: ["td[aria-describedby$='_TENBENHNHAN']", "td[aria-describedby$='_TEN_BN']"],
            room: ["td[aria-describedby$='_TENPHONG']", "td[aria-describedby$='_TEN_PHONG']"],
            doctor: ["td[aria-describedby$='_TENBACSI']", "td[aria-describedby$='_TEN_BS']"],
            dob: ["td[aria-describedby$='_NGAYSINH']"],
            gender: ["td[aria-describedby$='_GIOITINH']"],
            icon: ["td[aria-describedby$='_ICON']", "td[aria-describedby$='_ICON1']"]
        }
    },

    // Drug list selectors
    drugGrid: {
        container: '#tcThuoc',
        grid: '#tcThuocgrdThuoc',
        loader: '#load_tcThuocgrdThuoc',
        rows: '#tcThuocgrdThuoc tr.ui-widget-content',
        cells: {
            name: "td[aria-describedby$='_TENTHUOC']",
            amount: "td[aria-describedby$='_SOLUONG']",
            status: "td[aria-describedby$='_TRANGTHAI']",
            icon: "td[aria-describedby$='_ICON']"
        }
    },

    // Selectors cho Phiếu Dinh Dưỡng DD-03
    nutritionForm: {
        iframe: '#divDlgThemPhieuifmView',
        fields: {
            weight: '#textfield_1535',
            height: '#textfield_1536',
            bmi: '#textfield_1526'
        },
        section2: {
            sutCan: 'input#checkbox_1539[value="1"]',
            bmiThap: 'input#checkbox_1540[value="1"]',
            teoCo: 'input#checkbox_1553[value="1"]',
            phuNgoaiVi: 'input#checkbox_1554[value="1"]',
            benhLyTieuHoa: 'input#checkbox_1542[value="1"]',
            anUongGiamSut: 'input#checkbox_1543[value="1"]'
        },
        section3: {
            boSungMieng: '#checkbox_1546'
        },
        buttons: {
            createNew: '#btnTaoMoi',
            confirmSuccess: '#alertify-ok'
        }
    },

    // Dropdowns hệ thống
    dropdowns: {
        room: ['#cboPhong', '#cbbBuong', 'select[id*="Buong"]', 'select[id*="BUONG"]', 'select[id*="PHONG"]'],
        doctor: ['#cboBacSi', 'select[id*="BacSi"]', 'select[id*="BACSI"]', 'select[id*="BS"]']
    },

    // UI Elements
    ui: {
        mainPanel: '#vnpt-scanner-ui',
        buttons: {
            scanDrug: '#btn-scan-drugs',
            scanRoom: '#btn-scan-rooms',
            scanVitals: '#btn-scan-vitals',
            createNutrition: '#btn-create-nutrition',
            dashboard: '#btn-dashboard',
            stop: '#btn-stop-scan',
            clear: '#btn-clear-cache',
            minimize: '.btn-minimize',
            darkToggle: '.btn-dark-toggle'
        },
        status: '#scan-status',
        progress: '#vnpt-progress-bar'
    },

    // Native Menu Integration
    nativeMenu: {
        container: '.vnpt-native-menu-item',
        items: {
            scanDrug: '#native-scan-drug',
            scanRoom: '#native-scan-room',
            scanVitals: '#native-scan-vitals',
            createNutrition: '#native-create-nutrition',
            toggleUI: '#native-toggle-ui'
        }
    },

    // Utilities
    utils: {
        /** @param {HTMLElement} tr @param {string[]} selectors */
        findFirst(tr, selectors) {
            if (!selectors || !Array.isArray(selectors)) return null;
            for (const s of selectors) {
                const el = tr.querySelector(s);
                if (el) return el;
            }
            return null;
        },

        /** @param {HTMLElement} tr @param {string[]} selectors */
        getText(tr, selectors) {
            const el = this.findFirst(tr, selectors);
            return el ? el.textContent.trim() : '';
        }
    }
};

// Export globally
window.VNPTSelectors = VNPTSelectors;
