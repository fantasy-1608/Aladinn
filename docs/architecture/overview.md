# Khái quát Kiến trúc Aladinn (Architecture Overview)

Dự án Aladinn là một Chrome Extension phức tạp tương tác trực tiếp với hệ thống VNPT HIS thông qua Content Scripts, Background Service Worker và API nội bộ của HIS.

## 1. Cấu trúc Component Chính

- **Background Service Worker (`background/`)**: Xử lý CryptoKey, Gemini API Gateway, Fetch Retry, Update Check, và Remote Config (Safe Mode).
- **Content Scripts (`content/`)**:
  - Giao tiếp với DOM của HIS.
  - Các iframe helpers để vượt qua CORS và query dữ liệu.
  - CDS rule engine, UI Modal injection (Scanner, Voice).
- **Shared (`shared/`)**: Chứa logic chung (Crypto, Logger, Constants, Event Bus, API Key Service).
- **Popup/Options (`popup/`, `options/`)**: Quản lý thiết lập từ người dùng, lưu trữ local config.

## 2. Luồng Dữ liệu (Data Flow)

1. Dữ liệu bệnh nhân (PHI) được thu thập từ DOM/XHR Snooping.
2. Được mã hóa bởi CryptoKey tại background nếu lưu vào Storage.
3. API requests ra ngoài (Gemini) đi qua Background Service Worker (Gateway).
4. Phản hồi AI được render tại Content Scripts.

## 3. Quản lý Trạng thái (State Management)

- Dữ liệu ngắn hạn: Trong bộ nhớ của Content Scripts (e.g. CDSCache).
- Dữ liệu cấu hình: `chrome.storage.local`.
- Dữ liệu an ninh: CryptoKey ở memory của Service Worker.
