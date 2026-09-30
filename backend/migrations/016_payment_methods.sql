-- ===============================================
-- PAYMENT METHODS — bank transfer alongside Konnect
-- ===============================================
-- Adds a manual "bank transfer" path: the client sees the seller's bank
-- details and is expected to transfer offline; an admin then marks the
-- order paid once the funds show up. No external gateway involved.
-- ===============================================

ALTER TABLE sales_order
ADD COLUMN IF NOT EXISTS payment_method VARCHAR(20),
ADD COLUMN IF NOT EXISTS payment_note TEXT;

-- Clarify that the existing `enabled` flag was always Konnect-specific,
-- now that a second method (bank transfer) has its own flag.
ALTER TABLE payment_settings RENAME COLUMN enabled TO konnect_enabled;

ALTER TABLE payment_settings
ADD COLUMN IF NOT EXISTS bank_enabled BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS bank_name VARCHAR(200),
ADD COLUMN IF NOT EXISTS bank_rib VARCHAR(60),
ADD COLUMN IF NOT EXISTS bank_holder VARCHAR(200),
ADD COLUMN IF NOT EXISTS bank_instructions TEXT;
