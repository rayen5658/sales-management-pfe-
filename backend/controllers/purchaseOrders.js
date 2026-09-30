const pool = require('../db');
const { TVA_RATE, handleValidationErrors, handleControllerError, writeAuditLog } = require('./shared');

const getAllPurchaseOrders = async (req, res) => {
  try {
    const { status, supplier_id, date_from, date_to } = req.query;
    const page  = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let where = [], params = [], i = 1;
    if (status)      { where.push(`po.status=$${i++}`);           params.push(status); }
    if (supplier_id) { where.push(`po.supplier_id=$${i++}`);      params.push(supplier_id); }
    if (date_from)   { where.push(`po.order_date>=$${i++}`);      params.push(date_from); }
    if (date_to)     { where.push(`po.order_date<=$${i++}::date+1`); params.push(date_to); }
    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM purchase_order po ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT po.*, s.name AS supplier_name, u.firstname AS user_firstname, u.lastname AS user_lastname
       FROM purchase_order po
       LEFT JOIN supplier s ON po.supplier_id = s.id
       LEFT JOIN app_user u ON po.user_id = u.id
       ${whereClause} ORDER BY po.order_date DESC, po.id DESC LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) { handleControllerError(res, error); }
};

const getPurchaseOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const poResult = await pool.query(
      `SELECT po.*, s.name AS supplier_name, s.contact_name, s.email AS supplier_email, s.phone AS supplier_phone
       FROM purchase_order po LEFT JOIN supplier s ON po.supplier_id = s.id WHERE po.id=$1`, [id]
    );
    if (poResult.rows.length === 0) return res.status(404).json({ message: 'Purchase order not found' });
    const linesResult = await pool.query(
      `SELECT pol.*, p.name AS product_name, p.reference AS product_reference
       FROM purchase_order_line pol LEFT JOIN product p ON pol.product_id = p.id
       WHERE pol.purchase_order_id=$1 ORDER BY pol.id ASC`, [id]
    );
    res.json({ order: poResult.rows[0], lines: linesResult.rows });
  } catch (error) { handleControllerError(res, error); }
};

const createPurchaseOrder = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  const client = await pool.connect();
  try {
    const { supplier_id, items, notes, expected_delivery } = req.body;
    if (!supplier_id || !items || items.length === 0) {
      return res.status(400).json({ message: 'supplier_id and at least one item are required' });
    }

    await client.query('BEGIN');

    let amount_ht = 0;
    const lines = [];
    for (const item of items) {
      const { product_id, quantity, unit_cost } = item;
      if (!product_id || !quantity || quantity <= 0 || unit_cost == null || unit_cost < 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({ message: 'Each item needs product_id, a positive quantity, and a non-negative unit_cost' });
      }
      const productCheck = await client.query('SELECT id, name FROM product WHERE id=$1', [product_id]);
      if (productCheck.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ message: `Product ${product_id} not found` });
      }
      const subtotal = parseFloat(unit_cost) * quantity;
      amount_ht += subtotal;
      lines.push({ product_id, quantity, unit_cost, subtotal });
    }

    const tva = amount_ht * TVA_RATE;
    const amount_ttc = amount_ht + tva;

    const poResult = await client.query(
      `INSERT INTO purchase_order (supplier_id, user_id, status, amount_ht, tva, amount_ttc, notes, expected_delivery)
       VALUES ($1,$2,'pending',$3,$4,$5,$6,$7) RETURNING *`,
      [supplier_id, req.user.id, amount_ht, tva, amount_ttc, notes || null, expected_delivery || null]
    );
    const po = poResult.rows[0];

    for (const line of lines) {
      await client.query(
        `INSERT INTO purchase_order_line (purchase_order_id, product_id, quantity, unit_cost, subtotal) VALUES ($1,$2,$3,$4,$5)`,
        [po.id, line.product_id, line.quantity, line.unit_cost, line.subtotal]
      );
    }

    await client.query('COMMIT');
    await writeAuditLog(req.user.id, 'PURCHASE_ORDER_CREATE', `Purchase order #${po.id} created — ${fmtSupplierAmount(amount_ttc)}`);
    res.status(201).json({ message: 'Purchase order created', order: po, lines });
  } catch (error) {
    await client.query('ROLLBACK');
    handleControllerError(res, error);
  } finally { client.release(); }
};

function fmtSupplierAmount(v) { return `${parseFloat(v).toFixed(2)} TND`; }

// PUT /purchase-orders/:id/status — pending -> ordered -> received.
// Marking "received" is the one transition with real side effects: it adds
// every line's quantity back onto the product's stock, exactly the reverse
// of what confirming a sales order does.
const updatePurchaseOrderStatus = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { status } = req.body;
    if (!['pending', 'ordered', 'received', 'cancelled'].includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM purchase_order WHERE id=$1', [id]);
    if (current.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Purchase order not found' }); }
    const po = current.rows[0];

    if (po.status === 'received') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'This purchase order was already received — its stock has already been added' }); }
    if (po.status === 'cancelled') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'This purchase order is cancelled' }); }

    if (status === 'received') {
      const lines = await client.query('SELECT product_id, quantity FROM purchase_order_line WHERE purchase_order_id=$1', [id]);
      for (const line of lines.rows) {
        await client.query('UPDATE product SET stock = stock + $1 WHERE id=$2', [line.quantity, line.product_id]);
      }
      await client.query(`UPDATE purchase_order SET status='received', received_at=NOW() WHERE id=$1`, [id]);
    } else {
      await client.query('UPDATE purchase_order SET status=$1 WHERE id=$2', [status, id]);
    }

    const updated = await client.query('SELECT * FROM purchase_order WHERE id=$1', [id]);
    await client.query('COMMIT');

    if (status === 'received') {
      await writeAuditLog(req.user.id, 'PURCHASE_ORDER_RECEIVED', `Purchase order #${id} received — stock updated`);
    }
    res.json({ message: 'Purchase order updated', order: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    handleControllerError(res, error);
  } finally { client.release(); }
};

const cancelPurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;
    const current = await pool.query('SELECT status FROM purchase_order WHERE id=$1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ message: 'Purchase order not found' });
    if (current.rows[0].status === 'received') return res.status(400).json({ message: 'Cannot cancel a purchase order that was already received' });
    if (current.rows[0].status === 'cancelled') return res.status(400).json({ message: 'Already cancelled' });

    const result = await pool.query(
      `UPDATE purchase_order SET status='cancelled', cancel_reason=$1 WHERE id=$2 RETURNING *`,
      [cancel_reason || 'No reason provided', id]
    );
    await writeAuditLog(req.user.id, 'PURCHASE_ORDER_CANCEL', `Purchase order #${id} cancelled`);
    res.json({ message: 'Purchase order cancelled', order: result.rows[0] });
  } catch (error) { handleControllerError(res, error); }
};

const deletePurchaseOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const current = await pool.query('SELECT status FROM purchase_order WHERE id=$1', [id]);
    if (current.rows.length === 0) return res.status(404).json({ message: 'Purchase order not found' });
    if (current.rows[0].status !== 'pending') {
      return res.status(400).json({ message: 'Only draft (pending) purchase orders can be deleted — cancel it instead' });
    }
    await pool.query('DELETE FROM purchase_order WHERE id=$1', [id]);
    await writeAuditLog(req.user.id, 'PURCHASE_ORDER_DELETE', `Purchase order #${id} deleted`);
    res.json({ message: 'Purchase order deleted' });
  } catch (error) { handleControllerError(res, error); }
};

module.exports = {
  getAllPurchaseOrders,
  getPurchaseOrderById,
  createPurchaseOrder,
  updatePurchaseOrderStatus,
  cancelPurchaseOrder,
  deletePurchaseOrder,
};
