/**
 * 🧞 Aladinn CDS — Proactive Keystroke Scanner
 * Lắng nghe các sự kiện gõ phím trực tiếp trên các ô nhập liệu thuốc của HIS.
 * Debounce 300ms và gửi lên parent window để chạy rules trước khi kê đơn.
 */

const INPUT_SELECTOR = 'input[id*="txtTenThuoc"], input[id*="txtMaThuoc"], input[id*="txtTenThuocBHYT"], input[placeholder*="thuốc"], input[placeholder*="Thuốc"], input[id*="search"], input[id*="Search"]';

export function initKeystrokeHook(callback) {
    let debounceTimer = null;
    
    function handleInput(event) {
        const input = event.target;
        if (!input.matches(INPUT_SELECTOR)) return;

        const val = (input.value || '').trim();
        
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log('[Aladinn CDS KeyHook] ⌨️ Debounced typing:', val);
            callback(val);
        }, 300); // 300ms debounce để tối ưu hiệu năng
    }

    function handleBlur(event) {
        const input = event.target;
        if (!input.matches(INPUT_SELECTOR)) return;

        // Trì hoãn gửi xóa để tránh xóa alert trước khi click chọn thuốc gợi ý hoàn tất
        setTimeout(() => {
            console.log('[Aladinn CDS KeyHook] ⌨️ Input blurred, clearing proactive drug.');
            callback('');
        }, 500);
    }

    // Lắng nghe sự kiện input ở pha capturing để chắc chắn bắt được
    document.addEventListener('input', handleInput, true);
    document.addEventListener('blur', handleBlur, true);
    
    console.log('[Aladinn CDS KeyHook] ⌨️ Keystroke hook initialized.');

    // Trả về hàm cleanup
    return () => {
        document.removeEventListener('input', handleInput, true);
        document.removeEventListener('blur', handleBlur, true);
        clearTimeout(debounceTimer);
    };
}
