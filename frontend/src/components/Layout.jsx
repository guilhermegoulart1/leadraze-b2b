import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Search, Award, BarChart3, MessageCircle,
  Bot, Lightbulb, LogOut,
  ChevronLeft, ChevronRight, Bell, User,
  ChevronDown, Users, Shield, Lock, Linkedin, MapPin, CreditCard,
  Mail, Settings, Globe, Link2, Gift, Key, CheckSquare, ListTodo,
  AlertCircle, Check, X, UserPlus, Loader, ClipboardList, Camera
} from 'lucide-react';
import { onAccountDisconnected } from '../services/ably';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import CreditsIndicator from './CreditsIndicator';
import TrialIndicator from './TrialIndicator';
import CanceledOverlay from './CanceledOverlay';
import OnboardingAlert from './OnboardingAlert';
import OnboardingProgress from './OnboardingProgress';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('navigation');
  const { user, logout, isAdmin, isSupervisor, hasPermission } = useAuth();
  const { isDark } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0); // Real data from API
  const [unreadNotifications, setUnreadNotifications] = useState(0); // System notifications
  const [notifications, setNotifications] = useState([]); // Notification list
  const [needsOnboarding, setNeedsOnboarding] = useState(false); // Onboarding pending
  const [onboardingFormDone, setOnboardingFormDone] = useState(false); // Form filled, checklist pending
  const [showOnboardingModal, setShowOnboardingModal] = useState(false);
  const [onboardingProgressData, setOnboardingProgressData] = useState(null);

  const isActive = (path) => location.pathname === path;

  // Listen for storage events (from other components like PipelinesPage)
  useEffect(() => {
    const handleStorageChange = () => {
      const collapsed = localStorage.getItem('sidebarCollapsed') === 'true';
      setIsCollapsed(collapsed);
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  // ✅ Verificar status do onboarding
  useEffect(() => {
    checkOnboardingStatus();
  }, []);

  // ✅ Escutar evento de onboarding completado (form submitted)
  useEffect(() => {
    const handleOnboardingCompleted = () => {
      // Re-check: form is done but checklist may still be pending
      checkOnboardingStatus();
    };

    window.addEventListener('onboarding-completed', handleOnboardingCompleted);
    return () => window.removeEventListener('onboarding-completed', handleOnboardingCompleted);
  }, []);

  const checkOnboardingStatus = async () => {
    try {
      const response = await api.getChecklistProgress();
      if (response.success) {
        const data = response.data;
        // Needs onboarding if form not done OR checklist not 100%
        if (!data.formCompleted || !data.checklistComplete) {
          setNeedsOnboarding(true);
          setOnboardingFormDone(data.formCompleted);
          if (data.formCompleted) {
            setOnboardingProgressData(data);
          }
        } else {
          setNeedsOnboarding(false);
          setOnboardingFormDone(true);
        }
      }
    } catch (error) {
      console.error('Error checking onboarding status:', error);
    }
  };

  // ✅ Carregar estatísticas de conversas não lidas
  // Atualiza ao montar o componente e quando navega para /conversations
  useEffect(() => {
    loadConversationStats();
  }, []);

  // Atualizar quando navega para a página de conversas
  useEffect(() => {
    if (location.pathname === '/conversations') {
      loadConversationStats();
    }
  }, [location.pathname]);

  const loadConversationStats = async () => {
    try {
      const response = await api.getConversationStats();
      if (response.success) {
        setUnreadMessages(response.data.unread_conversations || 0);
      }
    } catch (error) {
      console.error('Erro ao carregar estatísticas de conversas:', error);
    }
  };

  // ✅ Carregar notificações do sistema
  useEffect(() => {
    loadNotifications();
    const interval = setInterval(loadNotifications, 60000); // Refresh a cada minuto
    return () => clearInterval(interval);
  }, []);

  // ✅ Escutar eventos de desconexão de canal via Ably
  useEffect(() => {
    const unsubscribe = onAccountDisconnected((data) => {
      console.log('Channel disconnected:', data);
      loadNotifications(); // Recarrega notificações
    });

    return () => unsubscribe();
  }, []);

  const loadNotifications = async () => {
    try {
      const response = await api.getNotifications({ limit: 10 });
      if (response.success) {
        const notifications = response.data?.notifications || [];
        setNotifications(notifications);
        const unreadCount = notifications.filter(n => !n.is_read).length;
        setUnreadNotifications(unreadCount);
      }
    } catch (error) {
      console.error('Erro ao carregar notificações:', error);
    }
  };

  const handleNotificationClick = async (notification) => {
    // Marcar como lida
    try {
      await api.markNotificationAsRead(notification.id);
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true } : n
      ));
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }

    // Navegar para o link se existir
    if (notification.metadata?.link) {
      navigate(notification.metadata.link);
    }

    setShowNotifications(false);
  };

  const handleMarkAllAsRead = async () => {
    try {
      await api.markAllNotificationsAsRead();
      setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
      setUnreadNotifications(0);
    } catch (error) {
      console.error('Erro ao marcar todas como lidas:', error);
    }
  };

  // Marcar como lido sem navegar (apenas remove da lista do dropdown)
  const handleMarkAsReadOnly = async (e, notification) => {
    e.stopPropagation();
    try {
      await api.markNotificationAsRead(notification.id);
      setNotifications(prev => prev.map(n =>
        n.id === notification.id ? { ...n, is_read: true } : n
      ));
      setUnreadNotifications(prev => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Erro ao marcar notificação como lida:', error);
    }
  };

  // Handle invitation action (accept/reject) from notification
  const handleInvitationAction = async (e, notification, action) => {
    e.stopPropagation(); // Prevent notification click handler
    try {
      const response = await api.handleNotificationInvitationAction(notification.id, action);
      if (response.success) {
        // Update notification metadata to mark as handled
        setNotifications(prev => prev.map(n => {
          if (n.id === notification.id) {
            const metadata = typeof n.metadata === 'string' ? JSON.parse(n.metadata) : n.metadata;
            return {
              ...n,
              is_read: true,
              metadata: { ...metadata, handled: true, action_taken: action }
            };
          }
          return n;
        }));
        setUnreadNotifications(prev => Math.max(0, prev - 1));
      } else {
        alert(response.message || `Erro ao ${action === 'accept' ? 'aceitar' : 'rejeitar'} convite`);
      }
    } catch (error) {
      console.error(`Erro ao ${action} convite:`, error);
      alert(`Erro ao ${action === 'accept' ? 'aceitar' : 'rejeitar'} convite`);
    }
  };

  // Check if notification is an invitation type
  const isInvitationNotification = (notification) => {
    return ['invitation_received', 'invite_accepted'].includes(notification.type);
  };

  // Get invitation metadata (handles both string and object)
  const getNotificationMetadata = (notification) => {
    if (!notification.metadata) return {};
    return typeof notification.metadata === 'string'
      ? JSON.parse(notification.metadata)
      : notification.metadata;
  };

  const formatRelativeTime = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Agora';
    if (diffMins < 60) return `Há ${diffMins} minuto${diffMins > 1 ? 's' : ''}`;
    if (diffHours < 24) return `Há ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return `Há ${diffDays} dia${diffDays > 1 ? 's' : ''}`;
  };

  const navItems = [
    // Onboarding - aparece só quando não está completo
    ...(needsOnboarding ? [{
      path: onboardingFormDone ? null : '/onboarding',
      label: 'Onboarding',
      icon: ClipboardList,
      isOnboarding: true,
      isOnboardingProgress: onboardingFormDone,
      onClick: onboardingFormDone ? () => setShowOnboardingModal(true) : null
    }] : []),

    { path: '/', labelKey: 'menu.dashboard', icon: Home, section: null },

    // TRABALHO
    { sectionKey: 'sections.work' },
    { path: '/pipelines', labelKey: 'menu.pipeline', icon: BarChart3 },
    { path: '/tasks', labelKey: 'menu.tasks', icon: CheckSquare },
    { path: '/conversations', labelKey: 'menu.conversations', icon: MessageCircle, badge: unreadMessages },
    { path: '/contacts', labelKey: 'menu.contacts', icon: Users },

    // CAMPANHAS
    { sectionKey: 'sections.campaigns' },
    { path: '/aiemployees', labelKey: 'menu.aiAgents', icon: Bot },
    { path: '/campaigns', labelKey: 'menu.linkedin', icon: Linkedin },
    { path: '/google-maps-agents', labelKey: 'menu.googleMaps', icon: MapPin },
    { path: '/instagram-agents', labelKey: 'menu.instagram', icon: Camera },
    { path: '/activation-campaigns', labelKey: 'menu.lists', icon: Award },
  ];

  const allNavItems = [...navItems];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user?.name) return 'US';
    const names = user.name.trim().split(' ').filter(n => n.length > 0);
    if (names.length === 1) {
      // Se só tem um nome, pega as 2 primeiras letras
      return names[0].substring(0, 2).toUpperCase();
    }
    // Pega primeira letra do primeiro nome + primeira letra do segundo nome
    return (names[0][0] + names[1][0]).toUpperCase();
  };

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-900 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? 'w-16 overflow-visible' : 'w-56'}
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col
          transition-all duration-300 ease-in-out relative
        `}
      >
        {/* Logo */}
        <div className="h-14 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-3">
          {isCollapsed ? (
            <button
              onClick={() => {
                setIsCollapsed(false);
                localStorage.setItem('sidebarCollapsed', 'false');
              }}
              className="w-full flex items-center justify-center hover:bg-gray-50 dark:hover:bg-gray-700 rounded transition-colors p-2"
              title={t('userMenu.expandMenu')}
            >
              <img
                src={isDark ? "/logo/getraze-square-white.svg" : "/logo/getraze-square-purple.svg"}
                alt="GetRaze"
                className="w-8 h-8"
              />
            </button>
          ) : (
            <>
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <img
                  src={isDark ? "/logo/getraze-white.svg" : "/logo/getraze-purple.svg"}
                  alt="GetRaze"
                  className="h-8 w-auto"
                />
              </div>
              <button
                onClick={() => {
                  setIsCollapsed(true);
                  localStorage.setItem('sidebarCollapsed', 'true');
                }}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                title={t('userMenu.collapseMenu')}
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className={`flex-1 py-3 px-2 scrollbar-thin ${isCollapsed ? 'overflow-visible' : 'overflow-y-auto'}`}>
          {allNavItems.map((item, index) => {
            // Section Header
            if (item.sectionKey) {
              if (isCollapsed) {
                return (
                  <div key={index} className="my-2 border-t border-gray-200 dark:border-gray-700" />
                );
              }
              return (
                <div key={index} className="pt-4 pb-1.5 px-2">
                  <p className="text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                    {t(item.sectionKey)}
                  </p>
                </div>
              );
            }

            // Subsection Header (visual divider within a section)
            if (item.subsectionKey) {
              if (isCollapsed) {
                return <div key={index} className="my-1" />;
              }
              return (
                <div key={index} className="pt-2 pb-1 px-3">
                  <p className="text-[9px] font-medium text-gray-400 dark:text-gray-500">
                    {t(item.subsectionKey)}
                  </p>
                </div>
              );
            }

            // Nav Item
            const Icon = item.icon;
            const active = isActive(item.path);
            const label = item.label || t(item.labelKey);

            // Links que abrem em nova aba
            if (item.newTab) {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-2.5 px-3'} py-2.5 rounded-lg transition-all mb-0.5 relative group
                    text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm flex-1">{label}</span>
                  )}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-900 dark:bg-gray-700 text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 z-50 shadow-lg">
                      {label}
                      <div className="absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent border-r-gray-900 dark:border-r-gray-700" />
                    </div>
                  )}
                </a>
              );
            }

            // Items with onClick handler (e.g. onboarding progress modal)
            if (item.onClick) {
              return (
                <button
                  key={item.label}
                  onClick={item.onClick}
                  className={`
                    w-full flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-2.5 px-3'} py-2.5 rounded-lg transition-all mb-0.5 relative group
                    ${item.isOnboarding
                      ? item.isOnboardingProgress
                        ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium border border-purple-200 dark:border-purple-800'
                        : 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium border border-red-200 dark:border-red-800 animate-pulse'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400'
                    }
                  `}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && <span className="text-sm flex-1 text-left">{label}</span>}
                  {isCollapsed && (
                    <>
                      {item.isOnboarding && item.isOnboardingProgress && (
                        <span className="absolute top-1 right-1 w-2 h-2 bg-purple-500 rounded-full shadow-sm" />
                      )}
                      <div className={`absolute left-full ml-2 px-2 py-1 ${item.isOnboardingProgress ? 'bg-purple-600' : 'bg-gray-900 dark:bg-gray-700'} text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 z-50 shadow-lg`}>
                        {label}
                        <div className={`absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent ${item.isOnboardingProgress ? 'border-r-purple-600' : 'border-r-gray-900 dark:border-r-gray-700'}`} />
                      </div>
                    </>
                  )}
                </button>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-2.5 px-3'} py-2.5 rounded-lg transition-all mb-0.5 relative group
                  ${item.isOnboarding
                    ? 'bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 font-medium border border-red-200 dark:border-red-800 animate-pulse'
                    : active
                      ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400'
                  }
                `}
              >
                <Icon className={`w-4 h-4 flex-shrink-0 ${item.isOnboarding ? 'animate-bounce' : ''}`} />
                {!isCollapsed && (
                  <>
                    <span className="text-sm flex-1">{label}</span>
                    {item.badge > 0 && (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white min-w-[18px] text-center shadow-sm">
                        {item.badge > 99 ? '99+' : item.badge}
                      </span>
                    )}
                  </>
                )}
                {isCollapsed && (
                  <>
                    {item.badge > 0 && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full shadow-sm" />
                    )}
                    {item.isOnboarding && (
                      <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full shadow-sm animate-ping" />
                    )}
                    <div className={`absolute left-full ml-2 px-2 py-1 ${item.isOnboarding ? 'bg-red-600' : 'bg-gray-900 dark:bg-gray-700'} text-white text-xs rounded-md whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-opacity duration-150 z-50 shadow-lg`}>
                      {label}
                      {item.badge > 0 && (
                        <span className="ml-2 px-1.5 py-0.5 bg-red-500 rounded-full text-[10px] font-bold">
                          {item.badge > 99 ? '99+' : item.badge}
                        </span>
                      )}
                      <div className={`absolute top-1/2 -left-1 -translate-y-1/2 border-4 border-transparent ${item.isOnboarding ? 'border-r-red-600' : 'border-r-gray-900 dark:border-r-gray-700'}`} />
                    </div>
                  </>
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`
              w-full ${isCollapsed ? 'p-2' : 'p-3'} flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2.5'}
              hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors
            `}
          >
            {(user?.profile_picture || user?.avatar_url) ? (
              <img
                src={
                  user.profile_picture ||
                  (user.avatar_url && user.avatar_url.startsWith('http')
                    ? `${user.avatar_url}?v=${user.updated_at || Date.now()}`
                    : user.avatar_url)
                }
                alt={user.name}
                className="w-8 h-8 rounded-full object-cover"
              />
            ) : (
              <div className="w-8 h-8 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-xs font-bold">
                {getUserInitials()}
              </div>
            )}
            {!isCollapsed && (
              <>
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-gray-100 truncate">
                    {user?.name || t('userMenu.user')}
                  </p>
                  <p className="text-[10px] text-gray-500 dark:text-gray-400">
                    {user?.role === 'admin' ? t('roles.admin') : user?.role === 'supervisor' ? t('roles.supervisor') : t('roles.user')}
                  </p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
              </>
            )}
          </button>

          {/* User Submenu */}
          {showUserMenu && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setShowUserMenu(false)}
              />
              <div
                className={`
                  absolute bottom-full mb-2 left-0
                  bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-xl dark:shadow-gray-900/50 z-20
                  min-w-[240px] overflow-hidden
                `}
              >

                {/* User Header */}
                <div className="px-4 py-3 bg-gradient-to-r from-purple-50 dark:from-purple-900/20 to-white dark:to-gray-800 border-b border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-3">
                    {(user?.profile_picture || user?.avatar_url) ? (
                      <img
                        src={
                          user.profile_picture ||
                          (user.avatar_url && user.avatar_url.startsWith('http')
                            ? `${user.avatar_url}?v=${user.updated_at || Date.now()}`
                            : user.avatar_url)
                        }
                        alt={user.name}
                        className="w-10 h-10 rounded-full object-cover border-2 border-purple-200 dark:border-purple-900/30"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white text-sm font-bold border-2 border-purple-200 dark:border-purple-900/30">
                        {getUserInitials()}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 truncate">{user?.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{user?.email}</p>
                    </div>
                  </div>
                </div>

                {/* Menu simplificado */}
                <div className="py-1">
                  <Link
                    to="/my-account"
                    className="flex items-center space-x-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <User className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span>Minha Conta</span>
                  </Link>
                  <Link
                    to="/config"
                    className="flex items-center space-x-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm transition-colors"
                    onClick={() => setShowUserMenu(false)}
                  >
                    <Settings className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                    <span>Configurações</span>
                  </Link>
                  {(hasPermission('users:view:all') || hasPermission('users:view:team') ||
                    hasPermission('sectors:view') || hasPermission('permissions:manage')) && (
                    <Link
                      to="/team"
                      className="flex items-center space-x-3 px-4 py-2.5 hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm transition-colors"
                      onClick={() => setShowUserMenu(false)}
                    >
                      <Users className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                      <span>Equipe</span>
                    </Link>
                  )}
                </div>

                {/* Logout */}
                <div className="border-t border-gray-100 dark:border-gray-700 mx-3" />
                <div className="py-1">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 text-sm transition-colors"
                  >
                    <LogOut className="w-4 h-4" />
                    <span>{t('userMenu.logout')}</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-[#7229f7] dark:bg-[#5b21b6] border-b border-purple-800 flex items-center justify-end px-6">
          {/* Trial Indicator + Credits Indicator + Notification Icons */}
          <div className="flex items-center space-x-3">
            {/* Trial Indicator - shows days remaining for trial users */}
            <TrialIndicator />

            {/* Credits Indicator */}
            <CreditsIndicator />

            {/* Feedbacks / Roadmap */}
            <a
              href="/next"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 hover:bg-purple-600 rounded-lg transition-colors"
              title="Feedbacks / Roadmap"
            >
              <Lightbulb className="w-5 h-5 text-white" />
            </a>

            {/* Conversations Notification */}
            <button
              onClick={() => navigate('/conversations')}
              className="relative p-2 hover:bg-purple-600 rounded-lg transition-colors"
              title={unreadMessages > 0 ? `${unreadMessages} nova${unreadMessages > 1 ? 's' : ''} conversa${unreadMessages > 1 ? 's' : ''}` : 'Conversas'}
            >
              <MessageCircle className="w-5 h-5 text-white" />
              {unreadMessages > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg border-2 border-purple-700">
                  {unreadMessages > 99 ? '99+' : unreadMessages}
                </span>
              )}
            </button>

            {/* System Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-purple-600 rounded-lg transition-colors"
                title={unreadNotifications > 0 ? `${unreadNotifications} notificaç${unreadNotifications > 1 ? 'ões' : 'ão'}` : 'Notificações'}
              >
                <Bell className="w-5 h-5 text-white" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1 shadow-lg border-2 border-purple-700">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </button>

              {/* Notifications Dropdown */}
              {showNotifications && (
                <>
                  <div
                    className="fixed inset-0 z-10"
                    onClick={() => setShowNotifications(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
                      <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">Notificações</h3>
                      {unreadNotifications > 0 && (
                        <button
                          onClick={handleMarkAllAsRead}
                          className="text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700"
                        >
                          Marcar todas como lidas
                        </button>
                      )}
                    </div>
                    <div className="divide-y divide-gray-100 dark:divide-gray-700">
                      {notifications.filter(n => !n.is_read).length === 0 ? (
                        <div className="p-4 text-center text-gray-500 dark:text-gray-400 text-sm">
                          Nenhuma notificação não lida
                        </div>
                      ) : (
                        notifications.filter(n => !n.is_read).map((notification) => {
                          const metadata = getNotificationMetadata(notification);
                          const isInvitation = isInvitationNotification(notification);
                          const isHandled = metadata?.handled;

                          return (
                            <div
                              key={notification.id}
                              onClick={() => !isInvitation || isHandled ? handleNotificationClick(notification) : null}
                              className={`p-3 hover:bg-gray-50 dark:hover:bg-gray-700 ${
                                !isInvitation || isHandled ? 'cursor-pointer' : ''
                              } ${
                                !notification.is_read ? 'bg-purple-50 dark:bg-purple-900/20' : ''
                              }`}
                            >
                              <div className="flex items-start gap-3">
                                {/* Icon/Avatar based on notification type */}
                                {isInvitation && metadata?.profile_picture ? (
                                  <img
                                    src={metadata.profile_picture}
                                    alt={metadata.contact_name || metadata.inviter_name || 'Perfil'}
                                    className="w-10 h-10 rounded-full object-cover flex-shrink-0"
                                  />
                                ) : isInvitation ? (
                                  <div className="w-10 h-10 rounded-full bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center flex-shrink-0">
                                    <UserPlus className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                  </div>
                                ) : notification.type === 'channel_disconnected' ? (
                                  <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                                    <AlertCircle className="w-5 h-5 text-red-500" />
                                  </div>
                                ) : (
                                  <div className="w-10 h-10 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                                    <Bell className="w-5 h-5 text-gray-500 dark:text-gray-400" />
                                  </div>
                                )}

                                <div className="flex-1 min-w-0">
                                  <p className={`text-xs font-medium ${
                                    !notification.is_read
                                      ? 'text-gray-900 dark:text-gray-100'
                                      : 'text-gray-700 dark:text-gray-300'
                                  }`}>
                                    {notification.title}
                                  </p>
                                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 line-clamp-2">
                                    {notification.message}
                                  </p>
                                  <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">
                                    {formatRelativeTime(notification.created_at)}
                                  </p>

                                  {/* Action buttons for received invitations */}
                                  {notification.type === 'invitation_received' && !isHandled && (
                                    <div className="flex gap-2 mt-2">
                                      <button
                                        onClick={(e) => handleInvitationAction(e, notification, 'accept')}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors font-medium"
                                      >
                                        <Check className="w-3 h-3" />
                                        Aceitar
                                      </button>
                                      <button
                                        onClick={(e) => handleInvitationAction(e, notification, 'reject')}
                                        className="flex items-center gap-1 px-2.5 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors font-medium"
                                      >
                                        <X className="w-3 h-3" />
                                        Rejeitar
                                      </button>
                                    </div>
                                  )}

                                  {/* Show status for handled invitations */}
                                  {notification.type === 'invitation_received' && isHandled && (
                                    <p className={`text-[10px] mt-1 font-medium ${
                                      metadata.action_taken === 'accept'
                                        ? 'text-green-600 dark:text-green-400'
                                        : 'text-red-500 dark:text-red-400'
                                    }`}>
                                      {metadata.action_taken === 'accept' ? '✓ Convite aceito' : '✗ Convite rejeitado'}
                                    </p>
                                  )}
                                </div>

                                <button
                                  onClick={(e) => handleMarkAsReadOnly(e, notification)}
                                  className="p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-full flex-shrink-0 transition-colors"
                                  title="Marcar como lido"
                                >
                                  <Check className="w-3.5 h-3.5 text-purple-500 dark:text-purple-400" />
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                    <div className="p-2 border-t border-gray-200 dark:border-gray-700">
                      <button
                        onClick={() => {
                          navigate('/notifications');
                          setShowNotifications(false);
                        }}
                        className="w-full text-xs text-purple-600 dark:text-purple-400 hover:text-purple-700 font-medium py-1"
                      >
                        Ver todas notificações
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Onboarding Alert - shows when onboarding is not completed */}
        <OnboardingAlert />

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet context={{ refreshUnreadCount: loadConversationStats }} />
        </main>
      </div>

      {/* Canceled Subscription Overlay - blocks access for canceled users */}
      <CanceledOverlay />

      {/* Onboarding Progress Modal */}
      {showOnboardingModal && onboardingProgressData && (
        <OnboardingProgress
          data={onboardingProgressData}
          onClose={() => setShowOnboardingModal(false)}
        />
      )}
    </div>
  );
};

export default Layout;
