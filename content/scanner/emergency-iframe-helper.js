/**
 * VNPT HIS Smart Scanner v4.0.1
 * Emergency Iframe Helper
 * 
 * Được inject động vào iframe của form 39/BV2 - Phiếu nhận định phân loại người bệnh tại khoa cấp cứu
 * Lắng nghe postMessage từ content script bên ngoài.
 * Chỉ xử lý 1 lệnh: EMERGENCY_FILL_FORM
 */

(function () {
    if (window._vnptEmergencyHandler) {
        window.removeEventListener('message', window._vnptEmergencyHandler);
    }

    window._vnptEmergencyHandler = function (event) {
        if (!event.data || event.data.type !== 'EMERGENCY_FILL_FORM') return;

        const d = event.data;
        const $ = window.jQuery || window.$;

        console.log('[Emergency Iframe] Nhận tín hiệu điền form:', d);

        let success = true;

        try {
            function safeSet(id, value) {
                if (!value) return;
                const input = document.getElementById(id);
                if (input) {
                    input.value = value;
                    if ($) {
                        $(input).trigger('change');
                        $(input).trigger('input');
                    } else {
                        input.dispatchEvent(new Event('input', { bubbles: true }));
                        input.dispatchEvent(new Event('change', { bubbles: true }));
                    }
                    console.log(`[Emergency Iframe] Đã điền ${id} = ${value}`);
                }
            }

            function findInputByLabel(doc, labelText) {
                const inputs = Array.from(doc.querySelectorAll('input[type="text"][id^="textfield_"]'));
                for (const input of inputs) {
                    const td = input.closest('td');
                    if (!td) continue;
                    
                    const prevTd = td.previousElementSibling;
                    if (prevTd && prevTd.textContent.includes(labelText)) {
                        return input.id;
                    }
                    
                    if (td.textContent.includes(labelText)) {
                        return input.id;
                    }
                }
                return null;
            }

            const idPulse = findInputByLabel(document, 'Mạch:') || 'textfield_671';
            const idTemp = findInputByLabel(document, 'Nhiệt độ:') || 'textfield_673';
            const idBp = findInputByLabel(document, 'Huyết áp:') || 'textfield_674';
            const idBmi = findInputByLabel(document, 'BMI:') || 'textfield_677';

            if (d.pulse) safeSet(idPulse, d.pulse);
            if (d.temperature) safeSet(idTemp, d.temperature);
            if (d.bloodPressure) safeSet(idBp, d.bloodPressure);
            if (d.bmi) safeSet(idBmi, d.bmi);

        } catch (e) {
            console.error('[Emergency Iframe] Lỗi khi điền form:', e);
            success = false;
        }

        if (event.source) {
            event.source.postMessage({
                type: 'EMERGENCY_FILL_RESULT',
                success: success
            }, event.origin);
        }
    };

    window.addEventListener('message', window._vnptEmergencyHandler);
    console.log('[Aladinn/Emergency] Iframe helper injected and listening.');

    // Báo lại top frame biết là đã sẵn sàng nếu cần
    if (window.parent !== window) {
        window.parent.postMessage({ type: 'EMERGENCY_HELPER_READY' }, '*');
    }
})();
