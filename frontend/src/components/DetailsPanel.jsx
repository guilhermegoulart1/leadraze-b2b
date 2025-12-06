// frontend/src/components/DetailsPanel.jsx
import React, { useState, useEffect } from 'react';
import {
  User, Building2, Briefcase, MapPin, Linkedin,
  Mail, Phone, Calendar, Tag, FileText, Bot,
  ChevronDown, ChevronUp, ExternalLink, Edit2, X, Plus
} from 'lucide-react';
import api from '../services/api';

const LEAD_STATUS_OPTIONS = [
  { value: 'leads', label: 'Prospecção', color: 'gray' },
  { value: 'invite_sent', label: 'Convite', color: 'blue' },
  { value: 'qualifying', label: 'Qualificação', color: 'yellow' },
  { value: 'accepted', label: 'Em Andamento', color: 'purple' },
  { value: 'qualified', label: 'Ganho', color: 'green' },
  { value: 'discarded', label: 'Descartado', color: 'red' }
];

const getStatusColorClasses = (color, isActive = false) => {
  if (isActive) {
    const activeColors = {
      gray: 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100 border-gray-300 dark:border-gray-600',
      blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-900 dark:text-blue-300 border-blue-300 dark:border-blue-700',
      yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-900 dark:text-yellow-300 border-yellow-300 dark:border-yellow-700',
      purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-900 dark:text-purple-300 border-purple-300 dark:border-purple-700',
      green: 'bg-green-100 dark:bg-green-900/30 text-green-900 dark:text-green-300 border-green-300 dark:border-green-700',
      red: 'bg-red-100 dark:bg-red-900/30 text-red-900 dark:text-red-300 border-red-300 dark:border-red-700'
    };
    return activeColors[color] || activeColors.gray;
  }
  return 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500';
};

const DetailsPanel = ({ conversationId, isVisible, onTagsUpdated, onConversationUpdated, onOpenContactModal }) => {
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);
  const [expandedSections, setExpandedSections] = useState({
    timeline: false,
    notes: false
  });
  const [editingStatus, setEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [notes, setNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [tags, setTags] = useState([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');

  // Assignment states
  const [users, setUsers] = useState([]);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Sector assignment states
  const [sectors, setSectors] = useState([]);
  const [showSectorMenu, setShowSectorMenu] = useState(false);
  const [assigningSector, setAssigningSector] = useState(false);

  const TAG_COLORS = [
    { name: 'blue', class: 'bg-blue-100 text-blue-700' },
    { name: 'green', class: 'bg-green-100 text-green-700' },
    { name: 'yellow', class: 'bg-yellow-100 text-yellow-700' },
    { name: 'red', class: 'bg-red-100 text-red-700' },
    { name: 'purple', class: 'bg-purple-100 text-purple-700' },
    { name: 'pink', class: 'bg-pink-100 text-pink-700' },
    { name: 'indigo', class: 'bg-indigo-100 text-indigo-700' },
    { name: 'orange', class: 'bg-orange-100 text-orange-700' }
  ];

  useEffect(() => {
    if (conversationId && isVisible) {
      // Limpar estado anterior ao trocar de conversa
      setConversation(null);
      setLoading(true);

      loadConversation();
      loadUsers();
      loadSectors();
    } else {
      // Limpar quando não há conversa selecionada
      setConversation(null);
    }
  }, [conversationId, isVisible]);

  // Close assignment menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showAssignMenu && !event.target.closest('.relative')) {
        setShowAssignMenu(false);
      }
    };

    if (showAssignMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showAssignMenu]);

  // Close sector menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showSectorMenu && !event.target.closest('.relative')) {
        setShowSectorMenu(false);
      }
    };

    if (showSectorMenu) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [showSectorMenu]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      const response = await api.getConversation(conversationId);
      if (response.success) {
        console.log('📊 Dados da conversa carregados:', {
          conversation_id: conversationId,
          lead_id: response.data.lead_id,
          lead_status: response.data.lead_status,
          lead_name: response.data.lead_name,
          assigned_user_id: response.data.assigned_user_id,
          assigned_user_name: response.data.assigned_user_name
        });

        setConversation(response.data);
        setSelectedStatus(response.data.lead_status || '');
        setNotes(response.data.notes || '');
        // Tags herdadas do contato (vêm do backend)
        setTags(response.data.tags || []);
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      if (response.success) {
        // A API pode retornar response.data.users ou response.data diretamente
        const usersList = Array.isArray(response.data) ? response.data : (response.data?.users || []);
        setUsers(usersList);
      }
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
      setUsers([]); // Define como array vazio em caso de erro
    }
  };

  const handleAssignUser = async (userId) => {
    try {
      setAssigning(true);
      const response = await api.assignConversation(conversationId, userId);
      if (response.success) {
        // Reload conversation to get updated assignment
        await loadConversation();
        setShowAssignMenu(false);
        // Notify parent to refresh conversations list
        if (onConversationUpdated) {
          onConversationUpdated();
        }
      }
    } catch (error) {
      console.error('Erro ao atribuir conversa:', error);
      alert('Erro ao atribuir conversa');
    } finally {
      setAssigning(false);
    }
  };

  const handleUnassign = async () => {
    try {
      setAssigning(true);
      const response = await api.unassignConversation(conversationId);
      if (response.success) {
        // Reload conversation to get updated assignment
        await loadConversation();
        setShowAssignMenu(false);
        // Notify parent to refresh conversations list
        if (onConversationUpdated) {
          onConversationUpdated();
        }
      }
    } catch (error) {
      console.error('Erro ao desatribuir conversa:', error);
      alert('Erro ao desatribuir conversa');
    } finally {
      setAssigning(false);
    }
  };

  const loadSectors = async () => {
    try {
      const response = await api.getSectors();
      if (response.success) {
        const sectorsList = Array.isArray(response.data) ? response.data : (response.data?.sectors || []);
        setSectors(sectorsList);
      }
    } catch (error) {
      console.error('Erro ao carregar setores:', error);
      setSectors([]);
    }
  };

  const handleAssignSector = async (sectorId) => {
    try {
      setAssigningSector(true);
      const response = await api.assignSectorToConversation(conversationId, sectorId);
      if (response.success) {
        // Reload conversation to get updated sector assignment
        await loadConversation();
        setShowSectorMenu(false);
        // Notify parent to refresh conversations list
        if (onConversationUpdated) {
          onConversationUpdated();
        }
      }
    } catch (error) {
      console.error('Erro ao atribuir setor:', error);
      alert('Erro ao atribuir setor');
    } finally {
      setAssigningSector(false);
    }
  };

  const handleUnassignSector = async () => {
    try {
      setAssigningSector(true);
      const response = await api.unassignSectorFromConversation(conversationId);
      if (response.success) {
        // Reload conversation to get updated sector assignment
        await loadConversation();
        setShowSectorMenu(false);
        // Notify parent to refresh conversations list
        if (onConversationUpdated) {
          onConversationUpdated();
        }
      }
    } catch (error) {
      console.error('Erro ao desatribuir setor:', error);
      alert('Erro ao desatribuir setor');
    } finally {
      setAssigningSector(false);
    }
  };

  const toggleSection = (section) => {
    setExpandedSections({
      ...expandedSections,
      [section]: !expandedSections[section]
    });
  };

  const handleStatusChange = async (newStatus) => {
    try {
      console.log('📋 Atualizando status do lead:', {
        lead_id: conversation.lead_id,
        current_status: selectedStatus,
        new_status: newStatus
      });

      const response = await api.updateLeadStatus(conversation.lead_id, newStatus);

      console.log('✅ Status atualizado com sucesso:', response);

      setConversation({ ...conversation, lead_status: newStatus });
      setSelectedStatus(newStatus);
      setEditingStatus(false);
    } catch (error) {
      console.error('❌ Erro ao atualizar status:', error);
      alert(`Erro ao atualizar etapa do lead: ${error.message || 'Erro desconhecido'}`);
    }
  };

  const handleSaveNotes = async () => {
    try {
      setSavingNotes(true);
      // TODO: Implementar endpoint para salvar notas
      console.log('Salvando notas:', notes);
    } catch (error) {
      console.error('Erro ao salvar notas:', error);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleAddTag = async () => {
    if (!newTagName.trim() || !conversation?.lead_id) return;

    try {
      // Primeiro, criar a tag se não existir ou buscar existente
      let tagToAdd = null;

      // Buscar tags existentes
      const tagsResponse = await api.getTags();
      if (tagsResponse.success) {
        const existingTags = tagsResponse.data.tags || [];
        tagToAdd = existingTags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase());
      }

      // Se não existe, criar nova tag
      if (!tagToAdd) {
        const createResponse = await api.createTag({ name: newTagName.trim(), color: newTagColor });
        if (createResponse.success) {
          tagToAdd = createResponse.data.tag;
        }
      }

      if (tagToAdd) {
        // Adicionar tag ao lead (que adiciona ao contato vinculado)
        const addResponse = await api.addTagToLead(conversation.lead_id, tagToAdd.id);
        if (addResponse.success) {
          const updatedTags = [...tags, tagToAdd];
          setTags(updatedTags);
          setNewTagName('');
          setNewTagColor('blue');
          setShowTagInput(false);

          // Atualizar tags na lista de conversas
          if (onTagsUpdated && conversationId) {
            onTagsUpdated(conversationId, updatedTags);
          }
        }
      }
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
    }
  };

  const handleRemoveTag = async (tagId) => {
    if (!conversation?.lead_id) return;

    try {
      // Remover tag do lead (que remove do contato vinculado)
      const response = await api.removeTagFromLead(conversation.lead_id, tagId);
      if (response.success) {
        const updatedTags = tags.filter(t => t.id !== tagId);
        setTags(updatedTags);

        // Atualizar tags na lista de conversas
        if (onTagsUpdated && conversationId) {
          onTagsUpdated(conversationId, updatedTags);
        }
      }
    } catch (error) {
      console.error('Erro ao remover tag:', error);
    }
  };

  if (!isVisible) return null;

  if (!conversationId) {
    return (
      <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex items-center justify-center p-6">
        <div className="text-center">
          <User className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
          <p className="text-sm text-gray-600 dark:text-gray-400">Selecione uma conversa</p>
        </div>
      </div>
    );
  }

  const currentStatus = LEAD_STATUS_OPTIONS.find(opt => opt.value === selectedStatus);

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header - Informações */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-gray-100">Informações</h3>
            </div>

            {/* Profile Picture & Name */}
            <div className="text-center mb-4">
              {conversation?.lead_picture ? (
                <img
                  src={conversation.lead_picture}
                  alt={conversation.lead_name}
                  className="w-20 h-20 rounded-full object-cover mx-auto mb-3"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-3">
                  <span className="text-white font-semibold text-2xl">
                    {conversation?.lead_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              {conversation?.contact_id && onOpenContactModal ? (
                <button
                  onClick={() => onOpenContactModal(conversation.contact_id)}
                  className="font-semibold text-gray-900 dark:text-gray-100 text-lg mb-1 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                >
                  {conversation?.lead_name}
                </button>
              ) : (
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-lg mb-1">
                  {conversation?.lead_name}
                </h3>
              )}
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Cliente desde {conversation?.created_at ? new Date(conversation.created_at).toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }) : 'N/A'}
              </p>
            </div>

            {/* Info Grid */}
            <div className="space-y-3 mb-4">
              {/* Campanha */}
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Campanha</p>
                <div className="flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-sm text-gray-900 dark:text-gray-100">
                    {conversation?.campaign_name || 'Não atribuído'}
                  </span>
                </div>
              </div>

              {/* Atribuição */}
              <div className="relative">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Atribuído a</p>
                <div className="flex items-center gap-2">
                  <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <button
                    onClick={() => setShowAssignMenu(!showAssignMenu)}
                    className="text-sm text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
                    disabled={assigning}
                  >
                    {assigning ? 'Atualizando...' : (conversation?.assigned_user_name || 'Não atribuída')}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                {/* Dropdown menu */}
                {showAssignMenu && (
                  <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 py-1 max-h-48 overflow-y-auto">
                    {conversation?.assigned_user_id && (
                      <>
                        <button
                          onClick={handleUnassign}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          ✕ Desatribuir
                        </button>
                        <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                      </>
                    )}
                    {users.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => handleAssignUser(user.id)}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          conversation?.assigned_user_id === user.id
                            ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        {user.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Setor */}
              <div className="relative">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Setor</p>
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <button
                    onClick={() => setShowSectorMenu(!showSectorMenu)}
                    className="text-sm text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
                    disabled={assigningSector}
                  >
                    {assigningSector ? 'Atualizando...' : (conversation?.sector_name || 'Não atribuído')}
                    <ChevronDown className="w-3 h-3" />
                  </button>
                </div>

                {/* Dropdown menu */}
                {showSectorMenu && (
                  <div className="absolute z-10 mt-2 w-full bg-white dark:bg-gray-800 rounded-lg shadow-lg dark:shadow-gray-900/50 border border-gray-200 dark:border-gray-700 py-1 max-h-48 overflow-y-auto">
                    {conversation?.sector_id && (
                      <>
                        <button
                          onClick={handleUnassignSector}
                          className="w-full px-3 py-2 text-left text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                        >
                          ✕ Desatribuir
                        </button>
                        <div className="border-t border-gray-100 dark:border-gray-700 my-1"></div>
                      </>
                    )}
                    {sectors.map((sector) => (
                      <button
                        key={sector.id}
                        onClick={() => handleAssignSector(sector.id)}
                        className={`w-full px-3 py-2 text-left text-sm transition-colors ${
                          conversation?.sector_id === sector.id
                            ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          {sector.color && (
                            <div
                              className="w-3 h-3 rounded-full"
                              style={{ backgroundColor: sector.color }}
                            ></div>
                          )}
                          <span>{sector.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Email */}
              {conversation?.lead_email && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{conversation.lead_email}</span>
                  </div>
                </div>
              )}

              {/* Telefone */}
              {conversation?.lead_phone && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Telefone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{conversation.lead_phone}</span>
                  </div>
                </div>
              )}

              {/* Empresa */}
              {conversation?.lead_company && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Empresa</p>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{conversation.lead_company}</span>
                  </div>
                </div>
              )}

              {/* Localização */}
              {conversation?.lead_location && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Localização</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{conversation.lead_location}</span>
                  </div>
                </div>
              )}
            </div>

            {/* LinkedIn */}
            {conversation?.lead_profile_url && (
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Perfil LinkedIn</p>
                <a
                  href={conversation.lead_profile_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 text-sm"
                >
                  <Linkedin className="w-4 h-4" />
                  <span>Ver perfil</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Modo de Atendimento */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Modo de Atendimento</p>
            <div className="flex items-center gap-2">
              {conversation?.status === 'ai_active' ? (
                <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
                  <Bot className="w-4 h-4" />
                  <span className="text-sm font-medium">IA Ativa</span>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                  <User className="w-4 h-4" />
                  <span className="text-sm font-medium">Manual</span>
                </div>
              )}
            </div>
          </div>

          {/* Etapa do CRM */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">Etapa do Pipeline</p>
              {!editingStatus && (
                <button
                  onClick={() => setEditingStatus(true)}
                  className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-400"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {editingStatus ? (
              <div className="space-y-1.5">
                {LEAD_STATUS_OPTIONS.map(option => (
                  <button
                    key={option.value}
                    onClick={() => handleStatusChange(option.value)}
                    className={`w-full text-left px-3 py-2 rounded-lg text-sm font-medium transition-colors border ${
                      getStatusColorClasses(option.color, selectedStatus === option.value)
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
                <button
                  onClick={() => setEditingStatus(false)}
                  className="w-full px-3 py-2 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300"
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <div className={`px-3 py-2 rounded-lg text-sm font-medium border ${
                currentStatus?.color
                  ? getStatusColorClasses(currentStatus.color, true)
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 border-gray-300 dark:border-gray-600'
              }`}>
                {currentStatus?.label || 'Selecione'}
              </div>
            )}
          </div>

          {/* Tags Personalizadas */}
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Etiquetas</p>

            <div className="flex flex-wrap gap-2 mb-3">
              {tags.map(tag => (
                <span
                  key={tag.id}
                  className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium ${
                    TAG_COLORS.find(c => c.name === tag.color)?.class || 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tag.name}
                  <button
                    onClick={() => handleRemoveTag(tag.id)}
                    className="hover:opacity-70"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </span>
              ))}
            </div>

            {showTagInput ? (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder="Nome da etiqueta..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTag();
                    if (e.key === 'Escape') setShowTagInput(false);
                  }}
                  autoFocus
                />
                <div className="flex gap-1">
                  {TAG_COLORS.map(color => (
                    <button
                      key={color.name}
                      onClick={() => setNewTagColor(color.name)}
                      className={`w-6 h-6 rounded-full ${color.class} ${
                        newTagColor === color.name ? 'ring-2 ring-offset-1 dark:ring-offset-gray-800 ring-purple-500' : ''
                      }`}
                    />
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTag}
                    className="flex-1 px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-sm font-medium"
                  >
                    Adicionar
                  </button>
                  <button
                    onClick={() => {
                      setShowTagInput(false);
                      setNewTagName('');
                      setNewTagColor('blue');
                    }}
                    className="px-3 py-2 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-sm"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                onClick={() => setShowTagInput(true)}
                className="flex items-center gap-2 text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 text-sm font-medium"
              >
                <Plus className="w-4 h-4" />
                Nova etiqueta
              </button>
            )}
          </div>

          {/* Linha do Tempo - Collapsible */}
          <div className="border-b border-gray-200 dark:border-gray-700">
            <button
              onClick={() => toggleSection('timeline')}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
                  Linha do Tempo
                </span>
              </div>
              {expandedSections.timeline ? (
                <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              )}
            </button>

            {expandedSections.timeline && (
              <div className="px-6 pb-6 space-y-3">
                {conversation?.created_at && (
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-blue-500 rounded-full mt-1.5" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Conversa iniciada</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(conversation.created_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )}

                {conversation?.last_message_at && (
                  <div className="flex items-start gap-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5" />
                    <div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Última mensagem</p>
                      <p className="text-sm text-gray-900 dark:text-gray-100">
                        {new Date(conversation.last_message_at).toLocaleString('pt-BR')}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Notas Internas - Expandable */}
          <div className="flex-1">
            <button
              onClick={() => toggleSection('notes')}
              className="w-full flex items-center justify-between p-6 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors border-b border-gray-200 dark:border-gray-700"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">Notas Internas</span>
              </div>
              {expandedSections.notes ? (
                <ChevronUp className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              ) : (
                <ChevronDown className="w-4 h-4 text-gray-400 dark:text-gray-500" />
              )}
            </button>

            {expandedSections.notes && (
              <div className="p-6">
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Adicione notas privadas sobre este lead..."
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none mb-3 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
                  rows="6"
                />
                <button
                  onClick={handleSaveNotes}
                  disabled={savingNotes}
                  className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors text-sm font-medium disabled:opacity-50"
                >
                  {savingNotes ? 'Salvando...' : 'Salvar Notas'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default DetailsPanel;
