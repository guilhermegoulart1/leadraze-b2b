const { Pool } = require('pg');

const pool = new Pool({
  host: 'db.epikyczksznhjggzjjgg.supabase.co',
  port: 5432,
  database: 'postgres',
  user: 'postgres',
  password: 'W5o6k6y0@@',
  ssl: { rejectUnauthorized: false }
});

async function checkEmails() {
  try {
    const result = await pool.query(`
      SELECT id, to_email, template_name, status, subject, sent_at, error_message, message_id, created_at
      FROM email_logs
      ORDER BY created_at DESC
      LIMIT 5
    `);

    console.log('\n📧 ÚLTIMOS EMAILS:');
    console.log('='.repeat(80));

    for (const row of result.rows) {
      console.log(`\nID: ${row.id}`);
      console.log(`  Para: ${row.to_email}`);
      console.log(`  Template: ${row.template_name}`);
      console.log(`  Subject: ${row.subject || '(não definido)'}`);
      console.log(`  Status: ${row.status}`);
      console.log(`  Message ID: ${row.message_id || '(nenhum)'}`);
      console.log(`  Enviado em: ${row.sent_at || '(não enviado)'}`);
      console.log(`  Erro: ${row.error_message || '(nenhum)'}`);
      console.log(`  Criado em: ${row.created_at}`);
    }

  } catch (error) {
    console.error('Erro:', error.message);
  } finally {
    await pool.end();
  }
}

checkEmails();
