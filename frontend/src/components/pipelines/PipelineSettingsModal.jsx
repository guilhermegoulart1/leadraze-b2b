// frontend/src/components/pipelines/PipelineSettingsModal.jsx
import { useState, useEffect } from 'react';
import { DragDropContext, Droppable, Draggable } from '@hello-pangea/dnd';
import {
  X,
  Target,
  GripVertical,
  Plus,
  Trash2,
  Trophy,
  XCircle,
  ChevronRight
} from 'lucide-react';
import api from '../../services/api';

const COLORS = [
  { name: 'Cinza', value: 'slate' },
  { name: 'Azul', value: 'blue' },
  { name: 'Roxo', value: 'purple' },
  { name: 'Amarelo', value: 'amber' },
  { name: 'Laranja', value: 'orange' },
  { name: 'Verde', value: 'emerald' },
  { name: 'Vermelho', value: 'red' },
  { name: 'Rosa', value: 'pink' }
];

const COLOR_MAP = {
  slate: '#64748b',
  blue: '#3b82f6',
  purple: '#8b5cf6',
  amber: '#f59e0b',
  orange: '#f97316',
  emerald: '#10b981',
  red: '#ef4444',
  pink: '#ec4899'
};

const PipelineSettingsModal = ({ pipeline, projects, onClose, onSave }) => {
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

  const isNew = !pipeline?.id;

  useEffect(() => {
    if (pipeline?.id) {
      // Edição - carregar dados
      loadPipeline(pipeline.id);
    } else {
      // Criação
      setFormData({
        name: '',
        description: '',
        color: 'blue',
        project_id: pipeline?.project_id || null,
        is_restricted: false
      });
      setStages([
        { id: 'temp-1', name: 'Novos', color: 'slate', is_win_stage: false, is_loss_stage: false },
        { id: 'temp-2', name: 'Em Progresso', color: 'blue', is_win_stage: false, is_loss_stage: false },
        { id: 'temp-3', name: 'Qualificado', color: 'emerald', is_win_stage: true, is_loss_stage: false },
        { id: 'temp-4', name: 'Perdido', color: 'red', is_win_stage: false, is_loss_stage: true }
      ]);
    }
  }, [pipeline]);

  const loadPipeline = async (id) => {
    try {
      const response = await api.getPipeline(id);
      if (response.success) {
        const p = response.data.pipeline;
        setFormData({
          name: p.name || '',
          description: p.description || '',
          color: p.color || 'blue',
          project_id: p.project_id || null,
          is_restricted: p.is_restricted || false
        });
        setStages(p.stages || []);
      }
    } catch (err) {
      console.error('Erro ao carregar pipeline:', err);
    }
  };

  const handleSubmit = async () => {
    setError('');

    if (!formData.name.trim()) {
      setError('Nome da pipeline é obrigatório');
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
        color: 'slate',
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-lg flex items-center justify-center"
              style={{ backgroundColor: `${COLOR_MAP[formData.color] || formData.color}20` }}
            >
              <Target className="w-5 h-5" style={{ color: COLOR_MAP[formData.color] || formData.color }} />
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
                  Projeto
                </label>
                <select
                  value={formData.project_id || ''}
                  onChange={(e) => setFormData({ ...formData, project_id: e.target.value || null })}
                  className="w-full px-4 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
                >
                  <option value="">Sem projeto</option>
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
                <div className="flex flex-wrap gap-2">
                  {COLORS.map(color => (
                    <button
                      key={color.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, color: color.value })}
                      className={`w-8 h-8 rounded-full border-2 transition-all ${
                        formData.color === color.value
                          ? 'border-gray-900 dark:border-white scale-110'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: COLOR_MAP[color.value] }}
                      title={color.name}
                    />
                  ))}
                </div>
              </div>

              {/* Restricted */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">Pipeline Restrita</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Apenas usuários selecionados terão acesso
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
                              <div className="relative">
                                <div
                                  className="w-6 h-6 rounded cursor-pointer"
                                  style={{ backgroundColor: COLOR_MAP[stage.color] || '#64748b' }}
                                />
                                <select
                                  value={stage.color}
                                  onChange={(e) => updateStage(index, 'color', e.target.value)}
                                  className="absolute inset-0 opacity-0 cursor-pointer"
                                >
                                  {COLORS.map(c => (
                                    <option key={c.value} value={c.value}>{c.name}</option>
                                  ))}
                                </select>
                              </div>

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
    </div>
  );
};

export default PipelineSettingsModal;
