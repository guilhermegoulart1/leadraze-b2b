// backend/src/controllers/openaiController.js
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError } = require('../utils/errors');
const db = require('../config/database');
const unipileClient = require('../config/unipile');

const generateSearchFilters = async (req, res) => {
  try {
    const { description } = req.body;

    if (!description || description.trim().length < 10) {
      throw new ValidationError('Descrição muito curta. Descreva melhor o perfil desejado.');
    }

    console.log('🤖 Gerando filtros com OpenAI...');

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `Você é um especialista em prospecção B2B no LinkedIn, focado em identificar DECISORES e COMPRADORES em potencial.

DESCRIÇÃO DO PERFIL IDEAL:
"${description}"

⚠️ IMPORTANTE - ADAPTAÇÃO DE IDIOMA:
- Se a localização mencionada for de um país de língua ESPANHOLA (ex: Paraguay, Argentina, México, Espanha, etc.), gere TODOS os filtros em ESPANHOL
- Se for de língua INGLESA (ex: USA, UK, Canada), gere em INGLÊS
- Se for PORTUGAL, use português de Portugal
- Caso contrário, use português brasileiro
- Adapte keywords, industries e job_titles ao idioma e contexto cultural do país

Gere filtros de busca otimizados para LinkedIn Classic (gratuito) no formato JSON.

FILTROS DISPONÍVEIS:
{
  "keywords": "string única com termos-chave relacionados ao negócio/dor/solução",
  "industries": ["Indústria 1", "Indústria 2"],
  "job_titles": ["Cargo 1", "Cargo 2", "Cargo 3"],
  "companies": []
}

IMPORTANTE: NÃO inclua o campo "location" no JSON. A localização será selecionada pelo usuário separadamente.

REGRAS CRÍTICAS PARA PROSPECÇÃO B2B:

1. KEYWORDS (obrigatório):
   - Foque em termos de negócio, dores, soluções, áreas de atuação
   - Evite termos genéricos como "profissional", "executivo"
   - Ex: "transformação digital", "vendas B2B", "gestão de equipes"
   - Use palavras-chave que realmente descrevem o perfil profissional ou negócio

2. INDUSTRIES (altamente recomendado):
   - Liste 2-4 indústrias/setores relevantes
   - Use nomes no IDIOMA APROPRIADO ao país da localização
   - Seja específico: "Tecnologia da Informação", "Saúde", "Serviços Financeiros" (PT) ou "Salud", "Servicios Médicos" (ES)
   - Evite setores genéricos demais

3. JOB_TITLES (CRÍTICO - gere no MÁXIMO 10 títulos):

   ⚠️ LIMITE OBRIGATÓRIO: Máximo 10 job_titles. NÃO exceda este limite.

   ⚠️ DETECÇÃO DE PROFISSÕES ESPECÍFICAS:
   - SE o usuário mencionar PROFISSÃO específica (médico, advogado, engenheiro, dentista, arquiteto, veterinário, etc.):
     * Inclua a PROFISSÃO em 4-5 variações principais
     * Adicione 4-5 cargos de LIDERANÇA na área

   - SE o usuário mencionar DONOS/PROPRIETÁRIOS de negócio:
     * Inclua: CEO, Fundador, Sócio, Proprietário, Diretor, Owner, Founder
     * Adicione 2-3 cargos de liderança da área

   - SE NÃO mencionar profissão específica (busca B2B genérica):
     * Foque 100% em DECISORES: CEO, CFO, CTO, VP, Diretores, Gerentes Seniores
     * Combine termos internacionais (CEO, CFO) com traduções locais

   - SEMPRE adapte ao IDIOMA do país
   - EVITE: júnior, assistente, analista, estagiário, trainee (exceto se explicitamente solicitado)

4. KEYWORDS (limite de tamanho):
   - String curta com no MÁXIMO 100 caracteres
   - Use 3-5 termos separados por vírgula
   - Foque nos termos mais relevantes e específicos

5. COMPANIES (raramente usar):
   - Deixe VAZIO [] a menos que empresas específicas sejam explicitamente mencionadas
   - Se incluir, use nomes exatos

ESTRATÉGIA DE DECISORES B2B:
- Pense em QUEM COMPRA, não apenas quem usa
- Inclua diferentes níveis: C-Level (CEO, CFO, CTO) → Diretores → Gerentes Senior
- Para produtos técnicos: inclua tanto decisores técnicos (CTO, Diretor de TI) quanto de negócio (CEO, CFO)
- Para serviços: inclua decisores operacionais (COO, Diretor de Operações) e financeiros (CFO)

EXEMPLO DE BOM OUTPUT (para Brasil/PT):
{
  "keywords": "transformação digital, inovação tecnológica",
  "industries": ["Tecnologia da Informação", "Serviços Financeiros"],
  "job_titles": [
    "CEO", "Chief Executive Officer", "Presidente",
    "CTO", "Diretor de Tecnologia",
    "Diretor de Inovação", "VP de Tecnologia",
    "Gerente de TI", "Head de Tecnologia"
  ],
  "companies": []
}

EXEMPLO PARA PAÍS HISPANO (ex: Paraguay/ES):
{
  "keywords": "transformación digital, innovación tecnológica",
  "industries": ["Tecnología de la Información", "Servicios Financieros"],
  "job_titles": [
    "CEO", "Chief Executive Officer", "Presidente",
    "CTO", "Director de Tecnología",
    "Director de Innovación", "VP de Tecnología",
    "Gerente de TI", "Head de Tecnología"
  ],
  "companies": []
}

EXEMPLO PARA PROFISSÃO ESPECÍFICA (médicos no Paraguay/ES):
{
  "keywords": "salud, medicina, atención médica",
  "industries": ["Salud", "Servicios Médicos", "Hospitales"],
  "job_titles": [
    "Médico", "Doctor", "Médica",
    "Médico General", "Médico Especialista",
    "Médico Cirujano", "Médico Clínico",
    "Director Médico", "Jefe de Medicina", "Gerente de Salud"
  ],
  "companies": []
}

Retorne APENAS o JSON válido, sem explicações ou comentários:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    let filters = JSON.parse(completion.choices[0].message.content);

    // ⚠️ FORÇAR REMOÇÃO DE LOCATION - usuário seleciona via autocomplete
    if (filters.location) {
      console.warn('⚠️ OpenAI retornou location mesmo sendo instruído a não fazer isso. Removendo...');
      delete filters.location;
    }

    // Validação e normalização dos filtros
    if (!filters.keywords) filters.keywords = '';
    if (!Array.isArray(filters.industries)) filters.industries = [];
    if (!Array.isArray(filters.job_titles)) filters.job_titles = [];
    if (!Array.isArray(filters.companies)) filters.companies = [];

    // Garantir job_titles de decisores se não houver
    if (filters.job_titles.length === 0) {
      filters.job_titles = [
        'CEO', 'Diretor', 'Gerente',
        'Chief Executive Officer', 'VP', 'Head'
      ];
      console.warn('⚠️ IA não gerou job_titles, usando decisores genéricos');
    }

    // Limitar arrays para não sobrecarregar busca (LinkedIn rejeita payloads grandes)
    filters.industries = filters.industries.slice(0, 5);
    filters.job_titles = filters.job_titles.slice(0, 10);
    filters.companies = filters.companies.slice(0, 5);

    console.log('✅ Filtros gerados e validados:', filters);
    console.log(`📊 Estatísticas: ${filters.industries.length} industries, ${filters.job_titles.length} job titles`);

    sendSuccess(res, {
      filters,
      original_description: description,
      tokens_used: completion.usage.total_tokens,
      insights: {
        decisor_focus: filters.job_titles.some(title =>
          title.toLowerCase().includes('ceo') ||
          title.toLowerCase().includes('diretor') ||
          title.toLowerCase().includes('chief')
        ),
        industry_specificity: filters.industries.length > 0,
        job_title_variety: filters.job_titles.length,
        estimated_reach: filters.industries.length > 0 && filters.job_titles.length >= 5 ? 'Alto' : 'Médio'
      }
    }, 'Filtros gerados com sucesso');

  } catch (error) {
    console.error('❌ Erro ao gerar filtros:', error);
    if (error.message.includes('API key')) {
      sendError(res, new Error('OpenAI não configurada. Verifique a API key.'), 500);
    } else {
      sendError(res, error);
    }
  }
};

// ================================
// GERAR FILTROS A PARTIR DE ICP (LINGUAGEM NATURAL)
// ================================

const generateFiltersFromICP = async (req, res) => {
  try {
    const { description, location, linkedin_account_id } = req.body;
    const userId = req.user.id;

    if (!description || description.trim().length < 15) {
      throw new ValidationError('Descrição muito curta. Descreva melhor o público-alvo desejado (mínimo 15 caracteres).');
    }

    if (!linkedin_account_id) {
      throw new ValidationError('Selecione uma conta LinkedIn para realizar a busca.');
    }

    console.log('🤖 [ICP] Gerando filtros a partir de descrição ICP...');
    console.log('📝 Descrição:', description);
    console.log('📍 Localização:', location);

    const OpenAI = require('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const locationLabel = location?.label || location || '';

    const prompt = `Você é um especialista em prospecção B2B no LinkedIn, focado em identificar DECISORES e COMPRADORES em potencial.

O USUÁRIO DESCREVEU SEU PÚBLICO-ALVO (ICP) EM LINGUAGEM NATURAL:
"${description.trim()}"

LOCALIZAÇÃO SELECIONADA: "${locationLabel}"

⚠️ IMPORTANTE - ADAPTAÇÃO DE IDIOMA:
- Se a localização mencionada for de um país de língua ESPANHOLA (ex: Paraguay, Argentina, México, Espanha, etc.), gere TODOS os filtros em ESPANHOL
- Se for de língua INGLESA (ex: USA, UK, Canada), gere em INGLÊS
- Se for PORTUGAL, use português de Portugal
- Caso contrário, use português brasileiro
- Adapte keywords, industries e job_titles ao idioma e contexto cultural do país

Sua tarefa: Extrair parâmetros estruturados de busca LinkedIn a partir da descrição natural do ICP.

Gere filtros de busca otimizados para LinkedIn Classic (gratuito) no formato JSON:

{
  "keywords": "string única com termos-chave relacionados ao negócio/dor/solução",
  "industries": ["Indústria 1", "Indústria 2"],
  "job_titles": ["Cargo 1", "Cargo 2", "Cargo 3"],
  "companies": [],
  "reasoning": "Uma frase curta explicando como você interpretou a descrição do público-alvo"
}

IMPORTANTE: NÃO inclua o campo "location" no JSON. A localização já foi selecionada pelo usuário.

REGRAS CRÍTICAS PARA PROSPECÇÃO B2B:

1. KEYWORDS (obrigatório):
   - Foque em termos de negócio, dores, soluções, áreas de atuação
   - Evite termos genéricos como "profissional", "executivo"
   - Use palavras-chave que realmente descrevem o perfil profissional ou negócio

2. INDUSTRIES (altamente recomendado):
   - Liste 2-5 indústrias/setores relevantes
   - Use nomes no IDIOMA APROPRIADO ao país da localização
   - Seja específico: "Tecnologia da Informação", "Saúde", "Serviços Financeiros" (PT) ou "Salud", "Servicios Médicos" (ES)

3. JOB_TITLES (CRÍTICO - gere no MÁXIMO 10 títulos):

   ⚠️ LIMITE OBRIGATÓRIO: Máximo 10 job_titles. NÃO exceda este limite.

   ⚠️ DETECÇÃO DE PROFISSÕES ESPECÍFICAS:
   - SE o usuário mencionar PROFISSÃO específica (médico, advogado, engenheiro, dentista, arquiteto, veterinário, etc.):
     * Inclua a PROFISSÃO em 4-5 variações principais
     * Adicione 4-5 cargos de LIDERANÇA na área

   - SE o usuário mencionar DONOS/PROPRIETÁRIOS de negócio específico (ex: "donos de agências"):
     * Inclua: CEO, Fundador, Sócio, Proprietário, Diretor, Owner, Founder
     * Adicione 2-3 cargos de liderança da área

   - SE NÃO mencionar profissão específica (busca B2B genérica):
     * Foque 100% em DECISORES: CEO, CFO, CTO, VP, Diretores, Gerentes Seniores
     * Combine termos internacionais (CEO, CFO) com traduções locais

   - SEMPRE adapte ao IDIOMA do país
   - EVITE: júnior, assistente, analista, estagiário, trainee (exceto se explicitamente solicitado)

4. KEYWORDS (limite de tamanho):
   - String curta com no MÁXIMO 100 caracteres
   - Use 3-5 termos separados por vírgula
   - Foque nos termos mais relevantes e específicos

5. COMPANIES (raramente usar):
   - Deixe VAZIO [] a menos que empresas específicas sejam explicitamente mencionadas
   - Se incluir, use nomes exatos

6. REASONING (obrigatório):
   - Explique em 1-2 frases como interpretou a descrição do público-alvo
   - Seja direto e claro. Ex: "Busca proprietários e decisores de agências de marketing digital"

ESTRATÉGIA DE DECISORES B2B:
- Pense em QUEM COMPRA, não apenas quem usa
- Inclua diferentes níveis: C-Level → Diretores → Gerentes Senior
- Considere múltiplas áreas que podem influenciar a decisão de compra

Retorne APENAS o JSON válido, sem explicações fora do JSON:`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      response_format: { type: 'json_object' }
    });

    let result = JSON.parse(completion.choices[0].message.content);

    // Extrair reasoning antes de limpar
    const reasoning = result.reasoning || 'Filtros gerados com base na descrição fornecida.';
    delete result.reasoning;

    // Forçar remoção de location
    if (result.location) {
      delete result.location;
    }

    // Validação e normalização dos filtros
    if (!result.keywords) result.keywords = '';
    if (!Array.isArray(result.industries)) result.industries = [];
    if (!Array.isArray(result.job_titles)) result.job_titles = [];
    if (!Array.isArray(result.companies)) result.companies = [];

    // Garantir job_titles de decisores se não houver
    if (result.job_titles.length === 0) {
      result.job_titles = [
        'CEO', 'Diretor', 'Gerente',
        'Chief Executive Officer', 'VP', 'Head'
      ];
      console.warn('⚠️ [ICP] IA não gerou job_titles, usando decisores genéricos');
    }

    // Limitar arrays (LinkedIn rejeita payloads grandes)
    result.industries = result.industries.slice(0, 5);
    result.job_titles = result.job_titles.slice(0, 10);
    result.companies = result.companies.slice(0, 5);

    console.log('✅ [ICP] Filtros gerados:', result);

    // ================================
    // VALIDAÇÃO CONTRA UNIPILE
    // ================================
    let validation = null;

    try {
      // Buscar conta LinkedIn para obter unipile_account_id
      const linkedinAccount = await db.query(
        'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2',
        [linkedin_account_id, userId]
      );

      if (linkedinAccount.rows.length > 0 && linkedinAccount.rows[0].unipile_account_id) {
        const unipileAccountId = linkedinAccount.rows[0].unipile_account_id;

        console.log('🔍 [ICP] Validando termos contra Unipile...');

        // Validar job_titles e industries em paralelo (com limite de concorrência)
        const validateTerm = async (term, type) => {
          try {
            const searchFn = type === 'jobTitles'
              ? unipileClient.searchParams.jobTitles
              : unipileClient.searchParams.industries;

            const response = await searchFn({
              account_id: unipileAccountId,
              keywords: term,
              limit: 3
            });

            const items = response.items || response.data || [];
            return { term, validated: items.length > 0 };
          } catch (err) {
            return { term, validated: false, error: true };
          }
        };

        // Executar validações com concorrência limitada (3 de cada vez)
        const validateBatch = async (terms, type) => {
          const results = [];
          for (let i = 0; i < terms.length; i += 3) {
            const batch = terms.slice(i, i + 3);
            const batchResults = await Promise.allSettled(
              batch.map(term => validateTerm(term, type))
            );
            results.push(...batchResults.map(r => r.status === 'fulfilled' ? r.value : { term: '', validated: false }));
          }
          return results;
        };

        // Timeout de 5 segundos para toda a validação
        const validationPromise = Promise.all([
          validateBatch(result.job_titles, 'jobTitles'),
          validateBatch(result.industries, 'industries')
        ]);

        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Validation timeout')), 5000)
        );

        try {
          const [jobTitleResults, industryResults] = await Promise.race([validationPromise, timeoutPromise]);

          validation = {
            job_titles_validated: jobTitleResults.filter(r => r.validated).length,
            job_titles_total: result.job_titles.length,
            industries_validated: industryResults.filter(r => r.validated).length,
            industries_total: result.industries.length,
            unvalidated_terms: [
              ...jobTitleResults.filter(r => !r.validated).map(r => r.term),
              ...industryResults.filter(r => !r.validated).map(r => r.term)
            ].filter(Boolean)
          };

          console.log('✅ [ICP] Validação concluída:', validation);
        } catch (timeoutErr) {
          console.warn('⚠️ [ICP] Validação timeout, prosseguindo sem validação');
          validation = null;
        }
      } else {
        console.warn('⚠️ [ICP] Conta LinkedIn sem unipile_account_id, pulando validação');
      }
    } catch (validationError) {
      console.warn('⚠️ [ICP] Erro na validação Unipile, prosseguindo sem validação:', validationError.message);
      validation = null;
    }

    sendSuccess(res, {
      filters: result,
      reasoning,
      validation,
      original_description: description.trim(),
      tokens_used: completion.usage.total_tokens,
      insights: {
        decisor_focus: result.job_titles.some(title =>
          title.toLowerCase().includes('ceo') ||
          title.toLowerCase().includes('diretor') ||
          title.toLowerCase().includes('chief') ||
          title.toLowerCase().includes('fundador') ||
          title.toLowerCase().includes('owner')
        ),
        industry_specificity: result.industries.length > 0,
        job_title_variety: result.job_titles.length,
        estimated_reach: result.industries.length > 0 && result.job_titles.length >= 5 ? 'Alto' : 'Médio'
      }
    }, 'Filtros ICP gerados com sucesso');

  } catch (error) {
    console.error('❌ [ICP] Erro ao gerar filtros:', error);
    if (error.message && error.message.includes('API key')) {
      sendError(res, new Error('OpenAI não configurada. Verifique a API key.'), 500);
    } else {
      sendError(res, error);
    }
  }
};

module.exports = {
  generateSearchFilters,
  generateFiltersFromICP
};
