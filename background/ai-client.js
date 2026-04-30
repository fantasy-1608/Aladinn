/**
 * HIS Voice Assistant - Background AI Client
 * Handles Gemini API calls with rate-limiting, retry, and cancellation.
 * Only runs in background service worker context.
 */

// ========================================
// Crypto Helper (for decrypting API key in background context)
// SECURITY: PIN is never stored. Only the derived CryptoKey (non-extractable) is cached.
// ========================================
const _CRYPTO_ITERATIONS = 100000;
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
    get() { return _cachedDecryptKey; },
    set(v) { _cachedDecryptKey = v; }
});
Object.defineProperty(globalThis, '_bgCachedSalt', {
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
                throw new Error('⚠️ Google API quota limited. Vui lòng thử lại sau.');
            }

            // Retry on 5xx server errors
            if (response.status >= 500 && attempt < retries.length) {
                lastError = new Error(`Server Error: ${response.status}`);
                await new Promise(r => setTimeout(r, retries[attempt]));
                continue;
            }

            // Non-retryable client error
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error?.message || `API Error: ${response.status}`);
        } catch (err) {
            // AbortError = user cancelled, don't retry
            if (err.name === 'AbortError') {
                throw new Error('Request đã bị hủy.', { cause: err });
            }

            // Network errors: retry
            if (attempt < retries.length && !err.message.includes('quota')) {
                lastError = err;
                await new Promise(r => setTimeout(r, retries[attempt]));
                continue;
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
    // Get API key from storage (only encrypted)
    const result = await chrome.storage.local.get([
        'geminiApiKey_encrypted',
        'pin_hash', 'pin_salt', 'geminiBaseUrl'
    ]);

    let apiKey = '';

    // Only allow encrypted key
    if (result.geminiApiKey_encrypted && result.pin_salt) {
        try {
            apiKey = await decryptAPIKeyInBg(result.geminiApiKey_encrypted, result.pin_salt);
        } catch (_e) {
            // Decryption failed
        }
    }

    if (apiKey) {
        apiKey = sanitizeKey(apiKey);
    }

    if (!apiKey) {
        throw new Error('Chưa cấu hình API Key. Vui lòng vào Settings.');
    }

    // Rate limit
    await waitForRateLimit();

    // Setup abort controller
    const controller = new AbortController();
    if (requestId) {
        _abortControllers.set(requestId, controller);
    }

    try {
        const systemPrompt = buildSystemPrompt(text);
        const apiVersion = 'v1beta';
        // [P2-SEC-008] Validate geminiBaseUrl — only allow trusted domains
        const rawBaseUrl = result.geminiBaseUrl || 'https://generativelanguage.googleapis.com';
        const isAllowedEndpoint = (() => {
            try {
                const u = new URL(rawBaseUrl);
                return u.hostname.endsWith('.googleapis.com') ||
                       u.hostname.endsWith('.vncare.vn') ||
                       u.hostname === 'localhost';
            } catch (_) { return false; }
        })();
        const baseUrl = isAllowedEndpoint ? rawBaseUrl : 'https://generativelanguage.googleapis.com';
        if (!isAllowedEndpoint && result.geminiBaseUrl) {
            console.log('[Aladinn Security] ⛔ Blocked untrusted geminiBaseUrl:', result.geminiBaseUrl);
        }
        const modelUrl = `${baseUrl}/${apiVersion}/models/${model}:generateContent`;

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
