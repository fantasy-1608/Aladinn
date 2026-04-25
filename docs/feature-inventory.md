# 🧞 Aladinn — Feature Inventory v1.0

> Bảng kiểm kê toàn bộ chức năng của Aladinn v1.1.7
> Cập nhật: 2026-04-25

---

## Hướng dẫn đọc bảng

- **ID**: Mã định danh chức năng
- **Module**: Nhóm chức năng (Scanner, Sign, CDS, Voice, Popup, Options, Background, Shared)
- **File chính**: File chứa logic chính
- **Phạm vi**: Nơi chức năng hoạt động (content/popup/options/background)
- **Mức nguy cơ khi sửa**: Thấp / Trung bình / Cao / Rất cao — đánh giá rủi ro nếu sửa sai

---

## Scanner Module

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F001 | Quét buồng (room scan) | `scanner/scan-flow.js`, `scanner-init.js` | Content (top frame) | Cao |
| F002 | Quét sinh hiệu (vitals scan) | `scanner/scan-flow.js` | Content (top frame) | Cao |
| F003 | Quét thuốc ngày (drugs scan) | `scanner/scan-flow.js` | Content (top frame) | Cao |
| F004 | Quét PTTT (phẫu thuật thủ thuật) | `scanner/scan-flow.js` | Content (top frame) | Cao |
| F005 | Quét BHYT (kiểm tra bảo hiểm y tế) | `scanner/scan-flow.js` → `cds/engine.js` | Content (top frame) | Rất cao |
| F006 | Dashboard thống kê BN | `scanner/dashboard.js` | Content (top frame) | Trung bình |
| F007 | Tóm tắt CLS + Thuốc (Lab Timeline Modal) | `scanner/scanner-init.js` (showLabTimelineModal) | Content (top frame) | Cao |
| F008 | Xem ảnh DICOM (PACS viewer) | `scanner/scanner-init.js` (fetchPacsUrlFromBridge) | Content (top frame) | Trung bình |
| F009 | Quick Actions dropdown trên grid header | `scanner/scanner-init.js` (_injectQuickActionsDropdown) | Content (top frame) | Thấp |
| F010 | Inline summary button (✨ cạnh tên BN) | `scanner/scanner-init.js` (_injectInlineSummaryBtn) | Content (top frame) | Thấp |
| F011 | Badge thuốc (💊) trên dòng BN | `scanner/scanner-init.js` (injectDrugsBadge) | Content (top frame) | Thấp |
| F012 | Badge PTTT (🪡) + in chứng nhận PTTT | `scanner/scanner-init.js` (injectPtttBadge) | Content (top frame) | Trung bình |
| F013 | Badge BHYT (⚠️/✅) trên dòng BN | `scanner/scanner-init.js` (injectBhytBadge) | Content (top frame) | Trung bình |
| F014 | Lịch sử bệnh án (medical history) | `scanner/history.js` + `history-iframe-helper.js` | Content (top + iframe) | Cao |
| F015 | Dinh dưỡng BN (nutrition) | `scanner/nutrition.js` + `nutrition-iframe-helper.js` | Content (top + iframe) | Trung bình |
| F016 | Điền phiếu cấp cứu (Emergency 39/BV2) | `scanner/emergency.js` + `emergency-iframe-helper.js` | Content (top + iframe) | Rất cao |
| F017 | Cài đặt Scanner (Settings panel) | `scanner/settings.js` | Content (top frame) | Trung bình |
| F018 | Phím tắt Scanner | `scanner/shortcuts.js` | Content (top frame) | Thấp |
| F019 | Lưu trữ kết quả quét (Storage) | `scanner/storage.js` | Content (top frame) | Trung bình |
| F020 | Xóa cache kết quả quét | `scanner/scanner-init.js` (clearCache) | Content (top frame) | Thấp |
| F021 | Theo dõi chọn BN realtime (Row Observer) | `scanner/row-observer.js` | Content (top frame) | Trung bình |
| F022 | Export dữ liệu | `scanner/export.js` | Content (top frame) | Thấp |

---

## Sign Module

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F030 | Ký số tuần tự (startSession/processNextPatient) | `sign/signing.js` | Content (trang ký số) | Rất cao |
| F031 | Lọc hồ sơ theo người tạo (filterByCreator) | `sign/filter.js` | Content (trang ký số) | Trung bình |
| F032 | Inject checkboxes vào grid BN | `sign/filter.js` | Content (trang ký số) | Trung bình |
| F033 | Workflow controls UI (Start/Next/Skip/Stop) | `sign/ui.js` | Content (trang ký số) | Cao |
| F034 | Smart Detection (phát hiện sự kiện ký) | `sign/smart-detection.js` | Content (trang ký số) | Trung bình |
| F035 | Auto-click SmartCA dialog (alertify) | `sign/auto-click-helper.js` | Content (all frames) | Rất cao |
| F036 | Advanced Sign — xem phiếu chưa ký (API) | `sign/advanced-sign.js` | Content (trang ký số) | Cao |
| F037 | Advanced Sign — UI modal phiếu | `sign/advanced-sign-ui.js` | Content (trang ký số) | Trung bình |
| F038 | JWT token capture (từ HIS page) | `sign/sign-init.js` (interceptJWT) | Content (trang ký số + ward) | Cao |
| F039 | Ward page — ký hàng loạt (QLBA modal) | `sign/sign-init.js` (startWardBatchSigning) | Content (Buồng Điều Trị) | Rất cao |
| F040 | Ward page — inject checkboxes | `sign/sign-init.js` (injectWardCheckboxes) | Content (Buồng Điều Trị) | Trung bình |
| F041 | Ward page — workflow panel | `sign/sign-init.js` (injectWardPanel) | Content (Buồng Điều Trị) | Trung bình |
| F042 | QLBA auto-reopen (khi HIS đóng modal) | `sign/sign-init.js` (startQlbaAutoReopen) | Content (Buồng Điều Trị) | Rất cao |
| F043 | DOM constants (selectors) | `sign/dom-constants.js` | Content | Thấp |
| F044 | Sign utilities (waitForGridReady, SessionStats) | `sign/utils.js` | Content | Trung bình |

---

## CDS Module (Clinical Decision Support)

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F050 | CDS Engine — phân tích thuốc + chẩn đoán | `cds/engine.js` | Content (top frame) | Rất cao |
| F051 | CDS Extractor — trích xuất từ DOM HIS | `cds/extractor.js` | Content (top frame) | Rất cao |
| F052 | CDS UI — shield + drawer cảnh báo | `cds/ui.js` | Content (top frame) | Trung bình |
| F053 | CDS Knowledge Base (DB thuốc) | `cds/db.js` | Content (top frame) | Cao |
| F054 | CDS Cache (hash-based dedup scan) | `cds/cds-cache.js` | Content (top frame) | Thấp |
| F055 | Import thuốc từ bookmarklet | `cds/index.js` (ALADINN_CRAWL_RESULT) | Content (top frame) | Trung bình |
| F056 | Manual scan trigger (click shield) | `cds/index.js` (ALADINN_MANUAL_SCAN) | Content (top frame) | Thấp |
| F057 | Auto-detect context kê đơn (modal observer) | `cds/index.js` (shouldEnableScanning) | Content (top frame) | Trung bình |

---

## Voice Module

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F060 | Voice recognition (speech-to-text) | `voice/speech.js` | Content (top frame) | Trung bình |
| F061 | AI processing (Gemini) — parse text → JSON | `voice/ai.js` + `background/ai-client.js` | Content + Background | Cao |
| F062 | Auto-fill form từ AI output | `voice/autofill.js` | Content (top frame) | Rất cao |
| F063 | Voice UI (floating panel + mini button) | `voice/ui.js` | Content (top frame) | Trung bình |
| F064 | Voice toggle (bật/tắt) | `voice/voice-init.js` | Content (top frame) | Thấp |
| F065 | Voice state management | `voice/state.js` | Content (top frame) | Thấp |
| F066 | Voice storage (lưu transcript) | `voice/storage.js` | Content (top frame) | Thấp |
| F067 | Voice bridge (content ↔ background messaging) | `voice/bridge.js` | Content (top frame) | Trung bình |
| F068 | Voice constants (fields, ICD-10) | `voice/constants.js` | Content (top frame) | Thấp |

---

## Popup

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F070 | Feature toggles (Voice/Scanner/Sign/CDS) | `popup/popup.js` | Popup | Trung bình |
| F071 | Scanner action buttons (quét buồng, vitals, thuốc...) | `popup/popup.js` | Popup → Content | Trung bình |
| F072 | Lab Summary button (CLS + Thuốc) | `popup/popup.js` | Popup → Content | Thấp |
| F073 | Dashboard button | `popup/popup.js` | Popup → Content | Thấp |
| F074 | Sign actions (select all, start signing) | `popup/popup.js` | Popup → Content | Trung bình |
| F075 | Update checker banner | `popup/popup.js` | Popup | Thấp |
| F076 | Options link | `popup/popup.js` | Popup | Thấp |
| F077 | Scan selected only checkbox | `popup/popup.js` | Popup | Thấp |

---

## Options

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F080 | API key configuration (encrypted + PIN) | `options/options.js` | Options page | Cao |
| F081 | Model selection (Gemini models) | `options/options.js` | Options page | Thấp |
| F082 | Scanner settings (scan modes, preferences) | `options/options.js` | Options page | Trung bình |
| F083 | CDS settings (filter thresholds) | `options/options.js` | Options page | Trung bình |
| F084 | Sign settings (user name, user ID for filter) | `options/options.js` | Options page | Trung bình |
| F085 | Export/Import settings | `options/options.js` | Options page | Trung bình |
| F086 | Debug/diagnostic panel | `options/options.js` | Options page | Thấp |

---

## Background (Service Worker)

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F090 | AI request proxy (Gemini API) | `background/ai-client.js` | Background | Cao |
| F091 | API key encryption/decryption (AES-GCM + PBKDF2) | `background/ai-client.js` | Background | Rất cao |
| F092 | Session PIN caching (auto-lock 30min) | `background/ai-client.js` | Background | Rất cao |
| F093 | Auto-update checker (GitHub Releases) | `background/updater.js` | Background | Thấp |
| F094 | Keyboard shortcuts (Ctrl+Shift+F/S/N) | `background/service-worker.js` | Background → Content | Trung bình |
| F095 | PDF switch-back (auto-sign) | `background/service-worker.js` | Background | Trung bình |
| F096 | Auto-click injection (SmartCA dialogs) | `background/service-worker.js` | Background → Content | Cao |
| F097 | Settings whitelist (security) | `background/service-worker.js` | Background | Cao |
| F098 | Session logout detection (purge cache) | `background/service-worker.js` | Background | Cao |
| F099 | Feature toggle sync (popup ↔ content ↔ bg) | `background/service-worker.js` | Background | Trung bình |

---

## Shared Layer

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F100 | HIS Core (patient data extraction) | `shared/his-core.js` | Content | Cao |
| F101 | HIS Selectors (DOM selectors registry) | `shared/his-selectors.js` | Content | Cao |
| F102 | Event Bus (cross-module events) | `shared/event-bus.js` | Content | Cao |
| F103 | Patient Observer (auto-detect grid changes) | `shared/patient-observer.js` | Content | Cao |
| F104 | Logger (Aladinn.Logger) | `shared/logger.js` | Content | Thấp |
| F105 | Chrome Storage wrapper | `shared/storage.js` | Content | Trung bình |
| F106 | Chrome Messaging wrapper | `shared/messaging.js` | Content | Trung bình |
| F107 | UI Components (toast, modals) | `shared/ui-components.js` | Content | Trung bình |
| F108 | Crypto (encryption helpers) | `shared/crypto.js` | Content | Rất cao |
| F109 | API Key Service | `shared/api-key-service.js` | Content | Rất cao |
| F110 | Diagnostic (system info) | `shared/diagnostic.js` | Content | Thấp |
| F111 | Constants | `shared/constants.js` | Content | Thấp |
| F112 | Utilities | `shared/utils.js` | Content | Thấp |

---

## Injected Scripts (Page World)

| ID | Chức năng | File chính | Phạm vi | Mức nguy cơ |
|---|---|---|---|---|
| F120 | Token capture (JWT from HIS) | `injected/token-capture.js` | Page world | Cao |
| F121 | AJAX interceptor (sniff HIS API calls) | `injected/ajax-interceptor.js` | Page world | Cao |
| F122 | Grid hook (jqGrid event interception) | `injected/grid-hook.js` | Page world | Trung bình |
| F123 | API Bridge (fetch data from HIS APIs) | `injected/api-bridge.js` | Page world | Rất cao |

---

## Tổng hợp thống kê

| Module | Số chức năng | Rất cao | Cao | Trung bình | Thấp |
|---|---|---|---|---|---|
| Scanner | 22 | 2 | 5 | 8 | 7 |
| Sign | 15 | 4 | 3 | 6 | 2 |
| CDS | 8 | 2 | 1 | 3 | 2 |
| Voice | 9 | 1 | 1 | 3 | 4 |
| Popup | 8 | 0 | 0 | 3 | 5 |
| Options | 7 | 0 | 1 | 4 | 2 |
| Background | 10 | 2 | 3 | 3 | 2 |
| Shared | 13 | 2 | 4 | 3 | 4 |
| Injected | 4 | 1 | 2 | 1 | 0 |
| **TỔNG** | **96** | **14** | **20** | **34** | **28** |

> ⚠️ **14 chức năng mức "Rất cao"** — bất kỳ thay đổi nào trong nhóm này cần test kỹ trên VNPT HIS thật trước khi ship.
