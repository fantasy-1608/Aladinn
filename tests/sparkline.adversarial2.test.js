/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderSparkline, createSparklineElement, generateSparklineImage } from '../content/scanner/sparkline.js';

describe('Sparkline UI - Deep Adversarial Tests', () => {
    let originalGetContext;
    let originalToDataURL;
    let mockCtx;

    beforeAll(() => {
        originalGetContext = HTMLCanvasElement.prototype.getContext;
        originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

        mockCtx = {
            fillRect: vi.fn(),
            moveTo: vi.fn((x, y) => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    throw new Error("moveTo arguments must be finite");
                }
            }),
            lineTo: vi.fn((x, y) => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    throw new Error("lineTo arguments must be finite");
                }
            }),
            stroke: vi.fn(),
            beginPath: vi.fn(),
            arc: vi.fn((x, y, r, sa, ea) => {
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    throw new Error("arc arguments must be finite");
                }
            }),
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

    afterAll(() => {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    });

    it('should reject Infinity and -Infinity safely without throwing in rendering', () => {
        const dataPoints = [{ hr: Infinity, temp: -Infinity }];
        // The current implementation uses typeof d.hr === 'number' && !isNaN(d.hr)
        // Which evaluates to true for Infinity.
        // It will pass Infinity to getY, resulting in non-finite values and possibly throwing.
        expect(() => {
            generateSparklineImage(dataPoints);
        }).not.toThrow();
    });

    it('should not mutate original dataPoints', () => {
        const dataPoints = Object.freeze([{ hr: 80, temp: 37.0 }]);
        expect(() => {
            generateSparklineImage(dataPoints);
        }).not.toThrow();
    });

    it('should handle massive arrays smoothly without OOM', () => {
        const dataPoints = Array(1000000).fill({ hr: 100, temp: 38 });
        const start = performance.now();
        const res = generateSparklineImage(dataPoints);
        const end = performance.now();
        expect(res).toBeTruthy();
        expect(res).toBeTruthy();
    });

    it('should handle Object.create(null) as data point without crashing', () => {
        const pt = Object.create(null);
        pt.hr = 80;
        expect(() => {
            generateSparklineImage([pt]);
        }).not.toThrow();
    });
});
