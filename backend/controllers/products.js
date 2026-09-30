const pool = require('../db');
const fs = require('fs');

const { handleControllerError, handleValidationErrors, writeAuditLog } = require('./shared');
const { LOW_STOCK_THRESHOLD } = require('../constants');

// GET ALL PRODUCTS — supports pagination + search + category + stock filters
const getAllProducts = async (req, res) => {
  try {
    const page   = Math.max(1, parseInt(req.query.page)  || 1);
    const limit  = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const { search, category_id, low_stock } = req.query;

    // Safe whitelist for sort fields — never interpolate user input directly
    const ALLOWED_SORT_FIELDS = {
      name:       'p.name',
      reference:  'p.reference',
      unit_price: 'p.unit_price',
      stock:      'p.stock',
      id:         'p.id',
    };
    const sortField = ALLOWED_SORT_FIELDS[req.query.sort_by] || 'p.name';
    const sortDir   = req.query.sort_dir === 'desc' ? 'DESC' : 'ASC';

    const where = [];
    const params = [];
    let i = 1;

    if (search) {
      where.push(`(p.name ILIKE $${i} OR p.reference ILIKE $${i})`);
      params.push(`%${search}%`);
      i++;
    }
    if (category_id) {
      where.push(`p.category_id = $${i++}`);
      params.push(parseInt(category_id));
    }
    if (low_stock === 'true' || low_stock === '1') {
      // A product with variants uses variant stock, not its own — flag it as low stock only
      // if a variant is low, not based on the (possibly irrelevant) base product.stock.
      where.push(`(
        (p.stock <= ${LOW_STOCK_THRESHOLD} AND NOT EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id=p.id))
        OR EXISTS(SELECT 1 FROM product_variant pv WHERE pv.product_id=p.id AND pv.stock <= ${LOW_STOCK_THRESHOLD})
      )`);
    }

    const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const countResult = await pool.query(
      `SELECT COUNT(*) AS total FROM product p ${whereClause}`, params
    );
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      `SELECT p.*, c.name AS category_name
       FROM product p
       LEFT JOIN category c ON p.category_id = c.id
       ${whereClause}
       ORDER BY ${sortField} ${sortDir} LIMIT $${i} OFFSET $${i + 1}`,
      [...params, limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page, limit, total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('getAllProducts error:', error);
    return handleControllerError(res, error, 500);
  }
};

// GET ONE PRODUCT
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('SELECT * FROM product WHERE id = $1', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(result.rows[0]);
  } catch (error) {
    return handleControllerError(res, error, 500);
  }
};

// CREATE PRODUCT
const createProduct = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { reference, name, description, unit_price, stock, image, category_id } = req.body;

    // Check for duplicate reference before inserting
    if (reference) {
      const existing = await pool.query('SELECT id FROM product WHERE reference = $1', [reference]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: `A product with reference "${reference}" already exists. References must be unique.` });
      }
    }

    const result = await pool.query(
      `INSERT INTO product (reference, name, description, unit_price, stock, image, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [reference, name, description, unit_price, stock, image || null, category_id]
    );

    res.status(201).json(result.rows[0]);
    await writeAuditLog(req.user?.id, 'PRODUCT_CREATE', `Product created: "${name}" (ref: ${reference || 'none'})`);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'product_reference_key') {
      return res.status(409).json({ message: `A product with this reference already exists. References must be unique.` });
    }
    return handleControllerError(res, error, 500);
  }
};

// UPDATE PRODUCT
const updateProduct = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { reference, name, description, unit_price, stock, image, category_id } = req.body;

    // Check for duplicate reference on another product
    if (reference) {
      const existing = await pool.query('SELECT id FROM product WHERE reference = $1 AND id != $2', [reference, id]);
      if (existing.rows.length > 0) {
        return res.status(409).json({ message: `Another product already uses reference "${reference}". References must be unique.` });
      }
    }

    const result = await pool.query(
      `UPDATE product 
       SET reference = $1, name = $2, description = $3, unit_price = $4, stock = $5, image = $6, category_id = $7
       WHERE id = $8
       RETURNING *`,
      [reference, name, description, unit_price, stock, image || null, category_id, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json(result.rows[0]);
    await writeAuditLog(req.user?.id, 'PRODUCT_UPDATE', `Product #${id} updated: "${result.rows[0].name}"`);
  } catch (error) {
    if (error.code === '23505' && error.constraint === 'product_reference_key') {
      return res.status(409).json({ message: `Another product already uses this reference. References must be unique.` });
    }
    console.error('updateProduct:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// DELETE PRODUCT
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query('DELETE FROM product WHERE id = $1 RETURNING *', [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }

    res.json({
      message: 'Product deleted successfully',
      product: result.rows[0],
    });
    await writeAuditLog(req.user?.id, 'PRODUCT_DELETE', `Product deleted: "${result.rows[0].name}" #${id}`);
  } catch (error) {
    console.error('deleteProduct:', error.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

// IMPORT PRODUCTS FROM CSV
const importProductsCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ message: 'No file provided' });

  const filePath = req.file.path;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM
    const lines = raw.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ message: 'The file is empty or contains only the header row' });
    }

    // Detect separator (semicolon or comma)
    const sep = lines[0].includes(';') ? ';' : ',';
    const headers = lines[0]
      .split(sep)
      .map(h => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, ''));

    const col = (names) => {
      for (const n of names) {
        const idx = headers.indexOf(n);
        if (idx !== -1) return idx;
      }
      return -1;
    };

    const iName = col(['nom', 'name']);
    const iRef = col(['reference', 'ref', 'sku']);
    const iDesc = col(['description', 'desc']);
    const iPrice = col(['prix', 'price', 'prixht', 'unitprice', 'unit_price', 'prixunitaire']);
    const iStock = col(['stock', 'quantite', 'quantity', 'qty']);
    const iCat = col(['categorie', 'category', 'category_id', 'categorieid', 'catid']);
    const iImage = col(['image', 'img', 'imageurl']);

    if (iName === -1 || iPrice === -1 || iStock === -1) {
      fs.unlinkSync(filePath);
      return res.status(400).json({
        error: 'Required columns missing. File must contain: name (or nom), price (or prix), stock',
      });
    }

    const catsResult = await pool.query('SELECT id, name FROM category');
    const catMap = {};
    catsResult.rows.forEach(c => { catMap[c.name.toLowerCase()] = c.id; });

    const results = { inserted: 0, updated: 0, errors: [] };

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(sep).map(c => c.trim().replace(/^"|"$/g, ''));
      const name = cols[iName]?.trim();
      if (!name) continue;

      const reference = iRef !== -1 ? cols[iRef]?.trim() || null : null;
      const description = iDesc !== -1 ? cols[iDesc]?.trim() || null : null;
      const unit_price = parseFloat((cols[iPrice] || '0').replace(',', '.'));
      const stock = parseInt(cols[iStock] || '0', 10);
      const image = iImage !== -1 ? cols[iImage]?.trim() || null : null;

      let category_id = null;
      if (iCat !== -1 && cols[iCat]) {
        const raw = cols[iCat].trim();
        if (/^\d+$/.test(raw)) category_id = parseInt(raw, 10);
        else category_id = catMap[raw.toLowerCase()] || null;
      }

      if (isNaN(unit_price) || isNaN(stock)) {
        results.errors.push(`Row ${i + 1} skipped — invalid price or stock`);
        continue;
      }

      try {
        if (reference) {
          const existing = await pool.query('SELECT id FROM product WHERE reference = $1', [reference]);
          if (existing.rows.length > 0) {
            await pool.query(
              `UPDATE product SET name=$1, description=$2, unit_price=$3, stock=$4, category_id=$5, image=$6 WHERE reference=$7`,
              [name, description, unit_price, stock, category_id, image, reference]
            );
            results.updated++;
          } else {
            await pool.query(
              `INSERT INTO product (name, reference, description, unit_price, stock, category_id, image) VALUES ($1,$2,$3,$4,$5,$6,$7)`,
              [name, reference, description, unit_price, stock, category_id, image]
            );
            results.inserted++;
          }
        } else {
          await pool.query(
            `INSERT INTO product (name, description, unit_price, stock, category_id, image) VALUES ($1,$2,$3,$4,$5,$6)`,
            [name, description, unit_price, stock, category_id, image]
          );
          results.inserted++;
        }
      } catch (rowErr) {
        results.errors.push(`Row ${i + 1} (${name}) — ${rowErr.message}`);
      }
    }

    fs.unlinkSync(filePath);
    res.json({
      message: `Import complete: ${results.inserted} inserted, ${results.updated} updated`,
      ...results,
    });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    console.error('importProductsCSV:', err.message);
    res.status(500).json({ message: 'Internal server error' });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  importProductsCSV,
};

