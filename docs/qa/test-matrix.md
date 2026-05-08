# Aladinn Test Matrix

Tài liệu này xác định các nhóm chức năng cốt lõi và ma trận kiểm thử (Test Matrix) cho dự án Aladinn.

## Nhóm 1: Security & Session

| Test Case | File | Status |
|---|---|---|
| Derive key từ PIN + cache CryptoKey | `security-session.test.js` | ✅ |
| Session timeout 30 phút → wipe key | `security-session.test.js` | ✅ |
| Session NOT timeout trước 30 phút | `security-session.test.js` | ✅ |
| Logout purge (`_bgCachedKey = null`) | `security-session.test.js` | ✅ |
| Sender validation: accept extension pages | `security-session.test.js` | ✅ |
| Sender validation: accept vncare.vn | `security-session.test.js` | ✅ |
| Sender validation: reject other extension | `security-session.test.js` | ✅ |
| Sender validation: reject non-vncare | `security-session.test.js` | ✅ |
| Sender validation: reject localhost | `security-session.test.js` | ✅ |
| Settings whitelist: không lộ API key (read) | `security-session.test.js` | ✅ |
| Settings whitelist: không ghi API key (write) | `security-session.test.js` | ✅ |
| Encrypt + Decrypt roundtrip | `security-session.test.js` | ✅ |
| Encrypt fail khi chưa có PIN | `security-session.test.js` | ✅ |
| Decrypt fail với format sai | `security-session.test.js` | ✅ |
| Endpoint allowlist chặn URL lạ | `security-session.test.js` | ✅ |

## Nhóm 2: AI Gateway

| Test Case | File | Status |
|---|---|---|
| 5xx maps to AI_HTTP_ERROR | `ai-gateway.test.js` | ✅ |
| 4xx (401/403) → AI_INVALID_API_KEY, no retry | `ai-gateway.test.js` | ✅ |
| 429 → AI_QUOTA_LIMIT handling | `ai-gateway.test.js` | ✅ |
| Cancel request by ID | `ai-gateway.test.js` | ✅ |
| Parse clean JSON | `ai-gateway.test.js` | ✅ |
| Parse markdown-fenced JSON | `ai-gateway.test.js` | ✅ |
| Parse JSON from surrounding text | `ai-gateway.test.js` | ✅ |
| Handle trailing commas | `ai-gateway.test.js` | ✅ |
| Throw on empty response | `ai-gateway.test.js` | ✅ |
| Throw on invalid content | `ai-gateway.test.js` | ✅ |
| Parse nested JSON + markdown | `ai-gateway.test.js` | ✅ |
| Parse mixed markdown + trailing text | `ai-gateway.test.js` | ✅ |
| Locked session → AI_LOCKED (requestAI) | `ai-gateway.test.js` | ✅ |
| Locked session → AI_LOCKED (scannerAI) | `ai-gateway.test.js` | ✅ |
| API key sanitization (invisible chars) | `ai-gateway.test.js` | ✅ |
| Trusted base URL validation | `ai-gateway.test.js` | ✅ |
| Model list with explicit key | `background-ai-client.test.js` | ✅ |
| Model list invalid key → AI_INVALID_API_KEY | `background-ai-client.test.js` | ✅ |

## Nhóm 3: Storage & Encryption

| Test Case | File | Status |
|---|---|---|
| Encrypt/Decrypt Service roundtrip | `security-session.test.js` | ✅ |
| Fail without session key | `security-session.test.js` | ✅ |
| Invalid ciphertext format | `security-session.test.js` | ✅ |

## Nhóm 4: CDS Engine (Clinical Decision Support)

| Test Case | File | Status |
|---|---|---|
| DDI detection: warfarin + aspirin | `cds/cds-engine.test.js` | ✅ |
| DDI detection: metformin + cimetidine | `cds/cds-engine.test.js` | ✅ |
| DDI: skip inactive rules | `cds/cds-engine.test.js` | ✅ |
| DDI: no alert for non-interacting drugs | `cds/cds-engine.test.js` | ✅ |
| DDI: no alert for single drug | `cds/cds-engine.test.js` | ✅ |
| DDI: reversed drug pair works | `cds/cds-engine.test.js` | ✅ |
| Duplicate therapy: 2 PPIs | `cds/cds-engine.test.js` | ✅ |
| Duplicate therapy: different classes OK | `cds/cds-engine.test.js` | ✅ |
| Duplicate therapy: ignore unknown class | `cds/cds-engine.test.js` | ✅ |
| Duplicate therapy: single drug OK | `cds/cds-engine.test.js` | ✅ |
| Drug-Lab: warfarin + INR > 3 | `cds/cds-engine.test.js` | ✅ |
| Drug-Lab: warfarin + normal INR (no alert) | `cds/cds-engine.test.js` | ✅ |
| Drug-Lab: metformin + eGFR < 30 | `cds/cds-engine.test.js` | ✅ |
| Drug-Lab: no drug match (no alert) | `cds/cds-engine.test.js` | ✅ |
| Drug-Lab: no lab available (no alert) | `cds/cds-engine.test.js` | ✅ |
| ICD matching: exact code | `cds/cds-engine.test.js` | ✅ |
| ICD matching: range E10-E14 | `cds/cds-engine.test.js` | ✅ |
| ICD matching: outside range | `cds/cds-engine.test.js` | ✅ |
| ICD matching: prefix match | `cds/cds-engine.test.js` | ✅ |
| ICD matching: empty/null inputs | `cds/cds-engine.test.js` | ✅ |
| ICD range: same-letter ranges | `cds-icd-range.test.js` | ✅ |
| ICD range: decimal ranges | `cds-icd-range.test.js` | ✅ |
| Negative: safe prescription (no alert) | `cds/cds-engine.test.js` | ✅ |
| Negative: empty drug list (no alert) | `cds/cds-engine.test.js` | ✅ |
| Negative: no false DDI for similar prefix | `cds/cds-engine.test.js` | ✅ |
| CDS Cache: empty init | `cds-cache.test.js` | ✅ |
| CDS Cache: handle incoming data | `cds-cache.test.js` | ✅ |
| CDS Cache: reset on patient change | `cds-cache.test.js` | ✅ |

## Nhóm 5: Audit & Telemetry

| Test Case | File | Status |
|---|---|---|
| PHI masking: long ID | `shared/audit-telemetry.test.js` | ✅ |
| PHI masking: short ID | `shared/audit-telemetry.test.js` | ✅ |
| PHI masking: null/undefined | `shared/audit-telemetry.test.js` | ✅ |
| Event creation: all required fields | `shared/audit-telemetry.test.js` | ✅ |
| Event creation: failure event | `shared/audit-telemetry.test.js` | ✅ |
| Event creation: extra metadata | `shared/audit-telemetry.test.js` | ✅ |
| Event: valid ISO timestamp | `shared/audit-telemetry.test.js` | ✅ |
| Event: no PHI fields | `shared/audit-telemetry.test.js` | ✅ |

## Nhóm 6: Extension Messaging

| Test Case | File | Status |
|---|---|---|
| Basic test configured | `basic.test.js` | ✅ |

## Tổng kết

| Metric | Value |
|---|---|
| **Test files** | 8 |
| **Total tests** | 72 |
| **Pass rate** | 100% |
| **Coverage: ai-client.js** | ~47% |
| **Coverage: cds-cache.js** | ~39% |
| **Coverage: audit-telemetry.js** | ~15% |
