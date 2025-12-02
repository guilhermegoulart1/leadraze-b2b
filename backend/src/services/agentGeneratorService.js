/**
 * Agent Generator Service
 *
 * Uses OpenAI (gpt-4o-mini) to generate complete agent configurations
 * from simple user descriptions.
 */

const OpenAI = require('openai');

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Generate complete agent configuration from user description
 * @param {string} description - User's natural language description
 * @param {string} agentType - Type of agent (linkedin, email, whatsapp)
 * @param {string} language - Language for the generated content (pt, en, es)
 * @returns {Promise<Object>} Generated agent configuration
 */
async function generateAgentConfig(description, agentType = 'linkedin', language = 'pt') {
  try {
    const systemPrompt = buildSystemPrompt(agentType, language);
    const userPrompt = buildUserPrompt(description, agentType);

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000
    });

    const generatedConfig = JSON.parse(response.choices[0].message.content);

    // Ensure all required fields are present
    const validatedConfig = validateAndCompleteConfig(generatedConfig, agentType);

    console.log(`[AgentGenerator] Generated config for ${agentType} agent`);

    return {
      success: true,
      config: validatedConfig,
      tokens_used: response.usage?.total_tokens || 0
    };
  } catch (error) {
    console.error('[AgentGenerator] Error generating config:', error);
    throw error;
  }
}

/**
 * Build the system prompt for agent generation
 */
function buildSystemPrompt(agentType, language) {
  const languageInstructions = {
    pt: 'Gere todo o conteudo em portugues brasileiro.',
    en: 'Generate all content in English.',
    es: 'Genera todo el contenido en espanol.'
  };

  return `Voce e um especialista em criar agentes de IA para vendas B2B.
Sua tarefa e gerar uma configuracao completa para um agente de ${agentType} baseado na descricao do usuario.

${languageInstructions[language] || languageInstructions.pt}

Voce DEVE retornar um JSON valido com EXATAMENTE esta estrutura:

{
  "name": "Nome sugestivo para o agente (max 50 caracteres)",
  "description": "Descricao curta do agente (max 200 caracteres)",
  "system_prompt": "Prompt completo e detalhado do sistema (300-500 palavras) que define como o agente deve se comportar, incluindo: identidade, tom de voz, objetivo, regras de comportamento, limitacoes, e exemplos de como responder",
  "behavioral_profile": {
    "formality": 70,
    "friendliness": 60,
    "assertiveness": 50,
    "professionalism": 80
  },
  "tone": "formal|casual|professional|friendly",
  "personality": "Descricao da personalidade em 2-3 frases",
  "initial_message": "Mensagem de abertura personalizada para iniciar conversa com leads",
  "products_services": "Descricao dos produtos/servicos que o agente representa",
  "objective": "schedule_meeting|qualify_lead|generate_interest|get_contact|start_conversation|direct_sale",
  "objective_instructions": "Instrucoes especificas de como atingir o objetivo",
  "escalation_keywords": "palavras,chave,para,escalar,separadas,por,virgula",
  "response_length": "short|medium|long",
  "conversation_steps": [
    {
      "step": 1,
      "name": "Nome da etapa",
      "description": "O que fazer nesta etapa",
      "example_questions": ["Pergunta exemplo 1", "Pergunta exemplo 2"]
    }
  ]
}

REGRAS IMPORTANTES:
1. O system_prompt deve ser completo e profissional, com pelo menos 300 palavras
2. Extraia produtos/servicos da descricao do usuario
3. O behavioral_profile deve ter valores de 0-100 para cada caracteristica:
   - formality: formalidade (0=casual, 100=muito formal)
   - friendliness: amigabilidade (0=distante, 100=muito amigavel)
   - assertiveness: assertividade (0=passivo, 100=muito assertivo)
   - professionalism: profissionalismo (0=informal, 100=muito profissional)
4. A initial_message deve ser natural e nao robótica
5. Inclua 3-5 etapas de conversa logicas
6. As escalation_keywords devem ser relevantes ao contexto
7. SEMPRE retorne JSON valido
8. NUNCA use formatacao markdown - links devem ser texto simples (ex: www.site.com), NUNCA [texto](url)
9. O agente sera usado em LinkedIn/WhatsApp que nao suportam markdown`;
}

/**
 * Build the user prompt with the description
 */
function buildUserPrompt(description, agentType) {
  return `Crie uma configuracao completa para um agente de ${agentType} baseado nesta descricao:

"${description}"

Analise cuidadosamente a descricao e extraia:
- O que o agente vende/oferece
- O tom desejado (se mencionado)
- O objetivo principal
- Qualquer instrucao especifica

Se alguma informacao estiver faltando, use seu conhecimento para completar de forma coerente.

Retorne APENAS o JSON, sem explicacoes adicionais.`;
}

/**
 * Validate and complete the generated configuration
 */
function validateAndCompleteConfig(config, agentType) {
  // Default values
  const defaults = {
    name: 'Agente de Vendas',
    description: 'Agente de vendas automatizado',
    system_prompt: '',
    behavioral_profile: {
      formality: 60,
      friendliness: 70,
      assertiveness: 50,
      professionalism: 75
    },
    tone: 'professional',
    personality: 'Profissional, atencioso e focado em resultados.',
    initial_message: 'Ola! Tudo bem? Vi que trabalha com essa area e achei que poderiamos conversar.',
    products_services: '',
    objective: 'qualify_lead',
    objective_instructions: 'Entender as necessidades do lead e qualifica-lo.',
    escalation_keywords: 'preco,orcamento,concorrente,reclamacao',
    response_length: 'medium',
    conversation_steps: [
      { step: 1, name: 'Abertura', description: 'Apresentacao inicial', example_questions: [] },
      { step: 2, name: 'Descoberta', description: 'Entender necessidades', example_questions: [] },
      { step: 3, name: 'Proposta', description: 'Apresentar solucao', example_questions: [] }
    ]
  };

  // Merge with defaults
  const validated = { ...defaults, ...config };

  // Validate behavioral_profile - must be an object with numeric values
  if (!validated.behavioral_profile || typeof validated.behavioral_profile !== 'object') {
    validated.behavioral_profile = defaults.behavioral_profile;
  } else {
    // Ensure all fields exist and are valid numbers 0-100
    const profileFields = ['formality', 'friendliness', 'assertiveness', 'professionalism'];
    for (const field of profileFields) {
      if (typeof validated.behavioral_profile[field] !== 'number' ||
          validated.behavioral_profile[field] < 0 ||
          validated.behavioral_profile[field] > 100) {
        validated.behavioral_profile[field] = defaults.behavioral_profile[field];
      }
    }
  }

  // Validate tone
  const validTones = ['formal', 'casual', 'professional', 'friendly'];
  if (!validTones.includes(validated.tone)) {
    validated.tone = 'professional';
  }

  // Validate response_length
  const validLengths = ['short', 'medium', 'long'];
  if (!validLengths.includes(validated.response_length)) {
    validated.response_length = 'medium';
  }

  // Validate objective
  const validObjectives = ['schedule_meeting', 'qualify_lead', 'generate_interest', 'get_contact', 'start_conversation', 'direct_sale'];
  if (!validObjectives.includes(validated.objective)) {
    validated.objective = 'qualify_lead';
  }

  // Ensure conversation_steps is an array
  if (!Array.isArray(validated.conversation_steps)) {
    validated.conversation_steps = defaults.conversation_steps;
  }

  return validated;
}

/**
 * Refine an existing agent configuration based on user feedback
 */
async function refineAgentConfig(currentConfig, feedback, language = 'pt') {
  try {
    const systemPrompt = `Voce e um especialista em refinar agentes de IA para vendas.
O usuario quer ajustar a configuracao do agente baseado no feedback fornecido.

Retorne o JSON atualizado com as melhorias solicitadas, mantendo a mesma estrutura.`;

    const userPrompt = `Configuracao atual:
${JSON.stringify(currentConfig, null, 2)}

Feedback do usuario:
"${feedback}"

Ajuste a configuracao conforme o feedback e retorne o JSON atualizado.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 2000
    });

    const refinedConfig = JSON.parse(response.choices[0].message.content);

    return {
      success: true,
      config: validateAndCompleteConfig(refinedConfig, 'linkedin'),
      tokens_used: response.usage?.total_tokens || 0
    };
  } catch (error) {
    console.error('[AgentGenerator] Error refining config:', error);
    throw error;
  }
}

/**
 * Generate agent configuration from a template + product/service + objective
 * Uses AI to create a truly personalized configuration
 */
async function generateFromTemplate(template, productService, objective, language = 'pt') {
  try {
    const objectiveLabels = {
      'generate_interest': 'Gerar interesse e curiosidade sobre o produto',
      'qualify_lead': 'Qualificar o lead (entender se tem fit)',
      'schedule_meeting': 'Agendar uma reunião ou demonstração',
      'start_conversation': 'Iniciar conversa e criar relacionamento',
      'nurture': 'Nutrir o lead com conteúdo de valor'
    };

    const systemPrompt = `Você é um especialista em criar agentes de IA para vendas B2B.
Sua tarefa é criar uma configuração de agente personalizada combinando:
1. Uma metodologia de vendas específica
2. O produto/serviço que será vendido
3. O objetivo da conversa

REGRAS CRÍTICAS:
- O system_prompt deve ser ESPECÍFICO para o produto, não genérico
- A mensagem inicial deve mencionar o produto de forma natural
- As perguntas devem ser adaptadas ao contexto do produto
- O agente deve parecer humano, não robótico
- Respostas curtas (2-3 frases máximo)
- NUNCA use frases como "Gostaria de entender mais sobre..." ou "Quais são os principais desafios..."
- Use linguagem natural e coloquial
- NUNCA use formatação markdown. Links devem ser texto simples (ex: www.site.com ou site.com), NUNCA no formato [texto](url)
- Evite usar asteriscos, colchetes ou qualquer formatação especial - o canal é LinkedIn/WhatsApp que não suporta markdown

${language === 'pt' ? 'Gere todo o conteúdo em português brasileiro coloquial.' : 'Generate in English.'}

Retorne APENAS um JSON válido com esta estrutura:
{
  "name": "Nome do agente (max 50 chars)",
  "description": "Descrição curta (max 200 chars)",
  "system_prompt": "Prompt completo (300-500 palavras) com: identidade, produto que vende, metodologia, tom, regras de comportamento, exemplos de BOM e RUIM. IMPORTANTE: incluir regra de NUNCA usar markdown/formatação especial, links sempre como texto simples",
  "behavioral_profile": { "formality": 60, "friendliness": 75, "assertiveness": 50, "professionalism": 70 },
  "tone": "casual|professional|friendly",
  "initial_message": "Mensagem de abertura PERSONALIZADA mencionando o produto de forma natural",
  "products_services": "Descrição do produto/serviço",
  "objective": "objetivo",
  "objective_instructions": "Instruções específicas para atingir o objetivo",
  "escalation_keywords": "palavras,chave,separadas,por,virgula",
  "response_length": "short",
  "conversation_steps": [
    { "step": 1, "name": "Nome", "description": "O que fazer", "example_questions": ["Pergunta 1", "Pergunta 2"] }
  ]
}`;

    const userPrompt = `Crie um agente de vendas combinando:

METODOLOGIA: ${template.name}
${template.longDescription || template.shortDescription}

FILOSOFIA DA METODOLOGIA:
${template.philosophy || ''}

ETAPAS DA METODOLOGIA:
${template.config?.conversation_steps?.map(s => `- ${s.name}: ${s.description}`).join('\n') || ''}

---

PRODUTO/SERVIÇO QUE O AGENTE VENDE:
${productService}

---

OBJETIVO DA CONVERSA:
${objectiveLabels[objective] || objective}

---

IMPORTANTE:
1. O system_prompt deve explicar a metodologia MAS adaptada para vender "${productService}"
2. A mensagem inicial deve ser natural e mencionar "${productService}" de forma elegante
3. As perguntas de exemplo devem ser sobre "${productService}", não genéricas
4. Inclua no system_prompt exemplos de respostas BOM vs RUIM específicas para esse contexto

Retorne APENAS o JSON.`;

    const response = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' },
      temperature: 0.7,
      max_tokens: 3000
    });

    const generatedConfig = JSON.parse(response.choices[0].message.content);

    // Add template reference
    generatedConfig.template_id = template.id;
    generatedConfig.template_name = template.name;
    generatedConfig.products_services = productService;
    generatedConfig.objective = objective;

    const validatedConfig = validateAndCompleteConfig(generatedConfig, 'linkedin');

    console.log(`[AgentGenerator] Generated config from template: ${template.name} for product: ${productService}`);

    return {
      success: true,
      config: validatedConfig,
      tokens_used: response.usage?.total_tokens || 0
    };
  } catch (error) {
    console.error('[AgentGenerator] Error generating from template:', error);
    throw error;
  }
}

module.exports = {
  generateAgentConfig,
  refineAgentConfig,
  generateFromTemplate
};
