import React from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { 
  Home, Search, Award, BarChart3, MessageCircle, 
  Bot, Users, TrendingUp, Settings, Bell, Zap
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
    <div className="min-h-screen bg-gray-50">
      
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="px-6 py-4">
          <div className="flex items-center justify-between">
            
            {/* Logo */}
            <div className="flex items-center space-x-3">
              <div className="bg-gradient-to-br from-purple-600 to-purple-800 w-10 h-10 rounded-lg flex items-center justify-center">
                <Zap className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-gray-900">LeadRaze</h1>
                <p className="text-xs text-gray-500">B2B Lead Generation</p>
              </div>
            </div>

            {/* Search & Actions */}
            <div className="flex items-center space-x-4">
              
              {/* Search */}
              <div className="relative">
                <input 
                  type="text" 
                  placeholder="Buscar leads, campanhas..." 
                  className="pl-10 pr-4 py-2 w-80 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                />
                <Search className="w-5 h-5 text-gray-400 absolute left-3 top-2.5" />
              </div>

              {/* Notifications */}
              <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-6 h-6" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full animate-pulse"></span>
              </button>

              {/* User Menu */}
              <div className="flex items-center space-x-3 pl-4 border-l border-gray-300">
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-900">{user?.name || 'Usuário'}</p>
                  <p className="text-xs text-gray-500">Vendedor</p>
                </div>
                <button 
                  onClick={logout}
                  className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-full flex items-center justify-center text-white font-bold hover:opacity-90 transition-opacity"
                >
                  {user?.name?.substring(0, 2).toUpperCase() || 'U'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      <div className="flex h-[calc(100vh-73px)]">
        
        {/* Sidebar */}
        <aside className="w-64 bg-white border-r border-gray-200 overflow-y-auto flex-shrink-0">
          <nav className="p-4 space-y-1">
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
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>

      </div>
    </div>
  );
};

export default Layout;