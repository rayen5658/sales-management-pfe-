-- ===============================================
-- RETURNS & CLIENT FEEDBACK
-- ===============================================
-- Whole-order returns (not line-level) — the common case for a small
-- business: client asks to send the order back, admin approves/rejects,
-- approval restocks products and optionally marks the order refunded.
-- One feedback entry per delivered order (rating + comment).
-- ===============================================

CREATE TABLE IF NOT EXISTS order_return (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES sales_order(id),
  client_id INTEGER REFERENCES client(id),
  reason TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'requested', -- requested | approved | rejected
  requested_at TIMESTAMP NOT NULL DEFAULT NOW(),
  resolved_at TIMESTAMP,
  resolved_by INTEGER REFERENCES app_user(id),
  resolution_note TEXT
);

CREATE TABLE IF NOT EXISTS order_feedback (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL UNIQUE REFERENCES sales_order(id),
  client_id INTEGER REFERENCES client(id),
  rating SMALLINT NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_order_return_status ON order_return(status);
