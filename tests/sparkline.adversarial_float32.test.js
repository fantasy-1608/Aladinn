/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { createSparklineElement } from '../content/scanner/sparkline.js';

describe('Adversarial Sparkline Canvas Crash Tests', () => {
    it('should not crash with values exceeding Float32 range', () => {
        // Values > 3.4028235e38 will become Infinity when cast to float32 internally
        const dataPoints = [
            { hr: 1e40 }, 
            { hr: -1e40 },
            { hr: Number.MAX_VALUE },
            { hr: -Number.MAX_VALUE }
        ];
        expect(() => createSparklineElement(dataPoints)).not.toThrow();
    });
});
