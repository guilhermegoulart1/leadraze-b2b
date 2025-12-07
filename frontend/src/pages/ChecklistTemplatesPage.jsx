import { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  Plus, Trash2, GripVertical, Clock, AlertCircle,
  Loader, RefreshCw, ChevronDown, ChevronUp, X, Flag, Copy,
  Phone, Video, Mail, MessageSquare, FileCheck, MoreHorizontal, Settings2
} from 'lucide-react';
import api from '../services/api';

const PIPELINE_STAGES = [
  { value: 'leads', label: 'Prospecção', bgColor: 'bg-slate-700', headerBg: 'bg-slate-600', textColor: 'text-slate-100', borderColor: 'border-slate-600' },
  { value: 'qualifying', label: 'Qualificação', bgColor: 'bg-yellow-900/40', headerBg: 'bg-yellow-700/60', textColor: 'text-yellow-100', borderColor: 'border-yellow-700/50' },
  { value: 'scheduled', label: 'Agendado', bgColor: 'bg-blue-900/40', headerBg: 'bg-blue-700/60', textColor: 'text-blue-100', borderColor: 'border-blue-700/50' },
  { value: 'proposal', label: 'Proposta', bgColor: 'bg-purple-900/40', headerBg: 'bg-purple-700/60', textColor: 'text-purple-100', borderColor: 'border-purple-700/50' },
  { value: 'negotiation', label: 'Negociação', bgColor: 'bg-orange-900/40', headerBg: 'bg-orange-700/60', textColor: 'text-orange-100', borderColor: 'border-orange-700/50' },
  { value: 'won', label: 'Ganho', bgColor: 'bg-emerald-900/40', headerBg: 'bg-emerald-700/60', textColor: 'text-emerald-100', borderColor: 'border-emerald-700/50' },
  { value: 'lost', label: 'Perdido', bgColor: 'bg-red-900/40', headerBg: 'bg-red-700/60', textColor: 'text-red-100', borderColor: 'border-red-700/50' }
];

const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: 'text-emerald-400', bgColor: 'bg-emerald-500/20', icon: '○' },
  { value: 'medium', label: 'Média', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20', icon: '◐' },
  { value: 'high', label: 'Alta', color: 'text-orange-400', bgColor: 'bg-orange-500/20', icon: '●' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-400', bgColor: 'bg-red-500/20', icon: '◉' }
];

const TASK_TYPES = [
  { value: 'call', label: 'Ligação', icon: Phone, color: 'text-blue-400 bg-blue-500/20' },
  { value: 'meeting', label: 'Reunião', icon: Video, color: 'text-purple-400 bg-purple-500/20' },
  { value: 'email', label: 'Email', icon: Mail, color: 'text-green-400 bg-green-500/20' },
  { value: 'follow_up', label: 'Follow-up', icon: MessageSquare, color: 'text-amber-400 bg-amber-500/20' },
  { value: 'proposal', label: 'Proposta', icon: FileCheck, color: 'text-indigo-400 bg-indigo-500/20' },
  { value: 'other', label: 'Outro', icon: MoreHorizontal, color: 'text-gray-400 bg-gray-500/20' }
];

// Portal Dropdown component
const PortalDropdown = ({ isOpen, anchorRef, children, align = 'left', width = 180, onClose }) => {
  const [position, setPosition] = useState({ top: 0, left: 0, openUpward: false });

  useEffect(() => {
    if (isOpen && anchorRef?.current) {
      const rect = anchorRef.current.getBoundingClientRect();
      const viewportHeight = window.innerHeight;
      const dropdownHeight = 250;
      const spaceBelow = viewportHeight - rect.bottom;
      const openUpward = spaceBelow < dropdownHeight && rect.top > dropdownHeight;

      setPosition({
        top: openUpward ? rect.top - 4 : rect.bottom + 4,
        left: align === 'right' ? rect.right - width : rect.left,
        openUpward
      });
    }
  }, [isOpen, anchorRef, align, width]);

  if (!isOpen) return null;

  return createPortal(
    <>
      <div
        className="fixed inset-0"
        style={{ zIndex: 9998 }}
        onClick={(e) => { e.stopPropagation(); onClose?.(); }}
      />
      <div
        className="fixed bg-gray-800 border border-gray-700 rounded-lg shadow-xl shadow-black/30 py-1"
        style={{
          [position.openUpward ? 'bottom' : 'top']: position.openUpward ? window.innerHeight - position.top : position.top,
          left: Math.max(8, position.left),
          minWidth: width,
          zIndex: 9999
        }}
        onClick={e => e.stopPropagation()}
      >
        {children}
      </div>
    </>,
    document.body
  );
};

const ChecklistTemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [editingItemData, setEditingItemData] = useState({});
  const [showNewItemForm, setShowNewItemForm] = useState(null);
  const [saving, setSaving] = useState(false);

  // New item form
  const [newItemData, setNewItemData] = useState({
    title: '',
    due_days: 1,
    priority: 'medium',
    task_type: 'other',
    description: ''
  });

  // Dropdown states
  const [showPriorityDropdown, setShowPriorityDropdown] = useState(null);
  const [showTypeDropdown, setShowTypeDropdown] = useState(null);
  const [showEditPriorityDropdown, setShowEditPriorityDropdown] = useState(null);
  const [showEditTypeDropdown, setShowEditTypeDropdown] = useState(null);

  // Refs for dropdowns
  const priorityButtonRefs = useRef({});
  const typeButtonRefs = useRef({});
  const editPriorityButtonRefs = useRef({});
  const editTypeButtonRefs = useRef({});

  const [formData, setFormData] = useState({
    name: '',
    pipeline_stage: '',
    is_active: true
  });

  useEffect(() => {
    loadTemplates();
  }, []);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await api.getChecklistTemplates();
      setTemplates(response.data?.templates || []);
      setError('');
    } catch (err) {
      console.error('Error loading templates:', err);
      setError('Erro ao carregar templates');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplateDetails = async (templateId) => {
    try {
      const response = await api.getChecklistTemplate(templateId);
      const template = response.data?.template;
      if (template) {
        setTemplates(prev => prev.map(t =>
          t.id === templateId ? { ...t, items: template.items } : t
        ));
      }
    } catch (error) {
      console.error('Error loading template details:', error);
    }
  };

  const handleToggleExpand = async (templateId) => {
    if (expandedTemplate === templateId) {
      setExpandedTemplate(null);
    } else {
      setExpandedTemplate(templateId);
      const template = templates.find(t => t.id === templateId);
      if (!template?.items) {
        await loadTemplateDetails(templateId);
      }
    }
  };

  const handleOpenModal = (template = null, stage = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        pipeline_stage: template.pipelineStage,
        is_active: template.isActive
      });
    } else {
      setEditingTemplate(null);
      const stageConfig = PIPELINE_STAGES.find(s => s.value === stage);
      setFormData({
        name: stage ? `Checklist - ${stageConfig?.label || stage}` : '',
        pipeline_stage: stage || '',
        is_active: true
      });
    }
    setShowTemplateModal(true);
  };

  const handleSaveTemplate = async () => {
    if (!formData.name.trim() || !formData.pipeline_stage) {
      setError('Nome e etapa são obrigatórios');
      return;
    }

    setSaving(true);
    try {
      if (editingTemplate) {
        await api.updateChecklistTemplate(editingTemplate.id, formData);
      } else {
        await api.createChecklistTemplate(formData);
      }
      await loadTemplates();
      setShowTemplateModal(false);
    } catch (error) {
      console.error('Error saving template:', error);
      setError(error.message || 'Erro ao salvar template');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteTemplate = async (templateId) => {
    if (!confirm('Tem certeza que deseja excluir este template e todos os seus itens?')) return;
    try {
      await api.deleteChecklistTemplate(templateId);
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      setError('Erro ao excluir template');
    }
  };

  const handleDuplicateTemplate = async (template) => {
    setSaving(true);
    try {
      // Create new template
      const newTemplateResponse = await api.createChecklistTemplate({
        name: `${template.name} (cópia)`,
        pipeline_stage: template.pipelineStage,
        is_active: false
      });

      const newTemplateId = newTemplateResponse.data?.template?.id;

      // Copy items if template has items
      if (newTemplateId && template.items?.length > 0) {
        for (const item of template.items) {
          await api.addChecklistTemplateItem(newTemplateId, {
            title: item.title,
            due_days: item.dueDays,
            priority: item.priority,
            task_type: item.taskType,
            description: item.description
          });
        }
      }

      await loadTemplates();
    } catch (error) {
      console.error('Error duplicating template:', error);
      setError('Erro ao duplicar template');
    } finally {
      setSaving(false);
    }
  };

  const handleAddItem = async (templateId) => {
    if (!newItemData.title.trim()) return;

    setSaving(true);
    try {
      await api.addChecklistTemplateItem(templateId, newItemData);
      await loadTemplateDetails(templateId);
      setNewItemData({ title: '', due_days: 1, priority: 'medium', task_type: 'other', description: '' });
      setShowNewItemForm(null);
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleStartEditItem = (item) => {
    setEditingItem(item.id);
    setEditingItemData({
      title: item.title,
      due_days: item.dueDays,
      priority: item.priority || 'medium',
      task_type: item.taskType || 'other',
      description: item.description || ''
    });
  };

  const handleUpdateItem = async (templateId, itemId) => {
    setSaving(true);
    try {
      await api.updateChecklistTemplateItem(templateId, itemId, editingItemData);
      await loadTemplateDetails(templateId);
      setEditingItem(null);
      setEditingItemData({});
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (templateId, itemId) => {
    if (!confirm('Excluir este item?')) return;
    try {
      await api.deleteChecklistTemplateItem(templateId, itemId);
      await loadTemplateDetails(templateId);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const getPriorityConfig = (priority) => {
    return PRIORITIES.find(p => p.value === priority) || PRIORITIES[1];
  };

  const getTaskTypeConfig = (type) => {
    return TASK_TYPES.find(t => t.value === type) || TASK_TYPES[5];
  };

  const handleDragEnd = async (result, templateId) => {
    const { source, destination } = result;

    // Dropped outside the list or no movement
    if (!destination || source.index === destination.index) return;

    const template = templates.find(t => t.id === templateId);
    if (!template?.items) return;

    // Reorder items locally
    const newItems = [...template.items];
    const [removed] = newItems.splice(source.index, 1);
    newItems.splice(destination.index, 0, removed);

    // Update positions
    const reorderedItems = newItems.map((item, idx) => ({
      ...item,
      position: idx
    }));

    // Optimistic update
    setTemplates(prev => prev.map(t =>
      t.id === templateId ? { ...t, items: reorderedItems } : t
    ));

    // Persist to backend
    try {
      await api.reorderChecklistTemplateItems(templateId, reorderedItems.map(item => ({
        id: item.id,
        position: item.position
      })));
    } catch (error) {
      console.error('Error reordering items:', error);
      // Revert on error
      await loadTemplateDetails(templateId);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-purple-500" />
      </div>
    );
  }

  return (
    <div className="p-6 min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-100">Templates de Checklist</h1>
          <p className="text-gray-400 text-sm mt-1">
            Configure atividades automáticas para cada etapa do funil. Quando um lead mudar de etapa, o checklist será criado automaticamente.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTemplates}
            className="p-2 text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-900/40 border border-red-700 rounded-lg text-red-300 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError('')} className="ml-auto hover:text-red-100">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Pipeline Stages Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-4">
        {PIPELINE_STAGES.map(stage => {
          const stageTemplates = templates.filter(t => t.pipelineStage === stage.value);
          const activeTemplate = stageTemplates.find(t => t.isActive);
          const isExpanded = expandedTemplate === activeTemplate?.id;

          return (
            <div
              key={stage.value}
              className={`rounded-xl border overflow-hidden transition-all ${stage.borderColor} ${stage.bgColor}`}
            >
              {/* Stage Header */}
              <div className={`px-4 py-3 ${stage.headerBg}`}>
                <div className="flex items-center justify-between">
                  <h3 className={`font-semibold ${stage.textColor}`}>{stage.label}</h3>
                  {activeTemplate ? (
                    <div className="flex items-center gap-2">
                      <span className="text-xs px-2 py-0.5 rounded-full bg-black/20 text-white/80">
                        {activeTemplate.itemCount || 0} {activeTemplate.itemCount === 1 ? 'item' : 'itens'}
                      </span>
                    </div>
                  ) : (
                    <button
                      onClick={() => handleOpenModal(null, stage.value)}
                      className="text-xs px-2.5 py-1 rounded-full bg-white/20 hover:bg-white/30 text-white flex items-center gap-1 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Criar
                    </button>
                  )}
                </div>
              </div>

              {/* Template Content */}
              <div className="p-3">
                {!activeTemplate ? (
                  <p className="text-sm text-gray-500 text-center py-6">
                    Nenhum checklist ativo
                  </p>
                ) : (
                  <div>
                    {/* Template Header */}
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-sm font-medium text-gray-200 truncate flex-1">
                        {activeTemplate.name}
                      </span>
                      <div className="flex items-center gap-1 ml-2">
                        <button
                          onClick={() => handleDuplicateTemplate(activeTemplate)}
                          className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
                          title="Duplicar template"
                        >
                          <Copy className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleOpenModal(activeTemplate)}
                          className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
                          title="Editar template"
                        >
                          <Settings2 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => handleToggleExpand(activeTemplate.id)}
                          className="p-1.5 text-gray-500 hover:text-gray-300 hover:bg-gray-700/50 rounded transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Items */}
                    {isExpanded && (
                      <DragDropContext onDragEnd={(result) => handleDragEnd(result, activeTemplate.id)}>
                        <Droppable droppableId={`template-${activeTemplate.id}`}>
                          {(droppableProvided, droppableSnapshot) => (
                            <div
                              ref={droppableProvided.innerRef}
                              {...droppableProvided.droppableProps}
                              className={`space-y-1.5 rounded-lg transition-colors ${
                                droppableSnapshot.isDraggingOver ? 'bg-purple-900/20' : ''
                              }`}
                            >
                              {activeTemplate.items?.map((item, index) => {
                                const priorityConfig = getPriorityConfig(item.priority);
                                const typeConfig = getTaskTypeConfig(item.taskType);
                                const TypeIcon = typeConfig.icon;
                                const isEditing = editingItem === item.id;

                                return (
                                  <Draggable
                                    key={item.id}
                                    draggableId={`item-${item.id}`}
                                    index={index}
                                    isDragDisabled={isEditing}
                                  >
                                    {(draggableProvided, draggableSnapshot) => (
                                      <div
                                        ref={draggableProvided.innerRef}
                                        {...draggableProvided.draggableProps}
                                        className={`group rounded-lg transition-colors ${
                                          isEditing
                                            ? 'bg-gray-700/80 p-3'
                                            : 'bg-gray-800/60 hover:bg-gray-700/60 p-2'
                                        } ${draggableSnapshot.isDragging ? 'shadow-lg ring-2 ring-purple-500' : ''}`}
                                      >
                              {isEditing ? (
                                // Edit Mode
                                <div className="space-y-3">
                                  <input
                                    type="text"
                                    value={editingItemData.title}
                                    onChange={(e) => setEditingItemData(prev => ({ ...prev, title: e.target.value }))}
                                    className="w-full text-sm px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                                    placeholder="Título da atividade"
                                    autoFocus
                                  />

                                  <textarea
                                    value={editingItemData.description}
                                    onChange={(e) => setEditingItemData(prev => ({ ...prev, description: e.target.value }))}
                                    className="w-full text-xs px-3 py-2 bg-gray-800 border border-gray-600 text-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                                    placeholder="Descrição (opcional)"
                                    rows={2}
                                  />

                                  <div className="flex flex-wrap items-center gap-2">
                                    {/* Due Days */}
                                    <div className="flex items-center gap-1.5 text-xs">
                                      <Clock className="w-3.5 h-3.5 text-gray-500" />
                                      <input
                                        type="number"
                                        value={editingItemData.due_days}
                                        onChange={(e) => setEditingItemData(prev => ({ ...prev, due_days: parseInt(e.target.value) || 0 }))}
                                        className="w-14 px-2 py-1 bg-gray-800 border border-gray-600 text-gray-100 rounded text-center"
                                        min="0"
                                      />
                                      <span className="text-gray-400">dias</span>
                                    </div>

                                    {/* Task Type */}
                                    <div className="relative">
                                      {(() => {
                                        const key = `edit-type-${item.id}`;
                                        if (!editTypeButtonRefs.current[key]) {
                                          editTypeButtonRefs.current[key] = { current: null };
                                        }
                                        const selectedType = getTaskTypeConfig(editingItemData.task_type);
                                        const SelectedIcon = selectedType.icon;
                                        return (
                                          <>
                                            <button
                                              ref={el => editTypeButtonRefs.current[key].current = el}
                                              onClick={() => setShowEditTypeDropdown(showEditTypeDropdown === key ? null : key)}
                                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${selectedType.color}`}
                                            >
                                              <SelectedIcon className="w-3.5 h-3.5" />
                                              <span>{selectedType.label}</span>
                                              <ChevronDown className="w-3 h-3" />
                                            </button>
                                            <PortalDropdown
                                              isOpen={showEditTypeDropdown === key}
                                              anchorRef={editTypeButtonRefs.current[key]}
                                              onClose={() => setShowEditTypeDropdown(null)}
                                              width={160}
                                            >
                                              {TASK_TYPES.map(type => {
                                                const Icon = type.icon;
                                                return (
                                                  <button
                                                    key={type.value}
                                                    onClick={() => {
                                                      setEditingItemData(prev => ({ ...prev, task_type: type.value }));
                                                      setShowEditTypeDropdown(null);
                                                    }}
                                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-700 ${
                                                      editingItemData.task_type === type.value ? 'bg-gray-700' : ''
                                                    }`}
                                                  >
                                                    <span className={`p-1 rounded ${type.color}`}>
                                                      <Icon className="w-3 h-3" />
                                                    </span>
                                                    <span className="text-gray-200">{type.label}</span>
                                                  </button>
                                                );
                                              })}
                                            </PortalDropdown>
                                          </>
                                        );
                                      })()}
                                    </div>

                                    {/* Priority */}
                                    <div className="relative">
                                      {(() => {
                                        const key = `edit-priority-${item.id}`;
                                        if (!editPriorityButtonRefs.current[key]) {
                                          editPriorityButtonRefs.current[key] = { current: null };
                                        }
                                        const selectedPriority = getPriorityConfig(editingItemData.priority);
                                        return (
                                          <>
                                            <button
                                              ref={el => editPriorityButtonRefs.current[key].current = el}
                                              onClick={() => setShowEditPriorityDropdown(showEditPriorityDropdown === key ? null : key)}
                                              className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${selectedPriority.color} ${selectedPriority.bgColor}`}
                                            >
                                              <Flag className="w-3 h-3" />
                                              <span>{selectedPriority.label}</span>
                                              <ChevronDown className="w-3 h-3" />
                                            </button>
                                            <PortalDropdown
                                              isOpen={showEditPriorityDropdown === key}
                                              anchorRef={editPriorityButtonRefs.current[key]}
                                              onClose={() => setShowEditPriorityDropdown(null)}
                                              width={140}
                                            >
                                              {PRIORITIES.map(p => (
                                                <button
                                                  key={p.value}
                                                  onClick={() => {
                                                    setEditingItemData(prev => ({ ...prev, priority: p.value }));
                                                    setShowEditPriorityDropdown(null);
                                                  }}
                                                  className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-700 ${
                                                    editingItemData.priority === p.value ? 'bg-gray-700' : ''
                                                  }`}
                                                >
                                                  <span className={`${p.color}`}>{p.icon}</span>
                                                  <span className="text-gray-200">{p.label}</span>
                                                </button>
                                              ))}
                                            </PortalDropdown>
                                          </>
                                        );
                                      })()}
                                    </div>
                                  </div>

                                  <div className="flex justify-end gap-2 pt-1">
                                    <button
                                      onClick={() => {
                                        setEditingItem(null);
                                        setEditingItemData({});
                                      }}
                                      className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded transition-colors"
                                    >
                                      Cancelar
                                    </button>
                                    <button
                                      onClick={() => handleUpdateItem(activeTemplate.id, item.id)}
                                      disabled={saving || !editingItemData.title?.trim()}
                                      className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                                    >
                                      {saving && <Loader className="w-3 h-3 animate-spin" />}
                                      Salvar
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                // View Mode
                                <div className="flex items-start gap-2">
                                  <div {...draggableProvided.dragHandleProps} className="flex-shrink-0">
                                    <GripVertical className="w-3.5 h-3.5 text-gray-600 mt-0.5 opacity-0 group-hover:opacity-100 cursor-grab" />
                                  </div>

                                  {/* Task Type Icon */}
                                  <div className={`p-1 rounded flex-shrink-0 ${typeConfig.color}`} title={typeConfig.label}>
                                    <TypeIcon className="w-3 h-3" />
                                  </div>

                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                      <span
                                        className="text-sm text-gray-200 cursor-pointer hover:text-purple-400 transition-colors"
                                        onClick={() => handleStartEditItem(item)}
                                      >
                                        {item.title}
                                      </span>
                                    </div>

                                    {item.description && (
                                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                                        {item.description}
                                      </p>
                                    )}

                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className="text-[10px] text-gray-500 flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        +{item.dueDays}d
                                      </span>
                                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${priorityConfig.color} ${priorityConfig.bgColor}`}>
                                        {priorityConfig.label}
                                      </span>
                                    </div>
                                  </div>

                                  <button
                                    onClick={() => handleDeleteItem(activeTemplate.id, item.id)}
                                    className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                                      </div>
                                    )}
                                  </Draggable>
                                );
                              })}

                        {/* Add New Item Form */}
                        {showNewItemForm === activeTemplate.id ? (
                          <div className="bg-gray-700/50 rounded-lg p-3 space-y-3 border border-gray-600">
                            <input
                              type="text"
                              value={newItemData.title}
                              onChange={(e) => setNewItemData(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Título da atividade"
                              className="w-full text-sm px-3 py-2 bg-gray-800 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                              autoFocus
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && newItemData.title.trim()) {
                                  handleAddItem(activeTemplate.id);
                                } else if (e.key === 'Escape') {
                                  setShowNewItemForm(null);
                                  setNewItemData({ title: '', due_days: 1, priority: 'medium', task_type: 'other', description: '' });
                                }
                              }}
                            />

                            <textarea
                              value={newItemData.description}
                              onChange={(e) => setNewItemData(prev => ({ ...prev, description: e.target.value }))}
                              placeholder="Descrição (opcional)"
                              className="w-full text-xs px-3 py-2 bg-gray-800 border border-gray-600 text-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                              rows={2}
                            />

                            <div className="flex flex-wrap items-center gap-2">
                              {/* Due Days */}
                              <div className="flex items-center gap-1.5 text-xs">
                                <Clock className="w-3.5 h-3.5 text-gray-500" />
                                <input
                                  type="number"
                                  value={newItemData.due_days}
                                  onChange={(e) => setNewItemData(prev => ({ ...prev, due_days: parseInt(e.target.value) || 0 }))}
                                  className="w-14 px-2 py-1 bg-gray-800 border border-gray-600 text-gray-100 rounded text-center"
                                  min="0"
                                />
                                <span className="text-gray-400">dias após entrar na etapa</span>
                              </div>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {/* Task Type */}
                              <div className="relative">
                                {(() => {
                                  const key = `new-type-${activeTemplate.id}`;
                                  if (!typeButtonRefs.current[key]) {
                                    typeButtonRefs.current[key] = { current: null };
                                  }
                                  const selectedType = getTaskTypeConfig(newItemData.task_type);
                                  const SelectedIcon = selectedType.icon;
                                  return (
                                    <>
                                      <button
                                        ref={el => typeButtonRefs.current[key].current = el}
                                        onClick={() => setShowTypeDropdown(showTypeDropdown === key ? null : key)}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${selectedType.color}`}
                                      >
                                        <SelectedIcon className="w-3.5 h-3.5" />
                                        <span>{selectedType.label}</span>
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                      <PortalDropdown
                                        isOpen={showTypeDropdown === key}
                                        anchorRef={typeButtonRefs.current[key]}
                                        onClose={() => setShowTypeDropdown(null)}
                                        width={160}
                                      >
                                        {TASK_TYPES.map(type => {
                                          const Icon = type.icon;
                                          return (
                                            <button
                                              key={type.value}
                                              onClick={() => {
                                                setNewItemData(prev => ({ ...prev, task_type: type.value }));
                                                setShowTypeDropdown(null);
                                              }}
                                              className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-700 ${
                                                newItemData.task_type === type.value ? 'bg-gray-700' : ''
                                              }`}
                                            >
                                              <span className={`p-1 rounded ${type.color}`}>
                                                <Icon className="w-3 h-3" />
                                              </span>
                                              <span className="text-gray-200">{type.label}</span>
                                            </button>
                                          );
                                        })}
                                      </PortalDropdown>
                                    </>
                                  );
                                })()}
                              </div>

                              {/* Priority */}
                              <div className="relative">
                                {(() => {
                                  const key = `new-priority-${activeTemplate.id}`;
                                  if (!priorityButtonRefs.current[key]) {
                                    priorityButtonRefs.current[key] = { current: null };
                                  }
                                  const selectedPriority = getPriorityConfig(newItemData.priority);
                                  return (
                                    <>
                                      <button
                                        ref={el => priorityButtonRefs.current[key].current = el}
                                        onClick={() => setShowPriorityDropdown(showPriorityDropdown === key ? null : key)}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded text-xs ${selectedPriority.color} ${selectedPriority.bgColor}`}
                                      >
                                        <Flag className="w-3 h-3" />
                                        <span>{selectedPriority.label}</span>
                                        <ChevronDown className="w-3 h-3" />
                                      </button>
                                      <PortalDropdown
                                        isOpen={showPriorityDropdown === key}
                                        anchorRef={priorityButtonRefs.current[key]}
                                        onClose={() => setShowPriorityDropdown(null)}
                                        width={140}
                                      >
                                        {PRIORITIES.map(p => (
                                          <button
                                            key={p.value}
                                            onClick={() => {
                                              setNewItemData(prev => ({ ...prev, priority: p.value }));
                                              setShowPriorityDropdown(null);
                                            }}
                                            className={`w-full flex items-center gap-2 px-3 py-2 text-xs hover:bg-gray-700 ${
                                              newItemData.priority === p.value ? 'bg-gray-700' : ''
                                            }`}
                                          >
                                            <span className={`${p.color}`}>{p.icon}</span>
                                            <span className="text-gray-200">{p.label}</span>
                                          </button>
                                        ))}
                                      </PortalDropdown>
                                    </>
                                  );
                                })()}
                              </div>
                            </div>

                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setShowNewItemForm(null);
                                  setNewItemData({ title: '', due_days: 1, priority: 'medium', task_type: 'other', description: '' });
                                }}
                                className="px-3 py-1.5 text-xs text-gray-400 hover:text-gray-200 hover:bg-gray-600 rounded transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleAddItem(activeTemplate.id)}
                                disabled={!newItemData.title.trim() || saving}
                                className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center gap-1.5"
                              >
                                {saving && <Loader className="w-3 h-3 animate-spin" />}
                                Adicionar
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowNewItemForm(activeTemplate.id)}
                            className="w-full p-2.5 text-sm text-gray-500 hover:text-purple-400 hover:bg-gray-700/50 rounded-lg border border-dashed border-gray-700 hover:border-purple-500/50 flex items-center justify-center gap-1.5 transition-all"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar Item
                          </button>
                        )}
                              {droppableProvided.placeholder}
                            </div>
                          )}
                        </Droppable>
                      </DragDropContext>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-xl shadow-2xl w-full max-w-md mx-4 border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h2 className="text-lg font-semibold text-gray-100">
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 text-gray-500 hover:text-gray-300 hover:bg-gray-700 rounded transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Nome do Template</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  placeholder="Ex: Checklist de Qualificação"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Etapa do Funil</label>
                <select
                  value={formData.pipeline_stage}
                  onChange={(e) => setFormData(prev => ({ ...prev, pipeline_stage: e.target.value }))}
                  className="w-full px-3 py-2 bg-gray-900 border border-gray-600 text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">Selecione uma etapa...</option>
                  {PIPELINE_STAGES.map(stage => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-3 p-3 bg-gray-900/50 rounded-lg">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="w-4 h-4 rounded border-gray-600 text-purple-600 focus:ring-purple-500 bg-gray-800"
                />
                <div>
                  <label htmlFor="is_active" className="text-sm font-medium text-gray-200 cursor-pointer">
                    Template Ativo
                  </label>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Será aplicado automaticamente quando leads entrarem nesta etapa
                  </p>
                </div>
              </div>
            </div>

            <div className="flex justify-between items-center gap-3 p-4 border-t border-gray-700">
              <div>
                {editingTemplate && (
                  <button
                    onClick={() => {
                      handleDeleteTemplate(editingTemplate.id);
                      setShowTemplateModal(false);
                    }}
                    className="px-3 py-2 text-sm text-red-400 hover:text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
                  >
                    Excluir Template
                  </button>
                )}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setShowTemplateModal(false)}
                  className="px-4 py-2 text-sm text-gray-400 hover:text-gray-200 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTemplate}
                  disabled={saving || !formData.name.trim() || !formData.pipeline_stage}
                  className="px-4 py-2 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-500 disabled:opacity-50 transition-colors flex items-center gap-2"
                >
                  {saving && <Loader className="w-4 h-4 animate-spin" />}
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistTemplatesPage;
