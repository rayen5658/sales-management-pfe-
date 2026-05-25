const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// ─── Middleware: verify client JWT ───────────────────────────────────────────
function verifyClientToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });

    const token = authHeader.split(' ')[1];
    if (!token) return res.status(401).json({ message: 'Invalid token format' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded.client_portal) {
      return res.status(403).json({ message: 'Access denied: not a client token' });
    }

    req.client = decoded;
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
}

// ─── AUTH ROUTER  (mounted at /api/client-auth) ───────────────────────────────
const authRouter = express.Router();

// POST /api/client-auth/login
authRouter.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const result = await pool.query('SELECT * FROM client WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const client = result.rows[0];

    if (client.status === 'archived') {
      return res.status(403).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    const hasPortalColumns = 'password_hash' in client && 'portal_enabled' in client;
    if (!hasPortalColumns) {
      return res.status(500).json({
        message: 'Portal not configured. Ask your administrator to run migration 002_client_portal.sql in the database.',
      });
    }

    if (!client.password_hash || !client.portal_enabled) {
      return res.status(403).json({ message: 'Portal access not enabled for this account. Please contact your sales representative.' });
    }

    const isValid = await bcrypt.compare(password, client.password_hash);
    if (!isValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { id: client.id, email: client.email, company_name: client.company_name, client_portal: true },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      client: {
        id: client.id,
        company_name: client.company_name,
        email: client.email,
        region: client.region,
        segment: client.segment,
      },
    });
  } catch (error) {
    console.error('Client login error:', error);
    res.status(500).json({ error: error.message });
  }
});

// ─── PORTAL ROUTER  (mounted at /api/client-portal) ──────────────────────────
const portalRouter = express.Router();

// GET /api/client-portal/me
portalRouter.get('/me', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, company_name, email, address, region, phone, segment, status FROM client WHERE id = $1',
      [req.client.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/client-portal/products
portalRouter.get('/products', verifyClientToken, async (req, res) => {
  try {
    const { search, category_id } = req.query;
    let query = `
      SELECT p.*, c.name AS category_name
      FROM product p
      LEFT JOIN category c ON p.category_id = c.id
      WHERE p.stock > 0
    `;
    const params = [];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (p.name ILIKE $${params.length} OR p.reference ILIKE $${params.length})`;
    }
    if (category_id) {
      params.push(category_id);
      query += ` AND p.category_id = $${params.length}`;
    }

    query += ' ORDER BY p.name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/client-portal/categories
portalRouter.get('/categories', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM category ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/client-portal/orders
portalRouter.post('/orders', verifyClientToken, async (req, res) => {
  const dbClient = await pool.connect();
  try {
    const { items, notes } = req.body;
    const client_id = req.client.id;

    if (!items || items.length === 0) {
      return res.status(400).json({ message: 'At least one item is required' });
    }

    const userResult = await dbClient.query(
      `SELECT id FROM app_user WHERE role_id IN
       (SELECT id FROM role WHERE name IN ('Administrator', 'Manager', 'Sales Agent'))
       LIMIT 1`
    );
    const user_id = userResult.rows[0]?.id || 1;

    await dbClient.query('BEGIN');

    let amount_ht = 0;
    const orderLines = [];

    for (const item of items) {
      const { product_id, quantity } = item;

      if (!product_id || !quantity || quantity <= 0) {
        await dbClient.query('ROLLBACK');
        return res.status(400).json({ message: 'Each item must have product_id and quantity > 0' });
      }

      const productResult = await dbClient.query(
        'SELECT * FROM product WHERE id = $1 AND stock > 0',
        [product_id]
      );

      if (productResult.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ message: `Product not found or out of stock (id: ${product_id})` });
      }

      const product = productResult.rows[0];

      if (product.stock < quantity) {
        await dbClient.query('ROLLBACK');
        return res.status(400).json({
          message: `Not enough stock for "${product.name}". Available: ${product.stock}`,
          available_stock: product.stock,
        });
      }

      const unit_price = Number(product.unit_price);
      const subtotal = unit_price * quantity;
      amount_ht += subtotal;
      orderLines.push({ product_id, quantity, unit_price, subtotal, product_name: product.name });
    }

    const tva = amount_ht * 0.19;
    const amount_ttc = amount_ht + tva;

    const orderResult = await dbClient.query(
      `INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
       VALUES (NOW(), 'pending', $1, $2, $3, $4, $5) RETURNING *`,
      [amount_ht, tva, amount_ttc, client_id, user_id]
    );

    const order = orderResult.rows[0];

    for (const line of orderLines) {
      await dbClient.query(
        `INSERT INTO order_line (quantity, unit_price, subtotal, order_id, product_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [line.quantity, line.unit_price, line.subtotal, order.id, line.product_id]
      );
    }

    await dbClient.query(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, notes)
       VALUES ($1, NULL, 'pending', $2)`,
      [order.id, notes || 'Order placed by client via portal']
    );

    await dbClient.query('COMMIT');

    res.status(201).json({
      message: 'Order placed successfully. Awaiting confirmation.',
      order: { ...order, lines: orderLines },
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    dbClient.release();
  }
});

// GET /api/client-portal/orders
portalRouter.get('/orders', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.id, so.order_date, so.status, so.amount_ht, so.tva, so.amount_ttc, so.cancel_reason
       FROM sales_order so
       WHERE so.client_id = $1
       ORDER BY so.order_date DESC`,
      [req.client.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/client-portal/orders/:id
portalRouter.get('/orders/:id', verifyClientToken, async (req, res) => {
  try {
    const orderResult = await pool.query(
      'SELECT * FROM sales_order WHERE id = $1 AND client_id = $2',
      [req.params.id, req.client.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const linesResult = await pool.query(
      `SELECT ol.*, p.name AS product_name, p.reference
       FROM order_line ol
       LEFT JOIN product p ON ol.product_id = p.id
       WHERE ol.order_id = $1`,
      [req.params.id]
    );

    const historyResult = await pool.query(
      `SELECT osh.new_status, osh.previous_status, osh.changed_at, osh.notes
       FROM order_status_history osh
       WHERE osh.order_id = $1
       ORDER BY osh.changed_at ASC`,
      [req.params.id]
    );

    res.json({
      order: orderResult.rows[0],
      lines: linesResult.rows,
      history: historyResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/client-portal/admin/set-password  (staff JWT required)
portalRouter.post('/admin/set-password', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.client_portal) return res.status(403).json({ message: 'Staff access required' });
    if (!['Administrator', 'Manager'].includes(decoded.role_name)) {
      return res.status(403).json({ message: 'Administrator or Manager required' });
    }

    const { client_id, password } = req.body;
    if (!client_id || !password || password.length < 6) {
      return res.status(400).json({ message: 'client_id and password (min 6 chars) required' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `UPDATE client SET password_hash = $1, portal_enabled = TRUE WHERE id = $2 RETURNING id, company_name, email`,
      [hash, client_id]
    );

    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });

    console.log(`✅ Portal enabled for client ${result.rows[0].company_name} (id: ${client_id})`);
    res.json({ message: 'Portal access enabled', client: result.rows[0] });
  } catch (error) {
    console.error('set-password error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/client-portal/admin/disable-portal  (staff JWT required)
portalRouter.post('/admin/disable-portal', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader) return res.status(401).json({ message: 'No token provided' });
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    if (decoded.client_portal) return res.status(403).json({ message: 'Staff access required' });
    if (!['Administrator', 'Manager'].includes(decoded.role_name)) {
      return res.status(403).json({ message: 'Administrator or Manager required' });
    }

    const { client_id } = req.body;
    if (!client_id) return res.status(400).json({ message: 'client_id required' });

    await pool.query('UPDATE client SET portal_enabled = FALSE WHERE id = $1', [client_id]);
    res.json({ message: 'Portal access disabled' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = { authRouter, portalRouter, verifyClientToken };
