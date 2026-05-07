# Mô hình Bảo mật (Security Model)

## 1. Lưu trữ và Xử lý API Key
- API Key (Gemini) do người dùng cung cấp được mã hoá bằng AES-256-GCM.
- Key mã hoá (`CryptoKey`) được generate bằng PBKDF2 (310,000 vòng lặp) từ một mã PIN.
- Mã PIN và CryptoKey chỉ lưu trên RAM (background memory), không bao giờ ghi xuống đĩa cứng.
- CryptoKey là `non-extractable`. Khi Session hết hạn (sau 30 phút) hoặc logout khỏi HIS, CryptoKey sẽ bị huỷ bỏ (memory wipe).

## 2. Bảo mật Dữ liệu Bệnh nhân (PHI)
- **Local Storage**: Mọi dữ liệu PHI nếu phải lưu trữ đệm đều được làm mờ/ẩn danh.
- **Log**: Không lưu họ tên hoặc thông tin nguyên dạng của bệnh nhân trong Console/Storage logs. Chuyển thành Short-ID (`P-****`).
- **Data Export**: Có popup bắt buộc confirm từ người dùng để chống rò rỉ.

## 3. Extension Security Boundary
- Các request `postMessage` yêu cầu một `nonce` hợp lệ để chống forged scripts.
- Giao tiếp với External API chỉ cho phép `*.googleapis.com`, `.vncare.vn`, `localhost` và `.githubusercontent.com` (Remote Config).
- Sử dụng `JSON.stringify` để chống prompt injection.
