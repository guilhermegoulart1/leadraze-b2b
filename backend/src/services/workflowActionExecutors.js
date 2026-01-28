// backend/src/services/workflowActionExecutors.js

/**
 * Workflow Action Executors
 *
 * Implements all action types that can be executed in workflow nodes.
 * Each executor receives params and context, and returns a result.
 */

const db = require('../config/database');
const handoffService = require('./handoffService');
const TemplateProcessor = require('../utils/templateProcessor');
const axios = require('axios');

// Lazy load to avoid circular dependencies
let unipileClient = null;
const getUnipileClient = () => {
  if (!unipileClient) {
    unipileClient = require('../config/unipile');
  }
  return unipileClient;
};

let emailQueue = null;
const getEmailQueue = () => {
  if (!emailQueue) {
    emailQueue = require('../queues').emailQueue;
  }
  return emailQueue;
};

let followUpQueue = null;
const getFollowUpQueue = () => {
  if (!followUpQueue) {
    followUpQueue = require('../queues').followUpQueue;
  }
  return followUpQueue;
};

/**
 * Action type configurations
 */
const ACTION_CONFIGS = {
  transfer: { hasOutput: false, endsBranch: true },
  schedule: { hasOutput: true, endsBranch: false },
  send_message: { hasOutput: true, endsBranch: false },
  add_tag: { hasOutput: true, endsBranch: false },
  remove_tag: { hasOutput: true, endsBranch: false },
  close_positive: { hasOutput: false, endsBranch: true },
  close_negative: { hasOutput: false, endsBranch: true },
  assign_agent: { hasOutput: true, endsBranch: false },
  send_email: { hasOutput: true, endsBranch: false },
  webhook: { hasOutput: true, endsBranch: false },
  pause: { hasOutput: true, endsBranch: false, pausesWorkflow: true },
  wait: { hasOutput: true, endsBranch: false, pausesWorkflow: true },
  create_opportunity: { hasOutput: true, endsBranch: false },
  move_stage: { hasOutput: true, endsBranch: false },
  http_request: { hasOutput: true, endsBranch: false, hasBranching: true }
};

/**
 * Execute an action node
 * @param {object} actionNode - The action node to execute
 * @param {object} context - Execution context
 * @returns {Promise<object>} Execution result
 */
async function executeAction(actionNode, context) {
  const { data } = actionNode;
  const actionType = data.actionType || data.action;
  const startTime = Date.now();

  try {
    console.log(`🎬 Executing action: ${actionType}`);

    const executor = executors[actionType];

    if (!executor) {
      throw new Error(`Unknown action type: ${actionType}`);
    }

    const result = await executor(data, context);

    const durationMs = Date.now() - startTime;
    console.log(`✅ Action completed: ${actionType} (${durationMs}ms)`);

    return {
      success: true,
      actionType,
      result,
      durationMs,
      hasOutput: ACTION_CONFIGS[actionType]?.hasOutput ?? true,
      endsBranch: ACTION_CONFIGS[actionType]?.endsBranch ?? false,
      pausesWorkflow: ACTION_CONFIGS[actionType]?.pausesWorkflow ?? false
    };
  } catch (error) {
    console.error(`❌ Action failed: ${actionType}`, error);
    return {
      success: false,
      actionType,
      error: error.message,
      durationMs: Date.now() - startTime
    };
  }
}

/**
 * Action executors
 */
const executors = {
  /**
   * Transfer to human
   * Supports: specific user, sector with round robin, sector with specific user
   */
  transfer: async (params, context) => {
    const {
      transferMode = 'user', // 'user' or 'sector'
      transferUserId,
      transferSectorId,
      transferSectorMode = 'round_robin', // 'round_robin' or 'specific'
      transferSectorUserId, // specific user within sector
      transferMessage,
      message // Frontend saves message here
    } = params;

    // Use transferMessage or message (frontend compatibility)
    const messageToSend = transferMessage || message;

    const { conversationId, agentId, accountId, isTestMode } = context;

    // In test mode, just simulate
    if (isTestMode) {
      let targetDescription = '';
      if (transferMode === 'user') {
        targetDescription = `usuário ID: ${transferUserId}`;
      } else if (transferMode === 'sector') {
        if (transferSectorMode === 'round_robin') {
          targetDescription = `setor ID: ${transferSectorId} (round robin)`;
        } else {
          targetDescription = `usuário ID: ${transferSectorUserId} do setor ${transferSectorId}`;
        }
      }

      return {
        simulated: true,
        description: `Transferência simulada para ${targetDescription}`,
        transferMode,
        transferSectorMode,
        messageToSend: messageToSend || null
      };
    }

    let assignedUserId = null;
    let assignedUserName = null;

    // Determine the target user based on transfer mode
    if (transferMode === 'user' && transferUserId) {
      // Direct transfer to specific user
      assignedUserId = transferUserId;

      // Get user name for logging
      const userResult = await db.query(
        'SELECT name FROM users WHERE id = $1',
        [transferUserId]
      );
      assignedUserName = userResult.rows[0]?.name || 'Unknown';

    } else if (transferMode === 'sector' && transferSectorId) {
      if ((transferSectorMode === 'specific' || transferSectorMode === 'specific_user') && transferSectorUserId) {
        // Transfer to specific user within sector
        assignedUserId = transferSectorUserId;

        const userResult = await db.query(
          'SELECT name FROM users WHERE id = $1',
          [transferSectorUserId]
        );
        assignedUserName = userResult.rows[0]?.name || 'Unknown';

      } else {
        // Round robin within sector - use rotationService
        const rotationService = require('./rotationService');

        // Check if agent has assignees configured for this sector
        // If not, get all active users from the sector for round robin
        const sectorUsersResult = await db.query(`
          SELECT u.id, u.name, u.email
          FROM users u
          JOIN user_sectors us ON u.id = us.user_id
          WHERE us.sector_id = $1 AND u.is_active = true
          ORDER BY u.name
        `, [transferSectorId]);

        if (sectorUsersResult.rows.length === 0) {
          throw new Error(`Nenhum usuário ativo encontrado no setor ${transferSectorId}`);
        }

        // Try to use agent's rotation state if available
        if (agentId) {
          const assignee = await rotationService.getNextAssignee(agentId);
          if (assignee) {
            assignedUserId = assignee.userId;
            assignedUserName = assignee.userName;
          }
        }

        // Fallback: simple round robin on sector users
        if (!assignedUserId) {
          // Get last assigned user for this sector (simple rotation)
          const lastAssignedResult = await db.query(`
            SELECT assigned_user_id FROM conversations
            WHERE id IN (
              SELECT c.id FROM conversations c
              JOIN opportunities o ON c.opportunity_id = o.id
              WHERE o.sector_id = $1
            )
            ORDER BY updated_at DESC
            LIMIT 1
          `, [transferSectorId]);

          const lastUserId = lastAssignedResult.rows[0]?.assigned_user_id;
          const users = sectorUsersResult.rows;

          // Find next user in round robin
          let nextIndex = 0;
          if (lastUserId) {
            const lastIndex = users.findIndex(u => u.id === lastUserId);
            nextIndex = (lastIndex + 1) % users.length;
          }

          assignedUserId = users[nextIndex].id;
          assignedUserName = users[nextIndex].name;
        }
      }
    }

    if (!assignedUserId) {
      throw new Error('Não foi possível determinar o usuário para transferência');
    }

    // Update conversation
    await db.query(`
      UPDATE conversations
      SET ai_active = false,
          manual_control_taken = true,
          handoff_at = NOW(),
          handoff_reason = 'workflow_transfer',
          assigned_user_id = $1,
          status = 'manual',
          updated_at = NOW()
      WHERE id = $2
    `, [assignedUserId, conversationId]);

    console.log(`✅ [Transfer] Conversa ${conversationId} transferida para ${assignedUserName} (ID: ${assignedUserId})`);

    // Send transfer message if configured
    if (messageToSend) {
      try {
        await sendMessageViaUnipile(conversationId, messageToSend, context);
      } catch (err) {
        console.error('⚠️ [Transfer] Erro ao enviar mensagem de transferência:', err.message);
      }
    }

    // Create notification for the assigned user
    try {
      await db.query(`
        INSERT INTO notifications (
          account_id, user_id, type, title, message,
          conversation_id, metadata
        ) VALUES ($1, $2, 'handoff', $3, $4, $5, $6)
      `, [
        accountId,
        assignedUserId,
        'Nova conversa transferida',
        `Uma conversa foi transferida para você via workflow.`,
        conversationId,
        JSON.stringify({
          reason: 'workflow_transfer',
          transfer_mode: transferMode,
          sector_mode: transferSectorMode
        })
      ]);
    } catch (err) {
      console.error('⚠️ [Transfer] Erro ao criar notificação:', err.message);
    }

    return {
      transferred: true,
      mode: transferMode,
      sectorMode: transferSectorMode,
      assignedUserId,
      assignedUserName,
      sectorId: transferSectorId
    };
  },

  /**
   * Offer scheduling link
   */
  schedule: async (params, context) => {
    const { schedulingLink } = params;
    const { conversationId, lead, isTestMode, variables } = context;

    if (!schedulingLink) {
      throw new Error('Scheduling link not configured');
    }

    // Process variables in the link using full context
    const processedLink = TemplateProcessor.processAllVariables(schedulingLink, context);

    // Build scheduling message
    const message = `Para facilitar, você pode agendar diretamente aqui: ${processedLink}`;

    if (isTestMode) {
      return {
        simulated: true,
        link: processedLink,
        message
      };
    }

    // Send message with link
    await sendMessageViaUnipile(conversationId, message, context);

    return {
      sent: true,
      link: processedLink
    };
  },

  /**
   * Send a message
   */
  send_message: async (params, context) => {
    // Frontend default: waitForResponse !== false means wait (undefined or true = wait)
    // So we default to true if not explicitly set to false
    const { message } = params;
    const waitForResponse = params.waitForResponse !== false;
    const { conversationId, lead, isTestMode, variables } = context;

    console.log(`📨 [send_message] params.waitForResponse: ${params.waitForResponse}, resolved: ${waitForResponse}`);

    if (!message) {
      throw new Error('Message content is required');
    }

    // Process variables in message using full context
    const processedMessage = TemplateProcessor.processAllVariables(message, context);

    if (isTestMode) {
      return {
        simulated: true,
        message: processedMessage,
        waitForResponse
      };
    }

    // Send via Unipile
    await sendMessageViaUnipile(conversationId, processedMessage, context);

    // Update conversation
    await updateConversationLastMessage(conversationId, processedMessage);

    return {
      sent: true,
      message: processedMessage,
      waitForResponse
    };
  },

  /**
   * Add tags to lead
   */
  add_tag: async (params, context) => {
    const { tags = [] } = params.params || params;
    const { leadId, contactId, isTestMode } = context;

    if (!tags || tags.length === 0) {
      return { added: 0 };
    }

    if (isTestMode) {
      return {
        simulated: true,
        tags: tags.map(t => t.name || t)
      };
    }

    const targetId = contactId || leadId;
    if (!targetId) {
      throw new Error('No lead or contact ID to add tags to');
    }

    // Add tags to the entity
    for (const tag of tags) {
      const tagName = tag.name || tag;
      const tagColor = tag.color || 'gray';

      await db.query(
        `INSERT INTO entity_tags (entity_id, entity_type, tag_name, tag_color, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (entity_id, tag_name) DO UPDATE SET tag_color = $4`,
        [targetId, contactId ? 'contact' : 'lead', tagName, tagColor]
      );
    }

    return {
      added: tags.length,
      tags: tags.map(t => t.name || t)
    };
  },

  /**
   * Remove tags from lead
   */
  remove_tag: async (params, context) => {
    const { tags = [], removeAll = false } = params.params || params;
    const { leadId, contactId, isTestMode } = context;

    if (isTestMode) {
      return {
        simulated: true,
        removed: removeAll ? 'all' : tags.map(t => t.name || t)
      };
    }

    const targetId = contactId || leadId;
    if (!targetId) {
      throw new Error('No lead or contact ID to remove tags from');
    }

    if (removeAll) {
      await db.query(
        `DELETE FROM entity_tags WHERE entity_id = $1`,
        [targetId]
      );
      return { removedAll: true };
    }

    for (const tag of tags) {
      const tagName = tag.name || tag;
      await db.query(
        `DELETE FROM entity_tags WHERE entity_id = $1 AND tag_name = $2`,
        [targetId, tagName]
      );
    }

    return {
      removed: tags.length,
      tags: tags.map(t => t.name || t)
    };
  },

  /**
   * Close conversation as positive (qualified)
   */
  close_positive: async (params, context) => {
    const { message } = params;
    const { conversationId, leadId, isTestMode } = context;

    if (isTestMode) {
      return {
        simulated: true,
        status: 'qualified',
        message
      };
    }

    // Update lead status
    if (leadId) {
      await db.update(
        'leads',
        { status: 'qualified', updated_at: new Date() },
        { id: leadId }
      );
    }

    // Update conversation
    await db.update(
      'conversations',
      {
        status: 'closed',
        ai_active: false,
        closed_at: new Date(),
        close_reason: 'positive',
        updated_at: new Date()
      },
      { id: conversationId }
    );

    // Send closing message if configured
    if (message) {
      await sendMessageViaUnipile(conversationId, message, context);
    }

    return {
      closed: true,
      status: 'positive',
      leadStatus: 'qualified'
    };
  },

  /**
   * Close conversation as negative (not interested)
   */
  close_negative: async (params, context) => {
    const { message } = params;
    const { conversationId, leadId, isTestMode } = context;

    if (isTestMode) {
      return {
        simulated: true,
        status: 'not_interested',
        message
      };
    }

    // Update lead status
    if (leadId) {
      await db.update(
        'leads',
        { status: 'not_interested', updated_at: new Date() },
        { id: leadId }
      );
    }

    // Update conversation
    await db.update(
      'conversations',
      {
        status: 'closed',
        ai_active: false,
        closed_at: new Date(),
        close_reason: 'negative',
        updated_at: new Date()
      },
      { id: conversationId }
    );

    return {
      closed: true,
      status: 'negative',
      leadStatus: 'not_interested'
    };
  },

  /**
   * Assign to a specific agent/user
   */
  assign_agent: async (params, context) => {
    const { userId, useRoundRobin = false } = params;
    const { conversationId, campaignId, isTestMode } = context;

    if (isTestMode) {
      return {
        simulated: true,
        assignedTo: userId || 'round_robin'
      };
    }

    let assigneeId = userId;

    // Use round-robin if no specific user
    if (useRoundRobin || !assigneeId) {
      assigneeId = await getNextRoundRobinUser(campaignId);
    }

    if (!assigneeId) {
      throw new Error('No user available for assignment');
    }

    // Update conversation
    await db.update(
      'conversations',
      {
        assigned_to: assigneeId,
        assigned_at: new Date(),
        updated_at: new Date()
      },
      { id: conversationId }
    );

    return {
      assigned: true,
      userId: assigneeId
    };
  },

  /**
   * Send email
   */
  send_email: async (params, context) => {
    const { subject, body, templateId } = params;
    const { lead, isTestMode, accountId, userId } = context;

    const email = lead?.email;
    if (!email) {
      throw new Error('Lead has no email address');
    }

    // Process variables in subject and body using full context
    const processedSubject = TemplateProcessor.processAllVariables(subject || '', context);
    const processedBody = TemplateProcessor.processAllVariables(body || '', context);

    if (isTestMode) {
      return {
        simulated: true,
        to: email,
        subject: processedSubject,
        body: processedBody
      };
    }

    // Queue email
    await getEmailQueue().add({
      type: 'workflow_email',
      to: email,
      subject: processedSubject,
      html: processedBody,
      accountId,
      userId,
      templateId
    });

    return {
      queued: true,
      to: email,
      subject: processedSubject
    };
  },

  /**
   * Call webhook
   */
  webhook: async (params, context) => {
    const { url } = params.params || params;
    const { conversationId, lead, agentId, variables, isTestMode } = context;

    if (!url) {
      throw new Error('Webhook URL is required');
    }

    // Validate URL
    try {
      new URL(url);
    } catch (e) {
      throw new Error(`Invalid webhook URL: ${url}`);
    }

    const payload = {
      event: 'workflow_action',
      timestamp: new Date().toISOString(),
      conversation_id: conversationId,
      agent_id: agentId,
      lead: {
        id: lead?.id,
        name: lead?.name,
        email: lead?.email,
        phone: lead?.phone,
        company: lead?.company,
        title: lead?.title
      },
      variables
    };

    if (isTestMode) {
      return {
        simulated: true,
        url,
        payload
      };
    }

    // Make webhook call
    try {
      const response = await axios.post(url, payload, {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
          'X-Workflow-Event': 'action'
        }
      });

      return {
        sent: true,
        url,
        statusCode: response.status,
        response: response.data
      };
    } catch (error) {
      throw new Error(`Webhook failed: ${error.message}`);
    }
  },

  /**
   * Pause workflow for a duration
   */
  pause: async (params, context) => {
    const {
      duration,
      minDuration,
      maxDuration,
      randomMode = false
    } = params.params || params;

    const { conversationId, isTestMode } = context;

    // Calculate pause duration
    let pauseDuration;
    if (randomMode && minDuration && maxDuration) {
      const min = parseDurationToMs(minDuration);
      const max = parseDurationToMs(maxDuration);
      pauseDuration = min + Math.random() * (max - min);
    } else {
      pauseDuration = parseDurationToMs(duration || '1h');
    }

    const resumeAt = new Date(Date.now() + pauseDuration);

    if (isTestMode) {
      return {
        simulated: true,
        pauseDuration: formatDuration(pauseDuration),
        resumeAt
      };
    }

    // Schedule resume job
    const job = await getFollowUpQueue().add(
      {
        type: 'resume_workflow',
        conversationId,
        scheduledFor: resumeAt.toISOString()
      },
      {
        delay: pauseDuration,
        removeOnComplete: true
      }
    );

    return {
      paused: true,
      duration: formatDuration(pauseDuration),
      resumeAt,
      jobId: job.id
    };
  },

  /**
   * Wait for a specified duration (with flexible time units)
   * Similar to pause but with minutes/hours/days configuration
   */
  wait: async (params, context) => {
    const { waitTime = 24, waitUnit = 'hours' } = params;
    const { conversationId, isTestMode } = context;

    // Time unit multipliers
    const multipliers = {
      seconds: 1000,
      minutes: 60 * 1000,
      hours: 60 * 60 * 1000,
      days: 24 * 60 * 60 * 1000
    };

    // Calculate wait duration in milliseconds
    const waitDuration = waitTime * (multipliers[waitUnit] || multipliers.hours);
    const resumeAt = new Date(Date.now() + waitDuration);

    // Format for display
    const unitLabels = { seconds: 'segundos', minutes: 'minutos', hours: 'horas', days: 'dias' };
    const formattedDuration = `${waitTime} ${unitLabels[waitUnit] || 'horas'}`;

    if (isTestMode) {
      return {
        simulated: true,
        waitTime,
        waitUnit,
        formattedDuration,
        resumeAt,
        isWaitAction: true
      };
    }

    // Schedule resume job
    const job = await getFollowUpQueue().add(
      {
        type: 'resume_workflow',
        conversationId,
        scheduledFor: resumeAt.toISOString()
      },
      {
        delay: waitDuration,
        removeOnComplete: true
      }
    );

    return {
      paused: true,
      waitTime,
      waitUnit,
      formattedDuration,
      resumeAt,
      jobId: job.id,
      isWaitAction: true
    };
  },

  /**
   * Create opportunity in pipeline
   * Creates a contact if it doesn't exist and adds an opportunity to the specified pipeline/stage
   */
  create_opportunity: async (params, context) => {
    const {
      pipelineId,
      stageId,
      pipelineName,
      stageName,
      title,
      value = 0,
      createContactIfNotExists = true
    } = params.params || params;

    const { lead, leadId, contactId, accountId, userId, isTestMode, variables } = context;

    if (!pipelineId) {
      throw new Error('Pipeline ID is required');
    }

    if (!stageId) {
      throw new Error('Stage ID is required');
    }

    // Process variables in title using full context
    const processedTitle = title
      ? TemplateProcessor.processAllVariables(title, context)
      : `${lead?.name || 'Lead'}${lead?.company ? ` - ${lead.company}` : ''}`;

    if (isTestMode) {
      console.log(`🧪 [create_opportunity] SIMULADO: Criaria oportunidade em "${pipelineName || pipelineId}" → "${stageName || stageId}"`);
      return {
        simulated: true,
        pipelineId,
        pipelineName: pipelineName || 'Pipeline',
        stageId,
        stageName: stageName || 'Etapa',
        title: processedTitle,
        value,
        createContactIfNotExists
      };
    }

    let targetContactId = contactId;

    // Create contact from lead if needed
    if (!targetContactId && createContactIfNotExists && lead) {
      // Check if contact already exists with this email or phone
      let existingContact = null;

      if (lead.email) {
        const emailCheck = await db.query(
          'SELECT id FROM contacts WHERE account_id = $1 AND email = $2',
          [accountId, lead.email]
        );
        if (emailCheck.rows.length > 0) {
          existingContact = emailCheck.rows[0];
        }
      }

      if (!existingContact && lead.phone) {
        const phoneCheck = await db.query(
          'SELECT id FROM contacts WHERE account_id = $1 AND phone = $2',
          [accountId, lead.phone]
        );
        if (phoneCheck.rows.length > 0) {
          existingContact = phoneCheck.rows[0];
        }
      }

      if (existingContact) {
        targetContactId = existingContact.id;
        console.log(`📋 [create_opportunity] Using existing contact: ${targetContactId}`);
      } else {
        // Create new contact from lead data
        const contactResult = await db.query(
          `INSERT INTO contacts (
            account_id, name, email, phone, company, title,
            source, source_lead_id, created_by, created_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
          RETURNING id`,
          [
            accountId,
            lead.name || 'Unknown',
            lead.email || null,
            lead.phone || null,
            lead.company || null,
            lead.title || null,
            'workflow',
            leadId,
            userId
          ]
        );
        targetContactId = contactResult.rows[0].id;
        console.log(`✅ [create_opportunity] Created contact: ${targetContactId} from opportunity ${leadId}`);

        // Update opportunity with contact_id
        if (leadId) {
          await db.query(
            'UPDATE opportunities SET contact_id = $1 WHERE id = $2',
            [targetContactId, leadId]
          );
        }
      }
    }

    if (!targetContactId) {
      throw new Error('No contact available and could not create one');
    }

    // Verify pipeline and stage exist and belong to account
    const stageCheck = await db.query(
      `SELECT ps.id, ps.name, p.id as pipeline_id, p.name as pipeline_name
       FROM pipeline_stages ps
       JOIN pipelines p ON ps.pipeline_id = p.id
       WHERE ps.id = $1 AND p.id = $2 AND p.account_id = $3`,
      [stageId, pipelineId, accountId]
    );

    if (stageCheck.rows.length === 0) {
      throw new Error('Pipeline or stage not found');
    }

    const stage = stageCheck.rows[0];

    // Check if opportunity already exists for this contact in this pipeline
    const existingOpp = await db.query(
      'SELECT id FROM opportunities WHERE contact_id = $1 AND pipeline_id = $2',
      [targetContactId, pipelineId]
    );

    if (existingOpp.rows.length > 0) {
      console.log(`⚠️ [create_opportunity] Opportunity already exists for contact ${targetContactId} in pipeline ${pipelineId}`);
      return {
        created: false,
        existed: true,
        opportunityId: existingOpp.rows[0].id,
        contactId: targetContactId,
        pipelineId,
        stageId
      };
    }

    // Create opportunity
    const oppResult = await db.query(
      `INSERT INTO opportunities (
        account_id, contact_id, pipeline_id, stage_id, title, value,
        source_lead_id, source, owner_user_id, created_by, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())
      RETURNING id`,
      [
        accountId,
        targetContactId,
        pipelineId,
        stageId,
        processedTitle,
        parseFloat(value) || 0,
        leadId,
        'workflow',
        userId,
        userId
      ]
    );

    const opportunityId = oppResult.rows[0].id;

    // Record in opportunity history
    await db.query(
      `INSERT INTO opportunity_history (opportunity_id, user_id, action, to_stage_id, to_value, notes, metadata)
       VALUES ($1, $2, 'created', $3, $4, $5, $6)`,
      [
        opportunityId,
        userId,
        stageId,
        parseFloat(value) || 0,
        'Criada via workflow',
        JSON.stringify({ source: 'workflow', lead_id: leadId })
      ]
    );

    console.log(`✅ [create_opportunity] Created opportunity ${opportunityId} in pipeline "${stage.pipeline_name}" stage "${stage.name}"`);

    return {
      created: true,
      opportunityId,
      contactId: targetContactId,
      pipelineId,
      pipelineName: stage.pipeline_name,
      stageId,
      stageName: stage.name,
      title: processedTitle,
      value: parseFloat(value) || 0
    };
  },

  /**
   * Move opportunity to a different stage
   * Finds the opportunity for the current lead and moves it to the specified stage
   */
  move_stage: async (params, context) => {
    const { stageId, pipelineId, pipelineName, stageName } = params.params || params;
    const { lead, leadId, contactId, accountId, userId, isTestMode } = context;

    if (!stageId) {
      throw new Error('Stage ID is required');
    }

    if (isTestMode) {
      console.log(`🧪 [move_stage] SIMULADO: Moveria para "${stageName || stageId}" em "${pipelineName || pipelineId}"`);
      return {
        simulated: true,
        pipelineId,
        pipelineName: pipelineName || 'Pipeline',
        stageId,
        stageName: stageName || 'Etapa'
      };
    }

    // Find opportunity for this lead
    let oppResult;

    if (contactId) {
      oppResult = await db.query(
        `SELECT o.id, o.pipeline_id, o.stage_id, ps.name as current_stage
         FROM opportunities o
         LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
         WHERE o.contact_id = $1 AND o.account_id = $2
         ORDER BY o.created_at DESC LIMIT 1`,
        [contactId, accountId]
      );
    }

    if ((!oppResult || oppResult.rows.length === 0) && leadId) {
      oppResult = await db.query(
        `SELECT o.id, o.pipeline_id, o.stage_id, ps.name as current_stage
         FROM opportunities o
         LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
         WHERE o.source_lead_id = $1 AND o.account_id = $2
         ORDER BY o.created_at DESC LIMIT 1`,
        [leadId, accountId]
      );
    }

    if (!oppResult || oppResult.rows.length === 0) {
      console.log(`⚠️ [move_stage] No opportunity found for lead ${leadId}`);
      return { moved: false, reason: 'no_opportunity_found' };
    }

    const opportunity = oppResult.rows[0];
    const targetPipelineId = pipelineId || opportunity.pipeline_id;

    // Validate stage belongs to pipeline
    const stageCheck = await db.query(
      `SELECT ps.id, ps.name, ps.is_win_stage, ps.is_loss_stage
       FROM pipeline_stages ps
       WHERE ps.id = $1 AND ps.pipeline_id = $2`,
      [stageId, targetPipelineId]
    );

    if (stageCheck.rows.length === 0) {
      throw new Error('Stage not found or does not belong to pipeline');
    }

    const newStage = stageCheck.rows[0];

    // If already in target stage, skip
    if (opportunity.stage_id === stageId) {
      console.log(`ℹ️ [move_stage] Opportunity already in stage ${newStage.name}`);
      return { moved: false, reason: 'already_in_stage', stageId, stageName: newStage.name };
    }

    // Handle win/loss stage timestamps
    let wonAt = null;
    let lostAt = null;
    if (newStage.is_win_stage) {
      wonAt = new Date();
    } else if (newStage.is_loss_stage) {
      lostAt = new Date();
    }

    await db.query(
      `UPDATE opportunities
       SET stage_id = $1, won_at = $2, lost_at = $3, updated_at = NOW()
       WHERE id = $4`,
      [stageId, wonAt, lostAt, opportunity.id]
    );

    // Record in history
    await db.query(
      `INSERT INTO opportunity_history
       (opportunity_id, user_id, action, from_stage_id, to_stage_id, notes, metadata)
       VALUES ($1, $2, 'stage_changed', $3, $4, $5, $6)`,
      [
        opportunity.id,
        userId,
        opportunity.stage_id,
        stageId,
        'Movido via workflow',
        JSON.stringify({ source: 'workflow', lead_id: leadId })
      ]
    );

    console.log(`✅ [move_stage] Moved opportunity ${opportunity.id} from "${opportunity.current_stage}" to "${newStage.name}"`);

    return {
      moved: true,
      opportunityId: opportunity.id,
      fromStageId: opportunity.stage_id,
      toStageId: stageId,
      stageName: newStage.name,
      isWinStage: newStage.is_win_stage,
      isLossStage: newStage.is_loss_stage
    };
  },

  /**
   * HTTP Request action
   * Makes HTTP requests to external APIs with variable extraction and success/error routing
   */
  http_request: async (params, context) => {
    const {
      method = 'GET',
      url,
      headers = [],
      queryParams = [],
      bodyType = 'none',
      body = '',
      timeout = 30000,
      responseVariables = []
    } = params;

    const { variables = {}, lead, isTestMode } = context;

    if (!url) {
      throw new Error('URL is required');
    }

    // Process variables in URL using full context
    const processedUrl = TemplateProcessor.processAllVariables(url, context);

    // Build headers
    const requestHeaders = {};

    // Add custom headers
    headers.filter(h => h.enabled !== false && h.key).forEach(h => {
      requestHeaders[h.key] = TemplateProcessor.processAllVariables(h.value, context);
    });

    // Build query params
    let urlObj;
    try {
      urlObj = new URL(processedUrl);
    } catch (e) {
      throw new Error(`Invalid URL: ${processedUrl}`);
    }

    queryParams.filter(p => p.enabled !== false && p.key).forEach(p => {
      urlObj.searchParams.append(p.key, TemplateProcessor.processAllVariables(p.value, context));
    });

    // Build body
    let requestBody = null;
    if (['POST', 'PUT', 'PATCH'].includes(method) && bodyType !== 'none' && body) {
      if (bodyType === 'json') {
        requestHeaders['Content-Type'] = 'application/json';
        requestBody = TemplateProcessor.processAllVariables(body, context);
      } else if (bodyType === 'form-data') {
        requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
        requestBody = TemplateProcessor.processAllVariables(body, context);
      } else {
        requestBody = TemplateProcessor.processAllVariables(body, context);
      }
    }

    const startTime = Date.now();

    if (isTestMode) {
      console.log(`🧪 [http_request] SIMULATED: ${method} ${urlObj.toString()}`);
      return {
        simulated: true,
        method,
        url: urlObj.toString(),
        headers: requestHeaders,
        body: requestBody,
        path: 'success'
      };
    }

    try {
      const response = await axios({
        method,
        url: urlObj.toString(),
        headers: requestHeaders,
        data: requestBody,
        timeout,
        validateStatus: () => true // Accept any status
      });

      const duration = Date.now() - startTime;

      // Extract variables from response
      const extractedVariables = {};
      for (const varConfig of responseVariables) {
        if (varConfig.path && varConfig.variableName) {
          const value = getValueByPath(response.data, varConfig.path);
          if (value !== undefined) {
            extractedVariables[varConfig.variableName] = value;
          }
        }
      }

      // Merge extracted variables into context
      Object.assign(context.variables || {}, extractedVariables);

      const isSuccess = response.status >= 200 && response.status < 400;

      console.log(`${isSuccess ? '✅' : '❌'} [http_request] ${method} ${processedUrl} -> ${response.status} (${duration}ms)`);

      return {
        success: isSuccess,
        path: isSuccess ? 'success' : 'error',
        status: response.status,
        statusText: response.statusText,
        body: response.data,
        headers: response.headers,
        duration,
        extractedVariables
      };
    } catch (error) {
      const duration = Date.now() - startTime;
      console.error(`❌ [http_request] ${method} ${processedUrl} -> Error: ${error.message}`);

      return {
        success: false,
        path: 'error',
        status: 0,
        statusText: error.message,
        body: null,
        duration,
        error: error.message
      };
    }
  }
};

/**
 * Helper: Get value from object by dot-notation path
 */
function getValueByPath(obj, path) {
  if (!obj || !path) return undefined;

  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) return undefined;

    // Handle array notation like 'data[0].name'
    const arrayMatch = part.match(/^(\w+)\[(\d+)\]$/);
    if (arrayMatch) {
      current = current[arrayMatch[1]];
      if (Array.isArray(current)) {
        current = current[parseInt(arrayMatch[2])];
      } else {
        return undefined;
      }
    } else {
      current = current[part];
    }
  }

  return current;
}

/**
 * Helper: Send message via Unipile
 */
async function sendMessageViaUnipile(conversationId, message, context) {
  const { unipileAccountId, leadUnipileId, channel } = context;

  if (!unipileAccountId || !leadUnipileId) {
    throw new Error('Missing Unipile configuration');
  }

  const client = getUnipileClient();

  await client.messaging.send({
    account_id: unipileAccountId,
    user_id: leadUnipileId,
    text: message
  });

  // Save message to database
  await db.insert('messages', {
    conversation_id: conversationId,
    sender_type: 'ai',
    content: message,
    message_type: 'text',
    sent_at: new Date(),
    created_at: new Date()
  });
}

/**
 * Helper: Update conversation last message
 */
async function updateConversationLastMessage(conversationId, message) {
  await db.update(
    'conversations',
    {
      last_message_at: new Date(),
      last_message_preview: message.substring(0, 100),
      updated_at: new Date()
    },
    { id: conversationId }
  );
}

/**
 * Helper: Get next round-robin user
 */
async function getNextRoundRobinUser(campaignId) {
  const result = await db.query(
    `SELECT user_id
     FROM campaign_round_robin_users
     WHERE campaign_id = $1
     ORDER BY last_assigned_at ASC NULLS FIRST
     LIMIT 1`,
    [campaignId]
  );

  if (result.rows && result.rows.length > 0) {
    const userId = result.rows[0].user_id;

    // Update last assigned
    await db.query(
      `UPDATE campaign_round_robin_users
       SET last_assigned_at = NOW()
       WHERE campaign_id = $1 AND user_id = $2`,
      [campaignId, userId]
    );

    return userId;
  }

  return null;
}

/**
 * Helper: Parse duration string to milliseconds
 */
function parseDurationToMs(duration) {
  if (typeof duration === 'number') {
    return duration;
  }

  const match = String(duration).match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) {
    return 3600000; // Default: 1 hour
  }

  const value = parseInt(match[1]);
  const unit = (match[2] || 'm').toLowerCase();

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return value * (multipliers[unit] || 60000);
}

/**
 * Helper: Format duration for display
 */
function formatDuration(ms) {
  if (ms < 60000) {
    return `${Math.round(ms / 1000)}s`;
  }
  if (ms < 3600000) {
    return `${Math.round(ms / 60000)}m`;
  }
  if (ms < 86400000) {
    return `${Math.round(ms / 3600000)}h`;
  }
  return `${Math.round(ms / 86400000)}d`;
}

/**
 * Check if action type ends the branch (no further nodes)
 */
function doesActionEndBranch(actionType) {
  return ACTION_CONFIGS[actionType]?.endsBranch ?? false;
}

/**
 * Check if action type pauses the workflow
 */
function doesActionPauseWorkflow(actionType) {
  return ACTION_CONFIGS[actionType]?.pausesWorkflow ?? false;
}

module.exports = {
  executeAction,
  executors,
  ACTION_CONFIGS,
  doesActionEndBranch,
  doesActionPauseWorkflow,
  parseDurationToMs,
  formatDuration
};
