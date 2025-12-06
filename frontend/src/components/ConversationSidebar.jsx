// frontend/src/components/ConversationSidebar.jsx
import React from 'react';
import { useTranslation } from 'react-i18next';
import {
  Search, Bot, User, Clock, MessageSquare, Trash2, CheckCircle, Filter, ChevronDown, UserCircle, Building2
} from 'lucide-react';
import QuickViewTabs from './QuickViewTabs';
import AdvancedFiltersPanel from './AdvancedFiltersPanel';
import ActiveFilterPills from './ActiveFilterPills';

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
  onCloseConversation,
  // Novos props para filtros avançados
  showFilters = false,
  onToggleFilters,
  advancedFilters,
  onAdvancedFiltersChange,
  campaigns = [],
  tags = [],
  activeFilters = [],
  onRemoveFilter,
  onClearAllFilters
}) => {
  const { t, i18n } = useTranslation('conversations');

  const formatLastMessageTime = (timestamp) => {
    if (!timestamp) return '';

    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffDays = Math.floor(diffMs / 86400000);

    // Se for hoje, mostrar horário
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      if (diffMins < 1) return t('time.now');
      if (diffMins < 60) return `${diffMins}m`;
      // Se foi hoje mas há mais de 1h, mostrar horário completo
      return date.toLocaleTimeString(i18n.language, { hour: '2-digit', minute: '2-digit' });
    }

    // Se foi ontem
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return t('time.yesterday');
    }

    // Se foi esta semana
    if (diffDays < 7) {
      return `${diffDays}d`;
    }

    // Se foi este ano, não mostrar o ano
    if (date.getFullYear() === now.getFullYear()) {
      return date.toLocaleDateString(i18n.language, { day: '2-digit', month: 'short' });
    }

    // Se foi ano passado ou anterior, mostrar ano
    return date.toLocaleDateString(i18n.language, { day: '2-digit', month: 'short', year: 'numeric' });
  };

  // Calcular contagem de filtros ativos
  const activeFiltersCount = activeFilters.length;

  return (
    <div className="w-80 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        {/* Search */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder={t('search.placeholder')}
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#7229f7] focus:border-transparent bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500"
          />
        </div>

        {/* Quick Views - Pills Horizontais */}
        <div className="mb-3">
          <QuickViewTabs
            activeView={statusFilter}
            onChange={onStatusFilterChange}
            stats={stats}
          />
        </div>

        {/* Barra de Filtros e Contador */}
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={onToggleFilters}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Filter className="w-4 h-4" />
            {t('filters.channel')}
            {activeFiltersCount > 0 && (
              <span className="px-1.5 py-0.5 bg-[#7229f7] text-white text-xs font-medium rounded-full">
                {activeFiltersCount}
              </span>
            )}
            <ChevronDown
              className={`w-4 h-4 transition-transform ${showFilters ? 'rotate-180' : ''}`}
            />
          </button>

          <span className="text-xs text-gray-500 dark:text-gray-400">
            {conversations.length} {conversations.length === 1 ? t('common:conversation') : t('common:conversations')}
          </span>
        </div>

        {/* Painel de Filtros Expansível */}
        {showFilters && (
          <div className="mb-3">
            <AdvancedFiltersPanel
              filters={advancedFilters}
              onChange={onAdvancedFiltersChange}
              campaigns={campaigns}
              tags={tags}
              onClear={onClearAllFilters}
            />
          </div>
        )}

        {/* Active Filter Pills */}
        {activeFiltersCount > 0 && (
          <div className="mb-3">
            <ActiveFilterPills
              filters={activeFilters}
              onRemove={onRemoveFilter}
              onClearAll={onClearAllFilters}
            />
          </div>
        )}
      </div>

      {/* Conversations List */}
      <div className="flex-1 overflow-y-auto scrollbar-thin">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mb-3" />
            <p className="text-sm text-gray-600 dark:text-gray-400 font-medium">
              {searchQuery || activeFiltersCount > 0
                ? t('search.noResults')
                : t('messages.noConversations')}
            </p>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              {searchQuery || activeFiltersCount > 0
                ? t('search.tryDifferent')
                : t('messages.startFirst')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {conversations.map((conversation) => (
              <div
                key={conversation.id}
                onClick={() => onSelect(conversation.id)}
                className={`group px-4 py-3 cursor-pointer transition-all ${
                  selectedId === conversation.id
                    ? 'bg-purple-50 dark:bg-purple-900/20 border-l-4 border-purple-600'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700'
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Avatar - só usar se for URL HTTP válida */}
                  {conversation.lead_picture && conversation.lead_picture.startsWith('http') ? (
                    <img
                      src={conversation.lead_picture}
                      alt={conversation.lead_name}
                      className="w-11 h-11 rounded-full object-cover flex-shrink-0"
                      onError={(e) => { e.target.style.display = 'none'; }}
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
                        <h3 className="font-semibold text-sm text-gray-900 dark:text-gray-100 truncate">
                          {/* Mostrar group_name para grupos, senão lead_name */}
                          {conversation.is_group && conversation.group_name
                            ? conversation.group_name
                            : conversation.lead_name}
                        </h3>
                        {/* Badge de grupo */}
                        {conversation.is_group && (
                          <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] font-medium rounded-full flex-shrink-0">
                            Grupo
                          </span>
                        )}
                        {conversation.unread_count > 0 && (
                          <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex-shrink-0 min-w-[18px] h-[18px] flex items-center justify-center shadow-sm">
                            {conversation.unread_count > 99 ? '99+' : conversation.unread_count}
                          </span>
                        )}
                        {/* Tags herdadas do contato */}
                        {conversation.tags && conversation.tags.slice(0, 2).map(tag => {
                          const tagColors = {
                            purple: 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400',
                            blue: 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400',
                            green: 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400',
                            yellow: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400',
                            red: 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400',
                            pink: 'bg-pink-100 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400',
                            orange: 'bg-orange-100 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400',
                            gray: 'bg-gray-100 dark:bg-gray-900/30 text-gray-700 dark:text-gray-400'
                          };
                          return (
                            <span
                              key={tag.id}
                              className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium flex-shrink-0 ${tagColors[tag.color] || tagColors.purple}`}
                            >
                              {tag.name}
                            </span>
                          );
                        })}
                        {conversation.tags && conversation.tags.length > 2 && (
                          <span className="px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">
                            +{conversation.tags.length - 2}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                        <Clock className="w-3 h-3 text-gray-400 dark:text-gray-500" />
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          {formatLastMessageTime(conversation.last_message_at)}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 mb-1">
                      <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                        {conversation.lead_title}
                      </span>
                      {conversation.lead_company && (
                        <>
                          <span className="text-xs text-gray-400 dark:text-gray-500">•</span>
                          <span className="text-xs text-gray-600 dark:text-gray-400 truncate">
                            {conversation.lead_company}
                          </span>
                        </>
                      )}
                    </div>

                    {conversation.last_message_preview && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate mb-2">
                        {conversation.last_message_preview}
                      </p>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {/* AI Status Badge - Only Icon */}
                        <div
                          className={`flex items-center justify-center p-1 rounded-full ${
                            conversation.status === 'ai_active'
                              ? 'bg-purple-50 dark:bg-purple-900/30 text-[#7229f7] dark:text-purple-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
                          }`}
                          title={conversation.status === 'ai_active' ? 'IA Ativa' : 'Manual'}
                        >
                          {conversation.status === 'ai_active' ? (
                            <Bot className="w-3 h-3" />
                          ) : (
                            <User className="w-3 h-3" />
                          )}
                        </div>

                        {/* Assignment Badge */}
                        <div
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            conversation.assigned_user_name
                              ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}
                          title={conversation.assigned_user_name || 'Não atribuída'}
                        >
                          <UserCircle className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[60px]">
                            {conversation.assigned_user_name || 'Não atribuída'}
                          </span>
                        </div>

                        {/* Sector Badge */}
                        <div
                          className={`flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                            conversation.sector_name
                              ? 'bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-400'
                              : 'bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400'
                          }`}
                          title={conversation.sector_name || 'Sem setor'}
                        >
                          <Building2 className="w-2.5 h-2.5" />
                          <span className="truncate max-w-[60px]">
                            {conversation.sector_name || 'Sem setor'}
                          </span>
                        </div>
                      </div>

                      {/* Actions (visible on hover) */}
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {conversation.status !== 'closed' && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              onCloseConversation(conversation.id);
                            }}
                            className="p-1 text-green-600 dark:text-green-400 hover:bg-green-100 dark:hover:bg-green-900/30 rounded transition-colors"
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
                          className="p-1 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
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
