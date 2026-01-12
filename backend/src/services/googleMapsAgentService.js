// backend/src/services/googleMapsAgentService.js
// Business logic for Google Maps agents - automated daily lead generation

const db = require('../config/database');
const serpApiClient = require('../config/serpapi');
const { googleMapsAgentQueue } = require('../queues');
const stripeService = require('./stripeService');
const billingService = require('./billingService');
const roundRobinService = require('./roundRobinService');
const emailScraperService = require('./emailScraperService');
const ablyService = require('./ablyService');
const cnpjService = require('./intelligence/cnpjService');
const notificationService = require('./notificationService');

// Publish progress via Ably
const publishGmapsProgress = (data) => {
  ablyService.publishGmapsAgentProgress(data);
};
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
      radius, // radius in km
      latitude, // precise latitude
      longitude, // precise longitude
      searchType = 'radius', // 'radius', 'city', 'region', 'state', 'country'
      businessCategory, // Google category
      businessSpecification, // user specification
      minRating,
      minReviews,
      // Multiple locations support
      searchLocations = [], // Array of locations [{lat, lng, radius, location, city, country, searchType}]
      locationDistribution = 'proportional', // 'proportional' or 'sequential'
      // CRM insertion mode
      insertInCrm = true, // true = insert in CRM, false = just generate list
      // Scheduling
      dailyLimit = 20, // null = unlimited (capped at 2000)
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
        radius, latitude, longitude, search_type,
        business_category, business_specification,
        min_rating, min_reviews,
        search_locations, location_distribution,
        insert_in_crm,
        daily_limit, execution_time, next_execution_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
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
      searchType,
      businessCategory || null,
      businessSpecification || null,
      minRating || null,
      minReviews || null,
      JSON.stringify(searchLocations),
      locationDistribution,
      insertInCrm,
      dailyLimit, // Can be null for unlimited
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

    // Send notification that campaign started (only to creator)
    try {
      await notificationService.notifyGmapsCampaignStarted({
        accountId: agent.account_id,
        userId: agent.user_id,
        agentId: agent.id,
        agentName: agent.name
      });
    } catch (notifError) {
      console.error(`⚠️ Failed to send start notification:`, notifError.message);
    }

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
    // null = unlimited (will fetch until no more results, with a very high safety cap)
    const dailyLimit = agent.daily_limit === null ? 50000 : (agent.daily_limit || 20);
    const pagesToFetch = Math.ceil(dailyLimit / 20);
    const isUnlimited = agent.daily_limit === null;

    console.log(`📊 Agent ${agentId}: daily_limit=${agent.daily_limit === null ? 'unlimited' : dailyLimit}, pages to fetch=${pagesToFetch}${isUnlimited ? ' (or until no more results)' : ''}`);

    // Check initial GMaps credits before starting (only GMaps credits needed for this agent)
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

    // If agent is completed, paused or in_progress, reactivate it
    if (agent.status === 'completed' || agent.status === 'paused' || agent.status === 'in_progress') {
      await this._updateAgentStatus(agentId, 'active');
      agent.status = 'active';
    }

    if (agent.status !== 'active') {
      throw new Error(`Cannot execute agent with status: ${agent.status}`);
    }

    // Build search query (reused for all pages)
    const searchQuery = this._buildSearchQuery(agent);

    // ========================================
    // MULTIPLE LOCATIONS SUPPORT
    // ========================================
    const searchLocations = agent.search_locations || [];
    const hasMultipleLocations = searchLocations.length > 0;
    const locationDistribution = agent.location_distribution || 'proportional';

    let locationsToProcess = [];

    if (hasMultipleLocations) {
      // Multiple locations mode
      if (locationDistribution === 'sequential') {
        // SEQUENTIAL: Process one location at a time until exhausted
        const currentLocationIndex = agent.current_location_index || 0;

        // Get current location
        if (currentLocationIndex < searchLocations.length) {
          const currentLoc = searchLocations[currentLocationIndex];
          locationsToProcess = [{
            ...currentLoc,
            index: currentLocationIndex,
            pagesToFetch: pagesToFetch // Fetch all pages for this location
          }];
          console.log(`📍 Sequential mode: Processing location ${currentLocationIndex + 1}/${searchLocations.length} (${currentLoc.location || currentLoc.city})`);
        } else {
          // All locations exhausted
          console.log(`✅ All locations in sequential mode have been exhausted`);
          return {
            success: true,
            leads_inserted: 0,
            leads_skipped: 0,
            duplicates_found: 0,
            compensation_pages: 0,
            credits_consumed: 0,
            pages_fetched: 0,
            current_page: 0,
            has_more_results: false,
            status: 'completed'
          };
        }
      } else {
        // PROPORTIONAL: Distribute leads across all locations
        const leadsPerLocation = Math.ceil(dailyLimit / searchLocations.length);
        const pagesPerLocation = Math.ceil(leadsPerLocation / 20);

        console.log(`📍 Proportional mode: ${pagesPerLocation} pages per location across ${searchLocations.length} locations`);

        locationsToProcess = searchLocations.map((loc, index) => ({
          ...loc,
          index,
          pagesToFetch: pagesPerLocation
        }));
      }
    } else {
      // Single location mode (backward compatibility)
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

      locationsToProcess = [{
        location,
        latitude: agent.latitude,
        longitude: agent.longitude,
        radius: agent.radius,
        searchType: agent.search_type || 'radius',
        index: 0,
        pagesToFetch: pagesToFetch
      }];
    }

    // Track totals across all pages AND all locations
    let totalInserted = 0;
    let totalSkipped = 0;
    let totalDuplicates = 0;
    let totalCreditsConsumed = 0;
    let pagesFetched = 0;
    let stoppedDueToCredits = false; // Track if we stopped due to insufficient credits
    let allLocationsExhausted = true; // Track if all locations have been fully exhausted
    const executionLogs = [];

    // ========================================
    // PROCESS EACH LOCATION
    // ========================================
    for (const locationConfig of locationsToProcess) {
      const { location: locName, latitude, longitude, radius, searchType, index: locationIndex, pagesToFetch: pagesForThisLocation } = locationConfig;

      // Build location string for this specific location
      let location;
      const locSearchType = searchType || agent.search_type || 'radius';

      // For area-based searches (city, state, country), use name-based location
      if (locSearchType !== 'radius' && locName) {
        location = locName;
      } else if (latitude && longitude) {
        // For radius-based searches, use coordinate+zoom format
        const radiusKm = radius || 14;
        const zoom = this._calculateZoomFromRadius(radiusKm);
        location = `@${latitude},${longitude},${zoom}z`;
      } else {
        // Fallback to name if available
        location = locName || `${locationConfig.city}, ${locationConfig.country}`;
      }

      console.log(`\n📍 Processing location ${locationIndex + 1}/${locationsToProcess.length}: ${location}`);

      // Track state for THIS location
      let hasMoreResults = true;
      let lastPage = locationConfig.current_page || agent.current_page || 0;

      // DUPLICATE COMPENSATION: Track how many duplicates we found to fetch extra pages
      let duplicatesThisRun = 0;
      let compensationPagesNeeded = 0;

      // Fetch multiple pages for THIS location
      for (let i = 0; i < pagesForThisLocation + compensationPagesNeeded && hasMoreResults; i++) {
      // Check credits before each page
      const hasGmapsCreditsForPage = await billingService.hasEnoughCredits(agent.account_id, 'gmaps', 1);
      if (!hasGmapsCreditsForPage) {
        console.log(`⚠️ Agent ${agentId}: Stopped at page ${i + 1} - insufficient GMaps credits`);
        stoppedDueToCredits = true;
        break;
      }

      // Calculate pagination offset for current page
      const currentPage = lastPage + i;
      const start = currentPage * 20;

      console.log(`📄 Agent ${agentId}: Fetching page ${currentPage + 1} (offset ${start})`);

      // Emit gamified status: Searching
      publishGmapsProgress({
        accountId: agent.account_id,
        agentId,
        status: 'collecting',
        step: 'searching',
        stepLabel: 'Buscando resultados no Google Maps...',
        leadsFound: totalInserted + totalSkipped,
        leadsInserted: totalInserted,
        page: currentPage + 1
      });

      const searchResults = await serpApiClient.searchGoogleMaps({
        query: searchQuery,
        location: location,
        start: start
      });

      // Save execution log with SERPAPI raw data INCLUDING places for debugging
      const pageLog = {
        timestamp: new Date().toISOString(),
        page: currentPage + 1,
        offset: start,
        query: searchQuery,
        location: location,
        results_count: searchResults.total_results,
        places_returned: searchResults.places?.length || 0,
        pagination: searchResults.pagination,
        raw_serpapi_pagination: searchResults.raw_serpapi_pagination,
        raw_search_information: searchResults.raw_search_information,
        search_metadata: searchResults.search_metadata,
        // Include places data for debugging (with key fields only to save space)
        places: searchResults.places?.map(p => ({
          title: p.title,
          place_id: p.place_id,
          rating: p.rating,
          reviews: p.reviews,
          phone: p.phone,
          website: p.website,
          address: p.address,
          type: p.type
        })) || []
      };
      executionLogs.push(pageLog);

      // Note: Credits are consumed per lead inserted, not per page fetched
      // This is handled in _insertContact() method

      pagesFetched++;

      // Check if this page returned no results (campaign exhausted)
      if (!searchResults.success || !searchResults.places || searchResults.places.length === 0) {
        hasMoreResults = false;
        console.log(`📭 Agent ${agentId}: No more results at page ${currentPage + 1} - campaign exhausted`);
        break;
      }

      // Emit gamified status: Filtering
      publishGmapsProgress({
        accountId: agent.account_id,
        agentId,
        status: 'collecting',
        step: 'filtering',
        stepLabel: 'Filtrando resultados...',
        leadsFound: totalInserted + totalSkipped + searchResults.total_results,
        leadsInserted: totalInserted,
        page: currentPage + 1
      });

      // Filter results based on agent criteria
      const filteredPlaces = this._filterPlaces(searchResults.places, agent);

      // Emit gamified status: Enriching (if places have websites)
      const placesWithWebsite = filteredPlaces.filter(p => p.website);
      if (placesWithWebsite.length > 0) {
        publishGmapsProgress({
          accountId: agent.account_id,
          agentId,
          status: 'collecting',
          step: 'enriching',
          stepLabel: `Analisando ${placesWithWebsite.length} sites com IA...`,
          leadsFound: totalInserted + totalSkipped + searchResults.total_results,
          leadsInserted: totalInserted,
          page: currentPage + 1
        });
      }

      // Insert into CRM (pass running totals for accurate progress tracking)
      const insertionResults = await this._insertPlacesIntoCRM(
        filteredPlaces,
        agent,
        currentPage,
        { inserted: totalInserted, skipped: totalSkipped }
      );

      totalInserted += insertionResults.inserted;
      totalSkipped += insertionResults.skipped;
      totalDuplicates += insertionResults.duplicates || 0;
      totalCreditsConsumed += insertionResults.creditsConsumed || 0;

      // DUPLICATE COMPENSATION: Calculate if we need extra pages
      // If we found duplicates in this page, we need to fetch more pages to compensate
      if (insertionResults.duplicates > 0) {
        duplicatesThisRun += insertionResults.duplicates;

        // Calculate how many extra pages we need (20 leads per page)
        const extraPagesNeeded = Math.ceil(duplicatesThisRun / 20);

        // Only add compensation pages if we haven't already compensated
        if (extraPagesNeeded > compensationPagesNeeded) {
          compensationPagesNeeded = extraPagesNeeded;
          console.log(`🔄 Duplicate compensation: ${duplicatesThisRun} duplicates found, adding ${extraPagesNeeded} extra page(s)`);
        }
      }

      // Emit gamified status: Saving
      publishGmapsProgress({
        accountId: agent.account_id,
        agentId,
        status: 'collecting',
        step: 'saving',
        stepLabel: `Salvando ${insertionResults.inserted} leads no CRM...`,
        leadsFound: totalInserted + totalSkipped,
        leadsInserted: totalInserted,
        page: currentPage + 1
      });

      // Update agent statistics after each page
      // Use places.length (actual leads returned this page), not total_results (API total)
      await this._updateAgentStats(agentId, {
        currentPage: currentPage + 1,
        leadsFound: searchResults.places?.length || 0,
        leadsInserted: insertionResults.inserted,
        leadsSkipped: insertionResults.skipped,
        duplicatesFound: insertionResults.duplicates || 0,
        apiCalls: 1,
        hasMoreResults: searchResults.pagination.has_next_page
      }, agent.account_id);

      hasMoreResults = searchResults.pagination.has_next_page;

      // Track if any location still has results to fetch
      if (hasMoreResults) {
        allLocationsExhausted = false;
      }

      console.log(`✅ Agent ${agentId}: Page ${currentPage + 1} - +${insertionResults.inserted} leads`);

      // If there are more pages to fetch, add a small delay to avoid rate limiting
      if (i < pagesForThisLocation - 1 && hasMoreResults) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    } // End of pages loop for this location

      // Update location state after processing
      if (hasMultipleLocations && locationDistribution === 'sequential') {
        // SEQUENTIAL MODE: Update current_location_index
        if (!hasMoreResults) {
          // This location is exhausted, move to next location
          const nextLocationIndex = locationIndex + 1;
          console.log(`✅ Location ${locationIndex + 1} exhausted. Moving to location ${nextLocationIndex + 1}`);

          await db.query(`
            UPDATE google_maps_agents
            SET current_location_index = $1,
                current_page = 0
            WHERE id = $2
          `, [nextLocationIndex, agentId]);
        } else {
          // Still has results for this location, update current_page
          await db.query(`
            UPDATE google_maps_agents
            SET current_page = $1
            WHERE id = $2
          `, [lastPage + pagesFetched, agentId]);
        }
      }

      console.log(`✅ Location ${locationIndex + 1}/${locationsToProcess.length} complete: ${totalInserted} leads total so far`);

      // If we stopped due to credits, break out of locations loop too
      if (stoppedDueToCredits) {
        break;
      }
    } // End of locations loop

    // Save execution logs to database
    await this._saveExecutionLogs(agentId, executionLogs);

    // If stopped due to insufficient credits, pause the agent
    if (stoppedDueToCredits) {
      await this._updateAgentStatus(agentId, 'paused');
      console.log(`⏸️  Agent ${agentId}: Paused due to insufficient GMaps credits`);

      return {
        success: false,
        leads_inserted: totalInserted,
        leads_skipped: totalSkipped,
        duplicates_found: totalDuplicates,
        credits_consumed: totalCreditsConsumed,
        pages_fetched: pagesFetched,
        status: 'paused',
        message: 'Agent paused - insufficient GMaps credits',
        reason: 'insufficient_gmaps_credits'
      };
    }

    // Determine final status based on whether all locations have been exhausted
    let finalStatus = 'active'; // Default to active (will run again on next schedule)
    let finalHasMoreResults = !allLocationsExhausted;

    if (allLocationsExhausted) {
      // All locations have been completely exhausted - campaign is complete
      finalStatus = 'completed';
      finalHasMoreResults = false;
      console.log(`🏁 Agent ${agentId}: All locations exhausted - marking as completed`);
    } else {
      // Still has results to fetch - keep as active for next scheduled execution
      finalStatus = 'active';
      finalHasMoreResults = true;
      console.log(`🔄 Agent ${agentId}: More results available - keeping as active for next execution`);
    }

    // Update agent status based on results
    if (finalStatus === 'completed') {
      await this._updateAgentStatus(agentId, 'completed');
    } else if (finalStatus === 'active') {
      await this._updateAgentStatus(agentId, 'active');
    }

    console.log(`🏁 Agent ${agentId}: Execution complete - ${pagesFetched} pages, ${totalInserted} leads inserted`);

    // Emit final WebSocket event with final status (not 'collecting' anymore)
    publishGmapsProgress({
      accountId: agent.account_id,
      agentId,
      status: finalStatus,
      step: null, // No step - execution finished
      stepLabel: null,
      leadsFound: totalInserted + totalSkipped,
      leadsInserted: totalInserted,
      page: pagesFetched,
      message: finalHasMoreResults
        ? `Coleta concluída: ${totalInserted} leads adicionados. Mais resultados disponíveis.`
        : `Coleta finalizada: ${totalInserted} leads adicionados ao CRM.`
    });

    // Send notification for daily completion or campaign completion
    try {
      if (finalHasMoreResults) {
        // Daily collection complete, more results available
        await notificationService.notifyGmapsDailyComplete({
          accountId: agent.account_id,
          userId: agent.user_id,
          agentId: agent.id,
          agentName: agent.name,
          leadsInserted: totalInserted,
          duplicatesFound: totalSkipped // For now, skipped = duplicates
        });
      } else {
        // Campaign complete - no more results
        // Get total leads inserted for this agent
        const agentStats = await this._getAgentById(agentId);
        await notificationService.notifyGmapsCampaignComplete({
          accountId: agent.account_id,
          userId: agent.user_id,
          agentId: agent.id,
          agentName: agent.name,
          totalLeads: agentStats.leads_inserted || totalInserted
        });
      }
    } catch (notifError) {
      console.error(`⚠️ Failed to send completion notification:`, notifError.message);
    }

    return {
      success: true,
      leads_inserted: totalInserted,
      leads_skipped: totalSkipped,
      duplicates_found: totalDuplicates,
      credits_consumed: totalCreditsConsumed,
      pages_fetched: pagesFetched,
      has_more_results: finalHasMoreResults,
      status: finalStatus,
      locations_processed: locationsToProcess.length
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
   * Delete an agent and optionally its leads
   * @param {string} agentId - Agent ID to delete
   * @param {string} accountId - Account ID for security
   * @param {Object} options - Delete options
   * @param {boolean} options.deleteLeads - If true, also delete all leads collected by this agent
   */
  async deleteAgent(agentId, accountId, options = {}) {
    const { deleteLeads = false } = options;
    let leadsDeleted = 0;

    // 1. Remove ALL jobs from queue first (important: do this before DB changes)
    try {
      // Remove repeatable jobs
      const repeatableJobs = await googleMapsAgentQueue.getRepeatableJobs();
      const agentJobs = repeatableJobs.filter(j => j.key.includes(agentId));

      for (const job of agentJobs) {
        await googleMapsAgentQueue.removeRepeatableByKey(job.key);
        console.log(`🗑️  Removed repeatable job: ${job.key}`);
      }

      // Remove ALL jobs (waiting, delayed, active, completed, failed)
      const allStatuses = ['waiting', 'delayed', 'active', 'completed', 'failed'];
      const jobs = await googleMapsAgentQueue.getJobs(allStatuses);
      const agentSpecificJobs = jobs.filter(j => j.data?.agentId === agentId);

      for (const job of agentSpecificJobs) {
        try {
          await job.remove();
          console.log(`🗑️  Removed job: ${job.id}`);
        } catch (jobError) {
          console.warn(`⚠️  Could not remove job ${job.id}: ${jobError.message}`);
        }
      }

      console.log(`🧹 Cleaned ${agentSpecificJobs.length} jobs for agent ${agentId}`);
    } catch (error) {
      console.error(`⚠️  Error removing jobs for agent ${agentId}:`, error.message);
    }

    // 2. If deleteLeads option is true, delete all contacts collected by this agent
    if (deleteLeads) {
      try {
        // Get contact IDs linked to this agent
        const contactsQuery = `
          SELECT contact_id FROM google_maps_agent_contacts
          WHERE agent_id = $1
        `;
        const contactsResult = await db.query(contactsQuery, [agentId]);
        const contactIds = contactsResult.rows.map(r => r.contact_id);

        if (contactIds.length > 0) {
          // Delete contacts (cascade will handle google_maps_agent_contacts)
          const deleteContactsQuery = `
            DELETE FROM contacts
            WHERE id = ANY($1) AND account_id = $2
          `;
          const deleteResult = await db.query(deleteContactsQuery, [contactIds, accountId]);
          leadsDeleted = deleteResult.rowCount || 0;
          console.log(`🗑️  Deleted ${leadsDeleted} leads from agent ${agentId}`);
        }
      } catch (error) {
        console.error(`⚠️  Error deleting leads for agent ${agentId}:`, error.message);
      }
    }

    // 3. Delete the junction table entries (if not already deleted by cascade)
    try {
      await db.query('DELETE FROM google_maps_agent_contacts WHERE agent_id = $1', [agentId]);
    } catch (error) {
      // Ignore - might already be deleted
    }

    // 4. Delete agent from database
    const query = 'DELETE FROM google_maps_agents WHERE id = $1 AND account_id = $2';
    await db.query(query, [agentId, accountId]);
    console.log(`🗑️  Agent deleted: ${agentId}`);

    return {
      success: true,
      leadsDeleted
    };
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
    const result = await db.query(`
      SELECT g.*, u.preferred_language as user_language
      FROM google_maps_agents g
      LEFT JOIN users u ON g.user_id = u.id
      WHERE g.id = $1
    `, [agentId]);

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
   * @param {Array} places - Places to insert
   * @param {Object} agent - Agent configuration
   * @param {number} pageNumber - Current page number
   * @param {Object} runningTotals - Running totals for progress tracking { inserted, skipped }
   */
  async _insertPlacesIntoCRM(places, agent, pageNumber, runningTotals = { inserted: 0, skipped: 0 }) {
    let inserted = 0;
    let skipped = 0;
    let duplicates = 0;
    let creditsConsumed = 0;

    // Check if we're in "list only" mode (insert_in_crm = false)
    const insertInCrm = agent.insert_in_crm !== false; // Default to true for backward compatibility
    const foundPlaces = []; // For storing enriched data when not inserting in CRM
    const duplicatePlaces = []; // For tracking duplicates

    for (let i = 0; i < places.length; i++) {
      const place = places[i];

      try {
        const contactData = serpApiClient.normalizePlaceToContact(place);

        // Emit WebSocket: Analyzing this place
        publishGmapsProgress({
          accountId: agent.account_id,
          agentId: agent.id,
          status: 'collecting',
          step: 'analyzing',
          stepLabel: `Analisando ${contactData.name}...`,
          currentPlace: contactData.name,
          leadsFound: runningTotals.inserted + runningTotals.skipped + inserted + skipped,
          leadsInserted: runningTotals.inserted + inserted,
          page: pageNumber + 1,
          progress: {
            current: i + 1,
            total: places.length
          }
        });

        // === WEBSITE INTELLIGENCE: Email + Company Analysis (GPT-4o-mini) ===
        // Scrape website for email AND generate company description for prospecting
        if (contactData.website) {
          // Emit WebSocket: Enriching with AI
          publishGmapsProgress({
            accountId: agent.account_id,
            agentId: agent.id,
            status: 'collecting',
            step: 'enriching',
            stepLabel: `Enriquecendo ${contactData.name} com IA...`,
            currentPlace: contactData.name,
            leadsFound: runningTotals.inserted + runningTotals.skipped + inserted + skipped,
            leadsInserted: runningTotals.inserted + inserted,
            page: pageNumber + 1
          });

          try {
            const intelligence = await emailScraperService.scrapeAndAnalyze(
              contactData.website,
              contactData.name,
              contactData.business_category,
              agent.user_language || 'pt'  // Pass user's preferred language
            );

            // Email enrichment (primary email)
            if (intelligence.email && !contactData.email) {
              contactData.email = intelligence.email;
              contactData.email_source = 'website_scraping';
              contactData.email_scraped_from = intelligence.source;
              console.log(`📧 [${agent.name}] Email: ${intelligence.email}`);
            }

            // Multiple emails (JSONB array)
            if (intelligence.emails && intelligence.emails.length > 0) {
              contactData.emails = intelligence.emails;
              console.log(`📧 [${agent.name}] ${intelligence.emails.length} emails encontrados`);
            }

            // Multiple phones (JSONB array)
            if (intelligence.phones && intelligence.phones.length > 0) {
              contactData.phones = intelligence.phones;
              console.log(`📞 [${agent.name}] ${intelligence.phones.length} telefones encontrados`);
            }

            // Social links (JSONB object)
            if (intelligence.social_links && Object.keys(intelligence.social_links).length > 0) {
              contactData.social_links = intelligence.social_links;
              console.log(`🔗 [${agent.name}] Redes sociais: ${Object.keys(intelligence.social_links).join(', ')}`);
            }

            // Team members (JSONB array)
            if (intelligence.team_members && intelligence.team_members.length > 0) {
              contactData.team_members = intelligence.team_members;
              console.log(`👥 [${agent.name}] ${intelligence.team_members.length} membros da equipe encontrados`);
            }

            // Company intelligence
            if (intelligence.companyDescription) {
              contactData.company_description = intelligence.companyDescription;
              console.log(`🧠 [${agent.name}] Descrição gerada para ${contactData.name}`);
            }
            if (intelligence.companyServices) {
              contactData.company_services = intelligence.companyServices;
            }
            if (intelligence.painPoints) {
              contactData.pain_points = intelligence.painPoints;
            }

            // === CNPJ LOOKUP: Se scraper encontrou CNPJ, busca dados oficiais ===
            if (intelligence.cnpj) {
              contactData.cnpj = intelligence.cnpj;
              console.log(`🏢 [${agent.name}] CNPJ encontrado: ${intelligence.cnpj}`);

              try {
                const cnpjData = await cnpjService.lookup(intelligence.cnpj);
                contactData.cnpj_data = cnpjData;
                console.log(`📋 [${agent.name}] Dados ReceitaWS obtidos: ${cnpjData.razaoSocial}`);
              } catch (cnpjError) {
                // CNPJ lookup failed - keep the CNPJ but no data
                console.log(`⚠️ [${agent.name}] ReceitaWS lookup falhou: ${cnpjError.message}`);
              }
            }
          } catch (scrapeError) {
            // Don't block lead insertion if scraping fails
            console.log(`⚠️ [${agent.name}] Scraping falhou para ${contactData.name}: ${scrapeError.message}`);
          }
        }
        // === END WEBSITE INTELLIGENCE ===

        // Check if contact already exists (by place_id)
        const existingContact = await this._findContactByPlaceId(
          contactData.place_id,
          agent.account_id
        );

        if (existingContact) {
          // DUPLICATE FOUND - Track it for compensation
          skipped++;
          duplicates++;

          // Save duplicate to tracking table
          try {
            await this._trackDuplicate(agent.id, contactData, existingContact.id);
            duplicatePlaces.push({
              place_id: contactData.place_id,
              name: contactData.name,
              existing_contact_id: existingContact.id,
              found_at: new Date().toISOString()
            });
          } catch (dupError) {
            console.warn(`⚠️ Failed to track duplicate:`, dupError.message);
          }

          continue;
        }

        // =========================================
        // LIST ONLY MODE: Store in found_places without creating contact
        // =========================================
        if (!insertInCrm) {
          // Store enriched data for later export
          foundPlaces.push({
            ...contactData,
            found_at: new Date().toISOString(),
            page_number: pageNumber + 1,
            position: i + 1
          });
          inserted++;

          // Emit WebSocket: Lead added to list
          publishGmapsProgress({
            accountId: agent.account_id,
            agentId: agent.id,
            status: 'collecting',
            step: 'saved',
            stepLabel: `${contactData.name} adicionado à lista!`,
            currentPlace: contactData.name,
            leadsFound: runningTotals.inserted + runningTotals.skipped + inserted + skipped,
            leadsInserted: runningTotals.inserted + inserted,
            page: pageNumber + 1
          });

          continue; // Skip CRM insertion
        }

        // =========================================
        // CRM MODE: Insert contact and opportunity
        // =========================================

        // Check if account has enough GMaps credits before inserting
        const hasCredits = await billingService.hasEnoughCredits(agent.account_id, 'gmaps', 1);
        if (!hasCredits) {
          console.log(`\n❌ [GMAPS CREDITS] Conta ${agent.account_id} sem créditos GMaps suficientes! Parando inserção.`);
          break;
        }

        // Debug log: final data before insert
        console.log(`\n💾 [INSERT DEBUG] ${contactData.name}:`);
        console.log(`   - rating: ${contactData.rating}`);
        console.log(`   - review_count: ${contactData.review_count}`);
        console.log(`   - business_category: ${contactData.business_category}`);
        console.log(`   - city: ${contactData.city}`);
        console.log(`   - state: ${contactData.state}`);
        console.log(`   - country: ${contactData.country}`);
        console.log(`   - phone: ${contactData.phone}`);
        console.log(`   - email: ${contactData.email}`);
        console.log(`   - website: ${contactData.website}`);
        console.log(`   - latitude: ${contactData.latitude}`);
        console.log(`   - longitude: ${contactData.longitude}`);
        console.log(`   - company_description: ${contactData.company_description ? 'YES' : 'NO'}`);
        console.log(`   - company_services: ${contactData.company_services?.length || 0} items`);
        console.log(`   - pain_points: ${contactData.pain_points?.length || 0} items`);

        // Insert contact
        const contact = await this._insertContact(contactData, agent);

        // Debug: verify what was actually saved
        console.log(`✅ [SAVED] ${contact.name}: website="${contact.website}", lat=${contact.latitude}, lng=${contact.longitude}`);

        // Link contact to agent
        await this._linkContactToAgent(agent.id, contact.id, pageNumber, i + 1);

        // Consume 1 GMaps credit for the lead inserted
        await billingService.consumeCredits(
          agent.account_id,
          'gmaps',
          1,
          {
            resourceType: 'google_maps_lead',
            resourceId: contact.id,
            description: `Google Maps lead: ${contactData.name}`
          }
        );
        creditsConsumed++;

        // Auto-assign to user using centralized round-robin service
        try {
          await roundRobinService.autoAssignOpportunityOnCreation({
            opportunityId: contact.opportunity_id,
            sectorId: agent.sector_id,
            accountId: agent.account_id,
            campaignId: null,
            source: 'google_maps'
          });
        } catch (rotationError) {
          // Don't fail the insertion if rotation fails
        }

        inserted++;

        // Emit WebSocket: Lead saved - update counter
        publishGmapsProgress({
          accountId: agent.account_id,
          agentId: agent.id,
          status: 'collecting',
          step: 'saved',
          stepLabel: `${contactData.name} salvo no CRM!`,
          currentPlace: contactData.name,
          leadsFound: runningTotals.inserted + runningTotals.skipped + inserted + skipped,
          leadsInserted: runningTotals.inserted + inserted,
          page: pageNumber + 1
        });

      } catch (error) {
        skipped++;
      }
    }

    // If in list-only mode, save found places to the agent's found_places JSONB column
    if (!insertInCrm && foundPlaces.length > 0) {
      try {
        // Append new places to existing found_places array
        // Note: We don't increment leads_inserted here because leads are NOT being inserted into CRM
        await db.query(`
          UPDATE google_maps_agents
          SET found_places = COALESCE(found_places, '[]'::jsonb) || $1::jsonb,
              updated_at = NOW()
          WHERE id = $2
        `, [JSON.stringify(foundPlaces), agent.id]);
        console.log(`📋 [LIST MODE] Saved ${foundPlaces.length} places to found_places for agent ${agent.id}`);
      } catch (saveError) {
        console.error(`❌ Failed to save found_places:`, saveError.message);
      }
    }

    return { inserted, skipped, duplicates, creditsConsumed, duplicatePlaces };
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
   * Track a duplicate place found during agent execution
   * @param {string} agentId - Agent ID
   * @param {Object} placeData - Place data that was found to be duplicate
   * @param {string} existingContactId - ID of existing contact
   */
  async _trackDuplicate(agentId, placeData, existingContactId) {
    try {
      const query = `
        INSERT INTO google_maps_agent_duplicates (
          agent_id, place_id, existing_contact_id, place_data
        ) VALUES ($1, $2, $3, $4)
        ON CONFLICT (agent_id, place_id) DO UPDATE
        SET found_at = NOW(),
            place_data = EXCLUDED.place_data
      `;

      await db.query(query, [
        agentId,
        placeData.place_id,
        existingContactId,
        JSON.stringify({
          name: placeData.name,
          business_category: placeData.business_category,
          rating: placeData.rating,
          review_count: placeData.review_count,
          address: placeData.address,
          phone: placeData.phone,
          website: placeData.website
        })
      ]);
    } catch (error) {
      console.error(`❌ Error tracking duplicate:`, error.message);
      // Don't throw - tracking duplicates is not critical
    }
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
        name, company, phone, email, website,
        location, headline, about,
        address, street_address, city, state, country, postal_code,
        latitude, longitude,
        rating, review_count,
        business_category, business_types,
        price_level, opening_hours, service_options, photos,
        company_description, company_services, pain_points,
        custom_fields,
        source, last_interaction_at,
        cnpj, cnpj_data,
        emails, phones, social_links, team_members
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14,
        $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27,
        $28, $29, $30, $31, $32, $33, $34, $35, $36, $37, $38, $39, $40, $41, $42
      )
      RETURNING *
    `;

    // Additional metadata that doesn't have dedicated columns
    const customFields = {
      email_source: contactData.email_source || null,
      email_scraped_from: contactData.email_scraped_from || null
    };

    const contactValues = [
      agent.account_id,                                      // $1
      agent.sector_id,                                       // $2
      agent.user_id,                                         // $3
      contactData.place_id,                                  // $4
      contactData.data_cid,                                  // $5
      contactData.google_maps_url,                           // $6
      contactData.name,                                      // $7
      contactData.company,                                   // $8
      contactData.phone,                                     // $9
      contactData.email,                                     // $10
      contactData.website || null,                           // $11
      contactData.location || contactData.address,           // $12 location
      contactData.headline,                                  // $13
      contactData.about,                                     // $14
      contactData.address || null,                           // $15 address
      contactData.street_address || null,                    // $16 street_address
      contactData.city || null,                              // $17 city
      contactData.state || null,                             // $18 state
      contactData.country || null,                           // $19 country
      contactData.postal_code || null,                       // $20 postal_code
      contactData.latitude || null,                          // $21 latitude
      contactData.longitude || null,                         // $22 longitude
      contactData.rating || null,                            // $23 rating
      contactData.review_count || 0,                         // $24 review_count
      contactData.business_category || null,                 // $25 business_category
      JSON.stringify(contactData.business_types || []),      // $26 business_types
      contactData.price_level || null,                       // $27 price_level
      JSON.stringify(contactData.opening_hours || null),     // $28 opening_hours
      JSON.stringify(contactData.service_options || null),   // $29 service_options
      JSON.stringify(contactData.photos || []),              // $30 photos
      contactData.company_description || null,               // $31 company_description
      JSON.stringify(contactData.company_services || []),    // $32 company_services
      JSON.stringify(contactData.pain_points || []),         // $33 pain_points
      JSON.stringify(customFields),                          // $34 custom_fields
      contactData.source,                                    // $35 source
      new Date(),                                            // $36 last_interaction_at
      contactData.cnpj || null,                              // $37 cnpj
      contactData.cnpj_data ? JSON.stringify(contactData.cnpj_data) : null,  // $38 cnpj_data
      JSON.stringify(contactData.emails || []),              // $39 emails (JSONB)
      JSON.stringify(contactData.phones || []),              // $40 phones (JSONB)
      JSON.stringify(contactData.social_links || {}),        // $41 social_links (JSONB)
      JSON.stringify(contactData.team_members || [])         // $42 team_members (JSONB)
    ];

    const contactResult = await db.query(contactQuery, contactValues);
    const contact = contactResult.rows[0];

    // 2. Create OPPORTUNITY (instead of LEAD)
    // First, get the default pipeline and its first stage for this account
    const pipelineQuery = `
      SELECT p.id as pipeline_id, ps.id as stage_id
      FROM pipelines p
      JOIN pipeline_stages ps ON ps.pipeline_id = p.id
      WHERE p.account_id = $1 AND p.is_default = true AND p.is_active = true
      ORDER BY ps.position ASC
      LIMIT 1
    `;
    const pipelineResult = await db.query(pipelineQuery, [agent.account_id]);

    if (pipelineResult.rows.length === 0) {
      // No default pipeline found - create one using pipelineService
      const pipelineService = require('./pipelineService');
      const defaultPipeline = await pipelineService.createDefaultPipeline(agent.account_id, agent.user_id);

      // Get first stage of newly created pipeline
      const stageQuery = `
        SELECT id FROM pipeline_stages
        WHERE pipeline_id = $1
        ORDER BY position ASC
        LIMIT 1
      `;
      const stageResult = await db.query(stageQuery, [defaultPipeline.id]);
      pipelineResult.rows = [{
        pipeline_id: defaultPipeline.id,
        stage_id: stageResult.rows[0].id
      }];
    }

    const { pipeline_id, stage_id } = pipelineResult.rows[0];

    // Build opportunity title
    const opportunityTitle = contactData.company
      ? `${contactData.name} - ${contactData.company}`
      : contactData.name;

    const opportunityQuery = `
      INSERT INTO opportunities (
        account_id, contact_id, pipeline_id, stage_id,
        title, value, currency, probability,
        owner_user_id, source, custom_fields,
        created_by, created_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW()
      )
      RETURNING *
    `;

    const opportunityCustomFields = {
      place_id: contactData.place_id,
      google_maps_agent_id: agent.id,
      rating: contactData.rating,
      review_count: contactData.review_count
    };

    const opportunityValues = [
      agent.account_id,                      // $1
      contact.id,                            // $2 contact_id (FK)
      pipeline_id,                           // $3
      stage_id,                              // $4
      opportunityTitle,                      // $5 title
      0,                                     // $6 value (default)
      'BRL',                                 // $7 currency
      10,                                    // $8 probability (initial)
      agent.user_id,                         // $9 owner_user_id
      'google_maps',                         // $10 source
      JSON.stringify(opportunityCustomFields), // $11 custom_fields
      agent.user_id                          // $12 created_by
    ];

    const opportunityResult = await db.query(opportunityQuery, opportunityValues);
    const opportunity = opportunityResult.rows[0];

    // Register in opportunity_history
    await db.query(
      `INSERT INTO opportunity_history (opportunity_id, user_id, action, to_stage_id, notes, metadata)
       VALUES ($1, $2, 'created', $3, $4, $5)`,
      [
        opportunity.id,
        agent.user_id,
        stage_id,
        'Oportunidade criada via Google Maps Agent',
        JSON.stringify({ source: 'google_maps', agent_id: agent.id })
      ]
    );

    // Return contact with opportunity_id attached
    return {
      ...contact,
      opportunity_id: opportunity.id
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
   * Note: WebSocket emission is handled separately in executeAgent to avoid overwriting gamified status
   */
  async _updateAgentStats(agentId, stats, accountId = null) {
    const {
      currentPage,
      leadsFound,
      leadsInserted,
      leadsSkipped,
      duplicatesFound = 0,
      apiCalls,
      hasMoreResults
    } = stats;

    // Calculate next execution (24 hours from now)
    const nextExecution = new Date();
    nextExecution.setHours(nextExecution.getHours() + 24);

    // Use 'in_progress' when there are more results, 'completed' when done
    const newStatus = hasMoreResults ? 'in_progress' : 'completed';

    const query = `
      UPDATE google_maps_agents
      SET
        current_page = $2,
        last_page_fetched = $3,
        total_leads_found = total_leads_found + $4,
        leads_inserted = leads_inserted + $5,
        leads_skipped = leads_skipped + $6,
        duplicates_found = duplicates_found + $7,
        total_api_calls = total_api_calls + $8,
        estimated_cost = total_api_calls * 0.00275,
        last_fetch_at = NOW(),
        last_execution_at = NOW(),
        next_execution_at = $9,
        status = $10,
        updated_at = NOW()
      WHERE id = $1
      RETURNING total_leads_found, leads_inserted, duplicates_found
    `;

    const values = [
      agentId,
      currentPage,
      currentPage - 1,
      leadsFound,
      leadsInserted,
      leadsSkipped,
      duplicatesFound,
      apiCalls,
      hasMoreResults ? nextExecution : null,
      newStatus
    ];

    await db.query(query, values);

    // Note: WebSocket emission removed from here - it's now handled explicitly in executeAgent
    // to avoid overwriting the gamified step info during execution
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
    // First, check if the agent is in list-only mode (insert_in_crm = false)
    const agentCheck = await db.query(
      'SELECT insert_in_crm, found_places FROM google_maps_agents WHERE id = $1 AND account_id = $2',
      [agentId, accountId]
    );

    if (agentCheck.rows.length === 0) {
      return [];
    }

    const agent = agentCheck.rows[0];

    // If in list-only mode, return found_places directly
    if (agent.insert_in_crm === false) {
      const foundPlaces = agent.found_places || [];
      return Array.isArray(foundPlaces) ? foundPlaces : [];
    }

    // Otherwise, query from contacts table (standard CRM mode)
    const query = `
      SELECT
        c.id,
        c.name,
        c.email,
        c.phone,
        c.company,
        COALESCE(c.address, c.custom_fields->>'address', c.location) as address,
        COALESCE(c.city, c.custom_fields->>'city') as city,
        COALESCE(c.state, c.custom_fields->>'state') as state,
        COALESCE(c.country, c.custom_fields->>'country') as country,
        c.website,
        COALESCE(c.rating, (c.custom_fields->>'rating')::decimal) as rating,
        COALESCE(c.review_count, (c.custom_fields->>'review_count')::integer, 0) as review_count,
        COALESCE(c.business_category, c.custom_fields->>'business_category') as business_category,
        c.google_maps_url,
        COALESCE(c.latitude, (c.custom_fields->>'latitude')::decimal) as latitude,
        COALESCE(c.longitude, (c.custom_fields->>'longitude')::decimal) as longitude,
        c.company_description,
        c.company_services,
        c.pain_points,
        c.location,
        c.emails,
        c.phones,
        c.social_links,
        c.team_members,
        c.cnpj,
        c.cnpj_data,
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

  /**
   * Save execution logs to database
   * Appends new logs to existing logs array
   */
  async _saveExecutionLogs(agentId, logs) {
    if (!logs || logs.length === 0) return;

    try {
      // Get current logs
      const currentResult = await db.query(
        'SELECT execution_logs FROM google_maps_agents WHERE id = $1',
        [agentId]
      );

      let currentLogs = [];
      if (currentResult.rows.length > 0 && currentResult.rows[0].execution_logs) {
        currentLogs = currentResult.rows[0].execution_logs;
      }

      // Append new logs (keep last 100 entries)
      const allLogs = [...currentLogs, ...logs].slice(-100);

      // Save to database
      await db.query(
        'UPDATE google_maps_agents SET execution_logs = $1::jsonb WHERE id = $2',
        [JSON.stringify(allLogs), agentId]
      );

      console.log(`📝 Saved ${logs.length} execution logs for agent ${agentId}`);
    } catch (error) {
      console.error(`⚠️ Error saving execution logs for agent ${agentId}:`, error.message);
      // Don't throw - logs are not critical
    }
  }

  /**
   * Get execution logs for an agent
   * @param {string} agentId - Agent UUID
   * @param {string} accountId - Account UUID for security
   * @returns {Array} Execution logs
   */
  async getAgentLogs(agentId, accountId) {
    const query = `
      SELECT execution_logs
      FROM google_maps_agents
      WHERE id = $1 AND account_id = $2
    `;
    const result = await db.query(query, [agentId, accountId]);

    if (result.rows.length === 0) {
      throw new Error('Agent not found');
    }

    return result.rows[0].execution_logs || [];
  }

  /**
   * Get duplicates found by an agent
   * @param {string} agentId - Agent UUID
   * @param {string} accountId - Account UUID for security
   * @param {Object} options - Query options (limit, offset)
   * @returns {Array} List of duplicates
   */
  async getAgentDuplicates(agentId, accountId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    // Verify agent belongs to account
    await this.getAgent(agentId, accountId);

    const query = `
      SELECT
        d.id,
        d.place_id,
        d.place_data,
        d.existing_contact_id,
        d.found_at,
        c.name as existing_contact_name,
        c.company as existing_contact_company
      FROM google_maps_agent_duplicates d
      LEFT JOIN contacts c ON d.existing_contact_id = c.id
      WHERE d.agent_id = $1
      ORDER BY d.found_at DESC
      LIMIT $2 OFFSET $3
    `;

    const result = await db.query(query, [agentId, limit, offset]);
    return result.rows;
  }

  /**
   * Get duplicate statistics for an agent
   * @param {string} agentId - Agent UUID
   * @param {string} accountId - Account UUID for security
   * @returns {Object} Duplicate statistics
   */
  async getAgentDuplicateStats(agentId, accountId) {
    // Verify agent belongs to account
    const agent = await this.getAgent(agentId, accountId);

    const countQuery = `
      SELECT COUNT(*) as total_duplicates
      FROM google_maps_agent_duplicates
      WHERE agent_id = $1
    `;

    const countResult = await db.query(countQuery, [agentId]);

    return {
      duplicates_found: agent.duplicates_found || 0,
      duplicates_tracked: parseInt(countResult.rows[0].total_duplicates) || 0
    };
  }
}

module.exports = new GoogleMapsAgentService();
