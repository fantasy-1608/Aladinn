/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { renderSparkline } from '../content/scanner/sparkline.js';

describe('Adversarial Sparkline Tests - Overflow Edge Cases with renderSparkline', () => {
    it('should crash when getY computes to Infinity due to math overflow', () => {
        let moveToCalled = false;
        const mockCtx = {
            fillRect: vi.fn(),
            moveTo: vi.fn((x, y) => {
                moveToCalled = true;
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

        const canvas = {
            width: 120,
            height: 1e100, // Explicitly large to cause overflow
            getContext: () => mockCtx
        };

        const dataPoints = [{ hr: Number.MAX_VALUE }, { hr: 80 }];
        const options = {};
        
        expect(() => {
            renderSparkline(canvas, dataPoints, options);
        }).toThrow("moveTo arguments must be finite");
        
        expect(moveToCalled).toBe(true);
    });
});
