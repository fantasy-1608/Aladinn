# Release Checklist

Trước khi đóng gói một phiên bản (Release Candidate) lên môi trường chạy, cần tuân thủ nghiêm ngặt checklist sau đây:

- [ ] Repository Git sạch sẽ, không có file thừa hoặc unstaged.
- [ ] Version đã được đồng bộ chuẩn xác giữa `manifest.json` và `package.json`.
- [ ] CHANGELOG.md đã được cập nhật mục mới nhất với các tính năng/lỗi đã fix.
- [ ] Chạy lệnh `npm run lint` — Yêu cầu PASS (Zero Warnings).
- [ ] Chạy lệnh `npm test` — Yêu cầu PASS.
- [ ] Chạy lệnh `npm run build` — File artifact sinh ra thành công.
- [ ] Vượt qua quy trình QA Smoke Test (10-15 bước) do con người thực thi.
- [ ] Script release.js đã sinh ra checksum file zip hợp lệ.
- [ ] Giữ lại ít nhất 1 artifact nén của phiên bản trước để Rollback nếu cần thiết.
