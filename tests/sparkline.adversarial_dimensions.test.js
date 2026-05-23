/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { createSparklineElement } from '../content/scanner/sparkline.js';

describe('Adversarial Sparkline Canvas Crash Tests - Dimensions', () => {
    it('should not crash with invalid or huge dimensions', () => {
        const dataPoints = [{ hr: 80 }, { hr: 90 }];
        expect(() => createSparklineElement(dataPoints, { width: 0, height: 0 })).not.toThrow();
        expect(() => createSparklineElement(dataPoints, { width: NaN, height: NaN })).not.toThrow();
        expect(() => createSparklineElement(dataPoints, { width: 1e8, height: 1e8 })).not.toThrow();
        expect(() => createSparklineElement(dataPoints, { width: -100, height: -100 })).not.toThrow();
    });
});
