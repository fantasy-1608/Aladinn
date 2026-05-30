/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderSparkline, createSparklineElement, generateSparklineImage } from '../content/scanner/sparkline.js';

describe('Sparkline UI - Adversarial Tests', () => {
    let originalGetContext;
    let originalToDataURL;

    beforeAll(() => {
        originalGetContext = HTMLCanvasElement.prototype.getContext;
        originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

        HTMLCanvasElement.prototype.getContext = function (type) {
            if (type === '2d') {
                return {
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

    it('should not crash if dataPoints is not an array (e.g. an object)', () => {
        const nonArrayData = { hr: 80, temp: 37.5 };
        expect(() => {
            generateSparklineImage(nonArrayData);
        }).not.toThrow();
    });

    it('should not crash if a data point is null or undefined', () => {
        const dataPoints = [{ hr: 80, temp: 37.0 }, null, { hr: 90, temp: 38.0 }];
        expect(() => {
            generateSparklineImage(dataPoints);
        }).not.toThrow();
    });

    it('should handle missing options gracefully', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 100;
        canvas.height = 100;
        expect(() => {
            renderSparkline(canvas, [{ hr: 80 }], null);
        }).not.toThrow();
    });

    it('should handle invalid canvas gracefully', () => {
        const invalidCanvas = { width: 100, height: 100 };
        expect(() => {
            renderSparkline(invalidCanvas, [{ hr: 80 }]);
        }).not.toThrow();
    });
    
    it('should handle massive data points without breaking', () => {
        const massiveData = Array.from({ length: 10000 }, (_, i) => ({ hr: 80 + (i % 20), temp: 37.0 }));
        expect(() => {
            generateSparklineImage(massiveData);
        }).not.toThrow();
    });
});
