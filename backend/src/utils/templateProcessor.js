// backend/src/utils/templateProcessor.js

/**
 * Processa templates de mensagens substituindo variáveis do LinkedIn
 *
 * Variáveis disponíveis (inglês - padrão):
 * - {{first_name}} - Lead's first name only
 * - {{name}} - Lead's full name
 * - {{company}} - Current company
 * - {{title}} - Job title
 * - {{location}} - Location
 * - {{industry}} - Industry/sector
 * - {{connections}} - Number of connections
 * - {{summary}} - Profile summary
 *
 * Variáveis disponíveis (português - legacy):
 * - {{primeiro_nome}} - Primeiro nome do lead
 * - {{nome}} - Nome do lead
 * - {{empresa}} - Empresa atual
 * - {{cargo}} - Cargo/título
 * - {{localizacao}} - Localização
 * - {{industria}} - Indústria/setor
 * - {{conexoes}} - Número de conexões
 * - {{resumo}} - Resumo do perfil
 */

class TemplateProcessor {
  /**
   * Substitui variáveis do template com dados do lead
   * @param {string} template - Template com variáveis
   * @param {object} leadData - Dados do lead do LinkedIn
   * @returns {string} - Mensagem com variáveis substituídas
   */
  static processTemplate(template, leadData) {
    if (!template || typeof template !== 'string') {
      return template;
    }

    if (!leadData) {
      return template;
    }

    let processed = template;

    // Helper to extract first name
    const getFirstName = (fullName) => {
      if (!fullName) return '';
      return fullName.split(' ')[0];
    };

    const fullName = leadData.name || leadData.full_name || '';
    const firstName = leadData.first_name || getFirstName(fullName);

    // Mapear campos do lead para variáveis (inglês - padrão)
    const englishVariables = {
      '{{first_name}}': firstName,
      '{{name}}': fullName,
      '{{company}}': leadData.company || leadData.current_company || '',
      '{{title}}': leadData.title || leadData.job_title || '',
      '{{location}}': leadData.location || '',
      '{{industry}}': leadData.industry || '',
      '{{connections}}': leadData.connections_count || leadData.connections || '',
      '{{summary}}': leadData.summary || leadData.headline || ''
    };

    // Mapear campos do lead para variáveis (português - legacy)
    const portugueseVariables = {
      '{{primeiro_nome}}': firstName,
      '{{nome}}': fullName,
      '{{empresa}}': leadData.company || leadData.current_company || '',
      '{{cargo}}': leadData.title || leadData.job_title || '',
      '{{localizacao}}': leadData.location || '',
      '{{industria}}': leadData.industry || '',
      '{{conexoes}}': leadData.connections_count || leadData.connections || '',
      '{{resumo}}': leadData.summary || leadData.headline || ''
    };

    // Combinar ambos os conjuntos de variáveis
    const variables = { ...englishVariables, ...portugueseVariables };

    // Substituir cada variável
    Object.entries(variables).forEach(([variable, value]) => {
      // Substituir todas as ocorrências da variável
      const regex = new RegExp(variable.replace(/[{}]/g, '\\$&'), 'gi');
      processed = processed.replace(regex, value || '');
    });

    // Limpar espaços duplos resultantes de variáveis vazias
    processed = processed.replace(/\s+/g, ' ').trim();

    // Limpar vírgulas ou pontos seguidos de espaços desnecessários
    processed = processed.replace(/,\s*,/g, ',');
    processed = processed.replace(/\.\s*\./g, '.');

    return processed;
  }

  /**
   * Verifica quais variáveis estão sendo usadas no template
   * @param {string} template - Template para analisar
   * @returns {array} - Lista de variáveis encontradas
   */
  static getUsedVariables(template) {
    if (!template || typeof template !== 'string') {
      return [];
    }

    const variableRegex = /\{\{(\w+)\}\}/g;
    const matches = [...template.matchAll(variableRegex)];
    return matches.map(match => match[0]);
  }

  /**
   * Valida se todas as variáveis do template são válidas
   * @param {string} template - Template para validar
   * @returns {object} - { valid: boolean, invalidVariables: array }
   */
  static validateTemplate(template) {
    const validVariables = [
      // English variables (standard)
      '{{first_name}}',
      '{{name}}',
      '{{company}}',
      '{{title}}',
      '{{location}}',
      '{{industry}}',
      '{{connections}}',
      '{{summary}}',
      // Portuguese variables (legacy)
      '{{primeiro_nome}}',
      '{{nome}}',
      '{{empresa}}',
      '{{cargo}}',
      '{{localizacao}}',
      '{{industria}}',
      '{{conexoes}}',
      '{{resumo}}'
    ];

    const usedVariables = this.getUsedVariables(template);
    const invalidVariables = usedVariables.filter(
      variable => !validVariables.includes(variable.toLowerCase())
    );

    return {
      valid: invalidVariables.length === 0,
      invalidVariables,
      validVariables: validVariables
    };
  }

  /**
   * Processa template com variáveis customizadas do agente + variáveis do lead
   * @param {string} template - Template com variáveis
   * @param {object} leadData - Dados do lead
   * @param {array} customVariables - Array de variáveis customizadas [{name, value, description}]
   * @returns {string} - Mensagem com todas as variáveis substituídas
   */
  static processTemplateWithCustomVars(template, leadData, customVariables = []) {
    if (!template || typeof template !== 'string') {
      return template;
    }

    let processed = template;

    // 1. Primeiro substituir variáveis customizadas do agente
    if (Array.isArray(customVariables) && customVariables.length > 0) {
      for (const variable of customVariables) {
        if (variable.name && variable.value !== undefined) {
          // Suportar formato {{variavel}} e {{variavel}}
          const regex = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'gi');
          processed = processed.replace(regex, variable.value || '');
        }
      }
    }

    // 2. Depois processar variáveis do lead (comportamento existente)
    return this.processTemplate(processed, leadData);
  }

  /**
   * Valida template considerando variáveis customizadas
   * @param {string} template - Template para validar
   * @param {array} customVariables - Array de variáveis customizadas opcionais
   * @returns {object} - { valid: boolean, invalidVariables: array, validVariables: array }
   */
  static validateTemplateWithCustomVars(template, customVariables = []) {
    const baseValidation = this.validateTemplate(template);

    // Se não há variáveis customizadas, retornar validação base
    if (!Array.isArray(customVariables) || customVariables.length === 0) {
      return baseValidation;
    }

    // Adicionar variáveis customizadas à lista de válidas
    const customVarNames = customVariables.map(v => `{{${v.name}}}`);
    const allValidVariables = [...baseValidation.validVariables, ...customVarNames];

    // Re-validar com a lista expandida
    const usedVariables = this.getUsedVariables(template);
    const invalidVariables = usedVariables.filter(
      variable => !allValidVariables.some(v => v.toLowerCase() === variable.toLowerCase())
    );

    return {
      valid: invalidVariables.length === 0,
      invalidVariables,
      validVariables: allValidVariables,
      customVariables: customVarNames
    };
  }

  /**
   * Retorna lista de variáveis nativas por canal
   * @param {string} channel - Canal (linkedin, whatsapp, email)
   * @returns {array} - Lista de variáveis disponíveis para o canal
   */
  static getChannelVariables(channel = 'linkedin') {
    const baseVariables = [
      { name: 'first_name', label: 'Primeiro Nome', description: 'Primeiro nome do contato' },
      { name: 'name', label: 'Nome Completo', description: 'Nome completo do contato' },
      { name: 'company', label: 'Empresa', description: 'Empresa do contato' },
      { name: 'title', label: 'Cargo', description: 'Cargo/título do contato' },
      { name: 'location', label: 'Localização', description: 'Localização do contato' },
      { name: 'industry', label: 'Setor', description: 'Setor/indústria' }
    ];

    const channelSpecific = {
      linkedin: [
        ...baseVariables,
        { name: 'connections', label: 'Conexões', description: 'Número de conexões' },
        { name: 'summary', label: 'Resumo', description: 'Resumo/headline do perfil' }
      ],
      whatsapp: [
        ...baseVariables,
        { name: 'phone', label: 'Telefone', description: 'Número de telefone' }
      ],
      email: [
        ...baseVariables,
        { name: 'email', label: 'Email', description: 'Endereço de email' }
      ]
    };

    return channelSpecific[channel] || baseVariables;
  }

  /**
   * Gera preview do template com dados de exemplo
   * @param {string} template - Template para preview
   * @param {array} customVariables - Variáveis customizadas opcionais
   * @returns {string} - Preview com dados de exemplo
   */
  static generatePreview(template, customVariables = []) {
    const exampleData = {
      first_name: 'João',
      name: 'João Silva',
      full_name: 'João Silva',
      company: 'Tech Solutions LTDA',
      current_company: 'Tech Solutions LTDA',
      title: 'Diretor de Tecnologia',
      job_title: 'Diretor de Tecnologia',
      location: 'São Paulo, Brasil',
      industry: 'Tecnologia da Informação',
      connections: '500+',
      connections_count: '500+',
      summary: 'Profissional experiente em transformação digital',
      headline: 'Profissional experiente em transformação digital',
      phone: '+55 11 99999-9999',
      email: 'joao.silva@techsolutions.com'
    };

    // Se há variáveis customizadas, usar o método que as suporta
    if (Array.isArray(customVariables) && customVariables.length > 0) {
      return this.processTemplateWithCustomVars(template, exampleData, customVariables);
    }

    return this.processTemplate(template, exampleData);
  }

  /**
   * Extrai dados do lead do formato Unipile
   * @param {object} unipileProfile - Perfil do Unipile
   * @returns {object} - Dados formatados para o template
   */
  static extractLeadData(unipileProfile) {
    return {
      name: unipileProfile.name || '',
      full_name: unipileProfile.full_name || unipileProfile.name || '',
      company: unipileProfile.current_company || unipileProfile.company || '',
      current_company: unipileProfile.current_company || '',
      title: unipileProfile.job_title || unipileProfile.title || '',
      job_title: unipileProfile.job_title || '',
      location: unipileProfile.location || '',
      industry: unipileProfile.industry || '',
      connections: unipileProfile.connections_count || '',
      connections_count: unipileProfile.connections_count || '',
      summary: unipileProfile.headline || unipileProfile.summary || '',
      headline: unipileProfile.headline || ''
    };
  }

  /**
   * Acessa valor aninhado em objeto usando notacao de ponto
   * @param {object} obj - Objeto fonte
   * @param {string} path - Caminho (ex: "opportunity.value", "contact.custom_fields.budget")
   * @returns {*} - Valor encontrado ou undefined
   */
  static getNestedValue(obj, path) {
    if (!obj || !path) return undefined;

    const parts = path.split('.');
    let current = obj;

    for (const part of parts) {
      if (current === null || current === undefined) return undefined;
      current = current[part];
    }

    return current;
  }

  /**
   * Formata valor para exibicao em template
   * @param {*} value - Valor a formatar
   * @returns {string} - Valor formatado como string
   */
  static formatValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value === 'boolean') return value ? 'sim' : 'nao';
    if (typeof value === 'number') return String(value);
    if (typeof value === 'object') {
      try {
        return JSON.stringify(value);
      } catch {
        return '[objeto]';
      }
    }
    return String(value);
  }

  /**
   * Processa template com todas as categorias de variaveis
   * @param {string} template - Template com variaveis
   * @param {object} context - Contexto completo do workflow
   * @returns {string} - Template processado
   *
   * context pode conter:
   * - contact: dados do contato
   * - opportunity: dados da oportunidade
   * - channel: dados do canal
   * - conversation: estatisticas da conversa
   * - workflow: variaveis do workflow
   * - agent: dados do agente
   * - custom: variaveis customizadas
   */
  static processAllVariables(template, context = {}) {
    if (!template || typeof template !== 'string') {
      return template;
    }

    let processed = template;

    // Construir mapa de todas as variaveis disponiveis
    const variablesMap = this.buildVariablesMap(context);

    // Regex para encontrar todas as variaveis {{...}}
    // Suporta paths aninhados como {{opportunity.value}}
    const variableRegex = /\{\{([^}]+)\}\}/g;

    processed = processed.replace(variableRegex, (match, varPath) => {
      const trimmedPath = varPath.trim();

      // Primeiro tentar busca direta no mapa
      if (variablesMap.hasOwnProperty(trimmedPath)) {
        return this.formatValue(variablesMap[trimmedPath]);
      }

      // Tentar busca por path aninhado no contexto
      const nestedValue = this.getNestedValue(context, trimmedPath);
      if (nestedValue !== undefined) {
        return this.formatValue(nestedValue);
      }

      // Manter variavel original se nao encontrada
      return match;
    });

    // Limpar espacos duplos
    processed = processed.replace(/\s+/g, ' ').trim();
    processed = processed.replace(/,\s*,/g, ',');
    processed = processed.replace(/\.\s*\./g, '.');

    return processed;
  }

  /**
   * Constroi mapa de todas as variaveis disponiveis
   * @param {object} context - Contexto completo
   * @returns {object} - Mapa de variaveis
   */
  static buildVariablesMap(context = {}) {
    const map = {};
    const now = new Date();

    // Helper para extrair primeiro nome
    const getFirstName = (fullName) => {
      if (!fullName) return '';
      return fullName.split(' ')[0];
    };

    // === VARIAVEIS DE SISTEMA ===
    map['current_date'] = now.toLocaleDateString('pt-BR');
    map['current_time'] = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    map['current_datetime'] = now.toLocaleString('pt-BR');

    // === VARIAVEIS DO AGENTE ===
    if (context.agent) {
      map['agent_id'] = context.agent.id || context.agentId || '';
      map['agent_name'] = context.agent.name || '';
    }

    // === VARIAVEIS DE CAMPANHA ===
    if (context.campaignId) {
      map['campaign_id'] = context.campaignId;
    }
    if (context.campaign) {
      map['campaign_name'] = context.campaign.name || '';
    }

    // === VARIAVEIS DE CONVERSA ===
    map['conversation_id'] = context.conversationId || '';

    // === VARIAVEIS DE CONTATO (LEAD) ===
    const contact = context.contact || context.lead || {};
    const fullName = contact.name || contact.full_name || '';
    const firstName = contact.first_name || getFirstName(fullName);
    const lastName = contact.last_name || (fullName ? fullName.split(' ').slice(1).join(' ') : '');

    map['first_name'] = firstName;
    map['primeiro_nome'] = firstName; // Legacy
    map['name'] = fullName;
    map['nome'] = fullName; // Legacy
    map['last_name'] = lastName;
    map['email'] = contact.email || '';
    map['phone'] = contact.phone || '';
    map['company'] = contact.company || contact.current_company || '';
    map['empresa'] = contact.company || contact.current_company || ''; // Legacy
    map['title'] = contact.title || contact.job_title || '';
    map['cargo'] = contact.title || contact.job_title || ''; // Legacy
    map['location'] = contact.location || '';
    map['localizacao'] = contact.location || ''; // Legacy
    map['headline'] = contact.headline || '';
    map['industry'] = contact.industry || '';
    map['industria'] = contact.industry || ''; // Legacy
    map['about'] = contact.about || '';
    map['connections_count'] = contact.connections_count || '';
    map['conexoes'] = contact.connections_count || ''; // Legacy
    map['connections'] = contact.connections_count || '';
    map['summary'] = contact.summary || contact.headline || '';
    map['resumo'] = contact.summary || contact.headline || ''; // Legacy
    map['profile_url'] = contact.profile_url || '';
    map['is_premium'] = contact.is_premium ? 'sim' : 'nao';

    // === VARIAVEIS DE OPORTUNIDADE ===
    if (context.opportunity) {
      const opp = context.opportunity;
      map['opportunity.id'] = opp.id || '';
      map['opportunity.title'] = opp.title || '';
      map['opportunity.value'] = opp.value || '';
      map['opportunity.value_formatted'] = opp.value
        ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: opp.currency || 'BRL' }).format(opp.value)
        : '';
      map['opportunity.currency'] = opp.currency || 'BRL';
      map['opportunity.probability'] = opp.probability || '';
      map['opportunity.stage'] = opp.stage_name || opp.stage || '';
      map['opportunity.pipeline'] = opp.pipeline_name || opp.pipeline || '';
      map['opportunity.score'] = opp.score || '';
      map['opportunity.company_size'] = opp.company_size || '';
      map['opportunity.budget'] = opp.budget || '';
      map['opportunity.timeline'] = opp.timeline || '';
      map['opportunity.expected_close_date'] = opp.expected_close_date
        ? new Date(opp.expected_close_date).toLocaleDateString('pt-BR')
        : '';
      map['opportunity.source'] = opp.source || '';
      map['opportunity.notes'] = opp.notes || '';
    }

    // === VARIAVEIS DE CANAL ===
    map['channel_type'] = context.channel?.type || context.channel || context.providerType || '';
    map['channel_name'] = context.channel?.name || '';
    map['is_group'] = context.channel?.isGroup || context.isGroup ? 'sim' : 'nao';
    map['group_name'] = context.channel?.groupName || context.groupName || '';
    map['attendee_count'] = context.channel?.attendeeCount || '';

    // === VARIAVEIS DE CONVERSA (ESTATISTICAS) ===
    const stats = context.conversationStats || {};
    map['lead_messages'] = stats.leadMessages || '0';
    map['ai_messages'] = stats.aiMessages || '0';
    map['total_messages'] = stats.totalMessages || '0';
    map['exchange_count'] = stats.exchangeCount || '0';
    map['last_intent'] = context.lastIntent || '';
    map['last_sentiment'] = context.lastSentiment || '';
    map['last_message'] = context.lastMessage || '';
    map['last_message_at'] = context.lastMessageAt
      ? new Date(context.lastMessageAt).toLocaleString('pt-BR')
      : '';
    map['conversation_started_at'] = context.conversationStartedAt
      ? new Date(context.conversationStartedAt).toLocaleString('pt-BR')
      : '';

    // === VARIAVEIS DE WORKFLOW ===
    map['workflow.current_step'] = context.currentStep?.label || context.currentStepLabel || '';
    map['workflow.step_number'] = context.stepNumber || '';
    map['workflow.attempts'] = context.attempts || '';
    map['workflow.started_at'] = context.workflowStartedAt
      ? new Date(context.workflowStartedAt).toLocaleString('pt-BR')
      : '';

    // Variaveis dinamicas do workflow (ex: de HTTP requests)
    if (context.workflowVariables && typeof context.workflowVariables === 'object') {
      for (const [key, value] of Object.entries(context.workflowVariables)) {
        map[key] = value;
        map[`workflow.${key}`] = value;
      }
    }

    // Compatibilidade com context.variables
    if (context.variables && typeof context.variables === 'object') {
      for (const [key, value] of Object.entries(context.variables)) {
        map[key] = value;
        map[`workflow.${key}`] = value;
      }
    }

    // === VARIAVEIS CUSTOMIZADAS ===
    if (context.customVariables && Array.isArray(context.customVariables)) {
      for (const cv of context.customVariables) {
        if (cv.key && cv.value !== undefined) {
          map[cv.key] = cv.value;
        }
      }
    }

    return map;
  }

  /**
   * Retorna todas as definicoes de variaveis disponiveis
   * @param {object} context - Contexto opcional para filtrar
   * @returns {object} - Categorias com suas variaveis
   */
  static getVariableDefinitions(context = {}) {
    const definitions = {
      system: {
        label: 'Sistema',
        variables: [
          { key: 'current_date', label: 'Data Atual', description: 'Data de hoje', example: new Date().toLocaleDateString('pt-BR') },
          { key: 'current_time', label: 'Hora Atual', description: 'Hora atual', example: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) },
          { key: 'current_datetime', label: 'Data e Hora', description: 'Data e hora completa', example: new Date().toLocaleString('pt-BR') },
          { key: 'agent_id', label: 'ID do Agente', description: 'Identificador do agente', example: '42' },
          { key: 'agent_name', label: 'Nome do Agente', description: 'Nome do agente AI', example: 'SDR Bot' },
          { key: 'conversation_id', label: 'ID da Conversa', description: 'UUID da conversa', example: 'abc-123' },
          { key: 'campaign_id', label: 'ID da Campanha', description: 'ID da campanha', example: '15' },
          { key: 'campaign_name', label: 'Nome da Campanha', description: 'Nome da campanha', example: 'Outbound Q1' }
        ]
      },
      contact: {
        label: 'Contato',
        variables: [
          { key: 'first_name', label: 'Primeiro Nome', description: 'Primeiro nome', example: 'Joao' },
          { key: 'name', label: 'Nome Completo', description: 'Nome completo', example: 'Joao Silva' },
          { key: 'last_name', label: 'Sobrenome', description: 'Sobrenome', example: 'Silva' },
          { key: 'email', label: 'Email', description: 'Email', example: 'joao@empresa.com' },
          { key: 'phone', label: 'Telefone', description: 'Telefone', example: '+55 11 99999-9999' },
          { key: 'company', label: 'Empresa', description: 'Empresa', example: 'Tech Solutions' },
          { key: 'title', label: 'Cargo', description: 'Cargo', example: 'Diretor de TI' },
          { key: 'location', label: 'Localizacao', description: 'Localizacao', example: 'Sao Paulo, SP' },
          { key: 'headline', label: 'Headline', description: 'Headline do perfil', example: 'CTO at Tech Co' },
          { key: 'industry', label: 'Industria', description: 'Setor', example: 'Tecnologia' },
          { key: 'about', label: 'Sobre', description: 'Bio do perfil', example: '15 anos...' },
          { key: 'connections_count', label: 'Conexoes', description: 'Numero de conexoes', example: '500+' },
          { key: 'profile_url', label: 'URL do Perfil', description: 'Link do perfil', example: 'linkedin.com/in/joao' },
          { key: 'is_premium', label: 'Premium?', description: 'Se possui conta Premium', example: 'sim' }
        ]
      },
      opportunity: {
        label: 'Oportunidade',
        contextRequired: 'opportunity',
        variables: [
          { key: 'opportunity.id', label: 'ID', description: 'ID da oportunidade', example: 'opp-123' },
          { key: 'opportunity.title', label: 'Titulo', description: 'Titulo', example: 'Deal ABC' },
          { key: 'opportunity.value', label: 'Valor', description: 'Valor', example: '50000' },
          { key: 'opportunity.value_formatted', label: 'Valor Formatado', description: 'Valor com moeda', example: 'R$ 50.000,00' },
          { key: 'opportunity.currency', label: 'Moeda', description: 'Moeda', example: 'BRL' },
          { key: 'opportunity.probability', label: 'Probabilidade', description: 'Chance de fechar', example: '75' },
          { key: 'opportunity.stage', label: 'Etapa', description: 'Etapa atual', example: 'Negociacao' },
          { key: 'opportunity.pipeline', label: 'Pipeline', description: 'Pipeline', example: 'Vendas B2B' },
          { key: 'opportunity.score', label: 'Score', description: 'Pontuacao', example: '85' },
          { key: 'opportunity.company_size', label: 'Tamanho Empresa', description: 'Porte', example: '51-200' },
          { key: 'opportunity.budget', label: 'Orcamento', description: 'Orcamento', example: 'R$ 100k' },
          { key: 'opportunity.timeline', label: 'Timeline', description: 'Prazo', example: '3 meses' },
          { key: 'opportunity.expected_close_date', label: 'Previsao Fechamento', description: 'Data prevista', example: '01/03/2024' }
        ]
      },
      channel: {
        label: 'Canal',
        variables: [
          { key: 'channel_type', label: 'Tipo de Canal', description: 'Tipo do canal', example: 'linkedin' },
          { key: 'channel_name', label: 'Nome do Canal', description: 'Nome', example: 'WhatsApp Business' },
          { key: 'is_group', label: 'E Grupo?', description: 'Se e grupo', example: 'nao' },
          { key: 'group_name', label: 'Nome do Grupo', description: 'Nome do grupo', example: 'Vendas Team' },
          { key: 'attendee_count', label: 'Participantes', description: 'Numero de participantes', example: '5' }
        ]
      },
      conversation: {
        label: 'Conversa',
        variables: [
          { key: 'lead_messages', label: 'Msgs do Lead', description: 'Total msgs do lead', example: '5' },
          { key: 'ai_messages', label: 'Msgs da IA', description: 'Total msgs da IA', example: '4' },
          { key: 'total_messages', label: 'Total de Msgs', description: 'Total msgs', example: '9' },
          { key: 'exchange_count', label: 'Trocas', description: 'Trocas completas', example: '4' },
          { key: 'last_intent', label: 'Ultimo Intent', description: 'Intent detectada', example: 'interesse' },
          { key: 'last_sentiment', label: 'Ultimo Sentimento', description: 'Sentimento', example: 'positive' },
          { key: 'last_message', label: 'Ultima Mensagem', description: 'Ultima msg do lead', example: 'Sim, me interessa!' },
          { key: 'last_message_at', label: 'Data Ultima Msg', description: 'Quando foi', example: '15/01/2024 14:30' }
        ]
      },
      workflow: {
        label: 'Workflow',
        dynamicVariables: true,
        variables: [
          { key: 'workflow.current_step', label: 'Etapa Atual', description: 'Nome da etapa', example: 'Rapport' },
          { key: 'workflow.step_number', label: 'Numero da Etapa', description: 'Numero', example: '2' },
          { key: 'workflow.attempts', label: 'Tentativas', description: 'Tentativas na etapa', example: '1' },
          { key: 'workflow.started_at', label: 'Inicio do Workflow', description: 'Quando iniciou', example: '15/01/2024 10:00' }
        ]
      },
      custom: {
        label: 'Personalizadas',
        dynamicVariables: true,
        manageable: true,
        variables: []
      }
    };

    // Filtrar categorias que requerem contexto
    if (!context.opportunity) {
      delete definitions.opportunity;
    }

    return definitions;
  }
}

module.exports = TemplateProcessor;
