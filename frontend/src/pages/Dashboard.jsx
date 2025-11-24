import React, { useEffect, useState } from 'react';
import {
  Users,
  UserPlus,
  CheckCircle,
  MessageCircle,
  TrendingUp,
  Target,
  Clock,
  Zap,
  Award,
  Calendar,
  Mail,
  BarChart3
} from 'lucide-react';
import StatCard from '../components/StatCard';
import MetricCard from '../components/MetricCard';
import TopListCard from '../components/TopListCard';
import ProgressMetric from '../components/ProgressMetric';
import FunnelChart from '../components/charts/FunnelChart';
import PerformanceChart from '../components/charts/PerformanceChart';
import DonutChart from '../components/charts/DonutChart';
import BarChart from '../components/charts/BarChart';
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7229f7] mx-auto mb-4"></div>
          <p className="text-gray-600">Carregando dashboard...</p>
        </div>
      </div>
    );
  }

  // Mock data - substituir com dados reais depois
  const mockData = {
    // Main metrics
    metrics: {
      totalLeads: 2847,
      totalLeadsChange: '+12%',
      invitesSent: 1523,
      invitesSentChange: '+8%',
      accepted: 892,
      acceptedChange: '+15%',
      qualified: 234,
      qualifiedChange: '+23%',
      activeConversations: 156,
      conversationsChange: '+18%',
      responseRate: 67.8,
      responseRateChange: '+5%',
      avgResponseTime: '2.3h',
      avgResponseTimeChange: '-12%',
      conversionRate: 26.2,
      conversionRateChange: '+8%'
    },

    // Funnel data
    funnel: {
      leads: 2847,
      invites_sent: 1523,
      accepted: 892,
      qualifying: 412,
      qualified: 234
    },

    // Performance over time
    performanceData: [
      { date: '01 Nov', leads: 180, qualified: 42, conversations: 28 },
      { date: '05 Nov', leads: 245, qualified: 58, conversations: 35 },
      { date: '10 Nov', leads: 320, qualified: 71, conversations: 48 },
      { date: '15 Nov', leads: 289, qualified: 65, conversations: 52 },
      { date: '20 Nov', leads: 412, qualified: 89, conversations: 67 },
      { date: '25 Nov', leads: 478, qualified: 103, conversations: 78 },
      { date: 'Hoje', leads: 523, qualified: 124, conversations: 89 }
    ],

    // Campaign performance
    topCampaigns: [
      { name: 'Tech Leaders Q4', value: 89, subtitle: '234 leads • 38% conversão', trend: 12 },
      { name: 'Healthcare Decision Makers', value: 67, subtitle: '189 leads • 35% conversão', trend: 8 },
      { name: 'Finance Executives', value: 45, subtitle: '156 leads • 29% conversão', trend: -3 },
      { name: 'SaaS Founders', value: 33, subtitle: '124 leads • 27% conversão', trend: 15 },
      { name: 'E-commerce Directors', value: 28, subtitle: '98 leads • 29% conversão', trend: 5 }
    ],

    // Lead status distribution
    leadStatusDistribution: [
      { name: 'Novo', value: 847 },
      { name: 'Contatado', value: 631 },
      { name: 'Em Conversa', value: 412 },
      { name: 'Qualificando', value: 412 },
      { name: 'Qualificado', value: 234 },
      { name: 'Perdido', value: 311 }
    ],

    // Lead profile - Seniority
    leadBySeniority: [
      { name: 'C-Level', value: 456 },
      { name: 'VP/Director', value: 892 },
      { name: 'Manager', value: 1024 },
      { name: 'Specialist', value: 475 }
    ],

    // Lead profile - Industry
    leadByIndustry: [
      { name: 'Technology', value: 1248 },
      { name: 'Healthcare', value: 782 },
      { name: 'Finance', value: 654 },
      { name: 'E-commerce', value: 523 },
      { name: 'Manufacturing', value: 412 },
      { name: 'Others', value: 228 }
    ],

    // Conversation metrics
    conversationMetrics: {
      totalMessages: 4523,
      aiMessages: 2847,
      leadMessages: 1676,
      avgMessagesPerLead: 5.2,
      avgResponseTime: '2h 18min',
      responseRate: 67.8
    },

    // Most engaged leads
    mostEngagedLeads: [
      { name: 'Carlos Mendes', value: 24, subtitle: 'Tech Leader • Respondeu 12x' },
      { name: 'Ana Silva', value: 21, subtitle: 'Healthcare Director • Respondeu 10x' },
      { name: 'Roberto Santos', value: 18, subtitle: 'Finance VP • Respondeu 9x' },
      { name: 'Marina Costa', value: 16, subtitle: 'E-commerce Manager • Respondeu 8x' },
      { name: 'Felipe Rodrigues', value: 14, subtitle: 'SaaS Founder • Respondeu 7x' }
    ],

    // Response time distribution
    responseTimeData: [
      { name: '< 1h', value: 234 },
      { name: '1-3h', value: 412 },
      { name: '3-6h', value: 289 },
      { name: '6-12h', value: 156 },
      { name: '12-24h', value: 89 },
      { name: '> 24h', value: 45 }
    ],

    // Monthly goals
    monthlyGoals: {
      leads: { current: 2847, target: 3000 },
      qualified: { current: 234, target: 300 },
      conversations: { current: 156, target: 200 }
    }
  };

  return (
    <div className="p-6 bg-[#fcfcfc] min-h-screen">
      {/* Main Metrics Grid - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          title="Total de Leads"
          value={mockData.metrics.totalLeads.toLocaleString()}
          subtitle="Últimos 30 dias"
          icon={Users}
          iconColor="purple"
          trend="up"
          trendValue={mockData.metrics.totalLeadsChange}
        />

        <StatCard
          title="Convites Aceitos"
          value={mockData.metrics.accepted.toLocaleString()}
          subtitle={`${((mockData.metrics.accepted / mockData.metrics.invitesSent) * 100).toFixed(1)}% taxa de aceitação`}
          icon={UserPlus}
          iconColor="blue"
          trend="up"
          trendValue={mockData.metrics.acceptedChange}
        />

        <StatCard
          title="Leads Qualificados"
          value={mockData.metrics.qualified}
          subtitle={`${((mockData.metrics.qualified / mockData.metrics.accepted) * 100).toFixed(1)}% dos aceitos`}
          icon={CheckCircle}
          iconColor="green"
          trend="up"
          trendValue={mockData.metrics.qualifiedChange}
        />

        <StatCard
          title="Conversas Ativas"
          value={mockData.metrics.activeConversations}
          subtitle="IA respondendo 24/7"
          icon={MessageCircle}
          iconColor="yellow"
          trend="up"
          trendValue={mockData.metrics.conversationsChange}
        />
      </div>

      {/* Secondary Metrics - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard
          title="Taxa de Resposta"
          value={mockData.metrics.responseRate}
          suffix="%"
          icon={TrendingUp}
          trend="up"
          trendValue={mockData.metrics.responseRateChange}
          subtitle="Leads que respondem às mensagens"
        />

        <MetricCard
          title="Tempo Médio de Resposta"
          value={mockData.metrics.avgResponseTime}
          icon={Clock}
          trend="up"
          trendValue={mockData.metrics.avgResponseTimeChange}
          subtitle="Tempo até primeira resposta"
        />

        <MetricCard
          title="Taxa de Conversão Geral"
          value={mockData.metrics.conversionRate}
          suffix="%"
          icon={Target}
          trend="up"
          trendValue={mockData.metrics.conversionRateChange}
          subtitle="Leads → Qualificados"
        />

        <MetricCard
          title="Convites Enviados"
          value={mockData.metrics.invitesSent.toLocaleString()}
          icon={Mail}
          trend="up"
          trendValue={mockData.metrics.invitesSentChange}
          subtitle="LinkedIn connection requests"
        />
      </div>

      {/* Main Charts Row - Funnel + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Funnel */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Funil de Conversão</h3>
              <p className="text-sm text-gray-500 mt-1">Pipeline completo de vendas</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <BarChart3 className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <FunnelChart data={mockData.funnel} />
        </div>

        {/* Performance Over Time */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Performance ao Longo do Tempo</h3>
              <p className="text-sm text-gray-500 mt-1">Últimos 30 dias</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <TrendingUp className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <PerformanceChart data={mockData.performanceData} type="area" />
        </div>
      </div>

      {/* Distribution Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Lead Status Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Distribuição por Status</h3>
          <DonutChart
            data={mockData.leadStatusDistribution}
            colors={['#7229f7', '#894cf8', '#a06ff9', '#b793fa', '#d4c5fc', '#e8e0fd']}
          />
        </div>

        {/* Lead by Seniority */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Perfil por Senioridade</h3>
          <DonutChart
            data={mockData.leadBySeniority}
            colors={['#7229f7', '#894cf8', '#a06ff9', '#b793fa']}
          />
        </div>
      </div>

      {/* Campaign Performance + Lead Industry */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Campaigns */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">Top Campanhas</h3>
              <p className="text-sm text-gray-500 mt-1">Melhores performers do mês</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <Award className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <TopListCard
            title=""
            items={mockData.topCampaigns}
            valueFormatter={(v) => `${v} qualificados`}
            showTrend={true}
          />
        </div>

        {/* Lead by Industry */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Leads por Indústria</h3>
          <BarChart
            data={mockData.leadByIndustry}
            dataKey="value"
            nameKey="name"
            color="#7229f7"
            showValues={true}
          />
        </div>
      </div>

      {/* Conversation Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
        {/* Conversation Stats */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Métricas de Conversação</h3>
            <div className="p-2 rounded-lg bg-purple-50">
              <MessageCircle className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">Total de Mensagens</span>
              <span className="text-lg font-bold text-gray-900">
                {mockData.conversationMetrics.totalMessages.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50">
              <span className="text-sm text-gray-600">Mensagens da IA</span>
              <span className="text-lg font-bold text-[#7229f7]">
                {mockData.conversationMetrics.aiMessages.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">Mensagens de Leads</span>
              <span className="text-lg font-bold text-gray-900">
                {mockData.conversationMetrics.leadMessages.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">Média por Lead</span>
              <span className="text-lg font-bold text-gray-900">
                {mockData.conversationMetrics.avgMessagesPerLead} msgs
              </span>
            </div>
          </div>
        </div>

        {/* Most Engaged Leads */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">Leads Mais Engajados</h3>
            <div className="p-2 rounded-lg bg-purple-50">
              <Zap className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <TopListCard
            title=""
            items={mockData.mostEngagedLeads}
            valueFormatter={(v) => `${v} msgs`}
          />
        </div>

        {/* Response Time Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">Tempo de Resposta</h3>
          <BarChart
            data={mockData.responseTimeData}
            dataKey="value"
            nameKey="name"
            color="#894cf8"
            showValues={true}
          />
        </div>
      </div>

      {/* Monthly Goals */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Metas do Mês</h3>
            <p className="text-sm text-gray-500 mt-1">Progresso em relação aos objetivos mensais</p>
          </div>
          <div className="p-2 rounded-lg bg-purple-50">
            <Calendar className="w-5 h-5 text-[#7229f7]" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProgressMetric
            label="Leads Gerados"
            current={mockData.monthlyGoals.leads.current}
            target={mockData.monthlyGoals.leads.target}
            color="#7229f7"
          />
          <ProgressMetric
            label="Leads Qualificados"
            current={mockData.monthlyGoals.qualified.current}
            target={mockData.monthlyGoals.qualified.target}
            color="#894cf8"
          />
          <ProgressMetric
            label="Conversas Ativas"
            current={mockData.monthlyGoals.conversations.current}
            target={mockData.monthlyGoals.conversations.target}
            color="#a06ff9"
          />
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
