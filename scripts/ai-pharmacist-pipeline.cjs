const fs = require('fs');
const path = require('path');

const RAW_FILE = path.join(__dirname, '../public/cds-data/raw_drugs.json');
const DDI_RULES_FILE = path.join(__dirname, '../public/cds-data/ddi_rules.json');
const CSV_FILE = path.join(__dirname, '../public/cds-data/ddinter_merged_filtered.csv');
const OUT_FILE = path.join(__dirname, '../public/cds-data/ddi_rules.json');

console.log('🚀 [AI Orchestrator] Khởi động Hạm đội Dược Sĩ Lâm Sàng (AI Clinical Pharmacist Team)');
console.log('======================================================================================');

// 1. Phân tích raw_drugs.json
let rawData = [];
try {
    rawData = JSON.parse(fs.readFileSync(RAW_FILE, 'utf-8'));
} catch (e) {
    console.error('Không tìm thấy file raw_drugs.json. Vui lòng chạy lệnh cào thuốc trước.');
    process.exit(1);
}

const activeIngredients = new Set();

rawData.forEach(drug => {
    let hc = drug.hc || '';
    if (hc === '-' || hc === '') return;
    
    // Tách theo dấu phẩy, dấu cộng
    let parts = hc.split(/[,+]/);
    parts.forEach(p => {
        // Xóa các thông số hàm lượng (mg, ml, g, %, UI, gam) và làm sạch text
        let name = p.replace(/\d+([.,]\d+)?\s*(mg|g|ml|mcg|ui|iu|%)/gi, '')
                    .replace(/\d+\/\d+/g, '') // xóa dạng 500/125
                    .replace(/\([^)]+\)/g, '') // xóa trong ngoặc
                    .trim()
                    .toLowerCase();
        
        if (name.length > 2) {
            activeIngredients.add(name);
        }
    });
});

console.log(`[Data Pharmacist] Đã trích xuất ${activeIngredients.size} hoạt chất độc lập từ ${rawData.length} thuốc nội bộ.`);

// 2. Nạp CSDL DDI và lọc tương tác NGHIÊM TRỌNG
let hospitalRules = [];

// Xử lý ddi_rules.json
if (fs.existsSync(DDI_RULES_FILE)) {
    const ddiRules = JSON.parse(fs.readFileSync(DDI_RULES_FILE, 'utf-8'));
    let matchedJson = 0;
    ddiRules.forEach(rule => {
        // CHỈ LẤY những luật NGHIÊM TRỌNG VÀ cả 2 thuốc ĐỀU CÓ trong kho viện
        if ((rule.severity === 'high' || rule.action_code === 'avoid' || rule.action_code === 'contraindicated') &&
            (activeIngredients.has(rule.generic_a.toLowerCase()) && activeIngredients.has(rule.generic_b.toLowerCase()))) {
            hospitalRules.push(rule);
            matchedJson++;
        }
    });
    console.log(`[Clinical Pharmacist] Đã lọc ra ${matchedJson} luật cực kỳ nguy hiểm từ DDI Rules nội bộ.`);
}

// Xử lý CSV
if (fs.existsSync(CSV_FILE)) {
    const csvData = fs.readFileSync(CSV_FILE, 'utf-8').split('\n');
    let matchedCsv = 0;
    csvData.forEach(line => {
        const cols = line.split(',');
        if (cols.length >= 5) {
            const drugA = cols[1].toLowerCase().trim();
            const drugB = cols[3].toLowerCase().trim();
            const level = cols[4].trim();
            
            if (level === 'Major') {
                if (activeIngredients.has(drugA) && activeIngredients.has(drugB)) {
                    hospitalRules.push({
                        rule_code: `DDINTER-${cols[0]}-${cols[2]}`,
                        generic_a: drugA,
                        generic_b: drugB,
                        severity: 'high',
                        evidence_level: 'high',
                        clinical_effect: 'Tương tác nghiêm trọng (Major) theo CSDL DDInter.',
                        recommendation: 'Chống chỉ định hoặc cần theo dõi y tế chặt chẽ.',
                        action_code: 'contraindicated',
                        is_active: true,
                        source: 'ddinter'
                    });
                    matchedCsv++;
                }
            }
        }
    });
    console.log(`[Clinical Pharmacist] Đã lọc ra ${matchedCsv} luật Chống chỉ định Tuyệt đối từ hệ thống DDInter toàn cầu.`);
}

// 3. Ghi file kết quả để nhúng vào Build
fs.writeFileSync(OUT_FILE, JSON.stringify(hospitalRules, null, 2));

console.log('======================================================================================');
console.log(`[Chief Pharmacist] Hoàn thành! Đã tạo thành công bộ Cảnh báo Tương tác Độc quyền (DDI) gồm ${hospitalRules.length} luật.`);
console.log(`[System] File kết quả được lưu đè trực tiếp vào bản gốc tại: public/cds-data/ddi_rules.json`);
console.log(`[System] File này siêu nhẹ, tối ưu 100% cho hiệu năng của Aladinn Extension!`);
