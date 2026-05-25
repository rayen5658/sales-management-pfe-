const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware');

// In-memory conversation history (no external AI calls)
const conversations = {};

function normalize(s) {
  return (s || '').toLowerCase().trim();
}

// Very small FAQ/rules-based bot so it works with zero credits.
function getFaqAnswer(userMessage) {
  const msg = normalize(userMessage);

  const rules = [
    {
      match: [/how to|help|what can you do|capabilities|ai assistant/i],
      answer:
        'I can help you with the app basics (products, clients, orders, dashboard) using built-in rules. Try: "How do I add a product?", "How do I create an order?", or "How do I track an order?".'
    },
    {
      match: [/login|log in/i],
      answer:
        'Login: use your email + password on the Login page. After login you can access the dashboard and management features. If you cannot login, check your account status and password.'
    },
    {
      match: [/products|product|inventory|stock/i],
      answer:
        'Products: open Products page to view/manage your product list. Admin/Manager can add/edit/delete products. Stock is used when creating orders—orders will fail if stock is insufficient.'
    },
    {
      match: [/import|csv/i],
      answer:
        'Products import: use the “import-csv” feature from the Products area (Admin/Manager). Upload a CSV with at least name, price, and stock.'
    },
    {
      match: [/clients|customer|client portal|portal/i],
      answer:
        'Clients: open Clients page to create or manage clients. There is also a Client Portal area where clients can login and view their orders.'
    },
    {
      match: [/orders|order|sales order/i],
      answer:
        'Orders: open Orders page. Admin/Manager/Sales Agent can create orders. For client-side creation, use “Orders -> client/create” flow (client authenticated). Orders have statuses (pending/confirmed/shipped/delivered/cancelled).'} ,
    {
      match: [/create.*order|how to create.*order|place.*order/i],
      answer:
        'To create an order: select client (if required by your role), choose products + quantities, then confirm. The system calculates totals and will block if product stock is not enough (depending on the order flow/status).'} ,
    {
      match: [/tracking|track|order.*status/i],
      answer:
        'Order tracking: each order has a status history. Open “Orders” → select order → “tracking” to see status changes over time.'
    },
    {
      match: [/dashboard|analytics|reports|kpi/i],
      answer:
        'Dashboard: shows KPIs (revenue, orders, clients, top products/clients) and charts. Filters may include period, user, and region (depending on UI).' 
    },
    {
      match: [/cancel|annul/i],
      answer:
        'Cancel order: allowed for certain statuses. When cancelled, the system restores product stock (based on your backend logic).'} ,
    {
      match: [/reset password|forgot password|password reset/i],
      answer:
        'Password reset: admin-only endpoint exists. Use the Users area (Administrator) to reset a user password, then the user can login with the new password.'
    }
  ];

  for (const r of rules) {
    if (r.match.some(re => re.test(msg))) return r.answer;
  }

  // Light pattern fallbacks
  if (msg.includes('product') && msg.includes('add')) {
    return 'Add a product: go to Products page (Admin/Manager), fill reference/name/price/stock (and optional category/image), then save.';
  }
  if (msg.includes('client') && msg.includes('add')) {
    return 'Add a client: go to Clients page (Admin/Manager), fill company name/address/region/contact info, then save.';
  }

  return 'I don’t know the exact answer for that question yet. Try asking about: products, clients, creating/canceling orders, order tracking, or dashboard analytics.';
}

router.post('/chat', verifyToken, (req, res) => {
  // Lightweight in-memory rate limit per user to prevent 429/abuse.
  // (We do not use external AI; this is just to protect your server.)
  const now = Date.now();
  const windowMs = 10 * 1000; // 10s window
  const maxRequests = 3; // max 3 messages per window
  if (!router.locals) router.locals = {};
  const key = `rl:${req.user?.id || req.user?.user_id || 'unknown'}`;
  if (!router.locals[key]) router.locals[key] = { count: 0, start: now };
  const entry = router.locals[key];
  if (now - entry.start > windowMs) {
    entry.start = now;
    entry.count = 0;
  }
  entry.count += 1;
  if (entry.count > maxRequests) {
    return res.status(429).json({
      error: 'Too many messages. Please wait a few seconds and try again.'
    });
  }

  try {
    const { message, conversationId } = req.body;
    const userId = req.user.id || req.user.user_id;

    if (!message || !message.trim()) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const convKey = `${userId}-${conversationId || 'default'}`;
    if (!conversations[convKey]) conversations[convKey] = [];

    // Store last user message
    conversations[convKey].push({ role: 'user', content: message });

    const assistantMessage = getFaqAnswer(message);

    conversations[convKey].push({ role: 'assistant', content: assistantMessage });
    if (conversations[convKey].length > 20) conversations[convKey] = conversations[convKey].slice(-20);

    return res.json({
      message: assistantMessage,
      conversationId: conversationId || 'default',
      success: true
    });
  } catch (error) {
    console.error('Chatbot error (FAQ mode):', error);
    return res.status(500).json({ error: error.message || 'An error occurred while processing your request' });
  }
});


// Optional: Clear conversation history
router.post('/clear-conversation', verifyToken, (req, res) => {
  try {
    const { conversationId } = req.body;
    const userId = req.user.id || req.user.user_id;
    const convKey = `${userId}-${conversationId || 'default'}`;
    
    delete conversations[convKey];
    
    res.json({ success: true, message: 'Conversation cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
