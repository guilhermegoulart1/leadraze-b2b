import React, { useState } from 'react';
import { Award, Users } from 'lucide-react';
import ActivationCampaignsPage from './ActivationCampaignsPage';
import ContactListsPage from './ContactListsPage';

const ListasPage = () => {
  const [activeTab, setActiveTab] = useState('campaigns');

  const tabs = [
    { id: 'campaigns', label: 'Campanhas', icon: Award },
    { id: 'contacts', label: 'Listas de Contatos', icon: Users },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'campaigns':
        return <ActivationCampaignsPage />;
      case 'contacts':
        return <ContactListsPage />;
      default:
        return <ActivationCampaignsPage />;
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
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto">
        {renderContent()}
      </div>
    </div>
  );
};

export default ListasPage;
