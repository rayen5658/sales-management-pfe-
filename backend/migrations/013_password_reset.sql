-- ===============================================
-- PASSWORD RESET (Admin/Staff)
-- ===============================================
-- Adds a hashed reset token + expiry to app_user, used by
-- POST /api/auth/forgot-password and POST /api/auth/reset-password.
-- ===============================================

ALTER TABLE app_user
ADD COLUMN IF NOT EXISTS reset_token_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS reset_token_expires TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_app_user_reset_token ON app_user(reset_token_hash);
