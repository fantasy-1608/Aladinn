import { beforeEach, describe, expect, it, vi } from 'vitest';

async function loadAiClient() {
  vi.resetModules();
  return import('../background/ai-client.js');
}

describe('background AI gateway', () => {
  beforeEach(() => {
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn(async () => ({}))
        }
      }
    };
    globalThis.fetch = vi.fn();
  });

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
          },
          {
            name: 'models/embedding-001',
            displayName: 'Embedding',
            supportedGenerationMethods: ['embedContent']
          }
        ]
      })
    });

    const { listGeminiModels } = await loadAiClient();
    const models = await listGeminiModels({ apiKey: 'test-key' });

    expect(models).toEqual([
      { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', description: 'fast' }
    ]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      'https://generativelanguage.googleapis.com/v1beta/models',
      { headers: { 'x-goog-api-key': 'test-key' } }
    );
  });

  it('returns a typed locked error when scanner AI runs without an unlocked key', async () => {
    const { requestScannerAI } = await loadAiClient();

    await expect(requestScannerAI({ prompt: 'test', model: 'gemini-2.5-flash' }))
      .rejects.toMatchObject({
        code: 'AI_LOCKED',
        message: 'Chưa cấu hình API Key hoặc phiên đã khóa. Vui lòng nhập PIN.'
      });
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('maps invalid model-list credentials to AI_INVALID_API_KEY', async () => {
    globalThis.fetch.mockResolvedValue({
      ok: false,
      status: 403,
      json: async () => ({ error: { message: 'API key not valid' } })
    });

    const { listGeminiModels } = await loadAiClient();

    await expect(listGeminiModels({ apiKey: 'bad-key' }))
      .rejects.toMatchObject({ code: 'AI_INVALID_API_KEY', message: 'API key not valid' });
  });
});
