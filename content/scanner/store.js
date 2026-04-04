/**
 * VNPT HIS Smart Scanner v4.0.1
 * Module: Store (State Management)
 * 
 * Centralized state management với reactive pattern.
 * Cho phép các module subscribe và nhận updates khi state thay đổi.
 */

const VNPTStore = (function () {
    // ==========================================
    // STATE
    // ==========================================
    /** @type {VNPTState} */
    const state = {
        // Scan state
        isScanning: false,
        scanMode: null, // 'drug' | 'room' | null
        scanProgress: { current: 0, total: 0 },
        scanResults: {},

        // Patient state
        selectedPatientId: null,
        patientList: [],

        // UI state
        isDarkMode: false,
        isPanelMinimized: false,
        isPanelVisible: true,

        // Filter state
        selectedRoom: null,
        selectedDoctor: null,

        // Statistics
        roomStatistics: {},

        // Cache
        patientDataMap: {},
        vitalsDataMap: {}, // patientId -> {weight, height, bmi, bloodPressure, pulse, temperature}
        medicalHistoryMap: {}, // patientId -> {full history object}

        // Connection state
        isOnline: true,
        lastSync: null
    };

    // ==========================================
    // SUBSCRIBERS (Reactive pattern)
    // ==========================================
    /** @type {Map<string, Set<Function>>} */
    const subscribers = new Map();

    // ==========================================
    // GETTERS
    // ==========================================

    /**
     * Get current state (read-only snapshot)
     * @returns {VNPTState}
     */
    function getState() {
        return { ...state };
    }

    /**
     * Get specific state value
     * @param {keyof VNPTState} key
     */
    function get(key) {
        // @ts-ignore
        return state[key];
    }

    // ==========================================
    // SETTERS
    // ==========================================

    /**
     * Update state and notify subscribers
     * @param {Partial<VNPTState>} updates
     */
    function setState(updates) {
        const changedKeys = [];

        for (const [key, value] of Object.entries(updates)) {
            if (state[key] !== value) {
                state[key] = value;
                changedKeys.push(key);
            }
        }

        // Notify subscribers for changed keys
        changedKeys.forEach(key => {
            notifySubscribers(key, state[key]);
        });

        // Also notify global subscribers
        if (changedKeys.length > 0) {
            notifySubscribers('*', state);
        }

        // Persist certain state to localStorage
        persistState(changedKeys);

        if (window.VNPTLogger && changedKeys.length > 0) {
            VNPTLogger.debug('Store', 'State updated:', changedKeys);
        }
    }

    /**
     * Set single value
     * @param {keyof VNPTState} key
     * @param {any} value
     */
    function set(key, value) {
        setState({ [key]: value });
    }

    // ==========================================
    // SUBSCRIPTIONS
    // ==========================================

    /**
     * Subscribe to state changes
     * @param {string} key - State key to watch ('*' for all changes)
     * @param {Function} callback
     * @returns {() => void} Unsubscribe function
     */
    function subscribe(key, callback) {
        if (!subscribers.has(key)) {
            subscribers.set(key, new Set());
        }
        const subs = subscribers.get(key);
        if (subs) subs.add(callback);

        // Return unsubscribe function
        return () => {
            const subs = subscribers.get(key);
            if (subs) {
                subs.delete(callback);
            }
        };
    }

    /**
     * Notify all subscribers for a key
     * @param {string} key
     * @param {any} value
     */
    function notifySubscribers(key, value) {
        const subs = subscribers.get(key);
        if (subs) {
            subs.forEach(callback => {
                try {
                    callback(value, state);
                } catch (e) {
                    console.error('[VNPTStore] Subscriber error:', e);
                }
            });
        }
    }

    // ==========================================
    // PERSISTENCE
    // ==========================================
    const PERSIST_KEYS = ['isDarkMode', 'isPanelMinimized', 'selectedRoom', 'scanResults', 'roomStatistics'];
    const STORAGE_KEY = 'vnpt_store_state';

    /**
     * Persist state to localStorage
     * @param {string[]} changedKeys
     */
    function persistState(changedKeys) {
        const shouldPersist = changedKeys.some(k => PERSIST_KEYS.includes(k));
        if (!shouldPersist) return;

        try {
            const persistedState = {};
            PERSIST_KEYS.forEach(key => {
                // @ts-ignore
                persistedState[key] = state[key];
            });

            // Giao tiếp qua Background hoặc lưu thẳng chrome.storage
            const _chrome = (/** @type {any} */(window)).chrome;
            if (_chrome?.storage?.local) {
                _chrome.storage.local.set({ [STORAGE_KEY]: {
                    data: persistedState,
                    timestamp: Date.now()
                }});
            }
        } catch (e) {
            console.warn('[VNPTStore] Failed to persist state:', e);
        }
    }

    /**
     * Restore state from localStorage
     */
    function restoreState() {
        try {
            const _chrome = (/** @type {any} */(window)).chrome;
            if (_chrome?.storage?.local) {
                _chrome.storage.local.get([STORAGE_KEY], (result) => {
                    const stored = result[STORAGE_KEY];
                    if (stored) {
                        const { data, timestamp } = stored;
                        // Only restore if less than 24 hours old
                        if (Date.now() - timestamp < 24 * 60 * 60 * 1000) {
                            Object.assign(state, data);
                            if (window.VNPTLogger) {
                                VNPTLogger.debug('Store', 'State restored from chrome.storage');
                            }
                            // Notify subscribers that state has been restored
                            notifySubscribers('*', state);
                        }
                    }
                });
            }
        } catch (e) {
            console.warn('[VNPTStore] Failed to restore state:', e);
        }
    }

    // ==========================================
    // ACTIONS (Predefined state mutations)
    // ==========================================
    const actions = {
        /** 
         * Start scanning
         * @param {'drug' | 'room'} mode
         * @param {number} total 
         */
        startScan(mode, total) {
            setState({
                isScanning: true,
                scanMode: mode,
                scanProgress: { current: 0, total: total }
            });
        },

        /** 
         * Update scan progress
         * @param {number} current 
         */
        updateProgress(current) {
            setState({
                scanProgress: { ...state.scanProgress, current }
            });
        },

        /** End scanning */
        endScan(results = {}, roomStats = {}) {
            setState({
                isScanning: false,
                scanMode: null,
                scanProgress: { current: 0, total: 0 },
                scanResults: { ...state.scanResults, ...results },
                roomStatistics: roomStats
            });
        },

        /** 
         * Select patient
         * @param {string} patientId 
         */
        selectPatient(patientId) {
            setState({ selectedPatientId: patientId });
        },

        /** Toggle dark mode */
        toggleDarkMode() {
            setState({ isDarkMode: !state.isDarkMode });
        },

        /** Toggle panel */
        togglePanel() {
            setState({ isPanelMinimized: !state.isPanelMinimized });
        },

        /** Set filter */
        setFilter(room = null, doctor = null) {
            setState({ selectedRoom: room, selectedDoctor: doctor });
        },

        /** Clear scan results */
        clearResults() {
            setState({ scanResults: {} });
        },

        /** 
         * Update patient list
         * @param {any[]} patients 
         */
        setPatientList(patients) {
            setState({ patientList: patients });
        },

        /** 
         * Update patient data map for fast lookup
         * @param {any[]} rows 
         */
        updatePatientDataMap(rows) {
            if (!rows) return;
            const newMap = { ...state.patientDataMap };
            rows.forEach(row => {
                if (row.id) newMap[row.id] = row.data;
            });
            setState({ patientDataMap: newMap });
        },

        /**
         * Update vitals data map
         * @param {string} patientId 
         * @param {{weight?: string, height?: string, bmi?: string, bloodPressure?: string, pulse?: string, temperature?: string}} vitals 
         */
        updateVitals(patientId, vitals) {
            const newMap = { ...state.vitalsDataMap };
            newMap[patientId] = vitals;
            setState({ vitalsDataMap: newMap });
        },

        /**
         * Update medical history data map
         * @param {string} patientId 
         * @param {any} history 
         */
        updateMedicalHistory(patientId, history) {
            const newMap = { ...state.medicalHistoryMap };
            newMap[patientId] = history;
            setState({ medicalHistoryMap: newMap });
        }
    };

    // ==========================================
    // INITIALIZATION
    // ==========================================
    function init() {
        restoreState();
        if (window.VNPTLogger) {
            VNPTLogger.info('Store', '✅ State management initialized');
        }
    }

    // ==========================================
    // PUBLIC API
    // ==========================================
    return {
        // Core
        getState,
        get,
        set,
        setState,
        subscribe,
        init,

        // Actions (predefined mutations)
        actions,

        // Direct state access (read-only, for debugging)
        get state() { return { ...state }; }
    };
})();

// Export globally
window.VNPTStore = VNPTStore;
