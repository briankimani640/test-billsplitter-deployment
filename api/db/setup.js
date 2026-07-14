// Run with: node db/setup.js
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  host:     process.env.DB_HOST     || 'localhost',
  port:     parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME     || 'splitkesh',
  user:     process.env.DB_USER     || 'postgres',
  password: process.env.DB_PASSWORD || '',
});

async function setup() {
  try {
    console.log('🔌 Connecting to PostgreSQL...');
    const client = await pool.connect();
    console.log('✅ Connected!');

    const sql = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    await client.query(sql);
    console.log('✅ Schema created successfully!');
    client.release();
    await pool.end();
    console.log('✅ Database setup complete. Run: npm run dev');
  } catch (err) {
    console.error('❌ Setup failed:', err.message);
    console.error('\n👉 Make sure PostgreSQL is running and your .env is configured correctly.');
    process.exit(1);
  }
}

setup();
