/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderSparkline, createSparklineElement, generateSparklineImage } from '../../content/scanner/sparkline.js';

describe('Adversarial Sparkline UI Tests - Filter Logic', () => {
    let originalGetContext;
    let originalToDataURL;
    let mockContext;

    beforeAll(() => {
        originalGetContext = HTMLCanvasElement.prototype.getContext;
        originalToDataURL = HTMLCanvasElement.prototype.toDataURL;

        mockContext = {
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
                return mockContext;
            }
            return null;
        };
    });

    afterAll(() => {
        HTMLCanvasElement.prototype.getContext = originalGetContext;
    });

    it('should NOT treat empty strings or booleans as valid data points', () => {
        mockContext.arc.mockClear();
        const dataPoints = [
            { hr: "", temp: false },
            { hr: "   ", temp: true },
            { hr: null, temp: undefined }
        ];
        
        createSparklineElement(dataPoints);
        console.log("calls to arc:", mockContext.arc.mock.calls.length);
        expect(mockContext.arc).not.toHaveBeenCalled();
    });
});
