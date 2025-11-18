// backend/src/controllers/knowledgeController.js
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ValidationError } = require('../utils/errors');
const db = require('../config/database');
const ragService = require('../services/ragService');

/**
 * Listar conhecimentos de um agente
 */
const listKnowledge = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { type, category, active } = req.query;

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', {
      id: agentId,
      user_id: req.user.id
    });

    if (!agent) {
      throw new NotFoundError('Agente não encontrado');
    }

    // Buscar conhecimentos
    const filters = {};
    if (type) filters.type = type;
    if (category) filters.category = category;
    if (active !== undefined) filters.active = active === 'true';

    const knowledge = await ragService.listKnowledge(agentId, filters);

    sendSuccess(res, {
      knowledge,
      total: knowledge.length
    });

  } catch (error) {
    console.error('Erro ao listar conhecimento:', error);
    sendError(res, error);
  }
};

/**
 * Adicionar conhecimento individual
 */
const addKnowledge = async (req, res) => {
  try {
    const { agentId } = req.params;
    const knowledgeData = req.body;

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', {
      id: agentId,
      user_id: req.user.id
    });

    if (!agent) {
      throw new NotFoundError('Agente não encontrado');
    }

    // Validar campos obrigatórios
    if (!knowledgeData.type) {
      throw new ValidationError('Tipo de conhecimento é obrigatório');
    }

    // Validar tipos específicos
    if (knowledgeData.type === 'faq' || knowledgeData.type === 'objection') {
      if (!knowledgeData.question || !knowledgeData.answer) {
        throw new ValidationError('Question e answer são obrigatórios para FAQ/Objeção');
      }
    } else if (['document', 'product_info', 'case_study'].includes(knowledgeData.type)) {
      if (!knowledgeData.content) {
        throw new ValidationError('Content é obrigatório para este tipo');
      }
    }

    // Adicionar conhecimento
    const knowledge = await ragService.addKnowledge({
      ...knowledgeData,
      ai_agent_id: agentId
    });

    sendSuccess(res, {
      message: 'Conhecimento adicionado com sucesso',
      knowledge
    }, 201);

  } catch (error) {
    console.error('Erro ao adicionar conhecimento:', error);
    sendError(res, error);
  }
};

/**
 * Adicionar múltiplos conhecimentos em lote
 */
const addKnowledgeBatch = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { knowledgeItems } = req.body;

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', {
      id: agentId,
      user_id: req.user.id
    });

    if (!agent) {
      throw new NotFoundError('Agente não encontrado');
    }

    // Validar array
    if (!Array.isArray(knowledgeItems) || knowledgeItems.length === 0) {
      throw new ValidationError('knowledgeItems deve ser um array não vazio');
    }

    // Adicionar em lote
    const results = await ragService.addKnowledgeBatch(agentId, knowledgeItems);

    sendSuccess(res, {
      message: `${results.length} conhecimentos adicionados com sucesso`,
      knowledge: results
    }, 201);

  } catch (error) {
    console.error('Erro ao adicionar conhecimentos em lote:', error);
    sendError(res, error);
  }
};

/**
 * Atualizar conhecimento
 */
const updateKnowledge = async (req, res) => {
  try {
    const { agentId, knowledgeId } = req.params;
    const updates = req.body;

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', {
      id: agentId,
      user_id: req.user.id
    });

    if (!agent) {
      throw new NotFoundError('Agente não encontrado');
    }

    // Verificar se conhecimento existe e pertence ao agente
    const existing = await db.query(
      'SELECT * FROM ai_agent_knowledge WHERE id = $1 AND ai_agent_id = $2',
      [knowledgeId, agentId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Conhecimento não encontrado');
    }

    // Atualizar
    const knowledge = await ragService.updateKnowledge(knowledgeId, updates);

    sendSuccess(res, {
      message: 'Conhecimento atualizado com sucesso',
      knowledge
    });

  } catch (error) {
    console.error('Erro ao atualizar conhecimento:', error);
    sendError(res, error);
  }
};

/**
 * Deletar conhecimento
 */
const deleteKnowledge = async (req, res) => {
  try {
    const { agentId, knowledgeId } = req.params;

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', {
      id: agentId,
      user_id: req.user.id
    });

    if (!agent) {
      throw new NotFoundError('Agente não encontrado');
    }

    // Verificar se conhecimento existe e pertence ao agente
    const existing = await db.query(
      'SELECT * FROM ai_agent_knowledge WHERE id = $1 AND ai_agent_id = $2',
      [knowledgeId, agentId]
    );

    if (existing.rows.length === 0) {
      throw new NotFoundError('Conhecimento não encontrado');
    }

    // Deletar
    await ragService.deleteKnowledge(knowledgeId);

    sendSuccess(res, {
      message: 'Conhecimento removido com sucesso'
    });

  } catch (error) {
    console.error('Erro ao deletar conhecimento:', error);
    sendError(res, error);
  }
};

/**
 * Testar busca semântica
 */
const searchKnowledge = async (req, res) => {
  try {
    const { agentId } = req.params;
    const { query, limit = 5, minSimilarity = 0.7, type } = req.body;

    // Verificar se agente pertence ao usuário
    const agent = await db.findOne('ai_agents', {
      id: agentId,
      user_id: req.user.id
    });

    if (!agent) {
      throw new NotFoundError('Agente não encontrado');
    }

    if (!query) {
      throw new ValidationError('Query é obrigatória');
    }

    // Buscar conhecimento relevante
    const results = await ragService.searchRelevantKnowledge(agentId, query, {
      limit: parseInt(limit),
      minSimilarity: parseFloat(minSimilarity),
      type
    });

    sendSuccess(res, {
      results,
      total: results.length,
      query
    });

  } catch (error) {
    console.error('Erro ao buscar conhecimento:', error);
    sendError(res, error);
  }
};

module.exports = {
  listKnowledge,
  addKnowledge,
  addKnowledgeBatch,
  updateKnowledge,
  deleteKnowledge,
  searchKnowledge
};
