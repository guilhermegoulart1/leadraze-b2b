// Script to test invite send worker manually
require('dotenv').config();
const inviteSendWorker = require('../src/workers/inviteSendWorker');

async function test() {
  console.log('🧪 Testando processamento de convites agendados...\n');

  try {
    await inviteSendWorker.runOnce();
    console.log('\n✅ Teste concluído!');
  } catch (error) {
    console.error('\n❌ Erro no teste:', error.message);
    console.error(error);
  }

  // Give time for logs to finish
  setTimeout(() => {
    process.exit(0);
  }, 2000);
}

test();
