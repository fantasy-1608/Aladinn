# Aladinn Security Policy & Privacy Model

## 1. Zero-Trust với Dữ liệu Y tế (PHI)
Mọi thông tin bệnh nhân (Protected Health Information - PHI) phải được coi là dữ liệu nhạy cảm cấp độ cao nhất.
- **KHÔNG** gửi raw text chứa định danh bệnh nhân lên bất kỳ dịch vụ Cloud AI nào (Gemini, OpenAI, v.v.).
- **BẮT BUỘC** phải chạy qua module `phi-redactor.js` trước khi thực hiện request mạng.
- Danh sách phải che: Họ tên, Mã bệnh nhân, Số hồ sơ, CCCD/CMND, BHYT, Địa chỉ, Số điện thoại, Email.

## 2. Bảo mật quá trình Ghi dữ liệu (Writeback Security)
- **Patient-Context Guard:** Trước mọi thao tác `POST` (điền phiếu, lưu bệnh án), hệ thống phải bắt chụp (capture) lại ngữ cảnh bệnh nhân hiện tại (ID, EncounterID, Tab, Window) và so sánh với ngữ cảnh lúc bắt đầu phân tích. Nếu LỆCH, chặn lệnh ghi ngay lập tức.
- Mọi thao tác ghi dữ liệu từ nguồn bên ngoài (đặc biệt là AI) phải đi qua cơ chế kiểm tra Schema (JSON Validation).

## 3. Bảo vệ Credentials và API Bridge
- **Secret Management:** Tuyệt đối không hardcode API Keys, Passwords, Token trong code. Keys phải được mã hóa (AES-GCM) ở Background Service Worker và cấp quyền theo Session.
- **Message Bridge Security:** Mọi giao tiếp giữa `content_script` và `injected_script` (hoặc background) phải kèm theo `nonce` và `contextToken`. Chặn tất cả các thông điệp không hợp lệ.
- **Endpoint Allowlist:** Extension chỉ được phép giao tiếp với các domain đã khai báo trước (ví dụ: `*.vncare.vn`, `generativelanguage.googleapis.com`). Cấm mở rộng host_permissions bừa bãi.

## 4. An toàn Ký số tự động (Auto-Sign Safety)
- Chế độ tự động ký phải có vòng lặp kiểm tra trạng thái và nút DỪNG (Emergency Stop) luôn khả dụng.
- Dừng tiến trình ngay lập tức nếu: Người dùng đổi Tab, đổi Cửa sổ, đăng xuất, hoặc DOM của HIS thay đổi bất thường (Unknown modal).
- Không được dùng vòng lặp click vô hạn.
