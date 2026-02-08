// backend/src/services/contactEnrichmentService.js
// Complete LinkedIn contact and company enrichment service

const db = require('../config/database');
const unipileClient = require('../config/unipile');
const { analyzeLinkedInProfile } = require('./aiProfileAnalysisService');
const { downloadAndStoreProfilePicture, isR2Url } = require('./profilePictureService');

// ================================
// LOCATION PARSING
// ================================
/**
 * Parse LinkedIn location string into city, state, country
 * Handles formats like:
 * - "Sao Paulo, SP, Brasil"
 * - "Sao Paulo, Brazil"
 * - "Sao Paulo Area, Brazil"
 * - "Greater Sao Paulo"
 */
function parseLinkedInLocation(locationString) {
  if (!locationString) return { city: null, state: null, country: null };

  const parts = locationString.split(',').map(p => p.trim());

  let city = null;
  let state = null;
  let country = null;

  // Brazilian state mappings
  const brazilStates = {
    'AC': 'AC', 'AL': 'AL', 'AP': 'AP', 'AM': 'AM', 'BA': 'BA',
    'CE': 'CE', 'DF': 'DF', 'ES': 'ES', 'GO': 'GO', 'MA': 'MA',
    'MT': 'MT', 'MS': 'MS', 'MG': 'MG', 'PA': 'PA', 'PB': 'PB',
    'PR': 'PR', 'PE': 'PE', 'PI': 'PI', 'RJ': 'RJ', 'RN': 'RN',
    'RS': 'RS', 'RO': 'RO', 'RR': 'RR', 'SC': 'SC', 'SP': 'SP',
    'SE': 'SE', 'TO': 'TO',
    // Full names
    'SAO PAULO': 'SP', 'RIO DE JANEIRO': 'RJ', 'MINAS GERAIS': 'MG',
    'PARANA': 'PR', 'SANTA CATARINA': 'SC', 'RIO GRANDE DO SUL': 'RS',
    'BAHIA': 'BA', 'PERNAMBUCO': 'PE', 'CEARA': 'CE', 'GOIAS': 'GO',
    'DISTRITO FEDERAL': 'DF', 'BRASILIA': 'DF'
  };

  // Country mappings
  const countryMap = {
    'BRASIL': 'Brasil', 'BRAZIL': 'Brasil',
    'USA': 'United States', 'UNITED STATES': 'United States',
    'PORTUGAL': 'Portugal', 'UK': 'United Kingdom', 'UNITED KINGDOM': 'United Kingdom',
    'ARGENTINA': 'Argentina', 'CHILE': 'Chile', 'COLOMBIA': 'Colombia',
    'MEXICO': 'Mexico', 'ESPANHA': 'Spain', 'SPAIN': 'Spain'
  };

  if (parts.length >= 3) {
    // Format: "City, State, Country"
    city = parts[0].replace(/\s*(Area|Region|Metropolitan)$/i, '').trim();
    const stateRaw = parts[1].toUpperCase().trim();
    state = brazilStates[stateRaw] || parts[1].trim();
    const countryRaw = parts[2].toUpperCase().trim();
    country = countryMap[countryRaw] || parts[2].trim();
  } else if (parts.length === 2) {
    // Format: "City, Country" or "City, State"
    city = parts[0].replace(/\s*(Area|Region|Metropolitan|Greater)$/i, '').trim();
    const part2Upper = parts[1].toUpperCase().trim();

    if (countryMap[part2Upper]) {
      country = countryMap[part2Upper];
    } else if (brazilStates[part2Upper]) {
      state = brazilStates[part2Upper];
      country = 'Brasil';
    } else {
      country = parts[1].trim();
    }
  } else if (parts.length === 1) {
    // Format: "City" or "Greater City"
    city = parts[0].replace(/\s*(Area|Region|Metropolitan|Greater)$/i, '').trim();
  }

  // Clean "Greater" prefix from city
  if (city) {
    city = city.replace(/^Greater\s+/i, '').trim();
  }

  return { city, state, country };
}

// ================================
// FETCH FULL PROFILE FROM UNIPILE
// ================================
async function fetchFullProfile(unipileAccountId, providerId) {
  if (!unipileClient.isInitialized()) {
    throw new Error('Unipile client not initialized');
  }

  try {
    // Use getFullProfile to get complete LinkedIn profile with all sections
    const profile = await unipileClient.users.getFullProfile(unipileAccountId, providerId);

    // Debug: log what we're getting from Unipile
    console.log('[ENRICHMENT] Profile response keys:', Object.keys(profile || {}));
    const workExp = profile?.work_experience || profile?.experience;
    console.log('[ENRICHMENT] Has work_experience?', !!workExp, Array.isArray(workExp) ? workExp.length : 'not array');

    // Debug: log first work experience entry to see structure and field names
    if (workExp?.[0]) {
      console.log('[ENRICHMENT] Work experience structure:', {
        keys: Object.keys(workExp[0]),
        sample: JSON.stringify(workExp[0], null, 2)
      });
    }

    console.log('[ENRICHMENT] Has education?', !!profile?.education, Array.isArray(profile?.education) ? profile.education.length : 'not array');
    // Debug: log first education entry to see structure
    if (profile?.education?.[0]) {
      console.log('[ENRICHMENT] Education structure:', {
        keys: Object.keys(profile.education[0]),
        sample: profile.education[0]
      });
    }
    console.log('[ENRICHMENT] Has skills?', !!profile?.skills, Array.isArray(profile?.skills) ? profile.skills.length : 'not array');

    return profile;
  } catch (error) {
    console.error(`[ENRICHMENT] Error fetching profile ${providerId}:`, error.message);
    return null;
  }
}

// ================================
// FETCH COMPANY FROM UNIPILE
// ================================
async function fetchCompanyProfile(unipileAccountId, companyId) {
  if (!unipileClient.isInitialized()) {
    return null;
  }

  try {
    // company.getOne expects { account_id, identifier }
    const company = await unipileClient.company.getOne({
      account_id: unipileAccountId,
      identifier: companyId
    });

    console.log('[ENRICHMENT] Company profile fetched:', {
      hasCompany: !!company,
      keys: company ? Object.keys(company) : [],
      id: company?.id,
      name: company?.name,
      employee_count: company?.employee_count,
      followers_count: company?.followers_count,
      foundation_date: company?.foundation_date,
      organization_type: company?.organization_type,
      industry: company?.industry,
      locations: company?.locations,
      profile_url: company?.profile_url
    });

    return company;
  } catch (error) {
    console.error(`[ENRICHMENT] Error fetching company ${companyId}:`, error.message);
    return null;
  }
}

// ================================
// ENRICH COMPANY DATA
// ================================
async function enrichCompany(accountId, unipileAccountId, companyData) {
  // Try to get company ID from multiple possible field names
  const companyId = companyData?.id || companyData?.linkedin_id || companyData?.company_id
    || companyData?.linkedin_company_id || companyData?.provider_id;

  if (!companyData || !companyId) {
    console.log('[ENRICHMENT] Cannot enrich company - no ID found:', {
      hasData: !!companyData,
      dataKeys: companyData ? Object.keys(companyData) : []
    });
    return null;
  }

  console.log('[ENRICHMENT] Enriching company:', {
    companyId,
    name: companyData.name,
    accountId
  });

  try {
    // Check if company already exists
    const existing = await db.findOne('companies', {
      account_id: accountId,
      linkedin_company_id: companyId
    });

    // Parse employee count - Unipile returns employee_count as object or number
    let employeeCountMin = null;
    let employeeCountMax = null;
    const empCount = companyData.employee_count;
    if (empCount) {
      if (typeof empCount === 'object') {
        employeeCountMin = empCount.min || empCount.start;
        employeeCountMax = empCount.max || empCount.end;
      } else if (typeof empCount === 'number') {
        employeeCountMin = empCount;
        employeeCountMax = empCount;
      } else if (typeof empCount === 'string') {
        const match = empCount.match(/(\d+)-(\d+)/);
        if (match) {
          employeeCountMin = parseInt(match[1]);
          employeeCountMax = parseInt(match[2]);
        } else {
          const num = parseInt(empCount);
          if (!isNaN(num)) {
            employeeCountMin = num;
            employeeCountMax = num;
          }
        }
      }
    }
    // Fallback to company_size if no employee_count
    if (!employeeCountMin && companyData.company_size) {
      const match = companyData.company_size.match(/(\d+)-(\d+)/);
      if (match) {
        employeeCountMin = parseInt(match[1]);
        employeeCountMax = parseInt(match[2]);
      } else if (companyData.company_size.includes('+')) {
        employeeCountMin = parseInt(companyData.company_size);
      }
    }

    // Parse founded year - Unipile returns foundation_date
    let foundedYear = null;
    if (companyData.foundation_date) {
      // Could be "2015" or "2015-01-01" or just a year number
      const dateStr = String(companyData.foundation_date);
      const yearMatch = dateStr.match(/(\d{4})/);
      if (yearMatch) {
        foundedYear = parseInt(yearMatch[1]);
      }
    } else if (companyData.founded) {
      foundedYear = parseInt(companyData.founded);
    }

    // Industry might be array or string
    let industryValue = companyData.industry;
    if (Array.isArray(industryValue)) {
      industryValue = JSON.stringify(industryValue);
    }

    const companyRecord = {
      account_id: accountId,
      linkedin_company_id: companyId,
      linkedin_url: companyData.profile_url || companyData.url || companyData.linkedin_url,
      name: companyData.name,
      logo_url: companyData.logo_large || companyData.logo_url || companyData.logo,
      website: companyData.website,
      industry: industryValue,
      company_size: companyData.company_size,
      employee_count_min: employeeCountMin,
      employee_count_max: employeeCountMax,
      headquarters: companyData.headquarters || companyData.location,
      locations: companyData.locations ? JSON.stringify(companyData.locations) : null,
      description: companyData.description || companyData.about,
      tagline: companyData.tagline,
      specialties: companyData.specialties ? JSON.stringify(companyData.specialties) : null,
      founded: foundedYear,
      company_type: companyData.organization_type || companyData.company_type || companyData.type,
      follower_count: companyData.followers_count || companyData.follower_count,
      enriched_at: new Date(),
      updated_at: new Date()
    };

    if (existing) {
      await db.update('companies', companyRecord, { id: existing.id });
      console.log('[ENRICHMENT] Company updated:', { companyDbId: existing.id, linkedinCompanyId: companyId });
      return existing.id;
    } else {
      const newCompany = await db.insert('companies', companyRecord);
      console.log('[ENRICHMENT] Company created:', { companyDbId: newCompany.id, linkedinCompanyId: companyId });
      return newCompany.id;
    }
  } catch (error) {
    console.error('[ENRICHMENT] Error saving company:', error.message, error.stack);
    return null;
  }
}

// ================================
// ENRICH CONTACT WITH FULL PROFILE
// ================================
async function enrichContact(contactId, unipileAccountId, providerId, options = {}) {
  const { forceRefresh = false, enrichCompanyData = true } = options;

  try {
    // 1. Check if contact exists and was recently enriched
    const contact = await db.findOne('contacts', { id: contactId });
    if (!contact) {
      throw new Error(`Contact ${contactId} not found`);
    }

    // Skip if recently enriched (within 24 hours) unless forced
    if (!forceRefresh && contact.full_profile_fetched_at) {
      const hoursSinceEnrich = (Date.now() - new Date(contact.full_profile_fetched_at)) / (1000 * 60 * 60);
      if (hoursSinceEnrich < 24) {
        return { skipped: true, reason: 'Recently enriched', contact };
      }
    }

    // 2. Fetch full profile from Unipile
    const profile = await fetchFullProfile(unipileAccountId, providerId);
    if (!profile) {
      return { skipped: true, reason: 'Could not fetch profile', contact };
    }

    // 3. Build contact update data
    const contactUpdate = {
      updated_at: new Date(),
      full_profile_fetched_at: new Date()
    };

    // Basic info
    if (profile.first_name) contactUpdate.first_name = profile.first_name;
    if (profile.last_name) contactUpdate.last_name = profile.last_name;
    if (profile.headline) contactUpdate.headline = profile.headline;
    if (profile.summary || profile.about) contactUpdate.about = profile.summary || profile.about;
    if (profile.location) {
      contactUpdate.location = profile.location;
      // Parse location into city, state, country for better search
      const parsedLocation = parseLinkedInLocation(profile.location);
      if (parsedLocation.city) contactUpdate.city = parsedLocation.city;
      if (parsedLocation.state) contactUpdate.state = parsedLocation.state;
      if (parsedLocation.country) contactUpdate.country = parsedLocation.country;
    }
    if (profile.industry) contactUpdate.industry = profile.industry;

    // Update name if we have better data
    if (profile.first_name && profile.last_name) {
      const fullName = `${profile.first_name} ${profile.last_name}`.trim();
      if (fullName && fullName !== contact.name) {
        contactUpdate.name = fullName;
      }
    }

    // Profile picture (prefer larger) - download and persist to R2
    const profilePic = profile.profile_picture_url_large ||
                      profile.profile_picture_url ||
                      profile.picture_url;
    if (profilePic) {
      if (isR2Url(contact.profile_picture)) {
        console.log('[ENRICHMENT] Profile picture already on R2, skipping download');
      } else {
        const r2Url = await downloadAndStoreProfilePicture(profilePic, contact.account_id, contactId);
        if (r2Url) {
          contactUpdate.profile_picture = r2Url;
          console.log('[ENRICHMENT] Profile picture stored in R2:', r2Url);
        } else {
          // Fallback to temp URL (better than no picture)
          contactUpdate.profile_picture = profilePic;
          console.log('[ENRICHMENT] R2 upload failed, using temp URL:', profilePic.substring(0, 80) + '...');
        }
      }
    } else {
      console.log('[ENRICHMENT] No profile picture in response:', {
        large: !!profile.profile_picture_url_large,
        normal: !!profile.profile_picture_url,
        picture: !!profile.picture_url
      });
    }

    // Identifiers
    if (profile.public_identifier) {
      contactUpdate.public_identifier = profile.public_identifier;
      contactUpdate.profile_url = `https://www.linkedin.com/in/${profile.public_identifier}`;
    }
    if (profile.member_urn) contactUpdate.member_urn = profile.member_urn;
    if (profile.primary_locale) contactUpdate.primary_locale = JSON.stringify(profile.primary_locale);

    // Network stats
    if (profile.connections_count !== undefined) contactUpdate.connections_count = profile.connections_count;
    if (profile.follower_count !== undefined) contactUpdate.follower_count = profile.follower_count;

    // Flags
    if (profile.is_premium !== undefined) contactUpdate.is_premium = profile.is_premium;
    if (profile.is_creator !== undefined) contactUpdate.is_creator = profile.is_creator;
    if (profile.is_influencer !== undefined) contactUpdate.is_influencer = profile.is_influencer;
    if (profile.is_open_to_work !== undefined) contactUpdate.is_open_to_work = profile.is_open_to_work;
    if (profile.is_hiring !== undefined) contactUpdate.is_hiring = profile.is_hiring;

    // Contact info (only for 1st degree connections)
    if (profile.email) contactUpdate.email = profile.email;
    if (profile.phone) contactUpdate.phone = profile.phone;

    // Rich data (JSONB) - Unipile API field names
    // work_experience (NOT experience)
    const workExp = profile.work_experience || profile.experience;
    if (workExp && Array.isArray(workExp)) {
      contactUpdate.experience = JSON.stringify(workExp);
    }
    if (profile.education && Array.isArray(profile.education)) {
      contactUpdate.education = JSON.stringify(profile.education);
    }
    if (profile.skills && Array.isArray(profile.skills)) {
      contactUpdate.skills = JSON.stringify(profile.skills);
    }
    if (profile.certifications && Array.isArray(profile.certifications)) {
      contactUpdate.certifications = JSON.stringify(profile.certifications);
    }
    if (profile.languages && Array.isArray(profile.languages)) {
      contactUpdate.languages = JSON.stringify(profile.languages);
    }
    if (profile.websites && Array.isArray(profile.websites)) {
      contactUpdate.websites = JSON.stringify(profile.websites);
    }
    if (profile.publications && Array.isArray(profile.publications)) {
      contactUpdate.publications = JSON.stringify(profile.publications);
    }
    // volunteering_experience (NOT volunteer_experience)
    const volunteerExp = profile.volunteering_experience || profile.volunteer_experience;
    if (volunteerExp && Array.isArray(volunteerExp)) {
      contactUpdate.volunteer_experience = JSON.stringify(volunteerExp);
    }
    if (profile.honors_awards && Array.isArray(profile.honors_awards)) {
      contactUpdate.honors_awards = JSON.stringify(profile.honors_awards);
    }
    if (profile.projects && Array.isArray(profile.projects)) {
      contactUpdate.projects = JSON.stringify(profile.projects);
    }
    if (profile.courses && Array.isArray(profile.courses)) {
      contactUpdate.courses = JSON.stringify(profile.courses);
    }
    if (profile.patents && Array.isArray(profile.patents)) {
      contactUpdate.patents = JSON.stringify(profile.patents);
    }
    if (profile.recommendations && Array.isArray(profile.recommendations)) {
      contactUpdate.recommendations = JSON.stringify(profile.recommendations);
    }

    // Network distance
    if (profile.network_distance) {
      contactUpdate.network_distance = profile.network_distance;
    }

    // 4. Extract and enrich current company
    let currentCompanyId = null;
    const experienceData = profile.work_experience || profile.experience;
    if (enrichCompanyData && experienceData && Array.isArray(experienceData)) {
      // Find current job - Unipile uses 'end' not 'end_date', and 'status' for current
      const currentJob = experienceData.find(exp =>
        !exp.end && !exp.end_date || exp.status === 'current' || exp.status === 'CURRENT'
      ) || experienceData[0];

      if (currentJob) {
        // Unipile field names: company (not company_name), position (not title)
        const companyName = currentJob.company || currentJob.company_name || currentJob.organization || currentJob.companyName;
        const jobTitle = currentJob.position || currentJob.title || currentJob.role;
        const companyLogo = currentJob.company_picture_url || currentJob.company_logo_url || currentJob.logo_url || currentJob.companyLogo;

        // Try multiple field names for company ID
        let companyId = currentJob.company_id || currentJob.company_linkedin_id || currentJob.company_urn
          || currentJob.companyId || currentJob.companyUrn || currentJob.company_profile_id;

        // If no company ID, try to extract from company URL
        const companyUrl = currentJob.company_linkedin_url || currentJob.company_url || currentJob.companyUrl || currentJob.url;
        if (!companyId && companyUrl) {
          // Try to extract ID from URL like: /company/12345/ or linkedin.com/company/companyname
          const urlMatch = companyUrl.match(/\/company\/([^\/\?]+)/);
          if (urlMatch && urlMatch[1]) {
            companyId = urlMatch[1];
            console.log('[ENRICHMENT] Extracted company ID from URL:', companyId);
          }
        }

        console.log('[ENRICHMENT] Current job extracted:', {
          companyName,
          jobTitle,
          companyId,
          companyUrl,
          allKeys: Object.keys(currentJob)
        });

        if (companyName) {
          contactUpdate.company = companyName;
        }
        if (jobTitle) {
          contactUpdate.title = jobTitle;
        }

        // Enrich company if we have company_id and company_name
        if (companyId && companyName) {
          // Fetch full company data (may fail, that's ok)
          const companyProfile = await fetchCompanyProfile(unipileAccountId, companyId);
          if (companyProfile && companyProfile.name) {
            currentCompanyId = await enrichCompany(contact.account_id, unipileAccountId, companyProfile);
          } else {
            // Save basic company data from experience
            currentCompanyId = await enrichCompany(contact.account_id, unipileAccountId, {
              id: companyId,
              name: companyName,
              logo_url: companyLogo,
              linkedin_url: currentJob.company_linkedin_url || currentJob.company_url
            });
          }

          if (currentCompanyId) {
            contactUpdate.current_company_id = currentCompanyId;
            console.log('[ENRICHMENT] Setting current_company_id on contact:', { contactId, currentCompanyId });
          } else {
            console.log('[ENRICHMENT] No company ID returned from enrichCompany');
          }
        } else {
          console.log('[ENRICHMENT] Skipping company enrichment - missing companyId or companyName:', { companyId, companyName });
        }
      }
    }

    // 5. Update contact
    // Log what we're saving
    console.log('[ENRICHMENT] Saving enrichment data:', {
      contactId,
      currentCompanyId: contactUpdate.current_company_id,
      hasExperience: !!contactUpdate.experience,
      experienceCount: contactUpdate.experience ? JSON.parse(contactUpdate.experience).length : 0,
      hasEducation: !!contactUpdate.education,
      educationCount: contactUpdate.education ? JSON.parse(contactUpdate.education).length : 0,
      hasSkills: !!contactUpdate.skills,
      skillsCount: contactUpdate.skills ? JSON.parse(contactUpdate.skills).length : 0,
      fieldsUpdated: Object.keys(contactUpdate).length
    });

    await db.update('contacts', contactUpdate, { id: contactId });

    // 6. Generate AI profile analysis
    try {
      const profileForAnalysis = {
        name: contactUpdate.name || contact.name,
        headline: contactUpdate.headline || contact.headline,
        title: contactUpdate.title || contact.title,
        company: contactUpdate.company || contact.company,
        location: contactUpdate.location || contact.location,
        about: contactUpdate.about || contact.about,
        industry: contactUpdate.industry || contact.industry,
        experience: contactUpdate.experience ? JSON.parse(contactUpdate.experience) : null,
        skills: contactUpdate.skills ? JSON.parse(contactUpdate.skills) : null,
        connections_count: contactUpdate.connections_count || contact.connections_count,
        is_premium: contactUpdate.is_premium || contact.is_premium,
        is_creator: contactUpdate.is_creator || contact.is_creator,
        is_open_to_work: contactUpdate.is_open_to_work || contact.is_open_to_work,
        is_hiring: contactUpdate.is_hiring || contact.is_hiring
      };

      const aiAnalysis = await analyzeLinkedInProfile(profileForAnalysis);

      if (aiAnalysis) {
        await db.update('contacts', {
          ai_profile_analysis: JSON.stringify(aiAnalysis),
          ai_analyzed_at: new Date()
        }, { id: contactId });

        console.log(`[ENRICHMENT] AI analysis completed for contact ${contactId} (${aiAnalysis.tokensUsed} tokens)`);
      }
    } catch (aiError) {
      // AI analysis failure should not fail the enrichment
      console.error('[ENRICHMENT] AI analysis failed (non-blocking):', aiError.message);
    }

    return {
      success: true,
      contact_id: contactId,
      company_id: currentCompanyId,
      fields_updated: Object.keys(contactUpdate).length
    };

  } catch (error) {
    console.error(`[ENRICHMENT] Error enriching contact ${contactId}:`, error.message);
    return { error: error.message };
  }
}

// ================================
// ENRICH CONTACT IN BACKGROUND (NON-BLOCKING)
// ================================
async function enrichContactInBackground(contactId, unipileAccountId, providerId, options = {}) {
  // Run enrichment without awaiting (fire-and-forget)
  enrichContact(contactId, unipileAccountId, providerId, options)
    .then(result => {
      if (result.success) {
        console.log(`[ENRICHMENT] Contact ${contactId} enriched successfully (${result.fields_updated} fields)`);
      } else if (result.skipped) {
        // Silent skip
      } else if (result.error) {
        console.error(`[ENRICHMENT] Failed to enrich contact ${contactId}:`, result.error);
      }
    })
    .catch(err => {
      console.error(`[ENRICHMENT] Background enrichment failed for ${contactId}:`, err.message);
    });
}

// ================================
// CHECK IF CONTACT SHOULD BE ENRICHED
// ================================
function shouldEnrichContact(networkDistance, fullProfileFetchedAt) {
  // Only enrich 1st degree connections
  const isFirstDegree = networkDistance === 'DISTANCE_1' ||
                       networkDistance === 'FIRST_DEGREE' ||
                       networkDistance === '1';

  if (!isFirstDegree) {
    return false;
  }

  // Check if recently enriched
  if (fullProfileFetchedAt) {
    const hoursSinceEnrich = (Date.now() - new Date(fullProfileFetchedAt)) / (1000 * 60 * 60);
    if (hoursSinceEnrich < 24) {
      return false;
    }
  }

  return true;
}

// ================================
// MANUAL ENRICHMENT ENDPOINT HELPER
// ================================
async function enrichContactById(contactId, forceRefresh = false) {
  try {
    // Get contact with linked account info
    const contact = await db.findOne('contacts', { id: contactId });
    if (!contact) {
      throw new Error('Contact not found');
    }

    if (!contact.linkedin_profile_id) {
      throw new Error('Contact does not have a LinkedIn profile ID');
    }

    // Find a connected LinkedIn account for this account
    const linkedinAccount = await db.query(
      `SELECT unipile_account_id
       FROM linkedin_accounts
       WHERE account_id = $1 AND status = 'active'
       LIMIT 1`,
      [contact.account_id]
    );

    if (linkedinAccount.rows.length === 0) {
      throw new Error('No active LinkedIn account connected');
    }

    const unipileAccountId = linkedinAccount.rows[0].unipile_account_id;

    return await enrichContact(contactId, unipileAccountId, contact.linkedin_profile_id, {
      forceRefresh,
      enrichCompanyData: true
    });

  } catch (error) {
    console.error(`[ENRICHMENT] Error in enrichContactById:`, error.message);
    throw error;
  }
}

// ================================
// GET COMPANY DATA
// ================================
async function getCompanyById(companyId) {
  return await db.findOne('companies', { id: companyId });
}

async function getCompanyByLinkedInId(accountId, linkedinCompanyId) {
  return await db.findOne('companies', {
    account_id: accountId,
    linkedin_company_id: linkedinCompanyId
  });
}

module.exports = {
  enrichContact,
  enrichContactInBackground,
  enrichContactById,
  shouldEnrichContact,
  fetchFullProfile,
  fetchCompanyProfile,
  enrichCompany,
  getCompanyById,
  getCompanyByLinkedInId
};
