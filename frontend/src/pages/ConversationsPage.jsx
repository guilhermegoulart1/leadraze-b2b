// frontend/src/pages/ConversationsPage.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ConversationSidebar from '../components/ConversationSidebar';
import ChatArea from '../components/ChatArea';
import DetailsPanel from '../components/DetailsPanel';

const ConversationsPage = () => {
  const [conversations, setConversations] = useState([]);
  const [filteredConversations, setFilteredConversations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [showDetailsPanel, setShowDetailsPanel] = useState(true);
  const [stats, setStats] = useState(null);

  useEffect(() => {
    loadConversations();
    loadStats();
  }, []);

  useEffect(() => {
    filterConversations();
  }, [searchQuery, statusFilter, conversations]);

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
        setStats(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas:', error);
    }
  };

  const filterConversations = () => {
    let filtered = conversations;

    // Filter by status
    if (statusFilter !== 'all') {
      filtered = filtered.filter(conv => conv.status === statusFilter);
    }

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(conv =>
        conv.lead_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        conv.lead_company?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    setFilteredConversations(filtered);
  };

  const handleSelectConversation = (conversationId) => {
    setSelectedConversationId(conversationId);
  };

  const handleDeleteConversation = async (conversationId) => {
    if (!confirm('Tem certeza que deseja excluir esta conversa?')) {
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
      console.error('Erro ao excluir conversa:', error);
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
      />

      {/* Chat Area - Centro */}
      <ChatArea
        conversationId={selectedConversationId}
        onToggleDetails={handleToggleDetailsPanel}
        showDetailsPanel={showDetailsPanel}
        onConversationRead={handleConversationRead}
      />

      {/* Details Panel - Direita (opcional) */}
      <DetailsPanel
        conversationId={selectedConversationId}
        isVisible={showDetailsPanel}
        onTagsUpdated={handleTagsUpdated}
      />
    </div>
  );
};

export default ConversationsPage;
