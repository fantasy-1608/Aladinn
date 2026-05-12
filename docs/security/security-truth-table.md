# Mức độ Đảm bảo Bảo mật (Security Truth Table)

Tài liệu này đối chiếu các tuyên bố về bảo mật trong README với triển khai thực tế trong source code của Aladinn.

| Claim (Tuyên bố) | File Nguồn | Trạng thái | Action Owner |
| :--- | :--- | :--- | :--- |
| **AES-256-GCM + PBKDF2 (310,000 iterations)** | `background/ai-client.js`, `shared/crypto.js` | ✅ Đúng | Trưởng nhóm Bảo mật |
| **CryptoKey không bao giờ rời background worker** | `background/service-worker.js`, `background/ai-client.js` | ✅ Đúng (Chỉ trả về trạng thái `unlocked`) | Trưởng nhóm Bảo mật |
| **Session timeout (30 phút idle)** | `background/ai-client.js` (SESSION_TIMEOUT_MS = 30 *60* 1000) | ✅ Đúng | Trưởng nhóm Bảo mật |
| **Purge data khi HIS logout** | `background/service-worker.js` | ✅ Đúng (wipe keys & storage khi URL chứa `login.jsp`, `logout`, v.v.) | Trưởng nhóm Bảo mật |
| **Endpoint allowlist (geminiBaseUrl)** | `background/ai-client.js`, `manifest.json` | ✅ Đúng (Chỉ `.googleapis.com`, `.vncare.vn`, `localhost`, `.githubusercontent.com`) | Trưởng nhóm Bảo mật |
| **Nonce bắt buộc cho postMessage** | `content/scanner/messaging.js`, `content/cds/cds-cache.js` | ✅ Đúng (Các iframe listener đều yêu cầu `nonce === window.__ALADINN_NONCE__`) | Trưởng nhóm Bảo mật |
| **Prompt injection prevention** | `background/ai-client.js` | ✅ Đúng (Sử dụng `JSON.stringify` để escape system prompt) | Trưởng nhóm AI |
| **PHI redaction trong error log (TTL 24h)** | `shared/logger.js`, `shared/storage.js` | ✅ Đúng (Log được làm mờ P-**** và tự xóa) | Trưởng nhóm Kiến trúc |
| **Export consent + audit log** | (Chưa kiểm tra chi tiết, nhưng logic có ở export file) | Cần kiểm tra (Pending) | N/A |
| **Auto-purge legacy plaintext key** | `background/service-worker.js` | ✅ Đúng (Tự xóa plaintext API key khi khởi động worker) | Trưởng nhóm Bảo mật |

*Note: Cập nhật file này nếu có bất kỳ thay đổi nào về policy bảo mật trong tương lai.*
