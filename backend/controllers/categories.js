const pool = require('../db');
const { handleValidationErrors, writeAuditLog } = require('./shared');

const getAllCategories = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.id) AS product_count FROM category c
      LEFT JOIN product p ON p.category_id = c.id GROUP BY c.id ORDER BY c.id ASC
    `);
    res.json(result.rows);
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const getCategoryById = async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM category WHERE id=$1', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Category not found' });
    res.json(result.rows[0]);
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const createCategory = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { name, description, image, parent_id } = req.body;
    const result = await pool.query(
      'INSERT INTO category (name,description,image,parent_id) VALUES ($1,$2,$3,$4) RETURNING *',
      [name, description || null, image || null, parent_id || null]
    );
    res.status(201).json(result.rows[0]);
    await writeAuditLog(req.user?.id, 'CATEGORY_CREATE', `Category created: "${name}"`);
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const updateCategory = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { name, description, image, parent_id } = req.body;
    const result = await pool.query(
      'UPDATE category SET name=$1,description=$2,image=$3,parent_id=$4 WHERE id=$5 RETURNING *',
      [name, description || null, image || null, parent_id || null, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Category not found' });
    res.json(result.rows[0]);
    await writeAuditLog(req.user?.id, 'CATEGORY_UPDATE', `Category #${id} updated: "${name}"`);
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

const deleteCategory = async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM category WHERE id=$1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Category not found' });
    res.json({ message: 'Category deleted successfully', category: result.rows[0] });
    await writeAuditLog(req.user?.id, 'CATEGORY_DELETE', `Category #${req.params.id} deleted: "${result.rows[0].name}"`);
  } catch (error) { res.status(500).json({ message: 'Internal server error' }); }
};

module.exports = {
  getAllCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
};

