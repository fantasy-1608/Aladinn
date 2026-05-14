# ĐỀ XUẤT SỬA LỖI SCANNER/FILL ĐIỀN NHẦM BỆNH ÁN — ALADINN HIS VNPT

## 1. Mô tả lỗi

Lỗi: module Scanner/Fill đôi khi lấy dữ liệu của bệnh nhân đầu tiên và điền vào form bệnh án của bệnh nhân thứ hai.

Đặc điểm:

- Không xảy ra thường xuyên.
- Khó phát hiện nếu không đọc lại.
- Thường xuất hiện khi chuyển bệnh nhân nhanh, form/iframe chưa reload xong, hoặc API trả về chậm.
- Đây là lỗi nguy cơ cao vì tạo sai lệch hồ sơ bệnh án.

## 2. Chẩn đoán kỹ thuật khả dĩ

Đây là lỗi thuộc nhóm:

```text
race condition + stale cache + context contamination
```

Các nguồn gây lỗi chính trong code hiện tại:

### 2.1. `selectedPatientId` không đủ an toàn làm nguồn sự thật

Một số flow lấy bệnh nhân hiện tại bằng:

```js
const pid = window.VNPTStore?.get('selectedPatientId');
```

Nhưng khi người dùng chuyển bệnh nhân nhanh:

- `selectedPatientId` có thể đã đổi sang bệnh nhân B,
- request trước đó của bệnh nhân A vẫn đang chạy,
- khi request A trả về muộn, flow điền vẫn tiếp tục nếu không kiểm tra lại context.

### 2.2. `patientDemographics` đang lưu dạng global, không khóa theo bệnh nhân

Trong `row-observer.js` hiện có logic:

```js
window.VNPTStore?.set('patientDemographics', res.demographics);
```

Đây là điểm nguy hiểm.

Nếu prefetch demographics của bệnh nhân A trả về sau khi đã chọn bệnh nhân B, nó sẽ ghi đè global `patientDemographics`, khiến module khác đọc nhầm.

Cần đổi sang:

```js
patientDemographicsMap[patientContextKey] = demographics
```

và chỉ đọc lại bằng đúng context key.

### 2.3. `currentFormIframe` có thể là iframe cũ

Các module fill như `clinical-fill.js`, `history.js`, `nutrition.js` thường giữ biến:

```js
let currentFormIframe = null;
```

Nếu HIS reload iframe hoặc chuyển tab/form, biến này có thể vẫn trỏ vào iframe cũ hoặc iframe chưa đồng bộ với bệnh nhân mới.

### 2.4. Cache fallback còn nguy hiểm

Một số flow có fallback:

```js
const cachedHistory = window.VNPTStore?.get('medicalHistoryMap')?.[pid];
```

Nếu `pid` không đủ đặc hiệu, hoặc pid là row id ngoại trú không ổn định, cache có thể trả nhầm.

### 2.5. `api-bridge.resolveActiveGrid(rowId)` còn fallback về `selrow`

Trong `api-bridge.js`, nếu rowId không resolve chắc chắn, bridge fallback sang selected row hiện tại.

Trong tình huống request cũ của bệnh nhân A nhưng UI đã chọn bệnh nhân B:

- request A gửi rowId A,
- nếu resolve A thất bại,
- bridge fallback sang `selrow` hiện tại là B,
- kết quả trả về có thể bị trộn context.

Với chức năng fill bệnh án, không nên cho fallback mơ hồ.

---

## 3. Nguyên tắc sửa

### 3.1. Không fill nếu không xác minh lại bệnh nhân ngay trước khi ghi form

Trước khi gọi helper điền vào iframe, bắt buộc kiểm tra:

```text
Bệnh nhân lúc bắt đầu lấy dữ liệu
= Bệnh nhân lúc preview
= Bệnh nhân lúc bấm xác nhận
= Bệnh nhân đang hiển thị trên form/iframe
= Bệnh nhân của dữ liệu API trả về
```

Nếu không khớp → dừng, không điền.

### 3.2. Mọi request/fill phải có `PatientContextToken`

Không dùng `selectedPatientId` đơn độc.

Context tối thiểu:

```js
{
  contextId: "uuid",
  createdAt: Date.now(),
  rowId: "...",
  khambenhId: "...",
  hosobenhanId: "...",
  benhnhanId: "...",
  tiepnhanId: "...",
  patientNameHash: "...",
  formIframeId: "...",
  formUrl: "...",
  formType: "history | clinical | nutrition | emergency | hoichan | chuyenvien"
}
```

### 3.3. Fail-closed

Nếu không xác minh được context → không điền.

Không được fallback sang “bệnh nhân đang chọn hiện tại” trong flow fill bệnh án.

---

## 4. Bản vá kiến trúc đề xuất

## 4.1. Tạo module mới: `content/scanner/patient-context-guard.js`

### Nhiệm vụ

- Chụp context bệnh nhân tại thời điểm user bấm “Điền”.
- Gắn context đó vào toàn bộ request.
- Trước khi fill, xác minh context còn khớp.
- Hủy các transaction cũ khi bệnh nhân thay đổi.

### API đề xuất

```js
window.VNPTPatientContextGuard = {
  capture(formIframe, formType),
  validate(token, options),
  assertValidOrThrow(token, options),
  invalidateAll(reason),
  getCurrentContext(),
  hashIdentity(identity)
};
```

### Token mẫu

```js
{
  tokenId: crypto.randomUUID(),
  createdAt: Date.now(),
  expiresAt: Date.now() + 120000,

  rowId: "123456",
  khambenhId: "KB...",
  hosobenhanId: "HSBA...",
  benhnhanId: "BN...",
  tiepnhanId: "TN...",

  patientNameHash: "sha256(...)",
  formType: "history",
  iframeFingerprint: "sha256(src|name|id|title)",
  formUrlPath: "/vnpthis/...",
  initialSelectedPatientId: "123456",

  state: "active"
}
```

---

## 4.2. Store phải đổi từ global demographics sang map theo context

### Hiện tại nguy hiểm

```js
patientDemographics: {...}
```

### Đề xuất

Trong `content/scanner/store.js`, thêm:

```js
patientDemographicsMap: {},
activePatientContext: null,
activeFillTransaction: null
```

Không lưu `patientDemographics` global nữa, hoặc giữ legacy nhưng không dùng cho fill.

### Action mới

```js
actions.updatePatientDemographics(patientKey, demographics) {
  setState({
    patientDemographicsMap: {
      ...state.patientDemographicsMap,
      [patientKey]: {
        data: demographics,
        timestamp: Date.now()
      }
    }
  });
}
```

---

## 4.3. Sửa `row-observer.js`

### Vấn đề

Hiện prefetch ghi:

```js
window.VNPTStore?.set('patientDemographics', res.demographics);
```

### Sửa

```js
const token = window.VNPTPatientContextGuard?.captureGridOnly(pid);

window.VNPTMessaging.sendRequest('REQ_FETCH_PATIENT_DEMOGRAPHICS', {
  rowId: pid,
  contextToken: token
}, 5000).then((res) => {
  if (!window.VNPTPatientContextGuard?.validate(token, { allowGridOnly: true })) {
    console.warn('[Aladinn] Drop stale demographics result', pid);
    return;
  }

  const patientKey = window.VNPTPatientContextGuard.hashIdentity({
    rowId: pid,
    khambenhId: res?.context?.KHAMBENHID,
    hosobenhanId: res?.context?.HOSOBENHANID,
    benhnhanId: res?.context?.BENHNHANID
  });

  window.VNPTStore?.actions?.updatePatientDemographics(patientKey, res.demographics);
});
```

### Khi chọn bệnh nhân mới

Phải hủy mọi transaction fill đang chờ:

```js
window.VNPTPatientContextGuard?.invalidateAll('PATIENT_CHANGED');
```

Nhưng lưu ý: chỉ hủy transaction chưa xác nhận; không nên phá flow user đang chủ động fill nếu chính bệnh nhân đó vẫn còn khớp.

---

## 4.4. Sửa các module fill: `history.js`, `clinical-fill.js`, `nutrition.js`, `emergency.js`

### Flow mới bắt buộc

```js
async function doFillForm(iframe) {
  const target = iframe || currentFormIframe;
  if (!target) return;

  const token = await VNPTPatientContextGuard.capture(target, 'history');

  await VNPTPatientContextGuard.assertValidOrThrow(token, {
    stage: 'before-fetch'
  });

  const pid = token.rowId;

  const history = await fetchHistoryForPatient(pid, { contextToken: token });

  await VNPTPatientContextGuard.assertValidOrThrow(token, {
    stage: 'after-fetch',
    responseContext: history?._context
  });

  const formData = buildFormData(history);

  const confirmed = await showPreviewDialog(formData, {
    contextToken: token,
    patientLabel: token.safeDisplayLabel
  });

  if (!confirmed) return;

  await VNPTPatientContextGuard.assertValidOrThrow(token, {
    stage: 'before-fill'
  });

  await sendCmd(target, 'HISTORY_FILL_FORM', {
    mapping,
    historyData: formData,
    contextToken: token
  }, 'HISTORY_FILL_RESULT');

  await VNPTPatientContextGuard.assertValidOrThrow(token, {
    stage: 'after-fill'
  });
}
```

### Quy tắc

- Không dùng lại `pid` lấy từ store sau khi await.
- Không lấy `currentFormIframe` lại sau khi await.
- Không fill nếu token đã invalid.
- Không fill nếu iframe fingerprint thay đổi.
- Không fill nếu patient context thay đổi.

---

## 4.5. Sửa `api-bridge.js`: thêm strict context mode

### Vấn đề

`resolveActiveGrid(rowId)` hiện có fallback sang selected row.

Với fill bệnh án, cần strict.

### Đề xuất

Thêm tham số:

```js
function resolveActiveGrid(rowId, options = { strict: false }) {
  ...
}
```

Trong strict mode:

```js
if (options.strict && rowId) {
  const rdIn = tryGrid(inGrid, rowId);
  if (rdIn) return {...};

  const rdOut = tryResolveOutpatientByKhambenhId(outGrid, rowId);
  if (rdOut) return {...};

  return EMPTY; // Không fallback sang selrow
}
```

Các request dùng cho fill bệnh án phải gọi strict:

```js
const { rowData } = resolveActiveGrid(rowId, { strict: true });
```

Áp dụng cho:

- `REQ_FETCH_HISTORY`
- `REQ_FETCH_VITALS`
- `REQ_FETCH_PATIENT_DEMOGRAPHICS`
- `REQ_FETCH_CLINICAL_SUMMARY`
- các request dùng để điền phiếu

Không áp dụng strict cho scan toàn khoa nếu cần linh hoạt.

---

## 4.6. Response API phải trả về context kèm theo

Ví dụ `fetchHistory`:

```js
sendResult('FETCH_HISTORY_RESULT', rowId, {
  history: historyData,
  _context: {
    rowId,
    KHAMBENHID: rowData.KHAMBENHID || '',
    HOSOBENHANID: rowData.HOSOBENHANID || rowData.HSBAID || '',
    BENHNHANID: rowData.BENHNHANID || '',
    patientName: rowData.TENBENHNHAN || rowData.HOTEN || ''
  }
}, requestId);
```

Client phải kiểm tra `_context` trước khi dùng.

---

## 4.7. Helper trong iframe cũng phải xác minh context trước khi fill

Các helper như:

- `history-iframe-helper.js`
- `emergency-iframe-helper.js`
- `hoichan-iframe-helper.js`
- `chuyenvien-iframe-helper.js`
- `nutrition-iframe-helper.js`

Phải nhận `contextToken`.

Trước khi điền:

```js
if (!payload.contextToken) {
  sendResponse(false, 0, 'MISSING_CONTEXT_TOKEN');
  return;
}

const visiblePatientText = readPatientNameFromForm();
const visibleRecordId = readRecordIdFromForm();

if (!contextMatches(payload.contextToken, visiblePatientText, visibleRecordId)) {
  sendResponse(false, 0, 'FORM_CONTEXT_MISMATCH');
  return;
}
```

Nếu không đọc được patient/record từ form:

- Không fill tự động.
- Báo user: “Không xác minh được form thuộc bệnh nhân đang chọn.”

---

## 5. Preview dialog phải hiển thị cảnh báo context

Trước khi user bấm “Điền vào form”, preview cần hiển thị:

```text
Đang chuẩn bị điền cho:
- Bệnh nhân: [Tên viết tắt hoặc hash/4 ký tự cuối mã]
- Mã khám/Mã bệnh án: ****1234
- Form: Bệnh án/Hội chẩn/Chuyển viện
- Dữ liệu lấy lúc: HH:mm:ss

Cảnh báo: Nếu bạn đã chuyển bệnh nhân sau khi mở hộp thoại này, Aladinn sẽ tự dừng.
```

Nút xác nhận:

```text
Tôi đã kiểm tra đúng bệnh nhân — Điền vào form
```

Không dùng nút quá chung chung như “Điền vào form”.

---

## 6. Không dùng cache cho fill nếu chưa verify context

### Quy tắc cache mới

Cache chỉ được dùng nếu:

```text
cache.patientKey === token.patientKey
AND cache.contextVersion === token.contextVersion
AND cache.timestamp < 2 phút
AND current context vẫn khớp
```

Nếu API thất bại:

- Không tự động dùng cache cũ để điền bệnh án.
- Chỉ cho phép hiển thị preview với cảnh báo “Dữ liệu cache”, và bắt buộc user xác nhận thêm.

Khuyến nghị với bệnh án:

- API fail → dừng.
- Không fill từ cache, trừ khi bật debug/manual mode.

---

## 7. AbortController / hủy request cũ

Mỗi module fill cần giữ controller:

```js
let activeFillAbortController = null;
```

Khi chọn bệnh nhân mới:

```js
activeFillAbortController?.abort('PATIENT_CHANGED');
```

Khi bắt đầu fill mới:

```js
activeFillAbortController?.abort('NEW_FILL_STARTED');
activeFillAbortController = new AbortController();
```

Dù `postMessage`/XHR cũ không abort được hoàn toàn, response cũ vẫn phải bị drop nếu token không còn active.

---

## 8. Audit log lỗi gần nhầm

Cần ghi log không chứa PHI:

```js
{
  eventType: 'FILL_BLOCKED_CONTEXT_MISMATCH',
  stage: 'before-fill',
  reasonCode: 'PATIENT_CHANGED_DURING_FETCH',
  originalPatientHash: '...',
  currentPatientHash: '...',
  formType: 'history',
  elapsedMs: 3200,
  module: 'scanner-fill'
}
```

Reason codes:

```js
PATIENT_CHANGED_DURING_FETCH
FORM_IFRAME_CHANGED
API_RESPONSE_CONTEXT_MISMATCH
CACHE_CONTEXT_MISMATCH
MISSING_CONTEXT_TOKEN
FORM_CONTEXT_MISMATCH
STALE_PREFETCH_RESULT_DROPPED
STRICT_ROW_RESOLVE_FAILED
```

---

## 9. Test bắt buộc

### 9.1. Race condition test

Mô phỏng:

```text
1. Chọn BN A.
2. Bấm điền.
3. API A delay 3000ms.
4. Sau 500ms chọn BN B.
5. API A trả về.
6. Kỳ vọng: không điền vào form B.
```

### 9.2. Stale demographics test

```text
1. Prefetch BN A delay.
2. Chọn BN B.
3. Prefetch A trả về muộn.
4. Kỳ vọng: không ghi vào patientDemographics global; result A bị drop.
```

### 9.3. Iframe changed test

```text
1. Capture iframe bệnh án A.
2. HIS reload iframe.
3. Token iframe fingerprint không khớp.
4. Kỳ vọng: block fill.
```

### 9.4. Cache mismatch test

```text
1. Cache có historyMap[A].
2. Current token là B.
3. API fail.
4. Kỳ vọng: không dùng cache A.
```

### 9.5. Strict bridge test

```text
1. Gửi REQ_FETCH_HISTORY rowId A.
2. Grid hiện tại chọn B.
3. A không resolve được strict.
4. Kỳ vọng: trả error STRICT_ROW_RESOLVE_FAILED, không fallback sang B.
```

---

## 10. Acceptance Criteria

Bản sửa đạt khi:

1. Chuyển bệnh nhân trong lúc fetch → không fill.
2. API trả về muộn → response bị drop.
3. Prefetch demographics cũ → không ghi đè dữ liệu bệnh nhân hiện tại.
4. Form iframe thay đổi → không fill.
5. Không verify được bệnh nhân trên form → không fill.
6. API fail → không tự động dùng cache để fill bệnh án.
7. Preview hiển thị định danh bệnh nhân cần điền.
8. Trước khi fill có kiểm tra lại context lần cuối.
9. Có log các lần bị block do mismatch.
10. Test race condition pass.

---

## 11. Prompt triển khai cho Antigravity

Bạn là senior Chrome Extension engineer trong môi trường HIS bệnh viện. Hãy sửa lỗi module Scanner/Fill của Aladinn đôi khi lấy dữ liệu bệnh nhân A và điền vào form bệnh án của bệnh nhân B.

### Yêu cầu

Giữ nguyên tính năng cốt lõi, nhưng thêm lớp Patient Context Guard để chống race condition/stale cache/context contamination.

### Tạo file mới

- `content/scanner/patient-context-guard.js`
- `content/scanner/fill-transaction.js` nếu cần tách transaction
- `tests/scanner-context-guard.test.js`
- `tests/scanner-fill-race.test.js`

### Sửa file

- `content/scanner/store.js`
- `content/scanner/row-observer.js`
- `content/scanner/history.js`
- `content/scanner/clinical-fill.js`
- `content/scanner/nutrition.js`
- `content/scanner/emergency.js`
- `content/scanner/*-iframe-helper.js`
- `content/scanner/messaging.js`
- `injected/api-bridge.js`

### Bắt buộc

1. Thêm PatientContextToken cho mọi flow fill.
2. Không dùng `selectedPatientId` đơn độc sau bất kỳ `await` nào.
3. Không dùng `patientDemographics` global cho fill.
4. Đổi sang `patientDemographicsMap[patientKey]`.
5. Hủy/drop response cũ nếu bệnh nhân đã đổi.
6. Trước khi fill phải validate lại token.
7. Helper trong iframe phải nhận và kiểm tra context token.
8. `api-bridge.resolveActiveGrid()` phải có strict mode, không fallback sang selected row khi dùng cho fill bệnh án.
9. Không tự động dùng cache để fill nếu API fail và context không verify được.
10. Preview phải hiển thị bệnh nhân/form/mã khám hoặc mã bệnh án dạng che bớt.
11. Thêm audit log cho các trường hợp block do mismatch.
12. Thêm test mô phỏng API A trả về muộn sau khi đã chọn BN B.

### Không được làm

- Không thay đổi CDS/AI core.
- Không gửi thêm dữ liệu bệnh nhân ra ngoài.
- Không làm mất chức năng preview/fill hiện tại.
- Không im lặng fill khi context không chắc chắn.
- Không fallback sang bệnh nhân đang chọn nếu request ban đầu có rowId khác.

### Kết quả cần giao

- Code hoàn chỉnh.
- Test pass.
- Mô tả các nơi đã thêm context guard.
- Mô tả cách test lỗi race condition thủ công trên HIS.
