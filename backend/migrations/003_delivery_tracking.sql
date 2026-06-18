-- ===============================================
-- DELIVERY TRACKING MIGRATION
-- ===============================================
-- Run this SQL manually in your PostgreSQL database
-- Database: salespfe
-- ===============================================

-- Add delivery columns to sales_order
ALTER TABLE sales_order
ADD COLUMN IF NOT EXISTS tracking_number  VARCHAR(100),
ADD COLUMN IF NOT EXISTS delivery_company VARCHAR(100);

-- Index for tracking number lookups
CREATE INDEX IF NOT EXISTS idx_sales_order_tracking ON sales_order(tracking_number)
  WHERE tracking_number IS NOT NULL;

-- ===============================================
-- TO RESET (if needed)
-- ===============================================
-- ALTER TABLE sales_order DROP COLUMN IF EXISTS tracking_number;
-- ALTER TABLE sales_order DROP COLUMN IF EXISTS delivery_company;
