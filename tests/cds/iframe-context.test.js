// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

// Mock DB, Extractor, Engine, and UI
vi.mock('../../content/cds/db.js', () => ({
    initializeKnowledgeBase: vi.fn().mockResolvedValue({}),
    importCrawledDrugs: vi.fn(),
    getCrawlMetadata: vi.fn().mockResolvedValue({ seededAt: Date.now() })
}));

vi.mock('../../content/cds/extractor.js', () => ({
    CDSExtractor: {
        extractContext: vi.fn().mockResolvedValue({
            patient: { id: 'BN123', name: 'TEST PATIENT' },
            encounter: { diagnoses: [] },
            medications: [],
            labs: []
        }),
        _fetchedPatients: new Set()
    },
    CDSCacheManager: {
        resetMedications: vi.fn(),
        handleData: vi.fn()
    }
}));

vi.mock('../../content/cds/engine.js', () => ({
    analyzeLocally: vi.fn().mockResolvedValue({ alerts: [], debug: {} }),
    runBhytAuditRules: vi.fn(),
    icdMatchesRequirement: vi.fn()
}));

vi.mock('../../content/cds/ui.js', () => ({
    CDSUI: {
        init: vi.fn(),
        hide: vi.fn(),
        update: vi.fn(),
        showCrawlDate: vi.fn(),
        hasUserDismissed: false
    }
}));

describe('CDS Iframe Context and Lifecycle Management', () => {
    let initCDS;

    beforeEach(async () => {
        // Mock chrome API
        globalThis.chrome = {
            runtime: {
                sendMessage: vi.fn()
            }
        };

        // Reset document body
        document.body.innerHTML = '';

        // Dynamically import to ensure all mocks are in place
        const module = await import('../../content/cds/index.js');
        initCDS = module.initCDS;
    });

    afterEach(() => {
        vi.restoreAllMocks();
        delete globalThis.chrome;
    });

    it('should reset user dismiss status and clean up registry on status changes', async () => {
        const { CDSUI } = await import('../../content/cds/ui.js');
        
        // 1. Enabling CDS should initialize UI and reset hasUserDismissed to false
        CDSUI.hasUserDismissed = true;
        await initCDS(true);
        expect(CDSUI.init).toHaveBeenCalled();
        expect(CDSUI.hasUserDismissed).toBe(false);

        // 2. Disabling CDS should hide the UI and clean up
        await initCDS(false);
        expect(CDSUI.hide).toHaveBeenCalled();
    });
});
