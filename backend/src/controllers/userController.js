/**
 * User Controller
 * Handles user management, roles, and team assignments
 * Only accessible by admins
 */

const db = require('../config/database');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { sendSuccess, sendError } = require('../utils/responses');
const { NotFoundError, BadRequestError, ForbiddenError } = require('../utils/errors');
const storageService = require('../services/storageService');
const { assignUserToDefaultSector, getUserLanguage } = require('../services/sectorService');
const emailService = require('../services/emailService');

/**
 * GET /users
 * List all users (admin only)
 */
exports.getUsers = async (req, res) => {
  try {
    const { role, is_active, search, page = 1, limit = 50 } = req.query;
    const accountId = req.user.account_id;

    let whereConditions = ['account_id = $1'];
    let queryParams = [accountId];
    let paramIndex = 2;

    // Filter by role
    if (role) {
      whereConditions.push(`role = $${paramIndex}`);
      queryParams.push(role);
      paramIndex++;
    }

    // Filter by active status
    if (is_active !== undefined) {
      whereConditions.push(`is_active = $${paramIndex}`);
      queryParams.push(is_active === 'true');
      paramIndex++;
    }

    // Search by name or email
    if (search) {
      whereConditions.push(`(name ILIKE $${paramIndex} OR email ILIKE $${paramIndex})`);
      queryParams.push(`%${search}%`);
      paramIndex++;
    }

    const whereClause = 'WHERE ' + whereConditions.join(' AND ');

    const offset = (page - 1) * limit;

    // Get users
    const query = `
      SELECT
        id, email, name, company, role, is_active,
        avatar_url, profile_picture, subscription_tier,
        created_at, updated_at
      FROM users
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}
    `;

    queryParams.push(limit, offset);

    const users = await db.query(query, queryParams);

    // Get total count
    const countQuery = `SELECT COUNT(*) FROM users ${whereClause}`;
    const countResult = await db.query(countQuery, queryParams.slice(0, -2));
    const total = parseInt(countResult.rows[0].count);

    sendSuccess(res, {
      users: users.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /users/:id
 * Get single user details (admin only)
 */
exports.getUser = async (req, res) => {
  try {
    const { id } = req.params;
    const accountId = req.user.account_id;

    const user = await db.query(`
      SELECT
        id, email, name, company, role, is_active,
        avatar_url, profile_picture, subscription_tier,
        google_id, created_at, updated_at
      FROM users
      WHERE id = $1 AND account_id = $2
    `, [id, accountId]);

    if (user.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    // Get team memberships if supervisor
    let teamMembers = [];
    if (user.rows[0].role === 'supervisor') {
      const members = await db.query(`
        SELECT
          u.id, u.name, u.email, u.role,
          ut.created_at as assigned_at
        FROM user_teams ut
        JOIN users u ON ut.member_id = u.id
        WHERE ut.supervisor_id = $1 AND u.account_id = $2
        ORDER BY ut.created_at DESC
      `, [id, accountId]);

      teamMembers = members.rows;
    }

    // Get supervisor if user is team member
    let supervisor = null;
    if (user.rows[0].role === 'user') {
      const supervisorResult = await db.query(`
        SELECT
          u.id, u.name, u.email
        FROM user_teams ut
        JOIN users u ON ut.supervisor_id = u.id
        WHERE ut.member_id = $1 AND u.account_id = $2
      `, [id, accountId]);

      if (supervisorResult.rows.length > 0) {
        supervisor = supervisorResult.rows[0];
      }
    }

    sendSuccess(res, {
      user: user.rows[0],
      team_members: teamMembers,
      supervisor
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /users
 * Create new user (admin only)
 * Sends welcome email with magic link for automatic login
 */
exports.createUser = async (req, res) => {
  try {
    const { email, name, company, role = 'user' } = req.body;
    const accountId = req.user.account_id;
    const creatorName = req.user.name;

    // Validation - password is NOT required (magic link will be sent)
    if (!email || !name) {
      throw new BadRequestError('Email and name are required');
    }

    // Check if email already exists in this account
    const existing = await db.query(
      'SELECT id FROM users WHERE email = $1 AND account_id = $2',
      [email, accountId]
    );
    if (existing.rows.length > 0) {
      throw new BadRequestError('User with this email already exists in your account');
    }

    // Validate role
    const validRoles = ['user', 'supervisor', 'admin'];
    if (!validRoles.includes(role)) {
      throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
    }

    // Only ONE admin per account rule - check if trying to create another admin
    if (role === 'admin') {
      const adminExists = await db.query(
        'SELECT id FROM users WHERE role = $1 AND account_id = $2 LIMIT 1',
        ['admin', accountId]
      );
      if (adminExists.rows.length > 0) {
        throw new ForbiddenError('Only one admin per account is allowed');
      }
    }

    // Generate magic link token (32 bytes = 64 hex characters)
    const magicToken = crypto.randomBytes(32).toString('hex');
    const magicTokenHash = crypto.createHash('sha256').update(magicToken).digest('hex');
    const magicTokenExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    // Create user WITHOUT password, WITH magic link token
    const newUser = await db.query(`
      INSERT INTO users (
        email, password_hash, name, company, role, is_active, account_id,
        password_reset_token, password_reset_expires, must_change_password
      )
      VALUES ($1, NULL, $2, $3, $4, true, $5, $6, $7, true)
      RETURNING id, email, name, company, role, is_active, created_at
    `, [email, name, company, role, accountId, magicTokenHash, magicTokenExpiry]);

    // Auto-assign new user to default "Geral" sector
    let creatorLanguage = 'pt';
    try {
      creatorLanguage = await getUserLanguage(req.user.id);
      await assignUserToDefaultSector(newUser.rows[0].id, accountId, creatorLanguage);
    } catch (sectorError) {
      // Log but don't fail user creation if sector assignment fails
      console.error('Warning: Could not assign user to default sector:', sectorError.message);
    }

    // Send welcome email with magic link
    let emailSent = false;
    try {
      await emailService.sendTeamMemberWelcome({
        email,
        name,
        inviterName: creatorName,
        magicToken,
        language: creatorLanguage
      }, accountId);
      emailSent = true;
    } catch (emailError) {
      console.error('Warning: Could not send welcome email:', emailError.message);
    }

    sendSuccess(res, {
      message: emailSent
        ? 'User created successfully. Welcome email sent.'
        : 'User created successfully. Email could not be sent.',
      user: newUser.rows[0],
      emailSent
    }, 201);

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * PUT /users/:id
 * Update user (admin only)
 */
exports.updateUser = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, company, role, is_active } = req.body;
    const accountId = req.user.account_id;

    // Check if user exists in this account
    const existingUser = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );
    if (existingUser.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = existingUser.rows[0];

    // Prevent changing role to/from admin if it would violate the one-admin rule
    if (role && role !== user.role) {
      const validRoles = ['user', 'supervisor', 'admin'];
      if (!validRoles.includes(role)) {
        throw new BadRequestError(`Invalid role. Must be one of: ${validRoles.join(', ')}`);
      }

      // Check one-admin rule (scoped to account)
      if (role === 'admin') {
        const adminExists = await db.query(
          'SELECT id FROM users WHERE role = $1 AND id != $2 AND account_id = $3 LIMIT 1',
          ['admin', id, accountId]
        );
        if (adminExists.rows.length > 0) {
          throw new ForbiddenError('Only one admin per account is allowed');
        }
      }
    }

    // Build update query
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (company !== undefined) {
      updates.push(`company = $${paramIndex}`);
      values.push(company);
      paramIndex++;
    }

    if (role !== undefined) {
      updates.push(`role = $${paramIndex}`);
      values.push(role);
      paramIndex++;
    }

    if (is_active !== undefined) {
      updates.push(`is_active = $${paramIndex}`);
      values.push(is_active);
      paramIndex++;
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);

    values.push(id, accountId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex} AND account_id = $${paramIndex + 1}
      RETURNING id, email, name, company, role, is_active, updated_at
    `;

    const result = await db.query(query, values);

    sendSuccess(res, {
      message: 'User updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /users/:id
 * Delete user (admin only)
 */
exports.deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.id;
    const accountId = req.user.account_id;

    // Check if user exists in this account
    const userResult = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [id, accountId]
    );
    if (userResult.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const user = userResult.rows[0];

    // Prevent admin from deleting themselves
    if (id === adminId) {
      throw new ForbiddenError('Cannot delete your own account');
    }

    // Prevent deleting the only admin
    if (user.role === 'admin') {
      throw new ForbiddenError('Cannot delete admin account');
    }

    // Delete user (cascading deletes will handle related records)
    await db.query('DELETE FROM users WHERE id = $1 AND account_id = $2', [id, accountId]);

    sendSuccess(res, {
      message: 'User deleted successfully'
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * POST /users/:id/assign-team
 * Assign users to a supervisor's team (admin only)
 */
exports.assignToTeam = async (req, res) => {
  try {
    const { id: supervisorId } = req.params;
    const { member_ids } = req.body; // Array of user IDs to assign
    const accountId = req.user.account_id;

    // Validate supervisor exists and is a supervisor in this account
    const supervisorResult = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [supervisorId, accountId]
    );
    if (supervisorResult.rows.length === 0) {
      throw new NotFoundError('Supervisor not found');
    }

    const supervisor = supervisorResult.rows[0];

    if (supervisor.role !== 'supervisor') {
      throw new BadRequestError('User must have supervisor role');
    }

    // Validate member_ids
    if (!Array.isArray(member_ids) || member_ids.length === 0) {
      throw new BadRequestError('member_ids must be a non-empty array');
    }

    // Assign each member
    const assigned = [];
    const errors = [];

    for (const memberId of member_ids) {
      try {
        // Check member exists in this account and is not admin
        const memberResult = await db.query(
          'SELECT * FROM users WHERE id = $1 AND account_id = $2',
          [memberId, accountId]
        );
        if (memberResult.rows.length === 0) {
          errors.push({ member_id: memberId, error: 'User not found' });
          continue;
        }

        const member = memberResult.rows[0];

        if (member.role === 'admin') {
          errors.push({ member_id: memberId, error: 'Cannot assign admin to a team' });
          continue;
        }

        if (memberId === supervisorId) {
          errors.push({ member_id: memberId, error: 'Cannot assign supervisor to their own team' });
          continue;
        }

        // Insert team assignment
        await db.query(`
          INSERT INTO user_teams (supervisor_id, member_id)
          VALUES ($1, $2)
          ON CONFLICT (supervisor_id, member_id) DO NOTHING
        `, [supervisorId, memberId]);

        assigned.push(memberId);
      } catch (err) {
        errors.push({ member_id: memberId, error: err.message });
      }
    }

    sendSuccess(res, {
      message: 'Team assignments updated',
      assigned,
      errors: errors.length > 0 ? errors : undefined
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * DELETE /users/:supervisorId/team/:memberId
 * Remove user from supervisor's team (admin only)
 */
exports.removeFromTeam = async (req, res) => {
  try {
    const { supervisorId, memberId } = req.params;

    // Delete team assignment
    const result = await db.query(`
      DELETE FROM user_teams
      WHERE supervisor_id = $1 AND member_id = $2
      RETURNING *
    `, [supervisorId, memberId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('Team assignment not found');
    }

    sendSuccess(res, {
      message: 'User removed from team successfully'
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /users/:id/team
 * Get supervisor's team members
 */
exports.getTeamMembers = async (req, res) => {
  try {
    const { id: supervisorId } = req.params;
    const accountId = req.user.account_id;

    // Check if user is supervisor in this account
    const supervisorResult = await db.query(
      'SELECT * FROM users WHERE id = $1 AND account_id = $2',
      [supervisorId, accountId]
    );
    if (supervisorResult.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    const supervisor = supervisorResult.rows[0];

    if (supervisor.role !== 'supervisor') {
      throw new BadRequestError('User is not a supervisor');
    }

    // Get team members (only from this account)
    const members = await db.query(`
      SELECT
        u.id, u.name, u.email, u.role, u.is_active,
        u.avatar_url, u.created_at,
        ut.created_at as assigned_at
      FROM user_teams ut
      JOIN users u ON ut.member_id = u.id
      WHERE ut.supervisor_id = $1 AND u.account_id = $2
      ORDER BY ut.created_at DESC
    `, [supervisorId, accountId]);

    sendSuccess(res, {
      supervisor: {
        id: supervisor.id,
        name: supervisor.name,
        email: supervisor.email
      },
      members: members.rows
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * GET /users/profile
 * Get current user's profile
 * Accessible by the user themselves
 */
exports.getProfile = async (req, res) => {
  try {
    const userId = req.user.id;

    const result = await db.query(`
      SELECT
        id, email, name, company, role, is_active,
        avatar_url, profile_picture, preferred_language,
        preferred_theme, timezone, created_at, updated_at
      FROM users
      WHERE id = $1
    `, [userId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, {
      user: result.rows[0]
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * PUT /users/profile
 * Update current user's profile
 * Accessible by the user themselves
 */
exports.updateProfile = async (req, res) => {
  try {
    const userId = req.user.id;
    const { name, company, profile_picture, preferred_language, preferred_theme, timezone } = req.body;

    // Build update query dynamically
    const updates = [];
    const values = [];
    let paramIndex = 1;

    if (name !== undefined) {
      updates.push(`name = $${paramIndex}`);
      values.push(name);
      paramIndex++;
    }

    if (company !== undefined) {
      updates.push(`company = $${paramIndex}`);
      values.push(company);
      paramIndex++;
    }

    if (profile_picture !== undefined) {
      // Handle profile picture upload to R2
      if (profile_picture === null || profile_picture === '') {
        // Remove profile picture
        try {
          await storageService.deleteProfilePicture(userId);
        } catch (err) {
          console.warn('Error deleting old profile picture:', err.message);
        }
        updates.push(`avatar_url = $${paramIndex}`);
        values.push(null);
        paramIndex++;
        updates.push(`profile_picture = $${paramIndex}`);
        values.push(null);
        paramIndex++;
      } else if (profile_picture.startsWith('data:image/')) {
        // Upload base64 image to R2
        try {
          const { buffer, mimeType } = storageService.base64ToBuffer(profile_picture);

          // Validate size (5MB max)
          if (buffer.length > 5 * 1024 * 1024) {
            throw new BadRequestError('Image too large. Maximum size is 5MB.');
          }

          // Delete old profile picture from R2
          try {
            await storageService.deleteProfilePicture(userId);
          } catch (err) {
            // Ignore if no old picture exists
          }

          // Upload to R2
          const result = await storageService.uploadProfilePicture(
            userId,
            buffer,
            mimeType,
            'avatar.jpg'
          );

          // Update avatar_url with R2 URL
          updates.push(`avatar_url = $${paramIndex}`);
          values.push(result.url);
          paramIndex++;

          // Clear legacy base64 field
          updates.push(`profile_picture = $${paramIndex}`);
          values.push(null);
          paramIndex++;
        } catch (uploadError) {
          console.error('Error uploading profile picture to R2:', uploadError);
          // Fallback: Store as base64 if R2 fails (for backwards compatibility)
          if (profile_picture.length > 5 * 1024 * 1024 * 1.37) {
            throw new BadRequestError('Image too large. Maximum size is 5MB.');
          }
          updates.push(`profile_picture = $${paramIndex}`);
          values.push(profile_picture);
          paramIndex++;
        }
      } else if (profile_picture.startsWith('http')) {
        // It's already a URL (from R2 or external)
        updates.push(`avatar_url = $${paramIndex}`);
        values.push(profile_picture);
        paramIndex++;
      } else {
        throw new BadRequestError('Invalid image format. Must be a base64 encoded image or URL.');
      }
    }

    if (preferred_language !== undefined) {
      const validLanguages = ['en', 'pt', 'es'];
      if (!validLanguages.includes(preferred_language)) {
        throw new BadRequestError(`Invalid language. Must be one of: ${validLanguages.join(', ')}`);
      }
      updates.push(`preferred_language = $${paramIndex}`);
      values.push(preferred_language);
      paramIndex++;
    }

    if (preferred_theme !== undefined) {
      const validThemes = ['light', 'dark', 'system'];
      if (!validThemes.includes(preferred_theme)) {
        throw new BadRequestError(`Invalid theme. Must be one of: ${validThemes.join(', ')}`);
      }
      updates.push(`preferred_theme = $${paramIndex}`);
      values.push(preferred_theme);
      paramIndex++;
    }

    if (timezone !== undefined) {
      updates.push(`timezone = $${paramIndex}`);
      values.push(timezone);
      paramIndex++;
    }

    if (updates.length === 0) {
      throw new BadRequestError('No fields to update');
    }

    updates.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(userId);

    const query = `
      UPDATE users
      SET ${updates.join(', ')}
      WHERE id = $${paramIndex}
      RETURNING id, email, name, company, role, is_active,
                avatar_url, profile_picture, preferred_language,
                preferred_theme, timezone, created_at, updated_at
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, {
      message: 'Profile updated successfully',
      user: result.rows[0]
    });

  } catch (error) {
    sendError(res, error);
  }
};

/**
 * PUT /users/language
 * Update user's preferred language
 * Accessible by the user themselves
 */
exports.updateLanguage = async (req, res) => {
  try {
    const { language } = req.body;
    const userId = req.user.id;

    // Validate language
    const validLanguages = ['en', 'pt', 'es'];
    if (!language || !validLanguages.includes(language)) {
      throw new BadRequestError(`Invalid language. Must be one of: ${validLanguages.join(', ')}`);
    }

    // Update user's preferred language
    const result = await db.query(`
      UPDATE users
      SET preferred_language = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2
      RETURNING id, preferred_language, timezone
    `, [language, userId]);

    if (result.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, {
      message: 'Language preference updated successfully',
      language: result.rows[0].preferred_language,
      timezone: result.rows[0].timezone
    });

  } catch (error) {
    sendError(res, error);
  }
};
