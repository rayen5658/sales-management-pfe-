require('dotenv').config();
const pool = require('./db');
const bcrypt = require('bcryptjs');

async function seedTestClient() {
  try {
    console.log('🌱 Starting test client seeding...');

    // Check if test client already exists
    const existing = await pool.query('SELECT id FROM client WHERE email = $1', ['test@client.com']);
    
    if (existing.rows.length > 0) {
      console.log('⚠️  Test client already exists. Skipping...');
      return;
    }

    const hashedPassword = await bcrypt.hash('client123', 10);

    // Create test client
    const result = await pool.query(
      `INSERT INTO client (company_name, email, phone, address, region, password_hash, portal_enabled, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, company_name, email, region`,
      [
        'Test Client Ltd',
        'test@client.com',
        '+216 71 123 456',
        '123 Test Street',
        'Tunis',
        hashedPassword,
        true,
        'active'
      ]
    );

    console.log('✅ Test client created successfully!');
    console.log('📧 Email: test@client.com');
    console.log('🔐 Password: client123');
    console.log('');
    console.log('Client details:', result.rows[0]);
  } catch (error) {
    console.error('❌ Error seeding test client:', error.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

seedTestClient();
