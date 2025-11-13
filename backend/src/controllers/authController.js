// backend/src/controllers/authController.js
const db = require('../config/database');
const { hashPassword, comparePassword, generateToken } = require('../utils/helpers');
const { sendSuccess, sendError } = require('../utils/responses');
const { 
  ValidationError, 
  UnauthorizedError, 
  ConflictError,
  NotFoundError 
} = require('../utils/errors');

// ================================
// REGISTER
// ================================
const register = async (req, res) => {
  try {
    const { email, password, name, company } = req.body;

    if (!email || !password || !name) {
      throw new ValidationError('Email, password and name are required');
    }

    // Check if user already exists
    const existingUser = await db.findOne('users', { email });

    if (existingUser) {
      throw new ConflictError('User with this email already exists');
    }

    // Hash password
    const passwordHash = await hashPassword(password);

    // Create user
    const userData = {
      email,
      password_hash: passwordHash,
      name,
      company: company || null
    };

    const user = await db.insert('users', userData);

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    // Generate JWT token
    const token = generateToken({ userId: user.id, email: user.email });

    sendSuccess(res, {
      user: userWithoutPassword,
      token
    }, 'User registered successfully', 201);

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// LOGIN
// ================================
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ValidationError('Email and password are required');
    }

    // Find user
    const user = await db.findOne('users', { email });

    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
    }

    if (!user.is_active) {
      throw new UnauthorizedError('Account is disabled');
    }

    // Verify password
    const isPasswordValid = await comparePassword(password, user.password_hash);
    
    if (!isPasswordValid) {
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    // Remove password hash from response
    const { password_hash, ...userWithoutPassword } = user;

    sendSuccess(res, {
      user: userWithoutPassword,
      token
    }, 'Login successful');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// GOOGLE OAUTH - CALLBACK
// ================================
const googleCallback = async (req, res) => {
  try {
    // Passport will have user info in req.user
    const googleUser = req.user;

    if (!googleUser) {
      throw new UnauthorizedError('Google authentication failed');
    }

    // Check if user exists
    let user = await db.findOne('users', { google_id: googleUser.id });

    // If not, check by email
    if (!user) {
      user = await db.findOne('users', { email: googleUser.email });
    }

    // Create new user if doesn't exist
    if (!user) {
      const userData = {
        email: googleUser.email,
        password_hash: await hashPassword(Math.random().toString(36)), // random password
        name: googleUser.displayName || googleUser.email.split('@')[0],
        google_id: googleUser.id,
        avatar_url: googleUser.photos && googleUser.photos[0] ? googleUser.photos[0].value : null
      };

      user = await db.insert('users', userData);
    } else if (!user.google_id) {
      // Link Google account to existing user
      user = await db.update('users', {
        google_id: googleUser.id,
        avatar_url: googleUser.photos && googleUser.photos[0] ? googleUser.photos[0].value : null
      }, { id: user.id });
    }

    // Generate token
    const token = generateToken({ userId: user.id, email: user.email });

    // Remove password hash
    const { password_hash, ...userWithoutPassword } = user;

    // Redirect to frontend with token
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${token}&user=${encodeURIComponent(JSON.stringify(userWithoutPassword))}`);

  } catch (error) {
    console.error('Google callback error:', error);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/error?message=${encodeURIComponent(error.message)}`);
  }
};

// ================================
// GET PROFILE
// ================================
const getProfile = async (req, res) => {
  try {
    // Get user with LinkedIn accounts
    const user = await db.query(`
      SELECT 
        u.id, u.email, u.name, u.company, u.role, u.subscription_tier, 
        u.avatar_url, u.created_at,
        json_agg(
          json_build_object(
            'id', la.id,
            'linkedin_username', la.linkedin_username,
            'profile_name', la.profile_name,
            'status', la.status,
            'daily_limit', la.daily_limit,
            'today_sent', la.today_sent,
            'connected_at', la.connected_at
          )
        ) FILTER (WHERE la.id IS NOT NULL) as linkedin_accounts
      FROM users u
      LEFT JOIN linkedin_accounts la ON u.id = la.user_id
      WHERE u.id = $1
      GROUP BY u.id
    `, [req.user.id]);

    if (user.rows.length === 0) {
      throw new NotFoundError('User not found');
    }

    sendSuccess(res, user.rows[0], 'Profile retrieved successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

// ================================
// UPDATE PROFILE
// ================================
const updateProfile = async (req, res) => {
  try {
    const { name, company } = req.body;
    const userId = req.user.id;

    const updateData = {};
    if (name) updateData.name = name;
    if (company !== undefined) updateData.company = company;

    if (Object.keys(updateData).length === 0) {
      throw new ValidationError('No fields to update');
    }

    const updatedUser = await db.update('users', updateData, { id: userId });

    const { password_hash, ...userWithoutPassword } = updatedUser;

    sendSuccess(res, userWithoutPassword, 'Profile updated successfully');

  } catch (error) {
    sendError(res, error, error.statusCode || 500);
  }
};

module.exports = {
  register,
  login,
  googleCallback,
  getProfile,
  updateProfile
};