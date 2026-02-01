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
      profile_url: `https://www.instagram.com/${username}`
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

    return data;
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

    // Instagram profile header - try to find the action buttons area
    const headerSection = document.querySelector('header section');

    if (headerSection) {
      // Look for the row with action buttons (Follow, Message, etc.)
      const actionRow = headerSection.querySelector('div:has(> button)')
        || headerSection.querySelector('div > div:has(> button)');

      if (actionRow) {
        const wrapper = createButton();
        wrapper.style.marginLeft = '8px';
        actionRow.appendChild(wrapper);
        return;
      }

      // Fallback: append to header section
      const wrapper = createButton();
      wrapper.style.margin = '12px 0 0 0';
      headerSection.appendChild(wrapper);
    }
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
    header.innerHTML = `
      <div class="getraze-dropdown-logo">GR</div>
      <div>
        <div class="getraze-dropdown-title">GetRaze</div>
        <div class="getraze-dropdown-subtitle">Selecione um agente Instagram</div>
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
    div.innerHTML = '<div class="getraze-spinner"></div><div class="getraze-loading-text">Carregando agentes...</div>';
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
        errorDiv.textContent = response.error.message || 'Erro ao carregar agentes.';
        body.appendChild(errorDiv);
        return;
      }

      const agents = response?.data || [];

      if (agents.length === 0) {
        const empty = document.createElement('div');
        empty.className = 'getraze-empty';
        empty.textContent = 'Nenhum agente Instagram encontrado. Crie um agente no painel GetRaze.';
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
      <div class="getraze-item-detail">${agent.total_profiles_found || 0} perfis - ${agent.status}</div>
    `;

    const actionBtn = document.createElement('button');
    actionBtn.className = 'getraze-item-action';
    actionBtn.textContent = 'Adicionar';
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
      showToast('Nao foi possivel extrair o username do perfil.', 'error');
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
          btn.textContent = 'Adicionado';
          btn.classList.add('success');
          showToast(`@${profileData.username} adicionado a "${agent.name}"`, 'success');
        } else {
          const errorMsg = response?.error?.message || 'Erro ao adicionar.';
          if (response?.error?.code === 'DUPLICATE_ERROR') {
            btn.textContent = 'Ja existe';
            btn.classList.add('error');
            showToast('Este perfil ja esta nesse agente.', 'info');
          } else {
            btn.textContent = 'Erro';
            btn.classList.add('error');
            showToast(errorMsg, 'error');
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
