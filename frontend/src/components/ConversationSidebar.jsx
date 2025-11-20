// frontend/src/components/ConversationSidebar.jsx
import React from 'react';
import {
  Search, Bot, User, Clock, Circle, MessageSquare, Trash2, CheckCircle
} from 'lucide-react';

const ConversationSidebar = ({
  conversations = [],
  selectedId,
  onSelect,
  searchQuery,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  stats,
  onDeleteConversation,
  onCloseConversation
}) => {
  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return 'Nunca';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `${diffMins}m`;
    if (diffHours < 24) return `${diffHours}h`;
    if (diffDays < 7) return `${diffDays}d`;

    return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' });
  };

  return (
    <div className="w-80 bg-gray-50 border-r border-gray-200 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 bg-white border-b border-gray-200">
        <h2 className="text-lg font-bold text-gray-900 mb-3">Conversas</h2>

        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar conversas..."
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>

        {/* Status Filter */}
        <div className="grid grid-cols-2 gap-1 bg-gray-100 rounded-lg p-1">
          <button
            onClick={() => onStatusFilterChange('all')}
            className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'all'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Todas
          </button>
          <button
            onClick={() => onStatusFilterChange('ai_active')}
            className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'ai_active'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            IA
          </button>
          <button
            onClick={() => onStatusFilterChange('manual')}
            className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'manual'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => onStatusFilterChange('closed')}
            className={`px-2 py-1.5 rounded-md text-xs font-medium transition-colors ${
              statusFilter === 'closed'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Fechadas
          </button>
        </div>
      </div>

      {/* Stats Mini */}
      {stats && (
        <div className="px-4 py-3 bg-white border-b border-gray-200">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="flex items-center gap-1">
              <MessageSquare className="w-3.5 h-3.5 text-blue-600" />
              <span className="text-gray-600">Total:</span>
              <span className="font-semibold text-gray-900">{stats.total}</span>
            </div>
            <div className="flex items-center gap-1">
              <Bot className="w-3.5 h-3.5 text-purple-600" />
              <span className="text-gray-600">IA:</span>
              <span className="font-semibold text-gray-900">{stats.by_status?.ai_active || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <User className="w-3.5 h-3.5 text-orange-600" />
              <span className="text-gray-600">Manual:</span>
              <span className="font-semibold text-gray-900">{stats.by_status?.manual || 0}</span>
            </div>
            <div className="flex items-center gap-1">
              <CheckCircle className="w-3.5 h-3.5 text-green-600" />
              <span className="text-gray-600">Fechadas:</span>
              <span className="font-semibold text-gray-900">{stats.by_status?.closed || 0}</span>
            </div>
            <div className="flex items-center gap-1 col-span-2">
              <Circle className="w-3.5 h-3.5 text-red-600 fill-red-600" />
              <span className="text-gray-600">Não lidas:</span>
              <span className="font-semibold text-gray-900">{stats.unread_conversations || 0}</span>
            </div>
          </div>
        </div>
      )}

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 mb-3" />
            <p className="text-sm text-gray-600 font-medium">
              {searchQuery || statusFilter !== 'all'
                ? 'Nenhuma conversa encontrada'
                : 'Nenhuma conversa ainda'}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {searchQuery || statusFilter !== 'all'
                ? 'Tente ajustar os filtros'
                : 'Conversas aparecerão aqui'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`group px-4 py-3 cursor-pointer transition-all ${
                  selectedId === conversation.id
                    ? 'bg-purple-50 border-l-4 border-purple-600'
                    : conversation.unread_count > 0
                    ? 'bg-blue-50 hover:bg-blue-100'
                    : 'bg-white hover:bg-gray-50'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar */}
                  {conversation.lead_picture ? (
                    <img
                      src={conversation.lead_picture}
                      alt={conversation.lead_name}
                      className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                    />
                  ) : (
                    <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center flex-shrink-0">
                      <span className="text-white font-semibold text-sm">
                        {conversation.lead_name?.charAt(0) || '?'}
                      </span>
                    </div>
                  )}

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1 flex-wrap">
                        <h3 className="font-semibold text-sm text-gray-900 truncate">
                          {conversation.lead_name}
                        </h3>
                        {conversation.unread_count > 0 && (
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white text-xs font-medium rounded-full flex-shrink-0">
                            {conversation.unread_count}
                          </span>
                        )}
                        {/* Tags - TODO: buscar do backend */}
                        {conversation.tags && conversation.tags.map(tag => (
                          <span
                            key={tag.id}
                            className={`px-2 py-0.5 rounded-full text-xs font-medium flex-shrink-0 ${tag.colorClass || 'bg-gray-100 text-gray-700'}`}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <Clock className="w-3 h-3 text-gray-400" />
                        <span className="text-xs text-gray-500">
                          {formatLastMessageTime(conversation.last_message_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-gray-600 truncate">
                        {conversation.lead_title}
                      </span>
                      {conversation.lead_company && (
                        <>
                          <span className="text-xs text-gray-400">•</span>
                          <span className="text-xs text-gray-600 truncate">
                            {conversation.lead_company}
                          </span>
                        </>
                      )}
                    </div>

                    {conversation.last_message_preview && (
                      <p className="text-xs text-gray-500 truncate mb-2">
                        {conversation.last_message_preview}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      {/* AI Status Badge */}
                      <div
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                          conversation.status === 'ai_active'
                            ? 'bg-purple-100 text-purple-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {conversation.status === 'ai_active' ? (
                          <>
                            <Bot className="w-3 h-3" />
                            IA
                          </>
                        ) : (
                          <>
                            <User className="w-3 h-3" />
                            Manual
                          </>
                        )}
                      </div>

                      {/* Actions (visible on hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {conversation.status !== 'closed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseConversation(conversation.id);
                            }}
                            className="p-1 text-green-600 hover:bg-green-100 rounded transition-colors"
                            title="Fechar conversa"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteConversation(conversation.id);
                          }}
                          className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
                          title="Excluir conversa"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ConversationSidebar;
