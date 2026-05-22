/**
 * 🧞 Aladinn v2 — Voice Engine (Whisper Integration Blueprint)
 * 
 * Thiết kế kiến trúc cho tính năng ghi âm y khoa ngoại tuyến.
 * 
 * LƯU Ý: Whisper.cpp/WebAssembly chưa có package npm ổn định cho Node.js.
 * File này cung cấp:
 * 1. Kiến trúc tích hợp (Architecture Blueprint)
 * 2. Bộ từ điển y khoa tiếng Việt cho post-processing
 * 3. Mock API tương thích để test pipeline end-to-end
 */

/**
 * Từ điển sửa lỗi y khoa tiếng Việt.
 * Dùng để post-process kết quả từ speech-to-text (Whisper hoặc Web Speech API).
 * 
 * Key: Từ sai (do STT nhận nhầm) → Value: Từ đúng y khoa
 */
export const MEDICAL_CORRECTIONS = {
  // Lỗi đồng âm phổ biến
  'sin hiệu': 'sinh hiệu',
  'xin hiệu': 'sinh hiệu',
  'sinh hiệu': 'sinh hiệu',
  'trận đấu': 'chẩn đoán',
  'chẩn đấu': 'chẩn đoán',
  'chẩn đóan': 'chẩn đoán',
  'bên sở': 'bệnh sử',
  'bệnh xử': 'bệnh sử',
  'bệnh sở': 'bệnh sử',
  'ốm đau': 'ấn đau',
  'họng từng cơn': 'hông từng cơn',
  'tiểu giáp': 'tiểu phải',
  'bụng trướng': 'bụng chướng',
  'vùng máu cho phải': 'vùng hông phải',
  'hạ xương phải': 'hạ sườn phải',
  'hạ xương trái': 'hạ sườn trái',
  
  // Thuật ngữ y khoa
  'phản ứng rồi': 'phản ứng dội',
  'phản ứng giời': 'phản ứng dội',
  'cổ chướng': 'cổ trướng',
  'viên phối': 'viêm phổi',
  'viên phổi': 'viêm phổi',
  'xuất huyết giảm': 'xuất huyết nặng',
  'tiểu cẩu': 'tiểu cầu',
  'bạch cẩu': 'bạch cầu',
  'hồng cẩu': 'hồng cầu',
  'đại tháo đường': 'đái tháo đường',
  'tăng huyết áp': 'tăng huyết áp',
  'nhồi máu cô tim': 'nhồi máu cơ tim',
  'suy tim xung huyết': 'suy tim sung huyết',
  
  // Sinh hiệu
  'mạch 80 lần phút': 'mạch 80 lần/phút',
  'nhiệt 37 độ': 'nhiệt độ 37°C',
  'nhiệt 38 độ': 'nhiệt độ 38°C',
  'nhiệt 39 độ': 'nhiệt độ 39°C',
  'huyết áp 1 trăm 20 trên 80': 'huyết áp 120/80 mmHg',
  'huyết áp 1 trăm 40 trên 90': 'huyết áp 140/90 mmHg',
  'sp02': 'SpO2',
  'spo 2': 'SpO2',
};

/**
 * Regex patterns cho chuẩn hóa số liệu y khoa từ giọng nói.
 */
const NUMERIC_PATTERNS = [
  // "150 trên 80" → "150/80 mmHg"
  { regex: /(\d{2,3})\s*trên\s*(\d{2,3})/gi, replace: '$1/$2 mmHg' },
  // "mạch 80" → "mạch 80 lần/phút"
  { regex: /mạch\s*(\d{2,3})(?!\s*lần)/gi, replace: 'mạch $1 lần/phút' },
  // "nặng 50 ký" → "cân nặng 50 kg"
  { regex: /nặng\s*(\d{2,3})\s*ký/gi, replace: 'cân nặng $1 kg' },
  // "cao 1 m 65" → "chiều cao 165 cm"
  { regex: /cao\s*(\d)\s*m\s*(\d{1,2})/gi, replace: (_, m, cm) => `chiều cao ${parseInt(m) * 100 + parseInt(cm)} cm` },
  // "37 độ 5" → "37.5°C"
  { regex: /(\d{2})\s*độ\s*(\d)/gi, replace: '$1.$2°C' },
  // Tiểu cầu "100 nghìn" → "100.000"
  { regex: /(\d+)\s*nghìn/gi, replace: (_, n) => `${parseInt(n) * 1000}` },
];

/**
 * Post-process kết quả speech-to-text.
 * Sửa lỗi đồng âm và chuẩn hóa số liệu y khoa.
 * 
 * @param {string} rawText - Văn bản thô từ STT
 * @returns {string} Văn bản đã được sửa lỗi y khoa
 */
export function postProcessSpeech(rawText) {
  if (!rawText) return '';
  
  let corrected = rawText;
  
  // Áp dụng từ điển sửa lỗi
  for (const [wrong, right] of Object.entries(MEDICAL_CORRECTIONS)) {
    const escapedWrong = wrong.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    corrected = corrected.replace(new RegExp(escapedWrong, 'gi'), right);
  }
  
  // Áp dụng chuẩn hóa số liệu
  for (const pattern of NUMERIC_PATTERNS) {
    corrected = corrected.replace(pattern.regex, pattern.replace);
  }
  
  return corrected.trim();
}

/**
 * Mock Whisper API — Dùng Web Speech API của trình duyệt làm fallback.
 * 
 * Trong thực tế production, sẽ thay bằng Whisper.cpp WASM.
 * 
 * ARCHITECTURE:
 * ┌─────────────────────────────────────────────────┐
 * │  Trình duyệt Chrome (máy bác sĩ)               │
 * │                                                  │
 * │  ┌──────────────┐     ┌───────────────────────┐ │
 * │  │ Microphone   │────→│ Whisper.cpp (WASM)     │ │
 * │  │ MediaStream  │     │ Model: whisper-small   │ │
 * │  └──────────────┘     │ ~200MB, offline        │ │
 * │                       └───────────┬───────────┘ │
 * │                                   │ Raw Text     │
 * │                       ┌───────────▼───────────┐ │
 * │                       │ postProcessSpeech()   │ │
 * │                       │ Sửa lỗi y khoa VN    │ │
 * │                       └───────────┬───────────┘ │
 * │                                   │ Clean Text   │
 * │                       ┌───────────▼───────────┐ │
 * │                       │ Auto-fill HIS fields  │ │
 * │                       │ (scanner-init.js)     │ │
 * │                       └───────────────────────┘ │
 * └─────────────────────────────────────────────────┘
 */

/**
 * Tạo một phiên ghi âm giả lập (mock) cho test.
 * Trả về kết quả text đã qua postProcess.
 * 
 * @param {string} simulatedSpeech - Đoạn text giả lập (như thể đọc vào mic)
 * @returns {{rawText: string, correctedText: string, corrections: Array}}
 */
export function simulateVoiceInput(simulatedSpeech) {
  const corrected = postProcessSpeech(simulatedSpeech);
  
  // Tìm các corrections đã áp dụng
  const corrections = [];
  for (const [wrong, right] of Object.entries(MEDICAL_CORRECTIONS)) {
    if (simulatedSpeech.toLowerCase().includes(wrong.toLowerCase()) && 
        wrong.toLowerCase() !== right.toLowerCase()) {
      corrections.push({ from: wrong, to: right });
    }
  }
  
  return {
    rawText: simulatedSpeech,
    correctedText: corrected,
    corrections,
    engine: 'mock_whisper',
    note: 'Production sẽ dùng Whisper.cpp WASM hoặc Web Speech API'
  };
}

/**
 * Cấu hình cho tích hợp Whisper.cpp thực tế (tương lai).
 * Lưu lại để khi có package npm ổn định sẽ plug vào.
 */
export const WHISPER_CONFIG = {
  // Model recommendations cho máy bệnh viện
  models: {
    'whisper-tiny':  { size: '75MB',  accuracy: 'Thấp',  speed: 'Cực nhanh', note: 'Cho máy cũi bắp' },
    'whisper-base':  { size: '142MB', accuracy: 'TB',     speed: 'Nhanh',     note: 'Khuyên dùng cho máy phổ thông' },
    'whisper-small': { size: '466MB', accuracy: 'Tốt',    speed: 'TB',        note: 'Khuyên dùng nếu máy có 8GB RAM' },
    'whisper-medium':{ size: '1.5GB', accuracy: 'Rất tốt',speed: 'Chậm',     note: 'Cần GPU hoặc máy mạnh' },
  },
  
  // Cài đặt nhận diện
  language: 'vi',            // Tiếng Việt
  task: 'transcribe',        // Chỉ chép (không dịch)
  beamSize: 5,               // Beam search width
  bestOf: 5,                 // Chọn kết quả tốt nhất từ 5 mẫu
  wordTimestamps: false,     // Không cần timestamp từng từ
  
  // Audio settings
  sampleRate: 16000,         // 16kHz (Whisper yêu cầu)
  channels: 1,               // Mono
  
  // Integration points trong Aladinn Extension
  integrationNotes: `
    1. Load model WASM vào Web Worker (tránh block UI)
    2. Capture audio via navigator.mediaDevices.getUserMedia()
    3. Convert Float32Array → Int16Array (PCM 16-bit) 
    4. Feed chunks vào whisper.transcribe()
    5. postProcessSpeech() sửa lỗi y khoa
    6. Gửi text đã sửa vào scanner-init.js autofill pipeline
  `
};
