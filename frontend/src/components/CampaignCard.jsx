import React from 'react';
import { Bot } from 'lucide-react';

const CampaignCard = ({ campaign }) => {
  const progress = campaign.total_leads > 0 
    ? ((campaign.qualified / campaign.total_leads) * 100).toFixed(0)
    : 0;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-purple-300 transition-all">
      
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h4 className="font-semibold text-gray-900 mb-1">{campaign.name}</h4>
          <p className="text-xs text-gray-500">
            Criada há {campaign.days_ago} dias • {campaign.linkedin_username}
          </p>
        </div>
        <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
          campaign.status === 'active' 
            ? 'bg-green-100 text-green-700' 
            : 'bg-gray-100 text-gray-700'
        }`}>
          {campaign.status === 'active' ? 'Ativa' : 'Pausada'}
        </span>
      </div>
      
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-3">
        <div>
          <p className="text-xs text-gray-500 mb-1">Leads</p>
          <p className="text-lg font-bold text-gray-900">{campaign.total_leads}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Aceitos</p>
          <p className="text-lg font-bold text-green-600">{campaign.accepted}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 mb-1">Qualificados</p>
          <p className="text-lg font-bold text-purple-600">{campaign.qualified}</p>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between text-xs mb-1">
          <span className="text-gray-500">Progresso da campanha</span>
          <span className="font-semibold text-gray-900">{progress}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-purple-600 h-2 rounded-full transition-all duration-300" 
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2 text-xs text-gray-500">
          <Bot className="w-4 h-4" />
          <span>Agente: {campaign.ai_agent_name || 'Sem agente'}</span>
        </div>
        <button className="text-purple-600 hover:text-purple-700 text-sm font-semibold">
          Ver detalhes →
        </button>
      </div>
    </div>
  );
};

export default CampaignCard;