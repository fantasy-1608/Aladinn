const fs = require('fs');
const path = require('path');

const RAW_FILE = path.join(__dirname, '../public/cds-data/raw_drugs.json');
const GENERIC_FILE = path.join(__dirname, '../public/cds-data/drug_generic.json');
const BRAND_MAP_FILE = path.join(__dirname, '../public/cds-data/brand_generic_map.json');

if (!fs.existsSync(RAW_FILE)) {
    console.error("❌ Không tìm thấy file raw_drugs.json!");
    process.exit(1);
}

try {
    const rawDrugs = JSON.parse(fs.readFileSync(RAW_FILE, 'utf8'));
    let genericList = fs.existsSync(GENERIC_FILE) ? JSON.parse(fs.readFileSync(GENERIC_FILE, 'utf8')) : [];
    let brandMapList = fs.existsSync(BRAND_MAP_FILE) ? JSON.parse(fs.readFileSync(BRAND_MAP_FILE, 'utf8')) : [];

    console.log(`- Đang đọc: ${rawDrugs.length} thuốc từ kho raw_drugs.json`);
    console.log(`- Hiện tại có: ${genericList.length} hoạt chất, ${brandMapList.length} biệt dược được ánh xạ.`);

    const existingGenerics = new Set(genericList.map(g => g.generic_name.toLowerCase().trim()));
    const existingBrands = new Set(brandMapList.map(b => b.brand_name.toLowerCase().trim()));

    // Hàm chuẩn hóa hoạt chất (chữ thường, loại bỏ hàm lượng, dấu ngoặc)
    const cleanGeneric = (hc) => {
        if (!hc || hc === '-') return null;
        let text = hc.toLowerCase().replace(/[\s\u00a0\u200b]+/g, ' ').trim();
        text = text.replace(/\([^)]*\)/g, ' '); // Xóa nội dung trong ngoặc đơn
        // Xóa các hàm lượng (vd: 500mg, 1g, 10 ml, 1.5%)
        text = text.replace(/\b\d+([.,]\d+)?\s*(mg|g|mcg|ml|l|ui|iu|mEq|%|\/|\s)+\b/gi, ' ');
        text = text.replace(/\d+([.,]\d+)?\s*(mg|g|mcg|ml|l|ui|iu|mEq|%)/gi, ' ');
        
        // Cắt theo dấu phẩy, dấu cộng, gạch chéo hoặc chữ "và"
        let parts = text.split(/,|\+|\/|\b(và)\b/);
        parts = parts.map(p => p && p.trim()).filter(p => p && p !== 'và');
        
        // Loại bỏ các ký tự thừa ở 2 đầu và lọc từ quá ngắn
        parts = parts.map(p => p.trim().replace(/^[-.]+|[-.]+$/g, '')).filter(p => p.length >= 2);
        
        if (parts.length === 0) return null;
        return parts.join(' / ');
    };

    let addedGenerics = 0;
    let addedBrands = 0;

    for (const drug of rawDrugs) {
        if (!drug.ten) continue;
        
        const brandName = drug.ten.toLowerCase().trim();
        const genericName = cleanGeneric(drug.hc);
        
        if (!genericName) continue; // Bỏ qua vật tư hoặc thuốc không có hoạt chất rõ ràng

        // 1. Thêm hoạt chất vào drug_generic.json nếu chưa tồn tại
        // Đôi khi hoạt chất là dạng phối hợp, ta gộp nguyên mẫu hoặc tách, nhưng ở đây
        // NHIC và ddi_rules hỗ trợ cả dạng phối hợp hoặc đơn chất nên ta để nguyên cụm để map khớp.
        if (!existingGenerics.has(genericName)) {
            genericList.push({
                generic_name: genericName,
                generic_name_en: genericName,
                atc_code: "",
                pharmacologic_class: "unknown",
                therapeutic_class: "unknown",
                is_active: true
            });
            existingGenerics.add(genericName);
            addedGenerics++;
        }

        // 2. Thêm ánh xạ biệt dược vào brand_generic_map.json nếu chưa tồn tại
        if (!existingBrands.has(brandName)) {
            brandMapList.push({
                brand_name: brandName,
                generic_name: genericName,
                strength_text: "",
                dosage_form: "",
                route: "",
                is_primary: true
            });
            existingBrands.add(brandName);
            addedBrands++;
        }
    }

    // Ghi lại các tệp
    fs.writeFileSync(GENERIC_FILE, JSON.stringify(genericList, null, 2) + '\n', 'utf8');
    fs.writeFileSync(BRAND_MAP_FILE, JSON.stringify(brandMapList, null, 2) + '\n', 'utf8');

    console.log(`\n✅ Cập nhật thành công!`);
    console.log(`- Thêm mới ${addedGenerics} hoạt chất vào drug_generic.json`);
    console.log(`- Thêm mới ${addedBrands} biệt dược vào brand_generic_map.json`);
    console.log(`- Tổng số hiện tại: ${genericList.length} hoạt chất, ${brandMapList.length} biệt dược.`);

} catch (e) {
    console.error("❌ Lỗi trong quá trình tạo brand map:", e.message);
}
