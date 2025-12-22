import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Users, Target, Headphones, ArrowLeft, Plus, Search, Filter, Star,
  Sparkles, MessageSquare, Bot, ChevronRight, Loader, PlayCircle, RotateCcw,
  Pencil, Trash2, X, AlertTriangle, Linkedin, Mail, FolderPlus, Folder,
  FolderOpen, ChevronDown, MoreVertical, Move, Edit2, GitBranch, Settings
} from 'lucide-react';
import api from '../services/api';
import AgentTypeSelector from '../components/aiemployees/AgentTypeSelector';
import ChannelSelector from '../components/aiemployees/ChannelSelector';
import TemplateGallery from '../components/aiemployees/TemplateGallery';
import AgentProfileStep from '../components/aiemployees/AgentProfileStep';
import WorkflowBuilder from '../components/aiemployees/WorkflowBuilder';
import FollowUpBuilder from '../components/aiemployees/FollowUpBuilder';

// Tabs for the main page
const TABS = {
  AGENTS: 'agents',
  FOLLOWUP: 'followup'
};

// Wizard steps for creating AI Employee
const STEPS = {
  SELECT_TYPE: 'select_type',
  SELECT_CHANNEL: 'select_channel',
  SELECT_TEMPLATE: 'select_template',
  AGENT_PROFILE: 'agent_profile',
  WORKFLOW_BUILDER: 'workflow_builder',
  REVIEW: 'review'
};

// Folder colors
const FOLDER_COLORS = [
  { id: 'gray', label: 'Cinza', bg: 'bg-gray-100 dark:bg-gray-700', text: 'text-gray-600 dark:text-gray-400', border: 'border-gray-300 dark:border-gray-600' },
  { id: 'blue', label: 'Azul', bg: 'bg-blue-100 dark:bg-blue-900/30', text: 'text-blue-600 dark:text-blue-400', border: 'border-blue-300 dark:border-blue-600' },
  { id: 'green', label: 'Verde', bg: 'bg-green-100 dark:bg-green-900/30', text: 'text-green-600 dark:text-green-400', border: 'border-green-300 dark:border-green-600' },
  { id: 'purple', label: 'Roxo', bg: 'bg-purple-100 dark:bg-purple-900/30', text: 'text-purple-600 dark:text-purple-400', border: 'border-purple-300 dark:border-purple-600' },
  { id: 'orange', label: 'Laranja', bg: 'bg-orange-100 dark:bg-orange-900/30', text: 'text-orange-600 dark:text-orange-400', border: 'border-orange-300 dark:border-orange-600' },
  { id: 'red', label: 'Vermelho', bg: 'bg-red-100 dark:bg-red-900/30', text: 'text-red-600 dark:text-red-400', border: 'border-red-300 dark:border-red-600' },
  { id: 'yellow', label: 'Amarelo', bg: 'bg-yellow-100 dark:bg-yellow-900/30', text: 'text-yellow-600 dark:text-yellow-400', border: 'border-yellow-300 dark:border-yellow-600' },
  { id: 'pink', label: 'Rosa', bg: 'bg-pink-100 dark:bg-pink-900/30', text: 'text-pink-600 dark:text-pink-400', border: 'border-pink-300 dark:border-pink-600' },
];

const AIEmployeesPage = () => {
  const { t } = useTranslation(['agents', 'common']);

  // State
  const [activeTab, setActiveTab] = useState(TABS.AGENTS);
  const [currentStep, setCurrentStep] = useState(STEPS.SELECT_TYPE);
  const [agentType, setAgentType] = useState(null); // 'prospeccao' | 'atendimento'
  const [channel, setChannel] = useState(null); // 'linkedin' | 'whatsapp' | 'email' | 'webchat'
  const [selectedTemplate, setSelectedTemplate] = useState(null);
  const [agentProfile, setAgentProfile] = useState(null);
  const [interviewAnswers, setInterviewAnswers] = useState({});
  const [workflowDefinition, setWorkflowDefinition] = useState(null);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [showCreator, setShowCreator] = useState(false);
  const [followUpFlows, setFollowUpFlows] = useState([]);
  const [selectedFollowUpFlow, setSelectedFollowUpFlow] = useState(null);
  const [showFollowUpEditor, setShowFollowUpEditor] = useState(false);
  const [showCreateFlowModal, setShowCreateFlowModal] = useState(false);
  const [newFlowName, setNewFlowName] = useState('');
  const [showDeleteFlowModal, setShowDeleteFlowModal] = useState(false);
  const [flowToDelete, setFlowToDelete] = useState(null);

  // Agent editing state
  const [editingAgent, setEditingAgent] = useState(null); // Agent being edited
  const [editingAgentWorkflow, setEditingAgentWorkflow] = useState(null); // Agent for workflow editing

  // Agent delete state
  const [showDeleteAgentModal, setShowDeleteAgentModal] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState(null);
  const [deletingAgent, setDeletingAgent] = useState(false);

  // Folder state
  const [agentFolders, setAgentFolders] = useState({ tree: [], flatList: [], totalCount: 0, noFolderCount: 0 });
  const [followUpFolders, setFollowUpFolders] = useState({ tree: [], flatList: [], totalCount: 0, noFolderCount: 0 });
  const [selectedAgentFolder, setSelectedAgentFolder] = useState(null); // null = all, 'none' = no folder, uuid = folder id
  const [selectedFollowUpFolder, setSelectedFollowUpFolder] = useState(null);
  const [expandedFolders, setExpandedFolders] = useState(new Set());
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showEditFolderModal, setShowEditFolderModal] = useState(false);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [folderToEdit, setFolderToEdit] = useState(null);
  const [folderToDelete, setFolderToDelete] = useState(null);
  const [newFolderName, setNewFolderName] = useState('');
  const [newFolderColor, setNewFolderColor] = useState('gray');
  const [newFolderParent, setNewFolderParent] = useState(null);
  const [showMoveToFolderModal, setShowMoveToFolderModal] = useState(false);
  const [itemToMove, setItemToMove] = useState(null); // { type: 'agent' | 'flow', item: {...} }

  // Drag and drop state
  const [draggedItem, setDraggedItem] = useState(null); // { type: 'agent' | 'flow', item: {...} }
  const [dragOverFolder, setDragOverFolder] = useState(null); // folder id being hovered

  // Load existing AI employees and follow-up flows
  useEffect(() => {
    loadEmployees();
    loadFollowUpFlows();
  }, []);

  // Load folders when tab changes
  useEffect(() => {
    if (activeTab === TABS.AGENTS) {
      loadAgentFolders();
    } else {
      loadFollowUpFolders();
    }
  }, [activeTab]);

  const loadAgentFolders = async () => {
    try {
      const response = await api.getFolders('agents');
      if (response?.success && response?.data) {
        setAgentFolders(response.data);
      }
    } catch (error) {
      console.error('Error loading agent folders:', error);
    }
  };

  const loadFollowUpFolders = async () => {
    try {
      const response = await api.getFolders('followup');
      if (response?.success && response?.data) {
        setFollowUpFolders(response.data);
      }
    } catch (error) {
      console.error('Error loading follow-up folders:', error);
    }
  };

  const loadEmployees = async () => {
    try {
      setLoading(true);
      const response = await api.getAgents();
      if (response.success) {
        setEmployees(response.data.agents || []);
      }
    } catch (error) {
      console.error('Error loading AI employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadFollowUpFlows = async () => {
    try {
      const response = await api.getFollowUpFlows();
      let flowsData = [];
      if (response?.success && response?.data?.flows) {
        flowsData = response.data.flows;
      } else if (Array.isArray(response?.data)) {
        flowsData = response.data;
      } else if (Array.isArray(response)) {
        flowsData = response;
      }
      setFollowUpFlows(flowsData);
    } catch (error) {
      console.error('Error loading follow-up flows:', error);
      setFollowUpFlows([]);
    }
  };

  // Folder CRUD functions
  const handleCreateFolder = async () => {
    if (!newFolderName.trim()) return;

    try {
      const folderType = activeTab === TABS.AGENTS ? 'agents' : 'followup';
      const response = await api.createFolder({
        name: newFolderName.trim(),
        color: newFolderColor,
        parent_folder_id: newFolderParent,
        folder_type: folderType
      });

      if (response?.success) {
        setShowCreateFolderModal(false);
        setNewFolderName('');
        setNewFolderColor('gray');
        setNewFolderParent(null);
        if (activeTab === TABS.AGENTS) {
          await loadAgentFolders();
        } else {
          await loadFollowUpFolders();
        }
      }
    } catch (error) {
      console.error('Error creating folder:', error);
      alert(error.message || 'Erro ao criar pasta');
    }
  };

  const handleUpdateFolder = async () => {
    if (!folderToEdit || !newFolderName.trim()) return;

    try {
      const response = await api.updateFolder(folderToEdit.id, {
        name: newFolderName.trim(),
        color: newFolderColor,
        parent_folder_id: newFolderParent
      });

      if (response?.success) {
        setShowEditFolderModal(false);
        setFolderToEdit(null);
        setNewFolderName('');
        setNewFolderColor('gray');
        setNewFolderParent(null);
        if (activeTab === TABS.AGENTS) {
          await loadAgentFolders();
        } else {
          await loadFollowUpFolders();
        }
      }
    } catch (error) {
      console.error('Error updating folder:', error);
      alert(error.message || 'Erro ao atualizar pasta');
    }
  };

  const handleDeleteFolder = async () => {
    if (!folderToDelete) return;

    try {
      const response = await api.deleteFolder(folderToDelete.id);

      if (response?.success) {
        setShowDeleteFolderModal(false);
        setFolderToDelete(null);
        // Reset selection if deleted folder was selected
        if (activeTab === TABS.AGENTS) {
          if (selectedAgentFolder === folderToDelete.id) {
            setSelectedAgentFolder(null);
          }
          await loadAgentFolders();
          await loadEmployees();
        } else {
          if (selectedFollowUpFolder === folderToDelete.id) {
            setSelectedFollowUpFolder(null);
          }
          await loadFollowUpFolders();
          await loadFollowUpFlows();
        }
      }
    } catch (error) {
      console.error('Error deleting folder:', error);
      alert(error.message || 'Erro ao excluir pasta');
    }
  };

  const handleMoveToFolder = async (targetFolderId) => {
    if (!itemToMove) return;

    try {
      let response;
      if (itemToMove.type === 'agent') {
        response = await api.moveAgentToFolder(itemToMove.item.id, targetFolderId);
      } else {
        response = await api.moveFlowToFolder(itemToMove.item.id, targetFolderId);
      }

      if (response?.success) {
        setShowMoveToFolderModal(false);
        setItemToMove(null);
        if (itemToMove.type === 'agent') {
          await loadEmployees();
          await loadAgentFolders();
        } else {
          await loadFollowUpFlows();
          await loadFollowUpFolders();
        }
      }
    } catch (error) {
      console.error('Error moving item to folder:', error);
      alert(error.message || 'Erro ao mover item');
    }
  };

  const toggleFolderExpanded = (folderId) => {
    setExpandedFolders(prev => {
      const next = new Set(prev);
      if (next.has(folderId)) {
        next.delete(folderId);
      } else {
        next.add(folderId);
      }
      return next;
    });
  };

  const getFolderColor = (colorId) => {
    return FOLDER_COLORS.find(c => c.id === colorId) || FOLDER_COLORS[0];
  };

  // Filter items by selected folder
  const getFilteredEmployees = () => {
    if (selectedAgentFolder === null) return employees;
    // Get all descendants of the selected folder
    const getAllDescendantIds = (folderId) => {
      const descendants = [folderId];
      const children = agentFolders.flatList.filter(f => f.parent_folder_id === folderId);
      children.forEach(child => {
        descendants.push(...getAllDescendantIds(child.id));
      });
      return descendants;
    };
    const folderIds = getAllDescendantIds(selectedAgentFolder);
    return employees.filter(e => folderIds.includes(e.folder_id));
  };

  const getFilteredFlows = () => {
    if (selectedFollowUpFolder === null) return followUpFlows;
    // Get all descendants of the selected folder
    const getAllDescendantIds = (folderId) => {
      const descendants = [folderId];
      const children = followUpFolders.flatList.filter(f => f.parent_folder_id === folderId);
      children.forEach(child => {
        descendants.push(...getAllDescendantIds(child.id));
      });
      return descendants;
    };
    const folderIds = getAllDescendantIds(selectedFollowUpFolder);
    return followUpFlows.filter(f => folderIds.includes(f.folder_id));
  };

  // Get folder item count (including items in subfolders)
  const getFolderItemCount = (folder, flatList, items) => {
    const getAllDescendantIds = (folderId) => {
      const descendants = [folderId];
      const children = flatList.filter(f => f.parent_folder_id === folderId);
      children.forEach(child => {
        descendants.push(...getAllDescendantIds(child.id));
      });
      return descendants;
    };

    const folderIds = getAllDescendantIds(folder.id);
    return items.filter(item => folderIds.includes(item.folder_id)).length;
  };

  // Drag and drop handlers
  const handleDragStart = (e, type, item) => {
    setDraggedItem({ type, item });
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', JSON.stringify({ type, itemId: item.id }));
  };

  const handleDragEnd = () => {
    setDraggedItem(null);
    setDragOverFolder(null);
  };

  const handleDragOver = (e, folderId) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    if (dragOverFolder !== folderId) {
      setDragOverFolder(folderId);
    }
  };

  const handleDragLeave = () => {
    setDragOverFolder(null);
  };

  const handleDrop = async (e, targetFolderId) => {
    e.preventDefault();
    setDragOverFolder(null);

    if (!draggedItem) return;

    // Skip if already in the same folder
    const currentFolderId = draggedItem.item.folder_id || null;
    if (currentFolderId === targetFolderId) {
      setDraggedItem(null);
      return;
    }

    try {
      let response;
      if (draggedItem.type === 'agent') {
        response = await api.moveAgentToFolder(draggedItem.item.id, targetFolderId);
        if (response?.success) {
          // Update local state instead of reloading all data
          setEmployees(prev => prev.map(emp =>
            emp.id === draggedItem.item.id ? { ...emp, folder_id: targetFolderId } : emp
          ));
        }
      } else {
        response = await api.moveFlowToFolder(draggedItem.item.id, targetFolderId);
        if (response?.success) {
          // Update local state instead of reloading all data
          setFollowUpFlows(prev => prev.map(flow =>
            flow.id === draggedItem.item.id ? { ...flow, folder_id: targetFolderId } : flow
          ));
        }
      }
    } catch (error) {
      console.error('Error moving item:', error);
    }

    setDraggedItem(null);
  };

  const handleSaveFollowUpFlow = async (flowData) => {
    try {
      // Prepare data for API - match backend expected format
      const apiData = {
        name: flowData.name,
        description: flowData.description || null,
        flow_definition: {
          nodes: flowData.nodes || [],
          edges: flowData.edges || []
        },
        is_active: flowData.is_active || false
      };

      let response;
      // Check if this is a new flow (temp ID) or existing flow (UUID)
      const isNewFlow = !flowData.id || flowData.id.startsWith('flow-');

      if (isNewFlow) {
        response = await api.createFollowUpFlow(apiData);
      } else {
        response = await api.updateFollowUpFlow(flowData.id, apiData);
      }

      if (response?.success) {
        // Update local state with the saved flow
        const savedFlow = response.data?.flow;
        if (savedFlow) {
          setSelectedFollowUpFlow(savedFlow);
        }
        // Reload flows list
        await loadFollowUpFlows();
        console.log('Follow-up flow saved:', savedFlow);
      }
    } catch (error) {
      console.error('Error saving follow-up flow:', error);
    }
  };

  const handleDeleteFollowUpFlow = async (flowId) => {
    try {
      // Don't call API for temporary IDs
      if (flowId.startsWith('flow-')) {
        setFollowUpFlows(prev => prev.filter(f => f.id !== flowId));
        return;
      }

      const response = await api.deleteFollowUpFlow(flowId);
      if (response?.success) {
        await loadFollowUpFlows();
      }
    } catch (error) {
      console.error('Error deleting follow-up flow:', error);
    }
  };

  const handleCreateNewFlow = async () => {
    if (!newFlowName.trim()) return;

    try {
      // Create flow in database immediately
      const response = await api.createFollowUpFlow({
        name: newFlowName.trim(),
        description: null,
        flow_definition: { nodes: [], edges: [] },
        is_active: false
      });

      if (response?.success && response?.data?.flow) {
        const createdFlow = response.data.flow;
        // Transform flow_definition to nodes/edges for the editor
        setSelectedFollowUpFlow({
          ...createdFlow,
          nodes: createdFlow.flow_definition?.nodes || [],
          edges: createdFlow.flow_definition?.edges || []
        });
        await loadFollowUpFlows();
        setShowCreateFlowModal(false);
        setNewFlowName('');
        setShowFollowUpEditor(true);
      }
    } catch (error) {
      console.error('Error creating follow-up flow:', error);
      // Fallback to local creation if API fails
      const newFlow = {
        id: `flow-${Date.now()}`,
        name: newFlowName.trim(),
        nodes: [],
        edges: [],
        is_active: false,
        total_executions: 0,
        created_at: new Date().toISOString()
      };
      setSelectedFollowUpFlow(newFlow);
      setShowCreateFlowModal(false);
      setNewFlowName('');
      setShowFollowUpEditor(true);
    }
  };

  const confirmDeleteFlow = async () => {
    if (flowToDelete) {
      await handleDeleteFollowUpFlow(flowToDelete.id);
      setShowDeleteFlowModal(false);
      setFlowToDelete(null);
    }
  };

  // Handle type selection
  const handleTypeSelect = (type) => {
    setAgentType(type);
    setCurrentStep(STEPS.SELECT_CHANNEL);
  };

  // Handle channel selection
  const handleChannelSelect = (selectedChannel) => {
    setChannel(selectedChannel);
    setCurrentStep(STEPS.SELECT_TEMPLATE);
  };

  // Handle template selection
  const handleTemplateSelect = (template) => {
    setSelectedTemplate(template);
    setCurrentStep(STEPS.AGENT_PROFILE);
  };

  // Handle profile completion
  const handleProfileComplete = (profile) => {
    setAgentProfile(profile);
    setCurrentStep(STEPS.WORKFLOW_BUILDER);
  };

  // Go back
  const handleBack = () => {
    // If editing, going back should return to list
    if (editingAgent || editingAgentWorkflow) {
      handleReset();
      return;
    }

    switch (currentStep) {
      case STEPS.SELECT_CHANNEL:
        setCurrentStep(STEPS.SELECT_TYPE);
        setAgentType(null);
        break;
      case STEPS.SELECT_TEMPLATE:
        setCurrentStep(STEPS.SELECT_CHANNEL);
        setChannel(null);
        break;
      case STEPS.AGENT_PROFILE:
        setCurrentStep(STEPS.SELECT_TEMPLATE);
        setSelectedTemplate(null);
        break;
      case STEPS.WORKFLOW_BUILDER:
        setCurrentStep(STEPS.AGENT_PROFILE);
        break;
      case STEPS.REVIEW:
        setCurrentStep(STEPS.WORKFLOW_BUILDER);
        break;
      default:
        setShowCreator(false);
        setCurrentStep(STEPS.SELECT_TYPE);
        setAgentType(null);
        setChannel(null);
        setSelectedTemplate(null);
        setAgentProfile(null);
        setInterviewAnswers({});
    }
  };

  // Reset wizard
  const handleReset = () => {
    setShowCreator(false);
    setCurrentStep(STEPS.SELECT_TYPE);
    setAgentType(null);
    setChannel(null);
    setSelectedTemplate(null);
    setAgentProfile(null);
    setInterviewAnswers({});
    setWorkflowDefinition(null);
    setEditingAgent(null);
    setEditingAgentWorkflow(null);
  };

  // Delete AI Employee
  const handleDeleteAgent = async () => {
    if (!agentToDelete) return;

    try {
      setDeletingAgent(true);
      const response = await api.deleteAgent(agentToDelete.id);

      if (response.success) {
        // Remove from local state
        setEmployees(prev => prev.filter(emp => emp.id !== agentToDelete.id));
        // Close modal
        setShowDeleteAgentModal(false);
        setAgentToDelete(null);
        // Reload folders to update counts
        loadAgentFolders();
      }
    } catch (error) {
      console.error('Error deleting agent:', error);
    } finally {
      setDeletingAgent(false);
    }
  };

  // Create or Update AI Employee
  const handleCreateAgent = async () => {
    try {
      setLoading(true);

      // Check if we're editing an existing agent
      const isEditing = editingAgent || editingAgentWorkflow;
      const existingAgentId = editingAgent?.id || editingAgentWorkflow?.id;

      // Channel display names
      const channelNames = {
        linkedin: 'LinkedIn',
        whatsapp: 'WhatsApp',
        email: 'Email',
        webchat: 'WebChat'
      };

      let response;
      if (isEditing && existingAgentId) {
        // Update existing agent - use updateAgent endpoint
        // Preserve existing config and merge with new data
        const existingConfig = editingAgent?.config || editingAgentWorkflow?.config || {};
        const existingAgentType = editingAgent?.agent_type || editingAgentWorkflow?.agent_type;

        // Build new config preserving required fields based on agent type
        const newConfig = {
          ...existingConfig, // Preserve all existing config (including initial_message, behavioral_profile, etc.)
          // Update with new profile data
          tone: agentProfile?.tone || existingConfig.tone,
          objective: agentProfile?.objective || existingConfig.objective,
          personality: agentProfile?.personality || existingConfig.personality,
          rules: agentProfile?.rules || existingConfig.rules,
          company: agentProfile?.company || existingConfig.company,
          product: agentProfile?.product || existingConfig.product,
          faq: agentProfile?.faq || existingConfig.faq,
          objections: agentProfile?.objections || existingConfig.objections,
          workflow: workflowDefinition || existingConfig.workflow
        };

        // Ensure required fields exist based on agent type
        if ((existingAgentType === 'whatsapp' || existingAgentType === 'email') && !newConfig.initial_message) {
          newConfig.initial_message = existingConfig.initial_message || 'Olá! Como posso ajudar?';
        }
        if (existingAgentType === 'linkedin' && !newConfig.behavioral_profile) {
          newConfig.behavioral_profile = existingConfig.behavioral_profile || 'professional';
        }

        const updateData = {
          name: agentProfile?.name,
          description: agentProfile?.description,
          avatar_url: agentProfile?.avatarUrl,
          response_length: agentProfile?.responseLength || 'medium',
          config: newConfig,
          is_active: editingAgent?.is_active ?? editingAgentWorkflow?.is_active ?? true
        };
        response = await api.updateAgent(existingAgentId, updateData);
      } else {
        // Create new agent - use generate endpoint
        // Build answers from agentProfile for the generate endpoint
        const answers = {
          agent_name: agentProfile?.name || `AI ${agentType === 'prospeccao' ? 'SDR' : 'Atendente'} - ${channelNames[channel] || channel}`,
          avatar_url: agentProfile?.avatarUrl,
          tone: agentProfile?.tone || 'consultivo',
          objective: agentProfile?.objective || 'qualify',
          personality: agentProfile?.personality || [],
          rules: agentProfile?.rules || [],
          company_name: agentProfile?.company?.name || '',
          company_website: agentProfile?.company?.website || '',
          company_description: agentProfile?.company?.description || '',
          company_sector: agentProfile?.company?.sector || '',
          product_name: agentProfile?.product?.name || '',
          product_description: agentProfile?.product?.description || '',
          product_benefits: agentProfile?.product?.benefits || [],
          product_differentials: agentProfile?.product?.differentials || [],
          faq: agentProfile?.faq || [],
          objections: agentProfile?.objections || [],
          response_length: agentProfile?.responseLength || 'medium',
          ...interviewAnswers
        };

        const generateData = {
          agent_type: channel,
          niche: agentType,
          template_id: selectedTemplate?.id !== 'scratch' ? selectedTemplate?.id : null,
          answers: answers,
          workflow_definition: workflowDefinition
        };
        response = await api.generateAIEmployee(generateData);
      }

      if (response.success) {
        // Reload employees list
        await loadEmployees();
        // Reset wizard and go back to list
        handleReset();
        // Show success (you could add a toast notification here)
        console.log(isEditing ? 'AI Employee updated successfully:' : 'AI Employee created successfully:', response.data);
      }
    } catch (error) {
      console.error('Error creating/updating AI Employee:', error);
      // Handle error (you could add a toast notification here)
    } finally {
      setLoading(false);
    }
  };

  // Step indicator
  const getStepNumber = () => {
    const steps = Object.values(STEPS);
    return steps.indexOf(currentStep) + 1;
  };

  const getTotalSteps = () => {
    return Object.values(STEPS).length;
  };

  // If in follow-up editor mode, show full-screen editor
  if (showFollowUpEditor) {
    return (
      <div className="h-[calc(100vh-56px)] flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => {
                  setShowFollowUpEditor(false);
                  setSelectedFollowUpFlow(null);
                }}
                className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
              <div>
                <h1 className="text-base font-semibold text-gray-900 dark:text-white">
                  {selectedFollowUpFlow?.name || 'Novo Fluxo de Follow-up'}
                </h1>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Editor de Follow-up
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Follow-up Builder */}
        <div className="flex-1 min-h-0">
          <FollowUpBuilder
            flowId={selectedFollowUpFlow?.id}
            flowName={selectedFollowUpFlow?.name || 'Novo Fluxo'}
            initialFlow={selectedFollowUpFlow}
            onSave={handleSaveFollowUpFlow}
            onNameChange={(name) => {
              if (selectedFollowUpFlow) {
                setSelectedFollowUpFlow(prev => ({ ...prev, name }));
              }
            }}
          />
        </div>
      </div>
    );
  }

  // Render folder tree recursively
  const renderFolderTree = (folders, level = 0, isAgentTab = true) => {
    const selectedFolder = isAgentTab ? selectedAgentFolder : selectedFollowUpFolder;
    const setSelectedFolder = isAgentTab ? setSelectedAgentFolder : setSelectedFollowUpFolder;
    const items = isAgentTab ? employees : followUpFlows;
    const folderData = isAgentTab ? agentFolders : followUpFolders;

    return folders.map(folder => {
      const colorStyle = getFolderColor(folder.color);
      const isExpanded = expandedFolders.has(folder.id);
      const hasChildren = folder.children && folder.children.length > 0;
      const itemCount = getFolderItemCount(folder, folderData.flatList, items);
      const isDragOver = dragOverFolder === folder.id;

      return (
        <div key={folder.id}>
          <div
            className={`group flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer transition-all ${
              isDragOver
                ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500 ring-inset'
                : selectedFolder === folder.id
                  ? `${colorStyle.bg} ${colorStyle.text}`
                  : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
            }`}
            style={{ paddingLeft: `${8 + level * 12}px` }}
            onClick={() => setSelectedFolder(folder.id)}
            onDragOver={(e) => handleDragOver(e, folder.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, folder.id)}
          >
            {hasChildren && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFolderExpanded(folder.id);
                }}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded -ml-1"
              >
                <ChevronDown className={`w-3 h-3 transition-transform ${isExpanded ? '' : '-rotate-90'}`} />
              </button>
            )}
            {isExpanded && hasChildren ? (
              <FolderOpen className={`w-3.5 h-3.5 ${isDragOver ? 'text-purple-600' : colorStyle.text}`} />
            ) : (
              <Folder className={`w-3.5 h-3.5 ${isDragOver ? 'text-purple-600' : colorStyle.text}`} />
            )}
            <span className="flex-1 truncate text-xs">{folder.name}</span>
            <span className="text-[10px] text-gray-400">{itemCount}</span>
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderToEdit(folder);
                  setNewFolderName(folder.name);
                  setNewFolderColor(folder.color);
                  setNewFolderParent(folder.parent_folder_id);
                  setShowEditFolderModal(true);
                }}
                className="p-0.5 hover:bg-gray-200 dark:hover:bg-gray-600 rounded"
                title="Editar pasta"
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setFolderToDelete(folder);
                  setShowDeleteFolderModal(true);
                }}
                className="p-0.5 hover:bg-red-100 dark:hover:bg-red-900/30 text-red-600 dark:text-red-400 rounded"
                title="Excluir pasta"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
          {isExpanded && hasChildren && (
            <div>{renderFolderTree(folder.children, level + 1, isAgentTab)}</div>
          )}
        </div>
      );
    });
  };

  // If not in creator mode, show list of employees
  if (!showCreator) {
    const filteredEmployees = getFilteredEmployees();
    const filteredFlows = getFilteredFlows();
    const currentFolders = activeTab === TABS.AGENTS ? agentFolders : followUpFolders;
    const currentSelectedFolder = activeTab === TABS.AGENTS ? selectedAgentFolder : selectedFollowUpFolder;
    const setCurrentSelectedFolder = activeTab === TABS.AGENTS ? setSelectedAgentFolder : setSelectedFollowUpFolder;

    return (
      <div className="flex h-[calc(100vh-56px)]">
        {/* Sidebar */}
        <div className="w-56 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col flex-shrink-0">
          {/* Header with "Todos" */}
          <div className="p-3 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-xs font-semibold text-gray-900 dark:text-white mb-2 uppercase tracking-wide">Pastas</h3>

            {/* All items - drop here to remove from folder */}
            <div
              onClick={() => setCurrentSelectedFolder(null)}
              onDragOver={(e) => handleDragOver(e, null)}
              onDragLeave={handleDragLeave}
              onDrop={(e) => handleDrop(e, null)}
              className={`flex items-center gap-1.5 px-2 py-1 rounded-md text-xs cursor-pointer transition-all ${
                dragOverFolder === null && draggedItem
                  ? 'bg-purple-100 dark:bg-purple-900/40 ring-2 ring-purple-500 ring-inset'
                  : currentSelectedFolder === null
                    ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
              }`}
            >
              <Bot className="w-3.5 h-3.5" />
              <span className="flex-1 text-left">Todos</span>
              <span className="text-[10px] text-gray-400">{currentFolders.totalCount}</span>
            </div>
          </div>

          {/* Folder tree - aligned with "Todos" */}
          <div className="flex-1 overflow-y-auto px-3 py-1.5">
            {renderFolderTree(currentFolders.tree, 0, activeTab === TABS.AGENTS)}
          </div>

          {/* New folder button */}
          <div className="p-2 border-t border-gray-200 dark:border-gray-700">
            <button
              onClick={() => {
                setNewFolderName('');
                setNewFolderColor('gray');
                setNewFolderParent(null);
                setShowCreateFolderModal(true);
              }}
              className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md transition-colors"
            >
              <FolderPlus className="w-3.5 h-3.5" />
              Nova Pasta
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-1 text-xs font-medium bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded">
                  BETA
                </span>
              </div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                AI Employees
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Crie e gerencie seus funcionarios IA com fluxos visuais personalizados
              </p>
            </div>
            {activeTab === TABS.AGENTS ? (
              <button
                onClick={() => setShowCreator(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all shadow-lg shadow-purple-500/25"
              >
                <Sparkles className="w-5 h-5" />
                Criar AI Employee
              </button>
            ) : (
              <button
                onClick={() => setShowCreateFlowModal(true)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-r from-orange-500 to-amber-500 text-white rounded-lg hover:from-orange-600 hover:to-amber-600 transition-all shadow-lg shadow-orange-500/25"
              >
                <Plus className="w-5 h-5" />
                Criar Fluxo de Follow-up
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => setActiveTab(TABS.AGENTS)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === TABS.AGENTS
                  ? 'border-purple-600 text-purple-600 dark:text-purple-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <Bot className="w-4 h-4" />
              Meus Vendedores IA
            </button>
            <button
              onClick={() => setActiveTab(TABS.FOLLOWUP)}
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === TABS.FOLLOWUP
                  ? 'border-orange-500 text-orange-600 dark:text-orange-400'
                  : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              <RotateCcw className="w-4 h-4" />
              Fluxos de Follow-up
            </button>
          </div>

        {/* Tab Content */}
        {activeTab === TABS.AGENTS && (
          <>
            {/* Employees Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="text-center">
                    <Loader className="w-12 h-12 text-purple-600 dark:text-purple-400 animate-spin mx-auto mb-4" />
                    <p className="text-gray-600 dark:text-gray-400">Carregando...</p>
                  </div>
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div className="text-center py-12">
                  <Bot className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {selectedAgentFolder ? 'Nenhum agente nesta pasta' : 'Nenhum AI Employee criado ainda'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {selectedAgentFolder ? 'Mova agentes para esta pasta ou crie um novo.' : 'Crie seu primeiro funcionario IA para automatizar suas vendas e atendimento.'}
                  </p>
                  <button
                    onClick={() => setShowCreator(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Criar AI Employee
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Agente
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Canal
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Categoria
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Interacoes
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Acoes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredEmployees.map((employee) => {
                        const getChannelIcon = (type) => {
                          switch (type) {
                            case 'linkedin': return Linkedin;
                            case 'email': return Mail;
                            case 'whatsapp': return MessageSquare;
                            default: return Bot;
                          }
                        };
                        const getChannelColor = (type) => {
                          switch (type) {
                            case 'linkedin': return 'blue';
                            case 'email': return 'purple';
                            case 'whatsapp': return 'green';
                            default: return 'gray';
                          }
                        };
                        const getChannelLabel = (type) => {
                          switch (type) {
                            case 'linkedin': return 'LinkedIn';
                            case 'email': return 'Email';
                            case 'whatsapp': return 'WhatsApp';
                            case 'webchat': return 'WebChat';
                            default: return type;
                          }
                        };
                        const ChannelIcon = getChannelIcon(employee.agent_type);
                        const channelColor = getChannelColor(employee.agent_type);

                        return (
                          <tr
                            key={employee.id}
                            draggable
                            onDragStart={(e) => handleDragStart(e, 'agent', employee)}
                            onDragEnd={handleDragEnd}
                            className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-grab active:cursor-grabbing ${
                              draggedItem?.item?.id === employee.id ? 'opacity-50' : ''
                            }`}
                          >
                            <td className="px-6 py-4">
                              <div className="flex items-center gap-3">
                                {employee.avatar_url ? (
                                  <img
                                    src={employee.avatar_url}
                                    alt={employee.name}
                                    className="w-10 h-10 rounded-full"
                                  />
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-indigo-600 flex items-center justify-center">
                                    <Bot className="w-5 h-5 text-white" />
                                  </div>
                                )}
                                <div>
                                  <div className="font-medium text-gray-900 dark:text-gray-100">{employee.name}</div>
                                  {employee.description && (
                                    <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xs">
                                      {employee.description}
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-${channelColor}-100 dark:bg-${channelColor}-900/20 text-${channelColor}-700 dark:text-${channelColor}-400`}>
                                <ChannelIcon className="w-3 h-3" />
                                {getChannelLabel(employee.agent_type)}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                                employee.category === 'prospeccao' || employee.agent_type === 'linkedin'
                                  ? 'bg-blue-100 dark:bg-blue-900/20 text-blue-700 dark:text-blue-400'
                                  : 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                              }`}>
                                {employee.category === 'prospeccao' || employee.agent_type === 'linkedin' ? (
                                  <><Target className="w-3 h-3" /> Prospeccao</>
                                ) : (
                                  <><Headphones className="w-3 h-3" /> Atendimento</>
                                )}
                              </span>
                            </td>
                            <td className="px-6 py-4">
                              <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                                employee.is_active
                                  ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                              }`}>
                                {employee.is_active ? 'Ativo' : 'Inativo'}
                              </span>
                            </td>
                            <td className="px-6 py-4 text-center">
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {employee.total_interactions || 0}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="flex items-center justify-end gap-1">
                                <button
                                  onClick={() => {
                                    // Open agent config editor (profile, knowledge base, rules)
                                    setEditingAgent(employee);
                                    setAgentType(employee.category || (employee.agent_type === 'linkedin' ? 'prospeccao' : 'atendimento'));
                                    setChannel(employee.agent_type);
                                    // Build profile from employee data - use avatarUrl (camelCase)
                                    const config = employee.config || {};
                                    setAgentProfile({
                                      name: employee.name,
                                      avatarUrl: employee.avatar_url, // camelCase for AgentProfileStep
                                      tone: config.tone || 'consultivo',
                                      objective: config.objective || 'qualify',
                                      personality: config.personality || [],
                                      rules: config.rules || [],
                                      company: config.company || {},
                                      product: config.product || {},
                                      faq: config.faq || [],
                                      objections: config.objections || [],
                                      responseLength: employee.response_length || 'medium',
                                      ...config
                                    });
                                    setCurrentStep(STEPS.AGENT_PROFILE);
                                    setShowCreator(true);
                                  }}
                                  className="p-2 text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20 rounded-lg transition-colors"
                                  title="Editar Configuracoes"
                                >
                                  <Settings className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    // Open workflow editor
                                    setEditingAgentWorkflow(employee);
                                    setWorkflowDefinition(employee.config?.workflow || { nodes: [], edges: [] });
                                    const config = employee.config || {};
                                    setAgentProfile({
                                      name: employee.name,
                                      avatarUrl: employee.avatar_url, // camelCase for AgentProfileStep
                                      responseLength: employee.response_length || 'medium',
                                      ...config
                                    });
                                    setCurrentStep(STEPS.WORKFLOW_BUILDER);
                                    setShowCreator(true);
                                  }}
                                  className="p-2 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
                                  title="Editar Workflow"
                                >
                                  <GitBranch className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => {
                                    setAgentToDelete(employee);
                                    setShowDeleteAgentModal(true);
                                  }}
                                  className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                  title="Excluir"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Follow-up Flows Tab */}
        {activeTab === TABS.FOLLOWUP && (
          <>
            {/* Follow-up Flows Table */}
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              {filteredFlows.length === 0 ? (
                <div className="text-center py-12">
                  <RotateCcw className="w-16 h-16 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 dark:text-gray-100 mb-2">
                    {selectedFollowUpFolder ? 'Nenhum fluxo nesta pasta' : 'Nenhum fluxo de follow-up criado ainda'}
                  </h3>
                  <p className="text-gray-500 dark:text-gray-400 mb-4">
                    {selectedFollowUpFolder ? 'Mova fluxos para esta pasta ou crie um novo.' : 'Crie fluxos de follow-up para reengajar leads que nao responderam.'}
                  </p>
                  <button
                    onClick={() => setShowCreateFlowModal(true)}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                    Criar Fluxo
                  </button>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Fluxo
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Etapas
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Execucoes
                        </th>
                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                          Acoes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                      {filteredFlows.map((flow) => (
                        <tr
                          key={flow.id}
                          draggable
                          onDragStart={(e) => handleDragStart(e, 'flow', flow)}
                          onDragEnd={handleDragEnd}
                          className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-grab active:cursor-grabbing ${
                            draggedItem?.item?.id === flow.id ? 'opacity-50' : ''
                          }`}
                          onClick={() => {
                            setSelectedFollowUpFlow({
                              ...flow,
                              nodes: flow.nodes || flow.flow_definition?.nodes || [],
                              edges: flow.edges || flow.flow_definition?.edges || []
                            });
                            setShowFollowUpEditor(true);
                          }}
                        >
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-500 to-amber-500 flex items-center justify-center">
                                <RotateCcw className="w-5 h-5 text-white" />
                              </div>
                              <div>
                                <div className="font-medium text-gray-900 dark:text-gray-100">{flow.name}</div>
                                {flow.description && (
                                  <div className="text-sm text-gray-500 dark:text-gray-400 line-clamp-1 max-w-xs">
                                    {flow.description}
                                  </div>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300">
                              {(flow.nodes?.length || flow.flow_definition?.nodes?.length || 0)} etapas
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <span className={`inline-flex px-2 py-1 rounded-full text-xs font-medium ${
                              flow.is_active
                                ? 'bg-green-100 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                                : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300'
                            }`}>
                              {flow.is_active ? 'Ativo' : 'Rascunho'}
                            </span>
                          </td>
                          <td className="px-6 py-4 text-center">
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                              {flow.total_executions || 0}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center justify-end gap-2" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => {
                                  setSelectedFollowUpFlow({
                                    ...flow,
                                    nodes: flow.nodes || flow.flow_definition?.nodes || [],
                                    edges: flow.edges || flow.flow_definition?.edges || []
                                  });
                                  setShowFollowUpEditor(true);
                                }}
                                className="p-2 text-orange-600 dark:text-orange-400 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg transition-colors"
                                title="Editar"
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => {
                                  setFlowToDelete(flow);
                                  setShowDeleteFlowModal(true);
                                }}
                                className="p-2 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                                title="Excluir"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        {/* Create Flow Modal */}
        {showCreateFlowModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateFlowModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 z-10">
              <button
                onClick={() => setShowCreateFlowModal(false)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-full">
                  <RotateCcw className="w-6 h-6 text-orange-600 dark:text-orange-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Novo Fluxo de Follow-up
                </h3>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Nome do Fluxo
                </label>
                <input
                  type="text"
                  value={newFlowName}
                  onChange={(e) => setNewFlowName(e.target.value)}
                  placeholder="Ex: Follow-up Prospeccao LinkedIn"
                  className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 dark:text-white"
                  autoFocus
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && newFlowName.trim()) {
                      handleCreateNewFlow();
                    }
                  }}
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateFlowModal(false);
                    setNewFlowName('');
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateNewFlow}
                  disabled={!newFlowName.trim()}
                  className="flex-1 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Criar Fluxo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Flow Confirmation Modal */}
        {showDeleteFlowModal && flowToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteFlowModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 z-10">
              <button
                onClick={() => setShowDeleteFlowModal(false)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Excluir Fluxo
                </h3>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-6">
                Tem certeza que deseja excluir <span className="font-medium text-gray-900 dark:text-white">"{flowToDelete.name}"</span>? Esta acao nao pode ser desfeita.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteFlowModal(false);
                    setFlowToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={confirmDeleteFlow}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Create Folder Modal */}
        {showCreateFolderModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowCreateFolderModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 z-10">
              <button
                onClick={() => setShowCreateFolderModal(false)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <FolderPlus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Nova Pasta
                </h3>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome da Pasta
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Ex: Leads Quentes"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:text-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cor
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FOLDER_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => setNewFolderColor(color.id)}
                        className={`w-8 h-8 rounded-full ${color.bg} ${
                          newFolderColor === color.id ? 'ring-2 ring-offset-2 ring-purple-500 dark:ring-offset-gray-800' : ''
                        } transition-all`}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pasta Pai (opcional)
                  </label>
                  <select
                    value={newFolderParent || ''}
                    onChange={(e) => setNewFolderParent(e.target.value || null)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 dark:text-white"
                  >
                    <option value="">Nenhuma (pasta raiz)</option>
                    {currentFolders.flatList.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowCreateFolderModal(false);
                    setNewFolderName('');
                    setNewFolderColor('gray');
                    setNewFolderParent(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleCreateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Criar Pasta
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Edit Folder Modal */}
        {showEditFolderModal && folderToEdit && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowEditFolderModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 z-10">
              <button
                onClick={() => setShowEditFolderModal(false)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-full">
                  <Edit2 className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Editar Pasta
                </h3>
              </div>

              <div className="space-y-4 mb-6">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Nome da Pasta
                  </label>
                  <input
                    type="text"
                    value={newFolderName}
                    onChange={(e) => setNewFolderName(e.target.value)}
                    placeholder="Ex: Leads Quentes"
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                    autoFocus
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Cor
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {FOLDER_COLORS.map((color) => (
                      <button
                        key={color.id}
                        onClick={() => setNewFolderColor(color.id)}
                        className={`w-8 h-8 rounded-full ${color.bg} ${
                          newFolderColor === color.id ? 'ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-gray-800' : ''
                        } transition-all`}
                        title={color.label}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                    Pasta Pai (opcional)
                  </label>
                  <select
                    value={newFolderParent || ''}
                    onChange={(e) => setNewFolderParent(e.target.value || null)}
                    className="w-full px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:text-white"
                  >
                    <option value="">Nenhuma (pasta raiz)</option>
                    {currentFolders.flatList
                      .filter(f => f.id !== folderToEdit.id)
                      .map((folder) => (
                        <option key={folder.id} value={folder.id}>
                          {folder.name}
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowEditFolderModal(false);
                    setFolderToEdit(null);
                    setNewFolderName('');
                    setNewFolderColor('gray');
                    setNewFolderParent(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleUpdateFolder}
                  disabled={!newFolderName.trim()}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Folder Confirmation Modal */}
        {showDeleteFolderModal && folderToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteFolderModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 z-10">
              <button
                onClick={() => setShowDeleteFolderModal(false)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Excluir Pasta
                </h3>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Tem certeza que deseja excluir a pasta <span className="font-medium text-gray-900 dark:text-white">"{folderToDelete.name}"</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Os itens dentro desta pasta serao movidos para "Sem pasta". Sub-pastas serao movidas para a pasta pai.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteFolderModal(false);
                    setFolderToDelete(null);
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteFolder}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium"
                >
                  Excluir
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Agent Confirmation Modal */}
        {showDeleteAgentModal && agentToDelete && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => !deletingAgent && setShowDeleteAgentModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-sm w-full mx-4 z-10">
              <button
                onClick={() => !deletingAgent && setShowDeleteAgentModal(false)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                disabled={deletingAgent}
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 bg-red-100 dark:bg-red-900/30 rounded-full">
                  <AlertTriangle className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Excluir AI Employee
                </h3>
              </div>

              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Tem certeza que deseja excluir <span className="font-medium text-gray-900 dark:text-white">"{agentToDelete.name}"</span>?
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">
                Esta acao nao pode ser desfeita. Todas as configuracoes e historico de conversas serao perdidos.
              </p>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowDeleteAgentModal(false);
                    setAgentToDelete(null);
                  }}
                  disabled={deletingAgent}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors font-medium disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleDeleteAgent}
                  disabled={deletingAgent}
                  className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {deletingAgent ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      Excluindo...
                    </>
                  ) : (
                    'Excluir'
                  )}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Move to Folder Modal */}
        {showMoveToFolderModal && itemToMove && (
          <div className="fixed inset-0 z-50 flex items-center justify-center">
            <div className="absolute inset-0 bg-black/50" onClick={() => setShowMoveToFolderModal(false)} />
            <div className="relative bg-white dark:bg-gray-800 rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 z-10 max-h-[80vh] overflow-y-auto">
              <button
                onClick={() => setShowMoveToFolderModal(false)}
                className="absolute top-3 right-3 p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-6">
                <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-full">
                  <Move className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Mover para Pasta
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {itemToMove.item.name}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {/* No folder option */}
                <button
                  onClick={() => handleMoveToFolder(null)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                    !itemToMove.item.folder_id
                      ? 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-white'
                      : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                  }`}
                >
                  <Folder className="w-5 h-5 text-gray-400" />
                  <span className="flex-1">Sem pasta</span>
                  {!itemToMove.item.folder_id && (
                    <span className="text-xs text-purple-600 dark:text-purple-400 font-medium">Atual</span>
                  )}
                </button>

                {/* Folder list */}
                {currentFolders.flatList.map((folder) => {
                  const colorStyle = getFolderColor(folder.color);
                  const isCurrent = itemToMove.item.folder_id === folder.id;

                  return (
                    <button
                      key={folder.id}
                      onClick={() => handleMoveToFolder(folder.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-left transition-colors ${
                        isCurrent
                          ? `${colorStyle.bg} ${colorStyle.text}`
                          : 'hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      <Folder className={`w-5 h-5 ${colorStyle.text}`} />
                      <span className="flex-1">{folder.name}</span>
                      {isCurrent && (
                        <span className="text-xs font-medium">Atual</span>
                      )}
                    </button>
                  );
                })}

                {currentFolders.flatList.length === 0 && (
                  <p className="text-center text-gray-500 dark:text-gray-400 py-4">
                    Nenhuma pasta criada ainda.
                  </p>
                )}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => {
                    setShowMoveToFolderModal(false);
                    setNewFolderName('');
                    setNewFolderColor('gray');
                    setNewFolderParent(null);
                    setShowCreateFolderModal(true);
                  }}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors font-medium"
                >
                  <FolderPlus className="w-4 h-4" />
                  Criar Nova Pasta
                </button>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    );
  }

  // Creator wizard
  return (
    <div className={`bg-gray-50 dark:bg-gray-900 ${currentStep === STEPS.WORKFLOW_BUILDER ? 'h-[calc(100vh-56px)] flex flex-col overflow-hidden' : 'min-h-screen'}`}>
      {/* Header */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={handleBack}
              className="p-1.5 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <ArrowLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
            </button>
            <div>
              <h1 className="text-base font-semibold text-gray-900 dark:text-white">
                {(editingAgent || editingAgentWorkflow) ? 'Editar AI Employee' : 'Criar AI Employee'}
              </h1>
              {!(editingAgent || editingAgentWorkflow) && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Passo {getStepNumber()} de {getTotalSteps()}
                </p>
              )}
            </div>
          </div>

          {/* Progress bar - hide when editing */}
          {!(editingAgent || editingAgentWorkflow) && (
            <div className="hidden md:flex items-center gap-1.5">
              {Object.values(STEPS).map((step, index) => (
                <div
                  key={step}
                  className={`h-1.5 w-12 rounded-full transition-colors ${
                    index < getStepNumber()
                      ? 'bg-purple-600'
                      : 'bg-gray-200 dark:bg-gray-700'
                  }`}
                />
              ))}
            </div>
          )}

          <div className="flex items-center gap-3">
            {currentStep === STEPS.WORKFLOW_BUILDER && (
              <button
                onClick={handleCreateAgent}
                disabled={loading}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50 flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {(editingAgent || editingAgentWorkflow) ? 'Salvando...' : 'Criando...'}
                  </>
                ) : (
                  (editingAgent || editingAgentWorkflow) ? 'Salvar Alteracoes' : 'Concluir'
                )}
              </button>
            )}
            <button
              onClick={handleReset}
              className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className={`${currentStep === STEPS.WORKFLOW_BUILDER ? 'w-full px-2 flex-1 min-h-0 overflow-hidden' : 'mx-auto max-w-5xl p-4'}`}>
        {currentStep === STEPS.SELECT_TYPE && (
          <AgentTypeSelector onSelect={handleTypeSelect} />
        )}

        {currentStep === STEPS.SELECT_CHANNEL && (
          <ChannelSelector
            agentType={agentType}
            selectedChannel={channel}
            onSelect={handleChannelSelect}
          />
        )}

        {currentStep === STEPS.SELECT_TEMPLATE && (
          <TemplateGallery
            agentType={agentType}
            channel={channel}
            onSelect={handleTemplateSelect}
            onCreateFromScratch={() => {
              setSelectedTemplate({ id: 'scratch', name: 'Do zero' });
              setCurrentStep(STEPS.AGENT_PROFILE);
            }}
          />
        )}

        {currentStep === STEPS.AGENT_PROFILE && (
          <AgentProfileStep
            agentType={agentType}
            channel={channel}
            initialData={agentProfile}
            onComplete={handleProfileComplete}
            onBack={handleBack}
            isEditing={!!(editingAgent || editingAgentWorkflow)}
          />
        )}

        {currentStep === STEPS.WORKFLOW_BUILDER && (
          <WorkflowBuilder
            agentType={agentType}
            channel={channel}
            template={selectedTemplate}
            agentProfile={agentProfile}
            initialWorkflow={workflowDefinition}
            isEditing={!!(editingAgent || editingAgentWorkflow)}
            onSave={(workflow) => {
              // Auto-save: apenas salva os dados, nao navega
              setWorkflowDefinition(workflow);
            }}
            onPreview={(nodes, edges) => {
              console.log('Preview workflow:', { nodes, edges });
            }}
          />
        )}

        {currentStep === STEPS.REVIEW && (
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-8">
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-6">
              {(editingAgent || editingAgentWorkflow) ? 'Atualizar AI Employee' : 'Revisao do AI Employee'}
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Tipo</p>
                <p className="text-gray-900 dark:text-white">
                  {agentType === 'prospeccao' ? 'Prospeccao (Outbound)' : 'Atendimento (Inbound)'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Canal</p>
                <p className="text-gray-900 dark:text-white">
                  {channel === 'linkedin' && 'LinkedIn'}
                  {channel === 'whatsapp' && 'WhatsApp'}
                  {channel === 'email' && 'Email'}
                  {channel === 'webchat' && 'Chat do Site'}
                </p>
              </div>

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Template</p>
                <p className="text-gray-900 dark:text-white">
                  {selectedTemplate?.name || 'Do zero'}
                </p>
              </div>

              {workflowDefinition && (
                <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                  <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Workflow</p>
                  <p className="text-gray-900 dark:text-white">
                    {workflowDefinition.nodes?.length || 0} etapas configuradas
                  </p>
                </div>
              )}

              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-1">Status</p>
                <p className="text-green-600 dark:text-green-400 font-medium">
                  Pronto para criar
                </p>
              </div>
            </div>

            {agentProfile && (
              <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg mb-8 border border-purple-200 dark:border-purple-800">
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-400 mb-3">Perfil do Agente</p>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  {agentProfile.name && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Nome:</span>
                      <span className="ml-2 text-gray-900 dark:text-white font-medium">{agentProfile.name}</span>
                    </div>
                  )}
                  {agentProfile.tone && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Tom:</span>
                      <span className="ml-2 text-gray-900 dark:text-white capitalize">{agentProfile.tone}</span>
                    </div>
                  )}
                  {agentProfile.objective && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Objetivo:</span>
                      <span className="ml-2 text-gray-900 dark:text-white capitalize">{agentProfile.objective}</span>
                    </div>
                  )}
                  {agentProfile.company?.name && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Empresa:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agentProfile.company.name}</span>
                    </div>
                  )}
                  {agentProfile.product?.name && (
                    <div>
                      <span className="text-gray-500 dark:text-gray-400">Produto:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agentProfile.product.name}</span>
                    </div>
                  )}
                  {agentProfile.rules?.length > 0 && (
                    <div className="col-span-2">
                      <span className="text-gray-500 dark:text-gray-400">Regras:</span>
                      <span className="ml-2 text-gray-900 dark:text-white">{agentProfile.rules.length} configuradas</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {Object.entries(interviewAnswers).length > 0 && (
              <div className="p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg mb-8">
                <p className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">Configuracoes Coletadas</p>
                <div className="grid grid-cols-2 gap-2">
                  {Object.entries(interviewAnswers).map(([key, value]) => (
                    <div key={key} className="flex justify-between text-sm">
                      <span className="text-gray-500 dark:text-gray-400">{key}:</span>
                      <span className="text-gray-900 dark:text-white truncate ml-2">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              <button
                onClick={handleBack}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                Voltar
              </button>
              <button
                onClick={handleCreateAgent}
                disabled={loading}
                className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg hover:from-purple-700 hover:to-indigo-700 transition-all disabled:opacity-50"
              >
                {loading ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    {(editingAgent || editingAgentWorkflow) ? 'Atualizando...' : 'Criando...'}
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {(editingAgent || editingAgentWorkflow) ? 'Atualizar AI Employee' : 'Criar AI Employee'}
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIEmployeesPage;
