const express = require('express');
const router = express.Router();
const pool = require('../db');
const { verifyClientToken } = require('./clientPortal');

// ── Helpers ────────────────────────────────────────────────────────────────────
const STATUS_LABELS = {
  pending: 'Pending (awaiting confirmation)',
  confirmed: 'Confirmed',
  shipped: 'Shipped',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
};

const fmt = v => parseFloat(v || 0).toFixed(2) + ' TND';

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

function extractNumber(msg) {
  const m = msg.match(/\b(\d{1,10})\b/);
  return m ? parseInt(m[1], 10) : null;
}

// ── Intent detection ────────────────────────────────────────────────────────────
function detectIntent(msg) {
  const m = normalize(msg);

  if (/(my order|my orders|commande|mes commandes|order history|order list)/i.test(m)) return 'my_orders';
  if (/(order #?\d+|commande #?\d+|track|tracking|where is|status of|statut|état)/i.test(m)) return 'order_detail';
  if (/(cancel|annul)/i.test(m) && /order|commande/i.test(m)) return 'cancel_info';
  if (/(product|produit|catalog|catalogue|available|disponible|stock|price|prix)/i.test(m)) return 'products';
  if (/(account|profile|compte|profil|my info|my details|mes infos)/i.test(m)) return 'account';
  if (/(total|spent|dépensé|revenue|amount|montant|how much)/i.test(m)) return 'spending';
  if (/(help|aide|what can you|que peux-tu|commands|commandes|assistant)/i.test(m)) return 'help';
  if (/(hello|bonjour|hi|salut|hey)/i.test(m)) return 'greeting';
  if (/(invoice|facture|pdf)/i.test(m)) return 'invoice';
  if (/(delivery|livraison|ship|expédition|when will|quand)/i.test(m)) return 'delivery';

  // If a number is present assume they're asking about a specific order
  if (extractNumber(m) !== null) return 'order_detail';

  return 'unknown';
}

// ── Query helpers ───────────────────────────────────────────────────────────────
async function getMyOrders(clientId) {
  const { rows } = await pool.query(
    `SELECT id, order_date, status, amount_ht, tva, amount_ttc, cancel_reason
     FROM sales_order
     WHERE client_id = $1
     ORDER BY order_date DESC
     LIMIT 20`,
    [clientId]
  );
  return rows;
}

async function getOrderDetail(clientId, orderId) {
  const { rows: orders } = await pool.query(
    `SELECT so.id, so.order_date, so.status, so.amount_ht, so.tva, so.amount_ttc, so.cancel_reason,
            so.tracking_number, so.delivery_company
     FROM sales_order so
     WHERE so.id = $1 AND so.client_id = $2`,
    [orderId, clientId]
  );
  if (orders.length === 0) return null;

  const { rows: lines } = await pool.query(
    `SELECT ol.quantity, ol.unit_price, ol.subtotal, p.name AS product_name, p.reference
     FROM order_line ol
     LEFT JOIN product p ON ol.product_id = p.id
     WHERE ol.order_id = $1`,
    [orderId]
  );

  const { rows: history } = await pool.query(
    `SELECT new_status, changed_at
     FROM order_status_history
     WHERE order_id = $1
     ORDER BY changed_at ASC`,
    [orderId]
  );

  return { order: orders[0], lines, history };
}

async function getProducts(searchTerm) {
  let query = `SELECT name, reference, unit_price, stock, description FROM product WHERE stock > 0`;
  const params = [];
  if (searchTerm) {
    params.push(`%${searchTerm}%`);
    query += ` AND (name ILIKE $1 OR reference ILIKE $1)`;
  }
  query += ` ORDER BY name ASC LIMIT 15`;
  const { rows } = await pool.query(query, params);
  return rows;
}

async function getClientAccount(clientId) {
  const { rows } = await pool.query(
    `SELECT id, company_name, email, address, region, phone, segment, status
     FROM client WHERE id = $1`,
    [clientId]
  );
  return rows[0] || null;
}

async function getSpendingSummary(clientId) {
  const { rows } = await pool.query(
    `SELECT
       COUNT(*) AS total_orders,
       COUNT(*) FILTER (WHERE status = 'delivered') AS delivered,
       COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
       COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled,
       COALESCE(SUM(amount_ttc) FILTER (WHERE status != 'cancelled'), 0) AS total_spent,
       COALESCE(SUM(amount_ttc) FILTER (WHERE status = 'delivered'), 0) AS delivered_amount
     FROM sales_order
     WHERE client_id = $1`,
    [clientId]
  );
  return rows[0];
}

// ── Response builders ───────────────────────────────────────────────────────────
function buildResponse(intent, data, msg) {
  const m = normalize(msg);

  if (intent === 'greeting') {
    return `👋 Hello! I'm your personal assistant. I can help you with:\n• 📦 Browse available products\n• 🛒 Check your orders & their status\n• 💰 View your spending summary\n• 👤 See your account info\n\nJust ask!`;
  }

  if (intent === 'help') {
    return `Here's what you can ask me:\n\n• **"My orders"** — list all your orders\n• **"Order #12"** or **"track order 12"** — details & status of a specific order\n• **"Products"** or **"show laptops"** — browse available products\n• **"My account"** — your profile info\n• **"How much have I spent?"** — your spending summary\n• **"Delivery"** — info about delivery & shipping`;
  }

  if (intent === 'my_orders') {
    const orders = data;
    if (!orders || orders.length === 0) {
      return `You don't have any orders yet. You can place one from the products section!`;
    }
    const lines = orders.map(o =>
      `• **Order #${o.id}** — ${new Date(o.order_date).toLocaleDateString('en-GB')} — ${STATUS_LABELS[o.status] || o.status} — ${fmt(o.amount_ttc)}`
    );
    return `You have **${orders.length}** order(s):\n\n${lines.join('\n')}\n\nAsk me "order #ID" for full details on any order.`;
  }

  if (intent === 'order_detail') {
    if (!data) {
      const id = extractNumber(m);
      return id
        ? `I couldn't find order #${id}. It either doesn't exist or doesn't belong to your account.`
        : `Please specify an order number, e.g. "order #12" or "track order 12".`;
    }
    const { order, lines, history } = data;
    const statusLabel = STATUS_LABELS[order.status] || order.status;

    let reply = `**Order #${order.id}** — ${new Date(order.order_date).toLocaleDateString('en-GB')}\n`;
    reply += `📌 Status: **${statusLabel}**\n`;

    if (order.tracking_number) reply += `🚚 Tracking: \`${order.tracking_number}\` (${order.delivery_company || 'Delivery'})\n`;
    if (order.cancel_reason)   reply += `❌ Cancellation reason: ${order.cancel_reason}\n`;

    reply += `\n**Products ordered:**\n`;
    lines.forEach(l => {
      reply += `• ${l.product_name || '—'} (${l.reference || ''}) × ${l.quantity} @ ${fmt(l.unit_price)} = ${fmt(l.subtotal)}\n`;
    });

    reply += `\n💰 Subtotal (ex.tax): ${fmt(order.amount_ht)}\n`;
    reply += `   Tax (19%): ${fmt(order.tva)}\n`;
    reply += `   **Total: ${fmt(order.amount_ttc)}**\n`;

    if (history && history.length > 0) {
      reply += `\n**Status history:**\n`;
      history.forEach(h => {
        reply += `• ${new Date(h.changed_at).toLocaleDateString('en-GB')} — ${STATUS_LABELS[h.new_status] || h.new_status}\n`;
      });
    }

    return reply;
  }

  if (intent === 'products') {
    const products = data;
    if (!products || products.length === 0) {
      return `No products found matching your search. Try a broader term or just ask "show all products".`;
    }
    const lines = products.map(p =>
      `• **${p.name}** (${p.reference}) — ${fmt(p.unit_price)} — Stock: ${p.stock}`
    );
    return `**Available products** (${products.length} result${products.length > 1 ? 's' : ''}):\n\n${lines.join('\n')}\n\nYou can place an order from the shop above!`;
  }

  if (intent === 'account') {
    const c = data;
    if (!c) return `Could not load your account info. Please try again.`;
    return `**Your account:**\n\n• Company: ${c.company_name}\n• Email: ${c.email}\n• Phone: ${c.phone || '—'}\n• Region: ${c.region || '—'}\n• Segment: ${c.segment || '—'}\n• Status: ${c.status}`;
  }

  if (intent === 'spending') {
    const s = data;
    if (!s) return `Could not load your spending data.`;
    return `**Your spending summary:**\n\n• Total orders placed: ${s.total_orders}\n• Delivered: ${s.delivered}\n• Pending/In progress: ${s.pending}\n• Cancelled: ${s.cancelled}\n• 💰 Total spent (inc. tax): **${fmt(s.total_spent)}**\n• Delivered amount: ${fmt(s.delivered_amount)}`;
  }

  if (intent === 'cancel_info') {
    return `To cancel an order, please contact your sales representative. Cancellations are only possible for orders that are still **pending** or **confirmed**.\n\nYou can also ask me "my orders" to check your current order statuses.`;
  }

  if (intent === 'invoice') {
    return `Invoices (PDF) can be downloaded from the **Orders** page in your portal. Click on an order and use the "Download Invoice" button.\n\nNeed help finding a specific order? Ask me "order #ID".`;
  }

  if (intent === 'delivery') {
    return `**Delivery information:**\n\n• Orders are shipped via our partner **First Delivery**\n• Estimated delivery: 2–5 business days after confirmation\n• You'll receive a tracking number once your order is shipped\n• Ask me "order #ID" to check tracking for a specific order`;
  }

  return `I'm not sure I understood that. You can ask me about:\n• Your orders ("my orders", "order #12")\n• Available products ("show products", "laptops")\n• Your account ("my account")\n• Spending ("how much have I spent")\n• Delivery info ("delivery")\n\nTry rephrasing your question!`;
}

// ── Rate limiter (in-memory) ────────────────────────────────────────────────────
const rateLimits = {};

function checkRateLimit(clientId) {
  const now = Date.now();
  const windowMs = 10 * 1000;
  const max = 5;
  const key = `client:${clientId}`;
  if (!rateLimits[key] || now - rateLimits[key].start > windowMs) {
    rateLimits[key] = { count: 1, start: now };
    return true;
  }
  rateLimits[key].count++;
  return rateLimits[key].count <= max;
}

// ── Route ───────────────────────────────────────────────────────────────────────
router.post('/chat', verifyClientToken, async (req, res) => {
  try {
    const { message } = req.body;
    const clientId = req.client.id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    if (!checkRateLimit(clientId)) {
      return res.status(429).json({ error: 'Too many messages. Please wait a few seconds.' });
    }

    const intent = detectIntent(message);
    const m = normalize(message);
    let data = null;

    if (intent === 'my_orders') {
      data = await getMyOrders(clientId);
    } else if (intent === 'order_detail') {
      const orderId = extractNumber(m);
      data = orderId ? await getOrderDetail(clientId, orderId) : null;
    } else if (intent === 'products') {
      // Extract optional search keyword — strip common words
      const stopWords = /product|produit|catalog|catalogue|available|disponible|show|afficher|find|trouver|search|cherche|price|prix|stock/gi;
      const keyword = m.replace(stopWords, '').replace(/[^a-z0-9 ]/g, '').trim();
      data = await getProducts(keyword || null);
    } else if (intent === 'account') {
      data = await getClientAccount(clientId);
    } else if (intent === 'spending') {
      data = await getSpendingSummary(clientId);
    }

    const reply = buildResponse(intent, data, message);

    return res.json({ success: true, message: reply });
  } catch (error) {
    console.error('Client chatbot error:', error);
    return res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
});

module.exports = router;
