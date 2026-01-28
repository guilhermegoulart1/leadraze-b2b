// backend/src/controllers/variablesController.js
// Controller para API de variaveis de templates

const db = require('../config/database');
const TemplateProcessor = require('../utils/templateProcessor');

/**
 * GET /api/variables/definitions
 * Retorna definicoes de todas as categorias de variaveis
 */
const getDefinitions = async (req, res) => {
  try {
    const context = req.query.context ? JSON.parse(req.query.context) : {};
    const definitions = TemplateProcessor.getVariableDefinitions(context);

    res.json({
      success: true,
      data: definitions
    });
  } catch (error) {
    console.error('Error getting variable definitions:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get variable definitions'
    });
  }
};

/**
 * GET /api/variables/values
 * Retorna valores reais de variaveis para um contato/oportunidade
 */
const getValues = async (req, res) => {
  try {
    const { contactId, opportunityId } = req.query;
    const accountId = req.user?.accountId;

    if (!accountId) {
      return res.status(401).json({
        success: false,
        error: 'Account ID not found'
      });
    }

    let contact = null;
    let opportunity = null;

    // Buscar dados do contato se ID fornecido
    if (contactId) {
      const contactResult = await db.query(
        `SELECT
          id, name, first_name, last_name, email, phone,
          company, title, location, headline, industry, about,
          connections_count, profile_url, is_premium, custom_fields
         FROM contacts
         WHERE id = $1 AND account_id = $2`,
        [contactId, accountId]
      );
      contact = contactResult.rows[0] || null;
    }

    // Buscar dados da oportunidade se ID fornecido
    if (opportunityId) {
      const oppResult = await db.query(
        `SELECT
          o.id, o.title, o.value, o.currency, o.probability, o.score,
          o.company_size, o.budget, o.timeline, o.expected_close_date,
          o.source, o.notes, o.custom_fields,
          ps.name as stage_name,
          pp.name as pipeline_name
         FROM opportunities o
         LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
         LEFT JOIN pipelines pp ON o.pipeline_id = pp.id
         WHERE o.id = $1 AND o.account_id = $2`,
        [opportunityId, accountId]
      );
      opportunity = oppResult.rows[0] || null;
    }

    // Construir contexto e mapa de valores
    const context = {
      contact,
      opportunity
    };

    const values = TemplateProcessor.buildVariablesMap(context);

    res.json({
      success: true,
      data: values
    });
  } catch (error) {
    console.error('Error getting variable values:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get variable values'
    });
  }
};

/**
 * POST /api/variables/validate
 * Valida um template e retorna variaveis usadas
 */
const validateTemplate = async (req, res) => {
  try {
    const { template, customVariables = [] } = req.body;

    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Template is required'
      });
    }

    // Usar validacao existente com extensao para customVariables
    const baseValidation = TemplateProcessor.validateTemplateWithCustomVars(template, customVariables);

    // Extrair variaveis usadas
    const usedVariables = TemplateProcessor.getUsedVariables(template);

    res.json({
      success: true,
      data: {
        valid: baseValidation.valid,
        usedVariables,
        invalidVariables: baseValidation.invalidVariables,
        validVariables: baseValidation.validVariables
      }
    });
  } catch (error) {
    console.error('Error validating template:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to validate template'
    });
  }
};

/**
 * POST /api/variables/preview
 * Gera preview do template com dados de exemplo ou reais
 */
const previewTemplate = async (req, res) => {
  try {
    const { template, contactId, customVariables = [] } = req.body;
    const accountId = req.user?.accountId;

    if (!template || typeof template !== 'string') {
      return res.status(400).json({
        success: false,
        error: 'Template is required'
      });
    }

    let context = {};

    // Se contactId fornecido, buscar dados reais
    if (contactId && accountId) {
      const contactResult = await db.query(
        `SELECT
          id, name, first_name, last_name, email, phone,
          company, title, location, headline, industry, about,
          connections_count, profile_url, is_premium
         FROM contacts
         WHERE id = $1 AND account_id = $2`,
        [contactId, accountId]
      );

      if (contactResult.rows[0]) {
        context.contact = contactResult.rows[0];
      }
    }

    // Adicionar variaveis customizadas ao contexto
    if (customVariables.length > 0) {
      context.customVariables = customVariables;
    }

    // Processar template
    let preview;
    if (Object.keys(context).length > 0) {
      preview = TemplateProcessor.processAllVariables(template, context);
    } else {
      preview = TemplateProcessor.generatePreview(template, customVariables);
    }

    res.json({
      success: true,
      data: {
        preview,
        usedRealData: !!contactId
      }
    });
  } catch (error) {
    console.error('Error generating preview:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate preview'
    });
  }
};

module.exports = {
  getDefinitions,
  getValues,
  validateTemplate,
  previewTemplate
};
