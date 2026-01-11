// frontend/src/pages/ConversationsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { onConversationUpdated, onNewConversation, onNewMessage } from '../services/ably';
import ConversationSidebar from '../components/ConversationSidebar';
import ChatArea from '../components/ChatArea';
import DetailsPanel from '../components/DetailsPanel';
import UnifiedContactModal from '../components/UnifiedContactModal';
import QuickCreateOpportunityModal from '../components/QuickCreateOpportunityModal';

const ConversationsPage = () => {
  const { t } = useTranslation(['conversations', 'common']);
  const { refreshUnreadCount } = useOutletContext();
  const { user } = useAuth();
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('mine'); // Default: minhas conversas
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [stats, setStats] = useState({
    mine: 0,
    all: 0,
    unassigned: 0,
    closed: 0
  });

  // Estados para filtros avançados
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    mode: 'all', // all | ai | manual
    assignedUserId: null,
    period: 'all',
    tags: []
  });
  const [users, setUsers] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);

  // Estado para o modal unificado de contato
  const [contactModal, setContactModal] = useState({ isOpen: false, contactId: null });

  // Estado para o modal de criar oportunidade
  const [opportunityModal, setOpportunityModal] = useState({ isOpen: false, conversation: null });

  useEffect(() => {
    loadConversations();
    loadStats();
    loadUsers();
    loadTags();
  }, []);

  useEffect(() => {
    filterConversations();
  }, [searchQuery, statusFilter, conversations, advancedFilters, user]);

  // ✅ Realtime: Escutar atualizações de conversas em tempo real via Ably
  useEffect(() => {
    // Handler para conversa atualizada
    const handleConversationUpdated = (data, source) => {
      console.log(`ConversationsPage: conversation_updated via ${source}`, data);

      setConversations(prev => prev.map(conv => {
        if (conv.id === data.conversationId || conv.id === parseInt(data.conversationId)) {
          return {
            ...conv,
            last_message_preview: data.lastMessage?.content || conv.last_message_preview,
            last_message_at: data.lastMessage?.sent_at || new Date().toISOString(),
            unread_count: data.unreadCount ?? conv.unread_count
          };
        }
        return conv;
      }));

      // Atualizar contador global de não lidas
      if (refreshUnreadCount) {
        refreshUnreadCount();
      }
    };

    // Handler para nova conversa
    const handleNewConversation = (data, source) => {
      console.log(`ConversationsPage: new_conversation via ${source}`, data);

      // Verificar se já existe (evitar duplicatas)
      setConversations(prev => {
        const exists = prev.some(c => c.id === data.conversation?.id);
        if (exists) return prev;

        // Adicionar no início da lista
        return [data.conversation, ...prev];
      });

      // Atualizar stats
      loadStats();
    };

    // Handler para novas mensagens (atualiza lista quando chega mensagem)
    const handleNewMessage = (data, source) => {
      console.log(`ConversationsPage: new_message via ${source}`, data);

      setConversations(prev => {
        // Encontrar e atualizar a conversa
        const updated = prev.map(conv => {
          if (conv.id === data.conversationId || conv.id === parseInt(data.conversationId)) {
            return {
              ...conv,
              last_message_preview: data.message?.content || conv.last_message_preview,
              last_message_at: data.message?.sent_at || new Date().toISOString(),
              unread_count: data.unreadCount ?? conv.unread_count
            };
          }
          return conv;
        });

        // Reordenar para colocar a conversa atualizada no topo
        const convIndex = updated.findIndex(c =>
          c.id === data.conversationId || c.id === parseInt(data.conversationId)
        );

        if (convIndex > 0) {
          const [conv] = updated.splice(convIndex, 1);
          updated.unshift(conv);
        }

        return updated;
      });

      // Atualizar contador global de não lidas
      if (refreshUnreadCount) {
        refreshUnreadCount();
      }
    };

    // Ably listeners (realtime)
    const unsubscribeUpdated = onConversationUpdated((data) => handleConversationUpdated(data, 'Ably'));
    const unsubscribeNew = onNewConversation((data) => handleNewConversation(data, 'Ably'));
    const unsubscribeMessage = onNewMessage((data) => handleNewMessage(data, 'Ably'));

    // Cleanup
    return () => {
      unsubscribeUpdated();
      unsubscribeNew();
      unsubscribeMessage();
    };
  }, [refreshUnreadCount]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      const response = await api.getConversations({ limit: 100 });

      if (response.success) {
        setConversations(response.data.conversations || []);
      }
    } catch (error) {
      console.error('Erro ao carregar conversas:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const response = await api.getConversationStats();
      if (response.success) {
        setStats({
          mine: response.data.mine || 0,
          all: response.data.all || 0,
          unassigned: response.data.unassigned || 0,
          closed: response.data.closed || 0
        });
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const loadUsers = async () => {
    try {
      const response = await api.getUsers();
      const usersList = Array.isArray(response.data)
        ? response.data
        : (response.data?.users || []);
      setUsers(usersList);
    } catch (error) {
      console.error('Erro ao carregar usuários:', error);
    }
  };

  const loadTags = async () => {
    try {
      const response = await api.getTags();
      setTags(response.data?.tags || []);
    } catch (error) {
      console.error('Erro ao carregar etiquetas:', error);
    }
  };

  // Função chamada quando uma conversa é atualizada (atribuição, tags, etc)
  const handleConversationUpdated = async (options = {}) => {
    await Promise.all([
      loadConversations(),
      loadStats()
    ]);

    // Se usuário atribuiu a si mesmo, mudar para "Minhas"
    if (options.switchToMine) {
      setStatusFilter('mine');
    }
  };

  const filterConversations = () => {
    let filtered = conversations;
    const currentUserId = user?.id;

    // 1. Filter by quick view (statusFilter)
    if (statusFilter === 'mine') {
      filtered = filtered.filter(c => c.assigned_user_id === currentUserId && c.status !== 'closed');
    } else if (statusFilter === 'unassigned') {
      filtered = filtered.filter(c => !c.assigned_user_id && c.status !== 'closed');
    } else if (statusFilter === 'closed') {
      filtered = filtered.filter(c => c.status === 'closed');
    }
    // 'all' = não filtra por status

    // 2. Advanced filters - Mode (AI/Manual)
    if (advancedFilters.mode === 'ai') {
      filtered = filtered.filter(c => c.status === 'ai_active');
    } else if (advancedFilters.mode === 'manual') {
      filtered = filtered.filter(c => c.status === 'manual');
    }

    // 3. Advanced filters - Assigned User
    if (advancedFilters.assignedUserId) {
      filtered = filtered.filter(c => c.assigned_user_id === advancedFilters.assignedUserId);
    }

    // 4. Advanced filters - Period
    if (advancedFilters.period !== 'all') {
      const now = new Date();
      let startDate;

      switch (advancedFilters.period) {
        case 'today':
          startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case 'last_7_days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last_30_days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'this_month':
          startDate = new Date(now.getFullYear(), now.getMonth(), 1);
          break;
        case 'last_month':
          startDate = new Date(now.getFullYear(), now.getMonth() - 1, 1);
          const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
          filtered = filtered.filter(c => {
            const msgDate = new Date(c.last_message_at);
            return msgDate >= startDate && msgDate <= endOfLastMonth;
          });
          startDate = null; // Já filtrou acima
          break;
        default:
          startDate = null;
      }

      if (startDate) {
        filtered = filtered.filter(c => new Date(c.last_message_at) >= startDate);
      }
    }

    // 5. Advanced filters - Tags
    if (advancedFilters.tags.length > 0) {
      filtered = filtered.filter(c =>
        c.tags?.some(tag => advancedFilters.tags.includes(tag.id))
      );
    }

    // 6. Search query
    if (searchQuery) {
      filtered = filtered.filter(c =>
        c.lead_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.lead_company?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // 7. Ordenar por última mensagem (mais recente primeiro)
    filtered = [...filtered].sort((a, b) => {
      const dateA = new Date(a.last_message_at || 0);
      const dateB = new Date(b.last_message_at || 0);
      return dateB - dateA;
    });

    setFilteredConversations(filtered);
    updateActiveFilters();
  };

  // Função para atualizar a lista de filtros ativos (para exibir as pills)
  const updateActiveFilters = () => {
    const filters = [];

    // Mode filter
    if (advancedFilters.mode !== 'all') {
      const modeLabel = advancedFilters.mode === 'ai' ? 'IA' : 'Manual';
      filters.push({
        key: 'mode',
        label: `${t('activeFilters.mode', 'Modo')}: ${modeLabel}`
      });
    }

    // Assigned User filter
    if (advancedFilters.assignedUserId) {
      const assignedUser = users.find(u => u.id === advancedFilters.assignedUserId);
      if (assignedUser) {
        filters.push({
          key: 'assignedUserId',
          label: `${t('activeFilters.assignedUser', 'Responsável')}: ${assignedUser.name}`
        });
      }
    }

    // Period filter
    if (advancedFilters.period !== 'all') {
      const periodLabels = {
        today: t('filters.periods.today', 'Hoje'),
        last_7_days: t('filters.periods.last_7_days', 'Últimos 7 dias'),
        last_30_days: t('filters.periods.last_30_days', 'Últimos 30 dias'),
        this_month: t('filters.periods.this_month', 'Este mês'),
        last_month: t('filters.periods.last_month', 'Mês passado')
      };
      filters.push({
        key: 'period',
        label: `${t('activeFilters.period', 'Período')}: ${periodLabels[advancedFilters.period] || advancedFilters.period}`
      });
    }

    // Tags filter
    if (advancedFilters.tags.length > 0) {
      const selectedTags = tags.filter(tag => advancedFilters.tags.includes(tag.id));
      const tagNames = selectedTags.map(tag => tag.name).join(', ');
      filters.push({
        key: 'tags',
        label: `${t('activeFilters.tags', 'Etiquetas')}: ${tagNames}`
      });
    }

    setActiveFilters(filters);
  };

  // Função para remover um filtro específico
  const handleRemoveFilter = (filterKey) => {
    const newFilters = { ...advancedFilters };

    if (filterKey === 'mode') {
      newFilters.mode = 'all';
    } else if (filterKey === 'assignedUserId') {
      newFilters.assignedUserId = null;
    } else if (filterKey === 'period') {
      newFilters.period = 'all';
    } else if (filterKey === 'tags') {
      newFilters.tags = [];
    }

    setAdvancedFilters(newFilters);
  };

  // Função para limpar todos os filtros avançados
  const handleClearAllFilters = () => {
    setAdvancedFilters({
      mode: 'all',
      assignedUserId: null,
      period: 'all',
      tags: []
    });
    setActiveFilters([]);
  };

  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!confirm(t('messages.confirmDelete'))) {
      return;
    }

    try {
      await api.deleteConversation(conversationId);

      // If deleting the selected conversation, clear selection
      if (conversationId === selectedConversationId) {
        setSelectedConversationId(null);
      }

      loadConversations();
      loadStats();
    } catch (error) {
      console.error(t('messages.deleteError'), error);
    }
  };

  const handleToggleDetailsPanel = () => {
    setShowDetailsPanel(!showDetailsPanel);
  };

  const handleTagsUpdated = (conversationId, updatedTags) => {
    // Atualizar tags na lista de conversas
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, tags: updatedTags }
          : conv
      )
    );
  };

  const handleConversationRead = (conversationId) => {
    // Atualizar conversa local para zerar unread_count
    setConversations(prevConversations =>
      prevConversations.map(conv =>
        conv.id === conversationId
          ? { ...conv, unread_count: 0 }
          : conv
      )
    );

    // Atualizar estatísticas
    if (stats && stats.unread_conversations > 0) {
      setStats({
        ...stats,
        unread_conversations: stats.unread_conversations - 1
      });
    }

    // ✅ Notificar o Layout para atualizar as badges no menu e no header
    if (refreshUnreadCount) {
      refreshUnreadCount();
    }
  };

  const handleCloseConversation = async (conversationId) => {
    try {
      await api.closeConversation(conversationId);

      // Recarregar conversas e estatísticas após fechar
      loadConversations();
      loadStats();
    } catch (error) {
      console.error(t('messages.closeError'), error);
    }
  };

  const handleReopenConversation = async (conversationId) => {
    try {
      await api.reopenConversation(conversationId, 'ai_active');

      // Recarregar conversas e estatísticas após reabrir
      loadConversations();
      loadStats();
    } catch (error) {
      console.error(t('messages.reopenError'), error);
    }
  };

  // Handler para abrir o modal de contato
  const handleOpenContactModal = (contactId) => {
    if (contactId) {
      setContactModal({ isOpen: true, contactId });
    }
  };

  // Handler para abrir uma conversa a partir do modal
  const handleOpenConversationFromModal = (conversationId) => {
    setSelectedConversationId(conversationId);
  };

  // Handler para criar oportunidade a partir de uma conversa
  const handleCreateOpportunity = (conversation) => {
    setOpportunityModal({ isOpen: true, conversation });
  };

  // Handler quando oportunidade é criada com sucesso
  const handleOpportunityCreated = (opportunity) => {
    console.log('Oportunidade criada:', opportunity);
    // Poderia mostrar notificação de sucesso ou redirecionar
  };

  return (
    <div className="flex h-full bg-gray-100 dark:bg-gray-800">
      {/* Sidebar - Lista de Conversas */}
      <ConversationSidebar
        conversations={loading ? [] : filteredConversations}
        selectedId={selectedConversationId}
        onSelect={handleSelectConversation}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        stats={stats}
        onDeleteConversation={handleDeleteConversation}
        onCloseConversation={handleCloseConversation}
        onCreateOpportunity={handleCreateOpportunity}
        // Props para filtros
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
        users={users}
        tags={tags}
        activeFilters={activeFilters}
        onRemoveFilter={handleRemoveFilter}
        onClearAllFilters={handleClearAllFilters}
      />

      {/* Chat Area - Centro */}
      <ChatArea
        conversationId={selectedConversationId}
        onToggleDetails={handleToggleDetailsPanel}
        showDetailsPanel={showDetailsPanel}
        onConversationRead={handleConversationRead}
        onConversationClosed={() => {
          loadConversations();
          loadStats();
        }}
        onConversationUpdated={handleConversationUpdated}
      />

      {/* Details Panel - Direita (opcional) */}
      <DetailsPanel
        conversationId={selectedConversationId}
        isVisible={showDetailsPanel}
        onTagsUpdated={handleTagsUpdated}
        onConversationUpdated={handleConversationUpdated}
        onOpenContactModal={handleOpenContactModal}
      />

      {/* Modal Unificado de Contato */}
      <UnifiedContactModal
        isOpen={contactModal.isOpen}
        onClose={() => setContactModal({ isOpen: false, contactId: null })}
        contactId={contactModal.contactId}
        onOpenConversation={handleOpenConversationFromModal}
      />

      {/* Modal de Criar Oportunidade */}
      <QuickCreateOpportunityModal
        isOpen={opportunityModal.isOpen}
        onClose={() => setOpportunityModal({ isOpen: false, conversation: null })}
        conversation={opportunityModal.conversation}
        onSuccess={handleOpportunityCreated}
      />
    </div>
  );
};

export default ConversationsPage;
