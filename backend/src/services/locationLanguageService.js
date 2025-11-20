// backend/src/services/locationLanguageService.js
const OpenAI = require('openai');
const axios = require('axios');

// ================================
// MAPEAMENTO DE FALLBACK - Principais países da América Latina
// ================================
// Este mapeamento é usado caso a API da Unipile não retorne informações
const LOCATION_COUNTRY_FALLBACK = {
  // Paraguai
  '104065273': 'Paraguay',

  // Argentina
  '103323778': 'Argentina',
  '100876793': 'Argentina', // Buenos Aires

  // Chile
  '104621616': 'Chile',
  '104673765': 'Chile', // Santiago

  // México
  '90000084': 'Mexico',
  '103323778': 'Mexico', // Ciudad de México

  // Colômbia
  '100876405': 'Colombia',
  '102634375': 'Colombia', // Bogotá

  // Peru
  '103883259': 'Peru',
  '102927786': 'Peru', // Lima

  // Uruguai
  '103279115': 'Uruguay',
  '100370062': 'Uruguay', // Montevideo

  // Bolívia
  '90000088': 'Bolivia',

  // Equador
  '90009674': 'Ecuador',

  // Venezuela
  '100867946': 'Venezuela',

  // Estados Unidos
  '103644278': 'United States',

  // Espanha
  '105646813': 'Spain',

  // Portugal
  '105015875': 'Portugal',

  // Brasil - principais cidades
  '90000056': 'Brazil',
  '90009725': 'Brazil', // São Paulo
  '90009731': 'Brazil', // Rio de Janeiro
  '90009713': 'Brazil', // Belo Horizonte
};

// ================================
// BUSCAR INFORMAÇÕES DO PAÍS VIA LOCATION ID
// ================================
async function getCountryFromLocationId(locationId, unipileAccountId) {
  try {
    const dsn = process.env.UNIPILE_DSN;
    const token = process.env.UNIPILE_API_KEY || process.env.UNIPILE_ACCESS_TOKEN;

    console.log(`🔍 Tentando identificar país do location ID: ${locationId}`);

    // ESTRATÉGIA 1: Tentar buscar na API Unipile
    try {
      const url = `https://${dsn}/api/v1/linkedin/search/parameters`;

      const response = await axios.get(url, {
        headers: {
          'X-API-KEY': token,
          'Accept': 'application/json'
        },
        params: {
          account_id: unipileAccountId,
          type: 'LOCATION',
          id: locationId
        },
        timeout: 10000
      });

      const locations = response.data?.items || response.data?.data || [];

      if (locations.length > 0) {
        const location = locations[0];
        const locationName = location.name || location.title || location.label || '';

        console.log(`✅ [API] Location encontrada: ${locationName} (ID: ${locationId})`);

        // Extrair país do nome da localização
        // Exemplo: "Asunción, Paraguay" -> "Paraguay"
        // Exemplo: "São Paulo, Brazil" -> "Brazil"
        const parts = locationName.split(',');
        const country = parts.length > 1 ? parts[parts.length - 1].trim() : locationName;

        return {
          locationId,
          locationName,
          country,
          source: 'api'
        };
      }
    } catch (apiError) {
      console.log(`⚠️ API Unipile não retornou dados para o location ID, tentando fallback...`);
    }

    // ESTRATÉGIA 2: Usar mapeamento de fallback
    if (LOCATION_COUNTRY_FALLBACK[locationId]) {
      const country = LOCATION_COUNTRY_FALLBACK[locationId];
      console.log(`✅ [Fallback] Location ID ${locationId} mapeado para: ${country}`);

      return {
        locationId,
        locationName: country,
        country,
        source: 'fallback'
      };
    }

    // ESTRATÉGIA 3: Assumir Brasil como padrão
    console.warn(`⚠️ Location ID ${locationId} desconhecido, assumindo Brasil como padrão`);
    return {
      locationId,
      locationName: 'Brazil',
      country: 'Brazil',
      source: 'default'
    };

  } catch (error) {
    console.error(`❌ Erro ao buscar location ID ${locationId}:`, error.message);

    // Em caso de erro, retornar Brasil como padrão
    return {
      locationId,
      locationName: 'Brazil',
      country: 'Brazil',
      source: 'error_fallback'
    };
  }
}

// ================================
// TRADUZIR TERMOS DE BUSCA USANDO IA
// ================================
async function translateSearchTerms(searchFilters, country) {
  try {
    // Se não tiver país ou for Brasil, não traduz
    if (!country || country === 'Brazil' || country === 'Brasil') {
      console.log('✅ País é Brasil, não precisa traduzir termos');
      return searchFilters;
    }

    console.log(`🌐 Traduzindo termos de busca para o país: ${country}...`);

    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    // Preparar dados para tradução
    const termsToTranslate = {
      keywords: searchFilters.keywords || '',
      industries: searchFilters.industries || [],
      job_titles: searchFilters.job_titles || []
    };

    const prompt = `Você é um tradutor especializado em termos profissionais de LinkedIn.

TAREFA: Traduzir termos de busca do LinkedIn de PORTUGUÊS para a língua oficial do país: ${country}

IMPORTANTE:
- Identifique automaticamente a língua oficial do país ${country}
- Use terminologia profissional adequada para ${country}
- Mantenha siglas internacionais como estão (CEO, CFO, VP, etc.)
- Traduza apenas palavras que precisam ser traduzidas
- Se o país for de língua portuguesa, retorne os termos como estão

TERMOS EM PORTUGUÊS:
${JSON.stringify(termsToTranslate, null, 2)}

Retorne APENAS um JSON válido (sem markdown, sem explicações):
{
  "keywords": "termo1, termo2, termo3",
  "industries": ["Indústria 1", "Indústria 2"],
  "job_titles": ["Cargo 1", "Cargo 2"]
}`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: 'Você é um tradutor especializado em termos profissionais. Retorne sempre JSON válido sem markdown.'
        },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3,
      max_tokens: 1500
    });

    const translatedText = response.choices[0].message.content.trim();

    // Remover possível markdown
    const jsonText = translatedText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

    const translated = JSON.parse(jsonText);

    console.log(`✅ Tradução para ${country} concluída:`);
    console.log('  📝 Keywords:', translated.keywords);
    console.log('  🏭 Industries:', translated.industries);
    console.log('  💼 Job Titles (primeiros 3):', translated.job_titles?.slice(0, 3), '...');

    // Retornar filtros traduzidos
    return {
      ...searchFilters,
      keywords: translated.keywords,
      industries: translated.industries,
      job_titles: translated.job_titles
    };

  } catch (error) {
    console.error('❌ Erro ao traduzir termos:', error.message);

    // Em caso de erro, retornar os filtros originais
    console.log('⚠️ Usando termos originais devido ao erro na tradução');
    return searchFilters;
  }
}

module.exports = {
  getCountryFromLocationId,
  translateSearchTerms
};
