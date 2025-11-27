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
import { useTranslation } from 'react-i18next';
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
  const { t } = useTranslation('dashboard');
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
      console.error(t('errors.loadFailed'), error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#7229f7] mx-auto mb-4"></div>
          <p className="text-gray-600">{t('common:messages.loading')}</p>
        </div>
      </div>
    );
  }

  // Dados reais da API
  const data = dashboardData || {};
  const totals = data.totals || {};
  const pipeline = data.pipeline || {};
  const conversionRates = data.conversion_rates || {};
  const conversationMetrics = data.conversation_metrics || {};
  const topCampaignsData = data.top_campaigns || [];
  const mostEngagedLeadsData = data.most_engaged_leads || [];
  const performanceOverTime = data.performance_over_time || [];

  // Formatadores de dados para os componentes
  const formatPerformanceData = () => {
    if (!performanceOverTime.length) return [];
    return performanceOverTime.map(item => ({
      date: new Date(item.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }),
      leads: parseInt(item.leads) || 0,
      qualified: parseInt(item.qualified) || 0,
      conversations: parseInt(item.conversations) || 0
    }));
  };

  const formatTopCampaigns = () => {
    return topCampaignsData.map(campaign => {
      const convRate = campaign.total_leads > 0
        ? ((campaign.qualified_leads / campaign.total_leads) * 100).toFixed(0)
        : 0;
      return {
        name: campaign.name,
        value: parseInt(campaign.qualified_leads) || 0,
        subtitle: t('mockData.leadsConversion', {
          leads: campaign.total_leads || 0,
          rate: convRate
        }),
        trend: 0
      };
    });
  };

  const formatEngagedLeads = () => {
    return mostEngagedLeadsData.map(lead => ({
      name: lead.name || 'Lead',
      value: parseInt(lead.message_count) || 0,
      subtitle: `${lead.title || ''} • ${t('mockData.responded', { count: lead.lead_responses || 0 })}`
    }));
  };

  // Construir distribuição de status a partir do pipeline
  const leadStatusDistribution = [
    { name: t('leadStatus.new'), value: pipeline.leads || 0 },
    { name: t('leadStatus.contacted'), value: pipeline.invite_sent || 0 },
    { name: t('leadStatus.inConversation'), value: pipeline.accepted || 0 },
    { name: t('leadStatus.qualifying'), value: pipeline.qualifying || 0 },
    { name: t('leadStatus.qualified'), value: pipeline.qualified || 0 },
    { name: t('leadStatus.lost'), value: pipeline.discarded || 0 }
  ];

  // Dados derivados
  const invitesSent = totals.invite_sent || 0;
  const accepted = totals.accepted || 0;
  const qualified = totals.qualified_leads || 0;
  const totalLeads = totals.leads || 0;
  const conversations = totals.conversations || 0;

  // Calcular taxas de conversão
  const acceptanceRate = invitesSent > 0 ? ((accepted / invitesSent) * 100).toFixed(1) : 0;
  const qualificationRate = accepted > 0 ? ((qualified / accepted) * 100).toFixed(1) : 0;
  const overallConversionRate = conversionRates.acceptance_to_qualified || 0;

  // Funnel para o gráfico
  const funnelData = {
    leads: totalLeads,
    invites_sent: invitesSent,
    accepted: accepted,
    qualifying: pipeline.qualifying || 0,
    qualified: qualified
  };

  return (
    <div className="p-6 bg-[#fcfcfc] min-h-screen">
      {/* Main Metrics Grid - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <StatCard
          title={t('metrics.totalLeads')}
          value={totalLeads.toLocaleString()}
          subtitle={t('periods.last30Days')}
          icon={Users}
          iconColor="purple"
        />

        <StatCard
          title={t('metrics.invitesAccepted')}
          value={accepted.toLocaleString()}
          subtitle={`${acceptanceRate}% ${t('metrics.acceptanceRate')}`}
          icon={UserPlus}
          iconColor="blue"
        />

        <StatCard
          title={t('metrics.qualifiedLeads')}
          value={qualified}
          subtitle={`${qualificationRate}% ${t('metrics.ofAccepted')}`}
          icon={CheckCircle}
          iconColor="green"
        />

        <StatCard
          title={t('metrics.activeConversations')}
          value={conversations}
          subtitle={t('metrics.aiResponding247')}
          icon={MessageCircle}
          iconColor="yellow"
        />
      </div>

      {/* Secondary Metrics - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard
          title={t('metrics.responseRate')}
          value={overallConversionRate}
          suffix="%"
          icon={TrendingUp}
          subtitle={t('metrics.leadsRespondingToMessages')}
        />

        <MetricCard
          title={t('metrics.avgResponseTime')}
          value="-"
          icon={Clock}
          subtitle={t('metrics.timeToFirstResponse')}
        />

        <MetricCard
          title={t('metrics.overallConversionRate')}
          value={overallConversionRate}
          suffix="%"
          icon={Target}
          subtitle={t('metrics.leadsToQualified')}
        />

        <MetricCard
          title={t('metrics.invitesSent')}
          value={invitesSent.toLocaleString()}
          icon={Mail}
          subtitle={t('metrics.linkedinRequests')}
        />
      </div>

      {/* Main Charts Row - Funnel + Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Sales Funnel */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('charts.conversionFunnel')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('charts.fullSalesPipeline')}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <BarChart3 className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <FunnelChart data={funnelData} />
        </div>

        {/* Performance Over Time */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('charts.performanceOverTime')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('periods.last30Days')}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <TrendingUp className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <PerformanceChart data={formatPerformanceData()} type="area" />
        </div>
      </div>

      {/* Distribution Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Lead Status Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">{t('charts.statusDistribution')}</h3>
          <DonutChart
            data={leadStatusDistribution}
            colors={['#7229f7', '#894cf8', '#a06ff9', '#b793fa', '#d4c5fc', '#e8e0fd']}
          />
        </div>

        {/* Conversations by Status */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">{t('charts.conversationsByStatus')}</h3>
          <DonutChart
            data={[
              { name: 'Hot', value: data.conversations_by_status?.hot || 0 },
              { name: 'Warm', value: data.conversations_by_status?.warm || 0 },
              { name: 'Cold', value: data.conversations_by_status?.cold || 0 }
            ]}
            colors={['#ef4444', '#f59e0b', '#3b82f6']}
          />
        </div>
      </div>

      {/* Campaign Performance + AI Metrics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Top Campaigns */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h3 className="text-lg font-bold text-gray-900">{t('campaigns.topCampaigns')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('campaigns.bestPerformers')}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <Award className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          {formatTopCampaigns().length > 0 ? (
            <TopListCard
              title=""
              items={formatTopCampaigns()}
              valueFormatter={(v) => `${v} ${t('campaigns.qualified')}`}
              showTrend={false}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('common:messages.noData')}
            </div>
          )}
        </div>

        {/* AI Metrics */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">{t('charts.aiMetrics')}</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50">
              <span className="text-sm text-gray-600">{t('ai.activeConversations')}</span>
              <span className="text-lg font-bold text-[#7229f7]">
                {data.ai_metrics?.ai_active || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{t('ai.manualControl')}</span>
              <span className="text-lg font-bold text-gray-900">
                {data.ai_metrics?.manual_control || 0}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{t('ai.agentsInUse')}</span>
              <span className="text-lg font-bold text-gray-900">
                {data.ai_metrics?.agents_in_use || 0}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Conversation Analytics Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Conversation Stats */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">{t('conversations.metrics')}</h3>
            <div className="p-2 rounded-lg bg-purple-50">
              <MessageCircle className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{t('conversations.totalMessages')}</span>
              <span className="text-lg font-bold text-gray-900">
                {(conversationMetrics.total_messages || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50">
              <span className="text-sm text-gray-600">{t('conversations.aiMessages')}</span>
              <span className="text-lg font-bold text-[#7229f7]">
                {(conversationMetrics.ai_messages || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{t('conversations.leadMessages')}</span>
              <span className="text-lg font-bold text-gray-900">
                {(conversationMetrics.lead_messages || 0).toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{t('conversations.avgPerLead')}</span>
              <span className="text-lg font-bold text-gray-900">
                {conversationMetrics.avg_messages_per_lead || 0} {t('conversations.msgs')}
              </span>
            </div>
          </div>
        </div>

        {/* Most Engaged Leads */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold text-gray-900">{t('conversations.mostEngaged')}</h3>
            <div className="p-2 rounded-lg bg-purple-50">
              <Zap className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          {formatEngagedLeads().length > 0 ? (
            <TopListCard
              title=""
              items={formatEngagedLeads()}
              valueFormatter={(v) => `${v} ${t('conversations.msgs')}`}
            />
          ) : (
            <div className="text-center py-8 text-gray-500">
              {t('common:messages.noData')}
            </div>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-lg font-bold text-gray-900">{t('summary.title')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('periods.last30Days')}</p>
          </div>
          <div className="p-2 rounded-lg bg-purple-50">
            <Calendar className="w-5 h-5 text-[#7229f7]" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-3xl font-bold text-[#7229f7]">{totals.campaigns || 0}</p>
            <p className="text-sm text-gray-600 mt-1">{t('summary.totalCampaigns')}</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">{totals.active_campaigns || 0}</p>
            <p className="text-sm text-gray-600 mt-1">{t('summary.activeCampaigns')}</p>
          </div>
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-blue-600">{totals.linkedin_accounts || 0}</p>
            <p className="text-sm text-gray-600 mt-1">{t('summary.linkedinAccounts')}</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">{totals.ai_conversations || 0}</p>
            <p className="text-sm text-gray-600 mt-1">{t('summary.aiConversations')}</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
