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
   * Gera preview do template com dados de exemplo
   * @param {string} template - Template para preview
   * @returns {string} - Preview com dados de exemplo
   */
  static generatePreview(template) {
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
      headline: 'Profissional experiente em transformação digital'
    };

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
