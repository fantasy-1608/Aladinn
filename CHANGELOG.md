# 📜 Changelog — Aladinn

Tất cả thay đổi quan trọng của dự án **Aladinn — Trợ lý Lâm sàng AI cho VNPT HIS** được ghi nhận tại đây.

Định dạng dựa trên [Keep a Changelog](https://keepachangelog.com/vi/1.1.0/),
và tuân theo [Semantic Versioning](https://semver.org/lang/vi/).

---

## [2.2.0] — 2026-06-15

### ✨ Tính năng mới (New Features)

- **Clinical Decision Support (CDS) Engine**: Tích hợp module kiểm tra tương tác thuốc, chẩn đoán, cảnh báo lâm sàng.
- **AI Pharmacist Pipeline**: Xử lý, cào dữ liệu và chuẩn hóa thuốc tự động.
- **Performance Diagnostics & Caching**: Tích hợp các module bộ nhớ đệm `normalization-cache`, `runtime-rule-index` và đầu dò hiệu năng.
- **Hỗ trợ Form Iframe**: Cải tiến cơ chế điền tự động cho form Hội chẩn, Dinh dưỡng, Chuyển viện, Nhập bệnh nhân.

### 🛠️ Cập nhật & Bảo trì

- Khắc phục triệt để lỗi unused variables trên toàn bộ các file `content/scanner/*-iframe-helper.js`.
- Cập nhật GitNexus Index.

---

## [2.1.3] — 2026-06-12

### 🛠️ Cập nhật & Bảo trì

- **Nâng cấp phiên bản**: Phát hành chính thức phiên bản `2.1.3` để cập nhật hệ thống và chuẩn bị cho các đợt cập nhật tính năng tiếp theo.

---

## [2.1.2] — 2026-06-06

### ✨ Side Panel & Tính năng Lâm sàng Mới

- **Side Panel Chrome**: Tích hợp Side Panel (`sidepanel/`) cho phép bác sĩ mở bảng điều khiển Aladinn ngay bên cạnh HIS mà không cần popup — tối ưu luồng làm việc trên màn hình rộng.
- **Lab Trend Analyzer**: Module phân tích xu hướng xét nghiệm (`lab-trend-analyzer.js`) — tự động nhận diện xu hướng tăng/giảm các chỉ số xét nghiệm qua nhiều lần xét nghiệm liên tiếp.
- **Trend Chart**: Module biểu đồ xu hướng trực quan (`trend-chart.js`) — hiển thị đồ thị biến thiên chỉ số xét nghiệm theo thời gian, giúp bác sĩ nhận diện bất thường nhanh chóng.
- **Discharge Summary**: Module tóm tắt xuất viện (`discharge-summary.js`) — tự động tổng hợp thông tin chẩn đoán, thuốc, diễn tiến để hỗ trợ hoàn tất hồ sơ xuất viện.
- **Protocol Suggestion**: Module gợi ý phác đồ (`protocol-suggestion.js`) — đề xuất phác đồ điều trị dựa trên chẩn đoán và dữ liệu lâm sàng hiện tại.

### 🚀 Tối ưu hóa Hiệu năng (Lazy Loading)

- **Tách pha tải dữ liệu CLS Modal**: Chuyển từ `Promise.all()` tải đồng loạt 8 API sang chiến lược 2 pha — Phase A tải dữ liệu header/tab đầu tiên, Phase B tải song song các tab còn lại khi người dùng chuyển tab. Giảm thời gian hiển thị modal đầu tiên lên đến 40%.
- **Song song hóa Drug Sheet Fetch**: Chuyển vòng lặp tuần tự `for...of` sang `Promise.all(candidates.map(...))` khi fetch phiếu thuốc, loại bỏ waterfall latency.
- **CDS Cache TTL**: Tinh chỉnh thời gian sống cache CDS để cân bằng giữa hiệu năng và độ tươi dữ liệu.

### 🎨 Đồng bộ Bảng Màu VNPT HIS

- **Xóa bỏ Desert Mystic**: Chuyển toàn bộ inline styles còn sót từ bảng màu Desert Mystic (`#d4a25a`, `#7a6e5e`, `#e8dcc8`) sang bảng màu VNPT HIS chính thức (`#004f9e`, `#666666`, `#333333`) ở Quick Time Edit, Sign Module checkboxes.

### 🛠️ Sửa lỗi & Cải tiến

- **Kích hoạt PTTT Print**: Mở lại chức năng in phiếu PTTT từ API Bridge (trước đó bị vô hiệu hóa trong Safe Mode).
- **Fix lint warnings**: Xử lý biến unused (`badgeSz`, `indPx`) bằng prefix `_` convention.

---

## [2.1.1] — 2026-06-01

### 🚀 Tối ưu hóa Hiệu năng (Performance Tuning)

- **Hợp nhất Observers**: Xóa bỏ các `MutationObserver` trùng lặp trong scanner, chuyển sang dùng EventBus trung tâm (`HIS.PatientObserver`), giúp giảm tiêu thụ CPU.
- **Loại bỏ Sync XHR**: Ngăn chặn tình trạng treo trình duyệt khi gọi API phân trang (`_fetchHisPagingRows`) bằng cách áp dụng Promise và timeout 5 giây.
- **Nâng cấp Ambient UI**: Sử dụng XPath kết hợp MutationObserver 1 lần duy nhất thay vì vòng lặp `setInterval` quét toàn bộ DOM mỗi giây.
- **Ngoại trú Prefetch**: Mở rộng module CDS Prefetch hỗ trợ click chọn bệnh nhân trên Grid Ngoại trú.

---

## [2.1.0] — 2026-05-30

### ✨ AI Lâm sàng V3.0 (Clinical Intelligence Upgrade)

- **System Instruction Độc lập:** Tách biệt vai trò bác sĩ chuyên khoa và quy tắc y khoa khỏi dữ liệu bệnh nhân, giúp AI tuân thủ tuyệt đối định dạng và ngôn ngữ y khoa chuyên nghiệp.
- **Chain-of-Thought (CoT):** Kích hoạt luồng tư duy phân tích sâu (Thinking Mode) cho các mô hình Gemini hiện đại (Gemini 2.5+), giúp nhận diện mâu thuẫn giữa diễn tiến lâm sàng, kết quả xét nghiệm và thuốc điều trị.
- **Biểu tượng Mức độ Nguy cơ:** Tự động phân loại điểm lưu ý bằng emoji cảnh báo (🔴 Cần can thiệp ngay, 🟡 Theo dõi sát, 🟢 Thường quy) và đánh giá xu hướng điều trị bằng biểu tượng định vị (✅ Cải thiện, ➡️ Không đổi, ⚠️ Xấu đi).
- **Data Pipeline Tối ưu:** Khử trùng lặp mã bệnh ICD, mở rộng trích xuất dữ liệu "Khám toàn thân/Bộ phận", tự động loại trừ thuốc ngưng sử dụng và map thành công các dịch vụ PTTT vào ngữ cảnh bệnh án.

---

## [2.0.5] — 2026-05-29

### 🛡️ Đánh giá & Vá Lỗi Bảo Mật Toàn Diện (Security Audit Remediation)

- **Vá lỗ hổng XSS (P0):** Bổ sung hàm `_escapeHtml()` để làm sạch `emergencyMessage` từ remote config trước khi render DOM, ngăn chặn hoàn toàn rủi ro XSS injection.
- **Tối ưu PHI Redactor (P0):** Thu hẹp regex cho CCCD (đúng 12 số bắt đầu bằng 0), CMND (yêu cầu nhãn nhận diện), và Mã bệnh nhân (yêu cầu tiền tố BN/HS/MA). Giảm thiểu đáng kể tỷ lệ nhận diện nhầm (false positive) đối với các dữ liệu sinh hiệu và kết quả xét nghiệm.
- **Xác thực Sender cho Audit Logger (P0):** Khóa chặt cổng nhận tin nhắn của `audit-logger.js`, chỉ chấp nhận log từ chính extension và trang `vncare.vn`, ngăn chặn hoàn toàn việc ghi log giả mạo hoặc trích xuất dữ liệu trái phép.
- **CI/CD Security Automation (P0/P1):** Tích hợp Semgrep SAST, Dependency Scanning (`pnpm audit`), Secret Scanning (gitleaks) và kiểm tra Test Coverage (≥80%) vào GitHub Actions workflow.
- **Cải thiện An toàn Mã nguồn (P1/P2):**
  - Đóng gói toàn bộ các dòng `console.log` debug phía sau cờ `window.__ALADINN_DEBUG__`.
  - Thay thế `postMessage('*')` bằng `window.location.origin` an toàn hơn.
  - Cập nhật tài liệu ALADINN_PRIVACY_MODEL.md đồng bộ thông số lặp PBKDF2 (310,000 vòng).
- **Tăng cường Kiểm thử Bảo mật:** Bổ sung 59 test cases mới (nâng tổng số lên 384 tests - 100% Passed) nhằm bao phủ logic tự dừng Auto-Sign khi đổi tab và độ chính xác của hàm Logger.sanitize().

---

## [2.0.4] — 2026-05-26

### 🛠️ Bản vá tích hợp API CLS (Hospital Safe Mode - API Bridge Update)

- **Vá lỗi truy vấn TraCuuKetQuaHDG**: Chuyển đổi cuộc gọi API từ màn hình `TraCuuKetQuaHDG` cũ (bị lỗi cú pháp và thiếu tham số) sang Store Procedure chính thức **`GET_DV_KQ_CLS_HDG`** chạy qua cỗ máy jabsorb gốc của HIS (**`dbCALL_SP_R`**).
- **Mô hình Dự phòng Tuần tự Tách biệt (Split Sequential Fallback Strategy)**:
  - Khắc phục lỗi hiển thị **XN (0)** khi bệnh nhân có cả Xét nghiệm (XN) và Chẩn đoán hình ảnh (CĐHA) nhưng XN bị lệch ID từ API mới còn CĐHA chạy thành công.
  - Tách biệt hoàn toàn luồng xử lý XN và CĐHA độc lập nhau. Luồng nào trống dữ liệu chi tiết khi lấy từ API mới sẽ tự động kích hoạt fallback tuần tự sang cách cũ (`NT.024.DSPHIEU` + `NT.024.2`) mà không gây ảnh hưởng tới luồng còn lại.
  - Đảm bảo tối ưu hóa tài nguyên máy chủ 100% bằng cách chỉ fallback khi thực sự cần thiết đối với từng loại dịch vụ cụ thể.
- **Tuân thủ Eslint & E2E Tests**: Hoàn tất 319 ca kiểm thử (100% Passed) và vượt qua kiểm tra cú pháp khắt khe của eslint không có bất kỳ lỗi nào.

### 🛡️ Bản vá Bảo mật & Context Guard (Safety & Context Guard Patch)

- **Sửa lỗi chặn điền bệnh án ngoại khoa (ContextGuard)**: Loại bỏ kiểm tra định dạng ID chứa dấu gạch dưới (`_`) trong `patient-context-guard.js`. VNPT HIS nội trú sử dụng số thứ tự dòng dạng chuỗi đơn thuần (ví dụ: `'3'`, `'16'`) làm `rowId` thay vì composite key, do đó việc bắt buộc chứa `_` đã vô tình chặn đứng các thao tác điền form. Cơ chế bảo vệ vẫn hoạt động an toàn tuyệt đối nhờ so khớp `initialSelectedPatientId` và chặn hồ sơ tạm `TEMP_`.
- **Sửa lỗi định dạng thời gian "Ra khoa lúc" khi điền Xử trí**: Loại bỏ đuôi nhãn ảo `(Đang soạn thảo)` khỏi chuỗi thời gian khi tự động điền vào datepicker của HIS. Aladinn tạo nhãn `(Đang soạn thảo)` cho các tờ điều trị thời gian thực chưa lưu để bác sĩ nhận biết, nhưng việc đưa nhãn text này vào ô ngày giờ của HIS gây lỗi hiển thị và xử lý ngày tháng. Chuỗi hiện được làm sạch thành định dạng chuẩn 100% trước khi điền vào datepicker, trong khi nhãn hiển thị trên Aladinn Clinical Overview vẫn được giữ nguyên để bác sĩ tham chiếu.

### ✨ Tính năng mới & Cải tiến Lâm sàng Vượt trội (Aladinn Clinical OS Upgrade)

- **Hệ thống Tự phục hồi DOM (Self-Healing DOM Engine)**: Tích hợp cơ chế đối sánh ngữ nghĩa thông minh sử dụng bộ từ điển lâm sàng tiếng Việt. Giúp tự động nhận diện và tự sửa lỗi ánh xạ các trường bệnh án (Hội chẩn, Chuyển viện, Dinh dưỡng,...) ngay cả khi hệ thống HIS thay đổi, ẩn hoặc làm mới ID tĩnh của DOM.
- **Cảnh báo eGFR & Liều lượng theo Chức năng Thận (eGFR Renal Alerts)**:
  - Tích hợp tự động tính toán eGFR theo phương trình **Cockcroft-Gault** và **CKD-EPI (2021)** không phụ thuộc vào chủng tộc (race-free).
  - Tự động nhận diện và chuyển đổi đơn vị Creatinine huyết thanh ($\mu\text{mol/L}$ sang $\text{mg/dL}$).
  - Tự động cảnh báo giới hạn liều lượng/chỉ định an toàn lâm sàng (ví dụ: Chống chỉ định hoặc cảnh báo giảm liều Metformin dựa trên mức eGFR của bệnh nhân).
- **Quét phím Chủ động thời gian thực (Proactive Keystroke CDS Hook)**:
  - Cho phép quét phím trực tiếp trên các trường kê đơn khi bác sĩ đang nhập tên thuốc (real-time).
  - Phân tích và truy vấn luật CDS từ trước khi biểu mẫu được lưu/gửi, hỗ trợ ra quyết định lâm sàng nhanh chóng và an toàn hơn.
- **Tuân thủ Tuyệt đối Clinical Safety & Immutability**:
  - Toàn bộ cơ chế phân tích CDS được thiết kế bất biến (Immutable Context), loại bỏ triệt để việc thay đổi dữ liệu gốc của bệnh nhân.
  - Fail-closed hoàn toàn nếu phát hiện sự sai lệch thông tin `benhnhanId` hoặc `khambenhId`.

---

## [2.0.5] — 2026-05-21

### 🎨 Thiết Kế Nhận Diện Thương Hiệu Động Aladinn x Gemini Intelligent (Aesthetics Upgrade)

- **Hộp Kính Mờ Thương Hiệu (Glassmorphic Capsule):** Khắc phục lỗi tương phản màu chữ bằng việc tạo một hộp kính mờ sang trọng bao quanh tên Bác sĩ, với viền gradient phát sáng neon và màu chữ trắng tinh khiết nổi bật 100%.
- **Biểu tượng lai Aladinn x Gemini Intelligent Động:** Tích hợp logo Đèn Thần Gold lấp lánh kết hợp làn khói ma thuật uốn lượn bay ra 2 ngôi sao Gemini lấp lánh (một to phập phồng tự xoay chậm, một nhỏ nhấp nháy lấp lánh lệch pha cực đẹp).
- **Chữ thương hiệu SHIMMER:** Bổ sung dòng chữ nhỏ "ALADINN" màu vàng Gold lấp lánh (shimmer effect) ngay trước tên Bác sĩ, khẳng định rõ trạng thái hoạt động của hệ điều hành lâm sàng.

### 🛡️ Safety Patch (Hospital Safe Mode - R1 to R12)

- **Vô hiệu hóa Retry AJAX:** Chuyển `ajax-interceptor.js` thành bộ lắng nghe thụ động. Không gửi lại request HIS khi có lỗi, ngăn chặn rủi ro vòng lặp vô hạn.
- **Manual Safe Sign:** Tắt tính năng tự động bấm "Đồng ý" khi ký số. Yêu cầu bác sĩ trực tiếp xác nhận thao tác ký cuối cùng.
- **Fail-Safe Remote Config:** Mặc định vô hiệu hóa mọi tính năng tự động (autoClick, autoSign) khi mất kết nối Internet, chỉ cho phép Scanner hoạt động ở chế độ đọc.
- **On-Demand Auto-fill:** Typing-effect chỉ được inject và giải phóng thuộc tính readonly khi bác sĩ chủ động ấn nút "Điền vào form". Khôi phục trạng thái ban đầu ngay sau khi hoàn tất.
- **Patient Context Guard:** Chặn hoàn toàn các thao tác ghi (ký số/điền form) đối với hồ sơ tạm (`TEMP_`) hoặc khi phát hiện lệch `benhnhanId` / `khambenhId` giữa bộ nhớ đệm và giao diện gốc.
- **Safe Logging (PHI-free):** Ẩn toàn bộ thông tin nhạy cảm (Tên, BHYT, CCCD, mã BN) trong log thành `[REDACTED]`.
- **API Bridge Hardening:** Chỉ cho phép các API intent đọc (`READ_ONLY_INTENTS`). Vô hiệu hóa tính năng in phiếu PTTT từ xa, áp dụng giới hạn request chống quá tải HIS.

---

## [2.0.4] — 2026-05-21

### 📝 Hoàn thiện Hồ sơ Sáng kiến Cấp Cơ sở

- **Hoàn thiện Thuyết minh Sáng kiến:** Bổ sung đầy đủ các mục bắt buộc theo Nghị định 13/2012/NĐ-CP (Tính mới, Cam đoan tác giả, Thời gian áp dụng, Nơi áp dụng, Chủ đầu tư, Điều kiện áp dụng).
- **Mẫu Phiếu khảo sát bác sĩ:** Tạo mẫu phiếu khảo sát sự hài lòng 10 câu hỏi Likert để thu thập minh chứng thực tế.
- **Mẫu Đơn đề nghị công nhận:** Tạo mẫu đơn hành chính chuẩn để nộp Hội đồng Khoa học Kỹ thuật.
- **Xóa test placeholder:** Loại bỏ `basic.test.js` (test vô nghĩa `expect(true).toBe(true)`).

---

## [2.0.3] — 2026-05-21

### 🛡️ Self-Healing UI & Live Persistence Observer

- **Cơ chế tự khôi phục tiện ích thời gian thực:** Tích hợp `MutationObserver` siêu nhẹ trên `document.body` giúp tự động tái tiêm nút Aladinn "🧞" và nút tóm tắt nội dòng (inline) dưới 10ms khi HIS re-render DOM.
- **Kiểm thử tự phục hồi:** Bổ sung 3 ca test chuyên biệt tại `tests/scanner/self-healing-ui.test.js` giả lập tình huống HIS xóa nút tiện ích, xác nhận phục hồi tự động.
- **Dọn dẹp an toàn bộ nhớ:** Observer tự `disconnect()` khi tab unload để tránh rò rỉ bộ nhớ.

---

## [2.0.2] — 2026-05-21

### 🎨 Tinh chỉnh Hover & Màu sắc Chỉ số Bất thường

- **Thanh ngang định vị hover:** Gỡ bỏ `!important` inline style, nâng cường nền hover `#d2e3fc`, thêm thanh chỉ thị đứng `#1e5494` bên trái dòng xét nghiệm khi rê chuột.
- **Sửa lỗi mã Hex:** Khắc phục lệch mã màu Hex (`#dc2626` → `#c62828`) giúp chỉ số tăng (▲) hiển thị đúng đỏ sẫm trên nền đỏ nhạt `#ffeeee`.
- **CSS transition:** Bổ sung chuyển cảnh mượt 0.12s giúp quét mắt dóng hàng cực nhanh.

---

## [2.0.1] — 2026-05-21

### 🎨 Giao diện CLS Phẳng Chuẩn HIS

- **Tông màu xanh thẫm HIS `#1e5494`:** Tất cả thanh header modal, tiêu đề phân nhóm xét nghiệm và nút hành động chính đều chuyển sang màu xanh dương đặc trưng VNPT HIS.
- **Phẳng lỳ 100%:** Toàn bộ bo góc `border-radius` về `0px`, viền phẳng mỏng `#cccccc`.
- **Kẻ lưới dóng hàng:** Bảng xét nghiệm kẻ lưới mỏng dọc/ngang đầy đủ (`border-collapse: collapse`).
- **Nút phẳng:** Các nút "Đọc Nâng Cao" và "Xem ảnh PACS" chuyển sang nút phẳng viền xanh dương.

---

## [1.5.0] — 2026-05-21

### ✨ Tính năng mới & Cải tiến Giao diện Nổi bật

- **Giao diện Kính mờ sang trọng mới**: Nâng cấp toàn diện nút nổi thành dạng kính mờ (Glassmorphism) cực kỳ đẹp mắt, sử dụng các biểu tượng sắc nét, có phản hồi rung động lực bấm êm ái khi nhấp chuột.
- **Tự động lọc nút thông minh**: Tự ẩn/hiện nút phù hợp nhất với bảng HIS đang mở (ví dụ: chỉ hiện duy nhất nút "Điền Xử trí" trên bảng Xử trí, ẩn hoàn toàn các nút khác để tránh rối mắt).
- **Hỗ trợ toàn diện cho Ngoại trú**: Khắc phục triệt để lỗi bảng xem trước bị trống thông tin ở phân hệ khám Ngoại trú. Tiện ích hiện đã lấy đầy đủ lý do khám, tiền sử, diễn biến bệnh và sinh hiệu... từ tab "Bệnh án".
- **Điền Xử trí nhanh 1-Click**: Tự động điền thẳng thông tin lâm sàng vào phiếu Xử trí của HIS mà không cần thông qua bảng xem trước trung gian, giúp tiết kiệm tối đa thao tác cho bác sĩ.
- **Giữ bảng xem trước cho Hội chẩn & Chuyển viện**: Cho phép bác sĩ xem, chỉnh sửa trực tiếp và kiểm tra dữ liệu cẩn thận trước khi điền chính thức.
- **Sửa lỗi điền bệnh kèm theo**: Cải tiến logic điền thông tin tự động mở khóa ô nhập bệnh kèm theo và đồng bộ mã bệnh chính xác với hệ thống HIS.

---

## [1.4.1] — 2026-05-19

### 🕵️‍♂️ Audit Logging & Ruleset Versioning (Pilot Readiness)

- **Audit Telemetry (Shadow Logging)**: Bổ sung hệ thống Audit Logger ẩn (lưu qua IndexedDB), ghi nhận các lỗi dữ liệu quan trọng, cảnh báo thuốc (Critical/Warning) và lỗi Schema AI mà **không** chứa dữ liệu định danh bệnh nhân (PHI-Free).
- **CDS Shadow Mode**: Thêm cấu hình chạy ngầm hệ thống cảnh báo lâm sàng (chẩn đoán, tương tác thuốc) nhưng không hiển thị giao diện để thu thập dữ liệu an toàn mà không làm phiền bác sĩ.
- **Ruleset Versioning**: Hiển thị phiên bản bộ luật (Ruleset version) lấy từ file metadata, giúp kiểm soát tốt hơn các phiên bản luật CDS đang được áp dụng tại từng máy trạm.
- **Fail-Closed Patient Context**: Đưa các sự kiện "Patient Mismatch" (khi dữ liệu bệnh nhân bị sai lệch) vào log an toàn để giám sát từ xa.
- **Default Feature Toggle**: Đảm bảo cài đặt mặc định khi cài tiện ích lần đầu là chỉ bật module Scanner, các module khác (Voice, Sign, CDS) tắt để an toàn.

---

## [1.4.0] — 2026-05-17

### 🔐 Bảo mật AI & Lâm sàng (Antigravity Phase 3 & 4)

- **PHI Redactor**: Tự động nhận diện và xóa thông tin định danh (Tên, CCCD, BHYT, SĐT, Địa chỉ) khỏi prompt trước khi gửi cho AI (Fail-Closed bảo vệ dữ liệu).
- **JSON Schema Validator**: Bắt buộc mọi phản hồi lâm sàng từ AI phải đúng cấu trúc (Schema Validated) trước khi Auto-fill để tránh lỗi dữ liệu.
- **Auto-Flush CDS Cache**: Cache cảnh báo lâm sàng tự động được dọn sạch ngay khi người dùng đăng xuất (Logout) khỏi VNPT HIS, tránh lộ thông tin bệnh án giữa các phiên làm việc.
- **Chuẩn bị Release Gate**: Bổ sung Checklist QA và Checklist Release chặt chẽ cho toàn bộ dự án.

---

## [1.3.1] — 2026-05-15

### 🔐 Bảo mật & Toàn vẹn Dữ liệu (Integrity Hardening)

- **Scanner Context Guard**: Loại bỏ triệt để các biến global dùng chung (`patientDemographics`). Tất cả dữ liệu hành chính và lịch sử khám hiện lưu theo khóa mã hóa `patientKey`, chống nhiễm chéo dữ liệu bệnh án khi bác sĩ chuyển bệnh nhân liên tục.
- **Iframe Form Security**: Truyền `contextToken` và `expectedPatientName` từ Scanner xuống tất cả các iframe helpers. Các iframe tự động kiểm chứng với tên trên form DOM và từ chối điền dữ liệu nếu phát hiện sai lệch.
- **Fail-secure Medical History**: Bỏ cache fallback dựa trên `pid` của lịch sử khám. API thất bại sẽ báo lỗi trực tiếp thay vì bốc nhầm hồ sơ cũ.
- Chuẩn bị đầy đủ cơ sở hạ tầng an toàn cho việc cấp quyền ký số tự động mở rộng.

---

## [1.2.7] — 2026-05-11

### 🚀 Nâng cấp Kiến trúc & Hiệu năng

- **API-First Architecture**: Refactor hệ thống fetch dữ liệu với `bridgeFetch`, gom gọn các hàm API trùng lặp giúp giảm dung lượng file và dễ bảo trì.
- **Auto-prefetch Demographics**: Tự động tải ngầm thông tin bệnh nhân qua `VNPTStore` ngay khi người dùng bấm chọn bệnh nhân, không cần chờ mở chức năng.
- **Global Logs Toggle**: Bổ sung nút bật/tắt Logs (Debug Mode) trực tiếp trên Popup extension giúp giao diện console mượt mà và không bị spam log.
- **Emergency Module**: Chuyển đổi module Cấp cứu sang ưu tiên cơ chế API-first, chỉ fallback về DOM khi cần thiết.
- **Data Enrichment**: Tự động tính toán tuổi (`age`) từ ngày sinh (`dob`) ngay trong tầng API Bridge.
- **Centralized Selectors**: Chuẩn hóa toàn bộ DOM selectors (Dashboard, History) về tập trung tại `VNPTConfig.selectors` giúp code ổn định hơn với các cập nhật UI của HIS.

---

## [1.2.6] — 2026-05-09

### 🐛 Sửa lỗi

- **Bảo mật & Trải nghiệm**: Sửa lỗi "Sai mã PIN" bằng cách đồng bộ thuật toán mã hóa PBKDF2 lên 310,000 iterations. Cải thiện logic lưu mô hình AI để tránh bị ảnh hưởng bởi dữ liệu cũ trong `localStorage` trên trang HIS.
- **AI Selection**: Xóa fallback cứng (`gemini-2.0-flash-lite...`), giờ đây hệ thống sẽ luôn lấy đúng mô hình mà người dùng đã chọn từ giao diện cài đặt (như `gemini-2.0-flash`).
- **Giao diện Options**: Làm rõ cơ chế tự động ẩn API Key để bảo mật, đồng thời làm mượt hiệu ứng nhịp thở cho tên hiển thị trên hệ thống.

---

## [1.2.5] — 2026-05-09

### 🚀 Pilot-Ready Release

- **Hoàn tất lộ trình 30 ngày ổn định**: Đáp ứng 100% Definition of Done (DoD) cho việc phát hành thử nghiệm.
- **Dọn dẹp Linter & Warning**: Làm sạch hoàn toàn code base, loại bỏ mọi warning trong quá trình scan và build.
- **Hoàn thiện UI Ambient**: Cập nhật hiệu ứng nhận diện phiên làm việc Aladinn (Genie icon & Desert Mystic aura) tích hợp liền mạch vào HIS Footer.

---

## [1.2.4] — 2026-05-08

### 🛡 Safe Mode (Kill Switch từ xa)

- **Remote Config**: Tích hợp module cấu hình từ xa qua GitHub, cho phép tắt nóng các tính năng nhạy cảm (Auto-Sign, CDS, AI) trên tất cả các máy trạm mà không cần người dùng cài lại tiện ích.
- **Fail-open & Graceful Shutdown**: Kiến trúc an toàn đảm bảo không chặn tiến trình tải UI và chỉ chạy khi có cấu hình hợp lệ.
- **30-Day Stabilization - Week 1-4**:
  - Đã rà soát bảo mật, đồng bộ tài liệu và code (PBKDF2 310,000 iterations).
  - Tích hợp Unit test với coverage thông qua Vitest.
  - Bổ sung Release Gating (preflight checks) vào \`scripts/release.js\`.
  - Thiết lập Pilot Safe Mode, tắt Auto-Sign mặc định khi cấu hình Pilot.
  - Cấu trúc hệ thống tài liệu (Docs) cho Architecture, Security, Release, QA và Pilot.
- Fix markdown linting và lỗi đồng bộ \`package-lock.json\` gây crash CI/CD pipeline.

---

## [1.2.2] — 2026-05-07

### 🛠 Kỹ thuật & Hạ tầng (30-day Stabilization Phase)

- **CI/CD Automation**: Tự động hóa quá trình đóng gói và phát hành (release) qua GitHub Actions, loại bỏ rủi ro stale zip.
- **Testing Coverage**: Bổ sung Unit Tests (jsdom, vitest) cho `CDSCacheManager` và quy trình trích xuất chẩn đoán.
- **Linter Enforced**: Loại bỏ triệt để mọi cảnh báo (Zero-Linter-Warning).

---

## [1.2.1] — 2026-05-03

### ✨ Tính năng mới

- **SmartCA Guard — Tự động xử lý đăng xuất & đăng nhập lại**
  - Polling thông minh thay thế timeout cố định, tương thích mọi tốc độ mạng
  - Tự nhận diện khi SmartCA đăng nhập sai tài khoản → hiển thị cảnh báo mismatch
  - UX re-login mượt mà: đăng nhập lại ngay trong modal e-Seal mà không cần đóng/mở lại
  - Tự động cleanup warning khi re-login thành công

- **Clinical Decision Support (CDS) — Mở rộng Phase 4–6**
  - Tăng DDI rules lên **426 quy tắc** tương tác thuốc (từ ~200 lên 426)
  - Thêm **VN-to-INN Alias Mapping** — nhận diện tên thuốc tiếng Việt / biệt dược viện
  - Logic phát hiện **thiếu chẩn đoán** khi kê đơn (Missing Diagnosis Rules)
  - Bao phủ thêm: Corticoids, Thuốc chống động kinh, CCB, Ức chế miễn dịch

- **Slash Command Templates nâng cấp**
  - Trigger bằng `//` thay vì `/` — tránh xung đột với HIS date fields
  - Hoạt động trong **mọi ô nhập liệu** bao gồm cả iframe modal HIS
  - Event delegation cải tiến cho cross-origin iframes

### 🐛 Sửa lỗi

- **clinical-fill**: Lấy đúng tờ điều trị **mới nhất** (client-side sort) thay vì phụ thuộc server
- **clinical-fill**: Gộp dữ liệu "Khám toàn thân" vào trường "Tóm tắt TT hiện tại"
- **template**: Slash command không hoạt động trong một số ô nhập liệu HIS đặc biệt

### 📊 Thống kê phiên bản

| Chỉ số | Giá trị |
|--------|---------|
| Files changed | 73 |
| Insertions | +11,150 |
| Deletions | -1,209 |
| DDI Rules | 426 |
| Commits since v1.2.0 | 5 |

---

## [1.2.0] — 2026-04-30

### 🔐 Bảo mật — Security Hardening

- **Background Crypto Service**: `storageKey` không còn là raw API key — background service worker là crypto authority duy nhất
- **AES-256-GCM + PBKDF2**: 310,000 iterations, `CryptoKey` non-extractable, chỉ tồn tại trong memory
- **Nonce bắt buộc**: Tất cả `postMessage` đều yêu cầu nonce hợp lệ (mandatory, không optional)
- **Prompt injection**: `JSON.stringify()` escape cho mọi user input trước khi nhúng system prompt
- **Endpoint allowlist**: `geminiBaseUrl` chỉ chấp nhận `*.googleapis.com`, `*.vncare.vn`, `localhost`
- **PHI redaction**: Error log chỉ lưu short ID (`P-****`), TTL 24h tự xoá
- **Export consent**: CSV/JSON export yêu cầu xác nhận + ghi audit log
- **Legacy detection**: Tự phát hiện dữ liệu plaintext cũ → cảnh báo → auto-purge 24h
- **Session timeout**: Key tự xoá sau 30 phút idle
- **Logout detection**: Phát hiện HIS logout → wipe cache bệnh nhân

### ✨ Tính năng mới

- **Phiếu Hội chẩn**: Chỉnh sửa trực tiếp trên bảng preview, các trường liên quan tự đồng bộ
- **Slash Command**: Nút **Chỉnh sửa** inline cho templates (bên cạnh nút Xoá)
- **Định dạng chẩn đoán**: Tự động strip mã ICD-10, chuẩn hoá dấu phân cách thành dấu phẩy
- **Version sync**: Đồng bộ version tự động từ `manifest.json`

### 🐛 Sửa lỗi

- XN: PRO/BIL/GLU không còn bị phân loại sai vào nhóm "Sinh hóa"
- Linting cleanup toàn bộ codebase — 0 errors, 0 warnings
- Console error spam từ iframe-helper → chuyển `console.warn/error` thành `console.log`

---

## [1.1.9] — 2026-04-27

### 🔧 Stability Upgrade

- `resolveActiveGrid()` hỗ trợ cả **nội trú** và **ngoại trú**
- Composite patient key (`benhnhanId_khambenhId`) ngăn data leak giữa bệnh nhân
- Linting cleanup toàn bộ codebase — 0 errors, 0 warnings

---

## [1.1.7] — 2026-04-25

### 🩺 BHYT Glucose Scanner

- Fix API field mapping cho **glucose mao mạch** (hybrid timestamp strategy)
- HTML sanitization cho input bệnh nhân

---

## [1.0.0] — 2026-04-15

### 🎉 Initial Release

- **Scanner Module**: Quét buồng bệnh, thuốc, PTTT, BHYT
- **Voice AI**: Nhập liệu bằng giọng nói + AI trích xuất tự động
- **Dashboard**: Bảng thống kê lâm sàng 5 tab (Khám vào viện, Lâm sàng & Thuốc, XN, CĐHA, AI)
- **Auto-Sign**: Ký số tự động với SmartCA + nút dừng khẩn cấp
- **Desert Mystic Design**: Giao diện premium gold-amber theme

---

<div align="center">

<p><em>Built with ❤️ for Vietnamese clinicians</em></p>

<p><strong>Tác giả: Bác sĩ Huỳnh Trung Anh</strong> · Powered by Gemini AI</p>

</div>
