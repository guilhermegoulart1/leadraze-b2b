// Script para testar busca de perfil completo via Unipile API
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const axios = require('axios');

async function testFullProfile() {
  try {
    const dsn = process.env.UNIPILE_DSN || 'api3.unipile.com:13332';
    const token = process.env.UNIPILE_ACCESS_TOKEN || process.env.UNIPILE_API_KEY;
    const accountId = 'seiTJuv3TqK5_GhjJgVZlw';

    console.log('🔍 Debug - DSN:', dsn);
    console.log('🔍 Debug - Token (first 15):', token?.substring(0, 15));

    // Provider ID de um dos perfis coletados (Felipe La Falce)
    const providerId = 'ACoAABlSwsQBSS9qx1bxMMujZNrgfE7dCmZLGMo';

    console.log('\n🔍 === TESTANDO BUSCA DE PERFIL COMPLETO ===\n');
    console.log(`📍 Endpoint: https://${dsn}/api/v1/users/${providerId}`);
    console.log(`🔐 Account ID: ${accountId}`);
    console.log(`👤 Provider ID: ${providerId}\n`);

    const response = await axios.get(
      `https://${dsn}/api/v1/users/${providerId}`,
      {
        headers: {
          'X-API-KEY': token,
          'Accept': 'application/json'
        },
        params: {
          account_id: accountId
        }
      }
    );

    console.log('✅ Status:', response.status);
    console.log('\n📊 === CAMPOS DISPONÍVEIS ===');
    console.log(Object.keys(response.data));

    console.log('\n📋 === DADOS COMPLETOS DO PERFIL ===\n');
    console.log(JSON.stringify(response.data, null, 2));

    // Análise estruturada
    console.log('\n\n📊 === ANÁLISE ESTRUTURADA ===\n');

    const profile = response.data;

    console.log('👤 Informações Básicas:');
    console.log('  - Nome:', profile.name || profile.full_name);
    console.log('  - Título:', profile.title || profile.headline);
    console.log('  - Localização:', profile.location || profile.geo_location);
    console.log('  - Foto:', profile.profile_picture || profile.profile_picture_url ? 'Sim' : 'Não');

    console.log('\n🏢 Informações Profissionais:');
    console.log('  - Empresa atual:', profile.company || profile.current_company || 'N/A');
    console.log('  - Indústria:', profile.industry || 'N/A');
    console.log('  - Experience (array):', Array.isArray(profile.experience) ? `${profile.experience.length} cargos` : 'N/A');
    console.log('  - Positions (array):', Array.isArray(profile.positions) ? `${profile.positions.length} posições` : 'N/A');

    console.log('\n📧 Informações de Contato:');
    console.log('  - Email:', profile.email || profile.email_address || 'N/A');
    console.log('  - Telefone:', profile.phone || profile.phone_number || 'N/A');
    console.log('  - Website:', profile.website || profile.websites?.[0] || 'N/A');

    console.log('\n🎓 Educação:');
    console.log('  - Education (array):', Array.isArray(profile.education) ? `${profile.education.length} instituições` : 'N/A');

    console.log('\n💡 Habilidades e Outros:');
    console.log('  - Skills (array):', Array.isArray(profile.skills) ? `${profile.skills.length} skills` : 'N/A');
    console.log('  - Languages (array):', Array.isArray(profile.languages) ? `${profile.languages.length} idiomas` : 'N/A');
    console.log('  - Certifications (array):', Array.isArray(profile.certifications) ? `${profile.certifications.length} certificações` : 'N/A');
    console.log('  - About/Summary:', profile.about || profile.summary ? 'Sim' : 'Não');
    console.log('  - Connections:', profile.connections || profile.connections_count || 'N/A');

    // Mostrar primeiro item de cada array se existir
    if (profile.experience && profile.experience.length > 0) {
      console.log('\n📌 Exemplo de Experience:');
      console.log(JSON.stringify(profile.experience[0], null, 2));
    }

    if (profile.education && profile.education.length > 0) {
      console.log('\n📌 Exemplo de Education:');
      console.log(JSON.stringify(profile.education[0], null, 2));
    }

    if (profile.skills && profile.skills.length > 0) {
      console.log('\n📌 Exemplo de Skills (primeiros 5):');
      console.log(profile.skills.slice(0, 5));
    }

    console.log('\n✅ Teste concluído!\n');
    process.exit(0);

  } catch (error) {
    console.error('❌ Erro:', error.response?.data || error.message);
    if (error.response?.status === 404) {
      console.log('\n⚠️ Perfil não encontrado. Pode ser que o provider_id esteja incorreto ou o perfil não seja acessível.');
    }
    process.exit(1);
  }
}

testFullProfile();
