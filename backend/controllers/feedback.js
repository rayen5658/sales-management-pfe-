const pool = require('../db');
const { handleControllerError } = require('./shared');

// GET /api/feedback — Administrator/Manager
const getAllFeedback = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, c.company_name AS client_name
       FROM order_feedback f LEFT JOIN client c ON f.client_id = c.id
       ORDER BY f.created_at DESC`
    );
    const avgResult = await pool.query('SELECT ROUND(AVG(rating)::numeric, 2) AS avg_rating, COUNT(*) AS total FROM order_feedback');
    res.json({ data: result.rows, avg_rating: avgResult.rows[0].avg_rating, total: parseInt(avgResult.rows[0].total) });
  } catch (error) { handleControllerError(res, error); }
};

module.exports = { getAllFeedback };
