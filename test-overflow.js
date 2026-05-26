import { JSDOM } from 'jsdom';
import { createSparklineElement } from './content/scanner/sparkline.js';

const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.HTMLCanvasElement = dom.window.HTMLCanvasElement;

const mockCtx = {
    fillRect: () => {},
    moveTo: (x, y) => {
        console.log('moveTo called with:', x, y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) {
            throw new Error('moveTo arguments must be finite');
        }
    },
    lineTo: () => {},
    stroke: () => {},
    beginPath: () => {},
    arc: () => {},
    fill: () => {},
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1
};

HTMLCanvasElement.prototype.getContext = function (type) {
    if (type === '2d') return mockCtx;
    return null;
};

try {
    const dataPoints = [{ hr: Number.MAX_VALUE }];
    const options = { height: 1e100 };
    createSparklineElement(dataPoints, options);
    console.log('No error thrown!');
} catch (e) {
    console.log('Error thrown:', e.message);
}
