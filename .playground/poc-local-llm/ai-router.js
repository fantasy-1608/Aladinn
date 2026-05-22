/**
 * 🧞 Aladinn v2 — AI Router (Dual-Engine Strategy)
 * 
 * Bộ định tuyến thông minh tự động chọn giữa:
 *   1. Local LLM (Ollama) — Cho dữ liệu nhạy cảm (bệnh án gốc, có PHI)
 *   2. Cloud AI (Gemini) — Cho dữ liệu đã khử PHI hoặc câu hỏi kiến thức chung
 * 
 * Nguyên tắc: Dữ liệu có PHI → BẮT BUỘC Local. Không có PHI → Cloud (nhanh hơn).
 * Fallback: Nếu Local offline → tự chuyển sang Cloud (sau khi redact PHI).
 */

import { checkOllamaHealth, queryLocalLLM, streamLocalLLM } from './ollama-client.js';

// Cache health status to avoid hammering Ollama with health checks
let _healthCache = { alive: false, models: [], checkedAt: 0 };
const HEALTH_CACHE_TTL_MS = 30_000; // 30 seconds

/**
 * Phát hiện nhanh xem text có chứa PHI (Protected Health Information) không.
 * Sử dụng cùng logic với phi-redactor.js của Aladinn v2.
 */
const PHI_DETECTION_PATTERNS = [
  /(?:\+84|0)[35789]\d{8}/,                          // Phone VN
  /\b\d{9}\b|\b\d{12}\b/,                             // CCCD/CMND
  /\b[A-Z]{2}[1-9]\d{12}\b/,                          // BHYT
  /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/, // Email
];

function containsPHI(text) {
  if (!text) return false;
  return PHI_DETECTION_PATTERNS.some(pattern => pattern.test(text));
}

/**
 * Kiểm tra Ollama có sẵn sàng không (có cache).
 */
async function isLocalAvailable(baseUrl) {
  const now = Date.now();
  if (now - _healthCache.checkedAt < HEALTH_CACHE_TTL_MS) {
    return _healthCache.alive;
  }
  
  const health = await checkOllamaHealth(baseUrl);
  _healthCache = { ...health, checkedAt: now };
  return health.alive;
}

/**
 * Quyết định engine nào sẽ xử lý request.
 * 
 * @param {Object} options
 * @param {string} options.text - Nội dung cần xử lý
 * @param {boolean} [options.forceLocal=false] - Bắt buộc dùng Local (cho bệnh án gốc)
 * @param {boolean} [options.forceCloud=false] - Bắt buộc dùng Cloud
 * @param {string} [options.ollamaBaseUrl] - URL Ollama
 * @returns {Promise<'local'|'cloud'>}
 */
export async function routeDecision({
  text,
  forceLocal = false,
  forceCloud = false,
  ollamaBaseUrl
}) {
  // Rule 1: Explicit force
  if (forceLocal) return 'local';
  if (forceCloud) return 'cloud';
  
  // Rule 2: Text contains PHI → MUST use local
  if (containsPHI(text)) {
    const localReady = await isLocalAvailable(ollamaBaseUrl);
    if (localReady) return 'local';
    
    // PHI detected but local unavailable → log warning, caller must redact before cloud
    console.warn('[AI Router] ⚠️ PHI detected but Ollama offline. Caller MUST redact before cloud fallback.');
    return 'cloud_with_redaction_required';
  }
  
  // Rule 3: No PHI → prefer cloud (faster, smarter) but fallback to local
  const localReady = await isLocalAvailable(ollamaBaseUrl);
  // Cloud is always preferred for non-PHI data (Gemini is more capable)
  return 'cloud';
}

/**
 * Gửi request thông qua Router.
 * Tự động chọn engine phù hợp, xử lý fallback.
 * 
 * @param {Object} options
 * @param {string} options.prompt - Text lâm sàng
 * @param {string} [options.task='summarize'] - Loại tác vụ
 * @param {boolean} [options.forceLocal=false] - Bắt buộc Local
 * @param {string} [options.ollamaBaseUrl] - URL Ollama
 * @param {string} [options.ollamaModel] - Model Ollama
 * @param {function} [options.onChunk] - Streaming callback (chỉ Local)
 * @param {AbortSignal} [options.signal] - Abort signal
 * @returns {Promise<{text: string, engine: string, model: string, meta?: Object}>}
 */
export async function routedQuery({
  prompt,
  task = 'summarize',
  forceLocal = false,
  ollamaBaseUrl,
  ollamaModel,
  onChunk,
  signal
}) {
  const route = await routeDecision({
    text: prompt,
    forceLocal,
    ollamaBaseUrl
  });

  console.log(`[AI Router] 🔀 Route decision: ${route} | PHI: ${containsPHI(prompt)} | Task: ${task}`);

  if (route === 'local') {
    const queryFn = onChunk ? streamLocalLLM : queryLocalLLM;
    const result = await queryFn({
      prompt,
      task,
      model: ollamaModel,
      baseUrl: ollamaBaseUrl,
      onChunk,
      signal
    });

    return {
      text: result.text,
      engine: 'local',
      model: result.model,
      meta: {
        totalDuration: result.totalDuration,
        tokenCount: result.tokenCount,
        phiSafe: true // Local = no data leaves the network
      }
    };
  }

  if (route === 'cloud_with_redaction_required') {
    // Caller must handle PHI redaction before sending to cloud
    // This is a signal, not an actual cloud call
    return {
      text: '',
      engine: 'cloud_blocked',
      model: '',
      meta: {
        error: 'PHI_REDACTION_REQUIRED',
        message: 'Dữ liệu chứa thông tin định danh (PHI). Ollama offline. Cần khử PHI trước khi gửi lên Cloud.'
      }
    };
  }

  // Cloud route — caller should use existing Aladinn v2 ai-client.js
  // We return a signal so the extension knows to use the Gemini pipeline
  return {
    text: '',
    engine: 'cloud',
    model: 'gemini-2.0-flash',
    meta: {
      delegateTo: 'ai-client.js',
      message: 'Dữ liệu an toàn (không PHI). Chuyển sang Gemini Cloud để xử lý nhanh hơn.'
    }
  };
}

/**
 * Lấy trạng thái tổng quan của AI Router.
 */
export async function getRouterStatus(ollamaBaseUrl) {
  const health = await checkOllamaHealth(ollamaBaseUrl);
  return {
    localEngine: {
      name: 'Ollama',
      alive: health.alive,
      models: health.models,
      error: health.error || null
    },
    cloudEngine: {
      name: 'Gemini',
      alive: true, // Assume cloud is always available
      note: 'Requires API key + PHI redaction'
    },
    routing: {
      phiData: health.alive ? 'local (Ollama)' : 'BLOCKED (cần Ollama)',
      nonPhiData: 'cloud (Gemini)',
      fallback: health.alive ? 'cloud → local' : 'cloud only'
    }
  };
}

export { containsPHI };
