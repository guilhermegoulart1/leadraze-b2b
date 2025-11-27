const db = require('../config/database');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Get all website agents (admin)
 */
const getAgents = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT *
      FROM website_agents
      ORDER BY agent_key
    `);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching website agents:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agents'
    });
  }
};

/**
 * Get a specific agent (admin)
 */
const getAgent = async (req, res) => {
  try {
    const { agentKey } = req.params;

    const result = await db.query(`
      SELECT *
      FROM website_agents
      WHERE agent_key = $1
    `, [agentKey]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching website agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch agent'
    });
  }
};

/**
 * Update a website agent
 */
const updateAgent = async (req, res) => {
  try {
    const { agentKey } = req.params;
    const {
      name,
      avatar_url,
      welcome_message,
      personality,
      system_prompt,
      tone,
      response_length,
      language,
      is_active,
      config
    } = req.body;

    const result = await db.query(`
      UPDATE website_agents
      SET
        name = COALESCE($1, name),
        avatar_url = COALESCE($2, avatar_url),
        welcome_message = COALESCE($3, welcome_message),
        personality = COALESCE($4, personality),
        system_prompt = COALESCE($5, system_prompt),
        tone = COALESCE($6, tone),
        response_length = COALESCE($7, response_length),
        language = COALESCE($8, language),
        is_active = COALESCE($9, is_active),
        config = COALESCE($10, config),
        updated_at = CURRENT_TIMESTAMP
      WHERE agent_key = $11
      RETURNING *
    `, [
      name,
      avatar_url,
      welcome_message,
      personality,
      system_prompt,
      tone,
      response_length,
      language,
      is_active,
      config ? JSON.stringify(config) : null,
      agentKey
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating website agent:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update agent'
    });
  }
};

/**
 * Get knowledge base for website agents
 */
const getKnowledge = async (req, res) => {
  try {
    const { agentKey } = req.query;

    let query = `
      SELECT *
      FROM website_agent_knowledge
      WHERE is_active = true
    `;
    const params = [];

    if (agentKey) {
      query += ` AND (agent_key = $1 OR agent_key IS NULL)`;
      params.push(agentKey);
    }

    query += ` ORDER BY type, created_at DESC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch knowledge'
    });
  }
};

/**
 * Add knowledge item
 */
const addKnowledge = async (req, res) => {
  try {
    const { agent_key, type, question, answer, content, category, tags } = req.body;

    if (!type) {
      return res.status(400).json({
        success: false,
        message: 'type is required'
      });
    }

    // Generate embedding for semantic search
    let embedding = null;
    const textToEmbed = question || content || answer;

    if (textToEmbed) {
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: textToEmbed
        });
        embedding = `[${embeddingResponse.data[0].embedding.join(',')}]`;
      } catch (embError) {
        console.error('Error generating embedding:', embError);
      }
    }

    const result = await db.query(`
      INSERT INTO website_agent_knowledge (
        agent_key, type, question, answer, content, category, tags, embedding
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::vector)
      RETURNING *
    `, [
      agent_key || null,
      type,
      question || null,
      answer || null,
      content || null,
      category || null,
      tags || null,
      embedding
    ]);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to add knowledge'
    });
  }
};

/**
 * Update knowledge item
 */
const updateKnowledge = async (req, res) => {
  try {
    const { id } = req.params;
    const { agent_key, type, question, answer, content, category, tags, is_active } = req.body;

    // Regenerate embedding if content changed
    let embedding = null;
    const textToEmbed = question || content || answer;

    if (textToEmbed) {
      try {
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: textToEmbed
        });
        embedding = `[${embeddingResponse.data[0].embedding.join(',')}]`;
      } catch (embError) {
        console.error('Error generating embedding:', embError);
      }
    }

    const result = await db.query(`
      UPDATE website_agent_knowledge
      SET
        agent_key = COALESCE($1, agent_key),
        type = COALESCE($2, type),
        question = COALESCE($3, question),
        answer = COALESCE($4, answer),
        content = COALESCE($5, content),
        category = COALESCE($6, category),
        tags = COALESCE($7, tags),
        is_active = COALESCE($8, is_active),
        embedding = COALESCE($9::vector, embedding),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $10
      RETURNING *
    `, [
      agent_key,
      type,
      question,
      answer,
      content,
      category,
      tags,
      is_active,
      embedding,
      id
    ]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge item not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update knowledge'
    });
  }
};

/**
 * Delete knowledge item
 */
const deleteKnowledge = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      DELETE FROM website_agent_knowledge
      WHERE id = $1
      RETURNING id
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Knowledge item not found'
      });
    }

    res.json({
      success: true,
      message: 'Knowledge item deleted'
    });
  } catch (error) {
    console.error('Error deleting knowledge:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete knowledge'
    });
  }
};

/**
 * Get chat sessions/conversations
 */
const getConversations = async (req, res) => {
  try {
    const { agentKey, limit = 50, offset = 0, escalatedOnly } = req.query;

    let query = `
      SELECT
        id,
        agent_key,
        session_id,
        messages,
        visitor_info,
        started_at,
        last_message_at,
        message_count,
        escalated,
        escalated_at,
        contact_form_data
      FROM website_chat_sessions
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;

    if (agentKey) {
      query += ` AND agent_key = $${paramIndex++}`;
      params.push(agentKey);
    }

    if (escalatedOnly === 'true') {
      query += ` AND escalated = true`;
    }

    query += ` ORDER BY last_message_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex++}`;
    params.push(parseInt(limit), parseInt(offset));

    const result = await db.query(query, params);

    // Get total count
    let countQuery = `SELECT COUNT(*) FROM website_chat_sessions WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;

    if (agentKey) {
      countQuery += ` AND agent_key = $${countParamIndex++}`;
      countParams.push(agentKey);
    }

    if (escalatedOnly === 'true') {
      countQuery += ` AND escalated = true`;
    }

    const countResult = await db.query(countQuery, countParams);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        total: parseInt(countResult.rows[0].count),
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });
  } catch (error) {
    console.error('Error fetching conversations:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversations'
    });
  }
};

/**
 * Get single conversation
 */
const getConversation = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.query(`
      SELECT *
      FROM website_chat_sessions
      WHERE id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching conversation:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch conversation'
    });
  }
};

/**
 * Get statistics
 */
const getStats = async (req, res) => {
  try {
    const { days = 30 } = req.query;

    const stats = await db.query(`
      SELECT
        COUNT(*) as total_conversations,
        COUNT(CASE WHEN escalated = true THEN 1 END) as escalated_conversations,
        SUM(message_count) as total_messages,
        AVG(message_count) as avg_messages_per_conversation,
        COUNT(CASE WHEN started_at > NOW() - INTERVAL '24 hours' THEN 1 END) as conversations_today,
        COUNT(CASE WHEN started_at > NOW() - INTERVAL '7 days' THEN 1 END) as conversations_week
      FROM website_chat_sessions
      WHERE started_at > NOW() - INTERVAL '${parseInt(days)} days'
    `);

    const byAgent = await db.query(`
      SELECT
        agent_key,
        COUNT(*) as conversations,
        SUM(message_count) as messages,
        COUNT(CASE WHEN escalated = true THEN 1 END) as escalated
      FROM website_chat_sessions
      WHERE started_at > NOW() - INTERVAL '${parseInt(days)} days'
      GROUP BY agent_key
    `);

    res.json({
      success: true,
      data: {
        overview: stats.rows[0],
        byAgent: byAgent.rows
      }
    });
  } catch (error) {
    console.error('Error fetching stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch stats'
    });
  }
};

module.exports = {
  getAgents,
  getAgent,
  updateAgent,
  getKnowledge,
  addKnowledge,
  updateKnowledge,
  deleteKnowledge,
  getConversations,
  getConversation,
  getStats
};
