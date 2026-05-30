/**
 * VNPT HIS Smart Scanner v4.0.1
 * History Iframe Helper
 * 
 * Inject vào iframe chứa form "Tạo Bệnh án".
 */
(function () {
    'use strict';
    var PARENT_ORIGIN = '*';
    var _$ = window.jQuery || window.$;

    if (window._vnptHistoryHandler) {
        window.removeEventListener('message', window._vnptHistoryHandler);
    }

    // Shortcut inside iframe
    window.addEventListener('keydown', function (e) {
        var isL = e.key === 'L' || e.key === 'l';
        if ((e.ctrlKey || e.metaKey) && e.shiftKey && isL) {
            window.VNPT_LogFormFields();
        }
    });

    window._vnptHistoryHandler = async function (event) {
        if (event.source !== window.top) return;
        if (!event.data) return;

        if (event.data.type === 'LOG_FIELDS') {
            window.VNPT_LogFormFields();
            return;
        }

        if (event.data.type !== 'HISTORY_FILL_FORM') return;

        // Bỏ qua nếu chạy trong môi trường Content Script sandbox của Chrome để tránh xung đột với Injected Script
        var isContentScript = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.id);
        if (isContentScript) return;

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
            }

            var data = event.data.history || {};
            var mapping = event.data.mapping || {};
            var defaultMsg = event.data.defaultMsg || 'Chưa ghi nhận bất thường';
            var specializedFields = event.data.specializedFields || [];
            
            // ÉP BUỘC BẬT HIỆU ỨNG GÕ CHỮ BẤT CHẤP CẤU HÌNH ĐỂ TEST
            var useTyping = true;

            // Xây dựng hàng đợi điền tuần tự
            var fillQueue = [];
            for (var key in mapping) {
                var fieldId = mapping[key];
                var val = data[key];

                if (specializedFields.indexOf(fieldId) !== -1 && (!val || val.trim() === '')) {
                    val = defaultMsg;
                }

                if (val !== undefined && val !== null && val !== '') {
                    fillQueue.push({ type: 'val', id: fieldId, val: val });
                }
            }

            if (data.mainDiag) {
                fillQueue.push({ type: 'combo', id: 'txtMABENHCHINH', val: data.mainDiag.code });
                fillQueue.push({ type: 'val', id: 'txtBENHCHINH', val: data.mainDiag.text });
            }
            if (data.subDiag) {
                fillQueue.push({ type: 'combo', id: 'txtMABENHKEMTHEO', val: data.subDiag.code });
                fillQueue.push({ type: 'val', id: 'txtBENHKEMTHEO', val: data.subDiag.text });
            }

            // Lọc riêng các trường Combo (như Mã bệnh) để xử lý trước.
            // Tránh tình trạng EasyUI tự động điền đè lên thẻ chữ trong lúc đang chạy hiệu ứng gõ.
            var comboItems = [];
            var textItems = [];
            for (var i = 0; i < fillQueue.length; i++) {
                if (fillQueue[i].type === 'combo') {
                    comboItems.push(fillQueue[i]);
                } else {
                    textItems.push(fillQueue[i]);
                }
            }

            // Chạy các trường Combo trước (ngầm, không có hiệu ứng)
            if (window.VNPT_TypingEffect) {
                for (i = 0; i < comboItems.length; i++) {
                    window.VNPT_TypingEffect.setComboGrid(comboItems[i].id, comboItems[i].val);
                }

                // Đợi 400ms để hệ thống HIS load và đồng bộ xong các trường tự động (nếu có)
                if (comboItems.length > 0) {
                    await new Promise(function(res) { setTimeout(res, 400); });
                }

                // Chạy hiệu ứng gõ tuần tự cho các trường text
                await window.VNPT_TypingEffect.fillFormSequential(textItems, useTyping);
            } else {
                console.error('[VNPT-Helper] VNPT_TypingEffect library is missing!');
            }

            // Hoàn thành
            sendResponse(true, 'Fill history sequential completed');
        } catch (e) {
            sendResponse(false, e.message);
        }
    };

    window.addEventListener('message', window._vnptHistoryHandler);

    function sendResponse(success, msg) {
        if (window.top) {
            window.top.postMessage({
                type: 'HISTORY_FILL_RESULT',
                success: success,
                error: msg
            }, PARENT_ORIGIN);
        }
    }

    // Utility to log all form fields (for user to help mapping)
    window.VNPT_LogFormFields = function () {
        var inputs = document.querySelectorAll('input, textarea, select');
        var fields = Array.from(inputs).map(function (el) {
            return {
                id: el.id,
                name: el.name,
                placeholder: el.placeholder,
                value: el.value,
                label: el.closest('.x-form-item')?.querySelector('label')?.textContent || ''
            };
        });
        console.table(fields);
        return fields;
    };

    // =========================================================================
    // SMART VALIDATION ENGINE: Lý do vào viện (Bảo vệ trước KHTH kiểm hồ sơ)
    // =========================================================================
    function initLydoVaoVienValidation() {
        var intervalId = setInterval(function () {
            // Định vị ô nhập lý do vào viện phổ biến trên form bệnh án của VNPT HIS
            var lydoEl = document.querySelector('input[id*="LYDOVAOVIEN"], textarea[id*="LYDOVAOVIEN"], [name*="LYDOVAOVIEN"]');
            if (!lydoEl) return;

            // Dừng Interval quét tìm vì đã bắt được phần tử DOM
            clearInterval(intervalId);

            function validate() {
                var val = (lydoEl.value || '').trim();
                // Luật: Không được trống, không được chỉ chứa dấu chấm (., ..., ......), gạch ngang, hoặc ký tự vô nghĩa
                var isInvalid = !val || val.length === 0 || /^[.-\s_?]+$/.test(val) || !!val.match(/^\.+\s*$/);

                var warnEl = document.getElementById('aladinn-lydo-warn');

                if (isInvalid) {
                    // Cảnh báo trực quan viền đỏ cam vuông vắn theo phong cách VNPT HIS
                    lydoEl.style.setProperty('border', '1.5px solid #d32f2f', 'important');
                    lydoEl.style.setProperty('background-color', '#ffebee', 'important');

                    if (!warnEl) {
                        warnEl = document.createElement('div');
                        warnEl.id = 'aladinn-lydo-warn';
                        warnEl.style.cssText = 'color:#d32f2f; font-size:12.6px; font-weight:700; margin-top:5px; display:flex; align-items:center; gap:4px; font-family:inherit;';
                        warnEl.innerHTML = '⚠️ Lý do vào viện đang trống hoặc có ký tự vô nghĩa (dấu chấm, dấu gạch...). Phòng KHTH sẽ từ chối duyệt hồ sơ bệnh án!';
                        lydoEl.parentNode.appendChild(warnEl);
                    }
                } else {
                    // Khôi phục viền và nền mặc định
                    lydoEl.style.removeProperty('border');
                    lydoEl.style.removeProperty('background-color');
                    if (warnEl) warnEl.remove();
                }
            }

            // Chạy kiểm duyệt lập tức ngay khi load form để bắt lỗi dấu chấm sẵn có
            validate();

            // Đăng ký các sự kiện thời gian thực để tự động ẩn/hiện cảnh báo khi bác sĩ chỉnh sửa
            lydoEl.addEventListener('input', validate);
            lydoEl.addEventListener('change', validate);
            lydoEl.addEventListener('blur', validate);

            // Cơ chế Self-Healing: Cứ sau 1.5 giây chạy kiểm duyệt lại một lần để tránh HIS tự vẽ lại DOM làm mất cảnh báo
            setInterval(validate, 1500);

        }, 1000);
    }

    // Tự động khởi chạy khi helper được tải vào iframe
    try {
        if (document.readyState === 'complete' || document.readyState === 'interactive') {
            initLydoVaoVienValidation();
        } else {
            window.addEventListener('DOMContentLoaded', initLydoVaoVienValidation);
        }
    } catch (_err) {}

})();
