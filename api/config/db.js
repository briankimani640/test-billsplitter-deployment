const { Pool } = require('pg');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'splitkesh',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
  max:      10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('❌ Unexpected DB error:', err.message);
});

// Helper — run a query with params
const query = (text, params) => pool.query(text, params);

// Helper — get a client for transactions
const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
