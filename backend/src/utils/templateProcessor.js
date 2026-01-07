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
}

module.exports = TemplateProcessor;
