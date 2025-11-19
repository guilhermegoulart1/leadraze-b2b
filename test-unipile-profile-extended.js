const dsn = 'api3.unipile.com:13332';
const token = 't3OuwvKV.vX8ejIpZxp5LAeYDDH2FmxYer5ind7/h8Tqev/Xwl9E=';
const accountId = 'seiTJuv3TqK5_GhjJgVZlw';

// Vamos tentar diferentes provider_ids
const providerIds = [
  'ACoAABlSwsQBSS9qx1bxMMujZNrgfE7dCmZLGMo', // Felipe La Falce
];

async function testProfile(providerId) {
  console.log('='.repeat(80));
  console.log(`TESTANDO PERFIL: ${providerId}`);
  console.log('='.repeat(80));

  // Teste 1: Endpoint básico
  const url1 = `https://${dsn}/api/v1/users/${providerId}?account_id=${accountId}`;
  console.log(`\n[1] Endpoint basico: ${url1}`);

  try {
    const response1 = await fetch(url1, {
      headers: { 'X-API-KEY': token }
    });

    if (response1.ok) {
      const data1 = await response1.json();
      console.log('\n✓ RESPOSTA BASICA:');
      console.log(JSON.stringify(data1, null, 2));
    } else {
      console.log(`✗ Erro: ${response1.status} - ${response1.statusText}`);
    }
  } catch (error) {
    console.log(`✗ Erro: ${error.message}`);
  }

  // Teste 2: Com parâmetro expand
  const url2 = `https://${dsn}/api/v1/users/${providerId}?account_id=${accountId}&expand=true`;
  console.log(`\n[2] Com expand=true: ${url2}`);

  try {
    const response2 = await fetch(url2, {
      headers: { 'X-API-KEY': token }
    });

    if (response2.ok) {
      const data2 = await response2.json();
      console.log('\n✓ RESPOSTA COM EXPAND:');
      console.log(JSON.stringify(data2, null, 2));
    } else {
      console.log(`✗ Erro: ${response2.status} - ${response2.statusText}`);
    }
  } catch (error) {
    console.log(`✗ Erro: ${error.message}`);
  }

  // Teste 3: Com parâmetro full
  const url3 = `https://${dsn}/api/v1/users/${providerId}?account_id=${accountId}&full=true`;
  console.log(`\n[3] Com full=true: ${url3}`);

  try {
    const response3 = await fetch(url3, {
      headers: { 'X-API-KEY': token }
    });

    if (response3.ok) {
      const data3 = await response3.json();
      console.log('\n✓ RESPOSTA COM FULL:');
      console.log(JSON.stringify(data3, null, 2));
    } else {
      console.log(`✗ Erro: ${response3.status} - ${response3.statusText}`);
    }
  } catch (error) {
    console.log(`✗ Erro: ${error.message}`);
  }

  // Teste 4: Com parâmetro include
  const url4 = `https://${dsn}/api/v1/users/${providerId}?account_id=${accountId}&include=experience,education,skills,contact_info`;
  console.log(`\n[4] Com include: ${url4}`);

  try {
    const response4 = await fetch(url4, {
      headers: { 'X-API-KEY': token }
    });

    if (response4.ok) {
      const data4 = await response4.json();
      console.log('\n✓ RESPOSTA COM INCLUDE:');
      console.log(JSON.stringify(data4, null, 2));
    } else {
      console.log(`✗ Erro: ${response4.status} - ${response4.statusText}`);
    }
  } catch (error) {
    console.log(`✗ Erro: ${error.message}`);
  }

  console.log('\n' + '='.repeat(80) + '\n');
}

// Executar testes
(async () => {
  for (const providerId of providerIds) {
    await testProfile(providerId);
  }
})();
