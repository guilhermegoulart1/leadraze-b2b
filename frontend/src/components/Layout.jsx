import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Home, Search, Award, BarChart3, MessageCircle,
  Bot, Users, TrendingUp, Settings, Zap, LogOut
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';

const Layout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();

  const isActive = (path) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: Home, section: null },

    // Prospecção
    { section: 'Prospecção' },
    { path: '/search', label: 'Buscar Leads', icon: Search },
    { path: '/campaigns', label: 'Campanhas', icon: Award },

    // CRM
    { section: 'CRM' },
    { path: '/leads', label: 'Pipeline', icon: BarChart3, badge: 156 },
    { path: '/conversations', label: 'Conversas', icon: MessageCircle, badge: 8, badgeColor: 'red' },

    // Automação
    { section: 'Automação' },
    { path: '/ai-agents', label: 'Agentes de IA', icon: Bot },
    { path: '/linkedin-accounts', label: 'Contas LinkedIn', icon: Users },

    // Analytics
    { section: 'Analytics' },
    { path: '/analytics', label: 'Relatórios', icon: TrendingUp },
    { path: '/settings', label: 'Configurações', icon: Settings },
  ];

  return (
    <div className="flex h-screen bg-gray-50">

      {/* Sidebar com dados do usuário no topo */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col overflow-hidden">

        {/* Header do Sidebar com Logo e Usuário */}
        <div className="border-b border-gray-200">
          {/* Logo */}
          <div className="p-4 border-b border-gray-100">
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-600 to-purple-800 w-10 h-10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-gray-900">LeadRaze</h1>
                <p className="text-xs text-gray-500">B2B Lead Generation</p>
              </div>
            </div>
          </div>

          {/* Usuário */}
          <div className="p-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white font-bold">
                {user?.name?.substring(0, 2).toUpperCase() || 'US'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900 truncate">{user?.name || 'Usuário'}</p>
                <p className="text-xs text-gray-500">Vendedor</p>
              </div>
              <button
                onClick={logout}
                className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                title="Sair"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Navegação */}
        <nav className="flex-1 overflow-y-auto p-4 space-y-1">
          {navItems.map((item, index) => {
            // Section Header
            if (item.section) {
              return (
                <div key={index} className="pt-6 pb-2">
                  <p className="px-4 text-xs font-semibold text-gray-400 uppercase tracking-wider">
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
                  flex items-center space-x-3 px-4 py-3 rounded-lg transition-all
                  ${active
                    ? 'bg-purple-50 border-l-3 border-purple-600 text-purple-600'
                    : 'text-gray-700 hover:bg-gray-50 border-l-3 border-transparent hover:border-purple-300'
                  }
                `}
              >
                <Icon className="w-5 h-5" />
                <span className="font-medium flex-1">{item.label}</span>
                {item.badge && (
                  <span className={`
                    text-xs font-semibold px-2 py-1 rounded-full
                    ${item.badgeColor === 'red'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-purple-100 text-purple-700'
                    }
                  `}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden">
        <Outlet />
      </main>

    </div>
  );
};

export default Layout;
