// backend/src/controllers/sectorController.js
const db = require('../config/database');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, ValidationError, UnauthorizedError } = require('../utils/errors');
const roundRobinService = require('../services/roundRobinService');

// Get all sectors for the account
const getSectors = async (req, res) => {
  try {
    const accountId = req.user.account_id;

    const result = await db.query(
      `SELECT
        s.*,
        COUNT(DISTINCT us.user_id) as user_count,
        COUNT(DISTINCT ss.supervisor_id) as supervisor_count,
        COUNT(DISTINCT su.user_id) as round_robin_user_count
      FROM sectors s
      LEFT JOIN user_sectors us ON us.sector_id = s.id
      LEFT JOIN supervisor_sectors ss ON ss.sector_id = s.id
      LEFT JOIN sector_users su ON su.sector_id = s.id AND su.is_active = true
      WHERE s.account_id = $1
      GROUP BY s.id
      ORDER BY s.created_at DESC`,
      [accountId]
    );

    sendSuccess(res, result.rows);
  } catch (error) {
    sendError(res, error);
  }
};

// Get a single sector
const getSector = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    const result = await db.query(
      `SELECT
        s.*,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'user_id', u.id,
              'name', u.name,
              'email', u.email,
              'role', u.role
            )
          ) FILTER (WHERE u.id IS NOT NULL),
          '[]'
        ) as users,
        COALESCE(
          json_agg(
            DISTINCT jsonb_build_object(
              'supervisor_id', sup.id,
              'name', sup.name,
              'email', sup.email
            )
          ) FILTER (WHERE sup.id IS NOT NULL),
          '[]'
        ) as supervisors
      FROM sectors s
      LEFT JOIN user_sectors us ON us.sector_id = s.id
      LEFT JOIN users u ON u.id = us.user_id
      LEFT JOIN supervisor_sectors ss ON ss.sector_id = s.id
      LEFT JOIN users sup ON sup.id = ss.supervisor_id
      WHERE s.id = $1 AND s.account_id = $2
      GROUP BY s.id`,
      [id, accountId]
    );

    if (result.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    sendSuccess(res, result.rows[0]);
  } catch (error) {
    sendError(res, error);
  }
};

// Create a new sector
const createSector = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { name, description, color, is_active } = req.body;

    if (!name) {
      throw new ValidationError('Nome do setor é obrigatório');
    }

    // Check if sector name already exists for this account
    const existing = await db.query(
      'SELECT id FROM sectors WHERE account_id = $1 AND name = $2',
      [accountId, name]
    );

    if (existing.rows.length > 0) {
      throw new ValidationError('Já existe um setor com este nome');
    }

    const sector = await db.insert('sectors', {
      account_id: accountId,
      name,
      description: description || null,
      color: color || '#6366f1',
      is_active: is_active !== undefined ? is_active : true
    });

    sendSuccess(res, sector, 'Setor criado com sucesso', 201);
  } catch (error) {
    sendError(res, error);
  }
};

// Update a sector
const updateSector = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { name, description, color, is_active } = req.body;

    // Check if sector exists and belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    // If changing name, check for duplicates
    if (name && name !== sectorCheck.rows[0].name) {
      const existing = await db.query(
        'SELECT id FROM sectors WHERE account_id = $1 AND name = $2 AND id != $3',
        [accountId, name, id]
      );

      if (existing.rows.length > 0) {
        throw new ValidationError('Já existe um setor com este nome');
      }
    }

    const updateData = {};
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (color !== undefined) updateData.color = color;
    if (is_active !== undefined) updateData.is_active = is_active;
    updateData.updated_at = new Date();

    const updated = await db.update('sectors', updateData, { id });

    sendSuccess(res, updated, 'Setor atualizado com sucesso');
  } catch (error) {
    sendError(res, error);
  }
};

// Delete a sector
const deleteSector = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    // Check if sector exists and belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    // Check if sector is in use
    const campaignsCheck = await db.query(
      'SELECT COUNT(*) as count FROM campaigns WHERE sector_id = $1',
      [id]
    );

    const opportunitiesCheck = await db.query(
      'SELECT COUNT(*) as count FROM opportunities WHERE sector_id = $1',
      [id]
    );

    const conversationsCheck = await db.query(
      'SELECT COUNT(*) as count FROM conversations WHERE sector_id = $1',
      [id]
    );

    const contactsCheck = await db.query(
      'SELECT COUNT(*) as count FROM contacts WHERE sector_id = $1',
      [id]
    );

    const totalUsage =
      parseInt(campaignsCheck.rows[0].count) +
      parseInt(opportunitiesCheck.rows[0].count) +
      parseInt(conversationsCheck.rows[0].count) +
      parseInt(contactsCheck.rows[0].count);

    if (totalUsage > 0) {
      throw new ValidationError('Setor em uso por campanhas, oportunidades, conversas ou contatos. Não é possível deletar.');
    }

    await db.delete('sectors', { id });

    sendSuccess(res, null, 'Setor deletado com sucesso');
  } catch (error) {
    sendError(res, error);
  }
};

// Assign user to sector
const assignUserToSector = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { sectorId, userId } = req.body;

    if (!sectorId || !userId) {
      throw new ValidationError('ID do setor e ID do usuário são obrigatórios');
    }

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [sectorId, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    // Check if already assigned
    const existing = await db.query(
      'SELECT * FROM user_sectors WHERE user_id = $1 AND sector_id = $2',
      [userId, sectorId]
    );

    if (existing.rows.length > 0) {
      throw new ValidationError('Usuário já está atribuído a este setor');
    }

    const assignment = await db.insert('user_sectors', {
      user_id: userId,
      sector_id: sectorId
    });

    sendSuccess(res, assignment, 'Usuário atribuído ao setor com sucesso', 201);
  } catch (error) {
    sendError(res, error);
  }
};

// Remove user from sector
const removeUserFromSector = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { sectorId, userId } = req.params;

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [sectorId, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    await db.query(
      'DELETE FROM user_sectors WHERE user_id = $1 AND sector_id = $2',
      [userId, sectorId]
    );

    sendSuccess(res, null, 'Usuário removido do setor com sucesso');
  } catch (error) {
    sendError(res, error);
  }
};

// Assign supervisor to sector
const assignSupervisorToSector = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { sectorId, supervisorId } = req.body;

    if (!sectorId || !supervisorId) {
      throw new ValidationError('ID do setor e ID do supervisor são obrigatórios');
    }

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [sectorId, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    // Verify supervisor belongs to account and has supervisor role
    const supervisorCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2 AND role = $3',
      [supervisorId, accountId, 'supervisor']
    );

    if (supervisorCheck.rows.length === 0) {
      throw new NotFoundError('Supervisor não encontrado ou usuário não tem papel de supervisor');
    }

    // Check if already assigned
    const existing = await db.query(
      'SELECT * FROM supervisor_sectors WHERE supervisor_id = $1 AND sector_id = $2',
      [supervisorId, sectorId]
    );

    if (existing.rows.length > 0) {
      throw new ValidationError('Supervisor já está atribuído a este setor');
    }

    const assignment = await db.insert('supervisor_sectors', {
      supervisor_id: supervisorId,
      sector_id: sectorId
    });

    sendSuccess(res, assignment, 'Supervisor atribuído ao setor com sucesso', 201);
  } catch (error) {
    sendError(res, error);
  }
};

// Remove supervisor from sector
const removeSupervisorFromSector = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { sectorId, supervisorId } = req.params;

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [sectorId, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    // Verify supervisor belongs to account
    const supervisorCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [supervisorId, accountId]
    );

    if (supervisorCheck.rows.length === 0) {
      throw new NotFoundError('Supervisor não encontrado');
    }

    await db.query(
      'DELETE FROM supervisor_sectors WHERE supervisor_id = $1 AND sector_id = $2',
      [supervisorId, sectorId]
    );

    sendSuccess(res, null, 'Supervisor removido do setor com sucesso');
  } catch (error) {
    sendError(res, error);
  }
};

// Get user's accessible sectors
const getUserSectors = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const userId = req.params.userId || req.user.id;

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [userId, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado');
    }

    const result = await db.query(
      `SELECT s.*
      FROM sectors s
      INNER JOIN user_sectors us ON us.sector_id = s.id
      WHERE us.user_id = $1 AND s.account_id = $2 AND s.is_active = true
      ORDER BY s.name`,
      [userId, accountId]
    );

    sendSuccess(res, result.rows);
  } catch (error) {
    sendError(res, error);
  }
};

// Get supervisor's sectors
const getSupervisorSectors = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const supervisorId = req.params.supervisorId || req.user.id;

    // Verify supervisor belongs to account
    const supervisorCheck = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [supervisorId, accountId]
    );

    if (supervisorCheck.rows.length === 0) {
      throw new NotFoundError('Supervisor não encontrado');
    }

    const result = await db.query(
      `SELECT s.*
      FROM sectors s
      INNER JOIN supervisor_sectors ss ON ss.sector_id = s.id
      WHERE ss.supervisor_id = $1 AND s.account_id = $2 AND s.is_active = true
      ORDER BY s.name`,
      [supervisorId, accountId]
    );

    sendSuccess(res, result.rows);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * Get all users belonging to a specific sector
 * Used for agent rotation configuration
 * GET /api/sectors/:id/users
 */
const getSectorUsers = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    const result = await db.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, u.role
       FROM users u
       INNER JOIN user_sectors us ON u.id = us.user_id
       WHERE us.sector_id = $1 AND u.account_id = $2 AND u.is_active = true
       ORDER BY u.name`,
      [id, accountId]
    );

    sendSuccess(res, result.rows);
  } catch (error) {
    sendError(res, error);
  }
};

// ================================
// ROUND-ROBIN MANAGEMENT
// ================================

/**
 * Toggle round-robin for a sector
 * PATCH /api/sectors/:id/round-robin
 */
const toggleSectorRoundRobin = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { enabled } = req.body;

    if (enabled === undefined) {
      throw new ValidationError('Campo "enabled" é obrigatório');
    }

    const updated = await roundRobinService.toggleRoundRobin(id, accountId, enabled);

    if (!updated) {
      throw new NotFoundError('Setor não encontrado');
    }

    sendSuccess(res, updated, `Round-robin ${enabled ? 'ativado' : 'desativado'} com sucesso`);
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * Get users configured for round-robin in a sector
 * GET /api/sectors/:id/round-robin-users
 */
const getSectorRoundRobinUsers = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    const users = await roundRobinService.getSectorUsers(id);

    sendSuccess(res, { users, sector: sectorCheck.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * Add user to round-robin rotation
 * POST /api/sectors/:id/round-robin-users
 */
const addUserToRoundRobin = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;
    const { user_id } = req.body;

    if (!user_id) {
      throw new ValidationError('user_id é obrigatório');
    }

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    // Verify user belongs to account
    const userCheck = await db.query(
      'SELECT id, name, email, avatar_url FROM users WHERE id = $1 AND account_id = $2 AND is_active = true',
      [user_id, accountId]
    );

    if (userCheck.rows.length === 0) {
      throw new NotFoundError('Usuário não encontrado ou inativo');
    }

    const result = await roundRobinService.addUserToSector(id, user_id);

    sendSuccess(res, {
      ...result,
      user: userCheck.rows[0]
    }, 'Usuário adicionado ao round-robin');
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * Remove user from round-robin rotation
 * DELETE /api/sectors/:id/round-robin-users/:userId
 */
const removeUserFromRoundRobin = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id, userId } = req.params;

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    await roundRobinService.removeUserFromSector(id, userId);

    sendSuccess(res, null, 'Usuário removido do round-robin');
  } catch (error) {
    sendError(res, error);
  }
};

/**
 * Get assignment statistics for a sector
 * GET /api/sectors/:id/assignment-stats
 */
const getSectorAssignmentStats = async (req, res) => {
  try {
    const accountId = req.user.account_id;
    const { id } = req.params;

    // Verify sector belongs to account
    const sectorCheck = await db.query(
      'SELECT * FROM sectors WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );

    if (sectorCheck.rows.length === 0) {
      throw new NotFoundError('Setor não encontrado');
    }

    const stats = await roundRobinService.getSectorAssignmentStats(id, accountId);

    sendSuccess(res, { stats, sector: sectorCheck.rows[0] });
  } catch (error) {
    sendError(res, error);
  }
};

module.exports = {
  getSectors,
  getSector,
  createSector,
  updateSector,
  deleteSector,
  assignUserToSector,
  removeUserFromSector,
  assignSupervisorToSector,
  removeSupervisorFromSector,
  getUserSectors,
  getSupervisorSectors,
  getSectorUsers,
  // Round-robin management
  toggleSectorRoundRobin,
  getSectorRoundRobinUsers,
  addUserToRoundRobin,
  removeUserFromRoundRobin,
  getSectorAssignmentStats
};
