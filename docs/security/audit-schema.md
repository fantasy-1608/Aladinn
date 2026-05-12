# Audit Event Schema

Các sự kiện (events) quan trọng được ghi log cục bộ để phục vụ troubleshooting và truy vết, với yêu cầu tuân thủ nguyên tắc không lưu trữ PHI (Protected Health Information).

## Cấu trúc Event chuẩn (Standard Event Schema)

Mỗi log entry sẽ được lưu dưới dạng JSON object với các trường:

```json
{
  "event_name": "ai_request_started",
  "module": "voice_ai",
  "timestamp": "2026-05-08T10:15:30Z",
  "user_role": "doctor",
  "local_user_id_masked": "U-12***89",
  "success": true,
  "error_code": null,
  "version": "1.2.4",
  "environment": "production"
}
```

## Các Quy tắc Bắt buộc (Mandatory Rules)

1. **Tuyệt đối không lưu họ tên bệnh nhân, số điện thoại, CCCD, địa chỉ thật.**
2. **Patient ID**: Chỉ được log dưới dạng hashed hoặc masked (Ví dụ: `P-****56`).
3. **Nội dung bệnh án**: Không bao giờ log nguyên văn (raw transcript) hoặc toàn bộ JSON kết quả của AI.

## Các Event Mẫu

- `ai_request_started`: Bắt đầu gửi file âm thanh / văn bản lên AI.
- `ai_request_failed`: Lỗi khi gửi AI (kèm theo `error_code` như `AI_QUOTA_LIMIT`, `AI_NETWORK_ERROR`).
- `export_confirmed`: Người dùng đã ấn nút đồng ý xuất dữ liệu JSON/CSV.
- `his_logout_purge`: Hệ thống phát hiện HIS đã logout và thực hiện wipe session/key.
- `autosign_session_started`: Bắt đầu quá trình ký số tự động.
- `cds_warning_generated`: CDS tạo ra một cảnh báo cho người dùng (ví dụ: Tương tác thuốc Mức 1).
