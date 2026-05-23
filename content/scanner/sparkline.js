export function renderSparkline(canvas, dataPoints, options) {
    options = options || {};
    if (!canvas || typeof canvas.getContext !== 'function') return;
    if (!dataPoints || !Array.isArray(dataPoints) || dataPoints.length === 0) return;
    
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    
    const hrColor = options.hrColor || '#004f9e';
    const tempColor = options.tempColor || '#c62828';
    
    ctx.fillStyle = options.bgColor || '#ffffff';
    ctx.fillRect(0, 0, width, height);
    
    const drawSeries = (key, color, fixedMin, fixedMax) => {
        const validPoints = [];
        const len = dataPoints.length;
        
        // Downsample massive arrays to prevent OOM and maintain high drawing speed.
        const maxPoints = 2000;
        const step = len > maxPoints ? Math.ceil(len / maxPoints) : 1;
        
        for (let i = 0; i < len; i += step) {
            const d = dataPoints[i];
            if (d && typeof d === 'object') {
                const val = d[key];
                if (typeof val === 'number' && Number.isFinite(val)) {
                    validPoints.push({ index: i, value: val });
                }
            }
        }
        
        if (validPoints.length === 0) return;

        const range = fixedMax - fixedMin;
        const paddedMin = fixedMin - range * 0.1;
        const paddedMax = fixedMax + range * 0.1;
        const paddedRange = paddedMax - paddedMin;
        
        const paddingX = 4;
        const stepX = len > 1 ? (width - paddingX * 2) / (len - 1) : 0;
        const getX = (index) => (len === 1) ? width / 2 : paddingX + index * stepX;
        const getY = (val) => {
            return height - ((val - paddedMin) / paddedRange) * height;
        };

        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 1.5;

        ctx.beginPath();
        validPoints.forEach((p, i) => {
            const x = getX(p.index);
            const y = getY(p.value);
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        validPoints.forEach((p) => {
            ctx.beginPath();
            ctx.arc(getX(p.index), getY(p.value), 2, 0, 2 * Math.PI);
            ctx.fill();
        });
    };

    drawSeries('hr', hrColor, 50, 150);
    drawSeries('temp', tempColor, 36.0, 40.0);
}

export function createSparklineElement(dataPoints, options) {
    options = options || {};
    if (!dataPoints || !Array.isArray(dataPoints) || dataPoints.length === 0) return null;
    
    const hasValidNumericPoints = dataPoints.some(d => {
        if (!d || typeof d !== 'object') return false;
        const hr = d.hr;
        const temp = d.temp;
        return (typeof hr === 'number' && Number.isFinite(hr)) || 
               (typeof temp === 'number' && Number.isFinite(temp));
    });
    if (!hasValidNumericPoints) return null;

    const canvas = document.createElement('canvas');
    let w = options.width;
    let h = options.height;
    canvas.width = (typeof w === 'number' && Number.isFinite(w) && w > 0) ? w : 120;
    canvas.height = (typeof h === 'number' && Number.isFinite(h) && h > 0) ? h : 40;
    
    renderSparkline(canvas, dataPoints, options);
    return canvas;
}

export function generateSparklineImage(dataPoints, options) {
    options = options || {};
    const canvas = createSparklineElement(dataPoints, options);
    if (!canvas) return null;
    return canvas.toDataURL('image/png');
}

