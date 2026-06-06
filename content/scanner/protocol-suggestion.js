/**
 * 🧞 Aladinn — Gợi ý Phác đồ Điều trị (Treatment Protocol Suggestion)
 * 
 * ⚠️ CAUTION: This is the most safety-sensitive AI feature.
 * AI NEVER decides the protocol — only suggests for reference.
 * 
 * SAFETY RULES (per AGENTS.md + roadmap):
 * - PHI anonymized before AI call (defense-in-depth: content-script + background layer)
 * - Badge "🔖 Tham khảo" fixed on every suggestion — no workaround
 * - Disclaimer is mandatory and non-removable
 * - Audit log written when doctor views suggestions
 * - On-demand ONLY — never proactive
 * - Never use output as sole authority for treatment
 *
 * @module ProtocolSuggestion
 */

'use strict';

(function () {

    // ─── Audit Log ───────────────────────────────────────────────────────────
    /**
     * Write an audit log entry when the doctor views AI protocol suggestion.
     * Logs to chrome.storage (PHI-safe: only anonymized token + timestamp).
     * @param {string} patientRef  — anonymized token e.g. "BN-5492"
     * @param {string} diagnosis   — ICD10 code(s) shown to AI
     */
    function logProtocolView(patientRef, diagnosis) {
        try {
            const entry = {
                ts: new Date().toISOString(),
                event: 'PROTOCOL_SUGGESTION_VIEWED',
                patientRef,          // anonymized — never real name
                diagCodes: diagnosis.slice(0, 100), // truncated for safety
            };
            chrome.storage.local.get(['aladinn_audit_log'], (res) => {
                const log = Array.isArray(res.aladinn_audit_log) ? res.aladinn_audit_log : [];
                // Keep only last 200 entries to avoid unbounded growth
                log.push(entry);
                if (log.length > 200) log.splice(0, log.length - 200);
                chrome.storage.local.set({ aladinn_audit_log: log });
            });
        } catch (_) { /* fail silently — audit log must never crash main flow */ }
    }

    // ─── Prompt builder ──────────────────────────────────────────────────────
    /**
     * Build the protocol suggestion prompt.
     * @param {Object} params
     * @returns {string}
     */
    function buildProtocolPrompt(params) {
        const {
            patientRef = 'BN-XXXX',
            birthYear = 'không rõ',
            gender = 'không rõ',
            diagnosis = 'Chưa có chẩn đoán',
            currentDrugs = '',
            criticalLabs = '',
        } = params;

        return `[GỢI Ý PHÁC ĐỒ — CHỈ THAM KHẢO — Dữ liệu ẩn danh]
Mã bệnh nhân: ${patientRef} | Năm sinh: ${birthYear} | Giới: ${gender}

== CHẨN ĐOÁN HIỆN TẠI ==
${diagnosis}

== THUỐC ĐANG SỬ DỤNG ==
${currentDrugs || '(Không có dữ liệu)'}

== XÉT NGHIỆM QUAN TRỌNG ==
${criticalLabs || '(Không có dữ liệu)'}

---
Yêu cầu: Dựa vào dữ liệu trên, gợi ý phác đồ điều trị theo HƯỚNG DẪN BỘ Y TẾ VIỆT NAM (mới nhất).
OUTPUT FORMAT:
1. Phác đồ gợi ý chính (tên phác đồ, nguồn guideline)
2. Thuốc gợi ý (tên, liều, lưu ý quan trọng, tương tác nếu có)
3. Xét nghiệm cần theo dõi và tần suất
4. Lưu ý đặc biệt / chống chỉ định

QUAN TRỌNG:
- Đây là GỢI Ý THAM KHẢO, không phải y lệnh.
- Không bịa số liệu, không đưa ra con số chính xác nếu không có dữ liệu.
- Nêu rõ mức độ bằng chứng (Evidence Level) nếu biết.
- Kết thúc mỗi gợi ý bằng: "⚠️ Bác sĩ điều trị cần kiểm chứng và quyết định cuối cùng."
- Viết bằng tiếng Việt, văn phong y khoa, không markdown, plain text.`;
    }

    // ─── AI call via background ──────────────────────────────────────────────
    /**
     * Request protocol suggestion from background AI.
     * @param {string} prompt
     * @param {string} model
     * @returns {Promise<{text: string}>}
     */
    async function requestProtocolAI(prompt, model) {
        const response = await chrome.runtime.sendMessage({
            type: 'SCANNER_AI_REQUEST',
            payload: {
                prompt,
                model: model || 'gemini-2.5-flash-preview-05-20',
                requestId: `protocol-${Date.now()}`,
                generationConfig: {
                    temperature: 0.1,  // very low — factual output
                    topP: 0.8,
                    maxOutputTokens: 2048,
                },
                systemInstruction: 'Bạn là chuyên gia y tế tư vấn phác đồ điều trị theo Hướng dẫn Bộ Y tế Việt Nam. Chỉ đưa ra gợi ý tham khảo, không thay thế quyết định lâm sàng. Tuyệt đối không bịa số liệu. Nếu không đủ dữ liệu, hãy nói rõ. Không dùng markdown.'
            }
        });

        if (!response?.ok) {
            throw new Error(response?.error?.message || 'Lỗi giao tiếp với AI');
        }
        return response.data;
    }

    // ─── UI builder ──────────────────────────────────────────────────────────
    /**
     * Inject the Protocol Suggestion UI into a container element.
     *
     * @param {HTMLElement} container  — where to inject the UI
     * @param {Object} context         — clinical data context
     */
    function injectProtocolSuggestionUI(container, context) {
        const {
            patientRef, birthYear, gender, diagnosis,
            currentDrugs, criticalLabs, model,
        } = context;

        const prompt = buildProtocolPrompt({
            patientRef, birthYear, gender, diagnosis,
            currentDrugs, criticalLabs
        });

        const uid = `ps-${Date.now()}`;

        container.innerHTML = `
            <div id="${uid}-wrap" style="border:1px solid #ddd;border-bottom:3px solid #e65100;padding:0;background:#fff;margin-top:2px;">
                <!-- Header -->
                <div style="background:#fff3e0;border-bottom:1px solid #ffe0b2;padding:10px 14px;display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:700;font-size:14.4px;color:#e65100;display:flex;align-items:center;gap:6px;">
                        💊 Gợi ý Phác đồ Điều trị
                        <span style="font-size:10px;background:#e65100;color:#fff;padding:1px 7px;font-weight:700;letter-spacing:0.3px;">🔖 THAM KHẢO</span>
                    </span>
                    <button id="${uid}-cancel" style="background:none;border:none;font-size:18px;cursor:pointer;color:#888;transition:0.2s;" title="Đóng" onmouseover="this.style.color='#c62828'" onmouseout="this.style.color='#888'">✕</button>
                </div>

                <!-- Mandatory Clinical Disclaimer (non-removable) -->
                <div style="background:#fff8e1;border-bottom:1px solid #ffe082;padding:9px 14px;font-size:12px;color:#555;display:flex;gap:8px;align-items:flex-start;">
                    <span style="font-size:16px;flex-shrink:0;">⚠️</span>
                    <div>
                        <strong style="color:#e65100;">CẢNH BÁO PHÁP LÝ:</strong> Nội dung này do AI tổng hợp dựa trên Hướng dẫn BYT, chỉ mang tính THAM KHẢO.
                        <strong>Bác sĩ điều trị chịu hoàn toàn trách nhiệm</strong> về quyết định lâm sàng cuối cùng.
                        Không được áp dụng trực tiếp mà không kiểm chứng với guideline hiện hành và tình trạng cụ thể của bệnh nhân.
                    </div>
                </div>

                <!-- Loading State -->
                <div id="${uid}-loading" style="padding:24px;text-align:center;color:#e65100;">
                    <div style="display:inline-flex;gap:4px;align-items:center;margin-bottom:8px;">
                        <div style="width:6px;height:6px;border-radius:50%;background:#e65100;animation:aisDot 1.2s infinite ease-in-out;"></div>
                        <div style="width:6px;height:6px;border-radius:50%;background:#e65100;animation:aisDot 1.2s 0.15s infinite ease-in-out;"></div>
                        <div style="width:6px;height:6px;border-radius:50%;background:#e65100;animation:aisDot 1.2s 0.3s infinite ease-in-out;"></div>
                    </div>
                    <div style="font-size:13.2px;font-weight:600;">Gemini đang tra cứu phác đồ điều trị...</div>
                    <div style="font-size:12px;color:#888;margin-top:4px;">PHI đã được ẩn danh. Chỉ chẩn đoán và XN được gửi đi.</div>
                </div>

                <!-- Result (shown after AI response) -->
                <div id="${uid}-result" style="display:none;padding:14px;">
                    <div style="white-space:pre-wrap;font-family:'Segoe UI',sans-serif;font-size:13.2px;line-height:1.7;color:#333;background:#fafafa;border:1px solid #eee;padding:12px;max-height:320px;overflow-y:auto;" id="${uid}-text"></div>

                    <!-- Mandatory disclaimer at bottom -->
                    <div style="margin-top:12px;padding:8px 12px;background:#ffebee;border:1px solid #ffcdd2;border-left:4px solid #c62828;font-size:11.5px;color:#555;">
                        🔖 <strong>Tham khảo AI</strong> — Nội dung trên được tổng hợp bởi Gemini AI dựa trên dữ liệu ẩn danh.
                        <strong>Không thay thế quyết định lâm sàng.</strong> Phiên bản guideline có thể không cập nhật nhất.
                    </div>

                    <!-- Actions -->
                    <div style="display:flex;gap:8px;margin-top:10px;justify-content:flex-end;flex-wrap:wrap;">
                        <button id="${uid}-regen" style="padding:6px 14px;border:1px solid #e65100;background:#fff;color:#e65100;font-weight:600;cursor:pointer;font-size:13px;transition:0.2s;" onmouseover="this.style.background='#fff3e0'" onmouseout="this.style.background='#fff'">
                            🔄 Gợi ý lại
                        </button>
                        <button id="${uid}-copy" style="padding:6px 14px;border:1px solid #666;background:#fff;color:#444;font-weight:600;cursor:pointer;font-size:13px;transition:0.2s;" onmouseover="this.style.background='#f5f5f5'" onmouseout="this.style.background='#fff'">
                            📋 Sao chép
                        </button>
                    </div>
                </div>

                <!-- Error State -->
                <div id="${uid}-error" style="display:none;padding:14px;color:#c62828;font-size:13.2px;">
                    <strong>❌ Lỗi AI:</strong> <span id="${uid}-errmsg"></span>
                    <br><button id="${uid}-retry" style="margin-top:8px;padding:6px 14px;border:1px solid #c62828;background:#fff;color:#c62828;cursor:pointer;font-weight:600;font-size:12px;">🔄 Thử lại</button>
                </div>
            </div>
        `;

        const wrapEl   = container.querySelector(`#${uid}-wrap`);
        const loadEl   = container.querySelector(`#${uid}-loading`);
        const resultEl = container.querySelector(`#${uid}-result`);
        const textEl   = container.querySelector(`#${uid}-text`);
        const errorEl  = container.querySelector(`#${uid}-error`);
        const errMsgEl = container.querySelector(`#${uid}-errmsg`);

        // Close
        container.querySelector(`#${uid}-cancel`)?.addEventListener('click', () => wrapEl?.remove());

        // Copy
        container.querySelector(`#${uid}-copy`)?.addEventListener('click', async () => {
            const text = textEl?.textContent || '';
            try {
                await navigator.clipboard.writeText(text);
                window.VNPTRealtime?.showToast?.('✅ Đã sao chép gợi ý phác đồ vào clipboard.', 'success');
            } catch (_) {
                window.VNPTRealtime?.showToast?.('❌ Không sao chép được.', 'warning');
            }
        });

        // Regenerate
        container.querySelector(`#${uid}-regen`)?.addEventListener('click', () => {
            loadEl.style.display = 'block';
            resultEl.style.display = 'none';
            errorEl.style.display = 'none';
            runAI();
        });

        // Retry
        container.querySelector(`#${uid}-retry`)?.addEventListener('click', () => {
            loadEl.style.display = 'block';
            errorEl.style.display = 'none';
            runAI();
        });

        // ── Run AI ──
        async function runAI() {
            try {
                loadEl.style.display = 'block';
                resultEl.style.display = 'none';
                errorEl.style.display = 'none';

                const result = await requestProtocolAI(prompt, model);
                const text = result?.text || '';

                if (!text.trim()) {
                    throw new Error('AI trả về nội dung trống. Vui lòng thử lại.');
                }

                // Write audit log BEFORE showing result
                logProtocolView(patientRef, diagnosis);

                if (textEl) textEl.textContent = text.trim();
                loadEl.style.display = 'none';
                resultEl.style.display = 'block';
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
    window.Aladinn.ProtocolSuggestion = {
        buildPrompt: buildProtocolPrompt,
        injectUI: injectProtocolSuggestionUI,
        logView: logProtocolView,
    };

})();
