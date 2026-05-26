/**
 * 🧞 Aladinn v2 — OCR Engine (Tesseract.js Offline)
 * 
 * Nhận diện ký tự từ ảnh kết quả xét nghiệm (giấy tờ bệnh viện khác).
 * Chạy 100% offline trên trình duyệt hoặc Node.js.
 * 
 * Luồng: Ảnh XN → Tesseract OCR → Raw Text → Lab Parser → Structured Data
 */

import { createWorker } from 'tesseract.js';

// Bộ từ khóa y khoa để nhận diện chỉ số xét nghiệm từ OCR text
const LAB_PATTERNS = [
  // Huyết học
  { regex: /(?:WBC|Bạch\s*cầu|BC)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(G\/L|10\^?9\/L|\/µL)?/gi, code: 'WBC', unit: 'G/L' },
  { regex: /(?:RBC|Hồng\s*cầu|HC)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(T\/L|10\^?12\/L)?/gi, code: 'RBC', unit: 'T/L' },
  { regex: /(?:HGB|Hb|Hemoglobin|Huyết\s*sắc\s*tố)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(g\/[dL]L?|g\/L)?/gi, code: 'HGB', unit: 'g/dL' },
  { regex: /(?:PLT|Tiểu\s*cầu|TC)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(G\/L|10\^?9\/L|\/µL)?/gi, code: 'PLT', unit: 'G/L' },
  { regex: /(?:HCT|Hematocrit)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(%|L\/L)?/gi, code: 'HCT', unit: '%' },
  
  // Sinh hóa
  { regex: /(?:Glucose|Đường\s*huyết|GLU)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(mmol\/L|mg\/dL)?/gi, code: 'Glucose', unit: 'mmol/L' },
  { regex: /(?:Creatinine?|Creatinin)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(µmol\/L|mg\/dL|umol\/L)?/gi, code: 'Creatinine', unit: 'µmol/L' },
  { regex: /(?:Ure|Urea|BUN)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(mmol\/L|mg\/dL)?/gi, code: 'Urea', unit: 'mmol/L' },
  { regex: /(?:AST|SGOT|GOT)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(U\/L|IU\/L)?/gi, code: 'AST', unit: 'U/L' },
  { regex: /(?:ALT|SGPT|GPT)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(U\/L|IU\/L)?/gi, code: 'ALT', unit: 'U/L' },
  { regex: /(?:CRP|C[\s-]?Reactive|C-reactive\s*protein)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(mg\/L|mg\/dL)?/gi, code: 'CRP', unit: 'mg/L' },
  { regex: /(?:HbA1c|HbA1C|A1C)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(%)?/gi, code: 'HbA1c', unit: '%' },
  { regex: /(?:Na\+?|Natri?|Sodium)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(mmol\/L|mEq\/L)?/gi, code: 'Na', unit: 'mmol/L' },
  { regex: /(?:K\+?|Kali?|Potassium)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(mmol\/L|mEq\/L)?/gi, code: 'K', unit: 'mmol/L' },
  
  // Đông máu
  { regex: /(?:PT|Prothrombin)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(giây|s|sec)?/gi, code: 'PT', unit: 's' },
  { regex: /(?:INR)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)/gi, code: 'INR', unit: '' },
  { regex: /(?:APTT|aPTT)\s*(?:\([^)]*\))?\s*[:\s]*([0-9]+[.,]?[0-9]*)\s*(giây|s|sec)?/gi, code: 'APTT', unit: 's' },
];

// Khoảng tham chiếu bình thường
const REFERENCE_RANGES = {
  WBC:        { low: 4.0, high: 10.0, unit: 'G/L' },
  RBC:        { low: 4.0, high: 5.5, unit: 'T/L' },
  HGB:        { low: 12.0, high: 17.0, unit: 'g/dL' },
  PLT:        { low: 150, high: 400, unit: 'G/L' },
  HCT:        { low: 36, high: 48, unit: '%' },
  Glucose:    { low: 3.9, high: 6.1, unit: 'mmol/L' },
  Creatinine: { low: 62, high: 106, unit: 'µmol/L' },
  Urea:       { low: 2.5, high: 7.1, unit: 'mmol/L' },
  AST:        { low: 0, high: 40, unit: 'U/L' },
  ALT:        { low: 0, high: 40, unit: 'U/L' },
  CRP:        { low: 0, high: 5, unit: 'mg/L' },
  HbA1c:      { low: 4.0, high: 5.6, unit: '%' },
  Na:         { low: 136, high: 145, unit: 'mmol/L' },
  K:          { low: 3.5, high: 5.0, unit: 'mmol/L' },
  PT:         { low: 11, high: 14, unit: 's' },
  INR:        { low: 0.8, high: 1.2, unit: '' },
  APTT:       { low: 25, high: 35, unit: 's' },
};

/**
 * Khởi tạo OCR worker với ngôn ngữ tiếng Việt.
 * @param {string} [lang='vie+eng'] - Ngôn ngữ nhận diện
 * @returns {Promise<Object>} Tesseract worker
 */
export async function createOCRWorker(lang = 'vie+eng') {
  console.log(`[OCR] 🔄 Đang khởi tạo Tesseract (${lang})...`);
  const worker = await createWorker(lang);
  console.log('[OCR] ✅ Tesseract sẵn sàng');
  return worker;
}

/**
 * Nhận diện text từ ảnh.
 * @param {Object} worker - Tesseract worker
 * @param {string|Buffer} image - Đường dẫn file ảnh hoặc Buffer
 * @returns {Promise<{text: string, confidence: number}>}
 */
export async function recognizeImage(worker, image) {
  console.log('[OCR] 📸 Đang phân tích hình ảnh...');
  const { data } = await worker.recognize(image);
  console.log(`[OCR] ✅ Nhận diện xong (confidence: ${data.confidence}%)`);
  return {
    text: data.text,
    confidence: data.confidence
  };
}

/**
 * Trích xuất các chỉ số xét nghiệm từ raw OCR text.
 * 
 * @param {string} rawText - Văn bản thô từ OCR
 * @returns {Array<{code: string, value: number, unit: string, flag: string, refRange: Object}>}
 */
export function extractLabValues(rawText) {
  if (!rawText) return [];
  
  const results = [];
  const seen = new Set();
  
  // Chuẩn hóa dấu phẩy thập phân → dấu chấm
  const normalizedText = rawText.replace(/(\d),(\d)/g, '$1.$2');
  
  for (const pattern of LAB_PATTERNS) {
    // Reset regex lastIndex
    pattern.regex.lastIndex = 0;
    let match;
    
    while ((match = pattern.regex.exec(normalizedText)) !== null) {
      const value = parseFloat(match[1].replace(',', '.'));
      if (isNaN(value)) continue;
      
      // Tránh trùng lặp (lấy lần xuất hiện đầu tiên)
      const key = `${pattern.code}`;
      if (seen.has(key)) continue;
      seen.add(key);
      
      const unit = match[2] || pattern.unit;
      const ref = REFERENCE_RANGES[pattern.code];
      let flag = 'normal';
      
      if (ref) {
        if (value < ref.low) flag = 'low';
        else if (value > ref.high) flag = 'high';
      }
      
      results.push({
        code: pattern.code,
        value,
        unit,
        flag,
        refRange: ref || null
      });
    }
  }
  
  return results;
}

/**
 * Pipeline hoàn chỉnh: Ảnh → OCR → Structured Lab Data.
 * 
 * @param {string|Buffer} image - Ảnh kết quả xét nghiệm
 * @param {Object} [worker] - Tesseract worker (sẽ tạo mới nếu không có)
 * @returns {Promise<{rawText: string, confidence: number, labs: Array, abnormal: Array}>}
 */
export async function processLabImage(image, worker = null) {
  const ownWorker = !worker;
  if (!worker) {
    worker = await createOCRWorker();
  }
  
  try {
    const { text, confidence } = await recognizeImage(worker, image);
    const labs = extractLabValues(text);
    const abnormal = labs.filter(l => l.flag !== 'normal');
    
    return {
      rawText: text,
      confidence,
      labs,
      abnormal,
      summary: formatLabSummary(labs)
    };
  } finally {
    if (ownWorker) {
      await worker.terminate();
    }
  }
}

/**
 * Format kết quả xét nghiệm thành bảng text dễ đọc.
 */
function formatLabSummary(labs) {
  if (labs.length === 0) return 'Không nhận diện được chỉ số xét nghiệm nào.';
  
  const lines = ['Chỉ số       | Giá trị    | Đơn vị    | Trạng thái',
                 '-------------|------------|-----------|----------'];
  
  for (const lab of labs) {
    const flagEmoji = lab.flag === 'high' ? '▲ Cao' : lab.flag === 'low' ? '▼ Thấp' : '✓ BT';
    const name = lab.code.padEnd(13);
    const val = String(lab.value).padEnd(10);
    const unit = (lab.unit || '').padEnd(10);
    lines.push(`${name}| ${val} | ${unit}| ${flagEmoji}`);
  }
  
  return lines.join('\n');
}

export { LAB_PATTERNS, REFERENCE_RANGES };
