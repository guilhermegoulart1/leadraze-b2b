const dsn = 'api3.unipile.com:13332';
const token = 't3OuwvKV.vX8ejIpZxp5LAeYDDH2FmxYer5ind7/h8Tqev/Xwl9E=';
const accountId = 'seiTJuv3TqK5_GhjJgVZlw';
const providerId = 'ACoAABlSwsQBSS9qx1bxMMujZNrgfE7dCmZLGMo'; // Felipe La Falce

console.log('='.repeat(80));
console.log('TESTE DE BUSCA DE PERFIL COMPLETO - UNIPILE API');
console.log('='.repeat(80));
console.log('\nConfiguracao:');
console.log(`- DSN: ${dsn}`);
console.log(`- Account ID: ${accountId}`);
console.log(`- Provider ID: ${providerId}`);
console.log(`\nFazendo request para: https://${dsn}/api/v1/users/${providerId}`);
console.log('='.repeat(80));

const url = `https://${dsn}/api/v1/users/${providerId}?account_id=${accountId}`;

fetch(url, {
  headers: {
    'X-API-KEY': token
  }
})
.then(response => {
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
})
.then(data => {
  console.log('\n✓ RESPOSTA RECEBIDA COM SUCESSO\n');
  console.log('='.repeat(80));
  console.log('JSON COMPLETO DA RESPOSTA:');
  console.log('='.repeat(80));
  console.log(JSON.stringify(data, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('ANALISE DA ESTRUTURA:');
  console.log('='.repeat(80));

  // Lista todos os campos de primeiro nivel
  console.log('\nCAMPOS DE PRIMEIRO NIVEL:');
  Object.keys(data).forEach(key => {
    const value = data[key];
    const type = Array.isArray(value) ? 'Array' : typeof value;
    const preview = Array.isArray(value)
      ? `[${value.length} items]`
      : type === 'object' && value !== null
        ? '{object}'
        : JSON.stringify(value);
    console.log(`  - ${key}: ${type} = ${preview}`);
  });

  // Analisa campos aninhados importantes
  console.log('\nCAMPOS DE CONTATO:');
  if (data.email) console.log(`  - email: ${data.email}`);
  if (data.emails) console.log(`  - emails: ${JSON.stringify(data.emails)}`);
  if (data.phone) console.log(`  - phone: ${data.phone}`);
  if (data.phone_numbers) console.log(`  - phone_numbers: ${JSON.stringify(data.phone_numbers)}`);
  if (data.contact_info) console.log(`  - contact_info: ${JSON.stringify(data.contact_info, null, 2)}`);

  console.log('\nEXPERIENCIA PROFISSIONAL:');
  if (data.experience && Array.isArray(data.experience)) {
    console.log(`  Total de experiencias: ${data.experience.length}`);
    if (data.experience.length > 0) {
      console.log('  Exemplo da primeira experiencia:');
      console.log(JSON.stringify(data.experience[0], null, 4));
    }
  }

  console.log('\nEDUCACAO:');
  if (data.education && Array.isArray(data.education)) {
    console.log(`  Total de educacoes: ${data.education.length}`);
    if (data.education.length > 0) {
      console.log('  Exemplo da primeira educacao:');
      console.log(JSON.stringify(data.education[0], null, 4));
    }
  }

  console.log('\nSKILLS/COMPETENCIAS:');
  if (data.skills && Array.isArray(data.skills)) {
    console.log(`  Total de skills: ${data.skills.length}`);
    console.log(`  Skills: ${data.skills.slice(0, 10).join(', ')}${data.skills.length > 10 ? '...' : ''}`);
  }

  console.log('\nINFORMACOES DA EMPRESA ATUAL:');
  if (data.company) console.log(`  - company: ${data.company}`);
  if (data.company_name) console.log(`  - company_name: ${data.company_name}`);
  if (data.current_company) console.log(`  - current_company: ${JSON.stringify(data.current_company)}`);
  if (data.headline) console.log(`  - headline: ${data.headline}`);
  if (data.position) console.log(`  - position: ${data.position}`);

  console.log('\nLOCALIZACAO:');
  if (data.location) console.log(`  - location: ${data.location}`);
  if (data.city) console.log(`  - city: ${data.city}`);
  if (data.country) console.log(`  - country: ${data.country}`);
  if (data.region) console.log(`  - region: ${data.region}`);

  console.log('\nOUTROS CAMPOS IMPORTANTES:');
  if (data.summary) console.log(`  - summary: ${data.summary.substring(0, 100)}...`);
  if (data.about) console.log(`  - about: ${data.about.substring(0, 100)}...`);
  if (data.profile_url) console.log(`  - profile_url: ${data.profile_url}`);
  if (data.profile_picture) console.log(`  - profile_picture: ${data.profile_picture}`);

  console.log('\n' + '='.repeat(80));
})
.catch(error => {
  console.error('\n✗ ERRO NA REQUISICAO\n');
  console.error('Message:', error.message);
  console.error('Error:', error);
});
