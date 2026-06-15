const fs = require('fs');
const path = require('path');
const os = require('os');

const downloadsDir = path.join(os.homedir(), 'Downloads');
const destFile = path.join(__dirname, '../public/cds-data/raw_drugs.json');

// Tìm tất cả file bắt đầu bằng raw_drugs và đuôi .json trong Downloads
const files = fs.readdirSync(downloadsDir).filter(f => f.startsWith('raw_drugs') && f.endsWith('.json'));

if (files.length === 0) {
    console.log('⚠️ Không tìm thấy file thuốc nào trong thư mục Downloads!');
    process.exit(0);
}

// Đọc file cũ nếu có (để gộp thêm vào chứ không ghi đè mất dữ liệu cũ)
let existingDrugs = [];
if (fs.existsSync(destFile)) {
    try {
        existingDrugs = JSON.parse(fs.readFileSync(destFile, 'utf-8'));
    } catch (e) {}
}

const drugMap = new Map();
// Đưa thuốc cũ vào Map
existingDrugs.forEach(d => {
    if (d.ten) drugMap.set(d.ten.trim(), d);
});

// Đọc và gộp các file mới tải về
let newCount = 0;
files.forEach(file => {
    const fullPath = path.join(downloadsDir, file);
    try {
        const data = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
        data.forEach(d => {
            if (d.ten && !drugMap.has(d.ten.trim())) {
                drugMap.set(d.ten.trim(), d);
                newCount++;
            }
        });
        // Xóa file ở Downloads sau khi đã hút xong
        fs.unlinkSync(fullPath);
    } catch (e) {
        console.error(`Lỗi đọc file ${file}:`, e.message);
    }
});

// Ghi lại file tổng
const mergedDrugs = Array.from(drugMap.values());
fs.writeFileSync(destFile, JSON.stringify(mergedDrugs, null, 2));

console.log(`✅ Đã hút thành công ${files.length} file từ Downloads.`);
console.log(`✅ Đã thêm mới ${newCount} thuốc. Tổng cộng trong kho hiện tại có: ${mergedDrugs.length} thuốc.`);
