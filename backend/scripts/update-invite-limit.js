// Update LinkedIn account invite limit
const db = require('../src/config/database');

async function updateInviteLimit() {
  try {
    // Atualizar o daily_invite_limit e account_type
    const result = await db.query(`
      UPDATE linkedin_accounts
      SET
        daily_invite_limit = 50,
        account_type = 'premium'
      WHERE id IN (SELECT id FROM linkedin_accounts LIMIT 1)
      RETURNING id, linkedin_username, profile_name, account_type, daily_invite_limit
    `);

    if (result.rows.length > 0) {
      console.log('\n✅ Conta atualizada com sucesso:');
      console.table(result.rows);
    } else {
      console.log('\n⚠️ Nenhuma conta encontrada');
    }

    process.exit(0);
  } catch (error) {
    console.error('❌ Erro:', error.message);
    process.exit(1);
  }
}

updateInviteLimit();
