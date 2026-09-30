-- ===============================================
-- SUPPLIERS & PURCHASE ORDERS — the restocking side of the business
-- ===============================================
-- Mirrors the sales_order / order_line pattern in reverse: instead of selling
-- stock down, a purchase order brings stock back up once marked "received".
-- ===============================================

CREATE TABLE IF NOT EXISTS supplier (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(200),
  email VARCHAR(200),
  phone VARCHAR(50),
  address TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active', -- active | inactive
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS purchase_order (
  id SERIAL PRIMARY KEY,
  supplier_id INTEGER REFERENCES supplier(id),
  user_id INTEGER REFERENCES app_user(id), -- staff member who created it
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | ordered | received | cancelled
  order_date TIMESTAMP NOT NULL DEFAULT NOW(),
  expected_delivery DATE,
  received_at TIMESTAMP,
  amount_ht NUMERIC(12,2) NOT NULL DEFAULT 0,
  tva NUMERIC(12,2) NOT NULL DEFAULT 0,
  amount_ttc NUMERIC(12,2) NOT NULL DEFAULT 0,
  notes TEXT,
  cancel_reason TEXT
);

CREATE TABLE IF NOT EXISTS purchase_order_line (
  id SERIAL PRIMARY KEY,
  purchase_order_id INTEGER NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES product(id),
  quantity INTEGER NOT NULL,
  unit_cost NUMERIC(10,2) NOT NULL,
  subtotal NUMERIC(12,2) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_purchase_order_status ON purchase_order(status);
CREATE INDEX IF NOT EXISTS idx_purchase_order_supplier ON purchase_order(supplier_id);
CREATE INDEX IF NOT EXISTS idx_purchase_order_line_po ON purchase_order_line(purchase_order_id);
