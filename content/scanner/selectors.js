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
            weight: {
                selector: '#textfield_1535',
                type: 'input',
                keywords: ['can nang', 'weight', 'trong luong', 'can nang (kg)']
            },
            height: {
                selector: '#textfield_1536',
                type: 'input',
                keywords: ['chieu cao', 'height', 'chieu cao (cm)']
            },
            bmi: {
                selector: '#textfield_1526',
                type: 'input',
                keywords: ['bmi', 'chi so khoi co the', 'chi so bmi']
            },
            systolic: {
                selector: '#textfield_1537',
                type: 'input',
                keywords: ['huyet ap tam thu', 'systolic', 'tam thu']
            },
            diastolic: {
                selector: '#textfield_1538',
                type: 'input',
                keywords: ['huyet ap tam truong', 'diastolic', 'tam truong']
            }
        },
        section2: {
            sutCanNo: {
                selector: '#checkbox_1527',
                type: 'checkbox',
                keywords: ['sut can khong', 'sut can trong 3 thang gan day khong']
            },
            sutCan: {
                selector: 'input#checkbox_1539[value="1"]',
                type: 'checkbox',
                keywords: ['sut can', 'sut can khong mong muon']
            },
            bmiThap: {
                selector: 'input#checkbox_1540[value="1"]',
                type: 'checkbox',
                keywords: ['bmi thap', 'bmi < 18.5']
            },
            teoCo: {
                selector: 'input#checkbox_1553[value="1"]',
                type: 'checkbox',
                keywords: ['teo co', 'co bap beo xop', 'teo co/beo xop']
            },
            phuNgoaiVi: {
                selector: 'input#checkbox_1554[value="1"]',
                type: 'checkbox',
                keywords: ['phu ngoai vi', 'phu', 'phu chan']
            },
            benhLyTieuHoa: {
                selector: 'input#checkbox_1542[value="1"]',
                type: 'checkbox',
                keywords: ['benh ly tieu hoa', 'duong tieu hoa', 'tieu hoa']
            },
            anUongGiamSut: {
                selector: 'input#checkbox_1543[value="1"]',
                type: 'checkbox',
                keywords: ['an uong giam sut', 'giam an uong', 'an uong kem']
            }
        },
        section3: {
            boSungMieng: {
                selector: '#checkbox_1546',
                type: 'checkbox',
                keywords: ['bo sung dinh duong duong mieng', 'bo sung dinh duong', 'dinh duong mieng']
            }
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
