/**
 * GetRaze Chrome Extension - Instagram Content Script
 * Injects "Add to GetRaze" button on Instagram profile pages
 */

(function () {
  'use strict';

  const BUTTON_ID = 'getraze-instagram-btn';
  const WRAPPER_ID = 'getraze-instagram-wrapper';
  let currentUrl = '';
  let dropdownOpen = false;

  /** Helper to get i18n message */
  const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;

  // Paths that are NOT profile pages
  const NON_PROFILE_PATHS = [
    '/p/', '/reel/', '/reels/', '/stories/', '/explore/',
    '/direct/', '/accounts/', '/tags/', '/locations/',
    '/nametag/', '/ar/', '/tv/'
  ];

  /**
   * Check if we're on an Instagram profile page
   */
  function isProfilePage() {
    const path = window.location.pathname;

    // Must have at least one segment
    if (path === '/' || path === '') return false;

    // Exclude known non-profile paths
    for (const nonProfile of NON_PROFILE_PATHS) {
      if (path.startsWith(nonProfile)) return false;
    }

    // Profile page: /{username}/ or /{username}
    const segments = path.split('/').filter(Boolean);
    return segments.length === 1;
  }

  /**
   * Extract username from URL
   */
  function extractUsername() {
    const segments = window.location.pathname.split('/').filter(Boolean);
    return segments[0] || '';
  }

  /**
   * Extract profile data from Instagram DOM
   */
  function extractProfileData() {
    const username = extractUsername();

    const data = {
      username: username,
      display_name: '',
      profile_url: `https://www.instagram.com/${username}`,
      bio: '',
      followers_count: null,
      following_count: null,
      posts_count: null,
      external_url: '',
      extracted_contacts: { emails: [], phones: [], websites: [] }
    };

    // Try to get display name from the profile header
    // Instagram's DOM changes frequently; try multiple selectors
    const nameSelectors = [
      'header section span[dir="auto"]',
      'header h2 + span',
      'header section > div > div > span',
      'main header span.x1lliihq'
    ];

    for (const selector of nameSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim() && el.textContent.trim() !== username) {
        data.display_name = el.textContent.trim();
        break;
      }
    }

    // If no display name found, use username
    if (!data.display_name) {
      data.display_name = username;
    }

    // Extract bio text
    const bioSelectors = [
      'header section > div.-vDIg span',
      'header section h1 + div span',
      'header section div[class*="notranslate"] > span',
      'main header section span.x1lliihq.x1plvlek'
    ];
    for (const selector of bioSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim()) {
        const text = el.textContent.trim();
        // Avoid picking up the display name or stats
        if (text !== data.display_name && text.length > 3) {
          data.bio = text;
          break;
        }
      }
    }

    // Fallback: look for bio in the meta description tag
    if (!data.bio) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content') || '';
        // Meta description format: "X Followers, Y Following, Z Posts - See Instagram photos and videos from Name (@user)"
        const dashIndex = content.indexOf(' - ');
        if (dashIndex > -1) {
          data.bio = content.substring(dashIndex + 3).replace(/See Instagram photos and videos from .+$/, '').trim();
        }
      }
    }

    // Extract stats (posts, followers, following) from header
    const statElements = document.querySelectorAll('header section ul li, header section > div > div > div > a, header section > div > div > div > span');
    const statTexts = [];
    statElements.forEach(el => {
      const text = el.textContent.trim();
      if (text && /\d/.test(text)) {
        statTexts.push(text);
      }
    });

    // Parse stat values - Instagram shows them as "X posts", "X followers", "X following"
    // or in some layouts as separate elements with numbers and labels
    for (const text of statTexts) {
      const lower = text.toLowerCase();
      const num = parseStatNumber(text);
      if (num === null) continue;

      if (lower.includes('post') || lower.includes('publicac') || lower.includes('publicaç')) {
        if (data.posts_count === null) data.posts_count = num;
      } else if (lower.includes('follower') || lower.includes('seguidor')) {
        if (data.followers_count === null) data.followers_count = num;
      } else if (lower.includes('following') || lower.includes('seguindo')) {
        if (data.following_count === null) data.following_count = num;
      }
    }

    // Fallback: try to get stats from meta description
    if (data.followers_count === null) {
      const metaDesc = document.querySelector('meta[name="description"]');
      if (metaDesc) {
        const content = metaDesc.getAttribute('content') || '';
        const followersMatch = content.match(/([\d.,]+[KkMm]?)\s*Followers/i);
        const followingMatch = content.match(/([\d.,]+[KkMm]?)\s*Following/i);
        const postsMatch = content.match(/([\d.,]+[KkMm]?)\s*Posts/i);
        if (followersMatch) data.followers_count = parseStatNumber(followersMatch[1] + ' followers');
        if (followingMatch) data.following_count = parseStatNumber(followingMatch[1] + ' following');
        if (postsMatch) data.posts_count = parseStatNumber(postsMatch[1] + ' posts');
      }
    }

    // Extract external URL
    const linkSelectors = [
      'header section a[rel="me nofollow noopener noreferrer"]',
      'header section a[target="_blank"][href*="l.instagram.com"]',
      'header section div a[role="link"][target="_blank"]'
    ];
    for (const selector of linkSelectors) {
      const el = document.querySelector(selector);
      if (el) {
        data.external_url = el.textContent.trim() || el.href || '';
        break;
      }
    }

    // Extract contacts from bio and external_url
    const textToParse = [data.bio, data.external_url].filter(Boolean).join(' ');
    data.extracted_contacts = extractContactsFromText(textToParse);

    // If external_url looks like a website and not already captured
    if (data.external_url && data.extracted_contacts.websites.length === 0) {
      const url = data.external_url;
      if (url.match(/^https?:\/\//) || url.match(/\w+\.\w{2,}/)) {
        data.extracted_contacts.websites.push(url);
      }
    }

    return data;
  }

  /**
   * Extract contact info (emails, phones, websites) from text
   */
  function extractContactsFromText(text) {
    const contacts = { emails: [], phones: [], websites: [] };
    if (!text) return contacts;

    // Extract emails
    const emailRegex = /[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g;
    const emails = text.match(emailRegex);
    if (emails) {
      contacts.emails = [...new Set(emails.map(e => e.toLowerCase()))];
    }

    // Extract phone numbers (BR and international formats)
    const phoneRegex = /(?:\+?\d{1,3}[\s.-]?)?\(?\d{2,3}\)?[\s.-]?\d{4,5}[\s.-]?\d{4}/g;
    const phones = text.match(phoneRegex);
    if (phones) {
      contacts.phones = [...new Set(phones.map(p => p.replace(/[\s.-]/g, '').replace(/[()]/g, '')))];
    }

    // Extract URLs/websites
    const urlRegex = /https?:\/\/[^\s,;)>\]]+/gi;
    const urls = text.match(urlRegex);
    if (urls) {
      contacts.websites = [...new Set(urls.map(u => u.replace(/[.,;]+$/, '')))];
    }

    // Also catch domain-style links without protocol (e.g. "wa.me/5511999", "linktr.ee/user")
    const domainRegex = /(?:^|\s)((?:wa\.me|bit\.ly|linktr\.ee|linkedin\.com|api\.whatsapp\.com)[^\s,;)>\]]*)/gi;
    const domains = text.match(domainRegex);
    if (domains) {
      domains.forEach(d => {
        const clean = d.trim();
        if (!contacts.websites.some(w => w.includes(clean))) {
          contacts.websites.push('https://' + clean);
        }
      });
    }

    return contacts;
  }

  /**
   * Parse Instagram stat numbers (handles "1,234", "12.3K", "1.5M", "1.234" (pt-BR), etc.)
   */
  function parseStatNumber(text) {
    // Extract the numeric part
    const match = text.match(/([\d.,]+)\s*([KkMm]?)/);
    if (!match) return null;

    let numStr = match[1];
    const suffix = match[2].toUpperCase();

    // Handle locale differences: "1.234" (pt-BR thousands) vs "1.2K"
    if (suffix) {
      // Has K/M suffix - treat dots as decimals
      numStr = numStr.replace(',', '.');
      let num = parseFloat(numStr);
      if (suffix === 'K') num *= 1000;
      if (suffix === 'M') num *= 1000000;
      return Math.round(num);
    }

    // No suffix - remove thousand separators
    numStr = numStr.replace(/[.,]/g, '');
    const num = parseInt(numStr, 10);
    return isNaN(num) ? null : num;
  }

  /**
   * Create the GetRaze button
   */
  function createButton() {
    const existing = document.getElementById(WRAPPER_ID);
    if (existing) existing.remove();

    const wrapper = document.createElement('div');
    wrapper.id = WRAPPER_ID;
    wrapper.className = 'getraze-wrapper';

    const btn = document.createElement('button');
    btn.id = BUTTON_ID;
    btn.className = 'getraze-btn';
    const logoUrl = chrome.runtime.getURL('icons/logo16.png');
    btn.innerHTML = `<img src="${logoUrl}" alt="GR" class="getraze-btn-icon" width="16" height="16"> ${t('btnAddToGetraze')}`;
    btn.addEventListener('click', handleButtonClick);

    wrapper.appendChild(btn);
    return wrapper;
  }

  /**
   * Inject the button into the page
   */
  function injectButton() {
    if (!isProfilePage()) return;
    if (document.getElementById(WRAPPER_ID)) return;

    const header = document.querySelector('header');
    if (!header) return;

    // Find the profile photo img in the header
    const profileImg = header.querySelector('img[draggable="false"][alt]')
      || header.querySelector('canvas')
      || header.querySelector('span[role="link"] img');

    if (profileImg) {
      // Walk up to find the top-level column that holds the photo
      // (direct child of <header>)
      let photoColumn = profileImg;
      while (photoColumn && photoColumn.parentElement !== header) {
        photoColumn = photoColumn.parentElement;
      }

      if (photoColumn && photoColumn !== header) {
        // Position button centered below the photo, slightly overlapping the bottom
        photoColumn.style.position = 'relative';

        const wrapper = createButton();
        wrapper.style.position = 'absolute';
        wrapper.style.bottom = '20px';
        wrapper.style.left = '50%';
        wrapper.style.transform = 'translateX(-50%)';
        wrapper.style.zIndex = '10';
        photoColumn.appendChild(wrapper);
        return;
      }
    }

    // Fallback: insert after the header
    const wrapper = createButton();
    wrapper.style.margin = '12px 0 0 16px';
    header.parentElement.insertBefore(wrapper, header.nextSibling);
  }

  /**
   * Handle button click
   */
  async function handleButtonClick(e) {
    e.stopPropagation();

    if (dropdownOpen) {
      closeDropdown();
      return;
    }

    chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' }, (response) => {
      if (!response || !response.hasKey) {
        showDropdown(createNoKeyContent());
        return;
      }
      showDropdown(createLoadingContent());
      loadInstagramAgents();
    });
  }

  /**
   * Show dropdown panel
   */
  function showDropdown(content) {
    closeDropdown();

    const wrapper = document.getElementById(WRAPPER_ID);
    if (!wrapper) return;

    const dropdown = document.createElement('div');
    dropdown.className = 'getraze-dropdown';
    dropdown.id = 'getraze-dropdown';

    const header = document.createElement('div');
    header.className = 'getraze-dropdown-header';
    const dropdownLogoUrl = chrome.runtime.getURL('icons/logo24.png');
    header.innerHTML = `
      <img src="${dropdownLogoUrl}" alt="GetRaze" class="getraze-dropdown-logo" width="24" height="24">
      <div>
        <div class="getraze-dropdown-title">GetRaze</div>
        <div class="getraze-dropdown-subtitle">${t('instagramDropdownSubtitle')}</div>
      </div>
    `;
    dropdown.appendChild(header);

    const body = document.createElement('div');
    body.className = 'getraze-dropdown-body';
    body.id = 'getraze-dropdown-body';
    body.appendChild(content);
    dropdown.appendChild(body);

    wrapper.appendChild(dropdown);
    dropdownOpen = true;

    setTimeout(() => {
      document.addEventListener('click', handleOutsideClick);
    }, 10);
  }

  /**
   * Close dropdown
   */
  function closeDropdown() {
    const dropdown = document.getElementById('getraze-dropdown');
    if (dropdown) dropdown.remove();
    dropdownOpen = false;
    document.removeEventListener('click', handleOutsideClick);
  }

  /**
   * Handle click outside dropdown
   */
  function handleOutsideClick(e) {
    const dropdown = document.getElementById('getraze-dropdown');
    const btn = document.getElementById(BUTTON_ID);
    if (dropdown && !dropdown.contains(e.target) && e.target !== btn && !btn.contains(e.target)) {
      closeDropdown();
    }
  }

  /**
   * Create loading content
   */
  function createLoadingContent() {
    const div = document.createElement('div');
    div.className = 'getraze-loading';
    div.innerHTML = `<div class="getraze-spinner"></div><div class="getraze-loading-text">${t('instagramLoadingAgents')}</div>`;
    return div;
  }

  /**
   * Create no-key content
   */
  function createNoKeyContent() {
    const div = document.createElement('div');
    div.className = 'getraze-no-key';
    div.textContent = t('noApiKey');
    return div;
  }

  /**
   * Load Instagram agents from API
   */
  function loadInstagramAgents() {
    chrome.runtime.sendMessage({ type: 'GET_INSTAGRAM_AGENTS' }, (response) => {
      const body = document.getElementById('getraze-dropdown-body');
      if (!body) return;

      body.innerHTML = '';

      if (response && response.error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'getraze-error';
        errorDiv.textContent = response.error.message || t('instagramErrorLoad');
        body.appendChild(errorDiv);
        return;
      }

      const agents = response?.data || [];

      if (agents.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'getraze-empty';
        empty.textContent = t('instagramEmpty');
        body.appendChild(empty);
        return;
      }

      agents.forEach((agent) => {
        const item = createAgentItem(agent);
        body.appendChild(item);
      });
    });
  }

  /**
   * Create an agent list item
   */
  function createAgentItem(agent) {
    const item = document.createElement('div');
    item.className = 'getraze-item';

    const info = document.createElement('div');
    info.className = 'getraze-item-info';
    info.innerHTML = `
      <div class="getraze-item-name">${escapeHtml(agent.name)}</div>
      <div class="getraze-item-detail">${t('instagramProfileDetail', [String(agent.total_profiles_found || 0), agent.status])}</div>
    `;

    const actionBtn = document.createElement('button');
    actionBtn.className = 'getraze-item-action';
    actionBtn.textContent = t('btnAdd');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToAgent(agent, actionBtn);
    });

    item.appendChild(info);
    item.appendChild(actionBtn);
    return item;
  }

  /**
   * Add profile to an Instagram agent
   */
  function addToAgent(agent, btn) {
    const profileData = extractProfileData();

    if (!profileData.username) {
      showToast(t('instagramCantExtractUsername'), 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = '...';

    chrome.runtime.sendMessage(
      {
        type: 'ADD_TO_INSTAGRAM_AGENT',
        agentId: agent.id,
        profileData: profileData
      },
      (response) => {
        if (response && response.success) {
          btn.textContent = t('btnAdded');
          btn.classList.add('success');
          showToast(t('instagramAddedToAgent', [profileData.username, agent.name]), 'success');
        } else {
          const errorMsg = response?.error?.message || t('errorAddGeneric');
          if (response?.error?.code === 'DUPLICATE_ERROR') {
            btn.textContent = t('btnAlreadyExists');
            btn.classList.add('error');
            showToast(t('instagramAlreadyInAgent'), 'info');
          } else {
            btn.textContent = t('btnError');
            btn.classList.add('error');
            showToast(errorMsg, 'error');
            setTimeout(() => {
              btn.disabled = false;
              btn.textContent = t('btnAdd');
              btn.classList.remove('error');
            }, 2000);
          }
        }
      }
    );
  }

  /**
   * Show toast notification
   */
  function showToast(message, type = 'info') {
    const existing = document.querySelector('.getraze-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = `getraze-toast ${type}`;
    toast.textContent = message;
    document.body.appendChild(toast);

    setTimeout(() => {
      toast.style.animation = 'getraze-toastOut 0.3s ease-in forwards';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  /**
   * Escape HTML
   */
  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  /**
   * Observe DOM changes for SPA navigation
   */
  function observeNavigation() {
    setInterval(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        onUrlChange();
      }
    }, 1000);

    const observer = new MutationObserver(() => {
      if (isProfilePage() && !document.getElementById(WRAPPER_ID)) {
        injectButton();
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });
  }

  /**
   * Handle URL change
   */
  function onUrlChange() {
    closeDropdown();

    const existing = document.getElementById(WRAPPER_ID);
    if (existing) existing.remove();

    if (isProfilePage()) {
      setTimeout(injectButton, 500);
    }
  }

  /**
   * Initialize
   */
  function init() {
    currentUrl = window.location.href;

    if (isProfilePage()) {
      if (document.readyState === 'complete') {
        setTimeout(injectButton, 1000);
      } else {
        window.addEventListener('load', () => setTimeout(injectButton, 1000));
      }
    }

    observeNavigation();
  }

  // Start
  init();
})();
