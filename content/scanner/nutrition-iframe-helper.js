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
    var PARENT_ORIGIN = '*';

    var $ = window.jQuery || window.$;

    // Cleanup listener cũ (tránh duplicate)
    if (window._vnptNutritionHandler) {
        window.removeEventListener('message', window._vnptNutritionHandler);
    }

    window._vnptNutritionHandler = function (event) {
        if (event.source !== window.parent) return;
        if (!event.data || event.data.type !== 'NUTRITION_FILL_FORM') return;

        try {
            if (event.data.contextToken) {
                var expectedName = event.data.expectedPatientName || '';
                var patientNameEl = document.getElementById('txtTENBENHNHAN') || document.getElementById('txtHoTen') || document.querySelector('input[name="TENBENHNHAN"]') || document.querySelector('input[name="HOTEN"]');
                if (patientNameEl && expectedName) {
                    var nameOnForm = (patientNameEl.value || patientNameEl.textContent || '').trim().toUpperCase();
                    var nameExpected = expectedName.trim().toUpperCase();
                    if (nameOnForm && nameExpected && nameOnForm.indexOf(nameExpected) === -1 && nameExpected.indexOf(nameOnForm) === -1) {
                        console.error('[VNPT-Helper] BLOCK FILL: Mismatch detected! Form name:', nameOnForm, 'Expected:', nameExpected);
                        sendResponse(false, 'FORM_CONTEXT_MISMATCH');
                        return;
                    }
                }

                var expectedRecordId = event.data.contextToken ? event.data.contextToken.rowId : '';
                var recordIdEl = document.getElementById('txtMABENHNHAN') || document.getElementById('txtMAVAOVIEN');
                if (recordIdEl && expectedRecordId) {
                    var idOnForm = (recordIdEl.value || recordIdEl.textContent || '').trim();
                    if (idOnForm && expectedRecordId && idOnForm !== expectedRecordId) {
                        console.warn('[VNPT-Helper] Mismatch ID detected (Warn only): Form ID:', idOnForm, 'Expected:', expectedRecordId);
                    }
                }
            }

            var d = event.data;
            var weight = d.weight || '';
            var height = d.height || '';
            var bp = d.bloodPressure || '';
            var admissionDate = d.admissionDate || '';
            var mapping = d.mapping || {
                weight: 'textfield_1535',
                height: 'textfield_1536',
                bmi: 'textfield_1526',
                systolic: 'textfield_1537',
                diastolic: 'textfield_1538',
                sutCanNo: 'checkbox_1527',
                sutCan: 'checkbox_1539',
                bmiThap: 'checkbox_1540',
                teoCo: 'checkbox_1553',
                phuNgoaiVi: 'checkbox_1554',
                benhLyTieuHoa: 'checkbox_1542',
                anUongGiamSut: 'checkbox_1543',
                boSungMieng: 'checkbox_1546'
            };

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
                    dp.value = admissionDate;
                    if ($) {
                        $(dp).trigger('change').trigger('input');
                    } else {
                        dp.dispatchEvent(new Event('change', { bubbles: true }));
                        dp.dispatchEvent(new Event('input', { bubbles: true }));
                    }
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
                                    input.value = admissionDate;
                                    if ($) {
                                        $(input).trigger('change').trigger('input');
                                    } else {
                                        input.dispatchEvent(new Event('change', { bubbles: true }));
                                        input.dispatchEvent(new Event('input', { bubbles: true }));
                                    }
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
                        for (var j = 0; j < inputs.length; j++) {
                            var el = inputs[j];
                            var val = el.value || '';
                            if (val && val.match(/\d{2}\/\d{2}\/\d{4}/)) {
                                el.removeAttribute('disabled');
                                el.value = admissionDate;
                                if ($) {
                                    $(el).trigger('change').trigger('input');
                                } else {
                                    el.dispatchEvent(new Event('change', { bubbles: true }));
                                    el.dispatchEvent(new Event('input', { bubbles: true }));
                                }
                                console.log('[Nutrition Iframe] Fallback điền Ngày Nhập Khoa vào:', el.id);
                                break; 
                            }
                        }
                    }
                }
            } else {
                console.log('[Nutrition Iframe] Cảnh báo: admissionDate rỗng, không thể điền Ngày thực hiện.');
            }

            setVal(mapping.weight, weight, 'weight');
            setVal(mapping.height, height, 'height');

            // Xử lý Huyết áp (nếu có định dạng 120/80)
            if (bp && bp.includes('/')) {
                var parts = bp.split('/');
                setVal(mapping.systolic, parts[0], 'systolic');
                setVal(mapping.diastolic, parts[1], 'diastolic');
            } else if (bp) {
                setVal(mapping.systolic, bp, 'systolic');
            }

            // Tự tính BMI = cân nặng / (chiều cao ^ 2)
            var bmi = '';
            var w = parseFloat(weight);
            var h = parseFloat(height);
            if (!isNaN(w) && !isNaN(h) && h > 0) {
                bmi = (w / (h * h)).toFixed(2);
            }
            setVal(mapping.bmi, bmi, 'bmi');

            // Sụt cân trong 3 tháng gần đây: tick "Không"
            setVal(mapping.sutCanNo, true, 'sutCanNo');

            // Phần II: tick ALL "Không"
            setVal(mapping.sutCan, true, 'sutCan');
            setVal(mapping.bmiThap, true, 'bmiThap');
            setVal(mapping.teoCo, true, 'teoCo');
            setVal(mapping.phuNgoaiVi, true, 'phuNgoaiVi');
            setVal(mapping.benhLyTieuHoa, true, 'benhLyTieuHoa');
            setVal(mapping.anUongGiamSut, true, 'anUongGiamSut');

            // Phần III: tick "Bổ sung DD qua miệng"
            setVal(mapping.boSungMieng, true, 'boSungMieng');

            sendResponse(true);
        } catch (e) {
            sendResponse(false, e.message || 'Lỗi không xác định');
        }
    };

    window.addEventListener('message', window._vnptNutritionHandler);

    /**
     * Tìm element bằng danh sách ID (pipe-separated) + fallback label search.
     * @param {string} fieldIdStr - Pipe-separated list of possible IDs or selectors
     * @param {string} key - Clinical data key
     * @returns {{el: HTMLElement, targetId: string} | null}
     */
    function getFieldElement(fieldIdStr, key) {
        if (!fieldIdStr) return null;
        var ids = fieldIdStr.split('|');

        for (var i = 0; i < ids.length; i++) {
            var currId = ids[i].trim();
            if (!currId) continue;
            
            var el = document.getElementById(currId) || document.querySelector('[name="' + currId + '"]');
            if (!el) {
                try {
                    el = document.querySelector(currId);
                } catch (_e) {}
            }
            if (el) return { el: el, targetId: currId };
        }

        // Fallback to Self-Healing Engine
        if (window.SelfHealingEngine) {
            var healed = window.SelfHealingEngine.resolveElement(document, fieldIdStr, key);
            if (healed) {
                return { el: healed, targetId: healed.id || healed.name || fieldIdStr };
            }
        }

        return null;
    }

    /**
     * Set giá trị cho field và trigger change events.
     * @param {string} fieldIdStr
     * @param {any} val
     * @param {string} key
     * @returns {boolean}
     */
    function setVal(fieldIdStr, val, key) {
        if (val === undefined || val === null) return false;
        var found = getFieldElement(fieldIdStr, key);

        if (!found) {
            console.log('[Nutrition Iframe] Field NOT FOUND:', fieldIdStr, '| value:', String(val).substring(0, 50));
            return false;
        }

        var el = found.el;
        el.removeAttribute('disabled');
        el.removeAttribute('readonly');

        if (el.type === 'checkbox' || el.type === 'radio') {
            var expectChecked = String(val) === '1' || val === true || String(val).toLowerCase() === 'true';
            if (el.checked !== expectChecked) {
                el.click();
            }
        } else {
            el.value = val;
        }

        if ($) {
            $(el).trigger('change').trigger('input');
        } else {
            el.dispatchEvent(new Event('change', { bubbles: true }));
            el.dispatchEvent(new Event('input', { bubbles: true }));
        }

        console.log('[Nutrition] Đã điền:', found.targetId, '->', String(val).substring(0, 60));
        return true;
    }

    function sendResponse(success, error) {
        var msg = { type: 'NUTRITION_FILL_RESULT', success: success };
        if (error) msg.error = error;
        window.parent.postMessage(msg, PARENT_ORIGIN);
    }
})();
