/**
 * 🧞 Aladinn v3 POC — Vitest Integration Test
 * 
 * Chạy: pnpm test (từ root Aladinn-v2)
 * 
 * Test tất cả các module POC v3 thông qua Vitest framework
 * đã được cài đặt sẵn trong Aladinn-v2.
 */

import { describe, it, expect } from 'vitest';

// ========== Import POC modules ==========
// AI Router
import { containsPHI, routeDecision } from '../../.playground/poc-local-llm/ai-router.js';
// RAG
import { createProtocolDB, ingestProtocol, queryProtocol, chunkText, buildRAGPrompt, getDBStats } from '../../.playground/poc-rag/rag-pipeline.js';
import { SAMPLE_PROTOCOLS } from '../../.playground/poc-rag/sample-protocols.js';
// OCR
import { extractLabValues } from '../../.playground/poc-ocr/ocr-engine.js';
// Voice
import { postProcessSpeech, simulateVoiceInput } from '../../.playground/poc-voice/voice-engine.js';



// ═══════════════════════════════════════════
// TEST 1: AI Router — PHI Detection & Routing
// ═══════════════════════════════════════════
describe('AI Router: PHI Detection', () => {
  it('detects Vietnamese phone numbers', () => {
    expect(containsPHI('SĐT: 0987654321')).toBe(true);
  });

  it('detects 12-digit CCCD', () => {
    expect(containsPHI('CCCD: 079123456789')).toBe(true);
  });

  it('detects BHYT card number', () => {
    expect(containsPHI('BHYT: DN4010112345678')).toBe(true);
  });

  it('detects email addresses', () => {
    expect(containsPHI('doctor@hospital.vn')).toBe(true);
  });

  it('does NOT flag pure clinical text', () => {
    expect(containsPHI('Bệnh nhân đau bụng 2 ngày, sốt 38 độ')).toBe(false);
  });

  it('does NOT flag lab values', () => {
    expect(containsPHI('AST 45 U/L, ALT 38 U/L, Creatinine 142')).toBe(false);
  });
});

describe('AI Router: Routing Logic', () => {
  it('routes PHI text to local or redaction_required', async () => {
    const route = await routeDecision({
      text: 'BN Nguyễn Văn A, SĐT 0987654321',
      forceLocal: false
    });
    expect(['local', 'cloud_with_redaction_required']).toContain(route);
  });

  it('routes clean text to cloud', async () => {
    const route = await routeDecision({
      text: 'Phác đồ điều trị viêm phổi cộng đồng',
      forceLocal: false
    });
    expect(route).toBe('cloud');
  });

  it('respects forceLocal=true', async () => {
    const route = await routeDecision({ text: 'anything', forceLocal: true });
    expect(route).toBe('local');
  });
});


// ═══════════════════════════════════════════
// TEST 2: RAG Pipeline — Text Chunking & Search
// ═══════════════════════════════════════════
describe('RAG Pipeline: Text Chunking', () => {
  it('keeps short text as single chunk', () => {
    const chunks = chunkText('Đây là đoạn văn ngắn.');
    expect(chunks).toHaveLength(1);
  });

  it('splits long text into multiple chunks', () => {
    const longText = 'A'.repeat(2000);
    const chunks = chunkText(longText, 600, 100);
    expect(chunks.length).toBeGreaterThan(1);
  });
});

describe('RAG Pipeline: Protocol Ingestion & Search', () => {
  let db;
  let totalChunks;

  it('ingests all 5 sample protocols', () => {
    db = createProtocolDB();
    totalChunks = 0;
    for (const protocol of SAMPLE_PROTOCOLS) {
      const count = ingestProtocol(db, protocol);
      totalChunks += count;
      expect(count).toBeGreaterThan(0);
    }
    const stats = getDBStats(db);
    expect(stats.totalChunks).toBe(totalChunks);
    expect(stats.totalChunks).toBeGreaterThan(10);
  });

  it('finds Metformin dose adjustment by eGFR', () => {
    const results = queryProtocol(db, 'Metformin suy thận eGFR chỉnh liều');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].score).toBeGreaterThan(0);
  });

  it('finds Dengue fever treatment protocol', () => {
    const results = queryProtocol(db, 'sốt xuất huyết Dengue tiểu cầu giảm');
    expect(results.length).toBeGreaterThan(0);
  });

  it('finds CAP antibiotic regimen', () => {
    const results = queryProtocol(db, 'kháng sinh viêm phổi Ceftriaxone');
    expect(results.length).toBeGreaterThan(0);
  });

  it('finds hypertension management', () => {
    const results = queryProtocol(db, 'tăng huyết áp ACEi ARB Amlodipine');
    expect(results.length).toBeGreaterThan(0);
  });

  it('builds RAG prompt with context', () => {
    const results = queryProtocol(db, 'Metformin eGFR');
    const prompt = buildRAGPrompt('Metformin có dùng khi eGFR 35?', results);
    expect(prompt).toContain('PHÁC ĐỒ NỘI BỘ');
    expect(prompt).toContain('CÂU HỎI');
    expect(prompt.length).toBeGreaterThan(200);
  });
});


// ═══════════════════════════════════════════
// TEST 3: OCR — Lab Value Extraction
// ═══════════════════════════════════════════
describe('OCR Engine: Lab Value Extraction', () => {
  const mockOCRText = `
    PHIẾU KẾT QUẢ XÉT NGHIỆM
    HUYẾT HỌC
    WBC (Bạch cầu): 12.5 G/L
    RBC (Hồng cầu): 4.2 T/L
    HGB (Hemoglobin): 11.5 g/dL
    PLT (Tiểu cầu): 85 G/L
    HCT (Hematocrit): 38%
    SINH HÓA
    Glucose: 8.5 mmol/L
    Creatinine: 142 µmol/L
    AST (SGOT): 65 U/L
    ALT (SGPT): 48 U/L
    CRP: 45.2 mg/L
    Na: 138 mmol/L
    K: 5.8 mmol/L
    HbA1c: 8.2%
  `;

  let labs;

  it('extracts ≥10 lab values from mock OCR text', () => {
    labs = extractLabValues(mockOCRText);
    expect(labs.length).toBeGreaterThanOrEqual(10);
  });

  it('correctly parses WBC and flags as high', () => {
    const wbc = labs.find(l => l.code === 'WBC');
    expect(wbc?.value).toBe(12.5);
    expect(wbc?.flag).toBe('high');
  });

  it('correctly parses PLT and flags as low', () => {
    const plt = labs.find(l => l.code === 'PLT');
    expect(plt?.value).toBe(85);
    expect(plt?.flag).toBe('low');
  });

  it('correctly parses Creatinine and flags as high', () => {
    const creat = labs.find(l => l.code === 'Creatinine');
    expect(creat?.value).toBe(142);
    expect(creat?.flag).toBe('high');
  });

  it('correctly parses Na as normal', () => {
    const na = labs.find(l => l.code === 'Na');
    expect(na?.flag).toBe('normal');
  });

  it('detects hyperkalemia (K high)', () => {
    const k = labs.find(l => l.code === 'K');
    expect(k?.value).toBe(5.8);
    expect(k?.flag).toBe('high');
  });

  it('detects uncontrolled diabetes (HbA1c high)', () => {
    const hba1c = labs.find(l => l.code === 'HbA1c');
    expect(hba1c?.value).toBe(8.2);
    expect(hba1c?.flag).toBe('high');
  });

  it('counts ≥6 abnormal results', () => {
    const abnormal = labs.filter(l => l.flag !== 'normal');
    expect(abnormal.length).toBeGreaterThanOrEqual(6);
  });
});


// ═══════════════════════════════════════════
// TEST 4: Voice Engine — Speech Post-Processing
// ═══════════════════════════════════════════
describe('Voice Engine: Medical Term Correction', () => {
  it('corrects "ốm đau" → "ấn đau"', () => {
    const result = postProcessSpeech('Bệnh nhân ốm đau nhiều khi ấn');
    expect(result).toContain('ấn đau');
  });

  it('corrects "sin hiệu" → "sinh hiệu"', () => {
    const result = postProcessSpeech('sin hiệu: mạch 80');
    expect(result).toContain('sinh hiệu');
  });

  it('corrects "trận đấu" → "chẩn đoán"', () => {
    const result = postProcessSpeech('trận đấu sơ bộ');
    expect(result).toContain('chẩn đoán');
  });

  it('corrects "viên phối" → "viêm phổi"', () => {
    const result = postProcessSpeech('viên phối cộng đồng');
    expect(result).toContain('viêm phổi');
  });
});

describe('Voice Engine: Numeric Normalization', () => {
  it('normalizes BP "150 trên 80" → "150/80 mmHg"', () => {
    const result = postProcessSpeech('huyết áp 150 trên 80');
    expect(result).toContain('150/80 mmHg');
  });

  it('normalizes weight "65 ký" → "cân nặng 65 kg"', () => {
    const result = postProcessSpeech('nặng 65 ký');
    expect(result).toContain('cân nặng 65 kg');
  });

  it('normalizes height "1 m 72" → "chiều cao 172 cm"', () => {
    const result = postProcessSpeech('cao 1 m 72');
    expect(result).toContain('chiều cao 172 cm');
  });
});

describe('Voice Engine: Full Simulation', () => {
  it('processes a full clinical dictation with multiple corrections', () => {
    const sim = simulateVoiceInput(
      'Bệnh nhân đau bụng, bên sở: tiểu đường, huyết áp 140 trên 90'
    );
    expect(sim.correctedText).toContain('bệnh sử');
    expect(sim.correctedText).toContain('140/90 mmHg');
    expect(sim.corrections.length).toBeGreaterThan(0);
    expect(sim.engine).toBe('mock_whisper');
  });
});
