#!/usr/bin/env node
/**
 * 🧞 Aladinn — Remote Config Signer (Offline CLI)
 *
 * Signs remote-config.json with an Ed25519 private key.
 * The signature file (remote-config.sig) is committed to the repo.
 * The private key MUST NOT be committed.
 *
 * Usage:
 *   node scripts/sign-config.js
 *   node scripts/sign-config.js --key path/to/private.pem
 *
 * Environment:
 *   ALADINN_SIGNING_KEY - Base64-encoded PKCS8 DER private key
 *
 * Output:
 *   remote-config.sig (base64-encoded Ed25519 signature)
 */

import { createPrivateKey, sign } from 'node:crypto';
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = resolve(__dirname, '..');

const CONFIG_PATH = resolve(PROJECT_ROOT, 'remote-config.json');
const SIG_PATH = resolve(PROJECT_ROOT, 'remote-config.sig');
const DEV_KEY_PATH = resolve(__dirname, 'dev-signing-key.base64');

/**
 * Parse CLI args for --key flag
 * @returns {string|null} Path to private key file
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const keyIndex = args.indexOf('--key');
    if (keyIndex !== -1 && args[keyIndex + 1]) {
        return resolve(args[keyIndex + 1]);
    }
    return null;
}

/**
 * Load the Ed25519 private key from env, CLI arg, or dev key file.
 * @returns {import('crypto').KeyObject} The private key
 */
function loadPrivateKey() {
    const keyFilePath = parseArgs();

    // Priority 1: CLI --key argument
    if (keyFilePath) {
        if (!existsSync(keyFilePath)) {
            throw new Error(`Key file not found: ${keyFilePath}`);
        }
        const keyData = readFileSync(keyFilePath, 'utf-8').trim();
        return importKeyFromBase64(keyData);
    }

    // Priority 2: Environment variable
    if (process.env.ALADINN_SIGNING_KEY) {
        return importKeyFromBase64(process.env.ALADINN_SIGNING_KEY);
    }

    // Priority 3: Dev key file (for local development only)
    if (existsSync(DEV_KEY_PATH)) {
        console.log('⚠️  Using development signing key (NOT for production)');
        const keyData = readFileSync(DEV_KEY_PATH, 'utf-8').trim();
        return importKeyFromBase64(keyData);
    }

    throw new Error(
        'No signing key found. Provide one via:\n' +
        '  --key path/to/private.base64\n' +
        '  ALADINN_SIGNING_KEY env var\n' +
        '  scripts/dev-signing-key.base64 (dev only)'
    );
}

/**
 * Import Ed25519 private key from base64-encoded PKCS8 DER.
 * @param {string} base64Key - Base64 PKCS8 DER
 * @returns {import('crypto').KeyObject}
 */
function importKeyFromBase64(base64Key) {
    const derBuffer = Buffer.from(base64Key, 'base64');
    return createPrivateKey({
        key: derBuffer,
        format: 'der',
        type: 'pkcs8'
    });
}

/**
 * Sign the config file and write the signature.
 */
function main() {
    console.log('🔐 Aladinn Config Signer\n');

    // Load config
    if (!existsSync(CONFIG_PATH)) {
        console.error(`❌ Config file not found: ${CONFIG_PATH}`);
        process.exit(1);
    }
    const configText = readFileSync(CONFIG_PATH, 'utf-8');
    console.log(`📄 Config: ${CONFIG_PATH} (${configText.length} bytes)`);

    // Validate JSON
    try {
        const parsed = JSON.parse(configText);
        console.log(`   Version: ${parsed.version}`);
        console.log(`   Features: ${Object.keys(parsed.features || {}).join(', ')}`);
    } catch {
        console.error('❌ Invalid JSON in remote-config.json');
        process.exit(1);
    }

    // Load signing key
    const privateKey = loadPrivateKey();
    console.log('🔑 Private key loaded');

    // Sign
    const signature = sign(null, Buffer.from(configText), privateKey);
    const signatureBase64 = signature.toString('base64');

    // Write signature file
    writeFileSync(SIG_PATH, signatureBase64, 'utf-8');
    console.log(`\n✅ Signature written to: ${SIG_PATH}`);
    console.log(`   Base64: ${signatureBase64.slice(0, 40)}...`);
    console.log(`   Length: ${signature.length} bytes`);
}

main();
