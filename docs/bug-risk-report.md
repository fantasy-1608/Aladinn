# Báo cáo rà soát bug tiềm ẩn sau nâng cấp Aladinn v1.1.8

Ngày rà soát: 2026-04-27 19:52 +07  
Phạm vi: các thay đổi gần đây quanh CDS realtime/EAV scanner, auto-fill Hội chẩn/Chuyển viện, hỗ trợ grid Ngoại trú `#grdDSBenhNhan`, bridge API và kiểm tra build/test/lint.

## Tóm tắt điều hành

Dự án build được và bộ test Vitest hiện tại pass, nhưng vẫn còn một lỗi lint chắc chắn và một số rủi ro runtime đáng chú ý. Các rủi ro quan trọng nhất nằm ở việc thêm hỗ trợ ngoại trú nhưng nhiều luồng bridge vẫn mặc định dùng `#grdBenhNhan`, cộng thêm cơ chế cache CDS đang coi các ID khác độ dài là alias của cùng bệnh nhân nên có thể giữ nhầm dữ liệu bệnh nhân cũ.

Mức ưu tiên đề xuất:

1. Sửa lỗi lint `no-useless-assignment` để CI/lint pass.
2. Chuẩn hóa cách resolve grid/row giữa nội trú và ngoại trú trong toàn bộ bridge.
3. Siết lại điều kiện reset cache CDS theo patient context thực, không dựa chủ yếu vào độ dài ID.
4. Thêm test thực chất cho các helper/bridge mới thay vì chỉ test placeholder.

## Kết quả kiểm tra tự động

| Lệnh | Kết quả | Ghi chú |
| --- | --- | --- |
| `npm run build` | Pass | Vite build thành công. Có warning từ plugin `crx:content-scripts` về `rollupOptions` bị bỏ qua, chưa chặn build. |
| `npm test` | Pass | Chỉ có 1 test Vitest placeholder trong `tests/basic.test.js`, nên giá trị bắt bug thấp. |
| `npm run lint` | Fail | 1 error tại `content/scanner/clinical-fill.js:349`, kèm 23 warning unused. |

## Findings

### 1. Lint đang fail do `chanDoanFull` bị gán giá trị ban đầu không cần thiết

Mức độ: Cao nếu CI/release yêu cầu lint pass; thấp về runtime.

Vị trí: `content/scanner/clinical-fill.js:349`

`buildHoiChanData()` khai báo `let chanDoanFull = ''`, sau đó mọi nhánh `if/else` đều gán lại trước khi đọc. ESLint 10 báo lỗi `no-useless-assignment`, khiến `npm run lint` exit code 1.

Tác động:

- Pipeline lint hoặc release có lint gate sẽ fail.
- README ghi bản v1.1.8 đã dọn linter, nhưng trạng thái hiện tại chưa đúng.

Khuyến nghị:

- Đổi thành `let chanDoanFull;` hoặc refactor thành biểu thức/khối helper tạo chẩn đoán.
- Sau khi sửa, chạy lại `npm run lint`.

### 2. Hỗ trợ Ngoại trú chưa nhất quán: row observer lấy `KHAMBENHID`, nhưng nhiều bridge vẫn hardcode `#grdBenhNhan`

Mức độ: Cao.

Vị trí liên quan:

- `content/scanner/row-observer.js:20-25`, `49-53`
- `injected/api-bridge.js:315-317`
- `injected/api-bridge.js:758-759`
- `content/scanner/scan-flow.js:26-28`
- `content/scanner/config.js:34-36`

Row observer mới lấy ID ngoại trú từ cell `KHAMBENHID` và lưu vào `selectedPatientId`. Tuy nhiên các request chính như `REQ_FETCH_TREATMENT`, `REQ_FETCH_DRUGS`, scan flow và config vẫn dùng `#grdBenhNhan` hoặc selector nội trú. Nếu người dùng đang ở màn Ngoại trú, các luồng này có thể:

- Không tìm thấy row data.
- Lấy nhầm dữ liệu từ grid nội trú còn tồn tại/ẩn trên DOM.
- Gửi `rowId` là `KHAMBENHID` vào `jqGrid('getRowData', rowId)` của grid nội trú, trả về rỗng.

Tác động:

- Tóm tắt CLS/thuốc/tờ điều trị có thể rỗng hoặc sai bệnh nhân ở Ngoại trú.
- Scan hàng loạt chưa thực sự hỗ trợ grid ngoại trú dù selection đã hỗ trợ.

Khuyến nghị:

- Tạo helper dùng chung kiểu `resolveActivePatientGrid(rowId)` trả về `{ grid, rowId, rowData, context: 'inpatient' | 'outpatient' }`.
- Khi `rowId` đến từ `#grdDSBenhNhan`, cần map lại row thật của jqGrid hoặc truyền cả `KHAMBENHID` và DOM row id.
- Cập nhật `VNPTConfig.selectors.patientRows` để hỗ trợ cả `#grdBenhNhan` và `#grdDSBenhNhan`, hoặc phân luồng scan theo context.

### 3. `fetchClinicalSummary()` ưu tiên `#grdBenhNhan` nếu grid tồn tại, kể cả khi đang thao tác Ngoại trú

Mức độ: Cao.

Vị trí: `injected/api-bridge.js:1025-1040`

Hàm chỉ fallback sang `#grdDSBenhNhan` khi không có `#grdBenhNhan`. Trong HIS dạng nhiều tab/iframe, grid nội trú có thể vẫn tồn tại nhưng ẩn hoặc không liên quan. Khi đó `isOutpatient` vẫn là `false`, `rowData` có thể rỗng, và phần xử lý sẽ chạy theo nhánh nội trú.

Tác động:

- Auto-fill Chuyển viện/Hội chẩn ở Ngoại trú có thể lấy dữ liệu rỗng hoặc sai.
- Nhánh DOM fallback Ngoại trú vẫn có thể chạy nếu API rỗng, nhưng `isOutpatient` sai sẽ khiến code tiếp tục gọi phần tờ điều trị nội trú.

Khuyến nghị:

- Xác định grid theo DOM row đang chọn, selector hiển thị, hoặc theo row id/`KHAMBENHID`.
- Không chỉ kiểm tra grid tồn tại; cần kiểm tra visible/active context.

### 4. Cache CDS có thể giữ chẩn đoán/lab của bệnh nhân cũ khi ID khác độ dài

Mức độ: Cao trong ngữ cảnh cảnh báo lâm sàng/BHYT.

Vị trí:

- `content/cds/cds-cache.js:61-77`
- `content/cds/cds-cache.js:144-160`
- `content/cds/index.js:64-78`
- `content/cds/index.js:125-130`

`CDSCache` hiện coi ID khác độ dài là alias cùng bệnh nhân và không reset. Đây là heuristic nguy hiểm vì `KHAMBENHID`, `BENHNHANID`, `MABA` hoặc các mã khác nhau giữa bệnh nhân có thể khác độ dài. Đồng thời `startScanning()` chỉ reset thuốc nhưng giữ lại chẩn đoán/labs, và `patientDiagAccumulator` tiếp tục tích lũy theo `context.patient.id/name`.

Tác động:

- Cảnh báo CDS/BHYT có thể dùng ICD/lab của bệnh nhân trước.
- False positive/false negative trong cảnh báo chống chỉ định hoặc BHYT.

Khuyến nghị:

- Dùng khóa bệnh nhân chuẩn gồm `benhnhanId + khambenhId` nếu có, thay vì độ dài ID.
- Khi context không đủ chắc chắn, reset cache thay vì coi là alias.
- Thêm log/debug hiển thị patient key hiện tại trong CDS drawer để dễ phát hiện sai context.

### 5. Manual scan CDS chỉ request lại iframe cấp 1, không đệ quy vào iframe lồng

Mức độ: Trung bình.

Vị trí: `content/cds/index.js:344-350`

Detection context đã có logic quét iframe lồng, nhưng manual scan chỉ lặp `document.querySelectorAll('iframe')` ở top document. Nếu form thuốc nằm trong iframe lồng, nút manual scan có thể không gửi `CDS_REQUEST_DRUGS` đến helper thực sự.

Tác động:

- Người dùng bấm quét thủ công nhưng dữ liệu thuốc/ICD mới trong iframe lồng không được refresh ngay.
- Polling 3 giây có thể bù một phần, nhưng oneshot mode dễ giữ dữ liệu cũ hơn.

Khuyến nghị:

- Tái sử dụng hàm scan iframe đệ quy giống `detectScanContext()`.
- Gửi request tới mọi iframe visible có `contentWindow`, bao gồm iframe con cùng origin.

### 6. Auto-fill Clinical không kiểm tra timeout/error response trước khi build preview

Mức độ: Trung bình.

Vị trí:

- `content/scanner/messaging.js:89-93`
- `content/scanner/clinical-fill.js:483-485`

`VNPTMessaging.sendRequest()` trả `{ success: false, timeout: true }` khi timeout. `doFill()` dùng object này như dữ liệu raw và build formData, dẫn đến preview trống/thông tin fallback nhưng không báo lỗi rõ.

Tác động:

- Người dùng có thể xác nhận điền form với dữ liệu trống hoặc mặc định như `Toa thuốc Bệnh viện`, `Chuyển tuyến trên`.
- Khó phân biệt “không có dữ liệu” với “bridge timeout”.

Khuyến nghị:

- Sau `fetchClinicalData(pid)`, kiểm tra `raw.timeout`, `raw.success === false`, hoặc thiếu toàn bộ field chính.
- Hiển thị toast lỗi và không mở preview khi bridge timeout.

### 7. Có synchronous XHR trong page context khi auto-fill lấy tờ điều trị

Mức độ: Trung bình.

Vị trí: `injected/api-bridge.js:1196-1199`

`fetchClinicalSummary()` dùng `xhr.open('GET', url, false)`. Với mạng HIS chậm hoặc endpoint treo, synchronous XHR sẽ block main thread của trang HIS.

Tác động:

- UI VNPT HIS có thể đứng tạm thời khi bấm auto-fill.
- Nếu gọi nhiều candidate, độ trễ cộng dồn.

Khuyến nghị:

- Chuyển sang async `fetch()`/XHR Promise giống các phần khác.
- Giới hạn timeout rõ ràng và trả lỗi có kiểm soát cho UI.

### 8. Test hiện tại chưa bao phủ các thay đổi quan trọng

Mức độ: Trung bình.

Vị trí: `tests/basic.test.js`

Vitest chỉ kiểm tra `expect(true).toBe(true)`. Các file test HTML/manual không chạy trong `npm test`. Vì vậy kết quả pass không chứng minh các luồng mới ổn.

Tác động:

- Bug ở row observer, cache CDS, bridge message, parse ICD/thuốc có thể lọt qua CI.

Khuyến nghị:

- Thêm unit test cho:
  - `getOutpatientRowId()` với jqGrid ngoại trú.
  - Cache reset khi đổi `benhnhanId/khambenhId`.
  - Merge ICD không giữ bệnh nhân cũ.
  - `fetchClinicalSummary` grid resolver nội trú/ngoại trú bằng mock jQuery jqGrid.
  - Timeout handling của ClinicalFill.

## Rủi ro bảo trì khác

- `injected/api-bridge.js` đã dài hơn 2.000 dòng, chứa nhiều query và parsing heuristic. Nên tách theo domain (`vitals`, `labs`, `drugs`, `clinical-summary`, `cds-diagnoses`) để giảm rủi ro sửa một luồng ảnh hưởng luồng khác.
- Có nhiều warning unused trong lint. Chưa chặn runtime nhưng làm nhiễu tín hiệu khi review lỗi mới.
- `npm run build` có warning `rollupOptions` bị plugin bỏ qua. Chưa phải bug hiện tại, nhưng nên theo dõi nếu nâng Vite/CRX plugin tiếp.

## Đề xuất checklist sửa lỗi

1. Sửa lint error tại `clinical-fill.js:349`, chạy lại `npm run lint`.
2. Viết helper resolve grid active cho nội trú/ngoại trú và thay các hardcode `#grdBenhNhan` trong bridge chính.
3. Thay heuristic alias ID trong CDS cache bằng patient key chuẩn.
4. Bổ sung timeout/error guard cho ClinicalFill.
5. Chuyển synchronous XHR trong `fetchClinicalSummary()` sang async.
6. Thêm test Vitest thực chất cho các điểm trên.

## Kết luận

Bản v1.1.8 đã giải quyết một số lỗi lớn về iframe và chuẩn hóa chẩn đoán, nhưng vẫn còn rủi ro cao ở phần nhất quán patient context sau khi thêm ngoại trú. Ưu tiên hiện tại nên là đảm bảo mọi request bridge biết chính xác đang dùng grid nào và bệnh nhân nào, vì đây là nền cho CDS, tóm tắt lâm sàng và auto-fill.
