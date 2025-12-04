import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Key, Link2, CheckSquare, Mail, Globe } from 'lucide-react';
import ApiKeysPage from './ApiKeysPage';
import ChannelsPage from './ChannelsPage';
import ChecklistTemplatesPage from './ChecklistTemplatesPage';
import EmailSettingsPage from './EmailSettingsPage';
import WebsiteAgentsPage from './WebsiteAgentsPage';

const ConfigPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'api-keys');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const tabs = [
    { id: 'api-keys', label: 'API Key', icon: Key },
    { id: 'channels', label: 'Canais Conectados', icon: Link2 },
    { id: 'checklists', label: 'CRM Checklists', icon: CheckSquare },
    { id: 'emails', label: 'Emails', icon: Mail },
    { id: 'website-agents', label: 'Website Agents', icon: Globe },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'api-keys':
        return <ApiKeysPage />;
      case 'channels':
        return <ChannelsPage />;
      case 'checklists':
        return <ChecklistTemplatesPage />;
      case 'emails':
        return <EmailSettingsPage />;
      case 'website-agents':
        return <WebsiteAgentsPage />;
      default:
        return <ApiKeysPage />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex items-center justify-between">
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
          <span className="text-xs text-gray-400">v8.2.1</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default ConfigPage;
