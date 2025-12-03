/**
 * Partner Admin Controller
 *
 * Handles admin operations for partners (approve, reject, suspend, etc.)
 */

const partnerService = require('../services/partnerService');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const APP_URL = process.env.APP_URL || 'http://localhost:5173';

/**
 * List partners with filters
 * GET /api/admin/partners
 */
exports.list = async (req, res) => {
  try {
    const { status, page = 1, limit = 20, search } = req.query;

    const result = await partnerService.list({
      status,
      page: parseInt(page),
      limit: parseInt(limit),
      search
    });

    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('Error listing partners:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar partners'
    });
  }
};

/**
 * Get partner details
 * GET /api/admin/partners/:id
 */
exports.getById = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await partnerService.getById(id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado'
      });
    }

    // Get stats if approved
    let stats = null;
    if (partner.status === 'approved') {
      stats = await partnerService.getStats(id);
    }

    res.json({
      success: true,
      data: {
        ...partner,
        password_hash: undefined, // Don't expose
        stats
      }
    });
  } catch (error) {
    console.error('Error getting partner:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar partner'
    });
  }
};

/**
 * Approve partner
 * PUT /api/admin/partners/:id/approve
 */
exports.approve = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await partnerService.approve(id, req.user.id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado ou já processado'
      });
    }

    // Generate set password token
    const setPasswordToken = jwt.sign(
      {
        partnerId: partner.id,
        type: 'partner_set_password'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const setPasswordUrl = `${APP_URL}/partner/set-password?token=${setPasswordToken}`;

    // TODO: Send email to partner with setPasswordUrl
    // For now, return the URL in response (for testing)

    res.json({
      success: true,
      message: 'Partner aprovado com sucesso',
      data: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        affiliate_code: partner.affiliate_code,
        status: partner.status,
        set_password_url: setPasswordUrl // Remove in production, send via email
      }
    });
  } catch (error) {
    console.error('Error approving partner:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao aprovar partner'
    });
  }
};

/**
 * Reject partner
 * PUT /api/admin/partners/:id/reject
 */
exports.reject = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await partnerService.reject(id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado ou já processado'
      });
    }

    // TODO: Send rejection email to partner

    res.json({
      success: true,
      message: 'Partner rejeitado',
      data: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        status: partner.status
      }
    });
  } catch (error) {
    console.error('Error rejecting partner:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao rejeitar partner'
    });
  }
};

/**
 * Suspend partner
 * PUT /api/admin/partners/:id/suspend
 */
exports.suspend = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await partnerService.suspend(id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado ou não pode ser suspenso'
      });
    }

    res.json({
      success: true,
      message: 'Partner suspenso',
      data: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        status: partner.status
      }
    });
  } catch (error) {
    console.error('Error suspending partner:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao suspender partner'
    });
  }
};

/**
 * Reactivate partner
 * PUT /api/admin/partners/:id/reactivate
 */
exports.reactivate = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await partnerService.reactivate(id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado ou não pode ser reativado'
      });
    }

    res.json({
      success: true,
      message: 'Partner reativado',
      data: {
        id: partner.id,
        name: partner.name,
        email: partner.email,
        status: partner.status
      }
    });
  } catch (error) {
    console.error('Error reactivating partner:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao reativar partner'
    });
  }
};

/**
 * Delete partner
 * DELETE /api/admin/partners/:id
 */
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await partnerService.delete(id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado'
      });
    }

    res.json({
      success: true,
      message: 'Partner excluído'
    });
  } catch (error) {
    console.error('Error deleting partner:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao excluir partner'
    });
  }
};

/**
 * Get partner stats (admin view)
 * GET /api/admin/partners/:id/stats
 */
exports.getStats = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await partnerService.getById(id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado'
      });
    }

    if (partner.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Partner não aprovado'
      });
    }

    const stats = await partnerService.getStats(id);

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
 * Resend set password email
 * POST /api/admin/partners/:id/resend-password-email
 */
exports.resendPasswordEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const partner = await partnerService.getById(id);

    if (!partner) {
      return res.status(404).json({
        success: false,
        message: 'Partner não encontrado'
      });
    }

    if (partner.status !== 'approved') {
      return res.status(400).json({
        success: false,
        message: 'Partner não aprovado'
      });
    }

    if (partner.password_hash) {
      return res.status(400).json({
        success: false,
        message: 'Partner já definiu a senha'
      });
    }

    // Generate new set password token
    const setPasswordToken = jwt.sign(
      {
        partnerId: partner.id,
        type: 'partner_set_password'
      },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    const setPasswordUrl = `${APP_URL}/partner/set-password?token=${setPasswordToken}`;

    // TODO: Send email to partner

    res.json({
      success: true,
      message: 'Email enviado',
      data: {
        set_password_url: setPasswordUrl // Remove in production
      }
    });
  } catch (error) {
    console.error('Error resending password email:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao enviar email'
    });
  }
};
