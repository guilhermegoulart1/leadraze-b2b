import React, { useState, useEffect } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Search, Award, BarChart3, MessageCircle,
  Bot, Lightbulb, LogOut,
  ChevronLeft, ChevronRight, Bell, User,
  ChevronDown, Users, Shield, Lock, Linkedin, MapPin, CreditCard,
  Mail, Settings, Globe, Link2, Gift, Key, CheckSquare, ListTodo, Eye
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../services/api';
import OnboardingChecklist from './OnboardingChecklist';
import CreditsIndicator from './CreditsIndicator';
import TrialIndicator from './TrialIndicator';
import CanceledOverlay from './CanceledOverlay';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { t } = useTranslation('navigation');
  const { user, logout, isAdmin, isSupervisor, hasPermission } = useAuth();
  const { isDark } = useTheme();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(0); // Real data from API
  const [unreadNotifications, setUnreadNotifications] = useState(0); // System notifications

  const isActive = (path) => location.pathname === path;

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

  const navItems = [
    { path: '/', labelKey: 'menu.dashboard', icon: Home, section: null },

    // TRABALHO
    { sectionKey: 'sections.work' },
    { path: '/leads', labelKey: 'menu.pipeline', icon: BarChart3 },
    { path: '/tasks', labelKey: 'menu.tasks', icon: CheckSquare },
    { path: '/conversations', labelKey: 'menu.conversations', icon: MessageCircle, badge: unreadMessages },
    { path: '/contacts', labelKey: 'menu.contacts', icon: Users },

    // CAMPANHAS
    { sectionKey: 'sections.campaigns' },
    { path: '/agents', labelKey: 'menu.aiAgents', icon: Bot },
    { path: '/campaigns', labelKey: 'menu.linkedin', icon: Linkedin },
    { path: '/google-maps-agents', labelKey: 'menu.googleMaps', icon: MapPin },
    { path: '/activation-campaigns', labelKey: 'menu.lists', icon: Award },
  ];

  // INTELIGÊNCIA - apenas para admin
  const adminNavItems = isAdmin ? [
    { sectionKey: 'sections.intelligence' },
    { path: '/secret-agent', labelKey: 'menu.secretAgent', icon: Eye },
  ] : [];

  const allNavItems = [...navItems, ...adminNavItems];

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
          ${isCollapsed ? 'w-16' : 'w-56'}
          bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col
          transition-all duration-300 ease-in-out relative
        `}
      >
        {/* Logo */}
        <div className="h-14 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-3">
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
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
                onClick={() => setIsCollapsed(true)}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition-colors flex-shrink-0"
                title={t('userMenu.collapseMenu')}
              >
                <ChevronLeft className="w-4 h-4 text-gray-600 dark:text-gray-400" />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
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
            const label = t(item.labelKey);

            // Links que abrem em nova aba
            if (item.newTab) {
              return (
                <a
                  key={item.path}
                  href={item.path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`
                    flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-2.5 px-3'} py-2.5 rounded-lg transition-all mb-0.5 relative
                    text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400
                  `}
                  title={isCollapsed ? label : ''}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="text-sm flex-1">{label}</span>
                  )}
                </a>
              );
            }

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-2.5 px-3'} py-2.5 rounded-lg transition-all mb-0.5 relative
                  ${active
                    ? 'bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:text-purple-600 dark:hover:text-purple-400'
                  }
                `}
                title={isCollapsed ? label : ''}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
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
                {isCollapsed && item.badge > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full shadow-sm" />
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
                  <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-20 max-h-96 overflow-y-auto">
                    <div className="p-3 border-b border-gray-200">
                      <h3 className="text-sm font-semibold text-gray-900">Notificações</h3>
                    </div>
                    <div className="divide-y divide-gray-100">
                      <div className="p-3 hover:bg-gray-50 cursor-pointer">
                        <p className="text-xs font-medium text-gray-900">Nova campanha criada</p>
                        <p className="text-xs text-gray-500 mt-0.5">Há 5 minutos</p>
                      </div>
                      <div className="p-3 hover:bg-gray-50 cursor-pointer">
                        <p className="text-xs font-medium text-gray-900">10 novos leads adicionados</p>
                        <p className="text-xs text-gray-500 mt-0.5">Há 1 hora</p>
                      </div>
                    </div>
                    <div className="p-2 border-t border-gray-200">
                      <button className="w-full text-xs text-purple-600 hover:text-purple-700 font-medium py-1">
                        Ver todas notificações
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-auto">
          <Outlet context={{ refreshUnreadCount: loadConversationStats }} />
        </main>
      </div>

      {/* Onboarding Checklist */}
      <OnboardingChecklist />

      {/* Canceled Subscription Overlay - blocks access for canceled users */}
      <CanceledOverlay />
    </div>
  );
};

export default Layout;
