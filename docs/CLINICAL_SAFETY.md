# An Toàn Lâm Sàng (Clinical Safety) & Hướng Dẫn Vận Hành

Tài liệu này quy định ranh giới hoạt động và các nguyên tắc an toàn lâm sàng bắt buộc đối với hệ thống **Aladinn — Trợ lý AI VNPT HIS**. Hệ thống được thiết kế để hỗ trợ, không thay thế quyết định y khoa của bác sĩ.

## 1. Tuyên bố từ chối trách nhiệm (Disclaimer)
- **Aladinn là công cụ hỗ trợ**: Mọi phân tích, tóm tắt, gợi ý ICD-10 và cảnh báo CDS từ AI chỉ mang tính chất tham khảo.
- **Bác sĩ chịu trách nhiệm cuối cùng**: Người dùng (bác sĩ, điều dưỡng) phải đọc lại toàn bộ thông tin do AI điền tự động hoặc gợi ý trước khi bấm lưu hồ sơ hay ký số. Hệ thống AI và đội ngũ phát triển không chịu trách nhiệm pháp lý đối với các sai sót chuyên môn xuất phát từ việc quá phụ thuộc vào hệ thống.

## 2. Quy tắc an toàn bắt buộc đối với AI
- **Không tự động ra y lệnh**: AI tuyệt đối không tự động thêm thuốc, chỉ định cận lâm sàng hay phẫu thuật.
- **Fail-Closed**: Nếu có bất kỳ nghi ngờ nào về việc lệch hồ sơ bệnh nhân (Patient Mismatch), API lỗi, hoặc phản hồi từ AI không đúng định dạng (Schema Error), hệ thống sẽ chủ động chặn việc điền dữ liệu (Auto-fill Block) và hiển thị cảnh báo.
- **CDS (Clinical Decision Support)**: Hệ thống cảnh báo tương tác thuốc và chống chỉ định dựa trên dữ liệu tham khảo, có thể xảy ra cảnh báo giả (false positive) hoặc bỏ sót (false negative). Bác sĩ cần tự đánh giá mức độ nghiêm trọng trên từng bệnh nhân cụ thể.

## 3. Khóa an toàn 3 lớp (Patient Context Guard)
Trước khi ghi dữ liệu (auto-fill, auto-sign), hệ thống luôn thực hiện đối chiếu:
1. `Patient ID` (Mã bệnh nhân)
2. `Encounter ID` (Mã lượt khám)
3. `Admission Date / Form Type`
Nếu thông tin hiện hành khác với lúc bắt đầu xử lý AI, luồng ghi sẽ bị chặn hoàn toàn để tránh hiện tượng nhiễm chéo dữ liệu bệnh án.

## 4. Hướng dẫn cấu hình môi trường triển khai (Pilot / Hospital Mode)
Để đảm bảo an toàn tối đa:
- **Khởi tạo lần đầu**: Tất cả các module rủi ro cao (Auto-Sign, AI Voice, CDS) đều được **TẮT mặc định**. Chỉ duy nhất module Scanner (Chỉ đọc) được bật.
- **Auto-Sign**: Được khuyến cáo tắt đối với đa số tài khoản. Chỉ bật (Opt-in) đối với các máy trạm/bác sĩ đã được phê duyệt trong danh sách thử nghiệm.

## 5. Quy tắc đánh số phiên bản (Semantic Versioning Guideline)
Nhằm đồng bộ giữa mã nguồn (`package.json`, `manifest.json`), tài liệu (`README.md`, `CHANGELOG.md`) và thực tế triển khai, việc phát hành phiên bản tuân thủ Semantic Versioning (SemVer) `MAJOR.MINOR.PATCH`:

- **MAJOR (VD: 2.0.0)**: 
  - Nâng cấp đột phá thay đổi toàn bộ kiến trúc, UI/UX hoặc thay đổi luồng thao tác lâm sàng. 
  - Yêu cầu cấp lại quyền (permissions) trên trình duyệt.
- **MINOR (VD: 1.4.0 -> 1.5.0)**: 
  - Bổ sung tính năng mới (ví dụ: ra mắt phân hệ CDS mới, Tích hợp PACS mới).
  - Tương thích ngược với phiên bản trước, không làm đứt gãy luồng công việc hiện tại.
- **PATCH (VD: 1.4.0 -> 1.4.1)**:
  - Các bản cập nhật sửa lỗi (bug fixes).
  - Tăng cường bảo mật (bổ sung rule mã hóa, test, khóa an toàn).
  - Tối ưu hóa hiệu năng, cập nhật nội bộ không làm thay đổi luồng tính năng hiển thị cho người dùng.

> **Lưu ý Quan Trọng**: Mỗi khi chuẩn bị phát hành (Release), nhà phát triển phải đồng loạt cập nhật version trong `package.json`, `manifest.json` và `README.md`.
