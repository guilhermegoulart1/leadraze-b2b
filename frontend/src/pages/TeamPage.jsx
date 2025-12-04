import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Users, Building2, Lock } from 'lucide-react';
import UsersPage from './UsersPage';
import SectorsPage from './SectorsPage';
import PermissionsPage from './PermissionsPage';

const TeamPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'users');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const tabs = [
    { id: 'users', label: 'Usuários', icon: Users },
    { id: 'sectors', label: 'Setores', icon: Building2 },
    { id: 'permissions', label: 'Permissões', icon: Lock },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'users':
        return <UsersPage />;
      case 'sectors':
        return <SectorsPage />;
      case 'permissions':
        return <PermissionsPage />;
      default:
        return <UsersPage />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <nav className="flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-purple-600 text-purple-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                  }
                `}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default TeamPage;
