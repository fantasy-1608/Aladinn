/**
 * 🧞 Aladinn — Tests: Shared Crypto Module
 * Tests for PIN hashing, API key encryption/decryption
 */

const T = window.T;

// ========================================
// INLINE CRYPTO (mirrors content/shared/crypto.js for testing outside extension)
// ========================================
const TestCrypto = {
    ITERATIONS: 100000,
    KEY_LENGTH: 256,

    generateSalt() {
        const salt = crypto.getRandomValues(new Uint8Array(16));
        return btoa(String.fromCharCode(...salt));
    },

    async hashPIN(pin, salt) {
        const encoder = new TextEncoder();
        const pinData = encoder.encode(pin);
        const saltData = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
        const baseKey = await crypto.subtle.importKey('raw', pinData, 'PBKDF2', false, ['deriveBits']);
        const hashBits = await crypto.subtle.deriveBits(
            { name: 'PBKDF2', salt: saltData, iterations: this.ITERATIONS, hash: 'SHA-256' },
            baseKey, this.KEY_LENGTH
        );
        return btoa(String.fromCharCode(...new Uint8Array(hashBits)));
    },

    async deriveKey(pin, salt) {
        const encoder = new TextEncoder();
        const pinData = encoder.encode(pin);
        const saltData = Uint8Array.from(atob(salt), c => c.charCodeAt(0));
        const baseKey = await crypto.subtle.importKey('raw', pinData, 'PBKDF2', false, ['deriveKey']);
        return crypto.subtle.deriveKey(
            { name: 'PBKDF2', salt: saltData, iterations: this.ITERATIONS, hash: 'SHA-256' },
            baseKey,
            { name: 'AES-GCM', length: this.KEY_LENGTH },
            false, ['encrypt', 'decrypt']
        );
    },

    async encrypt(plaintext, key) {
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const encoded = new TextEncoder().encode(plaintext);
        const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
        return btoa(String.fromCharCode(...iv)) + ':' + btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
    },

    async decrypt(encryptedText, key) {
        if (!encryptedText || !encryptedText.includes(':')) return null;
        const [ivB64, cipherB64] = encryptedText.split(':');
        const iv = Uint8Array.from(atob(ivB64), c => c.charCodeAt(0));
        const ciphertext = Uint8Array.from(atob(cipherB64), c => c.charCodeAt(0));
        const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, ciphertext);
        return new TextDecoder().decode(decrypted);
    }
};

// ========================================
// TESTS
// ========================================

T.describe('🔐 Crypto: Salt Generation', () => {
    T.it('generateSalt returns a base64 string', () => {
        const salt = TestCrypto.generateSalt();
        T.assertTruthy(salt, 'Salt should not be empty');
        T.assert(salt.length > 10, 'Salt should be a reasonable length');
    });

    T.it('generateSalt returns unique values', () => {
        const s1 = TestCrypto.generateSalt();
        const s2 = TestCrypto.generateSalt();
        T.assertNotEqual(s1, s2, 'Two salts should be different');
    });
});

T.describe('🔐 Crypto: PIN Hashing (PBKDF2)', () => {
    T.it('hashPIN returns a consistent hash for the same input', async () => {
        const salt = TestCrypto.generateSalt();
        const h1 = await TestCrypto.hashPIN('123456', salt);
        const h2 = await TestCrypto.hashPIN('123456', salt);
        T.assertEqual(h1, h2, 'Same PIN + salt should produce same hash');
    });

    T.it('hashPIN returns different hashes for different PINs', async () => {
        const salt = TestCrypto.generateSalt();
        const h1 = await TestCrypto.hashPIN('123456', salt);
        const h2 = await TestCrypto.hashPIN('654321', salt);
        T.assertNotEqual(h1, h2, 'Different PINs should produce different hashes');
    });

    T.it('hashPIN returns different hashes for different salts', async () => {
        const s1 = TestCrypto.generateSalt();
        const s2 = TestCrypto.generateSalt();
        const h1 = await TestCrypto.hashPIN('123456', s1);
        const h2 = await TestCrypto.hashPIN('123456', s2);
        T.assertNotEqual(h1, h2, 'Same PIN with different salts should produce different hashes');
    });

    T.it('hash is not the plaintext PIN', async () => {
        const salt = TestCrypto.generateSalt();
        const hash = await TestCrypto.hashPIN('123456', salt);
        T.assertNotEqual(hash, '123456', 'Hash should not equal the original PIN');
    });
});

T.describe('🔐 Crypto: AES-GCM Encrypt/Decrypt', () => {
    T.it('encrypt then decrypt returns original text', async () => {
        const salt = TestCrypto.generateSalt();
        const key = await TestCrypto.deriveKey('123456', salt);
        const original = 'AIzaSyB-test-api-key-12345';
        const encrypted = await TestCrypto.encrypt(original, key);
        const decrypted = await TestCrypto.decrypt(encrypted, key);
        T.assertEqual(decrypted, original, 'Decrypted should match original');
    });

    T.it('encrypted format is iv:ciphertext', async () => {
        const salt = TestCrypto.generateSalt();
        const key = await TestCrypto.deriveKey('123456', salt);
        const encrypted = await TestCrypto.encrypt('test', key);
        T.assert(encrypted.includes(':'), 'Encrypted text should contain : separator');
        const parts = encrypted.split(':');
        T.assertEqual(parts.length, 2, 'Should have exactly 2 parts');
    });

    T.it('each encryption produces a different ciphertext (random IV)', async () => {
        const salt = TestCrypto.generateSalt();
        const key = await TestCrypto.deriveKey('123456', salt);
        const e1 = await TestCrypto.encrypt('same text', key);
        const e2 = await TestCrypto.encrypt('same text', key);
        T.assertNotEqual(e1, e2, 'Each encryption should use random IV');
    });

    T.it('wrong key cannot decrypt', async () => {
        const salt = TestCrypto.generateSalt();
        const key1 = await TestCrypto.deriveKey('123456', salt);
        const key2 = await TestCrypto.deriveKey('999999', salt);
        const encrypted = await TestCrypto.encrypt('secret', key1);
        
        let failed = false;
        try {
            await TestCrypto.decrypt(encrypted, key2);
        } catch (e) {
            failed = true;
        }
        T.assert(failed, 'Decryption with wrong key should fail');
    });

    T.it('handles empty string gracefully', async () => {
        const result = await TestCrypto.decrypt(null, null);
        T.assertEqual(result, null, 'Null input should return null');
    });
});

T.describe('🔐 Crypto: PIN Verification Flow', () => {
    T.it('full flow: set PIN → verify correct → verify wrong', async () => {
        const pin = '567890';
        const salt = TestCrypto.generateSalt();
        
        // Hash
        const hash = await TestCrypto.hashPIN(pin, salt);
        
        // Verify correct
        const correctHash = await TestCrypto.hashPIN(pin, salt);
        T.assertEqual(correctHash, hash, 'Correct PIN should match');
        
        // Verify wrong
        const wrongHash = await TestCrypto.hashPIN('000000', salt);
        T.assertNotEqual(wrongHash, hash, 'Wrong PIN should not match');
    });

    T.it('full flow: encrypt API key with PIN → decrypt with same PIN', async () => {
        const pin = '123456';
        const salt = TestCrypto.generateSalt();
        const apiKey = 'AIzaSyB-real-api-key-example';
        
        // Encrypt
        const key = await TestCrypto.deriveKey(pin, salt);
        const encrypted = await TestCrypto.encrypt(apiKey, key);
        
        // Decrypt with new key from same PIN+salt
        const key2 = await TestCrypto.deriveKey(pin, salt);
        const decrypted = await TestCrypto.decrypt(encrypted, key2);
        
        T.assertEqual(decrypted, apiKey, 'Should recover original API key');
    });
});
