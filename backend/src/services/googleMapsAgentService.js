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
   * Execute an agent - fetch next page and insert into CRM
   *
   * @param {string} agentId - Agent ID
   * @returns {Promise<Object>} - Execution results
   */
  async executeAgent(agentId) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🤖 EXECUTING GOOGLE MAPS AGENT: ${agentId}`);
    console.log(`${'='.repeat(60)}`);

    // Get agent data
    const agent = await this._getAgentById(agentId);

    console.log(`\n📋 === AGENT CONFIGURATION ===`);
    console.log(`   Name: ${agent.name}`);
    console.log(`   Search Query: ${agent.search_query}`);
    console.log(`   Location: ${agent.search_location}`);
    console.log(`   Country: ${agent.search_country || 'N/A'}`);
    console.log(`   Radius: ${agent.radius || agent.search_radius}${agent.radius ? 'km' : 'm'}`);
    console.log(`   Coordinates: ${agent.latitude}, ${agent.longitude}`);
    console.log(`   Min Rating: ${agent.min_rating || 'None'}`);
    console.log(`   Min Reviews: ${agent.min_reviews || 'None'}`);
    console.log(`   Require Phone: ${agent.require_phone}`);
    console.log(`   Require Email: ${agent.require_email} ${agent.require_email ? '(⚠️ WARNING: Google Maps rarely provides emails!)' : ''}`);
    console.log(`   Daily Limit: ${agent.daily_limit}`);
    console.log(`   Current Page: ${agent.current_page || 0}`);
    console.log(`==============================\n`);

    // Check if account has AI credits before executing
    const hasAiCredits = await stripeService.hasEnoughAiCredits(agent.account_id, 1);
    if (!hasAiCredits) {
      console.log(`⚠️  Insufficient AI credits for account ${agent.account_id}. Skipping execution.`);
      return {
        success: false,
        leads_inserted: 0,
        leads_skipped: 0,
        status: 'paused',
        message: 'Insufficient AI credits',
        reason: 'insufficient_ai_credits'
      };
    }

    // Check if account has GMaps credits for the search
    const hasGmapsCredits = await billingService.hasEnoughCredits(agent.account_id, 'gmaps', 1);
    if (!hasGmapsCredits) {
      console.log(`⚠️  Insufficient GMaps credits for account ${agent.account_id}. Skipping execution.`);
      return {
        success: false,
        leads_inserted: 0,
        leads_skipped: 0,
        status: 'paused',
        message: 'Insufficient GMaps credits',
        reason: 'insufficient_gmaps_credits'
      };
    }

    // If agent is completed or paused, reactivate it
    if (agent.status === 'completed' || agent.status === 'paused') {
      console.log(`🔄 Reactivating agent from status: ${agent.status}`);
      await this._updateAgentStatus(agentId, 'active');
      agent.status = 'active';
    }

    if (agent.status !== 'active') {
      throw new Error(`Cannot execute agent with status: ${agent.status}`);
    }

    // Calculate pagination offset
    const currentPage = agent.current_page || 0;
    const start = currentPage * 20;

    console.log(`📄 Fetching page ${currentPage} (start: ${start})`);

    // Build search query
    const searchQuery = this._buildSearchQuery(agent);

    // Build location parameter (prefer lat/lng if available)
    let location;
    if (agent.latitude && agent.longitude) {
      // Calculate zoom level based on radius
      // Note: search_radius is in METERS (legacy), radius is in KM (new)
      const radiusKm = agent.radius || (agent.search_radius ? agent.search_radius / 1000 : 14);
      const zoom = this._calculateZoomFromRadius(radiusKm);

      // Use coordinates format: "@lat,lng,zoom"
      location = `@${agent.latitude},${agent.longitude},${zoom}z`;
      console.log(`📍 Using radius: ${radiusKm}km → zoom: ${zoom}`);
    } else {
      // Fallback to location string
      location = agent.search_country
        ? `${agent.search_location}, ${agent.search_country}`
        : agent.search_location;
    }

    console.log(`📍 Using location: ${location}`);

    // Fetch from SerpApi
    console.log(`\n🔍 === SERPAPI REQUEST ===`);
    console.log(`   Query: "${searchQuery}"`);
    console.log(`   Location: "${location}"`);
    console.log(`   Start: ${start}`);

    const searchResults = await serpApiClient.searchGoogleMaps({
      query: searchQuery,
      location: location,
      start: start
    });

    // Consume 1 GMaps credit for the search (charged per API call)
    const gmapsConsumed = await billingService.consumeCredits(
      agent.account_id,
      'gmaps',
      1,
      {
        resourceType: 'google_maps_agent',
        resourceId: agent.id,
        userId: agent.user_id,
        description: `Google Maps search: "${searchQuery}" in ${location} (page ${currentPage})`
      }
    );

    if (gmapsConsumed) {
      console.log(`💳 Consumed 1 GMaps credit for search (page ${currentPage})`);
    } else {
      console.log(`⚠️  Failed to consume GMaps credit - continuing anyway`);
    }

    console.log(`\n📊 === SERPAPI RESPONSE ===`);
    console.log(`   Success: ${searchResults.success}`);
    console.log(`   Total results: ${searchResults.total_results}`);
    console.log(`   Has next page: ${searchResults.pagination?.has_next_page}`);

    // Log raw place data to see what fields are available
    if (searchResults.places && searchResults.places.length > 0) {
      console.log(`\n📋 === RAW PLACE DATA (first result) ===`);
      const firstPlace = searchResults.places[0];
      console.log(`   title: ${firstPlace.title}`);
      console.log(`   address: ${firstPlace.address}`);
      console.log(`   phone: ${firstPlace.phone || 'N/A'}`);
      console.log(`   email: ${firstPlace.email || 'N/A'}`);
      console.log(`   website: ${firstPlace.website || 'N/A'}`);
      console.log(`   rating: ${firstPlace.rating}`);
      console.log(`   reviews: ${firstPlace.reviews}`);
      console.log(`   place_id: ${firstPlace.place_id}`);
      console.log(`   type: ${firstPlace.type}`);
      console.log(`   All available fields: ${Object.keys(firstPlace).join(', ')}`);
      console.log(`===================================\n`);
    }

    if (!searchResults.success || searchResults.total_results === 0) {
      console.log(`⚠️  No results found for page ${currentPage}. Marking agent as completed.`);

      await this._updateAgentStatus(agentId, 'completed');

      return {
        success: true,
        leads_inserted: 0,
        leads_skipped: 0,
        status: 'completed',
        message: 'No more results available'
      };
    }

    // Filter results based on agent criteria
    const filteredPlaces = this._filterPlaces(searchResults.places, agent);

    console.log(`🔍 Found ${searchResults.total_results} places, ${filteredPlaces.length} after filtering`);

    // Insert into CRM
    const insertionResults = await this._insertPlacesIntoCRM(
      filteredPlaces,
      agent,
      currentPage
    );

    // Update agent statistics
    await this._updateAgentStats(agentId, {
      currentPage: currentPage + 1,
      leadsFound: searchResults.total_results,
      leadsInserted: insertionResults.inserted,
      leadsSkipped: insertionResults.skipped,
      apiCalls: 1,
      hasMoreResults: searchResults.pagination.has_next_page
    });

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ AGENT EXECUTION COMPLETED: ${agentId}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`   📊 API Results: ${searchResults.total_results} places from SerpApi`);
    console.log(`   🔍 After Filters: ${filteredPlaces.length} places passed filters`);
    console.log(`   ✅ Inserted to CRM: ${insertionResults.inserted}`);
    console.log(`   ⏭️  Skipped: ${insertionResults.skipped}`);
    console.log(`   💰 Credits Consumed: ${insertionResults.creditsConsumed || 0}`);
    console.log(`   📄 Current Page: ${currentPage + 1}`);
    console.log(`   ➡️  Has More Results: ${searchResults.pagination.has_next_page}`);
    console.log(`${'='.repeat(60)}\n`);

    return {
      success: true,
      leads_inserted: insertionResults.inserted,
      leads_skipped: insertionResults.skipped,
      credits_consumed: insertionResults.creditsConsumed || 0,
      current_page: currentPage + 1,
      has_more_results: searchResults.pagination.has_next_page
    };
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId, accountId) {
    await this._updateAgentStatus(agentId, 'paused', accountId);
    console.log(`⏸️  Agent paused: ${agentId}`);
    return { success: true, status: 'paused' };
  }

  /**
   * Resume an agent
   */
  async resumeAgent(agentId, accountId) {
    await this._updateAgentStatus(agentId, 'active', accountId);
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
    console.log(`\n📊 === FILTER DEBUG (Agent: ${agent.id}) ===`);
    console.log(`📥 Total places received from API: ${places.length}`);
    console.log(`🔧 Agent filters: min_rating=${agent.min_rating}, min_reviews=${agent.min_reviews}, require_phone=${agent.require_phone}, require_email=${agent.require_email}`);

    let filteredByRating = 0;
    let filteredByReviews = 0;
    let filteredByPhone = 0;
    let filteredByEmail = 0;

    const filtered = places.filter(place => {
      // Filter by rating
      if (agent.min_rating && (!place.rating || place.rating < agent.min_rating)) {
        filteredByRating++;
        console.log(`   ❌ [Rating] "${place.title}" - rating: ${place.rating || 'N/A'} < min: ${agent.min_rating}`);
        return false;
      }

      // Filter by review count
      if (agent.min_reviews && (!place.reviews || place.reviews < agent.min_reviews)) {
        filteredByReviews++;
        console.log(`   ❌ [Reviews] "${place.title}" - reviews: ${place.reviews || 0} < min: ${agent.min_reviews}`);
        return false;
      }

      // Filter by phone requirement
      if (agent.require_phone && !place.phone) {
        filteredByPhone++;
        console.log(`   ❌ [Phone] "${place.title}" - no phone number`);
        return false;
      }

      // Filter by email requirement (note: Google Maps rarely has emails)
      if (agent.require_email && !place.email) {
        filteredByEmail++;
        console.log(`   ❌ [Email] "${place.title}" - no email (⚠️ Google Maps rarely provides emails!)`);
        return false;
      }

      console.log(`   ✅ PASSED: "${place.title}" (rating: ${place.rating}, reviews: ${place.reviews}, phone: ${place.phone ? 'yes' : 'no'})`);
      return true;
    });

    console.log(`\n📊 === FILTER SUMMARY ===`);
    console.log(`   📥 Total input: ${places.length}`);
    console.log(`   ❌ Filtered by rating: ${filteredByRating}`);
    console.log(`   ❌ Filtered by reviews: ${filteredByReviews}`);
    console.log(`   ❌ Filtered by phone: ${filteredByPhone}`);
    console.log(`   ❌ Filtered by email: ${filteredByEmail}`);
    console.log(`   ✅ Passed filters: ${filtered.length}`);
    console.log(`===========================\n`);

    return filtered;
  }

  /**
   * Insert places into CRM as contacts
   * Each lead inserted consumes 1 AI credit
   */
  async _insertPlacesIntoCRM(places, agent, pageNumber) {
    console.log(`\n📥 === CRM INSERTION DEBUG (Agent: ${agent.id}, Page: ${pageNumber}) ===`);
    console.log(`📋 Places to insert: ${places.length}`);

    let inserted = 0;
    let skipped = 0;
    let skippedDuplicate = 0;
    let skippedNoCredits = 0;
    let skippedError = 0;
    let creditsConsumed = 0;

    for (let i = 0; i < places.length; i++) {
      const place = places[i];

      try {
        // Normalize place data to contact format
        const contactData = serpApiClient.normalizePlaceToContact(place);

        console.log(`\n🔄 [${i + 1}/${places.length}] Processing: "${contactData.name}"`);
        console.log(`   📍 Address: ${contactData.address}`);
        console.log(`   📞 Phone: ${contactData.phone || 'N/A'}`);
        console.log(`   📧 Email: ${contactData.email || 'N/A (⚠️ SerpApi/Google Maps não fornece emails)'}`);
        console.log(`   ⭐ Rating: ${contactData.rating || 'N/A'}, Reviews: ${contactData.review_count || 0}`);
        console.log(`   🆔 Place ID: ${contactData.place_id}`);

        // Check if contact already exists (by place_id)
        const existingContact = await this._findContactByPlaceId(
          contactData.place_id,
          agent.account_id
        );

        if (existingContact) {
          console.log(`   ⏭️  SKIPPED: Duplicate (place_id already exists in CRM)`);
          skipped++;
          skippedDuplicate++;
          continue;
        }

        // Check if account has enough credits before inserting
        const hasCredits = await stripeService.hasEnoughAiCredits(agent.account_id, 1);
        if (!hasCredits) {
          console.log(`   ⚠️  STOPPED: Insufficient credits for account ${agent.account_id}`);
          skippedNoCredits++;
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
          null, // no conversation
          agent.user_id,
          `Google Maps lead: ${contactData.name}`
        );
        creditsConsumed++;

        // Auto-assign to user using centralized round-robin service
        try {
          const assignment = await roundRobinService.autoAssignLeadOnCreation({
            leadId: contact.lead_id,
            sectorId: agent.sector_id,
            accountId: agent.account_id,
            campaignId: null, // Google Maps agents don't use campaigns
            source: 'google_maps'
          });

          if (assignment.assigned) {
            console.log(`   👤 ASSIGNED: Lead assigned to ${assignment.user.name} (method: ${assignment.method})`);
          } else {
            console.log(`   ⚠️  ASSIGNMENT: ${assignment.reason || 'No assignment method available'}`);
          }
        } catch (rotationError) {
          // Don't fail the insertion if rotation fails
          console.log(`   ⚠️  ROTATION ERROR: ${rotationError.message}`);
        }

        inserted++;
        console.log(`   ✅ INSERTED: ${contactData.name} (1 credit consumed)`);

      } catch (error) {
        console.error(`   ❌ ERROR inserting "${place.title}":`, error.message);
        skipped++;
        skippedError++;
      }
    }

    console.log(`\n📊 === CRM INSERTION SUMMARY ===`);
    console.log(`   📥 Total input: ${places.length}`);
    console.log(`   ✅ Inserted: ${inserted}`);
    console.log(`   ⏭️  Skipped (total): ${skipped}`);
    console.log(`      - Duplicates: ${skippedDuplicate}`);
    console.log(`      - No credits: ${skippedNoCredits}`);
    console.log(`      - Errors: ${skippedError}`);
    console.log(`   💰 Credits consumed: ${creditsConsumed}`);
    console.log(`================================\n`);

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
}

module.exports = new GoogleMapsAgentService();
