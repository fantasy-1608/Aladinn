const GeminiAPI = (() => {
    /**
     * @param {string} rawTreatments 
     * @param {string} [apiKey] - Optional. If omitted, auto-resolved via HIS.getApiKey()
     * @param {string} [model="gemini-2.0-flash-lite-preview-02-05"] 
     * @param {string} [patientId="UNKNOWN"] 
     * @param {string} [targetField="QUATRINHBENHLY"] 
     */
    async function summarizeHistory(rawTreatments, apiKey, model = 'gemini-2.0-flash-lite-preview-02-05', patientId = 'UNKNOWN', targetField = 'QUATRINHBENHLY') {
        // Auto-resolve API key via centralized service if not provided
        if (!apiKey && HIS?.getApiKey) {
            apiKey = await HIS.getApiKey();
        }
        if (!apiKey) throw new Error('API Key chưa được cấu hình. Vui lòng mở khóa Voice Panel hoặc vào Settings.');

        let systemInstruction = `Bạn là một Bác sĩ Trưởng khoa đang viết Tờ "Tổng kết Hồ sơ Bệnh án" (Phần 1: Quá trình bệnh lý và Diễn biến lâm sàng) để lưu trữ hồ sơ xuất viện theo Chuẩn Bộ Y tế Việt Nam.

Dưới đây là toàn bộ số liệu chăm sóc và điều trị của đợt bệnh này. Hãy tổng hợp lại thành một bản tóm tắt có giá trị pháp lý và chuyên môn cao:

== YÊU CẦU CHUYÊN MÔN KẾT ÁN ==
1. Tóm lược rất ngắn gọn tình trạng lúc vào viện.
2. Nêu bật các diễn biến lâm sàng XẤU ĐI hoặc CẢI THIỆN RÕ RỆT trong suốt quá trình nằm viện. Nếu nhiều ngày liền tình trạng không đổi, hãy gom chúng lại.
3. Mục cuối cùng ghi rõ "Tình trạng hiện tại: ..." (là diễn biến lâm sàng của tờ điều trị cuối cùng).
4. TUYỆT ĐỐI BẢO LƯU TÍNH CHÍNH XÁC: Không chế bản, không tự bịa thuốc/chỉ định nếu văn bản gốc không có.
5. VĂN PHONG SÚC TÍCH: Định dạng thành 1-2 đoạn văn chuyên khoa mạch lạc. CHỈ TRẢ VỀ NỘI DUNG TÓM TẮT. KHÔNG CHỨA LỜI CHÀO. KHÔNG BỌC TRONG KHUNG MARKDOWN.`;

        if (targetField === 'CANLAMSANG') {
            systemInstruction = 'Hãy CHỈ giữ lại các chỉ định siêu âm, x-quang, xét nghiệm máu/nước tiểu sinh hóa và kết quả của chúng. Bỏ qua các thông tin khác.';
        }

        const userPrompt = `DỮ LIỆU ĐIỀU TRỊ (Đã được ẩn danh):\n${rawTreatments}`;

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;

        const payload = {
            system_instruction: {
                parts: [{ text: systemInstruction }]
            },
            contents: [
                {
                    parts: [{ text: userPrompt }]
                }
            ],
            generationConfig: {
                temperature: 0.1, // Thấp để đảm bảo tính chính xác, không sáng tạo láo
                topP: 0.8,
                topK: 40
            }
        };

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-goog-api-key': apiKey
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || 'Lỗi giao tiếp với máy chủ AI (Gemini)');
            }

            const data = await response.json();
            let output = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

            // Tính toán chi phí ước tính (VNĐ)
            let totalTokens = 0;
            let totalCost = 0;
            if (data.usageMetadata) {
                const promptTokens = data.usageMetadata.promptTokenCount || 0;
                const responseTokens = data.usageMetadata.candidatesTokenCount || 0;
                totalTokens = promptTokens + responseTokens;

                let pricePromptVND = 1.875;
                let priceRespVND = 7.5;
                const modelLower = model.toLowerCase();

                if (modelLower.includes('exp') || modelLower.includes('preview')) {
                    pricePromptVND = 0; priceRespVND = 0;
                } else if (modelLower.includes('3.5') || modelLower.includes('3-flash')) {
                    pricePromptVND = 3.825; priceRespVND = 15.3;
                } else if (modelLower.includes('lite')) {
                    pricePromptVND = 1.875; priceRespVND = 7.5;
                } else if (modelLower.includes('2.5-flash') || modelLower.includes('2.0-flash')) {
                    pricePromptVND = 2.5; priceRespVND = 10;
                } else if (modelLower.includes('1.5-flash')) {
                    pricePromptVND = 1.875; priceRespVND = 7.5;
                } else if (modelLower.includes('pro')) {
                    pricePromptVND = 31.25; priceRespVND = 125;
                }

                totalCost = (promptTokens * pricePromptVND + responseTokens * priceRespVND) / 1000;
            }

            // LƯU AUDIT LOG + DAILY USAGE
            await AIAuditLogger.log(patientId, rawTreatments, output, model, totalTokens);
            if (totalCost > 0) await AIAuditLogger.addCost(totalCost);

            // Hiển thị toast với thống kê hôm nay
            if (data.usageMetadata && window.VNPTRealtime) {
                const formattedCost = totalCost === 0
                    ? '0đ (Miễn phí)'
                    : (totalCost < 1 ? '< 1đ' : Math.round(totalCost).toLocaleString('vi-VN') + 'đ');

                const modelShort = model.replace('models/', '').split('-').slice(0, 3).join('-');

                // Lấy thống kê hôm nay
                const todayUsage = await AIAuditLogger.getTodayUsage();
                const dailyInfo = `📊 Hôm nay: ${todayUsage.requests}/1.500 requests | ${todayUsage.tokens.toLocaleString('vi-VN')} tokens`;
                const dailyCost = todayUsage.cost > 0
                    ? ` | ~${Math.round(todayUsage.cost).toLocaleString('vi-VN')}đ`
                    : ' | Miễn phí';

                window.VNPTRealtime.showToast(
                    `✅ AI VIP xong! 💰 ~${formattedCost} | ${totalTokens} tokens (${modelShort})\n${dailyInfo}${dailyCost}`,
                    'success'
                );
            }

            // Post-process: Sửa thuật ngữ local (0ms, không tốn tokens)
            output = output
                .replace(/sinh tồn/gi, 'sinh hiệu')
                .replace(/dấu hiệu sinh tồn/gi, 'dấu hiệu sinh hiệu');

            return output.trim();
        } catch (error) {
            console.error('[GeminiAPI] Error:', error);
            throw error;
        }
    }

    /**
     * Lấy danh sách mô hình khả dụng từ API Key
     * @param {string} apiKey 
     */
    async function fetchModels(apiKey) {
        if (!apiKey) return [];
        try {
            const response = await fetch('https://generativelanguage.googleapis.com/v1beta/models', {
                headers: { 'x-goog-api-key': apiKey }
            });
            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'Lỗi HTTP ' + response.status);
            }
            const data = await response.json();

            if (data.models) {
                const filtered = data.models
                    .filter((/** @type {any} */ m) =>
                        m.supportedGenerationMethods.includes('generateContent') &&
                        (m.name.includes('flash') || m.name.includes('pro') || m.name.includes('exp'))
                    )
                    .map((/** @type {any} */ m) => ({
                        id: m.name.replace('models/', ''),
                        name: m.displayName,
                        description: m.description
                    }));
                console.log(`[GeminiAPI] Tìm thấy ${filtered.length} mô hình khả dụng.`);
                return filtered;
            }
            return [];
        } catch (error) {
            console.error('[GeminiAPI] Lỗi khi fetch models:', error);
            throw error;
        }
    }

    // Export globally
    const api = { summarizeHistory, fetchModels };
    /** @type {any} */
    (window).GeminiAPI = api;

    return api;
})();
