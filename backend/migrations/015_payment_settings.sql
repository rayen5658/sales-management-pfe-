-- ===============================================
-- PAYMENT SETTINGS (admin-configurable Konnect credentials)
-- ===============================================
-- Single-tenant deployment → one settings row (id always 1).
-- Lets the business owner plug in their own Konnect account from the
-- admin UI instead of editing .env by hand. Credentials are stored
-- encrypted (see backend/crypto.js) — never stored or returned in plaintext.
-- ===============================================

CREATE TABLE IF NOT EXISTS payment_settings (
  id INTEGER PRIMARY KEY DEFAULT 1,
  provider VARCHAR(20) NOT NULL DEFAULT 'konnect',
  api_key_encrypted TEXT,
  wallet_id_encrypted TEXT,
  enabled BOOLEAN NOT NULL DEFAULT false,
  updated_by INTEGER REFERENCES app_user(id),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_settings_singleton CHECK (id = 1)
);
