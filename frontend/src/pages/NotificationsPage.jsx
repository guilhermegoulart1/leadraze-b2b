import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import {
  Bell, RefreshCw, Check, CheckCheck, Filter, AlertCircle,
  UserPlus, Loader, ChevronDown
} from 'lucide-react';
import api from '../services/api';

const ITEMS_PER_PAGE = 20;

const NotificationsPage = () => {
  const { t } = useTranslation('notifications');
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [filter, setFilter] = useState('all'); // 'all' | 'unread' | 'read'
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [actionLoading, setActionLoading] = useState({}); // Track loading state per notification

  useEffect(() => {
    loadNotifications(true);
  }, []);

  const loadNotifications = async (reset = false) => {
    try {
      if (reset) {
        setLoading(true);
        setNotifications([]);
      } else {
        setLoadingMore(true);
      }

      const offset = reset ? 0 : notifications.length;
      const response = await api.getNotifications({ limit: ITEMS_PER_PAGE, offset });

      if (response.success) {
        const newNotifications = response.data?.notifications || [];

        if (reset) {
          setNotifications(newNotifications);
        } else {
          setNotifications(prev => [...prev, ...newNotifications]);
        }

        setHasMore(newNotifications.length === ITEMS_PER_PAGE);
      }
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  const handleMarkAsRead = async (notification) => {
    if (notification.is_read) return;
    try {
      await api.markNotificationAsRead(notification.id);
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true } : n
      ));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    await handleMarkAsRead(notification);
    if (notification.metadata?.link) {
      navigate(notification.metadata.link);
    }
  };

  const handleInvitationAction = async (e, notification, action) => {
    e.stopPropagation();

    // Prevent double-clicks
    if (actionLoading[notification.id]) return;

    setActionLoading(prev => ({ ...prev, [notification.id]: true }));

    try {
      const response = await api.handleNotificationInvitationAction(notification.id, action);

      // Mark as handled regardless of success/failure
      const markAsHandled = (errorMessage = null) => {
        setNotifications(prev => prev.map(n => {
          if (n.id === notification.id) {
            const metadata = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
            return {
              ...n,
              is_read: true,
              metadata: {
                ...metadata,
                handled: true,
                action_taken: errorMessage ? 'expired' : action,
                error: errorMessage
              }
            };
          }
          return n;
        }));
      };

      if (response.success) {
        markAsHandled();
      } else {
        // If the API returns an error (invitation already handled or doesn't exist)
        // Mark as handled to prevent further attempts
        markAsHandled(response.message);

        // Show user-friendly message
        if (response.message?.includes('already been handled')) {
          alert('Este convite já foi processado anteriormente.');
        } else if (response.message?.includes('not found') || response.message?.includes('Failed')) {
          alert('Este convite não está mais disponível. Pode ter expirado ou sido processado diretamente no LinkedIn.');
          markAsHandled('Convite não disponível');
        } else {
          alert(response.message || `Erro ao ${action === 'accept' ? 'aceitar' : 'rejeitar'} convite`);
        }
      }
    } catch (error) {
      console.error(`Erro ao ${action} convite:`, error);

      // On network/API error, also mark as handled to prevent infinite retry loops
      // The invitation might no longer exist
      setNotifications(prev => prev.map(n => {
        if (n.id === notification.id) {
          const metadata = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
          return {
            ...n,
            is_read: true,
            metadata: {
              ...metadata,
              handled: true,
              action_taken: 'error',
              error: 'Convite não disponível'
            }
          };
        }
        return n;
      }));

      alert('Este convite não está mais disponível. Pode ter expirado ou sido processado diretamente no LinkedIn.');
    } finally {
      setActionLoading(prev => ({ ...prev, [notification.id]: false }));
    }
  };

  const getNotificationMetadata = (notification) => {
    if (!notification.metadata) return {};
    return typeof notification.metadata === 'string'
      ? JSON.parse(notification.metadata)
      : notification.metadata;
  };

  const isInvitationNotification = (notification) => {
    return ['invitation_received', 'invite_accepted'].includes(notification.type);
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins} min`;
    if (diffHours < 24) return `Há ${diffHours}h`;
    if (diffDays < 7) return `Há ${diffDays}d`;
    return date.toLocaleDateString('pt-BR');
  };

  const getInvitationStatusText = (metadata) => {
    if (metadata.action_taken === 'accept') return '✓ Convite aceito';
    if (metadata.action_taken === 'reject') return '✗ Convite rejeitado';
    if (metadata.action_taken === 'expired' || metadata.action_taken === 'error') {
      return '⚠ Convite expirado ou indisponível';
    }
    return null;
  };

  const getInvitationStatusColor = (metadata) => {
    if (metadata.action_taken === 'accept') return 'text-green-600 dark:text-green-400';
    if (metadata.action_taken === 'reject') return 'text-red-500 dark:text-red-400';
    return 'text-gray-500 dark:text-gray-400';
  };

  const filteredNotifications = notifications.filter(n => {
    if (filter === 'unread') return !n.is_read;
    if (filter === 'read') return n.is_read;
    return true;
  });

  const unreadCount = notifications.filter(n => !n.is_read).length;

  const filterOptions = [
    { value: 'all', label: t('filters.all', 'Todas') },
    { value: 'unread', label: t('filters.unread', 'Não lidas') },
    { value: 'read', label: t('filters.read', 'Lidas') }
  ];

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-purple-600 dark:text-purple-400" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            {t('title', 'Notificações')}
          </h1>
          {unreadCount > 0 && (
            <span className="bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
              {unreadCount}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Filter dropdown */}
          <div className="relative">
            <button
              onClick={() => setShowFilterDropdown(!showFilterDropdown)}
              className="flex items-center gap-2 px-3 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700"
            >
              <Filter className="w-4 h-4" />
              {filterOptions.find(o => o.value === filter)?.label}
              <ChevronDown className="w-4 h-4" />
            </button>
            {showFilterDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowFilterDropdown(false)} />
                <div className="absolute right-0 top-full mt-1 w-40 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20">
                  {filterOptions.map(option => (
                    <button
                      key={option.value}
                      onClick={() => {
                        setFilter(option.value);
                        setShowFilterDropdown(false);
                      }}
                      className={`w-full px-3 py-2 text-left text-sm hover:bg-gray-100 dark:hover:bg-gray-700 first:rounded-t-lg last:rounded-b-lg ${
                        filter === option.value
                          ? 'text-purple-600 dark:text-purple-400 font-medium'
                          : 'text-gray-700 dark:text-gray-300'
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Mark all as read */}
          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="flex items-center gap-2 px-3 py-2 bg-purple-600 text-white rounded-lg text-sm hover:bg-purple-700 transition-colors"
            >
              <CheckCheck className="w-4 h-4" />
              {t('markAllAsRead', 'Marcar todas como lidas')}
            </button>
          )}

          {/* Refresh */}
          <button
            onClick={() => loadNotifications(true)}
            disabled={loading}
            className="p-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Notifications list */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-6 h-6 text-purple-600 animate-spin" />
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <Bell className="w-12 h-12 mb-3 opacity-30" />
            <p className="text-sm">
              {filter === 'unread'
                ? t('noUnread', 'Nenhuma notificação não lida')
                : filter === 'read'
                  ? t('noRead', 'Nenhuma notificação lida')
                  : t('noNotifications', 'Nenhuma notificação')
              }
            </p>
          </div>
        ) : (
          <>
            <div className="divide-y divide-gray-100 dark:divide-gray-700">
              {filteredNotifications.map((notification) => {
                const metadata = getNotificationMetadata(notification);
                const isInvitation = isInvitationNotification(notification);
                const isHandled = metadata?.handled;
                const isActionLoading = actionLoading[notification.id];

                return (
                  <div
                    key={notification.id}
                    onClick={() => !isInvitation || isHandled ? handleNotificationClick(notification) : null}
                    className={`p-4 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors ${
                      !isInvitation || isHandled ? 'cursor-pointer' : ''
                    } ${
                      !notification.is_read ? 'bg-purple-50/50 dark:bg-purple-900/10' : ''
                    }`}
                  >
                    <div className="flex items-start gap-4">
                      {/* Icon/Avatar */}
                      {isInvitation && metadata?.profile_picture ? (
                        <img
                          src={metadata.profile_picture}
                          alt={metadata.contact_name || metadata.inviter_name || 'Perfil'}
                          className="w-12 h-12 rounded-full object-cover flex-shrink-0"
                        />
                      ) : isInvitation ? (
                        <div className="w-12 h-12 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                          <UserPlus className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                        </div>
                      ) : notification.type === 'channel_disconnected' ? (
                        <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                          <AlertCircle className="w-6 h-6 text-red-500" />
                        </div>
                      ) : (
                        <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                          <Bell className="w-6 h-6 text-gray-500 dark:text-gray-400" />
                        </div>
                      )}

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className={`text-sm font-medium ${
                              !notification.is_read
                                ? 'text-gray-900 dark:text-gray-100'
                                : 'text-gray-700 dark:text-gray-300'
                            }`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                              {notification.message}
                            </p>
                            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                              {formatRelativeTime(notification.created_at)}
                            </p>
                          </div>

                          {/* Mark as read button */}
                          {!notification.is_read && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleMarkAsRead(notification);
                              }}
                              className="p-2 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full flex-shrink-0 transition-colors"
                              title={t('markAsRead', 'Marcar como lido')}
                            >
                              <Check className="w-4 h-4 text-purple-500 dark:text-purple-400" />
                            </button>
                          )}
                        </div>

                        {/* Action buttons for received invitations */}
                        {notification.type === 'invitation_received' && !isHandled && (
                          <div className="flex gap-2 mt-3">
                            <button
                              onClick={(e) => handleInvitationAction(e, notification, 'accept')}
                              disabled={isActionLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionLoading ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <Check className="w-4 h-4" />
                              )}
                              {t('accept', 'Aceitar')}
                            </button>
                            <button
                              onClick={(e) => handleInvitationAction(e, notification, 'reject')}
                              disabled={isActionLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              {isActionLoading ? (
                                <Loader className="w-4 h-4 animate-spin" />
                              ) : (
                                <AlertCircle className="w-4 h-4" />
                              )}
                              {t('reject', 'Rejeitar')}
                            </button>
                          </div>
                        )}

                        {/* Show status for handled invitations */}
                        {notification.type === 'invitation_received' && isHandled && (
                          <p className={`text-xs mt-2 font-medium ${getInvitationStatusColor(metadata)}`}>
                            {getInvitationStatusText(metadata)}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Load more button */}
            {hasMore && (
              <div className="p-4 border-t border-gray-100 dark:border-gray-700">
                <button
                  onClick={() => loadNotifications(false)}
                  disabled={loadingMore}
                  className="w-full py-2 text-sm text-purple-600 dark:text-purple-400 hover:text-purple-700 dark:hover:text-purple-300 font-medium disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {loadingMore ? (
                    <>
                      <Loader className="w-4 h-4 animate-spin" />
                      {t('loading', 'Carregando...')}
                    </>
                  ) : (
                    t('loadMore', 'Carregar mais notificações')
                  )}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationsPage;
