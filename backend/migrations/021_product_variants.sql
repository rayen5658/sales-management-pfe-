-- ===============================================
-- PRODUCT VARIANTS
-- ===============================================
-- A product can have multiple variants (e.g. RAM size, color), each with its
-- own reference, price and stock. When a variant is selected on an order line,
-- price/stock are resolved from the variant instead of the parent product.
-- ===============================================

CREATE TABLE IF NOT EXISTS product_variant (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,            -- e.g. "16GB RAM", "Red"
  reference VARCHAR(100),
  unit_price NUMERIC(10,2) NOT NULL,
  stock INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_product_variant_product_id ON product_variant(product_id);

ALTER TABLE order_line
ADD COLUMN IF NOT EXISTS variant_id INTEGER REFERENCES product_variant(id) ON DELETE SET NULL;
