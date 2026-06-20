#!/usr/bin/env node
/**
 * 🧞 Aladinn CDS — Master Update Pipeline
 * 
 * Quy trình tự động hóa hoàn toàn từ đầu đến cuối:
 * 1. Đồng bộ thuốc mới từ thư mục Downloads.
 * 2. Cập nhật ánh xạ hoạt chất (Brand mapping) cho biệt dược.
 * 3. Chạy crawler cào các tương tác mới từ CSDL Quốc gia NHIC (chế độ resume).
 * 4. Gộp quy tắc mới vào cơ sở dữ liệu và nâng cấp seed version.
 * 5. Chạy pipeline tối ưu hóa quy tắc (lọc theo thuốc hiện có để giảm dung lượng).
 * 6. Build lại extension để cập nhật bản phân phối mới.
 * 
 * Cách dùng:
 * pnpm run process:nhic
 */

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

console.log('\n======================================================================');
console.log('🧞 STARTING ALADINN CDS MASTER UPDATE PIPELINE');
console.log('======================================================================\n');

const runStep = (name, command) => {
    console.log(`\n⏳ [STEP] ${name}`);
    console.log(`👉 Running: ${command}`);
    try {
        execSync(command, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
        console.log(`✅ [STEP SUCCESS] ${name} completed successfully.`);
    } catch (e) {
        console.error(`\n❌ [STEP FAILED] ${name} failed!`);
        console.error(e.message);
        process.exit(1);
    }
};

const startTime = Date.now();

// Bước 1: Đồng bộ file thuốc mới tải về
runStep("Sync new drugs from Downloads", "node scripts/sync-drugs.cjs");

// Bước 2: Tạo/Cập nhật ánh xạ biệt dược -> hoạt chất
runStep("Update brand-to-generic mappings", "node scripts/build_brand_map.cjs");

// Bước 3: Chạy crawler cào dữ liệu mới từ NHIC (chỉ cào những hoạt chất chưa có trong checkpoint)
runStep("Crawl new interactions from NHIC (Resume mode)", "node scripts/crawl_nhic_ddi.cjs --resume");

// Bước 4: Gộp tương tác NHIC vào hệ thống và kích hoạt re-seed version
runStep("Merge NHIC rules and update DB seed version", "node scripts/merge_nhic_rules.cjs");

// Bước 5: Chạy dược sĩ AI lọc quy tắc tối ưu hóa cho kho bệnh viện
runStep("Run AI Pharmacist pipeline (Optimize payload)", "node scripts/ai-pharmacist-pipeline.cjs");

// Bước 6: Build lại Extension
runStep("Build Vite Production Extension Bundle", "npm run build");

const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
console.log('\n======================================================================');
console.log(`🎉 PIPELINE COMPLETED SUCCESSFULLY IN ${totalTime}s!`);
console.log('🧞 Aladinn CDS is now updated and ready to use.');
console.log('======================================================================\n');
