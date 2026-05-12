# Audit bug tiềm tàng — Aladinn

**Repo:** `fantasy-1608/Aladinn`  
**Ngày audit:** 2026-05-12  
**Phạm vi:** static review trên mã nguồn hiện có, chưa chạy build/runtime end-to-end  
**Mục tiêu:** liệt kê các lỗi tiềm tàng quan trọng, ảnh hưởng, cách sửa, điểm cần test lại, và các chú ý triển khai

---

## 1) Tóm tắt điều hành

Qua rà soát nhanh các file trọng yếu (`manifest.json`, `background/service-worker.js`, `background/ai-client.js`, `background/updater.js`, `background/remote-config.js`, `options/options.js`, `content/scanner/messaging.js`, `injected/api-bridge.js`), các nhóm vấn đề nổi bật gồm:

1. **Luồng updater có nguy cơ không hoạt động thực tế** do thiếu quyền host cho GitHub API và không có fallback hữu hiệu.
2. **Cơ chế dismiss update chưa hoàn chỉnh**, có thể lặp thông báo bản đã bị bỏ qua.
3. **Một số setting/UI tồn tại nhưng runtime không thật sự dùng**, điển hình là `geminiBaseUrl`.
4. **Có ít nhất một nút trong Options có nguy cơ báo thành công giả** (`FORCE_CDS_SYNC`).
5. **Luồng migrate từ plaintext API key sang encrypted key có lỗi trạng thái UI trong chính lần load đầu**.
6. **Một số state toàn cục và bridge message còn thiếu chặt chẽ**, có thể gây lỗi khó tái hiện trong môi trường nhiều tab/cửa sổ hoặc sau các đợt hardening tiếp theo.
7. **Có drift tài liệu/version**, không gây crash nhưng làm tăng rủi ro vận hành/debug/release.

---

## 2) Thang ưu tiên dùng trong tài liệu này

- **P1 – Cao:** có thể làm tính năng không hoạt động, báo sai trạng thái, hoặc gây lỗi vận hành đáng kể.
- **P2 – Vừa:** chưa chắc gây lỗi ngay, nhưng có nguy cơ cao tạo bug khó tái hiện hoặc bug hồi quy sau refactor.
- **P3 – Thấp:** chủ yếu là vấn đề nhất quán, maintainability, UX, hoặc technical debt.

---

## 3) Danh sách lỗi chi tiết

---

## BUG-01 — Updater có khả năng không chạy được với GitHub Releases API

- **Mức độ:** P1
- **Nhóm:** Runtime / Permissions / Update pipeline
- **File liên quan:**
  - `manifest.json`
  - `background/updater.js`

## Hiện trạng

`background/updater.js` gọi trực tiếp:

```js
https://api.github.com/repos/${UPDATE_CONFIG.githubRepo}/releases/latest
```

nhưng `manifest.json` hiện chỉ có `host_permissions` cho:

- `https://*.vncare.vn/*`
- `https://generativelanguage.googleapis.com/*`
- `https://raw.githubusercontent.com/*`

không thấy `https://api.github.com/*`.

Ngoài ra, `updateJsonUrl` hiện đang là `null`, nên fallback thực tế gần như không có.

## Ảnh hưởng

- Tính năng kiểm tra bản cập nhật có thể **luôn fail âm thầm**.
- Badge cập nhật có thể không bao giờ hiện.
- Người dùng và tác giả dễ hiểu nhầm rằng updater vẫn đang hoạt động.
- Dễ bỏ lỡ hotfix bảo mật hoặc bản vá vận hành.

## Nguyên nhân gốc

- Gọi network endpoint ngoài danh sách `host_permissions`.
- Thiết kế có fallback trên giấy tờ nhưng không cấu hình fallback thật.

## Cách sửa đề xuất

### Phương án A — Giữ GitHub Releases API

Thêm vào `manifest.json`:

```json
"https://api.github.com/*"
```

### Phương án B — Bỏ GitHub API, dùng một JSON endpoint ổn định

- Dùng `raw.githubusercontent.com/.../update.json`
- Hoặc `github.io/<repo>/update.json`
- Set `UPDATE_CONFIG.updateJsonUrl` thật sự
- Khi đó có thể không cần `api.github.com`

### Phương án C — Hỗ trợ cả hai

- Ưu tiên GitHub Releases API
- Nếu fail -> fallback JSON
- Log rõ lý do fail để debug

## Khuyến nghị triển khai

Ưu tiên **Phương án C**. Nó phù hợp nhất với thực tế bệnh viện: khi một endpoint bị rate-limit hoặc lỗi mạng, hệ thống vẫn còn đường dự phòng.

## Test sau sửa

1. Cài extension sạch.
2. Giả lập version cũ hơn release hiện tại.
3. Theo dõi `checkForUpdate()` có trả `updateInfo` không.
4. Xác nhận badge hiện đúng.
5. Ngắt một endpoint rồi kiểm tra fallback endpoint còn hoạt động.

## Chú ý khác

- Nếu dùng GitHub API nhiều, cần lưu ý rate limit ẩn danh.
- Nếu muốn ổn định cao, nên tránh phụ thuộc duy nhất vào GitHub API.

---

## BUG-02 — dismiss update không thực sự được “honor” trong checkForUpdate()

- **Mức độ:** P1
- **Nhóm:** Logic / UX / Update state
- **File liên quan:**
  - `background/updater.js`

## Hiện trạng

`dismissUpdate(version)` có lưu:

```js
aladinn_update_dismissed
```

nhưng `checkForUpdate()` không đọc lại giá trị này trước khi quyết định hiển thị update.

## Ảnh hưởng

- Người dùng bấm bỏ qua một version rồi vẫn bị nhắc lại sau chu kỳ check tiếp theo.
- UX kém, gây mất niềm tin vào nút “Bỏ qua”.
- Về lâu dài dễ dẫn tới việc người dùng bỏ qua luôn cả update quan trọng.

## Nguyên nhân gốc

- State được ghi nhưng không được đưa vào quyết định hiển thị.

## Cách sửa đề xuất

Trong `checkForUpdate()`:

1. Đọc `aladinn_update_dismissed` từ storage.
2. Nếu `dismissedVersion === latestRelease.version`:
   - không set `aladinn_update`
   - không hiện badge
   - trả `null` hoặc một object có cờ `dismissed: true`

Pseudo-code:

```js
const { aladinn_update_dismissed } = await chrome.storage.local.get(['aladinn_update_dismissed']);
if (aladinn_update_dismissed === latestRelease.version) {
  return null;
}
```

## Test sau sửa

1. Cho updater tìm thấy version mới.
2. Bấm dismiss.
3. Chạy lại `checkForUpdate()` ngay và sau một alarm cycle.
4. Xác nhận cùng version đó không hiện lại.
5. Khi có version mới hơn nữa, thông báo phải hiện lại bình thường.

## Chú ý khác

- Nên phân biệt rõ: **dismiss 1 version cụ thể** chứ không phải tắt updater hoàn toàn.

---

## BUG-03 — `geminiBaseUrl` là setting “ảo”: UI/whitelist cho phép lưu nhưng runtime gần như ignore

- **Mức độ:** P1
- **Nhóm:** Configuration drift / Runtime inconsistency
- **File liên quan:**
  - `background/service-worker.js`
  - `background/ai-client.js`
  - `README.md`

## Hiện trạng

`service-worker.js` cho phép đọc/ghi `geminiBaseUrl` qua settings whitelist.

Nhưng `background/ai-client.js` lại có hàm:

```js
function getTrustedGeminiBaseUrl(rawBaseUrl) {
    const fallback = 'https://generativelanguage.googleapis.com';
    if (!rawBaseUrl) return fallback;
    try {
        const u = new URL(rawBaseUrl);
        if (u.origin === fallback) return fallback;
    } catch (_) {}
    return fallback;
}
```

Tức là ngoài origin mặc định, gần như mọi cấu hình khác đều bị fallback về `https://generativelanguage.googleapis.com`.

Trong README, mô tả allowlist lại rộng hơn runtime thực tế.

## Ảnh hưởng

- Người dùng tưởng có thể dùng base URL tùy chỉnh/proxy/local endpoint.
- Nhưng thực tế runtime không dùng.
- Gây lỗi debug rất khó chịu: cấu hình lưu thành công, nhưng request vẫn đi endpoint mặc định.
- Dễ gây nhầm lẫn giữa tài liệu và hành vi thật của code.

## Nguyên nhân gốc

- Chưa thống nhất giữa thiết kế, tài liệu, và enforcement logic.

## Cách sửa đề xuất

### Hướng 1 — Thực sự hỗ trợ nhiều endpoint

Cập nhật `getTrustedGeminiBaseUrl()` để allowlist đúng như thiết kế mong muốn:

- `https://generativelanguage.googleapis.com`
- các domain hợp lệ được xác định rõ
- `localhost` nếu thật sự cần cho dev

Ví dụ:

```js
const allowedHosts = new Set([
  'generativelanguage.googleapis.com',
  'localhost'
]);
```

hoặc regex/domain policy rõ ràng.

### Hướng 2 — Không hỗ trợ endpoint tùy chỉnh

- Xóa `geminiBaseUrl` khỏi whitelist đọc/ghi.
- Xóa khỏi UI.
- Sửa README để nói rõ chỉ dùng endpoint chính thức.

## Khuyến nghị triển khai

Nếu mục tiêu là **ổn định sản xuất**, nên chọn **Hướng 2**.  
Nếu mục tiêu là **thử nghiệm nội bộ linh hoạt**, chọn **Hướng 1** nhưng phải kiểm soát rất chặt allowlist.

## Test sau sửa

- Lưu một giá trị base URL hợp lệ và kiểm tra request thực sự đi tới đó.
- Lưu một giá trị không hợp lệ và xác nhận bị chặn đúng cách, có log rõ ràng.
- Đối chiếu lại UI, README và runtime phải khớp nhau.

## Chú ý khác

- Đây là loại bug “không crash nhưng gây tê liệt debug”. Nên sửa sớm.

---

## BUG-04 — Nút `FORCE_CDS_SYNC` trong Options có nguy cơ báo thành công giả

- **Mức độ:** P1
- **Nhóm:** UI/Message handling / False success
- **File liên quan:**
  - `options/options.js`
  - `background/service-worker.js`

## Hiện trạng

Trong `options/options.js`, nút sync CDS gửi:

```js
chrome.runtime.sendMessage({ type: 'FORCE_CDS_SYNC' }, (_response) => {
    showToast('✅ Đã nạp lại Cấu trúc Cảnh báo Lâm sàng!');
});
```

Nhưng trong `background/service-worker.js` chưa thấy handler tương ứng cho `FORCE_CDS_SYNC`.

Ngoài ra callback hiện tại **không kiểm tra**:

- `chrome.runtime.lastError`
- `_response?.ok`

## Ảnh hưởng

- Người dùng bấm sync và nhận thông báo thành công dù backend không làm gì.
- Tăng nguy cơ sử dụng dữ liệu CDS cũ mà tưởng đã đồng bộ.
- Với môi trường lâm sàng, đây là lỗi UX nguy hiểm vì tạo **false confidence**.

## Nguyên nhân gốc

- UI gọi message chưa có consumer thực sự.
- Thiếu giao thức chuẩn hóa cho response.

## Cách sửa đề xuất

### Bước 1 — Tạo handler thật trong background

Ví dụ:

```js
if (type === 'FORCE_CDS_SYNC') {
  doActualCdsRefresh()
    .then(() => sendResponse({ ok: true }))
    .catch(err => sendResponse({ ok: false, error: String(err) }));
  return true;
}
```

### Bước 2 — UI chỉ báo thành công khi backend trả `ok: true`

```js
chrome.runtime.sendMessage({ type: 'FORCE_CDS_SYNC' }, (response) => {
  if (chrome.runtime.lastError || !response?.ok) {
    showToast('❌ Đồng bộ CDS thất bại', true);
    return;
  }
  showToast('✅ Đã nạp lại Cấu trúc Cảnh báo Lâm sàng!');
});
```

## Test sau sửa

1. Bấm sync khi backend hoạt động bình thường -> thành công.
2. Giả lập backend throw error -> UI phải báo thất bại.
3. Giả lập không có network/data source -> không được báo success giả.

## Chú ý khác

- Nếu sync là thao tác quan trọng, nên thêm timestamp “Lần đồng bộ cuối”.

---

## BUG-05 — Auto-migrate plaintext API key sang encrypted key có lỗi trạng thái UI ngay lần load đầu

- **Mức độ:** P1
- **Nhóm:** Migration / UI state / Data consistency
- **File liên quan:**
  - `options/options.js`

## Hiện trạng

Trong `loadSettings()`, nếu có `dashboard_password` và chưa có `pin_hash`, code sẽ tự migrate:

- tạo `pin_hash`
- tạo `pin_salt`
- mã hóa `geminiApiKey` sang `geminiApiKey_encrypted`
- xóa `dashboard_password`

Tuy nhiên, object `localRes` trong RAM vẫn còn `geminiApiKey` plaintext ở chính lần load đó, nên nhánh logic phía dưới vẫn có thể rơi vào case “phát hiện plaintext API key” trước khi UI chuyển hẳn sang trạng thái encrypted.

## Ảnh hưởng

- Sau migrate, UI có thể cảnh báo sai hoặc hiển thị trạng thái sai.
- `hasValidApi` có thể bị set sai trong cùng phiên.
- Có thể cần reload trang Options mới thấy đúng.
- Tạo cảm giác migrate thất bại dù storage đã lưu encrypted key.

## Nguyên nhân gốc

- Sau khi migrate, state trong storage đổi nhưng state trong bộ nhớ (`localRes`) chưa được normalize lại trước khi tiếp tục logic UI.

## Cách sửa đề xuất

### Cách đơn giản

Sau migrate:

```js
localRes.geminiApiKey = '';
localRes.dashboard_password = '';
if (encKey) localRes.geminiApiKey_encrypted = encKey;
```

### Cách sạch hơn

Sau migrate xong, gọi lại `loadSettings()` từ đầu rồi `return` luôn.

Ví dụ:

```js
await doMigration();
loadSettings();
return;
```

## Khuyến nghị triển khai

Ưu tiên **reload logic sau migrate**. Dù tốn thêm một lượt load, nhưng giúp state sạch và ít bug ẩn hơn.

## Test sau sửa

1. Tạo dữ liệu legacy (`dashboard_password`, `geminiApiKey`).
2. Mở Options.
3. Quan sát:
   - migrate diễn ra
   - UI chuyển sang trạng thái encrypted ngay trong lần mở đầu
   - không hiện cảnh báo plaintext sai
4. Reload lại trang để xác nhận không có sai khác giữa lần đầu và lần sau.

## Chú ý khác

- Đây là lỗi rất hay gặp trong migration UI: storage đúng nhưng state hiển thị sai.

---

## BUG-06 — `lastActiveTabId` là state toàn cục đơn, dễ switch nhầm tab trong môi trường nhiều cửa sổ/tab

- **Mức độ:** P2
- **Nhóm:** State management / Multi-tab behavior
- **File liên quan:**
  - `background/service-worker.js`

## Hiện trạng

`service-worker.js` lưu tab trước đó vào một biến toàn cục:

```js
let lastActiveTabId = null;
```

sau đó dùng giá trị này để switch-back khi tab PDF xuất hiện.

## Ảnh hưởng

Trong trường hợp:

- nhiều cửa sổ Chrome
- nhiều tab HIS
- nhiều thao tác ký song song

thì PDF ở một ngữ cảnh có thể kéo focus về tab không liên quan ở ngữ cảnh khác.

## Nguyên nhân gốc

- Dùng một state toàn cục duy nhất cho một vấn đề vốn mang tính **ngữ cảnh theo tab/window/session**.

## Cách sửa đề xuất

### Phương án tốt

Dùng map theo `windowId` hoặc `pdfTabId`:

```js
const lastActiveByWindow = new Map();
```

hoặc:

```js
const pdfContext = new Map(); // pdfTabId -> previousTabId
```

## Test sau sửa

1. Mở 2 cửa sổ Chrome khác nhau.
2. Cửa sổ A thao tác PDF ký số.
3. Cửa sổ B thao tác HIS bình thường.
4. Xác nhận switch-back chỉ xảy ra trong đúng ngữ cảnh của cửa sổ A.

## Chú ý khác

- Loại bug này thường hiếm gặp trong dev đơn tab nhưng xuất hiện rõ khi triển khai thực tế.

---

## BUG-07 — Bridge message đang không nhất quán giữa `token` và `nonce`

- **Mức độ:** P2
- **Nhóm:** Messaging / Security hardening / Maintainability
- **File liên quan:**
  - `content/scanner/messaging.js`
  - `injected/api-bridge.js`

## Hiện trạng

Trong `content/scanner/messaging.js`, khi **nhận** message từ page, code yêu cầu `nonce` bắt buộc:

- thiếu nonce -> reject
- nonce sai -> reject

Nhưng khi **gửi** request sang page bằng `window.postMessage`, request hiện có `token` mà không thấy gắn `nonce`.

Bên `injected/api-bridge.js`, listener đầu vào hiện chủ yếu xác thực request bằng `token` cho nhóm `REQ_*`.

## Ảnh hưởng

- Hiện tại có thể vẫn chạy được.
- Nhưng đây là kiến trúc bridge không đồng nhất, dễ gây:
  - bug âm thầm sau refactor security
  - request đi được nhưng response bị chặn
  - khó debug vì nhìn qua tưởng “đã có bảo vệ đầy đủ rồi”

## Nguyên nhân gốc

- Hardening được thực hiện từng phần, nhưng giao thức message hai chiều chưa được chuẩn hóa hoàn toàn.

## Cách sửa đề xuất

### Chọn một giao thức nhất quán

Mọi message giữa content ↔ injected nên có cùng cấu trúc:

```js
{
  type,
  requestId,
  token,
  nonce,
  payload
}
```

và cả hai chiều đều kiểm tra logic rõ ràng.

### Hoặc tách vai trò minh bạch

- `token`: xác thực request hợp lệ từ extension
- `nonce`: chống spoofing / replay / verify channel

Nhưng phải được gắn và kiểm ở **cả hai chiều** theo cùng quy ước.

## Test sau sửa

1. Gửi request hợp lệ -> pass.
2. Bỏ nonce -> fail đúng cách.
3. Sai token -> fail đúng cách.
4. Response thiếu nonce -> fail đúng cách.
5. Kiểm tra tất cả flow scanner/CDS/history/vitals không bị timeout giả.

## Chú ý khác

- Đây chưa chắc là bug đang nổ ở hiện tại, nhưng là **điểm nứt kiến trúc**. Nên sửa trước khi tiếp tục hardening thêm.

---

## BUG-08 — `requestAI()` không có fallback model an toàn như helper còn lại

- **Mức độ:** P2
- **Nhóm:** Defensive coding / AI request pipeline
- **File liên quan:**
  - `background/ai-client.js`

## Hiện trạng

`callGeminiGenerateContent()` có fallback model:

```js
model || 'gemini-2.0-flash'
```

nhưng `requestAI()` lại build URL trực tiếp bằng:

```js
${model}:generateContent
```

Nếu caller truyền `undefined`, request có thể đập vào endpoint sai.

## Ảnh hưởng

- Một số luồng voice AI có thể fail nếu model không được load đúng từ settings.
- Lỗi có thể xuất hiện ngắt quãng, khó tái hiện.

## Cách sửa đề xuất

Chuẩn hóa:

```js
const effectiveModel = model || 'gemini-2.0-flash';
const modelUrl = `${baseUrl}/${apiVersion}/models/${effectiveModel}:generateContent`;
```

## Test sau sửa

- Gửi request có model rỗng -> vẫn thành công bằng default model.
- Gửi request có model hợp lệ -> vẫn dùng model đó.

## Chú ý khác

- Tất cả gateway AI nên dùng chung một cơ chế resolve model để tránh drift giữa module voice/scanner/summarizer.

---

## BUG-09 — Drift version giữa README và mã nguồn

- **Mức độ:** P3
- **Nhóm:** Documentation / Release hygiene
- **File liên quan:**
  - `README.md`
  - `package.json`
  - `manifest.json`

## Hiện trạng

README ghi `v1.2.5`, trong khi `package.json` và `manifest.json` ở `1.2.7`.

## Ảnh hưởng

- Debug sai version.
- QA/reviewer đối chiếu nhầm.
- Release note thiếu tin cậy.
- Người dùng gửi ảnh/chụp màn hình khó khớp với code hiện hành.

## Cách sửa đề xuất

- Dùng một nguồn version duy nhất.
- Mỗi lần release phải cập nhật README hoặc bỏ version cứng khỏi README.
- Tốt hơn: render version động ở docs build step, hoặc chỉ ghi version tại manifest/package.

## Test sau sửa

- So khớp version trong README, manifest, package.
- Nếu có release script, thêm bước validation version consistency.

## Chú ý khác

- Không làm crash app, nhưng làm tăng rủi ro vận hành lâu dài.

---

## 4) Các vấn đề phụ nên chú ý thêm

### 4.1) `FORCE_CDS_SYNC` nên có timestamp và kết quả chi tiết

Ngoài việc thêm handler, nên lưu:

- `lastSuccessfulCdsSyncAt`
- `lastCdsSyncStatus`
- version/hash của bộ CDS data

Điều này rất hữu ích khi debug tại môi trường bệnh viện.

### 4.2) Remote config hiện thiết kế fail-open

Đây là quyết định có chủ đích và hợp lý với vận hành liên tục, nhưng cần nhớ:

- fail-open tốt cho availability
- fail-open xấu cho kill-switch nếu cần chặn khẩn cấp một tính năng lỗi nặng

Nên cân nhắc tách rõ:

- tính năng không quan trọng -> fail-open
- tính năng có nguy cơ an toàn dữ liệu / tự động thao tác mạnh -> fail-safe hoặc policy riêng

### 4.3) Updater và Remote Config đang phụ thuộc GitHub

Đây là tiện lợi cho phát triển, nhưng trong sản xuất nội bộ bệnh viện cần cân nhắc:

- mạng chặn GitHub
- proxy nội bộ
- rate limit
- độ ổn định ngoài giờ hành chính

Nếu Aladinn đi xa hơn, nên nghĩ tới một endpoint nội bộ hoặc mirror read-only ổn định hơn.

### 4.4) Các luồng “thành công giả” phải bị triệt tiêu triệt để

Bất kỳ nút nào ảnh hưởng dữ liệu, CDS, AI, đồng bộ, hoặc ký số đều nên có chuẩn phản hồi thống nhất:

```js
{ ok: true/false, error?: string, meta?: object }
```

UI không được tự suy diễn thành công nếu backend chưa xác nhận.

### 4.5) Nên chuẩn hóa một bảng “feature contract”

Hiện repo có nhiều module:

- voice
- scanner
- sign
- cds
- updater
- remote-config

Nên có một tài liệu riêng mô tả cho từng feature:

- source of truth của setting
- message type nào được hỗ trợ
- response contract
- side effect
- cache key/storage key
- cách test smoke test

Điều này giúp giảm bug giao tiếp giữa module.

---

## 5) Thứ tự fix đề xuất

### Đợt 1 — Nên làm ngay

1. **BUG-01** — sửa updater permissions/fallback
2. **BUG-02** — honor dismissed version
3. **BUG-04** — xử lý thật `FORCE_CDS_SYNC`
4. **BUG-05** — sửa migration state ở Options
5. **BUG-03** — quyết định số phận thật của `geminiBaseUrl`

### Đợt 2 — Nên làm ngay sau đó

6. **BUG-06** — refactor state tab/window của auto-sign
7. **BUG-07** — chuẩn hóa bridge protocol token/nonce
8. **BUG-08** — unify default model resolution

### Đợt 3 — Dọn kỹ thuật và release hygiene

9. **BUG-09** — đồng bộ version docs/code
10. thêm contract tài liệu cho feature/message/storage

---

## 6) Mẫu checklist sau khi vá

```md
- [ ] Updater gọi được endpoint hợp lệ
- [ ] Dismiss update không lặp lại cùng version
- [ ] geminiBaseUrl hoặc được hỗ trợ thật, hoặc bị loại bỏ hoàn toàn khỏi UI/docs/runtime
- [ ] FORCE_CDS_SYNC có backend handler thật và UI không báo success giả
- [ ] Migration legacy plaintext -> encrypted hiển thị đúng ngay lần load đầu
- [ ] Auto-sign/PDF switch-back không nhảy sai tab khi mở nhiều cửa sổ
- [ ] Bridge message có cấu trúc chuẩn, thống nhất token + nonce
- [ ] requestAI có default model fallback an toàn
- [ ] README/package/manifest thống nhất version
```

---

## 7) Kết luận

Điểm đáng mừng là repo **không có dấu hiệu vỡ kiến trúc toàn cục**; phần lớn vấn đề nằm ở ranh giới giữa:

- UI ↔ background
- settings ↔ runtime enforcement
- tài liệu ↔ hành vi thực tế
- state đơn giản ↔ môi trường sử dụng thật nhiều tab/cửa sổ

Đây là kiểu bug rất điển hình của extension đa module sau giai đoạn feature expansion: **không phải thuật toán chính sai, mà là contract giữa module chưa đủ chặt**.

Nếu chỉ được chọn một nguyên tắc để dọn repo trong đợt tới, nên ưu tiên:

> **Mọi setting, mọi nút bấm, mọi message type phải có “contract thật” và phản hồi thật — không tồn tại trạng thái nửa thật nửa giả.**

Nguyên tắc này sẽ xử lý được phần lớn bug ở trên.

---

## 8) Gợi ý file tiếp theo nên tạo

Sau file audit này, nên tạo tiếp:

1. `docs/FIX_PLAN_PHASE_1.md`
   - chia task cụ thể theo file
   - patch order
   - rollback note

2. `docs/MESSAGE_CONTRACT.md`
   - liệt kê tất cả `type/action`
   - request schema / response schema

3. `docs/SETTINGS_SOURCE_OF_TRUTH.md`
   - setting nào lưu ở đâu
   - module nào đọc
   - module nào được quyền ghi

4. `docs/SMOKE_TEST_CHECKLIST.md`
   - checklist test nhanh sau mỗi bản build

---

**Người thực hiện:** ChatGPT  
**Dạng đánh giá:** static audit / best-effort  
**Lưu ý:** một số mục vẫn cần xác nhận thêm bằng runtime test thực tế trên VNPT HIS trước khi đóng kết luận cuối cùng
