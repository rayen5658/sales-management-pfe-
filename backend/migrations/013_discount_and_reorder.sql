-- ===============================================
-- MIGRATION 013: Discount per order + reorder level per product
-- Run once against your PostgreSQL database.
-- ===============================================

-- 1. Order-level discount (0–100 %) — stored as a percentage, computed
--    before tax so discount_amount = amount_ht_before_discount * discount_percent/100
--    and the final amount_ht = amount_ht_before_discount - discount_amount.
ALTER TABLE sales_order
  ADD COLUMN IF NOT EXISTS discount_percent  NUMERIC(5,2) DEFAULT 0,   -- 0.00 – 100.00
  ADD COLUMN IF NOT EXISTS discount_amount   NUMERIC(12,2) DEFAULT 0;  -- cached monetary value

-- 2. Per-product reorder threshold. When a confirmed order causes stock to
--    fall AT OR BELOW this level, a restock alert email fires automatically.
--    NULL means no alert configured for that product.
ALTER TABLE product
  ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT NULL;

-- 2b. Same for product variants.
ALTER TABLE product_variant
  ADD COLUMN IF NOT EXISTS reorder_level INTEGER DEFAULT NULL;
