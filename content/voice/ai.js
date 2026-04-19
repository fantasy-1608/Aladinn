/**
 * HIS Voice Assistant - AI Module
 * AI result processing and display.
 * API calls are routed through bridge.js → background/ai-client.js
 */
/* global requestAIViaBridge, MEDICAL_FIELDS, ICONS, copyToClipboard, VITAL_SIGNS */

// ========================================
// Process with AI
// ========================================
async function processWithAI() {
    if (!chrome.runtime?.id) {
        window.showToast('⚠️ Vui lòng refresh trang (F5)', true);
        return;
    }

    if (window.isLocked) {
        window.showToast('Vui lòng mở khóa Panel trước!', true);
        return;
    }

    const text = document.getElementById('his-transcript').value.trim();
    if (!text) return;

    try {
        document.getElementById('his-loading').classList.remove('aladinn-hidden');
        document.getElementById('his-process-btn').disabled = true;

        const cleanText = deIdentifyText(text);
        // Route through bridge → background ai-client
        const data = await requestAIViaBridge(cleanText, window.currentModel);
        
        // Extract metadata before storing results
        const meta = data._meta;
        delete data._meta;
        
        window.currentResults = data;
        window.displayResults(data, true);
        window.saveData();
        window.startAIButtonCooldown(3);
        
        // Show cost estimation
        if (meta && meta.totalTokens > 0) {
            const costVND = estimateCostVND(meta.model, meta.promptTokens, meta.outputTokens);
            window.showToast(`✅ Xong! (~${costVND} VNĐ, ${meta.totalTokens} tokens)`);
        }
    } catch (error) {
        window.showToast('Lỗi: ' + error.message, true);
        window.startAIButtonCooldown(3);
    } finally {
        document.getElementById('his-loading').classList.add('aladinn-hidden');
    }
}

/**
 * Estimate cost in VNĐ based on Gemini model pricing
 * Prices as of 2025 (per 1M tokens, converted to VNĐ ~25,500 rate):
 * - Flash: Input $0.075/1M, Output $0.30/1M
 * - Pro:   Input $1.25/1M,  Output $5.00/1M
 */
function estimateCostVND(model, inputTokens, outputTokens) {
    const USD_TO_VND = 25500;
    let inputPricePerM, outputPricePerM;
    
    if (model && model.toLowerCase().includes('pro')) {
        inputPricePerM = 1.25;
        outputPricePerM = 5.00;
    } else {
        // Flash (default)
        inputPricePerM = 0.075;
        outputPricePerM = 0.30;
    }
    
    const costUSD = (inputTokens * inputPricePerM + outputTokens * outputPricePerM) / 1_000_000;
    const costVND = Math.round(costUSD * USD_TO_VND);
    return costVND < 1 ? '<1' : costVND.toString();
}

function startAIButtonCooldown(seconds) {
    const btn = document.getElementById('his-process-btn');
    const originalText = '✨ Xử lý AI';
    let remaining = seconds;

    btn.disabled = true;
    const interval = setInterval(() => {
        remaining--;
        if (remaining <= 0) {
            clearInterval(interval);
            btn.innerText = originalText;
            btn.disabled = false;
        } else {
            btn.innerText = `Chờ ${remaining}s...`;
        }
    }, 1000);
}

// ========================================
// Note: Gemini API call logic has been moved to background/ai-client.js
// Content script now uses bridge.js → requestAIViaBridge()
// ========================================

// ========================================
// Display Results
// ========================================
function displayResults(data, isNew = true) {
    const container = document.getElementById('his-results-container');
    container.innerHTML = '';

    MEDICAL_FIELDS.forEach(field => {
        const value = data[field.key] || '';
        const item = createResultItem(field.label, value, field.icon);
        if (item) container.appendChild(item);
    });

    if (data.sinhHieu) {
        const vitals = createVitalSignsItem(data.sinhHieu);
        if (vitals) container.appendChild(vitals);
    }

    if (data.icd10Suggest && data.icd10Suggest.length > 0) {
        const icdSection = createICD10Section(data.icd10Suggest);
        if (icdSection) container.appendChild(icdSection);
    }

    document.getElementById('his-results-section').classList.remove('aladinn-hidden');

    if (isNew) {
        window.showToast('✅ Đã xử lý xong!');
    }
}

/**
 * Strips potential PHI (Personal Health Information) from text
 * @param {string} text 
 * @returns {string}
 */
function deIdentifyText(text) {
    if (!text) return '';
    let clean = text;
    // Strip Vietnamese full names: 25+ common surnames + up to 4 name words following
    // Covers: "Nguyễn Thị Ngọc Anh", "Trần Văn Ba", "Huỳnh Kim Ngân" etc.
    clean = clean.replace(
        /(Nguyễn|Trần|Lê|Phạm|Huỳnh|Hoàng|Phan|Vũ|Võ|Đặng|Bùi|Đỗ|Hồ|Ngô|Dương|Lý|Lương|Trịnh|Đinh|Mai|Tạ|Châu|Cao|Tô|Lâm)(\s+[A-ZÀ-Ỹa-zà-ỹ]+){1,4}/gi,
        '[NAME]'
    );
    // Strip ID numbers (10 or 12 digits — CCCD, CMND)
    clean = clean.replace(/\b\d{10}\b|\b\d{12}\b/g, '[ID]');
    // Strip medical record references (Mã BA, Mã BN, BA-xxxx, BN-xxxx)
    clean = clean.replace(/\b(MA\s*BA|MA\s*BN|BA|BN)[\s\-:]*\d{3,}/gi, '[RECORD_ID]');
    // Strip potential phone numbers
    clean = clean.replace(/\b(0|\+84)\d{9,10}\b/g, '[PHONE]');
    // Strip date-of-birth patterns (DD/MM/YYYY standalone, often PII)
    clean = clean.replace(/\b\d{2}\/\d{2}\/\d{4}\b/g, '[DATE]');
    // Strip BHYT/Insurance card numbers (HS, GD, DN followed by digits)
    clean = clean.replace(/\b[A-Z]{2}\d{10,}\b/g, '[INSURANCE_ID]');
    return clean;
}

function createResultItem(label, value, iconName) {
    if (!value) return null;

    const item = document.createElement('div');
    item.className = 'his-result-item';
    item.title = value;

    // Use elements instead of innerHTML for data
    const iconDiv = document.createElement('div');
    iconDiv.className = 'his-result-icon';
    iconDiv.innerHTML = ICONS[iconName] || ''; // Icons are trusted constants

    const contentDiv = document.createElement('div');
    contentDiv.className = 'his-result-content';

    const labelDiv = document.createElement('div');
    labelDiv.className = 'his-result-label';
    labelDiv.textContent = label;

    const valueDiv = document.createElement('div');
    valueDiv.className = 'his-result-value';
    valueDiv.textContent = value; // Safe textContent

    contentDiv.appendChild(labelDiv);
    contentDiv.appendChild(valueDiv);

    const copyBtn = document.createElement('button');
    copyBtn.className = 'his-copy-btn';
    copyBtn.title = 'Copy';
    copyBtn.innerHTML = ICONS.copy;

    copyBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        copyToClipboard(value, e.target);
    });

    item.appendChild(iconDiv);
    item.appendChild(contentDiv);
    item.appendChild(copyBtn);

    return item;
}

function createVitalSignsItem(vitals) {
    const section = document.createElement('div');
    section.className = 'his-vitals-container';

    VITAL_SIGNS.forEach(v => {
        if (vitals[v.key]) {
            const pill = document.createElement('div');
            pill.className = 'his-vital-pill';
            pill.title = `${v.label}: ${vitals[v.key]} ${v.unit}`;

            const labelSpan = document.createElement('span');
            labelSpan.className = 'label';
            labelSpan.textContent = v.label.toUpperCase();

            const valueSpan = document.createElement('span');
            valueSpan.className = 'value';
            
            // Remove the unit string ignoring case and trailing spaces from the raw value
            let cleanVal = vitals[v.key].toString().trim();
            if (v.unit) {
                const unitRegex = new RegExp('\\s*' + v.unit.replace(/[-\\/\\^$*+?.()|[\]{}]/g, '\\$&') + '$', 'i');
                cleanVal = cleanVal.replace(unitRegex, '');
            }
            valueSpan.textContent = cleanVal;

            const unitSpan = document.createElement('span');
            unitSpan.className = 'unit';
            unitSpan.textContent = v.unit;

            pill.appendChild(labelSpan);
            pill.appendChild(valueSpan);
            pill.appendChild(unitSpan);

            pill.addEventListener('click', () => copyToClipboard(vitals[v.key]));
            section.appendChild(pill);
        }
    });

    return section.children.length > 0 ? section : null;
}

function createICD10Section(icdList) {
    const section = document.createElement('div');

    const header = document.createElement('div');
    header.className = 'his-icd10-header';

    const iconSpan = document.createElement('span');
    iconSpan.className = 'icon';
    iconSpan.innerHTML = ICONS.ai;

    const titleSpan = document.createElement('span');
    titleSpan.className = 'title';
    titleSpan.textContent = 'Gợi ý mã ICD-10';

    header.appendChild(iconSpan);
    header.appendChild(titleSpan);
    section.appendChild(header);

    const container = document.createElement('div');
    container.className = 'his-icd10-container';

    icdList.forEach(icd => {
        const chip = document.createElement('div');
        chip.className = 'his-icd10-chip';

        const codeSpan = document.createElement('span');
        codeSpan.className = 'code';
        const codeText = icd.code || icd.ma || icd.id || (typeof icd === 'string' ? icd : 'MÃ');
        codeSpan.textContent = codeText;
        codeSpan.title = 'Copy mã ICD';
        codeSpan.addEventListener('click', () => window.copyToClipboard ? window.copyToClipboard(codeText, codeSpan) : navigator.clipboard.writeText(codeText));

        const nameSpan = document.createElement('span');
        nameSpan.className = 'name';
        const nameText = icd.name || icd.ten || icd.description || (typeof icd === 'string' ? '' : 'Không rõ');
        nameSpan.textContent = nameText;
        nameSpan.title = 'Copy tên bệnh';
        nameSpan.addEventListener('click', () => window.copyToClipboard ? window.copyToClipboard(nameText, nameSpan) : navigator.clipboard.writeText(nameText));

        chip.appendChild(codeSpan);
        chip.appendChild(nameSpan);
        container.appendChild(chip);
    });

    section.appendChild(container);
    return section;
}

// ========================================
// Exports
// ========================================
window.processWithAI = processWithAI;
window.displayResults = displayResults;
window.startAIButtonCooldown = startAIButtonCooldown;
