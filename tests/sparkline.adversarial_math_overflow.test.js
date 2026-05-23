/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { createSparklineElement } from '../content/scanner/sparkline.js';

describe('Adversarial Sparkline Tests - Overflow Edge Cases', () => {
    let originalGetContext;
    let originalHeightDescriptor;
    let mockCtx;

    beforeAll(() => {
        originalGetContext = HTMLCanvasElement.prototype.getContext;
        originalHeightDescriptor = Object.getOwnPropertyDescriptor(HTMLCanvasElement.prototype, 'height');

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
            if (type === '2d') return mockCtx;
            return null;
        };

        Object.defineProperty(HTMLCanvasElement.prototype, 'height', {
            get() { return 1e300; },
            configurable: true
        });
    });

    afterAll(() => {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
        if (originalHeightDescriptor) {
            Object.defineProperty(HTMLCanvasElement.prototype, 'height', originalHeightDescriptor);
        } else {
            delete HTMLCanvasElement.prototype.height;
        }
    });

    it('should crash when getY computes to Infinity due to math overflow', () => {
        // Number.isFinite(Number.MAX_VALUE) is true.
        // But (Number.MAX_VALUE / 120) * 1e100 evaluates to Infinity.
        // This causes getY to return -Infinity, crashing the canvas mock.
        const dataPoints = [{ hr: Number.MAX_VALUE }];
        const options = { height: 1e100 };
        
        expect(() => {
            createSparklineElement(dataPoints, options);
        }).toThrow("moveTo arguments must be finite");
    });
});
