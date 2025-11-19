const dsn = 'api3.unipile.com:13332';
const token = 't3OuwvKV.vX8ejIpZxp5LAeYDDH2FmxYer5ind7/h8Tqev/Xwl9E=';
const accountId = 'seiTJuv3TqK5_GhjJgVZlw';
const providerId = 'ACoAABlSwsQBSS9qx1bxMMujZNrgfE7dCmZLGMo'; // Felipe La Falce

console.log('='.repeat(80));
console.log('TESTE DE PERFIL COMPLETO COM linkedin_sections=*');
console.log('='.repeat(80));

const url = `https://${dsn}/api/v1/users/${providerId}?account_id=${accountId}&linkedin_sections=*`;

console.log(`\nURL: ${url}`);
console.log('\nFazendo requisicao...\n');

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
  console.log('✓ RESPOSTA RECEBIDA COM SUCESSO\n');
  console.log('='.repeat(80));
  console.log('JSON COMPLETO DA RESPOSTA:');
  console.log('='.repeat(80));
  console.log(JSON.stringify(data, null, 2));

  console.log('\n' + '='.repeat(80));
  console.log('ANALISE DETALHADA DA ESTRUTURA:');
  console.log('='.repeat(80));

  // Lista todos os campos de primeiro nivel
  console.log('\n1. CAMPOS DE PRIMEIRO NIVEL:');
  Object.keys(data).forEach(key => {
    const value = data[key];
    const type = Array.isArray(value) ? 'Array' : typeof value;
    const preview = Array.isArray(value)
      ? `[${value.length} items]`
      : type === 'object' && value !== null
        ? '{object}'
        : JSON.stringify(value);
    console.log(`   - ${key}: ${type} = ${preview}`);
  });

  // Analisa campos aninhados importantes
  console.log('\n2. INFORMACOES BASICAS:');
  console.log(`   - Nome: ${data.first_name} ${data.last_name}`);
  console.log(`   - Headline: ${data.headline}`);
  console.log(`   - Location: ${data.location}`);
  console.log(`   - Public Identifier: ${data.public_identifier}`);
  console.log(`   - Provider ID: ${data.provider_id}`);

  console.log('\n3. CAMPOS DE CONTATO:');
  if (data.email) console.log(`   - email: ${data.email}`);
  if (data.emails) console.log(`   - emails: ${JSON.stringify(data.emails)}`);
  if (data.phone) console.log(`   - phone: ${data.phone}`);
  if (data.phone_numbers) console.log(`   - phone_numbers: ${JSON.stringify(data.phone_numbers)}`);
  if (data.contact_info) {
    console.log('   - contact_info:');
    console.log(JSON.stringify(data.contact_info, null, 6));
  }
  if (!data.email && !data.emails && !data.phone && !data.phone_numbers && !data.contact_info) {
    console.log('   (Nenhum campo de contato disponivel)');
  }

  console.log('\n4. EXPERIENCIA PROFISSIONAL:');
  if (data.experience && Array.isArray(data.experience)) {
    console.log(`   Total de experiencias: ${data.experience.length}`);
    data.experience.forEach((exp, idx) => {
      console.log(`\n   Experiencia ${idx + 1}:`);
      console.log(JSON.stringify(exp, null, 6));
    });
  } else if (data.positions) {
    console.log(`   Total de positions: ${data.positions.length}`);
    data.positions.forEach((pos, idx) => {
      console.log(`\n   Position ${idx + 1}:`);
      console.log(JSON.stringify(pos, null, 6));
    });
  } else {
    console.log('   (Nenhuma experiencia disponivel)');
  }

  console.log('\n5. EDUCACAO:');
  if (data.education && Array.isArray(data.education)) {
    console.log(`   Total de educacoes: ${data.education.length}`);
    data.education.forEach((edu, idx) => {
      console.log(`\n   Educacao ${idx + 1}:`);
      console.log(JSON.stringify(edu, null, 6));
    });
  } else if (data.schools) {
    console.log(`   Total de schools: ${data.schools.length}`);
    data.schools.forEach((sch, idx) => {
      console.log(`\n   School ${idx + 1}:`);
      console.log(JSON.stringify(sch, null, 6));
    });
  } else {
    console.log('   (Nenhuma educacao disponivel)');
  }

  console.log('\n6. SKILLS/COMPETENCIAS:');
  if (data.skills && Array.isArray(data.skills)) {
    console.log(`   Total de skills: ${data.skills.length}`);
    if (typeof data.skills[0] === 'string') {
      console.log(`   Skills: ${data.skills.slice(0, 20).join(', ')}${data.skills.length > 20 ? '...' : ''}`);
    } else {
      console.log('   Primeiras 5 skills:');
      data.skills.slice(0, 5).forEach((skill, idx) => {
        console.log(`      ${idx + 1}. ${JSON.stringify(skill)}`);
      });
    }
  } else {
    console.log('   (Nenhuma skill disponivel)');
  }

  console.log('\n7. SOBRE/RESUMO:');
  if (data.summary) {
    console.log(`   Summary (${data.summary.length} chars):`);
    console.log(`   ${data.summary.substring(0, 200)}...`);
  }
  if (data.about) {
    console.log(`   About (${data.about.length} chars):`);
    console.log(`   ${data.about.substring(0, 200)}...`);
  }
  if (!data.summary && !data.about) {
    console.log('   (Nenhum resumo disponivel)');
  }

  console.log('\n8. ESTATISTICAS:');
  if (data.follower_count) console.log(`   - Seguidores: ${data.follower_count}`);
  if (data.connections_count) console.log(`   - Conexoes: ${data.connections_count}`);
  if (data.shared_connections_count) console.log(`   - Conexoes em comum: ${data.shared_connections_count}`);

  console.log('\n9. FLAGS:');
  console.log(`   - is_open_profile: ${data.is_open_profile}`);
  console.log(`   - is_premium: ${data.is_premium}`);
  console.log(`   - is_influencer: ${data.is_influencer}`);
  console.log(`   - is_creator: ${data.is_creator}`);
  console.log(`   - network_distance: ${data.network_distance}`);

  console.log('\n10. OUTROS CAMPOS IMPORTANTES:');
  if (data.websites && data.websites.length > 0) {
    console.log(`   - websites: ${JSON.stringify(data.websites)}`);
  }
  if (data.profile_url) console.log(`   - profile_url: ${data.profile_url}`);
  if (data.linkedin_url) console.log(`   - linkedin_url: ${data.linkedin_url}`);
  if (data.profile_picture_url) console.log(`   - profile_picture_url: ${data.profile_picture_url}`);

  console.log('\n' + '='.repeat(80));
  console.log('FIM DO TESTE');
  console.log('='.repeat(80));
})
.catch(error => {
  console.error('\n✗ ERRO NA REQUISICAO\n');
  console.error('Message:', error.message);
  console.error('Error:', error);
});
