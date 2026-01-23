// frontend/src/components/DetailsPanel.jsx
import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  User, Building2, Briefcase, MapPin,
  Mail, Phone, Calendar, Tag,
  ChevronDown, ChevronUp, ExternalLink, Edit2, X, Plus,
  Target, AlertTriangle, Map, Loader
} from 'lucide-react';
import api from '../services/api';
import SecretAgentPanel from './SecretAgentPanel';
import SecretAgentModal from './SecretAgentModal';
import QuickCreateOpportunityModal from './QuickCreateOpportunityModal';
import LeadDetailModal from './LeadDetailModal';
import RoadmapExecutionCard from './RoadmapExecutionCard';
import RoadmapExecutionModal from './RoadmapExecutionModal';
import { useAuth } from '../contexts/AuthContext';

const LEAD_STATUS_OPTIONS = [
  { value: 'leads', labelKey: 'details.leadStatus.leads', color: 'gray' },
  { value: 'invite_sent', labelKey: 'details.leadStatus.invite_sent', color: 'blue' },
  { value: 'qualifying', labelKey: 'details.leadStatus.qualifying', color: 'yellow' },
  { value: 'accepted', labelKey: 'details.leadStatus.accepted', color: 'purple' },
  { value: 'qualified', labelKey: 'details.leadStatus.qualified', color: 'green' },
  { value: 'discarded', labelKey: 'details.leadStatus.discarded', color: 'red' }
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
  const { t, i18n } = useTranslation('conversations');
  const { user: currentUser } = useAuth();
  const [conversation, setConversation] = useState(null);
  const [loading, setLoading] = useState(false);

  // Helper to get locale for date formatting
  const getLocale = () => i18n.language === 'en' ? 'en-US' : i18n.language === 'es' ? 'es-ES' : 'pt-BR';
  const [expandedSections, setExpandedSections] = useState({
    timeline: false
  });
  const [editingStatus, setEditingStatus] = useState(false);
  const [selectedStatus, setSelectedStatus] = useState('');
  const [tags, setTags] = useState([]);
  const [showTagInput, setShowTagInput] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState('blue');
  const [availableTags, setAvailableTags] = useState([]);
  const [showTagDropdown, setShowTagDropdown] = useState(false);
  const [tagSearchFilter, setTagSearchFilter] = useState('');

  // Tag processing state (prevent double-clicks)
  const [processingTags, setProcessingTags] = useState(new Set());

  // Assignment states
  const [users, setUsers] = useState([]);
  const [showAssignMenu, setShowAssignMenu] = useState(false);
  const [assigning, setAssigning] = useState(false);

  // Sector assignment states
  const [sectors, setSectors] = useState([]);
  const [showSectorMenu, setShowSectorMenu] = useState(false);
  const [assigningSector, setAssigningSector] = useState(false);

  // Secret Agent Modal state
  const [showSecretAgentModal, setShowSecretAgentModal] = useState(false);

  // Opportunity Modal state
  const [showOpportunityModal, setShowOpportunityModal] = useState(false);

  // Lead Detail Modal state (para ver oportunidade existente)
  const [showLeadDetailModal, setShowLeadDetailModal] = useState(false);
  const [leadDataForModal, setLeadDataForModal] = useState(null);
  const [loadingOpportunity, setLoadingOpportunity] = useState(false);

  // Roadmap executions state
  const [roadmapExecutions, setRoadmapExecutions] = useState([]);
  const [loadingRoadmaps, setLoadingRoadmaps] = useState(false);
  const [roadmapsExpanded, setRoadmapsExpanded] = useState(true);
  const [selectedExecution, setSelectedExecution] = useState(null);
  const [showExecutionModal, setShowExecutionModal] = useState(false);

  // Função para gerar estilos de tag (funciona bem em light e dark mode)
  const getTagStyles = (colorName) => {
    const colorMap = {
      blue: '#2563eb',
      green: '#16a34a',
      yellow: '#ca8a04',
      red: '#dc2626',
      purple: '#9333ea',
      pink: '#db2777',
      indigo: '#6366f1',
      orange: '#ea580c',
      gray: '#6b7280',
    };
    const hex = colorMap[colorName] || colorMap.purple;
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return {
      backgroundColor: `rgba(${r}, ${g}, ${b}, 0.15)`,
      color: hex,
      borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
    };
  };

  // Lista de cores disponíveis para criar novas tags
  const TAG_COLOR_OPTIONS = ['blue', 'green', 'yellow', 'red', 'purple', 'pink', 'indigo', 'orange'];

  useEffect(() => {
    if (conversationId && isVisible) {
      // Limpar estado anterior ao trocar de conversa
      setConversation(null);
      setLoading(true);

      loadConversation();
      loadUsers();
      loadSectors();
      loadAvailableTags();
    } else {
      // Limpar quando não há conversa selecionada
      setConversation(null);
    }
  }, [conversationId, isVisible]);

  const loadAvailableTags = async () => {
    try {
      const response = await api.getTags();
      if (response.success) {
        setAvailableTags(response.data.tags || []);
      }
    } catch (error) {
      console.error('Erro ao carregar tags disponíveis:', error);
      setAvailableTags([]);
    }
  };

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

  // Listen for roadmap-executed event to reload roadmaps
  useEffect(() => {
    const handleRoadmapExecuted = (event) => {
      const { contactId } = event.detail || {};
      // Reload if the event is for the current contact
      if (contactId && conversation?.contact_id === contactId) {
        loadRoadmapExecutions(contactId);
      }
    };

    window.addEventListener('roadmap-executed', handleRoadmapExecuted);
    return () => window.removeEventListener('roadmap-executed', handleRoadmapExecuted);
  }, [conversation?.contact_id]);

  const loadConversation = async () => {
    try {
      setLoading(true);
      const response = await api.getConversation(conversationId);
      if (response.success) {
        console.log('📊 Dados da conversa carregados:', {
          conversation_id: conversationId,
          contact_id: response.data.contact_id,
          opportunity_id: response.data.opportunity_id,
          opportunity_title: response.data.opportunity_title,
          lead_name: response.data.lead_name,
          assigned_user_id: response.data.assigned_user_id,
          assigned_user_name: response.data.assigned_user_name
        });

        setConversation(response.data);
        setSelectedStatus(response.data.lead_status || '');
        // Tags herdadas do contato (vêm do backend)
        setTags(response.data.tags || []);

        // Load roadmap executions if contact_id exists
        if (response.data.contact_id) {
          loadRoadmapExecutions(response.data.contact_id);
        }
      }
    } catch (error) {
      console.error('Erro ao carregar detalhes:', error);
    } finally {
      setLoading(false);
    }
  };

  // Load roadmap executions for contact (exclude cancelled)
  const loadRoadmapExecutions = async (contactId) => {
    try {
      setLoadingRoadmaps(true);
      const response = await api.getContactRoadmapExecutions(contactId);
      if (response.success) {
        // Filter out cancelled roadmaps - they shouldn't appear in the list
        const activeRoadmaps = (response.data || []).filter(exec => exec.status !== 'cancelled');
        setRoadmapExecutions(activeRoadmaps);
      }
    } catch (error) {
      console.error('Erro ao carregar roadmaps:', error);
      setRoadmapExecutions([]);
    } finally {
      setLoadingRoadmaps(false);
    }
  };

  // Handle roadmap task toggle
  const handleRoadmapTaskToggle = (executionId, taskId, updatedTask) => {
    const updateExecution = (exec) => {
      if (exec.id === executionId) {
        const updatedTasks = exec.tasks.map(t =>
          t.id === taskId ? { ...t, ...updatedTask } : t
        );
        const completedCount = updatedTasks.filter(t => t.is_completed).length;
        return {
          ...exec,
          tasks: updatedTasks,
          completed_tasks: completedCount,
          status: completedCount === exec.total_tasks ? 'completed' : exec.status
        };
      }
      return exec;
    };

    setRoadmapExecutions(prev => prev.map(updateExecution));

    // Also update selectedExecution if modal is open
    if (selectedExecution?.id === executionId) {
      setSelectedExecution(prev => updateExecution(prev));
    }
  };

  // Handle roadmap execution cancel - remove from list
  const handleRoadmapCancel = (executionId) => {
    setRoadmapExecutions(prev => prev.filter(exec => exec.id !== executionId));
    setShowExecutionModal(false);
    setSelectedExecution(null);
  };

  // Handle view execution details
  const handleViewExecutionDetails = (execution) => {
    setSelectedExecution(execution);
    setShowExecutionModal(true);
  };

  const loadUsers = async () => {
    try {
      const response = await api.getConversationAssignableUsers();
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
        // Se atribuiu a si mesmo, passar flag para mudar para "Minhas"
        if (onConversationUpdated) {
          const isSelfAssignment = userId === currentUser?.id;
          onConversationUpdated({ switchToMine: isSelfAssignment });
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
          onConversationUpdated({});
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
      // Use conversation-specific endpoint that doesn't require sectors:view permission
      const response = await api.getConversationAssignableSectors();
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

  // Adicionar tag existente ao contato (com atualização otimista)
  const handleSelectExistingTag = async (tagToAdd) => {
    const contactId = conversation?.contact_id;
    if (!contactId || !tagToAdd) return;

    // Prevenir clique duplo na mesma tag
    if (processingTags.has(tagToAdd.id)) return;

    // Verificar se a tag já está adicionada
    if (tags.some(t => t.id === tagToAdd.id)) {
      return;
    }

    // ATUALIZAÇÃO OTIMISTA: Atualizar UI imediatamente
    setTags(prevTags => {
      const updatedTags = [...prevTags, tagToAdd];
      if (onTagsUpdated && conversationId) {
        onTagsUpdated(conversationId, updatedTags);
      }
      return updatedTags;
    });

    // API em segundo plano (sem bloquear UI)
    api.addContactTag(contactId, tagToAdd.id).catch(error => {
      console.error('Erro ao adicionar tag:', error);
      // Reverter se falhar
      setTags(prevTags => {
        const revertedTags = prevTags.filter(t => t.id !== tagToAdd.id);
        if (onTagsUpdated && conversationId) {
          onTagsUpdated(conversationId, revertedTags);
        }
        return revertedTags;
      });
    });
  };

  // Criar nova tag
  const handleAddTag = async () => {
    const contactId = conversation?.contact_id;
    if (!newTagName.trim() || !contactId) return;

    try {
      // Verificar se já existe uma tag com esse nome
      const existingTag = availableTags.find(t => t.name.toLowerCase() === newTagName.trim().toLowerCase());

      if (existingTag) {
        // Se existe, apenas adicionar ao contato
        await handleSelectExistingTag(existingTag);
        setNewTagName('');
        setNewTagColor('blue');
        setShowTagInput(false);
        return;
      }

      // Se não existe, criar nova tag
      const createResponse = await api.createTag({ name: newTagName.trim(), color: newTagColor });
      if (createResponse.success) {
        const tagToAdd = createResponse.data.tag;

        // Adicionar tag ao contato
        const addResponse = await api.addContactTag(contactId, tagToAdd.id);
        if (addResponse.success) {
          // Usar functional setState para evitar race condition
          setTags(prevTags => {
            const updatedTags = [...prevTags, tagToAdd];
            // Atualizar tags na lista de conversas
            if (onTagsUpdated && conversationId) {
              onTagsUpdated(conversationId, updatedTags);
            }
            return updatedTags;
          });
          setNewTagName('');
          setNewTagColor('blue');
          setShowTagInput(false);

          // Atualizar lista de tags disponíveis
          setAvailableTags(prev => [...prev, tagToAdd]);
        }
      }
    } catch (error) {
      console.error('Erro ao adicionar tag:', error);
    }
  };

  // Filtrar tags disponíveis (excluir as já adicionadas)
  const filteredAvailableTags = availableTags.filter(tag => {
    // Excluir tags já adicionadas ao contato
    if (tags.some(t => t.id === tag.id)) return false;
    // Filtrar por texto de busca
    if (tagSearchFilter) {
      return tag.name.toLowerCase().includes(tagSearchFilter.toLowerCase());
    }
    return true;
  });

  const handleRemoveTag = async (tagId) => {
    const contactId = conversation?.contact_id;
    if (!contactId) return;

    // Guardar tag antes de remover (para reverter se falhar)
    const tagToRemove = tags.find(t => t.id === tagId);
    if (!tagToRemove) return;

    // ATUALIZAÇÃO OTIMISTA: Remover da UI imediatamente
    setTags(prevTags => {
      const updatedTags = prevTags.filter(t => t.id !== tagId);
      if (onTagsUpdated && conversationId) {
        onTagsUpdated(conversationId, updatedTags);
      }
      return updatedTags;
    });

    // API em segundo plano (sem bloquear UI)
    api.removeContactTag(contactId, tagId).catch(error => {
      console.error('Erro ao remover tag:', error);
      // Reverter se falhar
      setTags(prevTags => {
        const revertedTags = [...prevTags, tagToRemove];
        if (onTagsUpdated && conversationId) {
          onTagsUpdated(conversationId, revertedTags);
        }
        return revertedTags;
      });
    });
  };

  // Abrir oportunidade existente no LeadDetailModal
  const handleOpenOpportunity = async () => {
    if (!conversation?.opportunity_id) {
      console.warn('⚠️ opportunity_id não encontrado na conversa');
      return;
    }

    setLoadingOpportunity(true);

    try {
      // Buscar dados completos da oportunidade
      const oppResponse = await api.getLead(conversation.opportunity_id);

      if (oppResponse.success) {
        // Backend retorna { opportunity: {...} }, precisamos extrair
        const oppData = oppResponse.data.opportunity || oppResponse.data;

        // Mapear campos da opportunity para o formato esperado pelo LeadDetailModal
        // O modal espera campos como 'name', 'phone', 'responsible_id' etc.
        // Mas a API retorna 'contact_name', 'contact_phone', 'owner_user_id' etc.
        const leadData = {
          // IDs
          id: oppData.id,
          opportunity_id: oppData.id,
          contact_id: oppData.contact_id,

          // Dados do contato (mapeados de contact_* para campos diretos)
          name: oppData.contact_name || oppData.title,
          title: oppData.contact_title,
          email: oppData.contact_email,
          emails: oppData.contact_emails,
          phone: oppData.contact_phone,
          phones: oppData.contact_phones,
          company: oppData.contact_company,
          location: oppData.contact_location,
          profile_picture: oppData.contact_picture,
          profile_url: oppData.contact_profile_url,
          public_identifier: oppData.contact_public_identifier,
          linkedin_profile_id: oppData.contact_linkedin_id,
          website: oppData.contact_website,
          about: oppData.contact_about,
          headline: oppData.contact_headline,

          // Dados adicionais do contato
          industry: oppData.contact_industry,
          city: oppData.contact_city,
          state: oppData.contact_state,
          country: oppData.contact_country,
          connections_count: oppData.contact_connections,
          team_members: oppData.contact_team_members,
          social_links: oppData.contact_social_links,

          // Dados do negócio
          business_category: oppData.contact_business_category,
          rating: oppData.contact_rating,
          review_count: oppData.contact_review_count,

          // Status (baseado em stage ou campos de data)
          status: oppData.discarded_at ? 'discarded' :
                  oppData.won_at ? 'won' :
                  oppData.lost_at ? 'lost' :
                  oppData.qualified_at ? 'qualified' :
                  oppData.qualifying_started_at ? 'qualifying' :
                  oppData.accepted_at ? 'accepted' :
                  oppData.sent_at ? 'invite_sent' : 'leads',

          // Responsável (mapeado de owner_* para responsible_*)
          responsible_id: oppData.owner_user_id,
          responsible_name: oppData.owner_name,
          responsible_avatar: oppData.owner_avatar,

          // Pipeline info
          pipeline_id: oppData.pipeline_id,
          pipeline_name: oppData.pipeline_name,
          stage_id: oppData.stage_id,
          stage_name: oppData.stage_name,
          stage_color: oppData.stage_color,
          is_win_stage: oppData.is_win_stage,
          is_loss_stage: oppData.is_loss_stage,

          // Outros
          source: oppData.source,
          campaign_name: oppData.campaign_name,
          campaign_id: oppData.campaign_id,
          created_at: oppData.created_at,
          updated_at: oppData.updated_at,
          tags: oppData.tags || [],
          value: oppData.value,
          currency: oppData.currency,
          probability: oppData.probability,
          expected_close_date: oppData.expected_close_date,
          notes: oppData.notes || oppData.loss_notes,

          // AI analysis
          ai_profile_analysis: oppData.ai_profile_analysis,
          ai_analyzed_at: oppData.ai_analyzed_at,

          // History (se retornado)
          history: oppData.history,

          // Dados da empresa
          company_description: oppData.contact_company_description,
          company_services: oppData.contact_company_services,
          pain_points: oppData.contact_pain_points
        };

        console.log('📋 Lead data para modal (mapeado):', leadData);
        setLeadDataForModal(leadData);
        setShowLeadDetailModal(true);
      } else {
        console.error('❌ Erro ao buscar oportunidade:', oppResponse);
        alert('Erro ao buscar oportunidade. Tente novamente.');
      }
    } catch (error) {
      console.error('❌ Erro ao carregar oportunidade:', error);
      alert('Erro ao carregar oportunidade: ' + (error.message || 'Erro de conexão. Tente novamente.'));
    } finally {
      setLoadingOpportunity(false);
    }
  };

  if (!isVisible) return null;

  if (!conversationId) {
    return (
      <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex items-center justify-center p-4">
        <div className="text-center">
          <User className="w-10 h-10 text-gray-300 dark:text-gray-600 mx-auto mb-2" />
          <p className="text-sm text-gray-600 dark:text-gray-400">{t('details.selectConversation')}</p>
        </div>
      </div>
    );
  }

  const currentStatus = LEAD_STATUS_OPTIONS.find(opt => opt.value === selectedStatus);

  return (
    <div className="w-72 bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 flex flex-col h-full overflow-y-auto">
      {loading ? (
        <div className="flex items-center justify-center h-full">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      ) : (
        <div className="flex flex-col h-full">
          {/* Header - Informações */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100">{t('details.information')}</h3>
            </div>

            {/* Profile Picture & Name */}
            <div className="text-center mb-3">
              {conversation?.lead_picture ? (
                <img
                  src={conversation.lead_picture}
                  alt={conversation.lead_name}
                  className="w-14 h-14 rounded-full object-cover mx-auto mb-2"
                />
              ) : (
                <div className="w-14 h-14 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center mx-auto mb-2">
                  <span className="text-white font-semibold text-xl">
                    {conversation?.lead_name?.charAt(0) || '?'}
                  </span>
                </div>
              )}
              {conversation?.contact_id && onOpenContactModal ? (
                <button
                  onClick={() => onOpenContactModal(conversation.contact_id)}
                  className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-0.5 hover:text-purple-600 dark:hover:text-purple-400 transition-colors cursor-pointer"
                >
                  {conversation?.lead_name}
                </button>
              ) : (
                <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-0.5">
                  {conversation?.lead_name}
                </h3>
              )}
              <p className="text-xs text-gray-400 dark:text-gray-500">
                {t('details.createdAt')} {conversation?.created_at ? new Date(conversation.created_at).toLocaleDateString(getLocale()) : 'N/A'}
              </p>
            </div>

            {/* Info Grid */}
            <div className="space-y-2 mb-3">
              {/* Atribuição */}
              <div className="relative">
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('details.assignedTo')}</p>
                <div className="flex items-center gap-2">
                  <User className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  <button
                    onClick={() => setShowAssignMenu(!showAssignMenu)}
                    className="text-sm text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
                    disabled={assigning}
                  >
                    {assigning ? t('details.updating') : (conversation?.assigned_user_name || t('sidebar.notAssigned'))}
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
                          ✕ {t('details.unassign')}
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
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('details.sector')}</p>
                <div className="flex items-center gap-2">
                  <Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                  <button
                    onClick={() => setShowSectorMenu(!showSectorMenu)}
                    className="text-sm text-gray-900 dark:text-gray-100 hover:text-purple-600 dark:hover:text-purple-400 transition-colors flex items-center gap-1"
                    disabled={assigningSector}
                  >
                    {assigningSector ? t('details.updating') : (conversation?.sector_name || t('details.notAssigned'))}
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
                          ✕ {t('details.unassign')}
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
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('details.email')}</p>
                  <div className="flex items-center gap-2">
                    <Mail className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{conversation.lead_email}</span>
                  </div>
                </div>
              )}

              {/* Telefone */}
              {conversation?.lead_phone && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('details.phone')}</p>
                  <div className="flex items-center gap-2">
                    <Phone className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{conversation.lead_phone}</span>
                  </div>
                </div>
              )}

              {/* Empresa */}
              {conversation?.lead_company && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('details.company')}</p>
                  <div className="flex items-center gap-2">
                    <Building2 className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{conversation.lead_company}</span>
                  </div>
                </div>
              )}

              {/* Localização */}
              {conversation?.lead_location && (
                <div>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{t('details.location')}</p>
                  <div className="flex items-center gap-2">
                    <MapPin className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" />
                    <span className="text-sm text-gray-900 dark:text-gray-100">{conversation.lead_location}</span>
                  </div>
                </div>
              )}
            </div>

          </div>

          {/* Oportunidade */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('details.opportunity')}</p>
            {conversation?.opportunity_id ? (
              <button
                onClick={handleOpenOpportunity}
                disabled={loadingOpportunity}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-lg transition-colors ${
                  loadingOpportunity ? 'opacity-50 cursor-wait' : 'hover:bg-purple-50 dark:hover:bg-purple-900/20'
                }`}
              >
                {loadingOpportunity ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-2 border-purple-600 border-t-transparent" />
                ) : (
                  <Target className="w-4 h-4" />
                )}
                {loadingOpportunity ? 'Carregando...' : t('details.openOpportunity')}
              </button>
            ) : (
              <button
                onClick={() => setShowOpportunityModal(true)}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 text-sm font-medium text-purple-600 dark:text-purple-400 border border-purple-200 dark:border-purple-800 rounded-lg hover:bg-purple-50 dark:hover:bg-purple-900/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
                {t('details.createOpportunity')}
              </button>
            )}
          </div>

          {/* Qualificação IA */}
          {(conversation?.qualification_score !== undefined && conversation?.qualification_score !== null) && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-3.5 h-3.5 text-purple-500" />
                <p className="text-xs text-gray-500 dark:text-gray-400 font-medium">
                  {t('details.aiQualification', 'Qualificação IA')}
                </p>
              </div>

              {/* Score e Stage */}
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                    conversation.qualification_score >= 80 ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' :
                    conversation.qualification_score >= 60 ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                    conversation.qualification_score >= 40 ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400' :
                    'bg-gray-100 text-gray-700 dark:bg-gray-700 dark:text-gray-400'
                  }`}>
                    {conversation.qualification_score}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-gray-100">
                      {t(`details.qualificationStage.${conversation.qualification_stage}`, conversation.qualification_stage?.toUpperCase() || 'N/A')}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {t('details.qualificationScore', 'Score de qualificação')}
                    </p>
                  </div>
                </div>

                {/* Indicador visual de temperatura */}
                <div className="flex items-center gap-1">
                  {['cold', 'warm', 'MQL', 'SQL', 'hot'].map((stage, index) => {
                    const stageOrder = { cold: 0, warm: 1, MQL: 2, SQL: 3, hot: 4 };
                    const currentOrder = stageOrder[conversation.qualification_stage] ?? -1;
                    const isActive = index <= currentOrder;
                    return (
                      <div
                        key={stage}
                        className={`w-2 h-4 rounded-sm transition-colors ${
                          isActive
                            ? index >= 4 ? 'bg-red-500' :
                              index >= 3 ? 'bg-orange-500' :
                              index >= 2 ? 'bg-yellow-500' :
                              index >= 1 ? 'bg-blue-400' :
                              'bg-blue-200'
                            : 'bg-gray-200 dark:bg-gray-600'
                        }`}
                        title={stage}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Razões da qualificação */}
              {conversation.qualification_reasons && (
                <div className="mt-2">
                  <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                    {t('details.qualificationReasons', 'Motivos:')}
                  </p>
                  <div className="flex flex-wrap gap-1">
                    {(() => {
                      try {
                        const reasons = typeof conversation.qualification_reasons === 'string'
                          ? JSON.parse(conversation.qualification_reasons)
                          : conversation.qualification_reasons;
                        return Array.isArray(reasons) ? reasons.slice(0, 3).map((reason, index) => (
                          <span
                            key={index}
                            className="inline-flex items-center px-2 py-0.5 rounded text-xs bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300"
                          >
                            {reason}
                          </span>
                        )) : null;
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                </div>
              )}

              {/* Objeções detectadas */}
              {conversation.objections_history && (
                <div className="mt-3 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
                  <div className="flex items-center gap-1 mb-1">
                    <AlertTriangle className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                    <p className="text-xs font-medium text-amber-700 dark:text-amber-400">
                      {t('details.objectionsDetected', 'Objeções detectadas')}
                    </p>
                  </div>
                  <div className="space-y-1">
                    {(() => {
                      try {
                        const objections = typeof conversation.objections_history === 'string'
                          ? JSON.parse(conversation.objections_history)
                          : conversation.objections_history;
                        return Array.isArray(objections) ? objections.slice(-2).map((obj, index) => (
                          <div key={index} className="text-xs text-amber-800 dark:text-amber-300">
                            <span className="font-medium capitalize">{obj.type}</span>
                            {obj.text && <span className="ml-1">- "{obj.text}"</span>}
                          </div>
                        )) : null;
                      } catch {
                        return null;
                      }
                    })()}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Roadmaps Section - Moved above Tags */}
          {conversation?.contact_id && (
            <div className="p-4 border-b border-gray-200 dark:border-gray-700">
              <button
                onClick={() => setRoadmapsExpanded(!roadmapsExpanded)}
                className="w-full flex items-center justify-between mb-2 text-left"
              >
                <div className="flex items-center gap-2">
                  <Map className="w-4 h-4 text-blue-500" />
                  <span className="text-xs font-medium text-gray-700 dark:text-gray-300">
                    {t('details.roadmaps', 'Roadmaps')}
                  </span>
                  {roadmapExecutions.filter(e => e.status === 'in_progress').length > 0 && (
                    <span className="px-1.5 py-0.5 text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full">
                      {roadmapExecutions.filter(e => e.status === 'in_progress').length}
                    </span>
                  )}
                </div>
                {roadmapsExpanded ? (
                  <ChevronUp className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {roadmapsExpanded && (
                <div className="space-y-1">
                  {loadingRoadmaps ? (
                    <div className="flex items-center justify-center py-4">
                      <Loader className="w-5 h-5 animate-spin text-blue-500" />
                    </div>
                  ) : roadmapExecutions.length > 0 ? (
                    <>
                      {/* In progress executions - only expand the last one */}
                      {(() => {
                        const inProgressExecs = roadmapExecutions.filter(exec => exec.status === 'in_progress');
                        return inProgressExecs.map((execution, index) => (
                          <RoadmapExecutionCard
                            key={execution.id}
                            execution={execution}
                            onTaskToggle={handleRoadmapTaskToggle}
                            onViewDetails={handleViewExecutionDetails}
                            defaultExpanded={index === inProgressExecs.length - 1}
                          />
                        ));
                      })()}
                      {/* Completed executions collapsed */}
                      {roadmapExecutions
                        .filter(exec => exec.status === 'completed')
                        .map(execution => (
                          <RoadmapExecutionCard
                            key={execution.id}
                            execution={execution}
                            onTaskToggle={handleRoadmapTaskToggle}
                            onViewDetails={handleViewExecutionDetails}
                            defaultExpanded={false}
                          />
                        ))
                      }
                    </>
                  ) : (
                    <p className="text-xs text-gray-500 dark:text-gray-400 text-center py-2">
                      {t('details.noRoadmaps', 'Nenhum roadmap em execução')}
                    </p>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Tags Personalizadas */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs text-gray-500 dark:text-gray-400">{t('details.tags')}</p>
              <span className="text-[10px] text-gray-400">{t('details.clickToToggle', 'clique para selecionar')}</span>
            </div>

            {/* Lista de todas as tags - clicáveis */}
            {!showTagInput ? (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto">
                  {availableTags.map(tag => {
                    const isSelected = tags.some(t => t.id === tag.id);
                    const tagStyles = getTagStyles(tag.color);
                    return (
                      <button
                        key={tag.id}
                        type="button"
                        onClick={() => isSelected ? handleRemoveTag(tag.id) : handleSelectExistingTag(tag)}
                        className={`px-2.5 py-1 text-xs font-medium rounded-full border transition-all ${
                          isSelected
                            ? 'ring-2 ring-purple-500 ring-offset-1 dark:ring-offset-gray-800'
                            : 'hover:opacity-80'
                        }`}
                        style={tagStyles}
                      >
                        {isSelected && <span className="mr-1">✓</span>}
                        {tag.name}
                      </button>
                    );
                  })}
                  {availableTags.length === 0 && (
                    <span className="text-xs text-gray-400 dark:text-gray-500">
                      {t('details.noTagsAvailable', 'Nenhuma etiqueta cadastrada')}
                    </span>
                  )}
                </div>

                {/* Botão para criar nova tag */}
                <button
                  type="button"
                  onClick={() => setShowTagInput(true)}
                  className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('details.newTag')}
                </button>
              </div>
            ) : (
              /* Formulário para criar nova tag */
              <div className="space-y-2 p-3 bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <input
                  type="text"
                  value={newTagName}
                  onChange={(e) => setNewTagName(e.target.value)}
                  placeholder={t('details.tagNamePlaceholder')}
                  className="w-full px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddTag();
                    if (e.key === 'Escape') {
                      setShowTagInput(false);
                      setNewTagName('');
                    }
                  }}
                  autoFocus
                />
                <div className="flex gap-1">
                  {TAG_COLOR_OPTIONS.map(colorName => {
                    const colorStyles = getTagStyles(colorName);
                    return (
                      <button
                        key={colorName}
                        onClick={() => setNewTagColor(colorName)}
                        className={`w-5 h-5 rounded-full border ${
                          newTagColor === colorName ? 'ring-2 ring-offset-1 dark:ring-offset-gray-700 ring-purple-500' : ''
                        }`}
                        style={{ backgroundColor: colorStyles.color }}
                      />
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddTag}
                    disabled={!newTagName.trim()}
                    className="flex-1 px-3 py-1.5 bg-purple-600 text-white rounded-lg hover:bg-purple-700 text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {t('details.add')}
                  </button>
                  <button
                    onClick={() => {
                      setShowTagInput(false);
                      setNewTagName('');
                      setNewTagColor('blue');
                    }}
                    className="px-3 py-1.5 text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 text-xs"
                  >
                    {t('details.cancel')}
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Secret Agent Panel */}
          <div className="p-4 border-b border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">{t('secretAgentCoaching:team.title')}</p>
            <SecretAgentPanel
              onCallAgent={() => setShowSecretAgentModal(true)}
            />
          </div>

        </div>
      )}

      {/* Secret Agent Modal */}
      <SecretAgentModal
        isOpen={showSecretAgentModal}
        onClose={() => setShowSecretAgentModal(false)}
        conversationId={conversationId}
        onSuccess={() => {
          // Resultado é mostrado no próprio modal
          // Não fecha automaticamente
        }}
      />

      {/* Quick Create Opportunity Modal */}
      <QuickCreateOpportunityModal
        isOpen={showOpportunityModal}
        onClose={() => setShowOpportunityModal(false)}
        conversation={conversation}
        onSuccess={() => {
          setShowOpportunityModal(false);
          loadConversation();
          if (onConversationUpdated) {
            onConversationUpdated();
          }
        }}
      />

      {/* Lead Detail Modal (para ver oportunidade existente) */}
      {showLeadDetailModal && leadDataForModal && (
        <LeadDetailModal
          lead={leadDataForModal}
          onClose={() => {
            setShowLeadDetailModal(false);
            setLeadDataForModal(null);
          }}
          onLeadUpdated={() => {
            loadConversation();
            if (onConversationUpdated) {
              onConversationUpdated();
            }
          }}
          onViewContact={(contactId) => {
            // Fecha o LeadDetailModal e abre o modal de contato
            setShowLeadDetailModal(false);
            setLeadDataForModal(null);
            if (onOpenContactModal && contactId) {
              onOpenContactModal(contactId);
            }
          }}
        />
      )}

      {/* Roadmap Execution Detail Modal */}
      <RoadmapExecutionModal
        execution={selectedExecution}
        isOpen={showExecutionModal}
        onClose={() => {
          setShowExecutionModal(false);
          setSelectedExecution(null);
        }}
        onTaskToggle={handleRoadmapTaskToggle}
        onCancel={handleRoadmapCancel}
      />
    </div>
  );
};

export default DetailsPanel;
