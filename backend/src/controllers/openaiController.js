// backend/src/controllers/openaiController.js
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError } = require('../utils/errors');

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
   - Use nomes em PORTUGUÊS
   - Seja específico: "Tecnologia da Informação", "Saúde", "Serviços Financeiros"
   - Evite setores genéricos demais

3. JOB_TITLES (CRÍTICO - foque em decisores):
   - SEMPRE incluir 8-15 variações de cargos de DECISÃO
   - Foque em C-Level, VP, Diretores, Gerentes Seniores
   - Inclua variações: "CEO", "Chief Executive Officer", "Diretor Executivo"
   - Inclua por área: "Diretor Comercial", "VP de Vendas", "Gerente de Marketing"
   - EVITE: júnior, assistente, analista, estagiário, trainee
   - Priorize quem TEM ORÇAMENTO e PODER DE DECISÃO
   - Inclua variações em português E inglês (CEO, Chief Executive Officer, Presidente)

4. COMPANIES (raramente usar):
   - Deixe VAZIO [] a menos que empresas específicas sejam explicitamente mencionadas
   - Se incluir, use nomes exatos

ESTRATÉGIA DE DECISORES B2B:
- Pense em QUEM COMPRA, não apenas quem usa
- Inclua diferentes níveis: C-Level (CEO, CFO, CTO) → Diretores → Gerentes Senior → Gerentes
- Considere múltiplas áreas que podem influenciar: Comercial, Marketing, TI, Operações, Inovação
- Para produtos técnicos: inclua tanto decisores técnicos (CTO, Diretor de TI) quanto de negócio (CEO, CFO)
- Para serviços: inclua decisores operacionais (COO, Diretor de Operações) e financeiros (CFO)

EXEMPLO DE BOM OUTPUT:
{
  "keywords": "transformação digital, inovação tecnológica, digitalização",
  "industries": ["Tecnologia da Informação", "Serviços Financeiros"],
  "job_titles": [
    "CEO", "Chief Executive Officer", "Presidente",
    "CTO", "Chief Technology Officer", "Diretor de Tecnologia",
    "Diretor de Inovação", "VP de Tecnologia",
    "Gerente de TI", "Head de Tecnologia",
    "Diretor de Transformação Digital", "VP de Inovação"
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

    // Limitar arrays para não sobrecarregar busca
    filters.industries = filters.industries.slice(0, 5);
    filters.job_titles = filters.job_titles.slice(0, 15);
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

module.exports = {
  generateSearchFilters
};
