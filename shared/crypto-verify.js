/**
 * 🧞 Aladinn — Ed25519 Signature Verification (Web Crypto API)
 *
 * Verifies remote-config.json integrity using Ed25519 digital signatures.
 * Uses the Web Crypto API (crypto.subtle) for browser-native verification.
 *
 * SECURITY:
 * - Public key only (no private key in extension code)
 * - Fail-closed: returns false on any error
 * - No PHI involved in this module
 */

// ========================================
// PUBLIC KEY (Ed25519 SPKI DER, base64)
// This is the VERIFICATION-ONLY key.
// The signing key is kept offline in scripts/.
// ========================================
const ED25519_PUBLIC_KEY_SPKI_BASE64 =
    'MCowBQYDK2VwAyEAxxVmMCt1LyOIiHU+2KyEEcm1SGtlNvNVzZ7d/oIOwDc=';

/**
 * Import the embedded Ed25519 public key for verification.
 * @returns {Promise<CryptoKey>} The imported public key
 */
async function importPublicKey() {
    const spkiDer = base64ToArrayBuffer(ED25519_PUBLIC_KEY_SPKI_BASE64);
    return crypto.subtle.importKey(
        'spki',
        spkiDer,
        { name: 'Ed25519' },
        false,
        ['verify']
    );
}

/**
 * Verify an Ed25519 signature against config text.
 * @param {string} jsonText - The raw JSON text that was signed
 * @param {string} signatureBase64 - Base64-encoded Ed25519 signature
 * @returns {Promise<boolean>} true if signature is valid, false otherwise
 */
async function verifyConfigSignature(jsonText, signatureBase64) {
    if (!jsonText || !signatureBase64) {
        return false;
    }

    try {
        const publicKey = await importPublicKey();
        const signatureBuffer = base64ToArrayBuffer(signatureBase64);
        const dataBuffer = new TextEncoder().encode(jsonText);

        return await crypto.subtle.verify(
            { name: 'Ed25519' },
            publicKey,
            signatureBuffer,
            dataBuffer
        );
    } catch (_err) {
        // Fail-closed: any crypto error = invalid
        return false;
    }
}

/**
 * Decode a base64 string to an ArrayBuffer.
 * @param {string} base64 - Base64-encoded string
 * @returns {ArrayBuffer}
 */
function base64ToArrayBuffer(base64) {
    const binaryString = atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
}

export {
    verifyConfigSignature,
    ED25519_PUBLIC_KEY_SPKI_BASE64
};
