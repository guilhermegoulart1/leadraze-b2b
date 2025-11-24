// Verify google_maps_agents table has all new columns
require('dotenv').config();
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
});

async function verifySchema() {
  const client = await pool.connect();

  try {
    console.log('🔍 Verificando schema da tabela google_maps_agents...\n');

    const query = `
      SELECT column_name, data_type, character_maximum_length, column_default
      FROM information_schema.columns
      WHERE table_name = 'google_maps_agents'
      AND column_name IN ('avatar_url', 'radius', 'latitude', 'longitude', 'business_category', 'business_specification')
      ORDER BY ordinal_position;
    `;

    const result = await client.query(query);

    if (result.rows.length === 0) {
      console.log('❌ Colunas não encontradas! Migration pode não ter sido executada.\n');
    } else {
      console.log('✅ Colunas encontradas:\n');
      result.rows.forEach(row => {
        console.log(`  • ${row.column_name}`);
        console.log(`    Tipo: ${row.data_type}${row.character_maximum_length ? `(${row.character_maximum_length})` : ''}`);
        if (row.column_default) {
          console.log(`    Default: ${row.column_default}`);
        }
        console.log('');
      });
    }

    console.log(`Total: ${result.rows.length}/6 colunas encontradas\n`);

  } catch (error) {
    console.error('❌ Erro:', error.message);
  } finally {
    client.release();
    await pool.end();
  }
}

verifySchema()
  .then(() => {
    console.log('✨ Verificação completa!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Erro fatal:', error.message);
    process.exit(1);
  });
