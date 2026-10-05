/**
 * Authentication Module: Password Gate & Persistent Session Management
 * Wholesale Telecom Route Intelligence Terminal
 */

// 1. Transparent Global Fetch Interceptor
// Automatically attaches Bearer authorization header to all internal API requests
(function setupFetchInterceptor() {
  const originalFetch = window.fetch;
  window.fetch = async function (resource, config = {}) {
    try {
      const token = localStorage.getItem('wapp_token') || sessionStorage.getItem('wapp_token');
      const url = typeof resource === 'string' ? resource : (resource && resource.url ? resource.url : '');

      if (token && url.startsWith('/api/')) {
        config = config || {};
        if (!config.headers) {
          config.headers = { 'Authorization': `Bearer ${token}` };
        } else if (config.headers instanceof Headers) {
          if (!config.headers.has('Authorization')) {
            config.headers.set('Authorization', `Bearer ${token}`);
          }
        } else if (typeof config.headers === 'object') {
          if (!config.headers['Authorization']) {
            config.headers['Authorization'] = `Bearer ${token}`;
          }
        }
      }
    } catch (err) {}
    return originalFetch(resource, config);
  };
})();

// Helper to retrieve active auth token
function getSavedToken() {
  try {
    return localStorage.getItem('wapp_token') || sessionStorage.getItem('wapp_token');
  } catch (e) {
    return null;
  }
}

// 2. Persistent Session Verification
async function checkAuth() {
  const overlay = document.getElementById('auth-overlay');
  const mainApp = document.getElementById('main-app');
  const token = getSavedToken();

  try {
    const res = await fetch('/api/session/status');

    if (res.status === 401) {
      // Invalidate invalid/expired token
      localStorage.removeItem('wapp_token');
      localStorage.removeItem('wapp_remember');
      sessionStorage.removeItem('wapp_token');
      document.documentElement.classList.remove('is-authenticated');

      if (overlay) overlay.classList.remove('hidden');
      if (mainApp) mainApp.classList.add('hidden');
      return;
    }

    if (res.ok) {
      // Confirmed authenticated session
      document.documentElement.classList.add('is-authenticated');
      if (overlay) overlay.classList.add('hidden');
      if (mainApp) mainApp.classList.remove('hidden');

      if (typeof switchView === 'function') {
        switchView(window.currentView || 'routes');
      }
      if (typeof fetchMessages === 'function') fetchMessages();
      if (typeof pollSessionStatus === 'function') pollSessionStatus();
      if (typeof pollStorageStatus === 'function') pollStorageStatus();
    }
  } catch (err) {
    // If network glitch occurs but client holds valid token, don't lock user out
    if (token) {
      document.documentElement.classList.add('is-authenticated');
      if (overlay) overlay.classList.add('hidden');
      if (mainApp) mainApp.classList.remove('hidden');
    } else {
      if (overlay) overlay.classList.remove('hidden');
      if (mainApp) mainApp.classList.add('hidden');
    }
  }

  if (window.lucide) lucide.createIcons();
}

// 3. Login Submission with "Remember Me"
async function handleLoginSubmit(e) {
  if (e && e.preventDefault) e.preventDefault();

  const passwordInput = document.getElementById('auth-password');
  const rememberCheckbox = document.getElementById('auth-remember');
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('auth-error-msg');
  const overlay = document.getElementById('auth-overlay');
  const mainApp = document.getElementById('main-app');

  const password = passwordInput ? passwordInput.value.trim() : '';
  const remember = rememberCheckbox ? rememberCheckbox.checked : true;

  if (!password) {
    if (err) {
      err.innerText = 'Please enter your access password';
      err.classList.remove('hidden');
    }
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="inline-block animate-spin mr-1">↻</span><span>Verifying...</span>';
  }
  if (err) err.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();

    if (res.ok && data.status === 'ok') {
      const token = data.token;
      if (token) {
        if (remember) {
          localStorage.setItem('wapp_token', token);
          localStorage.setItem('wapp_remember', 'true');
        } else {
          sessionStorage.setItem('wapp_token', token);
          localStorage.removeItem('wapp_token');
          localStorage.removeItem('wapp_remember');
        }
      }

      document.documentElement.classList.add('is-authenticated');
      if (overlay) overlay.classList.add('hidden');
      if (mainApp) mainApp.classList.remove('hidden');

      if (typeof switchView === 'function') {
        switchView(window.currentView || 'routes');
      }
      if (typeof fetchMessages === 'function') fetchMessages();
      if (typeof pollSessionStatus === 'function') pollSessionStatus();
      if (typeof pollStorageStatus === 'function') pollStorageStatus();

      if (typeof showToast === 'function') {
        showToast('Terminal unlocked • Session saved', 'success');
      }
    } else {
      if (err) {
        err.innerText = data.error || 'Incorrect authorization password';
        err.classList.remove('hidden');
      }
    }
  } catch (networkErr) {
    if (err) {
      err.innerText = 'Unable to reach authentication server. Check connection.';
      err.classList.remove('hidden');
    }
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<span>Unlock Terminal</span><i data-lucide="arrow-right" class="w-4 h-4"></i>';
      if (window.lucide) lucide.createIcons();
    }
  }
}

// 4. Clean & Secure Logout Handler
async function handleLogout() {
  try {
    localStorage.removeItem('wapp_token');
    localStorage.removeItem('wapp_remember');
    sessionStorage.removeItem('wapp_token');
    document.documentElement.classList.remove('is-authenticated');

    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  window.location.reload();
}
