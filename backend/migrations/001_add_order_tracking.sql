-- ===============================================
-- ORDER TRACKING SYSTEM MIGRATION
-- ===============================================
-- Run this SQL manually in your PostgreSQL database
-- Database: salespfe
-- User: postgres
-- ===============================================

-- Step 1: Create order status history table
CREATE TABLE IF NOT EXISTS order_status_history (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES sales_order(id) ON DELETE CASCADE,
  previous_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  changed_by INTEGER REFERENCES app_user(id),
  changed_at TIMESTAMP DEFAULT NOW(),
  notes VARCHAR(500)
);

-- Step 2: Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_order_status_history_order_id 
  ON order_status_history(order_id);

CREATE INDEX IF NOT EXISTS idx_order_status_history_changed_at 
  ON order_status_history(changed_at);

-- Step 3: Add updated_at column to sales_order if missing
ALTER TABLE sales_order 
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- ===============================================
-- VERIFICATION COMMANDS (Run these to verify)
-- ===============================================

-- Check if order_status_history table exists:
-- \dt order_status_history

-- Check table structure:
-- \d order_status_history

-- Check indexes:
-- SELECT * FROM pg_indexes WHERE tablename = 'order_status_history';

-- ===============================================
-- TO RESET (if needed - WARNING: DELETES DATA!)
-- ===============================================
-- DROP TABLE IF EXISTS order_status_history CASCADE;
-- ALTER TABLE sales_order DROP COLUMN IF EXISTS updated_at;

