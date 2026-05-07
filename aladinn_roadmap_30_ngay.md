# Roadmap kỹ thuật 30 ngày cho Aladinn

## 1) Mục tiêu 30 ngày

Trong 30 ngày tới, Aladinn phải đạt được 6 mục tiêu sau:

1. **Đồng bộ tài liệu với code**  
   Xóa toàn bộ sai lệch giữa README, changelog, manifest và triển khai thực tế.

2. **Có lớp kiểm thử tối thiểu cho các luồng nguy cơ cao**  
   Đặc biệt là crypto, session, AI gateway, CDS, logout purge.

3. **Thiết lập pipeline kiểm tra trước release**  
   Không cho phát hành nếu lint/test/build thất bại.

4. **Cô lập các module nhạy cảm**  
   Giảm coupling giữa AI, CDS, auto-sign và background security.

5. **Chuẩn hóa audit và telemetry nội bộ không chứa PHI**  
   Đủ để truy vết lỗi và đánh giá hiệu quả, nhưng không rò dữ liệu bệnh nhân.

6. **Chuẩn bị gói pilot-ready có kiểm soát**  
   Có checklist cài đặt, rollback, smoke test, release note, và tiêu chí chấp nhận.

---

## 2) Nguyên tắc triển khai

- Không thêm tính năng lớn mới trong 30 ngày này, trừ khi là sửa lỗi blocker.
- Ưu tiên **ổn định, kiểm chứng, khả năng rollback** hơn là mở rộng chức năng.
- Mọi thay đổi ở security, AI gateway, CDS, auto-sign phải có test hoặc ít nhất smoke test tương ứng.
- Không để README mô tả vượt quá những gì code thực sự làm.
- Mọi log/audit mới phải **không chứa PHI (Protected Health Information)**.

---

## 3) Các vấn đề phải xử lý trước

### Nhóm blocker
1. **Sai lệch thông số bảo mật giữa README và code**  
   README ghi PBKDF2 310,000 iterations, trong khi `background/ai-client.js` đang đặt `_CRYPTO_ITERATIONS = 100000`.

2. **Tuyên bố allowlist chưa đồng nhất với triển khai thật**  
   README mô tả allowlist rộng hơn, nhưng manifest và code thực tế đang chặt hơn theo hướng chỉ Google API + VNPT HIS.

3. **Chưa có bằng chứng rõ về test coverage / CI gate**  
   `package.json` có `test`, `lint`, `build`, nhưng chưa thấy chuỗi bắt buộc trước release.

4. **Blast radius cao vì nhiều chức năng nhạy cảm đang nằm trong cùng một extension surface**  
   README cho thấy Aladinn đang đồng thời gánh scanner, voice AI, CDS, PACS, auto-sign, hội chẩn, template engine.

---

# 4) Kế hoạch 30 ngày theo tuần

## Tuần 1 — Ổn định nền, dọn nợ kỹ thuật, đồng bộ tài liệu

### Mục tiêu tuần 1
- Có một **baseline kỹ thuật đáng tin**
- Chốt “source of truth” cho security/config/version
- Xử lý các sai lệch tài liệu lớn nhất

### Công việc

#### 1.1. Audit toàn bộ security/config claims
**Làm ngay:**
- Đối chiếu các claim trong `README.md` với:
  - `manifest.json`
  - `background/service-worker.js`
  - `background/ai-client.js`
  - `CHANGELOG.md`

**Kết quả mong muốn:**
- Tạo file mới: `docs/security-truth-table.md`
- Mỗi dòng gồm:
  - claim
  - file nguồn
  - trạng thái: đúng / sai / thiếu / cần sửa
  - action owner

#### 1.2. Chốt “source of truth”
Thiết lập quy ước:
- `manifest.json`: version hiển thị cho extension
- `package.json`: version build/release
- `CHANGELOG.md`: nguồn release note
- `docs/security-truth-table.md`: nguồn sự thật cho security claims
- README chỉ là tài liệu giới thiệu, không được chứa claim chưa được đối chiếu

#### 1.3. Sửa ngay các sai lệch lớn
Ưu tiên:
- PBKDF2 iteration mismatch
- allowlist mismatch
- description/wording mang tính cá nhân hoặc “marketing quá đà” trong manifest/repo
- update changelog nếu có claim chưa được code hóa thật

#### 1.4. Chuẩn hóa cấu trúc docs
Tạo thư mục:
```text
docs/
  architecture/
  security/
  release/
  qa/
```

Tạo tối thiểu các file:
- `docs/architecture/overview.md`
- `docs/security/security-model.md`
- `docs/release/release-checklist.md`
- `docs/qa/smoke-test.md`

### Tiêu chí hoàn thành tuần 1
- Không còn claim bảo mật rõ ràng nào sai giữa README và code
- Có `security-truth-table.md`
- Có skeleton docs cho architecture / release / QA
- Mọi version file thống nhất

---

## Tuần 2 — Viết test cho luồng nguy cơ cao

### Mục tiêu tuần 2
- Có regression protection tối thiểu
- Bất kỳ thay đổi nào ở security/AI/CDS không còn “blind deploy”

### Công việc

#### 2.1. Thiết lập test matrix
Tạo tài liệu:
`docs/qa/test-matrix.md`

Chia 5 nhóm test:

1. **Security / session**
2. **AI gateway**
3. **Storage / encryption**
4. **CDS engine**
5. **Extension messaging**

#### 2.2. Viết test tối thiểu cho security
Ưu tiên cao nhất cho các case sau:

### Security test cases
- Derive key thành công khi có PIN hợp lệ
- Không trả raw API key cho content script
- Session timeout 30 phút làm clear key trong memory
- HIS logout làm purge cache nhạy cảm
- Sender validation chặn message từ sender không hợp lệ
- GET/SET settings chỉ chấp nhận whitelist key

#### 2.3. Viết test cho AI gateway
- `requestAI()` fail khi không có API key / session locked
- `fetchWithRetry()` retry đúng với lỗi 5xx
- không retry sai với lỗi client 4xx không hợp lệ
- cancel request hoạt động
- parse JSON AI output chịu được markdown fence / JSON lẫn text rác

#### 2.4. Viết test cho CDS engine
Nếu CDS chưa có unit-testable boundary rõ, tuần này phải:
- tách phần pure rule evaluation ra khỏi DOM/UI
- tạo fixture dữ liệu nhỏ

Test tối thiểu:
- phát hiện DDI mẫu
- phát hiện duplicate therapy mẫu
- phát hiện missing diagnosis mẫu
- không báo động sai với case âm tính

#### 2.5. Coverage tối thiểu
Không cần ám ảnh % cao ngay, nhưng chốt mục tiêu:
- security core: ≥ 80%
- AI utility / parser / retry: ≥ 75%
- CDS rule evaluator: ≥ 70%

### Tiêu chí hoàn thành tuần 2
- Có test chạy được bằng `npm test`
- Các luồng security/AI core có regression test
- CDS có ít nhất test mẫu cho positive/negative case
- Có báo cáo coverage cơ bản

---

## Tuần 3 — CI/CD, release gating, smoke test

### Mục tiêu tuần 3
- Không còn release thủ công kiểu “build xong là đẩy”
- Có cổng chặn lỗi trước phát hành

### Công việc

#### 3.1. Tạo CI pipeline
Dùng GitHub Actions để chạy tự động mỗi pull request / push vào nhánh chính:

Pipeline tối thiểu:
1. `npm install`
2. `npm run lint`
3. `npm test`
4. `npm run build`

#### 3.2. Thiết lập release gating
Không cho release nếu:
- lint fail
- test fail
- build fail
- version không khớp giữa `package.json` và `manifest.json`
- changelog không có entry cho version mới

#### 3.3. Refactor release script
`scripts/release.js` hiện đã làm build + zip + GitHub release.

Cần bổ sung:
- preflight checks
- verify file tồn tại sau build
- verify version sync
- verify changelog entry
- fail fast với message rõ
- in artifact checksum

#### 3.4. Viết smoke test checklist sau build
Tạo `docs/qa/smoke-test.md` với checklist thủ công 10–15 bước:

Ví dụ:
- cài extension bản build mới
- mở trang VNPT HIS
- popup load được
- options page load được
- scanner mở được
- AI request thử nghiệm trả kết quả
- logout HIS xóa cache
- auto-sign không tự kích hoạt ngoài ngữ cảnh
- slash command không xung đột field ngày giờ
- export yêu cầu consent

#### 3.5. Chuẩn hóa release checklist
Tạo `docs/release/release-checklist.md`

Bao gồm:
- branch sạch
- changelog có entry
- version sync
- lint/test/build pass
- smoke test pass
- artifact zip OK
- rollback artifact giữ lại tối thiểu 1 bản trước

### Tiêu chí hoàn thành tuần 3
- Có GitHub Action chạy tự động
- Release script có preflight checks
- Có smoke test checklist
- Mỗi release mới phải qua lint + test + build + smoke test

---

## Tuần 4 — Cô lập module, audit nội bộ, chuẩn bị pilot-ready

### Mục tiêu tuần 4
- Giảm coupling
- Tăng khả năng scale / bảo trì
- Có gói “controlled pilot” thật sự dùng được

### Công việc

#### 4.1. Tách module theo ranh giới rủi ro
Tối thiểu refactor boundary như sau:

### A. Security Core
- key derivation
- encryption/decryption
- timeout
- logout purge

### B. AI Gateway
- resolve API key
- build prompt
- retry/cancel
- parse response
- model list

### C. CDS Core
- alias mapping
- rule engine
- lab-drug condition engine
- missing diagnosis engine

### D. Sign Workflow
- state machine cho auto-sign
- tab switch logic
- helper injection

### E. UI Adapters
- popup/options/content modal
- message bridge
- HIS field bindings

Mục tiêu: giảm việc business logic dính trực tiếp vào DOM/script injection.

#### 4.2. Thiết kế audit event schema không chứa PHI
Tạo `docs/security/audit-schema.md`

Mỗi audit event gồm:
- `event_name`
- `module`
- `timestamp`
- `user_role` hoặc `local_user_id_masked`
- `success/failure`
- `error_code`
- `version`
- `environment`

Ví dụ event:
- `ai_request_started`
- `ai_request_failed`
- `export_confirmed`
- `his_logout_purge`
- `autosign_session_started`
- `cds_warning_generated`

Không lưu:
- họ tên
- mã bệnh nhân thật
- transcript đầy đủ
- nội dung bệnh án đầy đủ

#### 4.3. Feature flag theo role hoặc mode
Tạo chế độ:
- `pilot_safe_mode`
- `full_mode`

Trong `pilot_safe_mode`:
- tắt mặc định auto-sign
- log chi tiết hơn
- yêu cầu xác nhận nhiều hơn với export
- chỉ bật CDS/AI/scanner cho nhóm dùng thử

#### 4.4. Chuẩn bị gói pilot deployment
Tạo thư mục:
`docs/pilot/`

Tối thiểu có:
- `pilot-install-guide.md`
- `pilot-rollback-guide.md`
- `pilot-acceptance-criteria.md`
- `pilot-issue-template.md`

#### 4.5. Chốt bộ chỉ số theo dõi pilot
Trong 2–4 tuần pilot, đo:
- số lượt mở scanner
- số lượt dùng AI
- số CDS alerts / số alert bị dismiss
- số lỗi AI request
- số lần auto-sign session khởi động
- median response time
- số lỗi theo version

### Tiêu chí hoàn thành tuần 4
- Boundary module rõ hơn
- Có audit schema
- Có safe mode cho pilot
- Có bộ tài liệu pilot đầy đủ
- Có metric plan sau triển khai

---

# 5) Lịch 30 ngày chi tiết dạng checklist

## Ngày 1–3
- [ ] Audit README ↔ manifest ↔ service worker ↔ ai-client ↔ changelog
- [ ] Tạo `security-truth-table.md`
- [ ] Liệt kê mọi sai lệch
- [ ] Chốt source of truth

## Ngày 4–7
- [ ] Sửa mismatch về security/config/version
- [ ] Dọn wording manifest/README
- [ ] Tạo `docs/architecture`, `docs/security`, `docs/release`, `docs/qa`

## Ngày 8–10
- [ ] Thiết lập test matrix
- [ ] Viết unit test cho timeout, whitelist, sender validation
- [ ] Viết test cho encrypt/decrypt service

## Ngày 11–14
- [ ] Viết test cho AI retry/cancel/parser
- [ ] Viết test cho locked session / invalid key path
- [ ] Tách CDS evaluator nếu cần để test được

## Ngày 15–18
- [ ] Viết CDS regression tests
- [ ] Thêm coverage report
- [ ] Chốt ngưỡng coverage tối thiểu cho module nguy cơ cao

## Ngày 19–21
- [ ] Tạo GitHub Actions pipeline
- [ ] Chặn release nếu lint/test/build fail
- [ ] Refactor `release.js` với preflight checks

## Ngày 22–24
- [ ] Viết smoke test checklist
- [ ] Viết release checklist
- [ ] Kiểm tra version sync tự động

## Ngày 25–27
- [ ] Refactor module boundary: security core / AI gateway / CDS / sign workflow
- [ ] Tạo audit schema
- [ ] Tạo safe mode cho pilot

## Ngày 28–30
- [ ] Viết pilot install/rollback/acceptance docs
- [ ] Build release candidate
- [ ] Chạy smoke test
- [ ] Đóng gói pilot-ready release
- [ ] Tạo issue list cho vòng 2 sau pilot

---

# 6) Definition of Done (DoD) cho cuối 30 ngày

Aladinn chỉ được xem là hoàn thành roadmap 30 ngày khi đáp ứng đủ các điều kiện sau:

### Tài liệu
- [ ] README không còn claim sai với code
- [ ] Có architecture overview
- [ ] Có security model
- [ ] Có release checklist
- [ ] Có smoke test checklist
- [ ] Có pilot docs

### Chất lượng kỹ thuật
- [ ] `npm run lint` pass
- [ ] `npm test` pass
- [ ] `npm run build` pass
- [ ] Có coverage report cơ bản
- [ ] Có regression tests cho security + AI + CDS core

### Release
- [ ] Version sync
- [ ] Changelog đầy đủ
- [ ] Release script có preflight checks
- [ ] Có artifact zip chuẩn
- [ ] Có rollback plan

### Vận hành pilot
- [ ] Có safe mode
- [ ] Có audit schema không chứa PHI
- [ ] Có acceptance criteria cho pilot
- [ ] Có danh sách metrics theo dõi sau triển khai

---

# 7) Ưu tiên nếu thiếu thời gian

Nếu chỉ làm được 40–50% roadmap này, thứ tự ưu tiên nên là:

## Bắt buộc làm trước
1. Sửa doc-code drift  
2. Viết test cho security/session/AI gateway  
3. Thiết lập CI lint + test + build  
4. Viết smoke test checklist  
5. Chuẩn bị rollback + pilot docs

## Có thể lùi sang vòng sau
1. Refactor module boundary sâu hơn  
2. Telemetry dashboard đẹp  
3. Role-based feature control đầy đủ  
4. Coverage cao toàn bộ codebase

---

# 8) Kỳ vọng điểm sau 30 ngày

Nếu làm trọn gói roadmap này, kỳ vọng Aladinn tăng từ khoảng **82/100 lên 89–91/100** vì 3 lý do chính:

- giảm mạnh rủi ro “release lỗi mà không biết”
- tăng độ tin cậy kỹ thuật khi triển khai cho nhiều người dùng hơn
- chuyển repo từ trạng thái “sản phẩm nội bộ tốt” sang “pilot system có governance”

---

# 9) Chỉ thị ngắn gọn để giao cho dev / Antigravity

```md
Mục tiêu 30 ngày của Aladinn không phải là thêm tính năng mới, mà là nâng độ chín kỹ thuật để sẵn sàng pilot nội bộ có kiểm soát.

Ưu tiên theo thứ tự:
1. Đồng bộ README/changelog/manifest/code, xóa mọi security claim sai.
2. Viết test cho security core, session timeout, sender validation, AI retry/cancel/parser, CDS evaluator.
3. Thiết lập GitHub Actions chạy lint + test + build.
4. Cải tiến release script với preflight checks, version sync, changelog verification.
5. Viết smoke test checklist và release checklist.
6. Refactor boundary giữa security core, AI gateway, CDS core, sign workflow, UI adapters.
7. Thiết kế audit schema không chứa PHI và tạo pilot safe mode.
8. Chuẩn bị bộ tài liệu pilot: install, rollback, acceptance criteria, issue template.

Không thêm feature lớn mới trong giai đoạn này trừ bug blocker.
Mọi thay đổi ở module nhạy cảm phải có test hoặc smoke test tương ứng.
Definition of Done: lint/test/build pass, docs đồng bộ, release có gate, pilot docs đầy đủ.
```
