/**
 * 🧞 Aladinn v2 — Phân hệ C: AmbientScrible (AI Lắng nghe & Viết Bệnh án SOAP)
 * Thiết kế phẳng 100% HIS-ify vuông vức, bảo mật PHI cục bộ, an toàn PatientContextGuard.
 */

window.Aladinn = window.Aladinn || {};
window.Aladinn.Voice = window.Aladinn.Voice || {};

(function () {
    'use strict';

    const Logger = window.Aladinn?.Logger;

    // Trạng thái Phân hệ
    let isRecording = false;
    let recognition = null;
    let finalTranscript = '';
    
    // Chốt chặn Context Bệnh nhân
    let startPatientId = null;
    let contextToken = null;

    // Biến lưu trữ kết quả SOAP từ AI
    window.currentResults = null;
    window.transcript = '';

    // ========================================
    // Form Field Selectors (HIS IDs) & Metadata
    // ========================================
    const FIELD_SELECTORS = {
        lyDoVaoVien: 'txtLYDOVAOVIEN',
        quaTrinhBenhLy: 'txtQUATRINHBENHLY',
        tienSuBanThan: 'txtTIENSUBENH_BANTHAN',
        tienSuGiaDinh: 'txtTIENSUBENH_GIADINH',
        khamToanThan: 'txtKHAMBENH_TOANTHAN',
        khamBoPhan: 'txtKHAMBENH_BOPHAN',
        chanDoanBanDau: 'txtCHANDOANBANDAU',
        huongXuLy: 'txtDAXULY',
        mach: 'txtKHAMBENH_MACH',
        nhietDo: 'txtKHAMBENH_NHIETDO',
        huyetApTamThu: 'txtKHAMBENH_HUYETAP_HIGH',
        huyetApTamTruong: 'txtKHAMBENH_HUYETAP_LOW',
        spO2: 'txtKHAMBENH_SPO2',
        nhipTho: 'txtKHAMBENH_NHIPTHO',
        canNang: 'txtKHAMBENH_CANNANG',
        chieuCao: 'txtKHAMBENH_CHIEUCAO'
    };

    const MEDICAL_FIELDS = [
        { key: 'lyDoVaoVien', label: 'Lý do vào viện' },
        { key: 'quaTrinhBenhLy', label: 'Bệnh sử' },
        { key: 'tienSuBanThan', label: 'Tiền sử bản thân' },
        { key: 'tienSuGiaDinh', label: 'Tiền sử gia đình' },
        { key: 'khamToanThan', label: 'Khám toàn thân' },
        { key: 'khamBoPhan', label: 'Khám bộ phận' },
        { key: 'chanDoanBanDau', label: 'Chẩn đoán sơ bộ' },
        { key: 'huongXuLy', label: 'Hướng xử lý' }
    ];

    const VITAL_SIGNS = [
        { key: 'mach', label: 'Mạch', unit: 'l/phút' },
        { key: 'nhietDo', label: 'Nhiệt độ', unit: '°C' },
        { key: 'huyetApTamThu', label: 'HA tâm thu', unit: 'mmHg' },
        { key: 'huyetApTamTruong', label: 'HA tâm trương', unit: 'mmHg' },
        { key: 'nhipTho', label: 'Nhịp thở', unit: 'l/phút' },
        { key: 'spO2', label: 'SpO2', unit: '%' },
        { key: 'canNang', label: 'Cân nặng', unit: 'kg' },
        { key: 'chieuCao', label: 'Chiều cao', unit: 'cm' }
    ];

    // ========================================
    // BỘ LỌC THÔNG TIN PHI CỤC BỘ (TẠI MÁY TRẠM)
    // ========================================
    function redactPHI(text) {
        if (!text) return '';
        let sanitized = text;
        
        // 1. Khử số điện thoại di động Việt Nam (10 số, đầu 03, 05, 07, 08, 09...)
        sanitized = sanitized.replace(/\b(0[35789]\d{8}|02\d{8,9})\b/g, '[SỐ ĐIỆN THOẠI]');
        sanitized = sanitized.replace(/\b(\+84|84)?[35789]\d{8}\b/g, '[SỐ ĐIỆN THOẠI]');
        
        // 2. Khử mã thẻ BHYT (Thường gồm 15 ký tự chữ và số, bắt đầu bằng 2 chữ in hoa)
        sanitized = sanitized.replace(/\b[A-Z]{2}\d{13}\b/gi, '[MÃ BHYT]');
        sanitized = sanitized.replace(/\b[A-Z]{2}\d{10}\b/gi, '[MÃ BHYT]');
        
        // 3. Khử số CMND/CCCD (9 hoặc 12 chữ số)
        sanitized = sanitized.replace(/\b(\d{9}|\d{12})\b/g, '[CMND/CCCD]');
        
        // 4. Khử tên riêng tiếng Việt nhạy cảm dựa trên từ khóa chỉ vai trò
        const nameKeywords = /(?:bệnh nhân|bn|bác sĩ|bs|bác sỹ|anh|chị|ông|bà|bé|cháu)\s+([A-ZÀ-Ỹ[a-zà-ỹ]+\s+){1,4}[A-ZÀ-Ỹ[a-zà-ỹ]+/g;
        sanitized = sanitized.replace(nameKeywords, (match) => {
            const roleMatch = match.match(/^(?:bệnh nhân|bn|bác sĩ|bs|bác sỹ|anh|chị|ông|bà|bé|cháu)/i);
            const role = roleMatch ? roleMatch[0] : 'Đối tượng';
            const isDoctor = /bác\s*sĩ|bs|bác\s*sỹ/i.test(role);
            return `${role} ${isDoctor ? '[BÁC SĨ]' : '[BỆNH NHÂN]'}`;
        });
        
        return sanitized;
    }

    // ========================================
    // HÀM TIỆN ÍCH LẤY DỮ LIỆU & ĐIỀN FORM HIS
    // ========================================
    function getActivePatientId() {
        // Cách 1: Lấy từ VNPT Store toàn cục
        const storePid = window.VNPTStore?.get ? window.VNPTStore.get('selectedPatientId') : window.VNPTStore?.getState?.()?.selectedPatientId;
        if (storePid && storePid !== 'anonymous_patient') return storePid;

        // Cách 2: Thử lấy từ CDS Extractor nếu có
        if (window.Aladinn?.CDS?.CDSExtractor?.getPatientId) {
            try {
                const cdsPid = window.Aladinn.CDS.CDSExtractor.getPatientId();
                if (cdsPid && cdsPid !== 'anonymous_patient') return cdsPid;
            } catch (_) {}
        }

        // Cách 3: Quét trực tiếp DOM các trường thông dụng trên HIS
        const elements = findElementInAllFrames('txtMaBenhNhan') || findElementInAllFrames('txtMaBA') || findElementInAllFrames('txtMaBenhAn');
        if (elements && elements.value) return elements.value.trim();

        return 'anonymous_patient';
    }

    function findElementInAllFrames(id, cache = null) {
        if (cache && cache.has(id)) return cache.get(id);
        const allFound = new Set();

        function searchRecursive(root) {
            if (!root) return;
            try {
                const elById = root.getElementById(id);
                if (elById) allFound.add(elById);

                const listByName = root.getElementsByName(id);
                if (listByName.length > 0) {
                    for (const el of listByName) allFound.add(el);
                }

                const iframes = root.querySelectorAll('iframe');
                for (const iframe of iframes) {
                    try {
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        if (doc) searchRecursive(doc);
                    } catch (_) {}
                }
            } catch (_) {}
        }

        searchRecursive(document);
        const candidates = Array.from(allFound);

        const visibleEl = candidates.find(el => {
            try {
                const rect = el.getBoundingClientRect();
                const style = window.getComputedStyle(el);
                return (
                    el.offsetParent !== null &&
                    rect.width > 0 &&
                    rect.height > 0 &&
                    style.display !== 'none' &&
                    style.visibility !== 'hidden' &&
                    style.opacity !== '0'
                );
            } catch (_) {
                return false;
            }
        });

        const result = visibleEl || candidates[0] || null;
        if (cache && result) cache.set(id, result);
        return result;
    }

    function fillFormField(selectorId, value, cache = null) {
        if (!value) return false;
        const el = findElementInAllFrames(selectorId, cache);
        if (!el) return false;

        try {
            el.click();
            el.focus();
            el.value = '';
            el.dispatchEvent(new Event('input', { bubbles: true }));

            const doc = el.ownerDocument;
            if (doc.queryCommandSupported && doc.queryCommandSupported('insertText')) {
                doc.execCommand('insertText', false, value);
            }

            if (!el.value || el.value === '') {
                el.value = value;
            }

            // Hiệu ứng nhấp nháy xanh lá cây phẳng nhẹ nhàng khi điền thành công
            el.style.transition = 'background-color 0.15s ease';
            el.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
            setTimeout(() => {
                el.style.backgroundColor = '';
            }, 1000);

            ['input', 'change', 'blur'].forEach(evtName => {
                el.dispatchEvent(new Event(evtName, { bubbles: true }));
            });

            return true;
        } catch (_) {
            el.value = value;
            return true;
        }
    }

    // ========================================
    // TÍCH HỢP WEB SPEECH API (NHẬN DIỆN LIÊN TỤC)
    // ========================================
    function initSpeechRecognition() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            console.error('[Aladinn Voice] Web Speech API không được hỗ trợ trên trình duyệt này.');
            return;
        }

        recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'vi-VN';

        recognition.onstart = () => {
            isRecording = true;
            updateRecordingUI(true);
            showToast('🎙️ Đang lắng nghe giọng nói...');
        };

        recognition.onerror = (event) => {
            console.error('[Aladinn Voice] Lỗi nhận diện giọng nói:', event.error);
            if (event.error === 'not-allowed') {
                showToast('⚠️ Hãy cho phép extension sử dụng Micro!', true);
                stopRecording();
            }
        };

        recognition.onend = () => {
            // Tự động khởi động lại nếu đang ghi âm mà bị ngắt quãng tự động
            if (isRecording) {
                try {
                    recognition.start();
                } catch (_) {}
            } else {
                updateRecordingUI(false);
            }
        };

        recognition.onresult = (event) => {
            let interimTranscript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript + ' ';
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            const transcriptTextarea = document.getElementById('his-transcript');
            if (transcriptTextarea) {
                transcriptTextarea.value = finalTranscript + interimTranscript;
                transcriptTextarea.scrollTop = transcriptTextarea.scrollHeight;
                window.transcript = transcriptTextarea.value;
            }
            updateProcessBtnState();
        };
    }

    function startRecording() {
        if (!recognition) initSpeechRecognition();
        if (!recognition) return;

        finalTranscript = '';
        const transcriptTextarea = document.getElementById('his-transcript');
        if (transcriptTextarea) transcriptTextarea.value = '';
        window.transcript = '';
        window.currentResults = null;

        // Lưu ID bệnh nhân lúc bắt đầu ghi âm
        startPatientId = getActivePatientId();
        
        // Khởi động chốt chặn PatientContextGuard nếu có sẵn
        if (window.VNPTPatientContextGuard?.captureGridOnly) {
            contextToken = window.VNPTPatientContextGuard.captureGridOnly(startPatientId);
        }

        // Lưu vào global để truyền sang module autofill
        window.Aladinn = window.Aladinn || {};
        window.Aladinn.Voice = window.Aladinn.Voice || {};
        window.Aladinn.Voice.startPatientId = startPatientId;
        window.Aladinn.Voice.contextToken = contextToken;

        // Ẩn bảng kết quả cũ và xóa thông báo lỗi
        document.getElementById('his-results-section')?.classList.add('aladinn-hidden');
        const errorContainer = document.getElementById('his-mismatch-error');
        if (errorContainer) {
            errorContainer.innerHTML = '';
            errorContainer.classList.add('aladinn-hidden');
        }

        try {
            recognition.start();
        } catch (_) {}
    }

    function stopRecording() {
        isRecording = false;
        if (recognition) {
            try {
                recognition.stop();
            } catch (_) {}
        }
        updateRecordingUI(false);
        showToast('⏹️ Đã dừng ghi âm.');
    }

    function toggleRecording() {
        if (isRecording) {
            stopRecording();
        } else {
            startRecording();
        }
    }

    // ========================================
    // PHÁT GỬI AI VÀ NHẬN BỆNH ÁN SOAP
    // ========================================
    async function processWithAI() {
        const text = window.transcript?.trim();
        if (!text) {
            showToast('⚠️ Vui lòng nói hoặc nhập nội dung trước!', true);
            return;
        }

        // Hiện trạng thái loading phẳng
        setLoading(true);
        showToast('🧠 AI đang phân tích dữ liệu lâm sàng...');

        // 🛡️ BẢO MẬT: Khử trùng PHI cục bộ ngay tại máy trạm
        const sanitizedText = redactPHI(text);
        if (Logger) Logger.info('Voice.Redaction', 'Dữ liệu thô đã khử PHI cục bộ trước khi truyền gửi.');

        // Gửi yêu cầu qua Background Service Worker
        chrome.runtime.sendMessage({
            type: 'AI_REQUEST',
            payload: {
                text: sanitizedText,
                model: 'gemini-2.0-flash',
                requestId: 'ambient-' + Date.now()
            }
        }, response => {
            setLoading(false);
            if (response && response.ok && response.data) {
                window.currentResults = response.data;
                displaySoapResults(response.data);
                showToast('✅ Đã tạo Bệnh án SOAP thành công!');
            } else {
                const errMsg = response?.error?.message || 'Không thể kết nối dịch vụ AI.';
                showToast('❌ Lỗi AI: ' + errMsg, true);
            }
        });
    }

    // ========================================
    // ĐIỀN BỆNH ÁN 1-CLICK & CHỐT CHẶN AN TOÀN
    // ========================================
    function fillSoapToHis() {
        if (!window.currentResults) {
            showToast('⚠️ Không có dữ liệu bệnh án để điền!', true);
            return;
        }

        const currentPatientId = getActivePatientId();

        // 🛡️ CHỐT CHẶN AN TOÀN PatientContextGuard
        let isContextValid = true;
        
        // 1. So khớp ID trực tiếp thời gian thực
        if (!startPatientId || startPatientId === 'anonymous_patient' || startPatientId !== currentPatientId) {
            isContextValid = false;
        }
        
        // 2. So khớp qua Token của PatientContextGuard hệ thống
        if (window.VNPTPatientContextGuard?.validate && contextToken) {
            if (!window.VNPTPatientContextGuard.validate(contextToken)) {
                isContextValid = false;
            }
        }

        // Chặn đứng lập tức nếu phát hiện chuyển đổi bệnh nhân (Nhiễm chéo thông tin)
        if (!isContextValid) {
            showPatientMismatchError();
            return;
        }

        // Thực hiện tự động điền form
        let filledCount = 0;
        const fieldCache = new Map();

        // Điền các trường văn bản
        MEDICAL_FIELDS.forEach(f => {
            const val = window.currentResults[f.key];
            const selector = FIELD_SELECTORS[f.key];
            if (val && selector) {
                if (fillFormField(selector, val, fieldCache)) {
                    filledCount++;
                }
            }
        });

        // Điền chỉ số sinh hiệu
        if (window.currentResults.sinhHieu) {
            VITAL_SIGNS.forEach(v => {
                const val = window.currentResults.sinhHieu[v.key];
                const selector = FIELD_SELECTORS[v.key];
                if (val && selector) {
                    if (fillFormField(selector, val, fieldCache)) {
                        filledCount++;
                    }
                }
            });
        }

        if (filledCount > 0) {
            showToast(`🚀 Đã điền thành công ${filledCount} trường vào HIS!`);
            // Ẩn lỗi nếu có từ trước
            const errorContainer = document.getElementById('his-mismatch-error');
            if (errorContainer) errorContainer.classList.add('aladinn-hidden');
        } else {
            showToast('⚠️ Không tìm thấy biểu mẫu khám bệnh phù hợp trên HIS!', true);
        }
    }

    function showPatientMismatchError() {
        const errorContainer = document.getElementById('his-mismatch-error');
        if (errorContainer) {
            errorContainer.innerHTML = `
                <div style="background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; padding: 10px; margin-bottom: 12px; font-size: 11px; font-weight: bold; line-height: 1.5; border-radius: 0px;">
                    ⚠️ CẢNH BÁO AN TOÀN LÂM SÀNG:<br>
                    Phát hiện sai lệch thông tin bệnh nhân! Bác sĩ đã chuyển sang bệnh nhân khác trên HIS trong khi chờ AI phản hồi.<br>
                    <span style="text-decoration: underline;">HÀNH ĐỘNG BỊ CHẶN ĐỨNG</span> để tránh nhiễm chéo dữ liệu lâm sàng nguy hiểm.
                </div>
            `;
            errorContainer.classList.remove('aladinn-hidden');
            errorContainer.scrollIntoView({ behavior: 'smooth' });
        }
        showToast('❌ Đã chặn tự động điền do lệch bệnh nhân!', true);
    }

    // ========================================
    // QUẢN LÝ GIAO DIỆN PHẲNG HIS-IFY 100%
    // ========================================
    function injectCustomStyles() {
        if (document.getElementById('ambient-scrible-styles')) return;

        const style = document.createElement('style');
        style.id = 'ambient-scrible-styles';
        style.textContent = `
            /* Micro-animations sóng âm phẳng cực nhanh 150ms */
            @keyframes flat-wave-pulse {
                0% { height: 4px; }
                50% { height: 20px; }
                100% { height: 4px; }
            }
            .his-flat-wave {
                display: flex;
                align-items: center;
                gap: 2px;
                height: 24px;
                padding: 0 4px;
            }
            .his-flat-wave-bar {
                width: 3px;
                height: 6px;
                background-color: #004f9e;
                animation: flat-wave-pulse 0.3s ease-in-out infinite;
            }
            .his-flat-wave-bar:nth-child(2) { animation-delay: 0.08s; }
            .his-flat-wave-bar:nth-child(3) { animation-delay: 0.16s; }
            .his-flat-wave-bar:nth-child(4) { animation-delay: 0.24s; }

            /* Nút mini phẳng 100% HIS-ify */
            #his-mini-btn {
                position: fixed;
                right: 30px;
                bottom: 80px;
                width: 48px;
                height: 48px;
                border-radius: 0px !important;
                background: #004f9e;
                border: 1px solid #a6c9e2;
                box-shadow: 2px 2px 0px rgba(0, 79, 158, 0.2);
                cursor: pointer;
                z-index: 999999;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.15s ease;
            }
            #his-mini-btn:hover {
                background: #003d7a;
                transform: translate(-1px, -1px);
                box-shadow: 3px 3px 0px rgba(0, 79, 158, 0.3);
            }
            #his-mini-btn img {
                width: 28px;
                height: 28px;
                object-fit: contain;
            }

            /* Overwrite floating panel sang phẳng vuông vức */
            #his-floating-panel {
                border-radius: 0px !important;
                box-shadow: 4px 4px 0px rgba(0, 79, 158, 0.15) !important;
                border: 1px solid #004f9e !important;
            }
            .his-panel-btn, .his-quick-btn, .his-textarea, .his-btn, .his-btn-ai, .his-result-item, .his-vital-pill {
                border-radius: 0px !important;
            }
            
            /* Responsive Grid cho kết quả */
            .ambient-soap-grid {
                display: flex;
                flex-direction: column;
                gap: 8px;
                margin-top: 10px;
            }
            .ambient-soap-item {
                border: 1px solid #a6c9e2;
                background: #ffffff;
            }
            .ambient-soap-header {
                background: #eef6ff;
                padding: 6px 10px;
                font-weight: bold;
                font-size: 11px;
                color: #004f9e;
                border-bottom: 1px solid #a6c9e2;
                text-transform: uppercase;
            }
            .ambient-soap-body {
                padding: 8px;
            }
            .ambient-soap-input {
                width: 100%;
                border: none;
                background: transparent;
                resize: vertical;
                font-size: 12px;
                line-height: 1.5;
                font-family: inherit;
                outline: none;
                padding: 0;
                margin: 0;
            }
        `;
        document.head.appendChild(style);
    }

    function createFloatingPanel() {
        if (document.getElementById('his-floating-panel')) return;

        // Mini button phẳng vuông vức
        const miniBtn = document.createElement('button');
        miniBtn.id = 'his-mini-btn';
        const logoUrl = chrome.runtime?.getURL ? chrome.runtime.getURL('assets/icons/icon128.png') : '';
        miniBtn.innerHTML = `<img src="${logoUrl}" alt="Aladinn">`;
        miniBtn.title = 'AmbientScrible - Lắng nghe lâm sàng';
        document.body.appendChild(miniBtn);

        // Floating panel chính phẳng vuông vức
        const panel = document.createElement('div');
        panel.id = 'his-floating-panel';
        panel.className = 'aladinn-hidden';
        panel.innerHTML = `
            <div class="his-panel-header" id="his-panel-header">
                <div class="his-panel-title">
                    <span style="font-size: 13px; font-weight: bold; color: #004f9e;">🎙️ AMBIENT SCRIBLE (SOAP)</span>
                </div>
                <div class="his-panel-controls">
                    <button class="his-panel-btn" id="his-reset-btn" title="Làm mới bệnh nhân">🔄</button>
                    <button class="his-panel-btn" id="his-minimize-btn" title="Thu nhỏ">✕</button>
                </div>
            </div>
            <div class="his-panel-body-wrapper">
                <div class="his-panel-body" id="his-panel-body">
                    
                    <!-- Chốt chặn an toàn cảnh báo lệch Patient ID -->
                    <div id="his-mismatch-error" class="aladinn-hidden"></div>

                    <!-- Thanh nút thao tác chính phẳng vuông vức -->
                    <div class="his-quick-actions" id="his-quick-actions" style="margin-bottom: 12px;">
                        <button class="his-quick-btn his-quick-primary his-autofill-btn" id="his-autofill" style="background-color: #004f9e !important; border-color: #004f9e !important; color: white !important; flex: 1;" title="Điền bệnh án SOAP tự động vào HIS">
                            ⚡ ĐIỀN BỆNH ÁN (1-CLICK)
                        </button>
                        <button class="his-quick-btn" id="his-copy-all" title="Sao chép toàn bộ" style="flex: 0 0 40px; background: #ffffff;">📋</button>
                        <button class="his-quick-btn" id="his-demo-btn" title="Dữ liệu mẫu thử nghiệm" style="flex: 0 0 40px; background: #ffffff;">🧪</button>
                    </div>

                    <!-- Khu vực hiển thị SOAP trích xuất -->
                    <div class="his-section aladinn-hidden" id="his-results-section" style="margin-top: 10px;">
                        <div class="his-section-title" style="font-size: 11px; color: #004f9e; font-weight: bold;">KẾT QUẢ TRÍCH XUẤT SOAP:</div>
                        <div class="ambient-soap-grid" id="his-results-container"></div>
                    </div>
                </div>
            </div>
            <div class="his-panel-footer">
                <div class="his-section" style="margin: 0; padding: 0; border: none;">
                    <textarea class="his-textarea" id="his-transcript" placeholder="Bấm biểu tượng Micro để ghi âm cuộc hội thoại lâm sàng, hoặc tự nhập văn bản tại đây..." rows="3" style="border: 1px solid #a6c9e2 !important; margin-bottom: 8px;"></textarea>
                    
                    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
                        <button class="his-btn" id="his-record-btn" title="Bắt đầu/Dừng ghi âm" style="flex: 0 0 40px; height: 36px; background: #ffffff; border: 1px solid #a6c9e2; display: flex; align-items: center; justify-content: center; padding: 0;">
                            <span id="his-record-icon" style="font-size: 18px;">🎙️</span>
                        </button>
                        
                        <!-- Hiển thị hoạt họa sóng âm phẳng nhạy bén 150ms khi đang ghi -->
                        <div id="his-wave-indicator" class="his-flat-wave aladinn-hidden" style="flex: 1; justify-content: center;">
                            <div class="his-flat-wave-bar"></div>
                            <div class="his-flat-wave-bar"></div>
                            <div class="his-flat-wave-bar"></div>
                            <div class="his-flat-wave-bar"></div>
                        </div>

                        <button class="his-btn his-btn-ai" id="his-process-btn" style="flex: 1; height: 36px; background-color: #004f9e; border: 1px solid #004f9e; color: white; font-weight: bold; font-size: 12px; display: flex; align-items: center; justify-content: center; gap: 6px;" disabled>
                            🧠 TẠO BỆNH ÁN SOAP (AI)
                        </button>
                    </div>
                    
                    <!-- Hiển thị loading khi gọi AI -->
                    <div class="his-loading aladinn-hidden" id="his-loading" style="display: flex; align-items: center; justify-content: center; gap: 8px; margin-top: 10px;">
                        <div style="width: 14px; height: 14px; border: 2px solid #004f9e; border-top-color: transparent; border-radius: 50%; animation: spin-slow 1s linear infinite;"></div>
                        <div style="color: #666666; font-size: 11px;">Gemini AI đang dựng bệnh án...</div>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(panel);

        // Kéo thả phẳng
        makeDraggable(panel, document.getElementById('his-panel-header'));

        // Cài đặt các sự kiện nút bấm
        setupEvents();
    }

    function setupEvents() {
        const miniBtn = document.getElementById('his-mini-btn');
        const panel = document.getElementById('his-floating-panel');
        
        miniBtn?.addEventListener('click', () => {
            panel.classList.remove('aladinn-hidden');
            miniBtn.classList.add('aladinn-hidden');
        });

        document.getElementById('his-minimize-btn')?.addEventListener('click', () => {
            panel.classList.add('aladinn-hidden');
            miniBtn.classList.remove('aladinn-hidden');
        });

        document.getElementById('his-reset-btn')?.addEventListener('click', resetForNewPatient);
        document.getElementById('his-record-btn')?.addEventListener('click', toggleRecording);
        document.getElementById('his-process-btn')?.addEventListener('click', processWithAI);
        document.getElementById('his-autofill')?.addEventListener('click', fillSoapToHis);
        document.getElementById('his-copy-all')?.addEventListener('click', copyAllResults);
        document.getElementById('his-demo-btn')?.addEventListener('click', loadDemoData);

        const transcriptEl = document.getElementById('his-transcript');
        transcriptEl?.addEventListener('input', () => {
            window.transcript = transcriptEl.value;
            updateProcessBtnState();
        });
    }

    function updateRecordingUI(recording) {
        const btn = document.getElementById('his-record-btn');
        const icon = document.getElementById('his-record-icon');
        const wave = document.getElementById('his-wave-indicator');
        const processBtn = document.getElementById('his-process-btn');

        if (recording) {
            btn.style.backgroundColor = '#dc3545';
            btn.style.borderColor = '#dc3545';
            btn.style.color = '#ffffff';
            icon.textContent = '⏹️';
            wave?.classList.remove('aladinn-hidden');
            if (processBtn) processBtn.disabled = true;
        } else {
            btn.style.backgroundColor = '#ffffff';
            btn.style.borderColor = '#a6c9e2';
            btn.style.color = '#004f9e';
            icon.textContent = '🎙️';
            wave?.classList.add('aladinn-hidden');
            updateProcessBtnState();
        }
    }

    function updateProcessBtnState() {
        const btn = document.getElementById('his-process-btn');
        if (btn) {
            btn.disabled = !(window.transcript?.trim().length > 0) || isRecording;
        }
    }

    function setLoading(loading) {
        const loadingEl = document.getElementById('his-loading');
        const processBtn = document.getElementById('his-process-btn');
        if (loadingEl) {
            if (loading) {
                loadingEl.classList.remove('aladinn-hidden');
                if (processBtn) processBtn.disabled = true;
            } else {
                loadingEl.classList.add('aladinn-hidden');
                updateProcessBtnState();
            }
        }
    }

    function showToast(message, isError = false) {
        const toast = document.getElementById('his-toast');
        if (!toast) return;
        toast.textContent = message;
        toast.className = 'his-toast show' + (isError ? ' error' : '');
        setTimeout(() => toast.classList.remove('show'), 3000);
    }

    // ========================================
    // ĐĂNG KÝ VÀ HIỂN THỊ KẾT QUẢ SOAP
    // ========================================
    function displaySoapResults(data) {
        const container = document.getElementById('his-results-container');
        if (!container) return;

        container.innerHTML = '';

        // Hiển thị các trường văn bản SOAP
        MEDICAL_FIELDS.forEach(f => {
            const val = data[f.key];
            if (val) {
                const item = document.createElement('div');
                item.className = 'ambient-soap-item';
                item.innerHTML = `
                    <div class="ambient-soap-header">${f.label}</div>
                    <div class="ambient-soap-body">
                        <textarea class="ambient-soap-input" rows="2" data-key="${f.key}">${val}</textarea>
                    </div>
                `;
                container.appendChild(item);

                // Lắng nghe chỉnh sửa của bác sĩ
                item.querySelector('textarea').addEventListener('input', (e) => {
                    window.currentResults[f.key] = e.target.value;
                });
            }
        });

        // Hiển thị các chỉ số sinh hiệu dạng Grid phẳng
        if (data.sinhHieu) {
            const vitalsSection = document.createElement('div');
            vitalsSection.className = 'ambient-soap-item';
            vitalsSection.innerHTML = `
                <div class="ambient-soap-header">Chỉ số sinh hiệu</div>
                <div class="ambient-soap-body" style="padding: 6px;">
                    <div class="his-vitals-container" style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; background: #eef6ff; border: 1px solid #a6c9e2; padding: 4px;">
                        ${VITAL_SIGNS.map(v => {
                            const val = data.sinhHieu[v.key] || '';
                            return `
                                <div class="his-vital-pill" style="display: flex; flex-direction: column; align-items: center; padding: 4px 2px; background: white; border: 1px solid #a6c9e2;">
                                    <span class="label" style="font-size: 8px; font-weight: bold; color: #666666; text-transform: uppercase;">${v.label}</span>
                                    <input type="text" class="vital-input" data-vital="${v.key}" value="${val}" style="width: 90%; border: none; text-align: center; font-size: 11px; font-weight: bold; color: #28a745; outline: none; padding: 0;">
                                    <span class="unit" style="font-size: 7px; color: #888888;">${v.unit}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            `;
            container.appendChild(vitalsSection);

            // Lắng nghe chỉnh sửa sinh hiệu
            vitalsSection.querySelectorAll('.vital-input').forEach(input => {
                input.addEventListener('input', (e) => {
                    const vitalKey = e.target.getAttribute('data-vital');
                    window.currentResults.sinhHieu[vitalKey] = e.target.value;
                });
            });
        }

        // Hiện section kết quả
        document.getElementById('his-results-section')?.classList.remove('aladinn-hidden');
    }

    function resetForNewPatient() {
        window.transcript = '';
        window.currentResults = null;
        startPatientId = null;
        contextToken = null;
        if (window.Aladinn?.Voice) {
            window.Aladinn.Voice.startPatientId = null;
            window.Aladinn.Voice.contextToken = null;
        }

        const transcriptTextarea = document.getElementById('his-transcript');
        if (transcriptTextarea) transcriptTextarea.value = '';

        const resultsContainer = document.getElementById('his-results-container');
        if (resultsContainer) resultsContainer.innerHTML = '';

        document.getElementById('his-results-section')?.classList.add('aladinn-hidden');
        document.getElementById('his-mismatch-error')?.classList.add('aladinn-hidden');

        updateProcessBtnState();
        showToast('🔄 Đã làm mới. Sẵn sàng cho bệnh nhân mới!');
    }

    function copyAllResults() {
        if (!window.currentResults) {
            showToast('⚠️ Chưa có dữ liệu để sao chép!', true);
            return;
        }

        let text = '';
        MEDICAL_FIELDS.forEach(f => {
            const val = window.currentResults[f.key];
            if (val) text += `${f.label}:\n${val}\n\n`;
        });

        if (window.currentResults.sinhHieu) {
            text += 'Sinh hiệu:\n';
            VITAL_SIGNS.forEach(v => {
                const val = window.currentResults.sinhHieu[v.key];
                if (val) text += `- ${v.label}: ${val} ${v.unit}\n`;
            });
        }

        navigator.clipboard.writeText(text.trim()).then(() => {
            showToast('📋 Đã sao chép bệnh án SOAP vào Clipboard!');
        }).catch(() => {
            showToast('❌ Không thể sao chép tự động!', true);
        });
    }

    function loadDemoData() {
        window.transcript = 'Bệnh nhân nam 52 tuổi, khai đau ngực sau xương ức khoảng 3 tiếng nay, đau kiểu bóp nghẹt lan ra vai trái. Bệnh sử: tăng huyết áp 8 năm uống thuốc liên tục, gia đình có bố bị tai biến. Khám thấy mệt mỏi, mạch quay rõ 82 lần, huyết áp đo được 145 trên 90, SpO2 duy trì 98%, cân nặng nặng 70 cân, chiều cao đo được một mét bảy mươi.';
        
        const transcriptTextarea = document.getElementById('his-transcript');
        if (transcriptTextarea) {
            transcriptTextarea.value = window.transcript;
        }

        window.currentResults = {
            lyDoVaoVien: 'Đau ngực sau xương ức giờ thứ 3',
            quaTrinhBenhLy: 'Bệnh nhân nam 52 tuổi, khởi phát đau ngực vùng sau xương ức đột ngột cách nhập viện 3 giờ. Đau kiểu đè ép, bóp nghẹt, lan lên vai và cánh tay trái, kéo dài liên tục không đỡ. Kèm mệt mỏi, không sốt, không nôn.',
            tienSuBanThan: 'Tăng huyết áp 8 năm, điều trị thuốc đều hàng ngày.',
            tienSuGiaDinh: 'Bố bị tai biến mạch máu não.',
            khamToanThan: 'Bệnh nhân tỉnh táo, tiếp xúc tốt. Thể trạng trung bình. Da niêm hồng nhạt. Không phù.',
            khamBoPhan: 'Tim đều nhịp 82 lần/phút, tiếng T1 T2 nghe rõ. Phổi không ran. Bụng mềm, ấn không đau khu trú.',
            chanDoanBanDau: 'Theo dõi Cơn đau thắt ngực không ổn định / Tăng huyết áp',
            huongXuLy: 'Nhập viện khoa Tim mạch, làm điện tâm đồ (ECG) cấp cứu, xét nghiệm men tim (Troponin T/I).',
            sinhHieu: {
                mach: '82',
                nhietDo: '36.8',
                huyetApTamThu: '145',
                huyetApTamTruong: '90',
                nhipTho: '20',
                spO2: '98',
                canNang: '70',
                chieuCao: '170'
            }
        };

        displaySoapResults(window.currentResults);
        updateProcessBtnState();
        showToast('🧪 Đã nạp dữ liệu mẫu thành công!');
    }

    function makeDraggable(element, handle) {
        let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
        if (handle) handle.onmousedown = dragMouseDown;

        function dragMouseDown(e) {
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
            document.onmouseup = closeDragElement;
            document.onmousemove = elementDrag;
        }

        function elementDrag(e) {
            e.preventDefault();
            pos1 = pos3 - e.clientX;
            pos2 = pos4 - e.clientY;
            pos3 = e.clientX;
            pos4 = e.clientY;

            let newTop = element.offsetTop - pos2;
            let newLeft = element.offsetLeft - pos1;

            const rect = element.getBoundingClientRect();
            if (newTop < 0) newTop = 0;
            if (newLeft < 0) newLeft = 0;
            if (newLeft + rect.width > window.innerWidth) newLeft = window.innerWidth - rect.width;
            if (newTop + rect.height > window.innerHeight) newTop = window.innerHeight - rect.height;

            element.style.top = newTop + 'px';
            element.style.left = newLeft + 'px';
            element.style.right = 'auto';
        }

        function closeDragElement() {
            document.onmouseup = null;
            document.onmousemove = null;
        }
    }

    // ========================================
    // KHỞI TẠO MODULE PHÂN HỆ
    // ========================================
    window.Aladinn.Voice.init = async function () {
        if (Logger) Logger.info('Voice.AmbientScrible', 'Bắt đầu khởi tạo AmbientScrible...');
        injectCustomStyles();

        try {
            const result = await new Promise(resolve => {
                chrome.storage.local.get('aladinn_voice_enabled', resolve);
            });
            const enabled = result.aladinn_voice_enabled !== false;
            
            if (enabled) {
                createFloatingPanel();
            }

            // Xuất hàm toggle ra namespace Aladinn
            window.Aladinn.Voice.toggle = function (state) {
                const panel = document.getElementById('his-floating-panel');
                const miniBtn = document.getElementById('his-mini-btn');

                if (state) {
                    if (panel && miniBtn) {
                        miniBtn.classList.remove('aladinn-hidden');
                    } else {
                        createFloatingPanel();
                    }
                } else {
                    if (panel) panel.classList.add('aladinn-hidden');
                    if (miniBtn) miniBtn.classList.add('aladinn-hidden');
                    stopRecording();
                }
            };
        } catch (err) {
            console.error('[Aladinn Voice] Lỗi khi khởi tạo AmbientScrible:', err);
        }
    };

})();
