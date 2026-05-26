(function () {
    'use strict';

    if (window.VNPT_TypingEffect) return;

    // Label keywords to search when field ID not found
    var LABEL_HINTS = {
        'txtTTNBRAVIEN': ['Tình trạng', 'ra viện'],
        'txtBENHLYDBLS': ['Quá trình bệnh lý', 'diễn biến lâm sàng'],
        'txtKQXNCLS': ['kết quả xét nghiệm', 'cận lâm sàng', 'giá trị chẩn đoán'],
        'txtPPDIEUTRI': ['Phương pháp điều trị'],
        'txtHDTVACDT': ['Hướng điều trị', 'chế độ tiếp theo']
    };

    function getFieldElements(fieldIdStr) {
        if (!fieldIdStr) return [];
        var ids = fieldIdStr.split('|');
        var els = [];

        for (var i = 0; i < ids.length; i++) {
            var currId = ids.slice(i, i + 1).pop();
            
            // ĐẶC TRỊ VNPT HIS (ExtJS): Luôn ưu tiên tìm thẻ input hiển thị thật sự (-inputEl) 
            var extJsVisible = document.getElementById(currId + '-inputEl');
            if (extJsVisible && !els.includes(extJsVisible)) els.push(extJsVisible);

            var byId = document.getElementById(currId);
            if (byId && byId.tagName !== 'DIV' && !els.includes(byId)) els.push(byId);
            
            var byName = document.querySelectorAll('[name="' + currId + '"]');
            for(var n = 0; n < byName.length; n++) {
                var currentByName = byName.item(n);
                if (currentByName && !els.includes(currentByName) && currentByName.type !== 'hidden') els.push(currentByName);
            }
            if (els.length > 0) return els;
        }

        var firstId = ids.slice(0, 1).pop();
        var hints = undefined;
        if (firstId === 'txtTTNBRAVIEN') hints = LABEL_HINTS.txtTTNBRAVIEN;
        else if (firstId === 'txtBENHLYDBLS') hints = LABEL_HINTS.txtBENHLYDBLS;
        else if (firstId === 'txtKQXNCLS') hints = LABEL_HINTS.txtKQXNCLS;
        else if (firstId === 'txtPPDIEUTRI') hints = LABEL_HINTS.txtPPDIEUTRI;
        else if (firstId === 'txtHDTVACDT') hints = LABEL_HINTS.txtHDTVACDT;

        if (els.length === 0 && hints) {
            var allTextareas = document.querySelectorAll('textarea');
            for (var t = 0; t < allTextareas.length; t++) {
                var ta = allTextareas.item(t);
                var container = ta.closest('tr') || ta.closest('div') || ta.parentElement;
                if (!container) continue;
                var containerText = container.textContent || '';
                var prevSibling = container.previousElementSibling;
                var prevText = prevSibling ? (prevSibling.textContent || '') : '';
                var searchText = containerText + ' ' + prevText;

                var matched = hints.every(function (hint) { return searchText.includes(hint); });
                if (matched) {
                    els.push(ta);
                    return els;
                }
            }
        }
        return els;
    }

    function triggerHisEvents(els) {
        if (!els || els.length === 0) return;
        var el = els[0];
        if (window.$) {
            window.$(el).trigger('input').trigger('change');
        } else {
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    function setComboGrid(id, code) {
        if (!code) return;
        try {
            var els = getFieldElements(id);
            for(var i = 0; i < els.length; i++) {
                var el = els.slice(i, i + 1).pop();
                var jEl = window.$ ? window.$(el) : null;
                if (jEl && jEl.data('combogrid')) {
                    jEl.combogrid('setValue', code);
                    jEl.val(code);
                } else {
                    el.value = code;
                }
            }
        } catch(_e) {}
    }

    function setValAnimated(fieldIdStr, val, useTyping) {
        return new Promise(function(resolve) {
            if (val === undefined || val === null || val === '') return resolve({ els: [] });
            var els = [];
            var currentEl;
            if (fieldIdStr instanceof HTMLElement) {
                els = [fieldIdStr];
            } else {
                els = getFieldElements(fieldIdStr);
            }
            if (els.length === 0) return resolve({ els: [] });

            var el = els[0];
            var visibleEl = el;

            if (el.type === 'hidden' || el.style.display === 'none' || el.offsetWidth === 0) {
                if (window.$) {
                    var easyUiInput = window.$(el).next('.textbox').find('.textbox-text');
                    if (easyUiInput.length > 0) {
                        visibleEl = easyUiInput[0];
                    } else {
                        var siblings = window.$(el).siblings('input[type="text"], textarea');
                        for (var sibIdx = 0; sibIdx < siblings.length; sibIdx++) {
                            var sib = siblings.get(sibIdx);
                            if (sib && sib.offsetWidth > 0) {
                                visibleEl = sib;
                                break;
                            }
                        }
                    }
                }
            }

            var originalStates = [];
            var ALLOWLIST = ['txtTTNBRAVIEN', 'txtBENHLYDBLS', 'txtKQXNCLS', 'txtPPDIEUTRI', 'txtHDTVACDT'];
            function isAllowed(element) {
                if (!element) return false;
                if (element.id && ALLOWLIST.includes(element.id)) return true;
                if (element.name && ALLOWLIST.includes(element.name)) return true;
                // Also allow if it's the inputEl corresponding to the ExtJS id
                if (element.id && element.id.endsWith('-inputEl')) {
                    var baseId = element.id.replace('-inputEl', '');
                    if (ALLOWLIST.includes(baseId)) return true;
                }
                return false;
            }

            for (var m = 0; m < els.length; m++) {
                currentEl = els.slice(m, m + 1).pop();
                if (currentEl && currentEl.removeAttribute && isAllowed(currentEl)) {
                    originalStates.push({ el: currentEl, disabled: currentEl.hasAttribute('disabled'), readonly: currentEl.hasAttribute('readonly') });
                    currentEl.removeAttribute('disabled');
                    currentEl.removeAttribute('readonly');
                }
            }
            if (visibleEl && visibleEl.removeAttribute && isAllowed(visibleEl)) {
                var found = false;
                for (var stIdx = 0; stIdx < originalStates.length; stIdx++) {
                    if (originalStates[stIdx].el === visibleEl) found = true;
                }
                if (!found) {
                    originalStates.push({ el: visibleEl, disabled: visibleEl.hasAttribute('disabled'), readonly: visibleEl.hasAttribute('readonly') });
                }
                visibleEl.removeAttribute('disabled');
                visibleEl.removeAttribute('readonly');
            }

            var originalBg = visibleEl.style.backgroundColor || '';
            var originalTransition = visibleEl.style.transition || '';
            visibleEl.style.transition = 'background-color 0.3s ease';
            visibleEl.style.backgroundColor = '#e8f0fe';

            var finish = function() {
                visibleEl.style.backgroundColor = originalBg;
                setTimeout(function() { visibleEl.style.transition = originalTransition; }, 300);
                
                for (var stIdx2 = 0; stIdx2 < originalStates.length; stIdx2++) {
                    var st = originalStates[stIdx2];
                    if (st.disabled) st.el.setAttribute('disabled', 'disabled');
                    if (st.readonly) st.el.setAttribute('readonly', 'readonly');
                }

                resolve({ els: els, val: val, visibleEl: visibleEl });
            };

            if (useTyping && typeof val === 'string' && val.length > 0) {
                visibleEl.value = '';
                var i = 0;
                
                var charsPerFrame = Math.max(3, Math.floor(val.length / 15)); 
                if (charsPerFrame > 15) charsPerFrame = 15; 
                
                function typeChar() {
                    if (i < val.length) {
                        var chunk = val.substr(i, charsPerFrame);
                        visibleEl.value += chunk;
                        i += charsPerFrame;
                        
                        if (visibleEl.tagName === 'TEXTAREA') visibleEl.scrollTop = visibleEl.scrollHeight;
                        
                        requestAnimationFrame(typeChar);
                    } else {
                        visibleEl.value = val;
                        for (var k = 0; k < els.length; k++) {
                            currentEl = els.slice(k, k + 1).pop();
                            if (currentEl) currentEl.value = val;
                        }
                        setTimeout(finish, 50);
                    }
                }
                requestAnimationFrame(typeChar);
            } else {
                visibleEl.value = val;
                for (var j = 0; j < els.length; j++) {
                    currentEl = els.slice(j, j + 1).pop();
                    if (currentEl) currentEl.value = val;
                }
                setTimeout(finish, 50);
            }
        });
    }

    async function fillFormSequential(fillQueue, useTyping) {
        var queueWithPos = [];
        for (var i = 0; i < fillQueue.length; i++) {
            var item = fillQueue.slice(i, i + 1).pop();
            var els = [];
            if (item.el && item.el instanceof HTMLElement) {
                els = [item.el];
            } else if (item.id) {
                els = getFieldElements(item.id);
            }
            if (els.length > 0) {
                var visibleEl = els.slice(0, 1).pop();
                if (visibleEl.type === 'hidden' || visibleEl.style.display === 'none' || visibleEl.offsetWidth === 0) {
                    if (window.$) {
                        var easyUiInput = window.$(visibleEl).next('.textbox').find('.textbox-text');
                        if (easyUiInput.length > 0) visibleEl = easyUiInput.slice(0, 1).pop();
                    }
                }
                var top = 0;
                if (visibleEl.getBoundingClientRect) {
                    top = visibleEl.getBoundingClientRect().top + window.scrollY;
                }
                queueWithPos.push({ item: item, top: top, el: visibleEl });
            }
        }

        queueWithPos.sort(function(a, b) { return a.top - b.top; });

        for (i = 0; i < queueWithPos.length; i++) {
            var itemObj = queueWithPos.slice(i, i + 1).pop();
            item = itemObj.item;

            // Đã xóa bỏ hoàn toàn thao tác cuộn (scrollIntoView) theo yêu cầu của người dùng

            // Gõ chữ và chờ hoàn thành 100% ô này
            var result = await setValAnimated(item.el || item.id, item.val, useTyping);
            
            // Gọi event lưu dữ liệu cho ô này
            if (result && result.els && result.els.length > 0) {
                triggerHisEvents(result.els);
            }
        }
        
        return true;
    }

    // Expose API
    window.VNPT_TypingEffect = {
        fillFormSequential: fillFormSequential,
        getFieldElements: getFieldElements,
        setValAnimated: setValAnimated,
        triggerHisEvents: triggerHisEvents,
        setComboGrid: setComboGrid
    };

})();
