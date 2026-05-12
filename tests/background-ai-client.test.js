import { beforeEach, describe, expect, it, vi, afterEach } from 'vitest';

async function loadAiClient() {
  vi.resetModules();
  return import('../background/ai-client.js');
}

describe('background AI gateway', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({
              pin_salt: btoa('testsalt123'),
              geminiApiKey_encrypted: 'bW9jaw==:Y2lwaGVy'
          }))
        }
      }
    };
    globalThis.fetch = vi.fn();
    
    const dummyKey = { type: 'secret', extractable: false, algorithm: { name: 'AES-GCM' }, usages: ['decrypt', 'encrypt'] };
    vi.spyOn(globalThis.crypto.subtle, 'importKey').mockResolvedValue(dummyKey);
    vi.spyOn(globalThis.crypto.subtle, 'deriveKey').mockResolvedValue(dummyKey);
    vi.spyOn(globalThis.crypto.subtle, 'encrypt').mockResolvedValue(new Uint8Array([1, 2, 3]).buffer);
    vi.spyOn(globalThis.crypto.subtle, 'decrypt').mockResolvedValue(new Uint8Array([118, 97, 108, 105, 100, 45, 107, 101, 121]).buffer);
    vi.spyOn(globalThis.crypto, 'getRandomValues').mockImplementation((arr) => { arr.fill(1); return arr; });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function setupMockedKey(aiClient) {
    await globalThis.deriveBgKeyFromPin('123456');
  }

  it('lists Gemini models through background with an explicit API key', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'models/gemini-2.5-flash',
            displayName: 'Gemini 2.5 Flash',
            description: 'fast',
            supportedGenerationMethods: ['generateContent']
          }
        ]
      })
    });

    const aiClient = await loadAiClient();
    const models = await aiClient.listGeminiModels({ apiKey: 'test-key' });
    expect(models).toEqual([{ id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'fast' }]);
  });

  it('returns a typed locked error when scanner AI runs without an unlocked key', async () => {
    const aiClient = await loadAiClient();
    globalThis.chrome.storage.local.get.mockResolvedValue({});
    
    await expect(aiClient.requestScannerAI({ prompt: 'test', model: 'gemini-2.5-flash' }))
      .rejects.toMatchObject({ code: 'AI_LOCKED' });
  });

  it('retries fetch when encountering a 5xx server error', async () => {
    globalThis.fetch
      .mockResolvedValueOnce({ ok: false, status: 500 }) // First fails
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: '{"lyDoVaoVien":"Đau bụng"}' }] } }]
        })
      });

    const aiClient = await loadAiClient();
    await setupMockedKey(aiClient);
    
    const req = aiClient.requestScannerAI({ prompt: 'test', model: 'gemini-2.5-flash' });
    await vi.runAllTimersAsync();
    const res = await req;
    
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
    expect(res.text).toBe('{"lyDoVaoVien":"Đau bụng"}');
  });

  it('fails immediately without retry on 429 quota limited', async () => {
    globalThis.fetch.mockResolvedValue({ ok: false, status: 429 });

    const aiClient = await loadAiClient();
    await setupMockedKey(aiClient);
    
    const req = aiClient.requestScannerAI({ prompt: 'test', model: 'gemini-2.5-flash' });
    const assertion = expect(req).rejects.toMatchObject({ code: 'AI_QUOTA_LIMIT' });
    await vi.runAllTimersAsync();
    
    await assertion;
  });

  it('parses dirty JSON correctly', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [{ content: { parts: [{ text: '```json\n{"lyDoVaoVien":"Đau bụng"}\n```' }] } }]
      })
    });

    const aiClient = await loadAiClient();
    await setupMockedKey(aiClient);
    const req = aiClient.requestScannerAI({ prompt: 'test', model: 'gemini-2.5-flash' });
    await vi.runAllTimersAsync();
    const res = await req;
    
    expect(res.text).toBe('```json\n{"lyDoVaoVien":"Đau bụng"}\n```');
  });

  it('supports cancellation of requests', async () => {
    globalThis.fetch.mockImplementation((url, options) => {
        return new Promise((resolve, reject) => {
            options.signal.addEventListener('abort', () => {
                const err = new Error('aborted');
                err.name = 'AbortError';
                reject(err);
            });
        });
    });

    const aiClient = await loadAiClient();
    await setupMockedKey(aiClient);
    
    const reqPromise = aiClient.requestScannerAI({ prompt: 'test', model: 'gemini-2.5-flash', requestId: 'req-123' });
    const assertion = expect(reqPromise).rejects.toMatchObject({ code: 'AI_ABORTED' });
    
    // Wait until controller is created and fetch is called
    await vi.advanceTimersToNextTimerAsync(); 
    
    aiClient.cancelRequest('req-123'); // Cancel
    
    await vi.runAllTimersAsync();
    
    await assertion;
  });
});
