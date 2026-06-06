import '../debug-init.js';
import { initKeystrokeHook } from './key-hook.js';
/**
 * 🧞 Aladinn CDS — Iframe Helper
 * Chạy BÊN TRONG iframe "Tạo phiếu thuốc từ kho" (CapThuoc / PhieuThuoc).
 * Thu thập thuốc từ DOM local rồi gửi postMessage lên top frame.
 *
 * Pattern: Tương tự history-iframe-helper.js, nutrition-iframe-helper.js
 */
(function () {
    'use strict';

    var url = window.location.href || '';
    
    // Tránh chạy trùng
    if (window._aladinnCdsIframeHelper) return;
    window._aladinnCdsIframeHelper = true;

    console.log('[Aladinn CDS IframeHelper] 📦 Loaded inside:', url.substring(url.lastIndexOf('/') + 1));


    var DRUG_UNITS = ['viên', 'chai', 'lọ', 'ống', 'gói', 'cái', 'tuýp', 'hộp', 'túi', 'vỉ', 'tube', 'ml', 'amp', 'tab', 'cap', 'bơm'];
    var DRUG_ROUTES = ['uống', 'tiêm', 'bôi', 'nhỏ', 'đặt', 'ngậm', 'hít', 'xịt', 'truyền'];
    var NOT_DRUGS = [
        'nước cất', 'nuoc cat', 'nước muối', 'natri clorid', 'nacl 0',
        'glucose 5%', 'dextrose 5%', 'cồn 70', 'cồn 90',
        'oxy y tế', 'oxy lỏng', 'kim tiêm', 'kim luồn', 'bơm tiêm',
        'dây truyền', 'bộ dây', 'catheter', 'băng keo', 'gạc', 'bông',
        'găng tay', 'dung dịch rửa', 'povidone', 'betadine'
    ];
    var NOISE_WORDS = ['page', 'trang', 'total', 'tổng', 'chọn', 'đóng', 'lưu', 'hủy', 'xóa', 'sửa', 'in ', 'print'];
    var ICD_PATTERN = /[A-Z]\d{2,3}(?:\.\d{1,2})?/;

    var lastSentHash = '';

    function extractDrugs() {
        var meds = [];
        var rows = document.querySelectorAll('tr');

        for (var r = 0; r < rows.length; r++) {
            var row = rows[r];
            if (row.querySelector('th')) continue;

            var cells = row.querySelectorAll('td');
            if (cells.length < 3) continue;

            var cols = [];
            for (var c = 0; c < cells.length; c++) {
                cols.push((cells[c].innerText || cells[c].textContent || '').trim());
            }

            // Kiểm tra Đơn vị tính hoặc Đường dùng
            var hasDrugUnit = false;
            var hasDrugRoute = false;

            for (var u = 0; u < DRUG_UNITS.length; u++) {
                for (var ci = 0; ci < cols.length; ci++) {
                    if (cols[ci].length > 0 && cols[ci].length < 15 && cols[ci].toLowerCase().indexOf(DRUG_UNITS[u]) !== -1) {
                        hasDrugUnit = true;
                        break;
                    }
                }
                if (hasDrugUnit) break;
            }

            if (!hasDrugUnit) {
                for (var dr = 0; dr < DRUG_ROUTES.length; dr++) {
                    for (var ci2 = 0; ci2 < cols.length; ci2++) {
                        if (cols[ci2].length > 0 && cols[ci2].length < 20 && cols[ci2].toLowerCase().indexOf(DRUG_ROUTES[dr]) !== -1) {
                            hasDrugRoute = true;
                            break;
                        }
                    }
                    if (hasDrugRoute) break;
                }
            }

            if (!hasDrugUnit && !hasDrugRoute) continue;

            // Kiểm tra noise
            var rowText = cols.join(' ').toLowerCase();
            var isNoise = false;
            for (var n = 0; n < NOISE_WORDS.length; n++) {
                if (rowText.indexOf(NOISE_WORDS[n]) !== -1) { isNoise = true; break; }
            }
            if (isNoise) continue;

            // SMART COLUMN SCANNER: Tìm cột text đầu tiên (tên thuốc) và cột text thứ hai (hoạt chất)
            var textCols = [];
            for (var i = 0; i < cols.length; i++) {
                var val = cols[i];
                if (!val || val === '-' || val.length < 2) continue;
                if (/^\d[\d.,]*$/.test(val)) continue;
                if (/^\d{2}\/\d{2}\/\d{4}/.test(val)) continue;
                if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(val)) continue;
                var valLower = val.toLowerCase();

                // Bỏ qua đơn vị, đường dùng, loại thanh toán
                var isSkip = false;
                var skipWords = ['uống', 'tiêm', 'bôi', 'nhỏ', 'đặt', 'ngậm', 'hít', 'xịt', 'truyền',
                    'thu phí', 'viện phí', 'bhyt', 'kho nội trú', 'kho ngoại trú', 'nam', 'nữ', 'không có'];
                for (var sw = 0; sw < skipWords.length; sw++) {
                    if (valLower === skipWords[sw] || valLower.indexOf(skipWords[sw]) === 0) { isSkip = true; break; }
                }
                if (isSkip) continue;

                for (var du = 0; du < DRUG_UNITS.length; du++) {
                    if (valLower === DRUG_UNITS[du]) { isSkip = true; break; }
                }
                if (isSkip) continue;

                if (ICD_PATTERN.test(val)) continue;

                // Bỏ qua mã nội bộ (viết liền IN HOA, không dấu cách)
                if (val.indexOf(' ') === -1 && /^[A-Z0-9_-]+$/.test(val)) continue;

                textCols.push(val);
            }

            var name = textCols.length >= 1 ? textCols[0].replace(/[\s\u00a0\u200b]+/g, ' ').trim() : '';
            var generic = textCols.length >= 2 ? textCols[1].replace(/[\s\u00a0\u200b]+/g, ' ').trim() : '';

            // Loại bỏ nếu tên chứa mã ICD
            if (name && ICD_PATTERN.test(name)) name = '';
            
            // Detect patient names: All UPPERCASE (>= 2 words) OR Title Case
            // Nhưng KHÔNG loại tên thuốc Latin (không dấu) hoặc chứa keyword y khoa
            if (name && name.length > 6 && !/\d/.test(name)) {
                var words = name.trim().split(/\s+/);
                if (words.length >= 2 && words.length <= 6) {
                    var isAllUpper = name === name.toUpperCase();
                    var isTitleCase = true;
                    for (var w = 0; w < words.length; w++) {
                        var word = words[w];
                        if (word.length === 0 || word.charAt(0) !== word.charAt(0).toUpperCase() || word.slice(1) !== word.slice(1).toLowerCase()) {
                            isTitleCase = false;
                            break;
                        }
                    }
                    if (isAllUpper || isTitleCase) {
                        var hasVnDiacritics = /[àáảãạăắằẳẵặâấầẩẫậđèéẻẽẹêếềểễệìíỉĩịòóỏõọôốồổỗộơớờởỡợùúủũụưứừửữựỳýỷỹỵ]/i.test(name);
                        var hasMedKeyword = /injection|solution|cream|tablet|capsule|sodium|chloride|acid|hydro|amine|oxacin|mycin|azole|prazole|statin|sartan|dipine|olol|cillin|mab|nib|parin|phylline|cortis|predniso|metro|pharm/i.test(name);
                        if (hasMedKeyword) {
                            // Giữ lại — đây là thuốc
                        } else if (hasVnDiacritics) {
                            name = ''; // Có dấu VN + Title Case → tên người
                        }
                    }
                }
            }

            // Loại vật tư y tế
            if (name) {
                var nameLower = name.toLowerCase();
                for (var nd = 0; nd < NOT_DRUGS.length; nd++) {
                    if (nameLower.indexOf(NOT_DRUGS[nd]) !== -1) { name = ''; break; }
                }
            }

            // Clean up tên có ngoặc
            if (name && name.indexOf('(') !== -1 && name.indexOf(')') !== -1) {
                var match = name.match(/\((.*?)\)/);
                if (match && !generic) generic = match[1].trim();
                name = name.split('(')[0].trim();
            }

            if (name && name.length > 1 && name !== '-') {
                meds.push({
                    display_name: name,
                    generic_candidate: (generic && generic !== '-') ? generic : null
                });
            }
        }

        // Unique by name
        var uniqueMeds = [];
        var seen = {};
        for (var m = 0; m < meds.length; m++) {
            var key = meds[m].display_name.toLowerCase();
            if (!seen[key]) {
                seen[key] = true;
                uniqueMeds.push(meds[m]);
            }
        }

        return uniqueMeds;
    }

    function extractDiagnoses() {
        var diagnoses = [];
        var seenCodes = {};
        var icdPattern = /\b[A-Z]\d{2,3}(?:\.\d{1,2})?\b/gi;

        // Quét ô input ICD bên trong iframe này
        var selectors = 'input, textarea, label, span, td';
        var elements = document.querySelectorAll(selectors);
        
        for (var i = 0; i < elements.length; i++) {
            var el = elements[i];
            var id = (el.id || '').toLowerCase();
            var name = (el.name || '').toLowerCase();
            
            // Chỉ quét các ô liên quan đến ICD/chẩn đoán
            var isIcdField = id.indexOf('icd') !== -1 || id.indexOf('mabenh') !== -1 || 
                             id.indexOf('chuandoan') !== -1 || id.indexOf('benhkemtheo') !== -1 ||
                             name.indexOf('icd') !== -1 || name.indexOf('mabenh') !== -1 ||
                             name.indexOf('chuandoan') !== -1 || name.indexOf('benhkemtheo') !== -1;
            
            // Cũng quét các label/td có chứa text gần ô ICD10 (*)
            var text = el.value || el.innerText || el.textContent || '';
            if (!isIcdField && text.length > 100) continue; // Bỏ qua text dài (grid data)
            
            var matches = text.match(icdPattern);
            if (matches) {
                for (var m = 0; m < matches.length; m++) {
                    var code = matches[m].toUpperCase();
                    if (!seenCodes[code]) {
                        seenCodes[code] = true;
                        diagnoses.push({ code: code, is_primary: diagnoses.length === 0 });
                    }
                }
            }
        }
        
        return diagnoses;
    }

    function sendDataToParent() {
        var drugs = extractDrugs();
        var diagnoses = extractDiagnoses();
        var hash = drugs.map(function (d) { return d.display_name; }).sort().join('|') 
                 + '||' + diagnoses.map(function (d) { return d.code; }).sort().join('|');

        // Chỉ gửi khi có thay đổi
        if (hash === lastSentHash) return;
        lastSentHash = hash;

        console.log('[Aladinn CDS IframeHelper] 💊 Sending', drugs.length, 'drugs,', diagnoses.length, 'ICD codes to parent.');

        if (window.top && window.top !== window) {
            // Cross-origin iframe→parent: HIS uses multiple subdomains. Receiver validates event.origin.
            window.top.postMessage({ // nosemgrep: javascript.browser.security.wildcard-postmessage-configuration
                type: 'CDS_IFRAME_DATA',
                medications: drugs,
                diagnoses: diagnoses,
                source: 'cds-iframe-helper'
            }, '*');
        }
    }

    function isElementVisible(el) {
        var rect = el.getBoundingClientRect();
        return rect.width > 0 && rect.height > 0 && rect.left > -5000;
    }

    function checkContextActive() {
        var lowerUrl = url.toLowerCase();
        
        // 1. Phân hệ nhập liệu / phiếu thuốc -> realtime
        if (lowerUrl.indexOf('capthuoc') !== -1 || lowerUrl.indexOf('phieuthuoc') !== -1 || lowerUrl.indexOf('02d010') !== -1) {
            return { enabled: true, mode: 'realtime' };
        }
        
        // 2. Phân hệ phòng khám / buồng điều trị -> cần kiểm tra tab thuốc/điều trị đang hoạt động
        if (lowerUrl.indexOf('buongdieutri') !== -1 || lowerUrl.indexOf('02d021') !== -1) {
            // Kiểm tra grid hiển thị
            var drugGrids = document.querySelectorAll('table[id*="Thuoc"], table[id*="thuoc"], [id*="grdChiTiet"], [id*="grd_DSThuoc"], #grdPhieuThuoc, #gridChiTietPhieu, #grdChiTietPhieuThuoc, [id*="PhieuThuoc"], #tcThuocgrdThuoc');
            for (var g = 0; g < drugGrids.length; g++) {
                if (isElementVisible(drugGrids[g])) {
                    return { enabled: true, mode: 'oneshot' };
                }
            }
            
            // Kiểm tra tab hoạt động
            var activeTabs = document.querySelectorAll('.ui-tabs-active .ui-tabs-anchor, .ui-tabs-active a, li.active a, .ui-state-active a, [aria-selected="true"]');
            for (var t = 0; t < activeTabs.length; t++) {
                var text = (activeTabs[t].innerText || '').toLowerCase();
                if (text.indexOf('thuốc') !== -1 || text.indexOf('điều trị') !== -1) {
                    return { enabled: true, mode: 'oneshot' };
                }
            }

            // Smart Fallback: Kiểm tra xem có bảng thuốc nào đang hiển thị hay không (dựa trên cột tiêu đề)
            var tables = document.querySelectorAll('table');
            for (var tb = 0; tb < tables.length; tb++) {
                var table = tables[tb];
                if (isElementVisible(table)) {
                    var headers = table.querySelectorAll('th, td.ui-th-column, .ui-jqgrid-labels th');
                    for (var hd = 0; hd < headers.length; hd++) {
                        var headerText = (headers[hd].innerText || headers[hd].textContent || '').toLowerCase();
                        if (headerText.indexOf('tên thuốc') !== -1 || headerText.indexOf('tên biệt dược') !== -1 || headerText.indexOf('hoạt chất') !== -1 || headerText.indexOf('mã thuốc') !== -1 || headerText.indexOf('chi tiết phiếu thuốc') !== -1 || headerText.indexOf('danh sách phiếu thuốc') !== -1) {
                            return { enabled: true, mode: 'oneshot' };
                        }
                    }
                }
            }
        }
        
        return { enabled: false, mode: '' };
    }

    var lastSentContextStatus = null;

    function sendContextStatusToParent() {
        var status = checkContextActive();
        var statusStr = status.enabled + '||' + status.mode;
        if (statusStr === lastSentContextStatus) return;
        lastSentContextStatus = statusStr;

        console.log('[Aladinn CDS IframeHelper] 🧭 Context status changed:', status);

        if (window.top && window.top !== window) {
            // Cross-origin iframe→parent: HIS uses multiple subdomains. Receiver validates event.origin.
            window.top.postMessage({ // nosemgrep: javascript.browser.security.wildcard-postmessage-configuration
                type: 'CDS_IFRAME_CONTEXT_STATUS',
                enabled: status.enabled,
                mode: status.mode,
                source: 'cds-iframe-helper'
            }, '*');
        }
    }

    // Gửi ngay 1 lần khi load xong (với các khoảng trễ tăng dần để đợi DOM hoàn tất kết xuất)
    setTimeout(sendDataToParent, 1000);
    setTimeout(sendContextStatusToParent, 500);
    setTimeout(sendContextStatusToParent, 1500);
    setTimeout(sendContextStatusToParent, 3000);

    // Khởi tạo Proactive Keystroke Hook
    initKeystrokeHook(function (typedText) {
        if (window.top && window.top !== window) {
            // Cross-origin iframe→parent: HIS uses multiple subdomains. Receiver validates event.origin.
            window.top.postMessage({ // nosemgrep: javascript.browser.security.wildcard-postmessage-configuration
                type: 'CDS_KEYSTROKE_INPUT',
                typedText: typedText,
                source: 'cds-iframe-helper'
            }, '*');
        }
    });

    // Theo dõi thay đổi DOM (thêm/xóa thuốc, thay đổi ICD, đổi tab)
    var observer = new MutationObserver(function () {
        // Debounce 500ms
        clearTimeout(observer._timer);
        observer._timer = setTimeout(function () {
            sendDataToParent();
            sendContextStatusToParent();
        }, 500);
    });

    // Observe toàn bộ body
    observer.observe(document.body, { childList: true, subtree: true, characterData: true });

    // Lắng nghe yêu cầu quét thủ công từ parent
    window.addEventListener('message', function (event) {
        if (event.source !== window.top) return;
        // Loosen target origin checks to support cross-origin subdomains in VNPT HIS
        if (event.data) {
            if (event.data.type === 'CDS_REQUEST_DRUGS' || event.data.type === 'CDS_REQUEST_DATA') {
                lastSentHash = ''; // Reset để force gửi lại
                lastSentContextStatus = null; // Reset để force gửi lại trạng thái ngữ cảnh
                sendDataToParent();
                sendContextStatusToParent();
            } else if (event.data.type === 'CDS_PING') {
                sendContextStatusToParent();
            }
        }
    });

    // Báo cáo ngừng hoạt động khi iframe bị gỡ khỏi DOM hoặc chuyển hướng
    window.addEventListener('beforeunload', function () {
        if (window.top && window.top !== window) {
            // Cross-origin iframe→parent: beforeunload cleanup. Receiver validates event.origin.
            window.top.postMessage({ // nosemgrep: javascript.browser.security.wildcard-postmessage-configuration
                type: 'CDS_IFRAME_CONTEXT_STATUS',
                enabled: false,
                mode: '',
                source: 'cds-iframe-helper'
            }, '*');
        }
    });

})();
