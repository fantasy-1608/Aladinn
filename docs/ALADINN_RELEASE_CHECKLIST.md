# Aladinn Release Checklist

## Before release

- [ ] `pnpm run lint` pass
- [ ] `pnpm run test` pass
- [ ] `pnpm run test:coverage` pass
- [ ] `pnpm run build` pass
- [ ] Manifest permissions reviewed
- [ ] Host permissions reviewed
- [ ] No hardcoded secrets
- [ ] No raw PHI in logs
- [ ] No raw PHI in AI prompts
- [ ] Patient-context guard active for all writeback flows
- [ ] Auto-sign stop button tested
- [ ] Logout clears patient cache
- [ ] Endpoint allowlist tested
- [ ] Remote config/update URL validated
- [ ] CDS data version recorded
- [ ] Manual QA completed on test HIS account
- [ ] Changelog updated
- [ ] Version bumped consistently in package.json and manifest.json
