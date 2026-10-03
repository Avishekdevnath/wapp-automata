/**
 * Authentication Module: Password Gate & Session Management
 */
async function checkAuth() {
  try {
    const res = await fetch('/api/session/status');
    if (res.status === 401) {
      document.getElementById('auth-overlay').classList.remove('hidden');
      document.getElementById('main-app').classList.add('hidden');
    } else {
      document.getElementById('auth-overlay').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      setUiMode(window.currentUiMode || 'client');
      fetchMessages();
      pollSessionStatus();
    }
  } catch (e) {
    document.getElementById('auth-overlay').classList.remove('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

async function handleLoginSubmit(e) {
  e.preventDefault();
  const passwordInput = document.getElementById('auth-password');
  const btn = document.getElementById('btn-login');
  const err = document.getElementById('auth-error-msg');
  const password = passwordInput.value;

  btn.disabled = true;
  btn.innerText = 'Verifying...';
  err.classList.add('hidden');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    const data = await res.json();
    if (res.ok && data.status === 'ok') {
      document.getElementById('auth-overlay').classList.add('hidden');
      document.getElementById('main-app').classList.remove('hidden');
      setUiMode(window.currentUiMode || 'client');
      fetchMessages();
      pollSessionStatus();
      showToast('Dashboard unlocked successfully', 'success');
    } else {
      err.innerText = data.error || 'Incorrect authorization password';
      err.classList.remove('hidden');
    }
  } catch (err) {
    err.innerText = 'Network connection error';
    err.classList.remove('hidden');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<span>Unlock Dashboard</span><i data-lucide="arrow-right" class="w-4 h-4"></i>';
    if (window.lucide) lucide.createIcons();
  }
}

async function handleLogout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
  } catch (e) {}
  location.reload();
}
