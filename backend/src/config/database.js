// backend/src/config/database.js
const { Pool, types } = require('pg');

// Configure pg to return timestamps as ISO strings (UTC) instead of converting to local timezone
// Type 1114 = TIMESTAMP WITHOUT TIME ZONE
// Type 1184 = TIMESTAMP WITH TIME ZONE
types.setTypeParser(1114, (val) => val); // Return as string
types.setTypeParser(1184, (val) => val); // Return as string

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'getraze',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
  // SSL is required for cloud databases (Supabase, Railway, etc.) even in development
  // Note: rlwy.net proxy doesn't support SSL
  ssl: process.env.DB_HOST && (process.env.DB_HOST.includes('supabase.co') || process.env.DB_HOST.includes('railway.app'))
    ? { rejectUnauthorized: false }
    : (process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false),

  // ✅ OPTIMIZED: Increased for high-volume webhook processing
  max: 50, // Increased from 20 to support concurrent webhooks + campaigns
  min: 10, // Keep minimum 10 connections warm

  // ✅ OPTIMIZED: Increased timeouts
  idleTimeoutMillis: 30000, // 30s - time to keep idle connections
  connectionTimeoutMillis: 10000, // 10s - increased from 2s for stability

  // ✅ OPTIMIZED: Statement timeout to prevent stuck queries
  statement_timeout: 30000, // 30s max per query (kills slow queries)
});

// Track if initial connection was successful
let connectionLogged = false;

// Test connection - only log first connection, not every pool acquire
pool.on('connect', (client) => {
  if (!connectionLogged) {
    console.log('✅ Database connected successfully');
    console.log(`   Pool config: max=${pool.options.max}, min=${pool.options.min || 0}`);
    connectionLogged = true;
  }

  // Set timezone to UTC to ensure consistent date handling
  client.query("SET timezone = 'UTC'").catch(err => {
    console.warn('Failed to set timezone:', err.message);
  });

  // Set statement timeout for this client
  client.query('SET statement_timeout = 30000').catch(err => {
    console.warn('Failed to set statement_timeout:', err.message);
  });
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

  const sql = `UPDATE ${table} SET ${setClause} WHERE ${whereClause} RETURNING *`;
  const params = [...dataValues, ...whereValues];

  // DEBUG: Log the SQL and params
  console.log('[db.update] SQL:', sql);
  console.log('[db.update] Params:', JSON.stringify(params));

  const result = await query(sql, params);

  // DEBUG: Log result
  console.log('[db.update] Result due_date:', result.rows[0]?.due_date);

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