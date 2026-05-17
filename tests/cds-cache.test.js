// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { CDSCache } from '../content/cds/cds-cache.js';

describe('CDS Cache Manager', () => {
    beforeEach(() => {
        // Reset state before each test
        CDSCache.reset();
    });

    it('should initialize with empty cache', () => {
        const data = CDSCache.get();
        expect(data.diagnoses).toHaveLength(0);
        expect(data.medications).toHaveLength(0);
        expect(data.labs).toHaveLength(0);
    });

    it('should correctly handle incoming data and update patient key', () => {
        const payload = {
            benhnhanId: 'BN123',
            khambenhId: 'KB456',
            diagnoses: [{ code: 'M15', is_primary: true }],
            medications: [{ display_name: 'Paracetamol' }]
        };

        CDSCache.handleData(payload);

        const data = CDSCache.get();
        expect(data.benhnhanId).toBe('BN123');
        expect(data.khambenhId).toBe('KB456');
        expect(data.diagnoses).toHaveLength(1);
        expect(data.diagnoses[0].code).toBe('M15');
        expect(data.medications).toHaveLength(1);
        expect(data.medications[0].display_name).toBe('Paracetamol');
    });

    it('should full reset when composite patient key changes', () => {
        const payload1 = {
            benhnhanId: 'BN123',
            khambenhId: 'KB456',
            diagnoses: [{ code: 'M15', is_primary: true }]
        };
        CDSCache.handleData(payload1);

        // Verify payload1 saved
        expect(CDSCache.get().diagnoses).toHaveLength(1);

        const payload2 = {
            benhnhanId: 'BN789',
            khambenhId: 'KB012',
            diagnoses: [{ code: 'J01', is_primary: true }]
        };
        CDSCache.handleData(payload2);

        // Verify reset occurred and new data is present
        const data = CDSCache.get();
        expect(data.benhnhanId).toBe('BN789');
        expect(data.khambenhId).toBe('KB012');
        expect(data.diagnoses).toHaveLength(1); // Should not be 2!
        expect(data.diagnoses[0].code).toBe('J01');
    });

    it('should clear cache when receiving SESSION_LOGOUT', () => {
        // Setup initial data
        CDSCache.handleData({
            benhnhanId: 'BN123',
            khambenhId: 'KB456',
            diagnoses: [{ code: 'M15', is_primary: true }]
        });
        
        expect(CDSCache.get().benhnhanId).toBe('BN123');

        // Mock chrome API if not exists
        if (!global.chrome) global.chrome = { runtime: { onMessage: { addListener: () => {} } } };

        // Simulate logout event 
        const listeners = [];
        global.chrome.runtime.onMessage.addListener = (fn) => listeners.push(fn);
        
        // Re-setup listener to bind to our mock
        CDSCache.setupListener();
        
        // Fire event
        listeners.forEach(fn => fn({ type: 'SESSION_LOGOUT' }));

        // Assert reset
        const data = CDSCache.get();
        expect(data.benhnhanId).toBeNull();
        expect(data.diagnoses).toHaveLength(0);
    });
});
