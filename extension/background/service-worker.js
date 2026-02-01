/**
 * GetRaze Chrome Extension - Background Service Worker
 * Handles API communication and acts as proxy for content scripts
 */

const API_BASE_URL = 'https://api.getraze.co/external/v1';

// Cache for campaigns and agents (5 min TTL)
const cache = {
  campaigns: { data: null, timestamp: 0 },
  instagramAgents: { data: null, timestamp: 0 }
};
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get stored API key from chrome.storage
 */
async function getApiKey() {
  return new Promise((resolve) => {
    chrome.storage.local.get(['apiKey'], (result) => {
      resolve(result.apiKey || null);
    });
  });
}

/**
 * Make HTTP request to GetRaze API
 */
async function makeApiRequest(method, endpoint, body = null, apiKeyOverride = null) {
  const apiKey = apiKeyOverride || await getApiKey();

  if (!apiKey) {
    return { error: { code: 'NO_API_KEY', message: 'API key not configured. Click the GetRaze icon to set up.' } };
  }

  const url = `${API_BASE_URL}${endpoint}`;
  const options = {
    method,
    headers: {
      'X-API-Key': apiKey,
      'Content-Type': 'application/json'
    }
  };

  if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
    options.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, options);
    const data = await response.json();

    if (!response.ok) {
      return { error: data.error || { code: 'HTTP_ERROR', message: `HTTP ${response.status}` } };
    }

    return data;
  } catch (error) {
    console.error('GetRaze API request failed:', error);
    return { error: { code: 'NETWORK_ERROR', message: 'Failed to connect to GetRaze API. Check your internet connection.' } };
  }
}

/**
 * Get cached data or fetch fresh
 */
async function getCachedOrFetch(cacheKey, endpoint) {
  const cached = cache[cacheKey];
  if (cached.data && (Date.now() - cached.timestamp) < CACHE_TTL) {
    return cached.data;
  }

  const result = await makeApiRequest('GET', endpoint);
  if (result && !result.error) {
    cache[cacheKey] = { data: result, timestamp: Date.now() };
  }
  return result;
}

/**
 * Invalidate cache
 */
function invalidateCache(key) {
  if (key) {
    cache[key] = { data: null, timestamp: 0 };
  } else {
    Object.keys(cache).forEach(k => {
      cache[k] = { data: null, timestamp: 0 };
    });
  }
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'API_REQUEST') {
    handleApiRequest(message).then(sendResponse);
    return true; // Keep the message channel open for async response
  }

  if (message.type === 'VALIDATE_API_KEY') {
    handleValidateApiKey(message.apiKey).then(sendResponse);
    return true;
  }

  if (message.type === 'GET_CAMPAIGNS') {
    getCachedOrFetch('campaigns', '/campaigns').then(sendResponse);
    return true;
  }

  if (message.type === 'GET_INSTAGRAM_AGENTS') {
    getCachedOrFetch('instagramAgents', '/instagram-agents').then(sendResponse);
    return true;
  }

  if (message.type === 'ADD_TO_CAMPAIGN') {
    makeApiRequest('POST', `/campaigns/${message.campaignId}/contacts`, message.contactData)
      .then((result) => {
        if (!result.error) {
          invalidateCache('campaigns');
        }
        sendResponse(result);
      });
    return true;
  }

  if (message.type === 'ADD_TO_INSTAGRAM_AGENT') {
    makeApiRequest('POST', `/instagram-agents/${message.agentId}/profiles`, message.profileData)
      .then((result) => {
        if (!result.error) {
          invalidateCache('instagramAgents');
        }
        sendResponse(result);
      });
    return true;
  }

  if (message.type === 'INVALIDATE_CACHE') {
    invalidateCache(message.key);
    sendResponse({ success: true });
    return true;
  }

  if (message.type === 'CHECK_API_KEY') {
    getApiKey().then((key) => {
      sendResponse({ hasKey: !!key });
    });
    return true;
  }
});

/**
 * Handle generic API request
 */
async function handleApiRequest(message) {
  return makeApiRequest(message.method, message.endpoint, message.body);
}

/**
 * Validate an API key
 */
async function handleValidateApiKey(apiKey) {
  const result = await makeApiRequest('GET', '', null, apiKey);
  if (result && !result.error && result.success) {
    // Store the validated key
    await chrome.storage.local.set({
      apiKey,
      accountInfo: {
        validatedAt: new Date().toISOString()
      }
    });
    invalidateCache();
    return { success: true, data: result };
  }
  return { success: false, error: result.error || { message: 'Invalid API key' } };
}

/**
 * Listen for API key changes to invalidate cache
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.apiKey) {
    invalidateCache();
  }
});
