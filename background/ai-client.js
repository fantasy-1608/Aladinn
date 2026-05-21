/**
 * HIS Voice Assistant - Background AI Client
 * Handles Gemini API calls with rate-limiting, retry, and cancellation.
 * Only runs in background service worker context.
 */

import { PHIRedactor } from './phi-redactor.js';
import { SchemaValidator } from './schema-validator.js';

// ========================================
// Crypto Helper (for decrypting API key in background context)
// SECURITY: PIN is never stored. Only the derived CryptoKey (non-extractable) is cached.
// ========================================
const _CRYPTO_ITERATIONS = 310000;
const _CRYPTO_KEY_LENGTH = 256;

// In-memory only — non-extractable CryptoKey, wiped on timeout/logout
let _cachedDecryptKey = null;
let _cachedDecryptSalt = null;
// [P1-SEC-001] Separate encrypt key (extractable=false, usage=['encrypt'])
let _cachedEncryptKey = null;

// SECURITY: Aliases for service-worker.js logout handler to clear
// (service-worker.js uses `_bgCachedKey = null` to wipe on logout)
// We use a getter/setter pattern so both names reference the same variable
Object.defineProperty(globalThis, '_bgCachedKey', {
    configurable: true,
    get() { return _cachedDecryptKey; },
    set(v) { _cachedDecryptKey = v; }
});
Object.defineProperty(globalThis, '_bgCachedSalt', {
    configurable: true,
    get() { return _cachedDecryptSalt; },
    set(v) { _cachedDecryptSalt = v; }
});

/**
 * Derive a CryptoKey from a PIN and cache it in memory.
 * Called by service-worker when user authenticates via CACHE_SESSION_PIN.
 * The PIN is used once to derive the key, then discarded.
 */
globalThis.deriveBgKeyFromPin = async function(pin) {
    if (!pin) return;
    try {
        const stored = await chrome.storage.local.get(['pin_salt']);
        const salt = stored.pin_salt;
        if (!salt) return;
        
        const saltData = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
        const baseKey = await crypto.subtle.importKey(
            'raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveKey']
        );
        // Derive decrypt key (for stored API key + transcript/results)
        const derivedKey = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: saltData, iterations: _CRYPTO_ITERATIONS, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: _CRYPTO_KEY_LENGTH },
            false, ['decrypt']
        );
        // [P1-SEC-001] Derive a SEPARATE encrypt key (same material, separate derivation)
        const encryptKey = await crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: saltData, iterations: _CRYPTO_ITERATIONS, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: _CRYPTO_KEY_LENGTH },
            false, ['encrypt']
        );
        _cachedDecryptKey = derivedKey;
        _cachedEncryptKey = encryptKey;
        _cachedDecryptSalt = salt;
        touchActivity();
        console.log('[Aladinn Security] 🔑 Derived key cached in memory (PIN discarded).');
    } catch (e) {
        console.log('[Aladinn Security] Key derivation failed:', e);
    }
};

/**
 * Decrypt the API key using the cached CryptoKey.
 * Called by service-worker for BG_DECRYPT_API_KEY / GET_SESSION_PIN messages.
 * Returns the decrypted API key string, or empty string.
 */
globalThis.bgDecryptApiKey = async function() {
    try {
        checkSessionTimeout();
        if (!_cachedDecryptKey) return '';
        
        const stored = await chrome.storage.local.get(['geminiApiKey_encrypted', 'pin_salt']);
        if (!stored.geminiApiKey_encrypted || !stored.pin_salt) return '';
        
        touchActivity();
        return await _decryptWithKey(stored.geminiApiKey_encrypted, _cachedDecryptKey);
    } catch (e) {
        console.log('[Aladinn Security] bgDecryptApiKey failed:', e);
        return '';
    }
};

/**
 * [P1-SEC-001] Encrypt arbitrary plaintext using the cached CryptoKey.
 * Used as a background crypto service for transcript/results storage.
 * Returns "base64iv:base64ciphertext" string, or throws on failure.
 */
globalThis.bgEncryptData = async function(plaintext) {
    checkSessionTimeout();
    if (!_cachedDecryptKey) throw new Error('No session key — PIN required');
    touchActivity();

    // Derive an encrypt-capable key from same material (cached key is decrypt-only)
    // We keep a separate encrypt key cached alongside decrypt key.
    if (!_cachedEncryptKey) throw new Error('No encrypt key — PIN required');

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(plaintext);
    const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, _cachedEncryptKey, encoded);
    const ivB64 = btoa(String.fromCharCode(...iv));
    const cipherB64 = btoa(String.fromCharCode(...new Uint8Array(cipherBuffer)));
    return ivB64 + ':' + cipherB64;
};

/**
 * [P1-SEC-001] Decrypt ciphertext using the cached CryptoKey.
 * @param {string} ciphertext - "base64iv:base64ciphertext" format
 * @returns {Promise<string>}
 */
globalThis.bgDecryptData = async function(ciphertext) {
    checkSessionTimeout();
    if (!_cachedDecryptKey) throw new Error('No session key — PIN required');
    if (!ciphertext || !ciphertext.includes(':')) throw new Error('Invalid ciphertext format');
    touchActivity();
    return _decryptWithKey(ciphertext, _cachedDecryptKey);
};

async function decryptAPIKeyInBg(encryptedText, salt) {
    if (!encryptedText || !encryptedText.includes(':')) return '';
    if (_cachedDecryptKey && _cachedDecryptSalt === salt) {
        checkSessionTimeout();
        if (!_cachedDecryptKey) return '';
        touchActivity();
        return _decryptWithKey(encryptedText, _cachedDecryptKey);
    }
    // No cached key available — caller must authenticate first
    return '';
}

async function _decryptWithKey(encryptedText, key) {
    const [ivB64, cipherB64] = encryptedText.split(':');
    const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
    const ciphertext = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
    return new TextDecoder().decode(decrypted);
}

// ========================================
// SECURITY: Auto-Lock PIN after 30 minutes of inactivity
// ========================================
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes
let _lastActivityTime = Date.now();

function checkSessionTimeout() {
    if (_cachedDecryptKey && (Date.now() - _lastActivityTime > SESSION_TIMEOUT_MS)) {
        console.log('[Aladinn Security] 🔒 Session timeout (30 min idle) — clearing cached decryption key.');
        _cachedDecryptKey = null;
        _cachedEncryptKey = null; // [P1-SEC-001] Also clear encrypt key
        _cachedDecryptSalt = null;
    }
}

function touchActivity() {
    _lastActivityTime = Date.now();
}

// ========================================
// Rate Limiter
// ========================================
const RATE_LIMIT_MS = 1500; // 1 request per 1.5 seconds
let _lastRequestTime = 0;

function waitForRateLimit() {
    const now = Date.now();
    const elapsed = now - _lastRequestTime;
    if (elapsed >= RATE_LIMIT_MS) {
        _lastRequestTime = now;
        return Promise.resolve();
    }
    const waitMs = RATE_LIMIT_MS - elapsed;
    _lastRequestTime = now + waitMs;
    return new Promise(resolve => setTimeout(resolve, waitMs));
}

// ========================================
// Abort Controller Map (for cancel support)
// ========================================
const _abortControllers = new Map();

export function cancelRequest(requestId) {
    const controller = _abortControllers.get(requestId);
    if (controller) {
        controller.abort();
        _abortControllers.delete(requestId);
        return true;
    }
    return false;
}

// ========================================
// System Prompt Builder
// ========================================
function buildSystemPrompt(text) {
    // [P1-SEC-007] Use JSON.stringify to safely escape all special chars in text
    const escapedText = JSON.stringify(text);
    return `Bạn là trợ lý y khoa chuyên nghiệp tại Bệnh viện Việt Nam. Nhiệm vụ: trích xuất thông tin từ văn bản y khoa (được nhập bằng giọng nói, có nhiều lỗi nhận dạng) và trả về **CHỈ JSON** — không kèm giải thích.

## QUY TẮC QUAN TRỌNG:

### 1. SỬA LỖI GIỌNG NÓI (Speech-to-text):
Văn bản được nhập bằng giọng nói tiếng Việt, CẦN PHẢI sửa lỗi nhận dạng dựa trên ngữ cảnh y khoa:
- "sin hiệu" / "xin hiệu" → "sinh hiệu"
- "trận đấu" / "chẩn đấu" → "chẩn đoán"  
- "bên sở" / "bệnh xử" → "bệnh sử"
- "nguyên" (trước số huyết áp) → "huyết áp"
- "vùng máu cho phải" → "vùng hông phải" / "hạ sườn phải"
- "tiểu giáp" → "tiểu phải" hoặc theo ngữ cảnh
- "ốm đau" → "ấn đau" (khám bụng)
- "họng từng cơn" → "hông từng cơn" (đau hông)
- "nặng 50 ký" → cân nặng 50 kg
- "cao 1 m 65" → chiều cao 165 cm
- Các số đọc dạng "150 trên 80" → HA 150/80 mmHg

### 2. PHÂN LOẠI:
- "lyDoVaoVien": Lý do chính vào viện (1 câu ngắn)
- "quaTrinhBenhLy": Diễn biến từ khởi phát đến nhập viện. LUÔN bắt đầu bằng "Bệnh nhân" (VD: "Bệnh nhân đau bụng vùng hông phải 2 ngày...")
- "khamToanThan": Tình trạng lúc khám (toàn thân)
- "khamBoPhan": Khám các bộ phận cụ thể
- "chanDoanBanDau": Chẩn đoán sơ bộ
- "chieuCao": ĐƠN VỊ CM (convert từ m sang cm)

### 3. VĂN PHONG:
- Telegraphic style: lược bỏ từ thừa, chủ ngữ
- Viết cụm từ ngắn gọn, chuyên nghiệp y khoa

### 4. OUTPUT: Trả về ĐÚNG JSON, KHÔNG kèm text giải thích.

{
  "lyDoVaoVien": "", "quaTrinhBenhLy": "", "tienSuBanThan": "", "tienSuGiaDinh": "",
  "khamToanThan": "", "khamBoPhan": "", "chanDoanBanDau": "", "huongXuLy": "",
  "sinhHieu": { "mach": "", "nhietDo": "", "huyetApTamThu": "", "huyetApTamTruong": "", "nhipTho": "", "spO2": "", "canNang": "", "chieuCao": "" },
  "icd10Suggest": [{"code": "", "name": ""}]
}

Văn bản nhập liệu: ${escapedText}`;
}

// ========================================
// API Key Sanitizer
// ========================================
function sanitizeKey(key) {
    if (!key) return '';
    // eslint-disable-next-line no-control-regex
    return key.replace(/[\u0000-\u001F\u007F-\u009F\u200B-\u200D\uFEFF]/g, '').trim();
}

function aiError(message, code = 'AI_ERROR') {
    const err = new Error(message);
    err.code = code;
    return err;
}

// ========================================
// Fetch with Retry
// ========================================
const RETRY_DELAYS = [300, 900]; // 2 retries with backoff

async function fetchWithRetry(url, options, retries = RETRY_DELAYS) {
    let lastError;

    for (let attempt = 0; attempt <= retries.length; attempt++) {
        try {
            const response = await fetch(url, options);

            // Don't retry client errors (4xx) except 429
            if (response.ok) {
                return response;
            }

            if (response.status === 429) {
                throw aiError('⚠️ Google API quota limited. Vui lòng thử lại sau.', 'AI_QUOTA_LIMIT');
            }

            // Retry on 5xx server errors
            if (response.status >= 500 && attempt < retries.length) {
                lastError = new Error(`Server Error: ${response.status}`);
                await new Promise(r => setTimeout(r, retries[attempt]));
                continue;
            }

            // Non-retryable client error
            const errorData = await response.json().catch(() => ({}));
            const code = response.status === 400 || response.status === 401 || response.status === 403
                ? 'AI_INVALID_API_KEY'
                : 'AI_HTTP_ERROR';
            throw aiError(errorData.error?.message || `API Error: ${response.status}`, code);
        } catch (err) {
            // AbortError = user cancelled, don't retry
            if (err.name === 'AbortError') {
                throw aiError('Request đã bị hủy.', 'AI_ABORTED');
            }

            // Network errors: retry
            if (attempt < retries.length && !err.message.includes('quota')) {
                lastError = err;
                await new Promise(r => setTimeout(r, retries[attempt]));
                continue;
            }

            if (!err.code && err instanceof TypeError) {
                throw aiError('Lỗi mạng khi gọi Gemini. Vui lòng kiểm tra kết nối.', 'AI_NETWORK_ERROR');
            }
            throw err;
        }
    }

    throw lastError || new Error('Request failed after retries.');
}

// ========================================
// Robust JSON Parser (handles messy AI output)
// ========================================
function parseAIResponse(rawText) {
    if (!rawText || rawText.trim().length === 0) {
        throw new Error('AI trả về kết quả rỗng. Hãy thử lại!');
    }

    // Step 1: Clean markdown code blocks
    let text = rawText
        .replace(/```json\s*/gi, '')
        .replace(/```\s*/g, '')
        .trim();

    // Step 2: Try direct parse
    try {
        return JSON.parse(text);
    } catch (_) { /* continue */ }

    // Step 3: Extract JSON object from surrounding text
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace > firstBrace) {
        try {
            return JSON.parse(text.substring(firstBrace, lastBrace + 1));
        } catch (_) { /* continue */ }
    }

    // Step 4: Fix common JSON issues from AI
    let cleaned = text.substring(
        firstBrace !== -1 ? firstBrace : 0,
        lastBrace !== -1 ? lastBrace + 1 : text.length
    );
    // Remove trailing commas before } or ]
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
    // Fix unescaped newlines in strings
    cleaned = cleaned.replace(/([^\\])\n/g, '$1\\n');

    try {
        return JSON.parse(cleaned);
    } catch (_) { /* continue */ }

    // Step 5: Last resort — try to find any valid JSON object
    const jsonMatch = text.match(/\{[\s\S]*"lyDoVaoVien"[\s\S]*\}/);
    if (jsonMatch) {
        try {
            return JSON.parse(jsonMatch[0]);
        } catch (_) { /* continue */ }
    }

    console.error('[AI Client] All JSON parse attempts failed. Raw:', rawText.substring(0, 300));
    throw new Error('Lỗi đọc JSON từ AI. Hãy thử lại!');
}

// ========================================
// Background-only Gemini helpers
// ========================================
async function resolveApiKey(optionalApiKey = '') {
    let apiKey = sanitizeKey(optionalApiKey);
    if (apiKey) return apiKey;

    const result = await chrome.storage.local.get([
        'geminiApiKey_encrypted',
        'pin_salt'
    ]);

    if (result.geminiApiKey_encrypted && result.pin_salt) {
        try {
            apiKey = await decryptAPIKeyInBg(result.geminiApiKey_encrypted, result.pin_salt);
        } catch (_e) {
            apiKey = '';
        }
    }

    return sanitizeKey(apiKey);
}

// getTrustedGeminiBaseUrl removed as per BUG-03

async function callGeminiGenerateContent({ prompt, model, requestId, generationConfig = {}, systemInstruction = null }) {
    if (!prompt || typeof prompt !== 'string') {
        throw aiError('Prompt không hợp lệ.', 'AI_INVALID_PAYLOAD');
    }

    // 🛡️ SECURITY GUARD: Redact PHI before sending to external AI API
    const redactedPrompt = PHIRedactor.redact(prompt);
    if (PHIRedactor.containsPHI(redactedPrompt)) {
        console.warn('[Aladinn Security] Blocked AI request due to remaining PHI detection.');
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'LOG_AUDIT',
                    auditType: 'phi_redaction_blocked',
                    details: { context: 'callGeminiGenerateContent' }
                });
            }
        } catch (_e) {}
        throw aiError('Aladinn không gửi dữ liệu lên AI vì phát hiện thông tin định danh chưa được khử. Vui lòng kiểm tra lại nội dung.', 'AI_PHI_BLOCKED');
    }

    const apiKey = await resolveApiKey();
    if (!apiKey) {
        throw aiError('Chưa cấu hình API Key hoặc phiên đã khóa. Vui lòng nhập PIN.', 'AI_LOCKED');
    }

    await waitForRateLimit();

    const controller = new AbortController();
    if (requestId) {
        _abortControllers.set(requestId, controller);
    }

    try {
        const apiVersion = 'v1beta';
        const baseUrl = 'https://generativelanguage.googleapis.com';
        const effectiveModel = model || 'gemini-2.0-flash';
        const modelUrl = `${baseUrl}/${apiVersion}/models/${effectiveModel}:generateContent`;
        const payload = {
            contents: [{ parts: [{ text: redactedPrompt }] }],
            generationConfig
        };
        if (systemInstruction) {
            payload.system_instruction = { parts: [{ text: systemInstruction }] };
        }

        const response = await fetchWithRetry(modelUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        return response.json();
    } finally {
        if (requestId) {
            _abortControllers.delete(requestId);
        }
    }
}

export async function requestScannerAI({ prompt, model, requestId, generationConfig }) {
    const data = await callGeminiGenerateContent({
        prompt,
        model,
        requestId,
        generationConfig: generationConfig || { temperature: 0.1 }
    });
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!text) {
        throw aiError(data.error?.message || 'Lỗi từ máy chủ AI', 'AI_EMPTY_RESPONSE');
    }
    return { text, usageMetadata: data.usageMetadata || {}, model };
}

export async function summarizeHistoryAI({ rawTreatments, model, targetField }) {
    let systemInstruction = `Bạn là một Bác sĩ Trưởng khoa đang viết Tờ "Tổng kết Hồ sơ Bệnh án" (Phần 1: Quá trình bệnh lý và Diễn biến lâm sàng) để lưu trữ hồ sơ xuất viện theo Chuẩn Bộ Y tế Việt Nam.

Dưới đây là toàn bộ số liệu chăm sóc và điều trị của đợt bệnh này. Hãy tổng hợp lại thành một bản tóm tắt có giá trị pháp lý và chuyên môn cao:

== YÊU CẦU CHUYÊN MÔN KẾT ÁN ==
1. Tóm lược rất ngắn gọn tình trạng lúc vào viện.
2. Nêu bật các diễn biến lâm sàng XẤU ĐI hoặc CẢI THIỆN RÕ RỆT trong suốt quá trình nằm viện. Nếu nhiều ngày liền tình trạng không đổi, hãy gom chúng lại.
3. Mục cuối cùng ghi rõ "Tình trạng hiện tại: ..." (là diễn biến lâm sàng của tờ điều trị cuối cùng).
4. TUYỆT ĐỐI BẢO LƯU TÍNH CHÍNH XÁC: Không chế bản, không tự bịa thuốc/chỉ định nếu văn bản gốc không có.
5. VĂN PHONG SÚC TÍCH: Định dạng thành 1-2 đoạn văn chuyên khoa mạch lạc. CHỈ TRẢ VỀ NỘI DUNG TÓM TẮT. KHÔNG CHỨA LỜI CHÀO. KHÔNG BỌC TRONG KHUNG MARKDOWN.`;

    if (targetField === 'CANLAMSANG') {
        systemInstruction = 'Hãy CHỈ giữ lại các chỉ định siêu âm, x-quang, xét nghiệm máu/nước tiểu sinh hóa và kết quả của chúng. Bỏ qua các thông tin khác.';
    }

    const data = await callGeminiGenerateContent({
        prompt: `DỮ LIỆU ĐIỀU TRỊ (Đã được ẩn danh):\n${rawTreatments || ''}`,
        model: model || 'gemini-2.0-flash',
        generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            topK: 40
        },
        systemInstruction
    });

    const output = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    if (!output) {
        throw aiError(data.error?.message || 'AI không trả về nội dung', 'AI_EMPTY_RESPONSE');
    }
    return { text: output, usageMetadata: data.usageMetadata || {} };
}

export async function listGeminiModels({ apiKey } = {}) {
    const resolvedKey = await resolveApiKey(apiKey || '');
    if (!resolvedKey) {
        throw aiError('API Key chưa được cấu hình hoặc phiên đã khóa.', 'AI_LOCKED');
    }

    const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
        headers: { 'x-goog-api-key': resolvedKey }
    });
    if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        const code = response.status === 400 || response.status === 401 || response.status === 403
            ? 'AI_INVALID_API_KEY'
            : 'AI_HTTP_ERROR';
        throw aiError(err.error?.message || 'Lỗi HTTP ' + response.status, code);
    }
    const data = await response.json();
    return (data.models || [])
        .filter(m => m.name?.includes('gemini') &&
            Array.isArray(m.supportedGenerationMethods) &&
            m.supportedGenerationMethods.includes('generateContent'))
        .map(m => ({
            id: m.name.replace('models/', ''),
            name: m.displayName || m.name.replace('models/', ''),
            description: m.description || ''
        }));
}

// ========================================
// Main AI Request Handler
// ========================================
/**
 * Process an AI request with rate-limiting, retry, and cancel support.
 * @param {Object} params
 * @param {string} params.text - Input text
 * @param {string} params.model - Gemini model name
 * @param {string} params.requestId - Request ID for cancellation
 * @returns {Promise<Object>} - Parsed JSON result from Gemini
 */
export async function requestAI({ text, model, requestId }) {
    const apiKey = await resolveApiKey();

    if (!apiKey) {
        throw aiError('Chưa cấu hình API Key hoặc phiên đã khóa. Vui lòng nhập PIN.', 'AI_LOCKED');
    }

    // Rate limit
    await waitForRateLimit();

    // Setup abort controller
    const controller = new AbortController();
    if (requestId) {
        _abortControllers.set(requestId, controller);
    }

    // 🛡️ SECURITY GUARD: Redact PHI
    const redactedPrompt = PHIRedactor.redact(text);
    if (PHIRedactor.containsPHI(redactedPrompt)) {
        console.warn('[Aladinn Security] Blocked Voice AI request due to remaining PHI detection.');
        try {
            if (typeof chrome !== 'undefined' && chrome.runtime) {
                chrome.runtime.sendMessage({
                    type: 'LOG_AUDIT',
                    auditType: 'phi_redaction_blocked',
                    details: { context: 'requestAI' }
                });
            }
        } catch (_e) {}
        throw aiError('Aladinn không gửi dữ liệu lên AI vì phát hiện thông tin định danh chưa được khử. Vui lòng kiểm tra lại nội dung.', 'AI_PHI_BLOCKED');
    }

    try {
        const systemPrompt = buildSystemPrompt(redactedPrompt);
        const apiVersion = 'v1beta';
        const baseUrl = 'https://generativelanguage.googleapis.com';
        const effectiveModel = model || 'gemini-2.0-flash';
        const modelUrl = `${baseUrl}/${apiVersion}/models/${effectiveModel}:generateContent`;

        const payload = {
            contents: [{ parts: [{ text: systemPrompt }] }],
            generationConfig: {
                temperature: 0.1,
                maxOutputTokens: 2048,
                response_mime_type: 'application/json'
            }
        };

        const response = await fetchWithRetry(modelUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': apiKey
            },
            body: JSON.stringify(payload),
            signal: controller.signal
        });

        const data = await response.json();
        const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const parsed = parseAIResponse(resultText);

        // Validate JSON Schema
        const validation = SchemaValidator.validateVoiceClinical(parsed);
        if (!validation.isValid) {
            try {
                if (typeof chrome !== 'undefined' && chrome.runtime) {
                    chrome.runtime.sendMessage({
                        type: 'LOG_AUDIT',
                        auditType: 'ai_schema_error',
                        details: { error: validation.error }
                    });
                }
            } catch (_e) {}
            throw aiError(`Lỗi định dạng AI: ${validation.error}`, 'AI_SCHEMA_INVALID');
        }

        // Attach token usage for cost estimation
        const usage = data.usageMetadata || {};
        return {
            ...parsed,
            _meta: {
                model: model,
                promptTokens: usage.promptTokenCount || 0,
                outputTokens: usage.candidatesTokenCount || 0,
                totalTokens: usage.totalTokenCount || 0
            }
        };
    } finally {
        if (requestId) {
            _abortControllers.delete(requestId);
        }
    }
}
