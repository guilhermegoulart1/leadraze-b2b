require('dotenv').config({ path: __dirname + '/.env' });
const db = require('./src/config/database');

async function fixTrialCredits() {
  const accountId = 'a4b5f4d7-e0ad-46c6-bd9a-aaa7e9bdcc16';

  try {
    // 1. Expirar créditos mensais (subscription) - trial não deve ter créditos mensais
    const expireResult = await db.query(`
      UPDATE credit_packages
      SET status = 'expired', updated_at = NOW()
      WHERE account_id = $1
      AND source = 'subscription'
      AND status = 'active'
    `, [accountId]);

    console.log(`Créditos mensais expirados: ${expireResult.rowCount}`);

    // 2. Garantir que apenas os 20 créditos de trial (bonus) estão ativos
    const activeCredits = await db.query(`
      SELECT credit_type, initial_credits, remaining_credits, source, status
      FROM credit_packages
      WHERE account_id = $1 AND status = 'active'
      ORDER BY created_at DESC
    `, [accountId]);

    console.log('\nCréditos ativos agora:');
    if (activeCredits.rows.length === 0) {
      console.log('Nenhum crédito ativo');
    } else {
      activeCredits.rows.forEach(r => {
        console.log(`- ${r.credit_type}: ${r.remaining_credits}/${r.initial_credits} (${r.source})`);
      });
    }

    // 3. Verificar total disponível
    const gmapsTotal = await db.query(`
      SELECT COALESCE(SUM(remaining_credits), 0) as total
      FROM credit_packages
      WHERE account_id = $1 AND credit_type IN ('gmaps', 'gmaps_monthly') AND status = 'active'
    `, [accountId]);

    const aiTotal = await db.query(`
      SELECT COALESCE(SUM(remaining_credits), 0) as total
      FROM credit_packages
      WHERE account_id = $1 AND credit_type IN ('ai', 'ai_monthly') AND status = 'active'
    `, [accountId]);

    console.log('\nTotal disponível:');
    console.log('- Google Maps:', gmapsTotal.rows[0].total);
    console.log('- IA:', aiTotal.rows[0].total);

    console.log('\n✅ Créditos de trial corrigidos!');
    process.exit(0);
  } catch (err) {
    console.error('Erro:', err.message);
    process.exit(1);
  }
}

fixTrialCredits();
