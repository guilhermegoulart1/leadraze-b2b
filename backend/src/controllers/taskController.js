// backend/src/controllers/taskController.js
// Unified task system using checklist_items as the data source
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { ValidationError, NotFoundError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

const VALID_TASK_TYPES = ['call', 'meeting', 'email', 'follow_up', 'proposal', 'other'];

/**
 * Helper function to get assignees for a checklist item
 */
const getItemAssignees = async (itemId) => {
  const query = `
    SELECT u.id, u.name, u.email, u.avatar_url as "avatarUrl"
    FROM checklist_item_assignees cia
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
  await db.query('DELETE FROM checklist_item_assignees WHERE checklist_item_id = $1', [itemId]);

  if (userIds && userIds.length > 0) {
    const values = userIds.map((userId, idx) =>
      `($1, $${idx + 2}, $${userIds.length + 2}, NOW())`
    ).join(', ');

    const params = [itemId, ...userIds, assignedBy];
    await db.query(
      `INSERT INTO checklist_item_assignees (checklist_item_id, user_id, assigned_by, assigned_at) VALUES ${values}`,
      params
    );
  }
};

/**
 * Format task for API response
 */
const formatTask = (row, assignees = []) => {
  return {
    id: row.id,
    title: row.title,
    description: row.description || null,
    taskType: row.task_type || 'call',
    status: row.status || (row.is_completed ? 'completed' : 'pending'),
    priority: row.priority || 'medium',
    isCompleted: row.is_completed,
    dueDate: row.due_date,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    checklistId: row.checklist_id,
    checklistName: row.checklist_name,
    lead: row.lead_id ? {
      id: row.lead_id,
      name: row.lead_name,
      company: row.lead_company
    } : null,
    assignees: assignees,
    // Keep backward compatibility with single assignee
    assignedTo: assignees.length > 0 ? assignees[0] : null
  };
};

/**
 * List all tasks (checklist items) with filters
 * GET /api/tasks
 */
const getTasks = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const {
      lead_id,
      assigned_to,
      status,
      task_type,
      due_date_from,
      due_date_to,
      search,
      include_completed = 'false',
      page = 1,
      limit = 100
    } = req.query;

    const offset = (parseInt(page) - 1) * parseInt(limit);
    const params = [accountId];
    let paramIndex = 2;

    let whereClause = 'WHERE c.account_id = $1';

    // Filter by lead
    if (lead_id) {
      whereClause += ` AND c.lead_id = $${paramIndex++}`;
      params.push(lead_id);
    }

    // Filter by assigned user
    if (assigned_to) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM checklist_item_assignees cia
        WHERE cia.checklist_item_id = i.id AND cia.user_id = $${paramIndex++}
      )`;
      params.push(assigned_to);
    }

    // Filter by status (completed/pending)
    if (status === 'completed') {
      whereClause += ` AND i.is_completed = true`;
    } else if (status === 'pending') {
      whereClause += ` AND i.is_completed = false`;
    } else if (include_completed !== 'true') {
      whereClause += ` AND i.is_completed = false`;
    }

    // Filter by task type
    if (task_type) {
      const types = task_type.split(',').filter(t => VALID_TASK_TYPES.includes(t));
      if (types.length > 0) {
        whereClause += ` AND i.task_type = ANY($${paramIndex++})`;
        params.push(types);
      }
    }

    // Filter by due date range
    if (due_date_from) {
      whereClause += ` AND i.due_date >= $${paramIndex++}`;
      params.push(due_date_from);
    }
    if (due_date_to) {
      whereClause += ` AND i.due_date <= $${paramIndex++}`;
      params.push(due_date_to);
    }

    // Search in title
    if (search) {
      whereClause += ` AND i.title ILIKE $${paramIndex++}`;
      params.push(`%${search}%`);
    }

    // Role-based visibility (non-admin users see tasks from their leads or assigned to them)
    if (userRole !== 'admin' && userRole !== 'supervisor') {
      whereClause += ` AND (
        l.responsible_user_id = $${paramIndex} OR
        EXISTS (SELECT 1 FROM checklist_item_assignees cia WHERE cia.checklist_item_id = i.id AND cia.user_id = $${paramIndex})
      )`;
      params.push(userId);
      paramIndex++;
    }

    // Count total
    const countQuery = `
      SELECT COUNT(*) as total
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      ${whereClause}
    `;
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].total);

    // Get tasks with relations
    const query = `
      SELECT
        i.*,
        c.name as checklist_name,
        c.lead_id,
        l.name as lead_name,
        l.company as lead_company
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      ${whereClause}
      ORDER BY
        CASE WHEN i.is_completed THEN 1 ELSE 0 END,
        CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END,
        i.due_date ASC,
        i.created_at DESC
      LIMIT $${paramIndex++} OFFSET $${paramIndex}
    `;
    params.push(parseInt(limit), offset);

    const result = await db.query(query, params);

    // Get assignees for all items
    const itemIds = result.rows.map(r => r.id);
    let assigneesMap = {};

    if (itemIds.length > 0) {
      const assigneesQuery = `
        SELECT
          cia.checklist_item_id,
          u.id, u.name, u.email, u.avatar_url as "avatarUrl"
        FROM checklist_item_assignees cia
        JOIN users u ON cia.user_id = u.id
        WHERE cia.checklist_item_id = ANY($1)
        ORDER BY cia.assigned_at
      `;
      const assigneesResult = await db.query(assigneesQuery, [itemIds]);

      for (const row of assigneesResult.rows) {
        if (!assigneesMap[row.checklist_item_id]) {
          assigneesMap[row.checklist_item_id] = [];
        }
        assigneesMap[row.checklist_item_id].push({
          id: row.id,
          name: row.name,
          email: row.email,
          avatarUrl: row.avatarUrl
        });
      }
    }

    return sendSuccess(res, {
      tasks: result.rows.map(row => formatTask(row, assigneesMap[row.id] || [])),
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit))
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get tasks grouped for board view
 * GET /api/tasks/board
 */
const getTasksBoard = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userId = req.user.id;
    const userRole = req.user.role;

    const {
      group_by = 'due_date',
      assigned_to,
      lead_id
    } = req.query;

    const params = [accountId];
    let paramIndex = 2;

    // Include all tasks (completed and pending) - frontend will filter
    let whereClause = 'WHERE c.account_id = $1';

    if (assigned_to) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM checklist_item_assignees cia
        WHERE cia.checklist_item_id = i.id AND cia.user_id = $${paramIndex++}
      )`;
      params.push(assigned_to);
    }

    if (lead_id) {
      whereClause += ` AND c.lead_id = $${paramIndex++}`;
      params.push(lead_id);
    }

    // Role-based visibility
    if (userRole !== 'admin' && userRole !== 'supervisor') {
      whereClause += ` AND (
        l.responsible_user_id = $${paramIndex} OR
        EXISTS (SELECT 1 FROM checklist_item_assignees cia WHERE cia.checklist_item_id = i.id AND cia.user_id = $${paramIndex})
      )`;
      params.push(userId);
      paramIndex++;
    }

    const query = `
      SELECT
        i.*,
        c.name as checklist_name,
        c.lead_id,
        l.name as lead_name,
        l.company as lead_company
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      ${whereClause}
      ORDER BY
        CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END,
        i.due_date ASC,
        i.created_at ASC
    `;

    const result = await db.query(query, params);

    // Get assignees for all items
    const itemIds = result.rows.map(r => r.id);
    let assigneesMap = {};

    if (itemIds.length > 0) {
      const assigneesQuery = `
        SELECT
          cia.checklist_item_id,
          u.id, u.name, u.email, u.avatar_url as "avatarUrl"
        FROM checklist_item_assignees cia
        JOIN users u ON cia.user_id = u.id
        WHERE cia.checklist_item_id = ANY($1)
        ORDER BY cia.assigned_at
      `;
      const assigneesResult = await db.query(assigneesQuery, [itemIds]);

      for (const row of assigneesResult.rows) {
        if (!assigneesMap[row.checklist_item_id]) {
          assigneesMap[row.checklist_item_id] = [];
        }
        assigneesMap[row.checklist_item_id].push({
          id: row.id,
          name: row.name,
          email: row.email,
          avatarUrl: row.avatarUrl
        });
      }
    }

    const tasks = result.rows.map(row => formatTask(row, assigneesMap[row.id] || []));

    let grouped;

    if (group_by === 'status') {
      // Group by status field (pending, in_progress, completed)
      grouped = {
        pending: tasks.filter(t => t.status === 'pending'),
        in_progress: tasks.filter(t => t.status === 'in_progress'),
        completed: tasks.filter(t => t.status === 'completed')
      };
    } else {
      // Group by due date
      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const endOfWeek = new Date(today);
      endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()));
      const endOfNextWeek = new Date(endOfWeek);
      endOfNextWeek.setDate(endOfNextWeek.getDate() + 7);

      grouped = {
        overdue: [],
        today: [],
        tomorrow: [],
        this_week: [],
        next_week: [],
        later: [],
        no_date: []
      };

      for (const task of tasks) {
        if (!task.dueDate) {
          grouped.no_date.push(task);
        } else {
          const dueDate = new Date(task.dueDate);
          const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

          if (dueDateOnly < today) {
            grouped.overdue.push(task);
          } else if (dueDateOnly.getTime() === today.getTime()) {
            grouped.today.push(task);
          } else if (dueDateOnly.getTime() === tomorrow.getTime()) {
            grouped.tomorrow.push(task);
          } else if (dueDateOnly <= endOfWeek) {
            grouped.this_week.push(task);
          } else if (dueDateOnly <= endOfNextWeek) {
            grouped.next_week.push(task);
          } else {
            grouped.later.push(task);
          }
        }
      }
    }

    return sendSuccess(res, { grouped, groupBy: group_by });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get task statistics
 * GET /api/tasks/stats
 */
const getTaskStats = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userId = req.user.id;
    const userRole = req.user.role;
    const { assigned_to, lead_id } = req.query;

    const params = [accountId];
    let paramIndex = 2;
    let whereClause = 'WHERE c.account_id = $1';

    if (assigned_to) {
      whereClause += ` AND EXISTS (
        SELECT 1 FROM checklist_item_assignees cia
        WHERE cia.checklist_item_id = i.id AND cia.user_id = $${paramIndex++}
      )`;
      params.push(assigned_to);
    }

    if (lead_id) {
      whereClause += ` AND c.lead_id = $${paramIndex++}`;
      params.push(lead_id);
    }

    if (userRole !== 'admin' && userRole !== 'supervisor') {
      whereClause += ` AND (
        l.responsible_user_id = $${paramIndex} OR
        EXISTS (SELECT 1 FROM checklist_item_assignees cia WHERE cia.checklist_item_id = i.id AND cia.user_id = $${paramIndex})
      )`;
      params.push(userId);
      paramIndex++;
    }

    const query = `
      SELECT
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE i.is_completed = false) as pending,
        COUNT(*) FILTER (WHERE i.is_completed = true) as completed,
        COUNT(*) FILTER (WHERE i.is_completed = false AND i.due_date < CURRENT_DATE) as overdue,
        COUNT(*) FILTER (WHERE i.is_completed = false AND i.due_date::date = CURRENT_DATE) as due_today
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      ${whereClause}
    `;

    const result = await db.query(query, params);
    const stats = result.rows[0];

    return sendSuccess(res, {
      stats: {
        total: parseInt(stats.total),
        pending: parseInt(stats.pending),
        inProgress: 0, // Not applicable
        completed: parseInt(stats.completed),
        cancelled: 0, // Not applicable
        overdue: parseInt(stats.overdue),
        dueToday: parseInt(stats.due_today)
      }
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get a single task
 * GET /api/tasks/:id
 */
const getTask = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const query = `
      SELECT
        i.*,
        c.name as checklist_name,
        c.lead_id,
        l.name as lead_name,
        l.company as lead_company
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE i.id = $1 AND c.account_id = $2
    `;

    const result = await db.query(query, [id, accountId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Task not found');
    }

    const assignees = await getItemAssignees(id);

    return sendSuccess(res, { task: formatTask(result.rows[0], assignees) });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Create a new task (as a checklist item)
 * POST /api/tasks
 */
const createTask = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userId = req.user.id;

    const {
      lead_id,
      checklist_id,
      title,
      task_type = 'call',
      due_date,
      assignees = []
    } = req.body;

    // Validate required fields
    if (!title || title.trim().length === 0) {
      throw new ValidationError('Task title is required');
    }

    if (!lead_id) {
      throw new ValidationError('Lead is required');
    }

    // Verify lead exists
    const lead = await db.findOne('leads', { id: lead_id, account_id: accountId });
    if (!lead) {
      throw new ValidationError('Lead not found');
    }

    let targetChecklistId = checklist_id;

    // If no checklist specified, create or use default "Tarefas" checklist
    if (!targetChecklistId) {
      const existingChecklist = await db.query(
        `SELECT id FROM lead_checklists WHERE lead_id = $1 AND name = 'Tarefas' AND account_id = $2`,
        [lead_id, accountId]
      );

      if (existingChecklist.rows.length > 0) {
        targetChecklistId = existingChecklist.rows[0].id;
      } else {
        // Create default checklist
        targetChecklistId = uuidv4();
        await db.insert('lead_checklists', {
          id: targetChecklistId,
          account_id: accountId,
          lead_id: lead_id,
          name: 'Tarefas',
          position: 0,
          created_by: userId,
          created_at: new Date(),
          updated_at: new Date()
        });
      }
    } else {
      // Verify checklist exists
      const checklist = await db.findOne('lead_checklists', { id: checklist_id, account_id: accountId });
      if (!checklist) {
        throw new ValidationError('Checklist not found');
      }
    }

    // Get max position
    const posResult = await db.query(
      'SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM checklist_items WHERE checklist_id = $1',
      [targetChecklistId]
    );
    const position = posResult.rows[0].next_pos;

    const itemId = uuidv4();
    const validTaskType = VALID_TASK_TYPES.includes(task_type) ? task_type : 'call';

    await db.insert('checklist_items', {
      id: itemId,
      checklist_id: targetChecklistId,
      title: title.trim(),
      task_type: validTaskType,
      is_completed: false,
      due_date: due_date || null,
      position,
      created_at: new Date(),
      updated_at: new Date()
    });

    // Set assignees
    const assigneeIds = Array.isArray(assignees) ? assignees : (assignees ? [assignees] : []);
    if (assigneeIds.length > 0) {
      await setItemAssignees(itemId, assigneeIds, userId);
    }

    // Fetch created task
    const query = `
      SELECT
        i.*,
        c.name as checklist_name,
        c.lead_id,
        l.name as lead_name,
        l.company as lead_company
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE i.id = $1
    `;
    const result = await db.query(query, [itemId]);
    const assigneesData = await getItemAssignees(itemId);

    return sendSuccess(res, { task: formatTask(result.rows[0], assigneesData) }, 'Task created successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Update a task
 * PUT /api/tasks/:id
 */
const updateTask = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    const {
      title,
      description,
      task_type,
      due_date,
      assignees,
      status,
      priority
    } = req.body;

    // Get existing item
    const existingQuery = `
      SELECT i.*, c.account_id
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      WHERE i.id = $1 AND c.account_id = $2
    `;
    const existingResult = await db.query(existingQuery, [id, accountId]);

    if (existingResult.rows.length === 0) {
      throw new NotFoundError('Task not found');
    }

    // Build update object
    const updates = { updated_at: new Date() };

    if (title !== undefined) {
      if (!title || title.trim().length === 0) {
        throw new ValidationError('Task title cannot be empty');
      }
      updates.title = title.trim();
    }

    if (description !== undefined) {
      updates.description = description ? description.trim() : null;
    }

    if (task_type !== undefined) {
      if (VALID_TASK_TYPES.includes(task_type)) {
        updates.task_type = task_type;
      }
    }

    if (due_date !== undefined) {
      updates.due_date = due_date || null;
    }

    if (priority !== undefined) {
      const validPriorities = ['low', 'medium', 'high', 'urgent'];
      if (validPriorities.includes(priority)) {
        updates.priority = priority;
      }
    }

    if (status !== undefined) {
      updates.status = status;
      updates.is_completed = status === 'completed';
      if (status === 'completed' && !existingResult.rows[0].is_completed) {
        updates.completed_at = new Date();
      } else if (status !== 'completed' && existingResult.rows[0].is_completed) {
        updates.completed_at = null;
      }
    }

    await db.update('checklist_items', updates, { id });

    // Handle assignees update
    if (assignees !== undefined) {
      const assigneeIds = Array.isArray(assignees) ? assignees : (assignees ? [assignees] : []);
      await setItemAssignees(id, assigneeIds, userId);
    }

    // Fetch updated task
    const query = `
      SELECT
        i.*,
        c.name as checklist_name,
        c.lead_id,
        l.name as lead_name,
        l.company as lead_company
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE i.id = $1
    `;
    const result = await db.query(query, [id]);
    const assigneesData = await getItemAssignees(id);

    return sendSuccess(res, { task: formatTask(result.rows[0], assigneesData) }, 'Task updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Delete a task
 * DELETE /api/tasks/:id
 */
const deleteTask = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const checkQuery = `
      SELECT i.id
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      WHERE i.id = $1 AND c.account_id = $2
    `;
    const checkResult = await db.query(checkQuery, [id, accountId]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Task not found');
    }

    await db.query('DELETE FROM checklist_items WHERE id = $1', [id]);

    return sendSuccess(res, null, 'Task deleted successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Complete/toggle a task
 * PATCH /api/tasks/:id/complete
 */
const completeTask = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    const checkQuery = `
      SELECT i.*
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      WHERE i.id = $1 AND c.account_id = $2
    `;
    const checkResult = await db.query(checkQuery, [id, accountId]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Task not found');
    }

    const item = checkResult.rows[0];
    const newCompleted = !item.is_completed;

    await db.update('checklist_items', {
      is_completed: newCompleted,
      completed_at: newCompleted ? new Date() : null,
      completed_by: newCompleted ? userId : null,
      updated_at: new Date()
    }, { id });

    // Fetch updated task
    const query = `
      SELECT
        i.*,
        c.name as checklist_name,
        c.lead_id,
        l.name as lead_name,
        l.company as lead_company
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE i.id = $1
    `;
    const result = await db.query(query, [id]);
    const assigneesData = await getItemAssignees(id);

    return sendSuccess(res, {
      task: formatTask(result.rows[0], assigneesData)
    }, newCompleted ? 'Task completed' : 'Task reopened');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Update task status (toggle completion)
 * PATCH /api/tasks/:id/status
 */
const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    const checkQuery = `
      SELECT i.*
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      WHERE i.id = $1 AND c.account_id = $2
    `;
    const checkResult = await db.query(checkQuery, [id, accountId]);

    if (checkResult.rows.length === 0) {
      throw new NotFoundError('Task not found');
    }

    // Map status to is_completed and save status field
    const isCompleted = status === 'completed';

    await db.update('checklist_items', {
      status: status,
      is_completed: isCompleted,
      completed_at: isCompleted ? new Date() : null,
      completed_by: isCompleted ? userId : null,
      updated_at: new Date()
    }, { id });

    // Fetch updated task
    const query = `
      SELECT
        i.*,
        c.name as checklist_name,
        c.lead_id,
        l.name as lead_name,
        l.company as lead_company
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE i.id = $1
    `;
    const result = await db.query(query, [id]);
    const assigneesData = await getItemAssignees(id);

    return sendSuccess(res, { task: formatTask(result.rows[0], assigneesData) }, 'Status updated');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

/**
 * Get tasks for a specific lead
 * GET /api/leads/:leadId/tasks
 */
const getLeadTasks = async (req, res) => {
  try {
    const { leadId } = req.params;
    const accountId = req.user.account_id;

    // Verify lead exists
    const lead = await db.findOne('leads', { id: leadId, account_id: accountId });
    if (!lead) {
      throw new NotFoundError('Lead not found');
    }

    const query = `
      SELECT
        i.*,
        c.name as checklist_name,
        c.lead_id,
        l.name as lead_name,
        l.company as lead_company
      FROM checklist_items i
      JOIN lead_checklists c ON i.checklist_id = c.id
      LEFT JOIN leads l ON c.lead_id = l.id
      WHERE c.lead_id = $1 AND c.account_id = $2
      ORDER BY
        CASE WHEN i.is_completed THEN 1 ELSE 0 END,
        CASE WHEN i.due_date IS NULL THEN 1 ELSE 0 END,
        i.due_date ASC,
        i.created_at DESC
    `;

    const result = await db.query(query, [leadId, accountId]);

    // Get assignees for all items
    const itemIds = result.rows.map(r => r.id);
    let assigneesMap = {};

    if (itemIds.length > 0) {
      const assigneesQuery = `
        SELECT
          cia.checklist_item_id,
          u.id, u.name, u.email, u.avatar_url as "avatarUrl"
        FROM checklist_item_assignees cia
        JOIN users u ON cia.user_id = u.id
        WHERE cia.checklist_item_id = ANY($1)
        ORDER BY cia.assigned_at
      `;
      const assigneesResult = await db.query(assigneesQuery, [itemIds]);

      for (const row of assigneesResult.rows) {
        if (!assigneesMap[row.checklist_item_id]) {
          assigneesMap[row.checklist_item_id] = [];
        }
        assigneesMap[row.checklist_item_id].push({
          id: row.id,
          name: row.name,
          email: row.email,
          avatarUrl: row.avatarUrl
        });
      }
    }

    return sendSuccess(res, {
      tasks: result.rows.map(row => formatTask(row, assigneesMap[row.id] || []))
    });

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  getTasks,
  getTasksBoard,
  getTaskStats,
  getTask,
  createTask,
  updateTask,
  deleteTask,
  completeTask,
  updateTaskStatus,
  getLeadTasks
};
