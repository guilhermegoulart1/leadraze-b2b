// Script para resetar convites falhados e reprocessá-los
require('dotenv').config();
const db = require('../src/config/database');
const inviteSendWorker = require('../src/workers/inviteSendWorker');

async function retryFailed() {
  try {
    console.log('\n🔄 RESETANDO CONVITES FALHADOS');
    console.log('================================\n');

    // 1. Resetar convites failed para scheduled (com scheduled_for = NOW)
    const resetResult = await db.query(`
      UPDATE campaign_invite_queue
      SET status = 'scheduled', scheduled_for = NOW(), updated_at = NOW()
      WHERE status = 'failed'
      RETURNING id, lead_id
    `);

    console.log(`✅ ${resetResult.rowCount} convites resetados para 'scheduled'\n`);

    if (resetResult.rowCount === 0) {
      console.log('Nenhum convite falhado para reprocessar.');
      process.exit(0);
      return;
    }

    // 2. Também resetar o status do lead
    for (const row of resetResult.rows) {
      await db.query(
        `UPDATE leads SET status = 'invite_queued' WHERE id = $1`,
        [row.lead_id]
      );
    }
    console.log(`✅ Status dos leads resetados para 'invite_queued'\n`);

    // 3. Processar agora
    console.log('🚀 Processando convites agora...\n');
    await inviteSendWorker.runOnce();

    console.log('\n✅ Processamento concluído!');

    // Aguardar logs finalizarem
    setTimeout(() => process.exit(0), 2000);

  } catch (error) {
    console.error('❌ Erro:', error.message);
    console.error(error);
    process.exit(1);
  }
}

retryFailed();
