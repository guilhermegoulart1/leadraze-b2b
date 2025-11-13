// backend/src/routes/bulkCollection.js
const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const db = require('../config/database');

router.use(authenticateToken);

// ================================
// CRIAR JOB DE COLETA EM LOTE
// ================================
router.post('/jobs', async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      linkedin_account_id,
      campaign_id,
      target_count,
      api = 'classic',
      search_filters = {}
    } = req.body;

    console.log('🚀 Criando job de coleta em lote:', {
      userId,
      linkedin_account_id,
      campaign_id,
      target_count,
      api
    });

    // Validações
    if (!linkedin_account_id || !campaign_id || !target_count) {
      return res.status(400).json({
        success: false,
        message: 'linkedin_account_id, campaign_id e target_count são obrigatórios'
      });
    }

    // Verificar se conta pertence ao usuário
    const accountCheck = await db.query(
      'SELECT * FROM linkedin_accounts WHERE id = $1 AND user_id = $2',
      [linkedin_account_id, userId]
    );

    if (accountCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Conta LinkedIn não encontrada'
      });
    }

    const account = accountCheck.rows[0];

    // Verificar se campanha pertence ao usuário
    const campaignCheck = await db.query(
      'SELECT * FROM campaigns WHERE id = $1 AND user_id = $2',
      [campaign_id, userId]
    );

    if (campaignCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Campanha não encontrada'
      });
    }

    // Criar job
    const jobData = {
      user_id: userId,
      linkedin_account_id,
      campaign_id,
      target_count: parseInt(target_count),
      collected_count: 0,
      api_type: api,
      status: 'pending',
      search_filters: JSON.stringify(search_filters),
      unipile_account_id: account.unipile_account_id,
      current_cursor: null,
      error_count: 0
    };

    const result = await db.query(
      `INSERT INTO bulk_collection_jobs 
       (user_id, linkedin_account_id, campaign_id, target_count, collected_count, 
        api_type, status, search_filters, unipile_account_id, current_cursor, error_count)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING *`,
      [
        jobData.user_id,
        jobData.linkedin_account_id,
        jobData.campaign_id,
        jobData.target_count,
        jobData.collected_count,
        jobData.api_type,
        jobData.status,
        jobData.search_filters,
        jobData.unipile_account_id,
        jobData.current_cursor,
        jobData.error_count
      ]
    );

    const createdJob = result.rows[0];

    console.log('✅ Job criado:', createdJob.id);

    res.json({
      success: true,
      message: 'Job de coleta criado com sucesso',
      data: createdJob
    });

  } catch (error) {
    console.error('❌ Erro ao criar job:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao criar job de coleta',
      error: error.message
    });
  }
});

// ================================
// LISTAR JOBS DO USUÁRIO
// ================================
router.get('/jobs', async (req, res) => {
  try {
    const userId = req.user.id;
    const { status, limit = 10 } = req.query;

    let query = `
      SELECT 
        bcj.*,
        c.name as campaign_name,
        la.profile_name as linkedin_account_name
      FROM bulk_collection_jobs bcj
      LEFT JOIN campaigns c ON bcj.campaign_id = c.id
      LEFT JOIN linkedin_accounts la ON bcj.linkedin_account_id = la.id
      WHERE bcj.user_id = $1
    `;

    const params = [userId];

    if (status) {
      query += ' AND bcj.status = $2';
      params.push(status);
    }

    query += ' ORDER BY bcj.created_at DESC LIMIT $' + (params.length + 1);
    params.push(parseInt(limit));

    const result = await db.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });

  } catch (error) {
    console.error('❌ Erro ao listar jobs:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao listar jobs',
      error: error.message
    });
  }
});

// ================================
// OBTER JOB ESPECÍFICO
// ================================
router.get('/jobs/:id', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `SELECT 
        bcj.*,
        c.name as campaign_name,
        la.profile_name as linkedin_account_name
       FROM bulk_collection_jobs bcj
       LEFT JOIN campaigns c ON bcj.campaign_id = c.id
       LEFT JOIN linkedin_accounts la ON bcj.linkedin_account_id = la.id
       WHERE bcj.id = $1 AND bcj.user_id = $2`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job não encontrado'
      });
    }

    res.json({
      success: true,
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao buscar job:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao buscar job',
      error: error.message
    });
  }
});

// ================================
// CANCELAR JOB
// ================================
router.post('/jobs/:id/cancel', async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = await db.query(
      `UPDATE bulk_collection_jobs 
       SET status = 'cancelled', completed_at = NOW()
       WHERE id = $1 AND user_id = $2 AND status IN ('pending', 'processing')
       RETURNING *`,
      [id, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Job não encontrado ou não pode ser cancelado'
      });
    }

    console.log('✅ Job cancelado:', id);

    res.json({
      success: true,
      message: 'Job cancelado com sucesso',
      data: result.rows[0]
    });

  } catch (error) {
    console.error('❌ Erro ao cancelar job:', error);
    res.status(500).json({
      success: false,
      message: 'Erro ao cancelar job',
      error: error.message
    });
  }
});

module.exports = router;