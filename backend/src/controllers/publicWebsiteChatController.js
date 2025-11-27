const db = require('../config/database');
const OpenAI = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

/**
 * Get active website agents (public info only)
 */
const getAgents = async (req, res) => {
  try {
    const result = await db.query(`
      SELECT
        agent_key,
        name,
        avatar_url,
        welcome_message,
        tone,
        language
      FROM website_agents
      WHERE is_active = true
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
 * Get a specific agent's public config
 */
const getAgent = async (req, res) => {
  try {
    const { agentKey } = req.params;

    const result = await db.query(`
      SELECT
        agent_key,
        name,
        avatar_url,
        welcome_message,
        tone,
        language
      FROM website_agents
      WHERE agent_key = $1 AND is_active = true
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
 * Search knowledge base for relevant context
 */
const searchKnowledge = async (agentKey, query, limit = 5) => {
  try {
    // Generate embedding for the query
    const embeddingResponse = await openai.embeddings.create({
      model: 'text-embedding-3-small',
      input: query
    });

    const queryEmbedding = embeddingResponse.data[0].embedding;
    const embeddingStr = `[${queryEmbedding.join(',')}]`;

    // Search using the function we created
    const result = await db.query(`
      SELECT * FROM search_website_knowledge($1, $2::vector, $3)
      WHERE similarity > 0.7
    `, [agentKey, embeddingStr, limit]);

    return result.rows;
  } catch (error) {
    console.error('Error searching knowledge base:', error);
    return [];
  }
};

/**
 * Format knowledge base results for the AI prompt
 */
const formatKnowledgeContext = (knowledge) => {
  if (!knowledge || knowledge.length === 0) return '';

  let context = '\n\n---\nRelevant information from knowledge base:\n';

  knowledge.forEach((item, index) => {
    if (item.type === 'faq') {
      context += `\nQ: ${item.question}\nA: ${item.answer}\n`;
    } else {
      context += `\n${item.category || item.type}: ${item.content || item.answer}\n`;
    }
  });

  context += '---\n';
  return context;
};

/**
 * Handle chat message and generate AI response
 */
const chat = async (req, res) => {
  try {
    const { agentKey, sessionId, message, history = [] } = req.body;

    if (!agentKey || !sessionId || !message) {
      return res.status(400).json({
        success: false,
        message: 'agentKey, sessionId, and message are required'
      });
    }

    // Get agent configuration
    const agentResult = await db.query(`
      SELECT * FROM website_agents
      WHERE agent_key = $1 AND is_active = true
    `, [agentKey]);

    if (agentResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Agent not found'
      });
    }

    const agent = agentResult.rows[0];

    // Search knowledge base for relevant context
    const knowledge = await searchKnowledge(agentKey, message);
    const knowledgeContext = formatKnowledgeContext(knowledge);

    // Build messages array for OpenAI
    const messages = [
      {
        role: 'system',
        content: `${agent.system_prompt}

Personality: ${agent.personality}
Tone: ${agent.tone}
Language: Respond in ${agent.language === 'en' ? 'English' : agent.language === 'pt-br' ? 'Portuguese (Brazil)' : 'Spanish'}
Response length: ${agent.response_length} (keep responses concise but helpful)
${knowledgeContext}

If you cannot answer a question or the user needs human assistance, suggest they fill out the contact form for personalized help.`
      }
    ];

    // Add conversation history
    history.forEach(msg => {
      messages.push({
        role: msg.role === 'user' ? 'user' : 'assistant',
        content: msg.content
      });
    });

    // Add current message
    messages.push({
      role: 'user',
      content: message
    });

    // Generate response using OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
      max_tokens: 500,
      temperature: 0.7
    });

    const response = completion.choices[0].message.content;

    // Get visitor info from request
    const visitorInfo = {
      ip: req.headers['x-forwarded-for']?.split(',')[0] || req.ip,
      userAgent: req.headers['user-agent'],
      referrer: req.headers['referer']
    };

    // Update or create session
    const updatedMessages = [
      ...history,
      { role: 'user', content: message, timestamp: new Date().toISOString() },
      { role: 'assistant', content: response, timestamp: new Date().toISOString() }
    ];

    await db.query(`
      INSERT INTO website_chat_sessions (
        agent_key, session_id, messages, visitor_info, visitor_ip, visitor_referrer, message_count, last_message_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)
      ON CONFLICT (session_id) DO UPDATE SET
        messages = $3,
        message_count = website_chat_sessions.message_count + 2,
        last_message_at = CURRENT_TIMESTAMP
    `, [
      agentKey,
      sessionId,
      JSON.stringify(updatedMessages),
      JSON.stringify(visitorInfo),
      visitorInfo.ip,
      visitorInfo.referrer,
      updatedMessages.length
    ]);

    res.json({
      success: true,
      data: {
        message: response,
        sessionId
      }
    });
  } catch (error) {
    console.error('Error in website chat:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate response'
    });
  }
};

/**
 * Submit contact form (escalation)
 */
const submitContact = async (req, res) => {
  try {
    const { sessionId, agentKey, name, email, company, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: 'name, email, and message are required'
      });
    }

    const contactData = {
      name,
      email,
      company: company || null,
      message,
      submittedAt: new Date().toISOString()
    };

    // Update session if exists, or create a new record
    if (sessionId) {
      await db.query(`
        UPDATE website_chat_sessions
        SET escalated = true,
            escalated_at = CURRENT_TIMESTAMP,
            contact_form_data = $1
        WHERE session_id = $2
      `, [JSON.stringify(contactData), sessionId]);
    } else {
      await db.query(`
        INSERT INTO website_chat_sessions (
          agent_key, session_id, escalated, escalated_at, contact_form_data
        ) VALUES ($1, $2, true, CURRENT_TIMESTAMP, $3)
      `, [agentKey || 'support', `contact-${Date.now()}`, JSON.stringify(contactData)]);
    }

    // TODO: Send email notification to team
    // await sendContactNotificationEmail(contactData);

    res.json({
      success: true,
      message: 'Contact form submitted successfully'
    });
  } catch (error) {
    console.error('Error submitting contact form:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit contact form'
    });
  }
};

/**
 * Get chat history for a session
 */
const getSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const result = await db.query(`
      SELECT
        session_id,
        agent_key,
        messages,
        started_at
      FROM website_chat_sessions
      WHERE session_id = $1
    `, [sessionId]);

    if (result.rows.length === 0) {
      return res.json({
        success: true,
        data: null
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error fetching session:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch session'
    });
  }
};

module.exports = {
  getAgents,
  getAgent,
  chat,
  submitContact,
  getSession
};
