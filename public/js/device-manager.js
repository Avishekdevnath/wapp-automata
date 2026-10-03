/**
 * Device Manager Module: WhatsApp Pairing & In-Browser QR Code Generation
 */
let lastRenderedQR = null;

async function pollSessionStatus() {
  try {
    const res = await fetch('/api/session/status');
    if (!res.ok) return;
    const session = await res.json();

    const isAuth = session.status === 'authenticated';
    const phone = session.phone || 'No Account Linked';
    const name = session.name || 'WhatsApp Account';

    // Update Nav Header Pill
    const navPhone = document.getElementById('nav-device-phone');
    const navDot = document.getElementById('nav-device-dot');
    if (navPhone) navPhone.innerText = phone;
    if (navDot) navDot.className = isAuth ? 'w-2 h-2 rounded-full bg-emerald-400 animate-pulse' : 'w-2 h-2 rounded-full bg-rose-400';

    // Update Client Inbox Top Banner
    const bannerPhone = document.getElementById('client-banner-phone');
    const bannerName = document.getElementById('client-banner-name');
    const bannerStatus = document.getElementById('client-banner-status');

    if (bannerPhone) bannerPhone.innerText = phone;
    if (bannerName) bannerName.innerText = isAuth ? `Account: ${name}` : 'Scan QR code to connect';
    if (bannerStatus) {
      bannerStatus.innerText = isAuth ? 'Active' : 'Disconnected';
      bannerStatus.className = isAuth 
        ? 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
        : 'px-2 py-0.5 rounded-full text-[10px] font-semibold bg-rose-500/20 text-rose-300 border border-rose-500/30';
    }

    // Update Device Modal Elements
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
    }
  } catch (e) {}
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
  document.getElementById('device-modal')?.classList.remove('hidden');
  pollSessionStatus();
  if (window.lucide) lucide.createIcons();
}

function closeDeviceModal() {
  document.getElementById('device-modal')?.classList.add('hidden');
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
