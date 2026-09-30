const { handleControllerError, handleValidationErrors, writeAuditLog } = require('./shared');
const paymentSettingsService = require('../services/paymentSettings');
const { decrypt } = require('../crypto');

// Never send the full secret back to the browser — just enough to recognize
// which credential is saved (e.g. "••••4821"), same convention Stripe/most
// payment dashboards use.
const last4 = (encrypted) => {
  if (!encrypted) return null;
  try {
    const plain = decrypt(encrypted);
    return plain.slice(-4);
  } catch {
    return null;
  }
};

// GET /api/payment-settings — Konnect key/wallet are never returned in full
// (just last 4 chars). Bank fields aren't secret — a RIB is meant to be
// shown to customers — so those come back as-is.
const getPaymentSettings = async (req, res) => {
  try {
    const row = await paymentSettingsService.getRawSettings();
    res.json({
      konnect_enabled: !!row?.konnect_enabled,
      has_api_key: !!row?.api_key_encrypted,
      has_wallet_id: !!row?.wallet_id_encrypted,
      api_key_last4: last4(row?.api_key_encrypted),
      wallet_id_last4: last4(row?.wallet_id_encrypted),
      bank_enabled: !!row?.bank_enabled,
      bank_name: row?.bank_name || '',
      bank_rib: row?.bank_rib || '',
      bank_holder: row?.bank_holder || '',
      bank_instructions: row?.bank_instructions || '',
      updated_at: row?.updated_at || null,
    });
  } catch (error) {
    handleControllerError(res, error);
  }
};

// PUT /api/payment-settings — body: { api_key?, wallet_id?, konnect_enabled,
//                                      bank_name?, bank_rib?, bank_holder?, bank_instructions?, bank_enabled }
// api_key/wallet_id are optional so the admin can flip konnect_enabled without
// re-pasting credentials that are already saved. Bank fields are plain text.
const updatePaymentSettings = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { api_key, wallet_id, konnect_enabled, bank_name, bank_rib, bank_holder, bank_instructions, bank_enabled } = req.body;

    const existing = await paymentSettingsService.getRawSettings();

    if (konnect_enabled && !api_key && !existing?.api_key_encrypted) {
      return res.status(400).json({ message: 'Add your Konnect API key before enabling online card payments' });
    }
    if (konnect_enabled && !wallet_id && !existing?.wallet_id_encrypted) {
      return res.status(400).json({ message: 'Add your Konnect wallet ID before enabling online card payments' });
    }
    if (bank_enabled && !bank_rib && !existing?.bank_rib) {
      return res.status(400).json({ message: 'Add your bank account details (RIB) before enabling bank transfer' });
    }

    await paymentSettingsService.upsertKonnectSettings({
      apiKey: api_key,
      walletId: wallet_id,
      enabled: konnect_enabled,
      updatedBy: req.user.id,
    });
    await paymentSettingsService.upsertBankSettings({
      bankName: bank_name,
      rib: bank_rib,
      holder: bank_holder,
      instructions: bank_instructions,
      enabled: bank_enabled,
      updatedBy: req.user.id,
    });

    await writeAuditLog(
      req.user.id,
      'payment_settings.update',
      `Card payments ${konnect_enabled ? 'enabled' : 'disabled'}, bank transfer ${bank_enabled ? 'enabled' : 'disabled'}`
    );

    res.json({ message: 'Payment settings saved' });
  } catch (error) {
    handleControllerError(res, error);
  }
};

module.exports = { getPaymentSettings, updatePaymentSettings };
