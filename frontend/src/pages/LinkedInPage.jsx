import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Award, Search, Users, FileText } from 'lucide-react';
import CampaignsPage from './CampaignsPage';
import SearchPage from './SearchPage';
import MyConnectionsPage from './MyConnectionsPage';
import SearchPostsPage from './SearchPostsPage';

const LinkedInPage = () => {
  const { t } = useTranslation('linkedin');
  const [activeTab, setActiveTab] = useState('campaigns');

  const tabs = [
    { id: 'campaigns', label: t('tabs.campaigns'), icon: Award },
    { id: 'search', label: t('tabs.searchProfiles'), icon: Search },
    { id: 'posts', label: t('tabs.searchPosts'), icon: FileText },
    { id: 'connections', label: t('tabs.myConnections'), icon: Users },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'campaigns':
        return <CampaignsPage />;
      case 'search':
        return <SearchPage />;
      case 'posts':
        return <SearchPostsPage />;
      case 'connections':
        return <MyConnectionsPage />;
      default:
        return <CampaignsPage />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
        <nav className="flex space-x-6" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`
                  flex items-center gap-2 py-4 px-1 border-b-2 font-medium text-sm transition-colors
                  ${isActive
                    ? 'border-purple-600 text-purple-600 dark:border-purple-400 dark:text-purple-400'
                    : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-500'
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

export default LinkedInPage;
