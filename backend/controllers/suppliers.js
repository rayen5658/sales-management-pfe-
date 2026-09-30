const pool = require('../db');
const { handleValidationErrors, handleControllerError, writeAuditLog } = require('./shared');

const getAllSuppliers = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT s.*, COUNT(po.id) AS purchase_order_count
       FROM supplier s LEFT JOIN purchase_order po ON po.supplier_id = s.id
       GROUP BY s.id ORDER BY s.name ASC`
    );
    res.json(result.rows);
  } catch (error) { handleControllerError(res, error); }
};

const getSupplierById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM supplier WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Supplier not found' });
    res.json(result.rows[0]);
  } catch (error) { handleControllerError(res, error); }
};

const createSupplier = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { name, contact_name, email, phone, address, status } = req.body;
    const result = await pool.query(
      `INSERT INTO supplier (name, contact_name, email, phone, address, status)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [name, contact_name || null, email || null, phone || null, address || null, status || 'active']
    );
    await writeAuditLog(req.user.id, 'SUPPLIER_CREATE', `Supplier "${name}" created`);
    res.status(201).json(result.rows[0]);
  } catch (error) { handleControllerError(res, error); }
};

const updateSupplier = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { name, contact_name, email, phone, address, status } = req.body;
    const result = await pool.query(
      `UPDATE supplier SET name=$1, contact_name=$2, email=$3, phone=$4, address=$5, status=$6 WHERE id=$7 RETURNING *`,
      [name, contact_name || null, email || null, phone || null, address || null, status || 'active', id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Supplier not found' });
    res.json(result.rows[0]);
  } catch (error) { handleControllerError(res, error); }
};

const deleteSupplier = async (req, res) => {
  try {
    const { id } = req.params;
    const used = await pool.query('SELECT id FROM purchase_order WHERE supplier_id=$1 LIMIT 1', [id]);
    if (used.rows.length > 0) {
      return res.status(400).json({ message: 'This supplier has purchase orders — deactivate it instead of deleting it' });
    }
    const result = await pool.query('DELETE FROM supplier WHERE id=$1 RETURNING id, name', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Supplier not found' });
    await writeAuditLog(req.user.id, 'SUPPLIER_DELETE', `Supplier "${result.rows[0].name}" deleted`);
    res.json({ message: 'Supplier deleted' });
  } catch (error) { handleControllerError(res, error); }
};

module.exports = { getAllSuppliers, getSupplierById, createSupplier, updateSupplier, deleteSupplier };
