-- ===============================================
-- DELIVERY TRACKING — add estimated_delivery
-- ===============================================
-- Run this SQL manually in your PostgreSQL database
-- Database: salespfe
-- ===============================================

ALTER TABLE sales_order
ADD COLUMN IF NOT EXISTS estimated_delivery DATE;

-- Optional index if you query by this column later
CREATE INDEX IF NOT EXISTS idx_sales_order_estimated_delivery
  ON sales_order(estimated_delivery);

-- ===============================================
-- TO RESET (if needed - WARNING: DELETES DATA!)
-- ===============================================
-- ALTER TABLE sales_order DROP COLUMN IF EXISTS estimated_delivery;

