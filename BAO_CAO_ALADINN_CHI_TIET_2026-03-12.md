# BÁO CÁO CHI TIẾT ALADINN

Ngày cập nhật: 2026-03-12

## 1) Mục tiêu báo cáo

Tài liệu này tổng hợp:

- Các điểm yếu kỹ thuật của dự án Aladinn hiện tại.
- Định hướng phát triển theo từng giai đoạn.
- Danh sách công việc cần làm, thứ tự ưu tiên, và các lưu ý khi triển khai.
- Mục tiêu đo lường để giảm thời gian nhập liệu hành chính cho bác sĩ.

Mục tiêu nghiệp vụ trung tâm:

- Giải phóng nhân viên y tế khỏi thao tác hành chính lặp lại.
- Tăng tỷ lệ tự động hóa nhập bệnh án nhưng vẫn giữ an toàn y khoa (bác sĩ duyệt cuối).
- Giảm thời gian nhập liệu/ca khám từ mức hiện tại (~5x thời gian khám) về mức có thể vận hành bền vững.

## 2) Phạm vi đánh giá

Đánh giá được thực hiện trên codebase hiện tại trong root project:

- `manifest.json`
- `background/*`
- `content/*` (scanner, voice, sign, shared)
- `injected/*`
- `popup/*`
- `options/*`
- `styles/*`

Không tính các thư mục "Bản sao ..." vì là bản lịch sử/backup.

## 3) Tổng quan hiện trạng kiến trúc

Aladinn hiện là Chrome Extension MV3, hợp nhất 3 nhóm chức năng:

1. Voice AI: nhận transcript, gọi AI, gợi ý nội dung và auto-fill.
2. Scanner: quét thông tin bệnh nhân, sinh hiệu, lịch sử điều trị, đổ dữ liệu vào bệnh án.
3. Sign: lọc hồ sơ, điều hướng luồng ký số, auto-click xác nhận/OK.

Điểm mạnh:

- Đã có tư duy module hóa.
- Đã có cơ chế retry, event bridge, và một số guard an toàn.
- Đã giải quyết được bài toán "thực chiến HIS" (iframe, jqGrid, selector đa dạng).

Hạn chế:

- Nhiều logic polling/DOM scan tần suất cao.
- Tải toàn bộ module trên mọi frame ngay từ đầu.
- Dữ liệu nhạy cảm (PIN/API key) còn tồn tại dạng plaintext.
- Chưa có bộ test và quan trắc để giữ ổn định khi mở rộng.

## 4) Danh sách vấn đề cần khắc phục

## 4.1 Nhóm P0 - Bắt buộc xử lý trước (an toàn + độ ổn định)

### P0.1 Lưu trữ PIN/API key dạng plaintext

Tác động:

- Rủi ro rò rỉ thông tin truy cập AI và bảo mật.
- Không phù hợp với yêu cầu an toàn dữ liệu nhạy cảm.

Dấu hiệu trong code:

- `options/options.js`: đọc/ghi `dashboard_password`, `geminiApiKey` trực tiếp.
- `content/voice/storage.js`: sử dụng `dashboard_password` để mở khóa.

Cần thực hiện:

1. Không lưu PIN gốc, chỉ lưu hash (PBKDF2/Argon2 tùy khả năng).
2. API key phải mã hóa bằng key runtime (derive từ PIN + salt).
3. Thêm cơ chế migration từ dữ liệu cũ -> định dạng mới.
4. Thêm cơ chế force re-auth khi đổi PIN.

Lưu ý triển khai:

- Tránh làm mất dữ liệu người dùng cũ.
- Cần rollback kế hoạch nếu migration lỗi.

Tiêu chí hoàn thành:

- Không còn plaintext PIN/API key trong storage.
- Kiểm thử nâng cấp không làm mất cấu hình.

### P0.2 Tải quá nhiều script vào all_frames

Tác động:

- Tăng thời gian khởi tạo, tăng memory, có thể lag màn hình HIS.

Dấu hiệu trong code:

- `manifest.json`: content script lớn + `all_frames: true`.

Cần thực hiện:

1. Tách "bootstrap nhẹ" và "module nặng".
2. Lazy-load module theo feature đang bật và theo context trang.
3. Chỉ init frame nào cần thiết (scanner helper frame riêng).

Lưu ý triển khai:

- Đảm bảo không vỡ luồng Sign/Scanner trên các iframe đặc thù.

Tiêu chí hoàn thành:

- Giảm thời gian khởi tạo extension.
- Giảm CPU spike khi mở tab HIS.

### P0.3 Polling và quét DOM dày đặc

Tác động:

- Tiêu tốn CPU, gây giật lag trong ca trực dài.
- Làm giảm trải nghiệm và tốc độ nhập liệu.

Dấu hiệu trong code:

- `content/sign/signing.js` (polling 300ms)
- `content/sign/sign-init.js` (interval 1s)
- `content/scanner/row-observer.js` (interval 2s)
- `injected/grid-hook.js` (interval kiểm tra)

Cần thực hiện:

1. Chuyển sang event-driven tối đa (MutationObserver có phạm vi hẹp + debounce).
2. Đặt lifecycle rõ ràng: khi nào bật observer, khi nào tắt.
3. Bỏ scan tổng quát toàn trang, thay bằng selector mục tiêu.

Lưu ý triển khai:

- HIS dùng iframe + dynamic UI, cần test trên nhiều khoa/màn hình.

Tiêu chí hoàn thành:

- CPU trung bình trên tab HIS giảm rõ.
- Không mất sự kiện ký số.

### P0.4 Logic đóng modal có nguy cơ click nhầm

Tác động:

- Có thể đóng nhầm thao tác quan trọng, tác động an toàn nghiệp vụ.

Dấu hiệu trong code:

- `content/sign/signing.js`: fallback quét `button, a, span, div...` theo text/class.

Cần thực hiện:

1. Giới hạn context "chỉ trong modal đang active".
2. Thêm guard theo title/dialog id và xác nhận trạng thái trước khi click.
3. Thêm dry-run mode + log explain button được chọn.

Lưu ý triển khai:

- Ưu tiên "an toàn hơn tốc độ" ở bước đóng modal.

Tiêu chí hoàn thành:

- Không còn đóng nhầm popup không liên quan.

## 4.2 Nhóm P1 - Tăng hiệu suất và độ tin cậy

### P1.1 Bug shadow variable trạng thái VIP

Dấu hiệu:

- `content/scanner/history.js`: `isVipActive` bị khai báo lại trong khối.

Tác động:

- Trạng thái UI VIP có thể sai, hành vi không nhất quán.

Cần thực hiện:

1. Sửa shadow variable.
2. Viết test luồng tab A/B + toggle VIP.

### P1.2 Thiếu bộ test tự động cho bản hiện tại

Tác động:

- Mỗi lần sửa dễ gây hồi quy không biết.

Cần thực hiện:

1. Tạo test khung cho 3 luồng: scan, voice, sign.
2. Thêm smoke test cho các selector quan trọng.
3. Thêm test migration storage.

### P1.3 Thiếu telemetry vận hành

Cần thực hiện:

1. Thu KPI nội bộ:
   - `time_to_first_fill`
   - `time_to_sign_complete`
   - `retry_count`
   - `autofill_success_rate`
2. Dashboard nhẹ trong popup/options.

## 4.3 Nhóm P2 - Tiến hóa sản phẩm (giảm nhập liệu sâu hơn)

1. Template theo chuyên khoa/ca trực.
2. Confidence score theo từng trường dữ liệu.
3. Rule engine theo bệnh viện (mapping selector, field id, vị trí tab).
4. Auto-pilot theo encounter (chạy chuỗi bán tự động + bác sĩ duyệt cuối).

## 5) Lộ trình phát triển theo giai đoạn

## Giai đoạn 0 (1-2 tuần): Chuẩn hóa nền

Mục tiêu:

- Ổn định codebase để sẵn sàng tối ưu.

Cần làm:

1. Dọn cấu trúc repo:
   - Tách/lưu trữ thư mục backup ra ngoài branch chính.
   - Thêm tài liệu architecture + coding conventions.
2. Thiết lập quality gate:
   - ESLint + Prettier + check script cơ bản.
3. Khởi tạo test harness:
   - Unit test cho utils/storage.
   - Smoke test script cho trang HIS giả lập.

Cần chú ý:

- Không cần đổi lớn logic nghiệp vụ ở giai đoạn này.

Deliverable:

- Build ổn định, có script test tối thiểu, repo gọn.

## Giai đoạn 1 (2-4 tuần): Bảo mật + hiệu năng nền tảng (P0)

Mục tiêu:

- Giảm lag rõ rệt và loại bỏ rủi ro bảo mật chính.

Cần làm:

1. Bảo mật storage:
   - Hash PIN.
   - Mã hóa API key.
   - Migration dữ liệu cũ.
2. Tối ưu tải script:
   - Bootstrap nhẹ.
   - Lazy-load module.
   - Giảm `all_frames` ở phần không cần.
3. Cắt polling:
   - Refactor Sign/Scanner sang event lifecycle.
4. Hardening thao tác click:
   - Restrict context modal.
   - Add guard "safe click".

Cần chú ý:

- Quản lý backward compatibility với HIS selector hiện có.
- Cần test trên dữ liệu bệnh nhân thật (ẩn danh) trước rollout.

Deliverable:

- Bản "stable core" có metric CPU/latency tốt hơn bản hiện tại.

## Giai đoạn 2 (4-8 tuần): Tự động hóa nhập liệu có kiểm soát

Mục tiêu:

- Cắt giảm thao tác thủ công lặp lại.

Cần làm:

1. Encounter Autopilot v1:
   - Chọn bệnh nhân -> lấy history/vitals -> fill field -> chờ duyệt.
2. Checklist duyệt nhanh:
   - Highlight field đã điền.
   - Hiện confidence score.
3. Template hóa:
   - Theo khoa (nội/ngoại/cấp cứu) + theo loại bệnh án.

Cần chú ý:

- Không cho phép auto-sign nếu chưa qua bước duyệt.

Deliverable:

- Luồng "1 nút - 1 ca" ban đầu cho 1-2 khoa ưu tiên.

## Giai đoạn 3 (8-12 tuần): Tối ưu theo dữ liệu thực tế

Mục tiêu:

- Tăng tốc liên tục dựa trên KPI sử dụng thật.

Cần làm:

1. Telemetry dashboard:
   - Số ca dùng autopilot.
   - Tỷ lệ tự động hóa field.
   - Thời gian tiết kiệm mỗi ca.
2. Rule engine theo bệnh viện:
   - Mapping động cho selector/field khác nhau.
3. Cơ chế retry thông minh:
   - Ký số, popup, timeout API.

Cần chú ý:

- Tránh over-automation gây mất kiểm soát nghiệp vụ.

Deliverable:

- Bản có thể nhân rộng sang nhiều khoa/bệnh viện.

## Giai đoạn 4 (12 tuần+): Chuẩn hóa sản phẩm và mở rộng

Mục tiêu:

- Biến Aladinn thành trợ lý y khoa vận hành bền vững.

Cần làm:

1. Standard package:
   - Cấu hình theo bệnh viện.
   - Bản release notes + changelog.
2. Governance:
   - Quy trình cập nhật selector an toàn.
   - Quyền và audit log.
3. Tích hợp sâu:
   - Lịch sử bệnh án điện tử, order sets, cảnh báo quy trình.

## 6) Danh sách việc cần làm cụ thể (checklist thực thi)

## 6.1 Bảo mật

- [ ] Thay `dashboard_password` bằng `pin_hash + salt`.
- [ ] Mã hóa `geminiApiKey` trước khi lưu.
- [ ] Thêm migration one-time + backup trước migration.
- [ ] Khóa panel nếu context bị invalid/reload.

## 6.2 Hiệu năng

- [ ] Tách bootstrap script (`content/bootstrap.js`).
- [ ] Chỉ khởi tạo module theo feature đang bật.
- [ ] Giảm polling: thay bằng observer lifecycle.
- [ ] Cache selector nóng.
- [ ] Tối ưu thao tác `querySelectorAll` lặp lại.

## 6.3 Độ ổn định nghiệp vụ

- [ ] Safe-click framework cho Sign.
- [ ] State machine rõ ràng cho workflow ký.
- [ ] Timeout/retry có giới hạn cho fetch history/treatment.
- [ ] Add lock tránh chạy đồng thời 2 workflow.

## 6.4 Kiểm thử

- [ ] Unit test cho storage migration.
- [ ] Unit test cho parser/history mapping.
- [ ] Smoke test luồng sign modal.
- [ ] Regression test trước mỗi release.

## 6.5 Quan trắc

- [ ] Log sự kiện có cấu trúc.
- [ ] KPI time-to-fill, time-to-sign, fail-rate.
- [ ] Biểu đồ so sánh trước/sau mỗi bản tối ưu.

## 7) Chỉ số thành công để theo dõi

KPI nghiệp vụ:

1. Thời gian nhập liệu hành chính trung bình/ca.
2. Tỷ lệ field được auto-fill đúng ngay lần đầu.
3. Số click trung bình/hồ sơ.
4. Tỷ lệ ký thành công không cần can thiệp.

KPI kỹ thuật:

1. CPU trung bình tab HIS khi extension hoạt động.
2. Memory footprint extension.
3. Tỷ lệ lỗi runtime/content script.
4. TLB (time to load bootstrap).

Mục tiêu đề xuất:

- 4-6 tuần: giảm 40-55% thời gian nhập liệu.
- 8-12 tuần: hướng tới giảm 60-70% nếu KPI đạt ngưỡng.

## 8) Các lưu ý quan trọng khi triển khai trong môi trường bệnh viện

1. Ưu tiên an toàn dữ liệu bệnh nhân:
   - Hạn chế dữ liệu gửi AI.
   - Ẩn danh khi có thể.

2. Luôn duy trì "bác sĩ duyệt cuối":
   - Không auto-sign vô điều kiện.
   - Không ghi đè thông tin quan trọng khi confidence thấp.

3. Triển khai theo khoa nhỏ trước:
   - Chọn 1 khoa pilot.
   - Thu thập KPI trước/sau.
   - Mở rộng sau khi ổn định.

4. Quản lý thay đổi:
   - Có hướng dẫn thao tác ngắn.
   - Có rollback plan nếu HIS đổi giao diện.

## 9) Kế hoạch làm việc khi bạn "có thời gian"

Nếu bạn chỉ có ít thời gian, ưu tiên theo khung sau:

Khung 6-8 giờ:

1. Sửa P0.1 (PIN/API key).
2. Sửa P0.4 (safe-close modal).
3. Fix bug P1.1 (VIP shadow variable).

Khung 12-16 giờ:

1. Làm thêm P0.2 (lazy-load).
2. Cắt bớt 2 polling nóng nhất (signing + sign-init).

Khung 20-30 giờ:

1. Hoàn tất P0/P1 chính.
2. Thêm telemetry và test smoke.
3. Chuẩn bị Encounter Autopilot v1.

## 10) Kết luận

Aladinn đã có nền tảng rất tốt để trở thành "trợ lý giảm nhập liệu hành chính" cho bác sĩ. Để đạt mục tiêu này bền vững, cần ưu tiên:

1. Bảo mật storage.
2. Cắt polling + tối ưu khởi tạo.
3. Chuẩn hóa workflow an toàn khi ký.
4. Đo lường hiệu quả bằng KPI thực tế.

Sau khi hoàn tất P0/P1, dự án có thể bước vào giai đoạn tăng tốc tự động hóa nghiệp vụ và giảm mạnh gánh nặng nhập liệu cho nhân viên y tế.
