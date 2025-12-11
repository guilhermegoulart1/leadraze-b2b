// backend/src/services/googleMapsAgentService.js
// Business logic for Google Maps agents - automated daily lead generation

const db = require('../config/database');
const serpApiClient = require('../config/serpapi');
const { googleMapsAgentQueue } = require('../queues');
const stripeService = require('./stripeService');
const billingService = require('./billingService');
const roundRobinService = require('./roundRobinService');
// DEPRECATED: googleMapsRotationService - now using centralized roundRobinService
// const googleMapsRotationService = require('./googleMapsRotationService');

class GoogleMapsAgentService {
  /**
   * Create a new Google Maps agent
   *
   * @param {Object} agentData - Agent configuration
   * @returns {Promise<Object>} - Created agent
   */
  async createAgent(agentData) {
    const {
      accountId,
      sectorId,
      userId,
      name,
      avatar_url,
      description,
      actionType = 'crm_only',
      // Search filters
      searchCountry = '',
      searchLocation,
      searchQuery,
      searchRadius,
      radius, // New: radius in km
      latitude, // New: precise latitude
      longitude, // New: precise longitude
      businessCategory, // New: Google category
      businessSpecification, // New: user specification
      minRating,
      minReviews,
      requirePhone = false,
      requireEmail = false,
      // Scheduling
      dailyLimit = 20,
      executionTime = '09:00'
    } = agentData;

    // Validation
    if (!searchLocation || !searchQuery) {
      throw new Error('Search location and query are required');
    }

    if (!accountId || !userId) {
      throw new Error('Account ID and User ID are required');
    }

    // Calculate next execution time (tomorrow at specified time)
    const nextExecution = this._calculateNextExecution(executionTime);

    // Convert radius from km to meters for backward compatibility
    const radiusInMeters = radius ? radius * 1000 : (searchRadius || 10000);

    const query = `
      INSERT INTO google_maps_agents (
        account_id, sector_id, user_id,
        name, avatar_url, description, status, action_type,
        search_country, search_location, search_query, search_radius,
        radius, latitude, longitude,
        business_category, business_specification,
        min_rating, min_reviews, require_phone, require_email,
        daily_limit, execution_time, next_execution_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      RETURNING *
    `;

    const values = [
      accountId,
      sectorId || null,
      userId,
      name,
      avatar_url || null,
      description || null,
      'active',
      actionType,
      searchCountry || '',
      searchLocation,
      searchQuery,
      radiusInMeters,
      radius || 10,
      latitude || null,
      longitude || null,
      businessCategory || null,
      businessSpecification || null,
      minRating || null,
      minReviews || null,
      requirePhone,
      requireEmail,
      dailyLimit,
      executionTime,
      nextExecution
    ];

    const result = await db.query(query, values);
    const agent = result.rows[0];

    console.log(`✅ Google Maps agent created: ${agent.id} - "${agent.name}"`);

    // Schedule job execution
    // 1. Execute IMMEDIATELY to get first 20 leads
    await googleMapsAgentQueue.add(
      {
        agentId: agent.id
      },
      {
        jobId: `agent-${agent.id}-initial`,
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    console.log(`🚀 Initial job scheduled for agent ${agent.id}`);

    // 2. Schedule REPEATABLE job every 24 hours
    await googleMapsAgentQueue.add(
      {
        agentId: agent.id
      },
      {
        jobId: `agent-${agent.id}-repeat`,
        repeat: {
          every: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
          limit: 365 // Max 365 executions (1 year)
        },
        removeOnComplete: true,
        removeOnFail: false
      }
    );
    console.log(`⏰ Repeatable job scheduled for agent ${agent.id} (every 24h)`);

    return agent;
  }

  /**
   * Get all agents for an account
   *
   * @param {string} accountId - Account ID
   * @param {Object} filters - Optional filters (sectorId, status)
   * @returns {Promise<Array>} - List of agents
   */
  async getAgents(accountId, filters = {}) {
    const { sectorId, status, userId } = filters;

    let query = `
      SELECT a.*,
             u.name as creator_name,
             u.email as creator_email,
             s.name as sector_name,
             s.color as sector_color,
             (SELECT COUNT(*) FROM google_maps_agent_assignees WHERE agent_id = a.id AND is_active = true) as assignee_count
      FROM google_maps_agents a
      LEFT JOIN users u ON a.user_id = u.id
      LEFT JOIN sectors s ON a.sector_id = s.id
      WHERE a.account_id = $1
    `;

    const values = [accountId];
    let paramCount = 1;

    if (sectorId) {
      paramCount++;
      query += ` AND a.sector_id = $${paramCount}`;
      values.push(sectorId);
    }

    if (status) {
      paramCount++;
      query += ` AND a.status = $${paramCount}`;
      values.push(status);
    }

    if (userId) {
      paramCount++;
      query += ` AND a.user_id = $${paramCount}`;
      values.push(userId);
    }

    query += ' ORDER BY a.created_at DESC';

    const result = await db.query(query, values);
    return result.rows;
  }

  /**
   * Get a single agent by ID
   *
   * @param {string} agentId - Agent ID
   * @param {string} accountId - Account ID (for security)
   * @returns {Promise<Object>} - Agent data
   */
  async getAgent(agentId, accountId) {
    const query = `
      SELECT a.*, u.name as creator_name, u.email as creator_email
      FROM google_maps_agents a
      LEFT JOIN users u ON a.user_id = u.id
      WHERE a.id = $1 AND a.account_id = $2
    `;

    const result = await db.query(query, [agentId, accountId]);

    if (result.rows.length === 0) {
      throw new Error('Agent not found');
    }

    return result.rows[0];
  }

  /**
   * Update an agent's configuration
   *
   * @param {string} agentId - Agent ID
   * @param {string} accountId - Account ID (for security)
   * @param {Object} updates - Fields to update
   * @returns {Promise<Object>} - Updated agent
   */
  async updateAgent(agentId, accountId, updates) {
    const { dailyLimit } = updates;

    // Validate dailyLimit is multiple of 20
    if (dailyLimit !== undefined && dailyLimit % 20 !== 0) {
      throw new Error('dailyLimit must be a multiple of 20');
    }

    // Build dynamic update query
    const fields = [];
    const values = [];
    let paramCount = 0;

    if (dailyLimit !== undefined) {
      paramCount++;
      fields.push(`daily_limit = $${paramCount}`);
      values.push(dailyLimit);
    }

    if (fields.length === 0) {
      throw new Error('No valid fields to update');
    }

    // Add updated_at
    paramCount++;
    fields.push(`updated_at = $${paramCount}`);
    values.push(new Date());

    // Add agentId and accountId for WHERE clause
    paramCount++;
    values.push(agentId);
    paramCount++;
    values.push(accountId);

    const query = `
      UPDATE google_maps_agents
      SET ${fields.join(', ')}
      WHERE id = $${paramCount - 1} AND account_id = $${paramCount}
      RETURNING *
    `;

    const result = await db.query(query, values);

    if (result.rows.length === 0) {
      throw new Error('Agent not found or unauthorized');
    }

    console.log(`✅ Google Maps agent updated: ${agentId} - daily_limit: ${dailyLimit}`);

    return result.rows[0];
  }

  /**
   * Execute an agent - fetch pages based on daily_limit and insert into CRM
   *
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} - Execution results
   */
  async executeAgent(agentId) {
    console.log(`🤖 Executing GMaps agent ${agentId}`);

    // Get agent data
    let agent = await this._getAgentById(agentId);

    // Check if agent is in a valid state to execute
    if (agent.status === 'paused') {
      console.log(`⏸️  Agent ${agentId} is paused - skipping execution`);
      return {
        success: false,
        leads_inserted: 0,
        leads_skipped: 0,
        pages_fetched: 0,
        status: 'paused',
        message: 'Agent is paused',
        reason: 'agent_paused'
      };
    }

    if (agent.status === 'completed') {
      console.log(`✅ Agent ${agentId} is already completed - skipping execution`);
      return {
        success: false,
        leads_inserted: 0,
        leads_skipped: 0,
        pages_fetched: 0,
        status: 'completed',
        message: 'Agent already completed',
        reason: 'agent_completed'
      };
    }

    // Calculate how many pages to fetch based on daily_limit
    const dailyLimit = agent.daily_limit || 20;
    const pagesToFetch = Math.ceil(dailyLimit / 20);

    console.log(`📊 Agent ${agentId}: daily_limit=${dailyLimit}, pages to fetch=${pagesToFetch}`);

    // Check initial credits before starting
    const hasAiCredits = await stripeService.hasEnoughAiCredits(agent.account_id, 1);
    if (!hasAiCredits) {
      return {
        success: false,
        leads_inserted: 0,
        leads_skipped: 0,
        pages_fetched: 0,
        status: 'paused',
        message: 'Insufficient AI credits',
        reason: 'insufficient_ai_credits'
      };
    }

    const hasGmapsCredits = await billingService.hasEnoughCredits(agent.account_id, 'gmaps', 1);
    if (!hasGmapsCredits) {
      return {
        success: false,
        leads_inserted: 0,
        leads_skipped: 0,
        pages_fetched: 0,
        status: 'paused',
        message: 'Insufficient GMaps credits',
        reason: 'insufficient_gmaps_credits'
      };
    }

    // If agent is completed or paused, reactivate it
    if (agent.status === 'completed' || agent.status === 'paused') {
      await this._updateAgentStatus(agentId, 'active');
      agent.status = 'active';
    }

    if (agent.status !== 'active') {
      throw new Error(`Cannot execute agent with status: ${agent.status}`);
    }

    // Build search query and location once (reused for all pages)
    const searchQuery = this._buildSearchQuery(agent);
    let location;
    if (agent.latitude && agent.longitude) {
      const radiusKm = agent.radius || (agent.search_radius ? agent.search_radius / 1000 : 14);
      const zoom = this._calculateZoomFromRadius(radiusKm);
      location = `@${agent.latitude},${agent.longitude},${zoom}z`;
    } else {
      location = agent.search_country
        ? `${agent.search_location}, ${agent.search_country}`
        : agent.search_location;
    }

    // Track totals across all pages
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalCreditsConsumed = 0;
    let pagesFetched = 0;
    let hasMoreResults = true;
    let lastPage = agent.current_page || 0;

    // Fetch multiple pages based on daily_limit
    for (let i = 0; i < pagesToFetch && hasMoreResults; i++) {
      // Check credits before each page
      const hasGmapsCreditsForPage = await billingService.hasEnoughCredits(agent.account_id, 'gmaps', 1);
      if (!hasGmapsCreditsForPage) {
        console.log(`⚠️ Agent ${agentId}: Stopped at page ${i + 1} - insufficient GMaps credits`);
        break;
      }

      const hasAiCreditsForPage = await stripeService.hasEnoughAiCredits(agent.account_id, 1);
      if (!hasAiCreditsForPage) {
        console.log(`⚠️ Agent ${agentId}: Stopped at page ${i + 1} - insufficient AI credits`);
        break;
      }

      // Calculate pagination offset for current page
      const currentPage = lastPage + i;
      const start = currentPage * 20;

      console.log(`📄 Agent ${agentId}: Fetching page ${currentPage + 1} (offset ${start})`);

      const searchResults = await serpApiClient.searchGoogleMaps({
        query: searchQuery,
        location: location,
        start: start
      });

      // Consume 1 GMaps credit for the search
      await billingService.consumeCredits(
        agent.account_id,
        'gmaps',
        1,
        {
          resourceType: 'google_maps_agent',
          resourceId: agent.id,
          userId: agent.user_id,
          description: `Google Maps search: "${searchQuery}" in ${location} (page ${currentPage + 1})`
        }
      );

      pagesFetched++;

      if (!searchResults.success || searchResults.total_results === 0) {
        hasMoreResults = false;
        console.log(`📭 Agent ${agentId}: No more results at page ${currentPage + 1}`);
        break;
      }

      // Filter results based on agent criteria
      const filteredPlaces = this._filterPlaces(searchResults.places, agent);

      // Insert into CRM
      const insertionResults = await this._insertPlacesIntoCRM(
        filteredPlaces,
        agent,
        currentPage
      );

      totalInserted += insertionResults.inserted;
      totalSkipped += insertionResults.skipped;
      totalCreditsConsumed += insertionResults.creditsConsumed || 0;

      // Update agent statistics after each page
      await this._updateAgentStats(agentId, {
        currentPage: currentPage + 1,
        leadsFound: searchResults.total_results,
        leadsInserted: insertionResults.inserted,
        leadsSkipped: insertionResults.skipped,
        apiCalls: 1,
        hasMoreResults: searchResults.pagination.has_next_page
      });

      hasMoreResults = searchResults.pagination.has_next_page;

      console.log(`✅ Agent ${agentId}: Page ${currentPage + 1} - +${insertionResults.inserted} leads`);

      // If there are more pages to fetch, add a small delay to avoid rate limiting
      if (i < pagesToFetch - 1 && hasMoreResults) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // If no more results available, mark as completed
    if (!hasMoreResults) {
      await this._updateAgentStatus(agentId, 'completed');
    }

    const finalPage = lastPage + pagesFetched;
    console.log(`🏁 Agent ${agentId}: Execution complete - ${pagesFetched} pages, ${totalInserted} leads inserted`);

    return {
      success: true,
      leads_inserted: totalInserted,
      leads_skipped: totalSkipped,
      credits_consumed: totalCreditsConsumed,
      pages_fetched: pagesFetched,
      current_page: finalPage,
      has_more_results: hasMoreResults,
      status: hasMoreResults ? 'active' : 'completed'
    };
  }

  /**
   * Pause an agent - also removes jobs from queue
   */
  async pauseAgent(agentId, accountId) {
    // Remove jobs from queue first
    try {
      // Remove repeatable jobs
      const repeatableJobs = await googleMapsAgentQueue.getRepeatableJobs();
      const agentJobs = repeatableJobs.filter(j => j.key.includes(agentId));

      for (const job of agentJobs) {
        await googleMapsAgentQueue.removeRepeatableByKey(job.key);
        console.log(`⏸️  Removed repeatable job: ${job.key}`);
      }

      // Remove pending/waiting/delayed jobs
      const jobs = await googleMapsAgentQueue.getJobs(['waiting', 'delayed']);
      const agentSpecificJobs = jobs.filter(j => j.data.agentId === agentId);

      for (const job of agentSpecificJobs) {
        await job.remove();
        console.log(`⏸️  Removed pending job: ${job.id}`);
      }
    } catch (error) {
      console.error(`⚠️  Error removing jobs for agent ${agentId}:`, error.message);
    }

    await this._updateAgentStatus(agentId, 'paused', accountId);
    console.log(`⏸️  Agent paused: ${agentId}`);
    return { success: true, status: 'paused' };
  }

  /**
   * Resume an agent - re-adds jobs to queue
   */
  async resumeAgent(agentId, accountId) {
    // Update status first
    await this._updateAgentStatus(agentId, 'active', accountId);

    // Re-add repeatable job to queue
    try {
      await googleMapsAgentQueue.add(
        { agentId },
        {
          jobId: `agent-${agentId}-repeat-${Date.now()}`,
          repeat: {
            every: 24 * 60 * 60 * 1000, // 24 hours
            limit: 365
          },
          removeOnComplete: true,
          removeOnFail: false
        }
      );
      console.log(`▶️  Repeatable job re-scheduled for agent ${agentId}`);
    } catch (error) {
      console.error(`⚠️  Error re-scheduling job for agent ${agentId}:`, error.message);
    }

    console.log(`▶️  Agent resumed: ${agentId}`);
    return { success: true, status: 'active' };
  }

  /**
   * Delete an agent
   */
  async deleteAgent(agentId, accountId) {
    // Remove jobs from queue first
    try {
      // Remove repeatable jobs
      const repeatableJobs = await googleMapsAgentQueue.getRepeatableJobs();
      const agentJobs = repeatableJobs.filter(j => j.key.includes(agentId));

      for (const job of agentJobs) {
        await googleMapsAgentQueue.removeRepeatableByKey(job.key);
        console.log(`🗑️  Removed repeatable job: ${job.key}`);
      }

      // Remove pending/waiting jobs
      const jobs = await googleMapsAgentQueue.getJobs(['waiting', 'delayed', 'active']);
      const agentSpecificJobs = jobs.filter(j => j.data.agentId === agentId);

      for (const job of agentSpecificJobs) {
        await job.remove();
        console.log(`🗑️  Removed job: ${job.id}`);
      }
    } catch (error) {
      console.error(`⚠️  Error removing jobs for agent ${agentId}:`, error.message);
    }

    // Delete agent from database
    const query = 'DELETE FROM google_maps_agents WHERE id = $1 AND account_id = $2';
    await db.query(query, [agentId, accountId]);
    console.log(`🗑️  Agent deleted: ${agentId}`);
    return { success: true };
  }

  /**
   * Get agents that need to be executed
   */
  async getAgentsToExecute() {
    const query = `
      SELECT * FROM google_maps_agents
      WHERE status = 'active'
        AND (next_execution_at IS NULL OR next_execution_at <= NOW())
      ORDER BY next_execution_at ASC NULLS FIRST
    `;

    const result = await db.query(query);
    return result.rows;
  }

  // ==========================================
  // PRIVATE HELPER METHODS
  // ==========================================

  /**
   * Get agent by ID (internal)
   */
  async _getAgentById(agentId) {
    const result = await db.query('SELECT * FROM google_maps_agents WHERE id = $1', [agentId]);

    if (result.rows.length === 0) {
      throw new Error('Agent not found');
    }

    return result.rows[0];
  }

  /**
   * Build search query from agent filters
   *
   * IMPORTANT: Don't add location to the query!
   * The location is already being passed via the 'location' parameter with GPS coordinates.
   * Query should be ONLY the business type (e.g., "gym", "dentist", "restaurant")
   */
  _buildSearchQuery(agent) {
    // Return only the search query (business type)
    // Location is handled separately via GPS coordinates in the 'location' parameter
    return agent.search_query;
  }

  /**
   * Calculate Google Maps zoom level from radius in kilometers
   * Zoom levels approximate coverage:
   * - zoom 15: ~1.5km radius
   * - zoom 14: ~3km radius
   * - zoom 13: ~6km radius
   * - zoom 12: ~12km radius
   * - zoom 11: ~25km radius
   * - zoom 10: ~50km radius
   */
  _calculateZoomFromRadius(radiusKm) {
    if (radiusKm <= 2) return 15;
    if (radiusKm <= 4) return 14;
    if (radiusKm <= 8) return 13;
    if (radiusKm <= 16) return 12;
    if (radiusKm <= 30) return 11;
    return 10; // For very large radius
  }

  /**
   * Filter places based on agent criteria
   */
  _filterPlaces(places, agent) {
    const filtered = places.filter(place => {
      // Filter by rating
      if (agent.min_rating && (!place.rating || place.rating < agent.min_rating)) {
        return false;
      }
      // Filter by review count
      if (agent.min_reviews && (!place.reviews || place.reviews < agent.min_reviews)) {
        return false;
      }
      // Filter by phone requirement
      if (agent.require_phone && !place.phone) {
        return false;
      }
      // Filter by email requirement (note: Google Maps rarely has emails)
      if (agent.require_email && !place.email) {
        return false;
      }
      return true;
    });

    return filtered;
  }

  /**
   * Insert places into CRM as contacts
   * Each lead inserted consumes 1 AI credit
   */
  async _insertPlacesIntoCRM(places, agent, pageNumber) {
    let inserted = 0;
    let skipped = 0;
    let creditsConsumed = 0;

    for (let i = 0; i < places.length; i++) {
      const place = places[i];

      try {
        const contactData = serpApiClient.normalizePlaceToContact(place);

        // Check if contact already exists (by place_id)
        const existingContact = await this._findContactByPlaceId(
          contactData.place_id,
          agent.account_id
        );

        if (existingContact) {
          skipped++;
          continue;
        }

        // Check if account has enough credits before inserting
        const hasCredits = await stripeService.hasEnoughAiCredits(agent.account_id, 1);
        if (!hasCredits) {
          break;
        }

        // Insert contact
        const contact = await this._insertContact(contactData, agent);

        // Link contact to agent
        await this._linkContactToAgent(agent.id, contact.id, pageNumber, i + 1);

        // Consume 1 credit for the lead inserted
        await stripeService.consumeAiCredits(
          agent.account_id,
          1,
          agent.id,
          null,
          agent.user_id,
          `Google Maps lead: ${contactData.name}`
        );
        creditsConsumed++;

        // Auto-assign to user using centralized round-robin service
        try {
          await roundRobinService.autoAssignLeadOnCreation({
            leadId: contact.lead_id,
            sectorId: agent.sector_id,
            accountId: agent.account_id,
            campaignId: null,
            source: 'google_maps'
          });
        } catch (rotationError) {
          // Don't fail the insertion if rotation fails
        }

        inserted++;
      } catch (error) {
        skipped++;
      }
    }

    return { inserted, skipped, creditsConsumed };
  }

  /**
   * Find contact by place_id
   */
  async _findContactByPlaceId(placeId, accountId) {
    const query = 'SELECT id FROM contacts WHERE place_id = $1 AND account_id = $2';
    const result = await db.query(query, [placeId, accountId]);
    return result.rows.length > 0 ? result.rows[0] : null;
  }

  /**
   * Insert contact into database and create associated lead
   */
  async _insertContact(contactData, agent) {
    // 1. Create CONTACT (person/business)
    const contactQuery = `
      INSERT INTO contacts (
        account_id, sector_id, user_id,
        place_id, data_cid, google_maps_url,
        name, company, phone, email,
        location, headline, about,
        custom_fields,
        source, last_interaction_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
      )
      RETURNING *
    `;

    const customFields = {
      rating: contactData.rating,
      review_count: contactData.review_count,
      business_category: contactData.business_category,
      business_types: contactData.business_types,
      price_level: contactData.price_level,
      opening_hours: contactData.opening_hours,
      service_options: contactData.service_options,
      photos: contactData.photos,
      address: contactData.address,
      latitude: contactData.latitude,
      longitude: contactData.longitude
    };

    const contactValues = [
      agent.account_id,
      agent.sector_id,
      agent.user_id,
      contactData.place_id,
      contactData.data_cid,
      contactData.google_maps_url,
      contactData.name,
      contactData.company,
      contactData.phone,
      contactData.email,
      contactData.location || contactData.address,
      contactData.headline,
      contactData.about,
      JSON.stringify(customFields),
      contactData.source,
      new Date()
    ];

    const contactResult = await db.query(contactQuery, contactValues);
    const contact = contactResult.rows[0];

    // 2. Create LEAD (sales opportunity)
    const leadQuery = `
      INSERT INTO leads (
        account_id, sector_id,
        campaign_id,
        linkedin_profile_id,
        name, company, location,
        profile_picture,
        status, score,
        source
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
      )
      RETURNING *
    `;

    // Extract thumbnail from photos array (first photo)
    const profilePicture = contactData.photos && contactData.photos.length > 0
      ? contactData.photos[0]
      : null;

    const leadValues = [
      agent.account_id,
      agent.sector_id,
      null, // No campaign for Google Maps agents
      contactData.place_id, // Use place_id as unique identifier
      contactData.name,
      contactData.company,
      contactData.location || contactData.address,
      profilePicture, // Thumbnail from Google Maps
      'leads', // Default status (valid value from check_status constraint)
      0, // Default score
      'google_maps' // Source
    ];

    const leadResult = await db.query(leadQuery, leadValues);
    const lead = leadResult.rows[0];

    // 3. Link CONTACT to LEAD via contact_leads
    const linkQuery = `
      INSERT INTO contact_leads (
        contact_id, lead_id, role
      ) VALUES ($1, $2, $3)
      ON CONFLICT (contact_id, lead_id) DO NOTHING
    `;

    await db.query(linkQuery, [contact.id, lead.id, 'primary']);

    // Return contact with lead_id attached
    return {
      ...contact,
      lead_id: lead.id
    };
  }

  /**
   * Link contact to agent in junction table
   */
  async _linkContactToAgent(agentId, contactId, pageNumber, position) {
    const query = `
      INSERT INTO google_maps_agent_contacts (
        agent_id, contact_id, page_number, position, inserted_to_crm
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (agent_id, contact_id) DO NOTHING
    `;

    await db.query(query, [agentId, contactId, pageNumber, position, true]);
  }

  /**
   * Update agent statistics after execution
   */
  async _updateAgentStats(agentId, stats) {
    const {
      currentPage,
      leadsFound,
      leadsInserted,
      leadsSkipped,
      apiCalls,
      hasMoreResults
    } = stats;

    // Calculate next execution (24 hours from now)
    const nextExecution = new Date();
    nextExecution.setHours(nextExecution.getHours() + 24);

    const newStatus = hasMoreResults ? 'active' : 'completed';

    const query = `
      UPDATE google_maps_agents
      SET
        current_page = $2,
        last_page_fetched = $3,
        total_leads_found = total_leads_found + $4,
        leads_inserted = leads_inserted + $5,
        leads_skipped = leads_skipped + $6,
        total_api_calls = total_api_calls + $7,
        estimated_cost = total_api_calls * 0.00275,
        last_fetch_at = NOW(),
        last_execution_at = NOW(),
        next_execution_at = $8,
        status = $9,
        updated_at = NOW()
      WHERE id = $1
    `;

    const values = [
      agentId,
      currentPage,
      currentPage - 1,
      leadsFound,
      leadsInserted,
      leadsSkipped,
      apiCalls,
      hasMoreResults ? nextExecution : null,
      newStatus
    ];

    await db.query(query, values);
  }

  /**
   * Update agent status
   */
  async _updateAgentStatus(agentId, status, accountId = null) {
    let query = 'UPDATE google_maps_agents SET status = $1, updated_at = NOW() WHERE id = $2';
    const values = [status, agentId];

    if (accountId) {
      query += ' AND account_id = $3';
      values.push(accountId);
    }

    await db.query(query, values);
  }

  /**
   * Calculate next execution time
   */
  _calculateNextExecution(executionTime) {
    const [hours, minutes] = executionTime.split(':').map(Number);

    const nextExec = new Date();
    nextExec.setHours(hours, minutes, 0, 0);

    // If time has passed today, schedule for tomorrow
    if (nextExec <= new Date()) {
      nextExec.setDate(nextExec.getDate() + 1);
    }

    return nextExec;
  }

  /**
   * Get all contacts found by an agent (for CSV export)
   * @param {string} agentId - Agent UUID
   * @param {string} accountId - Account UUID for multi-tenancy
   * @returns {Array} List of contacts with all Google Maps data
   */
  async getAgentContacts(agentId, accountId) {
    const query = `
      SELECT
        c.name,
        c.email,
        c.phone,
        c.company,
        c.address,
        c.city,
        c.state,
        c.country,
        c.website,
        c.rating,
        c.review_count,
        c.business_category,
        c.google_maps_url,
        c.latitude,
        c.longitude,
        gac.fetched_at,
        gac.page_number
      FROM google_maps_agent_contacts gac
      INNER JOIN contacts c ON c.id = gac.contact_id
      INNER JOIN google_maps_agents gma ON gma.id = gac.agent_id
      WHERE gac.agent_id = $1 AND gma.account_id = $2
      ORDER BY gac.fetched_at DESC
    `;
    const result = await db.query(query, [agentId, accountId]);
    return result.rows;
  }
}

module.exports = new GoogleMapsAgentService();
