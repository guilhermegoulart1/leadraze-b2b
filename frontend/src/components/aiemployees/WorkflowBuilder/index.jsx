// frontend/src/components/aiemployees/WorkflowBuilder/index.jsx
// Visual workflow builder using React Flow

import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import ReactFlow, {
  Controls,
  Background,
  MiniMap,
  addEdge,
  useNodesState,
  useEdgesState,
  useReactFlow,
  ReactFlowProvider,
  MarkerType,
  Panel
} from 'reactflow';
import 'reactflow/dist/style.css';

import TriggerNode from './nodes/TriggerNode';
import ConversationStepNode from './nodes/ConversationStepNode';
import ConditionNode from './nodes/ConditionNode';
import ActionNode from './nodes/ActionNode';
import DeletableEdge from './edges/DeletableEdge';
import Sidebar from './Sidebar';
import PropertiesPanel from './PropertiesPanel';

import { Play, Save, Eye, Trash2, Check, Loader2, AlertCircle } from 'lucide-react';

// Define custom node types
const nodeTypes = {
  trigger: TriggerNode,
  conversationStep: ConversationStepNode,
  condition: ConditionNode,
  action: ActionNode
};

// Define custom edge types
const edgeTypes = {
  deletable: DeletableEdge
};

// Default edge options - horizontal flow with deletable type
const defaultEdgeOptions = {
  animated: true,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 15,
    height: 15
  },
  style: {
    strokeWidth: 2,
    stroke: '#8b5cf6'
  },
  type: 'deletable'
};

// Generate workflow from interview answers
const generateWorkflowFromAnswers = (agentType, interviewAnswers) => {
  const nodes = [];
  const edges = [];
  let xPos = 40;
  const yPos = 80;
  const xGap = 380;

  // 1. Trigger node
  const triggerId = 'trigger-1';
  nodes.push({
    id: triggerId,
    type: 'trigger',
    position: { x: xPos, y: yPos },
    data: {
      label: 'Inicio',
      event: agentType === 'prospeccao' ? 'invite_accepted' : 'message_received',
      description: agentType === 'prospeccao'
        ? 'Quando convite for aceito'
        : 'Quando mensagem for recebida'
    }
  });
  xPos += xGap;

  // 2. Rapport step (always first)
  const rapportId = 'step-rapport';
  nodes.push({
    id: rapportId,
    type: 'conversationStep',
    position: { x: xPos, y: yPos },
    data: {
      label: 'Rapport',
      stepNumber: 1,
      instructions: interviewAnswers.company_name
        ? `Inicie a conversa de forma amigavel, mencionando a ${interviewAnswers.company_name}. Seja natural e nao pareca um robo.`
        : 'Quebre o gelo de forma natural e amigavel. Seja genuino.',
      objective: 'Lead demonstrar abertura para conversa',
      maxMessages: 2,
      examples: []
    }
  });
  edges.push({ id: `e-${triggerId}-${rapportId}`, source: triggerId, target: rapportId, sourceHandle: 'right', targetHandle: 'left' });
  xPos += xGap;

  // 3. Qualification step (if we have product info)
  if (interviewAnswers.product_service || interviewAnswers.services) {
    const qualId = 'step-qualification';
    nodes.push({
      id: qualId,
      type: 'conversationStep',
      position: { x: xPos, y: yPos },
      data: {
        label: 'Qualificacao',
        stepNumber: 2,
        instructions: agentType === 'prospeccao'
          ? `Entenda as necessidades do lead relacionadas a: ${interviewAnswers.product_service || 'seu produto'}. Faca perguntas abertas.`
          : `Identifique qual servico o cliente precisa: ${interviewAnswers.services || 'servicos oferecidos'}.`,
        objective: 'Entender necessidade do lead',
        maxMessages: 3,
        examples: []
      }
    });
    edges.push({ id: `e-${rapportId}-${qualId}`, source: rapportId, target: qualId, sourceHandle: 'right', targetHandle: 'left' });
    xPos += xGap;

    // 4. Presentation/Solution step
    const presentId = 'step-presentation';
    nodes.push({
      id: presentId,
      type: 'conversationStep',
      position: { x: xPos, y: yPos },
      data: {
        label: agentType === 'prospeccao' ? 'Apresentacao' : 'Solucao',
        stepNumber: 3,
        instructions: agentType === 'prospeccao'
          ? `Apresente como ${interviewAnswers.company_name || 'nossa solucao'} pode ajudar. ${interviewAnswers.differentials ? 'Destaque: ' + interviewAnswers.differentials : ''}`
          : `Explique como podemos ajudar com base na necessidade identificada. ${interviewAnswers.operating_hours ? 'Horario: ' + interviewAnswers.operating_hours : ''}`,
        objective: 'Lead entender o valor',
        maxMessages: 3,
        examples: []
      }
    });
    edges.push({ id: `e-${qualId}-${presentId}`, source: qualId, target: presentId, sourceHandle: 'right', targetHandle: 'left' });
    xPos += xGap;

    // 5. CTA/Conversion step
    const ctaId = 'step-cta';
    const conversionGoal = interviewAnswers.conversion_goal || (agentType === 'prospeccao' ? 'Agendar reuniao' : 'Resolver problema');
    nodes.push({
      id: ctaId,
      type: 'conversationStep',
      position: { x: xPos, y: yPos },
      data: {
        label: 'Conversao',
        stepNumber: 4,
        instructions: `Objetivo: ${conversionGoal}. Seja direto mas nao agressivo. Se o lead demonstrar resistencia, entenda o motivo.`,
        objective: conversionGoal,
        maxMessages: 3,
        examples: []
      }
    });
    edges.push({ id: `e-${presentId}-${ctaId}`, source: presentId, target: ctaId, sourceHandle: 'right', targetHandle: 'left' });
    xPos += xGap;

    // 6. Final action
    const actionId = 'action-end';
    nodes.push({
      id: actionId,
      type: 'action',
      position: { x: xPos, y: yPos },
      data: {
        label: 'Transferir',
        actionType: 'transfer',
        message: 'Perfeito! Vou transferir voce para um de nossos especialistas continuar o atendimento.',
        params: {}
      }
    });
    edges.push({ id: `e-${ctaId}-${actionId}`, source: ctaId, target: actionId, sourceHandle: 'right', targetHandle: 'left' });
  }

  return { nodes, edges };
};

// Empty initial workflow (just trigger)
const getEmptyWorkflow = (agentType, channel) => ({
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 40, y: 80 },
      data: {
        label: 'Inicio',
        event: channel === 'linkedin' ? 'invite_sent' :
               channel === 'email' ? 'email_sent' :
               agentType === 'prospeccao' ? 'first_contact' : 'message_received',
        description: channel === 'linkedin' ? 'Enviar convite de conexao' :
                     channel === 'email' ? 'Enviar primeiro email' :
                     'Quando mensagem for recebida',
        withNote: channel === 'linkedin' ? true : undefined,
        inviteNote: channel === 'linkedin' ? 'Ola {{first_name}}, vi que voce trabalha na {{company}}. Adoraria conectar para trocar ideias sobre {{title}}.' : undefined
      }
    }
  ],
  edges: []
});

// LinkedIn SDR complete workflow template
const getLinkedInSDRWorkflow = () => ({
  nodes: [
    // Trigger: Send Invite
    {
      id: 'trigger-invite',
      type: 'trigger',
      position: { x: 40, y: 120 },
      data: {
        label: 'Enviar Convite',
        event: 'invite_sent',
        description: 'Envia convite de conexao',
        withNote: true,
        inviteNote: 'Ola {{first_name}}, vi que voce trabalha na {{company}}. Adoraria conectar para trocar ideias sobre a area.'
      }
    },
    // Condition: Invite Accepted?
    {
      id: 'condition-accepted',
      type: 'condition',
      position: { x: 420, y: 100 },
      data: {
        label: 'Convite Aceito?',
        conditionType: 'invite_accepted',
        waitTime: 7,
        waitUnit: 'days'
      }
    },
    // Step 1: Rapport
    {
      id: 'step-rapport',
      type: 'conversationStep',
      position: { x: 800, y: 40 },
      data: {
        label: 'Rapport',
        stepNumber: 1,
        instructions: 'Quebre o gelo de forma natural. Agradeca pela conexao e mencione algo em comum ou do perfil da pessoa. Seja genuino e nao pareca um robo.',
        objective: 'Lead demonstrar abertura para conversa',
        maxMessages: 2,
        examples: ['Obrigado por aceitar! Vi que voce trabalha com X, area muito interessante.']
      }
    },
    // Step 2: Discovery
    {
      id: 'step-discovery',
      type: 'conversationStep',
      position: { x: 1180, y: 40 },
      data: {
        label: 'Descoberta',
        stepNumber: 2,
        instructions: 'Faca perguntas abertas para entender o contexto atual do lead. Qual o maior desafio? Como funciona o processo atual? Escute mais do que fale.',
        objective: 'Identificar necessidades e dores do lead',
        maxMessages: 3,
        examples: ['Como funciona o processo de X na empresa de voces hoje?']
      }
    },
    // Condition: Interested?
    {
      id: 'condition-interest',
      type: 'condition',
      position: { x: 1560, y: 40 },
      data: {
        label: 'Demonstra Interesse?',
        conditionType: 'sentiment',
        operator: 'equals',
        value: 'positive'
      }
    },
    // Step 3: Value Presentation
    {
      id: 'step-value',
      type: 'conversationStep',
      position: { x: 1940, y: -40 },
      data: {
        label: 'Apresentar Valor',
        stepNumber: 3,
        instructions: 'Conecte sua solucao com as dores identificadas. Mostre como pode ajudar sem ser agressivo. Use casos de sucesso se houver.',
        objective: 'Lead entender o valor da solucao',
        maxMessages: 2,
        examples: ['Entendo. Temos ajudado empresas como a sua a resolver exatamente isso...']
      }
    },
    // Step 4: CTA
    {
      id: 'step-cta',
      type: 'conversationStep',
      position: { x: 2320, y: -40 },
      data: {
        label: 'Conversao',
        stepNumber: 4,
        instructions: 'Proponha proximo passo: reuniao, demo ou conversa. Seja direto mas respeitoso. Se houver resistencia, entenda o motivo.',
        objective: 'Agendar reuniao ou proximo passo',
        maxMessages: 3,
        examples: ['Que tal uma conversa rapida de 15min pra mostrar como funciona?']
      }
    },
    // Action: Transfer
    {
      id: 'action-transfer',
      type: 'action',
      position: { x: 2700, y: -40 },
      data: {
        label: 'Transferir',
        actionType: 'transfer',
        message: 'Perfeito! Vou conectar voce com um de nossos especialistas para continuar a conversa.'
      }
    },
    // Action: Close Negative (from condition no interest)
    {
      id: 'action-nurture',
      type: 'action',
      position: { x: 1940, y: 180 },
      data: {
        label: 'Nutrir',
        actionType: 'add_tag',
        message: 'Sem problema! Fico a disposicao se precisar no futuro.',
        params: { tag: 'nurture' }
      }
    },
    // Action: End Campaign (NAO from invite condition)
    {
      id: 'action-end',
      type: 'action',
      position: { x: 420, y: 280 },
      data: {
        label: 'Encerrar',
        actionType: 'close_negative',
        message: ''
      }
    }
  ],
  edges: [
    { id: 'e-invite-condition', source: 'trigger-invite', target: 'condition-accepted', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e-accepted-rapport', source: 'condition-accepted', target: 'step-rapport', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
    { id: 'e-rapport-discovery', source: 'step-rapport', target: 'step-discovery', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e-discovery-interest', source: 'step-discovery', target: 'condition-interest', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e-interest-value', source: 'condition-interest', target: 'step-value', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
    { id: 'e-value-cta', source: 'step-value', target: 'step-cta', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e-cta-transfer', source: 'step-cta', target: 'action-transfer', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e-no-interest-nurture', source: 'condition-interest', target: 'action-nurture', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' },
    { id: 'e-not-accepted-end', source: 'condition-accepted', target: 'action-end', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' }
  ]
});

const WorkflowBuilderInner = ({
  agentType = 'prospeccao',
  channel = 'linkedin',
  template = null,
  interviewAnswers = {},
  onSave,
  onPreview
}) => {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  // Generate initial workflow based on source
  const getInitialWorkflow = () => {
    // Priority: template > interview answers > empty
    if (template?.workflow_definition?.nodes?.length > 0) {
      return template.workflow_definition;
    }

    // If template has useLinkedInFlow flag, use the full LinkedIn SDR template
    if (template?.useLinkedInFlow && channel === 'linkedin') {
      return getLinkedInSDRWorkflow();
    }

    // If we have meaningful interview answers, generate workflow
    const hasAnswers = Object.keys(interviewAnswers).length > 0 &&
      (interviewAnswers.product_service || interviewAnswers.services || interviewAnswers.company_name);

    if (hasAnswers) {
      return generateWorkflowFromAnswers(agentType, interviewAnswers);
    }

    // Otherwise start with channel-aware empty workflow
    return getEmptyWorkflow(agentType, channel);
  };

  const initialWorkflow = getInitialWorkflow();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow.edges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true); // Start collapsed for more canvas space

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState('saved'); // 'saved' | 'saving' | 'unsaved' | 'error'
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);
  const lastSavedRef = useRef({ nodes: initialWorkflow.nodes, edges: initialWorkflow.edges });
  const performSaveRef = useRef(null);

  // Handle edge connections
  const onConnect = useCallback((params) => {
    setEdges((eds) => addEdge({
      ...params,
      ...defaultEdgeOptions
    }, eds));
  }, [setEdges]);

  // Handle node click for properties panel
  const onNodeClick = useCallback((event, node) => {
    setSelectedNode(node);
  }, []);

  // Handle canvas click (deselect)
  const onPaneClick = useCallback(() => {
    setSelectedNode(null);
  }, []);

  // Add new node from sidebar
  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();

    const type = event.dataTransfer.getData('application/reactflow');
    const subtype = event.dataTransfer.getData('node/subtype');
    const triggerEvent = event.dataTransfer.getData('node/event');
    if (!type) return;

    // Use screenToFlowPosition to properly convert screen coords to flow coords
    // This accounts for zoom and pan
    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    const stepCount = nodes.filter(n => n.type === 'conversationStep').length;

    // Event labels for triggers
    const eventLabels = {
      invite_sent: 'Convite Enviado',
      invite_accepted: 'Convite Aceito',
      invite_ignored: 'Convite Ignorado',
      message_received: 'Mensagem Recebida',
      profile_viewed: 'Perfil Visualizado',
      post_engagement: 'Engajamento',
      inmail_received: 'InMail Recebido',
      no_response: 'Sem Resposta',
      first_contact: 'Primeiro Contato',
      media_received: 'Midia Recebida',
      button_clicked: 'Botao Clicado',
      list_selected: 'Lista Selecionada',
      email_sent: 'Email Enviado',
      email_opened: 'Email Aberto',
      email_clicked: 'Link Clicado',
      email_replied: 'Email Respondido',
      email_bounced: 'Email Rejeitado',
      chat_started: 'Chat Iniciado',
      page_visited: 'Pagina Visitada',
      time_on_page: 'Tempo na Pagina',
      exit_intent: 'Intencao de Saida'
    };

    const nodeDefaults = {
      conversationStep: {
        label: `Etapa ${stepCount + 1}`,
        stepNumber: stepCount + 1,
        instructions: '',
        objective: '',
        maxMessages: 3,
        examples: []
      },
      condition: {
        label: 'Condicao',
        conditionType: 'sentiment',
        operator: 'equals',
        value: 'positive'
      },
      action: {
        label: subtype === 'transfer' ? 'Transferir' :
               subtype === 'schedule' ? 'Agendar' :
               subtype === 'close_positive' ? 'Encerrar +' :
               subtype === 'close_negative' ? 'Encerrar -' : 'Acao',
        actionType: subtype || 'transfer',
        message: '',
        params: {}
      },
      trigger: {
        label: eventLabels[triggerEvent] || 'Trigger',
        event: triggerEvent || 'message_received',
        description: ''
      }
    };

    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: nodeDefaults[type] || { label: 'Novo No' }
    };

    setNodes((nds) => nds.concat(newNode));
  }, [nodes, setNodes, screenToFlowPosition]);

  // Update node data from properties panel
  const updateNodeData = useCallback((nodeId, newData) => {
    setNodes((nds) =>
      nds.map((node) => {
        if (node.id === nodeId) {
          return { ...node, data: { ...node.data, ...newData } };
        }
        return node;
      })
    );
    if (selectedNode && selectedNode.id === nodeId) {
      setSelectedNode(prev => ({ ...prev, data: { ...prev.data, ...newData } }));
    }
  }, [setNodes, selectedNode]);

  // Delete selected node
  const deleteNode = useCallback((nodeId) => {
    setNodes((nds) => nds.filter((node) => node.id !== nodeId));
    setEdges((eds) => eds.filter((edge) => edge.source !== nodeId && edge.target !== nodeId));
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  // Clone node - using functional update to avoid stale closure
  const cloneNode = useCallback((nodeId) => {
    setNodes((currentNodes) => {
      const nodeToClone = currentNodes.find(n => n.id === nodeId);
      if (!nodeToClone) return currentNodes;

      // Create a copy with new id and offset position
      const newNode = {
        id: `${nodeToClone.type}-${Date.now()}`,
        type: nodeToClone.type,
        position: {
          x: nodeToClone.position.x + 320,
          y: nodeToClone.position.y + 20
        },
        data: {
          ...nodeToClone.data,
          label: `${nodeToClone.data.label || nodeToClone.type} (copia)`
        }
      };

      return [...currentNodes, newNode];
    });
  }, [setNodes]);

  // Delete edge (connection)
  const deleteEdge = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  // Clear all nodes except trigger
  const clearWorkflow = useCallback(() => {
    const trigger = nodes.find(n => n.type === 'trigger');
    setNodes(trigger ? [trigger] : []);
    setEdges([]);
    setSelectedNode(null);
  }, [nodes, setNodes, setEdges]);

  // Build workflow object for saving
  const buildWorkflow = useCallback(() => {
    return {
      nodes: nodes.map(n => ({
        id: n.id,
        type: n.type,
        position: n.position,
        data: n.data
      })),
      edges: edges.map(e => ({
        id: e.id,
        source: e.source,
        target: e.target,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
        label: e.label
      }))
    };
  }, [nodes, edges]);

  // Perform save (can be async if onSave returns a promise)
  const performSave = useCallback(async () => {
    if (!onSave) return;

    setSaveStatus('saving');
    try {
      const workflow = buildWorkflow();
      await onSave(workflow);
      lastSavedRef.current = { nodes, edges };
      setSaveStatus('saved');
    } catch (error) {
      console.error('Auto-save failed:', error);
      setSaveStatus('error');
    }
  }, [buildWorkflow, onSave, nodes, edges]);

  // Keep ref updated with latest performSave
  useEffect(() => {
    performSaveRef.current = performSave;
  }, [performSave]);

  // Manual save (immediate)
  const handleSave = useCallback(() => {
    // Clear any pending auto-save
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
      saveTimeoutRef.current = null;
    }
    performSaveRef.current?.();
  }, []);

  // Auto-save effect - debounced 1.5 seconds after changes
  useEffect(() => {
    // Skip initial mount to avoid saving on load
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    // Mark as unsaved immediately when changes occur
    setSaveStatus('unsaved');

    // Clear existing timeout
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    // Set new debounced save
    saveTimeoutRef.current = setTimeout(() => {
      performSaveRef.current?.();
    }, 1500); // 1.5 second debounce

    // Cleanup on unmount
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, []);

  // Keyboard shortcut: Ctrl+S to save immediately
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleSave]);

  const memoizedNodeTypes = useMemo(() => nodeTypes, []);

  // Inject onDelete callback into all nodes
  const nodesWithCallbacks = useMemo(() => {
    return nodes.map(node => ({
      ...node,
      data: {
        ...node.data,
        onDelete: deleteNode,
        onClone: cloneNode
      }
    }));
  }, [nodes, deleteNode, cloneNode]);

  // Inject onDelete callback into all edges
  const edgesWithCallbacks = useMemo(() => {
    return edges.map(edge => ({
      ...edge,
      type: 'deletable',
      data: {
        ...edge.data,
        label: edge.label,
        onDelete: deleteEdge
      }
    }));
  }, [edges, deleteEdge]);

  const memoizedEdgeTypes = useMemo(() => edgeTypes, []);

  return (
    <div className="flex h-full bg-gray-50 dark:bg-gray-900 overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Sidebar with draggable nodes */}
      <Sidebar
        channel={channel}
        collapsed={sidebarCollapsed}
        onToggle={() => setSidebarCollapsed(!sidebarCollapsed)}
      />

      {/* Main canvas */}
      <div className="flex-1 relative" ref={reactFlowWrapper}>
        <ReactFlow
          nodes={nodesWithCallbacks}
          edges={edgesWithCallbacks}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onPaneClick={onPaneClick}
          onDragOver={onDragOver}
          onDrop={onDrop}
          nodeTypes={memoizedNodeTypes}
          edgeTypes={memoizedEdgeTypes}
          defaultEdgeOptions={defaultEdgeOptions}
          fitView
          fitViewOptions={{ padding: 0.05, minZoom: 0.7, maxZoom: 1.2 }}
          snapToGrid
          snapGrid={[15, 15]}
          minZoom={0.4}
          maxZoom={2}
        >
          <Background color="#6366f1" gap={30} size={1} />
          <Controls showInteractive={false} className="!bottom-2 !left-2" />
          {showMiniMap && (
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'trigger': return '#22c55e';
                  case 'conversationStep': return '#8b5cf6';
                  case 'condition': return '#f59e0b';
                  case 'action': return '#3b82f6';
                  default: return '#6b7280';
                }
              }}
              maskColor="rgba(0, 0, 0, 0.3)"
              className="!bottom-2 !right-2"
              style={{ width: 150, height: 100 }}
            />
          )}

          {/* Top toolbar */}
          <Panel position="top-right" className="flex gap-2">
            <button
              onClick={() => setShowMiniMap(!showMiniMap)}
              className={`p-2 rounded-lg shadow border transition-colors ${
                showMiniMap
                  ? 'bg-purple-100 dark:bg-purple-900/30 border-purple-300 dark:border-purple-600'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title="Minimapa"
            >
              <Eye className={`w-4 h-4 ${showMiniMap ? 'text-purple-600' : 'text-gray-600 dark:text-gray-300'}`} />
            </button>
            <button
              onClick={clearWorkflow}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Limpar workflow"
            >
              <Trash2 className="w-4 h-4 text-gray-600 dark:text-gray-300 hover:text-red-500" />
            </button>
            <button
              onClick={() => onPreview?.(nodes, edges)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <Play className="w-4 h-4 text-gray-600 dark:text-gray-300" />
              <span className="text-sm text-gray-700 dark:text-gray-300">Preview</span>
            </button>
            {/* Save status indicator */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow border transition-all ${
              saveStatus === 'saved'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400'
                : saveStatus === 'saving'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                : saveStatus === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400'
            }`}>
              {saveStatus === 'saved' && (
                <>
                  <Check className="w-4 h-4" />
                  <span className="text-sm font-medium">Salvo</span>
                </>
              )}
              {saveStatus === 'saving' && (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-sm font-medium">Salvando...</span>
                </>
              )}
              {saveStatus === 'unsaved' && (
                <>
                  <Save className="w-4 h-4" />
                  <span className="text-sm font-medium">Nao salvo</span>
                </>
              )}
              {saveStatus === 'error' && (
                <>
                  <AlertCircle className="w-4 h-4" />
                  <span className="text-sm font-medium">Erro ao salvar</span>
                </>
              )}
            </div>
            <button
              onClick={handleSave}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow transition-colors ${
                saveStatus === 'saving'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              } text-white`}
              disabled={saveStatus === 'saving'}
              title="Salvar agora (Ctrl+S)"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="text-sm">Salvar</span>
            </button>
          </Panel>

          {/* Compact Legend - inline at bottom */}
          <Panel position="bottom-center" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow px-4 py-1.5 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Trigger</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Etapa</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Condicao</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Acao</span>
              </div>
            </div>
          </Panel>
        </ReactFlow>
      </div>

      {/* Properties panel */}
      {selectedNode && (
        <PropertiesPanel
          node={selectedNode}
          onUpdate={updateNodeData}
          onDelete={deleteNode}
          onClose={() => setSelectedNode(null)}
        />
      )}
    </div>
  );
};

// Wrapper component that provides ReactFlowProvider
const WorkflowBuilder = (props) => {
  return (
    <ReactFlowProvider>
      <WorkflowBuilderInner {...props} />
    </ReactFlowProvider>
  );
};

export default WorkflowBuilder;
