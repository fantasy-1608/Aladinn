import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Helper for checksum
function generateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

console.log('=' + '='.repeat(50));
console.log('🚀 Bắt đầu Preflight Checks');
console.log('=' + '='.repeat(50));

// Read version from package.json
const pkgPath = path.join(__dirname, '../package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
const version = pkg.version;

// Read version from manifest.json
const manifestPath = path.join(__dirname, '../manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const manifestVersion = manifest.version;

console.log('[1] Kiểm tra đồng bộ version...');
if (version !== manifestVersion) {
    console.error(`❌ Version mismatch: package.json (v${version}) vs manifest.json (v${manifestVersion})`);
    process.exit(1);
}
console.log('✅ Version sync: OK (v' + version + ')');

console.log('\n[2] Kiểm tra Changelog entry...');
const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
let releaseNotes = '';
if (!fs.existsSync(changelogPath)) {
    console.error('❌ Không tìm thấy CHANGELOG.md');
    process.exit(1);
}
const changelog = fs.readFileSync(changelogPath, 'utf8');
const entryHeader = `## [${version}]`;
const startIdx = changelog.indexOf(entryHeader);

if (startIdx === -1) {
    console.error(`❌ Chưa có entry cho version [${version}] trong CHANGELOG.md`);
    process.exit(1);
}

// Extract notes
let endIdx = changelog.indexOf('\\n## [', startIdx + entryHeader.length);
if (endIdx === -1) endIdx = changelog.length;

releaseNotes = changelog.substring(startIdx + entryHeader.length, endIdx);
// cleanup the dash and date if any
releaseNotes = releaseNotes.replace(/^[^\\n]*\\n/, '').trim();
releaseNotes = releaseNotes.replace(/\\n---\\s*$/, '').trim();

if (!releaseNotes) {
    console.error(`❌ Changelog entry cho [${version}] trống!`);
    process.exit(1);
}
console.log('✅ Changelog entry: OK');

console.log('\n[3] Chạy Linter...');
try {
    execSync('npm run lint', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✅ Lint: PASS');
} catch (err) {
    console.error('❌ Linter fail. Vui lòng fix linter errors trước khi release.');
    process.exit(1);
}

console.log('\n[4] Chạy Unit Tests...');
try {
    execSync('npm run test', { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('✅ Test: PASS');
} catch (err) {
    console.error('❌ Tests fail. Vui lòng fix lỗi trước khi release.');
    process.exit(1);
}

console.log('\n' + '='.repeat(50));
console.log(`📦 Đóng gói Release v${version}`);
console.log('=' + '='.repeat(50));

console.log('\n🔨 [1/3] Build dự án bằng Vite...');
execSync('npm run build', { stdio: 'inherit', cwd: path.join(__dirname, '..') });

// Verify build artifacts
if (!fs.existsSync(path.join(__dirname, '../dist/manifest.json'))) {
    console.error('❌ Build thất bại: không tìm thấy dist/manifest.json');
    process.exit(1);
}
console.log('✅ Build thành công.');

// Tạo thư mục dist-zip nếu chưa có
const distZipDir = path.join(__dirname, '../dist-zip');
if (fs.existsSync(distZipDir)) {
    // Note: Do not remove the old zip to keep a rollback version!
    // Let's only remove if it's the exact same version being overwritten.
} else {
    fs.mkdirSync(distZipDir, { recursive: true });
}

console.log(`\n📦 [2/3] Đóng gói Aladinn-v${version}.zip...`);
const zipFileName = `Aladinn-v${version}.zip`;
const zipPath = path.join(distZipDir, zipFileName);
if (fs.existsSync(zipPath)) fs.unlinkSync(zipPath); // Overwrite if same version

execSync(
    `cd dist && zip -r "../dist-zip/${zipFileName}" . -x "*.DS_Store"`,
    { stdio: 'inherit', cwd: path.join(__dirname, '..') }
);

if (!fs.existsSync(zipPath)) {
    console.error(`❌ Tạo file nén thất bại: ${zipPath}`);
    process.exit(1);
}

const checksum = generateChecksum(zipPath);
console.log(`✅ File nén: ${zipFileName}`);
console.log(`✅ SHA-256 Checksum: ${checksum}`);

console.log('\n🚀 [3/3] Đẩy lên Github Release...');
const tempNotesPath = path.join(__dirname, '..', '.release-notes.tmp');
try {
    const fullNotes = `# 🏺 Aladinn v${version}\n\n${releaseNotes}\n\n---\n\n> 📥 Tải file \`Aladinn-v${version}.zip\` bên dưới → giải nén → Chrome → \`chrome://extensions\` → Load unpacked\n\n**SHA-256 Checksum:** \`${checksum}\``;
    fs.writeFileSync(tempNotesPath, fullNotes);
    const ghCommand = `export PATH=$PATH:/usr/local/bin:/opt/homebrew/bin && gh release create v${version} dist-zip/${zipFileName} --title "🏺 Aladinn v${version}" --notes-file ".release-notes.tmp"`;
    execSync(ghCommand, { stdio: 'inherit', cwd: path.join(__dirname, '..') });
    console.log('\n✅ Hoàn tất! Đã release v' + version + ' thành công lên GitHub!');
} catch (_err) {
    console.log('\n⚠️ Lỗi khi đẩy lên GitHub Release. Vui lòng kiểm tra lại quá trình xác thực \'gh\' CLI.');
    console.error(_err.message || _err);
} finally {
    if (fs.existsSync(tempNotesPath)) {
        fs.unlinkSync(tempNotesPath);
    }
}

console.log('\n' + '='.repeat(50));
