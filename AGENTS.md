<!-- gitnexus:start -->
# GitNexus — Code Intelligence

This project is indexed by GitNexus as **Aladinn** (1402 symbols, 1413 relationships, 300 execution flows). Use the GitNexus MCP tools to understand code, assess impact, and navigate safely.

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

### Legal Compliance (Pháp Luật Bảo Mật Y Tế Việt Nam)

> **BẮT BUỘC:** Đọc skill `vnpt-his-safety` (SKILL.md v2.0) trước khi làm việc với dữ liệu y tế.
> **Tham chiếu chi tiết:** `references/vietnam-healthcare-legal-reference.md`

Mọi code trong dự án này PHẢI tuân thủ:
- **Luật BVDLCN 2025** (91/2025/QH15) — Dữ liệu y tế = dữ liệu nhạy cảm, yêu cầu đồng ý rõ ràng
- **Luật KB-CB 2023** (15/2023/QH15) — Bảo mật HSBA, quyền bệnh nhân
- **NĐ 102/2025** — CSDL quốc gia y tế, HL7 FHIR bắt buộc
- **TT 13/2025/TT-BYT** — HSBA điện tử, chữ ký số, FHIR
- **Luật ANM 2018** — Data localization khi có yêu cầu

Vi phạm: Phạt đến **5% doanh thu** hoặc **VND 3 tỷ**, có thể truy tố hình sự.

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
