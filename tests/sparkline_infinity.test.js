/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { createSparklineElement } from '../content/scanner/sparkline.js';

describe('Infinity test', () => {
    it('handles infinity without throwing', () => {
        const canvas = createSparklineElement([{ hr: Infinity }]);
        expect(canvas).toBeDefined();
    });
});
