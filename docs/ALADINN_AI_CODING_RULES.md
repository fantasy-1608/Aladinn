# Aladinn AI Coding Rules

## 1. Phương pháp phát triển (Development Workflow)
Dựa trên Master Plan và tiêu chuẩn từ Everything-Claude-Code (ECC), mọi AI Agent và lập trình viên khi thao tác trên repo này phải tuân thủ luồng:
1. **Plan:** Không code ngay. Đọc file kiến trúc, lập plan, nhận diện rủi ro.
2. **TDD (Test-Driven Development):** Viết test trước (Fail), code (Pass), refactor (Tối ưu). Yêu cầu coverage >= 80%.
3. **Review:** Tự đánh giá lại rủi ro bảo mật (PHI/API) sau khi code.
4. **Commit:** Luôn chạy `pnpm run lint`, `test`, `build` trước khi chốt thay đổi.

## 2. Tiêu chuẩn Code (Coding Style & Quality)
- **Tính bất biến (Immutability):** KHÔNG BAO GIỜ mutate (biến đổi trực tiếp) object trạng thái bệnh nhân. Luôn tạo bản sao (copy/clone) để chỉnh sửa. Điều này giúp tránh rò rỉ dữ liệu giữa các bệnh nhân.
- **Fail Fast & Fail Closed:** Validate mọi dữ liệu từ HIS (DOM, API). Nếu dữ liệu không khớp schema, báo lỗi và DỪNG NGAY LẬP TỨC. Không cố gắng đoán mò (fallback) gây nguy hiểm.
- **Chia nhỏ file:** Hàm <50 dòng, file <800 dòng. Không lồng code (nesting) quá 4 cấp.
- **Xử lý lỗi (Error Handling):** Bắt lỗi ở mọi tầng. Không được "nuốt" lỗi (silently swallow errors). Log lỗi phải được redact (xóa) PHI.

## 3. Nguyên tắc tương tác HIS và AI
- **Rule-based trước, LLM sau:** Sử dụng DOM selector, Regex, Schema Validation để thu thập dữ liệu chắc chắn trước. AI chỉ dùng cho các tác vụ giải thích hoặc dữ liệu độ tin cậy thấp (phải có xác nhận của con người).
- **Không dùng LLM để ra quyết định ghi dữ liệu:** LLM chỉ đưa ra payload JSON, hệ thống phải tự map và đi qua `writeback-guard` + `patient-context-guard` trước khi ghi vào HIS.
- **Redact PHI:** Mọi dữ liệu gửi lên LLM phải được che giấu họ tên, CMND, BHYT, SĐT, v.v.

## 4. Quản lý Context và Token
- Giữ context window hiệu quả, dọn dẹp các module không còn dùng.
- Theo dõi chi phí (Cost Tracking) cho mọi tác vụ gọi LLM. Tác vụ đơn giản (short explanation) nên dùng model nhỏ (flash-lite).

## 5. Quy tắc thực thi (Karpathy Rules)
- **Suy nghĩ trước khi code:** Không đoán bừa, không giấu sự mơ hồ. Trình bày trade-off. Nếu không chắc về yêu cầu, PHẢI HỎI lại.
- **Đơn giản là vua:** Chỉ viết code giải quyết đúng vấn đề hiện tại, không over-engineer hay viết code "phòng hờ".
- **Thay đổi ngoại khoa:** Chỉ sửa đúng file/dòng liên quan. KHÔNG dọn dẹp (refactor) tiện tay code cũ đang chạy tốt. Giữ đúng style hiện tại.
- **Chạy theo mục tiêu:** Xác định tiêu chí kiểm chứng (test) rõ ràng trước khi sửa.

## 6. Quy tắc thiết kế cốt lõi
- **Bảo toàn chức năng:** Không xóa hoặc đổi tên chức năng hiện có trừ khi có mapping UI/Logic tương đương và test pass. Nếu không tương thích, phải giữ UI cũ làm fallback.
- **Tách biệt UI và Logic:** UI chỉ hiển thị và gửi Command/Message. Mọi logic parse DOM, gọi AI hay ký số phải nằm ở Core/Background.
