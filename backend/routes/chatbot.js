const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware');

const conversations = {};

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

// ── Helpers for array-aware screenData ────────────────────────────────────────
function first(val) {
  if (Array.isArray(val)) return val[0];
  return val;
}
function all(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val;
  return [val];
}
function at(val, i) {
  return all(val)[i];
}

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// True if `token` appears in `msg` as a whole word/phrase (case-insensitive).
function containsToken(msg, token) {
  const t = String(token || '').trim();
  if (!t) return false;
  const re = new RegExp(`\\b${escapeRegex(t.toLowerCase())}\\b`, 'i');
  return re.test(msg);
}

// ── Entity resolution: figure out which specific product/order the message is about ──
function findProductIndex(msg, screenData) {
  const refs = all(screenData?.['product-reference']);
  for (let i = 0; i < refs.length; i++) {
    if (containsToken(msg, refs[i])) return i;
  }

  // Fall back to product name — pick the longest matching name to avoid
  // short/generic names accidentally matching unrelated words in the message.
  const names = all(screenData?.['product-name']);
  let bestIdx = -1;
  let bestLen = 0;
  for (let i = 0; i < names.length; i++) {
    const name = String(names[i] || '');
    if (name.length > 3 && containsToken(msg, name) && name.length > bestLen) {
      bestIdx = i;
      bestLen = name.length;
    }
  }
  return bestIdx;
}

function findOrderIndex(msg, screenData) {
  // Only attempt this when the message actually looks like it's about an order,
  // otherwise a stray number ("top 5 products") would false-match an order id.
  if (!/order|commande|#\s?\d|n[°o]\s*\d/i.test(msg)) return -1;

  const ids = all(screenData?.['order-id']);
  const digits = msg.match(/\d+/g) || [];
  for (const d of digits) {
    const idx = ids.findIndex((id) => String(id).replace(/[^\d]/g, '') === d);
    if (idx !== -1) return idx;
  }
  return -1;
}

// ── Screen-aware answer builder ────────────────────────────────────────────────
function getScreenAwareAnswer(userMessage, screenData) {
  const msg = normalize(userMessage);
  const hasScreen = screenData && Object.keys(screenData).length > 0;

  // ── Specific product lookup (by reference code, or by name) ─────────────────
  // Takes priority over the generic topic handlers below: if the message
  // names one product, answer about that product instead of dumping every
  // product currently on screen.
  const productIdx = findProductIndex(msg, screenData);
  if (productIdx !== -1) {
    const name = at(screenData['product-name'], productIdx);
    const ref = at(screenData['product-reference'], productIdx);
    const price = at(screenData['product-price'], productIdx);
    const stock = at(screenData['product-stock'], productIdx);
    const category = at(screenData['product-category'], productIdx);
    const label = name ? `**${name}**` : ref ? `Product **${ref}**` : 'This product';
    const refSuffix = ref && name ? ` (ref ${ref})` : '';

    if (/stock|inventory|quantit/i.test(msg)) {
      return `${label}${refSuffix} has stock: **${stock || '—'}**.`;
    }
    if (/price|prix|cost/i.test(msg)) {
      return `${label}${refSuffix} is priced at **${price || '—'}**.`;
    }

    const parts = [];
    if (ref) parts.push(`Reference: **${ref}**`);
    if (price) parts.push(`Price: **${price}**`);
    if (stock) parts.push(`Stock: **${stock}**`);
    if (category) parts.push(`Category: **${category}**`);
    return `${label}\n${parts.map((p) => `• ${p}`).join('\n')}`;
  }

  // ── Specific order lookup (by order id/reference number) ────────────────────
  const orderIdx = findOrderIndex(msg, screenData);
  if (orderIdx !== -1) {
    const id = at(screenData['order-id'], orderIdx);
    const client = at(screenData['order-client'], orderIdx);
    const date = at(screenData['order-date'], orderIdx);
    const total = at(screenData['order-total'], orderIdx);
    const status = at(screenData['order-status'], orderIdx);

    if (/status|statut/i.test(msg)) {
      return `Order ${id} has status: **${status || '—'}**.`;
    }
    if (/total|montant|amount/i.test(msg)) {
      return `Order ${id} total is **${total || '—'}**.`;
    }

    const parts = [];
    if (client) parts.push(`Client: **${client}**`);
    if (date) parts.push(`Date: **${date}**`);
    if (total) parts.push(`Total: **${total}**`);
    if (status) parts.push(`Status: **${status}**`);
    return `Order **${id}**\n${parts.map((p) => `• ${p}`).join('\n')}`;
  }

  // ── Products count ──────────────────────────────────────────────────────────
  if (/how many product|product.*count|nombre.*produit|total.*product|products.*have/i.test(msg)) {
    const realTotal = first(screenData?.['products-total']);
    if (realTotal) return `There are **${realTotal}** products in total.`;
    const names = all(screenData?.['product-name']);
    if (names.length > 0) return `I can see **${names.length}** product(s) currently listed on screen.`;
    const count = first(screenData?.['products']);
    if (count) return `There are currently **${count}** products shown.`;
    return hasScreen
      ? 'Navigate to the **Products** page to see your product catalog.'
      : 'Navigate to the **Products** page and ask again.';
  }

  // ── Sales by region (Dashboard regional breakdown) ───────────────────────────
  // Deliberately doesn't match bare "which region" — that phrasing is just as
  // likely to mean "which region is this client in" (handled below), and this
  // dashboard-only data wouldn't exist on the Clients page anyway.
  const mentionsRegionAnalytics = /(top|best|top-selling).*region|region.*(sales|revenue)/i.test(msg);
  const mentionsRegionAnalyticsExplicit = /sales by region|region breakdown/i.test(msg);
  const regionDataOnScreen = all(screenData?.['region-1-name']).length > 0;
  if ((mentionsRegionAnalytics && regionDataOnScreen) || mentionsRegionAnalyticsExplicit) {
    const names = [1,2,3,4,5,6,7,8,9,10].map(n => first(screenData?.[`region-${n}-name`])).filter(Boolean);
    const revenues = [1,2,3,4,5,6,7,8,9,10].map(n => first(screenData?.[`region-${n}-revenue`]));
    if (names.length > 1) {
      const rows = names.map((n, i) => `• ${n}: **${revenues[i] || '—'}**`).join('\n');
      return `Sales by region, visible on screen:\n${rows}`;
    }
    if (names.length === 1) {
      return `**${names[0]}** shows **${revenues[0] || '—'}** in revenue on screen.`;
    }
    return hasScreen
      ? 'Navigate to the **Dashboard** to see sales by region.'
      : 'Navigate to the **Dashboard** page and ask again.';
  }

  // ── Revenue / total / sales ─────────────────────────────────────────────────
  if (/revenue|total revenue|sales|chiffre|revenu/i.test(msg)) {
    const rev = first(screenData?.['revenue']) ||
                first(screenData?.['my-revenue']);
    if (rev) return `The total revenue currently shown on screen is **${rev}**.`;
    // Try any key containing revenue (catches the Period Summary card's slugified label, etc.)
    const revEntry = Object.entries(screenData || {}).find(([k]) => k.includes('revenue'));
    if (revEntry) return `Revenue shown: **${first(revEntry[1])}**.`;
    return hasScreen
      ? 'Navigate to the **Dashboard** and ask again.'
      : 'Navigate to the **Dashboard** page and ask again.';
  }

  // ── Orders count ─────────────────────────────────────────────────────────────
  if (/how many orders|order count|nombre.*commandes|total orders/i.test(msg)) {
    const realTotal = first(screenData?.['orders-total']);
    if (realTotal) return `There are **${realTotal}** orders in total.`;
    const orderIds = all(screenData?.['order-id']);
    if (orderIds.length > 0) return `I can see **${orderIds.length}** order(s) currently listed on screen.`;
    const count = first(screenData?.['orders']) || first(screenData?.['my-orders']);
    if (count) return `There are currently **${count}** orders shown.`;
    return hasScreen
      ? 'Navigate to the **Orders** page to see your orders.'
      : 'Navigate to the **Orders** page and ask again.';
  }

  // ── Order status ─────────────────────────────────────────────────────────────
  // Bare "status"/"statut" is ambiguous with client status (below) — only claim it
  // here if the message clearly means an order, or order-status data actually
  // exists on screen. Otherwise fall through so the client-status handler can
  // answer from whatever's actually on screen.
  const mentionsOrderStatus = /order.*status|status.*order|statut.*commande|commande.*statut/i.test(msg);
  const mentionsBareStatus = /status|statut/i.test(msg) && !/client/i.test(msg);
  if (mentionsOrderStatus || (mentionsBareStatus && all(screenData?.['order-status']).length > 0)) {
    const statuses = all(screenData?.['order-status']);
    const ids = all(screenData?.['order-id']);
    if (statuses.length > 1 && ids.length > 1) {
      const rows = ids.slice(0, 10).map((id, i) => `• ${id}: **${statuses[i] || '—'}**`).join('\n');
      return `Here are the order statuses visible on screen:\n${rows}`;
    }
    if (statuses.length === 1) {
      return ids[0]
        ? `Order ${ids[0]} has status: **${statuses[0]}**.`
        : `The order status shown is: **${statuses[0]}**.`;
    }
    return hasScreen
      ? 'Navigate to the **Orders** page for order status information.'
      : 'Navigate to the **Orders** page and ask again.';
  }

  // ── Order total / amount ─────────────────────────────────────────────────────
  if (/total.*order|order.*total|montant|amount/i.test(msg)) {
    const totals = all(screenData?.['order-total']);
    const ids = all(screenData?.['order-id']);
    if (totals.length > 1) {
      const rows = ids.slice(0, 10).map((id, i) => `• ${id}: **${totals[i] || '—'}**`).join('\n');
      return `Order totals visible on screen:\n${rows}`;
    }
    if (totals.length === 1) {
      return ids[0]
        ? `Order ${ids[0]} total is **${totals[0]}**.`
        : `The order total shown is **${totals[0]}**.`;
    }
    return hasScreen
      ? 'Navigate to the **Orders** page for order amounts.'
      : 'Navigate to the **Orders** page and ask again.';
  }

  // ── Product stock ────────────────────────────────────────────────────────────
  if (/stock|inventory|how much.*product|quantit/i.test(msg)) {
    const names = all(screenData?.['product-name']);
    const stocks = all(screenData?.['product-stock']);
    if (names.length > 1) {
      const rows = names.slice(0, 10).map((n, i) => `• ${n}: **${stocks[i] || '—'}**`).join('\n');
      return `Stock levels for products visible on screen:\n${rows}`;
    }
    if (names.length === 1) {
      return `**${names[0]}** currently has stock: **${stocks[0] || '—'}**.`;
    }
    return hasScreen
      ? 'Navigate to the **Products** page for stock information.'
      : 'Navigate to the **Products** page and ask again.';
  }

  // ── Product price ────────────────────────────────────────────────────────────
  if (/price|prix|cost|how much.*cost/i.test(msg)) {
    const names = all(screenData?.['product-name']);
    const prices = all(screenData?.['product-price']);
    if (names.length > 1) {
      const rows = names.slice(0, 10).map((n, i) => `• ${n}: **${prices[i] || '—'}**`).join('\n');
      return `Prices for products visible on screen:\n${rows}`;
    }
    if (names.length === 1) {
      return `**${names[0]}** is priced at **${prices[0] || '—'}**.`;
    }
    return hasScreen
      ? 'Navigate to the **Products** page for pricing information.'
      : 'Navigate to the **Products** page and ask again.';
  }

  // ── Client region ────────────────────────────────────────────────────────────
  if (/region|location|where.*client|client.*region/i.test(msg)) {
    const cnames = all(screenData?.['client-name']);
    const regions = all(screenData?.['client-region']);
    if (cnames.length > 1) {
      const rows = cnames.slice(0, 10).map((n, i) => `• ${n}: **${regions[i] || '—'}**`).join('\n');
      return `Client regions visible on screen:\n${rows}`;
    }
    if (cnames.length === 1) {
      return `**${cnames[0]}** is in region: **${regions[0] || '—'}**.`;
    }
    return hasScreen
      ? 'Navigate to the **Clients** page for region information.'
      : 'Navigate to the **Clients** page and ask again.';
  }

  // ── Client status ────────────────────────────────────────────────────────────
  // Also catch a bare "status"/"statut" here when client-status data is what's
  // actually on screen (e.g. the order-status check above already ruled out
  // an order context) — so "what's the status?" on the Clients page still works.
  const mentionsBareStatusForClient = /status|statut/i.test(msg) && all(screenData?.['client-status']).length > 0;
  if (/client.*status|statut.*client|active.*client/i.test(msg) || mentionsBareStatusForClient) {
    const cnames = all(screenData?.['client-name']);
    const statuses = all(screenData?.['client-status']);
    if (cnames.length > 1) {
      const rows = cnames.slice(0, 10).map((n, i) => `• ${n}: **${statuses[i] || '—'}**`).join('\n');
      return `Client statuses visible on screen:\n${rows}`;
    }
    if (cnames.length === 1) {
      return `**${cnames[0]}** status is: **${statuses[0] || '—'}**.`;
    }
    return hasScreen
      ? 'Navigate to the **Clients** page for status information.'
      : 'Navigate to the **Clients** page and ask again.';
  }

  // ── Client segment ───────────────────────────────────────────────────────────
  if (/segment|type.*client|client.*type/i.test(msg)) {
    const cnames = all(screenData?.['client-name']);
    const segments = all(screenData?.['client-segment']);
    if (cnames.length > 1) {
      const rows = cnames.slice(0, 10).map((n, i) => `• ${n}: **${segments[i] || '—'}**`).join('\n');
      return `Client segments visible on screen:\n${rows}`;
    }
    if (cnames.length === 1) {
      return `**${cnames[0]}** segment is: **${segments[0] || '—'}**.`;
    }
    return hasScreen
      ? 'Navigate to the **Clients** page for segment information.'
      : 'Navigate to the **Clients** page and ask again.';
  }

  // ── Top products ─────────────────────────────────────────────────────────────
  if (/top product|best.*product|best.*selling/i.test(msg)) {
    const tops = [1,2,3,4,5]
      .map(n => first(screenData?.[`top-product-${n}-name`]))
      .filter(Boolean);
    if (tops.length > 0) return `Top products on screen: ${tops.map((n,i) => `${i+1}. ${n}`).join(', ')}.`;
    return hasScreen
      ? 'Navigate to the **Dashboard** to see top products.'
      : 'Navigate to the **Dashboard** and ask again.';
  }

  // ── Top clients ──────────────────────────────────────────────────────────────
  if (/top client|best.*client|meilleur.*client/i.test(msg)) {
    const tops = [1,2,3,4,5]
      .map(n => first(screenData?.[`top-client-${n}-name`]))
      .filter(Boolean);
    if (tops.length > 0) return `Top clients on screen: ${tops.map((n,i) => `${i+1}. ${n}`).join(', ')}.`;
    return hasScreen
      ? 'Navigate to the **Dashboard** to see top clients.'
      : 'Navigate to the **Dashboard** and ask again.';
  }

  // ── What can you see ─────────────────────────────────────────────────────────
  if (/what.*see|current page|what.*screen|what.*shown/i.test(msg)) {
    if (!hasScreen) return 'I can\'t see any screen data right now. Make sure you\'re on a page with data loaded.';
    const keys = Object.keys(screenData).slice(0, 8).join(', ');
    return `I can see these values on screen: ${keys}. Ask me about any of them!`;
  }

  // ── FAQ fallback ─────────────────────────────────────────────────────────────
  return getFaqAnswer(userMessage);
}

// ── Static FAQ fallback ───────────────────────────────────────────────────────
function getFaqAnswer(userMessage) {
  const msg = normalize(userMessage);
  const rules = [
    { match: [/how to|help|what can you do|capabilities/i], answer: 'I can answer questions about what\'s currently visible on screen. Navigate to Dashboard, Orders, Products, or Clients — then ask me about specific values like revenue, stock, order status, or client region.' },
    { match: [/login|log in/i], answer: 'Login: use your email + password on the Login page.' },
    { match: [/import|csv/i], answer: 'Products import: use "Import CSV" from the Products page (Admin/Manager).' },
    { match: [/create.*order|how to create.*order|place.*order/i], answer: 'Create an order: go to Orders → New Order. Select client, add products, confirm.' },
    { match: [/tracking|track/i], answer: 'Order tracking: Orders page → click the clock icon on any order row.' },
    { match: [/cancel/i], answer: 'Cancel order: Orders page → red cancel button on the row (must not be delivered).' },
    { match: [/reset password|forgot password/i], answer: 'Password reset: Administrator → Users page → reset password icon.' },
  ];
  for (const r of rules) {
    if (r.match.some(re => re.test(msg))) return r.answer;
  }
  return 'Ask me about values currently visible on screen (revenue, stock, order status, client region, prices, etc.), or ask a general how-to question.';
}

// ── Rate limiter ──────────────────────────────────────────────────────────────
if (!router.locals) router.locals = {};

router.post('/chat', verifyToken, (req, res) => {
  const now = Date.now();
  const key = `rl:${req.user?.id || 'unknown'}`;
  if (!router.locals[key]) router.locals[key] = { count: 0, start: now };
  const entry = router.locals[key];
  if (now - entry.start > 10000) { entry.start = now; entry.count = 0; }
  entry.count++;
  if (entry.count > 5) {
    return res.status(429).json({ message: 'Too many messages. Please wait a few seconds.' });
  }

  try {
    const { message, conversationId, screenData } = req.body;
    const userId = req.user.id;
    if (!message?.trim()) return res.status(400).json({ message: 'Message cannot be empty' });

    const convKey = `${userId}-${conversationId || 'default'}`;
    if (!conversations[convKey]) conversations[convKey] = [];
    conversations[convKey].push({ role: 'user', content: message });

    const assistantMessage = getScreenAwareAnswer(message, screenData || {});

    conversations[convKey].push({ role: 'assistant', content: assistantMessage });
    if (conversations[convKey].length > 20) conversations[convKey] = conversations[convKey].slice(-20);

    return res.json({ message: assistantMessage, conversationId: conversationId || 'default', success: true });
  } catch (error) {
    console.error('Chatbot error:', error);
    return res.status(500).json({ message: 'An error occurred' });
  }
});

router.post('/clear-conversation', verifyToken, (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id;
    delete conversations[`${userId}-${conversationId || 'default'}`];
    res.json({ success: true, message: 'Conversation cleared' });
  } catch (error) {
    res.status(500).json({ message: 'Internal server error' });
  }
});

module.exports = router;
