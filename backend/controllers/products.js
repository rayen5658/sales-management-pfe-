const pool = require('../db');
const fs = require('fs');

const { TVA_RATE, handleControllerError, handleValidationErrors } = require('./shared');

// GET ALL PRODUCTS — supports ?page=1&limit=20 for pagination
const getAllProducts = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(200, Math.max(1, parseInt(req.query.limit) || 50));
    const offset = (page - 1) * limit;

    const countResult = await pool.query('SELECT COUNT(*) AS total FROM product');
    const total = parseInt(countResult.rows[0].total);

    const result = await pool.query(
      'SELECT * FROM product ORDER BY id ASC LIMIT $1 OFFSET $2',
      [limit, offset]
    );

    res.json({
      data: result.rows,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNext: page * limit < total,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error('DB/controller error:', error);
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

    const result = await pool.query(
      `INSERT INTO product (reference, name, description, unit_price, stock, image, category_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [reference, name, description, unit_price, stock, image || null, category_id]
    );

    res.status(201).json(result.rows[0]);
  } catch (error) {
    return handleControllerError(res, error, 500);
  }
};

// UPDATE PRODUCT
const updateProduct = async (req, res) => {
  if (handleValidationErrors(req, res)) return;
  try {
    const { id } = req.params;
    const { reference, name, description, unit_price, stock, image, category_id } = req.body;

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
  } catch (error) {
    res.status(500).json({ error: error.message });
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
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// IMPORT PRODUCTS FROM CSV
const importProductsCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Aucun fichier fourni' });

  const filePath = req.file.path;
  try {
    const raw = fs.readFileSync(filePath, 'utf-8').replace(/^\uFEFF/, ''); // strip BOM
    const lines = raw.split(/\r?\n/).filter(l => l.trim());

    if (lines.length < 2) {
      fs.unlinkSync(filePath);
      return res.status(400).json({ error: 'Le fichier est vide ou ne contient que l\'en-tête' });
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
        error: 'Colonnes requises manquantes. Le fichier doit contenir : nom (ou name), prix (ou price), stock',
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
        results.errors.push(`Ligne ${i + 1} ignorée — prix ou stock invalide`);
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
        results.errors.push(`Ligne ${i + 1} (${name}) — ${rowErr.message}`);
      }
    }

    fs.unlinkSync(filePath);
    res.json({
      message: `Import terminé : ${results.inserted} ajouté(s), ${results.updated} mis à jour`,
      ...results,
    });
  } catch (err) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: err.message });
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

