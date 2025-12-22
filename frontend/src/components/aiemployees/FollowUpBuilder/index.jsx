// frontend/src/components/aiemployees/FollowUpBuilder/index.jsx
// Visual follow-up flow builder using React Flow

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
import ConditionNode from './nodes/ConditionNode';
import ActionNode from './nodes/ActionNode';
import DeletableEdge from './edges/DeletableEdge';
import Sidebar from './Sidebar';
import PropertiesPanel from './PropertiesPanel';

import { Save, Eye, Trash2, Check, Loader2, AlertCircle, RotateCcw } from 'lucide-react';

// Define custom node types
const nodeTypes = {
  trigger: TriggerNode,
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
    stroke: '#f59e0b'
  },
  type: 'deletable'
};

// Empty initial workflow (just trigger)
const getEmptyWorkflow = () => ({
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 40, y: 80 },
      data: {
        label: 'Sem Resposta',
        event: 'no_response',
        waitTime: 24,
        waitUnit: 'hours',
        description: 'Quando lead nao responder'
      }
    }
  ],
  edges: []
});

// Default follow-up template
const getDefaultFollowUpFlow = () => ({
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 40, y: 80 },
      data: {
        label: 'Sem Resposta',
        event: 'no_response',
        waitTime: 24,
        waitUnit: 'hours'
      }
    },
    {
      id: 'condition-1',
      type: 'condition',
      position: { x: 380, y: 60 },
      data: {
        label: 'Tentativas < 3',
        conditionType: 'attempt_count',
        operator: 'less_than',
        value: 3
      }
    },
    {
      id: 'action-followup',
      type: 'action',
      position: { x: 720, y: 0 },
      data: {
        label: 'Enviar Follow-up',
        actionType: 'send_message',
        message: 'Ola! Notei que ainda nao tivemos retorno. Gostaria de saber se posso ajudar com algo?'
      }
    },
    {
      id: 'action-close',
      type: 'action',
      position: { x: 720, y: 160 },
      data: {
        label: 'Encerrar',
        actionType: 'close_negative',
        closeReason: 'no_response'
      }
    }
  ],
  edges: [
    { id: 'e-trigger-condition', source: 'trigger-1', target: 'condition-1', sourceHandle: 'right', targetHandle: 'left' },
    { id: 'e-condition-yes', source: 'condition-1', target: 'action-followup', sourceHandle: 'yes', targetHandle: 'left', label: 'Sim' },
    { id: 'e-condition-no', source: 'condition-1', target: 'action-close', sourceHandle: 'no', targetHandle: 'left', label: 'Nao' }
  ]
});

const FollowUpBuilderInner = ({
  flowId = null,
  flowName = 'Novo Fluxo',
  initialFlow = null,
  onSave,
  onNameChange
}) => {
  const reactFlowWrapper = useRef(null);
  const { screenToFlowPosition } = useReactFlow();

  // Get initial workflow
  const getInitialWorkflow = () => {
    if (initialFlow?.nodes?.length > 0) {
      return initialFlow;
    }
    return getEmptyWorkflow();
  };

  const initialWorkflow = getInitialWorkflow();

  const [nodes, setNodes, onNodesChange] = useNodesState(initialWorkflow.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialWorkflow.edges);
  const [selectedNode, setSelectedNode] = useState(null);
  const [showMiniMap, setShowMiniMap] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);
  const [name, setName] = useState(flowName);

  // Auto-save state
  const [saveStatus, setSaveStatus] = useState('saved');
  const saveTimeoutRef = useRef(null);
  const isInitialMount = useRef(true);

  // Handle edge connections
  const onConnect = useCallback((params) => {
    // Prevent self-connections
    if (params.source === params.target) return;

    // Replace existing connection from same source handle
    setEdges((eds) => {
      const filtered = eds.filter(
        e => !(e.source === params.source && e.sourceHandle === params.sourceHandle)
      );
      return addEdge({
        ...params,
        ...defaultEdgeOptions,
        ...(params.sourceHandle === 'yes' ? { label: 'Sim' } : {}),
        ...(params.sourceHandle === 'no' ? { label: 'Nao' } : {})
      }, filtered);
    });
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

    const position = screenToFlowPosition({
      x: event.clientX,
      y: event.clientY
    });

    const nodeDefaults = {
      trigger: {
        label: 'Sem Resposta',
        event: triggerEvent || 'no_response',
        waitTime: 24,
        waitUnit: 'hours'
      },
      condition: {
        label: 'Tentativas',
        conditionType: 'attempt_count',
        operator: 'less_than',
        value: 3
      },
      action: {
        label: subtype === 'send_message' ? 'Mensagem' :
               subtype === 'send_email' ? 'Email' :
               subtype === 'add_tag' ? 'Add Tag' :
               subtype === 'remove_tag' ? 'Rem Tag' :
               subtype === 'transfer' ? 'Transferir' :
               subtype === 'close_negative' ? 'Encerrar' : 'Acao',
        actionType: subtype || 'send_message',
        message: ''
      }
    };

    const newNode = {
      id: `${type}-${Date.now()}`,
      type,
      position,
      data: nodeDefaults[type] || { label: 'Novo No' }
    };

    setNodes((nds) => nds.concat(newNode));
  }, [setNodes, screenToFlowPosition]);

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

  // Clone node
  const cloneNode = useCallback((nodeId) => {
    setNodes((currentNodes) => {
      const nodeToClone = currentNodes.find(n => n.id === nodeId);
      if (!nodeToClone) return currentNodes;

      const newNode = {
        id: `${nodeToClone.type}-${Date.now()}`,
        type: nodeToClone.type,
        position: {
          x: nodeToClone.position.x + 280,
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

  // Delete edge
  const deleteEdge = useCallback((edgeId) => {
    setEdges((eds) => eds.filter((edge) => edge.id !== edgeId));
  }, [setEdges]);

  // Clear workflow
  const clearWorkflow = useCallback(() => {
    const trigger = nodes.find(n => n.type === 'trigger');
    setNodes(trigger ? [trigger] : []);
    setEdges([]);
    setSelectedNode(null);
  }, [nodes, setNodes, setEdges]);

  // Load default template
  const loadDefaultTemplate = useCallback(() => {
    const template = getDefaultFollowUpFlow();
    setNodes(template.nodes);
    setEdges(template.edges);
    setSelectedNode(null);
  }, [setNodes, setEdges]);

  // Build workflow object for saving
  const buildWorkflow = useCallback(() => {
    return {
      id: flowId,
      name: name,
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
  }, [flowId, name, nodes, edges]);

  // Perform save
  const handleSave = useCallback(async () => {
    if (!onSave) return;

    setSaveStatus('saving');
    try {
      const workflow = buildWorkflow();
      await onSave(workflow);
      setSaveStatus('saved');
    } catch (error) {
      console.error('Save failed:', error);
      setSaveStatus('error');
    }
  }, [buildWorkflow, onSave]);

  // Auto-save effect
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }

    setSaveStatus('unsaved');

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }

    saveTimeoutRef.current = setTimeout(() => {
      handleSave();
    }, 2000);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [nodes, edges, name]);

  // Keyboard shortcut: Ctrl+S
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

  // Inject callbacks into nodes
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

  // Inject callbacks into edges
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
      {/* Sidebar */}
      <Sidebar
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
          fitViewOptions={{ padding: 0.1, minZoom: 0.7, maxZoom: 1.2 }}
          snapToGrid
          snapGrid={[15, 15]}
          minZoom={0.4}
          maxZoom={2}
        >
          <Background color="#f59e0b" gap={30} size={1} />
          <Controls showInteractive={false} className="!bottom-2 !left-2" />
          {showMiniMap && (
            <MiniMap
              nodeColor={(node) => {
                switch (node.type) {
                  case 'trigger': return '#22c55e';
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
          <Panel position="top-left" className="flex items-center gap-3">
            <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-600 px-3 py-2">
              <RotateCcw className="w-4 h-4 text-orange-500" />
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  onNameChange?.(e.target.value);
                }}
                className="bg-transparent border-none focus:outline-none text-sm font-medium text-gray-900 dark:text-white w-40"
                placeholder="Nome do fluxo..."
              />
            </div>
          </Panel>

          <Panel position="top-right" className="flex gap-2">
            <button
              onClick={() => setShowMiniMap(!showMiniMap)}
              className={`p-2 rounded-lg shadow border transition-colors ${
                showMiniMap
                  ? 'bg-orange-100 dark:bg-orange-900/30 border-orange-300 dark:border-orange-600'
                  : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700'
              }`}
              title="Minimapa"
            >
              <Eye className={`w-4 h-4 ${showMiniMap ? 'text-orange-600' : 'text-gray-600 dark:text-gray-300'}`} />
            </button>
            <button
              onClick={loadDefaultTemplate}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 transition-colors"
              title="Carregar template padrao"
            >
              <RotateCcw className="w-4 h-4 text-gray-600 dark:text-gray-300 hover:text-orange-500" />
            </button>
            <button
              onClick={clearWorkflow}
              className="p-2 bg-white dark:bg-gray-800 rounded-lg shadow border border-gray-200 dark:border-gray-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              title="Limpar fluxo"
            >
              <Trash2 className="w-4 h-4 text-gray-600 dark:text-gray-300 hover:text-red-500" />
            </button>
            {/* Save status */}
            <div className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow border transition-all ${
              saveStatus === 'saved'
                ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-700 text-green-700 dark:text-green-400'
                : saveStatus === 'saving'
                ? 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400'
                : saveStatus === 'error'
                ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-700 text-red-700 dark:text-red-400'
                : 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-700 text-amber-700 dark:text-amber-400'
            }`}>
              {saveStatus === 'saved' && <Check className="w-4 h-4" />}
              {saveStatus === 'saving' && <Loader2 className="w-4 h-4 animate-spin" />}
              {saveStatus === 'unsaved' && <Save className="w-4 h-4" />}
              {saveStatus === 'error' && <AlertCircle className="w-4 h-4" />}
              <span className="text-sm font-medium">
                {saveStatus === 'saved' ? 'Salvo' :
                 saveStatus === 'saving' ? 'Salvando...' :
                 saveStatus === 'error' ? 'Erro' : 'Nao salvo'}
              </span>
            </div>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg shadow transition-colors ${
                saveStatus === 'saving'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-orange-500 hover:bg-orange-600'
              } text-white`}
              title="Salvar (Ctrl+S)"
            >
              {saveStatus === 'saving' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              <span className="text-sm">Salvar</span>
            </button>
          </Panel>

          {/* Legend */}
          <Panel position="bottom-center" className="bg-white/90 dark:bg-gray-800/90 backdrop-blur-sm rounded-full shadow px-4 py-1.5 border border-gray-200 dark:border-gray-600">
            <div className="flex items-center gap-4 text-[10px]">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500"></div>
                <span className="text-gray-500 dark:text-gray-400">Trigger</span>
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
const FollowUpBuilder = (props) => {
  return (
    <ReactFlowProvider>
      <FollowUpBuilderInner {...props} />
    </ReactFlowProvider>
  );
};

export default FollowUpBuilder;
