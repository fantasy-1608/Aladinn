# Aladinn Test Matrix

Tài liệu này xác định các nhóm chức năng cốt lõi và ma trận kiểm thử (Test Matrix) cho dự án Aladinn.

## Nhóm 1: Security & Session
- **Derive key từ PIN**: Kiểm tra mã hóa và caching `CryptoKey` trên bộ nhớ (RAM).
- **Session timeout (30 phút)**: Kiểm tra wipe `CryptoKey` sau 30 phút idle.
- **Logout purge**: Kiểm tra wipe cache dữ liệu và `CryptoKey` khi truy cập URL logout của HIS.
- **Sender validation**: Kiểm tra chặn các postMessage từ extension hoặc origin không hợp lệ.
- **Whitelist Settings**: Đảm bảo các API lấy/lưu thiết lập từ Content/Popup không rò rỉ API Key hoặc các cấu hình nhạy cảm.
- **Nonce requirements**: Kiểm tra các iframe bridge chỉ chấp nhận message có kèm `nonce` hợp lệ.

## Nhóm 2: AI Gateway
- **Locked session**: AI request phải trả về lỗi nếu không có API key / phiên đã khóa.
- **Retry Mechanism**: Đảm bảo lỗi `5xx` từ Gemini API tự động retry (có backoff). Không retry lỗi `4xx` (ngoại trừ 429 quota).
- **Cancel Request**: Có thể hủy ngang (abort) 1 request AI thông qua `requestId`.
- **Parser Resiliency**: Hàm parse `JSON` phải đọc được các kết quả hỏng hoặc lẫn Markdown text từ Gemini.

## Nhóm 3: Storage & Encryption
- **Encrypt/Decrypt Service**: Dịch vụ `BG_ENCRYPT_DATA` và `BG_DECRYPT_DATA` chạy trên nền bằng CryptoKey.
- **Redaction Logs**: Dữ liệu ghi log tự động hash ID và giới hạn trong thời gian tồn tại tối đa.

## Nhóm 4: CDS Engine (Clinical Decision Support)
- **ICD rules & Lab-drug rules**: Chạy rule engine cho tương tác thuốc, chẩn đoán, dị ứng, v.v.
- **Alias Mapping**: Test kiểm tra map tên thuốc VN sang INN (hoạt chất quốc tế).
- **Missing Diagnosis**: Cảnh báo thiếu mã ICD cho một số chỉ định đặc thù.

## Nhóm 5: Extension Messaging
- **Feature toggles**: Thay đổi switch trong Popup cập nhật runtime state đến toàn bộ content script qua Event/Message bus.
