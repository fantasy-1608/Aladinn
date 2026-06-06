/**
 * 🏺 Aladinn — Chrome Web Store Packaging Script
 * 
 * Creates a clean ZIP from dist/ for Chrome Web Store submission.
 * Only includes files Chrome needs to run the extension.
 * 
 * Usage: node scripts/package-cws.js
 * Output: dist-zip/Aladinn-v{version}-cws.zip
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

function generateChecksum(filePath) {
    const fileBuffer = fs.readFileSync(filePath);
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    return hashSum.digest('hex');
}

function getZipSizeMB(filePath) {
    const stats = fs.statSync(filePath);
    return (stats.size / (1024 * 1024)).toFixed(2);
}

console.log('='.repeat(55));
console.log('📦 Aladinn — Chrome Web Store Packaging');
console.log('='.repeat(55));

// ── Step 1: Read version ──
const manifestPath = path.join(ROOT, 'manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const version = manifest.version;
console.log(`\n📋 Version: ${version}`);
console.log(`📋 Name: ${manifest.name}`);

// ── Step 2: Build ──
console.log('\n🔨 [1/4] Building with Vite...');
try {
    execSync('npm run build', { stdio: 'inherit', cwd: ROOT });
} catch (err) {
    console.error('❌ Build failed! Fix errors before packaging.');
    process.exit(1);
}

// Verify build output
const distManifest = path.join(ROOT, 'dist', 'manifest.json');
if (!fs.existsSync(distManifest)) {
    console.error('❌ Build output missing: dist/manifest.json');
    process.exit(1);
}
console.log('✅ Build successful.');

// ── Step 3: Validate dist/ contents ──
console.log('\n🔍 [2/4] Validating dist/ contents...');

// Check no dev files leaked into dist/
const FORBIDDEN_IN_DIST = [
    '.git', 'node_modules', '.env', 'package.json', 'pnpm-lock.yaml',
    'vite.config.mjs', 'eslint.config.js', 'CHROMEWEBSTORE.md',
    'AGENTS.md', 'CLAUDE.md', 'README.md', 'CHANGELOG.md',
    '__tests__', 'tests', 'coverage', '.DS_Store'
];

const distContents = fs.readdirSync(path.join(ROOT, 'dist'));
const leakedFiles = distContents.filter(f => FORBIDDEN_IN_DIST.includes(f));
if (leakedFiles.length > 0) {
    console.warn(`⚠️  Warning: Found dev files in dist/: ${leakedFiles.join(', ')}`);
    console.warn('   These will be excluded from the CWS ZIP.');
}

// Verify manifest.json in dist is valid
const distManifestContent = JSON.parse(fs.readFileSync(distManifest, 'utf8'));
if (distManifestContent.manifest_version !== 3) {
    console.error('❌ dist/manifest.json is not Manifest V3!');
    process.exit(1);
}
console.log('✅ dist/ validation passed.');

// ── Step 4: Create CWS ZIP ──
console.log(`\n📦 [3/4] Creating CWS ZIP: Aladinn-v${version}-cws.zip`);

const distZipDir = path.join(ROOT, 'dist-zip');
if (!fs.existsSync(distZipDir)) {
    fs.mkdirSync(distZipDir, { recursive: true });
}

const zipFileName = `Aladinn-v${version}-cws.zip`;
const zipPath = path.join(distZipDir, zipFileName);
if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
}

// Create clean ZIP from dist/ — exclude any dev artifacts that might have leaked
execSync(
    `cd dist && zip -r "../dist-zip/${zipFileName}" . ` +
    `-x "*.DS_Store" ` +
    `-x "*.map" ` +
    `-x "__tests__/*" ` +
    `-x "tests/*" ` +
    `-x "*.test.*" ` +
    `-x "*.spec.*" ` +
    `-x "CHROMEWEBSTORE.md" ` +
    `-x "README.md" ` +
    `-x "CHANGELOG.md" ` +
    `-x "AGENTS.md" ` +
    `-x "CLAUDE.md" ` +
    `-x ".git/*" ` +
    `-x "node_modules/*" ` +
    `-x ".env" ` +
    `-x "store-assets/*"`,
    { stdio: 'inherit', cwd: ROOT }
);

if (!fs.existsSync(zipPath)) {
    console.error(`❌ Failed to create: ${zipPath}`);
    process.exit(1);
}

// ── Step 5: Report ──
console.log(`\n📊 [4/4] Package Report`);
const sizeMB = getZipSizeMB(zipPath);
const checksum = generateChecksum(zipPath);

console.log('─'.repeat(55));
console.log(`  📁 File:     ${zipFileName}`);
console.log(`  📏 Size:     ${sizeMB} MB`);
console.log(`  🔒 SHA-256:  ${checksum}`);
console.log('─'.repeat(55));

// Validate size (CWS limit is 2GB but should be much smaller)
if (parseFloat(sizeMB) > 50) {
    console.warn('⚠️  Warning: ZIP is larger than 50MB. Consider optimizing assets.');
}

if (parseFloat(sizeMB) > 2048) {
    console.error('❌ ZIP exceeds Chrome Web Store 2GB limit!');
    process.exit(1);
}

console.log(`\n✅ Ready to upload to Chrome Web Store!`);
console.log(`\n📋 Next steps:`);
console.log(`   1. Go to https://chrome.google.com/webstore/devconsole`);
console.log(`   2. Click "New Item" → Upload ${zipFileName}`);
console.log(`   3. Fill in store listing from CHROMEWEBSTORE.md`);
console.log(`   4. Add screenshots from store-assets/`);
console.log(`   5. Set visibility to "Unlisted"`);
console.log(`   6. Submit for review`);
console.log('');
