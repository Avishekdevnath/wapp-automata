/**
 * Device Manager Module: WhatsApp Pairing & In-Browser QR Code Generation
 */
let lastRenderedQR = null;
let lastKnownStatus = null;
let devicePollingTimer = null;

async function pollSessionStatus() {
  try {
    const res = await fetch('/api/session/status');
    if (res.status === 401) {
      if (typeof checkAuth === 'function') checkAuth();
      return;
    }
    if (!res.ok) return;
    const session = await res.json();

    const isAuth = session.status === 'authenticated';
    const phone = session.phone || 'No Account Linked';
    const name = session.name || 'WhatsApp Account';

    // 1. Update Nav Header Pill
    const navPhone = document.getElementById('nav-device-phone');
    const navDot = document.getElementById('nav-device-dot');
    if (navPhone) navPhone.innerText = isAuth ? phone : 'Scan QR to Link';
    if (navDot) navDot.className = isAuth 
      ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' 
      : 'w-2 h-2 rounded-full bg-amber-400 animate-ping';

    // 2. Update Sidebar Badge
    const sideBadge = document.getElementById('sidebar-device-badge');
    if (sideBadge) {
      sideBadge.innerText = isAuth ? 'Connected' : 'Scan QR';
      sideBadge.className = isAuth 
        ? 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-500/20 text-emerald-300' 
        : 'px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/20 text-amber-300 animate-pulse';
    }

    // 3. Update Workspace Unlinked Alert Banner
    const unlinkedBanner = document.getElementById('unlinked-account-banner');
    if (unlinkedBanner) {
      unlinkedBanner.classList.toggle('hidden', isAuth);
    }

    // 4. Update Modal Elements
    const modalPhone = document.getElementById('modal-connected-phone');
    const modalName = document.getElementById('modal-connected-name');
    const connectedSection = document.getElementById('device-modal-connected');
    const scanSection = document.getElementById('device-modal-scan');
    const spinner = document.getElementById('qr-loading-spinner');
    const canvas = document.getElementById('qrcode-canvas');

    if (modalPhone) modalPhone.innerText = phone;
    if (modalName) modalName.innerText = name;

    // Detect fresh successful authentication transition
    if (isAuth && lastKnownStatus && lastKnownStatus !== 'authenticated') {
      if (typeof showToast === 'function') {
        showToast(`WhatsApp linked successfully! (${phone})`, 'success');
      }
      if (typeof playMessageSound === 'function') {
        playMessageSound();
      }
      // If modal is open, show connected state for 2s then close
      const modal = document.getElementById('device-modal');
      if (modal && !modal.classList.contains('hidden')) {
        if (connectedSection) connectedSection.classList.remove('hidden');
        if (scanSection) scanSection.classList.add('hidden');
        setTimeout(() => {
          closeDeviceModal();
        }, 2200);
      }
    }

    if (isAuth) {
      if (connectedSection) connectedSection.classList.remove('hidden');
      if (scanSection) scanSection.classList.add('hidden');
    } else {
      if (connectedSection) connectedSection.classList.add('hidden');
      if (scanSection) scanSection.classList.remove('hidden');

      if (session.qr) {
        if (session.qr !== lastRenderedQR) {
          renderQrCode(session.qr);
          lastRenderedQR = session.qr;
        }
      } else {
        // No QR currently available (generating or disconnected)
        if (canvas) canvas.innerHTML = '';
        if (spinner) {
          spinner.classList.remove('hidden');
          const spinnerText = spinner.querySelector('span');
          if (spinnerText) {
            spinnerText.innerText = session.status === 'auth_required' 
              ? 'Pairing session reset. Reconnecting for fresh QR...' 
              : 'Generating fresh pairing QR code...';
          }
        }
        lastRenderedQR = null;
      }
    }

    lastKnownStatus = session.status;
  } catch (e) {
    console.warn('Error polling session status:', e);
  }
}

function renderQrCode(qrString) {
  const container = document.getElementById('qrcode-canvas');
  const spinner = document.getElementById('qr-loading-spinner');
  if (spinner) spinner.classList.add('hidden');
  if (!container) return;
  container.innerHTML = '';

  if (window.QRCode) {
    try {
      new QRCode(container, {
        text: qrString,
        width: 220,
        height: 220,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.M
      });
      return;
    } catch (e) {
      console.warn('QRCode library error, using fallback img', e);
    }
  }

  const img = document.createElement('img');
  img.src = 'https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=' + encodeURIComponent(qrString);
  img.className = 'rounded-xl shadow mx-auto';
  img.alt = 'WhatsApp QR Code';
  container.appendChild(img);
}

function openDeviceModal() {
  const modal = document.getElementById('device-modal');
  if (modal) modal.classList.remove('hidden');
  pollSessionStatus();
  if (devicePollingTimer) clearInterval(devicePollingTimer);
  devicePollingTimer = setInterval(pollSessionStatus, 2500);
  if (window.lucide) lucide.createIcons();
}

function closeDeviceModal() {
  const modal = document.getElementById('device-modal');
  if (modal) modal.classList.add('hidden');
  if (devicePollingTimer) {
    clearInterval(devicePollingTimer);
    devicePollingTimer = null;
  }
}

async function triggerSessionReset() {
  if (!confirm('Are you sure you want to disconnect this WhatsApp account and link a new one?')) return;
  const btn = document.getElementById('btn-reset-session');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Resetting session...';
  }

  try {
    await fetch('/api/session/reset', { method: 'POST' });
    showToast('Session reset. Preparing QR code...', 'info');
    document.getElementById('device-modal-connected')?.classList.add('hidden');
    document.getElementById('device-modal-scan')?.classList.remove('hidden');
    document.getElementById('qr-loading-spinner')?.classList.remove('hidden');
    
    const canvas = document.getElementById('qrcode-canvas');
    if (canvas) canvas.innerHTML = '';
    lastRenderedQR = null;
    lastKnownStatus = 'resetting';
    setTimeout(pollSessionStatus, 1500);
  } catch (e) {
    showToast('Error resetting session', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = '<i data-lucide="log-out" class="w-4 h-4"></i><span>Switch / Log Out WhatsApp Account</span>';
      if (window.lucide) lucide.createIcons();
    }
  }
}

function switchPairMethod(method) {
  const qrTab = document.getElementById('tab-pair-qr');
  const codeTab = document.getElementById('tab-pair-code');
  const qrContainer = document.getElementById('pair-method-qr-container');
  const codeContainer = document.getElementById('pair-method-code-container');

  if (method === 'qr') {
    if (qrTab) qrTab.className = 'py-1.5 px-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5';
    if (codeTab) codeTab.className = 'py-1.5 px-3 rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
    if (qrContainer) qrContainer.classList.remove('hidden');
    if (codeContainer) codeContainer.classList.add('hidden');
  } else {
    if (codeTab) codeTab.className = 'py-1.5 px-3 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition-all flex items-center justify-center gap-1.5';
    if (qrTab) qrTab.className = 'py-1.5 px-3 rounded-lg text-slate-400 hover:text-white transition-all flex items-center justify-center gap-1.5';
    if (codeContainer) codeContainer.classList.remove('hidden');
    if (qrContainer) qrContainer.classList.add('hidden');
  }
  if (window.lucide) lucide.createIcons();
}

async function requestPhonePairingCode() {
  const input = document.getElementById('input-pair-phone');
  const btn = document.getElementById('btn-request-pair-code');
  const resultBox = document.getElementById('pair-code-result-box');
  const codeText = document.getElementById('pair-code-text');

  const phone = input ? input.value.trim() : '';
  if (!phone || phone.length < 8) {
    if (typeof showToast === 'function') showToast('Please enter a valid WhatsApp phone number', 'error');
    return;
  }

  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Requesting...';
  }

  try {
    const res = await fetch('/api/session/pair-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });
    const data = await res.json();
    if (res.ok && data.pairingCode) {
      if (codeText) codeText.innerText = data.pairingCode;
      if (resultBox) resultBox.classList.remove('hidden');
      if (typeof showToast === 'function') showToast('Pairing code generated! Enter it on your phone.', 'success');
    } else {
      if (typeof showToast === 'function') showToast(data.error || 'Failed to get pairing code', 'error');
    }
  } catch (err) {
    if (typeof showToast === 'function') showToast('Network error requesting pairing code', 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Get Code';
    }
    if (window.lucide) lucide.createIcons();
  }
}

function copyPairingCode() {
  const codeText = document.getElementById('pair-code-text');
  if (!codeText) return;
  const code = codeText.innerText.trim();
  navigator.clipboard.writeText(code).then(() => {
    if (typeof showToast === 'function') showToast('Pairing code copied to clipboard!', 'info');
  }).catch(() => {});
}

// Initial status check on script load
pollSessionStatus();

// Window exports & aliases
window.openDeviceModal = openDeviceModal;
window.closeDeviceModal = closeDeviceModal;
window.pollSessionStatus = pollSessionStatus;
window.pollDeviceStatus = pollSessionStatus; // Alias for backward compatibility
window.triggerSessionReset = triggerSessionReset;
window.switchPairMethod = switchPairMethod;
window.requestPhonePairingCode = requestPhonePairingCode;
window.copyPairingCode = copyPairingCode;
