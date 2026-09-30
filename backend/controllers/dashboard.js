const pool = require('../db');
const { LOW_STOCK_THRESHOLD } = require('../constants');

const getSalesByRegion = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.region, COUNT(DISTINCT so.id) AS orders,
              COALESCE(SUM(so.amount_ttc),0) AS revenue, COALESCE(AVG(so.amount_ttc),0) AS avg_order
       FROM sales_order so JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND c.region IS NOT NULL
       GROUP BY c.region ORDER BY revenue DESC`
    );
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const getDashboardStats = async (req, res) => {
  try {
    const { period = 'year', region } = req.query;

    let user_id = req.query.user_id;
    if (req.user?.role_name === 'Sales Agent') {
      user_id = String(req.user.id);
    }

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

    const revenue    = await pool.query(
      `SELECT COALESCE(SUM(amount_ttc),0) AS total FROM sales_order so LEFT JOIN client c ON so.client_id=c.id WHERE so.status!='cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}`,
      [...params]
    );
    const ordersQ    = await pool.query(
      `SELECT COUNT(*) AS total FROM sales_order so LEFT JOIN client c ON so.client_id=c.id WHERE ${dateWhere} ${userFilter} ${regionFilter}`,
      [...params]
    );
    const clients    = await pool.query(`SELECT COUNT(*) AS total FROM client WHERE status='active'`);
    const products   = await pool.query(`SELECT COUNT(*) AS total FROM product`);
    const lowStock   = await pool.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT p.id FROM product p
         WHERE p.stock <= $1 AND NOT EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id=p.id)
         UNION ALL
         SELECT pv.id FROM product_variant pv WHERE pv.stock <= $1
       ) AS low`,
      [LOW_STOCK_THRESHOLD]
    );

    const prevFilter = {
      week:    `order_date >= NOW()-INTERVAL '14 days' AND order_date < NOW()-INTERVAL '7 days'`,
      month:   `order_date >= DATE_TRUNC('month',NOW())-INTERVAL '1 month' AND order_date < DATE_TRUNC('month',NOW())`,
      quarter: `order_date >= DATE_TRUNC('quarter',NOW())-INTERVAL '3 months' AND order_date < DATE_TRUNC('quarter',NOW())`,
      year:    `EXTRACT(YEAR FROM order_date) = EXTRACT(YEAR FROM NOW())-1`,
      all:     `1=0`,
    };

    const prevRevenue = await pool.query(
      `SELECT COALESCE(SUM(amount_ttc),0) AS total FROM sales_order so LEFT JOIN client c ON so.client_id=c.id WHERE so.status!='cancelled' AND ${prevFilter[period]||prevFilter.year} ${userFilter} ${regionFilter}`,
      [...params]
    );

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
       ${userFilter} ${regionFilter} GROUP BY month,month_num ORDER BY month_num ASC`,
      [...params]
    );

    const monthlyPrev = await pool.query(
      `SELECT TO_CHAR(so.order_date,'Mon') AS month, EXTRACT(MONTH FROM so.order_date) AS month_num,
              COALESCE(SUM(so.amount_ttc),0) AS revenue_prev
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND EXTRACT(YEAR FROM so.order_date)=EXTRACT(YEAR FROM NOW())-1
       ${userFilter} ${regionFilter} GROUP BY month,month_num ORDER BY month_num ASC`,
      [...params]
    );

    const prevMap = {};
    monthlyPrev.rows.forEach(r => { prevMap[r.month_num] = parseFloat(r.revenue_prev); });
    const monthlyMerged = monthly.rows.map(r => ({
      month: r.month,
      revenue: parseFloat(r.revenue),
      revenue_prev: prevMap[r.month_num] || 0,
      orders: parseInt(r.orders),
    }));

    const topProducts = await pool.query(
      `SELECT p.name, SUM(ol.quantity) AS qty, SUM(ol.subtotal) AS revenue
       FROM order_line ol JOIN product p ON ol.product_id=p.id JOIN sales_order so ON ol.order_id=so.id
       LEFT JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}
       GROUP BY p.name ORDER BY qty DESC LIMIT 5`,
      [...params]
    );

    const topClients = await pool.query(
      `SELECT c.company_name AS name, COUNT(so.id) AS orders, COALESCE(SUM(so.amount_ttc),0) AS revenue,
              MAX(so.order_date) AS last_order_date,
              ROUND(EXTRACT(DAY FROM NOW()-MAX(so.order_date))/30) AS inactive_months
       FROM sales_order so JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}
       GROUP BY c.company_name ORDER BY revenue DESC LIMIT 5`,
      [...params]
    );

    const orderStatusBreakdown = await pool.query(
      `SELECT so.status, COUNT(*) AS count
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id
       WHERE ${dateWhere} ${userFilter} ${regionFilter}
       GROUP BY so.status`,
      [...params]
    );

    const paymentStatusBreakdown = await pool.query(
      `SELECT so.payment_status, COUNT(*) AS count, COALESCE(SUM(so.amount_ttc),0) AS amount
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id
       WHERE so.status!='cancelled' AND ${dateWhere} ${userFilter} ${regionFilter}
       GROUP BY so.payment_status`,
      [...params]
    );

    const paymentMethodBreakdown = await pool.query(
      `SELECT so.payment_method, COUNT(*) AS count
       FROM sales_order so LEFT JOIN client c ON so.client_id=c.id
       WHERE so.payment_method IS NOT NULL AND ${dateWhere} ${userFilter} ${regionFilter}
       GROUP BY so.payment_method`,
      [...params]
    );

    // Business-health snapshot — all-time, not period-scoped (returns/feedback volume is
    // low enough that slicing it by period would mostly show empty charts).
    const returnsSummary = await pool.query(
      `SELECT COUNT(*) AS total,
              COUNT(*) FILTER (WHERE status='requested') AS pending,
              COUNT(*) FILTER (WHERE status='approved') AS approved,
              COUNT(*) FILTER (WHERE status='rejected') AS rejected
       FROM order_return`
    );
    const feedbackSummary = await pool.query(
      `SELECT COUNT(*) AS total, ROUND(AVG(rating)::numeric, 2) AS avg_rating
       FROM order_feedback`
    );

    // Sales leaderboard — ranks every staff member who has created orders, for the
    // selected period/region, regardless of the "sales rep" dropdown filter (the point
    // is to compare reps against each other, not narrow to one).
    const leaderboardParams = [];
    const lbRegionFilter = region ? `AND c.region=$${leaderboardParams.push(region)}` : '';
    const leaderboard = await pool.query(
      `SELECT u.id, u.firstname, u.lastname, r.name AS role_name,
              COUNT(so.id) AS orders, COALESCE(SUM(so.amount_ttc),0) AS revenue
       FROM sales_order so
       JOIN app_user u ON so.user_id = u.id
       LEFT JOIN role r ON u.role_id = r.id
       LEFT JOIN client c ON so.client_id = c.id
       WHERE so.status != 'cancelled' AND ${dateWhere} ${lbRegionFilter}
       GROUP BY u.id, u.firstname, u.lastname, r.name
       ORDER BY revenue DESC LIMIT 10`,
      leaderboardParams
    );

    // Monthly goal — always the current calendar month, independent of the page's period filter.
    const thisMonthRevenueQ = await pool.query(
      `SELECT COALESCE(SUM(amount_ttc),0) AS total FROM sales_order
       WHERE status != 'cancelled' AND DATE_TRUNC('month', order_date) = DATE_TRUNC('month', NOW())`
    );
    const goalQ = await pool.query('SELECT monthly_target FROM dashboard_goal WHERE id = 1');

    res.json({
      period,
      kpis: {
        totalRevenue: currentRev,
        prevRevenue: prevRev,
        variation,
        projection,
        totalOrders: parseInt(ordersQ.rows[0].total),
        activeClients: parseInt(clients.rows[0].total),
        totalProducts: parseInt(products.rows[0].total),
        lowStockProducts: parseInt(lowStock.rows[0].total),
      },
      monthlyRevenue: monthlyMerged,
      topProducts: topProducts.rows,
      topClients: topClients.rows,
      orderStatusBreakdown: orderStatusBreakdown.rows,
      paymentStatusBreakdown: paymentStatusBreakdown.rows,
      paymentMethodBreakdown: paymentMethodBreakdown.rows,
      returnsSummary: returnsSummary.rows[0],
      feedbackSummary: feedbackSummary.rows[0],
      salesLeaderboard: leaderboard.rows,
      thisMonthRevenue: parseFloat(thisMonthRevenueQ.rows[0].total),
      monthlyGoal: goalQ.rows[0]?.monthly_target ? parseFloat(goalQ.rows[0].monthly_target) : null,
    });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

// GET /api/notifications — lightweight feed for the TopBar bell (Administrator/Manager).
// Polled on an interval by the frontend, so keep it cheap: two small queries, capped lists.
const getNotifications = async (req, res) => {
  try {
    const pendingOrders = await pool.query(
      `SELECT so.id, so.order_date, so.amount_ttc, c.company_name AS client_name
       FROM sales_order so LEFT JOIN client c ON so.client_id = c.id
       WHERE so.status = 'pending' ORDER BY so.order_date DESC LIMIT 10`
    );
    const pendingCount = await pool.query(`SELECT COUNT(*) AS total FROM sales_order WHERE status='pending'`);

    const lowStockProducts = await pool.query(
      `SELECT id, name, reference, stock, type FROM (
         SELECT p.id, p.name, p.reference, p.stock, 'product' AS type
         FROM product p
         WHERE p.stock <= $1 AND NOT EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id=p.id)
         UNION ALL
         SELECT pv.id, p.name || ' — ' || pv.name AS name, COALESCE(pv.reference, p.reference) AS reference, pv.stock, 'variant' AS type
         FROM product_variant pv JOIN product p ON p.id = pv.product_id
         WHERE pv.stock <= $1
       ) AS low_stock_items
       ORDER BY stock ASC LIMIT 10`,
      [LOW_STOCK_THRESHOLD]
    );
    const lowStockCount = await pool.query(
      `SELECT COUNT(*) AS total FROM (
         SELECT p.id FROM product p
         WHERE p.stock <= $1 AND NOT EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id=p.id)
         UNION ALL
         SELECT pv.id FROM product_variant pv WHERE pv.stock <= $1
       ) AS low`,
      [LOW_STOCK_THRESHOLD]
    );

    res.json({
      pendingOrders: { count: parseInt(pendingCount.rows[0].total), items: pendingOrders.rows },
      lowStock: { count: parseInt(lowStockCount.rows[0].total), items: lowStockProducts.rows },
    });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

// PUT /api/dashboard/goal — Administrator only
const setMonthlyGoal = async (req, res) => {
  try {
    const { monthly_target } = req.body;
    const target = parseFloat(monthly_target);
    if (!target || target <= 0) return res.status(400).json({ message: 'monthly_target must be a positive number' });

    await pool.query(
      `INSERT INTO dashboard_goal (id, monthly_target, updated_by, updated_at)
       VALUES (1, $1, $2, NOW())
       ON CONFLICT (id) DO UPDATE SET monthly_target = $1, updated_by = $2, updated_at = NOW()`,
      [target, req.user.id]
    );
    res.json({ message: 'Monthly goal updated', monthly_target: target });
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

module.exports = { getDashboardStats, getSalesByRegion, setMonthlyGoal, getNotifications };

