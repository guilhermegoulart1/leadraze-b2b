// backend/src/controllers/roadmapController.js
const db = require('../config/database');
const notificationService = require('../services/notificationService');

// ============================================
// ROADMAPS CRUD
// ============================================

// Get all roadmaps for the current user (own + global)
const getRoadmaps = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { search, active_only } = req.query;

    let query = `
      SELECT r.*,
             u.name as created_by_name,
             (SELECT COUNT(*) FROM roadmap_tasks WHERE roadmap_id = r.id) as task_count
       FROM roadmaps r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.account_id = $1
         AND (r.created_by = $2 OR r.is_global = true)
    `;
    const params = [accountId, userId];

    if (active_only === 'true') {
      query += ` AND r.is_active = true`;
    }

    if (search) {
      query += ` AND (LOWER(r.name) LIKE LOWER($${params.length + 1}) OR LOWER(r.shortcut) LIKE LOWER($${params.length + 1}))`;
      params.push(`%${search}%`);
    }

    query += ` ORDER BY r.is_global DESC, r.name ASC`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching roadmaps:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar roadmaps'
    });
  }
};

// Get a single roadmap with its tasks
const getRoadmap = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    const roadmapResult = await db.query(
      `SELECT r.*, u.name as created_by_name
       FROM roadmaps r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = $1 AND r.account_id = $2
         AND (r.created_by = $3 OR r.is_global = true)`,
      [id, accountId, userId]
    );

    if (roadmapResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    // Get tasks
    const tasksResult = await db.query(
      `SELECT rt.*, u.name as default_assignee_name
       FROM roadmap_tasks rt
       LEFT JOIN users u ON rt.default_assignee_id = u.id
       WHERE rt.roadmap_id = $1
       ORDER BY rt.position ASC`,
      [id]
    );

    const roadmap = roadmapResult.rows[0];
    roadmap.tasks = tasksResult.rows;

    res.json({
      success: true,
      data: roadmap
    });
  } catch (error) {
    console.error('Error fetching roadmap:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar roadmap'
    });
  }
};

// Create a new roadmap
const createRoadmap = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { name, description, shortcut, is_global, default_assignees, tasks } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Nome é obrigatório'
      });
    }

    // Only admins can create global roadmaps
    const isAdmin = req.user.role === 'admin';
    const globalValue = isAdmin ? (is_global || false) : false;

    await client.query('BEGIN');

    // Create roadmap
    const roadmapResult = await client.query(
      `INSERT INTO roadmaps (account_id, created_by, name, description, shortcut, is_global, default_assignees)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        accountId,
        userId,
        name.trim(),
        description || null,
        shortcut?.trim() || null,
        globalValue,
        default_assignees || []
      ]
    );

    const roadmap = roadmapResult.rows[0];

    // Create tasks if provided
    if (tasks && Array.isArray(tasks) && tasks.length > 0) {
      for (let i = 0; i < tasks.length; i++) {
        const task = tasks[i];
        await client.query(
          `INSERT INTO roadmap_tasks (roadmap_id, title, description, task_type, priority, relative_due_hours, relative_due_from, default_assignee_id, position)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            roadmap.id,
            task.title,
            task.description || null,
            task.task_type || 'other',
            task.priority || 'medium',
            task.relative_due_hours || 24,
            task.relative_due_from || 'roadmap_start',
            task.default_assignee_id || null,
            i
          ]
        );
      }
    }

    await client.query('COMMIT');

    // Fetch complete roadmap with tasks
    const completeRoadmap = await db.query(
      `SELECT r.*, u.name as created_by_name
       FROM roadmaps r
       LEFT JOIN users u ON r.created_by = u.id
       WHERE r.id = $1`,
      [roadmap.id]
    );

    const tasksResult = await db.query(
      `SELECT * FROM roadmap_tasks WHERE roadmap_id = $1 ORDER BY position ASC`,
      [roadmap.id]
    );

    const result = completeRoadmap.rows[0];
    result.tasks = tasksResult.rows;

    res.status(201).json({
      success: true,
      data: result
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error creating roadmap:', error);

    if (error.code === '23505' && error.constraint === 'idx_roadmaps_unique_shortcut') {
      return res.status(400).json({
        success: false,
        error: 'Este atalho já está em uso'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao criar roadmap'
    });
  } finally {
    client.release();
  }
};

// Update a roadmap
const updateRoadmap = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { name, description, shortcut, is_global, is_active, default_assignees } = req.body;

    // Check if user owns the roadmap or is admin
    const existing = await db.query(
      `SELECT * FROM roadmaps WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    const roadmap = existing.rows[0];
    const isAdmin = req.user.role === 'admin';

    // Only owner or admin can update
    if (roadmap.created_by !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar este roadmap'
      });
    }

    // Only admins can change is_global
    const globalValue = isAdmin ? (is_global !== undefined ? is_global : roadmap.is_global) : roadmap.is_global;

    const result = await db.query(
      `UPDATE roadmaps
       SET name = COALESCE($1, name),
           description = COALESCE($2, description),
           shortcut = COALESCE($3, shortcut),
           is_global = $4,
           is_active = COALESCE($5, is_active),
           default_assignees = COALESCE($6, default_assignees),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND account_id = $8
       RETURNING *`,
      [
        name?.trim(),
        description,
        shortcut?.trim(),
        globalValue,
        is_active,
        default_assignees,
        id,
        accountId
      ]
    );

    // Get tasks
    const tasksResult = await db.query(
      `SELECT * FROM roadmap_tasks WHERE roadmap_id = $1 ORDER BY position ASC`,
      [id]
    );

    const updatedRoadmap = result.rows[0];
    updatedRoadmap.tasks = tasksResult.rows;

    res.json({
      success: true,
      data: updatedRoadmap
    });
  } catch (error) {
    console.error('Error updating roadmap:', error);

    if (error.code === '23505' && error.constraint === 'idx_roadmaps_unique_shortcut') {
      return res.status(400).json({
        success: false,
        error: 'Este atalho já está em uso'
      });
    }

    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar roadmap'
    });
  }
};

// Delete a roadmap
const deleteRoadmap = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Check if user owns the roadmap or is admin
    const existing = await db.query(
      `SELECT * FROM roadmaps WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    const roadmap = existing.rows[0];
    const isAdmin = req.user.role === 'admin';

    // Only owner or admin can delete
    if (roadmap.created_by !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para excluir este roadmap'
      });
    }

    await db.query(
      `DELETE FROM roadmaps WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    res.json({
      success: true,
      message: 'Roadmap excluído com sucesso'
    });
  } catch (error) {
    console.error('Error deleting roadmap:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao excluir roadmap'
    });
  }
};

// ============================================
// ROADMAP TASKS CRUD
// ============================================

// Get tasks for a roadmap
const getRoadmapTasks = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Verify access to roadmap
    const roadmap = await db.query(
      `SELECT id FROM roadmaps WHERE id = $1 AND account_id = $2 AND (created_by = $3 OR is_global = true)`,
      [id, accountId, userId]
    );

    if (roadmap.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    const result = await db.query(
      `SELECT rt.*, u.name as default_assignee_name
       FROM roadmap_tasks rt
       LEFT JOIN users u ON rt.default_assignee_id = u.id
       WHERE rt.roadmap_id = $1
       ORDER BY rt.position ASC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching roadmap tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar tarefas do roadmap'
    });
  }
};

// Add task to roadmap
const addRoadmapTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { title, description, task_type, priority, relative_due_hours, relative_due_from, default_assignee_id } = req.body;

    if (!title) {
      return res.status(400).json({
        success: false,
        error: 'Título é obrigatório'
      });
    }

    // Verify ownership
    const roadmap = await db.query(
      `SELECT * FROM roadmaps WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (roadmap.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    const isAdmin = req.user.role === 'admin';
    if (roadmap.rows[0].created_by !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar este roadmap'
      });
    }

    // Get next position
    const posResult = await db.query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos FROM roadmap_tasks WHERE roadmap_id = $1`,
      [id]
    );

    const result = await db.query(
      `INSERT INTO roadmap_tasks (roadmap_id, title, description, task_type, priority, relative_due_hours, relative_due_from, default_assignee_id, position)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [
        id,
        title.trim(),
        description || null,
        task_type || 'other',
        priority || 'medium',
        relative_due_hours || 24,
        relative_due_from || 'roadmap_start',
        default_assignee_id || null,
        posResult.rows[0].next_pos
      ]
    );

    res.status(201).json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error adding roadmap task:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao adicionar tarefa'
    });
  }
};

// Update roadmap task
const updateRoadmapTask = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { title, description, task_type, priority, relative_due_hours, relative_due_from, default_assignee_id } = req.body;

    // Verify ownership
    const roadmap = await db.query(
      `SELECT r.* FROM roadmaps r
       JOIN roadmap_tasks rt ON rt.roadmap_id = r.id
       WHERE rt.id = $1 AND r.id = $2 AND r.account_id = $3`,
      [taskId, id, accountId]
    );

    if (roadmap.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
      });
    }

    const isAdmin = req.user.role === 'admin';
    if (roadmap.rows[0].created_by !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar este roadmap'
      });
    }

    const result = await db.query(
      `UPDATE roadmap_tasks
       SET title = COALESCE($1, title),
           description = COALESCE($2, description),
           task_type = COALESCE($3, task_type),
           priority = COALESCE($4, priority),
           relative_due_hours = COALESCE($5, relative_due_hours),
           relative_due_from = COALESCE($6, relative_due_from),
           default_assignee_id = $7
       WHERE id = $8 AND roadmap_id = $9
       RETURNING *`,
      [
        title?.trim(),
        description,
        task_type,
        priority,
        relative_due_hours,
        relative_due_from,
        default_assignee_id,
        taskId,
        id
      ]
    );

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating roadmap task:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar tarefa'
    });
  }
};

// Delete roadmap task
const deleteRoadmapTask = async (req, res) => {
  try {
    const { id, taskId } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Verify ownership
    const roadmap = await db.query(
      `SELECT r.* FROM roadmaps r
       JOIN roadmap_tasks rt ON rt.roadmap_id = r.id
       WHERE rt.id = $1 AND r.id = $2 AND r.account_id = $3`,
      [taskId, id, accountId]
    );

    if (roadmap.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
      });
    }

    const isAdmin = req.user.role === 'admin';
    if (roadmap.rows[0].created_by !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar este roadmap'
      });
    }

    await db.query(
      `DELETE FROM roadmap_tasks WHERE id = $1 AND roadmap_id = $2`,
      [taskId, id]
    );

    res.json({
      success: true,
      message: 'Tarefa removida com sucesso'
    });
  } catch (error) {
    console.error('Error deleting roadmap task:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao remover tarefa'
    });
  }
};

// Reorder roadmap tasks
const reorderRoadmapTasks = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { tasks } = req.body; // Array of { id, position }

    if (!tasks || !Array.isArray(tasks)) {
      return res.status(400).json({
        success: false,
        error: 'Lista de tarefas é obrigatória'
      });
    }

    // Verify ownership
    const roadmap = await db.query(
      `SELECT * FROM roadmaps WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (roadmap.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    const isAdmin = req.user.role === 'admin';
    if (roadmap.rows[0].created_by !== userId && !isAdmin) {
      return res.status(403).json({
        success: false,
        error: 'Sem permissão para editar este roadmap'
      });
    }

    await client.query('BEGIN');

    for (const task of tasks) {
      await client.query(
        `UPDATE roadmap_tasks SET position = $1 WHERE id = $2 AND roadmap_id = $3`,
        [task.position, task.id, id]
      );
    }

    await client.query('COMMIT');

    // Return updated tasks
    const result = await db.query(
      `SELECT * FROM roadmap_tasks WHERE roadmap_id = $1 ORDER BY position ASC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error reordering roadmap tasks:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao reordenar tarefas'
    });
  } finally {
    client.release();
  }
};

// ============================================
// SEARCH (for chat "/" trigger)
// ============================================

const searchRoadmaps = async (req, res) => {
  try {
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { q } = req.query;

    let query = `
      SELECT r.id, r.name, r.description, r.shortcut, r.is_global,
             (SELECT COUNT(*) FROM roadmap_tasks WHERE roadmap_id = r.id) as task_count,
             r.total_duration_hours
       FROM roadmaps r
       WHERE r.account_id = $1
         AND r.is_active = true
         AND (r.created_by = $2 OR r.is_global = true)
    `;
    const params = [accountId, userId];

    if (q) {
      query += ` AND (LOWER(r.name) LIKE LOWER($3) OR LOWER(r.shortcut) LIKE LOWER($3) OR LOWER(r.description) LIKE LOWER($3))`;
      params.push(`%${q}%`);
    }

    query += ` ORDER BY r.is_global DESC, r.name ASC LIMIT 10`;

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error searching roadmaps:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar roadmaps'
    });
  }
};

// ============================================
// EXECUTION
// ============================================

// Execute a roadmap (create execution instance)
// NOW CREATES TASKS IN opportunity_checklist_items (unified task system)
const executeRoadmap = async (req, res) => {
  const client = await db.pool.connect();
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { contact_id, opportunity_id, conversation_id, assignees, start_date } = req.body;

    if (!contact_id) {
      return res.status(400).json({
        success: false,
        error: 'contact_id é obrigatório'
      });
    }

    // Get roadmap with tasks
    const roadmapResult = await db.query(
      `SELECT r.* FROM roadmaps r
       WHERE r.id = $1 AND r.account_id = $2 AND r.is_active = true
         AND (r.created_by = $3 OR r.is_global = true)`,
      [id, accountId, userId]
    );

    if (roadmapResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    const roadmap = roadmapResult.rows[0];

    // Get tasks
    const tasksResult = await db.query(
      `SELECT * FROM roadmap_tasks WHERE roadmap_id = $1 ORDER BY position ASC`,
      [id]
    );

    if (tasksResult.rows.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Roadmap não possui tarefas'
      });
    }

    const tasks = tasksResult.rows;

    await client.query('BEGIN');

    // Create execution
    const startDateValue = start_date ? new Date(start_date) : new Date();

    const executionResult = await client.query(
      `INSERT INTO roadmap_executions (
        roadmap_id, account_id, contact_id, opportunity_id, conversation_id,
        started_by, roadmap_name, roadmap_snapshot, total_tasks, started_at
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING *`,
      [
        id,
        accountId,
        contact_id,
        opportunity_id || null,
        conversation_id || null,
        userId,
        roadmap.name,
        JSON.stringify({ roadmap, tasks }),
        tasks.length,
        startDateValue
      ]
    );

    const execution = executionResult.rows[0];

    // Create a checklist for this roadmap execution
    // Can be linked to opportunity OR directly to contact
    const checklistResult = await client.query(
      `INSERT INTO opportunity_checklists (account_id, opportunity_id, contact_id, name, position, created_by)
       VALUES ($1, $2, $3, $4, 0, $5)
       RETURNING *`,
      [
        accountId,
        opportunity_id || null,
        opportunity_id ? null : contact_id, // Only set contact_id if no opportunity
        `Roadmap: ${roadmap.name}`,
        userId
      ]
    );

    const checklist = checklistResult.rows[0];

    // Calculate due dates and create tasks in opportunity_checklist_items
    let previousDueDate = startDateValue;
    const createdTasks = [];

    for (let i = 0; i < tasks.length; i++) {
      const task = tasks[i];
      let dueDate;

      if (task.relative_due_from === 'roadmap_start') {
        dueDate = new Date(startDateValue.getTime() + task.relative_due_hours * 60 * 60 * 1000);
      } else {
        // previous_task
        dueDate = new Date(previousDueDate.getTime() + task.relative_due_hours * 60 * 60 * 1000);
      }

      // Create task in unified task table (opportunity_checklist_items)
      const taskResult = await client.query(
        `INSERT INTO opportunity_checklist_items (
          checklist_id, title, content, task_type, priority, position, due_date,
          is_completed, status, roadmap_execution_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, false, 'pending', $8)
         RETURNING *`,
        [
          checklist.id,
          task.title,
          task.description || task.title,
          task.task_type,
          task.priority,
          i,
          dueDate,
          execution.id
        ]
      );

      const createdTask = taskResult.rows[0];
      createdTasks.push(createdTask);

      // Determine assignees for this task
      let taskAssignees = [];
      if (assignees && assignees.length > 0) {
        taskAssignees = assignees;
      } else if (task.default_assignee_id) {
        taskAssignees = [task.default_assignee_id];
      } else if (roadmap.default_assignees && roadmap.default_assignees.length > 0) {
        taskAssignees = roadmap.default_assignees;
      }
      // If no assignees, task remains unassigned (visible to all)

      // Create assignees in the unified assignees table
      for (const assigneeId of taskAssignees) {
        await client.query(
          `INSERT INTO opportunity_checklist_item_assignees (checklist_item_id, user_id, assigned_by, assigned_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (checklist_item_id, user_id) DO NOTHING`,
          [createdTask.id, assigneeId, userId]
        );
      }

      previousDueDate = dueDate;
    }

    await client.query('COMMIT');

    // Send notifications to assignees (async, don't wait)
    notifyAssigneesUnified(execution, createdTasks, accountId, userId).catch(err => {
      console.error('Error sending notifications:', err);
    });

    // Get contact name for response
    const contactResult = await db.query(
      `SELECT name FROM contacts WHERE id = $1`,
      [contact_id]
    );

    res.status(201).json({
      success: true,
      data: {
        ...execution,
        tasks: createdTasks,
        contact_name: contactResult.rows[0]?.name
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error executing roadmap:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao executar roadmap'
    });
  } finally {
    client.release();
  }
};

// Helper to send notifications (legacy - for roadmap_execution_tasks)
async function notifyAssignees(execution, tasks, accountId, startedBy) {
  const assigneeTaskMap = new Map();

  for (const task of tasks) {
    const assigneesResult = await db.query(
      `SELECT user_id FROM roadmap_execution_task_assignees WHERE execution_task_id = $1`,
      [task.id]
    );

    for (const row of assigneesResult.rows) {
      if (row.user_id !== startedBy) {
        if (!assigneeTaskMap.has(row.user_id)) {
          assigneeTaskMap.set(row.user_id, []);
        }
        assigneeTaskMap.get(row.user_id).push(task);
      }
    }
  }

  for (const [userId, userTasks] of assigneeTaskMap) {
    try {
      await notificationService.create({
        account_id: accountId,
        user_id: userId,
        type: 'roadmap_task_assigned',
        title: 'Novas tarefas atribuídas',
        message: `Você recebeu ${userTasks.length} tarefa(s) do roadmap "${execution.roadmap_name}"`,
        metadata: {
          execution_id: execution.id,
          roadmap_name: execution.roadmap_name,
          task_count: userTasks.length
        }
      });

      // Mark as notified
      for (const task of userTasks) {
        await db.query(
          `UPDATE roadmap_execution_task_assignees
           SET notified_at = CURRENT_TIMESTAMP
           WHERE execution_task_id = $1 AND user_id = $2`,
          [task.id, userId]
        );
      }
    } catch (err) {
      console.error(`Error notifying user ${userId}:`, err);
    }
  }
}

// Helper to send notifications (new - for unified opportunity_checklist_items)
async function notifyAssigneesUnified(execution, tasks, accountId, startedBy) {
  const assigneeTaskMap = new Map();

  for (const task of tasks) {
    const assigneesResult = await db.query(
      `SELECT user_id FROM opportunity_checklist_item_assignees WHERE checklist_item_id = $1`,
      [task.id]
    );

    for (const row of assigneesResult.rows) {
      if (row.user_id !== startedBy) {
        if (!assigneeTaskMap.has(row.user_id)) {
          assigneeTaskMap.set(row.user_id, []);
        }
        assigneeTaskMap.get(row.user_id).push(task);
      }
    }
  }

  for (const [userId, userTasks] of assigneeTaskMap) {
    try {
      await notificationService.create({
        account_id: accountId,
        user_id: userId,
        type: 'roadmap_task_assigned',
        title: 'Novas tarefas atribuídas',
        message: `Você recebeu ${userTasks.length} tarefa(s) do roadmap "${execution.roadmap_name}"`,
        metadata: {
          execution_id: execution.id,
          roadmap_name: execution.roadmap_name,
          task_count: userTasks.length
        }
      });
    } catch (err) {
      console.error(`Error notifying user ${userId}:`, err);
    }
  }
}

// Get execution details
// Now fetches tasks from unified opportunity_checklist_items table
const getExecution = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const executionResult = await db.query(
      `SELECT re.*,
              c.name as contact_name,
              o.name as opportunity_name,
              u.name as started_by_name, u.avatar_url as started_by_avatar
       FROM roadmap_executions re
       LEFT JOIN contacts c ON re.contact_id = c.id
       LEFT JOIN opportunities o ON re.opportunity_id = o.id
       LEFT JOIN users u ON re.started_by = u.id
       WHERE re.id = $1 AND re.account_id = $2`,
      [id, accountId]
    );

    if (executionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Execução não encontrada'
      });
    }

    // Get tasks from unified table (opportunity_checklist_items)
    const tasksResult = await db.query(
      `SELECT oci.*,
              u.name as completed_by_name
       FROM opportunity_checklist_items oci
       LEFT JOIN users u ON oci.completed_by = u.id
       WHERE oci.roadmap_execution_id = $1
       ORDER BY oci.position ASC`,
      [id]
    );

    // Get assignees for each task
    const tasks = [];
    for (const task of tasksResult.rows) {
      const assigneesResult = await db.query(
        `SELECT ocia.*, u.name as user_name, u.avatar_url
         FROM opportunity_checklist_item_assignees ocia
         LEFT JOIN users u ON ocia.user_id = u.id
         WHERE ocia.checklist_item_id = $1`,
        [task.id]
      );
      task.assignees = assigneesResult.rows;
      tasks.push(task);
    }

    const execution = executionResult.rows[0];
    execution.tasks = tasks;

    res.json({
      success: true,
      data: execution
    });
  } catch (error) {
    console.error('Error fetching execution:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar execução'
    });
  }
};

// Cancel execution
// Now also cancels tasks in unified opportunity_checklist_items table
const cancelExecution = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;
    const { reason } = req.body;

    const existing = await db.query(
      `SELECT * FROM roadmap_executions WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (existing.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Execução não encontrada'
      });
    }

    if (existing.rows[0].status !== 'in_progress') {
      return res.status(400).json({
        success: false,
        error: 'Apenas execuções em andamento podem ser canceladas'
      });
    }

    // Update execution status
    await db.query(
      `UPDATE roadmap_executions
       SET status = 'cancelled',
           cancelled_at = CURRENT_TIMESTAMP,
           cancelled_reason = $1
       WHERE id = $2`,
      [reason || null, id]
    );

    // Cancel pending tasks in unified table (opportunity_checklist_items)
    await db.query(
      `UPDATE opportunity_checklist_items
       SET status = 'cancelled'
       WHERE roadmap_execution_id = $1 AND status IN ('pending', 'in_progress')`,
      [id]
    );

    // Also delete the checklist associated with this execution (optional: or keep for history)
    // For now, we'll keep the checklist but just mark tasks as cancelled

    res.json({
      success: true,
      message: 'Execução cancelada com sucesso'
    });
  } catch (error) {
    console.error('Error cancelling execution:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao cancelar execução'
    });
  }
};

// Toggle task completion
// Now works with unified opportunity_checklist_items table
const toggleExecutionTask = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    // Get task from unified table and verify access
    const taskResult = await db.query(
      `SELECT oci.*, re.account_id, oci.roadmap_execution_id as execution_id
       FROM opportunity_checklist_items oci
       JOIN roadmap_executions re ON oci.roadmap_execution_id = re.id
       WHERE oci.id = $1 AND re.account_id = $2`,
      [id, accountId]
    );

    if (taskResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Tarefa não encontrada'
      });
    }

    const task = taskResult.rows[0];
    const newCompleted = !task.is_completed;

    // Update task in unified table
    const result = await db.query(
      `UPDATE opportunity_checklist_items
       SET is_completed = $1,
           status = $2,
           completed_at = $3,
           completed_by = $4,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $5
       RETURNING *`,
      [
        newCompleted,
        newCompleted ? 'completed' : 'pending',
        newCompleted ? new Date() : null,
        newCompleted ? userId : null,
        id
      ]
    );

    // Get updated execution info (trigger should have updated completed_tasks)
    const executionResult = await db.query(
      `SELECT id, status, completed_tasks, total_tasks, completed_at
       FROM roadmap_executions
       WHERE id = $1`,
      [task.execution_id]
    );

    res.json({
      success: true,
      data: {
        task: result.rows[0],
        execution: executionResult.rows[0]
      }
    });
  } catch (error) {
    console.error('Error toggling task:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao atualizar tarefa'
    });
  }
};

// Get executions by contact
// Now fetches tasks from unified opportunity_checklist_items table
const getExecutionsByContact = async (req, res) => {
  try {
    const { contactId } = req.params;
    const accountId = req.user.account_id;
    const { status } = req.query;

    let query = `
      SELECT re.*,
             u.name as started_by_name, u.avatar_url as started_by_avatar,
             (SELECT COUNT(*) FROM opportunity_checklist_items WHERE roadmap_execution_id = re.id AND is_completed = true) as tasks_completed
       FROM roadmap_executions re
       LEFT JOIN users u ON re.started_by = u.id
       WHERE re.contact_id = $1 AND re.account_id = $2
    `;
    const params = [contactId, accountId];

    if (status) {
      query += ` AND re.status = $3`;
      params.push(status);
    }

    query += ` ORDER BY re.started_at DESC`;

    const result = await db.query(query, params);

    // Get tasks for each execution from unified table
    const executions = [];
    for (const exec of result.rows) {
      const tasksResult = await db.query(
        `SELECT oci.*,
                COALESCE(
                  (SELECT json_agg(json_build_object('user_id', ocia.user_id, 'user_name', u.name, 'avatar_url', u.avatar_url))
                   FROM opportunity_checklist_item_assignees ocia
                   LEFT JOIN users u ON ocia.user_id = u.id
                   WHERE ocia.checklist_item_id = oci.id),
                  '[]'
                ) as assignees
         FROM opportunity_checklist_items oci
         WHERE oci.roadmap_execution_id = $1
         ORDER BY oci.position ASC`,
        [exec.id]
      );
      exec.tasks = tasksResult.rows;
      executions.push(exec);
    }

    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    console.error('Error fetching executions by contact:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar execuções'
    });
  }
};

// Get executions by opportunity
// Now fetches tasks from unified opportunity_checklist_items table
const getExecutionsByOpportunity = async (req, res) => {
  try {
    const { opportunityId } = req.params;
    const accountId = req.user.account_id;
    const { status } = req.query;

    let query = `
      SELECT re.*,
             u.name as started_by_name, u.avatar_url as started_by_avatar
       FROM roadmap_executions re
       LEFT JOIN users u ON re.started_by = u.id
       WHERE re.opportunity_id = $1 AND re.account_id = $2
    `;
    const params = [opportunityId, accountId];

    if (status) {
      query += ` AND re.status = $3`;
      params.push(status);
    }

    query += ` ORDER BY re.started_at DESC`;

    const result = await db.query(query, params);

    // Get tasks for each execution from unified table
    const executions = [];
    for (const exec of result.rows) {
      const tasksResult = await db.query(
        `SELECT oci.*,
                COALESCE(
                  (SELECT json_agg(json_build_object('user_id', ocia.user_id, 'user_name', u.name, 'avatar_url', u.avatar_url))
                   FROM opportunity_checklist_item_assignees ocia
                   LEFT JOIN users u ON ocia.user_id = u.id
                   WHERE ocia.checklist_item_id = oci.id),
                  '[]'
                ) as assignees
         FROM opportunity_checklist_items oci
         WHERE oci.roadmap_execution_id = $1
         ORDER BY oci.position ASC`,
        [exec.id]
      );
      exec.tasks = tasksResult.rows;
      executions.push(exec);
    }

    res.json({
      success: true,
      data: executions
    });
  } catch (error) {
    console.error('Error fetching executions by opportunity:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar execuções'
    });
  }
};

// ============================================
// ANALYTICS
// ============================================

const getAnalytics = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { roadmap_id, start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [accountId];

    if (start_date && end_date) {
      dateFilter = ` AND re.started_at >= $2 AND re.started_at <= $3`;
      params.push(start_date, end_date);
    }

    let roadmapFilter = '';
    if (roadmap_id) {
      roadmapFilter = ` AND re.roadmap_id = $${params.length + 1}`;
      params.push(roadmap_id);
    }

    // Total executions
    const totalResult = await db.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'completed') as completed,
              COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
              COUNT(*) FILTER (WHERE status = 'in_progress') as in_progress
       FROM roadmap_executions re
       WHERE re.account_id = $1${dateFilter}${roadmapFilter}`,
      params
    );

    // Average completion time (for completed only)
    const avgTimeResult = await db.query(
      `SELECT AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) as avg_hours
       FROM roadmap_executions re
       WHERE re.account_id = $1 AND re.status = 'completed'${dateFilter}${roadmapFilter}`,
      params
    );

    // Task completion rate (from unified table)
    const taskRateResult = await db.query(
      `SELECT
         COUNT(*) as total_tasks,
         COUNT(*) FILTER (WHERE oci.is_completed = true) as completed_tasks
       FROM opportunity_checklist_items oci
       JOIN roadmap_executions re ON oci.roadmap_execution_id = re.id
       WHERE re.account_id = $1${dateFilter}${roadmapFilter}`,
      params
    );

    // Top roadmaps by usage
    const topRoadmapsResult = await db.query(
      `SELECT r.id, r.name, COUNT(re.id) as execution_count
       FROM roadmaps r
       LEFT JOIN roadmap_executions re ON r.id = re.roadmap_id${dateFilter.replace(/re\./g, 're.')}
       WHERE r.account_id = $1
       GROUP BY r.id, r.name
       ORDER BY execution_count DESC
       LIMIT 5`,
      [accountId]
    );

    // Bottlenecks (tasks that take longest on average)
    let bottleneckParams = [accountId];
    let bottleneckDateFilter = dateFilter;
    let bottleneckRoadmapFilter = roadmapFilter;

    if (start_date && end_date) {
      bottleneckParams.push(start_date, end_date);
    }
    if (roadmap_id) {
      bottleneckParams.push(roadmap_id);
    }

    const bottlenecksResult = await db.query(
      `SELECT oci.title,
              AVG(EXTRACT(EPOCH FROM (oci.completed_at - re.started_at)) / 3600) as avg_hours_to_complete,
              COUNT(*) as times_completed
       FROM opportunity_checklist_items oci
       JOIN roadmap_executions re ON oci.roadmap_execution_id = re.id
       WHERE re.account_id = $1 AND oci.is_completed = true${bottleneckDateFilter}${bottleneckRoadmapFilter}
       GROUP BY oci.title
       HAVING COUNT(*) >= 3
       ORDER BY avg_hours_to_complete DESC
       LIMIT 5`,
      bottleneckParams
    );

    const stats = totalResult.rows[0];
    const taskStats = taskRateResult.rows[0];

    res.json({
      success: true,
      data: {
        total_executions: parseInt(stats.total),
        completed_executions: parseInt(stats.completed),
        cancelled_executions: parseInt(stats.cancelled),
        in_progress_executions: parseInt(stats.in_progress),
        completion_rate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0,
        avg_completion_time_hours: avgTimeResult.rows[0].avg_hours ? parseFloat(avgTimeResult.rows[0].avg_hours).toFixed(1) : null,
        task_completion_rate: taskStats.total_tasks > 0 ? ((taskStats.completed_tasks / taskStats.total_tasks) * 100).toFixed(1) : 0,
        top_roadmaps: topRoadmapsResult.rows,
        bottlenecks: bottlenecksResult.rows.map(b => ({
          title: b.title,
          avg_hours: parseFloat(b.avg_hours_to_complete).toFixed(1),
          times_completed: parseInt(b.times_completed)
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar analytics'
    });
  }
};

const getRoadmapAnalytics = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;
    const { start_date, end_date } = req.query;

    let dateFilter = '';
    const params = [id, accountId];

    if (start_date && end_date) {
      dateFilter = ` AND re.started_at >= $3 AND re.started_at <= $4`;
      params.push(start_date, end_date);
    }

    // Roadmap info
    const roadmapResult = await db.query(
      `SELECT * FROM roadmaps WHERE id = $1 AND account_id = $2`,
      [id, accountId]
    );

    if (roadmapResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    // Execution stats
    const statsResult = await db.query(
      `SELECT COUNT(*) as total,
              COUNT(*) FILTER (WHERE status = 'completed') as completed,
              COUNT(*) FILTER (WHERE status = 'cancelled') as cancelled,
              AVG(EXTRACT(EPOCH FROM (completed_at - started_at)) / 3600) FILTER (WHERE status = 'completed') as avg_hours
       FROM roadmap_executions re
       WHERE re.roadmap_id = $1 AND re.account_id = $2${dateFilter}`,
      params
    );

    // Executions over time (last 12 weeks)
    const timelineResult = await db.query(
      `SELECT DATE_TRUNC('week', re.started_at) as week,
              COUNT(*) as count
       FROM roadmap_executions re
       WHERE re.roadmap_id = $1 AND re.account_id = $2
         AND re.started_at >= NOW() - INTERVAL '12 weeks'
       GROUP BY week
       ORDER BY week ASC`,
      [id, accountId]
    );

    // Task-level stats (from unified table)
    const taskStatsResult = await db.query(
      `SELECT oci.title, oci.position,
              COUNT(*) as total,
              COUNT(*) FILTER (WHERE oci.is_completed = true) as completed,
              AVG(EXTRACT(EPOCH FROM (oci.completed_at - re.started_at)) / 3600) FILTER (WHERE oci.is_completed = true) as avg_hours
       FROM opportunity_checklist_items oci
       JOIN roadmap_executions re ON oci.roadmap_execution_id = re.id
       WHERE re.roadmap_id = $1 AND re.account_id = $2${dateFilter}
       GROUP BY oci.title, oci.position
       ORDER BY oci.position ASC`,
      params
    );

    const stats = statsResult.rows[0];

    res.json({
      success: true,
      data: {
        roadmap: roadmapResult.rows[0],
        total_executions: parseInt(stats.total),
        completed_executions: parseInt(stats.completed),
        cancelled_executions: parseInt(stats.cancelled),
        completion_rate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0,
        avg_completion_time_hours: stats.avg_hours ? parseFloat(stats.avg_hours).toFixed(1) : null,
        timeline: timelineResult.rows,
        task_stats: taskStatsResult.rows.map(t => ({
          title: t.title,
          position: t.position,
          total: parseInt(t.total),
          completed: parseInt(t.completed),
          completion_rate: t.total > 0 ? ((t.completed / t.total) * 100).toFixed(1) : 0,
          avg_hours: t.avg_hours ? parseFloat(t.avg_hours).toFixed(1) : null
        }))
      }
    });
  } catch (error) {
    console.error('Error fetching roadmap analytics:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar analytics do roadmap'
    });
  }
};

module.exports = {
  // Roadmaps CRUD
  getRoadmaps,
  getRoadmap,
  createRoadmap,
  updateRoadmap,
  deleteRoadmap,

  // Roadmap Tasks
  getRoadmapTasks,
  addRoadmapTask,
  updateRoadmapTask,
  deleteRoadmapTask,
  reorderRoadmapTasks,

  // Search
  searchRoadmaps,

  // Execution
  executeRoadmap,
  getExecution,
  cancelExecution,
  toggleExecutionTask,
  getExecutionsByContact,
  getExecutionsByOpportunity,

  // Analytics
  getAnalytics,
  getRoadmapAnalytics
};
