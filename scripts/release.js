import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read version from package.json
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

const distZipDir = path.join(__dirname, '../dist-zip');

console.log(`\n📦 Bắt đầu đóng gói Release v${version}\n`);
console.log('='.repeat(50));

console.log('\n🔨 [1/3] Build dự án bằng Vite...');
execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

// Tạo thư mục dist-zip nếu chưa có
if (fs.existsSync(distZipDir)) {
    fs.rmSync(distZipDir, { recursive: true, force: true });
}
fs.mkdirSync(distZipDir, { recursive: true });

console.log(`\n📦 [2/3] Đóng gói Aladinn-v${version}.zip...`);
const zipPath = `../dist-zip/Aladinn-v${version}.zip`;
execSync(
    `cd dist && zip -r "${zipPath}" . -x "*.DS_Store"`,
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
);

console.log('\n🚀 [3/3] Đẩy lên Github Release...');
try {
    const latestCommitMsg = execSync('git log -1 --pretty=%B').toString().trim();
    const tempNotesPath = path.join(__dirname, '..', '.commit-notes.tmp');
    try {
        fs.writeFileSync(tempNotesPath, latestCommitMsg);
        const ghCommand = `export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin && gh release create v${version} dist-zip/Aladinn-v${version}.zip --title "Aladinn v${version}" --notes-file ".commit-notes.tmp"`;
        execSync(ghCommand, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
        console.log('\n✅ Hoàn tất! Đã release v' + version + ' thành công lên GitHub!');
    } finally {
        if (fs.existsSync(tempNotesPath)) {
            fs.unlinkSync(tempNotesPath);
        }
    }
} catch (_err) {
    console.log('\n⚠️ Lỗi khi đẩy lên GitHub Release. Vui lòng kiểm tra lại quá trình xác thực \'gh\' CLI.');
    console.error(_err.message || _err);
}

console.log('\n' + '='.repeat(50));
