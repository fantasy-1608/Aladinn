# ALADINN — KẾ HOẠCH NÂNG CẤP HIỆU NĂNG CDS VÀ TOÀN HỆ THỐNG

**Phiên bản kế hoạch:** 1.0  
**Phạm vi ưu tiên:** Module CDS  
**Phạm vi mở rộng:** Scanner, Sign, Voice, Side Panel, Background Service Worker  
**Nguyên tắc bắt buộc:** không làm thay đổi chức năng hiện có; không giảm độ an toàn dữ liệu; không mở rộng quyền trình duyệt nếu chưa có lý do nghiệp vụ rõ ràng.

---

## 1. Mục tiêu nghiệm thu

### 1.1. KPI chính: thời gian phản hồi của HIS

KPI chính không phải CPU hoặc RAM. KPI chính là **độ trễ mà người dùng cảm nhận trực tiếp trên HIS**.

| Nhóm thao tác HIS | Cách so sánh | Tiêu chí đạt |
|---|---|---:|
| Load danh sách bệnh nhân | CDS bật so với CDS tắt | p50 và p95 chậm thêm không quá 10% |
| Chọn bệnh nhân, tải hồ sơ | CDS bật so với CDS tắt | p50 và p95 chậm thêm không quá 10% |
| Mở buồng điều trị / phòng khám | CDS bật so với CDS tắt | p50 và p95 chậm thêm không quá 10% |
| Mở phiếu thuốc | CDS bật so với CDS tắt | p50 và p95 chậm thêm không quá 10% |
| Chuyển tab trong hồ sơ | CDS bật so với CDS tắt | p50 và p95 chậm thêm không quá 10% |
| Thêm hoặc xóa thuốc | CDS bật so với CDS tắt | p50 và p95 chậm thêm không quá 10% |
| Đóng modal và quay lại danh sách | CDS bật so với CDS tắt | p50 và p95 chậm thêm không quá 10% |

**Ngưỡng bổ sung:** dù tỷ lệ phần trăm vẫn đạt, một thao tác HIS không được chậm thêm quá **200 ms** do CDS.

### 1.2. KPI phụ: độ trễ cảnh báo CDS

| Chỉ số | Tiêu chí đạt |
|---|---:|
| Thời gian từ khi dữ liệu thuốc ổn định đến khi cảnh báo xuất hiện | p95 ≤ 500 ms |
| Long task do CDS gây ra trên main thread | không có task > 250 ms |
| CDS khi không có ngữ cảnh kê đơn | không được gây spike định kỳ ảnh hưởng thao tác HIS |
| Khi tab bị ẩn | dừng hoặc giảm tối đa hoạt động nền |

### 1.3. Công thức đánh giá

```text
Mức chậm thêm (%) =
(Thời gian khi CDS bật - Thời gian khi CDS tắt)
÷ Thời gian khi CDS tắt
× 100
```

---

## 2. Nguyên tắc kiến trúc không được vi phạm

| Mã | Nguyên tắc bắt buộc | Ý nghĩa thực hành |
|---|---|---|
| SEC-01 | Không làm yếu Context Lock | Không chấp nhận phản hồi API nếu không xác minh đúng bệnh nhân / lượt khám |
| SEC-02 | Không bỏ nonce và kiểm tra origin | Message nội bộ vẫn phải chống giả mạo từ page script hoặc frame không hợp lệ |
| SEC-03 | Cache dữ liệu bệnh nhân chỉ tồn tại cục bộ, theo phiên | Không persist PHI sang telemetry hoặc log hiệu năng |
| SEC-04 | Reset cache khi đổi bệnh nhân hoặc logout | Không được tối ưu bằng cách giữ dữ liệu bệnh nhân cũ quá lâu |
| SEC-05 | Không log PHI | Không ghi tên, mã bệnh án, ID bệnh nhân, ICD chi tiết, tên thuốc cụ thể, giá trị xét nghiệm, JWT hoặc API key |
| SEC-06 | Không thêm quyền trình duyệt không cần thiết | Không thêm `debugger`, không mở rộng `host_permissions`, không thu thập network ngoài nhu cầu hiện hữu |
| SEC-07 | IndexedDB vẫn là nguồn dữ liệu bền vững của Knowledge Base | Cache RAM chỉ là lớp tăng tốc, có version và cơ chế invalidation |
| SEC-08 | Không để CDS block luồng HIS | HIS render và phản hồi trước; CDS phân tích sau |
| SEC-09 | Giữ Remote Kill Switch và feature flag | Mọi refactor phải có đường tắt nhanh và rollback |

---

## 3. Kiến trúc đích

```text
HIS event / DOM mutation / iframe message
              │
              ▼
     CDS Context Watcher nhẹ
              │
      debounce + generation ID
              │
              ▼
      Context Extractor phân tầng
   ┌──────────┴──────────┐
   │ dữ liệu nhanh        │ dữ liệu bổ sung bất đồng bộ
   │ DOM + cache          │ bridge API + iframe helper
   └──────────┬──────────┘
              ▼
       Runtime RuleIndex trong RAM
              │
              ▼
       Rule Engine không đọc lại DB
              │
              ▼
        Alert diff + render trì hoãn
              │
              ▼
      Performance Diagnostics cục bộ
```

---

## 4. Bảng kế hoạch triển khai chi tiết — CDS

### Giai đoạn P0 — Đo đúng trước khi tối ưu

| ID | Hạng mục | Vị trí dự kiến | Thay đổi | Bảo vệ chức năng | Bảo vệ bảo mật | Tiêu chí nghiệm thu | Rollback |
|---|---|---|---|---|---|---|---|
| CDS-P0-01 | Tạo `performance-diagnostics.js` | `content/cds/performance-diagnostics.js` | Dùng `performance.mark()`, `performance.measure()` và `PerformanceObserver` để đo thời gian từng bước | Chỉ bọc đo quanh code cũ; không thay đổi thứ tự xử lý | Chỉ log duration, count, mode, scan reason; không log raw context | Có thể xuất JSON tổng hợp; overhead đo < 2% | Feature flag `cds_perf_diagnostics=false` |
| CDS-P0-02 | Gắn marker cho `runScan()` | `content/cds/index.js` | Đo `extract_context_ms`, `analyze_ms`, `render_ms`, `scan_total_ms`, `skipped_by_hash` | Không thay đổi nhánh return hiện hữu | Không đưa `context` vào telemetry | Có bảng p50, p95, max theo từng loại scan | Tắt marker bằng flag |
| CDS-P0-03 | Gắn marker cho thao tác HIS | `content/shared/his-performance-probe.js` | Theo dõi thời gian từ click đến modal/grid ổn định bằng selector allowlist | Chỉ đo observer một lần rồi disconnect | Không đọc text content; chỉ ghi loại thao tác và duration | Đo được mở phiếu thuốc, chuyển tab, chọn bệnh nhân | Không inject probe |
| CDS-P0-04 | Ring buffer cục bộ | `shared/performance-store.js` | Lưu tối đa 500 record tổng hợp trong `chrome.storage.local` hoặc memory buffer có giới hạn | Không ảnh hưởng luồng CDS khi storage lỗi | Allowlist field; cấm PHI bằng sanitizer | Không tăng storage không giới hạn | Xóa key telemetry |
| CDS-P0-05 | Màn hình xuất báo cáo | Side Panel hoặc Options | Nút “Xuất báo cáo hiệu năng” tạo JSON/CSV cục bộ | Không tự động gửi dữ liệu | Người dùng chủ động export; dữ liệu đã khử định danh | Xuất được báo cáo A/B | Ẩn menu diagnostics |

#### Schema telemetry đề xuất

```js
{
  ts: '2026-06-13T10:30:00.000Z',
  build: '2.1.3',
  cds_enabled: true,
  cds_active: true,
  scan_reason: 'drug_table_mutation',
  scan_total_ms: 48,
  extract_context_ms: 12,
  analyze_ms: 18,
  render_ms: 6,
  iframe_count: 3,
  medication_count: 7,
  diagnosis_count: 2,
  lab_count: 4,
  alert_count: 2,
  skipped_by_hash: false
}
```

**Cấm bổ sung:** `patientId`, `patientName`, `maBA`, `khambenhId`, ICD cụ thể, tên thuốc, xét nghiệm cụ thể, JWT, API key, transcript.

---

### Giai đoạn P1 — Tối ưu nóng, rủi ro thấp

| ID | Hạng mục | Vị trí dự kiến | Vấn đề hiện tại | Thay đổi | Bảo vệ chức năng | Bảo vệ bảo mật | KPI | Rollback |
|---|---|---|---|---|---|---|---|---|
| CDS-P1-01 | Runtime RuleIndex trong RAM | `content/cds/runtime-rule-index.js`, `content/cds/engine.js`, `content/cds/db.js` | Mỗi scan có thể mở IndexedDB, đọc lại các store và dựng lại `Map` | Load Knowledge Base một lần sau `initializeKnowledgeBase()`, tạo index chỉ chứa dữ liệu tĩnh | IndexedDB vẫn là nguồn chuẩn; so sánh `seedVersion`; rebuild khi version đổi | Không đưa dữ liệu bệnh nhân vào RuleIndex | `analyze_ms` p95 giảm rõ; không thay đổi số alert trên test fixture | Flag `cds_runtime_rule_index=false` dùng engine cũ |
| CDS-P1-02 | Cache chuẩn hóa tên thuốc | `content/cds/normalization-cache.js`, `engine.js` | Tên thuốc lặp lại giữa nhiều lượt quét | LRU cache giới hạn 300–500 entry: token đã làm sạch → hoạt chất + nguồn match | Cache miss vẫn gọi logic cũ; xóa cache khi KB version đổi | Chỉ cache tên thuốc chuẩn hóa, không cache bệnh nhân hoặc đơn thuốc | `normalize_ms` giảm; alert parity 100% | Flag `cds_normalization_cache=false` |
| CDS-P1-03 | Không chạy lại Rule Engine nếu hash không đổi | `content/cds/index.js` | Đã có hash nhưng có nhánh reset hash chủ động sau message/mutation | Phân biệt `force_rescan_reason`; chỉ reset khi dữ liệu lâm sàng thực sự đổi | Giữ force scan khi đổi bệnh nhân, KB version, settings quan trọng | Hash phải gồm patient generation; không dùng hash để vượt context lock | Tăng tỷ lệ `skipped_by_hash`; không bỏ sót alert | Flag `cds_hash_guard_v2=false` |
| CDS-P1-04 | Debounce chuẩn hóa theo nguồn sự kiện | `content/cds/index.js` | Mutation và iframe message có thể dồn dập | Một scheduler chung: gom mutation trong 150–300 ms; scan mới hủy scan chờ cũ | Cảnh báo nghiêm trọng vẫn chạy ngay sau khi dữ liệu ổn định | Không merge context khác patient generation | Giảm `scan_requested/min`; cảnh báo p95 ≤ 500 ms | Flag `cds_scan_scheduler_v1=false` |
| CDS-P1-05 | Tách render cảnh báo khỏi phản hồi HIS | `content/cds/ui.js`, `index.js` | Render có thể cùng nhịp với HIS mutation | Chỉ render nếu alert hash đổi; dùng `requestAnimationFrame()` cho render; tránh block callback HIS | Cảnh báo vẫn hiển thị đủ; high severity không trì hoãn quá 1 frame | Không thay đổi nội dung cảnh báo | Không có long task do render > 250 ms | Flag `cds_deferred_render=false` |

#### Thiết kế `RuntimeRuleIndex`

```js
const RuntimeRuleIndex = {
  seedVersion: '',
  genericMap: new Map(),
  brandMap: new Map(),
  conditionMappings: [],
  ddiByPair: new Map(),
  drugDiseaseByDrug: new Map(),
  insuranceByDrug: new Map(),
  renalByDrug: new Map(),
  drugLabByDrug: new Map()
};
```

**Lưu ý:** đây là cache của Knowledge Base tĩnh. Tuyệt đối không thêm dữ liệu bệnh nhân.

---

### Giai đoạn P1 — Làm nhẹ Context Watcher và iframe

| ID | Hạng mục | Vị trí dự kiến | Vấn đề hiện tại | Thay đổi | Bảo vệ chức năng | Bảo vệ bảo mật | KPI | Rollback |
|---|---|---|---|---|---|---|---|---|
| CDS-P1-06 | Event-first, watchdog-last | `content/cds/index.js` | Interval 3 giây đang ping iframe và kiểm tra context định kỳ | Mutation/message là luồng chính; watchdog idle 10–15 giây; active 5 giây; tab hidden thì dừng | Trong giai đoạn đầu vẫn giữ fallback watchdog | Không thay đổi message validation | Không có spike định kỳ ảnh hưởng thao tác HIS idle | Flag `cds_event_first=false` quay lại interval 3 giây |
| CDS-P1-07 | Thu hẹp `modalObserver` | `content/cds/index.js` | Observer trên toàn `document.body` với `subtree: true` có thể bắt quá nhiều mutation | Quan sát container mục tiêu nếu có; `body` chỉ làm fallback có timeout; callback debounce | Khi không tìm được container vẫn quay lại fallback | Không mở rộng selector sang dữ liệu nhạy cảm | Giảm observer callback/min | Flag `cds_scoped_observer=false` |
| CDS-P1-08 | Registry iframe theo lifecycle | `content/cds/index.js`, iframe helper | Duyệt iframe đệ quy và cleanup theo chu kỳ | Frame helper báo `READY`, `CONTEXT_STATUS`, `UNLOAD`; top frame duy trì registry; watchdog chỉ xác minh lại khi cần | Giữ đệ quy cũ làm fallback trong giai đoạn chuyển tiếp | Kiểm tra origin + nonce như hiện tại | Giảm iframe ping/min; không bỏ sót modal lồng | Flag `cds_iframe_registry=false` |
| CDS-P1-09 | Dừng hoạt động nền khi tab ẩn | `content/cds/index.js` | Đã guard trong fallback interval nhưng cần thống nhất toàn pipeline | `visibilitychange`: pause watchdog, observer phụ, render phụ; resume với một context refresh | Không pause dữ liệu an toàn bắt buộc khi người dùng quay lại | Không giữ dữ liệu ngoài lifecycle hiện hữu | Không chạy scan không cần thiết khi hidden | Flag `cds_pause_hidden=false` |

---

### Giai đoạn P1 — Tối ưu Extractor nhưng không giảm an toàn

| ID | Hạng mục | Vị trí dự kiến | Vấn đề hiện tại | Thay đổi | Bảo vệ chức năng | Bảo vệ bảo mật | KPI | Rollback |
|---|---|---|---|---|---|---|---|---|
| CDS-P1-10 | Generation ID theo bệnh nhân | `content/cds/extractor.js`, `cds-cache.js`, `index.js` | Phản hồi bridge về trễ có thể thuộc context cũ | Mỗi lần đổi bệnh nhân tăng `contextGeneration`; mọi async response phải khớp generation trước khi merge | Không mất dữ liệu đúng bệnh nhân; response cũ bị discard | Giữ Context Lock và thêm generation guard, không thay thế Context Lock | Không còn merge stale response trong test chuyển BN nhanh | Flag `cds_generation_guard=false` nhưng chỉ dùng khi rollback khẩn cấp |
| CDS-P1-11 | Parallelize dữ liệu độc lập | `content/cds/extractor.js` | Một số getter đang await tuần tự | Dùng `Promise.allSettled()` cho meds, labs, weight, demographics sau khi khóa context | Fallback DOM giữ nguyên nếu một nguồn lỗi | Mỗi kết quả vẫn qua context validation | `extract_context_ms` p95 giảm | Flag `cds_parallel_extract=false` |
| CDS-P1-12 | Phân tầng “fast context” và “enrichment” | `content/cds/extractor.js`, `index.js` | Bridge API chậm có thể trì hoãn scan ban đầu | Scan nhanh từ DOM + cache; API diagnoses/demographics về sau sẽ trigger rescan nếu generation còn hợp lệ | Alert có thể được bổ sung sau enrichment; không xóa cảnh báo cũ trước khi có dữ liệu mới hợp lệ | Không accept dữ liệu enrichment nếu context lock fail | HIS không bị block; cảnh báo bổ sung đúng | Flag `cds_staged_enrichment=false` |
| CDS-P1-13 | Deduplicate bridge request | `content/cds/extractor.js` | Cùng request có thể phát sinh lặp trong một context | Map `inFlightRequests` theo `generation + requestType + rowId`; dùng cùng Promise | Timeout và retry giữ nguyên | Không cache response vượt context | Giảm request bridge lặp | Flag `cds_bridge_dedupe=false` |

**Cấm làm:** giảm timeout bằng cách bỏ chờ mà không có rescan; bỏ `verifyContextLock()`; chỉ dùng tên bệnh nhân để xác minh; persist raw response bridge.

---

### Giai đoạn P2 — Tối ưu Rule Engine theo chỉ mục

| ID | Hạng mục | Vị trí dự kiến | Thay đổi | Bảo vệ chức năng | Bảo vệ bảo mật | KPI | Rollback |
|---|---|---|---|---|---|---|---|
| CDS-P2-01 | DDI index theo cặp thuốc | `runtime-rule-index.js`, `engine.js` | Tạo khóa `pairKey(a,b)` đã sort; chỉ kiểm tra cặp thuốc thực tế trong đơn | Test parity với engine cũ trên fixtures | Chỉ xử lý tên hoạt chất chuẩn hóa | Alert parity 100%, `analyze_ms` giảm | Engine cũ qua flag |
| CDS-P2-02 | Drug-disease index theo thuốc | `runtime-rule-index.js`, `engine.js` | Chỉ duyệt rule liên quan thuốc đang có | Test toàn bộ rule fixtures | Không thay đổi mapping ICD | Alert parity 100% | Engine cũ qua flag |
| CDS-P2-03 | Renal và drug-lab index theo thuốc | `runtime-rule-index.js`, `engine.js` | Truy xuất rule trực tiếp theo thuốc hiện diện | Test ngưỡng eGFR và lab boundary | Không log lab value | Alert parity 100% | Engine cũ qua flag |
| CDS-P2-04 | Insurance index theo thuốc | `runtime-rule-index.js`, `engine.js` | Truy xuất formulary và rule BHYT theo thuốc đang dùng | Test missing ICD và ICD range | Không đổi logic BHYT | Alert parity 100% | Engine cũ qua flag |
| CDS-P2-05 | Golden test dual-engine | `tests/cds/engine-parity.test.js` | Trong test, chạy engine cũ và engine mới trên cùng fixture | Không release nếu output khác ngoài thứ tự đã chuẩn hóa | Fixture dùng dữ liệu giả | 100% parity | Không bật engine mới |

---

## 5. Mở rộng tối ưu toàn Aladinn

### Giai đoạn P2 — Tải module theo nhu cầu

| ID | Hạng mục | Vị trí dự kiến | Vấn đề hiện tại | Thay đổi | Bảo vệ chức năng | Bảo vệ bảo mật | KPI | Rollback |
|---|---|---|---|---|---|---|---|---|
| APP-P2-01 | Lazy-load Scanner, Sign, Voice, CDS | `content/main.js` | Entry point import nhiều module ngay khi trang load dù feature có thể tắt | Bootstrap nhẹ đọc feature flag trước, sau đó `import()` module cần dùng | Test từng tổ hợp feature flag; đảm bảo command bus đăng ký đúng | Không tải remote code; module vẫn đóng gói trong extension | Giảm bootstrap p50/p95 | Flag `app_lazy_modules=false` |
| APP-P2-02 | Iframe bootstrap duy nhất | `manifest.json`, `content/iframe-bootstrap.js` | Nhiều helper nạp vào mọi frame | Manifest nạp một bootstrap; bootstrap chỉ import helper phù hợp URL/DOM | Giữ helper cũ trong fallback build | Không mở rộng `matches`; không nạp code từ xa | Giảm số script instance/frame | Flag/build fallback |
| APP-P2-03 | CSS theo feature | `content/main.js`, styles | Nạp nhiều stylesheet ngay từ đầu | Chỉ import CSS của module khi module bật | Visual regression test | Không ảnh hưởng CSP | Giảm style recalculation ban đầu | Build fallback |
| APP-P2-04 | Template engine on-demand | `content/main.js`, template engine | Khởi tạo template sau timeout cố định | Chỉ init khi trang/context cần hoặc khi người dùng gọi | Có fallback init sau event xác định | Không thay đổi quyền | Giảm bootstrap phụ | Flag `template_lazy_init=false` |

### Giai đoạn P2 — Background Service Worker

| ID | Hạng mục | Vị trí dự kiến | Thay đổi | Bảo vệ chức năng | Bảo vệ bảo mật | KPI | Rollback |
|---|---|---|---|---|---|---|---|
| BG-P2-01 | Hợp nhất message router | `background/service-worker.js` | Router theo bảng handler thay cho nhiều nhánh listener phân tán | Test từng message contract | Giữ `isValidSender()` trước mọi handler | Không thay đổi API response | Giữ router cũ qua flag/build |
| BG-P2-02 | Telemetry buffer an toàn | `background/performance-store.js` | Flush telemetry tổng hợp theo batch khi cần | Không giữ service worker sống vô hạn | Chỉ allowlist field, không PHI | Không tăng wake-up không cần thiết | Tắt telemetry |
| BG-P2-03 | Persist state cần thiết, không dựa vào global | `background/service-worker.js` | State cần sống qua service worker restart lưu trong `chrome.storage.session` hoặc `chrome.storage.local` phù hợp | Test service worker terminate/restart | Không lưu PIN plaintext, JWT hoặc API key plaintext | Không mất chức năng sau worker restart | Quay lại state cũ nếu cần |

### Giai đoạn P3 — Scanner, Sign, Voice

| ID | Module | Hạng mục | Thay đổi | Tiêu chí đạt |
|---|---|---|---|---|
| APP-P3-01 | Scanner | Rà observer và realtime loop | Hợp nhất observer trùng; debounce; tắt khi feature off | Scanner không làm HIS chậm thêm > 10% |
| APP-P3-02 | Scanner | Tách module ít dùng | Chỉ import dashboard, nutrition, emergency, protocol suggestion khi gọi | Bootstrap nhẹ hơn, không mất tính năng |
| APP-P3-03 | Sign | Rà polling, listener và tab switching | Chỉ active trong signing session; cleanup đầy đủ khi kết thúc | Không click nhầm, không switch tab ngoài session |
| APP-P3-04 | Voice | Init on-demand | Chỉ tải UI và AI client khi người dùng bật Voice | Voice off gần như không có overhead |
| APP-P3-05 | Shared | One patient observer | Duy trì một nguồn sự kiện bệnh nhân chuẩn, tránh observer phân tán | Không phát sinh duplicate listener |

---

## 6. Ma trận kiểm thử bắt buộc

### 6.1. Kiểm thử hiệu năng A/B

| Kịch bản | Trạng thái A | Trạng thái B | Số lần lặp tối thiểu | KPI |
|---|---|---|---:|---|
| Load trang bệnh nhân | Aladinn bật, CDS tắt | Aladinn bật, CDS bật | 10 | p50/p95 B không chậm hơn A > 10% |
| Chọn bệnh nhân | CDS tắt | CDS bật | 10 | p50/p95 ≤ 10%, delta ≤ 200 ms |
| Mở buồng điều trị | CDS tắt | CDS bật | 10 | p50/p95 ≤ 10% |
| Mở phiếu thuốc | CDS tắt | CDS bật | 10 | p50/p95 ≤ 10% |
| Thêm 5 thuốc giả lập | CDS tắt | CDS bật | 10 | HIS response ≤ 10%; cảnh báo CDS p95 ≤ 500 ms |
| Xóa thuốc | CDS tắt | CDS bật | 10 | HIS response ≤ 10% |
| Đóng modal | CDS tắt | CDS bật | 10 | Không giữ timer/observer thừa |
| Chuyển 20 bệnh nhân liên tục | CDS tắt | CDS bật | 1 chuỗi | Không memory leak tăng dần; không trộn dữ liệu |
| Bật/tắt CDS 20 lần | CDS tắt/bật luân phiên | — | 20 | Không tích tụ listener, timer, observer |
| Tab hidden 5 phút | CDS bật | — | 1 | Hoạt động nền tạm dừng hoặc tối thiểu |

### 6.2. Kiểm thử chức năng CDS

| Nhóm | Test bắt buộc |
|---|---|
| DDI | Tương tác thuốc-thuốc đúng, không trùng cảnh báo |
| Drug-disease | Chống chỉ định / thận trọng theo ICD đúng |
| BHYT | Missing ICD, formulary, range ICD đúng |
| Renal | Ngưỡng eGFR boundary đúng |
| Drug-lab | Lab threshold boundary đúng |
| Duplicate therapy | Không tăng cảnh báo giả sau cache optimization |
| Alert fatigue | Filter low severity giữ nguyên |
| Shadow mode | Không hiển thị UI nhưng engine behavior đúng theo thiết kế |

### 6.3. Kiểm thử an toàn dữ liệu

| ID | Tình huống | Kỳ vọng |
|---|---|---|
| SEC-T01 | Chuyển nhanh BN A → BN B khi bridge của A trả về trễ | Response A bị discard |
| SEC-T02 | Message không có nonce | Bị reject |
| SEC-T03 | Message sai origin | Bị reject |
| SEC-T04 | Logout | Cache bệnh nhân bị purge |
| SEC-T05 | KB version đổi | Runtime RuleIndex rebuild; không dùng index cũ |
| SEC-T06 | Export telemetry | Không chứa PHI, JWT, API key hoặc raw context |
| SEC-T07 | Service worker restart | Không mất chức năng quan trọng; không lưu secret plaintext |
| SEC-T08 | Remote Kill Switch | Tắt được module như trước refactor |

---

## 7. Feature flags đề xuất

```js
{
  cds_perf_diagnostics: false,
  cds_runtime_rule_index: false,
  cds_normalization_cache: false,
  cds_hash_guard_v2: false,
  cds_scan_scheduler_v1: false,
  cds_deferred_render: false,
  cds_event_first: false,
  cds_scoped_observer: false,
  cds_iframe_registry: false,
  cds_pause_hidden: false,
  cds_generation_guard: false,
  cds_parallel_extract: false,
  cds_staged_enrichment: false,
  cds_bridge_dedupe: false,
  app_lazy_modules: false,
  template_lazy_init: false
}
```

### Quy tắc bật flag

1. Bật diagnostics trước.
2. Thu baseline CDS tắt / bật trên cùng workflow.
3. Bật từng flag một.
4. Chạy lại A/B và golden test.
5. Chỉ giữ flag nếu KPI tốt hơn và chức năng parity 100%.
6. Bật theo nhóm nhỏ người dùng nội bộ trước khi mặc định bật.

---

## 8. Thứ tự ưu tiên triển khai

| Thứ tự | Nhóm việc | Lý do |
|---:|---|---|
| 1 | Diagnostics + A/B benchmark | Không đo thì không biết thay đổi có thực sự cải thiện HIS hay không |
| 2 | Runtime RuleIndex trong RAM | Lợi ích cao, ít ảnh hưởng logic lâm sàng |
| 3 | Scan scheduler + debounce | Giảm quét lặp không cần thiết |
| 4 | Event-first watchdog-last | Giảm tải nền khi HIS idle |
| 5 | Scoped observer | Giảm callback từ DOM không liên quan |
| 6 | Generation guard + bridge dedupe | Vừa tăng an toàn vừa giảm request lặp |
| 7 | Parallel extract + staged enrichment | Giảm khả năng CDS block thao tác HIS |
| 8 | Rule index theo thuốc | Chuẩn bị mở rộng dữ liệu toàn viện |
| 9 | Lazy-load toàn Aladinn | Giảm bootstrap nhưng phạm vi refactor rộng hơn |
| 10 | Iframe bootstrap duy nhất | Giảm script instance nhưng cần kiểm thử nhiều ngữ cảnh HIS |

---

## 9. Điều kiện dừng triển khai và rollback ngay

Rollback flag hoặc build nếu xuất hiện một trong các tình huống:

| Mức | Điều kiện |
|---|---|
| Critical | Trộn dữ liệu giữa hai bệnh nhân |
| Critical | Context Lock bị bypass hoặc message giả mạo được chấp nhận |
| Critical | Sai cảnh báo lâm sàng hoặc sai cảnh báo BHYT so với engine cũ |
| Critical | Auto-sign click nhầm hoặc tác động ngoài signing session |
| High | p95 thao tác HIS chậm thêm > 10% |
| High | Một thao tác HIS chậm thêm > 200 ms do Aladinn |
| High | CDS gây long task > 250 ms lặp lại |
| Medium | Listener, observer, timer hoặc iframe reference tăng dần sau 20 vòng thao tác |
| Medium | Telemetry chứa field ngoài allowlist |

---

## 10. Definition of Done

```md
## Definition of Done — Aladinn CDS Performance Upgrade

- [ ] Có báo cáo A/B trước và sau refactor.
- [ ] p50 và p95 thời gian phản hồi HIS không chậm thêm quá 10% khi bật CDS.
- [ ] Mỗi thao tác HIS không chậm thêm quá 200 ms.
- [ ] Alert CDS p95 xuất hiện trong ≤ 500 ms sau khi dữ liệu ổn định.
- [ ] Không có long task > 250 ms lặp lại do CDS.
- [ ] Engine mới và engine cũ cho output parity 100% trên fixtures.
- [ ] Context Lock, nonce, origin check, logout purge và patient reset vẫn hoạt động.
- [ ] Telemetry không chứa PHI, JWT, API key hoặc raw context.
- [ ] Không thêm quyền trình duyệt mới nếu chưa qua review bảo mật.
- [ ] Mỗi tối ưu có feature flag và rollback path.
- [ ] Remote Kill Switch vẫn hoạt động.
- [ ] Không deploy big-bang lên toàn viện.
```

---

## 11. Không nên làm

| Không nên làm | Lý do |
|---|---|
| Viết lại toàn bộ CDS cùng lúc | Khó xác định regression và khó rollback |
| Xóa Context Lock để giảm độ trễ | Nguy cơ gán nhầm dữ liệu bệnh nhân là không chấp nhận được |
| Lưu toàn bộ context bệnh nhân để cache lâu dài | Tăng rủi ro PHI và stale data |
| Dùng `chrome.debugger` để đo hiệu năng runtime | Quyền quá mạnh, không cần thiết cho production |
| Gửi telemetry về server mặc định | Không phù hợp nguyên tắc local-first và tối thiểu hóa dữ liệu |
| Tăng interval nhưng bỏ event handler | Có thể bỏ sót cập nhật trong form kê đơn |
| Tối ưu UI trước khi đo Rule Engine và Extractor | Không xử lý đúng nút thắt hiệu năng chính |
| Chuyển sang Electron chỉ để tăng tốc | Tăng độ phức tạp triển khai mà chưa giải quyết polling, observer và DB read lặp |

---

## 12. Deliverables đề xuất

| Mốc | Deliverable |
|---|---|
| D1 | `performance-diagnostics.js` + export JSON A/B |
| D2 | Báo cáo baseline CDS bật/tắt trên workflow chuẩn |
| D3 | Runtime RuleIndex + golden parity test |
| D4 | Scan scheduler + event-first watcher + scoped observer |
| D5 | Generation guard + bridge dedupe + staged enrichment |
| D6 | Báo cáo sau tối ưu, so sánh p50/p95 và delta tuyệt đối |
| D7 | Lazy-load toàn Aladinn và iframe bootstrap sau khi CDS ổn định |

