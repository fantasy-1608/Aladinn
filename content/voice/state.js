/**
 * HIS Voice Assistant - State Module
 * Centralized state management
 */

// ========================================
// Global State
// ========================================
window.recognition = null;
window.isRecording = false;
window.isPanelOpen = false;
window.isPanelFaded = false;
window.currentResults = null;
window.transcript = '';
window.currentModel = 'gemini-3-flash-preview';
window.isExtensionEnabled = true;
window.miniBtnObserver = null;
window.positionMiniBtn = null;
window.isLocked = false;
window.masterPasswordHash = '';
window.shouldStopRecording = false;
window.isChuyenVienEnabled = false;
window.geminiBaseUrl = '';
window.storageKey = null; // AES-GCM key derived from PIN

// ========================================
// State Getters & Setters
// ========================================
const State = {
    // Getters
    getTranscript: () => window.transcript,
    getResults: () => window.currentResults,
    isRecording: () => window.isRecording,
    isLocked: () => window.isLocked,
    isPanelOpen: () => window.isPanelOpen,
    getModel: () => window.currentModel,

    // Setters
    setTranscript: (val) => { window.transcript = val; },
    setResults: (val) => { window.currentResults = val; },
    setRecording: (val) => { window.isRecording = val; },
    setLocked: (val) => { window.isLocked = val; },
    setPanelOpen: (val) => { window.isPanelOpen = val; },
    setModel: (val) => { window.currentModel = val; },
    setPasswordHash: (val) => { window.masterPasswordHash = val; },
    setChuyenVienEnabled: (val) => { window.isChuyenVienEnabled = val; },

    // Complex getters
    getPasswordHash: () => window.masterPasswordHash,
    isChuyenVienEnabled: () => window.isChuyenVienEnabled,
    getRecognition: () => window.recognition,
    setRecognition: (val) => { window.recognition = val; }
};
