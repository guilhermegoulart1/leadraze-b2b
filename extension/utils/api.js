/**
 * GetRaze API utility module
 * All API calls go through the service worker to avoid CORS issues
 */

const API_BASE_URL = 'https://api.getraze.co/external/v1';

/**
 * Make an API request via the background service worker
 */
async function apiRequest(method, endpoint, body = null) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'API_REQUEST',
        method,
        endpoint,
        body
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        if (response && response.error) {
          reject(response.error);
          return;
        }
        resolve(response);
      }
    );
  });
}

/**
 * Validate API key by calling the info endpoint
 */
async function validateApiKey(apiKey) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      {
        type: 'VALIDATE_API_KEY',
        apiKey
      },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        resolve(response);
      }
    );
  });
}

/**
 * List LinkedIn campaigns
 */
async function listCampaigns() {
  return apiRequest('GET', '/campaigns');
}

/**
 * Add contact to a LinkedIn campaign
 */
async function addContactToCampaign(campaignId, contactData) {
  return apiRequest('POST', `/campaigns/${campaignId}/contacts`, contactData);
}

/**
 * List Instagram agents
 */
async function listInstagramAgents() {
  return apiRequest('GET', '/instagram-agents');
}

/**
 * Add profile to an Instagram agent
 */
async function addInstagramProfile(agentId, profileData) {
  return apiRequest('POST', `/instagram-agents/${agentId}/profiles`, profileData);
}

/**
 * Get stored API key
 */
async function getStoredApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey'], (result) => {
      resolve(result.apiKey || null);
    });
  });
}

/**
 * Save API key to storage
 */
async function saveApiKey(apiKey) {
  return new Promise((resolve) => {
    chrome.storage.local.set({ apiKey }, resolve);
  });
}

/**
 * Clear stored API key
 */
async function clearApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.remove(['apiKey', 'accountInfo'], resolve);
  });
}
