// backend/src/services/instagramAgentService.js
// Business logic for Instagram agents - find Instagram profiles via Google search

const db = require('../config/database');
const serperDevClient = require('../config/serperdev');
const billingService = require('./billingService');

const CREDIT_TYPE = 'instagram';
// Phase 1: credits not yet available for purchase, skip billing checks
const CREDITS_ENABLED = false;

class InstagramAgentService {
  /**
   * Create a new Instagram agent (saved search configuration)
   */
  async createAgent(agentData) {
    const {
      accountId,
      sectorId,
      userId,
      name,
      description,
      searchNiche,
      searchLocation,
      searchCountry = 'Brazil',
      profilesPerExecution = 50,
      totalLimit = 500
    } = agentData;

    if (!searchNiche || !searchLocation) {
      throw new Error('Nicho e localização são obrigatórios');
    }

    if (!accountId || !userId) {
      throw new Error('Account ID and User ID are required');
    }

    const result = await db.query(
      `INSERT INTO instagram_agents (
        account_id, sector_id, user_id,
        name, description,
        search_niche, search_location, search_country,
        profiles_per_execution, total_limit
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        accountId, sectorId || null, userId,
        name, description || null,
        searchNiche, searchLocation, searchCountry,
        profilesPerExecution, totalLimit
      ]
    );

    console.log(`✅ Instagram agent created: ${result.rows[0].id}`);
    return result.rows[0];
  }

  /**
   * Get all Instagram agents for an account
   */
  async getAgents(accountId, filters = {}) {
    const { page = 1, limit = 20, status, sectorId } = filters;
    const offset = (page - 1) * limit;
    const params = [accountId];
    let paramIndex = 2;

    let whereClause = 'WHERE ia.account_id = $1';

    if (status) {
      whereClause += ` AND ia.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }

    if (sectorId) {
      whereClause += ` AND ia.sector_id = $${paramIndex}`;
      params.push(sectorId);
      paramIndex++;
    }

    // Count total
    const countResult = await db.query(
      `SELECT COUNT(*) FROM instagram_agents ia ${whereClause}`,
      params
    );
    const total = parseInt(countResult.rows[0].count);

    // Get agents (without found_profiles to keep response small)
    params.push(limit, offset);
    const result = await db.query(
      `SELECT
        ia.id, ia.account_id, ia.sector_id, ia.user_id,
        ia.name, ia.description, ia.status,
        ia.search_niche, ia.search_location, ia.search_country,
        ia.current_page, ia.total_profiles_found, ia.has_more_results,
        ia.profiles_per_execution, ia.total_limit,
        ia.total_api_calls, ia.last_execution_at, ia.execution_count,
        ia.created_at, ia.updated_at,
        u.name as user_name
      FROM instagram_agents ia
      LEFT JOIN users u ON u.id = ia.user_id
      ${whereClause}
      ORDER BY ia.created_at DESC
      LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`,
      params
    );

    return {
      agents: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Get a single Instagram agent by ID
   */
  async getAgent(agentId, accountId) {
    const result = await db.query(
      `SELECT ia.*, u.name as user_name
       FROM instagram_agents ia
       LEFT JOIN users u ON u.id = ia.user_id
       WHERE ia.id = $1 AND ia.account_id = $2`,
      [agentId, accountId]
    );

    if (result.rows.length === 0) {
      throw new Error('Agente Instagram não encontrado');
    }

    return result.rows[0];
  }

  /**
   * Update an Instagram agent
   */
  async updateAgent(agentId, accountId, updates) {
    const allowedFields = ['name', 'description', 'status', 'profiles_per_execution', 'total_limit'];
    const setClauses = [];
    const params = [agentId, accountId];
    let paramIndex = 3;

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        setClauses.push(`${field} = $${paramIndex}`);
        params.push(updates[field]);
        paramIndex++;
      }
    }

    if (setClauses.length === 0) {
      throw new Error('No fields to update');
    }

    setClauses.push('updated_at = NOW()');

    const result = await db.query(
      `UPDATE instagram_agents
       SET ${setClauses.join(', ')}
       WHERE id = $1 AND account_id = $2
       RETURNING *`,
      params
    );

    if (result.rows.length === 0) {
      throw new Error('Agente Instagram não encontrado');
    }

    return result.rows[0];
  }

  /**
   * Delete an Instagram agent
   */
  async deleteAgent(agentId, accountId) {
    const result = await db.query(
      'DELETE FROM instagram_agents WHERE id = $1 AND account_id = $2 RETURNING id',
      [agentId, accountId]
    );

    if (result.rows.length === 0) {
      throw new Error('Agente Instagram não encontrado');
    }

    return { deleted: true };
  }

  /**
   * Execute the agent: search Google via Serper.dev and collect Instagram profiles
   * Resumes from current_page to avoid duplicates on pause/resume
   */
  async executeAgent(agentId, accountId) {
    const agent = await this.getAgent(agentId, accountId);

    // Block execution if completed or no more results
    if (agent.status === 'completed') {
      throw new Error('Esta campanha já foi concluída. Não há mais resultados disponíveis.');
    }

    if (!agent.has_more_results) {
      throw new Error('Não há mais resultados no Google para esta busca.');
    }

    if (agent.status === 'paused') {
      throw new Error('Esta campanha está pausada. Retome antes de executar.');
    }

    // Check total limit
    if (agent.total_profiles_found >= agent.total_limit) {
      await this._updateAgentDirect(agentId, { status: 'completed' });
      throw new Error('Limite total de perfis atingido.');
    }

    // Check credits (skipped when CREDITS_ENABLED=false)
    if (CREDITS_ENABLED) {
      const hasCredits = await billingService.hasEnoughCredits(agent.account_id, CREDIT_TYPE, 1);
      if (!hasCredits) {
        throw new Error('Créditos Instagram insuficientes.');
      }
    }

    // Calculate how many pages to fetch
    const remainingToLimit = agent.total_limit - agent.total_profiles_found;
    const profilesToFetch = Math.min(agent.profiles_per_execution || 50, remainingToLimit);
    const pagesToFetch = Math.ceil(profilesToFetch / 10);

    // Build set of existing usernames for deduplication
    const existingProfiles = typeof agent.found_profiles === 'string'
      ? JSON.parse(agent.found_profiles)
      : (agent.found_profiles || []);
    const existingUsernames = new Set(existingProfiles.map(p => p.username.toLowerCase()));

    let newProfiles = [];
    let apiCallsMade = 0;
    let creditsConsumed = 0;
    let hasMore = true;
    let stoppedDueToCredits = false;
    let consecutiveEmptyPages = 0;

    for (let i = 0; i < pagesToFetch; i++) {
      const page = agent.current_page + i + 1; // 1-based for Serper.dev

      try {
        const result = await serperDevClient.searchInstagramProfiles({
          niche: agent.search_niche,
          location: agent.search_location,
          page: page,
          num: 10
        });

        apiCallsMade++;

        // Stop signal: page returned 0 valid Instagram profiles (all posts/reels/explore)
        if (result.profiles.length === 0) {
          console.log(`⚠️  Instagram agent ${agentId} page ${page}: 0 valid profiles parsed, ending search`);
          hasMore = false;
          break;
        }

        // Deduplicate against already-found profiles
        const uniqueNew = result.profiles.filter(p => {
          const lower = p.username.toLowerCase();
          if (existingUsernames.has(lower)) return false;
          existingUsernames.add(lower);
          return true;
        });

        // Stop signal: track consecutive pages with 0 new unique profiles
        if (uniqueNew.length === 0) {
          consecutiveEmptyPages++;
          if (consecutiveEmptyPages >= 2) {
            console.log(`⚠️  Instagram agent ${agentId}: 2 consecutive pages with 0 new profiles, ending search`);
            hasMore = false;
            break;
          }
        } else {
          consecutiveEmptyPages = 0;
        }

        // Consume 1 credit per profile found (not per API call)
        if (CREDITS_ENABLED && uniqueNew.length > 0) {
          for (const profile of uniqueNew) {
            const hasCredit = await billingService.hasEnoughCredits(agent.account_id, CREDIT_TYPE, 1);
            if (!hasCredit) {
              console.log(`⚠️  Instagram agent ${agentId}: credits exhausted after ${creditsConsumed} profiles`);
              stoppedDueToCredits = true;
              break;
            }
            await billingService.consumeCredits(agent.account_id, CREDIT_TYPE, 1, {
              resourceType: 'instagram_profile',
              resourceId: agentId,
              userId: agent.user_id,
              description: `Instagram profile: @${profile.username}`
            });
            creditsConsumed++;
            newProfiles.push(profile);
          }
          if (stoppedDueToCredits) break;
        } else {
          // Credits disabled - add all profiles
          newProfiles.push(...uniqueNew);
        }

        // Check if Google has more results
        if (!result.hasMore) {
          hasMore = false;
          break;
        }

        // Check if we've reached the total limit
        if (existingProfiles.length + newProfiles.length >= agent.total_limit) {
          break;
        }

      } catch (error) {
        console.error(`❌ Instagram agent ${agentId} page ${page} error:`, error.message);
        // Don't fail the whole execution for a single page error
        if (apiCallsMade === 0) throw error; // Fail if first page fails
        break;
      }
    }

    // Merge profiles
    const allProfiles = [...existingProfiles, ...newProfiles];
    const totalFound = allProfiles.length;
    const isCompleted = !hasMore || totalFound >= agent.total_limit;

    // Update agent in database
    await this._updateAgentDirect(agentId, {
      found_profiles: JSON.stringify(allProfiles),
      current_page: agent.current_page + apiCallsMade,
      total_profiles_found: totalFound,
      has_more_results: hasMore,
      total_api_calls: (agent.total_api_calls || 0) + apiCallsMade,
      last_execution_at: new Date(),
      execution_count: (agent.execution_count || 0) + 1,
      status: isCompleted ? 'completed' : 'active'
    });

    return {
      success: true,
      new_profiles: newProfiles.length,
      total_profiles: totalFound,
      api_calls_made: apiCallsMade,
      has_more_results: hasMore,
      status: isCompleted ? 'completed' : 'active'
    };
  }

  /**
   * Get found profiles for an agent (with pagination)
   */
  async getFoundProfiles(agentId, accountId, options = {}) {
    const { page = 1, limit = 50 } = options;
    const agent = await this.getAgent(agentId, accountId);

    const profiles = typeof agent.found_profiles === 'string'
      ? JSON.parse(agent.found_profiles)
      : (agent.found_profiles || []);

    const total = profiles.length;
    const offset = (page - 1) * limit;
    const paginated = profiles.slice(offset, offset + limit);

    return {
      profiles: paginated,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * Export profiles as CSV
   */
  async exportProfilesCSV(agentId, accountId) {
    const agent = await this.getAgent(agentId, accountId);

    const profiles = typeof agent.found_profiles === 'string'
      ? JSON.parse(agent.found_profiles)
      : (agent.found_profiles || []);

    if (profiles.length === 0) {
      throw new Error('Nenhum perfil encontrado para exportar');
    }

    // CSV header
    const header = 'Username,Nome,URL do Perfil,Bio,Encontrado em,Página';
    const rows = profiles.map(p => {
      const bio = (p.bio_excerpt || '').replace(/"/g, '""').replace(/\n/g, ' ');
      const name = (p.display_name || '').replace(/"/g, '""');
      return `"${p.username}","${name}","${p.profile_url}","${bio}","${p.found_at || ''}","${p.search_page || ''}"`;
    });

    return [header, ...rows].join('\n');
  }

  /**
   * Pause an agent
   */
  async pauseAgent(agentId, accountId) {
    return this.updateAgent(agentId, accountId, { status: 'paused' });
  }

  /**
   * Resume a paused agent
   */
  async resumeAgent(agentId, accountId) {
    const agent = await this.getAgent(agentId, accountId);

    if (agent.status !== 'paused') {
      throw new Error('Apenas agentes pausados podem ser retomados');
    }

    return this.updateAgent(agentId, accountId, { status: 'active' });
  }

  /**
   * Internal: update agent fields directly
   */
  async _updateAgentDirect(agentId, fields) {
    const setClauses = [];
    const params = [agentId];
    let paramIndex = 2;

    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${paramIndex}`);
      params.push(value);
      paramIndex++;
    }

    setClauses.push('updated_at = NOW()');

    await db.query(
      `UPDATE instagram_agents SET ${setClauses.join(', ')} WHERE id = $1`,
      params
    );
  }
}

const instagramAgentService = new InstagramAgentService();
module.exports = instagramAgentService;
