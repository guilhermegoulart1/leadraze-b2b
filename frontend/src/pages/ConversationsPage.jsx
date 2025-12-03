// frontend/src/pages/ConversationsPage.jsx
import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import api from '../services/api';
import { onConversationUpdated, onNewConversation, onNewMessage } from '../services/socket';
import ConversationSidebar from '../components/ConversationSidebar';
import ChatArea from '../components/ChatArea';
import DetailsPanel from '../components/DetailsPanel';
import UnifiedContactModal from '../components/UnifiedContactModal';

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

  // Novos estados para filtros avançados
  const [showFilters, setShowFilters] = useState(false);
  const [advancedFilters, setAdvancedFilters] = useState({
    status: [],
    campaigns: [],
    tags: [],
    period: 'all',
    mode: 'all' // all | ai | manual
  });
  const [campaigns, setCampaigns] = useState([]);
  const [tags, setTags] = useState([]);
  const [activeFilters, setActiveFilters] = useState([]);

  // Estado para o modal unificado de contato
  const [contactModal, setContactModal] = useState({ isOpen: false, contactId: null });

  useEffect(() => {
    loadConversations();
    loadStats();
  }, []);

  useEffect(() => {
    filterConversations();
  }, [searchQuery, statusFilter, conversations, advancedFilters, user]);

  // ✅ WebSocket: Escutar atualizações de conversas em tempo real
  useEffect(() => {
    // Handler para conversa atualizada
    const unsubscribeUpdated = onConversationUpdated((data) => {
      console.log('ConversationsPage: conversation_updated', data);

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
    });

    // Handler para nova conversa
    const unsubscribeNew = onNewConversation((data) => {
      console.log('ConversationsPage: new_conversation', data);

      // Verificar se já existe (evitar duplicatas)
      setConversations(prev => {
        const exists = prev.some(c => c.id === data.conversation?.id);
        if (exists) return prev;

        // Adicionar no início da lista
        return [data.conversation, ...prev];
      });

      // Atualizar stats
      loadStats();
    });

    // Handler para novas mensagens (atualiza lista quando chega mensagem)
    const unsubscribeMessage = onNewMessage((data) => {
      console.log('ConversationsPage: new_message', data);

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
    });

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

  // Função chamada quando uma conversa é atualizada (atribuição, tags, etc)
  const handleConversationUpdated = async () => {
    await Promise.all([
      loadConversations(),
      loadStats()
    ]);
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

    // 2. Advanced filters - Status
    if (advancedFilters.status.length > 0) {
      filtered = filtered.filter(c => advancedFilters.status.includes(c.status));
    }

    // 3. Advanced filters - Mode (AI/Manual)
    if (advancedFilters.mode === 'ai') {
      filtered = filtered.filter(c => c.status === 'ai_active');
    } else if (advancedFilters.mode === 'manual') {
      filtered = filtered.filter(c => c.status === 'manual');
    }

    // 4. Advanced filters - Campaigns
    if (advancedFilters.campaigns.length > 0) {
      filtered = filtered.filter(c =>
        advancedFilters.campaigns.includes(c.campaign_id)
      );
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

    setFilteredConversations(filtered);
    updateActiveFilters();
  };

  // Função para atualizar a lista de filtros ativos (para exibir as pills)
  const updateActiveFilters = () => {
    const filters = [];

    // Status filters
    if (advancedFilters.status.length > 0) {
      const statusNames = advancedFilters.status.map(s => t(`statusLabels.${s}`, s)).join(', ');
      filters.push({
        key: 'status',
        label: `${t('activeFilters.status')}: ${statusNames}`
      });
    }

    // Mode filter
    if (advancedFilters.mode !== 'all') {
      const modeLabel = t(`modeLabels.${advancedFilters.mode}`);
      filters.push({
        key: 'mode',
        label: `${t('activeFilters.mode')}: ${modeLabel}`
      });
    }

    // Campaign filter
    if (advancedFilters.campaigns.length > 0) {
      const campaign = campaigns.find(c => c.id === advancedFilters.campaigns[0]);
      if (campaign) {
        filters.push({
          key: 'campaigns',
          label: `${t('activeFilters.campaign')}: ${campaign.name}`
        });
      }
    }

    // Tags filter
    if (advancedFilters.tags.length > 0) {
      const selectedTags = tags.filter(t => advancedFilters.tags.includes(t.id));
      const tagNames = selectedTags.map(t => t.name).join(', ');
      filters.push({
        key: 'tags',
        label: `${t('activeFilters.tags')}: ${tagNames}`
      });
    }

    // Period filter
    if (advancedFilters.period !== 'all') {
      filters.push({
        key: 'period',
        label: `${t('activeFilters.period')}: ${t(`periodLabels.${advancedFilters.period}`)}`
      });
    }

    setActiveFilters(filters);
  };

  // Função para remover um filtro específico
  const handleRemoveFilter = (filterKey) => {
    const newFilters = { ...advancedFilters };

    if (filterKey === 'status') {
      newFilters.status = [];
    } else if (filterKey === 'mode') {
      newFilters.mode = 'all';
    } else if (filterKey === 'campaigns') {
      newFilters.campaigns = [];
    } else if (filterKey === 'tags') {
      newFilters.tags = [];
    } else if (filterKey === 'period') {
      newFilters.period = 'all';
    }

    setAdvancedFilters(newFilters);
  };

  // Função para limpar todos os filtros avançados
  const handleClearAllFilters = () => {
    setAdvancedFilters({
      status: [],
      campaigns: [],
      tags: [],
      period: 'all',
      mode: 'all'
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

  return (
    <div className="flex h-full bg-gray-100">
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
        // Novos props para filtros avançados
        showFilters={showFilters}
        onToggleFilters={() => setShowFilters(!showFilters)}
        advancedFilters={advancedFilters}
        onAdvancedFiltersChange={setAdvancedFilters}
        campaigns={campaigns}
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
    </div>
  );
};

export default ConversationsPage;
