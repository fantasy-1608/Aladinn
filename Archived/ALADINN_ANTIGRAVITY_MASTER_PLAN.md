# ALADINN — MASTER BUILD INSTRUCTIONS FOR ANTIGRAVITY

> File này dùng để đưa trực tiếp vào **Google Antigravity** hoặc AI coding agent tương đương.  
> Mục tiêu: biến Aladinn thành một Chrome Extension hỗ trợ VNPT HIS có kiến trúc rõ ràng, an toàn dữ liệu bệnh nhân, có kiểm thử bắt buộc, có quy trình phát triển bằng AI nhưng không để AI tự sửa code mất kiểm soát.

---

## 0. Vai trò của Antigravity khi làm việc với repo này

Bạn là **senior software engineer + security reviewer + healthcare workflow engineer** đang phát triển dự án **Aladinn — VNPT HIS AI Assistant**.

Bạn phải làm việc theo nguyên tắc:

1. **Không viết code vội.**
2. **Luôn đọc repo hiện tại trước khi sửa.**
3. **Không phá tính năng đang có.**
4. **Không tự ý thay đổi hành vi ghi dữ liệu vào HIS nếu chưa có test bảo vệ.**
5. **Không gửi dữ liệu định danh bệnh nhân lên LLM.**
6. **Không bypass quyền của VNPT HIS.**
7. **Không can thiệp database HIS.**
8. **Không sửa `manifest.json` theo hướng mở rộng quyền nếu không có lý do rõ ràng.**
9. **Mọi thay đổi lớn phải có test, checklist và mô tả rủi ro.**
10. **Fail closed, không fail open**: nếu không chắc đúng bệnh nhân, đúng phiên, đúng màn hình, đúng quyền, thì dừng thao tác và báo lỗi.

---

## 1. Bối cảnh dự án hiện tại

Repo: `fantasy-1608/Aladinn`  
Mục tiêu sản phẩm: Chrome Extension hỗ trợ HIS VNPT cho bác sĩ/điều dưỡng.

Thông tin stack hiện tại:

```json
{
  "name": "aladinn-his-assistant",
  "version": "1.3.1",
  "type": "module",
  "build": "vite build",
  "test": "vitest run",
  "coverage": "vitest run --coverage",
  "lint": "eslint ."
}
```

Extension hiện dùng:

```json
{
  "manifest_version": 3,
  "permissions": [
    "activeTab",
    "alarms",
    "scripting",
    "storage",
    "tabs"
  ],
  "host_permissions": [
    "https://*.vncare.vn/*",
    "https://generativelanguage.googleapis.com/*",
    "https://raw.githubusercontent.com/*",
    "https://api.github.com/*"
  ]
}
```

Kiến trúc hiện mô tả trong README gồm:

```text
background/
  service-worker.js
  ai-client.js
  updater.js

content/
  scanner/
  voice/
  cds/

injected/
  api-bridge.js
  ajax-interceptor.js
  grid-hook.js

popup/
options/
manifest.json
```

Tính năng hiện có:

- Modal lâm sàng 5 tab: khám vào viện, lâm sàng & thuốc, xét nghiệm, chẩn đoán hình ảnh, phân tích AI.
- Voice AI Assistant.
- De-identification trước khi gửi AI.
- Auto-fill vào phiếu HIS.
- ICD-10 gợi ý.
- Slash command templates.
- Phiếu hội chẩn preview/edit.
- CDS: tương tác thuốc, chống chỉ định thuốc-bệnh, trùng nhóm điều trị, BHYT, xét nghiệm + thuốc.
- PACS integration.
- Auto-sign.
- Bảo mật: AES-GCM, PBKDF2, nonce, endpoint allowlist, PHI-redacted log, session timeout.

---

## 2. Mục tiêu lớn của đợt nâng cấp

Mục tiêu không phải thêm tính năng bừa bãi. Mục tiêu là **nâng nền kỹ thuật** để Aladinn an toàn khi phát triển tiếp.

Phải hoàn thành các nhóm việc sau:

1. **Chuẩn hóa kiến trúc module.**
2. **Tạo bộ quy tắc AI coding cho Antigravity.**
3. **Bổ sung patient-context guard để chống điền nhầm bệnh nhân.**
4. **Chuẩn hóa luồng auto-fill và auto-sign.**
5. **Củng cố bảo mật PHI, API key, prompt, message bridge.**
6. **Tạo test bắt buộc cho các module nguy cơ cao.**
7. **Tạo release checklist và quality gate.**
8. **Tạo tài liệu cho người không biết code có thể kiểm tra.**
9. **Áp dụng workflow: rule-based trước, LLM sau.**
10. **Tối ưu chi phí LLM bằng model routing, cache, budget tracking.**

---

## 3. Nguyên tắc kỹ thuật bắt buộc

### 3.1. Không phá tính năng hiện có

Trước khi sửa:

```bash
pnpm install
pnpm run lint
pnpm run test
pnpm run build
```

Nếu repo dùng `npm` thay vì `pnpm`, dùng:

```bash
npm install
npm run lint
npm run test
npm run build
```

Nếu lệnh fail ngay từ đầu, không được tự sửa lan man. Phải:

1. Ghi nhận lỗi ban đầu trong `docs/BASELINE_STATUS.md`.
2. Phân loại lỗi:
   - lỗi dependency,
   - lỗi lint cũ,
   - lỗi test cũ,
   - lỗi build cũ,
   - lỗi runtime.
3. Chỉ sửa lỗi cần thiết để thiết lập baseline.
4. Không refactor lớn trước khi có baseline.

---

### 3.2. Không tự động ghi HIS nếu không chắc đúng bệnh nhân

Mọi thao tác ghi vào HIS phải qua quy trình:

```text
capture patient context BEFORE analysis
        ↓
analysis / AI / rule check
        ↓
capture patient context AGAIN before write
        ↓
compare context
        ↓
if same patient → allow write
if changed → block write + warning
```

Không có ngoại lệ.

---

### 3.3. Rule engine trước, LLM sau

Với dữ liệu HIS:

```text
DOM selector / API payload / regex / schema validation
        ↓
confidence scoring
        ↓
rule engine deterministic
        ↓
LLM only for explanation or low-confidence interpretation
```

Không dùng LLM làm nguồn quyết định duy nhất cho thao tác ghi dữ liệu.

---

### 3.4. Không gửi PHI định danh lên AI

Trước mọi request AI:

- Mask họ tên.
- Mask số hồ sơ.
- Mask mã bệnh nhân.
- Mask CCCD/CMND.
- Mask BHYT.
- Mask số điện thoại.
- Mask địa chỉ.
- Mask ngày sinh nếu không cần thiết.
- Mask tên người nhà.
- Mask thông tin liên hệ.

Chỉ gửi dữ liệu lâm sàng tối thiểu cần thiết.

---

### 3.5. Fail closed

Nếu module không chắc chắn:

| Tình huống | Hành vi bắt buộc |
|---|---|
| Không đọc được patientId | Dừng ghi |
| Không đọc được encounterId | Dừng ghi |
| Patient context thay đổi | Dừng ghi |
| DOM selector không tìm thấy | Dừng module đó, không fallback nguy hiểm |
| API payload thiếu field định danh | Dừng ghi |
| LLM response không đúng schema | Không auto-fill |
| De-identification fail | Không gửi AI |
| Endpoint không nằm trong allowlist | Chặn request |
| Extension mất unlock/session key | Yêu cầu unlock lại |
| Không rõ tab/window hiện tại | Không ký số / không fill |

---

## 4. Các file phải tạo mới

Tạo các file tài liệu sau:

```text
docs/
  BASELINE_STATUS.md
  ALADINN_ARCHITECTURE.md
  ALADINN_SECURITY_POLICY.md
  ALADINN_AI_CODING_RULES.md
  ALADINN_TEST_STRATEGY.md
  ALADINN_RELEASE_CHECKLIST.md
  ALADINN_RISK_REGISTER.md
  ALADINN_HIS_INTEGRATION_RULES.md
  ALADINN_PRIVACY_MODEL.md
  ALADINN_LLM_POLICY.md
  ALADINN_MODULE_MAP.md
  ALADINN_MANUAL_QA_CHECKLIST.md
```

Tạo file hướng dẫn AI ở root:

```text
AGENTS.md
```

Nếu Antigravity hỗ trợ file cấu hình riêng, tạo thêm:

```text
.antigravity/
  instructions.md
  safety-rules.md
  task-template.md
  review-checklist.md
```

Nếu Antigravity không dùng thư mục `.antigravity`, vẫn giữ các file này làm tài liệu nội bộ.

---

## 5. Nội dung bắt buộc của `AGENTS.md`

Tạo `AGENTS.md` ở root với nội dung sau, có thể mở rộng nhưng không được giảm mức an toàn.

```md
# AGENTS.md — Aladinn AI Coding Rules

## Project

Aladinn is a Chrome Extension Manifest V3 for VNPT HIS. It assists clinicians with clinical data scanning, AI summarization, voice input, auto-fill, CDS alerts, PACS view, and controlled auto-sign workflows.

## Non-negotiable safety rules

1. Never bypass VNPT HIS permission boundaries.
2. Never access APIs unavailable to the currently logged-in user.
3. Never write directly to HIS without patient-context verification.
4. Never send identifiable PHI to LLM providers.
5. Never store raw HIS tokens, API keys, or patient identifiers in logs.
6. Never expand Chrome permissions without documenting why.
7. Never change auto-fill or auto-sign behavior without tests.
8. Never use LLM output as the sole authority for writeback.
9. Fail closed on uncertainty.
10. Preserve existing user-facing behavior unless a task explicitly requires changing it.

## Required workflow before coding

1. Inspect relevant files.
2. Search for existing function/module before creating a new one.
3. Write or update tests first for high-risk modules.
4. Implement minimal change.
5. Run lint, test, build.
6. Update docs and changelog.
7. Provide a summary of risk and verification.

## High-risk modules

- content/voice/autofill.js
- content/scanner/clinical-fill.js
- content/sign/*
- content/cds/*
- injected/api-bridge.js
- injected/ajax-interceptor.js
- injected/grid-hook.js
- background/ai-client.js
- background/service-worker.js
- background/updater.js
- options/*
- manifest.json

## Required tests for high-risk changes

- Patient context changed before write.
- Missing patientId blocks write.
- EncounterId mismatch blocks write.
- LLM malformed response blocks auto-fill.
- PHI redaction before AI request.
- Endpoint allowlist blocks non-approved domain.
- Auto-sign stops when tab/window changes.
- Cache is keyed by composite patient key.
- Logs do not contain raw PHI.

## Commands

Run before finalizing:

```bash
pnpm run lint
pnpm run test
pnpm run test:coverage
pnpm run build
```

If pnpm is unavailable:

```bash
npm run lint
npm run test
npm run test:coverage
npm run build
```

## Output expectation

For every task, provide:

1. Files changed.
2. Why changed.
3. Safety impact.
4. Tests added/updated.
5. Commands run.
6. Remaining risks.

```

---

## 6. Chuẩn kiến trúc module cần hướng tới

Không nhất thiết phải refactor toàn bộ một lần. Nhưng code mới phải đi theo kiến trúc sau:

```text
src-or-existing-root/
  core/
    patient-context/
      patient-context-reader.js
      patient-context-guard.js
      patient-context-types.js
      patient-context-errors.js

    privacy/
      phi-redactor.js
      privacy-policy.js
      safe-logger.js

    ai/
      llm-client.js
      model-router.js
      cost-tracker.js
      prompt-builder.js
      response-schema.js
      llm-guard.js

    rules/
      rule-engine.js
      drug-interaction-rules.js
      drug-disease-rules.js
      duplicate-therapy-rules.js
      insurance-rules.js
      lab-medication-rules.js

    his/
      his-api-client.js
      his-api-allowlist.js
      dom-reader.js
      selector-registry.js
      confidence-score.js

    writeback/
      safe-fill.js
      writeback-guard.js
      rollback-snapshot.js
      field-mapper.js

    audit/
      audit-log.js
      audit-redactor.js
      event-types.js

    cache/
      content-hash-cache.js
      patient-cache.js
      cache-policy.js
```

Nếu repo hiện không dùng `src/`, không bắt buộc tạo `src/`. Có thể dùng thư mục hiện có, nhưng phải gom logic tương ứng.

---

## 7. Patient Context Guard — yêu cầu chi tiết

### 7.1. Tạo module

Tạo module:

```text
content/shared/patient-context-guard.js
```

Hoặc nếu có cấu trúc tốt hơn:

```text
core/patient-context/patient-context-guard.js
```

### 7.2. Kiểu dữ liệu chuẩn

```js
/**
 * @typedef {Object} PatientContext
 * @property {string|null} patientId
 * @property {string|null} encounterId
 * @property {string|null} fullNameHash
 * @property {string|null} dobHash
 * @property {string|null} department
 * @property {string|null} tabId
 * @property {string|null} windowId
 * @property {string} source
 * @property {number} capturedAt
 */
```

### 7.3. Hàm bắt buộc

```js
export function normalizePatientContext(raw) {}

export function isPatientContextComplete(ctx) {}

export function comparePatientContext(before, current) {}

export function assertSamePatientContext(before, current) {}

export function createPatientContextSnapshot(source) {}

export function maskPatientContextForLog(ctx) {}
```

### 7.4. So khớp bắt buộc

`assertSamePatientContext()` phải kiểm tra tối thiểu:

```text
patientId
encounterId
fullNameHash nếu có
dobHash nếu có
windowId nếu thao tác liên quan tab/window
tabId nếu thao tác liên quan tab/window
```

### 7.5. Lỗi chuẩn

```js
export class PatientContextError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'PatientContextError';
    this.code = code;
    this.details = details;
  }
}
```

Các mã lỗi:

```text
PATIENT_CONTEXT_MISSING
PATIENT_ID_MISSING
ENCOUNTER_ID_MISSING
PATIENT_CONTEXT_CHANGED
ENCOUNTER_CONTEXT_CHANGED
PATIENT_NAME_MISMATCH
PATIENT_DOB_MISMATCH
TAB_CONTEXT_CHANGED
WINDOW_CONTEXT_CHANGED
PATIENT_CONTEXT_STALE
```

### 7.6. TTL context

Không dùng snapshot quá cũ.

```js
const PATIENT_CONTEXT_TTL_MS = 2 * 60 * 1000;
```

Nếu quá TTL, capture lại. Nếu không capture lại được, dừng ghi.

---

## 8. Writeback Guard — yêu cầu chi tiết

Tạo module:

```text
content/shared/writeback-guard.js
```

Hoặc:

```text
core/writeback/writeback-guard.js
```

### 8.1. API mong muốn

```js
export async function guardedWriteback({
  operationName,
  beforeContext,
  readCurrentContext,
  validatePayload,
  performWrite,
  auditLog,
  onBlocked
}) {
  const currentContext = await readCurrentContext();

  assertSamePatientContext(beforeContext, currentContext);

  const validation = validatePayload();
  if (!validation.ok) {
    throw new Error(`WRITEBACK_PAYLOAD_INVALID: ${validation.reason}`);
  }

  const result = await performWrite();

  await auditLog({
    operationName,
    result: 'success',
    patientContext: maskPatientContextForLog(currentContext)
  });

  return result;
}
```

### 8.2. Áp dụng bắt buộc cho

- Voice AI auto-fill.
- Phiếu hội chẩn import.
- Auto-sign.
- Clinical fill.
- Bất kỳ chức năng nào điền vào HIS form.
- Bất kỳ chức năng nào click submit/save/sign.

---

## 9. De-identification / PHI Redactor

### 9.1. Tạo module

```text
content/shared/phi-redactor.js
```

Hoặc:

```text
core/privacy/phi-redactor.js
```

### 9.2. API bắt buộc

```js
export function redactPHI(inputText, options = {}) {}

export function redactObjectPHI(inputObject, options = {}) {}

export function assertNoPHI(inputText) {}

export function createRedactionReport(before, after) {}
```

### 9.3. Phải mask các nhóm sau

```text
Họ tên bệnh nhân
Mã bệnh nhân
Số hồ sơ
Mã lượt khám
CCCD/CMND
BHYT
Số điện thoại
Địa chỉ
Ngày sinh
Tên người nhà
Số điện thoại người nhà
Email
Mã giường/phòng nếu có thể định danh trong bệnh viện nhỏ
```

### 9.4. Nguyên tắc gửi LLM

Không gửi:

```text
raw DOM toàn trang
raw API response toàn bộ
raw patient profile
raw log
raw localStorage/sessionStorage
raw token/cookie/header
```

Chỉ gửi:

```text
dữ liệu lâm sàng tối thiểu
đã redacted
đã cắt gọn
có schema rõ ràng
```

---

## 10. LLM Policy

Tạo file:

```text
docs/ALADINN_LLM_POLICY.md
```

Nội dung phải có:

```md
# Aladinn LLM Policy

## LLM được phép làm

- Tóm tắt bệnh án đã khử định danh.
- Giải thích cảnh báo CDS.
- Gợi ý ICD-10 với mức tin cậy.
- Chuyển giọng nói thành cấu trúc phiếu khám sau khi đã lọc định danh.
- Phân loại low-confidence text extraction.

## LLM không được phép làm

- Tự động quyết định ghi dữ liệu vào HIS.
- Tự động ký số.
- Tự động bỏ qua cảnh báo.
- Tự động sửa dữ liệu bệnh nhân.
- Nhận dữ liệu định danh bệnh nhân.
- Nhận token/cookie/header/API key.
- Truy cập API HIS thay người dùng.

## Model routing

- Tác vụ rule-based: không dùng LLM.
- Tác vụ giải thích ngắn: dùng model rẻ.
- Tác vụ phân tích phức tạp: dùng model mạnh hơn.
- Tác vụ có chi phí cao: yêu cầu hiển thị token/cost.
- Tác vụ không chắc chắn: trả về low-confidence, không auto-fill.

## Output schema

Mọi output dùng để auto-fill phải là JSON schema xác định. Nếu parse fail hoặc thiếu field bắt buộc, không được fill.
```

---

## 11. Cost-aware LLM Pipeline

Tạo hoặc chỉnh:

```text
background/ai-client.js
core/ai/model-router.js
core/ai/cost-tracker.js
core/ai/llm-guard.js
```

### 11.1. Model router

```js
export function selectModelForTask(task) {
  const {
    taskType,
    inputLength,
    clinicalRisk,
    requiresReasoning,
    userForcedModel
  } = task;

  if (userForcedModel) return userForcedModel;

  if (clinicalRisk === 'high') return 'gemini-2.0-flash'; // hoặc model mạnh cấu hình trong settings

  if (requiresReasoning) return 'gemini-2.0-flash';

  if (inputLength < 3000 && taskType === 'short_explanation') {
    return 'gemini-2.0-flash-lite'; // nếu có cấu hình
  }

  return 'gemini-2.0-flash';
}
```

Không hardcode model nếu options đã có setting. Ưu tiên đọc từ cấu hình hiện có.

### 11.2. Cost tracker

Phải lưu:

```text
timestamp
taskType
model
inputTokens
outputTokens
estimatedCostVND
patientContext masked
success/failure
```

Không lưu raw prompt có PHI.

---

## 12. Rule Engine cho CDS

### 12.1. Nguyên tắc

CDS phải deterministic trước:

```text
Input thuốc + chẩn đoán + xét nghiệm
        ↓
normalize
        ↓
map alias
        ↓
rule engine
        ↓
severity
        ↓
explanation
        ↓
optional LLM explanation only
```

### 12.2. Rule schema đề xuất

```json
{
  "id": "ddi_ketorolac_enoxaparin_bleeding",
  "type": "drug_drug_interaction",
  "severity": "major",
  "confidence": "high",
  "drugA": ["ketorolac"],
  "drugB": ["enoxaparin"],
  "mechanism": "Tăng nguy cơ xuất huyết do phối hợp NSAID và thuốc chống đông",
  "recommendation": "Tránh phối hợp nếu không cần thiết; nếu bắt buộc, theo dõi chảy máu và Hb",
  "source": {
    "name": "local_rule_set",
    "version": "YYYY-MM-DD"
  }
}
```

### 12.3. Severity chuẩn

```text
critical: chặn hoặc yêu cầu xác nhận rất rõ
major: cảnh báo mạnh, cần lý do nếu bỏ qua
moderate: cảnh báo thông thường
minor: thông tin
info: gợi ý
```

### 12.4. Không được

- Không dùng LLM để tự tạo rule mới rồi áp dụng ngay.
- Không cảnh báo nếu không có đủ input.
- Không hiển thị cảnh báo chắc chắn khi chỉ có dữ liệu yếu.
- Không làm gián đoạn workflow quá mức với cảnh báo minor.

---

## 13. DOM Reader và Confidence Scoring

Tạo/chuẩn hóa:

```text
content/shared/dom-reader.js
content/shared/selector-registry.js
content/shared/confidence-score.js
```

### 13.1. Selector registry

Không rải selector khắp code. Gom về một nơi:

```js
export const SELECTORS = {
  patientName: [
    '#patientName',
    '[data-field="patientName"]',
    '.patient-name'
  ],
  patientId: [
    '#patientId',
    '[data-field="patientId"]'
  ],
  diagnosis: [
    'textarea[name="chanDoan"]',
    '#chanDoan'
  ]
};
```

### 13.2. Confidence scoring

```js
export function scoreExtraction(result) {
  let score = 1.0;
  const reasons = [];

  if (!result.patientId) {
    score -= 0.5;
    reasons.push('missing_patient_id');
  }

  if (!result.encounterId) {
    score -= 0.3;
    reasons.push('missing_encounter_id');
  }

  if (result.source === 'fallback_text') {
    score -= 0.2;
    reasons.push('fallback_text_used');
  }

  return {
    score: Math.max(0, score),
    reasons
  };
}
```

Nếu confidence < 0.9 với dữ liệu dùng để ghi: **không ghi**.

---

## 14. Message Bridge Security

Áp dụng cho:

```text
content/scanner/messaging.js
background/service-worker.js
injected/api-bridge.js
injected/ajax-interceptor.js
```

### 14.1. Bắt buộc validate

Mọi message phải có:

```text
type
nonce
source
timestamp
payload schema
```

### 14.2. Chặn

```text
message thiếu nonce
message nonce sai
message quá TTL
message source không hợp lệ
message payload sai schema
message yêu cầu action nguy hiểm không có confirmation
```

### 14.3. Không gửi qua bridge

```text
raw token
cookie
authorization header
raw patient profile
API key
PIN
CryptoKey
```

---

## 15. Endpoint Allowlist

Tạo/chuẩn hóa:

```text
background/endpoint-allowlist.js
```

### 15.1. Domain cho phép hiện tại

```text
https://*.vncare.vn/*
https://generativelanguage.googleapis.com/*
https://raw.githubusercontent.com/*
https://api.github.com/*
localhost chỉ dùng dev nếu explicit dev mode
```

### 15.2. Logic

```js
export function isAllowedEndpoint(url) {}

export function assertAllowedEndpoint(url) {}

export function explainBlockedEndpoint(url) {}
```

Nếu bị chặn, log dạng redacted:

```text
BLOCKED_ENDPOINT host=example.com reason=not_in_allowlist
```

Không log query chứa PHI.

---

## 16. Auto-fill Safety

Áp dụng cho:

```text
content/voice/autofill.js
content/scanner/clinical-fill.js
```

### 16.1. Không được fill trực tiếp từ LLM raw text

Phải qua:

```text
LLM response
    ↓
parse JSON
    ↓
validate schema
    ↓
field mapper
    ↓
patient-context guard
    ↓
preview if high-risk
    ↓
writeback
```

### 16.2. Schema ví dụ

```js
const ClinicalFillSchema = {
  lyDoVaoVien: 'string',
  quaTrinhBenhLy: 'string',
  tienSuBanThan: 'string',
  khamToanThan: 'string',
  khamBoPhan: 'string',
  chanDoanBanDau: 'string',
  sinhHieu: {
    mach: 'number|null',
    nhietDo: 'number|null',
    huyetAp: 'string|null',
    nhipTho: 'number|null',
    spO2: 'number|null'
  }
};
```

Nếu thiếu field, type sai, hoặc field có dấu hiệu hallucination → không auto-fill.

---

## 17. Auto-sign Safety

Áp dụng cho:

```text
content/sign/*
content/sign/auto-click-helper.js
background/service-worker.js
```

### 17.1. Điều kiện bắt buộc trước khi ký

```text
user explicitly starts signing
patient context is known
tabId/windowId is stable
document type is recognized
current page is not PDF preview unless intended
stop button available
emergency stop listener active
session not expired
```

### 17.2. Auto-sign phải dừng khi

```text
người dùng chuyển tab
người dùng chuyển window
patient context thay đổi
logout VNPT HIS
SmartCA/eSeal modal unexpected state
quá số lần retry
không nhận dạng được nút
xuất hiện lỗi mạng
người dùng bấm stop
```

### 17.3. Test bắt buộc

```text
auto-sign stops when tab changes
auto-sign stops when window changes
auto-sign stops when patient context changes
auto-sign does not click unknown button
auto-sign does not continue after logout detection
```

---

## 18. Cache Policy

Áp dụng cho:

```text
content/cds/cds-cache.js
core/cache/*
```

### 18.1. Patient cache key

Không dùng mỗi `patientId`. Phải dùng composite key:

```text
patientId + encounterId + department + date/session
```

Hoặc nếu hiện có `benhnhanId_khambenhId`, tiếp tục giữ và test kỹ.

### 18.2. Không cache

```text
token
cookie
raw API header
API key
PIN
CryptoKey
unredacted PHI
```

### 18.3. Cache TTL

Đề xuất:

```text
patient clinical cache: clear on logout / patient switch / manual refresh
AI result cache: optional, only redacted data
rule data cache: versioned, content-hash
error log: 24h, redacted only
```

---

## 19. Logging và Audit

Tạo/chuẩn hóa:

```text
content/shared/safe-logger.js
content/shared/audit-log.js
```

### 19.1. Log không được chứa

```text
họ tên
số hồ sơ
mã bệnh nhân
BHYT
CCCD
số điện thoại
địa chỉ
raw prompt
raw AI response nếu có PHI
token/cookie/API key
```

### 19.2. Audit events

```js
export const AUDIT_EVENTS = {
  AI_REQUEST_SENT: 'ai_request_sent',
  AI_RESPONSE_RECEIVED: 'ai_response_received',
  WRITEBACK_ATTEMPTED: 'writeback_attempted',
  WRITEBACK_BLOCKED: 'writeback_blocked',
  WRITEBACK_SUCCESS: 'writeback_success',
  AUTO_SIGN_STARTED: 'auto_sign_started',
  AUTO_SIGN_STOPPED: 'auto_sign_stopped',
  EXPORT_REQUESTED: 'export_requested',
  EXPORT_CONFIRMED: 'export_confirmed',
  ENDPOINT_BLOCKED: 'endpoint_blocked',
  PHI_REDACTION_FAILED: 'phi_redaction_failed'
};
```

---

## 20. Test Strategy

Tạo file:

```text
docs/ALADINN_TEST_STRATEGY.md
```

### 20.1. Test commands

```bash
pnpm run lint
pnpm run test
pnpm run test:coverage
pnpm run build
```

### 20.2. Test phân tầng

| Tầng test | Mục tiêu |
|---|---|
| Unit test | Hàm nhỏ: redactor, guard, rule engine, allowlist |
| Integration test | AI pipeline, writeback guard, CDS pipeline |
| DOM fixture test | Đọc HIS DOM giả lập bằng jsdom |
| E2E-like test | Luồng auto-fill, auto-sign stop condition |
| Regression test | Lỗi từng xảy ra: lấy bệnh nhân A điền bệnh nhân B |

### 20.3. Test bắt buộc phải thêm

```text
tests/patient-context-guard.test.js
tests/writeback-guard.test.js
tests/phi-redactor.test.js
tests/endpoint-allowlist.test.js
tests/cds-cache.test.js
tests/llm-guard.test.js
tests/autofill-safety.test.js
tests/autosign-safety.test.js
```

### 20.4. Các test case cụ thể

#### Patient context

```text
- complete context passes
- missing patientId fails
- missing encounterId fails
- patientId mismatch fails
- encounterId mismatch fails
- fullNameHash mismatch fails
- stale context fails
- masked log does not expose raw identifiers
```

#### Writeback

```text
- blocks write when context changed
- blocks write when payload invalid
- logs blocked write with redacted context
- allows write when context same and payload valid
- does not call performWrite if guard fails
```

#### PHI redactor

```text
- redacts Vietnamese phone numbers
- redacts CCCD/CMND
- redacts BHYT patterns
- redacts patient code patterns
- redacts date of birth when configured
- does not over-redact clinical terms
- assertNoPHI throws if PHI remains
```

#### AI pipeline

```text
- refuses to send prompt if redaction fails
- refuses to parse non-JSON for auto-fill
- refuses schema-invalid response
- tracks token/cost without PHI
- uses model router
```

#### Auto-sign

```text
- stops on tab change
- stops on window change
- stops on logout
- stops on unknown modal state
- respects emergency stop
```

---

## 21. Coverage yêu cầu

Mục tiêu tối thiểu:

```text
Global coverage: >= 80%
High-risk modules: >= 90%
Patient context guard: 100% branch coverage
PHI redactor: >= 95%
Writeback guard: 100% critical branch coverage
```

Nếu không đạt ngay, tạo `docs/COVERAGE_GAP.md` ghi rõ:

```text
module
coverage hiện tại
rủi ro
test còn thiếu
kế hoạch bổ sung
```

---

## 22. Release Checklist

Tạo file:

```text
docs/ALADINN_RELEASE_CHECKLIST.md
```

Nội dung:

```md
# Aladinn Release Checklist

## Before release

- [ ] `pnpm run lint` pass
- [ ] `pnpm run test` pass
- [ ] `pnpm run test:coverage` pass
- [ ] `pnpm run build` pass
- [ ] Manifest permissions reviewed
- [ ] Host permissions reviewed
- [ ] No hardcoded secrets
- [ ] No raw PHI in logs
- [ ] No raw PHI in AI prompts
- [ ] Patient-context guard active for all writeback flows
- [ ] Auto-sign stop button tested
- [ ] Logout clears patient cache
- [ ] Endpoint allowlist tested
- [ ] Remote config/update URL validated
- [ ] CDS data version recorded
- [ ] Manual QA completed on test HIS account
- [ ] Changelog updated
- [ ] Version bumped consistently in package.json and manifest.json
```

---

## 23. Manual QA Checklist cho bác sĩ/người không biết code

Tạo:

```text
docs/ALADINN_MANUAL_QA_CHECKLIST.md
```

Nội dung:

```md
# Aladinn Manual QA Checklist

## 1. Kiểm tra mở extension

- [ ] Load extension không lỗi.
- [ ] Popup mở được.
- [ ] Options mở được.
- [ ] Không hiện lỗi console nghiêm trọng.

## 2. Kiểm tra bệnh nhân

- [ ] Mở bệnh nhân A, Aladinn đọc đúng thông tin.
- [ ] Chuyển sang bệnh nhân B, Aladinn cập nhật đúng.
- [ ] Không còn dữ liệu bệnh nhân A trên màn hình bệnh nhân B.
- [ ] Khi đổi bệnh nhân trong lúc chuẩn bị auto-fill, extension chặn ghi.

## 3. Kiểm tra AI

- [ ] Gửi AI không có họ tên/số hồ sơ trong payload.
- [ ] AI trả kết quả hiển thị được.
- [ ] AI response lỗi không làm extension crash.
- [ ] Chi phí token hiển thị hợp lý.

## 4. Kiểm tra auto-fill

- [ ] Có preview trước khi fill dữ liệu quan trọng.
- [ ] Fill đúng ô.
- [ ] Không fill nếu đổi bệnh nhân.
- [ ] Không fill nếu response thiếu field.

## 5. Kiểm tra CDS

- [ ] Tương tác thuốc hiển thị đúng.
- [ ] Chống chỉ định thuốc-bệnh hiển thị đúng.
- [ ] Trùng nhóm điều trị hiển thị đúng.
- [ ] Cảnh báo không che mất thao tác chính.
- [ ] Có nguồn/rule/version nếu có.

## 6. Kiểm tra auto-sign

- [ ] Chỉ chạy khi người dùng chủ động bật.
- [ ] Có nút dừng.
- [ ] Chuyển tab thì dừng.
- [ ] Chuyển bệnh nhân thì dừng.
- [ ] Logout thì dừng.

## 7. Kiểm tra bảo mật

- [ ] Không thấy họ tên/số hồ sơ trong logs.
- [ ] Không thấy API key trong console.
- [ ] Khóa/PIN hết hạn sau timeout.
- [ ] Export dữ liệu yêu cầu xác nhận.
```

---

## 24. Risk Register

Tạo:

```text
docs/ALADINN_RISK_REGISTER.md
```

Nội dung bảng:

```md
# Aladinn Risk Register

| ID | Rủi ro | Mức độ | Nguyên nhân | Guard/Test | Trạng thái |
|---|---|---:|---|---|---|
| R01 | Điền dữ liệu bệnh nhân A vào bệnh nhân B | Critical | Patient switch trong lúc AI xử lý | Patient-context guard + E2E test | Required |
| R02 | Gửi PHI lên Gemini | Critical | Redactor thiếu pattern | PHI redactor + assertNoPHI | Required |
| R03 | Auto-sign click sai nút | Critical | DOM thay đổi hoặc modal lạ | Recognized state machine + stop condition | Required |
| R04 | Cache leak giữa lượt khám | High | Key cache thiếu encounterId | Composite cache key test | Required |
| R05 | Endpoint độc hại | High | Remote config/baseUrl bị đổi | Endpoint allowlist | Required |
| R06 | Prompt injection | High | Text bệnh án chèn instruction | JSON escaping + role separation | Required |
| R07 | LLM hallucination auto-fill | High | Response không schema | JSON schema validation | Required |
| R08 | Extension xin quyền quá rộng | Medium | Manifest mở rộng host/permissions | Manifest review checklist | Required |
| R09 | Log lộ dữ liệu bệnh nhân | High | Logger ghi raw object | Safe logger + redaction test | Required |
| R10 | Build/release sai version | Medium | package/manifest lệch version | Release script/checklist | Required |
```

---

## 25. Git workflow

Tạo branch riêng:

```bash
git checkout -b hardening/ai-development-safety
```

Không commit thẳng vào main nếu không được yêu cầu.

Mỗi nhóm việc nên commit riêng:

```text
docs: add Aladinn architecture and AI coding rules
security: add patient context guard
security: add PHI redactor
test: add writeback guard regression tests
cds: harden patient cache key
ai: add model router and LLM response guard
release: add manual QA and release checklist
```

---

## 26. Trình tự làm việc bắt buộc

### Phase 0 — Baseline

1. Đọc `README.md`.
2. Đọc `package.json`.
3. Đọc `manifest.json`.
4. Liệt kê cấu trúc thư mục.
5. Chạy lint/test/build.
6. Tạo `docs/BASELINE_STATUS.md`.

Không sửa logic trong phase này, trừ khi cần sửa lỗi dependency để chạy được baseline.

---

### Phase 1 — Tạo tài liệu điều khiển AI

Tạo:

```text
AGENTS.md
.antigravity/instructions.md
.antigravity/safety-rules.md
.antigravity/task-template.md
.antigravity/review-checklist.md
docs/ALADINN_AI_CODING_RULES.md
docs/ALADINN_ARCHITECTURE.md
docs/ALADINN_SECURITY_POLICY.md
docs/ALADINN_TEST_STRATEGY.md
docs/ALADINN_RISK_REGISTER.md
```

Chưa refactor lớn.

---

### Phase 2 — Patient-context guard

1. Tìm tất cả nơi đọc bệnh nhân.
2. Tìm tất cả nơi ghi vào HIS.
3. Tạo module guard.
4. Thêm test.
5. Tích hợp guard vào auto-fill trước.
6. Sau đó mới tích hợp vào auto-sign.

Không làm auto-sign trước auto-fill.

---

### Phase 3 — PHI redactor và AI guard

1. Tìm tất cả nơi gọi Gemini.
2. Tạo redactor tập trung.
3. Tạo guard trước request AI.
4. Tạo schema validator cho response dùng để auto-fill.
5. Test không gửi PHI.
6. Test response lỗi không fill.

---

### Phase 4 — CDS và cache

1. Kiểm tra `content/cds/cds-cache.js`.
2. Đảm bảo composite key.
3. Đảm bảo clear cache khi logout.
4. Đảm bảo rule version.
5. Test DDI/drug-disease/missing diagnosis nếu có dataset.

---

### Phase 5 — Auto-sign hardening

1. Mô hình hóa auto-sign thành state machine.
2. Thêm stop conditions.
3. Thêm emergency stop.
4. Thêm tab/window/patient guard.
5. Test các stop condition.

---

### Phase 6 — Release gate

1. Tạo checklist.
2. Tạo script nếu phù hợp.
3. Đảm bảo version package/manifest đồng bộ.
4. Build extension.
5. Ghi release notes.

---

## 27. State machine cho auto-sign

Thiết kế đề xuất:

```text
IDLE
  ↓ user starts
PRECHECK
  ↓ context ok
READY
  ↓ click next/sign
SIGNING
  ↓ external modal
WAITING_SMARTCA
  ↓ success
VERIFY_RESULT
  ↓ next item
READY
  ↓ done
COMPLETED
```

Bất kỳ state nào gặp lỗi:

```text
ERROR_STOPPED
USER_STOPPED
CONTEXT_CHANGED_STOPPED
LOGOUT_STOPPED
UNKNOWN_MODAL_STOPPED
```

Không dùng vòng lặp click vô hạn.

---

## 28. UI/UX Safety

Khi blocked write:

Hiển thị thông báo rõ:

```text
Aladinn đã dừng thao tác để tránh ghi nhầm bệnh nhân.
Lý do: bệnh nhân/lượt khám đã thay đổi sau khi AI phân tích.
Vui lòng mở lại đúng bệnh nhân và thực hiện lại.
```

Khi blocked AI request:

```text
Aladinn không gửi dữ liệu lên AI vì phát hiện thông tin định danh chưa được khử.
Vui lòng kiểm tra lại nội dung.
```

Khi auto-sign stopped:

```text
Aladinn đã dừng ký tự động.
Lý do: tab/window/bệnh nhân thay đổi hoặc phiên HIS không còn ổn định.
```

---

## 29. Không được làm trong đợt này

Trừ khi người dùng yêu cầu riêng, không làm:

```text
- Không đổi toàn bộ giao diện.
- Không rewrite toàn bộ repo.
- Không chuyển sang framework mới.
- Không thêm backend server.
- Không thêm quyền Chrome mới nếu không cần.
- Không xoá module hiện có nếu chưa có thay thế + test.
- Không đổi branding.
- Không đổi flow người dùng đang quen.
- Không thêm tracking analytics ngoài bệnh viện.
- Không thêm cloud sync PHI.
```

---

## 30. Definition of Done

Một task chỉ được coi là xong nếu có:

```text
1. Code chạy được.
2. Lint pass.
3. Test pass.
4. Build pass.
5. Có test cho rủi ro chính.
6. Không mở rộng quyền không cần thiết.
7. Không lộ PHI trong log.
8. Không gửi PHI lên AI.
9. Không ghi HIS nếu patient-context guard fail.
10. Có mô tả file đã sửa.
11. Có mô tả rủi ro còn lại.
```

---

## 31. Prompt thực thi cho Antigravity

Khi bắt đầu làm, hãy dùng lệnh/prompt này trong Antigravity:

```md
Bạn hãy đọc toàn bộ file `ALADINN_ANTIGRAVITY_MASTER_PLAN.md` trước. Sau đó thực hiện theo từng phase.

Không được rewrite toàn bộ repo.
Không được sửa nhiều module cùng lúc nếu chưa có baseline.
Không được thay đổi hành vi auto-fill/auto-sign nếu chưa có test.
Không được gửi PHI lên LLM.
Không được bypass VNPT HIS.

Bắt đầu bằng Phase 0:
1. Đọc README.md, package.json, manifest.json.
2. Liệt kê cấu trúc repo.
3. Chạy lint/test/build.
4. Tạo docs/BASELINE_STATUS.md.
5. Báo cáo lại baseline trước khi bước sang Phase 1.

Sau đó thực hiện Phase 1:
Tạo các file tài liệu và AGENTS.md theo kế hoạch.

Chỉ sau khi Phase 1 hoàn tất mới bắt đầu Phase 2 patient-context guard.
```

---

## 32. Prompt cho từng task nhỏ

Dùng template này mỗi khi giao việc:

```md
## Task

[Điền tên task]

## Mục tiêu

[Điền mục tiêu cụ thể]

## Phạm vi được sửa

[Liệt kê file/thư mục được phép sửa]

## Phạm vi không được sửa

[Liệt kê file/thư mục không được đụng]

## Yêu cầu an toàn

- Không gửi PHI lên LLM.
- Không ghi HIS nếu patient-context guard fail.
- Không mở rộng permission.
- Không phá behavior hiện có.

## Test bắt buộc

- [Test 1]
- [Test 2]
- [Test 3]

## Done khi

- lint pass
- test pass
- build pass
- có mô tả rủi ro còn lại
```

---

## 33. Prompt riêng cho lỗi “lấy bệnh nhân A điền cho bệnh nhân B”

```md
Hãy xử lý lỗi nghiêm trọng: đôi khi Aladinn lấy thông tin bệnh nhân đầu tiên và điền cho bệnh nhân thứ hai.

Yêu cầu:

1. Tìm tất cả luồng auto-fill/writeback hiện có.
2. Xác định nơi capture patient context.
3. Tạo patient-context guard tập trung.
4. Trước khi phân tích AI: capture `beforeContext`.
5. Ngay trước khi ghi: capture `currentContext`.
6. So sánh patientId, encounterId, fullNameHash, tabId/windowId nếu có.
7. Nếu lệch: không ghi, hiển thị cảnh báo, audit log redacted.
8. Thêm regression test mô phỏng:
   - mở bệnh nhân A,
   - AI xử lý,
   - người dùng chuyển sang bệnh nhân B,
   - extension cố ghi,
   - kỳ vọng: performWrite không được gọi.
9. Không sửa UI lớn.
10. Không rewrite toàn bộ autofill.
11. Sau khi sửa, chạy lint/test/build.
```

---

## 34. Prompt riêng cho bảo mật Gemini/API key

```md
Hãy rà soát toàn bộ luồng gọi Gemini/API key.

Yêu cầu:

1. Tìm tất cả nơi đọc/lưu/gửi API key.
2. Đảm bảo content script không giữ raw key lâu hơn cần thiết.
3. Đảm bảo CryptoKey không extractable.
4. Đảm bảo không log API key.
5. Đảm bảo endpoint allowlist chặn domain không hợp lệ.
6. Đảm bảo prompt gửi Gemini đã redacted PHI.
7. Đảm bảo AI response dùng để auto-fill phải validate schema.
8. Thêm test:
   - blocked non-allowlisted endpoint,
   - redaction before AI call,
   - malformed AI JSON blocks autofill,
   - missing API key throws safe error.
9. Không thay đổi provider nếu không được yêu cầu.
```

---

## 35. Prompt riêng cho CDS

```md
Hãy rà soát và nâng cấp Clinical Decision Support của Aladinn.

Yêu cầu:

1. Không dùng LLM làm nguồn quyết định chính.
2. Chuẩn hóa rule schema.
3. Chuẩn hóa severity: critical/major/moderate/minor/info.
4. Thêm rule version/source.
5. Đảm bảo cache dùng composite patient key.
6. Đảm bảo clear cache khi logout/patient switch.
7. Thêm test cho:
   - drug-drug interaction,
   - drug-disease contraindication,
   - duplicate therapy,
   - missing diagnosis,
   - abnormal lab + drug rule,
   - no cross-patient cache leak.
8. Không tạo cảnh báo quá mức nếu thiếu dữ liệu.
9. Nếu rule thiếu nguồn hoặc confidence thấp, hiển thị mức không chắc chắn.
```

---

## 36. Prompt riêng cho release

```md
Hãy chuẩn bị release hardening cho Aladinn.

Yêu cầu:

1. Chạy lint/test/coverage/build.
2. Kiểm tra version trong package.json và manifest.json có đồng bộ không.
3. Kiểm tra manifest permissions.
4. Kiểm tra host_permissions.
5. Kiểm tra không có hardcoded secrets.
6. Kiểm tra không có raw PHI trong logs.
7. Kiểm tra endpoint allowlist.
8. Kiểm tra patient-context guard đã áp dụng cho mọi writeback flow.
9. Tạo docs/RELEASE_NOTES_NEXT.md.
10. Tạo checklist manual QA.
11. Không publish release thật nếu chưa được người dùng yêu cầu.
```

---

## 37. Báo cáo cuối cùng Antigravity phải trả về

Sau khi làm xong mỗi phase, báo cáo theo mẫu:

```md
# Phase Report

## Phase
[Phase number/name]

## Files changed

- file 1
- file 2

## What changed

[Mô tả ngắn gọn]

## Safety improvements

[Mô tả cải thiện an toàn]

## Tests added/updated

- test 1
- test 2

## Commands run

```bash
pnpm run lint
pnpm run test
pnpm run build
```

## Results

- lint: pass/fail
- test: pass/fail
- build: pass/fail

## Remaining risks

- risk 1
- risk 2

## Next recommended step

[Đề xuất bước tiếp theo]

```

---

## 38. Ưu tiên thực hiện nếu thời gian hạn chế

Nếu không đủ thời gian làm tất cả, ưu tiên theo thứ tự:

1. `AGENTS.md`
2. `docs/ALADINN_AI_CODING_RULES.md`
3. `docs/ALADINN_SECURITY_POLICY.md`
4. `docs/ALADINN_TEST_STRATEGY.md`
5. Patient-context guard
6. Regression test lỗi bệnh nhân A/B
7. PHI redactor test
8. Endpoint allowlist test
9. Auto-sign stop condition
10. Release checklist

Không ưu tiên UI đẹp trước an toàn.

---

## 39. Checklist review code sau khi Antigravity sửa

Người dùng hoặc reviewer kiểm tra:

```text
- Có file AGENTS.md chưa?
- Có docs safety/test/risk chưa?
- Có patient-context guard chưa?
- Auto-fill có gọi guard chưa?
- Auto-sign có gọi guard chưa?
- Có test bệnh nhân A/B chưa?
- Có PHI redactor test chưa?
- Có endpoint allowlist test chưa?
- Lint/test/build có pass không?
- manifest.json có bị thêm quyền lạ không?
- Có raw PHI trong logger không?
- Có raw API key trong code không?
```

---

## 40. Ghi chú quan trọng cho Antigravity

Dự án này liên quan workflow y tế. Lỗi phần mềm có thể gây ghi nhầm dữ liệu bệnh nhân, ký nhầm, hoặc lộ thông tin bệnh nhân. Vì vậy:

```text
Correctness > speed
Safety > convenience
Deterministic guard > LLM guess
Test > manual belief
Minimal permission > broad permission
Redacted logging > easy debugging
Fail closed > silent failure
```

Không được đánh đổi các nguyên tắc trên để “hoàn thành nhanh”.

---

## END OF FILE
