// @vitest-environment jsdom
import { describe, expect, it, beforeEach } from 'vitest';
import { CDSExtractor } from '../../content/cds/extractor.js';
import { CDSCache } from '../../content/cds/cds-cache.js';

describe('CDSExtractor: verifyContextLock', () => {
    beforeEach(() => {
        CDSCache.reset();
    });

    it('should pass context validation when DOM, Cache, and API match perfectly', () => {
        CDSExtractor.getPatientId = () => '2605201278';
        CDSExtractor.getEncounterId = () => '1537622';

        CDSCache.handleData({
            benhnhanId: '2605201278',
            khambenhId: '1537622'
        });

        const ctx = {
            rowId: '1537622',
            KHAMBENHID: '1537622',
            HOSOBENHANID: 'HSBA456',
            BENHNHANID: '2605201278'
        };

        expect(CDSExtractor.verifyContextLock(ctx)).toBe(true);
    });

    it('should fail context validation if patient ID is mismatched', () => {
        CDSExtractor.getPatientId = () => '2605201278';
        CDSExtractor.getEncounterId = () => '1537622';

        CDSCache.handleData({
            benhnhanId: '2605201278',
            khambenhId: '1537622'
        });

        const ctx = {
            rowId: '1537622',
            KHAMBENHID: '1537622',
            HOSOBENHANID: 'HSBA456',
            BENHNHANID: '9999999999' // Mismatched patient ID
        };

        expect(CDSExtractor.verifyContextLock(ctx)).toBe(false);
    });

    it('should handle type mismatches between string and number robustly (e.g. 1537622 vs "1537622")', () => {
        CDSExtractor.getPatientId = () => '2605201278';
        CDSExtractor.getEncounterId = () => '1537622';

        CDSCache.handleData({
            benhnhanId: '2605201278',
            khambenhId: '1537622'
        });

        const ctx = {
            rowId: 1537622,               // Number
            KHAMBENHID: 1537622,          // Number
            HOSOBENHANID: 'HSBA456',
            BENHNHANID: 2605201278        // Number
        };

        // This would fail in strict equality (===) but should pass under normalized string checks
        expect(CDSExtractor.verifyContextLock(ctx)).toBe(true);
    });

    it('should handle partial cache states gracefully where benhnhanId is null but khambenhId and DOM patientId match', () => {
        CDSExtractor.getPatientId = () => '2605201278';
        CDSExtractor.getEncounterId = () => '1537622';

        // Partial cache: benhnhanId is not set in the intercepted payload, but khambenhId is
        CDSCache.handleData({
            patientId: '2605201278', // alias
            khambenhId: '1537622'
        });

        // Verify cache state is exactly as described in the screenshot:
        const cache = CDSCache.get();
        expect(cache.benhnhanId).toBeNull();
        expect(cache.khambenhId).toBe('1537622');

        const ctx = {
            rowId: '1537622',
            KHAMBENHID: '1537622',
            HOSOBENHANID: 'HSBA456',
            BENHNHANID: '2605201278' // Matching DOM patientId
        };

        // This must pass because the API context's patient ID matches the active DOM patient ID,
        // and the encounter ID matches the cache khambenhId!
        expect(CDSExtractor.verifyContextLock(ctx)).toBe(true);
    });

    it('should pass context validation via name-matching fallback and warm the cache when cache is cold', () => {
        CDSExtractor.getPatientId = () => '2605170109';
        CDSExtractor.getPatientName = () => 'HUỲNH VĂN ĐÔNG✨';
        CDSExtractor.getEncounterId = () => 'encounter_12345';

        // Cache is empty/cold
        const cacheBefore = CDSCache.get();
        expect(cacheBefore.benhnhanId).toBeNull();
        expect(cacheBefore.khambenhId).toBeNull();

        const ctx = {
            rowId: '5',
            KHAMBENHID: '1531808',
            HOSOBENHANID: '1457314',
            BENHNHANID: '950040',
            patientName: 'HUỲNH VĂN ĐÔNG<button type="button" class="his-inline-icon">...</button>'
        };

        // Name-matching fallback should pass and warm the cache
        expect(CDSExtractor.verifyContextLock(ctx)).toBe(true);

        const cacheAfter = CDSCache.get();
        expect(cacheAfter.benhnhanId).toBe('950040');
        expect(cacheAfter.khambenhId).toBe('1531808');
        expect(cacheAfter.patientIds.has('950040')).toBe(true);
        expect(cacheAfter.patientIds.has('5')).toBe(true);
    });

    it('should fail context validation if names do not match even with name-matching fallback under cold cache', () => {
        CDSExtractor.getPatientId = () => '2605170109';
        CDSExtractor.getPatientName = () => 'HUỲNH VĂN ĐÔNG';
        CDSExtractor.getEncounterId = () => 'encounter_12345';

        const ctx = {
            rowId: '5',
            KHAMBENHID: '1531808',
            HOSOBENHANID: '1457314',
            BENHNHANID: '950040',
            patientName: 'NGUYỄN VĂN A'
        };

        expect(CDSExtractor.verifyContextLock(ctx)).toBe(false);
    });

    it('should correctly normalize Vietnamese đ and Đ to d in _cleanName and pass verification', () => {
        expect(CDSExtractor._cleanName('ĐỖ ĐỨC ĐÔNG')).toBe('do duc dong');
        expect(CDSExtractor._cleanName('đỗ đức đông')).toBe('do duc dong');
        
        CDSExtractor.getPatientId = () => '111111';
        CDSExtractor.getPatientName = () => 'ĐỖ ĐỨC ĐÔNG';
        CDSExtractor.getEncounterId = () => 'encounter_999';

        const ctx = {
            rowId: '999',
            KHAMBENHID: '1531808',
            HOSOBENHANID: '1457314',
            BENHNHANID: '222222',
            patientName: 'đỗ đức đông'
        };

        expect(CDSExtractor.verifyContextLock(ctx)).toBe(true);
    });
});
