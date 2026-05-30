/* global process */
/**
 * 🧞 Aladinn v2 — Bộ Test Tự Động (Zero Dependencies)
 * 
 * Chạy: node .playground/run-all-tests.js
 * 
 * Test các module mà KHÔNG cần npm install:
 * 1. AI Router — PHI detection & routing logic
 * 2. RAG Pipeline — Ingestion, chunking, search (dùng MiniSearch)
 * 3. OCR Engine — Lab value extraction from text (regex only)
 * 4. Voice Engine — Speech post-processing corrections
 */

import { routeDecision, containsPHI } from './poc-local-llm/ai-router.js';
import { createProtocolDB, ingestProtocol, queryProtocol, chunkText, buildRAGPrompt, getDBStats } from './poc-rag/rag-pipeline.js';
import { SAMPLE_PROTOCOLS } from './poc-rag/sample-protocols.js';
import { extractLabValues } from './poc-ocr/ocr-engine.js';
import { postProcessSpeech, simulateVoiceInput } from './poc-voice/voice-engine.js';

let passed = 0;
let failed = 0;

function assert(condition, testName) {
  if (condition) {
    console.log(`  ✅ ${testName}`);
    passed++;
  } else {
    console.error(`  ❌ FAIL: ${testName}`);
    failed++;
  }
}

// ========================================
// TEST 1: AI Router — PHI Detection
// ========================================
async function testAIRouter() {
  console.log('\n🔀 === TEST: AI Router ===');
  
  assert(containsPHI('SĐT: 0987654321') === true, 'Detect phone number');
  assert(containsPHI('CCCD: 079123456789') === true, 'Detect CCCD 12 digits');
  assert(containsPHI('BHYT: DN4010112345678') === true, 'Detect BHYT card');
  assert(containsPHI('email@hospital.com') === true, 'Detect email');
  assert(containsPHI('Bệnh nhân đau bụng 2 ngày, sốt 38 độ') === false, 'No PHI in clinical text');
  assert(containsPHI('AST 45 U/L, ALT 38 U/L') === false, 'No PHI in lab values');
  
  // Routing logic (Ollama likely offline in test environment)
  const routePHI = await routeDecision({ text: 'BN Nguyễn Văn A, SĐT 0987654321, đau bụng', forceLocal: false });
  assert(routePHI === 'cloud_with_redaction_required' || routePHI === 'local', 
    `PHI text routes to local or redaction_required (got: ${routePHI})`);
  
  const routeClean = await routeDecision({ text: 'Phác đồ điều trị viêm phổi cộng đồng', forceLocal: false });
  assert(routeClean === 'cloud', `Clean text routes to cloud (got: ${routeClean})`);
  
  const routeForced = await routeDecision({ text: 'any text', forceLocal: true });
  assert(routeForced === 'local', `forceLocal=true always routes local (got: ${routeForced})`);
}

// ========================================
// TEST 2: RAG Pipeline (MiniSearch)
// ========================================
function testRAGPipeline() {
  console.log('\n📚 === TEST: RAG Pipeline ===');
  
  // Chunking
  const shortText = 'Đây là đoạn văn ngắn.';
  const chunks = chunkText(shortText);
  assert(chunks.length === 1, 'Short text → 1 chunk');
  
  const longText = 'A'.repeat(2000);
  const longChunks = chunkText(longText, 600, 100);
  assert(longChunks.length > 1, `Long text split into ${longChunks.length} chunks`);
  
  // Create DB and ingest
  const db = createProtocolDB();
  
  let totalIngested = 0;
  for (const protocol of SAMPLE_PROTOCOLS) {
    const count = ingestProtocol(db, protocol);
    totalIngested += count;
    console.log(`  📄 Ingested "${protocol.title}" → ${count} chunks`);
  }
  
  const stats = getDBStats(db);
  assert(stats.totalChunks === totalIngested, `DB has ${stats.totalChunks} total chunks`);
  assert(stats.totalChunks > 10, `Enough chunks for search (${stats.totalChunks})`);
  
  // Search
  const results1 = queryProtocol(db, 'Metformin suy thận eGFR chỉnh liều');
  assert(results1.length > 0, `Found ${results1.length} results for "Metformin suy thận eGFR"`);
  assert(results1[0].score > 0, `Top result has positive score: ${results1[0].score.toFixed(4)}`);
  console.log(`    → Top hit: "${results1[0].title}" / ${results1[0].section}`);
  
  const results2 = queryProtocol(db, 'sốt xuất huyết Dengue tiểu cầu giảm');
  assert(results2.length > 0, `Found ${results2.length} results for Dengue query`);
  console.log(`    → Top hit: "${results2[0].title}" / ${results2[0].section}`);
  
  const results3 = queryProtocol(db, 'kháng sinh viêm phổi Ceftriaxone liều dùng');
  assert(results3.length > 0, `Found ${results3.length} results for antibiotics query`);
  console.log(`    → Top hit: "${results3[0].title}" / ${results3[0].section}`);
  
  const results4 = queryProtocol(db, 'huyết áp ACEi ARB Amlodipine');
  assert(results4.length > 0, `Found ${results4.length} results for hypertension query`);
  console.log(`    → Top hit: "${results4[0].title}" / ${results4[0].section}`);
  
  // RAG Prompt building
  const prompt = buildRAGPrompt('Metformin có dùng được cho BN eGFR 35 không?', results1);
  assert(prompt.includes('PHÁC ĐỒ NỘI BỘ'), 'RAG prompt contains protocol context');
  assert(prompt.includes('CÂU HỎI'), 'RAG prompt contains question');
  assert(prompt.length > 200, `RAG prompt is substantial (${prompt.length} chars)`);
}

// ========================================
// TEST 3: OCR Lab Extraction (Regex only)
// ========================================
function testOCRExtraction() {
  console.log('\n🔬 === TEST: OCR Lab Extraction ===');
  
  const mockOCRText = `
    PHIẾU KẾT QUẢ XÉT NGHIỆM
    Họ tên: [REDACTED]     Ngày: 21/05/2026
    
    HUYẾT HỌC
    WBC (Bạch cầu): 12.5 G/L       [4.0 - 10.0]
    RBC (Hồng cầu): 4.2 T/L        [4.0 - 5.5]
    HGB (Hemoglobin): 11.5 g/dL     [12.0 - 17.0]
    PLT (Tiểu cầu): 85 G/L          [150 - 400]
    HCT (Hematocrit): 38%           [36 - 48]
    
    SINH HÓA
    Glucose: 8.5 mmol/L             [3.9 - 6.1]
    Creatinine: 142 µmol/L          [62 - 106]
    AST (SGOT): 65 U/L              [0 - 40]
    ALT (SGPT): 48 U/L              [0 - 40]
    CRP: 45.2 mg/L                  [0 - 5]
    Na: 138 mmol/L                  [136 - 145]
    K: 5.8 mmol/L                   [3.5 - 5.0]
    HbA1c: 8.2%                     [4.0 - 5.6]
  `;
  
  const labs = extractLabValues(mockOCRText);
  assert(labs.length >= 10, `Extracted ${labs.length} lab values (≥10 expected)`);
  
  const wbc = labs.find(l => l.code === 'WBC');
  assert(wbc && wbc.value === 12.5, `WBC = ${wbc?.value} (expected 12.5)`);
  assert(wbc && wbc.flag === 'high', 'WBC flagged high');
  
  const plt = labs.find(l => l.code === 'PLT');
  assert(plt && plt.value === 85, `PLT = ${plt?.value} (expected 85)`);
  assert(plt && plt.flag === 'low', 'PLT flagged low');
  
  const creat = labs.find(l => l.code === 'Creatinine');
  assert(creat && creat.value === 142, `Creatinine = ${creat?.value} (expected 142)`);
  assert(creat && creat.flag === 'high', 'Creatinine flagged high');
  
  const na = labs.find(l => l.code === 'Na');
  assert(na && na.flag === 'normal', `Na = ${na?.value} flagged normal`);
  
  const k = labs.find(l => l.code === 'K');
  assert(k && k.flag === 'high', `K = ${k?.value} flagged high (hyperkalemia)`);
  
  const hba1c = labs.find(l => l.code === 'HbA1c');
  assert(hba1c && hba1c.value === 8.2, `HbA1c = ${hba1c?.value}`);
  assert(hba1c && hba1c.flag === 'high', 'HbA1c flagged high (uncontrolled DM)');
  
  const abnormal = labs.filter(l => l.flag !== 'normal');
  assert(abnormal.length >= 6, `Detected ${abnormal.length} abnormal values (≥6 expected)`);
}

// ========================================
// TEST 4: Voice Post-Processing
// ========================================
function testVoiceEngine() {
  console.log('\n🎙️ === TEST: Voice Engine ===');
  
  const t1 = postProcessSpeech('Bệnh nhân đau bụng hố chậu phải, ốm đau nhiều khi ấn');
  assert(t1.includes('ấn đau'), '"ốm đau" → "ấn đau"');
  
  const t2 = postProcessSpeech('sin hiệu: mạch 80, nhiệt 38 độ');
  assert(t2.includes('sinh hiệu'), '"sin hiệu" → "sinh hiệu"');
  
  const t3 = postProcessSpeech('trận đấu sơ bộ: viên phối cộng đồng');
  assert(t3.includes('chẩn đoán'), '"trận đấu" → "chẩn đoán"');
  assert(t3.includes('viêm phổi'), '"viên phối" → "viêm phổi"');
  
  const t4 = postProcessSpeech('huyết áp 150 trên 80');
  assert(t4.includes('150/80 mmHg'), '"150 trên 80" → "150/80 mmHg"');
  
  const t5 = postProcessSpeech('nặng 65 ký');
  assert(t5.includes('cân nặng 65 kg'), '"nặng 65 ký" → "cân nặng 65 kg"');
  
  const t6 = postProcessSpeech('cao 1 m 72');
  assert(t6.includes('chiều cao 172 cm'), '"cao 1 m 72" → "chiều cao 172 cm"');
  
  const sim = simulateVoiceInput('Bệnh nhân đau bụng, bên sở: tiểu đường, huyết áp 140 trên 90');
  assert(sim.correctedText.includes('bệnh sử'), 'Full sim: "bên sở" → "bệnh sử"');
  assert(sim.correctedText.includes('140/90 mmHg'), 'Full sim: BP normalized');
  assert(sim.corrections.length > 0, `Full sim: ${sim.corrections.length} corrections`);
}

// ========================================
// RUN ALL
// ========================================
async function main() {
  console.log('╔═══════════════════════════════════════════════════╗');
  console.log('║  🧞 Aladinn v2.0 — POC Test Suite (Zero-Dep)     ║');
  console.log('║  Testing: AI Router, RAG, OCR, Voice             ║');
  console.log('╚═══════════════════════════════════════════════════╝');
  
  const startTime = Date.now();
  
  try {
    await testAIRouter();
    testRAGPipeline();
    testOCRExtraction();
    testVoiceEngine();
  } catch (err) {
    console.error('\n💥 Fatal error:', err);
    failed++;
  }
  
  const elapsed = Date.now() - startTime;
  
  console.log('\n═══════════════════════════════════════════════════');
  console.log(`  Tests: ${passed + failed} total | ✅ ${passed} passed | ❌ ${failed} failed`);
  console.log(`  Time:  ${elapsed}ms`);
  console.log('═══════════════════════════════════════════════════');
  
  if (failed > 0) process.exit(1);
}

main();
