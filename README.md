# 🏺 Aladinn – Trợ lý lâm sàng AI cho VNPT HIS

> **v1.2.0** · Chrome Extension · Dành riêng cho hệ thống VNPT HIS nội trú

Aladinn là tiện ích Chrome giúp bác sĩ & điều dưỡng khai thác nhanh dữ liệu lâm sàng từ phần mềm VNPT HIS, kết hợp phân tích AI để hỗ trợ hội chẩn, ra quyết định và ghi chép y khoa.

---

## ✨ Tính năng nổi bật (v1.2.0)

### 🏥 Bảng CLS + Thuốc (5 Tab)

| Tab | Nội dung |
|-----|----------|
| 🏥 Khám vào viện | Lý do nhập viện, bệnh sử, tiền sử, khám lâm sàng |
| 📋 Lâm sàng & Thuốc | Diễn tiến hàng ngày + danh sách thuốc theo ngày |
| 🧪 XN | Bảng xét nghiệm tất cả ngày, highlight bất thường |
| 🩻 CĐHA | Chẩn đoán hình ảnh, kết quả X-quang/ECG/siêu âm |
| 🤖 AI | Phân tích lâm sàng tự động bằng Gemini AI |

### 🤖 Phân tích AI (Rich Context v2.0)

- **Prompt toàn diện**: khám vào viện + **sinh hiệu** (M/HA/T°/NT/CN/CC) + tiền sử bản thân & gia đình + tóm tắt CLS + diễn tiến 3 ngày + toàn bộ XN + CĐHA + thuốc kèm **đường dùng** (IV/PO/IM) + số ngày điều trị
- **4-point output**: (1) Tóm tắt bệnh → (2) Nguy cơ + tương tác thuốc → (3) Đánh giá đáp ứng điều trị → (4) Hướng xử trí
- **Ẩn danh y tế**: mã BN ẩn danh (BN-XXXX), không gửi tên/địa chỉ thật
- **Token cost toast**: hiển thị số tokens và chi phí ước tính sau mỗi lần gọi API
- **Lazy load**: AI chỉ phân tích khi bấm vào tab AI

### 🎨 Giao diện Desert Mystic

- Modal cố định **85vh** — không co giãn khi chuyển tab
- Header compact: `Tên bệnh nhân — Giới tính, Năm sinh`
- Chẩn đoán hiển thị tên đầy đủ, mã ICD ẩn trong accordion "Chi tiết"
- Nút Phân tích AI với hiệu ứng shimmer/sparkle

### 📝 Slash Command Templates

- Gõ `/` trong textarea của HIS để chèn nhanh mẫu câu lâm sàng
- Tuỳ chỉnh templates trong popup Cài đặt

---

## 🛡️ Bảo mật & Quyền riêng tư

| Nguyên tắc | Thực hiện |
|---|---|
| Ẩn danh dữ liệu | Mã BN dạng `BN-XXXX`, không gửi tên/CMND/địa chỉ |
| API Key an toàn | Mã hóa PIN, không lưu plaintext, không log |
| Không có server | Extension hoạt động cục bộ, gọi API trực tiếp từ browser |
| Manifest V3 | Tuân thủ quy định Chrome Extension Store |
| Không thu thập dữ liệu | Không analytics, không telemetry |

---

## 🚀 Cài đặt

### Yêu cầu

- Chrome / Chromium ≥ 120
- Tài khoản VNPT HIS nội trú
- Google AI Studio API Key (Gemini)

### Từ source code

```bash
git clone https://github.com/fantasy-1608/Aladinn.git
cd Aladinn
npm install
npm run build
```

1. Mở Chrome → `chrome://extensions`
2. Bật **Developer mode**
3. Click **Load unpacked** → chọn thư mục `dist/`

### Cấu hình

1. Click icon Aladinn trên thanh công cụ
2. Nhập **API Key** (Gemini) và đặt **PIN** bảo vệ
3. Vào trang bệnh nhân VNPT HIS → click nút **CLS + Thuốc** / **Tóm tắt AI**

---

## 🏗️ Kiến trúc

```text
Aladinn/
├── content/
│   ├── scanner/
│   │   └── scanner-init.js     # Core: modal 5-tab, AI prompt, timeline
│   ├── api-bridge.js           # VNPT HIS API interceptor & data extractor
│   ├── cds/                    # Clinical Decision Support module
│   └── auto-sign/              # Tự động ký duyệt (có xác nhận)
├── background/
│   └── service-worker.js       # Message routing, auth
├── popup/
│   └── popup.html              # Cài đặt API Key, PIN, templates
├── manifest.json               # Chrome Extension Manifest V3
└── vite.config.js              # Build config
```

---

## 📦 Changelog

### v1.2.0 (29/04/2026) — Rich AI Context

- **Rich Prompt**: Bổ sung 4 nguồn dữ liệu mới vào AI: khám vào viện, diễn tiến 3 ngày gần nhất, toàn bộ panel XN, mô tả CĐHA
- **Prompt template cải tiến**: cấu trúc section rõ ràng, backward compatible với template tùy chỉnh
- **AI render fix**: sửa lỗi `#D4A853">Tóm tắt bệnh:` lộ ra text do thứ tự xử lý markdown sai
- **Token cost toast**: thay VNPTRealtime.showToast bằng custom toast `z-index:2147483648` không bị che
- **5-tab architecture**: tách "Khám vào viện" thành tab độc lập khỏi "Lâm sàng & Thuốc"
- **Modal fixed height**: `height:85vh` — kích thước không đổi khi chuyển tab
- **Gender extraction**: 3-source fallback (patientInfo → DOM by row ID → selected row)
- **Linter clean**: 0 errors, 0 warnings — fix `fetchPacsUrlFromBridge`, `hasLamsangData`, `pillsHtml`, `namePillsHtml`

### v1.1.9 (27/04/2026) — Stability Upgrade

- `resolveActiveGrid()` hỗ trợ cả nội trú lẫn ngoại trú
- Composite patient key ngăn data leak giữa các bệnh nhân
- Linting cleanup toàn bộ codebase

### v1.1.7 (25/04/2026) — BHYT Glucose Scanner

- Fix API field mapping cho glucose mao mạch
- HTML sanitization input bệnh nhân

---

## 🔧 Development

```bash
npm run dev      # Watch mode (no HMR, extension reload thủ công)
npm run build    # Production build → dist/
npm run lint     # ESLint check
npm run release  # Build + zip + GitHub Release
```

**Quy tắc code:**

- Không commit API key hay dữ liệu bệnh nhân thật
- Chạy `npm run build` trước khi yêu cầu kiểm tra
- Mọi animation dùng `transform`/`opacity` (GPU-accelerated)
- Palette: Desert Mystic — `#d4a25a` gold, `#1a1410` dark, `#e8dcc8` text

---

## 📄 License

Private — Dành riêng cho nội bộ bệnh viện. Không phân phối công khai.

---

*Built with ❤️ for Vietnamese clinicians · Tác giả: **Bác sĩ Huỳnh Trung Anh** · Powered by Gemini AI*
