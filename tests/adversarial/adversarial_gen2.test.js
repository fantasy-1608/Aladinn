/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { renderSparkline, createSparklineElement, generateSparklineImage } from '../../content/scanner/sparkline.js';

describe('Adversarial Sparkline Tests', () => {
    let originalGetContext;
    let originalToDataURL;
    let mockCtx;

    beforeAll(() => {
        originalGetContext = HTMLCanvasElement.prototype.getContext;
        originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

        mockCtx = {
            fillRect: vi.fn(),
            moveTo: vi.fn(),
            lineTo: vi.fn(),
            stroke: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn(),
            fill: vi.fn(),
            fillStyle: '',
            strokeStyle: '',
            lineWidth: 1
        };

        HTMLCanvasElement.prototype.getContext = function (type) {
            if (type === '2d') {
                return mockCtx;
            }
            return null;
        };

        HTMLCanvasElement.prototype.toDataURL = function () {
            return 'data:image/png;base64,mockbase64data';
        };
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    afterAll(() => {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    });

    it('should safely reject all nulls and non-objects', () => {
        const dataPoints = [null, null, undefined, "hello", 123, true, false];
        const res = createSparklineElement(dataPoints);
        expect(res).toBeNull();
    });

    it('should safely reject strings that look like numbers', () => {
        const dataPoints = [{ hr: "100" }, { temp: "38.0" }];
        const res = createSparklineElement(dataPoints);
        expect(res).toBeNull();
    });

    it('should handle NaN and Infinity', () => {
        const dataPoints = [{ hr: NaN }, { hr: Infinity }, { hr: -Infinity }];
        const res = createSparklineElement(dataPoints);
        expect(res).toBeNull();
    });

    it('should handle massive data points without breaking', () => {
        const dataPoints = Array.from({length: 100000}, (_, i) => ({ hr: 80 + (i % 10), temp: 36 + (i % 3) }));
        const res = createSparklineElement(dataPoints);
        expect(res).not.toBeNull();
        expect(mockCtx.lineTo.mock.calls.length).toBeGreaterThan(0);
    });

    it('should handle an array with mixed valid and invalid data', () => {
        const dataPoints = [{ hr: "100" }, { hr: 80 }, { temp: NaN }, { hr: Infinity }];
        const res = createSparklineElement(dataPoints);
        expect(res).not.toBeNull();
        expect(mockCtx.moveTo).toHaveBeenCalled();
    });

    it('should reject array of empty objects', () => {
        const dataPoints = [{}, {}, {}];
        const res = createSparklineElement(dataPoints);
        expect(res).toBeNull();
    });

    it('should safely handle Object.create(null) objects', () => {
        const d1 = Object.create(null);
        d1.hr = 80;
        const dataPoints = [d1, Object.create(null)];
        const res = createSparklineElement(dataPoints);
        expect(res).not.toBeNull();
    });

    it('should throw if custom getter throws (transparently bubble up)', () => {
        const evil = {};
        Object.defineProperty(evil, 'hr', {
            get() { throw new Error('Evil getter'); }
        });
        const dataPoints = [{ hr: 80 }, evil];
        expect(() => createSparklineElement(dataPoints)).toThrow('Evil getter');
    });
});
