/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Integration (Deep HIS Integration)
 * 
 * Tích hợp sâu hơn với hệ thống VNPT HIS.
 */

const VNPTIntegration = (function () {
    /**
     * @typedef {Object} VNPTRoom
     * @property {number} id
     * @property {string} name
     */

    /**
     * @typedef {Object} VNPTDoctor
     * @property {string} id
     * @property {string} name
     */

    /**
     * @typedef {Object} VNPTOverview
     * @property {number} total
     * @property {number} withDrugs
     * @property {number} warnings
     * @property {number} ok
     */

    /** @type {{room: string|null, doctor: string|null}} */
    let currentFilters = {
        room: null,
        doctor: null
    };

    /**
     * Lấy danh sách buồng từ bảng bệnh nhân
     * @returns {Array<VNPTRoom>} [{id, name}, ...]
     */
    function getRoomList() {
        if (!window.HIS || !window.HIS.Diagnostic) {
            console.warn('[Integration] HIS.Diagnostic not loaded');
            return [];
        }

        return window.HIS.Diagnostic.runSafeSync('Integration.getRoomList', () => {
            const rooms = new Set();
            if (!window.VNPTSelectors) return [];

            const rows = document.querySelectorAll(VNPTSelectors.patientGrid.rows);
            rows.forEach(tr => {
                const roomName = VNPTSelectors.utils.getText(/** @type {HTMLElement} */(tr), VNPTSelectors.patientGrid.cells.room);
                if (roomName && roomName.length > 0) {
                    rooms.add(roomName);
                }
            });

            const optsSelector = VNPTSelectors.dropdowns.room.map(s => `${s} option`).join(', ');
            const options = document.querySelectorAll(optsSelector);
            options.forEach((/** @type {any} */ opt) => {
                if (opt.value && opt.textContent.trim()) {
                    rooms.add(opt.textContent.trim());
                }
            });

            return [...rooms].sort().map((name, idx) => ({
                id: idx + 1,
                name: name
            }));
        });
    }

    /**
     * Lấy danh sách bác sĩ từ trang
     * @returns {Array<VNPTDoctor>}
     */
    function getDoctorList() {
        /** @type {Array<VNPTDoctor>} */
        const doctors = [];
        if (!window.VNPTSelectors) return [];

        const optsSelector = VNPTSelectors.dropdowns.doctor.map(s => `${s} option`).join(', ');
        const options = document.querySelectorAll(optsSelector);

        options.forEach((/** @type {any} */ opt) => {
            if (opt.value) {
                doctors.push({
                    id: opt.value,
                    name: opt.textContent.trim()
                });
            }
        });

        return doctors;
    }

    /**
     * Đặt bộ lọc
     * @param {'room' | 'doctor'} type
     * @param {string|null} value 
     */
    function setFilter(type, value) {
        currentFilters[type] = value;
        console.log('[Integration] Đặt bộ lọc:', type, '=', value);
    }

    /**
     * Xóa tất cả bộ lọc
     */
    function clearFilters() {
        currentFilters = { room: null, doctor: null };
        console.log('[Integration] Đã xóa bộ lọc');
    }

    /**
     * Lọc danh sách row theo bộ lọc hiện tại
     * @param {NodeList} rows 
     * @returns {Array<any>}
     */
    function filterRows(rows) {
        if (!window.VNPTSelectors) return [...rows];

        return [...rows].filter(tr => {
            // Lọc theo buồng
            if (currentFilters.room) {
                const roomName = VNPTSelectors.utils.getText(/** @type {HTMLElement} */(tr), VNPTSelectors.patientGrid.cells.room);
                if (!roomName.includes(currentFilters.room)) {
                    return false;
                }
            }

            // Lọc theo bác sĩ
            if (currentFilters.doctor) {
                const docName = VNPTSelectors.utils.getText(/** @type {HTMLElement} */(tr), VNPTSelectors.patientGrid.cells.doctor);
                if (!docName.includes(currentFilters.doctor)) {
                    return false;
                }
            }

            return true;
        });
    }

    /**
     * Lấy thông tin tổng quan
     * @returns {VNPTOverview}
     */
    function getOverview() {
        if (!window.HIS || !window.HIS.Diagnostic) return { total: 0, withDrugs: 0, warnings: 0, ok: 0 };
        return window.HIS.Diagnostic.runSafeSync('Integration.getOverview', () => {
            if (!window.VNPTSelectors) return { total: 0, withDrugs: 0, warnings: 0, ok: 0 };

            const total = document.querySelectorAll(VNPTSelectors.patientGrid.rows).length;
            let withDrugs = 0;
            document.querySelectorAll(VNPTSelectors.patientGrid.rows).forEach(tr => {
                if (tr.querySelector("img[src*='Drug']")) withDrugs++;
            });

            return {
                total,
                withDrugs,
                warnings: 0,
                ok: withDrugs
            };
        });
    }

    /**
     * Inject Filter UI vào panel
     * @param {HTMLElement} container 
     */
    function injectFilterUI(container) {
        const filterDiv = document.createElement('div');
        filterDiv.className = 'vnpt-filters';
        filterDiv.innerHTML = `
            <div class="vnpt-filter-row">
                <select id="vnpt-filter-room" class="vnpt-filter-select">
                    <option value="">-- Tất cả buồng --</option>
                </select>
            </div>
        `;

        // Chèn vào sau header
        const header = container.querySelector('.vnpt-ui-header');
        if (header) {
            header.after(filterDiv);
        }

        // Populate rooms
        const roomSelect = /** @type {HTMLSelectElement|null} */ (filterDiv.querySelector('#vnpt-filter-room'));
        if (!roomSelect) return;

        getRoomList().forEach(room => {
            const opt = document.createElement('option');
            opt.value = room.name;
            opt.textContent = room.name;
            roomSelect.appendChild(opt);
        });

        // Event listener
        roomSelect.addEventListener('change', (e) => {
            const target = /** @type {HTMLSelectElement} */ (e.target);
            setFilter('room', target.value || null);
        });
    }

    // Public API
    return {
        getRoomList,
        getDoctorList,
        setFilter,
        clearFilters,
        filterRows,
        getOverview,
        injectFilterUI
    };
})();

window.VNPTIntegration = VNPTIntegration;
