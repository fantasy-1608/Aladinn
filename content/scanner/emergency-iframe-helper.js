/**
 * VNPT HIS Smart Scanner v4.0.1
 * Emergency Iframe Helper
 * 
 * Được inject động vào iframe của form 39/BV2 - Phiếu nhận định phân loại người bệnh tại khoa cấp cứu
 * Chạy phương thức DOM Traversal (điền form trực tiếp trên UI giống Phiếu Dinh Dưỡng).
 */

(function () {
    'use strict';
    var PARENT_ORIGIN = window.location.origin;
    var $ = window.jQuery || window.$;

    if (window._vnptEmergencyHandler) {
        window.removeEventListener('message', window._vnptEmergencyHandler);
    }

    window._vnptEmergencyHandler = function (event) {
        if (event.source !== window.parent) return;
        if (event.origin !== PARENT_ORIGIN) return;
        
        if (!event.data || (event.data.type !== 'EMERGENCY_FILL_FORM' && event.data.type !== 'EMERGENCY_FILL_FORM_API')) return;

        try {
            var d = event.data;
            var admissionDate = d.admissionDate || d.ngayDenKham || '';
            var temp = d.temperature || '';
            var pulse = d.pulse || '';
            var bp = d.bloodPressure || '';
            var breath = d.breathing || d.respiratoryRate || '';
            var spo2 = d.spo2 || '';
            var weight = d.weight || '';
            var height = d.height || '';

            console.log('[Emergency Iframe] Nhận lệnh DOM Fill:', d);

            var now = new Date();
            var strNow = String(now.getDate()).padStart(2, '0') + '/' + 
                         String(now.getMonth() + 1).padStart(2, '0') + '/' + 
                         now.getFullYear() + ' ' + 
                         String(now.getHours()).padStart(2, '0') + ':' + 
                         String(now.getMinutes()).padStart(2, '0');

            var bmi = '';
            var w = parseFloat(weight);
            var h = parseFloat(height);
            if (!isNaN(w) && !isNaN(h) && h > 0) {
                var hMeter = h > 3 ? h / 100 : h;
                bmi = (w / (hMeter * hMeter)).toFixed(2);
            } else if (d.bmi) {
                bmi = d.bmi;
            }

            // --- Lấy dữ liệu sẵn có trên HTML ---
            var lblGiuong = document.getElementById('lblGIUONG') ? document.getElementById('lblGIUONG').innerText.trim() : '';
            
            // Lý do vào viện: chỉ lấy từ d.lyDoVaoVien (cùng nguồn bệnh án, do emergency.js cung cấp)
            // KHÔNG lấy chẩn đoán (txtBenhChinh / txtBenhKem)
            var lydoVaoVien = d.lyDoVaoVien || '';

            var elements = document.querySelectorAll('td, span, div, label, th');
            var inputsFilled = 0;
            
            function fillInputNearText(labelTexts, val) {
                if (!val) return false;
                if (!Array.isArray(labelTexts)) labelTexts = [labelTexts];
                
                for (var i = 0; i < elements.length; i++) {
                    var elTxt = elements[i].innerText || elements[i].textContent || '';
                    var txt = elTxt.trim().toLowerCase();
                    // Loại bỏ các thẻ con để lấy text thực sự
                    if (elements[i].childNodes.length > 1) {
                        var directText = Array.from(elements[i].childNodes)
                            .filter(function(node) { return node.nodeType === 3; }) // TEXT_NODE
                            .map(function(node) { return node.textContent.trim(); })
                            .join(' ').toLowerCase();
                        if (directText.length > 2) txt = directText;
                    }

                    var isMatch = false;
                    for (var k = 0; k < labelTexts.length; k++) {
                        var searchTxt = labelTexts[k].toLowerCase();
                        if (txt === searchTxt || txt.indexOf(searchTxt) === 0) {
                            isMatch = true;
                            break;
                        }
                    }

                    if (isMatch) {
                        var cb = null;
                        
                        // 1. Nằm chung TD hoặc TH (ngay trong element đang check)
                        cb = elements[i].querySelector('input[type="text"], input[type="number"], input[role="textbox"], input.form-control:not([type="checkbox"]):not([type="radio"])');

                        // 2. Thẻ kế tiếp nếu là TD/TH
                        if (!cb && (elements[i].tagName === 'TD' || elements[i].tagName === 'TH' || elements[i].tagName === 'DIV')) {
                            var nextEl = elements[i].nextElementSibling;
                            if (nextEl) cb = nextEl.querySelector('input[type="text"], input[type="number"], input[role="textbox"], input.form-control:not([type="checkbox"]):not([type="radio"])');
                        }
                        
                        // 3. Nằm trong parent liền kề (nếu parent = div)
                        if (!cb && elements[i].parentElement && elements[i].parentElement.tagName === 'DIV') {
                            var parentNext = elements[i].parentElement.nextElementSibling;
                            if (parentNext) cb = parentNext.querySelector('input[type="text"], input[type="number"], input[role="textbox"], input.form-control:not([type="checkbox"]):not([type="radio"])');
                        }

                        // 4. Nếu structure là Bootstrap div cols (col-md-3 chứa label, col-md-9 chứa input)
                        if (!cb && elements[i].parentElement) {
                            var container = elements[i].closest ? elements[i].closest('.ct-form-id, .form-group, .row, .form-inline') : null;
                            if (container) {
                                var inputs = container.querySelectorAll('input[type="text"], input[type="number"], input[role="textbox"], input.form-control:not([type="checkbox"]):not([type="radio"])');
                                if (inputs.length === 1) { // Chỉ bốc nếu có đúng 1 input (tránh bốc nhầm input của form khác)
                                    cb = inputs[0];
                                } else if (inputs.length > 1) {
                                    // Kiểm tra xem label mình thuộc col nào, ưu tiên input cùng dòng
                                    for(var j=0; j<inputs.length; j++){
                                        if (inputs[j].id && (inputs[j].id.indexOf('textfield') !== -1 || inputs[j].id.indexOf('datepicker') !== -1)) {
                                            cb = inputs[j]; break;
                                        }
                                    }
                                }
                            }
                        }

                        // 5. Fallback mạnh mẽ: Tìm lên cha 1, 2, 3 level rồi scan trong node anh em của cha
                        if (!cb) {
                            var p = elements[i];
                            for(var step=0; step<4; step++) {
                                if (!p) break;
                                if (p.nextElementSibling) {
                                    cb = p.nextElementSibling.querySelector('input[type="text"], input[type="number"], input[role="textbox"], input.form-control:not([type="checkbox"]):not([type="radio"])');
                                    if (cb) break;
                                }
                                p = p.parentElement;
                            }
                        }

                        if (cb) {
                            cb.removeAttribute('disabled');
                            setVal(cb, val);
                            inputsFilled++;
                            console.log('[Emergency] Đã điền', labelTexts[0], '->', val);
                            return true;
                        }
                    }
                }
                return false;
            }

            /**
             * Chiến lược mới: Quét TẤT CẢ checkbox/radio trong form,
             * lấy text liền kề mỗi checkbox, rồi so sánh với labelTexts.
             * skipCount: bỏ qua N kết quả match đầu tiên (dùng khi cùng text xuất hiện nhiều lần)
             */
            function checkOptionNearText(labelTexts, skipCount) {
                if (!Array.isArray(labelTexts)) labelTexts = [labelTexts];
                var skip = skipCount || 0;
                
                var allInputs = document.querySelectorAll('input[type="checkbox"], input[type="radio"]');
                
                for (var i = 0; i < allInputs.length; i++) {
                    var inp = allInputs[i];
                    var adjacentText = '';
                    
                    // Lấy text liền kề checkbox:
                    // 1. Text node ngay sau checkbox
                    if (inp.nextSibling && inp.nextSibling.nodeType === 3) {
                        adjacentText = inp.nextSibling.textContent.trim();
                    }
                    // 2. Label/span ngay sau checkbox
                    if (!adjacentText && inp.nextElementSibling) {
                        var next = inp.nextElementSibling;
                        if (next.tagName === 'LABEL' || next.tagName === 'SPAN') {
                            adjacentText = next.textContent.trim();
                        }
                    }
                    // 3. Label wrapping (label chứa input)
                    if (!adjacentText && inp.parentElement && inp.parentElement.tagName === 'LABEL') {
                        var labelEl = inp.parentElement;
                        var labelClone = labelEl.cloneNode(true);
                        var inputsInClone = labelClone.querySelectorAll('input');
                        for (var r = 0; r < inputsInClone.length; r++) inputsInClone[r].remove();
                        adjacentText = labelClone.textContent.trim();
                    }
                    // 4. Label có for= trỏ vào id checkbox
                    if (!adjacentText && inp.id) {
                        var forLabel = document.querySelector('label[for="' + inp.id + '"]');
                        if (forLabel) adjacentText = forLabel.textContent.trim();
                    }
                    
                    if (!adjacentText) continue;
                    
                    var txtLower = adjacentText.toLowerCase();
                    var isMatch = false;
                    for (var k = 0; k < labelTexts.length; k++) {
                        var searchTxt = labelTexts[k].toLowerCase();
                        if (txtLower === searchTxt || txtLower.indexOf(searchTxt) !== -1) {
                            isMatch = true;
                            break;
                        }
                    }
                    
                    if (isMatch) {
                        if (skip > 0) {
                            skip--;
                            continue; // Bỏ qua match này, tìm tiếp
                        }
                        if (!inp.checked) {
                            inp.removeAttribute('disabled');
                            inp.click();
                            inputsFilled++;
                            console.log('[Emergency] Đã tick:', adjacentText);
                        }
                        return true;
                    }
                }
                return false;
            }

            // =========== Thực thi ===========
            fillInputNearText(['Ngày thực hiện', 'Thời gian thực hiện'], strNow);
            if (admissionDate) {
                fillInputNearText(['Ngày đến khám', 'Ngày giờ bệnh nhân đến viện', 'Ngày vào viện'], admissionDate);
            }

            // Các trường Text cơ bản - ưu tiên tìm bằng ID trước, fallback bằng label
            var phongInput = document.querySelector('input[rpt-param-name="PHONG"], input[name*="textfield_665"], #textfield_665');
            if (phongInput) {
                setVal(phongInput, 'Cấp cứu');
                inputsFilled++;
                console.log('[Emergency] Đã điền Phòng (ID) -> Cấp cứu');
            } else {
                fillInputNearText(['Phòng:', 'Phòng'], 'Cấp cứu');
            }
            
            fillInputNearText(['Giường:', 'Giường'], lblGiuong);
            
            // Lý do vào viện - tìm bằng ID trước
            var lydoInput = document.querySelector('textarea[id*="LYDOVAOVIEN"], input[id*="LYDOVAOVIEN"]');
            if (!lydoInput) {
                // Tìm bằng rpt-param-name hoặc tên trường
                lydoInput = document.querySelector('[rpt-param-name="LYDOVAOVIEN"], [rpt-param-name="LY_DO_VAO_VIEN"]');
            }
            if (lydoInput && lydoVaoVien) {
                setVal(lydoInput, lydoVaoVien);
                inputsFilled++;
                console.log('[Emergency] Đã điền Lý do vào viện (ID) ->', lydoVaoVien.substring(0, 50));
            } else {
                fillInputNearText(['Lý do vào viện', 'Lý do vào viện, vấn đề sức khỏe'], lydoVaoVien);
            }

            // Sinh hiệu
            fillInputNearText(['Nhiệt độ', 'Nhiệt độ (độ C)', 'Nhiệt độ:'], temp);
            fillInputNearText(['Mạch', 'Mạch (lần/phút)', 'Mạch:'], pulse);
            fillInputNearText(['Huyết áp', 'Huyết áp (mmHg)', 'Huyết áp:'], bp);
            fillInputNearText(['Nhịp thở', 'Nhịp thở (lần/phút)', 'Nhịp thở:'], breath);
            fillInputNearText(['SpO2', 'SpO2 (%)', 'SpO2:'], spo2);
            fillInputNearText(['BMI', 'BMI:'], bmi);
            fillInputNearText(['Cân nặng', 'Cân nặng (kg)', 'Cân nặng:'], weight);

            // Các trường Text mở rộng
            fillInputNearText(['Thang điểm đau', 'Điểm đau'], '4/10');

            // Checkbox / Radio - Chiến lược mới: tìm checkbox trước, đọc text bên cạnh
            checkOptionNearText(['Trung bình']);           // Toàn trạng
            checkOptionNearText(['Không']);                // Đau ngực
            checkOptionNearText(['Thấp']);                 // Nguy cơ té ngã
            checkOptionNearText(['Lo lắng']);              // Tinh thần
            checkOptionNearText(['Không'], 2);           // Dị ứng (skip 2 = bỏ qua Đau ngực + Nguy cơ té ngã)
            checkOptionNearText(['Loại 3']);               // Mức độ cấp cứu
            checkOptionNearText(['Giường cấp cứu']);      // Chuyển đến
            
            if (inputsFilled > 0) {
                window.parent.postMessage({ type: 'EMERGENCY_FILL_RESULT', success: true }, PARENT_ORIGIN);
            } else {
                window.parent.postMessage({ type: 'EMERGENCY_FILL_RESULT', success: false, error: 'Không tìm thấy thẻ DOM nhập liệu. Form Động có thể chưa hiển thị HTML hoàn toàn.' }, PARENT_ORIGIN);
            }

        } catch (e) {
            console.error('[Emergency Iframe] Error DOM Fill:', e);
            window.parent.postMessage({ type: 'EMERGENCY_FILL_RESULT', success: false, error: e.message }, PARENT_ORIGIN);
        }
    };

    window.addEventListener('message', window._vnptEmergencyHandler);
    console.log('[Aladinn/Emergency] DOM Scanner helper injected and listening.');

    if (window.parent !== window) {
        window.parent.postMessage({ type: 'EMERGENCY_HELPER_READY' }, '*');
    }

    function setVal(el, val) {
        if (!el) return;
        el.value = val;
        if ($) {
            $(el).trigger('change').trigger('input');
        } else {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
})();
