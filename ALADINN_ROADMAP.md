# ALADINN PROJECT ROADMAP & CDS SPECIFICATION v1.0
*Tài liệu Định hướng Phát triển & Kiến trúc (Dành cho Dev & AI Agent)*
**Cập nhật:** 29/03/2026

Dự án Aladinn đang trong quá trình chuyển mình từ một "Tiện ích mở rộng nhập liệu (Extension)" thành một **Lớp Hỗ trợ Quyết định Lâm Sàng (Clinical Decision Support Layer - CDS)** hoạt động độc lập và phủ lên trên hệ thống VNPT HIS.

---

## I. HIỆN TRẠNG DỰ ÁN (TIẾN ĐỘ)

### ✅ LÀM XONG (Hoàn thiện & Ổn định)
1. **Core Extension & Security:**
   - Hoàn thiện build pipeline Vite/CRXJS cho Manifest V3.
   - Trích xuất token JWT/Session an toàn, bảo mật AES-GCM cho API Key.
2. **Scanner Module (Smart Scanner):**
   - Quét dữ liệu đồng loạt từ lưới bệnh nhân (Phòng/Giường, Sinh hiệu).
   - Sync dữ liệu thông qua hidden IFrames (History, Nutrition).
3. **Voice AI Module:**
   - Module nhận diện giọng nói (Speech-to-Text) tích hợp AI (Gemini Flash).
   - Tự động điền (Auto-fill) vào các text area trên HIS.
4. **Ký số tự động (Auto-Sign):**
   - Click ký số hàng loạt qua API Bridge Bypass.
5. **UI/UX Cơ bản:**
   - Tooltip, Modal Cài đặt, Cảnh báo trực quan (Toast Notification).

### ⏳ ĐANG LÀM (In Progress)
1. **Clinical Dashboard (Side Panel):**
   - Giao diện Side panel (320px) gắn ở mép phải màn hình để hiển thị cảnh báo lâm sàng mà không che khuất HIS.
2. **Tích hợp rule engine (Checkmap):**
   - Chuyển đổi module `checkmap` hiện tại (dùng IndexedDB) sát nhập vào lõi nội bộ của Aladinn.
3. **Real-time DOM Observer:**
   - Lắng nghe sự thay đổi của các ô nhập liệu (Thuốc, ICD) để trigger Rule Engine.

### ❌ CHƯA LÀM (Roadmap ngắn & trung hạn)
1. **Interaction & Contraindication Alerts:** Cảnh báo tương tác thuốc (DDI), sai liều theo chức năng thận (Creatinine/eGFR).
2. **Missing Diagnosis Detection:** Phát hiện thiếu mã ICD khi kê thuốc đặc trị.
3. **Hard-stop / Soft-stop Safety Alert:** Chặn thao tác lưu bệnh án nếu phát hiện lỗi nghiêm trọng (vd: kê sai liều kháng sinh).
4. **Order Sets & Surgical Safety Checklist.**
5. **AI-Assisted Documentation:** Tự động gen SOAP Note từ giọng nói raw.

---

## II. KIẾN TRÚC & UI MOCKUP (Dành cho AI Agent sinh code)

### Cấu trúc UI Hoàn Chỉnh (Aladinn Clinical Hub)
```plaintext
┌──────────────────────────────────────────────┐
│ HIS (VNPT)                                   │
│                                              │
│   [Form kê thuốc / ICD / Lab]                │
│                                              │
│                           ┌────────────────┐ │
│                           │  ALADINN       │ │
│                           │  CLINICAL HUB  │ │
│                           ├────────────────┤ │
│                           │ Alerts         │ │
│                           │ Suggestions    │ │
│                           │ Dose           │ │
│                           │ Actions        │ │
│                           └────────────────┘ │
└──────────────────────────────────────────────┘
```
**Quy tắc UI:**
- Khối hiển thị: **Sidebar phải**, Width: **320px**.
- Overlay không block thao tác click vật lý lên các ô lưới của VNPT HIS (tránh Popup che mất dữ liệu gốc).

### Component Breakdown Pattern (React/Vanilla JS)
*(Ghi chú: Aladinn hiện tại ưu tiên dùng Vanilla JS/Web Components bundle qua Vite để nhẹ nhất có thể, nếu chuyển qua React cần setup lại config).*

**(1) Alert Component:**
```js
type Alert = {
  severity: "critical" | "warning" | "info";
  title: string;
  message: string;
  action?: string;
}
```
**(2) PIPELINE CORE:**
`DOM HIS → Extractor → Structured Data → Rule Engine → AI (optional) → UI Renderer`

**(3) Extractor (Content Script):**
```js
function extractData() {
  return {
    drugs: getDrugList(),
    diagnosis: getICD(),
    labs: { creatinine: getCreatinine() }
  }
}
```

**(4) Rule Engine (Core):**
```js
function runRules(data) {
  let alerts = [];
  // Ví dụ Interaction
  if (data.drugs.includes("ibuprofen") && data.drugs.includes("warfarin")) {
    alerts.push({ severity: "critical", title: "Tương tác thuốc", message: "Nguy cơ xuất huyết" });
  }
  return alerts;
}
```

---

## III. ALADINN EXTENSION SPEC v1.0 (PROMPT CHO AI)

> **Objective:** Build a Chrome Extension (Manifest V3) that enhances HIS UI by adding a clinical decision support panel.

### 1. Core Features
- Drug interaction alert.
- Missing diagnosis detection.
- Renal dose adjustment.
- Inline UI sidebar.

### 2. Architecture Modules
* `content/`
  * `content.js` (inject UI + observer)
  * `extractor.js` (read HIS DOM)
  * `panel.js / panel.jsx` (UI)
* `background/`
  * `service-worker.js`
  * `ai-client.js` (optional)
* `shared/`
  * `rules.json` (IndexedDB schema format)
  * `rule-engine.js`

### 3. Data Flow
1. Observe DOM changes (MutationObserver trên thẻ thuốc / bệnh của HIS).
2. Extract: Drug list, ICD codes, Lab values.
3. Run rule engine locally (in-browser IndexedDB to ensure < 300ms latency).
4. Render UI panel.

### 4. Performance & Security Requirement
- Response time **< 300ms**.
- Debounce DOM updates (tránh CPU spike khi gõ phím).
- Tránh Heavy Polling (dùng MutationObserver hợp lý).
- **Security:** No data sent externally (chỉ trừ rawtext gửi lên Gemini qua API có kiểm soát mã hóa). No storage of patient identifiable data (PID) locally.

---

## IV. ĐỊNH HƯỚNG PHÁT TRIỂN (Sprints)

**Sprint 1 (1–2 tuần) - Móng kiến trúc:**
- Khung UI Panel Sidebar 320px.
- CSS Injection (không đụng CSS của HIS).
- Extractor: Viết hàm query Selector để móc được tên Thuốc + Mã ICD10 trên màn hình kê đơn hiện tại.

**Sprint 2 (2–4 tuần) - Trái tim CDS:**
- Đưa IndexedDB (từ kho `checkmap` cũ) vào trong hệ thống.
- Rule Engine basic: Cảnh báo Tương tác thuốc (DDI) và Suy thận.
- Nổi bật text (Inline highlight) trên vùng bị lỗi.

**Sprint 3 (Tiếp theo) - Sinh thái AI:**
- Gợi ý điền tự động (Suggestion auto-fill).
- Kiểm tra logic chẩn đoán/thuốc/Cận lâm sàng thông qua Gemini AI Flash (`ai-client.js`).

---
*(Tài liệu này là Spec Root. Mọi AI Agent khi khởi tạo tính năng nội bộ đều dùng tài liệu này làm kim chỉ nam để sinh code.)*
