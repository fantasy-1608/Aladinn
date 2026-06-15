/**
 * DEV-ONLY: VNPT HIS DRUG SCRAPER
 * 
 * Mục đích: Thu thập danh mục thuốc từ VNPT HIS để cung cấp cho đội ngũ AI xử lý.
 * Người dùng cuối (Bác sĩ) KHÔNG cần sử dụng script này.
 * 
 * Cách dùng:
 * 1. Mở trang VNPT HIS (trang có đơn thuốc/phiếu điều trị).
 * 2. Nhấn F12 mở Chrome DevTools -> tab Console.
 * 3. Dán toàn bộ script này vào và nhấn Enter.
 * 4. File `raw_drugs_his.json` sẽ tự động được tải về.
 */

(async function() {
    console.log('%c🚀 [Dev Scraper] Đang khởi động...', 'color: #3b82f6; font-size: 16px; font-weight: bold;');

    const _w = window.frames.length > 0 ? window.frames[0].window : window;
    const _$ = _w.$ || window.$;

    if (!_$) {
        console.error('❌ Không tìm thấy jQuery. Hãy chắc chắn bạn đang ở đúng frame của trang Khám Bệnh.');
        return;
    }

    // 1. Tìm trực tiếp URL API của kho thuốc từ cấu hình Combogrid (Không cần click)
    let apiUrl = null;
    let targetInputs = _$('input.combogrid-f, select.combogrid-f');
    
    for (let i = 0; i < targetInputs.length; i++) {
        let el = targetInputs[i];
        try {
            let opts = _$(el).combogrid('options');
            if (opts && opts.url && typeof opts.url === 'string') {
                let lowerUrl = opts.url.toLowerCase();
                if (lowerUrl.includes('docombogrid') && (lowerUrl.includes('thuoc') || lowerUrl.includes('vattu') || lowerUrl.includes('kho_id'))) {
                    apiUrl = opts.url;
                    console.log('%c✅ Tìm thấy API Kho Thuốc:', 'color: #22c55e;', apiUrl);
                    break;
                }
            }
        } catch(e) {}
    }

    // Fallback: Thử tìm theo ID hoặc Name nếu jQuery combogrid chưa được khởi tạo hoàn toàn
    if (!apiUrl) {
        console.warn('⚠️ Không tìm thấy URL trực tiếp. Thử dò tìm trong biến toàn cục...');
        // Đôi khi URL được gán trong các biến render của server
        const scripts = document.querySelectorAll('script');
        for (let s of scripts) {
            if (s.textContent.includes('doComboGrid') && s.textContent.includes('thuoc')) {
                const match = s.textContent.match(/url\s*:\s*['"]([^'"]*doComboGrid[^'"]*)['"]/);
                if (match) {
                    apiUrl = match[1];
                    console.log('%c✅ Tìm thấy API qua Regex:', 'color: #22c55e;', apiUrl);
                    break;
                }
            }
        }
    }

    if (!apiUrl) {
        console.error('❌ Không thể trích xuất URL Kho Thuốc. Hãy thử click vào ô "Tên thuốc" một lần rồi chạy lại script.');
        return;
    }

    // 2. Fetch dữ liệu với rows=99999
    let fetchUrl = apiUrl;
    if (fetchUrl.includes('?')) {
        fetchUrl += '&rows=99999&page=1';
    } else {
        fetchUrl += '?rows=99999&page=1';
    }

    // Xóa các tham số rows/page cũ nếu có
    fetchUrl = fetchUrl.replace(/rows=\d+/, 'rows=99999').replace(/page=\d+/, 'page=1');

    console.log('%c⏳ Đang tải toàn bộ dữ liệu (có thể mất vài giây)...', 'color: #eab308;');
    
    try {
        const response = await fetch(fetchUrl, {
            headers: {
                "X-Requested-With": "XMLHttpRequest",
                "Accept": "application/json"
            }
        });

        if (!response.ok) throw new Error("HTTP " + response.status);
        const data = await response.json();
        const rows = data.rows || [];
        
        console.log(`%c✅ Tải thành công ${rows.length} records. Đang xử lý...`, 'color: #22c55e;');

        // 3. Trích xuất và chuẩn hóa
        const S = new Set();
        const results = [];

        for (let row of rows) {
            let name = "", hc = "", dg = "";
            if (row.cell && Array.isArray(row.cell)) {
                name = String(row.cell[1] || "").trim();
                hc = String(row.cell[2] || "").trim();
            } else {
                name = String(row.TEN_THUOC || row.TENTHUOC || row.TEN || "").trim();
                hc = String(row.HOATCHAT || row.TENHC || "").trim();
                dg = String(row.DONGIA || "").trim();
            }
            if (name && !S.has(name)) {
                S.add(name);
                results.push({
                    ten_thuoc: name,
                    hoat_chat: hc,
                    don_gia: dg,
                    raw_data: row // Giữ lại raw data cho AI phân tích nếu cần
                });
            }
        }

        // 4. Tự động tải file JSON
        const blob = new Blob([JSON.stringify(results, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `raw_his_drugs_${new Date().toISOString().slice(0,10)}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        console.log('%c🎉 HOÀN TẤT! File JSON đã được tải về.', 'color: #a855f7; font-size: 14px; font-weight: bold;');
        console.log('Bạn có thể gửi file này cho AI Dược sĩ (Data Pharmacist) để phân tích DDI.');

    } catch (err) {
        console.error('❌ Lỗi tải dữ liệu:', err);
    }
})();
