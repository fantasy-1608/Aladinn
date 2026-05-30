/**
 * 🧞 Aladinn v2 — Ollama Local LLM Client
 * 
 * Kết nối tới Ollama server chạy nội bộ trong mạng LAN bệnh viện.
 * Dữ liệu bệnh nhân KHÔNG BAO GIỜ rời khỏi mạng nội bộ.
 * 
 * Hỗ trợ:
 * - Tóm tắt bệnh án thô (không cần che PHI)
 * - Viết diễn biến lâm sàng
 * - Gợi ý chẩn đoán phân biệt
 * - Streaming response cho UX mượt mà
 */

const DEFAULT_OLLAMA_BASE = 'http://localhost:11434';
const DEFAULT_MODEL = 'qwen3:8b';
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * System prompts chuyên biệt cho từng tác vụ y khoa.
 * Mỗi prompt được thiết kế để tối ưu cho model 8B parameters.
 */
const CLINICAL_PROMPTS = {
  summarize: `Bạn là bác sĩ trưởng khoa tại bệnh viện Việt Nam. 
Nhiệm vụ: Tóm tắt bệnh sử bệnh nhân thành đoạn văn ngắn gọn, chuyên khoa.
Quy tắc:
- Bắt đầu bằng "Bệnh nhân [giới] [tuổi] tuổi, vào viện vì..."
- Telegraphic style: lược bỏ từ thừa
- Giữ nguyên các số liệu xét nghiệm quan trọng
- Nêu rõ diễn biến bệnh lý theo trình tự thời gian
- Kết thúc bằng tình trạng hiện tại
- CHỈ trả về nội dung tóm tắt, không giải thích thêm.`,

  progress_note: `Bạn là bác sĩ điều trị viết tờ theo dõi diễn biến bệnh hàng ngày (Progress Note).
Quy tắc:
- Sử dụng format SOAP (Subjective, Objective, Assessment, Plan) bằng tiếng Việt
- S: Triệu chứng chủ quan bệnh nhân khai
- O: Dấu hiệu khách quan (sinh hiệu, khám lâm sàng, CLS)
- A: Đánh giá/chẩn đoán
- P: Kế hoạch điều trị tiếp theo
- Ngắn gọn, súc tích, chuyên nghiệp y khoa.`,

  differential_diagnosis: `Bạn là bác sĩ nội khoa. Dựa vào triệu chứng và xét nghiệm, đề xuất chẩn đoán phân biệt.
Quy tắc:
- Liệt kê tối đa 5 chẩn đoán phân biệt, sắp xếp theo khả năng giảm dần
- Mỗi chẩn đoán ghi kèm mã ICD-10 và lý do nghĩ đến
- Gợi ý xét nghiệm/cận lâm sàng cần làm thêm để phân biệt
- CHỈ trả về danh sách, không giải thích dài dòng.`,

  discharge_summary: `Bạn là bác sĩ viết Tổng kết hồ sơ bệnh án xuất viện theo chuẩn Bộ Y tế Việt Nam.
Quy tắc:
- Phần 1: Tóm tắt quá trình bệnh lý
- Phần 2: Tình trạng lúc ra viện
- Phần 3: Hướng dẫn chăm sóc và tái khám
- Giữ nguyên tính chính xác tuyệt đối, không bịa thêm thông tin
- Văn phong trang trọng, có giá trị pháp lý.`
};

/**
 * Kiểm tra Ollama server có đang chạy không.
 * @param {string} baseUrl - URL gốc của Ollama server
 * @returns {Promise<{alive: boolean, models: string[], error?: string}>}
 */
export async function checkOllamaHealth(baseUrl = DEFAULT_OLLAMA_BASE) {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    
    const response = await fetch(`${baseUrl}/api/tags`, {
      signal: controller.signal
    });
    clearTimeout(timeout);
    
    if (!response.ok) {
      return { alive: false, models: [], error: `HTTP ${response.status}` };
    }
    
    const data = await response.json();
    const models = (data.models || []).map(m => m.name);
    
    return { alive: true, models };
  } catch (err) {
    return {
      alive: false,
      models: [],
      error: err.name === 'AbortError' 
        ? 'Ollama không phản hồi (timeout 5s)'
        : `Không kết nối được: ${err.message}`
    };
  }
}

/**
 * Gửi yêu cầu tới Ollama Local LLM (Non-streaming).
 * 
 * @param {Object} options
 * @param {string} options.prompt - Nội dung bệnh án / câu hỏi lâm sàng
 * @param {string} [options.task='summarize'] - Loại tác vụ (summarize|progress_note|differential_diagnosis|discharge_summary)
 * @param {string} [options.model] - Tên model Ollama (mặc định: qwen3:8b)
 * @param {string} [options.baseUrl] - URL gốc Ollama
 * @param {number} [options.temperature=0.3] - Độ sáng tạo (thấp = chính xác hơn)
 * @param {AbortSignal} [options.signal] - Cho phép hủy request
 * @returns {Promise<{text: string, model: string, totalDuration: number, tokenCount: number}>}
 */
export async function queryLocalLLM({
  prompt,
  task = 'summarize',
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_OLLAMA_BASE,
  temperature = 0.3,
  signal
}) {
  if (!prompt || typeof prompt !== 'string') {
    throw new Error('[Ollama] Prompt không được để trống');
  }

  const systemPrompt = CLINICAL_PROMPTS[task];
  if (!systemPrompt) {
    throw new Error(`[Ollama] Task không hợp lệ: ${task}. Chọn: ${Object.keys(CLINICAL_PROMPTS).join(', ')}`);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  
  // Merge external abort signal
  if (signal) {
    signal.addEventListener('abort', () => controller.abort());
  }

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        prompt,
        stream: false,
        options: {
          temperature,
          top_p: 0.85,
          num_predict: 2048,
          repeat_penalty: 1.1
        }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errBody = await response.text().catch(() => '');
      throw new Error(`[Ollama] HTTP ${response.status}: ${errBody}`);
    }

    const data = await response.json();
    
    return {
      text: (data.response || '').trim(),
      model: data.model || model,
      totalDuration: data.total_duration ? Math.round(data.total_duration / 1e6) : 0, // ns → ms
      tokenCount: data.eval_count || 0
    };
  } catch (err) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error('[Ollama] Request bị hủy hoặc timeout', { cause: err });
    }
    throw err;
  }
}

/**
 * Gửi yêu cầu tới Ollama với Streaming response.
 * Gọi onChunk callback mỗi khi nhận được một phần text.
 * 
 * @param {Object} options - Giống queryLocalLLM
 * @param {function(string): void} options.onChunk - Callback nhận từng đoạn text
 * @returns {Promise<{text: string, model: string}>}
 */
export async function streamLocalLLM({
  prompt,
  task = 'summarize',
  model = DEFAULT_MODEL,
  baseUrl = DEFAULT_OLLAMA_BASE,
  temperature = 0.3,
  onChunk,
  signal
}) {
  if (!prompt) throw new Error('[Ollama] Prompt không được để trống');
  if (!onChunk) throw new Error('[Ollama] onChunk callback là bắt buộc');

  const systemPrompt = CLINICAL_PROMPTS[task] || CLINICAL_PROMPTS.summarize;
  
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  if (signal) signal.addEventListener('abort', () => controller.abort());

  try {
    const response = await fetch(`${baseUrl}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        prompt,
        stream: true,
        options: { temperature, top_p: 0.85, num_predict: 2048 }
      }),
      signal: controller.signal
    });

    clearTimeout(timeout);
    if (!response.ok) throw new Error(`[Ollama] HTTP ${response.status}`);

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let fullText = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      
      const chunk = decoder.decode(value, { stream: true });
      // Ollama streams JSON lines
      for (const line of chunk.split('\n').filter(Boolean)) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.response) {
            fullText += parsed.response;
            onChunk(parsed.response);
          }
        } catch { /* skip malformed lines */ }
      }
    }

    return { text: fullText.trim(), model };
  } catch (err) {
    clearTimeout(timeout);
    throw err;
  }
}

export { CLINICAL_PROMPTS, DEFAULT_OLLAMA_BASE, DEFAULT_MODEL };
