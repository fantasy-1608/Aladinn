const fs = require('fs');
const path = require('path');

const jsonPath = path.join(__dirname, '../public/cds-data/nhic_ddi_rules.json');
const csvPath = path.join(__dirname, '../public/cds-data/nhic_ddi_rules.csv');

if (!fs.existsSync(jsonPath)) {
    console.error("❌ Không tìm thấy file JSON tương tác thuốc!");
    process.exit(1);
}

try {
    const rules = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
    
    // Header CSV
    const headers = [
        'Mã quy tắc (rule_code)',
        'Hoạt chất A (generic_a)',
        'Hoạt chất B (generic_b)',
        'Mức độ (severity)',
        'Mức độ gốc (nhic_severity_raw)',
        'Hậu quả lâm sàng (clinical_effect)',
        'Cơ chế (mechanism)',
        'Khuyến cáo xử trí (recommendation)',
        'NHIC UID'
    ];
    
    // Hàm escape nội dung CSV
    const escapeCsv = (val) => {
        if (val === null || val === undefined) return '';
        let str = String(val).replace(/"/g, '""'); // Escape dấu nháy kép
        if (str.includes(',') || str.includes('\n') || str.includes('"')) {
            str = `"${str}"`;
        }
        return str;
    };
    
    const csvRows = [];
    csvRows.push(headers.join(','));
    
    for (const rule of rules) {
        const row = [
            rule.rule_code,
            rule.generic_a,
            rule.generic_b,
            rule.severity,
            rule.nhic_severity_raw,
            rule.clinical_effect,
            rule.mechanism,
            rule.recommendation,
            rule.nhic_uid
        ];
        csvRows.push(row.map(escapeCsv).join(','));
    }
    
    // Thêm BOM (Byte Order Mark) UTF-8 để Excel hiển thị đúng tiếng Việt có dấu
    fs.writeFileSync(csvPath, '\ufeff' + csvRows.join('\n'), 'utf8');
    
    console.log(`✅ Chuyển đổi thành công!`);
    console.log(`👉 File CSV đã lưu tại: ${csvPath}`);
} catch (e) {
    console.error("❌ Lỗi chuyển đổi sang CSV:", e.message);
}
