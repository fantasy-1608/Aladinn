# 🧞 Aladinn — VNPT HIS Assistant

<div align="center">

**Trợ lý thông minh cho hệ thống VNPT HIS/VnCare**  
_Giọng nói AI · Quét dữ liệu · Ký số tự động · Cảnh báo BHYT & Lâm sàng_

<p align="center">
  <img src="https://img.shields.io/badge/version-1.1.7-0052cc?style=for-the-badge&logo=git&logoColor=white" alt="Version" />
  <img src="https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?style=for-the-badge&logo=googlechrome&logoColor=white" alt="Chrome Extension" />
  <img src="https://img.shields.io/badge/build-Vite-646CFF?style=for-the-badge&logo=vite&logoColor=white" alt="Vite Build" />
  <img src="https://img.shields.io/badge/license-Custom-success?style=for-the-badge" alt="License" />
</p>

</div>

---

## 📖 Giới thiệu

**Aladinn** là Chrome Extension (Manifest V3) được thiết kế đặc biệt dành riêng cho bác sĩ và nhân viên y tế đang vận hành hệ thống **VNPT HIS (vncare.vn)**. Extension hoạt động như một lớp giao diện tăng cường (_UI overlay_) phủ lên hệ thống HIS gốc, giúp tự động hóa hàng loạt các thao tác lặp đi lặp lại, cung cấp hệ thống cảnh báo rủi ro bảo hiểm y tế theo thời gian thực và hỗ trợ nhập liệu rảnh tay bằng trí tuệ nhân tạo.

> [!IMPORTANT]  
> **Lưu ý kỹ thuật:** Đây hoàn toàn là công cụ hỗ trợ phía người dùng (Client-side). Aladinn **không can thiệp, không thay đổi và không có quyền truy cập trực tiếp vào cơ sở dữ liệu gốc** của hệ thống VNPT HIS.

---

## 🌟 Có gì mới trong bản v1.1.7?

- **Khắc phục lỗi xác thực thời gian BHYT:** Hoàn thiện bộ quy tắc kiểm tra thời gian cho các xét nghiệm "Đường máu mao mạch". Áp dụng chiến lược mapping dữ liệu lai (Hybrid Mapping) giữa Detail-level API và Sheet-level API để đảm bảo thời gian Thực hiện và Trả kết quả luôn khớp 100% với giao diện hiển thị của HIS.
- **Hợp nhất Timeline Lâm sàng & Thuốc:** Giao diện hiển thị chi tiết bệnh nhân nay tích hợp cả Diễn tiến lâm sàng và Thuốc sử dụng trên cùng một trục thời gian duy nhất. Dễ dàng theo dõi thay đổi chỉ định thuốc theo từng ngày bệnh!
- **Khử trùng lặp Dữ liệu Thuốc thông minh:** Cải tiến thuật toán hiển thị `Tên Thuốc (Hoạt Chất) (Hàm Lượng)`. Tự động ẩn Hoạt chất nếu trùng khớp hoàn toàn với Tên thương mại, giúp giao diện trực quan và gọn gàng hơn.
- **Nâng cấp API Bridge:** Bổ sung cơ chế fallback tự động truy vấn qua 8 API khác nhau của hệ thống VNPT HIS để luôn lấy được thông tin Dược lý chính xác nhất.
- **Tối ưu hiệu suất & Code siêu sạch:** Đã loại bỏ hoàn toàn các lỗi linter, dọn dẹp mã nguồn rác (unused variables/globals) để extension nhẹ nhàng và ổn định hơn bao giờ hết.

---

## ✨ Tính năng nổi bật

<table>
  <tr>
    <td width="50%">
      <h3>🛡️ BHYT Guard & CDS Engine</h3>
      <ul>
        <li><b>Kiểm soát rủi ro BHYT:</b> Tự động đối chiếu toa thuốc, dịch vụ với mã bệnh ICD-10 dựa trên tập quy tắc <code>insurance_rules.json</code>. Cảnh báo ngay lập tức các rủi ro xuất toán.</li>
        <li><b>Cảnh báo lâm sàng (CDS):</b> Phân tích cảnh báo tương tác thuốc, chống chỉ định, hoặc liều lượng dựa trên chức năng gan/thận.</li>
        <li><b>Quét trực tiếp trên lưới:</b> Hiển thị trực quan trạng thái an toàn (✅) hoặc rủi ro (⚠️) ngay trên danh sách bệnh nhân.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>🎤 Voice AI / Gemini Integration</h3>
      <ul>
        <li><b>Nhập liệu rảnh tay:</b> Nhận diện giọng nói tiếng Việt chuyên ngành y tế với độ chính xác cao.</li>
        <li><b>Trích xuất thông minh:</b> Tự động phân tích và trích xuất thông tin y khoa bằng mô hình <b>Gemini AI</b>.</li>
        <li><b>Điền form tự động:</b> Tự động điền vào các mẫu form phức tạp (Sinh hiệu, Khám bệnh, Chẩn đoán...).</li>
      </ul>
    </td>
  </tr>
  <tr>
    <td width="50%">
      <h3>📊 Smart Scanner & Dashboard</h3>
      <ul>
        <li><b>Khai thác ngầm:</b> Tự động tổng hợp thông tin cận lâm sàng (CLS), toa thuốc, sinh hiệu thông qua API Bridge.</li>
        <li><b>Dashboard trực quan:</b> Biểu đồ tiến triển các chỉ số (Glucose, WBC, Mạch, Huyết áp...) trên giao diện hiện đại.</li>
        <li><b>Tích hợp PACS:</b> Mở và xem trực tiếp ảnh DICOM (X-Quang, CT, MRI) từ hệ thống RIS/PACS nội bộ.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>✍️ Ký Số Tự Động (Auto-Sign)</h3>
      <ul>
        <li><b>Tự động hóa SmartCA:</b> Hỗ trợ toàn diện quá trình ký số PTTT/Hồ sơ bệnh án.</li>
        <li><b>Xử lý hàng loạt:</b> Tự động đánh dấu, chọn bệnh nhân, tải phiếu theo đợt điều trị.</li>
        <li><b>One-Click:</b> Gọi lệnh ký số hàng loạt chỉ với 1 thao tác click chuột đơn giản.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🚀 Hướng dẫn sử dụng

Sau khi cài đặt thành công, icon của Aladinn sẽ xuất hiện trên thanh công cụ của Chrome. Bạn có thể sử dụng các chức năng trực tiếp trên giao diện VNPT HIS:

<details>
<summary><b>1. Quản lý rủi ro BHYT</b></summary>
Truy cập module "Buồng điều trị" hoặc "Khám bệnh". Aladinn sẽ tự động thêm cột "BHYT" vào lưới bệnh nhân. Click vào biểu tượng (⚠️) để xem chi tiết các lỗi xuất toán tiềm ẩn của hồ sơ.
</details>

<details>
<summary><b>2. Sử dụng Trợ lý Giọng nói (Voice AI)</b></summary>
Click vào biểu tượng Micro (🎤) xuất hiện bên cạnh các ô nhập văn bản (text area). Đọc thông tin khám bệnh. AI sẽ tự động phân tích và bóc tách thành các trường dữ liệu tương ứng (Lý do khám, Bệnh sử, Khám lâm sàng).
</details>

<details>
<summary><b>3. Xem Tóm tắt Cận lâm sàng</b></summary>
Click vào nút "Tóm tắt CLS" trên thanh công cụ bệnh nhân. Một màn hình Dashboard sẽ hiện lên hiển thị toàn bộ lịch sử xét nghiệm và biểu đồ sinh hiệu của bệnh nhân đó.
</details>

<details>
<summary><b>4. Ký số tự động (SmartCA)</b></summary>
Truy cập màn hình "Ký số PTTT". Sử dụng phím tắt <code>Ctrl + Shift + S</code> hoặc click nút "Ký số tự động" do Aladinn tạo ra để kích hoạt quá trình tự động tick chọn và gọi lệnh ký.
</details>

### ⌨️ Phím tắt thao tác nhanh

_(Có thể thay đổi trong `chrome://extensions/shortcuts`)_

- `Ctrl + Shift + F` _(Mac: `Cmd + Shift + F`)_: Lọc hồ sơ của tôi.
- `Ctrl + Shift + S` _(Mac: `Cmd + Shift + S`)_: Bắt đầu ký số nhanh.
- `Ctrl + Shift + N` _(Mac: `Cmd + Shift + N`)_: Chuyển nhanh sang bệnh nhân tiếp theo.

---

## ⚙️ Hướng dẫn cài đặt

**Yêu cầu môi trường:** Trình duyệt Google Chrome phiên bản 88 trở lên, hoặc các trình duyệt nhân Chromium (Microsoft Edge, Brave, Cốc Cốc...).

### Dành cho Người dùng cuối (Cài đặt từ bản Release)

1. Tải file `.zip` của phiên bản mới nhất tại [Releases](../../releases).
2. Giải nén file vừa tải vào một thư mục cố định trên máy tính (Ví dụ: `D:\Aladinn_Extension`).
3. Mở Chrome, truy cập vào thanh địa chỉ: `chrome://extensions/`.
4. Bật công tắc **Developer mode** ở góc phải trên cùng.
5. Click **Load unpacked** và chọn thư mục `dist/` nằm trong thư mục bạn vừa giải nén.

### Dành cho Lập trình viên (Cài đặt từ Source Code)

```bash
git clone https://github.com/fantasy-1608/Aladinn.git
cd Aladinn
npm install
npm run build
```

Sau khi build, thư mục `dist/` sẽ được tạo ra. Tham khảo bước 3 ở trên để đưa vào Chrome.

> [!WARNING]  
> Sau mỗi lần chỉnh sửa mã nguồn, bắt buộc phải chạy `npm run build` để cập nhật lại extension.

---

## 🔒 Chính sách Bảo mật & Quyền riêng tư (Privacy Policy)

Aladinn được kiến trúc để tuân thủ tối đa các quy định về bảo mật y tế, minh bạch rõ ràng luồng dữ liệu:

### 1. Dữ liệu xử lý cục bộ (Local-Only)

- Mọi dữ liệu bóc tách từ HIS (thông tin hành chính, bệnh án, đơn thuốc, lịch sử khám, kết quả cận lâm sàng) **chỉ được lưu trữ tạm thời trong bộ nhớ của trình duyệt** (IndexedDB / RAM) thiết bị của bạn.
- Extension KHÔNG có máy chủ backend, KHÔNG tự động thu thập hay gửi dữ liệu bệnh nhân về bất kỳ hệ thống lưu trữ nào của bên thứ ba.
- Extension giới hạn quyền truy cập trang web (`host_permissions`) chủ yếu trên các tên miền `*://*.vncare.vn/*` và `*://*.vnpthis.vn/*`.

### 2. Dữ liệu gửi ra dịch vụ bên thứ ba (Third-party Services)

- **Voice AI / Gemini API:** Khi bạn chủ động bật và sử dụng tính năng Nhận diện giọng nói hoặc AI Tóm tắt, dữ liệu (giọng nói hoặc văn bản cần xử lý) sẽ được truyền trực tiếp đến API của Google (`generativelanguage.googleapis.com`).
- Tác giả không can thiệp hay lưu lại log của các truy vấn này.
- **Khuyến cáo:** Vui lòng không đọc các thông tin định danh nhạy cảm (PII) nếu không cần thiết, và tự tuân thủ quy định bảo mật thông tin nội bộ của bệnh viện khi dùng AI.

---

## ⚠️ Miễn trừ trách nhiệm (Disclaimer)

Việc cài đặt và sử dụng tiện ích Aladinn đồng nghĩa với việc bạn đã đọc, hiểu và đồng ý hoàn toàn với các điều khoản sau:

> 1. **Về tính pháp lý của sản phẩm:** Aladinn là một công cụ mã nguồn mở độc lập do cộng đồng các bác sĩ/kỹ sư tự phát triển nhằm tối ưu hóa quy trình làm việc cá nhân. Aladinn **KHÔNG PHẢI** là phần mềm, sản phẩm hay tài sản chính thức của tập đoàn VNPT.
> 2. **Không mang tính chuyên môn y khoa:** Aladinn không phải là một phần mềm thiết bị y tế (SaMD) được cấp phép. Các thông báo, biểu đồ và đề xuất do hệ thống đưa ra **KHÔNG THAY THẾ** cho các quyết định, đánh giá và chuyên môn y khoa của bác sĩ điều trị.
> 3. **Không cam kết bảo hiểm:** Các bộ quy tắc (rules) rủi ro BHYT được cấu hình trong phần mềm chỉ mang tính chất tham khảo dựa trên kinh nghiệm thực tế. Tác giả **KHÔNG BẢO ĐẢM** hồ sơ của bạn sẽ được thanh toán BHYT 100% hay không bị xuất toán khi phần mềm không đưa ra cảnh báo. Bác sĩ vẫn là người chịu trách nhiệm pháp lý cao nhất và cuối cùng về các chỉ định của mình.
> 4. **Rủi ro vận hành:** Người dùng hoàn toàn tự chịu trách nhiệm về tính chính xác và toàn vẹn của dữ liệu bệnh nhân, đặc biệt là khi sử dụng các tính năng tự động hóa (Ví dụ: Ký số tự động SmartCA). Tác giả không chịu trách nhiệm cho bất kỳ sự cố sai lệch hồ sơ, mất mát dữ liệu hoặc hậu quả pháp lý nào phát sinh từ việc sử dụng công cụ này.
> 5. **Khuyến cáo triển khai nội bộ:** Việc triển khai trên diện rộng tại các cơ sở y tế cần được báo cáo và tham vấn bộ phận IT, Quản lý chất lượng để đảm bảo phù hợp với quy chế bảo mật thông tin và an toàn không gian mạng của đơn vị.

---

<div align="center">
  <p><b>📄 Giấy phép (License)</b></p>
  <p>Bản quyền &copy; 2026 Huỳnh Trung Anh.<br/>Tiện ích này được cung cấp dưới dạng "nguyên trạng" (AS-IS), không đi kèm với bất kỳ hình thức bảo hành nào, dù tường minh hay ngụ ý. Người dùng cá nhân được quyền sử dụng, đóng góp và điều chỉnh mã nguồn phục vụ mục đích công việc hàng ngày. Mọi hành vi sao chép, phân phối để thương mại hóa hệ thống này dưới tên gọi khác mà không có sự đồng ý bằng văn bản của tác giả đều bị nghiêm cấm.</p>
</div>
