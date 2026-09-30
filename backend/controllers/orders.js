const pool = require('../db');

const { TVA_RATE, LOW_STOCK_THRESHOLD } = require('../constants');
const { handleValidationErrors, writeAuditLog, checkCreditAndComputeDueDate, lockStockRow, adjustStock } = require('./shared');
const { sendOrderStatusEmail, sendPaymentReceivedEmail, sendLowStockAlertToStaff, sendReorderAlertToStaff } = require('../email');

// Tracks products whose stock just dropped to/under LOW_STOCK_THRESHOLD as a result of
// this decrement (i.e. it was above the threshold before). Only alert on the crossing,
// not on every order against an already-low product, to avoid spamming staff.
function trackLowStockCrossing(crossers, { name, reference, prevStock, quantity }) {
  const newStock = prevStock - quantity;
  if (prevStock > LOW_STOCK_THRESHOLD && newStock <= LOW_STOCK_THRESHOLD) {
    crossers.push({ name, reference, stock: newStock });
  }
}

// Tracks products that crossed their per-product reorder_level (if configured).
// Different from the global LOW_STOCK_THRESHOLD alert — this one fires only when
// the product has an explicit reorder_level set, and only on the crossing event.
function trackReorderCrossing(crossers, { name, reference, prevStock, quantity, reorderLevel }) {
  if (reorderLevel == null) return; // no reorder level configured
  const newStock = prevStock - quantity;
  if (prevStock > reorderLevel && newStock <= reorderLevel) {
    crossers.push({ name, reference, stock: newStock, reorderLevel });
  }
}

// Best-effort: fetch client email/name + order lines for a status email. Never throws —
// email is a courtesy notification, not something that should break the main request.
async function notifyClientOrderStatus(orderId, status, extra = {}) {
  try {
    const orderResult = await pool.query(
      `SELECT so.*, c.email AS client_email, c.company_name AS client_name
       FROM sales_order so LEFT JOIN client c ON so.client_id = c.id WHERE so.id = $1`, [orderId]
    );
    const order = orderResult.rows[0];
    if (!order || !order.client_email) return;
    const linesResult = await pool.query(
      `SELECT ol.*, p.name AS product_name FROM order_line ol LEFT JOIN product p ON ol.product_id = p.id WHERE ol.order_id = $1`, [orderId]
    );
    await sendOrderStatusEmail({ toEmail: order.client_email, toName: order.client_name, order, status, lines: linesResult.rows, ...extra });
  } catch (_) { /* non-blocking */ }
}

const getAllOrders = async (req, res) => {
  try {
    const { status, client_id, date_from, date_to, min_amount, max_amount, search, overdue } = req.query;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const isSalesAgent = req.user?.role_name === 'Sales Agent';

    let where = [], params = [], i = 1;
    if (isSalesAgent) { where.push(`so.user_id=$${i++}`); params.push(req.user.id); }
    if (status)     { where.push(`so.status=$${i++}`);                 params.push(status); }
    if (client_id)  { where.push(`so.client_id=$${i++}`);              params.push(client_id); }
    if (date_from)  { where.push(`so.order_date>=$${i++}`);            params.push(date_from); }
    if (date_to)    { where.push(`so.order_date<=$${i++}::date+1`);    params.push(date_to); }
    if (min_amount) { where.push(`so.amount_ttc>=$${i++}`);            params.push(min_amount); }
    if (max_amount) { where.push(`so.amount_ttc<=$${i++}`);            params.push(max_amount); }
    if (search)     { where.push(`(c.company_name ILIKE $${i} OR CAST(so.id AS TEXT)=$${i} OR so.tracking_number ILIKE $${i})`); params.push(`%${search}%`); i++; }
    if (overdue === 'true') { where.push(`so.payment_status != 'paid' AND so.due_date < CURRENT_DATE AND so.status != 'cancelled'`); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM sales_order so
       LEFT JOIN client c ON so.client_id=c.id LEFT JOIN app_user u ON so.user_id=u.id ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT so.*, c.company_name AS client_name, u.firstname AS user_firstname, u.lastname AS user_lastname,
              (so.payment_status != 'paid' AND so.due_date < CURRENT_DATE AND so.status != 'cancelled') AS is_overdue
       FROM sales_order so
       LEFT JOIN client c ON so.client_id=c.id LEFT JOIN app_user u ON so.user_id=u.id
       ${whereClause} ORDER BY so.order_date DESC, so.id DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const orderResult = await pool.query(
      `SELECT so.*, c.company_name AS client_name, u.firstname AS user_firstname, u.lastname AS user_lastname,
              (so.payment_status != 'paid' AND so.due_date < CURRENT_DATE AND so.status != 'cancelled') AS is_overdue
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id LEFT JOIN app_user u ON so.user_id=u.id
       WHERE so.id=$1`, [id]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const linesResult = await pool.query(
      `SELECT ol.*, p.name AS product_name, p.reference AS product_reference,
              p.image AS product_image, pv.name AS variant_name
       FROM order_line ol
       LEFT JOIN product p ON ol.product_id=p.id
       LEFT JOIN product_variant pv ON ol.variant_id=pv.id
       WHERE ol.order_id=$1 ORDER BY ol.id ASC`, [id]
    );
    res.json({ order: orderResult.rows[0], lines: linesResult.rows });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const createOrder = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  const client = await pool.connect();
  try {
    const { client_id, user_id, items, discount_percent = 0 } = req.body;
    if (!client_id || !user_id || !items || items.length === 0)
      return res.status(400).json({ message: 'client_id, user_id and items are required' });

    const discountPct = Math.min(100, Math.max(0, parseFloat(discount_percent) || 0));

    await client.query('BEGIN');
    let amount_ht_before_discount = 0;
    const orderLines = [];
    const lowStockCrossers = [];
    const reorderCrossers = [];

    for (const item of items) {
      const { product_id, variant_id, quantity } = item;
      const row = await lockStockRow(client, product_id, variant_id);
      if (!row) { await client.query('ROLLBACK'); return res.status(404).json({ message: `Product ${product_id} not found` }); }
      if (row.stock < quantity) { await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough stock for ${row.name}`, available_stock: row.stock }); }
      const unit_price = Number(row.unit_price);
      const subtotal = unit_price * quantity;
      amount_ht_before_discount += subtotal;
      orderLines.push({ product_id, variant_id: variant_id || null, quantity, unit_price, subtotal });
      trackLowStockCrossing(lowStockCrossers, { name: row.name, reference: row.reference, prevStock: row.stock, quantity });
      trackReorderCrossing(reorderCrossers, { name: row.name, reference: row.reference, prevStock: row.stock, quantity, reorderLevel: row.reorder_level });
    }

    const discount_amount = amount_ht_before_discount * (discountPct / 100);
    const amount_ht = amount_ht_before_discount - discount_amount;
    const tva = amount_ht * TVA_RATE;
    const amount_ttc = amount_ht + tva;

    const { dueDate, error: creditError } = await checkCreditAndComputeDueDate(client, client_id, amount_ttc);
    if (creditError) { await client.query('ROLLBACK'); return res.status(400).json({ message: creditError }); }

    const orderResult = await client.query(
      `INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,cancel_reason,client_id,user_id,due_date,discount_percent,discount_amount)
       VALUES (NOW(),$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING *`,
      ['confirmed', amount_ht, tva, amount_ttc, null, client_id, user_id, dueDate, discountPct, discount_amount]
    );
    const order = orderResult.rows[0];

    for (const line of orderLines) {
      await client.query('INSERT INTO order_line (quantity,unit_price,subtotal,order_id,product_id,variant_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [line.quantity, line.unit_price, line.subtotal, order.id, line.product_id, line.variant_id]
      );
      await adjustStock(client, line.product_id, line.variant_id, -line.quantity);
    }

    await client.query(
      'INSERT INTO order_status_history (order_id,previous_status,new_status,changed_by,notes) VALUES ($1,NULL,$2,$3,$4)',
      [order.id, 'confirmed', user_id, discountPct > 0 ? `Order created with ${discountPct}% discount` : 'Order created and confirmed']
    );

    await client.query('COMMIT');
    notifyClientOrderStatus(order.id, 'confirmed');
    if (lowStockCrossers.length) sendLowStockAlertToStaff({ products: lowStockCrossers }).catch(() => {});
    if (reorderCrossers.length) sendReorderAlertToStaff({ products: reorderCrossers }).catch(() => {});
    res.status(201).json({ message: 'Order created successfully', order, lines: orderLines });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Internal server error' });
  } finally { client.release(); }
};

const cancelOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;
    await client.query('BEGIN');
    const orderResult = await client.query('SELECT * FROM sales_order WHERE id=$1', [id]);
    if (orderResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found' }); }
    const order = orderResult.rows[0];

    if (req.user?.role_name === 'Sales Agent') {
      const userId = req.user.id;
      if (order.user_id !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Access denied: you can only cancel your own orders' });
      }
      if (order.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Sales Agents can only cancel pending orders' });
      }
    }

    if (order.status === 'cancelled') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Order is already cancelled' }); }
    if (order.status === 'delivered') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Cannot cancel a delivered order' }); }

    const linesResult = await client.query('SELECT * FROM order_line WHERE order_id=$1', [id]);
    if (order.status !== 'pending') {
      for (const line of linesResult.rows)
        await adjustStock(client, line.product_id, line.variant_id, line.quantity);
    }

    const updatedOrderResult = await client.query(
      `UPDATE sales_order SET status=$1,cancel_reason=$2 WHERE id=$3 RETURNING *`,
      ['cancelled', cancel_reason || 'No reason provided', id]
    );

    await client.query(
      'INSERT INTO order_status_history (order_id,previous_status,new_status,changed_by,notes) VALUES ($1,$2,$3,$4,$5)',
      [id, order.status, 'cancelled', req.user?.id || null, cancel_reason || 'No reason provided']
    );

    await client.query('COMMIT');
    await writeAuditLog(req.user?.id, 'ORDER_CANCEL', `Order #${id} cancelled — reason: ${cancel_reason || 'Not specified'}`);
    notifyClientOrderStatus(id, 'cancelled', { cancelReason: cancel_reason || 'Not specified' });
    res.json({
      message: order.status !== 'pending' ? 'Order cancelled and stock restored' : 'Order cancelled',
      order: updatedOrderResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Internal server error' });
  } finally { client.release(); }
};

const updateOrder = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { client_id, items } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0)
      return res.status(400).json({ message: 'items are required and must be a non-empty array' });

    await client.query('BEGIN');
    const orderResult = await client.query('SELECT * FROM sales_order WHERE id=$1', [id]);
    if (orderResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found' }); }
    const order = orderResult.rows[0];

    if (req.user?.role_name === 'Sales Agent') {
      const userId = req.user.id;
      if (order.user_id !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Access denied: you can only edit your own orders' });
      }
      if (order.status !== 'pending') {
        await client.query('ROLLBACK');
        return res.status(403).json({ message: 'Access denied: Sales Agents can only edit pending orders' });
      }
    }

    if (!['pending','confirmed'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cannot edit order — status is ' + order.status });
    }

    const oldLines = await client.query('SELECT * FROM order_line WHERE order_id=$1', [id]);
    for (const line of oldLines.rows) await adjustStock(client, line.product_id, line.variant_id, line.quantity);
    await client.query('DELETE FROM order_line WHERE order_id=$1', [id]);

    let amount_ht = 0;
    const newLines = [];
    const lowStockCrossers = [];
    for (const item of items) {
      const row = await lockStockRow(client, item.product_id, item.variant_id);
      if (!row) { await client.query('ROLLBACK'); return res.status(404).json({ message: `Product ${item.product_id} not found` }); }
      if (row.stock < item.quantity) { await client.query('ROLLBACK'); return res.status(400).json({ message: `Insufficient stock for ${row.name}` }); }
      const subtotal = Number(row.unit_price) * item.quantity;
      amount_ht += subtotal;
      newLines.push({ product_id: item.product_id, variant_id: item.variant_id || null, quantity: item.quantity, unit_price: Number(row.unit_price), subtotal });
      trackLowStockCrossing(lowStockCrossers, { name: row.name, reference: row.reference, prevStock: row.stock, quantity: item.quantity });
    }

    const tva = amount_ht * TVA_RATE;
    const amount_ttc = amount_ht + tva;
    await client.query('UPDATE sales_order SET client_id=$1,amount_ht=$2,tva=$3,amount_ttc=$4 WHERE id=$5',
      [client_id || order.client_id, amount_ht, tva, amount_ttc, id]
    );

    for (const line of newLines) {
      await client.query('INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal,variant_id) VALUES ($1,$2,$3,$4,$5,$6)',
        [id, line.product_id, line.quantity, line.unit_price, line.subtotal, line.variant_id]
      );
      await adjustStock(client, line.product_id, line.variant_id, -line.quantity);
    }

    await client.query('COMMIT');
    if (lowStockCrossers.length) sendLowStockAlertToStaff({ products: lowStockCrossers }).catch(() => {});
    const updated = await pool.query('SELECT * FROM sales_order WHERE id=$1', [id]);
    res.json({ message: 'Order updated', order: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ message: 'Internal server error' });
  } finally { client.release(); }
};

const updateOrderStatus = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const changedBy = req.user.id;

    await dbClient.query('BEGIN');
    const currentResult = await dbClient.query('SELECT status FROM sales_order WHERE id=$1', [id]);
    if (currentResult.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found' }); }
    const previousStatus = currentResult.rows[0].status;

    const lowStockCrossers = [];
    if (previousStatus === 'pending' && status === 'confirmed') {
      const linesResult = await dbClient.query('SELECT product_id,variant_id,quantity FROM order_line WHERE order_id=$1', [id]);
      for (const line of linesResult.rows) {
        const row = await lockStockRow(dbClient, line.product_id, line.variant_id);
        if (row && row.stock < line.quantity) {
          await dbClient.query('ROLLBACK');
          return res.status(400).json({ message: `Insufficient stock for "${row.name}". Available: ${row.stock}, required: ${line.quantity}` });
        }
        await adjustStock(dbClient, line.product_id, line.variant_id, -line.quantity);
        if (row) {
          trackLowStockCrossing(lowStockCrossers, { name: row.name, reference: row.reference, prevStock: row.stock, quantity: line.quantity });
        }
      }
    }

    if (status === 'cancelled' && previousStatus !== 'pending' && previousStatus !== 'cancelled') {
      const linesResult = await dbClient.query('SELECT product_id,variant_id,quantity FROM order_line WHERE order_id=$1', [id]);
      for (const line of linesResult.rows)
        await adjustStock(dbClient, line.product_id, line.variant_id, line.quantity);
    }

    const result = await dbClient.query(
      'UPDATE sales_order SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *',
      [status, id]
    );

    let historyInserted = false;

    if (status === 'shipped' && result.rows[0].tracking_number == null) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      const tracking_number = `DYN-${rand}`;
      const days = Math.floor(3 + Math.random() * 3);
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + days);
      const estimated_delivery = estimatedDate.toISOString().split('T')[0];

      await dbClient.query(`UPDATE sales_order SET tracking_number=$1,delivery_company='Dynamic Delivery' WHERE id=$2`,
        [tracking_number, id]
      );
      try {
        await dbClient.query('UPDATE sales_order SET estimated_delivery=$1 WHERE id=$2', [estimated_delivery, id]);
      } catch (e) {
        console.warn('estimated_delivery column missing:', e?.message);
      }

      const updated = await dbClient.query('SELECT * FROM sales_order WHERE id=$1', [id]);
      result.rows[0] = updated.rows[0];

      await dbClient.query(
        `INSERT INTO order_status_history (order_id,previous_status,new_status,changed_by,notes) VALUES ($1,$2,$3,$4,$5)`,
        [id, previousStatus, 'shipped', changedBy, `Delivery simulated — tracking: ${tracking_number} — est: ${estimated_delivery}`]
      );
      historyInserted = true;
    }

    if (!historyInserted) {
      await dbClient.query(
        'INSERT INTO order_status_history (order_id,previous_status,new_status,changed_by,notes) VALUES ($1,$2,$3,$4,$5)',
        [id, previousStatus, status, changedBy, notes || null]
      );
    }

    await dbClient.query('COMMIT');
    notifyClientOrderStatus(id, status, {
      trackingNumber: result.rows[0].tracking_number,
      estimatedDelivery: result.rows[0].estimated_delivery,
    });
    if (lowStockCrossers.length) sendLowStockAlertToStaff({ products: lowStockCrossers }).catch(() => {});
    res.json({ message: 'Order status updated successfully', order: result.rows[0] });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ message: 'Internal server error' });
  } finally { dbClient.release(); }
};

const clientCreateOrder = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    const { items, notes } = req.body;
    const client_id = req.user.id;
    const userResult = await dbClient.query(
      `SELECT id FROM app_user WHERE role_id IN (SELECT id FROM role WHERE name IN ('Administrator','Manager','Sales Agent')) LIMIT 1`
    );
    const user_id = userResult.rows[0]?.id || 1;

    if (!items || items.length === 0) return res.status(400).json({ message: 'Items are required' });
    await dbClient.query('BEGIN');
    let amount_ht = 0;
    const orderLines = [];

    for (const item of items) {
      const { product_id, quantity } = item;
      if (!product_id || !quantity || quantity <= 0) { await dbClient.query('ROLLBACK'); return res.status(400).json({ message: 'Each item must have product_id and quantity > 0' }); }
      const productResult = await dbClient.query('SELECT * FROM product WHERE id=$1 FOR UPDATE', [product_id]);
      if (productResult.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ message: `Product ${product_id} not found` }); }
      const product = productResult.rows[0];
      if (product.stock < quantity) { await dbClient.query('ROLLBACK'); return res.status(400).json({ message: `Not enough stock for "${product.name}". Available: ${product.stock}`, available_stock: product.stock }); }
      const unit_price = Number(product.unit_price);
      const subtotal = unit_price * quantity;
      amount_ht += subtotal;
      orderLines.push({ product_id, quantity, unit_price, subtotal, product_name: product.name });
    }

    const tva = amount_ht * TVA_RATE;
    const amount_ttc = amount_ht + tva;
    const orderResult = await dbClient.query(
      `INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,client_id,user_id,notes) VALUES (NOW(),$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      ['pending', amount_ht, tva, amount_ttc, client_id, user_id, notes || null]
    );
    const order = orderResult.rows[0];

    for (const line of orderLines)
      await dbClient.query('INSERT INTO order_line (quantity,unit_price,subtotal,order_id,product_id) VALUES ($1,$2,$3,$4,$5)',
        [line.quantity, line.unit_price, line.subtotal, order.id, line.product_id]
      );

    await dbClient.query('INSERT INTO order_status_history (order_id,previous_status,new_status,notes) VALUES ($1,NULL,$2,$3)',
      [order.id, 'pending', notes || 'Order placed by client']
    );

    await dbClient.query('COMMIT');
    res.status(201).json({ message: 'Order created. Awaiting admin confirmation.', order: { ...order, lines: orderLines }, status_message: 'Pending admin approval' });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ message: 'Internal server error' });
  } finally { dbClient.release(); }
};

const getOrderTracking = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT tracking_number,estimated_delivery,status AS order_status FROM sales_order WHERE id=$1', [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = result.rows[0];
    res.json({
      tracking_number: order.tracking_number || null,
      estimated_delivery: order.estimated_delivery ? order.estimated_delivery.toISOString().split('T')[0] : null,
      delivery_status: order.tracking_number && order.estimated_delivery ? 'In Transit' : null,
    });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const getOrderStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const orderResult = await pool.query(
      `SELECT so.*, c.company_name AS client_name FROM sales_order so
       LEFT JOIN client c ON so.client_id=c.id WHERE so.id=$1`, [id]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const historyResult = await pool.query(
      `SELECT osh.*, u.firstname AS user_firstname, u.lastname AS user_lastname, u.email AS user_email
       FROM order_status_history osh LEFT JOIN app_user u ON osh.changed_by=u.id
       WHERE osh.order_id=$1 ORDER BY osh.changed_at ASC`, [id]
    );
    const linesResult = await pool.query(
      `SELECT ol.*, p.name AS product_name, p.reference, p.image AS product_image
       FROM order_line ol LEFT JOIN product p ON ol.product_id=p.id WHERE ol.order_id=$1`, [id]
    );
    res.json({
      order: orderResult.rows[0],
      history: historyResult.rows,
      lines: linesResult.rows,
      summary: { total_changes: historyResult.rows.length, current_status: orderResult.rows[0].status, created_at: orderResult.rows[0].order_date },
    });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

// PUT /orders/:id/mark-paid — Administrator/Manager records a payment that happened
// outside any gateway (bank transfer confirmed in their real bank account, cash, etc).
const markOrderPaid = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { payment_method, payment_note } = req.body;

    const orderResult = await pool.query('SELECT * FROM sales_order WHERE id=$1', [id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = orderResult.rows[0];

    if (order.payment_status === 'paid') return res.status(400).json({ message: 'This order is already marked as paid' });
    if (order.status === 'cancelled') return res.status(400).json({ message: 'Cannot mark a cancelled order as paid' });

    const result = await pool.query(
      `UPDATE sales_order
       SET payment_status='paid', paid_at=NOW(),
           payment_method=COALESCE($1, payment_method, 'bank_transfer'),
           payment_note=$2
       WHERE id=$3 RETURNING *`,
      [payment_method || null, payment_note || null, id]
    );

    await writeAuditLog(req.user.id, 'ORDER_MARK_PAID', `Order #${id} manually marked as paid (${result.rows[0].payment_method})`);

    const clientResult = await pool.query('SELECT email, company_name FROM client WHERE id=$1', [result.rows[0].client_id]);
    const clientInfo = clientResult.rows[0];
    if (clientInfo?.email) {
      sendPaymentReceivedEmail({ toEmail: clientInfo.email, toName: clientInfo.company_name, order: result.rows[0] }).catch(() => {});
    }

    res.json({ message: 'Order marked as paid', order: result.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
};

const getPendingClientOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.*, c.company_name AS client_name, c.email AS client_email,
              u.firstname AS created_by_firstname, u.lastname AS created_by_lastname
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id LEFT JOIN app_user u ON so.user_id=u.id
       WHERE so.status='pending' ORDER BY so.order_date DESC`
    );
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const simulateFirstDeliveryAPI = (order) => {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  const tracking_number = `FD-${year}-${rand}`;
  const deliveryDays = Math.floor(2 + Math.random() * 3);
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
  const estimated_delivery = estimatedDate.toISOString().split('T')[0];
  const delivery_fee = parseFloat((8 + Math.random() * 10).toFixed(2));
  return {
    success: true,
    provider: 'First Delivery',
    shipment_id: `SHP-${Date.now()}`,
    tracking_number,
    estimated_delivery,
    delivery_fee,
    status: 'SHIPMENT_CREATED',
    message: 'Shipment successfully created with First Delivery.',
    pickup_scheduled: new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString(),
    recipient: { name: order?.company_name || 'Client', region: order?.region || 'Tunisia', phone: order?.phone || '—' },
  };
};

const shipOrder = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const changedBy = req.user.id;
    await dbClient.query('BEGIN');
    const orderResult = await dbClient.query(
      `SELECT so.*, c.company_name, c.region, c.phone, c.address FROM sales_order so
       LEFT JOIN client c ON so.client_id=c.id WHERE so.id=$1`, [id]
    );
    if (orderResult.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found' }); }
    const order = orderResult.rows[0];
    if (order.status !== 'confirmed') { await dbClient.query('ROLLBACK'); return res.status(400).json({ message: `Cannot ship — status is "${order.status}". Must be confirmed first.` }); }

    const apiResponse = simulateFirstDeliveryAPI(order);
    const result = await dbClient.query(
      `UPDATE sales_order SET status='shipped',tracking_number=$1,estimated_delivery=$2,delivery_company='First Delivery',updated_at=NOW() WHERE id=$3 RETURNING *`,
      [apiResponse.tracking_number, apiResponse.estimated_delivery, id]
    );

    await dbClient.query(
      `INSERT INTO order_status_history (order_id,previous_status,new_status,changed_by,notes) VALUES ($1,'confirmed','shipped',$2,$3)`,
      [id, changedBy, `Handed to First Delivery — tracking: ${apiResponse.tracking_number} — est: ${apiResponse.estimated_delivery}`]
    );

    await dbClient.query('COMMIT');
    await writeAuditLog(changedBy, 'ORDER_SHIPPED', `Order #${id} → First Delivery | tracking: ${apiResponse.tracking_number}`);
    notifyClientOrderStatus(id, 'shipped', { trackingNumber: apiResponse.tracking_number, estimatedDelivery: apiResponse.estimated_delivery });
    res.json({ message: 'Shipment created successfully', order: result.rows[0], delivery: apiResponse });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ message: 'Internal server error' });
  } finally { dbClient.release(); }
};

module.exports = {
  getAllOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  updateOrder,
  updateOrderStatus,
  shipOrder,
  clientCreateOrder,
  getOrderTracking,
  getOrderStatusHistory,
  getPendingClientOrders,
  markOrderPaid,
};

