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
      linkedin_profile_url: ''
    };

    // Profile URL (most reliable - from URL)
    const path = window.location.pathname.split('?')[0].replace(/\/+$/, '');
    data.linkedin_profile_url = `https://www.linkedin.com${path}`;

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

    return data;
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
    btn.innerHTML = '<span class="getraze-btn-icon">GR</span> Adicionar ao GetRaze';
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

    // Wait for the profile actions area to load
    const actionsContainer = document.querySelector('.pv-top-card-v2-ctas')
      || document.querySelector('.pvs-profile-actions')
      || document.querySelector('.pv-top-card--list .display-flex');

    if (actionsContainer) {
      const wrapper = createButton();
      wrapper.style.marginLeft = '8px';
      actionsContainer.appendChild(wrapper);
    } else {
      // Fallback: insert after the profile header
      const header = document.querySelector('.pv-top-card')
        || document.querySelector('.scaffold-layout__main');
      if (header) {
        const wrapper = createButton();
        wrapper.style.margin = '8px 0 0 24px';
        header.appendChild(wrapper);
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
    header.innerHTML = `
      <div class="getraze-dropdown-logo">GR</div>
      <div>
        <div class="getraze-dropdown-title">GetRaze</div>
        <div class="getraze-dropdown-subtitle">Selecione uma campanha LinkedIn</div>
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
    div.innerHTML = '<div class="getraze-spinner"></div><div class="getraze-loading-text">Carregando campanhas...</div>';
    return div;
  }

  /**
   * Create no-key content
   */
  function createNoKeyContent() {
    const div = document.createElement('div');
    div.className = 'getraze-no-key';
    div.textContent = 'API Key nao configurada. Clique no icone da extensao GetRaze para conectar sua conta.';
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
        errorDiv.textContent = response.error.message || 'Erro ao carregar campanhas.';
        body.appendChild(errorDiv);
        return;
      }

      const campaigns = response?.data || [];

      if (campaigns.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'getraze-empty';
        empty.textContent = 'Nenhuma campanha LinkedIn encontrada. Crie uma campanha no painel GetRaze.';
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
      <div class="getraze-item-detail">${campaign.contact_count || 0} contatos - ${campaign.status}</div>
    `;

    const actionBtn = document.createElement('button');
    actionBtn.className = 'getraze-item-action';
    actionBtn.textContent = 'Adicionar';
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
      showToast('Nao foi possivel extrair o nome do perfil.', 'error');
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
          btn.textContent = 'Adicionado';
          btn.classList.add('success');
          showToast(`${profileData.name} adicionado a "${campaign.name}"`, 'success');
        } else {
          const errorMsg = response?.error?.message || 'Erro ao adicionar.';
          if (response?.error?.code === 'DUPLICATE_ERROR') {
            btn.textContent = 'Ja existe';
            btn.classList.add('error');
            showToast('Este perfil ja esta nessa campanha.', 'info');
          } else {
            btn.textContent = 'Erro';
            btn.classList.add('error');
            showToast(errorMsg, 'error');
            // Re-enable after 2s for retry
            setTimeout(() => {
              btn.disabled = false;
              btn.textContent = 'Adicionar';
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
      // Small delay to let the new page render
      setTimeout(injectButton, 500);
    }
  }

  /**
   * Initialize
   */
  function init() {
    currentUrl = window.location.href;

    if (isProfilePage()) {
      // Wait for page to be ready
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
