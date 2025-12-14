// backend/src/services/intelligence/linkedinIntelService.js
const unipileClient = require('../../config/unipile');
const pool = require('../../config/database');

/**
 * LinkedIn Intelligence Service
 * Uses Unipile API to search profiles, employees, and connections for Secret Agent investigations
 */
class LinkedInIntelService {
  constructor() {
    this.initialized = unipileClient.isInitialized();
  }

  /**
   * Check if LinkedIn integration is available
   */
  isAvailable() {
    return this.initialized;
  }

  /**
   * Get active LinkedIn account for an account
   * @param {string} accountId - GetRaze account ID
   * @returns {Object|null} - Active LinkedIn account or null
   */
  async getActiveLinkedInAccount(accountId) {
    try {
      const result = await pool.query(`
        SELECT id, unipile_account_id, name, status
        FROM linkedin_accounts
        WHERE account_id = $1 AND status = 'active'
        ORDER BY updated_at DESC
        LIMIT 1
      `, [accountId]);

      return result.rows[0] || null;
    } catch (error) {
      console.error('[LinkedInIntel] Error getting LinkedIn account:', error.message);
      return null;
    }
  }

  /**
   * Search for company employees on LinkedIn
   * @param {string} unipileAccountId - Unipile account ID
   * @param {string} companyName - Company name to search
   * @param {Object} options - Search options
   * @returns {Array} - List of employees found
   */
  async searchCompanyEmployees(unipileAccountId, companyName, options = {}) {
    if (!this.initialized) {
      console.warn('[LinkedInIntel] Unipile not initialized');
      return [];
    }

    try {
      console.log(`[LinkedInIntel] Searching employees at ${companyName}`);

      const searchParams = {
        account_id: unipileAccountId,
        api: 'classic',
        category: 'people',
        keywords: companyName,
        limit: options.limit || 25
      };

      // Add job title filter if provided
      if (options.jobTitles && options.jobTitles.length > 0) {
        searchParams.job_title = options.jobTitles;
      }

      // Add industry filter if provided
      if (options.industry) {
        searchParams.industry = [options.industry];
      }

      const response = await unipileClient.linkedin.search(searchParams);
      const items = response.items || [];

      console.log(`[LinkedInIntel] Found ${items.length} profiles at ${companyName}`);

      // Map to standardized format
      return items.map(profile => ({
        id: profile.id || profile.provider_id,
        name: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        headline: profile.headline || profile.occupation,
        company: profile.current_company_name || profile.company_name || companyName,
        title: profile.current_position || profile.title,
        location: profile.location,
        profileUrl: profile.public_profile_url || profile.linkedin_url,
        profilePicture: profile.profile_picture_url || profile.picture_url,
        connectionDegree: profile.connection_degree || profile.network_distance,
        summary: profile.summary
      }));

    } catch (error) {
      console.error(`[LinkedInIntel] Error searching employees:`, error.message);
      return [];
    }
  }

  /**
   * Search for a specific person on LinkedIn
   * @param {string} unipileAccountId - Unipile account ID
   * @param {string} personName - Person's name
   * @param {Object} context - Additional context (company, role, etc.)
   * @returns {Array} - List of matching profiles
   */
  async searchPerson(unipileAccountId, personName, context = {}) {
    if (!this.initialized) {
      console.warn('[LinkedInIntel] Unipile not initialized');
      return [];
    }

    try {
      console.log(`[LinkedInIntel] Searching for person: ${personName}`);

      let keywords = personName;

      // Add company to keywords if available
      if (context.company) {
        keywords = `${personName} ${context.company}`;
      }

      const searchParams = {
        account_id: unipileAccountId,
        api: 'classic',
        category: 'people',
        keywords: keywords,
        limit: 10
      };

      // Add job title filter if role is known
      if (context.role) {
        searchParams.job_title = [context.role];
      }

      const response = await unipileClient.linkedin.search(searchParams);
      const items = response.items || [];

      console.log(`[LinkedInIntel] Found ${items.length} profiles matching ${personName}`);

      return items.map(profile => ({
        id: profile.id || profile.provider_id,
        name: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        headline: profile.headline || profile.occupation,
        company: profile.current_company_name || profile.company_name,
        title: profile.current_position || profile.title,
        location: profile.location,
        profileUrl: profile.public_profile_url || profile.linkedin_url,
        profilePicture: profile.profile_picture_url || profile.picture_url,
        connectionDegree: profile.connection_degree || profile.network_distance,
        summary: profile.summary
      }));

    } catch (error) {
      console.error(`[LinkedInIntel] Error searching person:`, error.message);
      return [];
    }
  }

  /**
   * Search for people in a specific niche/industry
   * @param {string} unipileAccountId - Unipile account ID
   * @param {string} niche - Industry/niche name
   * @param {Object} options - Search options
   * @returns {Array} - List of relevant profiles
   */
  async searchNicheProfiles(unipileAccountId, niche, options = {}) {
    if (!this.initialized) {
      console.warn('[LinkedInIntel] Unipile not initialized');
      return [];
    }

    try {
      console.log(`[LinkedInIntel] Searching profiles in niche: ${niche}`);

      const searchParams = {
        account_id: unipileAccountId,
        api: 'classic',
        category: 'people',
        keywords: niche,
        limit: options.limit || 20
      };

      // Focus on decision makers by title
      if (options.decisionMakers) {
        searchParams.job_title = ['CEO', 'Founder', 'Director', 'Owner', 'Head', 'Manager', 'VP'];
      }

      // Add location filter
      if (options.region) {
        searchParams.location = options.region;
      }

      const response = await unipileClient.linkedin.search(searchParams);
      const items = response.items || [];

      console.log(`[LinkedInIntel] Found ${items.length} profiles in ${niche}`);

      return items.map(profile => ({
        id: profile.id || profile.provider_id,
        name: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        headline: profile.headline || profile.occupation,
        company: profile.current_company_name || profile.company_name,
        title: profile.current_position || profile.title,
        location: profile.location,
        profileUrl: profile.public_profile_url || profile.linkedin_url,
        profilePicture: profile.profile_picture_url || profile.picture_url,
        connectionDegree: profile.connection_degree || profile.network_distance,
        summary: profile.summary
      }));

    } catch (error) {
      console.error(`[LinkedInIntel] Error searching niche:`, error.message);
      return [];
    }
  }

  /**
   * Get full profile details from LinkedIn
   * @param {string} unipileAccountId - Unipile account ID
   * @param {string} userId - LinkedIn user ID or profile URL
   * @returns {Object|null} - Full profile data
   */
  async getFullProfile(unipileAccountId, userId) {
    if (!this.initialized) {
      console.warn('[LinkedInIntel] Unipile not initialized');
      return null;
    }

    try {
      console.log(`[LinkedInIntel] Getting full profile for: ${userId}`);

      const profile = await unipileClient.users.getFullProfile(unipileAccountId, userId);

      return {
        id: profile.id || profile.provider_id,
        name: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        headline: profile.headline,
        location: profile.location,
        summary: profile.summary,
        company: profile.current_company_name,
        title: profile.current_position,
        profileUrl: profile.public_profile_url,
        profilePicture: profile.profile_picture_url,
        connectionDegree: profile.connection_degree,
        // Extended data from linkedin_sections=*
        experience: profile.experience || [],
        education: profile.education || [],
        skills: profile.skills || [],
        certifications: profile.certifications || [],
        languages: profile.languages || [],
        recommendations: profile.recommendations || []
      };

    } catch (error) {
      console.error(`[LinkedInIntel] Error getting full profile:`, error.message);
      return null;
    }
  }

  /**
   * Search for mutual connections (people connected to both the user and the target)
   * @param {string} unipileAccountId - Unipile account ID
   * @param {string} targetName - Target person or company name
   * @returns {Array} - List of potential mutual connections
   */
  async findMutualConnections(unipileAccountId, targetName) {
    if (!this.initialized) {
      console.warn('[LinkedInIntel] Unipile not initialized');
      return [];
    }

    try {
      console.log(`[LinkedInIntel] Searching mutual connections for: ${targetName}`);

      // Search in 1st degree connections for people related to the target
      const searchParams = {
        account_id: unipileAccountId,
        keywords: targetName,
        limit: 20
      };

      const response = await unipileClient.connections.search(searchParams);
      const items = response.items || [];

      console.log(`[LinkedInIntel] Found ${items.length} potential bridges to ${targetName}`);

      return items.map(profile => ({
        id: profile.id || profile.provider_id,
        name: profile.name || `${profile.first_name || ''} ${profile.last_name || ''}`.trim(),
        headline: profile.headline || profile.occupation,
        company: profile.current_company_name || profile.company_name,
        title: profile.current_position || profile.title,
        profileUrl: profile.public_profile_url || profile.linkedin_url,
        connectionDegree: 1, // These are 1st degree connections
        isPotentialBridge: true
      }));

    } catch (error) {
      console.error(`[LinkedInIntel] Error finding mutual connections:`, error.message);
      return [];
    }
  }

  /**
   * Format LinkedIn findings for agent report
   * @param {Array} profiles - List of profiles found
   * @param {string} context - Context description
   * @returns {Object} - Formatted findings object
   */
  formatFindings(profiles, context) {
    if (!profiles || profiles.length === 0) {
      return {
        summary: `Nenhum perfil LinkedIn encontrado para ${context}`,
        profiles: [],
        count: 0
      };
    }

    return {
      summary: `Encontrados ${profiles.length} perfis LinkedIn relevantes para ${context}`,
      profiles: profiles.slice(0, 10).map(p => ({
        name: p.name,
        title: p.title || p.headline,
        company: p.company,
        location: p.location,
        connectionDegree: p.connectionDegree,
        profileUrl: p.profileUrl
      })),
      count: profiles.length,
      hasMore: profiles.length > 10
    };
  }
}

// Singleton instance
const linkedinIntelService = new LinkedInIntelService();

module.exports = linkedinIntelService;
