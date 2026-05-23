/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { generateSparklineImage } from '../content/scanner/sparkline.js';

describe('Sparkline UI - Deep Adversarial Tests 4', () => {
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

    it('should crash on MAX_VALUE when height > paddedRange', () => {
        const dataPoints = [{ hr: Number.MAX_VALUE, temp: 37.0 }, { hr: Number.MAX_VALUE, temp: 37.0 }];
        // hr paddedRange is 120, so setting height to 200 causes overflow to Infinity
        expect(() => {
            generateSparklineImage(dataPoints, { height: 200 });
        }).toThrow("moveTo arguments must be finite");
    });
});
