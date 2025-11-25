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

  // Mock data - replace with real data later
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
      { date: t('periods.today'), leads: 523, qualified: 124, conversations: 89 }
    ],

    // Campaign performance
    topCampaigns: [
      { name: 'Tech Leaders Q4', value: 89, subtitle: t('mockData.leadsConversion', { leads: 234, rate: 38 }), trend: 12 },
      { name: 'Healthcare Decision Makers', value: 67, subtitle: t('mockData.leadsConversion', { leads: 189, rate: 35 }), trend: 8 },
      { name: 'Finance Executives', value: 45, subtitle: t('mockData.leadsConversion', { leads: 156, rate: 29 }), trend: -3 },
      { name: 'SaaS Founders', value: 33, subtitle: t('mockData.leadsConversion', { leads: 124, rate: 27 }), trend: 15 },
      { name: 'E-commerce Directors', value: 28, subtitle: t('mockData.leadsConversion', { leads: 98, rate: 29 }), trend: 5 }
    ],

    // Lead status distribution
    leadStatusDistribution: [
      { name: t('leadStatus.new'), value: 847 },
      { name: t('leadStatus.contacted'), value: 631 },
      { name: t('leadStatus.inConversation'), value: 412 },
      { name: t('leadStatus.qualifying'), value: 412 },
      { name: t('leadStatus.qualified'), value: 234 },
      { name: t('leadStatus.lost'), value: 311 }
    ],

    // Lead profile - Seniority
    leadBySeniority: [
      { name: t('seniority.cLevel'), value: 456 },
      { name: t('seniority.vpDirector'), value: 892 },
      { name: t('seniority.manager'), value: 1024 },
      { name: t('seniority.specialist'), value: 475 }
    ],

    // Lead profile - Industry
    leadByIndustry: [
      { name: t('industries.technology'), value: 1248 },
      { name: t('industries.healthcare'), value: 782 },
      { name: t('industries.finance'), value: 654 },
      { name: t('industries.ecommerce'), value: 523 },
      { name: t('industries.manufacturing'), value: 412 },
      { name: t('industries.others'), value: 228 }
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
      { name: 'Carlos Mendes', value: 24, subtitle: `Tech Leader • ${t('mockData.responded', { count: 12 })}` },
      { name: 'Ana Silva', value: 21, subtitle: `Healthcare Director • ${t('mockData.responded', { count: 10 })}` },
      { name: 'Roberto Santos', value: 18, subtitle: `Finance VP • ${t('mockData.responded', { count: 9 })}` },
      { name: 'Marina Costa', value: 16, subtitle: `E-commerce Manager • ${t('mockData.responded', { count: 8 })}` },
      { name: 'Felipe Rodrigues', value: 14, subtitle: `SaaS Founder • ${t('mockData.responded', { count: 7 })}` }
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
          title={t('metrics.totalLeads')}
          value={mockData.metrics.totalLeads.toLocaleString()}
          subtitle={t('periods.last30Days')}
          icon={Users}
          iconColor="purple"
          trend="up"
          trendValue={mockData.metrics.totalLeadsChange}
        />

        <StatCard
          title={t('metrics.invitesAccepted')}
          value={mockData.metrics.accepted.toLocaleString()}
          subtitle={`${((mockData.metrics.accepted / mockData.metrics.invitesSent) * 100).toFixed(1)}% ${t('metrics.acceptanceRate')}`}
          icon={UserPlus}
          iconColor="blue"
          trend="up"
          trendValue={mockData.metrics.acceptedChange}
        />

        <StatCard
          title={t('metrics.qualifiedLeads')}
          value={mockData.metrics.qualified}
          subtitle={`${((mockData.metrics.qualified / mockData.metrics.accepted) * 100).toFixed(1)}% ${t('metrics.ofAccepted')}`}
          icon={CheckCircle}
          iconColor="green"
          trend="up"
          trendValue={mockData.metrics.qualifiedChange}
        />

        <StatCard
          title={t('metrics.activeConversations')}
          value={mockData.metrics.activeConversations}
          subtitle={t('metrics.aiResponding247')}
          icon={MessageCircle}
          iconColor="yellow"
          trend="up"
          trendValue={mockData.metrics.conversationsChange}
        />
      </div>

      {/* Secondary Metrics - 4 columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
        <MetricCard
          title={t('metrics.responseRate')}
          value={mockData.metrics.responseRate}
          suffix="%"
          icon={TrendingUp}
          trend="up"
          trendValue={mockData.metrics.responseRateChange}
          subtitle={t('metrics.leadsRespondingToMessages')}
        />

        <MetricCard
          title={t('metrics.avgResponseTime')}
          value={mockData.metrics.avgResponseTime}
          icon={Clock}
          trend="up"
          trendValue={mockData.metrics.avgResponseTimeChange}
          subtitle={t('metrics.timeToFirstResponse')}
        />

        <MetricCard
          title={t('metrics.overallConversionRate')}
          value={mockData.metrics.conversionRate}
          suffix="%"
          icon={Target}
          trend="up"
          trendValue={mockData.metrics.conversionRateChange}
          subtitle={t('metrics.leadsToQualified')}
        />

        <MetricCard
          title={t('metrics.invitesSent')}
          value={mockData.metrics.invitesSent.toLocaleString()}
          icon={Mail}
          trend="up"
          trendValue={mockData.metrics.invitesSentChange}
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
          <FunnelChart data={mockData.funnel} />
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
          <PerformanceChart data={mockData.performanceData} type="area" />
        </div>
      </div>

      {/* Distribution Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Lead Status Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">{t('charts.statusDistribution')}</h3>
          <DonutChart
            data={mockData.leadStatusDistribution}
            colors={['#7229f7', '#894cf8', '#a06ff9', '#b793fa', '#d4c5fc', '#e8e0fd']}
          />
        </div>

        {/* Lead by Seniority */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">{t('charts.seniorityProfile')}</h3>
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
              <h3 className="text-lg font-bold text-gray-900">{t('campaigns.topCampaigns')}</h3>
              <p className="text-sm text-gray-500 mt-1">{t('campaigns.bestPerformers')}</p>
            </div>
            <div className="p-2 rounded-lg bg-purple-50">
              <Award className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <TopListCard
            title=""
            items={mockData.topCampaigns}
            valueFormatter={(v) => `${v} ${t('campaigns.qualified')}`}
            showTrend={true}
          />
        </div>

        {/* Lead by Industry */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">{t('charts.leadsByIndustry')}</h3>
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
            <h3 className="text-lg font-bold text-gray-900">{t('conversations.metrics')}</h3>
            <div className="p-2 rounded-lg bg-purple-50">
              <MessageCircle className="w-5 h-5 text-[#7229f7]" />
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{t('conversations.totalMessages')}</span>
              <span className="text-lg font-bold text-gray-900">
                {mockData.conversationMetrics.totalMessages.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-purple-50">
              <span className="text-sm text-gray-600">{t('conversations.aiMessages')}</span>
              <span className="text-lg font-bold text-[#7229f7]">
                {mockData.conversationMetrics.aiMessages.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{t('conversations.leadMessages')}</span>
              <span className="text-lg font-bold text-gray-900">
                {mockData.conversationMetrics.leadMessages.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-gray-50">
              <span className="text-sm text-gray-600">{t('conversations.avgPerLead')}</span>
              <span className="text-lg font-bold text-gray-900">
                {mockData.conversationMetrics.avgMessagesPerLead} {t('conversations.msgs')}
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
          <TopListCard
            title=""
            items={mockData.mostEngagedLeads}
            valueFormatter={(v) => `${v} ${t('conversations.msgs')}`}
          />
        </div>

        {/* Response Time Distribution */}
        <div className="bg-white rounded-xl p-6 border border-gray-200 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 mb-6">{t('charts.responseTime')}</h3>
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
            <h3 className="text-lg font-bold text-gray-900">{t('goals.monthly')}</h3>
            <p className="text-sm text-gray-500 mt-1">{t('goals.progressTowards')}</p>
          </div>
          <div className="p-2 rounded-lg bg-purple-50">
            <Calendar className="w-5 h-5 text-[#7229f7]" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <ProgressMetric
            label={t('goals.leadsGenerated')}
            current={mockData.monthlyGoals.leads.current}
            target={mockData.monthlyGoals.leads.target}
            color="#7229f7"
          />
          <ProgressMetric
            label={t('goals.qualifiedLeads')}
            current={mockData.monthlyGoals.qualified.current}
            target={mockData.monthlyGoals.qualified.target}
            color="#894cf8"
          />
          <ProgressMetric
            label={t('goals.activeConversations')}
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
