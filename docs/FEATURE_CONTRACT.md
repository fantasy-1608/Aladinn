# Aladinn Feature Contract & Architecture 📝

## 1. Hệ thống Bridge Message (Content ↔ Injected)

Tất cả message đi qua `window.postMessage` đều bắt buộc tuân theo Schema sau:

**Request Schema:**

```json
{
  "type": "REQ_...",
  "requestId": "string",
  "token": "string",
  "nonce": "string",
  "payload": "any"
}
```

**Response Schema:**

```json
{
  "type": "..._RESULT",
  "requestId": "string",
  "nonce": "string",
  "payload": "any"
}
```

### Danh sách Message Types

- `REQ_FETCH_HISTORY` -> `FETCH_HISTORY_RESULT`: Lấy dữ liệu bệnh sử (từ HIS API `NT.006.HSBA.HIS`).
- `REQ_FETCH_ROOM` -> `FETCH_ROOM_RESULT`: Lấy thông tin phòng / giường (từ HIS API `NT.005`).
- `REQ_FETCH_TREATMENT` -> `FETCH_TREATMENT_RESULT`: Lấy dữ liệu tờ điều trị.
- `REQ_FETCH_DRUGS` -> `FETCH_DRUGS_RESULT`: Lấy danh sách thuốc.
- `REQ_FETCH_PTTT` -> `FETCH_PTTT_RESULT`: Lấy danh sách phẫu thuật thủ thuật.
- `REQ_FETCH_VITALS` -> `FETCH_VITALS_RESULT`: Lấy sinh hiệu.

## 2. Hệ thống Background Message (Content ↔ Background)

- `FORCE_CDS_SYNC`: Yêu cầu đồng bộ lại CDS data. Response: `{ok: boolean, error?: string}`.
- `BG_DECRYPT_API_KEY`: Lấy API Key đã giải mã. Response: `{apiKey: string}`.
- `GET_SETTINGS` / `SET_SETTINGS`: Đọc/Ghi local storage (có whitelist).

## 3. Storage & Settings Truth

- `aladinn_update_dismissed`: Version mà user đã bấm "Bỏ qua".
- `lastSuccessfulCdsSyncAt` / `lastCdsSyncStatus`: Trạng thái đồng bộ CDS gần nhất.
- `geminiApiKey_encrypted` / `pin_salt` / `pin_hash`: Cấu hình bảo mật (CryptoKey).
- `vnpt_cds_data`: Cache của tập dữ liệu CDS.

*Note: Mọi truy xuất Setting phải dựa vào whitelist trong service-worker để ngăn Data Leak.*
