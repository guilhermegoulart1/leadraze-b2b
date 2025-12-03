// backend/src/services/checklistService.js
// Service for applying checklist templates when leads change pipeline stages
const db = require('../config/database');
const { v4: uuidv4 } = require('uuid');

/**
 * Create checklist from template when a lead enters a pipeline stage
 * Now creates checklist_items instead of tasks
 *
 * @param {object} params - Parameters for checklist creation
 * @param {string} params.leadId - The lead ID
 * @param {string} params.newStage - The new pipeline stage the lead entered
 * @param {string} params.accountId - The account ID
 * @param {string} [params.assignedTo] - User ID to assign items to (defaults to lead's responsible user)
 * @param {string} [params.createdBy] - User ID who triggered the change
 * @returns {object} Result with created checklist and items
 */
const createChecklistFromTemplate = async ({ leadId, newStage, accountId, assignedTo = null, createdBy = null }) => {
  try {
    console.log(`📋 [Checklist] Creating checklist for lead ${leadId} entering stage: ${newStage}`);

    // Get the active template for this stage
    const templateResult = await db.query(
      `SELECT * FROM checklist_templates
       WHERE account_id = $1 AND pipeline_stage = $2 AND is_active = true
       LIMIT 1`,
      [accountId, newStage]
    );

    if (templateResult.rows.length === 0) {
      console.log(`⚠️ [Checklist] No active template found for stage: ${newStage}`);
      return { created: 0, items: [] };
    }

    const template = templateResult.rows[0];

    // Get template items
    const itemsResult = await db.query(
      `SELECT * FROM checklist_template_items
       WHERE template_id = $1
       ORDER BY position ASC`,
      [template.id]
    );

    if (itemsResult.rows.length === 0) {
      console.log(`⚠️ [Checklist] Template "${template.name}" has no items`);
      return { created: 0, items: [] };
    }

    // Check if a checklist with this name already exists for this lead
    const existingChecklist = await db.query(
      `SELECT id FROM lead_checklists
       WHERE lead_id = $1 AND name = $2 AND account_id = $3`,
      [leadId, template.name, accountId]
    );

    if (existingChecklist.rows.length > 0) {
      console.log(`⚠️ [Checklist] Checklist "${template.name}" already exists for this lead`);
      return { created: 0, items: [], alreadyExists: true };
    }

    // Get lead info to determine responsible user
    const leadResult = await db.query(
      'SELECT responsible_user_id FROM leads WHERE id = $1',
      [leadId]
    );

    const lead = leadResult.rows[0];
    const itemAssignee = assignedTo || lead?.responsible_user_id || null;
    const creator = createdBy || itemAssignee;

    // Get next checklist position for this lead
    const posResult = await db.query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos
       FROM lead_checklists WHERE lead_id = $1`,
      [leadId]
    );
    const checklistPosition = posResult.rows[0].next_pos;

    // Create the checklist
    const checklistId = uuidv4();
    await db.insert('lead_checklists', {
      id: checklistId,
      account_id: accountId,
      lead_id: leadId,
      name: template.name,
      position: checklistPosition,
      created_by: creator,
      created_at: new Date(),
      updated_at: new Date()
    });

    const createdItems = [];
    const now = new Date();

    for (let i = 0; i < itemsResult.rows.length; i++) {
      const templateItem = itemsResult.rows[i];

      // Calculate due date based on due_days
      let dueDate = null;
      if (templateItem.due_days !== null && templateItem.due_days !== undefined) {
        dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + templateItem.due_days);
      }

      const itemId = uuidv4();
      const item = {
        id: itemId,
        checklist_id: checklistId,
        title: templateItem.title,
        task_type: templateItem.task_type || 'call',
        is_completed: false,
        due_date: dueDate,
        position: i,
        created_at: new Date(),
        updated_at: new Date()
      };

      await db.insert('checklist_items', item);

      // Assign to user if specified
      if (itemAssignee) {
        await db.query(
          `INSERT INTO checklist_item_assignees (checklist_item_id, user_id, assigned_by, assigned_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (checklist_item_id, user_id) DO NOTHING`,
          [itemId, itemAssignee, creator]
        );
      }

      createdItems.push({
        id: itemId,
        title: templateItem.title,
        taskType: templateItem.task_type || 'call',
        dueDate: dueDate,
        position: i
      });
    }

    console.log(`✅ [Checklist] Created checklist "${template.name}" with ${createdItems.length} items`);

    return {
      created: createdItems.length,
      checklistId,
      checklistName: template.name,
      templateName: template.name,
      items: createdItems
    };

  } catch (error) {
    console.error(`❌ [Checklist] Error creating checklist from template:`, error);
    throw error;
  }
};

/**
 * Handle lead stage change - create checklist if template exists
 *
 * @param {object} params - Parameters
 * @param {string} params.leadId - The lead ID
 * @param {string} params.oldStage - Previous pipeline stage
 * @param {string} params.newStage - New pipeline stage
 * @param {string} params.accountId - Account ID
 * @param {string} params.userId - User who made the change
 */
const onLeadStageChange = async ({ leadId, oldStage, newStage, accountId, userId }) => {
  // Only create checklist if the stage actually changed
  if (oldStage === newStage) {
    return { created: 0, items: [] };
  }

  return createChecklistFromTemplate({
    leadId,
    newStage,
    accountId,
    createdBy: userId
  });
};

/**
 * Apply a specific template to a lead
 * Used for manual template application
 *
 * @param {string} templateId - Template ID
 * @param {string} leadId - Lead ID
 * @param {string} accountId - Account ID
 * @param {string} userId - User ID
 */
const applyTemplateToLead = async (templateId, leadId, accountId, userId) => {
  try {
    // Get template
    const template = await db.findOne('checklist_templates', { id: templateId, account_id: accountId });
    if (!template) {
      throw new Error('Template not found');
    }

    // Get template items
    const itemsResult = await db.query(
      `SELECT * FROM checklist_template_items
       WHERE template_id = $1
       ORDER BY position ASC`,
      [templateId]
    );

    // Get lead for responsible user
    const lead = await db.findOne('leads', { id: leadId, account_id: accountId });
    const defaultAssignee = lead?.responsible_user_id || null;

    // Get next checklist position
    const posResult = await db.query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos
       FROM lead_checklists WHERE lead_id = $1`,
      [leadId]
    );

    // Create checklist
    const checklistId = uuidv4();
    await db.insert('lead_checklists', {
      id: checklistId,
      account_id: accountId,
      lead_id: leadId,
      name: template.name,
      position: posResult.rows[0].next_pos,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Create items
    const createdItems = [];
    const now = new Date();

    for (let i = 0; i < itemsResult.rows.length; i++) {
      const templateItem = itemsResult.rows[i];

      let dueDate = null;
      if (templateItem.due_days !== null && templateItem.due_days !== undefined) {
        dueDate = new Date(now);
        dueDate.setDate(dueDate.getDate() + templateItem.due_days);
      }

      const itemId = uuidv4();
      await db.insert('checklist_items', {
        id: itemId,
        checklist_id: checklistId,
        title: templateItem.title,
        task_type: templateItem.task_type || 'call',
        is_completed: false,
        due_date: dueDate,
        position: i,
        created_at: new Date(),
        updated_at: new Date()
      });

      if (defaultAssignee) {
        await db.query(
          `INSERT INTO checklist_item_assignees (checklist_item_id, user_id, assigned_by, assigned_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (checklist_item_id, user_id) DO NOTHING`,
          [itemId, defaultAssignee, userId]
        );
      }

      createdItems.push({
        id: itemId,
        title: templateItem.title,
        taskType: templateItem.task_type || 'call',
        isCompleted: false,
        dueDate: dueDate,
        position: i
      });
    }

    return {
      id: checklistId,
      name: template.name,
      items: createdItems
    };

  } catch (error) {
    console.error('Error applying template to lead:', error);
    throw error;
  }
};

/**
 * Get templates summary for all stages
 * Useful for displaying which stages have active checklists
 *
 * @param {string} accountId - Account ID
 */
const getTemplatesSummary = async (accountId) => {
  const result = await db.query(
    `SELECT
       ct.pipeline_stage,
       ct.name,
       COUNT(cti.id) as item_count
     FROM checklist_templates ct
     LEFT JOIN checklist_template_items cti ON cti.template_id = ct.id
     WHERE ct.account_id = $1 AND ct.is_active = true
     GROUP BY ct.id, ct.pipeline_stage, ct.name
     ORDER BY
       CASE ct.pipeline_stage
         WHEN 'leads' THEN 1
         WHEN 'qualifying' THEN 2
         WHEN 'scheduled' THEN 3
         WHEN 'proposal' THEN 4
         WHEN 'negotiation' THEN 5
         WHEN 'won' THEN 6
         WHEN 'lost' THEN 7
       END`,
    [accountId]
  );

  return result.rows.reduce((acc, row) => {
    acc[row.pipeline_stage] = {
      templateName: row.name,
      itemCount: parseInt(row.item_count)
    };
    return acc;
  }, {});
};

module.exports = {
  createChecklistFromTemplate,
  onLeadStageChange,
  applyTemplateToLead,
  getTemplatesSummary
};
