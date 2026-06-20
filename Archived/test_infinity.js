import { generateSparklineImage } from './content/scanner/sparkline.js';

// mock DOM
globalThis.document = {
    createElement: () => {
        return {
            width: 120,
            height: 40,
            getContext: () => ({
                fillRect: () => {},
                moveTo: (x, y) => {
                    if (!Number.isFinite(x) || !Number.isFinite(y)) {
                        throw new Error('moveTo arguments must be finite');
                    }
                },
                lineTo: (x, y) => {
                    if (!Number.isFinite(x) || !Number.isFinite(y)) {
                        throw new Error('lineTo arguments must be finite');
                    }
                },
                stroke: () => {},
                beginPath: () => {},
                arc: (x, y, r, sa, ea) => {
                    if (!Number.isFinite(x) || !Number.isFinite(y)) {
                        throw new Error('arc arguments must be finite');
                    }
                },
                fill: () => {}
            }),
            toDataURL: () => 'data:image/png;base64,mockbase64data'
        };
    }
};

const dataPoints = [{ hr: Infinity, temp: -Infinity }];
try {
    generateSparklineImage(dataPoints);
    console.log('PASSED');
} catch (e) {
    console.log('FAILED:', e.message);
}
