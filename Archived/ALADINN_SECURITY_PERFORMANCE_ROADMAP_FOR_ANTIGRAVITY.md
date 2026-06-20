# ALADINN — ROADMAP BẢO MẬT & HIỆU NĂNG CHO ANTIGRAVITY

> Dự án: Aladinn — Chrome Extension hỗ trợ VNPT HIS  
> Phiên bản mục tiêu: Aladinn v2.x  
> Ngày tạo: 2026-06-16  
> Người dùng yêu cầu: giữ **AI VIP** là **easter egg**, nhưng phải có kiểm soát bảo mật.  
> Mục tiêu của file này: dùng làm tài liệu đầu vào cho Antigravity/Coding Agent để triển khai theo thứ tự ưu tiên.

---

## 0. Quy tắc làm việc cho Antigravity

Khi sửa code, bắt buộc tuân thủ các nguyên tắc sau:

1. Không thay đổi nghiệp vụ HIS nếu không cần thiết.
2. Ưu tiên patch nhỏ, dễ review, dễ rollback.
3. Không gom nhiều vùng rủi ro vào một commit lớn.
4. Không lưu hoặc log PHI gồm: họ tên bệnh nhân, mã bệnh nhân, mã hồ sơ, số BHYT, CCCD/CMND, số điện thoại, địa chỉ, tên người nhà.
5. Không gửi raw hồ sơ/raw DOM sang AI nếu chưa qua pipeline giảm dữ liệu và khử định danh.
6. Tính năng ký số/auto-click phải fail-closed.
7. AI VIP vẫn là easter egg, nhưng không được bypass PIN, PHI pipeline, remote policy hoặc audit.
8. Nếu xung đột giữa trải nghiệm nhanh và an toàn dữ liệu, ưu tiên an toàn dữ liệu.

---

## 1. Định hướng tổng thể

Aladinn hiện đã chạm vào 3 vùng rủi ro cao:

1. **Dữ liệu bệnh án và dữ liệu định danh bệnh nhân**.
2. **Gửi dữ liệu lâm sàng đến mô hình AI bên ngoài** như Gemini.
3. **Tự động hóa thao tác ký số/xác nhận trên HIS**.

Vì vậy, định hướng từ giai đoạn này là chuyển từ “tiện ích hỗ trợ thao tác nhanh” sang “tiện ích nội bộ có kiểm soát an toàn”.

Các nguyên tắc kiến trúc:

- **An toàn mặc định**: module rủi ro cao phải tắt mặc định.
- **Tối thiểu hóa dữ liệu**: chỉ đọc và chỉ gửi đúng trường cần thiết.
- **Không tin cậy cấu hình từ xa nếu chưa xác thực**.
- **Không tự động hóa mù**: mọi auto-click phải có session, context, risk gate và audit.
- **Đo được hiệu năng**: tối ưu phải có baseline và tiêu chí pass/fail.

---

## 2. Mục tiêu kỹ thuật

### 2.1. Mục tiêu bảo mật

- Giảm tối đa nguy cơ lọt **thông tin sức khỏe được bảo vệ** (Protected Health Information, PHI) khi gọi AI.
- Đảm bảo API key không xuất hiện ở content script hoặc page context.
- Bảo vệ module ký số bằng nhiều lớp: session, tab visibility, selector validation, risk engine, policy, audit.
- Remote config phải có xác thực nguồn, chống sửa đổi trái phép và chống rollback.
- Audit/performance telemetry không chứa PHI.

### 2.2. Mục tiêu hiệu năng

- Giảm thời gian load ban đầu của content script trên trang HIS.
- Tránh inject không cần thiết vào tất cả iframe nếu module không dùng.
- Giảm giật UI khi scan danh sách bệnh nhân dài.
- Có telemetry cục bộ để đo: thời gian scan, render, AI response, số iframe, số cảnh báo CDS.
- Không làm chậm thao tác HIS nền của bác sĩ.

### 2.3. Mục tiêu vận hành

- Dễ rollback nếu module rủi ro gây lỗi.
- Có kill switch/safe mode đáng tin cậy.
- Có checklist kiểm thử trước khi triển khai nhiều máy.
- Tách rõ: production feature, experimental feature, easter egg.

---

# 3. THỨ TỰ TRIỂN KHAI ĐỀ XUẤT

---

# P0 — BẮT BUỘC LÀM TRƯỚC KHI TRIỂN KHAI RỘNG

## P0-01. Ký số remote config bằng Ed25519

### Vấn đề

Remote config hiện được tải từ GitHub raw. Nếu repo/tài khoản GitHub bị chiếm quyền hoặc file bị sửa ngoài ý muốn, attacker có thể thay đổi feature flag/policy.

### Mục tiêu

Extension chỉ chấp nhận `remote-config.json` nếu:

- Có chữ ký số hợp lệ.
- Version tăng hoặc bằng version hợp lệ gần nhất.
- Schema hợp lệ.
- Không bật module rủi ro cao khi chữ ký sai hoặc fetch lỗi.

### Việc cần làm

1. Tạo cặp khóa Ed25519 offline.
2. Lưu public key cố định trong extension source code.
3. Tạo 2 file:

```text
remote-config.json
remote-config.sig
```

4. Khi fetch config:
   - fetch JSON;
   - fetch signature;
   - verify bằng Web Crypto hoặc thư viện nhỏ đã bundle nội bộ;
   - nếu verify fail: dùng config cache cũ;
   - nếu chưa có cache: dùng default fail-closed cho `autoSign` và `autoClick`.
5. Ghi audit event nếu chữ ký sai:

```text
remote_config_signature_failed
```

### Tiêu chí hoàn thành

- Sửa `remote-config.json` nhưng không update `.sig` → extension từ chối.
- Downgrade version → extension từ chối.
- Mất mạng → extension không crash.
- `autoSign` và `autoClick` không bật khi config không xác thực được.

---

## P0-02. Thêm final safety gate tại điểm click của module ký số

### Vấn đề

Các lớp `SessionGuard`, `Policy`, `RiskEngine` đã có, nhưng điểm click cuối cùng vẫn phải tự enforce đầy đủ điều kiện an toàn. Không được phụ thuộc hoàn toàn vào upstream caller.

### Mục tiêu

Mọi auto-click phải bị chặn nếu không thỏa tất cả điều kiện:

- Có session hợp lệ.
- Tab đang visible.
- Remote config cho phép.
- Risk level nằm trong ngưỡng cho phép.
- Chỉ có đúng 1 candidate button.
- Button text thuộc allowlist.
- Button text không thuộc denylist.
- Không có error dialog.
- Không click lại cùng button.

### File cần sửa

Ưu tiên kiểm tra/sửa các file:

```text
content/sign/sign-safeclick.js
content/sign/sign-risk-engine.js
content/sign/sign-policy.js
content/sign/sign-session-guard.js
content/sign/sign-audit.js
```

### Việc cần làm

1. Thêm hàm `finalGuard(targetName, context, sessionId)` trong `content/sign/sign-safeclick.js`.
2. Gọi `RiskEngine.evaluate()` ngay trong `SafeClick.click()`.
3. So sánh risk score với `Policy.maxRiskForAutoClick`.
4. Enforce `allowedTexts`, `forbiddenTexts`, `maxCandidates`.
5. Nếu fail, log audit:

```text
sign_autoclick_blocked
```

Metadata audit không chứa PHI, ví dụ:

```json
{
  "targetName": "smartCAConfirm",
  "reasonCode": "MULTIPLE_CONFIRM_BUTTONS",
  "riskLevel": "HIGH"
}
```

### Tiêu chí hoàn thành

- Có 2 nút xác nhận → không click.
- Tab background → không click.
- Dialog lỗi xuất hiện → không click.
- Session hết hạn → không click.
- Button text là “Hủy” hoặc “Không” → không click.
- Audit log có lý do block.

---

## P0-03. Tách pipeline PHI trước khi gọi AI

### Vấn đề

Regex khử PHI chỉ là lớp phòng vệ phụ. Dữ liệu bệnh án thực tế có thể chứa tên, địa chỉ, người nhà, số hồ sơ, mã lượt khám, thông tin BHYT ở nhiều định dạng không ổn định.

### Mục tiêu

Chuyển từ tư duy “lấy raw text rồi khử PHI” sang “chỉ tạo payload lâm sàng tối thiểu ngay từ đầu”.

### Thiết kế đề xuất

```text
DOM HIS
  → Clinical Extractor
  → Field Whitelist
  → PHI Redactor
  → PHI Guard
  → Preview/Confirm nếu cần
  → AI Gateway ở background
```

### Field whitelist gợi ý

Cho voice/clinical summary chỉ giữ:

- lý do vào viện;
- quá trình bệnh lý đã khử tên;
- tiền sử bệnh lý không định danh;
- khám lâm sàng;
- sinh hiệu;
- chẩn đoán;
- thuốc/y lệnh nếu cần phân tích;
- xét nghiệm/cận lâm sàng nếu cần tóm tắt.

Không gửi:

- họ tên;
- mã bệnh nhân;
- mã hồ sơ;
- số BHYT;
- CCCD/CMND;
- số điện thoại;
- địa chỉ;
- tên người nhà;
- khoa/phòng/giường nếu không cần;
- thời điểm chính xác nếu không cần.

### File/module đề xuất

Tạo mới:

```text
shared/phi-pipeline.js
```

Có thể tích hợp với:

```text
background/phi-redactor.js
background/ai-client.js
shared/audit-telemetry.js
```

### API nội bộ đề xuất

```js
const result = PHIPipeline.prepareForAI({
  feature: 'voice' | 'summary' | 'aiVip' | 'scanner',
  payload,
  options: {
    allowDates: false,
    allowWardInfo: false,
    maxChars: 12000
  }
});

// result
{
  safePayload: {},
  redactedText: '',
  report: {
    redactedCount: 0,
    blocked: false,
    reasons: []
  }
}
```

### Việc cần làm

1. Tạo `shared/phi-pipeline.js`.
2. Định nghĩa schema payload AI tối thiểu cho từng chức năng:
   - voice input;
   - clinical summary;
   - CDS AI assistant nếu có;
   - AI VIP/easter egg.
3. Thêm `PHIReport` trả về.
4. Nếu `blocked = true`, không gọi Gemini.
5. Không log raw prompt.
6. Thêm optional preview dev-mode: hiển thị nội dung sẽ gửi AI.

### Tiêu chí hoàn thành

- Paste đoạn có tên + số điện thoại + BHYT → bị redact hoặc block.
- Paste đoạn không PHI → gửi được.
- Audit log không lưu raw prompt.
- Có unit test với dữ liệu tiếng Việt thật/giả.

---

## P0-04. Giữ AI VIP là easter egg nhưng chuyển thành “controlled easter egg”

### Quyết định sản phẩm

Vẫn giữ AI VIP dưới dạng easter egg vì đây là một phần trải nghiệm riêng của Aladinn. Tuy nhiên, easter egg không được là đường vòng né bảo mật.

### Nguyên tắc mới

AI VIP vẫn có thể mở bằng thao tác ẩn, ví dụ click version tag 5 lần, nhưng sau khi mở phải chịu đầy đủ các lớp kiểm soát:

- Có feature flag nội bộ `aiVip`.
- Có remote config cho phép `aiVipAllowed`.
- Có API key đã mã hóa và session PIN đang unlock.
- Đi qua PHI pipeline như các module AI khác.
- Ghi audit event khi reveal/bật/tắt/block.
- Mặc định sau khi reveal vẫn chưa tự bật gửi AI; user phải bật toggle riêng.

### Remote config đề xuất

```json
{
  "features": {
    "aiVip": false,
    "aiVipEasterEggReveal": true
  },
  "aiVipPolicy": {
    "requirePinUnlocked": true,
    "requirePhiPipeline": true,
    "allowRawTreatmentText": false,
    "maxInputChars": 12000,
    "auditReveal": true
  }
}
```

### File cần sửa

Ưu tiên kiểm tra/sửa:

```text
options/options.js
background/remote-config.js
background/ai-client.js
shared/audit-telemetry.js
shared/api-key-service.js
shared/phi-pipeline.js
```

### Việc cần làm

1. Giữ thao tác reveal easter egg hiện tại hoặc tương đương.
2. Đổi nhãn UI từ:

```text
Tính năng ẩn: AI VIP
```

thành:

```text
AI VIP — thử nghiệm nội bộ
```

3. Sau reveal:
   - nếu remote config không cho phép → chỉ hiển thị thông báo “AI VIP đang bị khóa bởi Safe Mode”;
   - nếu chưa unlock PIN → yêu cầu unlock;
   - nếu PHI pipeline block → không gửi AI.
4. Thêm audit event:

```text
ai_vip_easter_egg_revealed
ai_vip_enabled
ai_vip_disabled
ai_vip_blocked_by_policy
ai_vip_phi_blocked
```

5. Không lưu dữ liệu bệnh nhân trong trạng thái reveal.
6. Có thể lưu local flag không nhạy cảm:

```text
aladinn_ai_vip_revealed = true
```

7. Thêm nút:

```text
Ẩn lại AI VIP
```

### Tiêu chí hoàn thành

- Easter egg vẫn hoạt động.
- Không có API key/PIN → không dùng được AI VIP.
- Remote config khóa `aiVip` → reveal được nhưng không dùng được.
- Dữ liệu còn PHI → không gọi AI.
- Audit ghi nhận reveal/bật/block.
- Có nút ẩn lại AI VIP.

---

# P1 — LÀM SAU P0, TRƯỚC PILOT NHIỀU MÁY

## P1-01. Chuyển giải mã API key hoàn toàn về background

### Vấn đề

Content script còn có đường unlock bằng PIN và giải mã API key thoáng qua trước khi cache session ở background.

### Mục tiêu

Content script không bao giờ nhận plaintext API key.

### Việc cần làm

1. Content script chỉ gửi PIN qua message:

```text
CACHE_SESSION_PIN
```

2. Background verify PIN, derive key, decrypt thử API key.
3. Background trả về:

```json
{ "ok": true, "unlocked": true }
```

4. Xóa/deprecate code path decrypt API key ở content path.
5. Toàn bộ gọi Gemini chỉ qua background AI gateway.

### Tiêu chí hoàn thành

- Search toàn repo không còn code path trả API key thật về content.
- DevTools content context không đọc được API key.
- AI vẫn hoạt động sau unlock.

---

## P1-02. Lưu PIN lockout vào storage để reload không reset

### Vấn đề

Rate limit nhập PIN hiện là biến trong bộ nhớ; reload trang có thể reset số lần sai.

### Mục tiêu

Chống brute-force PIN tốt hơn trên máy dùng chung.

### Việc cần làm

1. Lưu vào `chrome.storage.local`:

```text
pin_failed_attempts
pin_lockout_until
```

2. Sai 5 lần → khóa 5 phút.
3. Sai tiếp sau mở khóa → tăng backoff tùy chọn:
   - 5 phút;
   - 15 phút;
   - 30 phút.
4. Đúng PIN → reset counter.
5. Logout HIS không reset lockout nếu đang bị khóa.

### Tiêu chí hoàn thành

- Reload tab sau khi sai 5 lần vẫn bị lockout.
- Đúng PIN sau khi hết lockout reset counter.

---

## P1-03. Dùng per-install salt/HMAC cho hash patientId

### Vấn đề

Hash patientId đang dùng static salt. Nếu patientId có cấu trúc dễ đoán, hash có thể bị dò ngược.

### Mục tiêu

Audit vẫn không lưu PHI, nhưng khó bị dò ngược hơn.

### Việc cần làm

1. Tạo `aladinn_install_salt` random khi cài extension.
2. Dùng salt này để hash patientId.
3. Tốt hơn: dùng HMAC-SHA256 với key cục bộ non-extractable nếu cần.
4. Chỉ log 8–12 ký tự đầu của hash.

### Tiêu chí hoàn thành

- Cùng patientId trên 2 máy khác nhau cho hash khác nhau.
- Audit không có patientId thật.

---

## P1-04. Lazy-load module theo feature flag/context

### Vấn đề

`content/main.js` đang import nhiều module ngay khi vào HIS: scanner, sign, voice, CDS, template, performance probe.

### Mục tiêu

Giảm thời gian khởi tạo và giảm tác động lên HIS.

### Việc cần làm

1. Tạo `module-loader.js`.
2. Đọc `aladinn_features` trước khi import module.
3. Chỉ load:
   - scanner khi flag scanner bật;
   - sign khi flag sign bật;
   - voice khi user mở panel/voice;
   - CDS khi flag CDS bật và context phù hợp;
   - performance probe chỉ khi debug/pilot flag bật.
4. Với iframe helper: chỉ inject vào iframe có URL/DOM pattern phù hợp.

### Tiêu chí hoàn thành

- Bundle ban đầu nhẹ hơn.
- Vào HIS không bật sign thì sign module không chạy.
- Performance probe không attach listener khi không bật pilot/debug.

---

## P1-05. Sửa listener leak trong PerformanceProbe

### Vấn đề

Dùng `bind()` trực tiếp trong `addEventListener` và `removeEventListener` tạo hai function khác nhau, nên remove có thể không gỡ listener cũ.

### Mục tiêu

Không tạo listener lặp khi bật/tắt probe nhiều lần.

### Việc cần làm

1. Trong object probe, thêm:

```js
boundClickHandler: null
```

2. Khi attach:

```js
this.boundClickHandler = this.boundClickHandler || this.handleDocumentClick.bind(this);
document.addEventListener('click', this.boundClickHandler, true);
```

3. Khi detach:

```js
if (this.boundClickHandler) {
  document.removeEventListener('click', this.boundClickHandler, true);
}
```

### Tiêu chí hoàn thành

- Bật/tắt probe 10 lần không nhân số listener.
- Không tăng số record bất thường cho 1 click.

---

# P2 — TỐI ƯU BỔ SUNG SAU PILOT

## P2-01. Giảm `style-src 'unsafe-inline'`

### Mục tiêu

Giảm bề mặt tấn công CSP.

### Việc cần làm

- Chuyển inline style lớn sang CSS file.
- Chỉ giữ inline style nếu thật sự cần cho content script overlay.
- Không thêm inline script.

---

## P2-02. Rà lại permission không cần thiết

### Mục tiêu

Tuân thủ nguyên tắc quyền tối thiểu.

### Việc cần làm

- Kiểm tra `activeTab`, `tabs`, `scripting` có dùng đúng phạm vi không.
- Nếu module nào không cần quyền thường trực, chuyển sang optional permission nếu khả thi.
- Ghi rõ justification trong docs.

---

## P2-03. Thêm CI bắt buộc

### Mục tiêu

Không để lỗi bảo mật/hiệu năng hồi quy khi update.

### CI checklist

- ESLint.
- Vitest.
- Secret scan.
- Dependency audit.
- Bundle size check.
- Unit test PHI redactor/pipeline.
- Unit test SafeClick final gate.
- Test remote config signature.

---

# 4. CHECKLIST KIỂM THỬ TRƯỚC PILOT NHIỀU MÁY

## 4.1. Bảo mật AI

- [ ] Text có tên bệnh nhân bị redact/block.
- [ ] Text có số điện thoại bị redact/block.
- [ ] Text có BHYT/CCCD bị redact/block.
- [ ] Text có địa chỉ bị redact/block.
- [ ] Raw prompt không xuất hiện trong audit log.
- [ ] API key không đọc được ở content script.
- [ ] Session AI tự khóa sau 15 phút idle.

## 4.2. Ký số

- [ ] Auto-sign không tự bật sau cài mới.
- [ ] Không click khi tab background.
- [ ] Không click khi có nhiều nút xác nhận.
- [ ] Không click khi text button không thuộc allowlist.
- [ ] Không click khi session hết hạn.
- [ ] Có nút dừng khẩn cấp rõ.
- [ ] Audit log có lý do dừng/block.

## 4.3. Hiệu năng

- [ ] Mở HIS không tăng delay rõ khi tất cả module tắt.
- [ ] Scan 50 bệnh nhân không làm treo tab.
- [ ] Không scroll giật quá mức khi scan.
- [ ] Iframe hidden không emit dữ liệu cũ.
- [ ] Performance telemetry không chứa PHI.

## 4.4. AI VIP easter egg

- [ ] Click version tag 5 lần vẫn reveal được AI VIP.
- [ ] Remote config khóa AI VIP thì reveal được nhưng không dùng được.
- [ ] Chưa unlock PIN thì không dùng được.
- [ ] Dữ liệu còn PHI thì không gọi AI.
- [ ] Có audit event khi reveal/bật/block.
- [ ] Có nút ẩn lại AI VIP.

---

# 5. GỢI Ý CẤU TRÚC BRANCH/COMMIT

```text
branch: hardening/security-performance-roadmap

commit 1: feat(security): verify signed remote config
commit 2: fix(sign): enforce final safe-click gate
commit 3: feat(ai): add PHI minimization pipeline
commit 4: feat(ai-vip): keep controlled easter egg with policy gates
commit 5: refactor(security): move API key unlock fully to background
commit 6: fix(security): persist PIN lockout across reloads
commit 7: perf: lazy-load Aladinn modules by feature flag
commit 8: fix(perf): prevent performance probe listener leak
commit 9: test: add security and performance regression tests
```

---

# 6. ĐỊNH NGHĨA HOÀN THÀNH

Dự án được xem là đạt mức “sẵn sàng pilot mở rộng” khi:

1. Tất cả mục P0 hoàn tất.
2. Ít nhất P1-01, P1-02, P1-04 hoàn tất.
3. Có test cho PHI pipeline, SafeClick final gate, remote config signature.
4. Có checklist manual test ký số.
5. Có cơ chế rollback extension hoặc kill switch module rủi ro cao.
6. Audit/performance logs đã xác nhận không chứa PHI.

---

# 7. PROMPT NGẮN ĐỂ DÁN VÀO ANTIGRAVITY

Hãy đọc toàn bộ file Markdown này và triển khai theo thứ tự ưu tiên P0 → P1 → P2. Không làm tất cả trong một commit lớn. Ưu tiên trước:

1. Ký số remote config bằng Ed25519.
2. Thêm final safety gate cho auto-click ký số.
3. Tạo PHI pipeline trước khi gọi AI.
4. Giữ AI VIP là easter egg nhưng biến thành controlled easter egg có remote policy, PIN unlock, PHI pipeline và audit.

Không thay đổi nghiệp vụ HIS nếu không cần. Không log PHI. Không gửi raw hồ sơ sang AI. Tạo test cho từng phần quan trọng.
