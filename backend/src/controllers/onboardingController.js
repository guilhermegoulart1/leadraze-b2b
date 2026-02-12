const db = require('../config/database');
const notificationService = require('../services/notificationService');
const emailService = require('../services/emailService');
const { ONBOARDING_STAGES, ALL_TASK_KEYS, TOTAL_TASKS } = require('../config/onboardingTasks');

/**
 * Get onboarding for the current account
 */
exports.getOnboarding = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    const query = `
      SELECT *
      FROM onboarding_responses
      WHERE account_id = $1
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await db.query(query, [accountId]);

    res.json({
      success: true,
      data: {
        onboarding: result.rows[0] || null
      }
    });
  } catch (error) {
    console.error('Error getting onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar onboarding',
      error: error.message
    });
  }
};

/**
 * Create a new onboarding
 */
exports.createOnboarding = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userId = req.user.id;

    // Check if already exists
    const existingQuery = `
      SELECT id FROM onboarding_responses WHERE account_id = $1
    `;
    const existing = await db.query(existingQuery, [accountId]);

    if (existing.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Onboarding já existe para esta conta. Use PUT para atualizar.'
      });
    }

    const {
      // Etapa 1
      company_name, website, industry, company_size, description,
      products_services, differentials, success_cases,
      // Etapa 2
      ideal_customer, target_roles, target_location, target_industries,
      buying_signals, main_problem,
      // Etapa 3
      faq, objections, policies, business_hours, escalation_triggers,
      // Etapa 4
      goals, lead_target, meeting_target, materials_links, calendar_link,
      blacklist, additional_notes,
      // Contato
      contact_name, contact_role, contact_email, contact_phone,
      // Status
      current_step, status
    } = req.body;

    const query = `
      INSERT INTO onboarding_responses (
        account_id, user_id,
        company_name, website, industry, company_size, description,
        products_services, differentials, success_cases,
        ideal_customer, target_roles, target_location, target_industries,
        buying_signals, main_problem,
        faq, objections, policies, business_hours, escalation_triggers,
        goals, lead_target, meeting_target, materials_links, calendar_link,
        blacklist, additional_notes,
        contact_name, contact_role, contact_email, contact_phone,
        current_step, status,
        completed_at
      ) VALUES (
        $1, $2,
        $3, $4, $5, $6, $7,
        $8, $9, $10,
        $11, $12, $13, $14,
        $15, $16,
        $17, $18, $19, $20, $21,
        $22, $23, $24, $25, $26,
        $27, $28,
        $29, $30, $31, $32,
        $33, $34,
        $35
      )
      RETURNING *
    `;

    const completedAt = status === 'completed' ? new Date() : null;

    const result = await db.query(query, [
      accountId, userId,
      company_name, website, industry, company_size, description,
      products_services, differentials, success_cases,
      ideal_customer, target_roles, target_location, target_industries,
      buying_signals, main_problem,
      JSON.stringify(faq || []), JSON.stringify(objections || []), policies, business_hours, escalation_triggers || [],
      goals || [], lead_target, meeting_target, materials_links, calendar_link,
      blacklist, additional_notes,
      contact_name, contact_role, contact_email, contact_phone,
      current_step || 1, status || 'pending',
      completedAt
    ]);

    res.status(201).json({
      success: true,
      data: {
        onboarding: result.rows[0]
      },
      message: 'Onboarding criado com sucesso'
    });
  } catch (error) {
    console.error('Error creating onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar onboarding',
      error: error.message
    });
  }
};

/**
 * Update an existing onboarding
 */
exports.updateOnboarding = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    // Check ownership
    const checkQuery = `
      SELECT id FROM onboarding_responses WHERE id = $1 AND account_id = $2
    `;
    const checkResult = await db.query(checkQuery, [id, accountId]);

    if (checkResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    const {
      // Etapa 1
      company_name, website, industry, company_size, description,
      products_services, differentials, success_cases,
      // Etapa 2
      ideal_customer, target_roles, target_location, target_industries,
      buying_signals, main_problem,
      // Etapa 3
      faq, objections, policies, business_hours, escalation_triggers,
      // Etapa 4
      goals, lead_target, meeting_target, materials_links, calendar_link,
      blacklist, additional_notes,
      // Contato
      contact_name, contact_role, contact_email, contact_phone,
      // Status
      current_step, status
    } = req.body;

    const query = `
      UPDATE onboarding_responses SET
        company_name = COALESCE($1, company_name),
        website = COALESCE($2, website),
        industry = COALESCE($3, industry),
        company_size = COALESCE($4, company_size),
        description = COALESCE($5, description),
        products_services = COALESCE($6, products_services),
        differentials = COALESCE($7, differentials),
        success_cases = COALESCE($8, success_cases),
        ideal_customer = COALESCE($9, ideal_customer),
        target_roles = COALESCE($10, target_roles),
        target_location = COALESCE($11, target_location),
        target_industries = COALESCE($12, target_industries),
        buying_signals = COALESCE($13, buying_signals),
        main_problem = COALESCE($14, main_problem),
        faq = COALESCE($15, faq),
        objections = COALESCE($16, objections),
        policies = COALESCE($17, policies),
        business_hours = COALESCE($18, business_hours),
        escalation_triggers = COALESCE($19, escalation_triggers),
        goals = COALESCE($20, goals),
        lead_target = COALESCE($21, lead_target),
        meeting_target = COALESCE($22, meeting_target),
        materials_links = COALESCE($23, materials_links),
        calendar_link = COALESCE($24, calendar_link),
        blacklist = COALESCE($25, blacklist),
        additional_notes = COALESCE($26, additional_notes),
        contact_name = COALESCE($27, contact_name),
        contact_role = COALESCE($28, contact_role),
        contact_email = COALESCE($29, contact_email),
        contact_phone = COALESCE($30, contact_phone),
        current_step = COALESCE($31, current_step),
        status = COALESCE($32, status),
        completed_at = CASE WHEN $32 = 'completed' AND completed_at IS NULL THEN NOW() ELSE completed_at END
      WHERE id = $33 AND account_id = $34
      RETURNING *
    `;

    const result = await db.query(query, [
      company_name, website, industry, company_size, description,
      products_services, differentials, success_cases,
      ideal_customer, target_roles, target_location, target_industries,
      buying_signals, main_problem,
      faq ? JSON.stringify(faq) : null, objections ? JSON.stringify(objections) : null, policies, business_hours, escalation_triggers,
      goals, lead_target, meeting_target, materials_links, calendar_link,
      blacklist, additional_notes,
      contact_name, contact_role, contact_email, contact_phone,
      current_step, status,
      id, accountId
    ]);

    const updatedOnboarding = result.rows[0];

    // Send notifications when onboarding is completed
    if (status === 'completed' && updatedOnboarding.completed_at) {
      setImmediate(async () => {
        try {
          // 1. In-app notification for admins
          await notificationService.notifyOnboardingCompleted({
            onboardingId: updatedOnboarding.id,
            companyName: updatedOnboarding.company_name,
            contactName: updatedOnboarding.contact_name,
            contactEmail: updatedOnboarding.contact_email,
            accountId: accountId
          });

          // 2. Email notification to admins
          await emailService.sendOnboardingCompletedNotification(updatedOnboarding);

          console.log(`✅ Onboarding completion notifications sent for ${updatedOnboarding.company_name}`);
        } catch (notifError) {
          console.error('Error sending onboarding notifications:', notifError);
        }
      });
    }

    res.json({
      success: true,
      data: {
        onboarding: updatedOnboarding
      },
      message: 'Onboarding atualizado com sucesso'
    });
  } catch (error) {
    console.error('Error updating onboarding:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar onboarding',
      error: error.message
    });
  }
};

/**
 * Get all onboardings (admin)
 */
exports.getOnboardingsAdmin = async (req, res) => {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    let query = `
      SELECT
        o.*,
        a.name as account_name,
        u.name as user_name,
        u.email as user_email
      FROM onboarding_responses o
      JOIN accounts a ON o.account_id = a.id
      JOIN users u ON o.user_id = u.id
    `;

    const params = [];
    let paramCount = 0;

    if (status) {
      paramCount++;
      query += ` WHERE o.status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY o.created_at DESC`;

    // Count total
    const countQuery = query.replace(/SELECT[\s\S]*?FROM/, 'SELECT COUNT(*) FROM').replace(/ORDER BY[\s\S]*$/, '');
    const countResult = await db.query(countQuery, params);
    const total = parseInt(countResult.rows[0].count);

    // Add pagination
    query += ` LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: {
        onboardings: result.rows,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit)
        }
      }
    });
  } catch (error) {
    console.error('Error getting onboardings admin:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar onboardings',
      error: error.message
    });
  }
};

/**
 * Get single onboarding by ID (admin)
 */
exports.getOnboardingById = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        o.*,
        a.name as account_name,
        u.name as user_name,
        u.email as user_email,
        rv.name as reviewer_name
      FROM onboarding_responses o
      JOIN accounts a ON o.account_id = a.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN users rv ON o.reviewed_by = rv.id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        onboarding: result.rows[0]
      }
    });
  } catch (error) {
    console.error('Error getting onboarding by id:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar onboarding',
      error: error.message
    });
  }
};

/**
 * Mark onboarding as reviewed
 */
exports.markAsReviewed = async (req, res) => {
  try {
    const { id } = req.params;
    const reviewerId = req.user.id;

    const query = `
      UPDATE onboarding_responses SET
        status = 'reviewed',
        reviewed_at = NOW(),
        reviewed_by = $1
      WHERE id = $2
      RETURNING *
    `;

    const result = await db.query(query, [reviewerId, id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        onboarding: result.rows[0]
      },
      message: 'Onboarding marcado como revisado'
    });
  } catch (error) {
    console.error('Error marking onboarding as reviewed:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao marcar onboarding como revisado',
      error: error.message
    });
  }
};

/**
 * Export onboarding to CSV (admin)
 */
exports.exportOnboardingCSV = async (req, res) => {
  try {
    const { id } = req.params;

    const query = `
      SELECT
        o.*,
        a.name as account_name,
        u.name as user_name,
        u.email as user_email,
        rv.name as reviewer_name
      FROM onboarding_responses o
      JOIN accounts a ON o.account_id = a.id
      JOIN users u ON o.user_id = u.id
      LEFT JOIN users rv ON o.reviewed_by = rv.id
      WHERE o.id = $1
    `;

    const result = await db.query(query, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    const o = result.rows[0];

    // Helper function for CSV escaping
    const escapeCsvField = (field) => {
      if (field === null || field === undefined) return '';
      const str = String(field);
      if (str.includes(',') || str.includes('"') || str.includes('\n')) {
        return '"' + str.replace(/"/g, '""') + '"';
      }
      return str;
    };

    // Format array/JSON fields
    const formatFAQ = (faq) => {
      if (!Array.isArray(faq) || faq.length === 0) return '';
      return faq.map((item, i) => `Q${i + 1}: ${item.question} | A${i + 1}: ${item.answer}`).join(' || ');
    };

    const formatObjections = (objections) => {
      if (!Array.isArray(objections) || objections.length === 0) return '';
      return objections.map((item, i) => `O${i + 1}: ${item.objection} | R${i + 1}: ${item.response}`).join(' || ');
    };

    const formatArray = (arr) => {
      if (!Array.isArray(arr) || arr.length === 0) return '';
      return arr.join(', ');
    };

    // Build CSV
    const csvRows = [];

    // Header
    csvRows.push([
      'ID', 'Account Name', 'Status', 'Created At', 'Completed At', 'Reviewed At', 'Reviewer',
      'Company Name', 'Website', 'Industry', 'Company Size', 'Description', 'Products/Services', 'Differentials', 'Success Cases',
      'Ideal Customer', 'Target Roles', 'Target Location', 'Target Industries', 'Buying Signals', 'Main Problem',
      'FAQ', 'Objections', 'Policies', 'Business Hours', 'Escalation Triggers',
      'Goals', 'Lead Target', 'Meeting Target', 'Materials Links', 'Calendar Link', 'Blacklist', 'Additional Notes',
      'Contact Name', 'Contact Role', 'Contact Email', 'Contact Phone'
    ].join(','));

    // Data row
    csvRows.push([
      escapeCsvField(o.id),
      escapeCsvField(o.account_name),
      escapeCsvField(o.status),
      o.created_at ? new Date(o.created_at).toISOString() : '',
      o.completed_at ? new Date(o.completed_at).toISOString() : '',
      o.reviewed_at ? new Date(o.reviewed_at).toISOString() : '',
      escapeCsvField(o.reviewer_name || ''),
      escapeCsvField(o.company_name),
      escapeCsvField(o.website),
      escapeCsvField(o.industry),
      escapeCsvField(o.company_size),
      escapeCsvField(o.description),
      escapeCsvField(o.products_services),
      escapeCsvField(o.differentials),
      escapeCsvField(o.success_cases),
      escapeCsvField(o.ideal_customer),
      escapeCsvField(o.target_roles),
      escapeCsvField(o.target_location),
      escapeCsvField(o.target_industries),
      escapeCsvField(o.buying_signals),
      escapeCsvField(o.main_problem),
      escapeCsvField(formatFAQ(o.faq)),
      escapeCsvField(formatObjections(o.objections)),
      escapeCsvField(o.policies),
      escapeCsvField(o.business_hours),
      escapeCsvField(formatArray(o.escalation_triggers)),
      escapeCsvField(formatArray(o.goals)),
      escapeCsvField(o.lead_target),
      escapeCsvField(o.meeting_target),
      escapeCsvField(o.materials_links),
      escapeCsvField(o.calendar_link),
      escapeCsvField(o.blacklist),
      escapeCsvField(o.additional_notes),
      escapeCsvField(o.contact_name),
      escapeCsvField(o.contact_role),
      escapeCsvField(o.contact_email),
      escapeCsvField(o.contact_phone)
    ].join(','));

    const csv = csvRows.join('\n');
    const filename = `onboarding_${o.company_name ? o.company_name.replace(/[^a-zA-Z0-9]/g, '_') : o.id}_${new Date().toISOString().split('T')[0]}.csv`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send('\ufeff' + csv); // BOM for Excel

  } catch (error) {
    console.error('Error exporting onboarding CSV:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao exportar onboarding',
      error: error.message
    });
  }
};

/**
 * Get checklist progress for the current account (client view)
 * Returns stages + tasks with completed status (no timestamps)
 */
exports.getChecklistProgress = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    // Get latest onboarding for this account
    const onboardingResult = await db.query(
      `SELECT id, status FROM onboarding_responses WHERE account_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [accountId]
    );

    const onboarding = onboardingResult.rows[0];

    // If no onboarding or form not completed
    if (!onboarding || (onboarding.status !== 'completed' && onboarding.status !== 'reviewed')) {
      return res.json({
        success: true,
        data: {
          formCompleted: false,
          checklistComplete: false,
          percentage: 0,
          stages: []
        }
      });
    }

    // Get completions
    const completionsResult = await db.query(
      `SELECT task_key FROM onboarding_task_completions WHERE onboarding_id = $1`,
      [onboarding.id]
    );
    const completedKeys = new Set(completionsResult.rows.map(r => r.task_key));

    // Build response with stages and tasks (no timestamps for client)
    const stages = ONBOARDING_STAGES.map(stage => {
      const tasks = stage.tasks.map(task => ({
        key: task.key,
        title_pt: task.title_pt,
        title_en: task.title_en,
        title_es: task.title_es,
        completed: completedKeys.has(task.key)
      }));

      const completedCount = tasks.filter(t => t.completed).length;

      return {
        stage: stage.stage,
        key: stage.key,
        title_pt: stage.title_pt,
        title_en: stage.title_en,
        title_es: stage.title_es,
        description_pt: stage.description_pt,
        description_en: stage.description_en,
        description_es: stage.description_es,
        totalTasks: tasks.length,
        completedTasks: completedCount,
        percentage: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
        tasks
      };
    });

    const totalCompleted = completedKeys.size;
    const percentage = TOTAL_TASKS > 0 ? Math.round((totalCompleted / TOTAL_TASKS) * 100) : 0;

    res.json({
      success: true,
      data: {
        formCompleted: true,
        checklistComplete: totalCompleted === TOTAL_TASKS,
        percentage,
        totalTasks: TOTAL_TASKS,
        completedTasks: totalCompleted,
        stages
      }
    });
  } catch (error) {
    console.error('Error getting checklist progress:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar progresso do checklist',
      error: error.message
    });
  }
};

/**
 * Get admin checklist for a specific onboarding (with timestamps)
 */
exports.getAdminChecklist = async (req, res) => {
  try {
    const { id } = req.params;

    // Verify onboarding exists
    const onboardingResult = await db.query(
      `SELECT id, status FROM onboarding_responses WHERE id = $1`,
      [id]
    );

    if (onboardingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    // Get completions with user info
    const completionsResult = await db.query(
      `SELECT c.task_key, c.completed_at, u.name as completed_by_name
       FROM onboarding_task_completions c
       JOIN users u ON c.completed_by = u.id
       WHERE c.onboarding_id = $1`,
      [id]
    );

    const completionsMap = {};
    completionsResult.rows.forEach(r => {
      completionsMap[r.task_key] = {
        completed_at: r.completed_at,
        completed_by_name: r.completed_by_name
      };
    });

    // Build response with stages, tasks, and timestamps
    const stages = ONBOARDING_STAGES.map(stage => {
      const tasks = stage.tasks.map(task => {
        const completion = completionsMap[task.key];
        return {
          key: task.key,
          title_pt: task.title_pt,
          title_en: task.title_en,
          title_es: task.title_es,
          completed: !!completion,
          completed_at: completion ? completion.completed_at : null,
          completed_by_name: completion ? completion.completed_by_name : null
        };
      });

      const completedCount = tasks.filter(t => t.completed).length;

      return {
        stage: stage.stage,
        key: stage.key,
        title_pt: stage.title_pt,
        title_en: stage.title_en,
        title_es: stage.title_es,
        description_pt: stage.description_pt,
        description_en: stage.description_en,
        description_es: stage.description_es,
        totalTasks: tasks.length,
        completedTasks: completedCount,
        percentage: tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0,
        tasks
      };
    });

    const totalCompleted = Object.keys(completionsMap).length;
    const percentage = TOTAL_TASKS > 0 ? Math.round((totalCompleted / TOTAL_TASKS) * 100) : 0;

    res.json({
      success: true,
      data: {
        percentage,
        totalTasks: TOTAL_TASKS,
        completedTasks: totalCompleted,
        checklistComplete: totalCompleted === TOTAL_TASKS,
        stages
      }
    });
  } catch (error) {
    console.error('Error getting admin checklist:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar checklist',
      error: error.message
    });
  }
};

/**
 * Toggle a checklist task (admin only)
 * If completed → uncomplete, if not → complete
 */
exports.toggleChecklistTask = async (req, res) => {
  try {
    const { id } = req.params;
    const { task_key } = req.body;
    const adminUserId = req.user.id;

    // Validate task_key
    if (!task_key || !ALL_TASK_KEYS.includes(task_key)) {
      return res.status(400).json({
        success: false,
        message: 'Task key inválida'
      });
    }

    // Verify onboarding exists
    const onboardingResult = await db.query(
      `SELECT id FROM onboarding_responses WHERE id = $1`,
      [id]
    );

    if (onboardingResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Onboarding não encontrado'
      });
    }

    // Check if already completed
    const existingResult = await db.query(
      `SELECT id FROM onboarding_task_completions WHERE onboarding_id = $1 AND task_key = $2`,
      [id, task_key]
    );

    let action;
    if (existingResult.rows.length > 0) {
      // Uncomplete: delete
      await db.query(
        `DELETE FROM onboarding_task_completions WHERE onboarding_id = $1 AND task_key = $2`,
        [id, task_key]
      );
      action = 'uncompleted';
    } else {
      // Complete: insert
      await db.query(
        `INSERT INTO onboarding_task_completions (onboarding_id, task_key, completed_by) VALUES ($1, $2, $3)`,
        [id, task_key, adminUserId]
      );
      action = 'completed';
    }

    // Return updated count
    const countResult = await db.query(
      `SELECT COUNT(*) FROM onboarding_task_completions WHERE onboarding_id = $1`,
      [id]
    );
    const completedTasks = parseInt(countResult.rows[0].count);
    const percentage = TOTAL_TASKS > 0 ? Math.round((completedTasks / TOTAL_TASKS) * 100) : 0;

    res.json({
      success: true,
      data: {
        task_key,
        action,
        completedTasks,
        totalTasks: TOTAL_TASKS,
        percentage,
        checklistComplete: completedTasks === TOTAL_TASKS
      }
    });
  } catch (error) {
    console.error('Error toggling checklist task:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar tarefa do checklist',
      error: error.message
    });
  }
};
