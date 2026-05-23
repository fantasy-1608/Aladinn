/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, afterAll, afterEach } from 'vitest';
import { renderSparkline, createSparklineElement, generateSparklineImage } from '../content/scanner/sparkline.js';

describe('Sparkline UI', () => {
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

    it('should create a canvas element with default dimensions', () => {
        const dataPoints = [{ hr: 80, temp: 37.0 }];
        const canvas = createSparklineElement(dataPoints);
        expect(canvas.width).toBe(120);
        expect(canvas.height).toBe(40);
        expect(canvas.tagName.toLowerCase()).toBe('canvas');
        expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 120, 40);
        expect(mockCtx.moveTo).toHaveBeenCalled();
        expect(mockCtx.arc).toHaveBeenCalled();
    });

    it('should create a canvas element with custom dimensions', () => {
        const dataPoints = [{ hr: 80, temp: 37.0 }];
        const canvas = createSparklineElement(dataPoints, { width: 200, height: 100 });
        expect(canvas.width).toBe(200);
        expect(canvas.height).toBe(100);
        expect(mockCtx.fillRect).toHaveBeenCalledWith(0, 0, 200, 100);
    });

    it('should generate a base64 image string', () => {
        const dataPoints = [{ hr: 80, temp: 37.0 }, { hr: 90, temp: 38.0 }];
        const dataUrl = generateSparklineImage(dataPoints);
        expect(dataUrl).toMatch(/^data:image\/png;base64,/);
        expect(mockCtx.lineTo).toHaveBeenCalled();
    });

    it('should handle empty or null data gracefully', () => {
        const emptyDataUrl = generateSparklineImage([]);
        expect(emptyDataUrl).toBeNull();

        const nullDataUrl = generateSparklineImage(null);
        expect(nullDataUrl).toBeNull();
        
        expect(mockCtx.fillRect).not.toHaveBeenCalled();
    });

    it('should handle sparse data without crashing', () => {
        const dataPoints = [
            { hr: 80 }, // missing temp
            { temp: 37.5 }, // missing hr
            { hr: 120, temp: 39.0 }
        ];
        const canvas = createSparklineElement(dataPoints);
        expect(canvas).toBeDefined();
        const dataUrl = generateSparklineImage(dataPoints);
        expect(dataUrl).toMatch(/^data:image\/png;base64,/);
        expect(mockCtx.arc).toHaveBeenCalled();
    });
});
