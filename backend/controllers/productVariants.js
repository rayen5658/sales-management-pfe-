const pool = require('../db');
const { handleValidationErrors, handleControllerError, writeAuditLog } = require('./shared');

const getVariantsByProduct = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM product_variant WHERE product_id=$1 ORDER BY id ASC',
      [req.params.productId]
    );
    res.json(result.rows);
  } catch (error) { handleControllerError(res, error); }
};

const createVariant = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { productId } = req.params;
    const { name, reference, unit_price, stock } = req.body;
    const productResult = await pool.query('SELECT id FROM product WHERE id=$1', [productId]);
    if (productResult.rows.length === 0) return res.status(404).json({ message: 'Product not found' });

    const result = await pool.query(
      `INSERT INTO product_variant (product_id, name, reference, unit_price, stock)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [productId, name, reference || null, unit_price, stock || 0]
    );
    await writeAuditLog(req.user.id, 'VARIANT_CREATE', `Variant "${name}" created for product #${productId}`);
    res.status(201).json(result.rows[0]);
  } catch (error) { handleControllerError(res, error); }
};

const updateVariant = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { name, reference, unit_price, stock } = req.body;
    const result = await pool.query(
      `UPDATE product_variant SET name=$1, reference=$2, unit_price=$3, stock=$4 WHERE id=$5 RETURNING *`,
      [name, reference || null, unit_price, stock || 0, id]
    );
    if (result.rows.length === 0) return res.status(404).json({ message: 'Variant not found' });
    res.json(result.rows[0]);
  } catch (error) { handleControllerError(res, error); }
};

const deleteVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const used = await pool.query('SELECT id FROM order_line WHERE variant_id=$1 LIMIT 1', [id]);
    if (used.rows.length > 0) {
      return res.status(400).json({ message: 'This variant has been ordered — it cannot be deleted (order history depends on it)' });
    }
    const result = await pool.query('DELETE FROM product_variant WHERE id=$1 RETURNING id, name', [id]);
    if (result.rows.length === 0) return res.status(404).json({ message: 'Variant not found' });
    await writeAuditLog(req.user.id, 'VARIANT_DELETE', `Variant "${result.rows[0].name}" deleted`);
    res.json({ message: 'Variant deleted' });
  } catch (error) { handleControllerError(res, error); }
};

module.exports = { getVariantsByProduct, createVariant, updateVariant, deleteVariant };
