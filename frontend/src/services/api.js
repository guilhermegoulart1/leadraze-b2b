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

  // Generic HTTP methods
  async get(endpoint) {
    return this.request(endpoint);
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
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

  async validateResetToken(token) {
    return this.request(`/auth/validate-reset-token?token=${token}`);
  }

  async resetPassword(token, password) {
    return this.request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  async requestPasswordReset(email) {
    return this.request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  }

  // ================================
  // USER PROFILE
  // ================================

  async getUserProfile() {
    return this.request('/users/profile');
  }

  async updateUserProfile(data) {
    return this.request('/users/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
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
  // CAMPAIGN REVIEW CONFIG & INVITE QUEUE
  // ================================

  async saveReviewConfig(campaignId, config) {
    return this.request(`/campaigns/${campaignId}/review-config`, {
      method: 'POST',
      body: JSON.stringify(config),
    });
  }

  async getReviewConfig(campaignId) {
    return this.request(`/campaigns/${campaignId}/review-config`);
  }

  async getCampaignReport(campaignId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/campaigns/${campaignId}/report${query ? '?' + query : ''}`);
  }

  async getQueueStatus(campaignId) {
    return this.request(`/campaigns/${campaignId}/queue-status`);
  }

  async cancelCampaign(campaignId) {
    return this.request(`/campaigns/${campaignId}/cancel`, {
      method: 'POST',
    });
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

  // Lead Assignment
  async assignLead(leadId, userId) {
    return this.request(`/leads/${leadId}/assign`, {
      method: 'PATCH',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async autoAssignLead(leadId) {
    return this.request(`/leads/${leadId}/auto-assign`, {
      method: 'POST',
    });
  }

  async getAssignableUsers(sectorId = null) {
    const params = sectorId ? `?sector_id=${sectorId}` : '';
    return this.request(`/leads/assignable-users${params}`);
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

  async sendMessage(conversationId, content, attachments = []) {
    // Se não há attachments, envia como JSON normal
    if (!attachments || attachments.length === 0) {
      return this.request(`/conversations/${conversationId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content }),
      });
    }

    // Se há attachments, usa FormData
    const formData = new FormData();
    if (content) {
      formData.append('content', content);
    }

    // Adicionar cada arquivo
    for (const file of attachments) {
      formData.append('attachments', file);
    }

    const url = `${this.baseURL}/conversations/${conversationId}/messages`;
    const token = this.getToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
        // NÃO definir Content-Type - o browser define automaticamente com boundary
      },
      body: formData,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Erro ao enviar mensagem');
    }

    return data;
  }

  // Gerar URL para exibição inline de imagem
  getAttachmentInlineUrl(conversationId, messageId, attachmentId) {
    const token = this.getToken();
    return `${this.baseURL}/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentId}/inline?token=${token}`;
  }

  // Download de attachment
  async downloadAttachment(conversationId, messageId, attachmentId, filename) {
    // Passar o filename como query param para o backend usar como fallback
    const encodedFilename = encodeURIComponent(filename || 'download');
    const url = `${this.baseURL}/conversations/${conversationId}/messages/${messageId}/attachments/${attachmentId}?filename=${encodedFilename}`;
    const token = this.getToken();

    const response = await fetch(url, {
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
    });

    if (!response.ok) {
      throw new Error('Erro ao baixar arquivo');
    }

    // Criar blob e trigger download
    const blob = await response.blob();
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = filename || 'download';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(downloadUrl);

    return true;
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

  async assignConversation(conversationId, userId) {
    return this.request(`/conversations/${conversationId}/assign`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async unassignConversation(conversationId) {
    return this.request(`/conversations/${conversationId}/unassign`, {
      method: 'POST',
    });
  }

  async assignSectorToConversation(conversationId, sectorId) {
    return this.request(`/conversations/${conversationId}/assign-sector`, {
      method: 'POST',
      body: JSON.stringify({ sector_id: sectorId }),
    });
  }

  async unassignSectorFromConversation(conversationId) {
    return this.request(`/conversations/${conversationId}/unassign-sector`, {
      method: 'POST',
    });
  }

  async updateContactName(conversationId, name) {
    return this.request(`/conversations/${conversationId}/contact-name`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
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

  async getHostedAuthLink(provider = null) {
    const params = provider ? `?provider=${provider}` : '';
    return this.request(`/profiles/linkedin-accounts/hosted-auth-link${params}`);
  }

  // ================================
  // MULTI-CHANNEL
  // ================================

  async handleChannelCallback(unipileAccountId) {
    return this.request('/profiles/channels/callback', {
      method: 'POST',
      body: JSON.stringify({ unipile_account_id: unipileAccountId }),
    });
  }

  async updateChannelSettings(channelId, settings) {
    return this.request(`/profiles/channels/${channelId}/settings`, {
      method: 'PATCH',
      body: JSON.stringify({ settings }),
    });
  }

  async getChannelTypes() {
    return this.request('/profiles/channel-types');
  }

  async syncChannels() {
    return this.request('/profiles/channels/sync', {
      method: 'POST',
    });
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

  async disconnectLinkedInAccount(accountId) {
    return this.request(`/profiles/linkedin-accounts/${accountId}/disconnect`, {
      method: 'POST',
    });
  }

  async reactivateLinkedInAccount(accountId) {
    return this.request(`/profiles/linkedin-accounts/${accountId}/reactivate`, {
      method: 'POST',
    });
  }

  async deleteLinkedInAccount(accountId) {
    return this.request(`/profiles/linkedin-accounts/${accountId}`, {
      method: 'DELETE',
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

  async getProfileDetails(profileId, accountId) {
    return this.request(`/profiles/${profileId}/details?linkedin_account_id=${accountId}`);
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

  // ================================
  // CONTACTS
  // ================================

  async getContacts(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/contacts${query ? '?' + query : ''}`);
  }

  async getContact(id) {
    return this.request(`/contacts/${id}`);
  }

  async getContactFull(id) {
    return this.request(`/contacts/${id}/full`);
  }

  async createContact(data) {
    return this.request('/contacts', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContact(id, data) {
    return this.request(`/contacts/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContact(id) {
    return this.request(`/contacts/${id}`, {
      method: 'DELETE',
    });
  }

  async addContactNote(contactId, content) {
    return this.request(`/contacts/${contactId}/notes`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteContactNote(contactId, noteId) {
    return this.request(`/contacts/${contactId}/notes/${noteId}`, {
      method: 'DELETE',
    });
  }

  async addContactTag(contactId, tagId) {
    return this.request(`/contacts/${contactId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_id: tagId }),
    });
  }

  async removeContactTag(contactId, tagId) {
    return this.request(`/contacts/${contactId}/tags/${tagId}`, {
      method: 'DELETE',
    });
  }

  async getTags(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tags${query ? '?' + query : ''}`);
  }

  async createTag(tagData) {
    return this.request('/tags', {
      method: 'POST',
      body: JSON.stringify(tagData),
    });
  }

  async updateTag(tagId, tagData) {
    return this.request(`/tags/${tagId}`, {
      method: 'PUT',
      body: JSON.stringify(tagData),
    });
  }

  async deleteTag(tagId) {
    return this.request(`/tags/${tagId}`, {
      method: 'DELETE',
    });
  }

  async addTagToLead(leadId, tagId) {
    return this.request(`/leads/${leadId}/tags`, {
      method: 'POST',
      body: JSON.stringify({ tag_id: tagId }),
    });
  }

  async removeTagFromLead(leadId, tagId) {
    return this.request(`/leads/${leadId}/tags/${tagId}`, {
      method: 'DELETE',
    });
  }

  async exportContacts(filters = {}) {
    return this.request('/contacts/export', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  }

  async importContacts(csvData) {
    return this.request('/contacts/import', {
      method: 'POST',
      body: JSON.stringify({ csv_data: csvData }),
    });
  }

  // ================================
  // USERS
  // ================================

  async getUsers(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/users${query ? '?' + query : ''}`);
  }

  async getUser(id) {
    return this.request(`/users/${id}`);
  }

  async createUser(data) {
    return this.request('/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateUser(id, data) {
    return this.request(`/users/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteUser(id) {
    return this.request(`/users/${id}`, {
      method: 'DELETE',
    });
  }

  async assignUserToTeam(userId, supervisorId) {
    return this.request(`/users/${userId}/team`, {
      method: 'POST',
      body: JSON.stringify({ supervisor_id: supervisorId }),
    });
  }

  async removeUserFromTeam(userId, supervisorId) {
    return this.request(`/users/${userId}/team/${supervisorId}`, {
      method: 'DELETE',
    });
  }

  async getTeamMembers(supervisorId) {
    return this.request(`/users/${supervisorId}/team-members`);
  }

  // ================================
  // PERMISSIONS
  // ================================

  async getAllPermissions() {
    return this.request('/permissions');
  }

  async getRolePermissions(role) {
    return this.request(`/permissions/roles/${role}`);
  }

  async updateRolePermissions(role, data) {
    return this.request(`/permissions/roles/${role}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ================================
  // SECTORS
  // ================================

  async getSectors(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/sectors${query ? '?' + query : ''}`);
  }

  async getSector(id) {
    return this.request(`/sectors/${id}`);
  }

  async createSector(data) {
    return this.request('/sectors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateSector(id, data) {
    return this.request(`/sectors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteSector(id) {
    return this.request(`/sectors/${id}`, {
      method: 'DELETE',
    });
  }

  async assignUserToSector(data) {
    return this.request('/sectors/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeUserFromSector(sectorId, userId) {
    return this.request(`/sectors/${sectorId}/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async assignSupervisorToSector(data) {
    return this.request('/sectors/supervisors', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeSupervisorFromSector(sectorId, supervisorId) {
    return this.request(`/sectors/${sectorId}/supervisors/${supervisorId}`, {
      method: 'DELETE',
    });
  }

  async getUserSectors(userId) {
    return this.request(`/sectors/users/${userId}/sectors`);
  }

  async getSupervisorSectors(supervisorId) {
    return this.request(`/sectors/supervisors/${supervisorId}/sectors`);
  }

  /**
   * Get all users belonging to a specific sector
   * Used for agent rotation selection
   */
  async getSectorUsers(sectorId) {
    return this.request(`/sectors/${sectorId}/users`);
  }

  // Round-Robin Management
  async toggleSectorRoundRobin(sectorId, enabled) {
    return this.request(`/sectors/${sectorId}/round-robin`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled }),
    });
  }

  async getSectorRoundRobinUsers(sectorId) {
    return this.request(`/sectors/${sectorId}/round-robin-users`);
  }

  async addUserToRoundRobin(sectorId, userId) {
    return this.request(`/sectors/${sectorId}/round-robin-users`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId }),
    });
  }

  async removeUserFromRoundRobin(sectorId, userId) {
    return this.request(`/sectors/${sectorId}/round-robin-users/${userId}`, {
      method: 'DELETE',
    });
  }

  async getSectorAssignmentStats(sectorId) {
    return this.request(`/sectors/${sectorId}/assignment-stats`);
  }

  // ================================
  // USER PERMISSIONS (CUSTOM)
  // ================================

  async getUserPermissions(userId) {
    return this.request(`/permissions/users/${userId}`);
  }

  async getUserEffectivePermissions(userId) {
    return this.request(`/permissions/users/${userId}/effective`);
  }

  async setUserPermission(userId, data) {
    return this.request(`/permissions/users/${userId}`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeUserPermission(userId, permissionKey) {
    return this.request(`/permissions/users/${userId}/${permissionKey}`, {
      method: 'DELETE',
    });
  }

  async bulkSetUserPermissions(userId, permissions) {
    return this.request(`/permissions/users/${userId}/bulk`, {
      method: 'POST',
      body: JSON.stringify({ permissions }),
    });
  }

  async getAvailablePermissions() {
    return this.request('/permissions/available');
  }

  // ================================
  // GOOGLE MAPS SEARCH (OUTSCRAPER)
  // ================================

  async searchGoogleMaps(filters) {
    return this.request('/google-maps/search', {
      method: 'POST',
      body: JSON.stringify(filters),
    });
  }

  async exportGoogleMapsCSV(businesses) {
    const url = `${this.baseURL}/google-maps/export`;
    const token = this.getToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ businesses }),
    });

    if (!response.ok) {
      throw new Error('Erro ao exportar CSV');
    }

    // Retorna o texto CSV (não JSON)
    return response.text();
  }

  async getGoogleMapsAccountInfo() {
    return this.request('/google-maps/account');
  }

  // ================================
  // GOOGLE MAPS AGENTS
  // ================================

  async getGoogleMapsAgents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/google-maps-agents${query ? '?' + query : ''}`);
  }

  async getGoogleMapsAgent(id) {
    return this.request(`/google-maps-agents/${id}`);
  }

  async createGoogleMapsAgent(data) {
    return this.request('/google-maps-agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async executeGoogleMapsAgent(id) {
    return this.request(`/google-maps-agents/${id}/execute`, {
      method: 'POST',
    });
  }

  async pauseGoogleMapsAgent(id) {
    return this.request(`/google-maps-agents/${id}/pause`, {
      method: 'PUT',
    });
  }

  async resumeGoogleMapsAgent(id) {
    return this.request(`/google-maps-agents/${id}/resume`, {
      method: 'PUT',
    });
  }

  async deleteGoogleMapsAgent(id) {
    return this.request(`/google-maps-agents/${id}`, {
      method: 'DELETE',
    });
  }

  async getGoogleMapsAgentStats(id) {
    return this.request(`/google-maps-agents/${id}/stats`);
  }

  async getGoogleMapsAgentAssignees(id) {
    return this.request(`/google-maps-agents/${id}/assignees`);
  }

  async setGoogleMapsAgentAssignees(id, userIds) {
    return this.request(`/google-maps-agents/${id}/assignees`, {
      method: 'PUT',
      body: JSON.stringify({ userIds }),
    });
  }

  async getGoogleMapsAgentAssignments(id, limit = 50) {
    return this.request(`/google-maps-agents/${id}/assignments?limit=${limit}`);
  }

  // ================================
  // CONTACT LISTS
  // ================================

  async getContactLists(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/contact-lists${query ? '?' + query : ''}`);
  }

  async getContactList(id) {
    return this.request(`/contact-lists/${id}`);
  }

  async createContactList(data) {
    return this.request('/contact-lists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateContactList(id, data) {
    return this.request(`/contact-lists/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteContactList(id) {
    return this.request(`/contact-lists/${id}`, {
      method: 'DELETE',
    });
  }

  async getContactListItems(listId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/contact-lists/${listId}/items${query ? '?' + query : ''}`);
  }

  async addContactToList(listId, data) {
    return this.request(`/contact-lists/${listId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async removeContactFromList(listId, itemId) {
    return this.request(`/contact-lists/${listId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async importContactsToList(listId, data) {
    return this.request(`/contact-lists/${listId}/import`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ================================
  // ACTIVATION AGENTS
  // ================================

  async getActivationAgents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/activation-agents${query ? '?' + query : ''}`);
  }

  async getActivationAgent(id) {
    return this.request(`/activation-agents/${id}`);
  }

  async createActivationAgent(data) {
    return this.request('/activation-agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateActivationAgent(id, data) {
    return this.request(`/activation-agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteActivationAgent(id) {
    return this.request(`/activation-agents/${id}`, {
      method: 'DELETE',
    });
  }

  async testActivationAgent(id, data) {
    return this.request(`/activation-agents/${id}/test`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ================================
  // ACTIVATION CAMPAIGNS
  // ================================

  async getActivationCampaigns(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/activation-campaigns${query ? '?' + query : ''}`);
  }

  async getActivationCampaign(id) {
    return this.request(`/activation-campaigns/${id}`);
  }

  async createActivationCampaign(data) {
    return this.request('/activation-campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateActivationCampaign(id, data) {
    return this.request(`/activation-campaigns/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteActivationCampaign(id) {
    return this.request(`/activation-campaigns/${id}`, {
      method: 'DELETE',
    });
  }

  async startActivationCampaign(id) {
    return this.request(`/activation-campaigns/${id}/start`, {
      method: 'POST',
    });
  }

  async pauseActivationCampaign(id) {
    return this.request(`/activation-campaigns/${id}/pause`, {
      method: 'POST',
    });
  }

  async resumeActivationCampaign(id) {
    return this.request(`/activation-campaigns/${id}/resume`, {
      method: 'POST',
    });
  }

  async stopActivationCampaign(id) {
    return this.request(`/activation-campaigns/${id}/stop`, {
      method: 'POST',
    });
  }

  async getActivationCampaignStats(id) {
    return this.request(`/activation-campaigns/${id}/stats`);
  }

  // ================================
  // MY CONNECTIONS (1st Degree LinkedIn)
  // ================================

  // Listar conexões de 1º grau
  async getMyConnections(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/connections${query ? '?' + query : ''}`);
  }

  // Buscar perfil completo de uma conexão
  async getConnectionFullProfile(providerId, linkedinAccountId) {
    return this.request(`/connections/${providerId}/profile?linkedin_account_id=${linkedinAccountId}`);
  }

  // Salvar conexão no CRM
  async saveConnectionToCRM(linkedinAccountId, profile) {
    return this.request('/connections/save-to-crm', {
      method: 'POST',
      body: JSON.stringify({ linkedin_account_id: linkedinAccountId, profile }),
    });
  }

  // Obter limite diário de ativação de conexões
  async getConnectionDailyLimit() {
    return this.request('/connections/daily-limit');
  }

  // Atualizar limite diário
  async updateConnectionDailyLimit(dailyLimit) {
    return this.request('/connections/daily-limit', {
      method: 'PUT',
      body: JSON.stringify({ daily_limit: dailyLimit }),
    });
  }

  // Listar campanhas de conexões
  async getConnectionCampaigns(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/connections/campaigns${query ? '?' + query : ''}`);
  }

  // Criar campanha de ativação de conexões
  async createConnectionCampaign(data) {
    return this.request('/connections/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // Pausar campanha de conexões
  async pauseConnectionCampaign(id) {
    return this.request(`/connections/campaigns/${id}/pause`, {
      method: 'POST',
    });
  }

  // Retomar campanha de conexões
  async resumeConnectionCampaign(id) {
    return this.request(`/connections/campaigns/${id}/resume`, {
      method: 'POST',
    });
  }

  // Parar campanha de conexões
  async stopConnectionCampaign(id) {
    return this.request(`/connections/campaigns/${id}/stop`, {
      method: 'POST',
    });
  }

  // ==========================================
  // CONNECTED ACCOUNTS
  // ==========================================

  async getConnectedAccounts() {
    // TODO: Implement backend endpoint to check connected accounts
    // For now, check if user has linkedin profiles to determine linkedin availability
    try {
      const profilesResponse = await this.request('/profiles');
      const emailAvailable = true; // Email is always available as it's system default
      const linkedinAvailable = profilesResponse.success && profilesResponse.data?.profiles?.length > 0;

      return {
        success: true,
        data: {
          accounts: [
            emailAvailable && { type: 'email', status: 'connected' },
            { type: 'whatsapp', status: 'not_connected' }, // WhatsApp not implemented yet
            linkedinAvailable && { type: 'linkedin', status: 'connected' }
          ].filter(Boolean)
        }
      };
    } catch (error) {
      console.error('Error checking connected accounts:', error);
      // Default to all available for development
      return {
        success: true,
        data: {
          accounts: [
            { type: 'email', status: 'connected' },
            { type: 'whatsapp', status: 'connected' },
            { type: 'linkedin', status: 'connected' }
          ]
        }
      };
    }
  }

  // ==========================================
  // UNIFIED AGENTS (LinkedIn, Google Maps, Email, WhatsApp)
  // ==========================================

  async getAgents(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/agents${query ? '?' + query : ''}`);
  }

  async getAgent(id) {
    return this.request(`/agents/${id}`);
  }

  async createAgent(data) {
    return this.request('/agents', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAgent(id, data) {
    return this.request(`/agents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAgent(id) {
    return this.request(`/agents/${id}`, {
      method: 'DELETE',
    });
  }

  async testAgent(id, testInput) {
    return this.request(`/agents/${id}/test`, {
      method: 'POST',
      body: JSON.stringify({ test_input: testInput }),
    });
  }

  async testAgentInitialMessage(agentId, data) {
    return this.request(`/agents/${agentId}/test/initial-message`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async testAgentResponse(agentId, data) {
    return this.request(`/agents/${agentId}/test/response`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAgentStats(id) {
    return this.request(`/agents/${id}/stats`);
  }

  // Agent Assignments (rotation log)
  async getAgentAssignments(agentId, params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/agents/${agentId}/assignments${query ? '?' + query : ''}`);
  }

  async getAgentAssignmentStats(agentId) {
    return this.request(`/agents/${agentId}/assignments/stats`);
  }

  // Agent AI Generation
  async generateAgentConfig(description, agentType = 'linkedin', language = 'pt') {
    return this.request('/agents/generate-config', {
      method: 'POST',
      body: JSON.stringify({ description, agent_type: agentType, language }),
    });
  }

  async refineAgentConfig(currentConfig, feedback, language = 'pt') {
    return this.request('/agents/refine-config', {
      method: 'POST',
      body: JSON.stringify({ current_config: currentConfig, feedback, language }),
    });
  }

  // Agent Templates
  async getAgentTemplates(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/agents/templates${query ? '?' + query : ''}`);
  }

  async getAgentTemplate(templateId) {
    return this.request(`/agents/templates/${templateId}`);
  }

  async applyAgentTemplate(templateId, data) {
    return this.request(`/agents/templates/${templateId}/apply`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ================================
  // BILLING & SUBSCRIPTION
  // ================================

  async getSubscription() {
    return this.request('/billing/subscription');
  }

  async getPlans() {
    return this.request('/billing/plans');
  }

  async getUsage() {
    return this.request('/billing/usage');
  }

  async getCredits() {
    return this.request('/billing/credits');
  }

  async createCheckoutSession(data) {
    return this.request('/billing/create-checkout-session', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createGuestCheckoutSession(data) {
    return this.request('/billing/checkout-guest', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async purchaseCredits(data) {
    return this.request('/billing/purchase-credits', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async createPortalSession() {
    return this.request('/billing/create-portal-session', {
      method: 'POST',
    });
  }

  async cancelSubscription() {
    return this.request('/billing/cancel', {
      method: 'POST',
    });
  }

  async reactivateSubscription() {
    return this.request('/billing/reactivate', {
      method: 'POST',
    });
  }

  async addExtraChannel() {
    return this.request('/billing/add-channel', {
      method: 'POST',
    });
  }

  async addExtraUser() {
    return this.request('/billing/add-user', {
      method: 'POST',
    });
  }

  async getInvoices() {
    return this.request('/billing/invoices');
  }

  async getPaymentMethods() {
    return this.request('/billing/payment-methods');
  }

  async resubscribeWithPaymentMethod(data = {}) {
    return this.request('/billing/resubscribe', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ================================
  // 💬 LEAD COMMENTS
  // ================================

  async getLeadComments(leadId) {
    return this.request(`/leads/${leadId}/comments`);
  }

  async createLeadComment(leadId, data) {
    return this.request(`/leads/${leadId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateLeadComment(leadId, commentId, data) {
    return this.request(`/leads/${leadId}/comments/${commentId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLeadComment(leadId, commentId) {
    return this.request(`/leads/${leadId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  async searchUsersForMentions(leadId, query) {
    const params = new URLSearchParams({ query });
    return this.request(`/leads/${leadId}/comments/search-users?${params}`);
  }

  // ================================
  // EMAIL SETTINGS
  // ================================

  // Branding
  async getEmailBranding() {
    return this.request('/email-settings/branding');
  }

  async updateEmailBranding(data) {
    return this.request('/email-settings/branding', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadCompanyLogo(file) {
    const formData = new FormData();
    formData.append('logo', file);

    const url = `${this.baseURL}/email-settings/logo/upload`;
    const token = this.getToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao fazer upload do logo');
    }
    return data;
  }

  async deleteCompanyLogo() {
    return this.request('/email-settings/logo', {
      method: 'DELETE',
    });
  }

  // Signatures
  async getEmailSignatures(includePersonal = true) {
    return this.request(`/email-settings/signatures?includePersonal=${includePersonal}`);
  }

  async getEmailSignature(id) {
    return this.request(`/email-settings/signatures/${id}`);
  }

  async createEmailSignature(data) {
    return this.request('/email-settings/signatures', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmailSignature(id, data) {
    return this.request(`/email-settings/signatures/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmailSignature(id) {
    return this.request(`/email-settings/signatures/${id}`, {
      method: 'DELETE',
    });
  }

  async setDefaultSignature(id) {
    return this.request(`/email-settings/signatures/${id}/default`, {
      method: 'POST',
    });
  }

  async uploadSignatureLogo(signatureId, file) {
    const formData = new FormData();
    formData.append('logo', file);

    const url = `${this.baseURL}/email-settings/signatures/${signatureId}/logo`;
    const token = this.getToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao fazer upload do logo');
    }
    return data;
  }

  // Generic file upload for signature assets (photo or logo)
  async uploadFile(formData) {
    const url = `${this.baseURL}/email-settings/signatures/upload`;
    const token = this.getToken();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Erro ao fazer upload do arquivo');
    }
    return data;
  }

  // Preferences
  async getEmailPreferences() {
    return this.request('/email-settings/preferences');
  }

  async updateEmailPreferences(data) {
    return this.request('/email-settings/preferences', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // Templates
  async getEmailTemplates(category = null) {
    const params = category ? `?category=${category}` : '';
    return this.request(`/email-settings/templates${params}`);
  }

  async getEmailTemplate(id) {
    return this.request(`/email-settings/templates/${id}`);
  }

  async createEmailTemplate(data) {
    return this.request('/email-settings/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateEmailTemplate(id, data) {
    return this.request(`/email-settings/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteEmailTemplate(id) {
    return this.request(`/email-settings/templates/${id}`, {
      method: 'DELETE',
    });
  }

  async previewEmailTemplate(id, data = {}) {
    return this.request(`/email-settings/templates/${id}/preview`, {
      method: 'POST',
      body: JSON.stringify({ data }),
    });
  }

  // ================================
  // WEBSITE AGENTS ADMIN
  // ================================

  async getWebsiteAgents() {
    return this.request('/website-agents');
  }

  async getWebsiteAgent(agentKey) {
    return this.request(`/website-agents/${agentKey}`);
  }

  async updateWebsiteAgent(agentKey, data) {
    return this.request(`/website-agents/${agentKey}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getWebsiteKnowledge(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/website-agents/knowledge/list${query ? '?' + query : ''}`);
  }

  async addWebsiteKnowledge(data) {
    return this.request('/website-agents/knowledge', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateWebsiteKnowledge(id, data) {
    return this.request(`/website-agents/knowledge/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteWebsiteKnowledge(id) {
    return this.request(`/website-agents/knowledge/${id}`, {
      method: 'DELETE',
    });
  }

  async getWebsiteConversations(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/website-agents/conversations/list${query ? '?' + query : ''}`);
  }

  async getWebsiteConversation(id) {
    return this.request(`/website-agents/conversations/${id}`);
  }

  async getWebsiteStats(days = 30) {
    return this.request(`/website-agents/stats/overview?days=${days}`);
  }

  // Website Leads
  async getWebsiteLeads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/website-agents/leads/list${query ? '?' + query : ''}`);
  }

  async getWebsiteLeadStats() {
    return this.request('/website-agents/leads/stats');
  }

  async exportWebsiteLeads(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/website-agents/leads/export${query ? '?' + query : ''}`);
  }

  // ================================
  // AFFILIATE PROGRAM
  // ================================

  async getAffiliateLink() {
    return this.request('/affiliate/link');
  }

  async getAffiliateStats() {
    return this.request('/affiliate/stats');
  }

  async getAffiliateReferrals(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/affiliate/referrals${query ? '?' + query : ''}`);
  }

  async getAffiliateEarnings(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/affiliate/earnings${query ? '?' + query : ''}`);
  }

  async trackAffiliateClick(code) {
    return this.request('/affiliate/track', {
      method: 'POST',
      body: JSON.stringify({ code }),
    });
  }

  async validateAffiliateCode(code) {
    return this.request(`/affiliate/validate/${code}`);
  }

  // ================================
  // FEEDBACK & ROADMAP (GetRaze Next)
  // ================================

  async getFeedback(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/feedback${query ? '?' + query : ''}`);
  }

  async getFeedbackById(id) {
    return this.request(`/feedback/${id}`);
  }

  async createFeedback(data) {
    return this.request('/feedback', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateFeedback(id, data) {
    return this.request(`/feedback/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteFeedback(id) {
    return this.request(`/feedback/${id}`, {
      method: 'DELETE',
    });
  }

  async toggleFeedbackVote(id) {
    return this.request(`/feedback/${id}/vote`, {
      method: 'POST',
    });
  }

  async getFeedbackComments(feedbackId) {
    return this.request(`/feedback/${feedbackId}/comments`);
  }

  async addFeedbackComment(feedbackId, content) {
    return this.request(`/feedback/${feedbackId}/comments`, {
      method: 'POST',
      body: JSON.stringify({ content }),
    });
  }

  async deleteFeedbackComment(feedbackId, commentId) {
    return this.request(`/feedback/${feedbackId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // ================================
  // RELEASES / CHANGELOG
  // ================================

  async getReleases() {
    return this.request('/releases');
  }

  async getReleaseById(id) {
    return this.request(`/releases/${id}`);
  }

  async createRelease(data) {
    return this.request('/releases', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateRelease(id, data) {
    return this.request(`/releases/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteRelease(id) {
    return this.request(`/releases/${id}`, {
      method: 'DELETE',
    });
  }

  // ================================
  // API KEYS
  // ================================

  async getApiKeys() {
    return this.request('/api-keys');
  }

  async getApiKey(id) {
    return this.request(`/api-keys/${id}`);
  }

  async createApiKey(data) {
    return this.request('/api-keys', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateApiKey(id, data) {
    return this.request(`/api-keys/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async revokeApiKey(id) {
    return this.request(`/api-keys/${id}`, {
      method: 'DELETE',
    });
  }

  async deleteApiKeyPermanent(id) {
    return this.request(`/api-keys/${id}/permanent`, {
      method: 'DELETE',
    });
  }

  async regenerateApiKey(id) {
    return this.request(`/api-keys/${id}/regenerate`, {
      method: 'POST',
    });
  }

  async getApiKeyUsage(id, days = 30) {
    return this.request(`/api-keys/${id}/usage?days=${days}`);
  }

  async getAvailableApiKeyPermissions() {
    return this.request('/api-keys/permissions');
  }

  // ================================
  // TASKS
  // ================================

  async getTasks(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tasks${query ? '?' + query : ''}`);
  }

  async getTask(id) {
    return this.request(`/tasks/${id}`);
  }

  async createTask(data) {
    return this.request('/tasks', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateTask(id, data) {
    return this.request(`/tasks/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteTask(id) {
    return this.request(`/tasks/${id}`, {
      method: 'DELETE',
    });
  }

  async completeTask(id) {
    return this.request(`/tasks/${id}/complete`, {
      method: 'PATCH',
    });
  }

  async updateTaskStatus(id, status) {
    return this.request(`/tasks/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  async getTasksBoard(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tasks/board${query ? '?' + query : ''}`);
  }

  async getTaskStats(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/tasks/stats${query ? '?' + query : ''}`);
  }

  async getLeadTasks(leadId) {
    return this.request(`/leads/${leadId}/tasks`);
  }

  // Task Comments
  async getTaskComments(taskId) {
    return this.request(`/tasks/${taskId}/comments`);
  }

  async createTaskComment(taskId, data) {
    return this.request(`/tasks/${taskId}/comments`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteTaskComment(taskId, commentId) {
    return this.request(`/tasks/${taskId}/comments/${commentId}`, {
      method: 'DELETE',
    });
  }

  // ================================
  // CHECKLIST TEMPLATES
  // ================================

  async getChecklistTemplates(params = {}) {
    const query = new URLSearchParams(params).toString();
    return this.request(`/checklist-templates${query ? '?' + query : ''}`);
  }

  async getChecklistTemplate(id) {
    return this.request(`/checklist-templates/${id}`);
  }

  async getChecklistTemplateByStage(stage) {
    return this.request(`/checklist-templates/by-stage/${stage}`);
  }

  async createChecklistTemplate(data) {
    return this.request('/checklist-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChecklistTemplate(id, data) {
    return this.request(`/checklist-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChecklistTemplate(id) {
    return this.request(`/checklist-templates/${id}`, {
      method: 'DELETE',
    });
  }

  async addChecklistTemplateItem(templateId, data) {
    return this.request(`/checklist-templates/${templateId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChecklistTemplateItem(templateId, itemId, data) {
    return this.request(`/checklist-templates/${templateId}/items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChecklistTemplateItem(templateId, itemId) {
    return this.request(`/checklist-templates/${templateId}/items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async reorderChecklistTemplateItems(templateId, items) {
    return this.request(`/checklist-templates/${templateId}/items/reorder`, {
      method: 'PATCH',
      body: JSON.stringify({ items }),
    });
  }

  // ================================
  // LEAD CHECKLISTS (ClickUp-style)
  // ================================

  async getLeadChecklists(leadId) {
    return this.request(`/leads/${leadId}/checklists`);
  }

  async createLeadChecklist(leadId, data) {
    return this.request(`/leads/${leadId}/checklists`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChecklist(checklistId, data) {
    return this.request(`/checklists/${checklistId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChecklist(checklistId) {
    return this.request(`/checklists/${checklistId}`, {
      method: 'DELETE',
    });
  }

  async createChecklistItem(checklistId, data) {
    return this.request(`/checklists/${checklistId}/items`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateChecklistItem(itemId, data) {
    return this.request(`/checklist-items/${itemId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteChecklistItem(itemId) {
    return this.request(`/checklist-items/${itemId}`, {
      method: 'DELETE',
    });
  }

  async toggleChecklistItem(itemId) {
    return this.request(`/checklist-items/${itemId}/toggle`, {
      method: 'PATCH',
    });
  }

}

export default new ApiService();