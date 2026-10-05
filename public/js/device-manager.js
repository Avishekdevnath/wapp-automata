/**
 * Device Manager Module: WhatsApp Pairing & In-Browser QR Code Generation
 */
let lastRenderedQR = null;
let hasAutoOpenedQr = false;

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
    if (navDot) navDot.className = isAuth ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-amber-400 animate-ping';

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

    if (modalPhone) modalPhone.innerText = phone;
    if (modalName) modalName.innerText = name;

    if (isAuth) {
      if (connectedSection) connectedSection.classList.remove('hidden');
      if (scanSection) scanSection.classList.add('hidden');
    } else {
      if (connectedSection) connectedSection.classList.add('hidden');
      if (scanSection) scanSection.classList.remove('hidden');

      if (session.qr && session.qr !== lastRenderedQR) {
        renderQrCode(session.qr);
        lastRenderedQR = session.qr;
      }

      // Auto-open modal on first view if user has not linked WhatsApp yet
      if (!hasAutoOpenedQr && session.status === 'scan_qr') {
        hasAutoOpenedQr = true;
        openDeviceModal();
      }
    }
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
  if (window.lucide) lucide.createIcons();
}

function closeDeviceModal() {
  const modal = document.getElementById('device-modal');
  if (modal) modal.classList.add('hidden');
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

window.openDeviceModal = openDeviceModal;
window.closeDeviceModal = closeDeviceModal;
window.pollSessionStatus = pollSessionStatus;
window.triggerSessionReset = triggerSessionReset;
