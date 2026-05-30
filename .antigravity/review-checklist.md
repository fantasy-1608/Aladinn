# Release & Code Review Checklist

Review all modifications against this verification checklist before pushing to deployment:

## Security & Privacy
- [ ] **Secrets:** Ensure no API keys, credentials, or development endpoints are hardcoded in the changes.
- [ ] **PHI Leakage:** Verify that all data payloads routing to external hosts are properly redacted of PHI.
- [ ] **Bridges:** Check that `postMessage` exchanges incorporate valid token and nonce validations.

## Clinical Integrity
- [ ] **Patient Guards:** Ensure patient-context guards are active and asserted on any writeback attempt.
- [ ] **Fail Closed:** Verify that all unexpected DOM structures, schema errors, or timeouts result in immediate execution halts.

## Testing & Compilation
- [ ] **Branch Coverage:** Ensure newly introduced logic branches achieve 90%+ testing coverage.
- [ ] **Build Integrity:** Confirm `pnpm run build` completes successfully with clean asset packaging.
- [ ] **Lint Compliance:** Ensure ESLint reports 0 errors.
