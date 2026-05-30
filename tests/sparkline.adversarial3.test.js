// @vitest-environment jsdom
import { describe, it, expect, beforeAll } from 'vitest';
import { renderSparkline, createSparklineElement } from '../content/scanner/sparkline.js';

beforeAll(() => {
    HTMLCanvasElement.prototype.getContext = () => {
        return {
            beginPath: () => {},
            moveTo: () => {},
            lineTo: () => {},
            stroke: () => {},
            clearRect: () => {},
            fillRect: () => {},
            arc: () => {},
            createLinearGradient: () => {
                return { addColorStop: () => {} };
            },
            fillStyle: '',
            strokeStyle: ''
        };
    };
});

describe('Canvas crash tests', () => {
    it('test various inputs', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 120;
        canvas.height = 40;
        const ctx = canvas.getContext('2d');
        
        ctx.beginPath();
        // Try Number.MAX_VALUE
        try {
            ctx.arc(0, Number.MAX_VALUE, 2, 0, 2 * Math.PI);
            console.log("MAX_VALUE works");
        } catch(e) { console.log("MAX_VALUE throws", e.message); }
        
        try {
            ctx.arc(0, NaN, 2, 0, 2 * Math.PI);
            console.log("NaN works");
        } catch(e) { console.log("NaN throws", e.message); }
        
        try {
            ctx.arc(0, Infinity, 2, 0, 2 * Math.PI);
            console.log("Infinity works");
        } catch(e) { console.log("Infinity throws", e.message); }
    });
});
