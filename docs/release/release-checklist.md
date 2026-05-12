# Danh Sách Kiểm Tra Phát Hành (Release Checklist)

> File này định nghĩa các tiêu chuẩn BẮT BUỘC phải đạt được trước khi thực hiện quy trình release phiên bản mới. Script `pnpm run release` sẽ tự động kiểm tra một phần của checklist này, nhưng developer phải xác nhận thủ công các tiêu chí còn lại.

## Điều kiện Tiên quyết (Pre-flight Checks)
- [ ] Nhánh hiện tại (Branch) đang ở trạng thái sạch (clean working tree).
- [ ] Mọi pull request hoặc commit liên quan đến version này đã được merge vào nhánh chính.
- [ ] File `CHANGELOG.md` đã có entry mô tả cho đúng phiên bản chuẩn bị phát hành.
- [ ] Phiên bản ở `package.json` và `manifest.json` **khớp nhau hoàn toàn**.

## Kiểm thử & Chất lượng mã (CI/CD Gates)
- [ ] Lệnh `pnpm run lint` pass (Exit code 0, không còn warning hay error linter).
- [ ] Lệnh `pnpm run test` pass (Tất cả unit tests và regression tests thành công).
- [ ] Github Actions (CI Pipeline) cho các commit mới nhất đều báo xanh (Pass).
- [ ] Đã thực hiện ít nhất 1 lần chạy bảng kiểm `docs/qa/smoke-test.md` với bản build `dist/` hiện tại.

## Đóng gói (Packaging)
- [ ] Lệnh `pnpm run build` không xuất hiện cảnh báo lạ và tạo đúng thư mục `dist/`.
- [ ] Script release đã tạo thành công file nén `Aladinn-vX.Y.Z.zip` trong `dist-zip/`.
- [ ] Chữ ký mã băm (SHA-256 Checksum) của file zip đã được sinh ra và đính kèm vào release notes.

## Rollback & Lưu trữ (Archive)
- [ ] Cấu hình Github Release đúng target branch.
- [ ] Thư mục `dist-zip/` ở máy cục bộ (hoặc trên Server) có lưu lại ít nhất 1 file nén của phiên bản trước đó (để có thể rollback khẩn cấp nếu bản mới gây lỗi nghiệm trọng).

---
*Ghi chú: Đừng bao giờ bypass các lỗi linter hay failed tests chỉ để kịp giờ phát hành! Sự ổn định của môi trường lâm sàng là ưu tiên số 1.*
