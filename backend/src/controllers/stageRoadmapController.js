// backend/src/controllers/stageRoadmapController.js
const db = require('../config/database');

// ============================================
// STAGE ROADMAPS - Pipeline Stage Automations
// ============================================

/**
 * Get all stage-roadmap associations for a pipeline
 * Returns roadmaps grouped by stage
 */
const getStageRoadmaps = async (req, res) => {
  try {
    const { pipelineId } = req.params;
    const accountId = req.user.account_id;
    const userId = req.user.id;

    // Verify pipeline belongs to account
    const pipelineCheck = await db.query(
      `SELECT id FROM pipelines WHERE id = $1 AND account_id = $2`,
      [pipelineId, accountId]
    );

    if (pipelineCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Pipeline não encontrada'
      });
    }

    // Get all associations with roadmap details
    const result = await db.query(`
      SELECT
        psr.*,
        ps.name as stage_name,
        ps.color as stage_color,
        ps.position as stage_position,
        r.name as roadmap_name,
        r.description as roadmap_description,
        r.is_global as roadmap_is_global,
        (SELECT COUNT(*) FROM roadmap_tasks WHERE roadmap_id = r.id) as task_count
      FROM pipeline_stage_roadmaps psr
      JOIN pipeline_stages ps ON psr.stage_id = ps.id
      JOIN roadmaps r ON psr.roadmap_id = r.id
      WHERE ps.pipeline_id = $1
        AND r.account_id = $2
        AND psr.is_active = true
        AND r.is_active = true
      ORDER BY ps.position ASC, psr.position ASC
    `, [pipelineId, accountId]);

    // Group by stage
    const byStage = {};
    result.rows.forEach(row => {
      if (!byStage[row.stage_id]) {
        byStage[row.stage_id] = {
          stage_id: row.stage_id,
          stage_name: row.stage_name,
          stage_color: row.stage_color,
          stage_position: row.stage_position,
          roadmaps: []
        };
      }
      byStage[row.stage_id].roadmaps.push({
        id: row.id,
        roadmap_id: row.roadmap_id,
        roadmap_name: row.roadmap_name,
        roadmap_description: row.roadmap_description,
        roadmap_is_global: row.roadmap_is_global,
        task_count: parseInt(row.task_count),
        position: row.position
      });
    });

    res.json({
      success: true,
      data: { stages: Object.values(byStage) }
    });
  } catch (error) {
    console.error('Error fetching stage roadmaps:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao buscar automações'
    });
  }
};

/**
 * Add a roadmap to a pipeline stage
 */
const addStageRoadmap = async (req, res) => {
  try {
    const { pipelineId, stageId } = req.params;
    const { roadmap_id } = req.body;
    const userId = req.user.id;
    const accountId = req.user.account_id;

    if (!roadmap_id) {
      return res.status(400).json({
        success: false,
        error: 'roadmap_id é obrigatório'
      });
    }

    // Verify stage belongs to pipeline and account
    const stageCheck = await db.query(
      `SELECT ps.id FROM pipeline_stages ps
       JOIN pipelines p ON ps.pipeline_id = p.id
       WHERE ps.id = $1 AND ps.pipeline_id = $2 AND p.account_id = $3`,
      [stageId, pipelineId, accountId]
    );

    if (stageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Etapa não encontrada'
      });
    }

    // Verify roadmap exists and user has access
    const roadmapCheck = await db.query(
      `SELECT id, name FROM roadmaps
       WHERE id = $1 AND account_id = $2 AND is_active = true
       AND (created_by = $3 OR is_global = true)`,
      [roadmap_id, accountId, userId]
    );

    if (roadmapCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Roadmap não encontrado'
      });
    }

    // Get next position
    const posResult = await db.query(
      `SELECT COALESCE(MAX(position), -1) + 1 as next_pos
       FROM pipeline_stage_roadmaps
       WHERE stage_id = $1 AND is_active = true`,
      [stageId]
    );

    // Insert or reactivate
    const result = await db.query(`
      INSERT INTO pipeline_stage_roadmaps (stage_id, roadmap_id, position, created_by)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (stage_id, roadmap_id)
      DO UPDATE SET is_active = true, position = EXCLUDED.position, updated_at = NOW()
      RETURNING *
    `, [stageId, roadmap_id, posResult.rows[0].next_pos, userId]);

    // Get full data with roadmap info
    const fullResult = await db.query(`
      SELECT psr.*, r.name as roadmap_name, r.description as roadmap_description,
             (SELECT COUNT(*) FROM roadmap_tasks WHERE roadmap_id = r.id) as task_count
      FROM pipeline_stage_roadmaps psr
      JOIN roadmaps r ON psr.roadmap_id = r.id
      WHERE psr.id = $1
    `, [result.rows[0].id]);

    console.log(`✅ Roadmap "${roadmapCheck.rows[0].name}" vinculado à etapa ${stageId}`);

    res.status(201).json({
      success: true,
      data: fullResult.rows[0]
    });
  } catch (error) {
    console.error('Error adding stage roadmap:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao adicionar automação'
    });
  }
};

/**
 * Remove a roadmap from a pipeline stage
 */
const removeStageRoadmap = async (req, res) => {
  try {
    const { pipelineId, stageId, roadmapId } = req.params;
    const accountId = req.user.account_id;

    // Verify stage belongs to pipeline and account
    const stageCheck = await db.query(
      `SELECT ps.id FROM pipeline_stages ps
       JOIN pipelines p ON ps.pipeline_id = p.id
       WHERE ps.id = $1 AND ps.pipeline_id = $2 AND p.account_id = $3`,
      [stageId, pipelineId, accountId]
    );

    if (stageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Etapa não encontrada'
      });
    }

    // Delete the association
    await db.query(
      `DELETE FROM pipeline_stage_roadmaps WHERE stage_id = $1 AND roadmap_id = $2`,
      [stageId, roadmapId]
    );

    console.log(`🗑️ Roadmap ${roadmapId} removido da etapa ${stageId}`);

    res.json({
      success: true,
      message: 'Automação removida com sucesso'
    });
  } catch (error) {
    console.error('Error removing stage roadmap:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao remover automação'
    });
  }
};

/**
 * Reorder roadmaps within a stage
 */
const reorderStageRoadmaps = async (req, res) => {
  try {
    const { pipelineId, stageId } = req.params;
    const { roadmaps } = req.body; // Array of { roadmap_id, position }
    const accountId = req.user.account_id;

    if (!roadmaps || !Array.isArray(roadmaps)) {
      return res.status(400).json({
        success: false,
        error: 'Lista de roadmaps é obrigatória'
      });
    }

    // Verify stage belongs to pipeline and account
    const stageCheck = await db.query(
      `SELECT ps.id FROM pipeline_stages ps
       JOIN pipelines p ON ps.pipeline_id = p.id
       WHERE ps.id = $1 AND ps.pipeline_id = $2 AND p.account_id = $3`,
      [stageId, pipelineId, accountId]
    );

    if (stageCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: 'Etapa não encontrada'
      });
    }

    // Update positions
    for (const item of roadmaps) {
      await db.query(
        `UPDATE pipeline_stage_roadmaps SET position = $1, updated_at = NOW()
         WHERE stage_id = $2 AND roadmap_id = $3`,
        [item.position, stageId, item.roadmap_id]
      );
    }

    res.json({
      success: true,
      message: 'Ordem atualizada com sucesso'
    });
  } catch (error) {
    console.error('Error reordering stage roadmaps:', error);
    res.status(500).json({
      success: false,
      error: 'Erro ao reordenar automações'
    });
  }
};

/**
 * Get roadmaps associated with a specific stage
 * Used internally by opportunityController for auto-execution
 */
const getStageRoadmapsForExecution = async (stageId, accountId) => {
  const result = await db.query(`
    SELECT psr.roadmap_id, r.name as roadmap_name
    FROM pipeline_stage_roadmaps psr
    JOIN roadmaps r ON psr.roadmap_id = r.id
    WHERE psr.stage_id = $1
      AND psr.is_active = true
      AND r.is_active = true
      AND r.account_id = $2
    ORDER BY psr.position ASC
  `, [stageId, accountId]);

  return result.rows;
};

module.exports = {
  getStageRoadmaps,
  addStageRoadmap,
  removeStageRoadmap,
  reorderStageRoadmaps,
  getStageRoadmapsForExecution
};
