import React, { useState } from 'react';
import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Home, Search, Award, BarChart3, MessageCircle,
  Bot, Lightbulb, Settings, LogOut,
  ChevronLeft, ChevronRight, Bell, User,
  ChevronDown, Users
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [unreadMessages, setUnreadMessages] = useState(3); // Mock data
  const [unreadNotifications, setUnreadNotifications] = useState(2); // Mock data

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home, section: null },

    // Prospecção
    { section: 'Prospecção' },
    { path: '/search', label: 'Busca de Perfis', icon: Search },
    { path: '/campaigns', label: 'Campanhas', icon: Award },

    // CRM
    { section: 'CRM' },
    { path: '/leads', label: 'Pipeline', icon: BarChart3 },
    { path: '/conversations', label: 'Conversas', icon: MessageCircle, badge: unreadMessages },

    // Inteligência Artificial
    { section: 'Inteligência Artificial' },
    { path: '/ai-agents', label: 'Agentes de IA', icon: Bot },
    { path: '/insights', label: 'Insights', icon: Lightbulb },
  ];

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const getUserInitials = () => {
    if (!user?.name) return 'US';
    return user.name
      .split(' ')
      .map(n => n[0])
      .join('')
      .substring(0, 2)
      .toUpperCase();
  };

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`
          ${isCollapsed ? 'w-16' : 'w-56'}
          bg-white border-r border-gray-200 flex flex-col
          transition-all duration-300 ease-in-out relative
        `}
      >
        {/* Logo */}
        <div className="h-14 border-b border-gray-200 flex items-center justify-between px-3">
          {isCollapsed ? (
            <button
              onClick={() => setIsCollapsed(false)}
              className="w-full flex items-center justify-center hover:bg-gray-50 rounded transition-colors p-2"
              title="Expandir menu"
            >
              <img
                src="/logo/getraze-square-purple.svg"
                alt="GetRaze"
                className="w-8 h-8"
              />
            </button>
          ) : (
            <>
              <div className="flex items-center space-x-2 flex-1 min-w-0">
                <img
                  src="/logo/getraze-purple.svg"
                  alt="GetRaze"
                  className="h-8 w-auto"
                />
              </div>
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0"
                title="Recolher menu"
              >
                <ChevronLeft className="w-4 h-4 text-gray-600" />
              </button>
            </>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2 scrollbar-thin">
          {navItems.map((item, index) => {
            // Section Header
            if (item.section) {
              if (isCollapsed) {
                return (
                  <div key={index} className="my-2 border-t border-gray-200" />
                );
              }
              return (
                <div key={index} className="pt-4 pb-1.5 px-2">
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    {item.section}
                  </p>
                </div>
              );
            }

            // Nav Item
            const Icon = item.icon;
            const active = isActive(item.path);

            return (
              <Link
                key={item.path}
                to={item.path}
                className={`
                  flex items-center ${isCollapsed ? 'justify-center px-2' : 'space-x-2.5 px-3'} py-2.5 rounded-lg transition-all mb-0.5 relative
                  ${active
                    ? 'bg-purple-50 text-purple-600 font-medium'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-purple-600'
                  }
                `}
                title={isCollapsed ? item.label : ''}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {!isCollapsed && (
                  <>
                    <span className="text-sm flex-1">{item.label}</span>
                    {item.badge && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-purple-100 text-purple-700 min-w-[18px] text-center">
                        {item.badge}
                      </span>
                    )}
                  </>
                )}
                {isCollapsed && item.badge && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-purple-600 rounded-full" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* User Profile Footer */}
        <div className="border-t border-gray-200 relative">
          <button
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`
              w-full ${isCollapsed ? 'p-2' : 'p-3'} flex items-center ${isCollapsed ? 'justify-center' : 'space-x-2.5'}
              hover:bg-gray-50 transition-colors
            `}
          >
            {user?.profile_picture ? (
              <img
                src={user.profile_picture}
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
                  <p className="text-xs font-semibold text-gray-900 truncate">
                    {user?.name || 'Usuário'}
                  </p>
                  <p className="text-[10px] text-gray-500">Admin</p>
                </div>
                <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${showUserMenu ? 'rotate-180' : ''}`} />
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
                  absolute bottom-full mb-2 ${isCollapsed ? 'left-full ml-2' : 'left-0 right-0 mx-2'}
                  bg-white border border-gray-200 rounded-lg shadow-lg py-1 z-20
                  min-w-[180px]
                `}
              >
                <Link
                  to="/profile"
                  className="flex items-center space-x-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700 text-sm"
                  onClick={() => setShowUserMenu(false)}
                >
                  <User className="w-4 h-4" />
                  <span>Meu Perfil</span>
                </Link>
                <Link
                  to="/settings"
                  className="flex items-center space-x-2.5 px-3 py-2 hover:bg-gray-50 text-gray-700 text-sm"
                  onClick={() => setShowUserMenu(false)}
                >
                  <Settings className="w-4 h-4" />
                  <span>Configurações</span>
                </Link>
                <div className="border-t border-gray-200 my-1" />
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center space-x-2.5 px-3 py-2 hover:bg-red-50 text-red-600 text-sm"
                >
                  <LogOut className="w-4 h-4" />
                  <span>Sair</span>
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="h-14 bg-[#7229f7] border-b border-purple-800 flex items-center justify-end px-6">
          {/* Notification Icons */}
          <div className="flex items-center space-x-3">
            {/* Conversations Notification */}
            <button
              onClick={() => navigate('/conversations')}
              className="relative p-2 hover:bg-purple-600 rounded-lg transition-colors"
              title="Novas conversas"
            >
              <MessageCircle className="w-5 h-5 text-white" />
              {unreadMessages > 0 && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                  {unreadMessages}
                </span>
              )}
            </button>

            {/* System Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifications(!showNotifications)}
                className="relative p-2 hover:bg-purple-600 rounded-lg transition-colors"
                title="Notificações"
              >
                <Bell className="w-5 h-5 text-white" />
                {unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold rounded-full w-4 h-4 flex items-center justify-center">
                    {unreadNotifications}
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
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default Layout;
