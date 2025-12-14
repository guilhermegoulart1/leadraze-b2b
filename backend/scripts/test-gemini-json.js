/**
 * Test Gemini generateJson method - Full emailScraperService format
 */
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { geminiService } = require('../src/config/gemini');

async function test() {
  console.log('=== Testing Gemini generateJson (Full Format) ===\n');
  console.log('Gemini configured:', geminiService.isConfigured());

  try {
    // Exact format from emailScraperService
    const systemPrompt = `Voce e um especialista em inteligencia comercial B2B. Analise conteudo de sites de empresas e extraia informacoes uteis para prospeccao. Sempre responda em JSON valido.`;

    const userPrompt = `Analise o conteudo deste site e extraia TODAS as informacoes uteis para prospeccao B2B.

EMPRESA: Consultoria ABC
CATEGORIA: Marketing Digital

EXTRAIA COM MUITO CUIDADO:

1. EQUIPE/SOCIOS (team_members):
   - Nomes de fundadores, socios, diretores, gerentes
   - Seus cargos/funcoes
   - LinkedIn pessoal (se mencionado)
   - Email pessoal (se mencionado)

2. SOBRE A EMPRESA (company):
   - Descricao objetiva em 2-3 frases
   - Lista de principais servicos/produtos (maximo 5)
   - Diferenciais competitivos
   - Anos de mercado (se mencionado)
   - Numero de funcionarios (se mencionado)

3. OPORTUNIDADES DE VENDA (sales_opportunities):
   - Possiveis dores/problemas da empresa
   - Gaps tecnologicos identificados
   - Necessidades nao atendidas

Responda APENAS com JSON valido neste formato:
{
  "team_members": [{"name": "", "role": "", "email": "", "linkedin": ""}],
  "company": {
    "description": "",
    "services": [],
    "differentials": [],
    "years_in_market": null,
    "employee_count": null
  },
  "sales_opportunities": {
    "pain_points": [],
    "tech_gaps": [],
    "needs": []
  }
}

Se nao encontrar alguma informacao, use null ou array vazio.

CONTEUDO DO SITE:
Somos a Consultoria ABC, especializada em marketing digital para empresas B2B desde 2015. Nossa equipe de 25 profissionais atende clientes em todo o Brasil.

NOSSOS SERVIÇOS:
- SEO e Marketing de Conteúdo
- Gestão de Mídia Paga
- Automação de Marketing
- Consultoria Estratégica

NOSSA EQUIPE:
- João Silva (CEO e Fundador) - linkedin.com/in/joaosilva - joao@consultoriaabc.com.br
- Maria Santos (Diretora Comercial) - maria@consultoriaabc.com.br
- Carlos Oliveira (Gerente de Projetos)

DIFERENCIAIS:
- Metodologia própria de growth marketing
- Parceiros certificados Google e Meta
- Suporte dedicado 24/7

Fale conosco: contato@consultoriaabc.com.br / comercial@consultoriaabc.com.br
Telefone: (11) 3333-4444 / WhatsApp: (11) 99999-8888`;

    console.log('Calling geminiService.generateJson...');
    const parsed = await geminiService.generateJson(systemPrompt, userPrompt, {
      temperature: 0.3,
      maxTokens: 2000
    });

    console.log('\n✅ SUCCESS! Result:');
    console.log(JSON.stringify(parsed, null, 2));
  } catch (err) {
    console.log('\n❌ ERROR:', err.message);
    console.log(err.stack);
  }
}

test();
