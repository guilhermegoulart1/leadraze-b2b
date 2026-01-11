import React, { useState, useEffect } from 'react';
import { MessageCircle, ExternalLink, Loader, Phone } from 'lucide-react';
import ChatArea from './ChatArea';
import api from '../services/api';

/**
 * EmbeddedChat - Wrapper for ChatArea to use in modals
 * Provides a full-featured chat experience within the LeadDetailModal
 */
const EmbeddedChat = ({
  leadId,
  channelType = 'whatsapp',  // 'linkedin' | 'whatsapp'
  onNavigateToFull,
  onConversationUpdate,
  maxHeight = 'calc(100vh - 300px)',
  className = ''
}) => {
  const [conversations, setConversations] = useState([]);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Load conversations for this lead
  useEffect(() => {
    if (leadId) {
      loadConversations();
    }
  }, [leadId, channelType]);

  const loadConversations = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get conversations for this lead
      const response = await api.getConversations({
        opportunity_id: leadId,
        channel: channelType
      });

      if (response.success) {
        const convList = response.data.conversations || [];
        setConversations(convList);

        // Auto-select first conversation
        if (convList.length > 0) {
          setSelectedConversationId(convList[0].id);
        }
      }
    } catch (err) {
      console.error('Error loading conversations:', err);
      setError('Erro ao carregar conversas');
    } finally {
      setLoading(false);
    }
  };

  const handleConversationRead = () => {
    loadConversations(); // Reload to update unread counts
    onConversationUpdate?.();
  };

  const handleConversationClosed = () => {
    loadConversations();
    onConversationUpdate?.();
  };

  const handleConversationUpdated = () => {
    loadConversations();
    onConversationUpdate?.();
  };

  if (loading) {
    return (
      <div className={`flex items-center justify-center h-64 ${className}`}>
        <Loader className="w-8 h-8 text-purple-500 animate-spin" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500 ${className}`}>
        <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium text-red-500">{error}</p>
        <button
          onClick={loadConversations}
          className="mt-2 text-xs text-purple-600 hover:underline"
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (!selectedConversationId) {
    return (
      <div className={`flex flex-col items-center justify-center h-64 text-gray-400 dark:text-gray-500 ${className}`}>
        <MessageCircle className="w-12 h-12 mb-3 opacity-50" />
        <p className="text-sm font-medium">Nenhuma conversa</p>
        <p className="text-xs mt-1 text-center max-w-xs">
          Clique no telefone do contato para iniciar uma conversa WhatsApp
        </p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col h-full ${className}`} style={{ maxHeight }}>
      {/* Conversation selector (if multiple) */}
      {conversations.length > 1 && (
        <div className="flex-shrink-0 px-3 py-2 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <select
            value={selectedConversationId}
            onChange={(e) => setSelectedConversationId(e.target.value)}
            className="w-full text-sm px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          >
            {conversations.map(conv => (
              <option key={conv.id} value={conv.id}>
                {conv.lead_name || conv.lead_phone || 'Conversa'}
                {conv.unread_count > 0 && ` (${conv.unread_count} novas)`}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Chat Area */}
      <div className="flex-1 overflow-hidden">
        <ChatArea
          conversationId={selectedConversationId}
          showDetailsPanel={false}
          onToggleDetails={() => {}}
          onConversationRead={handleConversationRead}
          onConversationClosed={handleConversationClosed}
          onConversationUpdated={handleConversationUpdated}
        />
      </div>

      {/* Navigate to full view */}
      {onNavigateToFull && (
        <div className="flex-shrink-0 px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
          <button
            onClick={onNavigateToFull}
            className="flex items-center gap-1.5 text-xs text-purple-600 dark:text-purple-400 hover:underline"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            Ver conversa completa
          </button>
        </div>
      )}
    </div>
  );
};

export default EmbeddedChat;
