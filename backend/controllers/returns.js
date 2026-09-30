const pool = require('../db');
const { handleControllerError, writeAuditLog } = require('./shared');
const { sendReturnResolvedEmail } = require('../email');

// GET /api/returns — Administrator/Manager
const getAllReturns = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, c.company_name AS client_name, so.amount_ttc, so.status AS order_status, so.payment_status
       FROM order_return r
       LEFT JOIN client c ON r.client_id = c.id
       LEFT JOIN sales_order so ON r.order_id = so.id
       ORDER BY r.requested_at DESC`
    );
    res.json(result.rows);
  } catch (error) { handleControllerError(res, error); }
};

// PUT /api/returns/:id/approve — Administrator/Manager
// Restocks the order's items and, if the order was paid, marks it refunded.
const approveReturn = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { resolution_note } = req.body;

    await client.query('BEGIN');
    const returnResult = await client.query(
      `SELECT r.*, so.payment_status, c.email AS client_email, c.company_name AS client_name
       FROM order_return r LEFT JOIN sales_order so ON r.order_id = so.id LEFT JOIN client c ON r.client_id = c.id
       WHERE r.id = $1`, [id]
    );
    if (returnResult.rows.length === 0) { await client.query('ROLLBACK'); return res.status(404).json({ message: 'Return request not found' }); }
    const ret = returnResult.rows[0];
    if (ret.status !== 'requested') { await client.query('ROLLBACK'); return res.status(400).json({ message: `Already ${ret.status}` }); }

    const linesResult = await client.query('SELECT product_id, quantity FROM order_line WHERE order_id=$1', [ret.order_id]);
    for (const line of linesResult.rows) {
      await client.query('UPDATE product SET stock=stock+$1 WHERE id=$2', [line.quantity, line.product_id]);
    }

    if (ret.payment_status === 'paid') {
      await client.query(`UPDATE sales_order SET payment_status='refunded' WHERE id=$1`, [ret.order_id]);
    }

    const updated = await client.query(
      `UPDATE order_return SET status='approved', resolved_at=NOW(), resolved_by=$1, resolution_note=$2 WHERE id=$3 RETURNING *`,
      [req.user.id, resolution_note || null, id]
    );

    await client.query('COMMIT');
    await writeAuditLog(req.user.id, 'RETURN_APPROVED', `Return #${id} (order #${ret.order_id}) approved — stock restored${ret.payment_status === 'paid' ? ', order refunded' : ''}`);

    if (ret.client_email) {
      sendReturnResolvedEmail({ toEmail: ret.client_email, toName: ret.client_name, order: { id: ret.order_id }, approved: true, resolutionNote: resolution_note }).catch(() => {});
    }

    res.json({ message: 'Return approved', return: updated.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    handleControllerError(res, error);
  } finally { client.release(); }
};

// PUT /api/returns/:id/reject — Administrator/Manager
const rejectReturn = async (req, res) => {
  try {
    const { id } = req.params;
    const { resolution_note } = req.body;
    if (!resolution_note || !resolution_note.trim()) return res.status(400).json({ message: 'A reason is required to reject a return' });

    const returnResult = await pool.query(
      `SELECT r.*, c.email AS client_email, c.company_name AS client_name
       FROM order_return r LEFT JOIN client c ON r.client_id = c.id WHERE r.id = $1`, [id]
    );
    if (returnResult.rows.length === 0) return res.status(404).json({ message: 'Return request not found' });
    const ret = returnResult.rows[0];
    if (ret.status !== 'requested') return res.status(400).json({ message: `Already ${ret.status}` });

    const updated = await pool.query(
      `UPDATE order_return SET status='rejected', resolved_at=NOW(), resolved_by=$1, resolution_note=$2 WHERE id=$3 RETURNING *`,
      [req.user.id, resolution_note, id]
    );

    await writeAuditLog(req.user.id, 'RETURN_REJECTED', `Return #${id} (order #${ret.order_id}) rejected — ${resolution_note}`);

    if (ret.client_email) {
      sendReturnResolvedEmail({ toEmail: ret.client_email, toName: ret.client_name, order: { id: ret.order_id }, approved: false, resolutionNote: resolution_note }).catch(() => {});
    }

    res.json({ message: 'Return rejected', return: updated.rows[0] });
  } catch (error) { handleControllerError(res, error); }
};

module.exports = { getAllReturns, approveReturn, rejectReturn };
