/**
 * Script to run SQL files
 * Usage: node backend/scripts/run-sql.js <path-to-sql-file>
 */

const fs = require('fs');
const path = require('path');
const db = require('../src/config/database');

async function runSqlFile(sqlFilePath) {
  try {
    // Read SQL file
    const fullPath = path.resolve(sqlFilePath);
    console.log(`📄 Reading SQL file: ${fullPath}`);

    if (!fs.existsSync(fullPath)) {
      throw new Error(`SQL file not found: ${fullPath}`);
    }

    const sql = fs.readFileSync(fullPath, 'utf8');

    // Execute SQL
    console.log(`🔄 Executing SQL...`);
    const result = await db.query(sql);

    console.log(`✅ SQL executed successfully`);
    if (result.rows && result.rows.length > 0) {
      console.log(`📊 Result:`, result.rows);
    }

    process.exit(0);
  } catch (error) {
    console.error(`❌ Error executing SQL:`, error.message);
    console.error(error);
    process.exit(1);
  }
}

// Get SQL file path from command line argument
const sqlFile = process.argv[2];

if (!sqlFile) {
  console.error('Usage: node backend/scripts/run-sql.js <path-to-sql-file>');
  process.exit(1);
}

runSqlFile(sqlFile);
