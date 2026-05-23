/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { renderSparkline, createSparklineElement, generateSparklineImage } from '../../content/scanner/sparkline.js';

describe('Adversarial Sparkline UI Tests', () => {
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

    it('should survive dataPoints containing null or undefined elements', () => {
        const dataPoints = [null, undefined, { hr: 80, temp: 37.0 }];
        expect(() => {
            createSparklineElement(dataPoints);
        }).not.toThrow();
    });

    it('should survive massive data points (stress test)', () => {
        const massiveData = Array.from({ length: 100000 }, (_, i) => ({
            hr: 60 + (i % 40),
            temp: 36.0 + (i % 2)
        }));
        expect(() => {
            createSparklineElement(massiveData);
        }).not.toThrow();
    });

    it('should handle strings that coerce to numbers, empty strings, booleans without crashing', () => {
        const dataPoints = [
            { hr: "100", temp: "37" }, // Valid string numbers
            { hr: "", temp: false },   // Empty string and boolean
            { hr: "abc", temp: NaN }   // Invalid numbers
        ];
        expect(() => {
            createSparklineElement(dataPoints);
        }).not.toThrow();
    });
    
    it('should survive dataPoints being a string instead of an array', () => {
        expect(() => {
            createSparklineElement("not an array");
        }).not.toThrow();
    });
});
