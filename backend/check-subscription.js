require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function check() {
  try {
    const result = await db.query('SELECT * FROM subscriptions LIMIT 1');
    console.log(JSON.stringify(result.rows[0], null, 2));
    process.exit(0);
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

check();
