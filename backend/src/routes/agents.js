// backend/src/routes/agents.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const agentController = require('../controllers/agentController');
const { authenticateToken } = require('../middleware/auth');

// Configuracao do multer para upload de documentos
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024 // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/msword',
      'text/plain',
      'text/markdown'
    ];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo nao suportado. Aceitos: PDF, DOCX, DOC, TXT, MD'), false);
    }
  }
});

// All routes require authentication
router.use(authenticateToken);

// ==========================================
// AI GENERATION ROUTES (must be before /:id)
// ==========================================

/**
 * POST /api/agents/generate-config
 * Generate agent configuration from natural language description using AI
 * Body:
 *   - description (required): string (min 20 chars) - natural language description
 *   - agent_type (optional): linkedin|email|whatsapp (default: linkedin)
 *   - language (optional): pt|en|es (default: pt)
 */
router.post('/generate-config', agentController.generateAgentConfig);

/**
 * POST /api/agents/refine-config
 * Refine an existing agent configuration based on user feedback
 * Body:
 *   - current_config (required): object - current configuration
 *   - feedback (required): string - user feedback for improvements
 *   - language (optional): pt|en|es (default: pt)
 */
router.post('/refine-config', agentController.refineAgentConfig);

// ==========================================
// TEMPLATE ROUTES (must be before /:id)
// ==========================================

/**
 * GET /api/agents/templates
 * Get all available sales methodology templates
 * Query params:
 *   - company_size (optional): startup|smb|mid-market|enterprise
 *   - deal_type (optional): transactional|complex|consultative
 *   - industry (optional): string
 *   - sales_cycle (optional): short|medium|long
 */
router.get('/templates', agentController.getAgentTemplates);

/**
 * GET /api/agents/templates/:templateId
 * Get a specific template with full details
 */
router.get('/templates/:templateId', agentController.getAgentTemplate);

/**
 * POST /api/agents/templates/:templateId/apply
 * Apply a template to generate agent configuration
 * Body:
 *   - agent_name (optional): string - name for the agent
 *   - company_name (optional): string - company name for variables
 *   - products_services (optional): string - products/services description
 *   - area (optional): string - area of work
 */
router.post('/templates/:templateId/apply', agentController.applyAgentTemplate);

// ==========================================
// UNIFIED AGENTS ROUTES
// ==========================================

/**
 * GET /api/agents
 * Get all agents (supports filtering by agent_type, is_active)
 * Query params:
 *   - agent_type (optional): linkedin|google_maps|email|whatsapp
 *   - is_active (optional): true|false
 *   - limit (optional): number of results (default 50)
 *   - offset (optional): pagination offset (default 0)
 */
router.get('/', agentController.getAgents);

/**
 * GET /api/agents/:id
 * Get single agent by ID
 */
router.get('/:id', agentController.getAgent);

/**
 * POST /api/agents
 * Create new agent
 * Body:
 *   - name (required): string
 *   - agent_type (required): linkedin|google_maps|email|whatsapp
 *   - description (optional): string
 *   - avatar_url (optional): string
 *   - response_length (optional): short|medium|long (default: medium)
 *   - config (required): object (structure varies by agent_type)
 *   - is_active (optional): boolean (default: true)
 *   - sector_id (optional): UUID
 *   - daily_limit (optional): number (default: 50)
 *   - execution_time (optional): time (default: 09:00:00)
 */
router.post('/', agentController.createAgent);

/**
 * PUT /api/agents/:id
 * Update agent
 * Body: any fields from create (agent_type cannot be changed)
 */
router.put('/:id', agentController.updateAgent);

/**
 * DELETE /api/agents/:id
 * Delete agent
 */
router.delete('/:id', agentController.deleteAgent);

/**
 * POST /api/agents/:id/test
 * Test agent functionality (simple test)
 * Body:
 *   - message: string
 *   - context: object (optional)
 */
router.post('/:id/test', agentController.testAgent);

/**
 * POST /api/agents/:id/test/initial-message
 * Test agent initial message with RAG
 * Body:
 *   - lead_data: object with lead information
 */
router.post('/:id/test/initial-message', agentController.testAgentInitialMessage);

/**
 * POST /api/agents/:id/test/response
 * Test agent response with RAG and intent detection
 * Body:
 *   - message: string (required)
 *   - conversation_history: array (optional)
 *   - lead_data: object (optional)
 */
router.post('/:id/test/response', agentController.testAgentResponse);

/**
 * GET /api/agents/:id/stats
 * Get agent statistics
 */
router.get('/:id/stats', agentController.getAgentStats);

// ==========================================
// DOCUMENT UPLOAD ROUTES
// ==========================================

/**
 * POST /api/agents/:id/documents
 * Upload a document to the agent's knowledge base
 * Body: multipart/form-data with 'document' field
 * Returns: { success, document, chunks }
 */
router.post('/:id/documents', upload.single('document'), agentController.uploadDocument);

/**
 * GET /api/agents/:id/documents
 * Get all documents in the agent's knowledge base
 */
router.get('/:id/documents', agentController.getAgentDocuments);

/**
 * DELETE /api/agents/:id/documents/:documentId
 * Delete a document from the agent's knowledge base
 */
router.delete('/:id/documents/:documentId', agentController.deleteAgentDocument);

// ==========================================
// ASSIGNEES / ROTATION ROUTES
// ==========================================

/**
 * GET /api/agents/:id/assignees
 * Get all assignees configured for rotation
 */
router.get('/:id/assignees', agentController.getAgentAssignees);

/**
 * POST /api/agents/:id/assignees
 * Set assignees for rotation (replaces existing)
 * Body: { user_ids: [1, 2, 3] } - array of user IDs in rotation order
 */
router.post('/:id/assignees', agentController.setAgentAssignees);

/**
 * POST /api/agents/:id/assignees/:userId
 * Add a single assignee to rotation
 */
router.post('/:id/assignees/:userId', agentController.addAgentAssignee);

/**
 * DELETE /api/agents/:id/assignees/:userId
 * Remove an assignee from rotation
 */
router.delete('/:id/assignees/:userId', agentController.removeAgentAssignee);

/**
 * GET /api/agents/:id/rotation-state
 * Get current rotation state (who's next, total assignments, etc)
 */
router.get('/:id/rotation-state', agentController.getAgentRotationState);

// ==========================================
// ASSIGNMENT HISTORY ROUTES
// ==========================================

/**
 * GET /api/agents/:id/assignments
 * Get assignment history for an agent (log of all automatic assignments)
 * Query params:
 *   - page (optional): page number (default 1)
 *   - limit (optional): items per page (default 50)
 *   - user_id (optional): filter by assigned user
 *   - start_date (optional): filter by date range start
 *   - end_date (optional): filter by date range end
 */
router.get('/:id/assignments', agentController.getAgentAssignmentHistory);

/**
 * GET /api/agents/:id/assignments/stats
 * Get assignment statistics for an agent
 */
router.get('/:id/assignments/stats', agentController.getAgentAssignmentStats);

// ==========================================
// HTTP REQUEST TESTING ROUTES
// ==========================================

/**
 * POST /api/agents/test-http-request
 * Test an HTTP request configuration (for HTTP Request node)
 * Body:
 *   - method: GET|POST|PUT|DELETE|PATCH (default: GET)
 *   - url: string (required)
 *   - headers: [{ key, value, enabled }] (optional)
 *   - queryParams: [{ key, value, enabled }] (optional)
 *   - bodyType: none|json|form-data|raw (default: none)
 *   - body: string (optional)
 *   - timeout: number in ms (default: 30000)
 */
router.post('/test-http-request', agentController.testHTTPRequest);

module.exports = router;
