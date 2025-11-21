// Script to add assigned_user_id column to conversations table
const { pool } = require('../src/config/database');

async function addAssignmentColumn() {
  const client = await pool.connect();

  try {
    console.log('🔄 Adding assigned_user_id column to conversations table...');

    // Check if column exists
    const checkQuery = `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = 'conversations'
      AND column_name = 'assigned_user_id'
    `;

    const checkResult = await client.query(checkQuery);

    if (checkResult.rows.length > 0) {
      console.log('✅ Column assigned_user_id already exists!');
      return;
    }

    // Add column
    await client.query(`
      ALTER TABLE conversations
      ADD COLUMN assigned_user_id UUID REFERENCES users(id) ON DELETE SET NULL
    `);

    console.log('✅ Column assigned_user_id added!');

    // Create indexes
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_assigned_user
      ON conversations(assigned_user_id)
    `);

    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_conversations_sector_assigned
      ON conversations(sector_id, assigned_user_id)
    `);

    console.log('✅ Indexes created!');
    console.log('✅ Migration completed successfully!');

  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

addAssignmentColumn()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed to add column:', error);
    process.exit(1);
  });
