import React from 'react';
import { Trophy } from 'lucide-react';

const CampaignRanking = ({ campaigns = [] }) => {
  if (campaigns.length === 0) {
    return (
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">Top Campanhas</h3>
            <p className="text-sm text-gray-500">Por taxa de conversão</p>
          </div>
          <div className="p-2 rounded-lg bg-amber-50">
            <Trophy className="w-5 h-5 text-amber-600" />
          </div>
        </div>
        <div className="h-48 flex items-center justify-center text-gray-400 text-sm">
          Sem campanhas no período
        </div>
      </div>
    );
  }

  // Calculate conversion rate: Total Leads → Accepted
  const rankedCampaigns = campaigns
    .map(campaign => {
      const totalLeads = parseInt(campaign.total_leads) || 0;
      const accepted = parseInt(campaign.accepted) || 0;

      // Conversion rate: accepted / total leads
      const rate = totalLeads > 0 ? (accepted / totalLeads) * 100 : 0;

      return {
        ...campaign,
        conversionRate: rate
      };
    })
    .sort((a, b) => b.conversionRate - a.conversionRate)
    .slice(0, 5);

  const maxRate = Math.max(...rankedCampaigns.map(c => c.conversionRate), 1);

  const getRankColor = (index) => {
    const colors = [
      'bg-amber-500',
      'bg-gray-400',
      'bg-amber-700',
      'bg-gray-300',
      'bg-gray-300'
    ];
    return colors[index] || 'bg-gray-300';
  };

  return (
    <div className="bg-white rounded-xl p-6 border border-gray-200">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold text-gray-900">Top Campanhas</h3>
          <p className="text-sm text-gray-500">Taxa de aceitação (leads → aceitos)</p>
        </div>
        <div className="p-2 rounded-lg bg-amber-50">
          <Trophy className="w-5 h-5 text-amber-600" />
        </div>
      </div>

      <div className="space-y-4">
        {rankedCampaigns.map((campaign, index) => {
          const barWidth = (campaign.conversionRate / maxRate) * 100;

          return (
            <div key={campaign.id || index}>
              <div className="flex items-center gap-3 mb-1.5">
                <div className={`w-5 h-5 rounded-full ${getRankColor(index)} flex items-center justify-center`}>
                  <span className="text-xs font-bold text-white">{index + 1}</span>
                </div>
                <span className="text-sm font-medium text-gray-700 truncate flex-1">
                  {campaign.name}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  {campaign.conversionRate.toFixed(0)}%
                </span>
              </div>
              <div className="ml-8">
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-violet-500 rounded-full transition-all duration-500"
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <div className="flex justify-between mt-1 text-xs text-gray-400">
                  <span>{campaign.total_leads || 0} leads</span>
                  <span>{campaign.accepted || 0} aceitos</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CampaignRanking;
