// backend/src/controllers/secretAgentController.js
// Controller for Secret Agent Intelligence System - GetRaze

const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ValidationError } = require('../utils/errors');
const { queueInvestigation } = require('../workers/secretAgentWorker');

// Intelligence team agents
const INTELLIGENCE_TEAM = [
  {
    id: 'marcus_chen',
    name: 'Marcus Chen',
    role: 'Analista de Dados',
    description: 'Coleta dados oficiais: CNPJ, registros governamentais, estrutura societária',
    apis: ['receitaws', 'opencorporates', 'whois']
  },
  {
    id: 'sarah_mitchell',
    name: 'Sarah Mitchell',
    role: 'Analista de Pessoas',
    description: 'Investiga perfis: LinkedIn, cargos, histórico profissional, decisores',
    apis: ['exa', 'unipile']
  },
  {
    id: 'james_rodriguez',
    name: 'James Rodriguez',
    role: 'Analista de Conexões',
    description: 'Mapeia relacionamentos: quem conhece quem, conexões em comum',
    apis: ['exa', 'unipile']
  },
  {
    id: 'elena_volkov',
    name: 'Elena Volkov',
    role: 'Analista de Mercado',
    description: 'Analisa cenário: concorrentes, tendências, oportunidades',
    apis: ['exa', 'tavily', 'serpapi']
  },
  {
    id: 'david_park',
    name: 'David Park',
    role: 'Analista de Mídia',
    description: 'Monitora reputação: notícias, menções, redes sociais',
    apis: ['tavily', 'serpapi']
  },
  {
    id: 'director_morgan',
    name: 'Director Morgan',
    role: 'Diretor de Operações',
    description: 'Coordena a equipe, compila relatórios, monta estratégia final',
    apis: ['openai']
  }
];

// ==========================================
// SESSIONS
// ==========================================

/**
 * Create a new secret agent session
 */
const createSession = async (req, res) => {
  try {
    const { accountId, userId } = req.user;

    const result = await db.query(
      `INSERT INTO secret_agent_sessions (account_id, user_id, status, messages)
       VALUES ($1, $2, 'chat', '[]')
       RETURNING *`,
      [accountId, userId]
    );

    sendSuccess(res, result.rows[0], 201);
  } catch (error) {
    console.error('Error creating session:', error);
    sendError(res, error.message);
  }
};

/**
 * Get all sessions for the current user
 */
const getSessions = async (req, res) => {
  try {
    const { accountId, userId } = req.user;
    const { status, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT s.*,
        (SELECT COUNT(*) FROM secret_agent_investigations i WHERE i.session_id = s.id) as investigations_count
      FROM secret_agent_sessions s
      WHERE s.account_id = $1 AND s.user_id = $2
    `;
    const params = [accountId, userId];
    let paramIndex = 3;

    if (status) {
      query += ` AND s.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY s.updated_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    sendSuccess(res, result.rows);
  } catch (error) {
    console.error('Error getting sessions:', error);
    sendError(res, error.message);
  }
};

/**
 * Get a single session by ID
 */
const getSession = async (req, res) => {
  try {
    const { accountId, userId } = req.user;
    const { id } = req.params;

    const result = await db.query(
      `SELECT s.*,
        (SELECT json_agg(inv ORDER BY inv.created_at DESC)
         FROM secret_agent_investigations inv
         WHERE inv.session_id = s.id) as investigations
       FROM secret_agent_sessions s
       WHERE s.id = $1 AND s.account_id = $2 AND s.user_id = $3`,
      [id, accountId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Session not found');
    }

    sendSuccess(res, result.rows[0]);
  } catch (error) {
    console.error('Error getting session:', error);
    sendError(res, error.message);
  }
};

/**
 * Send a message to the secret agent chat
 */
const sendMessage = async (req, res) => {
  try {
    const { accountId, userId } = req.user;
    const { id } = req.params;
    const { message, attachments } = req.body;

    if (!message || message.trim().length === 0) {
      throw new ValidationError('Message is required');
    }

    // Get current session
    const sessionResult = await db.query(
      `SELECT * FROM secret_agent_sessions
       WHERE id = $1 AND account_id = $2 AND user_id = $3`,
      [id, accountId, userId]
    );

    if (sessionResult.rows.length === 0) {
      throw new NotFoundError('Session not found');
    }

    const session = sessionResult.rows[0];
    const messages = session.messages || [];

    // Add user message
    const userMessage = {
      role: 'user',
      content: message,
      attachments: attachments || null,
      timestamp: new Date().toISOString()
    };
    messages.push(userMessage);

    // TODO: Process message with AI conversation service
    // For now, return a placeholder response
    const agentResponse = {
      role: 'assistant',
      content: 'Olá! Sou o Agente Secreto da GetRaze. Estou pronto para iniciar uma investigação. O que você gostaria de pesquisar?\n\n🏢 **Empresa** - Descubra tudo sobre uma empresa\n👤 **Pessoa** - Investigue uma pessoa ou profissional\n📊 **Nicho** - Analise um mercado ou segmento\n🔗 **Conexão** - Encontre caminhos para se conectar com alguém',
      timestamp: new Date().toISOString()
    };
    messages.push(agentResponse);

    // Update session
    await db.query(
      `UPDATE secret_agent_sessions
       SET messages = $1, updated_at = NOW()
       WHERE id = $2`,
      [JSON.stringify(messages), id]
    );

    sendSuccess(res, {
      userMessage,
      agentResponse,
      sessionId: id
    });
  } catch (error) {
    console.error('Error sending message:', error);
    sendError(res, error.message);
  }
};

/**
 * Start a research investigation
 */
const startInvestigation = async (req, res) => {
  try {
    const { accountId, userId } = req.user;
    const { id } = req.params;
    const { targetName, targetType, objective, targetDetails } = req.body;

    if (!targetName || !targetType) {
      throw new ValidationError('Target name and type are required');
    }

    const validTypes = ['company', 'person', 'niche', 'connection'];
    if (!validTypes.includes(targetType)) {
      throw new ValidationError(`Invalid target type. Must be one of: ${validTypes.join(', ')}`);
    }

    // Verify session exists and belongs to user
    const sessionResult = await db.query(
      `SELECT * FROM secret_agent_sessions
       WHERE id = $1 AND account_id = $2 AND user_id = $3`,
      [id, accountId, userId]
    );

    if (sessionResult.rows.length === 0) {
      throw new NotFoundError('Session not found');
    }

    // Generate case number
    const caseNumberResult = await db.query('SELECT generate_case_number() as case_number');
    const caseNumber = caseNumberResult.rows[0].case_number;

    // Create investigation
    const investigationResult = await db.query(
      `INSERT INTO secret_agent_investigations
        (session_id, account_id, case_number, target_name, target_type, objective, status, progress)
       VALUES ($1, $2, $3, $4, $5, $6, 'queued', 0)
       RETURNING *`,
      [id, accountId, caseNumber, targetName, targetType, objective || null]
    );

    const investigation = investigationResult.rows[0];

    // Create agent reports (pending status)
    for (const agent of INTELLIGENCE_TEAM) {
      await db.query(
        `INSERT INTO secret_agent_reports
          (investigation_id, agent_id, agent_name, agent_role, status, progress)
         VALUES ($1, $2, $3, $4, 'pending', 0)`,
        [investigation.id, agent.id, agent.name, agent.role]
      );
    }

    // Update session status
    await db.query(
      `UPDATE secret_agent_sessions
       SET status = 'investigating',
           research_type = $1,
           target_name = $2,
           target_details = $3,
           objective = $4,
           investigation_started_at = NOW()
       WHERE id = $5`,
      [targetType, targetName, JSON.stringify(targetDetails || {}), objective, id]
    );

    // Add job to secret agent queue for async processing
    const queueResult = await queueInvestigation(investigation.id, id, accountId);

    sendSuccess(res, {
      investigation,
      caseNumber,
      agents: INTELLIGENCE_TEAM,
      queuePosition: queueResult.queuePosition,
      estimatedMinutes: queueResult.estimatedMinutes,
      message: 'Investigation queued successfully. The intelligence team is now working on your request.'
    }, 201);
  } catch (error) {
    console.error('Error starting investigation:', error);
    sendError(res, error.message);
  }
};

// ==========================================
// INVESTIGATIONS
// ==========================================

/**
 * Get investigation status with agent reports
 */
const getInvestigation = async (req, res) => {
  try {
    const { accountId } = req.user;
    const { id } = req.params;

    const result = await db.query(
      `SELECT i.*,
        (SELECT json_agg(r ORDER BY
          CASE r.agent_id
            WHEN 'marcus_chen' THEN 1
            WHEN 'sarah_mitchell' THEN 2
            WHEN 'james_rodriguez' THEN 3
            WHEN 'elena_volkov' THEN 4
            WHEN 'david_park' THEN 5
            WHEN 'director_morgan' THEN 6
          END
        )
         FROM secret_agent_reports r
         WHERE r.investigation_id = i.id) as agent_reports
       FROM secret_agent_investigations i
       WHERE i.id = $1 AND i.account_id = $2`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Investigation not found');
    }

    sendSuccess(res, result.rows[0]);
  } catch (error) {
    console.error('Error getting investigation:', error);
    sendError(res, error.message);
  }
};

/**
 * Get all investigations for the account
 */
const getInvestigations = async (req, res) => {
  try {
    const { accountId } = req.user;
    const { status, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT i.*,
        (SELECT COUNT(*) FILTER (WHERE r.status = 'completed')
         FROM secret_agent_reports r WHERE r.investigation_id = i.id) as completed_agents,
        (SELECT COUNT(*) FROM secret_agent_reports r WHERE r.investigation_id = i.id) as total_agents
      FROM secret_agent_investigations i
      WHERE i.account_id = $1
    `;
    const params = [accountId];
    let paramIndex = 2;

    if (status) {
      query += ` AND i.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    query += ` ORDER BY i.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    sendSuccess(res, result.rows);
  } catch (error) {
    console.error('Error getting investigations:', error);
    sendError(res, error.message);
  }
};

// ==========================================
// BRIEFINGS
// ==========================================

/**
 * Get all briefings
 */
const getBriefings = async (req, res) => {
  try {
    const { accountId } = req.user;
    const { search, classification, researchType, limit = 20, offset = 0 } = req.query;

    let query = `
      SELECT b.id, b.title, b.case_number, b.classification, b.research_type,
             b.target_name, b.executive_summary, b.sources_consulted, b.total_findings,
             b.duration_seconds, b.tags, b.created_at,
             u.name as created_by_name
      FROM secret_agent_briefings b
      LEFT JOIN users u ON b.created_by = u.id
      WHERE b.account_id = $1
    `;
    const params = [accountId];
    let paramIndex = 2;

    if (search) {
      query += ` AND b.search_vector @@ plainto_tsquery('portuguese', $${paramIndex})`;
      params.push(search);
      paramIndex++;
    }

    if (classification) {
      query += ` AND b.classification = $${paramIndex}`;
      params.push(classification);
      paramIndex++;
    }

    if (researchType) {
      query += ` AND b.research_type = $${paramIndex}`;
      params.push(researchType);
      paramIndex++;
    }

    query += ` ORDER BY b.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);
    sendSuccess(res, result.rows);
  } catch (error) {
    console.error('Error getting briefings:', error);
    sendError(res, error.message);
  }
};

/**
 * Get a single briefing by ID
 */
const getBriefing = async (req, res) => {
  try {
    const { accountId } = req.user;
    const { id } = req.params;

    const result = await db.query(
      `SELECT b.*,
        u.name as created_by_name,
        (SELECT json_agg(c) FROM contacts c WHERE c.id = ANY(b.linked_lead_ids)) as linked_leads
       FROM secret_agent_briefings b
       LEFT JOIN users u ON b.created_by = u.id
       WHERE b.id = $1 AND b.account_id = $2`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Briefing not found');
    }

    sendSuccess(res, result.rows[0]);
  } catch (error) {
    console.error('Error getting briefing:', error);
    sendError(res, error.message);
  }
};

/**
 * Link a briefing to a contact
 */
const linkBriefingToContact = async (req, res) => {
  try {
    const { accountId } = req.user;
    const { id } = req.params;
    const { contactId } = req.body;

    if (!contactId) {
      throw new ValidationError('Contact ID is required');
    }

    // Verify briefing exists
    const briefingResult = await db.query(
      `SELECT * FROM secret_agent_briefings WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (briefingResult.rows.length === 0) {
      throw new NotFoundError('Briefing not found');
    }

    // Add contact to linked_lead_ids array (column name kept for compatibility)
    const result = await db.query(
      `UPDATE secret_agent_briefings
       SET linked_lead_ids = array_append(
         COALESCE(linked_lead_ids, '{}'),
         $1::uuid
       )
       WHERE id = $2 AND NOT ($1::uuid = ANY(COALESCE(linked_lead_ids, '{}')))
       RETURNING *`,
      [contactId, id]
    );

    sendSuccess(res, result.rows[0]);
  } catch (error) {
    console.error('Error linking briefing to contact:', error);
    sendError(res, error.message);
  }
};

/**
 * Unlink a briefing from a contact
 */
const unlinkBriefingFromContact = async (req, res) => {
  try {
    const { accountId } = req.user;
    const { id, contactId } = req.params;

    const result = await db.query(
      `UPDATE secret_agent_briefings
       SET linked_lead_ids = array_remove(linked_lead_ids, $1::uuid)
       WHERE id = $2 AND account_id = $3
       RETURNING *`,
      [contactId, id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Briefing not found');
    }

    sendSuccess(res, result.rows[0]);
  } catch (error) {
    console.error('Error unlinking briefing from lead:', error);
    sendError(res, error.message);
  }
};

/**
 * Get intelligence team info
 */
const getIntelligenceTeam = async (req, res) => {
  sendSuccess(res, INTELLIGENCE_TEAM);
};

/**
 * Delete a session
 */
const deleteSession = async (req, res) => {
  try {
    const { accountId, userId } = req.user;
    const { id } = req.params;

    const result = await db.query(
      `DELETE FROM secret_agent_sessions
       WHERE id = $1 AND account_id = $2 AND user_id = $3
       RETURNING id`,
      [id, accountId, userId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Session not found');
    }

    sendSuccess(res, { deleted: true, id });
  } catch (error) {
    console.error('Error deleting session:', error);
    sendError(res, error.message);
  }
};

/**
 * Deep Analysis - Use Gemini for detailed analysis of briefing data
 * POST /api/secret-agent/briefings/:id/deep-analysis
 */
const deepAnalysisBriefing = async (req, res) => {
  try {
    const { id } = req.params;
    const { analysisType = 'general' } = req.body;
    const accountId = req.user.accountId;

    // Get briefing with all data
    const result = await db.query(
      `SELECT b.*,
              s.target_details
       FROM secret_agent_briefings b
       LEFT JOIN secret_agent_sessions s ON b.session_id = s.id
       WHERE b.id = $1 AND b.account_id = $2`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Briefing not found');
    }

    const briefing = result.rows[0];

    // Get all raw data from agent reports for this briefing
    const reportsResult = await db.query(
      `SELECT r.agent_id, r.agent_name, r.report_data, r.findings
       FROM secret_agent_reports r
       JOIN secret_agent_investigations i ON r.investigation_id = i.id
       JOIN secret_agent_sessions s ON i.session_id = s.id
       WHERE s.briefing_id = $1`,
      [id]
    );

    // Compile raw data for Gemini analysis
    const rawData = {
      target: briefing.target_name,
      type: briefing.research_type,
      targetDetails: briefing.target_details,
      agentReports: reportsResult.rows.map(r => ({
        agent: r.agent_name,
        data: r.report_data,
        findings: r.findings
      }))
    };

    // Use orchestrator's deep analysis with Gemini
    const { orchestratorService } = require('../services/secretAgent/orchestratorService');
    const analysis = await orchestratorService.deepAnalysis(
      briefing.target_name,
      rawData,
      analysisType
    );

    if (analysis.error) {
      return sendError(res, analysis.error);
    }

    sendSuccess(res, {
      briefingId: id,
      analysisType,
      analysis: analysis.analysis,
      generatedAt: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error in deep analysis:', error);
    sendError(res, error.message);
  }
};

/**
 * Delete a briefing
 * Also deletes related investigation, session, and agent reports
 */
const deleteBriefing = async (req, res) => {
  try {
    const { accountId } = req.user;
    const { id } = req.params;

    // First verify the briefing exists and belongs to the account
    const briefingResult = await db.query(
      `SELECT b.*, b.investigation_id, b.session_id
       FROM secret_agent_briefings b
       WHERE b.id = $1 AND b.account_id = $2`,
      [id, accountId]
    );

    if (briefingResult.rows.length === 0) {
      throw new NotFoundError('Briefing not found');
    }

    const briefing = briefingResult.rows[0];

    // Delete in order due to foreign key constraints:
    // 1. Delete agent reports (if investigation exists)
    if (briefing.investigation_id) {
      await db.query(
        `DELETE FROM secret_agent_reports WHERE investigation_id = $1`,
        [briefing.investigation_id]
      );
    }

    // 2. Delete the briefing
    await db.query(
      `DELETE FROM secret_agent_briefings WHERE id = $1`,
      [id]
    );

    // 3. Delete investigation (if exists)
    if (briefing.investigation_id) {
      await db.query(
        `DELETE FROM secret_agent_investigations WHERE id = $1`,
        [briefing.investigation_id]
      );
    }

    // 4. Delete session (if exists and not used by other investigations)
    if (briefing.session_id) {
      // Check if session has other investigations
      const otherInvestigations = await db.query(
        `SELECT COUNT(*) as count FROM secret_agent_investigations WHERE session_id = $1`,
        [briefing.session_id]
      );

      if (parseInt(otherInvestigations.rows[0].count) === 0) {
        await db.query(
          `DELETE FROM secret_agent_sessions WHERE id = $1`,
          [briefing.session_id]
        );
      }
    }

    sendSuccess(res, {
      deleted: true,
      id,
      case_number: briefing.case_number,
      target_name: briefing.target_name
    });
  } catch (error) {
    console.error('Error deleting briefing:', error);
    sendError(res, error.message);
  }
};

module.exports = {
  // Sessions
  createSession,
  getSessions,
  getSession,
  sendMessage,
  startInvestigation,
  deleteSession,

  // Investigations
  getInvestigation,
  getInvestigations,

  // Briefings
  getBriefings,
  getBriefing,
  linkBriefingToContact,
  unlinkBriefingFromContact,
  deepAnalysisBriefing,
  deleteBriefing,

  // Team
  getIntelligenceTeam,

  // Export team for other modules
  INTELLIGENCE_TEAM
};
