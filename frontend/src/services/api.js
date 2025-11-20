// frontend/src/services/api.js

class ApiService {
  constructor() {
    this.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';
    this.token = localStorage.getItem('authToken');
  }

  setToken(token) {
    this.token = token;
    if (token) {
      localStorage.setItem('authToken', token);
    } else {
      localStorage.removeItem('authToken');
    }
  }

  getToken() {
    return this.token || localStorage.getItem('authToken');
  }

  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const token = this.getToken();

    const config = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    };

    try {
      const response = await fetch(url, config);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Erro na requisição');
      }

      return data;
    } catch (error) {
      console.error('API Error:', error);
      throw error;
    }
  }

  // ================================
  // AUTH
  // ================================
  
  async login(email, password) {
    const response = await this.request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    
    if (response.success) {
      this.setToken(response.data.token);
    }
    
    return response;
  }

  async register(userData) {
    const response = await this.request('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    
    if (response.success) {
      this.setToken(response.data.token);
    }
    
    return response;
  }

  async getProfile() {
    return this.request('/auth/profile');
  }

  logout() {
    this.setToken(null);
    localStorage.removeItem('user');
  }

  // ================================
  // CAMPAIGNS
  // ================================
  
  async getCampaigns(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(query ? `/campaigns?${query}` : '/campaigns');
  }

  async getCampaign(id) {
    return this.request(`/campaigns/${id}`);
  }

  async createCampaign(data) {
    return this.request('/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaign(id, data) {
    return this.request(`/campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteCampaign(id) {
    return this.request(`/campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  async startCampaign(id) {
    return this.request(`/campaigns/${id}/start`, {
      method: 'POST',
    });
  }

  async pauseCampaign(id) {
    return this.request(`/campaigns/${id}/pause`, {
      method: 'POST',
    });
  }

  async resumeCampaign(id) {
    return this.request(`/campaigns/${id}/resume`, {
      method: 'POST',
    });
  }

  async stopCampaign(id) {
    return this.request(`/campaigns/${id}/stop`, {
      method: 'POST',
    });
  }

  async getCampaignStats(id) {
    return this.request(`/campaigns/${id}/stats`);
  }

  async startCollection(id) {
    return this.request(`/campaigns/${id}/start-collection`, {
      method: 'POST',
    });
  }

  async getCollectionStatus(id) {
    return this.request(`/campaigns/${id}/collection-status`);
  }

  // Aliases para compatibilidade
  async startBulkCollection(id) {
    return this.startCollection(id);
  }

  async getBulkCollectionStatus(id) {
    return this.getCollectionStatus(id);
  }

  // ================================
  // LEADS
  // ================================
  
  async getLeads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/leads?${query}`);
  }

  async getLead(id) {
    return this.request(`/leads/${id}`);
  }

  async createLead(data) {
    return this.request('/leads', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createLeadsBulk(data) {
    return this.request('/leads/bulk', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLead(id, data) {
    return this.request(`/leads/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(id) {
    return this.request(`/leads/${id}`, {
      method: 'DELETE',
    });
  }

  async getCampaignLeads(campaignId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/leads/campaign/${campaignId}?${query}`);
  }

  async updateLeadStatus(leadId, status) {
    return this.request(`/leads/${leadId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // ================================
  // CONVERSATIONS
  // ================================
  
  async getConversations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/conversations?${query}`);
  }

  async getConversation(id) {
    return this.request(`/conversations/${id}`);
  }

  async getMessages(conversationId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/conversations/${conversationId}/messages${query ? `?${query}` : ''}`);
  }

  async sendMessage(conversationId, content) {
    return this.request(`/conversations/${conversationId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async takeControl(conversationId) {
    return this.request(`/conversations/${conversationId}/take-control`, {
      method: 'POST',
    });
  }

  async releaseControl(conversationId) {
    return this.request(`/conversations/${conversationId}/release-control`, {
      method: 'POST',
    });
  }

  async updateConversationStatus(conversationId, status) {
    return this.request(`/conversations/${conversationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async markAsRead(conversationId) {
    return this.request(`/conversations/${conversationId}/mark-read`, {
      method: 'POST',
    });
  }

  async closeConversation(conversationId) {
    return this.request(`/conversations/${conversationId}/close`, {
      method: 'POST',
    });
  }

  async reopenConversation(conversationId, status = 'ai_active') {
    return this.request(`/conversations/${conversationId}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  }

  async deleteConversation(conversationId) {
    return this.request(`/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  async getConversationStats() {
    return this.request('/conversations/stats');
  }

  // ================================
  // AI AGENTS
  // ================================
  
  async getAIAgents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/ai-agents?${query}`);
  }

  async getAIAgent(id) {
    return this.request(`/ai-agents/${id}`);
  }

  async createAIAgent(data) {
    return this.request('/ai-agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAIAgent(id, data) {
    return this.request(`/ai-agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAIAgent(id) {
    return this.request(`/ai-agents/${id}`, {
      method: 'DELETE',
    });
  }

  async testAIAgent(id, testMessage) {
    return this.request(`/ai-agents/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ test_message: testMessage }),
    });
  }

  async cloneAIAgent(id, newName) {
    return this.request(`/ai-agents/${id}/clone`, {
      method: 'POST',
      body: JSON.stringify({ new_name: newName }),
    });
  }

  async getAIAgentStats(id) {
    return this.request(`/ai-agents/${id}/stats`);
  }

  async testAIAgentInitialMessage(agentId, data) {
    return this.request(`/ai-agents/${agentId}/test/initial-message`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async testAIAgentResponse(agentId, data) {
    return this.request(`/ai-agents/${agentId}/test/response`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ================================
  // KNOWLEDGE BASE
  // ================================

  async getAgentKnowledge(agentId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/ai-agents/${agentId}/knowledge?${query}`);
  }

  async addAgentKnowledge(agentId, data) {
    return this.request(`/ai-agents/${agentId}/knowledge`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addAgentKnowledgeBatch(agentId, knowledgeItems) {
    return this.request(`/ai-agents/${agentId}/knowledge/batch`, {
      method: 'POST',
      body: JSON.stringify({ knowledgeItems }),
    });
  }

  async updateAgentKnowledge(agentId, knowledgeId, data) {
    return this.request(`/ai-agents/${agentId}/knowledge/${knowledgeId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAgentKnowledge(agentId, knowledgeId) {
    return this.request(`/ai-agents/${agentId}/knowledge/${knowledgeId}`, {
      method: 'DELETE',
    });
  }

  async searchAgentKnowledge(agentId, query, options = {}) {
    return this.request(`/ai-agents/${agentId}/knowledge/search`, {
      method: 'POST',
      body: JSON.stringify({ query, ...options }),
    });
  }

  // ================================
  // ANALYTICS
  // ================================
  
  async getDashboard(period = 30) {
    return this.request(`/analytics/dashboard?period=${period}`);
  }

  async getCampaignAnalytics(campaignId) {
    return this.request(`/analytics/campaigns/${campaignId}`);
  }

  async getConversionFunnel(campaignId = null) {
    const query = campaignId ? `?campaign_id=${campaignId}` : '';
    return this.request(`/analytics/funnel${query}`);
  }

  async getLinkedInPerformance() {
    return this.request('/analytics/linkedin-performance');
  }

  async getAIAgentsPerformance() {
    return this.request('/analytics/ai-agents-performance');
  }

  async getDailyActivity(days = 30) {
    return this.request(`/analytics/daily-activity?days=${days}`);
  }

  // ================================
  // LINKEDIN PROFILES
  // ================================
  
  async getLinkedInAccounts() {
    return this.request('/profiles/linkedin-accounts');
  }

  async connectLinkedInAccount(username, password) {
    return this.request('/profiles/linkedin-accounts/connect', {
      method: 'POST',
      body: JSON.stringify({ username, password }),
    });
  }

  async searchLinkedInProfiles(params) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/profiles/linkedin/search?${query}`);
  }

  async sendInvitation(accountId, providerId, message) {
    return this.request('/profiles/linkedin/invite', {
      method: 'POST',
      body: JSON.stringify({
        account_id: accountId,
        provider_id: providerId,
        message,
      }),
    });
  }

  async getInviteStats(accountId) {
    return this.request(`/profiles/linkedin-accounts/${accountId}/invite-stats`);
  }

  async updateInviteLimit(accountId, dailyLimit) {
    return this.request(`/profiles/linkedin-accounts/${accountId}/daily-limit`, {
      method: 'PATCH',
      body: JSON.stringify({ daily_limit: dailyLimit }),
    });
  }

  async refreshLinkedInAccount(accountId) {
    return this.request(`/profiles/linkedin-accounts/${accountId}/refresh`, {
      method: 'POST',
    });
  }

  async getAccountHealth(accountId) {
    return this.request(`/profiles/linkedin-accounts/${accountId}/health`);
  }

  async getRecommendedLimit(accountId, strategy = 'moderate') {
    return this.request(`/profiles/linkedin-accounts/${accountId}/recommended-limit?strategy=${strategy}`);
  }

  async overrideLimit(accountId, newLimit, reason) {
    return this.request(`/profiles/linkedin-accounts/${accountId}/override-limit`, {
      method: 'POST',
      body: JSON.stringify({ new_limit: newLimit, reason }),
    });
  }

  async getLimitHistory(accountId, limit = 20) {
    return this.request(`/profiles/linkedin-accounts/${accountId}/limit-history?limit=${limit}`);
  }

  // ================================
  // 🔍 BUSCA DE PERFIS
  // ================================

  async searchProfiles(params) {
    console.log('🔍 API Service - Buscando perfis:', params);
    return this.request('/profiles/search', {
      method: 'POST',
      body: JSON.stringify(params)
    });
  }

  async searchLocations(query, accountId, limit = 20) {
    const params = new URLSearchParams({ 
      query, 
      account_id: accountId,
      limit 
    });
    return this.request(`/unipile/locations?${params}`);
  }

  async searchIndustries(query, accountId, limit = 20) {
    const params = new URLSearchParams({ 
      query, 
      account_id: accountId,
      limit 
    });
    return this.request(`/unipile/industries?${params}`);
  }

  async searchJobTitles(query, accountId, limit = 20) {
    const params = new URLSearchParams({ 
      query, 
      account_id: accountId,
      limit 
    });
    return this.request(`/unipile/job-titles?${params}`);
  }

  async searchCompanies(query, accountId, limit = 20) {
    const params = new URLSearchParams({ 
      query, 
      account_id: accountId,
      limit 
    });
    return this.request(`/unipile/companies?${params}`);
  }

  // ================================
  // ⚡ BULK COLLECTION
  // ================================
  
  async createBulkCollectionJob(data) {
    return this.request('/bulk-collection/jobs', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getBulkCollectionJobs(status = null) {
    const params = status ? `?status=${status}` : '';
    return this.request(`/bulk-collection/jobs${params}`);
  }

  async getBulkCollectionJob(jobId) {
    return this.request(`/bulk-collection/jobs/${jobId}`);
  }

  async cancelBulkCollectionJob(jobId) {
    return this.request(`/bulk-collection/jobs/${jobId}/cancel`, {
      method: 'POST',
    });
  }

  // ================================
  // AI AGENTS
  // ================================

  async getBehavioralProfiles() {
    return this.request('/ai-agents/behavioral-profiles');
  }

  async generateSearchFilters(description) {
    return this.request('/ai-agents/generate-filters', {
      method: 'POST',
      body: JSON.stringify({ description }),
    });
  }

  async getAIAgents() {
    return this.request('/ai-agents');
  }

  async getAIAgent(id) {
    return this.request(`/ai-agents/${id}`);
  }

  async createAIAgent(data) {
    return this.request('/ai-agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAIAgent(id, data) {
    return this.request(`/ai-agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAIAgent(id) {
    return this.request(`/ai-agents/${id}`, {
      method: 'DELETE',
    });
  }

}

export default new ApiService();