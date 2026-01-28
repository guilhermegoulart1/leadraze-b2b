// frontend/src/constants/workflowVariables.js
// Definicoes de variaveis para o sistema de templates do WorkflowBuilder

export const VARIABLE_CATEGORIES = {
  system: {
    id: 'system',
    label: 'Sistema',
    icon: 'Settings',
    color: '#6b7280', // gray-500
    variables: [
      { key: 'current_date', label: 'Data Atual', description: 'Data de hoje (DD/MM/YYYY)', example: '15/01/2024' },
      { key: 'current_time', label: 'Hora Atual', description: 'Hora atual (HH:MM)', example: '14:30' },
      { key: 'current_datetime', label: 'Data e Hora', description: 'Data e hora completa', example: '15/01/2024 14:30' },
      { key: 'agent_id', label: 'ID do Agente', description: 'Identificador do agente', example: '42' },
      { key: 'agent_name', label: 'Nome do Agente', description: 'Nome do agente AI', example: 'SDR Bot' },
      { key: 'conversation_id', label: 'ID da Conversa', description: 'UUID da conversa', example: 'abc-123-def' },
      { key: 'campaign_id', label: 'ID da Campanha', description: 'ID da campanha (se houver)', example: '15' },
      { key: 'campaign_name', label: 'Nome da Campanha', description: 'Nome da campanha', example: 'Outbound Q1' }
    ]
  },
  contact: {
    id: 'contact',
    label: 'Contato',
    icon: 'User',
    color: '#2563eb', // blue-600
    variables: [
      { key: 'first_name', label: 'Primeiro Nome', description: 'Primeiro nome do contato', example: 'Joao' },
      { key: 'name', label: 'Nome Completo', description: 'Nome completo', example: 'Joao Silva' },
      { key: 'last_name', label: 'Sobrenome', description: 'Ultimo nome', example: 'Silva' },
      { key: 'email', label: 'Email', description: 'Email do contato', example: 'joao@empresa.com' },
      { key: 'phone', label: 'Telefone', description: 'Telefone', example: '+55 11 99999-9999' },
      { key: 'company', label: 'Empresa', description: 'Nome da empresa', example: 'Tech Solutions' },
      { key: 'title', label: 'Cargo', description: 'Cargo/titulo', example: 'Diretor de TI' },
      { key: 'location', label: 'Localizacao', description: 'Cidade/Regiao', example: 'Sao Paulo, SP' },
      { key: 'headline', label: 'Headline', description: 'Headline do perfil', example: 'CTO at Tech Co' },
      { key: 'industry', label: 'Industria', description: 'Setor/Industria', example: 'Tecnologia' },
      { key: 'about', label: 'Sobre', description: 'Descricao/bio do perfil', example: '15 anos de experiencia em...' },
      { key: 'connections_count', label: 'Conexoes', description: 'Numero de conexoes', example: '500+' },
      { key: 'profile_url', label: 'URL do Perfil', description: 'Link do perfil', example: 'linkedin.com/in/joao' },
      { key: 'is_premium', label: 'Premium?', description: 'Se possui conta Premium', example: 'true' }
    ]
  },
  opportunity: {
    id: 'opportunity',
    label: 'Oportunidade',
    icon: 'DollarSign',
    color: '#16a34a', // green-600
    contextRequired: 'opportunity', // So aparece se existir oportunidade
    variables: [
      { key: 'opportunity.id', label: 'ID', description: 'ID da oportunidade', example: 'opp-123' },
      { key: 'opportunity.title', label: 'Titulo', description: 'Titulo da oportunidade', example: 'Deal ABC Corp' },
      { key: 'opportunity.value', label: 'Valor', description: 'Valor estimado', example: '50000' },
      { key: 'opportunity.value_formatted', label: 'Valor Formatado', description: 'Valor com moeda', example: 'R$ 50.000,00' },
      { key: 'opportunity.currency', label: 'Moeda', description: 'Moeda do valor', example: 'BRL' },
      { key: 'opportunity.probability', label: 'Probabilidade', description: 'Chance de fechar (%)', example: '75' },
      { key: 'opportunity.stage', label: 'Etapa', description: 'Etapa atual no pipeline', example: 'Negociacao' },
      { key: 'opportunity.pipeline', label: 'Pipeline', description: 'Nome do pipeline', example: 'Vendas B2B' },
      { key: 'opportunity.score', label: 'Score', description: 'Pontuacao (0-100)', example: '85' },
      { key: 'opportunity.company_size', label: 'Tamanho Empresa', description: 'Porte da empresa', example: '51-200' },
      { key: 'opportunity.budget', label: 'Orcamento', description: 'Orcamento informado', example: 'R$ 100k' },
      { key: 'opportunity.timeline', label: 'Timeline', description: 'Prazo desejado', example: '3 meses' },
      { key: 'opportunity.expected_close_date', label: 'Previsao Fechamento', description: 'Data prevista', example: '01/03/2024' },
      { key: 'opportunity.source', label: 'Origem', description: 'De onde veio', example: 'LinkedIn' },
      { key: 'opportunity.notes', label: 'Notas', description: 'Notas da oportunidade', example: 'Cliente interessado...' }
    ]
  },
  channel: {
    id: 'channel',
    label: 'Canal',
    icon: 'MessageCircle',
    color: '#9333ea', // purple-600
    variables: [
      { key: 'channel_type', label: 'Tipo de Canal', description: 'linkedin, whatsapp, email, etc', example: 'linkedin' },
      { key: 'channel_name', label: 'Nome do Canal', description: 'Nome amigavel do canal', example: 'WhatsApp Business' },
      { key: 'is_group', label: 'E Grupo?', description: 'Se e conversa em grupo', example: 'false' },
      { key: 'group_name', label: 'Nome do Grupo', description: 'Nome do grupo (se aplicavel)', example: 'Vendas Team' },
      { key: 'attendee_count', label: 'Participantes', description: 'Numero de participantes', example: '5' }
    ]
  },
  conversation: {
    id: 'conversation',
    label: 'Conversa',
    icon: 'MessageSquare',
    color: '#4f46e5', // indigo-600
    variables: [
      { key: 'lead_messages', label: 'Msgs do Lead', description: 'Total de mensagens do lead', example: '5' },
      { key: 'ai_messages', label: 'Msgs da IA', description: 'Total de mensagens da IA', example: '4' },
      { key: 'total_messages', label: 'Total de Msgs', description: 'Total de mensagens', example: '9' },
      { key: 'exchange_count', label: 'Trocas', description: 'Numero de trocas completas', example: '4' },
      { key: 'last_intent', label: 'Ultimo Intent', description: 'Intencao detectada', example: 'interesse' },
      { key: 'last_sentiment', label: 'Ultimo Sentimento', description: 'Sentimento detectado', example: 'positive' },
      { key: 'last_message', label: 'Ultima Mensagem', description: 'Texto da ultima msg do lead', example: 'Sim, me interessa!' },
      { key: 'last_message_at', label: 'Data Ultima Msg', description: 'Quando foi a ultima msg', example: '15/01/2024 14:30' },
      { key: 'conversation_started_at', label: 'Inicio da Conversa', description: 'Quando iniciou', example: '10/01/2024 09:00' }
    ]
  },
  workflow: {
    id: 'workflow',
    label: 'Workflow',
    icon: 'GitBranch',
    color: '#d97706', // amber-600
    dynamicVariables: true, // Permite variaveis dinamicas de HTTP
    variables: [
      { key: 'workflow.current_step', label: 'Etapa Atual', description: 'Nome da etapa atual', example: 'Rapport' },
      { key: 'workflow.step_number', label: 'Numero da Etapa', description: 'Numero sequencial', example: '2' },
      { key: 'workflow.attempts', label: 'Tentativas', description: 'Tentativas na etapa atual', example: '1' },
      { key: 'workflow.started_at', label: 'Inicio do Workflow', description: 'Quando iniciou', example: '15/01/2024 10:00' }
    ]
  },
  custom: {
    id: 'custom',
    label: 'Personalizadas',
    icon: 'Sparkles',
    color: '#db2777', // pink-600
    dynamicVariables: true, // Permite variaveis definidas pelo usuario
    manageable: true, // Mostra botao "Gerenciar"
    variables: [] // Preenchido dinamicamente
  }
};

// Helper para obter todas as variaveis de uma categoria
export const getVariablesByCategory = (categoryId) => {
  const category = VARIABLE_CATEGORIES[categoryId];
  return category ? category.variables : [];
};

// Helper para obter uma variavel especifica pelo key
export const getVariableByKey = (key) => {
  for (const category of Object.values(VARIABLE_CATEGORIES)) {
    const variable = category.variables.find(v => v.key === key);
    if (variable) {
      return { ...variable, category: category.id, categoryLabel: category.label };
    }
  }
  return null;
};

// Helper para buscar variaveis por texto
export const searchVariables = (query, context = {}) => {
  const results = [];
  const lowerQuery = query.toLowerCase();

  for (const [categoryId, category] of Object.entries(VARIABLE_CATEGORIES)) {
    // Verificar se a categoria requer contexto especifico
    if (category.contextRequired && !context[category.contextRequired]) {
      continue;
    }

    for (const variable of category.variables) {
      if (
        variable.key.toLowerCase().includes(lowerQuery) ||
        variable.label.toLowerCase().includes(lowerQuery) ||
        variable.description.toLowerCase().includes(lowerQuery)
      ) {
        results.push({
          ...variable,
          category: categoryId,
          categoryLabel: category.label,
          categoryColor: category.color
        });
      }
    }
  }

  return results;
};

// Helper para obter todas as categorias filtradas por contexto
export const getFilteredCategories = (context = {}) => {
  const filtered = {};

  for (const [categoryId, category] of Object.entries(VARIABLE_CATEGORIES)) {
    // Verificar se a categoria requer contexto especifico
    if (category.contextRequired && !context[category.contextRequired]) {
      continue;
    }

    filtered[categoryId] = category;
  }

  return filtered;
};

// Helper para formatar variavel como template
export const formatVariableTemplate = (key) => {
  return `{{${key}}}`;
};

// Helper para extrair variaveis de um template
export const extractVariablesFromTemplate = (template) => {
  if (!template || typeof template !== 'string') return [];

  const regex = /\{\{([^}]+)\}\}/g;
  const matches = [];
  let match;

  while ((match = regex.exec(template)) !== null) {
    matches.push(match[1]);
  }

  return [...new Set(matches)]; // Remove duplicatas
};

// Helper para validar se todas as variaveis de um template sao validas
export const validateTemplateVariables = (template, context = {}, customVariables = []) => {
  const usedVariables = extractVariablesFromTemplate(template);
  const invalidVariables = [];
  const validVariables = [];

  // Coletar todas as keys validas
  const allValidKeys = new Set();

  for (const [categoryId, category] of Object.entries(VARIABLE_CATEGORIES)) {
    if (category.contextRequired && !context[category.contextRequired]) {
      continue;
    }
    for (const variable of category.variables) {
      allValidKeys.add(variable.key);
    }
  }

  // Adicionar variaveis customizadas
  for (const customVar of customVariables) {
    allValidKeys.add(customVar.key);
  }

  // Adicionar variaveis de workflow (dinamicas)
  if (context.workflowVariables) {
    for (const key of Object.keys(context.workflowVariables)) {
      allValidKeys.add(key);
      allValidKeys.add(`workflow.${key}`);
    }
  }

  // Validar cada variavel usada
  for (const varKey of usedVariables) {
    if (allValidKeys.has(varKey)) {
      validVariables.push(varKey);
    } else {
      invalidVariables.push(varKey);
    }
  }

  return {
    valid: invalidVariables.length === 0,
    validVariables,
    invalidVariables,
    usedCount: usedVariables.length
  };
};

// Cores para os badges de variaveis (mapeia categoria para classe Tailwind)
export const CATEGORY_COLORS = {
  system: { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' },
  contact: { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' },
  opportunity: { bg: 'bg-green-100', text: 'text-green-700', border: 'border-green-200' },
  channel: { bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-200' },
  conversation: { bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-200' },
  workflow: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' },
  custom: { bg: 'bg-pink-100', text: 'text-pink-700', border: 'border-pink-200' }
};

// Icons mapping (para usar com lucide-react)
export const CATEGORY_ICONS = {
  system: 'Settings',
  contact: 'User',
  opportunity: 'DollarSign',
  channel: 'MessageCircle',
  conversation: 'MessageSquare',
  workflow: 'GitBranch',
  custom: 'Sparkles'
};

export default VARIABLE_CATEGORIES;
