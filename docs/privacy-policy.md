# Privacy Policy for Aladinn

Last updated: June 6, 2026

---

## Overview

Aladinn is a Chrome browser extension that assists healthcare clinicians using the VNPT HIS (Hospital Information System) platform at vncare.vn. It provides voice-powered data entry, clinical data scanning, clinical decision support (CDS) alerts, and digital signing workflow assistance.

This privacy policy describes how Aladinn collects, uses, stores, and protects your data.

---

## What Data We Collect

### 1. User Preferences (Stored Locally)
- Voice input settings (language, auto-process toggle, theme)
- Feature toggles (which modules are enabled: voice, scanner, CDS, sign)
- Selected AI model preference
- Creator name for signing workflow filter

**Storage**: `chrome.storage.local` (on your device only) and `chrome.storage.sync` (synced across your Chrome profile for non-sensitive settings like creator name and signing session counters).

### 2. Encrypted API Key (Stored Locally)
- Your Google Gemini API key is encrypted using AES-GCM 256-bit encryption with a PIN-derived key (PBKDF2, 310,000 iterations, SHA-256)
- The plaintext API key is **never** stored on disk — only the encrypted ciphertext
- The decryption key exists only in RAM during your active session and is purged after 15 minutes of inactivity or on HIS logout

**Storage**: `chrome.storage.local` (encrypted ciphertext only). Never transmitted off-device.

### 3. Clinical Data (Transient, In-Memory)
- When you use the clinical scanner or voice input features, Aladinn reads clinical data from the VNPT HIS web page (treatment grids, form fields, lab results)
- This data is held **in memory only** for processing and display
- Data is purged when you navigate away, log out of HIS, or after 15 minutes of inactivity

### 4. Audit Logs (Stored Locally, No PHI)
- Aladinn maintains local-only usage counters: number of scanner opens, AI requests, signing sessions, CDS alerts
- These logs contain **no patient identifiers** — only event names, timestamps, and counts
- Logs are automatically purged after 7 days and capped at 500 entries

**Storage**: `chrome.storage.local`. Never transmitted off-device.

---

## Data Transmitted Off-Device

### Google Gemini API
When you use voice input or AI-powered clinical summarization, Aladinn sends clinical text to the Google Gemini API for processing. **Before any transmission:**

1. All Protected Health Information (PHI) is automatically redacted locally using the built-in PHI Redactor:
   - Patient names are replaced with `[TÊN_BN]`
   - Phone numbers, ID card numbers, insurance numbers, and addresses are masked
   - Clinical data (diagnoses, lab results, medications) is preserved for AI analysis

2. If PHI is detected after redaction, the request is **blocked entirely** and an audit log entry is created

3. The API key used for authentication is your own personal Gemini API key — Aladinn does not use a shared or centralized API key

**Google's privacy policy for Gemini API**: https://ai.google.dev/gemini-api/terms

### GitHub (Update Checks)
Aladinn periodically checks for new versions via the GitHub Releases API and fetches a remote configuration file for safe-mode functionality. **No user data is sent** in these requests — only standard HTTP headers.

---

## Data NOT Collected

Aladinn does **NOT** collect:
- Browsing history
- Personal communications
- Location data
- Financial information
- Analytics or telemetry sent to external servers
- Cookies or tracking identifiers
- Data from any website other than vncare.vn

---

## Data Sharing

Aladinn does **NOT** share your data with any third parties. Specifically:

- Data is **NOT** sold to third parties
- Data is **NOT** used for advertising or profiling
- Data is **NOT** used for creditworthiness or lending purposes
- Data is **NOT** transmitted to any server other than Google Gemini API (for AI features) and GitHub (for update checks)
- Google Gemini receives **only de-identified clinical text** — never raw patient data

---

## Data Retention and Deletion

| Data Type | Retention | How to Delete |
|-----------|-----------|---------------|
| User preferences | Until you change them or uninstall | Extension Options page or uninstall |
| Encrypted API key | Until you clear it or uninstall | Extension Options page → Clear API Key |
| In-memory clinical data | Purged on logout, navigation, or 15-min idle | Automatic |
| Audit logs | Auto-purged after 7 days (max 500 entries) | Extension Options page → Clear Logs |
| chrome.storage.sync data | Until you clear Chrome sync data | Chrome Settings → Sync → Clear Data |

When you uninstall Aladinn, all locally stored data is automatically removed by Chrome.

---

## Security Measures

1. **Encryption**: API keys are encrypted with AES-GCM 256-bit, derived from your PIN via PBKDF2 (310,000 iterations)
2. **Session Timeout**: Decryption keys in RAM are automatically purged after 15 minutes of inactivity
3. **Logout Detection**: When HIS logout is detected, all cached patient data and session keys are immediately purged
4. **PHI Redaction**: All clinical text is automatically de-identified before external AI API calls
5. **Sender Validation**: All internal messages are validated against the extension's own ID and trusted domains
6. **Domain Restriction**: Content scripts only execute on *.vncare.vn — no other websites are affected

---

## Compliance

Aladinn is designed to comply with:
- **Vietnam Personal Data Protection Law 2025** (Luật BVDLCN 91/2025/QH15) — Medical data classified as sensitive, requiring explicit consent
- **Vietnam Medical Examination and Treatment Law 2023** (Luật KB-CB 15/2023/QH15) — Medical record confidentiality and patient rights
- **Decree 102/2025** — National health database, HL7 FHIR compliance
- **Circular 13/2025/TT-BYT** — Electronic medical records, digital signatures

---

## Changes to This Policy

If we make material changes to this privacy policy, we will update the "Last updated" date at the top. For significant changes, we will notify users through the extension's update notification system.

---

## Contact

For privacy inquiries, questions, or concerns:

- **GitHub Issues**: https://github.com/fantasy-1608/Aladinn/issues
- **Author**: Huỳnh Trung Anh

---

# Chính Sách Quyền Riêng Tư — Aladinn (Tiếng Việt)

Cập nhật lần cuối: 06/06/2026

## Tóm tắt

Aladinn là tiện ích mở rộng Chrome hỗ trợ y bác sĩ sử dụng VNPT HIS. Aladinn **KHÔNG** thu thập analytics, tracking, hay chia sẻ dữ liệu cá nhân. Dữ liệu lâm sàng chỉ được xử lý tạm thời trong bộ nhớ và được khử định danh (PHI Redaction) trước khi gửi lên AI.

## Dữ liệu được lưu trữ
- Cài đặt người dùng (ngôn ngữ, tính năng bật/tắt) — lưu cục bộ
- API Key Gemini — mã hóa AES-GCM 256-bit, không bao giờ gửi đi
- Nhật ký kiểm tra (số lần sử dụng, không chứa thông tin bệnh nhân) — tự xóa sau 7 ngày

## Dữ liệu gửi đi
- Văn bản lâm sàng **đã khử định danh** → Google Gemini API (để phân tích AI)
- Kiểm tra cập nhật → GitHub API (không gửi dữ liệu người dùng)

## Cam kết
- KHÔNG bán dữ liệu cho bên thứ ba
- KHÔNG thu thập dữ liệu duyệt web, vị trí, tài chính
- KHÔNG lưu thông tin định danh bệnh nhân
- Tuân thủ Luật BVDLCN 2025 và Luật KB-CB 2023
