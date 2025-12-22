// frontend/src/components/aiemployees/FollowUpBuilder/PropertiesPanel.jsx
// Panel for editing follow-up node properties

import React, { useState, useEffect } from 'react';
import { X, Trash2, Clock, Send, Tag, MinusCircle, PhoneCall, XCircle, Mail, Sparkles, Plus } from 'lucide-react';
import api from '../../../services/api';

// Preset colors for tags
const PRESET_COLORS = [
  { name: 'Roxo', hex: '#9333ea' },
  { name: 'Azul', hex: '#2563eb' },
  { name: 'Verde', hex: '#16a34a' },
  { name: 'Amarelo', hex: '#ca8a04' },
  { name: 'Vermelho', hex: '#dc2626' },
  { name: 'Rosa', hex: '#db2777' },
  { name: 'Laranja', hex: '#ea580c' },
  { name: 'Cinza', hex: '#6b7280' }
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
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);

  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
    color: hex,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
  };
};

const PropertiesPanel = ({ node, onUpdate, onDelete, onClose }) => {
  const [localData, setLocalData] = useState(node.data);
  const [tags, setTags] = useState([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [showNewTagForm, setShowNewTagForm] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(PRESET_COLORS[0].hex);
  const [creatingTag, setCreatingTag] = useState(false);

  useEffect(() => {
    setLocalData(node.data);
  }, [node]);

  // Load tags when action type is add_tag or remove_tag
  useEffect(() => {
    if (localData.actionType === 'add_tag' || localData.actionType === 'remove_tag') {
      loadTags();
    }
  }, [localData.actionType]);

  const loadTags = async () => {
    setLoadingTags(true);
    try {
      const response = await api.getTags();

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

  const handleChange = (field, value) => {
    const newData = { ...localData, [field]: value };
    setLocalData(newData);
    onUpdate(node.id, newData);
  };

  const handleParamsChange = (paramField, value) => {
    const newParams = { ...(localData.params || {}), [paramField]: value };
    const newData = { ...localData, params: newParams };
    setLocalData(newData);
    onUpdate(node.id, newData);
  };

  const handleTagToggle = (tag) => {
    const currentTags = localData.params?.tags || [];
    const isSelected = currentTags.some(t => t.name === tag.name);
    const newTags = isSelected
      ? currentTags.filter(t => t.name !== tag.name)
      : [...currentTags, { name: tag.name, color: tag.color }];
    handleParamsChange('tags', newTags);
  };

  const handleCreateTag = async () => {
    if (!newTagName.trim()) return;

    setCreatingTag(true);
    try {
      const response = await api.createTag({
        name: newTagName.trim(),
        color: newTagColor
      });

      if (response?.success || response?.data) {
        // Reload tags to get the updated list
        await loadTags();

        // Auto-select new tag for add_tag action
        if (localData.actionType === 'add_tag') {
          const currentTags = localData.params?.tags || [];
          handleParamsChange('tags', [...currentTags, { name: newTagName.trim(), color: newTagColor }]);
        }
      }

      setNewTagName('');
      setShowNewTagForm(false);
    } catch (error) {
      console.error('Error creating tag:', error);
    } finally {
      setCreatingTag(false);
    }
  };

  const renderTriggerProperties = () => (
    <>
      <div className="p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800 mb-2">
        <p className="text-[10px] text-green-700 dark:text-green-400">
          Este trigger inicia o fluxo de follow-up quando o lead nao responde.
          Use nos de "Aguardar" para definir os tempos de espera.
        </p>
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Nome do Trigger
        </label>
        <input
          type="text"
          value={localData.label || ''}
          onChange={(e) => handleChange('label', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white"
          placeholder="Ex: Sem Resposta"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Descricao (opcional)
        </label>
        <input
          type="text"
          value={localData.description || ''}
          onChange={(e) => handleChange('description', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white"
          placeholder="Quando lead nao responde..."
        />
      </div>
    </>
  );

  const renderTagSelector = () => {
    const selectedTags = localData.params?.tags || [];

    return (
      <div className="space-y-2">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          <Tag className="w-3 h-3 inline mr-0.5" />
          {localData.actionType === 'add_tag' ? 'Adicionar Tags' : 'Remover Tags'}
          <span className="text-[10px] text-gray-400 ml-1">(clique para selecionar)</span>
        </label>

        {loadingTags ? (
          <div className="flex items-center gap-1.5 text-[11px] text-gray-500 dark:text-gray-400">
            <div className="w-3 h-3 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
            Carregando...
          </div>
        ) : (
          <>
            <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
              {tags.map((tag) => {
                const isSelected = selectedTags.some(t => t.name === tag.name);
                const tagStyles = getTagStyles(tag.color);
                return (
                  <button
                    key={tag.id || tag.name}
                    type="button"
                    onClick={() => handleTagToggle(tag)}
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

            {/* Tags selecionadas */}
            {selectedTags.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-gray-500 dark:text-gray-400">
                    {selectedTags.length} tag(s) selecionada(s):
                  </span>
                  <button
                    type="button"
                    onClick={() => handleParamsChange('tags', [])}
                    className="text-[10px] text-red-500 hover:text-red-600 transition-colors"
                  >
                    Limpar todas
                  </button>
                </div>
                <div className="flex flex-wrap gap-1">
                  {selectedTags.map((tag, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded border"
                      style={getTagStyles(tag.color)}
                    >
                      {tag.name}
                      <button
                        type="button"
                        onClick={() => {
                          const newTags = selectedTags.filter((_, i) => i !== idx);
                          handleParamsChange('tags', newTags);
                        }}
                        className="hover:opacity-70"
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* New tag form */}
            {localData.actionType === 'add_tag' && (
              <>
                {showNewTagForm ? (
                  <div className="p-2 bg-gray-50 dark:bg-gray-700/50 rounded-lg space-y-2">
                    <input
                      type="text"
                      value={newTagName}
                      onChange={(e) => setNewTagName(e.target.value)}
                      placeholder="Nome da tag"
                      className="w-full px-2 py-1 text-[11px] bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded focus:ring-2 focus:ring-purple-500 dark:text-white"
                    />
                    <div className="flex gap-1">
                      {PRESET_COLORS.map((color) => (
                        <button
                          key={color.hex}
                          onClick={() => setNewTagColor(color.hex)}
                          className={`w-5 h-5 rounded-full transition-transform ${
                            newTagColor === color.hex ? 'ring-2 ring-offset-1 ring-gray-400 scale-110' : ''
                          }`}
                          style={{ backgroundColor: color.hex }}
                          title={color.name}
                        />
                      ))}
                    </div>
                    <div className="flex gap-1">
                      <button
                        onClick={handleCreateTag}
                        disabled={!newTagName.trim() || creatingTag}
                        className="flex-1 px-2 py-1 text-[10px] bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        {creatingTag ? 'Criando...' : 'Criar'}
                      </button>
                      <button
                        onClick={() => {
                          setShowNewTagForm(false);
                          setNewTagName('');
                        }}
                        className="px-2 py-1 text-[10px] border border-gray-300 dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600 dark:text-gray-300"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewTagForm(true)}
                    className="flex items-center gap-1 px-2 py-1 text-[10px] text-purple-600 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/20 rounded transition-colors"
                  >
                    <Plus className="w-3 h-3" />
                    Criar nova tag
                  </button>
                )}
              </>
            )}
          </>
        )}
      </div>
    );
  };

  const renderRemoveTagOptions = () => {
    const removeAll = localData.params?.removeAll || false;

    return (
      <div className="space-y-2">
        {/* Remove all toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleParamsChange('removeAll', !removeAll)}
            className={`
              relative w-8 h-4 rounded-full transition-colors
              ${removeAll ? 'bg-red-500' : 'bg-gray-300 dark:bg-gray-600'}
            `}
          >
            <span
              className={`
                absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-transform
                ${removeAll ? 'translate-x-4' : 'translate-x-0.5'}
              `}
            />
          </button>
          <span className="text-[11px] text-gray-700 dark:text-gray-300">
            Remover TODAS as tags
          </span>
        </div>

        {removeAll && (
          <div className="p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <p className="text-[10px] text-red-600 dark:text-red-400">
              Todas as tags do lead serao removidas
            </p>
          </div>
        )}

        {!removeAll && renderTagSelector()}
      </div>
    );
  };

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
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white"
          placeholder="Nome da acao"
        />
      </div>

      <div className="space-y-1">
        <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
          Tipo de Acao
        </label>
        <select
          value={localData.actionType || 'send_message'}
          onChange={(e) => handleChange('actionType', e.target.value)}
          className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white"
        >
          <option value="wait">Aguardar</option>
          <option value="send_message">Enviar Mensagem</option>
          <option value="ai_message">Mensagem com IA</option>
          <option value="send_email">Enviar Email</option>
          <option value="add_tag">Adicionar Tag</option>
          <option value="remove_tag">Remover Tag</option>
          <option value="transfer">Transferir</option>
          <option value="close_negative">Encerrar (Perdido)</option>
        </select>
      </div>

      {/* Wait time configuration */}
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
              <option value="minutes">Minutos</option>
              <option value="hours">Horas</option>
              <option value="days">Dias</option>
            </select>
          </div>
          <p className="text-[10px] text-gray-500 dark:text-gray-400">
            Aguarda este tempo sem resposta antes de continuar
          </p>
        </div>
      )}

      {/* Message for send_message */}
      {localData.actionType === 'send_message' && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            <Send className="w-3 h-3 inline mr-1" />
            Mensagem de Follow-up
          </label>
          <textarea
            value={localData.message || ''}
            onChange={(e) => handleChange('message', e.target.value)}
            rows={3}
            className="w-full px-2 py-1.5 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white resize-none"
            placeholder="Ola! Notei que ainda nao tivemos retorno..."
          />
        </div>
      )}

      {/* AI Instructions for ai_message */}
      {localData.actionType === 'ai_message' && (
        <div className="space-y-2">
          <div className="p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
            <div className="flex items-center gap-1.5 text-purple-700 dark:text-purple-400 text-[11px] font-medium mb-1">
              <Sparkles className="w-3 h-3" />
              Mensagem com IA
            </div>
            <p className="text-[10px] text-gray-600 dark:text-gray-400">
              A IA ira gerar uma mensagem personalizada baseada nas instrucoes abaixo e no contexto da conversa.
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
              Instrucoes para a IA
            </label>
            <textarea
              value={localData.aiInstructions || ''}
              onChange={(e) => handleChange('aiInstructions', e.target.value)}
              rows={4}
              className="w-full px-2 py-1.5 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white resize-none"
              placeholder="Ex: Envie uma mensagem curta e amigavel perguntando se o lead teve tempo de analisar a proposta. Mencione um beneficio do produto."
            />
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Descreva o tom, objetivo e pontos importantes da mensagem
            </p>
          </div>

          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
              Tamanho Maximo (opcional)
            </label>
            <select
              value={localData.aiMaxLength || 'medium'}
              onChange={(e) => handleChange('aiMaxLength', e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-purple-500 dark:text-white"
            >
              <option value="short">Curta (1-2 frases)</option>
              <option value="medium">Media (3-4 frases)</option>
              <option value="long">Longa (paragrafo)</option>
            </select>
          </div>
        </div>
      )}

      {/* Email for send_email */}
      {localData.actionType === 'send_email' && (
        <>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
              <Mail className="w-3 h-3 inline mr-1" />
              Assunto do Email
            </label>
            <input
              type="text"
              value={localData.emailSubject || ''}
              onChange={(e) => handleChange('emailSubject', e.target.value)}
              className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white"
              placeholder="Tentando contato novamente..."
            />
          </div>
          <div className="space-y-1">
            <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
              Corpo do Email
            </label>
            <textarea
              value={localData.emailBody || ''}
              onChange={(e) => handleChange('emailBody', e.target.value)}
              rows={4}
              className="w-full px-2 py-1.5 text-[11px] bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white resize-none"
              placeholder="Ola {{first_name}},&#10;&#10;Tentei contato anteriormente..."
            />
          </div>
        </>
      )}

      {/* Add tag */}
      {localData.actionType === 'add_tag' && renderTagSelector()}

      {/* Remove tag */}
      {localData.actionType === 'remove_tag' && renderRemoveTagOptions()}

      {/* Close negative reason */}
      {localData.actionType === 'close_negative' && (
        <div className="space-y-1">
          <label className="block text-[11px] font-medium text-gray-700 dark:text-gray-300">
            <XCircle className="w-3 h-3 inline mr-1" />
            Motivo do Encerramento
          </label>
          <select
            value={localData.closeReason || 'no_response'}
            onChange={(e) => handleChange('closeReason', e.target.value)}
            className="w-full px-2 py-1.5 text-xs bg-gray-50 dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-orange-500 dark:text-white"
          >
            <option value="no_response">Sem resposta</option>
            <option value="not_interested">Nao interessado</option>
            <option value="wrong_contact">Contato errado</option>
            <option value="other">Outro</option>
          </select>
        </div>
      )}
    </>
  );

  const renderProperties = () => {
    switch (node.type) {
      case 'trigger':
        return renderTriggerProperties();
      case 'action':
        return renderActionProperties();
      default:
        return <p className="text-gray-500">Tipo de no desconhecido</p>;
    }
  };

  const getNodeIcon = () => {
    switch (node.type) {
      case 'trigger': return <Clock className="w-4 h-4 text-green-500" />;
      case 'action': return <Send className="w-4 h-4 text-blue-500" />;
      default: return null;
    }
  };

  const getNodeTypeName = () => {
    switch (node.type) {
      case 'trigger': return 'Trigger';
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
