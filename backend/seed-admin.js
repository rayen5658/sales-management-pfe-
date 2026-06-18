require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcryptjs');

async function seedAdmin() {
  try {
    console.log('🌱 Starting admin user seeding...');

    // Check if admin already exists
    const existing = await pool.query('SELECT id FROM app_user WHERE email = $1', ['admin@example.com']);
    
    if (existing.rows.length > 0) {
      console.log('⚠️  Admin user already exists. Skipping...');
      return;
    }

    // Get Administrator role ID
    const roleResult = await pool.query("SELECT id FROM role WHERE name = 'Administrator'");
    if (roleResult.rows.length === 0) {
      console.error('❌ Administrator role not found. Please ensure roles are properly seeded.');
      process.exit(1);
    }

    const roleId = roleResult.rows[0].id;
    const hashedPassword = await bcrypt.hash('admin123', 10);

    // Create admin user
    const result = await pool.query(
      `INSERT INTO app_user (firstname, lastname, email, password_hash, role_id, status)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, firstname, lastname, role_id`,
      ['Admin', 'User', 'admin@example.com', hashedPassword, roleId, 'active']
    );

    console.log('✅ Admin user created successfully!');
    console.log('📧 Email: admin@example.com');
    console.log('🔐 Password: admin123');
    console.log('');
    console.log('User details:', result.rows[0]);
  } catch (error) {
    console.error('❌ Error seeding admin user:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedAdmin();
