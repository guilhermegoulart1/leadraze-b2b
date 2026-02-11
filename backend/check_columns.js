require('dotenv').config();
const db = require('./src/config/database');

(async () => {
  try {
    const cols = await db.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_name = 'ai_agents'
      ORDER BY ordinal_position
    `);
    console.log('=== AI_AGENTS COLUMNS ===');
    console.log(cols.rows.map(r => r.column_name).join(', '));
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message);
    process.exit(1);
  }
})();
