// frontend/src/components/pipelines/PipelineSettingsModal.jsx
import { useState, useEffect, useRef } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import { HexColorPicker } from 'react-colorful';
import {
  X,
  Target,
  GripVertical,
  Plus,
  Trash2,
  Trophy,
  XCircle,
  Users,
  UserPlus,
  Crown,
  Shield,
  Loader,
  AlertCircle,
  Pipette
} from 'lucide-react';
import api from '../../services/api';

// Cores preset com valores HEX diretos
const PRESET_COLORS = [
  { name: 'Azul', hex: '#3b82f6' },
  { name: 'Roxo', hex: '#8b5cf6' },
  { name: 'Verde', hex: '#10b981' },
  { name: 'Amarelo', hex: '#f59e0b' },
  { name: 'Vermelho', hex: '#ef4444' },
  { name: 'Rosa', hex: '#ec4899' },
  { name: 'Laranja', hex: '#f97316' },
  { name: 'Ciano', hex: '#0891b2' },
];

// Mapa de cores legadas (para compatibilidade)
const LEGACY_COLOR_MAP = {
  slate: '#64748b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  orange: '#f97316',
  emerald: '#10b981',
  red: '#ef4444',
  pink: '#ec4899',
  cyan: '#0891b2'
};

// Resolver cor (suporta hex e nomes legados)
const resolveColor = (color) => {
  if (!color) return '#3b82f6';
  if (color.startsWith('#')) return color;
  return LEGACY_COLOR_MAP[color] || '#3b82f6';
};

// Componente ColorPicker compacto - mostra só a cor, clica para abrir seletor (para Etapas)
const ColorPicker = ({ value, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [showCustom, setShowCustom] = useState(false);
  const [customHex, setCustomHex] = useState(resolveColor(value));
  const resolvedValue = resolveColor(value);
  const pickerRef = useRef(null);

  useEffect(() => {
    setCustomHex(resolveColor(value));
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const handlePresetClick = (hex) => {
    onChange(hex);
    setCustomHex(hex);
    setIsOpen(false);
  };

  const handleCustomChange = (e) => {
    let hex = e.target.value;
    setCustomHex(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  return (
    <div className="relative" ref={pickerRef}>
      {/* Botão da cor atual */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-7 h-7 rounded-full border-2 border-gray-300 dark:border-gray-500 hover:scale-110 transition-transform"
        style={{ backgroundColor: resolvedValue }}
        title="Clique para mudar a cor"
      />

      {/* Dropdown de cores */}
      {isOpen && (
        <div className="absolute top-full left-0 mt-2 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-xl z-50 min-w-[200px]">
          <div className="grid grid-cols-4 gap-2 mb-3">
            {PRESET_COLORS.map((color) => (
              <button
                key={color.hex}
                type="button"
                onClick={() => handlePresetClick(color.hex)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  resolvedValue === color.hex
                    ? 'ring-2 ring-offset-1 ring-purple-500 border-white'
                    : 'border-gray-200 dark:border-gray-600 hover:scale-110'
                }`}
                style={{ backgroundColor: color.hex }}
                title={color.name}
              />
            ))}
          </div>

          {/* Cor customizada */}
          {!showCustom ? (
            <button
              type="button"
              onClick={() => setShowCustom(true)}
              className="w-full text-xs text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 flex items-center justify-center gap-1 py-1"
            >
              <Pipette className="w-3 h-3" />
              Cor customizada
            </button>
          ) : (
            <div className="border-t border-gray-200 dark:border-gray-700 pt-3 mt-1">
              <HexColorPicker
                color={resolvedValue}
                onChange={(newColor) => {
                  onChange(newColor);
                  setCustomHex(newColor);
                }}
                style={{ width: '100%', height: '120px' }}
              />
              <div className="flex items-center gap-2 mt-2">
                <input
                  type="text"
                  value={customHex}
                  onChange={handleCustomChange}
                  placeholder="#ff0099"
                  className="flex-1 px-2 py-1 text-xs font-mono border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100"
                />
                <button
                  type="button"
                  onClick={() => setShowCustom(false)}
                  className="px-2 py-1 text-xs bg-purple-600 text-white rounded hover:bg-purple-700"
                >
                  OK
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

// Componente FullColorPicker - mostra todas as cores inline (para aba Geral)
const FullColorPicker = ({ value, onChange }) => {
  const [showCustom, setShowCustom] = useState(false);
  const [customHex, setCustomHex] = useState(resolveColor(value));
  const resolvedValue = resolveColor(value);

  useEffect(() => {
    setCustomHex(resolveColor(value));
  }, [value]);

  const handleCustomChange = (e) => {
    let hex = e.target.value;
    setCustomHex(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  return (
    <div className="space-y-3">
      {/* Cores preset em linha */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.hex}
            type="button"
            onClick={() => {
              onChange(color.hex);
              setCustomHex(color.hex);
            }}
            className={`w-9 h-9 rounded-full border-2 transition-all ${
              resolvedValue === color.hex
                ? 'ring-2 ring-offset-2 ring-purple-500 border-white dark:ring-offset-gray-800'
                : 'border-gray-200 dark:border-gray-600 hover:scale-110'
            }`}
            style={{ backgroundColor: color.hex }}
            title={color.name}
          />
        ))}

        {/* Botão para cor customizada */}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={`w-9 h-9 rounded-full border-2 transition-all flex items-center justify-center ${
            showCustom
              ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20'
              : 'border-dashed border-gray-300 dark:border-gray-600 hover:border-purple-400 dark:hover:border-purple-500'
          }`}
          title="Cor customizada"
        >
          <Pipette className="w-4 h-4 text-gray-500 dark:text-gray-400" />
        </button>
      </div>

      {/* Picker de cor customizada */}
      {showCustom && (
        <div className="p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
          <HexColorPicker
            color={resolvedValue}
            onChange={(newColor) => {
              onChange(newColor);
              setCustomHex(newColor);
            }}
            style={{ width: '100%', height: '140px' }}
          />
          <div className="flex items-center gap-2 mt-3">
            <div
              className="w-8 h-8 rounded-full border-2 border-gray-300 dark:border-gray-500"
              style={{ backgroundColor: resolvedValue }}
            />
            <input
              type="text"
              value={customHex}
              onChange={handleCustomChange}
              placeholder="#ff0099"
              className="flex-1 px-3 py-2 text-sm font-mono border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
            />
          </div>
        </div>
      )}
    </div>
  );
};

const ROLE_LABELS = {
  owner: { label: 'Proprietário', icon: Crown, color: 'text-amber-500' },
  admin: { label: 'Admin', icon: Shield, color: 'text-purple-500' },
  member: { label: 'Membro', icon: Users, color: 'text-gray-500' }
};

const PipelineSettingsModal = ({ pipeline, projects, defaultProjectId, onClose, onSave }) => {
  const [activeTab, setActiveTab] = useState('general');
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    color: 'blue',
    project_id: null,
    is_restricted: false
  });
  const [stages, setStages] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Permissions tab state
  const [pipelineUsers, setPipelineUsers] = useState([]);
  const [accountUsers, setAccountUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState('');
  const [selectedRole, setSelectedRole] = useState('member');
  const [addingUser, setAddingUser] = useState(false);

  // Delete pipeline state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInfo, setDeleteInfo] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const isNew = !pipeline?.id;

  useEffect(() => {
    if (pipeline?.id) {
      // Edição - carregar dados
      loadPipeline(pipeline.id);
    } else {
      // Criação - usar defaultProjectId se fornecido
      setFormData({
        name: '',
        description: '',
        color: '#3b82f6',
        project_id: defaultProjectId || pipeline?.project_id || null,
        is_restricted: false
      });
      setStages([
        { id: 'temp-1', name: 'Novos', color: '#3b82f6', is_win_stage: false, is_loss_stage: false },
        { id: 'temp-2', name: 'Em Progresso', color: '#8b5cf6', is_win_stage: false, is_loss_stage: false },
        { id: 'temp-3', name: 'Qualificado', color: '#10b981', is_win_stage: true, is_loss_stage: false },
        { id: 'temp-4', name: 'Perdido', color: '#ef4444', is_win_stage: false, is_loss_stage: true }
      ]);
    }
  }, [pipeline, defaultProjectId]);

  // Load account users when permissions tab is active
  useEffect(() => {
    if (activeTab === 'permissions' && accountUsers.length === 0) {
      loadAccountUsers();
    }
  }, [activeTab]);

  const loadPipeline = async (id) => {
    try {
      const response = await api.getPipeline(id);
      if (response.success) {
        const p = response.data.pipeline;
        setFormData({
          name: p.name || '',
          description: p.description || '',
          color: resolveColor(p.color),
          project_id: p.project_id || null,
          is_restricted: p.is_restricted || false
        });
        setStages(p.stages || []);
        setPipelineUsers(p.users || []);
      }
    } catch (err) {
      console.error('Erro ao carregar pipeline:', err);
    }
  };

  const loadAccountUsers = async () => {
    setLoadingUsers(true);
    try {
      const response = await api.getUsers();
      if (response.success) {
        setAccountUsers(response.data?.users || []);
      }
    } catch (err) {
      console.error('Erro ao carregar usuários:', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleAddUser = async () => {
    if (!selectedUserId || !pipeline?.id) return;

    setAddingUser(true);
    try {
      const response = await api.addPipelineUser(pipeline.id, selectedUserId, selectedRole);
      if (response.success) {
        // Reload pipeline to get updated users
        await loadPipeline(pipeline.id);
        setSelectedUserId('');
        setSelectedRole('member');
      }
    } catch (err) {
      console.error('Erro ao adicionar usuário:', err);
      setError(err.message || 'Erro ao adicionar usuário');
    } finally {
      setAddingUser(false);
    }
  };

  const handleRemoveUser = async (userId) => {
    if (!pipeline?.id) return;

    try {
      await api.removePipelineUser(pipeline.id, userId);
      // Reload pipeline to get updated users
      await loadPipeline(pipeline.id);
    } catch (err) {
      console.error('Erro ao remover usuário:', err);
      setError(err.message || 'Erro ao remover usuário');
    }
  };

  // Handle delete pipeline
  const handleDeletePipeline = async () => {
    if (!pipeline?.id) return;

    setDeleting(true);
    try {
      // First call without force to check if has opportunities
      const response = await api.deletePipeline(pipeline.id, false);

      if (response.success && response.data?.requires_confirmation) {
        // Has opportunities - show confirmation modal
        setDeleteInfo(response.data);
        setShowDeleteConfirm(true);
      } else if (response.success) {
        // Empty pipeline - deleted directly
        onSave(); // This will close and refresh
      }
    } catch (err) {
      console.error('Erro ao excluir pipeline:', err);
      setError(err.message || 'Erro ao excluir pipeline');
    } finally {
      setDeleting(false);
    }
  };

  const confirmDeletePipeline = async () => {
    if (!pipeline?.id) return;

    setDeleting(true);
    try {
      const response = await api.deletePipeline(pipeline.id, true);

      if (response.success) {
        onSave(); // This will close and refresh
      }
    } catch (err) {
      console.error('Erro ao excluir pipeline:', err);
      setError(err.message || 'Erro ao excluir pipeline');
    } finally {
      setShowDeleteConfirm(false);
      setDeleteInfo(null);
      setDeleting(false);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!formData.name.trim()) {
      setError('Nome da pipeline é obrigatório');
      return;
    }

    if (!formData.project_id) {
      setError('Selecione um projeto para a pipeline');
      return;
    }

    if (stages.length < 2) {
      setError('A pipeline precisa ter pelo menos 2 etapas');
      return;
    }

    try {
      setSaving(true);

      const payload = {
        ...formData,
        stages: stages.map((s, index) => ({
          ...s,
          position: index,
          // Remover IDs temporários
          id: s.id?.startsWith('temp-') ? undefined : s.id
        }))
      };

      let response;
      if (pipeline?.id) {
        response = await api.updatePipeline(pipeline.id, payload);
      } else {
        response = await api.createPipeline(payload);
      }

      if (response.success) {
        onSave();
      } else {
        setError(response.message || 'Erro ao salvar pipeline');
      }
    } catch (err) {
      setError(err.message || 'Erro ao salvar pipeline');
    } finally {
      setSaving(false);
    }
  };

  const handleDragEnd = (result) => {
    if (!result.destination) return;

    const items = Array.from(stages);
    const [reorderedItem] = items.splice(result.source.index, 1);
    items.splice(result.destination.index, 0, reorderedItem);

    setStages(items);
  };

  const addStage = () => {
    setStages([
      ...stages,
      {
        id: `temp-${Date.now()}`,
        name: `Nova Etapa ${stages.length + 1}`,
        color: '#64748b',
        is_win_stage: false,
        is_loss_stage: false
      }
    ]);
  };

  const updateStage = (index, field, value) => {
    const newStages = [...stages];
    newStages[index] = { ...newStages[index], [field]: value };

    // Se marcando como win, desmarcar outros wins
    if (field === 'is_win_stage' && value) {
      newStages.forEach((s, i) => {
        if (i !== index) s.is_win_stage = false;
      });
      newStages[index].is_loss_stage = false;
    }

    // Se marcando como loss, desmarcar outros losses
    if (field === 'is_loss_stage' && value) {
      newStages.forEach((s, i) => {
        if (i !== index) s.is_loss_stage = false;
      });
      newStages[index].is_win_stage = false;
    }

    setStages(newStages);
  };

  const removeStage = (index) => {
    if (stages.length <= 2) return;
    setStages(stages.filter((_, i) => i !== index));
  };

  // Filter out users that are already in the pipeline
  const availableUsers = accountUsers.filter(
    u => !pipelineUsers.some(pu => pu.user_id === u.id)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${resolveColor(formData.color)}20` }}
            >
              <Target className="w-5 h-5" style={{ color: resolveColor(formData.color) }} />
            </div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
              {isNew ? 'Nova Pipeline' : 'Configurações da Pipeline'}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => setActiveTab('general')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'general'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Geral
          </button>
          <button
            onClick={() => setActiveTab('stages')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === 'stages'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            Etapas ({stages.length})
          </button>
          <button
            onClick={() => setActiveTab('permissions')}
            className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'permissions'
                ? 'border-purple-600 text-purple-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400'
            }`}
          >
            <Users className="w-4 h-4" />
            Permissões
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {error && (
            <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
              {error}
            </div>
          )}

          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nome da Pipeline *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Pipeline de Vendas"
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Descrição
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descrição opcional..."
                  rows={2}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white resize-none"
                />
              </div>

              {/* Project */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Projeto *
                </label>
                <select
                  value={formData.project_id || ''}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value || null })}
                  className="w-full px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500"
                >
                  <option value="" disabled>Selecione um projeto</option>
                  {projects.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              {/* Color */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  Cor
                </label>
                <FullColorPicker
                  value={formData.color}
                  onChange={(color) => setFormData({ ...formData, color })}
                />
              </div>

              {/* Delete Pipeline Section - only when editing */}
              {!isNew && (
                <div className="pt-6 mt-6 border-t border-gray-200 dark:border-gray-700">
                  <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50 rounded-lg">
                    <div>
                      <p className="font-medium text-red-700 dark:text-red-400">Excluir Pipeline</p>
                      <p className="text-sm text-red-600/70 dark:text-red-400/70">
                        Excluir permanentemente esta pipeline e todas as oportunidades
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleDeletePipeline}
                      disabled={deleting}
                      className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                      {deleting ? (
                        <Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                      Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'stages' && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Arraste para reordenar as etapas. Defina uma etapa como "Ganho" e outra como "Perdido".
              </p>

              <DragDropContext onDragEnd={handleDragEnd}>
                <Droppable droppableId="stages">
                  {(provided) => (
                    <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-2">
                      {stages.map((stage, index) => (
                        <Draggable key={stage.id} draggableId={stage.id} index={index}>
                          {(provided, snapshot) => (
                            <div
                              ref={provided.innerRef}
                              {...provided.draggableProps}
                              className={`flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 ${
                                snapshot.isDragging ? 'shadow-lg' : ''
                              }`}
                            >
                              <div {...provided.dragHandleProps} className="cursor-grab">
                                <GripVertical className="w-4 h-4 text-gray-400" />
                              </div>

                              {/* Color picker */}
                              <ColorPicker
                                value={stage.color}
                                onChange={(color) => updateStage(index, 'color', color)}
                              />

                              {/* Name */}
                              <input
                                type="text"
                                value={stage.name}
                                onChange={(e) => updateStage(index, 'name', e.target.value)}
                                className="flex-1 px-3 py-1.5 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded text-sm dark:text-white"
                              />

                              {/* Win/Loss buttons */}
                              <button
                                type="button"
                                onClick={() => updateStage(index, 'is_win_stage', !stage.is_win_stage)}
                                className={`p-1.5 rounded transition-colors ${
                                  stage.is_win_stage
                                    ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400'
                                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                                title="Marcar como Ganho"
                              >
                                <Trophy className="w-4 h-4" />
                              </button>

                              <button
                                type="button"
                                onClick={() => updateStage(index, 'is_loss_stage', !stage.is_loss_stage)}
                                className={`p-1.5 rounded transition-colors ${
                                  stage.is_loss_stage
                                    ? 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
                                    : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-600'
                                }`}
                                title="Marcar como Perdido"
                              >
                                <XCircle className="w-4 h-4" />
                              </button>

                              {/* Delete */}
                              <button
                                type="button"
                                onClick={() => removeStage(index)}
                                disabled={stages.length <= 2}
                                className="p-1.5 text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed"
                                title="Remover etapa"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  )}
                </Droppable>
              </DragDropContext>

              <button
                type="button"
                onClick={addStage}
                className="flex items-center gap-2 px-4 py-2 text-sm text-purple-600 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded-lg transition-colors"
              >
                <Plus className="w-4 h-4" />
                Adicionar Etapa
              </button>
            </div>
          )}

          {activeTab === 'permissions' && (
            <div className="space-y-4">
              {/* Toggle de restricao */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Restringir acesso</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Apenas usuários selecionados terão acesso a esta pipeline
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_restricted}
                    onChange={(e) => setFormData({ ...formData, is_restricted: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-purple-300 dark:peer-focus:ring-purple-800 rounded-full peer dark:bg-gray-600 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-purple-600"></div>
                </label>
              </div>

              {/* Conteudo baseado na restricao */}
              {formData.is_restricted ? (
                <>
                  {/* Para pipelines novas: aviso */}
                  {isNew && (
                    <p className="text-sm text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
                      Após criar a pipeline, você poderá adicionar os usuários que terão acesso aqui.
                    </p>
                  )}

                  {/* Para pipelines existentes: gerenciamento de usuarios */}
                  {!isNew && (
                    <>
                      {/* Add user form */}
                      <div className="flex items-center gap-2 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                        <select
                          value={selectedUserId}
                          onChange={(e) => setSelectedUserId(e.target.value)}
                          className="flex-1 px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-sm dark:text-white"
                          disabled={loadingUsers}
                        >
                          <option value="">Selecione um usuário...</option>
                          {availableUsers.map(user => (
                            <option key={user.id} value={user.id}>{user.name} ({user.email})</option>
                          ))}
                        </select>

                        <select
                          value={selectedRole}
                          onChange={(e) => setSelectedRole(e.target.value)}
                          className="px-3 py-2 bg-white dark:bg-gray-600 border border-gray-200 dark:border-gray-500 rounded-lg text-sm dark:text-white"
                        >
                          <option value="member">Membro</option>
                          <option value="admin">Admin</option>
                        </select>

                        <button
                          onClick={handleAddUser}
                          disabled={!selectedUserId || addingUser}
                          className="flex items-center gap-2 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {addingUser ? (
                            <Loader className="w-4 h-4 animate-spin" />
                          ) : (
                            <UserPlus className="w-4 h-4" />
                          )}
                          Adicionar
                        </button>
                      </div>

                      {/* Users list */}
                      {loadingUsers ? (
                        <div className="flex items-center justify-center py-8">
                          <Loader className="w-6 h-6 animate-spin text-gray-400" />
                        </div>
                      ) : pipelineUsers.length === 0 ? (
                        <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                          <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                          <p>Nenhum usuário com acesso ainda.</p>
                          <p className="text-sm">Adicione usuários usando o formulário acima.</p>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {pipelineUsers.map(pu => {
                            const roleConfig = ROLE_LABELS[pu.role] || ROLE_LABELS.member;
                            const RoleIcon = roleConfig.icon;

                            return (
                              <div
                                key={pu.user_id}
                                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600"
                              >
                                <div className="flex items-center gap-3">
                                  {pu.avatar_url ? (
                                    <img
                                      src={pu.avatar_url}
                                      alt={pu.name}
                                      className="w-8 h-8 rounded-full object-cover"
                                    />
                                  ) : (
                                    <div className="w-8 h-8 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                                      <span className="text-sm font-medium text-purple-600 dark:text-purple-400">
                                        {pu.name?.charAt(0)}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <p className="font-medium text-gray-900 dark:text-white text-sm">{pu.name}</p>
                                    <p className="text-xs text-gray-500 dark:text-gray-400">{pu.email}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className={`flex items-center gap-1 text-xs font-medium ${roleConfig.color}`}>
                                    <RoleIcon className="w-3.5 h-3.5" />
                                    {roleConfig.label}
                                  </span>

                                  {pu.role !== 'owner' && (
                                    <button
                                      onClick={() => handleRemoveUser(pu.user_id)}
                                      className="p-1.5 text-gray-400 hover:text-red-500 rounded transition-colors"
                                      title="Remover acesso"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  )}
                </>
              ) : (
                <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                  <Users className="w-12 h-12 mx-auto mb-2 opacity-50" />
                  <p>Pipeline aberta</p>
                  <p className="text-sm">Todos os usuários da conta têm acesso a esta pipeline.</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-200 dark:border-gray-700">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="px-4 py-2 text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Salvando...' : isNew ? 'Criar Pipeline' : 'Salvar'}
          </button>
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-red-50 dark:bg-red-900/20">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                    Excluir Pipeline
                  </h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {formData.name}
                  </p>
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="px-6 py-4">
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Esta pipeline contém dados que serão excluídos permanentemente. Considere mover as oportunidades para outra pipeline antes de excluir.
              </p>

              {deleteInfo && (
                <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600 dark:text-gray-400">Oportunidades</span>
                    <span className="font-semibold text-gray-900 dark:text-white">{deleteInfo.opportunities_count}</span>
                  </div>
                </div>
              )}

              <p className="text-sm text-red-600 dark:text-red-400 mt-4 font-medium">
                Esta ação não pode ser desfeita.
              </p>
            </div>

            {/* Actions */}
            <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInfo(null);
                }}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeletePipeline}
                disabled={deleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader className="w-4 h-4 animate-spin" />
                    Excluindo...
                  </>
                ) : (
                  <>
                    <Trash2 className="w-4 h-4" />
                    Excluir Tudo
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PipelineSettingsModal;
