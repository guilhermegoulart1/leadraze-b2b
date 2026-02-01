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
    connectedSince.textContent = `Desde ${date.toLocaleDateString('pt-BR')}`;
  }
}

/**
 * Save and validate API key
 */
async function handleSave() {
  hideError();
  const apiKey = apiKeyInput.value.trim();

  if (!apiKey) {
    showError('Por favor, insira sua API Key.');
    return;
  }

  if (!apiKey.startsWith('lr_live_')) {
    showError('API Key invalida. Deve comecar com "lr_live_".');
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
          showError('Erro de conexao. Tente novamente.');
          saveBtn.disabled = false;
          return;
        }

        if (response && response.success) {
          showConnected(response.data);
          apiKeyInput.value = '';
        } else {
          showSection(setupSection);
          const msg = response?.error?.message || 'API Key invalida ou expirada.';
          showError(msg);
        }
        saveBtn.disabled = false;
      }
    );
  } catch (err) {
    showSection(setupSection);
    showError('Erro ao validar. Verifique sua conexao.');
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

// Check status on popup open
checkStatus();
