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
            var currId = ids[i];
            
            // ĐẶC TRỊ VNPT HIS (ExtJS): Luôn ưu tiên tìm thẻ input hiển thị thật sự (-inputEl) 
            var extJsVisible = document.getElementById(currId + '-inputEl');
            if (extJsVisible && !els.includes(extJsVisible)) els.push(extJsVisible);

            var byId = document.getElementById(currId);
            if (byId && byId.tagName !== 'DIV' && !els.includes(byId)) els.push(byId);
            
            var byName = document.querySelectorAll('[name="' + currId + '"]');
            for(var n = 0; n < byName.length; n++) {
                if (!els.includes(byName[n]) && byName[n].type !== 'hidden') els.push(byName[n]);
            }
            if (els.length > 0) return els;
        }

        if (els.length === 0 && LABEL_HINTS[ids[0]]) {
            var hints = LABEL_HINTS[ids[0]];
            var allTextareas = document.querySelectorAll('textarea');
            for (var t = 0; t < allTextareas.length; t++) {
                var ta = allTextareas[t];
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
                var el = els[i];
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
                        for (var s = 0; s < siblings.length; s++) {
                            if (siblings[s].offsetWidth > 0) {
                                visibleEl = siblings[s];
                                break;
                            }
                        }
                    }
                }
            }

            for (var m = 0; m < els.length; m++) {
                if (els[m] && els[m].removeAttribute) {
                    els[m].removeAttribute('disabled');
                    els[m].removeAttribute('readonly');
                }
            }
            if (visibleEl && visibleEl.removeAttribute) {
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
                        for (var k = 0; k < els.length; k++) els[k].value = val;
                        setTimeout(finish, 50);
                    }
                }
                requestAnimationFrame(typeChar);
            } else {
                visibleEl.value = val;
                for (var j = 0; j < els.length; j++) els[j].value = val;
                setTimeout(finish, 50);
            }
        });
    }

    async function fillFormSequential(fillQueue, useTyping) {
        var queueWithPos = [];
        for (var i = 0; i < fillQueue.length; i++) {
            var item = fillQueue[i];
            var els = [];
            if (item.el && item.el instanceof HTMLElement) {
                els = [item.el];
            } else if (item.id) {
                els = getFieldElements(item.id);
            }
            if (els.length > 0) {
                var visibleEl = els[0];
                if (visibleEl.type === 'hidden' || visibleEl.style.display === 'none' || visibleEl.offsetWidth === 0) {
                    if (window.$) {
                        var easyUiInput = window.$(visibleEl).next('.textbox').find('.textbox-text');
                        if (easyUiInput.length > 0) visibleEl = easyUiInput[0];
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
            var itemObj = queueWithPos[i];
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
