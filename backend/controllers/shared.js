const { validationResult } = require('express-validator');
const { TVA_RATE, PAYMENT_TERMS_DAYS, LOW_STOCK_THRESHOLD } = require('../constants');

// Computes the due_date for a new order from the client's current payment_terms
// (snapshotted — changing terms later never rewrites past orders), and checks
// whether this order would push the client's outstanding balance over their
// credit_limit. Pass the transactional `client` (not the pool) so this reads
// consistent data alongside the INSERT that follows it.
async function checkCreditAndComputeDueDate(dbClient, clientId, newOrderAmount) {
  const clientRes = await dbClient.query('SELECT credit_limit, payment_terms FROM client WHERE id=$1', [clientId]);
  const clientRow = clientRes.rows[0];
  const terms = clientRow?.payment_terms || 'immediate';
  const days = PAYMENT_TERMS_DAYS[terms] ?? 0;
  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + days);
  const dueDateStr = dueDate.toISOString().split('T')[0];

  if (clientRow?.credit_limit == null) return { dueDate: dueDateStr, error: null };

  const outstandingRes = await dbClient.query(
    `SELECT COALESCE(SUM(amount_ttc),0) AS total FROM sales_order
     WHERE client_id=$1 AND status != 'cancelled' AND payment_status != 'paid'`,
    [clientId]
  );
  const outstanding = parseFloat(outstandingRes.rows[0].total);
  const limit = parseFloat(clientRow.credit_limit);
  if (outstanding + newOrderAmount > limit) {
    return {
      dueDate: dueDateStr,
      error: `This order would exceed the client's credit limit — outstanding ${outstanding.toFixed(2)} TND + this order ${newOrderAmount.toFixed(2)} TND > limit ${limit.toFixed(2)} TND`,
    };
  }
  return { dueDate: dueDateStr, error: null };
}

// Locks and returns the stock-holding row for an order line item — the product_variant
// row when variant_id is given (must belong to product_id), otherwise the parent product
// row. Returns null if not found so callers can 404/400 without throwing.
async function lockStockRow(dbClient, productId, variantId) {
  if (variantId) {
    const r = await dbClient.query(
      `SELECT pv.id, pv.unit_price, pv.stock, p.name AS product_name, pv.name AS variant_name,
              COALESCE(pv.reference, p.reference) AS reference
       FROM product_variant pv JOIN product p ON p.id = pv.product_id
       WHERE pv.id=$1 AND pv.product_id=$2 FOR UPDATE OF pv`,
      [variantId, productId]
    );
    if (r.rows.length === 0) return null;
    const v = r.rows[0];
    return { unit_price: v.unit_price, stock: v.stock, name: `${v.product_name} — ${v.variant_name}`, reference: v.reference };
  }
  const r = await dbClient.query('SELECT * FROM product WHERE id=$1 FOR UPDATE', [productId]);
  if (r.rows.length === 0) return null;
  const p = r.rows[0];
  return { unit_price: p.unit_price, stock: p.stock, name: p.name, reference: p.reference };
}

// Applies a stock delta (positive to restore, negative to decrement) to whichever row
// actually holds the stock for this line — the variant if one was selected, else the product.
async function adjustStock(dbClient, productId, variantId, delta) {
  if (variantId) {
    await dbClient.query('UPDATE product_variant SET stock=stock+$1 WHERE id=$2', [delta, variantId]);
  } else {
    await dbClient.query('UPDATE product SET stock=stock+$1 WHERE id=$2', [delta, productId]);
  }
}

const mapDbErrorToHttp = (err) => {
  const raw = err && (err.message || err.toString) ? String(err.message || err.toString()) : '';
  const msg = raw.toLowerCase();

  if (msg.includes('invalid input syntax')) {
    return { status: 422, body: { message: 'Invalid request payload' } };
  }

  if (msg.includes('invalid input syntax for type') || msg.includes('invalid input')) {
    return { status: 422, body: { message: 'Invalid request payload' } };
  }

  if (msg.includes('null value in column') || msg.includes('violates not-null constraint')) {
    return { status: 422, body: { message: 'Invalid request payload' } };
  }

  return null;
};

const handleControllerError = (res, error, fallbackStatus = 500) => {
  try {
    const mapped = mapDbErrorToHttp(error);
    if (mapped) return res.status(mapped.status).json(mapped.body);

    return res.status(fallbackStatus).json({ message: 'Internal server error' });
  } catch (_) {
    return res.status(500).json({ message: 'Internal server error' });
  }
};

const handleValidationErrors = (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    res.status(422).json({
      message: 'Validation failed',
      errors: errors.array().map(e => ({ field: e.path, message: e.msg })),
    });
    return true;
  }
  return false;
};

const writeAuditLog = async (user_id, action, details) => {
  const pool = require('../db');
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, details, timestamp) VALUES ($1, $2, $3, NOW())',
      [user_id, action, details]
    );
  } catch (_) { /* non-blocking */ }
};

module.exports = {
  TVA_RATE,
  mapDbErrorToHttp,
  handleControllerError,
  handleValidationErrors,
  writeAuditLog,
  checkCreditAndComputeDueDate,
  lockStockRow,
  adjustStock,
};

