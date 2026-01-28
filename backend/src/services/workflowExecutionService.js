// backend/src/services/workflowExecutionService.js

/**
 * Workflow Execution Service
 *
 * Main orchestrator for workflow execution. Handles:
 * - Workflow initialization
 * - Event processing
 * - Node execution (trigger, conversation, condition, action)
 * - Navigation through workflow edges
 */

const db = require('../config/database');
const workflowStateService = require('./workflowStateService');
const workflowLogService = require('./workflowLogService');
const workflowConditionEvaluator = require('./workflowConditionEvaluator');
const workflowActionExecutors = require('./workflowActionExecutors');
const workflowTriggerFilterEvaluator = require('./workflowTriggerFilterEvaluator');
const aiResponseService = require('./aiResponseService');
const ragService = require('./ragService');

/**
 * Initialize workflow for a new conversation
 * @param {string} conversationId - Conversation UUID
 * @param {number} agentId - AI Agent ID
 * @param {string} triggerEvent - Initial trigger event type
 * @returns {Promise<object>} Initial workflow state
 */
async function initializeWorkflow(conversationId, agentId, triggerEvent = null) {
  try {
    console.log(`🚀 Initializing workflow for conversation ${conversationId}, agent ${agentId}`);

    // Fetch agent with workflow definition
    const agentResult = await db.query(
      `SELECT id, name, workflow_definition, workflow_enabled,
              products_services, behavioral_profile, language, tone
       FROM ai_agents WHERE id = $1`,
      [agentId]
    );

    if (!agentResult.rows || agentResult.rows.length === 0) {
      throw new Error(`Agent ${agentId} not found`);
    }

    const agent = agentResult.rows[0];

    if (!agent.workflow_enabled || !agent.workflow_definition) {
      console.log(`⚠️ Agent ${agentId} does not have workflow enabled`);
      return { workflowEnabled: false };
    }

    const workflowDef = agent.workflow_definition;

    // Find the appropriate trigger node
    let triggerNode = null;
    if (workflowDef.nodes) {
      triggerNode = workflowDef.nodes.find(n =>
        n.type === 'trigger' &&
        (!triggerEvent || n.data?.event === triggerEvent)
      );

      // Fallback to any trigger if specific not found
      if (!triggerNode) {
        triggerNode = workflowDef.nodes.find(n => n.type === 'trigger');
      }
    }

    const initialNodeId = triggerNode?.id || null;

    // Initialize state
    const state = await workflowStateService.initializeWorkflowState(
      conversationId,
      agentId,
      workflowDef,
      initialNodeId
    );

    // Log workflow start
    await workflowLogService.logWorkflowStarted({
      conversationId,
      agentId,
      nodeId: initialNodeId,
      inputData: { triggerEvent },
      outputData: { stateId: state.id }
    });

    return {
      workflowEnabled: true,
      state,
      triggerNode
    };
  } catch (error) {
    console.error('❌ Error initializing workflow:', error);
    throw error;
  }
}

/**
 * Process an event in the workflow
 * @param {string} conversationId - Conversation UUID
 * @param {string} event - Event type (message_received, invite_accepted, etc.)
 * @param {object} payload - Event payload
 * @param {object} options - Additional options
 * @returns {Promise<object>} Processing result
 */
async function processEvent(conversationId, event, payload = {}, options = {}) {
  const startTime = Date.now();

  try {
    console.log(`📨 Processing event: ${event} for conversation ${conversationId}`);

    // Get current workflow state
    const state = await workflowStateService.getWorkflowState(conversationId);

    if (!state) {
      console.log(`⚠️ No workflow state found for conversation ${conversationId}`);
      return { processed: false, reason: 'no_workflow_state' };
    }

    // Check if workflow is active
    if (state.status === 'paused') {
      // Check if it's time to resume
      if (await workflowStateService.shouldResume(conversationId)) {
        await workflowStateService.resumeWorkflow(conversationId);
      } else {
        console.log(`⏸️ Workflow is paused until ${state.pausedUntil}`);
        return { processed: false, reason: 'workflow_paused' };
      }
    }

    if (state.status !== 'active') {
      console.log(`⚠️ Workflow is ${state.status}, not processing`);
      return { processed: false, reason: `workflow_${state.status}` };
    }

    const workflowDef = state.workflowDefinition;

    // Build execution context
    const context = await buildExecutionContext(conversationId, state, event, payload, options);

    // Find the node to execute
    let currentNode = findNodeById(workflowDef, state.currentNodeId);

    // If no current node, find trigger for this event
    if (!currentNode) {
      currentNode = findTriggerForEvent(workflowDef, event);
    }

    if (!currentNode) {
      console.log(`⚠️ No node to execute for event ${event}`);
      return { processed: false, reason: 'no_node_for_event' };
    }

    // Execute the workflow from current node
    const result = await executeFromNode(currentNode, workflowDef, context);

    const durationMs = Date.now() - startTime;
    console.log(`✅ Workflow processing complete (${durationMs}ms)`);

    return {
      processed: true,
      ...result,
      durationMs
    };
  } catch (error) {
    console.error('❌ Error processing workflow event:', error);

    // Log error
    await workflowLogService.logError({
      conversationId,
      agentId: options.agentId,
      eventType: 'workflow_error',
      errorMessage: error.message,
      inputData: { event, payload }
    });

    throw error;
  }
}

/**
 * Execute workflow starting from a specific node
 * @param {object} startNode - Node to start from
 * @param {object} workflowDef - Workflow definition
 * @param {object} context - Execution context
 * @returns {Promise<object>} Execution result
 */
async function executeFromNode(startNode, workflowDef, context) {
  let currentNode = startNode;
  const executedNodes = [];
  let response = null;
  const allResponses = []; // ✅ Coletar TODAS as respostas quando múltiplos nós executam em sequência
  let shouldPause = false;
  let shouldEnd = false;
  let pauseReason = null;
  let resumeNodeId = null;

  while (currentNode && !shouldPause && !shouldEnd) {
    console.log(`➡️ Executing node: ${currentNode.id} (${currentNode.type})`);

    // Log node entry
    await workflowLogService.logNodeEntered({
      conversationId: context.conversationId,
      testSessionId: context.testSessionId,
      agentId: context.agentId,
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeLabel: currentNode.data?.label || currentNode.data?.name
    });

    // Execute based on node type
    let nodeResult;

    switch (currentNode.type) {
      case 'trigger':
        nodeResult = await executeTriggerNode(currentNode, context);
        // If trigger was filtered, stop workflow execution
        if (nodeResult.filtered) {
          console.log(`🚫 [Workflow] Trigger filtered - stopping execution: ${nodeResult.reason}`);
          return {
            executedNodes: [{ nodeId: currentNode.id, nodeType: 'trigger', result: nodeResult }],
            response: null,
            allResponses: [],
            paused: false,
            completed: false,
            filtered: true,
            filterReason: nodeResult.reason,
            filterResults: nodeResult.filterResults
          };
        }
        break;

      case 'conversationStep':
        nodeResult = await executeConversationNode(currentNode, context);

        // Track attempt count for this conversationStep
        // Only count entries where we actually had a lead message to evaluate (not the initial AI send)
        // If hasMaxMessages is false or maxMessages is null/0 = unlimited (use 9999)
        const hasMaxMessages = currentNode.data?.hasMaxMessages === true;
        const configuredMax = currentNode.data?.maxMessages;
        const maxAttempts = (hasMaxMessages && configuredMax && configuredMax > 0) ? configuredMax : 9999;
        const stepHistory = context.stepHistory || [];
        // Filter to only count actual evaluation attempts (entries with hadMessage=true)
        // hadMessage is stored inside result object
        const attemptCount = stepHistory.filter(s =>
          s.nodeId === currentNode.id && s.result?.hadMessage === true
        ).length;

        // ✅ CORREÇÃO: Verificar se este nó ESPECÍFICO já foi executado antes
        // Isso é crucial quando avançamos de uma etapa para outra (ex: Etapa 1 → Etapa 2)
        // porque context.message ainda terá a mensagem do lead da etapa anterior
        const hasThisNodeBeenExecuted = stepHistory.some(s => s.nodeId === currentNode.id);

        // ConversationStep should wait for response to evaluate objective
        // If this is the first execution of THIS NODE (not in stepHistory), pause for response
        // Note: We use hasThisNodeBeenExecuted instead of !context.message because
        // when advancing from one step to another, context.message still has the previous message
        if (!hasThisNodeBeenExecuted && nodeResult.response) {
          // First execution - send initial AI message and pause for lead response
          response = nodeResult.response;
          // ✅ Adicionar ao array de respostas
          allResponses.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data?.name || currentNode.data?.label || 'Etapa',
            message: nodeResult.response,
            type: 'conversationStep'
          });
          shouldPause = true;
          pauseReason = 'waiting_for_response';
          // Resume to THIS node to evaluate the response
          resumeNodeId = currentNode.id;
          nodeResult.pauseReason = pauseReason;
          nodeResult.resumeNodeId = resumeNodeId;
          // Mark this entry as initial send (not an evaluation attempt)
          nodeResult.hadMessage = false;
          console.log(`⏸️ [ConversationStep] First execution of node ${currentNode.id} - pausing for lead response. hasThisNodeBeenExecuted=${hasThisNodeBeenExecuted}`);
        }
        // If this node WAS executed before AND we have a lead message, evaluate the objective
        else if (hasThisNodeBeenExecuted && context.message) {
          // Mark this as an actual evaluation attempt
          nodeResult.hadMessage = true;

          // Current attempt number (1-indexed for user display)
          const currentAttempt = attemptCount + 1;
          console.log(`📊 [ConversationStep] Evaluating response - attempt ${currentAttempt}/${maxAttempts} for node ${currentNode.id}`);
          console.log(`🔍 [ConversationStep] nodeResult.shouldAdvance = ${nodeResult.shouldAdvance}`);

          // AI determines if objective was achieved via shouldAdvance
          if (nodeResult.shouldAdvance) {
            // ✅ OBJETIVO ATINGIDO - NÃO enviar resposta da IA, apenas avançar para próxima etapa
            // A próxima etapa (ex: ACAO com send_message) enviará sua própria mensagem
            nodeResult.path = 'success';
            console.log(`✅ [ConversationStep] Objective achieved on attempt ${currentAttempt}! Skipping AI response, advancing to next node.`);
            // NÃO definimos response aqui - deixamos o próximo nó definir
          } else {
            // Objective NOT achieved - send AI response and continue conversation
            response = nodeResult.response;
            // ✅ Adicionar ao array de respostas
            if (nodeResult.response) {
              allResponses.push({
                nodeId: currentNode.id,
                nodeLabel: currentNode.data?.name || currentNode.data?.label || 'Etapa',
                message: nodeResult.response,
                type: 'conversationStep'
              });
            }

            // Check if we've exceeded max attempts (currentAttempt is 1-indexed)
            if (currentAttempt >= maxAttempts) {
              // Max attempts reached - follow failure path
              nodeResult.path = 'failure';
              console.log(`❌ [ConversationStep] Max attempts (${maxAttempts}) reached on attempt ${currentAttempt}. Following failure path.`);
            } else {
              // Continue conversation - pause again at the SAME node
              shouldPause = true;
              pauseReason = 'waiting_for_response';
              resumeNodeId = currentNode.id;
              nodeResult.pauseReason = pauseReason;
              nodeResult.resumeNodeId = resumeNodeId;
              console.log(`🔄 [ConversationStep] Objective not achieved (attempt ${currentAttempt}/${maxAttempts}). Continuing conversation at same node.`);
            }
          }
        }
        break;

      case 'condition':
        nodeResult = await executeConditionNode(currentNode, context);
        break;

      case 'httpRequest':
        nodeResult = await executeHTTPRequestNode(currentNode, context);
        break;

      case 'action':
        nodeResult = await executeActionNode(currentNode, context);

        // Debug: log the result structure
        console.log(`🔍 [Action] nodeResult:`, {
          actionType: nodeResult.actionType,
          pausesWorkflow: nodeResult.pausesWorkflow,
          endsBranch: nodeResult.endsBranch,
          resultWaitForResponse: nodeResult.result?.waitForResponse,
          fullResult: nodeResult.result
        });

        // ✅ Capturar mensagem de ações send_message como response do workflow
        // Isso é importante quando ConversationStep atinge objetivo e avança para ACAO
        if (nodeResult.actionType === 'send_message' && nodeResult.result?.message) {
          response = nodeResult.result.message;
          // ✅ Adicionar ao array de respostas para não perder quando múltiplos nós executam
          allResponses.push({
            nodeId: currentNode.id,
            nodeLabel: currentNode.data?.label || currentNode.data?.actionType || 'Ação',
            message: nodeResult.result.message,
            type: 'action'
          });
          console.log(`📨 [Action] send_message response captured: "${response.substring(0, 50)}..." (total: ${allResponses.length})`);
        }

        // Check both static pausesWorkflow AND dynamic waitForResponse from result
        shouldPause = nodeResult.pausesWorkflow || nodeResult.result?.waitForResponse === true;
        shouldEnd = nodeResult.endsBranch;

        console.log(`🔍 [Action] shouldPause: ${shouldPause}, shouldEnd: ${shouldEnd}`);

        // If waiting for response, set up the resume info
        if (nodeResult.result?.waitForResponse === true) {
          // Find next node to resume from when response arrives
          const nextNodeAfterWait = findNextNode(workflowDef, currentNode, nodeResult);
          pauseReason = 'waiting_for_response';
          resumeNodeId = nextNodeAfterWait?.id || null;
          nodeResult.pauseReason = pauseReason;
          nodeResult.resumeNodeId = resumeNodeId;
          console.log(`⏸️ [Workflow] Pausing for response. Resume node: ${resumeNodeId}`);
        }
        // If this is a wait action, set up resume to the NEXT node
        else if (nodeResult.result?.isWaitAction === true) {
          const nextNodeAfterWait = findNextNode(workflowDef, currentNode, nodeResult);
          pauseReason = 'wait_action';
          resumeNodeId = nextNodeAfterWait?.id || null;
          nodeResult.pauseReason = pauseReason;
          nodeResult.resumeNodeId = resumeNodeId;
          console.log(`⏸️ [Workflow] Pausing for wait action. Resume node: ${resumeNodeId}`);
        }
        break;

      default:
        console.warn(`⚠️ Unknown node type: ${currentNode.type}`);
        nodeResult = { success: true };
    }

    executedNodes.push({
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      result: nodeResult
    });

    // Update state with new step
    await workflowStateService.addStepToHistory(context.conversationId, {
      nodeId: currentNode.id,
      nodeType: currentNode.type,
      nodeLabel: currentNode.data?.label || currentNode.data?.name,
      result: nodeResult
    });

    if (shouldPause) {
      // Log the pause event
      const pauseReason = nodeResult.pauseReason || 'action_pause';
      await workflowLogService.logWorkflowPaused({
        conversationId: context.conversationId,
        testSessionId: context.testSessionId,
        agentId: context.agentId,
        nodeId: currentNode.id,
        nodeLabel: currentNode.data?.label || currentNode.data?.actionType || 'Ação',
        pauseReason,
        resumeNodeId: nodeResult.resumeNodeId,
        outputData: {
          reason: pauseReason === 'waiting_for_response' ? 'Aguardando resposta do lead' : pauseReason,
          resumeNodeId: nodeResult.resumeNodeId
        }
      });

      // Workflow is paused - update state
      await workflowStateService.pauseWorkflow(
        context.conversationId,
        nodeResult.resumeAt,
        pauseReason,
        nodeResult.resumeNodeId,
        nodeResult.jobId
      );
      break;
    }

    if (shouldEnd) {
      // Branch ends here
      await workflowStateService.completeWorkflow(context.conversationId, 'branch_completed');
      break;
    }

    // Find next node
    const nextNode = findNextNode(workflowDef, currentNode, nodeResult);

    if (!nextNode) {
      console.log(`🏁 No more nodes to execute`);

      // Log detailed info for conditions without matching edge
      if (currentNode.type === 'condition' && nodeResult?.path) {
        const availableEdges = workflowDef.edges?.filter(e => e.source === currentNode.id) || [];
        const edgeHandles = availableEdges.map(e => e.sourceHandle);

        console.log(`❌ [EDGE_NOT_FOUND] Node: ${currentNode.id}`);
        console.log(`   Expected path: "${nodeResult.path}"`);
        console.log(`   Available sourceHandles:`, edgeHandles);
        console.log(`   Full edges:`, JSON.stringify(availableEdges, null, 2));

        const handlesList = edgeHandles.length > 0 ? edgeHandles.join(', ') : 'NENHUM';

        await workflowLogService.logEvent({
          conversationId: context.conversationId,
          testSessionId: context.testSessionId,
          agentId: context.agentId,
          nodeId: currentNode.id,
          nodeType: 'navigation',
          nodeLabel: `Buscando: "${nodeResult.path}" | Existentes: [${handlesList}]`,
          eventType: 'EDGE_NOT_FOUND',
          inputData: {
            expectedPath: nodeResult.path,
            availableHandles: edgeHandles,
            edgesFromNode: availableEdges.map(e => ({
              sourceHandle: e.sourceHandle,
              target: e.target
            }))
          },
          decisionReason: `Edges saindo do nó: ${availableEdges.length}`,
          success: false
        });
      }

      break;
    }

    // Update current node in state
    await workflowStateService.updateWorkflowState(context.conversationId, {
      currentNodeId: nextNode.id
    });

    currentNode = nextNode;
  }

  // Check if last executed node was a wait action
  const lastNode = executedNodes[executedNodes.length - 1];
  // For action nodes, the result structure is: { success, result: executorResult, pausesWorkflow, ... }
  // The executor result is inside nodeResult.result for actions
  const actionResult = lastNode?.result?.result || lastNode?.result;

  // Debug: log structure to understand the data
  console.log(`🔍 [waitInfo extraction] lastNode:`, {
    nodeId: lastNode?.nodeId,
    nodeType: lastNode?.nodeType,
    resultKeys: lastNode?.result ? Object.keys(lastNode.result) : null,
    resultResultKeys: lastNode?.result?.result ? Object.keys(lastNode.result.result) : null,
    actionResultIsWaitAction: actionResult?.isWaitAction
  });

  const isWaitAction = actionResult?.isWaitAction === true;
  const waitInfo = isWaitAction ? {
    waitTime: actionResult.waitTime,
    waitUnit: actionResult.waitUnit,
    formattedDuration: actionResult.formattedDuration,
    isWaitAction: true
  } : null;

  console.log(`🔍 [waitInfo extraction] isWaitAction=${isWaitAction}, waitInfo=${JSON.stringify(waitInfo)}`);

  // Extract enriched data from the last conversationStep node
  let enrichedData = null;
  const lastConversationNode = [...executedNodes].reverse().find(n => n.nodeType === 'conversationStep');
  if (lastConversationNode?.result) {
    const result = lastConversationNode.result;
    if (result.extractedData || result.qualification || result.objection) {
      enrichedData = {
        extractedData: result.extractedData || null,
        qualification: result.qualification || null,
        objection: result.objection || null
      };
      console.log(`📊 [Workflow] Dados enriquecidos extraídos:`, JSON.stringify(enrichedData));
    }
  }

  // ✅ Log todas as respostas coletadas
  if (allResponses.length > 1) {
    console.log(`📬 [Workflow] ${allResponses.length} respostas coletadas:`, allResponses.map(r => r.nodeLabel));
  }

  return {
    executedNodes,
    response,
    allResponses, // ✅ Array com TODAS as respostas quando múltiplos nós executam em sequência
    paused: shouldPause,
    completed: shouldEnd,
    finalNodeId: currentNode?.id,
    pauseReason,
    resumeNodeId,
    waitInfo,
    enrichedData
  };
}

/**
 * Execute trigger node
 * Evaluates trigger filters if configured before allowing workflow to proceed
 */
async function executeTriggerNode(node, context) {
  const { data } = node;

  // Check if trigger has filters that should be evaluated
  if (data.filtersEnabled && data.filters && data.filters.length > 0 && context.message) {
    const filterResult = workflowTriggerFilterEvaluator.evaluateTriggerFilters(data, context.message);

    if (!filterResult.passes) {
      // Log that trigger was filtered out
      await workflowLogService.logEvent({
        conversationId: context.conversationId,
        testSessionId: context.testSessionId,
        agentId: context.agentId,
        nodeId: node.id,
        nodeType: 'trigger',
        nodeLabel: data.label || data.event,
        eventType: 'trigger_filtered',
        inputData: { message: context.message, filters: data.filters },
        outputData: filterResult,
        decisionReason: filterResult.reason,
        success: false
      });

      console.log(`🚫 [Trigger] Filtered out: ${filterResult.reason}`);

      return {
        success: false,
        filtered: true,
        reason: filterResult.reason,
        filterResults: filterResult.results,
        event: data.event,
        matched: false
      };
    }

    console.log(`✅ [Trigger] Filters passed: ${filterResult.reason}`);
  }

  // Log trigger fired
  await workflowLogService.logTriggerFired({
    conversationId: context.conversationId,
    testSessionId: context.testSessionId,
    agentId: context.agentId,
    nodeId: node.id,
    nodeType: 'trigger',
    nodeLabel: data.label || data.event,
    inputData: { event: context.event },
    outputData: { matched: true }
  });

  return {
    success: true,
    event: data.event,
    matched: true
  };
}

/**
 * Execute conversation step node
 */
async function executeConversationNode(node, context) {
  const { data } = node;
  const startTime = Date.now();

  // DEBUG: Log node data to understand what fields are available
  console.log('📋 ConversationStep node data:', JSON.stringify(data, null, 2));

  // Log that we're generating a message
  await workflowLogService.logEvent({
    conversationId: context.conversationId,
    testSessionId: context.testSessionId,
    agentId: context.agentId,
    nodeId: node.id,
    nodeType: 'conversationStep',
    nodeLabel: data.name || data.label,
    eventType: 'message_generating',
    inputData: { step: data }
  });

  // Build AI context for this step
  const stepInstructions = data.instructions || '';
  const stepObjective = data.objective || '';

  // DEBUG: Log extracted values
  console.log('📝 Step Instructions:', stepInstructions || '(empty)');
  console.log('🎯 Step Objective:', stepObjective || '(empty)');

  // Search RAG if available
  let knowledgeContext = '';
  if (context.message && context.agentId) {
    try {
      const knowledge = await ragService.searchRelevantKnowledge(
        context.agentId,
        context.message,
        { limit: 5, minSimilarity: 0.7 }
      );

      if (knowledge && knowledge.length > 0) {
        knowledgeContext = ragService.formatKnowledgeForPrompt(knowledge);

        await workflowLogService.logRagSearch({
          conversationId: context.conversationId,
          testSessionId: context.testSessionId,
          agentId: context.agentId,
          nodeId: node.id,
          outputData: { foundItems: knowledge.length }
        });
      }
    } catch (error) {
      console.error('⚠️ RAG search failed:', error.message);
    }
  }

  // Build merged instructions
  const mergedInstructions = `${stepInstructions}\n\nObjetivo desta etapa: ${stepObjective}`;
  console.log('🤖 Merged instructions for AI:', mergedInstructions);

  // Generate response using AI
  const aiResult = await aiResponseService.generateResponse({
    conversation_id: context.conversationId,
    lead_message: context.message || '',
    conversation_context: context.conversationContext,
    ai_agent: {
      ...context.agent,
      // Inject step-specific instructions
      objective_instructions: mergedInstructions
    },
    lead_data: context.lead,
    current_step: data.stepNumber || 0
  });

  const durationMs = Date.now() - startTime;

  // Log message generated
  await workflowLogService.logMessageGenerated({
    conversationId: context.conversationId,
    testSessionId: context.testSessionId,
    agentId: context.agentId,
    nodeId: node.id,
    nodeType: 'conversationStep',
    nodeLabel: data.name || data.label,
    inputData: { message: context.message },
    outputData: {
      response: aiResult.response,
      intent: aiResult.intent,
      tokensUsed: aiResult.tokens_used
    },
    durationMs
  });

  // Log intent if detected
  if (aiResult.intent) {
    await workflowLogService.logIntentDetected({
      conversationId: context.conversationId,
      testSessionId: context.testSessionId,
      agentId: context.agentId,
      nodeId: node.id,
      outputData: { intent: aiResult.intent }
    });
  }

  // Log extracted data if any
  if (aiResult.extractedData) {
    console.log(`📋 [ConversationStep] Dados extraídos do lead:`, JSON.stringify(aiResult.extractedData));
  }

  // Log qualification if present
  if (aiResult.qualification) {
    console.log(`⭐ [ConversationStep] Qualificação: ${aiResult.qualification.score} (${aiResult.qualification.stage})`);
  }

  // Log objection if detected
  if (aiResult.objection?.detected) {
    console.log(`⚠️ [ConversationStep] Objeção detectada: ${aiResult.objection.type} (${aiResult.objection.severity})`);
  }

  // DEBUG: Log step_advanced value received from AI
  console.log(`🎯 [ConversationStep] aiResult.step_advanced = ${aiResult.step_advanced}`);

  return {
    success: true,
    response: aiResult.response,
    intent: aiResult.intent,
    sentiment: aiResult.sentiment,
    shouldAdvance: aiResult.step_advanced,
    tokensUsed: aiResult.tokens_used,
    durationMs,
    // Novos campos enriquecidos
    extractedData: aiResult.extractedData,
    qualification: aiResult.qualification,
    objection: aiResult.objection
  };
}

/**
 * Execute condition node
 */
async function executeConditionNode(node, context) {
  const result = await workflowConditionEvaluator.evaluateCondition(node, context);

  // Log condition evaluation
  await workflowLogService.logConditionEvaluated({
    conversationId: context.conversationId,
    testSessionId: context.testSessionId,
    agentId: context.agentId,
    nodeId: node.id,
    nodeType: 'condition',
    nodeLabel: node.data?.label || node.data?.conditionType,
    inputData: {
      conditionType: result.conditionType,
      operator: result.operator,
      value: result.value
    },
    outputData: {
      path: result.path,
      result: result.result
    },
    decisionReason: result.reason,
    durationMs: result.durationMs
  });

  return result;
}

/**
 * Execute action node
 */
async function executeActionNode(node, context) {
  // Log action start
  await workflowLogService.logActionStarted({
    conversationId: context.conversationId,
    testSessionId: context.testSessionId,
    agentId: context.agentId,
    nodeId: node.id,
    nodeType: 'action',
    nodeLabel: node.data?.label || node.data?.actionType,
    inputData: node.data
  });

  const result = await workflowActionExecutors.executeAction(node, context);

  // Generate human-readable description of action result
  const actionDescription = getActionDescription(node.data?.actionType, result, context.isTestMode);

  if (result.success) {
    await workflowLogService.logActionCompleted({
      conversationId: context.conversationId,
      testSessionId: context.testSessionId,
      agentId: context.agentId,
      nodeId: node.id,
      nodeType: 'action',
      nodeLabel: node.data?.label || node.data?.actionType,
      outputData: result,
      decisionReason: actionDescription,
      durationMs: result.durationMs
    });
  } else {
    await workflowLogService.logActionFailed({
      conversationId: context.conversationId,
      testSessionId: context.testSessionId,
      agentId: context.agentId,
      nodeId: node.id,
      nodeType: 'action',
      nodeLabel: node.data?.label || node.data?.actionType,
      errorMessage: result.error,
      durationMs: result.durationMs
    });
  }

  return result;
}

/**
 * Execute HTTP Request node
 */
async function executeHTTPRequestNode(node, context) {
  // Log action start
  await workflowLogService.logActionStarted({
    conversationId: context.conversationId,
    testSessionId: context.testSessionId,
    agentId: context.agentId,
    nodeId: node.id,
    nodeType: 'httpRequest',
    nodeLabel: node.data?.label || 'HTTP Request',
    inputData: node.data
  });

  // Create a node object that looks like an action node for the executor
  const actionNode = {
    ...node,
    data: {
      ...node.data,
      actionType: 'http_request'
    }
  };

  const result = await workflowActionExecutors.executeAction(actionNode, context);

  // Generate description
  const method = node.data?.method || 'GET';
  const url = node.data?.url || 'URL nao configurada';
  const statusText = result.success ? `Status ${result.result?.status || 200}` : 'Falha';
  const actionDescription = `${method} ${url.substring(0, 50)}${url.length > 50 ? '...' : ''} → ${statusText}`;

  if (result.success) {
    await workflowLogService.logActionCompleted({
      conversationId: context.conversationId,
      testSessionId: context.testSessionId,
      agentId: context.agentId,
      nodeId: node.id,
      nodeType: 'httpRequest',
      nodeLabel: node.data?.label || 'HTTP Request',
      outputData: result,
      decisionReason: actionDescription,
      durationMs: result.durationMs
    });
  } else {
    await workflowLogService.logActionFailed({
      conversationId: context.conversationId,
      testSessionId: context.testSessionId,
      agentId: context.agentId,
      nodeId: node.id,
      nodeType: 'httpRequest',
      nodeLabel: node.data?.label || 'HTTP Request',
      errorMessage: result.error || 'HTTP request failed',
      durationMs: result.durationMs
    });
  }

  return result;
}

/**
 * Generate human-readable description of action result
 */
function getActionDescription(actionType, result, isTestMode) {
  // The actual result from action executors is in result.result
  const data = result.result || result.data || result;
  const prefix = isTestMode && data?.simulated ? '[SIMULADO] ' : '';

  switch (actionType) {
    case 'create_opportunity':
      if (data.simulated) {
        return `${prefix}Criaria oportunidade em "${data.pipelineName || 'pipeline'}" → "${data.stageName || 'etapa'}"`;
      }
      if (data.existed) {
        return `Oportunidade já existia (${data.opportunityId?.slice(0, 8)}...)`;
      }
      if (data.created) {
        return `Oportunidade criada em "${data.pipelineName}" → "${data.stageName}"`;
      }
      return 'Criar oportunidade';

    case 'move_stage':
      if (data.simulated) {
        return `${prefix}Moveria para etapa "${data.stageName || data.stageId}"`;
      }
      if (data.moved === false) {
        if (data.reason === 'no_opportunity_found') {
          return 'Nenhuma oportunidade encontrada para mover';
        }
        if (data.reason === 'already_in_stage') {
          return `Já está na etapa "${data.stageName}"`;
        }
        return 'Não moveu';
      }
      if (data.moved) {
        return `Movido para "${data.stageName}"${data.isWinStage ? ' (GANHO)' : ''}${data.isLossStage ? ' (PERDIDO)' : ''}`;
      }
      return 'Mover etapa';

    case 'transfer':
      if (data.simulated) {
        return `${prefix}Transferiria conversa`;
      }
      return 'Conversa transferida';

    case 'add_tag':
      if (data.simulated) {
        return `${prefix}Adicionaria tags`;
      }
      return `Tags adicionadas: ${data.tagsAdded || 0}`;

    case 'remove_tag':
      if (data.simulated) {
        return `${prefix}Removeria tags`;
      }
      return `Tags removidas: ${data.tagsRemoved || 0}`;

    case 'send_message':
      if (data.simulated) {
        return `${prefix}Enviaria mensagem`;
      }
      return 'Mensagem enviada';

    case 'schedule':
      if (data.simulated) {
        return `${prefix}Agendaria reunião`;
      }
      return 'Link de agendamento enviado';

    case 'wait':
      return `Aguardando ${data.waitTime || ''} ${data.waitUnit || 'horas'}`;

    case 'close_positive':
      return 'Conversa encerrada (positivo)';

    case 'close_negative':
      return 'Conversa encerrada (negativo)';

    case 'webhook':
      if (data.simulated) {
        return `${prefix}Chamaria webhook`;
      }
      return `Webhook executado (${data.statusCode || 'OK'})`;

    default:
      return data.simulated ? `${prefix}Ação simulada` : 'Ação executada';
  }
}

/**
 * Find node by ID in workflow definition
 */
function findNodeById(workflowDef, nodeId) {
  if (!workflowDef?.nodes || !nodeId) return null;
  return workflowDef.nodes.find(n => n.id === nodeId);
}

/**
 * Find trigger node for a specific event
 */
function findTriggerForEvent(workflowDef, event) {
  if (!workflowDef?.nodes) return null;

  // First, try to find exact match
  let trigger = workflowDef.nodes.find(n =>
    n.type === 'trigger' && n.data?.event === event
  );

  // If not found, look for generic trigger
  if (!trigger) {
    trigger = workflowDef.nodes.find(n =>
      n.type === 'trigger' && n.data?.event === 'message_received'
    );
  }

  // Fallback to any trigger
  if (!trigger) {
    trigger = workflowDef.nodes.find(n => n.type === 'trigger');
  }

  return trigger;
}

/**
 * Find next node to execute based on edges
 */
function findNextNode(workflowDef, currentNode, nodeResult) {
  if (!workflowDef?.edges) return null;

  // For condition nodes, follow the appropriate handle (yes/no)
  if (currentNode.type === 'condition' && nodeResult?.path) {
    console.log(`🔍 [findNextNode] Condition path: ${nodeResult.path}, looking for edge from ${currentNode.id}`);

    // Debug: log all edges from this node
    const nodeEdges = workflowDef.edges.filter(e => e.source === currentNode.id);
    console.log(`🔍 [findNextNode] Available edges:`, nodeEdges.map(e => ({
      sourceHandle: e.sourceHandle,
      target: e.target
    })));

    const edge = workflowDef.edges.find(e =>
      e.source === currentNode.id &&
      (e.sourceHandle === nodeResult.path || e.sourceHandle === `${nodeResult.path}-handle`)
    );

    if (edge) {
      console.log(`✅ [findNextNode] Found edge to: ${edge.target}`);
      return findNodeById(workflowDef, edge.target);
    }

    // IMPORTANT: For condition nodes, if the specific path edge is not found,
    // do NOT fall through to any edge - return null to stop this branch
    console.log(`⚠️ [findNextNode] No edge found for path '${nodeResult.path}'`);
    return null;
  }

  // For conversationStep nodes with path (achieved/not_achieved), follow the appropriate handle
  if (currentNode.type === 'conversationStep' && nodeResult?.path) {
    console.log(`🔍 [findNextNode] ConversationStep path: ${nodeResult.path}, looking for edge from ${currentNode.id}`);

    const nodeEdges = workflowDef.edges.filter(e => e.source === currentNode.id);
    console.log(`🔍 [findNextNode] Available edges:`, nodeEdges.map(e => ({
      sourceHandle: e.sourceHandle,
      target: e.target
    })));

    // Try to find edge matching the path
    const edge = workflowDef.edges.find(e =>
      e.source === currentNode.id &&
      (e.sourceHandle === nodeResult.path || e.sourceHandle === `${nodeResult.path}-handle`)
    );

    if (edge) {
      console.log(`✅ [findNextNode] Found edge to: ${edge.target}`);
      return findNodeById(workflowDef, edge.target);
    }

    // If no specific path edge found, check if there's only one output edge (fallback)
    if (nodeEdges.length === 1) {
      console.log(`⚠️ [findNextNode] No path edge found, using single output edge to: ${nodeEdges[0].target}`);
      return findNodeById(workflowDef, nodeEdges[0].target);
    }

    console.log(`⚠️ [findNextNode] No edge found for conversationStep path '${nodeResult.path}'`);
    return null;
  }

  // For httpRequest nodes with path (success/error), follow the appropriate handle
  if (currentNode.type === 'httpRequest' && nodeResult?.path) {
    console.log(`🔍 [findNextNode] HTTPRequest path: ${nodeResult.path}, looking for edge from ${currentNode.id}`);

    const nodeEdges = workflowDef.edges.filter(e => e.source === currentNode.id);
    console.log(`🔍 [findNextNode] Available edges:`, nodeEdges.map(e => ({
      sourceHandle: e.sourceHandle,
      target: e.target
    })));

    // Try to find edge matching the path (success or error)
    const edge = workflowDef.edges.find(e =>
      e.source === currentNode.id &&
      e.sourceHandle === nodeResult.path
    );

    if (edge) {
      console.log(`✅ [findNextNode] Found edge to: ${edge.target}`);
      return findNodeById(workflowDef, edge.target);
    }

    // IMPORTANT: For httpRequest nodes, if the specific path edge is not found,
    // do NOT fall through - return null to stop this branch
    console.log(`⚠️ [findNextNode] No edge found for httpRequest path '${nodeResult.path}'`);
    return null;
  }

  // For other nodes, find any outgoing edge
  const edge = workflowDef.edges.find(e => e.source === currentNode.id);

  if (edge) {
    return findNodeById(workflowDef, edge.target);
  }

  return null;
}

/**
 * Build execution context for workflow processing
 */
async function buildExecutionContext(conversationId, state, event, payload, options) {
  // Fetch conversation details (using opportunities + contacts instead of leads)
  const convResult = await db.query(
    `SELECT
      c.*,
      o.id as opportunity_id,
      o.title as opportunity_title,
      o.value as opportunity_value,
      o.currency as opportunity_currency,
      o.probability as opportunity_probability,
      o.score as opportunity_score,
      o.company_size as opportunity_company_size,
      o.budget as opportunity_budget,
      o.timeline as opportunity_timeline,
      o.expected_close_date as opportunity_expected_close_date,
      o.source as opportunity_source,
      o.notes as opportunity_notes,
      ps.name as opportunity_stage_name,
      pp.name as opportunity_pipeline_name,
      ct.id as contact_id,
      ct.name as contact_name,
      ct.first_name as contact_first_name,
      ct.last_name as contact_last_name,
      ct.email as contact_email,
      ct.phone as contact_phone,
      ct.company as contact_company,
      ct.title as contact_title,
      ct.location as contact_location,
      ct.headline as contact_headline,
      ct.industry as contact_industry,
      ct.about as contact_about,
      ct.connections_count as contact_connections_count,
      ct.profile_url as contact_profile_url,
      ct.is_premium as contact_is_premium,
      ct.custom_fields as contact_custom_fields,
      ct.linkedin_profile_id as contact_unipile_id,
      la.unipile_account_id,
      camp.id as campaign_id,
      camp.name as campaign_name,
      aa.*
     FROM conversations c
     LEFT JOIN opportunities o ON c.opportunity_id = o.id
     LEFT JOIN pipeline_stages ps ON o.stage_id = ps.id
     LEFT JOIN pipelines pp ON o.pipeline_id = pp.id
     LEFT JOIN contacts ct ON o.contact_id = ct.id
     LEFT JOIN campaigns camp ON c.campaign_id = camp.id
     LEFT JOIN linkedin_accounts la ON c.linkedin_account_id = la.id
     LEFT JOIN ai_agents aa ON c.ai_agent_id = aa.id
     WHERE c.id = $1`,
    [conversationId]
  );

  const conv = convResult.rows[0] || {};

  // Get conversation stats
  const statsResult = await db.query(
    `SELECT
      COUNT(*) FILTER (WHERE sender_type = 'lead') as lead_messages,
      COUNT(*) FILTER (WHERE sender_type = 'ai') as ai_messages,
      COUNT(*) as total_messages,
      MAX(sent_at) as last_message_at
     FROM messages
     WHERE conversation_id = $1`,
    [conversationId]
  );

  const stats = statsResult.rows[0] || {};

  return {
    // IDs
    conversationId,
    agentId: state.agentId,
    opportunityId: conv.opportunity_id,
    contactId: conv.contact_id,
    campaignId: conv.campaign_id,
    accountId: conv.account_id,
    userId: conv.user_id,
    testSessionId: options.testSessionId || null,

    // Event info
    event,
    message: payload.message || payload.content,
    hasResponse: !!payload.message,

    // Contact/Lead data (kept as 'lead' for workflow compatibility)
    lead: {
      id: conv.contact_id,
      name: conv.contact_name,
      email: conv.contact_email,
      phone: conv.contact_phone,
      company: conv.contact_company,
      title: conv.contact_title,
      status: conv.status
    },

    // Full contact data for variable processing
    contact: {
      id: conv.contact_id,
      name: conv.contact_name,
      first_name: conv.contact_first_name,
      last_name: conv.contact_last_name,
      email: conv.contact_email,
      phone: conv.contact_phone,
      company: conv.contact_company,
      title: conv.contact_title,
      location: conv.contact_location,
      headline: conv.contact_headline,
      industry: conv.contact_industry,
      about: conv.contact_about,
      connections_count: conv.contact_connections_count,
      profile_url: conv.contact_profile_url,
      is_premium: conv.contact_is_premium,
      custom_fields: conv.contact_custom_fields
    },

    // Opportunity data for variable processing
    opportunity: conv.opportunity_id ? {
      id: conv.opportunity_id,
      title: conv.opportunity_title,
      value: conv.opportunity_value,
      currency: conv.opportunity_currency,
      probability: conv.opportunity_probability,
      score: conv.opportunity_score,
      company_size: conv.opportunity_company_size,
      budget: conv.opportunity_budget,
      timeline: conv.opportunity_timeline,
      expected_close_date: conv.opportunity_expected_close_date,
      source: conv.opportunity_source,
      notes: conv.opportunity_notes,
      stage_name: conv.opportunity_stage_name,
      stage: conv.opportunity_stage_name,
      pipeline_name: conv.opportunity_pipeline_name,
      pipeline: conv.opportunity_pipeline_name
    } : null,

    // Campaign data
    campaign: conv.campaign_id ? {
      id: conv.campaign_id,
      name: conv.campaign_name
    } : null,

    // Agent data
    agent: {
      id: state.agentId,
      name: state.agentName,
      productsServices: conv.products_services,
      behavioralProfile: conv.behavioral_profile,
      language: conv.language,
      tone: conv.tone,
      autoSchedule: conv.auto_schedule,
      schedulingLink: conv.scheduling_link
    },

    // Channel data for variable processing
    channel: {
      type: conv.channel || conv.provider_type || 'linkedin',
      name: conv.channel_name || '',
      isGroup: conv.is_group || false,
      groupName: conv.group_name || '',
      attendeeCount: conv.attendee_count || 0
    },

    // Unipile config (legacy compatibility)
    unipileAccountId: conv.unipile_account_id,
    leadUnipileId: conv.lead_unipile_id,

    // Workflow variables (includes HTTP extracted variables)
    variables: state.variables || {},
    workflowVariables: state.variables || {},

    // Custom variables defined in workflow
    customVariables: state.customVariables || [],

    // Step history for tracking attempts per node
    stepHistory: state.stepHistory || [],

    // Conversation context
    conversationContext: payload.conversationContext || null,
    conversationStats: {
      leadMessages: parseInt(stats.lead_messages) || 0,
      aiMessages: parseInt(stats.ai_messages) || 0,
      totalMessages: parseInt(stats.total_messages) || 0,
      lastMessageAt: stats.last_message_at,
      exchangeCount: Math.min(parseInt(stats.lead_messages) || 0, parseInt(stats.ai_messages) || 0)
    },

    // Workflow step tracking
    currentStep: state.currentStep || null,
    stepNumber: state.stepNumber || 0,
    attempts: state.attempts || 0,
    workflowStartedAt: state.startedAt || null,
    conversationStartedAt: conv.created_at,

    // Intent/sentiment from payload
    lastIntent: payload.intent,
    lastSentiment: payload.sentiment,
    lastMessage: payload.message,
    lastMessageAt: stats.last_message_at,

    // Test mode
    isTestMode: options.isTestMode || false
  };
}

/**
 * Process test message or event (for agent testing UI)
 * @param {string} testSessionId - Test session UUID
 * @param {number} agentId - Agent ID
 * @param {string} message - Message content (null for non-message events)
 * @param {object} options - Additional options (lead, agent, workflowState, conversationContext, eventType)
 * @returns {Promise<object>} Response and execution info
 */
async function processTestMessage(testSessionId, agentId, message, options = {}) {
  try {
    const { lead, agent, workflowState, conversationContext, eventType = 'message_received' } = options;

    console.log(`🧪 Processing test event "${eventType}" for session ${testSessionId}`);

    if (!agent || !agent.workflow_definition) {
      throw new Error('Agent workflow definition is required');
    }

    const workflowDef = agent.workflow_definition;

    // DEBUG: Log all edges from conversationStep nodes
    const conversationStepNodes = workflowDef.nodes?.filter(n => n.type === 'conversationStep') || [];
    for (const csNode of conversationStepNodes) {
      const csEdges = workflowDef.edges?.filter(e => e.source === csNode.id) || [];
      console.log(`📊 [DEBUG] ConversationStep "${csNode.data?.label || csNode.id}" edges:`, csEdges.map(e => ({
        sourceHandle: e.sourceHandle,
        targetNode: workflowDef.nodes?.find(n => n.id === e.target)?.data?.label || e.target
      })));
    }

    // Build test context with the correct event type
    const context = {
      conversationId: null,
      testSessionId,
      agentId,
      event: eventType, // Use the actual event type
      message,
      isTestMode: true,
      lead: lead || {},
      agent,
      variables: workflowState?.variables || {},
      // Step history for tracking attempts per node
      stepHistory: workflowState?.step_history || workflowState?.stepHistory || [],
      conversationContext,
      conversationStats: {
        leadMessages: (conversationContext?.stats?.totalMessages || 0) / 2,
        aiMessages: (conversationContext?.stats?.totalMessages || 0) / 2,
        totalMessages: conversationContext?.stats?.totalMessages || 0,
        lastMessageAt: new Date()
      },
      lastMessage: message,
      // Additional flags for condition evaluation
      inviteAccepted: eventType === 'invite_accepted',
      inviteIgnored: eventType === 'invite_ignored',
      hasResponse: eventType === 'message_received' && !!message
    };

    // Find current node or trigger based on event type
    let currentNode = null;

    // Check if this is a wait_skipped event - continue from resume node
    if (eventType === 'wait_skipped' && workflowState?.resumeNodeId) {
      const resumeNodeId = workflowState.resumeNodeId;
      currentNode = findNodeById(workflowDef, resumeNodeId);
      console.log(`⏭️ Wait skipped - continuing from node: ${resumeNodeId}`);

      // Log skip event
      await workflowLogService.logWorkflowResumed({
        conversationId: context.conversationId,
        testSessionId: context.testSessionId,
        agentId: context.agentId,
        nodeId: resumeNodeId,
        nodeLabel: currentNode?.data?.label || 'Nó',
        outputData: { reason: 'Espera pulada (modo teste)' }
      });
    }
    // Check if workflow is paused waiting for response
    else if (workflowState?.status === 'paused' && workflowState?.pausedReason === 'waiting_for_response') {
      // Resume from the saved resume node
      const resumeNodeId = workflowState.resumeNodeId || workflowState.resume_node_id;
      if (resumeNodeId) {
        currentNode = findNodeById(workflowDef, resumeNodeId);
        console.log(`▶️ Resuming workflow from node: ${resumeNodeId} (was waiting for response)`);

        // Log resume event
        await workflowLogService.logWorkflowResumed({
          conversationId: context.conversationId,
          testSessionId: context.testSessionId,
          agentId: context.agentId,
          nodeId: resumeNodeId,
          nodeLabel: currentNode?.data?.label || 'Nó',
          outputData: { reason: 'Resposta recebida' }
        });
      }
    }

    // If not resuming, try current_node_id
    if (!currentNode && workflowState?.current_node_id) {
      currentNode = findNodeById(workflowDef, workflowState.current_node_id);
    }

    // If still no node, find trigger for the event type
    if (!currentNode) {
      currentNode = findTriggerForEvent(workflowDef, eventType);
    }

    if (!currentNode) {
      // Fallback: try message_received trigger
      currentNode = findTriggerForEvent(workflowDef, 'message_received');
    }

    if (!currentNode) {
      // Last resort: find first conversationStep
      currentNode = workflowDef.nodes?.find(n => n.type === 'conversationStep');
    }

    if (!currentNode) {
      throw new Error(`No valid starting node found for event "${eventType}"`);
    }

    console.log(`➡️ Starting test execution from node: ${currentNode.id} (${currentNode.type})`);

    // Execute from current node
    const result = await executeFromNode(currentNode, workflowDef, context);

    // Build new state
    const newState = {
      current_node_id: result.finalNodeId,
      variables: context.variables,
      step_history: [...(workflowState?.step_history || []), ...result.executedNodes.map(n => ({
        nodeId: n.nodeId,
        nodeType: n.nodeType,
        timestamp: new Date().toISOString(),
        result: n.result // Include result with hadMessage flag for attempt counting
      }))],
      status: result.completed ? 'completed' : (result.paused ? 'paused' : 'active'),
      // Pause-related state
      pausedReason: result.paused ? result.pauseReason : null,
      resumeNodeId: result.paused ? result.resumeNodeId : null
    };

    console.log(`✅ Test message processed, response generated`);

    return {
      response: result.response,
      allResponses: result.allResponses, // ✅ Array com TODAS as respostas
      executedNodes: result.executedNodes,
      newState,
      paused: result.paused,
      completed: result.completed,
      waitInfo: result.waitInfo,
      enrichedData: result.enrichedData  // Dados enriquecidos (extractedData, qualification, objection)
    };
  } catch (error) {
    console.error('❌ Error processing test message:', error);
    throw error;
  }
}

/**
 * Check if agent has workflow enabled
 */
async function hasWorkflowEnabled(agentId) {
  try {
    const result = await db.query(
      `SELECT workflow_enabled, workflow_definition IS NOT NULL as has_definition
       FROM ai_agents WHERE id = $1`,
      [agentId]
    );

    if (!result.rows || result.rows.length === 0) {
      return false;
    }

    return result.rows[0].workflow_enabled && result.rows[0].has_definition;
  } catch (error) {
    console.error('❌ Error checking workflow enabled:', error);
    return false;
  }
}

module.exports = {
  initializeWorkflow,
  processEvent,
  executeFromNode,
  processTestMessage,
  hasWorkflowEnabled,
  findNodeById,
  findTriggerForEvent,
  findNextNode,
  buildExecutionContext
};
