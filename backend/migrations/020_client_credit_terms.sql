-- ===============================================
-- CLIENT CREDIT LIMIT & PAYMENT TERMS
-- ===============================================
-- B2B clients often buy on credit (net 15/30/60) rather than paying
-- immediately. payment_terms is snapshotted onto each order as due_date at
-- creation time, so changing a client's terms later never rewrites history.
-- ===============================================

ALTER TABLE client
ADD COLUMN IF NOT EXISTS credit_limit NUMERIC(12,2), -- NULL = no credit extended (must pay immediately, no enforcement skipped)
ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(20) NOT NULL DEFAULT 'immediate'; -- immediate | net_15 | net_30 | net_60

ALTER TABLE sales_order
ADD COLUMN IF NOT EXISTS due_date DATE;
