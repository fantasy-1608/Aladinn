const fs = require('fs');
const path = require('path');

const existingPath = path.join(__dirname, '../public/cds-data/ddi_rules.json');
const nhicPath = path.join(__dirname, '../public/cds-data/nhic_ddi_rules.json');
const dbJsPath = path.join(__dirname, '../content/cds/db.js');

if (!fs.existsSync(existingPath) || !fs.existsSync(nhicPath)) {
    console.error("❌ Không tìm thấy tệp quy tắc nguồn hoặc kết quả cào!");
    process.exit(1);
}

try {
    const existingRules = JSON.parse(fs.readFileSync(existingPath, 'utf8'));
    const nhicRules = JSON.parse(fs.readFileSync(nhicPath, 'utf8'));
    
    console.log(`- Đọc thành công ${existingRules.length} quy tắc hiện có.`);
    console.log(`- Đọc thành công ${nhicRules.length} quy tắc NHIC mới.`);
    
    // Bản đồ để theo dõi các cặp thuốc
    const nhicPairs = new Set();
    nhicRules.forEach(r => {
        const pair1 = `${r.generic_a.toLowerCase()}_${r.generic_b.toLowerCase()}`;
        const pair2 = `${r.generic_b.toLowerCase()}_${r.generic_a.toLowerCase()}`;
        nhicPairs.add(pair1);
        nhicPairs.add(pair2);
    });
    
    // Lọc bỏ các quy tắc cũ nếu cặp thuốc đã được cập nhật bởi NHIC
    let keptExistingCount = 0;
    let replacedCount = 0;
    const cleanExistingRules = existingRules.filter(r => {
        const pair = `${r.generic_a.toLowerCase()}_${r.generic_b.toLowerCase()}`;
        if (nhicPairs.has(pair)) {
            replacedCount++;
            return false; // Loại bỏ quy tắc cũ trùng lặp để nhường chỗ cho NHIC
        }
        keptExistingCount++;
        return true;
    });
    
    console.log(`- Loại bỏ ${replacedCount} quy tắc cũ trùng lặp (ưu tiên dữ liệu chính thống từ Bộ Y tế).`);
    console.log(`- Giữ lại ${keptExistingCount} quy tắc cũ không trùng lặp.`);
    
    // Gộp hai danh sách
    const mergedRules = [...cleanExistingRules, ...nhicRules];
    
    // Ghi lại tệp ddi_rules.json chính thức
    fs.writeFileSync(existingPath, JSON.stringify(mergedRules, null, 2) + '\n', 'utf8');
    console.log(`✅ Đã gộp thành công! Tổng số quy tắc trong ddi_rules.json hiện tại: ${mergedRules.length}`);
    
    // Tự động cập nhật phiên bản SEED trong content/cds/db.js để kích hoạt re-seed tự động
    const today = new Date().toISOString().slice(0, 10);
    const newSeedVersion = `${today}-nhic-seed-${mergedRules.length}-rules`;

    if (fs.existsSync(dbJsPath)) {
        let dbJsContent = fs.readFileSync(dbJsPath, 'utf8');
        
        // Tìm và thay thế dòng seed version cũ
        const seedRegex = /export\s+const\s+KB_SEED_VERSION\s*=\s*['"]([^'"]+)['"]/g;
        if (seedRegex.test(dbJsContent)) {
            dbJsContent = dbJsContent.replace(seedRegex, `export const KB_SEED_VERSION = '${newSeedVersion}'`);
            fs.writeFileSync(dbJsPath, dbJsContent, 'utf8');
            console.log(`✅ Đã tự động nâng cấp KB_SEED_VERSION trong db.js lên: "${newSeedVersion}"`);
        } else {
            console.warn("⚠️ Không thể tìm thấy định nghĩa KB_SEED_VERSION trong db.js!");
        }
    }

    // Tự động cập nhật metadata.json để kích hoạt OTA Sync khi người dùng tải lại trang
    const metadataPath = path.join(__dirname, '../public/cds-data/metadata.json');
    if (fs.existsSync(metadataPath)) {
        try {
            const metadata = JSON.parse(fs.readFileSync(metadataPath, 'utf8'));
            metadata.ruleset_version = newSeedVersion;
            metadata.last_updated = new Date().toISOString();
            fs.writeFileSync(metadataPath, JSON.stringify(metadata, null, 4) + '\n', 'utf8');
            console.log(`✅ Đã tự động cập nhật metadata.json lên phiên bản: "${newSeedVersion}"`);
        } catch (e) {
            console.error("❌ Không thể cập nhật metadata.json:", e.message);
        }
    }
    
} catch (e) {
    console.error("❌ Lỗi trong quá trình gộp dữ liệu:", e.message);
}
