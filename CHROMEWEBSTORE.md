# Chrome Web Store Listing — Aladinn

> Last Updated: 2026-06-06

## Store Listing

**Extension Name** [REQUIRED]
Aladinn

**Short Description** [REQUIRED]
<!-- Max 132 characters -->
Trợ lý AI cho hệ thống HIS: Nhập liệu giọng nói, quét dữ liệu lâm sàng, cảnh báo CDS, ký số tự động

**Detailed Description** [REQUIRED]
Aladinn là tiện ích mở rộng hỗ trợ y bác sĩ sử dụng hệ thống VNPT HIS (vncare.vn) với các tính năng AI và tự động hóa quy trình lâm sàng.

TÍNH NĂNG CHÍNH
• Nhập liệu giọng nói AI — Đọc thông tin khám bệnh bằng giọng nói tiếng Việt, AI tự động chuyển thành hồ sơ bệnh án có cấu trúc (lý do vào viện, bệnh sử, khám lâm sàng, sinh hiệu, chẩn đoán ICD-10)
• Quét dữ liệu lâm sàng — Tự động quét và tổng hợp dữ liệu từ lưới điều trị VNPT HIS: xét nghiệm, thuốc, sinh hiệu, dinh dưỡng, tình trạng xuất viện
• Tóm tắt lâm sàng AI — Tổng hợp diễn biến điều trị nhiều ngày thành bản tóm tắt chuyên khoa bằng Gemini AI
• Hỗ trợ quyết định lâm sàng (CDS) — Cảnh báo tương tác thuốc, liều bất thường, và các vấn đề an toàn thuốc theo dữ liệu cục bộ
• Ký số tự động — Hỗ trợ quy trình ký số hàng loạt trên VNPT HIS với xác nhận từng bước và nút dừng khẩn cấp
• Phím tắt — Ctrl+Shift+F lọc hồ sơ, Ctrl+Shift+S bắt đầu ký, Ctrl+Shift+N bệnh nhân tiếp theo

CÁCH SỬ DỤNG
1. Cài đặt tiện ích từ Chrome Web Store
2. Mở trang VNPT HIS (vncare.vn) và đăng nhập
3. Nhấn vào biểu tượng Aladinn trên thanh công cụ để mở Side Panel
4. Vào Cài đặt (Options) để nhập API Key Gemini và thiết lập mã PIN bảo mật
5. Bật/tắt các module (Giọng nói, Quét, CDS, Ký số) tùy nhu cầu

BẢO MẬT & QUYỀN RIÊNG TƯ
• API Key được mã hóa AES-GCM 256-bit trên thiết bị, bảo vệ bằng mã PIN cá nhân
• Dữ liệu bệnh nhân được khử định danh (PHI Redaction) trước khi gửi lên AI
• Tự động xóa bộ nhớ đệm khi đăng xuất HIS hoặc sau 15 phút không hoạt động
• Không thu thập analytics, không tracking, không chia sẻ dữ liệu với bên thứ ba
• Tuân thủ Luật Bảo vệ Dữ liệu Cá nhân 2025 và Luật Khám bệnh Chữa bệnh 2023

QUYỀN TRUY CẬP
• "Đọc và thay đổi dữ liệu trên vncare.vn" — Cần thiết để quét dữ liệu lâm sàng từ lưới điều trị và tự động điền hồ sơ bệnh án
• Tiện ích chỉ hoạt động trên trang web VNPT HIS (vncare.vn), không can thiệp vào bất kỳ trang web nào khác

HỖ TRỢ
Phát hiện lỗi? Có góp ý? Liên hệ qua email hoặc mở issue tại GitHub repository.

Phiên bản 2.1.2 — Xem chi tiết tại CHANGELOG.

**Category** [REQUIRED]
Productivity

**Single Purpose** [REQUIRED]
Assists clinicians using VNPT HIS with voice-powered data entry, clinical data scanning, decision support alerts, and digital signing workflows

**Primary Language** [REQUIRED]
Vietnamese


## Graphics & Assets

| Asset | Dimensions | Status | Filename |
|-------|-----------|--------|----------|
| Store Icon [REQUIRED] | 128×128 PNG | ✅ Ready | `assets/icons/icon128.png` |
| Screenshot 1 [REQUIRED] | 1280×800 or 640×400 | ⬜ Not created | `store-assets/screenshot-sidepanel.png` |
| Screenshot 2 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | `store-assets/screenshot-scanner.png` |
| Screenshot 3 [RECOMMENDED] | 1280×800 or 640×400 | ⬜ Not created | `store-assets/screenshot-voice.png` |
| Screenshot 4 | 1280×800 or 640×400 | ⬜ Not created | `store-assets/screenshot-cds.png` |
| Small Promo Tile [RECOMMENDED] | 440×280 | ⬜ Not created | `store-assets/promo-tile.png` |

### Screenshot Notes
1. **Screenshot 1 (Side Panel)**: Chụp Aladinn Side Panel mở bên cạnh trang VNPT HIS đang hiển thị danh sách bệnh nhân. Blur/redact tên bệnh nhân.
2. **Screenshot 2 (Scanner)**: Chụp Scanner Dashboard overlay đang hiển thị dữ liệu lâm sàng tổng hợp (xét nghiệm, thuốc). Blur PHI.
3. **Screenshot 3 (Voice)**: Chụp giao diện nhập liệu giọng nói đang hiển thị kết quả AI (JSON → form fields). Dùng dữ liệu mẫu.
4. **Screenshot 4 (CDS)**: Chụp cảnh báo tương tác thuốc CDS đang hiển thị trên trang HIS.


## Permissions Justification

| Permission | Type | Justification |
|------------|------|---------------|
| `activeTab` | permissions | Inject clinical data scanner UI and voice assistant controls into the active VNPT HIS tab when the user clicks the extension icon or uses a keyboard shortcut. Required for one-time script injection triggered by user gesture. |
| `alarms` | permissions | Schedule periodic checks for extension updates from GitHub Releases (every 4 hours) and refresh remote safe-mode configuration. Uses chrome.alarms instead of setTimeout for service worker compatibility. |
| `scripting` | permissions | Execute scripts in VNPT HIS iframes to auto-click confirmation dialogs during the digital signing workflow and read clinical data from treatment grids. All injections are scoped to vncare.vn only. |
| `storage` | permissions | Store user preferences (voice language, feature toggles, selected AI model), encrypted Gemini API key (AES-GCM 256-bit with user PIN), local audit logs (no PHI, auto-purged after 7 days), and CDS drug interaction rule cache. |
| `tabs` | permissions | Read active tab URL to verify it belongs to *.vncare.vn before injecting content scripts. Relay keyboard shortcut commands (filter, sign, next patient) to the correct VNPT HIS tab. Track tab switches for PDF preview auto-return during signing workflow. |
| `sidePanel` | permissions | Display the Aladinn assistant panel alongside VNPT HIS for voice input controls, clinical scanning dashboard, CDS alert history, and settings — without covering or obscuring the medical record being viewed by the clinician. |
| `https://*.vncare.vn/*` | host_permissions | Content scripts interact with the VNPT HIS web application (vncare.vn) to: (1) scan clinical data from treatment grids and iframes, (2) auto-fill medical form fields with voice-transcribed data, (3) manage the digital signing workflow by detecting confirmation dialogs, (4) observe patient context changes for CDS alert triggers. |
| `https://generativelanguage.googleapis.com/*` | host_permissions | Send de-identified (PHI-redacted) clinical text to Google Gemini API for: (1) voice-to-structured-data conversion (speech → medical record JSON), (2) clinical history summarization across multiple treatment days, (3) AI-powered clinical scanning analysis. The API key is user-provided and encrypted locally. |
| `https://raw.githubusercontent.com/fantasy-1608/Aladinn/*` | host_permissions | Fetch remote configuration file (remote-config.json) for safe-mode and kill-switch functionality. Also used as fallback for update.json to check for new extension versions. No user data is sent in these requests. |
| `https://api.github.com/repos/fantasy-1608/Aladinn/*` | host_permissions | Check GitHub Releases API for new extension versions. When a newer version is available, the extension displays an update notification badge. No user data is transmitted — only reads public release metadata. |


## Privacy & Data Use

### Data Collection

**Does the extension collect user data?** Yes

| Data Type | Collected? | Transmitted Off-Device? | Purpose | Shared with Third Parties? |
|-----------|-----------|------------------------|---------|---------------------------|
| Personally identifiable info | No | No | — | No |
| Health info | Yes (transient, de-identified) | Yes (de-identified only, to Google Gemini) | Voice-to-text conversion and clinical summarization. Raw PHI is redacted locally before transmission. | No (Google Gemini processes de-identified text only) |
| Financial info | No | No | — | No |
| Authentication info | Yes (encrypted API key) | No | User's Gemini API key is encrypted with AES-GCM 256-bit and stored locally. Never transmitted. | No |
| Personal communications | No | No | — | No |
| Location | No | No | — | No |
| Web history | No | No | — | No |
| User activity | Yes (local counters) | No | Local-only audit telemetry: event counts (scanner opened, AI requests made) with no PHI. Auto-purged after 7 days. Used for pilot evaluation metrics. | No |
| Website content | Yes (VNPT HIS clinical data, transient) | Yes (de-identified only, to Google Gemini) | Clinical text from VNPT HIS is read for scanning/summarization. PHI is stripped before any external transmission. Data is held in memory only and purged on logout or timeout. | No |

### Data Use Certification
- [x] Data is NOT sold to third parties
- [x] Data is NOT used for purposes unrelated to the extension's core functionality
- [x] Data is NOT used for creditworthiness or lending purposes


## Privacy Policy

**Privacy Policy URL** [REQUIRED]
<!-- TODO: Replace with actual hosted URL after deploying to GitHub Pages -->
https://fantasy-1608.github.io/Aladinn/privacy-policy

<!-- See docs/privacy-policy.md for the full policy text -->


## Distribution

**Visibility**: Unlisted
**Regions**: All regions
**Pricing**: Free


## Developer Info

**Publisher Name** [REQUIRED]
<!-- TODO: Fill in your name or organization -->
Huỳnh Trung Anh

**Contact Email** [REQUIRED]
<!-- TODO: Fill in a monitored email address -->
trunganh1608@gmail.com

**Support URL / Email** [RECOMMENDED]
https://github.com/fantasy-1608/Aladinn/issues

**Homepage URL** [RECOMMENDED]
https://github.com/fantasy-1608/Aladinn


## Version History

| Version | Date | Changes | Status |
|---------|------|---------|--------|
| 2.1.2 | 2026-06-06 | Initial Chrome Web Store submission. All features: voice AI input, clinical scanner, CDS alerts, auto-sign, side panel, keyboard shortcuts, self-update, remote config safe mode, PHI redaction, PIN-encrypted API key. | Draft |

## Review Notes

### Known Issues / Limitations
- Extension only works on VNPT HIS (*.vncare.vn) — does not affect other websites
- Self-update checker (GitHub Releases) is automatically disabled when installed from Chrome Web Store (CWS auto-updates instead)
- AI features require user to provide their own Google Gemini API key
- chrome.storage.sync is used for non-sensitive settings only (creator name for signing filter, signing session counters). No PHI is stored in sync storage.

### Rejection History
<!-- None yet -->
