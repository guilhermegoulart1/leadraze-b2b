// backend/src/controllers/activationAgentController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const {
  ValidationError,
  NotFoundError,
  ForbiddenError
} = require('../utils/errors');
const { getAccessibleSectorIds } = require('../middleware/permissions');

// ================================
// HELPER: Build sector filter for activation agent queries
// ================================
async function buildActivationAgentSectorFilter(userId, accountId, paramIndex = 3) {
  const accessibleSectorIds = await getAccessibleSectorIds(userId, accountId);

  if (accessibleSectorIds.length > 0) {
    return {
      filter: `AND (aa.sector_id = ANY($${paramIndex}) OR aa.sector_id IS NULL)`,
      params: [accessibleSectorIds]
    };
  } else {
    return {
      filter: 'AND aa.sector_id IS NULL',
      params: []
    };
  }
}

// ================================
// 1. LISTAR AGENTES DE ATIVAÇÃO
// ================================
const getActivationAgents = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { activation_type, search, page = 1, limit = 20 } = req.query;

    console.log(`📋 Listando agentes de ativação do usuário ${userId} (conta ${accountId})`);

    // Construir query - MULTI-TENANCY + SECTOR filtering
    let whereConditions = ['aa.account_id = $1', 'aa.user_id = $2'];
    let queryParams = [accountId, userId];
    let paramIndex = 3;

    // SECTOR FILTER: Add sector filtering
    const { filter: sectorFilter, params: sectorParams } = await buildActivationAgentSectorFilter(userId, accountId, paramIndex);
    if (sectorParams.length > 0) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
      queryParams.push(...sectorParams);
      paramIndex += sectorParams.length;
    } else if (sectorFilter) {
      whereConditions.push(sectorFilter.replace(/^AND /, ''));
    }

    // Filtro por busca
    if (search) {
      whereConditions.push(`(aa.name ILIKE $${paramIndex} OR aa.description ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    // Filtro por tipo de ativação
    if (activation_type) {
      whereConditions.push(`aa.activation_type = $${paramIndex}`);
      queryParams.push(activation_type);
      paramIndex++;
    }

    const offset = (page - 1) * limit;
    const whereClause = whereConditions.join(' AND ');

    // Query com estatísticas
    const query = `
      SELECT
        aa.*,
        u.name as creator_name,
        u.email as creator_email,
        s.name as sector_name,
        COALESCE(COUNT(DISTINCT ac.id), 0) as campaigns_count,
        COALESCE(COUNT(DISTINCT CASE WHEN ac.status = 'active' THEN ac.id END), 0) as active_campaigns_count
      FROM activation_agents aa
      LEFT JOIN users u ON aa.user_id = u.id
      LEFT JOIN sectors s ON aa.sector_id = s.id
      LEFT JOIN activation_campaigns ac ON aa.id = ac.agent_id
      WHERE ${whereClause}
      GROUP BY aa.id, u.name, u.email, s.name
      ORDER BY aa.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Contar total
    const countQuery = `
      SELECT COUNT(DISTINCT aa.id)
      FROM activation_agents aa
      WHERE ${whereClause}
    `;

    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    console.log(`✅ Encontrados ${result.rows.length} agentes de ativação`);

    sendSuccess(res, {
      agents: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('❌ Erro ao listar agentes de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. OBTER AGENTE ESPECÍFICO
// ================================
const getActivationAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🔍 Buscando agente de ativação ${id} (conta ${accountId})`);

    // Get sector filter
    const { filter: sectorFilter, params: sectorParams } = await buildActivationAgentSectorFilter(userId, accountId, 4);

    const query = `
      SELECT
        aa.*,
        u.name as creator_name,
        u.email as creator_email,
        s.name as sector_name,
        COALESCE(COUNT(DISTINCT ac.id), 0) as campaigns_count,
        COALESCE(COUNT(DISTINCT CASE WHEN ac.status = 'active' THEN ac.id END), 0) as active_campaigns_count
      FROM activation_agents aa
      LEFT JOIN users u ON aa.user_id = u.id
      LEFT JOIN sectors s ON aa.sector_id = s.id
      LEFT JOIN activation_campaigns ac ON aa.id = ac.agent_id
      WHERE aa.id = $1 AND aa.account_id = $3 AND aa.user_id = $2 ${sectorFilter}
      GROUP BY aa.id, u.name, u.email, s.name
    `;

    const result = await db.query(query, [id, userId, accountId, ...sectorParams]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Agente de ativação não encontrado');
    }

    console.log(`✅ Agente de ativação encontrado: ${result.rows[0].name}`);

    sendSuccess(res, { agent: result.rows[0] });

  } catch (error) {
    console.error('❌ Erro ao buscar agente de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. CRIAR AGENTE DE ATIVAÇÃO
// ================================
const createActivationAgent = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      activation_type,
      personality,
      tone = 'professional',
      language = 'pt-BR',
      initial_message,
      follow_up_message,
      custom_instructions,
      sector_id
    } = req.body;

    console.log(`➕ Criando novo agente de ativação para usuário ${userId}`);

    // Validação
    if (!name || name.trim() === '') {
      throw new ValidationError('Nome do agente é obrigatório');
    }

    if (!activation_type || !['email', 'whatsapp', 'linkedin'].includes(activation_type)) {
      throw new ValidationError('Tipo de ativação inválido. Use: email, whatsapp ou linkedin');
    }

    // Verificar se o setor existe e pertence à conta
    if (sector_id) {
      const sectorCheck = await db.query(
        'SELECT id FROM sectors WHERE id = $1 AND account_id = $2',
        [sector_id, accountId]
      );

      if (sectorCheck.rows.length === 0) {
        throw new ValidationError('Setor inválido');
      }
    }

    // Criar agente
    const query = `
      INSERT INTO activation_agents (
        account_id,
        user_id,
        sector_id,
        name,
        description,
        activation_type,
        personality,
        tone,
        language,
        initial_message,
        follow_up_message,
        custom_instructions,
        is_active
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, true)
      RETURNING *
    `;

    const result = await db.query(query, [
      accountId,
      userId,
      sector_id || null,
      name.trim(),
      description?.trim() || null,
      activation_type,
      personality?.trim() || null,
      tone,
      language,
      initial_message?.trim() || null,
      follow_up_message?.trim() || null,
      custom_instructions?.trim() || null
    ]);

    console.log(`✅ Agente de ativação criado com sucesso: ${result.rows[0].id}`);

    sendSuccess(res, { agent: result.rows[0] }, 201);

  } catch (error) {
    console.error('❌ Erro ao criar agente de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. ATUALIZAR AGENTE DE ATIVAÇÃO
// ================================
const updateActivationAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      activation_type,
      personality,
      tone,
      language,
      initial_message,
      follow_up_message,
      custom_instructions,
      sector_id,
      is_active
    } = req.body;

    console.log(`📝 Atualizando agente de ativação ${id}`);

    // Verificar se o agente existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildActivationAgentSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM activation_agents
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Agente de ativação não encontrado');
    }

    // Verificar setor se fornecido
    if (sector_id) {
      const sectorCheck = await db.query(
        'SELECT id FROM sectors WHERE id = $1 AND account_id = $2',
        [sector_id, accountId]
      );

      if (sectorCheck.rows.length === 0) {
        throw new ValidationError('Setor inválido');
      }
    }

    // Construir query de atualização
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      if (!name || name.trim() === '') {
        throw new ValidationError('Nome do agente não pode ser vazio');
      }
      updates.push(`name = $${paramIndex}`);
      values.push(name.trim());
      paramIndex++;
    }

    if (description !== undefined) {
      updates.push(`description = $${paramIndex}`);
      values.push(description?.trim() || null);
      paramIndex++;
    }

    if (activation_type !== undefined) {
      if (!['email', 'whatsapp', 'linkedin'].includes(activation_type)) {
        throw new ValidationError('Tipo de ativação inválido');
      }
      updates.push(`activation_type = $${paramIndex}`);
      values.push(activation_type);
      paramIndex++;
    }

    if (personality !== undefined) {
      updates.push(`personality = $${paramIndex}`);
      values.push(personality?.trim() || null);
      paramIndex++;
    }

    if (tone !== undefined) {
      updates.push(`tone = $${paramIndex}`);
      values.push(tone);
      paramIndex++;
    }

    if (language !== undefined) {
      updates.push(`language = $${paramIndex}`);
      values.push(language);
      paramIndex++;
    }

    if (initial_message !== undefined) {
      updates.push(`initial_message = $${paramIndex}`);
      values.push(initial_message?.trim() || null);
      paramIndex++;
    }

    if (follow_up_message !== undefined) {
      updates.push(`follow_up_message = $${paramIndex}`);
      values.push(follow_up_message?.trim() || null);
      paramIndex++;
    }

    if (custom_instructions !== undefined) {
      updates.push(`custom_instructions = $${paramIndex}`);
      values.push(custom_instructions?.trim() || null);
      paramIndex++;
    }

    if (sector_id !== undefined) {
      updates.push(`sector_id = $${paramIndex}`);
      values.push(sector_id);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new ValidationError('Nenhum campo para atualizar');
    }

    // Adicionar updated_at
    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    // Adicionar ID e account_id aos valores
    values.push(id, accountId, userId);

    const updateQuery = `
      UPDATE activation_agents
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND account_id = $${paramIndex + 1} AND user_id = $${paramIndex + 2}
      RETURNING *
    `;

    const result = await db.query(updateQuery, values);

    console.log(`✅ Agente de ativação atualizado com sucesso`);

    sendSuccess(res, { agent: result.rows[0] });

  } catch (error) {
    console.error('❌ Erro ao atualizar agente de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. DELETAR AGENTE DE ATIVAÇÃO
// ================================
const deleteActivationAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    console.log(`🗑️ Deletando agente de ativação ${id}`);

    // Verificar se o agente existe e pertence ao usuário
    const { filter: sectorFilter, params: sectorParams } = await buildActivationAgentSectorFilter(userId, accountId, 4);

    const checkQuery = `
      SELECT * FROM activation_agents
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const checkResult = await db.query(checkQuery, [id, userId, accountId, ...sectorParams]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Agente de ativação não encontrado');
    }

    // Verificar se há campanhas usando este agente
    const campaignsCheck = await db.query(
      `SELECT COUNT(*) as count FROM activation_campaigns WHERE agent_id = $1`,
      [id]
    );

    if (parseInt(campaignsCheck.rows[0].count) > 0) {
      throw new ValidationError('Não é possível deletar agente vinculado a campanhas. Desative-o em vez de deletar.');
    }

    // Deletar agente
    await db.query(
      'DELETE FROM activation_agents WHERE id = $1 AND account_id = $2 AND user_id = $3',
      [id, accountId, userId]
    );

    console.log(`✅ Agente de ativação deletado com sucesso`);

    sendSuccess(res, { message: 'Agente de ativação deletado com sucesso' });

  } catch (error) {
    console.error('❌ Erro ao deletar agente de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 6. TESTAR AGENTE DE ATIVAÇÃO
// ================================
const testActivationAgent = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { test_message, contact_context } = req.body;

    console.log(`🧪 Testando agente de ativação ${id}`);

    // Verificar se o agente existe
    const { filter: sectorFilter, params: sectorParams } = await buildActivationAgentSectorFilter(userId, accountId, 4);

    const agentQuery = `
      SELECT * FROM activation_agents
      WHERE id = $1 AND account_id = $3 AND user_id = $2 ${sectorFilter}
    `;

    const agentResult = await db.query(agentQuery, [id, userId, accountId, ...sectorParams]);

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agente de ativação não encontrado');
    }

    const agent = agentResult.rows[0];

    // TODO: Integrar com serviço de IA para gerar resposta
    // Por enquanto, retornar mensagem de exemplo
    const mockResponse = {
      agent_id: agent.id,
      agent_name: agent.name,
      activation_type: agent.activation_type,
      initial_message: agent.initial_message || `Olá! Sou ${agent.name}, seu assistente de ${agent.activation_type}.`,
      follow_up_message: agent.follow_up_message || 'Fico feliz em continuar nossa conversa!',
      personality: agent.personality,
      tone: agent.tone,
      test_status: 'success',
      message: 'Teste realizado com sucesso. Em produção, este agente enviará mensagens personalizadas.'
    };

    console.log(`✅ Teste concluído com sucesso`);

    sendSuccess(res, { test_result: mockResponse });

  } catch (error) {
    console.error('❌ Erro ao testar agente de ativação:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// EXPORTS
// ================================
module.exports = {
  getActivationAgents,
  getActivationAgent,
  createActivationAgent,
  updateActivationAgent,
  deleteActivationAgent,
  testActivationAgent
};
