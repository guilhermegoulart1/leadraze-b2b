// backend/src/controllers/connectionCampaignController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { startConnectionCampaign, cancelConnectionCampaign } = require('../workers/connectionMessageWorker');

// ================================
// 1. CRIAR CAMPANHA DE ATIVAÇÃO DE CONEXÕES
// ================================
const createConnectionCampaign = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const {
      name,
      description,
      linkedin_account_id,
      linkedin_agent_id,
      connections, // Array de provider_ids das conexões selecionadas
      daily_limit = 100
    } = req.body;

    console.log(`➕ [ConnectionCampaign] Criando campanha: ${name}`);
    console.log(`   Conexões selecionadas: ${connections?.length || 0}`);

    // Validações
    if (!name || name.trim() === '') {
      throw new ValidationError('Nome da campanha é obrigatório');
    }

    if (!linkedin_account_id) {
      throw new ValidationError('Conta LinkedIn é obrigatória');
    }

    if (!linkedin_agent_id) {
      throw new ValidationError('Agente de ativação é obrigatório');
    }

    if (!connections || !Array.isArray(connections) || connections.length === 0) {
      throw new ValidationError('Selecione pelo menos uma conexão para ativar');
    }

    if (daily_limit < 1 || daily_limit > 500) {
      throw new ValidationError('Limite diário deve estar entre 1 e 500');
    }

    // Verificar conta LinkedIn
    const linkedinResult = await db.query(
      `SELECT id, unipile_account_id, profile_name FROM linkedin_accounts
       WHERE id = $1 AND account_id = $2`,
      [linkedin_account_id, accountId]
    );

    if (linkedinResult.rows.length === 0) {
      throw new NotFoundError('Conta LinkedIn não encontrada');
    }

    // Verificar agente
    const agentResult = await db.query(
      `SELECT id, name, activation_type FROM activation_agents
       WHERE id = $1 AND account_id = $2 AND user_id = $3 AND activation_type = 'linkedin'`,
      [linkedin_agent_id, accountId, userId]
    );

    if (agentResult.rows.length === 0) {
      throw new NotFoundError('Agente de ativação não encontrado');
    }

    // Verificar limite diário do usuário
    const userResult = await db.query(
      `SELECT
        COALESCE(daily_connection_activation_limit, 100) as daily_limit,
        COALESCE(today_connection_activations, 0) as today_sent
      FROM users WHERE id = $1`,
      [userId]
    );

    const userLimits = userResult.rows[0];
    const remaining = userLimits.daily_limit - userLimits.today_sent;

    if (connections.length > remaining) {
      throw new ValidationError(
        `Você só pode ativar mais ${remaining} conexões hoje. ` +
        `Selecione menos conexões ou aumente seu limite diário nas configurações.`
      );
    }

    // Criar lista de contatos temporária
    const listResult = await db.query(
      `INSERT INTO contact_lists (
        account_id, user_id, name, description, list_type, total_contacts
      ) VALUES ($1, $2, $3, $4, 'linkedin', $5)
      RETURNING *`,
      [
        accountId,
        userId,
        `Conexões - ${name}`,
        `Lista gerada automaticamente para campanha: ${name}`,
        connections.length
      ]
    );

    const list = listResult.rows[0];

    // Inserir conexões na lista
    for (const connection of connections) {
      await db.query(
        `INSERT INTO contact_list_items (
          list_id, linkedin_url, name, company, position
        ) VALUES ($1, $2, $3, $4, $5)`,
        [
          list.id,
          connection.provider_id, // Usando linkedin_url para guardar o provider_id
          connection.name,
          connection.company,
          connection.title
        ]
      );

      // Se a conexão tiver um contact_id (já está no CRM), vincular
      if (connection.contact_id) {
        await db.query(
          `UPDATE contact_list_items SET contact_id = $1
           WHERE list_id = $2 AND linkedin_url = $3`,
          [connection.contact_id, list.id, connection.provider_id]
        );
      }
    }

    // Criar campanha
    const campaignResult = await db.query(
      `INSERT INTO activation_campaigns (
        account_id, user_id, name, description,
        list_id, linkedin_agent_id,
        activate_linkedin, daily_limit,
        linkedin_account_id, status, total_contacts,
        campaign_type
      ) VALUES ($1, $2, $3, $4, $5, $6, true, $7, $8, 'active', $9, 'connections')
      RETURNING *`,
      [
        accountId,
        userId,
        name.trim(),
        description?.trim() || null,
        list.id,
        linkedin_agent_id,
        Math.min(daily_limit, connections.length),
        linkedin_account_id,
        connections.length
      ]
    );

    const campaign = campaignResult.rows[0];

    // Criar registros de contatos da campanha
    const listItems = await db.query(
      `SELECT id, linkedin_url, contact_id FROM contact_list_items WHERE list_id = $1`,
      [list.id]
    );

    for (const item of listItems.rows) {
      await db.query(
        `INSERT INTO activation_campaign_contacts (
          campaign_id, list_item_id, contact_id, status
        ) VALUES ($1, $2, $3, 'pending')`,
        [campaign.id, item.id, item.contact_id]
      );
    }

    // Iniciar worker de envio de mensagens
    console.log(`🚀 [ConnectionCampaign] Iniciando worker...`);

    try {
      const workerResult = await startConnectionCampaign(campaign.id, {
        dailyLimit: campaign.daily_limit
      });

      console.log(`✅ [ConnectionCampaign] ${workerResult.scheduled} mensagens agendadas`);

      sendSuccess(res, {
        campaign: {
          ...campaign,
          list_name: list.name
        },
        scheduled: workerResult.scheduled,
        message: `Campanha criada! ${workerResult.scheduled} mensagens serão enviadas ao longo do dia.`
      }, 201);

    } catch (workerError) {
      console.error('⚠️ [ConnectionCampaign] Erro no worker:', workerError);

      // Campanha foi criada mas worker falhou
      sendSuccess(res, {
        campaign: {
          ...campaign,
          list_name: list.name
        },
        scheduled: 0,
        warning: 'Campanha criada, mas houve um erro ao agendar as mensagens. Tente iniciar manualmente.'
      }, 201);
    }

  } catch (error) {
    console.error('❌ [ConnectionCampaign] Erro:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 2. LISTAR CAMPANHAS DE CONEXÕES
// ================================
const getConnectionCampaigns = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { status, page = 1, limit = 20 } = req.query;

    let whereConditions = [
      'ac.account_id = $1',
      'ac.user_id = $2',
      "ac.campaign_type = 'connections'"
    ];
    let queryParams = [accountId, userId];
    let paramIndex = 3;

    if (status) {
      whereConditions.push(`ac.status = $${paramIndex}`);
      queryParams.push(status);
      paramIndex++;
    }

    const offset = (page - 1) * limit;

    const query = `
      SELECT
        ac.*,
        cl.name as list_name,
        aa.name as agent_name,
        la.profile_name as linkedin_account_name
      FROM activation_campaigns ac
      LEFT JOIN contact_lists cl ON ac.list_id = cl.id
      LEFT JOIN activation_agents aa ON ac.linkedin_agent_id = aa.id
      LEFT JOIN linkedin_accounts la ON ac.linkedin_account_id = la.id
      WHERE ${whereConditions.join(' AND ')}
      ORDER BY ac.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const result = await db.query(query, queryParams);

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) FROM activation_campaigns ac
       WHERE ${whereConditions.join(' AND ')}`,
      queryParams.slice(0, -2)
    );

    sendSuccess(res, {
      campaigns: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / limit)
      }
    });

  } catch (error) {
    console.error('❌ [ConnectionCampaign] Erro ao listar:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 3. PAUSAR CAMPANHA
// ================================
const pauseConnectionCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Verificar campanha
    const checkResult = await db.query(
      `SELECT * FROM activation_campaigns
       WHERE id = $1 AND account_id = $2 AND user_id = $3 AND campaign_type = 'connections'`,
      [id, accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    if (checkResult.rows[0].status !== 'active') {
      throw new ValidationError('Apenas campanhas ativas podem ser pausadas');
    }

    // Pausar
    await db.query(
      `UPDATE activation_campaigns SET status = 'paused', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Cancelar jobs pendentes
    await cancelConnectionCampaign(id);

    sendSuccess(res, { message: 'Campanha pausada com sucesso' });

  } catch (error) {
    console.error('❌ [ConnectionCampaign] Erro ao pausar:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 4. RETOMAR CAMPANHA
// ================================
const resumeConnectionCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    const checkResult = await db.query(
      `SELECT * FROM activation_campaigns
       WHERE id = $1 AND account_id = $2 AND user_id = $3 AND campaign_type = 'connections'`,
      [id, accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    if (checkResult.rows[0].status !== 'paused') {
      throw new ValidationError('Apenas campanhas pausadas podem ser retomadas');
    }

    // Retomar
    await db.query(
      `UPDATE activation_campaigns SET status = 'active', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );

    // Reiniciar worker
    const result = await startConnectionCampaign(id, {
      dailyLimit: checkResult.rows[0].daily_limit
    });

    sendSuccess(res, {
      message: 'Campanha retomada com sucesso',
      scheduled: result.scheduled
    });

  } catch (error) {
    console.error('❌ [ConnectionCampaign] Erro ao retomar:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// 5. PARAR CAMPANHA
// ================================
const stopConnectionCampaign = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    const checkResult = await db.query(
      `SELECT * FROM activation_campaigns
       WHERE id = $1 AND account_id = $2 AND user_id = $3 AND campaign_type = 'connections'`,
      [id, accountId, userId]
    );

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Campanha não encontrada');
    }

    // Parar
    await db.query(
      `UPDATE activation_campaigns
       SET status = 'stopped', end_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id]
    );

    // Cancelar jobs
    await cancelConnectionCampaign(id);

    sendSuccess(res, { message: 'Campanha parada com sucesso' });

  } catch (error) {
    console.error('❌ [ConnectionCampaign] Erro ao parar:', error);
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  createConnectionCampaign,
  getConnectionCampaigns,
  pauseConnectionCampaign,
  resumeConnectionCampaign,
  stopConnectionCampaign
};
