// backend/src/controllers/checklistController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

/**
 * Helper function to get assignees for a checklist item
 */
const getItemAssignees = async (itemId) => {
  const query = `
    SELECT u.id, u.name, u.avatar_url as "avatarUrl"
    FROM opportunity_checklist_item_assignees cia
    JOIN users u ON cia.user_id = u.id
    WHERE cia.checklist_item_id = $1
    ORDER BY cia.assigned_at
  `;
  const result = await db.query(query, [itemId]);
  return result.rows;
};

/**
 * Helper function to set assignees for a checklist item
 */
const setItemAssignees = async (itemId, userIds, assignedBy) => {
  // Remove existing assignees
  await db.query('DELETE FROM opportunity_checklist_item_assignees WHERE checklist_item_id = $1', [itemId]);

  // Add new assignees
  if (userIds && userIds.length > 0) {
    const values = userIds.map((userId, idx) =>
      `($1, $${idx + 2}, $${userIds.length + 2}, NOW())`
    ).join(', ');

    const params = [itemId, ...userIds, assignedBy];
    await db.query(
      `INSERT INTO opportunity_checklist_item_assignees (checklist_item_id, user_id, assigned_by, assigned_at) VALUES ${values}`,
      params
    );
  }
};

/**
 * Get all checklists for an opportunity
 * GET /api/opportunities/:opportunityId/checklists
 */
const getOpportunityChecklists = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const accountId = req.user.account_id;

    // Verify opportunity exists and belongs to account
    const opportunity = await db.findOne('opportunities', { id: opportunityId, account_id: accountId });
    if (!opportunity) {
      throw new NotFoundError('Opportunity not found');
    }

    // Get checklists with items
    const query = `
      SELECT
        c.id,
        c.name,
        c.position,
        c.created_at,
        (
          SELECT json_agg(
            json_build_object(
              'id', i.id,
              'title', COALESCE(i.title, i.content),
              'taskType', COALESCE(i.task_type, 'call'),
              'isCompleted', i.is_completed,
              'completedAt', i.completed_at,
              'dueDate', i.due_date,
              'position', i.position,
              'assignees', (
                SELECT COALESCE(json_agg(
                  json_build_object(
                    'id', u.id,
                    'name', u.name,
                    'avatarUrl', u.avatar_url
                  ) ORDER BY cia.assigned_at
                ), '[]'::json)
                FROM opportunity_checklist_item_assignees cia
                JOIN users u ON cia.user_id = u.id
                WHERE cia.checklist_item_id = i.id
              )
            ) ORDER BY i.position, i.created_at
          )
          FROM opportunity_checklist_items i
          WHERE i.checklist_id = c.id
        ) as items
      FROM opportunity_checklists c
      WHERE c.opportunity_id = $1 AND c.account_id = $2
      ORDER BY c.position, c.created_at
    `;

    const result = await db.query(query, [opportunityId, accountId]);

    const checklists = result.rows.map(row => ({
      id: row.id,
      name: row.name,
      position: row.position,
      createdAt: row.created_at,
      items: row.items || [],
      completedCount: (row.items || []).filter(i => i.isCompleted).length,
      totalCount: (row.items || []).length
    }));

    return sendSuccess(res, { checklists });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Create a new checklist
 * POST /api/opportunities/:opportunityId/checklists
 */
const createChecklist = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const { name } = req.body;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    if (!name || name.trim().length === 0) {
      throw new ValidationError('Checklist name is required');
    }

    // Verify opportunity exists
    const opportunity = await db.findOne('opportunities', { id: opportunityId, account_id: accountId });
    if (!opportunity) {
      throw new NotFoundError('Opportunity not found');
    }

    // Get max position
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM opportunity_checklists WHERE opportunity_id = $1',
      [opportunityId]
    );
    const position = posResult.rows[0].next_pos;

    const checklist = {
      id: uuidv4(),
      account_id: accountId,
      opportunity_id: opportunityId,
      name: name.trim(),
      position,
      created_by: userId,
      created_at: new Date(),
      updated_at: new Date()
    };

    await db.insert('opportunity_checklists', checklist);

    return sendSuccess(res, {
      checklist: {
        id: checklist.id,
        name: checklist.name,
        position: checklist.position,
        createdAt: checklist.created_at,
        items: [],
        completedCount: 0,
        totalCount: 0
      }
    }, 'Checklist created', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Update a checklist
 * PUT /api/checklists/:id
 */
const updateChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;
    const accountId = req.user.account_id;

    const checklist = await db.findOne('opportunity_checklists', { id, account_id: accountId });
    if (!checklist) {
      throw new NotFoundError('Checklist not found');
    }

    if (name !== undefined) {
      if (!name || name.trim().length === 0) {
        throw new ValidationError('Checklist name cannot be empty');
      }
      await db.update('opportunity_checklists', { name: name.trim(), updated_at: new Date() }, { id });
    }

    return sendSuccess(res, { checklist: { ...checklist, name: name?.trim() || checklist.name } });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Delete a checklist
 * DELETE /api/checklists/:id
 */
const deleteChecklist = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const checklist = await db.findOne('opportunity_checklists', { id, account_id: accountId });
    if (!checklist) {
      throw new NotFoundError('Checklist not found');
    }

    await db.query('DELETE FROM opportunity_checklists WHERE id = $1', [id]);

    return sendSuccess(res, null, 'Checklist deleted');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Add item to checklist
 * POST /api/checklists/:checklistId/items
 */
const VALID_TASK_TYPES = ['call', 'meeting', 'email', 'follow_up', 'proposal', 'other'];

const createChecklistItem = async (req, res) => {
  try {
    const { checklistId } = req.params;
    const { title, assignees, task_type = 'call', due_date } = req.body;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    // DEBUG: Log incoming due_date
    console.log('[createChecklistItem] Incoming req.body:', JSON.stringify(req.body, null, 2));
    console.log('[createChecklistItem] due_date raw:', due_date);
    console.log('[createChecklistItem] due_date type:', typeof due_date);

    if (!title || title.trim().length === 0) {
      throw new ValidationError('Item title is required');
    }

    // Validate task type
    const validTaskType = VALID_TASK_TYPES.includes(task_type) ? task_type : 'call';

    // Verify checklist exists and belongs to account
    const checklist = await db.findOne('opportunity_checklists', { id: checklistId, account_id: accountId });
    if (!checklist) {
      throw new NotFoundError('Checklist not found');
    }

    // Get max position
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM opportunity_checklist_items WHERE checklist_id = $1',
      [checklistId]
    );
    const position = posResult.rows[0].next_pos;

    const itemId = uuidv4();

    // Pass ISO string directly to PostgreSQL (not Date object) to avoid timezone conversion
    const toISOString = (dateStr) => {
      if (!dateStr) return null;
      if (dateStr.includes('Z') || dateStr.includes('+') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
        return dateStr;
      }
      return dateStr.includes(':') && dateStr.split(':').length === 2
        ? dateStr + ':00Z'
        : dateStr + 'Z';
    };

    const dueDateISO = toISOString(due_date);

    // DEBUG: Log date
    console.log('[createChecklistItem] due_date input:', due_date);
    console.log('[createChecklistItem] due_date stored:', dueDateISO);

    const item = {
      id: itemId,
      checklist_id: checklistId,
      title: title.trim(),
      content: title.trim(),
      task_type: validTaskType,
      is_completed: false,
      due_date: dueDateISO,
      position,
      created_at: new Date(),
      updated_at: new Date()
    };

    // DEBUG: Log final item
    console.log('[createChecklistItem] Final item to insert:', JSON.stringify(item, null, 2));

    await db.insert('opportunity_checklist_items', item);

    // Handle assignees (array of user IDs)
    const assigneeIds = Array.isArray(assignees) ? assignees : (assignees ? [assignees] : []);
    if (assigneeIds.length > 0) {
      await setItemAssignees(itemId, assigneeIds, userId);
    }

    // Get assignees info
    const assigneesData = await getItemAssignees(itemId);

    return sendSuccess(res, {
      item: {
        id: item.id,
        title: item.title,
        taskType: item.task_type,
        isCompleted: item.is_completed,
        completedAt: null,
        dueDate: item.due_date,
        position: item.position,
        assignees: assigneesData
      }
    }, 'Item added', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Update checklist item
 * PUT /api/checklist-items/:id
 */
const updateChecklistItem = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, is_completed, assignees, due_date } = req.body;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    // DEBUG: Log incoming data
    console.log('[updateChecklistItem] Item ID:', id);
    console.log('[updateChecklistItem] Incoming req.body:', JSON.stringify(req.body, null, 2));
    console.log('[updateChecklistItem] due_date raw:', due_date);
    console.log('[updateChecklistItem] due_date type:', typeof due_date);

    // Get item with checklist to verify ownership
    const itemQuery = `
      SELECT i.*, c.account_id
      FROM opportunity_checklist_items i
      JOIN opportunity_checklists c ON i.checklist_id = c.id
      WHERE i.id = $1 AND c.account_id = $2
    `;
    const itemResult = await db.query(itemQuery, [id, accountId]);

    if (itemResult.rows.length === 0) {
      throw new NotFoundError('Item not found');
    }

    const item = itemResult.rows[0];
    const updates = { updated_at: new Date() };

    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        throw new ValidationError('Item title cannot be empty');
      }
      updates.title = title.trim();
      updates.content = title.trim();
    }

    if (is_completed !== undefined) {
      updates.is_completed = is_completed;
      if (is_completed && !item.is_completed) {
        updates.completed_at = new Date();
        updates.completed_by = userId;
      } else if (!is_completed) {
        updates.completed_at = null;
        updates.completed_by = null;
      }
    }

    if (due_date !== undefined) {
      // Pass ISO string directly to PostgreSQL (not Date object) to avoid timezone conversion
      const toISOString = (dateStr) => {
        if (!dateStr) return null;
        if (dateStr.includes('Z') || dateStr.includes('+') || /[+-]\d{2}:\d{2}$/.test(dateStr)) {
          return dateStr;
        }
        return dateStr.includes(':') && dateStr.split(':').length === 2
          ? dateStr + ':00Z'
          : dateStr + 'Z';
      };

      updates.due_date = toISOString(due_date);
      console.log('[updateChecklistItem] due_date input:', due_date);
      console.log('[updateChecklistItem] due_date stored:', updates.due_date);
    }

    // DEBUG: Log final updates object
    console.log('[updateChecklistItem] Final updates:', JSON.stringify(updates, null, 2));

    await db.update('opportunity_checklist_items', updates, { id });

    // Handle assignees update
    if (assignees !== undefined) {
      const assigneeIds = Array.isArray(assignees) ? assignees : (assignees ? [assignees] : []);
      await setItemAssignees(id, assigneeIds, userId);
    }

    // Get updated item with assignees
    const updatedQuery = `
      SELECT i.*
      FROM opportunity_checklist_items i
      WHERE i.id = $1
    `;
    const updatedResult = await db.query(updatedQuery, [id]);
    const updated = updatedResult.rows[0];
    const assigneesData = await getItemAssignees(id);

    return sendSuccess(res, {
      item: {
        id: updated.id,
        title: updated.title || updated.content,
        taskType: updated.task_type || 'call',
        isCompleted: updated.is_completed,
        completedAt: updated.completed_at,
        dueDate: updated.due_date,
        position: updated.position,
        assignees: assigneesData
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Delete checklist item
 * DELETE /api/checklist-items/:id
 */
const deleteChecklistItem = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Verify ownership
    const itemQuery = `
      SELECT i.id
      FROM opportunity_checklist_items i
      JOIN opportunity_checklists c ON i.checklist_id = c.id
      WHERE i.id = $1 AND c.account_id = $2
    `;
    const itemResult = await db.query(itemQuery, [id, accountId]);

    if (itemResult.rows.length === 0) {
      throw new NotFoundError('Item not found');
    }

    await db.query('DELETE FROM opportunity_checklist_items WHERE id = $1', [id]);

    return sendSuccess(res, null, 'Item deleted');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Toggle item completion
 * PATCH /api/checklist-items/:id/toggle
 */
const toggleChecklistItem = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    // Get current item
    const itemQuery = `
      SELECT i.*, c.account_id
      FROM opportunity_checklist_items i
      JOIN opportunity_checklists c ON i.checklist_id = c.id
      WHERE i.id = $1 AND c.account_id = $2
    `;
    const itemResult = await db.query(itemQuery, [id, accountId]);

    if (itemResult.rows.length === 0) {
      throw new NotFoundError('Item not found');
    }

    const item = itemResult.rows[0];
    const newCompleted = !item.is_completed;

    await db.update('opportunity_checklist_items', {
      is_completed: newCompleted,
      completed_at: newCompleted ? new Date() : null,
      completed_by: newCompleted ? userId : null,
      updated_at: new Date()
    }, { id });

    // Get updated item with assignees
    const updatedQuery = `
      SELECT i.*
      FROM opportunity_checklist_items i
      WHERE i.id = $1
    `;
    const updatedResult = await db.query(updatedQuery, [id]);
    const updated = updatedResult.rows[0];
    const assigneesData = await getItemAssignees(id);

    return sendSuccess(res, {
      item: {
        id: updated.id,
        title: updated.title || updated.content,
        taskType: updated.task_type || 'call',
        isCompleted: updated.is_completed,
        completedAt: updated.completed_at,
        dueDate: updated.due_date,
        position: updated.position,
        assignees: assigneesData
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getOpportunityChecklists,
  createChecklist,
  updateChecklist,
  deleteChecklist,
  createChecklistItem,
  updateChecklistItem,
  deleteChecklistItem,
  toggleChecklistItem
};
