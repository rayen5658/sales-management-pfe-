const express = require('express');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const router = express.Router();
const { verifyToken } = require('../middleware');
const pool = require('../db');

function roleAllows(roleName) {
  // Mapping based on existing role_name values in JWT
  const role = (roleName || '').toLowerCase();
  if (role.includes('administrator') || role.includes('admin')) {
    return 'admin';
  }
  if (role.includes('manager')) {
    return 'manager';
  }
  if (role.includes('commercial') || role.includes('sales') || role.includes('agent')) {
    return 'commercial';
  }
  return 'unknown';
}

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

function detectIntent(message) {
  const msg = normalize(message);

  // Tracking
  if (/(track|tracking|order status|status history|where is my order)/i.test(msg)) {
    return 'order_tracking';
  }

  // Products
  if (/(products|product|inventory|stock|availability)/i.test(msg)) {
    return 'products';
  }

  // Clients
  if (/(clients|client|customers|customer|account|accounts)/i.test(msg)) {
    return 'clients';
  }

  // Orders
  if (/(orders|order|sales order|purchase order|create order|pending|confirmed|shipped|delivered|cancelled)/i.test(msg)) {
    return 'orders';
  }

  // Dashboard/KPIs
  if (/(dashboard|kpi|analytics|reports|revenue|top products|top clients|chart|performance)/i.test(msg)) {
    return 'dashboard';
  }

  // Default
  return 'help';
}

function extractOrderId(message) {
  // Try to find an integer order id in the message.
  const m = message?.match(/\b(\d{1,10})\b/);
  return m ? parseInt(m[1], 10) : null;
}

async function runQuery(intent, { roleKey, userId, region, period, orderId }) {
  // We keep queries intentionally simple and safe.
  // Tables are based on your existing code: product, client, sales_order, order_line.

  if (intent === 'products') {
    if (roleKey === 'commercial') {
      // Commercial: show products but do not expose stock if your business requires.
      // Here we still show basic product list.
      const { rows } = await pool.query(
        `SELECT id, reference, name, unit_price, stock, category_id, image FROM product ORDER BY id ASC LIMIT 20`
      );
      return { products: rows };
    }

    const { rows } = await pool.query(
      `SELECT id, reference, name, description, unit_price, stock, category_id, image FROM product ORDER BY id ASC LIMIT 50`
    );
    return { products: rows };
  }

  if (intent === 'clients') {
    if (roleKey === 'commercial') {
      // Commercial sees only their own clients.
      // We approximate using sales_order.user_id -> client_id.
      const { rows } = await pool.query(
        `SELECT DISTINCT c.id, c.company_name, c.address, c.region, c.email, c.phone, c.segment, c.status
         FROM client c
         JOIN sales_order so ON so.client_id = c.id
         WHERE so.user_id = $1
         ORDER BY c.id ASC
         LIMIT 50`,
        [userId]
      );
      return { clients: rows };
    }

    const { rows } = await pool.query(
      `SELECT id, company_name, address, region, email, phone, segment, status
       FROM client ORDER BY id ASC LIMIT 100`
    );
    return { clients: rows };
  }

  if (intent === 'orders') {
    if (roleKey === 'commercial') {
      const { rows } = await pool.query(
        `SELECT so.id, so.order_date, so.status, so.amount_ht, so.tva, so.amount_ttc, so.cancel_reason,
                c.company_name AS client_name
         FROM sales_order so
         JOIN client c ON c.id = so.client_id
         WHERE so.user_id = $1
         ORDER BY so.order_date DESC, so.id DESC
         LIMIT 50`,
        [userId]
      );
      return { orders: rows };
    }

    // admin/manager
    const { rows } = await pool.query(
      `SELECT so.id, so.order_date, so.status, so.amount_ht, so.tva, so.amount_ttc, so.cancel_reason,
              c.company_name AS client_name,
              u.firstname AS user_firstname, u.lastname AS user_lastname
       FROM sales_order so
       JOIN client c ON c.id = so.client_id
       LEFT JOIN app_user u ON u.id = so.user_id
       ORDER BY so.order_date DESC, so.id DESC
       LIMIT 50`
    );
    return { orders: rows };
  }

  if (intent === 'order_tracking') {
    if (!orderId) {
      return { error: 'order_id_missing' };
    }

    // Basic permissions: commercial can only track their own orders.
    if (roleKey === 'commercial') {
      const { rows: orderRows } = await pool.query(
        `SELECT so.*, c.company_name AS client_name
         FROM sales_order so
         LEFT JOIN client c ON so.client_id = c.id
         WHERE so.id = $1 AND so.user_id = $2`,
        [orderId, userId]
      );

      if (orderRows.length === 0) return { error: 'order_not_found_or_forbidden' };

      const { rows: historyRows } = await pool.query(
        `SELECT osh.changed_at, osh.previous_status, osh.new_status, osh.notes,
                u.firstname AS user_firstname, u.lastname AS user_lastname, u.email AS user_email
         FROM order_status_history osh
         LEFT JOIN app_user u ON osh.changed_by = u.id
         WHERE osh.order_id = $1
         ORDER BY osh.changed_at ASC`,
        [orderId]
      );

      return { order: orderRows[0], history: historyRows };
    }

    const { rows: orderRows } = await pool.query(
      `SELECT so.*, c.company_name AS client_name
       FROM sales_order so
       LEFT JOIN client c ON so.client_id = c.id
       WHERE so.id = $1`,
      [orderId]
    );

    if (orderRows.length === 0) return { error: 'order_not_found' };

    const { rows: historyRows } = await pool.query(
      `SELECT osh.changed_at, osh.previous_status, osh.new_status, osh.notes,
              u.firstname AS user_firstname, u.lastname AS user_lastname, u.email AS user_email
       FROM order_status_history osh
       LEFT JOIN app_user u ON osh.changed_by = u.id
       WHERE osh.order_id = $1
       ORDER BY osh.changed_at ASC`,
      [orderId]
    );

    return { order: orderRows[0], history: historyRows };
  }

  if (intent === 'dashboard') {
    // We reuse the existing dashboard stats logic by calling the controller endpoints would be nicer,
    // but we keep it direct here.
    // period: week|month|quarter|year|all
    const statsPeriod = period || 'year';

    const dateWhereMap = {
      week: `so.order_date >= NOW() - INTERVAL '7 days'`,
      month: `so.order_date >= DATE_TRUNC('month', NOW())`,
      quarter: `so.order_date >= DATE_TRUNC('quarter', NOW())`,
      year: `EXTRACT(YEAR FROM so.order_date) = EXTRACT(YEAR FROM NOW())`,
      all: `1=1`,
    };
    const dateWhere = dateWhereMap[statsPeriod] || dateWhereMap.year;

    const whereCommercial = roleKey === 'commercial' ? `AND so.user_id = $${1}` : '';
    const params = [];
    if (roleKey === 'commercial') params.push(userId);

    // KPIs revenue
    const revenueQ = await pool.query(
      `SELECT COALESCE(SUM(so.amount_ttc),0) AS total
       FROM sales_order so
       LEFT JOIN client c ON so.client_id = c.id
       WHERE so.status != 'cancelled' AND ${dateWhere} ${whereCommercial}`,
      params
    );

    const ordersQ = await pool.query(
      `SELECT COUNT(*) AS total
       FROM sales_order so
       LEFT JOIN client c ON so.client_id = c.id
       WHERE ${dateWhere} AND so.status != 'cancelled' ${whereCommercial}`,
      params
    );

    const currentRev = parseFloat(revenueQ.rows[0]?.total || 0);
    const totalOrders = parseInt(ordersQ.rows[0]?.total || 0, 10);

    // top products (limit 5)
    const topProductsQ = await pool.query(
      `SELECT p.name, SUM(ol.quantity) AS qty, SUM(ol.subtotal) AS revenue
       FROM order_line ol
       JOIN product p ON ol.product_id = p.id
       JOIN sales_order so ON ol.order_id = so.id
       LEFT JOIN client c ON so.client_id = c.id
       WHERE so.status != 'cancelled' AND ${dateWhere} ${roleKey === 'commercial' ? `AND so.user_id = $1` : ''}
       GROUP BY p.name
       ORDER BY qty DESC
       LIMIT 5`,
      roleKey === 'commercial' ? params : []
    );

    // top clients (limit 5)
    const topClientsQ = await pool.query(
      `SELECT c.company_name AS name,
              COUNT(so.id) AS orders,
              COALESCE(SUM(so.amount_ttc),0) AS revenue
       FROM sales_order so
       JOIN client c ON so.client_id = c.id
       WHERE so.status != 'cancelled' AND ${dateWhere} ${roleKey === 'commercial' ? `AND so.user_id = $1` : ''}
       GROUP BY c.company_name
       ORDER BY revenue DESC
       LIMIT 5`,
      roleKey === 'commercial' ? params : []
    );

    return {
      kpis: {
        period: statsPeriod,
        totalRevenue: currentRev,
        totalOrders,
      },
      topProducts: topProductsQ.rows,
      topClients: topClientsQ.rows,
    };
  }

  return { hint: 'Ask about products, clients, orders, order tracking, or dashboard KPIs.' };
}

router.post('/chat', verifyToken, async (req, res) => {
  try {
    const { message, conversationId } = req.body;
    const roleName = req.user?.role_name;
    const roleKey = roleAllows(roleName);

    if (!message || !String(message).trim()) {
      return res.status(400).json({ message: 'Message cannot be empty' });
    }

    const userId = req.user.id;
    const intent = detectIntent(message);

    // Optional: parse order id from message for tracking
    const orderId = intent === 'order_tracking' ? extractOrderId(message) : null;

    // Optional: parse region/period hints in message (simple heuristic)
    const msg = normalize(message);
    const periodMatch = msg.match(/\b(week|month|quarter|year|all)\b/);
    const period = periodMatch ? periodMatch[1] : undefined;

    const queryData = await runQuery(intent, {
      roleKey,
      userId,
      region: undefined,
      period,
      orderId,
    });

    const geminiApiKey = process.env.GEMINI_API_KEY;
    if (!geminiApiKey) {
      return res.status(500).json({ message: 'AI service not configured on server' });
    }

    const genAI = new GoogleGenerativeAI(geminiApiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash' });

    const system = `You are an internal Sales Management app assistant.
- You must answer using only the provided database query result.
- If the query result includes an error code like order_not_found, say it clearly.
- Keep the response short, in French or English depending on the question language.
- Use bullet points where helpful.
- Never mention OpenAI or tokens.
- Respect the user's role implicitly via the provided query result.`;

    const prompt = `User question:\n${message}\n\nDatabase result (JSON):\n${JSON.stringify(queryData)}\n\nWrite the final answer:`;

    const result = await model.generateContent({
  systemInstruction: system,
  contents: [
    { role: 'user', parts: [{ text: prompt }] },
  ],
});

    const text = result.response.text();

    return res.json({
      success: true,
      message: text || 'No answer generated.',
      conversationId: conversationId || 'default',
      intent,
    });
  } catch (error) {
    console.error('Chatbot Gemini error:', error);
    return res.status(500).json({ message: 'An error occurred while processing your request' });
  }
});

module.exports = router;

