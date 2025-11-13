import React, { useState, useEffect } from 'react';
import { TrendingUp, TrendingDown, Users, Target, MessageCircle, CheckCircle } from 'lucide-react';
import api from '../services/api';

const AnalyticsPage = () => {
  const [period, setPeriod] = useState(30);
  const [dashboardData, setDashboardData] = useState(null);
  const [linkedinPerformance, setLinkedinPerformance] = useState(null);
  const [aiPerformance, setAiPerformance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadAnalytics();
  }, [period]);

  const loadAnalytics = async () => {
    try {
      setLoading(true);
      
      const [dashboard, linkedin, ai] = await Promise.all([
        api.getDashboard(period),
        api.getLinkedInPerformance(),
        api.getAIAgentsPerformance()
      ]);

      if (dashboard.success) setDashboardData(dashboard.data);
      if (linkedin.success) setLinkedinPerformance(linkedin.data);
      if (ai.success) setAiPerformance(ai.data);
      
    } catch (error) {
      console.error('Erro ao carregar analytics:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando analytics...</p>
        </div>
      </div>
    );
  }

  const data = dashboardData || {};

  return (
    <div className="p-6">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Analytics & Relatórios</h2>
          <p className="text-gray-500 mt-1">Análise detalhada de performance</p>
        </div>
        
        {/* Period Selector */}
        <div className="flex items-center space-x-2">
          {[7, 30, 90].map((days) => (
            <button
              key={days}
              onClick={() => setPeriod(days)}
              className={`px-4 py-2 rounded-lg font-semibold transition-colors ${
                period === days
                  ? 'bg-purple-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {days} dias
            </button>
          ))}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <span className="text-green-600 text-sm font-semibold flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              +12%
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {data.totals?.leads || 0}
          </h3>
          <p className="text-gray-500 text-sm">Total de Leads</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <CheckCircle className="w-6 h-6 text-green-600" />
            </div>
            <span className="text-green-600 text-sm font-semibold flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              +8%
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {data.pipeline?.accepted || 0}
          </h3>
          <p className="text-gray-500 text-sm">Convites Aceitos</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <Target className="w-6 h-6 text-purple-600" />
            </div>
            <span className="text-green-600 text-sm font-semibold flex items-center">
              <TrendingUp className="w-4 h-4 mr-1" />
              +15%
            </span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {data.totals?.qualified_leads || 0}
          </h3>
          <p className="text-gray-500 text-sm">Leads Qualificados</p>
        </div>

        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-yellow-100 rounded-lg">
              <MessageCircle className="w-6 h-6 text-yellow-600" />
            </div>
            <span className="text-green-600 text-sm font-semibold">94%</span>
          </div>
          <h3 className="text-3xl font-bold text-gray-900 mb-1">
            {data.totals?.conversations || 0}
          </h3>
          <p className="text-gray-500 text-sm">Conversas Ativas</p>
        </div>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Conversion Rates */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Taxas de Conversão</h3>
          
          <div className="space-y-6">
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Aceitação de Convites</span>
                <span className="text-lg font-bold text-purple-600">
                  {data.conversion_rates?.invitation_to_acceptance || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-purple-400 to-purple-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${data.conversion_rates?.invitation_to_acceptance || 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Taxa de Qualificação</span>
                <span className="text-lg font-bold text-green-600">
                  {data.conversion_rates?.acceptance_to_qualified || 0}%
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-green-400 to-green-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${data.conversion_rates?.acceptance_to_qualified || 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-700">Taxa de Resposta IA</span>
                <span className="text-lg font-bold text-blue-600">94%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div 
                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-500"
                  style={{ width: '94%' }}
                />
              </div>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-gray-200">
            <div className="grid grid-cols-2 gap-4">
              <div className="text-center">
                <p className="text-2xl font-bold text-gray-900">2.3min</p>
                <p className="text-xs text-gray-500 mt-1">Tempo Médio de Resposta</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-green-600">127</p>
                <p className="text-xs text-gray-500 mt-1">Conversas IA Hoje</p>
              </div>
            </div>
          </div>
        </div>

        {/* Top Campaigns */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Top Campanhas</h3>
          
          <div className="space-y-4">
            {data.top_campaigns?.slice(0, 5).map((campaign, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center text-white font-bold">
                    #{index + 1}
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{campaign.name}</p>
                    <p className="text-xs text-gray-500">
                      {campaign.total_leads} leads • {campaign.qualified_leads} qualificados
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-lg font-bold text-purple-600">
                    {campaign.sent > 0 
                      ? ((campaign.accepted / campaign.sent) * 100).toFixed(1)
                      : 0}%
                  </p>
                  <p className="text-xs text-gray-500">Taxa</p>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>

      {/* LinkedIn Accounts Performance */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 mb-8">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Performance das Contas LinkedIn</h3>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Conta
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Campanhas
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Enviados
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Aceitos
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Taxa
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase">
                  Limite Diário
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {linkedinPerformance?.accounts?.map((account, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-semibold text-gray-900">{account.profile_name}</p>
                      <p className="text-xs text-gray-500">@{account.linkedin_username}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-gray-900">{account.campaigns_count}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-blue-600">{account.sent}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-green-600">{account.accepted}</span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-purple-600">{account.acceptance_rate}%</span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center space-x-2">
                      <div className="flex-1">
                        <div className="w-20 bg-gray-200 rounded-full h-2">
                          <div 
                            className="bg-purple-600 h-2 rounded-full"
                            style={{ width: `${account.daily_usage}%` }}
                          />
                        </div>
                      </div>
                      <span className="text-xs text-gray-600">
                        {account.today_sent}/{account.daily_limit}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* AI Agents Performance */}
      <div className="bg-white rounded-xl p-6 border border-gray-200">
        <h3 className="text-lg font-bold text-gray-900 mb-6">Performance dos Agentes de IA</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {aiPerformance?.agents?.map((agent, index) => (
            <div key={index} className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-colors">
              <div className="flex items-center space-x-3 mb-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-600 to-purple-800 rounded-lg flex items-center justify-center text-white">
                  🤖
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{agent.name}</p>
                  <p className="text-xs text-gray-500 capitalize">{agent.personality_tone}</p>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-gray-500">Conversas</p>
                  <p className="text-lg font-bold text-gray-900">{agent.conversations_count}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Mensagens</p>
                  <p className="text-lg font-bold text-purple-600">{agent.messages_sent}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Qualificados</p>
                  <p className="text-lg font-bold text-green-600">{agent.leads_qualified}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500">Taxa</p>
                  <p className="text-lg font-bold text-blue-600">{agent.qualification_rate}%</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};

export default AnalyticsPage;