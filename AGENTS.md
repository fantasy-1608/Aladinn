<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Aladinn** (6564 symbols, 9847 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

> If any GitNexus tool warns the index is stale, run `npx gitnexus analyze` in terminal first.

## Always Do

- **MUST run impact analysis before editing any symbol.** Before modifying a function, class, or method, run `gitnexus_impact({target: "symbolName", direction: "upstream"})` and report the blast radius (direct callers, affected processes, risk level) to the user.
- **MUST run `gitnexus_detect_changes()` before committing** to verify your changes only affect expected symbols and execution flows.
- **MUST warn the user** if impact analysis returns HIGH or CRITICAL risk before proceeding with edits.
- When exploring unfamiliar code, use `gitnexus_query({query: "concept"})` to find execution flows instead of grepping. It returns process-grouped results ranked by relevance.
- When you need full context on a specific symbol — callers, callees, which execution flows it participates in — use `gitnexus_context({name: "symbolName"})`.

## Never Do

- NEVER edit a function, class, or method without first running `gitnexus_impact` on it.
- NEVER ignore HIGH or CRITICAL risk warnings from impact analysis.
- NEVER rename symbols with find-and-replace — use `gitnexus_rename` which understands the call graph.
- NEVER commit changes without running `gitnexus_detect_changes()` to check affected scope.

## Resources

| Resource | Use for |
|----------|---------|
| `gitnexus://repo/Aladinn/context` | Codebase overview, check index freshness |
| `gitnexus://repo/Aladinn/clusters` | All functional areas |
| `gitnexus://repo/Aladinn/processes` | All execution flows |
| `gitnexus://repo/Aladinn/process/{name}` | Step-by-step execution trace |

## CLI

| Task | Read this skill file |
|------|---------------------|
| Understand architecture / "How does X work?" | `.claude/skills/gitnexus/gitnexus-exploring/SKILL.md` |
| Blast radius / "What breaks if I change X?" | `.claude/skills/gitnexus/gitnexus-impact-analysis/SKILL.md` |
| Trace bugs / "Why is X failing?" | `.claude/skills/gitnexus/gitnexus-debugging/SKILL.md` |
| Rename / extract / split / refactor | `.claude/skills/gitnexus/gitnexus-refactoring/SKILL.md` |
| Tools, resources, schema reference | `.claude/skills/gitnexus/gitnexus-guide/SKILL.md` |
| Index, status, clean, wiki CLI commands | `.claude/skills/gitnexus/gitnexus-cli/SKILL.md` |

<!-- gitnexus:end -->

## AGENTS.md — Aladinn AI Coding Rules

### Project

Aladinn is a Chrome Extension Manifest V3 for VNPT HIS. It assists clinicians with clinical data scanning, AI summarization, voice input, auto-fill, CDS alerts, PACS view, and controlled auto-sign workflows.

### Non-negotiable safety rules (Aladinn Core)

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

### Quy tắc Thiết kế Giao diện Aladinn V2 (BẮT BUỘC)

1. **Định hướng Thiết kế (HIS-ify):** Từ phiên bản V2 trở đi, toàn bộ giao diện của Aladinn phải bám sát 100% phong cách thiết kế của hệ thống **VNPT HIS**. Aladinn phải tựa như một phần tích hợp tự nhiên, sẵn có của HIS, tạo sự tin cậy lâm sàng cao nhất cho bác sĩ.
2. **Màu sắc chủ đạo (Seed Color):** Bắt buộc sử dụng màu xanh dương VNPT HIS (`#004f9e` / `rgb(0, 79, 158)`), kết hợp với nền trắng, xám nhạt (`#f9f9f9` / `#ffffff`) và viền xanh nhạt đặc trưng (`#a6c9e2`). Cấm dùng tông màu Desert Gold (vàng sa mạc), tím hoặc các tông màu nổi bật sặc sỡ làm màu mặc định chính từ bản V2.
3. **Phong cách hình khối (Shape):** Phong cách phẳng và vuông vức hoàn toàn (`border-radius: 0px` cho các thẻ, panel, modal, input và các nút bấm chính). Tuyệt đối không bo tròn góc quá mức (trừ các pill button micro đặc thù hoặc avatar).
4. **Hiệu ứng chuyển động (Micro-animations):** Chỉ sử dụng các hiệu ứng chuyển động nhẹ nhàng, tinh tế và cực nhanh (thời gian chuyển động từ 150ms đến 250ms), ví dụ như hover sáng nhẹ viền, nâng khẽ nút bấm 1px hoặc slide chuyển tab rất dịu. Nghiêm cấm các hiệu ứng khói bụi, bay lượn gây mất tập trung cho y bác sĩ.
5. **Tham chiếu lịch sử V1:** Phong cách Desert Mystic (vàng sa mạc, bo tròn cao, hiệu ứng ambient) chỉ dành riêng cho phiên bản V1 và được lưu giữ làm tham chiếu lịch sử hoặc chế độ thử nghiệm đặc biệt.

### Quy tắc Giao tiếp & Báo cáo (BẮT BUỘC)

1. **Ngôn ngữ:** Mọi báo cáo, tài liệu thiết kế, kế hoạch thực hiện (implementation plan, walkthrough...) hoặc giải thích trong cuộc trò chuyện PHẢI được viết bằng tiếng Việt.
2. **Đối tượng:** Viết thật đơn giản, trực quan, dễ hiểu cho người không chuyên về lập trình/code (non-coder). Hạn chế tối đa các thuật ngữ kỹ thuật phức tạp. Tập trung vào tính năng thực tế, trải nghiệm sử dụng thực tế của người dùng và lợi ích lâm sàng thay vì cấu trúc code phức tạp.

### Quy tắc Lấy Dữ liệu & Kết nối API (BẮT BUỘC)

1. **Ưu tiên API tuyệt đối thay vì DOM:** Khi cần lấy thông tin bệnh nhân, tờ điều trị hoặc thực hiện ghi dữ liệu lên hệ thống VNPT HIS, bắt buộc phải ưu tiên sử dụng kết nối API trực tiếp thay vì cào dữ liệu từ cấu trúc giao diện (DOM). Điều này đảm bảo tính ổn định cực cao khi giao diện HIS cập nhật, tránh lỗi hiển thị và tăng tốc độ xử lý lâm sàng.
2. **Tìm kiếm trong kho dùng chung (Shared / HunterAI):** Trước khi viết bất kỳ đoạn code kết nối hoặc lấy dữ liệu nào, bắt buộc phải kiểm tra kỹ các thư viện và hàm có sẵn trong thư mục dùng chung `shared/` (ví dụ: `vnpt-his-api-mini-library.js`, `his-core.js`) hoặc kho công cụ `HunterAI`. Không tự viết lại các hàm đã được định nghĩa để tránh trùng lặp code và duy trì tính nhất quán.
3. **Đóng gói để tái sử dụng:** Khi phát triển thành công các hàm kết nối API mới, cần thiết kế theo dạng mô-đun hóa, đóng gói sạch sẽ và đưa vào thư mục dùng chung để phục vụ cho các tính năng khác hoặc các dự án kế thừa trong hệ sinh thái Aladinn.

### Extension Architecture & Coding Patterns (Sourced from ECC)

1. **Immutability (CRITICAL):** Always create new objects, never mutate existing patient states or data payloads. Return new copies with changes applied. This prevents patient data cross-contamination.
2. **Fail Fast & Validate Boundaries:** Validate all user input and HIS DOM/API data at system boundaries. Use schema-based validation. Never trust external data.
3. **Error Handling:** Handle errors at every level. Log securely (PHI redacted). Never silently swallow errors.
4. **File Organization:** High cohesion, low coupling. Functions <50 lines, files focused (<800 lines max). No deep nesting (>4 levels).

### Required workflow before coding

1. **Plan:** Identify dependencies, risks, and break into phases. Inspect relevant files.
2. **TDD (Test-Driven Development):** Write tests before implementation (RED -> GREEN -> IMPROVE). 80%+ coverage required.
3. **Execute:** Implement minimal change safely.
4. **Review & Validate:** Run lint, test, build. Verify against safety rules.
5. **Document:** Update docs and changelog.

### High-risk modules

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

### Required tests for high-risk changes

- Patient context changed before write.
- Missing patientId blocks write.
- EncounterId mismatch blocks write.
- LLM malformed response blocks auto-fill.
- PHI redaction before AI request.
- Endpoint allowlist blocks non-approved domain.
- Auto-sign stops when tab/window changes.
- Cache is keyed by composite patient key.
- Logs do not contain raw PHI.

### Commands

Run before finalizing:

```bash
pnpm run lint
pnpm run test
pnpm run test:coverage
pnpm run build
```

### Output expectation

For every task, provide:

1. Files changed.
2. Why changed.
3. Safety impact.
4. Tests added/updated.
5. Commands run.
6. Remaining risks.
