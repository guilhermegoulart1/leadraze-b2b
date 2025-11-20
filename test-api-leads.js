const axios = require('axios');

async function testLeadsAPI() {
  try {
    // Login para obter o token
    console.log('🔐 Fazendo login...');
    const loginResponse = await axios.post('http://localhost:3001/api/auth/login', {
      email: 'caiocaprio@gmail.com',
      password: '12345'
    });

    const token = loginResponse.data.data.token;
    console.log('✅ Login bem-sucedido!');

    // Buscar leads
    console.log('\n📋 Buscando leads...');
    const leadsResponse = await axios.get('http://localhost:3001/api/leads', {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    const leads = leadsResponse.data.data.leads;
    const pagination = leadsResponse.data.data.pagination;

    console.log(`\n📊 RESULTADOS:`);
    console.log(`   Total de leads retornados: ${leads.length}`);
    console.log(`   Total no banco (pagination.total): ${pagination.total}`);
    console.log(`   Página: ${pagination.page}`);
    console.log(`   Limite: ${pagination.limit}`);
    console.log(`   Total de páginas: ${pagination.pages}`);

    // Distribuição por status
    const statusCount = {};
    leads.forEach(lead => {
      statusCount[lead.status] = (statusCount[lead.status] || 0) + 1;
    });

    console.log(`\n📊 Distribuição por status (dos leads retornados):`);
    Object.entries(statusCount).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    // Verificar se todos os leads foram retornados
    if (leads.length === pagination.total) {
      console.log(`\n✅ SUCESSO! Todos os ${leads.length} leads estão sendo retornados!`);
    } else {
      console.log(`\n⚠️  ATENÇÃO: Apenas ${leads.length} de ${pagination.total} leads foram retornados`);
    }

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
  }
}

testLeadsAPI();
