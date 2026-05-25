const pool = require('./db');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
// HELPER — write audit log (used internally)
const writeAuditLog = async (user_id, action, details) => {
  try {
    await pool.query(
      'INSERT INTO audit_log (user_id, action, details, timestamp) VALUES ($1, $2, $3, NOW())',
      [user_id, action, details]
    );
  } catch (_) {
    /* non-blocking */
  }
};
// GET ALL PRODUCTS
const getAllProducts = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM product');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ONE PRODUCT
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM product WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CREATE PRODUCT
const createProduct = async (req, res) => {
  try {
    const { reference, name, description, unit_price, stock, image, category_id } = req.body;

    const result = await pool.query(
      `INSERT INTO product (reference, name, description, unit_price, stock, image, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [reference, name, description, unit_price, stock, image || null, category_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE PRODUCT
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { reference, name, description, unit_price, stock, image, category_id } = req.body;

    const result = await pool.query(
      `UPDATE product 
       SET reference = $1, name = $2, description = $3, unit_price = $4, stock = $5, image = $6, category_id = $7
       WHERE id = $8
       RETURNING *`,
      [reference, name, description, unit_price, stock, image || null, category_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM product WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Product deleted successfully',
      product: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL CATEGORIES
const getAllCategories = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.id) AS product_count
      FROM category c
      LEFT JOIN product p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.id ASC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ONE CATEGORY
const getCategoryById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM category WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CREATE CATEGORY
const createCategory = async (req, res) => {
  try {
    const { name, description, image, parent_id } = req.body;

    const result = await pool.query(
      `INSERT INTO category (name, description, image, parent_id)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [name, description || null, image || null, parent_id || null]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE CATEGORY
const updateCategory = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, image, parent_id } = req.body;

    const result = await pool.query(
      `UPDATE category
       SET name = $1, description = $2, image = $3, parent_id = $4
       WHERE id = $5
       RETURNING *`,
      [name, description || null, image || null, parent_id || null, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE CATEGORY
const deleteCategory = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM category WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Category not found' });
    }

    res.json({
      message: 'Category deleted successfully',
      category: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// GET CLIENT ORDER HISTORY
const getClientOrders = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT so.id, so.order_date, so.status, so.amount_ht, so.tva, so.amount_ttc, so.cancel_reason
      FROM sales_order so
      WHERE so.client_id = $1
      ORDER BY so.order_date DESC
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL CLIENTS
const getAllClients = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM client ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ONE CLIENT
const getClientById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM client WHERE id = $1',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// CREATE CLIENT
const createClient = async (req, res) => {
  try {
    const { company_name, address, region, email, phone, segment, status } = req.body;

    const result = await pool.query(
      `INSERT INTO client (company_name, address, region, email, phone, segment, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        company_name,
        address || null,
        region || null,
        email || null,
        phone || null,
        segment || null,
        status || null
      ]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE CLIENT
const updateClient = async (req, res) => {
  try {
    const { id } = req.params;
    const { company_name, address, region, email, phone, segment, status } = req.body;

    const result = await pool.query(
      `UPDATE client
       SET company_name = $1,
           address = $2,
           region = $3,
           email = $4,
           phone = $5,
           segment = $6,
           status = $7
       WHERE id = $8
       RETURNING *`,
      [
        company_name,
        address || null,
        region || null,
        email || null,
        phone || null,
        segment || null,
        status || null,
        id
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE CLIENT (hard delete — kept for admin use)
const deleteClient = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM client WHERE id = $1 RETURNING *',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Client not found' });
    }

    res.json({
      message: 'Client deleted successfully',
      client: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// ARCHIVE CLIENT (soft delete — sets status to 'archived')
const archiveClient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE client SET status = 'archived' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    await writeAuditLog(req.user?.id, 'CLIENT_ARCHIVE', `Client #${id} archivé`);
    res.json({ message: 'Client archivé', client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RESTORE CLIENT (unarchive — sets status back to 'active')
const restoreClient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE client SET status = 'active' WHERE id = $1 RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    await writeAuditLog(req.user?.id, 'CLIENT_RESTORE', `Client #${id} restauré`);
    res.json({ message: 'Client restauré', client: result.rows[0] });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// GET ALL ORDERS
const getAllOrders = async (req, res) => {
  try {
    const { status, client_id, date_from, date_to, min_amount, max_amount } = req.query;

    let where = [];
    let params = [];
    let i = 1;

    if (status)     { where.push(`so.status = $${i++}`);                    params.push(status); }
    if (client_id)  { where.push(`so.client_id = $${i++}`);                 params.push(client_id); }
    if (date_from)  { where.push(`so.order_date >= $${i++}`);               params.push(date_from); }
    if (date_to)    { where.push(`so.order_date <= $${i++}::date + 1`);     params.push(date_to); }
    if (min_amount) { where.push(`so.amount_ttc >= $${i++}`);               params.push(min_amount); }
    if (max_amount) { where.push(`so.amount_ttc <= $${i++}`);               params.push(max_amount); }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const result = await pool.query(`
      SELECT
        so.*,
        c.company_name AS client_name,
        u.firstname    AS user_firstname,
        u.lastname     AS user_lastname
      FROM sales_order so
      LEFT JOIN client   c ON so.client_id = c.id
      LEFT JOIN app_user u ON so.user_id   = u.id
      ${whereClause}
      ORDER BY so.order_date DESC, so.id DESC
    `, params);

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ONE ORDER WITH LINES
const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const orderResult = await pool.query(
      `
      SELECT 
        so.*,
        c.company_name AS client_name,
        u.firstname AS user_firstname,
        u.lastname AS user_lastname
      FROM sales_order so
      LEFT JOIN client c ON so.client_id = c.id
      LEFT JOIN app_user u ON so.user_id = u.id
      WHERE so.id = $1
      `,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    const linesResult = await pool.query(
      `
      SELECT 
        ol.*,
        p.name AS product_name,
        p.reference AS product_reference
      FROM order_line ol
      LEFT JOIN product p ON ol.product_id = p.id
      WHERE ol.order_id = $1
      ORDER BY ol.id ASC
      `,
      [id]
    );

    res.json({
      order: orderResult.rows[0],
      lines: linesResult.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// CREATE ORDER WITH STOCK LOGIC
const createOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const { client_id, user_id, items } = req.body;

    if (!client_id || !user_id || !items || items.length === 0) {
      return res.status(400).json({
        message: 'client_id, user_id and items are required',
      });
    }

    await client.query('BEGIN');

    let amount_ht = 0;
    const orderLines = [];

    for (const item of items) {
      const { product_id, quantity } = item;

      const productResult = await client.query(
        'SELECT * FROM product WHERE id = $1',
        [product_id]
      );

      if (productResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({
          message: `Product with id ${product_id} not found`,
        });
      }

      const product = productResult.rows[0];

      if (product.stock < quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          message: `Not enough stock for product ${product.name}`,
          available_stock: product.stock,
        });
      }

      const unit_price = Number(product.unit_price);
      const subtotal = unit_price * quantity;

      amount_ht += subtotal;

      orderLines.push({
        product_id,
        quantity,
        unit_price,
        subtotal,
      });
    }

    const tva = amount_ht * 0.19;
    const amount_ttc = amount_ht + tva;

    const orderResult = await client.query(
      `INSERT INTO sales_order 
       (order_date, status, amount_ht, tva, amount_ttc, cancel_reason, client_id, user_id)
       VALUES (NOW(), $1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      ['confirmed', amount_ht, tva, amount_ttc, null, client_id, user_id]
    );

    const order = orderResult.rows[0];

    for (const line of orderLines) {
      await client.query(
        `INSERT INTO order_line 
         (quantity, unit_price, subtotal, order_id, product_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          line.quantity,
          line.unit_price,
          line.subtotal,
          order.id,
          line.product_id,
        ]
      );

      await client.query(
        `UPDATE product 
         SET stock = stock - $1
         WHERE id = $2`,
        [line.quantity, line.product_id]
      );
    }

    await client.query('COMMIT');

    res.status(201).json({
      message: 'Order created successfully',
      order,
      lines: orderLines,
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};
// CANCEL ORDER AND RESTORE STOCK
const cancelOrder = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;
    const { cancel_reason } = req.body;

    await client.query('BEGIN');

    const orderResult = await client.query(
      'SELECT * FROM sales_order WHERE id = $1',
      [id]
    );

    if (orderResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }

    const order = orderResult.rows[0];

    if (order.status === 'cancelled') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Order is already cancelled' });
    }

    if (order.status === 'delivered') {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cannot cancel a delivered order' });
    }

    const linesResult = await client.query(
      'SELECT * FROM order_line WHERE order_id = $1',
      [id]
    );

    for (const line of linesResult.rows) {
      await client.query(
        `UPDATE product
         SET stock = stock + $1
         WHERE id = $2`,
        [line.quantity, line.product_id]
      );
    }

    const updatedOrderResult = await client.query(
      `UPDATE sales_order
       SET status = $1,
           cancel_reason = $2
       WHERE id = $3
       RETURNING *`,
      ['cancelled', cancel_reason || 'No reason provided', id]
    );

    await client.query('COMMIT');

    // Audit log
    await writeAuditLog(req.user?.id, 'ORDER_CANCEL', `Commande #${id} annulée — motif: ${cancel_reason || 'Non spécifié'}`);

    res.json({
      message: 'Order cancelled successfully and stock restored',
      order: updatedOrderResult.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    client.release();
  }
};
// REGISTER USER
const registerUser = async (req, res) => {
  try {
    const { firstname, lastname, email, password, role_id } = req.body;

    if (!firstname || !lastname || !email || !password || !role_id) {
      return res.status(400).json({
        message: 'firstname, lastname, email, password and role_id are required',
      });
    }

    const existingUser = await pool.query(
      'SELECT * FROM app_user WHERE email = $1',
      [email]
    );

    if (existingUser.rows.length > 0) {
      return res.status(400).json({ message: 'Email already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO app_user 
       (firstname, lastname, email, password_hash, status, last_login, role_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, firstname, lastname, email, status, role_id`,
      [
        firstname,
        lastname,
        email,
        hashedPassword,
        'active',
        null,
        role_id,
      ]
    );

    res.status(201).json({
      message: 'User registered successfully',
      user: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// LOGIN USER
const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        message: 'email and password are required',
      });
    }

    const result = await pool.query(
      `SELECT 
        u.id,
        u.firstname,
        u.lastname,
        u.email,
        u.password_hash,
        u.status,
        u.role_id,
        r.name AS role_name
       FROM app_user u
       LEFT JOIN role r ON u.role_id = r.id
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const user = result.rows[0];

    if (user.status !== 'active') {
      return res.status(403).json({ message: 'User account is not active' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password_hash);

    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    await pool.query(
      'UPDATE app_user SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Audit log — login
    await writeAuditLog(user.id, 'LOGIN', `Connexion réussie — ${user.email}`);

    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role_id: user.role_id,
        role_name: user.role_name,
      },
      process.env.JWT_SECRET,
      { expiresIn: '1d' }
    );

    res.json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        firstname: user.firstname,
        lastname: user.lastname,
        email: user.email,
        status: user.status,
        role_id: user.role_id,
        role_name: user.role_name,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
// UPDATE ORDER (only if status is pending or confirmed)
const updateOrder = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { client_id, items } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ message: 'items are required and must be a non-empty array' });
    }

    await client.query('BEGIN');


    const orderResult = await client.query('SELECT * FROM sales_order WHERE id = $1', [id]);
    if (orderResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Order not found' }); }

    const order = orderResult.rows[0];
    if (!['pending', 'confirmed'].includes(order.status)) {
      await client.query('ROLLBACK');
      return res.status(400).json({ message: 'Cannot edit order — status is ' + order.status });
    }

    // Restore stock from old lines
    const oldLines = await client.query('SELECT * FROM order_line WHERE order_id = $1', [id]);
    for (const line of oldLines.rows) {
      await client.query('UPDATE product SET stock = stock + $1 WHERE id = $2', [line.quantity, line.product_id]);
    }
    await client.query('DELETE FROM order_line WHERE order_id = $1', [id]);

    // Recalculate with new items
    let amount_ht = 0;
    const newLines = [];
    for (const item of items) {
      const pr = await client.query('SELECT * FROM product WHERE id = $1', [item.product_id]);
      if (pr.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: `Product ${item.product_id} not found` }); }
      const product = pr.rows[0];
      if (product.stock < item.quantity) { await client.query('ROLLBACK'); return res.status(400).json({ message: `Stock insuffisant pour ${product.name}` }); }
      const subtotal = Number(product.unit_price) * item.quantity;
      amount_ht += subtotal;
      newLines.push({ product_id: item.product_id, quantity: item.quantity, unit_price: Number(product.unit_price), subtotal });
    }

    const tva = amount_ht * 0.19;
    const amount_ttc = amount_ht + tva;

    await client.query(
      'UPDATE sales_order SET client_id=$1, amount_ht=$2, tva=$3, amount_ttc=$4 WHERE id=$5',
      [client_id || order.client_id, amount_ht, tva, amount_ttc, id]
    );

    for (const line of newLines) {
      await client.query('INSERT INTO order_line (order_id, product_id, quantity, unit_price, subtotal) VALUES ($1,$2,$3,$4,$5)',
        [id, line.product_id, line.quantity, line.unit_price, line.subtotal]);
      await client.query('UPDATE product SET stock = stock - $1 WHERE id = $2', [line.quantity, line.product_id]);
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
  const dbClient = await pool.connect();
  try {
    const { id } = req.params;
    const { status, notes } = req.body;
    const changedBy = req.user.id || req.user.user_id; // Admin user ID

    const allowed = ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled'];
    if (!allowed.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    await dbClient.query('BEGIN');

    // Get current order status
    const currentResult = await dbClient.query(
      'SELECT status FROM sales_order WHERE id = $1',
      [id]
    );

    if (currentResult.rows.length === 0) {
      await dbClient.query('ROLLBACK');
      return res.status(404).json({ message: 'Order not found' });
    }

    const previousStatus = currentResult.rows[0].status;

    // Update order status
    const result = await dbClient.query(
      `UPDATE sales_order SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
      [status, id]
    );

    // Log status change in history
    await dbClient.query(
      `INSERT INTO order_status_history 
       (order_id, previous_status, new_status, changed_by, notes)
       VALUES ($1, $2, $3, $4, $5)`,
      [id, previousStatus, status, changedBy, notes || null]
    );

    await dbClient.query('COMMIT');

    res.json({ 
      message: 'Order status updated successfully',
      order: result.rows[0] 
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    res.status(500).json({ error: error.message });
  } finally {
    dbClient.release();
  }
};

// CLIENT: Create order (using authenticated client's ID)
const clientCreateOrder = async (req, res) => {
  const dbClient = await pool.connect();

  try {
    const { items, notes } = req.body;
    const client_id = req.user.id || req.user.user_id; // Get client ID from auth token
    
    // Get a system user (admin or sales agent) for order creation
    const userResult = await dbClient.query(
      `SELECT id FROM app_user WHERE role_id IN 
       (SELECT id FROM role WHERE name IN ('Administrator', 'Manager', 'Sales Agent')) 
       LIMIT 1`
    );
    
    const user_id = userResult.rows[0]?.id || 1; // Fallback to user 1

    if (!items || items.length === 0) {
      return res.status(400).json({
        message: 'Items are required',
      });
    }

    await dbClient.query('BEGIN');

    let amount_ht = 0;
    const orderLines = [];

    // Validate and calculate totals
    for (const item of items) {
      const { product_id, quantity } = item;

      if (!product_id || !quantity || quantity <= 0) {
        await dbClient.query('ROLLBACK');
        return res.status(400).json({
          message: 'Each item must have product_id and quantity > 0',
        });
      }

      const productResult = await dbClient.query(
        'SELECT * FROM product WHERE id = $1',
        [product_id]
      );

      if (productResult.rows.length === 0) {
        await dbClient.query('ROLLBACK');
        return res.status(404).json({
          message: `Product with id ${product_id} not found`,
        });
      }

      const product = productResult.rows[0];

      if (product.stock < quantity) {
        await dbClient.query('ROLLBACK');
        return res.status(400).json({
          message: `Not enough stock for product "${product.name}". Available: ${product.stock}`,
          available_stock: product.stock,
          product_id: product_id,
        });
      }

      const unit_price = Number(product.unit_price);
      const subtotal = unit_price * quantity;
      amount_ht += subtotal;

      orderLines.push({
        product_id,
        quantity,
        unit_price,
        subtotal,
        product_name: product.name,
      });
    }

    const tva = amount_ht * 0.19;
    const amount_ttc = amount_ht + tva;

    // Create order in "pending" status (awaiting admin confirmation)
    const orderResult = await dbClient.query(
      `INSERT INTO sales_order 
       (order_date, status, amount_ht, tva, amount_ttc, client_id, user_id)
       VALUES (NOW(), $1, $2, $3, $4, $5, $6)
       RETURNING *`,
      ['pending', amount_ht, tva, amount_ttc, client_id, user_id]
    );

    const order = orderResult.rows[0];

    // Insert order lines
    for (const line of orderLines) {
      await dbClient.query(
        `INSERT INTO order_line 
         (quantity, unit_price, subtotal, order_id, product_id)
         VALUES ($1, $2, $3, $4, $5)`,
        [line.quantity, line.unit_price, line.subtotal, order.id, line.product_id]
      );

      // Reserve stock (don't deduct until admin confirms)
      // Stock will be deducted when status changes to "confirmed"
    }

    // Log initial creation
    await dbClient.query(
      `INSERT INTO order_status_history 
       (order_id, previous_status, new_status, notes)
       VALUES ($1, NULL, $2, $3)`,
      [order.id, 'pending', notes || 'Order placed by client']
    );

    await dbClient.query('COMMIT');

    res.status(201).json({
      message: 'Order created successfully. Awaiting admin confirmation.',
      order: {
        ...order,
        lines: orderLines,
        amount_ht,
        tva,
        amount_ttc,
      },
      status_message: 'Your order is pending admin approval',
    });
  } catch (error) {
    await dbClient.query('ROLLBACK');
    console.error('Client order creation error:', error);
    res.status(500).json({ error: error.message });
  } finally {
    dbClient.release();
  }
};

// Get complete order status history/tracking
const getOrderStatusHistory = async (req, res) => {
  try {
    const { id } = req.params;

    // Get order details
    const orderResult = await pool.query(
      `SELECT so.*, c.company_name AS client_name 
       FROM sales_order so
       LEFT JOIN client c ON so.client_id = c.id
       WHERE so.id = $1`,
      [id]
    );

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ message: 'Order not found' });
    }

    // Get complete status history
    const historyResult = await pool.query(
      `SELECT 
        osh.*,
        u.firstname AS user_firstname,
        u.lastname AS user_lastname,
        u.email AS user_email
       FROM order_status_history osh
       LEFT JOIN app_user u ON osh.changed_by = u.id
       WHERE osh.order_id = $1
       ORDER BY osh.changed_at ASC`,
      [id]
    );

    // Get order lines
    const linesResult = await pool.query(
      `SELECT ol.*, p.name AS product_name, p.reference
       FROM order_line ol
       LEFT JOIN product p ON ol.product_id = p.id
       WHERE ol.order_id = $1`,
      [id]
    );

    res.json({
      order: orderResult.rows[0],
      history: historyResult.rows,
      lines: linesResult.rows,
      summary: {
        total_changes: historyResult.rows.length,
        current_status: orderResult.rows[0].status,
        created_at: orderResult.rows[0].order_date,
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Admin: Get orders pending client creation (awaiting admin action)
const getPendingClientOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        so.*,
        c.company_name AS client_name,
        c.email AS client_email,
        u.firstname AS created_by_firstname,
        u.lastname AS created_by_lastname
       FROM sales_order so
       LEFT JOIN client c ON so.client_id = c.id
       LEFT JOIN app_user u ON so.user_id = u.id
       WHERE so.status = 'pending'
       ORDER BY so.order_date DESC`
    );

    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL USERS
const getAllUsers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT u.id, u.firstname, u.lastname, u.email, u.status, u.last_login, u.role_id, r.name AS role_name
       FROM app_user u LEFT JOIN role r ON u.role_id = r.id ORDER BY u.id ASC`
    );
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET ALL ROLES
const getAllRoles = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM role ORDER BY id ASC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// UPDATE USER
const updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { firstname, lastname, email, role_id, status } = req.body;
    const result = await pool.query(
      `UPDATE app_user SET firstname=$1, lastname=$2, email=$3, role_id=$4, status=$5 WHERE id=$6 RETURNING id, firstname, lastname, email, role_id, status`,
      [firstname, lastname, email, role_id, status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// TOGGLE USER STATUS
const toggleUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const result = await pool.query(
      `UPDATE app_user SET status=$1 WHERE id=$2 RETURNING id, firstname, lastname, email, status`,
      [status, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    await writeAuditLog(req.user?.id, 'USER_STATUS_CHANGE', `Utilisateur #${id} — statut changé en "${status}"`);
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// RESET USER PASSWORD
const resetUserPassword = async (req, res) => {
  try {
    const { id } = req.params;
    const { password } = req.body;
    if (!password || password.length < 6) return res.status(400).json({ message: 'Password must be at least 6 characters' });
    const hashed = await bcrypt.hash(password, 10);
    await pool.query('UPDATE app_user SET password_hash=$1 WHERE id=$2', [hashed, id]);
    await writeAuditLog(req.user?.id, 'PASSWORD_RESET', `Mot de passe réinitialisé pour utilisateur #${id}`);
    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DELETE USER
const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query('DELETE FROM app_user WHERE id=$1 RETURNING id, email', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'User not found' });
    await writeAuditLog(req.user?.id, 'USER_DELETE', `Utilisateur supprimé — #${id} (${result.rows[0].email})`);
    res.json({ message: 'User deleted' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// GET AUDIT LOGS
const getAuditLogs = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        al.id, al.action, al.details, al.timestamp,
        al.user_id,
        u.firstname || ' ' || u.lastname AS user_name,
        u.email AS user_email
      FROM audit_log al
      LEFT JOIN app_user u ON al.user_id = u.id
      ORDER BY al.timestamp DESC
      LIMIT 200
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// SALES BY REGION
const getSalesByRegion = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        c.region,
        COUNT(DISTINCT so.id) AS orders,
        COALESCE(SUM(so.amount_ttc), 0) AS revenue,
        COALESCE(AVG(so.amount_ttc), 0) AS avg_order
      FROM sales_order so
      JOIN client c ON so.client_id = c.id
      WHERE so.status != 'cancelled' AND c.region IS NOT NULL
      GROUP BY c.region
      ORDER BY revenue DESC
    `);
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// DASHBOARD STATS — supports ?period=week|month|quarter|year|all&user_id=X&region=X
const getDashboardStats = async (req, res) => {
  try {
    const { period = 'year', user_id, region } = req.query;

    // Build date filter based on period
    const periodFilter = {
      week:    `order_date >= NOW() - INTERVAL '7 days'`,
      month:   `order_date >= DATE_TRUNC('month', NOW())`,
      quarter: `order_date >= DATE_TRUNC('quarter', NOW())`,
      year:    `EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM NOW())`,
      all:     `1=1`,
    };
    const dateWhere = periodFilter[period] || periodFilter.year;
    const params = [];
    // Add commercial filter if user_id provided (parameterized)
    const userFilter = user_id ? `AND so.user_id = $${params.push(parseInt(user_id))}` : '';

    // Region filter (parameterized)
    const regionFilter = region ? `AND c.region = $${params.push(region)}` : '';

    // KPIs — filtered by period
    const revenue  = await pool.query(`SELECT COALESCE(SUM(amount_ttc),0) AS total FROM sales_order so LEFT JOIN client c ON so.client_id = c.id WHERE so.status != 'cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}`,[...params]);

    const ordersQ  = await pool.query(`SELECT COUNT(*) AS total FROM sales_order so LEFT JOIN client c ON so.client_id = c.id WHERE ${dateWhere} ${userFilter} ${regionFilter}`,[...params]);


    const clients  = await pool.query(`SELECT COUNT(*) AS total FROM client WHERE status='active'`);
    const products = await pool.query(`SELECT COUNT(*) AS total FROM product`);
    const lowStock = await pool.query(`SELECT COUNT(*) AS total FROM product WHERE stock <= 5`);

    // Previous period revenue for comparison
    const prevFilter = {
      week:    `order_date >= NOW() - INTERVAL '14 days' AND order_date < NOW() - INTERVAL '7 days'`,
      month:   `order_date >= DATE_TRUNC('month', NOW()) - INTERVAL '1 month' AND order_date < DATE_TRUNC('month', NOW())`,
      quarter: `order_date >= DATE_TRUNC('quarter', NOW()) - INTERVAL '3 months' AND order_date < DATE_TRUNC('quarter', NOW())`,
      year:    `EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM NOW()) - 1`,
      all:     `1=0`,
    };
    const prevRevenue = await pool.query(`SELECT COALESCE(SUM(amount_ttc),0) AS total FROM sales_order so LEFT JOIN client c ON so.client_id = c.id WHERE so.status != 'cancelled' AND ${prevFilter[period] || prevFilter.year} ${userFilter} ${regionFilter}`,[...params]);


    const currentRev = parseFloat(revenue.rows[0].total);
    const prevRev    = parseFloat(prevRevenue.rows[0].total);
    const variation  = prevRev > 0 ? (((currentRev - prevRev) / prevRev) * 100).toFixed(1) : null;

    // Projection — apply same growth rate to current revenue
    const growthRate = prevRev > 0 ? (currentRev - prevRev) / prevRev : 0;
    const projection = Math.round(currentRev * (1 + growthRate));

    // Monthly revenue chart — current year, respects region + commercial filters
    const monthly = await pool.query(`
      SELECT 
        TO_CHAR(so.order_date, 'Mon') AS month,
        EXTRACT(MONTH FROM so.order_date) AS month_num,
        COALESCE(SUM(so.amount_ttc), 0) AS revenue,
        COUNT(*) AS orders
      FROM sales_order so
      LEFT JOIN client c ON so.client_id = c.id
      WHERE so.status != 'cancelled'
        AND EXTRACT(YEAR FROM so.order_date) = EXTRACT(YEAR FROM NOW())
        ${userFilter} ${regionFilter}
      GROUP BY month, month_num
      ORDER BY month_num ASC
    `, [...params]);

    // Previous year monthly for N vs N-1 comparison, same filters
    const monthlyPrev = await pool.query(`
      SELECT 
        TO_CHAR(so.order_date, 'Mon') AS month,
        EXTRACT(MONTH FROM so.order_date) AS month_num,
        COALESCE(SUM(so.amount_ttc), 0) AS revenue_prev
      FROM sales_order so
      LEFT JOIN client c ON so.client_id = c.id
      WHERE so.status != 'cancelled'
        AND EXTRACT(YEAR FROM so.order_date) = EXTRACT(YEAR FROM NOW()) - 1
        ${userFilter} ${regionFilter}
      GROUP BY month, month_num
      ORDER BY month_num ASC
    `, [...params]);

    // Merge current + previous year into one array
    const prevMap = {};
    monthlyPrev.rows.forEach(r => { prevMap[r.month_num] = parseFloat(r.revenue_prev); });
    const monthlyMerged = monthly.rows.map(r => ({
      month:        r.month,
      revenue:      parseFloat(r.revenue),
      revenue_prev: prevMap[r.month_num] || 0,
      orders:       parseInt(r.orders),
    }));


    // Top products — filtered by period + commercial + region
    const topProducts = await pool.query(`
      SELECT p.name, SUM(ol.quantity) AS qty, SUM(ol.subtotal) AS revenue
      FROM order_line ol
      JOIN product p ON ol.product_id = p.id
      JOIN sales_order so ON ol.order_id = so.id
      LEFT JOIN client c ON so.client_id = c.id
      WHERE so.status != 'cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}
      GROUP BY p.name

      ORDER BY qty DESC
      LIMIT 5
    `, [...params]);

    // Top clients — filtered by period + commercial + region
    const topClients = await pool.query(`
      SELECT 
        c.company_name AS name,
        COUNT(so.id) AS orders,
        COALESCE(SUM(so.amount_ttc),0) AS revenue,
        MAX(so.order_date) AS last_order_date,
        ROUND(EXTRACT(DAY FROM NOW() - MAX(so.order_date)) / 30) AS inactive_months
      FROM sales_order so
      JOIN client c ON so.client_id = c.id
      WHERE so.status != 'cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}
      GROUP BY c.company_name

      ORDER BY revenue DESC
      LIMIT 5
    `, [...params]);

    res.json({
      period,
      kpis: {
        totalRevenue:     currentRev,
        prevRevenue:      prevRev,
        variation:        variation,
        projection:       projection,
        totalOrders:      parseInt(ordersQ.rows[0].total),
        activeClients:    parseInt(clients.rows[0].total),
        totalProducts:    parseInt(products.rows[0].total),
        lowStockProducts: parseInt(lowStock.rows[0].total),
      },
      monthlyRevenue: monthlyMerged,
      topProducts:    topProducts.rows,
      topClients:     topClients.rows,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// IMPORT PRODUCTS FROM CSV
const importProductsCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  const filePath = req.file.path;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM
    const lines = raw.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Le fichier est vide ou ne contient que l\'en-tête' });
    }

    // Detect separator (semicolon or comma)
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0].split(sep).map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));

    // Expected columns (flexible mapping)
    const col = (names) => {
      for (const n of names) {
        const idx = headers.indexOf(n);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const iName     = col(['nom', 'name']);
    const iRef      = col(['reference', 'ref', 'sku']);
    const iDesc     = col(['description', 'desc']);
    const iPrice    = col(['prix', 'price', 'prixht', 'unitprice', 'unit_price', 'prixunitaire']);
    const iStock    = col(['stock', 'quantite', 'quantity', 'qty']);
    const iCat      = col(['categorie', 'category', 'category_id', 'categorieid', 'catid']);
    const iImage    = col(['image', 'img', 'imageurl']);

    if (iName === -1 || iPrice === -1 || iStock === -1) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: 'Colonnes requises manquantes. Le fichier doit contenir : nom (ou name), prix (ou price), stock',
      });
    }

    // Load categories for name→id resolution
    const catsResult = await pool.query('SELECT id, name FROM category');
    const catMap = {};
    catsResult.rows.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

    const results = { inserted: 0, updated: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      const name = cols[iName]?.trim();
      if (!name) continue;

      const reference  = iRef   !== -1 ? cols[iRef]?.trim()   || null : null;
      const description= iDesc  !== -1 ? cols[iDesc]?.trim()  || null : null;
      const unit_price = parseFloat((cols[iPrice] || '0').replace(',', '.'));
      const stock      = parseInt(cols[iStock] || '0', 10);
      const image      = iImage !== -1 ? cols[iImage]?.trim() || null : null;

      // Resolve category: accept id number or category name
      let category_id = null;
      if (iCat !== -1 && cols[iCat]) {
        const raw = cols[iCat].trim();
        if (/^\d+$/.test(raw)) {
          category_id = parseInt(raw, 10);
        } else {
          category_id = catMap[raw.toLowerCase()] || null;
        }
      }

      if (isNaN(unit_price) || isNaN(stock)) {
        results.errors.push(`Ligne ${i + 1} ignorée — prix ou stock invalide`);
        continue;
      }

      try {
        // Upsert by reference if provided, otherwise by name
        if (reference) {
          const existing = await pool.query('SELECT id FROM product WHERE reference = $1', [reference]);
          if (existing.rows.length > 0) {
            await pool.query(
              `UPDATE product SET name=$1, description=$2, unit_price=$3, stock=$4, category_id=$5, image=$6 WHERE reference=$7`,
              [name, description, unit_price, stock, category_id, image, reference]
            );
            results.updated++;
          } else {
            await pool.query(
              `INSERT INTO product (name, reference, description, unit_price, stock, category_id, image) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [name, reference, description, unit_price, stock, category_id, image]
            );
            results.inserted++;
          }
        } else {
          await pool.query(
            `INSERT INTO product (name, description, unit_price, stock, category_id, image) VALUES ($1,$2,$3,$4,$5,$6)`,
            [name, description, unit_price, stock, category_id, image]
          );
          results.inserted++;
        }
      } catch (rowErr) {
        results.errors.push(`Ligne ${i + 1} (${name}) — ${rowErr.message}`);
      }
    }

    fs.unlinkSync(filePath);
    res.json({
      message: `Import terminé : ${results.inserted} ajouté(s), ${results.updated} mis à jour`,
      ...results,
    });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,

  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,

  getClientOrders,
  getAllClients,
  getClientById,
  createClient,
  updateClient,
  deleteClient,
  archiveClient,
  restoreClient,

  updateOrder,
  getAllOrders,
  getOrderById,
  createOrder,
  cancelOrder,
  updateOrderStatus,
  clientCreateOrder,
  getOrderStatusHistory,
  getPendingClientOrders,

  getAllUsers,
  getAllRoles,
  updateUser,
  toggleUserStatus,
  resetUserPassword,
  deleteUser,

  getDashboardStats,
  getSalesByRegion,
  getAuditLogs,

  registerUser,
  loginUser,

  importProductsCSV,
};