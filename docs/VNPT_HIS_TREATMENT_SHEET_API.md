# Phân tích Cấu trúc API & Trích xuất Dữ liệu Tờ điều trị VNPT HIS (Phân hệ Nội trú)

Tài liệu này lưu trữ kết quả phân tích cấu trúc API, bản đồ ánh xạ (Data Mapping) giữa giao diện trực quan và cơ sở dữ liệu, cùng cấu trúc gói tin JSON thực tế của Tờ điều trị Nội trú trong hệ thống VNPT HIS (`NGT02K015_PhieuDT`). 

Bác sĩ Huỳnh Trung Anh có thể sử dụng tài liệu này để tham chiếu phát triển các dự án khác liên quan đến tích hợp dữ liệu hoặc tự động hóa trên hệ thống VNPT HIS.

---

## 1. Dữ liệu Lâm sàng Thực tế trên Màn hình Bác sĩ (Dữ liệu Mẫu)

Dữ liệu dưới đây được trích xuất 100% chính xác từ một tờ điều trị kiểm thử thực tế trên hệ thống VNPT HIS:

### 📅 Thông tin Hành chính & Bệnh nhân
*   **Họ và tên:** `ĐỖ PHÚC HẬU`
*   **Năm sinh:** `1999` (Nam - 27 tuổi)
*   **Mã bệnh nhân (Mã BN):** `26035841`
*   **Mã bệnh án:** `2605170026`
*   **Mã bệnh phẩm / Phiếu điều trị ID (`MAUBENHPHAMID`):** `11450577` (Mã định danh duy nhất của tờ điều trị này trong CSDL)
*   **Thời gian chỉ định y lệnh:** `22/05/2026 23:01:03`
*   **Khoa điều trị:** `KHOA NGOẠI THẦN KINH - CHẤN THƯƠNG CHẤN THƯƠNG CHỈNH HÌNH`
*   **Phòng điều trị:** `NGOẠI TK - CHẤN THƯƠNG CH`
*   **Bác sĩ điều trị (Người tạo):** `Huỳnh Trung Anh` (Mã người dùng: `183518`)

### 🩺 Chỉ số Sinh hiệu (Vital Signs)
*   **Mạch:** `80` lần/phút
*   **Nhiệt độ:** `37` °C
*   **Huyết áp:** `110 / 70` mmHg
*   **Nhịp thở:** `20` lần/phút
*   **Cân nặng:** `60` kg
*   **Chiều cao:** `175` cm
*   **Chỉ số SPO2:** (Trống)
*   **Tiền sử dị ứng:** `on` (Có kiểm tra đặc điểm dị ứng nhưng thời gian dị ứng để trống)

### 📝 Nội dung Điều trị & Khám lâm sàng
*   **Lý do vào viện:** `MỆT`
*   **Tiền sử bản thân:** `Khỏe`
*   **Tiền sử gia đình:** `Khỏe`
*   **Diễn biến bệnh:** `test diễn tiến bệnh`
*   **Khám toàn thân:** `test khám toàn thân`
*   **Khám bộ phận:** (Trống)
*   **Phương pháp / Pháp phương YHCT:** `test pháp phương???? Wtf`
*   **Hướng xử trí (Xử lý):** `test xử trí`
*   **Y lệnh khác (Y lệnh điều trị):**
    ```html
    <p><strong>*Y lệnh khác:</strong><br /> test xử trí<br /> &nbsp;</p>
    ```
*   **Số tờ:** `test số tờ`
*   **Ghi chú:** `test ghi chú`

### 📋 Chẩn đoán Bệnh (ICD10)
*   **Chẩn đoán bệnh chính:** `S42.0` - `Gãy xương đòn Trái`
*   **Chẩn đoán bệnh kèm theo (Bệnh phụ):**
    1.  `S90.2` - `Đụng giập ngón chân có tổn thương móng`
    2.  `V22` - `Lái xe mô tô bị thương khi va chạm với mô tô 2-3 bánh`

---

## 2. Bản đồ Ánh xạ Giao diện ➔ API (Data Mapping)

VNPT HIS sử dụng cơ chế tự động quét tất cả các ô nhập liệu trên giao diện thông qua hàm `FormUtil.setFormToObject` để đóng gói thành một đối tượng JSON gửi xuống máy chủ. 

Dưới đây là bảng đối chiếu chi tiết giữa **Tên trường lâm sàng**, **ID phần tử trên giao diện (DOM ID)**, và **Tên biến tương ứng trong gói tin API**:

| Số thứ tự | Tên Trường Lâm Sàng | DOM ID (Tại Popup Tờ điều trị) | DOM ID (Tại Buồng điều trị chính) | Tên Biến trong API (JSON Payload) | Giá trị thực tế trích xuất |
| :---: | :--- | :--- | :--- | :--- | :--- |
| **1** | Mã bệnh phẩm / Phiếu điều trị | `hidMBPID` | `hidMAUBENHPHAMID` | `MAUBENHPHAMID` | `11450577` |
| **2** | Mã lượt khám bệnh | (Ẩn) | `hidKHAMBENHID` | `KHAMBENHID` | `1540712` |
| **3** | Mã Hồ sơ bệnh án | (Ẩn) | `hidHOSOBENHANID` | `HOSOBENHANID` | `1457012` |
| **4** | Thời gian chỉ định y lệnh | `txtTHOIGIANCHIDINH` | `hidNGAYMAUBENHPHAM` | `THOIGIANCHIDINH` | `22/05/2026 23:01:03` |
| **5** | Số tờ điều trị | `txtSOTO_DT` | (Không hiển thị) | `SOTO_DT` | `test số tờ` |
| **6** | Lý do vào viện | `txtLYDOVAOVIEN` | (Không hiển thị) | `LYDOVAOVIEN` | `MỆT` |
| **7** | Diễn biến bệnh | `txtDIENBIENBENH` | `tcDieuTritxtDIENBIENBENH` | `DIENBIENBENH` | `test diễn tiến bệnh` |
| **8** | Khám toàn thân | `txtKHAMTOANTHAN` | `tcDieuTritxtTOANTHAN` | `KHAMTOANTHAN` | `test khám toàn thân` |
| **9** | Khám bộ phận | `txtKHAMBOPHAN` | `tcDieuTritxtKHAMBOPHAN` | `KHAMBOPHAN` | (Trống) |
| **10** | Tiền sử bản thân | `txtTIENSUBENH_BANTHAN` | `tcDieuTritxtTIENSUBENH_BANTHAN` | `TIENSUBENH_BANTHAN` | `Khỏe` |
| **11** | Tiền sử gia đình | `txtTIENSUBENH_GIADINH` | `tcDieuTritxtTIENSUBENH_GIADINH` | `TIENSUBENH_GIADINH` | `Khỏe` |
| **12** | Phương pháp YHCT (Pháp phương)| `txtPHUONGPHAP_YHCT` | (Không hiển thị) | `PHUONGPHAP_YHCT` | `test pháp phương???? Wtf` |
| **13** | Hướng xử trí / Xử lý | `txtXULY` / `txtHUONGXUTRI` | `tcDieuTritxtXULY` | `XULY` / `HUONGXUTRI` | `test xử trí` |
| **14** | Y lệnh điều trị chi tiết | `txtYLENH` (CKEditor) | `tcDieuTritxtYLENH` (CKEditor) | `YLENH` | `<p><strong>*Y lệnh khác:</strong>...</p>` |
| **15** | Ghi chú tờ điều trị | `txtGHICHU` | (Không hiển thị) | `GHICHU` | `test ghi chú` |
| **16** | Mạch (lần/phút) | `txtMACH` | `tcDieuTritxtMACH` | `MACH` | `80` |
| **17** | Nhiệt độ (°C) | `txtNHIETDO` | `tcDieuTritxtNHIETDO` | `NHIETDO` | `37` |
| **18** | Huyết áp tối đa (tâm thu) | `txtHUYETAP_HI` | `tcDieuTritxtHUYETAP1` | `HUYETAP_HI` | `110` |
| **19** | Huyết áp tối thiểu (tâm trương) | `txtHUYETAP_LOW` | `tcDieuTritxtHUYETAP2` | `HUYETAP_LOW` | `70` |
| **20** | Nhịp thở (lần/phút) | `txtNHIPTHO` | `tcDieuTritxtNHIPTHO` | `NHIPTHO` | `20` |
| **21** | Cân nặng (kg) | `txtCANNANG` | `tcDieuTritxtCANNANG` | `CANNANG` | `60` |
| **22** | Chiều cao (cm) | `txtCHIEUCAO` | `tcDieuTritxtCHIEUCAO` | `CHIEUCAO` | `175` |
| **23** | Chỉ số oxy trong máu (SPO2) | `txtSPO2` | `tcDieuTritxtSPO2` | `SPO2` | (Trống) |
| **24** | Mã ICD10 bệnh chính | `txtTKMACHANDOAN` / `cboMACHANDOAN` | `tcDieuTritxtCHUANDOAN` (Chứa tên) | `MACHANDOAN` | `S42.0` |
| **25** | Tên bệnh chính | `txtBCEDITVK` | (Không hiển thị) | `TENBENHCHINH` | `Gãy xương đòn Trái` |
| **26** | Ghi chú bệnh chính | `txtGHICHU_BENHCHINH` | (Không hiển thị) | `GHICHU_BENHCHINH` | (Trống) |
| **27** | Chẩn đoán phụ (kem theo) | `txtCHANDOANPHU` | `tcDieuTritxtBENHKEMTHEO` | `TENCHANDOANKEMTHEO` | `S90.2-đụng giập ngón chân...` |
| **28** | Tiền sử dị ứng (Số tháng) | `txtSOTHANG_DIUNG` | `tcDieuTritxtSOTHANG_DIUNG` | `SOTHANG_DIUNG` | (Trống) |
| **29** | Tiền sử hút thuốc lá (Số tháng) | `txtSOTHANG_THUOCLA` | `tcDieuTritxtSOTHANG_THUOCLA` | `SOTHANG_THUOCLA` | (Trống) |
| **30** | Tiền sử nghiện ma túy (Số tháng) | `txtSOTHANG_MATUY` | `tcDieuTritxtSOTHANG_MATUY` | `SOTHANG_MATUY` | (Trống) |
| **31** | Tiền sử rượu bia (Số tháng) | `txtSOTHANG_RUOUBIA` | `tcDieuTritxtSOTHANG_RUOUBIA` | `SOTHANG_RUOUBIA` | (Trống) |

---

## 3. Cấu trúc Gói tin API JSON Hoàn chỉnh (JSON Payload Structure)

Khi người dùng thực hiện hành động **"Lưu"** hoặc **"Lưu & Đóng"**, toàn bộ dữ liệu ở phần 2 sẽ được đóng gói thành một chuỗi JSON gửi trực tiếp đến database thông qua API RPC. 

Dưới đây là định dạng cấu trúc JSON API chính xác của một Tờ điều trị hoàn chỉnh:

```json
{
  "MAUBENHPHAMID": 11450577,
  "KHAMBENHID": 1540712,
  "HOSOBENHANID": 1457012,
  "KHOAID": 95795,
  "PHONGID": 96280,
  "THOIGIANCHIDINH": "22/05/2026 23:01:03",
  "SOTO_DT": "test số tờ",
  "LYDOVAOVIEN": "MỆT",
  "DIENBIENBENH": "test diễn tiến bệnh",
  "KHAMTOANTHAN": "test khám toàn thân",
  "KHAMBOPHAN": "",
  "TIENSUBENH_BANTHAN": "Khỏe",
  "TIENSUBENH_GIADINH": "Khỏe",
  "PHUONGPHAP_YHCT": "test pháp phương???? Wtf",
  "XULY": "test xử trí",
  "HUONGXUTRI": "test xử trí",
  "GHICHU": "test ghi chú",
  "YLENH": "<p><strong>*Y l&ecirc;̣nh kh&aacute;c:</strong><br />\ntest xử tr&iacute;<br />\n&nbsp;</p>\n",
  
  "MACH": "80",
  "NHIETDO": "37",
  "HUYETAP_HI": "110",
  "HUYETAP_LOW": "70",
  "NHIPTHO": "20",
  "CANNANG": "60",
  "CHIEUCAO": "175",
  "SPO2": "",
  
  "MACHANDOAN": "S42.0",
  "MACHANDOANKEMTHEO": "S90.2;V22",
  "TENCHANDOANKEMTHEO": "S90.2-đụng giập ngón chân có tổn thương móng;V22-Lái xe mô tô bị thương khi va chạm với mô tô 2-3 bánh",
  
  "SOTHANG_DIUNG": "",
  "SOTHANG_THUOCLA": "",
  "SOTHANG_MATUY": "",
  "SOTHANG_THUOCLAO": "",
  "SOTHANG_RUOUBIA": "",
  "SOTHANG_KHAC": "",
  "CONSP": "1"
}
```

---

## 4. Cơ chế Hoạt động Kỹ thuật của API trong VNPT HIS

Hệ thống VNPT HIS giao tiếp dữ liệu thông qua cơ chế RPC (Remote Procedure Call) dựa trên thư viện `jsonrpc.js` nguyên bản. Dưới đây là phân tích luồng xử lý:

### 📥 1. Luồng tải dữ liệu (Load Data)
*   **Khi tạo mới tờ điều trị:** Hệ thống gọi Stored Procedure `NGT02K015.LAYDLPDT` để lấy các thông tin mặc định từ phòng khám/buồng bệnh trước đó (bao gồm sinh hiệu đo gần nhất và chẩn đoán ban đầu):
    ```javascript
    var data_ar = jsonrpc.AjaxJson.ajaxCALL_SP_O("NGT02K015.LAYDLPDT", khambenhId);
    ```
*   **Khi mở lại tờ điều trị cũ:** Hệ thống gọi Stored Procedure `NGT02K015.LAYDL` thông qua ID tờ điều trị:
    ```javascript
    var data_ar = jsonrpc.AjaxJson.ajaxCALL_SP_O("NGT02K015.LAYDL", maubenhphamId);
    ```

### 📤 2. Luồng ghi dữ liệu (Save Data)
Khi nhấn Lưu, hệ thống tự động xác định hành động dựa trên `maubenhphamId`:
*   **Nếu `maubenhphamId` là `-1` (Tạo mới):** Gọi hàm SQL `NGT02K015.INS` (hoặc `NGT02K015.INSBVBD` đối với một số bệnh viện đặc thù có tham số CONSP):
    ```javascript
    var res = jsonrpc.AjaxJson.ajaxCALL_SP_S("NGT02K015.INS", JSON.stringify(objData));
    ```
*   **Nếu `maubenhphamId > 0` (Cập nhật):** Gọi hàm SQL `NGT02K015.UPD`:
    ```javascript
    var res = jsonrpc.AjaxJson.ajaxCALL_SP_S("NGT02K015.UPD", JSON.stringify(objData));
    ```

---

## 5. Giá trị Ứng dụng & Hướng phát triển cho Các Dự án Khác

Khi phát triển các ứng dụng tự động hóa hoặc tích hợp cho VNPT HIS, cấu trúc API này cho phép:
1.  **Xây dựng RPA / Auto-fill Bot:** Mô phỏng thao tác hoặc đẩy trực tiếp dữ liệu từ các thiết bị đo sinh hiệu cầm tay (máy đo huyết áp, nhiệt độ bluetooth) thẳng vào CSDL của HIS thông qua API JSONRPC mà không cần bác sĩ nhập tay.
2.  **Đồng bộ hóa Bệnh án Điện tử (EMR):** Sử dụng các Stored Procedure `NGT02K015.LAYDL` để lấy dữ liệu tờ điều trị sạch phục vụ phân tích số liệu khoa phòng hoặc đồng bộ lên hệ thống EMR tập trung.
3.  **Tích hợp Trợ lý Trí tuệ Nhân tạo (AI Assistant):** Tự động bắt sự kiện Lưu để gửi thông tin lâm sàng lên các dịch vụ AI tóm tắt hoặc gợi ý lâm sàng nâng cao ngoài hệ thống.
