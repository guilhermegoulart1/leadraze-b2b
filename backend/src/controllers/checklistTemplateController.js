// backend/src/controllers/checklistTemplateController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError, ForbiddenError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

const VALID_STAGES = ['leads', 'qualifying', 'scheduled', 'proposal', 'negotiation', 'won', 'lost'];
const VALID_PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const VALID_TASK_TYPES = ['call', 'meeting', 'email', 'follow_up', 'proposal', 'other'];

/**
 * Get all checklist templates
 * GET /api/checklist-templates
 */
const getTemplates = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { pipeline_stage, is_active } = req.query;

    const params = [accountId];
    let paramIndex = 2;
    let whereClause = 'WHERE ct.account_id = $1';

    if (pipeline_stage) {
      whereClause += ` AND ct.pipeline_stage = $${paramIndex++}`;
      params.push(pipeline_stage);
    }

    if (is_active !== undefined) {
      whereClause += ` AND ct.is_active = $${paramIndex++}`;
      params.push(is_active === 'true');
    }

    const query = `
      SELECT
        ct.*,
        COUNT(cti.id) as item_count
      FROM checklist_templates ct
      LEFT JOIN checklist_template_items cti ON cti.template_id = ct.id
      ${whereClause}
      GROUP BY ct.id
      ORDER BY
        CASE ct.pipeline_stage
          WHEN 'leads' THEN 1
          WHEN 'qualifying' THEN 2
          WHEN 'scheduled' THEN 3
          WHEN 'proposal' THEN 4
          WHEN 'negotiation' THEN 5
          WHEN 'won' THEN 6
          WHEN 'lost' THEN 7
        END,
        ct.name
    `;

    const result = await db.query(query, params);

    return sendSuccess(res, {
      templates: result.rows.map(row => ({
        id: row.id,
        name: row.name,
        pipelineStage: row.pipeline_stage,
        isActive: row.is_active,
        itemCount: parseInt(row.item_count),
        createdAt: row.created_at,
        updatedAt: row.updated_at
      }))
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get a single template with its items
 * GET /api/checklist-templates/:id
 */
const getTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Get template
    const templateResult = await db.query(
      'SELECT * FROM checklist_templates WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (templateResult.rows.length === 0) {
      throw new NotFoundError('Template not found');
    }

    const template = templateResult.rows[0];

    // Get items
    const itemsResult = await db.query(
      `SELECT * FROM checklist_template_items
       WHERE template_id = $1
       ORDER BY position ASC, created_at ASC`,
      [id]
    );

    return sendSuccess(res, {
      template: {
        id: template.id,
        name: template.name,
        pipelineStage: template.pipeline_stage,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          taskType: item.task_type || 'call',
          dueDays: item.due_days,
          priority: item.priority,
          position: item.position
        }))
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Create a new checklist template
 * POST /api/checklist-templates
 */
const createTemplate = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userRole = req.user.role;

    // Only admin/supervisor can create templates
    if (userRole !== 'admin' && userRole !== 'supervisor') {
      throw new ForbiddenError('Only admins and supervisors can manage templates');
    }

    const { name, pipeline_stage, is_active = true, items = [] } = req.body;

    // Validate required fields
    if (!name || name.trim().length === 0) {
      throw new ValidationError('Template name is required');
    }

    if (!pipeline_stage || !VALID_STAGES.includes(pipeline_stage)) {
      throw new ValidationError(`Invalid pipeline stage. Must be one of: ${VALID_STAGES.join(', ')}`);
    }

    // Check if there's already an active template for this stage
    if (is_active) {
      const existing = await db.query(
        `SELECT id FROM checklist_templates
         WHERE account_id = $1 AND pipeline_stage = $2 AND is_active = true`,
        [accountId, pipeline_stage]
      );

      if (existing.rows.length > 0) {
        // Deactivate existing template
        await db.query(
          `UPDATE checklist_templates SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1`,
          [existing.rows[0].id]
        );
      }
    }

    const templateId = uuidv4();

    // Create template
    await db.insert('checklist_templates', {
      id: templateId,
      account_id: accountId,
      name: name.trim(),
      pipeline_stage,
      is_active,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Create items if provided
    if (items.length > 0) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (!item.title || item.title.trim().length === 0) continue;

        await db.insert('checklist_template_items', {
          id: uuidv4(),
          template_id: templateId,
          title: item.title.trim(),
          description: item.description || null,
          task_type: VALID_TASK_TYPES.includes(item.task_type) ? item.task_type : 'call',
          due_days: item.due_days || 0,
          priority: VALID_PRIORITIES.includes(item.priority) ? item.priority : 'medium',
          position: i,
          created_at: new Date()
        });
      }
    }

    // Fetch created template
    const result = await db.query(
      'SELECT * FROM checklist_templates WHERE id = $1',
      [templateId]
    );

    const itemsResult = await db.query(
      'SELECT * FROM checklist_template_items WHERE template_id = $1 ORDER BY position',
      [templateId]
    );

    const template = result.rows[0];

    return sendSuccess(res, {
      template: {
        id: template.id,
        name: template.name,
        pipelineStage: template.pipeline_stage,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          taskType: item.task_type || 'call',
          dueDays: item.due_days,
          priority: item.priority,
          position: item.position
        }))
      }
    }, 'Template created successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Update a checklist template
 * PUT /api/checklist-templates/:id
 */
const updateTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'supervisor') {
      throw new ForbiddenError('Only admins and supervisors can manage templates');
    }

    const { name, pipeline_stage, is_active } = req.body;

    // Get existing template
    const existing = await db.findOne('checklist_templates', { id, account_id: accountId });
    if (!existing) {
      throw new NotFoundError('Template not found');
    }

    const updates = { updated_at: new Date() };

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        throw new ValidationError('Template name cannot be empty');
      }
      updates.name = name.trim();
    }

    if (pipeline_stage !== undefined) {
      if (!VALID_STAGES.includes(pipeline_stage)) {
        throw new ValidationError(`Invalid pipeline stage. Must be one of: ${VALID_STAGES.join(', ')}`);
      }
      updates.pipeline_stage = pipeline_stage;
    }

    if (is_active !== undefined) {
      updates.is_active = is_active;

      // If activating, deactivate other templates for the same stage
      if (is_active) {
        const stage = pipeline_stage || existing.pipeline_stage;
        await db.query(
          `UPDATE checklist_templates
           SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE account_id = $1 AND pipeline_stage = $2 AND id != $3 AND is_active = true`,
          [accountId, stage, id]
        );
      }
    }

    await db.update('checklist_templates', updates, { id });

    // Fetch updated template
    const result = await db.query(
      'SELECT * FROM checklist_templates WHERE id = $1',
      [id]
    );

    const itemsResult = await db.query(
      'SELECT * FROM checklist_template_items WHERE template_id = $1 ORDER BY position',
      [id]
    );

    const template = result.rows[0];

    return sendSuccess(res, {
      template: {
        id: template.id,
        name: template.name,
        pipelineStage: template.pipeline_stage,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          taskType: item.task_type || 'call',
          dueDays: item.due_days,
          priority: item.priority,
          position: item.position
        }))
      }
    }, 'Template updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Delete a checklist template
 * DELETE /api/checklist-templates/:id
 */
const deleteTemplate = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'supervisor') {
      throw new ForbiddenError('Only admins and supervisors can manage templates');
    }

    const template = await db.findOne('checklist_templates', { id, account_id: accountId });
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    // Delete template (items will cascade)
    await db.query('DELETE FROM checklist_templates WHERE id = $1', [id]);

    return sendSuccess(res, null, 'Template deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Add an item to a template
 * POST /api/checklist-templates/:id/items
 */
const addItem = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'supervisor') {
      throw new ForbiddenError('Only admins and supervisors can manage templates');
    }

    const { title, description, task_type = 'call', due_days = 0, priority = 'medium' } = req.body;

    // Verify template exists
    const template = await db.findOne('checklist_templates', { id, account_id: accountId });
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    // Validate
    if (!title || title.trim().length === 0) {
      throw new ValidationError('Item title is required');
    }

    if (!VALID_PRIORITIES.includes(priority)) {
      throw new ValidationError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
    }

    const validTaskType = VALID_TASK_TYPES.includes(task_type) ? task_type : 'call';

    // Get max position
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM checklist_template_items WHERE template_id = $1',
      [id]
    );
    const position = posResult.rows[0].next_pos;

    const itemId = uuidv4();
    await db.insert('checklist_template_items', {
      id: itemId,
      template_id: id,
      title: title.trim(),
      description: description || null,
      task_type: validTaskType,
      due_days: parseInt(due_days) || 0,
      priority,
      position,
      created_at: new Date()
    });

    const item = await db.findOne('checklist_template_items', { id: itemId });

    return sendSuccess(res, {
      item: {
        id: item.id,
        title: item.title,
        description: item.description,
        taskType: item.task_type || 'call',
        dueDays: item.due_days,
        priority: item.priority,
        position: item.position
      }
    }, 'Item added successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Update an item in a template
 * PUT /api/checklist-templates/:id/items/:itemId
 */
const updateItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const accountId = req.user.account_id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'supervisor') {
      throw new ForbiddenError('Only admins and supervisors can manage templates');
    }

    const { title, description, task_type, due_days, priority } = req.body;

    // Verify template exists
    const template = await db.findOne('checklist_templates', { id, account_id: accountId });
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    // Verify item exists
    const item = await db.findOne('checklist_template_items', { id: itemId, template_id: id });
    if (!item) {
      throw new NotFoundError('Item not found');
    }

    const updates = {};

    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        throw new ValidationError('Item title cannot be empty');
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description || null;
    }

    if (task_type !== undefined) {
      if (VALID_TASK_TYPES.includes(task_type)) {
        updates.task_type = task_type;
      }
    }

    if (due_days !== undefined) {
      updates.due_days = parseInt(due_days) || 0;
    }

    if (priority !== undefined) {
      if (!VALID_PRIORITIES.includes(priority)) {
        throw new ValidationError(`Invalid priority. Must be one of: ${VALID_PRIORITIES.join(', ')}`);
      }
      updates.priority = priority;
    }

    if (Object.keys(updates).length > 0) {
      await db.update('checklist_template_items', updates, { id: itemId });
    }

    const updated = await db.findOne('checklist_template_items', { id: itemId });

    return sendSuccess(res, {
      item: {
        id: updated.id,
        title: updated.title,
        description: updated.description,
        taskType: updated.task_type || 'call',
        dueDays: updated.due_days,
        priority: updated.priority,
        position: updated.position
      }
    }, 'Item updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Delete an item from a template
 * DELETE /api/checklist-templates/:id/items/:itemId
 */
const deleteItem = async (req, res) => {
  try {
    const { id, itemId } = req.params;
    const accountId = req.user.account_id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'supervisor') {
      throw new ForbiddenError('Only admins and supervisors can manage templates');
    }

    // Verify template exists
    const template = await db.findOne('checklist_templates', { id, account_id: accountId });
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    // Verify item exists
    const item = await db.findOne('checklist_template_items', { id: itemId, template_id: id });
    if (!item) {
      throw new NotFoundError('Item not found');
    }

    await db.query('DELETE FROM checklist_template_items WHERE id = $1', [itemId]);

    return sendSuccess(res, null, 'Item deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Reorder items in a template
 * PATCH /api/checklist-templates/:id/items/reorder
 */
const reorderItems = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userRole = req.user.role;

    if (userRole !== 'admin' && userRole !== 'supervisor') {
      throw new ForbiddenError('Only admins and supervisors can manage templates');
    }

    const { items } = req.body;  // Array of { id, position }

    // Verify template exists
    const template = await db.findOne('checklist_templates', { id, account_id: accountId });
    if (!template) {
      throw new NotFoundError('Template not found');
    }

    if (!Array.isArray(items) || items.length === 0) {
      throw new ValidationError('Items array is required');
    }

    // Update positions
    for (const item of items) {
      if (item.id && typeof item.position === 'number') {
        await db.query(
          'UPDATE checklist_template_items SET position = $1 WHERE id = $2 AND template_id = $3',
          [item.position, item.id, id]
        );
      }
    }

    // Fetch updated items
    const itemsResult = await db.query(
      'SELECT * FROM checklist_template_items WHERE template_id = $1 ORDER BY position',
      [id]
    );

    return sendSuccess(res, {
      items: itemsResult.rows.map(item => ({
        id: item.id,
        title: item.title,
        description: item.description,
        taskType: item.task_type || 'call',
        dueDays: item.due_days,
        priority: item.priority,
        position: item.position
      }))
    }, 'Items reordered successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get template for a specific pipeline stage
 * GET /api/checklist-templates/by-stage/:stage
 */
const getTemplateByStage = async (req, res) => {
  try {
    const { stage } = req.params;
    const accountId = req.user.account_id;

    if (!VALID_STAGES.includes(stage)) {
      throw new ValidationError(`Invalid pipeline stage. Must be one of: ${VALID_STAGES.join(', ')}`);
    }

    const templateResult = await db.query(
      `SELECT * FROM checklist_templates
       WHERE account_id = $1 AND pipeline_stage = $2 AND is_active = true
       LIMIT 1`,
      [accountId, stage]
    );

    if (templateResult.rows.length === 0) {
      return sendSuccess(res, { template: null });
    }

    const template = templateResult.rows[0];

    const itemsResult = await db.query(
      'SELECT * FROM checklist_template_items WHERE template_id = $1 ORDER BY position',
      [template.id]
    );

    return sendSuccess(res, {
      template: {
        id: template.id,
        name: template.name,
        pipelineStage: template.pipeline_stage,
        isActive: template.is_active,
        createdAt: template.created_at,
        updatedAt: template.updated_at,
        items: itemsResult.rows.map(item => ({
          id: item.id,
          title: item.title,
          description: item.description,
          taskType: item.task_type || 'call',
          dueDays: item.due_days,
          priority: item.priority,
          position: item.position
        }))
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getTemplates,
  getTemplate,
  createTemplate,
  updateTemplate,
  deleteTemplate,
  addItem,
  updateItem,
  deleteItem,
  reorderItems,
  getTemplateByStage
};
