import React, { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { BarChart3, Map } from 'lucide-react';
import {
  DashboardFilters,
  RevenueChart,
  LeadsChart,
  LeadsBySourceChart,
  SalesFunnel,
  UserTasks,
  AIAgentInteractions,
  RoadmapsDashboard
} from '../components/dashboard';
import api from '../services/api';

const Dashboard = () => {
  const { t } = useTranslation('dashboard');
  const [activeTab, setActiveTab] = useState('overview');
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState(30);
  const [selectedCampaign, setSelectedCampaign] = useState(null);
  const [dashboardData, setDashboardData] = useState(null);
  const [campaigns, setCampaigns] = useState([]);
  const [pipelines, setPipelines] = useState([]);

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [period]);

  const loadInitialData = async () => {
    try {
      // Load pipelines for funnel selector
      const pipelinesRes = await api.getPipelines();
      if (pipelinesRes.success) {
        setPipelines(pipelinesRes.data?.pipelines || []);
      }
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  };

  const loadDashboard = async () => {
    try {
      setLoading(true);
      const response = await api.getDashboard(period);

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
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-violet-600 mx-auto mb-3"></div>
          <p className="text-gray-500 dark:text-gray-400 text-sm">{t('loading')}</p>
        </div>
      </div>
    );
  }

  const data = dashboardData || {};

  const tabs = [
    { id: 'overview', label: t('tabs.overview', 'Visão Geral'), icon: BarChart3 },
    { id: 'tasks', label: t('tabs.tasks', 'Tarefas'), icon: Map }
  ];

  return (
    <div className="p-6 bg-gray-50 dark:bg-gray-900 min-h-screen">
      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-white dark:bg-gray-800 rounded-xl p-1.5 shadow-sm border border-gray-200 dark:border-gray-700 w-fit">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                isActive
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <>
          {/* Filters */}
          <DashboardFilters
            period={period}
            onPeriodChange={setPeriod}
            campaigns={campaigns}
            selectedCampaign={selectedCampaign}
            onCampaignChange={setSelectedCampaign}
            onRefresh={loadDashboard}
            loading={loading}
          />

          {/* Section 1: Leads by Source + Leads per Day */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <LeadsBySourceChart data={data.leads_by_source || []} />
            <LeadsChart
              data={data.leads_per_day || []}
              total={data.leads_total || 0}
            />
          </div>

          {/* Section 2: Sales Funnel + Revenue */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
            <SalesFunnel pipelines={pipelines} />
            <RevenueChart
              data={data.revenue_per_day || []}
              total={data.revenue_total || 0}
            />
          </div>

          {/* Section 3: User Tasks + AI Agent Interactions */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <UserTasks tasks={data.user_tasks || {}} />
            <AIAgentInteractions agents={data.ai_agent_interactions || []} />
          </div>
        </>
      )}

      {/* Tasks Tab */}
      {activeTab === 'tasks' && <RoadmapsDashboard />}
    </div>
  );
};

export default Dashboard;
