window.Aladinn = window.Aladinn || {};
window.Aladinn.Scanner = window.Aladinn.Scanner || {};

window.Aladinn.Scanner.QuickTimeEdit = (function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;
    
    // UI state
    let lastMachineEndTime = null;

    /**
     * Khởi tạo chức năng sửa giờ nhanh
     */
    function init() {
        // Dùng setInterval để đảm bảo nút luôn xuất hiện kể cả khi lưới render lại
        setInterval(injectButton, 1500);
    }

    /**
     * Tìm nút "Sửa TG trả KQ" mặc định của HIS và chèn nút của ta vào cạnh đó
     */
    function injectButton() {
        // HIS thường load màn hình chức năng trong iframe. Cần quét cả top frame và các iframe.
        let targetDocs = [document];
        const iframes = document.querySelectorAll('iframe');
        iframes.forEach(ifr => {
            try {
                if (ifr.contentWindow && ifr.contentWindow.document) {
                    targetDocs.push(ifr.contentWindow.document);
                }
            } catch (e) {} // Bỏ qua lỗi cross-origin
        });

        let nativeBtn = null;
        let activeDoc = document;

        for (const doc of targetDocs) {
            const buttons = Array.from(doc.querySelectorAll('button, a, .btn'));
            const found = buttons.find(el => {
                if (el.offsetWidth === 0 && el.offsetHeight === 0) return false;
                const text = (el.textContent || '').replace(/\s+/g, ' ').trim();
                return text.includes('Sửa TG trả KQ') || text.includes('Sửa thời gian trả kết quả');
            });
            if (found) {
                nativeBtn = found;
                activeDoc = doc;
                break;
            }
        }

        if (!nativeBtn) {
            return;
        }
        
        const parent = nativeBtn.parentNode;
        if (!parent) return;

        // Nếu nút gốc đã có nút của mình bên cạnh rồi thì bỏ qua
        if (parent.querySelector('#aladinn-quick-time-btn')) return;

        if (Logger) Logger.info('Scanner.QuickTime', 'Tìm thấy nút Sửa TG trả KQ trong DOM, tiến hành chèn nút Auto Giờ BHYT');

        // Xóa nút cũ ở thanh công cụ khác (nếu màn hình có nhiều lưới/tab)
        const oldBtn = activeDoc.getElementById('aladinn-quick-time-btn');
        if (oldBtn) oldBtn.remove();

        // Tạo nút Sửa giờ BHYT
        const quickBtn = activeDoc.createElement('button');
        quickBtn.id = 'aladinn-quick-time-btn';
        quickBtn.type = 'button';
        quickBtn.innerHTML = '<span style="margin-right: 4px;">⚡</span> Auto Giờ BHYT';
        quickBtn.title = 'Tự động tính và điền 4 mốc thời gian (KHÔNG tự lưu)';
        
        quickBtn.style.cssText = `
            background: linear-gradient(135deg, rgba(212,162,90,0.2), rgba(212,162,90,0.1));
            border: 1px solid rgba(212,162,90,0.5);
            color: #d4a25a;
            border-radius: 4px;
            padding: 4px 10px;
            margin-left: 8px;
            cursor: pointer;
            font-weight: bold;
            display: inline-flex;
            align-items: center;
            transition: all 0.2s ease;
        `;
        
        quickBtn.onmouseover = () => quickBtn.style.background = 'rgba(212,162,90,0.3)';
        quickBtn.onmouseout = () => quickBtn.style.background = 'linear-gradient(135deg, rgba(212,162,90,0.2), rgba(212,162,90,0.1))';

        quickBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            openPromptAndBind(nativeBtn, activeDoc);
        });

        if (nativeBtn.nextSibling) {
            parent.insertBefore(quickBtn, nativeBtn.nextSibling);
        } else {
            parent.appendChild(quickBtn);
        }
    }

    /**
     * Parse date string DD/MM/YYYY HH:mm:ss -> Date object
     */
    function parseDateStr(str) {
        if (!str) return null;
        // HIS format: 25/04/2026 19:40:00
        const parts = str.split(/[/\s:]/);
        if (parts.length >= 5) {
            // new Date(year, monthIndex, day, hours, minutes, seconds)
            return new Date(parts[2], parseInt(parts[1])-1, parts[0], parts[3], parts[4], parts[5] || 0);
        }
        return null;
    }

    /**
     * Format Date object -> DD/MM/YYYY HH:mm
     */
    function formatDateStr(d) {
        if (!d) return '';
        const dd = String(d.getDate()).padStart(2, '0');
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const yyyy = d.getFullYear();
        const HH = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dd}/${mm}/${yyyy} ${HH}:${min}`;
    }

    /**
     * Lấy TG chỉ định từ lưới (Dòng đang chọn)
     */
    function getOrderTimeFromGrid(doc) {
        const selectedRow = doc.querySelector('tr.jqgrow[aria-selected="true"]');
        if (!selectedRow) return null;

        // Thử tìm theo aria-describedby phổ biến
        let cell = selectedRow.querySelector('td[aria-describedby$="_TG_CHIDINH"], td[aria-describedby$="_TGCHIDINH"], td[aria-describedby$="_THOIGIANCHIDINH"]');
        if (cell && cell.textContent.trim()) return cell.textContent.trim();

        // Cứu cánh: dò tìm chỉ mục cột "TG chỉ định" từ tiêu đề bảng
        const headers = Array.from(doc.querySelectorAll('.ui-jqgrid-htable th'));
        const tgIndex = headers.findIndex(th => {
            const text = (th.textContent || '').trim();
            return text.includes('TG chỉ định') || text.includes('Thời gian chỉ định');
        });
        
        if (tgIndex >= 0) {
            const tds = selectedRow.querySelectorAll('td');
            if (tds[tgIndex]) return tds[tgIndex].textContent.trim();
        }

        return null;
    }

    /**
     * Quét toàn bộ lưới để tìm mốc "TG trả KQ" (Giờ kết thúc) gần nhất của các ca đã làm
     */
    function getLatestReturnedTimeFromGrid(doc) {
        const headers = Array.from(doc.querySelectorAll('.ui-jqgrid-htable th'));
        const tgIndex = headers.findIndex(th => {
            const text = (th.textContent || '').trim();
            return text.includes('TG trả KQ') || text.includes('Thời gian trả kết quả');
        });

        if (tgIndex < 0) return null;

        const rows = Array.from(doc.querySelectorAll('tr.jqgrow'));
        let latestTime = null;

        for (const row of rows) {
            const tds = row.querySelectorAll('td');
            if (tds[tgIndex]) {
                const timeStr = tds[tgIndex].textContent.trim();
                if (timeStr && timeStr.length > 10) {
                    const d = parseDateStr(timeStr);
                    if (d && (!latestTime || d > latestTime)) {
                        latestTime = d;
                    }
                }
            }
        }
        return latestTime;
    }

    /**
     * Format Date object -> YYYY-MM-DDThh:mm (cho input datetime-local)
     */
    function dateToDatetimeLocal(d) {
        if (!d) return '';
        const yyyy = d.getFullYear();
        const mm = String(d.getMonth() + 1).padStart(2, '0');
        const dd = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
    }

    /**
     * Mở modal HIS trước, sau đó hiển thị bảng điều khiển Aladinn bên cạnh để realtime update
     */
    function openPromptAndBind(nativeBtn, activeDoc) {
        const oldModal = activeDoc.getElementById('aladinn-time-prompt');
        if (oldModal) oldModal.remove();

        // 1. Mở modal HIS
        nativeBtn.click();

        // 2. Chờ iFrame của HIS load xong, rồi hiển thị bảng Aladinn
        waitForIframeReady(activeDoc, 0, (iframeDoc) => {
            if (!iframeDoc) {
                if (Logger) Logger.error('Scanner.QuickTime', 'Không tìm thấy iFrame hộp thoại Sửa ngày trả kết quả');
                if (window.VNPTRealtime) window.VNPTRealtime.showToast('Lỗi: Không tải được form HIS', 'error');
                return;
            }

            // 3. Hiển thị bảng điều khiển Realtime (không truyền ref cũ, syncToHIS sẽ tự tìm live)
            showRealtimePrompt(activeDoc);
        });
    }

    /**
     * Tìm iFrame đang mở của bảng "Sửa ngày trả kết quả" và trả về { doc, inputs }
     * Chiến thuật: Nhắm thẳng vào iframe ID đã biết, không lùng sục qua dialog
     * @param {Document} activeDoc - Document chứa nút bấm và jBox dialog
     */
    function findLiveIframeInputs(activeDoc) {
        // Danh sách tất cả documents cần quét
        let targetDocs = [];
        if (activeDoc) targetDocs.push(activeDoc);
        if (!targetDocs.includes(document)) targetDocs.push(document);
        try {
            if (window.top && window.top.document && !targetDocs.includes(window.top.document)) {
                targetDocs.push(window.top.document);
            }
        } catch(_e) {}

        // Cũng quét tất cả iFrame cấp 1 của mỗi doc
        const extraDocs = [];
        targetDocs.forEach(doc => {
            try {
                const iframes = doc.querySelectorAll('iframe');
                iframes.forEach(ifr => {
                    try {
                        if (ifr.contentWindow && ifr.contentWindow.document) {
                            const subDoc = ifr.contentWindow.document;
                            if (!targetDocs.includes(subDoc) && !extraDocs.includes(subDoc)) {
                                extraDocs.push(subDoc);
                            }
                        }
                    } catch (_e) {}
                });
            } catch(_e) {}
        });
        targetDocs = targetDocs.concat(extraDocs);

        // Chiến thuật 1: Tìm iframe bằng ID cụ thể của HIS
        for (const doc of targetDocs) {
            if (!doc) continue;
            try {
                const iframe = doc.getElementById('dlgSuaThoiGianTraKQifmView');
                if (iframe && iframe.contentWindow) {
                    const iDoc = iframe.contentWindow.document;
                    if (iDoc && iDoc.readyState === 'complete') {
                        const liveInputs = Array.from(iDoc.querySelectorAll('input')).filter(
                            el => el.type !== 'hidden' && el.type !== 'button' && (el.offsetWidth > 0 || el.offsetHeight > 0)
                        );
                        if (liveInputs.length >= 4) {
                            return { doc: iDoc, inputs: liveInputs };
                        }
                    }
                }
            } catch(_e) {}
        }

        // Chiến thuật 2 (fallback): Tìm input bằng ID cụ thể trong bất kỳ doc nào
        for (const doc of targetDocs) {
            if (!doc) continue;
            try {
                const firstInput = doc.getElementById('txtThoiGianTiepNhan');
                if (firstInput) {
                    const liveInputs = Array.from(doc.querySelectorAll('input')).filter(
                        el => el.type !== 'hidden' && el.type !== 'button' && (el.offsetWidth > 0 || el.offsetHeight > 0)
                    );
                    if (liveInputs.length >= 4) {
                        return { doc, inputs: liveInputs };
                    }
                }
            } catch(_e) {}
        }

        return null;
    }

    /**
     * Hiển thị UI thiết lập thông số tính toán (Realtime)
     */
    function showRealtimePrompt(activeDoc) {
        const oldOverlay = activeDoc.getElementById('aladinn-time-prompt');
        if (oldOverlay) oldOverlay.remove();

        const orderTimeStr = getOrderTimeFromGrid(activeDoc);
        let orderDate = parseDateStr(orderTimeStr);
        if (!orderDate) orderDate = new Date();

        const latestGridTime = getLatestReturnedTimeFromGrid(activeDoc);
        if (latestGridTime) {
            if (!lastMachineEndTime || latestGridTime > lastMachineEndTime) {
                lastMachineEndTime = latestGridTime;
            }
        }

        let initialReceiptTime = new Date(orderDate.getTime());
        initialReceiptTime.setMinutes(initialReceiptTime.getMinutes() + 1);
        if (lastMachineEndTime) {
            let prevEndNext = new Date(lastMachineEndTime.getTime());
            prevEndNext.setMinutes(prevEndNext.getMinutes() + 1);
            if (prevEndNext > initialReceiptTime) initialReceiptTime = prevEndNext;
        }

        const pad = (n) => String(n).padStart(2, '0');
        const fmtDate = (d) => `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;

        let prevEndDate = lastMachineEndTime ? new Date(lastMachineEndTime) : null;
        let receiptDate = new Date(initialReceiptTime);
        let stepMins = 1;

        // Inject styles
        if (!activeDoc.getElementById('aqt-styles')) {
            const style = activeDoc.createElement('style');
            style.id = 'aqt-styles';
            style.textContent = `
                @keyframes aqtSlideIn{from{opacity:0;transform:translateY(-12px)}to{opacity:1;transform:translateY(0)}}
                .aqt-panel{background:linear-gradient(135deg,#1a1510 0%,#231c14 100%);border:1px solid rgba(212,162,90,0.3);border-radius:16px;padding:16px;width:260px;box-shadow:0 20px 40px rgba(0,0,0,0.5),0 0 20px rgba(212,162,90,0.1);font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#e8dcc8;pointer-events:auto;animation:aqtSlideIn .25s ease}
                .aqt-sec{background:rgba(0,0,0,0.25);border:1px solid rgba(212,162,90,0.1);border-radius:10px;padding:8px 10px;margin-bottom:8px}
                .aqt-lbl{font-size:10px;color:#a0937e;text-transform:uppercase;letter-spacing:.5px;margin-bottom:5px}
                .aqt-time-row{display:flex;align-items:center;justify-content:center;gap:2px}
                .aqt-spin{display:flex;flex-direction:column;align-items:center;gap:2px}
                .aqt-btn{width:26px;height:20px;border:none;border-radius:4px;cursor:pointer;font-size:9px;display:flex;align-items:center;justify-content:center;background:rgba(212,162,90,0.12);color:#d4a25a;transition:all .12s}
                .aqt-btn:hover{background:rgba(212,162,90,0.3);transform:scale(1.1)}
                .aqt-btn:active{background:rgba(212,162,90,0.45);transform:scale(.92)}
                .aqt-val{font-size:20px;font-weight:700;color:#e8dcc8;font-family:'Segoe UI',monospace;min-width:44px;text-align:center;letter-spacing:1px;line-height:1;cursor:default}
                .aqt-val-input{width:44px;font-size:20px;font-weight:700;color:#d4a25a;font-family:'Segoe UI',monospace;text-align:center;letter-spacing:1px;background:rgba(212,162,90,0.15);border:1px solid #d4a25a;border-radius:4px;outline:none;padding:2px 0;line-height:1}
                .aqt-colon{font-size:20px;font-weight:700;color:#d4a25a;line-height:1;margin:0 1px}
                .aqt-date{font-size:10px;color:#7a6e5e;text-align:center;margin-top:3px;display:flex;align-items:center;justify-content:center;gap:6px}
                .aqt-day-btn{background:none;border:none;color:#7a6e5e;cursor:pointer;font-size:10px;padding:0 2px;transition:color .15s;opacity:.6}
                .aqt-day-btn:hover{color:#d4a25a;opacity:1}
                .aqt-preview{background:rgba(0,0,0,0.3);border:1px solid rgba(212,162,90,0.08);border-radius:8px;padding:6px 10px;font-size:10px;color:#7a6e5e}
                .aqt-preview-row{display:flex;justify-content:space-between;padding:2px 0}
                .aqt-preview-val{color:#e8dcc8;font-weight:600;font-family:monospace}
                .aqt-step-btn{width:30px;height:26px;border:none;border-radius:6px;cursor:pointer;font-size:16px;font-weight:700;display:flex;align-items:center;justify-content:center;background:rgba(212,162,90,0.15);color:#d4a25a;transition:all .12s}
                .aqt-step-btn:hover{background:rgba(212,162,90,0.35);transform:scale(1.1)}
                .aqt-step-btn:active{transform:scale(.9)}
            `;
            activeDoc.head.appendChild(style);
        }

        const overlay = activeDoc.createElement('div');
        overlay.id = 'aladinn-time-prompt';
        overlay.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;z-index:999999;display:flex;align-items:flex-start;justify-content:flex-start;padding:50px 0 0 14px;pointer-events:none;';

        const buildSpinner = (id, date, label) => {
            const h = date ? pad(date.getHours()) : '--';
            const m = date ? pad(date.getMinutes()) : '--';
            const ds = date ? fmtDate(date) : '';
            return `<div class="aqt-sec">
                <div class="aqt-lbl">${label}</div>
                <div class="aqt-time-row">
                    <div class="aqt-spin">
                        <button class="aqt-btn" data-t="${id}" data-f="h" data-d="1">▲</button>
                        <span class="aqt-val" id="${id}-h">${h}</span>
                        <button class="aqt-btn" data-t="${id}" data-f="h" data-d="-1">▼</button>
                    </div>
                    <span class="aqt-colon">:</span>
                    <div class="aqt-spin">
                        <button class="aqt-btn" data-t="${id}" data-f="m" data-d="1">▲</button>
                        <span class="aqt-val" id="${id}-m">${m}</span>
                        <button class="aqt-btn" data-t="${id}" data-f="m" data-d="-1">▼</button>
                    </div>
                </div>
                <div class="aqt-date" id="${id}-d"><button class="aqt-day-btn" data-t="${id}" data-dd="-1">◄</button><span id="${id}-dt">${ds}</span><button class="aqt-day-btn" data-t="${id}" data-dd="1">►</button></div>
            </div>`;
        };

        const modal = activeDoc.createElement('div');
        modal.className = 'aqt-panel';
        modal.innerHTML = `
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
                <div style="display:flex;align-items:center;gap:6px">
                    <span style="font-size:18px">🧞</span>
                    <span style="font-size:14px;font-weight:700;color:#d4a25a">Auto Giờ BHYT</span>
                </div>
                <button id="aqt-x" style="background:none;border:none;color:#7a6e5e;cursor:pointer;font-size:16px;padding:0 2px;transition:color .2s" title="Đóng">✕</button>
            </div>
            <div class="aqt-sec" style="padding:6px 10px">
                <div class="aqt-lbl">Y lệnh</div>
                <div style="font-size:12px;color:#d4a25a;font-weight:600">${orderTimeStr || 'N/A'}</div>
            </div>
            ${buildSpinner('aqt-prev', prevEndDate, '⏱ Kết thúc ca trước')}
            ${buildSpinner('aqt-rcpt', receiptDate, '📋 Tiếp nhận (bắt đầu)')}
            <div class="aqt-sec" style="padding:6px 10px">
                <div class="aqt-lbl">Bước nhảy (phút)</div>
                <div style="display:flex;align-items:center;gap:10px;justify-content:center">
                    <button class="aqt-step-btn" id="aqt-sd">−</button>
                    <span id="aqt-sv" style="font-size:22px;font-weight:700;color:#d4a25a;min-width:30px;text-align:center">${stepMins}</span>
                    <button class="aqt-step-btn" id="aqt-su">+</button>
                </div>
                <div style="font-size:9px;color:#7a6e5e;text-align:center;margin-top:3px">Đường huyết 1' · Siêu âm 5'</div>
            </div>
            <div id="aqt-st" style="font-size:11px;text-align:center;min-height:14px;margin-bottom:6px;color:#6ee7a0;transition:color .2s"></div>
            <div class="aqt-preview">
                <div class="aqt-preview-row"><span>Tiếp nhận</span><span class="aqt-preview-val" id="aqt-p0">--</span></div>
                <div class="aqt-preview-row"><span>Bắt đầu TH</span><span class="aqt-preview-val" id="aqt-p1">--</span></div>
                <div class="aqt-preview-row"><span>Thực hiện</span><span class="aqt-preview-val" id="aqt-p2">--</span></div>
                <div class="aqt-preview-row"><span>Lưu KQ</span><span class="aqt-preview-val" id="aqt-p3">--</span></div>
            </div>
        `;

        overlay.appendChild(modal);
        activeDoc.body.appendChild(overlay);

        const statusEl = overlay.querySelector('#aqt-st');
        const updSpinner = (id, d) => {
            const hE = overlay.querySelector(`#${id}-h`);
            const mE = overlay.querySelector(`#${id}-m`);
            const dtE = overlay.querySelector(`#${id}-dt`);
            if (d) { if(hE) hE.textContent=pad(d.getHours()); if(mE) mE.textContent=pad(d.getMinutes()); if(dtE) dtE.textContent=fmtDate(d); }
            else { if(hE) hE.textContent='--'; if(mE) mE.textContent='--'; if(dtE) dtE.textContent=''; }
        };
        const updPreview = () => {
            const ts = [receiptDate, new Date(receiptDate.getTime()+stepMins*60000), new Date(receiptDate.getTime()+stepMins*120000), new Date(receiptDate.getTime()+stepMins*180000)];
            ts.forEach((t,i) => { const el=overlay.querySelector(`#aqt-p${i}`); if(el) el.textContent=formatDateStr(t); });
        };
        const syncToHIS = () => {
            if (!receiptDate) return;
            const live = findLiveIframeInputs(activeDoc);
            if (!live) { statusEl.textContent='⚠ Chưa mở form HIS'; statusEl.style.color='#f87171'; return; }
            const ts = [receiptDate, new Date(receiptDate.getTime()+stepMins*60000), new Date(receiptDate.getTime()+stepMins*120000), new Date(receiptDate.getTime()+stepMins*180000)];
            lastMachineEndTime = new Date(ts[3]);
            const vals = ts.map(t => formatDateStr(t));
            for (let i=0; i<Math.min(live.inputs.length,4); i++) {
                const inp = live.inputs[i]; inp.focus(); inp.value = vals[i];
                try { const w=live.doc.defaultView; if(w&&w.jQuery) w.jQuery(inp).trigger('input').trigger('keyup').trigger('change').trigger('blur'); } catch(_e){}
                inp.dispatchEvent(new Event('input',{bubbles:true})); inp.dispatchEvent(new Event('change',{bubbles:true})); inp.blur();
            }
            statusEl.textContent='✓ Đã đồng bộ'; statusEl.style.color='#6ee7a0'; updPreview();
        };
        const recalc = () => {
            let base = new Date(orderDate.getTime()); base.setMinutes(base.getMinutes()+stepMins);
            if (prevEndDate) { let pe=new Date(prevEndDate.getTime()); pe.setMinutes(pe.getMinutes()+stepMins); if(pe>base) base=pe; }
            receiptDate = base; updSpinner('aqt-rcpt', receiptDate); syncToHIS();
        };

        // Spinner click events
        overlay.addEventListener('click', (e) => {
            // Time spinner buttons
            const btn = e.target.closest('.aqt-btn');
            if (btn) {
                const t=btn.dataset.t, f=btn.dataset.f, d=parseInt(btn.dataset.d);
                if (t==='aqt-prev') {
                    if (!prevEndDate) prevEndDate = new Date(orderDate);
                    if (f==='h') prevEndDate.setHours(prevEndDate.getHours()+d); else prevEndDate.setMinutes(prevEndDate.getMinutes()+d);
                    updSpinner('aqt-prev', prevEndDate); recalc();
                } else if (t==='aqt-rcpt') {
                    if (f==='h') receiptDate.setHours(receiptDate.getHours()+d); else receiptDate.setMinutes(receiptDate.getMinutes()+d);
                    updSpinner('aqt-rcpt', receiptDate); syncToHIS();
                }
                return;
            }
            // Day navigation buttons
            const dayBtn = e.target.closest('.aqt-day-btn');
            if (dayBtn) {
                const t=dayBtn.dataset.t, dd=parseInt(dayBtn.dataset.dd);
                if (t==='aqt-prev') {
                    if (!prevEndDate) prevEndDate = new Date(orderDate);
                    prevEndDate.setDate(prevEndDate.getDate()+dd);
                    updSpinner('aqt-prev', prevEndDate); recalc();
                } else if (t==='aqt-rcpt') {
                    receiptDate.setDate(receiptDate.getDate()+dd);
                    updSpinner('aqt-rcpt', receiptDate); syncToHIS();
                }
            }
        });
        overlay.querySelector('#aqt-su').onclick = () => { stepMins=Math.min(60,stepMins+1); overlay.querySelector('#aqt-sv').textContent=stepMins; recalc(); };
        overlay.querySelector('#aqt-sd').onclick = () => { stepMins=Math.max(1,stepMins-1); overlay.querySelector('#aqt-sv').textContent=stepMins; recalc(); };
        overlay.querySelector('#aqt-x').onclick = () => overlay.remove();

        // Double-click on time values to edit directly
        overlay.addEventListener('dblclick', (e) => {
            const valEl = e.target.closest('.aqt-val');
            if (!valEl || valEl.querySelector('input')) return;

            const currentVal = valEl.textContent.trim();
            const inp = activeDoc.createElement('input');
            inp.type = 'number'; inp.className = 'aqt-val-input';
            inp.value = currentVal === '--' ? '' : parseInt(currentVal);
            inp.min = 0; inp.max = 59;
            // Check if this is an hour field
            if (valEl.id && valEl.id.endsWith('-h')) inp.max = 23;

            valEl.textContent = '';
            valEl.appendChild(inp);
            inp.focus(); inp.select();

            const commit = () => {
                let num = parseInt(inp.value);
                if (isNaN(num)) { updSpinner('aqt-prev', prevEndDate); updSpinner('aqt-rcpt', receiptDate); return; }
                num = Math.max(0, Math.min(parseInt(inp.max), num));

                const id = valEl.id; // e.g. 'aqt-prev-h' or 'aqt-rcpt-m'
                const parts = id.split('-'); // ['aqt','prev','h']
                const target = parts[0] + '-' + parts[1]; // 'aqt-prev'
                const field = parts[2]; // 'h' or 'm'

                if (target === 'aqt-prev') {
                    if (!prevEndDate) prevEndDate = new Date(orderDate);
                    if (field === 'h') prevEndDate.setHours(num); else prevEndDate.setMinutes(num);
                    updSpinner('aqt-prev', prevEndDate); recalc();
                } else if (target === 'aqt-rcpt') {
                    if (field === 'h') receiptDate.setHours(num); else receiptDate.setMinutes(num);
                    updSpinner('aqt-rcpt', receiptDate); syncToHIS();
                }
            };
            inp.addEventListener('blur', commit, { once: true });
            inp.addEventListener('keydown', (ev) => {
                if (ev.key === 'Enter') inp.blur();
                if (ev.key === 'Escape') { updSpinner('aqt-prev', prevEndDate); updSpinner('aqt-rcpt', receiptDate); }
            });
        });

        updPreview();
        setTimeout(syncToHIS, 300);
    }

    function waitForIframeReady(activeDoc, attempts, callback) {
        if (attempts > 30) { // 6 seconds
            callback(null);
            return;
        }

        let targetDocs = [document];
        try {
            if (window.top && window.top.document) targetDocs.push(window.top.document);
        } catch(e) {}
        if (activeDoc && !targetDocs.includes(activeDoc)) targetDocs.push(activeDoc);
        
        try {
            const iframes = document.querySelectorAll('iframe');
            iframes.forEach(ifr => {
                try {
                    if (ifr.contentWindow && ifr.contentWindow.document) {
                        targetDocs.push(ifr.contentWindow.document);
                    }
                } catch (e) {}
            });
        } catch(e) {}

        // Tìm dialog "Sửa ngày trả kết quả"
        let targetDialog = null;
        for (const doc of targetDocs) {
            if (!doc) continue;
            try {
                const dialogs = Array.from(doc.querySelectorAll('.ui-dialog, .jBox-wrapper, .jBox-container'));
                targetDialog = dialogs.find(d => {
                    if (d.style.display === 'none') return false;
                    const text = d.textContent || '';
                    return text.includes('Sửa ngày trả kết quả') || text.includes('Sửa thời gian trả kết quả');
                });
                if (targetDialog) break;
            } catch(e) {}
        }

        if (targetDialog) {
            // Tìm iFrame bên trong dialog này
            try {
                const iframe = targetDialog.querySelector('iframe');
                if (iframe) {
                    try {
                        const doc = iframe.contentWindow.document;
                        // Kiểm tra xem trang trong iFrame đã load tới các input chưa
                        const visibleInputs = Array.from(doc.querySelectorAll('input')).filter(i => i.type !== 'hidden' && i.type !== 'button');
                        if (doc && doc.readyState === 'complete' && visibleInputs.length >= 4) {
                            callback(doc);
                            return;
                        }
                    } catch (e) {
                        // Cross-origin error or not loaded yet
                    }
                } else {
                    // Nếu không có iFrame (fallback cho dạng html thường)
                    const visibleInputs = Array.from(targetDialog.querySelectorAll('input')).filter(i => i.type !== 'hidden' && i.type !== 'button');
                    if (visibleInputs.length >= 4) {
                        callback(targetDialog);
                        return;
                    }
                }
            } catch(e) {}
        }
        
        setTimeout(() => waitForIframeReady(activeDoc, attempts + 1, callback), 200);
    }

    return {
        init,
        injectButton
    };
})();
