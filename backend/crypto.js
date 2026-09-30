// ═══════════════════════════════════════════════════════════
// Encryption helper for secrets stored at rest (e.g. payment gateway
// credentials in payment_settings). AES-256-GCM with a key derived from
// ENCRYPTION_KEY (32-byte hex, recommended) or, if unset, from JWT_SECRET
// so existing deployments keep working without extra setup.
// ═══════════════════════════════════════════════════════════

const crypto = require('crypto');

function getKey() {
  const raw = process.env.ENCRYPTION_KEY;
  if (raw) {
    const key = Buffer.from(raw, 'hex');
    if (key.length === 32) return key;
  }
  if (!process.env.JWT_SECRET) {
    throw new Error('Cannot derive encryption key: set ENCRYPTION_KEY or JWT_SECRET in .env');
  }
  return crypto.scryptSync(process.env.JWT_SECRET, 'gestionventes-payment-settings', 32);
}

// Returns "iv:authTag:ciphertext" (all hex), or null if given a falsy value.
function encrypt(plaintext) {
  if (!plaintext) return null;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${authTag.toString('hex')}:${ciphertext.toString('hex')}`;
}

// Reverses encrypt(). Returns null if given a falsy value.
function decrypt(payload) {
  if (!payload) return null;
  const [ivHex, authTagHex, ciphertextHex] = payload.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(ciphertextHex, 'hex')), decipher.final()]);
  return plaintext.toString('utf8');
}

module.exports = { encrypt, decrypt };
