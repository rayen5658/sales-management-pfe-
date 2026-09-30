const pool = require('../db');

const { handleValidationErrors, writeAuditLog } = require('./shared');
const { sendClientApprovedEmail } = require('../email');

const getClientOrders = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT so.id, so.order_date, so.status, so.amount_ht, so.tva, so.amount_ttc, so.cancel_reason
       FROM sales_order so WHERE so.client_id=$1 ORDER BY so.order_date DESC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (error) { console.error('getClientOrders:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const getAllClients = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,company_name,address,region,email,phone,segment,status,credit_limit,payment_terms FROM client ORDER BY company_name ASC LIMIT 1000'
    );
    res.json(result.rows);
  } catch (error) { console.error('getAllClients:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const getClientById = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id,company_name,address,region,email,phone,segment,status,credit_limit,payment_terms FROM client WHERE id=$1',
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    res.json(result.rows[0]);
  } catch (error) { console.error('getClientById:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const createClient = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { company_name, address, region, email, phone, segment, status, credit_limit, payment_terms } = req.body;
    const result = await pool.query(
      `INSERT INTO client (company_name,address,region,email,phone,segment,status,credit_limit,payment_terms)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [company_name, address||null, region||null, email||null, phone||null, segment||null, status||null,
       credit_limit === '' || credit_limit == null ? null : credit_limit, payment_terms || 'immediate']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) { console.error('createClient:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const updateClient = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { company_name, address, region, email, phone, segment, status, credit_limit, payment_terms } = req.body;
    const result = await pool.query(
      `UPDATE client SET company_name=$1,address=$2,region=$3,email=$4,phone=$5,segment=$6,status=$7,credit_limit=$8,payment_terms=$9
       WHERE id=$10 RETURNING *`,
      [company_name, address||null, region||null, email||null, phone||null, segment||null, status||null,
       credit_limit === '' || credit_limit == null ? null : credit_limit, payment_terms || 'immediate', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    res.json(result.rows[0]);
  } catch (error) { console.error('updateClient:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const deleteClient = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM client WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    res.json({ message: 'Client deleted successfully', client: result.rows[0] });
  } catch (error) { console.error('deleteClient:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const archiveClient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`UPDATE client SET status='archived' WHERE id=$1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    await writeAuditLog(req.user?.id, 'CLIENT_ARCHIVE', `Client #${id} archived`);
    res.json({ message: 'Client archived', client: result.rows[0] });
  } catch (error) { console.error('archiveClient:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

const restoreClient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`UPDATE client SET status='active' WHERE id=$1 RETURNING *`, [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Client not found' });
    await writeAuditLog(req.user?.id, 'CLIENT_RESTORE', `Client #${id} restored`);
    res.json({ message: 'Client restored', client: result.rows[0] });
  } catch (error) { console.error('restoreClient:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

// Approves a self-registered client (status='pending' → 'active'), granting
// them portal login access, and emails them the news.
const approveClient = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      `UPDATE client SET status='active' WHERE id=$1 AND status='pending' RETURNING *`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'No pending client found with this id' });

    const client = result.rows[0];
    await writeAuditLog(req.user?.id, 'CLIENT_APPROVE', `Client #${id} approved for portal access`);

    if (client.email) {
      const loginUrl = `${process.env.FRONTEND_URL || 'http://localhost:5173'}/client/login`;
      sendClientApprovedEmail({ toEmail: client.email, toName: client.company_name, loginUrl }).catch(() => {});
    }

    res.json({ message: 'Client approved', client });
  } catch (error) { console.error('approveClient:', error.message); res.status(500).json({ message: 'Internal server error' }); }
};

module.exports = {
  getAllClients,
  getClientById,
  getClientOrders,
  createClient,
  updateClient,
  deleteClient,
  archiveClient,
  restoreClient,
  approveClient,
};

