-- ===============================================
-- ONLINE PAYMENTS (Konnect)
-- ===============================================
-- Lets clients pay for an order online. payment_status is independent
-- from the existing fulfillment status (pending/confirmed/shipped/...).
-- ===============================================

ALTER TABLE sales_order
ADD COLUMN IF NOT EXISTS payment_status VARCHAR(20) NOT NULL DEFAULT 'unpaid',
ADD COLUMN IF NOT EXISTS payment_ref VARCHAR(100),
ADD COLUMN IF NOT EXISTS paid_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_sales_order_payment_ref ON sales_order(payment_ref);
