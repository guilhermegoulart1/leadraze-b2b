// frontend/src/components/aiemployees/WorkflowBuilder/PropertiesPanel.jsx
// Panel for editing node properties

import React, { useState, useEffect } from 'react';
import { X, Trash2, Plus, MessageCircle, Target, Clock, Zap, GitBranch, PhoneCall, Send, Mail, User, Users, Building2, RefreshCw, Tag, MinusCircle, RotateCcw, DollarSign, ArrowRightCircle, Filter, Globe, Play, Loader2, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import api from '../../../services/api';
import VariableTextarea from './inputs/VariableTextarea';
import VariableInput from './inputs/VariableInput';

// Cores pré-definidas para tags (mesmo do TagsPage)
const PRESET_COLORS = [
  { name: 'Roxo', hex: '#9333ea' },
  { name: 'Azul', hex: '#2563eb' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Amarelo', hex: '#ca8a04' },
  { name: 'Vermelho', hex: '#dc2626' },
  { name: 'Rosa', hex: '#db2777' },
  { name: 'Laranja', hex: '#ea580c' },
  { name: 'Ciano', hex: '#0891b2' },
];

// Função para gerar estilos de tag a partir de cor hex
const getTagStyles = (hexColor) => {
  const colorMap = {
    purple: '#9333ea',
    blue: '#2563eb',
    green: '#16a34a',
    yellow: '#ca8a04',
    red: '#dc2626',
    pink: '#db2777',
    orange: '#ea580c',
    gray: '#6b7280',
  };

  const hex = colorMap[hexColor] || hexColor || '#9333ea';

  // Criar cor de fundo com 15% de opacidade
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    color: hex,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
  };
};

// Variables are now handled by VariablePicker component
// See: frontend/src/constants/workflowVariables.js for definitions

// All possible trigger events grouped by channel
const TRIGGER_EVENTS = {
  // LinkedIn
  invite_sent: { label: 'Convite Enviado', channel: 'linkedin' },
  invite_accepted: { label: 'Convite Aceito', channel: 'linkedin' },
  invite_ignored: { label: 'Convite Ignorado', channel: 'linkedin' },
  message_received: { label: 'Mensagem Recebida', channel: 'all' },
  profile_viewed: { label: 'Perfil Visualizado', channel: 'linkedin' },
  post_engagement: { label: 'Engajamento no Post', channel: 'linkedin' },
  inmail_received: { label: 'InMail Recebido', channel: 'linkedin' },
  no_response: { label: 'Sem Resposta', channel: 'all' },
  // WhatsApp
  first_contact: { label: 'Primeiro Contato', channel: 'whatsapp' },
  media_received: { label: 'Midia Recebida', channel: 'whatsapp' },
  button_clicked: { label: 'Botao Clicado', channel: 'whatsapp' },
  list_selected: { label: 'Lista Selecionada', channel: 'whatsapp' },
  // Email
  email_sent: { label: 'Email Enviado', channel: 'email' },
  email_opened: { label: 'Email Aberto', channel: 'email' },
  email_clicked: { label: 'Link Clicado', channel: 'email' },
  email_replied: { label: 'Email Respondido', channel: 'email' },
  email_bounced: { label: 'Email Rejeitado', channel: 'email' },
  // WebChat
  chat_started: { label: 'Chat Iniciado', channel: 'webchat' },
  page_visited: { label: 'Pagina Visitada', channel: 'webchat' },
  time_on_page: { label: 'Tempo na Pagina', channel: 'webchat' },
  exit_intent: { label: 'Intencao de Saida', channel: 'webchat' }
};

const PropertiesPanel = ({ node, onUpdate, onDelete, onClose, onOpenHttpModal }) => {
  const [localData, setLocalData] = useState(node.data);

  // State for transfer configuration
  const [users, setUsers] = useState([]);
  const [sectors, setSectors] = useState([]);
  const [sectorUsers, setSectorUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [loadingSectors, setLoadingSectors] = useState(false);

  // State for tags
  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showNewTagInput, setShowNewTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('#9333ea');

  // State for follow-up flows
  const [followUpFlows, setFollowUpFlows] = useState([]);
  const [loadingFollowUpFlows, setLoadingFollowUpFlows] = useState(false);

  // State for pipelines (create_opportunity action)
  const [pipelines, setPipelines] = useState([]);
  const [pipelineStages, setPipelineStages] = useState([]);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [loadingStages, setLoadingStages] = useState(false);

  useEffect(() => {
    setLocalData(node.data);
  }, [node]);

  // Load users and sectors when transfer action is selected
  useEffect(() => {
    if (node.type === 'action' && (localData.actionType === 'transfer' || localData.actionType === 'create_opportunity')) {
      loadUsersAndSectors();
    }
  }, [node.type, localData.actionType]);

  // Load tags when add_tag or remove_tag action is selected
  useEffect(() => {
    if (node.type === 'action' && (localData.actionType === 'add_tag' || localData.actionType === 'remove_tag')) {
      loadTags();
    }
  }, [node.type, localData.actionType]);

  // Load follow-up flows when conversationStep is selected
  useEffect(() => {
    if (node.type === 'conversationStep') {
      loadFollowUpFlows();
    }
  }, [node.type]);

  // Load pipelines when create_opportunity or move_stage action is selected
  useEffect(() => {
    if (node.type === 'action' && (localData.actionType === 'create_opportunity' || localData.actionType === 'move_stage')) {
      loadPipelines();
    }
  }, [node.type, localData.actionType]);

  // Load stages when pipeline is selected
  useEffect(() => {
    if ((localData.actionType === 'create_opportunity' || localData.actionType === 'move_stage') && localData.params?.pipelineId) {
      loadPipelineStages(localData.params.pipelineId);
    }
  }, [localData.actionType, localData.params?.pipelineId]);

  const loadFollowUpFlows = async () => {
    try {
      setLoadingFollowUpFlows(true);
      // Try to load follow-up flows from API
      // For now, this may return empty if the API endpoint doesn't exist yet
      const response = await api.getFollowUpFlows?.() || { data: [] };
      let flowsData = [];
      if (Array.isArray(response)) {
        flowsData = response;
      } else if (response?.data?.flows && Array.isArray(response.data.flows)) {
        flowsData = response.data.flows;
      } else if (response?.data && Array.isArray(response.data)) {
        flowsData = response.data;
      } else if (response?.flows && Array.isArray(response.flows)) {
        flowsData = response.flows;
      }
      setFollowUpFlows(flowsData);
    } catch (error) {
      console.error('Error loading follow-up flows:', error);
      setFollowUpFlows([]);
    } finally {
      setLoadingFollowUpFlows(false);
    }
  };

  const loadTags = async () => {
    try {
      setLoadingTags(true);
      const response = await api.getTags();
      console.log('Tags API response:', response);

      let tagsData = [];
      if (Array.isArray(response)) {
        tagsData = response;
      } else if (response?.data && Array.isArray(response.data)) {
        tagsData = response.data;
      } else if (response?.tags && Array.isArray(response.tags)) {
        tagsData = response.tags;
      } else if (response?.data?.tags && Array.isArray(response.data.tags)) {
        tagsData = response.data.tags;
      }

      setTags(tagsData);
    } catch (error) {
      console.error('Error loading tags:', error);
      setTags([]);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    try {
      const response = await api.createTag({
        name: newTagName.trim(),
        color: newTagColor
      });
      if (response?.success || response?.data) {
        // Reload tags
        await loadTags();
        // Add the new tag to the selected tags array
        handleChange('params', {
          ...localData.params,
          tags: [...(localData.params?.tags || []), { name: newTagName.trim(), color: newTagColor }]
        });
        setNewTagName('');
        setNewTagColor('#9333ea');
        setShowNewTagInput(false);
      }
    } catch (error) {
      console.error('Error creating tag:', error);
    }
  };

  const loadPipelines = async () => {
    try {
      setLoadingPipelines(true);
      const response = await api.getPipelines();
      let pipelinesData = [];

      if (Array.isArray(response)) {
        pipelinesData = response;
      } else if (response?.data && Array.isArray(response.data)) {
        pipelinesData = response.data;
      } else if (response?.data?.pipelines && Array.isArray(response.data.pipelines)) {
        pipelinesData = response.data.pipelines;
      } else if (response?.pipelines && Array.isArray(response.pipelines)) {
        pipelinesData = response.pipelines;
      }

      setPipelines(pipelinesData);
    } catch (error) {
      console.error('Error loading pipelines:', error);
      setPipelines([]);
    } finally {
      setLoadingPipelines(false);
    }
  };

  const loadPipelineStages = async (pipelineId) => {
    if (!pipelineId) {
      setPipelineStages([]);
      return;
    }

    try {
      setLoadingStages(true);
      const response = await api.getPipelineStages(pipelineId);
      let stagesData = [];

      if (Array.isArray(response)) {
        stagesData = response;
      } else if (response?.data && Array.isArray(response.data)) {
        stagesData = response.data;
      } else if (response?.data?.stages && Array.isArray(response.data.stages)) {
        stagesData = response.data.stages;
      } else if (response?.stages && Array.isArray(response.stages)) {
        stagesData = response.stages;
      }

      setPipelineStages(stagesData);
    } catch (error) {
      console.error('Error loading pipeline stages:', error);
      setPipelineStages([]);
    } finally {
      setLoadingStages(false);
    }
  };

  // Load sector users when sector is selected
  useEffect(() => {
    if (localData.transferMode === 'sector' && localData.transferSectorId) {
      loadSectorUsers(localData.transferSectorId);
    }
  }, [localData.transferMode, localData.transferSectorId]);

  const loadUsersAndSectors = async () => {
    try {
      setLoadingUsers(true);
      setLoadingSectors(true);
      const [usersRes, sectorsRes] = await Promise.all([
        api.getUsers(),
        api.getSectors()
      ]);
      // Debug: log API responses
      console.log('Users API response:', usersRes);
      console.log('Sectors API response:', sectorsRes);

      // Handle various API response formats - users endpoint returns { success, data: { users, pagination } }
      let usersData = [];
      if (Array.isArray(usersRes)) {
        usersData = usersRes;
      } else if (usersRes && typeof usersRes === 'object') {
        // Check nested data.users first (common pattern: { success, data: { users: [] } })
        if (Array.isArray(usersRes.data?.users)) {
          usersData = usersRes.data.users;
        } else if (Array.isArray(usersRes.users)) {
          usersData = usersRes.users;
        } else if (Array.isArray(usersRes.data)) {
          usersData = usersRes.data;
        } else if (Array.isArray(usersRes.rows)) {
          usersData = usersRes.rows;
        }
      }
      // Ensure it's an array
      if (!Array.isArray(usersData)) {
        console.warn('Could not parse users data, raw response:', usersRes);
        usersData = [];
      }
      // Handle sectors response - may also be nested in data.sectors
      let sectorsData = [];
      if (Array.isArray(sectorsRes)) {
        sectorsData = sectorsRes;
      } else if (sectorsRes && typeof sectorsRes === 'object') {
        if (Array.isArray(sectorsRes.data?.sectors)) {
          sectorsData = sectorsRes.data.sectors;
        } else if (Array.isArray(sectorsRes.sectors)) {
          sectorsData = sectorsRes.sectors;
        } else if (Array.isArray(sectorsRes.data)) {
          sectorsData = sectorsRes.data;
        } else if (Array.isArray(sectorsRes.rows)) {
          sectorsData = sectorsRes.rows;
        }
      }

      console.log('Parsed users:', usersData);
      console.log('Parsed sectors:', sectorsData);

      setUsers(usersData);
      setSectors(sectorsData);
    } catch (error) {
      console.error('Error loading users/sectors:', error);
      setUsers([]);
      setSectors([]);
    } finally {
      setLoadingUsers(false);
      setLoadingSectors(false);
    }
  };

  const loadSectorUsers = async (sectorId) => {
    try {
      const res = await api.getSectorUsers(sectorId);
      const usersData = Array.isArray(res) ? res
        : Array.isArray(res?.users) ? res.users
        : Array.isArray(res?.data) ? res.data
        : [];
      setSectorUsers(usersData);
    } catch (error) {
      console.error('Error loading sector users:', error);
      setSectorUsers([]);
    }
  };

  const handleChange = (field, value) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdate(node.id, newData);
  };

  // Update multiple fields at once to avoid state overwrites
  const handleMultiChange = (updates) => {
    const newData = { ...localData, ...updates };
    setLocalData(newData);
    onUpdate(node.id, newData);
  };

  const handleExampleAdd = () => {
    const examples = localData.examples || [];
    handleChange('examples', [...examples, '']);
  };

  const handleExampleChange = (index, value) => {
    const examples = [...(localData.examples || [])];
    examples[index] = value;
    handleChange('examples', examples);
  };

  const handleExampleRemove = (index) => {
    const examples = [...(localData.examples || [])];
    examples.splice(index, 1);
    handleChange('examples', examples);
  };

  const renderTriggerProperties = () => (
    <>
      {/* Trigger Label */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Nome do Trigger
        </label>
        <input
          type="text"
          value={localData.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
          placeholder="Ex: Inicio, Convite Enviado..."
        />
      </div>

      {/* Event Type */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Evento
        </label>
        <select
          value={localData.event || 'message_received'}
          onChange={(e) => handleChange('event', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
        >
          <optgroup label="LinkedIn">
            <option value="invite_sent">Convite Enviado</option>
            <option value="invite_accepted">Convite Aceito</option>
            <option value="invite_ignored">Convite Ignorado</option>
            <option value="profile_viewed">Perfil Visualizado</option>
            <option value="post_engagement">Engajamento no Post</option>
            <option value="inmail_received">InMail Recebido</option>
          </optgroup>
          <optgroup label="WhatsApp">
            <option value="first_contact">Primeiro Contato</option>
            <option value="media_received">Midia Recebida</option>
            <option value="button_clicked">Botao Clicado</option>
            <option value="list_selected">Lista Selecionada</option>
          </optgroup>
          <optgroup label="Email">
            <option value="email_sent">Email Enviado</option>
            <option value="email_opened">Email Aberto</option>
            <option value="email_clicked">Link Clicado</option>
            <option value="email_replied">Email Respondido</option>
            <option value="email_bounced">Email Rejeitado</option>
          </optgroup>
          <optgroup label="WebChat">
            <option value="chat_started">Chat Iniciado</option>
            <option value="page_visited">Pagina Visitada</option>
            <option value="time_on_page">Tempo na Pagina</option>
            <option value="exit_intent">Intencao de Saida</option>
          </optgroup>
          <optgroup label="Geral">
            <option value="message_received">Mensagem Recebida</option>
            <option value="no_response">Sem Resposta</option>
          </optgroup>
        </select>
      </div>

      {/* LinkedIn Invite Sent - Special Options */}
      {localData.event === 'invite_sent' && (
        <div className="space-y-2">
          {/* Simple Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
              Mensagem no convite
            </label>
            <button
              type="button"
              onClick={() => handleChange('withNote', !localData.withNote)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                localData.withNote ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  localData.withNote ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Invite Note Text with Variable Picker */}
          {localData.withNote && (
            <div className="space-y-1.5">
              <VariableTextarea
                value={localData.inviteNote || ''}
                onChange={(value) => handleChange('inviteNote', value.slice(0, 300))}
                rows={3}
                maxLength={300}
                showCharCount={true}
                className="text-[11px] bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-white"
                placeholder="Ola {{first_name}}, vi que voce trabalha na {{company}}... (digite {{ para variaveis)"
              />
            </div>
          )}
        </div>
      )}

      {/* Time on Page - Seconds */}
      {localData.event === 'time_on_page' && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            <Clock className="w-3 h-3 inline mr-1" />
            Tempo na Pagina (seg)
          </label>
          <input
            type="number"
            min="5"
            max="300"
            value={localData.timeSeconds || 30}
            onChange={(e) => handleChange('timeSeconds', parseInt(e.target.value))}
            className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
          />
        </div>
      )}

      {/* Description */}
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Descricao (opcional)
        </label>
        <input
          type="text"
          value={localData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
          placeholder="Quando convite for aceito..."
        />
      </div>

      {/* WhatsApp/Message Trigger Filters */}
      {['message_received', 'first_contact', 'media_received', 'button_clicked', 'list_selected', 'chat_started'].includes(localData.event) && (
        <div className="space-y-3 p-3 bg-cyan-50 dark:bg-cyan-900/20 rounded-lg border border-cyan-200 dark:border-cyan-800">
          {/* Header with toggle */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-[11px] font-medium text-cyan-700 dark:text-cyan-400">
              <Filter className="w-3 h-3" />
              Filtros de Ativacao
            </div>
            <button
              type="button"
              onClick={() => handleChange('filtersEnabled', !localData.filtersEnabled)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                localData.filtersEnabled ? 'bg-cyan-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                localData.filtersEnabled ? 'translate-x-4' : 'translate-x-0'
              }`} />
            </button>
          </div>

          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Defina condicoes para ativar o agente. Se nenhuma condicao for atendida, o agente nao sera ativado.
          </p>

          {localData.filtersEnabled && (
            <>
              {/* Logic selector */}
              <div className="flex items-center gap-2">
                <span className="text-[10px] text-gray-600 dark:text-gray-400">Combinar com:</span>
                <div className="flex gap-1">
                  {['AND', 'OR'].map((logic) => (
                    <button
                      key={logic}
                      type="button"
                      onClick={() => handleChange('filtersLogic', logic)}
                      className={`px-2 py-0.5 text-[10px] font-medium rounded transition-colors ${
                        (localData.filtersLogic || 'AND') === logic
                          ? 'bg-cyan-500 text-white'
                          : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-600'
                      }`}
                    >
                      {logic === 'AND' ? 'Todos (AND)' : 'Qualquer (OR)'}
                    </button>
                  ))}
                </div>
              </div>

              {/* Filter list */}
              <div className="space-y-2">
                {(localData.filters || []).map((filter, idx) => (
                  <div key={filter.id || idx} className="flex items-start gap-2 p-2 bg-white dark:bg-gray-800 rounded border border-gray-200 dark:border-gray-600">
                    <div className="flex-1 space-y-1.5">
                      {/* Filter type */}
                      <select
                        value={filter.type || 'contains'}
                        onChange={(e) => {
                          const filters = [...(localData.filters || [])];
                          filters[idx] = { ...filter, type: e.target.value };
                          handleChange('filters', filters);
                        }}
                        className="w-full px-2 py-1 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded dark:text-white"
                      >
                        <option value="contains">Contem</option>
                        <option value="exactly">Exatamente</option>
                        <option value="starts_with">Comeca com</option>
                        <option value="ends_with">Termina com</option>
                        <option value="regex">Regex</option>
                        <option value="keyword_list">Lista de palavras</option>
                      </select>

                      {/* Value input */}
                      {filter.type === 'keyword_list' ? (
                        <textarea
                          value={filter.value || ''}
                          onChange={(e) => {
                            const filters = [...(localData.filters || [])];
                            filters[idx] = { ...filter, value: e.target.value };
                            handleChange('filters', filters);
                          }}
                          placeholder="palavra1, palavra2, palavra3..."
                          rows={2}
                          className="w-full px-2 py-1 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded resize-none dark:text-white"
                        />
                      ) : (
                        <input
                          type="text"
                          value={filter.value || ''}
                          onChange={(e) => {
                            const filters = [...(localData.filters || [])];
                            filters[idx] = { ...filter, value: e.target.value };
                            handleChange('filters', filters);
                          }}
                          placeholder={filter.type === 'regex' ? '^pattern.*$' : 'Texto para buscar...'}
                          className="w-full px-2 py-1 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded dark:text-white"
                        />
                      )}

                      {/* Options */}
                      <div className="flex items-center gap-3">
                        <label className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filter.negate || false}
                            onChange={(e) => {
                              const filters = [...(localData.filters || [])];
                              filters[idx] = { ...filter, negate: e.target.checked };
                              handleChange('filters', filters);
                            }}
                            className="w-3 h-3 rounded"
                          />
                          NAO deve conter
                        </label>
                        <label className="flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={filter.caseSensitive || false}
                            onChange={(e) => {
                              const filters = [...(localData.filters || [])];
                              filters[idx] = { ...filter, caseSensitive: e.target.checked };
                              handleChange('filters', filters);
                            }}
                            className="w-3 h-3 rounded"
                          />
                          Case sensitive
                        </label>
                      </div>
                    </div>

                    {/* Remove button */}
                    <button
                      type="button"
                      onClick={() => {
                        const filters = (localData.filters || []).filter((_, i) => i !== idx);
                        handleChange('filters', filters);
                      }}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Add filter button */}
              <button
                type="button"
                onClick={() => {
                  const filters = [...(localData.filters || [])];
                  filters.push({
                    id: `filter-${Date.now()}`,
                    type: 'contains',
                    value: '',
                    caseSensitive: false,
                    negate: false
                  });
                  handleChange('filters', filters);
                }}
                className="flex items-center gap-1 text-[11px] text-cyan-600 dark:text-cyan-400 hover:text-cyan-700 dark:hover:text-cyan-300"
              >
                <Plus className="w-3 h-3" />
                Adicionar filtro
              </button>
            </>
          )}
        </div>
      )}
    </>
  );

  const renderStepProperties = () => (
    <>
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Nome da Etapa
        </label>
        <input
          type="text"
          value={localData.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
          placeholder="Ex: Rapport, Qualificacao..."
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          <MessageCircle className="w-3 h-3 inline mr-1" />
          Instrucoes para o AI
        </label>
        <textarea
          value={localData.instructions || ''}
          onChange={(e) => handleChange('instructions', e.target.value)}
          rows={3}
          className="w-full px-2 py-1.5 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white resize-none"
          placeholder="Descreva como o AI deve se comportar..."
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          <Target className="w-3 h-3 inline mr-1" />
          Objetivo da Etapa
        </label>
        <input
          type="text"
          value={localData.objective || ''}
          onChange={(e) => handleChange('objective', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
          placeholder="Ex: Lead demonstrar interesse"
        />
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            <Clock className="w-3 h-3 inline mr-1" />
            Limite de Mensagens
          </label>
          <button
            type="button"
            onClick={() => {
              // When toggle is turned OFF, also clear maxMessages to ensure unlimited
              if (localData.hasMaxMessages) {
                handleMultiChange({ hasMaxMessages: false, maxMessages: null });
              } else {
                handleMultiChange({ hasMaxMessages: true, maxMessages: localData.maxMessages || 3 });
              }
            }}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              localData.hasMaxMessages ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                localData.hasMaxMessages ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {localData.hasMaxMessages ? (
          <input
            type="number"
            min="1"
            max="20"
            value={localData.maxMessages || 3}
            onChange={(e) => handleChange('maxMessages', parseInt(e.target.value))}
            className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
          />
        ) : (
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            A IA decide quando avancar
          </p>
        )}
      </div>

      {/* Latência de Resposta */}
      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            <Zap className="w-3 h-3 inline mr-1" />
            Latencia de Resposta
          </label>
          <button
            type="button"
            onClick={() => {
              if (localData.latencyEnabled) {
                handleChange('latencyEnabled', false);
              } else {
                handleMultiChange({
                  latencyEnabled: true,
                  latency: localData.latency || { min: 30, minUnit: 'seconds', max: 2, maxUnit: 'minutes' }
                });
              }
            }}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              localData.latencyEnabled ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                localData.latencyEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>
        {localData.latencyEnabled ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Minimo</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    value={localData.latency?.min ?? 30}
                    onChange={(e) => handleChange('latency', {
                      ...localData.latency,
                      min: parseInt(e.target.value) || 0
                    })}
                    className="w-14 px-1.5 py-1 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                  <select
                    value={localData.latency?.minUnit || 'seconds'}
                    onChange={(e) => handleChange('latency', {
                      ...localData.latency,
                      minUnit: e.target.value
                    })}
                    className="flex-1 px-1 py-1 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:text-white"
                  >
                    <option value="seconds">seg</option>
                    <option value="minutes">min</option>
                  </select>
                </div>
              </div>
              <div className="space-y-1">
                <label className="block text-[10px] text-gray-600 dark:text-gray-400">Maximo</label>
                <div className="flex gap-1">
                  <input
                    type="number"
                    min="0"
                    value={localData.latency?.max ?? 2}
                    onChange={(e) => handleChange('latency', {
                      ...localData.latency,
                      max: parseInt(e.target.value) || 0
                    })}
                    className="w-14 px-1.5 py-1 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:text-white"
                  />
                  <select
                    value={localData.latency?.maxUnit || 'minutes'}
                    onChange={(e) => handleChange('latency', {
                      ...localData.latency,
                      maxUnit: e.target.value
                    })}
                    className="flex-1 px-1 py-1 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:text-white"
                  >
                    <option value="seconds">seg</option>
                    <option value="minutes">min</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="p-1.5 bg-amber-50 dark:bg-amber-900/20 rounded border border-amber-200 dark:border-amber-800">
              <p className="text-[10px] text-amber-700 dark:text-amber-400">
                Responde entre{' '}
                <strong>{localData.latency?.min ?? 30} {localData.latency?.minUnit === 'minutes' ? 'min' : 'seg'}</strong> e{' '}
                <strong>{localData.latency?.max ?? 2} {localData.latency?.maxUnit === 'seconds' ? 'seg' : 'min'}</strong>
              </p>
            </div>
          </div>
        ) : (
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Responde imediatamente
          </p>
        )}
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Exemplos de Mensagens
        </label>
        <div className="space-y-1.5">
          {(localData.examples || []).map((example, index) => (
            <div key={index} className="flex gap-1">
              <input
                type="text"
                value={example}
                onChange={(e) => handleExampleChange(index, e.target.value)}
                className="flex-1 px-2 py-1 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:text-white text-[11px]"
                placeholder="Exemplo..."
              />
              <button
                onClick={() => handleExampleRemove(index)}
                className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
          <button
            onClick={handleExampleAdd}
            className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300"
          >
            <Plus className="w-3 h-3" />
            Adicionar Exemplo
          </button>
        </div>
      </div>

      {/* Follow-up Configuration */}
      <div className="space-y-2 p-2 bg-orange-50 dark:bg-orange-900/20 rounded-lg border border-orange-200 dark:border-orange-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-orange-700 dark:text-orange-400">
            <RotateCcw className="w-3 h-3" />
            Follow-up
          </div>
          <button
            type="button"
            onClick={() => handleChange('followUpEnabled', !localData.followUpEnabled)}
            className={`relative w-9 h-5 rounded-full transition-colors ${
              localData.followUpEnabled ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                localData.followUpEnabled ? 'translate-x-4' : 'translate-x-0'
              }`}
            />
          </button>
        </div>

        {localData.followUpEnabled && (
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Fluxo de Follow-up
            </label>
            {loadingFollowUpFlows ? (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <div className="w-3 h-3 border-2 border-orange-500 border-t-transparent rounded-full animate-spin" />
                Carregando...
              </div>
            ) : followUpFlows.length > 0 ? (
              <select
                value={localData.followUpFlowId || ''}
                onChange={(e) => handleChange('followUpFlowId', e.target.value || null)}
                className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white text-[11px]"
              >
                <option value="">Selecione um fluxo...</option>
                {followUpFlows.map((flow) => (
                  <option key={flow.id} value={flow.id}>
                    {flow.name}
                  </option>
                ))}
              </select>
            ) : (
              <div className="p-2 bg-white dark:bg-gray-700 rounded border border-dashed border-gray-300 dark:border-gray-600">
                <p className="text-[10px] text-gray-500 dark:text-gray-400 text-center">
                  Nenhum fluxo de follow-up criado ainda.
                </p>
                <p className="text-[10px] text-orange-600 dark:text-orange-400 text-center mt-1">
                  Crie fluxos na aba "Follow-up"
                </p>
              </div>
            )}
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Ativado quando lead nao responde nesta etapa
            </p>
          </div>
        )}
      </div>
    </>
  );

  // Boolean conditions that don't need operator/value
  const booleanConditions = [
    'invite_accepted',
    'invite_ignored',
    'is_connected',
    'response_received',
    'has_responded'
  ];

  // Conditions that support wait time configuration
  const timeBasedConditions = [
    'invite_accepted',
    'has_responded',
    'response_received'
  ];

  // Get default wait time based on condition type
  const getDefaultWaitTime = (conditionType) => {
    return conditionType === 'invite_accepted' ? 7 : 3;
  };

  const renderConditionProperties = () => (
    <>
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Nome
        </label>
        <input
          type="text"
          value={localData.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
          placeholder="Ex: Lead interessado?"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Tipo de Condicao
        </label>
        <select
          value={localData.conditionType || 'sentiment'}
          onChange={(e) => handleChange('conditionType', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
        >
          <optgroup label="LinkedIn">
            <option value="invite_accepted">Convite Aceito?</option>
            <option value="is_connected">Ja Conectado?</option>
          </optgroup>
          <optgroup label="Conversa">
            <option value="has_responded">Lead Respondeu?</option>
            <option value="response_received">Resposta Recebida?</option>
            <option value="sentiment">Sentimento</option>
            <option value="keyword">Palavra-chave</option>
            <option value="intent">Intencao</option>
          </optgroup>
          <optgroup label="Tempo">
            <option value="time_elapsed">Tempo Passado</option>
          </optgroup>
        </select>
      </div>

      {/* Wait time configuration for time-based conditions */}
      {timeBasedConditions.includes(localData.conditionType) && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            <Clock className="w-3 h-3 inline mr-1" />
            Tempo para NAO
          </label>
          <div className="flex gap-1.5">
            <input
              type="number"
              min="1"
              max="999"
              value={localData.waitTime || getDefaultWaitTime(localData.conditionType)}
              onChange={(e) => handleChange('waitTime', parseInt(e.target.value) || 1)}
              className="w-14 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
            />
            <select
              value={localData.waitUnit || 'days'}
              onChange={(e) => handleChange('waitUnit', e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
            >
              <option value="minutes">Min</option>
              <option value="hours">Horas</option>
              <option value="days">Dias</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Sem resposta = segue para NAO
          </p>
        </div>
      )}

      {/* Only show operator/value for non-boolean conditions */}
      {!booleanConditions.includes(localData.conditionType) && (
        <>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
              Operador
            </label>
            <select
              value={localData.operator || 'equals'}
              onChange={(e) => handleChange('operator', e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
            >
              <option value="equals">Igual a</option>
              <option value="not_equals">Diferente de</option>
              <option value="contains">Contem</option>
              <option value="not_contains">Nao contem</option>
              <option value="greater_than">Maior que</option>
              <option value="less_than">Menor que</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
              Valor
            </label>
            <input
              type="text"
              value={localData.value || ''}
              onChange={(e) => handleChange('value', e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
              placeholder="Ex: positive, sim..."
            />
          </div>
        </>
      )}
    </>
  );

  const renderTransferConfig = () => (
    <div className="space-y-3 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
      <div className="flex items-center gap-1.5 text-[11px] font-medium text-blue-700 dark:text-blue-400">
        <PhoneCall className="w-3 h-3" />
        Configurar Transferencia
      </div>

      {/* Transfer Mode */}
      <div className="space-y-1">
        <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
          Transferir para
        </label>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => handleMultiChange({
              transferMode: 'user',
              transferSectorId: null,
              transferSectorMode: null,
              transferSectorUserId: null
            })}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
              localData.transferMode === 'user'
                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-400'
            }`}
          >
            <User className="w-3 h-3" />
            <span className="text-[10px] font-medium">Usuario</span>
          </button>
          <button
            type="button"
            onClick={() => handleMultiChange({
              transferMode: 'sector',
              transferUserId: null
            })}
            className={`flex items-center justify-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
              localData.transferMode === 'sector'
                ? 'border-blue-500 bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300'
                : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Building2 className="w-3 h-3" />
            <span className="text-[10px] font-medium">Setor</span>
          </button>
        </div>
      </div>

      {/* User Selection - when transfer mode is user */}
      {localData.transferMode === 'user' && (
        <div className="space-y-1">
          <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
            <User className="w-2.5 h-2.5 inline mr-0.5" />
            Selecionar Usuario
          </label>
          {loadingUsers ? (
            <div className="flex items-center justify-center py-2 text-gray-400">
              <RefreshCw className="w-3 h-3 animate-spin mr-1" />
              <span className="text-[10px]">Carregando...</span>
            </div>
          ) : (
            <select
              value={localData.transferUserId || ''}
              onChange={(e) => handleChange('transferUserId', e.target.value)}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white text-[11px]"
            >
              <option value="">Selecione...</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.name || user.email}
                </option>
              ))}
            </select>
          )}
        </div>
      )}

      {/* Sector Selection - when transfer mode is sector */}
      {localData.transferMode === 'sector' && (
        <>
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              <Building2 className="w-2.5 h-2.5 inline mr-0.5" />
              Selecionar Setor
            </label>
            {loadingSectors ? (
              <div className="flex items-center justify-center py-2 text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                <span className="text-[10px]">Carregando...</span>
              </div>
            ) : (
              <select
                value={localData.transferSectorId || ''}
                onChange={(e) => handleMultiChange({
                  transferSectorId: e.target.value,
                  transferSectorUserId: null,
                  transferSectorMode: null
                })}
                className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white text-[11px]"
              >
                <option value="">Selecione...</option>
                {sectors.map((sector) => (
                  <option key={sector.id} value={sector.id}>
                    {sector.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Sector Mode - round robin or specific user */}
          {localData.transferSectorId && (
            <div className="space-y-1.5">
              <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                Modo de Distribuicao
              </label>
              <div className="space-y-1">
                <label className="flex items-center gap-1.5 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="sectorMode"
                    value="round_robin"
                    checked={localData.transferSectorMode === 'round_robin'}
                    onChange={() => handleMultiChange({
                      transferSectorMode: 'round_robin',
                      transferSectorUserId: null
                    })}
                    className="w-3 h-3 text-blue-500 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <RefreshCw className="w-2.5 h-2.5 text-green-500" />
                      <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Round Robin</span>
                    </div>
                  </div>
                </label>

                <label className="flex items-center gap-1.5 p-1.5 rounded-lg border border-gray-200 dark:border-gray-600 hover:bg-gray-50 dark:hover:bg-gray-700 cursor-pointer">
                  <input
                    type="radio"
                    name="sectorMode"
                    value="specific_user"
                    checked={localData.transferSectorMode === 'specific_user'}
                    onChange={() => handleChange('transferSectorMode', 'specific_user')}
                    className="w-3 h-3 text-blue-500 focus:ring-blue-500"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-1">
                      <User className="w-2.5 h-2.5 text-purple-500" />
                      <span className="text-[10px] font-medium text-gray-700 dark:text-gray-300">Usuario Especifico</span>
                    </div>
                  </div>
                </label>
              </div>

              {/* Specific User Selection within Sector */}
              {localData.transferSectorMode === 'specific_user' && (
                <div className="mt-1">
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400 mb-1">
                    <Users className="w-2.5 h-2.5 inline mr-0.5" />
                    Usuario do Setor
                  </label>
                  <select
                    value={localData.transferSectorUserId || ''}
                    onChange={(e) => handleChange('transferSectorUserId', e.target.value)}
                    className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:text-white text-[11px]"
                  >
                    <option value="">Selecione...</option>
                    {sectorUsers.map((user) => (
                      <option key={user.id} value={user.id}>
                        {user.name || user.email}
                      </option>
                    ))}
                  </select>
                  {sectorUsers.length === 0 && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 mt-0.5">
                      Nenhum usuario no setor
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );

  const renderActionProperties = () => (
    <>
      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Nome
        </label>
        <input
          type="text"
          value={localData.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
          placeholder="Nome da acao"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Tipo de Acao
        </label>
        <select
          value={localData.actionType || 'transfer'}
          onChange={(e) => handleChange('actionType', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
        >
          <option value="transfer">Transferir</option>
          <option value="schedule">Agendar Reuniao</option>
          <option value="send_message">Enviar Mensagem</option>
          <option value="add_tag">Adicionar Tag</option>
          <option value="remove_tag">Remover Tag</option>
          <option value="close_positive">Encerrar (Positivo)</option>
          <option value="close_negative">Encerrar (Negativo)</option>
          <option value="wait">Aguardar</option>
          <option value="webhook">Chamar Webhook</option>
          <option value="create_opportunity">Criar Oportunidade</option>
          <option value="move_stage">Mover Etapa</option>
        </select>
      </div>

      {/* Transfer Configuration */}
      {localData.actionType === 'transfer' && renderTransferConfig()}

      {/* Schedule Configuration */}
      {localData.actionType === 'schedule' && (
        <div className="space-y-3 p-2 bg-indigo-50 dark:bg-indigo-900/20 rounded-lg border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-indigo-700 dark:text-indigo-400">
            <Clock className="w-3 h-3" />
            Configurar Agendamento
          </div>

          {/* Scheduling Type */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Tipo de Calendário
            </label>
            <select
              value={localData.params?.schedulingType || 'custom_link'}
              onChange={(e) => handleChange('params', { ...localData.params, schedulingType: e.target.value })}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white text-[11px]"
            >
              <option value="calendly">Calendly</option>
              <option value="google_calendar">Google Calendar</option>
              <option value="custom_link">Link Customizado</option>
            </select>
          </div>

          {/* Scheduling Link */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Link do Calendário
            </label>
            <input
              type="url"
              value={localData.params?.schedulingLink || ''}
              onChange={(e) => handleChange('params', { ...localData.params, schedulingLink: e.target.value })}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white text-[11px]"
              placeholder={
                localData.params?.schedulingType === 'calendly'
                  ? 'https://calendly.com/seu-usuario/30min'
                  : localData.params?.schedulingType === 'google_calendar'
                  ? 'https://calendar.google.com/...'
                  : 'https://...'
              }
            />
          </div>

          {/* Meeting Duration */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Duração da Reunião
            </label>
            <select
              value={localData.params?.meetingDuration || 30}
              onChange={(e) => handleChange('params', { ...localData.params, meetingDuration: parseInt(e.target.value) })}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white text-[11px]"
            >
              <option value={15}>15 minutos</option>
              <option value={30}>30 minutos</option>
              <option value={45}>45 minutos</option>
              <option value={60}>60 minutos</option>
            </select>
          </div>

          {/* Meeting Title */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Título da Reunião
            </label>
            <VariableInput
              value={localData.params?.meetingTitle || ''}
              onChange={(value) => handleChange('params', { ...localData.params, meetingTitle: value })}
              className="text-[11px] bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-white"
              placeholder="Reunião com {{company}} (digite {{ para variaveis)"
            />
          </div>

          {/* Send Confirmation Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Enviar Confirmação
            </label>
            <button
              type="button"
              onClick={() => handleChange('params', {
                ...localData.params,
                sendConfirmation: !localData.params?.sendConfirmation
              })}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                localData.params?.sendConfirmation ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  localData.params?.sendConfirmation ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {/* Confirmation Message */}
          {localData.params?.sendConfirmation && (
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                Mensagem de Confirmação
              </label>
              <textarea
                value={localData.params?.confirmationMessage || ''}
                onChange={(e) => handleChange('params', { ...localData.params, confirmationMessage: e.target.value })}
                rows={2}
                className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-indigo-500 dark:text-white text-[11px] resize-none"
                placeholder="Perfeito! Te enviei o link para agendar. Fico no aguardo!"
              />
            </div>
          )}
        </div>
      )}

      {['transfer', 'send_message', 'close_positive', 'close_negative'].includes(localData.actionType) && (
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            Mensagem {localData.actionType === 'transfer' ? '(opcional)' : ''}
          </label>
          <VariableTextarea
            value={localData.message || ''}
            onChange={(value) => handleChange('message', value)}
            rows={2}
            className="text-[11px] bg-gray-50 dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-white"
            placeholder={localData.actionType === 'transfer'
              ? "Mensagem antes de transferir... (digite {{ para variaveis)"
              : "Ola {{first_name}}... (digite {{ para variaveis)"}
          />
        </div>
      )}

      {/* Wait for Response Toggle - only for send_message */}
      {localData.actionType === 'send_message' && (
        <div className="space-y-1">
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
              Aguardar Resposta
            </label>
            <button
              type="button"
              onClick={() => handleChange('waitForResponse', !localData.waitForResponse)}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                localData.waitForResponse !== false ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  localData.waitForResponse !== false ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            {localData.waitForResponse !== false
              ? 'Aguarda resposta antes de continuar'
              : 'Continua imediatamente'}
          </p>
        </div>
      )}

      {localData.actionType === 'add_tag' && (
        <div className="space-y-2">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            <Tag className="w-3 h-3 inline mr-0.5" />
            Selecionar Tags
            <span className="text-[10px] text-gray-400 ml-1">(clique para selecionar)</span>
          </label>

          {loadingTags ? (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              {/* Tags list - seleção múltipla */}
              {!showNewTagInput && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {tags.map((tag) => {
                      const selectedTags = localData.params?.tags || [];
                      const isSelected = selectedTags.some(t => t.name === tag.name);
                      const tagStyles = getTagStyles(tag.color);
                      return (
                        <button
                          key={tag.id || tag.name}
                          type="button"
                          onClick={() => {
                            const currentTags = localData.params?.tags || [];
                            let newTags;
                            if (isSelected) {
                              // Remove tag
                              newTags = currentTags.filter(t => t.name !== tag.name);
                            } else {
                              // Add tag
                              newTags = [...currentTags, { name: tag.name, color: tag.color }];
                            }
                            handleChange('params', { ...localData.params, tags: newTags });
                          }}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded border-2 transition-all ${
                            isSelected ? 'ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-gray-800' : 'hover:opacity-80'
                          }`}
                          style={tagStyles}
                        >
                          {isSelected && <span className="mr-0.5">✓</span>}
                          {tag.name}
                        </button>
                      );
                    })}
                    {tags.length === 0 && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Nenhuma tag cadastrada
                      </span>
                    )}
                  </div>

                  {/* Create new tag button */}
                  <button
                    type="button"
                    onClick={() => setShowNewTagInput(true)}
                    className="flex items-center gap-1 text-[11px] text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Criar nova tag
                  </button>
                </div>
              )}

              {/* New tag form - mesmo estilo da TagsPage */}
              {showNewTagInput && (
                <div className="p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-md space-y-3">
                  {/* Nome */}
                  <div className="flex items-center gap-3">
                    <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap w-10">
                      Nome:
                    </label>
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleCreateTag();
                        } else if (e.key === 'Escape') {
                          setShowNewTagInput(false);
                          setNewTagName('');
                          setNewTagColor('#9333ea');
                        }
                      }}
                      placeholder="Nome da etiqueta..."
                      autoFocus
                      className="flex-1 px-2 py-1 text-[11px] border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-900 text-gray-900 dark:text-gray-100 focus:ring-1 focus:ring-purple-500 focus:border-transparent"
                    />
                  </div>

                  {/* Cor */}
                  <div className="flex items-start gap-3">
                    <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300 whitespace-nowrap w-10 pt-1">
                      Cor:
                    </label>
                    <div className="flex items-center gap-2 flex-wrap">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          type="button"
                          onClick={() => setNewTagColor(color.hex)}
                          className={`w-5 h-5 rounded-full border-2 transition-all ${
                            newTagColor === color.hex
                              ? 'ring-2 ring-offset-1 ring-purple-500 border-white'
                              : 'border-gray-300 dark:border-gray-600 hover:scale-110'
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                      {/* Preview da cor atual */}
                      <div
                        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ml-2"
                        style={getTagStyles(newTagColor)}
                      >
                        {newTagColor}
                      </div>
                    </div>
                  </div>

                  {/* Botões */}
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCreateTag}
                      disabled={!newTagName.trim()}
                      className="px-2.5 py-1 text-[11px] bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Criar
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowNewTagInput(false);
                        setNewTagName('');
                        setNewTagColor('#9333ea');
                      }}
                      className="px-2.5 py-1 text-[11px] text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {/* Tags selecionadas */}
              {(localData.params?.tags?.length > 0) && !showNewTagInput && (
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 dark:text-gray-400">
                      {localData.params.tags.length} tag(s) selecionada(s):
                    </span>
                    <button
                      type="button"
                      onClick={() => handleChange('params', { ...localData.params, tags: [] })}
                      className="text-[10px] text-red-500 hover:text-red-600 transition-colors"
                    >
                      Limpar todas
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {localData.params.tags.map((tag, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border"
                        style={getTagStyles(tag.color)}
                      >
                        {tag.name}
                        <button
                          type="button"
                          onClick={() => {
                            const newTags = localData.params.tags.filter((_, i) => i !== idx);
                            handleChange('params', { ...localData.params, tags: newTags });
                          }}
                          className="hover:opacity-70"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {localData.actionType === 'remove_tag' && (
        <div className="space-y-2">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            <MinusCircle className="w-3 h-3 inline mr-0.5" />
            Remover Tags
            <span className="text-[10px] text-gray-400 ml-1">(clique para selecionar)</span>
          </label>

          {loadingTags ? (
            <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
              <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              {/* Remove All Toggle */}
              <div className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                <label className="text-[11px] font-medium text-red-700 dark:text-red-300">
                  Remover todas as tags
                </label>
                <button
                  type="button"
                  onClick={() => handleChange('params', {
                    ...localData.params,
                    removeAll: !localData.params?.removeAll,
                    tags: localData.params?.removeAll ? localData.params?.tags : []
                  })}
                  className={`relative w-9 h-5 rounded-full transition-colors ${
                    localData.params?.removeAll ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                      localData.params?.removeAll ? 'translate-x-4' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Tags list - seleção múltipla (disabled if removeAll) */}
              {!localData.params?.removeAll && (
                <div className="space-y-2">
                  <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                    {tags.map((tag) => {
                      const selectedTags = localData.params?.tags || [];
                      const isSelected = selectedTags.some(t => t.name === tag.name);
                      const tagStyles = getTagStyles(tag.color);
                      return (
                        <button
                          key={tag.id || tag.name}
                          type="button"
                          onClick={() => {
                            const currentTags = localData.params?.tags || [];
                            let newTags;
                            if (isSelected) {
                              newTags = currentTags.filter(t => t.name !== tag.name);
                            } else {
                              newTags = [...currentTags, { name: tag.name, color: tag.color }];
                            }
                            handleChange('params', { ...localData.params, tags: newTags });
                          }}
                          className={`px-2 py-0.5 text-[11px] font-medium rounded border-2 transition-all ${
                            isSelected ? 'ring-2 ring-red-500 ring-offset-1 dark:ring-offset-gray-800 line-through' : 'hover:opacity-80'
                          }`}
                          style={tagStyles}
                        >
                          {isSelected && <span className="mr-0.5">✕</span>}
                          {tag.name}
                        </button>
                      );
                    })}
                    {tags.length === 0 && (
                      <span className="text-[11px] text-gray-400 dark:text-gray-500">
                        Nenhuma tag cadastrada
                      </span>
                    )}
                  </div>

                  {/* Tags selecionadas para remoção */}
                  {(localData.params?.tags?.length > 0) && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-gray-500 dark:text-gray-400">
                          {localData.params.tags.length} tag(s) a remover:
                        </span>
                        <button
                          type="button"
                          onClick={() => handleChange('params', { ...localData.params, tags: [] })}
                          className="text-[10px] text-red-500 hover:text-red-600 transition-colors"
                        >
                          Limpar
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {localData.params.tags.map((tag, idx) => (
                          <span
                            key={idx}
                            className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border line-through"
                            style={getTagStyles(tag.color)}
                          >
                            {tag.name}
                            <button
                              type="button"
                              onClick={() => {
                                const newTags = localData.params.tags.filter((_, i) => i !== idx);
                                handleChange('params', { ...localData.params, tags: newTags });
                              }}
                              className="hover:opacity-70"
                            >
                              <X className="w-2.5 h-2.5" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {localData.actionType === 'wait' && (
        <div className="space-y-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
          <label className="block text-[11px] font-medium text-amber-700 dark:text-amber-400">
            <Clock className="w-3 h-3 inline mr-1" />
            Tempo de Espera
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="1"
              max="999"
              value={localData.waitTime || 24}
              onChange={(e) => handleChange('waitTime', parseInt(e.target.value) || 1)}
              className="w-20 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 dark:text-white"
            />
            <select
              value={localData.waitUnit || 'hours'}
              onChange={(e) => handleChange('waitUnit', e.target.value)}
              className="flex-1 px-2 py-1.5 text-xs bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-amber-500 dark:text-white"
            >
              <option value="seconds">Segundos</option>
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Dias</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Aguarda este tempo antes de continuar para o proximo passo
          </p>
        </div>
      )}

      {localData.actionType === 'webhook' && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            URL do Webhook
          </label>
          <input
            type="url"
            value={localData.params?.url || ''}
            onChange={(e) => handleChange('params', { ...localData.params, url: e.target.value })}
            className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
            placeholder="https://..."
          />
        </div>
      )}

      {/* Create Opportunity Configuration */}
      {localData.actionType === 'create_opportunity' && (
        <div className="space-y-3 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-purple-700 dark:text-purple-400">
            <Target className="w-3 h-3" />
            Configurar Oportunidade
          </div>

          {/* Pipeline Selection */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Pipeline
            </label>
            {loadingPipelines ? (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                Carregando...
              </div>
            ) : (
              <select
                value={localData.params?.pipelineId || ''}
                onChange={(e) => {
                  const selectedPipeline = pipelines.find(p => p.id === e.target.value);
                  handleChange('params', {
                    ...localData.params,
                    pipelineId: e.target.value,
                    pipelineName: selectedPipeline?.name || '',
                    stageId: '',
                    stageName: ''
                  });
                }}
                className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-[11px]"
              >
                <option value="">Selecione uma pipeline...</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            )}
            {pipelines.length === 0 && !loadingPipelines && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Nenhuma pipeline encontrada
              </p>
            )}
          </div>

          {/* Stage Selection */}
          {localData.params?.pipelineId && (
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                Etapa
              </label>
              {loadingStages ? (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                  Carregando...
                </div>
              ) : (
                <select
                  value={localData.params?.stageId || ''}
                  onChange={(e) => {
                    const selectedStage = pipelineStages.find(s => s.id === e.target.value);
                    handleChange('params', {
                      ...localData.params,
                      stageId: e.target.value,
                      stageName: selectedStage?.name || ''
                    });
                  }}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-[11px]"
                >
                  <option value="">Selecione uma etapa...</option>
                  {pipelineStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              )}
              {pipelineStages.length === 0 && !loadingStages && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Nenhuma etapa encontrada
                </p>
              )}
            </div>
          )}

          {/* Opportunity Title */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Titulo da Oportunidade
            </label>
            <VariableInput
              value={localData.params?.title || ''}
              onChange={(value) => handleChange('params', { ...localData.params, title: value })}
              className="text-[11px] bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 dark:text-white"
              placeholder="{{name}} - {{company}} (digite {{ para variaveis)"
            />
            <p className="text-[9px] text-gray-400 dark:text-gray-500">
              Deixe vazio para usar nome do lead
            </p>
          </div>

          {/* Opportunity Value */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              <DollarSign className="w-2.5 h-2.5 inline mr-0.5" />
              Valor (opcional)
            </label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={localData.params?.value || ''}
              onChange={(e) => handleChange('params', { ...localData.params, value: e.target.value })}
              className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-[11px]"
              placeholder="0,00"
            />
          </div>

          {/* Responsible User */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              <User className="w-2.5 h-2.5 inline mr-0.5" />
              Responsavel
            </label>
            {loadingUsers ? (
              <div className="flex items-center justify-center py-2 text-gray-400">
                <RefreshCw className="w-3 h-3 animate-spin mr-1" />
                <span className="text-[10px]">Carregando...</span>
              </div>
            ) : (
              <select
                value={localData.params?.assignedUserId || ''}
                onChange={(e) => {
                  const selectedUser = users.find(u => u.id === e.target.value);
                  handleChange('params', {
                    ...localData.params,
                    assignedUserId: e.target.value || null,
                    assignedUserName: selectedUser?.name || selectedUser?.email || ''
                  });
                }}
                className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-[11px]"
              >
                <option value="">Dono da campanha (padrao)</option>
                {users.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.name || user.email}
                  </option>
                ))}
              </select>
            )}
            <p className="text-[9px] text-gray-400 dark:text-gray-500">
              Usuario responsavel pela oportunidade e conversa
            </p>
          </div>

          {/* Create Contact if Not Exists Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Criar contato se nao existir
            </label>
            <button
              type="button"
              onClick={() => handleChange('params', {
                ...localData.params,
                createContactIfNotExists: localData.params?.createContactIfNotExists !== false ? false : true
              })}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                localData.params?.createContactIfNotExists !== false ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  localData.params?.createContactIfNotExists !== false ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
          <p className="text-[9px] text-gray-400 dark:text-gray-500">
            {localData.params?.createContactIfNotExists !== false
              ? 'Cria contato a partir dos dados do lead se nao existir'
              : 'Requer contato existente para criar oportunidade'}
          </p>
        </div>
      )}

      {/* Move Stage Configuration */}
      {localData.actionType === 'move_stage' && (
        <div className="space-y-3 p-2 bg-teal-50 dark:bg-teal-900/20 rounded-lg border border-teal-200 dark:border-teal-800">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-teal-700 dark:text-teal-400">
            <ArrowRightCircle className="w-3 h-3" />
            Mover para Etapa
          </div>

          {/* Pipeline Selection */}
          <div className="space-y-1">
            <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
              Pipeline
            </label>
            {loadingPipelines ? (
              <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                Carregando...
              </div>
            ) : (
              <select
                value={localData.params?.pipelineId || ''}
                onChange={(e) => {
                  const selectedPipeline = pipelines.find(p => p.id === e.target.value);
                  handleChange('params', {
                    ...localData.params,
                    pipelineId: e.target.value,
                    pipelineName: selectedPipeline?.name || '',
                    stageId: '',
                    stageName: ''
                  });
                }}
                className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:text-white text-[11px]"
              >
                <option value="">Selecione a pipeline...</option>
                {pipelines.map((pipeline) => (
                  <option key={pipeline.id} value={pipeline.id}>
                    {pipeline.name}
                  </option>
                ))}
              </select>
            )}
            {pipelines.length === 0 && !loadingPipelines && (
              <p className="text-[10px] text-amber-600 dark:text-amber-400">
                Nenhuma pipeline encontrada
              </p>
            )}
          </div>

          {/* Stage Selection */}
          {localData.params?.pipelineId && (
            <div className="space-y-1">
              <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                Etapa Destino
              </label>
              {loadingStages ? (
                <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
                  <div className="w-3 h-3 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                  Carregando...
                </div>
              ) : (
                <select
                  value={localData.params?.stageId || ''}
                  onChange={(e) => {
                    const selectedStage = pipelineStages.find(s => s.id === e.target.value);
                    handleChange('params', {
                      ...localData.params,
                      stageId: e.target.value,
                      stageName: selectedStage?.name || ''
                    });
                  }}
                  className="w-full px-2 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-teal-500 dark:text-white text-[11px]"
                >
                  <option value="">Selecione a etapa...</option>
                  {pipelineStages.map((stage) => (
                    <option key={stage.id} value={stage.id}>
                      {stage.name}
                    </option>
                  ))}
                </select>
              )}
              {pipelineStages.length === 0 && !loadingStages && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Nenhuma etapa encontrada
                </p>
              )}
            </div>
          )}

          <p className="text-[9px] text-gray-400 dark:text-gray-500">
            Move a oportunidade do lead para a etapa selecionada
          </p>
        </div>
      )}
    </>
  );

  const renderHTTPRequestProperties = () => {
    const methodColors = {
      GET: 'bg-green-500',
      POST: 'bg-blue-500',
      PUT: 'bg-amber-500',
      DELETE: 'bg-red-500',
      PATCH: 'bg-purple-500'
    };

    const method = localData.method || 'GET';
    const hasUrl = !!localData.url;
    const hasVariables = localData.extractVariables?.length > 0;
    const hasHeaders = localData.headers?.length > 0;

    return (
    <>
      {/* Summary Card */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <span className={`px-2 py-0.5 text-[10px] font-bold text-white rounded ${methodColors[method]}`}>
            {method}
          </span>
          <span className="text-xs text-gray-600 dark:text-gray-300 truncate flex-1 font-mono">
            {localData.url || 'URL nao configurada'}
          </span>
        </div>

        {/* Quick stats */}
        <div className="flex gap-3 text-[10px] text-gray-500 dark:text-gray-400">
          {hasHeaders && (
            <span>{localData.headers.length} header(s)</span>
          )}
          {hasVariables && (
            <span>{localData.extractVariables.length} variavel(is)</span>
          )}
        </div>

        {/* Last test result */}
        {localData.lastTestResult && (
          <div className={`flex items-center gap-2 text-xs ${
            localData.lastTestResult.status >= 200 && localData.lastTestResult.status < 400
              ? 'text-green-600 dark:text-green-400'
              : 'text-red-600 dark:text-red-400'
          }`}>
            {localData.lastTestResult.status >= 200 && localData.lastTestResult.status < 400 ? (
              <CheckCircle className="w-3 h-3" />
            ) : (
              <XCircle className="w-3 h-3" />
            )}
            <span>Ultimo teste: {localData.lastTestResult.status} ({localData.lastTestResult.duration}ms)</span>
          </div>
        )}
      </div>

      {/* Open Modal Button */}
      <button
        type="button"
        onClick={() => onOpenHttpModal && onOpenHttpModal(node.id)}
        className="w-full px-4 py-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white rounded-lg hover:from-indigo-600 hover:to-purple-600 transition-all flex items-center justify-center gap-2 font-medium text-sm shadow-lg shadow-indigo-500/25"
      >
        <Globe className="w-4 h-4" />
        Configurar HTTP Request
      </button>

      <p className="text-[10px] text-center text-gray-500 dark:text-gray-400">
        Clique para abrir o editor completo ou de duplo clique no no
      </p>
    </>
  );
  };

  // Old inline HTTP config code removed - now uses modal

  const renderProperties = () => {
    switch (node.type) {
      case 'trigger':
        return renderTriggerProperties();
      case 'conversationStep':
        return renderStepProperties();
      case 'condition':
        return renderConditionProperties();
      case 'action':
        return renderActionProperties();
      case 'httpRequest':
        return renderHTTPRequestProperties();
      default:
        return null;
    }
  };

  const getNodeIcon = () => {
    switch (node.type) {
      case 'trigger': return <Zap className="w-4 h-4 text-green-500" />;
      case 'conversationStep': return <MessageCircle className="w-4 h-4 text-purple-500" />;
      case 'condition': return <GitBranch className="w-4 h-4 text-amber-500" />;
      case 'action': return <PhoneCall className="w-4 h-4 text-blue-500" />;
      case 'httpRequest': return <Globe className="w-4 h-4 text-indigo-500" />;
      default: return null;
    }
  };

  const getNodeTypeName = () => {
    switch (node.type) {
      case 'trigger': return 'Trigger';
      case 'conversationStep': return 'Etapa de Conversa';
      case 'condition': return 'Condicao';
      case 'action': return 'Acao';
      case 'httpRequest': return 'HTTP Request';
      default: return 'No';
    }
  };

  return (
    <div className="w-64 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-1.5">
          {getNodeIcon()}
          <span className="text-xs font-medium text-gray-900 dark:text-white">
            {getNodeTypeName()}
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Properties */}
      <div className="p-3 space-y-3">
        {renderProperties()}
      </div>

      {/* Delete button */}
      <div className="p-3 border-t border-gray-200 dark:border-gray-700">
        <button
          onClick={() => onDelete(node.id)}
          className="flex items-center justify-center gap-1.5 w-full px-3 py-1.5 text-[11px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Excluir {getNodeTypeName()}
        </button>
      </div>
    </div>
  );
};

export default PropertiesPanel;
