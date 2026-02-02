/**
 * GetRaze Chrome Extension - Popup Script
 * Handles API key configuration and connection status
 */

const setupSection = document.getElementById('setup-section');
const connectedSection = document.getElementById('connected-section');
const loadingSection = document.getElementById('loading-section');
const apiKeyInput = document.getElementById('api-key-input');
const saveBtn = document.getElementById('save-btn');
const disconnectBtn = document.getElementById('disconnect-btn');
const errorMessage = document.getElementById('error-message');
const connectedSince = document.getElementById('connected-since');

/**
 * Localize all elements with data-i18n attribute
 */
function localizeHtml() {
  document.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.getAttribute('data-i18n');
    const msg = chrome.i18n.getMessage(key);
    if (msg) {
      el.textContent = msg;
    }
  });
}

/**
 * Show a specific section, hide others
 */
function showSection(section) {
  setupSection.style.display = 'none';
  connectedSection.style.display = 'none';
  loadingSection.style.display = 'none';
  section.style.display = 'flex';
}

/**
 * Show error message
 */
function showError(msg) {
  errorMessage.textContent = msg;
  errorMessage.style.display = 'block';
}

/**
 * Hide error message
 */
function hideError() {
  errorMessage.style.display = 'none';
}

/**
 * Check current connection status on popup open
 */
async function checkStatus() {
  chrome.storage.local.get(['apiKey', 'accountInfo'], (result) => {
    if (result.apiKey) {
      showConnected(result.accountInfo);
    } else {
      showSection(setupSection);
    }
  });
}

/**
 * Show connected state
 */
function showConnected(accountInfo) {
  showSection(connectedSection);
  if (accountInfo && accountInfo.validatedAt) {
    const date = new Date(accountInfo.validatedAt);
    const lang = chrome.i18n.getUILanguage() || 'pt-BR';
    const dateStr = date.toLocaleDateString(lang);
    connectedSince.textContent = chrome.i18n.getMessage('popupStatusSince', [dateStr]);
  }
}

/**
 * Save and validate API key
 */
async function handleSave() {
  hideError();
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showError(chrome.i18n.getMessage('popupErrorRequired'));
    return;
  }

  if (!apiKey.startsWith('lr_live_')) {
    showError(chrome.i18n.getMessage('popupErrorInvalid'));
    return;
  }

  saveBtn.disabled = true;
  showSection(loadingSection);

  try {
    chrome.runtime.sendMessage(
      { type: 'VALIDATE_API_KEY', apiKey },
      (response) => {
        if (chrome.runtime.lastError) {
          showSection(setupSection);
          showError(chrome.i18n.getMessage('popupErrorConnection'));
          saveBtn.disabled = false;
          return;
        }

        if (response && response.success) {
          showConnected(response.data);
          apiKeyInput.value = '';
        } else {
          showSection(setupSection);
          const msg = response?.error?.message || chrome.i18n.getMessage('popupErrorExpired');
          showError(msg);
        }
        saveBtn.disabled = false;
      }
    );
  } catch (err) {
    showSection(setupSection);
    showError(chrome.i18n.getMessage('popupErrorValidation'));
    saveBtn.disabled = false;
  }
}

/**
 * Disconnect (clear API key)
 */
function handleDisconnect() {
  chrome.storage.local.remove(['apiKey', 'accountInfo'], () => {
    chrome.runtime.sendMessage({ type: 'INVALIDATE_CACHE' });
    showSection(setupSection);
    apiKeyInput.value = '';
  });
}

// Event listeners
saveBtn.addEventListener('click', handleSave);
disconnectBtn.addEventListener('click', handleDisconnect);

apiKeyInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    handleSave();
  }
});

/**
 * Show extension version from manifest
 */
function showVersion() {
  const manifest = chrome.runtime.getManifest();
  const versionEl = document.getElementById('version-text');
  if (versionEl) {
    versionEl.textContent = chrome.i18n.getMessage('popupVersion', [manifest.version]);
  }
}

// Initialize
localizeHtml();
checkStatus();
showVersion();
