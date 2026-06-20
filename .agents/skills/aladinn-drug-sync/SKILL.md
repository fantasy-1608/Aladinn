---
name: aladinn-drug-sync
description: >-
  Automates the master update pipeline for VNPT HIS Aladinn extension drug data, crawls NHIC interactions, processes maps, and deploys updates OTA via GitHub.
---

# Aladinn Drug Sync and NHIC Crawler Pipeline

## Overview
This skill automates the process of importing new drug lists downloaded from hospital stock, mapping brand names to generic names, crawling drug-drug interactions (DDI) from the NHIC national portal, running AI Pharmacist payload optimization, building the production extension, and pushing the static data files to GitHub for Over-The-Air (OTA) synchronization.

## Dependencies
- `vnpt-his-safety`: Must respect clinical writeback boundaries and Vietnam healthcare legal regulations.

## Quick Start
Trigger this skill when the user mentions they downloaded new drugs or want to sync/crawl the drug inventory.
Example trigger phrases:
- "Tôi đã tải thuốc mới từ kho về"
- "Tôi đã cào lại kho thuốc"
- "Đồng bộ danh mục thuốc mới"
- "Run NHIC drug update pipeline"

## Workflow
Follow these steps systematically when triggered:

### 1. Execute the Pipeline
Run the master update pipeline using the shell command:
```bash
npm run process:nhic
```
This script will sequentially:
1. Sync new drugs from the `Downloads` directory (`scripts/sync-drugs.cjs`).
2. Update brand-to-generic mappings (`scripts/build_brand_map.cjs`).
3. Crawl new interactions from NHIC portal in resume mode (`scripts/crawl_nhic_ddi.cjs --resume`).
4. Merge rules and dynamically update both `content/cds/db.js` and `public/cds-data/metadata.json` with a timestamped version string (`scripts/merge_nhic_rules.cjs`).
5. Optimize the ruleset payload using clinical AI Pharmacist (`scripts/ai-pharmacist-pipeline.cjs`).
6. Build the Vite production bundle (`npm run build`).

### 2. Error Handling & Ignored Mappings
- During crawler execution or brand mapping: If any drug fails to map or cào NHIC fails for a specific drug, skip it and continue processing the rest of the list.
- Keep track of skipped items, and list them in your final report to the user.

### 3. Deploy to GitHub (OTA Sync)
Stage the updated files and prepare to commit:
```bash
git add .
```
Verify the changes using `gitnexus_detect_changes` if available.
Commit with the standardized commit message:
```bash
git commit -m "feat(cds): update drug database and NHIC rules"
```
Before pushing, pull the latest changes from GitHub:
```bash
git pull --no-rebase origin main
```
- If there are conflicts:
  - If they are minor/automatic conflicts in `.gitnexus` or meta files, resolve them using checkout ours:
    ```bash
    git checkout --ours AGENTS.md CLAUDE.md .gitnexus/meta.json
    git add AGENTS.md CLAUDE.md .gitnexus/meta.json
    git commit --no-edit
    ```
  - **CRITICAL:** If there are complex merge conflicts or code conflicts, immediately STOP and ask the user for directions.
- Push changes to the main repository branch:
  ```bash
  git push origin main
  ```

### 4. Report Summary
Provide a structured report of the run:
- Total rules merged.
- Generated ruleset version.
- List of skipped/failed drugs (if any).
- Git push confirmation.

## Common Mistakes
- **Running `git push` without pulling first:** Always run `git pull --no-rebase` first to sync with remote commits.
- **Interrupting execution on minor errors:** Do not halt the pipeline if a few drugs fail to map; log them and report them at the end.
