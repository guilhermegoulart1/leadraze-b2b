import React, { useEffect, useState } from 'react';
import { Users, UserPlus, CheckCircle, MessageCircle } from 'lucide-react';
import StatCard from '../components/StatCard';
import CampaignCard from '../components/CampaignCard';
import api from '../services/api';

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);

  useEffect(() => {
    loadDashboard();
  }, []);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.getDashboard(30);
      
      if (response.success) {
        setDashboardData(response.data);
      }
    } catch (error) {
      console.error('Erro ao carregar dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  const data = dashboardData || {
    totals: {
      leads: 1847,
      qualified_leads: 87,
      conversations: 45,
      campaigns: 8
    },
    pipeline: {
      leads: 890,
      invite_sent: 412,
      accepted: 523,
      qualifying: 156,
      qualified: 87,
      discarded: 0
    },
    conversion_rates: {
      invitation_to_acceptance: 28.3,
      acceptance_to_qualified: 16.6
    }
  };

  return (
    <div className="p-6">
      
      {/* Page Title */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
        <p className="text-gray-500 mt-1">Visão geral da sua operação de vendas</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Total de Leads"
          value={data.totals.leads.toLocaleString()}
          subtitle="+156 esta semana"
          icon={Users}
          iconColor="purple"
          trend="up"
          trendValue="+12%"
        />
        
        <StatCard
          title="Convites Aceitos"
          value={data.pipeline.accepted}
          subtitle={`Taxa: ${data.conversion_rates.invitation_to_acceptance}%`}
          icon={UserPlus}
          iconColor="blue"
          trend="up"
          trendValue="+8%"
        />
        
        <StatCard
          title="Leads Qualificados"
          value={data.totals.qualified_leads}
          subtitle={`${data.conversion_rates.acceptance_to_qualified}% dos aceitos`}
          icon={CheckCircle}
          iconColor="green"
          trend="up"
          trendValue="+15%"
        />
        
        <StatCard
          title="Conversas Ativas"
          value={data.totals.conversations}
          subtitle="IA respondendo 24/7"
          icon={MessageCircle}
          iconColor="yellow"
        />
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        
        {/* Conversion Funnel */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Funil de Conversão</h3>
          <div className="space-y-3">
            {[
              { label: 'Leads', count: data.pipeline.leads, color: 'gray', percent: 100 },
              { label: 'Convites Enviados', count: data.pipeline.invite_sent, color: 'blue', percent: 67 },
              { label: 'Convites Aceitos', count: data.pipeline.accepted, color: 'yellow', percent: 28 },
              { label: 'Qualificando', count: data.pipeline.qualifying, color: 'purple', percent: 30 },
              { label: 'Qualificados', count: data.pipeline.qualified, color: 'green', percent: 56 },
            ].map((stage, index) => (
              <div key={index}>
                <div className="flex items-center justify-between text-sm mb-2">
                  <div className="flex items-center space-x-2">
                    <div className={`w-3 h-3 bg-${stage.color}-500 rounded-full`}></div>
                    <span className="font-medium text-gray-700">{stage.label}</span>
                  </div>
                  <span className="font-bold text-gray-900">{stage.count}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-8 relative overflow-hidden">
                  <div 
                    className={`absolute inset-0 bg-gradient-to-r from-${stage.color}-400 to-${stage.color}-600 rounded-full transition-all duration-500`}
                    style={{ width: `${stage.percent}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Performance Chart Placeholder */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Performance Semanal</h3>
          <div className="flex items-center justify-center h-64 text-gray-400">
            <p>Gráfico de performance - Integrar Recharts</p>
          </div>
        </div>
      </div>

      {/* Bottom Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Active Campaigns */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Campanhas Ativas</h3>
            <button className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-800 text-white rounded-lg hover:opacity-90 text-sm font-semibold">
              + Nova Campanha
            </button>
          </div>

          <div className="space-y-4">
            {/* Example Campaign Cards */}
            <CampaignCard 
              campaign={{
                name: 'Campanha SaaS - Tech Leaders',
                days_ago: 5,
                linkedin_username: 'João Silva',
                status: 'active',
                total_leads: 234,
                accepted: 89,
                qualified: 23,
                ai_agent_name: 'Vendedor B2B Pro'
              }}
            />
            
            <CampaignCard 
              campaign={{
                name: 'Campanha Healthcare - Decision Makers',
                days_ago: 12,
                linkedin_username: 'Maria Costa',
                status: 'active',
                total_leads: 189,
                accepted: 67,
                qualified: 18,
                ai_agent_name: 'Healthcare Specialist'
              }}
            />
          </div>
        </div>

        {/* Lead Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Distribuição de Leads</h3>
          
          {/* Donut Chart Placeholder */}
          <div className="flex items-center justify-center mb-6">
            <div className="relative w-48 h-48 flex items-center justify-center border-8 border-gray-200 rounded-full">
              <div className="text-center">
                <div className="text-3xl font-bold text-gray-900">{data.totals.leads}</div>
                <div className="text-sm text-gray-500">Total</div>
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="space-y-3">
            {[
              { label: 'Leads', count: data.pipeline.leads, percent: 48, color: 'gray' },
              { label: 'Convite Enviado', count: data.pipeline.invite_sent, percent: 22, color: 'blue' },
              { label: 'Qualificando', count: data.pipeline.qualifying, percent: 8, color: 'yellow' },
              { label: 'Qualificado', count: data.pipeline.qualified, percent: 5, color: 'green' },
            ].map((item, index) => (
              <div key={index} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className={`w-4 h-4 bg-${item.color}-500 rounded`}></div>
                  <span className="text-sm text-gray-700">{item.label}</span>
                </div>
                <span className="text-sm font-bold text-gray-900">
                  {item.count} ({item.percent}%)
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
};

export default Dashboard;