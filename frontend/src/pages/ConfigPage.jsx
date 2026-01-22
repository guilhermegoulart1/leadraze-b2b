import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Key, Link2, CheckSquare, Mail, Package, XCircle, Tag, Share2, MessageSquare } from 'lucide-react';
import ApiKeysPage from './ApiKeysPage';
import ChannelsPage from './ChannelsPage';
import ChecklistTemplatesPage from './ChecklistTemplatesPage';
import EmailSettingsPage from './EmailSettingsPage';
import TagsPage from './TagsPage';
import ProductsTab from '../components/settings/ProductsTab';
import DiscardReasonsTab from '../components/settings/DiscardReasonsTab';
import LeadSourcesTab from '../components/settings/LeadSourcesTab';
import QuickRepliesTab from '../components/settings/QuickRepliesTab';

const ConfigPage = () => {
  const { t } = useTranslation('settings');
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'products');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const tabs = [
    { id: 'products', label: t('configTabs.products'), icon: Package },
    { id: 'discard-reasons', label: t('configTabs.discardReasons'), icon: XCircle },
    { id: 'lead-sources', label: t('configTabs.leadSources'), icon: Share2 },
    { id: 'tags', label: t('configTabs.tags'), icon: Tag },
    { id: 'api-keys', label: t('configTabs.apiKeys'), icon: Key },
    { id: 'channels', label: t('configTabs.channels'), icon: Link2 },
    { id: 'checklists', label: t('configTabs.checklists'), icon: CheckSquare },
    { id: 'emails', label: t('configTabs.emails'), icon: Mail },
    { id: 'quick-replies', label: t('configTabs.quickReplies'), icon: MessageSquare },
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
      case 'checklists':
        return <ChecklistTemplatesPage />;
      case 'emails':
        return <EmailSettingsPage />;
      case 'quick-replies':
        return <QuickRepliesTab />;
      default:
        return <ProductsTab />;
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 px-6">
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
                      ? 'border-purple-600 text-purple-600 dark:border-purple-500 dark:text-purple-400'
                      : 'border-transparent text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <Icon className="w-4 h-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
          <span className="text-xs text-gray-400 dark:text-gray-500">v8.6</span>
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
