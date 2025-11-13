// backend/src/config/database.js
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'leadraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Test connection
pool.on('connect', () => {
  console.log('✅ Database connected');
});

pool.on('error', (err) => {
  console.error('❌ Unexpected database error:', err);
  process.exit(-1);
});

// Helper functions
const query = async (text, params) => {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`⚠️ Slow query (${duration}ms):`, text);
    }
    return res;
  } catch (error) {
    console.error('❌ Database query error:', error.message);
    throw error;
  }
};

const findOne = async (table, where) => {
  const keys = Object.keys(where);
  const values = Object.values(where);
  const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  
  const result = await query(`SELECT * FROM ${table} WHERE ${whereClause} LIMIT 1`, values);
  return result.rows[0] || null;
};

const findMany = async (table, where = {}, options = {}) => {
  const keys = Object.keys(where);
  const values = Object.values(where);
  
  let whereClause = keys.length > 0 
    ? 'WHERE ' + keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ')
    : '';
  
  let orderClause = '';
  if (options.orderBy) {
    orderClause = `ORDER BY ${options.orderBy}`;
  }
  
  let limitClause = '';
  if (options.limit) {
    limitClause = `LIMIT ${options.limit}`;
  }
  
  const result = await query(
    `SELECT * FROM ${table} ${whereClause} ${orderClause} ${limitClause}`,
    values
  );
  
  return result.rows;
};

const insert = async (table, data) => {
  const keys = Object.keys(data);
  const values = Object.values(data);
  const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
  
  const result = await query(
    `INSERT INTO ${table} (${keys.join(', ')}) VALUES (${placeholders}) RETURNING *`,
    values
  );
  
  return result.rows[0];
};

const update = async (table, data, where) => {
  const dataKeys = Object.keys(data);
  const dataValues = Object.values(data);
  const whereKeys = Object.keys(where);
  const whereValues = Object.values(where);
  
  const setClause = dataKeys.map((key, i) => `${key} = $${i + 1}`).join(', ');
  const whereClause = whereKeys.map((key, i) => `${key} = $${i + dataValues.length + 1}`).join(' AND ');
  
  const result = await query(
    `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`,
    [...dataValues, ...whereValues]
  );
  
  return result.rows[0];
};

const deleteRecord = async (table, where) => {
  const keys = Object.keys(where);
  const values = Object.values(where);
  const whereClause = keys.map((key, i) => `${key} = $${i + 1}`).join(' AND ');
  
  await query(`DELETE FROM ${table} WHERE ${whereClause}`, values);
  return true;
};

module.exports = {
  query,
  pool,
  findOne,
  findMany,
  insert,
  update,
  delete: deleteRecord
};