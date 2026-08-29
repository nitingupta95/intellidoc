/**
 * crypto.ts — AES-256-GCM encryption helpers for API keys at rest.
 *
 * Why AES-256-GCM:
 *  - AES-256: 256-bit key, no known practical attacks
 *  - GCM mode: authenticated encryption — generates an auth tag that detects
 *    any tampering with the ciphertext, unlike CBC which is malleable
 *  - Random IV per encryption: same plaintext produces different ciphertext
 *    each time, preventing frequency analysis
 *
 * Storage format: `<iv_hex>:<auth_tag_hex>:<ciphertext_hex>`
 * The encryption key (API_KEY_ENCRYPTION_KEY) must be a 64-char hex string
 * (32 bytes) stored in environment variables — never in the database.
 *
 * Generate a key:
 *   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
 */

import crypto from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_BYTES = 16;
const SEPARATOR = ':';

function getEncryptionKey(): Buffer {
  const keyHex = process.env.API_KEY_ENCRYPTION_KEY;
  if (!keyHex || keyHex.length !== 64) {
    throw new Error(
      'API_KEY_ENCRYPTION_KEY is missing or invalid. ' +
      'It must be a 64-character hex string (32 bytes). ' +
      'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    );
  }
  return Buffer.from(keyHex, 'hex');
}

/**
 * Encrypts a plaintext API key.
 * Returns a string in the format: iv:authTag:ciphertext (all hex-encoded).
 * A fresh random IV is generated for every call, so encrypting the same
 * key twice produces different output — preventing frequency analysis.
 */
export function encryptApiKey(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(IV_BYTES);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // GCM auth tag — must be stored alongside ciphertext to verify integrity
  const authTag = cipher.getAuthTag();

  return [
    iv.toString('hex'),
    authTag.toString('hex'),
    encrypted.toString('hex'),
  ].join(SEPARATOR);
}

/**
 * Decrypts a previously encrypted API key.
 * Throws if the ciphertext has been tampered with (GCM auth tag mismatch).
 */
export function decryptApiKey(ciphertext: string): string {
  const key = getEncryptionKey();
  const parts = ciphertext.split(SEPARATOR);

  if (parts.length !== 3) {
    throw new Error(
      `Invalid ciphertext format. Expected "iv:authTag:data", got ${parts.length} parts.`
    );
  }

  const [ivHex, tagHex, encryptedHex] = parts;

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivHex, 'hex')
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));

  return (
    decipher.update(Buffer.from(encryptedHex, 'hex')).toString('utf8') +
    decipher.final('utf8')
  );
}

/**
 * Returns true if the value looks like an encrypted ciphertext.
 * Use this to safely handle API keys that were saved before encryption was
 * introduced — they will be plaintext and should not be decrypted.
 *
 * A valid encrypted value has exactly 3 colon-separated hex segments:
 *   iv (32 chars) : authTag (32 chars) : ciphertext (variable)
 */
export function isEncrypted(value: string): boolean {
  const parts = value.split(SEPARATOR);
  if (parts.length !== 3) return false;
  // All parts must be valid hex strings
  return parts.every((p) => /^[0-9a-f]+$/i.test(p));
}

/**
 * Safe decrypt: if the value is not in encrypted format (e.g. a legacy
 * plaintext key stored before this fix was deployed), returns it as-is.
 * This allows a zero-downtime migration where old keys still work.
 */
export function safeDecryptApiKey(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!isEncrypted(value)) return value; // legacy plaintext — return as-is
  try {
    return decryptApiKey(value);
  } catch (err) {
    console.error('[crypto] Failed to decrypt API key:', err);
    return null;
  }
}
