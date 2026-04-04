# 🧞 Aladinn — Kế hoạch Hợp nhất 3 Extension VNPT HIS

> **Mục tiêu:** Gom 3 Chrome Extension riêng lẻ thành **1 Extension duy nhất** mang tên **Aladinn**, đầy đủ chức năng, không xung đột, có thể bật/tắt từng module độc lập.

---

## 📊 Bảng Tổng hợp 3 Dự án Hiện tại

| Thuộc tính | 🎙️ HisPro (Voice Assistant) | 📊 VNPT_HIS_Scanner_v3 | ✍️ SignHis |
|:--|:--|:--|:--|
| **Version** | 2.6.0 | 5.1.0 | 4.1.0 |
| **Chức năng chính** | Voice-to-Text + AI xử lý bệnh án, Auto-fill form khám bệnh/hội chẩn/chuyển viện | Smart Dashboard, Vitals tooltips, Auto-fill DD-03 & Bệnh án (Tab A/B), Quét Phòng/Giường | Ký số hàng loạt, Lọc hồ sơ, Auto-sign context-aware, Đóng PDF tự động |
| **Content Scripts** | 9 module JS + 1 CSS | 20 module JS + 1 CSS | 8 module JS + 1 CSS |
| **Background** | [service-worker.js](file:///Users/trunganh/CNTT/Aladinn/background/service-worker.js) + [ai-client.js](file:///Users/trunganh/CNTT/Aladinn/background/ai-client.js) (AI proxy, badge, toggle) | [background.js](file:///Users/trunganh/CNTT/Aladinn/B%E1%BA%A3n%20sao%20VNPT_HIS_Scanner_v3/background.js) (minimal placeholder) | [service_worker.js](file:///Users/trunganh/CNTT/Aladinn/B%E1%BA%A3n%20sao%20sign/background/service_worker.js) (auto-sign, PDF close, keyboard shortcuts) |
| **Popup** | Không (icon click toggle) | `popup.html/js` | `popup.html/js/css` |
| **Options** | `options.html/js` (API key, PIN, model) | Không | `options.html/js/css` (tên/userId, tốc độ ký) |
| **Permissions** | `activeTab`, `storage` | `activeTab`, `scripting`, `storage` | `storage`, `tabs`, `scripting`, `webNavigation` |
| **Host Permissions** | `*.vncare.vn`, `generativelanguage.googleapis.com`, `*.ngrok-free.dev` | `bvdongthap.vncare.vn`, `generativelanguage.googleapis.com` | `*.vncare.vn` |
| **Injected Scripts** | Không | 4 page scripts (token-capture, ajax-interceptor, grid-hook, api-bridge) | 1 page script ([page_inject.js](file:///Users/trunganh/CNTT/Aladinn/injected/page_inject.js)) |
| **Thư viện ngoài** | Không | Không | jQuery |
| **Namespace** | Globals: [init()](file:///Users/trunganh/CNTT/Aladinn/content/scanner/settings.js#392-398), `isExtensionEnabled`, `transcript`... | IIFE + `window.VNPT*` (VNPTLogger, VNPTStore...) | IIFE + `window.Signing`, `window.Filter`, `window.UI`... |
| **Commands** | Không | Không | 3 shortcuts (Cmd+Shift+F/S/N) |

---

## ⚠️ Phân tích Xung đột (Conflict Analysis)

### 1. 🔴 Xung đột Namespace (Nghiêm trọng)

| Module | HisPro | Scanner | SignHis | Giải pháp |
|:--|:--|:--|:--|:--|
| [ui.js](file:///Users/trunganh/CNTT/Aladinn/content/sign/ui.js) | ✅ Global functions | ✅ `window.VNPTUI` | ✅ `window.UI` | Đổi → `Aladinn.Voice.UI`, `Aladinn.Scanner.UI`, `Aladinn.Sign.UI` |
| [utils.js](file:///Users/trunganh/CNTT/Aladinn/content/voice/utils.js) | ✅ Global functions | Không | ✅ `window.HisUtils` | Gom common → `Aladinn.Utils`, riêng → từng module |
| [storage.js](file:///Users/trunganh/CNTT/Aladinn/content/voice/storage.js) | ✅ Global functions | ✅ `window.VNPTStorage` | Không | Tách namespace: `aladinn_voice_*`, `aladinn_scanner_*` |
| [content.js](file:///Users/trunganh/CNTT/Aladinn/content/content.js) | ✅ Entry point | ✅ Entry point (IIFE) | ✅ Entry point (IIFE) | 1 content.js orchestrator, gọi 3 init riêng |

### 2. 🟡 Xung đột Storage Keys (Trung bình)

| Key | HisPro | Scanner | SignHis | Giải pháp |
|:--|:--|:--|:--|:--|
| `isEnabled` | ✅ Bật/tắt extension | ❌ | ❌ | → `aladinn_voice_enabled` |
| `settings` | ✅ Language, theme | ❌ | ❌ | → `aladinn_voice_settings` |
| `geminiApiKey` | ✅ | ❌ | ❌ | → `aladinn_ai_apikey` (shared) |
| `autoSignModeActive` | ❌ | ❌ | ✅ | → `aladinn_sign_autoMode` |
| `userName`/`userId` | ❌ | ❌ | ✅ (sync) | → `aladinn_sign_user` |
| `appSettings` | ✅ | ❌ | ❌ | → `aladinn_voice_appSettings` |

### 3. 🟡 Xung đột CSS (Trung bình)

| Vấn đề | Chi tiết | Giải pháp |
|:--|:--|:--|
| Class names chung | `.his-checkbox`, `.room-info-display`, `.vitals-info-display` | Prefix: `.aladinn-sign-*`, `.aladinn-scan-*`, `.aladinn-voice-*` |
| ID trùng | `#his-mini-btn`, `#his-floating-panel` (HisPro) vs các ID khác | Prefix: `#aladinn-voice-*`, `#aladinn-sign-*` |
| Z-index wars | Mỗi project set z-index riêng | Tạo z-index scale thống nhất |

### 4. 🟢 Xung đột ít/không có

| Thuộc tính | Ghi chú |
|:--|:--|
| **Background workers** | Logic khác nhau hoàn toàn → gom vào 1 file, tách handler theo prefix |
| **Injected scripts** | Không trùng lặp → giữ nguyên, chỉ gom vào thư mục chung |
| **Commands** | Chỉ SignHis có → giữ nguyên |
| **Options pages** | Logic khác nhau → gom vào 1 trang Options với tabs |

---

## 🏗️ Kiến trúc Đề xuất cho Aladinn

```
Aladinn/
├── manifest.json                    # Manifest hợp nhất (MV3)
├── background/
│   ├── service-worker.js            # Entry point, import các handler
│   ├── ai-client.js                 # AI proxy (từ HisPro)
│   └── sign-handler.js              # Auto-sign logic (từ SignHis)
├── content/
│   ├── content.js                   # 🧞 Orchestrator chính
│   ├── shared/                      # Shared utilities
│   │   ├── constants.js
│   │   ├── utils.js
│   │   └── logger.js
│   ├── voice/                       # 🎙️ HisPro modules
│   │   ├── voice-init.js
│   │   ├── state.js
│   │   ├── storage.js
│   │   ├── ui.js
│   │   ├── speech.js
│   │   ├── bridge.js
│   │   ├── ai.js
│   │   └── autofill.js
│   ├── scanner/                     # 📊 Scanner modules
│   │   ├── scanner-init.js
│   │   ├── config.js, selectors.js, messaging.js
│   │   ├── menu-manager.js, row-observer.js, scan-flow.js
│   │   ├── storage.js, shortcuts.js, realtime.js
│   │   ├── dashboard.js, ui.js, integration.js
│   │   ├── export.js, settings.js, notification.js
│   │   ├── store.js, history.js, nutrition.js
│   │   └── ai/ (audit-logger, gemini-api, ui-injector)
│   └── sign/                        # ✍️ SignHis modules
│       ├── sign-init.js
│       ├── dom_constants.js, logger.js, utils.js
│       ├── ui.js, filter.js
│       ├── signing.js, smart_detection.js
│       └── (jQuery dependency)
├── injected/                        # Page-context scripts
│   ├── token-capture.js, ajax-interceptor.js
│   ├── grid-hook.js, api-bridge.js
│   └── page_inject.js
├── popup/
│   ├── popup.html/js/css            # Popup hợp nhất với tabs
├── options/
│   ├── options.html/js/css          # Options hợp nhất với tabs
│   └── pin-input.js
├── styles/
│   ├── aladinn-core.css             # CSS chung
│   ├── aladinn-voice.css
│   ├── aladinn-scanner.css
│   └── aladinn-sign.css
├── assets/icons/
├── lib/jquery.min.js
└── tests/
```

---

## 📋 Kế hoạch Thực hiện Chi tiết (8 Giai đoạn)

---

### 🔷 Giai đoạn 1: Nền tảng (Foundation)

**Mục tiêu:** Tạo skeleton project, manifest hợp nhất, background service worker thống nhất.

#### Ý tưởng thực thi:
1. Tạo cấu trúc thư mục theo kiến trúc đề xuất
2. Viết [manifest.json](file:///Users/trunganh/CNTT/Aladinn/manifest.json) hợp nhất với tất cả permissions, commands, content scripts
3. Viết [background/service-worker.js](file:///Users/trunganh/CNTT/Aladinn/background/service-worker.js) gom logic từ cả 3 background scripts
4. Tạo `content/shared/` với utilities dùng chung
5. Tạo `content/content.js` orchestrator với feature flag check

#### Bảng theo dõi:

| # | Bước | Trạng thái | Ghi chú |
|:--|:--|:--|:--|
| 1.1 | Tạo folder structure | ⬜ Chưa | |
| 1.2 | Viết manifest.json hợp nhất | ⬜ Chưa | |
| 1.3 | Viết background/service-worker.js | ⬜ Chưa | |
| 1.4 | Copy + refactor ai-client.js | ⬜ Chưa | |
| 1.5 | Tạo sign-handler.js từ SignHis SW | ⬜ Chưa | |
| 1.6 | Viết content/shared modules | ⬜ Chưa | |
| 1.7 | Viết content/content.js orchestrator | ⬜ Chưa | |
| 1.8 | Tạo CSS foundation (z-index, vars) | ⬜ Chưa | |

**Definition of Done (GĐ1):**
- Extension load được trên `chrome://extensions` không báo lỗi manifest/runtime.
- `window.Aladinn` được khởi tạo đúng namespace gốc và không pollute global ngoài namespace.
- Service worker nhận và route được ít nhất 1 message mẫu cho mỗi module.

---

### 🔷 Giai đoạn 2: Tích hợp Scanner (VNPT_HIS_Scanner_v3)

**Mục tiêu:** Di chuyển toàn bộ Scanner modules vào `content/scanner/`, cập nhật namespace.

#### Ý tưởng thực thi:
1. Copy 19 module files + AI subfolder vào `content/scanner/`
2. Đổi namespace `window.VNPT*` → `window.Aladinn.Scanner.*`
3. Tạo `scanner-init.js` entry point
4. Copy 4 injected scripts + iframe helpers
5. Refactor CSS với prefix `aladinn-scan-*`

#### Bảng theo dõi:

| # | Bước | Trạng thái | Ghi chú |
|:--|:--|:--|:--|
| 2.1 | Copy modules vào content/scanner/ | ⬜ Chưa | 19 files + AI folder |
| 2.2 | Rename namespace VNPT* → Aladinn.Scanner.* | ⬜ Chưa | |
| 2.3 | Tạo scanner-init.js | ⬜ Chưa | |
| 2.4 | Copy injected scripts + iframe helpers | ⬜ Chưa | 6 files |
| 2.5 | Refactor CSS (prefix selectors) | ⬜ Chưa | |
| 2.6 | Test Scanner module độc lập | ⬜ Chưa | |

**Definition of Done (GĐ2):**
- Scanner chạy độc lập khi `aladinn_features.scanner=true` và im lặng hoàn toàn khi tắt.
- Không còn `window.VNPT*` trên global scope.
- Tất cả selector CSS Scanner đã có prefix `aladinn-scan-*` hoặc nằm trong root container có prefix.

---

### 🔷 Giai đoạn 3: Tích hợp Voice Assistant (HisPro)

**Mục tiêu:** Di chuyển HisPro modules vào `content/voice/`, bọc namespace.

#### Ý tưởng thực thi:
1. Copy 9 module files vào `content/voice/`
2. Bọc globals vào `window.Aladinn.Voice.*`
3. Tạo `voice-init.js` entry point
4. Refactor CSS, storage keys, message types

#### Bảng theo dõi:

| # | Bước | Trạng thái | Ghi chú |
|:--|:--|:--|:--|
| 3.1 | Copy modules vào content/voice/ | ⬜ Chưa | 9 files |
| 3.2 | Bọc globals vào Aladinn.Voice namespace | ⬜ Chưa | |
| 3.3 | Tạo voice-init.js | ⬜ Chưa | |
| 3.4 | Refactor CSS (prefix selectors) | ⬜ Chưa | |
| 3.5 | Cập nhật storage keys + message types | ⬜ Chưa | |
| 3.6 | Test Voice module độc lập | ⬜ Chưa | |

**Definition of Done (GĐ3):**
- Voice hoạt động đầy đủ khi bật feature flag; không làm thay đổi hành vi Scanner/Sign.
- Không còn global function rời rạc của HisPro.
- Key cũ của Voice được migrate sang key mới thành công 1 lần duy nhất.

---

### 🔷 Giai đoạn 4: Tích hợp SignHis

**Mục tiêu:** Di chuyển SignHis modules vào `content/sign/`, cập nhật namespace.

#### Ý tưởng thực thi:
1. Copy 7 module files vào `content/sign/`
2. Đổi namespace `window.UI/Signing/Filter` → `window.Aladinn.Sign.*`
3. Tạo `sign-init.js`, xử lý jQuery dependency
4. Copy `page_inject.js`, refactor CSS

#### Bảng theo dõi:

| # | Bước | Trạng thái | Ghi chú |
|:--|:--|:--|:--|
| 4.1 | Copy modules vào content/sign/ | ⬜ Chưa | 7 files |
| 4.2 | Rename namespace → Aladinn.Sign.* | ⬜ Chưa | |
| 4.3 | Tạo sign-init.js | ⬜ Chưa | |
| 4.4 | Copy page_inject.js + jQuery | ⬜ Chưa | |
| 4.5 | Refactor CSS + storage keys | ⬜ Chưa | |
| 4.6 | Test Sign module độc lập | ⬜ Chưa | |

**Definition of Done (GĐ4):**
- Sign module ký tự động và keyboard shortcuts hoạt động đúng.
- jQuery chạy ở `noConflict` mode, không ghi đè `$` của trang HIS.
- Không còn `window.UI/window.Signing/window.Filter` ở global cũ.

---

### 🔷 Giai đoạn 5: UI Thống nhất

**Mục tiêu:** Tạo Popup và Options hợp nhất, Feature Toggle system.

#### Ý tưởng thực thi:

**Popup hợp nhất:** Header Aladinn 🧞 → 3 Tabs (Scanner | Voice | Sign) → Footer Options

**Options hợp nhất:** General | Voice (API Key, PIN) | Scanner (Hospital settings) | Sign (Creator, Speed) | Advanced

**Feature Toggles:** `aladinn_features: { voice, scanner, sign }` — bật/tắt từ popup

#### Bảng theo dõi:

| # | Bước | Trạng thái | Ghi chú |
|:--|:--|:--|:--|
| 5.1 | Thiết kế + code Popup | ⬜ Chưa | |
| 5.2 | Thiết kế + code Options | ⬜ Chưa | |
| 5.3 | Feature toggle system | ⬜ Chưa | |
| 5.4 | Icons & branding Aladinn | ⬜ Chưa | |
| 5.5 | Test UI hoàn chỉnh | ⬜ Chưa | |

**Definition of Done (GĐ5):**
- Popup/Options đọc-ghi đúng toàn bộ settings của 3 module.
- Toggle bật/tắt module có hiệu lực ngay (không cần reload toàn trình duyệt).
- Có guard chống trạng thái lỗi nửa chừng (ví dụ toggle bật nhưng init fail).

---

### 🔷 Giai đoạn 6: Kiểm thử & Đóng gói

**Mục tiêu:** Test toàn bộ, sửa lỗi, tạo bản release v1.0.0.

#### Bảng theo dõi:

| # | Bước | Trạng thái | Ghi chú |
|:--|:--|:--|:--|
| 6.1 | Migrate existing tests | ⬜ Chưa | |
| 6.2 | Integration test (load extension) | ⬜ Chưa | Manual |
| 6.3 | Functional test all 3 modules | ⬜ Chưa | Manual trên HIS |
| 6.4 | Feature toggle test | ⬜ Chưa | |
| 6.5 | Performance check | ⬜ Chưa | |
| 6.6 | README + CHANGELOG | ⬜ Chưa | |
| 6.7 | Đóng gói ZIP v1.0.0 | ⬜ Chưa | |

---

### 🔷 Giai đoạn 7: Hardening & Release Candidate

**Mục tiêu:** Khóa chất lượng trước khi phát hành, đảm bảo có phương án rollback an toàn trên HIS production.

#### Ý tưởng thực thi:
1. Chuẩn hóa logging theo prefix `[ALADINN][VOICE|SCAN|SIGN|BG]`
2. Bổ sung migration guard (`schema_version`) + rollback migration path
3. Viết smoke test checklist cho từng bệnh viện/site đang dùng
4. Chạy kiểm thử tương thích Chrome versions mục tiêu
5. Thực hiện release candidate `v1.0.0-rc.1`
6. Theo dõi lỗi thực tế 24-48h, tổng hợp telemetry thủ công
7. Chốt phát hành `v1.0.0`

#### Bảng theo dõi:

| # | Bước | Trạng thái | Ghi chú |
|:--|:--|:--|:--|
| 7.1 | Chuẩn hóa log format | ⬜ Chưa | Prefix + level |
| 7.2 | Thêm migration guard + rollback path | ⬜ Chưa | schema_version |
| 7.3 | Viết smoke checklist theo site | ⬜ Chưa | |
| 7.4 | Test tương thích Chrome | ⬜ Chưa | |
| 7.5 | Build v1.0.0-rc.1 | ⬜ Chưa | |
| 7.6 | Theo dõi lỗi 24-48h | ⬜ Chưa | |
| 7.7 | Go/No-Go quyết định phát hành | ⬜ Chưa | |

**Definition of Done (GĐ7):**
- Không còn bug blocker/P0/P1 mở.
- Đã chạy hết smoke checklist trên site thật.
- Có file release note + rollback note cho bản phát hành.

---

### 🔷 Giai đoạn 8: Tối ưu hiệu năng & Sửa lỗi UX

**Mục tiêu:** Cải thiện tốc độ phản hồi của UI và sửa lỗi treo hiệu ứng mờ (unfade bug).

#### Ý tưởng thực thi:
1. **Thay thế JS Particles bằng CSS Aura:** Loại bỏ việc tạo hàng chục thẻ `div` bằng Javascript để làm bụi tiên. Thay vào đó sử dụng `box-shadow` đa tầng và `::before/::after` pseudo-elements.
2. **Chuyển đổi sang CSS Hover:** Sử dụng thuần `:hover` trong CSS để điều khiển độ mờ (opacity) và độ nhòe (filter: blur). Việc này giúp trình duyệt tự tối ưu hóa layer mà không cần chạy JS liên tục.
3. **Hardware Acceleration:** Thêm thuộc tính `will-change` để ép trình duyệt xử lý hiệu ứng bằng GPU, tránh gây lag cho trang HIS gốc.
4. **Sửa lỗi Unfade:** Đảm bảo `pointer-events` luôn hoạt động kể cả khi panel đang mờ ảo để người dùng có thể tương tác lại ngay lập tức.

#### Bảng theo dõi:

| # | Bước | Trạng thái | Ghi chú |
|:--|:--|:--|:--|
| 8.1 | Loại bỏ createDreamyParticles (JS) | ⬜ Chưa | |
| 8.2 | Triển khai hiệu ứng "Nhập định" bằng CSS thuần | ⬜ Chưa | Sử dụng ::before glow |
| 8.3 | Sửa lỗi tương tác (Pointer-events) | ⬜ Chưa | |
| 8.4 | Kiểm tra hiệu năng tải trang (Reflow/Repaint) | ⬜ Chưa | |

**Definition of Done (GĐ8):**
- Lỗi unfade không tái hiện sau 3 vòng kiểm thử liên tiếp.
- Panel animation không làm drop FPS rõ rệt trên máy cấu hình trung bình.
- Lighthouse/DevTools Performance ghi nhận giảm reflow/repaint so với baseline trước tối ưu.

---

---

## 📈 Roadmap Nâng cấp

| Ưu tiên | Tính năng | Ghi chú |
|:--|:--|:--|
| 🔴 P0 | Hợp nhất 3 extension cơ bản + Feature toggle | Giai đoạn 1-7 |
| 🟡 P1 | Shared AI service (Gemini) giữa Voice và Scanner | Cả 2 dùng Gemini API |
| 🟢 P2 | Cross-module data sharing (Scanner vitals → Voice auto-fill) | |
| 🔵 P3 | Dark/Light theme toàn extension, Dashboard tổng hợp | |
| ⚪ P4 | Auto-update, Multi-hospital profile | |

---

## ⚡ Risk Assessment

| Rủi ro | Mức độ | Giải pháp |
|:--|:--|:--|
| CSS xung đột khi 3 module cùng inject | 🟡 | Prefix class/id, z-index scale thống nhất |
| MutationObserver chồng chéo | 🟡 | Mỗi module chỉ observe phạm vi cần thiết |
| Storage key collision | 🔴 | Prefix keys, migration script |
| jQuery conflict | 🟢 | Load trước sign modules, noConflict mode |
| Refined Typing Logic | 🟡 | - Current logic: Paste full name, then backspace, then re-type last char. <br> - New logic (per user suggestion): Paste name minus last char, then type the last char. <br> - Improve wait logic: Ensure we wait for the grid to be "ready" after typing before scanning. |
| Improved Workflow | 🟡 | - Case 1 (Zero matches): Ensure the modal closes immediately if no rows matching the creator are found. <br> - Case 2 (Matches found): <br> &nbsp;&nbsp;&nbsp;&nbsp;- Auto-sign visible rows if enabled. <br> &nbsp;&nbsp;&nbsp;&nbsp;- After a row is signed, re-check the grid. Only close once all matching rows are gone. |
| Content script load order | 🟡 | Shared modules load trước |
| Performance (3 module cùng chạy) | 🟡 | Feature toggle, lazy init |
| Background message routing | 🟢 | Prefix message types |
| Migration lỗi làm mất cấu hình user cũ | 🔴 | `schema_version`, migrate idempotent, backup key cũ trước khi ghi |
| Tắt module không triệt để gây side effects | 🟡 | Chuẩn hóa `dispose()` cho từng module |

---

## 🧩 Kế hoạch Migration Storage (Bắt buộc)

### Chiến lược
1. Dùng key `aladinn_schema_version` để kiểm soát migration một chiều.
2. Migration chạy trong background khi `onInstalled` và khi service worker khởi động lần đầu.
3. Mỗi bước migration phải idempotent: chạy lại không gây sai dữ liệu.
4. Backup key cũ vào namespace `aladinn_legacy_backup_*` trước khi ghi key mới.

### Mapping key quan trọng

| Key cũ | Key mới | Ghi chú |
|:--|:--|:--|
| `isEnabled` | `aladinn_voice_enabled` | Voice toggle |
| `settings` | `aladinn_voice_settings` | Voice settings |
| `geminiApiKey` | `aladinn_ai_apikey` | Shared cho Voice + Scanner |
| `appSettings` | `aladinn_voice_appSettings` | Voice app config |
| `autoSignModeActive` | `aladinn_sign_autoMode` | Sign mode |
| `userName` + `userId` | `aladinn_sign_user` | Gộp object |

### Phiên bản migration đề xuất
- `v1`: đổi tên key và tách namespace module.
- `v2`: hợp nhất AI key dùng chung + cleanup key không dùng.

---

## 🔌 Message Contract Chuẩn hóa

### Nguyên tắc
- Tất cả message theo format:
  - `type`: `ALADINN_<MODULE>_<ACTION>`
  - `requestId`: UUID ngắn để trace log
  - `source`: `voice|scanner|sign|popup|options|background|injected`
  - `payload`: object
- Response chuẩn:
  - `ok: true|false`
  - `data` hoặc `error: { code, message }`

### Prefix bắt buộc
- Voice: `ALADINN_VOICE_*`
- Scanner: `ALADINN_SCANNER_*`
- Sign: `ALADINN_SIGN_*`
- Shared/background: `ALADINN_CORE_*`

---

## 🎯 Performance Budget (SLO)

| Metric | Ngưỡng mục tiêu | Mức chặn release |
|:--|:--|:--|
| Content script init (mỗi module) | < 300ms | > 600ms |
| Tổng init khi bật cả 3 modules | < 900ms | > 1500ms |
| RAM tăng thêm sau init | < 80MB | > 150MB |
| Long task > 50ms trong 1 phút đầu | < 5 lần | > 15 lần |
| UI interaction delay (panel/toggle) | < 100ms | > 250ms |

---

## 🚨 Rollback & Kill-Switch Plan

1. Tạo key `aladinn_killswitch` trong `chrome.storage.sync`.
2. Khi `killswitch=true`, `content/content.js` chỉ log cảnh báo và không init module nào.
3. Killswitch theo module:
   - `aladinn_features.voice=false`
   - `aladinn_features.scanner=false`
   - `aladinn_features.sign=false`
4. Quy trình rollback:
   - Bước 1: tắt module lỗi qua feature flag.
   - Bước 2: nếu lỗi lan rộng, bật `killswitch=true`.
   - Bước 3: phát hành hotfix patch version.
5. Luôn giữ bản ZIP ổn định gần nhất để cài lại thủ công khi cần.

---

## ✅ Exit Criteria Cho v1.0.0

- Hoàn thành DoD từ GĐ1 đến GĐ7.
- Không còn bug P0/P1; bug P2 có workaround rõ ràng.
- Pass đầy đủ `Verification Plan` (automated + manual).
- Đã test thực địa trên `*.vncare.vn` với ít nhất 1 ca sử dụng thật cho mỗi module.
- Có README vận hành và CHANGELOG phát hành.

---

## Verification Plan

### Automated Tests
- Migrate tests từ `Bản sao VNPT_HIS_Scanner_v3/tests/` và `Bản sao sign/tests/`
- Chạy: `cd /Users/trunganh/CNTT/Aladinn && npm test`

### Manual Verification
1. Load Extension trên `chrome://extensions/` → Không lỗi
2. Console check → 3 module init logs xuất hiện
3. Feature Toggle → Tắt 1 module → 2 module kia vẫn hoạt động
4. Test từng chức năng chính trên trang HIS thật
5. Test migration: cài từ dữ liệu cũ -> không mất config
6. Test rollback: bật killswitch -> tất cả module dừng an toàn

> [!IMPORTANT]
> Extension thao tác trực tiếp trên HIS production, test thủ công trên trang HIS thật là **bắt buộc**. Xác nhận bạn có thể test trên `*.vncare.vn`.

---

*Kế hoạch bởi 🧞 Aladinn AI Assistant — 2026-03-11*
