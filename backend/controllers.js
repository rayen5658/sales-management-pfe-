const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const { validationResult } = require('express-validator');
const { TVA_RATE } = require('./constants');

// ── Shared helpers ────────────────────────────────────────────────────────────

// Returns true and sends 422 if express-validator found errors.
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

// Write an audit log entry (non-blocking).
const writeAuditLog = async (user_id, action, details) => {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, details, timestamp) VALUES ($1, $2, $3, NOW())',
      [user_id, action, details]
    );
  } catch (_) { /* non-blocking */ }
};

// ── Products ──────────────────────────────────────────────────────────────────

// GET ALL PRODUCTS — supports ?page=1&limit=20 for pagination
const getAllProducts = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) AS total FROM product');
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      'SELECT * FROM product ORDER BY id ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getProductById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM product WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const createProduct = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { reference, name, description, unit_price, stock, image, category_id } = req.body;
    const result = await pool.query(
      `INSERT INTO product (reference, name, description, unit_price, stock, image, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [reference, name, description, unit_price, stock, image || null, category_id]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const updateProduct = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { reference, name, description, unit_price, stock, image, category_id } = req.body;
    const result = await pool.query(
      `UPDATE product SET reference=$1, name=$2, description=$3, unit_price=$4, stock=$5, image=$6, category_id=$7
       WHERE id=$8 RETURNING *`,
      [reference, name, description, unit_price, stock, image || null, category_id, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const deleteProduct = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM product WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Product not found' });
    res.json({ message: 'Product deleted successfully', product: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// IMPORT PRODUCTS FROM CSV
const importProductsCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file provided' });
  const filePath = req.file.path;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, '');
    const lines = raw.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'File is empty or contains only a header' });
    }
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));
    const col = (names) => { for (const n of names) { const i = headers.indexOf(n); if (i !== -1) return i; } return -1; };
    const iName  = col(['nom','name']);
    const iRef   = col(['reference','ref','sku']);
    const iDesc  = col(['description','desc']);
    const iPrice = col(['prix','price','prixht','unitprice','unit_price','prixunitaire']);
    const iStock = col(['stock','quantite','quantity','qty']);
    const iCat   = col(['categorie','category','category_id','categorieid','catid']);
    const iImage = col(['image','img','imageurl']);
    if (iName === -1 || iPrice === -1 || iStock === -1) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Missing required columns: name (or nom), price (or prix), stock' });
    }
    const catsResult = await pool.query('SELECT id, name FROM category');
    const catMap = {};
    catsResult.rows.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });
    const results = { inserted: 0, updated: 0, errors: [] };
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      const name = cols[iName]?.trim();
      if (!name) continue;
      const reference   = iRef   !== -1 ? cols[iRef]?.trim()  || null : null;
      const description = iDesc  !== -1 ? cols[iDesc]?.trim() || null : null;
      const unit_price  = parseFloat((cols[iPrice] || '0').replace(',', '.'));
      const stock       = parseInt(cols[iStock] || '0', 10);
      const image       = iImage !== -1 ? cols[iImage]?.trim() || null : null;
      let category_id = null;
      if (iCat !== -1 && cols[iCat]) {
        const raw = cols[iCat].trim();
        category_id = /^\d+$/.test(raw) ? parseInt(raw, 10) : (catMap[raw.toLowerCase()] || null);
      }
      if (isNaN(unit_price) || isNaN(stock)) { results.errors.push(`Row ${i + 1} skipped — invalid price or stock`); continue; }
      try {
        if (reference) {
          const existing = await pool.query('SELECT id FROM product WHERE reference=$1', [reference]);
          if (existing.rows.length > 0) {
            await pool.query('UPDATE product SET name=$1,description=$2,unit_price=$3,stock=$4,category_id=$5,image=$6 WHERE reference=$7',
              [name, description, unit_price, stock, category_id, image, reference]);
            results.updated++;
          } else {
            await pool.query('INSERT INTO product (name,reference,description,unit_price,stock,category_id,image) VALUES ($1,$2,$3,$4,$5,$6,$7)',
              [name, reference, description, unit_price, stock, category_id, image]);
            results.inserted++;
          }
        } else {
          await pool.query('INSERT INTO product (name,description,unit_price,stock,category_id,image) VALUES ($1,$2,$3,$4,$5,$6)',
            [name, description, unit_price, stock, category_id, image]);
          results.inserted++;
        }
      } catch (rowErr) { results.errors.push(`Row ${i + 1} (${name}) — ${rowErr.message}`); }
    }
    fs.unlinkSync(filePath);
    res.json({ message: `Import complete: ${results.inserted} added, ${results.updated} updated`, ...results });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: err.message });
  }
};

// ── Categories ────────────────────────────────────────────────────────────────

const getAllCategories = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.id) AS product_count FROM category c
      LEFT JOIN product p ON p.category_id = c.id GROUP BY c.id ORDER BY c.id ASC`);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getCategoryById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM category WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Category not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const createCategory = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { name, description, image, parent_id } = req.body;
    const result = await pool.query(
      'INSERT INTO category (name,description,image,parent_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, description || null, image || null, parent_id || null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const updateCategory = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { name, description, image, parent_id } = req.body;
    const result = await pool.query(
      'UPDATE category SET name=$1,description=$2,image=$3,parent_id=$4 WHERE id=$5 RETURNING *',
      [name, description || null, image || null, parent_id || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Category not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const deleteCategory = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM category WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted successfully', category: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── Clients ───────────────────────────────────────────────────────────────────

const getClientOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.id, so.order_date, so.status, so.amount_ht, so.tva, so.amount_ttc, so.cancel_reason
       FROM sales_order so WHERE so.client_id=$1 ORDER BY so.order_date DESC`, [req.params.id]);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getAllClients = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,company_name,address,region,email,phone,segment,status FROM client ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getClientById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,company_name,address,region,email,phone,segment,status FROM client WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const createClient = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { company_name, address, region, email, phone, segment, status } = req.body;
    const result = await pool.query(
      'INSERT INTO client (company_name,address,region,email,phone,segment,status) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING *',
      [company_name, address||null, region||null, email||null, phone||null, segment||null, status||null]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const updateClient = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { company_name, address, region, email, phone, segment, status } = req.body;
    const result = await pool.query(
      `UPDATE client SET company_name=$1,address=$2,region=$3,email=$4,phone=$5,segment=$6,status=$7
       WHERE id=$8 RETURNING *`,
      [company_name, address||null, region||null, email||null, phone||null, segment||null, status||null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const deleteClient = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM client WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted successfully', client: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const archiveClient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`UPDATE client SET status='archived' WHERE id=$1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    await writeAuditLog(req.user?.id, 'CLIENT_ARCHIVE', `Client #${id} archived`);
    res.json({ message: 'Client archived', client: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const restoreClient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`UPDATE client SET status='active' WHERE id=$1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    await writeAuditLog(req.user?.id, 'CLIENT_RESTORE', `Client #${id} restored`);
    res.json({ message: 'Client restored', client: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── Orders ────────────────────────────────────────────────────────────────────

// GET ALL ORDERS — supports ?page=1&limit=20 plus existing filters
const getAllOrders = async (req, res) => {
  try {
    const { status, client_id, date_from, date_to, min_amount, max_amount } = req.query;
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    let where = [], params = [], i = 1;
    if (status)     { where.push(`so.status=$${i++}`);                 params.push(status); }
    if (client_id)  { where.push(`so.client_id=$${i++}`);              params.push(client_id); }
    if (date_from)  { where.push(`so.order_date>=$${i++}`);            params.push(date_from); }
    if (date_to)    { where.push(`so.order_date<=$${i++}::date+1`);    params.push(date_to); }
    if (min_amount) { where.push(`so.amount_ttc>=$${i++}`);            params.push(min_amount); }
    if (max_amount) { where.push(`so.amount_ttc<=$${i++}`);            params.push(max_amount); }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM sales_order so
       LEFT JOIN client c ON so.client_id=c.id LEFT JOIN app_user u ON so.user_id=u.id ${whereClause}`, params);
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT so.*, c.company_name AS client_name, u.firstname AS user_firstname, u.lastname AS user_lastname
       FROM sales_order so
       LEFT JOIN client c ON so.client_id=c.id LEFT JOIN app_user u ON so.user_id=u.id
       ${whereClause} ORDER BY so.order_date DESC, so.id DESC LIMIT $${i} OFFSET $${i+1}`,
      [...params, limit, offset]);

    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit), hasNext: page * limit < total, hasPrev: page > 1 },
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const orderResult = await pool.query(
      `SELECT so.*, c.company_name AS client_name, u.firstname AS user_firstname, u.lastname AS user_lastname
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id LEFT JOIN app_user u ON so.user_id=u.id
       WHERE so.id=$1`, [id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const linesResult = await pool.query(
      `SELECT ol.*, p.name AS product_name, p.reference AS product_reference,
              p.image AS product_image
       FROM order_line ol LEFT JOIN product p ON ol.product_id=p.id WHERE ol.order_id=$1 ORDER BY ol.id ASC`, [id]);
    res.json({ order: orderResult.rows[0], lines: linesResult.rows });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// CREATE ORDER WITH STOCK LOGIC
const createOrder = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  const client = await pool.connect();
  try {
    const { client_id, user_id, items } = req.body;
    if (!client_id || !user_id || !items || items.length === 0)
      return res.status(400).json({ message: 'client_id, user_id and items are required' });

    await client.query('BEGIN');
    let amount_ht = 0;
    const orderLines = [];

    for (const item of items) {
      const { product_id, quantity } = item;
      const productResult = await client.query('SELECT * FROM product WHERE id=$1', [product_id]);
      if (productResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: `Product ${product_id} not found` }); }
      const product = productResult.rows[0];
      if (product.stock < quantity) { await client.query('ROLLBACK'); return res.status(400).json({ message: `Not enough stock for ${product.name}`, available_stock: product.stock }); }
      const unit_price = Number(product.unit_price);
      const subtotal = unit_price * quantity;
      amount_ht += subtotal;
      orderLines.push({ product_id, quantity, unit_price, subtotal });
    }

    const tva = amount_ht * TVA_RATE;
    const amount_ttc = amount_ht + tva;
    const orderResult = await client.query(
      `INSERT INTO sales_order (order_date,status,amount_ht,tva,amount_ttc,cancel_reason,client_id,user_id)
       VALUES (NOW(),$1,$2,$3,$4,$5,$6,$7) RETURNING *`,
      ['confirmed', amount_ht, tva, amount_ttc, null, client_id, user_id]);
    const order = orderResult.rows[0];

    for (const line of orderLines) {
      await client.query('INSERT INTO order_line (quantity,unit_price,subtotal,order_id,product_id) VALUES ($1,$2,$3,$4,$5)',
        [line.quantity, line.unit_price, line.subtotal, order.id, line.product_id]);
      await client.query('UPDATE product SET stock=stock-$1 WHERE id=$2', [line.quantity, line.product_id]);
    }
    await client.query('COMMIT');
    res.status(201).json({ message: 'Order created successfully', order, lines: orderLines });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally { client.release(); }
};

// CANCEL ORDER AND RESTORE STOCK
const cancelOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;
    await client.query('BEGIN');
    const orderResult = await client.query('SELECT * FROM sales_order WHERE id=$1', [id]);
    if (orderResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found' }); }
    const order = orderResult.rows[0];
    if (order.status === 'cancelled') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Order is already cancelled' }); }
    if (order.status === 'delivered') { await client.query('ROLLBACK'); return res.status(400).json({ message: 'Cannot cancel a delivered order' }); }

    const linesResult = await client.query('SELECT * FROM order_line WHERE order_id=$1', [id]);
    if (order.status !== 'pending') {
      for (const line of linesResult.rows)
        await client.query('UPDATE product SET stock=stock+$1 WHERE id=$2', [line.quantity, line.product_id]);
    }
    const updatedOrderResult = await client.query(
      `UPDATE sales_order SET status=$1,cancel_reason=$2 WHERE id=$3 RETURNING *`,
      ['cancelled', cancel_reason || 'No reason provided', id]);
    await client.query('COMMIT');
    await writeAuditLog(req.user?.id, 'ORDER_CANCEL', `Order #${id} cancelled — reason: ${cancel_reason || 'Not specified'}`);
    res.json({
      message: order.status !== 'pending' ? 'Order cancelled and stock restored' : 'Order cancelled',
      order: updatedOrderResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally { client.release(); }
};

// UPDATE ORDER (only pending or confirmed)
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
    if (!['pending','confirmed'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cannot edit order — status is ' + order.status });
    }

    const oldLines = await client.query('SELECT * FROM order_line WHERE order_id=$1', [id]);
    for (const line of oldLines.rows) await client.query('UPDATE product SET stock=stock+$1 WHERE id=$2', [line.quantity, line.product_id]);
    await client.query('DELETE FROM order_line WHERE order_id=$1', [id]);

    let amount_ht = 0;
    const newLines = [];
    for (const item of items) {
      const pr = await client.query('SELECT * FROM product WHERE id=$1', [item.product_id]);
      if (pr.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: `Product ${item.product_id} not found` }); }
      const product = pr.rows[0];
      if (product.stock < item.quantity) { await client.query('ROLLBACK'); return res.status(400).json({ message: `Insufficient stock for ${product.name}` }); }
      const subtotal = Number(product.unit_price) * item.quantity;
      amount_ht += subtotal;
      newLines.push({ product_id: item.product_id, quantity: item.quantity, unit_price: Number(product.unit_price), subtotal });
    }

    const tva = amount_ht * TVA_RATE;
    const amount_ttc = amount_ht + tva;
    await client.query('UPDATE sales_order SET client_id=$1,amount_ht=$2,tva=$3,amount_ttc=$4 WHERE id=$5',
      [client_id || order.client_id, amount_ht, tva, amount_ttc, id]);

    for (const line of newLines) {
      await client.query('INSERT INTO order_line (order_id,product_id,quantity,unit_price,subtotal) VALUES ($1,$2,$3,$4,$5)',
        [id, line.product_id, line.quantity, line.unit_price, line.subtotal]);
      await client.query('UPDATE product SET stock=stock-$1 WHERE id=$2', [line.quantity, line.product_id]);
    }
    await client.query('COMMIT');
    const updated = await pool.query('SELECT * FROM sales_order WHERE id=$1', [id]);
    res.json({ message: 'Order updated', order: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally { client.release(); }
};

// UPDATE ORDER STATUS
const updateOrderStatus = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const changedBy = req.user.id || req.user.user_id;

    await dbClient.query('BEGIN');
    const currentResult = await dbClient.query('SELECT status FROM sales_order WHERE id=$1', [id]);
    if (currentResult.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found' }); }
    const previousStatus = currentResult.rows[0].status;

    // pending → confirmed: deduct stock
    if (previousStatus === 'pending' && status === 'confirmed') {
      const linesResult = await dbClient.query('SELECT product_id,quantity FROM order_line WHERE order_id=$1', [id]);
      for (const line of linesResult.rows) {
        const stockResult = await dbClient.query('SELECT stock,name FROM product WHERE id=$1', [line.product_id]);
        if (stockResult.rows.length > 0 && stockResult.rows[0].stock < line.quantity) {
          await dbClient.query('ROLLBACK');
          return res.status(400).json({ message: `Insufficient stock for "${stockResult.rows[0].name}". Available: ${stockResult.rows[0].stock}, required: ${line.quantity}` });
        }
        await dbClient.query('UPDATE product SET stock=stock-$1 WHERE id=$2', [line.quantity, line.product_id]);
      }
    }

    // confirmed/shipped → cancelled: restore stock
    if (status === 'cancelled' && previousStatus !== 'pending' && previousStatus !== 'cancelled') {
      const linesResult = await dbClient.query('SELECT product_id,quantity FROM order_line WHERE order_id=$1', [id]);
      for (const line of linesResult.rows)
        await dbClient.query('UPDATE product SET stock=stock+$1 WHERE id=$2', [line.quantity, line.product_id]);
    }

    const result = await dbClient.query(
      'UPDATE sales_order SET status=$1,updated_at=NOW() WHERE id=$2 RETURNING *', [status, id]);

    // Auto-assign tracking when shipped
    if (status === 'shipped' && result.rows[0].tracking_number == null) {
      const rand = Math.floor(100000 + Math.random() * 900000);
      const tracking_number = `DYN-${rand}`;
      const days = Math.floor(3 + Math.random() * 3);
      const estimatedDate = new Date();
      estimatedDate.setDate(estimatedDate.getDate() + days);
      const estimated_delivery = estimatedDate.toISOString().split('T')[0];

      await dbClient.query(`UPDATE sales_order SET tracking_number=$1,delivery_company='Dynamic Delivery' WHERE id=$2`,
        [tracking_number, id]);
      try {
        await dbClient.query('UPDATE sales_order SET estimated_delivery=$1 WHERE id=$2', [estimated_delivery, id]);
      } catch (e) {
        console.warn('estimated_delivery column missing:', e?.message);
      }
      const updated = await dbClient.query('SELECT * FROM sales_order WHERE id=$1', [id]);
      result.rows[0] = updated.rows[0];
      await dbClient.query(
        `INSERT INTO order_status_history (order_id,previous_status,new_status,changed_by,notes) VALUES ($1,$2,$3,$4,$5)`,
        [id, 'confirmed', 'shipped', changedBy, `Delivery simulated — tracking: ${tracking_number} — est: ${estimated_delivery}`]);
    }

    await dbClient.query(
      'INSERT INTO order_status_history (order_id,previous_status,new_status,changed_by,notes) VALUES ($1,$2,$3,$4,$5)',
      [id, previousStatus, status, changedBy, notes || null]);
    await dbClient.query('COMMIT');
    res.json({ message: 'Order status updated successfully', order: result.rows[0] });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally { dbClient.release(); }
};

// CLIENT: Create order (pending, awaiting admin confirmation)
const clientCreateOrder = async (req, res) => {
  const dbClient = await pool.connect();
  try {
    const { items, notes } = req.body;
    const client_id = req.user.id || req.user.user_id;
    const userResult = await dbClient.query(
      `SELECT id FROM app_user WHERE role_id IN (SELECT id FROM role WHERE name IN ('Administrator','Manager','Sales Agent')) LIMIT 1`);
    const user_id = userResult.rows[0]?.id || 1;

    if (!items || items.length === 0) return res.status(400).json({ message: 'Items are required' });
    await dbClient.query('BEGIN');
    let amount_ht = 0;
    const orderLines = [];

    for (const item of items) {
      const { product_id, quantity } = item;
      if (!product_id || !quantity || quantity <= 0) { await dbClient.query('ROLLBACK'); return res.status(400).json({ message: 'Each item must have product_id and quantity > 0' }); }
      const productResult = await dbClient.query('SELECT * FROM product WHERE id=$1', [product_id]);
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
      ['pending', amount_ht, tva, amount_ttc, client_id, user_id, notes || null]);
    const order = orderResult.rows[0];

    for (const line of orderLines)
      await dbClient.query('INSERT INTO order_line (quantity,unit_price,subtotal,order_id,product_id) VALUES ($1,$2,$3,$4,$5)',
        [line.quantity, line.unit_price, line.subtotal, order.id, line.product_id]);

    await dbClient.query('INSERT INTO order_status_history (order_id,previous_status,new_status,notes) VALUES ($1,NULL,$2,$3)',
      [order.id, 'pending', notes || 'Order placed by client']);
    await dbClient.query('COMMIT');
    res.status(201).json({ message: 'Order created. Awaiting admin confirmation.', order: { ...order, lines: orderLines }, status_message: 'Pending admin approval' });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally { dbClient.release(); }
};

const getOrderTracking = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT tracking_number,estimated_delivery,status AS order_status FROM sales_order WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = result.rows[0];
    res.json({
      tracking_number: order.tracking_number || null,
      estimated_delivery: order.estimated_delivery ? order.estimated_delivery.toISOString().split('T')[0] : null,
      delivery_status: order.tracking_number && order.estimated_delivery ? 'In Transit' : null,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getOrderStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;
    const orderResult = await pool.query(
      `SELECT so.*, c.company_name AS client_name FROM sales_order so
       LEFT JOIN client c ON so.client_id=c.id WHERE so.id=$1`, [id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const historyResult = await pool.query(
      `SELECT osh.*, u.firstname AS user_firstname, u.lastname AS user_lastname, u.email AS user_email
       FROM order_status_history osh LEFT JOIN app_user u ON osh.changed_by=u.id
       WHERE osh.order_id=$1 ORDER BY osh.changed_at ASC`, [id]);
    const linesResult = await pool.query(
      `SELECT ol.*, p.name AS product_name, p.reference, p.image AS product_image
       FROM order_line ol LEFT JOIN product p ON ol.product_id=p.id WHERE ol.order_id=$1`, [id]);
    res.json({
      order: orderResult.rows[0], history: historyResult.rows, lines: linesResult.rows,
      summary: { total_changes: historyResult.rows.length, current_status: orderResult.rows[0].status, created_at: orderResult.rows[0].order_date },
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getPendingClientOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.*, c.company_name AS client_name, c.email AS client_email,
              u.firstname AS created_by_firstname, u.lastname AS created_by_lastname
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id LEFT JOIN app_user u ON so.user_id=u.id
       WHERE so.status='pending' ORDER BY so.order_date DESC`);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── Delivery simulation ───────────────────────────────────────────────────────

const simulateFirstDeliveryAPI = (order) => {
  const year = new Date().getFullYear();
  const rand = Math.floor(100000 + Math.random() * 900000);
  const tracking_number = `FD-${year}-${rand}`;
  const deliveryDays = Math.floor(2 + Math.random() * 3);
  const estimatedDate = new Date();
  estimatedDate.setDate(estimatedDate.getDate() + deliveryDays);
  const estimated_delivery = estimatedDate.toISOString().split('T')[0];
  // Realistic Tunisia delivery fee simulation (TND)
  // Typical small/medium shipments: ~8 to 18 TND
  const delivery_fee = parseFloat((8 + Math.random() * 10).toFixed(2));
  return {

    success: true, provider: 'First Delivery', shipment_id: `SHP-${Date.now()}`,
    tracking_number, estimated_delivery, delivery_fee, status: 'SHIPMENT_CREATED',
    message: 'Shipment successfully created with First Delivery.',
    // NOTE: delivery_fee is simulated realistically (TND)

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
       LEFT JOIN client c ON so.client_id=c.id WHERE so.id=$1`, [id]);
    if (orderResult.rows.length === 0) { await dbClient.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found' }); }
    const order = orderResult.rows[0];
    if (order.status !== 'confirmed') { await dbClient.query('ROLLBACK'); return res.status(400).json({ message: `Cannot ship — status is "${order.status}". Must be confirmed first.` }); }

    const apiResponse = simulateFirstDeliveryAPI(order);
    const result = await dbClient.query(
      `UPDATE sales_order SET status='shipped',tracking_number=$1,estimated_delivery=$2,delivery_company='First Delivery',updated_at=NOW() WHERE id=$3 RETURNING *`,
      [apiResponse.tracking_number, apiResponse.estimated_delivery, id]);
    await dbClient.query(
      `INSERT INTO order_status_history (order_id,previous_status,new_status,changed_by,notes) VALUES ($1,'confirmed','shipped',$2,$3)`,
      [id, changedBy, `Handed to First Delivery — tracking: ${apiResponse.tracking_number} — est: ${apiResponse.estimated_delivery}`]);
    await dbClient.query('COMMIT');
    await writeAuditLog(changedBy, 'ORDER_SHIPPED', `Order #${id} → First Delivery | tracking: ${apiResponse.tracking_number}`);
    res.json({ message: 'Shipment created successfully', order: result.rows[0], delivery: apiResponse });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally { dbClient.release(); }
};

// ── Users & Auth ──────────────────────────────────────────────────────────────

const registerUser = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { firstname, lastname, email, password, role_id } = req.body;
    const existing = await pool.query('SELECT id FROM app_user WHERE email=$1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'Email already exists' });
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO app_user (firstname,lastname,email,password_hash,status,last_login,role_id)
       VALUES ($1,$2,$3,$4,'active',NULL,$5) RETURNING id,firstname,lastname,email,status,role_id`,
      [firstname, lastname, email, hashedPassword, role_id]);
    res.status(201).json({ message: 'User registered successfully', user: result.rows[0] });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const loginUser = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { email, password } = req.body;
    const result = await pool.query(
      `SELECT u.id,u.firstname,u.lastname,u.email,u.password_hash,u.status,u.role_id,r.name AS role_name
       FROM app_user u LEFT JOIN role r ON u.role_id=r.id WHERE u.email=$1`, [email]);
    if (result.rows.length === 0) return res.status(401).json({ message: 'Invalid email or password' });
    const user = result.rows[0];
    if (user.status !== 'active') return res.status(403).json({ message: 'User account is not active' });
    const isPasswordValid = await bcrypt.compare(password, user.password_hash);
    if (!isPasswordValid) return res.status(401).json({ message: 'Invalid email or password' });
    await pool.query('UPDATE app_user SET last_login=NOW() WHERE id=$1', [user.id]);
    await writeAuditLog(user.id, 'LOGIN', `Login successful — ${user.email}`);
    const token = jwt.sign(
      { id: user.id, email: user.email, role_id: user.role_id, role_name: user.role_name },
      process.env.JWT_SECRET, { expiresIn: '1d' });
    res.json({ message: 'Login successful', token, user: { id: user.id, firstname: user.firstname, lastname: user.lastname, email: user.email, status: user.status, role_id: user.role_id, role_name: user.role_name } });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id,u.firstname,u.lastname,u.email,u.status,u.last_login,u.role_id,r.name AS role_name
       FROM app_user u LEFT JOIN role r ON u.role_id=r.id ORDER BY u.id ASC`);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getAllRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM role ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const updateUser = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { firstname, lastname, email, role_id, status } = req.body;
    const result = await pool.query(
      `UPDATE app_user SET firstname=$1,lastname=$2,email=$3,role_id=$4,status=$5 WHERE id=$6
       RETURNING id,firstname,lastname,email,role_id,status`,
      [firstname, lastname, email, role_id, status, id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      'UPDATE app_user SET status=$1 WHERE id=$2 RETURNING id,firstname,lastname,email,status', [status, id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    await writeAuditLog(req.user?.id, 'USER_STATUS_CHANGE', `User #${id} — status changed to "${status}"`);
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('UPDATE app_user SET password_hash=$1 WHERE id=$2', [hashed, id]);
    await writeAuditLog(req.user?.id, 'PASSWORD_RESET', `Password reset for user #${id}`);
    res.json({ message: 'Password reset successfully' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM app_user WHERE id=$1 RETURNING id,email', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    await writeAuditLog(req.user?.id, 'USER_DELETE', `User deleted — #${id} (${result.rows[0].email})`);
    res.json({ message: 'User deleted' });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── Audit logs ────────────────────────────────────────────────────────────────

const getAuditLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.id,al.action,al.details,al.timestamp,al.user_id,
              u.firstname||' '||u.lastname AS user_name, u.email AS user_email
       FROM audit_log al LEFT JOIN app_user u ON al.user_id=u.id ORDER BY al.timestamp DESC LIMIT 200`);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── Dashboard & Analytics ─────────────────────────────────────────────────────

const getSalesByRegion = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.region, COUNT(DISTINCT so.id) AS orders,
              COALESCE(SUM(so.amount_ttc),0) AS revenue, COALESCE(AVG(so.amount_ttc),0) AS avg_order
       FROM sales_order so JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND c.region IS NOT NULL
       GROUP BY c.region ORDER BY revenue DESC`);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ error: error.message }); }
};

const getDashboardStats = async (req, res) => {
  try {
    const { period = 'year', user_id, region } = req.query;
    const periodFilter = {
      week:    `order_date >= NOW() - INTERVAL '7 days'`,
      month:   `order_date >= DATE_TRUNC('month', NOW())`,
      quarter: `order_date >= DATE_TRUNC('quarter', NOW())`,
      year:    `EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM NOW())`,
      all:     `1=1`,
    };
    const dateWhere = periodFilter[period] || periodFilter.year;
    const params = [];
    const userFilter   = user_id ? `AND so.user_id=$${params.push(parseInt(user_id))}` : '';
    const regionFilter = region  ? `AND c.region=$${params.push(region)}` : '';

    const revenue    = await pool.query(`SELECT COALESCE(SUM(amount_ttc),0) AS total FROM sales_order so LEFT JOIN client c ON so.client_id=c.id WHERE so.status!='cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}`, [...params]);
    const ordersQ    = await pool.query(`SELECT COUNT(*) AS total FROM sales_order so LEFT JOIN client c ON so.client_id=c.id WHERE ${dateWhere} ${userFilter} ${regionFilter}`, [...params]);
    const clients    = await pool.query(`SELECT COUNT(*) AS total FROM client WHERE status='active'`);
    const products   = await pool.query(`SELECT COUNT(*) AS total FROM product`);
    const lowStock   = await pool.query(`SELECT COUNT(*) AS total FROM product WHERE stock<=5`);

    const prevFilter = {
      week:    `order_date >= NOW()-INTERVAL '14 days' AND order_date < NOW()-INTERVAL '7 days'`,
      month:   `order_date >= DATE_TRUNC('month',NOW())-INTERVAL '1 month' AND order_date < DATE_TRUNC('month',NOW())`,
      quarter: `order_date >= DATE_TRUNC('quarter',NOW())-INTERVAL '3 months' AND order_date < DATE_TRUNC('quarter',NOW())`,
      year:    `EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM NOW())-1`,
      all:     `1=0`,
    };
    const prevRevenue = await pool.query(`SELECT COALESCE(SUM(amount_ttc),0) AS total FROM sales_order so LEFT JOIN client c ON so.client_id=c.id WHERE so.status!='cancelled' AND ${prevFilter[period]||prevFilter.year} ${userFilter} ${regionFilter}`, [...params]);

    const currentRev = parseFloat(revenue.rows[0].total);
    const prevRev    = parseFloat(prevRevenue.rows[0].total);
    const variation  = prevRev > 0 ? (((currentRev - prevRev) / prevRev) * 100).toFixed(1) : null;
    const growthRate = prevRev > 0 ? (currentRev - prevRev) / prevRev : 0;
    const projection = Math.round(currentRev * (1 + growthRate));

    const monthly = await pool.query(
      `SELECT TO_CHAR(so.order_date,'Mon') AS month, EXTRACT(MONTH FROM so.order_date) AS month_num,
              COALESCE(SUM(so.amount_ttc),0) AS revenue, COUNT(*) AS orders
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND EXTRACT(YEAR FROM so.order_date)=EXTRACT(YEAR FROM NOW())
       ${userFilter} ${regionFilter} GROUP BY month,month_num ORDER BY month_num ASC`, [...params]);

    const monthlyPrev = await pool.query(
      `SELECT TO_CHAR(so.order_date,'Mon') AS month, EXTRACT(MONTH FROM so.order_date) AS month_num,
              COALESCE(SUM(so.amount_ttc),0) AS revenue_prev
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND EXTRACT(YEAR FROM so.order_date)=EXTRACT(YEAR FROM NOW())-1
       ${userFilter} ${regionFilter} GROUP BY month,month_num ORDER BY month_num ASC`, [...params]);

    const prevMap = {};
    monthlyPrev.rows.forEach(r => { prevMap[r.month_num] = parseFloat(r.revenue_prev); });
    const monthlyMerged = monthly.rows.map(r => ({
      month: r.month, revenue: parseFloat(r.revenue), revenue_prev: prevMap[r.month_num] || 0, orders: parseInt(r.orders),
    }));

    const topProducts = await pool.query(
      `SELECT p.name, SUM(ol.quantity) AS qty, SUM(ol.subtotal) AS revenue
       FROM order_line ol JOIN product p ON ol.product_id=p.id JOIN sales_order so ON ol.order_id=so.id
       LEFT JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}
       GROUP BY p.name ORDER BY qty DESC LIMIT 5`, [...params]);

    const topClients = await pool.query(
      `SELECT c.company_name AS name, COUNT(so.id) AS orders, COALESCE(SUM(so.amount_ttc),0) AS revenue,
              MAX(so.order_date) AS last_order_date,
              ROUND(EXTRACT(DAY FROM NOW()-MAX(so.order_date))/30) AS inactive_months
       FROM sales_order so JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}
       GROUP BY c.company_name ORDER BY revenue DESC LIMIT 5`, [...params]);

    res.json({
      period,
      kpis: { totalRevenue: currentRev, prevRevenue: prevRev, variation, projection, totalOrders: parseInt(ordersQ.rows[0].total), activeClients: parseInt(clients.rows[0].total), totalProducts: parseInt(products.rows[0].total), lowStockProducts: parseInt(lowStock.rows[0].total) },
      monthlyRevenue: monthlyMerged, topProducts: topProducts.rows, topClients: topClients.rows,
    });
  } catch (error) { res.status(500).json({ error: error.message }); }
};

// ── Exports ───────────────────────────────────────────────────────────────────

module.exports = {
  getAllProducts, getProductById, createProduct, updateProduct, deleteProduct, importProductsCSV,
  getAllCategories, getCategoryById, createCategory, updateCategory, deleteCategory,
  getClientOrders, getAllClients, getClientById, createClient, updateClient, deleteClient, archiveClient, restoreClient,
  getAllOrders, getOrderById, createOrder, cancelOrder, updateOrder, updateOrderStatus,
  shipOrder, clientCreateOrder, getOrderTracking, getOrderStatusHistory, getPendingClientOrders,
  getAllUsers, getAllRoles, updateUser, toggleUserStatus, resetUserPassword, deleteUser,
  getDashboardStats, getSalesByRegion, getAuditLogs,
  registerUser, loginUser,
};
