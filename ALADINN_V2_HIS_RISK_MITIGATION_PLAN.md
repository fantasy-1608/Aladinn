# Kế hoạch khắc phục rủi ro ảnh hưởng VNPT HIS - Aladinn V2

Tài liệu này được lập để gửi Phòng CNTT xin ý kiến trước khi thực hiện đề tài sáng kiến và trước khi triển khai bản sửa an toàn cho Aladinn V2.

## 1. Thông tin tổng quan

| Hạng mục | Nội dung |
| :--- | :--- |
| Dự án | Aladinn V2 - Chrome Extension hỗ trợ VNPT HIS |
| Phiên bản đang đánh giá | 2.0.5 |
| Mục tiêu chính | Giảm tối đa nguy cơ Aladinn làm ảnh hưởng thao tác HIS, đồng thời giữ nguyên giá trị cốt lõi của Scanner |
| Lý do lập kế hoạch | HIS đang gặp lỗi vận hành, Phòng CNTT nghi ngờ Aladinn can thiệp vào HIS |
| Triệu chứng đang được báo cáo | Có khả năng mất chẩn đoán, lỗi bệnh phụ, không lưu được thuốc; hiện chưa có bằng chứng chính xác |
| Hướng ưu tiên | Ưu tiên an toàn vận hành HIS trước, sau đó mới tối ưu lại trải nghiệm |
| Tính năng bắt buộc giữ | Scanner dữ liệu lâm sàng, đọc dữ liệu bệnh nhân, dashboard/tóm tắt phục vụ bác sĩ |
| Tính năng có thể điều chỉnh | Ký số: giữ mức cơ bản là tìm/lọc bệnh nhân, bác sĩ tự bấm ký; có thể bỏ các thao tác tự động xác nhận |
| Tính năng không được mở rộng | Không thêm luồng ghi HIS mới, không thêm quyền Chrome mới nếu không có lý do rõ ràng |
| Nguyên tắc HIS | Không vượt quyền VNPT HIS, không gọi API ghi thay bác sĩ, không gửi PHI lên AI, fail-closed khi không chắc chắn |

## 2. Kết luận định hướng gửi Phòng CNTT

Aladinn V2 không được thiết kế để can thiệp trực tiếp vào database hoặc backend VNPT HIS. Tuy nhiên, ở phiên bản 2.0.5 có một số điểm có thể ảnh hưởng đến trải nghiệm và luồng thao tác trên trình duyệt HIS.

| Nhóm rủi ro | Nhận định | Mức độ ưu tiên |
| :--- | :--- | :--- |
| Bắt toàn cục `jQuery.ajax` của HIS | Có thể làm thay đổi hành vi request trên trình duyệt, đặc biệt nếu có retry với request lưu/khám/thuốc | P0 - xử lý đầu tiên |
| Auto-sign/auto-click | Có thể tự bấm `Xác nhận`, `Đồng ý`, chuyển tab PDF khi đang ký số | P0 - chuyển sang thủ công |
| Helper điền form chạy ở mọi iframe | Có khả năng tác động nhầm vào form HIS nếu helper được nạp rộng | P1 - thu hẹp phạm vi |
| Gọi thêm API đọc | Chủ yếu là đọc, ít khả năng làm hỏng dữ liệu, nhưng có thể tăng tải HIS | P1 - giới hạn và đo đếm |
| Kill switch fail-open | Khi không tải được cấu hình từ xa thì module rủi ro vẫn có thể bật | P1 - đổi sang fail-safe cho module rủi ro |
| Kiểm thử và bằng chứng | Test pass nhưng coverage còn thấp, lint đang có lỗi | P1 - bổ sung test bắt buộc |

## 3. Nguyên tắc khắc phục

| Mã nguyên tắc | Nguyên tắc | Áp dụng cụ thể |
| :--- | :--- | :--- |
| NT-01 | Giữ Scanner là tính năng lõi | Không xóa luồng đọc dữ liệu lâm sàng đang phục vụ Scanner nếu chưa có phương án thay thế |
| NT-02 | Ký số về chế độ bác sĩ chủ động | Aladinn có thể hỗ trợ tìm/lọc bệnh nhân, nhưng bác sĩ tự bấm ký và tự bấm xác nhận |
| NT-03 | Không retry request HIS mặc định | Bất kỳ request HIS nào cũng không được tự động gọi lại nếu không xác định chắc chắn là request đọc an toàn |
| NT-04 | Helper ghi form chỉ nạp khi bác sĩ bấm xác nhận | Không nạp sẵn helper có khả năng điền hoặc giả lập input vào tất cả iframe |
| NT-05 | Remote config fail-safe | Nếu không tải được cấu hình từ xa, chỉ Scanner đọc dữ liệu được phép chạy; module rủi ro mặc định tắt |
| NT-06 | Không log PHI | Log chỉ ghi sự kiện kỹ thuật, hash ngắn, bộ đếm request; không ghi tên, mã bệnh nhân, số hồ sơ |
| NT-07 | Mọi thay đổi high-risk phải có test | Tự ký, auto-fill, API bridge, ajax interceptor, manifest đều phải có test riêng |
| NT-08 | GitNexus trước khi sửa symbol | Trước khi sửa function/class/method, chạy impact upstream và ghi lại mức ảnh hưởng |

## 4. Ranh giới tính năng sau khắc phục

| Tính năng | Trạng thái mong muốn | Được phép làm | Không được phép làm |
| :--- | :--- | :--- | :--- |
| Scanner lâm sàng | Giữ nguyên | Đọc danh sách, đọc CLS, đọc thuốc, đọc chẩn đoán, hiện dashboard, tóm tắt | Không tự lưu thuốc, không sửa chẩn đoán, không gọi API ghi |
| AI Scanner | Giữ nếu đã khử PHI | Gửi nội dung đã khử định danh, có cache theo bệnh nhân/model/prompt | Không gửi tên/mã BN/BHYT/CCCD/địa chỉ |
| CDS | Có thể bật sau khi an toàn | Cảnh báo tham khảo, không chặn thao tác HIS | Không tự sửa đơn, không tự thêm/xóa thuốc |
| Ký số | Chuyển sang manual-safe | Tìm/lọc bệnh nhân, hiện danh sách cần ký, bác sĩ tự bấm ký | Không tự bấm `Xác nhận`, `Đồng ý`, không tự chuyển tab bắt buộc |
| Auto-fill | Chỉ khi bác sĩ bấm xác nhận | Điền form sau khi đã khóa đúng bệnh nhân và hiện preview | Không điền ngầm, không gỡ disabled/readonly nếu không có allowlist |
| PTTT/PACS/Print | Ưu tiên manual | Mở hỗ trợ xem, bác sĩ tự thao tác in nếu cần | Không tự click tab/in/chọn checkbox trên HIS nếu không có xác nhận riêng |

## 5. Ma trận rủi ro và hướng khắc phục

| Mã rủi ro | Mô tả | Triệu chứng HIS có thể liên quan | File/luồng cần xem | Hướng xử lý | Tiêu chí thành công |
| :--- | :--- | :--- | :--- | :--- | :--- |
| R-01 | Aladinn thay `jQuery.ajax` toàn cục và retry lỗi | Không lưu được thuốc, request lưu bị gọi lại, HIS treo/500, dữ liệu lệch trạng thái | `injected/ajax-interceptor.js` | Gỡ retry mặc định; chỉ snoop passive; nếu cần retry thì chỉ cho request đọc có allowlist và opt-in nội bộ | Khi HIS request lỗi, Aladinn không tự gọi lại request |
| R-02 | Auto-sign tự click nút ký/xác nhận/đồng ý | Ký sai trạng thái, đóng hộp thoại nhanh, khó truy vết thao tác bác sĩ | `content/sign/signing.js`, `content/sign/auto-click-helper.js`, `background/service-worker.js`, `manifest.json` | Chuyển ký số sang manual-safe; bỏ helper auto-click khỏi `all_frames`; bác sĩ tự bấm xác nhận | Không còn code tự click `#btnConfirm`, `#alertify-ok` trong bản hospital-safe |
| R-03 | Tắt auto-sign không gửi sessionId nên background có thể không tắt sạch | Sau khi dừng ký vẫn tự chuyển tab PDF hoặc vẫn giữ autoSignEnabled | `content/sign/signing.js`, `background/service-worker.js` | Sửa `disableAutoSign` có sessionId hoặc cho phép tắt idempotent khi sender hợp lệ; thêm test session mismatch | Stop session luôn tắt sạch background auto-sign |
| R-04 | Helper điền form nạp vào tất cả iframe | Mất chẩn đoán, lỗi bệnh phụ, thay đổi ô nhập ngoài ý muốn | `manifest.json`, `content/shared/typing-effect.js`, `content/scanner/*-iframe-helper.js` | Gỡ `typing-effect.js` khỏi content_scripts all_frames; chỉ inject khi bác sĩ bấm điền form | Mở HIS bình thường không có helper điền form trong iframe nếu chưa bấm tính năng điền |
| R-05 | Helper gỡ `disabled/readonly` rộng | Ô HIS đang khóa có thể bị mở khóa trên giao diện | `content/shared/typing-effect.js`, các iframe helper | Chỉ gỡ khóa trên allowlist field được phép; lưu và khôi phục trạng thái cũ sau khi điền | Trường readonly/disabled ngoài allowlist không bị thay đổi |
| R-06 | API Bridge đọc thêm nhiều API | HIS chậm, tăng request vào `/vnpthis/RestService` | `injected/api-bridge.js`, `content/scanner/messaging.js` | Giữ allowlist đọc; thêm bộ đếm request; giới hạn theo thao tác bác sĩ; không gọi liên tục | Số request thêm mới mỗi thao tác nằm trong ngưỡng CNTT chấp nhận |
| R-07 | Chức năng PTTT print tự click tab/checkbox/print | Mở sai tab, thay đổi bộ lọc, popup in bất thường | `injected/api-bridge.js`, `content/scanner/scanner-init.js` | Tắt mặc định `TRIGGER_PTTT_PRINT`; nếu cần thì chỉ bật sau confirm riêng | Không còn tự click in/chọn checkbox khi chỉ dùng Scanner |
| R-08 | Remote config fail-open | Khi GitHub/raw bị chặn, module rủi ro vẫn bật | `background/remote-config.js`, `remote-config.json`, `content/content.js` | Scanner mặc định bật; autoSign/autoClick/formFill/cds/aiVoice mặc định tắt nếu config lỗi | Mất kết nối remote config không làm auto-sign/auto-fill tự bật |
| R-09 | Patient context fallback tạo `TEMP_` khi thiếu ID | Gán nhầm context nếu chỉ có tên/năm sinh | `content/content.js`, `content/scanner/patient-context-guard.js` | Với thao tác ghi/điền/ký: không chấp nhận `TEMP_`; bắt buộc có ít nhất 2 định danh HIS | Thiếu định danh thì chỉ cho xem, không cho điền/ký |
| R-10 | Log/diagnostic có nguy cơ lộ PHI | Tên/mã BN vào log khi debug | `shared/logger.js`, `shared/diagnostic.js`, `background/audit-logger.js` | Chuẩn hóa safe log; chỉ ghi module, event, hash ngắn, timestamp | Xuất log gửi CNTT không có tên/mã BN/BHYT/CCCD |
| R-11 | Kiểm thử chưa bao phủ luồng nguy hiểm | Lỗi khó phát hiện trước khi cài máy bác sĩ | `tests/**`, `__tests__/**` | Thêm test cho ajax no-retry, manual sign, helper on-demand, remote fail-safe | Test bắt buộc pass trước release |
| R-12 | Lint đang fail | Chất lượng code khó duyệt đề tài | Toàn repo | Sửa lint ở file liên quan, tách file playground nếu cần | `pnpm run lint` pass trước khi gửi bản mới |

## 6. Kế hoạch task chi tiết cho Antigravity

### Task P0-01 - Lập baseline và bằng chứng trước khi sửa

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Ghi nhận hiện trạng Aladinn 2.0.5 để có bằng chứng với Phòng CNTT |
| Lý do | Triệu chứng HIS chưa rõ; cần tách lỗi do HIS/backend với lỗi do extension |
| Phạm vi | Không sửa code |
| Việc cần làm | Chụp lại version extension, cấu hình feature, remote config, danh sách quyền Chrome, số máy bị lỗi/có Aladinn |
| File cần xem | `manifest.json`, `package.json`, `remote-config.json`, `background/remote-config.js` |
| Kết quả cần có | Bảng baseline: máy có Aladinn, máy không có Aladinn, module đang bật, triệu chứng gặp |
| Tiêu chí pass | Có thể trả lời: lỗi chỉ xảy ra trên máy có Aladinn hay xảy ra cả máy không có Aladinn |
| Lưu ý PHI | Không chụp tên bệnh nhân/mã BN khi gửi minh chứng |
| Prompt gợi ý cho Antigravity | "Hãy tạo một báo cáo baseline không sửa code, liệt kê quyền extension, feature flag, remote config, và các điểm Aladinn có thể tác động VNPT HIS." |

### Task P0-02 - Bỏ retry mặc định trong AJAX interceptor

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Biến `ajax-interceptor.js` thành bộ lắng nghe thụ động, không làm HIS request chạy lại |
| Rủi ro đang khắc phục | R-01 |
| File chính | `injected/ajax-interceptor.js` |
| Symbol cần impact | Hàm gán lại `_$.ajax` trong `injected/ajax-interceptor.js` |
| GitNexus bắt buộc | Chạy impact upstream cho symbol liên quan trước khi sửa; nếu HIGH/CRITICAL thì dừng và báo người phụ trách |
| Hướng sửa | Xóa `RETRY_CONFIG`; xóa `options.error` retry; không gọi `originalAjax` lần thứ hai; nếu error thì để HIS xử lý qua callback gốc |
| Điều cần giữ | Vẫn giữ token capture nếu cần; vẫn giữ snoop CDS nếu không can thiệp request |
| Điều không được làm | Không thêm retry theo status 500/timeout; không sửa body/header/url request HIS |
| Test cần thêm | Mock `$.ajax`: khi original error một lần thì callback error gốc chỉ chạy một lần, `originalAjax` không bị gọi lại |
| Test hồi quy Scanner | Scanner vẫn nhận được `ALADINN_CDS_SNOOP` khi API đọc thành công |
| Tiêu chí pass | Request HIS lỗi không bị Aladinn retry; success callback giữ đúng tham số và `this` context |
| Kiểm thử tay | Trên HIS sandbox: tạo tình huống API lỗi, xem Network không có request lặp lại do Aladinn |
| Prompt gợi ý cho Antigravity | "Sửa injected/ajax-interceptor.js để chỉ snoop passive và token capture, bỏ hoàn toàn retry mặc định. Viết test chứng minh originalAjax không bị gọi lần 2 khi lỗi." |

### Task P0-03 - Chuyển ký số sang Manual Safe Mode

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Giữ khả năng tìm/lọc bệnh nhân cần ký, bỏ tự động bấm ký/xác nhận/đồng ý |
| Rủi ro đang khắc phục | R-02, R-03 |
| File chính | `content/sign/signing.js`, `content/sign/auto-click-helper.js`, `content/sign/sign-safeclick.js`, `content/sign/sign-policy.js`, `background/service-worker.js`, `manifest.json` |
| Symbol cần impact | `startSession`, `processNextPatient`, `enableAutoOkDetection`, `disableAutoOkDetection`, `autoClickInTab`, listener `enableAutoSign/disableAutoSign/closePdfTab` |
| GitNexus bắt buộc | Chạy impact cho từng symbol trước khi sửa; đây là vùng high-risk |
| Hướng sửa 1 | Xóa `content/sign/auto-click-helper.js` khỏi `manifest.json` content script `all_frames` |
| Hướng sửa 2 | Tắt polling tự động click trong `signing.js`; không click `#btnConfirm`, `#alertify-ok`, `.alertify-button-ok` |
| Hướng sửa 3 | `disableAutoSign` phải tắt sạch state trong background; có thể cho phép tắt idempotent khi sender hợp lệ, không phụ thuộc sessionId nếu là lệnh stop |
| Hướng sửa 4 | UI ký số đổi wording: "Hỗ trợ lọc/tìm bệnh nhân - bác sĩ tự bấm ký" |
| Điều cần giữ | Lọc theo người tạo, tìm bệnh nhân, đánh dấu/hiển thị danh sách cơ bản nếu không tạo click bắt buộc |
| Điều không được làm | Không tự bấm confirm SmartCA; không tự bấm OK thành công; không tự chuyển tab PDF bắt buộc |
| Test cần thêm | Test `stopSession` gửi disable đúng và background tắt `autoSignEnabled`; test không có auto click khi xuất hiện nút `btnConfirm` |
| Test hồi quy | Chức năng lọc/tìm bệnh nhân vẫn hiển thị và không làm thay đổi đơn thuốc |
| Kiểm thử tay | Mở luồng ký, Aladinn chỉ hiện hỗ trợ; bác sĩ phải tự bấm tất cả nút ký/xác nhận |
| Tiêu chí pass | Sau 10 phút không có click tự động nào vào SmartCA/HIS; background không tự switch tab nếu không có lệnh hợp lệ |
| Prompt gợi ý cho Antigravity | "Chuyển sign module sang manual-safe: giữ filter/tìm bệnh nhân, gỡ mọi auto-click và auto PDF switch. Thêm test đảm bảo nút btnConfirm/alertify-ok không bị click tự động." |

### Task P0-04 - Remote config Hospital Safe Mode

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Nếu config từ xa lỗi, module rủi ro phải tắt; Scanner đọc dữ liệu vẫn chạy |
| Rủi ro đang khắc phục | R-08 |
| File chính | `background/remote-config.js`, `remote-config.json`, `content/content.js`, `popup/popup.js` |
| Symbol cần impact | `DEFAULT_CONFIG`, `getRemoteConfig`, `isFeatureEnabled`, `applyRemoteConfig` |
| GitNexus bắt buộc | Impact cho `applyRemoteConfig` và các hàm remote config trước khi sửa |
| Hướng sửa | Đổi default: `scanner: true`, `autoSign: false`, `autoClick: false`, `aiVoice: false`, `cdsEngine: false` nếu không có config |
| Tách flag | Không dùng `autoSign=false` để tắt toàn bộ Sign UI; cần tách `manualSign` hoặc `signSearch` với `autoSign` |
| Điều cần giữ | Scanner không phụ thuộc remote config để chạy cơ bản |
| Điều không được làm | Không fail-open auto-sign/auto-fill khi mất Internet/GitHub |
| Test cần thêm | Mock fetch remote fail: scanner true, autoSign false, autoClick false |
| Kiểm thử tay | Chặn GitHub raw, reload extension, kiểm tra Scanner còn chạy và auto-sign không chạy |
| Tiêu chí pass | Máy bệnh viện mất Internet vẫn không bật module rủi ro |
| Prompt gợi ý cho Antigravity | "Sửa remote-config thành Hospital Safe Mode: fail-safe cho autoSign/autoClick/aiVoice/cds, giữ scanner true. Tách manual sign UI khỏi autoSign." |

### Task P1-01 - Thu hẹp helper điền form, chỉ inject khi bác sĩ xác nhận

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Không nạp sẵn helper có khả năng điền/giả lập input vào mọi iframe HIS |
| Rủi ro đang khắc phục | R-04, R-05 |
| File chính | `manifest.json`, `content/shared/typing-effect.js`, `content/scanner/clinical-fill.js`, `content/scanner/history.js`, các `*-iframe-helper.js` |
| Symbol cần impact | `fillFormSequential`, `setValAnimated`, `triggerHisEvents`, `injectHelper`, `sendCmd` |
| GitNexus bắt buộc | Impact cho từng symbol trước khi sửa |
| Hướng sửa 1 | Gỡ `content/shared/typing-effect.js` khỏi `content_scripts` all_frames trong `manifest.json` |
| Hướng sửa 2 | Chỉ inject `typing-effect.js` vào iframe mục tiêu sau khi bác sĩ bấm nút "Điền vào form" trên preview |
| Hướng sửa 3 | Thêm allowlist trường được phép gỡ `readonly/disabled`; nếu không nằm trong allowlist thì bỏ qua |
| Hướng sửa 4 | Sau khi điền, khôi phục trạng thái `readonly/disabled` ban đầu nếu đã tạm mở |
| Điều cần giữ | Luồng điền form có preview và PatientContextGuard vẫn hoạt động |
| Điều không được làm | Không quét và điền ngầm khi chỉ mở HIS; không tác động form thuốc/chẩn đoán nếu không phải luồng đã xác nhận |
| Test cần thêm | Khi load HIS, `window.VNPT_TypingEffect` không tồn tại trong iframe nếu chưa inject; khi bấm fill mới có |
| Test readonly | Field readonly ngoài allowlist không bị thay đổi; field allowlist được khôi phục readonly sau fill |
| Kiểm thử tay | Mở form bệnh án/thuốc, không bấm Aladinn, kiểm tra HIS lưu/khám/thuốc bình thường |
| Tiêu chí pass | Helper ghi form chỉ tồn tại trong vùng được thao tác chủ động |
| Prompt gợi ý cho Antigravity | "Thu hẹp typing-effect: xóa khỏi manifest all_frames, chỉ inject on-demand sau preview confirm, thêm allowlist và test readonly/disabled." |

### Task P1-02 - Khóa chặt Patient Context cho mọi thao tác ghi/điền/ký

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Nếu không chắc đúng bệnh nhân thì không cho điền form/ký |
| Rủi ro đang khắc phục | R-09 |
| File chính | `content/scanner/patient-context-guard.js`, `content/shared/patient-context-guard.js`, `content/content.js`, `content/voice/autofill.js`, `content/scanner/clinical-fill.js` |
| Symbol cần impact | `capture`, `captureGridOnly`, `validate`, `assertValidOrThrow`, `scanActiveDialogPatientContext`, `autoFillForm` |
| GitNexus bắt buộc | Impact trước khi sửa các symbol trên |
| Hướng sửa | Tạo context key gồm tối thiểu 2 định danh HIS: `BENHNHANID`, `KHAMBENHID/MADIEUTRI`, `HOSOBENHANID/HSBAID`, `rowId` |
| Luật mới | `TEMP_` chỉ được dùng để hiển thị popup, không được dùng cho fill/sign/write |
| Điều cần giữ | Scanner đọc/preview vẫn cho xem nếu thiếu ID, nhưng nút điền/ký bị khóa |
| Điều không được làm | Không cho thao tác ghi khi chỉ có tên và năm sinh |
| Test cần thêm | Thiếu patientId block fill; encounter mismatch block fill; patient changed before write block fill |
| Kiểm thử tay | Chọn BN A, tạo preview, chuyển sang BN B, bấm điền: phải bị chặn |
| Tiêu chí pass | Tất cả thao tác có tác động form/ký đều fail-closed khi thiếu hoặc lệch context |
| Prompt gợi ý cho Antigravity | "Tăng PatientContextGuard: yêu cầu composite HIS identifiers cho fill/sign, không chấp nhận TEMP_ cho write. Thêm tests missing patient, encounter mismatch, patient changed." |

### Task P1-03 - Giới hạn API Bridge ở chế độ đọc và đo đếm tải

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Scanner vẫn đọc dữ liệu, nhưng mọi request đều nằm trong allowlist và có giới hạn |
| Rủi ro đang khắc phục | R-06, R-07 |
| File chính | `injected/api-bridge.js`, `content/scanner/messaging.js`, `content/scanner/scanner-init.js` |
| Symbol cần impact | `_fetchHisPagingRows`, `_asyncCallSpO`, `sendResult`, `triggerPtttPrint`, message switch trong API bridge |
| GitNexus bắt buộc | Impact cho các symbol trước khi sửa |
| Hướng sửa 1 | Tạo bảng `READ_ONLY_INTENTS` gồm các request Scanner được phép |
| Hướng sửa 2 | Tắt mặc định `TRIGGER_PTTT_PRINT`; nếu giữ thì bắt buộc confirm riêng và setting riêng |
| Hướng sửa 3 | Thêm bộ đếm request theo 10 giây/phút, log số lượng không PHI |
| Hướng sửa 4 | Nếu vượt ngưỡng, dừng gọi API mới và hiện thông báo "Scanner tạm dừng để tránh tăng tải HIS" |
| Điều cần giữ | Các API đọc lịch sử, CLS, thuốc, chẩn đoán phục vụ Scanner |
| Điều không được làm | Không thêm request POST/PUT/DELETE; không gọi stored procedure tùy ý |
| Test cần thêm | Intent không có trong allowlist bị chặn; `TRIGGER_PTTT_PRINT` bị chặn khi setting tắt |
| Kiểm thử tay | Quét phòng đông bệnh nhân và ghi lại số request thêm mới |
| Tiêu chí pass | Phòng CNTT có số liệu để đánh giá tải thêm của Scanner |
| Prompt gợi ý cho Antigravity | "Hardening api-bridge: READ_ONLY_INTENTS, tắt TRIGGER_PTTT_PRINT mặc định, thêm request counter không PHI và tests allowlist." |

### Task P1-04 - Chuẩn hóa log an toàn để gửi Phòng CNTT

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Có log kỹ thuật để đối chiếu sự cố mà không lộ thông tin bệnh nhân |
| Rủi ro đang khắc phục | R-10 |
| File chính | `shared/logger.js`, `shared/diagnostic.js`, `background/audit-logger.js`, `shared/audit-telemetry.js` |
| Symbol cần impact | Các hàm log/audit hiện có |
| GitNexus bắt buộc | Impact trước khi sửa các hàm log dùng chung |
| Nội dung log được phép | Version, module, event, timestamp, feature flag, request count, trạng thái block/allow |
| Nội dung cấm log | Họ tên, mã BN, mã HSBA, BHYT, CCCD, địa chỉ, nội dung bệnh án, đơn thuốc thực tế |
| Hướng sửa | Tạo hàm sanitize chung trước mọi log; nếu không chắc thì thay bằng `[REDACTED]` |
| Test cần thêm | Log không chứa chuỗi giống BHYT/CCCD/SĐT/mã BN dài |
| Kiểm thử tay | Export diagnostic và đưa Phòng CNTT xem mẫu |
| Tiêu chí pass | Log đủ dùng để truy vết module nào tác động mà không có PHI |
| Prompt gợi ý cho Antigravity | "Chuẩn hóa safe logging: mọi diagnostic/audit phải sanitize PHI, thêm tests regex để đảm bảo không lộ tên/mã/số." |

### Task P1-05 - Sửa lint và tăng coverage cho vùng high-risk

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Bản nộp CNTT và bản release phải có chất lượng kiểm thử tốt hơn |
| Rủi ro đang khắc phục | R-11, R-12 |
| File chính | `content/shared/typing-effect.js`, `content/scanner/history-iframe-helper.js`, `.playground/**`, `test-*.js`, `tests/**` |
| Hướng sửa | Sửa lỗi lint trong file runtime; với playground/test thử nghiệm thì cần tách config lint hoặc thêm globals đúng cách |
| Test bắt buộc | `pnpm run lint`, `pnpm run test`, `pnpm run test:coverage`, `pnpm run build` |
| Coverage mục tiêu ngắn hạn | Tăng coverage vùng high-risk, chưa cần đạt 80% toàn repo ngay nếu quá lớn |
| Coverage mục tiêu vùng rủi ro | `ajax-interceptor`, `signing manual-safe`, `remote-config`, `patient-context-guard`, `typing-effect` phải có test riêng |
| Tiêu chí pass | 0 lint error; test/build pass; có test cho tất cả thay đổi P0/P1 |
| Prompt gợi ý cho Antigravity | "Sửa lint runtime và thêm tests cho các task safety. Ưu tiên high-risk modules hơn coverage toàn repo." |

### Task P2-01 - Tài liệu hóa quy trình pilot với Phòng CNTT

| Mục | Nội dung |
| :--- | :--- |
| Mục tiêu | Có quy trình thử nghiệm rõ ràng để Phòng CNTT phê duyệt sáng kiến |
| File cần tạo/cập nhật | `docs/pilot/pilot-acceptance-criteria.md`, `docs/pilot/pilot-rollback-guide.md`, `CHANGELOG.md` |
| Nội dung cần có | Cách cài bản safe, cách tắt nhanh, cách đối chiếu lỗi, số máy pilot, cách báo cáo sự cố |
| Điều kiện pilot | Chạy 3 nhóm: không Aladinn, Aladinn Scanner-only, Aladinn Scanner + manual sign |
| Thời gian đề xuất | 1-2 tuần pilot nội bộ trước khi mở rộng |
| Chỉ số theo dõi | Lỗi lưu thuốc, lỗi chẩn đoán/bệnh phụ, tốc độ tải danh sách, số lần user báo lỗi, số request thêm |
| Tiêu chí dừng pilot | Bất kỳ dấu hiệu sai bệnh nhân, sai dữ liệu, làm HIS không lưu được thì dừng ngay |
| Tiêu chí tiếp tục | Không tăng lỗi HIS so với nhóm không cài Aladinn; bác sĩ xác nhận Scanner có giá trị |
| Prompt gợi ý cho Antigravity | "Cập nhật docs pilot/rollback/acceptance criteria cho Aladinn Hospital Safe Mode, viết để Phòng CNTT và bác sĩ không chuyên code đọc được." |

## 7. Thứ tự thực hiện đề xuất

| Thứ tự | Task | Lý do ưu tiên | Có ảnh hưởng Scanner không | Kết quả mong muốn |
| :--- | :--- | :--- | :--- | :--- |
| 1 | P0-01 Baseline | Cần bằng chứng trước khi sửa | Không | Có dữ liệu để trao đổi với CNTT |
| 2 | P0-02 Bỏ AJAX retry | Rủi ro lớn nhất với lỗi lưu thuốc/chẩn đoán | Không, nếu chỉ bỏ retry | HIS request không bị gọi lại |
| 3 | P0-03 Manual Safe Sign | Rủi ro auto-click cao, user đồng ý bỏ tự động | Không | Ký số không tự bấm |
| 4 | P0-04 Hospital Safe Mode | Cần cấu hình an toàn khi mất config | Không | Scanner bật, module rủi ro tắt |
| 5 | P1-01 Helper on-demand | Giảm nguy cơ điền nhầm iframe | Không với Scanner đọc; có thể ảnh hưởng auto-fill cần test | Helper chỉ nạp khi bấm điền |
| 6 | P1-02 Context Guard | Chặn nhầm bệnh nhân | Không | Fill/sign fail-closed |
| 7 | P1-03 API bridge allowlist | Giảm tải và tăng minh bạch | Không nếu giữ read intents | Có đếm request và giới hạn |
| 8 | P1-04 Safe log | Có bằng chứng không PHI | Không | Export log gửi CNTT |
| 9 | P1-05 Lint/test | Chất lượng bản phát hành | Không | Lint/test/build pass |
| 10 | P2-01 Pilot docs | Hoàn thiện hồ sơ sáng kiến | Không | Có quy trình triển khai |

## 8. Checklist không làm hỏng Scanner

| Luồng Scanner | Cần giữ | Cách kiểm tra |
| :--- | :--- | :--- |
| Khởi động Scanner trên HIS | Menu/panel Scanner vẫn hiện | Cài extension, mở HIS, thấy Scanner sẵn sàng |
| Chọn bệnh nhân | Store cập nhật đúng bệnh nhân | Chọn BN A/B, popup/panel hiện đúng tên/context |
| Đọc lịch sử điều trị | Lấy được lịch sử và y lệnh | Bấm quét lịch sử, có timeline |
| Đọc CLS | Lấy được xét nghiệm, CĐHA nếu có | Bấm quét CLS, có bảng kết quả |
| Đọc thuốc | Lấy được danh sách thuốc để phân tích | Bấm quét thuốc, có danh sách |
| AI Scanner | Vẫn phân tích sau khi khử PHI | Bấm phân tích, không gửi PHI |
| Cache AI | Rerun vẫn bypass cache đúng cách | Bấm phân tích lại, có request mới |
| Dashboard | Không bị mất filter/phòng | Mở dashboard, lọc phòng, clear filter |
| Patient guard | Chuyển BN giữa lúc preview thì bị chặn fill | Preview BN A, chọn BN B, bấm điền -> bị chặn |

## 9. Kiểm thử bắt buộc trước khi gửi bản mới

| Lệnh/kiểm thử | Mục đích | Kết quả bắt buộc |
| :--- | :--- | :--- |
| `pnpm run lint` | Kiểm tra lỗi code | Pass, 0 error |
| `pnpm run test` | Kiểm tra unit/integration | Pass |
| `pnpm run test:coverage` | Kiểm tra coverage | Pass; high-risk modules có test mới |
| `pnpm run build` | Đóng gói extension | Pass |
| GitNexus detect changes | Xem symbol/flow bị ảnh hưởng | Chỉ ảnh hưởng các module đã dự kiến |
| Manual HIS sandbox | Kiểm tra luồng thực tế | Không lỗi lưu, không mất chẩn đoán/bệnh phụ, không auto-click |
| Chrome Network check | Xem request HIS | Không có retry tự động; request đọc nằm trong allowlist |
| PHI log check | Kiểm tra diagnostic | Không có tên/mã BN/BHYT/CCCD |

## 10. Kịch bản test với Phòng CNTT

| Kịch bản | Máy không cài Aladinn | Máy cài Aladinn Safe | Kết quả mong muốn |
| :--- | :--- | :--- | :--- |
| Mở danh sách bệnh nhân | Tải bình thường | Tải bình thường | Không chậm hơn rõ rệt |
| Sửa chẩn đoán chính/phụ | Lưu được | Lưu được | Không mất chẩn đoán/bệnh phụ |
| Lưu thuốc | Lưu được | Lưu được | Không lỗi, không lặp request |
| Mở Scanner | Không có | Có | Scanner đọc, không ghi HIS |
| Dùng AI Scanner | Không có | Có | Không gửi PHI |
| Ký số manual | HIS gốc | Bác sĩ tự bấm | Aladinn không tự bấm confirm/OK |
| Mất Internet/GitHub | HIS vẫn chạy | Scanner vẫn chạy, module rủi ro tắt | Không fail-open auto-sign |
| Reload/F5 HIS | Bình thường | Bình thường | Không còn helper ghi form chạy ngầm |

## 11. Đề xuất phiên bản phát hành

| Phiên bản | Mục đích | Nội dung |
| :--- | :--- | :--- |
| 2.0.5 Safety Patch | Xử lý nghi ngờ khẩn cấp | Bỏ ajax retry, tắt auto-click ký số, remote safe mode, helper on-demand |
| 2.1.0 Hospital Safe Mode | Bản nộp đề tài/pilot rộng hơn | Thêm dashboard diagnostic, pilot docs, request counter, test đầy đủ |

## 12. Các việc không nên làm trong đợt sửa này

| Không nên làm | Lý do |
| :--- | :--- |
| Thêm tính năng mới | Sẽ làm khó đánh giá nguyên nhân HIS lỗi |
| Đổi UI Scanner lớn | Có nguy cơ gây nhầm lẫn khi pilot |
| Thêm quyền Chrome mới | Phòng CNTT sẽ khó phê duyệt hơn |
| Gọi API ghi trực tiếp | Vi phạm ranh giới an toàn HIS |
| Giữ auto-click ký số trong bản pilot | Khó thuyết phục Phòng CNTT khi đang nghi ngờ can thiệp |
| Ghi log chi tiết bệnh án | Rủi ro PHI và không cần cho điều tra kỹ thuật |

## 13. Mẫu báo cáo tóm tắt gửi Phòng CNTT

| Nội dung | Diễn giải ngắn gọn |
| :--- | :--- |
| Cam kết ranh giới | Aladinn bản safe chỉ đọc dữ liệu phục vụ Scanner, không thay thế HIS, không ghi backend |
| Biện pháp giảm rủi ro | Bỏ retry AJAX, bỏ auto-click ký số, helper điền form chỉ chạy khi bác sĩ xác nhận |
| Bằng chứng kỹ thuật | Có test, build, request counter, log không PHI |
| Lỗi đang theo dõi | Mất chẩn đoán, lỗi bệnh phụ, không lưu được thuốc |
| Cách loại trừ | So sánh máy không Aladinn, Aladinn Scanner-only, Aladinn safe |
| Tiêu chí dừng | Bất kỳ dấu hiệu sai bệnh nhân/sai dữ liệu/không lưu HIS thì dừng pilot |
| Giá trị sáng kiến | Scanner giúp bác sĩ đọc nhanh lịch sử, CLS, thuốc, cảnh báo tham khảo; bác sĩ vẫn quyết định và thao tác lưu/ký |

## 14. Definition of Done tổng thể

Một task chỉ được coi là xong khi đáp ứng tất cả mục sau:

| Nhóm | Điều kiện |
| :--- | :--- |
| An toàn HIS | Không thêm API ghi, không auto-click trên HIS, không retry request HIS mặc định |
| Scanner | Các luồng đọc chính của Scanner vẫn chạy |
| Patient safety | Thiếu/lệch context thì block fill/sign |
| Bảo mật | Không log PHI, không gửi PHI lên AI |
| Kiểm thử | Lint/test/coverage/build pass hoặc có lý do chấp nhận bằng văn bản |
| GitNexus | Impact trước khi sửa symbol, detect changes trước khi commit |
| Tài liệu | Cập nhật changelog/pilot docs nếu thay đổi hành vi người dùng |

