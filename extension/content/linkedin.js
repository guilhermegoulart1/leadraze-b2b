/**
 * GetRaze Chrome Extension - LinkedIn Content Script
 * Injects "Add to GetRaze" button on LinkedIn profile pages
 */

(function () {
  'use strict';

  const BUTTON_ID = 'getraze-linkedin-btn';
  const WRAPPER_ID = 'getraze-linkedin-wrapper';
  let currentUrl = '';
  let dropdownOpen = false;

  /** Helper to get i18n message */
  const t = (key, substitutions) => chrome.i18n.getMessage(key, substitutions) || key;

  /**
   * Check if we're on a LinkedIn profile page
   */
  function isProfilePage() {
    return /^\/in\/[^/]+\/?/.test(window.location.pathname);
  }

  /**
   * Extract profile data from LinkedIn DOM
   */
  function extractProfileData() {
    const data = {
      name: '',
      title: '',
      company: '',
      location: '',
      linkedin_profile_url: '',
      profile_picture: '',
      about: '',
      extracted_contacts: { emails: [], phones: [], websites: [] }
    };

    // Profile URL (most reliable - from URL)
    const path = window.location.pathname.split('?')[0].replace(/\/+$/, '');
    data.linkedin_profile_url = `https://www.linkedin.com${path}`;

    // Profile photo
    const photoSelectors = [
      'img.pv-top-card-profile-picture__image--show',
      'img.pv-top-card-profile-picture__image',
      '.pv-top-card__photo img',
      'main section img.evi-image[width="200"]',
      'button[aria-label*="photo"] img',
      'button[aria-label*="foto"] img'
    ];
    for (const selector of photoSelectors) {
      const el = document.querySelector(selector);
      if (el && el.src && el.src.startsWith('http')) {
        data.profile_picture = el.src;
        break;
      }
    }

    // Name - main h1 on profile
    const nameEl = document.querySelector('h1.text-heading-xlarge')
      || document.querySelector('.pv-top-card h1')
      || document.querySelector('h1');
    if (nameEl) {
      data.name = nameEl.textContent.trim();
    }

    // Headline/Title
    const headlineEl = document.querySelector('.text-body-medium.break-words')
      || document.querySelector('.pv-top-card--list .text-body-medium');
    if (headlineEl) {
      data.title = headlineEl.textContent.trim();
    }

    // Location
    const locationEl = document.querySelector('.text-body-small.inline.t-black--light.break-words')
      || document.querySelector('.pv-top-card--list-bullet .text-body-small');
    if (locationEl) {
      data.location = locationEl.textContent.trim();
    }

    // Company - try to extract from headline or experience section
    const experienceSection = document.querySelector('#experience ~ .pvs-list__outer-container .pvs-entity__path-node + div span[aria-hidden="true"]');
    if (experienceSection) {
      data.company = experienceSection.textContent.trim();
    }

    // About section
    const aboutSelectors = [
      '#about ~ div .inline-show-more-text span[aria-hidden="true"]',
      '#about ~ div .pv-shared-text-with-see-more span[aria-hidden="true"]',
      '#about + div + div span.visually-hidden + span',
      '.pv-about__summary-text span[aria-hidden="true"]'
    ];
    for (const selector of aboutSelectors) {
      const el = document.querySelector(selector);
      if (el && el.textContent.trim().length > 10) {
        data.about = el.textContent.trim();
        break;
      }
    }

    // Extract contacts from about section and headline
    const textToParse = [data.about, data.title].filter(Boolean).join(' ');
    data.extracted_contacts = extractContactsFromText(textToParse);

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

    return contacts;
  }

  /**
   * Create the GetRaze button
   */
  function createButton() {
    // Remove existing if present
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

    // Find the row containing Connect/Message/More buttons
    // LinkedIn uses buttons with specific text - find them and inject next to them
    const allButtons = document.querySelectorAll('main section button');
    let targetRow = null;

    for (const btn of allButtons) {
      const text = btn.textContent.trim().toLowerCase();
      if (text === 'connect' || text === 'conectar' || text === 'message' || text === 'mensagem' || text === 'more' || text === 'mais') {
        // Found an action button - its parent is the button row
        targetRow = btn.parentElement;
        break;
      }
    }

    if (targetRow) {
      const wrapper = createButton();
      wrapper.style.marginLeft = '8px';
      wrapper.style.display = 'inline-flex';
      wrapper.style.alignItems = 'center';
      targetRow.appendChild(wrapper);
      return;
    }

    // Fallback: look for known class-based containers
    const actionsSelectors = [
      '.pvs-profile-actions',
      '.pv-top-card-v2-ctas'
    ];

    for (const selector of actionsSelectors) {
      const container = document.querySelector(selector);
      if (container) {
        const wrapper = createButton();
        wrapper.style.marginLeft = '8px';
        wrapper.style.display = 'inline-flex';
        container.appendChild(wrapper);
        return;
      }
    }
  }

  /**
   * Handle button click - show dropdown
   */
  async function handleButtonClick(e) {
    e.stopPropagation();

    if (dropdownOpen) {
      closeDropdown();
      return;
    }

    // Check if API key is set
    chrome.runtime.sendMessage({ type: 'CHECK_API_KEY' }, (response) => {
      if (!response || !response.hasKey) {
        showDropdown(createNoKeyContent());
        return;
      }
      showDropdown(createLoadingContent());
      loadCampaigns();
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

    // Header
    const header = document.createElement('div');
    header.className = 'getraze-dropdown-header';
    const dropdownLogoUrl = chrome.runtime.getURL('icons/logo24.png');
    header.innerHTML = `
      <img src="${dropdownLogoUrl}" alt="GetRaze" class="getraze-dropdown-logo" width="24" height="24">
      <div>
        <div class="getraze-dropdown-title">GetRaze</div>
        <div class="getraze-dropdown-subtitle">${t('linkedinDropdownSubtitle')}</div>
      </div>
    `;
    dropdown.appendChild(header);

    // Body
    const body = document.createElement('div');
    body.className = 'getraze-dropdown-body';
    body.id = 'getraze-dropdown-body';
    body.appendChild(content);
    dropdown.appendChild(body);

    wrapper.appendChild(dropdown);
    dropdownOpen = true;

    // Close on outside click
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
    div.innerHTML = `<div class="getraze-spinner"></div><div class="getraze-loading-text">${t('linkedinLoadingCampaigns')}</div>`;
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
   * Load campaigns from API
   */
  function loadCampaigns() {
    chrome.runtime.sendMessage({ type: 'GET_CAMPAIGNS' }, (response) => {
      const body = document.getElementById('getraze-dropdown-body');
      if (!body) return;

      body.innerHTML = '';

      if (response && response.error) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'getraze-error';
        errorDiv.textContent = response.error.message || t('linkedinErrorLoad');
        body.appendChild(errorDiv);
        return;
      }

      const campaigns = response?.data || [];

      if (campaigns.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'getraze-empty';
        empty.textContent = t('linkedinEmpty');
        body.appendChild(empty);
        return;
      }

      campaigns.forEach((campaign) => {
        const item = createCampaignItem(campaign);
        body.appendChild(item);
      });
    });
  }

  /**
   * Create a campaign list item
   */
  function createCampaignItem(campaign) {
    const item = document.createElement('div');
    item.className = 'getraze-item';

    const info = document.createElement('div');
    info.className = 'getraze-item-info';
    info.innerHTML = `
      <div class="getraze-item-name">${escapeHtml(campaign.name)}</div>
      <div class="getraze-item-detail">${t('linkedinContactDetail', [String(campaign.contact_count || 0), campaign.status])}</div>
    `;

    const actionBtn = document.createElement('button');
    actionBtn.className = 'getraze-item-action';
    actionBtn.textContent = t('btnAdd');
    actionBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      addToCampaign(campaign, actionBtn);
    });

    item.appendChild(info);
    item.appendChild(actionBtn);
    return item;
  }

  /**
   * Add profile to a campaign
   */
  function addToCampaign(campaign, btn) {
    const profileData = extractProfileData();

    if (!profileData.name) {
      showToast(t('linkedinCantExtractName'), 'error');
      return;
    }

    btn.disabled = true;
    btn.textContent = '...';

    chrome.runtime.sendMessage(
      {
        type: 'ADD_TO_CAMPAIGN',
        campaignId: campaign.id,
        contactData: profileData
      },
      (response) => {
        if (response && response.success) {
          btn.textContent = t('btnAdded');
          btn.classList.add('success');
          showToast(t('linkedinAddedToCampaign', [profileData.name, campaign.name]), 'success');
        } else {
          const errorMsg = response?.error?.message || t('errorAddGeneric');
          if (response?.error?.code === 'DUPLICATE_ERROR') {
            btn.textContent = t('btnAlreadyExists');
            btn.classList.add('error');
            showToast(t('linkedinAlreadyInCampaign'), 'info');
          } else {
            btn.textContent = t('btnError');
            btn.classList.add('error');
            // Show debug info if available
            const debugInfo = response?.error?.debug;
            if (debugInfo && debugInfo.pg_message) {
              console.error('[GetRaze] DB Error:', debugInfo);
              showToast(`${errorMsg} (DB: ${debugInfo.pg_message})`, 'error');
            } else {
              showToast(errorMsg, 'error');
            }
            // Re-enable after 2s for retry
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
    // Remove existing toast
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
   * Escape HTML for safe rendering
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
    // Check URL changes periodically (LinkedIn SPA)
    setInterval(() => {
      if (window.location.href !== currentUrl) {
        currentUrl = window.location.href;
        onUrlChange();
      }
    }, 1000);

    // Also observe DOM mutations for dynamic content loading
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

    // Remove old button
    const existing = document.getElementById(WRAPPER_ID);
    if (existing) existing.remove();

    // Inject new button if on profile page
    if (isProfilePage()) {
      // LinkedIn loads content progressively - retry with increasing delays
      setTimeout(injectButton, 500);
      setTimeout(injectButton, 1500);
      setTimeout(injectButton, 3000);
    }
  }

  /**
   * Initialize
   */
  function init() {
    currentUrl = window.location.href;

    if (isProfilePage()) {
      // LinkedIn loads content progressively - retry with increasing delays
      if (document.readyState === 'complete') {
        setTimeout(injectButton, 1000);
        setTimeout(injectButton, 2000);
        setTimeout(injectButton, 4000);
      } else {
        window.addEventListener('load', () => {
          setTimeout(injectButton, 1000);
          setTimeout(injectButton, 2500);
          setTimeout(injectButton, 5000);
        });
      }
    }

    observeNavigation();
  }

  // Start
  init();
})();
