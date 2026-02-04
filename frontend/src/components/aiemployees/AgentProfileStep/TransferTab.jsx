import React, { useState, useEffect, useCallback } from 'react';
import {
  ArrowRightLeft, Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Power, PowerOff, Info, Building2, VolumeX, Volume2, Bell, Search,
  MessageSquare, Brain, Heart, AlertTriangle, Loader2, Tag,
  Zap, Link, UserCog, StickyNote, X, HelpCircle
} from 'lucide-react';
import api from '../../../services/api';
import SectorSelector from '../../SectorSelector';
import TransferDestinationSelector from '../../TransferDestinationSelector';

/**
 * Trigger type definitions for the UI
 */
const TRIGGER_TYPES = [
  { id: 'keyword', label: 'Palavra-chave', icon: Search, color: 'blue',
    description: 'Disparar quando o lead mencionar palavras especificas' },
  { id: 'preset', label: 'Preset', icon: Tag, color: 'green',
    description: 'Usar gatilho predefinido (duvida, preco, demo, etc.)' },
  { id: 'exchange_limit', label: 'Limite de Trocas', icon: MessageSquare, color: 'amber',
    description: 'Transferir apos N interacoes' },
  { id: 'ai_detected', label: 'Detectado pela IA', icon: Brain, color: 'purple',
    description: 'A IA avalia uma condicao personalizada' },
  { id: 'sentiment', label: 'Sentimento', icon: Heart, color: 'pink',
    description: 'Detectar sentimentos especificos do lead' }
];

const ACTION_TYPES = [
  { id: 'add_tag', label: 'Adicionar Tag', icon: Tag, color: 'green' },
  { id: 'remove_tag', label: 'Remover Tag', icon: Tag, color: 'red' },
  { id: 'add_note', label: 'Nota Interna', icon: StickyNote, color: 'amber' },
  { id: 'update_contact', label: 'Atualizar Contato', icon: UserCog, color: 'blue' },
  { id: 'send_webhook', label: 'Webhook', icon: Link, color: 'purple' }
];

const CONTACT_FIELDS = [
  { id: 'company', label: 'Empresa' },
  { id: 'role', label: 'Cargo' },
  { id: 'phone', label: 'Telefone' },
  { id: 'email', label: 'Email' }
];

const SENTIMENT_OPTIONS = [
  { id: 'frustration', label: 'Frustracao' },
  { id: 'confusion', label: 'Confusao' },
  { id: 'high_interest', label: 'Alto Interesse' },
  { id: 'urgency', label: 'Urgencia' }
];

/**
 * TransferTab
 * Aba de configuracao de regras de transferencia para AI Employees
 */
const TransferTab = ({ agentId, profile, onProfileChange }) => {
  const [rules, setRules] = useState([]);
  const [defaultConfig, setDefaultConfig] = useState({});
  const [presets, setPresets] = useState({});
  const [tags, setTags] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [expandedRules, setExpandedRules] = useState(new Set());
  const [draggedIndex, setDraggedIndex] = useState(null);

  // Load presets and tags on mount (static data, no agentId needed)
  useEffect(() => {
    loadPresets();
    loadTags();
  }, []);

  // Load rules when agentId is available
  useEffect(() => {
    if (agentId) {
      loadRules();
    } else {
      setLoading(false);
    }
  }, [agentId]);

  const loadPresets = async () => {
    try {
      const presetsRes = await api.getTransferPresets();
      if (presetsRes.success) {
        setPresets(presetsRes.data.presets || {});
      }
    } catch (err) {
      console.error('Error loading transfer presets:', err);
    }
  };

  const loadTags = async () => {
    try {
      const tagsRes = await api.getTags();
      if (tagsRes.success) {
        setTags(tagsRes.data.tags || []);
      }
    } catch (err) {
      console.error('Error loading tags:', err);
    }
  };

  const loadRules = async () => {
    try {
      setLoading(true);
      const rulesRes = await api.getTransferRules(agentId);
      if (rulesRes.success) {
        setRules(rulesRes.data.rules || []);
        setDefaultConfig(rulesRes.data.defaultConfig || {});
      }
    } catch (err) {
      console.error('Error loading transfer rules:', err);
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // Default Config Handlers
  // ==========================================

  const handleDefaultConfigChange = useCallback(async (field, value) => {
    const newConfig = { ...defaultConfig, [field]: value };
    setDefaultConfig(newConfig);

    if (agentId) {
      try {
        await api.updateDefaultTransferConfig(agentId, newConfig);
      } catch (err) {
        console.error('Error saving default config:', err);
      }
    }
  }, [defaultConfig, agentId]);

  // ==========================================
  // Rule CRUD Handlers
  // ==========================================

  const handleAddRule = async () => {
    const newRule = {
      name: `Regra ${rules.length + 1}`,
      trigger_type: 'keyword',
      trigger_config: { keywords: [] },
      destination_type: 'default',
      destination_config: {},
      transfer_mode: 'notify',
      transfer_message: '',
      notify_on_handoff: true,
      is_active: true
    };

    if (agentId) {
      try {
        setSaving(true);
        const res = await api.createTransferRule(agentId, newRule);
        if (res.success) {
          setRules([...rules, res.data.rule]);
          setExpandedRules(new Set([...expandedRules, res.data.rule.id]));
        }
      } catch (err) {
        console.error('Error creating rule:', err);
      } finally {
        setSaving(false);
      }
    } else {
      // Pre-creation mode: store locally
      const tempRule = { ...newRule, id: `temp_${Date.now()}`, _isLocal: true };
      setRules([...rules, tempRule]);
      setExpandedRules(new Set([...expandedRules, tempRule.id]));
    }
  };

  const handleUpdateRule = async (ruleId, updates) => {
    // Update locally first (functional update to avoid stale closure)
    setRules(prev => prev.map(r => r.id === ruleId ? { ...r, ...updates } : r));

    if (agentId && !ruleId.startsWith('temp_')) {
      try {
        await api.updateTransferRule(agentId, ruleId, updates);
      } catch (err) {
        console.error('Error updating rule:', err);
      }
    }
  };

  const handleDeleteRule = async (ruleId) => {
    setRules(prev => prev.filter(r => r.id !== ruleId));

    if (agentId && !ruleId.startsWith('temp_')) {
      try {
        await api.deleteTransferRule(agentId, ruleId);
      } catch (err) {
        console.error('Error deleting rule:', err);
      }
    }
  };

  const handleToggleRule = async (ruleId) => {
    const rule = rules.find(r => r.id === ruleId);
    if (rule) {
      await handleUpdateRule(ruleId, { is_active: !rule.is_active });
    }
  };

  // ==========================================
  // Drag & Drop Reorder
  // ==========================================

  const handleDragStart = (index) => {
    setDraggedIndex(index);
  };

  const handleDragOver = (e, index) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === index) return;

    const newRules = [...rules];
    const draggedRule = newRules.splice(draggedIndex, 1)[0];
    newRules.splice(index, 0, draggedRule);
    setRules(newRules);
    setDraggedIndex(index);
  };

  const handleDragEnd = async () => {
    setDraggedIndex(null);
    if (agentId) {
      const ruleIds = rules.filter(r => !r.id.startsWith('temp_')).map(r => r.id);
      try {
        await api.reorderTransferRules(agentId, ruleIds);
      } catch (err) {
        console.error('Error reordering rules:', err);
      }
    }
  };

  // ==========================================
  // Expand/Collapse
  // ==========================================

  const toggleExpand = (ruleId) => {
    const newExpanded = new Set(expandedRules);
    if (newExpanded.has(ruleId)) {
      newExpanded.delete(ruleId);
    } else {
      newExpanded.add(ruleId);
    }
    setExpandedRules(newExpanded);
  };

  // ==========================================
  // Render
  // ==========================================

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-5 h-5 animate-spin text-gray-400 mr-2" />
        <span className="text-sm text-gray-500 dark:text-gray-400">Carregando regras...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Section A: Default Transfer Destination */}
      <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
            <ArrowRightLeft className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Destino Padrao
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              Fallback quando uma regra nao tem destino especifico
            </p>
          </div>
        </div>

        <div className="space-y-3 ml-10">
          {/* Default Sector */}
          <SectorSelector
            value={defaultConfig.sector_id}
            onChange={(value) => handleDefaultConfigChange('sector_id', value)}
            required={false}
          />

          {/* Default Transfer Mode */}
          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={defaultConfig.transfer_mode !== 'silent'}
                onChange={() => handleDefaultConfigChange('transfer_mode', 'notify')}
                className="w-3.5 h-3.5 text-purple-600"
              />
              <Volume2 className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-700 dark:text-gray-300">Com Mensagem</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                checked={defaultConfig.transfer_mode === 'silent'}
                onChange={() => handleDefaultConfigChange('transfer_mode', 'silent')}
                className="w-3.5 h-3.5 text-purple-600"
              />
              <VolumeX className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-700 dark:text-gray-300">Silenciosa</span>
            </label>
          </div>

          {/* Default Transfer Message */}
          {defaultConfig.transfer_mode !== 'silent' && (
            <div>
              <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                Mensagem Padrao
              </label>
              <textarea
                value={defaultConfig.transfer_message || ''}
                onChange={(e) => handleDefaultConfigChange('transfer_message', e.target.value)}
                placeholder="Ex: Vou transferir voce para um de nossos especialistas..."
                rows={2}
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            </div>
          )}

          {/* Notification toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={defaultConfig.notify_on_handoff !== false}
              onChange={(e) => handleDefaultConfigChange('notify_on_handoff', e.target.checked)}
              className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300"
            />
            <Bell className="w-3 h-3 text-gray-400" />
            <span className="text-xs text-gray-700 dark:text-gray-300">Notificar atendente</span>
          </label>
        </div>
      </div>

      {/* Section B: Transfer Rules List */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-medium text-gray-900 dark:text-white">
              Regras de Transferencia
            </h3>
            <span className="px-1.5 py-0.5 text-xs rounded-full font-medium bg-gray-200 text-gray-600 dark:bg-gray-600 dark:text-gray-300">
              {rules.length}
            </span>
          </div>
          <button
            onClick={handleAddRule}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 text-sm font-medium bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus className="w-4 h-4" />
            Nova Regra
          </button>
        </div>

        {rules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center mb-4">
              <ArrowRightLeft className="w-6 h-6 text-gray-400 dark:text-gray-500" />
            </div>
            <h3 className="text-sm font-medium text-gray-900 dark:text-white mb-1">
              Nenhuma regra configurada
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 max-w-xs">
              Adicione regras para que a IA transfira para humanos automaticamente
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {rules.map((rule, index) => (
              <RuleCard
                key={rule.id}
                rule={rule}
                index={index}
                isExpanded={expandedRules.has(rule.id)}
                presets={presets}
                tags={tags}
                onToggleExpand={() => toggleExpand(rule.id)}
                onUpdate={(updates) => handleUpdateRule(rule.id, updates)}
                onDelete={() => handleDeleteRule(rule.id)}
                onToggle={() => handleToggleRule(rule.id)}
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                isDragged={draggedIndex === index}
              />
            ))}
          </div>
        )}
      </div>

      {/* Section C: Info Box */}
      <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-400 dark:text-gray-500 mt-0.5 flex-shrink-0" />
          <div>
            <p className="text-xs text-gray-700 dark:text-gray-300 font-medium">
              Regras Globais vs Workflow
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Transferencias no workflow (nos de acao) sao especificas por etapa e tem prioridade.
              Regras globais sao avaliadas em <strong>toda mensagem</strong> e podem disparar a qualquer momento da conversa.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

// ==========================================
// ActionsSection Component
// ==========================================

const ActionsSection = ({ actions, tags, onChange }) => {
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [webhookInfoIdx, setWebhookInfoIdx] = useState(null);

  const addAction = (type) => {
    const defaultConfigs = {
      add_tag: { tag_id: '', tag_name: '' },
      remove_tag: { tag_id: '' },
      add_note: { note: '' },
      update_contact: { field: 'company', value: '' },
      send_webhook: { url: '' }
    };
    onChange([...actions, { type, config: defaultConfigs[type] || {} }]);
    setShowAddMenu(false);
  };

  const updateAction = (index, config) => {
    const updated = actions.map((a, i) => i === index ? { ...a, config: { ...a.config, ...config } } : a);
    onChange(updated);
  };

  const removeAction = (index) => {
    onChange(actions.filter((_, i) => i !== index));
  };

  return (
    <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
      <div className="flex items-center justify-between mb-2">
        <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 dark:text-gray-400">
          <Zap className="w-3 h-3" />
          Acoes na Transferencia
        </label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setShowAddMenu(!showAddMenu)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
          >
            <Plus className="w-3 h-3" />
            Acao
          </button>
          {showAddMenu && (
            <div className="absolute right-0 top-full mt-1 w-48 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 py-1 z-50">
              {ACTION_TYPES.map(at => {
                const Icon = at.icon;
                return (
                  <button
                    key={at.id}
                    type="button"
                    onClick={() => addAction(at.id)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-gray-400" />
                    {at.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {actions.length === 0 ? (
        <p className="text-xs text-gray-400 dark:text-gray-500 italic">
          Nenhuma acao configurada
        </p>
      ) : (
        <div className="space-y-2">
          {actions.map((action, idx) => {
            const actionType = ACTION_TYPES.find(a => a.id === action.type);
            const Icon = actionType?.icon || Zap;
            return (
              <div
                key={idx}
                className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700"
              >
                <div className="flex-shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-gray-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-medium text-gray-500 dark:text-gray-400 block mb-1">
                    {actionType?.label || action.type}
                  </span>

                  {/* Tag selector */}
                  {(action.type === 'add_tag' || action.type === 'remove_tag') && (
                    <select
                      value={action.config?.tag_id || ''}
                      onChange={(e) => {
                        const tag = tags.find(t => t.id === e.target.value);
                        updateAction(idx, { tag_id: e.target.value, tag_name: tag?.name || '' });
                      }}
                      className="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-400 dark:text-white"
                    >
                      <option value="">Selecionar tag...</option>
                      {tags.map(tag => (
                        <option key={tag.id} value={tag.id}>{tag.name}</option>
                      ))}
                    </select>
                  )}

                  {/* Note textarea */}
                  {action.type === 'add_note' && (
                    <div>
                      <textarea
                        value={action.config?.note || ''}
                        onChange={(e) => updateAction(idx, { note: e.target.value })}
                        placeholder="Texto da nota... (use {{contact_name}}, {{agent_name}}, {{rule_name}})"
                        rows={2}
                        className="w-full px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md resize-none focus:ring-1 focus:ring-purple-400 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                  )}

                  {/* Contact field update */}
                  {action.type === 'update_contact' && (
                    <div className="flex gap-1.5">
                      <select
                        value={action.config?.field || 'company'}
                        onChange={(e) => updateAction(idx, { field: e.target.value })}
                        className="w-28 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-400 dark:text-white"
                      >
                        {CONTACT_FIELDS.map(f => (
                          <option key={f.id} value={f.id}>{f.label}</option>
                        ))}
                      </select>
                      <input
                        type="text"
                        value={action.config?.value || ''}
                        onChange={(e) => updateAction(idx, { value: e.target.value })}
                        placeholder="Valor..."
                        className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-400 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                      />
                    </div>
                  )}

                  {/* Webhook URL */}
                  {action.type === 'send_webhook' && (
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1">
                        <input
                          type="url"
                          value={action.config?.url || ''}
                          onChange={(e) => updateAction(idx, { url: e.target.value })}
                          placeholder="https://..."
                          className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-md focus:ring-1 focus:ring-purple-400 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                        />
                        <button
                          type="button"
                          onClick={() => setWebhookInfoIdx(webhookInfoIdx === idx ? null : idx)}
                          className="flex-shrink-0 p-1 text-gray-400 hover:text-purple-500 transition-colors"
                          title="Ver estrutura do payload"
                        >
                          <HelpCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                      {webhookInfoIdx === idx && (
                        <div className="p-2.5 bg-gray-900 dark:bg-black rounded-md border border-gray-700">
                          <p className="text-[10px] font-medium text-gray-300 mb-1.5">Payload enviado (POST):</p>
                          <pre className="text-[10px] leading-relaxed text-green-400 font-mono whitespace-pre overflow-x-auto">{`{
  "event": "transfer_triggered",
  "rule": {
    "id": "uuid",
    "name": "Nome da regra",
    "trigger_type": "keyword"
  },
  "conversation_id": "uuid",
  "contact": {
    "id": "uuid",
    "name": "Nome do contato"
  },
  "agent": {
    "id": "uuid",
    "name": "Nome do agente"
  },
  "timestamp": "2026-02-04T12:00:00Z"
}`}</pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeAction(idx)}
                  className="flex-shrink-0 p-1 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ==========================================
// RuleCard Component
// ==========================================

const RuleCard = ({
  rule, index, isExpanded, presets, tags,
  onToggleExpand, onUpdate, onDelete, onToggle,
  onDragStart, onDragOver, onDragEnd, isDragged
}) => {
  const triggerType = TRIGGER_TYPES.find(t => t.id === rule.trigger_type) || TRIGGER_TYPES[0];
  const TriggerIcon = triggerType.icon;

  const [keywordInput, setKeywordInput] = useState('');

  const handleKeywordAdd = () => {
    if (!keywordInput.trim()) return;
    const keywords = rule.trigger_config?.keywords || [];
    if (!keywords.includes(keywordInput.trim().toLowerCase())) {
      onUpdate({
        trigger_config: {
          ...rule.trigger_config,
          keywords: [...keywords, keywordInput.trim().toLowerCase()]
        }
      });
    }
    setKeywordInput('');
  };

  const handleKeywordRemove = (keyword) => {
    const keywords = (rule.trigger_config?.keywords || []).filter(k => k !== keyword);
    onUpdate({ trigger_config: { ...rule.trigger_config, keywords } });
  };

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragEnd={onDragEnd}
      className={`bg-white dark:bg-gray-800 rounded-lg border overflow-hidden transition-all shadow-sm ${
        isDragged ? 'opacity-50 ring-2 ring-purple-400' : ''
      } ${
        rule.is_active
          ? 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
          : 'border-gray-200 dark:border-gray-700 opacity-60'
      }`}
    >
      {/* Collapsed Header */}
      <div
        className="flex items-center gap-2 px-3 py-2.5 cursor-pointer"
        onClick={onToggleExpand}
      >
        <GripVertical className="w-3.5 h-3.5 text-gray-300 dark:text-gray-600 cursor-grab flex-shrink-0" />

        <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 w-5">
          {index + 1}
        </span>

        <div className={`w-7 h-7 rounded-lg flex items-center justify-center bg-${triggerType.color}-100 dark:bg-${triggerType.color}-900/30`}>
          <TriggerIcon className={`w-3.5 h-3.5 text-${triggerType.color}-600 dark:text-${triggerType.color}-400`} />
        </div>

        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={rule.name}
            onChange={(e) => {
              e.stopPropagation();
              onUpdate({ name: e.target.value });
            }}
            onClick={(e) => e.stopPropagation()}
            className="text-sm font-medium text-gray-900 dark:text-white bg-transparent border-none focus:outline-none focus:ring-0 p-0 w-full"
            placeholder="Nome da regra"
          />
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {triggerType.label}
            {rule.trigger_type === 'keyword' && rule.trigger_config?.keywords?.length > 0 &&
              ` (${rule.trigger_config.keywords.length} palavras)`
            }
            {rule.trigger_type === 'preset' && rule.trigger_config?.preset_id &&
              ` - ${presets[rule.trigger_config.preset_id]?.label || rule.trigger_config.preset_id}`
            }
            {rule.trigger_type === 'exchange_limit' &&
              ` - ${rule.trigger_config?.limit || 0} interacoes`
            }
          </p>
        </div>

        <button
          onClick={(e) => { e.stopPropagation(); onToggle(); }}
          className={`p-1.5 rounded transition-colors ${
            rule.is_active
              ? 'text-green-600 dark:text-green-500 hover:bg-gray-100 dark:hover:bg-gray-700'
              : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
          title={rule.is_active ? 'Ativa' : 'Inativa'}
        >
          {rule.is_active ? <Power className="w-3.5 h-3.5" /> : <PowerOff className="w-3.5 h-3.5" />}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-1.5 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-gray-400" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-gray-400" />
        )}
      </div>

      {/* Expanded Content */}
      {isExpanded && (
        <div className="px-3 pb-3 space-y-3 border-t border-gray-200 dark:border-gray-700 pt-3">
          {/* Trigger Type Selector */}
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
              Tipo de Gatilho
            </label>
            <select
              value={rule.trigger_type}
              onChange={(e) => onUpdate({
                trigger_type: e.target.value,
                trigger_config: e.target.value === 'keyword' ? { keywords: [] }
                  : e.target.value === 'preset' ? { preset_id: '' }
                  : e.target.value === 'exchange_limit' ? { limit: 3 }
                  : e.target.value === 'ai_detected' ? { prompt: '' }
                  : e.target.value === 'sentiment' ? { sentiments: [] }
                  : {}
              })}
              className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 dark:text-white"
            >
              {TRIGGER_TYPES.map(t => (
                <option key={t.id} value={t.id}>{t.label} - {t.description}</option>
              ))}
            </select>
          </div>

          {/* Trigger Config based on type */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
            {rule.trigger_type === 'keyword' && (
              <div className="space-y-2">
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400">
                  Palavras-chave
                </label>
                <div className="flex gap-1.5">
                  <input
                    type="text"
                    value={keywordInput}
                    onChange={(e) => setKeywordInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleKeywordAdd(); } }}
                    placeholder="Digite e pressione Enter..."
                    className="flex-1 px-3 py-2 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                  />
                  <button
                    onClick={handleKeywordAdd}
                    className="px-3 py-2 text-sm font-medium bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                {(rule.trigger_config?.keywords || []).length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {(rule.trigger_config?.keywords || []).map(kw => (
                      <span
                        key={kw}
                        className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full"
                      >
                        {kw}
                        <button
                          onClick={() => handleKeywordRemove(kw)}
                          className="hover:text-red-500"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {rule.trigger_type === 'preset' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Selecionar Preset
                </label>
                <select
                  value={rule.trigger_config?.preset_id || ''}
                  onChange={(e) => onUpdate({
                    trigger_config: { preset_id: e.target.value }
                  })}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 dark:text-white"
                >
                  <option value="">Selecione...</option>
                  {Object.entries(presets).map(([id, preset]) => (
                    <option key={id} value={id}>
                      {preset.label} - {preset.description}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {rule.trigger_type === 'exchange_limit' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Transferir apos quantas interacoes?
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min="1"
                    max="50"
                    value={rule.trigger_config?.limit || 3}
                    onChange={(e) => onUpdate({
                      trigger_config: { limit: parseInt(e.target.value) || 1 }
                    })}
                    className="w-20 px-3 py-2 text-sm text-center bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 dark:text-white"
                  />
                  <span className="text-xs text-gray-500 dark:text-gray-400">interacao(oes)</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  1 interacao = mensagem do lead + resposta da IA
                </p>
              </div>
            )}

            {rule.trigger_type === 'ai_detected' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Descreva a situacao para a IA detectar
                </label>
                <textarea
                  value={rule.trigger_config?.prompt || ''}
                  onChange={(e) => onUpdate({
                    trigger_config: { prompt: e.target.value }
                  })}
                  placeholder="Ex: Quando o lead mencionar que esta avaliando concorrentes e parecer pronto para tomar uma decisao de compra"
                  rows={3}
                  className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
                />
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                  A IA vai analisar cada mensagem e sinalizar quando detectar esta situacao
                </p>
              </div>
            )}

            {rule.trigger_type === 'sentiment' && (
              <div>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1.5">
                  Sentimentos que disparam transferencia
                </label>
                <div className="space-y-1">
                  {SENTIMENT_OPTIONS.map(s => (
                    <label key={s.id} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={(rule.trigger_config?.sentiments || []).includes(s.id)}
                        onChange={(e) => {
                          const current = rule.trigger_config?.sentiments || [];
                          const updated = e.target.checked
                            ? [...current, s.id]
                            : current.filter(x => x !== s.id);
                          onUpdate({ trigger_config: { sentiments: updated } });
                        }}
                        className="w-3.5 h-3.5 text-purple-600 rounded border-gray-300"
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{s.label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Destination */}
          <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-100 dark:border-gray-700">
            <TransferDestinationSelector
              destinationType={rule.destination_type || 'default'}
              destinationConfig={rule.destination_config || {}}
              onChangeType={(type) => onUpdate({ destination_type: type })}
              onChangeConfig={(config) => onUpdate({ destination_config: config })}
              showDefaultOption={true}
              compact={true}
            />
          </div>

          {/* Actions on transfer */}
          <ActionsSection
            actions={rule.actions || []}
            tags={tags}
            onChange={(actions) => onUpdate({ actions })}
          />

          {/* Transfer mode for this rule */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={rule.transfer_mode !== 'silent'}
                  onChange={() => onUpdate({ transfer_mode: 'notify' })}
                  className="w-3 h-3 text-purple-600"
                />
                <Volume2 className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-700 dark:text-gray-300">Com Mensagem</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={rule.transfer_mode === 'silent'}
                  onChange={() => onUpdate({ transfer_mode: 'silent' })}
                  className="w-3 h-3 text-purple-600"
                />
                <VolumeX className="w-3 h-3 text-gray-400" />
                <span className="text-xs text-gray-700 dark:text-gray-300">Silenciosa</span>
              </label>
            </div>

            {rule.transfer_mode !== 'silent' && (
              <textarea
                value={rule.transfer_message || ''}
                onChange={(e) => onUpdate({ transfer_message: e.target.value })}
                placeholder="Mensagem para o lead (ou deixe vazio para usar o padrao)"
                rows={2}
                className="w-full px-3 py-2.5 text-sm bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg resize-none focus:ring-2 focus:ring-gray-400 focus:border-gray-400 dark:focus:ring-gray-500 dark:focus:border-gray-500 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500"
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default TransferTab;
