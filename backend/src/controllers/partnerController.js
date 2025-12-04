/**
 * Partner Controller
 *
 * Handles partner public and authenticated API requests
 */

const partnerService = require('../services/partnerService');
const emailService = require('../services/emailService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const WEBSITE_URL = process.env.WEBSITE_URL || 'https://getraze.co';

// ==========================================
// PUBLIC ROUTES
// ==========================================

/**
 * Register a new partner
 * POST /api/partners/register
 */
exports.register = async (req, res) => {
  try {
    const { name, email, phone, type, country } = req.body;

    // Validate required fields
    if (!name || !email || !type) {
      return res.status(400).json({
        success: false,
        message: 'Nome, email e tipo são obrigatórios'
      });
    }

    // Validate type
    if (!['individual', 'company'].includes(type)) {
      return res.status(400).json({
        success: false,
        message: 'Tipo deve ser "individual" ou "company"'
      });
    }

    const partner = await partnerService.register({
      name,
      email,
      phone,
      type,
      country
    });

    // Generate approval token for quick-approve links
    const approvalToken = jwt.sign(
      {
        partnerId: partner.id,
        type: 'partner_approval'
      },
      JWT_SECRET,
      { expiresIn: '30d' } // 30 days to approve
    );

    // Send notification email to admin with approve/reject buttons
    try {
      await emailService.sendPartnerRegistrationNotification(partner, approvalToken);
    } catch (emailError) {
      console.error('Error sending partner notification email:', emailError);
      // Don't fail registration if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Cadastro realizado com sucesso! Aguarde aprovação.',
      data: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        status: partner.status
      }
    });
  } catch (error) {
    console.error('Error registering partner:', error);

    if (error.message === 'Email já cadastrado') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao realizar cadastro'
    });
  }
};

/**
 * Partner login
 * POST /api/partners/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Email e senha são obrigatórios'
      });
    }

    const partner = await partnerService.validateLogin(email, password);

    if (!partner) {
      return res.status(401).json({
        success: false,
        message: 'Email ou senha inválidos'
      });
    }

    // Generate JWT
    const token = jwt.sign(
      {
        id: partner.id,
        email: partner.email,
        type: 'partner'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      data: {
        partner: {
          id: partner.id,
          name: partner.name,
          email: partner.email,
          type: partner.type,
          affiliate_code: partner.affiliate_code
        },
        token
      }
    });
  } catch (error) {
    console.error('Error logging in partner:', error);

    if (error.message === 'Conta não aprovada' || error.message === 'Senha não definida. Verifique seu email.') {
      return res.status(403).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao fazer login'
    });
  }
};

/**
 * Set password (after approval)
 * POST /api/partners/set-password
 */
exports.setPassword = async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({
        success: false,
        message: 'Token e senha são obrigatórios'
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Senha deve ter no mínimo 6 caracteres'
      });
    }

    // Verify token
    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: 'Token inválido ou expirado'
      });
    }

    if (decoded.type !== 'partner_set_password') {
      return res.status(400).json({
        success: false,
        message: 'Token inválido'
      });
    }

    const partner = await partnerService.getById(decoded.partnerId);

    if (!partner || partner.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Partner não encontrado ou não aprovado'
      });
    }

    await partnerService.setPassword(partner.id, password);

    res.json({
      success: true,
      message: 'Senha definida com sucesso!'
    });
  } catch (error) {
    console.error('Error setting password:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao definir senha'
    });
  }
};

/**
 * Validate affiliate code (public)
 * GET /api/partners/validate/:code
 */
exports.validateCode = async (req, res) => {
  try {
    const { code } = req.params;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Código é obrigatório'
      });
    }

    const partner = await partnerService.getByAffiliateCode(code);

    res.json({
      success: true,
      data: {
        valid: !!partner,
        code: partner ? partner.affiliate_code : null
      }
    });
  } catch (error) {
    console.error('Error validating code:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao validar código'
    });
  }
};

/**
 * Track click on affiliate link (public)
 * POST /api/partners/track-click
 */
exports.trackClick = async (req, res) => {
  try {
    const { code } = req.body;

    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Código é obrigatório'
      });
    }

    const partner = await partnerService.trackClick(code);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Código não encontrado'
      });
    }

    res.json({
      success: true,
      data: { code: partner.affiliate_code }
    });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao registrar clique'
    });
  }
};

/**
 * Quick approve/reject partner via URL (from email button)
 * GET /api/partners/quick-approve/:id
 */
exports.quickApprove = async (req, res) => {
  try {
    const { id } = req.params;
    const { token, action } = req.query;

    // Validate action
    if (!['approve', 'reject'].includes(action)) {
      return res.send(renderResultPage('error', 'Ação Inválida', 'A ação especificada não é válida.'));
    }

    // Validate token
    if (!token) {
      return res.send(renderResultPage('error', 'Token Inválido', 'O link de aprovação é inválido ou expirou.'));
    }

    let decoded;
    try {
      decoded = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.send(renderResultPage('error', 'Link Expirado', 'O link de aprovação expirou. Acesse o painel admin para aprovar manualmente.'));
    }

    if (decoded.type !== 'partner_approval' || decoded.partnerId !== id) {
      return res.send(renderResultPage('error', 'Token Inválido', 'O link de aprovação é inválido.'));
    }

    // Get partner
    const partner = await partnerService.getById(id);

    if (!partner) {
      return res.send(renderResultPage('error', 'Partner não encontrado', 'O partner solicitado não foi encontrado.'));
    }

    if (partner.status !== 'pending') {
      const statusText = partner.status === 'approved' ? 'aprovado' : 'processado';
      return res.send(renderResultPage('info', 'Já Processado', `Este partner já foi ${statusText} anteriormente.`));
    }

    if (action === 'approve') {
      // Approve partner
      const approvedPartner = await partnerService.approve(id, null);

      if (!approvedPartner) {
        return res.send(renderResultPage('error', 'Erro na Aprovação', 'Não foi possível aprovar o partner.'));
      }

      // Generate set password token
      const setPasswordToken = jwt.sign(
        {
          partnerId: approvedPartner.id,
          type: 'partner_set_password'
        },
        JWT_SECRET,
        { expiresIn: '7d' }
      );

      const setPasswordUrl = `${WEBSITE_URL}/partner/set-password?token=${setPasswordToken}`;

      // Send approval email to partner
      try {
        await emailService.sendPartnerApprovalEmail(approvedPartner, setPasswordUrl);
      } catch (emailError) {
        console.error('Error sending partner approval email:', emailError);
      }

      return res.send(renderResultPage(
        'success',
        'Partner Aprovado!',
        `<strong>${approvedPartner.name}</strong> foi aprovado com sucesso!<br><br>
        <strong>Código de afiliado:</strong> ${approvedPartner.affiliate_code}<br><br>
        Um email foi enviado para ${approvedPartner.email} com o link para definir a senha.`
      ));
    } else {
      // Reject partner
      const rejectedPartner = await partnerService.reject(id);

      if (!rejectedPartner) {
        return res.send(renderResultPage('error', 'Erro na Rejeição', 'Não foi possível rejeitar o partner.'));
      }

      // Send rejection email to partner
      try {
        await emailService.sendPartnerRejectionEmail(rejectedPartner);
      } catch (emailError) {
        console.error('Error sending partner rejection email:', emailError);
      }

      return res.send(renderResultPage(
        'warning',
        'Partner Reprovado',
        `<strong>${rejectedPartner.name}</strong> foi reprovado.<br><br>
        Um email de notificação foi enviado para ${rejectedPartner.email}.`
      ));
    }
  } catch (error) {
    console.error('Error in quick approve:', error);
    return res.send(renderResultPage('error', 'Erro Interno', 'Ocorreu um erro ao processar sua solicitação.'));
  }
};

/**
 * Render a simple HTML result page
 */
function renderResultPage(type, title, message) {
  const colors = {
    success: { bg: '#10B981', icon: '✓' },
    error: { bg: '#EF4444', icon: '✗' },
    warning: { bg: '#F59E0B', icon: '!' },
    info: { bg: '#3B82F6', icon: 'i' }
  };

  const { bg, icon } = colors[type] || colors.info;
  const frontendUrl = process.env.FRONTEND_URL || 'https://app.getraze.co';

  return `
    <!DOCTYPE html>
    <html lang="pt-BR">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title} - GetRaze Partners</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          background: linear-gradient(135deg, #f5f3ff 0%, #ede9fe 100%);
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 20px;
        }
        .card {
          background: white;
          border-radius: 16px;
          box-shadow: 0 10px 40px rgba(0,0,0,0.1);
          padding: 40px;
          max-width: 500px;
          text-align: center;
        }
        .icon {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: ${bg};
          color: white;
          font-size: 40px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 24px;
        }
        h1 {
          color: #111827;
          margin-bottom: 16px;
          font-size: 24px;
        }
        .message {
          color: #6B7280;
          line-height: 1.6;
          margin-bottom: 32px;
        }
        .message strong {
          color: #111827;
        }
        .btn {
          display: inline-block;
          background: #6366F1;
          color: white;
          padding: 12px 24px;
          border-radius: 8px;
          text-decoration: none;
          font-weight: 600;
          transition: background 0.2s;
        }
        .btn:hover { background: #4F46E5; }
      </style>
    </head>
    <body>
      <div class="card">
        <div class="icon">${icon}</div>
        <h1>${title}</h1>
        <p class="message">${message}</p>
        <a href="${frontendUrl}/admin/partners" class="btn">Ver Painel de Partners</a>
      </div>
    </body>
    </html>
  `;
}

// ==========================================
// AUTHENTICATED ROUTES (partner logged in)
// ==========================================

/**
 * Get current partner profile
 * GET /api/partners/me
 */
exports.getProfile = async (req, res) => {
  try {
    const partner = await partnerService.getById(req.partner.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado'
      });
    }

    res.json({
      success: true,
      data: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        type: partner.type,
        country: partner.country,
        affiliate_code: partner.affiliate_code,
        affiliate_url: `${WEBSITE_URL}?partner=${partner.affiliate_code}`,
        clicks: partner.clicks,
        status: partner.status,
        created_at: partner.created_at
      }
    });
  } catch (error) {
    console.error('Error getting partner profile:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar perfil'
    });
  }
};

/**
 * Update partner profile
 * PUT /api/partners/me
 */
exports.updateProfile = async (req, res) => {
  try {
    const { name, phone, country } = req.body;

    // For now, only allow updating basic info
    // Email change would need verification
    const result = await require('../config/database').query(
      `UPDATE partners
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           country = COALESCE($3, country),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $4
       RETURNING *`,
      [name, phone, country, req.partner.id]
    );

    const partner = result.rows[0];

    res.json({
      success: true,
      data: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        phone: partner.phone,
        type: partner.type,
        country: partner.country
      }
    });
  } catch (error) {
    console.error('Error updating partner profile:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao atualizar perfil'
    });
  }
};

/**
 * Get partner stats
 * GET /api/partners/stats
 */
exports.getStats = async (req, res) => {
  try {
    const stats = await partnerService.getStats(req.partner.id);

    // Add full URL
    stats.link.url = `${WEBSITE_URL}?partner=${stats.link.code}`;

    res.json({
      success: true,
      data: stats
    });
  } catch (error) {
    console.error('Error getting partner stats:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar estatísticas'
    });
  }
};

/**
 * Get partner referrals
 * GET /api/partners/referrals
 */
exports.getReferrals = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await partnerService.getReferrals(req.partner.id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Mask emails for privacy
    result.referrals = result.referrals.map(r => ({
      ...r,
      referred_email: maskEmail(r.referred_email)
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting referrals:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar indicados'
    });
  }
};

/**
 * Get partner earnings
 * GET /api/partners/earnings
 */
exports.getEarnings = async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;

    const result = await partnerService.getEarnings(req.partner.id, {
      page: parseInt(page),
      limit: parseInt(limit)
    });

    // Mask emails for privacy
    result.earnings = result.earnings.map(e => ({
      ...e,
      referred_email: maskEmail(e.referred_email)
    }));

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error getting earnings:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar ganhos'
    });
  }
};

/**
 * Get accounts partner has access to
 * GET /api/partners/accounts
 */
exports.getAccessibleAccounts = async (req, res) => {
  try {
    const accounts = await partnerService.getAccessibleAccounts(req.partner.id);

    res.json({
      success: true,
      data: accounts
    });
  } catch (error) {
    console.error('Error getting accessible accounts:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar contas'
    });
  }
};

/**
 * Access a client account (get token for that account)
 * POST /api/partners/access-account/:accountId
 */
exports.accessAccount = async (req, res) => {
  try {
    const { accountId } = req.params;

    // Check if partner has access
    const hasAccess = await partnerService.hasAccess(req.partner.id, accountId);

    if (!hasAccess) {
      return res.status(403).json({
        success: false,
        message: 'Você não tem acesso a esta conta'
      });
    }

    // Get account admin user
    const db = require('../config/database');
    const userResult = await db.query(
      `SELECT u.* FROM users u
       WHERE u.account_id = $1 AND u.role = 'admin'
       LIMIT 1`,
      [accountId]
    );

    if (!userResult.rows[0]) {
      return res.status(404).json({
        success: false,
        message: 'Conta não encontrada'
      });
    }

    const user = userResult.rows[0];

    // Generate a special token that indicates partner access
    const token = jwt.sign(
      {
        id: user.id,
        email: user.email,
        account_id: accountId,
        partner_id: req.partner.id,
        partner_access: true
      },
      JWT_SECRET,
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        partner_access: true
      }
    });
  } catch (error) {
    console.error('Error accessing account:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao acessar conta'
    });
  }
};

// ==========================================
// CLIENT ROUTES (for managing partner access)
// ==========================================

/**
 * Get partners with access to current account
 * GET /api/settings/partner-access
 */
exports.getPartnersWithAccess = async (req, res) => {
  try {
    const partners = await partnerService.getPartnersWithAccess(req.user.account_id);

    res.json({
      success: true,
      data: partners
    });
  } catch (error) {
    console.error('Error getting partners with access:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar partners'
    });
  }
};

/**
 * Grant access to a partner by email
 * POST /api/settings/partner-access
 */
exports.grantPartnerAccess = async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: 'Email do partner é obrigatório'
      });
    }

    // Find partner by email
    const partner = await partnerService.getApprovedPartnerByEmail(email);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado ou não aprovado'
      });
    }

    // Grant access
    const access = await partnerService.grantAccess(
      partner.id,
      req.user.account_id,
      req.user.id
    );

    res.json({
      success: true,
      message: 'Acesso concedido com sucesso',
      data: {
        partner_id: partner.id,
        partner_name: partner.name,
        partner_email: partner.email,
        granted_at: access.granted_at
      }
    });
  } catch (error) {
    console.error('Error granting partner access:', error);

    if (error.message === 'Acesso já concedido') {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erro ao conceder acesso'
    });
  }
};

/**
 * Revoke access from a partner
 * DELETE /api/settings/partner-access/:partnerId
 */
exports.revokePartnerAccess = async (req, res) => {
  try {
    const { partnerId } = req.params;

    const result = await partnerService.revokeAccess(
      partnerId,
      req.user.account_id,
      req.user.id
    );

    if (!result) {
      return res.status(404).json({
        success: false,
        message: 'Acesso não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Acesso revogado com sucesso'
    });
  } catch (error) {
    console.error('Error revoking partner access:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao revogar acesso'
    });
  }
};

// ==========================================
// HELPERS
// ==========================================

/**
 * Mask email for privacy
 * john@example.com -> j***@example.com
 */
function maskEmail(email) {
  if (!email) return null;

  const [local, domain] = email.split('@');
  if (!local || !domain) return email;

  const maskedLocal = local.charAt(0) + '***';
  return `${maskedLocal}@${domain}`;
}
