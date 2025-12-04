import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { User, CreditCard, Gift } from 'lucide-react';
import ProfilePage from './ProfilePage';
import BillingPage from './BillingPage';
import AffiliatePage from './AffiliatePage';

const MyAccountPage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState(searchParams.get('tab') || 'profile');

  useEffect(() => {
    const tab = searchParams.get('tab');
    if (tab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (tabId) => {
    setActiveTab(tabId);
    setSearchParams({ tab: tabId });
  };

  const tabs = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'billing', label: 'Cobrança', icon: CreditCard },
    { id: 'affiliate', label: 'Programa de Afiliados', icon: Gift },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'profile':
        return <ProfilePage />;
      case 'billing':
        return <BillingPage />;
      case 'affiliate':
        return <AffiliatePage />;
      default:
        return <ProfilePage />;
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

export default MyAccountPage;
