const pool = require('../db');
const { encrypt, decrypt } = require('../crypto');

// Single-tenant deployment → one settings row (id=1). Returns null if never configured.
async function getRawSettings() {
  const result = await pool.query('SELECT * FROM payment_settings WHERE id = 1');
  return result.rows[0] || null;
}

// Decrypted Konnect credentials ready to hand to konnect.js, or null if not usable
// (never configured, or configured but turned off).
async function getActiveCredentials() {
  const row = await getRawSettings();
  if (!row || !row.konnect_enabled || !row.api_key_encrypted || !row.wallet_id_encrypted) return null;
  return {
    apiKey: decrypt(row.api_key_encrypted),
    walletId: decrypt(row.wallet_id_encrypted),
  };
}

// Bank transfer details to show the client, or null if not enabled.
async function getBankTransferInfo() {
  const row = await getRawSettings();
  if (!row || !row.bank_enabled || !row.bank_rib) return null;
  return {
    bankName: row.bank_name,
    rib: row.bank_rib,
    holder: row.bank_holder,
    instructions: row.bank_instructions,
  };
}

async function upsertKonnectSettings({ apiKey, walletId, enabled, updatedBy }) {
  await pool.query(
    `INSERT INTO payment_settings (id, provider, api_key_encrypted, wallet_id_encrypted, konnect_enabled, updated_by, updated_at)
     VALUES (1, 'konnect', $1, $2, $3, $4, NOW())
     ON CONFLICT (id) DO UPDATE SET
       api_key_encrypted = COALESCE($1, payment_settings.api_key_encrypted),
       wallet_id_encrypted = COALESCE($2, payment_settings.wallet_id_encrypted),
       konnect_enabled = $3,
       updated_by = $4,
       updated_at = NOW()`,
    [encrypt(apiKey), encrypt(walletId), !!enabled, updatedBy]
  );
}

async function upsertBankSettings({ bankName, rib, holder, instructions, enabled, updatedBy }) {
  await pool.query(
    `INSERT INTO payment_settings (id, bank_name, bank_rib, bank_holder, bank_instructions, bank_enabled, updated_by, updated_at)
     VALUES (1, $1, $2, $3, $4, $5, $6, NOW())
     ON CONFLICT (id) DO UPDATE SET
       bank_name = COALESCE($1, payment_settings.bank_name),
       bank_rib = COALESCE($2, payment_settings.bank_rib),
       bank_holder = COALESCE($3, payment_settings.bank_holder),
       bank_instructions = COALESCE($4, payment_settings.bank_instructions),
       bank_enabled = $5,
       updated_by = $6,
       updated_at = NOW()`,
    [bankName, rib, holder, instructions, !!enabled, updatedBy]
  );
}

module.exports = { getRawSettings, getActiveCredentials, getBankTransferInfo, upsertKonnectSettings, upsertBankSettings };
