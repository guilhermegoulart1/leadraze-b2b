import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Key, Link2, Package, XCircle, Tag, Share2, MessageSquare, Map, Shield, Chrome } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import ApiKeysPage from './ApiKeysPage';
import ChannelsPage from './ChannelsPage';
import TagsPage from './TagsPage';
import ProductsTab from '../components/settings/ProductsTab';
import DiscardReasonsTab from '../components/settings/DiscardReasonsTab';
import LeadSourcesTab from '../components/settings/LeadSourcesTab';
import QuickRepliesTab from '../components/settings/QuickRepliesTab';
import RoadmapsTab from '../components/settings/RoadmapsTab';
import SupportAccessTab from '../components/settings/SupportAccessTab';
import ChromeExtensionTab from '../components/settings/ChromeExtensionTab';

const ConfigPage = () => {
  const { t } = useTranslation('settings');
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'channels');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const tabs = [
    { id: 'channels', label: 'Canais', icon: Link2 },
    { id: 'products', label: t('configTabs.products'), icon: Package },
    { id: 'discard-reasons', label: t('configTabs.discardReasons'), icon: XCircle },
    { id: 'lead-sources', label: t('configTabs.leadSources'), icon: Share2 },
    { id: 'tags', label: t('configTabs.tags'), icon: Tag },
    { id: 'api-keys', label: t('configTabs.apiKeys'), icon: Key },
    { id: 'quick-replies', label: t('configTabs.quickReplies'), icon: MessageSquare },
    { id: 'roadmaps', label: t('configTabs.roadmaps', 'Roadmaps'), icon: Map },
    { id: 'chrome-extension', label: t('configTabs.chromeExtension'), icon: Chrome },
    { id: 'support-access', label: 'Acesso Remoto', icon: Shield, adminOnly: true },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'products':
        return <ProductsTab />;
      case 'discard-reasons':
        return <DiscardReasonsTab />;
      case 'lead-sources':
        return <LeadSourcesTab />;
      case 'tags':
        return <TagsPage />;
      case 'api-keys':
        return <ApiKeysPage />;
      case 'channels':
        return <ChannelsPage />;
      case 'quick-replies':
        return <QuickRepliesTab />;
      case 'roadmaps':
        return <RoadmapsTab />;
      case 'chrome-extension':
        return <ChromeExtensionTab />;
      case 'support-access':
        return <SupportAccessTab />;
      default:
        return <ChannelsPage />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-4">
        <div className="flex items-center justify-between">
          <nav className="flex space-x-2 overflow-x-auto scrollbar-hide" aria-label="Tabs">
            {tabs.filter(tab => !tab.adminOnly || user?.role === 'admin').map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`
                    flex items-center gap-1.5 py-3 px-2 border-b-2 font-medium text-xs whitespace-nowrap transition-colors
                    ${isActive
                      ? 'border-purple-600 text-purple-600 dark:border-purple-500 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          <span className="text-xs text-gray-400 dark:text-gray-500 ml-2 flex-shrink-0">v8.6</span>
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
