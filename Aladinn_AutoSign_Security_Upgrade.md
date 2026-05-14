# BẢN NÂNG CẤP TOÀN DIỆN MODULE AUTO-SIGN — ALADINN HIS VNPT

## 0. Mục tiêu

Nâng cấp module Auto-sign để giữ nguyên tính năng cốt lõi:

- Chọn danh sách bệnh nhân/phiếu cần ký.
- Mở màn hình ký số HIS VNPT.
- Lọc phiếu theo người tạo/trạng thái chưa ký.
- Hỗ trợ tự động bấm các bước phụ như “Xác nhận”, “Đồng ý” sau khi người dùng đã chủ động bắt đầu phiên ký.
- Chuyển bệnh nhân/phiếu kế tiếp.
- Có khả năng dừng phiên ký.

Nhưng phải khắc phục các điểm yếu bảo mật/vận hành:

- Tránh auto-click ngoài ngữ cảnh ký.
- Tránh ký nhầm bệnh nhân/phiếu/người ký.
- Tránh bị HIS đổi giao diện làm click sai.
- Không fail-open khi remote config lỗi.
- Có session lock, timeout, audit log, rollback, kill switch.
- Có kiểm thử hồi quy cho mọi logic nguy cơ cao.

---

## 1. Nguyên tắc thiết kế

### 1.1. Auto-sign không được là “auto-click toàn cục”

Module hiện có `auto-click-helper.js` chạy trong tất cả frame trên `vncare.vn` và tự tìm `#btnConfirm`, `#alertify-ok`.

Cần chuyển sang mô hình:

```text
User chủ động bắt đầu phiên ký
        ↓
Tạo Secure Signing Session
        ↓
Xác minh đúng trang + đúng bệnh nhân + đúng phiếu + đúng người ký
        ↓
Cho phép auto-click trong phạm vi session
        ↓
Tự động hết hạn hoặc bị kill khi có bất thường
```

### 1.2. Mặc định an toàn

Các trạng thái nguy cơ cao phải **fail-closed**:

| Tình huống | Hành vi mới |
|---|---|
| Không tải được remote config | Tắt auto-sign, chỉ cho ký thủ công |
| Không xác định được bệnh nhân hiện tại | Dừng |
| Không xác định được phiếu đang ký | Dừng |
| Không xác định được người ký | Dừng |
| Có nhiều lựa chọn chứng thư/người ký | Dừng và yêu cầu người dùng tự chọn |
| HIS DOM thay đổi ngoài mẫu đã biết | Dừng |
| Mất focus tab hoặc tab bị chuyển bất thường | Pause |
| Quá thời gian session | Stop |

### 1.3. Không thay đổi tính năng cốt lõi

Không bỏ tính năng:

- Ký hàng loạt.
- Tự động xác nhận hộp thoại phụ.
- Tự đóng/tiếp tục sau khi ký thành công.
- Ký nâng cao theo danh sách phiếu.
- Lọc theo người tạo.

Nhưng mọi bước tự động phải nằm trong **session hợp lệ**.

---

## 2. Kiến trúc mới đề xuất

```text
content/sign/
├── signing.js                  # workflow ký hiện tại, giữ vai trò orchestrator
├── advanced-sign.js            # logic ký nâng cao, giữ nguyên API chính
├── auto-click-helper.js        # giảm quyền: chỉ click khi có session token hợp lệ
├── sign-session-guard.js       # MỚI: tạo/kiểm tra Secure Signing Session
├── sign-context.js             # MỚI: xác định bệnh nhân/phiếu/người ký/trang hiện tại
├── sign-policy.js              # MỚI: policy từ local + remote config
├── sign-audit.js               # MỚI: audit log tối thiểu, không chứa PHI đầy đủ
├── sign-safeclick.js           # MỚI: click an toàn theo selector registry
├── sign-risk-engine.js         # MỚI: đánh giá rủi ro trước mỗi click
├── sign-tests/
│   ├── session-guard.test.js
│   ├── safeclick.test.js
│   ├── context-match.test.js
│   ├── policy-failclosed.test.js
│   └── audit.test.js
```

---

## 3. Những thay đổi bắt buộc

## 3.1. Thêm Secure Signing Session

### Vấn đề hiện tại

Trong `signing.js`, trạng thái hiện tại chủ yếu dựa vào:

```js
WORKFLOW.isActive
window.__aladinnSigningActive
AUTO_SIGN.isEnabled
```

Các cờ này dễ bị nhầm ngữ cảnh, không có token phiên, không có khóa theo bệnh nhân/phiếu, không có TTL rõ ràng.

### Nâng cấp

Tạo file mới:

```text
content/sign/sign-session-guard.js
```

### Interface bắt buộc

```js
window.Aladinn.Sign.SessionGuard = {
  startSession(context),
  stopSession(reason),
  pauseSession(reason),
  resumeSession(),
  getSession(),
  isSessionValid(),
  assertCanAutoClick(actionContext),
  rotateStepNonce(),
  markStepCompleted(step),
};
```

### Session object

```js
{
  sessionId: "uuid",
  stepNonce: "random-128-bit",
  startedAt: 1710000000000,
  expiresAt: 1710000600000,
  lastActionAt: 1710000000000,

  mode: "normal-sign" | "advanced-sign",
  userInitiated: true,

  tabId: null,
  windowId: null,

  patient: {
    rowId: "...",
    patientHash: "sha256(patientName|maba|hosobenhanid)",
    mabenhanLast4: "1234"
  },

  signer: {
    expectedName: "BS ...",
    signerHash: "sha256(expectedName)"
  },

  queue: [
    {
      docIdHash: "sha256(...)",
      sophieuLast4: "1234",
      tenphieu: "Tờ điều trị",
      creatorHash: "sha256(...)",
      status: "pending"
    }
  ],

  permissions: {
    allowConfirmClick: true,
    allowOkClick: true,
    allowClosePdfTab: true,
    allowAutoNext: true
  },

  risk: {
    maxRisk: "medium",
    requireManualWhenAmbiguous: true
  }
}
```

### Quy tắc

- `startSession()` chỉ được gọi từ click trực tiếp của user trên UI Aladinn.
- Không cho script khác tự bật session nếu không có user gesture.
- Session hết hạn sau 10 phút hoặc sau 2 phút không có hành động.
- Mỗi lần click tự động phải kiểm tra `sessionId + stepNonce`.
- Sau mỗi bước click, rotate `stepNonce`.

---

## 3.2. Auto-click helper phải chuyển từ fail-open sang fail-closed

### Vấn đề hiện tại

Trong `auto-click-helper.js`:

```js
let remoteAutoSignEnabled = true; // Remote Kill Switch — default ON (fail-open)
```

Đây là rủi ro cao. Nếu config lỗi hoặc chưa tải được, auto-sign vẫn bật.

### Sửa bắt buộc

Đổi thành:

```js
let remoteAutoSignEnabled = false; // fail-closed
let remoteConfigLoaded = false;
```

Logic mới:

```js
if (!remoteConfigLoaded) return;
if (!remoteAutoSignEnabled) return;
if (!SessionGuard.isSessionValid()) return;
```

### Chính sách

| Config state | Auto-sign |
|---|---|
| Config tải thành công và `autoSign === true` | Cho phép |
| Config tải thành công và `autoSign === false` | Tắt |
| Config chưa tải | Tắt |
| Config lỗi/malformed | Tắt |
| Config quá hạn TTL | Tắt |

---

## 3.3. Không tìm nút theo text rộng trên toàn document

### Vấn đề hiện tại

Trong `signing.js` có logic:

```js
_findBtnByText(['Xác nhận', 'Chấp nhận'])
_findBtnByText(['Đồng ý', 'Hoàn tất'])
```

Logic này có nguy cơ click nhầm nếu có nhiều nút giống text.

### Nâng cấp

Tạo file:

```text
content/sign/sign-safeclick.js
```

### Quy tắc SafeClick

Một nút chỉ được click nếu đạt đủ điều kiện:

1. Nằm trong container đã xác định là modal ký số.
2. Có selector ưu tiên khớp registry.
3. Text khớp nhưng phải kèm context xung quanh.
4. Nút hiển thị thật sự.
5. Không disabled.
6. Không nằm trong modal lỗi/cảnh báo bất thường.
7. Không có nhiều candidate cùng cấp.
8. Risk score không vượt ngưỡng.

### Selector registry

```js
const SIGN_SELECTOR_REGISTRY = {
  smartCAConfirm: {
    primary: ['#btnConfirm'],
    containers: [
      '.smartca-modal',
      '.esign-dialog',
      'body'
    ],
    allowedTexts: ['Xác nhận', 'Chấp nhận'],
    forbiddenTexts: ['Hủy', 'Đóng', 'Thoát', 'Xóa', 'Không'],
    maxCandidates: 1
  },

  hisSuccessOk: {
    primary: ['#alertify-ok', '.alertify-button-ok'],
    containers: [
      '.alertify',
      '.alertify-dialog',
      '.alertify-logs'
    ],
    allowedTexts: ['Đồng ý', 'OK', 'Hoàn tất'],
    forbiddenTexts: ['Hủy', 'Không', 'Xóa'],
    maxCandidates: 1
  }
};
```

### SafeClick API

```js
window.Aladinn.Sign.SafeClick = {
  findButton(targetName, context),
  click(targetName, context),
  explainLastFailure()
};
```

### Không được

Không click nút nếu:

- Có 2 nút “Xác nhận”.
- Không biết nút nằm trong modal nào.
- Nút nằm trong modal có chữ “lỗi”, “thất bại”, “không hợp lệ”, “hết hạn”, “sai mã PIN”.
- Có select chưa chọn.
- Có nhiều chứng thư số.
- Có SmartCA mismatch.

---

## 3.4. Thêm Context Verification trước mỗi click

Tạo file:

```text
content/sign/sign-context.js
```

### Context cần xác minh

Trước khi bấm `Xác nhận`:

```js
{
  pageType: "HIS_SIGN_DIALOG" | "SMARTCA_CONFIRM" | "HIS_SUCCESS_DIALOG",
  patientHash,
  docIdHash,
  signerHash,
  creatorHash,
  visiblePatientName,
  visibleDocumentName,
  visibleSignerName,
  hasAmbiguousSignerSelect,
  hasUnselectedSignerSelect,
  hasErrorText,
  candidateButtons
}
```

### Điều kiện được click `Xác nhận`

Chỉ click nếu:

```text
session hợp lệ
AND đúng patientHash hoặc không có patient text nhưng docId khớp
AND đúng signerHash hoặc không có signer text nhưng không có mismatch
AND không có select chưa chọn
AND không có nhiều select khả dụng
AND chỉ có 1 candidate nút xác nhận
AND không có error text
AND tab đang visible/focused hoặc policy cho phép background
```

### Điều kiện được click `Đồng ý`

Chỉ click nếu:

```text
session hợp lệ
AND vừa có bước confirm trong session này
AND dialog là success/info, không phải error
AND text không chứa “thất bại”, “lỗi”, “không thành công”
AND chỉ có 1 nút OK hợp lệ
```

---

## 3.5. Thêm Risk Engine

Tạo file:

```text
content/sign/sign-risk-engine.js
```

### Risk score

```js
const RISK = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  CRITICAL: 3
};
```

### Ví dụ đánh giá

| Điều kiện | Risk |
|---|---|
| Đúng session, đúng button id, không ambiguity | LOW |
| Không đọc được tên bệnh nhân nhưng docId khớp | MEDIUM |
| Có nhiều nút xác nhận | HIGH |
| Có nhiều select chứng thư | HIGH |
| Có text lỗi/thất bại | CRITICAL |
| Không có remote config hợp lệ | CRITICAL |
| Session hết hạn | CRITICAL |
| Người ký không khớp | CRITICAL |

### Chính sách

- `LOW`: auto-click được.
- `MEDIUM`: auto-click nếu policy cho phép.
- `HIGH`: pause, yêu cầu user xác nhận thủ công.
- `CRITICAL`: stop session.

---

## 3.6. Audit log tối thiểu, không chứa PHI đầy đủ

Tạo file:

```text
content/sign/sign-audit.js
```

### Không lưu

Không lưu đầy đủ:

- Họ tên bệnh nhân.
- Mã bệnh án đầy đủ.
- Số CCCD/BHYT.
- Nội dung bệnh án.
- Toàn bộ phiếu.

### Được lưu

```js
{
  eventId: "uuid",
  timestamp: "2026-05-14T...",
  module: "auto-sign",
  eventType: "session_started | auto_click_confirm | auto_click_ok | paused | stopped | blocked",
  sessionIdHash: "sha256(sessionId)",
  patientHash: "...",
  docIdHash: "...",
  action: "confirm_click",
  result: "success | blocked | failed",
  reasonCode: "MULTIPLE_CONFIRM_BUTTONS",
  riskLevel: "HIGH",
  extensionVersion: "...",
  pageUrlPath: "/vnpthis/main/manager.jsp",
  userAgentHash: "..."
}
```

### Lưu ở đâu

Giai đoạn hiện tại:

- Lưu local ring buffer 500–1000 events.
- Có nút export JSON cho admin/debug.
- Không sync qua `chrome.storage.sync`.

Sau này toàn viện:

- Gửi về dashboard nội bộ nếu có server.
- Bắt buộc scrub PHI trước khi gửi.

---

## 3.7. Thêm pause thay vì stop cứng

Khi gặp tình huống không rõ, không nên tự ký tiếp hoặc tự bỏ qua quá nhanh.

### Trạng thái mới

```js
ACTIVE
PAUSED_NEEDS_USER
STOPPED
EXPIRED
COMPLETED
```

### Khi pause

UI phải hiển thị:

```text
Aladinn đã tạm dừng ký tự động.
Lý do: Có nhiều nút Xác nhận / Không xác định được người ký / Phiếu không khớp.
Hành động:
[Tiếp tục sau khi tôi xử lý] [Bỏ qua phiếu này] [Dừng phiên]
```

---

## 3.8. Nâng cấp UI xác nhận trước phiên ký

Trước khi bắt đầu ký, modal phải hiển thị:

| Trường | Nội dung |
|---|---|
| Người dùng HIS | tên đang đăng nhập nếu đọc được |
| Người ký kỳ vọng | từ filter/SmartCA nếu đọc được |
| Số bệnh nhân | n |
| Số phiếu | n |
| Loại phiếu | nhóm theo `TENPHIEU` |
| Người tạo | chỉ ký phiếu của ai |
| Cảnh báo | “Bạn vẫn chịu trách nhiệm kiểm tra trước khi ký” |
| Chế độ | Auto-confirm ON/OFF, Auto-next ON/OFF |

Nút chính nên là:

```text
Tôi đã kiểm tra — Bắt đầu phiên ký
```

Không dùng nút quá mơ hồ như “Bắt đầu ký” nếu chưa có checklist.

---

## 3.9. Khóa theo bệnh nhân và phiếu

Trước khi chuyển sang bệnh nhân tiếp theo, phải ghi trạng thái:

```js
doc.status = "signed" | "skipped" | "failed" | "unknown";
```

Không được mặc định `completed++` chỉ vì đã chuyển tiếp.

### Quy tắc

- Chỉ đánh dấu signed sau khi thấy success dialog hợp lệ.
- Nếu timeout: `unknown`, không phải `signed`.
- Nếu mismatch creator: `skipped`.
- Nếu error dialog: `failed`.
- Nếu user stop: giữ `pending`.

---

## 3.10. Không tự động đóng PDF tab nếu chưa xác minh

Hiện có:

```js
chrome.runtime.sendMessage({ action: 'closePdfTab' });
```

Cần thêm điều kiện:

```js
if (SessionGuard.assertCanAutoClick({ action: 'closePdfTab' })) {
  chrome.runtime.sendMessage({
    action: 'closePdfTab',
    sessionId,
    stepNonce
  });
}
```

Background chỉ xử lý nếu:

- Session đang active.
- Tab PDF thuộc phiên hiện tại.
- PDF tab được mở sau `session.startedAt`.
- Origin/path hợp lệ.

---

## 4. Thay đổi cụ thể theo file

## 4.1. `content/sign/auto-click-helper.js`

### Sửa

- `remoteAutoSignEnabled = false`
- thêm `remoteConfigLoaded = false`
- thêm `SessionGuard.isSessionValid()`
- bỏ click nếu không có session.
- bỏ tìm Shadow DOM toàn cục nếu không có target context.
- thay `setInterval` 1000ms bằng observer + debounce, nhưng vẫn có watchdog 1500–2000ms.

### Logic mới rút gọn

```js
if (!Policy.isAutoSignAllowed()) return;
if (!SessionGuard.isSessionValid()) return;

const context = SignContext.collect('smartCAConfirm');
const decision = RiskEngine.evaluate(context, SessionGuard.getSession());

if (decision.level === 'LOW' || decision.level === 'MEDIUM') {
  SafeClick.click('smartCAConfirm', context);
} else if (decision.level === 'HIGH') {
  SessionGuard.pauseSession(decision.reasonCode);
} else {
  SessionGuard.stopSession(decision.reasonCode);
}
```

---

## 4.2. `content/sign/signing.js`

### Sửa

- Khi `startSession()`: tạo Secure Session.
- Khi `stopSession()`: ghi audit, revoke session.
- Khi `processNextPatient()`: cập nhật context bệnh nhân.
- Khi auto-click confirm/OK: dùng `SafeClick` + `RiskEngine`, không `_findBtnByText` trực tiếp.
- Khi success dialog: đánh dấu current doc/patient là signed.
- Khi timeout: đánh dấu unknown/failed, không completed.

### Cần bỏ/dời

- `_findBtnByText()` không dùng trực tiếp cho click.
- `_findBtnById()` chỉ được dùng trong SafeClick.
- `window.__aladinnSigningActive` chỉ giữ làm legacy flag, không làm nguồn sự thật chính.

---

## 4.3. `content/sign/advanced-sign.js`

### Sửa

- Khi gọi `startAdvancedSession(documents, patientInfo)`, phải gọi `SessionGuard.startSession()`.
- Mỗi document trong queue phải có `docIdHash`.
- Không dùng JWT nếu không cần; nếu cần, token không được log.
- Khi fetch danh sách phiếu, normalize dữ liệu trước khi đưa sang UI.
- Với phiếu không có `SOPHIEU`/ID rõ, yêu cầu user xác nhận thủ công.

---

## 4.4. `content/sign/advanced-sign-ui.js`

### Sửa bảo mật UI

Hiện có render bằng `innerHTML` với dữ liệu từ HIS:

```js
${patientName}
${typeName}
${creator}
${doc.TENPHIEU}
```

Cần escape HTML để tránh DOM injection nếu dữ liệu HIS chứa ký tự đặc biệt.

Thêm helper:

```js
function escapeHTML(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
```

Áp dụng cho toàn bộ dữ liệu render từ HIS.

---

## 4.5. `background/service-worker.js`

### Sửa

Các action sau phải yêu cầu session token:

```js
enableAutoSign
disableAutoSign
closePdfTab
```

`enableAutoSign` không nên được gọi tự do từ content script không xác thực. Chỉ cho phép nếu:

- sender.tab.url thuộc domain HIS.
- message có `sessionId`.
- session đã được background ghi nhận.
- tabId khớp.

---

## 5. Policy đề xuất

Tạo:

```text
content/sign/sign-policy.js
```

### Policy mặc định

```js
const DEFAULT_SIGN_POLICY = {
  autoSignEnabled: false,
  requireRemoteConfig: true,
  failClosedOnConfigError: true,

  maxSessionMs: 10 * 60 * 1000,
  maxIdleMs: 2 * 60 * 1000,

  allowBackgroundTabClick: false,
  requireVisibleTab: true,

  allowConfirmAutoClick: true,
  allowOkAutoClick: true,
  allowAutoClosePdfTab: true,
  allowAutoNext: true,

  maxRiskForAutoClick: 'MEDIUM',

  requireSingleConfirmCandidate: true,
  requireNoUnselectedSignerSelect: true,
  requireNoMultipleSignerSelect: true,
  requireNoErrorText: true,

  auditEnabled: true,
  auditRetentionEvents: 1000
};
```

### Remote config

Remote config chỉ được bật auto-sign nếu có:

```json
{
  "features": {
    "autoSign": true
  },
  "signPolicy": {
    "version": 1,
    "expiresAt": "2026-06-01T00:00:00+07:00",
    "maxRiskForAutoClick": "MEDIUM"
  }
}
```

Nếu thiếu `expiresAt` hoặc đã hết hạn → tắt.

---

## 6. Reason codes chuẩn hóa

Dùng reason code cố định để audit và debug.

```js
const SIGN_REASON = {
  SESSION_EXPIRED: 'SESSION_EXPIRED',
  SESSION_NOT_USER_INITIATED: 'SESSION_NOT_USER_INITIATED',
  REMOTE_CONFIG_MISSING: 'REMOTE_CONFIG_MISSING',
  REMOTE_CONFIG_EXPIRED: 'REMOTE_CONFIG_EXPIRED',
  REMOTE_AUTOSIGN_DISABLED: 'REMOTE_AUTOSIGN_DISABLED',

  PATIENT_CONTEXT_MISMATCH: 'PATIENT_CONTEXT_MISMATCH',
  DOCUMENT_CONTEXT_MISMATCH: 'DOCUMENT_CONTEXT_MISMATCH',
  SIGNER_MISMATCH: 'SIGNER_MISMATCH',
  CREATOR_MISMATCH: 'CREATOR_MISMATCH',

  MULTIPLE_CONFIRM_BUTTONS: 'MULTIPLE_CONFIRM_BUTTONS',
  MULTIPLE_OK_BUTTONS: 'MULTIPLE_OK_BUTTONS',
  UNSELECTED_SIGNER_SELECT: 'UNSELECTED_SIGNER_SELECT',
  MULTIPLE_SIGNER_SELECTS: 'MULTIPLE_SIGNER_SELECTS',

  ERROR_DIALOG_DETECTED: 'ERROR_DIALOG_DETECTED',
  DOM_PATTERN_UNKNOWN: 'DOM_PATTERN_UNKNOWN',
  TAB_NOT_VISIBLE: 'TAB_NOT_VISIBLE',
  PDF_TAB_NOT_OWNED_BY_SESSION: 'PDF_TAB_NOT_OWNED_BY_SESSION',

  USER_PAUSED: 'USER_PAUSED',
  USER_STOPPED: 'USER_STOPPED',
  COMPLETED: 'COMPLETED'
};
```

---

## 7. Test bắt buộc

## 7.1. Test session guard

- Không có session → không auto-click.
- Session hết hạn → không auto-click.
- Session không user-initiated → không auto-click.
- Sai step nonce → không auto-click.
- Stop session → revoke toàn bộ quyền.

## 7.2. Test SafeClick

- Một nút `#btnConfirm` hợp lệ → click.
- Hai nút `#btnConfirm` → không click.
- Nút `Xác nhận` ngoài modal → không click.
- Modal có chữ “lỗi” → không click.
- Select chưa chọn → không click.
- Nhiều select chứng thư → không click.

## 7.3. Test context

- Patient hash khớp → OK.
- Patient hash lệch → block.
- Không đọc được patient nhưng docId khớp → medium risk.
- Signer mismatch → critical.
- Creator mismatch → skip/pause theo policy.

## 7.4. Test policy

- Remote config missing → auto-sign OFF.
- Remote config expired → OFF.
- Remote config malformed → OFF.
- Remote config bật nhưng local feature sign OFF → OFF.
- Local ON + remote ON + session valid → ON.

## 7.5. Test audit

- Không log họ tên bệnh nhân đầy đủ.
- Không log mã bệnh án đầy đủ.
- Có reasonCode.
- Có riskLevel.
- Có session hash.
- Ring buffer không vượt quá giới hạn.

---

## 8. Acceptance Criteria

Module được xem là đạt khi:

1. Không có auto-click nếu user chưa bấm bắt đầu phiên ký.
2. Không có auto-click nếu remote config lỗi/chưa tải/hết hạn.
3. Không click nếu có nhiều candidate nút xác nhận.
4. Không click nếu có nhiều chứng thư/người ký cần chọn.
5. Không đánh dấu ký thành công nếu chưa thấy success dialog hợp lệ.
6. Có pause UI khi gặp ambiguity.
7. Có audit log tối thiểu không chứa PHI đầy đủ.
8. Có unit test cho SessionGuard, SafeClick, Policy, RiskEngine.
9. Auto-sign vẫn giữ luồng cốt lõi hiện tại.
10. Có kill switch hoạt động tức thì.

---

## 9. Prompt triển khai cho Antigravity

Bạn là senior Chrome Extension engineer và healthcare security engineer. Hãy nâng cấp module Auto-sign của Aladinn HIS VNPT theo yêu cầu sau:

### Mục tiêu

Giữ nguyên tính năng cốt lõi của Auto-sign nhưng khắc phục toàn bộ điểm yếu bảo mật/vận hành. Không xóa workflow hiện tại. Chỉ refactor để thêm guard, policy, audit, safe-click và context verification.

### File cần tạo mới

- `content/sign/sign-session-guard.js`
- `content/sign/sign-context.js`
- `content/sign/sign-policy.js`
- `content/sign/sign-audit.js`
- `content/sign/sign-safeclick.js`
- `content/sign/sign-risk-engine.js`

### File cần sửa

- `content/sign/signing.js`
- `content/sign/advanced-sign.js`
- `content/sign/advanced-sign-ui.js`
- `content/sign/auto-click-helper.js`
- `content/sign/sign-init.js`
- `background/service-worker.js`
- `manifest.json` nếu cần thêm file content script mới

### Yêu cầu kỹ thuật

1. Auto-sign phải fail-closed nếu remote config chưa tải/lỗi/hết hạn.
2. Auto-click chỉ hoạt động trong Secure Signing Session do user chủ động bắt đầu.
3. Mỗi session có `sessionId`, `stepNonce`, TTL, idle timeout.
4. Trước mỗi auto-click phải qua:
   - `SessionGuard.isSessionValid()`
   - `Policy.isAutoSignAllowed()`
   - `SignContext.collect()`
   - `RiskEngine.evaluate()`
   - `SafeClick.click()`
5. Không dùng `_findBtnByText()` để click trực tiếp.
6. Không click nếu có nhiều candidate.
7. Không click nếu phát hiện dialog lỗi/thất bại.
8. Không tự đóng PDF tab nếu PDF tab không thuộc session hiện tại.
9. Ghi audit log tối thiểu, không chứa PHI đầy đủ.
10. Escape HTML toàn bộ dữ liệu HIS khi render trong Advanced Sign UI.
11. Giữ tương thích ngược với workflow hiện tại.
12. Thêm unit tests cho các module mới.

### Không được làm

- Không gửi thêm dữ liệu bệnh nhân ra ngoài.
- Không thay đổi core CDS/AI/Scanner.
- Không đổi giao diện lớn ngoài các cảnh báo/pause cần thiết.
- Không xóa Advanced Sign.
- Không tự động ký khi chưa có user gesture.
- Không fail-open.

### Kết quả cần giao

- Code hoàn chỉnh.
- Test pass.
- Ghi rõ những selector mới thêm.
- Ghi rõ nơi bật/tắt Auto-sign.
- Ghi rõ cách rollback nếu lỗi.
