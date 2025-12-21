// frontend/src/components/aiemployees/WorkflowBuilder/PropertiesPanel.jsx
// Panel for editing node properties

import React, { useState, useEffect, useRef } from 'react';
import { X, Trash2, Plus, MessageCircle, Target, Clock, Zap, GitBranch, PhoneCall, Send, Mail, User, Users, Building2, RefreshCw, Tag } from 'lucide-react';
import api from '../../../services/api';

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

// Available template variables for messages (must match backend replaceVariables)
const MESSAGE_VARIABLES = [
  { key: 'first_name', label: 'Primeiro Nome', description: 'Primeiro nome do lead' },
  { key: 'name', label: 'Nome Completo', description: 'Nome completo do lead' },
  { key: 'company', label: 'Empresa', description: 'Nome da empresa' },
  { key: 'title', label: 'Cargo', description: 'Cargo/titulo do lead' },
  { key: 'location', label: 'Localizacao', description: 'Cidade/regiao do lead' },
  { key: 'industry', label: 'Industria', description: 'Setor da empresa' }
];

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

const PropertiesPanel = ({ node, onUpdate, onDelete, onClose }) => {
  const [localData, setLocalData] = useState(node.data);
  const inviteNoteRef = useRef(null);
  const actionMessageRef = useRef(null);

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

  useEffect(() => {
    setLocalData(node.data);
  }, [node]);

  // Load users and sectors when transfer action is selected
  useEffect(() => {
    if (node.type === 'action' && localData.actionType === 'transfer') {
      loadUsersAndSectors();
    }
  }, [node.type, localData.actionType]);

  // Load tags when add_tag action is selected
  useEffect(() => {
    if (node.type === 'action' && localData.actionType === 'add_tag') {
      loadTags();
    }
  }, [node.type, localData.actionType]);

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

  // Insert variable at cursor position in textarea
  const insertVariable = (variableKey, fieldName, textareaRef, maxLength = null) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const variable = `{{${variableKey}}}`;
    const currentValue = localData[fieldName] || '';
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;

    const newValue = currentValue.substring(0, start) + variable + currentValue.substring(end);

    // Respect max length if specified
    if (maxLength && newValue.length > maxLength) return;

    handleChange(fieldName, newValue);
    // Set cursor position after inserted variable
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + variable.length, start + variable.length);
    }, 0);
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

          {/* Invite Note Text with Variable Badges */}
          {localData.withNote && (
            <div className="space-y-1.5">
              {/* Variable Badges */}
              <div className="flex flex-wrap gap-1">
                {MESSAGE_VARIABLES.map((v) => (
                  <button
                    key={v.key}
                    type="button"
                    onClick={() => insertVariable(v.key, 'inviteNote', inviteNoteRef, 300)}
                    className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
                    title={`${v.label} - ${v.description}`}
                  >
                    {`{{${v.key}}}`}
                  </button>
                ))}
              </div>

              {/* Textarea */}
              <textarea
                ref={inviteNoteRef}
                value={localData.inviteNote || ''}
                onChange={(e) => handleChange('inviteNote', e.target.value.slice(0, 300))}
                rows={3}
                maxLength={300}
                className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white resize-none text-[11px]"
                placeholder="Ola {{first_name}}, vi que voce trabalha na {{company}}..."
              />

              {/* Character count */}
              <div className="text-[10px] text-gray-400 dark:text-gray-500 text-right">
                {(localData.inviteNote || '').length}/300
              </div>
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
            onClick={() => handleChange('hasMaxMessages', !localData.hasMaxMessages)}
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
          <option value="close_positive">Encerrar (Positivo)</option>
          <option value="close_negative">Encerrar (Negativo)</option>
          <option value="pause">Pausar</option>
          <option value="webhook">Chamar Webhook</option>
        </select>
      </div>

      {/* Transfer Configuration */}
      {localData.actionType === 'transfer' && renderTransferConfig()}

      {['transfer', 'send_message', 'close_positive', 'close_negative'].includes(localData.actionType) && (
        <div className="space-y-1.5">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            Mensagem {localData.actionType === 'transfer' ? '(opcional)' : ''}
          </label>
          {/* Variable Badges */}
          <div className="flex flex-wrap gap-1">
            {MESSAGE_VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                onClick={() => insertVariable(v.key, 'message', actionMessageRef)}
                className="inline-flex items-center px-1.5 py-0.5 text-[10px] font-medium bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900/60 transition-colors cursor-pointer"
                title={`${v.label} - ${v.description}`}
              >
                {`{{${v.key}}}`}
              </button>
            ))}
          </div>
          <textarea
            ref={actionMessageRef}
            value={localData.message || ''}
            onChange={(e) => handleChange('message', e.target.value)}
            rows={2}
            className="w-full px-2 py-1.5 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white resize-none"
            placeholder={localData.actionType === 'transfer'
              ? "Mensagem antes de transferir..."
              : "Ola {{first_name}}..."}
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
                            isSelected ? 'border-white shadow-[0_0_0_2px_rgba(147,51,234,1)]' : 'hover:opacity-80'
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

      {localData.actionType === 'pause' && (
        <div className="space-y-2">
          {/* Random Mode Toggle */}
          <div className="flex items-center justify-between">
            <label className="text-[11px] font-medium text-gray-700 dark:text-gray-300">
              Modo Aleatorio
            </label>
            <button
              type="button"
              onClick={() => handleChange('params', {
                ...localData.params,
                randomMode: !localData.params?.randomMode,
                // Reset to defaults when switching
                ...(localData.params?.randomMode
                  ? { duration: 5, minDuration: undefined, maxDuration: undefined }
                  : { duration: undefined, minDuration: 3, maxDuration: 10 }
                )
              })}
              className={`relative w-9 h-5 rounded-full transition-colors ${
                localData.params?.randomMode ? 'bg-purple-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${
                  localData.params?.randomMode ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>

          {localData.params?.randomMode ? (
            <>
              {/* Random Range Inputs */}
              <p className="text-[10px] text-gray-500 dark:text-gray-400">
                Valor aleatorio entre os limites
              </p>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-0.5">
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    Min (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={localData.params?.minDuration || 3}
                    onChange={(e) => handleChange('params', {
                      ...localData.params,
                      minDuration: parseInt(e.target.value) || 1
                    })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-xs"
                  />
                </div>
                <div className="space-y-0.5">
                  <label className="block text-[10px] font-medium text-gray-600 dark:text-gray-400">
                    Max (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={localData.params?.maxDuration || 10}
                    onChange={(e) => handleChange('params', {
                      ...localData.params,
                      maxDuration: parseInt(e.target.value) || 1
                    })}
                    className="w-full px-2 py-1.5 bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white text-xs"
                  />
                </div>
              </div>
              {/* Validation warning */}
              {(localData.params?.minDuration || 3) > (localData.params?.maxDuration || 10) && (
                <p className="text-[10px] text-amber-600 dark:text-amber-400">
                  Min deve ser menor que max
                </p>
              )}
            </>
          ) : (
            <>
              {/* Fixed Duration Input */}
              <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
                Tempo (minutos)
              </label>
              <input
                type="number"
                min="1"
                value={localData.params?.duration || 5}
                onChange={(e) => handleChange('params', { ...localData.params, duration: parseInt(e.target.value) })}
                className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
              />
            </>
          )}
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
    </>
  );

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
      default:
        return <p className="text-gray-500">Tipo de no desconhecido</p>;
    }
  };

  const getNodeIcon = () => {
    switch (node.type) {
      case 'trigger': return <Zap className="w-4 h-4 text-green-500" />;
      case 'conversationStep': return <MessageCircle className="w-4 h-4 text-purple-500" />;
      case 'condition': return <GitBranch className="w-4 h-4 text-amber-500" />;
      case 'action': return <PhoneCall className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const getNodeTypeName = () => {
    switch (node.type) {
      case 'trigger': return 'Trigger';
      case 'conversationStep': return 'Etapa de Conversa';
      case 'condition': return 'Condicao';
      case 'action': return 'Acao';
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
