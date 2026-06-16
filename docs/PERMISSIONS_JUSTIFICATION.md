# Aladinn Extension Permissions Justification

This document justifies the permissions requested by the Aladinn Chrome Extension in `manifest.json`. Every requested permission is strictly required to implement core features while maintaining clinical safety, performance, and legal compliance.

---

## 1. Chrome API Permissions

### `scripting`
- **Justification**: Needed to dynamically inject content scripts, CSS, and event listeners into the nested frames/iframes dynamically loaded by VNPT HIS (e.g., patient list, clinical logs, lab results).
- **Core Feature**: Clinical data scanning, self-healing element selectors, and ajax-interceptor API bridges.

### `storage`
- **Justification**: Used to persist clinical configuration state, cache BHYT rules locally, store session configuration parameters, and securely save user preferences and the encrypted Gemini API key.
- **Core Feature**: Local CDS Rule Engine, settings synchronization, security settings, and local caching.

### `tabs`
- **Justification**: Allows the extension to check the URL and title of the active tab to guarantee that background service workers communicate with VNPT HIS tabs and prevent cross-tab contamination of patient context.
- **Core Feature**: Patient context lock security and Voice/Autofill validation.

### `sidePanel`
- **Justification**: Enables displaying the Aladinn sidebar panel alongside the VNPT HIS layout. The sidebar displays real-time BHYT warnings, diagnostic scores, and clinical summaries without occupying HIS screen real estate.
- **Core Feature**: Clinical Sidebar Dashboard.

### `alarms`
- **Justification**: Since MV3 Service Workers are ephemeral and terminate after inactivity, this permission allows scheduling background checks (e.g., refreshing remote BHYT configuration, validating session timeout status).
- **Core Feature**: Remote configuration syncing and automatic logging integrity audits.

---

## 2. Host Permissions

### `https://*.vncare.vn/*`
- **Justification**: The primary host pattern for VNPT HIS deployments. Content scripts are injected here to scrape clinical data, render badges, intercept network responses, and perform voice autofill.
- **Core Feature**: All extension functionalities on the hospital information system.

### `https://generativelanguage.googleapis.com/*`
- **Justification**: Enables direct browser-to-API communication with the Google Gemini LLM backend.
- **Core Feature**: Voice dictation parsing, AI clinical summarization, and PHI redaction workflows.

### `https://raw.githubusercontent.com/fantasy-1608/Aladinn/*`
- **Justification**: Endpoint to pull static, public BHYT rule datasets and drug list mappings.
- **Core Feature**: Local rule-engine data seeding.

### `https://api.github.com/repos/fantasy-1608/Aladinn/*`
- **Justification**: Used to query the latest release metadata to verify if the extension requires update or security patches.
- **Core Feature**: Extension self-updater and vulnerability management.
