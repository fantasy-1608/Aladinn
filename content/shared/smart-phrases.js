/**
 * 🧞 Aladinn — SmartPhrases (Dot Phrases)
 * Tính năng gõ tắt để tự động bung văn bản cấu hình sẵn.
 * Lấy cảm hứng từ hệ thống Epic EMR.
 */

export const SmartPhrases = (function() {
    // TODO: Trong tương lai sẽ đọc từ Chrome Storage (his_settings)
    const DEFAULT_PHRASES = {
        '.tieuduong': 'Bệnh nhân có tiền sử Đái tháo đường type 2. Đường huyết kiểm soát không tốt. Đang điều trị Insulin.',
        '.khamhohap': 'Lồng ngực cân đối, di động đều theo nhịp thở. Rì rào phế nang êm dịu, không rale.',
        '.khamtim': 'Nhịp tim đều, T1 T2 rõ, không nghe âm thổi bệnh lý.',
        '.khamtieuhoa': 'Bụng mềm, di động theo nhịp thở. Gan lách không sờ chạm. Ấn không đau khu trú.'
    };

    function handleInput(e) {
        if (!e.target || !e.target.matches('textarea, input[type="text"]')) {
            return;
        }

        const val = e.target.value;
        const startPos = e.target.selectionStart;
        if (startPos === undefined) return;

        // Lấy nội dung văn bản cho đến con trỏ hiện tại
        const textToCursor = val.substring(0, startPos);
        
        // Tìm dot phrase kết thúc tại vị trí con trỏ
        const lastWordMatch = textToCursor.match(/\.(\w+)$/);
        
        if (lastWordMatch) {
            const phrase = '.' + lastWordMatch[1];
            if (DEFAULT_PHRASES[phrase]) {
                const replacement = DEFAULT_PHRASES[phrase];
                
                // Cắt ghép chuỗi mới
                const newText = val.substring(0, startPos - phrase.length) + replacement + val.substring(startPos);
                e.target.value = newText;
                
                // Đưa con trỏ đến ngay sau đoạn văn bản vừa thay thế
                const newCursorPos = startPos - phrase.length + replacement.length;
                e.target.setSelectionRange(newCursorPos, newCursorPos);
                
                // Bắn sự kiện để framework của HIS (ví dụ: React, Angular, jQuery) nhận biết sự thay đổi
                e.target.dispatchEvent(new Event('input', { bubbles: true }));
                e.target.dispatchEvent(new Event('change', { bubbles: true }));
                
                // Log để debug (không chứa PHI)
                console.log(`[Aladinn] ⌨️ SmartPhrase expanded: ${phrase}`);
            }
        }
    }

    function init() {
        document.addEventListener('input', handleInput);
        console.log('[Aladinn] ⌨️ SmartPhrases Module initialized.');
    }

    return {
        init
    };
})();
