/**
 * VNPT HIS Extension v4.0.1
 * Nutrition Iframe Helper
 * 
 * Được inject vào iframe chứa form DD-03 qua web_accessible_resources.
 * Chạy trong PAGE CONTEXT (có truy cập jQuery).
 * Chỉ xử lý 1 lệnh: NUTRITION_FILL_FORM
 */
(function () {
    'use strict';
    var PARENT_ORIGIN = window.location.origin;

    var $ = window.jQuery || window.$;

    // Cleanup listener cũ (tránh duplicate)
    if (window._vnptNutritionHandler) {
        window.removeEventListener('message', window._vnptNutritionHandler);
    }

    window._vnptNutritionHandler = function (event) {
        if (event.source !== window.parent) return;
        if (event.origin !== PARENT_ORIGIN) return;
        if (!event.data || event.data.type !== 'NUTRITION_FILL_FORM') return;

        try {
            var d = event.data;
            var weight = d.weight || '';
            var height = d.height || '';
            var bp = d.bloodPressure || '';
            var admissionDate = d.admissionDate || '';

            console.log('[Nutrition Iframe] Nhận tín hiệu điền form:', d);

            // Cứu cánh: Nếu TOP frame báo về rỗng, Helper sẽ tự tìm trong nội bộ Iframe của nó
            if (!admissionDate) {
                var localLbl = document.getElementById('lblMSG_BOSUNG');
                if (localLbl) {
                    var m = localLbl.innerText.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/);
                    if (m) {
                        admissionDate = m[1];
                        console.log('[Nutrition Iframe] TỰ TÌM thấy Ngày nhập khoa từ #lblMSG_BOSUNG:', admissionDate);
                    }
                } else {
                    // Fallback local iframe
                    var localM = document.body.innerText.match(/(\d{2}\/\d{2}\/\d{4}\s\d{2}:\d{2}:\d{2})/);
                    if (localM) {
                        admissionDate = localM[1];
                        console.log('[Nutrition Iframe] TỰ TÌM thấy Ngày nhập khoa qua Fallback Regex:', admissionDate);
                    }
                }
            }

            // Tự động điền Ngày Nhập Khoa vào field Ngày Thực Hiện
            if (admissionDate) {
                // Ưu tiên 1: Tấn công trực diện vào khung nhập chính xác theo ID VNPT cung cấp
                var dp = document.getElementById('datepicker_TGTH');
                if (dp) {
                    dp.removeAttribute('disabled'); // Mở khóa trường bị disable
                    setVal('datepicker_TGTH', admissionDate);
                    console.log('[Nutrition Iframe] ĐỀ ĐIỀN CHUẨN XÁC VÀO #datepicker_TGTH:', admissionDate);
                } else {
                    // Ưu tiên 2: Tìm thẻ chứa chữ "Ngày thực hiện" rồi lấy input kế nó (Cho form dự phòng)
                    var elements = document.querySelectorAll('td, span, div, label');
                    var injectedDate = false;
                    for (var i = 0; i < elements.length; i++) {
                        var txt = (elements[i].innerText || elements[i].textContent || '').trim();
                        if (txt === 'Ngày thực hiện' || txt.indexOf('Ngày thực hiện') === 0) {
                            var container = elements[i].closest('tr');
                            if (!container) container = elements[i].parentElement?.parentElement;
                            
                            if (container) {
                                var input = container.querySelector('input[type="text"]');
                                if (input) {
                                    input.removeAttribute('disabled');
                                    setVal(input.id, admissionDate);
                                    injectedDate = true;
                                    console.log('[Nutrition Iframe] Đã điền Ngày Nhập Khoa vào:', input.id);
                                    break;
                                }
                            }
                        }
                    }
                    
                    // Fallback: Tìm ô nhập text đầu tiên có format thời gian
                    if (!injectedDate) {
                        var inputs = document.querySelectorAll('input[type="text"]');
                        for (var i = 0; i < inputs.length; i++) {
                            var el = inputs[i];
                            var val = el.value || '';
                            if (val && val.match(/\d{2}\/\d{2}\/\d{4}/)) {
                                el.removeAttribute('disabled');
                                setVal(el.id, admissionDate);
                                console.log('[Nutrition Iframe] Fallback điền Ngày Nhập Khoa vào:', el.id);
                                break; 
                            }
                        }
                    }
                }
            } else {
                console.log('[Nutrition Iframe] Cảnh báo: admissionDate rỗng, không thể điền Ngày thực hiện.');
            }

            setVal('textfield_1535', weight);
            setVal('textfield_1536', height);

            // Xử lý Huyết áp (nếu có định dạng 120/80)
            if (bp && bp.includes('/')) {
                var parts = bp.split('/');
                setVal('textfield_1537', parts[0]);
                setVal('textfield_1538', parts[1]);
            } else if (bp) {
                setVal('textfield_1537', bp);
            }

            // Tự tính BMI = cân nặng / (chiều cao ^ 2)
            var bmi = '';
            var w = parseFloat(weight);
            var h = parseFloat(height);
            if (!isNaN(w) && !isNaN(h) && h > 0) {
                bmi = (w / (h * h)).toFixed(2);
            }
            setVal('textfield_1526', bmi);


            // Sụt cân trong 3 tháng gần đây: tick "Không"
            var sutCan = document.getElementById('checkbox_1527');
            if (sutCan && !sutCan.checked) sutCan.click();

            // Phần II: tick ALL "Không"
            ['checkbox_1539', 'checkbox_1540', 'checkbox_1553', 'checkbox_1554', 'checkbox_1542', 'checkbox_1543'].forEach(function (id) {
                var cb = document.getElementById(id);
                if (cb && !cb.checked) cb.click();
            });

            // Phần III: tick "Bổ sung DD qua miệng"
            var bsMieng = document.getElementById('checkbox_1546');
            if (bsMieng && !bsMieng.checked) bsMieng.click();

            sendResponse(true);
        } catch (e) {
            sendResponse(false, e.message || 'Lỗi không xác định');
        }
    };

    window.addEventListener('message', window._vnptNutritionHandler);

    function setVal(id, val) {
        var el = document.getElementById(id);
        if (!el) return;
        el.value = val;
        if ($) {
            $(el).trigger('change').trigger('input');
        } else {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    function sendResponse(success, error) {
        var msg = { type: 'NUTRITION_FILL_RESULT', success: success };
        if (error) msg.error = error;
        window.parent.postMessage(msg, PARENT_ORIGIN);
    }
})();
