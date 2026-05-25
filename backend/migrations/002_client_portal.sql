-- ===============================================
-- CLIENT PORTAL MIGRATION
-- ===============================================
-- Run this SQL manually in your PostgreSQL database
-- Database: salespfe
-- ===============================================

-- Step 1: Add password_hash to client table (for client self-login)
ALTER TABLE client
ADD COLUMN IF NOT EXISTS password_hash VARCHAR(255),
ADD COLUMN IF NOT EXISTS portal_enabled BOOLEAN DEFAULT FALSE;

-- Step 2: Index on client email for fast login lookups
CREATE INDEX IF NOT EXISTS idx_client_email ON client(email);

-- ===============================================
-- AFTER RUNNING: use the admin panel to set a
-- password for each client via the Clients page,
-- or run the backend endpoint POST /client-auth/set-password
-- ===============================================
