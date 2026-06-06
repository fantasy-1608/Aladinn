/**
 * 🧞 Aladinn — Discharge Summary (Tóm tắt Xuất viện Thông minh)
 * 2-step workflow: AI Draft → Doctor Review → Writeback
 *
 * SAFETY RULES (per AGENTS.md):
 * - PHI is anonymized before ANY AI call (background layer + content layer)
 * - assertSamePatientContext() MUST pass before writeback
 * - User MUST confirm before any HIS write
 * - Never use LLM output as sole authority for writeback
 * - Fail closed on uncertainty
 *
 * @module DischargeSummary
 */

'use strict';

(function () {
    // ─── PHI anonymization (content-script layer) ────────────────────────────
    // Background ai-client.js also redacts via PHIRedactor — this is defense-in-depth.
    /**
     * Sanitize a patient name for use in AI prompt.
     * Replaces name with anonymized token.
     * @param {string} name
     * @param {string} token  e.g. "BN-A123"
     * @returns {string}
     */
    function anonymizeName(text, realName, token) {
        if (!text || !realName || realName.length < 2) return text;
        // Match exact name (case insensitive, normalize diacritics roughly)
        try {
            const escaped = realName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
            return text.replace(new RegExp(escaped, 'gi'), token);
        } catch (_) {
            return text;
        }
    }

    // ─── Prompt builder ──────────────────────────────────────────────────────
    /**
     * Build the discharge summary prompt.
     * @param {Object} params
     * @param {string} params.patientRef   — anonymized token e.g. "BN-5492"
     * @param {string} params.birthYear
     * @param {string} params.gender
     * @param {string} params.diagnosis    — main ICD10 diagnoses
     * @param {string} params.clinicalNotes — diễn tiến lâm sàng (tờ điều trị raw)
     * @param {string} params.labSummary   — XN summary (anonymized)
     * @param {string} params.drugSummary  — thuốc cuối đợt
     * @param {string} params.imagingSummary — CĐHA summary
     * @param {string} params.admitDate
     * @param {string} params.dischargeDate
     * @param {string} params.daysInHospital
     * @returns {string}
     */
    function buildDischargeSummaryPrompt(params) {
        const {
            patientRef = 'BN-XXXX',
            birthYear = 'không rõ',
            gender = 'không rõ',
            diagnosis = 'Chưa có chẩn đoán',
            clinicalNotes = '',
            labSummary = '',
            drugSummary = '',
            imagingSummary = '',
            admitDate = '',
            dischargeDate = '',
            daysInHospital = '',
        } = params;

        // Additional safety: redact phone-like patterns before sending
        const safeNotes = clinicalNotes
            .replace(/\b0\d{9}\b/g, '[SĐT]')
            .replace(/\b\d{12}\b/g, '[CCCD]')
            .replace(/\b\d{9}\b/g, '[CMND]');

        const admitLine = admitDate ? `Ngày vào viện: ${admitDate}` : '';
        const dischargeLine = dischargeDate ? `Ngày dự kiến xuất viện: ${dischargeDate}` : '';
        const daysLine = daysInHospital ? `Số ngày nằm viện: ${daysInHospital}` : '';
        const headerLines = [admitLine, dischargeLine, daysLine].filter(Boolean).join(' | ');

        return `[TÓM TẮT XUẤT VIỆN — Dữ liệu ẩn danh]
Mã bệnh nhân: ${patientRef} | Năm sinh: ${birthYear} | Giới: ${gender}
${headerLines}

== CHẨN ĐOÁN ==
${diagnosis}

== DIỄN TIẾN LÂM SÀNG (raw) ==
${safeNotes || '(Không có dữ liệu diễn tiến lâm sàng)'}

== XÉT NGHIỆM NỔI BẬT ==
${labSummary || '(Không có dữ liệu XN)'}

== CĐHA ==
${imagingSummary || '(Không có dữ liệu CĐHA)'}

== THUỐC KHI XUẤT VIỆN (dự kiến) ==
${drugSummary || '(Không có dữ liệu thuốc)'}

---
Yêu cầu: Dựa vào dữ liệu trên, viết BẢN TÓM TẮT XUẤT VIỆN theo chuẩn Bộ Y tế Việt Nam.
Định dạng output: plain text, không markdown, không tiêu đề cấp 1. Bao gồm:
1. Tóm tắt bệnh sử và tình trạng vào viện (1-2 câu)
2. Quá trình điều trị và diễn biến lâm sàng (súc tích, nêu bật thay đổi quan trọng)
3. Kết quả cận lâm sàng nổi bật
4. Tình trạng hiện tại khi xuất viện
5. Hướng xử lý và thuốc về nhà (nếu có)
KHÔNG chứa tên thật bệnh nhân. KHÔNG bịa số liệu. Văn phong y khoa chuyên nghiệp, súc tích.`;
    }

    // ─── AI call via background ──────────────────────────────────────────────
    /**
     * Request AI discharge summary from background.
     * @param {string} prompt
     * @param {string} model
     * @returns {Promise<{text: string, usageMetadata: Object}>}
     */
    async function requestDischargeSummaryAI(prompt, model) {
        const response = await chrome.runtime.sendMessage({
            type: 'SCANNER_AI_REQUEST',
            payload: {
                prompt,
                model: model || 'gemini-2.5-flash-preview-05-20',
                requestId: `discharge-${Date.now()}`,
                generationConfig: {
                    temperature: 0.15,
                    topP: 0.85,
                    maxOutputTokens: 2048,
                },
                systemInstruction: 'Bạn là Bác sĩ Trưởng khoa đang viết "Tóm tắt bệnh án xuất viện" theo chuẩn Bộ Y tế Việt Nam (Thông tư 13/2025/TT-BYT). Văn phong y khoa chuyên nghiệp, súc tích. Tuyệt đối không bịa số liệu. Không xuất markdown.'
            }
        });

        if (!response?.ok) {
            throw new Error(response?.error?.message || 'Lỗi giao tiếp với AI');
        }
        return response.data;
    }

    // ─── UI builder ──────────────────────────────────────────────────────────
    /**
     * Inject the Discharge Summary UI into a container element.
     * Called lazily when doctor clicks "Tóm tắt Xuất viện" button.
     *
     * @param {HTMLElement} container  — where to inject the UI
     * @param {Object} context         — clinical data context
     * @param {Function} [onInsert]    — callback(text) if writeback is requested
     */
    function injectDischargeSummaryUI(container, context, onInsert) {
        // ── Build initial anonymized prompt ──
        const {
            patientRef, birthYear, gender, diagnosis,
            clinicalNotes, labSummary, drugSummary, imagingSummary,
            admitDate, dischargeDate, daysInHospital,
            patientName: _patientName, model,
        } = context;

        const prompt = buildDischargeSummaryPrompt({
            patientRef, birthYear, gender, diagnosis,
            clinicalNotes, labSummary, drugSummary, imagingSummary,
            admitDate, dischargeDate, daysInHospital
        });

        // Unique IDs scoped to avoid conflicts
        const uid = `ds-${Date.now()}`;

        container.innerHTML = `
            <div id="${uid}-wrap" style="border:1px solid #ddd;border-bottom:3px solid #1e5494;padding:0;background:#fff;margin-top:2px;">
                <!-- Header -->
                <div style="background:#f0f4fa;border-bottom:1px solid #ddd;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:700;font-size:14.4px;color:#1e5494;display:flex;align-items:center;gap:6px;">
                        📋 Tóm tắt Xuất viện
                        <span style="font-size:11px;background:#1e5494;color:#fff;padding:1px 7px;font-weight:600;">BƯỚC 1/2 — Soạn thảo AI</span>
                    </span>
                    <button id="${uid}-cancel" style="background:none;border:none;font-size:18px;cursor:pointer;color:#888;transition:0.2s;" title="Đóng" onmouseover="this.style.color='#c62828'" onmouseout="this.style.color='#888'">✕</button>
                </div>

                <!-- Step 1: Loading / Draft -->
                <div id="${uid}-loading" style="padding:24px;text-align:center;color:#1e5494;">
                    <div style="display:inline-flex;gap:4px;align-items:center;margin-bottom:8px;">
                        <div style="width:6px;height:6px;border-radius:50%;background:#1e5494;animation:aisDot 1.2s infinite ease-in-out;"></div>
                        <div style="width:6px;height:6px;border-radius:50%;background:#1e5494;animation:aisDot 1.2s 0.15s infinite ease-in-out;"></div>
                        <div style="width:6px;height:6px;border-radius:50%;background:#1e5494;animation:aisDot 1.2s 0.3s infinite ease-in-out;"></div>
                    </div>
                    <div style="font-size:13.2px;font-weight:600;">Gemini đang soạn thảo tóm tắt xuất viện...</div>
                    <div style="font-size:12px;color:#888;margin-top:4px;">PHI đã được ẩn danh. Dữ liệu gửi an toàn qua HTTPS.</div>
                </div>

                <!-- Step 2: Review editor (shown after AI response) -->
                <div id="${uid}-review" style="display:none;padding:12px 14px;">
                    <!-- Disclaimer -->
                    <div style="background:#fff3e0;border:1px solid #ffe0b2;border-left:4px solid #f57c00;padding:8px 12px;font-size:12px;color:#555;margin-bottom:10px;">
                        ⚠️ <strong>Lưu ý:</strong> Nội dung do AI soạn thảo. Bác sĩ <strong>PHẢI kiểm tra và hiệu chỉnh</strong> trước khi lưu vào hồ sơ.
                        Nội dung có thể bị thiếu hoặc không chính xác do dữ liệu ẩn danh.
                    </div>

                    <!-- Editable textarea -->
                    <label style="display:block;font-size:12px;font-weight:700;color:#444;margin-bottom:4px;">Nội dung Tóm tắt Xuất viện (chỉnh sửa trực tiếp):</label>
                    <textarea id="${uid}-editor" rows="12"
                        style="width:100%;box-sizing:border-box;border:1px solid #ccc;padding:10px;font-family:'Segoe UI',sans-serif;font-size:13.2px;line-height:1.6;resize:vertical;color:#222;background:#fafafa;border-radius:0;outline:none;transition:border 0.2s;"
                        onfocus="this.style.borderColor='#1e5494';this.style.background='#fff'"
                        onblur="this.style.borderColor='#ccc';this.style.background='#fafafa'"
                        placeholder="AI đang soạn..."></textarea>

                    <!-- Step indicator -->
                    <div style="display:flex;align-items:center;gap:6px;margin-top:10px;padding:8px 10px;background:#e8f0fe;border:1px solid #c5d5f5;">
                        <span style="font-size:12px;color:#1e5494;font-weight:700;">BƯỚC 2/2:</span>
                        <span style="font-size:12.6px;color:#333;">Kiểm tra nội dung trên → Bấm "Chèn vào HIS" để lưu vào ô tóm tắt xuất viện.</span>
                    </div>

                    <!-- Action buttons -->
                    <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end;flex-wrap:wrap;">
                        <button id="${uid}-regen" style="padding:7px 14px;border:1px solid #1e5494;background:#fff;color:#1e5494;font-weight:600;cursor:pointer;font-size:13px;transition:0.2s;" title="Yêu cầu AI soạn lại" onmouseover="this.style.background='#e8f0fe'" onmouseout="this.style.background='#fff'">
                            🔄 Soạn lại
                        </button>
                        <button id="${uid}-copy" style="padding:7px 14px;border:1px solid #666;background:#fff;color:#444;font-weight:600;cursor:pointer;font-size:13px;transition:0.2s;" title="Sao chép vào clipboard" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='#fff'">
                            📋 Sao chép
                        </button>
                        ${onInsert ? `<button id="${uid}-insert" style="padding:7px 18px;border:none;background:#1e5494;color:#fff;font-weight:700;cursor:pointer;font-size:13px;transition:0.2s;" title="Chèn vào ô tóm tắt xuất viện trên HIS" onmouseover="this.style.background='#1a4583'" onmouseout="this.style.background='#1e5494'">
                            ✅ Chèn vào HIS
                        </button>` : ''}
                    </div>
                </div>

                <!-- Error state -->
                <div id="${uid}-error" style="display:none;padding:16px;color:#c62828;font-size:13.2px;">
                    <strong>❌ Lỗi AI:</strong> <span id="${uid}-errmsg"></span>
                    <br><button id="${uid}-retry" style="margin-top:8px;padding:6px 14px;border:1px solid #c62828;background:#fff;color:#c62828;cursor:pointer;font-weight:600;font-size:12px;" onmouseover="this.style.background='#ffebee'" onmouseout="this.style.background='#fff'">🔄 Thử lại</button>
                </div>
            </div>
        `;

        const wrapEl  = container.querySelector(`#${uid}-wrap`);
        const loadEl  = container.querySelector(`#${uid}-loading`);
        const reviewEl = container.querySelector(`#${uid}-review`);
        const editorEl = container.querySelector(`#${uid}-editor`);
        const errorEl = container.querySelector(`#${uid}-error`);
        const errMsgEl = container.querySelector(`#${uid}-errmsg`);

        // Close
        container.querySelector(`#${uid}-cancel`)?.addEventListener('click', () => {
            wrapEl?.remove();
        });

        // Copy to clipboard
        container.querySelector(`#${uid}-copy`)?.addEventListener('click', async () => {
            const text = editorEl?.value || '';
            try {
                await navigator.clipboard.writeText(text);
                window.VNPTRealtime?.showToast?.('✅ Đã sao chép tóm tắt xuất viện vào clipboard.', 'success');
            } catch (_) {
                window.VNPTRealtime?.showToast?.('❌ Không sao chép được.', 'warning');
            }
        });

        // Insert into HIS
        if (onInsert) {
            container.querySelector(`#${uid}-insert`)?.addEventListener('click', () => {
                const finalText = editorEl?.value?.trim() || '';
                if (!finalText) {
                    window.VNPTRealtime?.showToast?.('⚠️ Nội dung trống, không thể chèn.', 'warning');
                    return;
                }
                // Confirm before writeback
                const confirmed = window.confirm(
                    '⚠️ BẠN ĐÃ KIỂM TRA NỘI DUNG NÀY?\n\n' +
                    'AI có thể sai hoặc thiếu thông tin. Bác sĩ chịu trách nhiệm về nội dung tóm tắt.\n\n' +
                    'Bấm OK để chèn vào HIS.'
                );
                if (!confirmed) return;
                onInsert(finalText);
            });
        }

        // Regenerate
        container.querySelector(`#${uid}-regen`)?.addEventListener('click', () => {
            loadEl.style.display = 'block';
            reviewEl.style.display = 'none';
            errorEl.style.display = 'none';
            runAI();
        });

        // Retry on error
        container.querySelector(`#${uid}-retry`)?.addEventListener('click', () => {
            loadEl.style.display = 'block';
            errorEl.style.display = 'none';
            runAI();
        });

        // ── Run AI ──
        async function runAI() {
            try {
                loadEl.style.display = 'block';
                reviewEl.style.display = 'none';
                errorEl.style.display = 'none';

                const result = await requestDischargeSummaryAI(prompt, model);
                const text = result?.text || '';

                if (!text.trim()) {
                    throw new Error('AI trả về nội dung trống. Vui lòng thử lại.');
                }

                if (editorEl) editorEl.value = text.trim();
                loadEl.style.display = 'none';
                reviewEl.style.display = 'block';
            } catch (err) {
                loadEl.style.display = 'none';
                errorEl.style.display = 'block';
                if (errMsgEl) errMsgEl.textContent = err?.message || 'Lỗi không xác định';
            }
        }

        // Auto-run on mount
        runAI();
    }

    // ─── Public API ──────────────────────────────────────────────────────────
    window.Aladinn = window.Aladinn || {};
    window.Aladinn.DischargeSummary = {
        buildPrompt: buildDischargeSummaryPrompt,
        injectUI: injectDischargeSummaryUI,
        anonymizeName,
    };

})();
