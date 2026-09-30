const pool = require('../db');

const getAuditLogs = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT al.id,al.action,al.details,al.timestamp,al.user_id,
              u.firstname||' '||u.lastname AS user_name, u.email AS user_email
       FROM audit_log al LEFT JOIN app_user u ON al.user_id=u.id ORDER BY al.timestamp DESC LIMIT 200`
    );
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

module.exports = { getAuditLogs };

