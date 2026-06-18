require('dotenv').config();
const pool = require('./db');

async function checkOrder() {
  try {
    const result = await pool.query('SELECT id, client_id, notes FROM sales_order WHERE id = 94');
    if (result.rows.length === 0) {
      console.log('Order #94 not found');
    } else {
      console.log('Order #94:');
      console.log(JSON.stringify(result.rows[0], null, 2));
    }
  } catch (error) {
    console.error('Error:', error.message);
  } finally {
    process.exit(0);
  }
}

checkOrder();
