import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, GripVertical, CheckSquare, Clock, AlertCircle,
  Loader, RefreshCw, ChevronDown, ChevronUp, Save, X, Flag
} from 'lucide-react';
import api from '../services/api';

const PIPELINE_STAGES = [
  { value: 'leads', label: 'Prospecção', color: 'bg-gray-100 text-gray-700' },
  { value: 'qualifying', label: 'Qualificação', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'scheduled', label: 'Agendado', color: 'bg-blue-100 text-blue-700' },
  { value: 'proposal', label: 'Proposta', color: 'bg-purple-100 text-purple-700' },
  { value: 'negotiation', label: 'Negociação', color: 'bg-orange-100 text-orange-700' },
  { value: 'won', label: 'Ganho', color: 'bg-green-100 text-green-700' },
  { value: 'lost', label: 'Perdido', color: 'bg-red-100 text-red-700' }
];

const PRIORITIES = [
  { value: 'low', label: 'Baixa', color: 'text-green-600' },
  { value: 'medium', label: 'Média', color: 'text-yellow-600' },
  { value: 'high', label: 'Alta', color: 'text-orange-600' },
  { value: 'urgent', label: 'Urgente', color: 'text-red-600' }
];

const ChecklistTemplatesPage = () => {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expandedTemplate, setExpandedTemplate] = useState(null);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [editingItem, setEditingItem] = useState(null);
  const [newItemData, setNewItemData] = useState({ title: '', due_days: 0, priority: 'medium' });
  const [showNewItemForm, setShowNewItemForm] = useState(null);
  const [saving, setSaving] = useState(false);

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

  const handleOpenModal = (template = null) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        name: template.name,
        pipeline_stage: template.pipelineStage,
        is_active: template.isActive
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        name: '',
        pipeline_stage: '',
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
    if (!confirm('Tem certeza que deseja excluir este template?')) return;
    try {
      await api.deleteChecklistTemplate(templateId);
      await loadTemplates();
    } catch (error) {
      console.error('Error deleting template:', error);
      setError('Erro ao excluir template');
    }
  };

  const handleAddItem = async (templateId) => {
    if (!newItemData.title.trim()) return;

    setSaving(true);
    try {
      await api.addChecklistTemplateItem(templateId, newItemData);
      await loadTemplateDetails(templateId);
      setNewItemData({ title: '', due_days: 0, priority: 'medium' });
      setShowNewItemForm(null);
    } catch (error) {
      console.error('Error adding item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateItem = async (templateId, itemId, data) => {
    setSaving(true);
    try {
      await api.updateChecklistTemplateItem(templateId, itemId, data);
      await loadTemplateDetails(templateId);
      setEditingItem(null);
    } catch (error) {
      console.error('Error updating item:', error);
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteItem = async (templateId, itemId) => {
    if (!confirm('Tem certeza que deseja excluir este item?')) return;
    try {
      await api.deleteChecklistTemplateItem(templateId, itemId);
      await loadTemplateDetails(templateId);
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  const getStageConfig = (stage) => {
    return PIPELINE_STAGES.find(s => s.value === stage) || PIPELINE_STAGES[0];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Checklists por Etapa</h1>
          <p className="text-gray-500 text-sm mt-1">
            Configure atividades padrão para cada etapa do funil
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTemplates}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={() => handleOpenModal()}
            className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
          >
            <Plus className="w-4 h-4" />
            Novo Template
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
          <AlertCircle className="w-4 h-4" />
          {error}
          <button onClick={() => setError('')} className="ml-auto">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Templates by Stage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {PIPELINE_STAGES.map(stage => {
          const stageTemplates = templates.filter(t => t.pipelineStage === stage.value);
          const activeTemplate = stageTemplates.find(t => t.isActive);

          return (
            <div key={stage.value} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className={`p-3 ${stage.color}`}>
                <div className="flex items-center justify-between">
                  <h3 className="font-medium">{stage.label}</h3>
                  {activeTemplate ? (
                    <span className="text-xs bg-white/50 px-2 py-0.5 rounded-full">
                      {activeTemplate.itemCount || 0} itens
                    </span>
                  ) : (
                    <button
                      onClick={() => {
                        setFormData({ name: `Checklist - ${stage.label}`, pipeline_stage: stage.value, is_active: true });
                        setEditingTemplate(null);
                        setShowTemplateModal(true);
                      }}
                      className="text-xs bg-white/70 hover:bg-white px-2 py-0.5 rounded-full flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Criar
                    </button>
                  )}
                </div>
              </div>

              <div className="p-3">
                {!activeTemplate ? (
                  <p className="text-sm text-gray-400 text-center py-4">
                    Nenhum checklist ativo
                  </p>
                ) : (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-gray-700">{activeTemplate.name}</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => handleOpenModal(activeTemplate)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleToggleExpand(activeTemplate.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 rounded"
                        >
                          {expandedTemplate === activeTemplate.id ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : (
                            <ChevronDown className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Expanded Items */}
                    {expandedTemplate === activeTemplate.id && (
                      <div className="mt-3 space-y-2">
                        {activeTemplate.items?.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center gap-2 p-2 bg-gray-50 rounded-lg group"
                          >
                            <GripVertical className="w-4 h-4 text-gray-300" />
                            <CheckSquare className="w-4 h-4 text-gray-400" />
                            <div className="flex-1 min-w-0">
                              {editingItem === item.id ? (
                                <input
                                  type="text"
                                  defaultValue={item.title}
                                  className="w-full text-sm px-2 py-1 border rounded"
                                  onBlur={(e) => handleUpdateItem(activeTemplate.id, item.id, { title: e.target.value })}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') {
                                      handleUpdateItem(activeTemplate.id, item.id, { title: e.target.value });
                                    } else if (e.key === 'Escape') {
                                      setEditingItem(null);
                                    }
                                  }}
                                  autoFocus
                                />
                              ) : (
                                <span
                                  className="text-sm text-gray-700 cursor-pointer"
                                  onClick={() => setEditingItem(item.id)}
                                >
                                  {item.title}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-gray-500">
                              <Clock className="w-3 h-3" />
                              <span>+{item.dueDays}d</span>
                            </div>
                            <button
                              onClick={() => handleDeleteItem(activeTemplate.id, item.id)}
                              className="p-1 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        ))}

                        {/* Add New Item */}
                        {showNewItemForm === activeTemplate.id ? (
                          <div className="p-2 bg-purple-50 rounded-lg space-y-2">
                            <input
                              type="text"
                              value={newItemData.title}
                              onChange={(e) => setNewItemData(prev => ({ ...prev, title: e.target.value }))}
                              placeholder="Título da atividade"
                              className="w-full text-sm px-2 py-1 border border-purple-200 rounded"
                              autoFocus
                            />
                            <div className="flex items-center gap-2">
                              <div className="flex items-center gap-1 flex-1">
                                <Clock className="w-4 h-4 text-gray-400" />
                                <input
                                  type="number"
                                  value={newItemData.due_days}
                                  onChange={(e) => setNewItemData(prev => ({ ...prev, due_days: parseInt(e.target.value) || 0 }))}
                                  className="w-16 text-sm px-2 py-1 border rounded"
                                  min="0"
                                />
                                <span className="text-xs text-gray-500">dias</span>
                              </div>
                              <select
                                value={newItemData.priority}
                                onChange={(e) => setNewItemData(prev => ({ ...prev, priority: e.target.value }))}
                                className="text-sm px-2 py-1 border rounded"
                              >
                                {PRIORITIES.map(p => (
                                  <option key={p.value} value={p.value}>{p.label}</option>
                                ))}
                              </select>
                            </div>
                            <div className="flex justify-end gap-2">
                              <button
                                onClick={() => {
                                  setShowNewItemForm(null);
                                  setNewItemData({ title: '', due_days: 0, priority: 'medium' });
                                }}
                                className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => handleAddItem(activeTemplate.id)}
                                disabled={!newItemData.title.trim() || saving}
                                className="px-3 py-1 text-sm bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                              >
                                {saving ? <Loader className="w-4 h-4 animate-spin" /> : 'Adicionar'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setShowNewItemForm(activeTemplate.id)}
                            className="w-full p-2 text-sm text-gray-500 hover:text-purple-600 hover:bg-purple-50 rounded-lg border border-dashed border-gray-300 flex items-center justify-center gap-1"
                          >
                            <Plus className="w-4 h-4" />
                            Adicionar Item
                          </button>
                        )}
                      </div>
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
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
            <div className="flex items-center justify-between p-4 border-b">
              <h2 className="text-lg font-semibold">
                {editingTemplate ? 'Editar Template' : 'Novo Template'}
              </h2>
              <button
                onClick={() => setShowTemplateModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                  placeholder="Ex: Checklist de Qualificação"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Etapa do Funil</label>
                <select
                  value={formData.pipeline_stage}
                  onChange={(e) => setFormData(prev => ({ ...prev, pipeline_stage: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500"
                >
                  <option value="">Selecione...</option>
                  {PIPELINE_STAGES.map(stage => (
                    <option key={stage.value} value={stage.value}>{stage.label}</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData(prev => ({ ...prev, is_active: e.target.checked }))}
                  className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
                />
                <label htmlFor="is_active" className="text-sm text-gray-700">
                  Template ativo (será usado automaticamente)
                </label>
              </div>
            </div>

            <div className="flex justify-end gap-3 p-4 border-t">
              {editingTemplate && (
                <button
                  onClick={() => {
                    handleDeleteTemplate(editingTemplate.id);
                    setShowTemplateModal(false);
                  }}
                  className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg"
                >
                  Excluir
                </button>
              )}
              <button
                onClick={() => setShowTemplateModal(false)}
                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveTemplate}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 disabled:opacity-50 flex items-center gap-2"
              >
                {saving && <Loader className="w-4 h-4 animate-spin" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChecklistTemplatesPage;
