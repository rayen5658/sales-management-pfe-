require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  // Default pool size is 10 — too small once real concurrent traffic hits the API.
  // Tune DB_POOL_MAX to match what your Postgres host allows (a small managed
  // instance is typically fine with 20-50); idle connections are recycled after 30s.
  max: parseInt(process.env.DB_POOL_MAX) || 25,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.connect()
  .then(client => {
    console.log('✅ PostgreSQL connected');
    client.release(); // release back to pool — prevents client leak
  })
  .catch(err => console.error('❌ DB connection error:', err));

module.exports = pool;