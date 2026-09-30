// ═══════════════════════════════════════════════════════════
// KONNECT PAYMENT GATEWAY — Tunisian payment aggregator
// Docs: https://docs.konnect.network/docs/fr/overview/getting-started
//
// Credentials are per-deployment (each business owner's own Konnect
// account), stored encrypted in payment_settings and passed in by the
// caller — see backend/services/paymentSettings.js — rather than read
// from process.env here.
// ═══════════════════════════════════════════════════════════

const DEFAULT_BASE_URL = process.env.KONNECT_BASE_URL || 'https://api.preprod.konnect.network/api/v2';

// Creates a payment link. Amount is in TND (converted to millimes here).
// Returns { payUrl, paymentRef }.
async function initPayment({ apiKey, walletId, baseUrl, amountTND, orderId, description, firstName, lastName, email, phoneNumber, webhookUrl }) {
  if (!apiKey || !walletId) {
    throw new Error('Konnect is not configured for this account yet.');
  }

  const res = await fetch(`${baseUrl || DEFAULT_BASE_URL}/payments/init-payment`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
    },
    body: JSON.stringify({
      receiverWalletId: walletId,
      token: 'TND',
      amount: Math.round(amountTND * 1000), // millimes
      type: 'immediate',
      description,
      acceptedPaymentMethods: ['bank_card', 'e-DINAR'],
      lifespan: 30, // minutes
      checkoutForm: false,
      firstName: firstName || undefined,
      lastName: lastName || undefined,
      email: email || undefined,
      phoneNumber: phoneNumber || undefined,
      orderId: String(orderId),
      webhook: webhookUrl,
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.message || 'Konnect init-payment request failed');
  }
  return data; // { payUrl, paymentRef }
}

// Fetches the authoritative status of a payment from Konnect.
// Returns the `payment` object — payment.status is "completed" once paid.
async function getPaymentDetails({ apiKey, baseUrl, paymentRef }) {
  if (!apiKey) {
    throw new Error('Konnect is not configured for this account yet.');
  }

  const res = await fetch(`${baseUrl || DEFAULT_BASE_URL}/payments/${paymentRef}`, {
    headers: { 'x-api-key': apiKey },
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.errors?.[0]?.message || 'Konnect payment-details request failed');
  }
  return data.payment;
}

module.exports = { initPayment, getPaymentDetails };
