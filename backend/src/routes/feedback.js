/**
 * Feedback & Roadmap Routes (GetRaze Next)
 * Sistema de sugestões, votação e comentários
 */

const express = require('express');
const router = express.Router();
const feedbackController = require('../controllers/feedbackController');
const { authenticateToken } = require('../middleware/auth');

// Todas as rotas requerem autenticação
router.use(authenticateToken);

// =============================================
// FEEDBACK CRUD
// =============================================

// Listar todos os feedbacks (com filtro por status)
// GET /api/feedback?status=suggestion&sort=votes
router.get('/', feedbackController.getFeedback);

// Obter feedback específico
// GET /api/feedback/:id
router.get('/:id', feedbackController.getFeedbackById);

// Criar nova sugestão
// POST /api/feedback
router.post('/', feedbackController.createFeedback);

// Atualizar feedback (autor: título/desc, admin: status)
// PUT /api/feedback/:id
router.put('/:id', feedbackController.updateFeedback);

// Deletar feedback (autor ou admin)
// DELETE /api/feedback/:id
router.delete('/:id', feedbackController.deleteFeedback);

// =============================================
// VOTAÇÃO
// =============================================

// Votar/desvotar em um feedback (toggle)
// POST /api/feedback/:id/vote
router.post('/:id/vote', feedbackController.toggleVote);

// =============================================
// COMENTÁRIOS
// =============================================

// Listar comentários de um feedback
// GET /api/feedback/:id/comments
router.get('/:id/comments', feedbackController.getComments);

// Adicionar comentário
// POST /api/feedback/:id/comments
router.post('/:id/comments', feedbackController.addComment);

// Deletar comentário (autor ou admin)
// DELETE /api/feedback/:id/comments/:commentId
router.delete('/:id/comments/:commentId', feedbackController.deleteComment);

module.exports = router;
