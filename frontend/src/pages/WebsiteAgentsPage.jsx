import React, { useState, useEffect } from 'react';
import {
  Bot, MessageSquare, Book, BarChart3, Save, Plus, Trash2,
  Edit2, X, Check, Search, ChevronDown, Globe, Sparkles,
  MessageCircle, Users, Clock, TrendingUp, RefreshCw, Eye,
  Mail, UserPlus, Download, CheckCircle, PlayCircle, DollarSign
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import api from '../services/api';

const WebsiteAgentsPage = () => {
  const { t } = useTranslation('websiteAgents');
  const [activeTab, setActiveTab] = useState('agents');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data states
  const [agents, setAgents] = useState([]);
  const [selectedAgent, setSelectedAgent] = useState(null);
  const [knowledge, setKnowledge] = useState([]);
  const [conversations, setConversations] = useState([]);
  const [stats, setStats] = useState(null);
  const [leads, setLeads] = useState([]);
  const [leadStats, setLeadStats] = useState(null);

  // Modal states
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [editingKnowledge, setEditingKnowledge] = useState(null);
  const [showConversationModal, setShowConversationModal] = useState(false);
  const [selectedConversation, setSelectedConversation] = useState(null);

  // Filters
  const [knowledgeFilter, setKnowledgeFilter] = useState({ type: '', agent_key: '' });
  const [conversationFilter, setConversationFilter] = useState({ agent_key: '', escalated: '' });
  const [leadsFilter, setLeadsFilter] = useState({ status: '', source: '' });

  const tabs = [
    { id: 'agents', label: t('tabs.agents', 'Agents'), icon: Bot },
    { id: 'knowledge', label: t('tabs.knowledge', 'Knowledge Base'), icon: Book },
    { id: 'conversations', label: t('tabs.conversations', 'Conversations'), icon: MessageSquare },
    { id: 'leads', label: t('tabs.leads', 'Website Leads'), icon: Mail },
    { id: 'stats', label: t('tabs.stats', 'Statistics'), icon: BarChart3 },
  ];

  // Fetch agents
  const fetchAgents = async () => {
    try {
      const response = await api.getWebsiteAgents();
      if (response.success) {
        setAgents(response.data);
        if (response.data.length > 0 && !selectedAgent) {
          setSelectedAgent(response.data[0]);
        }
      }
    } catch (error) {
      console.error('Error fetching agents:', error);
    }
  };

  // Fetch knowledge
  const fetchKnowledge = async () => {
    try {
      const response = await api.getWebsiteKnowledge(knowledgeFilter);
      if (response.success) {
        setKnowledge(response.data);
      }
    } catch (error) {
      console.error('Error fetching knowledge:', error);
    }
  };

  // Fetch conversations
  const fetchConversations = async () => {
    try {
      const response = await api.getWebsiteConversations(conversationFilter);
      if (response.success) {
        setConversations(response.data);
      }
    } catch (error) {
      console.error('Error fetching conversations:', error);
    }
  };

  // Fetch stats
  const fetchStats = async () => {
    try {
      const response = await api.getWebsiteStats(30);
      if (response.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  // Fetch leads
  const fetchLeads = async () => {
    try {
      const response = await api.getWebsiteLeads(leadsFilter);
      if (response.success) {
        setLeads(response.data.leads || []);
      }
    } catch (error) {
      console.error('Error fetching leads:', error);
    }
  };

  // Fetch lead stats
  const fetchLeadStats = async () => {
    try {
      const response = await api.getWebsiteLeadStats();
      if (response.success) {
        setLeadStats(response.data);
      }
    } catch (error) {
      console.error('Error fetching lead stats:', error);
    }
  };

  // Export leads
  const exportLeads = async () => {
    try {
      const response = await api.exportWebsiteLeads(leadsFilter);
      if (response.success) {
        // Create CSV download
        const blob = new Blob([response.data.csv], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `website-leads-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error('Error exporting leads:', error);
    }
  };

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await Promise.all([fetchAgents(), fetchStats()]);
      setLoading(false);
    };
    loadData();
  }, []);

  // Load tab-specific data
  useEffect(() => {
    if (activeTab === 'knowledge') {
      fetchKnowledge();
    } else if (activeTab === 'conversations') {
      fetchConversations();
    } else if (activeTab === 'stats') {
      fetchStats();
    } else if (activeTab === 'leads') {
      fetchLeads();
      fetchLeadStats();
    }
  }, [activeTab, knowledgeFilter, conversationFilter, leadsFilter]);

  // Save agent
  const saveAgent = async () => {
    if (!selectedAgent) return;
    setSaving(true);
    try {
      const response = await api.updateWebsiteAgent(selectedAgent.agent_key, selectedAgent);
      if (response.success) {
        await fetchAgents();
      }
    } catch (error) {
      console.error('Error saving agent:', error);
    } finally {
      setSaving(false);
    }
  };

  // Save knowledge
  const saveKnowledge = async (data) => {
    try {
      if (editingKnowledge?.id) {
        await api.updateWebsiteKnowledge(editingKnowledge.id, data);
      } else {
        await api.addWebsiteKnowledge(data);
      }
      await fetchKnowledge();
      setShowKnowledgeModal(false);
      setEditingKnowledge(null);
    } catch (error) {
      console.error('Error saving knowledge:', error);
    }
  };

  // Delete knowledge
  const deleteKnowledge = async (id) => {
    if (!window.confirm(t('knowledge.confirmDelete', 'Are you sure you want to delete this item?'))) return;
    try {
      await api.deleteWebsiteKnowledge(id);
      await fetchKnowledge();
    } catch (error) {
      console.error('Error deleting knowledge:', error);
    }
  };

  // View conversation
  const viewConversation = async (id) => {
    try {
      const response = await api.getWebsiteConversation(id);
      if (response.success) {
        setSelectedConversation(response.data);
        setShowConversationModal(true);
      }
    } catch (error) {
      console.error('Error fetching conversation:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-screen">
        <RefreshCw className="w-8 h-8 animate-spin text-purple-600" />
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          {t('title', 'Website Agents')}
        </h2>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          {t('subtitle', 'Manage AI chatbots for your institutional website')}
        </p>
      </div>

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-64 flex-shrink-0">
          <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-2">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    w-full flex items-center space-x-3 px-4 py-3 rounded-lg transition-colors
                    ${activeTab === tab.id
                      ? 'bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1">
          {/* Agents Tab */}
          {activeTab === 'agents' && (
            <div className="space-y-6">
              {/* Agent Selector */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                <div className="flex gap-4">
                  {agents.map((agent) => (
                    <button
                      key={agent.agent_key}
                      onClick={() => setSelectedAgent(agent)}
                      className={`
                        flex-1 p-4 rounded-lg border-2 transition-all
                        ${selectedAgent?.agent_key === agent.agent_key
                          ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/30'
                          : 'border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500'
                        }
                      `}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`
                          w-12 h-12 rounded-full flex items-center justify-center
                          ${agent.agent_key === 'sales'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          }
                        `}>
                          {agent.agent_key === 'sales' ? <Sparkles className="w-6 h-6" /> : <MessageCircle className="w-6 h-6" />}
                        </div>
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-900 dark:text-gray-100">{agent.name}</h4>
                          <p className="text-sm text-gray-500 dark:text-gray-400 capitalize">{agent.agent_key}</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Agent Config */}
              {selectedAgent && (
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">
                    {t('agents.configure', 'Configure Agent')}: {selectedAgent.name}
                  </h3>

                  <div className="space-y-6">
                    {/* Basic Info */}
                    <div className="grid grid-cols-2 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('agents.name', 'Name')}
                        </label>
                        <input
                          type="text"
                          value={selectedAgent.name || ''}
                          onChange={(e) => setSelectedAgent({ ...selectedAgent, name: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        />
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('agents.avatarUrl', 'Avatar URL')}
                        </label>
                        <input
                          type="text"
                          value={selectedAgent.avatar_url || ''}
                          onChange={(e) => setSelectedAgent({ ...selectedAgent, avatar_url: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                          placeholder="https://..."
                        />
                      </div>
                    </div>

                    {/* Welcome Message */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('agents.welcomeMessage', 'Welcome Message')}
                      </label>
                      <textarea
                        value={selectedAgent.welcome_message || ''}
                        onChange={(e) => setSelectedAgent({ ...selectedAgent, welcome_message: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    {/* System Prompt */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('agents.systemPrompt', 'System Prompt')}
                      </label>
                      <textarea
                        value={selectedAgent.system_prompt || ''}
                        onChange={(e) => setSelectedAgent({ ...selectedAgent, system_prompt: e.target.value })}
                        rows={6}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent font-mono text-sm"
                      />
                    </div>

                    {/* Personality */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                        {t('agents.personality', 'Personality')}
                      </label>
                      <textarea
                        value={selectedAgent.personality || ''}
                        onChange={(e) => setSelectedAgent({ ...selectedAgent, personality: e.target.value })}
                        rows={3}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                      />
                    </div>

                    {/* Settings Row */}
                    <div className="grid grid-cols-3 gap-6">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('agents.tone', 'Tone')}
                        </label>
                        <select
                          value={selectedAgent.tone || 'professional'}
                          onChange={(e) => setSelectedAgent({ ...selectedAgent, tone: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="professional">Professional</option>
                          <option value="friendly">Friendly</option>
                          <option value="casual">Casual</option>
                          <option value="formal">Formal</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('agents.responseLength', 'Response Length')}
                        </label>
                        <select
                          value={selectedAgent.response_length || 'medium'}
                          onChange={(e) => setSelectedAgent({ ...selectedAgent, response_length: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="short">Short</option>
                          <option value="medium">Medium</option>
                          <option value="long">Long</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                          {t('agents.language', 'Language')}
                        </label>
                        <select
                          value={selectedAgent.language || 'en'}
                          onChange={(e) => setSelectedAgent({ ...selectedAgent, language: e.target.value })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                        >
                          <option value="en">English</option>
                          <option value="pt-br">Portuguese (BR)</option>
                          <option value="es">Spanish</option>
                        </select>
                      </div>
                    </div>

                    {/* Active Toggle */}
                    <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div>
                        <h4 className="font-medium text-gray-900 dark:text-gray-100">
                          {t('agents.active', 'Active')}
                        </h4>
                        <p className="text-sm text-gray-500 dark:text-gray-400">
                          {t('agents.activeDescription', 'Enable this agent on the website')}
                        </p>
                      </div>
                      <button
                        onClick={() => setSelectedAgent({ ...selectedAgent, is_active: !selectedAgent.is_active })}
                        className={`
                          relative inline-flex h-6 w-11 items-center rounded-full transition-colors
                          ${selectedAgent.is_active ? 'bg-purple-600' : 'bg-gray-300'}
                        `}
                      >
                        <span
                          className={`
                            inline-block h-4 w-4 transform rounded-full bg-white transition-transform
                            ${selectedAgent.is_active ? 'translate-x-6' : 'translate-x-1'}
                          `}
                        />
                      </button>
                    </div>

                    {/* Save Button */}
                    <div className="flex justify-end pt-4">
                      <button
                        onClick={saveAgent}
                        disabled={saving}
                        className="flex items-center gap-2 px-6 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold disabled:opacity-50"
                      >
                        {saving ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <Save className="w-4 h-4" />
                        )}
                        {t('agents.save', 'Save Changes')}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Knowledge Base Tab */}
          {activeTab === 'knowledge' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                  {t('knowledge.title', 'Knowledge Base')}
                </h3>
                <button
                  onClick={() => {
                    setEditingKnowledge(null);
                    setShowKnowledgeModal(true);
                  }}
                  className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold"
                >
                  <Plus className="w-4 h-4" />
                  {t('knowledge.add', 'Add Knowledge')}
                </button>
              </div>

              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <select
                  value={knowledgeFilter.type}
                  onChange={(e) => setKnowledgeFilter({ ...knowledgeFilter, type: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">{t('knowledge.allTypes', 'All Types')}</option>
                  <option value="faq">FAQ</option>
                  <option value="product">Product</option>
                  <option value="feature">Feature</option>
                  <option value="pricing">Pricing</option>
                  <option value="policy">Policy</option>
                </select>

                <select
                  value={knowledgeFilter.agent_key}
                  onChange={(e) => setKnowledgeFilter({ ...knowledgeFilter, agent_key: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">{t('knowledge.allAgents', 'All Agents')}</option>
                  <option value="sales">Sales</option>
                  <option value="support">Support</option>
                </select>
              </div>

              {/* Knowledge List */}
              <div className="space-y-3">
                {knowledge.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <Book className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('knowledge.empty', 'No knowledge items yet')}</p>
                  </div>
                ) : (
                  knowledge.map((item) => (
                    <div
                      key={item.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`
                              px-2 py-0.5 text-xs font-medium rounded-full
                              ${item.type === 'faq' ? 'bg-blue-100 text-blue-700' :
                                item.type === 'product' ? 'bg-green-100 text-green-700' :
                                item.type === 'pricing' ? 'bg-yellow-100 text-yellow-700' :
                                'bg-gray-100 text-gray-700'
                              }
                            `}>
                              {item.type}
                            </span>
                            {item.agent_key && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                                {item.agent_key}
                              </span>
                            )}
                            {item.category && (
                              <span className="text-xs text-gray-500">
                                {item.category}
                              </span>
                            )}
                          </div>
                          {item.type === 'faq' ? (
                            <>
                              <h4 className="font-medium text-gray-900 dark:text-gray-100">{item.question}</h4>
                              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1 line-clamp-2">{item.answer}</p>
                            </>
                          ) : (
                            <p className="text-gray-700 dark:text-gray-300 line-clamp-2">{item.content}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-4">
                          <button
                            onClick={() => {
                              setEditingKnowledge(item);
                              setShowKnowledgeModal(true);
                            }}
                            className="p-2 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteKnowledge(item.id)}
                            className="p-2 text-gray-500 dark:text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Conversations Tab */}
          {activeTab === 'conversations' && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-6">
                {t('conversations.title', 'Chat Conversations')}
              </h3>

              {/* Filters */}
              <div className="flex gap-4 mb-6">
                <select
                  value={conversationFilter.agent_key}
                  onChange={(e) => setConversationFilter({ ...conversationFilter, agent_key: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">{t('conversations.allAgents', 'All Agents')}</option>
                  <option value="sales">Sales</option>
                  <option value="support">Support</option>
                </select>

                <select
                  value={conversationFilter.escalated}
                  onChange={(e) => setConversationFilter({ ...conversationFilter, escalated: e.target.value })}
                  className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                >
                  <option value="">{t('conversations.allStatus', 'All Status')}</option>
                  <option value="true">{t('conversations.escalated', 'Escalated')}</option>
                  <option value="false">{t('conversations.notEscalated', 'Not Escalated')}</option>
                </select>

                <button
                  onClick={fetchConversations}
                  className="p-2 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                </button>
              </div>

              {/* Conversations List */}
              <div className="space-y-3">
                {conversations.length === 0 ? (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <MessageSquare className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p>{t('conversations.empty', 'No conversations yet')}</p>
                  </div>
                ) : (
                  conversations.map((conv) => (
                    <div
                      key={conv.id}
                      className="p-4 border border-gray-200 dark:border-gray-700 rounded-lg hover:border-gray-300 dark:hover:border-gray-600 transition-colors cursor-pointer"
                      onClick={() => viewConversation(conv.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`
                              px-2 py-0.5 text-xs font-medium rounded-full
                              ${conv.agent_key === 'sales'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-blue-100 text-blue-700'
                              }
                            `}>
                              {conv.agent_key}
                            </span>
                            {conv.escalated && (
                              <span className="px-2 py-0.5 text-xs font-medium bg-orange-100 text-orange-700 rounded-full">
                                {t('conversations.escalatedBadge', 'Escalated')}
                              </span>
                            )}
                            <span className="text-xs text-gray-500">
                              {conv.message_count} messages
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            Session: {conv.session_id?.slice(0, 20)}...
                          </p>
                          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                            {new Date(conv.started_at).toLocaleString()}
                          </p>
                        </div>
                        <Eye className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* Leads Tab */}
          {activeTab === 'leads' && (
            <div className="space-y-6">
              {/* Lead Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <Mail className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('leads.captured', 'Captured')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{leadStats?.total || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg">
                      <PlayCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('leads.trialStarted', 'Trial Started')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{leadStats?.trial_started || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('leads.subscribed', 'Subscribed')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{leadStats?.subscribed || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('leads.conversionRate', 'Conversion Rate')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                        {leadStats?.total > 0
                          ? ((leadStats?.subscribed / leadStats?.total) * 100).toFixed(1)
                          : 0}%
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Leads List */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                    {t('leads.title', 'Website Leads')}
                  </h3>
                  <button
                    onClick={exportLeads}
                    className="flex items-center gap-2 px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold text-sm"
                  >
                    <Download className="w-4 h-4" />
                    {t('leads.export', 'Export CSV')}
                  </button>
                </div>

                {/* Filters */}
                <div className="flex gap-4 mb-6">
                  <select
                    value={leadsFilter.status}
                    onChange={(e) => setLeadsFilter({ ...leadsFilter, status: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">{t('leads.allStatus', 'All Status')}</option>
                    <option value="captured">{t('leads.statusCaptured', 'Captured')}</option>
                    <option value="trial_started">{t('leads.statusTrial', 'Trial Started')}</option>
                    <option value="subscribed">{t('leads.statusSubscribed', 'Subscribed')}</option>
                    <option value="churned">{t('leads.statusChurned', 'Churned')}</option>
                  </select>

                  <select
                    value={leadsFilter.source}
                    onChange={(e) => setLeadsFilter({ ...leadsFilter, source: e.target.value })}
                    className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  >
                    <option value="">{t('leads.allSources', 'All Sources')}</option>
                    <option value="hero">Hero</option>
                    <option value="pricing">Pricing</option>
                    <option value="footer">Footer</option>
                  </select>

                  <button
                    onClick={fetchLeads}
                    className="p-2 text-gray-500 dark:text-gray-400 hover:text-purple-600 dark:hover:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-900/30 rounded-lg transition-colors"
                  >
                    <RefreshCw className="w-5 h-5" />
                  </button>
                </div>

                {/* Leads Table */}
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-200 dark:border-gray-700">
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('leads.email', 'Email')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('leads.status', 'Status')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('leads.source', 'Source')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('leads.date', 'Date')}</th>
                        <th className="text-left py-3 px-4 text-sm font-semibold text-gray-600 dark:text-gray-400">{t('leads.utmSource', 'UTM Source')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {leads.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="text-center py-12 text-gray-500 dark:text-gray-400">
                            <Mail className="w-12 h-12 mx-auto mb-3 opacity-50" />
                            <p>{t('leads.empty', 'No leads captured yet')}</p>
                          </td>
                        </tr>
                      ) : (
                        leads.map((lead) => (
                          <tr key={lead.id} className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50">
                            <td className="py-3 px-4">
                              <span className="font-medium text-gray-900 dark:text-gray-100">{lead.email}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className={`
                                px-2 py-1 text-xs font-medium rounded-full
                                ${lead.status === 'captured' ? 'bg-blue-100 text-blue-700' :
                                  lead.status === 'trial_started' ? 'bg-yellow-100 text-yellow-700' :
                                  lead.status === 'subscribed' ? 'bg-green-100 text-green-700' :
                                  'bg-gray-100 text-gray-700'
                                }
                              `}>
                                {lead.status === 'captured' ? t('leads.statusCaptured', 'Captured') :
                                 lead.status === 'trial_started' ? t('leads.statusTrial', 'Trial Started') :
                                 lead.status === 'subscribed' ? t('leads.statusSubscribed', 'Subscribed') :
                                 lead.status}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600 dark:text-gray-400 capitalize">{lead.source || '-'}</span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600 dark:text-gray-400">
                                {new Date(lead.created_at).toLocaleDateString()}
                              </span>
                            </td>
                            <td className="py-3 px-4">
                              <span className="text-sm text-gray-600 dark:text-gray-400">{lead.utm_source || '-'}</span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* Stats Tab */}
          {activeTab === 'stats' && (
            <div className="space-y-6">
              {/* Stats Cards */}
              <div className="grid grid-cols-4 gap-4">
                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-purple-100 dark:bg-purple-900/30 rounded-lg">
                      <MessageSquare className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('stats.totalConversations', 'Total Conversations')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.total_conversations || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/30 rounded-lg">
                      <MessageCircle className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('stats.totalMessages', 'Total Messages')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.total_messages || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-orange-100 dark:bg-orange-900/30 rounded-lg">
                      <Users className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('stats.escalated', 'Escalated')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.escalated || 0}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-green-100 dark:bg-green-900/30 rounded-lg">
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{t('stats.avgMessages', 'Avg Messages')}</p>
                      <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">{stats?.avg_messages_per_conversation?.toFixed(1) || 0}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Per Agent Stats */}
              <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
                <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-4">
                  {t('stats.byAgent', 'Statistics by Agent')}
                </h3>
                <div className="grid grid-cols-2 gap-6">
                  {stats?.by_agent?.map((agentStats) => (
                    <div key={agentStats.agent_key} className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <div className={`
                          w-8 h-8 rounded-full flex items-center justify-center
                          ${agentStats.agent_key === 'sales'
                            ? 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                            : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
                          }
                        `}>
                          {agentStats.agent_key === 'sales' ? <Sparkles className="w-4 h-4" /> : <MessageCircle className="w-4 h-4" />}
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-gray-100 capitalize">{agentStats.agent_key}</h4>
                      </div>
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Conversations</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{agentStats.conversations || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Messages</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{agentStats.messages || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Escalated</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{agentStats.escalated || 0}</p>
                        </div>
                        <div>
                          <p className="text-gray-500 dark:text-gray-400">Avg Length</p>
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{agentStats.avg_length?.toFixed(1) || 0}</p>
                        </div>
                      </div>
                    </div>
                  )) || (
                    <div className="col-span-2 text-center py-8 text-gray-500 dark:text-gray-400">
                      <BarChart3 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>{t('stats.noData', 'No statistics available yet')}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Knowledge Modal */}
      {showKnowledgeModal && (
        <KnowledgeModal
          knowledge={editingKnowledge}
          onSave={saveKnowledge}
          onClose={() => {
            setShowKnowledgeModal(false);
            setEditingKnowledge(null);
          }}
          t={t}
        />
      )}

      {/* Conversation Modal */}
      {showConversationModal && selectedConversation && (
        <ConversationModal
          conversation={selectedConversation}
          onClose={() => {
            setShowConversationModal(false);
            setSelectedConversation(null);
          }}
          t={t}
        />
      )}
    </div>
  );
};

// Knowledge Modal Component
const KnowledgeModal = ({ knowledge, onSave, onClose, t }) => {
  const [form, setForm] = useState({
    type: knowledge?.type || 'faq',
    agent_key: knowledge?.agent_key || '',
    category: knowledge?.category || '',
    question: knowledge?.question || '',
    answer: knowledge?.answer || '',
    content: knowledge?.content || '',
    metadata: knowledge?.metadata || {}
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {knowledge ? t('knowledge.edit', 'Edit Knowledge') : t('knowledge.add', 'Add Knowledge')}
            </h3>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('knowledge.type', 'Type')}
              </label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="faq">FAQ</option>
                <option value="product">Product</option>
                <option value="feature">Feature</option>
                <option value="pricing">Pricing</option>
                <option value="policy">Policy</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('knowledge.agentKey', 'Agent (optional)')}
              </label>
              <select
                value={form.agent_key}
                onChange={(e) => setForm({ ...form, agent_key: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="">{t('knowledge.shared', 'Shared (Both Agents)')}</option>
                <option value="sales">Sales Only</option>
                <option value="support">Support Only</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              {t('knowledge.category', 'Category')}
            </label>
            <input
              type="text"
              value={form.category}
              onChange={(e) => setForm({ ...form, category: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              placeholder={t('knowledge.categoryPlaceholder', 'e.g., Getting Started, Pricing, Features')}
            />
          </div>

          {form.type === 'faq' ? (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('knowledge.question', 'Question')}
                </label>
                <input
                  type="text"
                  value={form.question}
                  onChange={(e) => setForm({ ...form, question: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('knowledge.answer', 'Answer')}
                </label>
                <textarea
                  value={form.answer}
                  onChange={(e) => setForm({ ...form, answer: e.target.value })}
                  rows={4}
                  className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                  required
                />
              </div>
            </>
          ) : (
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                {t('knowledge.content', 'Content')}
              </label>
              <textarea
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={6}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>
          )}

          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 font-semibold"
            >
              {t('common.cancel', 'Cancel')}
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:opacity-90 font-semibold"
            >
              {t('common.save', 'Save')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Conversation Modal Component
const ConversationModal = ({ conversation, onClose, t }) => {
  const messages = typeof conversation.messages === 'string'
    ? JSON.parse(conversation.messages)
    : conversation.messages || [];

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-xl max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {t('conversations.view', 'Conversation Details')}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                {conversation.agent_key} - {new Date(conversation.started_at).toLocaleString()}
              </p>
            </div>
            <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
              <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`
                  max-w-[80%] p-3 rounded-lg
                  ${msg.role === 'user'
                    ? 'bg-purple-600 text-white'
                    : 'bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100'
                  }
                `}
              >
                <p className="text-sm">{msg.content}</p>
                {msg.timestamp && (
                  <p className={`text-xs mt-1 ${msg.role === 'user' ? 'text-purple-200' : 'text-gray-400 dark:text-gray-500'}`}>
                    {new Date(msg.timestamp).toLocaleTimeString()}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        {conversation.contact_form_data && (
          <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-orange-50 dark:bg-orange-900/30">
            <h4 className="font-semibold text-orange-800 dark:text-orange-300 mb-2">
              {t('conversations.contactForm', 'Contact Form Submitted')}
            </h4>
            <div className="text-sm text-orange-700 dark:text-orange-400 space-y-1">
              {(() => {
                const data = typeof conversation.contact_form_data === 'string'
                  ? JSON.parse(conversation.contact_form_data)
                  : conversation.contact_form_data;
                return (
                  <>
                    <p><strong>Name:</strong> {data.name}</p>
                    <p><strong>Email:</strong> {data.email}</p>
                    {data.company && <p><strong>Company:</strong> {data.company}</p>}
                    <p><strong>Message:</strong> {data.message}</p>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default WebsiteAgentsPage;
