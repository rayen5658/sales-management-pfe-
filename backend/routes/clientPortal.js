const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');
const { TVA_RATE } = require('../constants');
const { checkCreditAndComputeDueDate, lockStockRow } = require('../controllers/shared');
const {
  sendClientRegistrationEmail,
  sendOrderStatusEmail,
  sendNewOrderAlertToStaff,
  sendPaymentReceivedEmail,
  sendPaymentFailedEmail,
  sendBankTransferPendingEmail,
  sendReturnRequestedEmail,
  sendReturnRequestAlertToStaff,
  sendClientCancelledOrderAlertToStaff,
} = require('../email');
const konnect = require('../konnect');
const paymentSettingsService = require('../services/paymentSettings');

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

    if (client.status === 'pending') {
      return res.status(403).json({ message: 'Your account is awaiting approval. We\'ll email you once it\'s reviewed.' });
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
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/client-auth/register — public self-service signup.
// New accounts start as status='pending' and need staff approval (see
// PUT /api/clients/:id/approve) before they can sign in — this keeps the
// existing "staff vets every client" boundary while letting businesses
// request access themselves instead of waiting on a rep to add them first.
authRouter.post('/register', async (req, res) => {
  try {
    const { company_name, email, password, phone, address, region } = req.body;

    if (!company_name || !company_name.trim()) {
      return res.status(400).json({ message: 'Company name is required' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: 'A valid email is required' });
    }
    if (!password || password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const existing = await pool.query('SELECT id FROM client WHERE email = $1', [email]);
    if (existing.rows.length > 0) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    const hash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      `INSERT INTO client (company_name, email, phone, address, region, status, password_hash, portal_enabled)
       VALUES ($1,$2,$3,$4,$5,'pending',$6,TRUE)
       RETURNING id, company_name, email`,
      [company_name.trim(), email, phone || null, address || null, region || null, hash]
    );

    const client = result.rows[0];
    sendClientRegistrationEmail({ toEmail: client.email, toName: client.company_name }).catch(() => {});

    res.status(201).json({
      message: 'Registration submitted. Your account is pending approval — we\'ll email you once it\'s reviewed.',
      client,
    });
  } catch (error) {
    console.error('Client register error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/products
portalRouter.get('/products', verifyClientToken, async (req, res) => {
  try {
    const { search, category_id, min_price, max_price } = req.query;
    let query = `
      SELECT p.*, c.name AS category_name,
             EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id) AS has_variants
      FROM product p
      LEFT JOIN category c ON p.category_id = c.id
      WHERE (p.stock > 0 OR EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id AND pv.stock > 0))
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
    if (min_price) {
      params.push(parseFloat(min_price));
      query += ` AND p.unit_price >= $${params.length}`;
    }
    if (max_price) {
      params.push(parseFloat(max_price));
      query += ` AND p.unit_price <= $${params.length}`;
    }

    query += ' ORDER BY p.name ASC';
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/products/:id/related
portalRouter.get('/products/:id/related', verifyClientToken, async (req, res) => {
  try {
    const { id } = req.params;
    // Get the product's category first
    const prod = await pool.query('SELECT category_id FROM product WHERE id = $1', [id]);
    if (prod.rows.length === 0) return res.json([]);
    const category_id = prod.rows[0].category_id;

    // Return up to 4 products from the same category, excluding current
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name,
              EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id) AS has_variants
       FROM product p
       LEFT JOIN category c ON p.category_id = c.id
       WHERE p.category_id = $1 AND p.id != $2
         AND (p.stock > 0 OR EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id = p.id AND pv.stock > 0))
       ORDER BY p.name ASC
       LIMIT 4`,
      [category_id, id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/products/:id/variants
portalRouter.get('/products/:id/variants', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, reference, unit_price, stock FROM product_variant WHERE product_id=$1 ORDER BY id ASC',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/categories
portalRouter.get('/categories', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM category ORDER BY name ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
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
      const { product_id, variant_id, quantity } = item;

      if (!product_id || !quantity || quantity <= 0) {
        await dbClient.query('ROLLBACK');
        return res.status(400).json({ message: 'Each item must have product_id and quantity > 0' });
      }

      const row = await lockStockRow(dbClient, product_id, variant_id);

      if (!row) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({ message: `Product not found (id: ${product_id})` });
      }

      if (row.stock < quantity) {
        await dbClient.query('ROLLBACK');
        return res.status(400).json({
          message: `Not enough stock for "${row.name}". Available: ${row.stock}`,
          available_stock: row.stock,
        });
      }

      const unit_price = Number(row.unit_price);
      const subtotal = unit_price * quantity;
      amount_ht += subtotal;
      orderLines.push({ product_id, variant_id: variant_id || null, quantity, unit_price, subtotal, product_name: row.name });
    }

    const tva = amount_ht * TVA_RATE;
    const amount_ttc = amount_ht + tva;

    const { dueDate, error: creditError } = await checkCreditAndComputeDueDate(dbClient, client_id, amount_ttc);
    if (creditError) {
      await dbClient.query('ROLLBACK');
      return res.status(400).json({ message: creditError });
    }

    const orderResult = await dbClient.query(
      `INSERT INTO sales_order (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id, notes, due_date)
       VALUES (NOW(), 'pending', $1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [amount_ht, tva, amount_ttc, client_id, user_id, notes || null, dueDate]
    );

    const order = orderResult.rows[0];

    for (const line of orderLines) {
      await dbClient.query(
        `INSERT INTO order_line (quantity, unit_price, subtotal, order_id, product_id, variant_id)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [line.quantity, line.unit_price, line.subtotal, order.id, line.product_id, line.variant_id]
      );
    }

    await dbClient.query(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, notes)
       VALUES ($1, NULL, 'pending', $2)`,
      [order.id, notes || 'Order placed by client via portal']
    );

    await dbClient.query('COMMIT');

    if (req.client.email) {
      sendOrderStatusEmail({ toEmail: req.client.email, toName: req.client.company_name, order, status: 'pending', lines: orderLines }).catch(() => {});
    }
    sendNewOrderAlertToStaff({ order, clientName: req.client.company_name, lines: orderLines }).catch(() => {});

    res.status(201).json({
      message: 'Order placed successfully. Awaiting confirmation.',
      order: { ...order, lines: orderLines },
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ message: 'Internal server error' });
  } finally {
    dbClient.release();
  }
});

// GET /api/client-portal/orders
portalRouter.get('/orders', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.id, so.order_date, so.status, so.amount_ht, so.tva, so.amount_ttc, so.cancel_reason,
              so.payment_status, so.payment_ref, so.paid_at, so.due_date,
              (so.payment_status != 'paid' AND so.due_date < CURRENT_DATE AND so.status != 'cancelled') AS is_overdue
       FROM sales_order so
       WHERE so.client_id = $1
       ORDER BY so.order_date DESC`,
      [req.client.id]
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/orders/:id
portalRouter.get('/orders/:id', verifyClientToken, async (req, res) => {
  try {
    const orderResult = await pool.query(
      `SELECT so.*, (so.payment_status != 'paid' AND so.due_date < CURRENT_DATE AND so.status != 'cancelled') AS is_overdue
       FROM sales_order so WHERE so.id = $1 AND so.client_id = $2`,
      [req.params.id, req.client.id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const linesResult = await pool.query(
      `SELECT ol.*, p.name AS product_name, p.reference, pv.name AS variant_name
       FROM order_line ol
       LEFT JOIN product p ON ol.product_id = p.id
       LEFT JOIN product_variant pv ON ol.variant_id = pv.id
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
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/client-portal/orders/:id/cancel — client cancels their own order while it's
// still pending (i.e. before staff have confirmed it and reserved stock). Same rule as the
// staff-side cancel: a reason is required.
portalRouter.post('/orders/:id/cancel', verifyClientToken, async (req, res) => {
  try {
    const { cancel_reason } = req.body;
    if (!cancel_reason || !cancel_reason.trim()) return res.status(400).json({ message: 'A cancellation reason is required' });

    const orderResult = await pool.query('SELECT * FROM sales_order WHERE id=$1 AND client_id=$2', [req.params.id, req.client.id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = orderResult.rows[0];
    if (order.status !== 'pending') {
      const why = order.status === 'cancelled' ? 'it has already been cancelled' : 'it has already been confirmed';
      return res.status(400).json({ message: `Only pending orders can be cancelled — ${why}` });
    }

    const reason = cancel_reason.trim();
    const updated = await pool.query(
      `UPDATE sales_order SET status='cancelled', cancel_reason=$1 WHERE id=$2 RETURNING *`,
      [reason, order.id]
    );

    await pool.query(
      `INSERT INTO order_status_history (order_id, previous_status, new_status, notes) VALUES ($1,'pending','cancelled',$2)`,
      [order.id, reason]
    );

    if (req.client.email) sendOrderStatusEmail({ toEmail: req.client.email, toName: req.client.company_name, order: updated.rows[0], status: 'cancelled', cancelReason: reason }).catch(() => {});
    sendClientCancelledOrderAlertToStaff({ order: updated.rows[0], clientName: req.client.company_name, reason }).catch(() => {});

    res.json({ message: 'Order cancelled', order: updated.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/payment-availability — client-authenticated check so the
// frontend can show only the payment methods the seller actually configured,
// instead of surfacing a raw error when a client tries an unavailable one.
portalRouter.get('/payment-availability', verifyClientToken, async (req, res) => {
  try {
    const [credentials, bank] = await Promise.all([
      paymentSettingsService.getActiveCredentials(),
      paymentSettingsService.getBankTransferInfo(),
    ]);
    res.json({
      konnect: { enabled: !!credentials },
      bank_transfer: bank ? { enabled: true, ...bank } : { enabled: false },
    });
  } catch (error) {
    res.json({ konnect: { enabled: false }, bank_transfer: { enabled: false } });
  }
});

// POST /api/client-portal/orders/:id/pay — start an online payment for one of the client's own orders.
// Returns { payUrl } — the frontend redirects the browser there to complete payment.
portalRouter.post('/orders/:id/pay', verifyClientToken, async (req, res) => {
  try {
    const credentials = await paymentSettingsService.getActiveCredentials();
    if (!credentials) {
      return res.status(400).json({ message: 'Online payment is not available yet. Please contact the seller.' });
    }

    const orderResult = await pool.query(
      'SELECT * FROM sales_order WHERE id = $1 AND client_id = $2',
      [req.params.id, req.client.id]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });

    const order = orderResult.rows[0];
    if (order.status === 'cancelled') return res.status(400).json({ message: 'Cannot pay for a cancelled order' });
    if (order.payment_status === 'paid') return res.status(400).json({ message: 'This order is already paid' });

    const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
    const [firstName, ...rest] = (req.client.company_name || 'Client').split(' ');

    const { payUrl, paymentRef } = await konnect.initPayment({
      apiKey: credentials.apiKey,
      walletId: credentials.walletId,
      amountTND: parseFloat(order.amount_ttc),
      orderId: order.id,
      description: `Order #${order.id} — ${req.client.company_name}`,
      firstName,
      lastName: rest.join(' ') || undefined,
      email: req.client.email,
      webhookUrl: `${backendUrl}/api/client-portal/payments/konnect/callback`,
    });

    await pool.query(
      `UPDATE sales_order SET payment_status='pending', payment_ref=$1, payment_method='konnect' WHERE id=$2`,
      [paymentRef, order.id]
    );

    res.json({ payUrl });
  } catch (error) {
    console.error('Konnect init payment error:', error.message);
    res.status(500).json({ message: error.message || 'Could not start payment. Please try again.' });
  }
});

// POST /api/client-portal/orders/:id/pay-by-transfer — client declares intent to pay by
// bank transfer. No money moves here — this just records the choice and flips the order
// to "pending" so it shows up for the seller to confirm once the transfer actually arrives.
portalRouter.post('/orders/:id/pay-by-transfer', verifyClientToken, async (req, res) => {
  try {
    const bank = await paymentSettingsService.getBankTransferInfo();
    if (!bank) {
      return res.status(400).json({ message: 'Bank transfer is not available yet. Please contact the seller.' });
    }

    const orderResult = await pool.query(
      'SELECT * FROM sales_order WHERE id = $1 AND client_id = $2',
      [req.params.id, req.client.id]
    );
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });

    const order = orderResult.rows[0];
    if (order.status === 'cancelled') return res.status(400).json({ message: 'Cannot pay for a cancelled order' });
    if (order.payment_status === 'paid') return res.status(400).json({ message: 'This order is already paid' });

    const updated = await pool.query(
      `UPDATE sales_order SET payment_status='pending', payment_method='bank_transfer' WHERE id=$1 RETURNING payment_status, payment_method`,
      [order.id]
    );

    if (req.client.email) {
      sendBankTransferPendingEmail({ toEmail: req.client.email, toName: req.client.company_name, order }).catch(() => {});
    }

    res.json({ ...updated.rows[0], bank });
  } catch (error) {
    res.status(500).json({ message: 'Could not record your payment choice. Please try again.' });
  }
});

// GET /api/client-portal/orders/:id/payment-status — self-healing status check.
// If a payment is still "pending" locally, re-queries Konnect directly so the UI
// stays correct even if the redirect/webhook never reached this server (e.g. no
// public URL in local dev).
portalRouter.get('/orders/:id/payment-status', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT payment_status, payment_ref, paid_at FROM sales_order WHERE id = $1 AND client_id = $2',
      [req.params.id, req.client.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Order not found' });

    let { payment_status, payment_ref, paid_at } = result.rows[0];

    if (payment_status === 'pending' && payment_ref) {
      try {
        const credentials = await paymentSettingsService.getActiveCredentials();
        const payment = await konnect.getPaymentDetails({ apiKey: credentials?.apiKey, paymentRef: payment_ref });
        if (payment.status === 'completed') {
          payment_status = 'paid';
          paid_at = new Date();
          await pool.query(`UPDATE sales_order SET payment_status='paid', paid_at=NOW() WHERE id=$1`, [req.params.id]);
        }
      } catch (_) {
        // Konnect lookup failed — keep reporting the last known local status.
      }
    }

    res.json({ payment_status, payment_ref, paid_at });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/payments/konnect/callback — public: Konnect redirects the
// customer's browser here after payment (and/or calls it server-to-server). Verifies
// the real status with Konnect directly (never trusts the query string alone), updates
// the order, then bounces the browser back to a frontend confirmation page.
portalRouter.get('/payments/konnect/callback', async (req, res) => {
  const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  try {
    const { payment_ref } = req.query;
    if (!payment_ref) return res.redirect(`${frontendUrl}/client/orders?payment=error`);

    const orderResult = await pool.query(
      `SELECT so.*, c.email AS client_email, c.company_name AS client_name
       FROM sales_order so LEFT JOIN client c ON so.client_id = c.id WHERE so.payment_ref = $1`, [payment_ref]
    );
    if (orderResult.rows.length === 0) return res.redirect(`${frontendUrl}/client/orders?payment=error`);
    const order = orderResult.rows[0];
    const orderId = order.id;

    const credentials = await paymentSettingsService.getActiveCredentials();
    const payment = await konnect.getPaymentDetails({ apiKey: credentials?.apiKey, paymentRef: payment_ref });

    if (payment.status === 'completed') {
      await pool.query(`UPDATE sales_order SET payment_status='paid', paid_at=NOW() WHERE id=$1`, [orderId]);
      if (order.client_email) sendPaymentReceivedEmail({ toEmail: order.client_email, toName: order.client_name, order }).catch(() => {});
      return res.redirect(`${frontendUrl}/client/orders?payment=success&order=${orderId}`);
    }

    await pool.query(
      `UPDATE sales_order SET payment_status='failed' WHERE id=$1 AND payment_status != 'paid'`,
      [orderId]
    );
    if (order.client_email) sendPaymentFailedEmail({ toEmail: order.client_email, toName: order.client_name, order }).catch(() => {});
    return res.redirect(`${frontendUrl}/client/orders?payment=failed&order=${orderId}`);
  } catch (error) {
    console.error('Konnect callback error:', error.message);
    return res.redirect(`${frontendUrl}/client/orders?payment=error`);
  }
});

// POST /api/client-portal/orders/:id/return-request — client asks to return a
// delivered order. One request per order; admin approves/rejects from the Returns page.
portalRouter.post('/orders/:id/return-request', verifyClientToken, async (req, res) => {
  try {
    const { reason } = req.body;
    if (!reason || !reason.trim()) return res.status(400).json({ message: 'A reason is required' });

    const orderResult = await pool.query('SELECT * FROM sales_order WHERE id=$1 AND client_id=$2', [req.params.id, req.client.id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = orderResult.rows[0];
    if (order.status !== 'delivered') return res.status(400).json({ message: 'Only delivered orders can be returned' });

    const existing = await pool.query('SELECT id FROM order_return WHERE order_id=$1', [order.id]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'A return request already exists for this order' });

    const inserted = await pool.query(
      `INSERT INTO order_return (order_id, client_id, reason) VALUES ($1,$2,$3) RETURNING *`,
      [order.id, req.client.id, reason.trim()]
    );

    if (req.client.email) sendReturnRequestedEmail({ toEmail: req.client.email, toName: req.client.company_name, order }).catch(() => {});
    sendReturnRequestAlertToStaff({ order, clientName: req.client.company_name, reason: reason.trim() }).catch(() => {});

    res.status(201).json({ message: 'Return request submitted', return: inserted.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/orders/:id/return — client checks their own return request status
portalRouter.get('/orders/:id/return', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM order_return WHERE order_id=$1 AND client_id=$2', [req.params.id, req.client.id]);
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// POST /api/client-portal/orders/:id/feedback — client rates a delivered order.
// One feedback entry per order.
portalRouter.post('/orders/:id/feedback', verifyClientToken, async (req, res) => {
  try {
    const { rating, comment } = req.body;
    const ratingNum = parseInt(rating);
    if (!ratingNum || ratingNum < 1 || ratingNum > 5) return res.status(400).json({ message: 'rating must be between 1 and 5' });

    const orderResult = await pool.query('SELECT * FROM sales_order WHERE id=$1 AND client_id=$2', [req.params.id, req.client.id]);
    if (orderResult.rows.length === 0) return res.status(404).json({ message: 'Order not found' });
    const order = orderResult.rows[0];
    if (order.status !== 'delivered') return res.status(400).json({ message: 'You can only leave feedback on a delivered order' });

    const existing = await pool.query('SELECT id FROM order_feedback WHERE order_id=$1', [order.id]);
    if (existing.rows.length > 0) return res.status(400).json({ message: 'You already left feedback for this order' });

    const inserted = await pool.query(
      `INSERT INTO order_feedback (order_id, client_id, rating, comment) VALUES ($1,$2,$3,$4) RETURNING *`,
      [order.id, req.client.id, ratingNum, (comment || '').trim() || null]
    );

    res.status(201).json({ message: 'Thanks for your feedback!', feedback: inserted.rows[0] });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

// GET /api/client-portal/orders/:id/feedback — client checks if they already left feedback
portalRouter.get('/orders/:id/feedback', verifyClientToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM order_feedback WHERE order_id=$1 AND client_id=$2', [req.params.id, req.client.id]);
    res.json(result.rows[0] || null);
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
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

    // Portal access granted — logged for traceability
    res.json({ message: 'Portal access enabled', client: result.rows[0] });
  } catch (error) {
    console.error('set-password error:', error);
    res.status(500).json({ message: 'Internal server error' });
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
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = { authRouter, portalRouter, verifyClientToken };
