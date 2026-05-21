# 🧪 Chiến Lược Kiểm Thử An Toàn Lâm Sàng (Aladinn Test Strategy)

Tài liệu này trình bày cách thức **Aladinn v2** đảm bảo tính chính xác và an toàn tuyệt đối trước khi bàn giao phần mềm cho các bác sĩ sử dụng. Trong lĩnh vực y tế, một lỗi nhỏ của phần mềm cũng có thể dẫn đến hậu quả nghiêm trọng. Do đó, chúng tôi áp dụng quy trình kiểm thử nghiêm ngặt bao gồm cả **Kiểm thử Tự động (Automated Tests)** và **Kiểm thử Thủ công (Manual QA)**.

---

## 1. 3 Lớp Chốt Chặn Kiểm Thử (Quality Gates)

Để một phiên bản Aladinn được phép phát hành, toàn bộ mã nguồn phải vượt qua 3 chốt chặn kiểm soát chất lượng dưới đây:

```
[ LỚP 1: Linter & Định dạng Code ] ──> [ LỚP 2: Kiểm thử Tự động (Vitest) ] ──> [ LỚP 3: Kiểm thử Thực tế (Manual QA) ]
     (Quét lỗi cú pháp & dư thừa)             (Chạy giả lập 198+ ca kiểm thử)            (Bác sĩ chạy thử trên tài liệu giả)
```

1. **Lớp 1 - Linter Enforced (Eslint):** Tự động quét toàn bộ mã nguồn để đảm bảo không có biến rác, không rò rỉ bộ nhớ, và cấu trúc mã tuân thủ nghiêm ngặt chuẩn an toàn.
2. **Lớp 2 - Unit & Integration Tests (Vitest + JSDOM):** Giả lập môi trường trình duyệt để chạy thử các thuật toán tự động tính toán eGFR, thuật toán tự hồi phục DOM, và lọc dữ liệu.
3. **Lớp 3 - Manual QA (Bác sĩ kiểm định):** Sử dụng bệnh án giả định để bấm thực tế trên giao diện, kiểm tra phản hồi trực quan, màu sắc đối chiếu và tính năng khẩn cấp.

---

## 2. Các Ca Kiểm Thử Cốt Lõi Bắt Buộc (Critical Test Cases)

Hiện tại, hệ thống đã bao phủ **198 ca kiểm thử tự động** thành công 100%. Dưới đây là các ca kiểm thử bảo mật và lâm sàng cốt lõi:

### 2.1. Chốt chặn chống ghi nhầm bệnh nhân (Patient Context Guard Test)
- **Kịch bản kiểm thử:**
  1. Mở hồ sơ bệnh nhân A.
  2. Bật AI phân tích bệnh án bệnh nhân A.
  3. Giả lập bác sĩ đổi sang tab bệnh nhân B trên phần mềm HIS.
  4. AI trả kết quả về và cố gắng điền tự động (Auto-fill).
- **Kết quả kỳ vọng:** Lệnh điền bị **chặn đứng lập tức**, hệ thống phát đi cảnh báo đỏ và xóa sạch bộ nhớ tạm để bảo vệ an toàn.

### 2.2. Kiểm thử Khử định danh thông tin cá nhân (PHI Redactor Test)
- **Kịch bản kiểm thử:** Đưa vào một đoạn văn bản thô chứa: Họ tên bác sĩ/bệnh nhân, Số điện thoại (dạng `09xx`), Mã thẻ BHYT, Số căn cước công dân và Địa chỉ nhà.
- **Kết quả kỳ vọng:** Đoạn văn bản gửi lên AI hoàn toàn bị che kín (thay thế bằng `[CHE_HO_TEN]`, `[CHE_SDT]`), chỉ giữ lại các mô tả lâm sàng thô (như: đau đầu, ho, sốt...).

### 2.3. Kiểm thử an toàn Ký số tự động (Auto-Sign Safety Test)
- **Kịch bản kiểm thử:** Kích hoạt chức năng ký tự động hàng loạt, sau đó giả lập sự kiện bác sĩ đột ngột chuyển sang màn hình khác hoặc nhấn phím `ESC`.
- **Kết quả kỳ vọng:** Tiến trình ký số dừng lại lập tức ở trạng thái an toàn, nút dừng khẩn cấp hiển thị nổi bật và không có bất kỳ lệnh click vô hạn nào được thực hiện.

---

## 3. Lệnh Chạy Kiểm Thử (Dành cho nhà phát triển)

Trước khi đóng gói tiện ích, nhà phát triển bắt buộc phải chạy lệnh sau ở terminal của dự án để đảm bảo toàn bộ 198 kiểm thử đều vượt qua (Pass):

```bash
pnpm run test
```

*Lưu ý: Nếu có bất kỳ kiểm thử nào bị lỗi (Fail), quá trình build tiện ích sẽ tự động bị chặn lại để ngăn ngừa rủi ro.*
